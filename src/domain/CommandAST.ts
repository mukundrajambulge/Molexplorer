/**
 * CommandAST.ts
 * Authoritative Typed Command Abstract Syntax Tree for Phase SQ2/SQ3.
 */

export type CommandType =
  | 'selection_lifecycle'
  | 'color'
  | 'representation'
  | 'view'
  | 'label'
  | 'spectrum'
  | 'set'
  | 'fetch'
  | 'measurement'
  | 'analysis'
  | 'editing'
  | 'history'
  | 'query';

/** SQ3: explicit camera operation kinds */
export type CameraOperation = 'zoom' | 'center' | 'orient';

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
  /** SQ3: typed camera operation */
  camera_operation?: CameraOperation;
  /** SQ3: set/unset global settings */
  setting_args?: {
    name: string;
    value?: string;
    selection?: string;
  };
  /** SQ3: fetch PDB ID */
  fetch_args?: {
    pdbId: string;
  };
  editing_args?: any;
}
