import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';

interface MolecularCanvasProps {
  scrollProgress: number; // 0.0 to 1.0
}

export const MolecularCanvas: React.FC<MolecularCanvasProps> = ({ scrollProgress }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef(scrollProgress);
  scrollRef.current = scrollProgress;

  useEffect(() => {
    if (!containerRef.current) return;
    const container = containerRef.current;

    // Check reduced motion preference
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // 1. Scene & Perspective Camera Setup
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(
      40,
      container.clientWidth / container.clientHeight,
      0.1,
      1000
    );
    camera.position.set(0, 0, 22);

    // 2. High-performance WebGL Renderer
    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance'
    });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;
    container.appendChild(renderer.domElement);

    // 3. Realistic Molecular Lighting Rig
    const ambientLight = new THREE.AmbientLight(0xffffff, 1.4);
    scene.add(ambientLight);

    const keyLight = new THREE.DirectionalLight(0x00f2ff, 3.5);
    keyLight.position.set(15, 20, 20);
    scene.add(keyLight);

    const fillLight = new THREE.DirectionalLight(0xf59e0b, 2.8);
    fillLight.position.set(-15, -12, 12);
    scene.add(fillLight);

    const rimLight = new THREE.PointLight(0xa855f7, 3.0, 60);
    rimLight.position.set(0, 16, -10);
    scene.add(rimLight);

    const backGlow = new THREE.PointLight(0x06b6d4, 1.8, 40);
    backGlow.position.set(0, -10, -5);
    scene.add(backGlow);

    // 4. Central Molecular Structure (Bioactive Heterocyclic Core)
    const moleculeGroup = new THREE.Group();
    scene.add(moleculeGroup);

    // Conventional CPK Element Colors
    const atomColors: Record<string, number> = {
      C: 0x475569, // Carbon (Slate)
      N: 0x06b6d4, // Nitrogen (Cyan)
      O: 0xef4444, // Oxygen (Crimson)
      S: 0xf59e0b, // Sulfur (Amber)
      H: 0xf8fafc, // Hydrogen (Ice White)
      F: 0x10b981, // Fluorine (Emerald)
      Cl: 0x22c55e // Chlorine (Green)
    };

    // Realistic multi-ring kinase inhibitor bioactive scaffold
    const rawAtoms = [
      // Core Pyrimidine Ring A
      { x: 0.0, y: 0.0, z: 0.0, elem: 'C' },
      { x: 1.4, y: 0.0, z: 0.0, elem: 'N' },
      { x: 2.1, y: 1.2, z: 0.0, elem: 'C' },
      { x: 1.4, y: 2.4, z: 0.0, elem: 'N' },
      { x: 0.0, y: 2.4, z: 0.0, elem: 'C' },
      { x: -0.7, y: 1.2, z: 0.0, elem: 'C' },

      // Fused Imidazole Ring B
      { x: 3.5, y: 1.2, z: 0.1, elem: 'N' },
      { x: 4.3, y: 2.3, z: 0.2, elem: 'C' },
      { x: 3.5, y: 3.4, z: 0.1, elem: 'N' },
      { x: 2.1, y: 2.4, z: 0.0, elem: 'C' },

      // Substituted Aromatic Phenyl Ring C
      { x: -2.1, y: 1.2, z: 0.1, elem: 'N' },
      { x: -3.0, y: 2.3, z: 0.2, elem: 'C' },
      { x: -4.4, y: 2.1, z: 0.3, elem: 'C' },
      { x: -5.2, y: 3.2, z: 0.4, elem: 'C' },
      { x: -4.6, y: 4.5, z: 0.3, elem: 'C' },
      { x: -3.2, y: 4.7, z: 0.2, elem: 'C' },
      { x: -2.4, y: 3.6, z: 0.1, elem: 'C' },

      // Fluorine & Methyl substituents
      { x: -5.0, y: 0.8, z: 0.4, elem: 'F' },
      { x: -5.4, y: 5.7, z: 0.4, elem: 'C' },
      { x: -6.7, y: 5.5, z: 0.5, elem: 'F' },

      // Secondary Amide Bridge & Heterocycle Tail
      { x: 5.7, y: 2.3, z: 0.3, elem: 'C' },
      { x: 6.4, y: 3.4, z: 0.4, elem: 'O' },
      { x: 6.3, y: 1.1, z: 0.3, elem: 'N' },
      { x: 7.7, y: 1.1, z: 0.5, elem: 'C' },
      { x: 8.4, y: -0.1, z: 0.6, elem: 'C' },
      { x: 9.8, y: -0.1, z: 0.7, elem: 'N' },
      { x: 10.5, y: 1.1, z: 0.7, elem: 'C' },
      { x: 9.8, y: 2.3, z: 0.6, elem: 'C' },
      { x: 8.4, y: 2.3, z: 0.5, elem: 'C' },

      // Methyl on Piperazine Tail
      { x: 10.5, y: -1.3, z: 0.8, elem: 'C' },

      // Terminal Solubilizing Hydroxy / Oxygen
      { x: -0.7, y: -1.2, z: -0.1, elem: 'O' },
      { x: -2.1, y: -1.3, z: -0.1, elem: 'C' },
      { x: -2.8, y: -2.5, z: -0.2, elem: 'S' },
      { x: -1.5, y: -3.5, z: -0.2, elem: 'C' },
      { x: -0.2, y: -2.7, z: -0.1, elem: 'N' }
    ];

    // Center the molecule centroid at (0,0,0)
    let avgX = 0, avgY = 0, avgZ = 0;
    rawAtoms.forEach(a => { avgX += a.x; avgY += a.y; avgZ += a.z; });
    avgX /= rawAtoms.length; avgY /= rawAtoms.length; avgZ /= rawAtoms.length;
    const atoms = rawAtoms.map(a => ({
      x: a.x - avgX,
      y: a.y - avgY,
      z: a.z - avgZ,
      elem: a.elem
    }));

    // Atom Sphere Meshes with high-quality materials
    const sphereGeo = new THREE.SphereGeometry(0.52, 32, 32);

    atoms.forEach((atom) => {
      const color = atomColors[atom.elem] || 0x06b6d4;
      const mat = new THREE.MeshStandardMaterial({
        color: color,
        roughness: 0.22,
        metalness: 0.20
      });
      const sphere = new THREE.Mesh(sphereGeo, mat);
      sphere.position.set(atom.x, atom.y, atom.z);
      moleculeGroup.add(sphere);
    });

    // Bond Cylinders connecting adjacent atoms (distance threshold 0.8 - 1.95 Å)
    const bondMat = new THREE.MeshStandardMaterial({
      color: 0x94a3b8,
      roughness: 0.35,
      metalness: 0.35
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

    // 5. Floating Ambient Particle Starfield
    const particleCount = 60;
    const particleGeo = new THREE.BufferGeometry();
    const particlePos = new Float32Array(particleCount * 3);
    for (let i = 0; i < particleCount * 3; i++) {
      particlePos[i] = (Math.random() - 0.5) * 45;
    }
    particleGeo.setAttribute('position', new THREE.BufferAttribute(particlePos, 3));
    const particleMat = new THREE.PointsMaterial({
      size: 0.14,
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.5
    });
    const particles = new THREE.Points(particleGeo, particleMat);
    scene.add(particles);

    // 6. Micro Cursor Interaction Variables
    let mouseX = 0;
    let mouseY = 0;
    let targetMouseX = 0;
    let targetMouseY = 0;

    const handleMouseMove = (e: MouseEvent) => {
      const rect = container.getBoundingClientRect();
      const x = (e.clientX - rect.left - rect.width / 2) / (rect.width / 2);
      const y = (e.clientY - rect.top - rect.height / 2) / (rect.height / 2);
      targetMouseX = x;
      targetMouseY = y;
    };

    window.addEventListener('mousemove', handleMouseMove, { passive: true });

    // 7. Responsive Resizing
    const handleResize = () => {
      if (!container) return;
      camera.aspect = container.clientWidth / container.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(container.clientWidth, container.clientHeight);
    };

    window.addEventListener('resize', handleResize);

    // 8. Deterministic Camera Path Timeline Interpolation
    // Maps scroll progress (0.0 to 1.0) to smooth 3D camera coordinates and molecule orientation
    const getCameraTrajectory = (t: number) => {
      // Clamped [0, 1]
      const progress = Math.max(0, Math.min(1, t));

      let posX = 0, posY = 0, posZ = 22;
      let targetX = 0, targetY = 0, targetZ = 0;
      let rotX = 0, rotY = 0, rotZ = 0;
      let molPosX = 0, molPosY = 0;

      if (progress <= 0.25) {
        // Phase 1 (Hero Orientation: 0% -> 25%)
        const f = progress / 0.25;
        posX = THREE.MathUtils.lerp(0, 2.0, f);
        posY = THREE.MathUtils.lerp(0, 1.0, f);
        posZ = THREE.MathUtils.lerp(22, 17, f);
        rotY = THREE.MathUtils.lerp(0, 0.4, f);
        molPosX = THREE.MathUtils.lerp(0, 0.5, f);
      } else if (progress <= 0.50) {
        // Phase 2 (Close Inspection Zoom: 25% -> 50%)
        const f = (progress - 0.25) / 0.25;
        posX = THREE.MathUtils.lerp(2.0, -3.5, f);
        posY = THREE.MathUtils.lerp(1.0, 2.5, f);
        posZ = THREE.MathUtils.lerp(17, 13, f);
        rotY = THREE.MathUtils.lerp(0.4, 1.2, f);
        rotX = THREE.MathUtils.lerp(0, 0.3, f);
        molPosX = THREE.MathUtils.lerp(0.5, 1.5, f);
      } else if (progress <= 0.75) {
        // Phase 3 (Orbit Flyaround & Shift Right for Content: 50% -> 75%)
        const f = (progress - 0.50) / 0.25;
        posX = THREE.MathUtils.lerp(-3.5, -6.5, f);
        posY = THREE.MathUtils.lerp(2.5, -1.0, f);
        posZ = THREE.MathUtils.lerp(13, 18, f);
        targetX = THREE.MathUtils.lerp(0, -2.5, f);
        rotY = THREE.MathUtils.lerp(1.2, 2.2, f);
        rotZ = THREE.MathUtils.lerp(0, 0.2, f);
        molPosX = THREE.MathUtils.lerp(1.5, 4.2, f);
        molPosY = THREE.MathUtils.lerp(0, -0.5, f);
      } else {
        // Phase 4 (Wide Research & Platform Climax: 75% -> 100%)
        const f = (progress - 0.75) / 0.25;
        posX = THREE.MathUtils.lerp(-6.5, 0, f);
        posY = THREE.MathUtils.lerp(-1.0, 2.0, f);
        posZ = THREE.MathUtils.lerp(18, 24, f);
        targetX = THREE.MathUtils.lerp(-2.5, 0, f);
        rotY = THREE.MathUtils.lerp(2.2, 3.14, f);
        molPosX = THREE.MathUtils.lerp(4.2, 0, f);
        molPosY = THREE.MathUtils.lerp(-0.5, 0, f);
      }

      return { posX, posY, posZ, targetX, targetY, targetZ, rotX, rotY, rotZ, molPosX, molPosY };
    };

    // 9. Smooth Animation & Interaction Loop
    let animationId: number;
    let currentCamPos = new THREE.Vector3(0, 0, 22);
    let currentCamTarget = new THREE.Vector3(0, 0, 0);
    let currentMolPos = new THREE.Vector2(0, 0);
    let baseRotationY = 0;

    const animate = () => {
      animationId = requestAnimationFrame(animate);

      // Micro cursor parallax interpolation
      mouseX += (targetMouseX - mouseX) * 0.06;
      mouseY += (targetMouseY - mouseY) * 0.06;

      // Base rotation (gentle continuous spin unless reduced motion)
      if (!prefersReducedMotion) {
        baseRotationY += 0.004;
      }

      // Macro scroll trajectory
      const traj = getCameraTrajectory(scrollRef.current);

      // Interpolate camera target coordinates
      currentCamPos.x += (traj.posX + mouseX * 1.5 - currentCamPos.x) * 0.08;
      currentCamPos.y += (traj.posY - mouseY * 1.5 - currentCamPos.y) * 0.08;
      currentCamPos.z += (traj.posZ - currentCamPos.z) * 0.08;
      camera.position.copy(currentCamPos);

      currentCamTarget.x += (traj.targetX - currentCamTarget.x) * 0.08;
      currentCamTarget.y += (traj.targetY - currentCamTarget.y) * 0.08;
      currentCamTarget.z += (traj.targetZ - currentCamTarget.z) * 0.08;
      camera.lookAt(currentCamTarget);

      // Interpolate molecule group shift & rotation
      currentMolPos.x += (traj.molPosX - currentMolPos.x) * 0.08;
      currentMolPos.y += (traj.molPosY - currentMolPos.y) * 0.08;
      moleculeGroup.position.set(currentMolPos.x, currentMolPos.y, 0);

      moleculeGroup.rotation.y = baseRotationY + traj.rotY + mouseX * 0.35;
      moleculeGroup.rotation.x = traj.rotX + mouseY * 0.35;
      moleculeGroup.rotation.z = traj.rotZ;

      // Subtle particle float
      particles.rotation.y -= 0.0008;

      renderer.render(scene, camera);
    };

    animate();

    // 10. Clean Cleanup
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
    <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
      {/* 3D WebGL Canvas Viewport */}
      <div ref={containerRef} className="w-full h-full" />
    </div>
  );
};
