// ==UserScript==
// @name         Wayfarer Map Mods - Wayfarer App Submissions
// @version      0.1.5
// @description  Import Wayfarer App submissions from Lightship Geospatial Browser and show them as markers on the submission map
// @namespace    https://gitlab.com/Tntnnbltn/wayfarer-addons
// @downloadURL  https://gitlab.com/Tntnnbltn/wayfarer-addons/-/raw/main/wayfarer-map-mods-wayfarer-app-submissions.user.js
// @homepageURL  https://gitlab.com/Tntnnbltn/wayfarer-addons
// @match        https://wayfarer.nianticlabs.com/*
// @match        https://lightship.dev/*
// @run-at       document-start
// @grant        GM_xmlhttpRequest
// @connect      lh3.googleusercontent.com
// @connect      storage.googleapis.com
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

(function () {
    'use strict';

    // -----------------------------
    // Shared constants
    // -----------------------------

    const SETTINGS_KEY = "wfmap_wayfarerApp_settings";
    const OBJECT_STORE_NAME = "wayfarerAppSubmissions";

    const POI_BRIDGE_ID = "wfmapmods-poi-bridge";
    const POI_BRIDGE_SOURCE = "wf-wayfarerapp-overlay";
    const SUBMISSION_BRIDGE_ID = "wfmapmods-submit-bridge";

    const PERFORMANCE_MAX_VISIBLE_MARKERS = 400;

    const WFAPPSUB_CHILD_NAME = "wf-lightship-geospatial";

    const LIGHTSHIP_LOGO_SVG = '<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" fill-rule="evenodd"><path d="M32 8c3.812 0 7.465.874 10.856 2.598a.208.208 0 01.037.348l-.04.026-4.591 2.256a.208.208 0 01-.158.01A19.714 19.714 0 0032 12.273a19.598 19.598 0 00-13.95 5.779A19.598 19.598 0 0012.27 32c0 1.53.518 2.646 1.539 3.316 2.098 1.379 5.996.795 9.625-.252l.656-.195.647-.203.637-.21.313-.106.613-.215.596-.217.852-.322.537-.21.51-.205.923-.385.408-.175a.939.939 0 011.054.199.938.938 0 01.2 1.053l-.362.854-.297.73-.313.796-.214.563-.215.586-.215.605-.213.622-.105.317-.206.643-.199.652-.19.66c-.982 3.535-1.487 7.264-.151 9.296.667 1.016 1.777 1.53 3.299 1.53a19.6 19.6 0 0013.95-5.778A19.599 19.599 0 0051.73 32c0-2.234-.376-4.434-1.115-6.54a.208.208 0 01-.008-.11l.017-.051 2.22-4.517a.209.209 0 01.183-.116c.07-.002.15.041.188.11A24.05 24.05 0 0156 32.002c0 13.233-10.767 24-24 24S8 45.234 8 32C8 18.767 18.767 8 32 8zm19.336 2.399c1.257-.618 2.58.653 2.069 1.913l-.048.108-11.31 23.018c-.57 1.161-2.22 1.104-2.73-.04l-.05-.122-2.574-7.293a1.509 1.509 0 00-.794-.87l-.127-.051-7.292-2.574c-1.22-.43-1.356-2.075-.279-2.717l.116-.062 23.019-11.31z"/></svg>';

    // postMessage channel
    const POSTMESSAGE_TYPE_IMPORT = "wfmap-wayfarerapp-import";

    // -----------------------------
    // Branch based on hostname
    // -----------------------------

    if (location.hostname === "lightship.dev") {
        // Child tab: intercept getSubmittedPois and send to parent
        console.log("on lightship.dev");
        setupLightshipInterceptor();
    } else if (location.hostname === "wayfarer.nianticlabs.com") {
        // Main Wayfarer tab: map overlay + settings + import handler
        setupWayfarerOverlay();
    }
    return;

    // =====================================================================
    // LIGHTSHIP CHILD TAB
    // =====================================================================

    function setupLightshipInterceptor() {
        // Use the real page context if available (Tampermonkey/Violentmonkey)
        const global = typeof unsafeWindow !== "undefined" ? unsafeWindow : window;

        // ✅ Only run in the child window that was opened by the App Submissions plugin
        if (global.name !== WFAPPSUB_CHILD_NAME) {
            console.log(
                "[WFAppSub] Not App Submissions child window (name =",
                global.name,
                ") – skipping interceptors"
            );
            return;
        }

        // ---------- XHR INTERCEPTOR ----------
        (function (open) {
            if (!global.XMLHttpRequest) return;

            global.XMLHttpRequest.prototype.open = function (method, url) {
                try {
                    const cleanUrl = typeof url === "string" ? url : "";
                    const isTarget =
                          method === "GET" &&
                          cleanUrl.indexOf("/v1/vps/getSubmittedPois/") !== -1;

                    if (isTarget) {
                        console.log("[WFAppSub] XHR getSubmittedPois detected:", cleanUrl);

                        this.addEventListener(
                            "load",
                            function () {
                                try {
                                    const raw = this.responseText || this.response;
                                    if (!raw) return;

                                    let json;
                                    try {
                                        json = JSON.parse(raw);
                                    } catch (e) {
                                        console.warn(
                                            "[WFAppSub] XHR: failed to parse JSON",
                                            e
                                        );
                                        return;
                                    }

                                    if (!json || !Array.isArray(json.submittedPois)) {
                                        console.warn(
                                            "[WFAppSub] XHR: no submittedPois array"
                                        );
                                        return;
                                    }

                                    const opener = global.opener;
                                    if (opener && !opener.closed) {
                                        try {
                                            opener.postMessage(
                                                {
                                                    type: POSTMESSAGE_TYPE_IMPORT,
                                                    submittedPois: json.submittedPois,
                                                },
                                                "https://wayfarer.nianticlabs.com"
                                            );
                                        } catch (e) {
                                            console.warn(
                                                "[WFAppSub] XHR: strict postMessage failed, retry with *",
                                                e
                                            );
                                            opener.postMessage(
                                                {
                                                    type: POSTMESSAGE_TYPE_IMPORT,
                                                    submittedPois: json.submittedPois,
                                                },
                                                "*"
                                            );
                                        }
                                    } else {
                                        console.warn(
                                            "[WFAppSub] XHR: no opener to send data to"
                                        );
                                    }

                                    try {
                                        global.close();
                                    } catch (e) {
                                        console.warn(
                                            "[WFAppSub] XHR: failed to close window",
                                            e
                                        );
                                    }
                                } catch (err) {
                                    console.warn(
                                        "[WFAppSub] XHR handler error",
                                        err
                                    );
                                }
                            },
                            false
                        );
                    }
                } catch (err) {
                    console.warn(
                        "[WFAppSub] Error in XHR open interceptor",
                        err
                    );
                }

                return open.apply(this, arguments);
            };
        })(global.XMLHttpRequest && global.XMLHttpRequest.prototype.open);

        // ---------- FETCH INTERCEPTOR ----------
        if (global.fetch) {
            const origFetch = global.fetch;

            global.fetch = function (input, init) {
                let url = "";
                if (typeof input === "string") {
                    url = input;
                } else if (input && typeof input.url === "string") {
                    url = input.url;
                }

                const method = (init && init.method) || "GET";

                const isTarget =
                      method.toUpperCase() === "GET" &&
                      url.indexOf("/v1/vps/getSubmittedPois/") !== -1;

                if (!isTarget) {
                    return origFetch.apply(this, arguments);
                }

                console.log("[WFAppSub] fetch getSubmittedPois detected:", url);

                return origFetch.apply(this, arguments).then((response) => {
                    const clone = response.clone();

                    clone
                        .text()
                        .then((raw) => {
                        try {
                            if (!raw) return;
                            let json;
                            try {
                                json = JSON.parse(raw);
                            } catch (e) {
                                console.warn(
                                    "[WFAppSub] fetch: failed to parse JSON",
                                    e
                                );
                                return;
                            }

                            if (
                                !json ||
                                !Array.isArray(json.submittedPois)
                            ) {
                                console.warn(
                                    "[WFAppSub] fetch: no submittedPois array"
                                );
                                return;
                            }

                            const opener = global.opener;
                            if (opener && !opener.closed) {
                                try {
                                    opener.postMessage(
                                        {
                                            type: POSTMESSAGE_TYPE_IMPORT,
                                            submittedPois: json.submittedPois,
                                        },
                                        "https://wayfarer.nianticlabs.com"
                                    );
                                } catch (e) {
                                    console.warn(
                                        "[WFAppSub] fetch: strict postMessage failed, retry with *",
                                        e
                                    );
                                    opener.postMessage(
                                        {
                                            type: POSTMESSAGE_TYPE_IMPORT,
                                            submittedPois: json.submittedPois,
                                        },
                                        "*"
                                    );
                                }
                            } else {
                                console.warn(
                                    "[WFAppSub] fetch: no opener to send data to"
                                );
                            }

                            try {
                                global.close();
                            } catch (e) {
                                console.warn(
                                    "[WFAppSub] fetch: failed to close window",
                                    e
                                );
                            }
                        } catch (err) {
                            console.warn(
                                "[WFAppSub] fetch handler error",
                                err
                            );
                        }
                    })
                        .catch((e) => {
                        console.warn(
                            "[WFAppSub] fetch: error reading body",
                            e
                        );
                    });

                    return response;
                });
            };
        }
    }

    // =====================================================================
    // WAYFARER MAIN TAB
    // =====================================================================

    function setupWayfarerOverlay() {

        // -----------------------------
        // Runtime state – submissions
        // -----------------------------

        let appSubmissions = null; // array of submittedPois
        let submitMap = null;
        let mapAttached = false;

        let submissionMarkers = {}; // id → marker
        let lastSelectedSubmissionId = null;
        let lastSelectedMarker = null;
        let lastSelectedOriginalIcon = null;

        let lastPanelPresent = false;

        function hideSubmissionActionLinks() {
            const container = document.querySelector(".wfmapmods-poi-function-links");
            if (!container) return;

            const resubmitLink = container.querySelector("#wfmapmods-function-resubmit-appsub");
            if (resubmitLink) {
                resubmitLink.style.display = "none";
            }
        }

        function updateSubmissionActionLinks(poi) {
            const container = document.querySelector(".wfmapmods-poi-function-links");
            if (!container || !poi) return;

            const status = String(poi.curationState || "").toUpperCase();
            const recordId = poi.recordId;

            // Create the Resubmit link once
            let resubmitLink = container.querySelector("#wfmapmods-function-resubmit-appsub");
            if (!resubmitLink) {
                resubmitLink = document.createElement("a");
                resubmitLink.id = "wfmapmods-function-resubmit-appsub";
                resubmitLink.textContent = "Resubmit";
                resubmitLink.style.cursor = "pointer";
                container.appendChild(resubmitLink);

                resubmitLink.addEventListener("click", (ev) => {
                    ev.preventDefault();
                    const rid = resubmitLink.dataset.id;
                    if (!rid) return;

                    let poiForResubmit = null;
                    if (Array.isArray(appSubmissions)) {
                        poiForResubmit = appSubmissions.find(p => p.recordId === rid) || null;
                    }
                    if (!poiForResubmit) poiForResubmit = poi;
                    if (!poiForResubmit) return;

                    // Centre the map on this POI and simulate a click
                    // This is to move the marker location to the resubmitted poi
                    if (
                        submitMap &&
                        typeof poiForResubmit.lat === "number" &&
                        typeof poiForResubmit.lng === "number"
                    ) {
                        const targetLatLng = new google.maps.LatLng(
                            poiForResubmit.lat,
                            poiForResubmit.lng
                        );

                        // centre map
                        submitMap.setCenter(targetLatLng);

                        // simulate a click on that location
                        // (this will trigger any map 'click' listeners used by the base plugin)
                        google.maps.event.trigger(submitMap, "click", {
                            latLng: targetLatLng
                        });
                    }

                    sendResubmitToBase(poiForResubmit);
                });
            }

            if (resubmitLink) {
                resubmitLink.dataset.id = recordId || "";
            }

            // Show Resubmit only for REJECTED
            if (status === "REJECTED") {
                resubmitLink.style.display = "inline-block";
                resubmitLink.style.cursor = "pointer";
                resubmitLink.style.opacity = "1";
                resubmitLink.style.color = "";
                resubmitLink.title = "Resubmit this nomination";
            } else {
                resubmitLink.style.display = "none";
                resubmitLink.title = "";
            }
        }

        // -----------------------------
        // Settings
        // -----------------------------

        const userSettings = {
            map: {
                performanceModeEnabled: true,
                performanceMaxVisibleMarkers: PERFORMANCE_MAX_VISIBLE_MARKERS,
                wayfarerAppEnabled: true
            },
            markers: {
                statuses: {
                    DEFAULT: {
                        strokeColor: "#6b7280",
                        strokeWeight: 2,
                        strokeOpacity: 1.0,
                        fillColor: "#6b7280",
                        fillOpacity: 0.5,
                        scale: 8,
                        enabled: true
                    },
                    ACCEPTED: {
                        strokeColor: "#22c55e",
                        strokeWeight: 2,
                        strokeOpacity: 1,
                        fillColor: "#22c55e",
                        fillOpacity: 0.1,
                        scale: 12,
                        enabled: true
                    },
                    REJECTED: {
                        strokeColor: "#bd0000",
                        strokeWeight: 2,
                        strokeOpacity: 1,
                        fillColor: "#f50000",
                        fillOpacity: 0.6,
                        scale: 8,
                        enabled: true
                    }
                }
            }
        };

        function mergeDeep(target, source) {
            for (const key in source) {
                const srcVal = source[key];
                const tgtVal = target[key];

                if (typeof srcVal === "object" && srcVal !== null && !Array.isArray(srcVal)) {
                    if (typeof tgtVal !== "object" || tgtVal === null) {
                        target[key] = {};
                    }
                    mergeDeep(target[key], srcVal);
                } else {
                    target[key] = srcVal;
                }
            }
        }

        function loadSettings() {
            try {
                const saved = localStorage.getItem(SETTINGS_KEY);
                if (!saved) return;
                mergeDeep(userSettings, JSON.parse(saved));
            } catch (e) {
                console.error(`${SETTINGS_KEY} - Failed to load settings:`, e);
            }
        }

        function saveSettings() {
            try {
                localStorage.setItem(SETTINGS_KEY, JSON.stringify(userSettings));
            } catch (e) {
                console.error(`${SETTINGS_KEY} - Failed to save settings:`, e);
            }
        }

        // -----------------------------
        // IndexedDB helpers
        // -----------------------------

        const getIDBInstance = (version) => new Promise((resolve, reject) => {
            if (!window.indexedDB) {
                reject("This browser doesn't support IndexedDB");
                return;
            }

            const openRequest = indexedDB.open("wayfarer-tools-db", version);

            openRequest.onsuccess = (event) => {
                const db = event.target.result;
                const dbVer = db.version;
                if (!db.objectStoreNames.contains(OBJECT_STORE_NAME)) {
                    db.close();
                    getIDBInstance(dbVer + 1).then(resolve, reject);
                } else {
                    resolve(db);
                }
            };

            openRequest.onupgradeneeded = (event) => {
                const db = event.target.result;
                if (!db.objectStoreNames.contains(OBJECT_STORE_NAME)) {
                    db.createObjectStore(OBJECT_STORE_NAME, { keyPath: "recordId" });
                }
            };

            openRequest.onerror = (event) => {
                reject(event.target.error || "Failed to open IndexedDB");
            };
        });

        function loadAppSubmissionsFromIDB() {
            getIDBInstance().then(db => {
                const tx = db.transaction(OBJECT_STORE_NAME, "readonly");
                const store = tx.objectStore(OBJECT_STORE_NAME);
                const req = store.getAll();

                req.onsuccess = () => {
                    appSubmissions = req.result || [];
                    refreshSubmissionMarkers();
                    db.close();
                };

                req.onerror = () => {
                    console.warn("[WFAppSub] Failed to read Wayfarer App submissions from IndexedDB", req.error);
                    db.close();
                };
            }).catch(err => {
                console.warn("[WFAppSub] IndexedDB not available:", err);
            });
        }

        function saveAppSubmissionsToIDB(submittedPois) {
            if (!Array.isArray(submittedPois)) return;

            getIDBInstance().then(db => {
                const tx = db.transaction(OBJECT_STORE_NAME, "readwrite");
                const store = tx.objectStore(OBJECT_STORE_NAME);

                const clearReq = store.clear();

                clearReq.onsuccess = () => {
                    submittedPois.forEach(poi => {
                        if (!poi || !poi.recordId) return;
                        store.put(poi);
                    });
                };

                clearReq.onerror = () => {
                    console.warn("[WFAppSub] Failed to clear Wayfarer App submissions store", clearReq.error);
                };

                tx.oncomplete = () => {
                    db.close();
                };

                tx.onerror = () => {
                    console.warn("[WFAppSub] Transaction error while saving Wayfarer App submissions", tx.error);
                    db.close();
                };
            }).catch(err => {
                console.warn("[WFAppSub] IndexedDB not available (save)", err);
            });
        }

        // -----------------------------
        // Map lifecycle + DOM watchers
        // -----------------------------

        function startMapPanelWatcher() {
            handlePanelChange();

            const mo = new MutationObserver(handlePanelChange);
            mo.observe(document.body, {
                childList: true,
                subtree: true
            });
        }

        function handlePanelChange() {
            const panelPresent = !!document.querySelector("#wfmapmods-side-panel");

            if (panelPresent && !lastPanelPresent) {
                attachWayfarerAppOverlayToMapIfNeeded();
                insertSettingsLink();
                insertLayersToggle();
                // load cached submissions
                loadAppSubmissionsFromIDB();
            } else if (!panelPresent && lastPanelPresent) {
                teardownWayfarerAppOverlayForMap();
            }

            lastPanelPresent = panelPresent;
        }

        function getSubmitMap() {
            return new Promise(resolve => {
                let attempts = 40;

                function tryFindMap() {
                    const candidates = document.querySelectorAll("app-submit-wayspot-map nia-map");
                    let foundMap = null;

                    candidates.forEach(el => {
                        if (foundMap || !el.__ngContext__) return;

                        const ctx = el.__ngContext__;
                        for (const entry of ctx) {
                            if (!entry) continue;

                            try {
                                if (entry.componentRef && entry.componentRef.map) {
                                    foundMap = entry.componentRef.map;
                                    break;
                                }
                            } catch {
                                /* ignore */
                            }
                        }
                    });

                    if (foundMap) {
                        resolve(foundMap);
                        return;
                    }

                    if (attempts-- <= 0) {
                        console.warn("[WFAppSub] Failed to find submit map after several attempts");
                        resolve(null);
                        return;
                    }

                    setTimeout(tryFindMap, 250);
                }

                tryFindMap();
            });
        }

        function teardownWayfarerAppOverlayForMap() {
            if (!mapAttached) return;
            clearSubmissionMarkers();
            submitMap = null;
            mapAttached = false;
        }

        function clearSubmissionMarkers() {
            if (!submissionMarkers) return;
            Object.values(submissionMarkers).forEach(m => {
                if (m && typeof m.setMap === "function") {
                    m.setMap(null);
                }
            });
            submissionMarkers = {};
        }

        async function attachWayfarerAppOverlayToMapIfNeeded() {
            if (mapAttached) {
                refreshSubmissionMarkers();
                return;
            }

            const map = await getSubmitMap();
            if (!map) {
                console.warn("[WFAppSub] Map not found – cannot attach");
                return;
            }

            submitMap = map;
            mapAttached = true;

            if (!submitMap._wayfarerAppOverlayBoundsListenerAdded) {
                submitMap.addListener("idle", refreshSubmissionMarkers);
                submitMap._wayfarerAppOverlayBoundsListenerAdded = true;
            }

            refreshSubmissionMarkers();
        }

        // -----------------------------
        // Marker creation & visibility
        // -----------------------------

        function getMarkerConfigForStatus(statusRaw) {
            const status = String(statusRaw || "").toUpperCase();
            const markersCfg = (userSettings.markers && userSettings.markers.statuses) || {};
            const fallback = markersCfg.DEFAULT || {
                strokeColor: "#6b7280",
                strokeWeight: 2,
                strokeOpacity: 1.0,
                fillColor: "#6b7280",
                fillOpacity: 0.5,
                scale: 8,
                enabled: true
            };
            return markersCfg[status] || fallback;
        }

        function createSubmissionMarker(poi) {
            const lat = poi.lat;
            const lng = poi.lng;
            if (typeof lat !== "number" || typeof lng !== "number") return null;

            const statusRaw = poi.curationState || "";
            const status = String(statusRaw).toUpperCase();
            const cfg = getMarkerConfigForStatus(statusRaw);

            const marker = new google.maps.Marker({
                map: null,
                position: { lat, lng },
                title: `${poi.title || "No title"} (${status || "UNKNOWN"})`,
                icon: {
                    path: google.maps.SymbolPath.CIRCLE,
                    fillColor: cfg.fillColor,
                    fillOpacity: cfg.fillOpacity,
                    strokeColor: cfg.strokeColor,
                    strokeOpacity: cfg.strokeOpacity,
                    strokeWeight: cfg.strokeWeight,
                    scale: cfg.scale
                }
            });

            marker.addListener("click", () => {
                selectSubmissionMarker(marker);
                lastSelectedSubmissionId = poi.recordId || null;
                sendPoiToBridge(poi);
                updateSubmissionActionLinks(poi);
            });

            return marker;
        }

        function clearSubmissionSelection() {
            hideSubmissionActionLinks();

            if (lastSelectedMarker && lastSelectedOriginalIcon) {
                lastSelectedMarker.setIcon(lastSelectedOriginalIcon);
            }
            lastSelectedMarker = null;
            lastSelectedOriginalIcon = null;
            lastSelectedSubmissionId = null;
        }


        function selectSubmissionMarker(marker) {
            clearSubmissionSelection();
            if (!marker || !marker.getIcon) return;

            const icon = marker.getIcon();
            if (!icon) return;

            lastSelectedOriginalIcon = { ...icon };
            lastSelectedMarker = marker;

            const selectedIcon = {
                ...icon,
                strokeColor: "#ff00ff",
                strokeOpacity: 1,
                strokeWeight: (icon.strokeWeight || 2) + 2,
                scale: (icon.scale || 8) + 1
            };

            marker.setIcon(selectedIcon);
        }

        function filterCandidateIdsByStatus(candidateIds, candidatePoisById, excludedStatuses) {
            const result = [];
            candidateIds.forEach(id => {
                const poi = candidatePoisById[id];
                if (!poi) return;
                const status = String(poi.curationState || "").toUpperCase();
                if (excludedStatuses.has(status)) return;
                result.push(id);
            });
            return result;
        }

        function refreshSubmissionMarkers() {
            if (!submitMap || !Array.isArray(appSubmissions)) return;

            const mapCfg = userSettings.map || {};
            const enabled = mapCfg.wayfarerAppEnabled !== false;
            const performanceModeEnabled = mapCfg.performanceModeEnabled;

            if (!enabled) {
                clearSubmissionMarkers();
                return;
            }

            const bounds = submitMap.getBounds();
            if (!bounds) return;

            const maxVisibleMarkers = typeof mapCfg.performanceMaxVisibleMarkers === "number"
            ? mapCfg.performanceMaxVisibleMarkers
            : PERFORMANCE_MAX_VISIBLE_MARKERS;

            const candidateIds = [];
            const candidatePoisById = {};

            appSubmissions.forEach(poi => {
                if (!poi) return;

                const lat = poi.lat;
                const lng = poi.lng;
                if (typeof lat !== "number" || typeof lng !== "number") return;

                const statusCfg = getMarkerConfigForStatus(poi.curationState);
                if (statusCfg.enabled === false) return;

                const pos = new google.maps.LatLng(lat, lng);
                if (!bounds.contains(pos)) return;

                const id = poi.recordId || `${lat},${lng}`;
                if (!candidatePoisById[id]) {
                    candidateIds.push(id);
                    candidatePoisById[id] = poi;
                }
            });

            let finalCandidateIds = candidateIds;

            if (performanceModeEnabled && candidateIds.length > maxVisibleMarkers) {
                const excludeAccepted = new Set(["ACCEPTED"]);
                const withoutAccepted = filterCandidateIdsByStatus(candidateIds, candidatePoisById, excludeAccepted);

                if (withoutAccepted.length <= maxVisibleMarkers) {
                    finalCandidateIds = withoutAccepted;
                } else {
                    // with only ACCEPTED/REJECTED, second pass is likely removing both → hide all
                    const excludeBoth = new Set(["ACCEPTED", "REJECTED"]);
                    const withoutBoth = filterCandidateIdsByStatus(candidateIds, candidatePoisById, excludeBoth);
                    if (withoutBoth.length <= maxVisibleMarkers) {
                        finalCandidateIds = withoutBoth;
                    } else {
                        clearSubmissionMarkers();
                        return;
                    }
                }
            }

            const inBoundsIds = new Set(finalCandidateIds);

            finalCandidateIds.forEach(id => {
                const poi = candidatePoisById[id];
                if (!poi) return;

                let marker = submissionMarkers[id];
                const cfg = getMarkerConfigForStatus(poi.curationState);

                const baseIcon = {
                    path: google.maps.SymbolPath.CIRCLE,
                    fillColor: cfg.fillColor,
                    fillOpacity: cfg.fillOpacity,
                    strokeColor: cfg.strokeColor,
                    strokeOpacity: cfg.strokeOpacity,
                    strokeWeight: cfg.strokeWeight,
                    scale: cfg.scale
                };

                if (!marker) {
                    marker = new google.maps.Marker({
                        map: null,
                        position: { lat: poi.lat, lng: poi.lng },
                        title: `${poi.title || "No title"} (${String(poi.curationState || "").toUpperCase() || "UNKNOWN"})`,
                        icon: baseIcon
                    });

                    marker.addListener("click", () => {
                        selectSubmissionMarker(marker);
                        lastSelectedSubmissionId = poi.recordId || null;
                        sendPoiToBridge(poi);
                        updateSubmissionActionLinks(poi);
                    });

                    submissionMarkers[id] = marker;
                } else {
                    if (marker === lastSelectedMarker) {
                        lastSelectedOriginalIcon = { ...baseIcon };
                        const selectedIcon = {
                            ...baseIcon,
                            strokeColor: "#ff00ff",
                            strokeOpacity: 1,
                            strokeWeight: (baseIcon.strokeWeight || 2) + 2,
                            scale: (baseIcon.scale || 8) + 1
                        };
                        marker.setIcon(selectedIcon);
                    } else {
                        marker.setIcon(baseIcon);
                    }
                }

                if (!marker.getMap()) {
                    marker.setMap(submitMap);
                }
            });

            Object.entries(submissionMarkers).forEach(([id, marker]) => {
                if (!marker) return;
                if (!inBoundsIds.has(id) && marker.getMap()) {
                    marker.setMap(null);
                }
            });
        }

        // -----------------------------
        // Layers option
        // -----------------------------

        function insertLayersToggle() {
            const menuCheck = setInterval(() => {
                const menu = document.querySelector(".wfmapmods-layers-menu");
                if (!menu) return;

                clearInterval(menuCheck);

                if (menu.querySelector("#wfmapmods-layer-wayfarerapp")) return;

                const mapCfg = userSettings.map || (userSettings.map = {});
                if (typeof mapCfg.wayfarerAppEnabled !== "boolean") {
                    mapCfg.wayfarerAppEnabled = true;
                }

                const label = document.createElement("label");
                label.className = "wfmapmods-layers-option";
                label.id = "wfmapmods-layer-wayfarerapp";

                const checkbox = document.createElement("input");
                checkbox.type = "checkbox";
                checkbox.checked = mapCfg.wayfarerAppEnabled !== false;
                checkbox.className = "wfmapmods-layers-checkbox";

                const text = document.createElement("span");
                text.textContent = "Wayfarer App submissions";
                text.className = "wfmapmods-layers-label";

                label.appendChild(checkbox);
                label.appendChild(text);
                menu.appendChild(label);

                checkbox.addEventListener("change", () => {
                    const enabled = checkbox.checked;
                    const mapCfg = userSettings.map || (userSettings.map = {});
                    mapCfg.wayfarerAppEnabled = enabled;
                    saveSettings();

                    if (!enabled) {
                        clearSubmissionMarkers();
                        clearSubmissionSelection();
                    } else {
                        refreshSubmissionMarkers();
                    }
                });
            }, 300);
        }

        // -----------------------------
        // Settings UI
        // -----------------------------

        function insertSettingsLink() {
            const panelCheck = setInterval(() => {
                const settingsBody = document.querySelector(".wfmapmods-settings-links");
                if (!settingsBody) return;

                clearInterval(panelCheck);

                if (document.getElementById("wfmapmods-settings-wayfarerapp")) return;

                const link = document.createElement("a");
                link.id = "wfmapmods-settings-wayfarerapp";
                link.textContent = "Wayfarer App submissions";

                settingsBody.appendChild(link);

                link.addEventListener("click", () => {
                    openWayfarerAppMarkerSettingsWindow();
                });
            }, 300);
        }

        function openMarkerStyleModal(statusKey, label, cfg, onUpdated) {
            openSettingsModal({
                id: `wf-wayfarerapp-marker-style-${statusKey}`,
                title: `Customise marker – ${label}`,
                buildContent(body) {
                    const section = document.createElement("div");
                    section.className = "wfmapmods-modal-section";

                    const desc = document.createElement("div");
                    desc.style.fontSize = "11px";
                    desc.style.marginBottom = "6px";
                    desc.textContent = "Adjust how this status appears on the map. Changes will be applied when you click OK.";
                    section.appendChild(desc);

                    const form = document.createElement("div");
                    form.style.display = "grid";
                    form.style.gridTemplateColumns = "max-content 1fr";
                    form.style.rowGap = "4px";
                    form.style.columnGap = "8px";
                    form.style.alignItems = "center";

                    function makeLabel(text) {
                        const labelEl = document.createElement("label");
                        labelEl.textContent = text;
                        labelEl.style.fontSize = "11px";
                        return labelEl;
                    }

                    function makeColorInput(value) {
                        const input = document.createElement("input");
                        input.type = "color";
                        input.value = value;
                        input.style.width = "40px";
                        input.style.padding = "0";
                        return input;
                    }

                    function makeNumberInput(value, min, max, step) {
                        const input = document.createElement("input");
                        input.type = "number";
                        input.value = value;
                        input.min = String(min);
                        input.max = String(max);
                        input.step = String(step);
                        input.style.width = "70px";
                        input.style.fontSize = "11px";
                        input.style.padding = "2px 4px";
                        input.style.boxSizing = "border-box";
                        return input;
                    }

                    const previewLabel = document.createElement("div");
                    previewLabel.textContent = "Preview";
                    previewLabel.style.marginTop = "8px";
                    previewLabel.style.marginBottom = "4px";
                    previewLabel.style.fontSize = "11px";
                    previewLabel.style.fontWeight = "bold";

                    const preview = document.createElement("div");
                    preview.style.display = "inline-block";
                    preview.style.borderRadius = "50%";
                    preview.style.boxSizing = "border-box";

                    const strokeColorInput = makeColorInput(cfg.strokeColor || "#000000");
                    const strokeOpacityInput = makeNumberInput(cfg.strokeOpacity ?? 1.0, 0, 1, 0.05);
                    const strokeWidthInput = makeNumberInput(cfg.strokeWeight ?? 2, 0, 10, 0.5);
                    const fillColorInput = makeColorInput(cfg.fillColor || "#000000");
                    const fillOpacityInput = makeNumberInput(cfg.fillOpacity ?? 0.5, 0, 1, 0.05);
                    const scaleInput = makeNumberInput(cfg.scale ?? 8, 2, 30, 1);

                    form.appendChild(makeLabel("Line colour"));
                    form.appendChild(strokeColorInput);

                    form.appendChild(makeLabel("Line opacity"));
                    form.appendChild(strokeOpacityInput);

                    form.appendChild(makeLabel("Line width"));
                    form.appendChild(strokeWidthInput);

                    form.appendChild(makeLabel("Fill colour"));
                    form.appendChild(fillColorInput);

                    form.appendChild(makeLabel("Fill opacity"));
                    form.appendChild(fillOpacityInput);

                    form.appendChild(makeLabel("Size"));
                    form.appendChild(scaleInput);

                    function updatePreview() {
                        const strokeColor = strokeColorInput.value || "#000000";
                        const strokeOpacity = clamp(strokeOpacityInput.value, 0, 1, 1.0);
                        const strokeWidth = clamp(strokeWidthInput.value, 0, 10, 2);
                        const fillColor = fillColorInput.value || "#000000";
                        const fillOpacity = clamp(fillOpacityInput.value, 0, 1, 0.5);
                        const scale = clamp(scaleInput.value, 2, 30, 8);

                        const sizePx = scale * 2;
                        preview.style.width = `${sizePx}px`;
                        preview.style.height = `${sizePx}px`;
                        preview.style.border = `${strokeWidth}px solid ${hexToRgba(strokeColor, strokeOpacity)}`;
                        preview.style.backgroundColor = hexToRgba(fillColor, fillOpacity);
                    }

                    [
                        strokeColorInput,
                        strokeOpacityInput,
                        strokeWidthInput,
                        fillColorInput,
                        fillOpacityInput,
                        scaleInput
                    ].forEach(el => el.addEventListener("input", updatePreview));

                    updatePreview();

                    section.appendChild(form);
                    section.appendChild(previewLabel);
                    section.appendChild(preview);
                    body.appendChild(section);

                    return {
                        strokeColorInput,
                        strokeOpacityInput,
                        strokeWidthInput,
                        fillColorInput,
                        fillOpacityInput,
                        scaleInput
                    };
                },
                onOk(ctx, closeModal) {
                    const {
                        strokeColorInput,
                        strokeOpacityInput,
                        strokeWidthInput,
                        fillColorInput,
                        fillOpacityInput,
                        scaleInput
                    } = ctx;

                    cfg.strokeColor = strokeColorInput.value || cfg.strokeColor || "#6b7280";
                    cfg.strokeOpacity = clamp(strokeOpacityInput.value, 0, 1, cfg.strokeOpacity ?? 1.0);
                    cfg.strokeWeight = clamp(strokeWidthInput.value, 0, 10, cfg.strokeWeight ?? 2);
                    cfg.fillColor = fillColorInput.value || cfg.fillColor || "#6b7280";
                    cfg.fillOpacity = clamp(fillOpacityInput.value, 0, 1, cfg.fillOpacity ?? 0.5);
                    cfg.scale = clamp(scaleInput.value, 2, 30, cfg.scale ?? 8);

                    if (typeof onUpdated === "function") {
                        onUpdated();
                    }

                    closeModal();
                }
            });
        }

        function openWayfarerAppMarkerSettingsWindow() {
            const markersCfgRoot = userSettings.markers || (userSettings.markers = {});
            const markersCfg = markersCfgRoot.statuses || (markersCfgRoot.statuses = {});

            if (!markersCfg.DEFAULT) {
                markersCfg.DEFAULT = {
                    strokeColor: "#6b7280",
                    strokeWeight: 2,
                    strokeOpacity: 1.0,
                    fillColor: "#6b7280",
                    fillOpacity: 0.5,
                    scale: 8,
                    enabled: true
                };
            }

            const STATUS_ROWS = [
                { key: "ACCEPTED", label: "Accepted" },
                { key: "REJECTED", label: "Rejected" }
            ];

            function ensureCfgForStatus(key) {
                if (!markersCfg[key]) {
                    const d = markersCfg.DEFAULT;
                    markersCfg[key] = {
                        strokeColor: d.strokeColor,
                        strokeWeight: d.strokeWeight,
                        strokeOpacity: d.strokeOpacity,
                        fillColor: d.fillColor,
                        fillOpacity: d.fillOpacity,
                        scale: d.scale,
                        enabled: d.enabled
                    };
                }
                return markersCfg[key];
            }

            openSettingsModal({
                id: "wf-wayfarerapp-marker-backdrop",
                title: "Wayfarer App submissions – marker options",
                buildContent(dialog) {
                    const container = document.createElement("div");
                    container.className = "wfmapmods-modal-section";

                    // Import section
                    const importSection = document.createElement("div");
                    importSection.style.marginBottom = "10px";
                    importSection.style.padding = "6px 8px";
                    importSection.style.borderRadius = "4px";
                    importSection.style.background = "#eff6ff";
                    importSection.style.border = "1px solid #bfdbfe";

                    const importTitle = document.createElement("div");
                    importTitle.style.fontSize = "11px";
                    importTitle.style.fontWeight = "bold";
                    importTitle.style.marginBottom = "4px";
                    importTitle.textContent = "Import Wayfarer App submissions from Geospatial Browser";

                    const importDesc = document.createElement("div");
                    importDesc.style.fontSize = "11px";
                    importDesc.style.marginBottom = "6px";
                    importDesc.textContent = "Click this button to open Lightship Geospatial Browser in a new tab. Once it loads your submitted POIs, they will be sent back to this page and displayed on the map.";

                    const importBtn = document.createElement("button");
                    importBtn.type = "button";
                    importBtn.textContent = "Import from Geospatial Browser";
                    importBtn.style.fontSize = "11px";
                    importBtn.style.padding = "4px 8px";
                    importBtn.style.cursor = "pointer";

                    importBtn.addEventListener("click", () => {
                        try {
                            window.open(
                                "https://lightship.dev/account/geospatial-browser/",
                                "wf-lightship-geospatial"
                            );
                        } catch (e) {
                            console.warn("[WFAppSub] Failed to open Lightship Geospatial Browser", e);
                        }
                    });

                    importSection.appendChild(importTitle);
                    importSection.appendChild(importDesc);
                    importSection.appendChild(importBtn);
                    container.appendChild(importSection);

                    // Performance section
                    const mapCfg = userSettings.map || (userSettings.map = {});
                    if (typeof mapCfg.performanceModeEnabled !== "boolean") {
                        mapCfg.performanceModeEnabled = true;
                    }
                    if (typeof mapCfg.performanceMaxVisibleMarkers !== "number") {
                        mapCfg.performanceMaxVisibleMarkers = PERFORMANCE_MAX_VISIBLE_MARKERS;
                    }

                    const perfRow = document.createElement("div");
                    perfRow.style.display = "flex";
                    perfRow.style.alignItems = "center";
                    perfRow.style.marginBottom = "8px";
                    perfRow.style.gap = "6px";

                    const perfCheckbox = document.createElement("input");
                    perfCheckbox.type = "checkbox";
                    perfCheckbox.id = "wf-wayfarerapp-performance-mode";
                    perfCheckbox.checked = !!mapCfg.performanceModeEnabled;

                    const perfLabel = document.createElement("label");
                    perfLabel.htmlFor = perfCheckbox.id;
                    perfLabel.style.fontSize = "11px";
                    perfLabel.textContent = "Improve performance when lots of markers";

                    const perfHelp = document.createElement("div");
                    perfHelp.style.fontSize = "10px";
                    perfHelp.style.color = "#6b7280";
                    perfHelp.style.marginLeft = "20px";
                    perfHelp.style.marginTop = "2px";
                    perfHelp.textContent = "Hides some markers at low zoom levels to prevent lag.";

                    perfRow.appendChild(perfCheckbox);
                    perfRow.appendChild(perfLabel);
                    container.appendChild(perfRow);
                    container.appendChild(perfHelp);

                    const hint = document.createElement("div");
                    hint.style.fontSize = "11px";
                    hint.style.margin = "8px 0 6px 0";
                    hint.textContent = "Choose which curation states to show on the map. Click \"Customise\" to adjust marker appearance.";
                    container.appendChild(hint);

                    const table = document.createElement("table");
                    table.className = "wfmapmods-circle-table";
                    Object.assign(table.style, {
                        width: "100%",
                        borderCollapse: "collapse",
                        fontSize: "11px"
                    });

                    function makeTH(text) {
                        const th = document.createElement("th");
                        th.textContent = text;
                        th.style.padding = "2px 4px";
                        th.style.textAlign = "left";
                        return th;
                    }

                    function makeTD() {
                        const td = document.createElement("td");
                        td.style.padding = "2px 4px";
                        td.style.verticalAlign = "middle";
                        return td;
                    }

                    const headerRow = document.createElement("tr");
                    const thStatus = makeTH("Status");
                    const thShow = makeTH("Show");
                    const thPreview = makeTH("Preview");
                    const thCustomise = makeTH(" ");
                    thShow.style.textAlign = "center";
                    thPreview.style.textAlign = "center";

                    headerRow.appendChild(thStatus);
                    headerRow.appendChild(thShow);
                    headerRow.appendChild(thPreview);
                    headerRow.appendChild(thCustomise);
                    table.appendChild(headerRow);

                    const ctx = {
                        rows: {},
                        perfCheckbox
                    };

                    STATUS_ROWS.forEach(({ key, label }) => {
                        const cfg = ensureCfgForStatus(key);

                        const row = document.createElement("tr");

                        const tdLabel = makeTD();
                        tdLabel.textContent = label;
                        tdLabel.style.whiteSpace = "nowrap";
                        row.appendChild(tdLabel);

                        const tdShow = makeTD();
                        tdShow.style.textAlign = "center";
                        const showChk = document.createElement("input");
                        showChk.type = "checkbox";
                        showChk.className = "wfmapmods-modal-checkbox";
                        showChk.checked = cfg.enabled !== false;
                        tdShow.appendChild(showChk);
                        row.appendChild(tdShow);

                        const tdPreview = makeTD();
                        tdPreview.style.textAlign = "center";
                        const preview = document.createElement("div");
                        preview.style.display = "inline-block";
                        preview.style.borderRadius = "50%";
                        preview.style.boxSizing = "border-box";
                        tdPreview.appendChild(preview);
                        row.appendChild(tdPreview);

                        const tdCustomise = makeTD();
                        tdCustomise.style.textAlign = "right";
                        const customiseBtn = document.createElement("button");
                        customiseBtn.type = "button";
                        customiseBtn.textContent = "Customise";
                        customiseBtn.style.background = "transparent";
                        customiseBtn.style.border = "none";
                        customiseBtn.style.cursor = "pointer";
                        customiseBtn.style.fontSize = "11px";
                        customiseBtn.style.textDecoration = "underline";
                        tdCustomise.appendChild(customiseBtn);
                        row.appendChild(tdCustomise);

                        table.appendChild(row);

                        function updatePreview() {
                            const strokeColor = cfg.strokeColor || "#000000";
                            const strokeOpacity = typeof cfg.strokeOpacity === "number" ? cfg.strokeOpacity : 1.0;
                            const strokeWidth = typeof cfg.strokeWeight === "number" ? cfg.strokeWeight : 2;
                            const fillColor = cfg.fillColor || "#000000";
                            const fillOpacity = typeof cfg.fillOpacity === "number" ? cfg.fillOpacity : 0.5;
                            const scale = typeof cfg.scale === "number" ? cfg.scale : 8;

                            const sizePx = scale * 2;
                            preview.style.width = `${sizePx}px`;
                            preview.style.height = `${sizePx}px`;
                            preview.style.border = `${strokeWidth}px solid ${hexToRgba(strokeColor, strokeOpacity)}`;
                            preview.style.backgroundColor = hexToRgba(fillColor, fillOpacity);
                        }

                        showChk.addEventListener("change", () => {
                            cfg.enabled = !!showChk.checked;
                        });

                        customiseBtn.addEventListener("click", () => {
                            openMarkerStyleModal(key, label, cfg, () => {
                                updatePreview();
                            });
                        });

                        updatePreview();

                        ctx.rows[key] = {
                            showChk,
                            preview,
                            cfg
                        };
                    });

                    container.appendChild(table);
                    dialog.appendChild(container);

                    return ctx;
                },
                onOk(ctx, closeModal) {
                    const mapCfg = userSettings.map || (userSettings.map = {});
                    mapCfg.performanceModeEnabled = !!(ctx.perfCheckbox && ctx.perfCheckbox.checked);
                    if (typeof mapCfg.performanceMaxVisibleMarkers !== "number") {
                        mapCfg.performanceMaxVisibleMarkers = PERFORMANCE_MAX_VISIBLE_MARKERS;
                    }

                    saveSettings();
                    clearSubmissionMarkers();
                    refreshSubmissionMarkers();
                    closeModal();
                }
            });
        }

        function openSettingsModal(options) {
            const {
                id,
                title,
                buildContent,
                onOk
            } = options || {};

            const existing = document.getElementById(id);
            if (existing && existing.parentNode) {
                existing.parentNode.removeChild(existing);
            }

            const backdrop = document.createElement("div");
            backdrop.id = id;
            backdrop.className = "wfmapmods-modal-backdrop";
            Object.assign(backdrop.style, {
                position: "fixed",
                inset: "0",
                background: "rgba(0,0,0,0.4)",
                zIndex: "9999",
                display: "flex",
                alignItems: "center",
                justifyContent: "center"
            });

            const dialog = document.createElement("div");
            dialog.className = "wfmapmods-modal-dialog";
            Object.assign(dialog.style, {
                background: "#fff",
                color: "#000",
                minWidth: "350px",
                maxWidth: "500px",
                maxHeight: "80vh",
                borderRadius: "4px",
                boxShadow: "0 2px 12px rgba(0,0,0,0.4)",
                display: "flex",
                flexDirection: "column",
                overflow: "hidden",
                fontSize: "13px"
            });

            const header = document.createElement("div");
            header.className = "wfmapmods-modal-header";
            Object.assign(header.style, {
                padding: "8px 12px",
                borderBottom: "1px solid " + "#ddd",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                fontWeight: "bold"
            });

            const titleEl = document.createElement("div");
            titleEl.textContent = title || "Settings";

            const closeBtn = document.createElement("button");
            closeBtn.type = "button";
            closeBtn.textContent = "×";
            Object.assign(closeBtn.style, {
                border: "none",
                background: "transparent",
                cursor: "pointer",
                fontSize: "16px",
                lineHeight: "1"
            });

            header.appendChild(titleEl);
            header.appendChild(closeBtn);

            const body = document.createElement("div");
            body.className = "wfmapmods-modal-body";
            Object.assign(body.style, {
                padding: "8px 12px",
                overflowY: "auto",
                flex: "1 1 auto"
            });

            const footer = document.createElement("div");
            footer.className = "wfmapmods-modal-footer";
            Object.assign(footer.style, {
                padding: "8px 12px",
                borderTop: "1px solid " + "#ddd",
                textAlign: "right",
                display: "flex",
                justifyContent: "flex-end",
                gap: "8px"
            });

            const cancelBtn = document.createElement("button");
            cancelBtn.type = "button";
            cancelBtn.textContent = "Cancel";
            Object.assign(cancelBtn.style, {
                padding: "4px 10px",
                cursor: "pointer"
            });

            const okBtn = document.createElement("button");
            okBtn.type = "button";
            okBtn.textContent = "OK";
            Object.assign(okBtn.style, {
                padding: "4px 10px",
                cursor: "pointer"
            });

            footer.appendChild(cancelBtn);
            footer.appendChild(okBtn);

            dialog.appendChild(header);
            dialog.appendChild(body);
            dialog.appendChild(footer);
            backdrop.appendChild(dialog);
            document.body.appendChild(backdrop);

            let ctx = null;
            if (typeof buildContent === "function") {
                ctx = buildContent(body, okBtn) || {};
            }

            function closeModal() {
                if (backdrop.parentNode) {
                    backdrop.parentNode.removeChild(backdrop);
                }
                document.removeEventListener("keydown", keyHandler);
            }

            function keyHandler(evt) {
                if (evt.key === "Escape") {
                    evt.stopPropagation();
                    closeModal();
                }
            }

            closeBtn.addEventListener("click", closeModal);
            cancelBtn.addEventListener("click", closeModal);

            okBtn.addEventListener("click", () => {
                if (typeof onOk === "function") {
                    onOk(ctx || {}, closeModal);
                } else {
                    closeModal();
                }
            });

            backdrop.addEventListener("click", (evt) => {
                if (evt.target === backdrop) {
                    closeModal();
                }
            });

            document.addEventListener("keydown", keyHandler);
        }

        // -----------------------------
        // POI bridge
        // -----------------------------

        function sendPoiToBridge(poi) {
            if (!poi) return;

            const bridge = document.getElementById(POI_BRIDGE_ID);
            if (!bridge) return;

            const payload = {
                guid: poi.poiId || poi.recordId || "",
                title: poi.title || "(untitled)",
                description: poi.description || "",
                lat: (typeof poi.lat === "number") ? poi.lat : null,
                lng: (typeof poi.lng === "number") ? poi.lng : null,
                imageUrl: poi.imageServingUrl || "",
                status: poi.curationState || "",
                source: POI_BRIDGE_SOURCE,
                dataSourceLogo: LIGHTSHIP_LOGO_SVG,
                dataSourceText: "Wayfarer App submission",
            };

            try {
                bridge.setAttribute("data-payload", JSON.stringify(payload));
            } catch (e) {
                console.warn("[WFAppSub] Failed to serialise POI for bridge", e);
            }
        }

        function setupBridgeSelectionWatcher() {
            const bridge = document.getElementById(POI_BRIDGE_ID);
            if (!bridge) return;

            if (bridge._wfWayfarerAppObserverAttached) return;
            bridge._wfWayfarerAppObserverAttached = true;

            const observer = new MutationObserver((mutations) => {
                for (const m of mutations) {
                    if (m.type !== "attributes" || m.attributeName !== "data-payload") continue;

                    const raw = bridge.getAttribute("data-payload");
                    if (!raw) {
                        clearSubmissionSelection();
                        continue;
                    }

                    let payload;
                    try {
                        payload = JSON.parse(raw);
                    } catch {
                        clearSubmissionSelection();
                        continue;
                    }

                    if (payload.source === POI_BRIDGE_SOURCE) {
                        return;
                    }

                    clearSubmissionSelection();
                }
            });

            observer.observe(bridge, {
                attributes: true,
                attributeFilter: ["data-payload"]
            });
        }

        // -----------------------------
        // Submission bridge
        // -----------------------------

        function sendResubmitToBase(poi) {
            if (!poi) return;

            const bridge = document.getElementById(SUBMISSION_BRIDGE_ID);
            if (!bridge) {
                console.warn("[WFAppSub] Submission bridge not found");
                return;
            }

            const mainUrl = normalizeImageUrl(poi.imageServingUrl || "");

            const supportingUrls = poi.supportingImageServingUrl
            ? [normalizeImageUrl(poi.supportingImageServingUrl)]
            : [];

            const payload = {
                source: POI_BRIDGE_SOURCE,
                poi: {
                    id: poi.recordId || poi.poiId || null,
                    title: poi.title || "",
                    description: poi.description || "",
                    supportingStatement: poi.supportingStatement || poi.statement || "",
                    lat: (typeof poi.lat === "number") ? poi.lat : null,
                    lng: (typeof poi.lng === "number") ? poi.lng : null
                },
                images: {
                    mainUrl,
                    supportingUrls
                }
            };

            try {
                bridge.setAttribute("data-submission", JSON.stringify(payload));
            } catch (e) {
                console.warn("[WFAppSub] Failed to serialise payload for submission bridge", e, payload);
            }
        }

        function normalizeImageUrl(url = "") {
            // Force original-resolution Google image URLs
            if (!url.startsWith("https://lh3.googleusercontent.com/")) return url;
            return url.replace(/=[a-z]\d+$/i, "") + "=s0";
        }

        // -----------------------------
        // Utility helpers
        // -----------------------------

        function clamp(value, min, max, defaultVal) {
            const n = parseFloat(value);
            if (Number.isNaN(n)) return defaultVal;
            if (n < min) return min;
            if (n > max) return max;
            return n;
        }

        function hexToRgba(hex, alpha) {
            hex = String(hex || "").trim();
            if (!hex) return `rgba(0,0,0,${alpha})`;

            if (hex[0] === "#") {
                hex = hex.slice(1);
            }
            if (hex.length === 3) {
                hex = hex.split("").map(ch => ch + ch).join("");
            }
            const num = parseInt(hex, 16);
            const r = (num >> 16) & 255;
            const g = (num >> 8) & 255;
            const b = num & 255;
            return `rgba(${r},${g},${b},${alpha})`;
        }

        // -----------------------------
        // postMessage import handler
        // -----------------------------

        function setupImportMessageListener() {
            window.addEventListener("message", (event) => {
                try {
                    const origin = event.origin || "";
                    if (
                        origin !== "https://lightship.dev" &&
                        origin !== "https://www.lightship.dev" &&
                        origin !== ""
                    ) {
                        return;
                    }

                    const data = event.data;
                    if (!data || data.type !== POSTMESSAGE_TYPE_IMPORT) return;

                    const submittedPois = Array.isArray(data.submittedPois) ? data.submittedPois : null;
                    if (!submittedPois) {
                        console.warn("[WFAppSub] Import message missing submittedPois");
                        return;
                    }

                    console.log("[WFAppSub] Received", submittedPois.length, "Wayfarer App submissions from Lightship");
                    appSubmissions = submittedPois;
                    saveAppSubmissionsToIDB(submittedPois);
                    refreshSubmissionMarkers();
                } catch (e) {
                    console.warn("[WFAppSub] Error handling import postMessage", e);
                }
            });
        }

        // -----------------------------
        // Bootstrap
        // -----------------------------

        function bootstrap() {
            loadSettings();
            loadAppSubmissionsFromIDB();
            startMapPanelWatcher();
            setupBridgeSelectionWatcher();
            setupImportMessageListener();
        }

        bootstrap();
    }

})();
