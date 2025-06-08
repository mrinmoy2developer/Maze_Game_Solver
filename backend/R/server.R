library(plumber)
library(jsonlite)
library(httr)
library(callr)

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

# Define algorithm configs
ALGORITHM_CONFIGS <- list(
  optimal = list(
    display_name = "Optimal Search",
    description = "Exhaustive search for best solution",
    params = list(
      max_iterations = list(type = "number", default = 10000, min = 1000, max = 50000, step = 1000, label = "Max Iterations", description = "Maximum search iterations"),
      random_seed = list(type = "number", default = 42, min = 1, max = 9999, step = 1, label = "Random Seed", description = "Seed for reproducible results")
    )
  ),
  greedy = list(
    display_name = "Greedy Search",
    description = "Fast heuristic-based search",
    params = list(
      max_iterations = list(type = "number", default = 5000, min = 500, max = 20000, step = 500, label = "Max Iterations"),
      random_seed = list(type = "number", default = 42, min = 1, max = 9999, step = 1, label = "Random Seed"),
      greediness = list(type = "range", default = 0.8, min = 0.1, max = 1.0, step = 0.1, label = "Greediness Factor", description = "Higher values = more greedy")
    )
  )
)

# Solver endpoint
solve_maze <- function(req, res) {
  tryCatch({
    data <- jsonlite::fromJSON(req$postBody, simplifyVector = FALSE)
    print("ami ekhane1!")
    # Extract settings with defaults
    settings <- data$solver_settings %||% list()
    print("ami ekhane2!")
    algo <- settings$algorithm %||% "optimal"
    print("ami ekhane3!")
    algo_config <- ALGORITHM_CONFIGS[[algo]] %||% ALGORITHM_CONFIGS$optimal
    params <- list()
    print("ami ekhane4!")
    for (name in names(algo_config$params)) {
      params[[name]] <-settings[[name]] %||% algo_config$params[[name]]$default
    }
    max_iter <- params$max_iterations %||% 10000
    seed<- params$random_seed %||% 10000
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
      result$best_grid=NULL
      result$time_taken <- paste0(round(time_taken, 3), "s")
      result$algorithm_used <- algo
      result$parameters_used <- params
      return(result)
    } else {
      res$status <- 400
      return(list(error = "No optimal placement found", 
           algorithm_used = as.character(algo), 
           iterations_used = as.integer(max_iter)))
    }
  }, error = function(e) {
    res$status <- 500
    return(list(error = e$message))
  })
}

available <- function() {
  # print("ami beche achi!!")
  list(status = "healthy", 
       timestamp = as.character(Sys.time()), 
       # algorithms = c("optimal","greedy"))
       algorithms = names(ALGORITHM_CONFIGS),
       algorithm_configs = ALGORITHM_CONFIGS
  )
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
    pr_get("/available", available, serializer = plumber::serializer_unboxed_json()) %>%
    pr_get("/debug", debug, serializer = plumber::serializer_unboxed_json()) %>%
    pr_post("/debug", debug, serializer = plumber::serializer_unboxed_json()) %>%
    pr_run(host = host, port = port)
}

start_maze_server()

### the following code in your r console to run this server in the background
# r <- r_bg(function() {
#   source("server.R")
#   start_maze_server()
# }, stdout = "maze_server.log", stderr = "maze_error.log")