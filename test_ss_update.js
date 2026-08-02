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
    <div id="container" style="width: 400px; height: 400px; position: relative;"></div>
    <script>
    fetch("https://files.rcsb.org/download/1HVR.pdb").then(r => r.text()).then(pdb => {
      // Remove HELIX/SHEET
      const cleanPdb = pdb.split('\\n').filter(l => !l.startsWith('HELIX') && !l.startsWith('SHEET')).join('\\n');
      
      const viewer = $3Dmol.createViewer("container");
      viewer.addModel(cleanPdb, "pdb", { assignBonds: false });
      
      const m = viewer.getModel(0);
      const atoms = m.selectedAtoms({});
      atoms.forEach(a => {
        if (a.resi >= 86 && a.resi <= 94) a.ss = 'h';
        else if (a.resi >= 1 && a.resi <= 4) a.ss = 's';
        else a.ss = 'c';
      });
      
      viewer.setStyle({hetflag: false}, { cartoon: { color: 'spectrum', arrows: true } });
      viewer.render();
      console.log("Rendered!");
    });
    </script>
    </body>
    </html>
  `, { waitUntil: 'networkidle0' });
  await browser.close();
})();
