import fs from 'fs';
import path from 'path';
import { performance } from 'perf_hooks';
import { generate200MoleculeDataset, MoleculeTestCase } from './run_200_molecules_suite';
import { MolProcessor, Atom } from '../src/lib/MolProcessor';
import { SelectionParser } from '../src/lib/SelectionParser';
import { DensityMap } from '../src/lib/DensityMap';
import { WebGPURaytracer } from '../src/rendering/webgpu/Raytracer';

const LOG_PATH = path.join(process.cwd(), 'scratch', 'qa_agent_tier8.log');
const REPORT_PATH = path.join(process.cwd(), 'scratch', 'qa_agent_tier8_report.json');

interface Tier8MoleculeResult {
  id: string;
  name: string;
  atomCount: number;
  parseTimeMs: number;
  
  // 1. Surface Rendering FPS Scaling
  surfaceGenTimeMs: number;
  surfaceGridDim: { x: number; y: number; z: number };
  surfaceTriangleCount: number;
  estimatedSurfaceFPS: number;

  // 2. Selection Query Algebra Performance
  query1: { query: string; count: number; timeMs: number };
  query2: { query: string; count: number; timeMs: number };

  // 3. Secondary Structure Assignment Speed
  ssQuickTimeMs: number;
  ssDsspTimeMs: number;
  ssBreakdown: { helix: number; sheet: number; loop: number; undetermined: number };

  // 4. High-Resolution Raytrace View Preview Generation
  raytraceTimeMs: number;
  raytraceResolution: string;
  raytraceSpheresProcessed: number;

  status: 'PASS' | 'FAIL';
  errors: string[];
}

// Mock Canvas 2D Context for Node.js Software Raytracer execution
function createMockCanvas(width: number, height: number) {
  return {
    width,
    height,
    getContext: (type: string) => {
      if (type !== '2d') return null;
      return {
        fillStyle: '',
        strokeStyle: '',
        lineWidth: 1,
        fillRect: () => {},
        beginPath: () => {},
        arc: () => {},
        fill: () => {},
        stroke: () => {},
        createRadialGradient: () => ({
          addColorStop: () => {}
        })
      };
    }
  } as unknown as HTMLCanvasElement;
}

async function runTier8TestSuite() {
  const logLines: string[] = [];
  const log = (msg: string) => {
    console.log(msg);
    logLines.push(msg);
  };

  log("=================================================================================");
  log("    DETAILED QA TESTING & TELEMETRY REPORT: AGENT TIER 8 (401 - 1,000 ATOMS)");
  log("=================================================================================");
  log(`Timestamp: ${new Date().toISOString()}`);
  log("Evaluating 20 Tier 8 Macromolecular Protein Structures across 4 Key Performance Metrics:\n");
  log("  1. Surface Rendering FPS Scaling (~1,000 atom protein structures)");
  log("  2. Selection Query Algebra Performance ('byres (resn LIG around 5)', 'within 5 of elem O')");
  log("  3. Secondary Structure Assignment Speed ('quick' vs 'dssp' algorithms)");
  log("  4. High-Resolution Raytrace View Preview Generation (Software/WebGPU rendering)\n");

  const allMols = generate200MoleculeDataset();
  const tier8Mols = allMols.filter(m => m.tier === 8);

  if (tier8Mols.length !== 20) {
    log(`[ERROR] Expected 20 molecules for Tier 8, found ${tier8Mols.length}`);
  }

  const results: Tier8MoleculeResult[] = [];
  const overallStartTime = performance.now();

  for (let idx = 0; idx < tier8Mols.length; idx++) {
    const testCase = tier8Mols[idx];
    const errors: string[] = [];
    
    log(`---------------------------------------------------------------------------------`);
    log(`[${idx + 1}/20] Target Molecule: ${testCase.name} (ID: ${testCase.id})`);
    log(`---------------------------------------------------------------------------------`);

    // Parse PDB
    const tParseStart = performance.now();
    let processor: MolProcessor;
    try {
      processor = new MolProcessor(testCase.data, 'pdb');
      processor.assignBonds(1.1);
    } catch (err: any) {
      log(`  ✗ Parse Error: ${err.message}`);
      errors.push(`Parse error: ${err.message}`);
      processor = new MolProcessor("", 'pdb');
    }
    const parseTimeMs = performance.now() - tParseStart;
    const atoms = processor.atoms;
    log(`  • Structure Parsed: ${atoms.length} atoms in ${parseTimeMs.toFixed(3)} ms`);

    // 1. Surface Rendering FPS Scaling Check
    const tSurfStart = performance.now();
    let surfaceTriangleCount = 0;
    let surfaceGridDim = { x: 0, y: 0, z: 0 };
    try {
      const grid = DensityMap.generateSyntheticMap(atoms, 1.2);
      surfaceGridDim = grid.dimensions;
      const mesh = DensityMap.marchingCubes(grid, 1.5);
      surfaceTriangleCount = mesh.triangleCount;
    } catch (err: any) {
      errors.push(`Surface rendering error: ${err.message}`);
    }
    const surfaceGenTimeMs = performance.now() - tSurfStart;
    // Estimated FPS scaling assuming 60 FPS baseline WebGL batch overhead + triangle load
    const frameDrawLatencyMs = 0.5 + (surfaceTriangleCount / 100000) * 1.5;
    const estimatedSurfaceFPS = Math.min(60, Math.round(1000 / (frameDrawLatencyMs + 0.1)));

    log(`  • Metric 1 [Surface Rendering]: Grid=[${surfaceGridDim.x}x${surfaceGridDim.y}x${surfaceGridDim.z}], ${surfaceTriangleCount.toLocaleString()} triangles generated in ${surfaceGenTimeMs.toFixed(2)} ms -> Estimated Frame Rate: ${estimatedSurfaceFPS} FPS`);

    // 2. Selection Query Algebra Performance Check
    const selParser = new SelectionParser(atoms);
    
    // Query 1: byres (resn LIG around 5)
    const tQ1Start = performance.now();
    let q1Count = 0;
    const q1Query = "byres (resn LIG around 5)";
    try {
      const resSet = selParser.parse(q1Query);
      q1Count = resSet.size;
    } catch (err: any) {
      errors.push(`Query 1 failed: ${err.message}`);
    }
    const q1TimeMs = performance.now() - tQ1Start;

    // Query 2: within 5 of elem O
    const tQ2Start = performance.now();
    let q2Count = 0;
    const q2Query = "within 5 of elem O";
    try {
      const resSet = selParser.parse(q2Query);
      q2Count = resSet.size;
    } catch (err: any) {
      errors.push(`Query 2 failed: ${err.message}`);
    }
    const q2TimeMs = performance.now() - tQ2Start;

    log(`  • Metric 2 [Selection Algebra]:`);
    log(`      - Query '${q1Query}': ${q1Count} atoms selected in ${q1TimeMs.toFixed(3)} ms`);
    log(`      - Query '${q2Query}': ${q2Count} atoms selected in ${q2TimeMs.toFixed(3)} ms`);

    // 3. Secondary Structure Assignment Speed Check
    const tQuickStart = performance.now();
    try {
      processor.calculateSecondaryStructure('quick');
    } catch (err: any) {
      errors.push(`SS quick error: ${err.message}`);
    }
    const ssQuickTimeMs = performance.now() - tQuickStart;

    const tDsspStart = performance.now();
    try {
      processor.calculateSecondaryStructure('dssp');
    } catch (err: any) {
      errors.push(`SS dssp error: ${err.message}`);
    }
    const ssDsspTimeMs = performance.now() - tDsspStart;

    const ssCounts = { helix: 0, sheet: 0, loop: 0, undetermined: 0 };
    processor.ss_per_residue.forEach(r => {
      if (r.ss_type === 'helix') ssCounts.helix++;
      else if (r.ss_type === 'sheet') ssCounts.sheet++;
      else if (r.ss_type === 'loop') ssCounts.loop++;
      else ssCounts.undetermined++;
    });

    log(`  • Metric 3 [SS Assignment]: Quick=${ssQuickTimeMs.toFixed(3)} ms | DSSP=${ssDsspTimeMs.toFixed(3)} ms (Residues: Helix=${ssCounts.helix}, Sheet=${ssCounts.sheet}, Loop=${ssCounts.loop})`);

    // 4. High-Resolution Raytrace View Preview Generation Check
    const raytracer = new WebGPURaytracer({ width: 1024, height: 768 });
    await raytracer.initialize();
    const mockCanvas = createMockCanvas(1024, 768);

    const tRayStart = performance.now();
    try {
      await raytracer.render(atoms, mockCanvas);
    } catch (err: any) {
      errors.push(`Raytrace preview error: ${err.message}`);
    }
    const raytraceTimeMs = performance.now() - tRayStart;
    raytracer.destroy();

    log(`  • Metric 4 [Raytrace Preview]: Rendered 1024x768 frame for ${atoms.length} spheres in ${raytraceTimeMs.toFixed(2)} ms`);

    const status: 'PASS' | 'FAIL' = errors.length === 0 ? 'PASS' : 'FAIL';
    log(`  • Status: [ ${status} ]\n`);

    results.push({
      id: testCase.id,
      name: testCase.name,
      atomCount: atoms.length,
      parseTimeMs,
      surfaceGenTimeMs,
      surfaceGridDim,
      surfaceTriangleCount,
      estimatedSurfaceFPS,
      query1: { query: q1Query, count: q1Count, timeMs: q1TimeMs },
      query2: { query: q2Query, count: q2Count, timeMs: q2TimeMs },
      ssQuickTimeMs,
      ssDsspTimeMs,
      ssBreakdown: ssCounts,
      raytraceTimeMs,
      raytraceResolution: "1024x768",
      raytraceSpheresProcessed: atoms.length,
      status,
      errors
    });
  }

  const totalTimeMs = performance.now() - overallStartTime;

  // Aggregate Telemetry Statistics
  const totalAtoms = results.reduce((a, b) => a + b.atomCount, 0);
  const avgSurfaceGenMs = results.reduce((a, b) => a + b.surfaceGenTimeMs, 0) / results.length;
  const avgTriangles = results.reduce((a, b) => a + b.surfaceTriangleCount, 0) / results.length;
  const minFPS = Math.min(...results.map(r => r.estimatedSurfaceFPS));
  const maxFPS = Math.max(...results.map(r => r.estimatedSurfaceFPS));
  const avgFPS = results.reduce((a, b) => a + b.estimatedSurfaceFPS, 0) / results.length;

  const avgQ1TimeMs = results.reduce((a, b) => a + b.query1.timeMs, 0) / results.length;
  const avgQ2TimeMs = results.reduce((a, b) => a + b.query2.timeMs, 0) / results.length;

  const avgSSQuickMs = results.reduce((a, b) => a + b.ssQuickTimeMs, 0) / results.length;
  const avgSSDsspMs = results.reduce((a, b) => a + b.ssDsspTimeMs, 0) / results.length;

  const avgRaytraceMs = results.reduce((a, b) => a + b.raytraceTimeMs, 0) / results.length;
  const passCount = results.filter(r => r.status === 'PASS').length;

  log("=================================================================================");
  log("                     TIER 8 AGENT TELEMETRY & SUMMARY REPORT");
  log("=================================================================================");
  log(`Total Target Molecules Evaluated : ${results.length}`);
  log(`Pass / Fail Rate                 : ${passCount} / ${results.length} (${((passCount/results.length)*100).toFixed(1)}% Pass)`);
  log(`Total Atoms Evaluated           : ${totalAtoms.toLocaleString()}`);
  log(`Total Execution Suite Duration   : ${(totalTimeMs / 1000).toFixed(2)} s`);
  log("---------------------------------------------------------------------------------");
  log("METRIC TELEMETRY SUMMARY:");
  log(`  1. Surface Rendering FPS Scaling:`);
  log(`     - Avg Mesh Generation Time : ${avgSurfaceGenMs.toFixed(2)} ms`);
  log(`     - Avg Isosurface Triangles : ${Math.round(avgTriangles).toLocaleString()} triangles`);
  log(`     - Render FPS Range & Avg   : ${minFPS} - ${maxFPS} FPS (Avg: ${avgFPS.toFixed(1)} FPS)`);
  log(`  2. Selection Query Algebra Performance:`);
  log(`     - 'byres (resn LIG around 5)': Avg ${avgQ1TimeMs.toFixed(3)} ms`);
  log(`     - 'within 5 of elem O'       : Avg ${avgQ2TimeMs.toFixed(3)} ms`);
  log(`  3. Secondary Structure Assignment Speed:`);
  log(`     - Quick Phi/Psi Method     : Avg ${avgSSQuickMs.toFixed(3)} ms`);
  log(`     - Full DSSP H-Bond Method  : Avg ${avgSSDsspMs.toFixed(3)} ms`);
  log(`  4. High-Resolution Raytrace View Preview Generation:`);
  log(`     - 1024x768 Preview Latency : Avg ${avgRaytraceMs.toFixed(2)} ms per frame`);
  log("=================================================================================");

  // Write log & json report
  fs.writeFileSync(LOG_PATH, logLines.join('\n'), 'utf8');
  
  const reportJSON = {
    timestamp: new Date().toISOString(),
    totalExecutionTimeMs: totalTimeMs,
    summary: {
      totalMolecules: results.length,
      passedMolecules: passCount,
      failedMolecules: results.length - passCount,
      passPercentage: `${((passCount / results.length) * 100).toFixed(1)}%`,
      totalAtomsEvaluated: totalAtoms,
      avgSurfaceGenMs,
      avgTrianglesGenerated: Math.round(avgTriangles),
      estimatedFPS: { min: minFPS, max: maxFPS, avg: avgFPS },
      avgQueryTimeMs: { query1: avgQ1TimeMs, query2: avgQ2TimeMs },
      avgSSAssignmentTimeMs: { quick: avgSSQuickMs, dssp: avgSSDsspMs },
      avgRaytraceTimeMs: avgRaytraceMs
    },
    molecules: results
  };

  fs.writeFileSync(REPORT_PATH, JSON.stringify(reportJSON, null, 2), 'utf8');
  console.log(`Log saved to: ${LOG_PATH}`);
  console.log(`JSON Report saved to: ${REPORT_PATH}`);
}

runTier8TestSuite().catch(err => {
  console.error("Tier 8 Test Suite Exception:", err);
  process.exit(1);
});
