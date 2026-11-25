// bench-run.mjs — run the user's real bench video through FormCheck in
// headless Chromium via CDP and report the analysis + 3 screenshots.
// Progress logs every 60 s (keeps polling cheap). Usage: node bench-run.mjs
import { writeFileSync } from 'node:fs';

const VIDEO = '/home/hatch/workspace/user/media_library/video/24/244792e1eccec21498ecf1dba29ce1f8b93826a61db98984c0aa4cf274e135d1.mp4';
const SHOTS = '/home/hatch/workspace/slay-form-analysis/screenshots/';

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
    consoleMsgs.push('[EXCEPTION] ' + JSON.stringify(m.params.exceptionDetails).slice(0, 400));
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
await send('DOM.enable');
await send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 1100, deviceScaleFactor: 1, mobile: false });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function ev(expr) {
  const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
  if (r.result?.exceptionDetails) return 'EVAL ERROR: ' + JSON.stringify(r.result.exceptionDetails).slice(0, 300);
  return r.result?.result?.value;
}
async function shot(file) {
  const r = await send('Page.captureScreenshot', { format: 'png' });
  if (!r.result?.data) { console.log(file, 'CAPTURE FAILED'); return; }
  writeFileSync(file, Buffer.from(r.result.data, 'base64'));
  console.log(file, 'saved');
}

await send('Page.navigate', { url: 'file:///home/hatch/workspace/slay-form-analysis/index.html' });
await sleep(3000);
console.log('title:', await ev('document.title'));
console.log('formcheck hook:', await ev('typeof window.__formcheck'));

const doc = await send('DOM.getDocument');
const input = await send('DOM.querySelector', { nodeId: doc.result.root.nodeId, selector: '#videoInput' });
await send('DOM.setFileInputFiles', { files: [VIDEO], nodeId: input.result.nodeId });
await sleep(1500);
console.log('video duration:', await ev('document.getElementById("video").duration'));
console.log('status:', await ev('document.getElementById("statusText").textContent'));

await ev(`document.querySelector('.ex-card[data-ex="bench"]').click()`);
await ev(`document.getElementById('analyzeBtn').click()`);

const t0 = Date.now();
let status = '';
let lastLog = 0;
const TIMEOUT_MS = 3600_000; // 60 min: numPoses=3 detection runs ~6 s/frame on this VM
while (Date.now() - t0 < TIMEOUT_MS) {
  await sleep(5000);
  const elapsed = Date.now() - t0;
  if (elapsed - lastLog >= 60000) {
    lastLog = elapsed;
    status = await ev('document.getElementById("statusText").textContent');
    const prog = await ev('document.getElementById("progressText").textContent');
    console.log(`[${Math.round(elapsed / 1000)}s] status=${status} progress=${prog}`);
    if (/Analysis done|Could not detect|Only some frames|Failed|error/i.test(status)) break;
  }
}
console.log('\nfinal status:', await ev('document.getElementById("statusText").textContent'));
console.log('analysis meta:', await ev('document.getElementById("analysisMeta").textContent'));
console.log('score:', await ev('document.getElementById("scoreValue").textContent'));
console.log('scoreLabel:', await ev('document.getElementById("scoreLabel").textContent'));
console.log('scoreSub:', await ev('document.getElementById("scoreSub").textContent'));

const data = await ev(`(() => { const a = window.__formcheck.analysis; if (!a) return null;
  return JSON.stringify({ score: a.score, detectedFrames: a.detectedFrames, totalFrames: a.totalFrames,
    durationSec: a.durationSec, driftX: a.driftX, driftY: a.driftY, reps: a.reps, repMetrics: a.repMetrics, checks: a.checks,
    multiPoseFrames: a.multiPoseFrames, rejectedJumps: a.rejectedJumps });
})()`);
console.log('ANALYSIS_JSON:', data);
console.log('trackingStats:', await ev(`JSON.stringify(window.__formcheck.trackingStats)`));
console.log('multiWarn:', await ev('document.getElementById("multiWarn").textContent'));
console.log('multiWarn hidden:', await ev('document.getElementById("multiWarn").classList.contains("hidden")'));

console.log('issues:', await ev('document.getElementById("issuesList").innerText'));
console.log('repTable:', await ev('document.getElementById("repTableBody").innerText'));

// Screenshot 1: video tab with skeleton overlay, near the first rep bottom.
const bottomT = await ev(`(() => { const a = window.__formcheck.analysis; return a && a.reps && a.reps.length ? a.reps[0].bottomT : 8; })()`);
console.log('first rep bottomT:', bottomT);
await ev(`document.querySelector('.tab[data-tab="video"]').click()`);
await sleep(500);
await ev(`const v = document.getElementById('video'); v.currentTime = ${typeof bottomT === 'number' ? bottomT : 8};`);
await sleep(900);
await ev(`document.getElementById('playBtn').click()`);
await sleep(1200);
await shot(SHOTS + 'user-bench-1-video.png');
await ev(`document.getElementById('playBtn').click()`);

// Screenshot 2: analysis tab.
await ev(`document.querySelector('.tab[data-tab="analysis"]').click()`);
await sleep(700);
await shot(SHOTS + 'user-bench-2-analysis.png');

// Screenshot 3: feedback tab.
await ev(`document.querySelector('.tab[data-tab="feedback"]').click()`);
await sleep(700);
await shot(SHOTS + 'user-bench-3-feedback.png');

console.log('\n--- console / exceptions ---');
console.log(consoleMsgs.length ? consoleMsgs.join('\n') : '(clean)');
process.exit(0);
