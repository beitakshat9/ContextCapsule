let currentFilter = "All";
const defaultCategories = ["Evidence", "Idea", "Counterargument", "Reference"];
const defaultColors = { "Evidence": "#10b981", "Idea": "#8b5cf6", "Counterargument": "#ef4444", "Reference": "#3b82f6" };
const fallbackColors = ["#f59e0b", "#14b8a6", "#ec4899", "#6366f1"];

// HARDCODED GEMINI API KEY
const HARDCODED_GEMINI_API_KEY = "AQ.Ab8RN6LEraW2SXFnAnK2Ou0VRfh03g2kH5HGCh5MOGvE_vkwFw";

let globalClips = [];
let dashboardReminderClipId = null;

function renderVault() {
  chrome.storage.local.get({
    clips: [], customCategories: defaultCategories, categoryColors: defaultColors, folders: ["General"], activeFolder: "General"
  }, (data) => {
    const grid = document.getElementById("capsule-grid");
    globalClips = data.clips;
    let categoriesDB = Array.isArray(data.customCategories) ? { "General": data.customCategories } : data.customCategories;
    if (!categoriesDB[data.activeFolder]) { categoriesDB[data.activeFolder] = [...defaultCategories]; chrome.storage.local.set({ customCategories: categoriesDB }); }
    
    document.getElementById("active-workspace-name").innerText = data.activeFolder;
    document.getElementById("workspace-dropdown").innerHTML = data.folders.map(f => `<div class="workspace-item folder-option" data-folder="${f}">Folder: ${f}</div>`).join('') + `<div class="workspace-item workspace-add" id="add-workspace-btn">+ New Workspace</div>`;
    attachWorkspaceListeners();

    const folderClips = globalClips.filter(c => (c.folder || "General") === data.activeFolder);
    renderSidebar(folderClips, categoriesDB[data.activeFolder], data.categoryColors);

    const filteredClips = currentFilter === "All" ? folderClips : folderClips.filter(clip => (clip.tag || categoriesDB[data.activeFolder][0]) === currentFilter);
    document.getElementById("page-title").innerText = currentFilter === "All" ? `${data.activeFolder} Overview` : currentFilter;

    if (filteredClips.length === 0) {
      grid.innerHTML = `<div style="color:white;">Workspace is empty. Right-click web text to clip!</div>`; return;
    }

    grid.innerHTML = filteredClips.map((clip, index) => {
      const tag = clip.tag || categoriesDB[data.activeFolder][0];
      const themeColor = data.categoryColors[tag] || fallbackColors[index % fallbackColors.length];
      const folderOptions = data.folders.map(f => `<option value="${f}" ${(clip.folder || "General") === f ? 'selected' : ''}>Move: ${f}</option>`).join('');
      const tagOptions = categoriesDB[data.activeFolder].map(cat => `<option value="${cat}" ${tag === cat ? 'selected' : ''}>${cat}</option>`).join('');
      
      return `
        <div class="card" data-id="${clip.id}" style="--theme-color: ${themeColor};">
          <div class="card-header stop-propagation">
            <select class="tag-select" data-id="${clip.id}">${tagOptions}</select>
            <select class="card-folder-select" data-id="${clip.id}">${folderOptions}</select>
          </div>
          <div class="quote-box">"${clip.text}"</div>
          <div class="card-actions stop-propagation">
            <button class="btn remind-btn" data-id="${clip.id}" style="background:#f59e0b;">Remind Me</button>
            <button class="btn btn-teleport teleport-btn" data-id="${clip.id}">Jump to Source</button>
            <button class="btn btn-del delete-btn" data-id="${clip.id}">Delete</button>
          </div>
        </div>
      `;
    }).join('');
    attachCardListeners(globalClips);
  });
}

function renderSidebar(folderClips, folderCategories, colors) {
  const sidebarList = document.getElementById("sidebar-filters");
  const counts = { All: folderClips.length };
  folderCategories.forEach(cat => counts[cat] = 0);
  folderClips.forEach(clip => { const tag = clip.tag || folderCategories[0]; counts[tag] = (counts[tag] || 0) + 1; });

  let html = `<li><button class="filter-btn" data-filter="All">All Capsules (${counts.All})</button></li>`;
  folderCategories.forEach(cat => {
    html += `<li><div class="filter-btn"><div class="cat-row" data-filter="${cat}"><input type="color" class="color-dot" data-cat="${cat}" value="${colors[cat] || '#fff'}"><span class="cat-text" data-old="${cat}">${cat}</span></div><span class="filter-count">${counts[cat]}</span></div></li>`;
  });
  sidebarList.innerHTML = html;
  attachSidebarListeners();
}

function attachWorkspaceListeners() {
  document.getElementById("workspace-btn").onclick = (e) => { e.stopPropagation(); document.getElementById("workspace-dropdown").style.display = 'flex'; };
  document.addEventListener("click", () => document.getElementById("workspace-dropdown").style.display = "none");
  document.querySelectorAll(".folder-option").forEach(item => item.onclick = (e) => { currentFilter = "All"; chrome.storage.local.set({ activeFolder: e.target.dataset.folder }, renderVault); });
  document.getElementById("add-workspace-btn").onclick = () => {
    const name = prompt("New Workspace Name:");
    if (name) chrome.storage.local.get({ folders: [], customCategories: {} }, res => {
      chrome.storage.local.set({ folders: [...res.folders, name], activeFolder: name, customCategories: {...res.customCategories, [name]: defaultCategories} }, renderVault);
    });
  };
}

function attachSidebarListeners() {
  document.querySelectorAll(".cat-row").forEach(row => row.onclick = (e) => { if(e.target.tagName !== 'INPUT') { currentFilter = row.dataset.filter; renderVault(); }});
  document.querySelectorAll(".color-dot").forEach(dot => dot.onchange = (e) => { chrome.storage.local.get({ categoryColors: {} }, res => chrome.storage.local.set({ categoryColors: {...res.categoryColors, [e.target.dataset.cat]: e.target.value} })); });
  document.getElementById("add-new-cat").onkeydown = (e) => {
    if (e.key === "Enter" && e.target.value) {
      chrome.storage.local.get({ customCategories: {}, activeFolder: "General" }, res => {
        res.customCategories[res.activeFolder].push(e.target.value);
        chrome.storage.local.set({ customCategories: res.customCategories }, () => { e.target.value = ""; renderVault(); });
      });
    }
  };
}

const modalOverlay = document.getElementById("elaborate-modal");
const modalBody = document.getElementById("modal-body-content");

function openElaborateModal(clip, themeColor) {
  document.getElementById("modal-card-box").style.setProperty("--modal-theme", themeColor);
  modalBody.innerHTML = `
    <button id="close-modal-btn" style="position:absolute; right:20px; top:20px;">Close</button>
    <h3 style="color:white;">${clip.title}</h3>
    <div class="modal-quote" style="color:white;">"${clip.text}"</div>
    <button class="btn-modal-ai" id="modal-analyze-btn">Analyze and Visualize</button>
    <div class="modal-ai-output" id="modal-ai-output"></div>
  `;
  modalOverlay.style.display = "flex";
  document.getElementById("close-modal-btn").onclick = () => modalOverlay.style.display = "none";
  document.getElementById("modal-analyze-btn").onclick = (e) => executeModalAI(clip, e.target);
}

async function executeModalAI(clip, btnElement) {
  const outDiv = document.getElementById("modal-ai-output");
  const apiKey = HARDCODED_GEMINI_API_KEY;

  btnElement.innerText = "Processing..."; 
  btnElement.disabled = true; 
  outDiv.style.display = "block"; 
  outDiv.innerHTML = "<span style='color:white;'>Loading...</span>";

  try {
    // Updated to gemini-2.5-flash endpoint
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contents: [{ parts: [{ text: `Analyze text: "${clip.text}". 1. Give summary. 2. If comparison, use <table class="glass-table">. 3. If process, use \`\`\`mermaid block.` }] }] })
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error?.message || "API Failed");
    
    let aiText = data.candidates[0].content.parts[0].text;
    aiText = aiText.replace(/```mermaid\n([\s\S]*?)```/g, `<details class="visual-toggle"><summary>View Diagram</summary><div class="mermaid">$1</div></details>`);
    
    outDiv.innerHTML = `<div style="color:white;">${aiText}</div>`;
    try { mermaid.run({ querySelector: '.mermaid' }); } catch (err) {}
  } catch (e) { 
    outDiv.innerHTML = `<div style="color:red;">Error: ${e.message}</div>`; 
  } finally { 
    btnElement.innerText = "Analyze and Visualize"; 
    btnElement.disabled = false; 
  }
}

function attachCardListeners(allClips) {
  document.querySelectorAll(".card").forEach(card => card.onclick = () => openElaborateModal(allClips.find(c => c.id === Number(card.dataset.id)), '#8b5cf6'));
  document.querySelectorAll(".stop-propagation").forEach(el => el.onclick = e => e.stopPropagation());
  document.querySelectorAll(".delete-btn").forEach(btn => btn.onclick = e => chrome.storage.local.get({ clips: [] }, res => chrome.storage.local.set({ clips: res.clips.filter(c => c.id !== Number(e.target.dataset.id)) })));
  document.querySelectorAll(".teleport-btn").forEach(btn => btn.onclick = e => { const clip = allClips.find(c => c.id === Number(e.target.dataset.id)); if(clip) chrome.runtime.sendMessage({ action: "teleport", url: clip.url, text: clip.text }); });
  document.querySelectorAll(".tag-select").forEach(sel => sel.onchange = e => chrome.storage.local.get({ clips: [] }, res => chrome.storage.local.set({ clips: res.clips.map(c => { if(c.id === Number(e.target.dataset.id)) c.tag = e.target.value; return c; }) })));
  document.querySelectorAll(".card-folder-select").forEach(sel => sel.onchange = e => chrome.storage.local.get({ clips: [] }, res => chrome.storage.local.set({ clips: res.clips.map(c => { if(c.id === Number(e.target.dataset.id)) c.folder = e.target.value; return c; }) })));
}

renderVault();
chrome.storage.onChanged.addListener((changes) => { if(changes.clips || changes.customCategories || changes.activeFolder) renderVault(); });
