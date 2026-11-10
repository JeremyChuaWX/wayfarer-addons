// Test: Wayfarer Broken Image Scanner on the rebuilt (React) Wayfarer site.
//
// Uses the saved login (see `npm run test:login`) on a throwaway profile, with
// every non-GET Wayfarer API request blocked. Only opens /submit and /mapview;
// never clicks New Submission or anything that changes the account.
//
// The scan itself runs against a made-up submissions list (one photo that
// loads, one that doesn't), served in place of /api/v1/vault/manage, so the
// result doesn't depend on what's on the real account.
import { resolve } from 'node:path';
import { launchSignedIn, hasSavedLogin, installFromUrl, collectErrors, gotoWithRetry, mutationCounterInit, idleMutationRate } from '../lib/harness.mjs';
import { serveSite } from '../lib/serve.mjs';
import { test, skip, assert, done } from '../lib/run.mjs';

if (!hasSavedLogin()) {
  skip('Broken Image Scanner', 'no saved login: run `npm run test:login` and sign in first');
  done();
  process.exit(0);
}

const SUBMIT = 'https://wayfarer.scopely.com/submit';
const site = await serveSite(resolve('.'));
const { ctx, blocked } = await launchSignedIn();
await installFromUrl(ctx, site.url + 'wayfarer-broken-image-scanner.user.js');

const dismissCookies = (page) => page.getByRole('button', { name: 'Decline' }).click({ timeout: 3000 }).catch(() => {});
const scriptErrors = (errors) => errors.filter((e) => !/Failed to load resource|net::ERR|status of 4\d\d/.test(e));
const button = (page) => page.locator('#wfbi-scan-button');

await test('Broken Image Scanner: button appears on the Submit page', async () => {
  const page = await ctx.newPage();
  const errors = collectErrors(page);
  await page.addInitScript(mutationCounterInit);
  await gotoWithRetry(page, SUBMIT);
  await dismissCookies(page);
  assert(new URL(page.url()).pathname === '/submit', `redirected to ${page.url()}; sign in again with npm run test:login`);
  await button(page).waitFor({ state: 'visible', timeout: 30000 });
  assert(await button(page).count() === 1, 'expected exactly one scan button');
  await page.screenshot({ path: 'test-results/broken-image-scanner-button.png' });

  // Let the page finish loading before checking that it sits still.
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.waitForTimeout(2000);
  const rate = await idleMutationRate(page, 4000);
  assert(rate < 5, `page keeps changing while idle: ${rate} mutations/s`);

  // Client-side navigation away and back: the button comes back, once.
  await page.locator('header a[href="/mapview"]').click();
  await page.waitForURL(/\/mapview/);
  // React keeps the old page up for a moment while the map loads.
  await button(page).waitFor({ state: 'detached', timeout: 15000 })
    .catch(() => { throw new Error('button still shown on the map page'); });
  await page.locator('header a[href="/submit"]').click();
  await page.waitForURL(/\/submit$/);
  await button(page).waitFor({ state: 'visible', timeout: 20000 });
  await page.waitForTimeout(1000);
  assert(await button(page).count() === 1, 'expected exactly one scan button after navigating back');

  const e = scriptErrors(errors);
  assert(!e.length, 'page errors: ' + e.join('; '));
  await page.close();
});

await test('Broken Image Scanner: report lists only the broken photo', async () => {
  const page = await ctx.newPage();
  const errors = collectErrors(page);
  await page.addInitScript(mutationCounterInit);

  const sub = (id, title, image, status) => ({
    id, type: 'NOMINATION', title, description: '', lat: 1.5, lng: 103.5, city: '', state: '', day: '2026-01-02',
    order: 0, imageUrl: image, upgraded: false, status, isMutable: false, isNianticControlled: false, statement: '',
    supportingImageUrls: [], rejectReasons: [], canAppeal: false, canUpgrade: false, appealResolved: false,
    isClosed: false, appealNotes: '', userAppealNotes: '', canHold: false, canReleaseHold: false, poiData: [],
  });
  const manage = {
    result: {
      submissions: [
        sub('wfbi-test-1', 'WFBI Working Photo', 'https://lh3.googleusercontent.com/wfbi-test-ok', 'ACCEPTED'),
        sub('wfbi-test-2', 'WFBI Broken Photo', 'https://lh3.googleusercontent.com/wfbi-test-broken', 'NOMINATED'),
      ],
      canAppeal: false,
    },
    message: null, code: 'OK', errorsWithIcon: null, fieldErrors: null, errorDetails: null, version: 'test', captcha: false,
  };
  let manageRequests = 0;
  await page.route('https://wayfarer.scopely.com/api/v1/vault/manage', (route) => {
    manageRequests++;
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(manage) });
  });
  // A 1x1 PNG for the working photo; the broken one gets a 404.
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');
  await page.route(/^https:\/\/lh3\.googleusercontent\.com\/wfbi-test-/, (route) =>
    route.request().url().includes('wfbi-test-ok')
      ? route.fulfill({ status: 200, contentType: 'image/png', body: png })
      : route.fulfill({ status: 404, body: 'not found' }));

  await gotoWithRetry(page, SUBMIT);
  await dismissCookies(page);
  await button(page).waitFor({ state: 'visible', timeout: 30000 });
  await page.waitForLoadState('networkidle').catch(() => {});
  assert(manageRequests >= 1, 'the page never asked for the submissions list');
  const before = manageRequests;

  await button(page).click();
  const status = page.locator('#wfbi-modal-status');
  await status.filter({ hasText: 'Scan complete' }).waitFor({ timeout: 60000 });
  assert(manageRequests === before, 'scan fetched the list again; the fetch hook did not catch the page\'s own request');

  const report = await page.locator('#wfbi-modal-report').inputValue();
  assert(/2 nominations and 0 photo edits analysed/.test(report), `unexpected report header:\n${report}`);
  assert(/Identified total of 1 broken images/.test(report), `expected 1 broken image:\n${report}`);
  assert(report.includes('"WFBI Broken Photo" (1.500000,103.500000)'), `broken photo missing from report:\n${report}`);
  assert(!report.includes('WFBI Working Photo'), `working photo wrongly listed:\n${report}`);
  await page.screenshot({ path: 'test-results/broken-image-scanner-report.png' });

  await page.locator('.wfbi-modal-footer button', { hasText: 'Close' }).click();
  assert(!(await page.locator('#wfbi-modal-backdrop').isVisible()), 'report window did not close');
  const rate = await idleMutationRate(page, 4000);
  assert(rate < 5, `page keeps changing while idle: ${rate} mutations/s`);

  const e = scriptErrors(errors);
  assert(!e.length, 'page errors: ' + e.join('; '));
  await page.close();
});

await test('Broken Image Scanner: nothing was sent to Wayfarer', async () => {
  assert(blocked.length === 0, 'blocked requests: ' + blocked.join(', '));
});

await ctx.close();
site.close();
done();
