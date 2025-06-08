library(plumber)
library(jsonlite)
library(httr)

source("utils.R")

# Null coalescing operator
`%||%` <- function(x, y) if (is.null(x)) y else x

# CORS filter
cors_filter <- function(req, res) {
  res$setHeader("Access-Control-Allow-Origin", "*")
  res$setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
  res$setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With")
  
  if (req$REQUEST_METHOD == "OPTIONS") {
    res$status <- 200
    return(list())
  }
  plumber::forward()
}

# Solver endpoint
solve_maze <- function(req, res) {
  tryCatch({
    data <- jsonlite::fromJSON(req$postBody, simplifyVector = FALSE)
    
    # Extract settings with defaults
    settings <- data$solver_settings %||% list()
    max_iter <- settings$max_iterations %||% 10000
    seed <- settings$random_seed %||% 42
    algo <- settings$algorithm %||% "optimal"
    
    set.seed(seed)
    
    # Extract and solve
    state_result <- extract_state(data)
    t0 <- Sys.time()
    result <- find_optimal_tile_placement(state_result$board, 
                                          k_normal = state_result$towers, 
                                          l_frozen = state_result$claps, 
                                          max_attempts = max_iter)
    time_taken <- as.numeric(difftime(Sys.time(), t0, units = "secs"))
    
    if (!is.null(result)) {
      list(
        original_score = as.numeric(result$original_score),
        best_score = as.numeric(result$best_score),
        improvement = as.numeric(result$improvement),
        normal_positions = result$normal_positions,
        frozen_positions = result$frozen_positions,
        time_taken = paste0(round(time_taken, 3), "s"),
        algorithm_used = as.character(algo),
        iterations_used = as.integer(max_iter),
        random_seed_used = as.integer(seed)
      )
    } else {
      res$status <- 400
      list(error = "No optimal placement found", 
           algorithm_used = as.character(algo), 
           iterations_used = as.integer(max_iter))
    }
  }, error = function(e) {
    res$status <- 500
    list(error = e$message)
  })
}

available_algos <- function() {
  list(status = "healthy", 
       timestamp = as.character(Sys.time()), 
       algorithms = c("optimal","greedy"))
}

debug<- function(req) {
  base_response <- list(message = paste(req$REQUEST_METHOD, "request received"),
                        timestamp = as.character(Sys.time()))
  
  if (req$REQUEST_METHOD == "POST") {
    base_response$json <- jsonlite::fromJSON(req$postBody, simplifyVector = FALSE)
  }
  base_response
}

# Start server
start_maze_server <- function(host = "127.0.0.1", port = 5001) {
  cat("=== R Maze Solver Server ===\n")
  cat("Server running on http://", host, ":", port, "\n", sep = "")
  
  plumber::pr() %>%
    pr_filter("cors", cors_filter) %>%
    pr_post("/solver", solve_maze, serializer = plumber::serializer_unboxed_json()) %>%
    pr_get("/available", available_algos, serializer = plumber::serializer_unboxed_json()) %>%
    pr_get("/debug", debug, serializer = plumber::serializer_unboxed_json()) %>%
    pr_post("/debug", debug, serializer = plumber::serializer_unboxed_json()) %>%
    pr_run(host = host, port = port)
}

start_maze_server()

