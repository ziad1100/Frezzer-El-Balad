import { query } from './index';
import { DEFAULT_SETTINGS } from '../constants';

/** Internal settings keys that power features but must never be exposed to clients. */
const INTERNAL_SETTINGS_KEYS = new Set(['statsClearedAt']);

export const getSettingsMap = async (): Promise<Record<string, unknown>> => {
  const docs = await query<{ key: string; value: unknown }>('SELECT key, value FROM settings');
  const map: Record<string, unknown> = { ...DEFAULT_SETTINGS };
  for (const doc of docs) {
    if (INTERNAL_SETTINGS_KEYS.has(doc.key)) continue;
    map[doc.key] = doc.value;
  }
  return map;
};

export const upsertSetting = async (key: string, value: unknown): Promise<void> => {
  const jsonValue = typeof value === 'string' ? JSON.stringify(value) : value;
  await query(
    `INSERT INTO settings (key, value) VALUES ($1, $2::jsonb)
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
    [key, jsonValue],
  );
};