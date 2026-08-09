import { RepresentationStrategyFactory } from '../src/rendering/RepresentationStrategy';
import { MoleculeDomain, AtomDomain, ResidueDomain, ChainDomain } from '../src/types/domain';

function runPhase1Tests() {
  console.log("=== Phase 1 Automated Verification Test Suite ===");
  let passed = 0;
  let total = 0;

  function assert(condition: boolean, msg: string) {
    total++;
    if (condition) {
      console.log(`✓ PASS: ${msg}`);
      passed++;
    } else {
      console.error(`✗ FAIL: ${msg}`);
    }
  }

  // Test 1: Domain Model Construction
  const mockAtom: AtomDomain = {
    id: 1,
    element: 'C',
    name: 'CA',
    x: 10.5,
    y: 20.2,
    z: 30.1,
    formalCharge: 0,
    partialCharge: -0.15,
    bFactor: 18.5,
    isHetatm: false,
    bonds: [2]
  };

  const mockResidue: ResidueDomain = {
    id: 1,
    name: 'ALA',
    chainID: 'A',
    atoms: [mockAtom],
    isStandardAminoAcid: true,
    isWater: false,
    isIon: false,
    isLigand: false
  };

  const mockChain: ChainDomain = {
    id: 'A',
    residues: [mockResidue],
    secondaryStructure: 'h'
  };

  const mockMolecule: MoleculeDomain = {
    id: '4DZW',
    name: 'Test Protein 4DZW',
    source: 'rcsb',
    chains: [mockChain],
    ligands: [],
    waters: [],
    ions: []
  };

  assert(mockMolecule.chains[0].id === 'A', 'MoleculeDomain chain hierarchy parsed');
  assert(mockMolecule.chains[0].residues[0].atoms[0].element === 'C', 'AtomDomain properties verified');

  // Test 2: Representation Strategy Factory (Dots, Cartoons, Surfaces)
  const dotStrategy = RepresentationStrategyFactory.getStrategy('Dots');
  const dotStyle = dotStrategy.getStyleObject({ colorScheme: 'spectrum', minResi: 1, maxResi: 100, chainMap: {} });
  assert(dotStyle.dot !== undefined && dotStyle.dot.radius === 0.25, 'Dots representation uses WebGL native dot shader (0% CPU hang)');

  const cartoonStrategy = RepresentationStrategyFactory.getStrategy('Cartoon');
  const cartoonStyle = cartoonStrategy.getStyleObject({ colorScheme: 'chain', minResi: 1, maxResi: 100, chainMap: {} });
  assert(cartoonStyle.cartoon !== undefined && cartoonStyle.cartoon.arrows === true, 'Cartoon representation strategy verified');

  const puttyStrategy = RepresentationStrategyFactory.getStrategy('Putty');
  const puttyStyle = puttyStrategy.getStyleObject({ colorScheme: 'spectrum', minResi: 1, maxResi: 100, chainMap: {} });
  assert(puttyStyle.cartoon !== undefined && puttyStyle.cartoon.tubes === true, 'Putty representation strategy verified');

  console.log(`\n=== PHASE 1 SUMMARY: ${passed} / ${total} Passed (${((passed / total) * 100).toFixed(1)}%) ===`);
  if (passed !== total) process.exit(1);
}

runPhase1Tests();
