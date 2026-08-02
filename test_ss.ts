const lines = [
  "HELIX    1  HA GLY A   86  GLY A   94  1                                   9    ",
  "SHEET    1 COA 8 LYS A  43  GLY A  49  0                                        "
];
for (const line of lines) {
  if (line.startsWith("HELIX ")) {
      const chain = line.substring(19, 20); // initChainID
      const startRes = parseInt(line.substring(21, 25).trim());
      const endChain = line.substring(31, 32); // endChainID
      const endRes = parseInt(line.substring(33, 37).trim());
      console.log(`HELIX chain ${chain} ${startRes} to ${endChain} ${endRes}`);
  } else if (line.startsWith("SHEET ")) {
      const chain = line.substring(21, 22); // initChainID
      const startRes = parseInt(line.substring(22, 26).trim());
      const endChain = line.substring(32, 33); // endChainID
      const endRes = parseInt(line.substring(33, 37).trim());
      console.log(`SHEET chain ${chain} ${startRes} to ${endChain} ${endRes}`);
  }
}
