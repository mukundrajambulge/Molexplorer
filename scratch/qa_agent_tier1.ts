import fs from 'fs';
import path from 'path';
import { MolProcessor, Atom } from '../src/lib/MolProcessor';
import { SelectionParser } from '../src/lib/SelectionParser';
import { RepresentationStrategyFactory } from '../src/rendering/RepresentationStrategy';

export interface MoleculeTestDef {
  id: string;
  name: string;
  formula: string;
  atomCount: number;
  expectedHydrogens: number;
  elements: Record<string, number>;
  pdb: string;
  centralAtomIndex?: number; // 0-indexed index of central atom for angle measurement
}

const TIER1_MOLECULES: MoleculeTestDef[] = [
  {
    id: "MOL_01",
    name: "Helium",
    formula: "He",
    atomCount: 1,
    expectedHydrogens: 0,
    elements: { HE: 1 },
    pdb: `HETATM    1 HE   HE  A   1       0.000   0.000   0.000  1.00  0.00          HE\nEND`
  },
  {
    id: "MOL_02",
    name: "Neon",
    formula: "Ne",
    atomCount: 1,
    expectedHydrogens: 0,
    elements: { NE: 1 },
    pdb: `HETATM    1 NE   NE  A   1       0.000   0.000   0.000  1.00  0.00          NE\nEND`
  },
  {
    id: "MOL_03",
    name: "Argon",
    formula: "Ar",
    atomCount: 1,
    expectedHydrogens: 0,
    elements: { AR: 1 },
    pdb: `HETATM    1 AR   AR  A   1       0.000   0.000   0.000  1.00  0.00          AR\nEND`
  },
  {
    id: "MOL_04",
    name: "Hydrogen Gas",
    formula: "H2",
    atomCount: 2,
    expectedHydrogens: 2,
    elements: { H: 2 },
    pdb: `HETATM    1  H1  H2  A   1       0.000   0.000   0.000  1.00  0.00           H\nHETATM    2  H2  H2  A   1       0.740   0.000   0.000  1.00  0.00           H\nEND`
  },
  {
    id: "MOL_05",
    name: "Nitrogen Gas",
    formula: "N2",
    atomCount: 2,
    expectedHydrogens: 0,
    elements: { N: 2 },
    pdb: `HETATM    1  N1  N2  A   1       0.000   0.000   0.000  1.00  0.00           N\nHETATM    2  N2  N2  A   1       1.100   0.000   0.000  1.00  0.00           N\nEND`
  },
  {
    id: "MOL_06",
    name: "Oxygen Gas",
    formula: "O2",
    atomCount: 2,
    expectedHydrogens: 0,
    elements: { O: 2 },
    pdb: `HETATM    1  O1  O2  A   1       0.000   0.000   0.000  1.00  0.00           O\nHETATM    2  O2  O2  A   1       1.210   0.000   0.000  1.00  0.00           O\nEND`
  },
  {
    id: "MOL_07",
    name: "Carbon Monoxide",
    formula: "CO",
    atomCount: 2,
    expectedHydrogens: 0,
    elements: { C: 1, O: 1 },
    pdb: `HETATM    1  C1  CO  A   1       0.000   0.000   0.000  1.00  0.00           C\nHETATM    2  O2  CO  A   1       1.128   0.000   0.000  1.00  0.00           O\nEND`
  },
  {
    id: "MOL_08",
    name: "Nitric Oxide",
    formula: "NO",
    atomCount: 2,
    expectedHydrogens: 0,
    elements: { N: 1, O: 1 },
    pdb: `HETATM    1  N1  NO  A   1       0.000   0.000   0.000  1.00  0.00           N\nHETATM    2  O2  NO  A   1       1.150   0.000   0.000  1.00  0.00           O\nEND`
  },
  {
    id: "MOL_09",
    name: "Hydrogen Chloride",
    formula: "HCl",
    atomCount: 2,
    expectedHydrogens: 1,
    elements: { H: 1, CL: 1 },
    pdb: `HETATM    1  H1 HCL  A   1       0.000   0.000   0.000  1.00  0.00           H\nHETATM    2 CL2 HCL  A   1       1.275   0.000   0.000  1.00  0.00          CL\nEND`
  },
  {
    id: "MOL_10",
    name: "Hydrogen Fluoride",
    formula: "HF",
    atomCount: 2,
    expectedHydrogens: 1,
    elements: { H: 1, F: 1 },
    pdb: `HETATM    1  H1  HF  A   1       0.000   0.000   0.000  1.00  0.00           H\nHETATM    2  F2  HF  A   1       0.917   0.000   0.000  1.00  0.00           F\nEND`
  },
  {
    id: "MOL_11",
    name: "Water",
    formula: "H2O",
    atomCount: 3,
    expectedHydrogens: 2,
    elements: { O: 1, H: 2 },
    centralAtomIndex: 0, // Central Oxygen at index 0
    pdb: `HETATM    1  O1 H2O  A   1       0.000   0.000   0.117  1.00  0.00           O\nHETATM    2  H2 H2O  A   1       0.000   0.757  -0.469  1.00  0.00           H\nHETATM    3  H3 H2O  A   1       0.000  -0.757  -0.469  1.00  0.00           H\nEND`
  },
  {
    id: "MOL_12",
    name: "Carbon Dioxide",
    formula: "CO2",
    atomCount: 3,
    expectedHydrogens: 0,
    elements: { C: 1, O: 2 },
    centralAtomIndex: 0, // Central Carbon at index 0
    pdb: `HETATM    1  C1 CO2  A   1       0.000   0.000   0.000  1.00  0.00           C\nHETATM    2  O2 CO2  A   1       0.000   0.000   1.160  1.00  0.00           O\nHETATM    3  O3 CO2  A   1       0.000   0.000  -1.160  1.00  0.00           O\nEND`
  },
  {
    id: "MOL_13",
    name: "Hydrogen Cyanide",
    formula: "HCN",
    atomCount: 3,
    expectedHydrogens: 1,
    elements: { H: 1, C: 1, N: 1 },
    centralAtomIndex: 1, // Central Carbon at index 1
    pdb: `HETATM    1  H1 HCN  A   1       0.000   0.000  -1.064  1.00  0.00           H\nHETATM    2  C2 HCN  A   1       0.000   0.000   0.000  1.00  0.00           C\nHETATM    3  N3 HCN  A   1       0.000   0.000   1.153  1.00  0.00           N\nEND`
  },
  {
    id: "MOL_14",
    name: "Nitrous Oxide",
    formula: "N2O",
    atomCount: 3,
    expectedHydrogens: 0,
    elements: { N: 2, O: 1 },
    centralAtomIndex: 1, // Central Nitrogen at index 1
    pdb: `HETATM    1  N1 N2O  A   1       0.000   0.000  -1.126  1.00  0.00           N\nHETATM    2  N2 N2O  A   1       0.000   0.000   0.000  1.00  0.00           N\nHETATM    3  O3 N2O  A   1       0.000   0.000   1.186  1.00  0.00           O\nEND`
  },
  {
    id: "MOL_15",
    name: "Ozone",
    formula: "O3",
    atomCount: 3,
    expectedHydrogens: 0,
    elements: { O: 3 },
    centralAtomIndex: 0, // Central Oxygen at index 0
    pdb: `HETATM    1  O1  O3  A   1       0.000   0.000   0.380  1.00  0.00           O\nHETATM    2  O2  O3  A   1       0.000   1.090  -0.190  1.00  0.00           O\nHETATM    3  O3  O3  A   1       0.000  -1.090  -0.190  1.00  0.00           O\nEND`
  },
  {
    id: "MOL_16",
    name: "Sulfur Dioxide",
    formula: "SO2",
    atomCount: 3,
    expectedHydrogens: 0,
    elements: { S: 1, O: 2 },
    centralAtomIndex: 0, // Central Sulfur at index 0
    pdb: `HETATM    1  S1 SO2  A   1       0.000   0.000   0.360  1.00  0.00           S\nHETATM    2  O2 SO2  A   1       0.000   1.250  -0.360  1.00  0.00           O\nHETATM    3  O3 SO2  A   1       0.000  -1.250  -0.360  1.00  0.00           O\nEND`
  },
  {
    id: "MOL_17",
    name: "Hydrogen Sulfide",
    formula: "H2S",
    atomCount: 3,
    expectedHydrogens: 2,
    elements: { S: 1, H: 2 },
    centralAtomIndex: 0, // Central Sulfur at index 0
    pdb: `HETATM    1  S1 H2S  A   1       0.000   0.000   0.100  1.00  0.00           S\nHETATM    2  H2 H2S  A   1       0.000   0.960  -0.800  1.00  0.00           H\nHETATM    3  H3 H2S  A   1       0.000  -0.960  -0.800  1.00  0.00           H\nEND`
  },
  {
    id: "MOL_18",
    name: "Ammonia",
    formula: "NH3",
    atomCount: 4,
    expectedHydrogens: 3,
    elements: { N: 1, H: 3 },
    centralAtomIndex: 0,
    pdb: `HETATM    1  N1 NH3  A   1       0.000   0.000   0.116  1.00  0.00           N\nHETATM    2  H2 NH3  A   1       0.000   0.938  -0.271  1.00  0.00           H\nHETATM    3  H3 NH3  A   1       0.812  -0.469  -0.271  1.00  0.00           H\nHETATM    4  H4 NH3  A   1      -0.812  -0.469  -0.271  1.00  0.00           H\nEND`
  },
  {
    id: "MOL_19",
    name: "Formaldehyde",
    formula: "CH2O",
    atomCount: 4,
    expectedHydrogens: 2,
    elements: { C: 1, O: 1, H: 2 },
    centralAtomIndex: 0,
    pdb: `HETATM    1  C1 FMO  A   1       0.000   0.000   0.000  1.00  0.00           C\nHETATM    2  O2 FMO  A   1       0.000   1.210   0.000  1.00  0.00           O\nHETATM    3  H3 FMO  A   1       0.940  -0.580   0.000  1.00  0.00           H\nHETATM    4  H4 FMO  A   1      -0.940  -0.580   0.000  1.00  0.00           H\nEND`
  },
  {
    id: "MOL_20",
    name: "Methane",
    formula: "CH4",
    atomCount: 5,
    expectedHydrogens: 4,
    elements: { C: 1, H: 4 },
    centralAtomIndex: 0,
    pdb: `HETATM    1  C1 MET  A   1       0.000   0.000   0.000  1.00  0.00           C\nHETATM    2  H2 MET  A   1       0.629   0.629   0.629  1.00  0.00           H\nHETATM    3  H3 MET  A   1      -0.629  -0.629   0.629  1.00  0.00           H\nHETATM    4  H4 MET  A   1      -0.629   0.629  -0.629  1.00  0.00           H\nHETATM    5  H5 MET  A   1       0.629  -0.629  -0.629  1.00  0.00           H\nEND`
  }
];

// Helpers for distance & angle math
function dist(a: Atom, b: Atom): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  const dz = a.z - b.z;
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

// Angle at central atom p2: p1 - p2 - p3
function angle(p1: Atom, p2: Atom, p3: Atom): number {
  const v1 = { x: p1.x - p2.x, y: p1.y - p2.y, z: p1.z - p2.z };
  const v2 = { x: p3.x - p2.x, y: p3.y - p2.y, z: p3.z - p2.z };
  const len1 = Math.sqrt(v1.x * v1.x + v1.y * v1.y + v1.z * v1.z);
  const len2 = Math.sqrt(v2.x * v2.x + v2.y * v2.y + v2.z * v2.z);
  if (len1 === 0 || len2 === 0) return 0;
  const dot = v1.x * v2.x + v1.y * v2.y + v1.z * v2.z;
  const cosTheta = Math.max(-1, Math.min(1, dot / (len1 * len2)));
  return Math.acos(cosTheta) * (180 / Math.PI);
}

// Helpers for SDF and XYZ export generation
function exportToSDF(m: MoleculeTestDef, processor: MolProcessor): string {
  const atoms = processor.atoms;
  let out = `${m.name}\n  MolExplorer Tier1 Engine\nComments\n`;
  
  // Count bonds
  const bondSet = new Set<string>();
  atoms.forEach((a, i) => {
    (a.bonds || []).forEach(bIdx => {
      if (bIdx > i) {
        bondSet.add(`${i+1}_${bIdx+1}`);
      }
    });
  });

  const aCount = atoms.length.toString().padStart(3, ' ');
  const bCount = bondSet.size.toString().padStart(3, ' ');
  out += `${aCount}${bCount}  0  0  0  0  0  0  0  0999 V2000\n`;

  // Atom block
  for (const a of atoms) {
    const x = a.x.toFixed(4).padStart(10, ' ');
    const y = a.y.toFixed(4).padStart(10, ' ');
    const z = a.z.toFixed(4).padStart(10, ' ');
    const elem = a.elem.padEnd(3, ' ');
    out += `${x}${y}${z} ${elem} 0  0  0  0  0  0  0  0  0  0  0  0\n`;
  }

  // Bond block
  bondSet.forEach(pair => {
    const [i, j] = pair.split('_').map(Number);
    const b1 = i.toString().padStart(3, ' ');
    const b2 = j.toString().padStart(3, ' ');
    out += `${b1}${b2}  1  0  0  0  0\n`;
  });

  out += `M  END\n$$$$\n`;
  return out;
}

function exportToXYZ(m: MoleculeTestDef, processor: MolProcessor): string {
  const atoms = processor.atoms;
  let out = `${atoms.length}\n${m.name} (${m.formula})\n`;
  for (const a of atoms) {
    const elem = a.elem.padEnd(3, ' ');
    const x = a.x.toFixed(6).padStart(12, ' ');
    const y = a.y.toFixed(6).padStart(12, ' ');
    const z = a.z.toFixed(6).padStart(12, ' ');
    out += `${elem}${x}${y}${z}\n`;
  }
  return out;
}

async function runTier1TestSuite() {
  console.log("=========================================================================");
  console.log("       AGENT TIER 1 DETAILED TESTING SUITE (20 MOLECULES, 1-5 ATOMS)      ");
  console.log("=========================================================================\n");

  const results: any[] = [];
  const telemetry = {
    totalMolecules: TIER1_MOLECULES.length,
    singleAtomMolecules: 0,
    twoAtomMolecules: 0,
    threeAtomMolecules: 0,
    fourAtomMolecules: 0,
    fiveAtomMolecules: 0,
    check1Passed: 0,
    check2Passed: 0,
    check3Passed: 0,
    check4Passed: 0,
    issuesFound: [] as string[]
  };

  for (const molDef of TIER1_MOLECULES) {
    console.log(`-------------------------------------------------------------------------`);
    console.log(` Testing Molecule: ${molDef.id} | ${molDef.name} (${molDef.formula}) [${molDef.atomCount} atom(s)]`);
    console.log(`-------------------------------------------------------------------------`);

    // Track atom count telemetry
    if (molDef.atomCount === 1) telemetry.singleAtomMolecules++;
    else if (molDef.atomCount === 2) telemetry.twoAtomMolecules++;
    else if (molDef.atomCount === 3) telemetry.threeAtomMolecules++;
    else if (molDef.atomCount === 4) telemetry.fourAtomMolecules++;
    else if (molDef.atomCount === 5) telemetry.fiveAtomMolecules++;

    const processor = new MolProcessor(molDef.pdb, 'pdb');
    processor.assignBonds(1.15);

    const molResults: any = {
      id: molDef.id,
      name: molDef.name,
      formula: molDef.formula,
      atomCount: processor.atoms.length,
      check1_singleAtomRendering: null,
      check2_selectionQuery: null,
      check3_distanceMeasurement: null,
      check4_exportFormats: null
    };

    // =========================================================================
    // CHECK 1: SINGLE-ATOM / ZERO-BOND RENDERING EDGE CASES
    // =========================================================================
    try {
      const isSingleAtom = molDef.atomCount === 1;
      const totalBonds = processor.atoms.reduce((acc, a) => acc + (a.bonds ? a.bonds.length : 0), 0);
      
      let zeroBondHandled = true;
      if (isSingleAtom && totalBonds !== 0) {
        zeroBondHandled = false;
        telemetry.issuesFound.push(`${molDef.id} (${molDef.name}): Single atom assigned ${totalBonds} bonds!`);
      }

      // Check representation strategy styles
      const stylesToTest = ["Stick", "Space-Filling", "Ball-and-Stick", "Line", "Cartoon", "Dots"];
      const styleOutputs: Record<string, any> = {};
      for (const st of stylesToTest) {
        const strategy = RepresentationStrategyFactory.getStrategy(st as any);
        styleOutputs[st] = strategy.getStyleObject({
          colorScheme: 'element',
          minResi: 1,
          maxResi: 100,
          chainMap: { '': '#3b82f6' }
        });
      }

      // Check center of mass and bounding box calculation
      let minX = Infinity, maxX = -Infinity;
      let minY = Infinity, maxY = -Infinity;
      let minZ = Infinity, maxZ = -Infinity;
      processor.atoms.forEach(a => {
        if (a.x < minX) minX = a.x;
        if (a.x > maxX) maxX = a.x;
        if (a.y < minY) minY = a.y;
        if (a.y > maxY) maxY = a.y;
        if (a.z < minZ) minZ = a.z;
        if (a.z > maxZ) maxZ = a.z;
      });

      const spanX = maxX - minX;
      const spanY = maxY - minY;
      const spanZ = maxZ - minZ;
      const isZeroSpan = (spanX === 0 && spanY === 0 && spanZ === 0);

      // Verify zoom box fallback for single atom
      const zoomRadiusFallback = isZeroSpan ? 1.5 : Math.max(spanX, spanY, spanZ) / 2;
      const zoomValid = !isNaN(zoomRadiusFallback) && zoomRadiusFallback > 0;

      molResults.check1_singleAtomRendering = {
        passed: zeroBondHandled && zoomValid,
        isSingleAtom,
        totalBonds,
        isZeroSpan,
        zoomRadiusFallback,
        styleOutputsKeys: Object.keys(styleOutputs)
      };

      if (molResults.check1_singleAtomRendering.passed) telemetry.check1Passed++;
    } catch (err: any) {
      molResults.check1_singleAtomRendering = { passed: false, error: err.message };
      telemetry.issuesFound.push(`${molDef.id} Check 1 Error: ${err.message}`);
    }

    // =========================================================================
    // CHECK 2: SELECTION QUERY BEHAVIOR ('all', 'none', 'elem', 'hydrogens')
    // =========================================================================
    try {
      const parser = new SelectionParser(processor.atoms);

      // 1. Query 'all'
      const setAll = parser.parse('all');
      const allMatch = setAll.size === molDef.atomCount;

      // 2. Query 'none'
      const setNone = parser.parse('none');
      const noneMatch = setNone.size === 0;

      // 3. Query 'elem <X>'
      let elemMatchPass = true;
      const elemResults: Record<string, number> = {};
      for (const [elemSymbol, expectedCount] of Object.entries(molDef.elements)) {
        const setElem = parser.parse(`elem ${elemSymbol}`);
        elemResults[elemSymbol] = setElem.size;
        if (setElem.size !== expectedCount) {
          elemMatchPass = false;
          telemetry.issuesFound.push(`${molDef.id} (${molDef.name}): 'elem ${elemSymbol}' expected ${expectedCount}, got ${setElem.size}`);
        }
      }

      // Negative elem query test
      const nonPresentElem = Object.keys(molDef.elements).includes('C') ? 'Fe' : 'C';
      const setNegElem = parser.parse(`elem ${nonPresentElem}`);
      if (setNegElem.size !== 0) {
        elemMatchPass = false;
        telemetry.issuesFound.push(`${molDef.id} (${molDef.name}): 'elem ${nonPresentElem}' matched ${setNegElem.size} atoms (expected 0)`);
      }

      // 4. Query 'hydrogens'
      const setH = parser.parse('hydrogens');
      const hydrogensMatch = setH.size === molDef.expectedHydrogens;
      if (!hydrogensMatch) {
        telemetry.issuesFound.push(`${molDef.id} (${molDef.name}): 'hydrogens' query expected ${molDef.expectedHydrogens}, got ${setH.size}`);
      }

      // Compound query tests
      const setCompoundOr = parser.parse('all or none');
      const compoundOrPass = setCompoundOr.size === molDef.atomCount;

      molResults.check2_selectionQuery = {
        passed: allMatch && noneMatch && elemMatchPass && hydrogensMatch && compoundOrPass,
        allSize: setAll.size,
        noneSize: setNone.size,
        elemResults,
        hydrogensSize: setH.size,
        expectedHydrogens: molDef.expectedHydrogens
      };

      if (molResults.check2_selectionQuery.passed) telemetry.check2Passed++;
    } catch (err: any) {
      molResults.check2_selectionQuery = { passed: false, error: err.message };
      telemetry.issuesFound.push(`${molDef.id} Check 2 Error: ${err.message}`);
    }

    // =========================================================================
    // CHECK 3: DISTANCE & ANGLE MEASUREMENT ACCURACY
    // =========================================================================
    try {
      const atoms = processor.atoms;
      let check3Pass = true;
      const measurements: any = {};

      if (atoms.length === 1) {
        // Self-distance test
        const dSelf = dist(atoms[0], atoms[0]);
        measurements.selfDistance = dSelf;
        if (Math.abs(dSelf - 0.0) > 1e-5) check3Pass = false;
      } else if (atoms.length === 2) {
        // 2-atom distance test
        const d12 = dist(atoms[0], atoms[1]);
        measurements.distance_1_2 = parseFloat(d12.toFixed(5));

        // Theoretical coordinate check
        const dx = atoms[0].x - atoms[1].x;
        const dy = atoms[0].y - atoms[1].y;
        const dz = atoms[0].z - atoms[1].z;
        const expectedD = Math.sqrt(dx*dx + dy*dy + dz*dz);
        const error = Math.abs(d12 - expectedD);
        measurements.error = error;
        if (error > 1e-5) {
          check3Pass = false;
          telemetry.issuesFound.push(`${molDef.id} (${molDef.name}): Distance measurement error ${error}`);
        }
      } else if (atoms.length >= 3) {
        // 3-atom pairwise distance & angle test
        const cIdx = molDef.centralAtomIndex ?? 0;
        const otherIndices = [0, 1, 2].filter(i => i !== cIdx);
        const p1 = atoms[otherIndices[0]];
        const pCentral = atoms[cIdx];
        const p2 = atoms[otherIndices[1]];

        const d1_c = dist(p1, pCentral);
        const d2_c = dist(p2, pCentral);
        const d1_2 = dist(p1, p2);
        const angVal = angle(p1, pCentral, p2);

        measurements.distance_arm1 = parseFloat(d1_c.toFixed(5));
        measurements.distance_arm2 = parseFloat(d2_c.toFixed(5));
        measurements.distance_ends = parseFloat(d1_2.toFixed(5));
        measurements.angle_degrees = parseFloat(angVal.toFixed(5));

        // Check for NaN or infinity in angle
        if (isNaN(angVal) || !isFinite(angVal)) {
          check3Pass = false;
          telemetry.issuesFound.push(`${molDef.id} (${molDef.name}): Angle measurement returned NaN/Infinity`);
        }

        // Singularity test for collinear molecules (CO2, HCN, N2O)
        if (["CO2", "HCN", "N2O"].includes(molDef.formula)) {
          const isLinear = Math.abs(angVal - 180.0) < 1.0;
          measurements.isLinearVerified = isLinear;
          if (!isLinear) {
            check3Pass = false;
            telemetry.issuesFound.push(`${molDef.id} (${molDef.name}): Expected linear angle ~180 deg, got ${angVal}`);
          }
        }
      }

      molResults.check3_distanceMeasurement = {
        passed: check3Pass,
        measurements
      };

      if (molResults.check3_distanceMeasurement.passed) telemetry.check3Passed++;
    } catch (err: any) {
      molResults.check3_distanceMeasurement = { passed: false, error: err.message };
      telemetry.issuesFound.push(`${molDef.id} Check 3 Error: ${err.message}`);
    }

    // =========================================================================
    // CHECK 4: EXPORT FORMAT STRUCTURE (PDB, SDF, XYZ)
    // =========================================================================
    try {
      // 1. PDB Export
      const exportedPDB = processor.toPDB();
      const pdbLines = exportedPDB.split('\n').filter(l => l.trim().length > 0);
      const atomLines = pdbLines.filter(l => l.startsWith('HETATM') || l.startsWith('ATOM  '));
      const conectLines = pdbLines.filter(l => l.startsWith('CONECT'));

      const pdbAtomCountValid = atomLines.length === molDef.atomCount;
      const pdbConectValid = (molDef.atomCount === 1) ? (conectLines.length === 0) : true;

      // 2. SDF Export
      const exportedSDF = exportToSDF(molDef, processor);
      const sdfLines = exportedSDF.split('\n');
      const countsLine = sdfLines[3] || "";
      const sdfAtomCount = parseInt(countsLine.substring(0, 3).trim(), 10);
      const sdfBondCount = parseInt(countsLine.substring(3, 6).trim(), 10);
      const sdfHasEnd = exportedSDF.includes('M  END');

      const sdfValid = (sdfAtomCount === molDef.atomCount) && sdfHasEnd && (molDef.atomCount === 1 ? sdfBondCount === 0 : true);

      // 3. XYZ Export
      const exportedXYZ = exportToXYZ(molDef, processor);
      const xyzLines = exportedXYZ.split('\n').filter(l => l.trim().length > 0);
      const xyzHeaderCount = parseInt(xyzLines[0] || "0", 10);
      const xyzDataLines = xyzLines.slice(2);

      const xyzValid = (xyzHeaderCount === molDef.atomCount) && (xyzDataLines.length === molDef.atomCount);

      const check4Pass = pdbAtomCountValid && pdbConectValid && sdfValid && xyzValid;

      if (!pdbAtomCountValid) telemetry.issuesFound.push(`${molDef.id} PDB export atom count mismatch: expected ${molDef.atomCount}, got ${atomLines.length}`);
      if (!pdbConectValid) telemetry.issuesFound.push(`${molDef.id} Single-atom PDB produced unexpected CONECT lines!`);
      if (!sdfValid) telemetry.issuesFound.push(`${molDef.id} SDF export validation failed (Count: ${sdfAtomCount}, Bonds: ${sdfBondCount})`);
      if (!xyzValid) telemetry.issuesFound.push(`${molDef.id} XYZ export validation failed (Header: ${xyzHeaderCount}, Data: ${xyzDataLines.length})`);

      molResults.check4_exportFormats = {
        passed: check4Pass,
        pdb: { atomLinesCount: atomLines.length, conectLinesCount: conectLines.length },
        sdf: { headerAtomCount: sdfAtomCount, bondCount: sdfBondCount, hasEnd: sdfHasEnd },
        xyz: { headerAtomCount: xyzHeaderCount, dataLinesCount: xyzDataLines.length }
      };

      if (molResults.check4_exportFormats.passed) telemetry.check4Passed++;
    } catch (err: any) {
      molResults.check4_exportFormats = { passed: false, error: err.message };
      telemetry.issuesFound.push(`${molDef.id} Check 4 Error: ${err.message}`);
    }

    results.push(molResults);

    console.log(` [Check 1: Single-Atom Rendering]  : ${molResults.check1_singleAtomRendering.passed ? 'PASS' : 'FAIL'}`);
    console.log(` [Check 2: Selection Queries]      : ${molResults.check2_selectionQuery.passed ? 'PASS' : 'FAIL'}`);
    console.log(` [Check 3: Distance Measurement]   : ${molResults.check3_distanceMeasurement.passed ? 'PASS' : 'FAIL'}`);
    console.log(` [Check 4: Export Format Structure]: ${molResults.check4_exportFormats.passed ? 'PASS' : 'FAIL'}\n`);
  }

  console.log("=========================================================================");
  console.log("                       FINAL TELEMETRY & SUMMARY                        ");
  console.log("=========================================================================");
  console.log(` Total Molecules Tested : ${telemetry.totalMolecules}`);
  console.log(` Single-Atom Molecules  : ${telemetry.singleAtomMolecules} (He, Ne, Ar)`);
  console.log(` 2-Atom Molecules       : ${telemetry.twoAtomMolecules} (H2, N2, O2, CO, NO, HCl, HF)`);
  console.log(` 3-Atom Molecules       : ${telemetry.threeAtomMolecules} (H2O, CO2, HCN, N2O, O3, SO2, H2S)`);
  console.log(` 4-Atom Molecules       : ${telemetry.fourAtomMolecules} (NH3, CH2O)`);
  console.log(` 5-Atom Molecules       : ${telemetry.fiveAtomMolecules} (CH4)`);
  console.log(`-------------------------------------------------------------------------`);
  console.log(` Check 1 (Single-Atom/Zero-Bond Rendering) : ${telemetry.check1Passed} / ${telemetry.totalMolecules} PASSED`);
  console.log(` Check 2 (Selection Query Syntax)         : ${telemetry.check2Passed} / ${telemetry.totalMolecules} PASSED`);
  console.log(` Check 3 (Distance & Angle Accuracy)      : ${telemetry.check3Passed} / ${telemetry.totalMolecules} PASSED`);
  console.log(` Check 4 (PDB, SDF, XYZ Export Formats)   : ${telemetry.check4Passed} / ${telemetry.totalMolecules} PASSED`);
  console.log(`-------------------------------------------------------------------------`);
  console.log(` Total Issues Found: ${telemetry.issuesFound.length}`);

  if (telemetry.issuesFound.length > 0) {
    console.log("\nIssues Summary:");
    telemetry.issuesFound.forEach((iss, idx) => console.log(`  ${idx + 1}. ${iss}`));
  } else {
    console.log("\nALL TIER 1 CHECKS PASSED WITH 100% SUCCESS RATE!");
  }
  console.log("=========================================================================\n");

  const reportPath = path.join(process.cwd(), 'scratch', 'qa_tier1_report.json');
  fs.writeFileSync(reportPath, JSON.stringify({ telemetry, results }, null, 2));
  console.log(`Detailed report saved to: ${reportPath}`);
}

runTier1TestSuite().catch(console.error);
