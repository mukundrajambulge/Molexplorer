#pragma once

#include "Types.hpp"
#include "IScoringFunction.hpp"
#include <vector>

namespace molexplorer::engine {

class ISearchAlgorithm {
public:
    virtual ~ISearchAlgorithm() = default;
    
    virtual std::vector<DockingPose> search(
        const Molecule& receptor,
        const Molecule& ligand,
        const IScoringFunction& scoringFunction,
        const DockingParameters& params
    ) = 0;
};

} // namespace molexplorer::engine
