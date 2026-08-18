import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { resolveDbPath } from './dbPath';

describe('resolveDbPath', () => {
  it('anchors the dev DB at the server workspace for source (tsx) modules', () => {
    const modulePath = path.join('C:', 'repo', 'server', 'src', 'database', 'connection.ts');
    expect(resolveDbPath(modulePath)).toBe(path.join('C:', 'repo', 'server', '.data', 'db'));
  });

  it('anchors the dev DB at the server workspace for bundled (dist) modules', () => {
    const modulePath = path.join('C:', 'repo', 'server', 'dist', 'server.js');
    expect(resolveDbPath(modulePath)).toBe(path.join('C:', 'repo', 'server', '.data', 'db'));
  });
});
