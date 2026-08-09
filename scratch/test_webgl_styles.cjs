const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

const pdbDir = path.join(__dirname, 'tier9_pdbs');
const pdbFiles = fs.readdirSync(pdbDir).filter(f => f.endsWith('.pdb') && !f.startsWith('raw_'));

console.log(`Starting WebGL Draw Call & Memory Telemetry for ${pdbFiles.length} Tier 9 structures...`);

(async () => {
  const browser = await puppeteer.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--use-gl=angle',
      '--use-angle=swiftshader',
      '--enable-webgl',
      '--ignore-gpu-blocklist'
    ]
  });

  const page = await browser.newPage();
  
  // Expose local PDB reader to page
  await page.exposeFunction('getPdbContent', (filename) => {
    return fs.readFileSync(path.join(pdbDir, filename), 'utf8');
  });

  // Inject 3Dmol.js
  await page.setContent(`
    <!DOCTYPE html>
    <html>
    <head>
      <script src="https://cdnjs.cloudflare.com/ajax/libs/3Dmol/2.4.2/3Dmol-min.js"></script>
      <style>
        #gview { width: 800px; height: 600px; position: relative; }
      </style>
    </head>
    <body>
      <div id="gview"></div>
      <script>
        window.drawCalls = 0;
        window.elementsDrawn = 0;

        // Hook WebGL context to count draw calls
        const originalGetContext = HTMLCanvasElement.prototype.getContext;
        HTMLCanvasElement.prototype.getContext = function(type, attributes) {
          const gl = originalGetContext.call(this, type, attributes);
          if (gl && (type === 'webgl' || type === 'webgl2' || type === 'experimental-webgl')) {
            if (!gl._hooked) {
              gl._hooked = true;
              const origDrawArrays = gl.drawArrays;
              const origDrawElements = gl.drawElements;

              gl.drawArrays = function(mode, first, count) {
                window.drawCalls++;
                window.elementsDrawn += count;
                return origDrawArrays.apply(this, arguments);
              };

              gl.drawElements = function(mode, count, type, offset) {
                window.drawCalls++;
                window.elementsDrawn += count;
                return origDrawElements.apply(this, arguments);
              };
            }
          }
          return gl;
        };
      </script>
    </body>
    </html>
  `);

  await page.waitForFunction(() => typeof $3Dmol !== 'undefined');

  const telemetry = [];

  for (const file of pdbFiles) {
    const pdbId = file.replace('.pdb', '');
    console.log(`\nTesting WebGL style switching for ${pdbId}...`);

    const result = await page.evaluate(async (filename) => {
      const pdbText = await window.getPdbContent(filename);
      const container = document.getElementById('gview');
      container.innerHTML = ''; // reset DOM

      const viewer = $3Dmol.createViewer(container, { backgroundColor: 'black' });
      viewer.addModel(pdbText, 'pdb');
      
      const stylesToTest = [
        { name: 'cartoon', spec: { cartoon: { color: 'spectrum' } } },
        { name: 'stick', spec: { stick: { colorscheme: 'chain' } } },
        { name: 'sphere', spec: { sphere: { scale: 0.8 } } },
        { name: 'ribbon', spec: { ribbon: { color: 'chain' } } },
        { name: 'line', spec: { line: {} } }
      ];

      const atomCount = viewer.getModel().selectedAtoms({}).length;
      const styleMetrics = [];

      for (const st of stylesToTest) {
        window.drawCalls = 0;
        window.elementsDrawn = 0;
        
        const memBefore = performance.memory ? performance.memory.usedJSHeapSize / (1024 * 1024) : 0;
        const t0 = performance.now();

        viewer.setStyle({}, st.spec);
        viewer.render();

        const renderTime = performance.now() - t0;
        const memAfter = performance.memory ? performance.memory.usedJSHeapSize / (1024 * 1024) : 0;

        styleMetrics.push({
          style: st.name,
          drawCalls: window.drawCalls,
          elementsDrawn: window.elementsDrawn,
          renderTimeMs: Number(renderTime.toFixed(2)),
          heapUsedMB: Number(memAfter.toFixed(2)),
          heapDeltaMB: Number((memAfter - memBefore).toFixed(2))
        });
      }

      // Memory return to baseline test: switch back to cartoon
      const memBeforeBaseline = performance.memory ? performance.memory.usedJSHeapSize / (1024 * 1024) : 0;
      viewer.setStyle({}, { cartoon: { color: 'spectrum' } });
      viewer.render();
      const memAfterBaseline = performance.memory ? performance.memory.usedJSHeapSize / (1024 * 1024) : 0;

      return {
        pdbId: filename.replace('.pdb', ''),
        atomCount,
        styleMetrics,
        baselineMemoryMB: Number(memAfterBaseline.toFixed(2)),
        retainedMemoryDeltaMB: Number((memAfterBaseline - memBeforeBaseline).toFixed(2))
      };
    }, file);

    telemetry.push(result);
    console.log(`  Atoms: ${result.atomCount}`);
    result.styleMetrics.forEach(m => {
      console.log(`  Style: ${m.style.padEnd(8)} | Draw Calls: ${m.drawCalls.toString().padStart(4)} | Vertices/Elements: ${m.elementsDrawn.toString().padStart(7)} | Render: ${m.renderTimeMs.toFixed(1)}ms | Heap: ${m.heapUsedMB} MB`);
    });
  }

  await browser.close();

  console.log("\n=================== WEBGL TELEMETRY SUMMARY ===================");
  fs.writeFileSync(path.join(__dirname, 'webgl_telemetry.json'), JSON.stringify(telemetry, null, 2));

  // Compute summary stats across styles
  const summaryByStyle = {};
  telemetry.forEach(t => {
    t.styleMetrics.forEach(m => {
      if (!summaryByStyle[m.style]) {
        summaryByStyle[m.style] = { count: 0, totalDrawCalls: 0, totalElements: 0, totalTimeMs: 0 };
      }
      summaryByStyle[m.style].count++;
      summaryByStyle[m.style].totalDrawCalls += m.drawCalls;
      summaryByStyle[m.style].totalElements += m.elementsDrawn;
      summaryByStyle[m.style].totalTimeMs += m.renderTimeMs;
    });
  });

  const styleTable = Object.keys(summaryByStyle).map(s => ({
    style: s,
    avgDrawCalls: (summaryByStyle[s].totalDrawCalls / summaryByStyle[s].count).toFixed(1),
    avgElementsDrawn: (summaryByStyle[s].totalElements / summaryByStyle[s].count).toFixed(0),
    avgRenderTimeMs: (summaryByStyle[s].totalTimeMs / summaryByStyle[s].count).toFixed(2)
  }));

  console.table(styleTable);
})().catch(err => {
  console.error("WebGL Telemetry Error:", err);
});
