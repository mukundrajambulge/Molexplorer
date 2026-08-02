import initRDKitModule from "@rdkit/rdkit";
initRDKitModule().then((RDKit) => {
  const mol = RDKit.get_mol("CCO", JSON.stringify({generate3D: true}));
  console.log("has 3D coords:", mol.has_coords() && mol.get_molblock().includes("3D"));
});
