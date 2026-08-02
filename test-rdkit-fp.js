import initRDKitModule from "@rdkit/rdkit";
initRDKitModule().then((RDKit) => {
  const mol1 = RDKit.get_mol("CCO");
  const mol2 = RDKit.get_mol("CCC");
  try {
    const fp1 = mol1.get_morgan_fp();
    const fp2 = mol2.get_morgan_fp();
    console.log("fp1:", fp1.length, typeof fp1);
  } catch (e) {
    console.log("error fp", e);
  }
});
