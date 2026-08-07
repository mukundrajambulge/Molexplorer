const fs = require('fs');
const path = require('path');

const filePath = path.join('d:', 'Projects', 'Molexplorer', 'src', 'pages', 'MolStudio.tsx');
let content = fs.readFileSync(filePath, 'utf8');

// 1. Replace handleFetch
const targetFetch = `  const handleFetch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fetchId) return;
    setIsFetching(true);
    try {
       const res = await fetch(\`https://files.rcsb.org/download/\${fetchId.toUpperCase()}.pdb\`);
       if (!res.ok) throw new Error("Failed to fetch PDB from RCSB");
       const text = await res.text();
       setMolData({ data: text, format: 'pdb' });
       setCleaningState(defaultCleaningState);
       setFetchId("");
    } catch (err: any) {
       alert("Error fetching structure: " + err.message);
    } finally {
       setIsFetching(false);
    }
  };`;

const replacementFetch = `  const handleFetch = async (id: string) => {
    if (!id) return;
    setIsFetching(true);
    try {
       const res = await fetch(\`https://files.rcsb.org/download/\${id.toUpperCase()}.pdb\`);
       if (!res.ok) throw new Error("Failed to fetch PDB from RCSB");
       const text = await res.text();
       setMolData({ data: text, format: 'pdb', name: id.toUpperCase() });
       setCleaningState(defaultCleaningState);
    } catch (err: any) {
       alert("Error fetching structure: " + err.message);
    } finally {
       setIsFetching(false);
    }
  };`;

// 2. Replace onFetchPdb prop
const targetProp = `        onFetchPdb={(id) => { setFetchId(id); }}`;
const replacementProp = `        onFetchPdb={handleFetch}`;

// 3. Replace Status Overlay to add isFetching spinner
const targetOverlay = `        {/* Status Overlay */}
        <div className="absolute top-4 right-4 z-10 flex flex-col gap-2">
          {cleaningState.hydrogens_added && (
            <div className="bg-orange-500/10 border border-orange-500/20 text-orange-400 px-3 py-1.5 rounded-lg text-xs backdrop-blur-md flex items-center gap-2 shadow-lg pointer-events-none">
              <Info size={12} />
              Hydrogens are modeled, not experimentally observed
            </div>
          )}
        </div>`;

const replacementOverlay = `        {/* Status Overlay */}
        <div className="absolute top-4 right-4 z-10 flex flex-col gap-2">
          {isFetching && (
            <div className="bg-[#111111]/80 border border-white/10 text-white px-3 py-1.5 rounded-lg text-xs backdrop-blur-md flex items-center gap-2 shadow-lg pointer-events-none">
              <div className="w-3 h-3 border-2 border-orange-500/30 border-t-orange-500 rounded-full animate-spin" />
              <span>Fetching structure from RCSB...</span>
            </div>
          )}
          {cleaningState.hydrogens_added && (
            <div className="bg-orange-500/10 border border-orange-500/20 text-orange-400 px-3 py-1.5 rounded-lg text-xs backdrop-blur-md flex items-center gap-2 shadow-lg pointer-events-none">
              <Info size={12} />
              Hydrogens are modeled, not experimentally observed
            </div>
          )}
        </div>`;

// Apply replacements
function replaceAll(target, replacement) {
  const normTarget = target.replace(/\r\n/g, '\n');
  const normContent = content.replace(/\r\n/g, '\n');
  if (normContent.includes(normTarget)) {
    content = normContent.replace(normTarget, replacement.replace(/\r\n/g, '\n'));
    console.log("Success: Replaced target!");
  } else {
    // Try fuzzy match by removing whitespaces
    console.log("Error: Target not found!");
  }
}

replaceAll(targetFetch, replacementFetch);
replaceAll(targetProp, replacementProp);
replaceAll(targetOverlay, replacementOverlay);

fs.writeFileSync(filePath, content, 'utf8');
console.log("Finished patching MolStudio.tsx!");
