import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { ProductExtra } from '@/types';

export interface CartLine {
  productId: string;
  name: string;
  nameEn: string;
  image: string;
  slug: string;
  size: string | null;
  sizeName: string;
  extras: ProductExtra[];
  qty: number;
  unitPrice: number;
}

export interface CartState {
  lines: CartLine[];
  couponCode: string;
  couponDiscount: number;
  note: string;
}

const STORAGE_KEY = 'ph_cart';

const loadCart = (): CartState => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw) as CartState;
  } catch {
    // storage unavailable
  }
  return { lines: [], couponCode: '', couponDiscount: 0, note: '' };
};

const initialState: CartState = loadCart();

const cartSlice = createSlice({
  name: 'cart',
  initialState,
  reducers: {
    addLine: (state, action: PayloadAction<CartLine>) => {
      const existing = state.lines.find(
        (l) => l.productId === action.payload.productId && l.size === action.payload.size,
      );
      if (existing) {
        existing.qty += action.payload.qty;
        existing.unitPrice = action.payload.unitPrice;
      } else {
        state.lines.push(action.payload);
      }
      state.couponDiscount = 0;
      state.couponCode = '';
    },
    updateQty: (state, action: PayloadAction<{ index: number; qty: number }>) => {
      const line = state.lines[action.payload.index];
      if (line) line.qty = Math.max(1, action.payload.qty);
      state.couponDiscount = 0;
      state.couponCode = '';
    },
    removeLine: (state, action: PayloadAction<number>) => {
      state.lines.splice(action.payload, 1);
      state.couponDiscount = 0;
      state.couponCode = '';
    },
    setCoupon: (state, action: PayloadAction<{ code: string; discount: number }>) => {
      state.couponCode = action.payload.code;
      state.couponDiscount = action.payload.discount;
    },
    clearCoupon: (state) => {
      state.couponCode = '';
      state.couponDiscount = 0;
    },
    setNote: (state, action: PayloadAction<string>) => {
      state.note = action.payload;
    },
    clearCart: (state) => {
      state.lines = [];
      state.couponCode = '';
      state.couponDiscount = 0;
      state.note = '';
    },
  },
});

export const { addLine, updateQty, removeLine, setCoupon, clearCoupon, setNote, clearCart } =
  cartSlice.actions;

export const selectSubtotal = (state: { cart: CartState }): number =>
  state.cart.lines.reduce((sum, line) => sum + line.unitPrice * line.qty, 0);

export const selectCartCount = (state: { cart: CartState }): number =>
  state.cart.lines.reduce((sum, line) => sum + line.qty, 0);

export default cartSlice.reducer;
