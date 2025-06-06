document.addEventListener("DOMContentLoaded", () => {
  const runBtn = document.getElementById("runBtn");
  const loader = document.getElementById("loader");
  const logs = document.getElementById("logs");
  
  // Settings elements
  const maxIterationsInput = document.getElementById("maxIterations");
  const randomSeedInput = document.getElementById("randomSeed");
  const algorithmSelect = document.getElementById("algorithm");

  // Modal elements
  const modal = document.getElementById("confirmModal");
  const skipConfirm = document.getElementById("skipConfirm");
  const confirmYes = document.getElementById("confirmYes");
  const confirmNo = document.getElementById("confirmNo");

  // Load saved settings
  loadSettings();

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

  function loadSettings() {
    const savedMaxIter = localStorage.getItem("solverMaxIterations");
    const savedSeed = localStorage.getItem("solverRandomSeed");
    const savedAlgorithm = localStorage.getItem("solverAlgorithm");

    if (savedMaxIter) maxIterationsInput.value = savedMaxIter;
    if (savedSeed) randomSeedInput.value = savedSeed;
    if (savedAlgorithm) algorithmSelect.value = savedAlgorithm;
  }

  function saveSettings() {
    localStorage.setItem("solverMaxIterations", maxIterationsInput.value);
    localStorage.setItem("solverRandomSeed", randomSeedInput.value);
    localStorage.setItem("solverAlgorithm", algorithmSelect.value);
  }

  function getSettings() {
    return {
      maxIterations: parseInt(maxIterationsInput.value),
      randomSeed: parseInt(randomSeedInput.value),
      algorithm: algorithmSelect.value
    };
  }
  function getGameMode(url) {
    const modes=['challenge','puzzle','arena','academy','daily'];
    const parts = url.split('/');
    if(parts.length<5)return -1;
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

    if (getGameMode(url)==-1) {
      loader.style.display = "none";
      logs.textContent = "Invalid URL!Solver can only run on valid maze game tabs!\n";
      return;
    }
    // Save current settings
    saveSettings();
    
    const settings = getSettings();
    
    loader.style.display = "block";
    logs.textContent = `Starting solver with settings:\n`;
    logs.textContent += `Algorithm: ${settings.algorithm}\n`;
    logs.textContent += `Max Iterations: ${settings.maxIterations}\n`;
    logs.textContent += `Random Seed: ${settings.randomSeed}\n`;
    logs.textContent += "Resetting and solving...\n";
    
    // Send settings along with the solver request
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
//   function triggerSolver() {
//     // Save current settings
//     saveSettings();
    
//     const settings = getSettings();
    
//     loader.style.display = "block";
//     logs.textContent = `Starting solver with settings:\n`;
//     logs.textContent += `Algorithm: ${settings.algorithm}\n`;
//     logs.textContent += `Max Iterations: ${settings.maxIterations}\n`;
//     logs.textContent += `Random Seed: ${settings.randomSeed}\n`;
//     logs.textContent += "Resetting and solving...\n";
    
//     // Send settings along with the solver request
//     chrome.runtime.sendMessage({ 
//       type: "RUN_SOLVER",
//       settings: settings
//     }, response => {
//       if (response && response.status === "started") {
//         logs.textContent += "Solver started...\n";
//       } else if (response && response.status === "error") {
//         logs.textContent += `Error: ${response.message}\n`;
//         loader.style.display = "none";
//       }
//     });
//   }

  // Listen for messages from background script
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === "MAZE_SOLVER_LOG") {
      logs.textContent += message.text + "\n";
      logs.scrollTop = logs.scrollHeight;
    }
    
    if (message.type === "SOLVER_COMPLETE") {
      loader.style.display = "none";
    }
  });
});