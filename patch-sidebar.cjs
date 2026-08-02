const fs = require('fs');
let content = fs.readFileSync('src/components/SidebarLeft.tsx', 'utf8');

const target = `  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      const content = ev.target?.result as string;
      const format = (file.name.split('.').pop() || 'sdf').toLowerCase();
      
      let parsedFormat = format;
      // map extensions to 3Dmol.js formats if needed
      if (format === 'cml' || format === 'mrv') parsedFormat = 'cml';
      if (format === 'mmcif') parsedFormat = 'cif';

      if (parsedFormat === 'sdf' || parsedFormat === 'mol') {
        // Multi-record parsing
        const blocks = content.split(/\\$\\$\\$\\$\\s*/).filter(b => b.trim().length > 0);
        const mols = blocks.map((block, i) => {
          // Extract name from the first line if possible
          const firstLine = block.split('\\n')[0].trim();
          const molName = firstLine || \`\${file.name} - Record \${i+1}\`;
          
          return {
            id: crypto.randomUUID(),
            name: molName,
            smiles: "",
            format: parsedFormat,
            rawContent: block + '\\n$$$$\\n',
            uploadedAt: Date.now()
          };
        });
        onLoadMolecule(mols);
      } else {
        onLoadMolecule({
          id: crypto.randomUUID(),
          name: file.name,
          smiles: "",
          format: parsedFormat,
          rawContent: content,
          uploadedAt: Date.now()
        });
      }
    };
    reader.readAsText(file);
  };`;

const replacement = `  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const format = (file.name.split('.').pop() || 'sdf').toLowerCase();
    let parsedFormat = format;
    if (format === 'cml' || format === 'mrv') parsedFormat = 'cml';
    if (format === 'mmcif') parsedFormat = 'cif';

    const reader = new FileReader();
    reader.onload = (ev) => {
      const content = ev.target?.result;
      if (!content) return;
      
      if (parsedFormat === 'mmtf') {
         onLoadMolecule({
            id: crypto.randomUUID(),
            name: file.name,
            smiles: "",
            format: parsedFormat,
            rawContent: new Uint8Array(content as ArrayBuffer),
            uploadedAt: Date.now()
         });
         return;
      }
      
      const strContent = content as string;

      if (parsedFormat === 'sdf' || parsedFormat === 'mol') {
        // Multi-record parsing
        const blocks = strContent.split(/\\$\\$\\$\\$\\s*/).filter(b => b.trim().length > 0);
        const mols = blocks.map((block, i) => {
          // Extract name from the first line if possible
          const firstLine = block.split('\\n')[0].trim();
          const molName = firstLine || \`\${file.name} - Record \${i+1}\`;
          
          return {
            id: crypto.randomUUID(),
            name: molName,
            smiles: "",
            format: parsedFormat,
            rawContent: block + '\\n$$$$\\n',
            uploadedAt: Date.now()
          };
        });
        onLoadMolecule(mols);
      } else {
        onLoadMolecule({
          id: crypto.randomUUID(),
          name: file.name,
          smiles: "",
          format: parsedFormat,
          rawContent: strContent,
          uploadedAt: Date.now()
        });
      }
    };
    
    if (parsedFormat === 'mmtf') {
      reader.readAsArrayBuffer(file);
    } else {
      reader.readAsText(file);
    }
  };`;

fs.writeFileSync('src/components/SidebarLeft.tsx', content.replace(target, replacement));
