import React, { useEffect, useRef, useState } from 'react';
import { WebGPURaytracer } from '../rendering/webgpu/Raytracer';
import type { Atom } from '../lib/MolProcessor';
import { AlertTriangle, X, Zap } from 'lucide-react';

interface RaytraceViewerProps {
  atoms: Atom[];
  onClose: () => void;
}

// WebGPU compatibility warning popup
function WebGPUWarning({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-[#1e1e1e] border border-amber-500/30 rounded-xl shadow-2xl max-w-md w-full p-6 flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-amber-500/20 flex items-center justify-center text-amber-400">
              <AlertTriangle size={22} />
            </div>
            <h2 className="text-base font-semibold text-white">WebGPU Not Supported</h2>
          </div>
          <button onClick={onClose} className="text-white/40 hover:text-white transition-colors cursor-pointer">
            <X size={18} />
          </button>
        </div>

        <div className="text-sm text-white/70 leading-relaxed space-y-2">
          <p>Your current browser does not support <strong className="text-white">WebGPU</strong>, which is required for the photorealistic raytracing feature.</p>
          <p>WebGPU is currently supported in:</p>
          <ul className="list-disc list-inside text-white/60 space-y-1 pl-2">
            <li><strong className="text-white">Google Chrome</strong> v113+ (Desktop)</li>
            <li><strong className="text-white">Microsoft Edge</strong> v113+ (Desktop)</li>
            <li><strong className="text-white">Safari</strong> v18+ (macOS 14+, flag required)</li>
          </ul>
          <p>The standard WebGL renderer is still fully functional. Please upgrade to a supported browser to access WebGPU features.</p>
        </div>

        <div className="flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-amber-500/20 text-amber-400 hover:bg-amber-500/30 text-sm font-semibold transition-colors cursor-pointer border border-amber-500/20"
          >
            Understood
          </button>
        </div>
      </div>
    </div>
  );
}

export default function RaytraceViewer({ atoms, onClose }: RaytraceViewerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [status, setStatus] = useState<'checking' | 'rendering' | 'done' | 'unsupported'>('checking');
  const [showWarning, setShowWarning] = useState(false);
  const raytracerRef = useRef<WebGPURaytracer | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      const supported = await WebGPURaytracer.isSupported();
      if (!supported) {
        if (!cancelled) {
          setStatus('unsupported');
          setShowWarning(true);
        }
        return;
      }

      if (!canvasRef.current) return;
      const W = canvasRef.current.offsetWidth || 800;
      const H = canvasRef.current.offsetHeight || 600;
      canvasRef.current.width = W;
      canvasRef.current.height = H;

      const rt = new WebGPURaytracer({ width: W, height: H });
      raytracerRef.current = rt;

      const ok = await rt.initialize();
      if (!ok || cancelled) {
        setStatus('unsupported');
        setShowWarning(true);
        return;
      }

      setStatus('rendering');

      // Only render a subset of atoms (max 2000 for perf)
      const atomSubset = atoms.slice(0, 2000);
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
    <>
      {showWarning && <WebGPUWarning onClose={() => { setShowWarning(false); onClose(); }} />}

      <div className="absolute inset-0 z-30 flex flex-col bg-black/90 backdrop-blur-sm">
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 bg-white/5">
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 rounded-lg bg-emerald-500/20 flex items-center justify-center text-emerald-400">
              <Zap size={15} />
            </div>
            <span className="text-sm font-semibold text-white">WebGPU Photorealistic Renderer</span>
            <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full ${
              status === 'rendering' ? 'bg-amber-500/20 text-amber-400 animate-pulse' :
              status === 'done' ? 'bg-emerald-500/20 text-emerald-400' :
              status === 'unsupported' ? 'bg-red-500/20 text-red-400' :
              'bg-white/10 text-white/50'
            }`}>
              {status === 'checking' ? 'Checking GPU...' :
               status === 'rendering' ? 'Rendering...' :
               status === 'done' ? 'Done ✓' : 'Unsupported'}
            </span>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg text-white/50 hover:text-white hover:bg-white/10 transition-colors cursor-pointer">
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 relative">
          <canvas
            ref={canvasRef}
            className="w-full h-full"
            style={{ imageRendering: 'pixelated' }}
          />
          {status === 'rendering' && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center space-y-3">
                <div className="w-12 h-12 border-2 border-emerald-400/30 border-t-emerald-400 rounded-full animate-spin mx-auto"></div>
                <p className="text-sm text-white/60 font-mono">Computing ray intersections on GPU...</p>
                <p className="text-xs text-white/30">{Math.min(atoms.length, 2000).toLocaleString()} spheres</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
