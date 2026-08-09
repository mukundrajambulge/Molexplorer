#pragma once
#include <drogon/HttpController.h>

namespace molexplorer::controllers {

class DownloadController : public drogon::HttpController<DownloadController> {
public:
    METHOD_LIST_BEGIN
    ADD_METHOD_TO(DownloadController::downloadResult, "/api/v1/jobs/{id}/download", drogon::Get, drogon::Options);
    METHOD_LIST_END

    void downloadResult(const drogon::HttpRequestPtr& req,
                        std::function<void(const drogon::HttpResponsePtr&)>&& callback,
                        std::string jobId);
};

} // namespace molexplorer::controllers
