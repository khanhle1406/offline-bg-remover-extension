/**
 * Background Service Worker — Xóa Nền Ảnh AI
 * Handles context menu and Side Panel activation
 */

// Configure side panel behavior on install/startup
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "remove-bg",
    title: "✂️ Remove Background",
    contexts: ["image"],
  });
  
  // Set panel behavior so clicking the extension icon opens the side panel
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true })
    .catch((error) => console.error("Error setting panel behavior:", error));
});

// Handle context menu click
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === "remove-bg" && info.srcUrl) {
    // Store the image URL for side panel to pick up
    await chrome.storage.local.set({ contextMenuImageUrl: info.srcUrl });

    // Show badge to indicate image is ready
    chrome.action.setBadgeText({ text: "1" });
    chrome.action.setBadgeBackgroundColor({ color: "#667eea" });

    // Open the side panel programmatically
    try {
      await chrome.sidePanel.open({ windowId: tab.windowId });
    } catch (e) {
      console.error("Failed to open side panel:", e);
    }
  }
});
