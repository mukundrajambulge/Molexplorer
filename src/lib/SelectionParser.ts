import { CanonicalAtom, CanonicalMolecule, CanonicalMolecularDocument, SelectionResult, ScopedSelectionResult, ResidueClassification } from '../types/domain';
import { CanonicalSelectionEvaluator } from '../domain/CanonicalSelectionEvaluator';

// Minimal Atom interface corresponding to MolProcessor structures
export interface Atom {
  serial: number;
  elem: string;
  name: string;
  resName: string;
  resSeq: number;
  chainID: string;
  bonds: number[];
  x: number;
  y: number;
  z: number;
  occupancy?: number;
  bFactor?: number;
  altLoc?: string;
  isHetero?: boolean;
  ss?: string;
  formalCharge?: number;
  index?: number;
  rank?: number;
  model?: string;
  segi?: string;
  resClassification?: ResidueClassification;
}

class SpatialHashGrid {
  cellSize: number;
  grid: Map<number, { x: number; y: number; z: number }[]>;

  constructor(cellSize: number, atoms: Atom[], targetSerials: Set<number>) {
    this.cellSize = Math.max(cellSize, 0.1);
    this.grid = new Map();

    if (targetSerials.size === 0) return;

    for (let i = 0; i < atoms.length; i++) {
      const atom = atoms[i];
      if (targetSerials.has(atom.serial)) {
        const cx = Math.floor(atom.x / this.cellSize);
        const cy = Math.floor(atom.y / this.cellSize);
        const cz = Math.floor(atom.z / this.cellSize);
        const hash = (((cx * 73856093) ^ (cy * 19349663) ^ (cz * 83492791)) & 0x7fffffff);
        let list = this.grid.get(hash);
        if (!list) {
          list = [];
          this.grid.set(hash, list);
        }
        list.push({ x: atom.x, y: atom.y, z: atom.z });
      }
    }
  }

  isNear(x: number, y: number, z: number): boolean {
    if (this.grid.size === 0) return false;
    const cx = Math.floor(x / this.cellSize);
    const cy = Math.floor(y / this.cellSize);
    const cz = Math.floor(z / this.cellSize);
    const r2 = this.cellSize * this.cellSize;

    for (let dx = -1; dx <= 1; dx++) {
      const ncx = (cx + dx) * 73856093;
      for (let dy = -1; dy <= 1; dy++) {
        const ncy = (cy + dy) * 19349663;
        for (let dz = -1; dz <= 1; dz++) {
          const hash = ((ncx ^ ncy ^ ((cz + dz) * 83492791)) & 0x7fffffff);
          const points = this.grid.get(hash);
          if (points) {
            for (let i = 0; i < points.length; i++) {
              const p = points[i];
              const rx = x - p.x;
              const ry = y - p.y;
              const rz = z - p.z;
              if (rx * rx + ry * ry + rz * rz <= r2) {
                return true;
              }
            }
          }
        }
      }
    }
    return false;
  }
}

export const STANDARD_AMINO_ACIDS = new Set<string>([
  'ALA', 'ARG', 'ASN', 'ASP', 'CYS', 'GLN', 'GLU', 'GLY', 'HIS', 'ILE',
  'LEU', 'LYS', 'MET', 'PHE', 'PRO', 'SER', 'THR', 'TRP', 'TYR', 'VAL',
  'MSE', 'SEC', 'PYL', 'HYP'
]);

export const STANDARD_NUCLEIC_ACIDS = new Set<string>([
  'A', 'C', 'G', 'T', 'U', 'DA', 'DC', 'DG', 'DT', 'DU',
  '+A', '+C', '+G', '+T', '+U', 'RA', 'RC', 'RG', 'RU'
]);

export const SOLVENT_NAMES = new Set<string>([
  'HOH', 'WAT', 'DOD', 'SOL', 'TIP', 'TIP3', 'TIP4', 'SPC'
]);

export const ION_NAMES = new Set<string>([
  'NA', 'K', 'MG', 'CA', 'ZN', 'FE', 'CL', 'BR', 'MN', 'CO', 'NI', 'CU',
  'LI', 'CS', 'RB', 'SR', 'BA', 'CD', 'HG', 'PB', 'I', 'F', 'SO4', 'PO4', 'NO3'
]);

export const METAL_ELEMENTS = new Set<string>([
  'MG', 'ZN', 'FE', 'CA', 'NA', 'K', 'CU', 'MN', 'NI', 'CO', 'CD', 'HG', 'PT', 'AU', 'AG', 'LI', 'CS', 'RB', 'SR', 'BA', 'PB'
]);

export function isSolvent(atom: Atom): boolean {
  if (atom.resClassification === 'solvent') return true;
  const name = (atom.resName || '').trim().toUpperCase();
  return SOLVENT_NAMES.has(name);
}

export function isIon(atom: Atom, atoms: Atom[]): boolean {
  if (atom.resClassification === 'ion') return true;
  const resName = (atom.resName || '').trim().toUpperCase();
  const elemUpper = (atom.elem || '').trim().toUpperCase();
  if (ION_NAMES.has(resName)) return true;
  if (atom.isHetero && METAL_ELEMENTS.has(elemUpper)) {
    const resAtoms = atoms.filter(a => a.chainID === atom.chainID && a.resSeq === atom.resSeq);
    if (resAtoms.length <= 2) return true;
  }
  return false;
}

function hasCarbons(atom: Atom, atoms: Atom[]): boolean {
  return atoms.some(a => a.chainID === atom.chainID && a.resSeq === atom.resSeq && a.elem.toUpperCase() === 'C');
}

export interface SelectionMacroNode {
  type: 'macro';
  raw: string;
  model?: string;
  segi?: string;
  chain?: string;
  resi?: string;
  name?: string;
}

export class SelectionParser {
  atoms: Atom[];
  namedSelections: { name: string; query: string; atomIds?: number[] }[];
  private resolvingNamedSelections: Set<string> = new Set();

  constructor(
    atoms: Atom[],
    namedSelections: { name: string; query: string; atomIds?: number[] }[] = []
  ) {
    this.atoms = atoms.map((a, idx) => ({
      ...a,
      index: a.index !== undefined ? a.index : idx + 1,
      rank: a.rank !== undefined ? a.rank : idx
    }));
    this.namedSelections = namedSelections;
  }

  setNamedSelections(namedSelections: { name: string; query: string; atomIds?: number[] }[]) {
    this.namedSelections = namedSelections;
  }

  evaluateNamedSelection(name: string, expr?: any): Set<number> {
    const key = name.toLowerCase();
    if (this.resolvingNamedSelections.has(key)) {
      const cyclePath = Array.from(this.resolvingNamedSelections).concat(key).join(' -> ');
      throw new Error(`Selection syntax error: Cyclic named selection reference detected: '${cyclePath}'`);
    }

    if (expr && expr.atomIds !== undefined) {
      return new Set(expr.atomIds);
    }

    const match = this.namedSelections?.find(s => s.name.toLowerCase() === key);
    if (!match && !expr?.query) {
      throw new Error(`Selection syntax error: Unknown selection reference '${name}'`);
    }

    if (match && match.atomIds !== undefined) {
      return new Set(match.atomIds);
    }

    const queryToEval = expr?.query || match?.query;
    if (!queryToEval) {
      return new Set();
    }

    this.resolvingNamedSelections.add(key);
    try {
      return this.parse(queryToEval);
    } finally {
      this.resolvingNamedSelections.delete(key);
    }
  }

  /**
   * Constructs a SelectionParser instance from an array of CanonicalAtoms.
   * Enables selection algebra evaluation directly against canonical domain representations.
   */
  static fromCanonicalAtoms(
    canonicalAtoms: CanonicalAtom[],
    topology?: { adjacency_map: Map<number, number[]> },
    namedSelections: { name: string; query: string; atomIds?: number[] }[] = []
  ): SelectionParser {
    const idToIdx = new Map<number, number>();
    canonicalAtoms.forEach((a, idx) => idToIdx.set(a.canonical_id, idx));

    const parserAtoms: Atom[] = canonicalAtoms.map((ca, idx) => ({
      serial: ca.canonical_id,
      name: ca.name,
      resName: ca.residue_name,
      chainID: ca.chain_ref,
      resSeq: ca.residue_ref,
      x: ca.x,
      y: ca.y,
      z: ca.z,
      elem: ca.element,
      altLoc: ca.alt_loc,
      isHetero: ca.is_hetero,
      bonds: topology
        ? (topology.adjacency_map.get(ca.canonical_id) || []).map(nId => idToIdx.get(nId)!).filter(idx => idx !== undefined)
        : [],
      bFactor: ca.b_factor,
      occupancy: ca.occupancy,
      ss: ca.secondary_structure,
      formalCharge: ca.formal_charge,
      index: idx + 1,
      rank: idx,
      segi: ca.alt_loc
    }));
    return new SelectionParser(parserAtoms, namedSelections);
  }

  static fromCanonicalMolecule(
    molecule: CanonicalMolecule,
    namedSelections: { name: string; query: string; atomIds?: number[] }[] = []
  ): SelectionParser {
    const resMap = new Map<number, ResidueClassification>();
    if (molecule.residues) {
      for (const res of molecule.residues) {
        for (const aId of res.atom_ids) {
          resMap.set(aId, res.classification);
        }
      }
    }
    const idToIdx = new Map<number, number>();
    molecule.atoms.forEach((a, idx) => idToIdx.set(a.canonical_id, idx));

    const parserAtoms: Atom[] = molecule.atoms.map((ca, idx) => ({
      serial: ca.canonical_id,
      name: ca.name,
      resName: ca.residue_name,
      chainID: ca.chain_ref,
      resSeq: ca.residue_ref,
      x: ca.x,
      y: ca.y,
      z: ca.z,
      elem: ca.element,
      altLoc: ca.alt_loc,
      isHetero: ca.is_hetero,
      bonds: molecule.topology
        ? (molecule.topology.adjacency_map.get(ca.canonical_id) || []).map(nId => idToIdx.get(nId)!).filter(idx => idx !== undefined)
        : [],
      bFactor: ca.b_factor,
      occupancy: ca.occupancy,
      ss: ca.secondary_structure,
      formalCharge: ca.formal_charge,
      index: idx + 1,
      rank: idx,
      segi: ca.alt_loc,
      resClassification: resMap.get(ca.canonical_id)
    }));
    return new SelectionParser(parserAtoms, namedSelections);
  }

  /**
   * Evaluates a selection query directly against a CanonicalMolecule hierarchy,
   * returning an authoritative SelectionResult.
   */
  static evaluateCanonical(
    query: string,
    molecule: CanonicalMolecule,
    options?: { objectId?: string; stateId?: string; namedSelections?: { name: string; query: string; atomIds?: number[] }[] }
  ): SelectionResult {
    const evaluator = new CanonicalSelectionEvaluator(molecule, options);
    return evaluator.evaluateQuery(query, options);
  }

  /**
   * Evaluates a selection query across a CanonicalMolecularDocument workspace,
   * supporting active_object, explicit_object, and workspace scopes.
   */
  static evaluateDocument(
    query: string,
    document: CanonicalMolecularDocument,
    scope?: {
      scopeType?: 'active_object' | 'explicit_object' | 'workspace';
      objectId?: string;
      stateId?: string;
    }
  ): ScopedSelectionResult {
    return CanonicalSelectionEvaluator.evaluateDocument(document, query, scope);
  }

  parse(query: string, namedSelections?: { name: string; query: string; atomIds?: number[] }[]): Set<number> {
    if (namedSelections) {
      this.namedSelections = namedSelections;
    }
    const qTrim = query.trim();
    if (!qTrim) return new Set();
    const tokens = this.tokenize(qTrim);
    if (tokens.length === 0) {
      throw new Error(`Syntax error: empty selection query "${query}"`);
    }
    const expr = this.buildExpression(tokens);
    return this.evaluate(expr);
  }

  tokenize(query: string): string[] {
    // Regex matches words, slash macros, comparisons, operators, and parenthetical delimiters
    const tokenRegex = /\/[a-zA-Z0-9_\-\*\.\+\:\,\/]+|\b(and|or|not|byres|bychain|bymolecule|bycalpha|byca|byring|byobject|bysegi|byfragment|bycell|neighbor|bound_to|extend|expand|around|within|beyond|of|resn|res|resi|resv|chain|elem|element|symbol|name|atom|b|bfactor|q|occupancy|formal_charge|fc|id|index|rank|alt|altloc|segi|segid|ss|first|last|metals?|donors?|acceptors?|polymer\.protein|polymer\.nucleic|polymer|protein|nucleic|backbone|sidechain|organic|inorganic|ligands?|ions?|solvent|waters?|hetatm|het|hydrogens?|hydro|h|guide|visible|enabled|all|none)\b|<=|>=|==|!=|<|>|=|\(|\)|&|\||!|[a-zA-Z0-9_\-\*\.\+\:\,]+/gi;
    return query.match(tokenRegex) || [];
  }

  buildExpression(tokens: string[]): any {
    let pos = 0;

    // Helper to parse slash macros: /[model]/[segi]/[chain]/[resi]/[name]
    const parseMacro = (rawToken: string): SelectionMacroNode => {
      let leadingSlashes = 0;
      while (leadingSlashes < rawToken.length && rawToken[leadingSlashes] === '/') {
        leadingSlashes++;
      }

      if (leadingSlashes === rawToken.length && leadingSlashes >= 4) {
        return { type: 'macro', raw: rawToken };
      }

      let model: string | undefined;
      let segi: string | undefined;
      let chain: string | undefined;
      let resi: string | undefined;
      let name: string | undefined;

      if (leadingSlashes === 1) {
        // Starts at slot 0: model
        const parts = rawToken.slice(1).split('/');
        model = parts[0] || undefined;
        segi = parts[1] || undefined;
        chain = parts[2] || undefined;
        resi = parts[3] || undefined;
        name = parts[4] || undefined;
      } else if (leadingSlashes === 2) {
        // Starts at slot 2: chain (skips model and segi)
        const parts = rawToken.slice(2).split('/');
        chain = parts[0] || undefined;
        resi = parts[1] || undefined;
        name = parts[2] || undefined;
      } else if (leadingSlashes === 3) {
        // Starts at slot 3: resi (skips model, segi, chain)
        const parts = rawToken.slice(3).split('/');
        resi = parts[0] || undefined;
        name = parts[1] || undefined;
      } else if (leadingSlashes === 4) {
        // Starts at slot 4: name (skips model, segi, chain, resi)
        const parts = rawToken.slice(4).split('/');
        name = parts[0] || undefined;
      }

      return {
        type: 'macro',
        raw: rawToken,
        model: model === '*' ? undefined : model,
        segi: segi === '*' ? undefined : segi,
        chain: chain === '*' ? undefined : chain,
        resi: resi === '*' ? undefined : resi,
        name: name === '*' ? undefined : name
      };
    };

    // Level 1: or, |, and implicit whitespace juxtaposition (DisjunctionOperator)
    const parseDisjunction = (): any => {
      let left = parseConjunction();
      while (pos < tokens.length && tokens[pos] !== ')') {
        const tok = tokens[pos].toLowerCase();
        if (tok === 'or' || tok === '|') {
          pos++;
          const right = parseConjunction();
          if (!right) throw new Error("Syntax error: missing expression after 'or'");
          left = { type: 'or', left, right };
        } else {
          // Implicit whitespace juxtaposition = OR per PyMOL selection algebra
          const right = parseConjunction();
          if (!right) break;
          left = { type: 'or', left, right };
        }
      }
      return left;
    };

    // Level 2: and, & (Explicit intersection)
    const parseConjunction = (): any => {
      let left = parseSpatialPostfix();
      while (pos < tokens.length && (tokens[pos]?.toLowerCase() === 'and' || tokens[pos] === '&')) {
        pos++;
        const right = parseSpatialPostfix();
        if (!right) throw new Error("Syntax error: missing expression after 'and'");
        left = { type: 'and', left, right };
      }
      return left;
    };

    // Spatial postfix operators: <expr> around <d>, <expr> within <d>, <expr> beyond <d>, <expr> expand <d>
    const parseSpatialPostfix = (): any => {
      let expr = parseUnary();
      while (pos < tokens.length) {
        const tok = tokens[pos]?.toLowerCase();
        if (['around', 'within', 'beyond', 'expand'].includes(tok)) {
          pos++;
          const distStr = tokens[pos++];
          const dist = parseFloat(distStr);
          if (isNaN(dist)) throw new Error(`Syntax error: invalid distance for '${tok}' query`);
          expr = { type: tok, distance: dist, operand: expr };
        } else {
          break;
        }
      }
      return expr;
    };

    // Level 3: Unary operators (not, !, neighbor, bound_to, extend <N>, prefix within/around/beyond/expand, byres/bychain/...)
    const parseUnary = (): any => {
      if (pos >= tokens.length) return null;
      const currentToken = tokens[pos].toLowerCase();

      // Hierarchical prefix operators: byres, bychain, bymolecule, bycalpha, byca, byring, byobject, bysegi
      if (['byres', 'bychain', 'bymolecule', 'bycalpha', 'byca', 'byring', 'byobject', 'bysegi'].includes(currentToken)) {
        pos++;
        const operand = parseSpatialPostfix();
        if (!operand) throw new Error(`Syntax error: missing expression after '${currentToken}'`);
        const opType = currentToken === 'byca' ? 'bycalpha' : currentToken;
        return { type: opType, operand };
      }

      if (currentToken === 'byfragment') {
        throw new Error("Selection syntax error: 'byfragment' is currently DEFERRED / RESEARCH pending fragment partition specification. Use 'bymolecule' for covalent connected components.");
      }
      if (currentToken === 'bycell') {
        throw new Error("Selection syntax error: 'bycell' is currently DEFERRED / RESEARCH pending crystallographic symmetry infrastructure.");
      }

      if (currentToken === 'not' || currentToken === '!') {
        pos++;
        const operand = parseUnary();
        if (!operand) throw new Error("Syntax error: missing expression after 'not'");
        return { type: 'not', operand };
      }

      if (currentToken === 'neighbor') {
        pos++;
        const operand = parseUnary();
        if (!operand) throw new Error("Syntax error: missing expression after 'neighbor'");
        return { type: 'neighbor', operand };
      }

      if (currentToken === 'bound_to') {
        pos++;
        const operand = parseUnary();
        if (!operand) throw new Error("Syntax error: missing expression after 'bound_to'");
        return { type: 'bound_to', operand };
      }

      if (currentToken === 'extend') {
        pos++;
        const stepTok = tokens[pos++];
        const steps = parseInt(stepTok, 10);
        if (isNaN(steps) || steps < 1) {
          throw new Error(`Syntax error: invalid steps count '${stepTok}' for 'extend' query`);
        }
        if (tokens[pos]?.toLowerCase() === 'of') pos++; // skip 'of'
        const operand = parseUnary();
        if (!operand) throw new Error("Syntax error: missing expression after 'extend'");
        return { type: 'extend', steps, operand };
      }

      if (currentToken === 'around' || currentToken === 'within' || currentToken === 'beyond' || currentToken === 'expand') {
        pos++;
        const dist = parseFloat(tokens[pos++]);
        if (isNaN(dist)) throw new Error(`Syntax error: invalid distance for '${currentToken}' query`);
        if (tokens[pos]?.toLowerCase() === 'of') pos++; // skip 'of'
        const operand = parseUnary();
        if (!operand) throw new Error(`Syntax error: missing target expression after '${currentToken} ${dist}'`);
        return { type: currentToken, distance: dist, operand };
      }

      return parsePrimary();
    };

    // Level 4: Primary expressions (parentheses, macros, property selectors, comparisons, flags, named selections)
    const parsePrimary = (): any => {
      if (pos >= tokens.length) return null;
      const rawToken = tokens[pos];
      const currentToken = rawToken.toLowerCase();

      // Parentheses
      if (currentToken === '(') {
        pos++;
        const expr = parseDisjunction();
        if (pos >= tokens.length || tokens[pos] !== ')') {
          throw new Error("Syntax error: unmatched opening parenthesis '('");
        }
        pos++; // skip ')'
        return expr;
      }
      if (currentToken === ')') {
        throw new Error("Syntax error: unexpected closing parenthesis ')'");
      }

      // Selection macro (/model/segi/chain/resi/name)
      if (rawToken.startsWith('/') && rawToken.length > 1) {
        pos++;
        return parseMacro(rawToken);
      }

      // Check if this token matches a user-defined named selection first (unless reserved all/none)
      if (currentToken !== 'all' && currentToken !== 'none') {
        const namedMatch = this.namedSelections?.find(s => s.name.toLowerCase() === currentToken);
        if (namedMatch) {
          pos++;
          return {
            type: 'named_selection',
            name: namedMatch.name,
            query: namedMatch.query,
            atomIds: namedMatch.atomIds
          };
        }
      }

      // Global flag keywords & aliases
      const flagAliases: Record<string, string> = {
        'protein': 'polymer.protein',
        'nucleic': 'polymer.nucleic',
        'waters': 'solvent',
        'water': 'solvent',
        'hydro': 'hydrogens',
        'h': 'hydrogens',
        'donors': 'donor',
        'acceptors': 'acceptor',
        'ligands': 'ligand',
        'ions': 'ion',
        'metal': 'metals',
        'het': 'hetatm'
      };

      if ([
        'organic', 'inorganic', 'ligand', 'ligands', 'ion', 'ions', 'polymer', 'polymer.protein', 'polymer.nucleic', 'protein', 'nucleic',
        'backbone', 'sidechain', 'solvent', 'waters', 'water', 'hetatm', 'het', 'hydrogens', 'hydro', 'h', 'metals', 'metal',
        'donor', 'donors', 'acceptor', 'acceptors', 'guide', 'visible', 'enabled',
        'all', 'none', 'first', 'last'
      ].includes(currentToken)) {
        pos++;
        const resolvedFlag = flagAliases[currentToken] || currentToken;
        return { type: 'flag', flag: resolvedFlag };
      }

      // Property aliases normalization
      const propAliases: Record<string, string> = {
        'atom': 'name',
        'element': 'elem',
        'symbol': 'elem',
        'res': 'resn',
        'resv': 'resi',
        'segid': 'segi',
        'altloc': 'alt',
        'bfactor': 'b',
        'occupancy': 'q',
        'fc': 'formal_charge'
      };

      const normProp = propAliases[currentToken] || currentToken;
      const validProps = ['resn', 'resi', 'chain', 'elem', 'name', 'id', 'index', 'rank', 'b', 'q', 'ss', 'alt', 'segi', 'formal_charge'];

      if (!validProps.includes(normProp)) {
        throw new Error(`Unknown selection reference '${rawToken}'`);
      }

      pos++;
      const nextToken = tokens[pos];
      if (nextToken && ['<=', '>=', '==', '!=', '<', '>', '='].includes(nextToken)) {
        const op = tokens[pos++];
        const val = tokens[pos++];
        if (!val) throw new Error(`Syntax error: missing comparison value after '${normProp} ${op}'`);
        return { type: 'comparison', property: normProp, op, value: val };
      }

      const valList: string[] = [];
      const firstVal = tokens[pos++];
      if (!firstVal) throw new Error(`Syntax error: missing value for property '${normProp}'`);
      valList.push(firstVal);

      const STATEMENT_BOUNDARY_KEYWORDS = new Set([
        'and', 'or', 'not', '&', '|', '!', '(', ')',
        '<=', '>=', '==', '!=', '<', '>', '=',
        'byres', 'bychain', 'bymolecule', 'bycalpha', 'byca', 'byring', 'byobject', 'bysegi', 'byfragment', 'bycell',
        'neighbor', 'bound_to', 'extend', 'expand', 'around', 'within', 'beyond', 'of'
      ]);

      const MULTI_CHAR_PROPERTY_KEYWORDS = new Set([
        'resn', 'res', 'resi', 'resv', 'chain', 'elem', 'element', 'symbol', 'name', 'atom',
        'bfactor', 'occupancy', 'formal_charge', 'segid', 'altloc', 'segi', 'alt'
      ]);

      while (pos < tokens.length) {
        const candidate = tokens[pos];
        const candLower = candidate.toLowerCase();
        if (
          STATEMENT_BOUNDARY_KEYWORDS.has(candLower) ||
          candidate.startsWith('/') ||
          (MULTI_CHAR_PROPERTY_KEYWORDS.has(candLower) && pos + 1 < tokens.length) ||
          this.namedSelections?.some(s => s.name.toLowerCase() === candLower)
        ) {
          break;
        }
        valList.push(tokens[pos++]);
      }

      const val = valList.join('+');
      return { type: 'property', property: normProp, value: val };
    };

    const rootExpr = parseDisjunction();
    if (pos < tokens.length) {
      throw new Error(`Syntax error: unexpected trailing token '${tokens[pos]}'`);
    }
    return rootExpr;
  }

  evaluate(expr: any): Set<number> {
    if (!expr) return new Set();

    switch (expr.type) {
        case 'named_selection': {
            return this.evaluateNamedSelection(expr.name, expr);
        }
        case 'property': {
            const result = new Set<number>();
            this.atoms.forEach(atom => {
                if (this.matchProperty(atom, expr)) {
                    result.add(atom.serial);
                }
            });
            return result;
        }
        case 'comparison': {
            const result = new Set<number>();
            this.atoms.forEach(atom => {
                if (this.matchComparison(atom, expr)) {
                    result.add(atom.serial);
                }
            });
            return result;
        }
        case 'flag': {
            const result = new Set<number>();
            this.atoms.forEach(atom => {
                if (this.matchFlag(atom, expr.flag)) {
                    result.add(atom.serial);
                }
            });
            return result;
        }
        case 'and': {
            const s1 = this.evaluate(expr.left);
            const s2 = this.evaluate(expr.right);
            return new Set([...s1].filter(x => s2.has(x)));
        }
        case 'or': {
            const s3 = this.evaluate(expr.left);
            const s4 = this.evaluate(expr.right);
            return new Set([...s3, ...s4]);
        }
        case 'not': {
            const allSerials = new Set(this.atoms.map(a => a.serial));
            const s5 = this.evaluate(expr.operand);
            return new Set([...allSerials].filter(x => !s5.has(x)));
        }
        case 'byres': {
            const s6 = this.evaluate(expr.operand);
            const selectedAtoms = this.atoms.filter(a => s6.has(a.serial));
            const residueKeys = new Set(selectedAtoms.map(a => `${a.chainID}:${a.resSeq}`));
            const resultByres = new Set<number>();
            this.atoms.forEach(atom => {
                if (residueKeys.has(`${atom.chainID}:${atom.resSeq}`)) {
                    resultByres.add(atom.serial);
                }
            });
            return resultByres;
        }
        case 'bychain': {
            const sChain = this.evaluate(expr.operand);
            const selectedChains = new Set(this.atoms.filter(a => sChain.has(a.serial)).map(a => a.chainID));
            const resultBychain = new Set<number>();
            this.atoms.forEach(atom => {
                if (selectedChains.has(atom.chainID)) {
                    resultBychain.add(atom.serial);
                }
            });
            return resultBychain;
        }
        case 'bymolecule': {
            const sMolecule = this.evaluate(expr.operand);
            const visited = new Set<number>();
            const queue: number[] = [];

            this.atoms.forEach((atom, idx) => {
                if (sMolecule.has(atom.serial)) {
                    visited.add(idx);
                    queue.push(idx);
                }
            });

            while (queue.length > 0) {
                const currIdx = queue.shift()!;
                const atom = this.atoms[currIdx];
                if (atom && atom.bonds) {
                    atom.bonds.forEach(bondIdx => {
                        if (!visited.has(bondIdx)) {
                            visited.add(bondIdx);
                            queue.push(bondIdx);
                        }
                    });
                }
            }

            const resultBymol = new Set<number>();
            visited.forEach(idx => {
                const atom = this.atoms[idx];
                if (atom) resultBymol.add(atom.serial);
            });
            return resultBymol;
        }
        case 'neighbor': {
            const sNeighbor = this.evaluate(expr.operand);
            const resultNeighbor = new Set<number>();
            this.atoms.forEach(atom => {
                if (sNeighbor.has(atom.serial)) {
                    if (atom.bonds) {
                        atom.bonds.forEach(bondIdx => {
                            const bondedAtom = this.atoms[bondIdx];
                            if (bondedAtom && !sNeighbor.has(bondedAtom.serial)) {
                                resultNeighbor.add(bondedAtom.serial);
                            }
                        });
                    }
                }
            });
            return resultNeighbor;
        }
        case 'bound_to': {
            const sBound = this.evaluate(expr.operand);
            const resultBound = new Set<number>();
            this.atoms.forEach(atom => {
                if (sBound.has(atom.serial)) {
                    if (atom.bonds) {
                        atom.bonds.forEach(bondIdx => {
                            const bondedAtom = this.atoms[bondIdx];
                            if (bondedAtom) resultBound.add(bondedAtom.serial);
                        });
                    }
                }
            });
            return resultBound;
        }
        case 'bycalpha': {
            const sOperand = this.evaluate(expr.operand);
            const selectedAtoms = this.atoms.filter(a => sOperand.has(a.serial));
            const residueKeys = new Set(selectedAtoms.map(a => `${a.chainID}:${a.resSeq}`));
            const resultCA = new Set<number>();
            this.atoms.forEach(atom => {
                if (residueKeys.has(`${atom.chainID}:${atom.resSeq}`) && atom.name.trim().toUpperCase() === 'CA') {
                    resultCA.add(atom.serial);
                }
            });
            return resultCA;
        }
        case 'byring': {
            const sOperand = this.evaluate(expr.operand);
            const aromaticRes = ['PHE', 'TYR', 'TRP', 'HIS', 'PRO'];
            const aromaticNames: Record<string, string[]> = {
                PHE: ['CG', 'CD1', 'CD2', 'CE1', 'CE2', 'CZ'],
                TYR: ['CG', 'CD1', 'CD2', 'CE1', 'CE2', 'CZ'],
                HIS: ['CG', 'ND1', 'CD2', 'CE1', 'NE2'],
                TRP: ['CD2', 'CE2', 'CZ2', 'CH2', 'CZ3', 'CE3', 'CD1', 'NE1', 'CG'],
                PRO: ['N', 'CA', 'CB', 'CG', 'CD']
            };
            const resultRing = new Set<number>();
            const resGroups = new Map<string, Atom[]>();
            this.atoms.forEach(a => {
                const resn = (a.resName || '').toUpperCase();
                if (aromaticRes.includes(resn)) {
                    const key = `${a.chainID}:${a.resSeq}:${resn}`;
                    if (!resGroups.has(key)) resGroups.set(key, []);
                    resGroups.get(key)!.push(a);
                }
            });
            resGroups.forEach((resAtoms, key) => {
                const resn = key.split(':')[2];
                const validNames = aromaticNames[resn] || [];
                const ringAtoms = resAtoms.filter(a => validNames.includes(a.name.trim().toUpperCase()));
                if (ringAtoms.some(a => sOperand.has(a.serial))) {
                    ringAtoms.forEach(a => resultRing.add(a.serial));
                }
            });
            return resultRing;
        }
        case 'extend': {
            const sExtend = this.evaluate(expr.operand);
            const visitedExtend = new Map<number, number>();
            const queueExtend: number[] = [];

            this.atoms.forEach((atom, idx) => {
                if (sExtend.has(atom.serial)) {
                    visitedExtend.set(idx, 0);
                    queueExtend.push(idx);
                }
            });

            while (queueExtend.length > 0) {
                const currIdx = queueExtend.shift()!;
                const depth = visitedExtend.get(currIdx)!;
                if (depth < expr.steps) {
                    const atom = this.atoms[currIdx];
                    if (atom && atom.bonds) {
                        atom.bonds.forEach(bondIdx => {
                            if (!visitedExtend.has(bondIdx)) {
                                visitedExtend.set(bondIdx, depth + 1);
                                queueExtend.push(bondIdx);
                            }
                        });
                    }
                }
            }

            const resultExtend = new Set<number>();
            visitedExtend.forEach((d, idx) => {
                const atom = this.atoms[idx];
                if (atom) resultExtend.add(atom.serial);
            });
            return resultExtend;
        }
        case 'around': {
            const sAround = this.evaluate(expr.operand);
            const gridAround = new SpatialHashGrid(expr.distance, this.atoms, sAround);
            const resultAround = new Set<number>();
            this.atoms.forEach(atom => {
                if (!sAround.has(atom.serial) && gridAround.isNear(atom.x, atom.y, atom.z)) {
                    resultAround.add(atom.serial);
                }
            });
            return resultAround;
        }
        case 'within': {
            const sWithin = this.evaluate(expr.operand);
            const gridWithin = new SpatialHashGrid(expr.distance, this.atoms, sWithin);
            const resultWithin = new Set<number>();
            this.atoms.forEach(atom => {
                if (gridWithin.isNear(atom.x, atom.y, atom.z)) {
                    resultWithin.add(atom.serial);
                }
            });
            return resultWithin;
        }
        case 'expand': {
            const sExpand = this.evaluate(expr.operand);
            const gridExpand = new SpatialHashGrid(expr.distance, this.atoms, sExpand);
            const resultExpand = new Set<number>(sExpand);
            this.atoms.forEach(atom => {
                if (!sExpand.has(atom.serial) && gridExpand.isNear(atom.x, atom.y, atom.z)) {
                    resultExpand.add(atom.serial);
                }
            });
            return resultExpand;
        }
        case 'macro': {
            const resultMacro = new Set<number>();
            this.atoms.forEach(atom => {
                if (this.matchMacro(atom, expr)) {
                    resultMacro.add(atom.serial);
                }
            });
            return resultMacro;
        }
        case 'byobject': {
            const sObj = this.evaluate(expr.operand);
            if (sObj.size === 0) return new Set();
            return new Set(this.atoms.map(a => a.serial));
        }
        case 'bysegi': {
            const sSeg = this.evaluate(expr.operand);
            const selectedSegs = new Set(this.atoms.filter(a => sSeg.has(a.serial)).map(a => a.segi || a.altLoc || ''));
            const resultSeg = new Set<number>();
            this.atoms.forEach(atom => {
                if (selectedSegs.has(atom.segi || atom.altLoc || '')) {
                    resultSeg.add(atom.serial);
                }
            });
            return resultSeg;
        }
        case 'beyond': {
            const sBeyond = this.evaluate(expr.operand);
            const gridBeyond = new SpatialHashGrid(expr.distance, this.atoms, sBeyond);
            const resultBeyond = new Set<number>();
            this.atoms.forEach(atom => {
                if (!gridBeyond.isNear(atom.x, atom.y, atom.z)) {
                    resultBeyond.add(atom.serial);
                }
            });
            return resultBeyond;
        }
    }
    return new Set();
  }

  matchMacro(atom: Atom, expr: { model?: string; segi?: string; chain?: string; resi?: string; name?: string }): boolean {
    if (expr.model && atom.model && !this.matchPattern(atom.model, expr.model)) return false;
    if (expr.segi && !this.matchPattern(atom.segi || atom.altLoc || '', expr.segi)) return false;
    if (expr.chain && !this.matchPattern(atom.chainID, expr.chain)) return false;
    if (expr.resi && !this.matchNumericOrRange(atom.resSeq, expr.resi)) return false;
    if (expr.name && !this.matchPattern(atom.name, expr.name)) return false;
    return true;
  }

  matchPattern(target: string, pattern: string): boolean {
    const p = pattern.trim();
    if (!p) return true;
    const t = (target || '').trim();
    if (!p.includes('*') && !p.includes('?')) {
      return t.toLowerCase() === p.toLowerCase();
    }
    const regexStr = '^' + p.replace(/\*/g, '.*').replace(/\?/g, '.') + '$';
    return new RegExp(regexStr, 'i').test(t);
  }

  matchNumericOrRange(atomNum: number, item: string): boolean {
    const trimmed = item.trim();
    if (trimmed.includes('+') || trimmed.includes(',')) {
      const parts = trimmed.split(/[+,]/).map(s => s.trim()).filter(Boolean);
      return parts.some(p => this.matchNumericOrRange(atomNum, p));
    }
    const rangeMatch = trimmed.match(/^(-?\d+)[-:](\d+)$/);
    if (rangeMatch) {
      const min = parseInt(rangeMatch[1], 10);
      const max = parseInt(rangeMatch[2], 10);
      return atomNum >= min && atomNum <= max;
    }
    // Handle alphanumeric insertion codes (e.g. 52A -> matches resSeq 52)
    const insMatch = trimmed.match(/^(\d+)[a-zA-Z]$/);
    if (insMatch) {
      const num = parseInt(insMatch[1], 10);
      return atomNum === num;
    }
    const num = parseInt(trimmed, 10);
    return !isNaN(num) && atomNum === num;
  }
  
  matchProperty(atom: Atom, expr: any): boolean {
    const prop = expr.property.toLowerCase();
    const rawVal = (expr.value || '').trim();
    if (!rawVal) return false;

    // Support + or , separated list of values (e.g. "A+B", "LYS+ARG", "CA+CB", "10,20,30", "10+20+30")
    const parts = rawVal.split(/[+,]/).map(s => s.trim()).filter(Boolean);

    if (prop === 'resn' || prop === 'res') return parts.some(p => this.matchPattern(atom.resName, p));
    if (prop === 'chain') return parts.some(p => this.matchPattern(atom.chainID, p));
    if (prop === 'elem' || prop === 'element' || prop === 'symbol') return parts.some(p => this.matchPattern(atom.elem, p));
    if (prop === 'name' || prop === 'atom') return parts.some(p => this.matchPattern(atom.name, p));
    if (prop === 'segi' || prop === 'segid') return parts.some(p => this.matchPattern(atom.segi || atom.altLoc || '', p));
    if (prop === 'alt' || prop === 'altloc') return parts.some(p => this.matchPattern(atom.altLoc || '', p));

    if (prop === 'resi' || prop === 'resv') return parts.some(p => this.matchNumericOrRange(atom.resSeq, p));
    if (prop === 'id') return parts.some(p => this.matchNumericOrRange(atom.serial, p));
    if (prop === 'index') {
      const atomIdx = atom.index !== undefined ? atom.index : 1;
      return parts.some(p => this.matchNumericOrRange(atomIdx, p));
    }
    if (prop === 'rank') {
      const atomRank = atom.rank !== undefined ? atom.rank : 0;
      return parts.some(p => this.matchNumericOrRange(atomRank, p));
    }
    if (prop === 'formal_charge' || prop === 'fc') {
      const fc = atom.formalCharge !== undefined ? atom.formalCharge : 0;
      return parts.some(p => this.matchNumericOrRange(fc, p));
    }

    if (prop === 'ss') {
      const atomSS = (atom.ss || '').toLowerCase();
      return parts.some(p => {
        const valLower = p.toLowerCase();
        if (valLower === 'h' || valLower === 'helix') return atomSS === 'h' || atomSS === 'helix';
        if (valLower === 's' || valLower === 'sheet' || valLower === 'strand' || valLower === 'e') return atomSS === 's' || atomSS === 'sheet' || atomSS === 'e';
        if (valLower === 'l' || valLower === 'loop' || valLower === 'c' || valLower === 'coil') return atomSS === 'l' || atomSS === 'loop' || atomSS === 'c' || atomSS === 'coil';
        return this.matchPattern(atomSS, valLower);
      });
    }

    return false;
  }

  matchComparison(atom: Atom, expr: any): boolean {
    const prop = expr.property.toLowerCase();
    const op = expr.op;
    const valNum = parseFloat(expr.value);
    
    let atomVal = 0.0;
    if (prop === 'b' || prop === 'bfactor') {
      atomVal = atom.bFactor !== undefined ? atom.bFactor : 0.0;
    } else if (prop === 'q' || prop === 'occupancy') {
      atomVal = atom.occupancy !== undefined ? atom.occupancy : 1.0;
    } else if (prop === 'id') {
      atomVal = atom.serial;
    } else if (prop === 'resi' || prop === 'resv') {
      atomVal = atom.resSeq;
    } else if (prop === 'formal_charge' || prop === 'fc') {
      atomVal = atom.formalCharge !== undefined ? atom.formalCharge : 0;
    } else if (prop === 'index') {
      atomVal = atom.index !== undefined ? atom.index : 1;
    } else if (prop === 'rank') {
      atomVal = atom.rank !== undefined ? atom.rank : 0;
    } else {
      return false;
    }
    
    switch (op) {
      case '<': return atomVal < valNum;
      case '>': return atomVal > valNum;
      case '<=': return atomVal <= valNum;
      case '>=': return atomVal >= valNum;
      case '==':
      case '=': return atomVal === valNum;
      case '!=': return atomVal !== valNum;
    }
    return false;
  }

  matchFlag(atom: Atom, flag: string): boolean {
    const fl = flag.toLowerCase();

    const resNameUpper = (atom.resName || '').trim().toUpperCase();
    const elemUpper = (atom.elem || '').trim().toUpperCase();
    const atomNameUpper = (atom.name || '').trim().toUpperCase();

    const isProteinRes = atom.resClassification === 'amino_acid' || STANDARD_AMINO_ACIDS.has(resNameUpper);
    const isNucleicRes = atom.resClassification === 'nucleic_acid' || STANDARD_NUCLEIC_ACIDS.has(resNameUpper);
    const isPolymerRes = isProteinRes || isNucleicRes || (!atom.isHetero && atom.resClassification !== 'solvent' && atom.resClassification !== 'ion' && atom.resClassification !== 'ligand');

    const proteinBackboneAtoms = new Set(['N', 'CA', 'C', 'O', 'OXT', 'H', 'HA', 'H1', 'H2', 'H3']);
    const nucleicBackboneAtoms = new Set(['P', 'OP1', 'OP2', 'OP3', "O3'", "O5'", "C3'", "C4'", "C5'", "O4'", "C1'", "C2'"]);

    switch (fl) {
      case 'organic':
        return !!atom.isHetero && !isSolvent(atom) && hasCarbons(atom, this.atoms);

      case 'inorganic':
        return !!atom.isHetero && !isSolvent(atom) && !hasCarbons(atom, this.atoms);

      case 'ligand':
      case 'ligands':
        if (atom.resClassification === 'ligand') return true;
        if (atom.resClassification === 'amino_acid' || atom.resClassification === 'nucleic_acid' || atom.resClassification === 'solvent' || atom.resClassification === 'ion') {
          return false;
        }
        return !!atom.isHetero && !isSolvent(atom) && !isIon(atom, this.atoms) && !isProteinRes && !isNucleicRes;

      case 'ion':
      case 'ions':
        return isIon(atom, this.atoms);

      case 'polymer':
        return isPolymerRes && !isSolvent(atom) && !isIon(atom, this.atoms);

      case 'polymer.protein':
      case 'protein':
        return isProteinRes && !isSolvent(atom) && !isIon(atom, this.atoms);

      case 'polymer.nucleic':
      case 'nucleic':
        return isNucleicRes && !isSolvent(atom) && !isIon(atom, this.atoms);

      case 'backbone':
        if (isSolvent(atom) || isIon(atom, this.atoms)) return false;
        if (isProteinRes) return proteinBackboneAtoms.has(atomNameUpper);
        if (isNucleicRes) return nucleicBackboneAtoms.has(atomNameUpper);
        return false;

      case 'sidechain':
        if (isSolvent(atom) || isIon(atom, this.atoms)) return false;
        if (isProteinRes) return !proteinBackboneAtoms.has(atomNameUpper);
        if (isNucleicRes) return !nucleicBackboneAtoms.has(atomNameUpper);
        return false;

      case 'guide':
        if (isProteinRes) return atomNameUpper === 'CA';
        if (isNucleicRes) return atomNameUpper === 'P';
        return false;

      case 'solvent':
      case 'waters':
      case 'water':
        return isSolvent(atom);

      case 'hetatm':
      case 'het':
        return !!atom.isHetero;

      case 'hydrogens':
      case 'hydro':
      case 'h':
        return elemUpper === 'H' || elemUpper === 'D';

      case 'metals':
      case 'metal':
        return METAL_ELEMENTS.has(elemUpper);

      case 'first':
        return atom.serial === this.atoms[0]?.serial;

      case 'last':
        return atom.serial === this.atoms[this.atoms.length - 1]?.serial;

      case 'donor':
      case 'donors': {
        if (elemUpper === 'H' || elemUpper === 'D') return true;
        if (!['N', 'O', 'S'].includes(elemUpper)) return false;
        if (!atom.bonds || atom.bonds.length === 0) return true;
        return atom.bonds.some(bIdx => {
          const bAtom = this.atoms[bIdx];
          return bAtom && (bAtom.elem.toUpperCase() === 'H' || bAtom.name.trim().toUpperCase().startsWith('H'));
        });
      }

      case 'acceptor':
      case 'acceptors':
        return ['O', 'N', 'F', 'S'].includes(elemUpper);

      case 'visible':
      case 'enabled':
      case 'all':
        return true;

      case 'none':
        return false;
    }
    return false;
  }

  evaluateCommand(
    query: string,
    namedSelections?: { name: string; query: string; atomIds: number[] }[],
    activeObjectName?: string
  ): { 
    selectedSerials: Set<number>; 
    textOutput?: string; 
    saveSelection?: { name: string; query: string };
    deleteSelectionName?: string;
    removeAtomSerials?: Set<number>;
    setStyle?: string;
    setColorScheme?: string;
    setHiddenCategory?: string;
    triggerZoom?: boolean;
    fetchPdbId?: string;
    addHydrogens?: boolean;
    removeHydrogens?: boolean;
    addLabels?: { serial: number; text: string }[];
    clearLabels?: number[];
    addMeasurement?: {
      type: 'distance' | 'angle' | 'dihedral';
      atomSerials: number[];
      label: string;
      value: number;
    };
    ramachandranReport?: {
      resName: string;
      resSeq: number;
      chainID: string;
      phi: number;
      psi: number;
      region: 'favored' | 'allowed' | 'outlier';
    }[];
    dipoleResult?: {
      charge: number;
      magnitude: number;
      vector: { x: number; y: number; z: number };
      com: { x: number; y: number; z: number };
    };
    addHBonds?: {
      donorSerial: number;
      acceptorSerial: number;
      energy: number;
      distance: number;
    }[];
    bondRequest?: {
      atomA: number;
      atomB: number;
      order?: number;
    };
    unbondRequest?: {
      atomA: number;
      atomB: number;
    };
    setBondOrderRequest?: {
      atomA: number;
      atomB: number;
      order: number;
    };
    cycleValenceRequest?: {
      atomA: number;
      atomB: number;
    };
    alterRequest?: {
      query: string;
      property: string;
      value: string | number;
    };
    alterStateRequest?: {
      stateId: string;
      query: string;
      property: string;
      value: string | number;
    };
    undoRequest?: boolean;
    redoRequest?: boolean;
    historyRequest?: boolean;
    addHydrogensRequest?: {
      query?: string;
      fillOnly?: boolean;
    };
    removeHydrogensRequest?: {
      query?: string;
    };
  } {
    const qTrim = query.trim();
    const qLower = qTrim.toLowerCase();

    if (namedSelections) {
      this.namedSelections = namedSelections;
    }

    // 0.00 undo / redo / history commands
    if (qLower === 'undo') {
      return {
        selectedSerials: new Set<number>(),
        undoRequest: true,
        textOutput: 'undo: navigating to parent scientific revision.'
      };
    }

    if (qLower === 'redo') {
      return {
        selectedSerials: new Set<number>(),
        redoRequest: true,
        textOutput: 'redo: navigating to child scientific revision.'
      };
    }

    if (qLower === 'history') {
      return {
        selectedSerials: new Set<number>(),
        historyRequest: true,
        textOutput: 'history: inspected scientific revision ledger.'
      };
    }

    // Hydrogen Operations: h_add, hadd, add_h
    if (qLower === 'h_add' || qLower === 'hadd' || qLower === 'add_h' || qLower.startsWith('h_add ') || qLower.startsWith('hadd ') || qLower.startsWith('add_h ')) {
      let sel = '';
      if (qLower.startsWith('h_add ')) sel = qTrim.slice(6).trim();
      else if (qLower.startsWith('hadd ')) sel = qTrim.slice(5).trim();
      else if (qLower.startsWith('add_h ')) sel = qTrim.slice(6).trim();

      const serials = sel ? this.parse(sel) : new Set(this.atoms.map(a => a.serial));
      return {
        selectedSerials: serials,
        addHydrogens: true,
        addHydrogensRequest: { query: sel || 'all', fillOnly: false },
        textOutput: `h_add: modeled hydrogens added to selection (${serials.size} target atoms).`
      };
    }

    // Hydrogen Operations: h_fill, hfill, fill_h
    if (qLower === 'h_fill' || qLower === 'hfill' || qLower === 'fill_h' || qLower.startsWith('h_fill ') || qLower.startsWith('hfill ') || qLower.startsWith('fill_h ')) {
      let sel = '';
      if (qLower.startsWith('h_fill ')) sel = qTrim.slice(7).trim();
      else if (qLower.startsWith('hfill ')) sel = qTrim.slice(6).trim();
      else if (qLower.startsWith('fill_h ')) sel = qTrim.slice(7).trim();

      const serials = sel ? this.parse(sel) : new Set(this.atoms.map(a => a.serial));
      return {
        selectedSerials: serials,
        addHydrogens: true,
        addHydrogensRequest: { query: sel || 'all', fillOnly: true },
        textOutput: `h_fill: unsaturated valencies filled with modeled hydrogens (${serials.size} target atoms).`
      };
    }

    // Hydrogen Removal: h_remove, remove_h, del_h, hdel, h_del
    if (qLower === 'h_remove' || qLower === 'remove_h' || qLower === 'del_h' || qLower === 'hdel' || qLower === 'h_del' ||
        qLower.startsWith('h_remove ') || qLower.startsWith('remove_h ') || qLower.startsWith('del_h ') || qLower.startsWith('hdel ') || qLower.startsWith('h_del ')) {
      let sel = '';
      if (qLower.startsWith('h_remove ')) sel = qTrim.slice(9).trim();
      else if (qLower.startsWith('remove_h ')) sel = qTrim.slice(9).trim();
      else if (qLower.startsWith('del_h ')) sel = qTrim.slice(6).trim();
      else if (qLower.startsWith('hdel ')) sel = qTrim.slice(5).trim();
      else if (qLower.startsWith('h_del ')) sel = qTrim.slice(6).trim();

      const serials = sel ? this.parse(sel) : this.parse('elem H');
      return {
        selectedSerials: serials,
        removeHydrogens: true,
        removeHydrogensRequest: { query: sel || 'elem H' },
        textOutput: `h_remove: removed hydrogen atoms matching selection (${serials.size} atoms).`
      };
    }

    // 0.0 bond <selA>, <selB> [, <order>]
    if (qLower.startsWith('bond ')) {
      const rest = qTrim.slice(5).trim();
      const parts = rest.split(',').map(p => p.trim());
      if (parts.length < 2) {
        throw new Error('Syntax error: "bond" requires two atom selections (e.g. "bond id 1, id 2 [, order]")');
      }
      const setA = this.parse(parts[0]);
      const setB = this.parse(parts[1]);
      if (setA.size !== 1) {
        throw new Error(`Syntax error: bond first operand must resolve to exactly 1 atom (got ${setA.size})`);
      }
      if (setB.size !== 1) {
        throw new Error(`Syntax error: bond second operand must resolve to exactly 1 atom (got ${setB.size})`);
      }
      const atomA = Array.from(setA)[0];
      const atomB = Array.from(setB)[0];
      let order = 1.0;
      if (parts.length >= 3) {
        order = parseFloat(parts[2]);
        if (isNaN(order)) throw new Error(`Syntax error: invalid bond order "${parts[2]}"`);
      }
      return {
        selectedSerials: new Set([atomA, atomB]),
        bondRequest: { atomA, atomB, order },
        textOutput: `Bond: created covalent bond edge between atom ${atomA} and atom ${atomB} (order ${order}).`
      };
    }

    // 0.01 unbond <selA>, <selB>
    if (qLower.startsWith('unbond ')) {
      const rest = qTrim.slice(7).trim();
      const parts = rest.split(',').map(p => p.trim());
      if (parts.length < 2) {
        throw new Error('Syntax error: "unbond" requires two atom selections (e.g. "unbond id 1, id 2")');
      }
      const setA = this.parse(parts[0]);
      const setB = this.parse(parts[1]);
      if (setA.size !== 1) {
        throw new Error(`Syntax error: unbond first operand must resolve to exactly 1 atom (got ${setA.size})`);
      }
      if (setB.size !== 1) {
        throw new Error(`Syntax error: unbond second operand must resolve to exactly 1 atom (got ${setB.size})`);
      }
      const atomA = Array.from(setA)[0];
      const atomB = Array.from(setB)[0];
      return {
        selectedSerials: new Set([atomA, atomB]),
        unbondRequest: { atomA, atomB },
        textOutput: `Unbond: removed covalent bond edge between atom ${atomA} and atom ${atomB}.`
      };
    }

    // 0.02 set_bond_order / bond_order / order <selA>, <selB>, <order> OR valence <order>, <selA>, <selB>
    if (qLower.startsWith('set_bond_order ') || qLower.startsWith('bond_order ') || qLower.startsWith('order ') || qLower.startsWith('valence ')) {
      let rest = '';
      let isValencePrefix = false;
      if (qLower.startsWith('set_bond_order ')) rest = qTrim.slice(15).trim();
      else if (qLower.startsWith('bond_order ')) rest = qTrim.slice(11).trim();
      else if (qLower.startsWith('order ')) rest = qTrim.slice(6).trim();
      else {
        rest = qTrim.slice(8).trim();
        isValencePrefix = true;
      }

      const parts = rest.split(',').map(p => p.trim());
      if (parts.length < 3) {
        throw new Error('Syntax error: bond order operation requires 3 parameters (e.g. "order id 1, id 2, 2" or "valence 2, id 1, id 2")');
      }

      let selA: string, selB: string, orderStr: string;
      if (isValencePrefix) {
        orderStr = parts[0];
        selA = parts[1];
        selB = parts[2];
      } else {
        selA = parts[0];
        selB = parts[1];
        orderStr = parts[2];
      }

      const order = parseFloat(orderStr);
      if (isNaN(order)) throw new Error(`Syntax error: invalid bond order "${orderStr}"`);

      const setA = this.parse(selA);
      const setB = this.parse(selB);
      if (setA.size !== 1) {
        throw new Error(`Syntax error: first operand must resolve to exactly 1 atom (got ${setA.size})`);
      }
      if (setB.size !== 1) {
        throw new Error(`Syntax error: second operand must resolve to exactly 1 atom (got ${setB.size})`);
      }
      const atomA = Array.from(setA)[0];
      const atomB = Array.from(setB)[0];

      return {
        selectedSerials: new Set([atomA, atomB]),
        setBondOrderRequest: { atomA, atomB, order },
        textOutput: `Bond Order: modified bond between atom ${atomA} and atom ${atomB} to order ${order}.`
      };
    }

    // 0.03 cycle_valence / cycle <selA>, <selB>
    if (qLower.startsWith('cycle_valence ') || qLower.startsWith('cycle ')) {
      const rest = qLower.startsWith('cycle_valence ') ? qTrim.slice(14).trim() : qTrim.slice(6).trim();
      const parts = rest.split(',').map(p => p.trim());
      if (parts.length < 2) {
        throw new Error('Syntax error: "cycle_valence" requires two atom selections (e.g. "cycle_valence id 1, id 2")');
      }
      const setA = this.parse(parts[0]);
      const setB = this.parse(parts[1]);
      if (setA.size !== 1) {
        throw new Error(`Syntax error: cycle_valence first operand must resolve to exactly 1 atom (got ${setA.size})`);
      }
      if (setB.size !== 1) {
        throw new Error(`Syntax error: cycle_valence second operand must resolve to exactly 1 atom (got ${setB.size})`);
      }
      const atomA = Array.from(setA)[0];
      const atomB = Array.from(setB)[0];

      return {
        selectedSerials: new Set([atomA, atomB]),
        cycleValenceRequest: { atomA, atomB },
        textOutput: `Cycle Valence: cycled bond order between atom ${atomA} and atom ${atomB}.`
      };
    }

    // 0.04 alter_state <state_id>, <selection>, <property>=<value>
    if (qLower.startsWith('alter_state ')) {
      const rest = qTrim.slice(12).trim();
      const match = rest.match(/^([^,]+),\s*(.+?),\s*([a-zA-Z0-9_]+)\s*=\s*(.+)$/);
      if (!match) {
        throw new Error('Syntax error: alter_state requires syntax "alter_state <state>, <selection>, <property>=<value>" (e.g. "alter_state state_1, id 17, name=C99")');
      }
      const stateId = match[1].trim();
      const selExpr = match[2].trim();
      const property = match[3].trim();
      const valStr = match[4].trim();
      const serials = this.parse(selExpr);

      let parsedVal: string | number = valStr;
      if (/^-?\d+$/.test(valStr)) parsedVal = parseInt(valStr, 10);
      else if (/^-?\d+\.\d+$/.test(valStr)) parsedVal = parseFloat(valStr);

      return {
        selectedSerials: serials,
        alterStateRequest: {
          stateId,
          query: selExpr,
          property,
          value: parsedVal
        },
        textOutput: `alter_state: property "${property}=${parsedVal}" updated on state "${stateId}".`
      };
    }

    // 0.05 alter <selection>, <property>=<value>
    if (qLower.startsWith('alter ')) {
      const rest = qTrim.slice(6).trim();
      const match = rest.match(/^(.+?),\s*([a-zA-Z0-9_]+)\s*=\s*(.+)$/);
      if (!match) {
        throw new Error('Syntax error: alter requires syntax "alter <selection>, <property>=<value>" (e.g. "alter id 17, name=C99" or "alter chain A, chain=B")');
      }
      const selExpr = match[1].trim();
      const property = match[2].trim();
      const valStr = match[3].trim();
      const serials = this.parse(selExpr);

      let parsedVal: string | number = valStr;
      if (/^-?\d+$/.test(valStr)) parsedVal = parseInt(valStr, 10);
      else if (/^-?\d+\.\d+$/.test(valStr)) parsedVal = parseFloat(valStr);

      return {
        selectedSerials: serials,
        alterRequest: {
          query: selExpr,
          property,
          value: parsedVal
        },
        textOutput: `alter: property "${property}=${parsedVal}" updated on selection "${selExpr}".`
      };
    }

    // 0. remove / delete command: remove solvent, remove hydro, remove (expr), delete sele_1
    if (qLower.startsWith('remove ') || qLower.startsWith('delete ') || qLower.startsWith('del ') || qLower === 'remove' || qLower === 'delete') {
      let target = '';
      if (qLower.startsWith('remove ')) target = qTrim.slice(7).trim();
      else if (qLower.startsWith('delete ')) target = qTrim.slice(7).trim();
      else if (qLower.startsWith('del ')) target = qTrim.slice(4).trim();
      else target = 'selected';

      // Check if deleting a named selection
      if (this.namedSelections) {
        const matchIdx = this.namedSelections.findIndex(s => s.name.toLowerCase() === target.toLowerCase());
        if (matchIdx >= 0) {
          const name = this.namedSelections[matchIdx].name;
          this.namedSelections.splice(matchIdx, 1);
          return {
            selectedSerials: new Set(),
            deleteSelectionName: name,
            textOutput: `Delete: removed selection "${name}".`
          };
        }
      }

      let exprToParse = target;
      if (target === 'solvent' || target === 'waters' || target === 'water' || target === 'sol') {
        exprToParse = 'resn HOH+WAT+DOD+SOL';
      } else if (target === 'hydro' || target === 'hydrogens' || target === 'hydrogen' || target === 'h') {
        exprToParse = 'elem H';
      } else if (target === 'selected' || target === 'sele') {
        exprToParse = 'all';
      }

      const serials = this.parse(exprToParse);
      return {
        selectedSerials: new Set(),
        removeAtomSerials: serials,
        textOutput: `Remove: removed ${serials.size} atom(s) matching "${target}".`
      };
    }

    // 0.1 show <representation> [, <selection>]
    if (qLower.startsWith('show ') || qLower === 'show') {
      const rest = qTrim.slice(5).trim();
      const parts = rest.split(',');
      const styleRaw = (parts[0] || 'cartoon').trim().toLowerCase();
      let styleMap: Record<string, string> = {
        'cartoon': 'Cartoon',
        'ribbon': 'Cartoon',
        'sticks': 'Stick',
        'stick': 'Stick',
        'spheres': 'Space-Filling',
        'sphere': 'Space-Filling',
        'vdw': 'Space-Filling',
        'dots': 'Dots',
        'dot': 'Dots',
        'surface': 'Surfaces',
        'surf': 'Surfaces',
        'mesh': 'Surfaces',
        'lines': 'Stick',
        'line': 'Stick',
        'putty': 'Putty',
        'ball_and_stick': 'Ball-and-Stick',
        'ball and stick': 'Ball-and-Stick'
      };
      const resolvedStyle = styleMap[styleRaw] || 'Cartoon';
      let serials = new Set<number>();
      if (parts.length >= 2) {
        serials = this.parse(parts.slice(1).join(',').trim());
      }
      return {
        selectedSerials: serials,
        setStyle: resolvedStyle,
        textOutput: `Show: set representation style to "${resolvedStyle}".`
      };
    }

    // 0.2 hide <representation | everything | waters> [, <selection>]
    if (qLower.startsWith('hide ') || qLower === 'hide') {
      const target = qTrim.slice(5).trim().toLowerCase() || 'everything';
      if (target === 'waters' || target === 'solvent' || target === 'water') {
        const serials = this.parse('resn HOH+WAT+DOD+SOL');
        return {
          selectedSerials: new Set(),
          removeAtomSerials: serials,
          textOutput: `Hide: removed solvent waters from display.`
        };
      }
      if (target === 'labels' || target === 'label') {
        return {
          selectedSerials: new Set(),
          clearLabels: this.atoms.map(a => a.serial),
          textOutput: `Hide: cleared all labels.`
        };
      }
      return {
        selectedSerials: new Set(),
        setHiddenCategory: target,
        textOutput: `Hide: hidden "${target}".`
      };
    }

    // 0.3 color <color_name> [, <selection>]
    if (qLower.startsWith('color ')) {
      const rest = qTrim.slice(6).trim();
      const parts = rest.split(',');
      const colorRaw = (parts[0] || 'spectrum').trim().toLowerCase();
      let serials = new Set<number>();
      if (parts.length >= 2) {
        serials = this.parse(parts.slice(1).join(',').trim());
      }
      let colorMap: Record<string, string> = {
        'cpk': 'Classic CPK',
        'element': 'Classic CPK',
        'jmol': 'Modern Jmol',
        'chain': 'By Chain',
        'by_chain': 'By Chain',
        'ss': 'Secondary Structure',
        'secondary': 'Secondary Structure',
        'spectrum': 'spectrum',
        'rainbow': 'rainbow',
        'bfactor': 'B-Factor',
        'b_factor': 'B-Factor',
        'charge': 'Formal Charge',
        'hydrophobicity': 'Hydrophobicity',
        'white': 'monochrome',
        'gray': 'monochrome',
        'red': 'rainbow',
        'blue': 'spectrum',
        'green': 'By Chain'
      };
      const resolvedColor = colorMap[colorRaw] || colorRaw;
      return {
        selectedSerials: serials,
        setColorScheme: resolvedColor,
        textOutput: `Color: color scheme set to "${resolvedColor}".`
      };
    }

    // 0.4 zoom / center [expr]
    if (qLower.startsWith('zoom') || qLower.startsWith('center') || qLower.startsWith('orient')) {
      let expr = '';
      if (qLower.startsWith('zoom')) expr = qTrim.slice(4).trim();
      else if (qLower.startsWith('center')) expr = qTrim.slice(6).trim();
      else expr = qTrim.slice(6).trim();

      const serials = expr ? this.parse(expr) : new Set<number>();
      return {
        selectedSerials: serials,
        triggerZoom: true,
        textOutput: `Zoom: centered view on ${expr ? `selection "${expr}"` : 'molecule'}.`
      };
    }

    // 0.5 fetch <pdb_id>
    if (qLower.startsWith('fetch ')) {
      const pdbId = qTrim.slice(6).trim().toUpperCase();
      return {
        selectedSerials: new Set(),
        fetchPdbId: pdbId,
        textOutput: `Fetch: fetching structure ${pdbId} from RCSB PDB...`
      };
    }

    // 0.6 h_add / add_hydrogens / h_fill [<expr>]
    if (qLower.startsWith('h_add') || qLower.startsWith('h_fill') || qLower.startsWith('add_hydrogens') || qLower.startsWith('hadd')) {
      let rest = '';
      if (qLower.startsWith('h_add')) rest = qTrim.slice(5).trim();
      else if (qLower.startsWith('h_fill')) rest = qTrim.slice(6).trim();
      else if (qLower.startsWith('add_hydrogens')) rest = qTrim.slice(13).trim();
      else rest = qTrim.slice(4).trim();

      const serials = rest ? this.parse(rest) : new Set<number>();
      const isFill = qLower.startsWith('h_fill');
      return {
        selectedSerials: serials,
        addHydrogens: true,
        textOutput: `${isFill ? 'h_fill' : 'h_add'}: added modeled hydrogens to molecular topology.`
      };
    }

    // 0.7 remove_h / h_remove / h_del / del_h [<expr>]
    if (qLower.startsWith('h_remove') || qLower.startsWith('remove_h') || qLower.startsWith('h_del') || qLower.startsWith('del_h') || qLower.startsWith('hdel')) {
      let rest = '';
      if (qLower.startsWith('h_remove')) rest = qTrim.slice(8).trim();
      else if (qLower.startsWith('remove_h')) rest = qTrim.slice(8).trim();
      else if (qLower.startsWith('h_del')) rest = qTrim.slice(5).trim();
      else if (qLower.startsWith('del_h')) rest = qTrim.slice(5).trim();
      else rest = qTrim.slice(4).trim();

      const serials = rest ? this.parse(rest) : new Set<number>();
      return {
        selectedSerials: serials,
        removeHydrogens: true,
        textOutput: `h_remove: removed hydrogen atoms from molecular topology.`
      };
    }

    // label selection, expression
    if (qLower.startsWith('label ')) {
      const parts = qTrim.slice(6).split(',');
      const expr = parts[0].trim();
      const template = parts.slice(1).join(',').trim() || 'name';
      const serials = this.parse(expr);
      
      const compileLabel = (atom: Atom, temp: string): string => {
        const parts = temp.split('+').map(p => p.trim());
        const resolved = parts.map(part => {
          let labelText = part;
          labelText = labelText.replace(/resn/gi, atom.resName || '');
          labelText = labelText.replace(/resi/gi, String(atom.resSeq || ''));
          labelText = labelText.replace(/chain/gi, atom.chainID || '');
          labelText = labelText.replace(/name/gi, atom.name || '');
          labelText = labelText.replace(/elem/gi, atom.elem || '');
          labelText = labelText.replace(/b/gi, atom.bFactor !== undefined ? String(atom.bFactor) : '');
          labelText = labelText.replace(/q/gi, atom.occupancy !== undefined ? String(atom.occupancy) : '');
          return labelText.replace(/['"]/g, '');
        });
        return resolved.join('');
      };

      const labels = Array.from(serials).map(s => {
        const a = this.atoms.find(atom => atom.serial === s);
        return {
          serial: s,
          text: a ? compileLabel(a, template) : `Atom ${s}`
        };
      });

      return {
        selectedSerials: serials,
        textOutput: `Label: custom label applied to ${serials.size} atoms matching "${expr}".`,
        addLabels: labels
      };
    }

    // unlabel selection
    if (qLower.startsWith('unlabel ')) {
      const expr = qTrim.slice(8).trim();
      const serials = this.parse(expr || 'all');
      return {
        selectedSerials: serials,
        textOutput: `Unlabel: removed labels from ${serials.size} atoms matching "${expr || 'all'}".`,
        clearLabels: Array.from(serials)
      };
    }

    // 1. select / sele command
    if (qLower === 'select' || qLower === 'sele') {
      const allSerials = new Set(this.atoms.map(a => a.serial));
      return {
        selectedSerials: allSerials,
        textOutput: `Selector: selected all ${allSerials.size} atoms.`
      };
    }

    if (qLower.startsWith('select ') || qLower.startsWith('sele ')) {
      const rest = qLower.startsWith('select ') ? qTrim.slice(7).trim() : qTrim.slice(5).trim();
      const parts = rest.split(',');
      if (parts.length >= 2) {
        const name = parts[0].trim();
        const expr = parts.slice(1).join(',').trim();
        const serials = this.parse(expr);
        if (this.namedSelections) {
          const idx = this.namedSelections.findIndex(s => s.name.toLowerCase() === name.toLowerCase());
          const item = { name, query: expr, atomIds: Array.from(serials) };
          if (idx >= 0) this.namedSelections[idx] = item;
          else this.namedSelections.push(item);
        }
        return {
          selectedSerials: serials,
          textOutput: `Selector: selection "${name}" defined with ${serials.size} atoms.`,
          saveSelection: { name, query: expr }
        };
      } else {
        const expr = rest;
        const name = 'sele';
        const serials = this.parse(expr);
        if (this.namedSelections) {
          const idx = this.namedSelections.findIndex(s => s.name.toLowerCase() === name.toLowerCase());
          const item = { name, query: expr, atomIds: Array.from(serials) };
          if (idx >= 0) this.namedSelections[idx] = item;
          else this.namedSelections.push(item);
        }
        return {
          selectedSerials: serials,
          textOutput: `Selector: selection "${name}" defined with ${serials.size} atoms for query "${expr}".`,
          saveSelection: { name, query: expr }
        };
      }
    }

    // 2. count_atoms / count
    if (qLower.startsWith('count_atoms') || qLower.startsWith('count')) {
      let expr = '';
      if (qLower.startsWith('count_atoms')) {
        expr = qTrim.slice(11).trim();
      } else {
        expr = qTrim.slice(5).trim();
      }
      if (expr.startsWith('of ')) expr = expr.slice(3).trim();
      const targetQuery = expr || 'all';
      const serials = this.parse(targetQuery);
      return {
        selectedSerials: serials, // count can return selection target
        textOutput: `count_atoms: ${serials.size} atoms in selection "${targetQuery}".`
      };
    }

    // 3. get_names / get names
    if (qLower === 'get_names' || qLower === 'get names') {
      const names = [];
      if (activeObjectName) names.push(activeObjectName);
      if (namedSelections) {
        namedSelections.forEach(s => names.push(s.name));
      }
      return {
        selectedSerials: new Set(),
        textOutput: `Names:\n${names.map(n => `- ${n}`).join('\n') || 'No loaded objects or selections.'}`
      };
    }

    // 4. get_chains / get chains
    if (qLower.startsWith('get_chains') || qLower.startsWith('get chains')) {
      let expr = '';
      if (qLower.startsWith('get_chains')) {
        expr = qTrim.slice(10).trim();
      } else {
        expr = qTrim.slice(10).trim();
      }
      const targetQuery = expr || 'all';
      const serials = this.parse(targetQuery);
      const uniqueChains = Array.from(new Set(
        this.atoms.filter(a => serials.has(a.serial)).map(a => a.chainID)
      )).sort();
      return {
        selectedSerials: serials,
        textOutput: `Chains in "${targetQuery}":\n${JSON.stringify(uniqueChains)}`
      };
    }

    // 5. get_residues / get residues
    if (qLower.startsWith('get_residues') || qLower.startsWith('get residues')) {
      let expr = '';
      if (qLower.startsWith('get_residues')) {
        expr = qTrim.slice(12).trim();
      } else {
        expr = qTrim.slice(12).trim();
      }
      const targetQuery = expr || 'all';
      const serials = this.parse(targetQuery);
      const resList = this.atoms
        .filter(a => serials.has(a.serial))
        .map(a => `${a.chainID}:${a.resSeq}:${a.resName}`);
      const uniqueRes = Array.from(new Set(resList)).sort();
      return {
        selectedSerials: serials,
        textOutput: `Residues in "${targetQuery}":\n${uniqueRes.map(r => `/${r.split(':')[0]}/${r.split(':')[1]}/${r.split(':')[2]}`).join('\n') || 'None.'}`
      };
    }

    // 6. get_distance expr1, expr2
    if (qLower.startsWith('get_distance') || qLower.startsWith('get distance') || qLower.startsWith('distance ') || qLower.startsWith('dist ')) {
      let rest = '';
      if (qLower.startsWith('get_distance')) {
        rest = qTrim.slice(12).trim();
      } else if (qLower.startsWith('get distance')) {
        rest = qTrim.slice(12).trim();
      } else if (qLower.startsWith('distance ')) {
        rest = qTrim.slice(9).trim();
      } else {
        rest = qTrim.slice(5).trim();
      }
      const parts = rest.split(',');
      if (parts.length >= 2) {
        const s1 = this.parse(parts[0].trim());
        const s2 = this.parse(parts[1].trim());
        const a1 = this.atoms.find(a => s1.has(a.serial));
        const a2 = this.atoms.find(a => s2.has(a.serial));
        if (a1 && a2) {
          const dx = a1.x - a2.x;
          const dy = a1.y - a2.y;
          const dz = a1.z - a2.z;
          const dist = Math.sqrt(dx*dx + dy*dy + dz*dz);
          const lbl = `${dist.toFixed(3)} Å`;
          return {
            selectedSerials: new Set([a1.serial, a2.serial]),
            textOutput: `Distance between ${a1.name} (res ${a1.resSeq}) and ${a2.name} (res ${a2.resSeq}):\n${dist.toFixed(3)} Å`,
            addMeasurement: {
              type: 'distance',
              atomSerials: [a1.serial, a2.serial],
              label: lbl,
              value: dist
            }
          };
        }
        return { selectedSerials: new Set(), textOutput: 'Distance computation failed: one or both selections resolved to zero atoms.' };
      }
    }

    // 7. get_angle expr1, expr2, expr3
    if (qLower.startsWith('get_angle') || qLower.startsWith('get angle') || qLower.startsWith('angle ')) {
      let rest = '';
      if (qLower.startsWith('get_angle')) {
        rest = qTrim.slice(9).trim();
      } else if (qLower.startsWith('get angle')) {
        rest = qTrim.slice(9).trim();
      } else {
        rest = qTrim.slice(6).trim();
      }
      const parts = rest.split(',');
      if (parts.length >= 3) {
        const s1 = this.parse(parts[0].trim());
        const s2 = this.parse(parts[1].trim());
        const s3 = this.parse(parts[2].trim());
        const a1 = this.atoms.find(a => s1.has(a.serial));
        const a2 = this.atoms.find(a => s2.has(a.serial)); // vertex
        const a3 = this.atoms.find(a => s3.has(a.serial));
        if (a1 && a2 && a3) {
          const vA = { x: a1.x - a2.x, y: a1.y - a2.y, z: a1.z - a2.z };
          const vC = { x: a3.x - a2.x, y: a3.y - a2.y, z: a3.z - a2.z };
          const dot = vA.x*vC.x + vA.y*vC.y + vA.z*vC.z;
          const lenA = Math.sqrt(vA.x*vA.x + vA.y*vA.y + vA.z*vA.z);
          const lenC = Math.sqrt(vC.x*vC.x + vC.y*vC.y + vC.z*vC.z);
          const angle = Math.acos(dot / (lenA * lenC)) * (180.0 / Math.PI);
          const lbl = `${angle.toFixed(1)}°`;
          return {
            selectedSerials: new Set([a1.serial, a2.serial, a3.serial]),
            textOutput: `Angle at ${a2.name} (res ${a2.resSeq}) vertex:\n${angle.toFixed(1)} degrees`,
            addMeasurement: {
              type: 'angle',
              atomSerials: [a1.serial, a2.serial, a3.serial],
              label: lbl,
              value: angle
            }
          };
        }
        return { selectedSerials: new Set(), textOutput: 'Angle computation failed: one or more selections resolved to zero atoms.' };
      }
    }

    // 8. get_dihedral expr1, expr2, expr3, expr4
    if (qLower.startsWith('get_dihedral') || qLower.startsWith('get dihedral') || qLower.startsWith('dihedral ')) {
      let rest = '';
      if (qLower.startsWith('get_dihedral')) {
        rest = qTrim.slice(12).trim();
      } else if (qLower.startsWith('get dihedral')) {
        rest = qTrim.slice(12).trim();
      } else {
        rest = qTrim.slice(9).trim();
      }
      const parts = rest.split(',');
      if (parts.length >= 4) {
        const s1 = this.parse(parts[0].trim());
        const s2 = this.parse(parts[1].trim());
        const s3 = this.parse(parts[2].trim());
        const s4 = this.parse(parts[3].trim());
        const a1 = this.atoms.find(a => s1.has(a.serial));
        const a2 = this.atoms.find(a => s2.has(a.serial));
        const a3 = this.atoms.find(a => s3.has(a.serial));
        const a4 = this.atoms.find(a => s4.has(a.serial));
        if (a1 && a2 && a3 && a4) {
          const b1 = { x: a2.x - a1.x, y: a2.y - a1.y, z: a2.z - a1.z };
          const b2 = { x: a3.x - a2.x, y: a3.y - a2.y, z: a3.z - a2.z };
          const b3 = { x: a4.x - a3.x, y: a4.y - a3.y, z: a4.z - a3.z };

          const n1 = {
            x: b1.y*b2.z - b1.z*b2.y,
            y: b1.z*b2.x - b1.x*b2.z,
            z: b1.x*b2.y - b1.y*b2.x
          };
          const n2 = {
            x: b2.y*b3.z - b2.z*b3.y,
            y: b2.z*b3.x - b2.x*b3.z,
            z: b2.x*b3.y - b2.y*b3.x
          };

          const lenB2 = Math.sqrt(b2.x*b2.x + b2.y*b2.y + b2.z*b2.z);
          const m1 = {
            x: n1.y*b2.z - n1.z*b2.y,
            y: n1.z*b2.x - n1.x*b2.z,
            z: n1.x*b2.y - n1.y*b2.x
          };

          const dotN = n1.x*n2.x + n1.y*n2.y + n1.z*n2.z;
          const dotM = (m1.x*n2.x + m1.y*n2.y + m1.z*n2.z) / lenB2;
          const dih = Math.atan2(-dotM, dotN) * (180.0 / Math.PI);
          const lbl = `${dih.toFixed(1)}°`;
          return {
            selectedSerials: new Set([a1.serial, a2.serial, a3.serial, a4.serial]),
            textOutput: `Dihedral angle:\n${dih.toFixed(1)} degrees`,
            addMeasurement: {
              type: 'dihedral',
              atomSerials: [a1.serial, a2.serial, a3.serial, a4.serial],
              label: lbl,
              value: dih
            }
          };
        }
        return { selectedSerials: new Set(), textOutput: 'Dihedral computation failed.' };
      }
    }

    // 9. get_property prop, expr
    if (qLower.startsWith('get_property') || qLower.startsWith('get property')) {
      let rest = '';
      if (qLower.startsWith('get_property')) {
        rest = qTrim.slice(12).trim();
      } else {
        rest = qTrim.slice(12).trim();
      }
      const parts = rest.split(',');
      if (parts.length >= 2) {
        const propName = parts[0].trim().toLowerCase();
        const expr = parts.slice(1).join(',').trim();
        const serials = this.parse(expr);
        const matched = this.atoms.filter(a => serials.has(a.serial));
        if (matched.length > 0) {
          const vals = matched.map(a => {
            if (propName === 'b') return a.bFactor || 0;
            if (propName === 'q') return a.occupancy || 1.0;
            if (propName === 'resi') return a.resSeq;
            return 0;
          });
          const min = Math.min(...vals);
          const max = Math.max(...vals);
          const sum = vals.reduce((a,b)=>a+b, 0);
          const avg = sum / vals.length;
          return {
            selectedSerials: serials,
            textOutput: `Property Stats for '${propName}' in selection:\n- Min: ${min.toFixed(2)}\n- Max: ${max.toFixed(2)}\n- Avg: ${avg.toFixed(2)} (on ${vals.length} atoms)`
          };
        }
        return { selectedSerials: new Set(), textOutput: `Property Stats failed: zero atoms selected.` };
      }
    }

    // 10. ramachandran / rama [expr]
    if (qLower.startsWith('ramachandran') || qLower.startsWith('rama')) {
      let expr = '';
      if (qLower.startsWith('ramachandran')) {
        expr = qTrim.slice(12).trim();
      } else {
        expr = qTrim.slice(4).trim();
      }
      const targetQuery = expr || 'all';
      const serials = this.parse(targetQuery);
      
      const matchingResidues = new Set<string>();
      this.atoms.forEach(a => {
        if (serials.has(a.serial) && a.resSeq !== undefined) {
          matchingResidues.add(`${a.chainID}:${a.resSeq}:${a.resName}`);
        }
      });

      const report: any[] = [];
      let favored = 0;
      let allowed = 0;
      let outlier = 0;

      const helperTorsion = (a: Atom, b: Atom, c: Atom, d: Atom): number => {
        const b1 = { x: b.x - a.x, y: b.y - a.y, z: b.z - a.z };
        const b2 = { x: c.x - b.x, y: c.y - b.y, z: c.z - b.z };
        const b3 = { x: d.x - c.x, y: d.y - c.y, z: d.z - c.z };
        const n1 = { x: b1.y*b2.z - b1.z*b2.y, y: b1.z*b2.x - b1.x*b2.z, z: b1.x*b2.y - b1.y*b2.x };
        const n2 = { x: b2.y*b3.z - b2.z*b3.y, y: b2.z*b3.x - b2.x*b3.z, z: b2.x*b3.y - b2.y*b3.x };
        const lenB2 = Math.sqrt(b2.x*b2.x + b2.y*b2.y + b2.z*b2.z);
        const m1 = { x: n1.y*b2.z - n1.z*b2.y, y: n1.z*b2.x - n1.x*b2.z, z: n1.x*b2.y - n1.y*b2.x };
        const dotN = n1.x*n2.x + n1.y*n2.y + n1.z*n2.z;
        const dotM = lenB2 > 0 ? (m1.x*n2.x + m1.y*n2.y + m1.z*n2.z) / lenB2 : 0;
        return Math.atan2(-dotM, dotN) * (180.0 / Math.PI);
      };

      const checkRegion = (phi: number, psi: number): 'favored' | 'allowed' | 'outlier' => {
        if (phi === 360 || psi === 360) return 'allowed';
        if (phi >= -100 && phi <= -30 && psi >= -70 && psi <= -10) return 'favored';
        if (phi >= -160 && phi <= -50 && (psi >= 90 && psi <= 180 || psi >= -180 && psi <= -160)) return 'favored';
        if (phi >= 30 && phi <= 90 && psi >= 20 && psi <= 90) return 'favored';
        if (phi >= -120 && phi <= -10 && psi >= -90 && psi <= 10) return 'allowed';
        if (phi >= -180 && phi <= -30 && (psi >= 70 && psi <= 180 || psi >= -180 && psi <= -140)) return 'allowed';
        if (phi >= 10 && phi <= 110 && psi >= 0 && psi <= 110) return 'allowed';
        return 'outlier';
      };

      const sortedKeys = Array.from(matchingResidues).sort((x, y) => {
        const [chX, seqX] = x.split(':');
        const [chY, seqY] = y.split(':');
        if (chX !== chY) return chX.localeCompare(chY);
        return parseInt(seqX) - parseInt(seqY);
      });

      sortedKeys.forEach(key => {
        const [chainID, resSeqStr, resName] = key.split(':');
        const resSeq = parseInt(resSeqStr);
        const atomsCurrent = this.atoms.filter(a => a.chainID === chainID && a.resSeq === resSeq);
        const atomsPrev = this.atoms.filter(a => a.chainID === chainID && a.resSeq === resSeq - 1);
        const atomsNext = this.atoms.filter(a => a.chainID === chainID && a.resSeq === resSeq + 1);

        const N = atomsCurrent.find(a => a.name.trim() === 'N');
        const CA = atomsCurrent.find(a => a.name.trim() === 'CA');
        const C = atomsCurrent.find(a => a.name.trim() === 'C');
        const C_prev = atomsPrev.find(a => a.name.trim() === 'C');
        const N_next = atomsNext.find(a => a.name.trim() === 'N');

        if (N && CA && C) {
          let phi = 360;
          let psi = 360;
          if (C_prev) phi = helperTorsion(C_prev, N, CA, C);
          if (N_next) psi = helperTorsion(N, CA, C, N_next);

          if (phi !== 360 || psi !== 360) {
            const region = checkRegion(phi, psi);
            if (region === 'favored') favored++;
            else if (region === 'allowed') allowed++;
            else outlier++;

            report.push({ resName, resSeq, chainID, phi, psi, region });
          }
        }
      });

      const total = favored + allowed + outlier;
      let textReport = '';
      if (total > 0) {
        const pctFav = ((favored / total) * 100).toFixed(1);
        const pctAll = ((allowed / total) * 100).toFixed(1);
        const pctOut = ((outlier / total) * 100).toFixed(1);
        textReport = `Ramachandran Conformation Analysis for "${targetQuery}":\nTotal residues evaluated: ${total}\n- Favored: ${favored} (${pctFav}%)\n- Allowed: ${allowed} (${pctAll}%)\n- Outliers: ${outlier} (${pctOut}%)`;
        
        const outlierList = report.filter(r => r.region === 'outlier');
        if (outlierList.length > 0) {
          textReport += `\n\nOutliers Details:\n` + outlierList.map(r => `  /${r.chainID}/${r.resSeq}/${r.resName} : Phi=${r.phi.toFixed(1)}°, Psi=${r.psi.toFixed(1)}°`).join('\n');
        } else {
          textReport += `\n\nNo outliers detected in selection. Conformation is fully compliant!`;
        }
      } else {
        textReport = `Ramachandran Analysis failed: zero residues with valid backbone coordinates found.`;
      }

      return {
        selectedSerials: serials,
        textOutput: textReport,
        ramachandranReport: report
      };
    }

    // 11. dipole [expr]
    if (qLower.startsWith('dipole')) {
      const expr = qTrim.slice(6).trim();
      const targetQuery = expr || 'all';
      const serials = this.parse(targetQuery);
      const matched = this.atoms.filter(a => serials.has(a.serial));

      if (matched.length > 0) {
        const getMass = (elem: string): number => {
          const el = (elem || '').toUpperCase().trim();
          switch (el) {
            case 'H': return 1.008;
            case 'C': return 12.011;
            case 'N': return 14.007;
            case 'O': return 15.999;
            case 'P': return 30.974;
            case 'S': return 32.06;
            default: return 12.0;
          }
        };

        const AMBER_CHARGES: Record<string, number> = {
          "N": -0.47, "H": 0.31, "CA": 0.07, "C": 0.51, "O": -0.51,
          "NZ": 1.00, "NH1": 0.40, "NH2": 0.40, "NE": -0.05,
          "OD1": -0.80, "OD2": -0.80, "OE1": -0.80, "OE2": -0.80,
          "SG": -0.20, "OH": -0.40, "ND1": -0.36, "NE2": -0.36
        };

        const getAtomCharge = (name: string): number => {
          const clean = name.trim().toUpperCase();
          if (AMBER_CHARGES[clean] !== undefined) return AMBER_CHARGES[clean];
          if (clean.startsWith("O")) return -0.40;
          if (clean.startsWith("N")) return -0.40;
          if (clean.startsWith("C")) return 0.0;
          if (clean.startsWith("H")) return 0.10;
          return 0.0;
        };

        let totalMass = 0;
        let com = { x: 0, y: 0, z: 0 };
        matched.forEach(a => {
          const m = getMass(a.elem);
          totalMass += m;
          com.x += a.x * m;
          com.y += a.y * m;
          com.z += a.z * m;
        });

        if (totalMass > 0) {
          com.x /= totalMass;
          com.y /= totalMass;
          com.z /= totalMass;
        }

        let netCharge = 0;
        let mu = { x: 0, y: 0, z: 0 };
        matched.forEach(a => {
          const q = getAtomCharge(a.name);
          netCharge += q;
          mu.x += q * (a.x - com.x);
          mu.y += q * (a.y - com.y);
          mu.z += q * (a.z - com.z);
        });

        mu.x *= 4.8032;
        mu.y *= 4.8032;
        mu.z *= 4.8032;
        const mag = Math.sqrt(mu.x*mu.x + mu.y*mu.y + mu.z*mu.z);

        return {
          selectedSerials: serials,
          textOutput: `Molecular Dipole Moment for "${targetQuery}":\n- Center of Mass (x,y,z): (${com.x.toFixed(3)}, ${com.y.toFixed(3)}, ${com.z.toFixed(3)})\n- Net Ionic Charge: ${netCharge.toFixed(2)} e\n- Dipole Vector (x,y,z): (${mu.x.toFixed(3)}, ${mu.y.toFixed(3)}, ${mu.z.toFixed(3)}) Debye\n- Vector Magnitude: ${mag.toFixed(3)} Debye\n- 3D Vector Arrow toggled on the main viewport.`,
          dipoleResult: { charge: netCharge, magnitude: mag, vector: mu, com }
        };
      }
      return { selectedSerials: new Set(), textOutput: `Dipole Analysis failed: zero atoms selected.` };
    }

    // 12. hbond_energy [expr]
    if (qLower.startsWith('hbond_energy') || qLower.startsWith('hbond energy') || qLower.startsWith('hbond ')) {
      let expr = '';
      if (qLower.startsWith('hbond_energy')) expr = qTrim.slice(12).trim();
      else if (qLower.startsWith('hbond energy')) expr = qTrim.slice(12).trim();
      else expr = qTrim.slice(6).trim();

      const targetQuery = expr || 'all';
      const serials = this.parse(targetQuery);
      const matched = this.atoms.filter(a => serials.has(a.serial));

      const donors = matched.filter(a => a.elem === 'N' || a.elem === 'O');
      const acceptors = matched.filter(a => a.elem === 'O' || a.elem === 'N');

      const hbonds: any[] = [];
      let totalEnergy = 0;

      donors.forEach(D => {
        // Look for corresponding Hydrogen atom
        let H = this.atoms.find(a => a.chainID === D.chainID && a.resSeq === D.resSeq && a.elem === 'H' && Math.sqrt((a.x-D.x)**2 + (a.y-D.y)**2 + (a.z-D.z)**2) <= 1.2);
        
        // Approximate H if missing (standard direction along C=O direction of previous carbonyl)
        let HCoords = H ? { x: H.x, y: H.y, z: H.z } : null;
        if (!HCoords) {
          const C_prev = this.atoms.find(a => a.chainID === D.chainID && a.resSeq === D.resSeq - 1 && a.name.trim() === 'C');
          const O_prev = this.atoms.find(a => a.chainID === D.chainID && a.resSeq === D.resSeq - 1 && a.name.trim() === 'O');
          if (C_prev && O_prev) {
            const vCO = { x: O_prev.x - C_prev.x, y: O_prev.y - C_prev.y, z: O_prev.z - C_prev.z };
            const lenCO = Math.sqrt(vCO.x*vCO.x + vCO.y*vCO.y + vCO.z*vCO.z);
            if (lenCO > 0) {
              HCoords = {
                x: D.x + (vCO.x / lenCO) * 1.01,
                y: D.y + (vCO.y / lenCO) * 1.01,
                z: D.z + (vCO.z / lenCO) * 1.01
              };
            }
          }
        }
        if (!HCoords) {
          // If previous carbonyl is not found, project H along C-alpha direction
          const CA = this.atoms.find(a => a.chainID === D.chainID && a.resSeq === D.resSeq && a.name.trim() === 'CA');
          if (CA) {
            const v = { x: D.x - CA.x, y: D.y - CA.y, z: D.z - CA.z };
            const lenV = Math.sqrt(v.x*v.x + v.y*v.y + v.z*v.z);
            if (lenV > 0) {
              HCoords = {
                x: D.x + (v.x / lenV) * 1.01,
                y: D.y + (v.y / lenV) * 1.01,
                z: D.z + (v.z / lenV) * 1.01
              };
            }
          }
        }

        acceptors.forEach(A => {
          if (D.serial === A.serial) return;
          if (D.chainID === A.chainID && D.resSeq === A.resSeq) return;

          const rON = Math.sqrt((A.x-D.x)**2 + (A.y-D.y)**2 + (A.z-D.z)**2);
          if (rON > 4.5 || rON < 2.0) return;

          // Find carbonyl Carbon for acceptor if it's O
          const C = this.atoms.find(a => a.chainID === A.chainID && a.resSeq === A.resSeq && a.name.trim() === 'C');

          if (HCoords && C) {
            const rCH = Math.sqrt((C.x-HCoords.x)**2 + (C.y-HCoords.y)**2 + (C.z-HCoords.z)**2);
            const rOH = Math.sqrt((A.x-HCoords.x)**2 + (A.y-HCoords.y)**2 + (A.z-HCoords.z)**2);
            const rCN = Math.sqrt((C.x-D.x)**2 + (C.y-D.y)**2 + (C.z-D.z)**2);

            // Kabsch-Sander equation: E = q1 * q2 * (1/rON + 1/rCH - 1/rOH - 1/rCN) * 332 kcal/mol
            // where q1 = 0.42, q2 = 0.20, product is 0.084
            const E = 0.084 * (1/rON + 1/rCH - 1/rOH - 1/rCN) * 332;

            if (E < -0.5) {
              hbonds.push({
                donorSerial: D.serial,
                acceptorSerial: A.serial,
                donorLabel: `/${D.chainID}/${D.resSeq}/${D.resName}/${D.name}`,
                acceptorLabel: `/${A.chainID}/${A.resSeq}/${A.resName}/${A.name}`,
                distance: rON,
                energy: E
              });
              totalEnergy += E;
            }
          }
        });
      });

      let textOutput = '';
      if (hbonds.length > 0) {
        textOutput = `DSSP Electrostatic Hydrogen Bond Analysis for "${targetQuery}":\nTotal H-bonds: ${hbonds.length}\nAverage Energy: ${(totalEnergy/hbonds.length).toFixed(2)} kcal/mol\n\nH-Bond Registry:`;
        hbonds.forEach(hb => {
          textOutput += `\n  ${hb.donorLabel} --> ${hb.acceptorLabel} | d=${hb.distance.toFixed(2)} Å | E=${hb.energy.toFixed(2)} kcal/mol`;
        });
      } else {
        textOutput = `DSSP Hydrogen Bond Analysis failed: zero bonds under -0.5 kcal/mol stability threshold detected.`;
      }

      return {
        selectedSerials: serials,
        textOutput,
        addHBonds: hbonds
      };
    }

    // 13. show / hide / color / center / zoom
    if (qLower.startsWith('show ') || qLower.startsWith('hide ') || qLower.startsWith('color ') || qLower.startsWith('center') || qLower.startsWith('zoom')) {
      const words = qTrim.split(/\s+/);
      const cmd = words[0].toLowerCase();
      const argStr = qTrim.slice(cmd.length).trim();
      const parts = argStr.split(',');
      
      let reprOrColor = parts[0].trim();
      let expr = parts.slice(1).join(',').trim() || 'all';

      if ((cmd === 'center' || cmd === 'zoom') && !argStr.includes(',')) {
        expr = argStr || 'all';
      }

      const serials = this.parse(expr);
      
      let responseText = '';
      if (cmd === 'show') {
        responseText = `Representation '${reprOrColor}' shown on selection '${expr}' (${serials.size} atoms).`;
      } else if (cmd === 'hide') {
        responseText = `Representation '${reprOrColor}' hidden on selection '${expr}' (${serials.size} atoms).`;
      } else if (cmd === 'color') {
        responseText = `Color '${reprOrColor}' applied to selection '${expr}' (${serials.size} atoms).`;
      } else if (cmd === 'center') {
        responseText = `Camera centered on selection '${expr}' (${serials.size} atoms).`;
      } else if (cmd === 'zoom') {
        responseText = `Camera zoomed to bounding box of selection '${expr}' (${serials.size} atoms).`;
      }

      return {
        selectedSerials: serials,
        textOutput: responseText
      };
    }

    // Default: normal selection query parsing
    const res = this.parse(query);
    return { selectedSerials: res };
  }
}
