#pragma once

#include "Types.hpp"
#include "StructurePrep.hpp"
#include "GridMap.hpp"
#include "EmpiricalScore.hpp"
#include "MonteCarloSearch.hpp"
#include "PoseClustering.hpp"
#include <string>
#include <vector>
#include <memory>
#include <functional>

namespace molexplorer::engine {

struct DockingResult {
    bool success = false;
    std::string errorMessage;
    double bestAffinity = 0.0; // in kcal/mol
    double estimatedKi = 0.0;   // in nanomolar (nM)
    int numPoses = 0;
    std::vector<DockingPose> poses;
    std::string resultPDBQT;
    double totalExecutionTimeMs = 0.0;
};

class DockingEngine {
public:
    // Top-level entry point to execute a complete docking run
    static DockingResult runDocking(
        const std::string& receptorContent,
        const std::string& ligandContent,
        const DockingParameters& params,
        std::function<void(int percent, const std::string& stage)> progressCallback = nullptr
    );
};

} // namespace molexplorer::engine
