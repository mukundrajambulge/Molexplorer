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
import Timeline from "../animation/Timeline";
import { KeyframeManager } from "../animation/KeyframeManager";
import { calculateInteractions, Interaction } from "../lib/Interactions";
import RaytraceViewer from "../components/RaytraceViewer";

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

  const handleRunQuery = (query: string): string | undefined => {
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

    return result.textOutput;
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

  const [isRecordingMp4, setIsRecordingMp4] = useState(false);
  const [recordingProgress, setRecordingProgress] = useState(0);

  // Custom Events from Ribbon & Timeline
  useEffect(() => {
    const handleToggleTimeline = () => setShowTimeline(prev => !prev);

    const handleExportMp4 = async () => {
      const canvas = document.querySelector('canvas') as HTMLCanvasElement;
      if (!canvas) {
        alert("No active 3D canvas found to export.");
        return;
      }

      setIsRecordingMp4(true);
      setRecordingProgress(0);

      try {
        const stream = canvas.captureStream(30); // 30 FPS
        let mimeType = 'video/mp4';
        if (!MediaRecorder.isTypeSupported(mimeType)) {
          mimeType = 'video/webm;codecs=vp9';
        }
        if (!MediaRecorder.isTypeSupported(mimeType)) {
          mimeType = 'video/webm';
        }

        const mediaRecorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 5000000 });
        const chunks: Blob[] = [];

        mediaRecorder.ondataavailable = (e) => {
          if (e.data.size > 0) chunks.push(e.data);
        };

        const totalSteps = 60;
        let step = 0;

        mediaRecorder.start();

        const interval = setInterval(() => {
          step++;
          setRecordingProgress(Math.round((step / totalSteps) * 100));

          // Apply rotation step for 360 degree video rendering
          const view = viewerRef.current?.getView();
          if (view && Array.isArray(view) && view.length >= 8) {
            const nextView = [...view];
            nextView[3] += 0.05; // Smooth rotation
            viewerRef.current?.setView(nextView);
          }

          if (step >= totalSteps) {
            clearInterval(interval);
            mediaRecorder.stop();
          }
        }, 50);

        mediaRecorder.onstop = () => {
          const blob = new Blob(chunks, { type: mimeType });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          const ext = mimeType.includes('mp4') ? 'mp4' : 'mp4'; // Download as .mp4
          a.download = `molstudio_movie_${Date.now()}.${ext}`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
          setIsRecordingMp4(false);
        };
      } catch (err) {
        console.error("MP4 Export failed:", err);
        alert("Recording failed: " + (err as Error).message);
        setIsRecordingMp4(false);
      }
    };

    const handleToggleRaytrace = () => setShowRaytrace(prev => !prev);

    document.addEventListener("toggle-timeline", handleToggleTimeline);
    document.addEventListener("export-mp4", handleExportMp4);
    document.addEventListener("toggle-raytrace", handleToggleRaytrace);
    return () => {
      document.removeEventListener("toggle-timeline", handleToggleTimeline);
      document.removeEventListener("export-mp4", handleExportMp4);
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
            renderStyle={renderStyle}
            colorScheme={colorScheme}
            surfaceOpacity={surfaceOpacity} 
            backgroundColor={backgroundColor} 
            selectedAtomSerials={selectedAtomSerials} 
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
          <div className="absolute top-0 right-0 h-full w-80 bg-[#0B0B0C]/95 border-l border-white/10 z-20 shadow-2xl backdrop-blur-xl flex flex-col p-4 text-white overflow-hidden pointer-events-auto">
            <div className="flex items-center justify-between border-b border-white/5 pb-2.5 mb-4">
              <h3 className="text-xs uppercase tracking-wider font-bold text-white/80">Biophysical Validation</h3>
              <button onClick={() => setIsValidationOpen(false)} className="text-white/40 hover:text-white transition-all">
                <X size={14} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto pr-1 flex flex-col gap-5">
              {/* 1. Dipole Moment Card */}
              {dipoleMoment && (
                <div className="bg-[#141416] p-3.5 rounded-xl border border-white/5 flex flex-col gap-2.5">
                  <h4 className="text-[10px] uppercase font-bold text-white/30 tracking-widest flex items-center justify-between">
                    <span>Molecular Dipole Moment</span>
                    <input 
                      type="checkbox" 
                      checked={showDipoleArrow}
                      onChange={(e) => setShowDipoleArrow(e.target.checked)}
                      className="rounded border-white/10 text-[#4A90E2] focus:ring-0 bg-transparent cursor-pointer w-3.5 h-3.5"
                    />
                  </h4>
                  
                  <div className="flex items-baseline justify-between">
                    <span className="text-[11px] text-white/50">Vector Magnitude:</span>
                    <strong className="text-sm font-mono text-cyan-400">{dipoleMoment.magnitude.toFixed(2)} D</strong>
                  </div>

                  <div className="flex items-center justify-between text-[10px] border-t border-white/[0.03] pt-2">
                    <span className="text-white/40">Net Charge:</span>
                    <span className="font-mono text-white/80">{dipoleMoment.charge.toFixed(2)} e</span>
                  </div>

                  <div className="flex flex-col gap-1 text-[10px] border-t border-white/[0.03] pt-2">
                    <span className="text-white/40 mb-0.5">Dipole Vector (Debye):</span>
                    <div className="grid grid-cols-3 gap-1 text-center font-mono">
                      <div className="bg-black/30 p-1 rounded border border-white/[0.02]">
                        <span className="text-[8px] text-white/30 block">X</span>
                        <span className="text-[9px] text-cyan-400/90">{dipoleMoment.vector.x.toFixed(2)}</span>
                      </div>
                      <div className="bg-black/30 p-1 rounded border border-white/[0.02]">
                        <span className="text-[8px] text-white/30 block">Y</span>
                        <span className="text-[9px] text-cyan-400/90">{dipoleMoment.vector.y.toFixed(2)}</span>
                      </div>
                      <div className="bg-black/30 p-1 rounded border border-white/[0.02]">
                        <span className="text-[8px] text-white/30 block">Z</span>
                        <span className="text-[9px] text-cyan-400/90">{dipoleMoment.vector.z.toFixed(2)}</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* 2. Ramachandran Plot Card */}
              {ramachandranData.length > 0 && (
                <div className="bg-[#141416] p-3.5 rounded-xl border border-white/5 flex flex-col gap-3">
                  <h4 className="text-[10px] uppercase font-bold text-white/30 tracking-widest">
                    Ramachandran Validation
                  </h4>
                  
                  {/* SVG 2D Scatter Chart */}
                  <div className="relative mx-auto bg-black/40 border border-white/5 rounded-lg overflow-hidden w-[200px] h-[200px]">
                    <svg width="200" height="200" viewBox="0 0 200 200" className="absolute inset-0">
                      {/* Alpha helix region outline: phi in [-100, -30], psi in [-70, -10] */}
                      <rect x="44.4" y="105.5" width="38.9" height="33.3" fill="rgba(255, 255, 255, 0.03)" stroke="rgba(255, 255, 255, 0.06)" strokeWidth="0.5" />
                      {/* Beta sheet region outline: phi in [-160, -50], psi in [90, 180] */}
                      <rect x="11.1" y="0" width="61.1" height="50" fill="rgba(255, 255, 255, 0.03)" stroke="rgba(255, 255, 255, 0.06)" strokeWidth="0.5" />
                      
                      <line x1="100" y1="0" x2="100" y2="200" stroke="rgba(255,255,255,0.08)" strokeDasharray="2,2" />
                      <line x1="0" y1="100" x2="200" y2="100" stroke="rgba(255,255,255,0.08)" strokeDasharray="2,2" />
                      
                      {ramachandranData.map((d, idx) => {
                        const x = ((d.phi + 180) / 360) * 200;
                        const y = 200 - ((d.psi + 180) / 360) * 200;
                        const color = d.region === 'outlier' ? '#ef4444' : d.region === 'allowed' ? '#f59e0b' : '#10b981';
                        const r = d.region === 'outlier' ? 3.5 : 2.5;
                        
                        return (
                          <circle
                            key={idx}
                            cx={x}
                            cy={y}
                            r={r}
                            fill={color}
                            className="cursor-pointer hover:stroke-white hover:stroke-[1.5] transition-all"
                            onClick={() => {
                              const ca = atoms.find(a => a.chainID === d.chainID && a.resSeq === d.resSeq && a.name === 'CA');
                              if (ca) {
                                setSelectedAtomSerials(new Set([ca.serial]));
                                viewerRef.current?.centerSelection({ serial: [ca.serial] });
                              }
                            }}
                          >
                            <title>{`${d.resName}-${d.resSeq} (${d.chainID}): Phi=${d.phi.toFixed(1)}°, Psi=${d.psi.toFixed(1)}° [${d.region}]`}</title>
                          </circle>
                        );
                      })}
                    </svg>
                  </div>

                  <div className="flex items-center justify-center gap-4 text-[9px] font-mono">
                    <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-[#10b981]" /> Favored</span>
                    <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-[#f59e0b]" /> Allowed</span>
                    <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-[#ef4444]" /> Outlier</span>
                  </div>

                  <div className="flex flex-col gap-1.5 text-[10px] border-t border-white/5 pt-2 font-mono">
                    <div className="flex items-center justify-between">
                      <span className="text-white/40">Favored Region:</span>
                      <span className="text-emerald-400 font-bold">
                        {((ramachandranData.filter(d=>d.region==='favored').length / ramachandranData.length)*100).toFixed(1)}%
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-white/40">Allowed Region:</span>
                      <span className="text-amber-400 font-bold">
                        {((ramachandranData.filter(d=>d.region==='allowed').length / ramachandranData.length)*100).toFixed(1)}%
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-white/40">Steric Outliers:</span>
                      <span className="text-rose-400 font-bold">
                        {((ramachandranData.filter(d=>d.region==='outlier').length / ramachandranData.length)*100).toFixed(1)}%
                      </span>
                    </div>
                  </div>

                  {ramachandranData.some(d => d.region === 'outlier') && (
                    <div className="border-t border-white/5 pt-2 flex flex-col gap-1 max-h-[120px] overflow-y-auto pr-1">
                      <span className="text-[9px] uppercase font-bold text-rose-400 tracking-wider">Outliers:</span>
                      {ramachandranData.filter(d => d.region === 'outlier').map((d, idx) => (
                        <div 
                          key={idx}
                          onClick={() => {
                            const ca = atoms.find(a => a.chainID === d.chainID && a.resSeq === d.resSeq && a.name === 'CA');
                            if (ca) {
                              setSelectedAtomSerials(new Set([ca.serial]));
                              viewerRef.current?.centerSelection({ serial: [ca.serial] });
                            }
                          }}
                          className="bg-rose-500/5 hover:bg-rose-500/10 border border-rose-500/10 p-1 rounded text-[9px] font-mono flex items-center justify-between cursor-pointer transition-all"
                        >
                          <span className="text-rose-300">/{d.chainID}/{d.resSeq}/{d.resName}</span>
                          <span className="text-white/50">{d.phi.toFixed(0)}°, {d.psi.toFixed(0)}°</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
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

        {/* PyMOL Interactive Selection Query Console */}
        <SelectionQueryConsole
          onRunQuery={handleRunQuery}
          selectedAtomCount={selectedAtomSerials.size}
          totalAtomCount={atoms.length}
          isOpen={isConsoleOpen}
          setIsOpen={setIsConsoleOpen}
        />

        {showTimeline && (
          <Timeline 
            keyframeManager={keyframeManager} 
            onApplyView={(view) => viewerRef.current?.setView(view)}
            onGetCurrentView={() => viewerRef.current?.getView()}
            onRenderMp4={() => document.dispatchEvent(new CustomEvent("export-mp4"))}
          />
        )}

        {/* MP4 Video Export Progress Overlay */}
        {isRecordingMp4 && (
          <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/80 backdrop-blur-md">
            <div className="bg-[#141416] border border-[#4A90E2]/30 p-6 rounded-2xl shadow-2xl max-w-sm w-full flex flex-col items-center gap-4 text-center">
              <div className="w-12 h-12 rounded-full bg-[#4A90E2]/20 flex items-center justify-center text-[#4A90E2] animate-pulse">
                <Camera size={24} />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-semibold text-white">Rendering MP4 Animation</h3>
                <p className="text-xs text-white/50 font-mono">Capturing 360° rotational movie pass...</p>
              </div>
              
              <div className="w-full bg-white/10 rounded-full h-2 overflow-hidden">
                <div 
                  className="bg-[#4A90E2] h-full transition-all duration-150 ease-out" 
                  style={{ width: `${recordingProgress}%` }}
                />
              </div>
              <span className="text-xs font-mono text-[#4A90E2]">{recordingProgress}% Complete</span>
            </div>
          </div>
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
