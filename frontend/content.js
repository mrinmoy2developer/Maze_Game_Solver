function logToPopup(msg, level = "info") {
  chrome.runtime.sendMessage({ type: "MAZE_SOLVER_LOG", text: msg, level });
}

function mapValue(x, a, b, c, d) {
  return c + ((x - a) * (d - c)) / (b - a);
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

function clickReset() {
  const rstButton = Array.from(document.querySelectorAll("button"))
    .find(btn => btn.textContent.trim() === "Reset");
  if (rstButton) rstButton.click();
}

function getCanvasCoordinates(i, j, n = 18, m = 16,ofTower=true) {
  const canvas = document.querySelector("canvas");
  if (!canvas) return null;
  var N = n - 1, M = m - 1,x,y;
  const rect = canvas.getBoundingClientRect();
  const tile = rect.width / (m + 1);
  if(ofTower){
    x = mapValue(j, 0, M - 1, rect.left + tile * 1.5, rect.right - tile * 1.5);
    y = mapValue(i, 0, N - 1, rect.top + tile * 2, rect.bottom - tile * 1.5);
  }
  else{
    x = mapValue(j, 0, m-1, rect.left + tile, rect.right - tile);
    y = mapValue(i, 0, n-1, rect.top + tile * 1.5, rect.bottom - tile);
  }
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
  const pos = getCanvasCoordinates(i, j, n, m,true);
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
  else if(mode === 'daily'){
    const { parameters: { id } } = await fetchJson(`/b/challenge/periodical/${parts[5]}`);
    return `/b/challenge/${id}/next`;
  }
}

async function fetchGameState(url=null, mode=null) {
  if(url===null)url = window.location.href;
  if(mode===null)mode=getGameMode(url);
  const bURL = await getbURL(url, mode);
  if (['challenge','arena','daily'].includes(mode)) {
    const { board, claps, towers } = await fetchJson(bURL);
    return { board, claps, towers };
  } 
  // else if (mode === 'daily') {
  //   const { rounds } = await fetchJson(bURL);
  //   const maxKey = Math.max(...Object.keys(rounds).map(Number));
  //   return rounds[maxKey];
  // } 
  else {
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

async function drawSolution(normal_positions, frozen_positions, n, m) {
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
    await drawSolution(normal_positions, frozen_positions, n, m);

    logToPopup("✅ Simulation complete.", "success");
    chrome.runtime.sendMessage({ type: "SOLVER_COMPLETE" });

  } catch (err) {
    console.error(err);
    logToPopup("❌ Error: " + err.message, "error");
    chrome.runtime.sendMessage({ type: "SOLVER_COMPLETE" });
  }
}
async function drawIndices(ofTower=true,visible=true) {
  const {board:{height:n,width:m}} = await fetchGameState();
  const canvas = document.querySelector("canvas");
  if (!canvas) return;
  // Ensure parent is positioned correctly
  const parent = canvas.parentElement,rect=canvas.getBoundingClientRect();
  parent.style.position = "relative";

  // Remove previous labels if any
  Array.from(parent.querySelectorAll(`.${ofTower?'tower':'square'}-index-label`)).forEach(el => el.remove());
  if(visible)
    for (let i = 0; i < (ofTower?n-1:n); i++) {
      for (let j = 0; j <(ofTower?m-1:m); j++) {
        const {x,y}=getCanvasCoordinates(i,j,n,m,ofTower);
        const label = document.createElement("div");
        label.textContent = `(${i},${j})`;
        label.className = `${ofTower?'tower':'square'}-index-label`;
        label.style.position = "absolute";
        label.style.left = `${x - rect.left - 14}px`;
        label.style.top = `${y - rect.top - 9}px`;
        label.style.fontSize = "10px";
        label.style.color = ofTower?"black":"white";
        label.style.padding = "1px 2px";
        label.style.borderRadius = "3px";
        label.style.pointerEvents = "none";
        label.style.zIndex = "9999";
        parent.appendChild(label);
      }
    }
}
function changeSolRep(solution){
  const {layout:{towers},path}=solution,normal_positions=[],frozen_positions=[];
  towers.forEach(({coord:{x:j,y:i},static,clap})=>{
    if(clap)frozen_positions.push([i,j]); else normal_positions.push([i,j]);
  });
  return {normal_positions,frozen_positions,path};
}
function argMax(arr, fn) {
  return arr.reduce((maxIdx, current, idx, array) =>
    fn(current) > fn(array[maxIdx]) ? idx : maxIdx, 0
  );
}
async function drawBestPlayer(){  //temporary testing function!!!
    const url = window.location.href,mode=getGameMode(url);
    // const url = "https://maze.game/challenge/daily/1090",mode=getGameMode(url);
    if(!['daily','challenge'].includes(mode)){
      logToPopup('❌ Error!This only works for daily and challenge modes.','error');
      return;
    }
    const {board:{height:n,width:m}} = await fetchGameState(url,mode);
    const parts=url.split('/');
    var id,round;
    if(mode === 'daily')({parameters:{id},progress:round}=await fetchJson(`/b/challenge/periodical/${parts[5]}`));
    else if(mode==='challenge'){
      const {rounds} = await fetchJson(`/b/challenge/${parts[4]}`);
      round=rounds.length;
      id=parts[4];
    }
    const bURL = `/b/challenge/${id}/${round}`;
    logToPopup(`Fetching all available solutions`,'info');
    const solutions = await fetchJson(bURL);
    const bestPlayer=argMax(solutions,({solution:{path:{result}}})=>result);
    const {normal_positions,frozen_positions}=changeSolRep(solutions[bestPlayer].solution);
    logToPopup(`Found best having ${normal_positions.length} normal tiles and ${frozen_positions.length} frozen tiles scoring ${solutions[bestPlayer].solution.path.result}.`);
    drawSolution(normal_positions,frozen_positions,n,m);
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "RUN_SOLVER") {
    const url = window.location.href;
    const gameMode = getGameMode(url);
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
  if(message.type==="TOGGLE_INDEX_OVERLAY"){
    try{
      drawIndices(message.ofTower,message.visible);
      sendResponse({status:"done"});
    }
    catch(error){
      sendResponse({status:"failed",issue:`Error:${error.message}`});
    }
  }
  if(message.type==="SHOW_BEST_PLAYER_SOLUTION"){
    try{
      drawBestPlayer();
      sendResponse({status:"done"});
    }
    catch(error){
      sendResponse({status:"failed",issue:`Error:${error.message}`});
    }
  }
});


