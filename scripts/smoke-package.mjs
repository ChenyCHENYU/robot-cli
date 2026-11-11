import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdtemp, readFile, writeFile, rm, mkdir } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const pkg = JSON.parse(await readFile(path.join(projectRoot, 'package.json'), 'utf8'));
const fixture = await mkdtemp(path.join(os.tmpdir(), 'robot-package-smoke-'));
const args = process.argv.slice(2);
if (args.length && (args[0] !== '--tarball' || args.length !== 2)) {
  throw new Error('用法：node scripts/smoke-package.mjs [--tarball /absolute/package.tgz]');
}

function run(command, parameters, cwd, stream = false) {
  return new Promise((resolve, reject) => {
    const child = execFile(command, parameters, {
      cwd, timeout: 5 * 60_000, maxBuffer: 10 * 1024 * 1024,
      env: { ...process.env, NODE_ENV: 'production', COREPACK_ENABLE_NETWORK: '0', COREPACK_ENABLE_DOWNLOAD_PROMPT: '0' },
    }, (error, stdout, stderr) => {
      if (error) reject(new Error(`${command} ${parameters.join(' ')}\n${stderr || stdout || error.message}`));
      else resolve(String(stdout));
    });
    if (stream) {
      child.stdout?.pipe(process.stdout);
      child.stderr?.pipe(process.stderr);
    }
  });
}

try {
  let tarball = args[1] && path.resolve(args[1]);
  if (!tarball) {
    const destination = path.join(fixture, 'package');
    await mkdir(destination);
    await run('bun', ['pm', 'pack', '--destination', destination], projectRoot, true);
    tarball = path.join(destination, `${pkg.name.replace('@', '').replace('/', '-')}-${pkg.version}.tgz`);
  }
  const consumer = path.join(fixture, 'consumer');
  await mkdir(consumer);
  await writeFile(path.join(consumer, 'package.json'), JSON.stringify({
    name: 'robot-package-consumer', private: true,
    dependencies: { [pkg.name]: `file:${tarball}` },
  }, null, 2));
  console.log(`Installing packed ${pkg.name}@${pkg.version} with production dependencies only...`);
  await run('bun', ['install', '--production', '--ignore-scripts', '--cache-dir', path.join(fixture, 'cache'), '--registry', 'https://registry.npmjs.org'], consumer, true);
  const installedRoot = path.join(consumer, 'node_modules', ...pkg.name.split('/'));
  const installed = JSON.parse(await readFile(path.join(installedRoot, 'package.json'), 'utf8'));
  assert.equal(installed.version, pkg.version);
  const bin = path.join(installedRoot, 'bin/robot.js');
  assert.equal((await run(process.execPath, [bin, '--version'], consumer)).trim(), pkg.version);
  const list = await run(process.execPath, [bin, 'list'], consumer);
  assert.match(list, /robot-admin/);
  assert.match(list, /robot-h5/);
  assert.doesNotMatch(list, /robot-react/);
  const preview = await run(process.execPath, [bin, 'create', 'package-preview', '--yes', '--dry-run', '--skip-install', '--title', '安装包验收'], consumer);
  assert.match(preview, /安装包验收/);
  assert.match(preview, /预览完成/);
  const underBun = await run('bun', ['--bun', bin, 'create', 'bun-preview', '--yes', '--dry-run', '--skip-install'], consumer);
  assert.match(underBun, /预览完成/);
  console.log(`Package smoke passed: ${pkg.name}@${pkg.version} (fresh production install, Node and Bun entry points).`);
  console.log(`Verified tarball: ${tarball}`);
} finally {
  await rm(fixture, { recursive: true, force: true });
}
