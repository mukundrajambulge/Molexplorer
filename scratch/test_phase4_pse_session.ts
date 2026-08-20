import fs from 'fs';
import path from 'path';
import { SessionManager } from '../src/session/SessionManager';
import { MolStudioPSESession } from '../src/session/SessionSchema';
import { MolProcessor } from '../src/lib/MolProcessor';

async function runPhase4SessionTests() {
  console.log('====================================================');
  console.log(' PHASE 4: MOLSTUDIO PSE SESSION SUITE ');
  console.log('====================================================\n');

  let passed = 0;
  let total = 0;

  function assert(condition: boolean, description: string) {
    total++;
    if (condition) {
      passed++;
      console.log(`  [PASS] ${description}`);
    } else {
      console.error(`  [FAIL] ${description}`);
    }
  }

  // --- SECTION 1: PSE SCHEMA & EXPORT VERIFICATION ---
  console.log('--- SECTION 1: PSE Versioned Schema & Export ---');
  const dummySession = SessionManager.createSession({
    molecules: [
      {
        id: 'main_mol',
        name: 'test_mol',
        format: 'pdb',
        data: 'ATOM      1  N   ALA A   1      10.000  10.000  10.000  1.00 20.00           N\nEND',
        atomCount: 1,
        visible: true
      }
    ],
    viewerState: {
      renderStyle: 'Ball-and-Stick',
      colorScheme: 'Modern/Jmol',
      surfaceOpacity: 0.65,
      backgroundColor: '#1A1A24',
      orthographic: true,
      stereoMode: 'none'
    },
    selectionState: {
      selectionLevel: 'ligand',
      selectedAtomSerials: [17, 18, 19, 20],
      namedSelections: [{ name: 'pocket', query: 'around 5.0', atomIds: [1, 2] }]
    }
  });

  assert(dummySession.format === 'MolStudio-PSE', 'Session format header is "MolStudio-PSE"');
  assert(dummySession.version === 1, 'Session schema version is 1');
  assert(typeof dummySession.createdAt === 'string', 'createdAt timestamp string present');
  assert(dummySession.application.name === 'Molexplorer' && dummySession.application.module === 'MolStudio', 'Application metadata present');

  const jsonExport = SessionManager.exportSession(dummySession);
  assert(jsonExport.includes('"format": "MolStudio-PSE"'), 'Exported JSON string contains format identifier');
  assert(jsonExport.includes('"version": 1'), 'Exported JSON string contains version 1');

  // --- SECTION 2: INVALID SESSION & SAFEFALL BACKUP TEST ---
  console.log('\n--- SECTION 2: Invalid Session File Handling & Validation ---');

  // Test 2.1: Empty file
  try {
    SessionManager.importSession('');
    assert(false, 'Empty file should throw validation error');
  } catch (e: any) {
    assert(e.message.includes('File is empty'), `Empty file throws expected error: "${e.message}"`);
  }

  // Test 2.2: Malformed JSON
  try {
    SessionManager.importSession('{ "format": "MolStudio-PSE", version: invalid }');
    assert(false, 'Malformed JSON should throw validation error');
  } catch (e: any) {
    assert(e.message.includes('Malformed JSON content'), `Malformed JSON throws expected error: "${e.message}"`);
  }

  // Test 2.3: Unsupported schema version
  try {
    SessionManager.importSession(JSON.stringify({
      format: 'MolStudio-PSE',
      version: 99,
      molecules: [{ id: 'm1', data: 'ATOM 1 N ALA', format: 'pdb' }]
    }));
    assert(false, 'Unsupported version should throw validation error');
  } catch (e: any) {
    assert(e.message.includes('Unsupported MolStudio-PSE version'), `Unsupported version throws expected error: "${e.message}"`);
  }

  // Test 2.4: Missing molecular structure data
  try {
    SessionManager.importSession(JSON.stringify({
      format: 'MolStudio-PSE',
      version: 1,
      molecules: []
    }));
    assert(false, 'Missing molecules should throw validation error');
  } catch (e: any) {
    assert(e.message.includes('Missing molecular structure data'), `Missing molecules throws expected error: "${e.message}"`);
  }

  // --- SECTION 3: BACKWARD COMPATIBILITY TEST ---
  console.log('\n--- SECTION 3: Legacy .json Session Import & Conversion ---');
  const legacyJson = JSON.stringify({
    version: '1.0',
    timestamp: Date.now(),
    name: 'legacy_1crn',
    atomCount: 46,
    pdbContent: 'ATOM      1  N   THR A   1      17.047  14.099   3.625  1.00 13.79           N\nEND',
    renderStyle: 'Cartoon',
    colorScheme: 'spectrum',
    surfaceOpacity: 0.8,
    backgroundColor: '#0A0A0A',
    selectedAtomSerials: [1, 2, 3]
  });

  const importedLegacy = SessionManager.importSession(legacyJson);
  assert(importedLegacy.format === 'MolStudio-PSE', 'Legacy session converted to MolStudio-PSE format');
  assert(importedLegacy.version === 1, 'Legacy session assigned version 1');
  assert(importedLegacy.molecules[0].data.includes('THR A   1'), 'Legacy molecule PDB content restored');
  assert(importedLegacy.selectionState.selectedAtomSerials.length === 3, 'Legacy selectedAtomSerials restored');
  assert(importedLegacy.metadata?.legacyConverted === true, 'Legacy flag set in metadata');

  // --- SECTION 4: EXPLICIT CONTROLLED FIXTURE TEST (REQUIREMENT #14) ---
  console.log('\n--- SECTION 4: Controlled Fixture Test (03_protein_with_ligand.pdb) ---');
  const fixturePath = path.join(process.cwd(), 'fixtures', '03_protein_with_ligand.pdb');
  assert(fs.existsSync(fixturePath), 'Controlled fixture 03_protein_with_ligand.pdb exists');

  const fixturePDB = fs.readFileSync(fixturePath, 'utf8');
  const proc = new MolProcessor(fixturePDB, 'pdb');
  assert(proc.atoms.length === 20, `Fixture total atom count is 20 (got ${proc.atoms.length})`);

  const ligandAtoms = proc.atoms.filter(a => a.resName === 'LIG' || a.isHetatm);
  assert(ligandAtoms.length === 4, `Fixture ligand atom count is 4 (got ${ligandAtoms.length})`);

  // Pre-save state configuration
  const preSaveState = {
    molecules: [
      {
        id: 'main_mol',
        name: '03_protein_with_ligand',
        format: 'pdb' as const,
        data: fixturePDB,
        atomCount: proc.atoms.length,
        visible: true
      }
    ],
    viewerState: {
      renderStyle: 'Ball-and-Stick' as const,
      colorScheme: 'Modern/Jmol',
      surfaceOpacity: 0.65,
      backgroundColor: '#1A1A24',
      orthographic: true,
      stereoMode: 'none' as const,
      camera: {
        position: { x: 15.5, y: 14.2, z: 12.8 },
        zoom: 1.8
      }
    },
    selectionState: {
      selectionLevel: 'ligand' as const,
      selectedAtomSerials: ligandAtoms.map(a => a.serial),
      namedSelections: [{ name: 'active_site', query: 'resn LIG', atomIds: ligandAtoms.map(a => a.serial) }]
    },
    measurements: [
      {
        id: 'dist-1',
        type: 'distance' as const,
        atomSerials: [16, 17],
        coordinates: [{ x: 17.4, y: 11.5, z: 9.7 }, { x: 20.0, y: 20.0, z: 20.0 }],
        value: 12.55,
        label: '12.55 Å'
      }
    ],
    biophysical: {
      showDipoleArrow: true
    }
  };

  // Save to .pse
  const pseObject = SessionManager.createSession(preSaveState);
  const pseContent = SessionManager.exportSession(pseObject);
  const pseFilePath = path.join(process.cwd(), 'scratch', 'P4_ligand_state_test.pse');
  fs.writeFileSync(pseFilePath, pseContent, 'utf8');

  assert(fs.existsSync(pseFilePath), 'Saved session file P4_ligand_state_test.pse exists');
  assert(pseFilePath.endsWith('.pse'), 'Saved session file extension is strictly .pse');

  // Simulate refresh / load back
  const reloadedContent = fs.readFileSync(pseFilePath, 'utf8');
  const restoredSession = SessionManager.importSession(reloadedContent);

  assert(restoredSession.format === 'MolStudio-PSE', 'Restored session format is MolStudio-PSE');
  assert(restoredSession.molecules.length === 1, 'Restored molecule count is 1');

  const restoredProc = new MolProcessor(restoredSession.molecules[0].data, restoredSession.molecules[0].format);
  assert(restoredProc.atoms.length === 20, `Restored atom count matches pre-save state (20 atoms)`);

  const restoredLigandAtoms = restoredProc.atoms.filter(a => a.resName === 'LIG' || a.isHetatm);
  assert(restoredLigandAtoms.length === 4, `Restored ligand atom count matches pre-save state (4 atoms)`);
  assert(
    JSON.stringify(restoredSession.selectionState.selectedAtomSerials.sort()) === JSON.stringify(ligandAtoms.map(a => a.serial).sort()),
    'Restored selected atom serials match ligand atom serials [17, 18, 19, 20]'
  );

  assert(restoredSession.selectionState.selectionLevel === 'ligand', 'Restored selection level is "ligand"');
  assert(restoredSession.viewerState.renderStyle === 'Ball-and-Stick', 'Restored representation style is "Ball-and-Stick"');
  assert(restoredSession.viewerState.colorScheme === 'Modern/Jmol', 'Restored color scheme is "Modern/Jmol"');
  assert(restoredSession.viewerState.surfaceOpacity === 0.65, 'Restored surface opacity is 0.65');
  assert(restoredSession.viewerState.backgroundColor === '#1A1A24', 'Restored canvas background is "#1A1A24"');
  assert(restoredSession.viewerState.orthographic === true, 'Restored orthographic camera mode is true');
  assert(restoredSession.measurements.length === 1, 'Restored measurement count is 1');

  // --- SECTION 5: SCIENTIFIC IMMUTABILITY VERIFICATION ---
  console.log('\n--- SECTION 5: Scientific Immutability Verification ---');
  let atomicCoordsMatch = true;
  for (let i = 0; i < proc.atoms.length; i++) {
    const a = proc.atoms[i];
    const b = restoredProc.atoms[i];
    if (a.x !== b.x || a.y !== b.y || a.z !== b.z || a.name !== b.name || a.resName !== b.resName || a.chainID !== b.chainID) {
      atomicCoordsMatch = false;
      break;
    }
  }
  assert(atomicCoordsMatch, 'Authoritative atomic coordinates and identifiers remain 100% immutable throughout save/load round-trip');

  console.log(`\n====================================================`);
  console.log(` TEST SUMMARY: ${passed} / ${total} TESTS PASSED `);
  console.log(`====================================================\n`);

  if (passed !== total) {
    process.exit(1);
  }
}

runPhase4SessionTests().catch(err => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
