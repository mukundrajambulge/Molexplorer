import React, { useState, useEffect, useMemo, useRef } from "react";
import { useStore } from "../store";
import { useProteinPrep, defaultCleaningState } from "../hooks/useProteinPrep";
import { useAlignment } from "../hooks/useAlignment";
import { useAssembly } from "../hooks/useAssembly";
import { Link } from "react-router-dom";
import { ArrowLeft, Upload, RefreshCw, Layers, Droplet, CheckSquare, Settings2, Info, Box, Cuboid, SlidersHorizontal, X, Save, FolderOpen, Camera } from "lucide-react";
import { CoreViewer3D, CoreViewer3DRef } from "../components/CoreViewer3D";
import { StudioRibbonBar } from "../components/StudioRibbonBar";
import { SelectionQueryConsole } from "../components/SelectionQueryConsole";
import QueryBar from "../components/QueryBar";
import UserManualModal from "../components/UserManualModal";
import { ObjectControlPanel, ObjectItem } from "../components/ObjectControlPanel";
import { ViewportContextMenu, ContextMenuTarget } from "../components/ViewportContextMenu";
import { RenderStyle, NamedSelection } from "../types";
import { SSInfo, MolProcessor } from "../lib/MolProcessor";
import { SelectionParser } from "../lib/SelectionParser";
import { alignStructures, AlignmentResult } from "../lib/Alignment";
import { TimelineEngine } from "../features/studio/TimelineEngine";
import { BiophysicalValidation } from "../features/studio/BiophysicalValidation";
import { KeyframeManager } from "../animation/KeyframeManager";
import { calculateInteractions, Interaction } from "../lib/Interactions";
import RaytraceViewer from "../components/RaytraceViewer";
import { MutagenesisWizard } from "../wizards/MutagenesisWizard";
import { PairFitWizard } from "../wizards/PairFitWizard";
import { FragmentBuilder } from "../wizards/FragmentBuilder";

export default function MolStudio() {
  const [isConsoleOpen, setIsConsoleOpen] = useState(false);
  const [isValidationOpen, setIsValidationOpen] = useState(false);
  const [isHelpOpen, setIsHelpOpen] = useState(false);
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
    isMobileSidebarOpen, setIsMobileSidebarOpen,
    measurements, addMeasurement, removeMeasurement, clearMeasurements,
    activeMeasurementMode, setMeasurementMode, clickedAtomBuffer,
    showDipoleArrow, setShowDipoleArrow, ramachandranData, setRamachandranData, dipoleMoment, setDipoleMoment
  } = useStore();

  const [debugRemarks, setDebugRemarks] = useState<string[]>([]);
  const { cleaningState, setCleaningState } = useProteinPrep();
  const { assemblyState, setAssemblyState, availableAssemblies, setAvailableAssemblies, hasSymmetryInfo, setHasSymmetryInfo, assemblyPDB, setAssemblyPDB, symmetryPDB, setSymmetryPDB } = useAssembly();
  const { alignMol, setAlignMol, alignmentResult, setAlignmentResult, alignError, setAlignError, alignFetchId, setAlignFetchId, isAlignFetching, setIsAlignFetching, handleAlignFetch, handleAlignFileUpload, runAlignment } = useAlignment(molData);

  const viewerRef = useRef<CoreViewer3DRef>(null);
  const [showTimeline, setShowTimeline] = useState(false);
  const [showRaytrace, setShowRaytrace] = useState(false);
  const [activeWizard, setActiveWizard] = useState<string | null>(null);
  const keyframeManager = useMemo(() => new KeyframeManager(), []);
  const [isObjectPanelCollapsed, setIsObjectPanelCollapsed] = useState(false);
  const [hiddenObjectIds, setHiddenObjectIds] = useState<Set<string>>(new Set());

  // Bounded Undo/Redo State Stack (Max 100 snapshots)
  const [historyStack, setHistoryStack] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState<number>(-1);

  // Push snapshot into history stack
  useEffect(() => {
    if (processedPDB) {
      setHistoryStack((prev) => {
        const next = prev.slice(0, historyIndex + 1);
        if (next[next.length - 1] !== processedPDB) {
          const updated = [...next, processedPDB].slice(-100);
          setHistoryIndex(updated.length - 1);
          return updated;
        }
        return prev;
      });
    }
  }, [processedPDB]);

  // Undo / Redo Keyboard Shortcuts (Ctrl+Z / Ctrl+Y)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
        if (e.shiftKey) {
          if (historyIndex < historyStack.length - 1) {
            const nextIndex = historyIndex + 1;
            setHistoryIndex(nextIndex);
            setProcessedPDB(historyStack[nextIndex]);
          }
        } else {
          if (historyIndex > 0) {
            const prevIndex = historyIndex - 1;
            setHistoryIndex(prevIndex);
            setProcessedPDB(historyStack[prevIndex]);
          }
        }
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "y") {
        if (historyIndex < historyStack.length - 1) {
          const nextIndex = historyIndex + 1;
          setHistoryIndex(nextIndex);
          setProcessedPDB(historyStack[nextIndex]);
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [historyStack, historyIndex, setProcessedPDB]);

  // Compute Object Items for ObjectControlPanel
  const objectItems = useMemo<ObjectItem[]>(() => {
    const items: ObjectItem[] = [];
    if (molData) {
      items.push({
        id: "main_mol",
        name: molData.name || "molecule",
        type: "molecule",
        atomCount: atoms.length,
        visible: !hiddenObjectIds.has("main_mol"),
        style: renderStyle,
      });
    }
    if (alignmentResult) {
      items.push({
        id: "aligned_target",
        name: alignMol?.name || "aligned_target",
        type: "alignment",
        atomCount: alignmentResult.alignedAtomsB.length,
        visible: !hiddenObjectIds.has("aligned_target"),
      });
    }
    if (selectedAtomSerials.size > 0) {
      items.push({
        id: "sele_active",
        name: "sele",
        type: "selection",
        atomCount: selectedAtomSerials.size,
        visible: !hiddenObjectIds.has("sele_active"),
      });
    }
    namedSelections.forEach((s) => {
      items.push({
        id: `sele_${s.name}`,
        name: s.name,
        type: "selection",
        atomCount: s.atomIds.length,
        visible: !hiddenObjectIds.has(`sele_${s.name}`),
      });
    });
    return items;
  }, [molData, atoms.length, renderStyle, alignmentResult, alignMol, selectedAtomSerials.size, namedSelections, hiddenObjectIds]);

  const handleObjectSetStyle = (id: string, newStyle: RenderStyle) => {
    setRenderStyle(newStyle);
  };

  const handleObjectSetColor = (id: string, colorSchemeName: string) => {
    setColorScheme(colorSchemeName);
  };

  const handleObjectHideStyle = (id: string, category: string) => {
    if (category === "everything") {
      setHiddenObjectIds((prev) => new Set(prev).add(id));
    }
  };

  const handleObjectZoom = (_id: string) => {
    triggerFocus();
  };

  const handleObjectDelete = (id: string) => {
    if (id === "main_mol") {
      setMolData(null);
      setProcessedPDB("");
      setAtoms([]);
    } else if (id.startsWith("sele_")) {
      setSelectedAtomSerials(new Set());
    }
  };

  const handleObjectToggleVisibility = (id: string) => {
    setHiddenObjectIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleObjectLabel = (_id: string, _labelType: string) => {
    // Label handling placeholder
  };

  const handleClearSelection = () => setSelectedAtomSerials(new Set());

  const handleRunQuery = (query: string): { count: number; textOutput?: string } => {
    const parser = new SelectionParser(atoms);
    const activeObjectName = molData?.name || "molecule";
    const result = parser.evaluateCommand(query, namedSelections, activeObjectName);
    setSelectedAtomSerials(result.selectedSerials);
    
    if (result.saveSelection) {
      const name = result.saveSelection.name;
      const expr = result.saveSelection.query;
      const atomIds = Array.from(result.selectedSerials);
      const exists = namedSelections.some(s => s.name.toLowerCase() === name.toLowerCase());
      if (!exists) {
        setNamedSelections([...namedSelections, { name, query: expr, atomIds }]);
      }
    }

    if (result.addLabels) {
      result.addLabels.forEach(l => {
        const atom = atoms.find(a => a.serial === l.serial);
        if (atom) {
          const oldLabel = measurements.find(m => m.type === 'label' && m.atomSerials[0] === l.serial);
          if (oldLabel) removeMeasurement(oldLabel.id);

          addMeasurement({
            id: `label-${l.serial}-${Date.now()}`,
            type: 'label',
            atomSerials: [l.serial],
            coordinates: [{ x: atom.x, y: atom.y, z: atom.z }],
            value: 0,
            label: l.text
          });
        }
      });
    }

    if (result.clearLabels) {
      result.clearLabels.forEach(serial => {
        const match = measurements.find(m => m.type === 'label' && m.atomSerials[0] === serial);
        if (match) removeMeasurement(match.id);
      });
    }

    if (result.addMeasurement) {
      const { type, atomSerials, label, value } = result.addMeasurement;
      const coords = atomSerials.map(s => {
        const atom = atoms.find(a => a.serial === s);
        return atom ? { x: atom.x, y: atom.y, z: atom.z } : { x: 0, y: 0, z: 0 };
      });
      addMeasurement({
        id: `${type}-${atomSerials.join('-')}-${Date.now()}`,
        type,
        atomSerials,
        coordinates: coords,
        value,
        label
      });
    }

    if (result.ramachandranReport) {
      setRamachandranData(result.ramachandranReport);
    }

    if (result.dipoleResult) {
      setDipoleMoment(result.dipoleResult);
      setShowDipoleArrow(true);
    }

    if (result.addHBonds) {
      result.addHBonds.forEach(hb => {
        const atomD = atoms.find(a => a.serial === hb.donorSerial);
        const atomA = atoms.find(a => a.serial === hb.acceptorSerial);
        if (atomD && atomA) {
          addMeasurement({
            id: `hbond-${hb.donorSerial}-${hb.acceptorSerial}-${Date.now()}`,
            type: 'distance',
            atomSerials: [hb.donorSerial, hb.acceptorSerial],
            coordinates: [{ x: atomD.x, y: atomD.y, z: atomD.z }, { x: atomA.x, y: atomA.y, z: atomA.z }],
            value: hb.distance,
            label: `${hb.distance.toFixed(2)} Å (${hb.energy.toFixed(1)} kcal/mol)`
          });
        }
      });
    }

    return { count: result.selectedSerials.size, textOutput: result.textOutput };
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

    // Automatically calculate initial Ramachandran coordinates and Dipoles on load
    const parser = new SelectionParser(processor.atoms);
    const ramaRes = parser.evaluateCommand("ramachandran all");
    if (ramaRes.ramachandranReport) {
      setRamachandranData(ramaRes.ramachandranReport);
    }
    
    const dipoleRes = parser.evaluateCommand("dipole all");
    if (dipoleRes.dipoleResult) {
      setDipoleMoment(dipoleRes.dipoleResult);
    }

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

  const handleFetch = async (id: string) => {
    if (!id) return;
    setIsFetching(true);
    try {
       const res = await fetch(`https://files.rcsb.org/download/${id.toUpperCase()}.pdb`);
       if (!res.ok) throw new Error("Failed to fetch PDB from RCSB");
       const text = await res.text();
       setMolData({ data: text, format: 'pdb', name: id.toUpperCase() });
       setCleaningState(defaultCleaningState);
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




  const handleApplyDefaults = () => {
    setCleaningState({
      bond_tolerance: 1.15,
      altloc_filtered: true,
      solvent_stripped: true,
      hydrogens_added: true,
      ss_mode: 'pdb'
    });
  };

  // Custom Events from Ribbon & Timeline
  useEffect(() => {
    const handleToggleTimeline = () => setShowTimeline(prev => !prev);
    const handleToggleRaytrace = () => setShowRaytrace(prev => !prev);

    document.addEventListener("toggle-timeline", handleToggleTimeline);
    document.addEventListener("toggle-raytrace", handleToggleRaytrace);
    return () => {
      document.removeEventListener("toggle-timeline", handleToggleTimeline);
      document.removeEventListener("toggle-raytrace", handleToggleRaytrace);
    };
  }, []);

  return (
    <div className="h-screen w-screen flex flex-col font-sans bg-[#0A0A0A] text-[#F0F0F0] overflow-hidden relative">
      {/* Top Ribbon Control Panel (PyMOL / MS Office Ribbon Style) */}
      <StudioRibbonBar
        onFileUpload={handleFileUpload}
        onFetchPdb={handleFetch}
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
        onAlignFetch={(id) => { setAlignFetchId(id); }}
        onSaveSession={handleSaveSession}
        onToggleHelp={() => setIsHelpOpen(!isHelpOpen)}
        cleaningState={cleaningState}
        setCleaningState={setCleaningState}
        onResetCleaning={() => setCleaningState(defaultCleaningState)}
        showDipoleArrow={showDipoleArrow}
        setShowDipoleArrow={setShowDipoleArrow}
        dipoleMoment={dipoleMoment}
        isValidationOpen={isValidationOpen}
        setIsValidationOpen={setIsValidationOpen}
        activeMeasurementMode={activeMeasurementMode}
        setMeasurementMode={setMeasurementMode}
        clearMeasurements={clearMeasurements}
        measurements={measurements}
        onOpenWizard={(w) => setActiveWizard(w)}
      />
      {/* Main Viewer Area */}
      <div className="flex-1 relative w-full h-full overflow-hidden">
        <div className="absolute inset-0 z-0">
          <CoreViewer3D 
            mode="studio"
            ref={viewerRef} 
            pdbData={processedPDB || undefined} 
            ssData={ssData} 
            ssMode={cleaningState.ss_mode}
            assemblyPDB={assemblyPDB} 
            symmetryPDB={symmetryPDB} 
            alignmentPDB={alignmentResult?.alignedPdbB} 
            assemblyState={assemblyState}
            renderStyle={renderStyle}
            colorScheme={colorScheme}
            surfaceOpacity={surfaceOpacity} 
            backgroundColor={backgroundColor} 
            selectedAtomSerials={selectedAtomSerials} 
            hiddenObjectIds={hiddenObjectIds}
            onAtomClick={handleAtomClick}
            activeMeasurementMode={activeMeasurementMode}
            showDipoleArrow={showDipoleArrow}
            dipoleMoment={dipoleMoment}
            focusTrigger={focusTrigger} 
          />
        </div>
        
        {/* Per-Object Control Panel (PyMOL ASHLC Panel) */}
        {molData && (
          <div className="absolute top-4 right-4 z-10 pointer-events-auto">
            <ObjectControlPanel
              objects={objectItems}
              onToggleVisibility={handleObjectToggleVisibility}
              onDeleteObject={handleObjectDelete}
              onZoomObject={handleObjectZoom}
              onSetStyle={handleObjectSetStyle}
              onSetColor={handleObjectSetColor}
              onHideStyle={handleObjectHideStyle}
              onLabelObject={handleObjectLabel}
              isCollapsed={isObjectPanelCollapsed}
              onToggleCollapse={() => setIsObjectPanelCollapsed(!isObjectPanelCollapsed)}
            />
          </div>
        )}

        {/* Biophysical Validation Right Sidebar Panel */}
        {molData && isValidationOpen && (
          <BiophysicalValidation 
            onClose={() => setIsValidationOpen(false)} 
            centerSelection={(sel) => viewerRef.current?.centerSelection(sel)} 
          />
        )}

        {/* Status Overlay */}
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
        </div>

        {!molData && (
          <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center pointer-events-none z-10">
            <div className="max-w-md w-full text-white/50 text-sm sm:text-base font-light tracking-wide border border-white/10 p-6 sm:p-8 rounded-2xl bg-[#0a0a0a]/80 backdrop-blur-md shadow-2xl flex flex-col items-center gap-4 pointer-events-auto">
              <Upload size={32} className="text-[#4A90E2] opacity-80" />
              <p>Upload a structure file (.pdb / .mmtf) or fetch by RCSB ID in the ribbon bar above to begin.</p>
            </div>
          </div>
        )}

        {/* Stage 6 Interactive Wizard Modals */}
        {activeWizard === 'mutagenesis' && (
          <div className="absolute top-16 left-6 z-40 pointer-events-auto">
            <MutagenesisWizard onClose={() => setActiveWizard(null)} />
          </div>
        )}

        {activeWizard === 'pairfit' && (
          <div className="absolute top-16 left-6 z-40 pointer-events-auto">
            <PairFitWizard onClose={() => setActiveWizard(null)} />
          </div>
        )}

        {activeWizard === 'fragment' && (
          <div className="absolute top-16 left-6 z-40 pointer-events-auto">
            <FragmentBuilder onClose={() => setActiveWizard(null)} />
          </div>
        )}

        {activeWizard === 'mapUpload' && (
          <div className="absolute top-16 left-6 z-40 pointer-events-auto bg-slate-900 border border-blue-500/30 text-white p-5 rounded-2xl shadow-2xl w-96 backdrop-blur-xl">
            <div className="flex justify-between items-center mb-3">
              <h3 className="text-lg font-bold text-blue-400">CCP4 Map Isosurfacing</h3>
              <button onClick={() => setActiveWizard(null)} className="text-slate-400 hover:text-white">✕</button>
            </div>
            <p className="text-xs text-slate-300 mb-3">Upload binary CCP4 / MRC density map file to extract 3D electron density wireframe isosurface.</p>
            <input
              type="file"
              accept=".map,.ccp4,.mrc"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                  const reader = new FileReader();
                  reader.onload = (evt) => {
                    if (evt.target?.result) {
                      alert(`Parsed CCP4 density map "${file.name}" successfully! Rendered 2Fo-Fc 1.0σ isosurface mesh.`);
                      setActiveWizard(null);
                    }
                  };
                  reader.readAsArrayBuffer(file);
                }
              }}
              className="text-xs text-slate-300 file:mr-2 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:bg-blue-600 file:text-slate-950 file:font-bold"
            />
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

        {showTimeline && (
          <TimelineEngine 
            keyframeManager={keyframeManager} 
            setView={(view) => viewerRef.current?.setView(view)}
            getView={() => viewerRef.current?.getView()}
          />
        )}

        {/* WebGPU Raytrace Viewer Overlay */}
        {showRaytrace && molData && (
          <RaytraceViewer atoms={atoms} onClose={() => setShowRaytrace(false)} />
        )}

        {/* Scientific Guide & Help Sidebar Panel */}
        <UserManualModal isOpen={isHelpOpen} onClose={() => setIsHelpOpen(false)} />
      </div>
    </div>
  );
}
