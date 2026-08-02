import { useState, useEffect, useMemo, useRef } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Upload, RefreshCw, Layers, Droplet, CheckSquare, Settings2, Info, Box, Cuboid, SlidersHorizontal, X, Save, FolderOpen } from "lucide-react";
import MolStudioViewer, { MolStudioViewerRef } from "../components/MolStudioViewer";
import QueryBar from "../components/QueryBar";
import { RenderStyle, NamedSelection } from "../types";
import { SSInfo, MolProcessor } from "../lib/MolProcessor";
import { alignStructures, AlignmentResult } from "../lib/Alignment";
import { convertToPDBQT, runWebina, formatError } from "../lib/Docking";
import { SelectionParser } from "../lib/SelectionParser";
import { calculateInteractions, Interaction } from "../lib/Interactions";

interface CleaningState {
  bond_tolerance: number;
  altloc_filtered: boolean;
  solvent_stripped: boolean;
  hydrogens_added: boolean;
  ss_mode: 'pdb' | 'quick' | 'dssp';
}

interface AssemblyState {
  active_assembly_id: string | null;
  generated_assembly_chains: string[];
  symmetry_mates_generated: boolean;
  symmetry_mate_count: number;
}

export default function MolStudio() {
  const [molData, setMolData] = useState<{data: string | Uint8Array, format: 'pdb' | 'mmtf', name?: string} | null>(null);
  const [processedPDB, setProcessedPDB] = useState<string | null>(null);
  const [atoms, setAtoms] = useState<any[]>([]);
  const [selectedAtomSerials, setSelectedAtomSerials] = useState<Set<number>>(new Set());
  const [focusTrigger, setFocusTrigger] = useState<number>(0);
  const [assemblyPDB, setAssemblyPDB] = useState<string | null>(null);
  const [symmetryPDB, setSymmetryPDB] = useState<string | null>(null);
  const [ssData, setSsData] = useState<SSInfo[]>([]);
  
  const defaultState: CleaningState = {
    bond_tolerance: 1.15,
    altloc_filtered: false,
    solvent_stripped: false,
    hydrogens_added: false,
    ss_mode: 'pdb'
  };
  
  const [cleaningState, setCleaningState] = useState<CleaningState>(defaultState);

  const [assemblyState, setAssemblyState] = useState<AssemblyState>({
    active_assembly_id: null,
    generated_assembly_chains: [],
    symmetry_mates_generated: false,
    symmetry_mate_count: 0
  });

  const [availableAssemblies, setAvailableAssemblies] = useState<{id: string, isIdentityOnly: boolean}[]>([]);
  const [hasSymmetryInfo, setHasSymmetryInfo] = useState(false);
  const [debugRemarks, setDebugRemarks] = useState<string[]>([]);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [renderStyle, setRenderStyle] = useState<RenderStyle>("Cartoon");
  const [colorScheme, setColorScheme] = useState<string>("spectrum");
  const [surfaceOpacity, setSurfaceOpacity] = useState<number>(0.7);
  const [backgroundColor, setBackgroundColor] = useState<string>('#f0f0f0');
  const [namedSelections, setNamedSelections] = useState<NamedSelection[]>([]);
  
  // Alignment state
  const [alignMol, setAlignMol] = useState<{data: string | Uint8Array, format: 'pdb' | 'mmtf', name: string} | null>(null);
  const [alignmentResult, setAlignmentResult] = useState<AlignmentResult | null>(null);
  const [alignError, setAlignError] = useState("");
  const [alignFetchId, setAlignFetchId] = useState("");
  const [isAlignFetching, setIsAlignFetching] = useState(false);

  // Docking state
  const [ligandData, setLigandData] = useState<{data: string, format: string, name: string} | null>(null);
  const [dockingBox, setDockingBox] = useState<{center: {x: number, y: number, z: number}, size: {x: number, y: number, z: number}} | null>(null);
  const [isDocking, setIsDocking] = useState(false);
  const [dockingLog, setDockingLog] = useState<string[]>([]);
  const [dockingResultPdbqt, setDockingResultPdbqt] = useState<string | null>(null);
  const [exhaustiveness, setExhaustiveness] = useState<number>(8);
  const [dockingInputPdbqt, setDockingInputPdbqt] = useState<string | null>(null);
  const [dockingReceptorPdbqt, setDockingReceptorPdbqt] = useState<string | null>(null);
  const [interactions, setInteractions] = useState<any[]>([]);
  const [redockRmsd, setRedockRmsd] = useState<number | null>(null);
  const [showDockingBox, setShowDockingBox] = useState(false);
  const [gridBoxThickness, setGridBoxThickness] = useState(0.2);
  const [gridBoxOpacity, setGridBoxOpacity] = useState(1.0);
  const [dockingPrep, setDockingPrep] = useState({
    addHydrogens: true,
    assignGasteiger: true,
    stripSolvent: true,
    stripLigandsIons: true,
  });

  const viewerRef = useRef<MolStudioViewerRef>(null);

  const handleClearSelection = () => setSelectedAtomSerials(new Set());

  const handleRunQuery = (query: string) => {
    const parser = new SelectionParser(atoms);
    setSelectedAtomSerials(parser.parse(query));
  };

  const handleSaveSelection = (name: string, query: string) => {
    const parser = new SelectionParser(atoms);
    const atomIds = Array.from(parser.parse(query));
    setNamedSelections(prev => [...prev, { name, query, atomIds }]);
    alert(`Saved selection: ${name}`);
  };

  // Re-process whenever molData or cleaningState changes
  useEffect(() => {
    if (!molData) {
      setProcessedPDB(null);
      setAtoms([]);
      setSsData([]);
      setAvailableAssemblies([]);
      setHasSymmetryInfo(false);
      return;
    }

    const processor = new MolProcessor(molData.data, molData.format);
    
    if (cleaningState.altloc_filtered) {
      processor.filterAltlocs();
    }
    
    if (cleaningState.solvent_stripped) {
      processor.stripSolvent();
    }
    
    processor.assignBonds(cleaningState.bond_tolerance);
    
    if (cleaningState.hydrogens_added) {
      processor.addHydrogens();
    }
    
    processor.calculateSecondaryStructure(cleaningState.ss_mode);
    
    setAtoms(processor.atoms);
    setAvailableAssemblies(processor.assemblies.map(a => ({ id: a.id, isIdentityOnly: a.isIdentityOnly })));
    setDebugRemarks((processor as any).debug_remarks || []);
    setHasSymmetryInfo(processor.hasCryst1 || processor.symmetry_matrices.length > 0);

    setProcessedPDB(processor.toPDB());
    setSsData(processor.ss_per_residue);

    if (assemblyState.active_assembly_id) {
       const res = processor.generateAssemblyPDB(assemblyState.active_assembly_id);
       setAssemblyPDB(res.pdb);
       setAssemblyState(s => ({...s, generated_assembly_chains: res.generated_chains}));
    } else {
       setAssemblyPDB(null);
       setAssemblyState(s => ({...s, generated_assembly_chains: []}));
    }

    if (assemblyState.symmetry_mates_generated) {
       const res = processor.generateSymmetryPDB();
       setSymmetryPDB(res.pdb);
       setAssemblyState(s => ({...s, symmetry_mate_count: res.count}));
    } else {
       setSymmetryPDB(null);
       setAssemblyState(s => ({...s, symmetry_mate_count: 0}));
    }

  }, [molData, cleaningState, assemblyState.active_assembly_id, assemblyState.symmetry_mates_generated]);

  const [fetchId, setFetchId] = useState("");
  const [isFetching, setIsFetching] = useState(false);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const isMMTF = file.name.toLowerCase().endsWith('.mmtf');
    const reader = new FileReader();
    reader.onload = (e) => {
      const res = e.target?.result;
      if (res) {
        if (isMMTF) {
           setMolData({ data: new Uint8Array(res as ArrayBuffer), format: 'mmtf' });
        } else {
           setMolData({ data: res as string, format: 'pdb' });
        }
        setCleaningState(defaultState); // Reset state on new file
      }
    };
    if (isMMTF) {
      reader.readAsArrayBuffer(file);
    } else {
      reader.readAsText(file);
    }
  };

  const handleFetch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fetchId) return;
    setIsFetching(true);
    try {
       const res = await fetch(`https://files.rcsb.org/download/${fetchId.toUpperCase()}.pdb`);
       if (!res.ok) throw new Error("Failed to fetch PDB from RCSB");
       const text = await res.text();
       setMolData({ data: text, format: 'pdb' });
       setCleaningState(defaultState);
       setFetchId("");
    } catch (err: any) {
       alert("Error fetching structure: " + err.message);
    } finally {
       setIsFetching(false);
    }
  };

  const handleAlignFetch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!alignFetchId) return;
    setIsAlignFetching(true);
    try {
       const res = await fetch(`https://files.rcsb.org/download/${alignFetchId.toUpperCase()}.pdb`);
       if (!res.ok) throw new Error("Failed to fetch PDB from RCSB");
       const text = await res.text();
       setAlignMol({ data: text, format: 'pdb', name: alignFetchId.toUpperCase() });
       setAlignFetchId("");
    } catch (err: any) {
       alert("Error fetching structure: " + err.message);
    } finally {
       setIsAlignFetching(false);
    }
  };

  const handleAlignFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const isMMTF = file.name.toLowerCase().endsWith('.mmtf');
    const reader = new FileReader();
    setAlignError("");
    setAlignmentResult(null);
    reader.onload = (e) => {
      const res = e.target?.result;
      if (res) {
        if (isMMTF) {
           setAlignMol({ data: new Uint8Array(res as ArrayBuffer), format: 'mmtf', name: file.name });
        } else {
           setAlignMol({ data: res as string, format: 'pdb', name: file.name });
        }
      }
    };
    if (isMMTF) {
      reader.readAsArrayBuffer(file);
    } else {
      reader.readAsText(file);
    }
  };

  useEffect(() => {
    if (molData && alignMol) {
      try {
        const p1 = new MolProcessor(molData.data, molData.format);
        const p2 = new MolProcessor(alignMol.data, alignMol.format);
        const res = alignStructures(p1.atoms, p2.atoms);
        setAlignmentResult(res);
        setAlignError("");
      } catch (err: any) {
        setAlignError(err.message);
        setAlignmentResult(null);
      }
    } else {
      setAlignmentResult(null);
    }
  }, [molData, alignMol]);

  const handleSaveSession = () => {
     const view = viewerRef.current?.getView();
     const session = {
        molData: molData ? {
          format: molData.format,
          name: molData.name,
          data: molData.format === 'mmtf' ? Array.from(molData.data as Uint8Array) : molData.data
        } : null,
        cleaningState,
        assemblyState,
        renderStyle,
        surfaceOpacity,
        backgroundColor,
        namedSelections,
        selectedAtomSerials: Array.from(selectedAtomSerials),
        alignMol: alignMol ? {
          format: alignMol.format,
          name: alignMol.name,
          data: alignMol.format === 'mmtf' ? Array.from(alignMol.data as Uint8Array) : alignMol.data
        } : null,
        cameraView: view
     };
     
     const blob = new Blob([JSON.stringify(session)], { type: "application/json" });
     const url = URL.createObjectURL(blob);
     const a = document.createElement("a");
     a.href = url;
     a.download = "molstudio_session.json";
     a.click();
     URL.revokeObjectURL(url);
  };

  const handleLoadSession = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const session = JSON.parse(e.target?.result as string);
        if (session.molData) {
           setMolData({
             format: session.molData.format,
             name: session.molData.name,
             data: session.molData.format === 'mmtf' ? new Uint8Array(session.molData.data) : session.molData.data
           });
        } else {
           setMolData(null);
        }
        if (session.cleaningState) setCleaningState(session.cleaningState);
        if (session.assemblyState) setAssemblyState(session.assemblyState);
        if (session.renderStyle) setRenderStyle(session.renderStyle);
        if (session.surfaceOpacity) setSurfaceOpacity(session.surfaceOpacity);
        if (session.backgroundColor) setBackgroundColor(session.backgroundColor);
        if (session.namedSelections) setNamedSelections(session.namedSelections);
        if (session.selectedAtomSerials) setSelectedAtomSerials(new Set(session.selectedAtomSerials));
        if (session.alignMol) {
           setAlignMol({
             format: session.alignMol.format,
             name: session.alignMol.name,
             data: session.alignMol.format === 'mmtf' ? new Uint8Array(session.alignMol.data) : session.alignMol.data
           });
        } else {
           setAlignMol(null);
        }
        // Restore camera view after a short delay to allow 3Dmol to process models
        if (session.cameraView) {
           setTimeout(() => {
              viewerRef.current?.setView(session.cameraView);
           }, 500);
        }
      } catch (err) {
        console.error("Failed to load session:", err);
        alert("Failed to load session. The file might be corrupted.");
      }
    };
    reader.readAsText(file);
    // Reset file input
    e.target.value = '';
  };

  const handleLigandUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const res = e.target?.result as string;
      if (res) {
        setLigandData({ data: res, format: file.name.split('.').pop() || 'sdf', name: file.name });
        setDockingResultPdbqt(null);
      }
    };
    reader.readAsText(file);
  };

  const handleSetBoxFromSelection = () => {
    if (selectedAtomSerials.size === 0) {
      alert("Please select some atoms first to define the binding site center.");
      return;
    }
    const selectedAtoms = atoms.filter(a => selectedAtomSerials.has(a.serial));
    let cx = 0, cy = 0, cz = 0;
    selectedAtoms.forEach(a => { cx += a.x; cy += a.y; cz += a.z; });
    cx /= selectedAtoms.length;
    cy /= selectedAtoms.length;
    cz /= selectedAtoms.length;
    
    // Find max distance from center to estimate size
    let maxDistX = 0, maxDistY = 0, maxDistZ = 0;
    selectedAtoms.forEach(a => {
      maxDistX = Math.max(maxDistX, Math.abs(a.x - cx));
      maxDistY = Math.max(maxDistY, Math.abs(a.y - cy));
      maxDistZ = Math.max(maxDistZ, Math.abs(a.z - cz));
    });
    
    // Add some padding (e.g., 5 Å on each side)
    const padding = 10;
    setDockingBox({
      center: { x: cx, y: cy, z: cz },
      size: { 
        x: Math.max(20, (maxDistX * 2) + padding), 
        y: Math.max(20, (maxDistY * 2) + padding), 
        z: Math.max(20, (maxDistZ * 2) + padding) 
      }
    });
    setShowDockingBox(true);
  };
  const handleAutoSuggestBox = () => {
    if (!molData) return;
    try {
      const p = new MolProcessor(molData.data, molData.format as any);
      const ligands = p.getLigands();
      if (ligands.length === 0) {
        alert("No co-crystallized ligands detected in the receptor.");
        return;
      }
      // Pick the first ligand
      const ligAtoms = ligands[0];
      let cx = 0, cy = 0, cz = 0;
      ligAtoms.forEach(a => { cx += a.x; cy += a.y; cz += a.z; });
      cx /= ligAtoms.length;
      cy /= ligAtoms.length;
      cz /= ligAtoms.length;
      
      let maxDistX = 0, maxDistY = 0, maxDistZ = 0;
      ligAtoms.forEach(a => {
        maxDistX = Math.max(maxDistX, Math.abs(a.x - cx));
        maxDistY = Math.max(maxDistY, Math.abs(a.y - cy));
        maxDistZ = Math.max(maxDistZ, Math.abs(a.z - cz));
      });
      
      const padding = 10;
      setDockingBox({
        center: { x: cx, y: cy, z: cz },
        size: { 
          x: Math.max(20, (maxDistX * 2) + padding), 
          y: Math.max(20, (maxDistY * 2) + padding), 
          z: Math.max(20, (maxDistZ * 2) + padding) 
        }
      });
      setShowDockingBox(true);
      
      // Auto-populate the ligand box if empty, this makes testing easy
      // But the spec doesn't require extracting the ligand, just setting the box.
      alert(`Auto-suggested grid box around ligand: ${ligAtoms[0].resName}`);
    } catch (e: any) {
      alert("Failed to auto-suggest box: " + e.message);
    }
  };

  const handleRunDocking = async () => {
    if (typeof SharedArrayBuffer === "undefined") {
      alert("Docking requires a dedicated browser tab to run the Webina engine (SharedArrayBuffer support). The app will now open in a new tab.");
      window.open(window.location.href, '_blank');
      return;
    }
    if (!molData || !ligandData || !dockingBox) return;
    setIsDocking(true);
    setDockingLog([]);
    setDockingResultPdbqt(null);
    try {
      // 1. Prepare Receptor
      setDockingLog(l => [...l, "Preparing receptor..."]);
      const p = new MolProcessor(molData.data, molData.format as any);
      if (dockingPrep.stripSolvent) {
        p.stripSolvent();
        setDockingLog(l => [...l, "Stripped solvent."]);
      }
      if (dockingPrep.stripLigandsIons) {
        p.stripLigandsIons();
        setDockingLog(l => [...l, "Stripped co-crystallized ligands/ions."]);
      }
      if (dockingPrep.addHydrogens) {
        p.addHydrogens(); // This is the step 1 logic
        setDockingLog(l => [...l, "Added hydrogens."]);
      }
      // Note: Gasteiger charges are added automatically by OpenBabel PDBQT writer.
      if (dockingPrep.assignGasteiger) {
        setDockingLog(l => [...l, "Gasteiger charges will be assigned by Open Babel."]);
      }

      const preppedPDB = p.toPDB();

      // 2. Convert receptor to PDBQT 
      const receptorPDBQT = await convertToPDBQT(preppedPDB, 'pdb', true, false);
      
      // 3. Convert ligand to PDBQT
      setDockingLog(l => [...l, "Converting ligand to PDBQT..."]);
      const ligandPDBQT = await convertToPDBQT(ligandData.data, ligandData.format, false, true);

      setDockingInputPdbqt(ligandPDBQT);
      setDockingReceptorPdbqt(receptorPDBQT);
      setRedockRmsd(null);

      // 4. Run Webina
      setDockingLog(l => [...l, "Running Webina (this may take several seconds to minutes)..."]);
      const result = await runWebina(
        receptorPDBQT,
        ligandPDBQT,
        {
          receptor: "",
          ligand: "",
          center_x: dockingBox.center.x,
          center_y: dockingBox.center.y,
          center_z: dockingBox.center.z,
          size_x: dockingBox.size.x,
          size_y: dockingBox.size.y,
          size_z: dockingBox.size.z,
          exhaustiveness
        },
        (msg) => {
          setDockingLog(l => {
             const newLogs = [...l, msg];
             if (newLogs.length > 20) return newLogs.slice(newLogs.length - 20);
             return newLogs;
          });
        }
      );
      
      setDockingLog(l => [...l, "Docking complete!"]);
      setDockingResultPdbqt(result);

      // 5. Calculate interactions for the first pose
      const firstPoseStr = result.split("ENDMDL")[0] + "ENDMDL\n";
      const ints = calculateInteractions(receptorPDBQT, firstPoseStr);
      setInteractions(ints);
      if (ints.length > 0) {
         setDockingLog(l => [...l, `Found ${ints.length} potential interactions for top pose.`]);
      }
    } catch (err: any) {
      console.error("Docking process caught error:", err);
      const errMsg = formatError(err);
      setDockingLog(l => [...l, `Error: ${errMsg}`]);
    } finally {
      setIsDocking(false);
    }
  };

  const handleValidateRedocking = () => {
    if (!dockingResultPdbqt || !dockingInputPdbqt) {
       alert("No docking result or input found to validate against.");
       return;
    }
    
    try {
      const firstPoseStr = dockingResultPdbqt.split("ENDMDL")[0] + "ENDMDL\n";
      const dockedProc = new MolProcessor(firstPoseStr, 'pdb');
      const refProc = new MolProcessor(dockingInputPdbqt, 'pdb');
      
      const dockedAtoms = dockedProc.atoms.filter(a => a.elem !== 'H');
      const refAtoms = refProc.atoms.filter(a => a.elem !== 'H');
      
      const res = alignStructures(dockedAtoms, refAtoms);
      setRedockRmsd(res.rmsd);
      
    } catch (err: any) {
      console.error("Error validating redocking:", err);
      alert("Error validating redocking: " + formatError(err));
    }
  };

  const handleApplyDefaults = () => {
    setCleaningState({
      bond_tolerance: 1.15,
      altloc_filtered: true,
      solvent_stripped: true,
      hydrogens_added: true,
      ss_mode: 'pdb'
    });
  };

  return (
    <div className="h-screen w-screen flex flex-col md:flex-row font-sans bg-[#0A0A0A] text-[#F0F0F0] overflow-hidden relative">
      
      {/* Mobile Top Header */}
      <header className="md:hidden h-14 border-b border-white/10 bg-[#0C0C0C] flex items-center justify-between px-4 z-30 shrink-0">
        <div className="flex items-center gap-3">
          <Link to="/" className="p-1.5 rounded-lg border border-white/10 text-white/70 hover:text-white transition-colors">
            <ArrowLeft size={16} />
          </Link>
          <span className="text-lg font-light tracking-tighter">Mol<span className="font-serif italic text-[#4A90E2]">Studio</span></span>
        </div>
        <button 
          onClick={() => setIsMobileSidebarOpen(!isMobileSidebarOpen)}
          className={`p-2 rounded-lg border transition-all flex items-center gap-1.5 text-xs font-medium ${isMobileSidebarOpen ? 'border-[#4A90E2] text-[#4A90E2] bg-[#4A90E2]/10' : 'border-white/10 text-white/70 hover:text-white'}`}
        >
          <SlidersHorizontal size={15} />
          <span>Preparation</span>
        </button>
      </header>

      {/* Mobile Backdrop */}
      {isMobileSidebarOpen && (
        <div 
          className="md:hidden fixed inset-0 bg-black/75 z-40 transition-opacity"
          onClick={() => setIsMobileSidebarOpen(false)}
        />
      )}

      {/* Left Sidebar / Controls Panel */}
      <div className={`
        fixed md:relative top-0 bottom-0 left-0 
        h-full w-[85vw] max-w-xs md:w-80 border-r border-white/10 bg-[#0c0c0c] 
        flex flex-col z-50 md:z-20 shadow-xl overflow-y-auto
        transition-transform duration-300 ease-in-out
        ${isMobileSidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
      `}>
        <div className="p-4 sm:p-6 border-b border-white/10 shrink-0 flex items-center justify-between">
          <div>
            <Link 
              to="/"
              className="hidden md:inline-flex items-center gap-2 text-white/50 hover:text-white transition-colors mb-4 text-sm"
            >
              <ArrowLeft size={14} />
              Back to Home
            </Link>
            <h1 className="text-2xl sm:text-3xl font-light tracking-tighter mb-1">Mol<span className="font-serif italic text-[#4A90E2]">Studio</span></h1>
            <p className="text-[10px] sm:text-xs text-white/40 uppercase tracking-widest font-medium">Preparation & Cleaning</p>
          </div>
          <button 
            onClick={() => setIsMobileSidebarOpen(false)}
            className="md:hidden p-2 text-white/50 hover:text-white rounded-lg border border-white/10"
          >
            <X size={18} />
          </button>
        </div>

        <div className="p-4 border-b border-white/10 bg-[#4A90E2]/5 flex justify-between gap-2 shrink-0">
           <button onClick={handleSaveSession} className="flex-1 py-2 flex justify-center items-center gap-2 bg-[#4A90E2]/20 text-[#4A90E2] rounded-lg text-xs font-medium hover:bg-[#4A90E2]/30 transition-colors">
              <Save size={14} /> Save Session
           </button>
           <label className="flex-1 py-2 flex justify-center items-center gap-2 bg-white/5 text-white/70 rounded-lg text-xs font-medium hover:bg-white/10 transition-colors cursor-pointer">
              <FolderOpen size={14} /> Load Session
              <input type="file" accept=".json" className="hidden" onChange={handleLoadSession} />
           </label>
        </div>

        <div className="p-6 flex-1 flex flex-col gap-8">
          
          {/* Data Loading */}
          <section className="space-y-4">
            <h2 className="text-sm uppercase tracking-widest text-white/50 font-medium">Data Source</h2>
            <label className="flex flex-col items-center justify-center p-6 border border-dashed border-white/20 rounded-xl hover:bg-white/5 hover:border-[#4A90E2]/50 transition-colors cursor-pointer group">
              <Upload size={24} className="mb-2 text-white/40 group-hover:text-[#4A90E2] transition-colors" />
              <span className="text-sm font-medium">Upload Structure File</span>
              <span className="text-xs text-white/40 mt-1">.pdb or .mmtf format</span>
              <input type="file" accept=".pdb,.mmtf" className="hidden" onChange={handleFileUpload} />
            </label>

            <form onSubmit={handleFetch} className="flex gap-2">
              <input 
                 type="text"
                 placeholder="Fetch RCSB ID (e.g. 1CRN)"
                 value={fetchId}
                 onChange={e => setFetchId(e.target.value)}
                 className="flex-1 bg-[#0A0A0A] border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-[#4A90E2]/50 transition-colors"
              />
              <button 
                 type="submit"
                 disabled={!fetchId || isFetching}
                 className="px-4 py-2 bg-[#4A90E2]/10 text-[#4A90E2] rounded-lg text-sm font-medium hover:bg-[#4A90E2]/20 disabled:opacity-50 transition-colors whitespace-nowrap"
              >
                 {isFetching ? 'Fetching...' : 'Fetch'}
              </button>
            </form>
            
            {molData && (
              <div className="flex flex-col gap-2">
                <div className="text-xs text-white/50 bg-black/20 p-2 rounded border border-white/5 flex justify-between">
                  <span>Loaded Structure: {molData.name || "Unknown"}</span>
                  <span className="text-white/70 font-mono">Atoms: {atoms.length}</span>
                </div>
                <div className="flex gap-2">
                <button 
                  onClick={() => setCleaningState(defaultState)}
                  className="flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg border border-white/10 text-xs font-medium hover:bg-white/5 transition-colors"
                >
                  <RefreshCw size={12} />
                  Reset to Original
                </button>
                <button 
                  onClick={handleApplyDefaults}
                  className="flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg bg-[#4A90E2]/20 text-[#4A90E2] border border-[#4A90E2]/30 text-xs font-medium hover:bg-[#4A90E2]/30 transition-colors"
                >
                  <CheckSquare size={12} />
                  Apply Defaults
                </button>
              </div>
            </div>
            )}
          </section>

          {/* Selection Query */}
          <section className={`space-y-4 transition-opacity ${molData ? 'opacity-100' : 'opacity-30 pointer-events-none'}`}>
             <h2 className="text-sm uppercase tracking-widest text-white/50 font-medium">Selection Query</h2>
             <QueryBar onRunQuery={handleRunQuery} onSaveSelection={handleSaveSelection} onClearSelection={handleClearSelection} />
             {selectedAtomSerials.size > 0 && (
                 <div className="flex items-center justify-between">
                   <p className="text-sm text-white/70">Selected atoms: {selectedAtomSerials.size}</p>
                   <button onClick={() => setFocusTrigger(p => p + 1)} className="text-xs bg-white/10 hover:bg-white/20 text-white px-3 py-1.5 rounded-md transition-colors">
                     Focus on Selection
                   </button>
                 </div>
             )}
          </section>

          {/* Cleaning Operations */}
          <section className={`space-y-6 transition-opacity ${molData ? 'opacity-100' : 'opacity-30 pointer-events-none'}`}>
            <h2 className="text-sm uppercase tracking-widest text-white/50 font-medium">Structure Cleaning</h2>
            
            {/* Rebond */}
            <div className="space-y-3 bg-white/[0.02] p-4 rounded-xl border border-white/5">
              <div className="flex justify-between items-center group relative">
                <div className="flex items-center gap-2">
                  <Settings2 size={16} className="text-[#4A90E2]" />
                  <span className="text-sm font-medium">Bond Perception</span>
                </div>
                <Info size={14} className="text-white/30 cursor-help" />
                <div className="absolute right-0 top-6 w-48 p-2 bg-gray-900 border border-white/10 rounded-lg text-xs text-white/70 shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50 pointer-events-none">
                  Re-runs distance-based bond perception at the current tolerance value.
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between text-xs text-white/50">
                  <span>Tolerance</span>
                  <span>{cleaningState.bond_tolerance.toFixed(2)}x</span>
                </div>
                <input 
                  type="range" 
                  min="0.5" 
                  max="2.0" 
                  step="0.05"
                  value={cleaningState.bond_tolerance}
                  onChange={(e) => setCleaningState(s => ({...s, bond_tolerance: parseFloat(e.target.value)}))}
                  className="w-full accent-[#4A90E2]"
                />
              </div>
            </div>

            {/* Altlocs */}
            <div className="space-y-3 bg-white/[0.02] p-4 rounded-xl border border-white/5">
              <div className="flex justify-between items-center group relative">
                <div className="flex items-center gap-3">
                  <input 
                    type="checkbox" 
                    id="altloc"
                    checked={cleaningState.altloc_filtered}
                    onChange={(e) => setCleaningState(s => ({...s, altloc_filtered: e.target.checked}))}
                    className="accent-[#4A90E2] w-4 h-4 rounded"
                  />
                  <label htmlFor="altloc" className="text-sm font-medium cursor-pointer flex items-center gap-2">
                    <Layers size={16} className="text-[#4A90E2]" />
                    Remove Alt Conformations
                  </label>
                </div>
                <Info size={14} className="text-white/30 cursor-help" />
                <div className="absolute right-0 top-6 w-48 p-2 bg-gray-900 border border-white/10 rounded-lg text-xs text-white/70 shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50 pointer-events-none">
                  Keeps only the primary/highest-occupancy conformation and discards alternate locations to prevent bonded tangles.
                </div>
              </div>
            </div>

            {/* Strip Solvent */}
            <div className="space-y-3 bg-white/[0.02] p-4 rounded-xl border border-white/5">
              <div className="flex justify-between items-center group relative">
                <div className="flex items-center gap-3">
                  <input 
                    type="checkbox" 
                    id="solvent"
                    checked={cleaningState.solvent_stripped}
                    onChange={(e) => setCleaningState(s => ({...s, solvent_stripped: e.target.checked}))}
                    className="accent-[#4A90E2] w-4 h-4 rounded"
                  />
                  <label htmlFor="solvent" className="text-sm font-medium cursor-pointer flex items-center gap-2">
                    <Droplet size={16} className="text-[#4A90E2]" />
                    Strip Solvent
                  </label>
                </div>
                <Info size={14} className="text-white/30 cursor-help" />
                <div className="absolute right-0 top-6 w-48 p-2 bg-gray-900 border border-white/10 rounded-lg text-xs text-white/70 shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50 pointer-events-none">
                  Removes water molecules (HOH, WAT) and equivalent solvent residue codes from the view.
                </div>
              </div>
            </div>

            {/* Add Hydrogens */}
            <div className="space-y-3 bg-white/[0.02] p-4 rounded-xl border border-white/5">
              <div className="flex justify-between items-center group relative">
                <div className="flex items-center gap-3">
                  <input 
                    type="checkbox" 
                    id="hydrogens"
                    checked={cleaningState.hydrogens_added}
                    onChange={(e) => setCleaningState(s => ({...s, hydrogens_added: e.target.checked}))}
                    className="accent-[#4A90E2] w-4 h-4 rounded"
                  />
                  <label htmlFor="hydrogens" className="text-sm font-medium cursor-pointer flex items-center gap-2">
                    <div className="w-4 h-4 rounded-full border border-[#4A90E2] flex items-center justify-center text-[8px] font-bold text-[#4A90E2]">H</div>
                    Add Hydrogens
                  </label>
                </div>
                <Info size={14} className="text-white/30 cursor-help" />
                <div className="absolute right-0 top-6 w-48 p-2 bg-gray-900 border border-white/10 rounded-lg text-xs text-white/70 shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50 pointer-events-none">
                  Added computationally based on heavy-atom valence — not from the crystal structure.
                </div>
              </div>
            </div>
          </section>

          {/* Representation */}
          <section className={`space-y-6 transition-opacity ${molData ? 'opacity-100' : 'opacity-30 pointer-events-none'}`}>
            <h2 className="text-sm uppercase tracking-widest text-white/50 font-medium">Representation</h2>
            <div className="space-y-3 bg-white/[0.02] p-4 rounded-xl border border-white/5">
                <select 
                  value={renderStyle}
                  onChange={(e) => setRenderStyle(e.target.value as RenderStyle)}
                  className="bg-black border border-white/10 rounded-lg p-2 text-sm text-white outline-none w-full"
                >
                  {["Line", "Stick", "Ball-and-Stick", "Space-Filling", "Cartoon", "Van der Waals Surface", "Solvent-Accessible Surface", "Solvent-Excluded Surface", "Mesh", "Dots", "Non-bonded (small spheres)"].map(style => (
                    <option key={style} value={style}>{style}</option>
                  ))}
                </select>
                
                <select 
                  value={colorScheme}
                  onChange={(e) => setColorScheme(e.target.value)}
                  className="bg-black border border-white/10 rounded-lg p-2 text-sm text-white outline-none w-full mt-2"
                >
                  <option value="spectrum">Color: Rainbow (Spectrum)</option>
                  <option value="ssJmol">Color: Secondary Structure (Jmol)</option>
                  <option value="ssPyMol">Color: Secondary Structure (PyMOL)</option>
                  <option value="chain">Color: By Chain</option>
                  <option value="element">Color: By Element (CPK)</option>
                  <option value="white">Color: White</option>
                </select>
                
                {(renderStyle.includes("Surface") || renderStyle === "Mesh") && (
                   <div className="space-y-1">
                     <div className="flex justify-between text-xs text-white/50">
                        <span>Opacity</span>
                        <span>{(surfaceOpacity * 100).toFixed(0)}%</span>
                     </div>
                     <input 
                       type="range" min="0.1" max="1.0" step="0.05"
                       value={surfaceOpacity}
                       onChange={(e) => setSurfaceOpacity(parseFloat(e.target.value))}
                       className="w-full accent-[#4A90E2]"
                     />
                   </div>
                )}
                
                <div className="space-y-2 mt-4 pt-4 border-t border-white/10">
                   <div className="text-xs text-white/50">Canvas Color</div>
                   <div className="flex gap-2">
                     {['#000000', '#f0f0f0', '#ffffff', '#1a1a1a', '#0f172a'].map(color => (
                       <button
                         key={color}
                         onClick={() => setBackgroundColor(color)}
                         className={`w-6 h-6 rounded-full border-2 ${backgroundColor === color ? 'border-[#4A90E2]' : 'border-white/20'}`}
                         style={{ backgroundColor: color }}
                         title={color}
                       />
                     ))}
                   </div>
                </div>
             </div>
          </section>

          {/* Biological Assembly & Symmetry */}
          <section className={`space-y-6 transition-opacity ${molData ? 'opacity-100' : 'opacity-30 pointer-events-none'}`}>
            <h2 className="text-sm uppercase tracking-widest text-white/50 font-medium">Assemblies & Packing</h2>
            
            {/* Biological Assembly */}
            <div className="space-y-3 bg-white/[0.02] p-4 rounded-xl border border-white/5">
              <div className="flex flex-col gap-2 relative">
                <div className="flex items-center gap-2 justify-between">
                  <div className="flex items-center gap-2">
                    <Cuboid size={16} className="text-[#F5A623]" />
                    <span className="text-sm font-medium">Biological Assembly</span>
                  </div>
                  <div className="relative group flex items-center">
                    <Info size={14} className="text-white/30 cursor-help" />
                    <div className="absolute right-0 top-6 w-56 p-3 bg-gray-900 border border-white/10 rounded-lg text-xs text-white/70 shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50 pointer-events-none">
                      Author-defined, biologically meaningful quaternary structure (from REMARK 350 / BIOMT). This is the functional form of the protein in vivo.
                    </div>
                  </div>
                </div>
                
                {availableAssemblies.length > 0 ? (
                  <div className="flex flex-col gap-2 mt-2">
                    {availableAssemblies.length === 1 && availableAssemblies[0].isIdentityOnly ? (
                        <div className="text-xs text-[#4A90E2] bg-[#4A90E2]/10 p-2 rounded border border-[#4A90E2]/20">
                            Biological assembly = asymmetric unit (no additional copies needed).
                        </div>
                    ) : (
                        <>
                            <select 
                              className="bg-black border border-white/10 rounded-lg p-2 text-sm text-white outline-none w-full"
                              value={assemblyState.active_assembly_id || ""}
                              onChange={(e) => setAssemblyState(s => ({...s, active_assembly_id: e.target.value || null}))}
                            >
                              <option value="">Off (Asymmetric Unit Only)</option>
                              {availableAssemblies.map(a => (
                                <option key={a.id} value={a.id}>
                                  {a.isIdentityOnly ? `Assembly ${a.id} = Asymmetric Unit (no transform needed)` : `Generate Assembly ${a.id}`}
                                </option>
                              ))}
                            </select>
                            {assemblyState.active_assembly_id && assemblyState.generated_assembly_chains.length > 0 && (
                              <div className="text-xs text-[#F5A623] bg-[#F5A623]/10 p-2 rounded border border-[#F5A623]/20">
                                Generated {assemblyState.generated_assembly_chains.length} symmetric chains.
                              </div>
                            )}
                            {assemblyState.active_assembly_id && availableAssemblies.find(a => a.id === assemblyState.active_assembly_id)?.isIdentityOnly && (
                              <div className="text-xs text-[#4A90E2] bg-[#4A90E2]/10 p-2 rounded border border-[#4A90E2]/20">
                                Biological assembly = asymmetric unit (no additional copies needed).
                              </div>
                            )}
                        </>
                    )}
                  </div>
                ) : (
                  <div className="text-xs text-red-400 bg-red-400/10 p-2 rounded mt-2 border border-red-400/20">
                    No biological assembly annotation found.
                  </div>
                )}
                {debugRemarks.length > 0 && (
                  <div className="mt-4 p-2 bg-black overflow-y-auto max-h-64 text-[10px] text-green-400 font-mono">
                    <strong>DEBUG REMARK 350 LINES:</strong>
                    {debugRemarks.map((l, i) => <div key={i}>{l}</div>)}
                  </div>
                )}
                {ssData.length > 0 && (
                  <div className="mt-4 p-2 bg-black overflow-y-auto max-h-64 text-[10px] text-green-400 font-mono">
                    <strong>DEBUG SS:</strong>
                    {JSON.stringify(ssData.filter(d => d.chainID === 'A' && (d.ss_type === 'helix' || d.ss_type === 'sheet')).slice(0, 10), null, 2)}
                  </div>
                )}
              </div>
            </div>

            {/* Symmetry Mates */}
            <div className="space-y-3 bg-white/[0.02] p-4 rounded-xl border border-white/5">
              <div className="flex justify-between items-start relative">
                <div className="flex items-start gap-3 w-full">
                  <input 
                    type="checkbox" 
                    id="symmetry"
                    disabled={!hasSymmetryInfo}
                    checked={assemblyState.symmetry_mates_generated}
                    onChange={(e) => setAssemblyState(s => ({...s, symmetry_mates_generated: e.target.checked}))}
                    className="accent-[#9B51E0] w-4 h-4 rounded mt-1"
                  />
                  <div className="flex flex-col w-full">
                    <label htmlFor="symmetry" className={`text-sm font-medium flex items-center gap-2 ${hasSymmetryInfo ? 'cursor-pointer text-white' : 'cursor-not-allowed text-white/40'}`}>
                      <Box size={16} className={hasSymmetryInfo ? 'text-[#9B51E0]' : 'text-white/20'} />
                      Generate Crystal Packing
                    </label>
                    
                    {!hasSymmetryInfo ? (
                      <div className="text-xs text-red-400 bg-red-400/10 p-2 rounded mt-2 border border-red-400/20">
                        No space group symmetry (SMTRY / CRYST1) found in this file.
                      </div>
                    ) : assemblyState.symmetry_mates_generated && (
                      <div className="text-xs text-[#9B51E0] bg-[#9B51E0]/10 p-2 rounded mt-2 border border-[#9B51E0]/20">
                        Generated {assemblyState.symmetry_mate_count} crystal lattice neighbors. Note: these are artifactual packing contacts, not biological interfaces.
                      </div>
                    )}
                  </div>
                </div>
                <div className="relative group flex items-center shrink-0 ml-2">
                  <Info size={14} className="text-white/30 cursor-help" />
                  <div className="absolute right-0 top-6 w-56 p-3 bg-gray-900 border border-white/10 rounded-lg text-xs text-white/70 shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50 pointer-events-none">
                    Crystal lattice neighbors generated via space group symmetry operators (REMARK 290). Most of these contacts are purely artifactual and not biologically relevant.
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Structural Alignment (Kabsch) */}
          <section className={`space-y-6 transition-opacity ${molData ? 'opacity-100' : 'opacity-30 pointer-events-none'}`}>
            <h2 className="text-sm uppercase tracking-widest text-white/50 font-medium">Structural Alignment</h2>
            <div className="space-y-3 bg-white/[0.02] p-4 rounded-xl border border-white/5">
              <div className="flex flex-col gap-2">
                <div className="text-xs text-white/70">
                  Align another structure to the primary one.
                </div>
                
                <div className="flex gap-2">
                  <label className="flex-1 px-4 py-2 bg-[#4A90E2]/10 text-[#4A90E2] rounded-lg text-sm font-medium hover:bg-[#4A90E2]/20 transition-colors cursor-pointer text-center">
                    Upload
                    <input type="file" accept=".pdb,.mmtf" className="hidden" onChange={handleAlignFileUpload} />
                  </label>
                </div>
                <form onSubmit={handleAlignFetch} className="flex gap-2">
                  <input 
                     type="text"
                     placeholder="RCSB ID"
                     value={alignFetchId}
                     onChange={e => setAlignFetchId(e.target.value)}
                     className="flex-1 bg-[#0A0A0A] border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-[#4A90E2]/50 transition-colors min-w-0"
                  />
                  <button 
                     type="submit"
                     disabled={!alignFetchId || isAlignFetching}
                     className="px-4 py-2 bg-[#4A90E2]/10 text-[#4A90E2] rounded-lg text-sm font-medium hover:bg-[#4A90E2]/20 disabled:opacity-50 transition-colors"
                  >
                     {isAlignFetching ? '...' : 'Fetch'}
                  </button>
                </form>

                {alignMol && (
                  <div className="mt-3 p-3 bg-black/40 rounded-lg border border-white/10">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-sm font-medium">{alignMol.name}</span>
                      <button onClick={() => { setAlignMol(null); setAlignmentResult(null); }} className="text-white/40 hover:text-white">
                        <X size={14} />
                      </button>
                    </div>
                    
                    {alignmentResult ? (
                      <div className="space-y-2 text-xs">
                        <div className="flex justify-between">
                          <span className="text-white/60">Atom Pairs:</span>
                          <span className="text-white font-mono">{alignmentResult.atomPairsCount}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-white/60">RMSD:</span>
                          <span className="text-green-400 font-mono font-bold">{alignmentResult.rmsd.toFixed(3)} Å</span>
                        </div>
                      </div>
                    ) : alignError ? (
                      <div className="text-xs text-red-400">
                        {alignError}
                      </div>
                    ) : (
                      <div className="text-xs text-white/50 animate-pulse">
                        Calculating alignment...
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </section>


          {/* Molecular Docking (Webina) */}
          <section className={`space-y-6 transition-opacity ${molData ? 'opacity-100' : 'opacity-30 pointer-events-none'}`}>
            <h2 className="text-sm uppercase tracking-widest text-white/50 font-medium">Molecular Docking</h2>
            
            {/* 1. Preparation */}
            <div className="space-y-3 bg-white/[0.02] p-4 rounded-xl border border-white/5">
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium">1. Prepare Receptor</span>
              </div>
              <div className="text-xs text-white/70">
                Prep operations apply only to the receptor structure passed to Webina.
              </div>
              
              <div className="space-y-2 mt-2">
                <label className="flex items-center gap-2 text-xs cursor-pointer">
                  <input type="checkbox" checked={dockingPrep.addHydrogens} onChange={e => setDockingPrep(s => ({...s, addHydrogens: e.target.checked}))} className="accent-[#4A90E2]" />
                  Add Hydrogens
                </label>
                <label className="flex items-center gap-2 text-xs cursor-pointer">
                  <input type="checkbox" checked={dockingPrep.assignGasteiger} onChange={e => setDockingPrep(s => ({...s, assignGasteiger: e.target.checked}))} className="accent-[#4A90E2]" />
                  Assign Gasteiger Charges
                </label>
                <label className="flex items-center gap-2 text-xs cursor-pointer">
                  <input type="checkbox" checked={dockingPrep.stripSolvent} onChange={e => setDockingPrep(s => ({...s, stripSolvent: e.target.checked}))} className="accent-[#4A90E2]" />
                  Strip Solvent
                </label>
                <label className="flex items-center gap-2 text-xs cursor-pointer">
                  <input type="checkbox" checked={dockingPrep.stripLigandsIons} onChange={e => setDockingPrep(s => ({...s, stripLigandsIons: e.target.checked}))} className="accent-[#4A90E2]" />
                  Strip Co-crystallized Ligands/Ions
                </label>
              </div>
              
              <div className="pt-2">
                <button 
                  onClick={handleAutoSuggestBox}
                  className="w-full py-2 bg-[#F5A623]/10 text-[#F5A623] rounded-lg text-xs font-medium hover:bg-[#F5A623]/20 transition-colors"
                >
                  Auto-Detect Co-Crystallized Ligand
                </button>
              </div>
            </div>

            {/* 2. Docking Setup */}
            <div className="space-y-4 bg-white/[0.02] p-4 rounded-xl border border-white/5">
              <div className="text-xs text-white/70 leading-relaxed">
                Interactively dock a single ligand against the prepared receptor using Webina (client-side WASM).
              </div>
              
              <div className="space-y-3">
                {/* Ligand Upload */}
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium">2. Ligand</span>
                  <label className="px-3 py-1 bg-[#4A90E2]/10 text-[#4A90E2] rounded-lg text-xs font-medium hover:bg-[#4A90E2]/20 transition-colors cursor-pointer text-center">
                    Upload (.sdf, .pdb)
                    <input type="file" accept=".pdb,.sdf,.mol2" className="hidden" onChange={handleLigandUpload} />
                  </label>
                </div>
                {ligandData && (
                  <div className="text-xs p-2 bg-black/40 rounded border border-white/10 flex justify-between items-center">
                    <span className="truncate flex-1">{ligandData.name}</span>
                    <button onClick={() => { setLigandData(null); setDockingResultPdbqt(null); }} className="text-white/40 hover:text-white ml-2 shrink-0">
                      <X size={14} />
                    </button>
                  </div>
                )}
                
                {/* Binding Site Box */}
                <div className="space-y-2 pt-2 border-t border-white/10">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium">3. Grid Box</span>
                    <button 
                       onClick={handleSetBoxFromSelection}
                       className="px-3 py-1 bg-[#4A90E2]/10 text-[#4A90E2] rounded-lg text-xs font-medium hover:bg-[#4A90E2]/20 transition-colors"
                    >
                      Use Selection
                    </button>
                  </div>
                  
                  {dockingBox ? (
                    <div className="text-xs space-y-3 p-3 bg-black/40 rounded border border-white/10 relative mt-2">
                       <div className="flex justify-between items-center mb-1">
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input type="checkbox" checked={showDockingBox} onChange={e => setShowDockingBox(e.target.checked)} className="accent-[#F5A623] w-4 h-4" />
                            <span className="text-white/70 font-medium">Show Grid Box</span>
                          </label>
                          <button onClick={() => { setDockingBox(null); setShowDockingBox(false); }} className="text-red-400 hover:text-red-300 px-2 py-1 rounded bg-red-400/10 hover:bg-red-400/20 transition-colors flex items-center gap-1">
                             <X size={12} /> Remove
                          </button>
                       </div>
                       
                       <div className="space-y-1">
                         <div className="text-white/50">Center (X, Y, Z)</div>
                         <div className="flex gap-1">
                           <input type="number" step="0.1" value={dockingBox.center.x.toFixed(1)} onChange={e => setDockingBox(s => s ? {...s, center: {...s.center, x: parseFloat(e.target.value) || 0}} : null)} className="w-full bg-black border border-white/10 rounded px-2 py-1 text-white focus:outline-none focus:border-[#4A90E2]" />
                           <input type="number" step="0.1" value={dockingBox.center.y.toFixed(1)} onChange={e => setDockingBox(s => s ? {...s, center: {...s.center, y: parseFloat(e.target.value) || 0}} : null)} className="w-full bg-black border border-white/10 rounded px-2 py-1 text-white focus:outline-none focus:border-[#4A90E2]" />
                           <input type="number" step="0.1" value={dockingBox.center.z.toFixed(1)} onChange={e => setDockingBox(s => s ? {...s, center: {...s.center, z: parseFloat(e.target.value) || 0}} : null)} className="w-full bg-black border border-white/10 rounded px-2 py-1 text-white focus:outline-none focus:border-[#4A90E2]" />
                         </div>
                       </div>
                       
                       <div className="space-y-1">
                         <div className="text-white/50">Size (X, Y, Z)</div>
                         <div className="flex gap-1">
                           <input type="number" step="1" value={dockingBox.size.x.toFixed(1)} onChange={e => setDockingBox(s => s ? {...s, size: {...s.size, x: parseFloat(e.target.value) || 0}} : null)} className="w-full bg-black border border-white/10 rounded px-2 py-1 text-white focus:outline-none focus:border-[#4A90E2]" />
                           <input type="number" step="1" value={dockingBox.size.y.toFixed(1)} onChange={e => setDockingBox(s => s ? {...s, size: {...s.size, y: parseFloat(e.target.value) || 0}} : null)} className="w-full bg-black border border-white/10 rounded px-2 py-1 text-white focus:outline-none focus:border-[#4A90E2]" />
                           <input type="number" step="1" value={dockingBox.size.z.toFixed(1)} onChange={e => setDockingBox(s => s ? {...s, size: {...s.size, z: parseFloat(e.target.value) || 0}} : null)} className="w-full bg-black border border-white/10 rounded px-2 py-1 text-white focus:outline-none focus:border-[#4A90E2]" />
                         </div>
                       </div>

                       <div className="pt-2 mt-2 border-t border-white/10 space-y-3">
                         <div className="flex items-center justify-between">
                            <div className="text-white/50">Line Thickness</div>
                            <input type="range" min="0.1" max="1.0" step="0.1" value={gridBoxThickness} onChange={e => setGridBoxThickness(parseFloat(e.target.value))} className="w-24 accent-[#F5A623]" />
                         </div>
                         <div className="flex items-center justify-between">
                            <div className="text-white/50">Line Opacity</div>
                            <input type="range" min="0.1" max="1.0" step="0.1" value={gridBoxOpacity} onChange={e => setGridBoxOpacity(parseFloat(e.target.value))} className="w-24 accent-[#F5A623]" />
                         </div>
                       </div>
                    </div>
                  ) : (
                    <div className="text-[10px] text-white/50 p-2 bg-black/40 rounded border border-white/10">
                      No grid box defined. Auto-detect a ligand or use selection to create one.
                    </div>
                  )}
                </div>
                <div className="space-y-2 pt-2 border-t border-white/10">
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-white/70">Exhaustiveness</span>
                    <span>{exhaustiveness}</span>
                  </div>
                  <input 
                     type="range" min="1" max="16" step="1"
                     value={exhaustiveness}
                     onChange={e => setExhaustiveness(parseInt(e.target.value))}
                     className="w-full accent-[#4A90E2]"
                  />
                  
                  <button 
                     onClick={handleRunDocking}
                     disabled={!ligandData || !dockingBox || isDocking}
                     className="w-full py-2 bg-[#9B51E0]/20 text-[#9B51E0] rounded-lg text-sm font-medium hover:bg-[#9B51E0]/30 disabled:opacity-50 transition-colors mt-2"
                  >
                     {isDocking ? 'Docking in progress...' : 'Run Webina Docking'}
                  </button>
                  {isDocking && (
                    <div className="text-[10px] text-white/40 mt-1 text-center">
                      This may take from several seconds to a couple of minutes. Keep this tab open.
                    </div>
                  )}
                </div>
                
                {/* Status / Output */}
                {(isDocking || dockingLog.length > 0) && (
                  <div className="mt-3 p-2 bg-black rounded-lg border border-white/10 h-32 overflow-y-auto text-[10px] font-mono text-white/50">
                     {dockingLog.map((log, i) => <div key={i}>{log}</div>)}
                     {isDocking && <div className="animate-pulse">_</div>}
                  </div>
                )}
                
                {dockingResultPdbqt && (
                   <div className="space-y-2 mt-2">
                     <div className="text-xs text-green-400 p-2 bg-green-400/10 rounded border border-green-400/20">
                       Docking completed! Top poses are shown in cyan.
                     </div>
                     
                     {/* Geometric Heuristics Interactions */}
                     {interactions.length > 0 && (
                       <div className="p-2 bg-black/40 rounded border border-white/10 text-xs">
                         <div className="text-white/70 mb-1 font-medium">Geometric Heuristics (Interactions)</div>
                         <div className="flex flex-wrap gap-2">
                           <div className="flex items-center gap-1">
                             <div className="w-3 h-0 border-t border-dashed border-yellow-400"></div>
                             <span className="text-white/50">H-Bond</span>
                           </div>
                           <div className="flex items-center gap-1">
                             <div className="w-3 h-0 border-t border-dashed border-purple-400"></div>
                             <span className="text-white/50">Hydrophobic</span>
                           </div>
                           <div className="flex items-center gap-1">
                             <div className="w-3 h-0 border-t border-dashed border-green-400"></div>
                             <span className="text-white/50">Pi-Stacking</span>
                           </div>
                         </div>
                       </div>
                     )}

                     {/* Validation */}
                     <div className="p-2 bg-white/5 rounded border border-white/10 space-y-2">
                       <button 
                         onClick={handleValidateRedocking}
                         className="w-full py-1.5 bg-[#4A90E2]/10 text-[#4A90E2] rounded-lg text-xs font-medium hover:bg-[#4A90E2]/20 transition-colors"
                       >
                         Validate Against Known Pose
                       </button>
                       {redockRmsd !== null && (
                         <div className="text-xs text-white/70 flex justify-between">
                           <span>RMSD (vs initial pose):</span>
                           <span className={redockRmsd < 2.0 ? "text-green-400 font-bold" : "text-white font-bold"}>
                             {redockRmsd.toFixed(2)} Å
                           </span>
                         </div>
                       )}
                       {redockRmsd !== null && redockRmsd < 2.0 && (
                         <div className="text-[10px] text-green-400/70">
                           <CheckSquare size={10} className="inline mr-1" />
                           RMSD &lt; 2Å is generally considered successful redocking.
                         </div>
                       )}
                     </div>
                   </div>
                )}
              </div>
            </div>
          </section>
        </div>
      </div>

      {/* Main Viewer Area */}
      <div className="flex-1 relative">
        <div className="absolute inset-0 z-0">
          <MolStudioViewer 
            ref={viewerRef} 
            pdbData={processedPDB} 
            ssData={ssData} 
            ssMode={cleaningState.ss_mode}
            assemblyPDB={assemblyPDB} 
            symmetryPDB={symmetryPDB} 
            alignmentPDB={alignmentResult?.alignedPdbB} 
            ligandData={ligandData ? { data: ligandData.data, format: ligandData.format } : null}
            dockingPDBQT={dockingResultPdbqt}
            dockingBox={showDockingBox ? dockingBox : null}
            gridBoxThickness={gridBoxThickness}
            gridBoxOpacity={gridBoxOpacity}
            interactions={interactions}
            renderStyle={renderStyle}
            colorScheme={colorScheme}
            onDockingBoxChange={setDockingBox}
            surfaceOpacity={surfaceOpacity} 
            backgroundColor={backgroundColor} 
            selectedAtomSerials={selectedAtomSerials} 
            focusTrigger={focusTrigger} 
          />
        </div>
        
        {/* Status Overlay */}
        <div className="absolute top-4 right-4 z-10 flex flex-col gap-2">
          {molData && ssData.some(d => d.confidence_or_undetermined) && (
            <div className="bg-black/40 border border-white/10 px-3 py-2 rounded-lg backdrop-blur-md flex items-center gap-3 shadow-lg pointer-events-auto">
              <span className="text-xs text-white/70 font-medium">SS:</span>
              <select 
                value={cleaningState.ss_mode}
                onChange={(e) => setCleaningState(s => ({...s, ss_mode: e.target.value as 'pdb' | 'quick' | 'dssp'}))}
                className="bg-transparent text-sm text-[#4A90E2] font-semibold border-none outline-none cursor-pointer p-0 appearance-none hover:text-[#5fa1ec] transition-colors"
                style={{ WebkitAppearance: 'none' }}
              >
                <option value="pdb" className="bg-gray-900 text-white">PDB Original</option>
                <option value="quick" className="bg-gray-900 text-white">Quick</option>
                <option value="dssp" className="bg-gray-900 text-white">DSSP</option>
              </select>
            </div>
          )}
          {cleaningState.hydrogens_added && (
            <div className="bg-orange-500/10 border border-orange-500/20 text-orange-400 px-3 py-1.5 rounded-lg text-xs backdrop-blur-md flex items-center gap-2 shadow-lg pointer-events-none">
              <Info size={12} />
              Hydrogens are modeled, not experimentally observed
            </div>
          )}
        </div>

        {!molData && (
          <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center pointer-events-none z-10">
            <div className="max-w-md w-full text-white/50 text-sm sm:text-base font-light tracking-wide border border-white/10 p-6 sm:p-8 rounded-2xl bg-[#0a0a0a]/80 backdrop-blur-md shadow-2xl flex flex-col items-center gap-4 pointer-events-auto">
              <Upload size={32} className="text-[#4A90E2] opacity-80" />
              <p>Upload a structure file (.pdb / .mmtf) or fetch by RCSB ID in the preparation panel to begin.</p>
              <button 
                onClick={() => setIsMobileSidebarOpen(true)}
                className="md:hidden mt-2 px-4 py-2 bg-[#4A90E2] text-white rounded-lg text-xs font-medium shadow-lg hover:bg-[#3b7bc4] transition-colors"
              >
                Open Preparation Panel
              </button>
            </div>
          </div>
        )}
      </div>

    </div>
  );
}

