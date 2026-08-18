import type { Role } from '@/types';

export function isStaffRole(role?: Role | string | null): boolean {
  return role === 'admin' || role === 'manager';
}

export function postAuthTarget(
  user: { role?: Role | string | null } | null | undefined,
  from?: string | null,
): string {
  if (from) return from;
  return user && isStaffRole(user.role) ? '/admin' : '/';
}