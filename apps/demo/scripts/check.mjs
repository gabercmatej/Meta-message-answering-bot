// Browser check for the built demo: serves dist/ with `vite preview`, drives several scenarios at
// desktop and mobile sizes with a local headless Chromium, fails on console errors, page errors,
// any request that leaves the preview origin, or horizontal page scroll, and saves README
// screenshots to ../../assets/demo/.
//
//   npm run build && npm run check:browser
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { preview } from 'vite';

const here = path.dirname(fileURLToPath(import.meta.url));
// apps/demo/scripts -> repo root is three levels up
const repoRoot = path.resolve(here, '..', '..', '..');
const outDir = path.join(repoRoot, 'assets', 'demo');
await mkdir(outDir, { recursive: true });

const server = await preview({ root: path.resolve(here, '..'), preview: { port: 4173, strictPort: true, host: '127.0.0.1' }, logLevel: 'warn' });
const origin = 'http://127.0.0.1:4173';
const browser = await chromium.launch();
const problems = [];
const requests = new Set();

async function newPage(viewport, colorScheme = 'light') {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: 2, colorScheme, reducedMotion: 'no-preference' });
  const page = await ctx.newPage();
  page.on('console', (m) => m.type() === 'error' && problems.push(`console error (${viewport.width}): ${m.text()}`));
  page.on('pageerror', (e) => problems.push(`page error (${viewport.width}): ${e.message}`));
  page.on('request', (r) => {
    requests.add(r.url());
    if (!r.url().startsWith(origin) && !r.url().startsWith('data:')) problems.push(`external request: ${r.url()}`);
  });
  await page.goto(origin + '/');
  return page;
}

const pipelineDone = (page) => page.locator('.pipeline .panel-head .state-pill').waitFor({ timeout: 30_000 });
const finalState = (page) => page.locator('.pipeline .panel-head .state-pill').innerText();
async function scenario(page, label) {
  await page.getByRole('button', { name: label, exact: true }).click();
  await page.getByRole('button', { name: 'Skip animation' }).click();
  await pipelineDone(page);
  return finalState(page);
}
function expectEq(actual, expected, what) {
  if (actual !== expected) problems.push(`${what}: expected ${expected}, got ${actual}`);
  else console.log(`ok  ${what} → ${actual}`);
}

// Regression: a new run must not inherit the previous run's finished state. After run A completes,
// start run B and sample the page until B's final state appears: no delivered bot reply may be in
// the chat while the pipeline is still running.
async function noEarlyDelivery(page, label, what) {
  await page.getByRole('button', { name: label, exact: true }).click();
  const pill = page.locator('.pipeline .panel-head .state-pill');
  // delivered = a bot bubble in the chat that is not the ghosted pending (scheduled/publishing) one
  const delivered = () => page.locator('.msg.bot:not(.pending)').count();
  let samples = 0;
  let early = 0;
  const t0 = Date.now();
  while (Date.now() - t0 < 30_000) {
    const [running, bots] = await Promise.all([pill.count().then((n) => n === 0), delivered()]);
    if (!running) break;
    samples += 1;
    if (bots > 0) early += 1;
    await page.waitForTimeout(40);
  }
  expectEq(samples >= 5, true, `${what}: observed the run in progress (${samples} samples)`);
  expectEq(early, 0, `${what}: no delivered bot reply while the run is in progress`);
  expectEq(await delivered(), 1, `${what}: exactly one bot reply once the run finished`);
}

// ---------------------------------------------------------------- desktop
const desk = await newPage({ width: 1440, height: 900 });
{
  const box = await desk.locator('.scenarios .sc').first().boundingBox();
  expectEq(!!box && box.y + box.height <= 900, true, 'desktop 1440x900: scenario buttons visible on first load');
}
await desk.locator('.countdown').waitFor({ timeout: 20_000 });
await desk.waitForTimeout(900);
await desk.screenshot({ path: path.join(outDir, 'demo-pipeline.png') });
console.log('saved demo-pipeline.png (countdown in progress)');
await pipelineDone(desk);
expectEq(await finalState(desk), 'sent', 'default scenario (employment termination, IG DM)');
expectEq(await desk.locator('.msg.bot .meta').last().innerText(), 'Sent automatically · delivery confirmed', 'bot reply shown in chat');
await noEarlyDelivery(desk, 'Transient Meta failure', 'desktop second run');

expectEq(await scenario(desk, 'Duplicate webhook'), 'sent', 'duplicate webhook');
expectEq(await desk.locator('.msg.bot').count(), 1, 'duplicate webhook → exactly one bot reply in chat');
expectEq(await scenario(desk, 'Distress → human'), 'needs_review', 'distress');
expectEq(await scenario(desk, 'Off-topic remark'), 'skipped', 'off-topic public remark');
expectEq(await scenario(desk, 'AI provider unavailable'), 'sent', 'AI unavailable → fallback');
expectEq(await scenario(desk, 'Lost write → reconciled'), 'reconciled_sent', 'outcome unknown → reconciled');

// Free text, Slovenian, with conversation context.
await desk.getByRole('radio', { name: 'SL', exact: true }).click();
await desk.getByRole('radio', { name: /FB comment/ }).click();
await desk.getByLabel('Message text').fill('Najemodajalec mi noče vrniti varščine. Kaj lahko naredim?');
await desk.getByRole('button', { name: 'Send', exact: true }).click();
await desk.getByRole('button', { name: 'Skip animation' }).click();
await pipelineDone(desk);
expectEq(await finalState(desk), 'sent', 'free text SL on FB comment');
const slReply = await desk.locator('.msg.bot .bubble').last().innerText();
if (!slReply.includes('zasebno sporočilo')) problems.push('SL comment reply lacks the public privacy sentence');

// Developer view on the retry scenario.
await desk.getByRole('radio', { name: 'EN', exact: true }).click();
await scenario(desk, 'Lost write → resend');
await desk.getByRole('tab', { name: 'Developer view' }).click();
await desk.getByRole('tab', { name: 'dispatch' }).click();
await desk.getByRole('tab', { name: 'Developer view' }).waitFor();
const devText = await desk.locator('.inspector').innerText();
expectEq(devText.includes('reply_item.scheduled'), true, 'developer view lists reply_item.scheduled');
await desk.screenshot({ path: path.join(outDir, 'demo-developer-view.png') });
console.log('saved demo-developer-view.png');

// ---------------------------------------------------------------- dark desktop
const dark = await newPage({ width: 1440, height: 900 }, 'dark');
await pipelineDone(dark);
await dark.screenshot({ path: path.join(outDir, 'demo-dark.png') });
console.log('saved demo-dark.png');

// ---------------------------------------------------------------- mobile
const mob = await newPage({ width: 390, height: 844 });
await pipelineDone(mob);
const overflow = await mob.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
expectEq(overflow <= 0, true, 'mobile 390 px: no horizontal page scroll');
await noEarlyDelivery(mob, 'Duplicate webhook', 'mobile second run');
await mob.getByRole('button', { name: 'Transient Meta failure', exact: true }).click();
await mob.locator('.mprog-text', { hasText: /^Stage \d+\/12/ }).waitFor({ timeout: 10_000 });
await mob.evaluate(() => window.scrollTo(0, 360));
await mob.waitForTimeout(1400);
const prog = await mob.locator('.mprog').boundingBox();
expectEq(!!prog && prog.y >= 0 && prog.y < 8, true, 'mobile: sticky progress indicator pinned at top while the run is in progress');
await mob.screenshot({ path: path.join(outDir, 'demo-mobile.png') });
await mob.getByRole('button', { name: 'Skip animation' }).click();
await pipelineDone(mob);
expectEq(await finalState(mob), 'sent', 'mobile: transient Meta failure → retry');
expectEq(await mob.locator('.mprog-text').innerText(), 'Run complete · sent', 'mobile: progress indicator reports completion');
console.log('saved demo-mobile.png');
const small = await newPage({ width: 375, height: 812 });
await pipelineDone(small);
expectEq((await small.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)) <= 0, true, 'mobile 375 px: no horizontal page scroll');

await browser.close();
await new Promise((resolve) => server.httpServer.close(resolve));

console.log(`\nrequests: ${requests.size} distinct, all same-origin: ${[...requests].every((u) => u.startsWith(origin) || u.startsWith('data:'))}`);
for (const u of [...requests].sort()) console.log(`  ${u.replace(origin, '')}`);
if (problems.length) {
  console.error(`\n${problems.length} problem(s):\n- ${problems.join('\n- ')}`);
  process.exit(1);
}
console.log('\nbrowser check passed');
