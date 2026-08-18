import { beforeEach, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { api, bearer, createUser, seedRoles } from '../helpers';
import { uploadsDir } from '../../middlewares/upload';

const UPLOADS = '/api/v1/upload';

const PNG_1x1 = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64',
);

describe('uploads (S6)', () => {
  beforeEach(async () => {
    await seedRoles();
  });

  it('requires authentication', async () => {
    const res = await api.post(`${UPLOADS}/single`).attach('image', PNG_1x1, { filename: 'pixel.png', contentType: 'image/png' });
    expect(res.status).toBe(401);
  });

  it('accepts a real PNG and stores it locally', async () => {
    const user = await createUser();
    const before = fs.readdirSync(uploadsDir).length;
    const res = await api
      .post(`${UPLOADS}/single`)
      .set(bearer(user.id))
      .attach('image', PNG_1x1, { filename: 'pixel.png', contentType: 'image/png' });
    expect(res.status).toBe(201);
    expect(res.body.data.url).toContain('/uploads/');
    expect(fs.readdirSync(uploadsDir).length).toBe(before + 1);
    const filename = path.basename(res.body.data.url);
    fs.unlinkSync(path.join(uploadsDir, filename));
  });

  it('rejects a polyglot file whose bytes are not an image', async () => {
    const user = await createUser();
    const before = fs.readdirSync(uploadsDir).length;
    const res = await api
      .post(`${UPLOADS}/single`)
      .set(bearer(user.id))
      .attach('image', Buffer.from('<!DOCTYPE html><script>alert(1)</script>'), {
        filename: 'fake.png',
        contentType: 'image/png',
      });
    expect(res.status).toBe(400);
    expect(fs.readdirSync(uploadsDir).length).toBe(before);
  });

  it('rejects an executable uploaded under a non-image name', async () => {
    const user = await createUser();
    const res = await api
      .post(`${UPLOADS}/single`)
      .set(bearer(user.id))
      .attach('image', Buffer.from('MZ\x90\x00\x00\x00\x00\x00this is not a png'), {
        filename: 'evil.exe',
        contentType: 'image/png',
      });
    expect(res.status).toBe(400);
  });

  it('rejects scripts claiming an image mime (svg)', async () => {
    const user = await createUser();
    const res = await api
      .post(`${UPLOADS}/single`)
      .set(bearer(user.id))
      .attach('image', Buffer.from('<svg onload="alert(1)"></svg>'), {
        filename: 'evil.svg',
        contentType: 'image/svg+xml',
      });
    expect(res.status).toBe(400);
  });
});