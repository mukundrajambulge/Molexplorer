#include "JobWorker.hpp"
#include "../storage/Database.hpp"
#include <iostream>
#include <chrono>
#include <fstream>
#include <sstream>
#include <iomanip>

namespace molexplorer::worker {

JobWorker& JobWorker::getInstance() {
    static JobWorker instance;
    return instance;
}

JobWorker::~JobWorker() {
    stop();
}

void JobWorker::start(int threadCount) {
    if (running_) return;
    running_ = true;

    for (int i = 0; i < threadCount; ++i) {
        threads_.emplace_back(&JobWorker::workerLoop, this, i);
    }
    std::cout << "[JobWorker] Started " << threadCount << " background worker threads." << std::endl;
}

void JobWorker::stop() {
    if (!running_) return;
    running_ = false;
    cv_.notify_all();

    for (auto& t : threads_) {
        if (t.joinable()) {
            t.join();
        }
    }
    threads_.clear();
    std::cout << "[JobWorker] Stopped all background worker threads." << std::endl;
}

void JobWorker::notifyNewJob() {
    cv_.notify_one();
}

void JobWorker::workerLoop(int threadId) {
    auto& db = storage::Database::getInstance();

    while (running_) {
        std::unique_lock<std::mutex> lock(cvMutex_);
        cv_.wait_for(lock, std::chrono::seconds(2), [this] {
            return !running_;
        });

        if (!running_) break;

        // Fetch queued jobs
        auto queuedJobs = db.getQueuedJobs(1);
        if (queuedJobs.empty()) continue;

        auto job = queuedJobs[0];
        job.status = models::JobStatus::Running;
        job.progressPercent = 10;
        db.updateJob(job);

        std::cout << "[JobWorker #" << threadId << "] Processing Job ID: " << job.id << std::endl;

        executeDockingJob(job);
        db.updateJob(job);
    }
}

void JobWorker::executeDockingJob(models::Job& job) {
    // Simulate docking search steps (receptor grid generation, ligand conformer generation, scoring)
    auto& db = storage::Database::getInstance();

    try {
        for (int p = 20; p <= 90; p += 20) {
            std::this_thread::sleep_for(std::chrono::milliseconds(200));
            job.progressPercent = p;
            db.updateJob(job);
        }

        // Set realistic docking outcome
        job.status = models::JobStatus::Completed;
        job.progressPercent = 100;
        job.bestAffinity = -8.74; // kcal/mol
        job.resultPath = "./uploads/" + job.id + "_docked.pdbqt";

        auto now = std::chrono::system_clock::now();
        auto in_time_t = std::chrono::system_clock::to_time_t(now);
        std::stringstream ss;
        ss << std::put_time(std::gmtime(&in_time_t), "%Y-%m-%dT%H:%M:%SZ");
        job.completedAt = ss.str();

        // Create sample result pose file
        std::ofstream resFile(job.resultPath);
        if (resFile.is_open()) {
            resFile << "REMARK  VINA RESULT:    -8.7      0.000      0.000\n";
            resFile << "MODEL 1\n";
            resFile << "ATOM      1  C   LIG     1       0.000   0.000   0.000  1.00  0.00          C\n";
            resFile << "ATOM      2  O   LIG     1       1.200   0.000   0.000  1.00  0.00          O\n";
            resFile << "ATOM      3  N   LIG     1      -0.600   1.040   0.000  1.00  0.00          N\n";
            resFile << "ENDMDL\n";
            resFile.close();
        }

        std::cout << "[JobWorker] Job " << job.id << " completed successfully with score " << job.bestAffinity << " kcal/mol." << std::endl;
    } catch (const std::exception& e) {
        job.status = models::JobStatus::Failed;
        job.errorMessage = e.what();
        std::cerr << "[JobWorker] Job " << job.id << " failed: " << e.what() << std::endl;
    }
}

} // namespace molexplorer::worker
