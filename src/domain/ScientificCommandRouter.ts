/**
 * ScientificCommandRouter.ts
 * Dedicated command classification, parsing, and routing layer for Molexplorer.
 * 
 * Routes incoming console/API commands to their appropriate subsystem:
 * 1. Geometric measurements -> MeasurementParser -> ScientificMeasurementEngine
 * 2. Biophysical interaction analyses -> MeasurementParser -> ScientificMeasurementEngine
 * 3. Selection queries & editor commands -> SelectionParser / CanonicalSelectionEvaluator
 * 
 * Enforces precise error reporting with explicit syntax classifications:
 * - "Selection syntax error: ..."
 * - "Measurement syntax error: ..."
 * - "Analysis syntax error: ..."
 */

import { CanonicalAtom, MeasurementResult, InteractionAnalysisResult } from '../types/domain';
import { SelectionParser, Atom } from '../lib/SelectionParser';
import { MeasurementParser } from './MeasurementParser';
import { ScientificMeasurementEngine } from './ScientificMeasurementEngine';

export interface CommandRouterResult {
  type: 'measurement' | 'analysis' | 'selection' | 'console_action';
  selectedSerials: Set<number>;
  count: number;
  textOutput: string;
  measurementResult?: MeasurementResult;
  analysisResult?: InteractionAnalysisResult;
  addMeasurement?: {
    type: 'distance' | 'angle' | 'dihedral';
    atomSerials: number[];
    label: string;
    value: number;
  };
  saveSelection?: { name: string; query: string };
  deleteSelectionName?: string;
  removeAtomSerials?: Set<number>;
  bondRequest?: { atomA: number; atomB: number; order?: number };
  unbondRequest?: { atomA: number; atomB: number };
  setBondOrderRequest?: { atomA: number; atomB: number; order: 1 | 1.5 | 2 | 3 };
  alterRequest?: { query: string; property: string; value: any };
  alterStateRequest?: { query: string; stateId: string; property: string; value: any };
  cycleValenceRequest?: { atomA: number; atomB: number };
  setStyle?: string;
  setColorScheme?: string;
  setHiddenCategory?: string;
  triggerZoom?: boolean;
  fetchPdbId?: string;
  addHydrogens?: boolean;
  removeHydrogens?: boolean;
  addLabels?: Array<{ serial: number; text: string }>;
  clearLabels?: number[];
  undoRequest?: boolean;
  redoRequest?: boolean;
  ramachandranReport?: any[];
}

export class ScientificCommandRouter {
  /**
   * Classifies the command type based on leading keyword tokens.
   */
  static classifyCommand(query: string): 'measurement' | 'analysis' | 'selection_or_action' {
    const qTrim = query.trim();
    if (!qTrim) return 'selection_or_action';

    const firstWord = qTrim.split(/[\s,]+/)[0].toLowerCase();

    // Measurement verbs
    const measurementVerbs = ['distance', 'dist', 'angle', 'dihedral'];
    if (measurementVerbs.includes(firstWord)) {
      return 'measurement';
    }

    // Analysis verbs
    const analysisVerbs = [
      'polar_contacts', 'salt_bridges', 'pi_stack',
      'cation_pi', 'halogen_bonds', 'hydrophobic_contacts'
    ];
    if (analysisVerbs.includes(firstWord)) {
      return 'analysis';
    }

    return 'selection_or_action';
  }

  /**
   * Routes and executes a command string against the target atom collection.
   */
  static routeAndExecute(
    query: string,
    atoms: Atom[] | CanonicalAtom[],
    namedSelections?: { name: string; query: string; atomIds?: number[] }[],
    activeObjectName?: string
  ): CommandRouterResult {
    const qTrim = query.trim();
    if (!qTrim) {
      return {
        type: 'selection',
        selectedSerials: new Set(),
        count: 0,
        textOutput: ''
      };
    }

    const commandType = this.classifyCommand(qTrim);

    // 1. Route to MeasurementParser & ScientificMeasurementEngine
    if (commandType === 'measurement') {
      try {
        const ast = MeasurementParser.parse(qTrim);
        const engine = new ScientificMeasurementEngine(atoms, undefined, namedSelections);
        const res = engine.execute(ast) as MeasurementResult;

        const selectedSerials = new Set<number>();
        if (res.distances) {
          res.distances.forEach(d => {
            selectedSerials.add(d.atom1_id);
            selectedSerials.add(d.atom2_id);
          });
        } else if (res.angle) {
          selectedSerials.add(res.angle.atom1_id);
          selectedSerials.add(res.angle.vertex_id);
          selectedSerials.add(res.angle.atom3_id);
        } else if (res.dihedral) {
          selectedSerials.add(res.dihedral.atom1_id);
          selectedSerials.add(res.dihedral.atom2_id);
          selectedSerials.add(res.dihedral.atom3_id);
          selectedSerials.add(res.dihedral.atom4_id);
        } else if (res.polar_contacts) {
          res.polar_contacts.forEach(c => {
            selectedSerials.add(c.donor_atom.id);
            selectedSerials.add(c.acceptor_atom.id);
          });
        }

        return {
          type: 'measurement',
          selectedSerials,
          count: selectedSerials.size,
          textOutput: res.text_output,
          measurementResult: res,
          addMeasurement: res.visual_measurement
        };
      } catch (err: any) {
        if (err.message && err.message.startsWith('Measurement syntax error')) {
          throw err;
        }
        throw new Error(`Measurement syntax error: ${err.message}`);
      }
    }

    // 2. Route to Analysis Engine
    if (commandType === 'analysis') {
      try {
        const ast = MeasurementParser.parse(qTrim);
        const engine = new ScientificMeasurementEngine(atoms, undefined, namedSelections);
        const res = engine.execute(ast) as InteractionAnalysisResult;

        const selectedSerials = new Set<number>();
        res.interactions.forEach(r => {
          selectedSerials.add(r.atom1.serial);
          selectedSerials.add(r.atom2.serial);
        });

        return {
          type: 'analysis',
          selectedSerials,
          count: selectedSerials.size,
          textOutput: res.text_output,
          analysisResult: res
        };
      } catch (err: any) {
        if (err.message && err.message.startsWith('Analysis syntax error')) {
          throw err;
        }
        throw new Error(`Analysis syntax error: ${err.message}`);
      }
    }

    // 3. Route to SelectionParser and Selection Console command handler
    try {
      const parser = atoms.length > 0 && 'canonical_id' in atoms[0]
        ? SelectionParser.fromCanonicalAtoms(atoms as CanonicalAtom[], undefined, namedSelections)
        : new SelectionParser(atoms as Atom[], namedSelections);

      const res = parser.evaluateCommand(qTrim, namedSelections, activeObjectName);

      return {
        type: res.textOutput?.startsWith('Selector:') ? 'selection' : 'console_action',
        selectedSerials: res.selectedSerials,
        count: res.selectedSerials.size,
        textOutput: res.textOutput,
        saveSelection: res.saveSelection,
        deleteSelectionName: res.deleteSelectionName,
        removeAtomSerials: res.removeAtomSerials,
        bondRequest: res.bondRequest,
        unbondRequest: res.unbondRequest,
        setBondOrderRequest: res.setBondOrderRequest,
        alterRequest: res.alterRequest,
        alterStateRequest: res.alterStateRequest,
        cycleValenceRequest: res.cycleValenceRequest,
        setStyle: res.setStyle,
        setColorScheme: res.setColorScheme,
        setHiddenCategory: res.setHiddenCategory,
        triggerZoom: res.triggerZoom,
        fetchPdbId: res.fetchPdbId,
        addHydrogens: res.addHydrogens,
        removeHydrogens: res.removeHydrogens,
        addLabels: res.addLabels,
        clearLabels: res.clearLabels,
        addMeasurement: res.addMeasurement,
        undoRequest: res.undoRequest,
        redoRequest: res.redoRequest,
        ramachandranReport: res.ramachandranReport
      };
    } catch (err: any) {
      if (err.message && (err.message.startsWith('Selection syntax error') || err.message.startsWith('Syntax error'))) {
        if (err.message.startsWith('Syntax error')) {
          throw new Error(`Selection syntax error: ${err.message.slice(14)}`);
        }
        throw err;
      }
      throw new Error(`Selection syntax error: ${err.message}`);
    }
  }
}

