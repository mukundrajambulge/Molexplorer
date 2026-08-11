import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';

export const HeroScene3D: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const container = containerRef.current;

    // 1. Scene & Camera Setup
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(
      40,
      container.clientWidth / container.clientHeight,
      0.1,
      1000
    );
    camera.position.set(0, 0, 24);

    // 2. High-performance WebGL Renderer
    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance'
    });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.appendChild(renderer.domElement);

    // 3. Balanced Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 1.2);
    scene.add(ambientLight);

    const keyLight = new THREE.DirectionalLight(0x00f2ff, 3.0);
    keyLight.position.set(10, 15, 15);
    scene.add(keyLight);

    const fillLight = new THREE.DirectionalLight(0xf27d26, 2.5);
    fillLight.position.set(-10, -10, 10);
    scene.add(fillLight);

    const rimLight = new THREE.PointLight(0x8b5cf6, 2.0, 40);
    rimLight.position.set(0, 12, -8);
    scene.add(rimLight);

    // 4. Central Molecular Structure (Clean, Elegant Ball-and-Stick Model)
    const moleculeGroup = new THREE.Group();
    scene.add(moleculeGroup);

    // CPK Colors
    const atomColors: Record<string, number> = {
      C: 0x334155, // Carbon (Slate)
      N: 0x00f2ff, // Nitrogen (Cyan)
      O: 0xef4444, // Oxygen (Crimson)
      S: 0xf59e0b, // Sulfur (Amber)
      H: 0xe2e8f0, // Hydrogen (Ice)
      F: 0x10b981  // Fluorine (Emerald)
    };

    // Realistic multi-ring drug molecule geometry (Bioactive heterocyclic scaffold)
    const atoms = [
      // Core Aromatic Ring A
      { x: 0.0, y: 0.0, z: 0.0, elem: 'C' },
      { x: 1.4, y: 0.0, z: 0.0, elem: 'C' },
      { x: 2.1, y: 1.2, z: 0.0, elem: 'N' },
      { x: 1.4, y: 2.4, z: 0.0, elem: 'C' },
      { x: 0.0, y: 2.4, z: 0.0, elem: 'C' },
      { x: -0.7, y: 1.2, z: 0.0, elem: 'C' },

      // Ring B (Fused hetero ring)
      { x: 3.4, y: 1.2, z: 0.2, elem: 'C' },
      { x: 4.1, y: 2.3, z: 0.3, elem: 'O' },
      { x: 3.5, y: 3.4, z: 0.2, elem: 'C' },
      { x: 2.1, y: 3.4, z: 0.1, elem: 'C' },

      // Substituents & Functional Groups
      { x: -2.1, y: 1.2, z: -0.1, elem: 'O' },
      { x: -2.9, y: 2.3, z: -0.2, elem: 'C' },
      { x: -4.3, y: 2.1, z: -0.1, elem: 'F' },
      { x: -2.5, y: 3.6, z: -0.3, elem: 'F' },

      { x: -0.7, y: 3.6, z: 0.1, elem: 'N' },
      { x: -0.3, y: 4.8, z: 0.3, elem: 'C' },
      { x: 1.1, y: 4.8, z: 0.3, elem: 'S' },

      { x: 4.8, y: 4.5, z: 0.4, elem: 'N' },
      { x: 6.0, y: 4.2, z: 0.6, elem: 'C' },
      { x: 6.7, y: 5.3, z: 0.7, elem: 'O' },
      { x: 6.7, y: 2.9, z: 0.6, elem: 'C' },

      // Terminal Chain
      { x: -0.7, y: -1.2, z: 0.1, elem: 'C' },
      { x: -2.1, y: -1.4, z: 0.2, elem: 'N' },
      { x: -2.8, y: -2.6, z: 0.3, elem: 'C' },
      { x: -2.1, y: -3.8, z: 0.2, elem: 'O' },
      { x: -4.3, y: -2.6, z: 0.5, elem: 'C' },
      { x: 2.1, y: -1.2, z: -0.1, elem: 'O' }
    ];

    // Center the molecule at (0, 0, 0)
    let avgX = 0, avgY = 0, avgZ = 0;
    atoms.forEach(a => { avgX += a.x; avgY += a.y; avgZ += a.z; });
    avgX /= atoms.length; avgY /= atoms.length; avgZ /= atoms.length;
    atoms.forEach(a => { a.x -= avgX; a.y -= avgY; a.z -= avgZ; });

    // Sphere Geometry & Materials
    const atomGeo = new THREE.SphereGeometry(0.52, 32, 32);

    atoms.forEach((atom) => {
      const color = atomColors[atom.elem] || 0x38bdf8;
      const mat = new THREE.MeshStandardMaterial({
        color: color,
        roughness: 0.25,
        metalness: 0.15
      });
      const mesh = new THREE.Mesh(atomGeo, mat);
      mesh.position.set(atom.x, atom.y, atom.z);
      moleculeGroup.add(mesh);
    });

    // Bond Cylinders connecting atoms with distance threshold
    const bondMat = new THREE.MeshStandardMaterial({
      color: 0x64748b,
      roughness: 0.3,
      metalness: 0.5
    });

    for (let i = 0; i < atoms.length; i++) {
      for (let j = i + 1; j < atoms.length; j++) {
        const p1 = new THREE.Vector3(atoms[i].x, atoms[i].y, atoms[i].z);
        const p2 = new THREE.Vector3(atoms[j].x, atoms[j].y, atoms[j].z);
        const dist = p1.distanceTo(p2);

        if (dist > 0.8 && dist < 1.95) {
          const bondGeo = new THREE.CylinderGeometry(0.12, 0.12, dist, 16);
          const bond = new THREE.Mesh(bondGeo, bondMat);

          const midpoint = new THREE.Vector3().addVectors(p1, p2).multiplyScalar(0.5);
          bond.position.copy(midpoint);

          const dir = new THREE.Vector3().subVectors(p2, p1).normalize();
          bond.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);

          moleculeGroup.add(bond);
        }
      }
    }

    // 5. Interactive Mouse Rotation & Parallax
    let mouseX = 0;
    let mouseY = 0;
    let targetX = 0;
    let targetY = 0;

    const handleMouseMove = (event: MouseEvent) => {
      const rect = container.getBoundingClientRect();
      const x = event.clientX - rect.left - rect.width / 2;
      const y = event.clientY - rect.top - rect.height / 2;
      mouseX = x * 0.001;
      mouseY = y * 0.001;
    };

    window.addEventListener('mousemove', handleMouseMove);

    // 6. Responsive Resize
    const handleResize = () => {
      if (!container) return;
      camera.aspect = container.clientWidth / container.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(container.clientWidth, container.clientHeight);
    };

    window.addEventListener('resize', handleResize);

    // 7. Smooth Animation Loop
    let animationId: number;
    const animate = () => {
      animationId = requestAnimationFrame(animate);

      targetX += (mouseX - targetX) * 0.05;
      targetY += (mouseY - targetY) * 0.05;

      // Steady, elegant rotation
      moleculeGroup.rotation.y += 0.006;
      moleculeGroup.rotation.x = targetY * 1.5;
      moleculeGroup.rotation.z = targetX * 1.5;

      renderer.render(scene, camera);
    };

    animate();

    // 8. Cleanup
    return () => {
      cancelAnimationFrame(animationId);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('resize', handleResize);
      if (container && renderer.domElement) {
        container.removeChild(renderer.domElement);
      }
      renderer.dispose();
    };
  }, []);

  return (
    <div className="relative h-full w-full">
      {/* 3D WebGL Canvas Container */}
      <div ref={containerRef} className="h-full w-full cursor-grab active:cursor-grabbing" />

      {/* Subtle Bottom Status Line */}
      <div className="pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-2 rounded-full border border-white/10 bg-slate-950/70 px-3 py-1 text-[10px] font-mono text-slate-400 backdrop-blur-md">
        <span className="h-1.5 w-1.5 rounded-full bg-cyan-400 animate-pulse" />
        <span>3D MOLECULAR STRUCTURE PREVIEW</span>
      </div>
    </div>
  );
};
