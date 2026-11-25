# FormCheck — AI Form Analysis for Lifters Who Train Alone

**SLAY HACKS 2026 entry** · Devpost open-theme AI hackathon

> Most people who lift train alone, with no coach watching. Bad form is invisible
> to them — until it becomes an injury. FormCheck films a lift, measures it with
> real biomechanics, and tells you exactly what to fix.

## What it does

Upload a video of a **squat, bench press, or deadlift**. FormCheck runs
**on-device pose estimation** (MediaPipe Pose, in the browser — your video never
leaves your device), extracts 33 body keypoints frame by frame, and **computes
real numbers**:

- **Joint angles** — knee, hip, elbow, shoulder, plus torso lean, every frame
- **Bar path** — the bar's trajectory, tracked through the whole set
- **Rep segmentation** — every rep detected from the angle curve, with lowering
  and lifting time per rep
- **Form checks** — depth, lockout, bar drift, left/right symmetry, tempo,
  hip-shoot, setup angle — each with a measured value and a pass/fail
- **A score out of 10** and one concrete fix per issue

A vision/text LLM (**Google Gemini**, free tier) is used **only** to turn the
computed numbers into plain-language coaching advice. The numbers themselves
always come from pose estimation — an LLM never guesses from the video. That is
the whole point: ordinary AI chat cannot measure a lift. This can.

## How it works

```
video ──► MediaPipe PoseLandmarker (on-device, CDN) ──► 33 landmarks / frame
   ──► analysis.mjs: angles, rep segmentation, bar path, checks, score
   ──► rule-based feedback (works with no key)
   ──► optional: Gemini turns the numbers into coaching text (key in Settings)
```

- **Pose estimation:** `@mediapipe/tasks-vision` PoseLandmarker (lite model,
  ~4 MB), GPU delegate with CPU fallback. The bundle, WASM runtime, and model
  are **vendored in `vendor/mediapipe/`** (Apache-2.0, see
  `vendor/mediapipe/NOTICE.md`) so the app works fully offline; if the local
  files are missing it falls back to the CDN (`cdn.jsdelivr.net` /
  `storage.googleapis.com`). Frames sampled at ~8 fps from an offscreen
  canvas; a set needs ≥50% of frames with a detected pose.
- **Angles:** three-point joint angles from the 3D landmarks; squat and
  deadlift are planar in side view, so 2D angles are meaningful as-is.
- **Bar path:** the bar is tracked via the wrist (bench/deadlift) or the
  shoulder (squat). Drift is measured **lockout-to-lockout** — how far the bar
  walks from its starting vertical line across reps. (The raw horizontal range
  would wrongly penalise the normal J-curve of a bench press.)
- **Bench depth calibration:** in a true side view, the 2D projected elbow
  angle at the bottom of a bench press is small (~23° at a full touch) because
  shoulder and wrist sit almost in the same direction from the elbow. Published
  65–95° figures are 3D values. Our bench depth thresholds are therefore
  calibrated to side-view 2D values (≤45° full touch, 45–70° shallow,
  >70° very shallow).
- **Demo mode:** procedural sample lifts (squat / bench / deadlift, 2 reps
  each, each with one built-in flaw) generated from a 2D kinematic model.
  Visibly labelled **SAMPLE DATA**. The demo runs through the exact same
  analysis pipeline as real video.

## Checks per lift

| Lift | Checks |
|---|---|
| Squat | Depth (hip below knee), torso lean ≤40°, bar drift, L/R knee symmetry, lowering tempo ≥1.0 s |
| Bench press | Elbow angle at bottom (side-view 2D), lockout ≥160°, bar drift, L/R elbow symmetry, lowering tempo |
| Deadlift | Hip lockout ≥160°, hip-shoot (lean increase during the pull), setup torso angle 20–45°, bar drift, L/R hip symmetry |

## Run it locally

```bash
# any static server works (module scripts need http, not file://)
python3 -m http.server 8000
# open http://localhost:8000
```

No build step, no install. The MediaPipe model and wasm load from CDN on first
use (~4 MB).

## Gemini API key (optional)

The form analysis works fully without a key. To enable the AI-coach text:

1. Get a free key at [Google AI Studio](https://aistudio.google.com/apikey)
   (free tier, no card required).
2. In the app: **Settings → paste the key → Save**.
3. The key is stored only in your browser's `localStorage` and sent only to
   Google's Generative Language API. It is never hardcoded and never leaves
   your machine except for that one call.

## Demo mode

Click **"Try the demo"** — no video, no key needed. Each demo lift has one
deliberate flaw so the feedback is visible:

- Squat 8.5/10 — rep 2 is shallow (depth fail)
- Bench 9.3/10 — bar drifts forward 14% of torso length
- Deadlift 9.3/10 — rep 1 hips shoot up before the shoulders (+9° lean)

## Testing

```bash
# analysis pipeline on the demo data (Node, no browser needed)
node test-analysis.mjs

# full app in headless Chromium via CDP (screenshots + unit test)
# 1. start a server, 2. launch Chromium with --remote-debugging-port=9222
#    and --allow-file-access-from-files, 3. run:
node cdp-test.mjs

# real-video end-to-end test (MediaPipe on a real squat clip)
node mediapipe-test.mjs
```

The real-video test uses a CC BY squat clip from Wikimedia Commons
([Squat – exercise demonstration video](https://commons.wikimedia.org/wiki/File:Squat_-_exercise_demonstration_video.webm),
FitnessScape, 7.1 s, side view). It is kept in `test-assets/` as a test
fixture only.

Verified 2026-11-25: demo pipeline scores 8.5 / 9.3 / 9.3 as designed;
`angle3` unit test returns 90° for a right angle and 180° for a straight line;
all three exercises render in headless Chromium with a clean console.
The real-video path was verified end-to-end with the Wikimedia squat clip:
**56/56 frames with a detected pose (100%), 2 reps detected, score 9.3/10**
(depth 2/2, lean 13°, bar drift 1%, symmetry 5°, only tempo flagged at 0.8 s).
Note: headless CPU inference on this VM runs ~2.7 s/frame; on a real machine
with GPU it is near real-time.

## Honesty & limits

- **Coaching guidance, not medical advice.** This is not a medical assessment
  and cannot diagnose injuries. Stop training and consult a professional if
  anything hurts.
- **Single-camera pose estimation has limits.** Angles are approximate;
  occlusion, loose clothing, bad lighting, or a non-side camera angle all
  degrade accuracy. Treat the numbers as a guide, not a measurement device.
- **The LLM never measures.** Gemini only explains numbers that pose
  estimation already computed. If the pose is wrong, the coaching is wrong —
  the app shows the measured values so you can see for yourself.

## References & attribution

- **FormRate.AI** — https://github.com/eyal-prihar/formrate.ai — methodology
  reference only (rep detection via smoothed angle valleys, bar path as wrist
  drift, per-lift scoring tables). **No code reused**; FormRate.AI is
  © 2025 Eyal Prihar, all rights reserved.
- **elite-coach form-correction skill** —
  https://github.com/payman-salimi/elite-coach — the spine-lean convention
  (0° upright / 90° horizontal) and the JSON-export idea.
- **Escamilla et al. (2002)** — deadlift lockout hip-extension reference
  (165–185°).
- MediaPipe Pose: https://developers.google.com/mediapipe/solutions/vision/pose_landmarker

## License

MIT — see [LICENSE](LICENSE). Copyright (c) 2026 zhaoyahui1122.

---

## 中文简介

**FormCheck —— 给独自训练的人的 AI 动作分析工具**（SLAY HACKS 2026 参赛作品）

上传深蹲、卧推或硬拉视频，应用在浏览器本地用 MediaPipe 做姿态估计，
逐帧算出真实的关节角度和杠铃轨迹，给出 10 分制评分和每项问题的具体改进方法。
Gemini（免费版，可选）只负责把算出的数字翻译成通俗的指导文字——数字本身
永远来自姿态估计，不是大模型猜的。演示模式内置示例数据（明确标注“演示数据”），
不用视频、不用密钥就能体验完整流程。本地运行：`python3 -m http.server 8000`，
打开 http://localhost:8000 即可。
