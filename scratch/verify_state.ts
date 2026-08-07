import { useStore, Measurement } from '../src/store/index';

// Simple helper to format bytes nicely
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(Math.abs(bytes)) / Math.log(k));
  return (bytes / Math.pow(k, i)).toFixed(2) + ' ' + sizes[i];
}

// Undo/Redo Temporal Stack for testing memory overhead under high frequency changes
class TemporalStack<T> {
  private past: T[] = [];
  private present: T;
  private future: T[] = [];
  private maxCapacity: number;

  constructor(initialState: T, maxCapacity: number = Infinity) {
    this.present = initialState;
    this.maxCapacity = maxCapacity;
  }

  public record(state: T) {
    this.past.push(this.present);
    if (this.past.length > this.maxCapacity) {
      this.past.shift();
    }
    this.present = state;
    this.future = [];
  }

  public undo(): T | null {
    if (this.past.length === 0) return null;
    const previous = this.past.pop()!;
    this.future.push(this.present);
    this.present = previous;
    return this.present;
  }

  public redo(): T | null {
    if (this.future.length === 0) return null;
    const next = this.future.pop()!;
    this.past.push(this.present);
    this.present = next;
    return this.present;
  }

  public clear() {
    this.past = [];
    this.future = [];
  }

  public get size(): { past: number; future: number; total: number } {
    return {
      past: this.past.length,
      future: this.future.length,
      total: this.past.length + this.future.length,
    };
  }
}

async function runStateVerification() {
  console.log('====================================================');
  console.log(' ZUSTAND GLOBAL STATE QA & MEMORY STRESS VERIFIER ');
  console.log('====================================================\n');

  let passedTests = 0;
  let totalTests = 0;

  function assert(condition: boolean, description: string) {
    totalTests++;
    if (condition) {
      passedTests++;
      console.log(`  [PASS] ${description}`);
    } else {
      console.error(`  [FAIL] ${description}`);
    }
  }

  // --- SECTION 1: STATE IMMUTABILITY TEST ---
  console.log('--- SECTION 1: State Immutability Verification ---');
  
  const initialState = useStore.getState();
  
  // Test 1.1: State reference updates on mutation
  useStore.getState().setRenderStyle('Sphere');
  const stateAfterRenderStyle = useStore.getState();
  assert(
    initialState !== stateAfterRenderStyle,
    'Root store reference updates upon setter call'
  );
  assert(
    stateAfterRenderStyle.renderStyle === 'Sphere',
    'Value correctly updated in store state (renderStyle = Sphere)'
  );

  // Test 1.2: Shallow preservation of untouched slices
  useStore.getState().setColorScheme('chain');
  const stateAfterColorScheme = useStore.getState();
  assert(
    stateAfterColorScheme.atoms === stateAfterRenderStyle.atoms,
    'Untouched array slice (atoms) retains exact referential equality'
  );
  assert(
    stateAfterColorScheme.measurements === stateAfterRenderStyle.measurements,
    'Untouched array slice (measurements) retains exact referential equality'
  );
  assert(
    stateAfterColorScheme.selectedAtomSerials === stateAfterRenderStyle.selectedAtomSerials,
    'Untouched Set slice (selectedAtomSerials) retains exact referential equality'
  );

  // Test 1.3: Set update immutability
  const testSerials = new Set([101, 102, 103]);
  useStore.getState().setSelectedAtomSerials(testSerials);
  const stateAfterSerials = useStore.getState();
  assert(
    stateAfterSerials.selectedAtomSerials !== stateAfterColorScheme.selectedAtomSerials,
    'Set reference updates when setSelectedAtomSerials is invoked'
  );
  assert(
    stateAfterSerials.selectedAtomSerials.size === 3 && stateAfterSerials.selectedAtomSerials.has(102),
    'Set contents correctly updated'
  );


  // --- SECTION 2: MUTATION ISOLATION TEST ---
  console.log('\n--- SECTION 2: Mutation Isolation Verification ---');

  // Record baseline references for all slices
  const preIsolationState = useStore.getState();
  const preMoleculeSlice = {
    molData: preIsolationState.molData,
    processedPDB: preIsolationState.processedPDB,
    atoms: preIsolationState.atoms,
    ssData: preIsolationState.ssData,
  };
  const preMeasurementSlice = preIsolationState.measurements;
  const preBiophysicalSlice = {
    showDipoleArrow: preIsolationState.showDipoleArrow,
    ramachandranData: preIsolationState.ramachandranData,
    dipoleMoment: preIsolationState.dipoleMoment,
  };

  // Mutate UI slice only
  useStore.getState().setIsMobileSidebarOpen(true);
  useStore.getState().setActiveWorkspace('explorer');
  const postUiState = useStore.getState();

  assert(
    postUiState.isMobileSidebarOpen === true && postUiState.activeWorkspace === 'explorer',
    'UI Slice updated successfully'
  );
  assert(
    postUiState.atoms === preMoleculeSlice.atoms &&
    postUiState.molData === preMoleculeSlice.molData &&
    postUiState.processedPDB === preMoleculeSlice.processedPDB &&
    postUiState.ssData === preMoleculeSlice.ssData,
    'Molecule Slice remained 100% referentially isolated during UI mutation'
  );
  assert(
    postUiState.measurements === preMeasurementSlice,
    'Measurement Slice remained 100% referentially isolated during UI mutation'
  );
  assert(
    postUiState.ramachandranData === preBiophysicalSlice.ramachandranData &&
    postUiState.dipoleMoment === preBiophysicalSlice.dipoleMoment &&
    postUiState.showDipoleArrow === preBiophysicalSlice.showDipoleArrow,
    'Biophysical Slice remained 100% referentially isolated during UI mutation'
  );

  // Mutate Measurement slice only
  const sampleMeasurement: Measurement = {
    id: 'meas-test-1',
    type: 'distance',
    atomSerials: [1, 2],
    coordinates: [{ x: 0, y: 0, z: 0 }, { x: 3, y: 4, z: 0 }],
    value: 5.0,
    label: '5.000 Å'
  };
  useStore.getState().addMeasurement(sampleMeasurement);
  const postMeasState = useStore.getState();

  assert(
    postMeasState.measurements.length === 1 && postMeasState.measurements[0].id === 'meas-test-1',
    'Measurement added successfully'
  );
  assert(
    postMeasState.isMobileSidebarOpen === postUiState.isMobileSidebarOpen &&
    postMeasState.activeWorkspace === postUiState.activeWorkspace,
    'UI Slice values preserved untouched during Measurement mutation'
  );
  assert(
    postMeasState.renderStyle === postUiState.renderStyle &&
    postMeasState.colorScheme === postUiState.colorScheme,
    'Viewer Slice values preserved untouched during Measurement mutation'
  );

  // Clear measurements
  useStore.getState().clearMeasurements();
  assert(
    useStore.getState().measurements.length === 0,
    'Measurements cleared cleanly'
  );


  // --- SECTION 3: HIGH FREQUENCY STRESS & UNDO/REDO MEMORY OVERHEAD ---
  console.log('\n--- SECTION 3: High-Frequency Mutation & Undo/Redo Memory Overhead ---');

  if (global.gc) {
    global.gc();
  }

  const ITERATIONS = 10000;
  console.log(`Executing ${ITERATIONS.toLocaleString()} high-frequency state updates...`);

  // Test 3.1: High Frequency Direct Mutations Speed
  const startDirectTime = performance.now();
  const startDirectMem = process.memoryUsage().heapUsed;

  for (let i = 0; i < ITERATIONS; i++) {
    useStore.getState().setSurfaceOpacity((i % 100) / 100);
    useStore.getState().setBackgroundColor(i % 2 === 0 ? '#000000' : '#ffffff');
    if (i % 50 === 0) {
      useStore.getState().triggerFocus();
    }
  }

  const endDirectTime = performance.now();
  const endDirectMem = process.memoryUsage().heapUsed;
  const directDurationMs = endDirectTime - startDirectTime;
  const directOpsPerSec = Math.round((ITERATIONS * 2) / (directDurationMs / 1000));
  const directMemDelta = endDirectMem - startDirectMem;

  console.log(`  -> Direct Mutations Duration: ${directDurationMs.toFixed(2)} ms`);
  console.log(`  -> Mutation Throughput: ${directOpsPerSec.toLocaleString()} ops/sec`);
  console.log(`  -> Direct Memory Delta: ${formatBytes(directMemDelta)}`);

  assert(directDurationMs < 500, `High frequency direct state updates completed in < 500ms (${directDurationMs.toFixed(2)}ms)`);

  // Test 3.2: High Frequency Undo/Redo Snapshot Tracking (Unbounded vs Bounded)
  console.log('\nTesting Undo/Redo Stack with Unbounded (Full History) vs Bounded (Max 100) snapshots:');

  // Case A: Unbounded Undo Stack (10,000 snapshots of Zustand store state)
  if (global.gc) global.gc();
  const memBeforeUnbounded = process.memoryUsage().heapUsed;
  const stackUnbounded = new TemporalStack(useStore.getState());
  
  const startUnboundedTime = performance.now();
  for (let i = 0; i < ITERATIONS; i++) {
    useStore.getState().setSurfaceOpacity((i % 10) / 10);
    useStore.getState().setRamachandranData([{ resName: 'ALA', resSeq: i, chainID: 'A', phi: -60, psi: -45, region: 'favored' }]);
    stackUnbounded.record(useStore.getState());
  }
  const endUnboundedTime = performance.now();
  const memAfterUnbounded = process.memoryUsage().heapUsed;
  const unboundedMemDelta = memAfterUnbounded - memBeforeUnbounded;
  const perSnapshotBytes = unboundedMemDelta / ITERATIONS;

  console.log(`  [Unbounded Stack - 10,000 snapshots]`);
  console.log(`    Time Taken: ${(endUnboundedTime - startUnboundedTime).toFixed(2)} ms`);
  console.log(`    Stack Size: ${stackUnbounded.size.past} snapshots`);
  console.log(`    Total Heap Delta: ${formatBytes(unboundedMemDelta)}`);
  console.log(`    Est. Overhead per Snapshot: ${perSnapshotBytes.toFixed(2)} B`);

  // Case B: Bounded Undo Stack (Max 100 snapshots)
  if (global.gc) global.gc();
  const memBeforeBounded = process.memoryUsage().heapUsed;
  const stackBounded = new TemporalStack(useStore.getState(), 100);

  const startBoundedTime = performance.now();
  for (let i = 0; i < ITERATIONS; i++) {
    useStore.getState().setSurfaceOpacity((i % 10) / 10);
    useStore.getState().setRamachandranData([{ resName: 'GLY', resSeq: i, chainID: 'B', phi: 60, psi: 45, region: 'allowed' }]);
    stackBounded.record(useStore.getState());
  }
  const endBoundedTime = performance.now();
  const memAfterBounded = process.memoryUsage().heapUsed;
  const boundedMemDelta = memAfterBounded - memBeforeBounded;

  console.log(`  [Bounded Stack - Max 100 snapshots]`);
  console.log(`    Time Taken: ${(endBoundedTime - startBoundedTime).toFixed(2)} ms`);
  console.log(`    Stack Size: ${stackBounded.size.past} snapshots (Capped at 100)`);
  console.log(`    Total Heap Delta: ${formatBytes(boundedMemDelta)}`);

  assert(
    stackBounded.size.past === 100,
    'Bounded Undo stack correctly caps size to 100 snapshots despite 10,000 mutations'
  );
  assert(
    boundedMemDelta < unboundedMemDelta,
    'Bounded stack memory delta is significantly lower than unbounded stack'
  );

  // Test 3.3: Stress Test Undo/Redo Reversibility under High Frequency Operations
  console.log('\nTesting Undo/Redo Reversibility (500 step Undo sequence):');
  const UNDO_STEPS = 500;
  const initialOpacity = useStore.getState().surfaceOpacity;
  const undoStack = new TemporalStack(useStore.getState(), 1000);

  for (let i = 1; i <= UNDO_STEPS; i++) {
    useStore.getState().setSurfaceOpacity(i / 1000);
    undoStack.record(useStore.getState());
  }

  const peakOpacity = useStore.getState().surfaceOpacity;
  assert(peakOpacity === 500 / 1000, `State progressed to step ${UNDO_STEPS} (opacity = ${peakOpacity})`);

  // Undo 250 steps
  for (let i = 0; i < 250; i++) {
    const prev = undoStack.undo();
    if (prev) {
      useStore.setState(prev);
    }
  }
  const midOpacity = useStore.getState().surfaceOpacity;
  assert(
    midOpacity === 250 / 1000,
    `Undoing 250 steps accurately reverted state (opacity = ${midOpacity}, expected = 0.25)`
  );

  // Redo 100 steps
  for (let i = 0; i < 100; i++) {
    const next = undoStack.redo();
    if (next) {
      useStore.setState(next);
    }
  }
  const redoOpacity = useStore.getState().surfaceOpacity;
  assert(
    redoOpacity === 350 / 1000,
    `Redoing 100 steps accurately advanced state (opacity = ${redoOpacity}, expected = 0.35)`
  );


  // --- SECTION 4: MEMORY LEAK ANALYSIS ---
  console.log('\n--- SECTION 4: Memory Leak Detection & GC Baseline Verification ---');

  stackUnbounded.clear();
  stackBounded.clear();
  undoStack.clear();

  if (global.gc) {
    global.gc();
  }

  const finalMem = process.memoryUsage().heapUsed;
  console.log(`  Initial Heap (approx): ${formatBytes(startDirectMem)}`);
  console.log(`  Final Heap (after clearing stacks): ${formatBytes(finalMem)}`);
  console.log(`  Net Heap Residual: ${formatBytes(finalMem - startDirectMem)}`);

  const memoryLeakDetected = (finalMem - startDirectMem) > 20 * 1024 * 1024; // > 20MB residual
  assert(!memoryLeakDetected, 'No memory leak detected after stack clearance and GC cleanup');

  console.log('\n====================================================');
  console.log(` TEST SUMMARY: ${passedTests} / ${totalTests} ASSERTIONS PASSED `);
  console.log('====================================================\n');

  if (passedTests !== totalTests) {
    process.exit(1);
  }
}

runStateVerification().catch((err) => {
  console.error('Fatal Error during Zustand state verification:', err);
  process.exit(1);
});
