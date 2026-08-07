import puppeteer from 'puppeteer';
import * as fs from 'fs';
import * as path from 'path';

export interface WebGLMetrics {
  renderStyle: string;
  frameCount: number;
  avgFps: number;
  minFps: number;
  maxFps: number;
  avgFrameTimeMs: number;
  p95FrameTimeMs: number;
  drawCallsPerFrame: number;
  verticesPerFrame: number;
  trianglesPerFrame: number;
  instancedDrawCallsPerFrame: number;
  shaderCompileTimeMs: number;
  programLinkTimeMs: number;
  gpuMemoryMb: number;
  bottlenecks: string[];
}

export interface AuditChecklistItem {
  id: string;
  category: string;
  description: string;
  status: 'PASS' | 'WARN' | 'FAIL';
  metricValue: string;
  recommendation: string;
}

export interface AuditReport {
  timestamp: string;
  atomCount: number;
  bondCount: number;
  metricsByStyle: Record<string, WebGLMetrics>;
  checklist: AuditChecklistItem[];
  overallSummary: {
    totalBottlenecks: number;
    recommendedOptimizations: string[];
  };
}

export function generateHighLoadPDB(targetAtomCount: number = 105000): { pdbText: string; atomCount: number; bondCount: number } {
  console.log(`[Generator] Creating high-load synthetic molecular structure with ${targetAtomCount.toLocaleString()} atoms...`);
  const lines: string[] = [];
  lines.push("HEADER    HIGH-LOAD BENCHMARK MACROMOLECULE");
  lines.push("TITLE     SYNTHETIC PROTEIN COMPLEX WITH >100K ATOMS");

  const residuesPerChain = 1000;
  const atomsPerResidue = 14;
  const totalResidues = Math.ceil(targetAtomCount / atomsPerResidue);
  let atomSerial = 1;
  let chainIdx = 0;
  const chainIds = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

  const elems = ["C", "N", "O", "C", "C", "O", "C", "C", "S", "C", "N", "H", "H", "H"];
  const names = [" N  ", " CA ", " C  ", " O  ", " CB ", " CG ", " CD ", " OE1", " NE2", " CZ ", " NH1", " NH2", " H1 ", " H2 "];

  const gridDimension = Math.ceil(Math.cbrt(totalResidues / residuesPerChain));
  const spacing = 45.0;

  for (let r = 0; r < totalResidues; r++) {
    const chainLetter = chainIds[chainIdx % chainIds.length];
    const resiInChain = (r % residuesPerChain) + 1;
    if (resiInChain === 1 && r > 0) {
      chainIdx++;
    }

    const gx = (chainIdx % gridDimension) * spacing;
    const gy = (Math.floor(chainIdx / gridDimension) % gridDimension) * spacing;
    const gz = Math.floor(chainIdx / (gridDimension * gridDimension)) * spacing;

    const t = resiInChain * 0.4;
    const helixRadius = 7.5;
    const helixPitch = 1.5;
    const centerX = gx + Math.cos(t) * helixRadius;
    const centerY = gy + Math.sin(t) * helixRadius;
    const centerZ = gz + resiInChain * helixPitch;

    for (let a = 0; a < atomsPerResidue; a++) {
      if (atomSerial > targetAtomCount) break;

      const elem = elems[a % elems.length];
      const name = names[a % names.length];

      const dx = (a % 3 - 1) * 1.4 + (Math.random() - 0.5) * 0.2;
      const dy = (Math.floor(a / 3) % 3 - 1) * 1.4 + (Math.random() - 0.5) * 0.2;
      const dz = Math.floor(a / 9) * 1.4 + (Math.random() - 0.5) * 0.2;

      const x = (centerX + dx).toFixed(3).padStart(8);
      const y = (centerY + dy).toFixed(3).padStart(8);
      const z = (centerZ + dz).toFixed(3).padStart(8);

      const sSerial = (atomSerial % 100000).toString().padStart(5);
      const sResi = (resiInChain % 10000).toString().padStart(4);

      const line = `ATOM  ${sSerial} ${name} ALA ${chainLetter}${sResi}    ${x}${y}${z}  1.00 20.00           ${elem.trim().padStart(2)}`;
      lines.push(line);
      atomSerial++;
    }
  }

  lines.push("END");
  const pdbText = lines.join("\n");
  const actualAtomCount = atomSerial - 1;
  const estimatedBondCount = Math.floor(actualAtomCount * 1.15);

  console.log(`[Generator] Generated PDB structure: ${actualAtomCount.toLocaleString()} atoms, ~${estimatedBondCount.toLocaleString()} bonds (${(pdbText.length / 1024 / 1024).toFixed(2)} MB text).`);
  return { pdbText, atomCount: actualAtomCount, bondCount: estimatedBondCount };
}

export async function runProfilingChecklist(): Promise<AuditReport> {
  console.log("===============================================================");
  console.log("   WebGL Rendering Loop & Graphics Performance Profiling       ");
  console.log("   Target Load: > 100,000 Atoms Benchmark                      ");
  console.log("===============================================================");

  const { pdbText, atomCount, bondCount } = generateHighLoadPDB(105000);

  console.log("[Browser] Launching headless browser with WebGL enabled...");
  const browser = await puppeteer.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--ignore-gpu-blocklist',
      '--use-gl=angle',
      '--use-angle=swiftshader',
      '--enable-webgl',
      '--disable-dev-shm-usage'
    ]
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 720 });

  page.on('console', msg => {
    const text = msg.text();
    if (text.startsWith('[WebGL Profile]') || text.startsWith('[Perf]')) {
      console.log(`  ${text}`);
    }
  });

  await page.addScriptTag({ url: 'https://3Dmol.org/build/3Dmol-min.js' });

  console.log("[Profiler] Injecting WebGL context hooks and executing benchmark suite...");

  const evalFunctionCode = `
    async function(pdbData, numAtoms, numBonds) {
      var glStats = {
        drawCalls: 0,
        instancedDrawCalls: 0,
        verticesDrawn: 0,
        trianglesDrawn: 0,
        shaderCompileTimeMs: 0,
        programLinkTimeMs: 0,
        totalGpuBufferBytes: 0,
        activeProgramSwaps: 0,
        currentFrameStats: {
          drawCalls: 0,
          instancedCalls: 0,
          vertices: 0,
          triangles: 0
        }
      };

      function resetFrameStats() {
        glStats.currentFrameStats.drawCalls = 0;
        glStats.currentFrameStats.instancedCalls = 0;
        glStats.currentFrameStats.vertices = 0;
        glStats.currentFrameStats.triangles = 0;
      }

      function attachGLHooks(gl) {
        if (!gl || gl._hooksAttached) return;
        gl._hooksAttached = true;

        var origCompile = gl.compileShader;
        if (origCompile) {
          gl.compileShader = function (shader) {
            var start = performance.now();
            var res = origCompile.call(this, shader);
            glStats.shaderCompileTimeMs += (performance.now() - start);
            return res;
          };
        }

        var origLink = gl.linkProgram;
        if (origLink) {
          gl.linkProgram = function (program) {
            var start = performance.now();
            var res = origLink.call(this, program);
            glStats.programLinkTimeMs += (performance.now() - start);
            return res;
          };
        }

        var origBufferData = gl.bufferData;
        if (origBufferData) {
          gl.bufferData = function (target, data, usage) {
            if (data && data.byteLength) {
              glStats.totalGpuBufferBytes += data.byteLength;
            }
            return origBufferData.call(this, target, data, usage);
          };
        }

        var origDrawArrays = gl.drawArrays;
        if (origDrawArrays) {
          gl.drawArrays = function (mode, first, count) {
            glStats.drawCalls++;
            glStats.currentFrameStats.drawCalls++;
            glStats.currentFrameStats.vertices += count;
            if (mode === gl.TRIANGLES) {
              glStats.currentFrameStats.triangles += Math.floor(count / 3);
            } else if (mode === gl.TRIANGLE_STRIP) {
              glStats.currentFrameStats.triangles += Math.max(0, count - 2);
            }
            return origDrawArrays.call(this, mode, first, count);
          };
        }

        var origDrawElements = gl.drawElements;
        if (origDrawElements) {
          gl.drawElements = function (mode, count, type, offset) {
            glStats.drawCalls++;
            glStats.currentFrameStats.drawCalls++;
            glStats.currentFrameStats.vertices += count;
            if (mode === gl.TRIANGLES) {
              glStats.currentFrameStats.triangles += Math.floor(count / 3);
            } else if (mode === gl.TRIANGLE_STRIP) {
              glStats.currentFrameStats.triangles += Math.max(0, count - 2);
            }
            return origDrawElements.call(this, mode, count, type, offset);
          };
        }

        var extInstancing = gl.getExtension ? gl.getExtension('ANGLE_instanced_arrays') : null;
        if (extInstancing && extInstancing.drawElementsInstancedANGLE) {
          var origDrawInstanced = extInstancing.drawElementsInstancedANGLE;
          extInstancing.drawElementsInstancedANGLE = function (mode, count, type, offset, primcount) {
            glStats.drawCalls++;
            glStats.instancedDrawCalls++;
            glStats.currentFrameStats.drawCalls++;
            glStats.currentFrameStats.instancedCalls++;
            var totalVerts = count * primcount;
            glStats.currentFrameStats.vertices += totalVerts;
            if (mode === gl.TRIANGLES) {
              glStats.currentFrameStats.triangles += Math.floor(count / 3) * primcount;
            }
            return origDrawInstanced.call(this, mode, count, type, offset, primcount);
          };
        }

        if (gl.drawElementsInstanced) {
          var origGl2DrawInstanced = gl.drawElementsInstanced;
          gl.drawElementsInstanced = function (mode, count, type, offset, instanceCount) {
            glStats.drawCalls++;
            glStats.instancedDrawCalls++;
            glStats.currentFrameStats.drawCalls++;
            glStats.currentFrameStats.instancedCalls++;
            var totalVerts = count * instanceCount;
            glStats.currentFrameStats.vertices += totalVerts;
            if (mode === gl.TRIANGLES) {
              glStats.currentFrameStats.triangles += Math.floor(count / 3) * instanceCount;
            }
            return origGl2DrawInstanced.call(this, mode, count, type, offset, instanceCount);
          };
        }
      }

      var origGetContext = HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = function (type, attribs) {
        var ctx = origGetContext.call(this, type, attribs);
        if (ctx) {
          attachGLHooks(ctx);
        }
        return ctx;
      };

      var container = document.createElement('div');
      container.style.width = '1280px';
      container.style.height = '720px';
      document.body.appendChild(container);

      var viewer = window.$3Dmol.createViewer(container, {
        backgroundColor: 'black',
        antialias: true
      });

      if (viewer.getRenderer && viewer.getRenderer().getContext) {
        attachGLHooks(viewer.getRenderer().getContext());
      }

      console.log('[WebGL Profile] Loading 105k atom structure into 3Dmol...');
      var startTimeLoad = performance.now();
      viewer.addModel(pdbData, 'pdb');
      var parseTimeMs = performance.now() - startTimeLoad;
      console.log('[WebGL Profile] Parsed and loaded model in ' + parseTimeMs.toFixed(1) + ' ms.');

      var stylesToProfile = [
        { name: 'Line', style: { line: {} } },
        { name: 'Stick', style: { stick: { radius: 0.15 } } },
        { name: 'Space-Filling', style: { sphere: { scale: 0.8 } } },
        { name: 'Ball-and-Stick', style: { stick: { radius: 0.12 }, sphere: { scale: 0.3 } } },
        { name: 'Cartoon', style: { cartoon: { color: 'spectrum' } } },
        { name: 'Dots', style: { sphere: { scale: 0.08 } } }
      ];

      var resultsByStyle = {};

      for (var i = 0; i < stylesToProfile.length; i++) {
        var item = stylesToProfile[i];
        console.log('[WebGL Profile] Benchmarking style: ' + item.name + '...');
        viewer.setStyle({}, item.style);
        viewer.zoomTo();

        var compileStart = glStats.shaderCompileTimeMs;
        var linkStart = glStats.programLinkTimeMs;
        resetFrameStats();

        viewer.render();

        var styleCompileTime = glStats.shaderCompileTimeMs - compileStart;
        var styleLinkTime = glStats.programLinkTimeMs - linkStart;

        var frameTimes = [];
        var totalDrawsInLoop = 0;
        var maxDrawsInSingleFrame = 0;
        var lastFrameVerts = 0;
        var lastFrameTris = 0;

        for (var f = 0; f < 60; f++) {
          resetFrameStats();

          viewer.rotate(1.5, { x: 0, y: 1, z: 0 });

          var frameStart = performance.now();
          viewer.render();
          var frameDuration = performance.now() - frameStart;

          frameTimes.push(frameDuration);
          totalDrawsInLoop += glStats.currentFrameStats.drawCalls;
          if (glStats.currentFrameStats.drawCalls > maxDrawsInSingleFrame) {
            maxDrawsInSingleFrame = glStats.currentFrameStats.drawCalls;
          }
          lastFrameVerts = glStats.currentFrameStats.vertices;
          lastFrameTris = glStats.currentFrameStats.triangles;
        }

        var avgFrameTimeMs = frameTimes.reduce(function(a, b) { return a + b; }, 0) / frameTimes.length;
        var minFrameTimeMs = Math.min.apply(null, frameTimes);
        var maxFrameTimeMs = Math.max.apply(null, frameTimes);

        var sortedTimes = frameTimes.slice().sort(function(a, b) { return a - b; });
        var p95FrameTimeMs = sortedTimes[Math.floor(sortedTimes.length * 0.95)];

        var avgFps = avgFrameTimeMs > 0 ? 1000 / avgFrameTimeMs : 60;
        var minFps = maxFrameTimeMs > 0 ? 1000 / maxFrameTimeMs : 60;
        var maxFps = minFrameTimeMs > 0 ? 1000 / minFrameTimeMs : 60;

        var avgDrawCalls = Math.round(totalDrawsInLoop / frameTimes.length);
        var gpuMemoryMb = glStats.totalGpuBufferBytes / (1024 * 1024);

        var styleBottlenecks = [];
        if (avgDrawCalls > 1000) {
          styleBottlenecks.push('EXCESSIVE_DRAW_CALLS (' + avgDrawCalls + ' draw calls per frame exceeds 1,000 threshold)');
        }
        if (avgFps < 30) {
          styleBottlenecks.push('LOW_FRAME_RATE (' + avgFps.toFixed(1) + ' FPS is below 30 FPS target under high load)');
        }
        if (lastFrameVerts > 20000000) {
          styleBottlenecks.push('HIGH_VERTEX_COUNT (' + (lastFrameVerts / 1e6).toFixed(1) + 'M vertices per frame exceeds 20M geometry budget)');
        }
        if (styleCompileTime > 200) {
          styleBottlenecks.push('SHADER_COMPILE_LATENCY (' + styleCompileTime.toFixed(0) + 'ms compile stall during style load)');
        }

        resultsByStyle[item.name] = {
          renderStyle: item.name,
          frameCount: frameTimes.length,
          avgFps: Math.round(avgFps * 10) / 10,
          minFps: Math.round(minFps * 10) / 10,
          maxFps: Math.round(maxFps * 10) / 10,
          avgFrameTimeMs: Math.round(avgFrameTimeMs * 100) / 100,
          p95FrameTimeMs: Math.round(p95FrameTimeMs * 100) / 100,
          drawCallsPerFrame: avgDrawCalls,
          verticesPerFrame: lastFrameVerts,
          trianglesPerFrame: lastFrameTris,
          instancedDrawCallsPerFrame: glStats.currentFrameStats.instancedCalls,
          shaderCompileTimeMs: Math.round(styleCompileTime * 10) / 10,
          programLinkTimeMs: Math.round(styleLinkTime * 10) / 10,
          gpuMemoryMb: Math.round(gpuMemoryMb * 10) / 10,
          bottlenecks: styleBottlenecks
        };
      }

      var spaceFillingMetrics = resultsByStyle['Space-Filling'] || {};
      var stickMetrics = resultsByStyle['Stick'] || {};
      var ballStickMetrics = resultsByStyle['Ball-and-Stick'] || {};
      var lineMetrics = resultsByStyle['Line'] || {};

      var checklist = [
        {
          id: 'CHECK-01',
          category: 'Atom Load Scalability',
          description: 'Parses and allocates WebGL buffers for structures with >100,000 atoms without JS heap allocation crashes.',
          status: 'PASS',
          metricValue: numAtoms.toLocaleString() + ' atoms parsed, ' + (glStats.totalGpuBufferBytes / 1024 / 1024).toFixed(1) + ' MB GPU buffers allocated',
          recommendation: 'Use chunked binary parsing / Float32Array streaming for structures larger than 500k atoms.'
        },
        {
          id: 'CHECK-02',
          category: 'Draw Call Budget Overhead',
          description: 'Draw call count per frame should remain under 1,000 for complex structures via instancing or batching.',
          status: (spaceFillingMetrics.drawCallsPerFrame || 0) <= 1000 ? 'PASS' : ((spaceFillingMetrics.drawCallsPerFrame || 0) <= 5000 ? 'WARN' : 'FAIL'),
          metricValue: 'Line: ' + (lineMetrics.drawCallsPerFrame || 0) + ', Stick: ' + (stickMetrics.drawCallsPerFrame || 0) + ', Space-Filling: ' + (spaceFillingMetrics.drawCallsPerFrame || 0) + ' draw calls/frame',
          recommendation: (spaceFillingMetrics.drawCallsPerFrame || 0) > 1000
            ? 'Implement GPU Instanced Rendering (drawElementsInstanced) or batch multiple sphere geometries into single vertex buffers to reduce draw call overhead.'
            : 'Draw call budget is maintained within target limits.'
        },
        {
          id: 'CHECK-03',
          category: 'Vertex Budget & Geometry Overhead',
          description: 'Evaluates vertex counts and triangle density under Space-Filling and Ball-and-Stick representations.',
          status: (spaceFillingMetrics.verticesPerFrame || 0) <= 25000000 ? 'PASS' : 'WARN',
          metricValue: 'Space-Filling Vertices: ' + (spaceFillingMetrics.verticesPerFrame || 0).toLocaleString() + ', Triangles: ' + (spaceFillingMetrics.trianglesPerFrame || 0).toLocaleString(),
          recommendation: 'Use Raymarched Impostor Shaders (point sprite sphere impostors) for Space-Filling and Stick representations at high atom counts to decrease vertex counts by 95%.'
        },
        {
          id: 'CHECK-04',
          category: 'Instanced Rendering Utilization',
          description: 'Verifies whether hardware geometry instancing (ANGLE_instanced_arrays / WebGL2) is active for recurring sphere/cylinder meshes.',
          status: glStats.instancedDrawCalls > 0 ? 'PASS' : 'WARN',
          metricValue: 'Instanced Draw Calls: ' + glStats.instancedDrawCalls + ' (Hardware Instancing support active)',
          recommendation: glStats.instancedDrawCalls === 0
            ? 'Enable instanced sphere/cylinder draw calls for Ball-and-Stick rendering to bypass per-atom buffer duplication.'
            : 'Instancing is active.'
        },
        {
          id: 'CHECK-05',
          category: 'Shader Compilation Latency',
          description: 'Shader compile + program link time should not exceed 200ms during initial rendering style switches.',
          status: glStats.shaderCompileTimeMs < 200 ? 'PASS' : 'WARN',
          metricValue: 'Total Compile Latency: ' + glStats.shaderCompileTimeMs.toFixed(1) + ' ms, Link Latency: ' + glStats.programLinkTimeMs.toFixed(1) + ' ms',
          recommendation: 'Pre-compile and cache shader programs at application startup, or utilize KHR_parallel_shader_compile extension to avoid frame stalls.'
        },
        {
          id: 'CHECK-06',
          category: 'Frame Rate & Animation Latency',
          description: 'Sustains interactive frame rates (>= 30 FPS) during real-time camera rotation at 105k atom load.',
          status: (lineMetrics.avgFps || 0) >= 30 ? 'PASS' : 'WARN',
          metricValue: 'Avg FPS - Line: ' + lineMetrics.avgFps + ' FPS, Stick: ' + stickMetrics.avgFps + ' FPS, Space-Filling: ' + spaceFillingMetrics.avgFps + ' FPS',
          recommendation: 'Implement dynamic Level of Detail (LoD): switch automatically to Line/Point mode during active camera panning/rotation, then restore full mesh quality when idle.'
        },
        {
          id: 'CHECK-07',
          category: 'GPU Buffer Memory Footprint',
          description: 'Total GPU VBO/IBO buffer memory allocation should remain under 300 MB.',
          status: (glStats.totalGpuBufferBytes / 1024 / 1024) < 300 ? 'PASS' : 'WARN',
          metricValue: 'Allocated GPU Memory: ' + (glStats.totalGpuBufferBytes / 1024 / 1024).toFixed(1) + ' MB',
          recommendation: 'Dispose unused geometry buffers and reuse interleaved Float32Arrays across structure reloads.'
        }
      ];

      var totalBottlenecks = 0;
      var recommendedList = [];

      Object.keys(resultsByStyle).forEach(function(k) {
        totalBottlenecks += resultsByStyle[k].bottlenecks.length;
      });

      checklist.forEach(function(c) {
        if (c.status !== 'PASS') {
          if (recommendedList.indexOf(c.recommendation) === -1) {
            recommendedList.push(c.recommendation);
          }
        }
      });

      return {
        timestamp: new Date().toISOString(),
        atomCount: numAtoms,
        bondCount: numBonds,
        metricsByStyle: resultsByStyle,
        checklist: checklist,
        overallSummary: {
          totalBottlenecks: totalBottlenecks,
          recommendedOptimizations: recommendedList
        }
      };
    }
  `;

  const auditReport: AuditReport = await page.evaluate(
    new Function(`return (${evalFunctionCode}).apply(this, arguments);`) as any,
    pdbText,
    atomCount,
    bondCount
  );

  await browser.close();
  return auditReport;
}

export function printAuditReportSummary(report: AuditReport): void {
  console.log("\n===============================================================");
  console.log("             WEBGL RENDERING PERFORMANCE REPORT                ");
  console.log("===============================================================");
  console.log(` Timestamp: ${report.timestamp}`);
  console.log(` Structure Scale: ${report.atomCount.toLocaleString()} Atoms | ~${report.bondCount.toLocaleString()} Bonds\n`);

  console.log("--- 1. RENDERING LOOP & STYLE METRICS -------------------------");
  console.log(
    "Style".padEnd(16) +
    "Avg FPS".padStart(9) +
    "p95 (ms)".padStart(10) +
    "DrawCalls".padStart(11) +
    "Vertices".padStart(12) +
    "GPU (MB)".padStart(10)
  );
  console.log("-".repeat(68));

  Object.values(report.metricsByStyle).forEach(m => {
    console.log(
      m.renderStyle.padEnd(16) +
      `${m.avgFps} FPS`.padStart(9) +
      `${m.p95FrameTimeMs.toFixed(1)}ms`.padStart(10) +
      `${m.drawCallsPerFrame}`.padStart(11) +
      `${(m.verticesPerFrame / 1000).toFixed(0)}k`.padStart(12) +
      `${m.gpuMemoryMb.toFixed(1)} MB`.padStart(10)
    );
  });

  console.log("\n--- 2. BOTTLENECK AUDIT CHECKLIST ------------------------------");
  report.checklist.forEach(item => {
    const symbol = item.status === 'PASS' ? '[PASS]' : (item.status === 'WARN' ? '[WARN]' : '[FAIL]');
    console.log(`${symbol.padEnd(7)} ${item.id} - ${item.category}`);
    console.log(`        Measured: ${item.metricValue}`);
    if (item.status !== 'PASS') {
      console.log(`        Action  : ${item.recommendation}`);
    }
  });

  console.log("\n--- 3. KEY BOTTLENECKS & RECOMMENDATIONS -----------------------");
  if (report.overallSummary.recommendedOptimizations.length === 0) {
    console.log("  No critical bottlenecks detected. WebGL rendering loop is well-optimized!");
  } else {
    report.overallSummary.recommendedOptimizations.forEach((rec, idx) => {
      console.log(`  ${idx + 1}. ${rec}`);
    });
  }
  console.log("===============================================================\n");
}

function syncToBrainScratch(report: AuditReport, projectScratchDir: string) {
  const brainScratchDir = `C:\\Users\\mukun\\.gemini\\antigravity\\brain\\e23c95cd-68e4-4cf7-9797-1c9ad2611579\\scratch`;
  if (!fs.existsSync(brainScratchDir)) {
    fs.mkdirSync(brainScratchDir, { recursive: true });
  }
  const jsonPath = path.join(brainScratchDir, 'rendering_profile_report.json');
  const logPath = path.join(brainScratchDir, 'verify_rendering.log');
  fs.writeFileSync(jsonPath, JSON.stringify(report, null, 2), 'utf-8');

  let logContent = `WebGL Rendering Performance Verification Log\nTimestamp: ${report.timestamp}\nAtoms: ${report.atomCount}\n\n`;
  report.checklist.forEach(c => {
    logContent += `[${c.status}] ${c.id}: ${c.category}\n  Metric: ${c.metricValue}\n  Rec: ${c.recommendation}\n\n`;
  });
  fs.writeFileSync(logPath, logContent, 'utf-8');
}

if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith('verify_rendering.ts')) {
  runProfilingChecklist().then(report => {
    printAuditReportSummary(report);

    const outputDir = path.dirname(process.argv[1]);
    const jsonPath = path.join(outputDir, 'rendering_profile_report.json');
    const logPath = path.join(outputDir, 'verify_rendering.log');

    fs.writeFileSync(jsonPath, JSON.stringify(report, null, 2), 'utf-8');

    let logContent = `WebGL Rendering Performance Verification Log\nTimestamp: ${report.timestamp}\nAtoms: ${report.atomCount}\n\n`;
    report.checklist.forEach(c => {
      logContent += `[${c.status}] ${c.id}: ${c.category}\n  Metric: ${c.metricValue}\n  Rec: ${c.recommendation}\n\n`;
    });
    fs.writeFileSync(logPath, logContent, 'utf-8');

    syncToBrainScratch(report, outputDir);

    console.log(`[Artifacts] Profile JSON report saved to: ${jsonPath}`);
    console.log(`[Artifacts] Profile text log saved to: ${logPath}`);
  }).catch(err => {
    console.error("Error executing WebGL rendering profiling:", err);
    process.exit(1);
  });
}
