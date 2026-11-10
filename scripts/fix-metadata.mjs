#!/usr/bin/env node
// Points every userscript's metadata at this fork's GitHub Pages site.
//
// Run after merging changes from upstream (GitLab), which will bring back the
// upstream @namespace / @downloadURL / @updateURL lines:
//
//   git fetch upstream && git merge upstream/main
//   node scripts/fix-metadata.mjs
//
// Sets @author, @namespace, @downloadURL, @updateURL, @homepageURL and @supportURL,
// adding any that are missing. Everything else in the header is untouched.

import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SITE_URL = 'https://jeremychuawx.github.io/wayfarer-addons/';
const REPO_URL = 'https://github.com/JeremyChuaWX/wayfarer-addons';

const ORDER = ['author', 'namespace', 'downloadURL', 'updateURL', 'homepageURL', 'supportURL'];

let changed = 0;
for (const file of readdirSync(ROOT).filter((f) => f.endsWith('.user.js'))) {
  const path = join(ROOT, file);
  const src = readFileSync(path, 'utf8');
  const m = src.match(/(\/\/\s*==UserScript==\r?\n)([\s\S]*?)(\/\/\s*==\/UserScript==)/);
  if (!m) { console.warn(`skip ${file}: no header`); continue; }

  const want = {
    author: 'Tntnnbltn (fork maintained by JeremyChuaWX)',
    namespace: REPO_URL,
    downloadURL: SITE_URL + file,
    updateURL: SITE_URL + file,
    homepageURL: `${SITE_URL}guides/${file.replace(/\.user\.js$/, '')}.html`,
    supportURL: `${REPO_URL}/issues`,
  };

  const eol = m[1].endsWith('\r\n') ? '\r\n' : '\n';
  let lines = m[2].split(/\r?\n/);
  if (lines.at(-1) === '') lines.pop();
  // Column width used by this file's existing header, e.g. "// @name         X".
  const col = lines.find((l) => /^\/\/\s*@name\s/.test(l))?.match(/^\/\/\s*@name\s+/)?.[0].length ?? 17;
  const fmt = (k, v) => `// @${k}`.padEnd(Math.max(col, k.length + 5)) + v;

  const present = new Set();
  lines = lines.map((l) => {
    const k = l.match(/^\/\/\s*@(\S+)/)?.[1];
    if (k && k in want) { present.add(k); return fmt(k, want[k]); }
    return l;
  });
  // Insert missing keys after the last present key from ORDER (or after @version).
  for (const k of ORDER) {
    if (present.has(k)) continue;
    const prev = ORDER.slice(0, ORDER.indexOf(k)).reverse().find((p) => present.has(p));
    const anchor = prev
      ? lines.findIndex((l) => new RegExp(`^//\\s*@${prev}\\s`).test(l))
      : lines.findIndex((l) => /^\/\/\s*@version\s/.test(l));
    lines.splice(anchor + 1, 0, fmt(k, want[k]));
    present.add(k);
  }

  const out = src.replace(m[0], m[1] + lines.join(eol) + eol + m[3]);
  if (out !== src) { writeFileSync(path, out); changed++; console.log(`updated ${file}`); }
}
console.log(`${changed} file(s) changed`);
