import { SelectionParser, Atom } from '../src/lib/SelectionParser';

function testCommands() {
  console.log('Testing PyMOL Command Extensions in SelectionParser...');

  const mockAtoms: Atom[] = [
    { serial: 1, name: 'CA', resName: 'ALA', resSeq: 1, chainID: 'A', elem: 'C', x: 0, y: 0, z: 0, bonds: [] },
    { serial: 2, name: 'O', resName: 'HOH', resSeq: 2, chainID: 'A', elem: 'O', x: 2, y: 0, z: 0, bonds: [] },
    { serial: 3, name: 'H1', resName: 'HOH', resSeq: 2, chainID: 'A', elem: 'H', x: 2.5, y: 0.5, z: 0, bonds: [] },
    { serial: 4, name: 'H2', resName: 'HOH', resSeq: 2, chainID: 'A', elem: 'H', x: 2.5, y: -0.5, z: 0, bonds: [] },
    { serial: 5, name: 'H', resName: 'ALA', resSeq: 1, chainID: 'A', elem: 'H', x: 0.5, y: 0.5, z: 0, bonds: [] }
  ];

  const parser = new SelectionParser(mockAtoms);

  // 1. remove solvent
  const res1 = parser.evaluateCommand('remove solvent');
  console.log('1. remove solvent:', res1.textOutput, '-> remove Serials:', Array.from(res1.removeAtomSerials || []));
  if (!res1.removeAtomSerials || !res1.removeAtomSerials.has(2) || !res1.removeAtomSerials.has(3) || !res1.removeAtomSerials.has(4)) {
    throw new Error('remove solvent failed');
  }

  // 2. remove hydro
  const res2 = parser.evaluateCommand('remove hydro');
  console.log('2. remove hydro:', res2.textOutput, '-> remove Serials:', Array.from(res2.removeAtomSerials || []));
  if (!res2.removeAtomSerials || !res2.removeAtomSerials.has(3) || !res2.removeAtomSerials.has(4) || !res2.removeAtomSerials.has(5)) {
    throw new Error('remove hydro failed');
  }

  // 3. show sticks
  const res3 = parser.evaluateCommand('show sticks');
  console.log('3. show sticks:', res3.textOutput, '-> style:', res3.setStyle);
  if (res3.setStyle !== 'Stick') throw new Error('show sticks failed');

  // 4. hide everything
  const res4 = parser.evaluateCommand('hide everything');
  console.log('4. hide everything:', res4.textOutput);
  if (res4.setHiddenCategory !== 'everything') throw new Error('hide everything failed');

  // 5. color red, chain A
  const res5 = parser.evaluateCommand('color red, chain A');
  console.log('5. color red, chain A:', res5.textOutput, '-> color:', res5.setColorScheme);
  if (!res5.setColorScheme) throw new Error('color command failed');

  // 6. zoom
  const res6 = parser.evaluateCommand('zoom');
  console.log('6. zoom:', res6.textOutput, '-> triggerZoom:', res6.triggerZoom);
  if (!res6.triggerZoom) throw new Error('zoom command failed');

  // 7. fetch 1hvr
  const res7 = parser.evaluateCommand('fetch 1hvr');
  console.log('7. fetch 1hvr:', res7.textOutput, '-> fetchPdbId:', res7.fetchPdbId);
  if (res7.fetchPdbId !== '1HVR') throw new Error('fetch command failed');

  console.log('All PyMOL commands PASSED 100%!');
}

testCommands();
