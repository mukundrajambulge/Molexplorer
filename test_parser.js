const parse = (query) => {
    const tokens = query.match(/[^\s()]+|\(|\)/g) || [];
    let pos = 0;
    
    const parseExpression = () => {
        let left = parseTerm();
        while (pos < tokens.length && tokens[pos]?.toLowerCase() === 'or') {
            pos++;
            left = { type: 'or', left, right: parseTerm() };
        }
        return left;
    }
    
    const parseTerm = () => {
        let left = parseFactor();
        while (pos < tokens.length && tokens[pos]?.toLowerCase() !== 'or' && tokens[pos] !== ')') {
            if (tokens[pos]?.toLowerCase() === 'and') {
                pos++;
            }
            left = { type: 'and', left, right: parseFactor() };
        }
        return left;
    }
    
    const parseFactor = () => {
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
            if (tokens[pos]?.toLowerCase() === 'of') pos++; // skip 'of' if present
            return { type: 'around', distance: dist, operand: parseFactor() };
        }

        // Property selector
        const prop = tokens[pos++];
        const val = tokens[pos++] || '';
        return { type: 'property', property: prop, value: val };
    }

    return parseExpression();
}

console.log(JSON.stringify(parse("byres (chain A around 5 of resn XK2)"), null, 2));
