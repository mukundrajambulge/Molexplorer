// VideoEncoder.ts — Captures canvas frames and muxes to .mp4 using FFmpeg.wasm
import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';

export class VideoEncoder {
  private ffmpeg: FFmpeg;
  private frames: Blob[] = [];
  private frameCount = 0;
  private canvas: HTMLCanvasElement | null = null;
  private isLoaded = false;
  private fps: number;

  constructor(fps = 30) {
    this.ffmpeg = new FFmpeg();
    this.fps = fps;
  }

  async load() {
    if (this.isLoaded) return;
    // Load FFmpeg WASM core from CDN (no CORS issues)
    const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm';
    this.ffmpeg.on('log', ({ message }) => {
      console.log('[FFmpeg]', message);
    });
    await this.ffmpeg.load({
      coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
      wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
    });
    this.isLoaded = true;
  }

  setCanvas(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
  }

  async captureFrame(): Promise<void> {
    if (!this.canvas) return;
    return new Promise((resolve) => {
      this.canvas!.toBlob((blob) => {
        if (blob) {
          this.frames.push(blob);
          this.frameCount++;
        }
        resolve();
      }, 'image/png');
    });
  }

  async encodeToMp4(filename = 'molstudio_movie.mp4'): Promise<void> {
    if (this.frames.length === 0) {
      alert('No frames captured. Play the animation first.');
      return;
    }

    await this.load();

    // Write each frame to FFmpeg FS
    for (let i = 0; i < this.frames.length; i++) {
      const data = await this.frames[i].arrayBuffer();
      const padded = String(i).padStart(6, '0');
      await this.ffmpeg.writeFile(`frame${padded}.png`, new Uint8Array(data));
    }

    // Encode: input pngs → output mp4 (H.264 in fMP4 container)
    await this.ffmpeg.exec([
      '-framerate', String(this.fps),
      '-i', 'frame%06d.png',
      '-c:v', 'libx264',
      '-pix_fmt', 'yuv420p',
      '-movflags', '+frag_keyframe+empty_moov', // fMP4 for streaming compatibility
      '-preset', 'fast',
      '-crf', '18',
      filename
    ]);

    // Read and download
    const data = await this.ffmpeg.readFile(filename);
    const blob = new Blob([data], { type: 'video/mp4' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);

    // Clean up frames from memory
    this.frames = [];
    this.frameCount = 0;
  }

  getFrameCount() {
    return this.frameCount;
  }

  reset() {
    this.frames = [];
    this.frameCount = 0;
  }
}
