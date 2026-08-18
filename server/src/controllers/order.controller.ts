import type { Request, Response } from 'express';
import * as ordersRepo from '../db/orders';
import * as usersRepo from '../db/users';
import * as analyticsRepo from '../db/analytics';
import { apiErrorFromPg, query } from '../db';
import { PUBLIC_COLS } from '../db/products';
import { sendToUsers } from '../db/notifications';
import { ApiError } from '../utils/ApiError';
import { ApiResponse } from '../utils/ApiResponse';
import { asyncHandler } from '../utils/asyncHandler';
import { generateOrderNo } from '../utils';
import type { AuthRequest } from '../middlewares/auth';
import { validateCoupon } from '../services/coupon.service';
import { enqueueOrderConfirmation } from '../services/email.service';
import { ORDER_STATUS, ORDER_STATUS_LABELS, ORDER_STATUS_TRANSITIONS, PAYMENT_METHODS, TERMINAL_ORDER_STATUSES } from '../constants';
import { getSettingsMap } from '../db/settings';

interface OrderItemInput {
  product: string;
  size?: string | null;
  extras?: { name: string; price: number }[];
  qty: number;
}

export const createOrder = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { items: rawItems, couponCode, address, phone, notes, paymentMethod } = req.body;
  const userId = req.user!.id;
  if (!Array.isArray(rawItems) || rawItems.length === 0) {
    throw new ApiError(400, 'Order must contain at least one item');
  }
  if (!address || !phone) throw new ApiError(400, 'Delivery address and phone are required');

  const items = rawItems as OrderItemInput[];
  const productIds = items.map((i) => i.product);
  const productRows = (await query(
    `SELECT ${PUBLIC_COLS} FROM products p WHERE p.id = ANY($1::uuid[])`,
    [productIds],
  )) as Array<Record<string, unknown>>;
  const productMap = new Map(productRows.map((p) => [String(p._id), p]));

  let subtotal = 0;
  const orderItems = items.map((item) => {
    const product = productMap.get(String(item.product));
    if (!product) throw new ApiError(404, 'Product not found in order');
    const sizes = (product.sizes as Array<{ _id: string; price: number; name: string }>) ?? [];
    const size = sizes.find((s) => String(s._id) === String(item.size));
    const unitPrice = size?.price ?? (product.basePrice as number) ?? 0;
    const extras = (item.extras ?? []).map((e) => {
      const dbExtra = ((product.extras as Array<{ name: string; nameEn: string; price: number }>) ?? []).find(
        (p) => p.name === e.name || p.nameEn === e.name,
      );
      if (!dbExtra) {
        throw new ApiError(400, `Unknown extra "${e.name}" on product "${product.name}"`);
      }
      return { name: dbExtra.name, price: dbExtra.price };
    });
    const extrasTotal = extras.reduce((acc, e) => acc + (Number(e.price) || 0), 0);
    const lineTotal = (unitPrice + extrasTotal) * Math.max(1, item.qty);
    subtotal += lineTotal;
    return {
      productId: product._id as string,
      name: product.name as string,
      size: size?.name ?? '',
      extras,
      qty: Math.max(1, item.qty),
      unitPrice: unitPrice + extrasTotal,
      lineTotal,
    };
  });

  const settings = await getSettingsMap();
  const defaultFee = Number((settings.deliveryFee as number) ?? 25);
  const minOrder = Number((settings.minimumOrder as number) ?? 100);
  const freeDeliveryOver = Number((settings.freeDeliveryOver as number) ?? 0);

  if (subtotal < minOrder) {
    throw new ApiError(400, `Minimum order is ${minOrder} EGP`);
  }
  let deliveryFee = defaultFee;
  if (freeDeliveryOver > 0 && subtotal >= freeDeliveryOver) {
    deliveryFee = 0;
  }

  let discount = 0;
  if (couponCode) {
    const validated = await validateCoupon(couponCode, userId, subtotal);
    discount = validated.amount;
  }

  const total = Math.max(0, subtotal + deliveryFee - discount);

  const method = Object.values(PAYMENT_METHODS).includes(paymentMethod) ? paymentMethod : PAYMENT_METHODS.CASH;

  let order: Record<string, unknown> | null = null;
  const statusHistory = [{ status: ORDER_STATUS.PENDING, changedBy: userId, at: new Date() }];
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const orderNo = await generateOrderNo();
    try {
      order = await ordersRepo.placeOrder({
        orderNo,
        userId,
        items: orderItems,
        subtotal,
        deliveryFee,
        discount,
        couponCode: couponCode?.toUpperCase() ?? '',
        total,
        paymentMethod: method,
        paymentReference: '',
        paymentAmount: total,
        deliveryAddress: address,
        phone,
        customerName: req.body.customerName || 'عميل',
        notes: notes ?? '',
        statusHistory,
      });
      break;
    } catch (err) {
      // duplicate orderNo (rare collision) — retry with a fresh number
      if ((err as { code?: string })?.code === '23505' && attempt < 2) {
        continue;
      }
      throw err;
    }
  }
  if (!order) throw new ApiError(500, 'Could not create order');

  const senderEmail = (await usersRepo.getById(userId))?.email ?? '';
  void enqueueOrderConfirmation(senderEmail, (order.orderNo as string) ?? '', (order.total as number) ?? total).catch(() => undefined);

  await analyticsRepo.bumpDailyStats(new Date().toISOString().slice(0, 10), (order.total as number) ?? total);

  res.status(201).json(new ApiResponse(201, order, 'Order created successfully'));
});

export const cancelOrder = asyncHandler(async (req: AuthRequest, res: Response) => {
  const order = await ordersRepo.getByUserAndId(req.user!.id, req.params.id);
  if (!order) throw new ApiError(404, 'Order not found');
  if (order.status !== ORDER_STATUS.PENDING) {
    throw new ApiError(400, 'Only pending orders can be cancelled');
  }
  const updated = await ordersRepo.cancel(req.params.id, req.user!.id, [
    { status: ORDER_STATUS.CANCELLED, changedBy: req.user!.id, at: new Date() },
  ]);
  res.json(new ApiResponse(200, updated, 'Order cancelled'));
});

export const updateStatus = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { status } = req.body;
  if (!Object.values(ORDER_STATUS).includes(status)) throw new ApiError(400, 'Invalid status');
  const current = await ordersRepo.getById(req.params.id);
  if (!current) throw new ApiError(404, 'Order not found');
  const allowed = ORDER_STATUS_TRANSITIONS[current.status as string] ?? [];
  if (!allowed.includes(status)) {
    throw new ApiError(400, `Invalid status transition from "${current.status}" to "${status}"`);
  }
  const order = await ordersRepo.updateStatus(
    req.params.id,
    status,
    [{ status, changedBy: req.user!.id, at: new Date() }],
  );
  if (!order) throw new ApiError(404, 'Order not found');
  const [labelAr, labelEn] = ORDER_STATUS_LABELS[status] ?? [status, status];
  await sendToUsers({
    userIds: [order.user as string],
    title: `حالة الطلب ${order.orderNo}`,
    titleEn: `Order ${order.orderNo} status`,
    body: `تم تحديث حالة طلبك إلى ${labelAr}`,
    bodyEn: `Your order status is now ${labelEn}`,
    type: 'order',
    link: `/account/orders/${order._id}`,
  });
  res.json(new ApiResponse(200, order, 'Order status updated'));
});

export const adminCancel = asyncHandler(async (req: AuthRequest, res: Response) => {
  const order = await ordersRepo.getById(req.params.id);
  if (!order) throw new ApiError(404, 'Order not found');
  if (TERMINAL_ORDER_STATUSES.includes(order.status as string)) {
    throw new ApiError(400, 'This order cannot be cancelled');
  }
  const reason = String(req.body?.reason ?? '').trim();
  const updated = await ordersRepo.adminCancel(req.params.id, [
    { status: ORDER_STATUS.CANCELLED, changedBy: req.user!.id, at: new Date(), reason },
  ]);
  if (!updated) throw new ApiError(400, 'This order cannot be cancelled');
  const cancelledUserId = typeof updated.user === 'string' ? updated.user : (updated.user as { _id: string })._id;
  await sendToUsers({
    userIds: [cancelledUserId],
    title: `حالة الطلب ${updated.orderNo}`,
    titleEn: `Order ${updated.orderNo} status`,
    body: `تم إلغاء طلبك${reason ? ` — السبب: ${reason}` : ''}`,
    bodyEn: `Your order has been cancelled${reason ? ` — reason: ${reason}` : ''}`,
    type: 'order',
    link: `/account/orders/${updated._id}`,
  });
  res.json(new ApiResponse(200, updated, 'Order cancelled'));
});

export const adminComplimentary = asyncHandler(async (req: AuthRequest, res: Response) => {
  const order = await ordersRepo.getById(req.params.id);
  if (!order) throw new ApiError(404, 'Order not found');
  if (TERMINAL_ORDER_STATUSES.includes(order.status as string)) {
    throw new ApiError(400, 'This order cannot be marked as complimentary');
  }
  const reason = String(req.body?.reason ?? '').trim();
  if (!reason) throw new ApiError(400, 'A reason is required');
  const updated = await ordersRepo.markComplimentary(req.params.id, req.user!.id, reason, [
    { status: ORDER_STATUS.COMPLIMENTARY, changedBy: req.user!.id, at: new Date(), reason },
  ]);
  if (!updated) throw new ApiError(400, 'This order cannot be marked as complimentary');
  const complimentaryUserId = typeof updated.user === 'string' ? updated.user : (updated.user as { _id: string })._id;
  await sendToUsers({
    userIds: [complimentaryUserId],
    title: `حالة الطلب ${updated.orderNo}`,
    titleEn: `Order ${updated.orderNo} status`,
    body: `طلبك أصبح مجانياً (هدية)${reason ? ` — السبب: ${reason}` : ''}`,
    bodyEn: `Your order is now complimentary${reason ? ` — reason: ${reason}` : ''}`,
    type: 'order',
    link: `/account/orders/${updated._id}`,
  });
  res.json(new ApiResponse(200, updated, 'Order marked as complimentary'));
});

export const history = asyncHandler(async (req: AuthRequest, res: Response) => {
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 10));
  const result = await ordersRepo.listByUser(req.user!.id, page, limit);
  res.json(new ApiResponse(200, { ...result, page, limit }));
});

export const adminList = asyncHandler(async (req: Request, res: Response) => {
  const page = Number(req.query.page) || 1;
  const limit = Number(req.query.limit) || 20;
  const status = String(req.query.status || '');
  const q = String(req.query.q || '');
  try {
    const result = await ordersRepo.adminList(page, limit, status, q);
    res.json(new ApiResponse(200, { ...result, page }));
  } catch (err) {
    throw apiErrorFromPg(err);
  }
});

export const stats = asyncHandler(async (_req: Request, res: Response) => {
  res.json(new ApiResponse(200, await ordersRepo.stats()));
});