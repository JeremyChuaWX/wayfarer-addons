// ==UserScript==
// @name         Wayfarer Map Mods - Request Photo Votes
// @version      0.1.0
// @description  Copies vote request text to clipboard for use in WDD #waypoint-thumbs
// @namespace    https://gitlab.com/Tntnnbltn/wayfarer-addons
// @downloadURL  https://gitlab.com/Tntnnbltn/wayfarer-addons/-/raw/main/wayfarer-map-mods-photo-vote-request.user.js
// @updateURL    https://gitlab.com/Tntnnbltn/wayfarer-addons/-/raw/main/wayfarer-map-mods-photo-vote-request.user.js
// @homepageURL  https://gitlab.com/Tntnnbltn/wayfarer-addons
// @match        https://wayfarer.nianticlabs.com/*
// @run-at       document-start
// @grant        none
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
// directory of this script's GitLab repository:
// <https://gitlab.com/Tntnnbltn/wayfarer-addons/-/blob/main/LICENSE>
// If not, see <https://www.gnu.org/licenses/>.

/* eslint-disable no-multi-spaces */

(function () {
    "use strict";

    const SCRIPT_PREFIX = "wfmm-prayer";
    const POI_BRIDGE_ID = "wfmapmods-poi-bridge";
    const POI_IMAGES_ENDPOINT = "/api/v1/vault/mapview/poi-images";

    const RELEVANT_ROUTES = [
        "/new/mapview",
        "/new/submit"
    ];

    const HOST_SELECTOR = ".wfmapmods-gallery-tile, .wfmapmods-wayspot-overlay-image-frame";

    const BADGE_SELECTOR = ".wfmapmods-photo-vote-badge[data-poi-id][data-image-guid]";

    // poiId -> {
    //   records: [{ imageGuid, votes }],
    //   byImageGuid: Map
    // }
    const poiImageCache = new Map();

    let lastBridgePoi = null;
    let scanTimer = null;
    let domObserver = null;
    let bridgeObserver = null;
    let bridgePollTimer = null;

    patchXhrForPoiImages();
    installRouteWatcher();
    bootstrapWhenReady();

    function bootstrapWhenReady() {
        if (document.body) {
            initialiseForCurrentRoute();
            return;
        }

        document.addEventListener("DOMContentLoaded", initialiseForCurrentRoute, { once: true });
    }

    function initialiseForCurrentRoute() {
        injectCss();

        if (!isRelevantRoute()) {
            disconnectDomObserver();
            disconnectBridgeObserver();
            return;
        }

        startBridgeWatcher();
        startDomWatcher();
        scheduleScan();
    }

    function isRelevantRoute() {
        return RELEVANT_ROUTES.some(route => location.pathname.startsWith(route));
    }

    function installRouteWatcher() {
        const notifyRouteChanged = () => {
            window.setTimeout(initialiseForCurrentRoute, 0);
        };

        const originalPushState = history.pushState;
        const originalReplaceState = history.replaceState;

        history.pushState = function (...args) {
            const result = originalPushState.apply(this, args);
            notifyRouteChanged();
            return result;
        };

        history.replaceState = function (...args) {
            const result = originalReplaceState.apply(this, args);
            notifyRouteChanged();
            return result;
        };

        window.addEventListener("popstate", notifyRouteChanged);
    }

    function injectCss() {
        if (document.getElementById(`${SCRIPT_PREFIX}-style`)) return;

        const style = document.createElement("style");
        style.id = `${SCRIPT_PREFIX}-style`;
        style.textContent = `
.${SCRIPT_PREFIX}-copy-btn {
    position: absolute;
    left: 10px;
    bottom: 8px;
    z-index: 30;

    width: 24px;
    height: 24px;
    padding: 0;

    border: 0;
    border-radius: 999px;
    background: rgba(32, 32, 32, 0.52);
    color: rgba(255, 255, 255, 0.86);

    font-size: 16px;
    line-height: 1;

    display: inline-flex;
    align-items: center;
    justify-content: center;

    cursor: pointer;
    user-select: none;

    box-shadow: none;
    backdrop-filter: blur(2px);
    -webkit-backdrop-filter: blur(2px);

    transition:
        background 120ms ease,
        transform 120ms ease,
        opacity 120ms ease;
}

.${SCRIPT_PREFIX}-copy-btn:hover,
.${SCRIPT_PREFIX}-copy-btn:focus {
    background: rgba(40, 40, 40, 0.82);
    outline: none;
    transform: scale(1.04);
}

.${SCRIPT_PREFIX}-copy-btn:active {
    transform: scale(0.96);
}

.${SCRIPT_PREFIX}-copy-btn.${SCRIPT_PREFIX}-copied {
    background: rgba(50, 50, 50, 0.70);
}

.wfmapmods-gallery-tile,
.wfmapmods-wayspot-overlay-image-frame {
    position: relative;
}
`;

        const parent = document.head || document.documentElement;
        parent.appendChild(style);
    }

    // ---------------------------------------------------------------------
    // poi-images listener
    // ---------------------------------------------------------------------
    function patchXhrForPoiImages() {
        if (typeof window.XMLHttpRequest !== "function") return;

        const originalOpen = XMLHttpRequest.prototype.open;
        const originalSend = XMLHttpRequest.prototype.send;

        XMLHttpRequest.prototype.open = function (method, url, ...rest) {
            this.__wfmmPrayerPoiImagesPoiId = getPoiIdFromPoiImagesUrl(url);
            return originalOpen.call(this, method, url, ...rest);
        };

        XMLHttpRequest.prototype.send = function (...args) {
            if (this.__wfmmPrayerPoiImagesPoiId) {
                this.addEventListener("load", () => {
                    cachePoiImagesFromXhrResponse(this.__wfmmPrayerPoiImagesPoiId, this);
                });
            }

            return originalSend.apply(this, args);
        };
    }

    function getPoiIdFromPoiImagesUrl(rawUrl) {
        if (!rawUrl || typeof rawUrl !== "string" || !rawUrl.includes(POI_IMAGES_ENDPOINT)) {
            return null;
        }

        try {
            const url = new URL(rawUrl, location.origin);
            return url.searchParams.get("poiId") || null;
        } catch {
            return null;
        }
    }

    function cachePoiImagesFromXhrResponse(poiId, xhr) {
        if (!poiId || !xhr || xhr.status < 200 || xhr.status >= 300) return;

        try {
            const json = JSON.parse(xhr.responseText || "{}");
            cachePoiImagesJson(poiId, json);
        } catch {
            // Deliberately silent. This must never interfere with WFMM Base XHRs.
        }
    }

    function cachePoiImagesJson(poiId, json) {
        const records = json.result.images
        .map(img => ({
            imageGuid: img.imageGuid,
            votes: img.playerVotes
        }))
        .filter(record => record.imageGuid && Number.isInteger(record.votes));

        if (!records.length) return;

        storeVoteRecordsForPoi(poiId, records);
        scheduleScan();
    }

    function storeVoteRecordsForPoi(poiId, records) {
        poiImageCache.set(poiId, {
            records,
            byImageGuid: new Map(records.map(record => [record.imageGuid, record]))
        });
    }

    // ---------------------------------------------------------------------
    // WFMM Base bridge watcher
    // ---------------------------------------------------------------------

    function startBridgeWatcher() {
        if (!isRelevantRoute()) return;

        const bridge = document.getElementById(POI_BRIDGE_ID);

        if (!bridge) {
            if (!bridgePollTimer) {
                bridgePollTimer = window.setTimeout(() => {
                    bridgePollTimer = null;
                    startBridgeWatcher();
                }, 500);
            }

            return;
        }

        if (bridgePollTimer) {
            window.clearTimeout(bridgePollTimer);
            bridgePollTimer = null;
        }

        if (bridgeObserver) return;

        lastBridgePoi = readBridgePoi();

        bridgeObserver = new MutationObserver(() => {
            lastBridgePoi = readBridgePoi();
            scheduleScan();
        });

        bridgeObserver.observe(bridge, {
            attributes: true,
            attributeFilter: ["data-payload"]
        });
    }

    function disconnectBridgeObserver() {
        if (bridgeObserver) {
            bridgeObserver.disconnect();
            bridgeObserver = null;
        }

        if (bridgePollTimer) {
            window.clearTimeout(bridgePollTimer);
            bridgePollTimer = null;
        }
    }

    function readBridgePoi() {
        const bridge = document.getElementById(POI_BRIDGE_ID);
        const raw = bridge?.getAttribute("data-payload");
        if (!raw) return null;

        try {
            const payload = JSON.parse(raw);

            return {
                guid: payload.guid || payload.id || "",
                lat: Number(payload.lat),
                lng: Number(payload.lng),
                imageUrl: payload.imageUrl || payload.image || ""
            };
        } catch {
            return null;
        }
    }

    // ---------------------------------------------------------------------
    // DOM watcher
    // ---------------------------------------------------------------------

    function startDomWatcher() {
        if (domObserver || !document.body || !isRelevantRoute()) return;

        domObserver = new MutationObserver(mutations => {
            if (!isRelevantRoute()) return;

            for (const mutation of mutations) {
                for (const node of mutation.addedNodes) {
                    if (!(node instanceof Element)) continue;

                    if (
                        node.matches?.(HOST_SELECTOR) ||
                        node.querySelector?.(HOST_SELECTOR)
                    ) {
                        scheduleScan();
                        return;
                    }
                }
            }
        });

        domObserver.observe(document.body, {
            childList: true,
            subtree: true
        });
    }

    function disconnectDomObserver() {
        if (domObserver) {
            domObserver.disconnect();
            domObserver = null;
        }

        if (scanTimer) {
            window.clearTimeout(scanTimer);
            scanTimer = null;
        }
    }

    function scheduleScan() {
        if (scanTimer) return;

        scanTimer = window.setTimeout(() => {
            scanTimer = null;

            if (!isRelevantRoute()) return;

            scan();
        }, 50);
    }

    // ---------------------------------------------------------------------
    // Main scan/update
    // ---------------------------------------------------------------------

    function scan() {
        const hosts = document.querySelectorAll(HOST_SELECTOR);

        hosts.forEach(host => {
            const target = getTargetInfo(host);

            if (!target) {
                removePrayerButton(host);
                return;
            }

            updatePrayerButton(host, target);
        });
    }

    function getTargetInfo(host) {
        const badge = host.querySelector(BADGE_SELECTOR);
        if (!badge) return null;

        const poiId = badge.dataset.poiId;
        const imageGuid = badge.dataset.imageGuid;

        const record = poiImageCache.get(poiId)?.byImageGuid.get(imageGuid);
        if (!record) return null;

        return {
            poiId,
            imageGuid,
        };
    }

    function formatVotesNeeded(votesNeeded) {
        return `${votesNeeded} more ${votesNeeded === 1 ? "vote" : "votes"} needed`;
    }

    function updatePrayerButton(host, target) {
        const { poiId, imageGuid } = target;

        const voteInfo = getVoteInfoForImage(poiImageCache.get(poiId).records, imageGuid);

        if (!voteInfo) {
            removePrayerButton(host);
            return;
        }

        const coords = getLatLngForPoi(poiId);
        if (!coords) {
            removePrayerButton(host);
            return;
        }

        const lat6 = coords.lat.toFixed(6);
        const lng6 = coords.lng.toFixed(6);
        const voteText = formatVotesNeeded(voteInfo.votesNeeded);

        const copyText = `${lat6},${lng6}\nhttps://wayfarer.nianticlabs.com/new/mapview?${lat6},${lng6}\n${voteText}`;

        let btn = host.querySelector(`.${SCRIPT_PREFIX}-copy-btn`);
        if (!btn) {
            btn = document.createElement("button");
            btn.type = "button";
            btn.className = `${SCRIPT_PREFIX}-copy-btn`;
            btn.textContent = "🙏";
            btn.setAttribute("aria-label", "Copy photo vote request");
            btn.addEventListener("click", onPrayerButtonClick);
            host.appendChild(btn);
        }

        btn.dataset.copyText = copyText;
        btn.dataset.poiId = poiId;
        btn.dataset.imageGuid = imageGuid;
        btn.title = `${voteText} — click to copy`;
    }

    function getVoteInfoForImage(voteRecords, imageGuid) {
        if (voteRecords.length <= 1) return null;

        const current = voteRecords.find(record => record.imageGuid === imageGuid);
        if (!current) return null;

        const maxOtherVotes = Math.max(
            ...voteRecords
            .filter(record => record.imageGuid !== imageGuid)
            .map(record => record.votes)
        );

        if (current.votes > maxOtherVotes) {
            return null;
        }

        const maxVotes = Math.max(...voteRecords.map(record => record.votes));

        return {
            votesNeeded: maxVotes - current.votes + 1
        };
    }

    function getLatLngForPoi(poiId) {
        const bridgePoi = lastBridgePoi || readBridgePoi();

        if (
            bridgePoi &&
            bridgePoi.guid === poiId &&
            Number.isFinite(bridgePoi.lat) &&
            Number.isFinite(bridgePoi.lng)
        ) {
            return {
                lat: bridgePoi.lat,
                lng: bridgePoi.lng
            };
        }

        return null;
    }

    async function onPrayerButtonClick(ev) {
        ev.preventDefault();
        ev.stopPropagation();

        const btn = ev.currentTarget;
        const text = btn?.dataset?.copyText || "";
        if (!text) return;

        try {
            await copyTextToClipboard(text);

            const oldText = btn.textContent;
            btn.textContent = "✓";
            btn.classList.add(`${SCRIPT_PREFIX}-copied`);

            window.setTimeout(() => {
                if (!btn.isConnected) return;
                btn.textContent = oldText || "🙏";
                btn.classList.remove(`${SCRIPT_PREFIX}-copied`);
            }, 900);
        } catch (err) {
            console.warn("[WFMM Prayer Copy] Clipboard copy failed:", err);
            window.prompt("Copy this text:", text);
        }
    }

    function removePrayerButton(host) {
        if (!host) return;
        host.querySelector(`.${SCRIPT_PREFIX}-copy-btn`)?.remove();
    }

    async function copyTextToClipboard(text) {
        if (!navigator.clipboard?.writeText) {
            throw new Error("Clipboard API unavailable");
        }

        await navigator.clipboard.writeText(text);
    }
})();