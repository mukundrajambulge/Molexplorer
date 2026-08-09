import { SelectionParser, Atom } from '../src/lib/SelectionParser';
import { MolProcessor } from '../src/lib/MolProcessor';

export interface MoleculeTestCase {
  id: string;
  name: string;
  tier: number; // 1 to 10
  expectedAtomCount: number;
  format: 'pdb' | 'mmtf';
  data: string;
  smiles?: string;
}

// Generate benchmark molecules across 10 tiers (20 molecules per tier = 200 total)
export function generate200MoleculeDataset(): MoleculeTestCase[] {
  const dataset: MoleculeTestCase[] = [];

  // TIER 1: Monatomic & Tiny Gases (1 - 5 atoms)
  const tier1Mols = [
    { name: "Helium", atoms: [{ e: "He", x: 0, y: 0, z: 0 }] },
    { name: "Neon", atoms: [{ e: "Ne", x: 0, y: 0, z: 0 }] },
    { name: "Argon", atoms: [{ e: "Ar", x: 0, y: 0, z: 0 }] },
    { name: "Hydrogen gas (H2)", atoms: [{ e: "H", x: 0, y: 0, z: 0 }, { e: "H", x: 0.74, y: 0, z: 0 }] },
    { name: "Nitrogen gas (N2)", atoms: [{ e: "N", x: 0, y: 0, z: 0 }, { e: "N", x: 1.10, y: 0, z: 0 }] },
    { name: "Oxygen gas (O2)", atoms: [{ e: "O", x: 0, y: 0, z: 0 }, { e: "O", x: 1.21, y: 0, z: 0 }] },
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
    { name: "Methane (CH4)", atoms: [{ e: "C", x: 0, y: 0, z: 0 }, { e: "H", x: 0.63, y: 0.63, z: 0.63 }, { e: "H", x: -0.63, y: -0.63, z: 0.63 }, { e: "H", x: -0.63, y: 0.63, z: -0.63 }, { e: "H", x: 0.63, y: -0.63, z: -0.63 }] }
  ];

  tier1Mols.forEach((m, idx) => {
    dataset.push(createPDBMolecule(`t1_${idx+1}`, m.name, 1, m.atoms));
  });

  // TIER 2: Small Organics (6 - 15 atoms)
  const tier2Mols = [
    { name: "Acetylene (C2H2)", count: 4 },
    { name: "Ethylene (C2H4)", count: 6 },
    { name: "Methanol (CH3OH)", count: 6 },
    { name: "Formic Acid (HCOOH)", count: 5 },
    { name: "Ethane (C2H6)", count: 8 },
    { name: "Ethanol (C2H5OH)", count: 9 },
    { name: "Acetic Acid (CH3COOH)", count: 8 },
    { name: "Acetone (C3H6O)", count: 10 },
    { name: "Propane (C3H8)", count: 11 },
    { name: "Acetonitrile (CH3CN)", count: 6 },
    { name: "Urea (CH4N2O)", count: 8 },
    { name: "Aniline (C6H7N)", count: 14 },
    { name: "Benzene (C6H6)", count: 12 },
    { name: "Pyridine (C5H5N)", count: 11 },
    { name: "Phenol (C6H6O)", count: 13 },
    { name: "Furan (C4H4O)", count: 9 },
    { name: "Pyrrole (C4H5N)", count: 10 },
    { name: "Thiophene (C4H4S)", count: 9 },
    { name: "Glycerol (C3H8O3)", count: 14 },
    { name: "Oxalic Acid (C2H2O4)", count: 8 }
  ];

  tier2Mols.forEach((m, idx) => {
    dataset.push(createSyntheticMolecule(`t2_${idx+1}`, m.name, 2, m.count));
  });

  // TIER 3: Medium Medicinal Compounds (16 - 25 atoms)
  const tier3Mols = [
    { name: "Aspirin (C9H8O4)", count: 21 },
    { name: "Caffeine (C8H10N4O2)", count: 24 },
    { name: "Dopamine (C8H11NO2)", count: 22 },
    { name: "Serotonin (C10H12N2O)", count: 25 },
    { name: "Paracetamol / Acetaminophen (C8H9NO2)", count: 20 },
    { name: "Ibuprofen (C13H18O2)", count: 25 },
    { name: "Nicotine (C10H14N2)", count: 24 },
    { name: "Histamine (C5H9N3)", count: 17 },
    { name: "Adrenaline / Epinephrine (C9H13NO3)", count: 24 },
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

  // TIER 4: Large Small-Molecules & Drugs (26 - 40 atoms)
  const tier4Mols = [
    { name: "Vitamin C (Ascorbic Acid C6H8O6)", count: 20 },
    { name: "Penicillin G (C16H18N2O4S)", count: 35 },
    { name: "Amoxicillin (C16H19N3O5S)", count: 38 },
    { name: "Morphine (C17H19NO3)", count: 40 },
    { name: "Codeine (C18H21NO3)", count: 40 },
    { name: "Diazepam / Valium (C16H13ClN2O)", count: 33 },
    { name: "Alprazolam / Xanax (C17H13ClN4)", count: 35 },
    { name: "Omeprazole (C17H19N3O3S)", count: 38 },
    { name: "Metoprolol (C15H25NO3)", count: 38 },
    { name: "Propranolol (C16H21NO2)", count: 40 },
    { name: "Warfarin (C19H16O4)", count: 39 },
    { name: "Ciprofloxacin (C17H18FN3O3)", count: 38 },
    { name: "Sildenafil / Viagra fragment", count: 40 },
    { name: "Tadalafil / Cialis", count: 38 },
    { name: "Quinine (C20H24N2O2)", count: 40 },
    { name: "Cholesterol core fragment", count: 40 },
    { name: "Vitamin D3 core fragment", count: 40 },
    { name: "Atorvastatin fragment", count: 40 },
    { name: "Methotrexate fragment", count: 40 },
    { name: "Chlorophyll core fragment", count: 40 }
  ];

  tier4Mols.forEach((m, idx) => {
    dataset.push(createSyntheticMolecule(`t4_${idx+1}`, m.name, 4, m.count));
  });

  // TIER 5: Bio-ligands & Complex Natural Products (41 - 70 atoms)
  const tier5Mols = [
    { name: "Heme b (C34H32FeN4O4)", count: 65 },
    { name: "ATP (Adenosine Triphosphate)", count: 47 },
    { name: "ADP (Adenosine Diphosphate)", count: 39 },
    { name: "NADH (Nicotinamide Adenine Dinucleotide)", count: 68 },
    { name: "NADPH", count: 70 },
    { name: "Coenzyme A (CoA)", count: 70 },
    { name: "Doxorubicin (C27H29NO11)", count: 68 },
    { name: "Paclitaxel / Taxol fragment", count: 65 },
    { name: "Amphotericin B fragment", count: 70 },
    { name: "Rapamycin core fragment", count: 70 },
    { name: "Cyclosporin A fragment", count: 68 },
    { name: "Vitamin B12 Cobalamin core", count: 70 },
    { name: "Lipid A fragment", count: 65 },
    { name: "Phosphatidylcholine", count: 68 },
    { name: "Sphingomyelin", count: 62 },
    { name: "Ganglioside GM1 fragment", count: 66 },
    { name: "Staurosporine (C28H26N4O3)", count: 61 },
    { name: "Everolimus fragment", count: 70 },
    { name: "Artemisinin dimer", count: 64 },
    { name: "Rifampicin fragment", count: 70 }
  ];

  tier5Mols.forEach((m, idx) => {
    dataset.push(createSyntheticMolecule(`t5_${idx+1}`, m.name, 5, m.count));
  });

  // TIER 6: Oligopeptides & Short Oligomers (71 - 150 atoms)
  const tier6Mols = [
    { name: "Met-Enkephalin (YGGFM)", count: 75 },
    { name: "Leu-Enkephalin (YGGFL)", count: 73 },
    { name: "Glutathione dimer (GSSG)", count: 70 },
    { name: "Oxytocin (9-mer peptide)", count: 128 },
    { name: "Vasopressin (9-mer peptide)", count: 125 },
    { name: "Somatostatin 14-mer", count: 140 },
    { name: "Angiotensin II (8-mer)", count: 120 },
    { name: "TRH Thyrotropin-releasing hormone", count: 74 },
    { name: "GnRH Gonadotropin-releasing hormone", count: 135 },
    { name: "Alpha-conotoxin GI 13-mer", count: 138 },
    { name: "Bradykinin 9-mer", count: 132 },
    { name: "Substance P 11-mer", count: 145 },
    { name: "Crambin N-terminal loop", count: 110 },
    { name: "Zinc Finger DNA-binding motif fragment", count: 140 },
    { name: "BPTI loop fragment", count: 130 },
    { name: "Insulin B-chain 10-mer fragment", count: 135 },
    { name: "Poly-alanine 10-mer", count: 102 },
    { name: "Poly-glycine 10-mer", count: 72 },
    { name: "DNA 4-mer d(CGCG)", count: 126 },
    { name: "RNA 4-mer r(GCGC)", count: 130 }
  ];

  tier6Mols.forEach((m, idx) => {
    dataset.push(createPeptideMolecule(`t6_${idx+1}`, m.name, 6, m.count));
  });

  // TIER 7: Small Proteins & Peptides (151 - 400 atoms)
  const tier7Mols = [
    { name: "Crambin (1CRN - 46 res)", count: 327 },
    { name: "BPTI Bovine Pancreatic Trypsin Inhibitor (1BPI)", count: 380 },
    { name: "Villin Headpiece HP35 (1VII - 35 res)", count: 340 },
    { name: "Trp-Cage Cage-fold miniprotein (1L2Y - 20 res)", count: 304 },
    { name: "Ubiquitin N-terminal domain", count: 380 },
    { name: "Alpha-Helix Bundle 3-helix fold", count: 390 },
    { name: "Beta-Hairpin 16-mer peptide fold", count: 260 },
    { name: "Human Defensin HNP-1", count: 370 },
    { name: "Insulin A-chain (21 res)", count: 170 },
    { name: "Insulin B-chain (30 res)", count: 240 },
    { name: "Epidermal Growth Factor EGF domain", count: 390 },
    { name: "Metallothionein alpha domain", count: 310 },
    { name: "Conotoxin MVIIC 26-mer", count: 280 },
    { name: "Cytochrome c551 fragment", count: 395 },
    { name: "Protein A B-domain (58 res)", count: 385 },
    { name: "Rubredoxin (54 res)", count: 390 },
    { name: "Ferredoxin 2Fe-2S protein", count: 385 },
    { name: "Cardiotoxin V4 from Cobra venom", count: 390 },
    { name: "Erabutoxin a (62 res)", count: 395 },
    { name: "Melittin tetramer subunit (26 res)", count: 210 }
  ];

  tier7Mols.forEach((m, idx) => {
    dataset.push(createPeptideMolecule(`t7_${idx+1}`, m.name, 7, m.count));
  });

  // TIER 8: Medium Proteins & Enzymes (401 - 1,000 atoms)
  const tier8Mols = [
    { name: "Cytochrome C (104 res)", count: 820 },
    { name: "Myoglobin Sperm Whale (153 res)", count: 980 },
    { name: "Lysozyme Hen Egg White (1HEL - 129 res)", count: 995 },
    { name: "Ribonuclease A (1RFA - 124 res)", count: 950 },
    { name: "Triosephosphate Isomerase TIM monomer", count: 990 },
    { name: "Green Fluorescent Protein GFP chromophore core (1EMA)", count: 920 },
    { name: "Protease Inhibitor IA3", count: 520 },
    { name: "Carbonic Anhydrase II active site domain", count: 950 },
    { name: "Superoxide Dismutase SOD1 monomer", count: 890 },
    { name: "Calmodulin Ca2+-bound domain (138 res)", count: 980 },
    { name: "Barnase Ribonuclease (110 res)", count: 860 },
    { name: "Barstar Barnase Inhibitor (89 res)", count: 710 },
    { name: "Streptavidin monomer (159 res)", count: 980 },
    { name: "Thermolysin catalytic domain", count: 995 },
    { name: "Papain Cysteine Protease (212 res)", count: 990 },
    { name: "Subtilisin Carlsberg (274 res)", count: 990 },
    { name: "Phospholypase A2 (124 res)", count: 960 },
    { name: "Cytochrome P450 heme binding domain", count: 980 },
    { name: "Dihydrofolate Reductase DHFR (159 res)", count: 985 },
    { name: "Galectin-1 carbohydrate binding domain", count: 950 }
  ];

  tier8Mols.forEach((m, idx) => {
    dataset.push(createPeptideMolecule(`t8_${idx+1}`, m.name, 8, m.count));
  });

  // TIER 9: Large Proteins & Complexes (1,001 - 3,500 atoms)
  const tier9Mols = [
    { name: "HIV-1 Protease Homodimer with Inhibitor (1HVR - 198 res)", count: 1540 },
    { name: "Hemoglobin Monomer Alpha Chain (141 res)", count: 1060 },
    { name: "Hemoglobin Dimer Alpha-Beta (287 res)", count: 2200 },
    { name: "Alcohol Dehydrogenase Monomer", count: 2800 },
    { name: "Kinase Domain Abl/Src Kinase (280 res)", count: 2250 },
    { name: "DNA Polymerase Beta thumb domain", count: 1800 },
    { name: "CRISPR-Cas9 REC1 domain fragment", count: 3200 },
    { name: "RNA Polymerase II subunit RPB2 fragment", count: 3400 },
    { name: "Bovine Serum Albumin BSA domain 1-2", count: 3100 },
    { name: "Actin Monomer G-actin (375 res)", count: 2900 },
    { name: "Tubulin Beta Monomer (445 res)", count: 3450 },
    { name: "Immunoglobulin Fab Heavy Chain (220 res)", count: 1700 },
    { name: "MHC Class I Heavy Chain + Beta-2 Microglobulin", count: 3100 },
    { name: "T-Cell Receptor TCR Alpha-Beta extracellular domain", count: 3300 },
    { name: "GPCR Rhodopsin 7-TM bundle", count: 2700 },
    { name: "Lactate Dehydrogenase LDH subunit", count: 2500 },
    { name: "Hexokinase I N-terminal domain", count: 3400 },
    { name: "Catalase Monomer catalytic domain", count: 3450 },
    { name: "Firefly Luciferase (550 res)", count: 3490 },
    { name: "Alpha-Amylase Porcine Pancreatic (496 res)", count: 3495 }
  ];

  tier9Mols.forEach((m, idx) => {
    dataset.push(createPeptideMolecule(`t9_${idx+1}`, m.name, 9, m.count));
  });

  // TIER 10: Macromolecules & Assemblies (3,501 - 25,000+ atoms)
  const tier10Mols = [
    { name: "B-DNA Dodecamer (1BNA - 24 nucleotides)", count: 758 },
    { name: "Nucleosome Core Particle Histone Octamer fragment", count: 4200 },
    { name: "Spike Protein RBD bound to ACE2 receptor", count: 5800 },
    { name: "Ribosome Subunit 30S Decoding Center fragment", count: 6500 },
    { name: "Intact IgG1 Antibody Fab2+Fc Assembly", count: 10500 },
    { name: "Viral Capsid Hexamer Protomer Assembly", count: 12000 },
    { name: "GroEL Chaperonin Heptameric Ring Subunit", count: 8500 },
    { name: "ATP Synthase F1 Catalytic Head Hexamer", count: 16500 },
    { name: "RNA Polymerase II 12-subunit Holoenzyme Core", count: 22000 },
    { name: "Hemoglobin Tetramer Alpha2Beta2 + 4 Hemes", count: 4400 },
    { name: "Photosystem II Reaction Center Core Complex", count: 18500 },
    { name: "Proteasome 20S Core Alpha-Beta Ring Stack", count: 24000 },
    { name: "Potassium Channel KcsA Tetramer + Selectivity Filter", count: 5200 },
    { name: "Glutamine Synthetase Dodecamer Ring Assembly", count: 24500 },
    { name: "Pyruvate Dehydrogenase E1 Alpha2Beta2 Tetramer", count: 12800 },
    { name: "Clathrin Heavy Chain Triskelion Hub Complex", count: 14200 },
    { name: "Microtubule 13-protofilament Tubulin Ring", count: 21000 },
    { name: "Membrane Protein Transporter in Lipid Nanodisc", count: 19500 },
    { name: "Phage T4 Baseplate Tail Fiber Assembly", count: 23000 },
    { name: "Group II Intron Large Ribozyme Complex", count: 15800 }
  ];

  tier10Mols.forEach((m, idx) => {
    dataset.push(createPeptideMolecule(`t10_${idx+1}`, m.name, 10, m.count));
  });

  return dataset;
}

function createPDBMolecule(id: string, name: string, tier: number, atomList: { e: string; x: number; y: number; z: number }[]): MoleculeTestCase {
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

function createSyntheticMolecule(id: string, name: string, tier: number, atomCount: number): MoleculeTestCase {
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

function createPeptideMolecule(id: string, name: string, tier: number, atomCount: number): MoleculeTestCase {
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
