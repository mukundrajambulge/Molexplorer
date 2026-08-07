# Visual Regression Test Report (Crambin 1CRN)

This report presents the visual outcomes of the automated headless browser validation suite. The tests verify structure fetching, WebGL rendering styles, color mappings, and the PyMOL selection console.

All screenshots were taken dynamically by a Puppeteer script navigating `http://localhost:5173/molstudio` on your system.

---

## 📸 Test Execution Screenshots

### 1. Initial Load & Render
This verifies PDB coordinate parsing, backbone ribbon construction, and default scene centering.
- **Expected**: Structure centered, colored in Rainbow spectrum.
- **Result**: **PASSED**

![1CRN Initial Load](file:///C:/Users/mukun/.gemini/antigravity/brain/86ba0017-cb90-4a97-b810-88a7266b3c45/1crn_initial_load.png)

---

### 2. Putty Representation Style
This verifies crystallographic B-factor scaling on the tube radius.
- **Expected**: Variable tube thickness matching local residue temperature factors.
- **Result**: **PASSED**

![1CRN Putty Representation](file:///C:/Users/mukun/.gemini/antigravity/brain/86ba0017-cb90-4a97-b810-88a7266b3c45/1crn_putty_representation.png)

---

### 3. Classic CPK Cartoon & Color Scheme Correction
This verifies that element-based color schemes map correctly to standard CPK palettes and do not render black.
- **Expected**: Nitrogen in blue, oxygen in red, sulfur in yellow, carbon in gray.
- **Result**: **PASSED** (Molecules are fully colored and correct).

![1CRN Classic CPK Cartoon](file:///C:/Users/mukun/.gemini/antigravity/brain/86ba0017-cb90-4a97-b810-88a7266b3c45/1crn_classic_cpk_cartoon.png)

---

### 4. PyMOL Selection Query Console Verification
This verifies opening the interactive console and running a query.
- **Expected**: Query `ss h and not resn HOH` runs, selects the helix residues, and highlights them.
- **Result**: **PASSED**

![1CRN Selection Active](file:///C:/Users/mukun/.gemini/antigravity/brain/86ba0017-cb90-4a97-b810-88a7266b3c45/1crn_selection_active.png)
