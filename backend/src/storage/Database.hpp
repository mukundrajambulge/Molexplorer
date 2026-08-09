#pragma once
#include <string>
#include <vector>
#include <optional>
#include <memory>
#include <mutex>
#include <sqlite3.h>
#include "../models/User.hpp"
#include "../models/Job.hpp"

namespace molexplorer::storage {

class Database {
public:
    static Database& getInstance();

    bool initialize(const std::string& dbPath = "./molexplorer.db");
    void close();

    // User Operations
    bool createUser(const models::User& user);
    std::optional<models::User> getUserByEmail(const std::string& email);
    std::optional<models::User> getUserById(const std::string& userId);

    // Job Operations
    bool createJob(const models::Job& job);
    bool updateJob(const models::Job& job);
    std::optional<models::Job> getJobById(const std::string& jobId);
    std::vector<models::Job> getJobsByUserId(const std::string& userId, int limit = 50, int offset = 0);
    std::vector<models::Job> getQueuedJobs(int limit = 10);
    bool deleteJob(const std::string& jobId);

private:
    Database() = default;
    ~Database();
    Database(const Database&) = delete;
    Database& operator=(const Database&) = delete;

    sqlite3* db_ = nullptr;
    std::mutex mutex_;
};

} // namespace molexplorer::storage
