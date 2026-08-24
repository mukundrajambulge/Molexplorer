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

    // 2. COLORING: color, colour, set_color, recolor
    if (verb === 'color' || verb === 'colour' || verb === 'set_color' || verb === 'recolor') {
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

    // 3. REPRESENTATION: show, hide, show_as
    if (verb === 'show' || verb === 'hide' || verb === 'show_as') {
      if (!lexed.args_raw.trim()) {
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

      const validatedRep = RepresentationRegistry.validate(repVal);

      return {
        verb,
        raw_input: raw,
        command_type: 'representation',
        positional_args: [validatedRep, selQuery],
        named_args: {},
        representation_value: validatedRep,
        selection_query: selQuery
      };
    }

    // 4. VIEW / CAMERA: zoom, center, orient
    if (verb === 'zoom' || verb === 'center' || verb === 'orient') {
      const selQuery = lexed.args_raw.trim() || 'all';
      return {
        verb,
        raw_input: raw,
        command_type: 'view',
        positional_args: [selQuery],
        named_args: {},
        selection_query: selQuery
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
