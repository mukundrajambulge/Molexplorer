export interface DockingParams {
  receptor: string; // PDB text
  ligand: string; // PDB or SDF text
  ligandFormat?: string; // e.g. "sdf", "pdb"
  center_x: number;
  center_y: number;
  center_z: number;
  size_x: number;
  size_y: number;
  size_z: number;
  exhaustiveness?: number;
}

export function formatError(err: any): string {
  if (err === null || err === undefined) {
    return "Unknown error (null or undefined thrown)";
  }
  if (typeof err === "string") {
    return err.trim() || "Empty string error thrown";
  }
  if (err instanceof Error) {
    return err.message || err.name || String(err);
  }
  if (typeof err === "object") {
    if (err.message && typeof err.message === "string") {
      return err.message;
    }
    if (err.error && typeof err.error === "string") {
      return err.error;
    }
    if (err.statusText && typeof err.statusText === "string") {
      return err.statusText;
    }
    try {
      const json = JSON.stringify(err);
      if (json && json !== "{}") return json;
    } catch {
      // ignore circular json error
    }
  }
  return String(err);
}

export function directPDBToPDBQT(pdbText: string): string {
  const lines = pdbText.split("\n");
  let out = "";
  for (let line of lines) {
    line = line.replace(/\r/g, "");
    if (line.startsWith("ATOM  ") || line.startsWith("HETATM")) {
      const record = line.substring(0, 6).padEnd(6, " ");
      const serial = line.length >= 11 ? line.substring(6, 11) : "    1";
      const name = line.length >= 16 ? line.substring(12, 16) : " CA ";
      const altLoc = line.length >= 17 ? line.substring(16, 17) : " ";
      const resName = line.length >= 20 ? line.substring(17, 20) : "ALA";
      const chainID = line.length >= 22 ? line.substring(21, 22) : "A";
      const resSeq = line.length >= 26 ? line.substring(22, 26) : "   1";
      const iCode = line.length >= 27 ? line.substring(26, 27) : " ";
      const x = line.length >= 38 ? line.substring(30, 38) : "   0.000";
      const y = line.length >= 46 ? line.substring(38, 46) : "   0.000";
      const z = line.length >= 54 ? line.substring(46, 54) : "   0.000";
      const occ = line.length >= 60 ? line.substring(54, 60) : "  1.00";
      const bFac = line.length >= 66 ? line.substring(60, 66) : "  0.00";

      let rawElem = line.length >= 78 ? line.substring(76, 78).trim().toUpperCase() : "";
      if (!rawElem) {
        rawElem = name.trim().replace(/[0-9]/g, "").toUpperCase().substring(0, 2);
      }

      let adType = rawElem;
      const resTrim = resName.trim().toUpperCase();
      const atomTrim = name.trim().toUpperCase();

      if (rawElem === "C") {
        if (
          ["PHE", "TYR", "TRP", "HIS"].includes(resTrim) &&
          ["CG", "CD1", "CD2", "CE1", "CE2", "CE3", "CZ", "CZ2", "CZ3", "CH2"].includes(atomTrim)
        ) {
          adType = "A";
        } else {
          adType = "C";
        }
      } else if (rawElem === "O") {
        adType = "OA";
      } else if (rawElem === "N") {
        adType = ["HIS", "ARG", "LYS", "ASN", "GLN"].includes(resTrim) ? "NA" : "N";
      } else if (rawElem === "S") {
        adType = "SA";
      } else if (rawElem === "H") {
        adType = "HD";
      }

      const formattedLine = `${record}${serial.padStart(5, " ")} ${name.padEnd(4, " ")}${altLoc}${resName.padStart(3, " ")} ${chainID}${resSeq.padStart(4, " ")}${iCode}   ${x.padStart(8, " ")}${y.padStart(8, " ")}${z.padStart(8, " ")}${occ.padStart(6, " ")}${bFac.padStart(6, " ")}     0.000 ${adType.padEnd(2, " ")}`;
      out += formattedLine + "\n";
    }
  }
  return out;
}

export function directLigandPDBToPDBQT(pdbText: string): string {
  const atoms = directPDBToPDBQT(pdbText);
  if (!atoms || atoms.trim().length === 0) return "";
  return `ROOT\n${atoms}ENDROOT\nTORSDOF 0\n`;
}

export async function convertToPDBQT(
  pdbData: string | Uint8Array,
  format: string,
  isReceptor: boolean,
  addHydrogens: boolean = true
): Promise<string> {
  const targetLabel = isReceptor ? "receptor" : "ligand";

  let inpString: string;
  if (typeof pdbData === "string") {
    inpString = pdbData;
  } else if (pdbData instanceof Uint8Array) {
    inpString = new TextDecoder().decode(pdbData);
  } else if (pdbData && (pdbData as any).buffer instanceof ArrayBuffer) {
    inpString = new TextDecoder().decode(new Uint8Array((pdbData as any).buffer));
  } else {
    inpString = String(pdbData || "");
  }

  // 1. For Receptors: Receptors are large proteins (1000-5000+ atoms).
  // Direct PDB -> PDBQT formatting is fast (0ms), deterministic, avoids OpenBabel WASM OOM & string limits,
  // and produces valid AutoDock Vina receptor PDBQT.
  if (isReceptor) {
    const directRec = directPDBToPDBQT(inpString);
    if (directRec && directRec.trim().length > 0) {
      console.log(`Receptor converted directly to PDBQT (${directRec.split("\n").length} lines).`);
      return directRec;
    }
  }

  // 2. For Ligands: Attempt OpenBabel conversion first
  try {
    const PDBQTConvert = (window as any).PDBQTConvert;
    if (PDBQTConvert) {
      const result = await PDBQTConvert.convert(
        inpString,
        format,
        !isReceptor, // includeBranchesTorsions
        addHydrogens,        // addHydrogens
        false,       // gen3D
        7.4          // pH
      );
      if (result && typeof result === "string" && result.trim().length > 0) {
        return result;
      }
    }
  } catch (err: any) {
    console.warn(`OpenBabel conversion failed for ${targetLabel}, attempting direct JS fallback:`, err);
  }

  // 3. Fallback for Ligands or Receptors if OpenBabel failed
  if (isReceptor) {
    const directRec = directPDBToPDBQT(inpString);
    if (directRec && directRec.trim().length > 0) return directRec;
  } else {
    const directLig = directLigandPDBToPDBQT(inpString);
    if (directLig && directLig.trim().length > 0) return directLig;
  }

  throw new Error(`PDBQT conversion failed for ${targetLabel}: Unable to format input structure.`);
}

export async function runWebina(
  receptorPdbqt: string,
  ligandPdbqt: string,
  params: DockingParams,
  onLog?: (msg: string) => void
): Promise<string> {
  let mod: any;
  const vinaUrl1 = `${window.location.origin}/docking/vina.js`;
  const vinaUrl2 = "/docking/vina.js";
  try {
    mod = await import(/* @vite-ignore */ vinaUrl1);
  } catch (importErr: any) {
    try {
      mod = await import(/* @vite-ignore */ vinaUrl2);
    } catch (importErr2: any) {
      console.error("Failed to import Webina JS module:", importErr2);
      throw new Error(`Failed to load Webina docking engine module: ${formatError(importErr2)}`);
    }
  }

  const WEBINA_Module = mod.default || mod;

  return new Promise((resolve, reject) => {
    let stdOut = "";
    let activeWebinaMod: any = null;

    try {
      const options = {
        logReadFiles: true,
        noInitialRun: true,
        locateFile: (path: string) => {
          if (path === "vina.wasm") {
            return "https://cdn.jsdelivr.net/gh/durrantlab/webina@master/src/Webina/vina.wasm";
          }
          return `/docking/${path}`;
        },
        preRun: [
          function (This: any) {
            try {
              This.FS.writeFile("/receptor.pdbqt", receptorPdbqt);
              This.FS.writeFile("/ligand.pdbqt", ligandPdbqt);
            } catch (fsErr) {
              console.error("Failed writing PDBQT files to Webina VFS in preRun:", fsErr);
            }
          },
        ],
        print: (text: string) => {
          stdOut += text + "\n";
          if (onLog) onLog(text);
        },
        printErr: (text: string) => {
          if (onLog) onLog(text);
        },
        onExit: (code: number) => {
          if (code !== 0) {
            const exitErr = new Error(`Webina process exited with code ${code}`);
            console.error(exitErr);
            reject(exitErr);
            return;
          }
          try {
            const targetMod = activeWebinaMod;
            if (!targetMod || !targetMod.FS) {
              throw new Error("Webina FS instance unavailable upon exit.");
            }
            const outTxt = targetMod.FS.readFile("/ligand_out.pdbqt", { encoding: "utf8" });
            if (!outTxt) {
              throw new Error("Output ligand file /ligand_out.pdbqt is empty.");
            }
            resolve(outTxt);
          } catch (e: any) {
            console.error("Failed reading output ligand from Webina VFS:", e);
            reject(new Error(`Failed to read output ligand: ${formatError(e)}`));
          }
        },
        onError: (err: any) => {
          console.error("Webina onError triggered:", err);
          reject(err instanceof Error ? err : new Error(formatError(err)));
        },
        catchError: (err: any) => {
          console.error("Webina catchError triggered:", err);
          reject(err instanceof Error ? err : new Error(formatError(err)));
        }
      };

      const initRes = WEBINA_Module(options);
      const readyPromise = (initRes && initRes.ready) ? initRes.ready : Promise.resolve(initRes);

      readyPromise.then((resolvedMod: any) => {
        const modInstance = resolvedMod || initRes;
        activeWebinaMod = modInstance;

        try {
          if (modInstance.FS && typeof modInstance.FS.writeFile === "function") {
            try {
              modInstance.FS.writeFile("/receptor.pdbqt", receptorPdbqt);
              modInstance.FS.writeFile("/ligand.pdbqt", ligandPdbqt);
            } catch (e) {
              // Ignore if already written in preRun
            }
          }

          let cmdLineParams: string[] = [];
          const vParams: any = {
            center_x: params.center_x,
            center_y: params.center_y,
            center_z: params.center_z,
            size_x: params.size_x,
            size_y: params.size_y,
            size_z: params.size_z,
            exhaustiveness: params.exhaustiveness || 8,
          };

          Object.keys(vParams).forEach((key) => {
            cmdLineParams.push(`--${key}`);
            cmdLineParams.push(vParams[key].toString());
          });

          cmdLineParams.push(
            "--receptor", "/receptor.pdbqt",
            "--ligand", "/ligand.pdbqt",
            "--out", "/ligand_out.pdbqt"
          );

          if (typeof modInstance.callMain === "function") {
            modInstance.callMain(cmdLineParams);
          } else if (typeof modInstance._main === "function") {
            modInstance._main(cmdLineParams);
          } else {
            throw new Error("Webina WASM module missing callMain or _main entrypoint.");
          }
        } catch (runErr: any) {
          console.error("Error executing Webina callMain:", runErr);
          reject(new Error(`Error executing Webina docking process: ${formatError(runErr)}`));
        }
      }).catch((readyErr: any) => {
        console.error("Webina WASM module compilation or ready promise failed:", readyErr);
        reject(new Error(`Failed to load/compile Webina WASM module: ${formatError(readyErr)}`));
      });
    } catch (initErr: any) {
      console.error("Failed to instantiate Webina module:", initErr);
      reject(new Error(`Failed to initialize Webina WASM module: ${formatError(initErr)}`));
    }
  });
}
