// ==UserScript==
// @name         Wayfarer Map Mods - Review History
// @version      0.1.0
// @description  Display Review History from "Review History IDB" on Wayfarer Map
// @namespace    https://gitlab.com/Tntnnbltn/wayfarer-addons
// @downloadURL  https://gitlab.com/Tntnnbltn/wayfarer-addons/-/raw/main/wayfarer-map-mods-review-history.user.js
// @updateURL    https://gitlab.com/Tntnnbltn/wayfarer-addons/-/raw/main/wayfarer-map-mods-review-history.user.js
// @homepageURL  https://gitlab.com/Tntnnbltn/wayfarer-addons
// @match        https://wayfarer.nianticlabs.com/*
// @run-at       document-start
// ==/UserScript==

// Copyright 2026 tntnnbltn

// This script is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.

// This script is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU General Public License for more details.

// You can find a copy of the GNU General Public License in the root
// directory of this script's GitHub repository:
// <https://gitlab.com/Tntnnbltn/wayfarer-addons/-/blob/main/LICENSE>
// If not, see <https://www.gnu.org/licenses/>.

(() => {
    "use strict";

    // ----------------------------
    // Routes
    // ----------------------------
    const SUBMIT_ROUTE = "/new/submit/new";
    const MAPVIEW_ROUTE = "/new/mapview";

    function getPath() {
        return window.location.pathname || "";
    }

    function isOnSubmitRoute() {
        return getPath().startsWith(SUBMIT_ROUTE);
    }

    function isOnMapviewRoute() {
        return getPath().startsWith(MAPVIEW_ROUTE);
    }

    // ----------------------------
    // IndexedDB
    // ----------------------------
    const DB_NAME = "wayfarer-tools-db";
    const STORE_NAME = "reviewHistory";

    let reviewImageMapPromise = null;

    function openReviewHistoryDb() {
        return new Promise((resolve, reject) => {
            if (!window.indexedDB) {
                reject(new Error("IndexedDB is not available."));
                return;
            }

            const req = indexedDB.open(DB_NAME);

            req.onerror = () => reject(req.error || new Error("Could not open IndexedDB."));
            req.onsuccess = () => resolve(req.result);
        });
    }

    function getAllFromStore(db, storeName) {
        return new Promise((resolve, reject) => {
            if (!db.objectStoreNames.contains(storeName)) {
                resolve([]);
                return;
            }

            const tx = db.transaction([storeName], "readonly");
            const store = tx.objectStore(storeName);
            const req = store.getAll();

            req.onerror = () => reject(req.error || new Error("Could not read reviewHistory."));
            req.onsuccess = () => resolve(Array.isArray(req.result) ? req.result : []);
        });
    }

    async function loadReviewImageMap() {
        const db = await openReviewHistoryDb();

        try {
            const records = await getAllFromStore(db, STORE_NAME);
            const map = new Map();

            for (const record of records) {
                if (!record || record.type !== "NEW") continue;
                if (!record.imageUrl) continue;

                const key = normaliseImageUrl(record.imageUrl);
                if (!key) continue;

                const existing = map.get(key);

                // Keep newest if duplicate imageUrl records exist.
                if (!existing || Number(record.ts || 0) > Number(existing.ts || 0)) {
                    map.set(key, record);
                }
            }

            return map;
        } finally {
            db.close();
        }
    }

    function getReviewImageMap() {
        if (!reviewImageMapPromise) {
            reviewImageMapPromise = loadReviewImageMap().catch(err => {
                console.warn("[WF Review History] Failed to load review history:", err);
                reviewImageMapPromise = null;
                return new Map();
            });
        }

        return reviewImageMapPromise;
    }

    // ----------------------------
    // Image / POI matching
    // ----------------------------
    function normaliseImageUrl(url) {
        if (typeof url !== "string" || !url.trim()) return "";

        let out = url.trim();

        out = out.split("#")[0].split("?")[0];

        // Remove common Google image sizing suffixes.
        out = out.replace(/=s\d+.*$/i, "");
        out = out.replace(/=w\d+.*$/i, "");
        out = out.replace(/=h\d+.*$/i, "");

        return out;
    }

    function normalisePoiId(id) {
        if (typeof id !== "string") return "";

        return id
            .trim()
            .toLowerCase()
            .replace(/\.\d+$/, "");
    }

    function samePoiId(a, b) {
        return !!a && !!b && normalisePoiId(a) === normalisePoiId(b);
    }

    function findReviewByImage(imageMap, imageUrl) {
        if (!imageMap || !imageUrl) return null;
        return imageMap.get(normaliseImageUrl(imageUrl)) || null;
    }

    function isDuplicateReview(record) {
        return record?.review &&
            typeof record.review === "object" &&
            record.review.duplicate === true;
    }

    function isViewingDuplicateTarget(record, poiGuid) {
        if (!isDuplicateReview(record)) return false;

        const duplicateOf = record?.review?.duplicateOf;
        if (!duplicateOf || !poiGuid) return false;

        return samePoiId(duplicateOf, poiGuid);
    }

    function showReviewIfAllowed(record, poiGuid) {
        if (!record) return false;

        // If I marked a nomination as duplicate of this current POI,
        // do not show that review history on the duplicate target.
        if (isViewingDuplicateTarget(record, poiGuid)) {
            clearReviewRow();
            return false;
        }

        showReviewRow(record);
        return true;
    }

    // ----------------------------
    // Review outcome parsing
    // ----------------------------
    const REJECTION_MAPPINGS = {
        PHOTO_BAD_BLURRY: "Blurry Photo",
        PHOTO_FACE: "Face or body parts",
        PHOTO_PLATE: "License plate",
        PHOTO_DIR: "Orientation",
        PHOTO_TAG: "Submitter identifiable",
        PHOTO_3P: "Third party photo",
        PHOTO_WATERMARK: "Watermark",
        PHOTO_BAD: "Low quality or inaccurate photo",
        EMOJI_TITLE: "Emoji or emoticon in title",
        MARKUP_TITLE: "URL or markup in title",
        TEXT_BAD_TITLE: "Low quality or inaccurate title",
        EMOJI_DESCRIPTION: "Emoji or emoticon in description",
        MARKUP_DESCRIPTION: "URL or markup in description",
        TEXT_BAD_DESCRIPTION: "Low quality or inaccurate description",
        ACCURACY_FAKE: "Fake nomination",
        ACCURACY_EXPLICIT: "Explicit content",
        ACCURACY_PERSONAL: "Influencing reviewers",
        ACCURACY_OFFENSIVE: "Offensive",
        ACCURACY_ABUSE: "Other abuse-related reasons",
        MISMATCH: "Inaccurate location",
        PRIVATE: "Private property",
        INAPPROPRIATE: "Adult location",
        SCHOOL: "School",
        SENSITIVE: "Sensitive location",
        EMERGENCY: "Obstructs emergency operations",
        GENERIC: "Generic business",
        "": "(Blank)"
    };

    function getReviewOutcome(record) {
        const review = record?.review;

        if (!review || review === "skipped") {
            return {
                status: "skipped",
                emoji: "",
                title: ""
            };
        }

        if (typeof review !== "object") {
            return {
                status: "skipped",
                emoji: "",
                title: ""
            };
        }

        if (review.duplicate === true) {
            return {
                status: "reviewed",
                icon: "thumb_down",
                title: "Duplicate"
            };
        }

        const rejectionCodes = [];

        if (Array.isArray(review.rejectReasons)) {
            rejectionCodes.push(...review.rejectReasons);
        }

        if (review.rejectReason !== undefined && review.rejectReason !== null) {
            rejectionCodes.push(review.rejectReason);
        }

        if (review.spam) {
            rejectionCodes.push("Abuse / spam");
        }

        if (rejectionCodes.length > 0) {
            const reasons = rejectionCodes.map(code => REJECTION_MAPPINGS[code] || String(code));

            return {
                status: "reviewed",
                icon: "thumb_down",
                title: reasons.join(", ")
            };
        }

        if (review.quality !== undefined) {
            return {
                status: "reviewed",
                icon: "thumb_up",
                title: "Voted to accept"
            };
        }

        return {
            status: "reviewed",
            emoji: "",
            title: ""
        };
    }

    function formatReviewDate(ts) {
        const date = new Date(Number(ts));
        if (Number.isNaN(date.getTime())) return "";

        const locales = Array.isArray(navigator.languages) && navigator.languages.length
        ? navigator.languages
        : (navigator.language || undefined);

        return new Intl.DateTimeFormat(locales, {
            year: "numeric",
            month: "short",
            day: "numeric"
        }).format(date);
    }

    function renderReviewText(record) {
        const date = formatReviewDate(record?.ts);
        const outcome = getReviewOutcome(record);

        if (outcome.status === "skipped") {
            return {
                text: `Skipped ${date}`,
                icon: "",
                title: ""
            };
        }

        return {
            text: `Reviewed ${date}`,
            icon: outcome.icon,
            title: outcome.title
        };
    }

    // ----------------------------
    // POI images response parsing
    // ----------------------------
    const POI_IMAGES_ENDPOINT_PART = "/api/v1/vault/mapview/poi-images";

    function isPoiImagesUrl(url) {
        return typeof url === "string" && url.includes(POI_IMAGES_ENDPOINT_PART);
    }

    function getPoiIdFromPoiImagesUrl(url) {
        try {
            const parsed = new URL(url, window.location.origin);
            return parsed.searchParams.get("poiId") || "";
        } catch {
            return "";
        }
    }

    function extractImagesFromPoiImagesResponse(json) {
        const images = Array.isArray(json?.result?.images) ? json.result.images : [];

        return images
            .map(img => ({
            imageUrl: typeof img?.imageUrl === "string" ? img.imageUrl : "",
            creationTimestampMs: Number.isFinite(Number(img?.creationTimestampMs))
            ? Number(img.creationTimestampMs)
            : null
        }))
            .filter(img => !!img.imageUrl);
    }

    function getOldestImage(images) {
        if (!Array.isArray(images) || images.length === 0) return null;
        if (images.length === 1) return images[0];

        const dated = images.filter(img => Number.isFinite(img.creationTimestampMs));

        if (dated.length > 0) {
            return dated.reduce((oldest, img) => {
                return img.creationTimestampMs < oldest.creationTimestampMs ? img : oldest;
            }, dated[0]);
        }

        // Fallback if the endpoint changes and dates are missing.
        return images[0];
    }

    async function handlePoiImagesResponse(url, json) {
        if (!isOnMapviewRoute()) return;

        const responsePoiId = getPoiIdFromPoiImagesUrl(url);
        if (!responsePoiId) return;

        const selected = selectedPoi;
        if (!selected?.guid) return;

        // Ignore stale poi-images responses from previously clicked POIs.
        if (!samePoiId(responsePoiId, selected.guid)) return;

        const seq = selected.seq;
        const images = extractImagesFromPoiImagesResponse(json);
        const oldest = getOldestImage(images);

        if (!oldest?.imageUrl) return;

        const imageMap = await getReviewImageMap();

        if (!selectedPoi || selectedPoi.seq !== seq) return;

        // poi-images is authoritative. Once it arrives, clear any provisional
        // main-image result and base the final result on the oldest image only.
        clearReviewRow();

        const oldestMatch = findReviewByImage(imageMap, oldest.imageUrl);

        if (oldestMatch) {
            showReviewIfAllowed(oldestMatch, selected.guid);
        }
    }

    // ----------------------------
    // Passive listener for base script's poi-images request
    // ----------------------------
    function installPoiImagesFetchListener() {
        if (window.__wfReviewHistoryFetchListenerInstalled) return;
        window.__wfReviewHistoryFetchListenerInstalled = true;

        const originalFetch = window.fetch;

        if (typeof originalFetch !== "function") return;

        window.fetch = async function patchedFetch(input, init) {
            const url = typeof input === "string"
            ? input
            : input?.url;

            const response = await originalFetch.apply(this, arguments);

            if (isPoiImagesUrl(url)) {
                try {
                    const clone = response.clone();
                    const json = await clone.json();
                    handlePoiImagesResponse(url, json);
                } catch (err) {
                    console.warn("[WF Review History] Failed reading poi-images fetch response:", err);
                }
            }

            return response;
        };
    }

    function installPoiImagesXhrListener() {
        if (window.__wfReviewHistoryXhrListenerInstalled) return;
        window.__wfReviewHistoryXhrListenerInstalled = true;

        const originalOpen = XMLHttpRequest.prototype.open;
        const originalSend = XMLHttpRequest.prototype.send;

        XMLHttpRequest.prototype.open = function patchedOpen(method, url) {
            this.__wfReviewHistoryUrl = typeof url === "string" ? url : "";
            return originalOpen.apply(this, arguments);
        };

        XMLHttpRequest.prototype.send = function patchedSend() {
            if (isPoiImagesUrl(this.__wfReviewHistoryUrl)) {
                this.addEventListener("load", () => {
                    try {
                        const json = JSON.parse(this.responseText);
                        handlePoiImagesResponse(this.__wfReviewHistoryUrl, json);
                    } catch (err) {
                        console.warn("[WF Review History] Failed reading poi-images XHR response:", err);
                    }
                });
            }

            return originalSend.apply(this, arguments);
        };
    }

    function installPoiImagesListeners() {
        installPoiImagesFetchListener();
        installPoiImagesXhrListener();
    }

    // ----------------------------
    // Side panel detection/injection
    // ----------------------------
    function getSidePanel() {
        return document.querySelector("#wfmapmods-side-panel");
    }

    function applyMetadataRowStyle(row, panel) {
        const source =
              panel.querySelector(".wfmapmods-detail-poi-approval-date:not(#wf-review-history-outcome-row)") ||
              panel.querySelector(".wfmapmods-detail-poi-submitter:not(#wf-review-history-outcome-row)");

        if (source) {
            const cs = window.getComputedStyle(source);

            row.style.fontSize = cs.fontSize;
            row.style.fontWeight = cs.fontWeight;
            row.style.lineHeight = cs.lineHeight;
            row.style.color = cs.color;
            row.style.textAlign = cs.textAlign;
            row.style.margin = cs.margin;
            row.style.padding = cs.padding;
            row.style.wordBreak = cs.wordBreak;
            row.style.width = cs.width;
        } else {
            row.style.fontSize = "11px";
            row.style.fontWeight = "400";
            row.style.lineHeight = "1.05";
            row.style.color = "#777";
            row.style.textAlign = "center";
            row.style.margin = "0";
            row.style.padding = "0";
            row.style.wordBreak = "break-word";
            row.style.width = "100%";
        }
    }

    function ensureReviewRow() {
        const panel = getSidePanel();
        if (!panel) return null;

        let row = panel.querySelector("#wf-review-history-outcome-row");

        if (row) {
            row.classList.remove(
                "wfmapmods-detail-poi-approval-date",
                "wfmapmods-detail-poi-submitter",
                "wfmapmods-is-hidden"
            );

            row.classList.add("wf-review-history-outcome-row");
            applyMetadataRowStyle(row, panel);
            return row;
        }

        row = document.createElement("div");
        row.id = "wf-review-history-outcome-row";
        row.className = "wf-review-history-outcome-row";
        row.style.display = "none";

        applyMetadataRowStyle(row, panel);

        const creationDateRow = panel.querySelector(
            ".wfmapmods-detail-poi-approval-date:not(#wf-review-history-outcome-row)"
        );

        if (creationDateRow?.parentNode) {
            creationDateRow.parentNode.insertBefore(row, creationDateRow);
            return row;
        }

        const submitterRow = panel.querySelector(
            ".wfmapmods-detail-poi-submitter:not(#wf-review-history-outcome-row)"
        );

        if (submitterRow?.parentNode) {
            submitterRow.parentNode.insertBefore(row, submitterRow);
            return row;
        }

        const detailsBody =
              panel.querySelector(".wfmapmods-section-details-body") ||
              panel.querySelector(".wfmapmods-section-details");

        if (detailsBody) {
            detailsBody.appendChild(row);
            return row;
        }

        return null;
    }

    function clearReviewRow() {
        const panel = getSidePanel();
        if (!panel) return;

        const row = panel.querySelector("#wf-review-history-outcome-row");
        if (!row) return;

        row.innerHTML = "";
        row.removeAttribute("title");
        row.style.display = "none";
    }

function showReviewRow(record) {
    const row = ensureReviewRow();
    if (!row || !record) return;

    const rendered = renderReviewText(record);

    row.innerHTML = "";

    const text = document.createElement("span");
    text.textContent = rendered.text;
    row.appendChild(text);

    if (rendered.icon) {
        const icon = document.createElement("mat-icon");

        icon.className = "mat-icon notranslate material-icons mat-icon-no-color wf-review-history-icon";
        icon.setAttribute("role", "img");
        icon.setAttribute("aria-hidden", "true");
        icon.setAttribute("data-mat-icon-type", "font");
        icon.textContent = rendered.icon;

        icon.style.fontSize = "13px";
        icon.style.width = "13px";
        icon.style.height = "13px";
        icon.style.lineHeight = "13px";
        icon.style.verticalAlign = "-2px";
        icon.style.marginLeft = "3px";
        icon.style.color = "currentColor";

        if (rendered.title) {
            icon.title = rendered.title;
        }

        row.appendChild(icon);
    }

    row.style.display = "block";
}

    // ----------------------------
    // POI bridge listener
    // ----------------------------
    let selectedPoi = null;
    let selectedPoiSeq = 0;
    let poiBridgeObserver = null;

    function getPoiBridgeElement() {
        return document.getElementById("wfmapmods-poi-bridge");
    }

    function parsePoiBridgePayload() {
        const bridge = getPoiBridgeElement();
        const payloadStr = bridge?.getAttribute("data-payload");

        if (!payloadStr) return null;

        try {
            return JSON.parse(payloadStr);
        } catch (err) {
            console.warn("[WF Review History] Failed to parse POI bridge payload:", err);
            return null;
        }
    }

    function normalisePoiPayload(payload) {
        return {
            guid: payload?.guid || null,
            imageUrl: payload?.imageUrl || ""
        };
    }

    function startPoiBridgeListener() {
        const bridge = getPoiBridgeElement();
        if (!bridge || poiBridgeObserver) return;

        poiBridgeObserver = new MutationObserver(() => {
            const payload = parsePoiBridgePayload();
            if (payload) handleSelectedPoi(payload);
        });

        poiBridgeObserver.observe(bridge, {
            attributes: true,
            attributeFilter: ["data-payload"]
        });

        const currentPayload = parsePoiBridgePayload();
        if (currentPayload) handleSelectedPoi(currentPayload);
    }

    async function handleSelectedPoi(payload) {
        if (!isOnMapviewRoute()) return;

        const poi = normalisePoiPayload(payload);

        selectedPoi = {
            seq: ++selectedPoiSeq,
            guid: poi.guid,
            imageUrl: poi.imageUrl
        };

        const seq = selectedPoi.seq;

        clearReviewRow();

        if (!poi.imageUrl) return;

        const imageMap = await getReviewImageMap();

        if (!selectedPoi || selectedPoi.seq !== seq) return;

        // Provisional result from bridge/main image.
        // This may be cleared or replaced when the base script's poi-images
        // response arrives.
        const mainMatch = findReviewByImage(imageMap, poi.imageUrl);

        if (mainMatch) {
            showReviewIfAllowed(mainMatch, poi.guid);
        }
    }

    // ----------------------------
    // Route change handling
    // ----------------------------
    function onRouteChange() {
        if (isOnSubmitRoute()) {
            selectedPoi = null;
            clearReviewRow();
            return;
        }

        if (isOnMapviewRoute()) {
            startPoiBridgeListener();
        }
    }

    function patchHistoryMethod(methodName) {
        const original = history[methodName];

        history[methodName] = function patchedHistoryMethod() {
            const result = original.apply(this, arguments);
            window.dispatchEvent(new Event("wf-review-history-route-change"));
            return result;
        };
    }

    patchHistoryMethod("pushState");
    patchHistoryMethod("replaceState");

    window.addEventListener("popstate", () => {
        window.dispatchEvent(new Event("wf-review-history-route-change"));
    });

    window.addEventListener("wf-review-history-route-change", () => {
        setTimeout(onRouteChange, 50);
    });

    function start() {
        installPoiImagesListeners();
        startPoiBridgeListener();
        onRouteChange();
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", start);
    } else {
        start();
    }

    // The base script creates the bridge. We wait for it rather than creating it.
    const startupTimer = window.setInterval(() => {
        startPoiBridgeListener();

        if (getPoiBridgeElement()) {
            window.clearInterval(startupTimer);
        }
    }, 500);
})();