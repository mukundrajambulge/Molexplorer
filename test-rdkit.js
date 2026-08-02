import initRDKitModule from "@rdkit/rdkit";
initRDKitModule().then((RDKit) => {
  try {
    const mol = RDKit.get_mol("CCO", JSON.stringify({generate_3d_coords: true}));
    console.log("3D block?", mol.get_molblock().slice(0, 100));
  } catch (e) { console.error(e.message); }
});
