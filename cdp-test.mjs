// cdp-test.mjs — headless CDP test + screenshots for FormCheck.
// Usage: node cdp-test.mjs
// Requires: python http.server on 8931, Chromium with --remote-debugging-port=9222.
import { writeFileSync } from 'node:fs';

const list = await (await fetch('http://127.0.0.1:9222/json/list')).json();
const page = list.find((t) => t.type === 'page');
if (!page) throw new Error('no page target');
const ws = new WebSocket(page.webSocketDebuggerUrl);
let id = 0;
const pending = new Map();
const consoleMsgs = [];
ws.onmessage = (e) => {
  const m = JSON.parse(e.data);
  if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
  else if (m.method === 'Runtime.consoleAPICalled') {
    const p = m.params;
    consoleMsgs.push(`[console.${p.type}] ` + p.args.map((a) => a.value ?? a.description ?? '').join(' '));
  } else if (m.method === 'Runtime.exceptionThrown') {
    consoleMsgs.push('[EXCEPTION] ' + JSON.stringify(m.params.exceptionDetails).slice(0, 500));
  }
};
const send = (method, params = {}) => new Promise((res) => {
  const i = ++id;
  pending.set(i, res);
  ws.send(JSON.stringify({ id: i, method, params }));
});
await new Promise((r) => { ws.onopen = r; });
await send('Page.enable');
await send('Runtime.enable');
await send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 1100, deviceScaleFactor: 1, mobile: false });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function ev(expr) {
  const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
  if (r.result?.exceptionDetails) return 'EVAL ERROR: ' + JSON.stringify(r.result.exceptionDetails).slice(0, 400);
  return r.result?.result?.value;
}
async function shot(file) {
  const r = await send('Page.captureScreenshot', { format: 'png' });
  if (!r.result?.data) { console.log(file, 'CAPTURE FAILED'); return; }
  writeFileSync(file, Buffer.from(r.result.data, 'base64'));
  console.log(file, 'saved');
}

// Reload the page fresh from disk (file:// -> file:// is not blocked by LNA).
await send('Page.navigate', { url: 'file:///home/hatch/workspace/slay-form-analysis/index.html' });
await sleep(3000);
console.log('url:', await ev('location.href'));
console.log('title:', await ev('document.title'));
console.log('formcheck hook:', await ev('typeof window.__formcheck'));

// Unit test: a right angle must return 90 degrees (via an injected module script,
// because Runtime.evaluate itself is a classic script and cannot use import()).
console.log('angle3 right angle =', await ev(`new Promise((res) => { const s = document.createElement('script'); s.type = 'module'; s.textContent = 'import { angle3 } from "./analysis.mjs"; window.__angleTest = { right: angle3({x:1,y:0,z:0},{x:0,y:0,z:0},{x:0,y:1,z:0}), straight: angle3({x:1,y:0,z:0},{x:0,y:0,z:0},{x:-1,y:0,z:0}) };'; document.head.appendChild(s); setTimeout(() => res(JSON.stringify(window.__angleTest)), 800); })`));

// Run the bench demo.
console.log('runDemo bench:', await ev(`window.__formcheck.runDemo('bench') ? 'analysis object returned' : 'null'`));
await sleep(2500);
console.log('score:', await ev(`document.getElementById('scoreValue').textContent`));
console.log('scoreLabel:', await ev(`document.getElementById('scoreLabel').textContent`));
console.log('issues:', await ev(`document.getElementById('issuesList').innerText.slice(0, 400)`));
console.log('rep rows:', await ev(`document.getElementById('repTableBody').children.length`));
console.log('demo badge visible:', await ev(`!document.getElementById('demoBadge').classList.contains('hidden')`));

// Screenshot 1: video tab with skeleton overlay (demo playing).
await ev(`document.querySelector('.tab[data-tab="video"]').click()`);
await sleep(1200);
await shot('/home/hatch/workspace/slay-form-analysis/screenshots/1-video-skeleton.png');

// Screenshot 2: analysis tab.
await ev(`document.querySelector('.tab[data-tab="analysis"]').click()`);
await sleep(600);
await shot('/home/hatch/workspace/slay-form-analysis/screenshots/2-analysis.png');

// Screenshot 3: feedback tab.
await ev(`document.querySelector('.tab[data-tab="feedback"]').click()`);
await sleep(600);
await shot('/home/hatch/workspace/slay-form-analysis/screenshots/3-feedback.png');

// Also run squat + deadlift demos to confirm all three exercises render.
for (const ex of ['squat', 'deadlift']) {
  console.log(`runDemo ${ex}:`, await ev(`window.__formcheck.runDemo('${ex}') ? 'ok' : 'null'`));
  await sleep(1200);
  console.log(`  ${ex} score:`, await ev(`document.getElementById('scoreValue').textContent`), 'reps:', await ev(`window.__formcheck.analysis.reps.length`));
}

console.log('\n--- console / exceptions ---');
console.log(consoleMsgs.length ? consoleMsgs.join('\n') : '(clean)');
process.exit(0);
