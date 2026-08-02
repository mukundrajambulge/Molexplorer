import initRDKitModule from "@rdkit/rdkit";
initRDKitModule().then((RDKit) => {
  const mol = RDKit.get_mol("CCO");
  mol.add_hs_in_place();
  // Is there a way to generate 3d coords?
  try {
     console.log(RDKit.get_molblock(mol)); // Wait, is there a generate_3d_coords method?
  } catch(e) {}
});
