import bcrypt from 'bcryptjs';
import request from 'supertest';
import app from '../app';
import * as usersRepo from '../db/users';
import { query } from '../db';
import { PERMISSION_PRESETS, ROLES } from '../constants';
import { signAccessToken } from '../utils/token';

export const api = request(app);

export const seedRoles = async (): Promise<void> => {
  const defs: { name: string; slug: string; description: string }[] = [
    { name: 'Admin', slug: ROLES.ADMIN, description: 'Full access' },
    { name: 'Manager', slug: ROLES.MANAGER, description: 'Manage content & orders' },
    { name: 'Employee', slug: ROLES.EMPLOYEE, description: 'Orders & reviews' },
    { name: 'Customer', slug: ROLES.CUSTOMER, description: 'Customer account' },
  ];
  for (const d of defs) {
    await query(
      `INSERT INTO roles (name, slug, description, permissions)
       VALUES ($1, $2, $3, $4::jsonb)
       ON CONFLICT (slug) DO UPDATE SET
         name = EXCLUDED.name,
         description = EXCLUDED.description,
         permissions = EXCLUDED.permissions`,
      [d.name, d.slug, d.description, JSON.stringify(PERMISSION_PRESETS[d.slug as keyof typeof PERMISSION_PRESETS])],
    );
  }
};

export interface UserOverrides {
  fullName?: string;
  email?: string;
  phone?: string;
  password?: string;
  role?: string;
  isActive?: boolean;
  isVerified?: boolean;
  avatar?: string;
  provider?: string;
  providerId?: string;
  refreshToken?: string | null;
  emailVerifyToken?: string | null;
  emailVerifyExpires?: Date | null;
  resetToken?: string | null;
  resetTokenExpires?: Date | null;
}

let userSeq = 0;

export const createUser = async (overrides: UserOverrides = {}) => {
  userSeq += 1;
  const {
    fullName = 'Test User',
    email = `test-${Date.now()}-${userSeq}@pizzahouse.test`,
    phone = '01000000000',
    password = 'Pizza123!',
    role = ROLES.CUSTOMER,
    isActive = true,
    isVerified = true,
    avatar = '',
    provider = 'local',
    providerId = '',
    emailVerifyToken = null,
    emailVerifyExpires = null,
    resetToken,
    resetTokenExpires,
  } = overrides;

  const user = await usersRepo.create({
    fullName,
    email,
    phone,
    passwordHash: await bcrypt.hash(password, 4),
    role,
    isActive,
    isVerified,
    avatar,
    provider,
    providerId,
    emailVerifyToken,
    emailVerifyExpires,
  });
  if (resetToken !== undefined) {
    await usersRepo.update(user.id, { resetToken, resetTokenExpires: resetTokenExpires ?? null });
  }
  return user;
};

export const bearer = (userId: string): Record<string, string> => ({
  Authorization: `Bearer ${signAccessToken(userId)}`,
});

export const toId = (value: unknown): string => String(value);