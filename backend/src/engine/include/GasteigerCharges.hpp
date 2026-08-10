#pragma once

#include "Types.hpp"
#include <vector>

namespace molexplorer::engine {

class GasteigerCharges {
public:
    struct ElementParams {
        double a = 0.0;
        double b = 0.0;
        double c = 0.0;
    };

    // Computes and assigns Gasteiger-Marsili partial charges to all atoms in the molecule
    static void assignCharges(Molecule& mol, int maxIterations = 6);

    // Returns empirical electronegativity parameters for an atom based on element and hybridization
    static ElementParams getParameters(const std::string& element, int hybridization);
};

} // namespace molexplorer::engine
