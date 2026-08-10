#pragma once

#include <string>
#include <vector>
#include <cmath>
#include <array>
#include <memory>
#include <map>
#include <iostream>

namespace molexplorer::engine {

struct Vector3 {
    double x = 0.0;
    double y = 0.0;
    double z = 0.0;

    Vector3() = default;
    Vector3(double x_, double y_, double z_) : x(x_), y(y_), z(z_) {}

    Vector3 operator+(const Vector3& o) const { return {x + o.x, y + o.y, z + o.z}; }
    Vector3 operator-(const Vector3& o) const { return {x - o.x, y - o.y, z - o.z}; }
    Vector3 operator*(double s) const { return {x * s, y * s, z * s}; }
    Vector3 operator/(double s) const { return {x / s, y / s, z / s}; }

    Vector3& operator+=(const Vector3& o) { x += o.x; y += o.y; z += o.z; return *this; }
    Vector3& operator-=(const Vector3& o) { x -= o.x; y -= o.y; z -= o.z; return *this; }
    Vector3& operator*=(double s) { x *= s; y *= s; z *= s; return *this; }

    double dot(const Vector3& o) const { return x * o.x + y * o.y + z * o.z; }
    Vector3 cross(const Vector3& o) const {
        return {
            y * o.z - z * o.y,
            z * o.x - x * o.z,
            x * o.y - y * o.x
        };
    }

    double lengthSq() const { return x * x + y * y + z * z; }
    double length() const { return std::sqrt(lengthSq()); }

    Vector3 normalized() const {
        double len = length();
        if (len < 1e-12) return {0.0, 0.0, 0.0};
        return *this / len;
    }

    double distanceTo(const Vector3& o) const {
        return (*this - o).length();
    }
};

struct Quaternion {
    double w = 1.0;
    double x = 0.0;
    double y = 0.0;
    double z = 0.0;

    Quaternion() = default;
    Quaternion(double w_, double x_, double y_, double z_) : w(w_), x(x_), y(y_), z(z_) {}

    static Quaternion fromAxisAngle(const Vector3& axis, double angleRad) {
        Vector3 normAxis = axis.normalized();
        double half = angleRad * 0.5;
        double s = std::sin(half);
        return {std::cos(half), normAxis.x * s, normAxis.y * s, normAxis.z * s};
    }

    Quaternion normalized() const {
        double n = std::sqrt(w * w + x * x + y * y + z * z);
        if (n < 1e-12) return {1.0, 0.0, 0.0, 0.0};
        return {w / n, x / n, y / n, z / n};
    }

    Vector3 rotate(const Vector3& v) const {
        // v' = q * (0, v) * q^-1
        Vector3 u(x, y, z);
        double s = w;
        return u * (2.0 * u.dot(v)) + v * (s * s - u.dot(u)) + u.cross(v) * (2.0 * s);
    }
};

enum class AtomType {
    C_Aliphatic,
    C_Aromatic,
    N_HDonor,
    N_HAcceptor,
    N_Both,
    O_HAcceptor,
    O_HDonorAcceptor,
    S_Sulfur,
    P_Phosphorus,
    F_Fluorine,
    Cl_Chlorine,
    Br_Bromine,
    I_Iodine,
    H_Polar,
    H_Nonpolar,
    Metal,
    Unknown
};

struct Atom {
    int id = 0;
    std::string name;
    std::string element;
    Vector3 position;
    Vector3 originalPosition;
    double partialCharge = 0.0;
    double formalCharge = 0.0;
    AtomType autoDockType = AtomType::Unknown;
    std::string autoDockTypeStr = "C";
    int residueSeq = 1;
    std::string residueName = "LIG";
    std::string chainId = "A";
    bool isHetero = false;
    bool isHydrogen = false;
    int hybridization = 3; // 1 = sp, 2 = sp2, 3 = sp3
    std::vector<int> bondedAtomIds;
};

struct RotatableBond {
    int atomA = 0;
    int atomB = 0;
    std::vector<int> movingAtomIds; // Subtree of atoms that rotate around bond A->B
};

struct Molecule {
    std::string name;
    std::vector<Atom> atoms;
    std::vector<RotatableBond> rotatableBonds;
    Vector3 centerOfMass;
    int rootAtomIndex = 0;

    void computeCenterOfMass() {
        if (atoms.empty()) return;
        Vector3 sum{0, 0, 0};
        for (const auto& a : atoms) {
            sum += a.position;
        }
        centerOfMass = sum / static_cast<double>(atoms.size());
    }
};

struct GridBox {
    Vector3 center{0.0, 0.0, 0.0};
    Vector3 size{20.0, 20.0, 20.0}; // in Angstroms
    double spacing = 0.375;         // standard 0.375 A spacing

    int numPointsX() const { return static_cast<int>(size.x / spacing) + 1; }
    int numPointsY() const { return static_cast<int>(size.y / spacing) + 1; }
    int numPointsZ() const { return static_cast<int>(size.z / spacing) + 1; }

    Vector3 minCorner() const {
        return center - (size * 0.5);
    }
};

struct DockingPose {
    int poseIndex = 0;
    double bindingAffinity = 0.0; // kcal/mol
    double rmsdFromReference = 0.0;
    double rmsdFromLeader = 0.0;
    int clusterRank = 0;
    int clusterSize = 1;
    std::vector<Atom> transformedAtoms;
    Vector3 translation;
    Quaternion rotation;
    std::vector<double> torsionAngles; // in radians
};

struct DockingParameters {
    GridBox gridBox;
    int exhaustiveness = 8;
    int numPoses = 9;
    double energyRange = 3.0; // kcal/mol
    unsigned int randomSeed = 42;
};

} // namespace molexplorer::engine
