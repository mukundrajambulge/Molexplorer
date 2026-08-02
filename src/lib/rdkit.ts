// @ts-ignore
import initRDKitModule from "@rdkit/rdkit";

let rdkitModule: any = null;
let rdkitPromise: Promise<any> | null = null;

export const getRDKit = async () => {
  if (rdkitModule) return rdkitModule;
  if (rdkitPromise) return rdkitPromise;

  rdkitPromise = new Promise((resolve, reject) => {
    try {
      // @ts-ignore
      initRDKitModule({
        locateFile: (path: string) => path.endsWith('.wasm') ? 'https://unpkg.com/@rdkit/rdkit@latest/dist/RDKit_minimal.wasm' : path,
      }).then((instance: any) => {
        rdkitModule = instance;
        resolve(instance);
      }).catch((e: any) => {
        console.error("Failed to initialize RDKit WASM module:", e);
        const msg = (e && e.message) ? e.message : (typeof e === "string" ? e : String(e || "Unknown RDKit initialization error"));
        reject(new Error(`Failed to initialize RDKit WASM module: ${msg}`));
      });
    } catch(e: any) {
      console.error("Failed to invoke initRDKitModule:", e);
      const msg = (e && e.message) ? e.message : String(e || "Invocation error");
      reject(new Error(`Failed to initialize RDKit WASM module: ${msg}`));
    }
  });
  
  return rdkitPromise;
};
