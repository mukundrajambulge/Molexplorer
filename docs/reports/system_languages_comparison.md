# Systems Programming Languages for WebAssembly: C++ vs. Rust vs. Zig vs. Carbon

macromolecular rendering and biophysical computations require bare-metal execution speeds. This document provides a detailed comparative analysis of systems-level programming languages for WebAssembly (WASM) compilation, analyzing libraries, memory management, compile size, and runtime efficiency.

---

## 1. Comparative Matrix of Systems Languages for WASM

| Criterion | C++ (Emscripten) | Rust (wasm-bindgen) | Zig (zig build) | Carbon |
| :--- | :--- | :--- | :--- | :--- |
| **Memory Model** | Manual (RAII / pointers) | Compile-time ownership (borrow checker) | Manual (Explicit allocators) | Manual (C++ compatible) |
| **Garbage Collection** | None (Linear Memory) | None (Linear Memory) | None (Linear Memory) | None (Linear Memory) |
| **WASM Binary Size** | Medium (50KB–500KB) | Small (40KB–300KB) | Ultra-Small (5KB–50KB) | Large (Experimental) |
| **SIMD Autovectorization**| High (via LLVM Clang) | High (via LLVM rustc) | High (Native vector types) | Medium (Early stage) |
| **C/C++ Interoperability**| Native | Excellent (via bindgen / c-bridge)| Native | Native (Bidirectional) |
| **Bioinformatics Ecosystem**| Excellent (RDKit, OpenBabel, Vina) | Growing (BioRust, Chemfiles) | Negligible | Non-existent |

---

## 2. Why PyMOL Historically Uses C/C++
PyMOL was created by Warren L. DeLano in C and Python. The technical decisions behind this stack remain relevant today:
1. **OpenGL and C Bindings**: In the early 2000s, OpenGL bindings were native to C. High-performance graphics required direct memory mapping of vertex buffer arrays.
2. **Library Maturity**: Computational chemistry libraries (like RDKit, OpenBabel, AmberTools, and AutoDock) are written in C/C++ or Fortran. Linking these engines required a C-compatible ABI.
3. **Execution Speed**: Diagonalizing large covariance matrices (Kabsch alignment) or computing millions of H-bond energies requires SIMD registers and cache alignment, which C/C++ compiles down to natively.

---

## 3. Why MolStudio Transitions to C++ compiled to WASM
For Stage 4 and onwards, MolStudio will utilize client-side C++ compiled via Emscripten to WebAssembly:
- **Numerical Parity**: Emscripten compiles IEEE-754 double precision float math directly to WASM float64 operations. This ensures that molecular measurements, energy levels, and coordinates are bit-for-bit identical to desktop PyMOL.
- **Porting Professional Core Engines**: Instead of re-writing complex solvers (e.g. MMFF94 force-field minimization or Lee-Richards surface area calculators) in TypeScript, we compile the verified C++ code blocks directly.
- **Zero-Copy Memory Access**: WebAssembly shares linear memory with the JavaScript host. By passing indices pointing to `Float32Array` buffers on the WASM heap, the WebGL rendering context accesses modified coordinates instantly without serialization delays.

---

## 4. Alternative Systems Languages Analysis

### Rust
*   **Pros**: Compile-time safety guarantees prevent null pointer dereferences and memory leaks, which are common in manual coordinate management. Highly optimized WASM toolchain (`wasm-pack`, `wasm-bindgen`).
*   **Cons**: Lacks mature chemistry/bioinformatics libraries. Interfacing with existing C++ cores (like Vina or RDKit) requires complex FFI C-bridges, duplicating memory layouts.

### Zig
*   **Pros**: Exceptional memory control with explicit allocators. Can compile C/C++ code directly out of the box using Zig as a compiler drop-in. Extremely small WASM binary footprints.
*   **Cons**: Ecosystem is still in its infancy; lacks library support for bioinformatics.

### Carbon
*   **Pros**: Designed as a C++ successor with bidirectional interoperability, easing gradual migration of legacy codebases.
*   **Cons**: Experimental compiler; not yet suitable for production WASM deployments.

---

## 5. Recommendation
For MolStudio, **C++ remains the primary choice** because of its native support for structural biology libraries. However, **Rust is highly recommended for writing new compute modules** (such as Marching Cubes mesh engines or AST selection parsing) due to its memory safety and modern developer ergonomics.
