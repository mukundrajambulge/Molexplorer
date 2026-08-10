#include "../include/MonteCarloSearch.hpp"
#include "../include/StructurePrep.hpp"
#include "../include/PoseClustering.hpp"
#include <cmath>
#include <iostream>

namespace molexplorer::engine {

std::vector<DockingPose> MonteCarloSearch::search(
    const Molecule& receptor,
    const Molecule& ligand,
    const IScoringFunction& scoringFunction,
    const DockingParameters& params
) {
    std::mt19937 rng(params.randomSeed);
    std::uniform_real_distribution<double> unif01(0.0, 1.0);
    std::uniform_real_distribution<double> angleDist(-M_PI, M_PI);
    std::normal_distribution<double> normDist(0.0, 1.0);

    const int numTorsions = static_cast<int>(ligand.rotatableBonds.size());
    const int totalRuns = std::max(params.exhaustiveness, 4);

    std::vector<DockingPose> allCandidates;
    const Vector3 boxCenter = params.gridBox.center;
    const Vector3 boxHalfSize = params.gridBox.size * 0.5;

    for (int run = 0; run < totalRuns; ++run) {
        // 1. Initial random state within grid box
        Vector3 currTrans = boxCenter + Vector3{
            (unif01(rng) * 2.0 - 1.0) * boxHalfSize.x * 0.8,
            (unif01(rng) * 2.0 - 1.0) * boxHalfSize.y * 0.8,
            (unif01(rng) * 2.0 - 1.0) * boxHalfSize.z * 0.8
        };

        Vector3 randAxis{normDist(rng), normDist(rng), normDist(rng)};
        Quaternion currRot = Quaternion::fromAxisAngle(randAxis, angleDist(rng));

        std::vector<double> currTorsions(numTorsions, 0.0);
        for (int t = 0; t < numTorsions; ++t) {
            currTorsions[t] = angleDist(rng);
        }

        auto currAtoms = StructurePrep::applyConformation(ligand, currTrans, currRot, currTorsions);
        double currEnergy = scoringFunction.scorePose(currAtoms);

        Vector3 bestTrans = currTrans;
        Quaternion bestRot = currRot;
        std::vector<double> bestTorsions = currTorsions;
        double bestRunEnergy = currEnergy;

        // 2. Simulated Annealing Metropolis Monte Carlo loop
        double temp = 1.5; // initial temperature (kcal/mol)
        const double coolingRate = 0.998;

        for (int step = 0; step < numStepsPerRun; ++step) {
            temp *= coolingRate;
            if (temp < 0.1) temp = 0.1;

            // Generate trial mutation
            Vector3 trialTrans = currTrans + Vector3{normDist(rng) * 0.4, normDist(rng) * 0.4, normDist(rng) * 0.4};

            // Keep within search box
            trialTrans.x = std::clamp(trialTrans.x, boxCenter.x - boxHalfSize.x, boxCenter.x + boxHalfSize.x);
            trialTrans.y = std::clamp(trialTrans.y, boxCenter.y - boxHalfSize.y, boxCenter.y + boxHalfSize.y);
            trialTrans.z = std::clamp(trialTrans.z, boxCenter.z - boxHalfSize.z, boxCenter.z + boxHalfSize.z);

            Vector3 stepAxis{normDist(rng), normDist(rng), normDist(rng)};
            Quaternion deltaRot = Quaternion::fromAxisAngle(stepAxis, normDist(rng) * 0.2);
            Quaternion trialRot = (deltaRot.rotate(Vector3{currRot.x, currRot.y, currRot.z}).length() > 0)
                ? Quaternion{currRot.w * deltaRot.w - currRot.x * deltaRot.x - currRot.y * deltaRot.y - currRot.z * deltaRot.z,
                             currRot.w * deltaRot.x + currRot.x * deltaRot.w + currRot.y * deltaRot.z - currRot.z * deltaRot.y,
                             currRot.w * deltaRot.y - currRot.x * deltaRot.z + currRot.y * deltaRot.w + currRot.z * deltaRot.x,
                             currRot.w * deltaRot.z + currRot.x * deltaRot.y - currRot.y * deltaRot.x + currRot.z * deltaRot.w}.normalized()
                : currRot;

            std::vector<double> trialTorsions = currTorsions;
            if (numTorsions > 0) {
                int tIdx = static_cast<int>(unif01(rng) * numTorsions);
                tIdx = std::clamp(tIdx, 0, numTorsions - 1);
                trialTorsions[tIdx] += normDist(rng) * 0.3;
                if (trialTorsions[tIdx] > M_PI) trialTorsions[tIdx] -= 2.0 * M_PI;
                if (trialTorsions[tIdx] < -M_PI) trialTorsions[tIdx] += 2.0 * M_PI;
            }

            auto trialAtoms = StructurePrep::applyConformation(ligand, trialTrans, trialRot, trialTorsions);
            double trialEnergy = scoringFunction.scorePose(trialAtoms);

            double deltaE = trialEnergy - currEnergy;

            // Metropolis acceptance criterion
            bool accept = false;
            if (deltaE < 0.0) {
                accept = true;
            } else {
                double prob = std::exp(-deltaE / temp);
                if (unif01(rng) < prob) {
                    accept = true;
                }
            }

            if (accept) {
                currTrans = trialTrans;
                currRot = trialRot;
                currTorsions = trialTorsions;
                currEnergy = trialEnergy;

                if (currEnergy < bestRunEnergy) {
                    bestRunEnergy = currEnergy;
                    bestTrans = currTrans;
                    bestRot = currRot;
                    bestTorsions = currTorsions;
                }
            }
        }

        // 3. Local energy minimization on the best pose of this run
        localMinimize(ligand, scoringFunction, bestTrans, bestRot, bestTorsions, bestRunEnergy);

        // Record candidate pose
        DockingPose pose;
        pose.bindingAffinity = bestRunEnergy;
        pose.translation = bestTrans;
        pose.rotation = bestRot;
        pose.torsionAngles = bestTorsions;
        pose.transformedAtoms = StructurePrep::applyConformation(ligand, bestTrans, bestRot, bestTorsions);

        allCandidates.push_back(pose);
    }

    // 4. Cluster and rank across all independent runs
    return PoseClustering::clusterAndRank(
        allCandidates,
        2.0, // 2.0 A RMSD cluster cutoff
        params.numPoses,
        params.energyRange
    );
}

void MonteCarloSearch::localMinimize(
    const Molecule& ligand,
    const IScoringFunction& scoringFunction,
    Vector3& translation,
    Quaternion& rotation,
    std::vector<double>& torsions,
    double& currentEnergy
) {
    const double stepSize = 0.05; // 0.05 A translation step
    const double rotStep = 0.02;  // radians

    for (int iter = 0; iter < localMinSteps; ++iter) {
        bool improved = false;

        // Coordinate gradient search on translation axes
        for (int axis = 0; axis < 3; ++axis) {
            for (double dir : {-1.0, 1.0}) {
                Vector3 trialT = translation;
                if (axis == 0) trialT.x += dir * stepSize;
                else if (axis == 1) trialT.y += dir * stepSize;
                else trialT.z += dir * stepSize;

                auto trialAtoms = StructurePrep::applyConformation(ligand, trialT, rotation, torsions);
                double e = scoringFunction.scorePose(trialAtoms);
                if (e < currentEnergy - 1e-4) {
                    currentEnergy = e;
                    translation = trialT;
                    improved = true;
                }
            }
        }

        // Rotation steps
        for (int axis = 0; axis < 3; ++axis) {
            for (double dir : {-1.0, 1.0}) {
                Vector3 rAxis{0, 0, 0};
                if (axis == 0) rAxis.x = 1.0;
                else if (axis == 1) rAxis.y = 1.0;
                else rAxis.z = 1.0;

                Quaternion dRot = Quaternion::fromAxisAngle(rAxis, dir * rotStep);
                Quaternion trialRot{
                    rotation.w * dRot.w - rotation.x * dRot.x - rotation.y * dRot.y - rotation.z * dRot.z,
                    rotation.w * dRot.x + rotation.x * dRot.w + rotation.y * dRot.z - rotation.z * dRot.y,
                    rotation.w * dRot.y - rotation.x * dRot.z + rotation.y * dRot.w + rotation.z * dRot.x,
                    rotation.w * dRot.z + rotation.x * dRot.y - rotation.y * dRot.x + rotation.z * dRot.w
                };
                trialRot = trialRot.normalized();

                auto trialAtoms = StructurePrep::applyConformation(ligand, translation, trialRot, torsions);
                double e = scoringFunction.scorePose(trialAtoms);
                if (e < currentEnergy - 1e-4) {
                    currentEnergy = e;
                    rotation = trialRot;
                    improved = true;
                }
            }
        }

        // Torsion steps
        for (size_t t = 0; t < torsions.size(); ++t) {
            for (double dir : {-1.0, 1.0}) {
                std::vector<double> trialTorsions = torsions;
                trialTorsions[t] += dir * rotStep;

                auto trialAtoms = StructurePrep::applyConformation(ligand, translation, rotation, trialTorsions);
                double e = scoringFunction.scorePose(trialAtoms);
                if (e < currentEnergy - 1e-4) {
                    currentEnergy = e;
                    torsions = trialTorsions;
                    improved = true;
                }
            }
        }

        if (!improved) break; // Converged to local minimum
    }
}

} // namespace molexplorer::engine
