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

    // ------------------------------------------
    // Get the currently active research session
    // ------------------------------------------

    chrome.storage.local.get({
            clips: [],
            activeResearchSession: null
        },
        (res) => {

            // ------------------------------------------
            // Create the clip exactly as before
            // ------------------------------------------

            const clipData = {
                id: Date.now(),
                text: selectedText.trim(),
                context: parentText.slice(0, 300),
                title: document.title,
                url: cleanBaseUrl,
                teleportUrl: teleportUrl,
                timestamp: new Date().toLocaleDateString(),
                tag: "Evidence",

                // Initial confidence.
                // This is immediately replaced if the backend successfully evaluates it.
                confidence: {
                    level: "grey",
                    reason: "Not enough information to evaluate."
                }
            };

            // ------------------------------------------
            // Attach the clip to the active research session
            // ------------------------------------------

            if (
                res.activeResearchSession &&
                typeof res.activeResearchSession.id === "string"
            ) {
                clipData.sessionId = res.activeResearchSession.id;
            }

            // ------------------------------------------
            // Save the clip
            // ------------------------------------------

            const updated = [clipData, ...res.clips];

            chrome.storage.local.set({ clips: updated }, () => {

                // IMPORTANT:
                // The clip is already saved before confidence analysis starts.
                alert("Clipped to Context Capsule!");

                // Ask the background service worker to evaluate confidence.
                // If this fails, the saved clip remains untouched.
                chrome.runtime.sendMessage({
                    action: "analyzeConfidence",
                    clipId: clipData.id,
                    text: clipData.text,
                    title: clipData.title,
                    url: clipData.url
                });
            });
        }
    );
}


// ------------------------------------------
// SOURCE CONFIDENCE ANALYSIS
// ------------------------------------------

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {

    if (request.action === "analyzeConfidence") {

        fetch("http://localhost:3000/api/confidence", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    text: request.text,
                    title: request.title,
                    url: request.url
                })
            })
            .then(response => {

                if (!response.ok) {
                    throw new Error(
                        `Confidence API returned status ${response.status}`
                    );
                }

                return response.json();
            })
            .then(confidence => {

                const validLevels = ["green", "yellow", "grey"];

                const level = validLevels.includes(confidence.level) ?
                    confidence.level :
                    "grey";

                const reason =
                    typeof confidence.reason === "string" ?
                    confidence.reason :
                    "The source could not be evaluated reliably.";

                // Get the latest clips so we don't overwrite
                // any changes made after the original clip was saved.
                chrome.storage.local.get({ clips: [] }, (res) => {

                    const updatedClips = res.clips.map((clip) => {

                        if (clip.id === request.clipId) {

                            return {
                                ...clip,
                                confidence: {
                                    level: level,
                                    reason: reason
                                }
                            };

                        }

                        return clip;
                    });

                    chrome.storage.local.set({
                        clips: updatedClips
                    });
                });

            })
            .catch(error => {

                console.warn(
                    "Context Capsule: Confidence analysis failed.",
                    error
                );

                // IMPORTANT:
                // Do NOT delete or modify the clip if confidence analysis fails.
                // It already has the initial grey confidence value.

            });

        return true;
    }


    // ------------------------------------------
    // EXISTING TELEPORT FEATURE
    // ------------------------------------------

    if (request.action === "teleport") {
        const cleanUrl = request.url.split("#")[0];

        chrome.tabs.create({ url: cleanUrl }, (tab) => {
            const onTabUpdated = (tabId, info) => {
                if (tabId === tab.id && info.status === "complete") {
                    chrome.tabs.onUpdated.removeListener(onTabUpdated);

                    setTimeout(() => {
                        chrome.scripting.executeScript({
                            target: { tabId: tab.id },
                            func: highlightExactSnippet,
                            args: [request.text]
                        }).catch(err => console.error("Scripting error:", err));
                    }, 400);
                }
            };

            chrome.tabs.onUpdated.addListener(onTabUpdated);
        });
    }
});

function highlightExactSnippet(targetText) {
    if (!targetText) return;

    const sel = window.getSelection();

    // Move search cursor to the top of the document
    sel.removeAllRanges();

    let startNode = null,
        startOffset = 0;
    let endNode = null,
        endOffset = 0;
    const cleanText = targetText.trim();

    if (cleanText.length <= 60) {
        // Search the whole phrase if it's short
        if (window.find(cleanText, false, false, true, false, true, false)) {
            const range = sel.getRangeAt(0);
            startNode = range.startContainer;
            startOffset = range.startOffset;
            endNode = range.endContainer;
            endOffset = range.endOffset;
        }
    } else {
        // For long paragraphs, search the first 30 chars to find the start boundary...
        const startChunk = cleanText.slice(0, 30);
        if (window.find(startChunk, false, false, true, false, true, false)) {
            const range = sel.getRangeAt(0);
            startNode = range.startContainer;
            startOffset = range.startOffset;

            // ...then search the last 30 chars to find the end boundary (searches forward automatically)
            const endChunk = cleanText.slice(-30);
            if (window.find(endChunk, false, false, true, false, true, false)) {
                const range2 = sel.getRangeAt(0);
                endNode = range2.endContainer;
                endOffset = range2.endOffset;
            }
        }
    }

    // CRITICAL: Clear the native browser search selection (this removes the unwanted blue highlight)
    sel.removeAllRanges();

    if (startNode && endNode) {
        try {
            // Construct a custom range spanning the entire selected paragraph
            const finalRange = document.createRange();
            finalRange.setStart(startNode, startOffset);
            finalRange.setEnd(endNode, endOffset);

            // Apply the Custom CSS Highlight (Yellow)
            if (!document.getElementById("capsule-style")) {
                const style = document.createElement("style");
                style.id = "capsule-style";
                style.textContent = `
          ::highlight(capsule-target) {
            background-color: #fde047 !important;
            color: #000000 !important;
          }
        `;
                document.head.appendChild(style);
            }

            if ("Highlight" in window && "highlights" in CSS) {
                CSS.highlights.clear();
                const highlight = new Highlight(finalRange);
                CSS.highlights.set("capsule-target", highlight);
            }

            // Smoothly scroll to the highlighted text
            if (startNode.parentElement) {
                startNode.parentElement.scrollIntoView({ behavior: "smooth", block: "center" });
            }
        } catch (err) {
            console.warn("Context Capsule: Range error", err);
        }
    }
}
