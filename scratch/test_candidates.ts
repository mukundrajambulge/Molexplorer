import fs from 'fs';
import path from 'path';
import https from 'https';
import { MolProcessor } from '../src/lib/MolProcessor';

(global as any).$3Dmol = { Parsers: { mmtf: () => [] } };

const CANDIDATES = [
  { name: 'Renin', pdbIds: ['1BNE', '1RNE', '2ER0', '1HRN'] },
  { name: 'Cyclooxygenase-2', pdbIds: ['1CX2', '6COX', '3NT1', '1PXX'] },
  { name: 'Lipase', pdbIds: ['1CRL', '1LGY', '1TRH', '1EX9'] },
  { name: 'Amylase', pdbIds: ['1SMD', '1BAG', '1AMY', '1PPI'] },
  { name: 'Catalase', pdbIds: ['1DGF', '7CAT', '4BLC', '1T48'] },
  { name: 'Peroxidase', pdbIds: ['1ARU', '2CYP', '1CCP'] },
  { name: 'Glucose Oxidase', pdbIds: ['1GAL', '3F97', '1GPE'] }
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
  for (const c of CANDIDATES) {
    console.log(`\nTesting candidates for ${c.name}:`);
    for (const id of c.pdbIds) {
      try {
        const content = await fetchPDB(id);
        const proc = new MolProcessor(content, 'pdb');
        console.log(`  - ${id}: ${proc.atoms.length} atoms (Protein: ${proc.atoms.filter(a => !a.isHetero).length})`);
      } catch (err: any) {
        console.log(`  - ${id}: ERROR (${err.message})`);
      }
    }
  }
}

main();
