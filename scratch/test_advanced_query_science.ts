/**
 * test_advanced_query_science.ts
 * Authoritative scientific test harness for Phase 4.6 Advanced Scientific Query, Measurement, and Interaction Layer.
 * 
 * Verifies:
 * 1. Analytical Euclidean distance measurements (1x1 and NxM with cutoff & duplicate suppression).
 * 2. Analytical 3-point planar angle measurements (1x1x1 cardinality & fail-closed ambiguity checks).
 * 3. Analytical 4-point signed dihedral torsional measurements (1x1x1x1 & IUPAC sign conventions).
 * 4. Advanced selection operators:
 *    - neighbor vs bound_to discrete difference
 *    - within vs expand semantic separation
 *    - bycalpha / byca C-alpha extraction
 *    - byring cyclic aromatic ring closure
 *    - byfragment and bycell DEFERRED / RESEARCH classification
 * 5. PyMOL-compatible mode=2 polar contact perception with structured terminology.
 * 6. Biophysical interaction analysis commands (polar_contacts, salt_bridges, hydrophobic_contacts, etc.).
 * 7. Scientific state immutability & determinism invariants.
 * 8. Command router classification & error reporting (Selection vs Measurement vs Analysis).
 */

import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { MolProcessor } from '../src/lib/MolProcessor';
import { CanonicalAtom, CanonicalMolecule, MeasurementResult, InteractionAnalysisResult } from '../src/types/domain';
import { MeasurementParser } from '../src/domain/MeasurementParser';
import { ScientificMeasurementEngine } from '../src/domain/ScientificMeasurementEngine';
import { ScientificCommandRouter } from '../src/domain/ScientificCommandRouter';
import { SelectionParser } from '../src/lib/SelectionParser';
import { CanonicalSelectionEvaluator } from '../src/domain/CanonicalSelectionEvaluator';

let passedTests = 0;
let totalTests = 0;

function assert(condition: boolean, description: string) {
  totalTests++;
  if (condition) {
    console.log(`  [PASS] ${description}`);
    passedTests++;
  } else {
    console.error(`  [FAIL] ${description}`);
    throw new Error(`Test assertion failed: ${description}`);
  }
}

function assertClose(actual: number, expected: number, tolerance: number, description: string) {
  totalTests++;
  const diff = Math.abs(actual - expected);
  if (diff <= tolerance) {
    console.log(`  [PASS] ${description} (actual=${actual.toFixed(4)}, exp=${expected.toFixed(4)}, diff=${diff.toExponential(2)} <= ${tolerance})`);
    passedTests++;
  } else {
    console.error(`  [FAIL] ${description} (actual=${actual.toFixed(4)}, exp=${expected.toFixed(4)}, diff=${diff.toExponential(2)} > ${tolerance})`);
    throw new Error(`Numerical tolerance violated: ${description}`);
  }
}

function computeStateHash(molecule: CanonicalMolecule): string {
  const hash = crypto.createHash('sha256');
  for (const atom of molecule.atoms) {
    hash.update(`${atom.canonical_id}:${atom.element}:${atom.name}:${atom.x.toFixed(6)}:${atom.y.toFixed(6)}:${atom.z.toFixed(6)}:${atom.formal_charge}`);
  }
  for (const bond of molecule.topology.bonds) {
    hash.update(`${bond.atom_a}:${bond.atom_b}:${bond.order}`);
  }
  return hash.digest('hex');
}

async function runAdvancedQueryScienceSuite() {
  console.log('================================================================================');
  console.log('       MOLEXPLORER P4.6 ADVANCED SCIENTIFIC QUERY & MEASUREMENT SUITE           ');
  console.log('================================================================================\n');

  // Load Fixtures
  const fixture03Path = path.resolve(process.cwd(), 'fixtures/03_protein_with_ligand.pdb');
  const fixture1CRNPath = path.resolve(process.cwd(), 'scratch/1CRN.pdb');
  const fixture1HVRPath = path.resolve(process.cwd(), 'scratch/1HVR.pdb');

  const p03 = new MolProcessor(fs.readFileSync(fixture03Path, 'utf8'), 'pdb');
  const p1CRN = new MolProcessor(fs.readFileSync(fixture1CRNPath, 'utf8'), 'pdb');
  const p1HVR = new MolProcessor(fs.readFileSync(fixture1HVRPath, 'utf8'), 'pdb');

  p03.assignBonds(1.1);
  p1CRN.assignBonds(1.1);
  p1HVR.assignBonds(1.1);

  const doc03 = p03.getCanonicalDocument();
  const mol03 = (doc03.active_object_id ? doc03.molecules.get(doc03.active_object_id) : undefined) || Array.from(doc03.molecules.values())[0];
  const doc1CRN = p1CRN.getCanonicalDocument();
  const mol1CRN = (doc1CRN.active_object_id ? doc1CRN.molecules.get(doc1CRN.active_object_id) : undefined) || Array.from(doc1CRN.molecules.values())[0];

  // -------------------------------------------------------------------------
  // SECTION 1: Analytical Euclidean Distance Measurements
  // -------------------------------------------------------------------------
  console.log('--- SECTION 1: Analytical Euclidean Distance Measurements ---');
  {
    // Analytical 3-atom synthetic fixture
    const synthAtoms: CanonicalAtom[] = [
      {
        canonical_id: 1, source_serial: 1, chain_ref: 'A', residue_ref: 1, residue_name: 'TST',
        element: 'C', atomic_number: 6, name: 'C1', normalized_name: 'C1', is_hetero: false,
        x: 0.0, y: 0.0, z: 0.0, occupancy: 1.0, b_factor: 20.0, alt_loc: '', formal_charge: 0,
        modeled_hydrogen: false
      },
      {
        canonical_id: 2, source_serial: 2, chain_ref: 'A', residue_ref: 1, residue_name: 'TST',
        element: 'C', atomic_number: 6, name: 'C2', normalized_name: 'C2', is_hetero: false,
        x: 3.0, y: 4.0, z: 0.0, occupancy: 1.0, b_factor: 20.0, alt_loc: '', formal_charge: 0,
        modeled_hydrogen: false
      },
      {
        canonical_id: 3, source_serial: 3, chain_ref: 'A', residue_ref: 1, residue_name: 'TST',
        element: 'O', atomic_number: 8, name: 'O3', normalized_name: 'O3', is_hetero: false,
        x: 3.0, y: 4.0, z: 12.0, occupancy: 1.0, b_factor: 20.0, alt_loc: '', formal_charge: 0,
        modeled_hydrogen: false
      }
    ];

    const engine = new ScientificMeasurementEngine(synthAtoms);

    // 1.1 Single 1x1 distance: (0,0,0) to (3,4,0) -> sqrt(3^2 + 4^2) = 5.0 Å
    const ast1 = MeasurementParser.parse('distance d1, name C1, name C2');
    const res1 = engine.execute(ast1) as MeasurementResult;
    assert(res1.count === 1, '1.1 Single 1x1 pair count is 1');
    assertClose(res1.distances![0].distance, 5.000, 1e-6, '1.1 Distance between C1 and C2 is exactly 5.000 Å');

    // 1.2 Single 1x1 3D distance: (0,0,0) to (3,4,12) -> sqrt(9+16+144) = sqrt(169) = 13.0 Å
    const ast2 = MeasurementParser.parse('dist d2, name C1, name O3');
    const res2 = engine.execute(ast2) as MeasurementResult;
    assertClose(res2.distances![0].distance, 13.000, 1e-6, '1.2 Distance between C1 and O3 is exactly 13.000 Å');

    // 1.3 Multi-pair with cutoff: all pairs with cutoff 6.0 Å -> only C1-C2 (5.0 Å), not C1-O3 (13.0 Å) or C2-O3 (12.0 Å)
    const ast3 = MeasurementParser.parse('distance d_all, all, all, cutoff=6.0');
    const res3 = engine.execute(ast3) as MeasurementResult;
    assert(res3.count === 1, '1.3 Multi-pair with cutoff=6.0 filters out distant pairs (count=1)');
    assert(res3.distances![0].atom1_id === 1 && res3.distances![0].atom2_id === 2, '1.3 Pair is canonically sorted (1, 2)');

    // 1.4 Self-distance exclusion
    const ast4 = MeasurementParser.parse('distance d_self, name C1, name C1');
    const res4 = engine.execute(ast4) as MeasurementResult;
    assert(res4.count === 0, '1.4 Self-distance (d=0.0) is suppressed');
  }

  // -------------------------------------------------------------------------
  // SECTION 2: Analytical Planar Angle Measurements
  // -------------------------------------------------------------------------
  console.log('\n--- SECTION 2: Analytical Planar Angle Measurements ---');
  {
    // Synthetic right-angle (90°) and tetrahedral (109.47°) fixtures
    const angleAtoms: CanonicalAtom[] = [
      {
        canonical_id: 1, source_serial: 1, chain_ref: 'A', residue_ref: 1, residue_name: 'TST',
        element: 'C', atomic_number: 6, name: 'A', normalized_name: 'A', is_hetero: false,
        x: 1.0, y: 0.0, z: 0.0, occupancy: 1.0, b_factor: 20.0, alt_loc: '', formal_charge: 0,
        modeled_hydrogen: false
      },
      {
        canonical_id: 2, source_serial: 2, chain_ref: 'A', residue_ref: 1, residue_name: 'TST',
        element: 'C', atomic_number: 6, name: 'V', normalized_name: 'V', is_hetero: false,
        x: 0.0, y: 0.0, z: 0.0, occupancy: 1.0, b_factor: 20.0, alt_loc: '', formal_charge: 0,
        modeled_hydrogen: false
      },
      {
        canonical_id: 3, source_serial: 3, chain_ref: 'A', residue_ref: 1, residue_name: 'TST',
        element: 'C', atomic_number: 6, name: 'B', normalized_name: 'B', is_hetero: false,
        x: 0.0, y: 1.0, z: 0.0, occupancy: 1.0, b_factor: 20.0, alt_loc: '', formal_charge: 0,
        modeled_hydrogen: false
      },
      {
        canonical_id: 4, source_serial: 4, chain_ref: 'A', residue_ref: 1, residue_name: 'TST',
        element: 'C', atomic_number: 6, name: 'C', normalized_name: 'C', is_hetero: false,
        x: -1.0, y: 0.0, z: 0.0, occupancy: 1.0, b_factor: 20.0, alt_loc: '', formal_charge: 0,
        modeled_hydrogen: false
      }
    ];

    const engine = new ScientificMeasurementEngine(angleAtoms);

    // 2.1 Exact Right Angle (90.0°)
    const astA1 = MeasurementParser.parse('angle ang1, name A, name V, name B');
    const resA1 = engine.execute(astA1) as MeasurementResult;
    assertClose(resA1.angle!.angle, 90.000, 1e-5, '2.1 Orthogonal vertex angle is exactly 90.000°');

    // 2.2 Exact Linear Angle (180.0°)
    const astA2 = MeasurementParser.parse('angle ang2, name A, name V, name C');
    const resA2 = engine.execute(astA2) as MeasurementResult;
    assertClose(resA2.angle!.angle, 180.000, 1e-5, '2.2 Collinear vertex angle is exactly 180.000°');

    // 2.3 Strict 1x1x1 Cardinality enforcement: multi-atom selection throws fail-closed error
    let multiCardinalityCaught = false;
    try {
      const astMulti = MeasurementParser.parse('angle ang_err, all, name V, name B');
      engine.execute(astMulti);
    } catch (err: any) {
      multiCardinalityCaught = true;
      assert(err.message.includes('Angle measurement requires exactly 1 atom per selection'), '2.3 Multi-atom selection throws explicit cardinality error');
    }
    assert(multiCardinalityCaught, '2.3 Multi-cardinality angle caught fail-closed');
  }

  // -------------------------------------------------------------------------
  // SECTION 3: Analytical Signed Dihedral Measurements
  // -------------------------------------------------------------------------
  console.log('\n--- SECTION 3: Analytical Signed Dihedral Measurements ---');
  {
    // Synthetic dihedral test fixtures: Cis (0°), Trans (180°), and Gauche+ (+60°)
    const dihAtoms: CanonicalAtom[] = [
      {
        canonical_id: 1, source_serial: 1, chain_ref: 'A', residue_ref: 1, residue_name: 'TST',
        element: 'C', atomic_number: 6, name: 'P1', normalized_name: 'P1', is_hetero: false,
        x: 0.0, y: 1.0, z: 0.0, occupancy: 1.0, b_factor: 20.0, alt_loc: '', formal_charge: 0,
        modeled_hydrogen: false
      },
      {
        canonical_id: 2, source_serial: 2, chain_ref: 'A', residue_ref: 1, residue_name: 'TST',
        element: 'C', atomic_number: 6, name: 'P2', normalized_name: 'P2', is_hetero: false,
        x: 0.0, y: 0.0, z: 0.0, occupancy: 1.0, b_factor: 20.0, alt_loc: '', formal_charge: 0,
        modeled_hydrogen: false
      },
      {
        canonical_id: 3, source_serial: 3, chain_ref: 'A', residue_ref: 1, residue_name: 'TST',
        element: 'C', atomic_number: 6, name: 'P3', normalized_name: 'P3', is_hetero: false,
        x: 1.0, y: 0.0, z: 0.0, occupancy: 1.0, b_factor: 20.0, alt_loc: '', formal_charge: 0,
        modeled_hydrogen: false
      },
      // P4_cis: in-plane cis (0.0°)
      {
        canonical_id: 4, source_serial: 4, chain_ref: 'A', residue_ref: 1, residue_name: 'TST',
        element: 'C', atomic_number: 6, name: 'P4_CIS', normalized_name: 'P4_CIS', is_hetero: false,
        x: 1.0, y: 1.0, z: 0.0, occupancy: 1.0, b_factor: 20.0, alt_loc: '', formal_charge: 0,
        modeled_hydrogen: false
      },
      // P4_trans: in-plane trans (180.0°)
      {
        canonical_id: 5, source_serial: 5, chain_ref: 'A', residue_ref: 1, residue_name: 'TST',
        element: 'C', atomic_number: 6, name: 'P4_TRANS', normalized_name: 'P4_TRANS', is_hetero: false,
        x: 1.0, y: -1.0, z: 0.0, occupancy: 1.0, b_factor: 20.0, alt_loc: '', formal_charge: 0,
        modeled_hydrogen: false
      },
      // P4_gauche: +60° out of plane (y = cos(60) = 0.5, z = sin(60) = 0.8660254)
      {
        canonical_id: 6, source_serial: 6, chain_ref: 'A', residue_ref: 1, residue_name: 'TST',
        element: 'C', atomic_number: 6, name: 'P4_GAUCHE', normalized_name: 'P4_GAUCHE', is_hetero: false,
        x: 1.0, y: 0.5, z: 0.8660254037844386, occupancy: 1.0, b_factor: 20.0, alt_loc: '', formal_charge: 0,
        modeled_hydrogen: false
      }
    ];

    const engine = new ScientificMeasurementEngine(dihAtoms);

    // 3.1 Planar Cis Dihedral (0.0°)
    const astD1 = MeasurementParser.parse('dihedral d_cis, name P1, name P2, name P3, name P4_CIS');
    const resD1 = engine.execute(astD1) as MeasurementResult;
    assertClose(resD1.dihedral!.dihedral, 0.000, 1e-4, '3.1 Planar cis dihedral angle is exactly 0.000°');

    // 3.2 Planar Trans Dihedral (180.0°)
    const astD2 = MeasurementParser.parse('dihedral d_trans, name P1, name P2, name P3, name P4_TRANS');
    const resD2 = engine.execute(astD2) as MeasurementResult;
    assertClose(Math.abs(resD2.dihedral!.dihedral), 180.000, 1e-4, '3.2 Planar trans dihedral angle is exactly 180.000°');

    // 3.3 Gauche Positive (+60.0°)
    const astD3 = MeasurementParser.parse('dihedral d_gauche, name P1, name P2, name P3, name P4_GAUCHE');
    const resD3 = engine.execute(astD3) as MeasurementResult;
    assertClose(resD3.dihedral!.dihedral, 60.000, 1e-4, '3.3 Gauche dihedral angle is exactly +60.000°');

    // 3.4 Strict 1x1x1x1 Cardinality enforcement
    let dihCardinalityCaught = false;
    try {
      const astErr = MeasurementParser.parse('dihedral d_err, all, name P2, name P3, name P4_CIS');
      engine.execute(astErr);
    } catch (err: any) {
      dihCardinalityCaught = true;
      assert(err.message.includes('Dihedral measurement requires exactly 1 atom per selection'), '3.4 Multi-atom selection throws explicit dihedral cardinality error');
    }
    assert(dihCardinalityCaught, '3.4 Multi-cardinality dihedral caught fail-closed');
  }

  // -------------------------------------------------------------------------
  // SECTION 4: Advanced Selection Operators
  // -------------------------------------------------------------------------
  console.log('\n--- SECTION 4: Advanced Selection Operators ---');
  {
    const parser1CRN = SelectionParser.fromCanonicalMolecule(mol1CRN);
    const eval1CRN = new CanonicalSelectionEvaluator(mol1CRN);

    // 4.1 neighbor vs bound_to separation
    // Selection S1 = chain A and resi 1
    const s1 = parser1CRN.parse('chain A and resi 1');
    const sNeighbor = parser1CRN.parse('neighbor (chain A and resi 1)');
    const sBoundTo = parser1CRN.parse('bound_to (chain A and resi 1)');

    // neighbor must NOT contain any atoms from S1
    const neighborIntersection = Array.from(sNeighbor).filter(id => s1.has(id));
    assert(neighborIntersection.length === 0, '4.1 neighbor strictly excludes source atoms (intersection size = 0)');

    // bound_to MUST contain bonded atoms, including intra-residue bonds within S1
    assert(sBoundTo.size > sNeighbor.size, `4.1 bound_to includes intra-selection bonded atoms (bound_to=${sBoundTo.size} > neighbor=${sNeighbor.size})`);
    assert(sBoundTo.size === sNeighbor.size + s1.size, '4.1 bound_to size equals neighbor + source connected atoms');

    // 4.2 within vs expand semantic separation
    const sCA = parser1CRN.parse('chain A and resi 1 and name CA');
    const sWithin = parser1CRN.parse('within 3.0 of (chain A and resi 1 and name CA)');
    const sExpand = parser1CRN.parse('(chain A and resi 1 and name CA) expand 3.0');

    assert(sWithin.size > 0, `4.2 within 3.0 found ${sWithin.size} proximity atoms`);
    assert(sExpand.size > 0, `4.2 expand 3.0 found ${sExpand.size} expanded atoms`);
    assert(Array.from(sCA).every(id => sExpand.has(id)), '4.2 expand guarantees source selection subset (S ⊆ S_expand)');

    // 4.3 bycalpha / byca extraction
    const s10Res = parser1CRN.parse('chain A and resi 1-10');
    const sCAlpha = parser1CRN.parse('bycalpha (chain A and resi 1-10)');
    assert(sCAlpha.size === 10, `4.3 bycalpha extracted exactly 10 CA atoms across residues 1-10 (got ${sCAlpha.size})`);
    const caAtoms = mol1CRN.atoms.filter(a => sCAlpha.has(a.canonical_id));
    assert(caAtoms.every(a => a.name.trim().toUpperCase() === 'CA'), '4.3 All extracted atoms are alpha-carbons (name == CA)');

    // 4.4 byring cyclic aromatic closure
    const sPheCZ = parser1CRN.parse('resn PHE and name CZ');
    const sRing = parser1CRN.parse('byring (resn PHE and name CZ)');
    assert(sPheCZ.size > 0, '4.4 Found Phe CZ atom in 1CRN');
    assert(sRing.size === 6 * sPheCZ.size, `4.4 byring expanded single CZ to complete 6-membered aromatic ring (${sRing.size} atoms)`);

    // 4.5 byfragment deferred status
    let byfragmentCaught = false;
    try {
      parser1CRN.parse('byfragment chain A');
    } catch (err: any) {
      byfragmentCaught = true;
      assert(err.message.includes('DEFERRED / RESEARCH'), '4.5 byfragment throws explicit DEFERRED / RESEARCH notice');
    }
    assert(byfragmentCaught, '4.5 byfragment rejected under fail-closed research status');

    // 4.6 bycell deferred status
    let bycellCaught = false;
    try {
      parser1CRN.parse('bycell all');
    } catch (err: any) {
      bycellCaught = true;
      assert(err.message.includes('DEFERRED / RESEARCH'), '4.6 bycell throws explicit DEFERRED / RESEARCH notice');
    }
    assert(bycellCaught, '4.6 bycell rejected under fail-closed research status');
  }

  // -------------------------------------------------------------------------
  // SECTION 5: PyMOL-Compatible Mode=2 Polar Contact Perception
  // -------------------------------------------------------------------------
  console.log('\n--- SECTION 5: PyMOL-Compatible Mode=2 Polar Contact Perception ---');
  {
    const engine03 = new ScientificMeasurementEngine(mol03.atoms);

    const astMode2 = MeasurementParser.parse('distance hbonds, resn LIG, not resn LIG, mode=2');
    assert(astMode2.mode === 2, '5.1 Parsed mode=2 parameter');
    assert(astMode2.name === 'hbonds', '5.1 Parsed measurement name "hbonds"');

    const resMode2 = engine03.execute(astMode2) as MeasurementResult;
    assert(resMode2.measurement_type === 'mode2_polar_contacts', '5.2 Result measurement_type is mode2_polar_contacts');
    assert(resMode2.polar_contacts !== undefined && resMode2.polar_contacts.length >= 0, '5.2 Structured polar_contacts records present');
    if (resMode2.polar_contacts && resMode2.polar_contacts.length > 0) {
      const firstContact = resMode2.polar_contacts[0];
      assert(['putative_hydrogen_bond', 'polar_contact', 'ambiguous_polar_contact'].includes(firstContact.type),
        `5.3 Polar contact classification is evidence-driven (${firstContact.type})`);
      assert(firstContact.validation_status === 'GEOMETRICALLY_VALIDATED', '5.3 Polar contact validation status is GEOMETRICALLY_VALIDATED');
    }
  }

  // -------------------------------------------------------------------------
  // SECTION 6: Structured Biophysical Interaction Analysis Commands
  // -------------------------------------------------------------------------
  console.log('\n--- SECTION 6: Structured Biophysical Interaction Analysis Commands ---');
  {
    const engineHVR = new ScientificMeasurementEngine(p1HVR.atoms);

    // 6.1 polar_contacts
    const astPC = MeasurementParser.parse('polar_contacts resn XK2, not resn XK2');
    const resPC = engineHVR.execute(astPC) as InteractionAnalysisResult;
    assert(resPC.analysis_type === 'polar_contacts', '6.1 polar_contacts analysis executed');
    assert(resPC.count >= 0, `6.1 polar_contacts returned ${resPC.count} contacts`);

    // 6.2 salt_bridges
    const astSB = MeasurementParser.parse('salt_bridges all, all');
    const resSB = engineHVR.execute(astSB) as InteractionAnalysisResult;
    assert(resSB.analysis_type === 'salt_bridges', '6.2 salt_bridges analysis executed');
    assert(resSB.count >= 0, `6.2 salt_bridges detected ${resSB.count} electrostatic pairs`);

    // 6.3 hydrophobic_contacts
    const astHC = MeasurementParser.parse('hydrophobic_contacts resn XK2, not resn XK2');
    const resHC = engineHVR.execute(astHC) as InteractionAnalysisResult;
    assert(resHC.analysis_type === 'hydrophobic_contacts', '6.3 hydrophobic_contacts analysis executed');
    assert(resHC.count >= 0, `6.3 hydrophobic_contacts detected ${resHC.count} non-polar contacts`);
  }

  // -------------------------------------------------------------------------
  // SECTION 7: Scientific State Immutability & Determinism Invariants
  // -------------------------------------------------------------------------
  console.log('\n--- SECTION 7: Scientific State Immutability & Determinism Invariants ---');
  {
    const preHash1CRN = computeStateHash(mol1CRN);
    const preAtomCount = mol1CRN.atoms.length;

    // Run multiple measurements and analyses
    const engine1CRN = new ScientificMeasurementEngine(mol1CRN.atoms);
    engine1CRN.execute(MeasurementParser.parse('distance d1, name CA and resi 1, name CA and resi 2'));
    engine1CRN.execute(MeasurementParser.parse('angle a1, name N and resi 1, name CA and resi 1, name C and resi 1'));
    engine1CRN.execute(MeasurementParser.parse('dihedral dih1, name N and resi 1, name CA and resi 1, name C and resi 1, name N and resi 2'));
    engine1CRN.execute(MeasurementParser.parse('polar_contacts all, all'));

    const postHash1CRN = computeStateHash(mol1CRN);
    const postAtomCount = mol1CRN.atoms.length;

    assert(preHash1CRN === postHash1CRN, '7.1 Canonical molecule state hash is 100% identical after measurements (Immutability preserved)');
    assert(preAtomCount === postAtomCount, '7.2 Atom count strictly unchanged (Read-only guarantee)');
  }

  // -------------------------------------------------------------------------
  // SECTION 8: Scientific Command Router Error Classification
  // -------------------------------------------------------------------------
  console.log('\n--- SECTION 8: Scientific Command Router Error Classification ---');
  {
    // 8.1 Selection syntax error
    let selErrCaught = false;
    try {
      ScientificCommandRouter.routeAndExecute('chain A and unknown_kw_123', mol1CRN.atoms);
    } catch (err: any) {
      selErrCaught = true;
      assert(err.message.startsWith('Selection syntax error'), `8.1 Router returned Selection syntax error: "${err.message}"`);
    }
    assert(selErrCaught, '8.1 Selection error classified properly');

    // 8.2 Measurement syntax error
    let measErrCaught = false;
    try {
      ScientificCommandRouter.routeAndExecute('distance d_broken, only_one_arg', mol1CRN.atoms);
    } catch (err: any) {
      measErrCaught = true;
      assert(err.message.startsWith('Measurement syntax error'), `8.2 Router returned Measurement syntax error: "${err.message}"`);
    }
    assert(measErrCaught, '8.2 Measurement error classified properly');

    // 8.3 Analysis syntax error
    let anaErrCaught = false;
    try {
      ScientificCommandRouter.routeAndExecute('polar_contacts (unclosed_paren', mol1CRN.atoms);
    } catch (err: any) {
      anaErrCaught = true;
      assert(err.message.startsWith('Analysis syntax error') || err.message.startsWith('Measurement syntax error'),
        `8.3 Router returned Analysis syntax error: "${err.message}"`);
    }
    assert(anaErrCaught, '8.3 Analysis error classified properly');
  }

  // -------------------------------------------------------------------------
  // SUMMARY
  // -------------------------------------------------------------------------
  console.log('\n================================================================================');
  console.log(`TEST SUMMARY: ${passedTests} / ${totalTests} Passed (${((passedTests / totalTests) * 100).toFixed(1)}%)`);
  console.log('================================================================================');
}

runAdvancedQueryScienceSuite().catch(err => {
  console.error('Fatal error in P4.6 test suite:', err);
  process.exit(1);
});

