// mediapipe-test.mjs — end-to-end test of the REAL video path:
// upload a real squat video, run MediaPipe pose estimation in headless
// Chromium, and report detection rate, reps, score and checks.
// Usage: node mediapipe-test.mjs [videoPath] [exercise]
import { writeFileSync } from 'node:fs';

const videoPath = process.argv[2] || '/home/hatch/workspace/slay-form-analysis/test-assets/squat-demo.webm';
const exercise = process.argv[3] || 'squat';

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

await send('Page.navigate', { url: 'file:///home/hatch/workspace/slay-form-analysis/index.html' });
await sleep(2500);

// Set the file input to the real video.
const doc = await send('DOM.getDocument');
const input = await send('DOM.querySelector', { nodeId: doc.result.root.nodeId, selector: '#videoInput' });
await send('DOM.setFileInputFiles', { files: [videoPath], nodeId: input.result.nodeId });
await sleep(1500);
console.log('video loaded, duration:', await ev('document.getElementById("video").duration'));
console.log('status:', await ev('document.getElementById("statusText").textContent'));

// Pick the exercise and analyze.
await ev(`document.querySelector('.ex-card[data-ex="${exercise}"]').click()`);
await ev(`document.getElementById('analyzeBtn').click()`);

const t0 = Date.now();
let status = '';
while (Date.now() - t0 < 150000) {
  await sleep(3000);
  status = await ev('document.getElementById("statusText").textContent');
  const prog = await ev('document.getElementById("progressText").textContent');
  console.log(`[${Math.round((Date.now() - t0) / 1000)}s] status=${status} progress=${prog}`);
  if (/done|Could not detect|Failed|error/i.test(status)) break;
}
console.log('\nfinal status:', status);
console.log('analysis meta:', await ev('document.getElementById("analysisMeta").textContent'));
console.log('score:', await ev('document.getElementById("scoreValue").textContent'));
console.log('reps:', await ev('window.__formcheck.analysis ? window.__formcheck.analysis.reps.length : null'));
console.log('checks:', await ev(`window.__formcheck.analysis ? window.__formcheck.analysis.checks.map(c => (c.pass?'PASS':'FAIL')+' '+c.label+': '+c.value).join(' | ') : null`));
console.log('driftX:', await ev('window.__formcheck.analysis ? window.__formcheck.analysis.driftX : null'));

// Screenshot the real video with the skeleton overlay (play the video first).
await ev(`document.querySelector('.tab[data-tab="video"]').click()`);
await ev(`document.getElementById('playBtn').click()`);
await sleep(2500);
const shot = await send('Page.captureScreenshot', { format: 'png' });
if (shot.result?.data) {
  writeFileSync('/home/hatch/workspace/slay-form-analysis/screenshots/4-real-video-squat.png', Buffer.from(shot.result.data, 'base64'));
  console.log('screenshots/4-real-video-squat.png saved');
}
console.log('\n--- console / exceptions ---');
console.log(consoleMsgs.length ? consoleMsgs.join('\n') : '(clean)');
process.exit(0);
