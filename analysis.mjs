// analysis.mjs — pure biomechanics math. No DOM, no network, no MediaPipe.
// Imported by app.js (browser) and by the Node test harness.
// Methodology references (approach only — all code below is original):
//  - FormRate.AI (Eyal Prihar) — 6-category scoring, bar path as horizontal
//    wrist drift, prominence-based rep detection, 5th-percentile robust depth.
//    License: all rights reserved — no code reused, thresholds re-derived here.
//  - elite-coach form-correction skill — 5 fps sampling, key frames, spineLean
//    defined as 0 deg upright / 90 deg horizontal.
//  - Cheung, "AI Personal Trainer" — joint angles (not raw coordinates) as the
//    features that describe form quality.
//  - Squats-angle-detection (Pradnya1208, MIT) — three-point angle via atan2.

export const LM = {
  NOSE: 0, LEFT_EYE_INNER: 1, LEFT_EYE: 2, LEFT_EYE_OUTER: 3,
  RIGHT_EYE_INNER: 4, RIGHT_EYE: 5, RIGHT_EYE_OUTER: 6,
  LEFT_EAR: 7, RIGHT_EAR: 8, MOUTH_LEFT: 9, MOUTH_RIGHT: 10,
  LEFT_SHOULDER: 11, RIGHT_SHOULDER: 12, LEFT_ELBOW: 13, RIGHT_ELBOW: 14,
  LEFT_WRIST: 15, RIGHT_WRIST: 16, LEFT_PINKY: 17, RIGHT_PINKY: 18,
  LEFT_INDEX: 19, RIGHT_INDEX: 20, LEFT_THUMB: 21, RIGHT_THUMB: 22,
  LEFT_HIP: 23, RIGHT_HIP: 24, LEFT_KNEE: 25, RIGHT_KNEE: 26,
  LEFT_ANKLE: 27, RIGHT_ANKLE: 28, LEFT_HEEL: 29, RIGHT_HEEL: 30,
  LEFT_FOOT_INDEX: 31, RIGHT_FOOT_INDEX: 32,
};

export const POSE_CONNECTIONS = [
  [0, 1], [1, 2], [2, 3], [3, 7], [0, 4], [4, 5], [5, 6], [6, 8],
  [9, 10], [11, 12], [11, 13], [13, 15], [15, 17], [15, 19], [15, 21],
  [17, 19], [12, 14], [14, 16], [16, 18], [16, 20], [16, 22], [18, 20],
  [11, 23], [12, 24], [23, 24], [23, 25], [24, 26], [25, 27], [26, 28],
  [27, 29], [28, 30], [29, 31], [30, 32], [27, 31], [28, 32],
];

export function clamp(v, lo, hi) { return Math.min(hi, Math.max(lo, v)); }
export function midpoint(a, b) { return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }; }
export function dist(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }

// Angle at vertex b formed by points a-b-c, in degrees, 0..180.
// (Equivalent to the atan2 formulation used in the MIT squat-angle repo.)
export function angle3(a, b, c) {
  const v1x = a.x - b.x, v1y = a.y - b.y;
  const v2x = c.x - b.x, v2y = c.y - b.y;
  const m1 = Math.hypot(v1x, v1y), m2 = Math.hypot(v2x, v2y);
  if (m1 < 1e-6 || m2 < 1e-6) return 180;
  const cos = clamp((v1x * v2x + v1y * v2y) / (m1 * m2), -1, 1);
  return (Math.acos(cos) * 180) / Math.PI;
}

// Torso lean from vertical, 0 deg = upright, 90 deg = horizontal
// (same convention as the elite-coach pose analyzer's spineLean).
export function spineLean(shoulder, hip) {
  const dx = shoulder.x - hip.x;
  const dy = -(shoulder.y - hip.y); // up is -y in image coords
  return Math.abs((Math.atan2(dx, dy) * 180) / Math.PI);
}

export function percentile(sortedAsc, p) {
  if (!sortedAsc.length) return NaN;
  const i = clamp(Math.ceil((p / 100) * sortedAsc.length) - 1, 0, sortedAsc.length - 1);
  return sortedAsc[i];
}

export function movingAverage(values, window = 3) {
  const half = Math.floor(window / 2);
  return values.map((_, i) => {
    let s = 0, n = 0;
    for (let j = i - half; j <= i + half; j++) {
      if (j >= 0 && j < values.length && Number.isFinite(values[j])) { s += values[j]; n++; }
    }
    return n ? s / n : NaN;
  });
}

function mean(xs) { const v = xs.filter(Number.isFinite); return v.length ? v.reduce((a, b) => a + b, 0) / v.length : NaN; }
function std(xs) {
  const v = xs.filter(Number.isFinite);
  if (v.length < 2) return 0;
  const m = mean(v);
  return Math.sqrt(v.reduce((a, b) => a + (b - m) ** 2, 0) / v.length);
}

// Per-frame metrics from one set of 33 MediaPipe landmarks (normalized x/y).
export function frameMetrics(lm) {
  const sh = midpoint(lm[LM.LEFT_SHOULDER], lm[LM.RIGHT_SHOULDER]);
  const el = midpoint(lm[LM.LEFT_ELBOW], lm[LM.RIGHT_ELBOW]);
  const wr = midpoint(lm[LM.LEFT_WRIST], lm[LM.RIGHT_WRIST]);
  const hp = midpoint(lm[LM.LEFT_HIP], lm[LM.RIGHT_HIP]);
  const kn = midpoint(lm[LM.LEFT_KNEE], lm[LM.RIGHT_KNEE]);
  const an = midpoint(lm[LM.LEFT_ANKLE], lm[LM.RIGHT_ANKLE]);
  const kneeAngle = angle3(hp, kn, an);
  const hipAngle = angle3(sh, hp, kn);
  const elbowAngle = angle3(sh, el, wr);
  const shoulderAngle = angle3(hp, sh, el);
  return {
    kneeAngle, hipAngle, elbowAngle, shoulderAngle,
    kneeAngleL: angle3(lm[LM.LEFT_HIP], lm[LM.LEFT_KNEE], lm[LM.LEFT_ANKLE]),
    kneeAngleR: angle3(lm[LM.RIGHT_HIP], lm[LM.RIGHT_KNEE], lm[LM.RIGHT_ANKLE]),
    hipAngleL: angle3(lm[LM.LEFT_SHOULDER], lm[LM.LEFT_HIP], lm[LM.LEFT_KNEE]),
    hipAngleR: angle3(lm[LM.RIGHT_SHOULDER], lm[LM.RIGHT_HIP], lm[LM.RIGHT_KNEE]),
    elbowAngleL: angle3(lm[LM.LEFT_SHOULDER], lm[LM.LEFT_ELBOW], lm[LM.LEFT_WRIST]),
    elbowAngleR: angle3(lm[LM.RIGHT_SHOULDER], lm[LM.RIGHT_ELBOW], lm[LM.RIGHT_WRIST]),
    spineLean: spineLean(sh, hp),
    torsoLen: dist(sh, hp),
    bar: null, // filled in by analyzeFrames (depends on exercise)
    sh, el, wr, hp, kn, an,
  };
}

export const EXERCISES = {
  squat: {
    primary: 'kneeAngle', topThr: 155, botThr: 118, minRepSec: 0.6,
    barPoint: 'shoulder', // bar sits on the traps
  },
  bench: {
    primary: 'elbowAngle', topThr: 150, botThr: 118, minRepSec: 0.5,
    barPoint: 'wrist', // bar is in the hands
  },
  deadlift: {
    primary: 'hipAngle', topThr: 160, botThr: 115, minRepSec: 0.6,
    barPoint: 'wrist', // bar is in the hands
  },
};

// State-machine rep segmentation on the smoothed primary angle.
// A rep = primary angle drops below botThr, then rises back above topThr.
// repStart is the last time the angle was above topThr before the descent,
// so eccSec measures the FULL lowering phase (not just from the threshold).
export function segmentReps(series, cfg) {
  // series: [{ t, v }] sorted by t, v = smoothed primary angle
  const reps = [];
  let state = 'up';
  let lastTopT = null;
  let repStart = null, repMin = Infinity, repMinT = null;
  for (const p of series) {
    if (!Number.isFinite(p.v)) continue;
    if (state === 'up') {
      if (p.v > cfg.topThr) lastTopT = p.t;
      if (p.v < cfg.botThr) {
        state = 'down'; repStart = lastTopT ?? p.t; repMin = p.v; repMinT = p.t;
      }
    } else if (state === 'down') {
      if (p.v < repMin) { repMin = p.v; repMinT = p.t; }
      if (p.v > cfg.topThr) {
        const dur = p.t - repStart;
        if (dur >= cfg.minRepSec) {
          reps.push({ startT: repStart, bottomT: repMinT, endT: p.t, minAngle: repMin, eccSec: repMinT - repStart, conSec: p.t - repMinT });
        }
        state = 'up'; repStart = null;
      }
    }
  }
  return reps;
}

// Main entry: frames = [{ t, landmarks: [{x,y,z,visibility} x33] | null }]
// Returns a full analysis object (numbers only — no prose).
export function analyzeFrames(frames, exercise) {
  const cfg = EXERCISES[exercise];
  const detected = frames.filter((f) => f.landmarks);
  const total = frames.length;
  const detectedCount = detected.length;

  // Per-frame metrics (smoothed angles, window 3).
  const rows = detected.map((f) => ({ t: f.t, m: frameMetrics(f.landmarks), landmarks: f.landmarks }));
  const keys = ['kneeAngle', 'hipAngle', 'elbowAngle', 'shoulderAngle', 'spineLean', 'kneeAngleL', 'kneeAngleR', 'hipAngleL', 'hipAngleR', 'elbowAngleL', 'elbowAngleR'];
  for (const k of keys) {
    const sm = movingAverage(rows.map((r) => r.m[k]), 3);
    rows.forEach((r, i) => { r.m[k] = sm[i]; });
  }
  // Bar point depends on exercise.
  rows.forEach((r) => { r.m.bar = cfg.barPoint === 'shoulder' ? r.m.sh : r.m.wr; });

  const torsoLen = percentile(rows.map((r) => r.m.torsoLen).filter(Number.isFinite).sort((a, b) => a - b), 50) || 0.2;
  const primarySeries = rows.map((r) => ({ t: r.t, v: r.m[cfg.primary] }));
  const reps = segmentReps(primarySeries, cfg);

  // Bar path over the whole set.
  const barPts = rows.map((r) => ({ t: r.t, x: r.m.bar.x, y: r.m.bar.y }));
  const barXs = barPts.map((p) => p.x), barYs = barPts.map((p) => p.y);
  // Bar-path drift: lockout-to-lockout. A good lift returns the bar to the
  // same vertical line each rep; a drifting bar walks forward rep by rep.
  // (The raw horizontal range would penalise the normal J-curve of a bench
  // press, so it is NOT used as the drift metric.)
  const barAt = (t) => {
    let best = rows[0];
    for (const r of rows) if (Math.abs(r.t - t) < Math.abs(best.t - t)) best = r;
    return best ? best.m.bar : null;
  };
  let driftX = 0;
  for (const rep of reps) {
    const b0 = barAt(rep.startT), b1 = barAt(rep.endT);
    if (b0 && b1) driftX = Math.max(driftX, Math.abs(b1.x - b0.x) / torsoLen * 100);
  }
  const driftY = (Math.max(...barYs) - Math.min(...barYs)) / torsoLen * 100; // vertical range (info only)

  // Per-rep metrics.
  const repMetrics = reps.map((rep) => {
    const inRep = rows.filter((r) => r.t >= rep.startT && r.t <= rep.endT);
    const atBottom = rows.reduce((best, r) => (!best || Math.abs(r.t - rep.bottomT) < Math.abs(best.t - rep.bottomT) ? r : best), null);
    const m = atBottom ? atBottom.m : null;
    return {
      ...rep,
      minPrimary: rep.minAngle,
      bottom: m ? {
        kneeAngle: m.kneeAngle, hipAngle: m.hipAngle, elbowAngle: m.elbowAngle,
        spineLean: m.spineLean, hipY: m.hp.y, kneeY: m.kn.y,
        kneeAngleL: m.kneeAngleL, kneeAngleR: m.kneeAngleR,
        elbowAngleL: m.elbowAngleL, elbowAngleR: m.elbowAngleR,
        hipAngleL: m.hipAngleL, hipAngleR: m.hipAngleR,
        barX: m.bar.x, barY: m.bar.y, wristY: m.wr.y,
        shoulderY: m.sh.y, hipAngleMean: m.hipAngle,
      } : null,
      maxPrimary: Math.max(...inRep.map((r) => r.m[cfg.primary])),
    };
  });

  const checks = buildChecks(exercise, rows, reps, repMetrics, { torsoLen, driftX, driftY, barPts, primary: cfg.primary, globalMaxPrimary: Math.max(...rows.map((r) => r.m[cfg.primary])) });

  let score = 10;
  for (const c of checks) if (!c.pass) score -= c.severity === 'major' ? 1.5 : 0.75;
  score = Math.max(0, Math.round(score * 10) / 10);

  return {
    exercise, totalFrames: total, detectedFrames: detectedCount,
    detectionRate: total ? detectedCount / total : 0,
    durationSec: total ? frames[total - 1].t : 0,
    torsoLen, reps, repMetrics, driftX, driftY, barPts,
    angleSeries: rows.map((r) => ({
      t: r.t, knee: r.m.kneeAngle, hip: r.m.hipAngle, elbow: r.m.elbowAngle,
      spineLean: r.m.spineLean,
    })),
    checks, score,
    issues: checks.filter((c) => !c.pass),
  };
}

function checkResult(id, label, valueText, pass, severity, fixKey) {
  return { id, label, value: valueText, pass, severity, fixKey };
}

function buildChecks(exercise, rows, reps, repMetrics, ctx) {
  const { torsoLen, driftX } = ctx;
  const checks = [];
  if (!reps.length) {
    checks.push(checkResult('noreps', 'Reps detected', '0', false, 'major', 'noreps'));
    return checks;
  }
  const bottoms = repMetrics.map((r) => r.bottom).filter(Boolean);
  const minPrimary = Math.min(...repMetrics.map((r) => r.minPrimary));
  const maxPrimary = Math.max(...repMetrics.map((r) => r.maxPrimary));

  if (exercise === 'squat') {
    // Depth: hip below knee at the bottom of each rep.
    const deepReps = bottoms.filter((b) => b.hipY > b.kneeY).length;
    const depthOk = deepReps === bottoms.length;
    const shallowWorst = bottoms.length - deepReps;
    checks.push(checkResult('depth', 'Squat depth (hip below knee)', `${deepReps}/${bottoms.length} reps`, depthOk, shallowWorst ? 'major' : 'minor', 'squatDepth'));
    // Torso lean at bottom.
    const maxLean = Math.max(...bottoms.map((b) => b.spineLean));
    checks.push(checkResult('lean', 'Torso lean at bottom', `${maxLean.toFixed(0)}°`, maxLean <= 40, maxLean > 55 ? 'major' : 'minor', 'torsoLean'));
    // Bar path drift.
    checks.push(checkResult('drift', 'Bar path horizontal drift', `${driftX.toFixed(0)}% torso`, driftX <= 8, driftX > 15 ? 'major' : 'minor', 'barDrift'));
    // Left/right symmetry at bottom (knee angles).
    const sym = Math.max(...bottoms.map((b) => Math.abs(b.kneeAngleL - b.kneeAngleR)));
    checks.push(checkResult('symmetry', 'Left/right knee symmetry', `${sym.toFixed(0)}° diff`, sym <= 10, sym > 18 ? 'major' : 'minor', 'symmetry'));
    // Tempo: eccentric (lowering) time.
    const ecc = mean(repMetrics.map((r) => r.eccSec));
    checks.push(checkResult('tempo', 'Lowering tempo', `${ecc.toFixed(1)}s down`, ecc >= 1.0, ecc < 0.6 ? 'major' : 'minor', 'tempo'));
  }

  if (exercise === 'bench') {
    // Depth: 2D elbow angle at the bottom, calibrated for a SIDE-VIEW camera.
    // In a side view the projected elbow angle is small at the bottom (the arm
    // folds in the plane facing the camera), so the thresholds are NOT the
    // 65-95 deg 3D values in the literature — they are side-view 2D values:
    // full touch <= 45 deg, shallow 45-70 deg, very shallow > 70 deg.
    // (Verified against the built-in demo data; see demo-data.mjs.)
    const shallow = bottoms.filter((b) => b.elbowAngle > 45).length;
    checks.push(checkResult('depth', 'Elbow angle at bottom (side view)', `${minPrimary.toFixed(0)}° min`, minPrimary <= 45, minPrimary > 70 ? 'major' : 'minor', 'benchDepth'));
    // Lockout: full elbow extension — measured as the max elbow angle over
    // the WHOLE set (the rep window ends as soon as the angle crosses the
    // top threshold, so a per-rep max would under-read the lockout).
    checks.push(checkResult('lockout', 'Elbow lockout at top', `${ctx.globalMaxPrimary.toFixed(0)}° max`, ctx.globalMaxPrimary >= 160, 'minor', 'lockout'));
    // Bar path drift.
    checks.push(checkResult('drift', 'Bar path horizontal drift', `${driftX.toFixed(0)}% torso`, driftX <= 8, driftX > 15 ? 'major' : 'minor', 'barDrift'));
    // Symmetry at bottom (elbows).
    const sym = Math.max(...bottoms.map((b) => Math.abs(b.elbowAngleL - b.elbowAngleR)));
    checks.push(checkResult('symmetry', 'Left/right elbow symmetry', `${sym.toFixed(0)}° diff`, sym <= 10, sym > 18 ? 'major' : 'minor', 'symmetry'));
    // Tempo: controlled lowering.
    const ecc = mean(repMetrics.map((r) => r.eccSec));
    checks.push(checkResult('tempo', 'Lowering tempo', `${ecc.toFixed(1)}s down`, ecc >= 1.0, ecc < 0.6 ? 'major' : 'minor', 'tempo'));
  }

  if (exercise === 'deadlift') {
    // Lockout: full hip extension (FormRate / Escamilla 2002: 165-185 deg;
    // 160 deg is the practical full-extension floor for a side-view 2D read).
    // Measured over the whole set (see the bench lockout note).
    checks.push(checkResult('lockout', 'Hip lockout at top', `${ctx.globalMaxPrimary.toFixed(0)}° max`, ctx.globalMaxPrimary >= 160, 'minor', 'lockout'));
    // Hip shoot: in a good pull the torso angle (lean) falls steadily from
    // setup to lockout. If the hips shoot up first, the back tips forward
    // and the lean INCREASES during the early concentric. Measured as the
    // max lean between the bottom and lockout minus the lean at the bottom.
    let worstRise = 0;
    for (const rep of reps) {
      const inRep = rows.filter((r) => r.t >= rep.bottomT && r.t <= rep.endT);
      if (inRep.length < 3) continue;
      const bottomRow = rows.reduce((best, r) => (!best || Math.abs(r.t - rep.bottomT) < Math.abs(best.t - rep.bottomT) ? r : best), null);
      const leanBottom = bottomRow ? bottomRow.m.spineLean : 0;
      const leanMax = Math.max(...inRep.map((r) => r.m.spineLean));
      worstRise = Math.max(worstRise, leanMax - leanBottom);
    }
    checks.push(checkResult('hipshoot', 'Hips & shoulders rising together', `+${worstRise.toFixed(0)}° lean`, worstRise <= 6, worstRise > 12 ? 'major' : 'minor', 'hipShoot'));
    // Setup: torso lean at the bottom should be a hinge (20-45 deg from
    // vertical), not a squat (<20 deg, hips too low) or a stiff-leg pull.
    const setupLeans = bottoms.map((b) => b.spineLean);
    const setupLean = Math.min(...setupLeans);
    const setupOk = setupLean >= 20 && setupLean <= 45;
    checks.push(checkResult('setup', 'Setup torso angle', `${setupLean.toFixed(0)}° lean`, setupOk, 'minor', 'deadliftSetup'));
    // Bar path drift.
    checks.push(checkResult('drift', 'Bar path horizontal drift', `${driftX.toFixed(0)}% torso`, driftX <= 8, driftX > 15 ? 'major' : 'minor', 'barDrift'));
    // Symmetry at lockout (hips).
    const sym = Math.max(...repMetrics.map((r) => Math.abs((r.bottom?.hipAngleL ?? 0) - (r.bottom?.hipAngleR ?? 0))));
    checks.push(checkResult('symmetry', 'Left/right hip symmetry', `${sym.toFixed(0)}° diff`, sym <= 10, sym > 18 ? 'major' : 'minor', 'symmetry'));
  }

  return checks;
}
