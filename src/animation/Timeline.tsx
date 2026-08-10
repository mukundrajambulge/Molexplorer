import React, { useState, useEffect, useRef } from 'react';
import { Play, Pause, Square, Plus, Trash2, Camera, Download, X } from 'lucide-react';
import { KeyframeManager, Keyframe } from './KeyframeManager';

interface TimelineProps {
  keyframeManager: KeyframeManager;
  onApplyView: (view: number[]) => void;
  onGetCurrentView: () => number[];
  onRenderMp4: () => void;
  onClose?: () => void;
}

export default function Timeline({ keyframeManager, onApplyView, onGetCurrentView, onRenderMp4, onClose }: TimelineProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(10); // Default 10s timeline
  const [keyframes, setKeyframes] = useState<Keyframe[]>([]);
  const animationRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number>(0);

  useEffect(() => {
    setKeyframes([...keyframeManager.getKeyframes()]);
    const maxK = keyframeManager.getDuration();
    if (maxK > duration) setDuration(Math.max(10, Math.ceil(maxK)));
  }, [keyframeManager]);

  const addKeyframe = () => {
    const view = onGetCurrentView();
    if (view) {
      keyframeManager.addKeyframe(currentTime, view);
      setKeyframes([...keyframeManager.getKeyframes()]);
    }
  };

  const clearKeyframes = () => {
    keyframeManager.clearKeyframes();
    setKeyframes([]);
    setCurrentTime(0);
  };

  const play = () => {
    if (keyframes.length < 2) return;
    setIsPlaying(true);
    lastTimeRef.current = performance.now();
  };

  const pause = () => {
    setIsPlaying(false);
  };

  const stop = () => {
    setIsPlaying(false);
    setCurrentTime(0);
    const view = keyframeManager.interpolate(0);
    if (view) onApplyView(view);
  };

  useEffect(() => {
    if (isPlaying) {
      const loop = (time: number) => {
        const delta = (time - lastTimeRef.current) / 1000;
        lastTimeRef.current = time;

        setCurrentTime((prev) => {
          let nextTime = prev + delta;
          if (nextTime > duration) {
            setIsPlaying(false);
            nextTime = duration;
          }
          const view = keyframeManager.interpolate(nextTime);
          if (view) onApplyView(view);
          return nextTime;
        });

        if (isPlaying) {
          animationRef.current = requestAnimationFrame(loop);
        }
      };
      animationRef.current = requestAnimationFrame(loop);
    }
    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, [isPlaying, duration, keyframeManager, onApplyView]);

  return (
    <div className="absolute bottom-0 left-0 w-full h-32 bg-[#121212]/95 border-t border-white/10 flex flex-col pointer-events-auto backdrop-blur-md z-40">
      
      {/* Top Toolbar */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-white/5 bg-white/5">
        <div className="flex items-center gap-2">
          <button onClick={isPlaying ? pause : play} className="w-8 h-8 flex items-center justify-center rounded-lg bg-[#4A90E2] text-white hover:bg-[#357abd] transition-colors cursor-pointer" title={isPlaying ? "Pause" : "Play"}>
            {isPlaying ? <Pause size={16} /> : <Play size={16} />}
          </button>
          <button onClick={stop} className="w-8 h-8 flex items-center justify-center rounded-lg bg-white/10 text-white/70 hover:text-white hover:bg-white/20 transition-colors cursor-pointer" title="Stop">
            <Square size={14} />
          </button>

          <div className="w-px h-6 bg-white/10 mx-2"></div>

          <button onClick={addKeyframe} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#4A90E2]/30 text-[#4A90E2] hover:bg-[#4A90E2]/10 text-xs font-semibold transition-colors cursor-pointer">
            <Plus size={14} />
            <span>Add Keyframe</span>
          </button>

          <button onClick={clearKeyframes} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-red-500/30 text-red-400 hover:bg-red-500/10 text-xs font-semibold transition-colors cursor-pointer">
            <Trash2 size={14} />
            <span>Clear</span>
          </button>
        </div>

        <div className="flex items-center gap-3">
          <div className="text-xs font-mono text-white/60">
            {currentTime.toFixed(2)}s / {duration.toFixed(2)}s
          </div>
          
          <button onClick={onRenderMp4} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20 text-xs font-semibold transition-colors cursor-pointer">
            <Download size={14} />
            <span>Export MP4</span>
          </button>

          {onClose && (
            <button 
              onClick={onClose} 
              className="w-7 h-7 flex items-center justify-center rounded-lg bg-white/5 hover:bg-white/15 text-white/60 hover:text-white transition-colors cursor-pointer ml-1"
              title="Close Timeline"
            >
              <X size={16} />
            </button>
          )}
        </div>
      </div>

      {/* Timeline Scrub Area */}
      <div className="flex-1 relative mx-4 my-2 group">
        <div className="absolute top-1/2 left-0 w-full h-1 bg-white/10 rounded -translate-y-1/2"></div>
        
        {/* Scrubber handle */}
        <div 
          className="absolute top-0 bottom-0 w-px bg-rose-500 z-10 pointer-events-none transition-all duration-75"
          style={{ left: `${(currentTime / duration) * 100}%` }}
        >
          <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 w-3 h-3 rotate-45 bg-rose-500"></div>
        </div>

        {/* Keyframe marks */}
        {keyframes.map((kf, i) => (
          <div 
            key={i}
            className="absolute top-1/2 w-2 h-4 bg-[#4A90E2] rounded-sm -translate-y-1/2 -translate-x-1/2 z-20 cursor-pointer shadow-lg shadow-black/50"
            style={{ left: `${(kf.time / duration) * 100}%` }}
            onClick={() => {
              setCurrentTime(kf.time);
              onApplyView(kf.view);
            }}
            title={`Keyframe at ${kf.time.toFixed(1)}s`}
          >
          </div>
        ))}

        {/* Clickable area for scrubbing */}
        <input 
          type="range"
          min="0"
          max={duration}
          step="0.01"
          value={currentTime}
          onChange={(e) => {
            const t = parseFloat(e.target.value);
            setCurrentTime(t);
            const view = keyframeManager.interpolate(t);
            if (view) onApplyView(view);
          }}
          className="absolute inset-0 w-full h-full opacity-0 cursor-ew-resize z-30"
        />
      </div>

    </div>
  );
}
