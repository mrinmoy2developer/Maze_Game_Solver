function logToPopup(msg, level = "info") {
  chrome.runtime.sendMessage({ type: "MAZE_SOLVER_LOG", text: msg, level });
}

function mapValue(x, a, b, c, d) {
  return c + ((x - a) * (d - c)) / (b - a);
}

function getGameMode(url) {
  const modes = ['challenge', 'puzzle', 'arena', 'academy', 'daily'];
  const parts = url.split('/');
  if (parts[3] === 'challenge') {
    if (isNumeric(parts[4])) return 'challenge';
    else if (parts[4] === 'daily') return 'daily';
  }
  else if (modes.includes(parts[3])) return parts[3];
  return -1;
}

function clickReset() {
  const rstButton = Array.from(document.querySelectorAll("button"))
    .find(btn => btn.textContent.trim() === "Reset");
  if (rstButton) rstButton.click();
}

function getCanvasCoordinates(i, j, n = 18, m = 16) {
  const canvas = document.querySelector("canvas");
  if (!canvas) return null;
  const N = n - 1, M = m - 1;
  const rect = canvas.getBoundingClientRect();
  const tile = rect.width / (m + 1);
  const x = mapValue(j, 0, M - 1, rect.left + tile * 1.5, rect.right - tile * 1.5);
  const y = mapValue(i, 0, N - 1, rect.top + tile * 2, rect.bottom - tile * 1.5);
  return { canvas, x, y };
}

function createClickEvents(x, y, left = true) {
  const button = left ? 0 : 2;
  return ["pointermove", "pointerdown", "pointerup"].map(type => new PointerEvent(type, {
    bubbles: true,
    clientX: x,
    clientY: y,
    pointerType: "mouse",
    button,
    buttons: 1 << button
  }));
}
function debugMarker(x, y, left) {
  const canvas = document.querySelector("canvas");
  if (!canvas) return;

  const rect = canvas.getBoundingClientRect();
  
  const marker = document.createElement("div");
  marker.style.position = "absolute";
  marker.style.left = `${x - rect.left - 5}px`; // Position relative to canvas
  marker.style.top = `${y - rect.top - 5}px`;
  marker.style.width = "10px";
  marker.style.height = "10px";
  marker.style.background = left ? "red" : "blue";
  marker.style.borderRadius = "50%";
  marker.style.zIndex = "9999";
  marker.style.pointerEvents = "none";
  marker.style.opacity = "0.8";
  marker.className = "debug-click-marker";

  // Add to canvas parent container (position relative to canvas)
  canvas.parentElement.style.position = "relative";
  canvas.parentElement.appendChild(marker);

  setTimeout(() => marker.remove(), 500);
}
function autoClick(i, j, n = 18, m = 16, dbg = false, left = true) {
  const pos = getCanvasCoordinates(i, j, n, m);
  if (!pos) return;
  const { canvas, x, y } = pos;
  const events = createClickEvents(x, y, left);
  events.forEach(evt => canvas.dispatchEvent(evt));
  if (dbg) debugMarker(x, y, left);
}

function isNumeric(str) {
  return /^\d+$/.test(str);
}

async function fetchJson(bURL) {
  const response = await fetch(bURL, {
    method: 'GET',
    credentials: 'include'
  });
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }
  return await response.json();
}

async function getbURL(url, mode) {
  const parts = url.split('/');
  if (mode === 'challenge') return `/b/challenge/${parts[4]}/next`;
  else if (mode === 'puzzle') return `/b/puzzle/${parts[4]}`;
  else if (mode === 'arena') return `/b/arena/next`;
  else if (mode === 'academy') return `/b/academy/round/${parts[4].toUpperCase()}/${parts[5].toUpperCase()}/${parts[6]}`;
  else {
    const { parameters: { id } } = await fetchJson(`/b/challenge/periodical/${parts[5]}`);
    return `/b/challenge/${id}/next`;
  }
}

async function fetchGameState(url, mode) {
  const bURL = await getbURL(url, mode);
  if (['challenge', 'arena'].includes(mode)) {
    const { board, claps, towers } = await fetchJson(bURL);
    return { board, claps, towers };
  } else if (mode === 'daily') {
    const { rounds } = await fetchJson(bURL);
    const maxKey = Math.max(...Object.keys(rounds).map(Number));
    return rounds[maxKey];
  } else {
    const { round: { board, claps, towers } } = await fetchJson(bURL);
    return { board, claps, towers };
  }
}

async function sendToBackend(gameData, settings) {
  const solver_settings = { algorithm: settings.algorithm };
  Object.keys(settings).forEach(key => {
    if (!['algorithm', 'backend', 'backendUrl'].includes(key)) {
      solver_settings[key] = settings[key];
    }
  });

  const payload = { ...gameData, solver_settings };

  logToPopup(`Sending to backend with ${settings.algorithm} algorithm...`, "info");
  logToPopup(`Parameters: ${JSON.stringify(solver_settings)}`, "info");

  const response = await fetch(`${settings.backendUrl}/solver`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }
  return await response.json();
}

async function simulateClicks(normal_positions, frozen_positions, n, m) {
  logToPopup("Resetting board...", "warning");
  clickReset();
  await new Promise(r => setTimeout(r, 100));

  logToPopup(`Placing ${normal_positions.length} normal tiles...`, "info");
  for (const [i, j] of normal_positions) {
    autoClick(i, j, n, m, true, true);
    await new Promise(r => setTimeout(r, 100));
  }

  logToPopup(`Placing ${frozen_positions.length} frozen tiles...`, "info");
  for (const [i, j] of frozen_positions) {
    autoClick(i, j, n, m, true, false);
    await new Promise(r => setTimeout(r, 100));
  }
}

async function extractAndExecute(url, gameMode, settings) {
  try {
    logToPopup("Fetching game state...", "info");
    const gameData = await fetchGameState(url, gameMode);

    logToPopup("Sending game data to backend...", "info");
    const { board: { height: n, width: m } } = gameData;
    const sol = await sendToBackend(gameData, settings);

    const { normal_positions, frozen_positions, best_score, time_taken, algorithm_used, parameters_used } = sol;

    logToPopup(`✅ Solution found! Algorithm: ${algorithm_used}`, "success");
    logToPopup(`Score: ${best_score || 'N/A'}, Time: ${time_taken || 'N/A'}`, "info");

    if (parameters_used) {
      const paramStr = Object.entries(parameters_used)
        .map(([key, value]) => `${key}=${value}`)
        .join(', ');
      logToPopup(`Parameters used: ${paramStr}`, "info");
    }

    logToPopup(`Received ${normal_positions.length + frozen_positions.length} moves. Simulating...`, "info");
    await simulateClicks(normal_positions, frozen_positions, n, m);

    logToPopup("✅ Simulation complete.", "success");
    chrome.runtime.sendMessage({ type: "SOLVER_COMPLETE" });

  } catch (err) {
    console.error(err);
    logToPopup("❌ Error: " + err.message, "error");
    chrome.runtime.sendMessage({ type: "SOLVER_COMPLETE" });
  }
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "RUN_SOLVER") {
    const url = window.location.href;
    const gameMode = getGameMode(url);
    logToPopup(`!!!!${JSON.stringify(message.settings)}!!! `);
    if (gameMode != -1) {
      logToPopup(`Found current game mode: ${gameMode}`, "info");
      const settings = {
        algorithm: 'optimal',
        backend: 'python',
        backendUrl: 'https://maze-game-solver.onrender.com',
        ...message.settings
      };

      if (!settings.backendUrl || settings.backendUrl.trim() === '' || settings.backend != 'custom')
        settings.backendUrl = 'https://maze-game-solver.onrender.com';

      logToPopup(`Algorithm: ${settings.algorithm}, Backend: ${settings.backend}`, "info");
      if (settings.backend === 'custom') {
        logToPopup(`Using Custom backend ${settings.backendUrl}...`, "info");
      }

      extractAndExecute(url, gameMode, settings);
      sendResponse({ status: "started" });
    } else {
      logToPopup("❌ Error: Could not extract game mode from URL", "error");
      sendResponse({ status: "error", message: "Invalid URL" });
    }
  }
});
