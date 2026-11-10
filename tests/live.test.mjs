// Test: add-ons work on the real websites.
// Only the Wayfarer Community forum is public; the rest is in signed-in.test.mjs.
import { launch, allowUserScripts, installFromUrl, collectErrors, mutationCounterInit, idleMutationRate, gotoWithRetry } from './lib/harness.mjs';
import { serveSite } from './lib/serve.mjs';
import { test, assert, done } from './lib/run.mjs';

const site = await serveSite();
const { ctx, id } = await launch();
await allowUserScripts(ctx, id);

await test('Community Header: runs on the forum and stays idle', async () => {
  await installFromUrl(ctx, site.url + 'wayfarer-community-header.user.js');
  const page = await ctx.newPage();
  const errors = collectErrors(page);
  await page.addInitScript(mutationCounterInit);
  // Old address on purpose: checks the redirect lands where the script now matches.
  await gotoWithRetry(page, 'https://community.wayfarer.nianticlabs.com/');
  assert(page.url().startsWith('https://community.wayfarer.scopely.com/'), `unexpected forum URL ${page.url()}`);
  await page.locator('.wayfarer-flags-applied').waitFor({ timeout: 15000 });
  const flags = await page.locator('.wayfarer-flags-applied a').evaluateAll((as) => as.map((a) => a.href));
  assert(flags.some((h) => h.includes('/c/japan/')), 'Japanese community flag link missing');
  await page.waitForTimeout(3000);
  const rate = await idleMutationRate(page);
  // Before the fix this was ~60/s (re-running every animation frame).
  assert(rate < 5, `page keeps changing while idle: ${rate.toFixed(1)} mutations/s`);
  const scriptErrors = errors.filter((e) => !e.includes('Failed to load resource'));
  assert(!scriptErrors.length, 'page errors: ' + scriptErrors.join('; '));
  await page.screenshot({ path: 'test-results/forum.png' });
});

// Wayfarer and the Pokémon GO map need sign-in: see signed-in.test.mjs.

await ctx.close();
site.close();
done();
