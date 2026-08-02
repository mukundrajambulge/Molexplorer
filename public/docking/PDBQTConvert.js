/*
PDBQTConvert: A program for converting many file formats to PDBQT. Copyright
(C) 2020 Jacob Durrant
*/

var PDBQTConvert = {
    openBabelInstance: null,
    openBabelPromise: null,

    getOpenBabel: function () {
        if (this.openBabelInstance) {
            return Promise.resolve(this.openBabelInstance);
        }
        if (this.openBabelPromise) {
            return this.openBabelPromise;
        }
        this.openBabelPromise = new Promise((resolve, reject) => {
            if (typeof OpenBabelModule !== "function") {
                const noFuncErr = new Error("OpenBabelModule function is not available on window. Make sure /docking/openbabel.js is loaded.");
                console.error(noFuncErr);
                return reject(noFuncErr);
            }

            try {
                const config = {
                    locateFile: function (path) {
                        if (path === "openbabel.wasm") {
                            return "https://cdn.jsdelivr.net/gh/durrantlab/webina@master/src/pdbqt_convert/openbabel.wasm";
                        }
                        return "/docking/" + path;
                    }
                };

                console.log("[PDBQTConvert] Initializing OpenBabelModule...");
                var inst = OpenBabelModule(config);
                if (inst && typeof inst.then === "function") {
                    inst.then(
                        function (readyInst) {
                            var finalInst = readyInst || inst || window.OpenBabel;
                            try { delete finalInst.then; } catch (e) {}
                            PDBQTConvert.openBabelInstance = finalInst;
                            console.log("[PDBQTConvert] OpenBabelModule ready!");
                            resolve(finalInst);
                        },
                        function (initErr) {
                            console.error("[PDBQTConvert] Failed to initialize OpenBabelModule:", initErr);
                            var msg = (initErr && initErr.message) ? initErr.message : String(initErr || "Initialization error");
                            reject(new Error("Failed to initialize Open Babel WASM module: " + msg));
                        }
                    );
                } else {
                    PDBQTConvert.openBabelInstance = inst;
                    resolve(inst);
                }
            } catch (initErr) {
                console.error("[PDBQTConvert] Failed to invoke OpenBabelModule():", initErr);
                var msg = (initErr && initErr.message) ? initErr.message : String(initErr || "Invocation error");
                reject(new Error("Failed to initialize Open Babel WASM module: " + msg));
            }
        });
        return this.openBabelPromise;
    },

    convertToPDBQT: function (
        conv,
        openBabelMod,
        inData,
        format,
        includeBranchesTorsions,
        addHydrogens,
        gen3D,
        pH
    ) {
        conv.setInFormat("", format);
        var mol = new openBabelMod.OBMol();
        conv.readString(mol, inData);

        if (addHydrogens === true) {
            pH = pH === undefined ? 7.4 : pH;
            mol.AddHydrogensWithParam(false, true, pH);
        }

        if (includeBranchesTorsions !== true) {
            conv.addOption(
                "r",
                openBabelMod.ObConversion_Option_type.OUTOPTIONS,
                ""
            );
        }

        if (gen3D === true) {
            var gen = new openBabelMod.OB3DGenWrapper();
            gen.generate3DStructure(mol, "MMFF94");
        }

        conv.setOutFormat("", "pdbqt");
        var outData = conv.writeString(mol, false);

        mol.delete();
        return outData;
    },

    convert: function (
        inpText,
        format,
        includeBranchesTorsions,
        addHydrogens,
        gen3D,
        pH
    ) {
        return this.getOpenBabel().then(function (openBabelMod) {
            var conv = new openBabelMod.ObConversionWrapper();
            try {
                var out = PDBQTConvert.convertToPDBQT(
                    conv,
                    openBabelMod,
                    inpText,
                    format,
                    includeBranchesTorsions,
                    addHydrogens,
                    gen3D,
                    pH
                );
                conv.delete();
                return out;
            } catch (err) {
                conv.delete();
                throw err;
            }
        });
    },
};

window.PDBQTConvert = PDBQTConvert;
