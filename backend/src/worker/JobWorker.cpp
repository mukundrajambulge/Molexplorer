#include "JobWorker.hpp"
#include "../storage/Database.hpp"
#include "../engine/include/DockingEngine.hpp"
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
    auto& db = storage::Database::getInstance();

    try {
        // Read receptor file
        std::string receptorContent;
        std::ifstream recFile(job.receptorPath);
        if (recFile.is_open()) {
            std::stringstream ss;
            ss << recFile.rdbuf();
            receptorContent = ss.str();
        }

        // Read ligand file
        std::string ligandContent;
        std::ifstream ligFile(job.ligandPath);
        if (ligFile.is_open()) {
            std::stringstream ss;
            ss << ligFile.rdbuf();
            ligandContent = ss.str();
        }

        // Configure docking parameters
        engine::DockingParameters params;
        params.gridBox.center = {job.center_x, job.center_y, job.center_z};
        params.gridBox.size = {job.size_x, job.size_y, job.size_z};
        params.exhaustiveness = job.exhaustiveness;

        auto progressCallback = [&](int percent, const std::string& stage) {
            job.progressPercent = percent;
            db.updateJob(job);
            std::cout << "[JobWorker: " << job.id << "][" << percent << "%] " << stage << std::endl;
        };

        // Execute Custom Scientific Engine
        auto result = engine::DockingEngine::runDocking(receptorContent, ligandContent, params, progressCallback);

        if (!result.success) {
            job.status = models::JobStatus::Failed;
            job.errorMessage = result.errorMessage;
            std::cerr << "[JobWorker] Docking failed for Job " << job.id << ": " << result.errorMessage << std::endl;
            return;
        }

        // Save docked PDBQT file
        job.status = models::JobStatus::Completed;
        job.progressPercent = 100;
        job.bestAffinity = result.bestAffinity;
        job.resultPath = "./uploads/" + job.id + "_docked.pdbqt";

        auto now = std::chrono::system_clock::now();
        auto in_time_t = std::chrono::system_clock::to_time_t(now);
        std::stringstream ss;
        ss << std::put_time(std::gmtime(&in_time_t), "%Y-%m-%dT%H:%M:%SZ");
        job.completedAt = ss.str();

        std::ofstream resFile(job.resultPath);
        if (resFile.is_open()) {
            resFile << result.resultPDBQT;
            resFile.close();
        }

        std::cout << "[JobWorker] Job " << job.id << " completed successfully with score "
                  << job.bestAffinity << " kcal/mol (" << result.numPoses << " poses generated in "
                  << result.totalExecutionTimeMs << "ms)." << std::endl;

    } catch (const std::exception& e) {
        job.status = models::JobStatus::Failed;
        job.errorMessage = e.what();
        std::cerr << "[JobWorker] Job " << job.id << " encountered exception: " << e.what() << std::endl;
    }
}

} // namespace molexplorer::worker
