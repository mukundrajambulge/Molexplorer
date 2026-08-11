cmake_minimum_required(VERSION 3.20)
project(molexplorer_backend CXX)

set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_EXPORT_COMPILE_COMMANDS ON)

# Optimization flags for high performance scientific docking
if(MSVC)
    add_compile_options(/O2 /fp:fast)
else()
    add_compile_options(-O3 -ffast-math)
endif()

# Find Dependencies
find_package(Drogon CONFIG QUIET)
find_package(OpenSSL QUIET)
find_package(SQLite3 QUIET)

# Include directories
include_directories(
    ${CMAKE_CURRENT_SOURCE_DIR}/src
    ${CMAKE_CURRENT_SOURCE_DIR}/src/engine/include
    ${CMAKE_CURRENT_SOURCE_DIR}/src/controllers
    ${CMAKE_CURRENT_SOURCE_DIR}/src/models
    ${CMAKE_CURRENT_SOURCE_DIR}/src/storage
    ${CMAKE_CURRENT_SOURCE_DIR}/src/worker
)

# Engine source files
file(GLOB_RECURSE ENGINE_SRC
    "${CMAKE_CURRENT_SOURCE_DIR}/src/engine/src/*.cpp"
)

# Standalone Scientific Engine Library
add_library(molexplorer_engine STATIC ${ENGINE_SRC})
target_include_directories(molexplorer_engine PUBLIC ${CMAKE_CURRENT_SOURCE_DIR}/src/engine/include)

# Standalone Engine Test Suite (Zero third-party dependencies)
add_executable(test_engine 
    tests/test_scientific_engine.cpp
)
target_link_libraries(test_engine PRIVATE molexplorer_engine)

# Full Drogon Backend Application
if(Drogon_FOUND)
    file(GLOB_RECURSE APP_SRC 
        "${CMAKE_CURRENT_SOURCE_DIR}/src/*.cpp"
    )
    # Exclude engine files from APP_SRC to avoid duplicate symbols
    list(REMOVE_ITEM APP_SRC ${ENGINE_SRC})
    add_executable(molexplorer_backend ${APP_SRC})
    target_link_libraries(molexplorer_backend PRIVATE
        molexplorer_engine
        Drogon::Drogon
        OpenSSL::SSL
        OpenSSL::Crypto
        ${SQLite3_LIBRARIES}
        pthread
    )
    install(TARGETS molexplorer_backend DESTINATION bin)
endif()
