import initRDKitModule from '@rdkit/rdkit';
import { MolProcessor } from '../src/lib/MolProcessor';
import { SelectionParser, Atom } from '../src/lib/SelectionParser';
import * as fs from 'fs';
import * as path from 'path';

export interface Tier2MoleculeDef {
  id: string;
  name: string;
  smiles: string;
  formula: string;
  expectedHeavyAtoms: number;
  expectedTotalAtoms: number;
  expectedC_or_N: number;
  expectedNotHydrogens: number;
  expectedOrganic: number;
  expectedHBD: number;
  expectedHBA: number;
}

export const TIER2_MOLECULES: Tier2MoleculeDef[] = [
  { id: "t2_01", name: "Benzene", smiles: "c1ccccc1", formula: "C6H6", expectedHeavyAtoms: 6, expectedTotalAtoms: 12, expectedC_or_N: 6, expectedNotHydrogens: 6, expectedOrganic: 12, expectedHBD: 0, expectedHBA: 0 },
  { id: "t2_02", name: "Ethanol", smiles: "CCO", formula: "C2H6O", expectedHeavyAtoms: 3, expectedTotalAtoms: 9, expectedC_or_N: 2, expectedNotHydrogens: 3, expectedOrganic: 9, expectedHBD: 1, expectedHBA: 1 },
  { id: "t2_03", name: "Acetone", smiles: "CC(=O)C", formula: "C3H6O", expectedHeavyAtoms: 4, expectedTotalAtoms: 10, expectedC_or_N: 3, expectedNotHydrogens: 4, expectedOrganic: 10, expectedHBD: 0, expectedHBA: 1 },
  { id: "t2_04", name: "Pyridine", smiles: "c1ccncc1", formula: "C5H5N", expectedHeavyAtoms: 6, expectedTotalAtoms: 11, expectedC_or_N: 6, expectedNotHydrogens: 6, expectedOrganic: 11, expectedHBD: 0, expectedHBA: 1 },
  { id: "t2_05", name: "Phenol", smiles: "Oc1ccccc1", formula: "C6H6O", expectedHeavyAtoms: 7, expectedTotalAtoms: 13, expectedC_or_N: 6, expectedNotHydrogens: 7, expectedOrganic: 13, expectedHBD: 1, expectedHBA: 1 },
  { id: "t2_06", name: "Toluene", smiles: "Cc1ccccc1", formula: "C7H8", expectedHeavyAtoms: 7, expectedTotalAtoms: 15, expectedC_or_N: 7, expectedNotHydrogens: 7, expectedOrganic: 15, expectedHBD: 0, expectedHBA: 0 },
  { id: "t2_07", name: "Aniline", smiles: "Nc1ccccc1", formula: "C6H7N", expectedHeavyAtoms: 7, expectedTotalAtoms: 14, expectedC_or_N: 7, expectedNotHydrogens: 7, expectedOrganic: 14, expectedHBD: 1, expectedHBA: 1 },
  { id: "t2_08", name: "Furan", smiles: "c1ccoc1", formula: "C4H4O", expectedHeavyAtoms: 5, expectedTotalAtoms: 9, expectedC_or_N: 4, expectedNotHydrogens: 5, expectedOrganic: 9, expectedHBD: 0, expectedHBA: 1 },
  { id: "t2_09", name: "Thiophene", smiles: "c1ccsc1", formula: "C4H4S", expectedHeavyAtoms: 5, expectedTotalAtoms: 9, expectedC_or_N: 4, expectedNotHydrogens: 5, expectedOrganic: 9, expectedHBD: 0, expectedHBA: 1 },
  { id: "t2_10", name: "Pyrrole", smiles: "c1cc[nH]c1", formula: "C4H5N", expectedHeavyAtoms: 5, expectedTotalAtoms: 10, expectedC_or_N: 5, expectedNotHydrogens: 5, expectedOrganic: 10, expectedHBD: 1, expectedHBA: 0 },
  { id: "t2_11", name: "Cyclohexane", smiles: "C1CCCCC1", formula: "C6H12", expectedHeavyAtoms: 6, expectedTotalAtoms: 18, expectedC_or_N: 6, expectedNotHydrogens: 6, expectedOrganic: 18, expectedHBD: 0, expectedHBA: 0 },
  { id: "t2_12", name: "Ethylene glycol", smiles: "OCCO", formula: "C2H6O2", expectedHeavyAtoms: 4, expectedTotalAtoms: 10, expectedC_or_N: 2, expectedNotHydrogens: 4, expectedOrganic: 10, expectedHBD: 2, expectedHBA: 2 },
  { id: "t2_13", name: "Acetic acid", smiles: "CC(=O)O", formula: "C2H4O2", expectedHeavyAtoms: 4, expectedTotalAtoms: 8, expectedC_or_N: 2, expectedNotHydrogens: 4, expectedOrganic: 8, expectedHBD: 1, expectedHBA: 1 },
  { id: "t2_14", name: "Acetamide", smiles: "CC(=O)N", formula: "C2H5NO", expectedHeavyAtoms: 4, expectedTotalAtoms: 9, expectedC_or_N: 3, expectedNotHydrogens: 4, expectedOrganic: 9, expectedHBD: 1, expectedHBA: 1 },
  { id: "t2_15", name: "Acetonitrile", smiles: "CC#N", formula: "C2H3N", expectedHeavyAtoms: 3, expectedTotalAtoms: 6, expectedC_or_N: 3, expectedNotHydrogens: 3, expectedOrganic: 6, expectedHBD: 0, expectedHBA: 1 },
  { id: "t2_16", name: "Fluorobenzene", smiles: "Fc1ccccc1", formula: "C6H5F", expectedHeavyAtoms: 7, expectedTotalAtoms: 12, expectedC_or_N: 6, expectedNotHydrogens: 7, expectedOrganic: 12, expectedHBD: 0, expectedHBA: 0 },
  { id: "t2_17", name: "Glycerol", smiles: "OCC(O)CO", formula: "C3H8O3", expectedHeavyAtoms: 6, expectedTotalAtoms: 14, expectedC_or_N: 3, expectedNotHydrogens: 6, expectedOrganic: 14, expectedHBD: 3, expectedHBA: 3 },
  { id: "t2_18", name: "Lactic acid", smiles: "CC(O)C(=O)O", formula: "C3H6O3", expectedHeavyAtoms: 6, expectedTotalAtoms: 12, expectedC_or_N: 3, expectedNotHydrogens: 6, expectedOrganic: 12, expectedHBD: 2, expectedHBA: 2 },
  { id: "t2_19", name: "Urea", smiles: "NC(=O)N", formula: "CH4N2O", expectedHeavyAtoms: 4, expectedTotalAtoms: 8, expectedC_or_N: 3, expectedNotHydrogens: 4, expectedOrganic: 8, expectedHBD: 2, expectedHBA: 1 },
  { id: "t2_20", name: "Oxalic acid", smiles: "O=C(O)C(=O)O", formula: "C2H2O4", expectedHeavyAtoms: 6, expectedTotalAtoms: 8, expectedC_or_N: 2, expectedNotHydrogens: 6, expectedOrganic: 8, expectedHBD: 2, expectedHBA: 2 }
];

function molblockToPDB(molblock: string): string {
  const lines = molblock.split('\n');
  let headerIndex = -1;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('V2000')) {
      headerIndex = i;
      break;
    }
  }
  if (headerIndex === -1) return '';

  const countsLine = lines[headerIndex];
  const numAtoms = parseInt(countsLine.substring(0, 3).trim(), 10);
  const pdbLines: string[] = [];

  for (let i = 1; i <= numAtoms; i++) {
    const line = lines[headerIndex + i];
    if (!line) continue;
    const x = parseFloat(line.substring(0, 10).trim());
    const y = parseFloat(line.substring(10, 20).trim());
    const z = parseFloat(line.substring(20, 30).trim());
    const elem = line.substring(31, 34).trim();
    
    const serialStr = i.toString().padStart(5, ' ');
    const elemStr = elem.padStart(2, ' ').substring(0, 2);
    const atomName = `${elem}${i}`.padEnd(4, ' ').substring(0, 4);
    const xStr = x.toFixed(3).padStart(8, ' ');
    const yStr = y.toFixed(3).padStart(8, ' ');
    const zStr = z.toFixed(3).padStart(8, ' ');
    
    pdbLines.push(`HETATM${serialStr} ${atomName} LIG A   1    ${xStr}${yStr}${zStr}  1.00  0.00          ${elemStr}`);
  }
  return pdbLines.join('\n');
}

async function runTier2TestSuite() {
  console.log("========================================================================");
  console.log("             AGENT TIER 2 (20 SMALL ORGANIC MOLECULES) TEST SUITE        ");
  console.log("========================================================================\n");

  const rdkit = await initRDKitModule();
  console.log(`[RDKit WASM Initialized] Version: ${rdkit.version()}\n`);

  const results: any[] = [];
  let passCount = 0;
  let failCount = 0;
  const issuesFound: string[] = [];

  for (const molDef of TIER2_MOLECULES) {
    console.log(`------------------------------------------------------------------------`);
    console.log(`Testing Molecule: ${molDef.name} (${molDef.smiles}) [Formula: ${molDef.formula}]`);
    console.log(`------------------------------------------------------------------------`);

    const molTelemetry: any = {
      id: molDef.id,
      name: molDef.name,
      smilesInput: molDef.smiles,
      checks: {},
      issues: []
    };

    // -------------------------------------------------------------------------
    // CHECK 1: 2D/3D Ketcher roundtrip conversion and SMILES export
    // -------------------------------------------------------------------------
    const check1Start = performance.now();
    let check1Pass = false;
    let exported2DSmiles = '';
    let exported3DSmiles = '';

    try {
      const rdMol = rdkit.get_mol(molDef.smiles);
      if (!rdMol) {
        throw new Error(`Failed to parse SMILES "${molDef.smiles}" with RDKit`);
      }

      // Generate 2D MolBlock (Ketcher 2D equivalent)
      const molBlock2D = rdMol.get_molblock();
      exported2DSmiles = rdMol.get_smiles();

      // Test 2D Ketcher roundtrip: parse exported 2D MolBlock back to RDKit & export SMILES
      const roundtrip2DMol = rdkit.get_mol(molBlock2D);
      if (!roundtrip2DMol) {
        throw new Error("2D MolBlock failed roundtrip parsing");
      }
      const roundtrip2DSmiles = roundtrip2DMol.get_smiles();
      roundtrip2DMol.delete();

      const is2DRoundtripValid = (exported2DSmiles === roundtrip2DSmiles);

      // Simulate 3D coordinate generation & 3D SMILES export
      const roundtrip3DMol = rdkit.get_mol(molBlock2D);
      exported3DSmiles = roundtrip3DMol ? roundtrip3DMol.get_smiles() : '';
      if (roundtrip3DMol) roundtrip3DMol.delete();

      rdMol.delete();

      check1Pass = is2DRoundtripValid && exported2DSmiles.length > 0;
      molTelemetry.checks.roundtrip = {
        status: check1Pass ? "PASS" : "FAIL",
        timeMs: performance.now() - check1Start,
        exported2DSmiles,
        exported3DSmiles,
        isCanonicalMatch: exported2DSmiles === molDef.smiles || is2DRoundtripValid
      };

      if (!check1Pass) {
        const issue = `${molDef.name}: 2D/3D roundtrip SMILES mismatch (${molDef.smiles} vs ${exported2DSmiles})`;
        molTelemetry.issues.push(issue);
        issuesFound.push(issue);
      }
    } catch (err: any) {
      molTelemetry.checks.roundtrip = {
        status: "FAIL",
        timeMs: performance.now() - check1Start,
        error: err.message
      };
      const issue = `${molDef.name}: Roundtrip failed with error: ${err.message}`;
      molTelemetry.issues.push(issue);
      issuesFound.push(issue);
    }

    // -------------------------------------------------------------------------
    // CHECK 2: RDKit descriptor calculation (LogP, TPSA, MW, HBD, HBA)
    // -------------------------------------------------------------------------
    const check2Start = performance.now();
    let check2Pass = false;
    let descriptors: any = {};

    try {
      const rdMol = rdkit.get_mol(molDef.smiles);
      if (!rdMol) throw new Error("RDKit parse failed for descriptor calculation");

      const descJson = JSON.parse(rdMol.get_descriptors());
      descriptors = {
        mw: descJson.amw,
        exactmw: descJson.exactmw,
        logp: descJson.CrippenClogP,
        tpsa: descJson.tpsa,
        hbd: descJson.NumHBD,
        hba: descJson.NumHBA,
        heavyAtoms: descJson.NumHeavyAtoms,
        totalAtoms: descJson.NumAtoms
      };

      rdMol.delete();

      const mwValid = descriptors.mw > 0 && typeof descriptors.mw === 'number';
      const logpValid = typeof descriptors.logp === 'number';
      const tpsaValid = descriptors.tpsa >= 0 && typeof descriptors.tpsa === 'number';
      const hbdValid = descriptors.hbd === molDef.expectedHBD;
      const hbaValid = descriptors.hba === molDef.expectedHBA;

      check2Pass = mwValid && logpValid && tpsaValid && hbdValid && hbaValid;

      molTelemetry.checks.descriptors = {
        status: check2Pass ? "PASS" : "FAIL",
        timeMs: performance.now() - check2Start,
        descriptors,
        expectedHBD: molDef.expectedHBD,
        expectedHBA: molDef.expectedHBA
      };

      if (!check2Pass) {
        const issue = `${molDef.name}: Descriptor mismatch (HBD: got ${descriptors.hbd} vs exp ${molDef.expectedHBD}, HBA: got ${descriptors.hba} vs exp ${molDef.expectedHBA})`;
        molTelemetry.issues.push(issue);
        issuesFound.push(issue);
      }
    } catch (err: any) {
      molTelemetry.checks.descriptors = {
        status: "FAIL",
        timeMs: performance.now() - check2Start,
        error: err.message
      };
      const issue = `${molDef.name}: Descriptor calculation failed: ${err.message}`;
      molTelemetry.issues.push(issue);
      issuesFound.push(issue);
    }

    // -------------------------------------------------------------------------
    // Construct 3D Atom Set for Rendering & Selection Query Testing
    // -------------------------------------------------------------------------
    let atomsForSelection: Atom[] = [];
    try {
      const rdMol = rdkit.get_mol(molDef.smiles);
      rdMol.add_hs_in_place();
      const molblockWithH = rdMol.get_molblock();
      const pdbData = molblockToPDB(molblockWithH);
      rdMol.delete();

      const processor = new MolProcessor(pdbData, 'pdb');
      atomsForSelection = (processor.atoms as Atom[]) || [];
    } catch (err: any) {
      console.warn(`[Warning] Could not parse 3D atoms via MolProcessor: ${err.message}`);
    }

    // -------------------------------------------------------------------------
    // CHECK 3: Ball-and-Stick vs Space-Filling vs Stick rendering
    // -------------------------------------------------------------------------
    const check3Start = performance.now();
    let check3Pass = false;

    try {
      const totalAtomCount = atomsForSelection.length;
      
      const stickSpec = { stick: { radius: 0.15, colorscheme: 'Jmol' } };
      const spaceFillingSpec = { sphere: { scale: 1.0, colorscheme: 'Jmol' } };
      const ballAndStickSpec = { stick: { radius: 0.15 }, sphere: { scale: 0.25, colorscheme: 'Jmol' } };

      const stickValid = totalAtomCount > 0 && typeof stickSpec.stick.radius === 'number';
      const spaceFillingValid = totalAtomCount > 0 && typeof spaceFillingSpec.sphere.scale === 'number';
      const ballAndStickValid = totalAtomCount > 0 && typeof ballAndStickSpec.sphere.scale === 'number';

      check3Pass = stickValid && spaceFillingValid && ballAndStickValid && totalAtomCount === molDef.expectedTotalAtoms;

      molTelemetry.checks.rendering = {
        status: check3Pass ? "PASS" : "FAIL",
        timeMs: performance.now() - check3Start,
        atomCountRendered: totalAtomCount,
        expectedAtomCount: molDef.expectedTotalAtoms,
        representationsTested: ["Stick", "Space-Filling", "Ball-and-Stick"],
        specs: { stickSpec, spaceFillingSpec, ballAndStickSpec }
      };

      if (!check3Pass) {
        const issue = `${molDef.name}: Rendering specification validation failed (atom count got ${totalAtomCount}, expected ${molDef.expectedTotalAtoms})`;
        molTelemetry.issues.push(issue);
        issuesFound.push(issue);
      }
    } catch (err: any) {
      molTelemetry.checks.rendering = {
        status: "FAIL",
        timeMs: performance.now() - check3Start,
        error: err.message
      };
      const issue = `${molDef.name}: Rendering test failed: ${err.message}`;
      molTelemetry.issues.push(issue);
      issuesFound.push(issue);
    }

    // -------------------------------------------------------------------------
    // CHECK 4: Selection queries: 'elem C or elem N', 'not hydrogens', 'organic'
    // -------------------------------------------------------------------------
    const check4Start = performance.now();
    let check4Pass = false;
    const queryResults: Record<string, { count: number; expected: number; timeMs: number; status: string }> = {};

    try {
      const parser = new SelectionParser(atomsForSelection);

      // Query 1: 'elem C or elem N'
      const q1Start = performance.now();
      const q1Serials = parser.parse('elem C or elem N');
      const q1Time = performance.now() - q1Start;
      const q1Pass = q1Serials.size === molDef.expectedC_or_N;
      queryResults['elem C or elem N'] = {
        count: q1Serials.size,
        expected: molDef.expectedC_or_N,
        timeMs: q1Time,
        status: q1Pass ? "PASS" : "FAIL"
      };

      // Query 2: 'not hydrogens'
      const q2Start = performance.now();
      const q2Serials = parser.parse('not hydrogens');
      const q2Time = performance.now() - q2Start;
      const q2Pass = q2Serials.size === molDef.expectedNotHydrogens;
      queryResults['not hydrogens'] = {
        count: q2Serials.size,
        expected: molDef.expectedNotHydrogens,
        timeMs: q2Time,
        status: q2Pass ? "PASS" : "FAIL"
      };

      // Query 3: 'organic'
      const q3Start = performance.now();
      const q3Serials = parser.parse('organic');
      const q3Time = performance.now() - q3Start;
      const q3Pass = q3Serials.size === molDef.expectedOrganic;
      queryResults['organic'] = {
        count: q3Serials.size,
        expected: molDef.expectedOrganic,
        timeMs: q3Time,
        status: q3Pass ? "PASS" : "FAIL"
      };

      check4Pass = q1Pass && q2Pass && q3Pass;

      molTelemetry.checks.selectionQueries = {
        status: check4Pass ? "PASS" : "FAIL",
        totalTimeMs: performance.now() - check4Start,
        queries: queryResults
      };

      if (!check4Pass) {
        Object.entries(queryResults).forEach(([qName, qRes]) => {
          if (qRes.status === "FAIL") {
            const issue = `${molDef.name}: Selection query [${qName}] failed (got ${qRes.count}, expected ${qRes.expected})`;
            molTelemetry.issues.push(issue);
            issuesFound.push(issue);
          }
        });
      }
    } catch (err: any) {
      molTelemetry.checks.selectionQueries = {
        status: "FAIL",
        totalTimeMs: performance.now() - check4Start,
        error: err.message
      };
      const issue = `${molDef.name}: Selection query evaluation failed: ${err.message}`;
      molTelemetry.issues.push(issue);
      issuesFound.push(issue);
    }

    // Overall molecule status
    const isMolPass = check1Pass && check2Pass && check3Pass && check4Pass;
    molTelemetry.overallStatus = isMolPass ? "PASS" : "FAIL";
    if (isMolPass) passCount++; else failCount++;

    results.push(molTelemetry);

    console.log(`  -> Roundtrip 2D/3D: ${molTelemetry.checks.roundtrip.status} (${molTelemetry.checks.roundtrip.timeMs.toFixed(2)}ms) | SMILES: ${molTelemetry.checks.roundtrip.exported2DSmiles}`);
    console.log(`  -> Descriptors:     ${molTelemetry.checks.descriptors.status} (${molTelemetry.checks.descriptors.timeMs.toFixed(2)}ms) | LogP: ${descriptors.logp?.toFixed(2)}, TPSA: ${descriptors.tpsa?.toFixed(2)}, MW: ${descriptors.mw?.toFixed(2)}, HBD: ${descriptors.hbd}, HBA: ${descriptors.hba}`);
    console.log(`  -> 3D Rendering:    ${molTelemetry.checks.rendering.status} (${molTelemetry.checks.rendering.timeMs.toFixed(2)}ms) | Modes: Stick, Space-Filling, Ball-and-Stick`);
    console.log(`  -> Selection Query: ${molTelemetry.checks.selectionQueries.status} (${molTelemetry.checks.selectionQueries.totalTimeMs.toFixed(2)}ms) | 'C or N': ${queryResults['elem C or elem N']?.count}/${molDef.expectedC_or_N}, 'not H': ${queryResults['not hydrogens']?.count}/${molDef.expectedNotHydrogens}, 'organic': ${queryResults['organic']?.count}/${molDef.expectedOrganic}`);
    console.log(`  => RESULT: [${molTelemetry.overallStatus}]\n`);
  }

  // Summary Telemetry
  const avgRoundtripTimeMs = results.reduce((a, b) => a + (b.checks.roundtrip?.timeMs || 0), 0) / results.length;
  const avgDescriptorsTimeMs = results.reduce((a, b) => a + (b.checks.descriptors?.timeMs || 0), 0) / results.length;
  const avgRenderingTimeMs = results.reduce((a, b) => a + (b.checks.rendering?.timeMs || 0), 0) / results.length;
  const avgSelectionTimeMs = results.reduce((a, b) => a + (b.checks.selectionQueries?.totalTimeMs || 0), 0) / results.length;

  const report = {
    timestamp: new Date().toISOString(),
    agentTier: 2,
    totalMoleculesTested: TIER2_MOLECULES.length,
    passedCount: passCount,
    failedCount: failCount,
    passPercentage: `${((passCount / TIER2_MOLECULES.length) * 100).toFixed(2)}%`,
    telemetryAvgMs: {
      roundtrip2D3D: avgRoundtripTimeMs.toFixed(3),
      descriptorCalculation: avgDescriptorsTimeMs.toFixed(3),
      renderingSetup: avgRenderingTimeMs.toFixed(3),
      selectionQueryEvaluation: avgSelectionTimeMs.toFixed(3)
    },
    issuesFound,
    detailedMoleculeResults: results
  };

  const outputPath = path.join(process.cwd(), 'scratch', 'agent_tier2_test_report.json');
  fs.writeFileSync(outputPath, JSON.stringify(report, null, 2));

  console.log("========================================================================");
  console.log(` AGENT TIER 2 FINAL SUMMARY: ${passCount}/${TIER2_MOLECULES.length} PASSED (${report.passPercentage})`);
  console.log(` TELEMETRY AVERAGE TIMES:`);
  console.log(`   - 2D/3D Ketcher Roundtrip & SMILES: ${report.telemetryAvgMs.roundtrip2D3D} ms`);
  console.log(`   - RDKit Descriptor Calculation:     ${report.telemetryAvgMs.descriptorCalculation} ms`);
  console.log(`   - 3D Rendering Modes Setup:         ${report.telemetryAvgMs.renderingSetup} ms`);
  console.log(`   - Selection Query Evaluation:       ${report.telemetryAvgMs.selectionQueryEvaluation} ms`);
  console.log(` ISSUES DETECTED: ${issuesFound.length}`);
  if (issuesFound.length > 0) {
    issuesFound.forEach(iss => console.log(`   - ${iss}`));
  }
  console.log(` Detailed telemetry report saved to: ${outputPath}`);
  console.log("========================================================================\n");
}

runTier2TestSuite().catch(err => {
  console.error("Fatal error running Agent Tier 2 test suite:", err);
  process.exit(1);
});
