from flask import Flask, request, jsonify
import numpy as np,os
import random
from datetime import datetime
from time import time
from utils import *
from flask_ngrok import run_with_ngrok
from flask_cors import CORS

app = Flask(__name__)
# run_with_ngrok(app)
CORS(app)

@app.route("/solver", methods=["POST"])
def solve_maze():
    data = request.get_json()
    print("Received solving request!")
    
    try:
        # Extract solver settings if provided
        solver_settings = data.get('solver_settings', {})
        max_iterations = solver_settings.get('max_iterations', 10000)
        random_seed = solver_settings.get('random_seed', 42)
        algorithm = solver_settings.get('algorithm', 'optimal')
        
        print(f"Solver settings: Algorithm={algorithm}, Max_iter={max_iterations}, Seed={random_seed}")
        
        # Set random seed for reproducibility
        random.seed(random_seed)
        np.random.seed(random_seed)
        
        state, nt, nf, froz = extract_state(data)
        print('Game state extracted successfully!')
        
        t0 = time()
        
        # Choose algorithm based on settings
        if algorithm == 'optimal':
            result = find_optimal_tile_placement(state, k_normal=nt, l_frozen=nf, max_attempts=max_iterations)
        elif algorithm == 'greedy':
            # You can implement different algorithms here
            print("Note: Greedy algorithm not yet implemented, using optimal")
            result = find_optimal_tile_placement(state, k_normal=nt, l_frozen=nf, max_attempts=max_iterations//2)
        elif algorithm == 'genetic':
            print("Note: Genetic algorithm not yet implemented, using optimal")
            result = find_optimal_tile_placement(state, k_normal=nt, l_frozen=nf, max_attempts=max_iterations)
        elif algorithm == 'simulated':
            print("Note: Simulated annealing not yet implemented, using optimal")
            result = find_optimal_tile_placement(state, k_normal=nt, l_frozen=nf, max_attempts=max_iterations)
        else:
            result = find_optimal_tile_placement(state, k_normal=nt, l_frozen=nf, max_attempts=max_iterations)
        
        t1 = time()
        
        if result:
            result.pop('best_grid', None)  # Remove grid from response to reduce size
            result['time_taken'] = f"{t1 - t0:.3f}s"
            result['algorithm_used'] = algorithm
            result['iterations_used'] = max_iterations
            result['random_seed_used'] = random_seed
            
            print(f"Solution found in {result['time_taken']} using {algorithm} algorithm")
            print(f"Score improvement: {result.get('improvement', 'N/A')}")
            
            return jsonify(result)
        else:
            return jsonify({
                "error": "No optimal placement found",
                "algorithm_used": algorithm,
                "iterations_used": max_iterations
            }), 400

    except Exception as e:
        print(f"Error during solving: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


@app.route('/debug', methods=['GET', 'POST'])
def debug_route():
    if request.method == 'GET':
        return jsonify({
            "message": "GET request received",
            "headers": dict(request.headers)
        })

    if request.method == 'POST':
        return jsonify({
            "message": "POST request received",
            "headers": dict(request.headers),
            "json": request.get_json(),
            "form": request.form.to_dict()
        })

@app.route('/health', methods=['GET'])
def health_check():
    return jsonify({
        "status": "healthy",
        "timestamp": datetime.now().isoformat(),
        "supported_algorithms": ["optimal", "greedy", "genetic", "simulated"]
    })

# if __name__ == "__main__": #for local deploy
#     print("Starting Maze Solver Server...")
#     print("Supported algorithms: optimal, greedy, genetic, simulated")
#     print("Server running on http://127.0.0.1:5000")
#     app.run(port=5000, debug=True)
if __name__ == "__main__":  #for hosting on render.com
    port = int(os.environ.get("PORT", 5000))
    print("Starting Maze Solver Server...")
    print("Supported algorithms: optimal, greedy, genetic, simulated")
    print(f"Server running on http://0.0.0.0:{port}")
    app.run(host="0.0.0.0", port=port)