/**
 * CommandLexer.ts
 * Robust Command Lexer for Phase SQ2 supporting semicolon chaining,
 * quotes, nested parentheses, and comma-separated arguments.
 */

export interface LexedCommand {
  raw_input: string;
  verb: string;
  args_raw: string;
  comma_args: string[];
}

export class CommandLexer {
  /**
   * Splits a multi-command script by semicolons (;) respecting parentheses and quotes.
   */
  static splitCommandSequences(input: string): string[] {
    const raw = input.trim();
    if (!raw) return [];

    const commands: string[] = [];
    let current = '';
    let parenDepth = 0;
    let inSingleQuote = false;
    let inDoubleQuote = false;

    for (let i = 0; i < raw.length; i++) {
      const char = raw[i];

      if (char === "'" && !inDoubleQuote) {
        inSingleQuote = !inSingleQuote;
        current += char;
        continue;
      }

      if (char === '"' && !inSingleQuote) {
        inDoubleQuote = !inDoubleQuote;
        current += char;
        continue;
      }

      if (!inSingleQuote && !inDoubleQuote) {
        if (char === '(') parenDepth++;
        else if (char === ')' && parenDepth > 0) parenDepth--;
        else if (char === ';' && parenDepth === 0) {
          if (current.trim()) {
            commands.push(current.trim());
          }
          current = '';
          continue;
        }
      }

      current += char;
    }

    if (current.trim()) {
      commands.push(current.trim());
    }

    return commands;
  }

  /**
   * Splits command argument string by commas respecting parentheses and quotes.
   */
  static splitCommaArgs(argsString: string): string[] {
    const raw = argsString.trim();
    if (!raw) return [];

    const args: string[] = [];
    let current = '';
    let parenDepth = 0;
    let inSingleQuote = false;
    let inDoubleQuote = false;

    for (let i = 0; i < raw.length; i++) {
      const char = raw[i];

      if (char === "'" && !inDoubleQuote) {
        inSingleQuote = !inSingleQuote;
        current += char;
        continue;
      }

      if (char === '"' && !inSingleQuote) {
        inDoubleQuote = !inDoubleQuote;
        current += char;
        continue;
      }

      if (!inSingleQuote && !inDoubleQuote) {
        if (char === '(') parenDepth++;
        else if (char === ')' && parenDepth > 0) parenDepth--;
        else if (char === ',' && parenDepth === 0) {
          args.push(current.trim());
          current = '';
          continue;
        }
      }

      current += char;
    }

    if (current.trim()) {
      args.push(current.trim());
    }

    return args;
  }

  /**
   * Lexes a single command line into verb and argument list.
   */
  static lexSingleCommand(commandLine: string): LexedCommand {
    const raw = commandLine.trim();
    if (!raw) {
      return { raw_input: '', verb: '', args_raw: '', comma_args: [] };
    }

    // Identify first word / verb
    const match = raw.match(/^([a-zA-Z0-9_\-\.\/]+)(.*)$/);
    if (!match) {
      return { raw_input: raw, verb: '', args_raw: '', comma_args: [] };
    }

    const verb = match[1];
    let remainder = (match[2] || '').trim();

    // If remainder starts with comma, strip leading comma
    if (remainder.startsWith(',')) {
      remainder = remainder.slice(1).trim();
    }

    const commaArgs = this.splitCommaArgs(remainder);

    return {
      raw_input: raw,
      verb: verb.toLowerCase(),
      args_raw: remainder,
      comma_args: commaArgs
    };
  }
}
