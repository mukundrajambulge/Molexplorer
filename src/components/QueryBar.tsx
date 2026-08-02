import { useState } from "react";
import { HelpCircle, Save, Play, Trash2 } from "lucide-react";
import { NamedSelection } from "../types";

export default function QueryBar({ 
  onRunQuery, 
  onSaveSelection,
  onClearSelection
}: { 
  onRunQuery: (query: string) => void,
  onSaveSelection: (name: string, query: string) => void,
  onClearSelection: () => void
}) {
  const [query, setQuery] = useState("");
  const [showHelp, setShowHelp] = useState(false);

  return (
    <div className="bg-[#1a1a1a] p-3 rounded-xl border border-white/10 flex flex-col gap-2">
      <div className="flex gap-2">
        <input 
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Enter selection query (e.g., chain a and resi 125)..."
          className="flex-1 bg-black border border-white/10 rounded-lg p-2 text-sm text-white outline-none focus:border-[#4A90E2]"
        />
        <button onClick={() => setShowHelp(!showHelp)} className="p-2 text-white/50 hover:text-white border border-white/10 rounded-lg">
          <HelpCircle size={16} />
        </button>
        <button onClick={() => onClearSelection()} className="p-2 text-red-500/50 hover:text-red-500 border border-white/10 rounded-lg">
          <Trash2 size={16} />
        </button>
        <button onClick={() => onRunQuery(query)} className="p-2 bg-[#4A90E2] text-white rounded-lg hover:bg-[#3b7bc4]">
          <Play size={16} />
        </button>
        <button onClick={() => onSaveSelection("New Selection", query)} className="p-2 text-white/50 hover:text-white border border-white/10 rounded-lg">
          <Save size={16} />
        </button>
      </div>
      
      {showHelp && (
        <div className="text-xs text-white/60 bg-black p-3 rounded-lg border border-white/10">
          <h4 className="font-semibold text-white mb-2">Syntax Reference:</h4>
          <p>Boolean: and (&), or (|), not (!)</p>
          <p>Spatial: around distance, within distance of selection</p>
          <p>Group: byres, expand distance, gap distance</p>
          <p>Properties: elem, name, resn, resi, chain, b</p>
        </div>
      )}
    </div>
  );
}
