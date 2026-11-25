// app.js — FormCheck UI: video upload, MediaPipe on-device pose estimation,
// computed biomechanics (analysis.mjs), demo mode, Gemini coaching, JSON export.
//
// The numbers ALWAYS come from pose estimation. Gemini only turns the
// computed numbers into plain-language coaching text.
import { analyzeFrames, EXERCISES, LM, POSE_CONNECTIONS } from './analysis.mjs';
import { getDemoData } from './demo-data.mjs';

// ---------------------------------------------------------------- i18n
const I18N = {
  en: {
    tagline: 'Your coach, in your pocket — no spotter needed.',
    settings: 'Settings',
    step1: '1 · Pick your lift',
    bench: 'Bench Press', benchDesc: 'Bar path & elbow angle',
    squat: 'Squat', squatDesc: 'Depth, knee tracking & lean',
    deadlift: 'Deadlift', deadliftDesc: 'Hip shoot, lockout & back',
    sideHint: 'Film from the side, full body in frame, bar visible. One rep or more — the longer the clip, the better.',
    step2: '2 · Add your video',
    upload: 'Upload a lift video',
    demo: 'Try the demo (no video needed)',
    analyze: 'Analyze form',
    tabVideo: 'Video', tabAnalysis: 'Analysis', tabFeedback: 'Feedback',
    play: 'Play', pause: 'Pause',
    videoHint: 'Skeleton and bar path are drawn from on-device pose estimation. Nothing is uploaded to a server.',
    angleChart: 'Joint angle over time',
    barChart: 'Bar path (side view)',
    barLegend: 'Each dot is one frame. A good bar path is a tight, near-vertical line.',
    repTable: 'Rep by rep',
    rep: 'Rep', minAngle: 'Min angle', ecc: 'Lowering', con: 'Lifting', bottom: 'At the bottom',
    noReps: 'No analysis yet — upload a video or run the demo.',
    scorePending: 'Analyze a lift to get your score.',
    issues: 'What to fix',
    noIssues: 'Nothing here yet.',
    aiCoach: 'AI coach',
    geminiHint: 'Gemini turns the measured numbers above into plain-language coaching. The numbers are computed on-device; the AI only explains them.',
    geminiBtn: 'Get AI coaching',
    export: 'Export analysis (JSON)',
    disclaimer: '⚠️ Coaching guidance, not medical advice. This is not a medical assessment and cannot diagnose injuries. Single-camera pose estimation has limits — angles are approximate. Stop training and consult a professional if anything hurts.',
    privacy: "Your video is processed on your device with MediaPipe and never leaves your browser. The Gemini API key (optional) is stored only in this browser's local storage.",
    keyLabel: 'Google Gemini API key (optional)',
    keyHint: 'Get a free key at Google AI Studio. It is stored only in this browser (localStorage) and is used only to turn your measured numbers into coaching text. The form analysis works fully without it.',
    saveKey: 'Save key', clearKey: 'Remove key', close: 'Close',
    videoLoaded: 'Video loaded — hit Analyze.',
    loadingModel: 'Loading pose model (first time, ~4 MB)…',
    analyzing: 'Analyzing frames…',
    noPose: 'Could not detect a body in enough frames. Film from the side with your full body in frame and good light.',
    lowPose: 'Only some frames had a detectable body — results may be noisy.',
    multiPerson: '⚠️ A second person is in frame — this may affect tracking.',
    done: 'Analysis done.',
    needKey: 'Add a Gemini API key in Settings first (free from Google AI Studio).',
    geminiLoading: 'Asking Gemini for coaching…',
    geminiError: 'Gemini call failed: ',
    geminiBadKey: 'That key was rejected — check it in Settings.',
    passedAlso: 'Also passed: ',
    scoreExcellent: 'Excellent — keep it up.',
    scoreGood: 'Solid, with room to improve.',
    scoreWork: 'Needs work — fix the top issue first.',
    scorePoor: 'Stop and fix your form before adding weight.',
    scoreSub: (s, n) => `${s}/10 · ${n} rep${n === 1 ? '' : 's'} analyzed`,
    framesMeta: (dur, f, total, p) => `${f}/${total} frames with a detected pose (${p}%) · ${dur.toFixed(1)} s sampled`,
    demoPlaying: 'Demo — sample data, not your video.',
    fix: 'Fix: ',
    knee: 'Knee', hip: 'Hip', elbow: 'Elbow',
  },
  zh: {
    tagline: '口袋里的教练——不用保护者也能练。',
    settings: '设置',
    step1: '1 · 选择动作',
    bench: '卧推', benchDesc: '杠铃轨迹与肘关节角度',
    squat: '深蹲', squatDesc: '深度、膝盖轨迹与躯干前倾',
    deadlift: '硬拉', deadliftDesc: '屁股先起、锁定与背部',
    sideHint: '从侧面拍摄，全身入镜，杠铃可见。一组或多组都可以，视频越长越好。',
    step2: '2 · 添加视频',
    upload: '上传训练视频',
    demo: '试试演示（不用视频）',
    analyze: '分析动作',
    tabVideo: '视频', tabAnalysis: '分析', tabFeedback: '反馈',
    play: '播放', pause: '暂停',
    videoHint: '骨架与杠铃轨迹来自设备端姿态估计，不会上传到任何服务器。',
    angleChart: '关节角度随时间变化',
    barChart: '杠铃轨迹（侧面视角）',
    barLegend: '每个点是一帧。好的杠铃轨迹是一条紧凑、接近垂直的线。',
    repTable: '逐次分析',
    rep: '次数', minAngle: '最小角度', ecc: '下放', con: '起身', bottom: '底部姿态',
    noReps: '还没有分析结果——上传视频或运行演示。',
    scorePending: '分析一次动作即可获得评分。',
    issues: '需要改进的地方',
    noIssues: '暂无内容。',
    aiCoach: 'AI 教练',
    geminiHint: 'Gemini 把上面测得的数字变成通俗的指导。数字全部由设备端算出，AI 只负责解释。',
    geminiBtn: '获取 AI 指导',
    export: '导出分析结果 (JSON)',
    disclaimer: '⚠️ 仅为训练指导，不是医疗建议。本工具不是医疗评估，不能诊断伤病。单摄像头姿态估计有局限，角度为近似值。如有疼痛请停止训练并咨询专业人士。',
    privacy: '视频在您的设备上用 MediaPipe 处理，不会离开浏览器。Gemini API 密钥（可选）仅保存在本浏览器的本地存储中。',
    keyLabel: 'Google Gemini API 密钥（可选）',
    keyHint: '在 Google AI Studio 免费获取。仅保存在本浏览器（localStorage），只用于把测得的数字变成指导文字。不填也能完整使用动作分析。',
    saveKey: '保存密钥', clearKey: '删除密钥', close: '关闭',
    videoLoaded: '视频已加载，点击「分析动作」。',
    loadingModel: '正在加载姿态模型（首次，约 4 MB）…',
    analyzing: '正在分析视频帧…',
    noPose: '多数帧中检测不到人体。请从侧面拍摄、保证全身入镜且光线充足。',
    lowPose: '只有部分帧检测到人体，结果可能不太准。',
    multiPerson: '⚠️ 画面里有第二个人，可能会影响识别。',
    done: '分析完成。',
    needKey: '请先在设置里添加 Gemini API 密钥（Google AI Studio 免费获取）。',
    geminiLoading: '正在请 Gemini 给出指导…',
    geminiError: 'Gemini 调用失败：',
    geminiBadKey: '密钥被拒绝了，请在设置里检查。',
    passedAlso: '同时通过的检查：',
    scoreExcellent: '优秀——继续保持。',
    scoreGood: '不错，还有提升空间。',
    scoreWork: '需要改进——先修最主要的问题。',
    scorePoor: '先停下来纠正动作，再加重量。',
    scoreSub: (s, n) => `${s}/10 · 已分析 ${n} 次`,
    framesMeta: (dur, f, total, p) => `${f}/${total} 帧检测到人体（${p}%）· 采样 ${dur.toFixed(1)} 秒`,
    demoPlaying: '演示——示例数据，不是你的视频。',
    fix: '改进方法：',
    knee: '膝', hip: '髋', elbow: '肘',
  },
};

// One concrete fix per issue (bilingual). Keyed by exercise:checkId.
const FIXES = {
  'squat:depth': {
    en: 'Drop the weight 10–20% and squat to a box set at parallel until depth is automatic, then remove the box.',
    zh: '减重 10–20%，蹲到平行高度的箱子上练到形成习惯，再撤掉箱子。',
  },
  'squat:lean': {
    en: 'Brace hard before you descend and think “chest up” — drive your elbows down and keep your gaze forward.',
    zh: '下蹲前先收紧核心，想着“挺胸”——手肘向下压，视线保持向前。',
  },
  'squat:tempo': {
    en: 'Count 2 seconds on the way down on every rep — a fast drop hides depth and knee problems.',
    zh: '每次下蹲数 2 秒，蹲太快会掩盖深度和膝盖问题。',
  },
  'bench:depth': {
    en: 'Lower the weight and pause 1 second with the bar touching your chest on every rep.',
    zh: '减重，每次都在杠铃触胸后停 1 秒再推起。',
  },
  'bench:lockout': {
    en: 'Finish every rep — lock the elbows fully at the top instead of stopping short.',
    zh: '每次都要推到底，顶端肘关节完全伸直，别留半程。',
  },
  'bench:tempo': {
    en: 'Count 2 seconds lowering the bar — a controlled descent keeps the bar on its path.',
    zh: '下放杠铃数 2 秒，控制下放才能保持杠铃轨迹稳定。',
  },
  'deadlift:hipshoot': {
    en: 'Think “push the floor away” and “chest up” — hips and shoulders must rise together. Pause deadlifts (2 s pause just off the floor) fix this fast.',
    zh: '想着“蹬地”和“挺胸”，屁股和肩膀要一起起。练暂停硬拉（离地 2 秒停顿）能很快纠正。',
  },
  'deadlift:lockout': {
    en: 'Squeeze your glutes hard at the top and stand tall — finish the rep instead of cutting it short.',
    zh: '顶端用力夹紧臀部、站直，别提前收尾。',
  },
  'deadlift:setup': {
    en: 'Set your hips so your torso is at roughly 30° from vertical — not squatting the pull, not stiff-legged.',
    zh: '调整臀部高度，让躯干与垂直方向约成 30°——既不是蹲拉，也不是直腿拉。',
  },
  drift: {
    en: 'Slow down and keep the bar over mid-foot. Film from the side again after a week of controlled reps.',
    zh: '放慢速度，保持杠铃在脚掌中部正上方。练一周控制性动作后再从侧面拍一次对比。',
  },
  symmetry: {
    en: 'Film from the front too, and add unilateral work (split squats / single-arm press) for the weaker side.',
    zh: '再从正面拍一次，并给弱侧加单侧训练（分腿蹲/单臂推举）。',
  },
  lockout: {
    en: 'Finish every rep — lock out fully at the top instead of stopping short.',
    zh: '每次都要做到位，顶端完全锁定，别留半程。',
  },
};

// ---------------------------------------------------------------- state
let lang = 'en';
let exercise = 'bench';
let landmarker = null;
let landmarkerLoading = null;
let videoFile = null;
let demoMode = false;
let demoFrames = null;      // [{t, landmarks}] for the demo lift
let videoFrames = null;     // [{t, landmarks|null}] for a real video
let analysis = null;
let trackingStats = null; // { multiPoseFrames, rejectedJumps, totalFrames } for the last real-video run
let playback = { raf: 0, playing: false, startT: 0, demoT: 0 };

const $ = (id) => document.getElementById(id);
const videoEl = $('video'), overlay = $('overlay'), octx = overlay.getContext('2d');
const t = (key, ...args) => {
  const v = I18N[lang][key] ?? I18N.en[key];
  return typeof v === 'function' ? v(...args) : v;
};

// ---------------------------------------------------------------- i18n apply
function applyI18n() {
  document.querySelectorAll('[data-i18n]').forEach((el) => {
    const key = el.dataset.i18n;
    if (I18N[lang][key] !== undefined && typeof I18N[lang][key] === 'string') el.textContent = I18N[lang][key];
  });
  document.documentElement.lang = lang === 'zh' ? 'zh-CN' : 'en';
  $('langToggle').textContent = lang === 'zh' ? 'English' : '中文';
  if (analysis) renderAll();
}
$('langToggle').addEventListener('click', () => { lang = lang === 'en' ? 'zh' : 'en'; applyI18n(); });

// ---------------------------------------------------------------- exercise pick
$('exGrid').addEventListener('click', (e) => {
  const card = e.target.closest('.ex-card');
  if (!card) return;
  exercise = card.dataset.ex;
  document.querySelectorAll('.ex-card').forEach((c) => c.classList.toggle('selected', c === card));
  // switching lifts clears the previous analysis (different lift, different numbers)
  analysis = null; videoFrames = null; demoFrames = null; demoMode = false;
  $('demoBadge').classList.add('hidden');
  renderEmpty();
});

// ---------------------------------------------------------------- tabs
$('tabs').addEventListener('click', (e) => {
  const tab = e.target.closest('.tab');
  if (!tab) return;
  document.querySelectorAll('.tab').forEach((b) => b.classList.toggle('active', b === tab));
  document.querySelectorAll('.tab-panel').forEach((p) => p.classList.toggle('active', p.id === 'tab-' + tab.dataset.tab));
});
function switchTab(name) {
  document.querySelector(`.tab[data-tab="${name}"]`).click();
}

// ---------------------------------------------------------------- video upload
$('videoInput').addEventListener('change', (e) => {
  const f = e.target.files[0];
  if (!f) return;
  videoFile = f;
  demoMode = false; demoFrames = null; videoFrames = null; analysis = null;
  $('demoBadge').classList.add('hidden');
  if (videoEl.src) URL.revokeObjectURL(videoEl.src);
  videoEl.src = URL.createObjectURL(f);
  videoEl.load();
  $('analyzeBtn').disabled = false;
  $('playBtn').disabled = false;
  setStatus(t('videoLoaded'), 'ok');
  renderEmpty();
  videoEl.addEventListener('loadedmetadata', sizeOverlay, { once: true });
});

function sizeOverlay() {
  const stage = document.querySelector('.video-stage');
  const r = stage.getBoundingClientRect();
  overlay.width = Math.max(2, Math.round(r.width));
  overlay.height = Math.max(2, Math.round(r.height));
}
window.addEventListener('resize', sizeOverlay);

// ---------------------------------------------------------------- settings / Gemini key
const KEY_STORAGE = 'formcheck.geminiKey';
$('settingsBtn').addEventListener('click', () => {
  $('geminiKey').value = localStorage.getItem(KEY_STORAGE) || '';
  $('keyStatus').textContent = '';
  $('settingsModal').classList.remove('hidden');
});
$('closeSettingsBtn').addEventListener('click', () => $('settingsModal').classList.add('hidden'));
$('saveKeyBtn').addEventListener('click', () => {
  const k = $('geminiKey').value.trim();
  if (k) localStorage.setItem(KEY_STORAGE, k);
  else localStorage.removeItem(KEY_STORAGE);
  $('keyStatus').textContent = k ? '✓ Saved in this browser only.' : 'Key removed.';
  $('keyStatus').className = 'status ok';
});
$('clearKeyBtn').addEventListener('click', () => {
  localStorage.removeItem(KEY_STORAGE);
  $('geminiKey').value = '';
  $('keyStatus').textContent = 'Key removed.';
  $('keyStatus').className = 'status ok';
});

// ---------------------------------------------------------------- MediaPipe
// The Tasks Vision bundle + WASM + model are vendored in ./vendor/mediapipe/
// (Apache-2.0, see vendor/mediapipe/NOTICE.md) so the app works fully offline.
// If the local files are missing, fall back to the CDN.
const MEDIAPIPE_SOURCES = [
  {
    bundle: './vendor/mediapipe/vision_bundle.mjs',
    wasm: './vendor/mediapipe/wasm',
    model: './vendor/mediapipe/pose_landmarker_lite.task',
  },
  {
    bundle: 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/vision_bundle.mjs',
    wasm: 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm',
    model: 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task',
  },
];

// ---------------------------------------------------------------- pose tracking (lock onto one person)
// MediaPipe returns up to numPoses poses per frame in no guaranteed order,
// and a naive landmarks[0] tracker jumps between people when a bystander
// is in frame. So we track identity frame-to-frame: each frame, pick the
// candidate closest to the pose we locked onto last frame (nearest-neighbor
// by mean landmark displacement). The lock starts soft — for the first few
// detected frames we keep re-picking the largest, most central pose (the
// lifter, not a bystander at the edge) — then it hardens. A candidate that
// moved implausibly far since the last frame is rejected as a different
// person, and that frame counts as undetected instead.
const TRACK_MAX_JUMP = 0.25; // mean landmark displacement (normalized units) per frame; nobody teleports 25% of the frame in 1/8 s
const TRACK_SOFT_FRAMES = 8;

function poseBBox(lm) {
  let x0 = 1, x1 = 0, y0 = 1, y1 = 0;
  for (const p of lm) {
    if (p.x < x0) x0 = p.x; if (p.x > x1) x1 = p.x;
    if (p.y < y0) y0 = p.y; if (p.y > y1) y1 = p.y;
  }
  return { area: Math.max(0, x1 - x0) * Math.max(0, y1 - y0), cx: (x0 + x1) / 2, cy: (y0 + y1) / 2 };
}

function meanDisplacement(a, b) {
  let s = 0, n = 0;
  const len = Math.min(a.length, b.length);
  for (let i = 0; i < len; i++) {
    s += Math.hypot(a[i].x - b[i].x, a[i].y - b[i].y);
    n++;
  }
  return n ? s / n : Infinity;
}

function pickInitialPose(poses) {
  // Largest, most central pose wins.
  let best = null, bestScore = -1;
  for (const p of poses) {
    const b = poseBBox(p);
    const d = Math.hypot(b.cx - 0.5, b.cy - 0.5);
    const score = b.area / (1 + 2 * d);
    if (score > bestScore) { bestScore = score; best = p; }
  }
  return best;
}

function createPoseTracker() {
  return { prev: null, lockedFrames: 0, multiPoseFrames: 0, rejectedJumps: 0 };
}

// Returns the tracked pose's landmarks, or null if no pose / jump rejected.
// The tracker's prev stays at the last good pose after a rejection, so the
// next frame can re-acquire the lifter instead of latching onto someone else.
function trackNext(tracker, poses) {
  if (!poses || !poses.length) return null;
  if (poses.length > 1) tracker.multiPoseFrames++;
  let pick;
  if (!tracker.prev || tracker.lockedFrames < TRACK_SOFT_FRAMES) {
    pick = pickInitialPose(poses);
    tracker.lockedFrames++;
  } else {
    let best = null, bestD = Infinity;
    for (const p of poses) {
      const d = meanDisplacement(p, tracker.prev);
      if (d < bestD) { bestD = d; best = p; }
    }
    if (bestD > TRACK_MAX_JUMP) { tracker.rejectedJumps++; return null; }
    pick = best;
  }
  tracker.prev = pick;
  return pick;
}

async function getLandmarker() {
  if (landmarker) return landmarker;
  if (landmarkerLoading) return landmarkerLoading;
  landmarkerLoading = (async () => {
    setStatus(t('loadingModel'));
    let lastErr = null;
    for (const src of MEDIAPIPE_SOURCES) {
      try {
        const { FilesetResolver, PoseLandmarker } = await import(src.bundle);
        const vision = await FilesetResolver.forVisionTasks(src.wasm);
        const opts = {
          baseOptions: { modelAssetPath: src.model, delegate: 'GPU' },
          runningMode: 'VIDEO',
          numPoses: 3, // detect bystanders too — the tracker below locks onto one person
        };
        try {
          landmarker = await PoseLandmarker.createFromOptions(vision, opts);
        } catch (e) {
          // Headless / no-GPU environments: fall back to CPU.
          landmarker = await PoseLandmarker.createFromOptions(vision, { ...opts, baseOptions: { ...opts.baseOptions, delegate: 'CPU' } });
        }
        return landmarker;
      } catch (e) {
        lastErr = e; // try the next source (local -> CDN)
      }
    }
    throw lastErr || new Error('Could not load the pose model.');
  })();
  return landmarkerLoading;
}

// ---------------------------------------------------------------- analyze a real video
$('analyzeBtn').addEventListener('click', async () => {
  if (!videoFile) return;
  $('analyzeBtn').disabled = true;
  showProgress(0, t('loadingModel'));
  try {
    const lm = await getLandmarker();
    setStatus(t('analyzing'));
    await videoEl.play().catch(() => {});
    videoEl.pause();
    const duration = videoEl.duration;
    if (!duration || !isFinite(duration)) throw new Error('Could not read video duration.');
    const FPS = 8;
    const total = Math.max(8, Math.floor(duration * FPS));
    const off = document.createElement('canvas');
    const offCtx = off.getContext('2d');
    const tracker = createPoseTracker();
    const frames = [];
    for (let i = 0; i < total; i++) {
      const time = (i + 0.5) * (duration / total);
      await seekTo(time);
      const w = 480, h = Math.round((480 * videoEl.videoHeight) / videoEl.videoWidth);
      off.width = w; off.height = h;
      offCtx.drawImage(videoEl, 0, 0, w, h);
      let res = null;
      try { res = lm.detectForVideo(off, Math.round(time * 1000)); } catch (e) { /* frame skipped */ }
      // Track ONE person: never let the tracker jump to a bystander.
      frames.push({ t: time, landmarks: trackNext(tracker, res && res.landmarks ? res.landmarks : null) });
      showProgress(Math.round(((i + 1) / total) * 100), `${t('analyzing')} ${i + 1}/${total}`);
    }
    trackingStats = { multiPoseFrames: tracker.multiPoseFrames, rejectedJumps: tracker.rejectedJumps, totalFrames: total };
    videoFrames = frames;
    demoMode = false;
    finishAnalysis(frames);
  } catch (e) {
    console.error(e);
    setStatus(e.message || 'Analysis failed.', 'error');
  } finally {
    hideProgress();
    $('analyzeBtn').disabled = false;
  }
});

function seekTo(time) {
  return new Promise((resolve) => {
    const onSeek = () => { videoEl.removeEventListener('seeked', onSeek); resolve(); };
    videoEl.addEventListener('seeked', onSeek);
    videoEl.currentTime = Math.min(time, (videoEl.duration || 1) - 0.05);
    setTimeout(() => { videoEl.removeEventListener('seeked', onSeek); resolve(); }, 1500); // never hang
  });
}

// ---------------------------------------------------------------- demo mode
$('demoBtn').addEventListener('click', () => {
  const demo = getDemoData(exercise);
  demoFrames = demo.frames;
  demoMode = true;
  trackingStats = null;
  videoEl.removeAttribute('src');
  videoEl.load();
  $('demoBadge').classList.remove('hidden');
  $('playBtn').disabled = false;
  setStatus(t('demoPlaying'), 'ok');
  finishAnalysis(demoFrames, true);
  startDemoPlayback();
});

function finishAnalysis(frames, isDemo = false) {
  analysis = analyzeFrames(frames, exercise);
  // Tracking stats (real video only; the demo is single-pose sample data).
  analysis.multiPoseFrames = (!isDemo && trackingStats) ? trackingStats.multiPoseFrames : 0;
  analysis.rejectedJumps = (!isDemo && trackingStats) ? trackingStats.rejectedJumps : 0;
  const rate = analysis.detectedFrames / Math.max(1, analysis.totalFrames);
  if (analysis.detectedFrames === 0 || rate < 0.3) {
    setStatus(t('noPose'), 'error');
    analysis = null;
    renderEmpty();
    return;
  }
  if (rate < 0.5) setStatus(t('lowPose'));
  else setStatus(t('done'), 'ok');
  renderAll();
  $('geminiBtn').disabled = false;
  $('exportBtn').disabled = false;
  $('analysisMeta').textContent = t('framesMeta', analysis.durationSec, analysis.detectedFrames, analysis.totalFrames, Math.round(rate * 100));
  switchTab('feedback');
}

// ---------------------------------------------------------------- rendering
function renderEmpty() {
  trackingStats = null;
  $('multiWarn').classList.add('hidden');
  $('scoreValue').textContent = '–';
  $('scoreLabel').textContent = t('scorePending');
  $('scoreSub').textContent = '';
  $('issuesList').innerHTML = `<li class="muted">${t('noIssues')}</li>`;
  $('repTableBody').innerHTML = `<tr><td colspan="5" class="muted">${t('noReps')}</td></tr>`;
  $('geminiText').textContent = '';
  $('geminiBtn').disabled = true;
  $('exportBtn').disabled = true;
  $('analysisMeta').textContent = '';
  clearCharts();
  octx.clearRect(0, 0, overlay.width, overlay.height);
  $('liveReadout').textContent = '—';
}

function renderAll() {
  if (!analysis) return;
  renderMultiWarn();
  renderScore();
  renderIssues();
  renderRepTable();
  drawAngleChart();
  drawBarPathChart();
}

// Warn when a second person was in frame — the tracker locked onto the
// lifter, but the warning tells the user the numbers may be less reliable.
function renderMultiWarn() {
  const el = $('multiWarn');
  if (analysis && analysis.multiPoseFrames > 0) {
    el.textContent = t('multiPerson');
    el.classList.remove('hidden');
  } else {
    el.classList.add('hidden');
  }
}

function renderScore() {
  const s = analysis.score;
  $('scoreValue').textContent = s.toFixed(1);
  const ring = $('scoreRing');
  ring.classList.toggle('low', s < 5);
  ring.classList.toggle('mid', s >= 5 && s < 7);
  $('scoreLabel').textContent = s >= 9 ? t('scoreExcellent') : s >= 7 ? t('scoreGood') : s >= 5 ? t('scoreWork') : t('scorePoor');
  $('scoreSub').textContent = t('scoreSub', s.toFixed(1), analysis.reps.length);
}

function renderIssues() {
  const failed = analysis.checks.filter((c) => !c.pass);
  const passed = analysis.checks.filter((c) => c.pass);
  const list = $('issuesList');
  if (!failed.length) {
    list.innerHTML = `<li class="pass"><span class="issue-title">✓ ${lang === 'zh' ? '全部通过——动作很干净。' : 'All checks passed — clean lifting.'}</span></li>`;
  } else {
    list.innerHTML = failed.map((c) => {
      const fixKey = `${exercise}:${c.id}`;
      const fix = FIXES[fixKey] || FIXES[c.id];
      return `<li class="${c.severity}"><div class="issue-title">✗ ${c.label} — ${c.value}</div>` +
        (fix ? `<div class="issue-fix"><b>${t('fix')}</b>${fix[lang] || fix.en}</div>` : '') + `</li>`;
    }).join('');
  }
  if (passed.length) {
    const div = document.createElement('li');
    div.className = 'pass';
    div.innerHTML = `<span class="issue-title">✓ ${t('passedAlso')}${passed.map((c) => c.label).join(' · ')}</span>`;
    list.appendChild(div);
  }
}

function renderRepTable() {
  const body = $('repTableBody');
  if (!analysis.repMetrics.length) {
    body.innerHTML = `<tr><td colspan="5" class="muted">${t('noReps')}</td></tr>`;
    return;
  }
  body.innerHTML = analysis.repMetrics.map((r, i) => {
    const b = r.bottom || {};
    const bottomTxt = exercise === 'squat'
      ? `${t('knee')} ${b.kneeAngle?.toFixed(0)}° · ${lang === 'zh' ? '躯干' : 'lean'} ${b.spineLean?.toFixed(0)}°`
      : exercise === 'bench'
        ? `${t('elbow')} ${b.elbowAngle?.toFixed(0)}°`
        : `${t('hip')} ${b.hipAngle?.toFixed(0)}° · ${lang === 'zh' ? '躯干' : 'lean'} ${b.spineLean?.toFixed(0)}°`;
    return `<tr><td>${i + 1}</td><td>${r.minPrimary.toFixed(0)}°</td><td>${r.eccSec.toFixed(1)}s</td><td>${r.conSec.toFixed(1)}s</td><td>${bottomTxt}</td></tr>`;
  }).join('');
}

// ---- charts (plain canvas, no library)
function clearCharts() {
  for (const id of ['angleChart', 'barPathChart']) {
    const c = $(id), ctx = c.getContext('2d');
    ctx.clearRect(0, 0, c.width, c.height);
  }
  $('angleLegend').textContent = '';
}

function drawAngleChart() {
  const c = $('angleChart'), ctx = c.getContext('2d');
  const W = c.width, H = c.height, pad = { l: 38, r: 10, t: 12, b: 24 };
  ctx.clearRect(0, 0, W, H);
  const s = analysis.angleSeries.filter((p) => Number.isFinite(p.knee));
  if (s.length < 2) return;
  const t0 = s[0].t, t1 = s[s.length - 1].t;
  const X = (tt) => pad.l + ((tt - t0) / Math.max(0.001, t1 - t0)) * (W - pad.l - pad.r);
  const Y = (a) => pad.t + (1 - a / 180) * (H - pad.t - pad.b);
  // gridlines + labels
  ctx.strokeStyle = '#2a3340'; ctx.fillStyle = '#9aa7b5'; ctx.font = '11px sans-serif';
  ctx.lineWidth = 1;
  for (const a of [0, 45, 90, 135, 180]) {
    ctx.beginPath(); ctx.moveTo(pad.l, Y(a)); ctx.lineTo(W - pad.r, Y(a)); ctx.stroke();
    ctx.fillText(String(a) + '°', 6, Y(a) + 4);
  }
  // threshold lines for the primary angle
  const cfg = EXERCISES[exercise];
  ctx.setLineDash([5, 4]);
  for (const [thr, col] of [[cfg.topThr, '#4ade80'], [cfg.botThr, '#ffb454']]) {
    ctx.strokeStyle = col;
    ctx.beginPath(); ctx.moveTo(pad.l, Y(thr)); ctx.lineTo(W - pad.r, Y(thr)); ctx.stroke();
  }
  ctx.setLineDash([]);
  // rep bottom markers
  for (const r of analysis.reps) {
    ctx.fillStyle = '#c8f542';
    ctx.beginPath(); ctx.arc(X(r.bottomT), Y(r.minAngle), 4, 0, Math.PI * 2); ctx.fill();
  }
  // angle lines
  const lines = [
    ['knee', '#4ade80'], ['hip', '#ffb454'], ['elbow', '#7dd3fc'],
  ];
  for (const [key, col] of lines) {
    ctx.strokeStyle = col; ctx.lineWidth = key === cfg.primary ? 2.5 : 1.5;
    ctx.beginPath();
    let started = false;
    for (const p of s) {
      if (!Number.isFinite(p[key])) continue;
      if (!started) { ctx.moveTo(X(p.t), Y(p[key])); started = true; }
      else ctx.lineTo(X(p.t), Y(p[key]));
    }
    ctx.stroke();
  }
  ctx.fillStyle = '#9aa7b5';
  ctx.fillText('0s', pad.l, H - 6);
  ctx.fillText(t1.toFixed(1) + 's', W - pad.r - 30, H - 6);
  $('angleLegend').textContent = `— ${t('knee')}  — ${t('hip')}  — ${t('elbow')}   ·   ● ${lang === 'zh' ? '每组底部' : 'rep bottom'}   ·   - - ${lang === 'zh' ? '阈值' : 'thresholds'}`;
}

function drawBarPathChart() {
  const c = $('barPathChart'), ctx = c.getContext('2d');
  const W = c.width, H = c.height, pad = { l: 14, r: 14, t: 14, b: 14 };
  ctx.clearRect(0, 0, W, H);
  const pts = analysis.barPts;
  if (pts.length < 2) return;
  const xs = pts.map((p) => p.x), ys = pts.map((p) => p.y);
  let x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
  const padX = Math.max(0.02, (x1 - x0) * 0.2), padY = Math.max(0.02, (y1 - y0) * 0.2);
  x0 -= padX; x1 += padX; y0 -= padY; y1 += padY;
  const X = (x) => pad.l + ((x - x0) / (x1 - x0)) * (W - pad.l - pad.r);
  const Y = (y) => pad.t + ((y - y0) / (y1 - y0)) * (H - pad.t - pad.b);
  // vertical reference line at the start (lockout) x
  ctx.strokeStyle = '#2a3340'; ctx.setLineDash([5, 4]);
  ctx.beginPath(); ctx.moveTo(X(pts[0].x), pad.t); ctx.lineTo(X(pts[0].x), H - pad.b); ctx.stroke();
  ctx.setLineDash([]);
  // trail
  ctx.strokeStyle = '#c8f542'; ctx.lineWidth = 2;
  ctx.beginPath();
  pts.forEach((p, i) => { if (i === 0) ctx.moveTo(X(p.x), Y(p.y)); else ctx.lineTo(X(p.x), Y(p.y)); });
  ctx.stroke();
  // start / end dots
  ctx.fillStyle = '#4ade80';
  ctx.beginPath(); ctx.arc(X(pts[0].x), Y(pts[0].y), 5, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#ff6b6b';
  const last = pts[pts.length - 1];
  ctx.beginPath(); ctx.arc(X(last.x), Y(last.y), 5, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#9aa7b5'; ctx.font = '11px sans-serif';
  ctx.fillText(lang === 'zh' ? '● 起点' : '● start', pad.l, H - 4);
  ctx.fillText(lang === 'zh' ? '● 终点' : '● end', W - 70, H - 4);
}

// ---------------------------------------------------------------- skeleton drawing
function drawSkeleton(landmarks, opts = {}) {
  const { clear = true, bg = false } = opts;
  if (clear) octx.clearRect(0, 0, overlay.width, overlay.height);
  const W = overlay.width, H = overlay.height;
  if (bg) {
    octx.fillStyle = '#0b0e13';
    octx.fillRect(0, 0, W, H);
    octx.strokeStyle = '#1c2430';
    octx.beginPath(); octx.moveTo(0, H * 0.86); octx.lineTo(W, H * 0.86); octx.stroke();
  }
  if (!landmarks) return;
  const P = (lm) => ({ x: lm.x * W, y: lm.y * H });
  // bar path trail (demo + real)
  const pts = demoMode ? demoFrames : videoFrames;
  const curT = demoMode ? playback.demoT : videoEl.currentTime;
  if (pts && analysis) {
    const barKey = exercise === 'squat' ? 'sh' : 'wr';
    const barIdx = barKey === 'sh' ? LM.RIGHT_SHOULDER : LM.RIGHT_WRIST;
    octx.strokeStyle = 'rgba(200,245,66,0.55)';
    octx.lineWidth = 2;
    octx.beginPath();
    let started = false;
    for (const f of pts) {
      if (!f.landmarks || f.t > curT) continue;
      const p = P(f.landmarks[barIdx]);
      if (!started) { octx.moveTo(p.x, p.y); started = true; }
      else octx.lineTo(p.x, p.y);
    }
    octx.stroke();
  }
  // bones
  octx.strokeStyle = '#c8f542';
  octx.lineWidth = 3;
  octx.lineCap = 'round';
  for (const [a, b] of POSE_CONNECTIONS) {
    const pa = landmarks[a], pb = landmarks[b];
    if (!pa || !pb) continue;
    octx.beginPath();
    octx.moveTo(pa.x * W, pa.y * H);
    octx.lineTo(pb.x * W, pb.y * H);
    octx.stroke();
  }
  // joints
  octx.fillStyle = '#fff';
  for (const lm of landmarks) {
    octx.beginPath();
    octx.arc(lm.x * W, lm.y * H, 3.5, 0, Math.PI * 2);
    octx.fill();
  }
}

function landmarksAt(time, frames) {
  if (!frames) return null;
  let best = null;
  for (const f of frames) {
    if (f.t <= time && f.landmarks) best = f;
  }
  return best ? best.landmarks : null;
}

function updateReadout(landmarks, time) {
  if (!landmarks) { $('liveReadout').textContent = '—'; return; }
  if (!analysis) return;
  const row = analysis.angleSeries.reduce((best, p) => (!best || Math.abs(p.t - time) < Math.abs(best.t - time) ? p : best), null);
  if (!row) return;
  $('liveReadout').textContent =
    `${t('knee')} ${row.knee.toFixed(0)}° · ${t('hip')} ${row.hip.toFixed(0)}° · ${t('elbow')} ${row.elbow.toFixed(0)}° · ${time.toFixed(1)}s`;
}

// ---------------------------------------------------------------- playback
function startDemoPlayback() {
  cancelAnimationFrame(playback.raf);
  playback.playing = true;
  playback.demoT = 0;
  const dur = demoFrames[demoFrames.length - 1].t;
  const start = performance.now();
  const tick = (now) => {
    if (!playback.playing) return;
    const tSec = ((now - start) / 1000) % (dur + 0.8);
    playback.demoT = Math.min(tSec, dur);
    sizeOverlay();
    drawSkeleton(landmarksAt(playback.demoT, demoFrames), { bg: true });
    updateReadout(landmarksAt(playback.demoT, demoFrames), playback.demoT);
    playback.raf = requestAnimationFrame(tick);
  };
  playback.raf = requestAnimationFrame(tick);
  $('playBtn').innerHTML = `⏸️ <span>${t('pause')}</span>`;
}

$('playBtn').addEventListener('click', () => {
  if (demoMode && demoFrames) {
    if (playback.playing) {
      playback.playing = false;
      cancelAnimationFrame(playback.raf);
      $('playBtn').innerHTML = `▶️ <span>${t('play')}</span>`;
    } else {
      startDemoPlayback();
    }
    return;
  }
  if (!videoEl.src) return;
  if (videoEl.paused) {
    videoEl.play();
    $('playBtn').innerHTML = `⏸️ <span>${t('pause')}</span>`;
    const loop = () => {
      if (videoEl.paused) return;
      drawSkeleton(landmarksAt(videoEl.currentTime, videoFrames));
      updateReadout(landmarksAt(videoEl.currentTime, videoFrames), videoEl.currentTime);
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  } else {
    videoEl.pause();
    $('playBtn').innerHTML = `▶️ <span>${t('play')}</span>`;
  }
});
videoEl.addEventListener('pause', () => {
  if (!demoMode) $('playBtn').innerHTML = `▶️ <span>${t('play')}</span>`;
});

// ---------------------------------------------------------------- Gemini coaching
$('geminiBtn').addEventListener('click', async () => {
  if (!analysis) return;
  const key = localStorage.getItem(KEY_STORAGE);
  if (!key) {
    $('geminiText').textContent = t('needKey');
    $('settingsModal').classList.remove('hidden');
    return;
  }
  $('geminiBtn').disabled = true;
  $('geminiText').textContent = t('geminiLoading');
  const failed = analysis.checks.filter((c) => !c.pass).map((c) => `${c.label}: ${c.value} (${c.severity})`).join('; ') || 'none';
  const prompt = `You are a strength coach. A lifter's ${exercise} form was measured by on-device pose estimation (NOT by watching a video). Measured numbers:\n` +
    `- Reps: ${analysis.reps.length}, score ${analysis.score}/10\n` +
    `- Failed checks: ${failed}\n` +
    `- Passed checks: ${analysis.checks.filter((c) => c.pass).map((c) => c.label).join(', ')}\n` +
    `- Per rep (min angle, lowering s, lifting s): ${analysis.repMetrics.map((r, i) => `#${i + 1}: ${r.minPrimary.toFixed(0)}deg, ${r.eccSec.toFixed(1)}s down, ${r.conSec.toFixed(1)}s up`).join(' | ')}\n` +
    `Give 3-5 short concrete coaching cues in plain language, one per failed check, plus one thing they did well. Under 150 words. No medical advice, no injury diagnosis. Reply in ${lang === 'zh' ? 'Chinese' : 'English'}.`;
  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(key)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
    });
    const data = await res.json();
    if (!res.ok) {
      $('geminiText').textContent = res.status === 400 || res.status === 403
        ? t('geminiBadKey')
        : t('geminiError') + (data?.error?.message || res.status);
      return;
    }
    const text = data?.candidates?.[0]?.content?.parts?.map((p) => p.text).join('') || '';
    $('geminiText').textContent = text || (lang === 'zh' ? '没有返回内容。' : 'No text returned.');
  } catch (e) {
    $('geminiText').textContent = t('geminiError') + e.message;
  } finally {
    $('geminiBtn').disabled = false;
  }
});

// ---------------------------------------------------------------- export
$('exportBtn').addEventListener('click', () => {
  if (!analysis) return;
  const payload = {
    app: 'FormCheck', exercise, generatedAt: new Date().toISOString(),
    demo: demoMode,
    score: analysis.score,
    reps: analysis.reps.length,
    repMetrics: analysis.repMetrics,
    checks: analysis.checks,
    driftXpct: analysis.driftX, driftYpct: analysis.driftY,
    angleSeries: analysis.angleSeries,
    barPts: analysis.barPts,
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `formcheck-${exercise}-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
});

// ---------------------------------------------------------------- helpers
function setStatus(msg, kind = '') {
  const el = $('statusText');
  el.textContent = msg;
  el.className = 'status' + (kind ? ' ' + kind : '');
}
function showProgress(pct, text) {
  $('progressWrap').classList.remove('hidden');
  $('progressFill').style.width = pct + '%';
  $('progressText').textContent = text;
}
function hideProgress() {
  $('progressWrap').classList.add('hidden');
}

// Debug hook for automated testing / screenshots.
window.__formcheck = {
  get analysis() { return analysis; },
  get trackingStats() { return trackingStats; },
  get exercise() { return exercise; },
  get demoMode() { return demoMode; },
  runDemo: (ex) => {
    if (ex) { document.querySelector(`.ex-card[data-ex="${ex}"]`).click(); }
    $('demoBtn').click();
    return analysis;
  },
};

applyI18n();
renderEmpty();
sizeOverlay();
