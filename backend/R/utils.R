# R Maze Solver - Utils Functions
# Required packages
library(jsonlite)
library(Matrix)
library(igraph)

# Extract game state from raw JSON data
extract_state <- function(raw) {
  n <- raw$board$height
  m <- raw$board$width
  frozen <- list()
  board <- matrix(0, nrow = n, ncol = m)
  
  # Process static towers
  if (!is.null(raw$board$staticTowers)) {
    for (i in seq_along(raw$board$staticTowers)) {
      tower <- raw$board$staticTowers[[i]]
      x <- tower$coord$x + 1  # R uses 1-based indexing
      y <- tower$coord$y + 1
      
      if (tower$clap) {
        board[y:(y+1), x:(x+1)] <- 2
        frozen <- append(frozen, list(c(y + 0.5, x + 0.5)))
      } else {
        board[y:(y+1), x:(x+1)] <- 1
      }
    }
  }
  
  # Helper function for special areas
  special <- function(area, start = FALSE) {
    if (length(area) == 2) {
      xs <- sapply(area, function(coord) coord$x)
      ys <- sapply(area, function(coord) coord$y)
      
      if (-1 %in% xs || m %in% xs) {
        col_idx <- max(1, min(m, xs[1] + 1))
        board[min(ys + 1):max(ys + 1), col_idx] <<- ifelse(start, -1, -2)
      }
      if (-1 %in% ys || n %in% ys) {
        row_idx <- max(1, min(n, ys[1] + 1))
        board[row_idx, min(xs + 1):max(xs + 1)] <<- ifelse(start, -1, -2)
      }
    } else {
      x <- ifelse(min(sapply(area, function(coord) coord$x)) == -1, 1, m)
      y <- ifelse(min(sapply(area, function(coord) coord$y)) == -1, 1, n)
      board[y, x] <<- ifelse(start, -1, -2)
    }
  }
  
  special(raw$board$startArea, TRUE)
  special(raw$board$endArea, FALSE)
  
  list(
    board = board,
    towers = raw$towers - raw$claps,
    claps = raw$claps,
    frozen = frozen
  )
}

# Extract frozen centers from grid
extract_frozen <- function(grid) {
  frozen_centers <- list()
  dims <- dim(grid)
  n <- dims[1]
  m <- dims[2]
  
  # Scan for 2x2 blocks of 2's or 4's
  for (i in 1:(n-1)) {
    for (j in 1:(m-1)) {
      if (grid[i, j] %in% c(2, 4) && grid[i, j+1] %in% c(2, 4) &&
          grid[i+1, j] %in% c(2, 4) && grid[i+1, j+1] %in% c(2, 4)) {
        frozen_centers <- append(frozen_centers, list(c(i + 0.5, j + 0.5)))
      }
    }
  }
  
  return(frozen_centers)
}

# Calculate L2 norm between two points
l2norm <- function(p, q) {
  sqrt((p[1] - q[1])^2 + (p[2] - q[2])^2)
}

# Find minimum distance using BFS
min_distance <- function(grid) {
  dims <- dim(grid)
  m <- dims[1]
  n <- dims[2]
  
  # Find start positions (-1)
  start_positions <- which(grid == -1, arr.ind = TRUE)
  
  if (nrow(start_positions) == 0) {
    return(list(distance = -1, path = list()))
  }
  
  # BFS setup
  queue <- list()
  visited <- matrix(FALSE, nrow = m, ncol = n)
  parent <- array(NA, dim = c(m, n, 2))
  
  # Initialize queue with start positions
  for (i in 1:nrow(start_positions)) {
    pos <- start_positions[i, ]
    queue <- append(queue, list(list(row = pos[1], col = pos[2], dist = 0)))
    visited[pos[1], pos[2]] <- TRUE
  }
  
  directions <- list(c(0, 1), c(0, -1), c(1, 0), c(-1, 0))
  
  while (length(queue) > 0) {
    current <- queue[[1]]
    queue <- queue[-1]
    
    r <- current$row
    c <- current$col
    dist <- current$dist
    
    # Check if we reached the end
    if (grid[r, c] == -2) {
      # Reconstruct path
      path <- list()
      curr_r <- r
      curr_c <- c
      
      while (!is.na(parent[curr_r, curr_c, 1])) {
        path <- append(list(c(curr_r, curr_c)), path, after = 0)
        next_r <- parent[curr_r, curr_c, 1]
        next_c <- parent[curr_r, curr_c, 2]
        curr_r <- next_r
        curr_c <- next_c
      }
      path <- append(list(c(curr_r, curr_c)), path, after = 0)
      
      # Optimize path with diagonal movements
      optimized_path <- optimize_diagonal_path(path)
      return(list(distance = dist, path = optimized_path))
    }
    
    # Explore neighbors
    for (dir in directions) {
      nr <- r + dir[1]
      nc <- c + dir[2]
      
      if (nr >= 1 && nr <= m && nc >= 1 && nc <= n &&
          !visited[nr, nc] && !(grid[nr, nc] %in% c(1, 2, 3, 4))) {
        queue <- append(queue, list(list(row = nr, col = nc, dist = dist + 1)))
        visited[nr, nc] <- TRUE
        parent[nr, nc, 1] <- r
        parent[nr, nc, 2] <- c
      }
    }
  }
  
  return(list(distance = -1, path = list()))
}

# Optimize diagonal path
optimize_diagonal_path <- function(path) {
  if (length(path) < 3) {
    return(path)
  }
  
  optimized <- list(path[[1]])
  i <- 2
  
  while (i <= length(path) - 1) {
    curr <- path[[i-1]]
    next1 <- path[[i]]
    next2 <- path[[i+1]]
    
    dr1 <- next1[1] - curr[1]
    dc1 <- next1[2] - curr[2]
    dr2 <- next2[1] - next1[1]
    dc2 <- next2[2] - next1[2]
    
    if (abs(dr1) + abs(dc1) == 1 && abs(dr2) + abs(dc2) == 1 &&
        dr1 != dr2 && dc1 != dc2) {
      optimized <- append(optimized, list(next2))
      i <- i + 2
    } else {
      optimized <- append(optimized, list(next1))
      i <- i + 1
    }
  }
  
  if (i == length(path)) {
    optimized <- append(optimized, list(path[[length(path)]]))
  }
  
  return(optimized)
}

# Calculate score for a given state
score <- function(state, r = 3, d = 5, t = 1, c = 2) {
  froz <- extract_frozen(state)
  result <- min_distance(state)
  dist <- result$distance
  path <- result$path
  
  if (dist == -1) return(-1)
  
  frozen <- d
  score_val <- 0
  
  if (length(path) > 0) {
    for (i in seq_along(path)) {
      # Check if current position is near frozen tiles
      for (f in froz) {
        if (l2norm(f, path[[i]]) < 3) {
          frozen <- frozen + d
          break
        }
      }
      
      if (frozen > 0) {
        score_val <- score_val + t * c
        frozen <- frozen - 1
      } else if (i > 1) {
        score_val <- score_val + t * l2norm(path[[i-1]], path[[i]])
      }
    }
  }
  
  return(score_val)
}

# Check if 2x2 tile can be placed
can_place_2x2_tile <- function(grid, top_row, left_col) {
  dims <- dim(grid)
  m <- dims[1]
  n <- dims[2]
  
  # Check bounds
  if (top_row + 1 > m || left_col + 1 > n) {
    return(FALSE)
  }
  
  # Check if all 4 cells are empty
  for (i in 0:1) {
    for (j in 0:1) {
      if (grid[top_row + i, left_col + j] != 0) {
        return(FALSE)
      }
    }
  }
  
  return(TRUE)
}

# Place 2x2 tile
place_2x2_tile <- function(grid, top_row, left_col, tile_type) {
  new_grid <- grid
  for (i in 0:1) {
    for (j in 0:1) {
      new_grid[top_row + i, left_col + j] <- tile_type
    }
  }
  return(new_grid)
}

# Get valid 2x2 positions
get_valid_2x2_positions <- function(grid) {
  valid_positions <- list()
  dims <- dim(grid)
  m <- dims[1]
  n <- dims[2]
  
  for (i in 1:(m-1)) {
    for (j in 1:(n-1)) {
      if (can_place_2x2_tile(grid, i, j)) {
        valid_positions <- append(valid_positions, list(c(i, j)))
      }
    }
  }
  
  return(valid_positions)
}

# Check if positions overlap
check_positions_overlap <- function(positions) {
  occupied_cells <- list()
  
  for (pos in positions) {
    top_row <- pos[1]
    left_col <- pos[2]
    
    for (i in 0:1) {
      for (j in 0:1) {
        cell <- paste(top_row + i, left_col + j, sep = ",")
        if (cell %in% occupied_cells) {
          return(TRUE)
        }
        occupied_cells <- append(occupied_cells, cell)
      }
    }
  }
  
  return(FALSE)
}

# Main optimization function
place_tiles_optimally <- function(grid, k_normal, l_frozen, max_attempts = 2000, dbg = FALSE) {
  valid_positions <- get_valid_2x2_positions(grid)
  max_total_tiles <- min(k_normal + l_frozen, length(valid_positions))
  
  if (length(valid_positions) == 0) {
    if (dbg) cat("No valid positions for tile placement!\n")
    return(list(grid = grid, score = score(grid), normal_pos = list(), frozen_pos = list()))
  }
  
  best_score <- -Inf
  best_grid <- NULL
  best_normal_pos <- list()
  best_frozen_pos <- list()
  
  baseline_score <- score(grid)
  if (baseline_score == -1) {
    if (dbg) cat("Grid has no valid path!\n")
    return(list(grid = NULL, score = -Inf, normal_pos = list(), frozen_pos = list()))
  }
  
  if (dbg) {
    cat("Baseline score:", baseline_score, "\n")
    cat("Exploring tile combinations: up to", k_normal, "normal,", l_frozen, "frozen tiles\n")
  }
  
  # Generate combinations to try
  combinations_to_try <- list()
  for (total_tiles in 1:max_total_tiles) {
    for (num_normal in 0:min(k_normal, total_tiles)) {
      num_frozen <- total_tiles - num_normal
      if (num_frozen <= l_frozen) {
        combinations_to_try <- append(combinations_to_try, list(c(num_normal, num_frozen)))
      }
    }
  }
  
  if (dbg) cat("Testing", length(combinations_to_try), "combinations\n")
  
  for (combo_idx in seq_along(combinations_to_try)) {
    combo <- combinations_to_try[[combo_idx]]
    num_normal <- combo[1]
    num_frozen <- combo[2]
    total_tiles <- num_normal + num_frozen
    
    combo_attempts <- max(100, max_attempts %/% length(combinations_to_try))
    
    for (attempt in 1:combo_attempts) {
      if (length(valid_positions) >= total_tiles) {
        selected_positions <- sample(valid_positions, total_tiles)
        
        if (!check_positions_overlap(selected_positions)) {
          normal_positions <- if (num_normal > 0) selected_positions[1:num_normal] else list()
          frozen_positions <- if (num_frozen > 0) selected_positions[(num_normal + 1):total_tiles] else list()
          
          test_grid <- grid
          
          # Place tiles
          for (pos in normal_positions) {
            test_grid <- place_2x2_tile(test_grid, pos[1], pos[2], 3)
          }
          for (pos in frozen_positions) {
            test_grid <- place_2x2_tile(test_grid, pos[1], pos[2], 4)
          }
          
          current_score <- score(test_grid)
          if (current_score != -1 && current_score > best_score) {
            best_score <- current_score
            best_grid <- test_grid
            best_normal_pos <- normal_positions
            best_frozen_pos <- frozen_positions
            
            if (dbg) {
              cat("New best:", num_normal, "N +", num_frozen, "F, score:", best_score, "\n")
            }
          }
        }
      }
    }
  }
  
  return(list(
    grid = best_grid,
    score = best_score,
    normal_pos = best_normal_pos,
    frozen_pos = best_frozen_pos
  ))
}

# Main function to find optimal tile placement
find_optimal_tile_placement <- function(grid, k_normal, l_frozen, max_attempts = 10000, dbg = FALSE) {
  if (dbg) {
    cat("Searching for optimal placement of", k_normal, "normal tiles and", l_frozen, "frozen tiles...\n")
  }
  
  original_score <- score(grid)
  if (dbg) cat("Original score:", original_score, "\n")
  
  result <- place_tiles_optimally(grid, k_normal, l_frozen, max_attempts, dbg)
  
  if (!is.null(result$grid)) {
    improvement <- result$score - original_score
    
    if (dbg) {
      cat("Optimal configuration found!\n")
      cat("Best score:", result$score, "\n")
      cat("Score improvement:", improvement, "\n")
    }
    
    return(list(
      original_score = original_score,
      best_score = result$score,
      improvement = improvement,
      best_grid = result$grid,
      normal_positions = result$normal_pos,
      frozen_positions = result$frozen_pos
    ))
  } else {
    if (dbg) cat("No valid placement found!\n")
    return(NULL)
  }
}