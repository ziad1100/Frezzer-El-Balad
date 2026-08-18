import { beforeEach, describe, expect, it } from 'vitest';
import * as postsRepo from '../../db/posts';
import { api, bearer, createUser, seedRoles, toId } from '../helpers';

const POSTS = '/api/v1/posts';

describe('posts', () => {
  beforeEach(async () => {
    await seedRoles();
  });

  it('creates posts with unique slugs for duplicate titles', async () => {
    const admin = await createUser({ role: 'admin' });
    const auth = bearer(admin.id);

    const first = await api
      .post(POSTS)
      .set(auth)
      .send({ title: 'عروض رمضان', titleEn: 'Ramadan Offers', content: 'خبر' })
      .expect(201);
    expect(first.body.data.slug).toBe('ramadan-offers');

    const second = await api
      .post(POSTS)
      .set(auth)
      .send({ title: 'عروض رمضان 2', titleEn: 'Ramadan Offers', content: 'خبر آخر' })
      .expect(201);
    expect(second.body.data.slug).toBe('ramadan-offers-1');

    const third = await api
      .post(POSTS)
      .set(auth)
      .send({ title: 'عروض رمضان', content: 'خبر إضافي' })
      .expect(201);
    expect(third.body.data.slug).toBe('arwdh-rmdhan');
  });

  it('validates missing title with 422', async () => {
    const admin = await createUser({ role: 'admin' });
    const res = await api.post(POSTS).set(bearer(admin.id)).send({ content: 'بدون عنوان' });
    expect(res.status).toBe(422);
  });

  it('rejects creation by customers', async () => {
    const customer = await createUser({ role: 'customer' });
    const res = await api
      .post(POSTS)
      .set(bearer(customer.id))
      .send({ title: 'ممنوع', content: 'x' });
    expect(res.status).toBe(403);
  });

it('lists only published posts publicly and all posts for admin', async () => {
    const admin = await createUser({ role: 'admin' });
    const auth = bearer(admin.id);
    await api.post(POSTS).set(auth).send({ title: 'منشور', titleEn: 'Visible', isPublished: true }).expect(201);
    await api.post(POSTS).set(auth).send({ title: 'مسودة', titleEn: 'Draft', isPublished: false }).expect(201);

    const published = await api.get(POSTS).expect(200);
    expect(published.body.data.items.length).toBe(1);
    expect(published.body.data.items[0].slug).toBe('visible');

    const all = await api.get(`${POSTS}/all/admin`).set(auth).expect(200);
    expect(all.body.data.total).toBe(2);
  });

  it('blocks draft listing from anonymous users and customers (S7)', async () => {
    const anonymous = await api.get(`${POSTS}/all/admin`);
    expect(anonymous.status).toBe(401);

    const customer = await createUser({ role: 'customer' });
    const customerCall = await api.get(`${POSTS}/all/admin`).set(bearer(customer.id));
    expect(customerCall.status).toBe(403);
  });

  it('re-slugs on update when the title changes, keeping a stable slug otherwise', async () => {
    const admin = await createUser({ role: 'admin' });
    const auth = bearer(admin.id);
    const created = await api
      .post(POSTS)
      .set(auth)
      .send({ title: 'عنوان أول', titleEn: 'First Title', content: 'x' })
      .expect(201);
    expect(created.body.data.slug).toBe('first-title');

    const updated = await api
      .patch(`${POSTS}/${toId(created.body.data._id)}`)
      .set(auth)
      .send({ titleEn: 'Second Title' })
      .expect(200);
    expect(updated.body.data.slug).toBe('second-title');

    const contentOnly = await api
      .patch(`${POSTS}/${toId(created.body.data._id)}`)
      .set(auth)
      .send({ content: 'محتوى جديد' })
      .expect(200);
    expect(contentOnly.body.data.slug).toBe('second-title');
  });

  it('deletes a post', async () => {
    const admin = await createUser({ role: 'admin' });
    const auth = bearer(admin.id);
    const created = await api.post(POSTS).set(auth).send({ title: 'سيحذف', titleEn: 'Delete Me' }).expect(201);
    await api.delete(`${POSTS}/${toId(created.body.data._id)}`).set(auth).expect(200);
    expect(await postsRepo.getById(created.body.data._id)).toBeNull();
  });
});

