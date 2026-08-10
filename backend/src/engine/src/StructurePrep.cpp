#include "../include/StructurePrep.hpp"
#include "../include/GasteigerCharges.hpp"
#include <sstream>
#include <iomanip>
#include <algorithm>
#include <set>
#include <queue>

namespace molexplorer::engine {

Molecule StructurePrep::parsePDB(const std::string& pdbContent) {
    Molecule mol;
    std::istringstream stream(pdbContent);
    std::string line;

    while (std::getline(stream, line)) {
        if (line.rfind("ATOM  ", 0) == 0 || line.rfind("HETATM", 0) == 0) {
            if (line.length() < 54) continue;
            Atom a;
            try {
                a.id = std::stoi(line.substr(6, 5));
                a.name = line.substr(12, 4);
                // Trim whitespace
                a.name.erase(0, a.name.find_first_not_of(" "));
                a.name.erase(a.name.find_last_not_of(" ") + 1);

                a.residueName = line.substr(17, 3);
                a.chainId = line.substr(21, 1);
                a.residueSeq = std::stoi(line.substr(22, 4));

                double x = std::stod(line.substr(30, 8));
                double y = std::stod(line.substr(38, 8));
                double z = std::stod(line.substr(46, 8));
                a.position = {x, y, z};
                a.originalPosition = a.position;

                if (line.length() >= 78) {
                    a.element = line.substr(76, 2);
                    a.element.erase(0, a.element.find_first_not_of(" "));
                    a.element.erase(a.element.find_last_not_of(" ") + 1);
                }
                if (a.element.empty()) {
                    for (char c : a.name) {
                        if (std::isalpha(c)) {
                            a.element += c;
                            if (a.element.length() == 2 && std::islower(c)) break;
                            if (a.element.length() == 1 && (c == 'C' || c == 'N' || c == 'O' || c == 'S' || c == 'P' || c == 'H' || c == 'F')) break;
                        }
                    }
                }
                for (auto& c : a.element) c = static_cast<char>(std::toupper(c));
                a.isHydrogen = (a.element == "H");
                a.isHetero = (line.rfind("HETATM", 0) == 0);

                mol.atoms.push_back(a);
            } catch (...) {
                continue;
            }
        }
    }

    mol.computeCenterOfMass();
    return mol;
}

Molecule StructurePrep::parsePDBQT(const std::string& pdbqtContent) {
    Molecule mol;
    std::istringstream stream(pdbqtContent);
    std::string line;

    while (std::getline(stream, line)) {
        if (line.rfind("ATOM  ", 0) == 0 || line.rfind("HETATM", 0) == 0) {
            if (line.length() < 54) continue;
            Atom a;
            try {
                a.id = std::stoi(line.substr(6, 5));
                a.name = line.substr(12, 4);
                a.name.erase(0, a.name.find_first_not_of(" "));
                a.name.erase(a.name.find_last_not_of(" ") + 1);

                a.residueName = line.substr(17, 3);
                a.chainId = line.substr(21, 1);
                a.residueSeq = std::stoi(line.substr(22, 4));

                double x = std::stod(line.substr(30, 8));
                double y = std::stod(line.substr(38, 8));
                double z = std::stod(line.substr(46, 8));
                a.position = {x, y, z};
                a.originalPosition = a.position;

                if (line.length() >= 70) {
                    try {
                        a.partialCharge = std::stod(line.substr(69, 6));
                    } catch (...) {
                        a.partialCharge = 0.0;
                    }
                }
                if (line.length() >= 77) {
                    a.autoDockTypeStr = line.substr(77, 2);
                    a.autoDockTypeStr.erase(0, a.autoDockTypeStr.find_first_not_of(" "));
                    a.autoDockTypeStr.erase(a.autoDockTypeStr.find_last_not_of(" ") + 1);
                }

                if (a.element.empty()) {
                    a.element = a.autoDockTypeStr;
                    if (a.element == "HD") a.element = "H";
                    if (a.element == "OA" || a.element == "NA" || a.element == "SA") a.element = a.element.substr(0, 1);
                    if (a.element == "A") a.element = "C";
                }

                a.isHydrogen = (a.element == "H" || a.autoDockTypeStr == "HD");
                a.isHetero = (line.rfind("HETATM", 0) == 0);
                mol.atoms.push_back(a);
            } catch (...) {
                continue;
            }
        }
    }

    mol.computeCenterOfMass();
    return mol;
}

std::string StructurePrep::exportPDBQT(const Molecule& mol, const std::vector<DockingPose>& poses) {
    std::ostringstream ss;

    if (poses.empty()) {
        ss << "MODEL 1\n";
        for (const auto& a : mol.atoms) {
            ss << std::left << std::setw(6) << (a.isHetero ? "HETATM" : "ATOM  ")
               << std::right << std::setw(5) << a.id << " "
               << std::left << std::setw(4) << a.name << " "
               << std::left << std::setw(3) << a.residueName << " "
               << std::setw(1) << a.chainId
               << std::right << std::setw(4) << a.residueSeq << "    "
               << std::fixed << std::setprecision(3)
               << std::setw(8) << a.position.x
               << std::setw(8) << a.position.y
               << std::setw(8) << a.position.z
               << std::setprecision(2)
               << std::setw(6) << 1.00
               << std::setw(6) << 0.00 << "    "
               << std::setprecision(3)
               << std::setw(6) << a.partialCharge << " "
               << std::left << std::setw(2) << a.autoDockTypeStr
               << "\n";
        }
        ss << "ENDMDL\n";
        return ss.str();
    }

    for (size_t p = 0; p < poses.size(); ++p) {
        const auto& pose = poses[p];
        ss << "MODEL " << (p + 1) << "\n";
        ss << "REMARK  VINA RESULT: " << std::fixed << std::setprecision(1)
           << std::setw(8) << pose.bindingAffinity << "  "
           << std::setprecision(3)
           << std::setw(8) << pose.rmsdFromLeader << "  "
           << std::setw(8) << pose.rmsdFromReference << "\n";

        for (const auto& a : pose.transformedAtoms) {
            ss << std::left << std::setw(6) << (a.isHetero ? "HETATM" : "ATOM  ")
               << std::right << std::setw(5) << a.id << " "
               << std::left << std::setw(4) << a.name << " "
               << std::left << std::setw(3) << a.residueName << " "
               << std::setw(1) << a.chainId
               << std::right << std::setw(4) << a.residueSeq << "    "
               << std::fixed << std::setprecision(3)
               << std::setw(8) << a.position.x
               << std::setw(8) << a.position.y
               << std::setw(8) << a.position.z
               << std::setprecision(2)
               << std::setw(6) << 1.00
               << std::setw(6) << 0.00 << "    "
               << std::setprecision(3)
               << std::setw(6) << a.partialCharge << " "
               << std::left << std::setw(2) << a.autoDockTypeStr
               << "\n";
        }
        ss << "ENDMDL\n";
    }

    return ss.str();
}

void StructurePrep::assignBondsByDistance(Molecule& mol) {
    const size_t n = mol.atoms.size();
    for (size_t i = 0; i < n; ++i) {
        mol.atoms[i].bondedAtomIds.clear();
    }

    for (size_t i = 0; i < n; ++i) {
        for (size_t j = i + 1; j < n; ++j) {
            double dist = mol.atoms[i].position.distanceTo(mol.atoms[j].position);
            double maxBondDist = 1.95;
            if (mol.atoms[i].isHydrogen || mol.atoms[j].isHydrogen) {
                maxBondDist = 1.25;
            }
            if (dist > 0.4 && dist <= maxBondDist) {
                mol.atoms[i].bondedAtomIds.push_back(mol.atoms[j].id);
                mol.atoms[j].bondedAtomIds.push_back(mol.atoms[i].id);
            }
        }
    }
}

void StructurePrep::assignHybridizationAndValence(Molecule& mol) {
    for (auto& a : mol.atoms) {
        if (a.isHydrogen) {
            a.hybridization = 1;
            continue;
        }

        if (a.element == "C") {
            bool hasDoubleO = false;
            for (int bId : a.bondedAtomIds) {
                for (const auto& nb : mol.atoms) {
                    if (nb.id == bId && nb.element == "O" && a.position.distanceTo(nb.position) < 1.30) {
                        hasDoubleO = true;
                    }
                }
            }
            if (hasDoubleO || a.bondedAtomIds.size() == 3) {
                a.hybridization = 2;
                a.autoDockTypeStr = "A";
            } else {
                a.hybridization = 3;
                a.autoDockTypeStr = "C";
            }
        } else if (a.element == "N") {
            a.hybridization = 3;
            a.autoDockTypeStr = "N";
        } else if (a.element == "O") {
            bool isCarbonyl = false;
            for (int bId : a.bondedAtomIds) {
                for (const auto& nb : mol.atoms) {
                    if (nb.id == bId && nb.element == "C" && a.position.distanceTo(nb.position) < 1.30) {
                        isCarbonyl = true;
                    }
                }
            }
            a.hybridization = isCarbonyl ? 2 : 3;
            a.autoDockTypeStr = "OA";
        } else if (a.element == "S") {
            a.hybridization = 3;
            a.autoDockTypeStr = "SA";
        } else {
            a.hybridization = 3;
            a.autoDockTypeStr = a.element;
        }
    }
}

void StructurePrep::addMissingHydrogens(Molecule& mol) {
    std::vector<Atom> newHydrogens;
    int nextId = static_cast<int>(mol.atoms.size()) + 1;

    for (auto& a : mol.atoms) {
        if (a.isHydrogen) continue;

        int expectedValence = 4;
        if (a.element == "C") expectedValence = (a.hybridization == 2) ? 3 : 4;
        else if (a.element == "N") expectedValence = (a.hybridization == 2) ? 2 : 3;
        else if (a.element == "O") expectedValence = (a.hybridization == 2) ? 1 : 2;
        else if (a.element == "S") expectedValence = 2;
        else continue;

        int currentBonds = static_cast<int>(a.bondedAtomIds.size());
        int needed = expectedValence - currentBonds;
        if (needed <= 0) continue;

        Vector3 baseDir{0, 1, 0};
        if (!a.bondedAtomIds.empty()) {
            Vector3 avgBondVec{0, 0, 0};
            for (int bondedId : a.bondedAtomIds) {
                for (const auto& neighbor : mol.atoms) {
                    if (neighbor.id == bondedId) {
                        avgBondVec += (a.position - neighbor.position).normalized();
                        break;
                    }
                }
            }
            Vector3 norm = avgBondVec.normalized();
            if (norm.length() > 0.1) baseDir = norm;
        }

        double bondLen = (a.element == "C") ? 1.09 : ((a.element == "O") ? 0.96 : 1.01);
        Vector3 perpAxis = (std::abs(baseDir.x) < 0.8) ? Vector3{1, 0, 0} : Vector3{0, 1, 0};
        Vector3 ortho1 = baseDir.cross(perpAxis).normalized();
        Vector3 ortho2 = baseDir.cross(ortho1).normalized();

        for (int h = 0; h < needed; ++h) {
            Vector3 dir = baseDir;
            if (needed == 1) {
                dir = baseDir;
            } else if (needed == 2) {
                double angle = (h == 0 ? 0.95 : -0.95);
                dir = (baseDir * std::cos(angle) + ortho1 * std::sin(angle)).normalized();
            } else if (needed == 3) {
                double phi = (h * 2.0 * M_PI) / 3.0;
                double theta = 1.23; // ~70.5 deg
                Vector3 cone = ortho1 * std::cos(phi) + ortho2 * std::sin(phi);
                dir = (baseDir * std::cos(theta) + cone * std::sin(theta)).normalized();
            }

            Vector3 hPos = a.position + dir * bondLen;

            Atom hAtom;
            hAtom.id = nextId++;
            hAtom.name = "H" + std::to_string(a.id) + "_" + std::to_string(h + 1);
            hAtom.element = "H";
            hAtom.isHydrogen = true;
            hAtom.position = hPos;
            hAtom.originalPosition = hPos;
            hAtom.residueName = a.residueName;
            hAtom.residueSeq = a.residueSeq;
            hAtom.chainId = a.chainId;
            hAtom.isHetero = a.isHetero;
            hAtom.autoDockTypeStr = (a.element == "O" || a.element == "N" || a.element == "S") ? "HD" : "H";
            hAtom.bondedAtomIds.push_back(a.id);
            a.bondedAtomIds.push_back(hAtom.id);

            newHydrogens.push_back(hAtom);
        }
    }

    for (const auto& h : newHydrogens) {
        mol.atoms.push_back(h);
    }
}

void StructurePrep::assignAutoDockTypes(Molecule& mol) {
    for (auto& a : mol.atoms) {
        if (a.isHydrogen) {
            bool polar = false;
            for (int bId : a.bondedAtomIds) {
                for (const auto& nb : mol.atoms) {
                    if (nb.id == bId && (nb.element == "O" || nb.element == "N" || nb.element == "S")) {
                        polar = true; break;
                    }
                }
            }
            a.autoDockType = polar ? AtomType::H_Polar : AtomType::H_Nonpolar;
            a.autoDockTypeStr = polar ? "HD" : "H";
            continue;
        }

        if (a.element == "C") {
            if (a.hybridization == 2) {
                a.autoDockType = AtomType::C_Aromatic;
                a.autoDockTypeStr = "A";
            } else {
                a.autoDockType = AtomType::C_Aliphatic;
                a.autoDockTypeStr = "C";
            }
        } else if (a.element == "N") {
            bool hasH = false;
            for (int bId : a.bondedAtomIds) {
                for (const auto& nb : mol.atoms) {
                    if (nb.id == bId && nb.isHydrogen) { hasH = true; break; }
                }
            }
            if (hasH) {
                a.autoDockType = AtomType::N_HDonor;
                a.autoDockTypeStr = "N";
            } else {
                a.autoDockType = AtomType::N_HAcceptor;
                a.autoDockTypeStr = "NA";
            }
        } else if (a.element == "O") {
            a.autoDockType = AtomType::O_HAcceptor;
            a.autoDockTypeStr = "OA";
        } else if (a.element == "S") {
            a.autoDockType = AtomType::S_Sulfur;
            a.autoDockTypeStr = "SA";
        } else if (a.element == "P") {
            a.autoDockType = AtomType::P_Phosphorus;
            a.autoDockTypeStr = "P";
        } else if (a.element == "F") {
            a.autoDockType = AtomType::F_Fluorine;
            a.autoDockTypeStr = "F";
        } else if (a.element == "CL") {
            a.autoDockType = AtomType::Cl_Chlorine;
            a.autoDockTypeStr = "Cl";
        } else if (a.element == "BR") {
            a.autoDockType = AtomType::Br_Bromine;
            a.autoDockTypeStr = "Br";
        } else if (a.element == "I") {
            a.autoDockType = AtomType::I_Iodine;
            a.autoDockTypeStr = "I";
        } else {
            a.autoDockType = AtomType::Metal;
            a.autoDockTypeStr = a.element;
        }
    }
}

void StructurePrep::identifyRotatableBonds(Molecule& mol) {
    mol.rotatableBonds.clear();
    const size_t n = mol.atoms.size();

    std::map<int, size_t> idToIndex;
    for (size_t i = 0; i < n; ++i) {
        idToIndex[mol.atoms[i].id] = i;
    }

    for (size_t i = 0; i < n; ++i) {
        if (mol.atoms[i].isHydrogen) continue;

        for (int bId : mol.atoms[i].bondedAtomIds) {
            auto it = idToIndex.find(bId);
            if (it == idToIndex.end()) continue;
            size_t j = it->second;

            if (i >= j || mol.atoms[j].isHydrogen) continue;

            int heavyBondsI = 0, heavyBondsJ = 0;
            for (int nb : mol.atoms[i].bondedAtomIds) {
                auto nit = idToIndex.find(nb);
                if (nit != idToIndex.end() && !mol.atoms[nit->second].isHydrogen) heavyBondsI++;
            }
            for (int nb : mol.atoms[j].bondedAtomIds) {
                auto nit = idToIndex.find(nb);
                if (nit != idToIndex.end() && !mol.atoms[nit->second].isHydrogen) heavyBondsJ++;
            }

            if (heavyBondsI >= 2 && heavyBondsJ >= 2) {
                std::vector<int> movingIds;
                std::set<int> visited;
                visited.insert(mol.atoms[i].id);

                std::queue<int> q;
                q.push(mol.atoms[j].id);
                visited.insert(mol.atoms[j].id);

                bool isCycle = false;
                while (!q.empty()) {
                    int currId = q.front();
                    q.pop();
                    movingIds.push_back(currId);

                    auto cit = idToIndex.find(currId);
                    if (cit == idToIndex.end()) continue;

                    for (int nextId : mol.atoms[cit->second].bondedAtomIds) {
                        if (nextId == mol.atoms[i].id) {
                            isCycle = true;
                            break;
                        }
                        if (visited.find(nextId) == visited.end()) {
                            visited.insert(nextId);
                            q.push(nextId);
                        }
                    }
                    if (isCycle) break;
                }

                if (!isCycle && !movingIds.empty()) {
                    RotatableBond rb;
                    rb.atomA = mol.atoms[i].id;
                    rb.atomB = mol.atoms[j].id;
                    rb.movingAtomIds = movingIds;
                    mol.rotatableBonds.push_back(rb);
                }
            }
        }
    }
}

void StructurePrep::prepareLigand(Molecule& ligand) {
    assignBondsByDistance(ligand);
    assignHybridizationAndValence(ligand);
    addMissingHydrogens(ligand);
    assignBondsByDistance(ligand);
    assignAutoDockTypes(ligand);
    GasteigerCharges::assignCharges(ligand);
    identifyRotatableBonds(ligand);
    ligand.computeCenterOfMass();
}

void StructurePrep::prepareReceptor(Molecule& receptor) {
    assignBondsByDistance(receptor);
    assignHybridizationAndValence(receptor);
    addMissingHydrogens(receptor);
    assignBondsByDistance(receptor);
    assignAutoDockTypes(receptor);
    GasteigerCharges::assignCharges(receptor);
    receptor.computeCenterOfMass();
}

std::vector<Atom> StructurePrep::applyConformation(
    const Molecule& baseMol,
    const Vector3& translation,
    const Quaternion& rotation,
    const std::vector<double>& torsionAngles
) {
    std::vector<Atom> result = baseMol.atoms;
    const size_t n = result.size();
    if (n == 0) return result;

    std::map<int, size_t> idToIndex;
    for (size_t i = 0; i < n; ++i) {
        idToIndex[result[i].id] = i;
    }

    Vector3 com = baseMol.centerOfMass;
    for (auto& a : result) {
        a.position = a.originalPosition - com;
    }

    size_t numTorsions = std::min(torsionAngles.size(), baseMol.rotatableBonds.size());
    for (size_t t = 0; t < numTorsions; ++t) {
        double angle = torsionAngles[t];
        if (std::abs(angle) < 1e-6) continue;

        const auto& rb = baseMol.rotatableBonds[t];
        auto itA = idToIndex.find(rb.atomA);
        auto itB = idToIndex.find(rb.atomB);
        if (itA == idToIndex.end() || itB == idToIndex.end()) continue;

        Vector3 posA = result[itA->second].position;
        Vector3 posB = result[itB->second].position;
        Vector3 axis = (posB - posA).normalized();
        Quaternion rot = Quaternion::fromAxisAngle(axis, angle);

        for (int movingId : rb.movingAtomIds) {
            auto mit = idToIndex.find(movingId);
            if (mit != idToIndex.end()) {
                Vector3 rel = result[mit->second].position - posA;
                result[mit->second].position = posA + rot.rotate(rel);
            }
        }
    }

    for (auto& a : result) {
        a.position = translation + rotation.rotate(a.position);
    }

    return result;
}

} // namespace molexplorer::engine
