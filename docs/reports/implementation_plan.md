# Stage 5: Movie & Keyframing Engine and WebGPU Raytracing

This plan outlines the architecture for introducing cinematic animations, photorealistic rendering (WebGPU), and an in-app User Manual into MolStudio. 

## Goal Description
1. **Cinematic Animation**: Implement a timeline-based animation system that allows users to keyframe camera positions, clipping planes, and object visibility, enabling PyMOL-like "movie" creation (rock, roll, nutate).
2. **Video Export**: Enable capturing the WebGL canvas and exporting the animation sequence to MP4/WebM using native browser APIs (`MediaRecorder` and `captureStream`).
3. **Photorealistic Raytracing**: Introduce a hybrid WebGPU-based raytracer. This will construct a Bounding Volume Hierarchy (BVH) of the molecular scene and perform ambient occlusion, soft shadows, and reflections directly in the browser via WGSL compute/fragment shaders.
4. **Interactive User Manual**: Embed a comprehensive "Help & Documentation" modal containing instructions for all implemented features from Stages 1 through 5.

## User Review Required

> [!WARNING]
> **WebGPU Browser Compatibility**
> WebGPU is currently only supported in recent versions of Chrome/Edge on desktop, and Safari (behind a flag). Firefox support is still experimental. Users on unsupported browsers will gracefully fall back to the standard WebGL renderer. Do you want to implement a warning popup for users lacking WebGPU support?

> [!IMPORTANT]
> **Media Export Format**
> Natively, browsers support exporting canvas streams to `.webm` easily via `MediaRecorder`. True `.mp4` export natively in JS requires heavy WebAssembly libraries (like FFmpeg.wasm) or the highly experimental WebCodecs API. We propose using `MediaRecorder` with `video/webm` by default for performance and reliability. Let me know if `.mp4` is strictly required.

## Proposed Changes

---

### 1. Movie & Keyframing Engine

#### [NEW] `src/animation/Timeline.tsx`
- A bottom-docked UI component displaying the animation timeline (scrubber, frames, play/pause controls).
- UI buttons for predefined cinematic movements: "Rock", "Roll", "Nutate".

#### [NEW] `src/animation/KeyframeManager.ts`
- Logic for storing keyframes (camera state: translation, zoom, quaternion rotation).
- Implements Spherical Linear Interpolation (SLERP) for smooth camera rotations between keyframes.
- Hooks into the rendering loop to update the 3Dmol.js viewer camera per frame.

---

### 2. Video Capture and Export

#### [NEW] `src/export/VideoEncoder.ts`
- Utility class using `canvas.captureStream(60)` and `MediaRecorder`.
- Collects chunks of video data during the Timeline playback.
- Automatically prompts the user to download `molstudio_movie.webm` when the sequence finishes.

#### [MODIFY] `src/components/StudioRibbonBar.tsx`
- Add a new tab `Movie & Animation` to house the timeline toggles and the "Export Video" buttons.

---

### 3. WebGPU Photorealistic Raytracing

#### [NEW] `src/rendering/webgpu/Raytracer.ts`
- Manages the WebGPU `GPUDevice`, `GPUBuffer` creations, and pipeline layouts.
- Extracts atom coordinates, radii, and colors from the active `MolProcessor` state.
- Packs the atom data into a Storage Buffer (SSBO) for the GPU.

#### [NEW] `src/rendering/webgpu/shaders/raytrace.wgsl`
- The core WGSL (WebGPU Shading Language) shader.
- Implements ray-sphere intersection.
- Calculates Lambertian shading, ambient occlusion approximation, and basic shadow rays.

#### [NEW] `src/components/RaytraceViewer.tsx`
- An overlay `<canvas>` element that sits on top of the standard WebGL viewer when "Photorealistic Mode" is toggled.
- Consumes the WebGPU pipeline output.

---

### 4. Interactive User Manual (Stages 1-5)

#### [NEW] `src/components/UserManualModal.tsx`
- A modal dialog accessible from a "Help" button in the top ribbon or sidebar.
- Renders Markdown content detailing how to use:
  - **Stage 1**: Fetching and parsing PDBs.
  - **Stage 2**: Selection Query Console (`ss h`, `within`, etc.).
  - **Stage 3**: Biophysical Validations (Dipole, Ramachandran, Measurements).
  - **Stage 4**: Object control panel.
  - **Stage 5**: Movie Timeline and WebGPU Raytracing.

#### [NEW] `src/docs/UserManual.md`
- The markdown asset containing the actual text, shortcuts, and tutorial guides.

---

## Verification Plan

### Automated Tests
- `scratch/verify_timeline.ts`: Unit test the `KeyframeManager` SLERP math for smooth quaternion interpolation to ensure the camera doesn't flip or jitter.
- `scratch/verify_webgpu.ts`: Check if `navigator.gpu` exists and successfully requests an adapter/device without crashing.

### Manual Verification
- Fetch `1CRN`.
- Add a keyframe at 0s, rotate the molecule 180 degrees, add a keyframe at 5s.
- Press Play. Verify smooth rotation in the WebGL viewer.
- Click "Export WebM". Verify the downloaded video plays correctly.
- Toggle "WebGPU Raytrace". Verify the rendering switches to a photorealistic shader overlay.
- Open the "Help -> User Manual" and verify all documentation (Stages 1-5) is beautifully rendered.
