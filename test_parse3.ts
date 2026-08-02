import fs from 'fs';
const text = fs.readFileSync("1HVR.pdb", "utf-8");
const lines = text.split('\n');
let smtry = 0;
let biomt = 0;
for (const line of lines) {
  if (line.startsWith("REMARK 290   SMTRY")) smtry++;
  if (line.startsWith("REMARK 350   BIOMT")) biomt++;
}
console.log("SMTRY:", smtry, "BIOMT:", biomt);
