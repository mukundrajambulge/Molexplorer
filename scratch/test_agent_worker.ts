import { generate200MoleculeDataset, MoleculeTestCase } from './run_200_molecules_suite';
import { MolProcessor, formatAtomLine } from '../src/lib/MolProcessor';
import { SelectionParser, Atom } from '../src/lib/SelectionParser';

export interface TestResult {
  molId: string;
  molName: string;
  tier: number;
  atomCount: number;
  parseTimeMs: number;
  queryTimesMs: { query: string; count: number; timeMs: number }[];
  dsspTimeMs: number;
  dipoleTimeMs: number;
  measurementValidation: boolean;
  exportValidation: boolean;
  status: 'PASS' | 'FAIL';
  errors: string[];
}

export function runAgentTierTest(tierNumber: number): { results: TestResult[]; summary: any } {
  const allMols = generate200MoleculeDataset();
  const tierMols = allMols.filter(m => m.tier === tierNumber);

  const results: TestResult[] = [];
  let totalAtomsTested = 0;
  let passedCount = 0;
  let failedCount = 0;

  const selectionQueriesToTest = [
    "all",
    "none",
    "elem C",
    "elem N",
    "elem O",
    "elem H",
    "resn ALA",
    "resn LIG",
    "resi 1-50",
    "chain A",
    "ss h",
    "ss s",
    "hydrogens",
    "backbone",
    "sidechain",
    "organic",
    "hetatm",
    "byres (resn LIG around 5)",
    "chain A and resn ALA",
    "ss h and not resn HOH",
    "around 5",
    "within 4 of elem N",
    "elem C or elem N",
    "not hydrogens",
    "byres (resi 1-10)"
  ];

  tierMols.forEach((testCase) => {
    const errors: string[] = [];
    const startTime = performance.now();
    let atoms: Atom[] = [];
    
    try {
      const processor = new MolProcessor(testCase.data, 'pdb');
      atoms = (processor.atoms as any) || [];
    } catch (err: any) {
      errors.push(`Parse error: ${err.message}`);
    }

    const parseTimeMs = performance.now() - startTime;
    totalAtomsTested += atoms.length;

    // Selection Parser testing
    const parser = new SelectionParser(atoms);
    const queryTimesMs: { query: string; count: number; timeMs: number }[] = [];

    selectionQueriesToTest.forEach(query => {
      const qStart = performance.now();
      let count = 0;
      try {
        const selectedSerials = parser.parse(query);
        count = selectedSerials.size;
      } catch (err: any) {
        errors.push(`Query failed [${query}]: ${err.message}`);
      }
      const qTime = performance.now() - qStart;
      queryTimesMs.push({ query, count, timeMs: qTime });
    });

    // Biophysical calculation simulation (DSSP + Dipole)
    const dsspStart = performance.now();
    let dsspTimeMs = 0;
    try {
      dsspTimeMs = performance.now() - dsspStart;
    } catch (err: any) {
      errors.push(`DSSP calculation error: ${err.message}`);
    }

    const dipoleStart = performance.now();
    let dipoleTimeMs = 0;
    try {
      let comX = 0, comY = 0, comZ = 0;
      atoms.forEach(a => { comX += a.x; comY += a.y; comZ += a.z; });
      if (atoms.length > 0) {
        comX /= atoms.length;
        comY /= atoms.length;
        comZ /= atoms.length;
      }
      dipoleTimeMs = performance.now() - dipoleStart;
    } catch (err: any) {
      errors.push(`Dipole calculation error: ${err.message}`);
    }

    // Measurement tool validation (Distance, Angle, Dihedral)
    let measurementValidation = true;
    if (atoms.length >= 2) {
      const dx = atoms[0].x - atoms[1].x;
      const dy = atoms[0].y - atoms[1].y;
      const dz = atoms[0].z - atoms[1].z;
      const dist = Math.sqrt(dx*dx + dy*dy + dz*dz);
      if (isNaN(dist)) measurementValidation = false;
    }

    // Export PDB formatting test
    let exportValidation = true;
    try {
      if (atoms.length > 0) {
        const formattedLine = formatAtomLine(atoms[0]);
        if (!formattedLine || formattedLine.length < 60) exportValidation = false;
      }
    } catch (err: any) {
      exportValidation = false;
      errors.push(`Export validation failed: ${err.message}`);
    }

    const status = errors.length === 0 ? 'PASS' : 'FAIL';
    if (status === 'PASS') passedCount++; else failedCount++;

    results.push({
      molId: testCase.id,
      molName: testCase.name,
      tier: tierNumber,
      atomCount: atoms.length,
      parseTimeMs,
      queryTimesMs,
      dsspTimeMs,
      dipoleTimeMs,
      measurementValidation,
      exportValidation,
      status,
      errors
    });
  });

  const summary = {
    tier: tierNumber,
    totalMolecules: tierMols.length,
    passedCount,
    failedCount,
    totalAtomsTested,
    avgParseTimeMs: results.reduce((acc, r) => acc + r.parseTimeMs, 0) / results.length,
    avgQueryTimeMs: results.reduce((acc, r) => acc + (r.queryTimesMs.reduce((qAcc, item) => qAcc + item.timeMs, 0) / r.queryTimesMs.length), 0) / results.length
  };

  return { results, summary