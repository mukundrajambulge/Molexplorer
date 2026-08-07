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
}

class SpatialHashGrid {
  cellSize: number;
  grid: Map<string, { x: number; y: number; z: number }[]>;

  constructor(cellSize: number, atoms: Atom[], targetSerials: Set<number>) {
    this.cellSize = cellSize;
    this.grid = new Map();

    atoms.forEach(atom => {
      if (targetSerials.has(atom.serial)) {
        const cx = Math.floor(atom.x / cellSize);
        const cy = Math.floor(atom.y / cellSize);
        const cz = Math.floor(atom.z / cellSize);
        const key = `${cx},${cy},${cz}`;
        if (!this.grid.has(key)) this.grid.set(key, []);
        this.grid.get(key)!.push({ x: atom.x, y: atom.y, z: atom.z });
      }
    });
  }

  isNear(x: number, y: number, z: number): boolean {
    const cx = Math.floor(x / this.cellSize);
    const cy = Math.floor(y / this.cellSize);
    const cz = Math.floor(z / this.cellSize);
    const r2 = this.cellSize * this.cellSize;

    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        for (let dz = -1; dz <= 1; dz++) {
          const key = `${cx + dx},${cy + dy},${cz + dz}`;
          const points = this.grid.get(key);
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

function isSolvent(atom: Atom): boolean {
  const name = (atom.resName || '').toUpperCase();
  return ['HOH', 'WAT', 'DOD', 'SOL', 'TIP3', 'TIP', 'TIP4'].includes(name);
}

function hasCarbons(atom: Atom, atoms: Atom[]): boolean {
  return atoms.some(a => a.chainID === atom.chainID && a.resSeq === atom.resSeq && a.elem.toUpperCase() === 'C');
}

export class SelectionParser {
  atoms: Atom[];

  constructor(atoms: Atom[]) {
    this.atoms = atoms;
  }

  parse(query: string): Set<number> {
    const tokens = this.tokenize(query);
    const expr = this.buildExpression(tokens);
    return this.evaluate(expr);
  }

  tokenize(query: string): string[] {
    const tokenRegex = /\b(and|or|not|byres|bychain|bymolecule|neighbor|extend|around|within|beyond|of|resn|resi|chain|elem|name|b|q|id|alt|segi|metals|donors|acceptors|polymer|organic|inorganic|solvent|hetatm|hydrogens|all|none)\b|<=|>=|==|!=|<|>|=|[a-zA-Z0-9_\-\*\.]+/gi;
    return query.match(tokenRegex) || [];
  }

  buildExpression(tokens: string[]): any {
    let pos = 0;
    
    const parseExpression = (): any => {
        let left = parseTerm();
        while (pos < tokens.length && tokens[pos]?.toLowerCase() === 'or') {
            pos++;
            left = { type: 'or', left, right: parseTerm() };
        }
        return left;
    };
    
    const parseTerm = (): any => {
        let left = parseFactor();
        while (pos < tokens.length && tokens[pos]?.toLowerCase() !== 'or' && tokens[pos] !== ')') {
            if (tokens[pos]?.toLowerCase() === 'and') {
                pos++;
            }
            left = { type: 'and', left, right: parseFactor() };
        }
        return left;
    };
    
    const parseFactor = (): any => {
        if (!tokens[pos]) return null;
        const currentToken = tokens[pos].toLowerCase();

        if (currentToken === 'not') {
            pos++;
            return { type: 'not', operand: parseFactor() };
        }
        if (currentToken === '(') {
            pos++;
            const expr = parseExpression();
            if (tokens[pos] === ')') pos++; // skip ')'
            return expr;
        }
        if (currentToken === 'byres') {
            pos++;
            return { type: 'byres', operand: parseFactor() };
        }
        if (currentToken === 'bychain') {
            pos++;
            return { type: 'bychain', operand: parseFactor() };
        }
        if (currentToken === 'bymolecule') {
            pos++;
            return { type: 'bymolecule', operand: parseFactor() };
        }
        if (currentToken === 'neighbor') {
            pos++;
            return { type: 'neighbor', operand: parseFactor() };
        }
        if (currentToken === 'extend') {
            pos++;
            const steps = parseInt(tokens[pos++]) || 1;
            if (tokens[pos]?.toLowerCase() === 'of') pos++; // skip 'of'
            return { type: 'extend', steps, operand: parseFactor() };
        }
        if (currentToken === 'around' || currentToken === 'within' || currentToken === 'beyond') {
            pos++;
            const dist = parseFloat(tokens[pos++]) || 0.0;
            if (tokens[pos]?.toLowerCase() === 'of') pos++; // skip 'of'
            return { type: currentToken, distance: dist, operand: parseFactor() };
        }

        // Global flag keywords
        if (['organic', 'inorganic', 'polymer', 'solvent', 'hetatm', 'hydrogens', 'metals', 'donors', 'acceptors', 'all', 'none'].includes(currentToken)) {
            pos++;
            return { type: 'flag', flag: currentToken };
        }

        // Property selector
        const prop = tokens[pos++].toLowerCase();
        const nextToken = tokens[pos];
        if (nextToken && ['<=', '>=', '==', '!=', '<', '>', '='].includes(nextToken)) {
            const op = tokens[pos++];
            const val = tokens[pos++];
            return { type: 'comparison', property: prop, op, value: val };
        }

        const val = tokens[pos++] || '';
        return { type: 'property', property: prop, value: val };
    };

    return parseExpression();
  }

  evaluate(expr: any): Set<number> {
    if (!expr) return new Set();

    switch (expr.type) {
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
                            if (bondedAtom) resultNeighbor.add(bondedAtom.serial);
                        });
                    }
                }
            });
            return resultNeighbor;
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
  
  matchProperty(atom: Atom, expr: any): boolean {
    const prop = expr.property.toLowerCase();
    const val = (expr.value || '').toLowerCase();

    if (prop === 'resi' || prop === 'id') {
      const rangeMatch = val.match(/^(\d+)-(\d+)$/);
      if (rangeMatch) {
        const min = parseInt(rangeMatch[1]);
        const max = parseInt(rangeMatch[2]);
        const atomNum = prop === 'resi' ? atom.resSeq : atom.serial;
        return atomNum >= min && atomNum <= max;
      }
    }

    const matchWildcard = (str: string, pattern: string): boolean => {
      const regexStr = '^' + pattern.replace(/\*/g, '.*') + '$';
      const regex = new RegExp(regexStr, 'i');
      return regex.test(str);
    };

    if (prop === 'resn') return matchWildcard(atom.resName, val);
    if (prop === 'chain') return matchWildcard(atom.chainID, val);
    if (prop === 'elem') return matchWildcard(atom.elem, val);
    if (prop === 'name') return matchWildcard(atom.name, val);
    if (prop === 'segi') return matchWildcard(atom.altLoc || '', val); 

    if (prop === 'resi') return atom.resSeq === parseInt(expr.value || '0');
    if (prop === 'id') return atom.serial === parseInt(expr.value || '0');
    return false;
  }

  matchComparison(atom: Atom, expr: any): boolean {
    const prop = expr.property.toLowerCase();
    const op = expr.op;
    const valNum = parseFloat(expr.value);
    
    let atomVal = 0.0;
    if (prop === 'b') {
      atomVal = atom.bFactor !== undefined ? atom.bFactor : 0.0;
    } else if (prop === 'q') {
      atomVal = atom.occupancy !== undefined ? atom.occupancy : 1.0;
    } else if (prop === 'id') {
      atomVal = atom.serial;
    } else if (prop === 'resi') {
      atomVal = atom.resSeq;
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
    switch (flag) {
      case 'organic':
        return !!atom.isHetero && !isSolvent(atom) && hasCarbons(atom, this.atoms);
      case 'inorganic':
        return !!atom.isHetero && !isSolvent(atom) && !hasCarbons(atom, this.atoms);
      case 'polymer':
        return !atom.isHetero;
      case 'solvent':
        return isSolvent(atom);
      case 'hetatm':
        return !!atom.isHetero;
      case 'hydrogens':
        return atom.elem.toUpperCase() === 'H' || atom.elem.toUpperCase() === 'D';
      case 'metals':
        return ['MG', 'ZN', 'FE', 'CA', 'NA', 'K', 'CU', 'MN', 'NI', 'CO'].includes(atom.elem.toUpperCase());
      case 'donors': {
        const hasH = atom.bonds.some(bIdx => {
          const bAtom = this.atoms[bIdx];
          return bAtom && (bAtom.elem.toUpperCase() === 'H' || bAtom.name.trim().toUpperCase().startsWith('H'));
        });
        return ['N', 'O', 'S'].includes(atom.elem.toUpperCase()) && hasH;
      }
      case 'acceptors':
        return ['O', 'N', 'F', 'S'].includes(atom.elem.toUpperCase());
      case 'all':
        return true;
      case 'none':
        return false;
    }
    return false;
  }
}
