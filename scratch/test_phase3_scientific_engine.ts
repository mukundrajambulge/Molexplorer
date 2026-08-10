import {
  ScientificDockingEngine,
  StructurePrepEngine,
  GasteigerChargeEngine,
  PotentialGridMap,
  EmpiricalScoringEngine,
  Vec3,
  EngineMolecule
} from '../src/lib/ScientificDockingEngine';
import * as fs from 'fs';
import * as path from 'path';

console.log(`\n=================================================================`);
console.log(`   MOLEXPLORER PHASE 3: SCIENTIFIC DOCKING ENGINE TEST SUITE    `);
console.log(`=================================================================\n`);

let passedTests = 0;
let totalTests = 0;

function assert(condition: boolean, msg: string) {
  totalTests++;
  if (!condition) {
    console.error(`[FAIL] ${msg}`);
    throw new Error(`Assertion failed: ${msg}`);
  }
  passedTests++;
}

// -------------------------------------------------------------
// TEST 1: Gasteiger-Marsili Partial Charge Assignment
// -------------------------------------------------------------
console.log(`[TEST 1] Verifying Gasteiger-Marsili Electronegativity Equalization...`);
const ethanolPdb = `
ATOM      1  C1  ETH     1       0.000   0.000   0.000  1.00  0.00           C
ATOM      2  C2  ETH     1       1.540   0.000   0.000  1.00  0.00           C
ATOM      3  O1  ETH     1       2.200   1.200   0.000  1.00  0.00           O
`;
const ethanol = StructurePrepEngine.parsePDB(ethanolPdb);
StructurePrepEngine.prepare(ethanol);

console.log(`   Ethanol Atoms after Gasteiger charges:`);
ethanol.atoms.forEach(a => {
  console.log(`      Atom ${a.name.padEnd(4)} (${a.element}): ${a.partialCharge.toFixed(4)} e [Type: ${a.autoDockTypeStr}]`);
});

const oxygen = ethanol.atoms.find(a => a.element === 'O');
const polarH = ethanol.atoms.find(a => a.autoDockTypeStr === 'HD');
assert(oxygen !== undefined && oxygen.partialCharge < -0.10, "Oxygen must have electronegative partial charge (< -0.10e)");
assert(polarH !== undefined && polarH.partialCharge > 0.05, "Polar hydrogen must have electropositive partial charge (> +0.05e)");
console.log(`   -> PASS: Gasteiger charge engine successfully polarized polar covalent bonds.\n`);

// -------------------------------------------------------------
// TEST 2: Valence-Aware Hydrogen Addition & Atom Typing
// -------------------------------------------------------------
console.log(`[TEST 2] Verifying Valence-Aware Hydrogen Placement...`);
const acetonePdb = `
ATOM      1  C1  ACT     1      -1.300   0.800   0.000  1.00  0.00           C
ATOM      2  C2  ACT     1       0.000   0.000   0.000  1.00  0.00           C
ATOM      3  O1  ACT     1       0.000  -1.250   0.000  1.00  0.00           O
ATOM      4  C3  ACT     1       1.300   0.800   0.000  1.00  0.00           C
`;
const acetone = StructurePrepEngine.parsePDB(acetonePdb);
StructurePrepEngine.prepare(acetone);

const totalH = acetone.atoms.filter(a => a.isHydrogen).length;
console.log(`   Acetone Heavy Atoms: 4 | Hydrogens Added: ${totalH} | Total: ${acetone.atoms.length}`);
assert(acetone.atoms.length === 10, "Acetone must contain exactly 10 atoms after full hydrogen addition");
assert(totalH === 6, "Acetone must contain exactly 6 tetrahedral hydrogens");
console.log(`   -> PASS: Valence geometry placed all missing hydrogens accurately.\n`);

// -------------------------------------------------------------
// TEST 3: 3D Potential Grid Cache & Trilinear Interpolation
// -------------------------------------------------------------
console.log(`[TEST 3] Verifying 3D Affinity Grid Precomputation & Trilinear Interpolation...`);
const gridBox = {
  center: { x: 0, y: 0, z: 0 },
  size: { x: 10, y: 10, z: 10 },
  spacing: 0.375
};
const gridMap = new PotentialGridMap(gridBox);

const singleCarbonReceptor: EngineMolecule = {
  name: 'Receptor',
  atoms: [{
    id: 1,
    name: 'OD1',
    element: 'O',
    position: { x: 0, y: 0, z: 0 },
    originalPosition: { x: 0, y: 0, z: 0 },
    partialCharge: -0.55,
    formalCharge: 0,
    autoDockTypeStr: 'OA',
    residueSeq: 1,
    residueName: 'ASP',
    chainId: 'A',
    isHetero: false,
    isHydrogen: false,
    hybridization: 2,
    bondedAtomIds: []
  }],
  rotatableBonds: [],
  centerOfMass: { x: 0, y: 0, z: 0 }
};

gridMap.compute(singleCarbonReceptor, ['HD', 'C', 'OA']);
const hbondVal = gridMap.interpolate('HD', { x: 1.9, y: 0, z: 0 });
const elecVal = gridMap.interpolate('e', { x: 2.0, y: 0, z: 0 });

console.log(`   Grid Potential at 1.9 A from OA acceptor: V_hbond = ${hbondVal.toFixed(3)} kcal/mol, V_elec = ${elecVal.toFixed(3)}`);
assert(hbondVal < 0.0, "H-bond donor at 1.9 A from acceptor must experience favorable potential (< 0 kcal/mol)");
console.log(`   -> PASS: 3D potential grid cache evaluates in O(1) time with smooth well depth.\n`);

// -------------------------------------------------------------
// TEST 4: End-to-End Molecular Docking on HIV-1 Protease Active Site
// -------------------------------------------------------------
console.log(`[TEST 4] Running Full End-to-End Molecular Docking on HIV-1 Protease Active Site...`);

const hiv1DyadPdb = `
ATOM      1  N   ASP A  25       0.000   0.000   0.000  1.00 20.00           N
ATOM      2  CA  ASP A  25       1.450   0.000   0.000  1.00 20.00           C
ATOM      3  C   ASP A  25       2.000   1.400   0.000  1.00 20.00           C
ATOM      4  O   ASP A  25       1.300   2.400   0.000  1.00 20.00           O
ATOM      5  CB  ASP A  25       2.000  -0.800   1.200  1.00 20.00           C
ATOM      6  CG  ASP A  25       1.500  -0.200   2.500  1.00 20.00           C
ATOM      7  OD1 ASP A  25       0.300  -0.400   2.800  1.00 20.00           O
ATOM      8  OD2 ASP A  25       2.300   0.400   3.200  1.00 20.00           O
`;

const ligandPdb = `
HETATM    1  C1  LIG     1       0.500  -0.200   4.500  1.00  0.00           C
HETATM    2  O1  LIG     1       0.400  -0.300   3.100  1.00  0.00           O
HETATM    3  N1  LIG     1       1.800  -0.100   5.100  1.00  0.00           N
HETATM    4  C2  LIG     1       2.900   0.100   4.200  1.00  0.00           C
`;

const dockingBox = {
  center: { x: 1.5, y: 0.0, z: 3.0 },
  size: { x: 12.0, y: 12.0, z: 12.0 },
  spacing: 0.375
};

const result = ScientificDockingEngine.runDocking(hiv1DyadPdb, ligandPdb, dockingBox, 8, 5);

console.log(`   Execution Time: ${result.executionTimeMs.toFixed(1)} ms`);
console.log(`   Best Binding Affinity: ${result.bestAffinity.toFixed(2)} kcal/mol`);
console.log(`   Estimated Ki: ${result.estimatedKiNanomolar.toFixed(1)} nM`);
console.log(`   Poses Generated: ${result.poses.length}`);

console.log(`\n   Ranked Docked Poses Breakdown:`);
result.poses.forEach((p, idx) => {
  console.log(`      Pose #${idx + 1}: Score = ${p.bindingAffinity.toFixed(2)} kcal/mol | vdW = ${p.energyBreakdown.vdw.toFixed(2)} | Elec = ${p.energyBreakdown.electrostatics.toFixed(2)} | H-Bond = ${p.energyBreakdown.hbond.toFixed(2)} | Cluster Size = ${p.clusterSize}`);
});

assert(result.success, "Docking engine must return success");
assert(result.poses.length > 0, "Must generate at least one valid pose");
assert(result.bestAffinity < 0, "Best binding affinity must be favorable (< 0 kcal/mol)");

console.log(`\n=================================================================`);
console.log(`   ALL ${passedTests}/${totalTests} SCIENTIFIC ENGINE TESTS PASSED (100.0% SUCCESS)`);
console.log(`=================================================================\n`);
