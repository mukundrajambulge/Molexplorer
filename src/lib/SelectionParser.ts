
// Minimal Atom interface
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

  tokenize(query: string): any[] {
    // Correctly matches keywords AND alphanumeric tokens as single units
    const tokenRegex = /\(|\)|and|or|not|byres|around|within|of|expand|gap|resn|resi|chain|elem|name|b|\w+/gi;
    return query.match(tokenRegex) || [];
  }

  buildExpression(tokens: any[]): any {
    // Recursive descent parser
    let pos = 0;
    
    const parseExpression = (): any => {
        let left = parseTerm();
        while (pos < tokens.length && tokens[pos]?.toLowerCase() === 'or') {
            pos++;
            left = { type: 'or', left, right: parseTerm() };
        }
        return left;
    }
    
    const parseTerm = (): any => {
        let left = parseFactor();
        while (pos < tokens.length && tokens[pos]?.toLowerCase() !== 'or' && tokens[pos] !== ')') {
            if (tokens[pos]?.toLowerCase() === 'and') {
                pos++;
            }
            left = { type: 'and', left, right: parseFactor() };
        }
        return left;
    }
    
    const parseFactor = (): any => {
        if (!tokens[pos]) return null;
        if (tokens[pos].toLowerCase() === 'not') {
            pos++;
            return { type: 'not', operand: parseFactor() };
        }
        if (tokens[pos] === '(') {
            pos++;
            const expr = parseExpression();
            pos++; // skip ')'
            return expr;
        }
        
        const token = tokens[pos].toLowerCase();
        
        if (token === 'byres') {
            pos++;
            return { type: 'byres', operand: parseFactor() };
        }
        
        if (token === 'around') {
            pos++;
            const dist = parseFloat(tokens[pos++]);
            if (tokens[pos]?.toLowerCase() === 'of') pos++; // skip 'of'
            return { type: 'around', distance: dist, operand: parseFactor() };
        }

        // Property selector
        const prop = tokens[pos++];
        const val = tokens[pos++] || '';
        return { type: 'property', property: prop, value: val };
    }

    return parseExpression();
  }

  evaluate(expr: any): Set<number> {
    if (!expr) return new Set();

    switch (expr.type) {
        case 'property':
            const result = new Set<number>();
            this.atoms.forEach(atom => {
                if (this.matchProperty(atom, expr)) {
                    result.add(atom.serial);
                }
            });
            return result;
        case 'and': 
            const s1 = this.evaluate(expr.left);
            const s2 = this.evaluate(expr.right);
            return new Set([...s1].filter(x => s2.has(x)));
        case 'or':
            const s3 = this.evaluate(expr.left);
            const s4 = this.evaluate(expr.right);
            return new Set([...s3, ...s4]);
        case 'not':
            const all = new Set(this.atoms.map(a => a.serial));
            const s5 = this.evaluate(expr.operand);
            return new Set([...all].filter(x => !s5.has(x)));
        case 'byres':
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
        case 'around':
            const s7 = this.evaluate(expr.operand);
            const targetAtoms = this.atoms.filter(a => s7.has(a.serial));
            const resultAround = new Set<number>();
            this.atoms.forEach(atom => {
                let isAround = false;
                for (const target of targetAtoms) {
                    const dx = atom.x - target.x;
                    const dy = atom.y - target.y;
                    const dz = atom.z - target.z;
                    if (Math.sqrt(dx*dx + dy*dy + dz*dz) <= expr.distance) {
                        isAround = true;
                        break;
                    }
                }
                if (isAround) resultAround.add(atom.serial);
            });
            return resultAround;
    }
    return new Set();
  }
  
  matchProperty(atom: Atom, expr: any): boolean {
    const val = (expr.value || '').toLowerCase();
    const resn = (atom.resName || '').toLowerCase();
    const chain = (atom.chainID || '').toLowerCase();
    
    if (expr.property === 'resn') return resn === val;
    if (expr.property === 'chain') return chain === val;
    if (expr.property === 'resi') return atom.resSeq === parseInt(expr.value || '0');
    return false;
  }
}
