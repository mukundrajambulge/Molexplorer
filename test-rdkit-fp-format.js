import initRDKitModule from "@rdkit/rdkit";
initRDKitModule().then((RDKit) => {
  const mol1 = RDKit.get_mol("CCO");
  console.log(mol1.get_morgan_fp().substring(0, 100));
});
