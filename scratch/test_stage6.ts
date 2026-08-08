import { CCP4Parser } from '../src/parsers/CCP4Parser';
import { generateIsosurfaceMesh } from '../src/lib/MarchingCubes';
import { getRotamersForResidue, detectStericClashes, rotateAroundAxis } from '../src/lib/RotamerLibrary';
import { alignStructures } from '../src/lib/Alignment';
import { Atom, MolProcessor } from '../src/lib/MolProcessor';

function runStage6Tests() {
  console.log("==================================================");
  console.log("    STAGE 6: WIZARDS & MAPS TEST SUITE            ");
  console.log("==================================================\n");

  let total = 0;
  let passed = 0;

  // 1. Test Synthetic CCP4 Binary Header & Grid Generation
  total++;
  try {
    const buffer = new ArrayBuffer(1024 + 10 * 10 * 10 * 4);
    const view = new DataView(buffer);

    // Write header fields
    view.setInt32(0, 10, true);  // NC
    view.setInt32(4, 10, true);  // NR
    view.setInt32(8, 10, true);  // NS
    view.setInt32(12, 2, true);  // Mode 2 (Float32)
    view.setInt32(28, 10, true); // NX
    view.setInt32(32, 10, true); // NY
    view.setInt32(36, 10, true); // NZ
    view.setFloat32(40, 20.0, true); // Cell A
    view.setFloat32(44, 20.0, true); // Cell B
    view.setFloat32(48, 20.0, true); // Cell C
    view.setFloat32(52, 90.0, true); // Alpha
    view.setFloat32(56, 90.0, true); // Beta
    view.setFloat32(60, 90.0, true); // Gamma

    // Write 3D Gaussian electron density values into voxel array
    const floats = new Float32Array(buffer, 1024, 1000);
    for (let k = 0; k < 10; k++) {
      for (let j = 0; j < 10; j++) {
        for (let i = 0; i < 10; i++) {
          const dx = i - 5, dy = j - 5, dz = k - 5;
          const idx = i + j * 10 + k * 100;
          floats[idx] = Math.exp(-(dx * dx + dy * dy + dz * dz) / 4.0);
        }
      }
    }

    const parser = new CCP4Parser(buffer);
    if (parser.header.NC !== 10 || parser.header.xLength !== 20.0) {
      throw new Error(`CCP4 Header mismatch: NC=${parser.header.NC}, CellA=${parser.header.xLength}`);
    }

    // Run Marching Cubes at 0.5 sigma contour
    const mesh = generateIsosurfaceMesh(parser, 0.5);
    if (mesh.triangleCount === 0 || mesh.positions.length === 0) {
      throw new Error("Marching Cubes generated 0 triangles for 3D Gaussian density sphere!");
    }

    console.log(`  [PASS] CCP4 Parser & Marching Cubes Isosurfacing -> Generated ${mesh.triangleCount} triangles`);
    passed++;
  } catch (err: any) {
    console.error(`  [FAIL] CCP4 & Marching Cubes -> ${err.message}`);
  }

  // 2. Test Mutagenesis & Rotamer Library
  total++;
  try {
    const pheRotamers = getRotamersForResidue('PHE');
    if (pheRotamers.length < 3) {
      throw new Error(`Expected >=3 PHE rotamers, found ${pheRotamers.length}`);
    }

    // Test Rodrigues rotation formula around axis (0, 0, 1) by 90 degrees (PI/2)
    const rotated = rotateAroundAxis({ x: 1, y: 0, z: 0 }, { x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 1 }, Math.PI / 2);
    if (Math.abs(rotated.x) > 1e-4 || Math.abs(rotated.y - 1.0) > 1e-4) {
      throw new Error(`Rodrigues rotation error: expected (0, 1, 0), got (${rotated.x.toFixed(4)}, ${rotated.y.toFixed(4)}, ${rotated.z.toFixed(4)})`);
    }

    // Test Steric Clash Detection
    const dummyAtoms1: Atom[] = [{ serial: 1, name: 'CA', resName: 'ALA', resSeq: 1, chainID: 'A', x: 0, y: 0, z: 0, elem: 'C' }];
    const dummyAtoms2: Atom[] = [{ serial: 2, name: 'CA', resName: 'VAL', resSeq: 2, chainID: 'A', x: 0.5, y: 0, z: 0, elem: 'C' }]; // Extreme 0.5Å overlap
    const clashReport = detectStericClashes(dummyAtoms1, dummyAtoms2);

    if (clashReport.clashCount !== 1) {
      throw new Error(`Expected 1 clash for 0.5Å distance, got ${clashReport.clashCount}`);
    }

    console.log(`  [PASS] Mutagenesis & Dunbrack Rotamer Engine -> Rodrigues rotation & Steric clashes verified (${clashReport.clashCount} clashes)`);
    passed++;
  } catch (err: any) {
    console.error(`  [FAIL] Mutagenesis & Rotamers -> ${err.message}`);
  }

  // 3. Test SVD Kabsch Pair Fitting Superposition
  total++;
  try {
    const refPdb = `ATOM      1  CA  ALA A   1       0.000   0.000   0.000  1.00  0.00           C
ATOM      2  CA  ALA A   2       5.000   0.000   0.000  1.00  0.00           C
ATOM      3  CA  ALA A   3       5.000   5.000   0.000  1.00  0.00           C`;
    
    // Shift target PDB by +10Å along X
    const targetPdb = `ATOM      1  CA  ALA B   1      10.000   0.000   0.000  1.00  0.00           C
ATOM      2  CA  ALA B   2      15.000   0.000   0.000  1.00  0.00           C
ATOM      3  CA  ALA B   3      15.000   5.000   0.000  1.00  0.00           C`;

    const atomsA = new MolProcessor(refPdb, 'pdb').atoms;
    const atomsB = new MolProcessor(targetPdb, 'pdb').atoms;

    const alignRes = alignStructures(atomsA, atomsB);
    if (alignRes.rmsd > 0.01) {
      throw new Error(`Kabsch SVD Pair Fitting RMSD error: expected ~0.00Å, got ${alignRes.rmsd.toFixed(4)}Å`);
    }

    console.log(`  [PASS] SVD Kabsch Pair Fit Superposition -> Perfectly aligned translated structure (RMSD = ${alignRes.rmsd.toFixed(4)}Å)`);
    passed++;
  } catch (err: any) {
    console.error(`  [FAIL] SVD Kabsch Pair Fit -> ${err.message}`);
  }

  console.log("\n==================================================");
  console.log(`TEST RESULTS: ${passed} / ${total} Passed (${((passed/total)*100).toFixed(1)}%)`);
  console.log("==================================================");

  if (passed !== total) {
    process.exit(1);
  }
}

runStage6Tests();
