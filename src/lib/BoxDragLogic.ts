export function handleBoxPointerDown(e: any, viewer: any, dockingBox: any, onDockingBoxChange: any, dragState: any) {
  if (!dockingBox || !viewer || !onDockingBoxChange) return false;
  
  const rect = viewer.renderer.domElement.getBoundingClientRect();
  const mx = e.clientX - rect.left;
  const my = e.clientY - rect.top;
  
  const { center, size } = dockingBox;
  const hx = size.x / 2, hy = size.y / 2, hz = size.z / 2;
  const corners3d = [
    { x: center.x - hx, y: center.y - hy, z: center.z - hz },
    { x: center.x + hx, y: center.y - hy, z: center.z - hz },
    { x: center.x + hx, y: center.y + hy, z: center.z - hz },
    { x: center.x - hx, y: center.y + hy, z: center.z - hz },
    { x: center.x - hx, y: center.y - hy, z: center.z + hz },
    { x: center.x + hx, y: center.y - hy, z: center.z + hz },
    { x: center.x + hx, y: center.y + hy, z: center.z + hz },
    { x: center.x - hx, y: center.y + hy, z: center.z + hz }
  ];
  
  const corners2d = viewer.modelToScreen(corners3d);
  
  let closestDist = Infinity;
  let closestCornerIdx = -1;
  corners2d.forEach((c2d: any, idx: number) => {
     const dx = c2d.x - mx;
     const dy = c2d.y - my;
     const dist = Math.sqrt(dx*dx + dy*dy);
     if (dist < closestDist) {
        closestDist = dist;
        closestCornerIdx = idx;
     }
  });
  
  let mode = 'none';
  if (closestDist < 30) {
     mode = 'resize';
  } else {
     let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
     corners2d.forEach((c2d: any) => {
        if (c2d.x < minX) minX = c2d.x;
        if (c2d.x > maxX) maxX = c2d.x;
        if (c2d.y < minY) minY = c2d.y;
        if (c2d.y > maxY) maxY = c2d.y;
     });
     if (mx >= minX && mx <= maxX && my >= minY && my <= maxY) {
        mode = 'move';
     }
  }
  
  if (mode !== 'none') {
     dragState.current = {
       active: true,
       mode,
       cornerIdx: closestCornerIdx,
       startX: mx,
       startY: my,
       startBox: JSON.parse(JSON.stringify(dockingBox)),
       // Project axes to screen to know how dragging maps to 3D movement
       axes2d: getAxes2D(viewer, center)
     };
     return true; // We handled it
  }
  return false;
}

export function handleBoxPointerMove(e: any, viewer: any, onDockingBoxChange: any, dragState: any) {
  if (!dragState.current.active) return false;
  
  const rect = viewer.renderer.domElement.getBoundingClientRect();
  const mx = e.clientX - rect.left;
  const my = e.clientY - rect.top;
  
  const dx = mx - dragState.current.startX;
  const dy = my - dragState.current.startY;
  
  const { mode, startBox, axes2d, cornerIdx } = dragState.current;
  const newBox = JSON.parse(JSON.stringify(startBox));
  
  const projectToAxis = (dx: number, dy: number, axis: any) => {
     const magSq = axis.x * axis.x + axis.y * axis.y;
     if (magSq === 0) return 0;
     return (dx * axis.x + dy * axis.y) / magSq;
  };
  
  // Convert 2D pixel drag to 3D movement (scale down because 1 pixel != 1 Angstrom)
  // Let's approximate: the length of axes2d gives the pixel length of 1 Angstrom.
  const getMove3D = (dx: number, dy: number) => {
     return {
        x: projectToAxis(dx, dy, axes2d.x),
        y: projectToAxis(dx, dy, axes2d.y),
        z: projectToAxis(dx, dy, axes2d.z)
     };
  };
  
  const move3D = getMove3D(dx, dy);
  
  if (mode === 'move') {
     newBox.center.x += move3D.x;
     newBox.center.y += move3D.y;
     newBox.center.z += move3D.z;
  } else if (mode === 'resize') {
     // Based on which corner, the drag modifies size and center.
     // Corners:
     // 0: -x, -y, -z
     // 1: +x, -y, -z
     // 2: +x, +y, -z
     // 3: -x, +y, -z
     // 4: -x, -y, +z
     // 5: +x, -y, +z
     // 6: +x, +y, +z
     // 7: -x, +y, +z
     
     const signs = [
        { x:-1, y:-1, z:-1 },
        { x: 1, y:-1, z:-1 },
        { x: 1, y: 1, z:-1 },
        { x:-1, y: 1, z:-1 },
        { x:-1, y:-1, z: 1 },
        { x: 1, y:-1, z: 1 },
        { x: 1, y: 1, z: 1 },
        { x:-1, y: 1, z: 1 }
     ];
     const s = signs[cornerIdx];
     
     // The corner moved by move3D. 
     // Size changes by move3D * sign.
     // Center changes by move3D / 2.
     newBox.size.x = Math.max(1, startBox.size.x + move3D.x * s.x);
     newBox.size.y = Math.max(1, startBox.size.y + move3D.y * s.y);
     newBox.size.z = Math.max(1, startBox.size.z + move3D.z * s.z);
     
     newBox.center.x = startBox.center.x + (move3D.x * s.x > -startBox.size.x ? move3D.x / 2 : 0);
     newBox.center.y = startBox.center.y + (move3D.y * s.y > -startBox.size.y ? move3D.y / 2 : 0);
     newBox.center.z = startBox.center.z + (move3D.z * s.z > -startBox.size.z ? move3D.z / 2 : 0);
  }
  
  onDockingBoxChange(newBox);
  return true;
}

export function handleBoxPointerUp(dragState: any) {
  if (dragState.current.active) {
     dragState.current.active = false;
     return true;
  }
  return false;
}

function getAxes2D(viewer: any, center: {x: number, y: number, z: number}) {
   const c2d = viewer.modelToScreen(center);
   const x2d = viewer.modelToScreen({ x: center.x + 1, y: center.y, z: center.z });
   const y2d = viewer.modelToScreen({ x: center.x, y: center.y + 1, z: center.z });
   const z2d = viewer.modelToScreen({ x: center.x, y: center.y, z: center.z + 1 });
   
   return {
      x: { x: x2d.x - c2d.x, y: x2d.y - c2d.y },
      y: { x: y2d.x - c2d.x, y: y2d.y - c2d.y },
      z: { x: z2d.x - c2d.x, y: z2d.y - c2d.y }
   };
}
