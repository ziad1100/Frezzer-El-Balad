import path from 'node:path';

export const resolveDbPath = (modulePath: string): string => {
  const fileDir = path.dirname(modulePath);
  const isBundled = path.basename(fileDir) === 'dist';
  const serverRoot = isBundled ? path.resolve(fileDir, '..') : path.resolve(fileDir, '..', '..');
  return path.join(serverRoot, '.data', 'db');
};
