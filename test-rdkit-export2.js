import initRDKitModule from "@rdkit/rdkit";
initRDKitModule().then((RDKit) => {
  const mol = RDKit.get_mol("CCO");
  console.log("Descriptors:", Object.keys(JSON.parse(mol.get_descriptors())).length);
});
