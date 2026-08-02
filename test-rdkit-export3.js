import initRDKitModule from "@rdkit/rdkit";
initRDKitModule().then((RDKit) => {
  const mol = RDKit.get_mol("CCO");
  console.log("Mol methods:", Object.keys(Object.getPrototypeOf(mol)));
});
