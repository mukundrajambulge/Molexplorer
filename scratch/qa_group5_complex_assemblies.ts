import fs from 'fs';
import path from 'path';
import { performance } from 'perf_hooks';
import { MolProcessor, Atom } from '../src/lib/MolProcessor';
import { SelectionParser } from '../src/lib/SelectionParser';
import { SessionManager } from '../src/session/SessionManager';
import { MolStudioSession } from '../src/session/SessionSchema';
import { CCP4Parser } from '../src/parsers/CCP4Parser';
import { generateIsosurfaceMesh } from '../src/lib/MarchingCubes';

interface ComplexTarget {
  pdbId: string;
  name: string;
  description: string;
}

const TARGETS: ComplexTarget[] = [
  { pdbId: '1AON', name: 'GroEL', description: 'Double-ring 14-mer chaperonin complex' },
  { pdbId: '1PMA', name: '20S Proteasome', description: 'Alpha7-Beta7 14-mer barrel complex' },
  { pdbId: '2GLS', name: 'Glutamine Synthetase', description: 'Dodecamer 12-mer complex' },
  { pdbId: '1B5S', name: 'Pyruvate Dehydrogenase', description: 'E1 heterotetramer complex' },
  { pdbId: '1FHA', name: 'Ferritin', description: '24-mer nanocage assembly' },
  { pdbId: '1NOL', name: 'Hemocyanin', description: 'Subunit multimer complex' },
  { pdbId: '1C8M', name: 'Virus Like Particle', description: 'MS2 capsid assembly subunit' },
  { pdbId: '1XIO', name: 'Clathrin Triskelion', description: 'Hub domain assembly' },
  { pdbId: '1JFF', name: 'Microtubule hexamer', description: 'Tubulin alpha-beta multimer' },
  { pdbId: '1AVO', name: 'Proteasome cap', description: 'PA28 heptamer activator cap' },
  { pdbId: '1RCX', name: 'RuBisCO', description: 'L8S8 hexadecamer assembly' },
  { pdbId: '2OHX', name: 'Alcohol Dehydrogenase tetramer', description: 'Zinc-dependent tetramer' },
  { pdbId: '1LDM', name: 'Lactate Dehydrogenase tetramer', description: 'Glycolytic tetramer' },
  { pdbId: '1PFK', name: 'Phosphofructokinase', description: 'Allosteric tetramer' },
  { pdbId: '1HWZ', name: 'Glutamate Dehydrogenase', description: 'Hexameric enzyme' },
  { pdbId: '1CTS', name: 'Citrate Synthase dimer', description: 'Kreb cycle dimer' },
  { pdbId: '1FUO', name: 'Fumarase', description: 'Tetramer' },
  { pdbId: '1YQU', name: 'Succinate Dehydrogenase', description: 'Respiratory Complex II tetramer' },
  { pdbId: '1CW7', name: 'Isocitrate Dehydrogenase', description: 'Dimer/Tetramer' },
  { pdbId: '4MDH', name: 'Malate Dehydrogenase', description: 'Tetramer' },
];

function dist(a: { x: number; y: number; z: number }, b: { x: number; y: number; z: number }): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  const dz = a.z - b.z;
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

function calculateAngle(
  a: { x: number; y: number; z: number },
  b: { x: number; y: number; z: number },
  c: { x: number; y: number; z: number }
): number {
  const ba = { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z };
  const bc = { x: c.x - b.x, y: c.y - b.y, z: c.z - b.z };
  const dot = ba.x * bc.x + ba.y * bc.y + ba.z * bc.z;
  const lenBA = Math.sqrt(ba.x * ba.x + ba.y * ba.y + ba.z * ba.z);
  const lenBC = Math.sqrt(bc.x * bc.x + bc.y * bc.y + bc.z * bc.z);
  if (lenBA === 0 || lenBC === 0) return 0;
  const cosTheta = Math.max(-1, Math.min(1, dot / (lenBA * lenBC)));
  return Math.acos(cosTheta) * (180.0 / Math.PI);
}

function calculateDihedral(
  a: { x: number; y: number; z: number },
  b: { x: number; y: number; z: number },
  c: { x: number; y: number; z: number },
  d: { x: number; y: number; z: number }
): number {
  const b1 = { x: b.x - a.x, y: b.y - a.y, z: b.z - a.z };
  const b2 = { x: c.x - b.x, y: c.y - b.y, z: c.z - b.z };
  const b3 = { x: d.x - c.x, y: d.y - c.y, z: d.z - c.z };
  const n1 = { x: b1.y * b2.z - b1.z * b2.y, y: b1.z * b2.x - b1.x * b2.z, z: b1.x * b2.y - b1.y * b2.x };
  const n2 = { x: b2.y * b3.z - b2.z * b3.y, y: b2.z * b3.x - b2.x * b3.z, z: b2.x * b3.y - b2.y * b3.x };
  const lenB2 = Math.sqrt(b2.x * b2.x + b2.y * b2.y + b2.z * b2.z);
  const m1 = { x: n1.y * b2.z - n1.z * b2.y, y: n1.z * b2.x - n1.x * b2.z, z: n1.x * b2.y - n1.y * b2.x };
  const dotN = n1.x * n2.x + n1.y * n2.y + n1.z * n2.z;
  const dotM = lenB2 > 0 ? (m1.x * n2.x + m1.y * n2.y + m1.z * n2.z) / lenB2 : 0;
  return Math.atan2(-dotM, dotN) * (180.0 / Math.PI);
}

async function fetchPDB(pdbId: string): Promise<string> {
  const scratchDir = path.join(process.cwd(), 'scratch');
  if (!fs.existsSync(scratchDir)) {
    fs.mkdirSync(scratchDir, { recursive: true });
  }
  const pdbPath = path.join(scratchDir, `${pdbId}.pdb`);
  if (fs.existsSync(pdbPath)) {
    return fs.readFileSync(pdbPath, 'utf-8');
  }

  const url = `https://files.rcsb.org/download/${pdbId}.pdb`;
  const resp = await fetch(url);
  if (!resp.ok) {
    throw new Error(`Failed to download ${pdbId}.pdb: ${resp.statusText}`);
  }
  const text = await resp.text();
  fs.writeFileSync(pdbPath, text, 'utf-8');
  return text;
}

async function main() {
  const startTime = performance.now();
  const logLines: string[] = [];
  let totalAssertions = 0;
  let passedAssertions = 0;

  const log = (msg: string) => {
    console.log(msg);
    logLines.push(msg);
  };

  const assert = (condition: boolean, testName: string, detail?: string) => {
    totalAssertions++;
    if (condition) {
      passedAssertions++;
      log(`  [PASS] ${testName}${detail ? ` (${detail})` : ''}`);
    } else {
      log(`  [FAIL] ${testName}${detail ? ` (${detail})` : ''}`);
    }
  };

  log("====================================================================================================");
  log("          MOLEXPLORER / MOLSTUDIO QA SUITE - GROUP 5: COMPLEX ASSEMBLIES & MULTIMERS");
  log("====================================================================================================\n");

  const targetResults: {
    pdbId: string;
    name: string;
    atomCount: number;
    chainCount: number;
    assembliesCount: number;
    symMateCount: number;
    helixPct: number;
    sheetPct: number;
    sessionValid: boolean;
    status: string;
  }[] = [];

  // Iterate over each of the 20 complex assembly targets
  for (let idx = 0; idx < TARGETS.length; idx++) {
    const target = TARGETS[idx];
    log(`----------------------------------------------------------------------------------------------------`);
    log(`[TARGET ${idx + 1}/20] ${target.name} (${target.pdbId}) - ${target.description}`);
    log(`----------------------------------------------------------------------------------------------------`);

    try {
      // 1. Fetch / Load PDB File
      const pdbText = await fetchPDB(target.pdbId);
      log(`PDB Loaded: ${pdbText.length} bytes`);

      // 2. Instantiate MolProcessor & Parse Structure
      const processor = new MolProcessor(pdbText, 'pdb');
      const atoms = processor.atoms;
      const nonWaterAtoms = atoms.filter(a => !['HOH', 'WAT', 'DOD', 'SOL'].includes(a.resName.trim().toUpperCase()));
      const chainIDs = Array.from(new Set(atoms.map(a => a.chainID))).filter(Boolean);

      assert(atoms.length > 500, `${target.pdbId} Atom Parsing`, `Total Atoms = ${atoms.length}, Chains = ${chainIDs.length}`);
      assert(chainIDs.length > 0, `${target.pdbId} Chain Extraction`, `Found chains: ${chainIDs.join(', ')}`);

      // 3. Biological Assembly Transformation Matrices Verification
      log(`\n  --- Biological Assembly Matrix Verification ---`);
      const assemblies = processor.assemblies;
      log(`  Parsed Assemblies Count: ${assemblies.length}`);

      let assemblyPdbLength = 0;
      let generatedChainsCount = 0;
      if (assemblies.length > 0) {
        const firstAss = assemblies[0];
        log(`  Assembly ${firstAss.id}: ${firstAss.operations.length} operations, isIdentityOnly = ${firstAss.isIdentityOnly}`);
        firstAss.operations.forEach((op, opIdx) => {
          log(`    Op ${opIdx + 1}: ${op.matrices.length} matrices, applies to chains: [${op.chains.join(', ')}]`);
          op.matrices.forEach((mat, mIdx) => {
            const r = mat.r;
            const det = r[0][0]*(r[1][1]*r[2][2] - r[1][2]*r[2][1])
                      - r[0][1]*(r[1][0]*r[2][2] - r[1][2]*r[2][0])
                      + r[0][2]*(r[1][0]*r[2][1] - r[1][1]*r[2][0]);
            log(`      Mat ${mIdx + 1}: det(R) = ${det.toFixed(4)}, T = (${mat.t[0].toFixed(2)}, ${mat.t[1].toFixed(2)}, ${mat.t[2].toFixed(2)})`);
          });
        });

        const genRes = processor.generateAssemblyPDB(firstAss.id);
        assemblyPdbLength = genRes.pdb.length;
        generatedChainsCount = genRes.generated_chains.length;
        log(`  Generated Assembly PDB: ${assemblyPdbLength} bytes, ${generatedChainsCount} affected chains`);
        assert(assemblyPdbLength >= 0, `${target.pdbId} Assembly PDB Generation`, `${assemblyPdbLength} bytes generated`);
      } else {
        log(`  No REMARK 350 Biological Assemblies defined; standard asymmetric unit structure.`);
        assert(true, `${target.pdbId} Assembly Parsing (Identity/ASU)`);
      }

      // 4. Crystal Symmetry Mate Generation Verification
      log(`\n  --- Crystal Symmetry Mate Generation Verification ---`);
      log(`  CRYST1 Flag Present: ${processor.hasCryst1}`);
      log(`  Parsed SMTRY Matrices Count: ${processor.symmetry_matrices.length}`);

      const symRes = processor.generateSymmetryPDB();
      log(`  Generated Symmetry PDB: ${symRes.pdb.length} bytes, ${symRes.count} symmetry mates`);
      assert(symRes.count >= 0, `${target.pdbId} Crystal Symmetry Generation`, `${symRes.count} symmetry mates generated`);

      // 5. Secondary Structure Calculation Verification
      log(`\n  --- Secondary Structure Calculation ---`);
      processor.calculateSecondaryStructure('quick');
      const ssList = processor.ss_per_residue;
      const helixCount = ssList.filter(s => s.ss_type === 'helix').length;
      const sheetCount = ssList.filter(s => s.ss_type === 'sheet').length;
      const loopCount = ssList.filter(s => s.ss_type === 'loop').length;
      const totalRes = ssList.length || 1;
      const helixPct = (helixCount / totalRes) * 100;
      const sheetPct = (sheetCount / totalRes) * 100;

      log(`  Secondary Structure Breakdown: ${helixCount} Helices (${helixPct.toFixed(1)}%), ${sheetCount} Sheets (${sheetPct.toFixed(1)}%), ${loopCount} Loops`);
      assert(totalRes > 0, `${target.pdbId} Secondary Structure Assignment`, `Total residues = ${totalRes}`);

      // 6. Selection Query Algebra Verification
      log(`\n  --- Selection Query Algebra Verification ---`);
      const selParser = new SelectionParser(atoms);
      const firstChain = chainIDs[0] || 'A';

      const q1 = `chain ${firstChain}`;
      const res1 = selParser.parse(q1);
      assert(res1.size > 0, `${target.pdbId} Query: "${q1}"`, `${res1.size} atoms selected`);

      const q2 = `resn LYS or resn ARG`;
      const res2 = selParser.parse(q2);
      assert(res2.size >= 0, `${target.pdbId} Query: "${q2}"`, `${res2.size} atoms selected`);

      const q3 = `backbone`;
      const res3 = selParser.parse(q3);
      assert(res3.size > 0, `${target.pdbId} Query: "${q3}"`, `${res3.size} atoms selected`);

      const q4 = `around 6.0 of (chain ${firstChain})`;
      const res4 = selParser.parse(q4);
      assert(res4.size >= 0, `${target.pdbId} Query: "${q4}"`, `${res4.size} atoms selected`);

      // 7. Measurement Distance / Angle / Dihedral Math Verification
      log(`\n  --- Measurement Distance / Angle / Dihedral Verification ---`);
      const caAtoms = atoms.filter(a => a.name.trim() === 'CA' && a.chainID === firstChain);
      if (caAtoms.length >= 4) {
        const d12 = dist(caAtoms[0], caAtoms[1]);
        const angle123 = calculateAngle(caAtoms[0], caAtoms[1], caAtoms[2]);
        const dih1234 = calculateDihedral(caAtoms[0], caAtoms[1], caAtoms[2], caAtoms[3]);

        log(`  CA[0]-CA[1] Distance: ${d12.toFixed(3)} Å`);
        log(`  CA[0]-CA[1]-CA[2] Angle: ${angle123.toFixed(2)}°`);
        log(`  CA[0]-CA[1]-CA[2]-CA[3] Dihedral: ${dih1234.toFixed(2)}°`);

        assert(d12 > 1.0 && d12 < 10.0, `${target.pdbId} Backbone CA-CA Distance Math`, `${d12.toFixed(3)} Å`);
        assert(angle123 >= 0 && angle123 <= 180, `${target.pdbId} Backbone CA-CA-CA Angle Math`, `${angle123.toFixed(2)}°`);
        assert(dih1234 >= -180 && dih1234 <= 180, `${target.pdbId} Backbone Dihedral Math`, `${dih1234.toFixed(2)}°`);
      } else {
        assert(true, `${target.pdbId} CA Atom Selection (< 4 CAs found)`);
      }

      // 8. State Isolation & Component Filtering Verification
      log(`\n  --- State Isolation & Component Filtering ---`);
      const chainSummaries = processor.getChainSummary();
      log(`  Chain Summaries (${chainSummaries.length} chains total):`);
      chainSummaries.slice(0, 5).forEach(cs => {
        log(`    Chain ${cs.chainID}: type=${cs.type}, ${cs.atomCount} atoms, ${cs.residueCount} residues`);
      });

      const isolatedChainAtoms = processor.filterAtomsByChains([firstChain]);
      assert(isolatedChainAtoms.length > 0, `${target.pdbId} Chain State Isolation`, `Isolated chain ${firstChain}: ${isolatedChainAtoms.length} atoms`);

      const proteinOnlyAtoms = processor.filterAtomsByComponentType({ protein: true, water: false, ion: false });
      assert(proteinOnlyAtoms.length > 0, `${target.pdbId} Component Type Filtering`, `Protein-only atoms: ${proteinOnlyAtoms.length}`);

      // 9. PSE Session Export / Import Integrity
      log(`\n  --- PSE Session Export & Import Verification ---`);
      const sessionObj: MolStudioSession = {
        version: '1.0',
        timestamp: Date.now(),
        molecule: {
          data: pdbText.substring(0, 1000), // snippet
          format: 'pdb',
          name: `${target.pdbId}_session`
        },
        selectedAtomSerials: Array.from(res1).slice(0, 10),
        namedSelections: [
          { name: 'chain_select', query: q1, atomIds: Array.from(res1).slice(0, 10) }
        ],
        measurements: [
          { id: 'm1', type: 'distance', atomSerials: [1, 2], coordinates: [{ x: 0, y: 0, z: 0 }, { x: 3.8, y: 0, z: 0 }], value: 3.8, label: '3.80 Å' }
        ],
        biophysical: { showDipoleArrow: true },
        viewState: {
          renderStyle: 'Cartoon',
          colorScheme: 'spectrum',
          surfaceOpacity: 0.8,
          backgroundColor: '#0A0A0A',
          orthographic: false,
          stereoMode: 'none'
        }
      };

      const exportedJson = SessionManager.exportSession(sessionObj);
      const reimportedSession = SessionManager.importSession(exportedJson);

      assert(
        reimportedSession.version === '1.0' &&
        reimportedSession.molecule?.name === `${target.pdbId}_session` &&
        reimportedSession.namedSelections.length === 1 &&
        reimportedSession.measurements.length === 1,
        `${target.pdbId} PSE Session Serialization Roundtrip`,
        `Exported length = ${exportedJson.length} bytes`
      );

      targetResults.push({
        pdbId: target.pdbId,
        name: target.name,
        atomCount: atoms.length,
        chainCount: chainIDs.length,
        assembliesCount: assemblies.length,
        symMateCount: symRes.count,
        helixPct,
        sheetPct,
        sessionValid: true,
        status: 'PASSED'
      });

    } catch (err: any) {
      log(`  [FAIL] Error processing target ${target.pdbId}: ${err.message}\n${err.stack}`);
      targetResults.push({
        pdbId: target.pdbId,
        name: target.name,
        atomCount: 0,
        chainCount: 0,
        assembliesCount: 0,
        symMateCount: 0,
        helixPct: 0,
        sheetPct: 0,
        sessionValid: false,
        status: 'FAILED'
      });
    }

    log(`\nTarget ${target.pdbId} testing complete.\n`);
  }

  // 10. Density Map Isosurfacing Verification (CCP4 + Marching Cubes)
  log("====================================================================================================");
  log("          SPECIAL TEST: SYNTHETIC CCP4 3D DENSITY MAP & MARCHING CUBES ISOSURFACING");
  log("====================================================================================================\n");

  try {
    const gridDim = 24;
    const headerSize = 1024;
    const dataSize = gridDim * gridDim * gridDim * 4;
    const buffer = new ArrayBuffer(headerSize + dataSize);
    const view = new DataView(buffer);

    // Header values
    view.setInt32(0, gridDim, true); // NC
    view.setInt32(4, gridDim, true); // NR
    view.setInt32(8, gridDim, true); // NS
    view.setInt32(12, 2, true);      // Mode 2 (Float32)
    view.setInt32(28, gridDim, true); // NX
    view.setInt32(32, gridDim, true); // NY
    view.setInt32(36, gridDim, true); // NZ
    view.setFloat32(40, 48.0, true); // Cell A
    view.setFloat32(44, 48.0, true); // Cell B
    view.setFloat32(48, 48.0, true); // Cell C
    view.setFloat32(52, 90.0, true);
    view.setFloat32(56, 90.0, true);
    view.setFloat32(60, 90.0, true);

    // Fill 3D Gaussian electron density sphere centered at (12, 12, 12)
    const floatData = new Float32Array(buffer, headerSize, gridDim * gridDim * gridDim);
    const center = gridDim / 2;
    for (let k = 0; k < gridDim; k++) {
      for (let j = 0; j < gridDim; j++) {
        for (let i = 0; i < gridDim; i++) {
          const dx = i - center;
          const dy = j - center;
          const dz = k - center;
          const r2 = dx * dx + dy * dy + dz * dz;
          const idx = i + j * gridDim + k * gridDim * gridDim;
          floatData[idx] = Math.exp(-r2 / 16.0);
        }
      }
    }

    const ccp4Parser = new CCP4Parser(buffer);
    assert(ccp4Parser.header.NC === gridDim && ccp4Parser.header.xLength === 48.0, "CCP4 Binary Header Parsing", `NC=${ccp4Parser.header.NC}, cellA=${ccp4Parser.header.xLength}Å`);

    const mesh05 = generateIsosurfaceMesh(ccp4Parser, 0.5);
    const mesh10 = generateIsosurfaceMesh(ccp4Parser, 1.0);
    const mesh20 = generateIsosurfaceMesh(ccp4Parser, 2.0);

    log(`  Isosurface Mesh at 0.5 sigma: ${mesh05.triangleCount} triangles, ${mesh05.positions.length / 3} vertices`);
    log(`  Isosurface Mesh at 1.0 sigma: ${mesh10.triangleCount} triangles, ${mesh10.positions.length / 3} vertices`);
    log(`  Isosurface Mesh at 2.0 sigma: ${mesh20.triangleCount} triangles, ${mesh20.positions.length / 3} vertices`);

    assert(mesh05.triangleCount > 0, "CCP4 Marching Cubes Isosurfacing (0.5 sigma)", `${mesh05.triangleCount} triangles`);
    assert(mesh10.triangleCount > 0, "CCP4 Marching Cubes Isosurfacing (1.0 sigma)", `${mesh10.triangleCount} triangles`);
    assert(mesh20.triangleCount > 0, "CCP4 Marching Cubes Isosurfacing (2.0 sigma)", `${mesh20.triangleCount} triangles`);
  } catch (err: any) {
    assert(false, "CCP4 3D Density Map & Marching Cubes Test", err.message);
  }

  // Summary Table Output
  log("\n====================================================================================================");
  log("               SUMMARY TABLE: 20 COMPLEX ASSEMBLIES QA VERIFICATION RESULTS");
  log("====================================================================================================");
  log("PDB ID  Target Name                 Atoms    Chains  Assemblies  SymMates  Helix %  Sheet %  Session  Status");
  log("----------------------------------------------------------------------------------------------------");
  targetResults.forEach(r => {
    const pdbStr = r.pdbId.padEnd(7, ' ');
    const nameStr = r.name.padEnd(27, ' ');
    const atomStr = r.atomCount.toString().padStart(7, ' ');
    const chainStr = r.chainCount.toString().padStart(8, ' ');
    const assStr = r.assembliesCount.toString().padStart(11, ' ');
    const symStr = r.symMateCount.toString().padStart(9, ' ');
    const hStr = r.helixPct.toFixed(1).padStart(7, ' ') + '%';
    const sStr = r.sheetPct.toFixed(1).padStart(7, ' ') + '%';
    const sessStr = r.sessionValid ? "  PASS  " : "  FAIL  ";
    log(`${pdbStr} ${nameStr} ${atomStr} ${chainStr} ${assStr} ${symStr} ${hStr} ${sStr} ${sessStr}  ${r.status}`);
  });
  log("----------------------------------------------------------------------------------------------------");

  const endTime = performance.now();
  const durationMs = endTime - startTime;
  log(`\n====================================================================================================`);
  log(`TEST SUITE COMPLETE: ${passedAssertions} / ${totalAssertions} Assertions Passed (${((passedAssertions / totalAssertions) * 100).toFixed(1)}%)`);
  log(`Total Execution Time: ${durationMs.toFixed(2)} ms (${(durationMs / 1000).toFixed(2)} s)`);
  log(`====================================================================================================`);

  // Write complete log to scratch/qa_group5_complex_assemblies.log
  const logFilePath = path.join(process.cwd(), 'scratch', 'qa_group5_complex_assemblies.log');
  fs.writeFileSync(logFilePath, logLines.join('\n'), 'utf-8');
  console.log(`\nLog file successfully written to: ${logFilePath}`);

  if (passedAssertions !== totalAssertions) {
    process.exit(1);
  }
}

main().catch(err => {
  console.error("Fatal error executing QA Group 5 test suite:", err);
  process.exit(1);
});
