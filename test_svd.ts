import { Matrix, SingularValueDecomposition } from 'ml-matrix';
const A = new Matrix([[1, 2, 3], [4, 5, 6], [7, 8, 9]]);
const svd = new SingularValueDecomposition(A);
const U = svd.leftSingularVectors;
const V = svd.rightSingularVectors;
const S = svd.diagonalMatrix;
console.log(U.to2DArray());
console.log(S.to2DArray());
console.log(V.to2DArray());
