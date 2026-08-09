#pragma once
#include <drogon/HttpController.h>

namespace molexplorer::controllers {

class AuthController : public drogon::HttpController<AuthController> {
public:
    METHOD_LIST_BEGIN
    ADD_METHOD_TO(AuthController::registerUser, "/api/v1/auth/register", drogon::Post, drogon::Options);
    ADD_METHOD_TO(AuthController::loginUser, "/api/v1/auth/login", drogon::Post, drogon::Options);
    ADD_METHOD_TO(AuthController::getMe, "/api/v1/auth/me", drogon::Get, drogon::Options);
    METHOD_LIST_END

    void registerUser(const drogon::HttpRequestPtr& req,
                      std::function<void(const drogon::HttpResponsePtr&)>&& callback);

    void loginUser(const drogon::HttpRequestPtr& req,
                   std::function<void(const drogon::HttpResponsePtr&)>&& callback);

    void getMe(const drogon::HttpRequestPtr& req,
               std::function<void(const drogon::HttpResponsePtr&)>&& callback);
};

} // namespace molexplorer::controllers
