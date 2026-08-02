import initRDKitModule from "@rdkit/rdkit";
initRDKitModule().then((RDKit) => {
  const mol = RDKit.get_mol("CCO");
  console.log("RDKit version:", RDKit.version());
  
  if (RDKit.version) {
     try {
       console.log(RDKit.get_mol("CCO").get_molblock());
     } catch(e) {}
  }
});
