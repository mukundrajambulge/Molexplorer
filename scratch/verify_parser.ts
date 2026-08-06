import fs from 'fs';
import path from 'path';
import { MolProcessor } from '../src/lib/MolProcessor.js';

interface TestResult {
  name: string;
  passed: boolean;
  durationMs: number;
  details?: string;
  error?: string;
}

const testResults: TestResult[] = [];
let totalAssertions = 0;
let failedAssertions = 0;

function assert(condition: boolean, message: string) {
  totalAssertions++;
  if (!condition) {
    failedAssertions++;
    throw new Error(`Assertion Failed: ${message}`);
  }
}

function runTest(name: string, testFn: () => void) {
  const start = performance.now();
  try {
    testFn();
    const durationMs = performance.now() - start;
    testResults.push({ name, passed: true, durationMs });
    console.log(`  ✓ ${name} (${durationMs.toFixed(2)} ms)`);
  } catch (err: any) {
    const durationMs = performance.now() - start;
    testResults.push({ name, passed: false, durationMs, error: err.message });
    console.error(`  ✗ ${name} (${durationMs.toFixed(2)} ms): ${err.message}`);
  }
}

console.log('====================================================');
console.log(' MolProcessor QA Automation & Verification Suite');
console.log('====================================================\n');

const pdbFilePath = path.resolve('1HVR.pdb');
assert(fs.existsSync(pdbFilePath), `PDB sample file found at ${pdbFilePath}`);
const rawPDB = fs.readFileSync(pdbFilePath, 'utf-8');

let processor: MolProcessor;
let parseLatencyMs = 0;

// ----------------------------------------------------
// Test 1: PDB Loading & Latency Benchmark
// ----------------------------------------------------
runTest('PDB Parsing & Atom Loading Latency', () => {
  const start = performance.now();
  processor = new MolProcessor(rawPDB, 'pdb');
  parseLatencyMs = performance.now() - start;
  
  assert(processor.atoms.length > 0, `Atoms loaded: ${processor.atoms.length}`);
  assert(processor.atoms.length === 1890, `Expected 1890 atoms in 1HVR.pdb, found ${processor.atoms.length}`);
  console.log(`    Parsed ${processor.atoms.length} atoms in ${parseLatencyMs.toFixed(3)} ms`);
});

// ----------------------------------------------------
// Test 2: Atom Coordinate Mapping & Precision
// ----------------------------------------------------
runTest('Atom Coordinate Mapping Precision', () => {
  // First Atom: ATOM 1 N PRO A 1 (-12.735, 38.918, 31.287)
  const atom1 = processor.atoms[0];
  assert(atom1.serial === 1, `Atom 1 serial is ${atom1.serial}`);
  assert(atom1.name.trim() === 'N', `Atom 1 name is ${atom1.name}`);
  assert(atom1.resName.trim() === 'PRO', `Atom 1 resName is ${atom1.resName}`);
  assert(atom1.chainID === 'A', `Atom 1 chainID is ${atom1.chainID}`);
  assert(atom1.resSeq === 1, `Atom 1 resSeq is ${atom1.resSeq}`);
  assert(Math.abs(atom1.x - (-12.735)) < 1e-4, `Atom 1 X coord match: ${atom1.x}`);
  assert(Math.abs(atom1.y - 38.918) < 1e-4, `Atom 1 Y coord match: ${atom1.y}`);
  assert(Math.abs(atom1.z - 31.287) < 1e-4, `Atom 1 Z coord match: ${atom1.z}`);
  assert(atom1.isHetero === false, `Atom 1 isHetero should be false`);

  // Terminal Atom Chain A: ATOM 914 OXT PHE A 99
  const atomChainAEnd = processor.atoms.find(a => a.chainID === 'A' && a.resSeq === 99 && a.name.trim() === 'OXT');
  assert(atomChainAEnd !== undefined, 'Found terminal OXT atom in Chain A');
  if (atomChainAEnd) {
    assert(atomChainAEnd.resName.trim() === 'PHE', `Residue is PHE`);
    assert(atomChainAEnd.chainID === 'A', `Chain ID is A`);
  }

  // Ligand Atom: HETATM 1892 C79 XK2 A 263 (-8.574, 16.252, 31.962)
  const lastAtom = processor.atoms[processor.atoms.length - 1];
  assert(lastAtom.serial === 1892, `Last atom serial is 1892 (got ${lastAtom.serial})`);
  assert(lastAtom.name.trim() === 'C79', `Last atom name is C79 (got ${lastAtom.name.trim()})`);
  assert(lastAtom.resName.trim() === 'XK2', `Last atom resName is XK2`);
  assert(lastAtom.chainID === 'A', `Last atom chainID is A`);
  assert(lastAtom.resSeq === 263, `Last atom resSeq is 263`);
  assert(Math.abs(lastAtom.x - (-8.574)) < 1e-4, `Last atom X coord match: ${lastAtom.x}`);
  assert(Math.abs(lastAtom.y - 16.252) < 1e-4, `Last atom Y coord match: ${lastAtom.y}`);
  assert(Math.abs(lastAtom.z - 31.962) < 1e-4, `Last atom Z coord match: ${lastAtom.z}`);
  assert(lastAtom.isHetero === true, `Last atom isHetero should be true`);
});

// ----------------------------------------------------
// Test 3: Element Classification & Fallback Decoding
// ----------------------------------------------------
runTest('Element Classification & Fallback Decoding', () => {
  const elements = new Set(processor.atoms.map(a => a.elem));
  assert(elements.has('N'), 'Contains Nitrogen');
  assert(elements.has('C'), 'Contains Carbon');
  assert(elements.has('O'), 'Contains Oxygen');
  assert(elements.has('S'), 'Contains Sulfur');
  assert(elements.has('H'), 'Contains Hydrogen');

  // Test fallback element parsing when column 76-78 is empty
  const mockPDBNoElem = 
`ATOM      1  N   PRO A   1     -12.735  38.918  31.287  1.00 39.83           
ATOM      2  CA  PRO A   1     -12.709  39.097  29.830  1.00 39.29           
HETATM    3 FE   HEM A 100       0.000   0.000   0.000  1.00 10.00           `;

  const fallbackProc = new MolProcessor(mockPDBNoElem, 'pdb');
  assert(fallbackProc.atoms[0].elem === 'N', `Derived element 'N' from atom name 'N'`);
  assert(fallbackProc.atoms[1].elem === 'C', `Derived element 'C' from atom name 'CA'`);
  assert(fallbackProc.atoms[2].elem === 'F', `Derived element 'F' from atom name 'FE' fallback logic`);
});

// ----------------------------------------------------
// Test 4: Chain Identification & Residue Sequencing
// ----------------------------------------------------
runTest('Chain Identification & Residue Sequencing', () => {
  const chains = Array.from(new Set(processor.atoms.map(a => a.chainID))).sort();
  assert(chains.length === 2 && chains[0] === 'A' && chains[1] === 'B', `Identified chains A and B`);

  // Include protein residues 1..99 (including CSO 67 which is HETATM in PDB)
  const chainAResidues = Array.from(new Set(processor.atoms.filter(a => a.chainID === 'A' && a.resName.trim() !== 'XK2').map(a => a.resSeq))).sort((a,b)=>a-b);
  const chainBResidues = Array.from(new Set(processor.atoms.filter(a => a.chainID === 'B').map(a => a.resSeq))).sort((a,b)=>a-b);

  assert(chainAResidues.length === 99, `Chain A has 99 residues (min: ${Math.min(...chainAResidues)}, max: ${Math.max(...chainAResidues)})`);
  assert(chainBResidues.length === 99, `Chain B has 99 residues (min: ${Math.min(...chainBResidues)}, max: ${Math.max(...chainBResidues)})`);
});

// ----------------------------------------------------
// Test 5: Ligand Extraction & Hetero Atom Grouping
// ----------------------------------------------------
runTest('Ligand Extraction & Grouping', () => {
  const ligands = processor.getLigands();
  assert(ligands.length >= 1, `Found ${ligands.length} ligand group(s)`);
  
  const xk2Ligand = ligands.find(group => group[0].resName.trim() === 'XK2');
  assert(xk2Ligand !== undefined, 'Extracted XK2 inhibitor ligand');
  if (xk2Ligand) {
    assert(xk2Ligand.length === 46, `XK2 ligand contains 46 atoms (got ${xk2Ligand.length})`);
    assert(xk2Ligand[0].chainID === 'A', 'XK2 ligand belongs to Chain A');
    assert(xk2Ligand[0].resSeq === 263, 'XK2 ligand residue sequence is 263');
  }
});

// ----------------------------------------------------
// Test 6: Spatial Hashing Bond Assignment Performance
// ----------------------------------------------------
runTest('Bond Assignment & Spatial Hashing', () => {
  const start = performance.now();
  processor.assignBonds(1.2);
  const durationMs = performance.now() - start;

  let totalBonds = 0;
  processor.atoms.forEach(a => totalBonds += a.bonds.length);
  assert(totalBonds > 0, `Assigned total ${totalBonds / 2} unique bonds`);
  console.log(`    Assigned ${totalBonds / 2} bonds in ${durationMs.toFixed(3)} ms`);
});

// ----------------------------------------------------
// Test 7: Secondary Structure Calculation Modes
// ----------------------------------------------------
runTest('Secondary Structure Calculation Modes (PDB, Quick, DSSP)', () => {
  // PDB Header mode
  const tPdbStart = performance.now();
  processor.calculateSecondaryStructure('pdb');
  const tPdb = performance.now() - tPdbStart;
  const helicesPdb = processor.ss_per_residue.filter(r => r.ss_type === 'helix').length;
  const sheetsPdb = processor.ss_per_residue.filter(r => r.ss_type === 'sheet').length;
  assert(helicesPdb > 0, `PDB SS mode assigned ${helicesPdb} helix residues`);
  assert(sheetsPdb > 0, `PDB SS mode assigned ${sheetsPdb} sheet residues`);

  // Quick Dihedral mode
  const tQuickStart = performance.now();
  processor.calculateSecondaryStructure('quick');
  const tQuick = performance.now() - tQuickStart;
  assert(processor.ss_per_residue.length > 0, `Quick SS mode generated ${processor.ss_per_residue.length} residue info records`);

  // DSSP H-bond Energy mode
  const tDsspStart = performance.now();
  processor.calculateSecondaryStructure('dssp');
  const tDssp = performance.now() - tDsspStart;
  assert(processor.ss_per_residue.length > 0, `DSSP SS mode generated ${processor.ss_per_residue.length} residue info records`);

  console.log(`    SS Execution Latency: PDB=${tPdb.toFixed(2)}ms, Quick=${tQuick.toFixed(2)}ms, DSSP=${tDssp.toFixed(2)}ms`);
});

// ----------------------------------------------------
// Test 8: Structure Manipulation & Formatting
// ----------------------------------------------------
runTest('Structure Modification (AltLoc, Solvents, Hydrogens, Formatting)', () => {
  const p = new MolProcessor(rawPDB, 'pdb');
  const initCount = p.atoms.length;

  p.filterAltlocs();
  assert(p.atoms.length <= initCount, 'Filter altLocs preserves valid atoms');

  p.stripSolvent();
  assert(p.atoms.length <= initCount, 'Strip solvent completes cleanly');

  const p2 = new MolProcessor(rawPDB, 'pdb');
  p2.assignBonds(1.2);
  const countBeforeH = p2.atoms.length;
  p2.addHydrogens();
  assert(p2.atoms.length > countBeforeH, `Added ${p2.atoms.length - countBeforeH} modeled hydrogens`);

  const pdbOut = p2.toPDB();
  assert(pdbOut.includes('ATOM') && pdbOut.includes('CONECT'), 'toPDB outputs valid PDB formatted text with CONECT records');
});

// ----------------------------------------------------
// Test 9: Crystallographic Symmetry & Biological Assembly
// ----------------------------------------------------
runTest('Crystallographic Symmetry & Biological Assembly Parsing', () => {
  assert(processor.hasCryst1 === true, 'CRYST1 unit cell record detected');
  
  const symmRes = processor.generateSymmetryPDB();
  assert(typeof symmRes.pdb === 'string', 'generateSymmetryPDB returns string');

  // Test BIOMT Remark Parsing
  const pdbWithBiomt = 
`REMARK 350 BIOMOLECULE: 1
REMARK 350 APPLY THE FOLLOWING TO CHAINS: A
REMARK 350   BIOMT1   1  1.000000  0.000000  0.000000        0.00000
REMARK 350   BIOMT2   1  0.000000  1.000000  0.000000        0.00000
REMARK 350   BIOMT3   1  0.000000  0.000000  1.000000        0.00000
REMARK 350   BIOMT1   2 -1.000000  0.000000  0.000000       10.00000
REMARK 350   BIOMT2   2  0.000000 -1.000000  0.000000       20.00000
REMARK 350   BIOMT3   2  0.000000  0.000000  1.000000       30.00000
ATOM      1  N   PRO A   1     -12.735  38.918  31.287  1.00 39.83           N  `;

  const biomtProc = new MolProcessor(pdbWithBiomt, 'pdb');
  assert(biomtProc.assemblies.length === 1, 'Parsed 1 biological assembly');
  assert(biomtProc.assemblies[0].id === '1', 'Assembly ID is 1');
  assert(biomtProc.assemblies[0].operations[0].matrices.length === 2, 'Parsed 2 BIOMT matrices');
  
  const generatedAssy = biomtProc.generateAssemblyPDB('1');
  assert(generatedAssy.pdb.includes('ATOM'), 'Generated biological assembly PDB content');
});

// ----------------------------------------------------
// Test 10: MMTF Format Parsing Handler & Fallback Path
// ----------------------------------------------------
runTest('MMTF Format Parser Initializer', () => {
  const dummyMmtf = new Uint8Array([0x00, 0x01, 0x02]);
  const mmtfProc = new MolProcessor(dummyMmtf, 'mmtf');
  assert(Array.isArray(mmtfProc.atoms), 'MMTF parser produces atoms array');
  assert(mmtfProc.rawPDB === '', 'MMTF parser sets rawPDB to empty');
});

// ----------------------------------------------------
// Summary & Performance Metrics Logging
// ----------------------------------------------------
const totalTests = testResults.length;
const passedTests = testResults.filter(r => r.passed).length;
const failedTests = totalTests - passedTests;
const totalDuration = testResults.reduce((acc, r) => acc + r.durationMs, 0);
const errorRatePct = totalAssertions > 0 ? (failedAssertions / totalAssertions) * 100 : 0;

console.log('\n====================================================');
console.log(' Verification Summary & Performance Metrics');
console.log('====================================================');
console.log(`Total Test Suites   : ${totalTests}`);
console.log(`Passed Suites       : ${passedTests}`);
console.log(`Failed Suites       : ${failedTests}`);
console.log(`Total Assertions    : ${totalAssertions}`);
console.log(`Failed Assertions   : ${failedAssertions}`);
console.log(`Error Rate          : ${errorRatePct.toFixed(2)}%`);
console.log(`Parse Latency (1HVR): ${parseLatencyMs.toFixed(3)} ms`);
console.log(`Total Execution Time: ${totalDuration.toFixed(2)} ms`);
console.log('====================================================\n');

if (failedTests > 0) {
  console.error(`VERIFICATION FAILED: ${failedTests} suite(s) failed.`);
  process.exit(1);
} else {
  console.log('VERIFICATION PASSED: All tests passed successfully.');
  process.exit(0);
}
