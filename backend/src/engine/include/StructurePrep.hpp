#pragma once

#include "Types.hpp"
#include <string>
#include <vector>

namespace molexplorer::engine {

class StructurePrep {
public:
    // Fully prepares a receptor or ligand: assigns hybridization, adds hydrogens, calculates Gasteiger charges, and types atoms
    static void prepareLigand(Molecule& ligand);
    static void prepareReceptor(Molecule& receptor);

    // Parses raw PDB/PDBQT/MOL format text into a Molecule struct
    static Molecule parsePDB(const std::string& pdbContent);
    static Molecule parsePDBQT(const std::string& pdbqtContent);

    // Serializes a Molecule (and its poses) into standard multi-model PDBQT format
    static std::string exportPDBQT(const Molecule& mol, const std::vector<DockingPose>& poses = {});

    // Geometric & topological helper functions
    static void assignBondsByDistance(Molecule& mol);
    static void assignHybridizationAndValence(Molecule& mol);
    static void addMissingHydrogens(Molecule& mol);
    static void assignAutoDockTypes(Molecule& mol);
    static void identifyRotatableBonds(Molecule& mol);

    // Coordinate transformation
    static std::vector<Atom> applyConformation(
        const Molecule& baseMol,
        const Vector3& translation,
        const Quaternion& rotation,
        const std::vector<double>& torsionAngles
    );
};

} // namespace molexplorer::engine
