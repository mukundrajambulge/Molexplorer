#include "../include/PoseClustering.hpp"
#include "../include/RMSD.hpp"
#include <algorithm>

namespace molexplorer::engine {

std::vector<DockingPose> PoseClustering::clusterAndRank(
    std::vector<DockingPose>& rawPoses,
    double rmsdCutoff,
    int maxPoses,
    double energyRange
) {
    if (rawPoses.empty()) return {};

    // 1. Sort candidate poses by binding free energy ascending (lowest kcal/mol is best)
    std::sort(rawPoses.begin(), rawPoses.end(), [](const DockingPose& a, const DockingPose& b) {
        return a.bindingAffinity < b.bindingAffinity;
    });

    double bestEnergy = rawPoses.front().bindingAffinity;
    std::vector<DockingPose> clusterLeaders;

    // 2. Greedy leader clustering
    for (auto& pose : rawPoses) {
        if (pose.bindingAffinity > bestEnergy + energyRange) {
            break; // Exceeds energy window
        }

        bool matchedCluster = false;
        for (auto& leader : clusterLeaders) {
            double d = RMSD::computeInSituRMSD(pose.transformedAtoms, leader.transformedAtoms);
            if (d <= rmsdCutoff) {
                leader.clusterSize++;
                matchedCluster = true;
                break;
            }
        }

        if (!matchedCluster) {
            pose.clusterRank = static_cast<int>(clusterLeaders.size()) + 1;
            pose.clusterSize = 1;
            if (clusterLeaders.empty()) {
                pose.rmsdFromLeader = 0.0;
            } else {
                pose.rmsdFromLeader = RMSD::computeInSituRMSD(pose.transformedAtoms, clusterLeaders.front().transformedAtoms);
            }
            clusterLeaders.push_back(pose);

            if (static_cast<int>(clusterLeaders.size()) >= maxPoses) {
                break;
            }
        }
    }

    // Assign final pose indices
    for (size_t i = 0; i < clusterLeaders.size(); ++i) {
        clusterLeaders[i].poseIndex = static_cast<int>(i) + 1;
    }

    return clusterLeaders;
}

} // namespace molexplorer::engine
