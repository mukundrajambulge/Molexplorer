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
import { SessionManager } from '../src/session/SessionManager';

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

  // --- SECTION 6: DEDICATED PSE MULTI-OBJECT SCOPED SELECTION ROUND-TRIP ---
  console.log("\n--- 6. Dedicated PSE Multi-Object Scoped Selection Round-Trip ---");

  test("6.1 Multi-object scoped selection save and restore round-trip via MolStudio-PSE persistence", () => {
    // 1. Construct selections for Object A (Crambin, 46 CA atoms) and Object B (Ubiquitin, 76 CA atoms)
    const selA = SelectionParser.evaluateCanonical("name CA", molA, { objectId: objAId, stateId: 'mol-crn-state-1' });
    const selB = SelectionParser.evaluateCanonical("name CA", molB, { objectId: objBId, stateId: 'mol-ubq-state-1' });

    assert.strictEqual(selA.count, 46);
    assert.strictEqual(selB.count, 76);

    const workspaceScopedResult = SelectionParser.evaluateDocument("name CA", doc, { scopeType: 'workspace' });
    assert.strictEqual(workspaceScopedResult.total_count, 122);
    assert.strictEqual(workspaceScopedResult.scoped_keys.size, 122);

    // 2. Build MolStudioPSESession incorporating multi-object structure and scoped selection state
    const session = SessionManager.createSession({
      molecules: [
        { id: objAId, name: '1CRN (Crambin)', format: 'pdb', data: crnPdb, atomCount: 327 },
        { id: objBId, name: '1UBQ (Ubiquitin)', format: 'pdb', data: ubqPdb, atomCount: 660 }
      ],
      viewerState: {
        renderStyle: 'Cartoon',
        colorScheme: 'Modern/Jmol',
        surfaceOpacity: 0.8,
        backgroundColor: '#0A0A0A',
        orthographic: true,
        stereoMode: 'none'
      },
      selectionState: {
        selectionLevel: 'atom',
        selectedAtomSerials: selA.selected_array,
        scopedKeys: Array.from(workspaceScopedResult.scoped_keys),
        activeObjectId: objAId,
        activeStateId: 'mol-crn-state-1',
        lastSelectionQuery: 'name CA',
        namedSelections: [
          {
            name: 'Crambin_CAs',
            query: 'name CA',
            atomIds: selA.selected_array,
            objectId: objAId,
            stateId: 'mol-crn-state-1'
          },
          {
            name: 'Ubiquitin_CAs',
            query: 'name CA',
            atomIds: selB.selected_array,
            objectId: objBId,
            stateId: 'mol-ubq-state-1'
          }
        ]
      }
    });

    // 3. Export to MolStudio-PSE JSON string
    const pseContent = SessionManager.exportSession(session);
    assert(pseContent.includes('MolStudio-PSE'), 'PSE content must include format header');
    assert(pseContent.includes('Crambin_CAs'), 'PSE content must include named selection A');
    assert(pseContent.includes('Ubiquitin_CAs'), 'PSE content must include named selection B');

    // 4. Import / Reload session
    const reloadedSession = SessionManager.importSession(pseContent);
    assert.strictEqual(reloadedSession.format, 'MolStudio-PSE');
    assert.strictEqual(reloadedSession.version, 1);
    assert.strictEqual(reloadedSession.molecules.length, 2);

    // 5. Restore scoped selections & assert exact properties
    const selState = reloadedSession.selectionState;
    assert.strictEqual(selState.lastSelectionQuery, 'name CA');
    assert.strictEqual(selState.activeObjectId, objAId);
    assert.strictEqual(selState.activeStateId, 'mol-crn-state-1');
    assert.strictEqual(selState.scopedKeys?.length, 122);

    const reloadedScopedKeys = new Set(selState.scopedKeys);
    assert.strictEqual(reloadedScopedKeys.size, 122);

    // Assert exact equality of scoped atom keys set
    for (const key of workspaceScopedResult.scoped_keys) {
      assert(reloadedScopedKeys.has(key), `Reloaded scoped keys must contain ${key}`);
    }

    // Check named selections
    const nsA = selState.namedSelections.find(n => n.name === 'Crambin_CAs')!;
    assert(nsA, 'Named selection A must exist');
    assert.strictEqual(nsA.objectId, objAId);
    assert.strictEqual(nsA.stateId, 'mol-crn-state-1');
    assert.strictEqual(nsA.query, 'name CA');
    assert.strictEqual(nsA.atomIds.length, 46);
    assert.deepStrictEqual(nsA.atomIds, selA.selected_array);

    const nsB = selState.namedSelections.find(n => n.name === 'Ubiquitin_CAs')!;
    assert(nsB, 'Named selection B must exist');
    assert.strictEqual(nsB.objectId, objBId);
    assert.strictEqual(nsB.stateId, 'mol-ubq-state-1');
    assert.strictEqual(nsB.query, 'name CA');
    assert.strictEqual(nsB.atomIds.length, 76);
    assert.deepStrictEqual(nsB.atomIds, selB.selected_array);
  });

  test("6.2 ObjectA:1 !== ObjectB:1 semantic distinction and fail-closed validation on object deletion", () => {
    const keyA1 = createScopedAtomKey(objAId, 1);
    const keyB1 = createScopedAtomKey(objBId, 1);

    // Object A:1 is strictly distinct from Object B:1
    assert.strictEqual(keyA1, "obj-mol-crn:1");
    assert.strictEqual(keyB1, "obj-mol-ubq:1");
    assert.notStrictEqual(keyA1, keyB1);

    // Create selection referencing Object B
    const selDoc = SelectionParser.evaluateDocument("name CA", doc, { scopeType: 'workspace' });
    assert.strictEqual(selDoc.total_count, 122);

    // Build document without Object B (Object B removed)
    const docWithoutB = buildCanonicalDocument([molA], {
      document_id: 'doc-workspace-crn-only',
      name: 'Single Molecule Workspace'
    });

    // Validate that selection referencing Object B fails closed
    const validationResult = CanonicalSelectionEvaluator.validateSelection(docWithoutB, selDoc);
    assert.strictEqual(validationResult.valid, false);
    assert(validationResult.missingObjects.includes(objBId), "Must detect missing Object B");
  });

  console.log("\n================================================================================");
  console.log(`TEST SUMMARY: ${passedTests} / ${totalTests} Passed (${((passedTests / totalTests) * 100).toFixed(1)}%)`);
  console.log("================================================================================\n");

  if (passedTests !== totalTests) {
    process.exit(1);
  }
}

runSelectionScopeTestSuite();
