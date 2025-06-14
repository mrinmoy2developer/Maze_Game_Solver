document.addEventListener("DOMContentLoaded", () => {
  const runBtn = document.getElementById("runBtn");
  const overlayBtn = document.getElementById("overlayBtn");
  const loader = document.getElementById("loader");
  const logs = document.getElementById("logs");

  const algorithmSelect = document.getElementById("algorithm");
  const backendSelect = document.getElementById("backendSelect");
  const customBackendGroup = document.getElementById("customBackendGroup");
  const backendUrlInput = document.getElementById("backendUrl");
  const dynamicParamsContainer = document.getElementById("dynamicParams");

  // const modal = document.getElementById("confirmModal");
  // const skipConfirm = document.getElementById("skipConfirm");
  // const confirmYes = document.getElementById("confirmYes");
  // const confirmNo = document.getElementById("confirmNo");

  // Advanced section elements
  const advancedToggle = document.getElementById("advancedToggle");
  const advancedSection = document.getElementById("advancedContent");
  const towerIdxToggle = document.getElementById("towerIndexToggle");
  const sqIdxToggle = document.getElementById("sqIndexToggle");
  // const bestPlayerBtn = document.getElementById("bestPlayerBtn");
  // Replace the existing bestPlayerBtn line with:
const fetchPlayersBtn = document.getElementById("fetchPlayersBtn");
const playerListContainer = document.getElementById("playerListContainer");
const playerList = document.getElementById("playerList");
// Add this new function:
function displayPlayerList(players) {
  playerList.innerHTML = "";
  playerListContainer.style.display = "block";
  
  players.forEach((player, index) => {
    const playerItem = document.createElement("div");
    playerItem.className = "player-item";
    playerItem.innerHTML = `
      <div class="player-row">
        <div class="player-info">
          <span class="player-name">${player.name}</span>
          <span class="player-score">Score: ${player.score}</span>
        </div>
          <span>🟥x${player.normal_tiles}   ❄️x${player.frozen_tiles}</span>
      </div>
      <button class="play-solution-btn" data-index="${player.index}">Play</button>
    `;
    
    const playBtn = playerItem.querySelector(".play-solution-btn");
    playBtn.onclick = () => {
      chrome.runtime.sendMessage({
        type: "SHOW_BEST_PLAYER_SOLUTION",
        playerIndex: player.index
      }, (response) => {
        if (response && response.status === "done") {
          logToPopup(`🎮 Playing ${player.name}'s solution`, "info");
        } else {
          logToPopup("❌ Failed to play solution", "error");
        }
      });
    };
    
    playerList.appendChild(playerItem);
  });
} 
  // Set a global variable
async function setGlobalVar(key, value) {
  try {
    await chrome.storage.local.set({ [key]: value });
    console.log(`Global var '${key}' set to:`, value);
  } catch (error) {
    console.error('Error setting global var:', error);
  }
}

// Get a global variable
async function getGlobalVar(key) {
  try {
    const result = await chrome.storage.local.get([key]);
    return result[key];
  } catch (error) {
    console.error('Error getting global var:', error);
    return null;
  }
}

  let algorithmConfigs = {};
  let currentParams = {};
  let indexOverlayVisible = false;

  // Initialize the extension
  initializeExtension();
  let overlay;
  (async()=>{
    overlay=await getGlobalVar('overlay');
    if(!overlay){
      overlay='OFF';
      await setGlobalVar('overlay',overlay);
    }
    if(overlay==="ON"){
      overlayBtn.className='overlay-on';
      overlayBtn.innerText='Overlay ON';
    }
    else{
      overlayBtn.className='overlay-off';
      overlayBtn.innerText='Overlay OFF';
    }
  })();

  async function initializeExtension() {
  loadBasicSettings();
  await loadAdvancedSettings(); // Make this async
  await fetchAlgos(backendSelect.value, backendUrlInput.value);
  loadParametersIfMatching();
  updateDynamicParams();
  await loadSavedPlayerList(); // Make this async too
}

  // Advanced section toggle functionality
  advancedToggle.addEventListener("change", async () => {
  chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
    const currentTab = tabs[0];
    const url = currentTab.url;
    if (getGameMode(url) === -1) {
      advancedToggle.checked = false;
      logToPopup("❌ Invalid URL! Solver can only run on valid maze game tabs!", "error");
      return;
    }
    
    const pageKey = await getCurrentPageKey();
    
    if (advancedToggle.checked) {
      advancedContent.classList.add("expanded");
      localStorage.setItem(`${pageKey}_advancedExpanded`, "true");
      logToPopup("🔧 Advanced tools expanded", "info");
    } else {
      advancedContent.classList.remove("expanded");
      localStorage.setItem(`${pageKey}_advancedExpanded`, "false");
      logToPopup("🔧 Advanced tools collapsed", "info");
    }
  });
});
    
  // Index overlay toggle functionality
towerIdxToggle.addEventListener("change", async () => {
  const isChecked = towerIdxToggle.checked;
  const pageKey = await getCurrentPageKey();
  
  indexOverlayVisible = isChecked;
  // Save index overlay state for current page
  localStorage.setItem(`${pageKey}_towerIndex`, isChecked.toString());
  
  // Send message to content script to toggle index overlay
  chrome.runtime.sendMessage({
      type: "TOGGLE_INDEX_OVERLAY",
      visible: isChecked,
      ofTower: true
    }, (response) => {
      if (response) {
        if (response.status === "done") 
          logToPopup(isChecked ? "✅ Tower indices shown" : "✅ Tower indices hidden", "success");
        else if (response && response.status === "failed")
          logToPopup(`❌ Error! Can't draw indices!${response.issue}`);
        else logToPopup('gache but kono sara nei T_T');
      }
      else logToPopup("⚠️ Could not toggle index overlay - make sure you're on a valid maze game page", "warning");
    }
  );
});
sqIdxToggle.addEventListener("change", async () => {
  const isChecked = sqIdxToggle.checked;
  const pageKey = await getCurrentPageKey();
  
  indexOverlayVisible = isChecked;
  // Save index overlay state for current page
  localStorage.setItem(`${pageKey}_sqIndex`, isChecked.toString());
  
  // Send message to content script to toggle index overlay
  chrome.runtime.sendMessage({
      type: "TOGGLE_INDEX_OVERLAY",
      visible: isChecked,
      ofTower: false
    }, (response) => {
      if (response) {
        if (response.status === "done") 
          logToPopup(isChecked ? "✅ Square indices shown" : "✅ Square indices hidden", "success");
        else if (response && response.status === "failed")
          logToPopup(`❌ Error! Can't draw indices!${response.issue}`);
        else logToPopup('gache but kono sara nei T_T');
      }
      else logToPopup("⚠️ Could not toggle index overlay - make sure you're on a valid maze game page", "warning");
    }
  );
});

fetchPlayersBtn.addEventListener('click', async () => {
  fetchPlayersBtn.disabled = true;
  fetchPlayersBtn.textContent = "Loading...";
  
  const pageKey = await getCurrentPageKey();
  
  chrome.runtime.sendMessage(
    { type: "FETCH_PLAYER_LIST" },
    (response) => {
      fetchPlayersBtn.disabled = false;
      fetchPlayersBtn.innerHTML = '<span class="btn-icon">👥</span><span class="btn-text">Reload Player Solutions</span>';
      if (chrome.runtime.lastError) {
        logToPopup(`Chrome runtime error: ${chrome.runtime.lastError.message}`, "error");
        return;
      }
      if (response && response.players) {
        displayPlayerList(response.players);
        // Save player list for this specific page
        localStorage.setItem(`${pageKey}_playerList`, JSON.stringify(response.players));
        logToPopup(`✅ Loaded ${response.players.length} player solutions`, "success");
      } else if (response && response.error) {
        logToPopup(`❌ Error: ${response.error}`, "error");
      } else {
        logToPopup(`❌ Failed to load player solutions - invalid response: ${JSON.stringify(response)}`, "error");
      }
    }
  );
});
async function loadSavedPlayerList() {
  const pageKey = await getCurrentPageKey();
  const savedPlayers = localStorage.getItem(`${pageKey}_playerList`);
  
  if (savedPlayers) {
    try {
      const players = JSON.parse(savedPlayers);
      displayPlayerList(players);
      logToPopup(`✅ Restored ${players.length} saved player solutions`, "info");
    } catch (e) {
      console.error('Failed to parse saved player list:', e);
    }
  } else {
    // Hide player list container if no saved data
    playerListContainer.style.display = "none";
  }
}


  async function loadAdvancedSettings() {
  const pageKey = await getCurrentPageKey();
  
  // Load advanced section visibility for current page
  const advancedVisible = localStorage.getItem(`${pageKey}_advancedExpanded`);
  if (advancedVisible === "true") {
    advancedToggle.checked = true;
    advancedContent.classList.add("expanded");
  } else {
    // Default to collapsed for new pages
    advancedToggle.checked = false;
    advancedContent.classList.remove("expanded");
  }

  // Load tower index overlay state for current page
  const towerIndexVisible = localStorage.getItem(`${pageKey}_towerIndex`);
  if (towerIndexVisible === "true") {
    towerIdxToggle.checked = true;
  } else {
    towerIdxToggle.checked = false;
  }

  // Load square index overlay state for current page
  const sqIndexVisible = localStorage.getItem(`${pageKey}_sqIndex`);
  if (sqIndexVisible === "true") {
    sqIdxToggle.checked = true;
  } else {
    sqIdxToggle.checked = false;
  }
}

  runBtn.onclick = () => {
    const skip = localStorage.getItem("skipSolverConfirm");
    if (skip === "true") {
      triggerSolver();
    } else {
      // modal.style.display = "block";
    }
  };
   overlayBtn.onclick = () => {
    if (overlay === "ON") {
      overlay="OFF";
      setGlobalVar('overlay',overlay);
      logToPopup("✅ Changed to click mode from overlay mode",'success');
      overlayBtn.className='overlay-off';
      overlayBtn.innerText='Overlay OFF';
    } else if(overlay==="OFF") {
      overlay="ON";
      setGlobalVar('overlay',overlay);
      logToPopup("✅ Changed to overlay mode from click mode",'success');
      overlayBtn.className="overlay-on";
      overlayBtn.innerText='Overlay ON';
    }
    else logToPopup("❌ Qverlay mode in unknow state!",'error');
  };

  // confirmYes.onclick = () => {
  //   if (skipConfirm.checked) {
  //     localStorage.setItem("skipSolverConfirm", "true");
  //   }
    // modal.style.display = "none";
  //   triggerSolver();
  // };

  // confirmNo.onclick = () => {
  //   modal.style.display = "none";
  // };

  algorithmSelect.onchange = () => {
    // Clear current params when algorithm changes
    currentParams = {};
    loadParametersIfMatching();
    updateDynamicParams();
    saveSettings();
  };

  backendSelect.onchange = async () => {
    // Clear current params when backend changes
    currentParams = {};
    updateCustomBackendVisibility();
    await fetchAlgos(backendSelect.value, backendUrlInput.value);
    loadParametersIfMatching();
    updateDynamicParams();
    saveSettings();
  };

  backendUrlInput.onchange = async () => {
    if (backendSelect.value === "custom") {
      // Clear current params when URL changes for custom backend
      currentParams = {};
      await fetchAlgos(backendSelect.value, backendUrlInput.value);
      loadParametersIfMatching();
      updateDynamicParams();
    }
    saveSettings();
  };

  function loadBasicSettings() {
    // Load basic settings (backend, URL, algorithm selection)
    const savedBackend = localStorage.getItem("solverBackend") || "python";
    const savedUrl = localStorage.getItem("solverBackendUrl") || "";
    const savedAlgorithm = localStorage.getItem("solverAlgorithm") || "";

    backendSelect.value = savedBackend;
    backendUrlInput.value = savedUrl;
    
    // Store for later comparison
    backendSelect.dataset.selected = savedBackend;
    backendUrlInput.dataset.selected = savedUrl;
    algorithmSelect.dataset.selected = savedAlgorithm;

    updateCustomBackendVisibility();
  }

  function loadParametersIfMatching() {
    const currentBackend = backendSelect.value;
    const currentUrl = backendUrlInput.value;
    const currentAlgorithm = algorithmSelect.value;

    // Generate storage key for current configuration
    const configKey = generateConfigKey(currentBackend, currentUrl, currentAlgorithm);
    const savedParams = localStorage.getItem(`solverParams_${configKey}`);

    if (savedParams) {
      try {
        const parsed = JSON.parse(savedParams);
        
        // Verify the saved params match current configuration
        if (parsed.backend === currentBackend && 
            parsed.backendUrl === currentUrl && 
            parsed.algorithm === currentAlgorithm) {
          
          currentParams = parsed.params || {};
          logToPopup(`✅ Loaded saved parameters for ${currentAlgorithm} on ${currentBackend}`, "info");
        } else {
          // Configuration mismatch, start fresh
          currentParams = {};
          logToPopup(`🔄 Configuration changed, using default parameters`, "info");
        }
      } catch (e) {
        currentParams = {};
        logToPopup(`⚠️ Failed to parse saved parameters, using defaults`, "warning");
      }
    } else {
      currentParams = {};
    }
  }

  function generateConfigKey(backend, url, algorithm) {
    // Create a unique key based on backend, URL, and algorithm
    const urlPart = backend === "custom" ? url : backend;
    return `${backend}-${btoa(urlPart)}-${algorithm}`.replace(/[^a-zA-Z0-9-_]/g, '');
  }

  function saveSettings() {
    // Save basic settings
    localStorage.setItem("solverAlgorithm", algorithmSelect.value);
    localStorage.setItem("solverBackend", backendSelect.value);
    localStorage.setItem("solverBackendUrl", backendUrlInput.value);

    // Save parameters with configuration-specific key
    const configKey = generateConfigKey(
      backendSelect.value, 
      backendUrlInput.value, 
      algorithmSelect.value
    );

    const paramsToSave = {
      backend: backendSelect.value,
      backendUrl: backendUrlInput.value,
      algorithm: algorithmSelect.value,
      params: currentParams,
      timestamp: Date.now()
    };

    localStorage.setItem(`solverParams_${configKey}`, JSON.stringify(paramsToSave));
  }

  function updateCustomBackendVisibility() {
    customBackendGroup.style.display = backendSelect.value === "custom" ? "flex" : "none";
  }

  function createParamInput(paramName, paramConfig) {
    const group = document.createElement("div");
    group.className = "setting-group";

    const label = document.createElement("label");
    label.textContent = paramConfig.label || paramName;
    label.setAttribute("for", paramName);

    let input;

    if (paramConfig.type === "range") {
      input = document.createElement("input");
      input.type = "range";
      input.min = paramConfig.min;
      input.max = paramConfig.max;
      input.step = paramConfig.step;
      
      // Use saved value or default, ensure it's within bounds
      const savedValue = currentParams[paramName];
      const defaultValue = paramConfig.default;
      let finalValue = savedValue !== undefined ? savedValue : defaultValue;
      
      // Ensure value is within bounds
      finalValue = Math.max(paramConfig.min, Math.min(paramConfig.max, finalValue));
      input.value = finalValue;
      currentParams[paramName] = parseFloat(finalValue);

      const valueDisplay = document.createElement("span");
      valueDisplay.className = "range-value";
      valueDisplay.textContent = input.value;

      input.oninput = () => {
        valueDisplay.textContent = input.value;
        currentParams[paramName] = parseFloat(input.value);
        saveSettings();
      };

      group.appendChild(label);
      group.appendChild(input);
      group.appendChild(valueDisplay);

    } else if (paramConfig.type === "number") {
      input = document.createElement("input");
      input.type = "number";
      input.min = paramConfig.min;
      input.max = paramConfig.max;
      input.step = paramConfig.step;
      
      // Use saved value or default, ensure it's within bounds
      const savedValue = currentParams[paramName];
      const defaultValue = paramConfig.default;
      let finalValue = savedValue !== undefined ? savedValue : defaultValue;
      
      // Ensure value is within bounds
      finalValue = Math.max(paramConfig.min, Math.min(paramConfig.max, finalValue));
      input.value = finalValue;
      currentParams[paramName] = parseInt(finalValue);
      
      input.style.width = "45%";

      input.onchange = () => {
        let value = parseInt(input.value);
        // Ensure value is within bounds
        value = Math.max(paramConfig.min, Math.min(paramConfig.max, value));
        input.value = value;
        currentParams[paramName] = value;
        saveSettings();
      };

      group.appendChild(label);
      group.appendChild(input);

    } else if (paramConfig.type === "select") {
      input = document.createElement("select");
      input.style.width = "45%";

      paramConfig.options.forEach(option => {
        const opt = document.createElement("option");
        opt.value = option.value;
        opt.textContent = option.label;
        input.appendChild(opt);
      });

      // Use saved value or default
      const savedValue = currentParams[paramName];
      const defaultValue = paramConfig.default;
      const finalValue = savedValue !== undefined ? savedValue : defaultValue;
      
      input.value = finalValue;
      currentParams[paramName] = finalValue;

      input.onchange = () => {
        currentParams[paramName] = input.value;
        saveSettings();
      };

      group.appendChild(label);
      group.appendChild(input);
    }

    input.id = paramName;

    if (paramConfig.description) {
      const desc = document.createElement("small");
      desc.className = "param-description";
      desc.textContent = paramConfig.description;
      group.appendChild(desc);
    }

    return group;
  }

  function updateDynamicParams() {
    dynamicParamsContainer.innerHTML = "";
    const selectedAlgorithm = algorithmSelect.value;
    const config = algorithmConfigs[selectedAlgorithm];
    
    if (!config || !config.params) {
      logToPopup(`ℹ️ No parameters available for ${selectedAlgorithm}`, "info");
      return;
    }

    Object.entries(config.params).forEach(([paramName, paramConfig]) => {
      const paramInput = createParamInput(paramName, paramConfig);
      dynamicParamsContainer.appendChild(paramInput);
    });

    logToPopup(`🔧 Updated parameters for ${selectedAlgorithm}`, "info");
  }

  function getSettings() {
    const selectedAlgorithm = algorithmSelect.value;
    const settings = {
      algorithm: selectedAlgorithm,
      backend: backendSelect.value,
      backendUrl: backendUrlInput.value,
      ...currentParams
    };

    // Validation: ensure displayed values match what we're sending
    validateSettingsSync(settings);
    
    return settings;
  }

  function validateSettingsSync(settings) {
    // Check if HTML display matches the settings we're about to send
    const htmlBackend = backendSelect.value;
    const htmlUrl = backendUrlInput.value;
    const htmlAlgorithm = algorithmSelect.value;

    if (settings.backend !== htmlBackend) {
      logToPopup(`⚠️ Backend mismatch: sending ${settings.backend}, displaying ${htmlBackend}`, "warning");
    }
    
    if (settings.backendUrl !== htmlUrl) {
      logToPopup(`⚠️ URL mismatch: sending ${settings.backendUrl}, displaying ${htmlUrl}`, "warning");
    }
    
    if (settings.algorithm !== htmlAlgorithm) {
      logToPopup(`⚠️ Algorithm mismatch: sending ${settings.algorithm}, displaying ${htmlAlgorithm}`, "warning");
    }

    // Validate parameter inputs match currentParams
    const config = algorithmConfigs[htmlAlgorithm];
    if (config && config.params) {
      Object.entries(config.params).forEach(([paramName, paramConfig]) => {
        const inputElement = document.getElementById(paramName);
        if (inputElement) {
          let inputValue;
          if (paramConfig.type === "range" || paramConfig.type === "number") {
            inputValue = parseFloat(inputElement.value);
          } else {
            inputValue = inputElement.value;
          }
          
          const settingsValue = settings[paramName];
          if (inputValue !== settingsValue) {
            logToPopup(`⚠️ Parameter ${paramName} mismatch: input=${inputValue}, settings=${settingsValue}`, "warning");
          }
        }
      });
    }
  }

  function isNumeric(str) {
    return /^\d+$/.test(str);
  }

  function getGameMode(url=null) {
  if(url===null)url = window.location.href;
  const modes = ['challenge', 'puzzle', 'arena', 'academy', 'daily'];
  const parts = url.split('/');
  if (parts[3] === 'challenge') {
    if (isNumeric(parts[4])) return 'challenge';
    else if (parts[4] === 'daily') return 'daily';
  }
  else if (modes.includes(parts[3])) return parts[3];
  return -1;
}

  function triggerSolver() {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const currentTab = tabs[0];
      const url = currentTab.url;

      if (getGameMode(url) === -1) {
        loader.style.display = "none";
        logToPopup("❌ Invalid URL! Solver can only run on valid maze game tabs!", "error");
        return;
      }

      saveSettings();
      const settings = getSettings();

      loader.style.display = "block";
      logs.textContent = "";
      logToPopup("🚀 Starting solver with settings:", "info");
      logToPopup(`Algorithm: ${settings.algorithm}`, "info");

      const config = algorithmConfigs[settings.algorithm];
      if (config && config.params) {
        Object.entries(config.params).forEach(([paramName, paramConfig]) => {
          const value = settings[paramName];
          if (value !== undefined) {
            logToPopup(`  ${paramConfig.label || paramName}: ${value}`, "info");
          }
        });
      }

      logToPopup(`Backend: ${settings.backend}`, "info");
      if (settings.backend === "custom") {
        logToPopup(`Custom URL: ${settings.backendUrl}`, "info");
      }
      logToPopup("🔄 Resetting and solving...", "info");

      chrome.runtime.sendMessage({
        type: "RUN_SOLVER",
        settings: settings
      }, response => {
        if (response && response.status === "started") {
          logToPopup("✅ Solver started...", "success");
        } else if (response && response.status === "error") {
          logToPopup(`❌ Error: ${response.message}`, "error");
          loader.style.display = "none";
        }
      });
    });
  }

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === "BACKGROUND_LOG") {
      const logLine = document.createElement("div");
      logLine.textContent = message.text;
      const level = message.level || "info";
      logLine.classList.add(`log-${level}`);
      logs.appendChild(logLine);
      logs.scrollTop = logs.scrollHeight;
    }
    if (message.type === "SOLVER_COMPLETE") {
      loader.style.display = "none";
    }
  });
  // function logToPopup(text, level = "info") {
  //     chrome.runtime.sendMessage({ type: "MAZE_SOLVER_LOG", text: text, level: level });
  //   }
  function logToPopup(text, level = "info") {
  // Instead of sending a message, directly add to logs
  const logLine = document.createElement("div");
  logLine.textContent = text;
  logLine.classList.add(`log-${level}`);
  logs.appendChild(logLine);
  logs.scrollTop = logs.scrollHeight;
}

  async function fetchAlgos(backend, backendUrl) {
    let targetUrl = backendUrl;
    if (backend !== "custom") {
      targetUrl = 'https://maze-game-solver.onrender.com';
    }

    try {
      logToPopup("🔍 Fetching available algorithms and parameters...", "warning");
      algorithmSelect.innerHTML = `<option disabled selected>Loading...</option>`;
      dynamicParamsContainer.innerHTML = "";

      const response = await fetch(`${targetUrl}/available`);
      if (!response.ok) throw new Error(`Backend fetch failed: ${response.status}`);

      const data = await response.json();
      const algorithms = data.algorithms || ["optimal"];
      algorithmConfigs = data.algorithm_configs || {};

      algorithmSelect.innerHTML = "";
      algorithms.forEach(alg => {
        const opt = document.createElement("option");
        opt.value = alg;
        const config = algorithmConfigs[alg];
        opt.textContent = config ? config.display_name : alg;
        algorithmSelect.appendChild(opt);
      });

      // Set algorithm selection priority: saved > first available
      const savedAlgorithm = algorithmSelect.dataset.selected;
      if (algorithms.includes(savedAlgorithm)) {
        algorithmSelect.value = savedAlgorithm;
      } else if (algorithms.length > 0) {
        algorithmSelect.value = algorithms[0];
        algorithmSelect.dataset.selected = algorithms[0];
      }
      logToPopup(`✅ Loaded ${algorithms.length} algorithms from backend`, "success");
    } catch (err) {
      logToPopup("⚠️ Failed to fetch options from backend. Using defaults.", "error");
      console.error("Backend fetch error:", err);

      algorithmSelect.innerHTML = `<option value="optimal">Optimal</option><option value="greedy">Greedy</option>`;
      algorithmConfigs = {
        "optimal": {
          "display_name": "Optimal",
          "params": {
            "max_iterations": { "type": "number", "default": 10000, "min": 1000, "max": 50000, "step": 1000, "label": "Max Iterations" },
            "random_seed": { "type": "number", "default": 42, "min": 1, "max": 9999, "step": 1, "label": "Random Seed" }
          }
        },
        "greedy": {
          "display_name": "Greedy",
          "params": {
            "max_iterations": { "type": "number", "default": 5000, "min": 500, "max": 20000, "step": 500, "label": "Max Iterations" },
            "random_seed": { "type": "number", "default": 42, "min": 1, "max": 9999, "step": 1, "label": "Random Seed" }
          }
        }
      };
      const savedAlgorithm = algorithmSelect.dataset.selected;
      if (savedAlgorithm && (savedAlgorithm === "optimal" || savedAlgorithm === "greedy")) {
        algorithmSelect.value = savedAlgorithm;
      } else {
        algorithmSelect.value = "optimal";
      }
    }
  }
});

function getCurrentPageKey() {
  return new Promise((resolve) => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const currentTab = tabs[0];
      const pageKey = `page_${btoa(currentTab.url).replace(/[^a-zA-Z0-9]/g, '')}`;
      resolve(pageKey);
    });
  });
}