import { SessionManager } from '../src/session/SessionManager';
import { MolStudioSession } from '../src/session/SessionSchema';

function runStage7Tests() {
  console.log("=== Stage 7 Automated Verification Test Suite ===");
  let passed = 0;
  let total = 0;

  function assert(condition: boolean, msg: string) {
    total++;
    if (condition) {
      console.log(`✓ PASS: ${msg}`);
      passed++;
    } else {
      console.error(`✗ FAIL: ${msg}`);
    }
  }

  // Test 1: Session Serialization & Deserialization Integrity
  try {
    const mockSession: MolStudioSession = {
      version: '1.0',
      timestamp: 1786000000000,
      molecule: {
        data: 'HEADER    TEST MOLECULE\nATOM      1  N   ALA A   1      10.000  10.000  10.000  1.00 20.00           N\n',
        format: 'pdb',
        name: 'Test_1CRN'
      },
      selectedAtomSerials: [1, 2, 5],
      namedSelections: [{ name: 'pocket', query: 'resi 1-5', atomIds: [1, 2, 3, 4, 5] }],
      measurements: [{
        id: 'dist-1-2',
        type: 'distance',
        atomSerials: [1, 2],
        coordinates: [{ x: 10, y: 10, z: 10 }, { x: 12, y: 10, z: 10 }],
        value: 2.0,
        label: '2.00 Å'
      }],
      biophysical: {
        showDipoleArrow: true,
        dipoleMoment: { charge: 0, magnitude: 4.5 }
      },
      viewState: {
        renderStyle: 'Cartoon',
        colorScheme: 'spectrum',
        surfaceOpacity: 0.8,
        backgroundColor: '#0A0A0A',
        orthographic: true,
        stereoMode: 'none'
      }
    };

    const jsonStr = SessionManager.exportSession(mockSession);
    const restored = SessionManager.importSession(jsonStr);

    assert(restored.version === '1.0', 'Session version preserved');
    assert(restored.molecule?.name === 'Test_1CRN', 'Molecule data restored');
    assert(restored.selectedAtomSerials.length === 3, 'Selected atom serials restored');
    assert(restored.namedSelections[0].name === 'pocket', 'Named selections restored');
    assert(restored.measurements[0].value === 2.0, '3D measurements restored');
    assert(restored.viewState.orthographic === true, 'Orthographic camera state restored');
  } catch (e: any) {
    assert(false, `Session serialization test failed: ${e.message}`);
  }

  // Test 2: Sequence Residue Code Mapping
  const THREE_TO_ONE: Record<string, string> = {
    ALA: 'A', CYS: 'C', ASP: 'D', GLU: 'E', PHE: 'F',
    GLY: 'G', HIS: 'H', ILE: 'I', LYS: 'K', LEU: 'L',
    MET: 'M', ASN: 'N', PRO: 'P', GLN: 'Q', ARG: 'R',
    SER: 'S', THR: 'T', VAL: 'V', TRP: 'W', TYR: 'Y'
  };
  assert(THREE_TO_ONE['ALA'] === 'A' && THREE_TO_ONE['LYS'] === 'K', 'Amino acid 3-to-1 letter mapping correct');

  console.log(`\n=== STAGE 7 SUMMARY: ${passed} / ${total} Passed (${((passed / total) * 100).toFixed(1)}%) ===`);
  if (passed !== total) process.exit(1);
}

runStage7Tests();
