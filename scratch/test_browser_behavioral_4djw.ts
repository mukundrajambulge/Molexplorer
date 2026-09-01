import express from 'express';
import path from 'path';
import fs from 'fs';
import { createServer as createViteServer } from 'vite';
import puppeteer from 'puppeteer';

async function runBrowserSequence() {
  const app = express();
  const PORT = 5198;

  app.use((req, res, next) => {
    res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
    res.setHeader("Cross-Origin-Embedder-Policy", "require-corp");
    next();
  });

  const vite = await createViteServer({
    server: { middlewareMode: true },
    appType: "spa",
  });
  app.use(vite.middlewares);

  const server = app.listen(PORT, "127.0.0.1");

  const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
  const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
  const browserPath = fs.existsSync(chromePath) ? chromePath : (fs.existsSync(edgePath) ? edgePath : undefined);

  const browser = await puppeteer.launch({
    headless: true,
    executablePath: browserPath,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--enable-webgl', '--window-size=1280,800']
  });

  const artifactDir = 'C:\\Users\\mukun\\.gemini\\antigravity\\brain\\5b2affe6-a09a-4dc7-b9d5-484a11012317';

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 800 });

    await page.goto(`http://127.0.0.1:${PORT}/molstudio`, { waitUntil: 'networkidle0', timeout: 30000 });
    await page.waitForFunction(() => Boolean((window as any).__molStudioTestApi), { timeout: 15000 });

    console.log("Loading 4DJW...");
    const rawPdb = fs.readFileSync('scratch/4DJW.pdb', 'utf8');
    await page.evaluate((data) => {
      (window as any).__molStudioTestApi.loadMolecule('4DJW', data, 'pdb');
    }, rawPdb);

    await new Promise(r => setTimeout(r, 2500));
    await page.screenshot({ path: path.join(artifactDir, 'seq_00_initial.png') });

    // Transition A: all
    console.log("Testing Transition A: all ...");
    const countA = await page.evaluate(async () => {
      const res = await (window as any).__molStudioTestApi.runQuery('all');
      return res.count;
    });
    console.log(`Transition A result: ${countA} atoms selected.`);

    // Transition B: show_as lines, all
    console.log("Testing Transition B: show_as lines, all ...");
    await page.evaluate(async () => {
      await (window as any).__molStudioTestApi.runQuery('show_as lines, all');
    });
    await new Promise(r => setTimeout(r, 1000));

    const resB = await page.evaluate(() => {
      const viewer = (window as any).__molStudioTestApi.getViewer();
      const m = viewer.getModel(0);
      const atom0 = m.selectedAtoms({})[0];
      return {
        atom0Style: atom0?.style,
        renderedChildren: m.renderedMolObj?.children?.length,
        types: m.renderedMolObj?.children?.map((c: any) => c.geometry?.constructor?.name || c.constructor?.name)
      };
    });
    console.log("Transition B result:", resB);
    if (!resB.atom0Style?.line) throw new Error("Transition B failed: line representation not active");
    if (resB.atom0Style?.cartoon) throw new Error("Transition B failed: cartoon representation still present");
    await page.screenshot({ path: path.join(artifactDir, 'seq_01_show_as_lines_all.png') });

    // Transition C: show sticks, chain A
    console.log("Testing Transition C: show sticks, chain A ...");
    await page.evaluate(async () => {
      await (window as any).__molStudioTestApi.runQuery('show sticks, chain A');
    });
    await new Promise(r => setTimeout(r, 1000));

    const resC = await page.evaluate(() => {
      const viewer = (window as any).__molStudioTestApi.getViewer();
      const m = viewer.getModel(0);
      const chainAAtom = m.selectedAtoms({ chain: 'A' })[0];
      const chainBAtom = m.selectedAtoms({ chain: 'B' })[0];
      return {
        chainAStyle: chainAAtom?.style,
        chainBStyle: chainBAtom?.style,
        renderedChildren: m.renderedMolObj?.children?.length
      };
    });
    console.log("Transition C result:", resC);
    if (!resC.chainAStyle?.line || !resC.chainAStyle?.stick) throw new Error("Transition C failed: Chain A missing line or stick");
    if (resC.chainBStyle?.stick) throw new Error("Transition C failed: Chain B has stick");
    await page.screenshot({ path: path.join(artifactDir, 'seq_02_show_sticks_chainA.png') });

    // Transition D: hide lines, chain A
    console.log("Testing Transition D: hide lines, chain A ...");
    await page.evaluate(async () => {
      await (window as any).__molStudioTestApi.runQuery('hide lines, chain A');
    });
    await new Promise(r => setTimeout(r, 1000));

    const resD = await page.evaluate(() => {
      const viewer = (window as any).__molStudioTestApi.getViewer();
      const m = viewer.getModel(0);
      const chainAAtom = m.selectedAtoms({ chain: 'A' })[0];
      const chainBAtom = m.selectedAtoms({ chain: 'B' })[0];
      return {
        chainAStyle: chainAAtom?.style,
        chainBStyle: chainBAtom?.style,
        renderedChildren: m.renderedMolObj?.children?.length
      };
    });
    console.log("Transition D result:", resD);
    if (resD.chainAStyle?.line) throw new Error("Transition D failed: Chain A still has line");
    if (!resD.chainAStyle?.stick) throw new Error("Transition D failed: Chain A missing stick");
    if (!resD.chainBStyle?.line) throw new Error("Transition D failed: Chain B missing line");
    await page.screenshot({ path: path.join(artifactDir, 'seq_03_hide_lines_chainA.png') });

    // Transition E: show_as cartoon, chain A
    console.log("Testing Transition E: show_as cartoon, chain A ...");
    await page.evaluate(async () => {
      await (window as any).__molStudioTestApi.runQuery('show_as cartoon, chain A');
    });
    await new Promise(r => setTimeout(r, 1000));

    const resE = await page.evaluate(() => {
      const viewer = (window as any).__molStudioTestApi.getViewer();
      const m = viewer.getModel(0);
      const chainAAtom = m.selectedAtoms({ chain: 'A' })[0];
      const chainBAtom = m.selectedAtoms({ chain: 'B' })[0];
      return {
        chainAStyle: chainAAtom?.style,
        chainBStyle: chainBAtom?.style,
        renderedChildren: m.renderedMolObj?.children?.length
      };
    });
    console.log("Transition E result:", resE);
    if (!resE.chainAStyle?.cartoon) throw new Error("Transition E failed: Chain A missing cartoon");
    if (resE.chainAStyle?.stick || resE.chainAStyle?.line) throw new Error("Transition E failed: Chain A still has stick or line");
    if (!resE.chainBStyle?.line) throw new Error("Transition E failed: Chain B missing line");
    await page.screenshot({ path: path.join(artifactDir, 'seq_04_show_as_cartoon_chainA.png') });

    console.log("LIVE BROWSER BEHAVIORAL SEQUENCE FULLY VERIFIED (100% SUCCESS)!");

  } finally {
    await browser.close();
    await vite.close();
    server.close();
  }
}

runBrowserSequence().catch(e => {
  console.error("BROWSER TEST ERROR:", e);
  process.exit(1);
});
