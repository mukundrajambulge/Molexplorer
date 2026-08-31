/**
 * ScientificCommandParser.ts
 * Dedicated Command Parser for Phase SQ2.
 * 
 * Maps raw command input to typed CommandASTNodes with strict error taxonomies:
 * - "Command syntax error: ..."
 * - "Selection syntax error: ..."
 * - "Color syntax error: ..."
 * - "Representation syntax error: ..."
 * - "Label expression error: ..."
 */

import { CommandASTNode } from './CommandAST';
import { CommandLexer, LexedCommand } from './CommandLexer';
import { RepresentationRegistry } from './RepresentationRegistry';
import { ColorRegistry } from './ColorRegistry';
import { LabelExpressionEvaluator } from './LabelExpressionEvaluator';

export class ScientificCommandParser {
  /**
   * Parses a single command line into a typed CommandASTNode.
   */
  static parseCommand(commandLine: string): CommandASTNode {
    const lexed = CommandLexer.lexSingleCommand(commandLine);
    const verb = lexed.verb;
    const raw = lexed.raw_input;

    if (!verb) {
      return {
        verb: '',
        raw_input: raw,
        command_type: 'query',
        positional_args: [],
        named_args: {},
        selection_query: ''
      };
    }

    // 1. SELECTION LIFECYCLE: select, delete, disable, enable
    if (verb === 'select' || verb === 'sele') {
      // select <name>, <selection> OR select <name> <selection>
      if (lexed.comma_args.length >= 2) {
        const name = lexed.comma_args[0].trim();
        const selQuery = lexed.comma_args.slice(1).join(',').trim();
        if (!name) throw new Error("Command syntax error: missing selection name for 'select'");
        if (!selQuery) throw new Error(`Command syntax error: missing selection query for 'select ${name}'`);
        return {
          verb: 'select',
          raw_input: raw,
          command_type: 'selection_lifecycle',
          positional_args: [name, selQuery],
          named_args: {},
          target_name: name,
          selection_query: selQuery
        };
      }
      // If single space separated: select name query
      const match = lexed.args_raw.match(/^([a-zA-Z0-9_]+)\s*,\s*(.+)$/) || lexed.args_raw.match(/^([a-zA-Z0-9_]+)\s+(.+)$/);
      if (match) {
        return {
          verb: 'select',
          raw_input: raw,
          command_type: 'selection_lifecycle',
          positional_args: [match[1], match[2]],
          named_args: {},
          target_name: match[1],
          selection_query: match[2]
        };
      }
      if (lexed.args_raw.trim()) {
        // Plain selection without saving: select <query>
        return {
          verb: 'select',
          raw_input: raw,
          command_type: 'query',
          positional_args: [lexed.args_raw.trim()],
          named_args: {},
          selection_query: lexed.args_raw.trim()
        };
      }
      throw new Error("Command syntax error: missing arguments for 'select'");
    }

    if (verb === 'delete' || verb === 'del') {
      const target = lexed.args_raw.trim();
      if (!target) throw new Error("Command syntax error: missing target name for 'delete'");
      return {
        verb: 'delete',
        raw_input: raw,
        command_type: 'selection_lifecycle',
        positional_args: [target],
        named_args: {},
        target_name: target
      };
    }

    if (verb === 'disable' || verb === 'enable') {
      const target = lexed.args_raw.trim();
      if (!target) throw new Error(`Command syntax error: missing target name for '${verb}'`);
      return {
        verb,
        raw_input: raw,
        command_type: 'selection_lifecycle',
        positional_args: [target],
        named_args: {},
        target_name: target
      };
    }

    // 2. COLORING: color, colour, set_color
    if (verb === 'color' || verb === 'colour' || verb === 'set_color') {
      if (!lexed.args_raw.trim()) {
        throw new Error("Color syntax error: missing color specification");
      }

      let colorVal = '';
      let selQuery = 'all';

      if (lexed.comma_args.length >= 2) {
        colorVal = lexed.comma_args[0].trim();
        selQuery = lexed.comma_args.slice(1).join(',').trim() || 'all';
      } else {
        // e.g. "color cyan ligand" or "color cyan"
        const parts = lexed.args_raw.trim().split(/\s+/);
        colorVal = parts[0];
        if (parts.length > 1) {
          selQuery = lexed.args_raw.trim().slice(colorVal.length).trim();
        }
      }

      const validatedColor = ColorRegistry.validate(colorVal);

      return {
        verb: 'color',
        raw_input: raw,
        command_type: 'color',
        positional_args: [validatedColor, selQuery],
        named_args: {},
        color_value: validatedColor,
        selection_query: selQuery
      };
    }

    // SQ3. RECOLOR: recolor [selection] -> resets to element default
    if (verb === 'recolor') {
      const selQuery = lexed.args_raw.trim() || 'all';
      return {
        verb: 'recolor',
        raw_input: raw,
        command_type: 'color',
        positional_args: ['element', selQuery],
        named_args: {},
        color_value: 'element',
        selection_query: selQuery
      };
    }

    // 3. REPRESENTATION: show, hide, show_as, as
    if (verb === 'show' || verb === 'hide' || verb === 'show_as' || verb === 'as') {
      const canonicalVerb = verb === 'as' ? 'show_as' : verb;
      if (!lexed.args_raw.trim()) {
        if (canonicalVerb === 'hide') {
          return {
            verb: 'hide',
            raw_input: raw,
            command_type: 'representation',
            positional_args: ['everything', 'all'],
            named_args: {},
            representation_value: 'everything',
            selection_query: 'all'
          };
        }
        throw new Error(`Representation syntax error: missing representation name for '${verb}'`);
      }

      let repVal = '';
      let selQuery = 'all';

      if (lexed.comma_args.length >= 2) {
        repVal = lexed.comma_args[0].trim();
        selQuery = lexed.comma_args.slice(1).join(',').trim() || 'all';
      } else {
        const parts = lexed.args_raw.trim().split(/\s+/);
        repVal = parts[0];
        if (parts.length > 1) {
          selQuery = lexed.args_raw.trim().slice(repVal.length).trim();
        }
      }

      const validatedRep = RepresentationRegistry.validate(repVal, canonicalVerb === 'hide');

      return {
        verb: canonicalVerb,
        raw_input: raw,
        command_type: 'representation',
        positional_args: [validatedRep, selQuery],
        named_args: {},
        representation_value: validatedRep,
        selection_query: selQuery
      };
    }

    // 4. VIEW / CAMERA: zoom, center, orient (SQ3: typed camera_operation)
    if (verb === 'zoom' || verb === 'center' || verb === 'orient') {
      const selQuery = lexed.args_raw.trim() || 'all';
      return {
        verb,
        raw_input: raw,
        command_type: 'view',
        positional_args: [selQuery],
        named_args: {},
        selection_query: selQuery,
        camera_operation: verb as 'zoom' | 'center' | 'orient'
      };
    }

    // 5. LABEL: label <selection>, <expression>
    if (verb === 'label') {
      if (lexed.comma_args.length < 2) {
        // e.g. label pocket, name or label all, resn
        throw new Error("Command syntax error: 'label' requires selection and expression (e.g. 'label <selection>, <expression>')");
      }
      const selQuery = lexed.comma_args[0].trim();
      const exprRaw = lexed.comma_args.slice(1).join(',').trim();
      const labelAST = LabelExpressionEvaluator.parse(exprRaw);

      return {
        verb: 'label',
        raw_input: raw,
        command_type: 'label',
        positional_args: [selQuery, exprRaw],
        named_args: {},
        selection_query: selQuery,
        label_expression: labelAST
      };
    }

    // 6. SPECTRUM: spectrum [prop] [, palette] [, selection]
    if (verb === 'spectrum') {
      let prop = 'b';
      let palette = 'rainbow';
      let selQuery = 'all';

      if (lexed.comma_args.length >= 3) {
        prop = lexed.comma_args[0].trim() || 'b';
        palette = lexed.comma_args[1].trim() || 'rainbow';
        selQuery = lexed.comma_args.slice(2).join(',').trim() || 'all';
      } else if (lexed.comma_args.length === 2) {
        prop = lexed.comma_args[0].trim() || 'b';
        palette = lexed.comma_args[1].trim() || 'rainbow';
      } else if (lexed.comma_args.length === 1 && lexed.comma_args[0]) {
        prop = lexed.comma_args[0].trim();
      }

      return {
        verb: 'spectrum',
        raw_input: raw,
        command_type: 'spectrum',
        positional_args: [prop, palette, selQuery],
        named_args: {},
        selection_query: selQuery,
        spectrum_args: {
          property: prop,
          palette: palette,
          selection: selQuery
        }
      };
    }

    // 7. MEASUREMENT & ANALYSIS VERBS
    const measurementVerbs = ['distance', 'dist', 'angle', 'dihedral'];
    if (measurementVerbs.includes(verb)) {
      return {
        verb,
        raw_input: raw,
        command_type: 'measurement',
        positional_args: lexed.comma_args,
        named_args: {}
      };
    }

    const analysisVerbs = [
      'polar_contacts', 'salt_bridges', 'pi_stack',
      'cation_pi', 'halogen_bonds', 'hydrophobic_contacts'
    ];
    if (analysisVerbs.includes(verb)) {
      return {
        verb,
        raw_input: raw,
        command_type: 'analysis',
        positional_args: lexed.comma_args,
        named_args: {}
      };
    }

    // 8. EDITING & HISTORY VERBS
    const historyVerbs = ['undo', 'redo', 'history'];
    if (historyVerbs.includes(verb)) {
      return {
        verb,
        raw_input: raw,
        command_type: 'history',
        positional_args: [],
        named_args: {}
      };
    }

    const hydrogenVerbs = ['h_add', 'hadd', 'add_h', 'h_fill', 'hfill', 'fill_h', 'h_remove', 'remove_h', 'del_h', 'hdel', 'h_del'];
    if (hydrogenVerbs.includes(verb)) {
      return {
        verb,
        raw_input: raw,
        command_type: 'editing',
        positional_args: [lexed.args_raw.trim()],
        named_args: {},
        selection_query: lexed.args_raw.trim() || 'all'
      };
    }

    const editVerbs = ['bond', 'unbond', 'order', 'set_bond_order', 'cycle_valence', 'alter', 'alter_state', 'remove', 'del_atoms'];
    if (editVerbs.includes(verb)) {
      return {
        verb,
        raw_input: raw,
        command_type: 'editing',
        positional_args: lexed.comma_args,
        named_args: {}
      };
    }

    // SQ3. GLOBAL SETTINGS: set, unset, bg_color
    if (verb === 'set' || verb === 'unset' || verb === 'bg_color') {
      const settingName = lexed.comma_args[0]?.trim() || lexed.args_raw.split(/\s+/)[0] || '';
      const settingValue = lexed.comma_args[1]?.trim() || lexed.args_raw.split(/\s+/).slice(1).join(' ') || undefined;
      const settingSelection = lexed.comma_args[2]?.trim() || undefined;
      if (!settingName) throw new Error(`Command syntax error: '${verb}' requires a setting name`);
      return {
        verb,
        raw_input: raw,
        command_type: 'set',
        positional_args: lexed.comma_args,
        named_args: {},
        setting_args: { name: settingName, value: settingValue, selection: settingSelection }
      };
    }


    // SQ3. FETCH: fetch <pdb_id>
    if (verb === 'fetch') {
      const pdbId = lexed.args_raw.trim().split(/[\s,]+/)[0];
      if (!pdbId) throw new Error("Command syntax error: 'fetch' requires a PDB ID (e.g. 'fetch 4HHB')");
      return {
        verb: 'fetch',
        raw_input: raw,
        command_type: 'fetch',
        positional_args: [pdbId],
        named_args: {},
        fetch_args: { pdbId }
      };
    }

    // 9. Pure selection query fallback
    return {
      verb: 'query',
      raw_input: raw,
      command_type: 'query',
      positional_args: [raw],
      named_args: {},
      selection_query: raw
    };
  }
}
