function sub(a, b) { return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z }; }
function cross(a, b) {
  return { x: a.y * b.z - a.z * b.y, y: a.z * b.x - a.x * b.z, z: a.x * b.y - a.y * b.x };
}
function dot(a, b) { return a.x * b.x + a.y * b.y + a.z * b.z; }
function norm(a) { return Math.sqrt(dot(a, a)); }

function dihedralWiki(p1, p2, p3, p4) {
  const b1 = sub(p2, p1);
  const b2 = sub(p3, p2);
  const b3 = sub(p4, p3);

  const n1 = cross(b1, b2);
  const n2 = cross(b2, b3);

  const n1xn2 = cross(n1, n2);
  
  const x = dot(n1, n2);
  const y = dot(n1xn2, b2) / norm(b2);

  return Math.atan2(y, x) * 180 / Math.PI;
}

const p1 = { x: 0, y: 1, z: 0 };
const p2 = { x: 0, y: 0, z: 0 };
const p3 = { x: 1, y: 0, z: 0 };
const p4 = { x: 1, y: 0, z: 1 };

console.log('Result Wiki:', dihedralWiki(p1, p2, p3, p4));
