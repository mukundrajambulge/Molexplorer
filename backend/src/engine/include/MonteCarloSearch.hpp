#pragma once

#include "ISearchAlgorithm.hpp"
#include "IScoringFunction.hpp"
#include <random>

namespace molexplorer::engine {

class MonteCarloSearch : public ISearchAlgorithm {
public:
    int numStepsPerRun = 2500;
    int localMinSteps = 40;

    std::vector<DockingPose> search(
        const Molecule& receptor,
        const Molecule& ligand,
        const IScoringFunction& scoringFunction,
        const DockingParameters& params
    ) override;

private:
    // Performs local gradient-descent energy minimization on a pose
    void localMinimize(
        const Molecule& ligand,
        const IScoringFunction& scoringFunction,
        Vector3& translation,
        Quaternion& rotation,
        std::vector<double>& torsions,
        double& currentEnergy
    );
};

} // namespace molexplorer::engine
