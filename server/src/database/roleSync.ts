import { query } from '../db';
import { PERMISSION_PRESETS } from '../constants';

const ROLE_DEFS = [
  { name: 'Admin', slug: 'admin', description: 'Full access' },
  { name: 'Manager', slug: 'manager', description: 'Manage content & orders' },
  { name: 'Employee', slug: 'employee', description: 'Orders & reviews' },
  { name: 'Customer', slug: 'customer', description: 'Customer account' },
];

export const ensureRolePermissions = async (): Promise<void> => {
  for (const r of ROLE_DEFS) {
    await query(
      `INSERT INTO roles (name, slug, description, permissions)
       VALUES ($1, $2::user_role, $3, $4)
       ON CONFLICT (slug) DO UPDATE SET
         name = EXCLUDED.name,
         description = EXCLUDED.description,
         permissions = EXCLUDED.permissions`,
      [r.name, r.slug, r.description, PERMISSION_PRESETS[r.slug as keyof typeof PERMISSION_PRESETS]],
    );
  }
  console.log('[roles] permissions synced from presets');
};