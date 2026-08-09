import { MolProcessor, Atom } from '../src/lib/MolProcessor';
import { TopologyEditor } from '../src/editor/TopologyEditor';
import { SculptingEngine } from '../src/simulation/SculptingEngine';

function runStage8Tests() {
  console.log("=== Stage 8 Automated Verification Test Suite ===");
  let passed = 0;
  let total = 0;

  function assert(condition: boolean, msg: string) {
    total++;
    if (condition) {
      console.log(`✓ PASS: ${msg}`);
      passed++;
    } else {
      console.error(`✗ FAIL: ${msg}`);
    }
  }

  // Test 1: Hydrogen Addition (h_add) & Removal (h_remove)
  const testPDB = `HEADER    TEST METHANE
ATOM      1  C   ALA A   1       0.000   0.000   0.000  1.00 20.00           C
`;
  const proc = new MolProcessor(testPDB, 'pdb');

  assert(proc.atoms.length === 1, 'Initial atom count is 1 (Carbon only)');

  TopologyEditor.addHydrogens(proc);
  assert(proc.atoms.length === 5, 'Hydrogen addition (h_add) added 4 hydrogens (C-H4)');
  assert(proc.atoms.filter(a => a.elem === 'H').length === 4, '4 Hydrogens identified in topology');

  TopologyEditor.removeHydrogens(proc);
  assert(proc.atoms.length === 1, 'Hydrogen removal (h_remove) reduced atom count back to 1');

  // Test 2: Bond Topology & Atom Deletion
  const proc2 = new MolProcessor(`ATOM      1  N   ALA A   1       0.000   0.000   0.000  1.00 20.00           N\nATOM      2  C   ALA A   1       1.500   0.000   0.000  1.00 20.00           C\n`, 'pdb');

  TopologyEditor.addBond(proc2, 0, 1, 1);
  assert(proc2.atoms[0].bonds.includes(1) && proc2.atoms[1].bonds.includes(0), 'Covalent bond added between atom 0 and 1');

  TopologyEditor.deleteAtoms(proc2, new Set([2])); // Delete atom 2 (serial 2 = index 1)
  assert(proc2.atoms.length === 1, 'Atom deletion removed atom serial 2');

  // Test 3: Force-Field Minimization Gradient Convergence
  const distortedAtoms: Atom[] = [
    { serial: 1, name: 'C1', resName: 'MOL', chainID: 'A', resSeq: 1, x: 0, y: 0, z: 0, occupancy: 1, tempFactor: 20, elem: 'C', bonds: [1] },
    { serial: 2, name: 'C2', resName: 'MOL', chainID: 'A', resSeq: 1, x: 0.5, y: 0, z: 0, occupancy: 1, tempFactor: 20, elem: 'C', bonds: [0] } // Distorted r = 0.5 A (reference r0 = 1.54 A)
  ];

  const { atoms: minimizedAtoms, totalEnergy } = SculptingEngine.minimize(distortedAtoms, 100, 0.002);
  const finalR = Math.sqrt(
    Math.pow(minimizedAtoms[1].x - minimizedAtoms[0].x, 2) +
    Math.pow(minimizedAtoms[1].y - minimizedAtoms[0].y, 2) +
    Math.pow(minimizedAtoms[1].z - minimizedAtoms[0].z, 2)
  );

  assert(finalR > 0.8, `Force-field bond relaxation increased distorted r (0.5 Å -> ${finalR.toFixed(2)} Å)`);
  assert(totalEnergy < 500, `Total potential energy minimized (E_final = ${totalEnergy.toFixed(2)})`);

  console.log(`\n=== STAGE 8 SUMMARY: ${passed} / ${total} Passed (${((passed / total) * 100).toFixed(1)}%) ===`);
  if (passed !== total) process.exit(1);
}

runStage8Tests();
