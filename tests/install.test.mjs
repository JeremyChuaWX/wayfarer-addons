// Test: a user can install every add-on from the install site with Tampermonkey.
// Follows the documented steps: Allow user scripts → click Install → confirm.
// SITE_URL=https://jeremychuawx.github.io/wayfarer-addons/ tests the live site;
// by default the local build in _site/ is served and tested.
import { launch, allowUserScripts, closeWhenInstalled } from './lib/harness.mjs';
import { serveSite } from './lib/serve.mjs';
import { test, assert, done } from './lib/run.mjs';

const local = process.env.SITE_URL ? null : await serveSite();
const site = process.env.SITE_URL ?? local.url;
console.log(`Install test against ${site}`);
const { ctx, id } = await launch();

await test('"Allow user scripts" switch exists and can be turned on', () => allowUserScripts(ctx, id));

const page = await ctx.newPage();
await page.goto(site);
const cards = await page.locator('.card').evaluateAll((cs) => cs.map((c) => ({
  name: c.querySelector('h4').textContent, version: c.querySelector('.ver').textContent.replace(/^v/, ''),
  href: c.querySelector('a.install').getAttribute('href'), guide: c.querySelector('a.ghost')?.getAttribute('href'),
})));
await test('install page lists add-ons', () => assert(cards.length >= 10, `only ${cards.length} cards`));

for (const card of cards) {
  await test(`install ${card.name}`, async () => {
    const tabP = ctx.waitForEvent('page', { predicate: (p) => p.url().startsWith('chrome-extension://'), timeout: 20000 });
    await page.locator('.card', { hasText: card.name }).locator('a.install').click();
    const tab = await tabP;
    const btn = tab.getByRole('button', { name: /^Install$/ });
    await btn.waitFor({ timeout: 20000 });
    const text = await tab.locator('body').innerText();
    assert(text.includes(card.name), 'Tampermonkey prompt does not show the add-on name');
    assert(text.includes('v' + card.version), `prompt does not show version v${card.version}`);
    assert(text.includes('https://jeremychuawx.github.io/wayfarer-addons/' + card.href.replace('./', '')),
      'update source is not the GitHub Pages site');
    await btn.click();
    await closeWhenInstalled(tab);
    if (card.guide) {
      const r = await ctx.request.get(new URL(card.guide, site).href);
      assert(r.ok(), `guide ${card.guide} returned ${r.status()}`);
    }
  });
}

await test('Tampermonkey dashboard lists every installed add-on', async () => {
  const dash = await ctx.newPage();
  await dash.goto(`chrome-extension://${id}/options.html#nav=dashboard`);
  await dash.waitForTimeout(2000);
  const body = await dash.locator('body').innerText();
  const missing = cards.filter((c) => !body.includes(c.name)).map((c) => c.name);
  assert(!missing.length, `missing from dashboard: ${missing.join(', ')}`);
});

await ctx.close();
local?.close();
done();
