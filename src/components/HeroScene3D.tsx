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
      45,
      container.clientWidth / container.clientHeight,
      0.1,
      1000
    );
    camera.position.set(0, 0, 32);

    // 2. WebGL Renderer
    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance'
    });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.2;
    container.appendChild(renderer.domElement);

    // 3. Lighting
    const ambientLight = new THREE.AmbientLight(0x0f172a, 2.5);
    scene.add(ambientLight);

    const cyanLight = new THREE.PointLight(0x00f2ff, 4, 60);
    cyanLight.position.set(15, 12, 18);
    scene.add(cyanLight);

    const amberLight = new THREE.PointLight(0xf27d26, 3.5, 60);
    amberLight.position.set(-15, -12, 15);
    scene.add(amberLight);

    const violetLight = new THREE.PointLight(0x8b5cf6, 2.5, 50);
    violetLight.position.set(0, 18, -10);
    scene.add(violetLight);

    // 4. Floating Molecule Group
    const moleculeGroup = new THREE.Group();
    scene.add(moleculeGroup);

    // Element Colors & Radii
    const atomColors: Record<string, number> = {
      C: 0x334155, // Dark slate
      N: 0x00f2ff, // Neon Cyan
      O: 0xef4444, // Crimson Red
      S: 0xf59e0b, // Amber Gold
      H: 0xe2e8f0, // Silver Ice
      P: 0x8b5cf6  // Violet Purple
    };

    // Procedural Complex Molecule Coordinates (Macrocycle / Peptide Mimic)
    const atomData: { x: number; y: number; z: number; elem: string }[] = [];
    const numAtoms = 48;
    for (let i = 0; i < numAtoms; i++) {
      const theta = (i / numAtoms) * Math.PI * 4;
      const phi = (i / numAtoms) * Math.PI * 2;
      const r = 5.5 + Math.sin(phi * 3) * 1.8;
      
      const x = Math.cos(theta) * r;
      const y = (i - numAtoms / 2) * 0.35 + Math.sin(theta * 2) * 1.5;
      const z = Math.sin(theta) * r + Math.cos(phi * 2) * 1.2;

      let elem = 'C';
      if (i % 4 === 0) elem = 'N';
      else if (i % 5 === 0) elem = 'O';
      else if (i % 7 === 0) elem = 'S';
      else if (i % 9 === 0) elem = 'P';
      else if (i % 3 === 0) elem = 'H';

      atomData.push({ x, y, z, elem });
    }

    // Atom Meshes
    const sphereGeo = new THREE.SphereGeometry(0.55, 32, 32);
    const smallSphereGeo = new THREE.SphereGeometry(0.35, 24, 24);

    atomData.forEach((atom) => {
      const isH = atom.elem === 'H';
      const color = atomColors[atom.elem] || 0x38bdf8;
      
      const mat = new THREE.MeshPhysicalMaterial({
        color: color,
        emissive: color,
        emissiveIntensity: atom.elem === 'N' || atom.elem === 'S' || atom.elem === 'P' ? 0.35 : 0.08,
        roughness: 0.15,
        metalness: 0.1,
        clearcoat: 1.0,
        clearcoatRoughness: 0.1,
        transmission: 0.3,
        ior: 1.4
      });

      const mesh = new THREE.Mesh(isH ? smallSphereGeo : sphereGeo, mat);
      mesh.position.set(atom.x, atom.y, atom.z);
      moleculeGroup.add(mesh);
    });

    // Bond Cylinders connecting adjacent atoms
    const bondMat = new THREE.MeshPhysicalMaterial({
      color: 0x64748b,
      metalness: 0.8,
      roughness: 0.2,
      clearcoat: 0.8
    });

    for (let i = 0; i < atomData.length - 1; i++) {
      const a1 = atomData[i];
      const a2 = atomData[i + 1];
      const p1 = new THREE.Vector3(a1.x, a1.y, a1.z);
      const p2 = new THREE.Vector3(a2.x, a2.y, a2.z);
      const dist = p1.distanceTo(p2);

      if (dist < 4.5) {
        const bondGeo = new THREE.CylinderGeometry(0.12, 0.12, dist, 12);
        const bond = new THREE.Mesh(bondGeo, bondMat);

        const midpoint = new THREE.Vector3().addVectors(p1, p2).multiplyScalar(0.5);
        bond.position.copy(midpoint);

        const dir = new THREE.Vector3().subVectors(p2, p1).normalize();
        const axis = new THREE.Vector3(0, 1, 0);
        bond.quaternion.setFromUnitVectors(axis, dir);

        moleculeGroup.add(bond);
      }
    }

    // 5. DNA Helical Satellite Ring
    const helixGroup = new THREE.Group();
    scene.add(helixGroup);

    const helixPoints = 120;
    const strand1Geo = new THREE.BufferGeometry();
    const strand2Geo = new THREE.BufferGeometry();
    const strand1Pos: number[] = [];
    const strand2Pos: number[] = [];

    for (let i = 0; i < helixPoints; i++) {
      const t = (i / helixPoints) * Math.PI * 6;
      const hR = 9.0;
      const hY = (i - helixPoints / 2) * 0.22;

      const x1 = Math.cos(t) * hR;
      const z1 = Math.sin(t) * hR;
      strand1Pos.push(x1, hY, z1);

      const x2 = Math.cos(t + Math.PI) * hR;
      const z2 = Math.sin(t + Math.PI) * hR;
      strand2Pos.push(x2, hY, z2);

      // Base pairs every 6 points
      if (i % 6 === 0) {
        const rungMat = new THREE.LineBasicMaterial({
          color: i % 12 === 0 ? 0x00f2ff : 0xf27d26,
          transparent: true,
          opacity: 0.6
        });
        const rungGeo = new THREE.BufferGeometry().setFromPoints([
          new THREE.Vector3(x1, hY, z1),
          new THREE.Vector3(x2, hY, z2)
        ]);
        const rung = new THREE.Line(rungGeo, rungMat);
        helixGroup.add(rung);
      }
    }

    strand1Geo.setAttribute('position', new THREE.Float32BufferAttribute(strand1Pos, 3));
    strand2Geo.setAttribute('position', new THREE.Float32BufferAttribute(strand2Pos, 3));

    const lineMat1 = new THREE.LineBasicMaterial({ color: 0x00f2ff, transparent: true, opacity: 0.75 });
    const lineMat2 = new THREE.LineBasicMaterial({ color: 0x8b5cf6, transparent: true, opacity: 0.75 });

    helixGroup.add(new THREE.Line(strand1Geo, lineMat1));
    helixGroup.add(new THREE.Line(strand2Geo, lineMat2));
    helixGroup.rotation.x = 0.4;
    helixGroup.rotation.z = -0.3;

    // 6. Ambient Particle Cloud (Atom Dust)
    const particleCount = 280;
    const particleGeo = new THREE.BufferGeometry();
    const particlePos = new Float32Array(particleCount * 3);
    const particleScales = new Float32Array(particleCount);

    for (let i = 0; i < particleCount; i++) {
      particlePos[i * 3] = (Math.random() - 0.5) * 60;
      particlePos[i * 3 + 1] = (Math.random() - 0.5) * 40;
      particlePos[i * 3 + 2] = (Math.random() - 0.5) * 40;
      particleScales[i] = Math.random() * 2 + 0.5;
    }

    particleGeo.setAttribute('position', new THREE.BufferAttribute(particlePos, 3));

    // Particle Material with Soft Glow
    const particleMat = new THREE.PointsMaterial({
      color: 0x00f2ff,
      size: 0.35,
      transparent: true,
      opacity: 0.65,
      blending: THREE.AdditiveBlending
    });

    const particles = new THREE.Points(particleGeo, particleMat);
    scene.add(particles);

    // 7. HUD Target Rings (Decorative 3D Reticle)
    const reticleGroup = new THREE.Group();
    scene.add(reticleGroup);

    const ringGeo = new THREE.RingGeometry(11, 11.08, 64);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0x00f2ff,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.18
    });
    const ringMesh = new THREE.Mesh(ringGeo, ringMat);
    reticleGroup.add(ringMesh);

    const outerRingGeo = new THREE.RingGeometry(13.5, 13.55, 64);
    const outerRingMat = new THREE.MeshBasicMaterial({
      color: 0xf27d26,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.12
    });
    const outerRingMesh = new THREE.Mesh(outerRingGeo, outerRingMat);
    reticleGroup.add(outerRingMesh);

    // 8. Mouse Parallax Tracking
    let mouseX = 0;
    let mouseY = 0;
    let targetX = 0;
    let targetY = 0;

    const handleMouseMove = (event: MouseEvent) => {
      const windowHalfX = window.innerWidth / 2;
      const windowHalfY = window.innerHeight / 2;
      mouseX = (event.clientX - windowHalfX) * 0.0008;
      mouseY = (event.clientY - windowHalfY) * 0.0008;
    };

    window.addEventListener('mousemove', handleMouseMove);

    // 9. Resize Listener
    const handleResize = () => {
      if (!container) return;
      camera.aspect = container.clientWidth / container.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(container.clientWidth, container.clientHeight);
    };

    window.addEventListener('resize', handleResize);

    // 10. Render Loop
    let animationId: number;
    let clock = new THREE.Clock();

    const animate = () => {
      animationId = requestAnimationFrame(animate);
      const delta = clock.getDelta();
      const elapsed = clock.getElapsedTime();

      // Smooth mouse interpolation
      targetX += (mouseX - targetX) * 0.05;
      targetY += (mouseY - targetY) * 0.05;

      // Molecule rotation & organic bobbing
      moleculeGroup.rotation.y += 0.005;
      moleculeGroup.rotation.x = Math.sin(elapsed * 0.5) * 0.2 + targetY * 2;
      moleculeGroup.rotation.z = Math.cos(elapsed * 0.3) * 0.15 + targetX * 2;
      moleculeGroup.position.y = Math.sin(elapsed * 0.8) * 0.8;

      // Helix rotation
      helixGroup.rotation.y -= 0.003;
      helixGroup.rotation.x = 0.4 + Math.sin(elapsed * 0.4) * 0.1;

      // Particles subtle drift
      particles.rotation.y += 0.001;
      particles.rotation.x += 0.0005;

      // Reticle rotation
      ringMesh.rotation.z += 0.002;
      outerRingMesh.rotation.z -= 0.0015;

      // Dynamic light pulsation
      cyanLight.intensity = 4.0 + Math.sin(elapsed * 2) * 1.0;
      amberLight.intensity = 3.5 + Math.cos(elapsed * 1.8) * 0.8;

      renderer.render(scene, camera);
    };

    animate();

    // 11. Cleanup
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
      <div ref={containerRef} className="h-full w-full" />

      {/* Cyber Grid & HUD Vignette Overlays */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_40%,#050508_95%)]" />
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,#050508_0%,transparent_15%,transparent_85%,#050508_100%)]" />

      {/* Live 3D Viewport Telemetry Badge */}
      <div className="pointer-events-none absolute top-4 right-4 flex items-center gap-2 rounded-md border border-cyan-500/20 bg-slate-950/60 px-3 py-1.5 backdrop-blur-md">
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-cyan-400 opacity-75"></span>
          <span className="relative inline-flex h-2 w-2 rounded-full bg-cyan-500"></span>
        </span>
        <span className="font-mono text-[11px] tracking-wider text-cyan-300">WEBGL 3D REAL-TIME</span>
      </div>

      {/* Coordinate HUD Readout */}
      <div className="pointer-events-none absolute bottom-4 left-4 hidden font-mono text-[10px] tracking-widest text-slate-500 sm:block">
        RENDER: THREE.JS ACES-FILMIC | ROTATION: AUTO-ORBIT | PARTICLES: 280
      </div>
    </div>
  );
};
