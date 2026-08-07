# Architectural Report: Language Selection and Biophysical Calculations

This report provides a deep technical and scientific analysis of language options for implementing molecular modeling logic in **MolStudio**. It evaluates **TypeScript**, **WebAssembly (WASM/C++)**, and **Native C++/Python backends**, outlining the structural sync and industry standards.

---

## 1. Distribution of Computational Logic (Stages 1–3)

Currently, in Stages 1, 2, and 3, all logic is implemented in **TypeScript** running directly in the browser:

```mermaid
graph TD
    A[PDB/SDF File Input] -->|Parsed Client-side| B(MolProcessor.ts)
    B -->|Atoms Data Store| C(Zustand Store)
    C -->|Subscribes| D[WebGL 3D Viewport]
    C -->|Subscribes| E[Interactive Sidebar Widgets]
    
    subgraph Selection & Biophysics Engines (TypeScript)
        F[SelectionParser.ts: query compilation]
        G[Interactions.ts: H-bonds, salt bridges, pi-pi]
        H[DSSP & Amber charge potential math]
    end
    
    C <--> F
    C <--> G
    C <--> H
```

### Why TypeScript was chosen for Stages 1–3:
1. **Low Latency & Instant Interactivity**: Calculations are evaluated client-side in real-time ($<2\text{ ms}$). There are no network latency roundtrips ($50\text{–}200\text{ ms}$) to a server.
2. **Synchronized Rendering**: Because both the 3D WebGL viewer (3Dmol.js) and the biophysical solvers run in the same JavaScript thread, coordinate values, selections, and vector updates sync instantly without complex serialized bindings.
3. **Zero-Setup Deployment**: The app runs client-side in the browser, requiring no local installations or backend server configurations.

---

## 2. Structural & Language Options for Biophysical Logic

When scaling MolStudio to support heavier computations (Stage 4: Advanced Modeling, Energy Minimization, Molecular Docking), we must evaluate three primary options for our computational logic:

### Option A: Pure TypeScript (Current Client-Side)
*   **Suitability**: Geometric checks, interaction detection, selection algebra, secondary structure assignments (DSSP).
*   **Scientific Precision**: High. Uses IEEE-754 64-bit double-precision floats, matching PyMOL's math precision exactly.
*   **Limitation**: Single-threaded execution. Blocking loops (e.g., Monte Carlo simulations or energy minimization cycles) will freeze the browser tab UI.

### Option B: C++ Compiled to WebAssembly (Client-Side WASM)
*   **Suitability**: High-performance client-side tasks, such as force-field calculations, RDKit coordinates generation, or fast local docking (e.g., Webina).
*   **How it works**: C++ libraries (e.g., RDKit C++ core, OpenBabel) are compiled using Emscripten into `.wasm` binary files. JavaScript invokes these compiled binaries in web workers.
*   **Pros**: Execution speeds within 1.2x of native C++ directly in the browser; allows reuse of established C++ biophysical codebases.
*   **Cons**: WebAssembly binary sizes are large ($5\text{–}15\text{ MB}$), causing initial load times. Serializing coordinate arrays between JavaScript heap and WASM memory has overhead.

### Option C: Native C++ / Python (Backend Microservice API)
*   **Suitability**: Heavy computational drug discovery tasks, such as AutoDock Vina docking runs, long Molecular Dynamics (MD) simulations, and GROMACS/Amber force-field minimization.
*   **How it works**: A backend framework (e.g., FastAPI in Python) wraps native compiled C++ binaries. The web app sends coordinate data (PDB/SDF) via HTTP/WebSockets, the backend processes the calculations, and returns coordinates or result payloads.
*   **Pros**: Unconstrained CPU/GPU parallel execution, access to multi-threaded GPU hardware (CUDA/OpenCL), and full compatibility with industry-grade software.
*   **Cons**: Requires server hosting and network connectivity. High infrastructure costs for GPU hosting.

---

## 3. Structural Comparison Matrix

| Feature | TypeScript (Client JS/TS) | WebAssembly (C++ WASM) | Native Backend (Python / C++) | Industry Standards |
| :--- | :--- | :--- | :--- | :--- |
| **Execution Context** | Browser Main Thread | Browser Web Worker | Server (FastAPI / Celery) | PyMOL (Native C++/Python), ChimeraX (C++/Python) |
| **Numeric Performance** | Baseline ($1\text{x}$) | Fast ($5\text{–}10\text{x}$) | Maximum ($15\text{–}100\text{x}$ with CUDA) | GROMACS/OpenMM run on bare-metal CUDA. |
| **Thread Model** | Single-threaded | Multi-threaded (Web Workers) | Parallel / Multi-process | PyMOL command shell uses Python threads. |
| **Best Used For** | UI rendering, selection queries, simple spatial geometric calculations. | Local molecule cleanups, RDKit coordinates, small energy minimizations. | Docking simulations (Vina), molecular dynamics, large database virtual screens. | AutoDock Vina, plants, plants-docking run on C++. |

---

## 4. Proposed Hybrid Architecture Plan

To build an industry-grade molecular studio, we recommend a **hybrid architecture** that balances client-side speed with backend power:

```
[ Frontend: React / TypeScript ]
       │
       ├───► [ Render Engine: WebGL / WebGL 2.0 ]  --> Direct GPU Drawing
       │
       ├───► [ Fast Solvers: WebAssembly (C++) ]    --> Local Coordinate Cleanup (MMFF94)
       │
       └───► [ Heavy Solvers: Backend API ]         --> Docking (FastAPI / C++ Vina / Celery)
```

1.  **Selection Queries & Biophysics (Stage 1-3)**: Keep in **TypeScript**. Running selection queries (`select name CA`) and DSSP calculation client-side ensures instantaneous reactivity as the user interacts with the canvas.
2.  **Local Conformation Cleanups (MMFF94)**: Use **WebAssembly (C++)** via an RDKit WASM wrapper. When a user draws a molecule in the sketcher, WASM generates 3D coordinates and minimizes energies client-side in under 100ms.
3.  **Heavy Docking & Dynamics (Stage 4+)**: Offload to a **Python/C++ FastAPI Backend** (connected to Celery workers). AutoDock Vina runs natively in C++ on the server, streaming progress updates to the frontend via WebSockets.
