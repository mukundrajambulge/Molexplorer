import React, { useState } from "react";
import { Download, Image as ImageIcon, FileText, Database, FileCode, X, File } from "lucide-react";
import { MoleculeData, ViewState } from "../types";
import { getRDKit } from "../lib/rdkit";
import { jsPDF } from "jspdf";

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  molecule: MoleculeData | null;
  viewerRef: React.MutableRefObject<any>;
}

export const ExportModal: React.FC<ExportModalProps> = ({ isOpen, onClose, molecule, viewerRef }) => {
  const [isExporting, setIsExporting] = useState(false);
  const [isRecording, setIsRecording] = useState(false);

  if (!isOpen) return null;

  const downloadFile = (content: string, filename: string, type: string) => {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleRecordWebM = () => {
    if (!viewerRef.current) return;
    const viewer = viewerRef.current.getViewer();
    if (!viewer) return;
    
    // Check if browser supports captureStream
    const canvas = viewer.renderer.domElement;
    if (!canvas.captureStream) {
      alert("Video recording is not supported in this browser.");
      return;
    }

    setIsRecording(true);
    
    // Start spinning if not already
    const wasSpinning = viewerRef.current?.isSpinning; // we might not have access to this state directly from here, so we just spin
    viewer.spin("y", 1);
    viewer.render();

    const stream = canvas.captureStream(30); // 30 fps
    const recorder = new MediaRecorder(stream, { mimeType: 'video/webm' });
    const chunks: BlobPart[] = [];

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunks.push(e.data);
    };

    recorder.onstop = () => {
      const blob = new Blob(chunks, { type: 'video/webm' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${molecule?.name || 'molecule'}-animation.webm`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      // Stop spinning
      viewer.spin(false);
      viewer.render();
      setIsRecording(false);
    };

    recorder.start();
    
    // Record for 4 seconds to get a good spin
    setTimeout(() => {
      recorder.stop();
    }, 4000);
  };

  const downloadDataURI = (dataURI: string, filename: string) => {
    const a = document.createElement("a");
    a.href = dataURI;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleExportPNG = () => {
    if (!viewerRef.current) return;
    const viewer = viewerRef.current.getViewer();
    if (!viewer) return;
    const uri = viewer.pngURI();
    if (uri) {
      downloadDataURI(uri, `${molecule?.name || 'molecule'}-3d.png`);
    }
  };

  const handleExportHighResPNG = () => {
    if (!viewerRef.current) return;
    const viewer = viewerRef.current.getViewer();
    if (!viewer) return;
    const uri = viewer.pngURI();
    if (uri) {
      downloadDataURI(uri, `${molecule?.name || 'molecule'}-3d-highres.png`);
    }
  };

  const handleExportSVG = async () => {
    if (!molecule) return;
    setIsExporting(true);
    try {
      const rdkit = await getRDKit();
      const mol = rdkit.get_mol(molecule.rawContent || molecule.smiles);
      if (mol) {
        const svg = mol.get_svg();
        downloadFile(svg, `${molecule.name || 'molecule'}-2d.svg`, 'image/svg+xml');
        mol.delete();
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportStructure = async (format: "sdf" | "mol" | "pdb" | "xyz" | "smiles" | "json") => {
    if (!molecule) return;
    setIsExporting(true);
    try {
      const rdkit = await getRDKit();
      const mol = rdkit.get_mol(molecule.rawContent || molecule.smiles);
      
      if (format === "smiles" && mol) {
        downloadFile(mol.get_smiles(), `${molecule.name || 'molecule'}.smi`, 'chemical/x-daylight-smiles');
        mol.delete();
        return setIsExporting(false);
      } else if (format === "json" && mol) {
        downloadFile(mol.get_json(), `${molecule.name || 'molecule'}.json`, 'application/json');
        mol.delete();
        return setIsExporting(false);
      } else if ((format === "sdf" || format === "mol") && mol) {
        downloadFile(mol.get_molblock(), `${molecule.name || 'molecule'}.${format}`, 'chemical/x-mdl-sdfile');
        mol.delete();
        return setIsExporting(false);
      }
      
      // For PDB and XYZ, we can try using the Cactus API via SMILES if RDKit doesn't have native exporters
      let smiles = molecule.smiles;
      if (mol && !smiles) {
        smiles = mol.get_smiles();
        mol.delete();
      } else if (mol) {
        mol.delete();
      }

      if (smiles && (format === "pdb" || format === "xyz")) {
        const res = await fetch(`https://cactus.nci.nih.gov/chemical/structure/${encodeURIComponent(smiles)}/file?format=${format}&get3d=true`);
        if (res.ok) {
          const text = await res.text();
          downloadFile(text, `${molecule.name || 'molecule'}.${format}`, 'text/plain');
        } else {
          alert(`Failed to convert to ${format.toUpperCase()}`);
        }
      } else if (format === "sdf" || format === "mol") {
        const contentStr = typeof molecule.rawContent === "string" ? molecule.rawContent : new TextDecoder().decode(molecule.rawContent);
        downloadFile(contentStr, `${molecule.name || 'molecule'}.${format}`, 'chemical/x-mdl-sdfile');
      }
      
    } catch (e) {
      console.error(e);
      alert("Error exporting structure");
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportCSV = async () => {
    if (!molecule) return;
    setIsExporting(true);
    try {
      const rdkit = await getRDKit();
      const mol = rdkit.get_mol(molecule.rawContent || molecule.smiles);
      if (mol) {
        const descriptors = JSON.parse(mol.get_descriptors());
        const headers = Object.keys(descriptors).join(",");
        const values = Object.values(descriptors).join(",");
        const csv = `${headers}\n${values}`;
        downloadFile(csv, `${molecule.name || 'molecule'}-descriptors.csv`, 'text/csv');
        mol.delete();
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportPDF = async () => {
    if (!molecule || !viewerRef.current) return;
    setIsExporting(true);
    try {
      const viewer = viewerRef.current.getViewer();
      const pngUri = viewer ? viewer.pngURI() : null;
      
      const rdkit = await getRDKit();
      const mol = rdkit.get_mol(molecule.rawContent || molecule.smiles);
      let descriptors: any = {};
      if (mol) {
        descriptors = JSON.parse(mol.get_descriptors());
        mol.delete();
      }

      const doc = new jsPDF();
      
      // Title
      doc.setFont("helvetica", "bold");
      doc.setFontSize(22);
      doc.text("MolExplorer Screening Report", 20, 20);
      
      doc.setFontSize(14);
      doc.setFont("helvetica", "normal");
      doc.text(`Molecule: ${molecule.name}`, 20, 30);
      
      // 3D Image
      if (pngUri) {
        doc.addImage(pngUri, 'PNG', 20, 40, 100, 100);
      }

      // Descriptors
      doc.setFontSize(16);
      doc.setFont("helvetica", "bold");
      doc.text("Computed Descriptors & Lipinski Rules", 20, 150);
      
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      
      let y = 160;
      const keyDescriptors = ["amw", "NumHDonors", "NumHAcceptors", "CrippenClogP", "tpsa", "NumRotatableBonds"];
      const displayNames: Record<string, string> = {
        amw: "Molecular Weight (MW)",
        NumHDonors: "H-Bond Donors",
        NumHAcceptors: "H-Bond Acceptors",
        CrippenClogP: "cLogP",
        tpsa: "Topological Polar Surface Area (TPSA)",
        NumRotatableBonds: "Rotatable Bonds"
      };

      keyDescriptors.forEach((key) => {
        if (descriptors[key] !== undefined) {
          doc.text(`${displayNames[key] || key}: ${Number(descriptors[key]).toFixed(2)}`, 20, y);
          y += 8;
        }
      });
      
      // Rule of 5 evaluation
      let ro5Violations = 0;
      if (descriptors.amw > 500) ro5Violations++;
      if (descriptors.CrippenClogP > 5) ro5Violations++;
      if (descriptors.NumHDonors > 5) ro5Violations++;
      if (descriptors.NumHAcceptors > 10) ro5Violations++;

      y += 5;
      doc.setFont("helvetica", "bold");
      doc.text(`Lipinski Rule of 5 Violations: ${ro5Violations}`, 20, y);
      
      y += 15;
      doc.setFontSize(16);
      doc.text("All Descriptors", 20, y);
      y += 10;
      
      doc.setFontSize(8);
      doc.setFont("helvetica", "normal");
      let col = 20;
      Object.entries(descriptors).forEach(([key, value], idx) => {
        if (y > 280) {
          doc.addPage();
          y = 20;
          col = 20;
        }
        doc.text(`${key}: ${Number(value).toFixed(3)}`, col, y);
        y += 6;
        if (idx > 0 && idx % 20 === 0 && col === 20) {
          col = 100;
          y -= (20 * 6) + 6;
        } else if (idx > 0 && idx % 20 === 0 && col === 100) {
          col = 20;
        }
      });

      doc.save(`${molecule.name || 'molecule'}-report.pdf`);
    } catch (e) {
      console.error(e);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-[#0A0A0A] border border-white/10 p-6 rounded-2xl shadow-2xl w-full max-w-2xl font-mono text-[11px] uppercase tracking-widest text-white">
        <div className="flex items-center justify-between mb-8 border-b border-white/10 pb-4">
          <h2 className="text-[#F27D26] text-sm">Export Options</h2>
          <button onClick={onClose} className="opacity-50 hover:opacity-100 hover:text-[#F27D26] transition-colors p-2">
            <X size={16} />
          </button>
        </div>

        {!molecule ? (
          <div className="text-center opacity-50 py-12">
            No molecule loaded. Import a molecule first to export.
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-8">
            {/* Images */}
            <div>
              <h3 className="opacity-50 mb-4 border-b border-white/5 pb-2">Images & Rendering</h3>
              <div className="flex flex-col gap-3">
                <button onClick={handleExportPNG} className="flex items-center gap-3 px-4 py-3 bg-white/[0.03] hover:bg-white/[0.08] border border-white/10 hover:border-[#F27D26]/50 rounded-xl transition-all text-left">
                  <ImageIcon size={14} className="text-[#F27D26]" />
                  <div>
                    <div className="text-white">Screenshot (PNG)</div>
                    <div className="text-[9px] opacity-40 normal-case tracking-normal">Current 3D Viewport</div>
                  </div>
                </button>
                <button onClick={handleExportHighResPNG} className="flex items-center gap-3 px-4 py-3 bg-white/[0.03] hover:bg-white/[0.08] border border-white/10 hover:border-[#F27D26]/50 rounded-xl transition-all text-left">
                  <ImageIcon size={14} className="text-[#F27D26]" />
                  <div>
                    <div className="text-white">High-Res Image (PNG)</div>
                    <div className="text-[9px] opacity-40 normal-case tracking-normal">Poster Quality</div>
                  </div>
                </button>
                <button onClick={handleExportSVG} className="flex items-center gap-3 px-4 py-3 bg-white/[0.03] hover:bg-white/[0.08] border border-white/10 hover:border-[#F27D26]/50 rounded-xl transition-all text-left">
                  <ImageIcon size={14} className="text-[#F27D26]" />
                  <div>
                    <div className="text-white">2D Structure (SVG)</div>
                    <div className="text-[9px] opacity-40 normal-case tracking-normal">Vector Publication Quality</div>
                  </div>
                </button>
                <button 
                  onClick={handleRecordWebM} 
                  disabled={isRecording}
                  className={`flex items-center gap-3 px-4 py-3 bg-white/[0.03] border rounded-xl transition-all text-left ${isRecording ? 'border-[#F27D26] animate-pulse' : 'hover:bg-white/[0.08] border-white/10 hover:border-[#F27D26]/50'}`}
                >
                  <ImageIcon size={14} className="text-[#F27D26]" />
                  <div>
                    <div className="text-white">{isRecording ? "Recording..." : "Animated Spin (WebM)"}</div>
                    <div className="text-[9px] opacity-40 normal-case tracking-normal">4-second rotating video</div>
                  </div>
                </button>
              </div>
            </div>

            {/* Data & Structure */}
            <div>
              <h3 className="opacity-50 mb-4 border-b border-white/5 pb-2">Structure & Data</h3>
              <div className="flex flex-col gap-3">
                <button onClick={() => handleExportStructure("sdf")} className="flex items-center gap-3 px-4 py-3 bg-white/[0.03] hover:bg-white/[0.08] border border-white/10 hover:border-[#F27D26]/50 rounded-xl transition-all text-left">
                  <FileCode size={14} className="text-[#3050F8]" />
                  <div>
                    <div className="text-white">SDF / MOL Export</div>
                    <div className="text-[9px] opacity-40 normal-case tracking-normal">Standard 3D Coordinates</div>
                  </div>
                </button>
                <button onClick={() => handleExportStructure("pdb")} className="flex items-center gap-3 px-4 py-3 bg-white/[0.03] hover:bg-white/[0.08] border border-white/10 hover:border-[#F27D26]/50 rounded-xl transition-all text-left">
                  <FileCode size={14} className="text-[#3050F8]" />
                  <div>
                    <div className="text-white">PDB Export</div>
                    <div className="text-[9px] opacity-40 normal-case tracking-normal">Protein Data Bank Format</div>
                  </div>
                </button>
                <button onClick={() => handleExportStructure("xyz")} className="flex items-center gap-3 px-4 py-3 bg-white/[0.03] hover:bg-white/[0.08] border border-white/10 hover:border-[#F27D26]/50 rounded-xl transition-all text-left">
                  <FileCode size={14} className="text-[#3050F8]" />
                  <div>
                    <div className="text-white">XYZ Export</div>
                    <div className="text-[9px] opacity-40 normal-case tracking-normal">Cartesian Coordinates</div>
                  </div>
                </button>
                {(molecule.format === 'pdbqt' || molecule.format === 'mol2' || molecule.format === 'cif') && (
                  <button onClick={() => {
                    const contentStr = typeof molecule.rawContent === "string" ? molecule.rawContent : new TextDecoder().decode(molecule.rawContent);
                    downloadFile(contentStr, `${molecule.name || 'molecule'}.${molecule.format}`, 'text/plain');
                  }} className="flex items-center gap-3 px-4 py-3 bg-white/[0.03] hover:bg-white/[0.08] border border-white/10 hover:border-[#F27D26]/50 rounded-xl transition-all text-left">
                    <FileCode size={14} className="text-[#3050F8]" />
                    <div>
                      <div className="text-white">Original {molecule.format.toUpperCase()}</div>
                      <div className="text-[9px] opacity-40 normal-case tracking-normal">Source Format</div>
                    </div>
                  </button>
                )}
                <button onClick={() => handleExportStructure("smiles")} className="flex items-center gap-3 px-4 py-3 bg-white/[0.03] hover:bg-white/[0.08] border border-white/10 hover:border-[#F27D26]/50 rounded-xl transition-all text-left">
                  <FileCode size={14} className="text-[#3050F8]" />
                  <div>
                    <div className="text-white">SMILES String</div>
                    <div className="text-[9px] opacity-40 normal-case tracking-normal">1D Notation</div>
                  </div>
                </button>
                <button onClick={handleExportCSV} className="flex items-center gap-3 px-4 py-3 bg-white/[0.03] hover:bg-white/[0.08] border border-white/10 hover:border-[#F27D26]/50 rounded-xl transition-all text-left">
                  <Database size={14} className="text-[#1FF01F]" />
                  <div>
                    <div className="text-white">Descriptors (CSV)</div>
                    <div className="text-[9px] opacity-40 normal-case tracking-normal">Tabular Data</div>
                  </div>
                </button>
              </div>
            </div>
            
            {/* Reports */}
            <div className="col-span-2 mt-4">
              <h3 className="opacity-50 mb-4 border-b border-white/5 pb-2">Reports</h3>
              <button onClick={handleExportPDF} className="w-full flex items-center justify-center gap-3 px-4 py-4 bg-[#F27D26]/10 hover:bg-[#F27D26]/20 border border-[#F27D26]/30 hover:border-[#F27D26] rounded-xl transition-all text-center">
                <FileText size={16} className="text-[#F27D26]" />
                <div>
                  <div className="text-white">Combined PDF Screening Report</div>
                  <div className="text-[9px] opacity-60 normal-case tracking-normal mt-1">Includes 3D screenshot, Descriptors, and Lipinski evaluation</div>
                </div>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
