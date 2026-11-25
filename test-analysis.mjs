// test-analysis.mjs — run the analysis pipeline on the demo data in Node.
// Usage: node test-analysis.mjs
import { analyzeFrames } from './analysis.mjs';
import { getDemoData } from './demo-data.mjs';

for (const ex of ['squat', 'bench', 'deadlift']) {
  const demo = getDemoData(ex);
  const a = analyzeFrames(demo.frames, ex);
  console.log(`\n===== ${ex.toUpperCase()} =====`);
  console.log(`frames=${a.totalFrames} detected=${a.detectedFrames} duration=${a.durationSec.toFixed(1)}s`);
  console.log(`reps=${a.reps.length} score=${a.score}/10 driftX=${a.driftX.toFixed(1)}% driftY=${a.driftY.toFixed(1)}%`);
  for (const r of a.repMetrics) {
    console.log(`  rep: minPrimary=${r.minPrimary.toFixed(0)}deg ecc=${r.eccSec.toFixed(2)}s con=${r.conSec.toFixed(2)}s bottom: knee=${r.bottom?.kneeAngle.toFixed(0)} hip=${r.bottom?.hipAngle.toFixed(0)} elbow=${r.bottom?.elbowAngle.toFixed(0)} lean=${r.bottom?.spineLean.toFixed(0)} hipY=${r.bottom?.hipY.toFixed(3)} kneeY=${r.bottom?.kneeY.toFixed(3)}`);
  }
  for (const c of a.checks) {
    console.log(`  [${c.pass ? 'PASS' : 'FAIL'}] ${c.label}: ${c.value} (${c.severity})`);
  }
  const ks = a.angleSeries.map((s) => s.knee);
  const hs = a.angleSeries.map((s) => s.hip);
  const es = a.angleSeries.map((s) => s.elbow);
  console.log(`  angle ranges: knee ${Math.min(...ks).toFixed(0)}-${Math.max(...ks).toFixed(0)} hip ${Math.min(...hs).toFixed(0)}-${Math.max(...hs).toFixed(0)} elbow ${Math.min(...es).toFixed(0)}-${Math.max(...es).toFixed(0)}`);
}
