allowedTypes=["SHOW_BEST_PLAYER_SOLUTION","RUN_SOLVER","TOGGLE_INDEX_OVERLAY","FETCH_PLAYER_LIST"];
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (allowedTypes.includes(message.type)) {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]) {
        chrome.tabs.sendMessage(tabs[0].id, message, (response) => {
          if (chrome.runtime.lastError) {
            logToPopup(`Error: ${chrome.runtime.lastError.message}`);
            sendResponse({error: chrome.runtime.lastError.message});
          } else {
            sendResponse(response);
          }
        });
      } else {
        sendResponse({error: "No active tab found"});
      }
    });
    return true; // Keep message channel open for async response
  }
  if (message.type === "INJECTED_SCRIPT_LOG") {
    // Forward log message to popup
    message.type="BACKGROUND_LOG";
    chrome.runtime.sendMessage(message);
  }
});
function logToPopup(msg, level = "info") {
  chrome.runtime.sendMessage({ type: "BACKGROUND_LOG", text: msg, level });
  // console.log(msg);
}