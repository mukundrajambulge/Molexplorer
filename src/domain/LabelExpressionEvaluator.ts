/**
 * LabelExpressionEvaluator.ts
 * Sandboxed, Allow-Listed AST Parser and Evaluator for Label Expressions (Phase SQ2).
 * 
 * STRICT SECURITY INVARIANT:
 * Zero eval(), zero new Function(), zero arbitrary JavaScript/Python execution.
 */

import { Atom } from '../lib/SelectionParser';
import { CanonicalAtom } from '../types/domain';
import { LabelExpressionNode } from './CommandAST';

const ALLOWED_PROPERTIES = [
  'name',
  'resn',
  'resi',
  'chain',
  'elem',
  'b',
  'q',
  'formal_charge',
  'id',
  'index',
  'rank'
] as const;

type AllowedProperty = typeof ALLOWED_PROPERTIES[number];

export class LabelExpressionEvaluator {
  /**
   * Parses a raw label expression string into a safe, allow-listed LabelExpression AST.
   */
  static parse(expressionStr: string): LabelExpressionNode {
    const raw = (expressionStr || '').trim();
    if (!raw) {
      throw new Error("Label expression error: missing expression after selection");
    }

    // Check for PyMOL format string: "%s-%s" % (resn, resi) or "%s %s" % (chain, resi)
    const fmtMatch = raw.match(/^["'](.*?)["']\s*%\s*\((.*?)\)$/);
    if (fmtMatch) {
      const template = fmtMatch[1];
      const argsRaw = fmtMatch[2].split(',').map(s => s.trim()).filter(Boolean);
      const args: LabelExpressionNode[] = argsRaw.map(arg => {
        const propLower = arg.toLowerCase() as AllowedProperty;
        if (!ALLOWED_PROPERTIES.includes(propLower)) {
          throw new Error(`Label expression error: property '${arg}' is not allow-listed. Allowed properties: ${ALLOWED_PROPERTIES.join(', ')}`);
        }
        return { type: 'property', property: propLower };
      });
      return { type: 'format_template', template, args };
    }

    // Check for quoted literal: "My Label" or 'Active Site'
    if ((raw.startsWith('"') && raw.endsWith('"')) || (raw.startsWith("'") && raw.endsWith("'"))) {
      return { type: 'literal', value: raw.slice(1, -1) };
    }

    // Check for + concatenation: resn + " " + resi or resn + resi
    if (raw.includes('+')) {
      const partsRaw = raw.split('+').map(s => s.trim()).filter(Boolean);
      const parts: LabelExpressionNode[] = partsRaw.map(p => this.parse(p));
      return { type: 'concat', parts };
    }

    // Check single property
    const propLower = raw.toLowerCase() as AllowedProperty;
    if (ALLOWED_PROPERTIES.includes(propLower)) {
      return { type: 'property', property: propLower };
    }

    throw new Error(`Label expression error: invalid label expression '${raw}'. Allowed properties: ${ALLOWED_PROPERTIES.join(', ')}`);
  }

  /**
   * Evaluates a LabelExpression AST node against a single atom.
   */
  static evaluate(node: LabelExpressionNode, atom: Atom | CanonicalAtom): string {
    switch (node.type) {
      case 'literal':
        return node.value;

      case 'property': {
        const prop = node.property;
        if ('canonical_id' in atom) {
          const ca = atom as CanonicalAtom;
          switch (prop) {
            case 'name': return ca.name.trim();
            case 'resn': return ca.residue_name.trim();
            case 'resi': return String(ca.residue_ref);
            case 'chain': return ca.chain_ref;
            case 'elem': return ca.element;
            case 'b': return String(ca.b_factor ?? 0);
            case 'q': return String(ca.occupancy ?? 1);
            case 'formal_charge': return String(ca.formal_charge ?? 0);
            case 'id': return String(ca.canonical_id);
            case 'index': return String(ca.canonical_id - 1);
            case 'rank': return String(ca.canonical_id);
          }
        } else {
          const a = atom as Atom;
          switch (prop) {
            case 'name': return a.name.trim();
            case 'resn': return (a.resName || '').trim();
            case 'resi': return String(a.resSeq);
            case 'chain': return a.chainID || '';
            case 'elem': return a.elem || '';
            case 'b': return String(a.bFactor ?? 0);
            case 'q': return String(a.occupancy ?? 1);
            case 'formal_charge': return String(a.formalCharge ?? 0);
            case 'id': return String(a.serial);
            case 'index': return String(a.index ?? a.serial - 1);
            case 'rank': return String(a.rank ?? a.serial);
          }
        }
        return '';
      }

      case 'concat':
        return node.parts.map(p => this.evaluate(p, atom)).join('');

      case 'format_template': {
        const evaluatedArgs = node.args.map(a => this.evaluate(a, atom));
        let res = node.template;
        for (const val of evaluatedArgs) {
          res = res.replace(/%s|%d|%f/, val);
        }
        return res;
      }
    }
  }
}
