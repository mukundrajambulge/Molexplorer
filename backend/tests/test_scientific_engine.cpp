#include "../src/engine/include/Types.hpp"
#include "../src/engine/include/GasteigerCharges.hpp"
#include "../src/engine/include/StructurePrep.hpp"
#include "../src/engine/include/GridMap.hpp"
#include "../src/engine/include/EmpiricalScore.hpp"
#include "../src/engine/include/RMSD.hpp"
#include "../src/engine/include/PoseClustering.hpp"
#include "../src/engine/include/DockingEngine.hpp"
#include <iostream>
#include <cassert>
#include <cmath>
#include <iomanip>

using namespace molexplorer::engine;

void testGasteigerCharges() {
    std::cout << "\n[TEST 1] Testing Gasteiger-Marsili Partial Charge Engine..." << std::endl;

    // Build Ethanol: C1 - C2 - O - H
    Molecule ethanol;
    Atom c1; c1.id = 1; c1.name = "C1"; c1.element = "C"; c1.hybridization = 3; c1.position = {0, 0, 0};
    Atom c2; c2.id = 2; c2.name = "C2"; c2.element = "C"; c2.hybridization = 3; c2.position = {1.54, 0, 0};
    Atom o;  o.id = 3;  o.name = "O";  o.element = "O";  o.hybridization = 3; o.position = {2.20, 1.20, 0};
    Atom h;  h.id = 4;  h.name = "HO"; h.element = "H";  h.hybridization = 1; h.position = {2.90, 1.10, 0}; h.isHydrogen = true;

    c1.bondedAtomIds = {2};
    c2.bondedAtomIds = {1, 3};
    o.bondedAtomIds = {2, 4};
    h.bondedAtomIds = {3};

    ethanol.atoms = {c1, c2, o, h};

    GasteigerCharges::assignCharges(ethanol);

    std::cout << "   Ethanol Partial Charges:" << std::endl;
    for (const auto& a : ethanol.atoms) {
        std::cout << "      Atom " << a.name << " (" << a.element << "): " << std::fixed << std::setprecision(4) << a.partialCharge << " e" << std::endl;
    }

    // Assert chemical principles: Oxygen is electronegative (negative charge), Hydroxyl hydrogen is electropositive
    assert(ethanol.atoms[2].partialCharge < -0.20 && "Oxygen must acquire net negative partial charge");
    assert(ethanol.atoms[3].partialCharge > 0.15 && "Hydroxyl hydrogen must acquire net positive partial charge");

    std::cout << "   -> PASS: Gasteiger partial charges evaluated with correct electronegativity polarization." << std::endl;
}

void testHydrogenAdditionAndValence() {
    std::cout << "\n[TEST 2] Testing Valence-Aware Hydrogen Addition & Atom Typing..." << std::endl;

    // Build Acetone heavy atom skeleton: C1 - C2(=O) - C3
    Molecule acetone;
    Atom c1; c1.id = 1; c1.name = "C1"; c1.element = "C"; c1.position = {-1.30, 0.80, 0.0};
    Atom c2; c2.id = 2; c2.name = "C2"; c2.element = "C"; c2.position = {0.0, 0.0, 0.0};
    Atom o;  o.id = 3;  o.name = "O";  o.element = "O";  o.position = {0.0, -1.25, 0.0};
    Atom c3; c3.id = 4; c3.name = "C3"; c3.element = "C"; c3.position = {1.30, 0.80, 0.0};

    acetone.atoms = {c1, c2, o, c3};

    StructurePrep::assignBondsByDistance(acetone);
    StructurePrep::assignHybridizationAndValence(acetone);
    StructurePrep::addMissingHydrogens(acetone);
    StructurePrep::assignAutoDockTypes(acetone);

    std::cout << "   Acetone Prepared Atoms Count: " << acetone.atoms.size() << " (Expected: 10 atoms including 6 H)" << std::endl;
    assert(acetone.atoms.size() == 10 && "Acetone must contain exactly 10 atoms after full hydrogen addition");

    int hCount = 0;
    for (const auto& a : acetone.atoms) {
        if (a.isHydrogen) hCount++;
    }
    assert(hCount == 6 && "Acetone must have 6 hydrogens");

    std::cout << "   -> PASS: Valence-aware hydrogen geometry successfully generated 6 tetrahedral hydrogens." << std::endl;
}

void testGridMapAndInterpolation() {
    std::cout << "\n[TEST 3] Testing 3D Potential Grid Cache & Trilinear Interpolation..." << std::endl;

    GridBox box;
    box.center = {0.0, 0.0, 0.0};
    box.size = {10.0, 10.0, 10.0};
    box.spacing = 0.5;

    GridMap gridMap(box);

    // Mock receptor with a single carbonyl oxygen at origin
    Molecule receptor;
    Atom recO; recO.id = 1; recO.name = "OD1"; recO.element = "O"; recO.autoDockTypeStr = "OA";
    recO.position = {0.0, 0.0, 0.0};
    recO.partialCharge = -0.50;
    receptor.atoms = {recO};

    gridMap.computeFromReceptor(receptor, {"HD", "C", "OA"});

    // Interpolate energy at 2.8 A along X-axis for polar hydrogen (HD)
    Vector3 testPos{2.0, 0.0, 0.0};
    double eHD = gridMap.interpolate("HD", testPos);
    double eElec = gridMap.interpolate("e", testPos);

    std::cout << "   Grid Potential at (2.0, 0.0, 0.0): V_hbond=" << eHD << " kcal/mol, V_elec=" << eElec << std::endl;
    assert(eHD < 0.0 && "Hydrogen bond donor HD at 2.0 A from OA acceptor must have negative favorable potential");

    std::cout << "   -> PASS: O(1) trilinear interpolation correctly retrieves favorable H-bond potential." << std::endl;
}

void testRMSDAndClustering() {
    std::cout << "\n[TEST 4] Testing Kabsch RMSD Matrix & Greedy Leader Clustering..." << std::endl;

    std::vector<Atom> poseA = {
        {1, "C1", "C", {0.0, 0.0, 0.0}, {0,0,0}, 0, 0, AtomType::C_Aliphatic, "C"},
        {2, "C2", "C", {1.5, 0.0, 0.0}, {0,0,0}, 0, 0, AtomType::C_Aliphatic, "C"},
        {3, "O1", "O", {2.0, 1.2, 0.0}, {0,0,0}, 0, 0, AtomType::O_HAcceptor, "OA"}
    };

    std::vector<Atom> poseB = {
        {1, "C1", "C", {0.2, 0.1, 0.0}, {0,0,0}, 0, 0, AtomType::C_Aliphatic, "C"},
        {2, "C2", "C", {1.7, 0.1, 0.0}, {0,0,0}, 0, 0, AtomType::C_Aliphatic, "C"},
        {3, "O1", "O", {2.2, 1.3, 0.0}, {0,0,0}, 0, 0, AtomType::O_HAcceptor, "OA"}
    };

    std::vector<Atom> poseC = {
        {1, "C1", "C", {5.0, 5.0, 5.0}, {0,0,0}, 0, 0, AtomType::C_Aliphatic, "C"},
        {2, "C2", "C", {6.5, 5.0, 5.0}, {0,0,0}, 0, 0, AtomType::C_Aliphatic, "C"},
        {3, "O1", "O", {7.0, 6.2, 5.0}, {0,0,0}, 0, 0, AtomType::O_HAcceptor, "OA"}
    };

    double rmsdAB = RMSD::computeInSituRMSD(poseA, poseB);
    double rmsdAC = RMSD::computeInSituRMSD(poseA, poseC);

    std::cout << "   RMSD(PoseA, PoseB) = " << std::fixed << std::setprecision(3) << rmsdAB << " A" << std::endl;
    std::cout << "   RMSD(PoseA, PoseC) = " << std::fixed << std::setprecision(3) << rmsdAC << " A" << std::endl;

    assert(rmsdAB < 0.5 && "Pose A and Pose B are near duplicates");
    assert(rmsdAC > 5.0 && "Pose A and Pose C are distant binding modes");

    std::vector<DockingPose> rawPoses = {
        {1, -9.2, 0, 0, 0, 1, poseA, {0,0,0}, {1,0,0,0}, {}},
        {2, -9.0, 0, 0, 0, 1, poseB, {0,0,0}, {1,0,0,0}, {}},
        {3, -7.5, 0, 0, 0, 1, poseC, {0,0,0}, {1,0,0,0}, {}}
    };

    auto clustered = PoseClustering::clusterAndRank(rawPoses, 2.0, 5, 3.0);
    std::cout << "   Clustered " << rawPoses.size() << " poses into " << clustered.size() << " distinct binding mode clusters." << std::endl;
    assert(clustered.size() == 2 && "Must cluster 3 raw poses into 2 distinct clusters");
    assert(clustered[0].clusterSize == 2 && "Leader 1 must contain 2 poses");

    std::cout << "   -> PASS: Greedy leader clustering correctly condensed poses into distinct binding modes." << std::endl;
}

void testEndToEndDocking() {
    std::cout << "\n[TEST 5] Testing End-to-End Molecular Docking Pipeline..." << std::endl;

    // Receptor PDB: Catalytic Dyad Asp25 of HIV-1 Protease
    std::string mockReceptorPDB =
        "ATOM      1  N   ASP A  25       0.000   0.000   0.000  1.00 20.00           N\n"
        "ATOM      2  CA  ASP A  25       1.450   0.000   0.000  1.00 20.00           C\n"
        "ATOM      3  C   ASP A  25       2.000   1.400   0.000  1.00 20.00           C\n"
        "ATOM      4  O   ASP A  25       1.300   2.400   0.000  1.00 20.00           O\n"
        "ATOM      5  CB  ASP A  25       2.000  -0.800   1.200  1.00 20.00           C\n"
        "ATOM      6  CG  ASP A  25       1.500  -0.200   2.500  1.00 20.00           C\n"
        "ATOM      7  OD1 ASP A  25       0.300  -0.400   2.800  1.00 20.00           O\n"
        "ATOM      8  OD2 ASP A  25       2.300   0.400   3.200  1.00 20.00           O\n";

    // Ligand PDB: Small inhibitor fragment
    std::string mockLigandPDB =
        "HETATM    1  C1  LIG     1       0.500  -0.200   4.500  1.00  0.00           C\n"
        "HETATM    2  O1  LIG     1       0.400  -0.300   3.100  1.00  0.00           O\n"
        "HETATM    3  N1  LIG     1       1.800  -0.100   5.100  1.00  0.00           N\n"
        "HETATM    4  C2  LIG     1       2.900   0.100   4.200  1.00  0.00           C\n";

    DockingParameters params;
    params.gridBox.center = {1.5, 0.0, 3.0};
    params.gridBox.size = {12.0, 12.0, 12.0};
    params.exhaustiveness = 6;
    params.numPoses = 5;

    auto result = DockingEngine::runDocking(mockReceptorPDB, mockLigandPDB, params);

    assert(result.success && "Docking must execute successfully");
    assert(result.numPoses > 0 && "Must generate at least one valid docked pose");
    assert(result.bestAffinity < 0.0 && "Best binding affinity must be favorable (negative kcal/mol)");
    assert(!result.resultPDBQT.empty() && "PDBQT output must not be empty");

    std::cout << "   Docking Execution Time: " << result.totalExecutionTimeMs << " ms" << std::endl;
    std::cout << "   Best Binding Free Energy: " << result.bestAffinity << " kcal/mol" << std::endl;
    std::cout << "   Estimated Ki: " << result.estimatedKi << " nM" << std::endl;
    std::cout << "   Poses Generated: " << result.numPoses << std::endl;

    std::cout << "   -> PASS: Complete custom scientific molecular docking engine passed all biophysical checks!" << std::endl;
}

int main() {
    std::cout << "=================================================================" << std::endl;
    std::cout << "   MOLEXPLORER SCIENTIFIC MOLECULAR DOCKING ENGINE TEST SUITE   " << std::endl;
    std::cout << "=================================================================" << std::endl;

    testGasteigerCharges();
    testHydrogenAdditionAndValence();
    testGridMapAndInterpolation();
    testRMSDAndClustering();
    testEndToEndDocking();

    std::cout << "\n=================================================================" << std::endl;
    std::cout << "   ALL 5 SCIENTIFIC DOCKING ENGINE TESTS PASSED (100.0% SUCCESS) " << std::endl;
    std::cout << "=================================================================" << std::endl;
    return 0;
}
