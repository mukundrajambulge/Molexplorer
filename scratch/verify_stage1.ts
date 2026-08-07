import { calculateInteractions } from 'd:/Projects/Molexplorer/src/lib/Interactions';
import { alignStructures } from 'd:/Projects/Molexplorer/src/lib/Alignment';
import { Atom } from 'd:/Projects/Molexplorer/src/lib/MolProcessor';

// We implement formatAtomLine locally to avoid exporting details or typescript issues.
function formatAtomLine(a: Atom): string {
  const record = a.isHetero ? "HETATM" : "ATOM  ";
  const serial = a.serial.toString().padStart(5, ' ');
  const name = a.name.padEnd(4, ' ').substring(0, 4);
  const altLoc = a.altLoc || " ";
  const resName = a.resName.padStart(3, ' ').substring(0, 3);
  const chain = a.chainID || "A";
  const resSeq = a.resSeq.toString().padStart(4, ' ');
  const x = a.x.toFixed(3).padStart(8, ' ');
  const y = a.y.toFixed(3).padStart(8, ' ');
  const z = a.z.toFixed(3).padStart(8, ' ');
  const elem = a.elem.padStart(2, ' ').substring(0, 2);
  const bFactor = a.isModeledH ? " 99.90" : "  0.00";
  return `${record}${serial} ${name}${altLoc}${resName} ${chain}${resSeq}    ${x}${y}${z}  1.00${bFactor}          ${elem}`;
}

function runTests() {
  console.log("=== Molexplorer Stage 1 Verification Script ===\n");
  
  let passes = 0;
  let failures = 0;

  function assert(condition: boolean, message: string) {
    if (condition) {
      console.log(`[PASS] ${message}`);
      passes++;
    } else {
      console.log(`[FAIL] ${message}`);
      failures++;
    }
  }

  // --- Feature 1: Linear H-bond (D-H...A = 180 deg, D...A = 3.0 Å) -> must detect ---
  {
    const receptorAtoms: Atom[] = [
      {
        serial: 1, name: " N  ", resName: "ALA", chainID: "A", resSeq: 1,
        x: 0.0, y: 0.0, z: 0.0, elem: "N", altLoc: " ", isHetero: false, bonds: []
      },
      {
        serial: 2, name: " H  ", resName: "ALA", chainID: "A", resSeq: 1,
        x: 1.0, y: 0.0, z: 0.0, elem: "H", altLoc: " ", isHetero: false, bonds: []
      }
    ];
    const ligandAtoms: Atom[] = [
      {
        serial: 1, name: " O  ", resName: "LIG", chainID: "B", resSeq: 1,
        x: 3.0, y: 0.0, z: 0.0, elem: "O", altLoc: " ", isHetero: true, bonds: []
      }
    ];

    const recPDB = receptorAtoms.map(formatAtomLine).join("\n") + "\n";
    const ligPDB = ligandAtoms.map(formatAtomLine).join("\n") + "\n";

    const interactions = calculateInteractions(recPDB, ligPDB);
    const hbond = interactions.find(i => i.type === 'hbond');
    assert(hbond !== undefined, "Linear H-bond detected successfully");
    if (hbond) {
      assert(Math.abs(hbond.distance - 3.0) < 1e-4, `Linear H-bond distance matches (expected 3.0, got ${hbond.distance.toFixed(2)})`);
    }
  }

  // --- Feature 2: Bent H-bond (D-H...A = 90 deg, D...A = 3.0 Å) -> must NOT detect ---
  {
    const receptorAtoms: Atom[] = [
      {
        serial: 1, name: " N  ", resName: "ALA", chainID: "A", resSeq: 1,
        x: 0.0, y: 0.0, z: 0.0, elem: "N", altLoc: " ", isHetero: false, bonds: []
      },
      {
        serial: 2, name: " H  ", resName: "ALA", chainID: "A", resSeq: 1,
        x: 0.3333, y: 0.9428, z: 0.0, elem: "H", altLoc: " ", isHetero: false, bonds: []
      }
    ];
    const ligandAtoms: Atom[] = [
      {
        serial: 1, name: " O  ", resName: "LIG", chainID: "B", resSeq: 1,
        x: 3.0, y: 0.0, z: 0.0, elem: "O", altLoc: " ", isHetero: true, bonds: []
      }
    ];

    const recPDB = receptorAtoms.map(formatAtomLine).join("\n") + "\n";
    const ligPDB = ligandAtoms.map(formatAtomLine).join("\n") + "\n";

    const interactions = calculateInteractions(recPDB, ligPDB);
    const hbond = interactions.find(i => i.type === 'hbond');
    assert(hbond === undefined, "Bent H-bond (90 deg) not detected (correctly rejected by angle criterion)");
  }

  // --- Feature 3: Salt bridge (LYS NZ to ASP OD1, distance = 3.8 Å) -> must detect ---
  {
    const receptorAtoms: Atom[] = [
      {
        serial: 1, name: " NZ ", resName: "LYS", chainID: "A", resSeq: 1,
        x: 0.0, y: 0.0, z: 0.0, elem: "N", altLoc: " ", isHetero: false, bonds: []
      }
    ];
    const ligandAtoms: Atom[] = [
      {
        serial: 1, name: " OD1", resName: "ASP", chainID: "B", resSeq: 1,
        x: 3.8, y: 0.0, z: 0.0, elem: "O", altLoc: " ", isHetero: false, bonds: []
      }
    ];

    const recPDB = receptorAtoms.map(formatAtomLine).join("\n") + "\n";
    const ligPDB = ligandAtoms.map(formatAtomLine).join("\n") + "\n";

    const interactions = calculateInteractions(recPDB, ligPDB);
    const saltbridge = interactions.find(i => i.type === 'saltbridge');
    assert(saltbridge !== undefined, "Salt bridge detected successfully");
    if (saltbridge) {
      assert(Math.abs(saltbridge.distance - 3.8) < 1e-4, `Salt bridge distance matches (expected 3.8, got ${saltbridge.distance.toFixed(2)})`);
    }
  }

  // --- Feature 4: Pi-pi stacking (two parallel benzene rings, centroid distance = 4.0 Å, normals parallel) -> must detect ---
  {
    const receptorAtoms: Atom[] = [
      { serial: 1, name: " CG ", resName: "PHE", chainID: "A", resSeq: 1, x: 1.4, y: 0.0, z: 0.0, elem: "C", altLoc: " ", isHetero: false, bonds: [] },
      { serial: 2, name: " CD1", resName: "PHE", chainID: "A", resSeq: 1, x: 0.7, y: 1.2124, z: 0.0, elem: "C", altLoc: " ", isHetero: false, bonds: [] },
      { serial: 3, name: " CD2", resName: "PHE", chainID: "A", resSeq: 1, x: -0.7, y: 1.2124, z: 0.0, elem: "C", altLoc: " ", isHetero: false, bonds: [] },
      { serial: 4, name: " CZ ", resName: "PHE", chainID: "A", resSeq: 1, x: -1.4, y: 0.0, z: 0.0, elem: "C", altLoc: " ", isHetero: false, bonds: [] },
      { serial: 5, name: " CE1", resName: "PHE", chainID: "A", resSeq: 1, x: -0.7, y: -1.2124, z: 0.0, elem: "C", altLoc: " ", isHetero: false, bonds: [] },
      { serial: 6, name: " CE2", resName: "PHE", chainID: "A", resSeq: 1, x: 0.7, y: -1.2124, z: 0.0, elem: "C", altLoc: " ", isHetero: false, bonds: [] }
    ];
    const ligandAtoms: Atom[] = [
      { serial: 1, name: " CG ", resName: "PHE", chainID: "B", resSeq: 1, x: 1.4, y: 0.0, z: 4.0, elem: "C", altLoc: " ", isHetero: false, bonds: [] },
      { serial: 2, name: " CD1", resName: "PHE", chainID: "B", resSeq: 1, x: 0.7, y: 1.2124, z: 4.0, elem: "C", altLoc: " ", isHetero: false, bonds: [] },
      { serial: 3, name: " CD2", resName: "PHE", chainID: "B", resSeq: 1, x: -0.7, y: 1.2124, z: 4.0, elem: "C", altLoc: " ", isHetero: false, bonds: [] },
      { serial: 4, name: " CZ ", resName: "PHE", chainID: "B", resSeq: 1, x: -1.4, y: 0.0, z: 4.0, elem: "C", altLoc: " ", isHetero: false, bonds: [] },
      { serial: 5, name: " CE1", resName: "PHE", chainID: "B", resSeq: 1, x: -0.7, y: -1.2124, z: 4.0, elem: "C", altLoc: " ", isHetero: false, bonds: [] },
      { serial: 6, name: " CE2", resName: "PHE", chainID: "B", resSeq: 1, x: 0.7, y: -1.2124, z: 4.0, elem: "C", altLoc: " ", isHetero: false, bonds: [] }
    ];

    const recPDB = receptorAtoms.map(formatAtomLine).join("\n") + "\n";
    const ligPDB = ligandAtoms.map(formatAtomLine).join("\n") + "\n";

    const interactions = calculateInteractions(recPDB, ligPDB);
    const pistacking = interactions.find(i => i.type === 'pistacking');
    assert(pistacking !== undefined, "Pi-pi stacking detected successfully");
    if (pistacking) {
      assert(Math.abs(pistacking.distance - 4.0) < 1e-4, `Pi-pi stacking centroid distance matches (expected 4.0, got ${pistacking.distance.toFixed(2)})`);
    }
  }

  // --- Feature 5: Cation-pi interaction (LYS NZ positioned 4.0 Å directly above a benzene centroid along the normal) -> must detect ---
  {
    const receptorAtoms: Atom[] = [
      { serial: 1, name: " CG ", resName: "PHE", chainID: "A", resSeq: 1, x: 1.4, y: 0.0, z: 0.0, elem: "C", altLoc: " ", isHetero: false, bonds: [] },
      { serial: 2, name: " CD1", resName: "PHE", chainID: "A", resSeq: 1, x: 0.7, y: 1.2124, z: 0.0, elem: "C", altLoc: " ", isHetero: false, bonds: [] },
      { serial: 3, name: " CD2", resName: "PHE", chainID: "A", resSeq: 1, x: -0.7, y: 1.2124, z: 0.0, elem: "C", altLoc: " ", isHetero: false, bonds: [] },
      { serial: 4, name: " CZ ", resName: "PHE", chainID: "A", resSeq: 1, x: -1.4, y: 0.0, z: 0.0, elem: "C", altLoc: " ", isHetero: false, bonds: [] },
      { serial: 5, name: " CE1", resName: "PHE", chainID: "A", resSeq: 1, x: -0.7, y: -1.2124, z: 0.0, elem: "C", altLoc: " ", isHetero: false, bonds: [] },
      { serial: 6, name: " CE2", resName: "PHE", chainID: "A", resSeq: 1, x: 0.7, y: -1.2124, z: 0.0, elem: "C", altLoc: " ", isHetero: false, bonds: [] }
    ];
    const ligandAtoms: Atom[] = [
      {
        serial: 1, name: " NZ ", resName: "LYS", chainID: "B", resSeq: 1,
        x: 0.0, y: 0.0, z: 4.0, elem: "N", altLoc: " ", isHetero: false, bonds: []
      }
    ];

    const recPDB = receptorAtoms.map(formatAtomLine).join("\n") + "\n";
    const ligPDB = ligandAtoms.map(formatAtomLine).join("\n") + "\n";

    const interactions = calculateInteractions(recPDB, ligPDB);
    const cationpi = interactions.find(i => i.type === 'cationpi');
    assert(cationpi !== undefined, "Cation-pi interaction detected successfully");
    if (cationpi) {
      assert(Math.abs(cationpi.distance - 4.0) < 1e-4, `Cation-pi distance matches (expected 4.0, got ${cationpi.distance.toFixed(2)})`);
    }
  }

  // --- Feature 6: Halogen bond (C-Cl...O, Cl...O = 3.2 Å, C-Cl...O angle = 170 deg) -> must detect ---
  {
    const receptorAtoms: Atom[] = [
      {
        serial: 1, name: " O  ", resName: "ALA", chainID: "A", resSeq: 1,
        x: 3.151, y: 0.556, z: 0.0, elem: "O", altLoc: " ", isHetero: false, bonds: []
      }
    ];
    const ligandAtoms: Atom[] = [
      {
        serial: 1, name: " CL ", resName: "LIG", chainID: "B", resSeq: 1,
        x: 0.0, y: 0.0, z: 0.0, elem: "CL", altLoc: " ", isHetero: true, bonds: []
      },
      {
        serial: 2, name: " C  ", resName: "LIG", chainID: "B", resSeq: 1,
        x: -1.7, y: 0.0, z: 0.0, elem: "C", altLoc: " ", isHetero: true, bonds: []
      }
    ];

    const recPDB = receptorAtoms.map(formatAtomLine).join("\n") + "\n";
    const ligPDB = ligandAtoms.map(formatAtomLine).join("\n") + "\n";

    const interactions = calculateInteractions(recPDB, ligPDB);
    const halogen = interactions.find(i => i.type === 'halogen');
    assert(halogen !== undefined, "Halogen bond detected successfully");
    if (halogen) {
      assert(Math.abs(halogen.distance - 3.20) < 0.01, `Halogen bond distance matches (expected 3.2, got ${halogen.distance.toFixed(2)})`);
    }
  }

  // --- Feature 7: Alignment dataset of 10 CA atoms, where 9 match perfectly and 1 is a 10 Å outlier loop ---
  {
    const atomsA: Atom[] = [];
    const atomsB: Atom[] = [];

    for (let i = 0; i < 10; i++) {
      const x = i * 2.0;
      const y = 0.0;
      const z = 0.0;
      
      atomsA.push({
        serial: i + 1, name: " CA ", resName: "ALA", chainID: "A", resSeq: i + 1,
        x, y, z, elem: "C", altLoc: " ", isHetero: false, bonds: []
      });
      
      const offset = (i === 9) ? 10.0 : 0.0;
      atomsB.push({
        serial: i + 1, name: " CA ", resName: "ALA", chainID: "B", resSeq: i + 1,
        x: x, y: y + offset, z, elem: "C", altLoc: " ", isHetero: false, bonds: []
      });
    }

    const alignment = alignStructures(atomsA, atomsB);
    
    assert(alignment.rmsd < 1e-7, `Converged RMSD is near 0 (got ${alignment.rmsd.toExponential(4)})`);
    assert(alignment.atomPairsCount === 9, `Outlier loop pruned successfully (expected 9 paired atoms, got ${alignment.atomPairsCount})`);
  }

  console.log(`\nVerification Finished: ${passes} passed, ${failures} failed.`);
  if (failures > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runTests();
