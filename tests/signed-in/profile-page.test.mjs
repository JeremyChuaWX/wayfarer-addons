// Test: add-ons on the signed-in Wayfarer Profile page.
//
// Uses the login saved by `npm run test:login` (.test-cache/profile). Each run
// works on a throwaway copy of that profile, and every request that could
// change something on Wayfarer is blocked. Tests only load pages and navigate.
//
// Skipped automatically if you haven't signed in yet.
import { launchSignedIn, hasSavedLogin, installFromUrl, collectErrors, gotoWithRetry, mutationCounterInit, idleMutationRate } from '../lib/harness.mjs';
import { serveSite } from '../lib/serve.mjs';
import { resolve } from 'node:path';
import { test, skip, assert, done } from '../lib/run.mjs';

if (!hasSavedLogin()) {
  skip('profile page tests', 'no saved login: run `npm run test:login` and sign in first');
  done();
  process.exit(0);
}

// Serve the repo root so the working copy of the script is installed.
const site = await serveSite(resolve('.'));
const { ctx, blocked } = await launchSignedIn();

await installFromUrl(ctx, site.url + 'wayfarer-old-rating-ui.user.js');

const dismissCookies = (page) => page.getByRole('button', { name: 'Decline' }).click({ timeout: 3000 }).catch(() => {});
const scriptErrors = (errors) => errors.filter((e) => !/Failed to load resource|net::ERR|status of 4\d\d/.test(e));

const page = await ctx.newPage();
const errors = collectErrors(page);
await page.addInitScript(mutationCounterInit);

// What Wayfarer itself reports, to compare with what the add-on shows.
const profileRequests = [];
let apiRating = null;
page.on('response', async (r) => {
  if (new URL(r.url()).pathname !== '/api/v1/vault/profile' || r.request().method() !== 'GET') return;
  profileRequests.push(r.url());
  apiRating = await r.json().then((d) => d?.result?.performance ?? null, () => null);
});

const tierCard = page.locator('section[aria-labelledby="wayfinder-tier-heading"]');
const bar = tierCard.locator('[data-old-wayfinder-rating="true"]');

await test('Old Rating UI: shows the rating bar in the Wayfinder Tier card', async () => {
  await gotoWithRetry(page, 'https://wayfarer.scopely.com/profile');
  await dismissCookies(page);
  assert(new URL(page.url()).pathname === '/profile', `redirected to ${page.url()}; sign in again with npm run test:login`);
  await bar.waitFor({ timeout: 30000 });
  const labels = await bar.locator('.wf-old-rating-segment').allInnerTexts();
  assert(labels.length === 4, `expected 4 segments, got ${labels.length}: ${labels.join(', ')}`);
  assert(apiRating, 'Wayfarer\'s profile response no longer includes the rating');
  const active = await bar.locator('.wf-old-rating-segment.is-active').getAttribute('data-rating-key');
  assert(active === String(apiRating).toLowerCase(), `highlighted "${active}" but Wayfarer says "${apiRating}"`);
  await page.screenshot({ path: 'test-results/old-rating-ui.png' });
});

await test('Old Rating UI: reads Wayfarer\'s own request (no extra fetch)', async () => {
  // If the fetch hook missed the page's request, the add-on asks again after 1.5s.
  await page.waitForTimeout(2500);
  assert(profileRequests.length === 1, `expected 1 profile request, saw ${profileRequests.length}`);
});

await test('Old Rating UI: hovering the highlighted part shows its message', async () => {
  const active = bar.locator('.wf-old-rating-segment.is-active');
  await active.scrollIntoViewIfNeeded();
  await active.hover();
  const tip = active.locator('.wf-old-rating-tooltip');
  await page.waitForFunction((el) => getComputedStyle(el).opacity === '1', await tip.elementHandle(), { timeout: 3000 });
  assert((await tip.innerText()).trim().length > 0, 'tooltip is empty');
  await page.mouse.move(0, 0);
});

await test('Old Rating UI: page stays idle', async () => {
  const rate = await idleMutationRate(page, 5000);
  assert(rate < 5, `${rate} DOM changes per second while idle`);
});

await test('Old Rating UI: survives navigating away and back in the app', async () => {
  await page.getByRole('link', { name: 'Map', exact: true }).first().click();
  await page.waitForURL('**/mapview', { timeout: 15000 });
  await page.waitForTimeout(2000);
  assert(await page.locator('[data-old-wayfinder-rating]').count() === 0, 'rating bar left on the map page');
  await page.goBack();
  await page.waitForURL('**/profile', { timeout: 15000 });
  await bar.waitFor({ timeout: 15000 });
  await page.waitForTimeout(1000);
  assert(await page.locator('[data-old-wayfinder-rating]').count() === 1, 'expected exactly one rating bar');
});

await test('Old Rating UI: no script errors, nothing sent to Wayfarer', async () => {
  const e = scriptErrors(errors);
  assert(!e.length, 'page errors: ' + e.join('; '));
  assert(!blocked.length, 'blocked requests: ' + blocked.join(', '));
});

await ctx.close();
site.close();
done();
