// Test: add-ons on Wayfarer's Review page (signed in).
//
// Every live load of /review hands a nomination to the account, so the review
// itself is served from a saved copy (.test-cache/fixtures/review.json,
// gitignored: it holds other people's nomination data). If that file is
// missing, /review is loaded live exactly once to save it. Nothing is ever
// clicked on the review, and launchSignedIn() blocks all writes to Wayfarer.
//
// Skipped automatically if you haven't signed in yet.
import { launchSignedIn, hasSavedLogin, installFromUrl, collectErrors, gotoWithRetry, mutationCounterInit, idleMutationRate } from '../lib/harness.mjs';
import { serveSite } from '../lib/serve.mjs';
import { test, skip, assert, done } from '../lib/run.mjs';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

if (!hasSavedLogin()) {
  skip('review page tests', 'no saved login: run `npm run test:login` and sign in first');
  done();
  process.exit(0);
}

const FIXTURE = resolve('.test-cache/fixtures/review.json');
const REVIEW_API = '/api/v1/vault/review';
const isReviewApi = (u) => u.hostname === 'wayfarer.scopely.com' && u.pathname === REVIEW_API;
const scriptErrors = (errors) => errors.filter((e) => !/Failed to load resource|net::ERR|status of 4\d\d/.test(e));
const dismissCookies = (page) => page.getByRole('button', { name: 'Decline' }).click({ timeout: 3000 }).catch(() => {});

const site = await serveSite(resolve('.'));
const { ctx, blocked } = await launchSignedIn();

// Save one real review the first time (before any add-on is installed).
if (!existsSync(FIXTURE)) {
  console.log('    (no saved review yet: loading /review once to save one)');
  const page = await ctx.newPage();
  const saved = page.waitForResponse((r) => isReviewApi(new URL(r.url())) && r.request().method() === 'GET', { timeout: 45000 });
  await gotoWithRetry(page, 'https://wayfarer.scopely.com/review');
  const body = await (await saved).text();
  mkdirSync(resolve('.test-cache/fixtures'), { recursive: true });
  writeFileSync(FIXTURE, body);
  await page.close();
}

const fixture = JSON.parse(readFileSync(FIXTURE, 'utf8'));
const nomination = fixture.result;
if (!nomination?.lat) {
  skip('review page tests', `saved review has no nomination (captcha or empty queue): delete ${FIXTURE} and try again`);
  await ctx.close(); site.close(); done();
  process.exit(0);
}

await installFromUrl(ctx, site.url + 'wayfarer-abuse-text-formatter.user.js');

// Serve the saved review (or a variant of it) instead of asking Wayfarer for one.
let served = nomination;
let reviewLoads = 0;
await ctx.route((u) => isReviewApi(u), (route) => {
  if (route.request().method() !== 'GET') return route.fallback(); // Falls through to the read-only guard.
  reviewLoads++;
  // Reviews come with a ~20 minute deadline; push it forward so an old saved review
  // doesn't trigger Wayfarer's "review deadline expired" pop-up.
  const result = { ...served, expires: Date.now() + 20 * 60 * 1000 };
  return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ...fixture, result }) });
});

const expectedText = (n) => `"${n.title}" at ${n.lat},${n.lng} [Report]`;
const lines = (page) => page.locator('.wfa-abuse-text');

const page = await ctx.newPage();
const errors = collectErrors(page);
await page.addInitScript(mutationCounterInit);

await test('Review page loads with the saved review', async () => {
  await gotoWithRetry(page, 'https://wayfarer.scopely.com/review');
  await dismissCookies(page);
  assert(new URL(page.url()).pathname === '/review', `redirected to ${page.url()}; sign in again with npm run test:login`);
  await page.locator('#review-page-title').waitFor({ timeout: 30000 });
  assert(reviewLoads === 1, `review was requested ${reviewLoads} times`);
});

await test('Abuse Text Formatter: shows the title and coordinates with a Report link', async () => {
  await lines(page).first().waitFor({ timeout: 15000 });
  assert(await lines(page).count() === 1, `expected 1 line, found ${await lines(page).count()}`);
  const text = (await lines(page).innerText()).trim();
  assert(text === expectedText(nomination), `unexpected text "${text}"`);
  const link = lines(page).locator('a');
  assert(await link.getAttribute('href') === 'https://scopelyexplore.helpshift.com/hc/en/10-wayfarer/faq/1999-reporting-abuse-in-wayfarer/', 'wrong Report link');
  assert(await link.getAttribute('target') === '_blank', 'Report link should open a new tab');
  await page.screenshot({ path: 'test-results/review-abuse-text.png' });
});

await test('Abuse Text Formatter: puts the line back if the page redraws', async () => {
  await page.evaluate(() => document.querySelector('.wfa-abuse-text').remove());
  await lines(page).first().waitFor({ timeout: 5000 });
  assert(await lines(page).count() === 1, 'line not restored exactly once');
});

await test('Review page: stays idle (no mutation loop)', async () => {
  await page.waitForTimeout(2000); // let the page settle after the redraw test
  const rate = await idleMutationRate(page, 5000);
  assert(rate < 5, `${rate} DOM changes/second while idle`);
});

await test('Abuse Text Formatter: follows in-app navigation away and back', async () => {
  await page.locator('header a[href="/mapview"]').click();
  await page.waitForURL('**/mapview');
  await page.waitForTimeout(1500);
  assert(await lines(page).count() === 0, 'line still shown on the map page');
  // A different nomination this time (an edit review), to check the line updates.
  // This is the saved review relabelled as an edit, so the edit layout is not real data.
  served = { ...nomination, type: 'EDIT', title: nomination.title + ' (edit)', titleEdits: [], descriptionEdits: [], locationEdits: [] };
  await page.locator('header a[href="/review"]').click();
  await page.waitForURL('**/review');
  await page.locator('[data-testid="review-edit-flow"]').waitFor({ timeout: 20000 });
  await page.waitForFunction((t) => document.querySelector('.wfa-abuse-text')?.innerText.trim() === t, expectedText(served), { timeout: 10000 });
  assert(await lines(page).count() === 1, `expected 1 line, found ${await lines(page).count()}`);
  assert(reviewLoads === 2, `review was requested ${reviewLoads} times`);
  // Let the edit page's map finish drawing, then check the line is left alone.
  await page.waitForTimeout(3000);
  await page.evaluate(() => { document.querySelector('.wfa-abuse-text').dataset.marked = '1'; });
  const rate = await idleMutationRate(page, 3000);
  assert(rate < 5, `${rate} DOM changes/second while idle`);
  assert(await page.locator('.wfa-abuse-text[data-marked]').count() === 1, 'line was redrawn while the page was idle');
});

await test('Review page: no add-on errors, nothing sent to Wayfarer', async () => {
  const e = scriptErrors(errors);
  assert(!e.length, 'page errors: ' + e.join('; '));
  assert(!blocked.length, 'blocked requests: ' + blocked.join(', '));
});

await ctx.close();
site.close();
done();
