#include "AuthController.hpp"
#include "../storage/Database.hpp"
#include <drogon/utils/Utilities.h>
#include <chrono>
#include <iomanip>
#include <sstream>

namespace molexplorer::controllers {

void AuthController::registerUser(const drogon::HttpRequestPtr& req,
                                  std::function<void(const drogon::HttpResponsePtr&)>&& callback) {
    if (req->getMethod() == drogon::Options) {
        auto resp = drogon::HttpResponse::newHttpResponse();
        resp->setStatusCode(drogon::k200OK);
        callback(resp);
        return;
    }

    auto json = req->getJsonObject();
    if (!json || !json->isMember("email") || !json->isMember("password")) {
        Json::Value err;
        err["error"] = "Missing email or password in request body.";
        auto resp = drogon::HttpResponse::newHttpJsonResponse(err);
        resp->setStatusCode(drogon::k400BadRequest);
        callback(resp);
        return;
    }

    std::string email = (*json)["email"].asString();
    std::string password = (*json)["password"].asString();

    auto& db = storage::Database::getInstance();
    if (db.getUserByEmail(email).has_value()) {
        Json::Value err;
        err["error"] = "User with this email already exists.";
        auto resp = drogon::HttpResponse::newHttpJsonResponse(err);
        resp->setStatusCode(drogon::k409Conflict);
        callback(resp);
        return;
    }

    models::User user;
    user.id = drogon::utils::getUuid();
    user.email = email;
    user.password_hash = drogon::utils::getSha256(password);

    auto now = std::chrono::system_clock::now();
    auto in_time_t = std::chrono::system_clock::to_time_t(now);
    std::stringstream ss;
    ss << std::put_time(std::gmtime(&in_time_t), "%Y-%m-%dT%H:%M:%SZ");
    user.created_at = ss.str();

    if (!db.createUser(user)) {
        Json::Value err;
        err["error"] = "Failed to create user in database.";
        auto resp = drogon::HttpResponse::newHttpJsonResponse(err);
        resp->setStatusCode(drogon::k500InternalServerError);
        callback(resp);
        return;
    }

    Json::Value res;
    res["message"] = "User registered successfully.";
    res["user"] = user.toJson();
    auto resp = drogon::HttpResponse::newHttpJsonResponse(res);
    resp->setStatusCode(drogon::k201Created);
    callback(resp);
}

void AuthController::loginUser(const drogon::HttpRequestPtr& req,
                               std::function<void(const drogon::HttpResponsePtr&)>&& callback) {
    if (req->getMethod() == drogon::Options) {
        auto resp = drogon::HttpResponse::newHttpResponse();
        resp->setStatusCode(drogon::k200OK);
        callback(resp);
        return;
    }

    auto json = req->getJsonObject();
    if (!json || !json->isMember("email") || !json->isMember("password")) {
        Json::Value err;
        err["error"] = "Missing email or password.";
        auto resp = drogon::HttpResponse::newHttpJsonResponse(err);
        resp->setStatusCode(drogon::k400BadRequest);
        callback(resp);
        return;
    }

    std::string email = (*json)["email"].asString();
    std::string password = (*json)["password"].asString();

    auto& db = storage::Database::getInstance();
    auto userOpt = db.getUserByEmail(email);

    if (!userOpt.has_value() || userOpt->password_hash != drogon::utils::getSha256(password)) {
        Json::Value err;
        err["error"] = "Invalid email or password.";
        auto resp = drogon::HttpResponse::newHttpJsonResponse(err);
        resp->setStatusCode(drogon::k401Unauthorized);
        callback(resp);
        return;
    }

    Json::Value res;
    res["message"] = "Login successful.";
    res["token"] = "mock_jwt_token_" + userOpt->id;
    res["user"] = userOpt->toJson();

    auto resp = drogon::HttpResponse::newHttpJsonResponse(res);
    resp->setStatusCode(drogon::k200OK);
    callback(resp);
}

void AuthController::getMe(const drogon::HttpRequestPtr& req,
                           std::function<void(const drogon::HttpResponsePtr&)>&& callback) {
    if (req->getMethod() == drogon::Options) {
        auto resp = drogon::HttpResponse::newHttpResponse();
        resp->setStatusCode(drogon::k200OK);
        callback(resp);
        return;
    }

    std::string authHeader = req->getHeader("Authorization");
    if (authHeader.empty() || authHeader.find("Bearer mock_jwt_token_") != 0) {
        Json::Value err;
        err["error"] = "Unauthorized. Missing or invalid Bearer token.";
        auto resp = drogon::HttpResponse::newHttpJsonResponse(err);
        resp->setStatusCode(drogon::k401Unauthorized);
        callback(resp);
        return;
    }

    std::string userId = authHeader.substr(std::string("Bearer mock_jwt_token_").length());
    auto& db = storage::Database::getInstance();
    auto userOpt = db.getUserById(userId);

    if (!userOpt.has_value()) {
        Json::Value err;
        err["error"] = "User not found.";
        auto resp = drogon::HttpResponse::newHttpJsonResponse(err);
        resp->setStatusCode(drogon::k404NotFound);
        callback(resp);
        return;
    }

    Json::Value res;
    res["user"] = userOpt->toJson();
    auto resp = drogon::HttpResponse::newHttpJsonResponse(res);
    resp->setStatusCode(drogon::k200OK);
    callback(resp);
}

} // namespace molexplorer::controllers
