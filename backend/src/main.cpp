#include <drogon/drogon.h>
#include "storage/Database.hpp"
#include "worker/JobWorker.hpp"
#include <iostream>
#include <filesystem>

int main(int argc, char* argv[]) {
    std::cout << "=====================================================" << std::endl;
    std::cout << "  MolExplorer / MolStudio C++ Drogon Backend Engine  " << std::endl;
    std::cout << "=====================================================" << std::endl;

    // Ensure uploads directory exists
    std::filesystem::create_directories("./uploads");

    // Initialize SQLite Database
    if (!molexplorer::storage::Database::getInstance().initialize("./molexplorer.db")) {
        std::cerr << "[Main] Failed to initialize database. Exiting." << std::endl;
        return 1;
    }
    std::cout << "[Main] SQLite Database initialized." << std::endl;

    // Start background job worker thread pool
    molexplorer::worker::JobWorker::getInstance().start(4);

    // Load Drogon configuration
    std::string configPath = "./config.json";
    if (std::filesystem::exists(configPath)) {
        drogon::app().loadConfigFile(configPath);
        std::cout << "[Main] Loaded Drogon config from " << configPath << std::endl;
    } else {
        drogon::app().addListener("0.0.0.0", 8080);
        std::cout << "[Main] Listening on 0.0.0.0:8080 (default)" << std::endl;
    }

    // Run HTTP server loop
    drogon::app().run();

    // Clean shutdown
    molexplorer::worker::JobWorker::getInstance().stop();
    molexplorer::storage::Database::getInstance().close();
    return 0;
}
