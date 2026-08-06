import React, { useState, useEffect } from "react";
import { Camera } from "lucide-react";
import Timeline from "../../animation/Timeline";
import { KeyframeManager } from "../../animation/KeyframeManager";

export interface TimelineEngineProps {
  keyframeManager: KeyframeManager;
  getView: () => any;
  setView: (view: any) => void;
}

export function TimelineEngine({ keyframeManager, getView, setView }: TimelineEngineProps) {
  const [isRecordingMp4, setIsRecordingMp4] = useState(false);
  const [recordingProgress, setRecordingProgress] = useState(0);

  useEffect(() => {
    const handleExportMp4 = async () => {
      const canvas = document.querySelector('canvas') as HTMLCanvasElement;
      if (!canvas) {
        alert("No active 3D canvas found to export.");
        return;
      }

      setIsRecordingMp4(true);
      setRecordingProgress(0);

      try {
        const stream = canvas.captureStream(30); // 30 FPS
        let mimeType = 'video/mp4';
        if (!MediaRecorder.isTypeSupported(mimeType)) mimeType = 'video/webm;codecs=vp9';
        if (!MediaRecorder.isTypeSupported(mimeType)) mimeType = 'video/webm';

        const mediaRecorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 5000000 });
        const chunks: Blob[] = [];

        mediaRecorder.ondataavailable = (e) => {
          if (e.data.size > 0) chunks.push(e.data);
        };

        const totalSteps = 60;
        let step = 0;

        mediaRecorder.start();

        const interval = setInterval(() => {
          step++;
          setRecordingProgress(Math.round((step / totalSteps) * 100));

          // Apply rotation step for 360 degree video rendering
          const view = getView();
          if (view && Array.isArray(view) && view.length >= 8) {
            const nextView = [...view];
            nextView[3] += 0.05; // Smooth rotation
            setView(nextView);
          }

          if (step >= totalSteps) {
            clearInterval(interval);
            mediaRecorder.stop();
          }
        }, 50);

        mediaRecorder.onstop = () => {
          const blob = new Blob(chunks, { type: mimeType });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          const ext = mimeType.includes('mp4') ? 'mp4' : 'webm';
          a.download = `molstudio_movie_${Date.now()}.${ext}`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
          setIsRecordingMp4(false);
        };
      } catch (err) {
        console.error("MP4 Export failed:", err);
        alert("Recording failed: " + (err as Error).message);
        setIsRecordingMp4(false);
      }
    };

    document.addEventListener("export-mp4", handleExportMp4);
    return () => document.removeEventListener("export-mp4", handleExportMp4);
  }, [getView, setView]);

  return (
    <>
      <Timeline 
        keyframeManager={keyframeManager} 
        onApplyView={setView}
        onGetCurrentView={getView}
        onRenderMp4={() => document.dispatchEvent(new CustomEvent("export-mp4"))}
      />

      {isRecordingMp4 && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/80 backdrop-blur-md">
          <div className="bg-[#141416] border border-[#4A90E2]/30 p-6 rounded-2xl shadow-2xl max-w-sm w-full flex flex-col items-center gap-4 text-center">
            <div className="w-12 h-12 rounded-full bg-[#4A90E2]/20 flex items-center justify-center text-[#4A90E2] animate-pulse">
              <Camera size={24} />
            </div>
            <div className="space-y-1">
              <h3 className="text-base font-semibold text-white">Rendering MP4 Animation</h3>
              <p className="text-xs text-white/50 font-mono">Capturing 360° rotational movie pass...</p>
            </div>
            
            <div className="w-full bg-white/10 rounded-full h-2 overflow-hidden">
              <div 
                className="bg-[#4A90E2] h-full transition-all duration-150 ease-out" 
                style={{ width: `${recordingProgress}%` }}
              />
            </div>
            <span className="text-xs font-mono text-[#4A90E2]">{recordingProgress}% Complete</span>
          </div>
        </div>
      )}
    </>
  );
}
