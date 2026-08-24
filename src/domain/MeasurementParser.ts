/**
 * MeasurementParser.ts
 * Dedicated syntactic and semantic parser for scientific measurements and biophysical analysis commands.
 * 
 * Formally separated from SelectionParser to maintain clean grammar boundaries:
 * - SelectionParser parses Boolean atom-property predicates.
 * - MeasurementParser parses distance, angle, dihedral, and interaction analysis commands.
 */

export interface ParsedDistanceCommand {
  type: 'distance';
  name?: string;
  selection1: string;
  selection2: string;
  mode?: number;
  cutoff?: number;
  rawQuery: string;
}

export interface ParsedAngleCommand {
  type: 'angle';
  name?: string;
  selection1: string;
  selection2: string; // vertex
  selection3: string;
  rawQuery: string;
}

export interface ParsedDihedralCommand {
  type: 'dihedral';
  name?: string;
  selection1: string;
  selection2: string;
  selection3: string;
  selection4: string;
  rawQuery: string;
}

export interface ParsedAnalysisCommand {
  type: 'analysis';
  analysisType: 'polar_contacts' | 'salt_bridges' | 'pi_stack' | 'cation_pi' | 'halogen_bonds' | 'hydrophobic_contacts';
  name?: string;
  selection1?: string;
  selection2?: string;
  cutoff?: number;
  rawQuery: string;
}

export type MeasurementCommandAST =
  | ParsedDistanceCommand
  | ParsedAngleCommand
  | ParsedDihedralCommand
  | ParsedAnalysisCommand;

export class MeasurementParser {
  /**
   * Splits a comma-separated argument list while respecting balanced parentheses.
   */
  static splitArguments(input: string): string[] {
    const args: string[] = [];
    let depth = 0;
    let current = '';

    for (let i = 0; i < input.length; i++) {
      const char = input[i];
      if (char === '(') depth++;
      else if (char === ')') depth--;

      if (char === ',' && depth === 0) {
        if (current.trim()) args.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }

    if (depth !== 0) {
      throw new Error(`Measurement syntax error: unmatched parenthesis in argument list "${input}"`);
    }

    if (current.trim()) {
      args.push(current.trim());
    }

    return args;
  }

  /**
   * Extracts trailing key=value parameters (e.g. mode=2, cutoff=3.5).
   */
  private static extractParameters(args: string[]): { positional: string[]; params: Record<string, any> } {
    const positional: string[] = [];
    const params: Record<string, any> = {};

    for (const arg of args) {
      const kvMatch = arg.match(/^([a-zA-Z_][a-zA-Z0-9_]*)\s*=\s*(.+)$/);
      if (kvMatch) {
        const key = kvMatch[1].toLowerCase();
        const valStr = kvMatch[2].trim();
        const numVal = parseFloat(valStr);
        params[key] = isNaN(numVal) ? valStr : numVal;
      } else {
        positional.push(arg);
      }
    }

    return { positional, params };
  }

  /**
   * Parses a raw measurement or analysis command string into a structured AST.
   */
  static parse(query: string): MeasurementCommandAST {
    const qTrim = query.trim();
    if (!qTrim) {
      throw new Error("Measurement syntax error: empty measurement command");
    }

    const firstSpace = qTrim.search(/\s/);
    const commandVerb = (firstSpace === -1 ? qTrim : qTrim.slice(0, firstSpace)).toLowerCase();
    const rest = firstSpace === -1 ? '' : qTrim.slice(firstSpace).trim();

    // 1. Distance Command
    if (commandVerb === 'distance' || commandVerb === 'dist') {
      return this.parseDistance(rest, qTrim);
    }

    // 2. Angle Command
    if (commandVerb === 'angle' || commandVerb === 'get_angle') {
      return this.parseAngle(rest, qTrim);
    }

    // 3. Dihedral Command
    if (commandVerb === 'dihedral' || commandVerb === 'get_dihedral') {
      return this.parseDihedral(rest, qTrim);
    }

    // 4. Interaction Analysis Commands
    const analysisKeywords = [
      'polar_contacts', 'salt_bridges', 'pi_stack',
      'cation_pi', 'halogen_bonds', 'hydrophobic_contacts'
    ];
    if (analysisKeywords.includes(commandVerb)) {
      return this.parseAnalysis(commandVerb as any, rest, qTrim);
    }

    throw new Error(`Measurement syntax error: unknown measurement or analysis command '${commandVerb}'`);
  }

  private static parseDistance(rest: string, rawQuery: string): ParsedDistanceCommand {
    if (!rest) {
      throw new Error("Measurement syntax error: distance command requires at least 2 selection expressions (e.g. 'distance d1, sel1, sel2')");
    }

    const rawArgs = this.splitArguments(rest);
    const { positional, params } = this.extractParameters(rawArgs);

    let name: string | undefined;
    let selection1: string;
    let selection2: string;

    if (positional.length === 3) {
      name = positional[0];
      selection1 = positional[1];
      selection2 = positional[2];
    } else if (positional.length === 2) {
      selection1 = positional[0];
      selection2 = positional[1];
    } else if (positional.length === 1) {
      throw new Error("Measurement syntax error: distance command requires 2 selections (got only 1)");
    } else {
      throw new Error(`Measurement syntax error: distance command expects 2 or 3 positional arguments (got ${positional.length})`);
    }

    if (!selection1) throw new Error("Measurement syntax error: empty selection1 expression in distance command");
    if (!selection2) throw new Error("Measurement syntax error: empty selection2 expression in distance command");

    return {
      type: 'distance',
      name,
      selection1,
      selection2,
      mode: params.mode !== undefined ? Number(params.mode) : undefined,
      cutoff: params.cutoff !== undefined ? Number(params.cutoff) : undefined,
      rawQuery
    };
  }

  private static parseAngle(rest: string, rawQuery: string): ParsedAngleCommand {
    if (!rest) {
      throw new Error("Measurement syntax error: angle command requires 3 selection expressions (e.g. 'angle a1, sel1, vertex, sel3')");
    }

    const rawArgs = this.splitArguments(rest);
    const { positional } = this.extractParameters(rawArgs);

    let name: string | undefined;
    let selection1: string;
    let selection2: string;
    let selection3: string;

    if (positional.length === 4) {
      name = positional[0];
      selection1 = positional[1];
      selection2 = positional[2];
      selection3 = positional[3];
    } else if (positional.length === 3) {
      selection1 = positional[0];
      selection2 = positional[1];
      selection3 = positional[2];
    } else {
      throw new Error(`Measurement syntax error: angle command requires 3 selections (terminal 1, vertex, terminal 2), optionally prefixed by name (got ${positional.length})`);
    }

    return {
      type: 'angle',
      name,
      selection1,
      selection2,
      selection3,
      rawQuery
    };
  }

  private static parseDihedral(rest: string, rawQuery: string): ParsedDihedralCommand {
    if (!rest) {
      throw new Error("Measurement syntax error: dihedral command requires 4 selection expressions (e.g. 'dihedral d1, sel1, sel2, sel3, sel4')");
    }

    const rawArgs = this.splitArguments(rest);
    const { positional } = this.extractParameters(rawArgs);

    let name: string | undefined;
    let selection1: string;
    let selection2: string;
    let selection3: string;
    let selection4: string;

    if (positional.length === 5) {
      name = positional[0];
      selection1 = positional[1];
      selection2 = positional[2];
      selection3 = positional[3];
      selection4 = positional[4];
    } else if (positional.length === 4) {
      selection1 = positional[0];
      selection2 = positional[1];
      selection3 = positional[2];
      selection4 = positional[3];
    } else {
      throw new Error(`Measurement syntax error: dihedral command requires 4 selections defining a torsional angle, optionally prefixed by name (got ${positional.length})`);
    }

    return {
      type: 'dihedral',
      name,
      selection1,
      selection2,
      selection3,
      selection4,
      rawQuery
    };
  }

  private static parseAnalysis(
    analysisType: ParsedAnalysisCommand['analysisType'],
    rest: string,
    rawQuery: string
  ): ParsedAnalysisCommand {
    if (!rest) {
      // Default: analyze all vs all or ligand vs receptor
      return {
        type: 'analysis',
        analysisType,
        selection1: 'resn LIG or hetatm',
        selection2: 'not (resn LIG or hetatm)',
        rawQuery
      };
    }

    const rawArgs = this.splitArguments(rest);
    const { positional, params } = this.extractParameters(rawArgs);

    let selection1 = 'all';
    let selection2 = 'all';

    if (positional.length === 2) {
      selection1 = positional[0];
      selection2 = positional[1];
    } else if (positional.length === 1) {
      selection1 = positional[0];
      selection2 = 'all';
    }

    return {
      type: 'analysis',
      analysisType,
      selection1,
      selection2,
      cutoff: params.cutoff !== undefined ? Number(params.cutoff) : undefined,
      rawQuery
    };
  }
}

