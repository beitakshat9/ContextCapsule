let currentFilter = "All";

const defaultCategories = [
    "Evidence",
    "Idea",
    "Definition",
    "Counterargument",
    "Reference",
    "Quote",
    "Need to verify"
];

const defaultColors = {
    "Evidence": "#3b82f6",
    "Idea": "#8b5cf6",
    "Definition": "#06b6d4",
    "Counterargument": "#ef4444",
    "Reference": "#f59e0b",
    "Quote": "#10b981",
    "Need to verify": "#f97316"
};

const fallbackColors = [
    "#3b82f6",
    "#8b5cf6",
    "#06b6d4",
    "#ef4444",
    "#f59e0b",
    "#10b981",
    "#f97316",
    "#ec4899"
];

let globalClips = [];


/* =========================================================
   DATE GROUPING
========================================================= */

function getDateGroup(timestamp) {
    const date = new Date(timestamp);

    if (isNaN(date.getTime())) {
        return "Older";
    }

    const now = new Date();

    const today = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate()
    );

    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);

    const sevenDaysAgo = new Date(today);
    sevenDaysAgo.setDate(today.getDate() - 7);

    if (date >= today) {
        return "Today";
    }

    if (date >= yesterday) {
        return "Yesterday";
    }

    if (date >= sevenDaysAgo) {
        return "Last 7 Days";
    }

    return "Older";
}


/* =========================================================
   CONFIDENCE
========================================================= */

function getConfidenceDisplay(clip) {
    const level =
        clip.confidence &&
        typeof clip.confidence.level === "string" ?
        clip.confidence.level :
        "grey";

    if (level === "green") {
        return {
            color: "#22c55e",
            tooltip: "Strong source signals"
        };
    }

    if (level === "yellow") {
        return {
            color: "#eab308",
            tooltip: "Some source signals look questionable"
        };
    }

    return {
        color: "#94a3b8",
        tooltip: "Not enough information to evaluate"
    };
}


/* =========================================================
   RESEARCH SESSION HELPERS
========================================================= */

function createResearchSessionId() {
    return `session-${Date.now()}-${Math.random()
        .toString(36)
        .slice(2, 8)}`;
}


function formatSessionDate(timestamp) {
    if (!timestamp) {
        return "";
    }

    const date = new Date(timestamp);

    if (isNaN(date.getTime())) {
        return "";
    }

    return date.toLocaleDateString(undefined, {
        day: "numeric",
        month: "short",
        year: "numeric"
    });
}


function escapeHtml(value) {
    if (value === null || value === undefined) {
        return "";
    }

    return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}


/* =========================================================
   RESEARCH SESSION UI
========================================================= */

function ensureResearchSessionStyles() {
    if (document.getElementById("research-session-styles")) {
        return;
    }

    const style = document.createElement("style");
    style.id = "research-session-styles";

    style.textContent = `
        .research-session-wrapper {
            width: 100%;
            margin-bottom: 24px;
        }

        .research-session-card {
            background: #ffffff;
            border: 1px solid #e5e7eb;
            border-radius: 16px;
            padding: 20px;
            box-sizing: border-box;
            box-shadow: 0 2px 8px rgba(0,0,0,0.04);
        }

        .research-session-card.active {
            border-color: #6366f1;
            box-shadow: 0 4px 14px rgba(99,102,241,0.10);
        }

        .research-session-top {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            gap: 16px;
        }

        .research-session-title {
            font-size: 18px;
            font-weight: 700;
            color: #111827;
            margin-bottom: 5px;
        }

        .research-session-description {
            font-size: 13px;
            color: #6b7280;
            line-height: 1.5;
        }

        .research-session-active-name {
            font-size: 16px;
            font-weight: 700;
            color: #111827;
            margin-top: 2px;
        }

        .research-session-status {
            display: inline-flex;
            align-items: center;
            gap: 6px;
            font-size: 12px;
            font-weight: 600;
            color: #16a34a;
            margin-top: 8px;
        }

        .research-session-status-dot {
            width: 7px;
            height: 7px;
            border-radius: 50%;
            background: #22c55e;
            display: inline-block;
        }

        .research-session-actions {
            display: flex;
            gap: 8px;
            flex-wrap: wrap;
            margin-top: 18px;
        }

        .research-session-button {
            border: none;
            border-radius: 9px;
            padding: 9px 14px;
            font-size: 13px;
            font-weight: 600;
            cursor: pointer;
            transition: 0.15s ease;
        }

        .research-session-button.primary {
            background: #111827;
            color: #ffffff;
        }

        .research-session-button.primary:hover {
            background: #000000;
        }

        .research-session-button.secondary {
            background: #f3f4f6;
            color: #374151;
        }

        .research-session-button.secondary:hover {
            background: #e5e7eb;
        }

        .research-session-button.synthesize {
            background: #6366f1;
            color: #ffffff;
        }

        .research-session-button.synthesize:hover {
            background: #4f46e5;
        }

        .research-session-button:disabled {
            opacity: 0.55;
            cursor: not-allowed;
        }

        .research-session-count {
            margin-top: 10px;
            font-size: 13px;
            color: #6b7280;
        }

        .research-session-history {
            margin-top: 20px;
            border-top: 1px solid #f0f0f0;
            padding-top: 16px;
        }

        .research-session-history-title {
            font-size: 13px;
            font-weight: 700;
            color: #374151;
            margin-bottom: 10px;
        }

        .research-session-history-item {
            display: flex;
            justify-content: space-between;
            align-items: center;
            gap: 12px;
            padding: 11px 0;
            border-bottom: 1px solid #f3f4f6;
        }

        .research-session-history-item:last-child {
            border-bottom: none;
        }

        .research-session-history-name {
            font-size: 13px;
            font-weight: 600;
            color: #111827;
        }

        .research-session-history-meta {
            font-size: 11px;
            color: #9ca3af;
            margin-top: 3px;
        }

        .research-session-view-button {
            border: none;
            background: transparent;
            color: #6366f1;
            font-size: 12px;
            font-weight: 600;
            cursor: pointer;
            white-space: nowrap;
        }

        .research-session-view-button:hover {
            text-decoration: underline;
        }

        .research-session-findings-overlay {
            position: fixed;
            inset: 0;
            background: rgba(0,0,0,0.45);
            z-index: 9999;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 20px;
            box-sizing: border-box;
        }

        .research-session-findings-modal {
            width: min(850px, 100%);
            max-height: 85vh;
            overflow-y: auto;
            background: #ffffff;
            border-radius: 16px;
            padding: 24px;
            box-sizing: border-box;
            box-shadow: 0 20px 60px rgba(0,0,0,0.20);
        }

        .research-session-findings-header {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            gap: 15px;
            margin-bottom: 18px;
        }

        .research-session-findings-title {
            font-size: 20px;
            font-weight: 700;
            color: #111827;
        }

        .research-session-findings-date {
            font-size: 12px;
            color: #9ca3af;
            margin-top: 4px;
        }

        .research-session-findings-close {
            width: 32px;
            height: 32px;
            border: none;
            border-radius: 8px;
            background: #f3f4f6;
            color: #374151;
            cursor: pointer;
            font-size: 18px;
        }

        .research-session-findings-content {
            font-size: 14px;
            line-height: 1.65;
            color: #374151;
            white-space: pre-wrap;
        }

        .research-session-findings-content h1,
        .research-session-findings-content h2,
        .research-session-findings-content h3 {
            color: #111827;
        }
    `;

    document.head.appendChild(style);
}


function getResearchSessionContainer() {
    let container = document.getElementById("research-session-container");

    if (container) {
        return container;
    }

    const capsuleGrid = document.getElementById("capsule-grid");

    if (!capsuleGrid || !capsuleGrid.parentElement) {
        return null;
    }

    container = document.createElement("div");
    container.id = "research-session-container";
    container.className = "research-session-wrapper";

    capsuleGrid.parentElement.insertBefore(container, capsuleGrid);

    return container;
}


function renderResearchSessions() {
    ensureResearchSessionStyles();

    const container = getResearchSessionContainer();

    if (!container) {
        return;
    }

    chrome.storage.local.get({
                activeResearchSession: null,
                researchSessions: []
            },
            (res) => {
                const activeSession = res.activeResearchSession;
                const sessions = Array.isArray(res.researchSessions) ?
                    res.researchSessions : [];

                chrome.storage.local.get({
                            clips: []
                        },
                        (clipRes) => {
                            const clips = Array.isArray(clipRes.clips) ?
                                clipRes.clips : [];

                            let html = "";

                            if (activeSession) {
                                const sessionClipCount = clips.filter(
                                    clip =>
                                    clip &&
                                    clip.sessionId === activeSession.id
                                ).length;

                                html = `
                            <div class="research-session-card active">
                                <div class="research-session-top">
                                    <div>
                                        <div class="research-session-title">
                                            Research Session
                                        </div>

                                        <div class="research-session-active-name">
                                            ${escapeHtml(activeSession.name)}
                                        </div>

                                        <div class="research-session-status">
                                            <span class="research-session-status-dot"></span>
                                            Research session active
                                        </div>
                                    </div>
                                </div>

                                <div class="research-session-count">
                                    ${sessionClipCount}
                                    ${sessionClipCount === 1 ? "clip" : "clips"}
                                    collected in this session
                                </div>

                                <div class="research-session-actions">
                                    <button
                                        id="end-research-session-btn"
                                        class="research-session-button secondary"
                                    >
                                        End Session
                                    </button>

                                    <button
                                        id="synthesize-research-session-btn"
                                        class="research-session-button synthesize"
                                    >
                                        End &amp; Synthesize
                                    </button>
                                </div>
                            </div>
                        `;
                            } else {
                                html = `
                            <div class="research-session-card">
                                <div class="research-session-top">
                                    <div>
                                        <div class="research-session-title">
                                            Research Sessions
                                        </div>

                                        <div class="research-session-description">
                                            Start a focused research session.
                                            Every clip you create during the
                                            session will automatically belong
                                            to it.
                                        </div>
                                    </div>
                                </div>

                                <div class="research-session-actions">
                                    <button
                                        id="start-research-session-btn"
                                        class="research-session-button primary"
                                    >
                                        + Start Research Session
                                    </button>
                                </div>
                        `;

                                if (sessions.length > 0) {
                                    html += `
                                <div class="research-session-history">
                                    <div class="research-session-history-title">
                                        Previous Research Sessions
                                    </div>
                            `;

                                    sessions
                                        .slice()
                                        .reverse()
                                        .forEach(session => {
                                                const sessionClips = clips.filter(
                                                    clip =>
                                                    clip &&
                                                    clip.sessionId === session.id
                                                );

                                                html += `
                                        <div class="research-session-history-item">
                                            <div>
                                                <div class="research-session-history-name">
                                                    ${escapeHtml(session.name)}
                                                </div>

                                                <div class="research-session-history-meta">
                                                    ${formatSessionDate(session.endedAt || session.startedAt)}
                                                    ·
                                                    ${typeof session.clipCount === "number"
                                                        ? session.clipCount
                                                        : sessionClips.length}
                                                    ${sessionClips.length === 1 ? "clip" : "clips"}
                                                </div>
                                            </div>

                                            ${
                                                session.synthesis
                                                    ? `
                                                        <button
                                                            class="research-session-view-button"
                                                            data-view-session-id="${escapeHtml(session.id)}"
                                                        >
                                                            View Findings
                                                        </button>
                                                    `
                                                    : `
                                                        <span
                                                            style="
                                                                font-size:12px;
                                                                color:#9ca3af;
                                                            "
                                                        >
                                                            No synthesis
                                                        </span>
                                                    `
                                            }
                                        </div>
                                    `;
                                });

                            html += `</div>`;
                        }

                        html += `</div>`;
                    }

                    container.innerHTML = html;

                    attachResearchSessionListeners();
                }
            );
        }
    );
}


function attachResearchSessionListeners() {
    const startButton = document.getElementById(
        "start-research-session-btn"
    );

    if (startButton) {
        startButton.addEventListener("click", startResearchSession);
    }

    const endButton = document.getElementById(
        "end-research-session-btn"
    );

    if (endButton) {
        endButton.addEventListener("click", endResearchSession);
    }

    const synthesizeButton = document.getElementById(
        "synthesize-research-session-btn"
    );

    if (synthesizeButton) {
        synthesizeButton.addEventListener(
            "click",
            endAndSynthesizeResearchSession
        );
    }

    document
        .querySelectorAll("[data-view-session-id]")
        .forEach(button => {
            button.addEventListener("click", () => {
                const sessionId =
                    button.getAttribute("data-view-session-id");

                viewResearchSession(sessionId);
            });
        });
}


/* =========================================================
   START SESSION
========================================================= */

function startResearchSession() {
    chrome.storage.local.get(
        {
            activeResearchSession: null
        },
        (res) => {
            if (res.activeResearchSession) {
                alert("A research session is already active.");
                return;
            }

            const sessionName = prompt(
                "Enter a name for your research session:"
            );

            if (sessionName === null) {
                return;
            }

            const cleanName = sessionName.trim();

            if (!cleanName) {
                alert("Please enter a session name.");
                return;
            }

            const session = {
                id: createResearchSessionId(),
                name: cleanName,
                startedAt: Date.now()
            };

            chrome.storage.local.set(
                {
                    activeResearchSession: session
                },
                () => {
                    chrome.storage.local.get(
                        {
                            researchSessions: []
                        },
                        (sessionRes) => {
                            const sessions =
                                Array.isArray(sessionRes.researchSessions)
                                    ? sessionRes.researchSessions
                                    : [];

                            const sessionRecord = {
                                id: session.id,
                                name: session.name,
                                startedAt: session.startedAt,
                                endedAt: null,
                                status: "active",
                                synthesis: "",
                                clipCount: 0
                            };

                            chrome.storage.local.set(
                                {
                                    researchSessions: [
                                        ...sessions,
                                        sessionRecord
                                    ]
                                },
                                () => {
                                    alert(
                                        `Research session "${cleanName}" started.`
                                    );

                                    renderVault();
                                }
                            );
                        }
                    );
                }
            );
        }
    );
}


/* =========================================================
   END SESSION WITHOUT SYNTHESIS
========================================================= */

function endResearchSession() {
    chrome.storage.local.get(
        {
            activeResearchSession: null,
            researchSessions: [],
            clips: []
        },
        (res) => {
            const activeSession = res.activeResearchSession;

            if (!activeSession) {
                return;
            }

            const sessionClips = res.clips.filter(
                clip =>
                    clip &&
                    clip.sessionId === activeSession.id
            );

            const sessions = Array.isArray(res.researchSessions)
                ? res.researchSessions
                : [];

            const updatedSessions = sessions.map(session => {
                if (session.id === activeSession.id) {
                    return {
                        ...session,
                        endedAt: Date.now(),
                        status: "completed",
                        clipCount: sessionClips.length
                    };
                }

                return session;
            });

            chrome.storage.local.set(
                {
                    activeResearchSession: null,
                    researchSessions: updatedSessions
                },
                () => {
                    renderVault();
                }
            );
        }
    );
}


/* =========================================================
   END & SYNTHESIZE
========================================================= */

async function endAndSynthesizeResearchSession() {
    const button = document.getElementById(
        "synthesize-research-session-btn"
    );

    if (button) {
        button.disabled = true;
        button.textContent = "Synthesizing...";
    }

    chrome.storage.local.get(
        {
            activeResearchSession: null,
            clips: [],
            researchSessions: []
        },
        async (res) => {
            const activeSession = res.activeResearchSession;

            if (!activeSession) {
                if (button) {
                    button.disabled = false;
                    button.textContent = "End & Synthesize";
                }

                return;
            }

            const sessionClips = Array.isArray(res.clips)
                ? res.clips.filter(
                    clip =>
                        clip &&
                        clip.sessionId === activeSession.id
                )
                : [];

            if (sessionClips.length === 0) {
                alert(
                    "This research session has no clips yet. Create at least one clip before synthesizing."
                );

                if (button) {
                    button.disabled = false;
                    button.textContent = "End & Synthesize";
                }

                return;
            }

            try {
                const response = await fetch(
                    "http://localhost:3000/api/session",
                    {
                        method: "POST",
                        headers: {
                            "Content-Type": "application/json"
                        },
                        body: JSON.stringify({
                            sessionName: activeSession.name,
                            clips: sessionClips
                        })
                    }
                );

                if (!response.ok) {
                    let errorMessage =
                        "Research session synthesis failed.";

                    try {
                        const errorData =
                            await response.json();

                        if (
                            errorData &&
                            typeof errorData.error === "string"
                        ) {
                            errorMessage = errorData.error;
                        }
                    } catch (error) {
                        // Keep default error message.
                    }

                    throw new Error(errorMessage);
                }

                const data = await response.json();

                if (
                    !data ||
                    typeof data.result !== "string" ||
                    !data.result.trim()
                ) {
                    throw new Error(
                        "Gemini returned an empty research synthesis."
                    );
                }

                const sessions = Array.isArray(res.researchSessions)
                    ? res.researchSessions
                    : [];

                const updatedSessions = sessions.map(session => {
                    if (session.id === activeSession.id) {
                        return {
                            ...session,
                            endedAt: Date.now(),
                            status: "completed",
                            synthesis: data.result,
                            clipCount: sessionClips.length
                        };
                    }

                    return session;
                });

                chrome.storage.local.set(
                    {
                        activeResearchSession: null,
                        researchSessions: updatedSessions
                    },
                    () => {
                        renderVault();

                        showResearchSessionFindings({
                            ...activeSession,
                            endedAt: Date.now(),
                            status: "completed",
                            synthesis: data.result,
                            clipCount: sessionClips.length
                        });
                    }
                );

            } catch (error) {
                console.error(
                    "Context Capsule: Research session synthesis failed.",
                    error
                );

                alert(
                    error.message ||
                    "Research session synthesis failed."
                );

                if (button) {
                    button.disabled = false;
                    button.textContent = "End & Synthesize";
                }
            }
        }
    );
}


/* =========================================================
   VIEW SESSION FINDINGS
========================================================= */

function viewResearchSession(sessionId) {
    chrome.storage.local.get(
        {
            researchSessions: []
        },
        (res) => {
            const sessions = Array.isArray(res.researchSessions)
                ? res.researchSessions
                : [];

            const session = sessions.find(
                item => item.id === sessionId
            );

            if (!session) {
                alert("Research session could not be found.");
                return;
            }

            showResearchSessionFindings(session);
        }
    );
}


function showResearchSessionFindings(session) {
    ensureResearchSessionStyles();

    const existing =
        document.getElementById(
            "research-session-findings-overlay"
        );

    if (existing) {
        existing.remove();
    }

    const overlay = document.createElement("div");
    overlay.id =
        "research-session-findings-overlay";

    overlay.className =
        "research-session-findings-overlay";

    overlay.innerHTML = `
        <div class="research-session-findings-modal">
            <div class="research-session-findings-header">
                <div>
                    <div class="research-session-findings-title">
                        ${escapeHtml(session.name)}
                    </div>

                    <div class="research-session-findings-date">
                        ${formatSessionDate(
                            session.endedAt ||
                            session.startedAt
                        )}
                        ·
                        ${session.clipCount || 0}
                        ${(session.clipCount || 0) === 1
                            ? "clip"
                            : "clips"}
                    </div>
                </div>

                <button
                    id="close-research-session-findings"
                    class="research-session-findings-close"
                >
                    ×
                </button>
            </div>

            <div class="research-session-findings-content">
                ${
                    session.synthesis
                        ? escapeHtml(session.synthesis)
                        : "No synthesis was generated for this session."
                }
            </div>
        </div>
    `;

    document.body.appendChild(overlay);

    const closeButton = document.getElementById(
        "close-research-session-findings"
    );

    if (closeButton) {
        closeButton.addEventListener("click", () => {
            overlay.remove();
        });
    }

    overlay.addEventListener("click", event => {
        if (event.target === overlay) {
            overlay.remove();
        }
    });
}


/* =========================================================
   SIDEBAR
========================================================= */

function renderSidebar(
    categories,
    categoryColors,
    folders,
    activeFolder
) {
    const categoryList =
        document.getElementById("category-list");

    if (!categoryList) {
        return;
    }

    categoryList.innerHTML = "";

    categories.forEach(category => {
        const item = document.createElement("div");

        item.className =
            "category-item" +
            (currentFilter === category
                ? " active"
                : "");

        item.dataset.category = category;

        const color =
            categoryColors[category] ||
            defaultColors[category] ||
            fallbackColors[
                categories.indexOf(category) %
                fallbackColors.length
            ];

        item.innerHTML = `
            <span
                style="
                    width:8px;
                    height:8px;
                    border-radius:50%;
                    background:${color};
                    display:inline-block;
                    margin-right:8px;
                "
            ></span>

            <span>${escapeHtml(category)}</span>
        `;

        categoryList.appendChild(item);
    });

    if (folders && Array.isArray(folders)) {
        const folderList =
            document.getElementById("folder-list");

        if (folderList) {
            folderList.innerHTML = "";

            folders.forEach(folder => {
                const item =
                    document.createElement("div");

                item.className =
                    "folder-item" +
                    (activeFolder === folder
                        ? " active"
                        : "");

                item.dataset.folder = folder;

                item.textContent = folder;

                folderList.appendChild(item);
            });
        }
    }
}


/* =========================================================
   WORKSPACE
========================================================= */

function attachWorkspaceListeners() {
    const workspaceButton =
        document.getElementById("workspace-button");

    const workspaceDropdown =
        document.getElementById("workspace-dropdown");

    if (
        workspaceButton &&
        workspaceDropdown
    ) {
        workspaceButton.onclick = () => {
            workspaceDropdown.classList.toggle("show");
        };
    }
}


/* =========================================================
   SIDEBAR LISTENERS
========================================================= */

function attachSidebarListeners() {
    document
        .querySelectorAll(".category-item")
        .forEach(item => {
            item.addEventListener("click", () => {
                currentFilter =
                    item.dataset.category || "All";

                renderVault();
            });
        });

    document
        .querySelectorAll(".folder-item")
        .forEach(item => {
            item.addEventListener("click", () => {
                const folder =
                    item.dataset.folder;

                chrome.storage.local.set(
                    {
                        activeFolder: folder
                    },
                    () => {
                        renderVault();
                    }
                );
            });
        });
}


/* =========================================================
   ADD CATEGORY
========================================================= */

function attachAddCategoryListener() {
    const input =
        document.getElementById("new-category-input");

    if (!input) {
        return;
    }

    input.onkeydown = event => {
        if (event.key !== "Enter") {
            return;
        }

        const category =
            input.value.trim();

        if (!category) {
            return;
        }

        chrome.storage.local.get(
            {
                customCategories: []
            },
            res => {
                const categories =
                    Array.isArray(
                        res.customCategories
                    )
                        ? res.customCategories
                        : [];

                if (!categories.includes(category)) {
                    categories.push(category);
                }

                chrome.storage.local.set(
                    {
                        customCategories: categories
                    },
                    () => {
                        input.value = "";
                        renderVault();
                    }
                );
            }
        );
    };
}


/* =========================================================
   ELABORATE MODAL
========================================================= */

function setupElaborateModal() {
    const closeButton =
        document.getElementById(
            "close-modal-btn"
        );

    const modal =
        document.getElementById(
            "elaborate-modal"
        );

    if (!closeButton || !modal) {
        return;
    }

    closeButton.onclick = () => {
        modal.style.display = "none";
    };

    modal.onclick = event => {
        if (event.target === modal) {
            modal.style.display = "none";
        }
    };
}


function openElaborateModal(clip) {
    const modal =
        document.getElementById(
            "elaborate-modal"
        );

    const body =
        document.getElementById(
            "modal-body-content"
        );

    if (!modal || !body) {
        return;
    }

    body.innerHTML = `
        <div style="margin-bottom:18px;">
            <div
                style="
                    font-size:12px;
                    color:#6b7280;
                    margin-bottom:6px;
                "
            >
                SOURCE
            </div>

            <div
                style="
                    font-size:13px;
                    font-weight:600;
                    color:#111827;
                "
            >
                ${escapeHtml(clip.title || "Untitled")}
            </div>
        </div>

        <div style="margin-bottom:18px;">
            <div
                style="
                    font-size:12px;
                    color:#6b7280;
                    margin-bottom:6px;
                "
            >
                SELECTED TEXT
            </div>

            <div
                style="
                    font-size:14px;
                    line-height:1.6;
                    color:#374151;
                "
            >
                ${escapeHtml(clip.text || "")}
            </div>
        </div>

        <div style="margin-bottom:18px;">
            <div
                style="
                    font-size:12px;
                    color:#6b7280;
                    margin-bottom:6px;
                "
            >
                CONTEXT
            </div>

            <div
                style="
                    font-size:13px;
                    line-height:1.6;
                    color:#6b7280;
                "
            >
                ${escapeHtml(clip.context || "No context available.")}
            </div>
        </div>

        <div
            style="
                display:flex;
                gap:8px;
                flex-wrap:wrap;
            "
        >
            <button
                class="modal-ai-button"
                data-action="summarize"
            >
                Summarize
            </button>

            <button
                class="modal-ai-button"
                data-action="explain"
            >
                Explain
            </button>
        </div>

        <div
            id="modal-ai-result"
            style="
                margin-top:18px;
                font-size:14px;
                line-height:1.6;
                color:#374151;
            "
        ></div>
    `;

    modal.style.display = "flex";

    body
        .querySelectorAll(".modal-ai-button")
        .forEach(button => {
            button.addEventListener("click", () => {
                executeModalAI(
                    clip,
                    button.dataset.action
                );
            });
        });
}


async function executeModalAI(
    clip,
    actionType
) {
    const result =
        document.getElementById(
            "modal-ai-result"
        );

    if (!result) {
        return;
    }

    result.textContent = "Thinking...";

    try {
        const response = await fetch(
            "http://localhost:3000/api/ai",
            {
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

        if (!response.ok) {
            throw new Error(
                `AI API returned status ${response.status}`
            );
        }

        const data =
            await response.json();

        result.textContent =
            data.result ||
            data.response ||
            "No response received.";

    } catch (error) {
        console.error(
            "Context Capsule: AI request failed.",
            error
        );

        result.textContent =
            "AI request failed. Please make sure the server is running.";
    }
}


/* =========================================================
   CARD LISTENERS
========================================================= */

function attachCardListeners(clips) {
    document
        .querySelectorAll(".clip-card")
        .forEach(card => {
            const clipId =
                Number(card.dataset.clipId);

            const clip =
                clips.find(item =>
                    item.id === clipId
                );

            if (!clip) {
                return;
            }

            card.addEventListener("click", event => {
                if (
                    event.target.closest("button") ||
                    event.target.closest("select") ||
                    event.target.closest("a")
                ) {
                    return;
                }

                openElaborateModal(clip);
            });
        });


    document
        .querySelectorAll(".clip-tag-select")
        .forEach(select => {
            select.addEventListener("change", event => {
                const clipId =
                    Number(
                        event.target.dataset.clipId
                    );

                const tag =
                    event.target.value;

                chrome.storage.local.get(
                    {
                        clips: []
                    },
                    res => {
                        const updated =
                            res.clips.map(clip => {
                                if (
                                    clip.id === clipId
                                ) {
                                    return {
                                        ...clip,
                                        tag: tag
                                    };
                                }

                                return clip;
                            });

                        chrome.storage.local.set({
                            clips: updated
                        });
                    }
                );
            });
        });


    document
        .querySelectorAll(".clip-folder-select")
        .forEach(select => {
            select.addEventListener("change", event => {
                const clipId =
                    Number(
                        event.target.dataset.clipId
                    );

                const folder =
                    event.target.value;

                chrome.storage.local.get(
                    {
                        clips: []
                    },
                    res => {
                        const updated =
                            res.clips.map(clip => {
                                if (
                                    clip.id === clipId
                                ) {
                                    return {
                                        ...clip,
                                        folder: folder
                                    };
                                }

                                return clip;
                            });

                        chrome.storage.local.set({
                            clips: updated
                        });
                    }
                );
            });
        });


    document
        .querySelectorAll(".teleport-btn")
        .forEach(button => {
            button.addEventListener("click", event => {
                event.stopPropagation();

                const clipId =
                    Number(
                        button.dataset.clipId
                    );

                const clip =
                    clips.find(item =>
                        item.id === clipId
                    );

                if (!clip) {
                    return;
                }

                chrome.runtime.sendMessage({
                    action: "teleport",
                    url: clip.url,
                    text: clip.text
                });
            });
        });


    document
        .querySelectorAll(".share-btn")
        .forEach(button => {
            button.addEventListener("click", async event => {
                event.stopPropagation();

                const clipId =
                    Number(
                        button.dataset.clipId
                    );

                const clip =
                    clips.find(item =>
                        item.id === clipId
                    );

                if (!clip) {
                    return;
                }

                const shareText =
                    `"${clip.text}"\n\n${clip.title}\n${clip.url}`;

                try {
                    await navigator.clipboard.writeText(
                        shareText
                    );

                    alert("Clip copied for sharing.");
                } catch (error) {
                    console.error(error);
                }
            });
        });


    document
        .querySelectorAll(".apa-btn")
        .forEach(button => {
            button.addEventListener("click", event => {
                event.stopPropagation();

                const clipId =
                    Number(
                        button.dataset.clipId
                    );

                const clip =
                    clips.find(item =>
                        item.id === clipId
                    );

                if (!clip) {
                    return;
                }

                const date =
                    new Date(
                        clip.timestamp
                    );

                const year =
                    isNaN(date.getTime())
                        ? "n.d."
                        : date.getFullYear();

                const citation =
                    `${clip.title || "Untitled"}. (${year}). ${clip.url}`;

                navigator.clipboard
                    .writeText(citation)
                    .then(() => {
                        alert(
                            "APA citation copied."
                        );
                    })
                    .catch(error => {
                        console.error(error);
                    });
            });
        });


    document
        .querySelectorAll(".delete-btn")
        .forEach(button => {
            button.addEventListener("click", event => {
                event.stopPropagation();

                const clipId =
                    Number(
                        button.dataset.clipId
                    );

                chrome.storage.local.get(
                    {
                        clips: []
                    },
                    res => {
                        const updated =
                            res.clips.filter(
                                clip =>
                                    clip.id !== clipId
                            );

                        chrome.storage.local.set(
                            {
                                clips: updated
                            }
                        );
                    }
                );
            });
        });
}


/* =========================================================
   RENDER VAULT
========================================================= */

function renderVault() {
    chrome.storage.local.get(
        {
            clips: [],
            customCategories: [],
            categoryColors: {},
            folders: [],
            activeFolder: "All"
        },
        res => {
            const clips =
                Array.isArray(res.clips)
                    ? res.clips
                    : [];

            globalClips = clips;

            const customCategories =
                Array.isArray(
                    res.customCategories
                )
                    ? res.customCategories
                    : [];

            const categoryColors =
                res.categoryColors || {};

            const folders =
                Array.isArray(res.folders)
                    ? res.folders
                    : [];

            const activeFolder =
                res.activeFolder || "All";

            const categories = [
                "All",
                ...defaultCategories,
                ...customCategories.filter(
                    category =>
                        !defaultCategories.includes(
                            category
                        )
                )
            ];


            /* Workspace */

            const workspaceTitle =
                document.getElementById(
                    "workspace-title"
                );

            if (workspaceTitle) {
                workspaceTitle.textContent =
                    activeFolder === "All"
                        ? "All Clips"
                        : activeFolder;
            }


            /* Sidebar */

            renderSidebar(
                categories,
                categoryColors,
                folders,
                activeFolder
            );


            /* Filtering */

            let filteredClips =
                clips.slice();

            if (currentFilter !== "All") {
                filteredClips =
                    filteredClips.filter(
                        clip =>
                            clip.tag ===
                            currentFilter
                    );
            }

            if (
                activeFolder &&
                activeFolder !== "All"
            ) {
                filteredClips =
                    filteredClips.filter(
                        clip =>
                            clip.folder ===
                            activeFolder
                    );
            }


            /* Main title */

            const pageTitle =
                document.getElementById(
                    "page-title"
                );

            if (pageTitle) {
                pageTitle.textContent =
                    currentFilter === "All"
                        ? "All Clips"
                        : currentFilter;
            }


            /* Capsule grid */

            const grid =
                document.getElementById(
                    "capsule-grid"
                );

            if (!grid) {
                renderResearchSessions();
                return;
            }


            if (filteredClips.length === 0) {
                grid.innerHTML = `
                    <div
                        style="
                            grid-column:1/-1;
                            padding:50px;
                            text-align:center;
                            color:#9ca3af;
                        "
                    >
                        No clips found.
                    </div>
                `;

                attachSidebarListeners();
                attachWorkspaceListeners();
                attachAddCategoryListener();
                setupElaborateModal();
                renderResearchSessions();

                return;
            }


            /* Date grouping */

            const grouped = {
                Today: [],
                Yesterday: [],
                "Last 7 Days": [],
                Older: []
            };

            filteredClips.forEach(clip => {
                const group =
                    getDateGroup(
                        clip.timestamp
                    );

                if (!grouped[group]) {
                    grouped[group] = [];
                }

                grouped[group].push(clip);
            });


            const groupConfig = [
                {
                    name: "Today",
                    expanded: true
                },
                {
                    name: "Yesterday",
                    expanded: true
                },
                {
                    name: "Last 7 Days",
                    expanded: false
                },
                {
                    name: "Older",
                    expanded: false
                }
            ];


            let html = "";


            groupConfig.forEach(group => {
                const groupClips =
                    grouped[group.name] || [];

                if (groupClips.length === 0) {
                    return;
                }

                html += `
                    <div
                        class="date-group"
                        data-group="${escapeHtml(group.name)}"
                        style="
                            grid-column:1/-1;
                            margin-bottom:18px;
                        "
                    >
                        <div
                            class="date-group-header"
                            style="
                                display:flex;
                                align-items:center;
                                gap:8px;
                                cursor:pointer;
                                margin-bottom:12px;
                                user-select:none;
                            "
                        >
                            <span
                                class="date-group-arrow"
                                style="
                                    display:inline-block;
                                    transition:transform .2s;
                                    transform:rotate(${group.expanded ? "90deg" : "0deg"});
                                "
                            >
                                ›
                            </span>

                            <span
                                style="
                                    font-size:13px;
                                    font-weight:700;
                                    color:#6b7280;
                                "
                            >
                                ${escapeHtml(group.name)}
                            </span>

                            <span
                                style="
                                    font-size:11px;
                                    color:#9ca3af;
                                "
                            >
                                ${groupClips.length}
                            </span>
                        </div>

                        <div
                            class="date-group-content"
                            style="
                                display:${group.expanded ? "grid" : "none"};
                                grid-template-columns:repeat(auto-fill,minmax(280px,1fr));
                                gap:16px;
                            "
                        >
                `;


                groupClips.forEach(clip => {
                    const confidence =
                        getConfidenceDisplay(
                            clip
                        );

                    const tag =
                        clip.tag ||
                        "Evidence";

                    const folder =
                        clip.folder ||
                        "No folder";

                    html += `
                        <div
                            class="clip-card"
                            data-clip-id="${clip.id}"
                            style="
                                position:relative;
                                background:#ffffff;
                                border:1px solid #e5e7eb;
                                border-radius:14px;
                                padding:18px;
                                cursor:pointer;
                                box-sizing:border-box;
                            "
                        >

                            <div
                                style="
                                    display:flex;
                                    justify-content:space-between;
                                    align-items:flex-start;
                                    gap:10px;
                                    margin-bottom:10px;
                                "
                            >
                                <div
                                    style="
                                        font-size:12px;
                                        font-weight:600;
                                        color:#6b7280;
                                        overflow:hidden;
                                        text-overflow:ellipsis;
                                        white-space:nowrap;
                                    "
                                    title="${escapeHtml(clip.title || "")}"
                                >
                                    ${escapeHtml(
                                        clip.title ||
                                        "Untitled"
                                    )}
                                </div>

                                <span
                                    title="${escapeHtml(confidence.tooltip)}"
                                    style="
                                        width:9px;
                                        height:9px;
                                        min-width:9px;
                                        border-radius:50%;
                                        background:${confidence.color};
                                        display:inline-block;
                                    "
                                ></span>
                            </div>


                            <div
                                style="
                                    font-size:14px;
                                    line-height:1.55;
                                    color:#111827;
                                    margin-bottom:12px;
                                "
                            >
                                ${escapeHtml(
                                    clip.text || ""
                                )}
                            </div>


                            <div
                                style="
                                    font-size:12px;
                                    line-height:1.5;
                                    color:#6b7280;
                                    margin-bottom:14px;
                                "
                            >
                                ${escapeHtml(
                                    clip.context ||
                                    "No surrounding context available."
                                )}
                            </div>


                            <div
                                style="
                                    display:flex;
                                    gap:7px;
                                    flex-wrap:wrap;
                                    margin-bottom:12px;
                                "
                            >
                                <select
                                    class="clip-tag-select"
                                    data-clip-id="${clip.id}"
                                    style="
                                        border:1px solid #e5e7eb;
                                        border-radius:7px;
                                        padding:5px 7px;
                                        font-size:11px;
                                        background:#ffffff;
                                    "
                                >
                                    ${categories
                                        .filter(
                                            category =>
                                                category !==
                                                "All"
                                        )
                                        .map(
                                            category =>
                                                `
                                                <option
                                                    value="${escapeHtml(category)}"
                                                    ${tag === category ? "selected" : ""}
                                                >
                                                    ${escapeHtml(category)}
                                                </option>
                                                `
                                        )
                                        .join("")}
                                </select>

                                ${
                                    folders.length > 0
                                        ? `
                                            <select
                                                class="clip-folder-select"
                                                data-clip-id="${clip.id}"
                                                style="
                                                    border:1px solid #e5e7eb;
                                                    border-radius:7px;
                                                    padding:5px 7px;
                                                    font-size:11px;
                                                    background:#ffffff;
                                                "
                                            >
                                                <option value="">
                                                    No folder
                                                </option>

                                                ${folders
                                                    .map(
                                                        folderName =>
                                                            `
                                                            <option
                                                                value="${escapeHtml(folderName)}"
                                                                ${folder === folderName ? "selected" : ""}
                                                            >
                                                                ${escapeHtml(folderName)}
                                                            </option>
                                                            `
                                                    )
                                                    .join("")}
                                            </select>
                                        `
                                        : ""
                                }
                            </div>


                            <div
                                style="
                                    display:flex;
                                    justify-content:space-between;
                                    align-items:center;
                                    gap:8px;
                                "
                            >
                                <div
                                    style="
                                        display:flex;
                                        gap:6px;
                                    "
                                >
                                    <button
                                        class="teleport-btn"
                                        data-clip-id="${clip.id}"
                                        title="Jump to original source"
                                        style="
                                            border:none;
                                            background:#f3f4f6;
                                            border-radius:7px;
                                            padding:6px 9px;
                                            cursor:pointer;
                                            font-size:11px;
                                        "
                                    >
                                        Jump
                                    </button>

                                    <button
                                        class="share-btn"
                                        data-clip-id="${clip.id}"
                                        title="Share clip"
                                        style="
                                            border:none;
                                            background:#f3f4f6;
                                            border-radius:7px;
                                            padding:6px 9px;
                                            cursor:pointer;
                                            font-size:11px;
                                        "
                                    >
                                        Share
                                    </button>

                                    <button
                                        class="apa-btn"
                                        data-clip-id="${clip.id}"
                                        title="Copy APA citation"
                                        style="
                                            border:none;
                                            background:#f3f4f6;
                                            border-radius:7px;
                                            padding:6px 9px;
                                            cursor:pointer;
                                            font-size:11px;
                                        "
                                    >
                                        APA
                                    </button>
                                </div>

                                <button
                                    class="delete-btn"
                                    data-clip-id="${clip.id}"
                                    title="Delete clip"
                                    style="
                                        border:none;
                                        background:#fee2e2;
                                        color:#dc2626;
                                        border-radius:7px;
                                        padding:6px 9px;
                                        cursor:pointer;
                                        font-size:11px;
                                    "
                                >
                                    Delete
                                </button>
                            </div>

                        </div>
                    `;
                });


                html += `
                        </div>
                    </div>
                `;
            });


            grid.innerHTML = html;


            /* Date group collapse / expand */

            document
                .querySelectorAll(".date-group-header")
                .forEach(header => {
                    header.addEventListener(
                        "click",
                        () => {
                            const group =
                                header.closest(
                                    ".date-group"
                                );

                            if (!group) {
                                return;
                            }

                            const content =
                                group.querySelector(
                                    ".date-group-content"
                                );

                            const arrow =
                                group.querySelector(
                                    ".date-group-arrow"
                                );

                            if (!content) {
                                return;
                            }

                            const isOpen =
                                content.style.display !==
                                "none";

                            content.style.display =
                                isOpen
                                    ? "none"
                                    : "grid";

                            if (arrow) {
                                arrow.style.transform =
                                    isOpen
                                        ? "rotate(0deg)"
                                        : "rotate(90deg)";
                            }
                        }
                    );
                });


            attachCardListeners(clips);
            attachSidebarListeners();
            attachWorkspaceListeners();
            attachAddCategoryListener();
            setupElaborateModal();

            renderResearchSessions();
        }
    );
}


/* =========================================================
   STORAGE CHANGES
========================================================= */

chrome.storage.onChanged.addListener(
    (changes, areaName) => {
        if (areaName !== "local") {
            return;
        }

        if (
            changes.clips ||
            changes.customCategories ||
            changes.categoryColors ||
            changes.folders ||
            changes.activeFolder ||
            changes.activeResearchSession ||
            changes.researchSessions
        ) {
            renderVault();
        }
    }
);


/* =========================================================
   INITIAL LOAD
========================================================= */

document.addEventListener(
    "DOMContentLoaded",
    () => {
        renderVault();
    }
);
