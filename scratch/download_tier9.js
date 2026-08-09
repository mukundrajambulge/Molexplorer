import fs from 'fs';
import path from 'path';

// Table of 20 Tier 9 molecules with specific chain filters or PDB IDs to ensure atom counts are strictly 1,001 - 3,500 atoms
const TIER9_DEFINITIONS = [
  { name: "HIV-1 Protease 1HVR", pdbId: "1HVR", filterChains: ["A", "B"] },
  { name: "Hemoglobin Dimer 1HCO", pdbId: "1HCO", filterChains: ["A", "B"] },
  { name: "Alcohol Dehydrogenase 1HLD", pdbId: "1HLD", filterChains: ["A"] },
  { name: "Kinase Domain 1ATP", pdbId: "1ATP", filterChains: ["E", "I"] },
  { name: "DNA Polymerase domain 1TAQ", pdbId: "1TAQ", maxAtoms: 3200 },
  { name: "CRISPR-Cas9 REC fragment 4UN3", pdbId: "4UN3", filterChains: ["A"], maxAtoms: 3400 },
  { name: "RNA Polymerase subunit 1NIK", pdbId: "1NIK", filterChains: ["A"], maxAtoms: 3200 },
  { name: "BSA 3V03", pdbId: "3V03", filterChains: ["A"], maxAtoms: 3300 },
  { name: "Actin 1ATN", pdbId: "1ATN", filterChains: ["A"] },
  { name: "Tubulin 1TUB", pdbId: "1TUB", filterChains: ["A"] },
  { name: "Fab Heavy Chain 1F8A", pdbId: "1F8A", filterChains: ["B", "C"] },
  { name: "MHC Class I 1HAK", pdbId: "1HAK", filterChains: ["A"] },
  { name: "TCR 1TCR", pdbId: "1TCR", filterChains: ["A", "B"] },
  { name: "GPCR Rhodopsin 1F88", pdbId: "1F88", filterChains: ["A"] },
  { name: "LDH 1LDM", pdbId: "1LDM", filterChains: ["A"] },
  { name: "Hexokinase 1DGK", pdbId: "1DGK", filterChains: ["N"], maxAtoms: 3400 },
  { name: "Catalase monomer 1DGF", pdbId: "1DGF", filterChains: ["A"], maxAtoms: 3450 },
  { name: "Luciferase 2D1S", pdbId: "2D1S", filterChains: ["A"], maxAtoms: 3400 },
  { name: "Amylase 1SMD", pdbId: "1SMD", filterChains: ["A"], maxAtoms: 3480 },
  { name: "Outer Membrane Porin 2POR", pdbId: "2POR", filterChains: ["A"] }
];

const outDir = path.join(process.cwd(), 'scratch', 'tier9_pdbs');
if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

async function prepareTier9Files() {
  console.log("Preparing Tier 9 (1,001 - 3,500 atoms) PDB structures...");
  const summary = [];

  for (const mol of TIER9_DEFINITIONS) {
    const rawPath = path.join(outDir, `raw_${mol.pdbId}.pdb`);
    const targetPath = path.join(outDir, `${mol.pdbId}.pdb`);

    let rawContent = "";
    if (fs.existsSync(rawPath)) {
      rawContent = fs.readFileSync(rawPath, 'utf8');
    } else if (fs.existsSync(targetPath)) {
      rawContent = fs.readFileSync(targetPath, 'utf8');
    } else {
      console.log(`Fetching ${mol.pdbId} from RCSB...`);
      const res = await fetch(`https://files.rcsb.org/download/${mol.pdbId}.pdb`);
      if (!res.ok) {
        console.error(`Failed to fetch ${mol.pdbId}`);
        continue;
      }
      rawContent = await res.text();
      fs.writeFileSync(rawPath, rawContent, 'utf8');
    }

    // Process & Filter
    const lines = rawContent.split('\n');
    const headerLines = [];
    const atomLines = [];
    const chainsFound = new Set();
    let currentAtomCount = 0;

    for (const line of lines) {
      if (line.startsWith('HEADER') || line.startsWith('TITLE') || line.startsWith('COMPND') || line.startsWith('HELIX') || line.startsWith('SHEET')) {
        headerLines.push(line);
      } else if (line.startsWith('ATOM  ') || line.startsWith('HETATM')) {
        const chainId = line.length >= 22 ? line[21].trim() : '';
        if (mol.filterChains && mol.filterChains.length > 0 && !mol.filterChains.includes(chainId)) {
          continue;
        }
        if (mol.maxAtoms && currentAtomCount >= mol.maxAtoms) {
          continue;
        }
        atomLines.push(line);
        currentAtomCount++;
        if (chainId) chainsFound.add(chainId);
      }
    }

    const finalContent = [...headerLines, ...atomLines, 'END'].join('\n');
    fs.writeFileSync(targetPath, finalContent, 'utf8');

    summary.push({
      name: mol.name,
      pdbId: mol.pdbId,
      atomCount: currentAtomCount,
      chains: Array.from(chainsFound).sort(),
      inRange: currentAtomCount >= 1001 && currentAtomCount <= 3500
    });
  }

  console.log("\n=== TIER 9 PROCESSED STRUCTURES (1,001 - 3,500 ATOMS) ===");
  console.table(summary);
  fs.writeFileSync(path.join(outDir, 'summary.json'), JSON.stringify(summary, null, 2));
}

prepareTier9Files().catch(err => console.error(err));
