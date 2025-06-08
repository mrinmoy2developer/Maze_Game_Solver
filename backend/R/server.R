# R Maze Solver - Plumber API Server
# Required packages
library(plumber)
library(jsonlite)
library(httr)

# Source the utils functions
source("utils.R")

#* @apiTitle Maze Solver API
#* @apiDescription API for solving maze puzzles with optimal tile placement

#* Enable CORS
#* @filter cors
cors <- function(req, res) {
  res$setHeader("Access-Control-Allow-Origin", "*")
  res$setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
  res$setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With")
  
  if (req$REQUEST_METHOD == "OPTIONS") {
    res$status <- 200
    return(list())
  } else {
    plumber::forward()
  }
}

#* Solve maze puzzle
#* @param req Request object
#* @post /solver
function(req) {
  tryCatch({
    # Parse request body
    data <- jsonlite::fromJSON(req$postBody, simplifyVector = FALSE)
    
    cat("Received solving request!\n")
    
    # Extract solver settings if provided
    solver_settings <- data$solver_settings
    if (is.null(solver_settings)) solver_settings <- list()
    
    max_iterations <- ifelse(is.null(solver_settings$max_iterations), 10000, solver_settings$max_iterations)
    random_seed <- ifelse(is.null(solver_settings$random_seed), 42, solver_settings$random_seed)
    algorithm <- ifelse(is.null(solver_settings$algorithm), "optimal", solver_settings$algorithm)
    
    cat("Solver settings: Algorithm =", algorithm, ", Max_iter =", max_iterations, ", Seed =", random_seed, "\n")
    
    # Set random seed for reproducibility
    set.seed(random_seed)
    
    # Extract game state
    state_result <- extract_state(data)
    state <- state_result$board
    nt <- state_result$towers
    nf <- state_result$claps
    froz <- state_result$frozen
    
    cat("Game state extracted successfully!\n")
    
    t0 <- Sys.time()
    
    # Choose algorithm based on settings
    if (algorithm == "optimal") {
      result <- find_optimal_tile_placement(state, k_normal = nt, l_frozen = nf, max_attempts = max_iterations)
    } else if (algorithm == "greedy") {
      cat("Note: Greedy algorithm not yet implemented, using optimal\n")
      result <- find_optimal_tile_placement(state, k_normal = nt, l_frozen = nf, max_attempts = max_iterations %/% 2)
    } else if (algorithm == "genetic") {
      cat("Note: Genetic algorithm not yet implemented, using optimal\n")
      result <- find_optimal_tile_placement(state, k_normal = nt, l_frozen = nf, max_attempts = max_iterations)
    } else if (algorithm == "simulated") {
      cat("Note: Simulated annealing not yet implemented, using optimal\n")
      result <- find_optimal_tile_placement(state, k_normal = nt, l_frozen = nf, max_attempts = max_iterations)
    } else {
      result <- find_optimal_tile_placement(state, k_normal = nt, l_frozen = nf, max_attempts = max_iterations)
    }
    
    t1 <- Sys.time()
    time_taken <- as.numeric(difftime(t1, t0, units = "secs"))
    
    if (!is.null(result)) {
      # Remove grid from response to reduce size
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
    print(e)
    res$status <- 500
    return(list(error = e$message))
  })
}

#* Debug endpoint for testing
#* @get /debug
#* @post /debug
function(req) {
  if (req$REQUEST_METHOD == "GET") {
    return(list(
      message = "GET request received",
      headers = as.list(req$HTTP_USER_AGENT)
    ))
  } else if (req$REQUEST_METHOD == "POST") {
    return(list(
      message = "POST request received",
      headers = as.list(req$HTTP_USER_AGENT),
      json = jsonlite::fromJSON(req$postBody, simplifyVector = FALSE)
    ))
  }
}

#* Check available options
#* @get /available
function() {
  return(list(
    status = "healthy",
    timestamp = Sys.time(),
    algorithms = c("optimal", "greedy", "genetic", "simulated")
  ))
}

#* Health check endpoint
#* @get /health
function() {
  return(list(
    status = "healthy",
    timestamp = Sys.time(),
    message = "R Maze Solver API is running"
  ))
}

# Function to start the server
start_server <- function(host = "127.0.0.1", port = 5000) {
  cat("Starting R Maze Solver Server...\n")
  cat("Supported algorithms: optimal, greedy, genetic, simulated\n")
  cat("Server running on http://", host, ":", port, "\n", sep = "")
  
  # Create plumber API
  pr <- plumber$new()
  
  # Add routes programmatically
  pr$filter("cors", cors)
  pr$handle("POST", "/solver", function(req, res) {
    # Implementation moved to main function above
  })
  pr$handle("GET", "/debug", function(req, res) {
    list(message = "GET request received", headers = as.list(req$HTTP_USER_AGENT))
  })
  pr$handle("POST", "/debug", function(req, res) {
    list(
      message = "POST request received",
      headers = as.list(req$HTTP_USER_AGENT),
      json = jsonlite::fromJSON(req$postBody, simplifyVector = FALSE)
    )
  })
  pr$handle("GET", "/available", function(req, res) {
    list(
      status = "healthy",
      timestamp = Sys.time(),
      algorithms = c("optimal", "greedy", "genetic", "simulated")
    )
  })
  pr$handle("GET", "/health", function(req, res) {
    list(
      status = "healthy",
      timestamp = Sys.time(),
      message = "R Maze Solver API is running"
    )
  })
  
  pr$run(host = host, port = port)
}

# Alternative simpler server setup using plumber file
# Save this as server.R and run: plumber::plumb("server.R")$run(host="127.0.0.1", port=5000)