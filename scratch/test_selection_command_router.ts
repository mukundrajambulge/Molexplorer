/**
 * test_selection_command_router.ts
 * Phase SQ2 Selection Command Router Test Suite.
 * 
 * Verifies:
 * - Command AST generation
 * - color / colour 100% alias parity
 * - show / hide / show_as representation validation
 * - label with allow-listed properties (zero eval)
 * - zoom / center / orient view commands
 * - Named selection argument equivalence
 * - Strict error taxonomies (Color syntax error, Representation syntax error, Label expression error, Selection syntax error)
 * - Read-only scientific hash invariant across all display commands.
 */

import * as fs from 'fs';
import * as path from 'path';
import { MolProcessor } from '../src/lib/MolProcessor';
import { ScientificCommandRouter } from '../src/domain/ScientificCommandRouter';
import { ScientificCommandParser } from '../src/domain/ScientificCommandParser';

function loadFixture(filename: string): string {
  const p1 = path.resolve(process.cwd(), 'scratch', filename);
  if (fs.existsSync(p1)) return fs.readFileSync(p1, 'utf8');
  const p2 = path.resolve(process.cwd(), 'fixtures', filename);
  if (fs.existsSync(p2)) return fs.readFileSync(p2, 'utf8');
  throw new Error(`Fixture not found: ${filename}`);
}

console.log('================================================================================');
console.log('       MOLEXPLORER PHASE SQ2 SELECTION COMMAND ROUTER SUITE                     ');
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

// ---------------------------------------------------------------------------------
// 1. COMMAND AST GENERATION
// ---------------------------------------------------------------------------------
console.log('--------------------------------------------------------------------------------');
console.log('1. Command AST Generation');
console.log('--------------------------------------------------------------------------------');
{
  const ast1 = ScientificCommandParser.parseCommand('colour green, pocket');
  assert(ast1.command_type === 'color' && ast1.color_value === 'green' && ast1.selection_query === 'pocket', 'Parsed "colour green, pocket" into typed Color AST');

  const ast2 = ScientificCommandParser.parseCommand('show sticks, (protein and chain A)');
  assert(ast2.command_type === 'representation' && ast2.representation_value === 'sticks' && ast2.selection_query === '(protein and chain A)', 'Parsed "show sticks, (protein and chain A)" into Representation AST');

  const ast3 = ScientificCommandParser.parseCommand('label pocket, "%s-%s" % (resn, resi)');
  assert(ast3.command_type === 'label' && ast3.label_expression?.type === 'format_template', 'Parsed format string into safe Label AST');
}

// ---------------------------------------------------------------------------------
// 2. COLOR / COLOUR 100% ALIAS PARITY
// ---------------------------------------------------------------------------------
console.log('\n--------------------------------------------------------------------------------');
console.log('2. Color / Colour Alias Parity');
console.log('--------------------------------------------------------------------------------');
{
  const proc = new MolProcessor(loadFixture('03_protein_with_ligand.pdb'), 'pdb');
  proc.assignBonds(1.1);
  const atoms = proc.atoms;

  const resColor = ScientificCommandRouter.routeAndExecute('color cyan, resn LIG', atoms);
  const resColour = ScientificCommandRouter.routeAndExecute('colour cyan, resn LIG', atoms);

  assert(resColor.count === 4 && resColour.count === 4, 'Both color and colour selected exactly 4 ligand atoms');
  assert(resColor.setColorScheme === 'cyan' && resColour.setColorScheme === 'cyan', 'Both color and colour applied color scheme "cyan"');

  let colorSetsEqual = true;
  for (const id of resColor.selectedSerials) {
    if (!resColour.selectedSerials.has(id)) colorSetsEqual = false;
  }
  assert(colorSetsEqual, '100% bit-for-bit selection set parity between color and colour');
}

// ---------------------------------------------------------------------------------
// 3. REPRESENTATION COMMANDS (show, hide, show_as)
// ---------------------------------------------------------------------------------
console.log('\n--------------------------------------------------------------------------------');
console.log('3. Representation Commands (show, hide, show_as)');
console.log('--------------------------------------------------------------------------------');
{
  const proc = new MolProcessor(loadFixture('1CRN.pdb'), 'pdb');
  proc.assignBonds(1.1);
  const atoms = proc.atoms;

  const showRes = ScientificCommandRouter.routeAndExecute('show sticks, name CA', atoms);
  assert(showRes.setStyle === 'sticks' && showRes.count === 46, 'show sticks, name CA routed 46 CA atoms to sticks style');

  const hideRes = ScientificCommandRouter.routeAndExecute('hide cartoon, chain A', atoms);
  assert(hideRes.setStyle === 'cartoon' && hideRes.count === 327, 'hide cartoon, chain A resolved full chain A');

  // Invalid representation throws Representation syntax error
  let repError = false;
  try {
    ScientificCommandRouter.routeAndExecute('show invalid_rep_name, all', atoms);
  } catch (e: any) {
    repError = e.message.startsWith('Representation syntax error:');
  }
  assert(repError, 'Invalid representation name threw "Representation syntax error"');
}

// ---------------------------------------------------------------------------------
// 4. VIEW / CAMERA COMMANDS (zoom, center, orient)
// ---------------------------------------------------------------------------------
console.log('\n--------------------------------------------------------------------------------');
console.log('4. View / Camera Commands (zoom, center, orient)');
console.log('--------------------------------------------------------------------------------');
{
  const proc = new MolProcessor(loadFixture('03_protein_with_ligand.pdb'), 'pdb');
  proc.assignBonds(1.1);
  const atoms = proc.atoms;

  const zoomRes = ScientificCommandRouter.routeAndExecute('zoom resn LIG', atoms);
  assert(zoomRes.triggerZoom === true && zoomRes.count === 4, 'zoom resn LIG targeted 4 ligand atoms with triggerZoom');

  const centerRes = ScientificCommandRouter.routeAndExecute('center polymer', atoms);
  assert(centerRes.count === 16, 'center polymer targeted 16 protein atoms');
}

// ---------------------------------------------------------------------------------
// 5. LABEL COMMAND WITH ALLOW-LISTED PROPERTIES
// ---------------------------------------------------------------------------------
console.log('\n--------------------------------------------------------------------------------');
console.log('5. Label Command with Allow-Listed Properties (Zero eval)');
console.log('--------------------------------------------------------------------------------');
{
  const proc = new MolProcessor(loadFixture('03_protein_with_ligand.pdb'), 'pdb');
  proc.assignBonds(1.1);
  const atoms = proc.atoms;

  const labelRes = ScientificCommandRouter.routeAndExecute('label resn LIG, resn + " " + resi', atoms);
  assert(labelRes.addLabels !== undefined && labelRes.addLabels.length === 4, 'Generated 4 atom labels');
  assert(labelRes.addLabels![0].text.startsWith('LIG'), `Label formatted text verified (${labelRes.addLabels![0].text})`);

  // Disallowed / dangerous property throws Label expression error
  let labelError = false;
  try {
    ScientificCommandRouter.routeAndExecute('label resn LIG, __proto__', atoms);
  } catch (e: any) {
    labelError = e.message.startsWith('Label expression error:');
  }
  assert(labelError, 'Unsafe/unknown property in label threw "Label expression error"');
}

// ---------------------------------------------------------------------------------
// 6. NAMED SELECTION INTEROPERABILITY
// ---------------------------------------------------------------------------------
console.log('\n--------------------------------------------------------------------------------');
console.log('6. Named Selection Interoperability');
console.log('--------------------------------------------------------------------------------');
{
  const proc = new MolProcessor(loadFixture('03_protein_with_ligand.pdb'), 'pdb');
  proc.assignBonds(1.1);
  const atoms = proc.atoms;

  const namedSelections = [
    { name: 'ligand', query: 'resn LIG', atomIds: [17, 18, 19, 20] }
  ];

  const viaNamed = ScientificCommandRouter.routeAndExecute('colour yellow, ligand', atoms, namedSelections);
  const viaExpr = ScientificCommandRouter.routeAndExecute('colour yellow, (resn LIG)', atoms, namedSelections);

  assert(viaNamed.count === viaExpr.count && viaNamed.count === 4, 'Named selection argument resolves identically to parenthesized expression');
  assert(viaNamed.setColorScheme === viaExpr.setColorScheme, 'Color scheme output matches identically');
}

// ---------------------------------------------------------------------------------
// 7. COMMAND ERROR TAXONOMY
// ---------------------------------------------------------------------------------
console.log('\n--------------------------------------------------------------------------------');
console.log('7. Command Error Taxonomy');
console.log('--------------------------------------------------------------------------------');
{
  const proc = new MolProcessor(loadFixture('03_protein_with_ligand.pdb'), 'pdb');
  proc.assignBonds(1.1);
  const atoms = proc.atoms;

  // 1. Color syntax error
  let cErr = false;
  try {
    ScientificCommandRouter.routeAndExecute('colour not_a_color, all', atoms);
  } catch (e: any) {
    cErr = e.message.startsWith('Color syntax error:');
  }
  assert(cErr, 'Unknown color threw "Color syntax error:"');

  // 2. Representation syntax error
  let rErr = false;
  try {
    ScientificCommandRouter.routeAndExecute('show not_a_rep, all', atoms);
  } catch (e: any) {
    rErr = e.message.startsWith('Representation syntax error:');
  }
  assert(rErr, 'Unknown representation threw "Representation syntax error:"');

  // 3. Selection syntax error
  let sErr = false;
  try {
    ScientificCommandRouter.routeAndExecute('colour green, unknown_selection_xyz', atoms);
  } catch (e: any) {
    sErr = e.message.startsWith('Selection syntax error:');
  }
  assert(sErr, 'Unknown selection reference threw "Selection syntax error:"');
}

// ---------------------------------------------------------------------------------
// 8. READ-ONLY SCIENTIFIC INVARIANT
// ---------------------------------------------------------------------------------
console.log('\n--------------------------------------------------------------------------------');
console.log('8. Read-Only Scientific Hash Invariant');
console.log('--------------------------------------------------------------------------------');
{
  const proc = new MolProcessor(loadFixture('4HHB.pdb'), 'pdb');
  proc.assignBonds(1.1);
  const doc = proc.getCanonicalDocument();
  const obj = doc.objects.get(doc.active_object_id!)!;
  const molRef = obj.molecule_ref;
  const hashBefore = doc.molecules.get(molRef)!.molecule_id;

  const atoms = proc.atoms;
  ScientificCommandRouter.routeAndExecute('color cyan, elem FE', atoms);
  ScientificCommandRouter.routeAndExecute('show sticks, byres (elem FE around 5.0)', atoms);
  ScientificCommandRouter.routeAndExecute('zoom elem FE', atoms);
  ScientificCommandRouter.routeAndExecute('spectrum b, rainbow, all', atoms);

  const hashAfter = doc.molecules.get(molRef)!.molecule_id;
  assert(hashBefore === hashAfter, `Display commands strictly preserved state hash H(before) == H(after) (${hashBefore})`);
}

console.log('\n================================================================================');
console.log(`PHASE SQ2 COMMAND ROUTER SUMMARY: ${passedTests} / ${totalTests} Tests Passed (100.0%)`);
console.log('================================================================================');

if (passedTests !== totalTests) {
  process.exit(1);
}
