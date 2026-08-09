#include "DownloadController.hpp"
#include "../storage/Database.hpp"
#include <fstream>
#include <sstream>

namespace molexplorer::controllers {

void DownloadController::downloadResult(const drogon::HttpRequestPtr& req,
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

    if (!jobOpt.has_value() || jobOpt->status != models::JobStatus::Completed) {
        Json::Value err;
        err["error"] = "Job results not ready or job not found.";
        auto resp = drogon::HttpResponse::newHttpJsonResponse(err);
        resp->setStatusCode(drogon::k404NotFound);
        callback(resp);
        return;
    }

    std::ifstream file(jobOpt->resultPath);
    if (!file.is_open()) {
        Json::Value err;
        err["error"] = "Result file not found on disk.";
        auto resp = drogon::HttpResponse::newHttpJsonResponse(err);
        resp->setStatusCode(drogon::k404NotFound);
        callback(resp);
        return;
    }

    std::stringstream buffer;
    buffer << file.rdbuf();

    auto resp = drogon::HttpResponse::newHttpResponse();
    resp->setStatusCode(drogon::k200OK);
    resp->setContentTypeCode(drogon::CT_CUSTOM);
    resp->setContentTypeString("chemical/x-pdbqt");
    resp->addHeader("Content-Disposition", "attachment; filename=\"" + jobId + "_docked.pdbqt\"");
    resp->setBody(buffer.str());
    callback(resp);
}

} // namespace molexplorer::controllers
