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
    const tokenRegex = /\b(and|or|not|byres|bychain|bymolecule|neighbor|extend|around|within|beyond|of|resn|resi|chain|elem|name|b|q|id|alt|segi|metals|donors|acceptors|polymer|organic|inorganic|solvent|hetatm|hydrogens|all|none)\b|<=|>=|==|!=|<|>|=|\(|\)|[a-zA-Z0-9_\-\*\.]+/gi;
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
    if (prop === 'ss') {
      const atomSS = (atom.ss || '').toLowerCase();
      const valLower = val.toLowerCase();
      if (valLower === 'h' || valLower === 'helix') {
        return atomSS === 'h' || atomSS === 'helix';
      }
      if (valLower === 's' || valLower === 'sheet' || valLower === 'strand' || valLower === 'e') {
        return atomSS === 's' || atomSS === 'sheet' || atomSS === 'e';
      }
      if (valLower === 'l' || valLower === 'loop' || valLower === 'c' || valLower === 'coil') {
        return atomSS === 'l' || atomSS === 'loop' || atomSS === 'c' || atomSS === 'coil';
      }
      return matchWildcard(atomSS, val);
    }

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

  evaluateCommand(
    query: string,
    namedSelections?: { name: string; query: string; atomIds: number[] }[],
    activeObjectName?: string
  ): { 
    selectedSerials: Set<number>; 
    textOutput?: string; 
    saveSelection?: { name: string; query: string };
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
  } {
    const qTrim = query.trim();
    const qLower = qTrim.toLowerCase();

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

    // 1. select name, expr
    if (qLower.startsWith('select ')) {
      const parts = qTrim.slice(7).split(',');
      if (parts.length >= 2) {
        const name = parts[0].trim();
        const expr = parts.slice(1).join(',').trim();
        const serials = this.parse(expr);
        return {
          selectedSerials: serials,
          textOutput: `Selector: selection "${name}" defined with ${serials.size} atoms.`,
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
