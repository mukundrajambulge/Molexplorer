import React, { useEffect, useRef, useState } from 'react';
import { WebGPURaytracer } from '../rendering/webgpu/Raytracer';
import type { Atom } from '../lib/MolProcessor';
import { X, Zap, Cpu } from 'lucide-react';

interface RaytraceViewerProps {
  atoms: Atom[];
  onClose: () => void;
}

export default function RaytraceViewer({ atoms, onClose }: RaytraceViewerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [status, setStatus] = useState<'checking' | 'rendering' | 'done'>('checking');
  const [engineType, setEngineType] = useState<'WebGPU Hardware' | 'Software Raytracer (WebGL/Canvas)'>('WebGPU Hardware');
  const raytracerRef = useRef<WebGPURaytracer | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      if (!canvasRef.current) return;
      const W = canvasRef.current.offsetWidth || 800;
      const H = canvasRef.current.offsetHeight || 600;
      canvasRef.current.width = W;
      canvasRef.current.height = H;

      const rt = new WebGPURaytracer({ width: W, height: H });
      raytracerRef.current = rt;

      await rt.initialize();

      if (cancelled) return;

      setEngineType(rt.isSoftwareMode ? 'Software Raytracer (WebGL/Canvas)' : 'WebGPU Hardware');
      setStatus('rendering');

      const atomSubset = atoms.slice(0, 3000);
      await rt.render(atomSubset, canvasRef.current!);

      if (!cancelled) setStatus('done');
    }

    run();
    return () => {
      cancelled = true;
      raytracerRef.current?.destroy();
    };
  }, [atoms]);

  return (
    <div className="absolute inset-0 z-40 flex flex-col bg-[#050508]/95 backdrop-blur-md">
      {/* Top Bar */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-white/10 bg-white/5">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-emerald-500/20 flex items-center justify-center text-emerald-400">
            {engineType.includes('WebGPU') ? <Zap size={18} /> : <Cpu size={18} />}
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-semibold text-white tracking-wide">Photorealistic Raytracer</span>
            <span className="text-[11px] text-white/50 font-mono">Engine: {engineType}</span>
          </div>
          <span className={`ml-3 text-[10px] font-mono px-2.5 py-0.5 rounded-full border ${
            status === 'rendering' ? 'bg-amber-500/20 text-amber-400 border-amber-500/30 animate-pulse' :
            status === 'done' ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' :
            'bg-white/10 text-white/50 border-white/10'
          }`}>
            {status === 'checking' ? 'Initializing...' :
             status === 'rendering' ? 'Tracing Rays...' : 'Render Complete ✓'}
          </span>
        </div>
        
        <button onClick={onClose} className="p-2 rounded-lg text-white/50 hover:text-white hover:bg-white/10 transition-colors cursor-pointer">
          <X size={18} />
        </button>
      </div>

      {/* Main Render Viewport */}
      <div className="flex-1 relative flex items-center justify-center overflow-hidden">
        <canvas
          ref={canvasRef}
          className="w-full h-full object-contain"
        />
        {status === 'rendering' && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/40 backdrop-blur-[2px]">
            <div className="text-center space-y-3 bg-black/80 p-6 rounded-2xl border border-white/10 shadow-2xl">
              <div className="w-10 h-10 border-2 border-emerald-400/30 border-t-emerald-400 rounded-full animate-spin mx-auto"></div>
              <p className="text-xs text-white/80 font-mono">Tracing ray intersections & Phong shading...</p>
              <p className="text-[10px] text-white/40 font-mono">{Math.min(atoms.length, 3000).toLocaleString()} spheres processed</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
