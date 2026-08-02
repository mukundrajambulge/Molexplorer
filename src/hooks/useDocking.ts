import { useState } from 'react';
import { convertToPDBQT, runWebina } from '../lib/Docking';
import { MolProcessor } from '../lib/MolProcessor';

export function useDocking(molData: any, atoms: any[], selectedAtomSerials: Set<number>) {
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
    
    let maxDistX = 0, maxDistY = 0, maxDistZ = 0;
    selectedAtoms.forEach(a => {
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
      const ligAtoms = ligands[0];
      let cx = 0, cy = 0, cz = 0;
      ligAtoms.forEach((a: any) => { cx += a.x; cy += a.y; cz += a.z; });
      cx /= ligAtoms.length;
      cy /= ligAtoms.length;
      cz /= ligAtoms.length;
      
      let maxDistX = 0, maxDistY = 0, maxDistZ = 0;
      ligAtoms.forEach((a: any) => {
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
        p.addHydrogens();
        setDockingLog(l => [...l, "Added hydrogens."]);
      }
      if (dockingPrep.assignGasteiger) {
        setDockingLog(l => [...l, "Gasteiger charges will be assigned by Open Babel."]);
      }

      const preppedPDB = p.toPDB();
      const receptorPDBQT = await convertToPDBQT(preppedPDB, 'pdb', true, false);
      setDockingLog(l => [...l, "Converting ligand to PDBQT..."]);
      const ligandPDBQT = await convertToPDBQT(ligandData.data, ligandData.format, false, true);

      setDockingInputPdbqt(ligandPDBQT);
      setDockingReceptorPdbqt(receptorPDBQT);
      setRedockRmsd(null);

      setDockingLog(l => [...l, "Running Webina (this may take several seconds to minutes)..."]);
      const resultPdbqt = await runWebina(
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
      
      setDockingResultPdbqt(resultPdbqt);
      setDockingLog(l => [...l, "Docking finished!"]);
    } catch (e: any) {
      console.error(e);
      setDockingLog(l => [...l, `Error: ${e.message}`]);
    } finally {
      setIsDocking(false);
    }
  };

  const handleCancelDocking = () => {
    // If Webina is running in web worker, we would terminate it here
    // Currently, we just reset the UI state
    setIsDocking(false);
    setDockingLog(l => [...l, "Docking cancelled by user."]);
  };

  return {
    ligandData, setLigandData,
    dockingBox, setDockingBox,
    isDocking, setIsDocking,
    dockingLog, setDockingLog,
    dockingResultPdbqt, setDockingResultPdbqt,
    exhaustiveness, setExhaustiveness,
    dockingInputPdbqt, setDockingInputPdbqt,
    dockingReceptorPdbqt, setDockingReceptorPdbqt,
    interactions, setInteractions,
    redockRmsd, setRedockRmsd,
    showDockingBox, setShowDockingBox,
    gridBoxThickness, setGridBoxThickness,
    gridBoxOpacity, setGridBoxOpacity,
    dockingPrep, setDockingPrep,
    handleLigandUpload,
    handleSetBoxFromSelection,
    handleAutoSuggestBox,
    handleRunDocking,
    handleCancelDocking
  };
}
