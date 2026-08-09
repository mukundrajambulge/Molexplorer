import fs from 'fs';
import path from 'path';
import https from 'https';
import { MolProcessor } from '../src/lib/MolProcessor';

(global as any).$3Dmol = { Parsers: { mmtf: () => [] } };

const CANDIDATES = [
  { name: 'Cyclooxygenase-2', pdbIds: ['1CVU', '6COX', '1CX2', '4COX', '1PXX', '1DIY', '3HS5'] },
  { name: 'Catalase', pdbIds: ['7CAT', '4BLC', '1T48', '1QQW', '1A4E', '1F4J'] }
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
        const chainA = proc.atoms.filter(a => a.chainID === 'A');
        console.log(`  - ${id}: Total ${proc.atoms.length} atoms | Chain A: ${chainA.length} atoms`);
      } catch (err: any) {
        console.log(`  - ${id}: ERROR (${err.message})`);
      }
    }
  }
}

main();
