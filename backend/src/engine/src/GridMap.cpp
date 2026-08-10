#include "../include/GridMap.hpp"
#include <cmath>
#include <algorithm>

namespace molexplorer::engine {

GridMap::GridMap(const GridBox& gridBox)
    : box(gridBox),
      nx(gridBox.numPointsX()),
      ny(gridBox.numPointsY()),
      nz(gridBox.numPointsZ()),
      minCorner(gridBox.minCorner()),
      spacing(gridBox.spacing) {}

void GridMap::computeFromReceptor(const Molecule& receptor, const std::vector<std::string>& atomTypes) {
    nx = box.numPointsX();
    ny = box.numPointsY();
    nz = box.numPointsZ();
    minCorner = box.minCorner();
    spacing = box.spacing;

    const size_t totalPoints = static_cast<size_t>(nx * ny * nz);
    if (totalPoints == 0) return;

    std::vector<std::string> allTypes = atomTypes;
    if (std::find(allTypes.begin(), allTypes.end(), "e") == allTypes.end()) {
        allTypes.push_back("e");
    }

    for (const auto& t : allTypes) {
        affinityGrids[t] = std::vector<double>(totalPoints, 0.0);
    }

    auto getVdwParams = [](const std::string& type) -> std::pair<double, double> {
        if (type == "C" || type == "A") return {2.00, 0.150};
        if (type == "N" || type == "NA") return {1.75, 0.160};
        if (type == "O" || type == "OA") return {1.60, 0.200};
        if (type == "S" || type == "SA") return {2.00, 0.200};
        if (type == "P") return {2.10, 0.200};
        if (type == "F") return {1.54, 0.080};
        if (type == "Cl") return {2.04, 0.276};
        if (type == "Br") return {2.16, 0.389};
        if (type == "I") return {2.36, 0.550};
        if (type == "HD" || type == "H") return {1.00, 0.020};
        return {1.80, 0.100};
    };

    const double invTwoSixth = 0.8908987; // 1 / (2^(1/6))

    for (int iz = 0; iz < nz; ++iz) {
        double pz = minCorner.z + iz * spacing;
        for (int iy = 0; iy < ny; ++iy) {
            double py = minCorner.y + iy * spacing;
            for (int ix = 0; ix < nx; ++ix) {
                double px = minCorner.x + ix * spacing;
                Vector3 gridPt{px, py, pz};
                size_t ptIdx = index(ix, iy, iz);

                double elecPotential = 0.0;

                for (const auto& recAtom : receptor.atoms) {
                    double dist = gridPt.distanceTo(recAtom.position);
                    if (dist < 0.6) dist = 0.6;
                    if (dist > 12.0) continue;

                    double dielectric = 4.0 * dist;
                    double qRec = recAtom.partialCharge;
                    elecPotential += (332.0 * qRec) / (dielectric * dist);

                    bool isHBond = (recAtom.autoDockTypeStr == "OA" || recAtom.autoDockTypeStr == "NA");

                    for (const auto& ligType : atomTypes) {
                        if (ligType == "e") continue;

                        double sigma = 0.0;
                        double epsIJ = 0.0;

                        if (isHBond && ligType == "HD") {
                            double rOpt = 1.9; // H-bond minimum at 1.9 A
                            sigma = rOpt * invTwoSixth;
                            epsIJ = 1.20;
                        } else {
                            auto [rRec, epsRec] = getVdwParams(recAtom.autoDockTypeStr);
                            auto [rLig, epsLig] = getVdwParams(ligType);
                            double rOpt = rRec + rLig;
                            sigma = rOpt * invTwoSixth;
                            epsIJ = std::sqrt(epsRec * epsLig);
                        }

                        double r_ratio = sigma / dist;
                        double r6 = std::pow(r_ratio, 6);
                        double r12 = r6 * r6;

                        double vdw = 4.0 * epsIJ * (r12 - r6);
                        if (vdw > 50.0) vdw = 50.0;

                        affinityGrids[ligType][ptIdx] += vdw;
                    }
                }

                affinityGrids["e"][ptIdx] = elecPotential;
            }
        }
    }
}

double GridMap::interpolate(const std::string& atomTypeStr, const Vector3& pos) const {
    auto it = affinityGrids.find(atomTypeStr);
    if (it == affinityGrids.end()) {
        it = affinityGrids.find("C");
        if (it == affinityGrids.end()) return 0.0;
    }

    const auto& grid = it->second;

    double gx = (pos.x - minCorner.x) / spacing;
    double gy = (pos.y - minCorner.y) / spacing;
    double gz = (pos.z - minCorner.z) / spacing;

    if (gx < 0.0 || gx >= nx - 1 || gy < 0.0 || gy >= ny - 1 || gz < 0.0 || gz >= nz - 1) {
        return 100.0;
    }

    int x0 = static_cast<int>(gx);
    int y0 = static_cast<int>(gy);
    int z0 = static_cast<int>(gz);

    int x1 = x0 + 1;
    int y1 = y0 + 1;
    int z1 = z0 + 1;

    double xd = gx - x0;
    double yd = gy - y0;
    double zd = gz - z0;

    double c000 = grid[index(x0, y0, z0)];
    double c100 = grid[index(x1, y0, z0)];
    double c010 = grid[index(x0, y1, z0)];
    double c110 = grid[index(x1, y1, z0)];
    double c001 = grid[index(x0, y0, z1)];
    double c101 = grid[index(x1, y0, z1)];
    double c011 = grid[index(x0, y1, z1)];
    double c111 = grid[index(x1, y1, z1)];

    double c00 = c000 * (1.0 - xd) + c100 * xd;
    double c01 = c001 * (1.0 - xd) + c101 * xd;
    double c10 = c010 * (1.0 - xd) + c110 * xd;
    double c11 = c011 * (1.0 - xd) + c111 * xd;

    double c0 = c00 * (1.0 - yd) + c10 * yd;
    double c1 = c01 * (1.0 - yd) + c11 * yd;

    return c0 * (1.0 - zd) + c1 * zd;
}

} // namespace molexplorer::engine
