const line = "SHEET    1 COA 8 LYS A  43  GLY A  49  0                                        ";
const chain = line.substring(21, 22); // initChainID
const startRes = parseInt(line.substring(22, 26).trim());
const endChain = line.substring(32, 33); // endChainID
const endRes = parseInt(line.substring(33, 37).trim());
console.log(`SHEET chain: '${chain}', start: ${startRes}, endChain: '${endChain}', end: ${endRes}`);
