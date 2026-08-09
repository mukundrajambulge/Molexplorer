#pragma once
#include <drogon/HttpController.h>

namespace molexplorer::controllers {

class JobController : public drogon::HttpController<JobController> {
public:
    METHOD_LIST_BEGIN
    ADD_METHOD_TO(JobController::submitJob, "/api/v1/jobs", drogon::Post, drogon::Options);
    ADD_METHOD_TO(JobController::getJob, "/api/v1/jobs/{id}", drogon::Get, drogon::Options);
    ADD_METHOD_TO(JobController::listJobs, "/api/v1/jobs", drogon::Get, drogon::Options);
    ADD_METHOD_TO(JobController::deleteJob, "/api/v1/jobs/{id}", drogon::Delete, drogon::Options);
    METHOD_LIST_END

    void submitJob(const drogon::HttpRequestPtr& req,
                   std::function<void(const drogon::HttpResponsePtr&)>&& callback);

    void getJob(const drogon::HttpRequestPtr& req,
                std::function<void(const drogon::HttpResponsePtr&)>&& callback,
                std::string jobId);

    void listJobs(const drogon::HttpRequestPtr& req,
                  std::function<void(const drogon::HttpResponsePtr&)>&& callback);

    void deleteJob(const drogon::HttpRequestPtr& req,
                   std::function<void(const drogon::HttpResponsePtr&)>&& callback,
                   std::string jobId);
};

} // namespace molexplorer::controllers
