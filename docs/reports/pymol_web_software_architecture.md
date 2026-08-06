# Web-Native PyMOL Replica: Software Engineering Architecture

This document provides a deep architectural analysis for constructing a high-performance, web-native replica of PyMOL. The architecture prioritizes client-side performance, minimizing garbage collection pauses, and maximizing GPU/SIMD parallelization.

## 1. Language & Engine Selection Matrix

To achieve desktop-class performance in a browser environment, workloads must be strictly partitioned across different web technologies based on memory models, threading capabilities, and mathematical intensity.

*   **Selection Parser**: **TypeScript (V8 JS heap)**. PyMOL selection syntax parsing involves short-lived string allocations and complex regex/tokenization. Operating in the standard JS heap keeps integration with the UI seamless, and modern V8 JIT compilation ensures latency remains under $<2$ms.
*   **Cartoon Splines**: **C++ compiled to WASM**. Generating B-splines and ribbon geometries requires heavy sequential matrix math. Using WASM's linear memory heap eliminates garbage collection stutter and allows the use of SIMD instructions for vector math.
*   **Surface Generation**: **C++ WASM / WebGPU Compute Shaders**. Solvent-Excluded Surfaces (SES) or Gaussian surfaces are computationally expensive. Initial mesh generation (like marching cubes) can be offloaded to WebGPU compute shaders, falling back to multi-threaded WASM for older hardware.
*   **Density Maps**: **WebGL 2.0 / WebGPU 3D Texture Shaders**. Electron density or Cryo-EM maps require volumetric raymarching. Using native 3D textures in WebGL2/WebGPU allows rapid hardware-accelerated trilinear interpolation.
*   **Sculpting Engine**: **C++ WASM + SharedArrayBuffer**. Real-time molecular dynamics (MD) and energy minimization (120 FPS force fields) require continuous compute. A dedicated Web Worker running WASM uses `SharedArrayBuffer` to mutate coordinate arrays while the main thread reads them for rendering without serialization overhead.
*   **Movie Renderer**: **TypeScript + WebCodecs API**. Instead of compiling heavy video encoders like FFmpeg to WASM, the browser's native hardware-accelerated WebCodecs API encodes the `<canvas>` stream to MP4/WebM on the fly with minimal CPU overhead.
*   **Raytracer**: **WebGPU Compute Shaders**. Desktop PyMOL relies on slow CPU raytracing. A web replica uses hardware-accelerated WebGPU compute shaders for bounding volume hierarchy (BVH) traversal, enabling 30+ FPS real-time path tracing with soft shadows and ambient occlusion.

## 2. State Management & Data Layout

Efficient memory layout is critical when dealing with millions of atoms. Object-oriented JS models fail at this scale.

*   **Structure-of-Arrays (SoA) vs. Array-of-Structures (AoS)**: The engine uses SoA layout. Instead of an array of `Atom` objects (`[{x, y, z, ...}]`), data is stored in contiguous `Float32Array` buffers (`xArray`, `yArray`, `zArray`). This guarantees CPU cache locality for WASM SIMD processing and allows buffers to be mapped directly to GPU vertex attributes without interleave parsing overhead.
*   **Spatial Hash Grid**: An $O(1)$ spatial data structure divides the 3D space into uniform grid cells. This grid drastically accelerates spatial queries (e.g., "find all atoms within 4Å") required for VDW contact detection, hydrogen bonding, and sculpting force fields.
*   **AST Lexical Scanner & Recursive Descent Selection**: The PyMOL selection language (e.g., `resi 1-100 and not name CA`) is processed by a custom recursive descent parser. It produces an Abstract Syntax Tree (AST) that compiles down to highly optimized bitmask operations over the SoA data, evaluating millions of atoms in milliseconds.
*   **Delta-Encoded Immutable Undo/Redo**: To support extensive undo/redo without duplicating massive typed arrays, the state tree stores delta-encoded differences. Only the modified subsets of the coordinate buffers or state flags are recorded, keeping memory overhead trivial.

## 3. GPU Rendering Pipeline

To render 10M+ atoms flawlessly, the graphics pipeline abandons traditional polygon meshes for mathematical representations evaluated per-pixel.

*   **Impostor-Based Instanced Rendering**: Atoms (spheres) and bonds (cylinders) are not rendered as complex geodesic meshes. Instead, the vertex shader emits a simple 2D quad facing the camera. The fragment shader uses GLSL raycasting to analytically intersect a ray with the mathematical sphere/cylinder. This results in pixel-perfect curves regardless of zoom level, utilizing minimal geometry memory (just instanced center points and radii).
*   **Post-Processing Pipeline**: Achieving PyMOL's iconic publication-quality aesthetics relies on screen-space effects:
    *   **Screen-Space Ambient Occlusion (SSAO)**: Dynamically shades deep pockets and clefts in the protein, providing spatial depth without baked lighting.
    *   **Sobel Edge Outline**: A custom shader runs edge detection on the depth and normal buffers to draw crisp black outlines around cartoons and surfaces.
    *   **Depth Cueing (Fog)**: Exponential depth fog gently fades background atoms into the canvas color, helping users focus on the foreground active site.

## 4. Multi-User & Web Scalability

Modern web architecture allows this tool to scale effortlessly across the globe without heavy backend infrastructure.

*   **Client-Side Execution Proof**: By aggressively leveraging WebAssembly and WebGPU, the compute burden is 100% offloaded to the user's local hardware. The server acts merely as a static CDN for the web application, meaning hosting costs round down to $0$ regardless of concurrent user load.
*   **Progressive BinaryCIF Decoding**: To load massive complexes (like whole viral capsids or ribosomes), the engine streams BinaryCIF formats. Combining MessagePack, Delta encoding, and Run-Length Encoding (RLE), the payload is compressed up to 10x smaller than standard PDB files. The parser decodes coordinates progressively, rendering the macromolecule iteratively as the network chunks stream in.
