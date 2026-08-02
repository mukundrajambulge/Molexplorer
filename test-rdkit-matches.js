import initRDKitModule from "@rdkit/rdkit";
initRDKitModule().then((RDKit) => {
  const mol = RDKit.get_mol("CCO");
  try {
    const qmol = RDKit.get_qmol("CO");
    const res = mol.get_substruct_matches(qmol);
    console.log("res with qmol:", res);
  } catch (e) {
    console.log("error with qmol", e.message);
  }
  
  try {
    const res = mol.get_substruct_matches("CO");
    console.log("res with string:", res);
  } catch(e) {
    console.log("error with string", e.message);
  }
});
