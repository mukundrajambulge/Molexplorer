import React, { useState } from "react";
import { X, Search, BookOpen, Calculator, HelpCircle, FileText, ExternalLink } from "lucide-react";

interface HelpPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export const HelpPanel: React.FC<HelpPanelProps> = ({ isOpen, onClose }) => {
  const [searchQuery, setSearchQuery] = useState("");

  if (!isOpen) return null;

  const topics = [
    {
      id: "dssp",
      title: "DSSP Secondary Structure",
      category: "Physics & Chemistry",
      description: "How secondary structures (α-helices and β-sheets) are calculated using electrostatic hydrogen-bond energy.",
      equation: "E = 0.084 * 332 * (1/r_ON + 1/r_CH - 1/r_OH - 1/r_CN) kcal/mol",
      explanation: "A hydrogen bond is assigned if the electrostatic interaction energy (E) between the C=O of residue i and the N-H of residue j is less than -0.5 kcal/mol. The constants correspond to partial charges on N, H (q1 = +0.20e) and C, O (q2 = -0.42e).",
      example: "Helix: i → i+4 hydrogen bonds; Sheet: parallel or antiparallel adjacent strand patterns.",
      expected: "Helices appear red (Standard) or magenta (Jmol); sheets appear yellow; loops appear green or white.",
      citation: "Kabsch, W., & Sander, C. (1983). Dictionary of protein secondary structure: pattern recognition of hydrogen-bonded and geometrical features. Biopolymers, 22(12), 2577-2637.",
      doi: "10.1002/bip.360221211"
    },
    {
      id: "dipole",
      title: "Molecular Dipole Moment",
      category: "Biophysics",
      description: "Determining the net electrical polarity of the macromolecule.",
      equation: "μ = Σ q_i * r_i Debye",
      explanation: "Using Gasteiger-Marsili partial charge approximations assigned to each atom coordinate, the dipole moment vector is calculated from the molecular center of mass. Magnitude is reported in Debyes (D).",
      example: "Visualized as a cyan 3D vector arrow pointing from the negative charge center to the positive charge center.",
      expected: "Strong dipole vectors indicate significant charge separation across protein domains.",
      citation: "Debye, P. (1912). Einige Resultate einer kinetischen Theorie der Isolatoren. Physikalische Zeitschrift, 13, 97-100.",
      doi: ""
    },
    {
      id: "ramachandran",
      title: "Ramachandran Dihedral Angles",
      category: "Structural Biology",
      description: "Validation of peptide backbone conformations via dihedral angles.",
      equation: "φ (C-N-CA-C) and ψ (N-CA-C-N) torsion angles",
      explanation: "Calculates the backbone torsion angles around the alpha carbon. Allowed regions are defined by steric clash exclusions of sidechain atoms.",
      example: "Favored region: Alpha-helix (phi ≈ -60°, psi ≈ -45°), Beta-sheet (phi ≈ -120°, psi ≈ 130°).",
      expected: "Green dots (Favored, >98% probability), Yellow dots (Allowed, >99.9% probability), Red dots (Outliers / steric clashes).",
      citation: "Lovell, S. C., et al. (2003). Structure validation by Calpha geometry: phi,psi and Cbeta deviation. Proteins, 50(3), 437-450.",
      doi: "10.1002/prot.10286"
    },
    {
      id: "hbonds",
      title: "Hydrogen Bonds & Salt Bridges",
      category: "Chemistry",
      description: "Non-covalent polar and ionic interactions holding protein folds.",
      equation: "H-Bond: d(D...A) ≤ 3.5 Å, θ(D-H...A) ≥ 120° | Salt Bridge: d(pos...neg) ≤ 4.0 Å",
      explanation: "Identifies close polar contacts between donor nitrogen/oxygen atoms and acceptor oxygen/nitrogen atoms, and electrostatic attraction between positively charged (Arg, Lys, His) and negatively charged (Asp, Glu) residue sidechains.",
      example: "Polar contacts appear as dashed lines between interacting atoms in the active site.",
      expected: "H-bond distance typically falls between 2.7 Å and 3.3 Å.",
      citation: "Baker, E. N., & Hubbard, R. E. (1984). Hydrogen bonding in globular proteins. Progress in Biophysics and Molecular Biology, 44(2), 97-179.",
      doi: "10.1016/0079-6107(84)90007-5"
    },
    {
      id: "alignment",
      title: "Kabsch Structural Alignment",
      category: "Mathematics",
      description: "Best-fit translation and rotation of two 3D molecular structures.",
      equation: "H = P^T * Q = U * Σ * V^T => R = V * diag(1, 1, det(VU^T)) * U^T",
      explanation: "Superimposes two coordinate matrices by centering their centroids and calculating the cross-covariance matrix. Singular Value Decomposition (SVD) yields the optimal rotation matrix minimizing Root Mean Square Deviation (RMSD).",
      example: "Aligning a mutated protein sequence with the wild-type reference PDB.",
      expected: "RMSD < 1.5 Å indicates high structural homology; RMSD > 3.0 Å indicates structural divergence.",
      citation: "Kabsch, W. (1976). A solution for the best rotation to relate two sets of vectors. Acta Crystallographica Section A, 32(5), 922-923.",
      doi: "10.1107/S056773947600187X"
    },
    {
      id: "selection",
      title: "Selection Algebra Syntax",
      category: "Commands & Parser",
      description: "Custom query language for isolating residues and coordinates.",
      equation: "Boolean Operators: and, or, not | Keywords: name, resn, resi, chain",
      explanation: "Evaluates tokenized strings into Abstract Syntax Tree (AST) selectors matched against atom variables in linear time.",
      example: "Query: `chain A and resn ALA and (resi 1-50 or name CA)`",
      expected: "Highlights target atoms in pink and reports matching atom count.",
      citation: "Standard Selection Algebra syntax.",
      doi: ""
    }
  ];

  const filteredTopics = topics.filter(
    (t) =>
      t.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.category.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="absolute inset-y-0 right-0 w-[450px] bg-[#0E0E12] border-l border-white/10 shadow-2xl flex flex-col z-50 text-white font-sans pointer-events-auto">
      {/* Header */}
      <div className="p-4 border-b border-white/10 flex items-center justify-between bg-[#070709]">
        <div className="flex items-center gap-2">
          <BookOpen className="w-4 h-4 text-[#F27D26]" />
          <span className="font-bold text-xs uppercase tracking-wider">MolStudio User Guide & FAQ</span>
        </div>
        <button onClick={onClose} className="text-white/40 hover:text-white transition-all">
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Search Bar */}
      <div className="p-3 border-b border-white/5 bg-black/20 flex items-center gap-2">
        <Search className="w-3.5 h-3.5 text-white/30" />
        <input
          type="text"
          placeholder="Search equations, science, FAQs..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="bg-transparent border-none outline-none text-xs text-white/80 placeholder-white/30 flex-1"
        />
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
        {filteredTopics.map((topic) => (
          <div key={topic.id} className="bg-white/[0.02] border border-white/5 rounded-xl p-4 flex flex-col gap-3 hover:border-white/10 transition-all">
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase font-bold text-[#F27D26]/80 tracking-widest">{topic.category}</span>
              <HelpCircle className="w-3.5 h-3.5 text-white/30" />
            </div>
            
            <h4 className="text-sm font-bold text-white/90">{topic.title}</h4>
            <p className="text-[11px] text-white/60 leading-relaxed">{topic.description}</p>
            
            {/* Physics/Math Box */}
            <div className="bg-black/40 border border-white/[0.04] p-3 rounded-lg font-mono text-[10px] flex flex-col gap-2">
              <div className="text-white/30 uppercase text-[8px] font-bold tracking-wider flex items-center gap-1">
                <Calculator className="w-3 h-3 text-[#4A90E2]" />
                <span>Mathematical Formulation & Equation</span>
              </div>
              <div className="text-cyan-400 overflow-x-auto whitespace-pre p-1">
                {topic.equation}
              </div>
              <div className="text-white/50 text-[9px] border-t border-white/[0.03] pt-1.5 leading-normal">
                {topic.explanation}
              </div>
            </div>

            {/* Application Instructions */}
            <div className="flex flex-col gap-1.5 text-[10px] leading-relaxed">
              <div>
                <span className="text-white/40 font-medium">Example Usage:</span>{" "}
                <span className="text-white/80 font-mono">{topic.example}</span>
              </div>
              <div>
                <span className="text-white/40 font-medium">Expected Result:</span>{" "}
                <span className="text-emerald-400/90">{topic.expected}</span>
              </div>
            </div>

            {/* Scientific Citation */}
            <div className="border-t border-white/5 pt-2.5 flex flex-col gap-1">
              <div className="text-[8px] uppercase font-bold text-white/30 tracking-wider flex items-center gap-1">
                <FileText className="w-2.5 h-2.5 text-[#F27D26]" />
                <span>Primary Literature Citation</span>
              </div>
              <p className="text-[9px] text-white/40 italic leading-normal">{topic.citation}</p>
              {topic.doi && (
                <a
                  href={`https://doi.org/${topic.doi}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[8px] text-[#4A90E2] hover:text-[#4A90E2]/80 flex items-center gap-1 w-max mt-1 font-mono transition-all"
                >
                  <span>DOI: {topic.doi}</span>
                  <ExternalLink className="w-2.5 h-2.5" />
                </a>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
