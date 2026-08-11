#pragma once

#include "Types.hpp"
#include <vector>

namespace molexplorer::engine {

class IScoringFunction {
public:
    virtual ~IScoringFunction() = default;

    // Evaluates total binding free energy (kcal/mol) for a given ligand pose against the receptor
    virtual double score(const Molecule& ligand, const Molecule& receptor) const = 0;

    // Fast grid-based evaluation of a pose
    virtual double scorePose(const std::vector<Atom>& ligandAtoms) const = 0;

    // Detailed breakdown of energetic terms
    struct EnergyBreakdown {
        double vdw = 0.0;
        double electrostatics = 0.0;
        double hbond = 0.0;
        double desolvation = 0.0;
        double torsionalPenalty = 0.0;
        double total = 0.0;
    };

    virtual EnergyBreakdown evaluateBreakdown(const std::vector<Atom>& ligandAtoms, int numRotatableBonds) const = 0;
};
} // namespace molexplorer::engine
