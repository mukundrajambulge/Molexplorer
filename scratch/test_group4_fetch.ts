import fs from 'fs';
import path from 'path';
import https from 'https';
import { MolProcessor } from '../src/lib/MolProcessor';

(global as any).$3Dmol = { Parsers: { mmtf: () => [] } };

const TARGETS = [
  { name: 'Hemoglobin', pdbId: '4HHB' },
  { name: 'HIV-1 Protease', pdbId: '1HVR' },
  { name: 'Trypsin', pdbId: '1TPO' },
  { name: 'Protein Kinase A', pdbId: '1ATP' },
  { name: 'Thrombin', pdbId: '1PPB' },
  { name: 'Elastase', pdbId: '3EST' },
  { name: 'Chymotrypsin', pdbId: '4CHA' },
  { name: 'Subtilisin', pdbId: '1SBT' },
  { name: 'Papain', pdbId: '9PAP' },
  { name: 'Thermolysin', pdbId: '8TLN' },
  { name: 'Carboxypeptidase A', pdbId: '3CPA' },
  { name: 'Pepsin', pdbId: '5PEP' },
  { name: 'Renin', pdbId: '2RNE' },
  { name: 'Acetylcholinesterase', pdbId: '1EVE' },
  { name: 'Cyclooxygenase-2', pdbId: '1CVU' },
  { name: 'Lipase', pdbId: '1CRL' },
  { name: 'Amylase', pdbId: '1SMD' },
  { name: 'Catalase', pdbId: '1DGF' },
  { name: 'Peroxidase', pdbId: '1ARU' },
  { name: 'Glucose Oxidase', pdbId: '1GAL' }
];

async function fetchPDB(pdbId: string): Promise<string> {
  const filePath = path.resolve(process.cwd(), 'scratch', `${pdbId.toUpperCase()}.pdb`);
  if (fs.existsSync(filePath)) {
    return fs.readFileSync(filePath, 'utf8');
  }

  const url = `https://files.rcsb.org/download/${pdbId.toUpperCase()}.pdb`;
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      if (res.statusCode !== 200) {
        reject(new Error(`Failed ${pdbId}: HTTP ${res.statusCode}`));
        return;
      }
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        fs.writeFileSync(filePath, data, 'utf8');
        resolve(data);
      });
    }).on('error', reject);
  });
}

async function main() {
  console.log("Checking PDB downloads and atom counts for Group 4 proteins...");
  for (const t of TARGETS) {
    try {
      const content = await fetchPDB(t.pdbId);
      const proc = new MolProcessor(content, 'pdb');
      console.log(`[OK] ${t.name.padEnd(22)} (${t.pdbId}): ${proc.atoms.length.toString().padStart(5)} atoms | Protein: ${proc.atoms.filter(a => !a.isHetero).length} | Hetero: ${proc.atoms.filter(a => a.isHetero).length}`);
    } catch (err: any) {
      console.error(`[FAIL] ${t.name} (${t.pdbId}): ${err.message}`);
    }
  }
}

main();
