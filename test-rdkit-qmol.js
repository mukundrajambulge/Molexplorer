import initRDKitModule from "@rdkit/rdkit";
initRDKitModule().then((RDKit) => {
  try {
    const qmol = RDKit.get_qmol("[C@],[C@@]");
    console.log("qmol success");
  } catch(e) {
    console.log("error", e.message);
  }
});
