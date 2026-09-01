import fs from 'fs';
import { MolProcessor } from '../src/lib/MolProcessor';
import { SelectionParser } from '../src/lib/SelectionParser';
import { ScientificCommandRouter, normalizeSelectionExpression } from '../src/domain/ScientificCommandRouter';
import { ScientificCommandParser } from '../src/domain/ScientificCommandParser';
import {
  PresentationStateManager,
  makeAtomIdentityKey,
  buildViewerRenderState
} from '../src/domain/PresentationStateManager';
import {
  RepresentationBit,
  normalizeRepresentation
} from '../src/domain/RepresentationRegistry';

function assert(condition: boolean, msg: string) {
  if (!condition) {
    console.error(`[FAIL] ${msg}`);
    process.exit(1);
  }
  console.log(`  [PASS] ${msg}`);
}

console.log("================================================================================");
console.log("BEHAVIORAL TEST SEQUENCE ON 4DJW (Transitions A through E)");
console.log("================================================================================");

// Load 4DJW with Strip Solvent enabled
const rawPdb = fs.readFileSync('scratch/4DJW.pdb', 'utf8');
const processor = new MolProcessor(rawPdb, 'pdb');
processor.stripSolvent();

const atoms = processor.atoms;
const totalAtoms = atoms.length;
console.log(`4DJW loaded with strip solvent: ${totalAtoms} atoms.`);
assert(totalAtoms === 6194, `Expected 6194 atoms, got ${totalAtoms}`);

const chainAAtoms = atoms.filter(a => a.chainID === 'A');
const nonChainAAtoms = atoms.filter(a => a.chainID !== 'A');
console.log(`Chain A atom count: ${chainAAtoms.length}, non-Chain A atom count: ${nonChainAAtoms.length}`);
assert(chainAAtoms.length === 3096, `Expected 3096 Chain A atoms, got ${chainAAtoms.length}`);
assert(nonChainAAtoms.length === 3098, `Expected 3098 non-Chain A atoms, got ${nonChainAAtoms.length}`);

// Maintain atomRepMasks exactly as MolStudio does
let atomRepMasks = new Map<string, number>();

function applyCommand(cmd: string) {
  const res = ScientificCommandRouter.routeAndExecute(cmd, atoms, [], 'main_mol');
  if (res.representationMutation) {
    const mut = res.representationMutation;
    const bit = mut.representation === 'everything' || mut.representation === 'all'
      ? RepresentationBit.ALL
      : (mut.representation === 'line' || mut.representation === 'lines' ? RepresentationBit.LINES :
         mut.representation === 'stick' || mut.representation === 'sticks' ? RepresentationBit.STICKS :
         mut.representation === 'sphere' || mut.representation === 'spheres' ? RepresentationBit.SPHERES :
         mut.representation === 'cartoon' || mut.representation === 'cartoons' ? RepresentationBit.CARTOON :
         RepresentationBit.NONE);

    if (mut.action === 'show') {
      for (const serial of mut.atomSerials) {
        const key = makeAtomIdentityKey(serial, 'main_mol');
        const current = atomRepMasks.get(key) ?? RepresentationBit.CARTOON;
        atomRepMasks.set(key, current | bit);
      }
    } else if (mut.action === 'hide') {
      for (const serial of mut.atomSerials) {
        const key = makeAtomIdentityKey(serial, 'main_mol');
        const current = atomRepMasks.get(key) ?? RepresentationBit.CARTOON;
        atomRepMasks.set(key, current & ~bit);
      }
    } else if (mut.action === 'show_as') {
      for (const serial of mut.atomSerials) {
        const key = makeAtomIdentityKey(serial, 'main_mol');
        atomRepMasks.set(key, bit);
      }
    }
  }
  return res;
}

// --------------------------------------------------------------------------------
// TRANSITION A: Standalone 'all' and '*'
// --------------------------------------------------------------------------------
console.log("\n--- TRANSITION A: all / * ---");
const resAll = ScientificCommandRouter.routeAndExecute('all', atoms, [], 'main_mol');
assert(resAll.count === totalAtoms, `all: selected ${resAll.count} === ${totalAtoms}`);
assert(resAll.selectedSerials.size === totalAtoms, `all: serials set size ${resAll.selectedSerials.size} === ${totalAtoms}`);

const resStar = ScientificCommandRouter.routeAndExecute('*', atoms, [], 'main_mol');
assert(resStar.count === totalAtoms, `*: selected ${resStar.count} === ${totalAtoms}`);
assert(resStar.selectedSerials.size === totalAtoms, `*: serials set size ${resStar.selectedSerials.size} === ${totalAtoms}`);

// --------------------------------------------------------------------------------
// TRANSITION B: show_as lines, all
// --------------------------------------------------------------------------------
console.log("\n--- TRANSITION B: show_as lines, all ---");
const resB = applyCommand('show_as lines, all');
assert(resB.count === totalAtoms, `show_as lines, all: affected ${resB.count} === ${totalAtoms}`);

// Check resolved render state
const renderStateB = buildViewerRenderState({
  atoms,
  presentationState: {
    globalRepresentation: 'cartoon',
    globalColorScheme: 'spectrum',
    globalOpacity: 1.0,
    objectOverrides: new Map(),
    selectionOverrides: new Map(),
    atomRepresentationMasks: atomRepMasks
  },
  options: { activeObjectId: 'main_mol' }
});

let bHasLine = true;
let bHasCartoon = false;
for (const [serial, aState] of renderStateB.atomPresentationMap) {
  const mask = aState.representationMask!;
  if (!(mask & RepresentationBit.LINES)) bHasLine = false;
  if (mask & RepresentationBit.CARTOON) bHasCartoon = true;
}
assert(bHasLine, "All atoms have active line representation");
assert(!bHasCartoon, "Cartoon representation is completely absent on all atoms");

// Verify 3Dmol style groups have line only and no cartoon
for (const { style } of renderStateB.styleGroups.values()) {
  assert(Boolean(style.line), "Style includes line representation");
  assert(!style.cartoon, "Style excludes cartoon representation");
}

// --------------------------------------------------------------------------------
// TRANSITION C: show sticks, chain A
// --------------------------------------------------------------------------------
console.log("\n--- TRANSITION C: show sticks, chain A ---");
const resC = applyCommand('show sticks, chain A');
assert(resC.count === chainAAtoms.length, `show sticks, chain A: affected ${resC.count} === ${chainAAtoms.length}`);

const renderStateC = buildViewerRenderState({
  atoms,
  presentationState: {
    globalRepresentation: 'cartoon',
    globalColorScheme: 'spectrum',
    globalOpacity: 1.0,
    objectOverrides: new Map(),
    selectionOverrides: new Map(),
    atomRepresentationMasks: atomRepMasks
  },
  options: { activeObjectId: 'main_mol' }
});

for (const a of chainAAtoms) {
  const aState = renderStateC.atomPresentationMap.get(a.serial)!;
  const mask = aState.representationMask!;
  assert((mask & RepresentationBit.LINES) !== 0 && (mask & RepresentationBit.STICKS) !== 0,
    `Chain A atom ${a.serial} has line + stick coexistence (mask=${mask})`);
}

for (const a of nonChainAAtoms) {
  const aState = renderStateC.atomPresentationMap.get(a.serial)!;
  const mask = aState.representationMask!;
  assert((mask & RepresentationBit.LINES) !== 0 && (mask & RepresentationBit.STICKS) === 0,
    `Non-Chain A atom ${a.serial} remains line only (mask=${mask})`);
}

// --------------------------------------------------------------------------------
// TRANSITION D: hide lines, chain A
// --------------------------------------------------------------------------------
console.log("\n--- TRANSITION D: hide lines, chain A ---");
const resD = applyCommand('hide lines, chain A');
assert(resD.count === chainAAtoms.length, `hide lines, chain A: affected ${resD.count} === ${chainAAtoms.length}`);

const renderStateD = buildViewerRenderState({
  atoms,
  presentationState: {
    globalRepresentation: 'cartoon',
    globalColorScheme: 'spectrum',
    globalOpacity: 1.0,
    objectOverrides: new Map(),
    selectionOverrides: new Map(),
    atomRepresentationMasks: atomRepMasks
  },
  options: { activeObjectId: 'main_mol' }
});

for (const a of chainAAtoms) {
  const aState = renderStateD.atomPresentationMap.get(a.serial)!;
  const mask = aState.representationMask!;
  assert((mask & RepresentationBit.LINES) === 0 && (mask & RepresentationBit.STICKS) !== 0,
    `Chain A atom ${a.serial} retains stick representation only, lines removed (mask=${mask})`);
}

for (const a of nonChainAAtoms) {
  const aState = renderStateD.atomPresentationMap.get(a.serial)!;
  const mask = aState.representationMask!;
  assert((mask & RepresentationBit.LINES) !== 0 && (mask & RepresentationBit.STICKS) === 0,
    `Non-Chain A atom ${a.serial} unaffected (remains line only, mask=${mask})`);
}

// --------------------------------------------------------------------------------
// TRANSITION E: show_as cartoon, chain A
// --------------------------------------------------------------------------------
console.log("\n--- TRANSITION E: show_as cartoon, chain A ---");
const resE = applyCommand('show_as cartoon, chain A');
assert(resE.count === chainAAtoms.length, `show_as cartoon, chain A: affected ${resE.count} === ${chainAAtoms.length}`);

const renderStateE = buildViewerRenderState({
  atoms,
  presentationState: {
    globalRepresentation: 'cartoon',
    globalColorScheme: 'spectrum',
    globalOpacity: 1.0,
    objectOverrides: new Map(),
    selectionOverrides: new Map(),
    atomRepresentationMasks: atomRepMasks
  },
  options: { activeObjectId: 'main_mol' }
});

for (const a of chainAAtoms) {
  const aState = renderStateE.atomPresentationMap.get(a.serial)!;
  const mask = aState.representationMask!;
  assert(mask === RepresentationBit.CARTOON,
    `Chain A atom ${a.serial} strictly cartoon only (mask=${mask})`);
}

for (const a of nonChainAAtoms) {
  const aState = renderStateE.atomPresentationMap.get(a.serial)!;
  const mask = aState.representationMask!;
  assert(mask === RepresentationBit.LINES,
    `Non-Chain A atom ${a.serial} retains line only (mask=${mask})`);
}

console.log("\n================================================================================");
console.log("ALL BEHAVIORAL SEQUENCE GATES A THROUGH E PASSED (100% VERIFIED)");
console.log("================================================================================");
