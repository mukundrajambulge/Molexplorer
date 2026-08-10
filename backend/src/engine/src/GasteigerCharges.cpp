#include "../include/GasteigerCharges.hpp"
#include <algorithm>
#include <map>
#include <set>

namespace molexplorer::engine {

GasteigerCharges::ElementParams GasteigerCharges::getParameters(const std::string& element, int hybridization) {
    std::string el = element;
    for (auto& c : el) c = static_cast<char>(std::toupper(c));

    if (el == "H") {
        return {7.17, 6.24, -0.56};
    } else if (el == "C") {
        if (hybridization == 1) return {10.39, 9.45, 0.73}; // sp
        if (hybridization == 2) return {8.79, 9.32, 1.51};   // sp2 / aromatic
        return {7.98, 9.18, 1.88};                           // sp3
    } else if (el == "N") {
        if (hybridization == 1) return {15.68, 11.70, 0.0};
        if (hybridization == 2) return {12.87, 13.94, 3.89};
        return {11.54, 12.82, 3.83};
    } else if (el == "O") {
        if (hybridization == 2) return {17.07, 13.79, 0.47};
        return {14.18, 12.92, 1.39};
    } else if (el == "F") {
        return {14.66, 13.85, 2.31};
    } else if (el == "CL") {
        return {11.00, 9.69, 1.35};
    } else if (el == "BR") {
        return {10.08, 8.47, 1.16};
    } else if (el == "I") {
        return {9.90, 7.96, 0.96};
    } else if (el == "S") {
        if (hybridization == 2) return {11.20, 9.80, 1.20};
        return {10.14, 9.13, 1.38};
    } else if (el == "P") {
        return {8.90, 8.40, 1.20};
    }

    // Default fallback
    return {7.50, 7.00, 1.00};
}

void GasteigerCharges::assignCharges(Molecule& mol, int maxIterations) {
    if (mol.atoms.empty()) return;

    const size_t n = mol.atoms.size();
    std::vector<double> q(n, 0.0);
    std::vector<ElementParams> params(n);

    // Initialize charges with formal charges and fetch parameter constants
    for (size_t i = 0; i < n; ++i) {
        q[i] = mol.atoms[i].formalCharge;
        params[i] = getParameters(mol.atoms[i].element, mol.atoms[i].hybridization);
    }

    // Build ID to index map
    std::map<int, size_t> idToIndex;
    for (size_t i = 0; i < n; ++i) {
        idToIndex[mol.atoms[i].id] = i;
    }

    // Iterative Electronegativity Equalization
    double dampFactor = 1.0;
    for (int iter = 0; iter < maxIterations; ++iter) {
        dampFactor *= 0.5;
        std::vector<double> deltaQ(n, 0.0);

        // Compute current electronegativity for all atoms: chi = a + b*q + c*q^2
        std::vector<double> chi(n, 0.0);
        for (size_t i = 0; i < n; ++i) {
            chi[i] = params[i].a + params[i].b * q[i] + params[i].c * (q[i] * q[i]);
        }

        // Transfer charge across bonded neighbors
        for (size_t i = 0; i < n; ++i) {
            for (int neighborId : mol.atoms[i].bondedAtomIds) {
                auto it = idToIndex.find(neighborId);
                if (it == idToIndex.end()) continue;
                size_t j = it->second;

                if (i >= j) continue; // process each pair once

                if (chi[i] != chi[j]) {
                    double denom = params[i].a + params[i].b + params[j].a + params[j].b;
                    if (denom > 1e-6) {
                        double dq = ((chi[j] - chi[i]) / denom) * dampFactor;
                        deltaQ[i] += dq;
                        deltaQ[j] -= dq;
                    }
                }
            }
        }

        // Apply charge increments
        for (size_t i = 0; i < n; ++i) {
            q[i] += deltaQ[i];
        }
    }

    // Assign resulting partial charges back to atoms
    for (size_t i = 0; i < n; ++i) {
        mol.atoms[i].partialCharge = q[i];
    }
}

} // namespace molexplorer::engine
