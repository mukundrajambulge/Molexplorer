/**
 * CommandAST.ts
 * Authoritative Typed Command Abstract Syntax Tree for Phase SQ2.
 */

export type CommandType =
  | 'selection_lifecycle'
  | 'color'
  | 'representation'
  | 'view'
  | 'label'
  | 'spectrum'
  | 'measurement'
  | 'analysis'
  | 'editing'
  | 'history'
  | 'query';

export type LabelExpressionNode =
  | { type: 'property'; property: 'name' | 'resn' | 'resi' | 'chain' | 'elem' | 'b' | 'q' | 'formal_charge' | 'id' | 'index' | 'rank' }
  | { type: 'literal'; value: string }
  | { type: 'concat'; parts: LabelExpressionNode[] }
  | { type: 'format_template'; template: string; args: LabelExpressionNode[] };

export interface CommandASTNode {
  verb: string;
  raw_input: string;
  command_type: CommandType;
  positional_args: string[];
  named_args: Record<string, string>;
  selection_query?: string;
  target_name?: string;
  color_value?: string;
  representation_value?: string;
  label_expression?: LabelExpressionNode;
  spectrum_args?: {
    property: string;
    palette?: string;
    selection?: string;
    min?: number;
    max?: number;
  };
  editing_args?: any;
}
