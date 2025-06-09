allowedTypes=["SHOW_BEST_PLAYER_SOLUTION","RUN_SOLVER","TOGGLE_INDEX_OVERLAY"];
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {

  if (allowedTypes.includes(message.type)) {
    // Forward message to the active tab
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]) {
        chrome.tabs.sendMessage(tabs[0].id, message, (response) => {
          sendResponse(response);
        });
      }
    });
    return true; // Keep message channel open for async response
  }
  if (message.type === "MAZE_SOLVER_LOG") {
    // Forward log message to popup
    chrome.runtime.sendMessage(message);
  }
});