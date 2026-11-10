// Test: Wayfarer add-ons that draw on or drive Wayfarer's Google Maps.
//
//  - Bonus Area Visualiser: avatar menu → Settings → Location shows a map for
//    the Hometown and the Bonus location; the add-on draws nine S2 cells
//    around each pin.
//  - EXIF Auto-Center is retired: Wayfarer's /submit/new page now moves the
//    map to the main photo's GPS location by itself. The test checks that this
//    built-in behaviour still exists (if it disappears, the add-on needs
//    reviving) and that the retired add-on causes no errors.
//
// Uses the login saved by `npm run test:login`, on a throwaway copy, with the
// read-only guard from launchSignedIn(). Nothing is saved or submitted: the
// Settings window is only opened and closed, and the photo is only chosen
// (never uploaded or submitted). Never loads /review (that assigns a
// nomination). Prints no locations from the account; the photo and browser
// location are synthetic (Sydney Harbour).
import { launchSignedIn, hasSavedLogin, installFromUrl, collectErrors, gotoWithRetry, mutationCounterInit, idleMutationRate } from '../lib/harness.mjs';
import { serveSite } from '../lib/serve.mjs';
import { test, skip, assert, done } from '../lib/run.mjs';
import { resolve } from 'node:path';

if (!hasSavedLogin()) {
  skip('Wayfarer map add-ons', 'no saved login: run `npm run test:login` and sign in first');
  done();
  process.exit(0);
}

// Synthetic locations, nowhere near the account's own.
const BROWSER_LOCATION = { latitude: -33.8568, longitude: 151.2153 };
const PHOTO_LOCATION = { lat: -33.8600, lng: 151.2100 };

// Serve the working copy (repo root) so the local scripts are installed.
const site = await serveSite(resolve('.'));
const { ctx, blocked } = await launchSignedIn();
await ctx.grantPermissions(['geolocation'], { origin: 'https://wayfarer.scopely.com' });
await ctx.setGeolocation(BROWSER_LOCATION);

for (const s of ['wayfarer-bonus-area-visualiser', 'wayfarer-map-mods-exif-auto-center']) {
  await installFromUrl(ctx, site.url + s + '.user.js');
}

const dismissCookies = (page) => page.getByRole('button', { name: 'Decline' }).click({ timeout: 3000 }).catch(() => {});
const scriptErrors = (errors) => errors.filter((e) => !/Failed to load resource|net::ERR|status of 4\d\d/.test(e));
const BONUS_STROKE = '#000000';

// Like polygonCounterInit from the harness, but catches google.maps.Polygon
// the moment Google Maps defines it. Wayfarer only loads Google Maps when the
// Settings window opens and draws the pins (and the add-on its squares) right
// away, too soon for the harness's polling. Chains with any existing hook.
function earlyPolygonCounterInit() {
  window.__polys = new Set();
  const wrap = (P) => {
    if (!P?.prototype || P.prototype.__wrapped) return;
    const orig = P.prototype.setMap;
    P.prototype.setMap = function (m) { if (m) window.__polys.add(this); else window.__polys.delete(this); return orig.call(this, m); };
    P.prototype.__wrapped = true;
  };
  const seen = new WeakSet();
  const trap = (obj, key, fn) => {
    const d = Object.getOwnPropertyDescriptor(obj, key);
    if (d && !d.configurable) return;
    let v = d?.value;
    const get = d?.get ? () => d.get.call(obj) : () => v;
    const set = d?.set ? (x) => d.set.call(obj, x) : (x) => { v = x; };
    Object.defineProperty(obj, key, { configurable: true, enumerable: true, get, set(x) { set(x); const cur = get(); if (cur) fn(cur); } });
    if (get()) fn(get());
  };
  trap(window, 'google', (g) => {
    if (seen.has(g)) return; seen.add(g);
    trap(g, 'maps', (m) => { if (seen.has(m)) return; seen.add(m); trap(m, 'Polygon', wrap); });
  });
}

// Opens avatar menu → Settings → Location.
async function openLocationSettings(page) {
  await page.getByRole('button', { name: 'Profile' }).first().click({ timeout: 30000 });
  await page.getByRole('button', { name: 'Settings', exact: true }).click({ timeout: 10000 });
  const dialog = page.locator('[aria-labelledby="wayfarer-settings-menu-title"]');
  await dialog.waitFor({ timeout: 15000 });
  await dialog.getByRole('button', { name: 'Location', exact: true }).click();
  return dialog;
}

// Google Maps doesn't draw a map until it's scrolled into view (the Bonus map
// is below the Hometown one), and the add-on zooms out once it has. Scroll to
// each map that has squares, as a user would.
async function showEachMap(page) {
  const n = await page.evaluate(() => new Set([...window.__polys].map((p) => p.getMap())).size);
  for (let i = 0; i < n; i++) {
    await page.evaluate((i) => [...new Set([...window.__polys].map((p) => p.getMap()))][i]?.getDiv().scrollIntoView({ block: 'center' }), i);
    await page.waitForTimeout(2000);
  }
}

// Black-outlined polygons drawn by the add-on: how many, on how many maps,
// whether those maps are all in the Settings window, and whether each map is
// zoomed out far enough to show every square whole. Returns no coordinates.
const bonusPolys = (page) => page.evaluate((stroke) => {
  const polys = [...window.__polys].filter((p) => p.get('strokeColor') === stroke);
  const maps = new Set(polys.map((p) => p.getMap()));
  return {
    count: polys.length,
    maps: maps.size,
    allInSettings: [...maps].every((m) => !!m.getDiv().closest('[aria-labelledby="wayfarer-settings-menu-title"]')),
    allVisible: polys.every((p) => { const b = p.getMap().getBounds(); return !!b && p.getPath().getArray().every((c) => b.contains(c)); }),
  };
}, BONUS_STROKE);

await test('Wayfarer: still signed in', async () => {
  const page = await ctx.newPage();
  await gotoWithRetry(page, 'https://wayfarer.scopely.com/profile');
  await page.waitForLoadState('networkidle').catch(() => {});
  assert(new URL(page.url()).pathname === '/profile', `redirected to ${page.url()}; sign in again with npm run test:login`);
  await page.close();
});

const page = await ctx.newPage();
const errors = collectErrors(page);
await page.addInitScript(earlyPolygonCounterInit);
await page.addInitScript(mutationCounterInit);

await test('Bonus Area Visualiser: draws 9 cells around each pin in Settings → Location', async () => {
  await gotoWithRetry(page, 'https://wayfarer.scopely.com/profile');
  await dismissCookies(page);
  await openLocationSettings(page);
  // One map per location the account has set (Hometown, Bonus): 9 squares each.
  await page.waitForFunction((stroke) => [...(window.__polys ?? [])].filter((p) => p.get('strokeColor') === stroke).length >= 9, BONUS_STROKE, { timeout: 30000 });
  await page.waitForTimeout(2000); // let the second map draw too
  await showEachMap(page);
  const r = await bonusPolys(page);
  assert(r.count === 9 * r.maps, `expected 9 squares per map, got ${r.count} on ${r.maps} map(s)`);
  assert(r.allInSettings, 'squares were drawn on a map outside the Settings window');
  assert(r.allVisible, 'map not zoomed out far enough to show all nine squares');
});

await test('Bonus Area Visualiser: page stays idle with the squares shown', async () => {
  const rate = await idleMutationRate(page, 5000);
  assert(rate < 5, `page kept changing while idle: ${rate.toFixed(1)} mutations/s`);
});

await test('Bonus Area Visualiser: squares go when Settings closes, and return when reopened on another page', async () => {
  await page.keyboard.press('Escape');
  await page.locator('[aria-labelledby="wayfarer-settings-menu-title"]').waitFor({ state: 'detached', timeout: 10000 });
  await page.waitForFunction((stroke) => ![...window.__polys].some((p) => p.get('strokeColor') === stroke), BONUS_STROKE, { timeout: 10000 })
    .catch(() => { throw new Error('squares left behind after closing Settings'); });
  // Client-side navigation to the big map, then open Settings from there.
  await page.getByRole('link', { name: 'Map', exact: true }).first().click();
  await page.waitForURL('**/mapview', { timeout: 15000 });
  await page.waitForTimeout(2000);
  assert((await bonusPolys(page)).count === 0, 'squares drawn on the big map');
  await openLocationSettings(page);
  await page.waitForFunction((stroke) => [...window.__polys].filter((p) => p.get('strokeColor') === stroke).length >= 9, BONUS_STROKE, { timeout: 30000 });
  await page.waitForTimeout(2000);
  await showEachMap(page);
  const r = await bonusPolys(page);
  assert(r.count === 9 * r.maps && r.allInSettings && r.allVisible, `after reopening: ${JSON.stringify(r)}`);
});

await test('Bonus Area Visualiser: squares follow the pin, and ignore the blue "my location" dot', async () => {
  // This account can't change its locations right now, so stand in for the
  // user picking a new spot: put a pin like the website's on a Settings map at
  // a synthetic location (only in this page; nothing is saved).
  const r = await page.evaluate(async ({ lat, lng }) => {
    const settle = () => new Promise((ok) => setTimeout(ok, 50));
    const squaresOn = (map) => [...window.__polys].filter((p) => p.getMap() === map && p.get('strokeColor') === '#000000');
    const around = (map) => {
      const b = new google.maps.LatLngBounds();
      for (const p of squaresOn(map)) p.getPath().forEach((c) => b.extend(c));
      return !b.isEmpty() && b.contains({ lat, lng }) && b.toSpan().lat() < 5;
    };
    const map = [...window.__polys][0].getMap();
    const out = {};
    const dot = new google.maps.Marker({ map, position: { lat, lng }, icon: { path: google.maps.SymbolPath.CIRCLE, scale: 8 } });
    await settle();
    out.dotIgnored = !around(map);
    dot.setMap(null);
    await settle();
    const pin = new google.maps.Marker({ map, position: { lat, lng }, icon: { url: '/img/map_selection_pin.svg' }, optimized: false, zIndex: 1000 });
    await settle();
    out.followsPin = around(map) && squaresOn(map).length === 9;
    pin.setMap(null);
    await settle();
    out.clearedWithPin = squaresOn(map).length === 0;
    return out;
  }, PHOTO_LOCATION);
  assert(r.dotIgnored, 'squares moved to the blue location dot');
  assert(r.followsPin, 'squares did not move to the new pin');
  assert(r.clearedWithPin, 'squares stayed after the pin was removed');
  await page.keyboard.press('Escape');
});

await test('Bonus Area Visualiser: no add-on errors', async () => {
  const e = scriptErrors(errors);
  assert(!e.length, 'page errors: ' + e.join('; '));
});

// A small JPEG with GPS EXIF at PHOTO_LOCATION, written by hand (no image tools needed).
function jpegWithGps(jpeg, lat, lng) {
  const tiff = Buffer.alloc(128);
  tiff.write('MM', 0, 'ascii'); tiff.writeUInt16BE(42, 2); tiff.writeUInt32BE(8, 4);
  tiff.writeUInt16BE(1, 8); // IFD0: one entry, a pointer to the GPS IFD at 26
  tiff.writeUInt16BE(0x8825, 10); tiff.writeUInt16BE(4, 12); tiff.writeUInt32BE(1, 14); tiff.writeUInt32BE(26, 18);
  tiff.writeUInt16BE(4, 26); // GPS IFD: 4 entries
  const entry = (i, tag, type, count, value) => {
    const o = 28 + i * 12;
    tiff.writeUInt16BE(tag, o); tiff.writeUInt16BE(type, o + 2); tiff.writeUInt32BE(count, o + 4);
    if (typeof value === 'string') tiff.write(value, o + 8, 'ascii'); else tiff.writeUInt32BE(value, o + 8);
  };
  entry(0, 1, 2, 2, lat >= 0 ? 'N\0' : 'S\0');
  entry(1, 2, 5, 3, 80);
  entry(2, 3, 2, 2, lng >= 0 ? 'E\0' : 'W\0');
  entry(3, 4, 5, 3, 104);
  const dms = (v, off) => {
    v = Math.abs(v);
    const d = Math.floor(v), m = Math.floor((v - d) * 60), s = Math.round(((v - d) * 60 - m) * 60 * 10000);
    [[d, 1], [m, 1], [s, 10000]].forEach(([n, den], k) => { tiff.writeUInt32BE(n, off + k * 8); tiff.writeUInt32BE(den, off + k * 8 + 4); });
  };
  dms(lat, 80); dms(lng, 104);
  const app1 = Buffer.alloc(10);
  app1.writeUInt16BE(0xffe1, 0); app1.writeUInt16BE(2 + 6 + tiff.length, 2); app1.write('Exif\0\0', 4, 'binary');
  return Buffer.concat([jpeg.subarray(0, 2), app1, tiff, jpeg.subarray(2)]);
}

await test('EXIF (retired add-on): Wayfarer itself moves the nomination map to the photo\'s location', async () => {
  const p = await ctx.newPage();
  const errs = collectErrors(p);
  // Record the submit page's map so its centre can be read.
  await p.addInitScript(() => {
    window.__maps = new Set();
    const iv = setInterval(() => {
      const M = window.google?.maps?.Map;
      if (!M || M.prototype.__testWrapped) return;
      for (const k of ['setCenter', 'panTo', 'getCenter']) {
        const o = M.prototype[k];
        M.prototype[k] = function (...a) { window.__maps.add(this); return o.apply(this, a); };
      }
      M.prototype.__testWrapped = true;
      clearInterval(iv);
    }, 20);
  });
  await gotoWithRetry(p, 'https://wayfarer.scopely.com/submit/new');
  await dismissCookies(p);
  const base = Buffer.from(await p.evaluate(() => {
    const c = document.createElement('canvas'); c.width = 640; c.height = 480;
    const x = c.getContext('2d'); x.fillStyle = '#4a8'; x.fillRect(0, 0, 640, 480);
    return c.toDataURL('image/jpeg', 0.9).split(',')[1];
  }), 'base64');
  await p.getByText('Select an image to upload').first().click({ timeout: 30000 });
  // Choosing the photo only previews it; nothing is uploaded until Submit/Save as Draft.
  await p.locator('[role=dialog] input[type=file][data-testid=file-input]').setInputFiles({
    name: 'photo.jpg', mimeType: 'image/jpeg', buffer: jpegWithGps(base, PHOTO_LOCATION.lat, PHOTO_LOCATION.lng),
  });
  const near = () => p.evaluate(({ lat, lng }) => [...window.__maps].some((m) => {
    const c = m.getDiv().isConnected && m.getCenter();
    return c && Math.abs(c.lat() - lat) < 1e-4 && Math.abs(c.lng() - lng) < 1e-4;
  }), PHOTO_LOCATION);
  await p.waitForFunction(({ lat, lng }) => [...window.__maps].some((m) => {
    const c = m.getDiv().isConnected && m.getCenter();
    return c && Math.abs(c.lat() - lat) < 1e-4 && Math.abs(c.lng() - lng) < 1e-4;
  }), PHOTO_LOCATION, { timeout: 15000 }).catch(() => {});
  assert(await near(), 'map did not move to the photo location: Wayfarer may have dropped this, so the EXIF add-on would be needed again');
  // The Location box shows the photo's coordinates too (i.e. the pin moved, not just the view).
  await p.getByText(`(${PHOTO_LOCATION.lat.toFixed(6)}, ${PHOTO_LOCATION.lng.toFixed(6)})`).waitFor({ timeout: 10000 });
  const e = scriptErrors(errs);
  assert(!e.length, 'page errors: ' + e.join('; '));
  await p.close();
});

await test('Nothing was sent to Wayfarer', async () => {
  // Opening Settings and choosing a photo only read from Wayfarer, so the
  // read-only guard should not have had to block anything.
  assert(blocked.length === 0, 'blocked requests: ' + blocked.join(', '));
});

await page.close();
await ctx.close();
site.close();
done();
