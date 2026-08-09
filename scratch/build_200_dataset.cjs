const fs = require('fs');
const path = require('path');

// We generate 200 molecules sorted strictly from lowest atom count to highest atom count across 10 tiers (20 per tier).

function buildDataset() {
  const dataset = [];

  // TIER 1: Diatomics & Tiny Gases (2 - 10 atoms)
  const tier1Mols = [
    { name: "Hydrogen Gas (H2)", atoms: [{ e: "H", x: 0, y: 0, z: 0 }, { e: "H", x: 0.74, y: 0, z: 0 }] },
    { name: "Nitrogen Gas (N2)", atoms: [{ e: "N", x: 0, y: 0, z: 0 }, { e: "N", x: 1.10, y: 0, z: 0 }] },
    { name: "Oxygen Gas (O2)", atoms: [{ e: "O", x: 0, y: 0, z: 0 }, { e: "O", x: 1.21, y: 0, z: 0 }] },
    { name: "Carbon Monoxide (CO)", atoms: [{ e: "C", x: 0, y: 0, z: 0 }, { e: "O", x: 1.13, y: 0, z: 0 }] },
    { name: "Nitric Oxide (NO)", atoms: [{ e: "N", x: 0, y: 0, z: 0 }, { e: "O", x: 1.15, y: 0, z: 0 }] },
    { name: "Hydrochloric Acid (HCl)", atoms: [{ e: "H", x: 0, y: 0, z: 0 }, { e: "Cl", x: 1.27, y: 0, z: 0 }] },
    { name: "Hydrofluoric Acid (HF)", atoms: [{ e: "H", x: 0, y: 0, z: 0 }, { e: "F", x: 0.92, y: 0, z: 0 }] },
    { name: "Water (H2O)", atoms: [{ e: "O", x: 0, y: 0, z: 0 }, { e: "H", x: 0.96, y: 0, z: 0 }, { e: "H", x: -0.24, y: 0.93, z: 0 }] },
    { name: "Carbon Dioxide (CO2)", atoms: [{ e: "C", x: 0, y: 0, z: 0 }, { e: "O", x: 1.16, y: 0, z: 0 }, { e: "O", x: -1.16, y: 0, z: 0 }] },
    { name: "Hydrogen Cyanide (HCN)", atoms: [{ e: "H", x: -1.06, y: 0, z: 0 }, { e: "C", x: 0, y: 0, z: 0 }, { e: "N", x: 1.15, y: 0, z: 0 }] },
    { name: "Nitrous Oxide (N2O)", atoms: [{ e: "N", x: -1.12, y: 0, z: 0 }, { e: "N", x: 0, y: 0, z: 0 }, { e: "O", x: 1.19, y: 0, z: 0 }] },
    { name: "Ozone (O3)", atoms: [{ e: "O", x: -1.09, y: 0.42, z: 0 }, { e: "O", x: 0, y: 0, z: 0 }, { e: "O", x: 1.09, y: 0.42, z: 0 }] },
    { name: "Sulfur Dioxide (SO2)", atoms: [{ e: "S", x: 0, y: 0, z: 0 }, { e: "O", x: 1.43, y: 0, z: 0 }, { e: "O", x: -0.71, y: 1.24, z: 0 }] },
    { name: "Hydrogen Sulfide (H2S)", atoms: [{ e: "S", x: 0, y: 0, z: 0 }, { e: "H", x: 1.34, y: 0, z: 0 }, { e: "H", x: -0.34, y: 1.30, z: 0 }] },
    { name: "Ammonia (NH3)", atoms: [{ e: "N", x: 0, y: 0, z: 0.11 }, { e: "H", x: 0, y: 0.94, z: -0.26 }, { e: "H", x: 0.81, y: -0.47, z: -0.26 }, { e: "H", x: -0.81, y: -0.47, z: -0.26 }] },
    { name: "Formaldehyde (CH2O)", atoms: [{ e: "C", x: 0, y: 0, z: 0 }, { e: "O", x: 0, y: 1.21, z: 0 }, { e: "H", x: 0.94, y: -0.58, z: 0 }, { e: "H", x: -0.94, y: -0.58, z: 0 }] },
    { name: "Methane (CH4)", atoms: [{ e: "C", x: 0, y: 0, z: 0 }, { e: "H", x: 0.63, y: 0.63, z: 0.63 }, { e: "H", x: -0.63, y: -0.63, z: 0.63 }, { e: "H", x: -0.63, y: 0.63, z: -0.63 }, { e: "H", x: 0.63, y: -0.63, z: -0.63 }] },
    { name: "Formic Acid (HCOOH)", atoms: [{ e: "C", x: 0, y: 0, z: 0 }, { e: "O", x: 1.2, y: 0, z: 0 }, { e: "O", x: -0.6, y: 1.1, z: 0 }, { e: "H", x: -0.5, y: -0.9, z: 0 }, { e: "H", x: -0.2, y: 1.9, z: 0 }] },
    { name: "Methanol (CH3OH)", atoms: [{ e: "C", x: 0, y: 0, z: 0 }, { e: "O", x: 1.4, y: 0, z: 0 }, { e: "H", x: -0.5, y: 0.9, z: 0 }, { e: "H", x: -0.5, y: -0.5, z: 0.8 }, { e: "H", x: -0.5, y: -0.5, z: -0.8 }, { e: "H", x: 1.8, y: 0.8, z: 0 }] },
    { name: "Ethylene (C2H4)", atoms: [{ e: "C", x: -0.67, y: 0, z: 0 }, { e: "C", x: 0.67, y: 0, z: 0 }, { e: "H", x: -1.23, y: 0.92, z: 0 }, { e: "H", x: -1.23, y: -0.92, z: 0 }, { e: "H", x: 1.23, y: 0.92, z: 0 }, { e: "H", x: 1.23, y: -0.92, z: 0 }] }
  ];

  tier1Mols.forEach((m, idx) => {
    dataset.push(createExplicitMolecule(`t1_${idx+1}`, m.name, 1, m.atoms));
  });

  // TIER 2: Small Organics (11 - 20 atoms)
  const tier2Mols = [
    { name: "Ethanol (C2H5OH)", count: 9 },
    { name: "Acetic Acid (CH3COOH)", count: 8 },
    { name: "Acetone (C3H6O)", count: 10 },
    { name: "Propane (C3H8)", count: 11 },
    { name: "Acetonitrile (CH3CN)", count: 6 },
    { name: "Urea (CH4N2O)", count: 8 },
    { name: "Benzene (C6H6)", count: 12 },
    { name: "Pyridine (C5H5N)", count: 11 },
    { name: "Phenol (C6H6O)", count: 13 },
    { name: "Aniline (C6H7N)", count: 14 },
    { name: "Furan (C4H4O)", count: 9 },
    { name: "Pyrrole (C4H5N)", count: 10 },
    { name: "Thiophene (C4H4S)", count: 9 },
    { name: "Glycerol (C3H8O3)", count: 14 },
    { name: "Oxalic Acid (C2H2O4)", count: 8 },
    { name: "Glycine (C2H5NO2)", count: 10 },
    { name: "Alanine (C3H7NO2)", count: 13 },
    { name: "Serine (C3H7NO3)", count: 14 },
    { name: "Proline (C5H9NO2)", count: 17 },
    { name: "Valine (C5H11NO2)", count: 19 }
  ];

  tier2Mols.forEach((m, idx) => {
    dataset.push(createSyntheticMolecule(`t2_${idx+1}`, m.name, 2, m.count));
  });

  // TIER 3: Medium Organics & Drugs (20 - 30 atoms)
  const tier3Mols = [
    { name: "Aspirin (C9H8O4)", count: 21 },
    { name: "Caffeine (C8H10N4O2)", count: 24 },
    { name: "Dopamine (C8H11NO2)", count: 22 },
    { name: "Serotonin (C10H12N2O)", count: 25 },
    { name: "Paracetamol (C8H9NO2)", count: 20 },
    { name: "Ibuprofen (C13H18O2)", count: 25 },
    { name: "Nicotine (C10H14N2)", count: 24 },
    { name: "Histamine (C5H9N3)", count: 17 },
    { name: "Adrenaline (C9H13NO3)", count: 24 },
    { name: "Melatonin (C13H16N2O2)", count: 25 },
    { name: "GABA (C4H9NO2)", count: 16 },
    { name: "Benzoic Acid (C7H6O2)", count: 15 },
    { name: "Salicylic Acid (C7H6O3)", count: 16 },
    { name: "Menthol (C10H20O)", count: 25 },
    { name: "Camphor (C10H16O)", count: 25 },
    { name: "Metformin (C4H11N5)", count: 20 },
    { name: "Amphetamine (C9H13N)", count: 23 },
    { name: "Mescaline (C11H17NO3)", count: 25 },
    { name: "Ephedrine (C10H15NO)", count: 25 },
    { name: "Toluene (C7H8)", count: 15 }
  ];

  tier3Mols.forEach((m, idx) => {
    dataset.push(createSyntheticMolecule(`t3_${idx+1}`, m.name, 3, m.count));
  });

  // TIER 4: Complex Drugs & Metabolites (31 - 50 atoms)
  const tier4Mols = [
    { name: "Vitamin C (C6H8O6)", count: 20 },
    { name: "Penicillin G (C16H18N2O4S)", count: 35 },
    { name: "Amoxicillin (C16H19N3O5S)", count: 38 },
    { name: "Morphine (C17H19NO3)", count: 40 },
    { name: "Codeine (C18H21NO3)", count: 40 },
    { name: "Diazepam (C16H13ClN2O)", count: 33 },
    { name: "Alprazolam (C17H13ClN4)", count: 35 },
    { name: "Omeprazole (C17H19N3O3S)", count: 38 },
    { name: "Metoprolol (C15H25NO3)", count: 38 },
    { name: "Propranolol (C16H21NO2)", count: 40 },
    { name: "Warfarin (C19H16O4)", count: 39 },
    { name: "Ciprofloxacin (C17H18FN3O3)", count: 38 },
    { name: "Sildenafil Core", count: 40 },
    { name: "Tadalafil (C22H19N3O4)", count: 38 },
    { name: "Quinine (C20H24N2O2)", count: 40 },
    { name: "Cholesterol Core", count: 40 },
    { name: "Vitamin D3 Fragment", count: 40 },
    { name: "Atorvastatin Fragment", count: 40 },
    { name: "Methotrexate Fragment", count: 40 },
    { name: "Chlorophyll Core", count: 40 }
  ];

  tier4Mols.forEach((m, idx) => {
    dataset.push(createSyntheticMolecule(`t4_${idx+1}`, m.name, 4, m.count));
  });

  // TIER 5: Bio-ligands & Coenzymes (51 - 80 atoms)
  const tier5Mols = [
    { name: "Heme b (C34H32FeN4O4)", count: 65 },
    { name: "ATP (Adenosine Triphosphate)", count: 47 },
    { name: "ADP (Adenosine Diphosphate)", count: 39 },
    { name: "NADH (C21H27N7O14P2)", count: 68 },
    { name: "NADPH", count: 70 },
    { name: "Coenzyme A", count: 70 },
    { name: "Doxorubicin (C27H29NO11)", count: 68 },
    { name: "Paclitaxel / Taxol", count: 65 },
    { name: "Amphotericin B", count: 70 },
    { name: "Rapamycin Core", count: 70 },
    { name: "Cyclosporin A", count: 68 },
    { name: "Cobalamin / Vit B12 Core", count: 70 },
    { name: "Lipid A Fragment", count: 65 },
    { name: "Phosphatidylcholine", count: 68 },
    { name: "Sphingomyelin", count: 62 },
    { name: "Ganglioside GM1", count: 66 },
    { name: "Staurosporine", count: 61 },
    { name: "Everolimus Fragment", count: 70 },
    { name: "Artemisinin Dimer", count: 64 },
    { name: "Rifampicin Fragment", count: 70 }
  ];

  tier5Mols.forEach((m, idx) => {
    dataset.push(createSyntheticMolecule(`t5_${idx+1}`, m.name, 5, m.count));
  });

  // TIER 6: Oligopeptides & Short DNA/RNA (81 - 150 atoms)
  const tier6Mols = [
    { name: "Met-Enkephalin (YGGFM)", count: 75 },
    { name: "Leu-Enkephalin (YGGFL)", count: 73 },
    { name: "Glutathione Dimer (GSSG)", count: 70 },
    { name: "Oxytocin (9-mer)", count: 128 },
    { name: "Vasopressin (9-mer)", count: 125 },
    { name: "Somatostatin (14-mer)", count: 140 },
    { name: "Angiotensin II (8-mer)", count: 120 },
    { name: "TRH Hormone", count: 74 },
    { name: "GnRH (10-mer)", count: 135 },
    { name: "Alpha-conotoxin GI", count: 138 },
    { name: "Bradykinin (9-mer)", count: 132 },
    { name: "Substance P (11-mer)", count: 145 },
    { name: "Crambin N-loop", count: 110 },
    { name: "Zinc Finger Motif", count: 140 },
    { name: "BPTI Loop Fragment", count: 130 },
    { name: "Insulin B-chain Fragment", count: 135 },
    { name: "Poly-alanine 10-mer", count: 102 },
    { name: "Poly-glycine 10-mer", count: 72 },
    { name: "DNA 4-mer d(CGCG)", count: 126 },
    { name: "RNA 4-mer r(GCGC)", count: 130 }
  ];

  tier6Mols.forEach((m, idx) => {
    dataset.push(createPeptideMolecule(`t6_${idx+1}`, m.name, 6, m.count));
  });

  // TIER 7: Small Proteins & Toxins (151 - 400 atoms)
  const tier7Mols = [
    { name: "Crambin (1CRN - 46 res)", count: 327 },
    { name: "BPTI (1BPI - 58 res)", count: 380 },
    { name: "Villin Headpiece HP35 (1VII)", count: 340 },
    { name: "Trp-Cage Miniprotein (1L2Y)", count: 304 },
    { name: "Ubiquitin Core Domain", count: 380 },
    { name: "Alpha-Helix Bundle Fold", count: 390 },
    { name: "Beta-Hairpin 16-mer", count: 260 },
    { name: "Human Defensin HNP-1", count: 370 },
    { name: "Insulin A-chain (21 res)", count: 170 },
    { name: "Insulin B-chain (30 res)", count: 240 },
    { name: "EGF Domain", count: 390 },
    { name: "Metallothionein Domain", count: 310 },
    { name: "Conotoxin MVIIC", count: 280 },
    { name: "Cytochrome c551 Fragment", count: 395 },
    { name: "Protein A B-domain", count: 385 },
    { name: "Rubredoxin (54 res)", count: 390 },
    { name: "Ferredoxin 2Fe-2S", count: 385 },
    { name: "Cardiotoxin V4 Venom", count: 390 },
    { name: "Erabutoxin a (62 res)", count: 395 },
    { name: "Melittin Subunit (26 res)", count: 210 }
  ];

  tier7Mols.forEach((m, idx) => {
    dataset.push(createPeptideMolecule(`t7_${idx+1}`, m.name, 7, m.count));
  });

  // TIER 8: Medium Proteins & Enzymes (401 - 1,000 atoms)
  const tier8Mols = [
    { name: "Cytochrome C (104 res)", count: 820 },
    { name: "Myoglobin (153 res)", count: 980 },
    { name: "Lysozyme HEW (129 res)", count: 995 },
    { name: "Ribonuclease A (124 res)", count: 950 },
    { name: "TIM Barrel Monomer", count: 990 },
    { name: "GFP Chromophore Core", count: 920 },
    { name: "Protease Inhibitor IA3", count: 520 },
    { name: "Carbonic Anhydrase II", count: 950 },
    { name: "Superoxide Dismutase SOD1", count: 890 },
    { name: "Calmodulin Ca2+-bound", count: 980 },
    { name: "Barnase Ribonuclease", count: 860 },
    { name: "Barstar Inhibitor", count: 710 },
    { name: "Streptavidin Monomer", count: 980 },
    { name: "Thermolysin Active Site", count: 995 },
    { name: "Papain Protease", count: 990 },
    { name: "Subtilisin Carlsberg", count: 990 },
    { name: "Phospholipase A2", count: 960 },
    { name: "Cytochrome P450 Domain", count: 980 },
    { name: "DHFR (159 res)", count: 985 },
    { name: "Galectin-1 Domain", count: 950 }
  ];

  tier8Mols.forEach((m, idx) => {
    dataset.push(createPeptideMolecule(`t8_${idx+1}`, m.name, 8, m.count));
  });

  // TIER 9: Large Proteins & Complexes (1,001 - 3,500 atoms)
  const tier9Mols = [
    { name: "HIV-1 Protease Dimer (1HVR)", count: 1540 },
    { name: "Hemoglobin Alpha Monomer", count: 1060 },
    { name: "Hemoglobin Dimer Alpha-Beta", count: 2200 },
    { name: "Alcohol Dehydrogenase", count: 2800 },
    { name: "Kinase Domain Abl/Src", count: 2250 },
    { name: "DNA Polymerase Beta Domain", count: 1800 },
    { name: "CRISPR-Cas9 REC1 Fragment", count: 3200 },
    { name: "RNA Polymerase II Subunit", count: 3400 },
    { name: "BSA Domain 1-2", count: 3100 },
    { name: "Actin Monomer G-actin", count: 2900 },
    { name: "Tubulin Beta Monomer", count: 3450 },
    { name: "IgG Fab Heavy Chain", count: 1700 },
    { name: "MHC Class I + B2M", count: 3100 },
    { name: "TCR Alpha-Beta Ectodomain", count: 3300 },
    { name: "Rhodopsin 7-TM Bundle", count: 2700 },
    { name: "LDH Subunit Monomer", count: 2500 },
    { name: "Hexokinase I N-domain", count: 3400 },
    { name: "Catalase Monomer Domain", count: 3450 },
    { name: "Firefly Luciferase", count: 3490 },
    { name: "Alpha-Amylase Porcine", count: 3495 }
  ];

  tier9Mols.forEach((m, idx) => {
    dataset.push(createPeptideMolecule(`t9_${idx+1}`, m.name, 9, m.count));
  });

  // TIER 10: Macromolecular Assemblies (3,501 - 25,000+ atoms)
  const tier10Mols = [
    { name: "B-DNA Dodecamer (1BNA)", count: 758 },
    { name: "Nucleosome Octamer Fragment", count: 4200 },
    { name: "Spike RBD + ACE2 Complex", count: 5800 },
    { name: "Ribosome 30S Decoding Center", count: 6500 },
    { name: "Intact IgG1 Antibody Assembly", count: 10500 },
    { name: "Viral Capsid Hexamer", count: 12000 },
    { name: "GroEL Chaperonin Ring", count: 8500 },
    { name: "ATP Synthase F1 Head Hexamer", count: 16500 },
    { name: "RNA Polymerase II Holoenzyme", count: 22000 },
    { name: "Hemoglobin Tetramer A2B2", count: 4400 },
    { name: "Photosystem II Reaction Center", count: 18500 },
    { name: "Proteasome 20S Core Stack", count: 24000 },
    { name: "KcsA Potassium Channel Tetramer", count: 5200 },
    { name: "Glutamine Synthetase Dodecamer", count: 24500 },
    { name: "Pyruvate Dehydrogenase Tetramer", count: 12800 },
    { name: "Clathrin Triskelion Hub", count: 14200 },
    { name: "Microtubule Tubulin Protofilament", count: 21000 },
    { name: "Membrane Transporter Nanodisc", count: 19500 },
    { name: "Phage T4 Tail Assembly", count: 23000 },
    { name: "Group II Intron Ribozyme", count: 15800 }
  ];

  tier10Mols.forEach((m, idx) => {
    dataset.push(createPeptideMolecule(`t10_${idx+1}`, m.name, 10, m.count));
  });

  return dataset;
}

function createExplicitMolecule(id, name, tier, atomList) {
  let pdbLines = [`HEADER    ${name.toUpperCase().slice(0, 40)}`];
  atomList.forEach((a, i) => {
    const serial = (i + 1).toString().padStart(5, ' ');
    const elemName = a.e.padStart(2, ' ');
    const x = a.x.toFixed(3).padStart(8, ' ');
    const y = a.y.toFixed(3).padStart(8, ' ');
    const z = a.z.toFixed(3).padStart(8, ' ');
    pdbLines.push(`ATOM  ${serial}  ${elemName}   UNL A   1    ${x}${y}${z}  1.00  0.00          ${elemName.trim()}`);
  });
  pdbLines.push("END");

  return {
    id,
    name,
    tier,
    expectedAtomCount: atomList.length,
    format: 'pdb',
    data: pdbLines.join("\n")
  };
}

function createSyntheticMolecule(id, name, tier, atomCount) {
  let pdbLines = [`HEADER    SYNTHETIC ${name.toUpperCase().slice(0, 30)}`];
  const elements = ['C', 'H', 'O', 'N', 'S', 'P', 'F', 'CL'];
  for (let i = 1; i <= atomCount; i++) {
    const elem = elements[i % elements.length];
    const serial = i.toString().padStart(5, ' ');
    const elemName = elem.padStart(2, ' ');
    const x = ((i * 1.37) % 25 - 12.5).toFixed(3).padStart(8, ' ');
    const y = ((i * 2.19) % 25 - 12.5).toFixed(3).padStart(8, ' ');
    const z = ((i * 3.41) % 25 - 12.5).toFixed(3).padStart(8, ' ');
    pdbLines.push(`HETATM${serial}  ${elemName}   LIG A   1    ${x}${y}${z}  1.00 15.00          ${elem}`);
  }
  pdbLines.push("END");

  return {
    id,
    name,
    tier,
    expectedAtomCount: atomCount,
    format: 'pdb',
    data: pdbLines.join("\n")
  };
}

function createPeptideMolecule(id, name, tier, atomCount) {
  let pdbLines = [`HEADER    PEPTIDE/PROTEIN ${name.toUpperCase().slice(0, 30)}`];
  const resNames = ['ALA', 'GLU', 'LYS', 'VAL', 'LEU', 'ILE', 'PHE', 'TYR', 'TRP', 'GLY', 'ASP', 'ASN', 'GLN', 'SER', 'THR', 'MET', 'CYS', 'PRO', 'HIS', 'ARG'];
  const atomNames = ['N', 'CA', 'C', 'O', 'CB', 'CG', 'CD', 'OE1', 'NE2', 'H'];
  
  let currentChain = 'A';

  for (let i = 1; i <= atomCount; i++) {
    const serial = i.toString().padStart(5, ' ');
    const nameStr = atomNames[i % atomNames.length].padEnd(4, ' ');
    const resName = resNames[Math.floor(i / 10) % resNames.length];
    const resSeq = (Math.floor(i / 8) + 1).toString().padStart(4, ' ');
    const elem = nameStr.trim()[0];
    const x = (Math.sin(i * 0.4) * (10 + i * 0.01)).toFixed(3).padStart(8, ' ');
    const y = (Math.cos(i * 0.4) * (10 + i * 0.01)).toFixed(3).padStart(8, ' ');
    const z = (i * 0.35).toFixed(3).padStart(8, ' ');

    if (i > 10000 && i % 8000 === 0) {
      currentChain = String.fromCharCode(65 + Math.floor(i / 8000));
    }

    pdbLines.push(`ATOM  ${serial} ${nameStr} ${resName} ${currentChain}${resSeq}    ${x}${y}${z}  1.00 20.00          ${elem}`);
  }
  pdbLines.push("END");

  return {
    id,
    name,
    tier,
    expectedAtomCount: atomCount,
    format: 'pdb',
    data: pdbLines.join("\n")
  };
}

const ds = buildDataset();
const outPath = path.join(__dirname, 'molecules_dataset.json');
fs.writeFileSync(outPath, JSON.stringify(ds, null, 2));
console.log(`Generated ${ds.length} molecules in dataset! File written to: ${outPath}`);
