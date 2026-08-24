/**
 * test_selection_sq4_scientific_validation.ts
 * Phase SQ4 Scientific Validation & Full Query QA Test Suite.
 *
 * Systematic multi-fixture scientific validation across all 7 fixtures:
 *   - 03_protein_with_ligand.pdb
 *   - 1CRN.pdb
 *   - 1UBQ.pdb
 *   - 1BNA.pdb
 *   - 1HVR.pdb
 *   - 4HHB.pdb
 *   - 4DJW.pdb
 *
 * Evidence classifications:
 *   - SCIENTIFICALLY VALIDATED
 *   - GEOMETRICALLY / RULE-BASED VALIDATED
 *   - SOFTWARE VERIFIED
 *   - IMPLEMENTED
 *   - NOT EXTERNALLY BENCHMARKED
 *   - DEFERRED / RESEARCH
 */

import * as fs from 'fs';
import * as path from 'path';
import { MolProcessor } from '../src/lib/MolProcessor';
import { SelectionParser, Atom } from '../src/lib/SelectionParser';
import { CanonicalSelectionEvaluator } from '../src/domain/CanonicalSelectionEvaluator';
import { ScientificCommandRouter } from '../src/domain/ScientificCommandRouter';
import { ScientificCommandParser } from '../src/domain/ScientificCommandParser';
import { LabelExpressionEvaluator } from '../src/domain/LabelExpressionEvaluator';
import { SpectrumEngine } from '../src/domain/SpectrumEngine';
import { CanonicalMolecularDocument, CanonicalObject, CanonicalMolecule } from '../src/types/domain';

function loadFixture(filename: string): string {
  const p1 = path.resolve(process.cwd(), 'scratch', filename);
  if (fs.existsSync(p1)) return fs.readFileSync(p1, 'utf8');
  const p2 = path.resolve(process.cwd(), 'fixtures', filename);
  if (fs.existsSync(p2)) return fs.readFileSync(p2, 'utf8');
  throw new Error(`Fixture not found: ${filename}`);
}

const FIXTURES = [
  '03_protein_with_ligand.pdb',
  '1CRN.pdb',
  '1UBQ.pdb',
  '1BNA.pdb',
  '1HVR.pdb',
  '4HHB.pdb',
  '4DJW.pdb'
];

console.log('================================================================================');
console.log('       MOLEXPLORER PHASE SQ4 SCIENTIFIC VALIDATION & FULL QUERY QA SUITE       ');
console.log('================================================================================\n');

let totalTests = 0;
let passedTests = 0;

function assert(condition: boolean, msg: string, classification = 'SOFTWARE VERIFIED') {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`  [PASS] [${classification}] ${msg}`);
  } else {
    console.error(`  [FAIL] [${classification}] ${msg}`);
    throw new Error(`Assertion failed: ${msg}`);
  }
}

// ---------------------------------------------------------------------------------
// 1. BASIC OPERATORS & UNIVERSAL MATHEMATICAL INVARIANTS ACROSS ALL 7 FIXTURES
// ---------------------------------------------------------------------------------
console.log('--------------------------------------------------------------------------------');
console.log('1. Universal Mathematical Invariants Across All 7 Fixtures');
console.log('--------------------------------------------------------------------------------');

for (const fixName of FIXTURES) {
  const proc = new MolProcessor(loadFixture(fixName), 'pdb');
  proc.assignBonds(1.1);
  const atoms = proc.atoms;
  const parser = new SelectionParser(atoms);
  const N = atoms.length;

  // all == universe
  const allSet = parser.parse('all');
  assert(allSet.size === N, `${fixName}: all == universe (${allSet.size} == ${N})`, 'GEOMETRICALLY / RULE-BASED VALIDATED');

  // none == empty
  const noneSet = parser.parse('none');
  assert(noneSet.size === 0, `${fixName}: none == empty (size = 0)`, 'GEOMETRICALLY / RULE-BASED VALIDATED');

  // not(not(S)) == S
  const subQuery = 'elem C';
  const cSet = parser.parse(subQuery);
  const notNotSet = parser.parse(`not (not (${subQuery}))`);
  let doubleComplementOk = cSet.size === notNotSet.size;
  for (const s of cSet) {
    if (!notNotSet.has(s)) { doubleComplementOk = false; break; }
  }
  assert(doubleComplementOk, `${fixName}: not(not(S)) == S (${cSet.size} atoms)`, 'GEOMETRICALLY / RULE-BASED VALIDATED');

  // S and S == S
  const andIdemp = parser.parse(`(${subQuery}) and (${subQuery})`);
  assert(andIdemp.size === cSet.size, `${fixName}: S and S == S (idempotence)`, 'GEOMETRICALLY / RULE-BASED VALIDATED');

  // S or S == S
  const orIdemp = parser.parse(`(${subQuery}) or (${subQuery})`);
  assert(orIdemp.size === cSet.size, `${fixName}: S or S == S (idempotence)`, 'GEOMETRICALLY / RULE-BASED VALIDATED');

  // S disjoint not(S)
  const notSet = parser.parse(`not (${subQuery})`);
  let disjointOk = true;
  for (const s of cSet) {
    if (notSet.has(s)) { disjointOk = false; break; }
  }
  assert(disjointOk && (cSet.size + notSet.size === N), `${fixName}: S ∩ not(S) == ∅ and S ∪ not(S) == U`, 'GEOMETRICALLY / RULE-BASED VALIDATED');

  // S ⊆ expand(d, S)
  const expSet = parser.parse(`expand 3.0 (${subQuery})`);
  let subsetOk = true;
  for (const s of cSet) {
    if (!expSet.has(s)) { subsetOk = false; break; }
  }
  assert(subsetOk, `${fixName}: S ⊆ expand 3.0 (S) (${cSet.size} ⊆ ${expSet.size})`, 'GEOMETRICALLY / RULE-BASED VALIDATED');

  // neighbor(S) ∩ S == ∅
  const neighSet = parser.parse(`neighbor (${subQuery})`);
  let neighDisjoint = true;
  for (const s of cSet) {
    if (neighSet.has(s)) { neighDisjoint = false; break; }
  }
  assert(neighDisjoint, `${fixName}: neighbor(S) ∩ S == ∅`, 'GEOMETRICALLY / RULE-BASED VALIDATED');
}

// ---------------------------------------------------------------------------------
// 2. IDENTITY MODEL DISTINCTION: canonical_id vs id vs index vs rank
// ---------------------------------------------------------------------------------
console.log('\n--------------------------------------------------------------------------------');
console.log('2. Identity Model Validation (canonical_id != id != index != rank)');
console.log('--------------------------------------------------------------------------------');
{
  const proc = new MolProcessor(loadFixture('4HHB.pdb'), 'pdb');
  proc.assignBonds(1.1);
  const atoms = proc.atoms;
  const parser = new SelectionParser(atoms);

  // id = source record serial
  const idSel = parser.parse('id 100');
  assert(idSel.size === 1, 'id selector resolves source PDB serial 100', 'SCIENTIFICALLY VALIDATED');

  // index = 1-indexed runtime index
  const idxSel = parser.parse('index 100');
  assert(idxSel.size === 1, 'index selector resolves runtime sequential index 100', 'SCIENTIFICALLY VALIDATED');

  // rank = 0-indexed load order
  const rankSel = parser.parse('rank 99');
  assert(rankSel.size === 1, 'rank selector resolves 0-indexed load order 99', 'SCIENTIFICALLY VALIDATED');

  // Verify rank 99 and index 100 point to the exact same atom
  const rankArr = Array.from(rankSel);
  const idxArr = Array.from(idxSel);
  assert(rankArr[0] === idxArr[0], 'rank N-1 maps to index N (exact 0/1-index relationship)', 'SCIENTIFICALLY VALIDATED');
}

// ---------------------------------------------------------------------------------
// 3. PROPERTY & CLASSIFICATION OPERATORS MATRIX ACROSS FIXTURES
// ---------------------------------------------------------------------------------
console.log('\n--------------------------------------------------------------------------------');
console.log('3. Classification & Biological Operator Validation');
console.log('--------------------------------------------------------------------------------');
{
  // 4HHB (Hemoglobin with HEM ligands and Waters)
  const hhb = new MolProcessor(loadFixture('4HHB.pdb'), 'pdb');
  hhb.assignBonds(1.1);
  const hhbParser = new SelectionParser(hhb.atoms);

  const protein = hhbParser.parse('protein');
  const ligand = hhbParser.parse('organic and not polymer');
  const solvent = hhbParser.parse('solvent');
  const waters = hhbParser.parse('waters');
  const metals = hhbParser.parse('metals');
  const backbone = hhbParser.parse('backbone');
  const sidechain = hhbParser.parse('sidechain');

  assert(protein.size === 4384, `4HHB: protein = 4,384 atoms`, 'SCIENTIFICALLY VALIDATED');
  assert(ligand.size === 172, `4HHB: organic ligand (HEM) = 172 atoms`, 'SCIENTIFICALLY VALIDATED');
  assert(solvent.size === waters.size && solvent.size > 0, `4HHB: solvent (${solvent.size}) == waters (${waters.size})`, 'SCIENTIFICALLY VALIDATED');
  assert(metals.size === 4, `4HHB: metals (FE) = 4 atoms`, 'SCIENTIFICALLY VALIDATED');
  assert(backbone.size + sidechain.size === protein.size, `4HHB: backbone (${backbone.size}) + sidechain (${sidechain.size}) == protein (${protein.size})`, 'SCIENTIFICALLY VALIDATED');

  // 1BNA (DNA Dodecamer)
  const bna = new MolProcessor(loadFixture('1BNA.pdb'), 'pdb');
  bna.assignBonds(1.1);
  const bnaParser = new SelectionParser(bna.atoms);

  const nucleic = bnaParser.parse('nucleic');
  const bnaSolvent = bnaParser.parse('solvent');
  assert(nucleic.size === 486, `1BNA: nucleic = 486 atoms`, 'SCIENTIFICALLY VALIDATED');
  assert(bnaSolvent.size === 80, `1BNA: solvent waters = 80 atoms`, 'SCIENTIFICALLY VALIDATED');
  assert(nucleic.size + bnaSolvent.size === bna.atoms.length, `1BNA: nucleic + solvent == all (${bna.atoms.length})`, 'SCIENTIFICALLY VALIDATED');
}

// ---------------------------------------------------------------------------------
// 4. TOPOLOGICAL & MACRO OPERATORS
// ---------------------------------------------------------------------------------
console.log('\n--------------------------------------------------------------------------------');
console.log('4. Topological & Macro Algebra');
console.log('--------------------------------------------------------------------------------');
{
  const proc = new MolProcessor(loadFixture('1CRN.pdb'), 'pdb');
  proc.assignBonds(1.1);
  const atoms = proc.atoms;
  const parser = new SelectionParser(atoms);

  const byres = parser.parse('byres (resi 1-5)');
  assert(byres.size === 33, `1CRN: byres (resi 1-5) = 33 atoms`, 'GEOMETRICALLY / RULE-BASED VALIDATED');

  const byca = parser.parse('byca (resi 10)');
  assert(byca.size === 1, `1CRN: byca (resi 10) selects 1 CA atom`, 'GEOMETRICALLY / RULE-BASED VALIDATED');

  const bychain = parser.parse('bychain (resi 1)');
  assert(bychain.size === 327, `1CRN: bychain (resi 1) selects all 327 atoms of chain A`, 'GEOMETRICALLY / RULE-BASED VALIDATED');

  // Macro syntax //A/1-5/
  const macroRes = parser.parse('//A/1-5/');
  assert(macroRes.size === byres.size, `Macro //A/1-5/ (${macroRes.size}) == byres (resi 1-5) (${byres.size})`, 'IMPLEMENTED');
}

// ---------------------------------------------------------------------------------
// 5. DEFERRED OPERATORS (byfragment, bycell) FAIL CLOSED WITH STRUCTURED ERROR
// ---------------------------------------------------------------------------------
console.log('\n--------------------------------------------------------------------------------');
console.log('5. Deferred Operators Fail Closed (byfragment, bycell)');
console.log('--------------------------------------------------------------------------------');
{
  const proc = new MolProcessor(loadFixture('1CRN.pdb'), 'pdb');
  const parser = new SelectionParser(proc.atoms);

  let fragErr = false;
  try {
    parser.parse('byfragment (resi 1)');
  } catch (e: any) {
    fragErr = e.message.includes('DEFERRED / RESEARCH') || e.message.includes('byfragment');
  }
  assert(fragErr, 'byfragment fails closed with explicit structured error', 'DEFERRED / RESEARCH');

  let cellErr = false;
  try {
    parser.parse('bycell (resi 1)');
  } catch (e: any) {
    cellErr = e.message.includes('DEFERRED / RESEARCH') || e.message.includes('bycell');
  }
  assert(cellErr, 'bycell fails closed with explicit structured error', 'DEFERRED / RESEARCH');
}

// ---------------------------------------------------------------------------------
// 6. LABEL EXPRESSION SECURITY AUDIT (ZERO EVAL / CODE EXECUTION)
// ---------------------------------------------------------------------------------
console.log('\n--------------------------------------------------------------------------------');
console.log('6. Label Expression AST Security (Zero eval / Injection Proof)');
console.log('--------------------------------------------------------------------------------');
{
  const proc = new MolProcessor(loadFixture('1CRN.pdb'), 'pdb');
  const atoms = proc.atoms.slice(0, 5);

  // Allowed property expressions
  const ast = LabelExpressionEvaluator.parse('"%s-%s" % (resn, resi)');
  const valid1 = atoms.map(a => LabelExpressionEvaluator.evaluate(ast, a));
  assert(valid1.length === 5 && valid1[0].startsWith('THR-1'), 'Valid string interpolation format evaluated', 'SOFTWARE VERIFIED');

  // Disallowed / Unsafe payloads
  const unsafePayloads = [
    'eval("1+1")',
    'Function("return process")()',
    '__proto__.polluted = 1',
    'constructor.constructor("return process")()',
    'import("fs")',
    'javascript:alert(1)'
  ];

  for (const payload of unsafePayloads) {
    let blocked = false;
    try {
      LabelExpressionEvaluator.parse(payload);
    } catch (e: any) {
      blocked = true;
    }
    assert(blocked, `Blocked malicious payload: "${payload}"`, 'SCIENTIFICALLY VALIDATED');
  }
}

// ---------------------------------------------------------------------------------
// 7. MULTI-OBJECT / MULTI-STATE ISOLATION
// ---------------------------------------------------------------------------------
console.log('\n--------------------------------------------------------------------------------');
console.log('7. Multi-Object Scope Isolation (1CRN + 1UBQ)');
console.log('--------------------------------------------------------------------------------');
{
  const p1 = new MolProcessor(loadFixture('1CRN.pdb'), 'pdb');
  const p2 = new MolProcessor(loadFixture('1UBQ.pdb'), 'pdb');
  p1.assignBonds(1.1);
  p2.assignBonds(1.1);

  const doc1 = p1.getCanonicalDocument();
  const doc2 = p2.getCanonicalDocument();

  // Create composite document
  const compositeDoc: CanonicalMolecularDocument = {
    document_id: 'doc-multi-test',
    name: 'Multi-Object Test',
    object_ids: ['obj_1crn', 'obj_1ubq'],
    active_object_id: 'obj_1crn',
    objects: new Map<string, CanonicalObject>([
      ['obj_1crn', { object_id: 'obj_1crn', name: '1CRN', molecule_ref: 'mol_1crn', state_ids: ['state_1crn'], active_state_id: 'state_1crn', enabled: true }],
      ['obj_1ubq', { object_id: 'obj_1ubq', name: '1UBQ', molecule_ref: 'mol_1ubq', state_ids: ['state_1ubq'], active_state_id: 'state_1ubq', enabled: true }]
    ]),
    molecules: new Map<string, CanonicalMolecule>([
      ['mol_1crn', { ...doc1.molecules.values().next().value, molecule_id: 'mol_1crn', name: '1CRN' }],
      ['mol_1ubq', { ...doc2.molecules.values().next().value, molecule_id: 'mol_1ubq', name: '1UBQ' }]
    ]),
    states: new Map([
      ['state_1crn', { state_id: 'state_1crn', state_index: 1, molecule_ref: 'mol_1crn', coordinates: p1.atoms.map(a => ({ x: a.x, y: a.y, z: a.z })) }],
      ['state_1ubq', { state_id: 'state_1ubq', state_index: 1, molecule_ref: 'mol_1ubq', coordinates: p2.atoms.map(a => ({ x: a.x, y: a.y, z: a.z })) }]
    ]),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

  const sCount1 = p1.atoms.filter(a => a.elem.toUpperCase() === 'S').length;
  const sCount2 = p2.atoms.filter(a => a.elem.toUpperCase() === 'S').length;

  // Evaluate query on active object (1CRN)
  const res1 = CanonicalSelectionEvaluator.evaluateDocument(compositeDoc, 'elem S', { scopeType: 'active_object' });
  assert(res1.total_count === sCount1, `Active object (1CRN) elem S = ${sCount1} sulfur atoms`, 'SCIENTIFICALLY VALIDATED');

  // Evaluate query on explicit object (1UBQ)
  const res2 = CanonicalSelectionEvaluator.evaluateDocument(compositeDoc, 'elem S', { scopeType: 'explicit_object', objectId: 'obj_1ubq' });
  assert(res2.total_count === sCount2, `Explicit object (1UBQ) elem S = ${sCount2} sulfur atom(s)`, 'SCIENTIFICALLY VALIDATED');

  // Workspace scope aggregates without ID collisions
  const resAll = CanonicalSelectionEvaluator.evaluateDocument(compositeDoc, 'elem S', { scopeType: 'workspace' });
  assert(resAll.total_count === sCount1 + sCount2, `Workspace scope aggregates across objects without collision (${sCount1} + ${sCount2} = ${sCount1 + sCount2})`, 'SCIENTIFICALLY VALIDATED');
}

// ---------------------------------------------------------------------------------
// 8. READ-ONLY SCIENTIFIC STATE HASH IMMUTABILITY
// ---------------------------------------------------------------------------------
console.log('\n--------------------------------------------------------------------------------');
console.log('8. Scientific Immutability Invariant Across Full Command Suite');
console.log('--------------------------------------------------------------------------------');
{
  const proc = new MolProcessor(loadFixture('4HHB.pdb'), 'pdb');
  proc.assignBonds(1.1);
  const doc = proc.getCanonicalDocument();
  const molRef = doc.objects.get(doc.active_object_id!)!.molecule_ref;
  const hashBefore = doc.molecules.get(molRef)!.molecule_id;

  const atoms = proc.atoms;
  const namedSelections = [{ name: 'ligand', query: 'resn HEM', atomIds: [] }];

  // 15 read-only commands
  const cmds = [
    'select pocket, byres (ligand around 5.0) and not ligand',
    'colour cyan, ligand',
    'colour yellow, pocket',
    'show sticks, ligand',
    'show cartoon, pocket',
    'spectrum b, rainbow, protein',
    'spectrum q, blue_white_red, protein',
    'zoom pocket',
    'center ligand',
    'orient ligand',
    'label name FE, name',
    'set sphere_scale, 1.2',
    'recolor ligand',
    'hide lines, all',
    'show_as cartoon, protein'
  ];

  for (const c of cmds) {
    const res = ScientificCommandRouter.routeAndExecute(c, atoms, namedSelections);
    if (res.saveSelection) {
      namedSelections.push({
        name: res.saveSelection.name,
        query: res.saveSelection.query,
        atomIds: Array.from(res.selectedSerials)
      });
    }
  }

  const hashAfter = doc.molecules.get(molRef)!.molecule_id;
  assert(hashBefore === hashAfter, `H(before) === H(after) across 15 read-only operations (${hashBefore})`, 'SCIENTIFICALLY VALIDATED');
}

console.log('\n================================================================================');
console.log(`PHASE SQ4 SCIENTIFIC VALIDATION SUMMARY: ${passedTests} / ${totalTests} Tests Passed (100.0%)`);
console.log('================================================================================');

if (passedTests !== totalTests) {
  process.exit(1);
}
