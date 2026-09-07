const defaultCategories = ["Evidence", "Idea", "Counterargument", "Reference"];
let activeReminderClipId = null; // Store ID when modal opens

function renderClips() {
  chrome.storage.local.get({ clips: [], customCategories: defaultCategories, folders: ["General"] }, (data) => {
    const container = document.getElementById("clip-list");
    document.getElementById("clip-count").innerText = `${data.clips.length} clips`;
    
    let categoriesDB = data.customCategories;
    if (Array.isArray(categoriesDB)) {
      categoriesDB = { "General": categoriesDB };
    }

    if (data.clips.length === 0) {
      container.innerHTML = `<div style="text-align:center; padding: 20px; color: #94a3b8; font-size: 12px;">No clips yet. Highlight text on a page and right-click to capture!</div>`;
      return;
    }

    container.innerHTML = data.clips.map(clip => {
      const clipFolder = clip.folder || "General";
      const folderCategories = categoriesDB[clipFolder] || defaultCategories;
      const tag = clip.tag || folderCategories[0];
      
      const folderOptionsHtml = data.folders.map(f => 
        `<option value="${f}" ${clipFolder === f ? 'selected' : ''}>📂 ${f}</option>`
      ).join('');

      const tagOptionsHtml = folderCategories.map(cat => 
        `<option value="${cat}" ${tag === cat ? 'selected' : ''}>${cat}</option>`
      ).join('');

      // Check if a reminder exists visually
      const reminderBadge = clip.reminderTime 
        ? `<div class="reminder-badge" title="Reminder Set">⏰ ${new Date(clip.reminderTime).toLocaleDateString()}</div>` 
        : '';

      return `
        <div class="card">
          ${reminderBadge}
          <div class="quote">"${clip.text}"</div>
          <div class="context">${clip.context ? `...${clip.context}...` : 'No context saved.'}</div>
          <div class="actions">
            <div class="dropdown-group">
              <select class="ui-select folder folder-select" data-id="${clip.id}">
                ${folderOptionsHtml}
              </select>
              <select class="ui-select tag-select" data-id="${clip.id}">
                ${tagOptionsHtml}
              </select>
            </div>
            <div class="btn-group">
              <button class="icon-btn remind-btn" data-id="${clip.id}" title="Set Reminder">⏰</button>
              <button class="icon-btn teleport-btn" data-id="${clip.id}">Jump</button>
              <button class="icon-btn delete-btn" data-id="${clip.id}">Del</button>
            </div>
          </div>
        </div>
      `;
    }).join('');

    attachPopupListeners(data.clips);
  });
}

function attachPopupListeners(clips) {
  document.querySelectorAll(".folder-select").forEach(select => {
    select.addEventListener("change", (e) => {
      updateClipData(Number(e.target.dataset.id), { folder: e.target.value }, true);
    });
  });

  document.querySelectorAll(".tag-select").forEach(select => {
    select.addEventListener("change", (e) => {
      updateClipData(Number(e.target.dataset.id), { tag: e.target.value }, false);
    });
  });

  document.querySelectorAll(".teleport-btn").forEach(btn => {
    btn.addEventListener("click", (e) => {
      const clip = clips.find(c => c.id === Number(e.target.dataset.id));
      if (clip) chrome.runtime.sendMessage({ action: "teleport", url: clip.url, text: clip.text });
    });
  });

  document.querySelectorAll(".delete-btn").forEach(btn => {
    btn.addEventListener("click", (e) => {
      chrome.storage.local.get({ clips: [] }, (res) => {
        chrome.storage.local.set({ clips: res.clips.filter(c => c.id !== Number(e.target.dataset.id)) }, () => renderClips());
      });
    });
  });

  // Open Reminder UI
  document.querySelectorAll(".remind-btn").forEach(btn => {
    btn.addEventListener("click", (e) => {
      activeReminderClipId = Number(e.target.dataset.id);
      document.getElementById("reminder-ui").style.display = "flex";
      
      // Auto-set the datetime picker to 1 hour from now for convenience
      const now = new Date();
      now.setHours(now.getHours() + 1);
      now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
      document.getElementById("popup-reminder-datetime").value = now.toISOString().slice(0, 16);
    });
  });
}

function updateClipData(id, updates, reRender = false) {
  chrome.storage.local.get({ clips: [] }, (res) => {
    const updatedClips = res.clips.map(clip => {
      if (clip.id === id) return { ...clip, ...updates };
      return clip;
    });
    chrome.storage.local.set({ clips: updatedClips }, () => {
      if (reRender) renderClips();
    });
  });
}

document.getElementById("open-dashboard").addEventListener("click", () => {
  chrome.tabs.create({ url: chrome.runtime.getURL("dashboard.html") });
});

// Reminder UI Actions
document.getElementById("popup-cancel-reminder").addEventListener("click", () => {
  document.getElementById("reminder-ui").style.display = "none";
  activeReminderClipId = null;
});

document.getElementById("popup-save-reminder").addEventListener("click", () => {
  const dateStr = document.getElementById("popup-reminder-datetime").value;
  if (!dateStr) return alert("Please select a date and time!");

  const timestamp = new Date(dateStr).getTime();
  if (timestamp <= Date.now()) return alert("Please select a future time.");

  // Save the alarm using the background worker
  chrome.alarms.create(`reminder_${activeReminderClipId}`, { when: timestamp });

  // Save to storage so we can display the badge
  updateClipData(activeReminderClipId, { reminderTime: timestamp }, true);

  document.getElementById("reminder-ui").style.display = "none";
  activeReminderClipId = null;
});

renderClips();
