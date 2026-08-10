#pragma once

#include "Types.hpp"
#include <vector>
#include <map>
#include <string>

namespace molexplorer::engine {

class GridMap {
public:
    GridBox box;
    int nx = 0, ny = 0, nz = 0;
    Vector3 minCorner;
    double spacing = 0.375;

    // Affinity maps keyed by AutoDock atom type string (e.g. "C", "A", "OA", "NA", "HD", "e" for electrostatic)
    std::map<std::string, std::vector<double>> affinityGrids;

    GridMap() = default;
    GridMap(const GridBox& gridBox);

    // Computes and populates potential energy grids for the given receptor
    void computeFromReceptor(const Molecule& receptor, const std::vector<std::string>& atomTypes);

    // Fast O(1) trilinear interpolation of energy for an atom at (x,y,z)
    double interpolate(const std::string& atomTypeStr, const Vector3& pos) const;

    // Direct grid coordinate indexing
    inline size_t index(int ix, int iy, int iz) const {
        return static_cast<size_t>(iz * (nx * ny) + iy * nx + ix);
    }
};

} // namespace molexplorer::engine
