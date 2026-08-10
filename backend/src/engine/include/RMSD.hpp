#pragma once

#include "Types.hpp"
#include <vector>

namespace molexplorer::engine {

class RMSD {
public:
    // Computes in-situ heavy-atom RMSD (without translation/rotation alignment)
    static double computeInSituRMSD(const std::vector<Atom>& poseA, const std::vector<Atom>& poseB);

    // Computes superposed heavy-atom RMSD using the Kabsch optimal rotation algorithm
    static double computeSuperposedRMSD(const std::vector<Atom>& poseA, const std::vector<Atom>& poseB);

    // Builds a pairwise symmetric RMSD distance matrix for N poses
    static std::vector<std::vector<double>> computePairwiseMatrix(const std::vector<DockingPose>& poses);
};

} // namespace molexplorer::engine
