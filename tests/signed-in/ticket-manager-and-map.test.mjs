// Test: add-ons on sites that need a signed-in account.
//
// Uses the login saved by `npm run test:login` (.test-cache/profile). Each run
// works on a throwaway copy of that profile, so tests never change it. Tests
// only load pages and click map markers; nothing is submitted to Wayfarer.
//
// Skipped automatically if you haven't signed in yet.
import { launchSignedIn, hasSavedLogin, installFromUrl, collectErrors, polygonCounterInit, gotoWithRetry } from '../lib/harness.mjs';
import { serveSite } from '../lib/serve.mjs';
import { test, skip, assert, done } from '../lib/run.mjs';

if (!hasSavedLogin()) {
  skip('signed-in tests', 'no saved login: run `npm run test:login` and sign in first');
  done();
  process.exit(0);
}

const site = await serveSite();
const { ctx } = await launchSignedIn();

for (const s of ['wayfarer-ticket-manager', 'pokemon-go-map-s2', 'pokemon-go-map-search', 'pokemon-go-map-preview-card-details', 'pokemon-go-map-routes']) {
  await installFromUrl(ctx, site.url + s + '.user.js');
}

const dismissCookies = (page) => page.getByRole('button', { name: 'Decline' }).click({ timeout: 3000 }).catch(() => {});
const scriptErrors = (errors) => errors.filter((e) => !/Failed to load resource|net::ERR|status of 4\d\d/.test(e));

await test('Wayfarer: still signed in', async () => {
  const page = await ctx.newPage();
  await gotoWithRetry(page, 'https://wayfarer.scopely.com/profile');
  await page.waitForLoadState('networkidle').catch(() => {});
  assert(new URL(page.url()).pathname === '/profile', `redirected to ${page.url()}; sign in again with npm run test:login`);
  await page.close();
});

await test('Ticket Manager: button opens the ticket list', async () => {
  const page = await ctx.newPage();
  const errors = collectErrors(page);
  await gotoWithRetry(page, 'https://wayfarer.scopely.com/mapview');
  await dismissCookies(page);
  await page.locator('#ticketSwitchButton').click({ timeout: 30000 });
  await page.locator('#ticketInterfaceContainer').waitFor({ state: 'visible', timeout: 15000 });
  assert(await page.locator('.wftm-table-container tbody tr').count() >= 1, 'ticket table is empty');
  const e = scriptErrors(errors);
  assert(!e.length, 'page errors: ' + e.join('; '));
  await page.close();
});

// The map page (pokemongo.com/<lang>/map) shows the real map in an iframe at
// pokemongo.com/gamemap; that iframe is where the add-ons run.
const page = await ctx.newPage();
const mapErrors = collectErrors(page);
await page.addInitScript(polygonCounterInit);
let map;

await test('Pokémon GO map: loads, add-ons run only inside the map', async () => {
  await gotoWithRetry(page, 'https://pokemongo.com/en/map');
  await dismissCookies(page);
  await page.waitForFunction(() => document.querySelector('iframe[src*="/gamemap"]'), null, { timeout: 30000 });
  map = page.frames().find((f) => f.url().includes('/gamemap'));
  assert(map, 'map iframe not found');
  await map.locator('#pgo-better-search-wrap').waitFor({ timeout: 30000 });
  assert(await page.locator('[id^=pgo-]').count() === 0, 'add-on UI leaked onto the outer page');
  // Search shows a temporary floating box until the map toolbar renders, then moves into it.
  await map.locator('#pgo-better-search-wrap:not(.pgo-floating-wrapper)').waitFor({ timeout: 20000 })
    .catch(() => { throw new Error('search box never moved into the map toolbar'); });
  assert(await map.locator('#pgo-better-search-wrap').count() === 1, 'expected exactly one search box');
});

await test('S2 Grids: draws cells when zoomed in', async () => {
  for (let i = 0; i < 2; i++) { await page.mouse.move(640, 500); await page.mouse.wheel(0, -400); await page.waitForTimeout(1500); }
  await map.waitForFunction(() => Object.keys(window.__polyCounts?.() ?? {}).length > 0, null, { timeout: 15000 });
  const counts = await map.evaluate(() => window.__polyCounts());
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  assert(total > 4, `only ${total} S2 cells drawn: ${JSON.stringify(counts)}`);
});

await test('Preview Card Details: adds coordinates to a clicked marker', async () => {
  // Markers are drawn on a canvas, so click a grid of points until a card opens.
  const frameBox = await page.locator('iframe[src*="/gamemap"]').boundingBox();
  const coords = map.locator('.pgo-card-coords');
  let found = false;
  outer: for (let y = 200; y <= 650; y += 60) {
    for (let x = 200; x <= 1080; x += 60) {
      await page.mouse.click(frameBox.x + x, frameBox.y + y);
      if (await coords.first().waitFor({ timeout: 700 }).then(() => true, () => false)) { found = true; break outer; }
    }
  }
  assert(found, 'clicked across the map but no card with coordinates appeared');
  const text = await coords.first().innerText();
  assert(/^\(-?\d+\.\d+,\s*-?\d+\.\d+\)$/.test(text.trim()), `unexpected coordinates text "${text}"`);
  await page.keyboard.press('Escape');
});

await test('Search: typing coordinates moves the map', async () => {
  const input = map.locator('#pgo-better-search-input');
  await input.fill('37.8199,-122.4783');
  await input.press('Enter');
  await page.waitForTimeout(3000);
  const status = await map.locator('#pgo-better-search-status').innerText().catch(() => '');
  assert(!/error|fail|could not/i.test(status), `search status: ${status}`);
  await page.screenshot({ path: 'test-results/map-search.png' });
});

await test('Routes: steps aside for the map\'s built-in Routes filter', async () => {
  const routeButtons = await map.locator('ion-button', { hasText: 'Routes' }).count();
  assert(routeButtons === 1, `expected 1 Routes button, found ${routeButtons}`);
});

await test('Pokémon GO map: no add-on errors', async () => {
  // Uncaught exceptions, plus console errors the add-ons log ("[PGO ...]"). The site's
  // own noise (blocked analytics, failed requests) is ignored.
  const e = scriptErrors(mapErrors).filter((m) => !m.startsWith('console:') || /\[PGO|pgo-/.test(m));
  assert(!e.length, 'page errors: ' + e.join('; '));
});

skip('Mission Creator Exporter', 'missions.ingress.com sign-in loops in the test browser');

await ctx.close();
site.close();
done();
