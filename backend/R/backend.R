# R Server Startup Script
# Run this script to start the maze solver server

# Install required packages if not already installed
required_packages <- c("plumber", "jsonlite", "Matrix", "igraph", "httr")

for (pkg in required_packages) {
  if (!require(pkg, character.only = TRUE)) {
    install.packages(pkg)
    library(pkg, character.only = TRUE)
  }
}

# Source the utils and server files
if (file.exists("utils.R")) {
  source("utils.R")
} else {
  stop("utils.R file not found. Please ensure all files are in the correct directory.")
}

# Method 1: Direct server start (recommended)
start_maze_server <- function(host = "127.0.0.1", port = 5001) {
  cat("Starting R Maze Solver Server...\n")
  cat("Supported algorithms: optimal, greedy, genetic, simulated\n")
  cat("Server running on http://", host, ":", port, "\n", sep = "")
  
  # Create plumber router
  pr <- plumber::pr()
  
  # Enable CORS
  pr <- pr %>%
    pr_filter("cors", function(req, res) {
      res$setHeader("Access-Control-Allow-Origin", "*")
      res$setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
      res$setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With")
      
      if (req$REQUEST_METHOD == "OPTIONS") {
        res$status <- 200
        return(list())
      } else {
        plumber::forward()
      }
    })
  
  # Add solver endpoint
  pr <- pr %>%
    pr_post("/solver", function(req, res) {
      tryCatch({
        # Parse request body
        data<<- jsonlite::fromJSON(req$postBody, simplifyVector = FALSE)
        
        cat("Received solving request!\n")
        
        # Extract solver settings
        solver_settings <- data$solver_settings
        if (is.null(solver_settings)) solver_settings <- list()
        
        max_iterations <- ifelse(is.null(solver_settings$max_iterations), 10000, solver_settings$max_iterations)
        random_seed <- ifelse(is.null(solver_settings$random_seed), 42, solver_settings$random_seed)
        algorithm <- ifelse(is.null(solver_settings$algorithm), "optimal", solver_settings$algorithm)
        
        cat("Solver settings: Algorithm =", algorithm, ", Max_iter =", max_iterations, ", Seed =", random_seed, "\n")
        
        # Set random seed
        set.seed(random_seed)
        
        # Extract game state
        state_result <- extract_state(data)
        state <- state_result$board
        nt <- state_result$towers
        nf <- state_result$claps
        print(algorithm)
        cat("Game state extracted successfully!\n")
        
        t0 <- Sys.time()
        
        # Solve based on algorithm
        result <- find_optimal_tile_placement(state, k_normal = nt, l_frozen = nf, max_attempts = max_iterations)
        
        t1 <- Sys.time()
        time_taken <- as.numeric(difftime(t1, t0, units = "secs"))
        
        if (!is.null(result)) {
          # Remove grid from response
          result$best_grid <- NULL
          result$time_taken <- paste0(round(time_taken, 3), "s")
          result$algorithm_used <- algorithm
          result$iterations_used <- max_iterations
          result$random_seed_used <- random_seed
          
          cat("Solution found in", result$time_taken, "using", algorithm, "algorithm\n")
          cat("Score improvement:", ifelse(is.null(result$improvement), "N/A", result$improvement), "\n")
          
          return(result)
        } else {
          res$status <- 400
          return(list(
            error = "No optimal placement found",
            algorithm_used = algorithm,
            iterations_used = max_iterations
          ))
        }
        
      }, error = function(e) {
        cat("Error during solving:", e$message, "\n")
        res$status <- 500
        return(list(error = e$message))
      })
    })
  
  # Add other endpoints
  pr <- pr %>%
    pr_get("/available", function() {
      list(
        status = "healthy",
        timestamp = Sys.time(),
        algorithms = c("optimal", "greedy", "genetic", "simulated")
      )
    }) %>%
    pr_get("/health", function() {
      list(
        status = "healthy",
        timestamp = Sys.time(),
        message = "R Maze Solver API is running"
      )
    }) %>%
    pr_get("/debug", function(req) {
      list(
        message = "GET request received",
        method = req$REQUEST_METHOD,
        timestamp = Sys.time()
      )
    }) %>%
    pr_post("/debug", function(req) {
      list(
        message = "POST request received",
        method = req$REQUEST_METHOD,
        body = jsonlite::fromJSON(req$postBody, simplifyVector = FALSE),
        timestamp = Sys.time()
      )
    })
  
  # Start the server
  pr$run(host = host, port = port)
}

# Method 2: Using plumber file approach
# Uncomment the following lines to use this method instead:
# pr <- plumber::plumb("server.R")
# pr$run(host = "127.0.0.1", port = 5000)

# Start the server
cat("=== R Maze Solver Server ===\n")
cat("Starting server...\n")
start_maze_server(host = "127.0.0.1", port = 5001)
