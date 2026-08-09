#pragma once
#include <string>
#include <vector>
#include <json/json.h>

namespace molexplorer::models {

enum class JobStatus {
    Queued,
    Running,
    Completed,
    Failed,
    Cancelled
};

inline std::string jobStatusToString(JobStatus s) {
    switch (s) {
        case JobStatus::Queued: return "queued";
        case JobStatus::Running: return "running";
        case JobStatus::Completed: return "completed";
        case JobStatus::Failed: return "failed";
        case JobStatus::Cancelled: return "cancelled";
    }
    return "queued";
}

inline JobStatus stringToJobStatus(const std::string& str) {
    if (str == "running") return JobStatus::Running;
    if (str == "completed") return JobStatus::Completed;
    if (str == "failed") return JobStatus::Failed;
    if (str == "cancelled") return JobStatus::Cancelled;
    return JobStatus::Queued;
}

struct DockingResultPose {
    int modeNumber = 1;
    double affinityKcalMol = 0.0;
    double rmsdLowerBound = 0.0;
    double rmsdUpperBound = 0.0;
    std::string posePdbqtData;

    Json::Value toJson() const {
        Json::Value val;
        val["mode"] = modeNumber;
        val["affinity_kcal_mol"] = affinityKcalMol;
        val["rmsd_lb"] = rmsdLowerBound;
        val["rmsd_ub"] = rmsdUpperBound;
        return val;
    }
};

struct Job {
    std::string id;
    std::string userId;
    JobStatus status = JobStatus::Queued;
    std::string accuracyTier = "standard"; // fast, standard, rigorous
    std::string receptorPath;
    std::string ligandPath;
    std::string resultPath;
    std::string errorMessage;
    double bestAffinity = 0.0;
    int progressPercent = 0;
    std::string createdAt;
    std::string completedAt;
    std::vector<DockingResultPose> poses;

    Json::Value toJson() const {
        Json::Value val;
        val["job_id"] = id;
        val["user_id"] = userId;
        val["status"] = jobStatusToString(status);
        val["accuracy_tier"] = accuracyTier;
        val["receptor_path"] = receptorPath;
        val["ligand_path"] = ligandPath;
        val["result_path"] = resultPath;
        val["error_message"] = errorMessage;
        val["best_affinity_kcal_mol"] = bestAffinity;
        val["progress_percent"] = progressPercent;
        val["created_at"] = createdAt;
        val["completed_at"] = completedAt;
        
        Json::Value posesArray(Json::arrayValue);
        for (const auto& p : poses) {
            posesArray.append(p.toJson());
        }
        val["poses"] = posesArray;

        return val;
    }
};

} // namespace molexplorer::models
