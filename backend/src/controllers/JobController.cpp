#include "JobController.hpp"
#include "../storage/Database.hpp"
#include "../worker/JobWorker.hpp"
#include <drogon/utils/Utilities.h>
#include <chrono>
#include <iomanip>
#include <sstream>

namespace molexplorer::controllers {

void JobController::submitJob(const drogon::HttpRequestPtr& req,
                              std::function<void(const drogon::HttpResponsePtr&)>&& callback) {
    if (req->getMethod() == drogon::Options) {
        auto resp = drogon::HttpResponse::newHttpResponse();
        resp->setStatusCode(drogon::k200OK);
        callback(resp);
        return;
    }

    auto json = req->getJsonObject();
    if (!json || !json->isMember("receptor_data") || !json->isMember("ligand_data")) {
        Json::Value err;
        err["error"] = "Missing receptor_data or ligand_data in request body.";
        auto resp = drogon::HttpResponse::newHttpJsonResponse(err);
        resp->setStatusCode(drogon::k400BadRequest);
        callback(resp);
        return;
    }

    models::Job job;
    job.id = drogon::utils::getUuid();
    job.userId = json->isMember("user_id") ? (*json)["user_id"].asString() : "anonymous";
    job.accuracyTier = json->isMember("accuracy_tier") ? (*json)["accuracy_tier"].asString() : "standard";
    job.receptorPath = "./uploads/" + job.id + "_receptor.pdb";
    job.ligandPath = "./uploads/" + job.id + "_ligand.sdf";
    job.status = models::JobStatus::Queued;
    job.progressPercent = 0;

    auto now = std::chrono::system_clock::now();
    auto in_time_t = std::chrono::system_clock::to_time_t(now);
    std::stringstream ss;
    ss << std::put_time(std::gmtime(&in_time_t), "%Y-%m-%dT%H:%M:%SZ");
    job.createdAt = ss.str();

    auto& db = storage::Database::getInstance();
    if (!db.createJob(job)) {
        Json::Value err;
        err["error"] = "Failed to enqueue job in database.";
        auto resp = drogon::HttpResponse::newHttpJsonResponse(err);
        resp->setStatusCode(drogon::k500InternalServerError);
        callback(resp);
        return;
    }

    // Wake up async worker pool
    worker::JobWorker::getInstance().notifyNewJob();

    Json::Value res;
    res["message"] = "Job submitted successfully and queued for asynchronous execution.";
    res["job_id"] = job.id;
    res["status"] = "queued";
    res["poll_url"] = "/api/v1/jobs/" + job.id;

    auto resp = drogon::HttpResponse::newHttpJsonResponse(res);
    resp->setStatusCode(drogon::k202Accepted);
    callback(resp);
}

void JobController::getJob(const drogon::HttpRequestPtr& req,
                           std::function<void(const drogon::HttpResponsePtr&)>&& callback,
                           std::string jobId) {
    if (req->getMethod() == drogon::Options) {
        auto resp = drogon::HttpResponse::newHttpResponse();
        resp->setStatusCode(drogon::k200OK);
        callback(resp);
        return;
    }

    auto& db = storage::Database::getInstance();
    auto jobOpt = db.getJobById(jobId);

    if (!jobOpt.has_value()) {
        Json::Value err;
        err["error"] = "Job not found with ID: " + jobId;
        auto resp = drogon::HttpResponse::newHttpJsonResponse(err);
        resp->setStatusCode(drogon::k404NotFound);
        callback(resp);
        return;
    }

    auto resp = drogon::HttpResponse::newHttpJsonResponse(jobOpt->toJson());
    resp->setStatusCode(drogon::k200OK);
    callback(resp);
}

void JobController::listJobs(const drogon::HttpRequestPtr& req,
                            std::function<void(const drogon::HttpResponsePtr&)>&& callback) {
    if (req->getMethod() == drogon::Options) {
        auto resp = drogon::HttpResponse::newHttpResponse();
        resp->setStatusCode(drogon::k200OK);
        callback(resp);
        return;
    }

    std::string userId = req->getParameter("user_id");
    if (userId.empty()) userId = "anonymous";

    auto& db = storage::Database::getInstance();
    auto jobs = db.getJobsByUserId(userId, 50, 0);

    Json::Value res(Json::arrayValue);
    for (const auto& j : jobs) {
        res.append(j.toJson());
    }

    auto resp = drogon::HttpResponse::newHttpJsonResponse(res);
    resp->setStatusCode(drogon::k200OK);
    callback(resp);
}

void JobController::deleteJob(const drogon::HttpRequestPtr& req,
                             std::function<void(const drogon::HttpResponsePtr&)>&& callback,
                             std::string jobId) {
    if (req->getMethod() == drogon::Options) {
        auto resp = drogon::HttpResponse::newHttpResponse();
        resp->setStatusCode(drogon::k200OK);
        callback(resp);
        return;
    }

    auto& db = storage::Database::getInstance();
    if (!db.deleteJob(jobId)) {
        Json::Value err;
        err["error"] = "Failed to delete job or job not found.";
        auto resp = drogon::HttpResponse::newHttpJsonResponse(err);
        resp->setStatusCode(drogon::k404NotFound);
        callback(resp);
        return;
    }

    Json::Value res;
    res["message"] = "Job deleted successfully.";
    auto resp = drogon::HttpResponse::newHttpJsonResponse(res);
    resp->setStatusCode(drogon::k200OK);
    callback(resp);
}

} // namespace molexplorer::controllers
