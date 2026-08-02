const line = "HELIX    1  HA GLY A   86  GLY A   94  1                                   9    ";
const chain = line.substring(19, 20); // initChainID
const startRes = parseInt(line.substring(21, 25).trim());
const endChain = line.substring(31, 32); // endChainID
const endRes = parseInt(line.substring(33, 37).trim());
console.log(`chain: ${chain}, start: ${startRes}, endChain: ${endChain}, end: ${endRes}`);
