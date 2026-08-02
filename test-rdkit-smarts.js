import initRDKitModule from "@rdkit/rdkit";
initRDKitModule().then((RDKit) => {
  const mol = RDKit.get_mol("CCO");
  try {
    const res = mol.get_substruct_matches("invalid");
    console.log("res:", res);
  } catch (e) {
    console.log("error");
  }
});
