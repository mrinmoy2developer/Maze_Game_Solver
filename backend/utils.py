from collections import deque
import math,copy,random
import matplotlib.pyplot as plt
import numpy as np,json
from tqdm import tqdm
from matplotlib.colors import ListedColormap, BoundaryNorm

def extract_state(raw):
    n=raw['board']['height']
    m=raw['board']['width']
    frozen=[]
    board=np.zeros((n,m))
    for t in raw['board']['staticTowers']:
        x=t['coord']['x']
        y=t['coord']['y']
        if t['clap']: 
            board[y:y+2,x:x+2]=2
            frozen+=[(y+0.5,x+0.5)]
        else: board[y:y+2,x:x+2]=1
    def special(area,start=False):
        if len(area)==2:
            xs=[i['x'] for i in area]
            ys=[i['y'] for i in area]
            if -1 in xs or m in xs:
                board[min(ys):max(ys)+1,min(m-1,max(0,xs[0]))]=-1 if start else -2
            if -1 in ys or n in ys:
                board[min(n-1,max(0,ys[0])),min(xs):max(xs)+1]=-1 if start else -2
        else:
            x= 0 if min([i['x'] for i in area])==-1 else m-1
            y= 0 if min([i['y'] for i in area])==-1 else n-1
            board[y,x]=-1 if start else -2
    special(raw['board']['startArea'],True)
    special(raw['board']['endArea'],False)
    return board,raw['towers']-raw['claps'],raw['claps'],frozen

def extract_frozen(grid):
    frozen_centers = []
    n,m =grid.shape
    # Scan for 2x2 blocks of 2's, checking only potential top-left corners
    for i in range(n-1):
        for j in range(m-1):
            if (grid[i][j] in {2,4} and grid[i][j+1] in {2,4} and 
                grid[i+1][j] in {2,4} and grid[i+1][j+1] in {2,4}):
                # Center of 2x2 tile is at (i+0.5, j+0.5)
                frozen_centers.append((i + 0.5, j + 0.5))
    return frozen_centers

def visualize_grid(grid,path=None,highlight_cells=None):
    """
    Visualize the processed grid with custom colors for each value.
    """
    # Define a mapping from tile values to custom colors
    color_dict = {
        0: "#9ee3f5",  # light gray for Empty
        1: "#f42121",  # red for Red Block
        2: "#3B59EF",  # blue for Frost
        3:"#65737E",
        4:"#2F3068",
        -1:"#3DF659", #start
        -2:"#FFAD1F" #end
        # Add more if needed
    }

    # Create a color list ordered by sorted keys of color_dict
    value_list = sorted(color_dict.keys())
    color_list = [color_dict[val] for val in value_list]

    # Create colormap and norm
    cmap = ListedColormap(color_list)
    norm = BoundaryNorm(boundaries=[v - 0.5 for v in value_list] + [value_list[-1] + 0.5], ncolors=len(color_list))

    plt.figure(figsize=(12, 8))
    im = plt.imshow(grid, cmap=cmap, norm=norm, interpolation='nearest')
    cbar = plt.colorbar(im, ticks=value_list)
    cbar.ax.set_yticklabels([f'{val} ({label})' for val, label in zip(value_list, ['Empty', 'Normal Fixed', 'Frost fixed','Normal Movable','Frost Movable','Start','End'])])

    plt.title('Processed Game Grid')
    plt.xlabel('Column')
    plt.ylabel('Row')

    # Add grid lines
    for i in range(grid.shape[1] + 1):
        plt.axvline(i - 0.5, color='white', linewidth=0.5, alpha=0.85)
    for i in range(grid.shape[0] + 1):
        plt.axhline(i - 0.5, color='white', linewidth=0.5, alpha=0.85)

    # Plot path if provided
    if path:
        rows, cols = zip(*path)
        plt.plot(cols, rows, color='black', linewidth=2, marker='o', markersize=4, label='Path')
        plt.legend()
    
    # Plot red dots at highlighted cells
    if highlight_cells:
        highlight_rows, highlight_cols = zip(*highlight_cells)
        plt.scatter(highlight_cols, highlight_rows, color='red', s=50, zorder=5, label='Highlighted Cells')


    plt.tight_layout()
    plt.show()

def min_distance(grid):
    """Find minimum distance between any -1 cell and any -2 cell."""
    m, n = len(grid), len(grid[0])
    queue = deque()
    visited = set()
    parent = {}
    # Find all -1 cells and add to queue as starting points
    for i in range(m):
        for j in range(n):
            if grid[i][j] == -1:
                queue.append((i, j, 0))
                visited.add((i, j))
                parent[(i, j)] = None
    
    directions = [(0, 1), (0, -1), (1, 0), (-1, 0)]
    while queue:
        r, c, dist = queue.popleft()
        
        if grid[r][c] == -2:
            # Reconstruct path
            path = []
            current = (r, c)
            while current is not None:
                path.append(current)
                current = parent[current]
            path.reverse()
            
            # Optimize path with diagonal movements
            optimized_path = optimize_diagonal_path(path)
            return dist, optimized_path
        
        for dr, dc in directions:
            nr, nc = r + dr, c + dc
            
            if (0 <= nr < m and 0 <= nc < n and 
                (nr, nc) not in visited and 
                grid[nr][nc] not in [1, 2, 3, 4]):
                
                queue.append((nr, nc, dist + 1))
                visited.add((nr, nc))
                parent[(nr, nc)] = (r, c)
    return -1, []

def score(state,r=3,d=5,t=1,c=2):
    froz=extract_frozen(state)
    dist,path=min_distance(state)
    if dist==-1:return -1
    frozen=d
    score=0
    for i in range(len(path)):
        for f in froz:
            if l2norm(f,path[i])<3:
                frozen+=d
                break
        if frozen>0:
            score+=t*c
            frozen-=1
        elif i>0:score+=t*l2norm(path[i-1],path[i])
    return score

def optimize_diagonal_path(path):
    """Optimize path by replacing two orthogonal moves with diagonal when possible."""
    if len(path) < 3:
        return path
    
    optimized = [path[0]]
    i = 1
    
    while i < len(path) - 1:
        curr = path[i-1]
        next1 = path[i]
        next2 = path[i+1]
        
        dr1, dc1 = next1[0] - curr[0], next1[1] - curr[1]
        dr2, dc2 = next2[0] - next1[0], next2[1] - next1[1]
        
        if (abs(dr1) + abs(dc1) == 1 and abs(dr2) + abs(dc2) == 1 and 
            dr1 != dr2 and dc1 != dc2):
            optimized.append(next2)
            i += 2
        else:
            optimized.append(next1)
            i += 1
    
    if i == len(path) - 1:
        optimized.append(path[-1])
    
    return optimized

def l2norm(p, q):
    return math.sqrt((p[0]-q[0])**2+(p[1]-q[1])**2)

def can_place_2x2_tile(grid, top_row, left_col):
    """Check if a 2x2 tile can be placed at the given top-left position."""
    m, n = len(grid), len(grid[0])
    # Check bounds
    if top_row + 1 >= m or left_col + 1 >= n:
        return False
    
    # Check if all 4 cells are empty (value 0)
    for i in range(2):
        for j in range(2):
            if grid[top_row + i][left_col + j] != 0:
                return False
    return True

def place_2x2_tile(grid, top_row, left_col, tile_type):
    """Place a 2x2 tile at the given position. tile_type: 1 for normal, 2 for frozen."""
    new_grid = copy.deepcopy(grid)
    for i in range(2):
        for j in range(2):
            new_grid[top_row + i][left_col + j] = tile_type
    return new_grid

def get_valid_2x2_positions(grid):
    """Get all valid positions where a 2x2 tile can be placed."""
    valid_positions = []
    m, n = len(grid), len(grid[0])
    
    for i in range(m - 1):
        for j in range(n - 1):
            if can_place_2x2_tile(grid, i, j):
                valid_positions.append((i, j))
    return valid_positions

def check_positions_overlap(positions):
    """Check if any 2x2 tile positions overlap."""
    occupied_cells = set()
    for pos in positions:
        top_row, left_col = pos
        for i in range(2):
            for j in range(2):
                cell = (top_row + i, left_col + j)
                if cell in occupied_cells:
                    return True
                occupied_cells.add(cell)
    return False

def place_tiles_optimally(grid, k_normal, l_frozen, max_attempts=2000,dbg=False):
    """
    Find optimal placement of up to k normal 2x2 tiles and up to l frozen 2x2 tiles.
    Optimized version with smart pruning and adaptive strategies.
    
    Args:
        grid: Original grid with existing tiles and start/end positions
        k_normal: Maximum number of normal 2x2 tiles to place (filled with 1's)
        l_frozen: Maximum number of frozen 2x2 tiles to place (filled with 2's)
        max_attempts: Maximum number of placement attempts per combination
    
    Returns:
        tuple: (best_grid, best_score, normal_positions, frozen_positions)
    """
    valid_positions = get_valid_2x2_positions(grid)
    max_total_tiles = min(k_normal + l_frozen, len(valid_positions))
    
    # Early exit if no valid positions
    if len(valid_positions) == 0:
        print("No valid positions for tile placement!")
        return grid, score(grid), [], []
    
    best_score = float('-inf')
    best_grid = None
    best_normal_pos = []
    best_frozen_pos = []
    best_combination = (0, 0)
    
    # Get baseline score
    baseline_score = score(grid)
    if baseline_score == -1:
        print("Grid has no valid path!")
        return None, float('-inf'), [], []
    
    if dbg:
        print(f"Baseline score: {baseline_score}")
        print(f"Exploring tile combinations: up to {k_normal} normal, {l_frozen} frozen tiles")
        
    # Pre-compute path information for strategy optimization
    original_dist, original_path = min_distance(grid)
    path_nearby_positions = []
    if original_dist > 0 and original_path:
        path_nearby_positions = get_path_nearby_2x2_positions(grid, original_path, valid_positions)
    
    # Smart combination generation - prioritize higher impact combinations
    combinations_to_try = []
    
    # Strategy: Try combinations in order of likely impact
    # 1. Start with combinations that use more tiles (likely higher impact)
    # 2. Balance between normal and frozen tiles
    for total_tiles in range(1, max_total_tiles + 1):
        for num_normal in range(min(k_normal, total_tiles) + 1):
            num_frozen = total_tiles - num_normal
            if num_frozen <= l_frozen:
                combinations_to_try.append((num_normal, num_frozen))
    
    # Sort by total tiles (descending) then by balanced distribution
    combinations_to_try.sort(key=lambda x: (-x[0] - x[1], -min(x[0], x[1])))
    
    if dbg:print(f"Testing {len(combinations_to_try)} combinations in smart order...")
    
    # Adaptive attempt allocation based on combination complexity
    total_combinations = len(combinations_to_try)
    early_termination_threshold = baseline_score * 1.5  # Stop if we find a very good solution early
    
    for combo_idx, (num_normal, num_frozen) in enumerate(combinations_to_try):
        total_tiles = num_normal + num_frozen
        
        # Adaptive attempt count - more attempts for promising combinations
        if combo_idx < total_combinations // 3:  # First third gets more attempts
            combo_attempts = max_attempts
        elif combo_idx < 2 * total_combinations // 3:  # Middle third gets moderate attempts
            combo_attempts = max_attempts // 2
        else:  # Last third gets fewer attempts
            combo_attempts = max_attempts // 4
        
        if dbg:print(f"Combination {combo_idx + 1}/{total_combinations}: {num_normal}N + {num_frozen}F ({combo_attempts} attempts)")
        
        combo_best_score = float('-inf')
        combo_best_grid = None
        combo_best_normal_pos = []
        combo_best_frozen_pos = []
        
        # Choose strategy based on availability of path information and tile count
        use_path_strategy = len(path_nearby_positions) >= total_tiles and total_tiles > 1
        
        if use_path_strategy:
            # Prioritize path-aware placement for larger tile counts
            path_attempts = int(combo_attempts * 0.7)
            random_attempts = combo_attempts - path_attempts
        else:
            # Use mostly random placement
            path_attempts = int(combo_attempts * 0.3)
            random_attempts = combo_attempts - path_attempts
        
        # Strategy 1: Path-aware placement (if applicable)
        if use_path_strategy and path_attempts > 0:
            for attempt in range(path_attempts):
                success = False
                for retry in range(5):  # Reduced retries for efficiency
                    # Smart position selection
                    if len(path_nearby_positions) >= total_tiles:
                        selected_positions = random.sample(path_nearby_positions, total_tiles)
                    else:
                        nearby_count = len(path_nearby_positions)
                        selected_positions = path_nearby_positions[:]
                        remaining_positions = [p for p in valid_positions if p not in path_nearby_positions]
                        if len(remaining_positions) >= total_tiles - nearby_count:
                            selected_positions.extend(random.sample(remaining_positions, total_tiles - nearby_count))
                        else:
                            break
                    
                    if not check_positions_overlap(selected_positions):
                        normal_positions = selected_positions[:num_normal]
                        frozen_positions = selected_positions[num_normal:]
                        
                        test_grid = copy.deepcopy(grid)
                        
                        # Place tiles
                        for pos in normal_positions:
                            test_grid = place_2x2_tile(test_grid, pos[0], pos[1], 3)
                        for pos in frozen_positions:
                            test_grid = place_2x2_tile(test_grid, pos[0], pos[1], 4)
                        
                        current_score = score(test_grid)
                        if current_score != -1 and current_score > combo_best_score:
                            combo_best_score = current_score
                            combo_best_grid = copy.deepcopy(test_grid)
                            combo_best_normal_pos = normal_positions
                            combo_best_frozen_pos = frozen_positions
                        
                        success = True
                        break
                
                # Early termination if we found an excellent solution
                if combo_best_score > early_termination_threshold:
                    print(f"Early termination: Excellent solution found (score: {combo_best_score})")
                    break
        
        # Strategy 2: Random placement
        for attempt in range(random_attempts):
            success = False
            for retry in range(5):  # Reduced retries
                selected_positions = random.sample(valid_positions, total_tiles)
                
                if not check_positions_overlap(selected_positions):
                    normal_positions = selected_positions[:num_normal]
                    frozen_positions = selected_positions[num_normal:]
                    
                    test_grid = copy.deepcopy(grid)
                    
                    # Place tiles
                    for pos in normal_positions:
                        test_grid = place_2x2_tile(test_grid, pos[0], pos[1], 3)
                    for pos in frozen_positions:
                        test_grid = place_2x2_tile(test_grid, pos[0], pos[1], 4)
                    
                    current_score = score(test_grid)
                    if current_score != -1 and current_score > combo_best_score:
                        combo_best_score = current_score
                        combo_best_grid = copy.deepcopy(test_grid)
                        combo_best_normal_pos = normal_positions
                        combo_best_frozen_pos = frozen_positions
                    
                    success = True
                    break
            
            # Early termination check
            if combo_best_score > early_termination_threshold:
                break
        
        # Update global best
        if combo_best_score > best_score:
            best_score = combo_best_score
            best_grid = combo_best_grid
            best_normal_pos = combo_best_normal_pos
            best_frozen_pos = combo_best_frozen_pos
            best_combination = (num_normal, num_frozen)
            print(f"New best: {num_normal}N + {num_frozen}F, score: {best_score}")
            
            # Early global termination for exceptional solutions
            if best_score > early_termination_threshold * 1.2:
                print(f"Exceptional solution found, terminating search early!")
                break
        
        # Adaptive pruning - if recent combinations aren't improving, reduce search
        if combo_idx > 5 and combo_best_score < best_score * 0.8:
            print(f"Pruning: Recent combinations underperforming, skipping some...")
            # Skip every other combination in the remaining set
            if combo_idx % 2 == 0:
                continue
    
    print(f"Final best combination: {best_combination[0]} normal + {best_combination[1]} frozen tiles")
    print(f"Best score achieved: {best_score} (improvement: {best_score - baseline_score})")
    
    return best_grid, best_score, best_normal_pos, best_frozen_pos

def get_path_nearby_2x2_positions(grid, path, valid_positions):
    """Get 2x2 positions that are near the path."""
    nearby_positions = []
    
    for pos in valid_positions:
        top_row, left_col = pos
        tile_center = (top_row + 0.5, left_col + 0.5)
        
        # Check if tile is close to any point on the path
        min_distance_to_path = min(l2norm(tile_center, path_point) for path_point in path)
        
        if min_distance_to_path <= 4:  # Adjust threshold as needed
            nearby_positions.append(pos)
    
    return nearby_positions

def find_optimal_tile_placement(grid, k_normal, l_frozen, max_attempts=10000,dbg=False):
    """
    Main function to find optimal 2x2 tile placement.
    
    Args:
        grid: Original grid
        k_normal: Number of normal 2x2 tiles (newly added marked as 3)
        l_frozen: Number of frozen 2x2 tiles (newly added marked as 4)
        max_attempts: Maximum optimization attempts
    
    Returns:
        Dictionary with results
    """
    if dbg:
        print("Original grid:")
        _,path=min_distance(grid)
        visualize_grid(grid,path)
    
    original_score = score(grid)
    if dbg:
        print(f"Original score: {original_score}")
        print(f"\nSearching for optimal placement of {k_normal} normal tiles and {l_frozen} frozen tiles...")
        
    best_grid, best_score, normal_pos, frozen_pos = place_tiles_optimally(
        grid, k_normal, l_frozen, max_attempts,dbg
    )
    if best_grid is not None:
        if dbg:
            print(f"\nOptimal configuration found!")
            print(f"Best score: {best_score}")
            print(f"Score improvement: {best_score - original_score}")
            print(f"Normal tile positions (top-left corners): {normal_pos}")
            print(f"Frozen tile positions (top-left corners): {frozen_pos}")
            print("\nOptimal grid:")
            _,best_path=min_distance(best_grid)
            visualize_grid(best_grid,best_path)
        return {
            'original_score': original_score,
            'best_score': best_score,
            'improvement': best_score - original_score,
            'best_grid': best_grid,
            'normal_positions': normal_pos,
            'frozen_positions': frozen_pos
        }
    else:
        print("No valid placement found!")
        return None

if __name__=='__main__':
    n=18
    m=16
    N=17
    M=15
    board=np.zeros((n,m))
    with open('game_2443_r2.json','r') as f:
        raw=json.load(f)
    state,nt,nf,froz=extract_state(raw)
    result = find_optimal_tile_placement(state, k_normal=nt,l_frozen=nf)

    if result:
        print(f"Score improved by {result['improvement']}")
        optimal_grid = result['best_grid']
        normal_positions = result['normal_positions']  # Top-left corners
        frozen_positions = result['frozen_positions']  # Top-left corners
    result.pop('best_grid')
    with open("sol_game2443_r2.json", "w") as f:
        json.dump(result, f, indent=4)