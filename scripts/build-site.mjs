#!/usr/bin/env node
// Builds the GitHub Pages install site into _site/.
//
// - Reads the ==UserScript== header of every *.user.js in the repo root.
// - Generates an install page (index.html) grouped by website.
// - Renders how-to guides from docs/guides/<script-name>.md.
// - Copies the userscripts so they are served from the Pages URL, which is
//   what @downloadURL / @updateURL point at.
//
// Usage: node scripts/build-site.mjs [--check]
//   --check  validate metadata only, don't write _site/

import { readFileSync, writeFileSync, mkdirSync, rmSync, copyFileSync, existsSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { marked } from 'marked';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, '_site');
const GUIDES = join(ROOT, 'docs', 'guides');

export const SITE_URL = 'https://jeremychuawx.github.io/wayfarer-addons/';
export const REPO_URL = 'https://github.com/JeremyChuaWX/wayfarer-addons';
export const UPSTREAM_URL = 'https://gitlab.com/Tntnnbltn/wayfarer-addons';
export const NAMESPACE = REPO_URL;

// Which group each script is shown under, keyed by @match hostname.
const GROUPS = [
  { id: 'wayfarer', title: 'Wayfarer', hosts: ['wayfarer.scopely.com'], link: 'https://wayfarer.scopely.com/' },
  { id: 'community', title: 'Wayfarer Community Forum', hosts: ['community.wayfarer.scopely.com'], link: 'https://community.wayfarer.scopely.com/' },
  { id: 'pogo', title: 'Pokémon GO Map', hosts: ['pokemongo.com'], link: 'https://pokemongo.com/en/map' },
  { id: 'ingress', title: 'Ingress Mission Creator', hosts: ['missions.ingress.com'], link: 'https://missions.ingress.com/' },
];

// ---------------------------------------------------------------------------

function parseMeta(source, file) {
  const block = source.match(/\/\/\s*==UserScript==([\s\S]*?)\/\/\s*==\/UserScript==/);
  if (!block) throw new Error(`${file}: no ==UserScript== block`);
  const meta = {};
  for (const line of block[1].split('\n')) {
    const m = line.match(/^\s*\/\/\s*@(\S+)\s*(.*?)\s*$/);
    if (!m) continue;
    (meta[m[1]] ??= []).push(m[2]);
  }
  const one = (k) => meta[k]?.[0];
  return {
    file,
    slug: file.replace(/\.user\.js$/, ''),
    name: one('name'),
    description: one('description'),
    version: one('version'),
    namespace: one('namespace'),
    downloadURL: one('downloadURL'),
    updateURL: one('updateURL'),
    homepageURL: one('homepageURL'),
    matches: [...(meta.match ?? []), ...(meta.include ?? [])],
  };
}

function validate(s) {
  const errors = [];
  const expected = SITE_URL + s.file;
  for (const k of ['name', 'description', 'version']) if (!s[k]) errors.push(`missing @${k}`);
  if (s.namespace !== NAMESPACE) errors.push(`@namespace should be ${NAMESPACE}`);
  if (s.downloadURL !== expected) errors.push(`@downloadURL should be ${expected}`);
  if (s.updateURL !== expected) errors.push(`@updateURL should be ${expected}`);
  if (!s.matches.length) errors.push('no @match');
  return errors.map((e) => `${s.file}: ${e}`);
}

function groupFor(s) {
  const hosts = s.matches.map((m) => {
    try { return new URL(m.replace(/\*/g, 'x')).hostname; } catch { return ''; }
  });
  return GROUPS.find((g) => g.hosts.some((h) => hosts.includes(h))) ?? { id: 'other', title: 'Other', hosts: [] };
}

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function page({ title, body, depth = 0 }) {
  const base = depth ? '../'.repeat(depth) : './';
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<link rel="stylesheet" href="${base}assets/style.css">
</head>
<body>
<header class="top"><div class="wrap"><a href="${base}" class="brand">Wayfarer Addons</a>
<nav><a href="${base}#setup">Setup</a><a href="${base}#addons">Add-ons</a><a href="${base}guides/troubleshooting.html">Help</a><a href="${REPO_URL}">Source</a></nav></div></header>
<main class="wrap">
${body}
</main>
<footer class="wrap">
<p>Based on <a href="${UPSTREAM_URL}">Wayfarer Addons by Tntnnbltn</a>, modified and maintained at <a href="${REPO_URL}">${esc(REPO_URL.replace('https://', ''))}</a>.
Licensed under the <a href="${REPO_URL}/blob/main/LICENSE">GNU GPL v3</a>. Not affiliated with Niantic, Scopely, or The Pokémon Company.</p>
</footer>
<script src="${base}assets/site.js"></script>
</body>
</html>
`;
}

function indexPage(scripts, guides) {
  const grouped = GROUPS.concat([{ id: 'other', title: 'Other' }])
    .map((g) => ({ ...g, items: scripts.filter((s) => groupFor(s).id === g.id) }))
    .filter((g) => g.items.length);

  const cards = grouped.map((g) => `
<section class="group" id="${g.id}">
  <h3>${esc(g.title)}${g.link ? ` <a class="site-link" href="${esc(g.link)}">open site ↗</a>` : ''}</h3>
  <div class="cards">
  ${g.items.map((s) => `
    <article class="card">
      <h4>${esc(s.name)}</h4>
      <p>${esc(s.summary)}</p>
      ${s.status ? `<p class="status">⚠️ ${esc(s.status.split(':')[0])}${guides.has(s.slug) ? ` — <a href="./guides/${esc(s.slug)}.html">details</a>` : ''}</p>` : ''}
      <div class="actions">
        <a class="btn install" href="./${esc(s.file)}">Install</a>
        ${guides.has(s.slug) ? `<a class="btn ghost" href="./guides/${esc(s.slug)}.html">How to use</a>` : ''}
        <span class="ver">v${esc(s.version)}</span>
      </div>
    </article>`).join('')}
  </div>
</section>`).join('');

  return page({
    title: 'Wayfarer Addons — easy install',
    body: `
<section class="hero">
  <h1>Extra features for Wayfarer, the Pokémon GO map, and Ingress</h1>
  <p>Free add-ons that run in your web browser. No coding needed: set up once, then click <b>Install</b> on the ones you want.</p>
</section>

<section id="setup" class="steps">
  <h2>Setup (one time, about 2 minutes)</h2>
  <ol>
    <li>
      <h3>Install a userscript manager</h3>
      <p>This is a free browser extension that runs the add-ons for you. Choose your browser:</p>
      <ul class="browsers">
        <li data-browser="chrome"><b>Chrome, Edge, Brave, Opera:</b> <a href="https://www.tampermonkey.net/">Tampermonkey</a></li>
        <li data-browser="firefox"><b>Firefox</b> (computer or Android): <a href="https://addons.mozilla.org/firefox/addon/tampermonkey/">Tampermonkey</a></li>
        <li data-browser="safari"><b>Safari</b> (Mac, iPhone, iPad): <a href="https://apps.apple.com/app/userscripts/id1463298887">Userscripts</a></li>
      </ul>
      <div class="note" data-browser-note="chrome">
        <b>Chrome / Edge / Brave:</b> one more setting is needed or the add-ons won't run.
        Right-click the Tampermonkey icon → <b>Manage extension</b> → turn on <b>Allow user scripts</b>.
        (Older browser versions: turn on <b>Developer mode</b> at the top-right of the Extensions page instead.)
        <a href="./guides/troubleshooting.html#chrome">Step-by-step help</a>.
      </div>
    </li>
    <li>
      <h3>Click Install on an add-on below</h3>
      <p>A page from your userscript manager opens. Click <b>Install</b> again on that page to confirm.</p>
      <p class="muted">If you see a page full of code instead, the userscript manager isn't installed or is switched off. Go back to step 1.</p>
    </li>
    <li>
      <h3>Open or refresh the website</h3>
      <p>The add-on starts on its own. It updates itself automatically when a new version comes out.</p>
    </li>
  </ol>
  <p class="note">Already using the original Wayfarer Addons from GitLab? <b>Remove those versions first</b> (in your userscript manager's dashboard), otherwise both copies will run and you'll see everything twice.</p>
</section>

<section id="addons">
  <h2>Add-ons</h2>
  ${cards}
</section>
`,
  });
}

function guidePage(slug, md, scriptsBySlug) {
  const s = scriptsBySlug.get(slug);
  const header = s
    ? `<p class="crumb"><a href="../">← All add-ons</a></p>
<div class="guide-head"><a class="btn install" href="../${esc(s.file)}">Install ${esc(s.name)}</a> <span class="ver">v${esc(s.version)}</span></div>
${s.status ? `<p class="note status">⚠️ ${esc(s.status)}</p>` : ''}`
    : `<p class="crumb"><a href="../">← All add-ons</a></p>`;
  const html = marked.parse(md);
  const title = (md.match(/^#\s+(.+)$/m)?.[1] ?? slug) + ' — Wayfarer Addons';
  return page({ title, depth: 1, body: `${header}<article class="guide">${html}</article>` });
}

// ---------------------------------------------------------------------------

const files = readdirSync(ROOT).filter((f) => f.endsWith('.user.js')).sort();
const scripts = files.map((f) => parseMeta(readFileSync(join(ROOT, f), 'utf8'), f));
const errors = scripts.flatMap(validate);
if (errors.length) {
  console.error('Userscript metadata problems:\n  ' + errors.join('\n  '));
  process.exit(1);
}

const guideFiles = existsSync(GUIDES) ? readdirSync(GUIDES).filter((f) => f.endsWith('.md')) : [];
const guides = new Set(guideFiles.map((f) => f.replace(/\.md$/, '')));
// Plain-language card text: <!-- summary: ... --> in the guide, else @description.
const summaries = new Map(guideFiles.map((f) => [
  f.replace(/\.md$/, ''),
  readFileSync(join(GUIDES, f), 'utf8').match(/<!--\s*summary:\s*([\s\S]*?)\s*-->/)?.[1],
]));
for (const s of scripts) s.summary = summaries.get(s.slug) || s.description;
// Optional warning: <!-- status: Short label: full explanation --> in the guide.
// Cards show the short label; the guide page shows all of it.
for (const s of scripts) {
  if (guides.has(s.slug)) s.status = readFileSync(join(GUIDES, `${s.slug}.md`), 'utf8').match(/<!--\s*status:\s*([\s\S]*?)\s*-->/)?.[1];
}
for (const s of scripts) if (!guides.has(s.slug)) console.warn(`warning: no guide at docs/guides/${s.slug}.md`);

if (process.argv.includes('--check')) {
  console.log(`OK: ${scripts.length} userscripts, ${guides.size} guides`);
  process.exit(0);
}

rmSync(OUT, { recursive: true, force: true });
mkdirSync(join(OUT, 'guides'), { recursive: true });
mkdirSync(join(OUT, 'assets'), { recursive: true });
mkdirSync(join(OUT, 'ticket-manager-sync'), { recursive: true });

for (const a of readdirSync(join(ROOT, 'site', 'assets'))) copyFileSync(join(ROOT, 'site', 'assets', a), join(OUT, 'assets', a));
for (const s of scripts) copyFileSync(join(ROOT, s.file), join(OUT, s.file));
// .txt so browsers show it as text (easy to copy) instead of downloading it.
copyFileSync(join(ROOT, 'ticket-manager-sync', 'Code.gs'), join(OUT, 'ticket-manager-sync', 'Code.gs.txt'));
writeFileSync(join(OUT, '.nojekyll'), '');

const bySlug = new Map(scripts.map((s) => [s.slug, s]));
writeFileSync(join(OUT, 'index.html'), indexPage(scripts, guides));
for (const f of guideFiles) {
  const slug = f.replace(/\.md$/, '');
  // Guides link to each other as ./other-guide.md so they also work on GitHub; rewrite to .html.
  const md = readFileSync(join(GUIDES, f), 'utf8').replace(/\]\((\.\/)?([\w-]+)\.md(#[\w-]+)?\)/g, ']($2.html$3)');
  writeFileSync(join(OUT, 'guides', slug + '.html'), guidePage(slug, md, bySlug));
}

// The Ticket Sync setup guide lives next to its backend code; publish it too.
// Links to Code.gs point at the copy served from the site.
const syncMd = readFileSync(join(ROOT, 'ticket-manager-sync', 'README.md'), 'utf8')
  .replace(/\]\((\.\/)?Code\.gs\)/g, '](../ticket-manager-sync/Code.gs.txt)');
writeFileSync(join(OUT, 'guides', 'ticket-sync.html'), guidePage('ticket-sync', syncMd, bySlug));

console.log(`Built _site/: ${scripts.length} userscripts, ${guideFiles.length} guides`);
