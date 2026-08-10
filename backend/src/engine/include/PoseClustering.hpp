#pragma once

#include "Types.hpp"
#include <vector>

namespace molexplorer::engine {

class PoseClustering {
public:
    // Clusters candidate poses by heavy-atom RMSD and returns ranked cluster leaders
    static std::vector<DockingPose> clusterAndRank(
        std::vector<DockingPose>& rawPoses,
        double rmsdCutoff = 2.0,
        int maxPoses = 9,
        double energyRange = 3.0
    );
};

} // namespace molexplorer::engine
