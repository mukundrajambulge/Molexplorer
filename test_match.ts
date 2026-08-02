const lines = [
"REMARK 350 BIOMOLECULE: 1",
"REMARK 350 APPLY THE FOLLOWING TO CHAINS: A, B",
"REMARK 350   BIOMT1   1  1.000000  0.000000  0.000000        0.00000",
"REMARK 350 BIOMOLECULE: 1                                                       "
];

for (let line of lines) {
  line = line.trimEnd();
  console.log("Line:", line);
  console.log("StartsWith BIOMOLECULE:", line.startsWith("REMARK 350 BIOMOLECULE:"));
  console.log("StartsWith APPLY:", line.startsWith("REMARK 350 APPLY THE FOLLOWING TO CHAINS:"));
  console.log("StartsWith BIOMT:", line.startsWith("REMARK 350   BIOMT"));
}
