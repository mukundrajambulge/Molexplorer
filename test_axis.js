const dx = 10, dy = 5;
const ax = { x: 5, y: 0 }; // X axis vector on screen
const ay = { x: 0, y: 5 }; // Y axis vector on screen
const az = { x: 3, y: 4 }; // Z axis vector on screen

function projectToAxis(dx, dy, axis) {
   const magSq = axis.x * axis.x + axis.y * axis.y;
   if (magSq === 0) return 0;
   return (dx * axis.x + dy * axis.y) / Math.sqrt(magSq); 
}
console.log(projectToAxis(dx, dy, ax));
console.log(projectToAxis(dx, dy, ay));
