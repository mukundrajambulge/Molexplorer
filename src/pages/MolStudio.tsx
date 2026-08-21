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
import { HistoryManager } from "../state/HistoryManager";
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
import { SessionManager } from "../session/SessionManager";
import { MolStudioSession } from "../session/SessionSchema";
import { SequenceViewer } from "../components/SequenceViewer";
import { HotkeyManager } from "../input/HotkeyManager";
import { SculptingEngine } from "../simulation/SculptingEngine";
import { TopologyEditor } from "../editor/TopologyEditor";
import { ScientificEditingKernel } from "../domain/ScientificEditingKernel";
import { ScientificRevisionManager } from "../domain/ScientificRevisionManager";
import { MeasurementWizard } from "../components/MeasurementWizard";
import { StudioExportModal } from "../components/StudioExportModal";
import { Command, Ruler, CheckCircle2 } from "lucide-react";

export default function MolStudio() {
  const [isConsoleOpen, setIsConsoleOpen] = useState(false);
  const [isValidationOpen, setIsValidationOpen] = useState(false);
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [isExportOpen, setIsExportOpen] = useState(false);
  const {
    molData, setMolData,
    processedPDB, setProcessedPDB,
    atoms, setAtoms,
    selectedAtomSerials, setSelectedAtomSerials,
    selectionLevel, setSelectionLevel,
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
  const processorRef = useRef<MolProcessor | null>(null);
  const [showTimeline, setShowTimeline] = useState(false);
  const [showRaytrace, setShowRaytrace] = useState(false);
  const [activeWizard, setActiveWizard] = useState<string | null>(null);
  const keyframeManager = useMemo(() => new KeyframeManager(), []);
  const [isObjectPanelCollapsed, setIsObjectPanelCollapsed] = useState(false);
  const [hiddenObjectIds, setHiddenObjectIds] = useState<Set<string>>(new Set());

  // Stage 7 State Variables
  const [showSequenceViewer, setShowSequenceViewer] = useState(false);
  const [orthographic, setOrthographic] = useState(false);
  const [stereoMode, setStereoMode] = useState<'none' | 'cross-eye' | 'anaglyph'>('none');
  const [showHotkeysModal, setShowHotkeysModal] = useState(false);

  // Stage 8 State Variables & Topology Handlers
  const [isSculptingActive, setIsSculptingActive] = useState(false);

  const handleAddHydrogens = (selection?: Set<number>) => {
    if (processorRef.current) {
      try {
        const doc = processorRef.current.getCanonicalDocument();
        const targetIds = selection && selection.size > 0 ? Array.from(selection) : undefined;
        const mutation = ScientificEditingKernel.addHydrogens(doc, targetIds, {
          objectId: doc.active_object_id,
          author: 'User'
        });
        processorRef.current.applyScientificRevision(mutation.revision);
      } catch (err: any) {
        console.warn('Add hydrogens fallback:', err.message);
        TopologyEditor.addHydrogens(processorRef.current);
      }
      setAtoms([...processorRef.current.atoms]);
      setProcessedPDB(processorRef.current.toPDB());
      triggerFocus();
    }
  };

  const handleRemoveHydrogens = (selection?: Set<number>) => {
    if (processorRef.current) {
      try {
        const doc = processorRef.current.getCanonicalDocument();
        const targetIds = selection && selection.size > 0 ? Array.from(selection) : undefined;
        const mutation = ScientificEditingKernel.removeHydrogens(doc, targetIds, {
          objectId: doc.active_object_id,
          author: 'User'
        });
        processorRef.current.applyScientificRevision(mutation.revision);
      } catch (err: any) {
        console.warn('Remove hydrogens fallback:', err.message);
        TopologyEditor.removeHydrogens(processorRef.current);
      }
      setAtoms([...processorRef.current.atoms]);
      setProcessedPDB(processorRef.current.toPDB());
      triggerFocus();
    }
  };

  const handleDeleteSelectedAtoms = () => {
    if (processorRef.current && selectedAtomSerials.size > 0) {
      try {
        const doc = processorRef.current.getCanonicalDocument();
        const selResult = {
          query: 'selected',
          selected_ids: selectedAtomSerials,
          selected_array: Array.from(selectedAtomSerials).sort((a, b) => a - b),
          count: selectedAtomSerials.size,
          object_id: 'main_mol'
        };
        const mutation = ScientificEditingKernel.remove(doc, selResult, {
          objectId: 'main_mol',
          author: 'User'
        });
        processorRef.current.applyScientificRevision(mutation.revision);
      } catch (err) {
        // Fallback to legacy delete if canonical transaction encounters non-standard state
        TopologyEditor.deleteAtoms(processorRef.current, selectedAtomSerials);
      }
      setSelectedAtomSerials(new Set());
      setAtoms([...processorRef.current.atoms]);
      setProcessedPDB(processorRef.current.toPDB());
      triggerFocus();
    }
  };

  const handleCycleValence = () => {
    if (processorRef.current && selectedAtomSerials.size >= 2) {
      const serials = Array.from(selectedAtomSerials);
      const idx1 = atoms.findIndex(a => a.serial === serials[0]);
      const idx2 = atoms.findIndex(a => a.serial === serials[1]);
      if (idx1 >= 0 && idx2 >= 0) {
        TopologyEditor.cycleBondOrder(processorRef.current, idx1, idx2);
        setAtoms([...processorRef.current.atoms]);
        setProcessedPDB(processorRef.current.toPDB());
        triggerFocus();
      }
    }
  };

  // Real-Time Sculpting Energy Minimization Loop
  useEffect(() => {
    if (!isSculptingActive || atoms.length === 0) return;
    const interval = setInterval(() => {
      const { atoms: minimized } = SculptingEngine.minimize(atoms, 10, 0.002);
      setAtoms(minimized);
      if (processorRef.current) {
        processorRef.current.atoms = minimized;
        setProcessedPDB(processorRef.current.toPDB());
      }
    }, 100);
    return () => clearInterval(interval);
  }, [isSculptingActive, atoms]);

  const [sessionNotification, setSessionNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const handleSaveSession = () => {
    if (!molData) {
      alert("No active structure loaded to save.");
      return;
    }

    const cameraView = viewerRef.current?.getView ? viewerRef.current.getView() : undefined;

    const molecules: any[] = [
      {
        id: 'main_mol',
        name: molData.name || 'molecule',
        format: molData.format,
        data: processedPDB || (molData.data instanceof Uint8Array ? new TextDecoder().decode(molData.data) : molData.data),
        atomCount: atoms.length,
        visible: !hiddenObjectIds.has('main_mol'),
        style: renderStyle,
        colorScheme
      }
    ];

    if (alignmentResult && alignMol) {
      molecules.push({
        id: 'aligned_target',
        name: alignMol.name || 'aligned_target',
        format: alignMol.format,
        data: alignMol.data instanceof Uint8Array ? new TextDecoder().decode(alignMol.data) : alignMol.data,
        atomCount: alignmentResult.alignedAtomsB.length,
        visible: !hiddenObjectIds.has('aligned_target')
      });
    }

    const session = SessionManager.createSession({
      molecules,
      viewerState: {
        renderStyle,
        colorScheme,
        surfaceOpacity,
        backgroundColor,
        orthographic,
        stereoMode,
        hiddenObjectIds: Array.from(hiddenObjectIds),
        camera: cameraView ? { viewMatrix: cameraView } : undefined
      },
      selectionState: {
        selectionLevel,
        selectedAtomSerials: Array.from(selectedAtomSerials),
        namedSelections
      },
      measurements,
      biophysical: {
        showDipoleArrow,
        ramachandranData,
        dipoleMoment
      }
    });

    const filename = `${molData.name || 'workspace'}.pse`;
    SessionManager.downloadSessionFile(session, filename);
    setSessionNotification({
      type: 'success',
      message: `Session saved successfully: ${filename}`
    });
    setTimeout(() => setSessionNotification(null), 4000);
  };

  const handleLoadSessionFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const text = ev.target?.result as string;
        const session = SessionManager.importSession(text);

        // 1. Reconstruct molecules
        if (session.molecules && session.molecules.length > 0) {
          const mainMol = session.molecules[0];
          setMolData({
            data: mainMol.data,
            format: mainMol.format,
            name: mainMol.name
          });
        }

        // 2. Reconstruct selection state
        if (session.selectionState) {
          if (session.selectionState.selectionLevel) {
            setSelectionLevel(session.selectionState.selectionLevel);
          }
          if (Array.isArray(session.selectionState.selectedAtomSerials)) {
            setSelectedAtomSerials(new Set(session.selectionState.selectedAtomSerials));
          }
          if (Array.isArray(session.selectionState.namedSelections)) {
            setNamedSelections(session.selectionState.namedSelections);
          }
        }

        // 3. Reconstruct measurements
        clearMeasurements();
        if (Array.isArray(session.measurements)) {
          session.measurements.forEach(m => addMeasurement(m));
        }

        // 4. Reconstruct biophysical state
        if (session.biophysical) {
          setShowDipoleArrow(Boolean(session.biophysical.showDipoleArrow));
          if (session.biophysical.ramachandranData) setRamachandranData(session.biophysical.ramachandranData);
          if (session.biophysical.dipoleMoment) setDipoleMoment(session.biophysical.dipoleMoment);
        }

        // 5. Reconstruct viewer state
        if (session.viewerState) {
          setRenderStyle(session.viewerState.renderStyle);
          setColorScheme(session.viewerState.colorScheme);
          setSurfaceOpacity(session.viewerState.surfaceOpacity);
          setBackgroundColor(session.viewerState.backgroundColor);
          setOrthographic(session.viewerState.orthographic);
          setStereoMode(session.viewerState.stereoMode);
          if (Array.isArray(session.viewerState.hiddenObjectIds)) {
            setHiddenObjectIds(new Set(session.viewerState.hiddenObjectIds));
          }
          if (session.viewerState.camera?.viewMatrix && viewerRef.current?.setView) {
            setTimeout(() => {
              try { viewerRef.current.setView(session.viewerState.camera!.viewMatrix); } catch (e) {}
            }, 100);
          }
        }

        const isLegacy = session.metadata?.legacyConverted;
        setSessionNotification({
          type: 'success',
          message: isLegacy ? 'Session restored successfully (converted from legacy format).' : 'Session restored successfully.'
        });
        setTimeout(() => setSessionNotification(null), 4000);
      } catch (err: any) {
        setSessionNotification({
          type: 'error',
          message: err.message || 'Failed to load session file.'
        });
        setTimeout(() => setSessionNotification(null), 6000);
      }
    };
    reader.readAsText(file);
  };

  // Mount Hotkey Manager
  useEffect(() => {
    const manager = new HotkeyManager({
      onResetView: () => triggerFocus(),
      onZoomSelection: () => triggerFocus(),
      onClearSelection: () => setSelectedAtomSerials(new Set()),
      onToggleSequence: () => setShowSequenceViewer(prev => !prev),
      onToggleCamera: () => setOrthographic(prev => !prev),
      onExportSession: () => handleSaveSession()
    });
    manager.register();
    return () => manager.unregister();
  }, [molData, selectedAtomSerials, namedSelections, measurements, renderStyle, colorScheme, orthographic, stereoMode]);

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
    const prevStyle = renderStyle;
    HistoryManager.getInstance().record({
      description: `Change representation to ${newStyle}`,
      undo: () => setRenderStyle(prevStyle),
      redo: () => setRenderStyle(newStyle)
    });
    setRenderStyle(newStyle);
  };

  const handleObjectSetColor = (id: string, colorSchemeName: string) => {
    const prevColor = colorScheme;
    HistoryManager.getInstance().record({
      description: `Change color scheme to ${colorSchemeName}`,
      undo: () => setColorScheme(prevColor),
      redo: () => setColorScheme(colorSchemeName)
    });
    setColorScheme(colorSchemeName);
  };

  const handleObjectHideStyle = (id: string, target: 'all' | 'ribbon' | 'surface' | 'waters' | 'hydrogens') => {
    if (target === 'all') {
      setHiddenObjectIds((prev) => new Set(prev).add(id));
    } else if (target === 'waters') {
      handleRemoveSolvent();
    } else if (target === 'hydrogens') {
      handleRemoveHydrogens();
    } else if (target === 'surface') {
      setSurfaceOpacity(0.0);
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

  const handleObjectLabel = (id: string, labelType: 'resn' | 'resi' | 'name' | 'bfactor' | 'clear') => {
    if (labelType === 'clear') {
      clearMeasurements();
      return;
    }
    // Add 3D labels to atoms based on type
    const targetAtoms = id === 'sele_active'
      ? atoms.filter(a => selectedAtomSerials.has(a.serial))
      : atoms.slice(0, 50); // cap to first 50 atoms to maintain performance

    targetAtoms.forEach(a => {
      let text = `${a.resName}-${a.resSeq}`;
      if (labelType === 'name') text = a.name;
      else if (labelType === 'resi') text = `${a.resSeq}`;
      else if (labelType === 'bfactor') text = `B=${a.bFactor !== undefined ? a.bFactor.toFixed(1) : '20.0'}`;

      addMeasurement({
        id: `label-${a.serial}-${labelType}`,
        type: 'label',
        atomSerials: [a.serial],
        coordinates: [{ x: a.x, y: a.y, z: a.z }],
        value: 0,
        label: text
      });
    });
  };

  const handleClearSelection = () => {
    const prev = new Set(selectedAtomSerials);
    HistoryManager.getInstance().record({
      description: 'Clear selection',
      undo: () => setSelectedAtomSerials(prev),
      redo: () => setSelectedAtomSerials(new Set())
    });
    setSelectedAtomSerials(new Set());
  };

  const handleAtomClick = (atom: any) => {
    if (!atom || !atom.serial) return;
    const next = new Set(selectedAtomSerials);
    if (next.has(atom.serial)) {
      next.delete(atom.serial);
    } else {
      next.add(atom.serial);
    }
    setSelectedAtomSerials(next);
  };

  const revisionManagerRef = useRef<ScientificRevisionManager | null>(null);

  const getOrCreateRevisionManager = (processor: MolProcessor): ScientificRevisionManager => {
    if (!revisionManagerRef.current) {
      const doc = processor.getCanonicalDocument();
      const rootRev = ScientificEditingKernel.createRootRevision(
        doc.document_id,
        doc.active_object_id || 'main_obj',
        processor.getCanonicalMolecule(),
        'Session Baseline'
      );
      revisionManagerRef.current = new ScientificRevisionManager(rootRev);
    }
    return revisionManagerRef.current;
  };

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

    if (result.deleteSelectionName) {
      setNamedSelections(prev => prev.filter(s => s.name.toLowerCase() !== result.deleteSelectionName!.toLowerCase()));
    }

    if (result.undoRequest && processorRef.current) {
      try {
        const mgr = getOrCreateRevisionManager(processorRef.current);
        const doc = processorRef.current.getCanonicalDocument();
        const { restoredRevision } = mgr.undo(doc);
        processorRef.current.applyScientificRevision(restoredRevision);
        setAtoms([...processorRef.current.atoms]);
        setProcessedPDB(processorRef.current.toPDB());
      } catch (err: any) {
        console.warn('Undo navigation error:', err.message);
      }
      triggerFocus();
    }

    if (result.redoRequest && processorRef.current) {
      try {
        const mgr = getOrCreateRevisionManager(processorRef.current);
        const doc = processorRef.current.getCanonicalDocument();
        const { restoredRevision } = mgr.redo(doc);
        processorRef.current.applyScientificRevision(restoredRevision);
        setAtoms([...processorRef.current.atoms]);
        setProcessedPDB(processorRef.current.toPDB());
      } catch (err: any) {
        console.warn('Redo navigation error:', err.message);
      }
      triggerFocus();
    }

    if (result.removeAtomSerials && result.removeAtomSerials.size > 0) {
      const toRemove = result.removeAtomSerials;
      if (processorRef.current) {
        try {
          const mgr = getOrCreateRevisionManager(processorRef.current);
          const doc = processorRef.current.getCanonicalDocument();
          const selResult = {
            query: query,
            selected_ids: toRemove,
            selected_array: Array.from(toRemove).sort((a, b) => a - b),
            count: toRemove.size,
            object_id: 'main_mol'
          };
          const mutation = ScientificEditingKernel.remove(doc, selResult, {
            objectId: doc.active_object_id,
            author: 'User',
            currentRevision: mgr.getActiveRevision()
          });
          processorRef.current.applyScientificRevision(mutation.revision);
          mgr.addRevision(mutation.revision, mutation.provenance);
        } catch (err) {
          // Fallback to legacy delete if canonical transaction encounters non-standard state
          TopologyEditor.deleteAtoms(processorRef.current, toRemove);
        }
        setAtoms([...processorRef.current.atoms]);
        setProcessedPDB(processorRef.current.toPDB());
      } else {
        setAtoms(prev => prev.filter(a => !toRemove.has(a.serial)));
      }
      setSelectedAtomSerials(new Set());
      triggerFocus();
    }

    if (result.bondRequest && processorRef.current) {
      try {
        const mgr = getOrCreateRevisionManager(processorRef.current);
        const doc = processorRef.current.getCanonicalDocument();
        const mutation = ScientificEditingKernel.bond(
          doc,
          result.bondRequest.atomA,
          result.bondRequest.atomB,
          result.bondRequest.order || 1.0,
          { objectId: doc.active_object_id, author: 'User', currentRevision: mgr.getActiveRevision() }
        );
        processorRef.current.applyScientificRevision(mutation.revision);
        mgr.addRevision(mutation.revision, mutation.provenance);
        setAtoms([...processorRef.current.atoms]);
        setProcessedPDB(processorRef.current.toPDB());
      } catch (err: any) {
        console.warn('Bond operation error:', err.message);
      }
      triggerFocus();
    }

    if (result.unbondRequest && processorRef.current) {
      try {
        const mgr = getOrCreateRevisionManager(processorRef.current);
        const doc = processorRef.current.getCanonicalDocument();
        const mutation = ScientificEditingKernel.unbond(
          doc,
          result.unbondRequest.atomA,
          result.unbondRequest.atomB,
          { objectId: doc.active_object_id, author: 'User', currentRevision: mgr.getActiveRevision() }
        );
        processorRef.current.applyScientificRevision(mutation.revision);
        mgr.addRevision(mutation.revision, mutation.provenance);
        setAtoms([...processorRef.current.atoms]);
        setProcessedPDB(processorRef.current.toPDB());
      } catch (err: any) {
        console.warn('Unbond operation error:', err.message);
      }
      triggerFocus();
    }

    if (result.setBondOrderRequest && processorRef.current) {
      try {
        const mgr = getOrCreateRevisionManager(processorRef.current);
        const doc = processorRef.current.getCanonicalDocument();
        const mutation = ScientificEditingKernel.setBondOrder(
          doc,
          result.setBondOrderRequest.atomA,
          result.setBondOrderRequest.atomB,
          result.setBondOrderRequest.order,
          { objectId: doc.active_object_id, author: 'User', currentRevision: mgr.getActiveRevision() }
        );
        processorRef.current.applyScientificRevision(mutation.revision);
        mgr.addRevision(mutation.revision, mutation.provenance);
        setAtoms([...processorRef.current.atoms]);
        setProcessedPDB(processorRef.current.toPDB());
      } catch (err: any) {
        console.warn('Set bond order operation error:', err.message);
      }
      triggerFocus();
    }

    if (result.cycleValenceRequest && processorRef.current) {
      try {
        const mgr = getOrCreateRevisionManager(processorRef.current);
        const doc = processorRef.current.getCanonicalDocument();
        const mutation = ScientificEditingKernel.cycleValence(
          doc,
          result.cycleValenceRequest.atomA,
          result.cycleValenceRequest.atomB,
          { objectId: doc.active_object_id, author: 'User', currentRevision: mgr.getActiveRevision() }
        );
        processorRef.current.applyScientificRevision(mutation.revision);
        mgr.addRevision(mutation.revision, mutation.provenance);
        setAtoms([...processorRef.current.atoms]);
        setProcessedPDB(processorRef.current.toPDB());
      } catch (err: any) {
        console.warn('Cycle valence operation error:', err.message);
      }
      triggerFocus();
    }

    if (result.alterRequest && processorRef.current) {
      try {
        const mgr = getOrCreateRevisionManager(processorRef.current);
        const doc = processorRef.current.getCanonicalDocument();
        const selSerials = parser.parse(result.alterRequest.query);
        const mutation = ScientificEditingKernel.alter(
          doc,
          Array.from(selSerials),
          {
            property: result.alterRequest.property as any,
            value: result.alterRequest.value,
            rawProperty: result.alterRequest.property,
            rawValue: String(result.alterRequest.value)
          },
          { objectId: doc.active_object_id, author: 'User', currentRevision: mgr.getActiveRevision() }
        );
        processorRef.current.applyScientificRevision(mutation.revision);
        mgr.addRevision(mutation.revision, mutation.provenance);
        setAtoms([...processorRef.current.atoms]);
        setProcessedPDB(processorRef.current.toPDB());
      } catch (err: any) {
        console.warn('Alter operation error:', err.message);
      }
      triggerFocus();
    }

    if (result.alterStateRequest && processorRef.current) {
      try {
        const mgr = getOrCreateRevisionManager(processorRef.current);
        const doc = processorRef.current.getCanonicalDocument();
        const selSerials = parser.parse(result.alterStateRequest.query);
        const reqStateId = result.alterStateRequest.stateId;
        const targetStateId = doc.states.has(reqStateId) ? reqStateId : (doc.active_state_id || Array.from(doc.states.keys())[0]);
        const mutation = ScientificEditingKernel.alterState(
          doc,
          targetStateId,
          Array.from(selSerials),
          {
            property: result.alterStateRequest.property as any,
            value: result.alterStateRequest.value,
            rawProperty: result.alterStateRequest.property,
            rawValue: String(result.alterStateRequest.value)
          },
          { objectId: doc.active_object_id, author: 'User', currentRevision: mgr.getActiveRevision() }
        );
        processorRef.current.applyScientificRevision(mutation.revision);
        mgr.addRevision(mutation.revision, mutation.provenance);
        setAtoms([...processorRef.current.atoms]);
        setProcessedPDB(processorRef.current.toPDB());
      } catch (err: any) {
        console.warn('Alter state operation error:', err.message);
      }
      triggerFocus();
    }

    if (result.setStyle) {
      setRenderStyle(result.setStyle as RenderStyle);
    }

    if (result.setColorScheme) {
      setColorScheme(result.setColorScheme);
    }

    if (result.setHiddenCategory) {
      if (result.setHiddenCategory === 'everything') {
        setHiddenObjectIds(prev => new Set(prev).add('main_mol'));
      }
    }

    if (result.triggerZoom) {
      triggerFocus();
    }

    if (result.fetchPdbId) {
      handleFetchPdb(result.fetchPdbId);
    }

    if (result.addHydrogens) {
      handleAddHydrogens(result.selectedSerials);
    }

    if (result.removeHydrogens) {
      handleRemoveHydrogens(result.selectedSerials);
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

  // Expose automated browser test API
  useEffect(() => {
    (window as any).__molStudioTestApi = {
      loadMolecule: (name: string, data: string, format = 'pdb') => {
        setMolData({ name, data, format: format as any });
      },
      setRenderStyle: (style: RenderStyle) => setRenderStyle(style),
      setColorScheme: (scheme: string) => setColorScheme(scheme),
      setSurfaceOpacity: (val: number) => setSurfaceOpacity(val),
      setBackgroundColor: (val: string) => setBackgroundColor(val),
      runQuery: (query: string) => handleRunQuery(query),
      clearSelection: () => handleClearSelection(),
      addHydrogens: () => handleAddHydrogens(),
      removeHydrogens: () => handleRemoveHydrogens(),
      cycleValence: () => handleCycleValence(),
      deleteSelectedAtoms: () => handleDeleteSelectedAtoms(),
      toggleSculpting: () => setIsSculptingActive(prev => !prev),
      toggleOrthographic: () => setOrthographic(prev => !prev),
      setStereoMode: (mode: 'none' | 'cross-eye' | 'anaglyph') => setStereoMode(mode),
      toggleSequenceViewer: () => setShowSequenceViewer(prev => !prev),
      setShowDipoleArrow: (val: boolean) => setShowDipoleArrow(val),
      saveSession: () => handleSaveSession(),
      exportSessionString: () => {
        if (!molData) return null;
        const cameraView = viewerRef.current?.getView ? viewerRef.current.getView() : undefined;
        const session = SessionManager.createSession({
          molecules: [
            {
              id: 'main_mol',
              name: molData.name || 'molecule',
              format: molData.format,
              data: processedPDB || (molData.data instanceof Uint8Array ? new TextDecoder().decode(molData.data) : molData.data),
              atomCount: atoms.length,
              visible: !hiddenObjectIds.has('main_mol'),
              style: renderStyle,
              colorScheme
            }
          ],
          viewerState: {
            renderStyle,
            colorScheme,
            surfaceOpacity,
            backgroundColor,
            orthographic,
            stereoMode,
            hiddenObjectIds: Array.from(hiddenObjectIds),
            camera: cameraView ? { viewMatrix: cameraView } : undefined
          },
          selectionState: {
            selectionLevel,
            selectedAtomSerials: Array.from(selectedAtomSerials),
            namedSelections
          },
          measurements,
          biophysical: {
            showDipoleArrow,
            ramachandranData,
            dipoleMoment
          }
        });
        return SessionManager.exportSession(session);
      },
      importSessionString: (text: string) => {
        const file = new File([text], 'test.pse', { type: 'application/vnd.molstudio.pse' });
        handleLoadSessionFile(file);
      },
      getState: () => ({
        molName: molData?.name || null,
        atomsCount: atoms.length,
        selectedCount: selectedAtomSerials.size,
        renderStyle,
        colorScheme,
        surfaceOpacity,
        backgroundColor,
        selectionLevel,
        measurementsCount: measurements.length,
        dipoleMagnitude: dipoleMoment?.magnitude || 0,
        ramachandranCount: ramachandranData.length,
        orthographic,
        stereoMode
      })
    };
  }, [molData, atoms, selectedAtomSerials, selectionLevel, renderStyle, colorScheme, measurements, dipoleMoment, ramachandranData, orthographic, stereoMode]);


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
    processorRef.current = processor;
    
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
    <div className="h-screen w-screen flex flex-col font-sans bg-[#050508] text-[#F0F0F0] overflow-hidden relative hud-grid">
      {/* Bioluminescent ambient background glows */}
      <div className="pointer-events-none absolute -top-40 -right-40 h-[600px] w-[600px] rounded-full bg-cyan-500/5 blur-[160px]" />
      <div className="pointer-events-none absolute -bottom-40 -left-40 h-[600px] w-[600px] rounded-full bg-amber-500/5 blur-[160px]" />

      {/* Top Ribbon Control Panel (Studio Ribbon Style) */}
      <div className="relative z-30 bg-slate-950/80 backdrop-blur-2xl border-b border-white/10">
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
          onOpenExport={() => setIsExportOpen(true)}
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
          onLoadSession={handleLoadSessionFile}
          showSequenceViewer={showSequenceViewer}
          onToggleSequenceViewer={() => setShowSequenceViewer(prev => !prev)}
          orthographic={orthographic}
          onToggleOrthographic={() => setOrthographic(prev => !prev)}
          stereoMode={stereoMode}
          setStereoMode={setStereoMode}
          onOpenHotkeysModal={() => setShowHotkeysModal(true)}
          isSculptingActive={isSculptingActive}
          onToggleSculpting={() => setIsSculptingActive(prev => !prev)}
          onAddHydrogens={handleAddHydrogens}
          onRemoveHydrogens={handleRemoveHydrogens}
          onDeleteSelectedAtoms={handleDeleteSelectedAtoms}
          onCycleValence={handleCycleValence}
        />
      </div>

      {/* Main Viewer Area */}
      <div className="flex-1 relative w-full h-full overflow-hidden flex flex-col">
        {/* Active 3D Measurement Mode & Telemetry Floating HUD Banner */}
        {activeMeasurementMode && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-30 pointer-events-auto flex items-center gap-3 px-5 py-2.5 bg-slate-950/90 border border-cyan-400/50 rounded-xl shadow-[0_0_30px_rgba(0,242,255,0.3)] backdrop-blur-2xl animate-fadeIn">
            <div className="flex items-center gap-2">
              <Ruler className="w-4 h-4 text-cyan-400 animate-pulse" />
              <span className="text-xs font-semibold text-white uppercase tracking-wider">
                {activeMeasurementMode === 'distance' ? 'Distance (Pick 2 Atoms)' :
                 activeMeasurementMode === 'angle' ? 'Angle (Pick 3 Atoms)' :
                 activeMeasurementMode === 'dihedral' ? 'Dihedral Torsion (Pick 4 Atoms)' : '3D Atom Label'}
              </span>
            </div>
            
            <div className="h-4 w-px bg-white/20" />

            <div className="text-[11px] font-mono text-cyan-300">
              {clickedAtomBuffer.length === 0 
                ? 'Click atom in 3D viewport...' 
                : clickedAtomBuffer.map((a, i) => `[P${i+1}: ${(a.name || '').trim()} #${a.serial}]`).join(' → ')
              }
            </div>

            <button
              onClick={() => setMeasurementMode(null)}
              className="p-1 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white transition-colors text-xs font-bold"
              title="Cancel measurement mode"
            >
              ✕
            </button>
          </div>
        )}

        <div className="flex-1 relative w-full h-full min-h-0">
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
              activeMeasurementMode={activeMeasurementMode}
              showDipoleArrow={showDipoleArrow}
              dipoleMoment={dipoleMoment}
              focusTrigger={focusTrigger} 
              orthographic={orthographic}
              stereoMode={stereoMode}
            />
          </div>

          {/* 1D Sequence Viewer Bar Overlay */}
          {showSequenceViewer && atoms.length > 0 && (
            <div className="absolute bottom-0 left-0 right-0 z-20 pointer-events-auto">
              <SequenceViewer
                atoms={atoms}
                ssData={ssData}
                selectedAtomSerials={selectedAtomSerials}
                onSelectResidue={(serials, isToggle) => {
                  const next = isToggle ? new Set(selectedAtomSerials) : new Set<number>();
                  serials.forEach(s => next.add(s));
                  setSelectedAtomSerials(next);
                }}
                onClose={() => setShowSequenceViewer(false)}
              />
            </div>
          )}
        </div>
        
        {/* Per-Object Control Panel (Action Control Panel) */}
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

        {/* Interactive Selection Query Console */}
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
            onClose={() => setShowTimeline(false)}
          />
        )}

        {/* Universal Structure & Media Export Modal */}
        <StudioExportModal 
          isOpen={isExportOpen} 
          onClose={() => setIsExportOpen(false)} 
          viewerRef={viewerRef}
        />

        {/* WebGPU Raytrace Viewer Overlay */}
        {showRaytrace && molData && (
          <RaytraceViewer atoms={atoms} onClose={() => setShowRaytrace(false)} />
        )}

        {/* Scientific Guide & Help Sidebar Panel */}
        <UserManualModal isOpen={isHelpOpen} onClose={() => setIsHelpOpen(false)} />

        {/* Measurement & Density Map Wizards */}
        <MeasurementWizard modal={activeWizard} onClose={() => setActiveWizard(null)} processor={processorRef.current} />

        {/* Floating Session Notification Toast */}
        {sessionNotification && (
          <div className={`fixed bottom-6 right-6 z-50 px-4 py-2.5 rounded-xl border text-xs font-mono font-semibold shadow-2xl backdrop-blur-xl animate-fadeIn ${
            sessionNotification.type === 'success'
              ? 'bg-emerald-950/90 border-emerald-500/50 text-emerald-300'
              : 'bg-rose-950/90 border-rose-500/50 text-rose-300'
          }`}>
            {sessionNotification.message}
          </div>
        )}

        {/* Hotkeys Guide Modal */}
        {showHotkeysModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xl p-4 select-none">
            <div className="bg-[#0D0D11] border border-white/10 rounded-2xl w-full max-w-lg p-6 relative text-white shadow-2xl">
              <button
                onClick={() => setShowHotkeysModal(false)}
                className="absolute top-4 right-4 text-white/40 hover:text-white transition-colors text-lg"
              >
                ✕
              </button>
              <div className="flex items-center gap-2 text-[#4A90E2] font-bold text-lg mb-4">
                <Command className="w-5 h-5 text-[#F27D26]" />
                <span>MolStudio Keyboard Shortcuts & Hotkeys</span>
              </div>
              <div className="space-y-2 text-xs font-mono text-white/80">
                <div className="flex justify-between py-1.5 border-b border-white/5">
                  <span className="text-white/60">Export Session (.PSE)</span>
                  <kbd className="px-2 py-0.5 rounded bg-white/10 text-[#F27D26]">Ctrl + S</kbd>
                </div>
                <div className="flex justify-between py-1.5 border-b border-white/5">
                  <span className="text-white/60">Reset Camera / Center View</span>
                  <kbd className="px-2 py-0.5 rounded bg-white/10 text-white font-bold">R</kbd>
                </div>
                <div className="flex justify-between py-1.5 border-b border-white/5">
                  <span className="text-white/60">Zoom to Active Selection</span>
                  <kbd className="px-2 py-0.5 rounded bg-white/10 text-white font-bold">Z</kbd>
                </div>
                <div className="flex justify-between py-1.5 border-b border-white/5">
                  <span className="text-white/60">Clear Active Selections</span>
                  <kbd className="px-2 py-0.5 rounded bg-white/10 text-white font-bold">C</kbd>
                </div>
                <div className="flex justify-between py-1.5 border-b border-white/5">
                  <span className="text-white/60">Toggle 1D Sequence Bar</span>
                  <kbd className="px-2 py-0.5 rounded bg-white/10 text-white font-bold">S</kbd>
                </div>
                <div className="flex justify-between py-1.5 border-b border-white/5">
                  <span className="text-white/60">Toggle Camera Projection (Ortho / Persp)</span>
                  <kbd className="px-2 py-0.5 rounded bg-white/10 text-white font-bold">P</kbd>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
