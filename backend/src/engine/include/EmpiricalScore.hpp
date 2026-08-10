#pragma once

#include "IScoringFunction.hpp"
#include "GridMap.hpp"
#include <memory>

namespace molexplorer::engine {

class EmpiricalScore : public IScoringFunction {
public:
    std::shared_ptr<GridMap> gridMap;

    // Standard calibrated physical term weights
    double weightVdw = 0.40;
    double weightElec = 0.20;
    double weightHbond = 0.60;
    double weightDesolv = 0.15;
    double weightTorsion = 0.25;

    EmpiricalScore() = default;
    EmpiricalScore(std::shared_ptr<GridMap> grid);

    double score(const Molecule& ligand, const Molecule& receptor) const override;
    double scorePose(const std::vector<Atom>& ligandAtoms) const override;

    EnergyBreakdown evaluateBreakdown(const std::vector<Atom>& ligandAtoms, int numRotatableBonds) const override;

    // Intramolecular ligand energy
    double computeInternalEnergy(const std::vector<Atom>& atoms) const;
};

} // namespace molexplorer::engine
