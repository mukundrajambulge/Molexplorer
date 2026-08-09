#pragma once
#include <string>
#include <thread>
#include <atomic>
#include <condition_variable>
#include <mutex>
#include <vector>
#include "../models/Job.hpp"

namespace molexplorer::worker {

class JobWorker {
public:
    static JobWorker& getInstance();

    void start(int threadCount = 2);
    void stop();
    void notifyNewJob();

private:
    JobWorker() = default;
    ~JobWorker();
    JobWorker(const JobWorker&) = delete;
    JobWorker& operator=(const JobWorker&) = delete;

    void workerLoop(int threadId);
    void executeDockingJob(models::Job& job);

    std::vector<std::thread> threads_;
    std::atomic<bool> running_{false};
    std::mutex cvMutex_;
    std::condition_variable cv_;
};

} // namespace molexplorer::worker
