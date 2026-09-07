const SAFE_ICON = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADAAAAAwCAIAAADYYE9XAAAAM0lEQVR4nO3NMQEAAAwCoNk/tJvhBxxAAZIkSZIkSZIkSZIkSZIkSZIkSZIkSZIkSdK/A74wAQH37r2xAAAAAElFTkSuQmCC";

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "save-clip",
    title: "Capture to Context Capsule",
    contexts: ["selection"]
  });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === "save-clip" && tab.id) {
    chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: scrapeContext,
      args: [info.selectionText]
    });
  }
});

function scrapeContext(selectedText) {
  const selection = window.getSelection();
  let parentText = "";

  if (selection.rangeCount > 0) {
    const range = selection.getRangeAt(0);
    parentText = range.commonAncestorContainer.parentElement.innerText || "";
  }

  const cleanBaseUrl = window.location.href.split('#')[0];
  const cleanSnippet = encodeURIComponent(selectedText.trim().slice(0, 80));
  const teleportUrl = `${cleanBaseUrl}#:~:text=${cleanSnippet}`;

  const clipData = {
    id: Date.now(),
    text: selectedText.trim(),
    context: parentText.slice(0, 300),
    title: document.title,
    url: cleanBaseUrl,
    teleportUrl: teleportUrl,
    timestamp: new Date().toLocaleDateString(),
    tag: "Evidence"
  };

  chrome.storage.local.get({ clips: [] }, (res) => {
    const updated = [clipData, ...res.clips];
    chrome.storage.local.set({ clips: updated }, () => {
      alert("Clipped to Context Capsule!");
    });
  });
}

// ==========================================
// TELEPORT & CAPSULE HIGHLIGHTING LOGIC
// ==========================================
function teleportToClip(url, text) {
  const cleanUrl = url.split("#")[0];

  chrome.tabs.create({ url: cleanUrl }, (tab) => {
    const onTabUpdated = (tabId, info) => {
      if (tabId === tab.id && info.status === "complete") {
        chrome.tabs.onUpdated.removeListener(onTabUpdated);
        
        // Wait 800ms to ensure modern React/Vue websites have actually rendered text to the screen
        setTimeout(() => {
          chrome.scripting.executeScript({
            target: { tabId: tab.id },
            func: highlightExactSnippet,
            args: [text]
          }).catch(err => console.error("Scripting error:", err));
        }, 800);
      }
    };
    chrome.tabs.onUpdated.addListener(onTabUpdated);
  });
}

// INJECTED INTO THE WEB PAGE
function highlightExactSnippet(targetText) {
  if (!targetText) return;
  const sel = window.getSelection();
  sel.removeAllRanges();
  
  const cleanText = targetText.trim();
  let found = false;

  // Try to find the exact text
  if (window.find(cleanText, false, false, true, false, true, false)) {
    found = true;
  } else {
    // Fallback: search for just the first 40 characters to locate the starting point
    const startChunk = cleanText.slice(0, 40);
    if (window.find(startChunk, false, false, true, false, true, false)) {
      found = true;
    }
  }

  if (found && sel.rangeCount > 0) {
    try {
      const range = sel.getRangeAt(0);
      const rect = range.getBoundingClientRect();
      sel.removeAllRanges(); // Clear the default blue browser selection

      // 1. Highlight the text in yellow
      if ("Highlight" in window && "highlights" in CSS) {
        const highlight = new Highlight(range);
        CSS.highlights.set("capsule-target", highlight);
        
        if (!document.getElementById("capsule-style")) {
          const style = document.createElement("style");
          style.id = "capsule-style";
          style.textContent = `
            ::highlight(capsule-target) {
              background-color: #fef08a !important;
              color: #1c1917 !important;
            }
          `;
          document.head.appendChild(style);
        }
      }

      // 2. Inject the beautiful "Capsule Shape Icon" directly above the text
      const capsuleIcon = document.createElement("div");
      capsuleIcon.innerHTML = "⚡ Clipped Here";
      capsuleIcon.style.cssText = `
        position: absolute;
        top: ${window.scrollY + rect.top - 40}px;
        left: ${window.scrollX + rect.left}px;
        background: linear-gradient(135deg, #8b5cf6 0%, #3b82f6 100%);
        color: white;
        padding: 6px 16px;
        border-radius: 50px; /* Makes it a pill/capsule shape */
        font-family: system-ui, -apple-system, sans-serif;
        font-size: 13px;
        font-weight: 800;
        letter-spacing: 0.5px;
        box-shadow: 0 8px 20px rgba(139, 92, 246, 0.4);
        z-index: 2147483647;
        pointer-events: none;
        animation: capsulePop 0.5s cubic-bezier(0.16, 1, 0.3, 1);
      `;
      
      const keyframes = document.createElement("style");
      keyframes.textContent = `
        @keyframes capsulePop {
          0% { transform: translateY(15px) scale(0.8); opacity: 0; }
          100% { transform: translateY(0) scale(1); opacity: 1; }
        }
      `;
      document.head.appendChild(keyframes);
      document.body.appendChild(capsuleIcon);

      // 3. Smoothly scroll the page to center the capsule
      window.scrollTo({
        top: window.scrollY + rect.top - window.innerHeight / 2,
        behavior: 'smooth'
      });

      // Fade out the capsule icon after 8 seconds to keep the page clean
      setTimeout(() => { 
        capsuleIcon.style.opacity = '0'; 
        capsuleIcon.style.transition = 'opacity 0.5s ease-out'; 
      }, 8000);
      setTimeout(() => capsuleIcon.remove(), 8500);

    } catch (err) {
      console.warn("Context Capsule: Range error", err);
    }
  }
}

// ==========================================
// NOTIFICATIONS & ALARM LISTENERS
// ==========================================
function triggerSafeNotification(id, title, message, contextMessage) {
  chrome.notifications.create(id, {
    type: "basic",
    iconUrl: "logo.png",
    title: title,
    message: message,
    contextMessage: contextMessage,
    priority: 2,
    requireInteraction: true
  }, (createdId) => {
    if (chrome.runtime.lastError) {
      chrome.notifications.create(id + "_retry", {
        type: "basic",
        iconUrl: SAFE_ICON, 
        title: title,
        message: message,
        contextMessage: contextMessage,
        priority: 2,
        requireInteraction: true
      });
    }
  });
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "teleport") {
    teleportToClip(request.url, request.text);
  } else if (request.action === "test_notification") {
    triggerSafeNotification(
      "test_notify_" + Date.now(), 
      "✅ Alarm Activated", 
      request.message, 
      "Context Capsule"
    );
  }
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name.startsWith("reminder_")) {
    const clipId = Number(alarm.name.split("_")[1]);
    
    chrome.storage.local.get({ clips: [] }, (res) => {
      const clip = res.clips.find(c => c.id === clipId);
      if (clip) {
        const uniqueNotificationId = `notify_${clipId}_${Date.now()}`;
        const safeMessage = clip.text.length > 80 ? clip.text.slice(0, 80) + "..." : clip.text;

        triggerSafeNotification(
          uniqueNotificationId, 
          "Context Capsule Reminder", 
          safeMessage, 
          clip.title ? `Click to return to: ${clip.title}` : "Click to jump back"
        );

        // Clear reminder time from storage to remove UI badge
        const updatedClips = res.clips.map(c => {
          if (c.id === clipId) { delete c.reminderTime; }
          return c;
        });
        chrome.storage.local.set({ clips: updatedClips });
      }
    });
  }
});

// LISTENS FOR CLICKS ON THE NOTIFICATION ITSELF
chrome.notifications.onClicked.addListener((notificationId) => {
  if (notificationId.startsWith("notify_")) {
    const clipId = Number(notificationId.split("_")[1]);
    
    chrome.storage.local.get({ clips: [] }, (res) => {
      const clip = res.clips.find(c => c.id === clipId);
      if (clip) {
        // Trigger the teleport (which handles opening the tab and highlighting)
        teleportToClip(clip.url, clip.text);
        chrome.notifications.clear(notificationId);
      }
    });
  }
});
