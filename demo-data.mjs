// demo-data.mjs — procedural sample lifts for demo mode.
// Generates MediaPipe-format 33-landmark frames (normalized x/y) from a small
// 2D kinematic model, so the demo runs without a video or a Gemini key.
// The numbers are computed by the same analysis pipeline as real video, so
// the demo shows real (if synthetic) measurements. Every demo is visibly
// labelled "SAMPLE DATA" in the UI.
// Proportions are realistic (figure ~0.61 of frame height); the side view
// faces right for squat/deadlift; bench lies head-left, feet-right.

function mulberry32(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Two-link IK: joint position given endpoints a, b and segment lengths.
// pick: 'x+' (larger x, e.g. knee forward) or 'y+' (larger y, e.g. elbow down).
function ik2(ax, ay, bx, by, L1, L2, pick) {
  let dx = bx - ax, dy = by - ay;
  let d = Math.hypot(dx, dy);
  d = Math.min(Math.max(d, Math.abs(L1 - L2) + 1e-4), L1 + L2 - 1e-4);
  const ux = dx / Math.hypot(dx, dy), uy = dy / Math.hypot(dx, dy);
  const a = (L1 * L1 - L2 * L2 + d * d) / (2 * d);
  const h = Math.sqrt(Math.max(0, L1 * L1 - a * a));
  const px = ax + a * ux, py = ay + a * uy;
  const nx = -uy, ny = ux;
  const k1 = { x: px + h * nx, y: py + h * ny };
  const k2 = { x: px - h * nx, y: py - h * ny };
  if (pick === 'y+') return k1.y > k2.y ? k1 : k2;
  return k1.x > k2.x ? k1 : k2;
}

const lerp = (a, b, t) => a + (b - a) * t;
// Smooth 0->1->0 rep profile (cosine ease).
function repProfile(phase) {
  return 0.5 - 0.5 * Math.cos(phase * Math.PI * 2);
}

// Build the 33 MediaPipe landmarks from named near-side joints.
// Far (left) side mirrors the near (right) side with a small offset,
// as in a real side-view capture. Head is derived from the shoulder.
function buildLandmarks(j) {
  const lm = Array.from({ length: 33 }, () => ({ x: 0, y: 0, z: 0, visibility: 0.99 }));
  const set = (i, p, z = 0) => { lm[i] = { x: p.x, y: p.y, z, visibility: 0.99 }; };
  const off = { x: -0.012, y: 0.006 };
  // Right (near) side.
  set(12, j.shoulder); set(14, j.elbow); set(16, j.wrist);
  set(24, j.hip); set(26, j.knee); set(28, j.ankle);
  set(30, j.heel); set(32, j.foot);
  // Left (far) side — same joints, slight offset.
  set(11, { x: j.shoulder.x + off.x, y: j.shoulder.y + off.y });
  set(13, { x: j.elbow.x + off.x, y: j.elbow.y + off.y });
  set(15, { x: j.wrist.x + off.x, y: j.wrist.y + off.y });
  set(23, { x: j.hip.x + off.x, y: j.hip.y + off.y });
  set(25, { x: j.knee.x + off.x, y: j.knee.y + off.y });
  set(27, { x: j.ankle.x + off.x, y: j.ankle.y + off.y });
  set(29, { x: j.heel.x + off.x, y: j.heel.y + off.y });
  set(31, { x: j.foot.x + off.x, y: j.foot.y + off.y });
  // Head (nose/eyes/ears) from the shoulder and facing direction.
  const hx = j.headDir.x, hy = j.headDir.y;
  const nose = { x: j.shoulder.x + hx * 0.055, y: j.shoulder.y + hy * 0.055 };
  set(0, nose);
  set(7, { x: j.shoulder.x + hx * 0.015, y: j.shoulder.y + hy * 0.045 });
  set(8, { x: j.shoulder.x + hx * 0.03, y: j.shoulder.y + hy * 0.04 });
  set(2, { x: nose.x - hy * 0.012, y: nose.y + hx * 0.012 });
  set(5, { x: nose.x + hy * 0.012, y: nose.y - hx * 0.012 });
  set(1, { x: nose.x - hy * 0.02, y: nose.y + hx * 0.02 });
  set(4, { x: nose.x + hy * 0.02, y: nose.y - hx * 0.02 });
  set(3, { x: nose.x - hy * 0.028, y: nose.y + hx * 0.028 });
  set(6, { x: nose.x + hy * 0.028, y: nose.y - hx * 0.028 });
  set(9, { x: nose.x - hy * 0.018, y: nose.y + hx * 0.018 + 0.012 });
  set(10, { x: nose.x + hy * 0.018, y: nose.y - hx * 0.018 + 0.012 });
  // Hands (fingers near the wrist).
  set(17, { x: j.wrist.x - 0.008, y: j.wrist.y + 0.008 });
  set(18, { x: j.wrist.x + 0.008, y: j.wrist.y + 0.008 });
  set(19, { x: j.wrist.x - 0.004, y: j.wrist.y + 0.012 });
  set(20, { x: j.wrist.x + 0.004, y: j.wrist.y + 0.012 });
  set(21, { x: j.wrist.x - 0.01, y: j.wrist.y });
  set(22, { x: j.wrist.x + 0.01, y: j.wrist.y });
  // Uniform 1.3x scale about the frame centre so the figure fills a 16:9
  // stage. A similarity transform preserves every angle and every
  // drift-as-%-of-torso ratio, so the analysis numbers are unchanged.
  for (const p of lm) {
    p.x = Math.min(0.98, Math.max(0.02, 0.5 + (p.x - 0.5) * 1.3));
    p.y = Math.min(0.98, Math.max(0.02, 0.5 + (p.y - 0.5) * 1.3));
  }
  return lm;
}

const FPS = 15;
const SEG = { torso: 0.20, thigh: 0.17, shank: 0.17, upperArm: 0.16, forearm: 0.15 };

function framesFrom(poseAt, durationSec, seed = 7) {
  const rand = mulberry32(seed);
  const frames = [];
  const n = Math.round(durationSec * FPS);
  for (let i = 0; i < n; i++) {
    const t = i / FPS;
    const j = poseAt(t, durationSec);
    // Tiny organic noise so the signal is not perfectly clean.
    const lm = buildLandmarks(j).map((p) => ({
      ...p,
      x: p.x + (rand() - 0.5) * 0.002,
      y: p.y + (rand() - 0.5) * 0.002,
    }));
    frames.push({ t, landmarks: lm });
  }
  return { fps: FPS, frames };
}

// ---- Squat (side view, facing right). Rep 1 deep, rep 2 shallow. ----
function squatPose(t, dur) {
  const repDur = dur / 2;
  const rep = Math.floor(t / repDur);
  const phase = (t % repDur) / repDur; // 0..1 within the rep
  const s = repProfile(phase); // 0 top -> 1 bottom -> 0 top
  const deep = rep === 0;
  const hipStand = { x: 0.50, y: 0.46 };
  const hipBottom = deep ? { x: 0.42, y: 0.68 } : { x: 0.44, y: 0.60 };
  const hip = { x: lerp(hipStand.x, hipBottom.x, s), y: lerp(hipStand.y, hipBottom.y, s) };
  const ankle = { x: 0.50, y: 0.80 };
  const knee = ik2(hip.x, hip.y, ankle.x, ankle.y, SEG.thigh, SEG.shank, 'x+');
  const lean = lerp(6, deep ? 30 : 24, s) * (Math.PI / 180);
  const shoulder = { x: hip.x + Math.sin(lean) * SEG.torso, y: hip.y - Math.cos(lean) * SEG.torso };
  const elbow = { x: shoulder.x - 0.03, y: shoulder.y + 0.09 };
  const wrist = { x: shoulder.x - 0.055, y: shoulder.y + 0.015 };
  return {
    shoulder, elbow, wrist, hip, knee, ankle,
    heel: { x: 0.485, y: 0.812 }, foot: { x: 0.575, y: 0.818 },
    headDir: { x: 0.7, y: -0.7 },
  };
}

// ---- Bench press (lying, head left, feet right). Rep 1 full, rep 2 shallow,
// with a forward bar drift on the way up (built-in bar-path issue). ----
function benchPose(t, dur) {
  const repDur = dur / 2;
  const rep = Math.floor(t / repDur);
  const phase = (t % repDur) / repDur;
  const s = repProfile(phase); // 0 lockout -> 1 bottom -> 0 lockout
  const full = rep === 0;
  const shoulder = { x: 0.40, y: 0.52 };
  // Bar (wrist): top (0.40, 0.205), bottom full (0.46, 0.50), bottom shallow (0.44, 0.38).
  const top = { x: 0.40, y: 0.205 };
  const bottom = full ? { x: 0.46, y: 0.50 } : { x: 0.44, y: 0.38 };
  // On the way up (phase > 0.5) the bar drifts forward toward the feet.
  const drift = phase > 0.5 ? (phase - 0.5) * 2 * 0.03 : 0;
  const wrist = { x: lerp(top.x, bottom.x, s) + drift, y: lerp(top.y, bottom.y, s) };
  const elbow = ik2(shoulder.x, shoulder.y, wrist.x, wrist.y, SEG.upperArm, SEG.forearm, 'y+');
  const hip = { x: 0.58, y: 0.55 };
  const knee = { x: 0.68, y: 0.62 };
  const ankle = { x: 0.72, y: 0.80 };
  return {
    shoulder, elbow, wrist, hip, knee, ankle,
    heel: { x: 0.70, y: 0.812 }, foot: { x: 0.78, y: 0.818 },
    headDir: { x: -0.9, y: -0.45 },
  };
}

// ---- Deadlift (side view, facing right). Rep 1 has a hip-shoot
// (hips rise before the shoulders); rep 2 is clean. ----
function deadliftPose(t, dur) {
  const repDur = dur / 2;
  const rep = Math.floor(t / repDur);
  const phase = (t % repDur) / repDur;
  const s = repProfile(phase); // 0 lockout -> 1 setup -> 0 lockout
  const hipStand = { x: 0.50, y: 0.46 };
  const hipSetup = { x: 0.42, y: 0.64 };
  // Hip-shoot on rep 1: hips extend 0.22 of the rep ahead of the shoulders.
  let sHip = s, sSh = s;
  if (rep === 0 && phase > 0.5) {
    const up = (phase - 0.5) * 2; // 0..1 concentric
    sHip = 1 - Math.min(1, up * 1.35 + 0.12);
    sSh = 1 - up;
    sHip = Math.max(0, Math.min(1, sHip));
  }
  const hip = { x: lerp(hipStand.x, hipSetup.x, sHip), y: lerp(hipStand.y, hipSetup.y, sHip) };
  // Rep 1 hip-shoot: the torso tips FORWARD (+10 deg lean bump) in the first
  // half of the concentric while the hips are already rising.
  let leanDeg = lerp(3, 32, sSh);
  if (rep === 0 && phase > 0.5) {
    const up = (phase - 0.5) * 2;
    if (up < 0.7) leanDeg += 18 * Math.sin((Math.PI * up) / 0.7);
  }
  const lean = leanDeg * (Math.PI / 180);
  const shoulder = { x: hip.x + Math.sin(lean) * SEG.torso, y: hip.y - Math.cos(lean) * SEG.torso };
  const ankle = { x: 0.50, y: 0.80 };
  const knee = ik2(hip.x, hip.y, ankle.x, ankle.y, SEG.thigh, SEG.shank, 'x+');
  // Arms hang straight down from the shoulders to the bar.
  const barX = 0.56;
  const wrist = { x: barX + (shoulder.x - 0.55) * 0.2, y: shoulder.y + 0.24 };
  const elbow = { x: (shoulder.x + wrist.x) / 2 + 0.01, y: (shoulder.y + wrist.y) / 2 };
  return {
    shoulder, elbow, wrist, hip, knee, ankle,
    heel: { x: 0.485, y: 0.812 }, foot: { x: 0.575, y: 0.818 },
    headDir: { x: 0.7, y: -0.7 },
  };
}

export function getDemoData(exercise) {
  if (exercise === 'squat') return { exercise, ...framesFrom(squatPose, 5.2, 11) };
  if (exercise === 'bench') return { exercise, ...framesFrom(benchPose, 5.6, 23) };
  return { exercise, ...framesFrom(deadliftPose, 6.0, 37) };
}
