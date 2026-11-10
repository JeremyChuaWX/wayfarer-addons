// Sandboxed Chromium with the real Tampermonkey extension loaded.
// Run with PLAYWRIGHT_BROWSERS_PATH=0 so the project-local browser is used
// (npm scripts set this). Tampermonkey is downloaded by tests/setup.mjs.
import { chromium } from 'playwright';
import { mkdtempSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

export const EXT = resolve('.test-cache/tampermonkey');
export const SITE = process.env.SITE_URL ?? 'https://jeremychuawx.github.io/wayfarer-addons/';

// Saved sign-in profile created by `npm run test:login` (gitignored).
export const PROFILE = resolve('.test-cache/profile');

// profile: a folder to keep cookies/logins in; default is a fresh temp folder.
export async function launch({ headless = !process.env.HEADED, viewport = { width: 1280, height: 900 }, profile } = {}) {
  if (!existsSync(join(EXT, 'manifest.json'))) throw new Error('Tampermonkey missing: run `npm run test:setup`');
  const ctx = await chromium.launchPersistentContext(profile ?? mkdtempSync(join(tmpdir(), 'wfa-test-')), {
    channel: 'chromium', headless, viewport,
    // Without this, Google sign-in refuses with "This browser may not be secure".
    ignoreDefaultArgs: ['--enable-automation'],
    args: [`--disable-extensions-except=${EXT}`, `--load-extension=${EXT}`, '--disable-blink-features=AutomationControlled'],
  });
  let [sw] = ctx.serviceWorkers();
  if (!sw) sw = await ctx.waitForEvent('serviceworker', { timeout: 15000 });
  const id = new URL(sw.url()).host;
  // Tampermonkey opens a first-run welcome tab; wait for it and close it.
  await ctx.waitForEvent('page', { predicate: (p) => p.url().includes('tampermonkey.net'), timeout: 8000 })
    .then((p) => p.close()).catch(() => {});
  return { ctx, id };
}

// Same as the user step "Manage extension → Allow user scripts".
export async function allowUserScripts(ctx, id) {
  const p = await ctx.newPage();
  await p.goto(`chrome://extensions/?id=${id}`);
  const toggle = p.locator('#allow-user-scripts');
  await toggle.waitFor();
  if (!(await toggle.evaluate((e) => e.checked))) await toggle.click();
  const on = await toggle.evaluate((e) => e.checked);
  await p.close();
  if (!on) throw new Error('could not enable "Allow user scripts"');
}

// Click an Install link the way a user would, then confirm in Tampermonkey's install tab.
// Returns the text Tampermonkey showed (name/version) for assertions.
export async function installViaClick(ctx, page, linkLocator) {
  const tabPromise = ctx.waitForEvent('page', { predicate: (p) => p.url().startsWith('chrome-extension://'), timeout: 20000 });
  await linkLocator.click();
  const tab = await tabPromise;
  await tab.waitForLoadState();
  const btn = tab.getByRole('button', { name: /^(Install|Reinstall|Update)$/i }).or(tab.locator('input[type=button][value=Install]')).first();
  await btn.waitFor({ timeout: 20000 });
  const text = await tab.locator('body').innerText();
  await btn.click();
  await closeWhenInstalled(tab);
  return text;
}

export function collectErrors(page) {
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e.message ?? e)));
  page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  return errors;
}

// Install by opening the .user.js URL directly (what clicking Install does).
export async function installFromUrl(ctx, url) {
  const page = await ctx.newPage();
  const tabPromise = ctx.waitForEvent('page', { predicate: (p) => p.url().startsWith('chrome-extension://'), timeout: 20000 });
  await page.goto(url).catch(() => {}); // navigation may be aborted by the extension
  const tab = await tabPromise;
  const btn = tab.getByRole('button', { name: /^(Install|Reinstall|Update)$/i }).first();
  await btn.waitFor({ timeout: 20000 });
  const text = await tab.locator('body').innerText();
  await btn.click();
  await closeWhenInstalled(tab);
  if (!page.isClosed()) await page.close();
  return text;
}

// Records google.maps.Polygon instances shown on a map, by stroke colour.
// Must be added before the page loads (page.addInitScript).
export function polygonCounterInit() {
  window.__polys = new Set();
  const iv = setInterval(() => {
    const P = window.google?.maps?.Polygon;
    if (!P || P.prototype.__wrapped) return;
    const orig = P.prototype.setMap;
    P.prototype.setMap = function (m) { if (m) window.__polys.add(this); else window.__polys.delete(this); return orig.call(this, m); };
    P.prototype.__wrapped = true;
    clearInterval(iv);
  }, 20);
  window.__polyCounts = () => {
    const c = {};
    for (const p of window.__polys) { const k = p.get('strokeColor'); c[k] = (c[k] || 0) + 1; }
    return c;
  };
}

// Counts DOM mutations so tests can detect scripts that keep changing the page
// while nothing is happening (observer feedback loops). Use with addInitScript.
export function mutationCounterInit() {
  window.__mut = 0;
  const start = () => new MutationObserver((recs) => { window.__mut += recs.length; })
    .observe(document.documentElement, { subtree: true, childList: true, attributes: true, characterData: true });
  if (document.documentElement) start(); else document.addEventListener('readystatechange', start, { once: true });
}

// Mutations per second over `ms` once the page has settled.
export async function idleMutationRate(page, ms = 5000) {
  await page.evaluate(() => { window.__mut = 0; });
  await page.waitForTimeout(ms);
  return (await page.evaluate(() => window.__mut)) / (ms / 1000);
}

// After clicking Install, Tampermonkey either closes the tab or removes the
// Install button. Wait for either, then close the tab if it's still open.
export async function closeWhenInstalled(tab) {
  await Promise.race([
    tab.waitForEvent('close'),
    tab.getByRole('button', { name: /^Install$/ }).waitFor({ state: 'detached' }),
  ]).catch(() => {});
  await tab.waitForTimeout(300).catch(() => {});
  if (!tab.isClosed()) await tab.close();
}

// page.goto with one retry; the forum occasionally drops HTTP/2 connections.
export async function gotoWithRetry(page, url, opts = {}) {
  for (let i = 0; ; i++) {
    try { return await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000, ...opts }); }
    catch (e) { if (i >= 1) throw e; console.log(`    (retrying ${url}: ${e.message.split('\n')[0]})`); await page.waitForTimeout(2000); }
  }
}
