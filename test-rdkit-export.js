import initRDKitModule from "@rdkit/rdkit";
initRDKitModule().then((RDKit) => {
  const mol = RDKit.get_mol("CCO");
  console.log("SVG:", mol.get_svg().slice(0, 100));
  console.log("JSON:", mol.get_json().slice(0, 100));
  console.log("Descriptors:", RDKit.get_descriptors ? "yes" : "no");
});
