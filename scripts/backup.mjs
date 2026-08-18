import { execFileSync } from 'node:child_process';
import path from 'node:path';

const REPO_ROOT = process.cwd();

const run = (cmd, args) => execFileSync(cmd, args, { stdio: 'inherit', windowsHide: true, cwd: REPO_ROOT });

console.log('=== ORABI backup ===');

console.log('\n[1/3] Database dump + data set copy');
run('node', [path.join('scripts', 'backup-db.mjs')]);

console.log('\n[2/3] Git commit');
run('git', ['add', '-A']);
try {
  const out = execFileSync('git', ['status', '--porcelain'], { encoding: 'utf8', cwd: REPO_ROOT });
  if (out.trim()) {
    run('git', ['commit', '-m', `backup: snapshot ${new Date().toISOString()}`]);
  } else {
    console.log('  (no changes to commit)');
  }
} catch {
  console.log('  (no changes to commit)');
}

console.log('\n[3/3] Push to GitHub (skipped if no remote)');
try {
  const remotes = execFileSync('git', ['remote'], { encoding: 'utf8', cwd: REPO_ROOT }).trim();
  if (remotes.includes('origin')) {
    run('git', ['push']);
    console.log('  pushed to origin');
  } else {
    console.log('  no git remote configured — GitHub push skipped');
  }
} catch {
  console.log('  git push failed (offline / unauthenticated) — git commit still saved');
}

console.log('\n===== backup complete =====');