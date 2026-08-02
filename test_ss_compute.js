import puppeteer from 'puppeteer';
(async () => {
  const browser = await puppeteer.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  const page = await browser.newPage();
  page.on('console', msg => console.log('PAGE LOG:', msg.text()));
  await page.setContent(`
    <!DOCTYPE html>
    <html>
    <head><script src="https://3dmol.csb.pitt.edu/build/3Dmol.js"></script></head>
    <body>
    <script>
    const viewer = $3Dmol.createViewer(document.createElement('div'));
    fetch("https://files.rcsb.org/download/1HVR.pdb").then(r => r.text()).then(pdb => {
      const cleanPdb = pdb.split('\\n').filter(l => !l.startsWith('HELIX') && !l.startsWith('SHEET')).join('\\n');
      viewer.addModel(cleanPdb, "pdb");
      const m = viewer.getModel(0);
      const atoms = m.selectedAtoms({});
      let h = 0, s = 0, c = 0;
      atoms.forEach(a => {
        if (a.ss === 'h') h++;
        else if (a.ss === 's') s++;
        else c++;
      });
      console.log("SS counts: h=" + h + ", s=" + s + ", c=" + c);
    });
    </script>
    </body>
    </html>
  `, { waitUntil: 'networkidle0' });
  await browser.close();
})();
