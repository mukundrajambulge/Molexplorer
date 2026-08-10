#include "../include/DockingEngine.hpp"
#include <chrono>
#include <set>
#include <cmath>
#include <iostream>

namespace molexplorer::engine {

DockingResult DockingEngine::runDocking(
    const std::string& receptorContent,
    const std::string& ligandContent,
    const DockingParameters& params,
    std::function<void(int percent, const std::string& stage)> progressCallback
) {
    auto startTime = std::chrono::high_resolution_clock::now();
    DockingResult result;

    try {
        if (progressCallback) progressCallback(5, "Parsing receptor and ligand structures...");

        // 1. Parse inputs
        Molecule receptor = StructurePrep::parsePDB(receptorContent);
        if (receptor.atoms.empty()) {
            receptor = StructurePrep::parsePDBQT(receptorContent);
        }

        Molecule ligand = StructurePrep::parsePDB(ligandContent);
        if (ligand.atoms.empty()) {
            ligand = StructurePrep::parsePDBQT(ligandContent);
        }

        if (receptor.atoms.empty()) {
            result.errorMessage = "Receptor structure contains no valid ATOM records.";
            return result;
        }
        if (ligand.atoms.empty()) {
            result.errorMessage = "Ligand structure contains no valid ATOM records.";
            return result;
        }

        // 2. Prepare structures (hydrogens, Gasteiger charges, atom typing, rotatable bonds)
        if (progressCallback) progressCallback(20, "Assigning hybridization, hydrogens & Gasteiger charges...");
        StructurePrep::prepareReceptor(receptor);
        StructurePrep::prepareLigand(ligand);

        std::cout << "[DockingEngine] Prepared Receptor: " << receptor.atoms.size() << " atoms." << std::endl;
        std::cout << "[DockingEngine] Prepared Ligand: " << ligand.atoms.size() << " atoms, "
                  << ligand.rotatableBonds.size() << " rotatable bonds." << std::endl;

        // 3. Configure Grid Box
        DockingParameters actualParams = params;
        if (actualParams.gridBox.center.lengthSq() < 1e-6) {
            // Auto-center on ligand or receptor center of mass
            actualParams.gridBox.center = ligand.centerOfMass;
        }

        // Collect all ligand atom types needed in grid
        std::set<std::string> typeSet;
        for (const auto& a : ligand.atoms) {
            if (!a.autoDockTypeStr.empty()) {
                typeSet.insert(a.autoDockTypeStr);
            }
        }
        std::vector<std::string> requiredTypes(typeSet.begin(), typeSet.end());

        // 4. Precalculate 3D potential grids
        if (progressCallback) progressCallback(40, "Precalculating 3D affinity potential grids...");
        auto gridMap = std::make_shared<GridMap>(actualParams.gridBox);
        gridMap->computeFromReceptor(receptor, requiredTypes);

        // 5. Initialize Scoring Function & Search Algorithm
        if (progressCallback) progressCallback(60, "Executing Monte Carlo conformational search...");
        EmpiricalScore scoreFunction(gridMap);
        MonteCarloSearch searchEngine;

        // 6. Perform conformational search & pose clustering
        std::vector<DockingPose> rankedPoses = searchEngine.search(receptor, ligand, scoreFunction, actualParams);

        if (progressCallback) progressCallback(90, "Clustering poses and calculating binding free energy...");

        if (rankedPoses.empty()) {
            result.errorMessage = "No valid binding poses converged inside the search box.";
            return result;
        }

        // 7. Calculate inhibition constant Ki = exp(deltaG / (R * T))
        // R = 1.9872036e-3 kcal/(mol*K), T = 298.15 K -> R*T = 0.592 kcal/mol
        double deltaG = rankedPoses.front().bindingAffinity;
        double kiMolar = std::exp(deltaG / 0.5924);
        double kiNanomolar = kiMolar * 1e9;

        result.success = true;
        result.bestAffinity = deltaG;
        result.estimatedKi = kiNanomolar;
        result.numPoses = static_cast<int>(rankedPoses.size());
        result.poses = rankedPoses;
        result.resultPDBQT = StructurePrep::exportPDBQT(ligand, rankedPoses);

        auto endTime = std::chrono::high_resolution_clock::now();
        result.totalExecutionTimeMs = std::chrono::duration<double, std::milli>(endTime - startTime).count();

        if (progressCallback) progressCallback(100, "Docking complete!");

        std::cout << "[DockingEngine] Docking completed in " << result.totalExecutionTimeMs << "ms. Best Affinity: "
                  << result.bestAffinity << " kcal/mol (Ki: " << result.estimatedKi << " nM), Poses: "
                  << result.numPoses << std::endl;

    } catch (const std::exception& e) {
        result.success = false;
        result.errorMessage = e.what();
    }

    return result;
}

} // namespace molexplorer::engine
