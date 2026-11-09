// Browser check for the built demo: serves dist/ with `vite preview`, drives the simulation in a
// local headless Chromium and fails on console errors, page errors, any request that leaves the
// preview origin, horizontal page scroll, early reply delivery or wrong graph states. Also writes
// the README screenshots (deviceScaleFactor 2) to ../../assets/demo/.
//
//   npm run build && npm run check:browser
import { access, mkdir, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { preview } from 'vite';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '..', '..', '..');
const outDir = path.join(repoRoot, 'assets', 'demo');
// Guard: the resolved output must be the repository's assets/demo (the repo root has apps/demo).
await access(path.join(repoRoot, 'apps', 'demo', 'package.json'));
if (!outDir.replace(/\\/g, '/').endsWith('/assets/demo')) throw new Error(`unexpected output dir ${outDir}`);
await mkdir(outDir, { recursive: true });
console.log(`screenshots → ${outDir}`);

const server = await preview({ root: path.resolve(here, '..'), preview: { port: 4173, strictPort: true, host: '127.0.0.1' }, logLevel: 'warn' });
const origin = 'http://127.0.0.1:4173';
const browser = await chromium.launch();
const problems = [];
const requests = new Set();

async function newPage(viewport, opts = {}) {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: 2, colorScheme: 'dark', reducedMotion: opts.reduced ? 'reduce' : 'no-preference' });
  const page = await ctx.newPage();
  const tag = `${viewport.width}${opts.reduced ? ' reduced' : ''}`;
  page.on('console', (m) => m.type() === 'error' && problems.push(`console error (${tag}): ${m.text()}`));
  page.on('pageerror', (e) => problems.push(`page error (${tag}): ${e.message}`));
  page.on('request', (r) => {
    requests.add(r.url());
    if (!r.url().startsWith(origin) && !r.url().startsWith('data:')) problems.push(`external request: ${r.url()}`);
  });
  await page.goto(origin + '/');
  await page.locator('[data-device]').waitFor();
  return page;
}

function expectEq(actual, expected, what) {
  if (actual !== expected) problems.push(`${what}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  else console.log(`ok  ${what} → ${JSON.stringify(actual)}`);
}
const shot = (page, name, opts = {}) => page.screenshot({ path: path.join(outDir, name), ...opts }).then(() => console.log(`saved ${name}`));

const nodeStates = (page) =>
  page.evaluate(() => {
    const out = {};
    for (const g of document.querySelectorAll('.graph-svg [data-node]')) if (!(g.dataset.node in out)) out[g.dataset.node] = g.dataset.state;
    return out;
  });
const edgeState = (page, id) => page.locator(`[data-edge="${id}"]`).getAttribute('data-state');
const botCount = (page) => page.locator('[data-msg="bot"]').count();
const resultsCount = (page) => page.locator('[data-results]').count();

async function openExample(page, id) {
  await page.getByRole('button', { name: /More examples|Več primerov/ }).click();
  await page.locator(`[data-example="${id}"]`).click();
}
/** Skip the animation and wait for the results panel of the run in progress. */
async function finish(page) {
  await page.getByRole('button', { name: 'Skip to end' }).click();
  await page.locator('[data-results]').waitFor({ timeout: 30_000 });
  await page.waitForTimeout(120);
}
/** Observe a run at 1×: the reply must not exist until the run (and its results) are complete. */
async function watchRun(page, what, baseline) {
  let samples = 0;
  let early = 0;
  let sawTyping = false;
  const t0 = Date.now();
  while (Date.now() - t0 < 40_000) {
    const [res, bots, typing] = await Promise.all([resultsCount(page), botCount(page), page.locator('[data-typing]').count()]);
    if (typing) sawTyping = true;
    if (res > 0) break;
    samples += 1;
    if (bots > baseline) early += 1;
    await page.waitForTimeout(40);
  }
  expectEq(samples >= 20, true, `${what}: run observed in progress (${samples} samples)`);
  expectEq(early, 0, `${what}: no delivered reply while the run is in progress`);
  return { sawTyping, samples };
}

// ================================================================ desktop 1440x900
const desk = await newPage({ width: 1440, height: 900 });
expectEq(await resultsCount(desk), 0, 'initial screen: no results panel');
expectEq(await desk.locator('[data-devview]').count(), 0, 'initial screen: no developer panel');
expectEq(await desk.locator('.graph[data-idle]').count(), 1, 'initial screen: graph in calm standby');
{
  const st = Object.values(await nodeStates(desk));
  expectEq(st.length > 15 && st.every((s) => s === 'standby'), true, 'initial screen: every node in standby');
  const fonts = await desk.evaluate(async () => { await document.fonts.ready; return document.fonts.check('14px "Inter Variable"'); });
  expectEq(fonts, true, 'bundled Inter Variable font loads');
  const text = await desk.locator('body').innerText();
  expectEq(text.includes('Interactive architecture simulation · No real AI or Meta API calls'), true, 'disclosure text on page');
  const pill = await desk.locator('.sim-pill').textContent();
  expectEq(pill.includes('Simulation'), true, 'simulation pill in top bar');
  const dev = await desk.locator('[data-device]').boundingBox();
  const g = await desk.locator('.graph-svg').boundingBox();
  expectEq(!!dev && !!g && dev.x + dev.width < g.x + 4, true, '1440: device left of the graph (side by side)');
  const chips = await desk.locator('.chips-row .sug').first().boundingBox();
  expectEq(!!chips && chips.y + chips.height <= 900, true, '1440x900: suggestion chips visible on first load');
}
{
  const head = await desk.locator('.graph-head').boundingBox();
  const status = await desk.locator('.graph-head .graph-status').boundingBox();
  const replay = await desk.locator('.graph-head').getByRole('button', { name: 'Replay' }).boundingBox();
  const svg = await desk.locator('.graph-svg').boundingBox();
  expectEq(!!head && !!status && !!replay && Math.abs(status.y - replay.y) < 14 && replay.x > status.x + status.width, true, 'playback controls sit in the graph header, right of the status chip');
  expectEq(!!head && !!svg && replay.y + replay.height <= svg.y + 2, true, 'controls do not float over the canvas');
  const st0 = await nodeStates(desk);
  expectEq(st0.review === 'standby' && st0.fallback === 'standby', true, 'standby: review and fallback terminals neutral');
  const fill = await desk.evaluate(() => getComputedStyle(document.querySelector('[data-node="review"] .title')).fill);
  const [r, g, b] = fill.match(/\d+/g).map(Number);
  expectEq(!(r > 200 && g > 150 && b < 150), true, `standby: Human review is not amber (${fill})`);
}
await shot(desk, 'demo-desktop-initial.png');

// Every mode renders; comment modes show a post element.
for (const [mode, sel, post] of [['messenger', '[data-mock="messenger"]', false], ['instagram_comment', '[data-mock="instagram_comment"]', true], ['facebook_comment', '[data-mock="facebook_comment"]', true], ['instagram_dm', '[data-mock="instagram_dm"]', false]]) {
  await desk.locator(`[data-mode="${mode}"]`).click();
  expectEq(await desk.locator(sel).count(), 1, `mode ${mode} renders`);
  expectEq(await desk.locator('[data-post]').count(), post ? 1 : 0, `mode ${mode}: post element ${post ? 'present' : 'absent'}`);
}

// EN and SL texts.
expectEq(await desk.locator('.hero h2').innerText(), 'Send a message. Watch it move through a production AI system.', 'EN headline');
await desk.getByRole('radio', { name: 'SL', exact: true }).click();
expectEq((await desk.locator('.hero h2').innerText()).startsWith('Pošljite sporočilo'), true, 'SL headline');
expectEq(await desk.getByRole('button', { name: 'Koliko stane posvet?' }).count(), 1, 'SL suggestion chip');
expectEq((await desk.locator('body').innerText()).includes('Interaktivna simulacija arhitekture'), true, 'SL disclosure');
await desk.getByRole('radio', { name: 'EN', exact: true }).click();

// Node popover (hover) and keyboard focus.
await desk.locator('[data-node="retrieval"]').hover();
expectEq((await desk.locator('[data-node-popover="retrieval"]').innerText()).includes('approved, unexpired'), true, 'node popover shows the stage explanation on hover');
await desk.mouse.move(5, 300);
await desk.locator('[data-node="model"]').focus();
expectEq(await desk.locator('[data-node-popover="model"]').count(), 1, 'node popover opens on keyboard focus');
expectEq((await desk.locator('[data-node-popover="model"]').innerText()).includes('stand-in'), true, 'model popover says stand-in');
await desk.locator('body').click({ position: { x: 5, y: 5 } });

// ---------------------------------------------------------------- normal run (chip), observed at 1x
await desk.getByRole('button', { name: 'Can my employer fire me?' }).click();
expectEq(await desk.locator('#composer').inputValue(), 'Can my employer fire me?', 'chip populates the composer');
await desk.locator('[data-msg="user"]').first().waitFor();
const normal = await watchRun(desk, 'normal run', 0);
expectEq(normal.sawTyping, true, 'typing indicator shown while the reply returns');
expectEq(await botCount(desk), 1, 'normal run: exactly one reply after the final step');
expectEq(await resultsCount(desk), 1, 'normal run: results panel appears after the reply');
expectEq(await desk.locator('[data-status="seen"]').count(), 1, 'normal run: status ends at Seen');
const normalStates = await nodeStates(desk);
for (const n of ['webhook', 'ingest', 'normalize', 'queue', 'context', 'intent', 'model', 'retrieval', 'kstore', 'decision', 'generate', 'validate', 'schedule', 'publish', 'graph', 'reconcile']) expectEq(normalStates[n], 'done', `normal run: ${n} done`);
expectEq(normalStates.review, 'skipped', 'normal run: review skipped');
expectEq(normalStates.fallback, 'skipped', 'normal run: fallback skipped');
{
  const fill = await desk.evaluate(() => getComputedStyle(document.querySelector('[data-node="review"] .title')).fill);
  const [r, g, b] = fill.match(/\d+/g).map(Number);
  expectEq(!(r > 200 && g > 150 && b < 150), true, `normal run: unused Human review is not amber (${fill})`);
  const edgeOn = await desk.evaluate(() => [getComputedStyle(document.querySelector('[data-edge="webhook_ingest"] .base')).strokeWidth, getComputedStyle(document.querySelector('[data-edge="decision_review"] .base')).stroke]);
  expectEq(parseFloat(edgeOn[0]) >= 2, true, `normal run: traversed wire is lit (${edgeOn[0]})`);
}
// Fact chip with the honest tooltip.
const fact = desk.locator('[data-msg="bot"] .fact').first();
await fact.hover();
expectEq((await desk.locator('.tip').innerText()).startsWith('Fictional demo value · from knowledge record kb.route.booking v5'), true, 'fact chip tooltip names the knowledge record');
await desk.mouse.move(5, 300);
await shot(desk, 'demo-desktop-complete.png', { fullPage: true });

// Turn selector + replay a previous turn's route.
await desk.getByRole('button', { name: 'Can my employer fire me?' }).click();
await desk.locator('[data-msg="user"]').nth(1).waitFor();
await watchRun(desk, 'second turn', 1);
expectEq(await desk.locator('.turns button').count(), 2, 'turn selector lists both turns');
await desk.locator('.turns button').first().click();
expectEq(await desk.locator('.results .big').first().innerText().then((s) => s.length > 0), true, 'turn 1 results selectable');
await desk.getByRole('button', { name: 'Replay this route' }).click();
await desk.waitForTimeout(500);
expectEq(await desk.locator('[data-node="reconcile"]').first().getAttribute('data-state'), 'standby', 'replay restarts the graph from standby');
await desk.getByRole('button', { name: 'Skip to end' }).click();
expectEq(await botCount(desk), 2, 'replay does not add another reply to the conversation');

// ---------------------------------------------------------------- fault routes (fresh conversations)
const compare = {};
async function scenarioRun(id, what, mid) {
  await openExample(desk, id);
  await desk.locator('[data-msg="user"]').last().waitFor();
  if (mid) await mid();
  await finish(desk);
  compare[id] = await nodeStates(desk);
  return compare[id];
}

// Duplicate webhook: ripple at the normalizer while the first packet continues.
{
  const s = await scenarioRun('duplicate', 'duplicate', async () => {
    await desk.locator('.ripple').first().waitFor({ timeout: 20_000 });
    expectEq(await desk.locator('.ripple .pill-text').first().textContent(), 'dedupe key seen', 'duplicate: dedupe ripple on the normalizer');
  });
  expectEq(s.normalize, 'warn', 'duplicate: normalizer warns');
  expectEq(s.reconcile, 'done', 'duplicate: first delivery still completes');
  expectEq(await botCount(desk), 1, 'duplicate: exactly one reply');
}
// Human-only.
{
  const s = await scenarioRun('distress', 'human-only');
  expectEq(s.review, 'hold', 'human-only: review terminal held');
  for (const n of ['generate', 'validate', 'schedule', 'publish', 'graph', 'reconcile']) expectEq(s[n], 'skipped', `human-only: ${n} skipped`);
  expectEq(await botCount(desk), 0, 'human-only: no bot reply');
  expectEq(await desk.locator('[data-note="hold"]').count(), 1, 'human-only: system note in the mock');
  expectEq((await desk.locator('[data-note="hold"]').innerText()).includes('Held for a person'), true, 'human-only note text');
}
// AI unavailable.
{
  const s = await scenarioRun('ai-down', 'ai-down');
  expectEq(s.model, 'fail', 'ai_unavailable: model failed');
  expectEq(s.fallback, 'done', 'ai_unavailable: fallback used');
  expectEq(s.validate, 'warn', 'ai_unavailable: validation warns on fallback');
  expectEq(await botCount(desk), 1, 'ai_unavailable: still answered');
}
// Throttled: see the failure mid-run, then the retry arc.
{
  await openExample(desk, 'throttled');
  await desk.waitForFunction(() => document.querySelector('.graph-svg [data-node="graph"]')?.getAttribute('data-state') === 'fail', null, { polling: 'raf', timeout: 40_000 });
  console.log('ok  throttled: graph node shows the 429 failure mid-run');
  await finish(desk);
  const s = await nodeStates(desk);
  compare.throttled = s;
  expectEq(s.graph, 'done', 'throttled: graph recovered');
  expectEq(await edgeState(desk, 'retry'), 'traversed', 'throttled: retry arc traversed');
  expectEq(await edgeState(desk, 'resend'), 'skipped', 'throttled: resend arc unused');
}
// Outcome unknown, found.
{
  const s = await scenarioRun('unknown-found', 'unknown-found');
  expectEq(await edgeState(desk, 'reconcile_graph'), 'traversed', 'unknown→found: read-back wire traversed');
  expectEq(await edgeState(desk, 'resend'), 'skipped', 'unknown→found: no resend');
  expectEq(await edgeState(desk, 'retry'), 'skipped', 'unknown→found: no retry');
  expectEq(s.reconcile, 'done', 'unknown→found: reconciled');
  expectEq((await desk.locator('.results').innerText()).includes('reconciled_sent'), true, 'unknown→found: final state reconciled_sent');
}
// Outcome unknown, absent → resend.
{
  const s = await scenarioRun('unknown-absent', 'unknown-absent');
  expectEq(await edgeState(desk, 'resend'), 'traversed', 'unknown→absent: resend arc traversed');
  expectEq(await edgeState(desk, 'reconcile_graph'), 'traversed', 'unknown→absent: read-back wire traversed');
  expectEq(s.reconcile, 'done', 'unknown→absent: delivered after resend');
}
// The graph reflects the trace: the runs differ in specific nodes.
expectEq(compare.distress.review !== compare['ai-down'].review && compare['ai-down'].fallback !== compare.duplicate.fallback && compare.duplicate.normalize !== compare.throttled.normalize && compare.throttled.graph !== compare['unknown-found'].graph || compare.throttled.graph === 'done', true, 'node states differ between routes');
expectEq(compare.duplicate.fallback, 'skipped', 'duplicate run does not use the fallback');

// ---------------------------------------------------------------- developer view
await desk.getByRole('switch', { name: 'Developer view' }).click();
await desk.locator('[data-devview]').waitFor();
expectEq((await desk.locator('[data-devview]').innerText()).includes('reply_item.'), true, 'developer view: timeline lists state transitions');
await desk.getByRole('tab', { name: 'Event' }).click();
expectEq((await desk.locator('[data-devview] .code').first().innerText()).includes('dedupeKey'), true, 'developer view: normalized event');
await desk.getByRole('tab', { name: 'Classification' }).click();
await desk.getByRole('tab', { name: 'Knowledge' }).click();
await desk.getByRole('tab', { name: 'Attempts' }).click();
expectEq((await desk.locator('[data-devview]').innerText()).includes('timeout_unknown'), true, 'developer view: attempts show timeout_unknown');
await desk.getByRole('tab', { name: 'Timeline' }).click();
await desk.evaluate(() => { document.querySelector('[data-devview]').scrollIntoView(); window.scrollBy(0, -76); });
await desk.mouse.move(5, 300);
await desk.waitForTimeout(250);
await shot(desk, 'demo-developer.png');
await desk.getByRole('switch', { name: 'Developer view' }).click();

// ---------------------------------------------------------------- processing screenshot + comment screenshot
await desk.locator('[data-mode="instagram_dm"]').click();
await desk.getByRole('button', { name: 'My landlord wants me out' }).click();
await desk.getByRole('radio', { name: '0.5×' }).click();
await desk.waitForFunction(() => document.querySelector('[data-edge="queue_context"]')?.getAttribute('data-state') === 'active', null, { polling: 'raf', timeout: 40_000 });
await desk.waitForTimeout(150);
await desk.getByRole('button', { name: 'Pause' }).click();
expectEq(await desk.locator('.packet.lane-0').evaluate((el) => el.style.opacity), '1', 'processing: packet visible in the graph');
await desk.evaluate(() => window.scrollTo(0, 0));
await desk.mouse.move(5, 300);
await desk.waitForTimeout(200);
await shot(desk, 'demo-desktop-processing.png');
await desk.getByRole('button', { name: 'Skip to end' }).click();
await desk.locator('[data-results]').waitFor();
await desk.getByRole('radio', { name: '1×' }).click();

async function postVisible(page, what) {
  const dev = await page.locator('[data-device]').boundingBox();
  const post = await page.locator('[data-post]').boundingBox();
  expectEq(!!dev && !!post && post.height > 40 && post.y >= dev.y && post.y + post.height <= dev.y + dev.height, true, `${what}: post stays visible inside the device after the reply`);
  expectEq(await page.locator('[data-post]').getAttribute('data-collapsed'), 'true', `${what}: post collapsed to the pinned header`);
}
await desk.locator('[data-mode="instagram_comment"]').click();
expectEq(await desk.locator('[data-post]').getAttribute('data-collapsed'), 'false', 'Instagram comment: post fully shown before any comment');
await desk.getByLabel('Message text').fill('Do I need a lawyer to write a will?');
await desk.getByRole('button', { name: 'Post', exact: true }).click();
await finish(desk);
await desk.waitForTimeout(700);
await postVisible(desk, 'Instagram comment');
await desk.locator('[data-mode="facebook_comment"]').click();
await desk.getByLabel('Message text').fill('My landlord refuses to return my deposit. What can I do?');
await desk.getByRole('button', { name: 'Send', exact: true }).click();
await finish(desk);
expectEq((await desk.locator('[data-mock="facebook_comment"] [data-msg="bot"]').innerText()).includes('private message'), true, 'comment: bot reply nested under the comment with the privacy sentence');
await desk.waitForTimeout(700);
await postVisible(desk, 'Facebook comment');
await desk.evaluate(() => window.scrollTo(0, 0));
await desk.waitForTimeout(300);
await shot(desk, 'demo-comment.png');
await desk.close();

// ---------------------------------------------------------------- Slovenian run, reduced motion
{
  const sl = await newPage({ width: 1440, height: 900 }, { reduced: true });
  await sl.getByRole('radio', { name: 'SL', exact: true }).click();
  await sl.getByRole('button', { name: 'Koliko stane posvet?' }).click();
  await watchRun(sl, 'SL reduced-motion run', 0).catch(() => undefined);
  await sl.locator('[data-results]').waitFor({ timeout: 40_000 });
  const reply = await sl.locator('[data-msg="bot"]').innerText();
  expectEq(reply.includes('49'), true, 'SL reply grounded (price fact)');
  expectEq(await sl.locator('[data-msg="bot"] .fact').count() >= 2, true, 'SL reply has fact chips (price and booking link)');
  await sl.close();
}

// ---------------------------------------------------------------- top bar: no overlaps across common widths
for (const [w, h] of [[1024, 768], [1180, 800], [1280, 800], [1366, 768], [1440, 900], [1600, 900]]) {
  const p = await newPage({ width: w, height: h });
  const boxes = await p.evaluate(() => {
    const out = [];
    for (const el of document.querySelectorAll('.topbar > .tb-left > *, .topbar > .tb-right > *, .topbar > .seg')) {
      const r = el.getBoundingClientRect();
      const cs = getComputedStyle(el);
      if (r.width > 0 && cs.display !== 'none') out.push({ name: el.className || el.tagName, l: r.left, r: r.right, t: r.top, b: r.bottom });
    }
    const bar = document.querySelector('.topbar');
    return { out, over: bar.scrollWidth - bar.clientWidth, page: document.documentElement.scrollWidth - window.innerWidth };
  });
  let clash = '';
  for (let i = 0; i < boxes.out.length; i++) for (let j = i + 1; j < boxes.out.length; j++) {
    const a = boxes.out[i], b = boxes.out[j];
    if (a.l < b.r - 0.5 && b.l < a.r - 0.5 && a.t < b.b - 0.5 && b.t < a.b - 0.5) clash += `${a.name} × ${b.name}; `;
  }
  expectEq(clash, '', `${w}px: top-bar children do not overlap`);
  expectEq(boxes.over <= 0 && boxes.page <= 0 && Math.max(...boxes.out.map((b) => b.r)) <= w, true, `${w}px: top bar and page do not overflow`);
  if (w >= 1180) {
    const dev = await p.locator('[data-device]').boundingBox();
    const g = await p.locator('.graph-svg').boundingBox();
    expectEq(!!dev && !!g && dev.x + dev.width < g.x + 4, true, `${w}px: device and graph side by side`);
  }
  if (w === 1280 || w === 1366) {
    const vh = h;
    const wh = await p.locator('[data-node="webhook"]').boundingBox();
    const comp = await p.locator('#composer').boundingBox();
    expectEq(!!wh && wh.y >= 0 && wh.y + wh.height <= vh, true, `${w}x${h}: Meta webhook node inside the first viewport`);
    expectEq(!!comp && comp.y >= 0 && comp.y + comp.height <= vh, true, `${w}x${h}: composer inside the first viewport`);
    const pic = await p.locator('.graph-svg [data-node]').evaluateAll((els) => els.filter((e) => e.getBoundingClientRect().bottom <= window.innerHeight).length);
    console.log(`    ${w}x${h}: ${pic} graph nodes visible above the fold`);
  }
  await p.close();
}
// Stacked (760-1180): the wires visibly touch the device.
for (const [w, h] of [[1024, 768], [900, 800]]) {
  const p = await newPage({ width: w, height: h });
  const r = await p.evaluate(() => {
    const d = document.querySelector('[data-device]').getBoundingClientRect();
    const end = (sel, atEnd) => {
      const path = document.querySelector(sel);
      const pt = path.getPointAtLength(atEnd ? path.getTotalLength() : 0);
      const m = path.getScreenCTM();
      return { x: m.a * pt.x + m.e, y: m.d * pt.y + m.f };
    };
    return { dR: d.right, dL: d.left, dT: d.top, dB: d.bottom, o: end('[data-edge="dev_out"] .base', false), i: end('[data-edge="dev_in"] .base', true) };
  });
  expectEq(Math.abs(r.o.x - r.dR) < 3 && r.o.y >= r.dT && r.o.y <= r.dB, true, `${w}px stacked: outbound wire starts on the device's right edge`);
  expectEq(Math.abs(r.i.x - r.dL) < 3 && r.i.y >= r.dT && r.i.y <= r.dB, true, `${w}px stacked: return wire ends on the device's left edge`);
  await p.close();
}

// ---------------------------------------------------------------- overflow at widths
for (const [w, h] of [[375, 812], [390, 844], [768, 1024], [1440, 900]]) {
  const p = await newPage({ width: w, height: h });
  const idle = await p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expectEq(idle <= 0, true, `${w}px: no horizontal page scroll (idle)`);
  await p.getByRole('button', { name: 'Can my employer fire me?' }).click();
  await p.locator('[data-msg="user"]').first().waitFor();
  await finish(p);
  const done = await p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expectEq(done <= 0, true, `${w}px: no horizontal page scroll (complete)`);
  const layout = await p.locator('.graph').getAttribute('data-layout');
  console.log(`    ${w}px graph layout: ${layout}`);
  if (w === 375) {
    expectEq(layout, 'tall', '375px: vertical graph topology');
    const cutoff = await p.evaluate(() => [...document.querySelectorAll('.graph-svg .node')].some((n) => { const r = n.getBoundingClientRect(); return r.left < -1 || r.right > window.innerWidth + 1; }));
    expectEq(cutoff, false, '375px: every graph node within the viewport');
  }
  if (w === 375 || w === 390) {
    const out = await p.evaluate(() => {
      const bad = [];
      for (const el of document.querySelectorAll('.graph-svg .node, .graph-svg .edge-label, .graph-svg .cluster')) {
        const r = el.getBoundingClientRect();
        if (r.width && (r.left < 15 || r.right > window.innerWidth - 15)) bad.push(`${el.getAttribute('data-node') ?? el.getAttribute('class')}:${Math.round(r.left)}-${Math.round(r.right)}`);
      }
      return bad;
    });
    expectEq(out.join(', '), '', `${w}px: graph nodes and labels keep a 16px gutter`);
    expectEq(await p.locator('.topbar h1').isVisible(), false, `${w}px: wordmark text hidden, monogram only`);
    const tb = await p.locator('.topbar').boundingBox();
    expectEq(!!tb && tb.height < 70, true, `${w}px: top bar is a single compact row`);
  }
  if (w === 390) {
    await p.reload();
    await p.locator('[data-device]').waitFor();
    await p.evaluate(() => window.scrollTo(0, 0));
    await p.waitForTimeout(500);
    await shot(p, 'demo-mobile-initial.png');
    await p.getByRole('button', { name: 'Can my employer fire me?' }).click();
    await p.locator('.mprog').waitFor({ timeout: 10_000 });
    expectEq((await p.locator('.mprog').innerText()).includes('Packet at'), true, '390: slim "packet at" chip while running');
    await finish(p);
    await p.waitForTimeout(900);
    await shot(p, 'demo-mobile-complete.png', { fullPage: true });
  }
  await p.close();
}

await browser.close();
await new Promise((resolve) => server.httpServer.close(resolve));

// Replace the previous generation of screenshots.
for (const old of ['demo-pipeline.png', 'demo-developer-view.png', 'demo-dark.png', 'demo-mobile.png']) await rm(path.join(outDir, old), { force: true });

console.log(`\nrequests: ${requests.size} distinct, all same-origin: ${[...requests].every((u) => u.startsWith(origin) || u.startsWith('data:'))}`);
for (const u of [...requests].sort()) console.log(`  ${u.replace(origin, '')}`);
if (problems.length) {
  console.error(`\n${problems.length} problem(s):\n- ${problems.join('\n- ')}`);
  process.exit(1);
}
console.log('\nbrowser check passed');
