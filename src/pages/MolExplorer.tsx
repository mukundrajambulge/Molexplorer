import { useState, useEffect, useRef } from "react";
import SidebarLeft from "../components/SidebarLeft";
import SidebarRight from "../components/SidebarRight";
import Toolbar from "../components/Toolbar";
import Viewer3D from "../components/Viewer3D";
import { ExportModal } from "../components/ExportModal";
import SketcherModal from "../components/SketcherModal";
import LibraryTable from "../components/LibraryTable";
import { MoleculeData, ViewState, FilterState, TableSortState } from "../types";
import { getRDKit } from "../lib/rdkit";
import { Info, Download, SlidersHorizontal, BarChart2, X, ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";

export default function MolExplorer() {
  const [molecule, setMolecule] = useState<MoleculeData | null>(null);
  const [compareMolecule, setCompareMolecule] = useState<MoleculeData | null>(null);
  const [library, setLibrary] = useState<MoleculeData[]>([]);
  const [showLeftSidebar, setShowLeftSidebar] = useState(false);
  const [showRightSidebar, setShowRightSidebar] = useState(false);
  const [isLibraryCollapsed, setIsLibraryCollapsed] = useState(false);

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 1024) {
        setShowLeftSidebar(true);
        setShowRightSidebar(true);
      } else {
        setShowLeftSidebar(false);
        setShowRightSidebar(false);
      }
    };
    handleResize();
  }, []);

  const [filters, setFilters] = useState<FilterState>({
    searchQuery: "",
    massRange: [0, 2000],
    logpRange: [-10, 15],
    hbdRange: [0, 20],
    hbaRange: [0, 20],
    tpsaRange: [0, 300],
    rotatableRange: [0, 50],
    maxRo5Violations: null,
    librarySmarts: "",
    visualSmarts: "",
    showStereoCenters: false,
    hiddenElements: [],
  });

  const [sortState, setSortState] = useState<TableSortState>({
    column: "name",
    direction: "asc"
  });

  const [viewState, setViewState] = useState<ViewState>({
    renderStyle: "Ball-and-Stick",
    colorTheme: "Modern/Jmol",
    showHydrogens: false,
    showLabels: false,
    surfaceOpacity: 0.8,
    canvasBackground: "black",
    electronCloudMode: "None",
    performanceMode: false
  });
  const [isRDKitReady, setIsRDKitReady] = useState(false);
  const [showAbout, setShowAbout] = useState(false);
  const [showExport, setShowExport] = useState(false);
  const [showSketcher, setShowSketcher] = useState(false);
  const viewerRef = useRef<any>(null);

  useEffect(() => {
    getRDKit().then(() => setIsRDKitReady(true));
  }, []);

  const handleLoadMolecule = async (mols: MoleculeData | MoleculeData[]) => {
    const newMols = Array.isArray(mols) ? mols : [mols];
    if (newMols.length === 0) return;
    
    // Enrich with RDKit descriptors if available
    if (isRDKitReady) {
      const rdkit = await getRDKit();
      for (const m of newMols) {
        m.warnings = [];
        if (m.format === "SMILES") {
          m.warnings.push("Imported from SMILES (lacks explicit 3D coords). 3D geometry generated via rapid approximation.");
        } else if (typeof m.rawContent === "string" && m.rawContent.split("$$$$").length > 2) {
          m.warnings.push("Multi-fragment SDF detected. Only the first molecule was parsed.");
        }

        try {
          const mol = (typeof m.rawContent === "string" && m.format !== "mmtf") ? rdkit.get_mol(m.rawContent || m.smiles) : null;
          if (mol) {
            if (!m.smiles) m.smiles = mol.get_smiles();
            m.properties = JSON.parse(mol.get_descriptors());
            
            try {
              const fpStr = mol.get_morgan_fp();
              m.fingerprint = fpStr.split('').reduce((acc: number[], bit: string, i: number) => {
                if (bit === '1') acc.push(i);
                return acc;
              }, []);
            } catch(e) {}
            
            // Calculate Lipinski violations
            let ro5Violations = 0;
            if (m.properties.amw > 500) ro5Violations++;
            if (m.properties.CrippenClogP > 5) ro5Violations++;
            if (m.properties.NumHDonors > 5) ro5Violations++;
            if (m.properties.NumHAcceptors > 10) ro5Violations++;
            m.properties.ro5Violations = ro5Violations;

            mol.delete();
          }
        } catch(e) {}
      }
    }
    
    setLibrary(prev => [...newMols, ...prev]);
    setMolecule(newMols[0]);
  };

  const filteredLibrary = library.filter(mol => {
    // Text search
    if (filters.searchQuery) {
      const q = filters.searchQuery.toLowerCase();
      if (!mol.name.toLowerCase().includes(q) && 
          !mol.smiles?.toLowerCase().includes(q) && 
          !mol.properties?.formula?.toLowerCase().includes(q)) {
        return false;
      }
    }
    
    // Properties ranges
    if (mol.properties) {
      const p = mol.properties;
      if (p.amw < filters.massRange[0] || p.amw > filters.massRange[1]) return false;
      if (p.CrippenClogP < filters.logpRange[0] || p.CrippenClogP > filters.logpRange[1]) return false;
      if (p.NumHDonors < filters.hbdRange[0] || p.NumHDonors > filters.hbdRange[1]) return false;
      if (p.NumHAcceptors < filters.hbaRange[0] || p.NumHAcceptors > filters.hbaRange[1]) return false;
      if (p.tpsa < filters.tpsaRange[0] || p.tpsa > filters.tpsaRange[1]) return false;
      if (p.NumRotatableBonds < filters.rotatableRange[0] || p.NumRotatableBonds > filters.rotatableRange[1]) return false;
      if (filters.maxRo5Violations !== null && p.ro5Violations > filters.maxRo5Violations) return false;
    }
    
    return true;
  });

  return (
    <div className="h-screen w-screen flex flex-col font-sans overflow-hidden bg-[#0A0A0A] text-[#F0F0F0] relative">
      <div className="absolute top-[-100px] left-[-100px] w-[500px] h-[500px] bg-gradient-to-br from-[#1a1a1a] to-transparent rounded-full blur-[100px] opacity-40 pointer-events-none z-0"></div>

      <header className="h-16 border-b border-white/10 flex items-center justify-between px-4 sm:px-8 bg-transparent flex-shrink-0 z-20 relative">
        <div className="flex items-center gap-2 sm:gap-4">
          <Link 
            to="/"
            className="p-2 rounded-lg border border-white/10 text-white/70 hover:text-white hover:border-white/20 transition-all bg-transparent"
            title="Back to Home"
          >
            <ArrowLeft size={16} />
          </Link>

          <button 
            onClick={() => setShowLeftSidebar(!showLeftSidebar)}
            className={`p-2 rounded-lg border transition-all ${showLeftSidebar ? 'border-[#F27D26] text-[#F27D26] bg-[#F27D26]/10' : 'border-white/10 text-white/70 hover:text-white hover:border-white/20'}`}
            title="Import & Filters"
          >
            <SlidersHorizontal size={16} />
          </button>
          
          <Link to="/" className="text-base sm:text-xl tracking-tight flex items-center gap-2 sm:gap-3 select-none hover:opacity-80 transition-opacity">
            <div className="w-5 h-5 sm:w-6 sm:h-6 border border-white/20 rounded-full flex items-center justify-center text-[#F27D26] text-[10px] font-serif italic">M</div>
            <span className="font-light tracking-tighter">Mol<span className="font-serif italic text-[#F27D26]">Explorer</span></span>
          </Link>
        </div>

        <div className="flex items-center gap-2 sm:gap-4">
          <button 
            onClick={() => setShowSketcher(true)}
            className="text-[10px] uppercase tracking-[0.2em] opacity-70 hover:text-[#F27D26] hover:opacity-100 flex items-center gap-1.5 sm:gap-2 transition-colors py-2 px-1"
          >
            <span className="hidden sm:inline">2D Sketcher</span>
          </button>
          
          <button 
            onClick={() => setShowExport(true)}
            className="text-[10px] uppercase tracking-[0.2em] opacity-70 hover:text-[#F27D26] hover:opacity-100 flex items-center gap-1.5 sm:gap-2 transition-colors py-2 px-1"
          >
            <Download size={16} />
            <span className="hidden sm:inline">Export</span>
          </button>
          <button 
            onClick={() => setShowAbout(true)}
            className="text-[10px] uppercase tracking-[0.2em] opacity-70 hover:text-[#F27D26] hover:opacity-100 flex items-center gap-1.5 sm:gap-2 transition-colors py-2 px-1"
          >
            <Info size={16} />
            <span className="hidden sm:inline">About</span>
          </button>

          <div className="h-4 w-px bg-white/10" />

          <button 
            onClick={() => setShowRightSidebar(!showRightSidebar)}
            className={`p-2 rounded-lg border transition-all ${showRightSidebar ? 'border-[#F27D26] text-[#F27D26] bg-[#F27D26]/10' : 'border-white/10 text-white/70 hover:text-white hover:border-white/20'}`}
            title="Properties & Metrics"
          >
            <BarChart2 size={16} />
          </button>
        </div>
      </header>
      
      <div className="flex flex-1 overflow-hidden z-10 relative">
        {/* Backdrop for Left Sidebar on Mobile/Tablet */}
        {showLeftSidebar && (
          <div 
            className="lg:hidden absolute inset-0 bg-black/60 z-30 transition-opacity duration-300"
            onClick={() => setShowLeftSidebar(false)}
          />
        )}
        
        {/* Left Sidebar Container */}
        <div className={`
          absolute lg:relative top-0 bottom-0 left-0 
          h-full w-72 z-40 lg:z-20 border-r border-white/10 flex flex-col
          bg-[#0A0A0A] lg:bg-transparent transition-transform duration-300 ease-in-out
          ${showLeftSidebar ? 'translate-x-0' : '-translate-x-full lg:translate-x-0 lg:hidden'}
        `}>
          <div className="flex-1 overflow-hidden">
            <SidebarLeft onLoadMolecule={handleLoadMolecule} filters={filters} setFilters={setFilters} />
          </div>
        </div>
        
        {/* Main Work Area */}
        <main className="flex-1 flex flex-col relative bg-transparent z-10 min-w-0">
          <Toolbar viewState={viewState} onViewStateChange={setViewState} />
          
          <div className="flex-1 relative min-h-0">
            <Viewer3D ref={viewerRef} molecule={molecule} compareMolecule={compareMolecule} viewState={viewState} filters={filters} />
          </div>
          {library.length > 1 && (
            <LibraryTable 
              library={filteredLibrary} 
              selectedMoleculeId={molecule?.id} 
              compareMoleculeId={compareMolecule?.id}
              onSelectMolecule={setMolecule} 
              onCompareMolecule={setCompareMolecule}
              sortState={sortState} 
              setSortState={setSortState} 
              isCollapsed={isLibraryCollapsed}
              onToggleCollapse={() => setIsLibraryCollapsed(!isLibraryCollapsed)}
            />
          )}
        </main>

        {/* Backdrop for Right Sidebar on Mobile/Tablet */}
        {showRightSidebar && (
          <div 
            className="lg:hidden absolute inset-0 bg-black/60 z-30 transition-opacity duration-300"
            onClick={() => setShowRightSidebar(false)}
          />
        )}

        {/* Right Sidebar Container */}
        <div className={`
          absolute lg:relative top-0 bottom-0 right-0 
          h-full w-80 z-40 lg:z-20 border-l border-white/10 flex flex-col
          bg-[#0A0A0A] lg:bg-white/[0.03] lg:backdrop-blur-xl transition-transform duration-300 ease-in-out
          ${showRightSidebar ? 'translate-x-0' : 'translate-x-full lg:translate-x-0 lg:hidden'}
        `}>
          <div className="flex-1 overflow-hidden">
            <SidebarRight molecule={molecule} library={filteredLibrary} onSelectMolecule={setMolecule} />
          </div>
        </div>
      </div>
      
      <ExportModal 
        isOpen={showExport} 
        onClose={() => setShowExport(false)} 
        molecule={molecule} 
        viewerRef={viewerRef} 
      />

      {showSketcher && (
         <SketcherModal 
           onClose={() => setShowSketcher(false)}
           onImport={handleLoadMolecule}
         />
      )}

      {!isRDKitReady && (
        <div className="fixed bottom-6 left-6 bg-white/[0.03] backdrop-blur-xl border border-white/10 rounded-2xl px-5 py-3 text-[11px] font-mono tracking-widest uppercase z-50 flex items-center gap-3">
          <div className="w-4 h-4 border-2 border-[#F27D26] border-t-transparent rounded-full animate-spin"></div>
          Initializing RDKit...
        </div>
      )}

      {showAbout && (
         <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xl">
            <div className="bg-[#0A0A0A] border border-white/10 rounded-3xl w-full max-w-2xl p-10 relative">
               <button 
                  onClick={() => setShowAbout(false)}
                  className="absolute top-6 right-6 text-white/40 hover:text-white text-lg transition-colors"
               >
                  &times;
               </button>
               <h2 className="text-3xl font-light tracking-tighter mb-6">Mol<span className="font-serif italic text-[#F27D26]">Explorer</span></h2>
               <div className="prose text-sm text-[#F0F0F0]/70 font-light max-h-96 overflow-y-auto pr-4">
                  <p>MolExplorer is a lightweight, browser-based stand-in for the computational drug-design (CADD) stack used across the pharmaceutical and biotech industry.</p>
                  <h3 className="font-semibold text-gray-900 mt-4 mb-2">Industry Context</h3>
                  <ul className="list-disc pl-5 space-y-1">
                     <li><strong>Enterprise Tier</strong> (e.g. Schrödinger Maestro, BIOVIA Discovery Studio): Licensed per-seat, costly, requiring dedicated IT. This creates a barrier for quick, universal access.</li>
                     <li><strong>Mid-market Tier</strong> (e.g. MOE): Popular with smaller biotechs, fully scriptable, but still bundled and priced.</li>
                     <li><strong>Zero-licence-cost Tier</strong> (e.g. PyMOL, Avogadro, GROMACS): Scientifically validated pipeline with no licensing cost. MolExplorer aims for this spirit.</li>
                     <li><strong>Free Web Tools</strong> (e.g. SwissADME, PubChem Viewer): Instantly accessible. MolExplorer seeks to provide a similar frictionless experience.</li>
                     <li><strong>Built as an educational tool</strong> for bioinformatics and cheminformatics students.</li>
                  </ul>
                  
                  <h3 className="font-semibold text-gray-900 mt-6 mb-2">Open Source Attributions</h3>
                  <p className="text-xs opacity-70">
                    This software utilizes <a href="https://3dmol.csb.pitt.edu/" target="_blank" rel="noreferrer" className="text-[#F27D26] hover:underline">3Dmol.js</a> for high-performance 3D molecular rendering. 
                    3Dmol.js is distributed under the BSD License.
                  </p>
               </div>
            </div>
         </div>
      )}
    </div>
  );
}
