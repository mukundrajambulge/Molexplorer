import initRDKitModule from "@rdkit/rdkit";
initRDKitModule().then((RDKit) => {
  const mol = RDKit.get_mol("CCO");
  const qmol = RDKit.get_qmol("c1ccccc1");
  const res = mol.get_substruct_matches(qmol);
  console.log("res:", res);
});
