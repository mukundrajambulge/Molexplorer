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
    const viewer = $3Dmol.createViewer("container");
    $3Dmol.download("pdb:1HVR", viewer, {doAssembly:false}, function() {
      const m = viewer.getModel(0);
      viewer.setStyle({hetflag: false}, { cartoon: { color: 'spectrum' } });
      viewer.render();
      const atoms = m.selectedAtoms({});
      console.log("Atom 1 color: " + (atoms[0].color || "undefined"));
      console.log("Atom 100 color: " + (atoms[100].color || "undefined"));
      console.log("Rendered!");
    });
    </script>
    </body>
    </html>
  `, { waitUntil: 'networkidle0' });
  await browser.close();
})();
