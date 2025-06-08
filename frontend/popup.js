document.addEventListener("DOMContentLoaded", () => {
  const runBtn = document.getElementById("runBtn");
  const loader = document.getElementById("loader");
  const logs = document.getElementById("logs");

  // Settings elements
  const maxIterationsInput = document.getElementById("maxIterations");
  const randomSeedInput = document.getElementById("randomSeed");
  const algorithmSelect = document.getElementById("algorithm");
  const backendSelect = document.getElementById("backendSelect");
  const customBackendGroup = document.getElementById("customBackendGroup");
  const backendUrlInput = document.getElementById("backendUrl");

  // Modal elements
  const modal = document.getElementById("confirmModal");
  const skipConfirm = document.getElementById("skipConfirm");
  const confirmYes = document.getElementById("confirmYes");
  const confirmNo = document.getElementById("confirmNo");

  // Load saved settings first
  loadSettings();
  // Then fetch dynamic options
   fetchAlgos(backendSelect.dataset.selected,backendUrlInput.value);

  runBtn.onclick = () => {
    const skip = localStorage.getItem("skipSolverConfirm");
    if (skip === "true") {
      triggerSolver();
    } else {
      modal.style.display = "block";
    }
  };

  confirmYes.onclick = () => {
    if (skipConfirm.checked) {
      localStorage.setItem("skipSolverConfirm", "true");
    }
    modal.style.display = "none";
    triggerSolver();
  };

  confirmNo.onclick = () => {
    modal.style.display = "none";
  };

  // Save settings when they change
  maxIterationsInput.onchange = saveSettings;
  randomSeedInput.onchange = saveSettings;
  algorithmSelect.onchange = saveSettings;
  backendSelect.onchange = () => {
   fetchAlgos(backendSelect.value,backendUrlInput.value);
    saveSettings();
    updateCustomBackendVisibility();
  };
  backendUrlInput.onchange = saveSettings;

  function loadSettings() {
    maxIterationsInput.value = localStorage.getItem("solverMaxIterations") || 1000;
    randomSeedInput.value = localStorage.getItem("solverRandomSeed") || 42;
    algorithmSelect.value=algorithmSelect.dataset.selected = localStorage.getItem("solverAlgorithm");
    backendSelect.value=backendSelect.dataset.selected = localStorage.getItem("solverBackend");
    backendUrlInput.value = localStorage.getItem("solverbackendUrl") || "";
    updateCustomBackendVisibility();
  }

  function saveSettings() {
    localStorage.setItem("solverMaxIterations", maxIterationsInput.value);
    localStorage.setItem("solverRandomSeed", randomSeedInput.value);
    localStorage.setItem("solverAlgorithm", algorithmSelect.value);
    localStorage.setItem("solverBackend", backendSelect.value);
    localStorage.setItem("solverbackendUrl", backendUrlInput.value);
  }

  function updateCustomBackendVisibility() {
    customBackendGroup.style.display = backendSelect.value === "custom" ? "flex" : "none";
  }

  function getSettings() {
    return {
      maxIterations: parseInt(maxIterationsInput.value),
      randomSeed: parseInt(randomSeedInput.value),
      algorithm: algorithmSelect.value,
      backend: backendSelect.value,
      backendUrl: backendUrlInput.value
    };
  }

  function isNumeric(str) {
    return /^\d+$/.test(str);
  }

  function getGameMode(url) {
    const modes=['challenge','puzzle','arena','academy','daily'];
    const parts = url.split('/');
    if(parts[3]==='challenge'){
        if(isNumeric(parts[4]))return 'challenge';
        else if(parts[4]==='daily')return 'daily';
    }
    else if(modes.includes(parts[3]))return parts[3];
    return -1;
}

  function triggerSolver() {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const currentTab = tabs[0];
      const url = currentTab.url;

      if (getGameMode(url) === -1) {
        loader.style.display = "none";
        logs.textContent = "Invalid URL! Solver can only run on valid maze game tabs!\n";
        return;
      }

      saveSettings();
      const settings = getSettings();

      loader.style.display = "block";
      logs.textContent = `Starting solver with settings:\n`;
      logs.textContent += `Algorithm: ${settings.algorithm}\n`;
      logs.textContent += `Max Iterations: ${settings.maxIterations}\n`;
      logs.textContent += `Random Seed: ${settings.randomSeed}\n`;
      logs.textContent += `Backend: ${settings.backend}\n`;
      if (settings.backend === "custom") {
        logs.textContent += `Custom URL: ${settings.backendUrl}\n`;
      }
      logs.textContent += "Resetting and solving...\n";

      chrome.runtime.sendMessage({
        type: "RUN_SOLVER",
        settings: settings
      }, response => {
        if (response && response.status === "started") {
          logs.textContent += "Solver started...\n";
        } else if (response && response.status === "error") {
          logs.textContent += `Error: ${response.message}\n`;
          loader.style.display = "none";
        }
      });
    });
  }

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === "MAZE_SOLVER_LOG") {
      logs.textContent += message.text + "\n";
      logs.scrollTop = logs.scrollHeight;
    }
    if (message.type === "SOLVER_COMPLETE") {
      loader.style.display = "none";
    }
  });
function logToPopup(msg) {
  chrome.runtime.sendMessage({ type: "MAZE_SOLVER_LOG", text: msg });
}
  async function fetchAlgos(backend,backendUrl) {
    if(backend!=="custom")
        backendUrl='https://maze-game-solver.onrender.com';
        // backendUrlInput.value='http://127.0.0.1:5000';

    try {
        logToPopup("Fetching list of available algos...");
      // Show loading indicators
      algorithmSelect.innerHTML = `<option disabled selected>Loading...</option>`;
      const response = await fetch(`${backendUrl}/available`);
      if (!response.ok) throw new Error("Backend fetch failed");
      const data = await response.json();
      const algorithms = data.algorithms || ["default","none"];
      algorithmSelect.innerHTML = "";
      algorithms.forEach(alg => {
        const opt = document.createElement("option");
        opt.value = alg;
        opt.textContent = alg;
        algorithmSelect.appendChild(opt);
      });
      // Restore selected if available
      if (algorithms.includes(algorithmSelect.dataset.selected)) {
        algorithmSelect.value = algorithmSelect.dataset.selected;
      }
    } catch (err) {
      logs.textContent += `⚠️ Failed to fetch options from backend. Using defaults.\n`;

      // Populate with default options
      algorithmSelect.innerHTML = `<option value="optimal">Optimal</option><option value="greedy">Greedy</option>`;
      if (algorithmSelect.dataset.selected) {
        algorithmSelect.value = algorithmSelect.dataset.selected;
      }
    }
  }
});