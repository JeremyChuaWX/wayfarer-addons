// Downloads Tampermonkey from the Chrome Web Store and unpacks it into
// .test-cache/tampermonkey so tests can load the real extension.
import { mkdirSync, writeFileSync, existsSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { EXT } from './lib/harness.mjs';

const ID = 'dhdgffkkebhmkfjojejmpbldmpobfkfo'; // Tampermonkey
const DL = '.test-cache/tampermonkey-dl';
if (existsSync(`${EXT}/manifest.json`) && !process.argv.includes('--force')) {
  console.log('Tampermonkey already present (use --force to re-download)');
  process.exit(0);
}
mkdirSync(DL, { recursive: true });
const url = `https://clients2.google.com/service/update2/crx?response=redirect&prodversion=158.0&acceptformat=crx2,crx3&x=id%3D${ID}%26uc`;
const res = await fetch(url);
if (!res.ok) throw new Error(`download failed: ${res.status}`);
writeFileSync(`${DL}/tm.crx`, Buffer.from(await res.arrayBuffer()));
rmSync(EXT, { recursive: true, force: true });
mkdirSync(EXT, { recursive: true });
// A .crx is a zip with a header; unzip skips the header (and exits 1 to warn about it).
try { execFileSync('unzip', ['-q', '-o', `${DL}/tm.crx`, '-d', EXT], { stdio: 'pipe' }); } catch (e) { if (!existsSync(`${EXT}/manifest.json`)) throw e; }
console.log('Tampermonkey unpacked to', EXT);
