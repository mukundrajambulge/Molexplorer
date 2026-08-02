import React, { useState } from "react";
import { Upload, Search, FileCode, SlidersHorizontal, Settings2 } from "lucide-react";
import { MoleculeData, FilterState } from "../types";
import { getRDKit } from "../lib/rdkit";
import FilterPanel from "./FilterPanel";

interface SidebarLeftProps {
  onLoadMolecule: (mols: MoleculeData | MoleculeData[]) => void;
  filters: FilterState;
  setFilters: React.Dispatch<React.SetStateAction<FilterState>>;
}

export default function SidebarLeft({ onLoadMolecule, filters, setFilters }: SidebarLeftProps) {
  const [smilesInput, setSmilesInput] = useState("");
  const [pubchemId, setPubchemId] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [activeTab, setActiveTab] = useState<"import" | "filters">("import");

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
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
        const blocks = content.split(/\$\$\$\$\s*/).filter(b => b.trim().length > 0);
        const mols = blocks.map((block, i) => {
          // Extract name from the first line if possible
          const firstLine = block.split('\n')[0].trim();
          const molName = firstLine || `${file.name} - Record ${i+1}`;
          
          return {
            id: crypto.randomUUID(),
            name: molName,
            smiles: "",
            format: parsedFormat,
            rawContent: block + '\n$$$$\n',
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
  };

  const handleFetchPubChem = async () => {
    if (!pubchemId.trim()) return;
    setIsProcessing(true);
    try {
      const input = pubchemId.trim();
      const isCid = /^\d+$/.test(input);
      const typePath = isCid ? `cid/${input}` : `name/${encodeURIComponent(input)}`;
      
      // Try PubChem 3D first
      let url = `https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/${typePath}/record/SDF/?record_type=3d`;
      let res = await fetch(url);
      
      if (!res.ok) {
        // Fallback to Cactus API if PubChem 3D is missing/failing
        url = `https://cactus.nci.nih.gov/chemical/structure/${encodeURIComponent(input)}/file?format=sdf&get3d=true`;
        res = await fetch(url);
      }

      if (!res.ok) {
        // Final fallback to PubChem 2D
        url = `https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/${typePath}/record/SDF/?record_type=2d`;
        res = await fetch(url);
      }

      if (!res.ok) throw new Error("Failed to fetch molecule from both PubChem and Cactus.");
      
      const sdfText = await res.text();
      onLoadMolecule({
        id: crypto.randomUUID(),
        name: isCid ? `CID ${input}` : input,
        smiles: "",
        format: "sdf",
        rawContent: sdfText,
        uploadedAt: Date.now()
      });
    } catch (e: any) {
      alert("Error fetching molecule: " + e.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleProcessSmiles = async () => {
    if (!smilesInput.trim()) return;
    setIsProcessing(true);
    try {
      const smiles = smilesInput.trim();
      
      // Use Cactus API to get 3D coordinates for the SMILES
      const url = `https://cactus.nci.nih.gov/chemical/structure/${encodeURIComponent(smiles)}/file?format=sdf&get3d=true`;
      const res = await fetch(url);
      
      if (!res.ok) {
        throw new Error("Failed to generate 3D coordinates from SMILES");
      }
      
      const sdfText = await res.text();
      
      onLoadMolecule({
        id: crypto.randomUUID(),
        name: "SMILES",
        smiles: smiles,
        format: "sdf",
        rawContent: sdfText,
        uploadedAt: Date.now()
      });
    } catch (e: any) {
      alert("Error parsing SMILES: " + e.message);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="w-full h-full bg-transparent flex flex-col overflow-hidden">
      <div className="flex border-b border-white/10 text-[10px] font-mono tracking-widest uppercase">
        <button 
          onClick={() => setActiveTab('import')}
          className={`flex-1 py-4 border-b-2 transition-colors ${activeTab === 'import' ? 'border-[#F27D26] text-[#F27D26]' : 'border-transparent opacity-50 hover:opacity-100'}`}
        >
          Import
        </button>
        <button 
          onClick={() => setActiveTab('filters')}
          className={`flex-1 py-4 border-b-2 transition-colors ${activeTab === 'filters' ? 'border-[#F27D26] text-[#F27D26]' : 'border-transparent opacity-50 hover:opacity-100'}`}
        >
          Filters
        </button>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar p-6">
        {activeTab === 'import' ? (
          <div className="flex flex-col gap-8">
            <div>
              <h2 className="text-[10px] tracking-[0.3em] uppercase opacity-50 mb-3 flex items-center gap-2">
                <Upload size={12} /> Load File
              </h2>
              <div className="border border-white/10 border-dashed rounded-xl p-6 text-center hover:bg-white/[0.03] hover:border-[#F27D26]/50 transition-all cursor-pointer relative group">
                <input 
                  type="file" 
                  className="absolute inset-0 opacity-0 cursor-pointer" 
                  accept=".sdf,.mol,.mol2,.pdb,.xyz,.cif,.mmtf"
                  onChange={handleFileUpload}
                />
                <span className="text-[11px] font-mono tracking-widest uppercase group-hover:text-[#F27D26] transition-colors">Select File</span>
                <div className="text-[9px] opacity-40 mt-2 font-mono">.SDF, .PDB, .MOL, .MMTF</div>
              </div>
            </div>

            <div>
              <h2 className="text-[10px] tracking-[0.3em] uppercase opacity-50 mb-3 flex items-center gap-2">
                <FileCode size={12} /> Paste SMILES
              </h2>
              <div className="flex flex-col gap-3">
                <textarea 
                  placeholder="e.g. CCO"
                  className="w-full text-[11px] font-mono bg-white/[0.03] border border-white/10 rounded-xl px-3 py-2 text-[#F0F0F0] placeholder:opacity-30 focus:outline-none focus:border-[#F27D26]/50 resize-none h-24 transition-colors"
                  value={smilesInput}
                  onChange={(e) => setSmilesInput(e.target.value)}
                />
                <button 
                  onClick={handleProcessSmiles}
                  disabled={isProcessing}
                  className="bg-white text-black py-2 rounded-xl text-[10px] uppercase font-bold tracking-[0.2em] hover:bg-[#F27D26] hover:text-white transition-all disabled:opacity-50"
                >
                  Render 3D
                </button>
              </div>
            </div>

            <div>
              <h2 className="text-[10px] tracking-[0.3em] uppercase opacity-50 mb-3 flex items-center gap-2">
                <Search size={12} /> Fetch from PubChem
              </h2>
              <div className="flex flex-col gap-3">
                <input 
                  type="text"
                  placeholder="CID (e.g. 2244)"
                  className="w-full text-[11px] font-mono bg-white/[0.03] border border-white/10 rounded-xl px-3 py-2 text-[#F0F0F0] placeholder:opacity-30 focus:outline-none focus:border-[#F27D26]/50 transition-colors"
                  value={pubchemId}
                  onChange={(e) => setPubchemId(e.target.value)}
                />
                <button 
                  onClick={handleFetchPubChem}
                  disabled={isProcessing}
                  className="bg-white text-black py-2 rounded-xl text-[10px] uppercase font-bold tracking-[0.2em] hover:bg-[#F27D26] hover:text-white transition-all disabled:opacity-50"
                >
                  Fetch API
                </button>
              </div>
            </div>
          </div>
        ) : (
          <FilterPanel filters={filters} setFilters={setFilters} />
        )}
      </div>
    </div>
  );
}
