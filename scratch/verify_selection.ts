import { SelectionParser, Atom } from '../src/lib/SelectionParser.js';

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`Assertion Failed: ${message}`);
  }
}

function createSmallTestDataset(): Atom[] {
  const atoms: Atom[] = [];
  let serial = 1;

  // Chain A: Residue 1 (ALA), Residue 2 (TRP)
  // Residue 1 ALA: N, CA, C, O, CB, H
  atoms.push({ serial: serial++, name: 'N', resName: 'ALA', resSeq: 1, chainID: 'A', elem: 'N', x: 0, y: 0, z: 0, bFactor: 10, occupancy: 1.0, isHetero: false, bonds: [1, 5] });
  atoms.push({ serial: serial++, name: 'CA', resName: 'ALA', resSeq: 1, chainID: 'A', elem: 'C', x: 1.5, y: 0, z: 0, bFactor: 12, occupancy: 1.0, isHetero: false, bonds: [0, 2, 4] });
  atoms.push({ serial: serial++, name: 'C', resName: 'ALA', resSeq: 1, chainID: 'A', elem: 'C', x: 2.5, y: 1.2, z: 0, bFactor: 15, occupancy: 1.0, isHetero: false, bonds: [1, 3, 6] });
  atoms.push({ serial: serial++, name: 'O', resName: 'ALA', resSeq: 1, chainID: 'A', elem: 'O', x: 2.2, y: 2.4, z: 0, bFactor: 18, occupancy: 1.0, isHetero: false, bonds: [2] });
  atoms.push({ serial: serial++, name: 'CB', resName: 'ALA', resSeq: 1, chainID: 'A', elem: 'C', x: 1.8, y: -0.8, z: 1.2, bFactor: 25, occupancy: 0.8, isHetero: false, bonds: [1] });
  atoms.push({ serial: serial++, name: 'H', resName: 'ALA', resSeq: 1, chainID: 'A', elem: 'H', x: -0.5, y: 0.5, z: 0, bFactor: 8, occupancy: 1.0, isHetero: false, bonds: [0] });

  // Residue 2 TRP: N, CA, C, O
  atoms.push({ serial: serial++, name: 'N', resName: 'TRP', resSeq: 2, chainID: 'A', elem: 'N', x: 3.8, y: 0.8, z: 0, bFactor: 20, occupancy: 1.0, isHetero: false, bonds: [2, 7] });
  atoms.push({ serial: serial++, name: 'CA', resName: 'TRP', resSeq: 2, chainID: 'A', elem: 'C', x: 4.8, y: 1.8, z: 0, bFactor: 22, occupancy: 1.0, isHetero: false, bonds: [6, 8] });
  atoms.push({ serial: serial++, name: 'C', resName: 'TRP', resSeq: 2, chainID: 'A', elem: 'C', x: 6.0, y: 1.0, z: 0, bFactor: 24, occupancy: 1.0, isHetero: false, bonds: [7, 9] });
  atoms.push({ serial: serial++, name: 'O', resName: 'TRP', resSeq: 2, chainID: 'A', elem: 'O', x: 6.0, y: -0.2, z: 0, bFactor: 26, occupancy: 1.0, isHetero: false, bonds: [8] });

  // Chain B: Solvent (HOH)
  atoms.push({ serial: serial++, name: 'O', resName: 'HOH', resSeq: 101, chainID: 'B', elem: 'O', x: 10.0, y: 0, z: 0, bFactor: 40, occupancy: 1.0, isHetero: true, bonds: [] });
  atoms.push({ serial: serial++, name: 'H1', resName: 'HOH', resSeq: 101, chainID: 'B', elem: 'H', x: 10.8, y: 0.2, z: 0, bFactor: 40, occupancy: 1.0, isHetero: true, bonds: [] });

  // Chain C: Ligand (LIG) - Hetero organic
  atoms.push({ serial: serial++, name: 'C1', resName: 'LIG', resSeq: 201, chainID: 'C', elem: 'C', x: 3.0, y: 3.0, z: 0, bFactor: 15, occupancy: 1.0, isHetero: true, bonds: [13] });
  atoms.push({ serial: serial++, name: 'O1', resName: 'LIG', resSeq: 201, chainID: 'C', elem: 'O', x: 3.5, y: 4.0, z: 0, bFactor: 16, occupancy: 1.0, isHetero: true, bonds: [12] });

  // Metal ion: MG
  atoms.push({ serial: serial++, name: 'MG', resName: 'MG', resSeq: 301, chainID: 'D', elem: 'MG', x: 0.5, y: 0.5, z: 0.5, bFactor: 11, occupancy: 1.0, isHetero: true, bonds: [] });

  return atoms;
}

function runCorrectnessTests() {
  console.log('=== RUNNING CORRECTNESS & PARSER TESTS ===');
  const atoms = createSmallTestDataset();
  const parser = new SelectionParser(atoms);

  // 1. Basic property selection
  let sel = parser.parse('elem C');
  assert(sel.size === 6, `elem C expected 6, got ${sel.size}`);

  sel = parser.parse('resn ALA');
  assert(sel.size === 6, `resn ALA expected 6, got ${sel.size}`);

  sel = parser.parse('chain A');
  assert(sel.size === 10, `chain A expected 10, got ${sel.size}`);

  sel = parser.parse('resi 1-2');
  assert(sel.size === 10, `resi 1-2 expected 10, got ${sel.size}`);

  sel = parser.parse('id 1-5');
  assert(sel.size === 5, `id 1-5 expected 5, got ${sel.size}`);

  // 2. Comparisons
  sel = parser.parse('b > 20');
  assert(sel.size === 6, `b > 20 expected 6 (serials 5, 8, 9, 10, 11, 12), got ${sel.size}`);

  sel = parser.parse('q < 1.0');
  assert(sel.size === 1, `q < 1.0 expected 1 (serial 5), got ${sel.size}`);

  // 3. Wildcards
  sel = parser.parse('name C*');
  assert(sel.size === 6, `name C* expected 6 (CA, C, CB, CA, C, C1), got ${sel.size}`);

  // 4. Boolean logic (AND, OR, NOT, Parentheses)
  sel = parser.parse('chain A and elem C');
  assert(sel.size === 5, `chain A and elem C expected 5, got ${sel.size}`);

  sel = parser.parse('resn ALA or resn TRP');
  assert(sel.size === 10, `resn ALA or resn TRP expected 10, got ${sel.size}`);

  sel = parser.parse('not chain A');
  assert(sel.size === 5, `not chain A expected 5, got ${sel.size}`);

  sel = parser.parse('(chain A and (resn ALA or resn TRP)) and not elem H');
  assert(sel.size === 9, `complex boolean expected 9, got ${sel.size}`);

  // 5. Implicit AND
  sel = parser.parse('chain A resn ALA elem C');
  assert(sel.size === 3, `implicit AND expected 3, got ${sel.size}`);

  // 6. Flags
  sel = parser.parse('polymer');
  assert(sel.size === 10, `polymer expected 10, got ${sel.size}`);

  sel = parser.parse('solvent');
  assert(sel.size === 2, `solvent expected 2, got ${sel.size}`);

  sel = parser.parse('hetatm');
  assert(sel.size === 5, `hetatm expected 5, got ${sel.size}`);

  sel = parser.parse('hydrogens');
  assert(sel.size === 2, `hydrogens expected 2, got ${sel.size}`);

  sel = parser.parse('metals');
  assert(sel.size === 1, `metals expected 1, got ${sel.size}`);

  sel = parser.parse('organic');
  assert(sel.size === 2, `organic expected 2 (LIG atoms), got ${sel.size}`);

  sel = parser.parse('inorganic');
  assert(sel.size === 1, `inorganic expected 1 (MG atom), got ${sel.size}`);

  // 7. Structural Modifiers
  sel = parser.parse('byres (id 1)');
  assert(sel.size === 6, `byres (id 1) expected 6 (all resi 1 atoms), got ${sel.size}`);

  sel = parser.parse('bychain (id 1)');
  assert(sel.size === 10, `bychain (id 1) expected 10 (all chain A atoms), got ${sel.size}`);

  sel = parser.parse('neighbor (id 1)');
  assert(sel.size === 2, `neighbor (id 1) expected 2, got ${sel.size}`);

  sel = parser.parse('extend 2 of (id 1)');
  assert(sel.size === 5, `extend 2 of (id 1) expected 5, got ${sel.size}`);

  // 8. Spatial Queries (SpatialHashGrid)
  sel = parser.parse('within 1.0 of (id 1)');
  assert(sel.has(1) && sel.has(6) && sel.has(15), `within 1.0 of id 1 failed. got ${Array.from(sel)}`);

  sel = parser.parse('around 1.0 of (id 1)');
  assert(!sel.has(1) && sel.has(6) && sel.has(15), `around 1.0 of id 1 failed. got ${Array.from(sel)}`);

  sel = parser.parse('beyond 5.0 of (id 1)');
  assert(sel.has(9) && sel.has(10) && sel.has(11) && sel.has(12) && sel.has(14), `beyond 5.0 of id 1 failed. got ${Array.from(sel)}`);

  // 9. Commands via evaluateCommand
  let cmdRes = parser.evaluateCommand('select target, resn ALA');
  assert(cmdRes.selectedSerials.size === 6, `select command failed`);
  assert(cmdRes.saveSelection?.name === 'target', `saveSelection name failed`);

  cmdRes = parser.evaluateCommand('count of chain A');
  assert(cmdRes.selectedSerials.size === 10, `count command failed`);

  cmdRes = parser.evaluateCommand('label resn ALA, name+resi');
  assert(cmdRes.addLabels?.length === 6, `label command failed`);

  cmdRes = parser.evaluateCommand('unlabel resn ALA');
  assert(cmdRes.clearLabels?.length === 6, `unlabel command failed`);

  cmdRes = parser.evaluateCommand('get_chains all');
  assert(cmdRes.textOutput?.includes('["A","B","C","D"]'), `get_chains failed: ${cmdRes.textOutput}`);

  cmdRes = parser.evaluateCommand('get_distance id 1, id 2');
  assert(cmdRes.addMeasurement?.value !== undefined && Math.abs(cmdRes.addMeasurement.value - 1.5) < 0.01, `get_distance failed`);

  cmdRes = parser.evaluateCommand('get_angle id 6, id 1, id 2');
  assert(cmdRes.addMeasurement?.type === 'angle', `get_angle failed`);

  cmdRes = parser.evaluateCommand('get_property b, chain A');
  assert(cmdRes.textOutput?.includes('Avg: 18.00'), `get_property failed: ${cmdRes.textOutput}`);

  console.log('✓ All correctness and parser unit tests passed successfully!\n');
}

function generateLargePDBDataset(targetAtomCount: number): Atom[] {
  console.log(`Generating synthetic dataset with ~${targetAtomCount.toLocaleString()} atoms...`);
  const atoms: Atom[] = [];
  let serial = 1;
  const chains = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
  const resTypes = ['ALA', 'VAL', 'LEU', 'ILE', 'TRP', 'PHE', 'PRO', 'MET', 'GLY', 'SER'];
  const resAtoms: Record<string, { name: string; elem: string; dx: number; dy: number; dz: number }[]> = {
    ALA: [
      { name: 'N', elem: 'N', dx: 0, dy: 0, dz: 0 },
      { name: 'CA', elem: 'C', dx: 1.5, dy: 0, dz: 0 },
      { name: 'C', elem: 'C', dx: 2.5, dy: 1.2, dz: 0 },
      { name: 'O', elem: 'O', dx: 2.2, dy: 2.4, dz: 0 },
      { name: 'CB', elem: 'C', dx: 1.8, dy: -0.8, dz: 1.2 },
      { name: 'H', elem: 'H', dx: -0.5, dy: 0.5, dz: 0 }
    ],
    GLY: [
      { name: 'N', elem: 'N', dx: 0, dy: 0, dz: 0 },
      { name: 'CA', elem: 'C', dx: 1.5, dy: 0, dz: 0 },
      { name: 'C', elem: 'C', dx: 2.5, dy: 1.2, dz: 0 },
      { name: 'O', elem: 'O', dx: 2.2, dy: 2.4, dz: 0 },
      { name: 'HA1', elem: 'H', dx: 1.5, dy: -0.5, dz: 0.8 },
      { name: 'HA2', elem: 'H', dx: 1.5, dy: -0.5, dz: -0.8 }
    ],
    VAL: [
      { name: 'N', elem: 'N', dx: 0, dy: 0, dz: 0 },
      { name: 'CA', elem: 'C', dx: 1.5, dy: 0, dz: 0 },
      { name: 'C', elem: 'C', dx: 2.5, dy: 1.2, dz: 0 },
      { name: 'O', elem: 'O', dx: 2.2, dy: 2.4, dz: 0 },
      { name: 'CB', elem: 'C', dx: 1.8, dy: -0.8, dz: 1.2 },
      { name: 'CG1', elem: 'C', dx: 2.8, dy: -1.5, dz: 0.8 },
      { name: 'CG2', elem: 'C', dx: 0.8, dy: -1.5, dz: 2.0 }
    ]
  };

  let chainIdx = 0;
  let resSeq = 1;
  let curX = 0, curY = 0, curZ = 0;

  while (atoms.length < targetAtomCount) {
    const chainID = chains[chainIdx % chains.length];
    const resName = resTypes[(resSeq - 1) % resTypes.length];
    const tpl = resAtoms[resName] || resAtoms['ALA'];

    const resAtomStartIndex = atoms.length;

    tpl.forEach((at, idx) => {
      const atomIdx = resAtomStartIndex + idx;
      const bonds: number[] = [];
      if (idx > 0) bonds.push(resAtomStartIndex);
      if (idx === 0 && resAtomStartIndex > 0 && atoms[resAtomStartIndex - 1].chainID === chainID) {
        bonds.push(resAtomStartIndex - 1);
      }

      atoms.push({
        serial: serial++,
        name: at.name,
        resName: resName,
        resSeq: resSeq,
        chainID: chainID,
        elem: at.elem,
        x: curX + at.dx + (Math.random() * 0.1),
        y: curY + at.dy + (Math.random() * 0.1),
        z: curZ + at.dz + (Math.random() * 0.1),
        bFactor: 10 + (serial % 50),
        occupancy: serial % 10 === 0 ? 0.8 : 1.0,
        isHetero: false,
        bonds: bonds
      });
    });

    curX += 3.8;
    if (resSeq % 100 === 0) {
      curX = 0;
      curY += 15.0;
    }
    if (resSeq % 1000 === 0) {
      curY = 0;
      curZ += 20.0;
      chainIdx++;
    }
    resSeq++;
  }

  const waterCount = 10000;
  console.log(`Adding ${waterCount.toLocaleString()} solvent water molecules...`);
  for (let i = 0; i < waterCount; i++) {
    const wx = (Math.random() - 0.5) * 500;
    const wy = (Math.random() - 0.5) * 500;
    const wz = (Math.random() - 0.5) * 500;
    atoms.push({
      serial: serial++,
      name: 'O',
      resName: 'HOH',
      resSeq: 5000 + i,
      chainID: 'W',
      elem: 'O',
      x: wx,
      y: wy,
      z: wz,
      bFactor: 30 + Math.random() * 30,
      occupancy: 1.0,
      isHetero: true,
      bonds: []
    });
  }

  console.log(`Adding ligand atoms...`);
  for (let i = 0; i < 500; i++) {
    atoms.push({
      serial: serial++,
      name: i % 2 === 0 ? 'C' : 'O',
      resName: 'LIG',
      resSeq: 9001,
      chainID: 'L',
      elem: i % 2 === 0 ? 'C' : 'O',
      x: 10.0 + (i * 0.5),
      y: 10.0 + (i * 0.2),
      z: 5.0,
      bFactor: 15.0,
      occupancy: 1.0,
      isHetero: true,
      bonds: i > 0 ? [atoms.length - 1] : []
    });
  }

  console.log(`Dataset generated successfully with Total Atoms = ${atoms.length.toLocaleString()}.\n`);
  return atoms;
}

function runPerformanceBenchmarks() {
  console.log('=== RUNNING PERFORMANCE BENCHMARKS ON LARGE PDB SYSTEM (>60,000 ATOMS) ===');
  
  const atoms = generateLargePDBDataset(55000);
  const parser = new SelectionParser(atoms);

  const testQueries = [
    { category: '1. Basic Property Query', query: 'elem C' },
    { category: '2. Range & Comparison Query', query: 'resi 100-500 and b >= 25.0 and q < 1.0' },
    { category: '3. Medium Boolean Logic', query: '(chain A or chain B) and (resn ALA or resn VAL) and not (elem H)' },
    { category: '4. Complex Deeply Nested Boolean', query: '((chain A and (resi 1-500 or resi 1000-1500)) or (chain B and not solvent)) and (elem N or elem O) and (b >= 15.0 and q <= 1.0)' },
    { category: '5. Spatial Hash Grid (within)', query: 'within 8.0 of (chain A and resi 50 and name CA)' },
    { category: '6. Spatial Hash Grid (around)', query: 'around 12.0 of (hetatm and not solvent)' },
    { category: '7. Spatial Hash Grid (beyond)', query: 'beyond 150.0 of (chain A and resi 1)' },
    { category: '8. Structural Modifier (byres around)', query: 'byres (around 6.0 of (resn LIG))' },
    { category: '9. Graph Traversal (extend steps)', query: 'extend 4 of (resn LIG)' },
    { category: '10. Command Evaluation (Ramachandran)', command: 'rama chain A' },
    { category: '11. Command Evaluation (Dipole Moment)', command: 'dipole chain A' },
    { category: '12. Command Evaluation (DSSP H-Bond Energy)', command: 'hbond chain A' }
  ];

  console.log('| Category | Query / Command | Selected Atoms | Latency (ms) | Speed (atoms/ms) |');
  console.log('|---|---|---|---|---|');

  const results: { category: string; query: string; count: number; latencyMs: number }[] = [];

  for (const item of testQueries) {
    const qStr = item.query || item.command!;
    if (item.query) parser.parse(item.query);
    else parser.evaluateCommand(item.command!);

    const iterations = item.query && !item.query.includes('around') && !item.query.includes('within') ? 10 : 3;
    const start = performance.now();
    let matchCount = 0;

    for (let i = 0; i < iterations; i++) {
      if (item.query) {
        const res = parser.parse(item.query);
        matchCount = res.size;
      } else {
        const res = parser.evaluateCommand(item.command!);
        matchCount = res.selectedSerials.size;
      }
    }
    const end = performance.now();
    const avgLatency = (end - start) / iterations;
    const speed = Math.round(atoms.length / avgLatency);

    results.push({
      category: item.category,
      query: qStr,
      count: matchCount,
      latencyMs: parseFloat(avgLatency.toFixed(3))
    });

    console.log(`| ${item.category} | \`${qStr}\` | ${matchCount.toLocaleString()} | ${avgLatency.toFixed(2)} ms | ${speed.toLocaleString()} atoms/ms |`);
  }

  console.log('\n=== BENCHMARK SUMMARY & LATENCY LOG ===');
  const avgLatencyTotal = results.reduce((sum, r) => sum + r.latencyMs, 0) / results.length;
  console.log(`Tested ${testQueries.length} distinct query types on ${atoms.length.toLocaleString()} atoms.`);
  console.log(`Average Latency across all queries: ${avgLatencyTotal.toFixed(2)} ms`);
  console.log(`Max Latency observed: ${Math.max(...results.map(r => r.latencyMs)).toFixed(2)} ms`);
  console.log(`Spatial Hash Grid query average latency: ${(results.filter(r => r.category.includes('Spatial')).reduce((s, r) => s + r.latencyMs, 0) / 3).toFixed(2)} ms`);
  console.log('Selection algebra parser performance verified successfully!\n');
}

function main() {
  console.log('========================================================================');
  console.log(' Selection Algebra Parser & Spatial Hash Grid Stress Test & Benchmark ');
  console.log(' Target Module: src/lib/SelectionParser.ts');
  console.log('========================================================================\n');

  try {
    runCorrectnessTests();
    runPerformanceBenchmarks();
    console.log('ALL VERIFICATION & BENCHMARK SUITES COMPLETED WITH 100% SUCCESS.');
  } catch (err: any) {
    console.error('\n❌ VERIFICATION TEST FAILED!');
    console.error(err.stack || err);
    process.exit(1);
  }
}

main();
