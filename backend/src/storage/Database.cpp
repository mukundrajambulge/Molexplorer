#include "Database.hpp"
#include <iostream>
#include <sstream>

namespace molexplorer::storage {

Database& Database::getInstance() {
    static Database instance;
    return instance;
}

Database::~Database() {
    close();
}

void Database::close() {
    std::lock_guard<std::mutex> lock(mutex_);
    if (db_) {
        sqlite3_close(db_);
        db_ = nullptr;
    }
}

bool Database::initialize(const std::string& dbPath) {
    std::lock_guard<std::mutex> lock(mutex_);
    if (db_) return true;

    int rc = sqlite3_open(dbPath.c_str(), &db_);
    if (rc != SQLITE_OK) {
        std::cerr << "[Database] Cannot open SQLite database: " << sqlite3_errmsg(db_) << std::endl;
        return false;
    }

    // Enable WAL mode for high concurrency
    sqlite3_exec(db_, "PRAGMA journal_mode=WAL;", nullptr, nullptr, nullptr);
    sqlite3_exec(db_, "PRAGMA synchronous=NORMAL;", nullptr, nullptr, nullptr);

    // Schema initialization
    const char* schemaSql = R"(
        CREATE TABLE IF NOT EXISTS users (
            id TEXT PRIMARY KEY,
            email TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            created_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS jobs (
            id TEXT PRIMARY KEY,
            user_id TEXT,
            status TEXT NOT NULL,
            accuracy_tier TEXT NOT NULL,
            receptor_path TEXT NOT NULL,
            ligand_path TEXT NOT NULL,
            result_path TEXT,
            error_message TEXT,
            best_affinity REAL DEFAULT 0.0,
            progress_percent INTEGER DEFAULT 0,
            created_at TEXT NOT NULL,
            completed_at TEXT,
            FOREIGN KEY (user_id) REFERENCES users(id)
        );

        CREATE INDEX IF NOT EXISTS idx_jobs_user_id ON jobs(user_id);
        CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status);
    )";

    char* errMsg = nullptr;
    rc = sqlite3_exec(db_, schemaSql, nullptr, nullptr, &errMsg);
    if (rc != SQLITE_OK) {
        std::cerr << "[Database] Schema creation failed: " << (errMsg ? errMsg : "unknown") << std::endl;
        sqlite3_free(errMsg);
        return false;
    }

    return true;
}

bool Database::createUser(const models::User& user) {
    std::lock_guard<std::mutex> lock(mutex_);
    if (!db_) return false;

    const char* sql = "INSERT INTO users (id, email, password_hash, created_at) VALUES (?, ?, ?, ?);";
    sqlite3_stmt* stmt = nullptr;
    if (sqlite3_prepare_v2(db_, sql, -1, &stmt, nullptr) != SQLITE_OK) return false;

    sqlite3_bind_text(stmt, 1, user.id.c_str(), -1, SQLITE_TRANSIENT);
    sqlite3_bind_text(stmt, 2, user.email.c_str(), -1, SQLITE_TRANSIENT);
    sqlite3_bind_text(stmt, 3, user.password_hash.c_str(), -1, SQLITE_TRANSIENT);
    sqlite3_bind_text(stmt, 4, user.created_at.c_str(), -1, SQLITE_TRANSIENT);

    int rc = sqlite3_step(stmt);
    sqlite3_finalize(stmt);
    return rc == SQLITE_DONE;
}

std::optional<models::User> Database::getUserByEmail(const std::string& email) {
    std::lock_guard<std::mutex> lock(mutex_);
    if (!db_) return std::nullopt;

    const char* sql = "SELECT id, email, password_hash, created_at FROM users WHERE email = ? LIMIT 1;";
    sqlite3_stmt* stmt = nullptr;
    if (sqlite3_prepare_v2(db_, sql, -1, &stmt, nullptr) != SQLITE_OK) return std::nullopt;

    sqlite3_bind_text(stmt, 1, email.c_str(), -1, SQLITE_TRANSIENT);

    if (sqlite3_step(stmt) == SQLITE_ROW) {
        models::User u;
        u.id = reinterpret_cast<const char*>(sqlite3_column_text(stmt, 0));
        u.email = reinterpret_cast<const char*>(sqlite3_column_text(stmt, 1));
        u.password_hash = reinterpret_cast<const char*>(sqlite3_column_text(stmt, 2));
        u.created_at = reinterpret_cast<const char*>(sqlite3_column_text(stmt, 3));
        sqlite3_finalize(stmt);
        return u;
    }

    sqlite3_finalize(stmt);
    return std::nullopt;
}

std::optional<models::User> Database::getUserById(const std::string& userId) {
    std::lock_guard<std::mutex> lock(mutex_);
    if (!db_) return std::nullopt;

    const char* sql = "SELECT id, email, password_hash, created_at FROM users WHERE id = ? LIMIT 1;";
    sqlite3_stmt* stmt = nullptr;
    if (sqlite3_prepare_v2(db_, sql, -1, &stmt, nullptr) != SQLITE_OK) return std::nullopt;

    sqlite3_bind_text(stmt, 1, userId.c_str(), -1, SQLITE_TRANSIENT);

    if (sqlite3_step(stmt) == SQLITE_ROW) {
        models::User u;
        u.id = reinterpret_cast<const char*>(sqlite3_column_text(stmt, 0));
        u.email = reinterpret_cast<const char*>(sqlite3_column_text(stmt, 1));
        u.password_hash = reinterpret_cast<const char*>(sqlite3_column_text(stmt, 2));
        u.created_at = reinterpret_cast<const char*>(sqlite3_column_text(stmt, 3));
        sqlite3_finalize(stmt);
        return u;
    }

    sqlite3_finalize(stmt);
    return std::nullopt;
}

bool Database::createJob(const models::Job& job) {
    std::lock_guard<std::mutex> lock(mutex_);
    if (!db_) return false;

    const char* sql = R"(
        INSERT INTO jobs (
            id, user_id, status, accuracy_tier, receptor_path, ligand_path,
            result_path, error_message, best_affinity, progress_percent, created_at, completed_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
    )";
    sqlite3_stmt* stmt = nullptr;
    if (sqlite3_prepare_v2(db_, sql, -1, &stmt, nullptr) != SQLITE_OK) return false;

    sqlite3_bind_text(stmt, 1, job.id.c_str(), -1, SQLITE_TRANSIENT);
    sqlite3_bind_text(stmt, 2, job.userId.c_str(), -1, SQLITE_TRANSIENT);
    sqlite3_bind_text(stmt, 3, models::jobStatusToString(job.status).c_str(), -1, SQLITE_TRANSIENT);
    sqlite3_bind_text(stmt, 4, job.accuracyTier.c_str(), -1, SQLITE_TRANSIENT);
    sqlite3_bind_text(stmt, 5, job.receptorPath.c_str(), -1, SQLITE_TRANSIENT);
    sqlite3_bind_text(stmt, 6, job.ligandPath.c_str(), -1, SQLITE_TRANSIENT);
    sqlite3_bind_text(stmt, 7, job.resultPath.c_str(), -1, SQLITE_TRANSIENT);
    sqlite3_bind_text(stmt, 8, job.errorMessage.c_str(), -1, SQLITE_TRANSIENT);
    sqlite3_bind_double(stmt, 9, job.bestAffinity);
    sqlite3_bind_int(stmt, 10, job.progressPercent);
    sqlite3_bind_text(stmt, 11, job.createdAt.c_str(), -1, SQLITE_TRANSIENT);
    sqlite3_bind_text(stmt, 12, job.completedAt.c_str(), -1, SQLITE_TRANSIENT);

    int rc = sqlite3_step(stmt);
    sqlite3_finalize(stmt);
    return rc == SQLITE_DONE;
}

bool Database::updateJob(const models::Job& job) {
    std::lock_guard<std::mutex> lock(mutex_);
    if (!db_) return false;

    const char* sql = R"(
        UPDATE jobs SET
            status = ?,
            result_path = ?,
            error_message = ?,
            best_affinity = ?,
            progress_percent = ?,
            completed_at = ?
        WHERE id = ?;
    )";
    sqlite3_stmt* stmt = nullptr;
    if (sqlite3_prepare_v2(db_, sql, -1, &stmt, nullptr) != SQLITE_OK) return false;

    sqlite3_bind_text(stmt, 1, models::jobStatusToString(job.status).c_str(), -1, SQLITE_TRANSIENT);
    sqlite3_bind_text(stmt, 2, job.resultPath.c_str(), -1, SQLITE_TRANSIENT);
    sqlite3_bind_text(stmt, 3, job.errorMessage.c_str(), -1, SQLITE_TRANSIENT);
    sqlite3_bind_double(stmt, 4, job.bestAffinity);
    sqlite3_bind_int(stmt, 5, job.progressPercent);
    sqlite3_bind_text(stmt, 6, job.completedAt.c_str(), -1, SQLITE_TRANSIENT);
    sqlite3_bind_text(stmt, 7, job.id.c_str(), -1, SQLITE_TRANSIENT);

    int rc = sqlite3_step(stmt);
    sqlite3_finalize(stmt);
    return rc == SQLITE_DONE;
}

std::optional<models::Job> Database::getJobById(const std::string& jobId) {
    std::lock_guard<std::mutex> lock(mutex_);
    if (!db_) return std::nullopt;

    const char* sql = R"(
        SELECT id, user_id, status, accuracy_tier, receptor_path, ligand_path,
               result_path, error_message, best_affinity, progress_percent, created_at, completed_at
        FROM jobs WHERE id = ? LIMIT 1;
    )";
    sqlite3_stmt* stmt = nullptr;
    if (sqlite3_prepare_v2(db_, sql, -1, &stmt, nullptr) != SQLITE_OK) return std::nullopt;

    sqlite3_bind_text(stmt, 1, jobId.c_str(), -1, SQLITE_TRANSIENT);

    if (sqlite3_step(stmt) == SQLITE_ROW) {
        models::Job j;
        j.id = reinterpret_cast<const char*>(sqlite3_column_text(stmt, 0));
        j.userId = sqlite3_column_text(stmt, 1) ? reinterpret_cast<const char*>(sqlite3_column_text(stmt, 1)) : "";
        j.status = models::stringToJobStatus(reinterpret_cast<const char*>(sqlite3_column_text(stmt, 2)));
        j.accuracyTier = reinterpret_cast<const char*>(sqlite3_column_text(stmt, 3));
        j.receptorPath = reinterpret_cast<const char*>(sqlite3_column_text(stmt, 4));
        j.ligandPath = reinterpret_cast<const char*>(sqlite3_column_text(stmt, 5));
        j.resultPath = sqlite3_column_text(stmt, 6) ? reinterpret_cast<const char*>(sqlite3_column_text(stmt, 6)) : "";
        j.errorMessage = sqlite3_column_text(stmt, 7) ? reinterpret_cast<const char*>(sqlite3_column_text(stmt, 7)) : "";
        j.bestAffinity = sqlite3_column_double(stmt, 8);
        j.progressPercent = sqlite3_column_int(stmt, 9);
        j.createdAt = reinterpret_cast<const char*>(sqlite3_column_text(stmt, 10));
        j.completedAt = sqlite3_column_text(stmt, 11) ? reinterpret_cast<const char*>(sqlite3_column_text(stmt, 11)) : "";
        sqlite3_finalize(stmt);
        return j;
    }

    sqlite3_finalize(stmt);
    return std::nullopt;
}

std::vector<models::Job> Database::getJobsByUserId(const std::string& userId, int limit, int offset) {
    std::lock_guard<std::mutex> lock(mutex_);
    std::vector<models::Job> results;
    if (!db_) return results;

    const char* sql = R"(
        SELECT id, user_id, status, accuracy_tier, receptor_path, ligand_path,
               result_path, error_message, best_affinity, progress_percent, created_at, completed_at
        FROM jobs WHERE user_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?;
    )";
    sqlite3_stmt* stmt = nullptr;
    if (sqlite3_prepare_v2(db_, sql, -1, &stmt, nullptr) != SQLITE_OK) return results;

    sqlite3_bind_text(stmt, 1, userId.c_str(), -1, SQLITE_TRANSIENT);
    sqlite3_bind_int(stmt, 2, limit);
    sqlite3_bind_int(stmt, 3, offset);

    while (sqlite3_step(stmt) == SQLITE_ROW) {
        models::Job j;
        j.id = reinterpret_cast<const char*>(sqlite3_column_text(stmt, 0));
        j.userId = sqlite3_column_text(stmt, 1) ? reinterpret_cast<const char*>(sqlite3_column_text(stmt, 1)) : "";
        j.status = models::stringToJobStatus(reinterpret_cast<const char*>(sqlite3_column_text(stmt, 2)));
        j.accuracyTier = reinterpret_cast<const char*>(sqlite3_column_text(stmt, 3));
        j.receptorPath = reinterpret_cast<const char*>(sqlite3_column_text(stmt, 4));
        j.ligandPath = reinterpret_cast<const char*>(sqlite3_column_text(stmt, 5));
        j.resultPath = sqlite3_column_text(stmt, 6) ? reinterpret_cast<const char*>(sqlite3_column_text(stmt, 6)) : "";
        j.errorMessage = sqlite3_column_text(stmt, 7) ? reinterpret_cast<const char*>(sqlite3_column_text(stmt, 7)) : "";
        j.bestAffinity = sqlite3_column_double(stmt, 8);
        j.progressPercent = sqlite3_column_int(stmt, 9);
        j.createdAt = reinterpret_cast<const char*>(sqlite3_column_text(stmt, 10));
        j.completedAt = sqlite3_column_text(stmt, 11) ? reinterpret_cast<const char*>(sqlite3_column_text(stmt, 11)) : "";
        results.push_back(j);
    }

    sqlite3_finalize(stmt);
    return results;
}

std::vector<models::Job> Database::getQueuedJobs(int limit) {
    std::lock_guard<std::mutex> lock(mutex_);
    std::vector<models::Job> results;
    if (!db_) return results;

    const char* sql = R"(
        SELECT id, user_id, status, accuracy_tier, receptor_path, ligand_path,
               result_path, error_message, best_affinity, progress_percent, created_at, completed_at
        FROM jobs WHERE status = 'queued' ORDER BY created_at ASC LIMIT ?;
    )";
    sqlite3_stmt* stmt = nullptr;
    if (sqlite3_prepare_v2(db_, sql, -1, &stmt, nullptr) != SQLITE_OK) return results;

    sqlite3_bind_int(stmt, 1, limit);

    while (sqlite3_step(stmt) == SQLITE_ROW) {
        models::Job j;
        j.id = reinterpret_cast<const char*>(sqlite3_column_text(stmt, 0));
        j.userId = sqlite3_column_text(stmt, 1) ? reinterpret_cast<const char*>(sqlite3_column_text(stmt, 1)) : "";
        j.status = models::stringToJobStatus(reinterpret_cast<const char*>(sqlite3_column_text(stmt, 2)));
        j.accuracyTier = reinterpret_cast<const char*>(sqlite3_column_text(stmt, 3));
        j.receptorPath = reinterpret_cast<const char*>(sqlite3_column_text(stmt, 4));
        j.ligandPath = reinterpret_cast<const char*>(sqlite3_column_text(stmt, 5));
        j.resultPath = sqlite3_column_text(stmt, 6) ? reinterpret_cast<const char*>(sqlite3_column_text(stmt, 6)) : "";
        j.errorMessage = sqlite3_column_text(stmt, 7) ? reinterpret_cast<const char*>(sqlite3_column_text(stmt, 7)) : "";
        j.bestAffinity = sqlite3_column_double(stmt, 8);
        j.progressPercent = sqlite3_column_int(stmt, 9);
        j.createdAt = reinterpret_cast<const char*>(sqlite3_column_text(stmt, 10));
        j.completedAt = sqlite3_column_text(stmt, 11) ? reinterpret_cast<const char*>(sqlite3_column_text(stmt, 11)) : "";
        results.push_back(j);
    }

    sqlite3_finalize(stmt);
    return results;
}

bool Database::deleteJob(const std::string& jobId) {
    std::lock_guard<std::mutex> lock(mutex_);
    if (!db_) return false;

    const char* sql = "DELETE FROM jobs WHERE id = ?;";
    sqlite3_stmt* stmt = nullptr;
    if (sqlite3_prepare_v2(db_, sql, -1, &stmt, nullptr) != SQLITE_OK) return false;

    sqlite3_bind_text(stmt, 1, jobId.c_str(), -1, SQLITE_TRANSIENT);
    int rc = sqlite3_step(stmt);
    sqlite3_finalize(stmt);
    return rc == SQLITE_DONE;
}

} // namespace molexplorer::storage
