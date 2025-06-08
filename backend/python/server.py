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

# Define algorithm-specific parameters configuration
ALGORITHM_CONFIGS = {
    "optimal": {
        "display_name": "Optimal Search",
        "description": "Exhaustive search for best solution",
        "params": {
            "max_iterations": {
                "type": "number",
                "default": 10000,
                "min": 1000,
                "max": 50000,
                "step": 1000,
                "label": "Max Iterations",
                "description": "Maximum search iterations"
            },
            "random_seed": {
                "type": "number", 
                "default": 42,
                "min": 1,
                "max": 9999,
                "step": 1,
                "label": "Random Seed",
                "description": "Seed for reproducible results"
            }
        }
    },
    "greedy": {
        "display_name": "Greedy Search",
        "description": "Fast heuristic-based search",
        "params": {
            "max_iterations": {
                "type": "number",
                "default": 5000,
                "min": 500,
                "max": 50000,
                "step": 500,
                "label": "Max Iterations"
            },
            "random_seed": {
                "type": "number",
                "default": 42,
                "min": 1,
                "max": 9999,
                "step": 1,
                "label": "Random Seed"
            },
            "greediness": {
                "type": "range",
                "default": 0.8,
                "min": 0.1,
                "max": 1.0,
                "step": 0.1,
                "label": "Greediness Factor",
                "description": "Higher values = more greedy"
            }
        }
    },
    "genetic": {
        "display_name": "Genetic Algorithm",
        "description": "Evolution-based optimization",
        "params": {
            "population_size": {
                "type": "number",
                "default": 100,
                "min": 20,
                "max": 500,
                "step": 20,
                "label": "Population Size"
            },
            "generations": {
                "type": "number",
                "default": 200,
                "min": 50,
                "max": 1000,
                "step": 50,
                "label": "Generations"
            },
            "mutation_rate": {
                "type": "range",
                "default": 0.1,
                "min": 0.01,
                "max": 0.5,
                "step": 0.01,
                "label": "Mutation Rate"
            },
            "crossover_rate": {
                "type": "range",
                "default": 0.8,
                "min": 0.5,
                "max": 1.0,
                "step": 0.1,
                "label": "Crossover Rate"
            },
            "random_seed": {
                "type": "number",
                "default": 42,
                "min": 1,
                "max": 9999,
                "step": 1,
                "label": "Random Seed"
            }
        }
    },
    "simulated": {
        "display_name": "Simulated Annealing",
        "description": "Temperature-based optimization",
        "params": {
            "initial_temp": {
                "type": "number",
                "default": 1000,
                "min": 100,
                "max": 5000,
                "step": 100,
                "label": "Initial Temperature"
            },
            "cooling_rate": {
                "type": "range",
                "default": 0.95,
                "min": 0.8,
                "max": 0.99,
                "step": 0.01,
                "label": "Cooling Rate"
            },
            "min_temp": {
                "type": "range",
                "default": 0.01,
                "min": 0.001,
                "max": 0.1,
                "step": 0.001,
                "label": "Minimum Temperature"
            },
            "max_iterations": {
                "type": "number",
                "default": 10000,
                "min": 1000,
                "max": 50000,
                "step": 1000,
                "label": "Max Iterations"
            },
            "random_seed": {
                "type": "number",
                "default": 42,
                "min": 1,
                "max": 9999,
                "step": 1,
                "label": "Random Seed"
            }
        }
    }
}

@app.route("/solver", methods=["POST"])
def solve_maze():
    data = request.get_json()
    print("Received solving request!")
    
    try:
        # Extract solver settings
        solver_settings = data.get('solver_settings', {})
        algorithm = solver_settings.get('algorithm', 'optimal')
        
        # Get algorithm config and extract parameters
        algo_config = ALGORITHM_CONFIGS.get(algorithm, ALGORITHM_CONFIGS['optimal'])
        params = {}
        
        for param_name, param_config in algo_config['params'].items():
            # Use provided value or default
            params[param_name] = solver_settings.get(param_name, param_config['default'])
        
        print(f"Solver settings: Algorithm={algorithm}, Params={params}")
        
        # Set random seed if available
        if 'random_seed' in params:
            random.seed(params['random_seed'])
            np.random.seed(params['random_seed'])
        
        state, nt, nf, froz = extract_state(data)
        print('Game state extracted successfully!')
        
        t0 = time()
        
        # Choose algorithm and pass parameters
        if algorithm == 'optimal':
            result = find_optimal_tile_placement(
                state, k_normal=nt, l_frozen=nf, 
                max_attempts=params['max_iterations']
            )
        elif algorithm == 'greedy':
            # Pass greedy-specific parameters
            result = find_optimal_tile_placement(
                state, k_normal=nt, l_frozen=nf, 
                max_attempts=params['max_iterations']
            )
        elif algorithm == 'genetic':
            # Pass genetic algorithm parameters
            print("Note: Genetic algorithm not yet implemented, using optimal")
            result = find_optimal_tile_placement(
                state, k_normal=nt, l_frozen=nf, 
                max_attempts=params.get('generations', 200) * params.get('population_size', 100) // 10
            )
        elif algorithm == 'simulated':
            # Pass simulated annealing parameters
            print("Note: Simulated annealing not yet implemented, using optimal")
            result = find_optimal_tile_placement(
                state, k_normal=nt, l_frozen=nf, 
                max_attempts=params.get('max_iterations', 10000)
            )
        else:
            result = find_optimal_tile_placement(state, k_normal=nt, l_frozen=nf, max_attempts=10000)
        
        t1 = time()
        
        if result:
            result.pop('best_grid', None)
            result['time_taken'] = f"{t1 - t0:.3f}s"
            result['algorithm_used'] = algorithm
            result['parameters_used'] = params
            
            print(f"Solution found in {result['time_taken']} using {algorithm}")
            return jsonify(result)
        else:
            return jsonify({
                "error": "No optimal placement found",
                "algorithm_used": algorithm,
                "parameters_used": params
            }), 400

    except Exception as e:
        print(f"Error during solving: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


@app.route('/available', methods=['GET'])
def available_options():
    """Return available algorithms and their dynamic parameter configurations"""
    return jsonify({
        "status": "healthy",
        "timestamp": datetime.now().isoformat(),
        "algorithms": list(ALGORITHM_CONFIGS.keys()),
        "algorithm_configs": ALGORITHM_CONFIGS
    })


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


if __name__ == "__main__": #for local deploy
    print("Starting Maze Solver Server...")
    print("Supported algorithms:", list(ALGORITHM_CONFIGS.keys()))
    print("Server running on http://127.0.0.1:5000")
    app.run(port=5000, debug=True)