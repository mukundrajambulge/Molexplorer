import fs from 'fs';
import path from 'path';
import assert from 'assert';
import { MolProcessor } from '../src/lib/MolProcessor';
import { SelectionParser } from '../src/lib/SelectionParser';
import {
  CanonicalMolecule,
  CanonicalState,
  createScopedAtomKey,
  parseScopedAtomKey
} from '../src/types/domain';
import {
  buildCanonicalState,
  buildCanonicalObject,
  buildCanonicalDocument
} from '../src/domain/DocumentAdapter';
import { CanonicalSelectionEvaluator } from '../src/domain/CanonicalSelectionEvaluator';

function runSelectionScopeTestSuite() {
  console.log("================================================================================");
  console.log("             TASK P2.2: MULTI-OBJECT & STATE SELECTION SCOPE SUITE              ");
  console.log("================================================================================\n");

  let totalTests = 0;
  let passedTests = 0;

  function test(name: string, fn: () => void) {
    totalTests++;
    try {
      fn();
      console.log(`  [PASS] ${name}`);
      passedTests++;
    } catch (err: any) {
      console.error(`  [FAIL] ${name}: ${err.message}`);
      throw err;
    }
  }

  // Load fixtures
  const crnPdb = fs.readFileSync(path.resolve(process.cwd(), 'scratch/1CRN.pdb'), 'utf8');
  const ubqPdb = fs.readFileSync(path.resolve(process.cwd(), 'scratch/1UBQ.pdb'), 'utf8');

  const procA = new MolProcessor(crnPdb, 'pdb');
  procA.assignBonds(1.15);
  const molA = procA.getCanonicalMolecule({ name: '1CRN (Crambin)', moleculeId: 'mol-crn' });

  const procB = new MolProcessor(ubqPdb, 'pdb');
  procB.assignBonds(1.15);
  const molB = procB.getCanonicalMolecule({ name: '1UBQ (Ubiquitin)', moleculeId: 'mol-ubq' });

  const doc = buildCanonicalDocument([molA, molB], {
    document_id: 'doc-workspace-1',
    name: 'Dual Molecule Workspace'
  });

  const objAId = 'obj-mol-crn';
  const objBId = 'obj-mol-ubq';

  // --- SECTION 1: OBJECT ISOLATION & LOCAL CANONICAL ID COLLISION RESOLUTION ---
  console.log("--- 1. Object Isolation & Scoped Key Disjointness ---");

  test("1.1 Scoped atom keys prevent collisions between distinct objects with identical local IDs", () => {
    const resA = SelectionParser.evaluateCanonical("name CA", molA, { objectId: objAId });
    const resB = SelectionParser.evaluateCanonical("name CA", molB, { objectId: objBId });

    assert.strictEqual(resA.count, 46);
    assert.strictEqual(resB.count, 76);

    const keysA = new Set(resA.selected_array.map(id => createScopedAtomKey(objAId, id)));
    const keysB = new Set(resB.selected_array.map(id => createScopedAtomKey(objBId, id)));

    // Verify 0 overlap between scoped keys
    let intersectionCount = 0;
    for (const k of keysA) {
      if (keysB.has(k)) intersectionCount++;
    }
    assert.strictEqual(intersectionCount, 0, "Scoped atom keys must be strictly disjoint across objects");
  });

  test("1.2 Scoped atom key serialization and round-trip parsing", () => {
    const key = createScopedAtomKey("obj-target-42", 108);
    assert.strictEqual(key, "obj-target-42:108");
    const parsed = parseScopedAtomKey(key);
    assert.strictEqual(parsed.objectId, "obj-target-42");
    assert.strictEqual(parsed.canonicalId, 108);

    assert.throws(() => parseScopedAtomKey("malformed_key"), /Invalid scoped atom key format/);
  });

  // --- SECTION 2: NOT COMPLEMENT UNIVERSE ISOLATION ---
  console.log("\n--- 2. NOT Complement Universe Boundary ---");

  test("2.1 NOT complement evaluates strictly within the object atom universe U(object, state)", () => {
    // 1CRN has 327 atoms, 0 solvent. 'not solvent' must return exactly all 327 atoms of 1CRN
    const resNotSolventA = SelectionParser.evaluateCanonical("not solvent", molA, { objectId: objAId });
    assert.strictEqual(resNotSolventA.count, 327);
    for (const id of resNotSolventA.selected_ids) {
      assert(molA.atom_map.has(id));
    }

    // 1UBQ has 660 atoms, 58 water atoms. 'not solvent' must return exactly 602 polymer atoms of 1UBQ
    const resNotSolventB = SelectionParser.evaluateCanonical("not solvent", molB, { objectId: objBId });
    assert.strictEqual(resNotSolventB.count, 602);
    for (const id of resNotSolventB.selected_ids) {
      assert(molB.atom_map.has(id));
    }
  });

  // --- SECTION 3: DOCUMENT SCOPES (ACTIVE vs EXPLICIT vs WORKSPACE) ---
  console.log("\n--- 3. Workspace Document Scope Models ---");

  test("3.1 Active Object Scope evaluates query on currently focused object", () => {
    doc.active_object_id = objAId;
    const activeResA = SelectionParser.evaluateDocument("name CA", doc, { scopeType: 'active_object' });
    assert.strictEqual(activeResA.total_count, 46);
    assert.strictEqual(activeResA.object_results.size, 1);
    assert(activeResA.object_results.has(objAId));

    doc.active_object_id = objBId;
    const activeResB = SelectionParser.evaluateDocument("name CA", doc, { scopeType: 'active_object' });
    assert.strictEqual(activeResB.total_count, 76);
    assert.strictEqual(activeResB.object_results.size, 1);
    assert(activeResB.object_results.has(objBId));
  });

  test("3.2 Explicit Object Scope routes query directly to requested object regardless of active focus", () => {
    doc.active_object_id = objAId; // Active is A
    const explicitResB = SelectionParser.evaluateDocument("name CA", doc, {
      scopeType: 'explicit_object',
      objectId: objBId
    });
    assert.strictEqual(explicitResB.total_count, 76);
    assert(explicitResB.object_results.has(objBId));
  });

  test("3.3 Workspace Scope evaluates query across all enabled objects and aggregates scoped keys", () => {
    const workspaceRes = SelectionParser.evaluateDocument("name CA", doc, { scopeType: 'workspace' });
    assert.strictEqual(workspaceRes.total_count, 46 + 76); // 122 total CA atoms
    assert.strictEqual(workspaceRes.object_results.size, 2);
    assert.strictEqual(workspaceRes.scoped_keys.size, 122);

    for (const key of workspaceRes.scoped_keys) {
      const { objectId, canonicalId } = parseScopedAtomKey(key);
      assert(objectId === objAId || objectId === objBId);
      assert(canonicalId >= 1);
    }
  });

  // --- SECTION 4: STATE ISOLATION & STATE-SPECIFIC SPATIAL EVALUATION ---
  console.log("\n--- 4. State Isolation & State-Specific Spatial Metrics ---");

  test("4.1 Spatial queries evaluate against the active state coordinates tensor", () => {
    // State 1: original coordinates
    const state1 = buildCanonicalState(molA, 1, 'state-crn-1', 'State 1');

    // State 2: shifted coordinates (+50Å in X, Y, Z for residue 1 CA atom)
    const shiftedCoords = molA.atoms.map((a, idx) => {
      if (idx === 0) {
        return { x: a.x + 50.0, y: a.y + 50.0, z: a.z + 50.0 };
      }
      return { x: a.x, y: a.y, z: a.z };
    });
    const state2: CanonicalState = {
      state_id: 'state-crn-2',
      state_index: 2,
      molecule_ref: molA.molecule_id,
      coordinates: shiftedCoords,
      name: 'Shifted Conformation'
    };

    const eval1 = new CanonicalSelectionEvaluator(molA, { state: state1 });
    const eval2 = new CanonicalSelectionEvaluator(molA, { state: state2 });

    // In State 1, atom 1 is within 4Å of residue 1 atoms
    const resWithin1 = eval1.evaluateQuery("within 4 of id 1");
    // In State 2, atom 1 is shifted 50Å away from other atoms, so within 4Å of id 1 should only contain atom 1 itself
    const resWithin2 = eval2.evaluateQuery("within 4 of id 1");

    assert(resWithin1.count > 1, "State 1 atom 1 has close neighbors within 4Å");
    assert.strictEqual(resWithin2.count, 1, "State 2 shifted atom 1 is isolated and has 0 close neighbors");
  });

  // --- SECTION 5: STALE SELECTION DETECTION & PERSISTENCE ---
  console.log("\n--- 5. Stale Selection Detection & Persistence Validation ---");

  test("5.1 validateSelection detects deleted atoms and missing objects/states", () => {
    const validRes = SelectionParser.evaluateDocument("name CA", doc, { scopeType: 'workspace' });
    const checkValid = CanonicalSelectionEvaluator.validateSelection(doc, validRes);
    assert.strictEqual(checkValid.valid, true);
    assert.strictEqual(checkValid.staleKeys.length, 0);

    // Corrupt selection with non-existent atom ID
    const corruptedRes = { ...validRes };
    const staleKey = createScopedAtomKey(objAId, 99999);
    corruptedRes.scoped_keys = new Set([...validRes.scoped_keys, staleKey]);
    corruptedRes.object_results.get(objAId)!.selected_ids.add(99999);

    const checkCorrupted = CanonicalSelectionEvaluator.validateSelection(doc, corruptedRes);
    assert.strictEqual(checkCorrupted.valid, false);
    assert.strictEqual(checkCorrupted.staleKeys.includes(staleKey), true);
  });

  test("5.2 Error handling on non-existent object or state scope", () => {
    assert.throws(
      () => SelectionParser.evaluateDocument("all", doc, { scopeType: 'explicit_object', objectId: 'obj-ghost' }),
      /object "obj-ghost" does not exist/
    );
  });

  console.log("\n================================================================================");
  console.log(`TEST SUMMARY: ${passedTests} / ${totalTests} Passed (${((passedTests / totalTests) * 100).toFixed(1)}%)`);
  console.log("================================================================================\n");

  if (passedTests !== totalTests) {
    process.exit(1);
  }
}

runSelectionScopeTestSuite();
