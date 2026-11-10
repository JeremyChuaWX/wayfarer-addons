// Tiny test runner: test(name, fn), skip(name, reason). Exit code 1 on failure.
const results = [];
export async function test(name, fn) {
  const t = Date.now();
  try { await fn(); results.push(['PASS', name]); console.log(`  ✓ ${name} (${((Date.now() - t) / 1000).toFixed(1)}s)`); }
  catch (e) { results.push(['FAIL', name]); console.log(`  ✗ ${name}\n      ${String(e.message ?? e).split('\n').join('\n      ')}`); }
}
export function skip(name, reason) { results.push(['SKIP', name]); console.log(`  - ${name} (skipped: ${reason})`); }
export function assert(cond, msg) { if (!cond) throw new Error(msg); }
export function done() {
  const c = (s) => results.filter((r) => r[0] === s).length;
  console.log(`\n${c('PASS')} passed, ${c('FAIL')} failed, ${c('SKIP')} skipped`);
  process.exitCode = c('FAIL') ? 1 : 0;
}
