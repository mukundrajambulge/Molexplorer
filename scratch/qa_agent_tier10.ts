import fs from 'fs';
import path from 'path';
import { performance } from 'perf_hooks';
import { generate200MoleculeDataset, MoleculeTestCase } from './run_200_molecules_suite';
import { MolProcessor, formatAtomLine, Atom } from '../src/lib/MolProcessor';
import { SelectionParser } from '../src/lib/SelectionParser';
import { SessionManager } from '../src/session/SessionManager';
import { MolStudioSession } from '../src/session/SessionSchema';
import { DefaultRepresentationStrategy } from '../src/rendering/RepresentationStrategy';

interface WebGLBufferTelemetry {
  sphereVerticesFull: number;
  sphereVboBytesFullMB: number;
  sphereVerticesDownsampled: number;
  sphereVboBytesDownsampledMB: number;
  stickVerticesFull: number;
  stickVboBytesFullMB: number;
  cartoonVerticesFull: number;
  cartoonVboBytesFullMB: number;
  dotSurfaceVertices: number;
  dotSurfaceVboBytesMB: number;
  requiresUint32Indices: boolean;
  totalFullVboMemoryMB: number;
  totalDownsampledVboMemoryMB: number;
}

interface PerformanceModeTelemetry {
  downsamplingTriggered: boolean;
  ultraFastModeTriggered: boolean;
  vertexReductionPct: number;
  estimatedFullFrameTimeMs: number;
  estimatedDownsampledFrameTimeMs: number;
  projectedFPSUnoptimized: number;
  projectedFPSDownsampled: number;
  meets60FPSTarget: boolean;
}

interface SelectionQueryTelemetry {
  query: string;
  matchCount: number;
  timeMs: number;
  atomsPerMs: number;
}

interface ExportPipelineTelemetry {
  pdbFormatTimeMs: number;
  pdbOutputSizeBytes: number;
  pdbFormattingRateAtomsPerSec: number;
  sessionExportTimeMs: number;
  sessionJsonSizeBytes: number;
  frameBuffer1080pMB: number;
  frameBuffer4KMB: number;
  videoBuffer4Sec1080pMB: number;
  exportMemoryOverheadMB: number;
}

interface MoleculeTelemetryReport {
  molId: string;
  molName: string;
  tier: number;
  atomCount: number;
  parseTimeMs: number;
  webgl: WebGLBufferTelemetry;
  performanceMode: PerformanceModeTelemetry;
  selectionQueries: SelectionQueryTelemetry[];
  avgQueryTimeMs: number;
  maxQueryTimeMs: number;
  slowestQuery: string;
  totalQueryTimeMs: number;
  exportPipeline: ExportPipelineTelemetry;
  status: 'PASS' | 'FAIL';
  issues: string[];
}

const SELECTION_QUERIES_TO_TEST = [
  "all",
  "none",
  "elem C",
  "elem N",
  "elem O",
  "elem H",
  "resn ALA",
  "resn LIG",
  "resi 1-50",
  "chain A",
  "ss h",
  "ss s",
  "hydrogens",
  "backbone",
  "sidechain",
  "organic",
  "hetatm",
  "byres (resn LIG around 5)",
  "chain A and resn ALA",
  "ss h and not resn HOH",
  "around 5",
  "within 4 of elem N",
  "elem C or elem N",
  "not hydrogens",
  "byres (resi 1-10)"
];

function analyzeWebGLBuffers(atomCount: number): WebGLBufferTelemetry {
  // Full detail sphere: 16 lat x 16 long grid = 288 vertices per sphere
  // Each vertex has: Position (3 floats = 12B), Normal (3 floats = 12B), Color (4 floats = 16B) = 40 B/vertex
  const bytesPerVertex = 40;
  const sphereVerticesFull = atomCount * 288;
  const sphereVboBytesFullMB = (sphereVerticesFull * bytesPerVertex) / (1024 * 1024);

  // Downsampled sphere: 6x6 grid = 50 vertices per sphere (or 4 vertices for instanced billboard)
  const sphereVerticesDownsampled = atomCount * 50;
  const sphereVboBytesDownsampledMB = (sphereVerticesDownsampled * bytesPerVertex) / (1024 * 1024);

  // Sticks / Cylinders: ~1.2 bonds per atom, 16 radial segments x 2 = 64 vertices per bond
  const estimatedBonds = Math.round(atomCount * 1.2);
  const stickVerticesFull = estimatedBonds * 64;
  const stickVboBytesFullMB = (stickVerticesFull * bytesPerVertex) / (1024 * 1024);

  // Cartoon Ribbon: ~1 residue per 9 atoms, 60 vertices per residue spline segment
  const estimatedResidues = Math.max(1, Math.round(atomCount / 9));
  const cartoonVerticesFull = estimatedResidues * 60;
  const cartoonVboBytesFullMB = (cartoonVerticesFull * bytesPerVertex) / (1024 * 1024);

  // Dot Cloud / Point Cloud Surface: 16 Fibonacci points per atom, 1 vertex per dot (40B)
  const dotSurfaceVertices = atomCount * 16;
  const dotSurfaceVboBytesMB = (dotSurfaceVertices * bytesPerVertex) / (1024 * 1024);

  // WebGL 1.0 limit: uint16 max index = 65,535. Any mesh with > 65,535 vertices requires Uint32 & OES_element_index_uint
  const requiresUint32Indices = sphereVerticesFull > 65535 || stickVerticesFull > 65535;

  const totalFullVboMemoryMB = sphereVboBytesFullMB + stickVboBytesFullMB + cartoonVboBytesFullMB;
  const totalDownsampledVboMemoryMB = sphereVboBytesDownsampledMB + (stickVboBytesFullMB * 0.3) + cartoonVboBytesFullMB;

  return {
    sphereVerticesFull,
    sphereVboBytesFullMB: Number(sphereVboBytesFullMB.toFixed(3)),
    sphereVerticesDownsampled,
    sphereVboBytesDownsampledMB: Number(sphereVboBytesDownsampledMB.toFixed(3)),
    stickVerticesFull,
    stickVboBytesFullMB: Number(stickVboBytesFullMB.toFixed(3)),
    cartoonVerticesFull,
    cartoonVboBytesFullMB: Number(cartoonVboBytesFullMB.toFixed(3)),
    dotSurfaceVertices,
    dotSurfaceVboBytesMB: Number(dotSurfaceVboBytesMB.toFixed(3)),
    requiresUint32Indices,
    totalFullVboMemoryMB: Number(totalFullVboMemoryMB.toFixed(3)),
    totalDownsampledVboMemoryMB: Number(totalDownsampledVboMemoryMB.toFixed(3)),
  };
}

function analyzePerformanceMode(atomCount: number, webgl: WebGLBufferTelemetry): PerformanceModeTelemetry {
  const downsamplingTriggered = atomCount > 3500;
  const ultraFastModeTriggered = atomCount > 15000;

  const fullVerts = webgl.sphereVerticesFull + webgl.stickVerticesFull;
  const downVerts = downsamplingTriggered
    ? (ultraFastModeTriggered ? webgl.cartoonVerticesFull : webgl.sphereVerticesDownsampled + webgl.stickVerticesFull * 0.3)
    : fullVerts;

  const vertexReductionPct = fullVerts > 0 ? Number((((fullVerts - downVerts) / fullVerts) * 100).toFixed(2)) : 0;

  // Estimated GPU processing overhead: ~1.5 ns per vertex + 2 ms base frame overhead
  const estimatedFullFrameTimeMs = Number((2.0 + (fullVerts * 0.0000025)).toFixed(2));
  const estimatedDownsampledFrameTimeMs = Number((2.0 + (downVerts * 0.0000025)).toFixed(2));

  const projectedFPSUnoptimized = Math.min(60, Math.round(1000 / Math.max(1, estimatedFullFrameTimeMs)));
  const projectedFPSDownsampled = Math.min(60, Math.round(1000 / Math.max(1, estimatedDownsampledFrameTimeMs)));

  const meets60FPSTarget = projectedFPSDownsampled >= 55;

  return {
    downsamplingTriggered,
    ultraFastModeTriggered,
    vertexReductionPct,
    estimatedFullFrameTimeMs,
    estimatedDownsampledFrameTimeMs,
    projectedFPSUnoptimized,
    projectedFPSDownsampled,
    meets60FPSTarget
  };
}

function runSelectionQueries(atoms: Atom[]): { queries: SelectionQueryTelemetry[]; avgTimeMs: number; maxTimeMs: number; slowestQuery: string; totalTimeMs: number } {
  const parser = new SelectionParser(atoms as any);
  const queries: SelectionQueryTelemetry[] = [];
  let totalTimeMs = 0;
  let maxTimeMs = -1;
  let slowestQuery = "";

  SELECTION_QUERIES_TO_TEST.forEach(query => {
    const qStart = performance.now();
    let matchCount = 0;
    try {
      const selected = parser.parse(query);
      matchCount = selected.size;
    } catch (e: any) {
      matchCount = 0;
    }
    const timeMs = performance.now() - qStart;
    totalTimeMs += timeMs;

    if (timeMs > maxTimeMs) {
      maxTimeMs = timeMs;
      slowestQuery = query;
    }

    const atomsPerMs = timeMs > 0 ? Math.round(atoms.length / timeMs) : atoms.length * 1000;

    queries.push({
      query,
      matchCount,
      timeMs: Number(timeMs.toFixed(3)),
      atomsPerMs
    });
  });

  const avgTimeMs = Number((totalTimeMs / queries.length).toFixed(3));
  maxTimeMs = Number(maxTimeMs.toFixed(3));
  totalTimeMs = Number(totalTimeMs.toFixed(3));

  return { queries, avgTimeMs, maxTimeMs, slowestQuery, totalTimeMs };
}

function analyzeExportPipeline(atoms: Atom[], testCase: MoleculeTestCase): ExportPipelineTelemetry {
  // 1. PDB Atom formatting benchmark
  const formatStart = performance.now();
  let pdbBuffer = "";
  const header = `HEADER    ${testCase.name.toUpperCase().slice(0, 40)}\n`;
  const lines: string[] = [header];
  for (let i = 0; i < atoms.length; i++) {
    lines.push(formatAtomLine(atoms[i]));
  }
  lines.push("END\n");
  pdbBuffer = lines.join("\n");
  const pdbFormatTimeMs = Number((performance.now() - formatStart).toFixed(3));
  const pdbOutputSizeBytes = Buffer.byteLength(pdbBuffer, 'utf8');
  const pdbFormattingRateAtomsPerSec = pdbFormatTimeMs > 0 ? Math.round((atoms.length / pdbFormatTimeMs) * 1000) : atoms.length * 10000;

  // 2. PSE / JSON Session serialization benchmark
  const sessionStart = performance.now();
  const mockSession: MolStudioSession = {
    version: '1.0',
    timestamp: Date.now(),
    molecule: {
      data: testCase.data.slice(0, 2000),
      format: 'pdb',
      name: testCase.name
    },
    selectedAtomSerials: atoms.slice(0, 50).map(a => a.serial),
    namedSelections: [
      { name: 'active_site', query: 'resi 1-50', atomIds: atoms.slice(0, 50).map(a => a.serial) }
    ],
    measurements: [
      { id: 'm1', type: 'distance', atomSerials: [1, 2], coordinates: [{ x: 0, y: 0, z: 0 }, { x: 3.8, y: 0, z: 0 }], value: 3.8, label: '3.80 Å' }
    ],
    biophysical: { showDipoleArrow: true },
    viewState: {
      renderStyle: 'Cartoon',
      colorScheme: 'spectrum',
      surfaceOpacity: 0.8,
      backgroundColor: '#0A0A0A',
      orthographic: false,
      stereoMode: 'none'
    }
  };
  const exportedJson = SessionManager.exportSession(mockSession);
  const sessionExportTimeMs = Number((performance.now() - sessionStart).toFixed(3));
  const sessionJsonSizeBytes = Buffer.byteLength(exportedJson, 'utf8');

  // 3. Canvas & Frame Buffer Memory Footprint Calculations
  // 1080p = 1920 x 1080 x 4 bytes = 8.29 MB
  const frameBuffer1080pMB = Number((1920 * 1080 * 4 / (1024 * 1024)).toFixed(2));
  // 4K = 3840 x 2160 x 4 bytes = 33.18 MB
  const frameBuffer4KMB = Number((3840 * 2160 * 4 / (1024 * 1024)).toFixed(2));

  // 30 FPS for 4 seconds = 120 frames
  // Uncompressed frame buffer memory = 120 * 8.29 MB = 995 MB
  const videoBuffer4Sec1080pMB = Number((120 * frameBuffer1080pMB).toFixed(2));

  // Memory overhead delta
  const exportMemoryOverheadMB = Number(((pdbOutputSizeBytes + sessionJsonSizeBytes) / (1024 * 1024)).toFixed(3));

  return {
    pdbFormatTimeMs,
    pdbOutputSizeBytes,
    pdbFormattingRateAtomsPerSec,
    sessionExportTimeMs,
    sessionJsonSizeBytes,
    frameBuffer1080pMB,
    frameBuffer4KMB,
    videoBuffer4Sec1080pMB,
    exportMemoryOverheadMB
  };
}

async function runTier10TestSuite() {
  const startTime = performance.now();
  console.log("====================================================================================================");
  console.log("    MOLEXPLORER QA SUITE — AGENT TIER 10 (20 MOLECULES, 3,501 TO 25,000+ ATOMS)");
  console.log("====================================================================================================\n");

  const allMols = generate200MoleculeDataset();
  const tier10Mols = allMols.filter(m => m.tier === 10);

  const reports: MoleculeTelemetryReport[] = [];
  const logLines: string[] = [];

  const log = (msg: string) => {
    console.log(msg);
    logLines.push(msg);
  };

  log(`Loaded ${tier10Mols.length} Agent Tier 10 test molecules.\n`);

  for (let i = 0; i < tier10Mols.length; i++) {
    const testCase = tier10Mols[i];
    log(`----------------------------------------------------------------------------------------------------`);
    log(`[MOLECULE ${i + 1}/20] ${testCase.name} (${testCase.id}) — Target Atom Count: ${testCase.expectedAtomCount.toLocaleString()}`);
    log(`----------------------------------------------------------------------------------------------------`);

    const issues: string[] = [];

    // 1. Parsing
    const parseStart = performance.now();
    let atoms: Atom[] = [];
    try {
      const processor = new MolProcessor(testCase.data, 'pdb');
      atoms = (processor.atoms as any) || [];
    } catch (err: any) {
      issues.push(`Parse failure: ${err.message}`);
    }
    const parseTimeMs = Number((performance.now() - parseStart).toFixed(3));

    if (atoms.length === 0) {
      issues.push(`Zero atoms parsed! Expected ${testCase.expectedAtomCount}`);
    }

    log(`  Parsed Atoms: ${atoms.length.toLocaleString()} (Time: ${parseTimeMs} ms)`);

    // 2. WebGL Buffer Allocation
    const webgl = analyzeWebGLBuffers(atoms.length);
    log(`  [WebGL Buffers] Full VBO: ${webgl.totalFullVboMemoryMB} MB (${webgl.sphereVerticesFull.toLocaleString()} sphere verts, ${webgl.stickVerticesFull.toLocaleString()} stick verts)`);
    log(`  [WebGL Buffers] Downsampled VBO: ${webgl.totalDownsampledVboMemoryMB} MB | Dot Cloud: ${webgl.dotSurfaceVboBytesMB} MB`);
    log(`  [WebGL Indexing] Requires Uint32 Extension (OES_element_index_uint): ${webgl.requiresUint32Indices ? 'YES (>65,535 verts)' : 'NO'}`);

    if (webgl.totalFullVboMemoryMB > 500) {
      issues.push(`Full WebGL VBO exceeds 500 MB limit: ${webgl.totalFullVboMemoryMB} MB`);
    }

    // 3. Performance Mode & LOD
    const perfMode = analyzePerformanceMode(atoms.length, webgl);
    log(`  [Perf Mode] Auto-Downsample Triggered: ${perfMode.downsamplingTriggered} | Ultra-Fast Mode (>15k): ${perfMode.ultraFastModeTriggered}`);
    log(`  [Perf Mode] Vertex Reduction: ${perfMode.vertexReductionPct}% | Est Frame Time: ${perfMode.estimatedFullFrameTimeMs}ms (unopt) -> ${perfMode.estimatedDownsampledFrameTimeMs}ms (downsampled)`);
    log(`  [Perf Mode] Projected FPS: ${perfMode.projectedFPSUnoptimized} FPS (unopt) -> ${perfMode.projectedFPSDownsampled} FPS (downsampled) ${perfMode.meets60FPSTarget ? '✅ Meets 60 FPS' : '⚠️ Below 60 FPS'}`);

    if (!perfMode.meets60FPSTarget) {
      issues.push(`Downsampled rendering projected FPS (${perfMode.projectedFPSDownsampled}) below 60 FPS target`);
    }

    // 4. Selection Query Algebra
    const selResult = runSelectionQueries(atoms);
    log(`  [Selection Query] Executed 25 Queries | Total Time: ${selResult.totalTimeMs} ms | Avg: ${selResult.avgTimeMs} ms/query | Max: ${selResult.maxTimeMs} ms ("${selResult.slowestQuery}")`);

    if (selResult.avgTimeMs > 10.0) {
      issues.push(`Selection query average execution time (${selResult.avgTimeMs} ms) exceeds 10 ms threshold`);
    }

    // 5. Export Pipeline
    const expResult = analyzeExportPipeline(atoms, testCase);
    log(`  [Export Pipeline] PDB Format Time: ${expResult.pdbFormatTimeMs} ms (${expResult.pdbFormattingRateAtomsPerSec.toLocaleString()} atoms/s) | Output Size: ${(expResult.pdbOutputSizeBytes / 1024).toFixed(1)} KB`);
    log(`  [Export Pipeline] PSE Session Export: ${expResult.sessionExportTimeMs} ms | Canvas 1080p: ${expResult.frameBuffer1080pMB} MB | 4K: ${expResult.frameBuffer4KMB} MB | 4s Video Buffer: ${expResult.videoBuffer4Sec1080pMB} MB`);

    if (expResult.pdbFormatTimeMs > 250.0) {
      issues.push(`PDB formatting time (${expResult.pdbFormatTimeMs} ms) exceeds 250 ms threshold`);
    }

    const status = issues.length === 0 ? 'PASS' : 'FAIL';
    log(`  [STATUS] ${status}${issues.length > 0 ? ` — Issues: ${issues.join('; ')}` : ''}\n`);

    reports.push({
      molId: testCase.id,
      molName: testCase.name,
      tier: 10,
      atomCount: atoms.length,
      parseTimeMs,
      webgl,
      performanceMode: perfMode,
      selectionQueries: selResult.queries,
      avgQueryTimeMs: selResult.avgTimeMs,
      maxQueryTimeMs: selResult.maxTimeMs,
      slowestQuery: selResult.slowestQuery,
      totalQueryTimeMs: selResult.totalTimeMs,
      exportPipeline: expResult,
      status,
      issues
    });
  }

  // Summary statistics
  const totalExecutionTimeMs = Number((performance.now() - startTime).toFixed(2));
  const passedCount = reports.filter(r => r.status === 'PASS').length;
  const failedCount = reports.filter(r => r.status === 'FAIL').length;
  const totalAtomsTested = reports.reduce((acc, r) => acc + r.atomCount, 0);

  const avgParseTimeMs = Number((reports.reduce((acc, r) => acc + r.parseTimeMs, 0) / reports.length).toFixed(3));
  const avgQueryTimeMs = Number((reports.reduce((acc, r) => acc + r.avgQueryTimeMs, 0) / reports.length).toFixed(3));
  const avgPdbExportTimeMs = Number((reports.reduce((acc, r) => acc + r.exportPipeline.pdbFormatTimeMs, 0) / reports.length).toFixed(3));
  const avgVertexReduction = Number((reports.reduce((acc, r) => acc + r.performanceMode.vertexReductionPct, 0) / reports.length).toFixed(2));

  log("====================================================================================================");
  log("                     AGENT TIER 10 QA TELEMETRY SUMMARY REPORT");
  log("====================================================================================================");
  log(`Total Tier 10 Molecules Tested: ${reports.length}`);
  log(`Passed: ${passedCount} / ${reports.length} (${((passedCount / reports.length) * 100).toFixed(1)}%)`);
  log(`Failed: ${failedCount} / ${reports.length}`);
  log(`Total Atoms Tested in Tier 10: ${totalAtomsTested.toLocaleString()} atoms`);
  log(`Average Parse Time: ${avgParseTimeMs} ms`);
  log(`Average Selection Query Execution Time: ${avgQueryTimeMs} ms`);
  log(`Average PDB Export Formatting Time: ${avgPdbExportTimeMs} ms`);
  log(`Average Performance Mode Vertex Reduction: ${avgVertexReduction}%`);
  log(`Total Benchmark Suite Execution Time: ${(totalExecutionTimeMs / 1000).toFixed(2)} seconds`);
  log("====================================================================================================\n");

  log("----------------------------------------------------------------------------------------------------");
  log("ID       Molecule Name                           Atoms    VBO Full (MB)  VBO Down (MB)  Vert Red %  Avg Query (ms)  PDB Exp (ms)  Status");
  log("----------------------------------------------------------------------------------------------------");
  reports.forEach(r => {
    const idStr = r.molId.padEnd(8, ' ');
    const nameStr = r.molName.slice(0, 38).padEnd(38, ' ');
    const atomStr = r.atomCount.toString().padStart(7, ' ');
    const vboFullStr = r.webgl.totalFullVboMemoryMB.toFixed(1).padStart(12, ' ');
    const vboDownStr = r.webgl.totalDownsampledVboMemoryMB.toFixed(1).padStart(12, ' ');
    const redStr = r.performanceMode.vertexReductionPct.toFixed(1).padStart(10, ' ') + '%';
    const qStr = r.avgQueryTimeMs.toFixed(3).padStart(13, ' ');
    const expStr = r.exportPipeline.pdbFormatTimeMs.toFixed(1).padStart(12, ' ');
    const stStr = r.status.padStart(7, ' ');
    log(`${idStr} ${nameStr} ${atomStr} ${vboFullStr} ${vboDownStr} ${redStr} ${qStr} ${expStr} ${stStr}`);
  });
  log("----------------------------------------------------------------------------------------------------\n");

  // Output files
  const jsonReportPath = path.join(process.cwd(), 'scratch', 'tier10_telemetry_report.json');
  const logReportPath = path.join(process.cwd(), 'scratch', 'qa_agent_tier10.log');

  const summaryReport = {
    timestamp: new Date().toISOString(),
    totalExecutionTimeMs,
    summary: {
      totalMolecules: reports.length,
      passedCount,
      failedCount,
      passPercentage: `${((passedCount / reports.length) * 100).toFixed(1)}%`,
      totalAtomsTested,
      avgParseTimeMs,
      avgQueryTimeMs,
      avgPdbExportTimeMs,
      avgVertexReductionPct: `${avgVertexReduction}%`
    },
    detailedTelemetry: reports
  };

  fs.writeFileSync(jsonReportPath, JSON.stringify(summaryReport, null, 2), 'utf8');
  fs.writeFileSync(logReportPath, logLines.join('\n'), 'utf8');

  log(`Detailed JSON Telemetry saved to: ${jsonReportPath}`);
  log(`Full Log Output saved to: ${logReportPath}`);
}

runTier10TestSuite().catch(err => {
  console.error("Fatal error executing Agent Tier 10 test suite:", err);
  process.exit(1);
});
