#include "../include/EmpiricalScore.hpp"
#include <cmath>
#include <set>
#include <map>

namespace molexplorer::engine {

EmpiricalScore::EmpiricalScore(std::shared_ptr<GridMap> grid)
    : gridMap(std::move(grid)) {}

double EmpiricalScore::score(const Molecule& ligand, const Molecule& receptor) const {
    if (gridMap) {
        return scorePose(ligand.atoms);
    }

    double totalEnergy = 0.0;
    for (const auto& la : ligand.atoms) {
        for (const auto& ra : receptor.atoms) {
            double d = la.position.distanceTo(ra.position);
            if (d < 0.6) d = 0.6;
            if (d > 10.0) continue;

            double qProd = la.partialCharge * ra.partialCharge;
            totalEnergy += (332.0 * qProd) / (4.0 * d * d);

            double r0 = 3.6;
            double r_ratio = r0 / d;
            double r6 = std::pow(r_ratio, 6);
            double r12 = r6 * r6;
            totalEnergy += 0.15 * (r12 - 2.0 * r6);
        }
    }

    return totalEnergy;
}

double EmpiricalScore::scorePose(const std::vector<Atom>& ligandAtoms) const {
    if (!gridMap) return 0.0;

    double energy = 0.0;

    for (const auto& a : ligandAtoms) {
        if (a.isHydrogen && a.autoDockTypeStr != "HD") continue;

        double vdwAffinity = gridMap->interpolate(a.autoDockTypeStr, a.position);
        double elecGrid = gridMap->interpolate("e", a.position);
        double elecEnergy = a.partialCharge * elecGrid;

        energy += (vdwAffinity + elecEnergy);
    }

    energy += computeInternalEnergy(ligandAtoms);
    return energy;
}

double EmpiricalScore::computeInternalEnergy(const std::vector<Atom>& atoms) const {
    double internalE = 0.0;
    const size_t n = atoms.size();

    // Map atom ID to index
    std::map<int, size_t> idMap;
    for (size_t i = 0; i < n; ++i) {
        idMap[atoms[i].id] = i;
    }

    // Build 1-2 and 1-3 exclusion sets
    std::map<int, std::set<int>> exclusions;
    for (size_t i = 0; i < n; ++i) {
        exclusions[atoms[i].id].insert(atoms[i].id);
        for (int bId : atoms[i].bondedAtomIds) {
            exclusions[atoms[i].id].insert(bId);
            auto it = idMap.find(bId);
            if (it != idMap.end()) {
                for (int cId : atoms[it->second].bondedAtomIds) {
                    exclusions[atoms[i].id].insert(cId);
                }
            }
        }
    }

    for (size_t i = 0; i < n; ++i) {
        if (atoms[i].isHydrogen) continue;
        const auto& excl = exclusions[atoms[i].id];

        for (size_t j = i + 1; j < n; ++j) {
            if (atoms[j].isHydrogen) continue;
            if (excl.find(atoms[j].id) != excl.end()) continue; // Skip 1-2 and 1-3 bonded pairs

            double dist = atoms[i].position.distanceTo(atoms[j].position);
            if (dist < 1.8) {
                double clash = 1.8 - dist;
                internalE += 10.0 * (clash * clash);
            }
        }
    }

    return internalE;
}

IScoringFunction::EnergyBreakdown EmpiricalScore::evaluateBreakdown(
    const std::vector<Atom>& ligandAtoms,
    int numRotatableBonds
) const {
    EnergyBreakdown eb;
    if (!gridMap) return eb;

    for (const auto& a : ligandAtoms) {
        double vdw = gridMap->interpolate(a.autoDockTypeStr, a.position);
        double elec = a.partialCharge * gridMap->interpolate("e", a.position);

        if (a.autoDockTypeStr == "HD" || a.autoDockTypeStr == "OA" || a.autoDockTypeStr == "NA") {
            if (vdw < 0) {
                eb.hbond += vdw * 0.4;
                eb.vdw += vdw * 0.6;
            } else {
                eb.vdw += vdw;
            }
        } else {
            eb.vdw += vdw;
        }

        eb.electrostatics += elec;
    }

    eb.desolvation = eb.vdw * 0.1;
    eb.torsionalPenalty = weightTorsion * static_cast<double>(numRotatableBonds);
    eb.total = eb.vdw + eb.electrostatics + eb.hbond + eb.desolvation + eb.torsionalPenalty;

    return eb;
}

} // namespace molexplorer::engine
