import { useState } from 'react';
import { alignStructures, AlignmentResult } from '../lib/Alignment';
import { MolProcessor } from '../lib/MolProcessor';

export function useAlignment(molData: any) {
  const [alignMol, setAlignMol] = useState<{data: string | Uint8Array, format: 'pdb' | 'mmtf', name?: string} | null>(null);
  const [alignmentResult, setAlignmentResult] = useState<AlignmentResult | null>(null);
  const [alignError, setAlignError] = useState("");
  const [alignFetchId, setAlignFetchId] = useState("");
  const [isAlignFetching, setIsAlignFetching] = useState(false);

  const handleAlignFetch = async (targetId?: string) => {
    const idToFetch = targetId || alignFetchId;
    if (!idToFetch) return;
    setIsAlignFetching(true);
    setAlignError("");
    setAlignmentResult(null);
    try {
      const pdbId = idToFetch.trim().toLowerCase();
      if (targetId) {
        setAlignFetchId(targetId);
      }
      let res = await fetch(`https://models.rcsb.org/${pdbId}.bcif`);
      if (res.ok) {
        throw new Error("BCIF not supported for alignment yet");
      }
      res = await fetch(`https://files.rcsb.org/download/${pdbId}.mmtf`);
      if (res.ok) {
        const buffer = await res.arrayBuffer();
        setAlignMol({ data: new Uint8Array(buffer), format: 'mmtf' });
        runAlignment({ data: new Uint8Array(buffer), format: 'mmtf' });
        return;
      }
      res = await fetch(`https://files.rcsb.org/download/${pdbId}.pdb`);
      if (res.ok) {
        const text = await res.text();
        setAlignMol({ data: text, format: 'pdb' });
        runAlignment({ data: text, format: 'pdb' });
        return;
      }
      throw new Error("Could not find MMTF or PDB format for " + pdbId);
    } catch (err: any) {
      setAlignError(err.message);
    } finally {
      setIsAlignFetching(false);
    }
  };

  const handleAlignFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setAlignError("");
    setAlignmentResult(null);
    const reader = new FileReader();
    const isMmtf = file.name.toLowerCase().endsWith('.mmtf');
    
    if (isMmtf) {
      reader.onload = (e) => {
        const res = e.target?.result as ArrayBuffer;
        const newMol = { data: new Uint8Array(res), format: 'mmtf' as const, name: file.name };
        setAlignMol(newMol);
        runAlignment(newMol);
      };
      reader.readAsArrayBuffer(file);
    } else {
      reader.onload = (e) => {
        const res = e.target?.result as string;
        const newMol = { data: res, format: 'pdb' as const, name: file.name };
        setAlignMol(newMol);
        runAlignment(newMol);
      };
      reader.readAsText(file);
    }
    e.target.value = '';
  };

  const runAlignment = (targetMol: {data: string | Uint8Array, format: 'pdb' | 'mmtf'}) => {
    if (!molData) {
      setAlignError("No reference molecule loaded");
      return;
    }
    try {
      const refProc = new MolProcessor(molData.data, molData.format);
      const targetProc = new MolProcessor(targetMol.data, targetMol.format);
      const result = alignStructures(refProc.atoms, targetProc.atoms);
      setAlignmentResult(result);
    } catch (e: any) {
      setAlignError("Alignment failed: " + e.message);
    }
  };

  return {
    alignMol, setAlignMol,
    alignmentResult, setAlignmentResult,
    alignError, setAlignError,
    alignFetchId, setAlignFetchId,
    isAlignFetching, setIsAlignFetching,
    handleAlignFetch,
    handleAlignFileUpload,
    runAlignment
  };
}
