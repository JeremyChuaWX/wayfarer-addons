// Opens the sandboxed test browser so you can sign in yourself.
// Logins are saved in .test-cache/profile (never committed) and reused by the
// signed-in tests. Close the browser window when you're done.
import { launch, allowUserScripts, PROFILE } from './lib/harness.mjs';

const { ctx, id } = await launch({ headless: false, profile: PROFILE, viewport: null });
await allowUserScripts(ctx, id);
const sites = [
  'https://wayfarer.scopely.com/',
  'https://pokemongo.com/en/map',
  'https://missions.ingress.com/',
];
const [first, ...rest] = ctx.pages().filter((p) => p.url() === 'about:blank');
for (const [i, url] of sites.entries()) {
  const page = i === 0 && first ? first : await ctx.newPage();
  page.goto(url).catch(() => {});
}
for (const p of rest) await p.close().catch(() => {});
console.log('Browser open. Sign in on each tab, then close the browser window.');
await new Promise((r) => ctx.on('close', r));
console.log('Browser closed; sign-in saved to .test-cache/profile');
