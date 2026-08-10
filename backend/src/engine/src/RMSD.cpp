#include "../include/RMSD.hpp"
#include <cmath>
#include <algorithm>

namespace molexplorer::engine {

double RMSD::computeInSituRMSD(const std::vector<Atom>& poseA, const std::vector<Atom>& poseB) {
    double sumSq = 0.0;
    int count = 0;

    const size_t n = std::min(poseA.size(), poseB.size());
    for (size_t i = 0; i < n; ++i) {
        if (poseA[i].isHydrogen || poseB[i].isHydrogen) continue; // heavy atoms only
        double distSq = (poseA[i].position - poseB[i].position).lengthSq();
        sumSq += distSq;
        count++;
    }

    if (count == 0) return 0.0;
    return std::sqrt(sumSq / static_cast<double>(count));
}

double RMSD::computeSuperposedRMSD(const std::vector<Atom>& poseA, const std::vector<Atom>& poseB) {
    // 1. Centroid calculation
    Vector3 centerA{0, 0, 0}, centerB{0, 0, 0};
    int count = 0;

    const size_t n = std::min(poseA.size(), poseB.size());
    for (size_t i = 0; i < n; ++i) {
        if (poseA[i].isHydrogen || poseB[i].isHydrogen) continue;
        centerA += poseA[i].position;
        centerB += poseB[i].position;
        count++;
    }

    if (count == 0) return 0.0;
    centerA = centerA / static_cast<double>(count);
    centerB = centerB / static_cast<double>(count);

    // 2. Centered coordinates
    double sumSq = 0.0;
    for (size_t i = 0; i < n; ++i) {
        if (poseA[i].isHydrogen || poseB[i].isHydrogen) continue;
        Vector3 pa = poseA[i].position - centerA;
        Vector3 pb = poseB[i].position - centerB;
        sumSq += (pa - pb).lengthSq();
    }

    return std::sqrt(sumSq / static_cast<double>(count));
}

std::vector<std::vector<double>> RMSD::computePairwiseMatrix(const std::vector<DockingPose>& poses) {
    const size_t n = poses.size();
    std::vector<std::vector<double>> matrix(n, std::vector<double>(n, 0.0));

    for (size_t i = 0; i < n; ++i) {
        for (size_t j = i + 1; j < n; ++j) {
            double d = computeInSituRMSD(poses[i].transformedAtoms, poses[j].transformedAtoms);
            matrix[i][j] = d;
            matrix[j][i] = d;
        }
    }

    return matrix;
}

} // namespace molexplorer::engine
