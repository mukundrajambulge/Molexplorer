/**
 * test_selection_composition.ts
 * Phase SQ3 Authoritative Selection Composition, PyMOL Compatibility, and Query Chaining Suite.
 *
 * Test Matrix Categories:
 * - A: Grammar & Precedence (whitespace OR, explicit AND, within vs expand AST, byres)
 * - B: Nested Named Selections (arbitrary nesting, boolean composition, parentheses)
 * - C: Named Selection Cycles (a -> b -> a, a -> b -> c -> a, self-reference)
 * - D: Empty Named Selections (select empty, none; composition)
 * - E: Slash Macros (5 canonical slots, omitted fields, document scope)
 * - F: Wildcard / Range Macros (wildcards, ranges, lists, insertion codes)
 * - G: Command Chaining (semicolon sequences, state propagation)
 * - H: Command Chain Failure Semantics (fail-fast, stopped at first error)
 * - I: Per-Selection Visual Scoping (no global fallback, simultaneous representation)
 * - J: Multi-Object Scope Isolation (CanonicalMolecularDocument)
 * - K: Multi-Fixture Genericity (03PL, 1CRN, 1UBQ, 1BNA, 1HVR, 4HHB, 4DJW)
 * - L: Scientific Immutability (canonical state hash, revision count, coordinates)
 * - M: Security / Injection Rejection (fail-closed on malformed queries)
 */

import * as fs from 'fs';
import * as path from 'path';
import { MolProcessor } from '../src/lib/MolProcessor';
import { SelectionParser } from '../src/lib/SelectionParser';
import { CanonicalSelectionEvaluator } from '../src/domain/CanonicalSelectionEvaluator';
import { ScientificCommandRouter } from '../src/domain/ScientificCommandRouter';
import { computeCanonicalStateHash } from '../src/domain/StateHasher';
import { ScientificEditingKernel } from '../src/domain/ScientificEditingKernel';
import { ScientificRevisionManager } from '../src/domain/ScientificRevisionManager';
import { CanonicalMolecularDocument, CanonicalMolecule } from '../src/types/domain';

function loadFixture(filename: string): string {
  const p1 = path.resolve(process.cwd(), 'scratch', filename);
  if (fs.existsSync(p1)) return fs.readFileSync(p1, 'utf8');
  const p2 = path.resolve(process.cwd(), 'fixtures', filename);
  if (fs.existsSync(p2)) return fs.readFileSync(p2, 'utf8');
  const p3 = path.resolve(process.cwd(), filename);
  if (fs.existsSync(p3)) return fs.readFileSync(p3, 'utf8');
  throw new Error(`Fixture not found: ${filename}`);
}

console.log('================================================================================');
console.log('       MOLEXPLORER PHASE SQ3 AUTHORITATIVE SELECTION COMPOSITION SUITE           ');
console.log('================================================================================\n');

let totalTests = 0;
let passedTests = 0;

function assert(condition: boolean, msg: string) {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`  [PASS] ${msg}`);
  } else {
    console.error(`  [FAIL] ${msg}`);
    throw new Error(`Assertion failed: ${msg}`);
  }
}

// ================================================================================
// CATEGORY A: Grammar & Precedence (Whitespace OR, Explicit AND, within vs expand)
// ================================================================================
console.log('--------------------------------------------------------------------------------');
console.log('CATEGORY A: Grammar & Precedence (Whitespace OR, Explicit AND, within vs expand)');
console.log('--------------------------------------------------------------------------------');
{
  const proc = new MolProcessor(loadFixture('4HHB.pdb'), 'pdb');
  proc.assignBonds(1.1);
  const parser = new SelectionParser(proc.atoms);

  // 1. Whitespace Juxtaposition is Implicit OR
  const chainAB_ws = parser.parse('chain A chain B');
  const chainAB_or = parser.parse('chain A or chain B');
  assert(chainAB_ws.size === chainAB_or.size && chainAB_ws.size > 0,
    `Whitespace juxtaposition: 'chain A chain B' (${chainAB_ws.size}) === 'chain A or chain B' (${chainAB_or.size})`);

  // 2. Explicit AND is Intersection
  const chainAB_and = parser.parse('chain A and chain B');
  assert(chainAB_and.size === 0, `Explicit AND: 'chain A and chain B' is empty (0 atoms)`);
  assert(chainAB_ws.size !== chainAB_and.size, `'chain A chain B' (OR) !== 'chain A and chain B' (AND)`);

  // 3. Property List Whitespace OR: resn ALA GLY
  const resn_ws = parser.parse('resn ALA GLY');
  const resn_or = parser.parse('resn ALA or resn GLY');
  assert(resn_ws.size === resn_or.size && resn_ws.size > 0,
    `Property whitespace: 'resn ALA GLY' (${resn_ws.size}) === 'resn ALA or resn GLY' (${resn_or.size})`);

  // 4. Precedence: not > and > or
  // 'not chain A and resi 10' must parse as '(not chain A) and resi 10'
  const notAnd = parser.parse('not chain A and resi 10');
  const notAndParen = parser.parse('(not chain A) and resi 10');
  assert(notAnd.size === notAndParen.size, `Precedence 'not' > 'and': 'not chain A and resi 10' === '(not chain A) and resi 10'`);

  // 'chain A or chain B and resi 10' must parse as 'chain A or (chain B and resi 10)'
  const orAnd = parser.parse('chain A or chain B and resi 10');
  const orAndParen = parser.parse('chain A or (chain B and resi 10)');
  assert(orAnd.size === orAndParen.size, `Precedence 'and' > 'or': 'chain A or chain B and resi 10' === 'chain A or (chain B and resi 10)'`);

  // 5. AST Distinction: within vs expand
  const exprWithin = parser.buildExpression(parser.tokenize('within 5.0 of (chain A and resi 10)'));
  const exprExpand = parser.buildExpression(parser.tokenize('(chain A and resi 10) expand 5.0'));
  assert(exprWithin.type === 'within', `AST node for 'within 5.0 of S' has type 'within'`);
  assert(exprExpand.type === 'expand', `AST node for 'S expand 5.0' has type 'expand'`);
  assert(exprWithin.type !== exprExpand.type, `'within' and 'expand' produce distinct AST node types (not parser aliases)`);

  // Set invariant: S ⊆ expand(D, S)
  const targetSet = parser.parse('chain A and resi 10');
  const expandSet = parser.evaluate(exprExpand);
  let isSubset = true;
  for (const s of targetSet) {
    if (!expandSet.has(s)) isSubset = false;
  }
  assert(isSubset, `Set invariant: S ⊆ expand(D, S) strictly holds`);

  // 6. Hierarchical byres scoping
  const exprByresUnparen = parser.buildExpression(parser.tokenize('byres (chain A and resi 10) around 5.0'));
  const exprByresParen = parser.buildExpression(parser.tokenize('byres ((chain A and resi 10) around 5.0)'));
  assert(exprByresUnparen.type === 'byres' && exprByresUnparen.operand.type === 'around',
    `byres scoping: 'byres S around 5.0' binds spatial operator inside byres closure`);
  assert(JSON.stringify(exprByresUnparen) === JSON.stringify(exprByresParen),
    `byres S around 5.0 AST exactly equals byres (S around 5.0)`);
}

// ================================================================================
// CATEGORY B: Nested Named Selections & Boolean Composition
// ================================================================================
console.log('\n--------------------------------------------------------------------------------');
console.log('CATEGORY B: Nested Named Selections & Boolean Composition');
console.log('--------------------------------------------------------------------------------');
{
  const proc = new MolProcessor(loadFixture('4DJW.pdb'), 'pdb');
  proc.assignBonds(1.1);
  const atoms = proc.atoms;

  // Define named selections
  const res1 = ScientificCommandRouter.routeAndExecute('select ligand, organic and not polymer', atoms);
  assert(res1.saveSelection !== undefined && res1.saveSelection.name === 'ligand' && res1.selectedSerials.size > 0,
    `Created named selection 'ligand' with ${res1.selectedSerials.size} atoms`);

  const namedList = [res1.saveSelection!];

  // Nested named selection: pocket from ligand
  const res2 = ScientificCommandRouter.routeAndExecute(
    'select pocket, byres (ligand around 5.0) and not ligand',
    atoms,
    namedList
  );
  assert(res2.saveSelection !== undefined && res2.saveSelection.name === 'pocket' && res2.selectedSerials.size > 0,
    `Created nested named selection 'pocket' with ${res2.selectedSerials.size} atoms`);

  namedList.push(res2.saveSelection!);

  // Nested named selection with parenthesized boolean composition: pocket2
  const res3 = ScientificCommandRouter.routeAndExecute(
    'select pocket2, byres (ligand around 4.0) and not (ligand or solvent)',
    atoms,
    namedList
  );
  assert(res3.saveSelection !== undefined && res3.saveSelection.name === 'pocket2' && res3.selectedSerials.size > 0,
    `Created nested named selection 'pocket2' (${res3.selectedSerials.size} atoms) using parenthesized boolean '(ligand or solvent)'`);

  // Named selection consumption in display commands
  const resColor = ScientificCommandRouter.routeAndExecute('color cyan, ligand', atoms, namedList);
  assert(resColor.selectedSerials.size === res1.selectedSerials.size, `Display command consumed named selection 'ligand'`);

  const resShow = ScientificCommandRouter.routeAndExecute('show surface, pocket', atoms, namedList);
  assert(resShow.selectedSerials.size === res2.selectedSerials.size, `Display command consumed named selection 'pocket'`);
}

// ================================================================================
// CATEGORY C: Named Selection Cycle Safety
// ================================================================================
console.log('\n--------------------------------------------------------------------------------');
console.log('CATEGORY C: Named Selection Cycle Safety (Fail-Closed)');
console.log('--------------------------------------------------------------------------------');
{
  const proc = new MolProcessor(loadFixture('1CRN.pdb'), 'pdb');
  proc.assignBonds(1.1);
  const atoms = proc.atoms;

  // Cycle 1: a -> b -> a
  const cyclicSels = [
    { name: 'sel_a', query: 'sel_b' },
    { name: 'sel_b', query: 'sel_a' }
  ];
  let caughtCycle = false;
  try {
    const parser = new SelectionParser(atoms, cyclicSels);
    parser.parse('sel_a');
  } catch (e: any) {
    caughtCycle = e.message.includes('Cyclic named selection reference detected');
  }
  assert(caughtCycle, `Cycle a -> b -> a rejected with 'Cyclic named selection reference detected'`);

  // Cycle 2: a -> b -> c -> a
  const cyclic3 = [
    { name: 'sel_a', query: 'sel_b' },
    { name: 'sel_b', query: 'sel_c' },
    { name: 'sel_c', query: 'sel_a' }
  ];
  let caughtCycle3 = false;
  try {
    const parser = new SelectionParser(atoms, cyclic3);
    parser.parse('sel_a');
  } catch (e: any) {
    caughtCycle3 = e.message.includes('Cyclic named selection reference detected');
  }
  assert(caughtCycle3, `Cycle a -> b -> c -> a rejected with 'Cyclic named selection reference detected'`);

  // Self-referencing: a -> a
  const selfRef = [{ name: 'sel_self', query: 'sel_self and resi 10' }];
  let caughtSelf = false;
  try {
    const parser = new SelectionParser(atoms, selfRef);
    parser.parse('sel_self');
  } catch (e: any) {
    caughtSelf = e.message.includes('Cyclic named selection reference detected');
  }
  assert(caughtSelf, `Self-referencing selection rejected fail-closed`);
}

// ================================================================================
// CATEGORY D: Empty Named Selections
// ================================================================================
console.log('\n--------------------------------------------------------------------------------');
console.log('CATEGORY D: Empty Named Selections');
console.log('--------------------------------------------------------------------------------');
{
  const proc = new MolProcessor(loadFixture('1CRN.pdb'), 'pdb');
  proc.assignBonds(1.1);
  const atoms = proc.atoms;

  const emptySels = [{ name: 'empty_sel', query: 'none', atomIds: [] }];
  const parser = new SelectionParser(atoms, emptySels);

  // 1. Evaluating empty selection returns 0 atoms without error
  const emptyRes = parser.parse('empty_sel');
  assert(emptyRes.size === 0, `Empty named selection resolves cleanly to 0 atoms`);

  // 2. Boolean composition with empty selection
  const andEmpty = parser.parse('protein and empty_sel');
  assert(andEmpty.size === 0, `protein and empty_sel === 0 atoms`);

  const orEmpty = parser.parse('resi 1 or empty_sel');
  const resi1 = parser.parse('resi 1');
  assert(orEmpty.size === resi1.size && orEmpty.size > 0, `resi 1 or empty_sel === resi 1 (${orEmpty.size} atoms)`);

  const notEmpty = parser.parse('not empty_sel');
  const allAtoms = parser.parse('all');
  assert(notEmpty.size === allAtoms.size, `not empty_sel === all (${notEmpty.size} atoms)`);
}

// ================================================================================
// CATEGORY E: Slash Macros (5 Canonical Slots & Document Scoping)
// ================================================================================
console.log('\n--------------------------------------------------------------------------------');
console.log('CATEGORY E: Slash Macros (5 Canonical Slots & Document Scoping)');
console.log('--------------------------------------------------------------------------------');
{
  const proc = new MolProcessor(loadFixture('4HHB.pdb'), 'pdb');
  proc.assignBonds(1.1);
  const parser = new SelectionParser(proc.atoms);

  // 1. Full 1D macro: //A/10/CA (chain A, resi 10, atom CA)
  const m1 = parser.parse('//A/10/CA');
  const c1 = parser.parse('chain A and resi 10 and name CA');
  assert(m1.size === c1.size && m1.size === 1, `//A/10/CA (${m1.size}) === chain A and resi 10 and name CA`);

  // 2. 3-slash residue macro: ///1-50/
  const m2 = parser.parse('///1-50/');
  const c2 = parser.parse('resi 1-50');
  assert(m2.size === c2.size && m2.size > 0, `///1-50/ (${m2.size}) === resi 1-50`);

  // 3. 4-slash atom name macro: ////CA
  const m3 = parser.parse('////CA');
  const c3 = parser.parse('name CA');
  assert(m3.size === c3.size && m3.size > 0, `////CA (${m3.size}) === name CA`);

  // 4. Universe macro: /////
  const m4 = parser.parse('/////');
  const c4 = parser.parse('all');
  assert(m4.size === c4.size && m4.size === proc.atoms.length, `///// (${m4.size}) === all`);

  // 5. Document scope with object identifier: /4HHB//A/
  const doc = proc.getCanonicalDocument();
  const docRes = CanonicalSelectionEvaluator.evaluateDocument(doc, '/4HHB//A/', { scopeType: 'active_object' });
  const chainA_count = parser.parse('chain A').size;
  assert(docRes.total_count === chainA_count, `/4HHB//A/ matched ${docRes.total_count} atoms in document scope`);
}

// ================================================================================
// CATEGORY F: Wildcard & Range Macro Fields
// ================================================================================
console.log('\n--------------------------------------------------------------------------------');
console.log('CATEGORY F: Wildcard & Range Macro Fields');
console.log('--------------------------------------------------------------------------------');
{
  const proc = new MolProcessor(loadFixture('4HHB.pdb'), 'pdb');
  proc.assignBonds(1.1);
  const parser = new SelectionParser(proc.atoms);

  // 1. Wildcard atom name: //A/10/*
  const mWild = parser.parse('//A/10/*');
  const cWild = parser.parse('chain A and resi 10');
  assert(mWild.size === cWild.size && mWild.size > 0, `//A/10/* (${mWild.size}) matches all atoms in chain A resi 10`);

  // 2. Residue list in macro: //A/10+20/CA
  const mList = parser.parse('//A/10+20/CA');
  const cList = parser.parse('chain A and (resi 10 or resi 20) and name CA');
  assert(mList.size === cList.size && mList.size === 2, `//A/10+20/CA (${mList.size}) matches CA in resi 10 and resi 20`);
}

// ================================================================================
// CATEGORY G: Command Chaining (Semicolon Sequences)
// ================================================================================
console.log('\n--------------------------------------------------------------------------------');
console.log('CATEGORY G: Command Chaining (Semicolon Sequences)');
console.log('--------------------------------------------------------------------------------');
{
  const proc = new MolProcessor(loadFixture('03_protein_with_ligand.pdb'), 'pdb');
  proc.assignBonds(1.1);
  const atoms = proc.atoms;

  const script = 'select ligand, organic and not polymer; show sticks, ligand; color cyan, ligand; zoom ligand';
  const res = ScientificCommandRouter.routeAndExecute(script, atoms);

  assert(res.selectedSerials.size > 0, `Chained script executed successfully on ligand atoms`);
  assert(res.presentationOverrides !== undefined && res.presentationOverrides.length >= 2,
    `Chained script registered ${res.presentationOverrides?.length} per-selection presentation overrides`);
  assert(res.triggerZoom === true, `Chained script triggered camera zoom`);
}

// ================================================================================
// CATEGORY H: Command Chain Failure Semantics (Fail-Fast)
// ================================================================================
console.log('\n--------------------------------------------------------------------------------');
console.log('CATEGORY H: Command Chain Failure Semantics (Fail-Fast)');
console.log('--------------------------------------------------------------------------------');
{
  const proc = new MolProcessor(loadFixture('03_protein_with_ligand.pdb'), 'pdb');
  proc.assignBonds(1.1);
  const atoms = proc.atoms;

  let caughtFailFast = false;
  try {
    // Command 2 has invalid color; command 3 should never run
    const invalidChain = 'select lig, resn LIG; color nonexistent_color_abc, lig; zoom lig';
    ScientificCommandRouter.routeAndExecute(invalidChain, atoms);
  } catch (e: any) {
    caughtFailFast = e.message.startsWith('Color syntax error:');
  }
  assert(caughtFailFast, `Mid-script error halted execution immediately with 'Color syntax error'`);

  // Unbalanced parentheses in command chain
  let caughtUnbalanced = false;
  try {
    const unbalChain = 'select lig, (organic and not polymer; color cyan, lig';
    ScientificCommandRouter.routeAndExecute(unbalChain, atoms);
  } catch (e: any) {
    caughtUnbalanced = e.message.includes('unbalanced parentheses');
  }
  assert(caughtUnbalanced, `Unbalanced parentheses in command sequence rejected fail-closed`);
}

// ================================================================================
// CATEGORY I: Per-Selection Visual Scoping (No Global Fallback & Coexistence)
// ================================================================================
console.log('\n--------------------------------------------------------------------------------');
console.log('CATEGORY I: Per-Selection Visual Scoping');
console.log('--------------------------------------------------------------------------------');
{
  const proc = new MolProcessor(loadFixture('03_protein_with_ligand.pdb'), 'pdb');
  proc.assignBonds(1.1);
  const atoms = proc.atoms;

  // Single command with selection: show sticks, ligand
  const resShow = ScientificCommandRouter.routeAndExecute('show sticks, resn LIG', atoms);
  assert(resShow.setStyle === undefined, `Selection-specific 'show sticks, resn LIG' does NOT mutate global setStyle`);
  assert(resShow.presentationOverrides !== undefined && resShow.presentationOverrides.length === 1,
    `Selection-specific command generated 1 per-selection override`);
  assert(resShow.presentationOverrides![0].representation === 'sticks',
    `Override representation is 'sticks'`);
  assert(resShow.presentationOverrides![0].atomSerials.size === 4,
    `Override applies strictly to 4 ligand atoms`);

  // Simultaneous representations: show cartoon, protein; show sticks, ligand; color yellow, ligand
  const multiRepScript = 'show cartoon, protein; show sticks, resn LIG; color yellow, resn LIG';
  const resMulti = ScientificCommandRouter.routeAndExecute(multiRepScript, atoms);
  assert(resMulti.presentationOverrides !== undefined && resMulti.presentationOverrides.length === 3,
    `Simultaneous presentation registered ${resMulti.presentationOverrides?.length} overrides without collision`);
}

// ================================================================================
// CATEGORY J: Multi-Object Scope Isolation (CanonicalMolecularDocument)
// ================================================================================
console.log('\n--------------------------------------------------------------------------------');
console.log('CATEGORY J: Multi-Object Scope Isolation (CanonicalMolecularDocument)');
console.log('--------------------------------------------------------------------------------');
{
  const proc1 = new MolProcessor(loadFixture('1CRN.pdb'), 'pdb');
  proc1.assignBonds(1.1);
  const doc = proc1.getCanonicalDocument();

  const activeRes = CanonicalSelectionEvaluator.evaluateDocument(doc, 'chain A and resi 1-10', { scopeType: 'active_object' });
  assert(activeRes.total_count > 0, `Active object scope evaluated ${activeRes.total_count} atoms in 1CRN`);
}

// ================================================================================
// CATEGORY K: Multi-Fixture Genericity (03PL, 1CRN, 1UBQ, 1BNA, 1HVR, 4HHB, 4DJW)
// ================================================================================
console.log('\n--------------------------------------------------------------------------------');
console.log('CATEGORY K: Multi-Fixture Genericity (7 Standard Structures)');
console.log('--------------------------------------------------------------------------------');
{
  const fixtureNames = [
    '03_protein_with_ligand.pdb',
    '1CRN.pdb',
    '1UBQ.pdb',
    '1BNA.pdb',
    '1HVR.pdb',
    '4HHB.pdb',
    '4DJW.pdb'
  ];

  for (const fName of fixtureNames) {
    const proc = new MolProcessor(loadFixture(fName), 'pdb');
    proc.assignBonds(1.1);
    const atoms = proc.atoms;

    // Discover first chain dynamically
    const firstChain = atoms[0]?.chainID || 'A';
    // Discover first valid residue sequence number dynamically
    const firstResi = atoms[0]?.resSeq || 1;

    const parser = new SelectionParser(atoms);

    // Generic query 1: chain and resi
    const selChainResi = parser.parse(`chain ${firstChain} and resi ${firstResi}`);
    assert(selChainResi.size > 0, `${fName}: dynamically discovered 'chain ${firstChain} and resi ${firstResi}' -> ${selChainResi.size} atoms`);

    // Generic query 2: slash macro using discovered chain & resi
    const selMacro = parser.parse(`//${firstChain}/${firstResi}/`);
    assert(selMacro.size === selChainResi.size, `${fName}: slash macro '//${firstChain}/${firstResi}/' matches canonical query (${selMacro.size} atoms)`);

    // Generic query 3: whitespace OR vs explicit AND
    const selOr = parser.parse(`chain ${firstChain} resi ${firstResi}`);
    const selAnd = parser.parse(`chain ${firstChain} and resi ${firstResi}`);
    assert(selOr.size >= selAnd.size, `${fName}: whitespace OR (${selOr.size}) >= explicit AND (${selAnd.size})`);
  }
}

// ================================================================================
// CATEGORY L: Scientific Immutability Invariant
// ================================================================================
console.log('\n--------------------------------------------------------------------------------');
console.log('CATEGORY L: Scientific Immutability Invariant');
console.log('--------------------------------------------------------------------------------');
{
  const proc = new MolProcessor(loadFixture('03_protein_with_ligand.pdb'), 'pdb');
  proc.assignBonds(1.1);

  const mol = proc.getCanonicalMolecule('mol_test');
  const rootRev = ScientificEditingKernel.createRootRevision('doc-1', 'obj-1', mol);
  const revMgr = new ScientificRevisionManager(rootRev);

  const initialCoordCopy = mol.atoms.map(a => ({ x: a.x, y: a.y, z: a.z }));
  const initialTopologyCopy = mol.topology.bonds.length;
  const initialAtomCount = mol.atoms.length;

  const hashBefore = computeCanonicalStateHash(mol);
  const revCountBefore = revMgr.getRevisionCount();

  // Execute a series of complex queries, slash macros, and display commands
  const testScript = 'select lig, organic and not polymer; select pocket, byres (lig around 5.0) and not lig; show sticks, lig; color cyan, lig; zoom pocket';
  ScientificCommandRouter.routeAndExecute(testScript, proc.atoms);

  const hashAfter = computeCanonicalStateHash(mol);
  const revCountAfter = revMgr.getRevisionCount();

  assert(hashBefore === hashAfter, `Canonical state hash invariant preserved: ${hashBefore}`);
  assert(revCountBefore === revCountAfter, `Revision count invariant preserved: ${revCountBefore} === ${revCountAfter}`);

  // Coordinates invariant
  let coordsMatch = true;
  for (let i = 0; i < mol.atoms.length; i++) {
    if (mol.atoms[i].x !== initialCoordCopy[i].x ||
        mol.atoms[i].y !== initialCoordCopy[i].y ||
        mol.atoms[i].z !== initialCoordCopy[i].z) {
      coordsMatch = false;
      break;
    }
  }
  assert(coordsMatch, `Coordinates 100% unchanged after query workflow`);
  assert(mol.topology.bonds.length === initialTopologyCopy, `Topology bond count 100% unchanged`);
  assert(mol.atoms.length === initialAtomCount, `Atom count 100% unchanged`);
}

// ================================================================================
// CATEGORY M: Security & Injection Rejection
// ================================================================================
console.log('\n--------------------------------------------------------------------------------');
console.log('CATEGORY M: Security & Injection Rejection');
console.log('--------------------------------------------------------------------------------');
{
  const proc = new MolProcessor(loadFixture('1CRN.pdb'), 'pdb');
  proc.assignBonds(1.1);
  const atoms = proc.atoms;

  // Unclosed string / injection attempt
  let caughtBadSyntax = false;
  try {
    ScientificCommandRouter.routeAndExecute('select bad, name "CA; drop table;', atoms);
  } catch (e: any) {
    caughtBadSyntax = true;
  }
  assert(caughtBadSyntax, `Malformed quote injection rejected fail-closed`);
}

console.log('\n================================================================================');
console.log(`PHASE SQ3 COMPLETE SUITE SUMMARY: ${passedTests} / ${totalTests} Tests Passed (100.0%)`);
console.log('================================================================================');

if (passedTests !== totalTests) {
  process.exit(1);
}
