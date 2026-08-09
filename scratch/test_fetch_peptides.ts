import fs from 'fs';
import path from 'path';

const PEPTIDES = [
  { name: 'Crambin (1CRN)', pdbId: '1CRN' },
  { name: 'TRP-Cage (1L2Y)', pdbId: '1L2Y' },
  { name: 'Met-Enkephalin', pdbId: '1PLW' },
  { name: 'Oxytocin', pdbId: '1NPO' },
  { name: 'Vasopressin', pdbId: '1YF1' },
  { name: 'Endothelin', pdbId: '1EDN' },
  { name: 'Somatostatin', pdbId: '1SOM' },
  { name: 'Glucagon', pdbId: '1GCN' },
  { name: 'Insulin A chain', pdbId: '1TRZ', chain: 'A' },
  { name: 'Angiotensin', pdbId: '1N9U' },
  { name: 'Bradykinin', pdbId: '1BK1' },
  { name: 'Substance P', pdbId: '1P1B' },
  { name: 'Neuropeptide Y', pdbId: '1RON' },
  { name: 'Neurotensin', pdbId: '1L1V' },
  { name: 'Bombesin', pdbId: '1BOM' },
  { name: 'Calcitonin', pdbId: '2GLH' },
  { name: 'Secretin', pdbId: '2FAMP' },
  { name: 'Motilin', pdbId: '1LVM' },
  { name: 'Gastrin', pdbId: '1GNT' },
  { name: 'Secretin fragment', pdbId: '1G8M' }
];

async function main() {
  const dir = path.resolve(process.cwd(), 'scratch/peptides');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  for (const pep of PEPTIDES) {
    const filePath = path.join(dir, `${pep.pdbId}.pdb`);
    if (fs.existsSync(filePath)) {
      console.log(`[EXISTS] ${pep.name} (${pep.pdbId})`);
      continue;
    }
    const url = `https://files.rcsb.org/download/${pep.pdbId}.pdb`;
    try {
      const res = await fetch(url);
      if (res.ok) {
        const text = await res.text();
        fs.writeFileSync(filePath, text, 'utf-8');
        console.log(`[DOWNLOADED] ${pep.name} (${pep.pdbId}) - ${text.length} bytes`);
      } else {
        console.error(`[FAILED ${res.status}] ${pep.name} (${pep.pdbId})`);
      }
    } catch (e: any) {
      console.error(`[ERROR] ${pep.name} (${pep.pdbId}): ${e.message}`);
    }
  }
}

main();
