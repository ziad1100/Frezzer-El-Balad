export const generateOrderNo = async (): Promise<string> => {
  const timestamp = Date.now().toString().slice(-6);
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `PH-${timestamp}-${rand}`;
};

export const pick = <T extends Record<string, unknown>, K extends keyof T>(
  obj: T,
  keys: K[],
): Pick<T, K> => {
  const out = {} as Pick<T, K>;
  for (const key of keys) {
    if (obj[key] !== undefined) out[key] = obj[key];
  }
  return out;
};

export const formatMoney = (value: number): string => {
  return `${value.toFixed(2).replace(/\.00$/, '')} ج.م`;
};
