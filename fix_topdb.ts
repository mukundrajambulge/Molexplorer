import fs from 'fs';

const content = fs.readFileSync('src/lib/MolProcessor.ts', 'utf8');

// We'll extract headers from rawPDB
let newCode = content.replace('toPDB(): string {\n    let out = "";', `toPDB(): string {
    let out = "";
    if (this.rawPDB) {
        const lines = this.rawPDB.split('\\n');
        for (const line of lines) {
            if (line.startsWith("HEADER") || 
                line.startsWith("TITLE") || 
                line.startsWith("COMPND") || 
                line.startsWith("SOURCE") || 
                line.startsWith("KEYWDS") || 
                line.startsWith("EXPDTA") || 
                line.startsWith("AUTHOR") || 
                line.startsWith("REVDAT") || 
                line.startsWith("JRNL") || 
                line.startsWith("REMARK") || 
                line.startsWith("CRYST1") || 
                line.startsWith("HELIX") || 
                line.startsWith("SHEET") ||
                line.startsWith("LINK") ||
                line.startsWith("SSBOND") ||
                line.startsWith("SEQRES")) {
                out += line + (line.endsWith('\\r') ? "\\n" : "\\r\\n");
            }
        }
    }
`);

fs.writeFileSync('src/lib/MolProcessor.ts', newCode);
