const defaultCategories = ["Evidence", "Idea", "Counterargument", "Reference"];

function renderClips() {
  chrome.storage.local.get({ clips: [], customCategories: defaultCategories, folders: ["General"] }, (data) => {
    const container = document.getElementById("clip-list");
    document.getElementById("clip-count").innerText = `${data.clips.length} clips`;
    
    // Migration safety check for Categories Structure
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

      return `
        <div class="card">
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
              <button class="icon-btn teleport-btn" data-id="${clip.id}">Jump ↗</button>
              <button class="icon-btn delete-btn" data-id="${clip.id}">Del</button>
            </div>
          </div>
        </div>
      `;
    }).join('');

    // Update Folder directly from Popup
    document.querySelectorAll(".folder-select").forEach(select => {
      select.addEventListener("change", (e) => {
        const id = Number(e.target.dataset.id);
        const newFolder = e.target.value;
        updateClipData(id, { folder: newFolder }, true);
      });
    });

    // Update Tag directly from Popup
    document.querySelectorAll(".tag-select").forEach(select => {
      select.addEventListener("change", (e) => {
        const id = Number(e.target.dataset.id);
        updateClipData(id, { tag: e.target.value }, false);
      });
    });

    document.querySelectorAll(".teleport-btn").forEach(btn => {
      btn.addEventListener("click", (e) => {
        const clip = data.clips.find(c => c.id === Number(e.target.dataset.id));
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
  });
}

function updateClipData(id, updates, reRender = false) {
  chrome.storage.local.get({ clips: [] }, (res) => {
    const updatedClips = res.clips.map(clip => {
      if (clip.id === id) return { ...clip, ...updates };
      return clip;
    });
    chrome.storage.local.set({ clips: updatedClips }, () => {
      if (reRender) renderClips(); // Re-render to update the adjacent tag list if folder changed
    });
  });
}

document.getElementById("open-dashboard").addEventListener("click", () => {
  chrome.tabs.create({ url: chrome.runtime.getURL("dashboard.html") });
});

renderClips();