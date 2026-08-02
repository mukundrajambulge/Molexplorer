const lines = [
  "REMARK 350 APPLY THE FOLLOWING TO CHAINS: A, B, AND C",
  "REMARK 350 APPLY THE FOLLOWING TO CHAINS: A",
  "REMARK 350 APPLY THE FOLLOWING TO CHAINS: A, B"
];
for(const line of lines) {
  const chainsPart = line.substring(41).trim();
  const chains = chainsPart.split(/[, ]+/).filter(s => s && s !== 'AND');
  console.log(chains);
}
