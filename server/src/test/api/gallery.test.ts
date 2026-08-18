import { beforeEach, describe, expect, it } from 'vitest';
import * as galleryRepo from '../../db/gallery';
import { api, bearer, createUser, seedRoles, toId } from '../helpers';

const GALLERY = '/api/v1/gallery';

describe('gallery', () => {
  beforeEach(async () => {
    await seedRoles();
  });

  it('requires auth for admin access and rejects customers with 403', async () => {
    const anon = await api.get(GALLERY);
    expect(anon.status).toBe(401);

    const customer = await createUser({ role: 'customer' });
    const denied = await api.get(GALLERY).set(bearer(customer.id));
    expect(denied.status).toBe(403);
  });

  it('lets an admin create, update, toggle and delete an image', async () => {
    const admin = await createUser({ role: 'admin' });
    const auth = bearer(admin.id);

    const created = await api
      .post(GALLERY)
      .set(auth)
      .send({ title: 'بيتزا مارجريتا', titleEn: 'Margherita Pizza', image: '/images/products/margherita-cheese.jpg', order: 1 })
      .expect(201);
    expect(created.body.data.titleEn).toBe('Margherita Pizza');
    expect(created.body.data.isVisible).toBe(true);

    const updated = await api
      .patch(`${GALLERY}/${toId(created.body.data._id)}`)
      .set(auth)
      .send({ titleEn: 'Margherita Pizza Deluxe' })
      .expect(200);
    expect(updated.body.data.titleEn).toBe('Margherita Pizza Deluxe');

    const toggled = await api.patch(`${GALLERY}/${toId(created.body.data._id)}/toggle`).set(auth).expect(200);
    expect(toggled.body.data.isVisible).toBe(false);

    await api.delete(`${GALLERY}/${toId(created.body.data._id)}`).set(auth).expect(200);
    expect(await galleryRepo.getById(created.body.data._id)).toBeNull();
  });

  it('validates missing title/image with 422', async () => {
    const admin = await createUser({ role: 'admin' });
    const res = await api.post(GALLERY).set(bearer(admin.id)).send({ titleEn: 'No title or image' });
    expect(res.status).toBe(422);
  });

  it('public list returns only visible images', async () => {
    const admin = await createUser({ role: 'admin' });
    const auth = bearer(admin.id);
    await api
      .post(GALLERY)
      .set(auth)
      .send({ title: 'ظاهر', titleEn: 'Visible One', image: '/images/products/chicken-bbq-chicken.jpg', order: 0 })
      .expect(201);
    await api
      .post(GALLERY)
      .set(auth)
      .send({ title: 'مخفي', titleEn: 'Hidden One', image: '/images/products/fajita-chicken.jpg', order: 1, isVisible: false })
      .expect(201);

    const publicList = await api.get(`${GALLERY}/public`).expect(200);
    const titles = publicList.body.data.map((g: { titleEn: string }) => g.titleEn);
    expect(titles).toContain('Visible One');
    expect(titles).not.toContain('Hidden One');
  });
});
