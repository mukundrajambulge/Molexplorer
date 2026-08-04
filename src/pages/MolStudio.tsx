import { useState, useEffect, useMemo, useRef } from "react";
import { useStore } from "../store";
import { useDocking } from "../hooks/useDocking";
import { useProteinPrep, defaultCleaningState } from "../hooks/useProteinPrep";
import { useAlignment } from "../hooks/useAlignment";
import { useAssembly } from "../hooks/useAssembly";
import { Link } from "react-router-dom";
import { ArrowLeft, Upload, RefreshCw, Layers, Droplet, CheckSquare, Settings2, Info, Box, Cuboid, SlidersHorizontal, X, Save, FolderOpen } from "lucide-react";
import MolStudioViewer, { MolStudioViewerRef } from "../components/MolStudioViewer";
import { StudioRibbonBar } from "../components/StudioRibbonBar";
import { SelectionQueryConsole } from "../components/SelectionQueryConsole";
import QueryBar from "../components/QueryBar";
import { RenderStyle, NamedSelection } from "../types";
import { SSInfo, MolProcessor } from "../lib/MolProcessor";
import { alignStructures, AlignmentResult } from "../lib/Alignment";
import { convertToPDBQT, runWebina, formatError } from "../lib/Docking";
import { SelectionParser } from "../lib/SelectionParser";
import { calculateInteractions, Interaction } from "../lib/Interactions";



export default function MolStudio() {
  const [isConsoleOpen, setIsConsoleOpen] = useState(true);
  const {
    molData, setMolData,
    processedPDB, setProcessedPDB,
    atoms, setAtoms,
    selectedAtomSerials, setSelectedAtomSerials,
    ssData, setSsData,
    renderStyle, setRenderStyle,
    colorScheme, setColorScheme,
    surfaceOpacity, setSurfaceOpacity,
    backgroundColor, setBackgroundColor,
    namedSelections, setNamedSelections,
    focusTrigger, triggerFocus,
    isMobileSidebarOpen, setIsMobileSidebarOpen
  } = useStore();

  const [debugRemarks, setDebugRemarks] = useState<string[]>([]);
  const { cleaningState, setCleaningState } = useProteinPrep();
  const { assemblyState, setAssemblyState, availableAssemblies, setAvailableAssemblies, hasSymmetryInfo, setHasSymmetryInfo, assemblyPDB, setAssemblyPDB, symmetryPDB, setSymmetryPDB } = useAssembly();
  const { alignMol, setAlignMol, alignmentResult, setAlignmentResult, alignError, setAlignError, alignFetchId, setAlignFetchId, isAlignFetching, setIsAlignFetching, handleAlignFetch, handleAlignFileUpload, runAlignment } = useAlignment(molData);
  
  const dockingContext = useDocking(molData, atoms, selectedAtomSerials);
  const {
    ligandData, setLigandData, dockingBox, setDockingBox, isDocking, setIsDocking, dockingLog, setDockingLog,
    dockingResultPdbqt, setDockingResultPdbqt, exhaustiveness, setExhaustiveness, dockingInputPdbqt, setDockingInputPdbqt,
    dockingReceptorPdbqt, setDockingReceptorPdbqt, interactions, setInteractions, redockRmsd, setRedockRmsd,
    showDockingBox, setShowDockingBox, gridBoxThickness, setGridBoxThickness, gridBoxOpacity, setGridBoxOpacity,
    dockingPrep, setDockingPrep, handleLigandUpload, handleSetBoxFromSelection, handleAutoSuggestBox, handleRunDocking, handleCancelDocking
  } = dockingContext;

  const viewerRef = useRef<MolStudioViewerRef>(null);

  const handleClearSelection = () => setSelectedAtomSerials(new Set());

  const handleRunQuery = (query: string) => {
    const parser = new SelectionParser(atoms);
    setSelectedAtomSerials(parser.parse(query));
  };

  const handleSaveSelection = (name: string, query: string) => {
    const parser = new SelectionParser(atoms);
    const atomIds = Array.from(parser.parse(query));
    setNamedSelections([...namedSelections, { name, query, atomIds }]);
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
        setCleaningState(defaultCleaningState); // Reset state on new file
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
       setCleaningState(defaultCleaningState);
       setFetchId("");
    } catch (err: any) {
       alert("Error fetching structure: " + err.message);
    } finally {
       setIsFetching(false);
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
    <div className="h-screen w-screen flex flex-col font-sans bg-[#0A0A0A] text-[#F0F0F0] overflow-hidden relative">
      {/* Top Ribbon Control Panel (PyMOL / MS Office Ribbon Style) */}
      <StudioRibbonBar
        onFileUpload={handleFileUpload}
        onFetchPdb={(id) => { setFetchId(id); }}
        renderStyle={renderStyle}
        setRenderStyle={setRenderStyle}
        colorScheme={colorScheme}
        setColorScheme={setColorScheme}
        surfaceOpacity={surfaceOpacity}
        setSurfaceOpacity={setSurfaceOpacity}
        backgroundColor={backgroundColor}
        setBackgroundColor={setBackgroundColor}
        onRunQuery={handleRunQuery}
        onClearSelection={handleClearSelection}
        selectedAtomCount={selectedAtomSerials.size}
        totalAtomCount={atoms.length}
        isDocking={isDocking}
        onStartDocking={handleRunDocking}
        onAutoSuggestBox={handleAutoSuggestBox}
        onAlignFetch={(id) => { setAlignFetchId(id); }}
        onSaveSession={handleSaveSession}
        cleaningState={cleaningState}
        setCleaningState={setCleaningState}
        onResetCleaning={() => setCleaningState(defaultCleaningState)}
      />
      {/* Main Viewer Area */}
      <div className="flex-1 relative w-full h-full overflow-hidden">
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
              <p>Upload a structure file (.pdb / .mmtf) or fetch by RCSB ID in the ribbon bar above to begin.</p>
            </div>
          </div>
        )}

        {/* PyMOL Interactive Selection Query Console */}
        <SelectionQueryConsole
          onRunQuery={handleRunQuery}
          selectedAtomCount={selectedAtomSerials.size}
          totalAtomCount={atoms.length}
          isOpen={isConsoleOpen}
          setIsOpen={setIsConsoleOpen}
        />
      </div>
    </div>
  );
}
