#pragma once
#include <string>
#include <json/json.h>

namespace molexplorer::models {

struct User {
    std::string id;
    std::string email;
    std::string password_hash;
    std::string created_at;

    Json::Value toJson() const {
        Json::Value val;
        val["id"] = id;
        val["email"] = email;
        val["created_at"] = created_at;
        return val;
    }
};

} // namespace molexplorer::models
