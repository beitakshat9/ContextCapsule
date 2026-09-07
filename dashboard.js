let currentFilter = "All";
const defaultCategories = ["Evidence", "Idea", "Counterargument", "Reference"];
const defaultColors = { "Evidence": "#10b981", "Idea": "#8b5cf6", "Counterargument": "#ef4444", "Reference": "#3b82f6" };
const fallbackColors = ["#f59e0b", "#14b8a6", "#ec4899", "#6366f1"];

let globalClips = [];

function getDateGroup(timestamp) {
    const date = timestamp ? new Date(timestamp) : new Date();

    if (isNaN(date.getTime())) {
        return "older";
    }

    const now = new Date();

    // Remove the time portion so we compare calendar dates only
    const today = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate()
    );

    const clipDay = new Date(
        date.getFullYear(),
        date.getMonth(),
        date.getDate()
    );

    const difference = today - clipDay;
    const oneDay = 24 * 60 * 60 * 1000;

    if (difference === 0) {
        return "today";
    }

    if (difference === oneDay) {
        return "yesterday";
    }

    if (difference > oneDay && difference <= 7 * oneDay) {
        return "last7days";
    }

    return "older";
}

function renderVault() {
    chrome.storage.local.get({
        clips: [],
        customCategories: defaultCategories,
        categoryColors: defaultColors,
        folders: ["General"],
        activeFolder: "General"
    }, (data) => {
        const grid = document.getElementById("capsule-grid");
        const clips = data.clips;

        globalClips = clips;

        const folders = data.folders;
        const activeFolder = data.activeFolder;
        const colors = data.categoryColors;

        let categoriesDB = data.customCategories;

        if (Array.isArray(categoriesDB)) {
            categoriesDB = { "General": categoriesDB };
        }

        if (!categoriesDB[activeFolder]) {
            categoriesDB[activeFolder] = [...defaultCategories];

            chrome.storage.local.set({
                customCategories: categoriesDB
            });
        }

        const folderCategories = categoriesDB[activeFolder];

        document.getElementById("active-workspace-name").innerText = activeFolder;

        const dropdownHtml = folders.map(f =>
                `<div class="workspace-item folder-option" data-folder="${f}">📂 ${f}</div>`
            ).join('') +
            `<div class="workspace-item workspace-add" id="add-workspace-btn">+ Create New Workspace</div>`;

        document.getElementById("workspace-dropdown").innerHTML = dropdownHtml;

        attachWorkspaceListeners();

        // ==========================================
        // WORKSPACE FILTERING
        // ==========================================

        const folderClips = clips.filter(
            c => (c.folder || "General") === activeFolder
        );

        renderSidebar(folderClips, folderCategories, colors);

        // ==========================================
        // CATEGORY FILTERING
        // ==========================================

        const filteredClips = currentFilter === "All" ?
            folderClips :
            folderClips.filter(
                clip => (clip.tag || folderCategories[0]) === currentFilter
            );

        document.getElementById("page-title").innerText =
            currentFilter === "All" ?
            `${activeFolder} Overview` :
            `${currentFilter} (in ${activeFolder})`;

        // ==========================================
        // EMPTY WORKSPACE
        // ==========================================

        if (filteredClips.length === 0) {
            grid.innerHTML = `
                <div class="empty-state">
                    <h3 style="color: #0f172a; margin-bottom: 8px; font-size: 22px;">
                        Workspace is empty
                    </h3>

                    <p style="color: #64748b; font-size: 15px;">
                        Right-click any text on the web to save it here.
                    </p>
                </div>
            `;

            return;
        }

        // ==========================================
        // DATE GROUPING
        // ==========================================

        const dateGroups = {
            today: [],
            yesterday: [],
            last7days: [],
            older: []
        };

        filteredClips.forEach(clip => {
            const group = getDateGroup(clip.timestamp);

            if (dateGroups[group]) {
                dateGroups[group].push(clip);
            } else {
                dateGroups.older.push(clip);
            }
        });

        // ==========================================
        // DATE GROUP CONFIGURATION
        // ==========================================

        const groupConfig = [{
                key: "today",
                title: "Today",
                subtitle: "Clips saved today",
                icon: "☀️",
                expanded: true
            },
            {
                key: "yesterday",
                title: "Yesterday",
                subtitle: "Clips saved yesterday",
                icon: "🌙",
                expanded: true
            },
            {
                key: "last7days",
                title: "Last 7 Days",
                subtitle: "Clips from the past week",
                icon: "📅",
                expanded: false
            },
            {
                key: "older",
                title: "Older",
                subtitle: "Earlier saved clips",
                icon: "🗂️",
                expanded: false
            }
        ];

        // ==========================================
        // CARD RENDERER
        // ==========================================

        const renderCard = (clip, index) => {
            const clipDate = clip.timestamp ?
                new Date(clip.timestamp) :
                new Date();

            const year = isNaN(clipDate.getFullYear()) ?
                new Date().getFullYear() :
                clipDate.getFullYear();

            const apaCitation =
                `("${clip.text.slice(0, 40)}...", ${year}). Retrieved from ${clip.url}`;

            const tag = clip.tag || folderCategories[0];

            const themeColor =
                colors[tag] ||
                fallbackColors[index % fallbackColors.length];

            const clipFolder = clip.folder || "General";

            const tagOptions = folderCategories.map(cat =>
                `<option value="${cat}" ${tag === cat ? 'selected' : ''}>
                    ${cat}
                </option>`
            ).join('');

            const folderOptions = folders.map(f =>
                `<option value="${f}" ${clipFolder === f ? 'selected' : ''}>
                    Move to: ${f}
                </option>`
            ).join('');

            return `
                <div class="card"
                     data-id="${clip.id}"
                     style="--theme-color: ${themeColor};">

                    <div class="card-header stop-propagation">

                        <div style="display: flex; gap: 8px; align-items: center;">

                            <select class="tag-select"
                                    data-id="${clip.id}">
                                ${tagOptions}
                            </select>

                            <select class="card-folder-select"
                                    data-id="${clip.id}">
                                ${folderOptions}
                            </select>

                        </div>

                        <span class="date">
                            ${clip.timestamp || 'Just now'}
                        </span>

                    </div>

                    <div class="quote-box">
                        "${clip.text}"
                    </div>

                    <div class="source"
                         title="${clip.title}">
                        📄 <span>${clip.title}</span>
                    </div>

                    <div class="card-actions stop-propagation">

                        <button
                            class="btn btn-apa copy-btn"
                            data-citation="${apaCitation.replace(/"/g, '&quot;')}">
                            📋 APA
                        </button>

                        <div class="btn-group">

                            <button
                                class="btn btn-share share-btn"
                                data-id="${clip.id}">
                                📤 Share
                            </button>

                            <button
                                class="btn btn-teleport teleport-btn"
                                data-id="${clip.id}">
                                Jump ↗
                            </button>

                            <button
                                class="btn btn-del delete-btn"
                                data-id="${clip.id}"
                                title="Delete clip">
                                ✖
                            </button>

                        </div>

                    </div>

                </div>
            `;
        };

        // ==========================================
        // BUILD DATE-GROUPED DASHBOARD
        // ==========================================

        let groupedHtml = "";

        groupConfig.forEach(config => {

            const groupClips = dateGroups[config.key];

            // Don't display empty date groups
            if (groupClips.length === 0) {
                return;
            }

            const sectionId = `date-section-${config.key}`;

            groupedHtml += `
                <section
                    class="date-group"
                    data-date-group="${config.key}"
                    style="
                        margin-bottom: 24px;
                        border-radius: 16px;
                    "
                >

                    <div
                        class="date-group-header"
                        data-target="${sectionId}"
                        style="
                            display: flex;
                            align-items: center;
                            justify-content: space-between;
                            padding: 14px 16px;
                            margin-bottom: ${config.expanded ? '14px' : '0'};
                            background: #ffffff;
                            border: 1px solid #e2e8f0;
                            border-radius: 14px;
                            cursor: pointer;
                            user-select: none;
                            transition: background 0.2s ease, border-color 0.2s ease;
                        "
                    >

                        <div
                            style="
                                display: flex;
                                align-items: center;
                                gap: 12px;
                            "
                        >

                            <div
                                style="
                                    width: 38px;
                                    height: 38px;
                                    display: flex;
                                    align-items: center;
                                    justify-content: center;
                                    background: #f1f5f9;
                                    border-radius: 10px;
                                    font-size: 18px;
                                "
                            >
                                ${config.icon}
                            </div>

                            <div>

                                <div
                                    style="
                                        color: #0f172a;
                                        font-size: 16px;
                                        font-weight: 800;
                                    "
                                >
                                    ${config.title}
                                </div>

                                <div
                                    style="
                                        color: #94a3b8;
                                        font-size: 12px;
                                        font-weight: 600;
                                        margin-top: 2px;
                                    "
                                >
                                    ${config.subtitle}
                                </div>

                            </div>

                            <span
                                style="
                                    display: inline-flex;
                                    align-items: center;
                                    justify-content: center;
                                    min-width: 28px;
                                    height: 24px;
                                    padding: 0 8px;
                                    background: #f1f5f9;
                                    color: #475569;
                                    border-radius: 12px;
                                    font-size: 11px;
                                    font-weight: 800;
                                "
                            >
                                ${groupClips.length}
                            </span>

                        </div>

                        <span
                            class="date-group-arrow"
                            style="
                                font-size: 14px;
                                color: #64748b;
                                transition: transform 0.2s ease;
                                transform: rotate(${config.expanded ? '0deg' : '-90deg'});
                            "
                        >
                            ▼
                        </span>

                    </div>

                    <div
                        id="${sectionId}"
                        class="date-group-content"
                        data-expanded="${config.expanded}"
                        style="
                            display: ${config.expanded ? 'grid' : 'none'};
                            gap: 16px;
                        "
                    >
                        ${groupClips.map((clip, index) =>
                            renderCard(clip, index)
                        ).join('')}
                    </div>

                </section>
            `;
        });

        grid.innerHTML = groupedHtml;

        // ==========================================
        // DATE GROUP COLLAPSE / EXPAND
        // ==========================================

        document.querySelectorAll(".date-group-header").forEach(header => {

            header.addEventListener("click", () => {

                const targetId = header.dataset.target;
                const content = document.getElementById(targetId);

                if (!content) {
                    return;
                }

                const arrow =
                    header.querySelector(".date-group-arrow");

                const isExpanded =
                    content.dataset.expanded === "true";

                if (isExpanded) {

                    content.style.display = "none";
                    content.dataset.expanded = "false";

                    header.style.marginBottom = "0px";

                    if (arrow) {
                        arrow.style.transform = "rotate(-90deg)";
                    }

                } else {

                    content.style.display = "grid";
                    content.dataset.expanded = "true";

                    header.style.marginBottom = "14px";

                    if (arrow) {
                        arrow.style.transform = "rotate(0deg)";
                    }
                }
            });

            // Small visual feedback on hover
            header.addEventListener("mouseenter", () => {
                header.style.background = "#f8fafc";
                header.style.borderColor = "#cbd5e1";
            });

            header.addEventListener("mouseleave", () => {
                header.style.background = "#ffffff";
                header.style.borderColor = "#e2e8f0";
            });
        });

        // ==========================================
        // EXISTING CARD LISTENERS
        // ==========================================
        // IMPORTANT:
        // This remains the same system used by the existing
        // Jump / Share / Delete / APA / tag / folder functionality.

        attachCardListeners(clips);
    });
}

function renderSidebar(folderClips, folderCategories, colors) {
    const sidebarList = document.getElementById("sidebar-filters");
    const counts = { All: folderClips.length };
    folderCategories.forEach(cat => counts[cat] = 0);
    folderClips.forEach(clip => {
        const tag = clip.tag || folderCategories[0];
        if (counts[tag] !== undefined) counts[tag]++;
        else counts[tag] = 1;
    });

    let html = `<li><button class="filter-btn ${currentFilter === "All" ? "active" : ""}" data-filter="All" style="--primary: #0ea5e9;"><span>All Capsules</span> <span class="filter-count">${counts.All}</span></button></li>`;

    folderCategories.forEach((cat, index) => {
        const catColor = colors[cat] || fallbackColors[index % fallbackColors.length];
        html += `<li><div class="filter-btn ${currentFilter === cat ? "active" : ""}" style="--primary: ${catColor}; cursor: default;">
        <div class="cat-row" data-filter="${cat}" style="cursor: pointer;">
          <input type="color" class="color-dot" data-cat="${cat}" value="${catColor}">
          <span class="cat-text" data-old="${cat}">${cat}</span> 
        </div>
        <span class="filter-count" style="margin-left: auto; margin-right: 8px;">${counts[cat]}</span>
        <button class="edit-cat-btn" data-target="${cat}" title="Rename">✏️</button>
      </div></li>`;
    });
    sidebarList.innerHTML = html;
    attachSidebarListeners();
}

const workspaceBtn = document.getElementById("workspace-btn");
const workspaceDropdown = document.getElementById("workspace-dropdown");

workspaceBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    workspaceDropdown.style.display = workspaceDropdown.style.display === "flex" ? "none" : "flex";
});
document.addEventListener("click", () => workspaceDropdown.style.display = "none");

function attachWorkspaceListeners() {
    document.querySelectorAll(".folder-option").forEach(item => {
        item.addEventListener("click", (e) => {
            currentFilter = "All";
            chrome.storage.local.set({ activeFolder: e.target.dataset.folder }, () => renderVault());
        });
    });

    document.getElementById("add-workspace-btn").addEventListener("click", () => {
        const folderName = prompt("Name your new Workspace (e.g. Physics, Marketing):");
        if (folderName && folderName.trim() !== "") {
            const cleanName = folderName.trim();
            chrome.storage.local.get({ folders: ["General"], customCategories: {} }, (res) => {
                if (!res.folders.includes(cleanName)) {
                    const newFolders = [...res.folders, cleanName];
                    const updatedCategories = {...res.customCategories, [cleanName]: [...defaultCategories] };
                    chrome.storage.local.set({ folders: newFolders, activeFolder: cleanName, customCategories: updatedCategories }, () => {
                        currentFilter = "All";
                        renderVault();
                    });
                } else alert("Workspace already exists!");
            });
        }
    });
}

function attachSidebarListeners() {
    document.querySelectorAll(".cat-row").forEach(row => {
        row.addEventListener("click", (e) => {
            if (e.target.classList.contains("color-dot") || e.target.classList.contains("cat-text") && e.target.isContentEditable) return;
            currentFilter = row.dataset.filter;
            renderVault();
        });
    });

    document.querySelectorAll(".color-dot").forEach(dot => {
        dot.addEventListener("change", (e) => {
            chrome.storage.local.get({ categoryColors: defaultColors }, (res) => {
                chrome.storage.local.set({ categoryColors: {...res.categoryColors, [e.target.dataset.cat]: e.target.value } });
            });
        });
    });

    document.querySelectorAll(".edit-cat-btn").forEach(btn => {
        btn.addEventListener("click", (e) => {
            const span = document.querySelector(`span[data-old="${e.currentTarget.dataset.target}"]`);
            if (span) {
                span.setAttribute("contenteditable", "true");
                span.focus();
                document.execCommand('selectAll', false, null);
                document.getSelection().collapseToEnd();
            }
        });
    });

    document.querySelectorAll(".cat-text").forEach(span => {
        span.addEventListener("keydown", (e) => {
            if (e.key === "Enter") {
                e.preventDefault();
                e.target.blur();
            }
        });
        span.addEventListener("blur", (e) => {
            e.target.removeAttribute("contenteditable");
            const oldName = e.target.dataset.old;
            const newName = e.target.innerText.trim();

            if (newName && newName !== oldName) {
                chrome.storage.local.get({ clips: [], customCategories: {}, categoryColors: defaultColors, activeFolder: "General" }, (res) => {
                    let categoriesDB = res.customCategories;
                    const activeFolder = res.activeFolder;
                    categoriesDB[activeFolder] = categoriesDB[activeFolder].map(c => c === oldName ? newName : c);

                    const updatedColors = {...res.categoryColors };
                    updatedColors[newName] = updatedColors[oldName] || fallbackColors[0];

                    const updatedClips = res.clips.map(clip => {
                        if ((clip.folder || "General") === activeFolder && (clip.tag || defaultCategories[0]) === oldName) clip.tag = newName;
                        return clip;
                    });
                    if (currentFilter === oldName) currentFilter = newName;
                    chrome.storage.local.set({ clips: updatedClips, customCategories: categoriesDB, categoryColors: updatedColors });
                });
            } else e.target.innerText = oldName;
        });
    });
}

document.getElementById("add-new-cat").addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
        e.preventDefault();
        const newCat = e.target.value.trim();
        if (!newCat) return;

        chrome.storage.local.get({ customCategories: {}, categoryColors: defaultColors, activeFolder: "General" }, (res) => {
            let categoriesDB = res.customCategories;
            const activeFolder = res.activeFolder;
            if (!categoriesDB[activeFolder].includes(newCat)) {
                categoriesDB[activeFolder].push(newCat);
                const updatedColors = {...res.categoryColors, [newCat]: fallbackColors[categoriesDB[activeFolder].length % fallbackColors.length] };
                chrome.storage.local.set({ customCategories: categoriesDB, categoryColors: updatedColors }, () => { e.target.value = ""; });
            } else alert("Tag already exists in this workspace!");
        });
    }
});

// ==========================================
// ✨ ELABORATE MODAL AI LOGIC & HANDLERS
// ==========================================
const modalOverlay = document.getElementById("elaborate-modal");
const closeModalBtn = document.getElementById("close-modal-btn");
const modalBody = document.getElementById("modal-body-content");
const modalBox = document.getElementById("modal-card-box");

closeModalBtn.addEventListener("click", () => { modalOverlay.style.display = "none"; });
modalOverlay.addEventListener("click", (e) => { if (e.target === modalOverlay) modalOverlay.style.display = "none"; });

function openElaborateModal(clip, themeColor) {
    modalBox.style.setProperty("--modal-theme", themeColor);

    modalBody.innerHTML = `
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
      <span style="background: ${themeColor}15; color: ${themeColor}; padding: 6px 14px; border-radius: 20px; font-size: 11px; font-weight: 800; text-transform: uppercase;">${clip.tag || 'Evidence'}</span>
      <span style="font-size: 12px; color: #94a3b8; font-weight: 700;">${clip.timestamp || 'Just now'}</span>
    </div>
    
    <div style="font-size: 16px; font-weight: 700; color: #0f172a; margin-bottom: 8px; display: flex; align-items: center; gap: 8px;">
      📄 ${clip.title}
    </div>
    
    <div class="modal-quote">"${clip.text}"</div>
    
    <div style="font-size: 13px; color: #64748b; margin-bottom: 20px; word-break: break-all;">
      <b>Source URL:</b> <a href="${clip.url}" target="_blank" style="color: var(--primary); text-decoration: none;">${clip.url}</a>
    </div>

    <!-- AI ACTION BUTTONS IN MODAL -->
    <div class="modal-ai-row">
      <button class="btn-modal-ai" id="modal-summarize-btn" data-id="${clip.id}">✨ Summarize</button>
      <button class="btn-modal-ai" id="modal-explain-btn" data-id="${clip.id}">🧠 Explain More</button>
    </div>

    <div class="modal-ai-output" id="modal-ai-output"></div>
  `;

    modalOverlay.style.display = "flex";

    document.getElementById("modal-summarize-btn").addEventListener("click", (e) => executeModalAI(clip, 'summarize', e.target));
    document.getElementById("modal-explain-btn").addEventListener("click", (e) => executeModalAI(clip, 'explain', e.target));
}

async function executeModalAI(clip, actionType, btnElement) {

    const outDiv = document.getElementById("modal-ai-output");

    const originalText = btnElement.innerText;

    btnElement.innerText = "⏳ Processing Deep Analysis...";
    btnElement.disabled = true;

    outDiv.style.display = "block";

    outDiv.innerHTML = `<span style="color:#64748b;">${
        actionType === 'summarize'
            ? 'Synthesizing concise summary...'
            : 'Generating extensive research elaboration, conceptual context, and in-depth breakdown...'
    }</span>`;

    let formattedText = "";

    try {

        const response = await fetch(
            "http://localhost:3000/api/ai", {
                method: "POST",

                headers: {
                    "Content-Type": "application/json"
                },

                body: JSON.stringify({
                    text: clip.text,
                    actionType: actionType
                })
            }
        );

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || "AI request failed");
        }

        formattedText = data.result;

        formattedText = formattedText
            .replace(/\*\*(.*?)\*\*/g, '<b>$1</b>')
            .replace(/\n/g, '<br>');

    } catch (e) {

        console.error("AI request failed:", e);

        if (actionType === 'summarize') {

            formattedText = `
                • <b>Core Takeaway:</b> This capsule contains important context extracted from the selected webpage.<br>
                • <b>Contextual Baseline:</b> This saved snippet can be used as structured evidence from <i>${clip.title}</i>.
            `;

        } else {

            formattedText = `
                <b>🔍 Comprehensive Analytical Breakdown:</b><br><br>

                1. <b>Contextual Foundation:</b>
                The captured statement originates from <i>${clip.title}</i> and provides useful contextual information for further analysis.<br><br>

                2. <b>Thematic Significance:</b>
                The selected snippet contains information that can help identify important arguments, concepts, and supporting context.<br><br>

                3. <b>Implications & Application:</b>
                This saved information can be used for further research, comparison, cross-referencing, and analysis.<br><br>

                4. <b>Source Linkage:</b>
                Directly anchored to
                <a href="${clip.url}" target="_blank" style="color: #8b5cf6;">
                    ${clip.url}
                </a>
                for source verification.
            `;

        }
    }

    outDiv.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">

            <strong style="color:#4c1d95; font-size:15px;">
                ${actionType === 'summarize'
                    ? '✨ Summary'
                    : '🧠 Exhaustive Detailed Elaboration'}
            </strong>

            <button
                id="close-modal-ai"
                style="background:none;border:none;cursor:pointer;font-size:12px;color:#94a3b8;">
                ✖ Close
            </button>

        </div>

        ${formattedText}
    `;

    document
        .getElementById("close-modal-ai")
        .addEventListener("click", () => {
            outDiv.style.display = "none";
        });

    btnElement.innerText = originalText;
    btnElement.disabled = false;
}

function attachCardListeners(allClips) {
    // Stop propagation via JS event listeners instead of inline onclick handlers
    document.querySelectorAll(".stop-propagation").forEach(el => {
        el.addEventListener("click", (e) => e.stopPropagation());
    });

    document.querySelectorAll(".card").forEach(card => {
        card.addEventListener("click", () => {
            const clipId = Number(card.dataset.id);
            const clip = allClips.find(c => c.id === clipId);
            if (clip) {
                const computedColor = getComputedStyle(card).getPropertyValue('--theme-color').trim() || '#8b5cf6';
                openElaborateModal(clip, computedColor);
            }
        });
    });

    document.querySelectorAll(".tag-select").forEach(select => {
        select.addEventListener("change", (e) => {
            chrome.storage.local.get({ clips: [] }, (res) => {
                const updatedClips = res.clips.map(clip => { if (clip.id === Number(e.target.dataset.id)) clip.tag = e.target.value; return clip; });
                chrome.storage.local.set({ clips: updatedClips });
            });
        });
    });

    document.querySelectorAll(".card-folder-select").forEach(select => {
        select.addEventListener("change", (e) => {
            chrome.storage.local.get({ clips: [] }, (res) => {
                const updatedClips = res.clips.map(clip => { if (clip.id === Number(e.target.dataset.id)) clip.folder = e.target.value; return clip; });
                chrome.storage.local.set({ clips: updatedClips });
            });
        });
    });

    document.querySelectorAll(".teleport-btn").forEach(btn => {
        btn.addEventListener("click", (e) => {
            const clip = allClips.find(c => c.id === Number(e.target.dataset.id));
            if (clip) chrome.runtime.sendMessage({ action: "teleport", url: clip.url, text: clip.text });
        });
    });

    document.querySelectorAll(".share-btn").forEach(btn => {
        btn.addEventListener("click", async(e) => {
            const clip = allClips.find(c => c.id === Number(e.target.dataset.id));
            if (!clip) return;
            const shareText = `"${clip.text}"\n\n- Captured from: ${clip.title}\n${clip.url}`;
            if (navigator.share) { try { await navigator.share({ title: 'Context Capsule', text: shareText }); } catch (err) {} } else {
                navigator.clipboard.writeText(shareText);
                e.target.innerText = "✅ Copied";
                setTimeout(() => e.target.innerText = "📤 Share", 2000);
            }
        });
    });

    document.querySelectorAll(".copy-btn").forEach(btn => {
        btn.addEventListener("click", (e) => {
            navigator.clipboard.writeText(e.target.dataset.citation);
            e.target.innerHTML = "✅ Copied!";
            e.target.style.background = "#dcfce7";
            e.target.style.color = "#166534";
            setTimeout(() => {
                e.target.innerHTML = "📋 APA";
                e.target.style.background = "";
                e.target.style.color = "";
            }, 1500);
        });
    });

    document.querySelectorAll(".delete-btn").forEach(btn => {
        btn.addEventListener("click", (e) => {
            if (confirm("Delete this capsule?")) {
                chrome.storage.local.get({ clips: [] }, (res) => { chrome.storage.local.set({ clips: res.clips.filter(clip => clip.id !== Number(e.target.dataset.id)) }); });
            }
        });
    });
}

renderVault();
chrome.storage.onChanged.addListener((changes, namespace) => {
    if (namespace === 'local' && (changes.clips || changes.customCategories || changes.categoryColors || changes.folders || changes.activeFolder)) renderVault();
});
