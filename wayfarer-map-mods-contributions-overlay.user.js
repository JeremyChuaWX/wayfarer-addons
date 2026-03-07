// ==UserScript==
// @name         Wayfarer Map Mods - Contributions Overlay
// @version      3.1.0
// @description  Loads nominations from the Contributions list and shows them as markers on the submission map
// @namespace    https://gitlab.com/Tntnnbltn/wayfarer-addons
// @downloadURL  https://gitlab.com/Tntnnbltn/wayfarer-addons/-/raw/main/wayfarer-map-mods-contributions-overlay.user.js
// @updateURL    https://gitlab.com/Tntnnbltn/wayfarer-addons/-/raw/main/wayfarer-map-mods-contributions-overlay.user.js
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

(function () {
    'use strict';

    // -----------------------------
    // Constants (config & IDs)
    // -----------------------------

    // Storage / settings
    const SETTINGS_KEY = "wfmap_contributions_settings";
    const OBJECT_STORE_NAME = "contributions";

    // Bridge IDs
    const POI_BRIDGE_ID = "wfmapmods-poi-bridge";
    const POI_BRIDGE_SOURCE = "wf-contrib-overlay";
    const SUBMISSION_BRIDGE_ID = "wfmapmods-submit-bridge";

    // Map URLs
    const SUBMIT_ROUTE = "/new/submit/new";
    const MAPVIEW_ROUTE = "/new/mapview";

    // Behaviour / performance
    const PERFORMANCE_MAX_VISIBLE_MARKERS = 200;

    // Status mapping for manage actions
    const MANAGE_ACTION_STATUS = {
        releasehold: "NOMINATED",
        hold: "HELD",
        withdraw: "WITHDRAWN",
        appeal: "APPEALED",
    };

    // Pending submissions tracking
    const PENDING_SUBMITS_KEY = "wfmap_contrib_pending_submits";
    const PENDING_SUBMIT_EXPIRY_MS = 6 * 60 * 1000; // 6 minutes

    // Wayfarer pin svg logo
    const WAYFARER_LOGO_SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 168.64822 385.63867"><g transform="translate(-1713.3254,-206.92756)"><path fill="#000000" d="m 1796.8177,206.93648 c -1.4336,0.0214 -2.8694,0.0811 -4.3086,0.17968 -46.5329,3.18681 -81.4741,42.22048 -79.0664,88.33008 0.6634,12.70543 1.194,14.21682 45.043,128.26758 12.3703,32.17497 22.7806,59.4 23.1328,60.5 0.9228,2.88168 3.7726,6.02575 7.6817,8.47656 7.3893,4.63273 19.8475,0.73709 23.4296,-7.32617 2.4087,-5.42181 55.0508,-143.34771 61.4317,-160.95508 6.7916,-18.74043 8.5934,-28.23315 7.5273,-39.66015 -2.0038,-21.47603 -10.6317,-39.26432 -26.3027,-54.23633 -16.3041,-15.57678 -37.0635,-23.89663 -58.5684,-23.57617 z m 0.6875,51.41406 a 33.067028,33.067028 0 0 1 33.0664,33.0664 33.067028,33.067028 0 0 1 -33.0664,33.06641 33.067028,33.067028 0 0 1 -33.0683,-33.06641 33.067028,33.067028 0 0 1 33.0683,-33.0664 z m 0.8184,269.64648 c -4.5709,-0.16021 -9.2407,0.67626 -13.7168,2.65625 -5.8988,2.6093 -13.0929,9.51789 -16.1582,15.51953 -3.6613,7.16844 -4.2239,17.96942 -1.3359,25.6211 3.4496,9.13947 10.5363,16.08888 19.9726,19.58789 5.5946,2.0745 18.5971,1.31232 24.1582,-1.41602 14.0914,-6.91328 21.5412,-22.84569 17.5488,-37.52539 -3.945,-14.50608 -16.7561,-23.96272 -30.4687,-24.44336 z" /></g></svg>';

    // -----------------------------
    // Global state – data & flags
    // -----------------------------

    // Nominations data / rules
    let nominations = null;
    let globalCanAppeal = null;

    // Map instance & attachment status
    let wfMap = null;
    let mapAttached = false;

    // Marker objects keyed by nominationId
    let nominationMarkers = {};

    // Selection tracking
    let lastSelectedNominationId = null;
    let lastSelectedNomMarker = null;
    let lastSelectedNomOriginalIcon = null;

    // UI / DOM state flags
    let mapPanelObserver = null;
    let mapPanelMutationScheduled = false;

    // Pending submissions created via /submit/now
    let pendingSubmissions = {};          // id -> { id, title, description, lat, lng, submittedAt }
    let pendingSubmissionMarkers = {};    // id -> google.maps.Marker
    let pendingSubmissionTimers = {};     // id -> timeout ID (for 3-minute recheck)
    let pendingSubmissionsLoaded = false; // avoid double-load from localStorage

    // -----------------------------
    // Settings (defaults + storage)
    // -----------------------------

    // Default marker config lives here and can be overridden by localStorage.
    const userSettings = {
        map: {
            performanceModeEnabled: true,
            contributionsEnabled: true
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

                NOMINATED: {
                    "strokeColor": "#7a7a7a",
                    "strokeWeight": 2,
                    "strokeOpacity": 1,
                    "fillColor": "#bababa",
                    "fillOpacity": 0.6,
                    "scale": 8,
                    "enabled": true
                },

                VOTING: {
                    "strokeColor": "#477eff",
                    "strokeWeight": 2,
                    "strokeOpacity": 1,
                    "fillColor": "#3dbef5",
                    "fillOpacity": 0.6,
                    "scale": 8,
                    "enabled": true
                },

                NIANTIC_REVIEW: {
                    "strokeColor": "#002ec7",
                    "strokeWeight": 2,
                    "strokeOpacity": 1,
                    "fillColor": "#002ec7",
                    "fillOpacity": 0.6,
                    "scale": 8,
                    "enabled": true
                },

                APPEALED: {
                    "strokeColor": "#7013fb",
                    "strokeWeight": 2,
                    "strokeOpacity": 1,
                    "fillColor": "#992af4",
                    "fillOpacity": 0.6,
                    "scale": 8,
                    "enabled": true
                },

                HELD: {
                    "strokeColor": "#e4dc07",
                    "strokeWeight": 2,
                    "strokeOpacity": 1,
                    "fillColor": "#fcff33",
                    "fillOpacity": 0.65,
                    "scale": 8,
                    "enabled": true
                },

                WITHDRAWN: {
                    "strokeColor": "#383838",
                    "strokeWeight": 2,
                    "strokeOpacity": 1,
                    "fillColor": "#4d4d4d",
                    "fillOpacity": 0.6,
                    "scale": 8,
                    "enabled": true
                },

                REJECTED: {
                    "strokeColor": "#bd0000",
                    "strokeWeight": 2,
                    "strokeOpacity": 1,
                    "fillColor": "#f50000",
                    "fillOpacity": 0.6,
                    "scale": 8,
                    "enabled": true
                },

                DUPLICATE: {
                    "strokeColor": "#bd0000",
                    "strokeWeight": 2,
                    "strokeOpacity": 1,
                    "fillColor": "#f50000",
                    "fillOpacity": 0.6,
                    "scale": 8,
                    "enabled": true
                },

                ACCEPTED: {
                    "strokeColor": "#22c55e",
                    "strokeWeight": 2,
                    "strokeOpacity": 1,
                    "fillColor": "#22c55e",
                    "fillOpacity": 0,
                    "scale": 14,
                    "enabled": true
                }

            }
        }
    };

    // -----------------------------
    // Saving and Loading User Settings
    // -----------------------------

    function mergeDeep(target, source) {
        for (const key in source) {
            const srcVal = source[key];
            const tgtVal = target[key];

            if (
                typeof srcVal === "object" &&
                srcVal !== null &&
                !Array.isArray(srcVal)
            ) {
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
    // Indexed DB - Nomination Storage
    // -----------------------------

    // Opens an IDB database connection for wayfarer-tools-db.
    // IMPORTANT: you must call db.close() after using the returned db.
    const getIDBInstance = (version) => new Promise((resolve, reject) => {
        'use strict';

        if (!window.indexedDB) {
            reject("This browser doesn't support IndexedDB!");
            return;
        }

        const openRequest = indexedDB.open("wayfarer-tools-db", version);

        openRequest.onsuccess = (event) => {
            const db = event.target.result;
            const dbVer = db.version;
            console.log(`IndexedDB initialization complete (database version ${dbVer}).`);
            if (!db.objectStoreNames.contains(OBJECT_STORE_NAME)) {
                db.close();
                console.log(`Database does not contain store ${OBJECT_STORE_NAME}. Closing and incrementing version.`);
                getIDBInstance(dbVer + 1).then(resolve, reject);
            } else {
                resolve(db);
            }
        };

        openRequest.onupgradeneeded = (event) => {
            console.log("Upgrading database...");
            const db = event.target.result;
            if (!db.objectStoreNames.contains(OBJECT_STORE_NAME)) {
                db.createObjectStore(OBJECT_STORE_NAME, { keyPath: "id" });
            }
        };

        openRequest.onerror = (event) => {
            reject(event.target.error || "Failed to open IndexedDB");
        };
    });

    // Load all contributions from IndexedDB into `nominations`
    function loadNominationsFromIDB() {
        getIDBInstance().then(db => {
            const tx = db.transaction(OBJECT_STORE_NAME, "readonly");
            const store = tx.objectStore(OBJECT_STORE_NAME);
            const req = store.getAll();

            req.onsuccess = () => {
                const results = req.result || [];
                nominations = results;
                // If the map is already ready, this will draw; if not, refreshNominationMarkers will no-op.
                refreshNominationMarkers();
                db.close();
            };

            req.onerror = () => {
                console.warn("[ContribOverlay] Failed to read contributions from IndexedDB", req.error);
                db.close();
            };
        }).catch(err => {
            console.warn("[ContribOverlay] IndexedDB not available:", err);
        });
    }

    // Overwrite the contributions store with the latest submissions
    function saveNominationsToIDB(submissions) {
        if (!Array.isArray(submissions)) return;

        getIDBInstance().then(db => {
            const tx = db.transaction(OBJECT_STORE_NAME, "readwrite");
            const store = tx.objectStore(OBJECT_STORE_NAME);

            // Clear existing store, then write fresh data
            const clearReq = store.clear();

            clearReq.onsuccess = () => {
                submissions.forEach(sub => {
                    if (!sub || !sub.id) return;
                    store.put(sub); // upsert by keyPath 'id'
                });
            };

            clearReq.onerror = () => {
                console.warn("[ContribOverlay] Failed to clear contributions store", clearReq.error);
            };

            tx.oncomplete = () => {
                db.close();
            };

            tx.onerror = () => {
                console.warn("[ContribOverlay] Transaction error while saving contributions", tx.error);
                db.close();
            };
        }).catch(err => {
            console.warn("[ContribOverlay] IndexedDB not available (save):", err);
        });
    }

    function updateSingleNominationStatus(id, newStatus) {
        if (!id || !newStatus) return;

        let updatedNom = null;

        // --- Update in-memory nominations ---
        if (Array.isArray(nominations)) {
            const nom = nominations.find(n => n.id === id);
            if (nom) {
                nom.status = newStatus;
                updatedNom = nom;
            }
        }

        // --- Update IndexedDB (upsert only this record) ---
        getIDBInstance().then(db => {
            const tx = db.transaction(OBJECT_STORE_NAME, "readwrite");
            const store = tx.objectStore(OBJECT_STORE_NAME);

            if (updatedNom) {
                store.put(updatedNom);
            }

            tx.oncomplete = () => {
                db.close();

                // Refresh markers to reflect new status colours
                refreshNominationMarkers();

                // If this nomination is currently selected, update the side panel
                if (updatedNom &&
                    nominationMarkers &&
                    nominationMarkers[id] === lastSelectedNomMarker) {

                    lastSelectedNominationId = id;
                    sendPoiToBridge(updatedNom);
                    updateNominationActionLinks(updatedNom);
                }
            };

            tx.onerror = () => {
                console.warn("[ContribOverlay] Transaction error while updating a nomination", tx.error);
                db.close();
            };
        }).catch(err => {
            console.warn("[ContribOverlay] IndexedDB not available:", err);
        });
    }

    function updateSingleNominationDetails(id, updates) {
        if (!id || !updates) return;

        let updatedNom = null;

        // --- Update in-memory nominations ---
        if (Array.isArray(nominations)) {
            const nom = nominations.find(n => n.id === id);
            if (nom) {
                if (Object.prototype.hasOwnProperty.call(updates, "title")) {
                    nom.title = updates.title;
                }
                if (Object.prototype.hasOwnProperty.call(updates, "description")) {
                    nom.description = updates.description;
                }
                if (Object.prototype.hasOwnProperty.call(updates, "supporting")) {
                    // stored as "statement" in the data
                    nom.statement = updates.supporting;
                }
                updatedNom = nom;
            }
        }

        if (!updatedNom) return;

        // --- Update IndexedDB (upsert only this record) ---
        getIDBInstance().then(db => {
            const tx = db.transaction(OBJECT_STORE_NAME, "readwrite");
            const store = tx.objectStore(OBJECT_STORE_NAME);

            store.put(updatedNom);

            tx.oncomplete = () => {
                db.close();

                // Update marker title if it exists
                const marker = nominationMarkers && nominationMarkers[id];
                if (marker && typeof marker.setTitle === "function") {
                    const statusStr = String(updatedNom.status || "").toUpperCase() || "UNKNOWN";
                    marker.setTitle(`${updatedNom.title || "No title"} (${statusStr})`);
                }

                // If this nomination is currently selected, update the side panel
                if (nominationMarkers &&
                    nominationMarkers[id] === lastSelectedNomMarker) {
                    sendPoiToBridge(updatedNom);
                    updateNominationActionLinks(updatedNom);
                }
            };

            tx.onerror = () => {
                console.warn("[ContribOverlay] Transaction error while updating nomination details", tx.error);
                db.close();
            };
        }).catch(err => {
            console.warn("[ContribOverlay] IndexedDB not available:", err);
        });
    }

    // -----------------------------
    // Network & Wayfarer API Integration
    // -----------------------------

    /**
     * Monkey-patch XMLHttpRequest to:
     *  - watch GET /api/v1/vault/manage responses and update local nominations
     *  - watch POST /api/v1/vault/manage/* actions and update local status
     *  - watch POST /api/v1/vault/submit/now and track successful submissions
     */
    (function (open, send) {
        XMLHttpRequest.prototype.open = function (method, url) {
            // Normalise method + URL and store them for use in send()
            const upperMethod = (method || "GET").toUpperCase();
            const cleanUrl = typeof url === "string" ? url.split("?")[0] : url;

            this._wfmapmodsMethod = upperMethod;
            this._wfmapmodsUrl = cleanUrl;

            // Attach handler for responses listing nominations
            if (upperMethod === "GET" && cleanUrl === "/api/v1/vault/manage") {
                this.addEventListener("load", parseNominationsFromResponse, false);
            }

            // Map manage endpoints to their resulting nomination status
            const ACTIONS = {
                "/api/v1/vault/manage/hold":        "HELD",
                "/api/v1/vault/manage/releasehold": "NOMINATED",
                "/api/v1/vault/manage/withdraw":    "WITHDRAWN",
                "/api/v1/vault/manage/appeal":      "APPEALED",
            };

            // Track successful POSTs to manage endpoints so we can update local state
            if (upperMethod === "POST" && ACTIONS[cleanUrl]) {
                this._wfmapmodsNewStatus = ACTIONS[cleanUrl];

                this.addEventListener("load", function () {
                    try {
                        const response = this.responseText || this.response;
                        const json = response ? JSON.parse(response) : null;
                        if (!json || json.captcha) return;
                        if (json.result !== "DONE") return;

                        const id = this._wfmapmodsId;
                        if (!id) return;

                        updateSingleNominationStatus(id, this._wfmapmodsNewStatus);

                    } catch (err) {
                        console.warn("[ContribOverlay] Error handling manage action:", err);
                    }
                }, false);
            }

            // Track successful POST /api/v1/vault/submit/now
            if (upperMethod === "POST" && cleanUrl === "/api/v1/vault/submit/now") {
                this.addEventListener("load", function () {
                    try {
                        const response = this.responseText || this.response;
                        const json = response ? JSON.parse(response) : null;

                        if (!json || json.captcha) {
                            console.warn("[ContribOverlay] submit/now response missing or captcha required");
                            return;
                        }

                        if (json.result !== "DONE") {
                            console.warn("[ContribOverlay] submit/now did not succeed:", json);
                            return;
                        }

                        const payload = this._wfmapmodsSubmitNowPayload;
                        if (!payload) {
                            console.warn("[ContribOverlay] submit/now succeeded but no payload was captured");
                            return;
                        }

                        console.log("[ContribOverlay] submit/now success via XHR:", payload);
                        handleSubmitNowPayload(payload);

                    } catch (err) {
                        console.warn("[ContribOverlay] Error handling submit/now response:", err);
                    }
                }, false);
            }

            // Let the original open() run
            return open.apply(this, arguments);
        };

        XMLHttpRequest.prototype.send = function (body) {
            const method = this._wfmapmodsMethod || "GET";
            const url = this._wfmapmodsUrl || "";

            // Extract the nomination id from /manage POST bodies so we can match on success
            if (this._wfmapmodsNewStatus && body) {
                try {
                    if (typeof body === "string") {
                        const parsed = JSON.parse(body);
                        const payload = Array.isArray(parsed) ? parsed[0] : parsed;
                        if (payload && payload.id) {
                            this._wfmapmodsId = payload.id;
                        }
                    }
                } catch (err) {
                    console.warn("[ContribOverlay] Failed to parse manage action payload:", err);
                }
            }

            // Detect POST /api/v1/vault/submit/now and store payload for success handling on load
            if (method === "POST" && url === "/api/v1/vault/submit/now" && body) {
                try {
                    if (typeof body === "string") {
                        const payload = JSON.parse(body);
                        console.log("[ContribOverlay] Detected submit/now via XHR:", payload);
                        this._wfmapmodsSubmitNowPayload = payload;
                    } else {
                        console.log("[ContribOverlay] submit/now body is not a string:", body);
                    }
                } catch (e) {
                    console.warn("[ContribOverlay] Failed to parse submit/now payload:", e);
                }
            }

            // Let the original send() run
            return send.apply(this, arguments);
        };

    })(XMLHttpRequest.prototype.open, XMLHttpRequest.prototype.send);

    /**
     * Fetch the latest nominations list directly from the Wayfarer API
     * and push the result into local state / markers.
     */
    function fetchLatestNominations() {
        return fetch("/api/v1/vault/manage", {
            method: "GET",
            credentials: "include"
        })
            .then(res => {
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            return res.json();
        })
            .then(json => {
            handleNominationsJson(json);
        })
            .catch(err => {
            console.warn("[ContribOverlay] Failed to fetch latest nominations:", err);
        });
    }

    /**
     * XHR 'load' handler used by the monkey-patch above.
     * Parses the nominations JSON from the response and delegates to handleNominationsJson.
     */
    function parseNominationsFromResponse() {
        try {
            const response = this.responseText || this.response;
            const json = JSON.parse(response);
            handleNominationsJson(json);
        } catch (e) {
            console.log("[ContribOverlay] Error parsing nominations:", e);
        }
    }

    /**
     * Take a nominations payload from the Wayfarer API and:
     *  - update global appeals availability
     *  - cache nominations
     *  - refresh map markers
     *  - refresh action links if a nomination is currently selected
     */
    function handleNominationsJson(json) {
        if (!json) {
            console.log("[ContribOverlay] No JSON payload for nominations");
            return;
        }

        // Ignore responses that are only for captchas
        if (json.captcha) return;

        const result = json.result || {};
        const submissions = result.submissions;
        if (!submissions) {
            console.log("[ContribOverlay] Wayfarer response did not include submissions.");
            return;
        }

        // Global flag indicating whether appeals are currently allowed
        globalCanAppeal = typeof result.canAppeal === "boolean"
            ? result.canAppeal
        : null;

        nominations = submissions;
        saveNominationsToIDB(submissions);
        refreshNominationMarkers();

        // If a nomination is currently selected, refresh its action links
        if (lastSelectedNominationId && Array.isArray(nominations)) {
            const selected = nominations.find(n => n.id === lastSelectedNominationId);
            if (selected) {
                updateNominationActionLinks(selected);
            }
        }

        // Try to match any locally pending submissions against this fresh /manage data
        reconcilePendingSubmissionsWithManageList();
    }

    /**
     * Returns the value of a cookie by name, or null if not present.
     */
    function getCookie(name) {
        const match = document.cookie.match(new RegExp("(^|; )" + name + "=([^;]*)"));
        return match ? decodeURIComponent(match[2]) : null;
    }

    /**
     * Returns the CSRF token expected by the Wayfarer API, or an empty string.
     */
    function getCsrfToken() {
        return getCookie("XSRF-TOKEN") || "";
    }

    /**
     * Trigger a manage action (hold, releasehold, withdraw, appeal) for a nomination.
     * The XHR monkey-patch will listen to the response and update local state if successful.
     */
    function sendManageActionForNomination(action, nominationId) {
        if (!action || !nominationId) return;

        const xhr = new XMLHttpRequest();
        xhr.open("POST", `/api/v1/vault/manage/${action}`, true);
        xhr.withCredentials = true;

        xhr.setRequestHeader("Content-Type", "application/json;charset=UTF-8");

        const csrfToken = getCsrfToken();
        if (csrfToken) {
            xhr.setRequestHeader("x-csrf-token", csrfToken);
        }

        xhr.send(JSON.stringify({ id: nominationId }));
    }

    /**
     * Send an edit for a nomination (title/description/supporting text).
     * On success, updates the local nomination data and invokes onDone().
     */
    function sendEditSubmission(nominationId, updates, onDone) {
        if (!nominationId || !updates) return;

        const xhr = new XMLHttpRequest();
        xhr.open("POST", "/api/v1/vault/manage/edit", true);
        xhr.withCredentials = true;

        xhr.setRequestHeader("Content-Type", "application/json;charset=UTF-8");

        const csrfToken = getCsrfToken();
        if (csrfToken) {
            xhr.setRequestHeader("x-csrf-token", csrfToken);
        }

        const payload = {
            id: nominationId,
            title: updates.title,
            description: updates.description,
            supporting: updates.supporting
        };

        xhr.onload = function () {
            if (xhr.status !== 200) {
                console.warn("[ContribOverlay] Edit submission failed with status", xhr.status);
                return;
            }

            let json = null;
            try {
                json = JSON.parse(xhr.responseText || "{}");
            } catch (e) {
                console.warn("[ContribOverlay] Failed to parse edit response", e);
                return;
            }

            if (!json || json.result !== "DONE") {
                console.warn("[ContribOverlay] Edit submission not accepted by server", json);

                const message =
                      json?.message ||
                      "An unknown error occurred while submitting the edit.";

                alert("Edit failed:\n\n" + message);
                return;
            }

            // Update local data + UI
            updateSingleNominationDetails(nominationId, updates);

            if (typeof onDone === "function") {
                onDone();
            }
        };

        xhr.onerror = function () {
            console.warn("[ContribOverlay] Network error calling /manage/edit");
        };

        xhr.send(JSON.stringify(payload));
    }

    /**
     * Send an appeal for a nomination.
     * On success, refetches the nominations to refresh appeal state and invokes onDone().
     */
    function sendAppeal(nominationId, statement, onDone) {
        if (!nominationId || !statement) return;

        const xhr = new XMLHttpRequest();
        xhr.open("POST", "/api/v1/vault/manage/appeal", true);
        xhr.withCredentials = true;

        xhr.setRequestHeader("Content-Type", "application/json;charset=UTF-8");

        const csrfToken = getCsrfToken();
        if (csrfToken) {
            xhr.setRequestHeader("x-csrf-token", csrfToken);
        }

        const payload = {
            id: nominationId,
            statement: statement
        };

        xhr.onload = function () {
            if (xhr.status !== 200) {
                console.warn("[ContribOverlay] Appeal request failed with status", xhr.status);
                return;
            }

            let json = null;
            try {
                json = JSON.parse(xhr.responseText || "{}");
            } catch (e) {
                console.warn("[ContribOverlay] Failed to parse appeal response", e);
                return;
            }

            if (!json || json.captcha || json.result !== "DONE") {
                console.warn("[ContribOverlay] Appeal not accepted by server", json);
                return;
            }

            // After a successful appeal, refetch nominations to get updated appeal availability
            globalCanAppeal = null;
            fetchLatestNominations();

            if (typeof onDone === "function") {
                onDone();
            }
        };

        xhr.onerror = function () {
            console.warn("[ContribOverlay] Network error calling /manage/appeal");
        };

        xhr.send(JSON.stringify(payload));
    }

    // -----------------------------
    // Pending submissions tracking
    // -----------------------------

    /**
     * Load pending submissions from localStorage into memory.
     * Also prunes any entries older than the expiry window.
     */
    function loadPendingSubmissionsFromLocalStorage() {
        if (pendingSubmissionsLoaded) return;
        pendingSubmissionsLoaded = true;

        pendingSubmissions = {};

        try {
            const raw = window.localStorage.getItem(PENDING_SUBMITS_KEY);
            if (!raw) return;

            const arr = JSON.parse(raw);
            if (!Array.isArray(arr)) return;

            const now = Date.now();

            arr.forEach(entry => {
                if (!entry || typeof entry !== "object") return;

                const { id, title, description, lat, lng, submittedAt } = entry;

                if (!id) return;
                if (typeof lat !== "number" || typeof lng !== "number") return;
                if (typeof submittedAt !== "number") return;

                // Drop entries older than expiry window
                if (now - submittedAt > PENDING_SUBMIT_EXPIRY_MS) return;

                pendingSubmissions[id] = {
                    id,
                    title: title || "",
                    description: description || "",
                    lat,
                    lng,
                    submittedAt
                };
            });
        } catch (e) {
            console.warn("[ContribOverlay] Failed to load pending submissions from localStorage:", e);
        }
    }

    /**
     * Persist current pending submissions to localStorage as an array.
     */
    function savePendingSubmissionsToLocalStorage() {
        try {
            const arr = Object.values(pendingSubmissions);
            window.localStorage.setItem(PENDING_SUBMITS_KEY, JSON.stringify(arr));
        } catch (e) {
            console.warn("[ContribOverlay] Failed to save pending submissions to localStorage:", e);
        }
    }

    /**
 * Create a map marker for a pending submission, if the map is attached
 * and the Contributions layer is enabled. Clicking the marker will:
 *  - highlight it
 *  - send a POI-like payload to the shared POI bridge
 *  - clear any nomination action links (pending submissions have no actions)
 */
    function createPendingSubmissionMarker(pending) {
        if (!wfMap) return;

        const mapCfg = userSettings.map || {};
        if (mapCfg.contributionsEnabled === false) return;

        if (typeof pending.lat !== "number" || typeof pending.lng !== "number") return;

        const cfg = getMarkerConfigForStatus("NOMINATED");

        const marker = new google.maps.Marker({
            map: wfMap,
            position: { lat: pending.lat, lng: pending.lng },
            title: `${pending.title || "Pending nomination"} (NOMINATED – syncing…)`,
            icon: {
                path: google.maps.SymbolPath.CIRCLE,
                fillColor: cfg.fillColor,
                fillOpacity: cfg.fillOpacity,
                strokeColor: cfg.strokeColor,
                strokeOpacity: cfg.strokeOpacity,
                strokeWeight: cfg.strokeWeight,
                scale: cfg.scale,
                optimized: false,
            }
        });

        marker.addListener("click", () => {
            // Visually select this marker
            selectNominationMarker(marker);

            // Pending submissions do not have a /manage id yet
            lastSelectedNominationId = null;

            // Build a POI-like object for the bridge and sidebar logic
            const pendingPoi = {
                id: null,
                type: "PENDING", // ensures updateNominationActionLinks will hide actions
                title: pending.title || "",
                description: pending.description || "",
                lat: pending.lat,
                lng: pending.lng,
                status: "NOMINATED",
                imageUrl: pending.imageUrl || "" // if you ever add this to pending entries
            };

            // Notify other scripts via the POI bridge
            sendPoiToBridge(pendingPoi);

            // Pending items have no server-side actions (hold/withdraw/appeal etc.)
            hideNominationActionLinks();
        });

        pendingSubmissionMarkers[pending.id] = marker;
    }


    /**
     * Remove all pending submission markers from the map and clear the cache.
     */
    function clearPendingSubmissionMarkers() {
        Object.values(pendingSubmissionMarkers).forEach(marker => {
            if (marker && typeof marker.setMap === "function") {
                marker.setMap(null);
            }
        });
        pendingSubmissionMarkers = {};
    }

    /**
     * Schedule the next reconciliation check for a pending submission.
     *
     * The backend processes submissions every 3 minutes (:00, :03, :06…).
     * This script checks:
     *   • 30 seconds after the first expected processing time
     *   • 1 minute after that processing time
     *   • Every 3 minutes thereafter until the pending item resolves
     *
     * The first processing time is the earliest batch that is >= the submission
     * time (including exact batch-boundary submissions). Future checks always
     * advance in 3-minute intervals and are scheduled only for times in the future.
     *
     * Each scheduled check triggers fetchLatestNominations(); reconciliation logic
     * removes matched items or discards entries older than the expiry window.
     *
     *
     * @param {string} id - Pending submission identifier
     */
    function schedulePendingSubmissionRecheck(id) {
        const pending = pendingSubmissions[id];
        if (!pending) return;

        const submittedAt = pending.submittedAt;
        if (typeof submittedAt !== "number") return;

        const now = Date.now();

        // Compute the earliest backend batch time (minute % 3 === 0, seconds=0)
        // that is >= submittedAt, with special handling for exact boundaries.
        function computeFirstBatchTime(afterTimestamp) {
            const d = new Date(afterTimestamp);

            const submittedSeconds = d.getSeconds();
            const submittedMs = d.getMilliseconds();

            // Work from a minute-truncated copy
            d.setSeconds(0, 0);

            let minute = d.getMinutes();
            const minuteMod = minute % 3;
            const baseMinute = minute - minuteMod; // floor to nearest multiple of 3

            d.setMinutes(baseMinute);

            const candidateBatch = d.getTime();

            // If we're exactly on the batch boundary, keep it
            if (
                candidateBatch === afterTimestamp &&
                submittedSeconds === 0 &&
                submittedMs === 0
            ) {
                return candidateBatch;
            }

            // Otherwise, if the batch time is before the submission, move to the next batch
            if (candidateBatch < afterTimestamp) {
                return candidateBatch + 3 * 60 * 1000; // +3 minutes
            }

            return candidateBatch;
        }

        const firstBatchTime = computeFirstBatchTime(submittedAt);
        const firstCheckTime = firstBatchTime + 1 * 60 * 1000;   // batch + 1 minute
        const preCheckTime   = firstCheckTime - 30 * 1000;       // 30 seconds before first check

        let nextCheckTime;
        const stepMs = 3 * 60 * 1000; // 3 minutes

        if (now <= preCheckTime) {
            // Earliest opportunity: 30 seconds before the first full check
            nextCheckTime = preCheckTime;
        } else if (now <= firstCheckTime) {
            // Pre-check window has passed, schedule the first full check
            nextCheckTime = firstCheckTime;
        } else {
            // Past the first full check → schedule the next slot in the
            // repeating sequence: firstCheckTime + 3n minutes
            const diff = now - firstCheckTime;
            const steps = Math.floor(diff / stepMs) + 1;
            nextCheckTime = firstCheckTime + steps * stepMs;
        }

        const delay = Math.max(0, nextCheckTime - now);

        if (pendingSubmissionTimers[id]) {
            clearTimeout(pendingSubmissionTimers[id]);
        }

        pendingSubmissionTimers[id] = setTimeout(() => {
            Promise.resolve(fetchLatestNominations())
                .finally(() => {
                // If it’s still pending (i.e. reconcile didn’t remove it), schedule the next check
                if (pendingSubmissions[id]) {
                    schedulePendingSubmissionRecheck(id);
                }
            });
        }, delay);
    }

    /**
     * Record a new pending submission from the successful /submit/now payload.
     * This is called only after the XHR response confirms result === "DONE".
     */
    function handleSubmitNowPayload(nowPayload) {
        if (!nowPayload) return;

        const title = (nowPayload.title || "").trim();
        const description = (nowPayload.description || "").trim();
        const supportingStatement = (nowPayload.supportingStatement || "").trim();
        const lat = nowPayload.lat;
        const lng = nowPayload.lng;

        if (
            typeof lat !== "number" || typeof lng !== "number" ||
            !Number.isFinite(lat) || !Number.isFinite(lng)
        ) {
            return;
        }

        loadPendingSubmissionsFromLocalStorage();

        const id = `pending_${Date.now()}_${Math.random().toString(36).slice(2)}`;
        const submittedAt = Date.now();

        const entry = {
            id,
            title,
            description,
            supportingStatement,
            lat,
            lng,
            submittedAt
        };

        pendingSubmissions[id] = entry;
        savePendingSubmissionsToLocalStorage();

        // Draw marker if the map is ready
        createPendingSubmissionMarker(entry);

        // Schedule a manage API refresh after 3 minutes
        schedulePendingSubmissionRecheck(id);
    }

    /**
     * Remove a single pending submission: marker, in-memory entry, timer, and storage.
     */
    function removePendingSubmission(id) {
        if (!id) return;

        const marker = pendingSubmissionMarkers[id];
        if (marker && typeof marker.setMap === "function") {
            marker.setMap(null);
        }
        delete pendingSubmissionMarkers[id];

        if (pendingSubmissionTimers[id]) {
            clearTimeout(pendingSubmissionTimers[id]);
            delete pendingSubmissionTimers[id];
        }

        if (pendingSubmissions[id]) {
            delete pendingSubmissions[id];
            savePendingSubmissionsToLocalStorage();
        }
    }

    /**
     * Helper: return a Set of 'YYYY-MM-DD' strings for yesterday, today, and tomorrow
     * in the local timezone. This is used to decide whether a nomination from /manage
     * counts as "new" compared to a pending submission.
     */
    function getNearbyDayStrings() {
        const millisPerDay = 24 * 60 * 60 * 1000;
        const now = new Date();
        const baseTime = now.getTime();

        const dates = [-1, 0, 1].map(offset => {
            const d = new Date(baseTime + offset * millisPerDay);
            return d.toISOString().slice(0, 10);
        });

        return new Set(dates);
    }

    /**
     * Attempt to match all pending submissions against the current 'nominations'
     * from /api/v1/vault/manage, and prune any entries older than the expiry window.
     *
     * A nomination is considered a match if:
     *  - its lat/lng match the pending submission when rounded to 6 decimals, and
     *  - its 'day' property is yesterday, today, or tomorrow.
     */
    function reconcilePendingSubmissionsWithManageList() {
        loadPendingSubmissionsFromLocalStorage();

        if (!pendingSubmissions || Object.keys(pendingSubmissions).length === 0) {
            return;
        }

        const now = Date.now();
        const nearbyDays = getNearbyDayStrings();
        const noms = Array.isArray(nominations) ? nominations : [];

        Object.values(pendingSubmissions).forEach(pending => {
            if (!pending) return;

            const age = now - pending.submittedAt;

            // Drop any pending entry older than the expiry window
            if (age > PENDING_SUBMIT_EXPIRY_MS) {
                removePendingSubmission(pending.id);
                return;
            }

            if (!noms.length) return;

            // Pre-normalise pending coords to fixed-6
            const pLat = Number(pending.lat.toFixed(6));
            const pLng = Number(pending.lng.toFixed(6));

            const match = noms.find(nom => {
                if (!nom || nom.type !== "NOMINATION") return false;
                if (!nearbyDays.has(nom.day)) return false;

                const nomLat = nom.lat;
                const nomLng = nom.lng;
                if (typeof nomLat !== "number" || typeof nomLng !== "number") return false;

                // Compare to server-style precision (6 decimals)
                const nLat = Number(nomLat.toFixed(6));
                const nLng = Number(nomLng.toFixed(6));

                return nLat === pLat && nLng === pLng;
            });

            if (match) {
                removePendingSubmission(pending.id);
            }
        });
    }

    /**
     * After the map is attached, restore any pending submission markers still within
     * the valid time window.
     */
    function restorePendingSubmissionMarkersIfNeeded() {
        loadPendingSubmissionsFromLocalStorage();
        clearPendingSubmissionMarkers();

        const now = Date.now();

        Object.values(pendingSubmissions).forEach(pending => {
            if (!pending) return;
            if (now - pending.submittedAt > PENDING_SUBMIT_EXPIRY_MS) {
                removePendingSubmission(pending.id);
                return;
            }
            createPendingSubmissionMarker(pending);
            schedulePendingSubmissionRecheck(pending.id);
        });
    }

    // -----------------------------
    // Map lifecycle + DOM watchers
    // -----------------------------

    function isOnMapCapableRoute() {
        const p = window.location.pathname;
        return p.startsWith(SUBMIT_ROUTE) || p.startsWith(MAPVIEW_ROUTE);
    }

    function onMapRouteChange() {
        if (isOnMapCapableRoute()) {
            startMapPanelWatcher();
        } else {
            stopMapPanelWatcher();
            teardownMap();
        }
    }

    function setupMapRouteWatcher() {
        const origPushState = history.pushState;
        const origReplaceState = history.replaceState;

        function wrappedRouteChange() {
            onMapRouteChange();
        }

        history.pushState = function (...args) {
            const ret = origPushState.apply(this, args);
            wrappedRouteChange();
            return ret;
        };

        history.replaceState = function (...args) {
            const ret = origReplaceState.apply(this, args);
            wrappedRouteChange();
            return ret;
        };

        window.addEventListener("popstate", wrappedRouteChange);

        // Initial load
        wrappedRouteChange();
    }

    /**
     * Start watching the DOM for the Wayfarer map side panel.
     * This handles SPA-style navigation where the map panel appears/disappears
     * without a full page reload.
     */
    function startMapPanelWatcher() {
        // Don’t double-start
        if (mapPanelObserver) return;

        // Handle the current state in case the panel is already present
        handlePanelChange();

        mapPanelObserver = new MutationObserver(() => {
            // Debounce: collapse many mutations into one handler call
            if (mapPanelMutationScheduled) return;

            mapPanelMutationScheduled = true;
            requestAnimationFrame(() => {
                mapPanelMutationScheduled = false;
                handlePanelChange();
            });
        });

        mapPanelObserver.observe(document.body, {
            childList: true,
            subtree: true
        });
    }

    function stopMapPanelWatcher() {
        if (mapPanelObserver) {
            mapPanelObserver.disconnect();
            mapPanelObserver = null;
        }
    }

    /**
     * Detect when the map side panel is added or removed and
     * attach/teardown the contribution overlay accordingly.
     */
    function handlePanelChange() {
        const panelPresent = !!document.querySelector("#wfmapmods-side-panel");

        if (panelPresent) {
            attachContribOverlayToMapIfNeeded();
            insertSettingsLink();
            insertLayersToggle();
            setupBridgeSelectionWatcher();
            fetchLatestNominations();
            stopMapPanelWatcher();
        }
    }

    /**
     * Locate the underlying submit map instance used by the Wayfarer UI.
     *
     * Returns a Promise that resolves to the map object or null if not found.
     * Retries a fixed number of times as the Angular app bootstraps.
     */
    function looksLikeGoogleMap(obj) {
        return !!(obj &&
                  typeof obj.getCenter === "function" &&
                  typeof obj.addListener === "function" &&
                  typeof obj.getDiv === "function");
    }

    function extractMapFromCtxEntry(entry) {
        if (!entry) return null;
        if (looksLikeGoogleMap(entry)) return entry; // mapview
        const m = entry?.componentRef?.map;          // submit
        return looksLikeGoogleMap(m) ? m : null;
    }

    function getWfMap() {
        return new Promise((resolve) => {
            let attempts = 80;

            function tryFindMap() {
                const candidates = document.querySelectorAll("app-submit-wayspot-map nia-map, app-wf-base-map");

                for (const el of candidates) {
                    const ctx = el && el.__ngContext__;
                    if (!ctx) continue;

                    for (const entry of ctx) {
                        try {
                            const map = extractMapFromCtxEntry(entry);
                            if (map) return resolve(map);
                        } catch { /* ignore */ }
                    }
                }

                if (attempts-- <= 0) return resolve(null);
                setTimeout(tryFindMap, 250);
            }

            tryFindMap();
        });
    }

    function isMapStale(map) {
        try {
            const div = map && map.getDiv && map.getDiv();
            return !div || !div.isConnected;
        } catch {
            return true;
        }
    }

    /**
     * Ensure the contribution overlay is attached to the submit map.
     * If already attached, simply refreshes the markers.
     */
    async function attachContribOverlayToMapIfNeeded() {
        // 1) If we think we're attached, verify the map is still alive.
        if (mapAttached) {
            const hasLiveMap = wfMap && !isMapStale(wfMap);

            if (hasLiveMap) {
                refreshNominationMarkers();
                return;
            }

            // We thought we were attached, but the underlying map is gone/stale.
            teardownMap();
            // fall through to reattach
        }

        const map = await getWfMap();

        if (!map) {
            console.warn("[ContribOverlay] Map not found – cannot attach");
            return;
        }

        wfMap = map;
        mapAttached = true;

        // Update markers whenever the user pans or zooms the map
        if (!wfMap._contribOverlayBoundsListenerAdded) {
            wfMap.addListener("idle", refreshNominationMarkers);
            wfMap._contribOverlayBoundsListenerAdded = true;
        }

        // Draw any nominations we already have cached
        refreshNominationMarkers();

        // Draw any pending submissions that were created before this page load
        restorePendingSubmissionMarkersIfNeeded();
    }

    /**
     * Remove the contribution overlay from the current map and clear markers.
     */
    function teardownMap() {
        if (!mapAttached) return;

        clearNominationMarkers();
        clearPendingSubmissionMarkers();
        wfMap = null;
        mapAttached = false;
    }

    /**
     * Remove all nomination markers from the map and reset the marker cache.
     */
    function clearNominationMarkers() {
        if (!nominationMarkers) return;
        Object.values(nominationMarkers).forEach(m => {
            if (m && typeof m.setMap === "function") {
                m.setMap(null);
            }
        });
        nominationMarkers = {};
    }

    // -----------------------------
    // Marker creation, selection & visibility
    // -----------------------------

    /**
     * Return marker configuration for a given nomination status.
     * Falls back to DEFAULT config or a built-in grey style if not defined.
     */
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

    /**
     * Create a Google Maps marker for a nomination POI.
     * The marker is initially detached from the map; caller decides when to display it.
     */
    function createNominationMarker(poi) {
        const lat = poi.lat;
        const lng = poi.lng;

        const statusRaw = poi.status || "";
        const status = String(statusRaw).toUpperCase();
        const cfg = getMarkerConfigForStatus(statusRaw);

        const marker = new google.maps.Marker({
            map: null, // attach later when in-bounds
            position: { lat, lng },
            title: `${poi.title || "No title"} (${status || "UNKNOWN"})`,
            icon: {
                path: google.maps.SymbolPath.CIRCLE,
                fillColor: cfg.fillColor,
                fillOpacity: cfg.fillOpacity,
                strokeColor: cfg.strokeColor,
                strokeOpacity: cfg.strokeOpacity,
                strokeWeight: cfg.strokeWeight,
                scale: cfg.scale,
                optimized: false,
            }
        });

        marker.addListener("click", () => {
            selectNominationMarker(marker);
            lastSelectedNominationId = poi.id || null;
            sendPoiToBridge(poi);
            updateNominationActionLinks(poi);
        });

        return marker;
    }

    /**
     * Clear the current nomination selection and restore the previous marker styling.
     */
    function clearNominationSelection() {
        hideNominationActionLinks();

        if (lastSelectedNomMarker && lastSelectedNomOriginalIcon) {
            lastSelectedNomMarker.setIcon(lastSelectedNomOriginalIcon);
        }
        lastSelectedNomMarker = null;
        lastSelectedNomOriginalIcon = null;
        lastSelectedNominationId = null;
    }

    /**
     * Mark a nomination marker as selected by visually highlighting it
     * and remembering the original icon so it can be restored later.
     */
    function selectNominationMarker(marker) {
        // Remove highlight from any previously selected marker
        clearNominationSelection();

        if (!marker || !marker.getIcon) return;

        const icon = marker.getIcon();
        if (!icon) return;

        // Remember original icon so we can restore it on deselect
        lastSelectedNomOriginalIcon = { ...icon };
        lastSelectedNomMarker = marker;

        const selectedIcon = {
            ...icon,
            // keep fillColor / fillOpacity as-is
            strokeColor: "#ff00ff",
            strokeOpacity: 1,
            strokeWeight: (icon.strokeWeight || 2) + 2,
            scale: (icon.scale || 8) + 1
        };

        marker.setIcon(selectedIcon);
    }

    /**
     * Filter candidate nomination ids by excluding specific statuses.
     *
     * @param {string[]} candidateIds           All candidate ids to consider.
     * @param {Object}   candidatePoisById      Map id -> POI object.
     * @param {Set}      excludedStatuses       Set of UPPERCASE statuses to exclude.
     * @returns {string[]}                      Filtered list of ids.
     */
    function filterCandidateIdsByStatus(candidateIds, candidatePoisById, excludedStatuses) {
        const result = [];
        candidateIds.forEach(id => {
            const poi = candidatePoisById[id];
            if (!poi) return;
            const status = String(poi.status || "").toUpperCase();
            if (excludedStatuses.has(status)) return;
            result.push(id);
        });
        return result;
    }

    /**
     * Refresh contribution markers on the map based on:
     *  - current map bounds
     *  - per-status "enabled" flags
     *  - performance mode limit (max visible markers)
     *
     * Reuses existing markers where possible, and hides markers that leave bounds
     * or become ineligible.
     */
    function refreshNominationMarkers() {
        if (!wfMap || !nominations || !Array.isArray(nominations)) {
            return;
        }

        // Load map-related settings
        const mapCfg = userSettings.map;
        const contributionsEnabled = mapCfg.contributionsEnabled;
        const performanceModeEnabled = mapCfg.performanceModeEnabled;

        // If master toggle is OFF, remove all contribution markers.
        if (contributionsEnabled === false) {
            clearNominationMarkers();
            return;
        }

        const bounds = wfMap.getBounds();
        if (!bounds) {
            // Map not fully initialised yet
            return;
        }

        const maxVisibleMarkers = PERFORMANCE_MAX_VISIBLE_MARKERS;

        // First pass: collect nominations that *could* be visible,
        // respecting status "enabled" flags and map bounds.
        const candidateIds = [];
        const candidatePoisById = {};

        nominations.forEach(poi => {
            if (!poi || poi.type !== "NOMINATION") return;

            const lat = poi.lat;
            const lng = poi.lng;
            if (typeof lat !== "number" || typeof lng !== "number") return;

            const statusCfg = getMarkerConfigForStatus(poi.status);
            if (statusCfg.enabled === false) {
                // This status is disabled in settings
                return;
            }

            const pos = new google.maps.LatLng(lat, lng);
            if (!bounds.contains(pos)) return;

            const id = poi.id || `${lat},${lng}`;
            if (!candidatePoisById[id]) {
                candidateIds.push(id);
                candidatePoisById[id] = poi;
            }
        });

        let finalCandidateIds = candidateIds;

        if (performanceModeEnabled && candidateIds.length > maxVisibleMarkers) {
            // Step 1: Prefer hiding ACCEPTED only
            const excludeAccepted = new Set(["ACCEPTED"]);
            const withoutAccepted = filterCandidateIdsByStatus(candidateIds, candidatePoisById, excludeAccepted);

            if (withoutAccepted.length <= maxVisibleMarkers) {
                finalCandidateIds = withoutAccepted;
            } else {
                // Step 2: Hide ACCEPTED + REJECTED + DUPLICATE + WITHDRAWN
                const excludeAcceptedRejectedDup = new Set(["ACCEPTED", "REJECTED", "DUPLICATE", "WITHDRAWN"]);
                const withoutAcceptedRejectedDup = filterCandidateIdsByStatus(candidateIds, candidatePoisById, excludeAcceptedRejectedDup);

                if (withoutAcceptedRejectedDup.length <= maxVisibleMarkers) {
                    finalCandidateIds = withoutAcceptedRejectedDup;
                } else {
                    // Step 3: Still too many → hide all contribution markers
                    clearNominationMarkers();
                    return;
                }
            }
        }

        // Second pass: create/update markers for the final candidate set
        const inBoundsIds = new Set(finalCandidateIds);

        finalCandidateIds.forEach(id => {
            const poi = candidatePoisById[id];
            if (!poi) return;

            let marker = nominationMarkers[id];
            const cfg = getMarkerConfigForStatus(poi.status);

            // Base icon based on current status
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
                // Create new marker
                marker = new google.maps.Marker({
                    map: null, // attach later when in-bounds
                    position: { lat: poi.lat, lng: poi.lng },
                    title: `${poi.title || "No title"} (${String(poi.status || "").toUpperCase() || "UNKNOWN"})`,
                    icon: baseIcon,
                    optimized: false,
                });

                marker.addListener("click", () => {
                    selectNominationMarker(marker);
                    lastSelectedNominationId = poi.id || null;
                    sendPoiToBridge(poi);
                    updateNominationActionLinks(poi);
                });

                nominationMarkers[id] = marker;
            } else {
                // Existing marker: update its icon to match the new status
                if (marker === lastSelectedNomMarker) {
                    // Keep the selected styling but base it on the updated icon
                    lastSelectedNomOriginalIcon = { ...baseIcon };
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
                marker.setMap(wfMap);
            }
        });

        // Hide markers that are no longer in bounds or no longer part of the candidate set
        Object.entries(nominationMarkers).forEach(([id, marker]) => {
            if (!marker) return;
            if (!inBoundsIds.has(id) && marker.getMap()) {
                marker.setMap(null);
            }
        });
    }

    // -----------------------------
    // Sidebar actions & contribution editing
    // -----------------------------

    /**
     * Hide all nomination action links in the sidebar.
     * Safe to call even if the container hasn't been rendered yet.
     */
    function hideNominationActionLinks() {
        const container = document.querySelector(".wfmapmods-poi-function-links");
        if (!container) return;

        const ids = [
            "#wfmapmods-function-hold",
            "#wfmapmods-function-release-hold",
            "#wfmapmods-function-withdraw",
            "#wfmapmods-function-edit-submission",
            "#wfmapmods-function-appeal",
            "#wfmapmods-function-resubmit-contrib"
        ];
        ids.forEach(sel => {
            const el = container.querySelector(sel);
            if (el) el.style.display = "none";
        });
    }

    /**
     * Update the sidebar action links (Hold / Release / Withdraw / Edit / Appeal / Resubmit)
     * based on the currently selected POI and its status.
     *
     * Creates the links once if they do not exist yet, then toggles their visibility
     * and wiring according to the nomination state.
     */
    function updateNominationActionLinks(poi) {
        if (!poi || poi.type !== "NOMINATION") {
            hideNominationActionLinks();
            return;
        }

        const container = document.querySelector(".wfmapmods-poi-function-links");
        if (!container) return;

        const status = String(poi.status || "").toUpperCase();
        const id = poi.id;
        if (!id) return;

        // ---- Edit link ----
        let editLink = container.querySelector("#wfmapmods-function-edit-submission");
        if (!editLink) {
            editLink = document.createElement("a");
            editLink.id = "wfmapmods-function-edit-submission";
            editLink.textContent = "Edit";
            editLink.style.cursor = "pointer";
            editLink.addEventListener("click", ev => {
                ev.preventDefault();
                const targetId = editLink.dataset.id;
                if (!targetId) return;

                // Find full POI object to prefill modal
                let poiForEdit = null;
                if (Array.isArray(nominations)) {
                    poiForEdit = nominations.find(n => n.id === targetId) || null;
                }

                if (!poiForEdit) {
                    // Fallback to the poi passed into updateNominationActionLinks
                    poiForEdit = poi;
                }

                if (!poiForEdit) return;
                openEditSubmissionModal(poiForEdit);
            });
            container.appendChild(editLink);
        }

        // ---- Hold link ----
        let holdLink = container.querySelector("#wfmapmods-function-hold");
        if (!holdLink) {
            holdLink = document.createElement("a");
            holdLink.id = "wfmapmods-function-hold";
            holdLink.textContent = "Hold";
            holdLink.style.cursor = "pointer";
            holdLink.addEventListener("click", ev => {
                ev.preventDefault();
                const targetId = holdLink.dataset.id;
                if (!targetId) return;
                sendManageActionForNomination("hold", targetId);
            });
            container.appendChild(holdLink);
        }

        // ---- Release Hold link ----
        let releaseHoldLink = container.querySelector("#wfmapmods-function-release-hold");
        if (!releaseHoldLink) {
            releaseHoldLink = document.createElement("a");
            releaseHoldLink.id = "wfmapmods-function-release-hold";
            releaseHoldLink.textContent = "Release Hold";
            releaseHoldLink.style.cursor = "pointer";
            releaseHoldLink.addEventListener("click", ev => {
                ev.preventDefault();
                const targetId = releaseHoldLink.dataset.id;
                if (!targetId) return;
                sendManageActionForNomination("releasehold", targetId);
            });
            container.appendChild(releaseHoldLink);
        }

        // ---- Withdraw link ----
        let withdrawLink = container.querySelector("#wfmapmods-function-withdraw");
        if (!withdrawLink) {
            withdrawLink = document.createElement("a");
            withdrawLink.id = "wfmapmods-function-withdraw";
            withdrawLink.textContent = "Withdraw";
            withdrawLink.style.cursor = "pointer";
            withdrawLink.addEventListener("click", ev => {
                ev.preventDefault();
                const targetId = withdrawLink.dataset.id;
                if (!targetId) return;

                const confirmed = window.confirm(
                    "Are you sure you would like to withdraw this nomination? This cannot be undone."
                );
                if (!confirmed) return;

                sendManageActionForNomination("withdraw", targetId);
            });
            container.appendChild(withdrawLink);
        }

        // ---- Appeal link ----
        let appealLink = container.querySelector("#wfmapmods-function-appeal");
        if (!appealLink) {
            appealLink = document.createElement("a");
            appealLink.id = "wfmapmods-function-appeal";
            appealLink.textContent = "Appeal";
            appealLink.style.cursor = "pointer";

            appealLink.addEventListener("click", ev => {
                ev.preventDefault();
                if (!globalCanAppeal) {
                    // Shouldn't fire because pointerEvents will be none, but double-check
                    return;
                }

                const targetId = appealLink.dataset.id;
                if (!targetId) return;

                // Find full POI object so we have all fields for the modal
                let poiForAppeal = null;
                if (Array.isArray(nominations)) {
                    poiForAppeal = nominations.find(n => n.id === targetId) || null;
                }
                if (!poiForAppeal) poiForAppeal = poi;
                if (!poiForAppeal) return;

                openAppealModal(poiForAppeal);
            });
            container.appendChild(appealLink);
        }

        // ---- Resubmit link ----
        let resubmitLink = container.querySelector("#wfmapmods-function-resubmit-contrib");
        if (!resubmitLink) {
            resubmitLink = document.createElement("a");
            resubmitLink.id = "wfmapmods-function-resubmit-contrib";
            resubmitLink.textContent = "Resubmit";
            resubmitLink.style.cursor = "pointer";

            resubmitLink.addEventListener("click", (ev) => {
                ev.preventDefault();

                const nid = resubmitLink.dataset.id;
                let poiForResubmit = null;

                if (Array.isArray(nominations)) {
                    poiForResubmit = nominations.find(n => n.id === nid) || null;
                }
                if (!poiForResubmit) poiForResubmit = poi; // fallback to the current POI
                if (!poiForResubmit) return;

                // Notify the base script to prefill the resubmit form
                sendResubmitToBase(poiForResubmit);
            });

            container.appendChild(resubmitLink);
        }

        // ---- Show/hide links based on current status (hold / release / withdraw / edit) ----
        if (status === "NOMINATED") {
            // NOMINATED → can Hold, Withdraw, Edit
            holdLink.style.display = "inline-block";
            withdrawLink.style.display = "inline-block";
            releaseHoldLink.style.display = "none";
            if (editLink) editLink.style.display = "inline-block";
        } else if (status === "HELD") {
            // HELD → can Release Hold, Edit
            holdLink.style.display = "none";
            withdrawLink.style.display = "none";
            releaseHoldLink.style.display = "inline-block";
            if (editLink) editLink.style.display = "inline-block";
        } else {
            // Any other status → hide hold/release/withdraw/edit
            holdLink.style.display = "none";
            withdrawLink.style.display = "none";
            releaseHoldLink.style.display = "none";
            if (editLink) editLink.style.display = "none";
        }

        // Update data-id on all links to match the current POI
        if (editLink)         editLink.dataset.id         = id;
        if (holdLink)         holdLink.dataset.id         = id;
        if (releaseHoldLink)  releaseHoldLink.dataset.id  = id;
        if (withdrawLink)     withdrawLink.dataset.id     = id;
        if (appealLink)       appealLink.dataset.id       = id;
        if (resubmitLink)     resubmitLink.dataset.id     = id;

        // ---- Appeal logic: link availability and visual state ----
        if (appealLink) {
            const itemCanAppeal = !!poi.canAppeal; // per-submission flag from API

            if (!itemCanAppeal) {
                // This particular nomination cannot be appealed at all
                appealLink.style.display = "none";
                appealLink.title = "";
                appealLink.style.pointerEvents = "none";
                appealLink.style.cursor = "default";
                appealLink.style.opacity = "0.6";
            } else {
                // POI is appealable in principle; enable/disable based on global availability
                appealLink.style.display = "inline-block";

                if (globalCanAppeal === true) {
                    // POI can be appealed AND we have appeals available
                    appealLink.style.pointerEvents = "auto";
                    appealLink.style.cursor = "pointer";
                    appealLink.style.opacity = "1";
                    appealLink.style.color = "#6b7280";
                    appealLink.title = "";
                } else if (globalCanAppeal === false) {
                    // POI can be appealed, but user has no appeals left
                    appealLink.style.pointerEvents = "none";
                    appealLink.style.cursor = "default";
                    appealLink.style.opacity = "0.6";
                    appealLink.style.color = "#9ca3af"; // greyed out
                    appealLink.title = "No appeals available";
                } else {
                    // globalCanAppeal === null → we don't know yet, still checking
                    appealLink.style.pointerEvents = "none";
                    appealLink.style.cursor = "default";
                    appealLink.style.opacity = "0.6";
                    appealLink.style.color = "#9ca3af";
                    appealLink.title = "Checking appeals availability...";
                }
            }
        }

        // ---- Resubmit logic: only for REJECTED / WITHDRAWN / DUPLICATE ----
        if (resubmitLink) {
            const canResubmitStatuses = new Set(["REJECTED", "WITHDRAWN", "DUPLICATE"]);
            if (canResubmitStatuses.has(status)) {
                resubmitLink.style.display = "inline-block";
            } else {
                // Hide the link and reset styling to a neutral baseline
                resubmitLink.style.display = "none";
                resubmitLink.dataset.disabled = "";
                resubmitLink.title = "";
                resubmitLink.style.cursor = "pointer";
                resubmitLink.style.opacity = "1";
                resubmitLink.style.color = "";
            }
        }
    }

    /**
     * Open the "Edit submission" modal for a nomination.
     * Allows editing title, description, and supporting statement with character counters.
     */
    function openEditSubmissionModal(poi) {
        if (!poi || !poi.id) return;

        const currentTitle = poi.title || "";
        const currentDescription = poi.description || "";
        const currentSupporting = poi.statement || "";

        const TITLE_MAX = 128;
        const DESC_MAX = 512;
        const SUPP_MAX = 3000;

        openSettingsModal({
            id: "wf-contrib-edit-submission",
            title: "Edit submission",
            buildContent(body, okBtn) {
                const container = document.createElement("div");
                container.className = "wfmapmods-modal-section";
                container.style.display = "flex";
                container.style.flexDirection = "column";
                container.style.gap = "8px";

                function makeLabel(text) {
                    const label = document.createElement("label");
                    label.textContent = text;
                    label.style.fontSize = "11px";
                    label.style.fontWeight = "bold";
                    return label;
                }

                function makeInput() {
                    const input = document.createElement("input");
                    input.type = "text";
                    input.style.width = "100%";
                    input.style.boxSizing = "border-box";
                    input.style.fontSize = "12px";
                    input.style.padding = "4px 6px";
                    input.style.border = "1px solid #d1d5db";
                    input.style.borderRadius = "4px";
                    input.style.backgroundColor = "#ffffff";

                    input.addEventListener("focus", () => {
                        input.style.outline = "none";
                        input.style.borderColor = "#2563eb";
                        input.style.boxShadow = "0 0 0 1px #2563eb";
                    });
                    input.addEventListener("blur", () => {
                        input.style.borderColor = "#d1d5db";
                        input.style.boxShadow = "none";
                    });

                    return input;
                }

                function makeTextarea(rows) {
                    const ta = document.createElement("textarea");
                    ta.rows = rows;
                    ta.style.width = "100%";
                    ta.style.boxSizing = "border-box";
                    ta.style.fontSize = "12px";
                    ta.style.padding = "4px 6px";
                    ta.style.resize = "vertical";
                    ta.style.border = "1px solid #d1d5db";
                    ta.style.borderRadius = "4px";
                    ta.style.backgroundColor = "#ffffff";

                    ta.addEventListener("focus", () => {
                        ta.style.outline = "none";
                        ta.style.borderColor = "#2563eb";
                        ta.style.boxShadow = "0 0 0 1px #2563eb";
                    });
                    ta.addEventListener("blur", () => {
                        ta.style.borderColor = "#d1d5db";
                        ta.style.boxShadow = "none";
                    });

                    return ta;
                }

                function makeCounter(initial, max) {
                    const c = document.createElement("div");
                    c.style.fontSize = "10px";
                    c.style.color = "#6b7280";
                    c.style.textAlign = "right";
                    c.textContent = `${initial} / ${max}`;
                    return c;
                }

                // ---- Title ----
                const titleLabel = makeLabel("Title");
                const titleInput = makeInput();
                titleInput.maxLength = TITLE_MAX;
                titleInput.value = currentTitle;
                const titleCounter = makeCounter(currentTitle.length, TITLE_MAX);

                container.appendChild(titleLabel);
                container.appendChild(titleInput);
                container.appendChild(titleCounter);

                // ---- Description ----
                const descLabel = makeLabel("Description");
                const descInput = makeTextarea(3);
                descInput.maxLength = DESC_MAX;
                descInput.value = currentDescription;
                const descCounter = makeCounter(currentDescription.length, DESC_MAX);

                container.appendChild(descLabel);
                container.appendChild(descInput);
                container.appendChild(descCounter);

                // ---- Supporting statement ----
                const suppLabel = makeLabel("Supporting statement");
                const suppInput = makeTextarea(3);
                suppInput.maxLength = SUPP_MAX;
                suppInput.value = currentSupporting;
                const suppCounter = makeCounter(currentSupporting.length, SUPP_MAX);

                container.appendChild(suppLabel);
                container.appendChild(suppInput);
                container.appendChild(suppCounter);

                body.appendChild(container);

                function updateCountsAndValidate() {
                    const titleLen = titleInput.value.length;
                    const descLen = descInput.value.length;
                    const suppLen = suppInput.value.length;

                    titleCounter.textContent = `${titleLen} / ${TITLE_MAX}`;
                    descCounter.textContent = `${descLen} / ${DESC_MAX}`;
                    suppCounter.textContent = `${suppLen} / ${SUPP_MAX}`;

                    // All fields must be 1+ chars to enable OK
                    const allValid =
                          titleLen >= 1 &&
                          descLen >= 1 &&
                          suppLen >= 1;

                    if (okBtn) {
                        okBtn.disabled = !allValid;
                        okBtn.style.opacity = allValid ? "1" : "0.6";
                        okBtn.style.cursor = allValid ? "pointer" : "not-allowed";
                    }
                }

                titleInput.addEventListener("input", updateCountsAndValidate);
                descInput.addEventListener("input", updateCountsAndValidate);
                suppInput.addEventListener("input", updateCountsAndValidate);

                // Initial state
                updateCountsAndValidate();

                return {
                    nominationId: poi.id,
                    titleInput,
                    descInput,
                    suppInput
                };
            },
            onOk(ctx, closeModal) {
                const id = ctx.nominationId;
                if (!id) {
                    closeModal();
                    return;
                }

                const updates = {
                    title: ctx.titleInput.value.trim(),
                    description: ctx.descInput.value.trim(),
                    // Logical "supporting" key – stored as "statement" in data
                    supporting: ctx.suppInput.value.trim()
                };

                // If somehow empty, just refuse to send
                if (!updates.title || !updates.description || !updates.supporting) {
                    return;
                }

                sendEditSubmission(id, updates, closeModal);
            }
        });
    }

    /**
     * Open the "Appeal rejection" modal for a nomination.
     * Collects an appeal statement and submits it via the Wayfarer API.
     */
    function openAppealModal(poi) {
        if (!poi || !poi.id) return;

        const currentStatement = ""; // Appeals always start as fresh text

        openSettingsModal({
            id: "wf-contrib-appeal-submission",
            title: "Appeal rejection",
            buildContent(body, okBtn) {
                const container = document.createElement("div");
                container.className = "wfmapmods-modal-section";
                container.style.display = "flex";
                container.style.flexDirection = "column";
                container.style.gap = "8px";

                const label = document.createElement("label");
                label.textContent = "Appeal statement";
                label.style.fontSize = "11px";
                label.style.fontWeight = "bold";

                const textarea = document.createElement("textarea");
                textarea.rows = 5;
                textarea.style.width = "100%";
                textarea.style.boxSizing = "border-box";
                textarea.style.fontSize = "12px";
                textarea.style.padding = "4px 6px";
                textarea.style.resize = "vertical";
                textarea.style.border = "1px solid #d1d5db";
                textarea.style.borderRadius = "4px";
                textarea.style.backgroundColor = "#ffffff";
                textarea.placeholder = "Please explain why you think this contribution should be accepted.";

                textarea.value = currentStatement;

                textarea.addEventListener("focus", () => {
                    textarea.style.outline = "none";
                    textarea.style.borderColor = "#2563eb";
                    textarea.style.boxShadow = "0 0 0 1px #2563eb";
                });
                textarea.addEventListener("blur", () => {
                    textarea.style.borderColor = "#d1d5db";
                    textarea.style.boxShadow = "none";
                });

                const hint = document.createElement("div");
                hint.style.fontSize = "10px";
                hint.style.color = "#6b7280";
                hint.textContent = "Use this space to clarify why your nomination meets the criteria.";

                container.appendChild(label);
                container.appendChild(textarea);
                container.appendChild(hint);
                body.appendChild(container);

                function updateValidity() {
                    const text = textarea.value.trim();
                    const valid = text.length > 0;
                    if (okBtn) {
                        okBtn.disabled = !valid;
                        okBtn.style.opacity = valid ? "1" : "0.6";
                        okBtn.style.cursor = valid ? "pointer" : "not-allowed";
                    }
                }

                textarea.addEventListener("input", updateValidity);
                updateValidity(); // Initial state

                return {
                    nominationId: poi.id,
                    textarea
                };
            },
            onOk(ctx, closeModal) {
                const id = ctx.nominationId;
                if (!id) {
                    closeModal();
                    return;
                }

                const statement = ctx.textarea.value.trim();
                if (!statement) {
                    // Should be prevented by disabled OK, but double-check
                    return;
                }

                sendAppeal(id, statement, closeModal);
            }
        });
    }

    // -----------------------------
    // Layers Toggle & Marker Visibility Settings
    // -----------------------------

    /**
     * Insert the "Contributions" layer toggle into the layers menu.
     * Polls until the layers menu exists, then adds a checkbox that
     * controls the global contributionsEnabled setting.
     */
    function insertLayersToggle() {
        const menuCheck = setInterval(() => {
            const menu = document.querySelector(".wfmapmods-layers-menu");
            if (!menu) return; // wait until layers plugin has created the menu

            clearInterval(menuCheck);

            // Avoid inserting the toggle more than once
            if (menu.querySelector("#wfmapmods-layer-contributions")) return;

            const mapCfg = userSettings.map || (userSettings.map = {});
            if (typeof mapCfg.contributionsEnabled !== "boolean") {
                mapCfg.contributionsEnabled = true;
            }

            const label = document.createElement("label");
            label.className = "wfmapmods-layers-option";
            label.id = "wfmapmods-layer-contributions";

            const checkbox = document.createElement("input");
            checkbox.type = "checkbox";
            checkbox.checked = mapCfg.contributionsEnabled !== false;
            checkbox.className = "wfmapmods-layers-checkbox";

            const text = document.createElement("span");
            text.textContent = "Contributions";
            text.className = "wfmapmods-layers-label";

            label.appendChild(checkbox);
            label.appendChild(text);
            menu.appendChild(label);

            checkbox.addEventListener("change", () => {
                const enabled = checkbox.checked;
                const mapCfg = userSettings.map || (userSettings.map = {});
                mapCfg.contributionsEnabled = enabled;
                saveSettings();

                if (!enabled) {
                    // Master off: hide everything & clear selection UI
                    clearNominationMarkers();
                    clearPendingSubmissionMarkers();
                    clearNominationSelection();
                    hideNominationActionLinks();
                } else {
                    // Master on: if all sub-statuses are disabled, re-enable them
                    ensureAnyStatusEnabledWhenMasterOn();
                    // Then re-draw markers based on current zoom/bounds and status settings
                    refreshNominationMarkers();
                    restorePendingSubmissionMarkersIfNeeded();
                }
            });
        }, 300);
    }

    /**
     * When the master "Contributions" layer is enabled, ensure that at least
     * one individual status is also enabled. If all statuses are disabled,
     * this re-enables them so the layer isn't "on but empty".
     */
    function ensureAnyStatusEnabledWhenMasterOn() {
        const markersCfgRoot = userSettings.markers || {};
        const markersCfg = markersCfgRoot.statuses || {};

        // Only consider real statuses, not DEFAULT
        const statusKeys = Object.keys(markersCfg).filter(k => k !== "DEFAULT");

        if (!statusKeys.length) return;

        // If EVERY status is disabled, re-enable them all so the user sees something.
        const allDisabled = statusKeys.every(key => {
            const cfg = markersCfg[key];
            return cfg && cfg.enabled === false;
        });

        if (!allDisabled) return;

        statusKeys.forEach(key => {
            const cfg = markersCfg[key] || (markersCfg[key] = {});
            cfg.enabled = true;
        });

        // Persist change
        saveSettings();
    }

    // -----------------------------
    // Marker Style & Contribution Settings UI
    // -----------------------------

    /**
     * Insert a "Contributions" link into the settings panel.
     * Clicking it opens the contribution marker settings window.
     */
    function insertSettingsLink() {
        const panelCheck = setInterval(() => {
            const settingsBody = document.querySelector(".wfmapmods-settings-links");
            if (!settingsBody) return; // retry until the panel exists

            clearInterval(panelCheck);

            // Prevent duplicate link insertion
            if (document.getElementById("wfmapmods-settings-contributions")) return;

            const link = document.createElement("a");
            link.id = "wfmapmods-settings-contributions";
            link.textContent = "Contributions";

            settingsBody.appendChild(link);

            link.addEventListener("click", () => {
                openContributionMarkerSettingsWindow();
            });
        }, 300);
    }

    /**
     * Open a modal that lets the user customise the visual style
     * of markers for a specific status (colour, opacity, size, etc.).
     */
    function openMarkerStyleModal(statusKey, label, cfg, onUpdated) {
        openSettingsModal({
            id: `wf-contrib-marker-style-${statusKey}`,
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
                    const label = document.createElement("label");
                    label.textContent = text;
                    label.style.fontSize = "11px";
                    return label;
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

                // Layout
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

                [strokeColorInput, strokeOpacityInput, strokeWidthInput,
                 fillColorInput, fillOpacityInput, scaleInput]
                    .forEach(el => el.addEventListener("input", updatePreview));

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
                    scaleInput,
                    updatePreview
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

                // Persist new style values back into the cfg object
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

    /**
     * Open the main "Contribution marker options" window.
     * Lets the user:
     *  - toggle per-status visibility
     *  - adjust per-status marker style (via sub-modal)
     *  - configure performance mode for many markers
     */
    function openContributionMarkerSettingsWindow() {
        const markersCfgRoot = userSettings.markers || (userSettings.markers = {});
        const markersCfg = markersCfgRoot.statuses || (markersCfgRoot.statuses = {});

        // Ensure DEFAULT exists as a fallback for any status
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

        // Order with ACCEPTED at the bottom for visibility / UX
        const STATUS_ROWS = [
            { key: "NOMINATED",       label: "Nominated" },
            { key: "VOTING",          label: "Voting" },
            { key: "NIANTIC_REVIEW",  label: "Niantic Review" },
            { key: "APPEALED",        label: "Appealed" },
            { key: "HELD",            label: "Hold" },
            { key: "WITHDRAWN",       label: "Withdrawn" },
            { key: "REJECTED",        label: "Rejected" },
            { key: "DUPLICATE",       label: "Duplicate" },
            { key: "ACCEPTED",        label: "Accepted" }
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
            id: "wf-contrib-marker-backdrop",
            title: "Contribution marker options",
            buildContent(dialog) {
                const container = document.createElement("div");
                container.className = "wfmapmods-modal-section";

                // ---- PERFORMANCE / MANY-MARKERS SECTION ----
                const mapCfg = userSettings.map || (userSettings.map = {});
                if (typeof mapCfg.performanceModeEnabled !== "boolean") {
                    mapCfg.performanceModeEnabled = true;
                }

                const perfRow = document.createElement("div");
                perfRow.style.display = "flex";
                perfRow.style.alignItems = "center";
                perfRow.style.marginBottom = "8px";
                perfRow.style.gap = "6px";

                const perfCheckbox = document.createElement("input");
                perfCheckbox.type = "checkbox";
                perfCheckbox.id = "wf-contrib-performance-mode";
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
                perfHelp.textContent = "Hides markers at low zoom levels to prevent lag.";

                perfRow.appendChild(perfCheckbox);
                perfRow.appendChild(perfLabel);
                container.appendChild(perfRow);
                container.appendChild(perfHelp);
                // ---- END PERFORMANCE SECTION ----

                // Warning banner for ACCEPTED markers
                const warning = document.createElement("div");
                warning.style.display = "none";
                warning.style.marginTop = "8px";
                warning.style.marginBottom = "8px";
                warning.style.padding = "6px 8px";
                warning.style.borderRadius = "4px";
                warning.style.background = "#fef3c7"; // light amber
                warning.style.color = "#92400e";      // dark amber
                warning.style.fontSize = "11px";
                warning.textContent = 'Warning: Showing "Accepted" Wayspots may produce unexpected behaviour, such as showing Wayspots on the map which were later retired or moved. Consider using a different visual style to Live Wayspots.';
                container.appendChild(warning);

                const hint = document.createElement("div");
                hint.style.fontSize = "11px";
                hint.style.marginBottom = "6px";
                hint.textContent = 'Choose which nomination statuses to show on the map. Click "Customise" to adjust marker appearance for a specific status.';
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
                let acceptedRowCheckbox = null;

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
                    const customiseLink = document.createElement("button");
                    customiseLink.type = "button";
                    customiseLink.textContent = "Customise";
                    customiseLink.style.background = "transparent";
                    customiseLink.style.border = "none";
                    customiseLink.style.cursor = "pointer";
                    customiseLink.style.fontSize = "11px";
                    customiseLink.style.textDecoration = "underline";
                    tdCustomise.appendChild(customiseLink);
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

                    function syncFromCfg() {
                        showChk.checked = cfg.enabled !== false;
                        updatePreview();
                    }

                    showChk.addEventListener("change", () => {
                        cfg.enabled = !!showChk.checked;

                        if (key === "ACCEPTED") {
                            warning.style.display = showChk.checked ? "block" : "none";
                        }
                    });

                    customiseLink.addEventListener("click", () => {
                        openMarkerStyleModal(key, label, cfg, () => {
                            updatePreview();
                        });
                    });

                    syncFromCfg();

                    if (key === "ACCEPTED") {
                        acceptedRowCheckbox = showChk;
                    }

                    ctx.rows[key] = {
                        showChk,
                        preview,
                        cfg,
                        updatePreview
                    };
                });

                // Initialise "Accepted" warning visibility
                if (acceptedRowCheckbox && acceptedRowCheckbox.checked) {
                    warning.style.display = "block";
                }

                container.appendChild(table);
                dialog.appendChild(container);

                return ctx;
            },
            onOk(ctx, closeModal) {
                // Persist performance option
                const mapCfg = userSettings.map || (userSettings.map = {});
                mapCfg.performanceModeEnabled = !!(ctx.perfCheckbox && ctx.perfCheckbox.checked);

                // Styles + enabled flags are already reflected in cfg objects via change handlers.
                saveSettings();

                // Rebuild markers with new styles/visibility
                clearNominationMarkers();
                refreshNominationMarkers();

                closeModal();
            }
        });
    }
    // -----------------------------
    // Generic modal framework
    // -----------------------------

    /**
     * Open a simple settings-style modal dialog.
     *
     * @param {Object} options
     * @param {string}   options.id          DOM id for the backdrop. Existing with same id is removed first.
     * @param {string}   options.title       Title shown in the modal header.
     * @param {Function} options.buildContent(bodyEl, okButton)
     *        Called once to populate the body. May return a context object.
     * @param {Function} options.onOk(ctx, closeModal)
     *        Called when OK is clicked. Receives ctx from buildContent and a closeModal function.
     */
    function openSettingsModal(options) {
        const {
            id,
            title,
            buildContent,
            onOk
        } = options || {};

        // Remove any existing modal with the same ID to avoid duplicates
        const existing = document.getElementById(id);
        if (existing && existing.parentNode) {
            existing.parentNode.removeChild(existing);
        }

        // Backdrop
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

        // Dialog
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

        // Header
        const header = document.createElement("div");
        header.className = "wfmapmods-modal-header";
        Object.assign(header.style, {
            padding: "8px 12px",
            borderBottom: "1px solid #ddd",
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

        // Body
        const body = document.createElement("div");
        body.className = "wfmapmods-modal-body";
        Object.assign(body.style, {
            padding: "8px 12px",
            overflowY: "auto",
            flex: "1 1 auto"
        });

        // Footer
        const footer = document.createElement("div");
        footer.className = "wfmapmods-modal-footer";
        Object.assign(footer.style, {
            padding: "8px 12px",
            borderTop: "1px solid #ddd",
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

        // Build content and capture optional context
        let ctx = null;
        if (typeof buildContent === "function") {
            // Pass okBtn so specific modals can enable/disable it for validation
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

        // Button handlers
        closeBtn.addEventListener("click", closeModal);
        cancelBtn.addEventListener("click", closeModal);

        okBtn.addEventListener("click", () => {
            if (typeof onOk === "function") {
                onOk(ctx || {}, closeModal);
            } else {
                closeModal();
            }
        });

        // Close when clicking on the backdrop (but not when clicking inside the dialog)
        backdrop.addEventListener("click", (evt) => {
            if (evt.target === backdrop) {
                closeModal();
            }
        });

        document.addEventListener("keydown", keyHandler);
    }

    // -----------------------------
    // Cross-Userscript Bridges
    // -----------------------------

    /**
     * Send a POI's data to the shared POI bridge element so other userscripts
     * (e.g. main map overlay) can react to the current selection.
     */
    function sendPoiToBridge(poi) {
        if (!poi) return;

        const bridge = document.getElementById(POI_BRIDGE_ID);
        if (!bridge) return;

        // Determine border colour from marker to send to main plug-in
        const statusCfg = getMarkerConfigForStatus(poi.status);

        const payload = {
            id: poi.id || "",
            title: poi.title || "(untitled)",
            description: poi.description || "",
            lat: (typeof poi.lat === "number") ? poi.lat : null,
            lng: (typeof poi.lng === "number") ? poi.lng : null,
            imageUrl: poi.imageUrl || "",
            status: poi.status || "",
            source: POI_BRIDGE_SOURCE,
            dataSourceLogo: WAYFARER_LOGO_SVG,
            dataSourceText: "Wayfarer Contribution",
            borderColor: statusCfg && statusCfg.strokeColor ? statusCfg.strokeColor : null
        };

        try {
            bridge.setAttribute("data-payload", JSON.stringify(payload));
        } catch (e) {
            console.warn("[ContribOverlay] Failed to serialise POI for bridge", e);
        }
    }


    /**
     * Watch the POI bridge element for selection changes coming from *other* scripts.
     * If another script changes the bridge payload, this clears our current selection.
     */
    function setupBridgeSelectionWatcher() {
        const bridge = document.getElementById(POI_BRIDGE_ID);
        if (!bridge) return;

        if (bridge._wfContribObserverAttached) return; // avoid attaching multiple observers
        bridge._wfContribObserverAttached = true;

        const observer = new MutationObserver((mutations) => {
            for (const m of mutations) {
                if (m.type !== "attributes" || m.attributeName !== "data-payload") continue;

                const raw = bridge.getAttribute("data-payload");
                if (!raw) {
                    // No payload → just clear our selection
                    clearNominationSelection();
                    continue;
                }

                let payload;
                try {
                    payload = JSON.parse(raw);
                } catch {
                    // Malformed payload: safest is to clear our selection
                    clearNominationSelection();
                    continue;
                }

                // If this change was triggered by this overlay, ignore it
                if (payload.source === POI_BRIDGE_SOURCE) {
                    return;
                }

                // Another plugin (e.g. main map) selected something:
                // unhighlight our nomination marker.
                clearNominationSelection();
            }
        });

        observer.observe(bridge, {
            attributes: true,
            attributeFilter: ["data-payload"]
        });
    }

    /**
     * Send a "resubmit" payload to the base submission script via a dedicated bridge
     * element so it can prefill the submission form using the existing POI details.
     */
    function sendResubmitToBase(poi) {
        if (!poi) return;
        const bridge = document.getElementById(SUBMISSION_BRIDGE_ID);
        if (!bridge) {
            console.warn("[ContribOverlay] Submission bridge not found");
            return;
        }

        const mainUrl = normalizeImageUrl(poi.imageUrl || "");

        const supportingUrls = Array.isArray(poi.supportingImageUrls)
        ? poi.supportingImageUrls.map(u => normalizeImageUrl(u || "")).filter(Boolean)
        : [];

        const payload = {
            source: POI_BRIDGE_SOURCE,
            poi: {
                id: poi.id || poi.guid || null,
                title: poi.title || "",
                description: poi.description || "",
                supportingStatement: poi.statement || "",
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
            console.warn("[ContribOverlay] Failed to serialise payload for submission bridge", e, payload);
        }
    }

    function normalizeImageUrl(url = "") {
        // Send original resolution images to the submit screen
        if (!url.startsWith("https://lh3.googleusercontent.com/")) return url;
        return url.replace(/=[a-z]\d+$/i, "") + "=s0";
    }

    // -----------------------------
    // Utility helpers
    // -----------------------------

    /**
     * Parse a numeric value, clamp it to [min, max], and return a default
     * value if the input cannot be parsed.
     */
    function clamp(value, min, max, defaultVal) {
        const n = parseFloat(value);
        if (Number.isNaN(n)) return defaultVal;
        if (n < min) return min;
        if (n > max) return max;
        return n;
    }

    /**
     * Convert a hex colour (e.g. "#ff00ff" or "#f0f") and alpha to an rgba() string.
     */
    function hexToRgba(hex, alpha) {
        hex = String(hex || "").trim();
        if (!hex) return `rgba(0,0,0,${alpha})`;

        if (hex[0] === "#") {
            hex = hex.slice(1);
        }
        if (hex.length === 3) {
            // #rgb → #rrggbb
            hex = hex.split("").map(ch => ch + ch).join("");
        }
        const num = parseInt(hex, 16);
        const r = (num >> 16) & 255;
        const g = (num >> 8) & 255;
        const b = num & 255;
        return `rgba(${r},${g},${b},${alpha})`;
    }

    // -----------------------------
    // Plugin bootstrap
    // -----------------------------

    function bootstrap() {
        loadSettings();
        loadNominationsFromIDB();
        setupMapRouteWatcher();
    }

    bootstrap();

})();
