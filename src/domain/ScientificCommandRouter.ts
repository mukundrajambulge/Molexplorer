/**
 * ScientificCommandRouter.ts
 * Authoritative Selection-Aware Command Router for Phase SQ2/SQ3.
 *
 * Implements the full pipeline:
 * Raw Input
 *   ↓
 * Command Lexer (CommandLexer.ts)
 *   ↓
 * Command AST (CommandAST.ts)
 *   ↓
 * Dedicated Command Parser (ScientificCommandParser.ts)
 *   ↓
 * Selection Argument Parser
 *   ↓
 * SQ1 Canonical Selection AST
 *   ↓
 * Canonical Selection Evaluator
 *   ↓
 * Command Execution (presentation, editing, measurement, analysis)
 */

import { CanonicalAtom, MeasurementResult, InteractionAnalysisResult } from '../types/domain';
import { SelectionParser, Atom } from '../lib/SelectionParser';
import { CanonicalSelectionEvaluator } from './CanonicalSelectionEvaluator';
import { MeasurementParser } from './MeasurementParser';
import { ScientificMeasurementEngine } from './ScientificMeasurementEngine';
import { CommandLexer } from './CommandLexer';
import { ScientificCommandParser } from './ScientificCommandParser';
import { LabelExpressionEvaluator } from './LabelExpressionEvaluator';
import { CommandASTNode } from './CommandAST';
import { SpectrumEngine, SpectrumProperty, SpectrumPalette, SpectrumResult } from './SpectrumEngine';

export interface CommandRouterResult {
  type: 'measurement' | 'analysis' | 'selection' | 'console_action';
  selectedSerials: Set<number>;
  count: number;
  textOutput: string;
  commandAST?: CommandASTNode;
  measurementResult?: MeasurementResult;
  analysisResult?: InteractionAnalysisResult;
  addMeasurement?: {
    type: 'distance' | 'angle' | 'dihedral';
    atomSerials: number[];
    label: string;
    value: number;
  };
  saveSelection?: { name: string; query: string; atomIds?: number[] };
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
  /** SQ3: typed camera operation */
  cameraOperation?: 'zoom' | 'center' | 'orient';
  fetchPdbId?: string;
  addHydrogens?: boolean;
  removeHydrogens?: boolean;
  addHydrogensRequest?: { query?: string; fillOnly?: boolean };
  removeHydrogensRequest?: { query?: string };
  addLabels?: Array<{ serial: number; text: string }>;
  clearLabels?: number[];
  undoRequest?: boolean;
  redoRequest?: boolean;
  historyRequest?: boolean;
  ramachandranReport?: any[];
  /** SQ3: per-atom spectrum color assignments */
  spectrumResult?: SpectrumResult;
  /** SQ3: global setting name/value */
  settingResult?: { name: string; value?: string; selection?: string };
  /** Forwarded from SelectionParser.evaluateCommand() editing branch */
  dipoleResult?: {
    charge: number;
    magnitude: number;
    vector: { x: number; y: number; z: number };
    com: { x: number; y: number; z: number };
  };
  /** Forwarded from SelectionParser.evaluateCommand() editing branch */
  addHBonds?: {
    donorSerial: number;
    acceptorSerial: number;
    energy: number;
    distance: number;
  }[];
  presentationOverrides?: Array<{
    selectionKey: string;
    selectionQuery: string;
    atomSerials: Set<number>;
    color?: string | null;
    representation?: string | null;
    visibility?: 'visible' | 'hidden';
    appliedAt: number;
  }>;
}

export class ScientificCommandRouter {
  /**
   * Routes and executes single commands or semicolon (;) command sequences.
   */
  static routeAndExecute(
    input: string,
    atoms: Atom[] | CanonicalAtom[],
    namedSelections: { name: string; query: string; atomIds?: number[] }[] = [],
    activeObjectName: string = 'molecule'
  ): CommandRouterResult {
    const rawTrim = input.trim();
    if (!rawTrim) {
      return {
        type: 'selection',
        selectedSerials: new Set(),
        count: 0,
        textOutput: ''
      };
    }

    const commandLines = CommandLexer.splitCommandSequences(rawTrim);
    if (commandLines.length === 0) {
      return {
        type: 'selection',
        selectedSerials: new Set(),
        count: 0,
        textOutput: ''
      };
    }

    // Single command fast path
    if (commandLines.length === 1) {
      return this.executeSingleCommand(commandLines[0], atoms, namedSelections, activeObjectName);
    }

    // Semicolon Command Sequence: sequential fail-fast execution
    const combinedSerials = new Set<number>();
    const textOutputs: string[] = [];
    let lastResult: CommandRouterResult | null = null;
    const currentNamedSelections = [...namedSelections];

    let mergedSetStyle: string | undefined;
    let mergedSetColorScheme: string | undefined;
    let mergedTriggerZoom: boolean | undefined;
    let mergedAddLabels: Array<{ serial: number; text: string }> | undefined;
    let mergedSaveSelection: { name: string; query: string; atomIds?: number[] } | undefined;
    let mergedDeleteSelectionName: string | undefined;
    const mergedPresentationOverrides: Array<{
      selectionKey: string;
      selectionQuery: string;
      atomSerials: Set<number>;
      color?: string | null;
      representation?: string | null;
      visibility?: 'visible' | 'hidden';
      appliedAt: number;
    }> = [];

    for (const cmdLine of commandLines) {
      const res = this.executeSingleCommand(cmdLine, atoms, currentNamedSelections, activeObjectName);
      lastResult = res;
      res.selectedSerials.forEach(s => combinedSerials.add(s));
      if (res.textOutput) textOutputs.push(res.textOutput);

      if (res.setStyle) mergedSetStyle = res.setStyle;
      if (res.setColorScheme) mergedSetColorScheme = res.setColorScheme;
      if (res.triggerZoom) mergedTriggerZoom = true;
      if (res.addLabels) {
        mergedAddLabels = mergedAddLabels ? [...mergedAddLabels, ...res.addLabels] : res.addLabels;
      }
      if (res.presentationOverrides) {
        mergedPresentationOverrides.push(...res.presentationOverrides);
      }

      if (res.saveSelection) {
        mergedSaveSelection = res.saveSelection;
        currentNamedSelections.push({
          name: res.saveSelection.name,
          query: res.saveSelection.query,
          atomIds: res.saveSelection.atomIds
        });
      }
      if (res.deleteSelectionName) {
        mergedDeleteSelectionName = res.deleteSelectionName;
        const delName = res.deleteSelectionName.toLowerCase();
        const idx = currentNamedSelections.findIndex(s => s.name.toLowerCase() === delName);
        if (idx >= 0) currentNamedSelections.splice(idx, 1);
      }
    }

    return {
      type: lastResult?.type || 'console_action',
      selectedSerials: combinedSerials,
      count: combinedSerials.size,
      textOutput: textOutputs.join(' | '),
      commandAST: lastResult?.commandAST,
      setStyle: mergedSetStyle,
      setColorScheme: mergedSetColorScheme,
      triggerZoom: mergedTriggerZoom,
      addLabels: mergedAddLabels,
      saveSelection: mergedSaveSelection,
      deleteSelectionName: mergedDeleteSelectionName,
      presentationOverrides: mergedPresentationOverrides.length > 0 ? mergedPresentationOverrides : undefined
    };
  }

  /**
   * Evaluates a single command AST and resolves its selection operands via SQ1 engine.
   */
  private static executeSingleCommand(
    commandLine: string,
    atoms: Atom[] | CanonicalAtom[],
    namedSelections: { name: string; query: string; atomIds?: number[] }[] = [],
    activeObjectName: string = 'molecule'
  ): CommandRouterResult {
    // Helper to evaluate selection query using SQ1 selection algebra
    const evaluateSelection = (queryStr: string): Set<number> => {
      const q = (queryStr || 'all').trim();
      try {
        const parser = atoms.length > 0 && 'canonical_id' in atoms[0]
          ? SelectionParser.fromCanonicalAtoms(atoms as CanonicalAtom[], undefined, namedSelections)
          : new SelectionParser(atoms as Atom[], namedSelections);
        return parser.parse(q);
      } catch (err: any) {
        if (err.message && (err.message.startsWith('Selection syntax error') || err.message.startsWith('Syntax error'))) {
          if (err.message.startsWith('Syntax error')) {
            throw new Error(`Selection syntax error: ${err.message.slice(14)}`);
          }
          throw err;
        }
        throw new Error(`Selection syntax error: ${err.message}`);
      }
    };

    // 1. Parse command into typed CommandASTNode
    let ast: CommandASTNode;
    try {
      ast = ScientificCommandParser.parseCommand(commandLine);
    } catch (err: any) {
      throw err;
    }

    // 2. Dispatch based on AST command_type
    switch (ast.command_type) {
      case 'selection_lifecycle': {
        if (ast.verb === 'select') {
          const name = ast.target_name || 'sele';
          const query = ast.selection_query || 'all';
          const selectedSerials = evaluateSelection(query);
          return {
            type: 'selection',
            commandAST: ast,
            selectedSerials,
            count: selectedSerials.size,
            textOutput: `Selection: ${name} = ${selectedSerials.size} atoms`,
            saveSelection: { name, query, atomIds: Array.from(selectedSerials) }
          };
        }
        if (ast.verb === 'delete' || ast.verb === 'del') {
          const name = ast.target_name || '';
          return {
            type: 'console_action',
            commandAST: ast,
            selectedSerials: new Set(),
            count: 0,
            textOutput: `delete: removed named selection '${name}'`,
            deleteSelectionName: name
          };
        }
        if (ast.verb === 'disable' || ast.verb === 'enable') {
          return {
            type: 'console_action',
            commandAST: ast,
            selectedSerials: new Set(),
            count: 0,
            textOutput: `${ast.verb}: updated state for '${ast.target_name}'`
          };
        }
        break;
      }

      case 'color': {
        const color = ast.color_value || 'element';
        const selQuery = ast.selection_query || 'all';
        const selectedSerials = evaluateSelection(selQuery);
        const isGlobal = !ast.selection_query || ast.selection_query === 'all' || ast.selection_query === '*';
        return {
          type: 'console_action',
          commandAST: ast,
          selectedSerials,
          count: selectedSerials.size,
          setColorScheme: isGlobal ? color : undefined,
          presentationOverrides: [{
            selectionKey: selQuery,
            selectionQuery: selQuery,
            atomSerials: new Set(selectedSerials),
            color: color,
            appliedAt: Date.now()
          }],
          textOutput: `color: applied '${color}' to ${selectedSerials.size} atoms (${selQuery})`
        };
      }

      case 'representation': {
        const rep = ast.representation_value || 'cartoon';
        const selQuery = ast.selection_query || 'all';
        const selectedSerials = evaluateSelection(selQuery);
        const isHide = ast.verb === 'hide';
        const isGlobal = !ast.selection_query || ast.selection_query === 'all' || ast.selection_query === '*';
        return {
          type: 'console_action',
          commandAST: ast,
          selectedSerials,
          count: selectedSerials.size,
          setStyle: isGlobal ? (isHide ? 'hidden' : rep) : undefined,
          presentationOverrides: [{
            selectionKey: selQuery,
            selectionQuery: selQuery,
            atomSerials: new Set(selectedSerials),
            representation: isHide ? null : rep,
            visibility: isHide ? 'hidden' : 'visible',
            appliedAt: Date.now()
          }],
          textOutput: `${ast.verb}: applied '${rep}' to ${selectedSerials.size} atoms (${selQuery})`
        };
      }

      case 'view': {
        const selQuery = ast.selection_query || 'all';
        const selectedSerials = evaluateSelection(selQuery);
        // SQ3: distinct camera operations — zoom frames region, center only resets rotation pivot,
        // orient aligns principal inertia axes. All are READ-ONLY; none create revisions.
        const cameraOp = ast.camera_operation || 'zoom';
        let cameraText = '';
        if (cameraOp === 'zoom') cameraText = `zoom: reframed view around ${selectedSerials.size} atoms (${selQuery})`;
        else if (cameraOp === 'center') cameraText = `center: rotation pivot set to centroid of ${selectedSerials.size} atoms (${selQuery})`;
        else cameraText = `orient: principal axes aligned for ${selectedSerials.size} atoms (${selQuery})`;
        return {
          type: 'console_action',
          commandAST: ast,
          selectedSerials,
          count: selectedSerials.size,
          triggerZoom: true,
          cameraOperation: cameraOp,
          textOutput: cameraText
        };
      }

      case 'label': {
        const selQuery = ast.selection_query || 'all';
        const selectedSerials = evaluateSelection(selQuery);
        const addLabels: Array<{ serial: number; text: string }> = [];

        if (ast.label_expression) {
          for (const a of atoms) {
            const serial = 'canonical_id' in a ? (a as CanonicalAtom).canonical_id : (a as Atom).serial;
            if (selectedSerials.has(serial)) {
              const labelText = LabelExpressionEvaluator.evaluate(ast.label_expression, a);
              addLabels.push({ serial, text: labelText });
            }
          }
        }

        return {
          type: 'console_action',
          commandAST: ast,
          selectedSerials,
          count: selectedSerials.size,
          addLabels,
          textOutput: `label: created ${addLabels.length} labels for selection (${selQuery})`
        };
      }

      case 'spectrum': {
        const selQuery = ast.selection_query || 'all';
        const selectedSerials = evaluateSelection(selQuery);
        const rawProp = ast.spectrum_args?.property || 'b';
        const rawPalette = ast.spectrum_args?.palette || 'rainbow';

        // SQ3: validate property and palette through typed SpectrumEngine
        let prop: SpectrumProperty;
        let palette: SpectrumPalette;
        try {
          prop = SpectrumEngine.validateProperty(rawProp);
        } catch (e: any) {
          throw new Error(`Spectrum syntax error: ${e.message}`);
        }
        try {
          palette = SpectrumEngine.validatePalette(rawPalette);
        } catch (e: any) {
          throw new Error(`Spectrum syntax error: ${e.message}`);
        }

        const minOverride = ast.spectrum_args?.min;
        const maxOverride = ast.spectrum_args?.max;

        const spectrumResult = SpectrumEngine.map(
          atoms,
          selectedSerials,
          prop,
          palette,
          minOverride,
          maxOverride
        );

        return {
          type: 'console_action',
          commandAST: ast,
          selectedSerials,
          count: selectedSerials.size,
          setColorScheme: 'spectrum',
          spectrumResult,
          textOutput:
            `spectrum: property='${prop}' palette='${palette}' ` +
            `range=[${spectrumResult.minValue.toFixed(2)}, ${spectrumResult.maxValue.toFixed(2)}] ` +
            `${spectrumResult.coveredCount} atoms colored, ${spectrumResult.missingCount} missing (grey fallback)`
        };
      }

      case 'set': {
        // SQ3: Global setting command — presentation state only, never scientific state
        const settingName = ast.setting_args?.name || '';
        const settingValue = ast.setting_args?.value;
        const settingSelection = ast.setting_args?.selection;
        return {
          type: 'console_action',
          commandAST: ast,
          selectedSerials: new Set(),
          count: 0,
          settingResult: { name: settingName, value: settingValue, selection: settingSelection },
          textOutput: `set: ${settingName}=${settingValue ?? 'default'}${settingSelection ? ` for (${settingSelection})` : ''}`
        };
      }

      case 'fetch': {
        // SQ3: fetch <pdb_id> — triggers PDB download
        const pdbId = ast.fetch_args?.pdbId || '';
        return {
          type: 'console_action',
          commandAST: ast,
          selectedSerials: new Set(),
          count: 0,
          fetchPdbId: pdbId,
          textOutput: `fetch: requesting PDB entry '${pdbId}'`
        };
      }

      case 'measurement': {
        try {
          const measAst = MeasurementParser.parse(commandLine);
          const engine = new ScientificMeasurementEngine(atoms, undefined, namedSelections);
          const res = engine.execute(measAst) as MeasurementResult;

          const selectedSerials = new Set<number>();
          if (res.distances) {
            res.distances.forEach(d => { selectedSerials.add(d.atom1_id); selectedSerials.add(d.atom2_id); });
          } else if (res.angle) {
            selectedSerials.add(res.angle.atom1_id); selectedSerials.add(res.angle.vertex_id); selectedSerials.add(res.angle.atom3_id);
          } else if (res.dihedral) {
            selectedSerials.add(res.dihedral.atom1_id); selectedSerials.add(res.dihedral.atom2_id); selectedSerials.add(res.dihedral.atom3_id); selectedSerials.add(res.dihedral.atom4_id);
          }

          return {
            type: 'measurement',
            commandAST: ast,
            selectedSerials,
            count: selectedSerials.size,
            textOutput: res.text_output,
            measurementResult: res,
            addMeasurement: res.visual_measurement
          };
        } catch (err: any) {
          if (err.message && err.message.startsWith('Measurement syntax error')) throw err;
          throw new Error(`Measurement syntax error: ${err.message}`);
        }
      }

      case 'analysis': {
        try {
          const anaAst = MeasurementParser.parse(commandLine);
          const engine = new ScientificMeasurementEngine(atoms, undefined, namedSelections);
          const res = engine.execute(anaAst) as InteractionAnalysisResult;

          const selectedSerials = new Set<number>();
          res.interactions.forEach(r => {
            selectedSerials.add(r.atom1.serial);
            selectedSerials.add(r.atom2.serial);
          });

          return {
            type: 'analysis',
            commandAST: ast,
            selectedSerials,
            count: selectedSerials.size,
            textOutput: res.text_output,
            analysisResult: res
          };
        } catch (err: any) {
          if (err.message && err.message.startsWith('Analysis syntax error')) throw err;
          throw new Error(`Analysis syntax error: ${err.message}`);
        }
      }

      case 'history': {
        if (ast.verb === 'undo') {
          return {
            type: 'console_action',
            commandAST: ast,
            selectedSerials: new Set(),
            count: 0,
            undoRequest: true,
            textOutput: 'undo: navigating to parent scientific revision.'
          };
        }
        if (ast.verb === 'redo') {
          return {
            type: 'console_action',
            commandAST: ast,
            selectedSerials: new Set(),
            count: 0,
            redoRequest: true,
            textOutput: 'redo: navigating to child scientific revision.'
          };
        }
        if (ast.verb === 'history') {
          return {
            type: 'console_action',
            commandAST: ast,
            selectedSerials: new Set(),
            count: 0,
            historyRequest: true,
            textOutput: 'history: inspected scientific revision ledger.'
          };
        }
        break;
      }

      case 'editing': {
        // Delegate to existing editing handler in SelectionParser / MolStudio.
        // evaluateCommand() requires atomIds: number[] (not optional) — normalize here.
        const normalizedNamed = namedSelections.map(s => ({
          name: s.name,
          query: s.query,
          atomIds: s.atomIds ?? []
        }));
        const parser = atoms.length > 0 && 'canonical_id' in atoms[0]
          ? SelectionParser.fromCanonicalAtoms(atoms as CanonicalAtom[], undefined, normalizedNamed)
          : new SelectionParser(atoms as Atom[], normalizedNamed);
        const legacyRes = parser.evaluateCommand(commandLine, normalizedNamed, activeObjectName);
        return {
          type: 'console_action',
          commandAST: ast,
          selectedSerials: legacyRes.selectedSerials,
          count: legacyRes.selectedSerials.size,
          textOutput: legacyRes.textOutput || `editing: ${ast.verb} executed.`,
          removeAtomSerials: legacyRes.removeAtomSerials,
          bondRequest: legacyRes.bondRequest,
          unbondRequest: legacyRes.unbondRequest,
          // evaluateCommand returns order: number, but CommandRouterResult needs the union type.
          // Cast is safe because the editing kernel only produces 1 | 1.5 | 2 | 3.
          setBondOrderRequest: legacyRes.setBondOrderRequest
            ? { ...legacyRes.setBondOrderRequest, order: legacyRes.setBondOrderRequest.order as 1 | 1.5 | 2 | 3 }
            : undefined,
          alterRequest: legacyRes.alterRequest,
          alterStateRequest: legacyRes.alterStateRequest,
          cycleValenceRequest: legacyRes.cycleValenceRequest,
          addHydrogensRequest: legacyRes.addHydrogensRequest,
          removeHydrogensRequest: legacyRes.removeHydrogensRequest,
          // SQ3.5: restored fields that MolStudio.tsx depends on
          dipoleResult: (legacyRes as any).dipoleResult,
          addHBonds: (legacyRes as any).addHBonds,
          ramachandranReport: legacyRes.ramachandranReport,
          addLabels: legacyRes.addLabels,
          clearLabels: legacyRes.clearLabels
        };
      }

      case 'query':
      default: {
        const query = ast.selection_query || commandLine;
        const selectedSerials = evaluateSelection(query);
        return {
          type: 'selection',
          commandAST: ast,
          selectedSerials,
          count: selectedSerials.size,
          textOutput: `Selector: ${selectedSerials.size} atoms selected`
        };
      }
    }

    return {
      type: 'selection',
      selectedSerials: new Set(),
      count: 0,
      textOutput: ''
    };
  }
}
