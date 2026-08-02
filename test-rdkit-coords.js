import initRDKitModule from "@rdkit/rdkit";
initRDKitModule().then((RDKit) => {
  const mol = RDKit.get_mol("CCO");
  console.log("has coords:", mol.has_coords()); // false
  mol.set_new_coords(); // this is just 2D, right?
  console.log("has coords after set:", mol.has_coords());
  console.log("molblock 2D:\n", mol.get_molblock().substring(0, 200));

  mol.add_hs_in_place(); // Need to add Hs for 3D? wait, add_hs_in_place might not exist? Ah, 'add_hs' exists
  // get 3D coords?
  try {
     console.log("trying to generate 3D coords...");
     // RDKit MinimalLib does not support 3D coordinate generation natively except in newer versions with preferCoordGen... wait.
     const mol3d = mol.get_new_coords(true); 
     console.log("molblock 3D:\n", mol.get_molblock().substring(0, 200));
  } catch (e) {
     console.log("error", e.message);
  }
});
