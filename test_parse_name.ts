const line = "ATOM      1  N   PRO A   1     -12.735  38.918  31.287  1.00 39.83           N  ";
let name = line.substring(12, 16);
console.log(`'${name}'`);
