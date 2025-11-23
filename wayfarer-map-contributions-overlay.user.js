// ==UserScript==
// @name         Wayfarer Map - Contributions Overlay
// @version      0.1.0
// @description  Loads nominations from the Contributions list and shows them as markers on the submission map
// @namespace    https://gitlab.com/Tntnnbltn/wayfarer-addons
// @downloadURL  https://gitlab.com/Tntnnbltn/wayfarer-addons/-/raw/main/wayfarer-map-contributions-overlay.user.js
// @homepageURL  https://gitlab.com/Tntnnbltn/wayfarer-addons
// @match        https://wayfarer.nianticlabs.com/*
// @run-at       document-start
// ==/UserScript==

(function () {
    'use strict';

    let submitMap = null;
    let mapAttached = false;

    const SETTINGS_KEY = "wfmap_contributions_settings";
    const OBJECT_STORE_NAME = "contributions";

    const POI_BRIDGE_ID = "wfsmm-poi-bridge";
    const POI_BRIDGE_SOURCE = "wf-contrib-overlay";

    let lastSelectedNomMarker = null;
    let lastSelectedNomOriginalIcon = null;

    const PERFORMANCE_MAX_VISIBLE_MARKERS = 400;

    const MANAGE_ACTION_STATUS = {
        releasehold: "NOMINATED",
        hold: "HELD",
        withdraw: "WITHDRAWN",
        appeal: "APPEALED",
    };

    // -----------------------------
    // Settings (defaults + storage)
    // -----------------------------

    // Default marker config lives here and can be overridden by localStorage.
    // enabled: all true except ACCEPTED: false.
    const userSettings = {
        map: {
            performanceModeEnabled: true,
            performanceMaxVisibleMarkers: PERFORMANCE_MAX_VISIBLE_MARKERS
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
    // Indexed DB
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

    // -----------------------------
    // Parse Contributions data
    // -----------------------------

    let nominations = null;

    /**
     * Overwrite the open method of the XMLHttpRequest.prototype to intercept the server calls
     */
    (function (open, send, setRequestHeader) {
        XMLHttpRequest.prototype.open = function(method, url) {
            const cleanUrl = typeof url === "string" ? url.split("?")[0] : url;

            // Existing GET nominations hook
            if (method === "GET" && cleanUrl === "/api/v1/vault/manage") {
                this.addEventListener("load", parseNominationsFromResponse, false);
            }

            // Your explicit actions mapping version (from earlier):
            const ACTIONS = {
                "/api/v1/vault/manage/hold":        "HELD",
                "/api/v1/vault/manage/releasehold": "NOMINATED",
                "/api/v1/vault/manage/withdraw":    "WITHDRAWN",
                "/api/v1/vault/manage/appeal":      "APPEALED",
            };

            if (method === "POST" && ACTIONS[cleanUrl]) {
                this._wfsmmNewStatus = ACTIONS[cleanUrl];

                this.addEventListener("load", function () {
                    try {
                        const response = this.responseText || this.response;
                        const json = response ? JSON.parse(response) : null;
                        if (!json || json.captcha) return;
                        if (json.result !== "DONE") return;

                        const id = this._wfsmmId;
                        if (!id) return;

                        updateSingleNominationStatus(id, this._wfsmmNewStatus);

                    } catch (err) {
                        console.warn("[ContribOverlay] Error handling manage action:", err);
                    }
                }, false);
            }

            return open.apply(this, arguments);
        };

        XMLHttpRequest.prototype.send = function (body) {
            if (this._wfsmmNewStatus && body) {
                try {
                    if (typeof body === "string") {
                        const parsed = JSON.parse(body);
                        const payload = Array.isArray(parsed) ? parsed[0] : parsed;
                        if (payload && payload.id) {
                            this._wfsmmId = payload.id;
                        }
                    }
                } catch (err) {
                    console.warn("[ContribOverlay] Failed to parse manage action payload:", err);
                }
            }

            return send.apply(this, arguments);
        };

    })(XMLHttpRequest.prototype.open,
       XMLHttpRequest.prototype.send,
       XMLHttpRequest.prototype.setRequestHeader);

    function fetchLatestNominations() {
        // Use absolute URL as requested; relative would also work since we're same-origin.
        fetch("/api/v1/vault/manage", {
            method: "GET",
            credentials: "include" // make sure cookies/session are sent
        })
            .then(res => {
            if (!res.ok) {
                throw new Error(`HTTP ${res.status}`);
            }
            return res.json();
        })
            .then(json => {
            handleNominationsJson(json);
        })
            .catch(err => {
            console.warn("[ContribOverlay] Failed to fetch latest nominations:", err);
        });
    }

    function parseNominationsFromResponse() {
        try {
            const response = this.responseText || this.response;
            const json = JSON.parse(response);
            handleNominationsJson(json);
        } catch (e) {
            console.log('[ContribOverlay] Error parsing nominations:', e);
        }
    }

    function handleNominationsJson(json) {
        if (!json) {
            console.log('[ContribOverlay] No JSON payload for nominations');
            return;
        }

        // ignore if it's related to captchas
        if (json.captcha) return;

        const submissions = json.result && json.result.submissions;
        if (!submissions) {
            console.log('[ContribOverlay] Wayfarer response did not include submissions.');
            return;
        }

        nominations = submissions;
        saveNominationsToIDB(submissions);
        refreshNominationMarkers();
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

    // -----------------------------
    // Map lifecycle + DOM watchers
    // -----------------------------

    function startMapPanelWatcher() {
        // Run once at start in case the panel is already there
        handlePanelChange();

        const mo = new MutationObserver(handlePanelChange);
        mo.observe(document.body, {
            childList: true,
            subtree: true
        });
    }

    let lastPanelPresent = false;

    function handlePanelChange() {
        const panelPresent = !!document.querySelector("#wfsmm-side-panel");

        if (panelPresent && !lastPanelPresent) {
            // We just arrived on the map page
            attachContribOverlayToMapIfNeeded();
            insertSettingsLink();
        } else if (!panelPresent && lastPanelPresent) {
            // We just left the map page
            teardownContribOverlayForMap();
        }

        lastPanelPresent = panelPresent;
    }

    function getSubmitMap() {
        return new Promise(resolve => {
            let attempts = 40;

            function tryFindMap() {
                const candidates = document.querySelectorAll('app-submit-wayspot-map nia-map');
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
                            /* ignore invalid entries */
                        }
                    }
                });

                if (foundMap) {
                    resolve(foundMap);
                    return;
                }

                if (attempts-- <= 0) {
                    console.warn("[ContribOverlay] Failed to find submit map after several attempts");
                    resolve(null);
                    return;
                }

                setTimeout(tryFindMap, 250);
            }

            tryFindMap();
        });
    }

    function clearNominationMarkers() {
        if (!nominationMarkers) return;
        Object.values(nominationMarkers).forEach(m => {
            if (m && typeof m.setMap === "function") {
                m.setMap(null);
            }
        });
        nominationMarkers = {};
    }

    function teardownContribOverlayForMap() {
        if (!mapAttached) return;

        clearNominationMarkers();
        submitMap = null;
        mapAttached = false;
    }

    async function attachContribOverlayToMapIfNeeded() {
        if (mapAttached) {
            refreshNominationMarkers();
            return;
        }

        const map = await getSubmitMap();

        if (!map) {
            console.warn("[ContribOverlay] Map not found – cannot attach");
            return;
        }

        submitMap = map;
        mapAttached = true;

        // Attach a listener so markers update when user pans/zooms.
        if (!submitMap._contribOverlayBoundsListenerAdded) {
            submitMap.addListener("idle", refreshNominationMarkers);
            submitMap._contribOverlayBoundsListenerAdded = true;
        }

        // Draw whatever nominations we already have (if any)
        refreshNominationMarkers();
    }

    // -----------------------------
    // Settings link + modal
    // -----------------------------

    function insertSettingsLink() {
        const panelCheck = setInterval(() => {
            const settingsBody = document.querySelector(".wfsmm-settings-links");
            if (!settingsBody) return; // retry

            clearInterval(panelCheck);

            // Prevent duplicate link insertion
            if (document.getElementById("wfsmm-settings-contributions")) return;

            const link = document.createElement("a");
            link.id = "wfsmm-settings-contributions";
            link.textContent = "My Contributions";

            settingsBody.appendChild(link);

            link.addEventListener("click", () => {
                openContributionMarkerSettingsWindow();
            });
        }, 300);
    }

    function openMarkerStyleModal(statusKey, label, cfg, onUpdated) {
        openSettingsModal({
            id: `wf-contrib-marker-style-${statusKey}`,
            title: `Customise marker – ${label}`,
            buildContent(body) {
                const section = document.createElement("div");
                section.className = "wfsmm-modal-section";

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

    function openContributionMarkerSettingsWindow() {
        const markersCfgRoot = userSettings.markers || (userSettings.markers = {});
        const markersCfg = markersCfgRoot.statuses || (markersCfgRoot.statuses = {});

        // Ensure DEFAULT exists as a fallback
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

        // Order with ACCEPTED at the bottom
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
                container.className = "wfsmm-modal-section";

                // ---- PERFORMANCE / LOTS OF MARKERS SECTION ----
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
                perfCheckbox.id = "wf-contrib-performance-mode";
                perfCheckbox.checked = !!mapCfg.performanceModeEnabled;

                const perfLabel = document.createElement("label");
                perfLabel.htmlFor = perfCheckbox.id;
                perfLabel.style.fontSize = "11px";
                perfLabel.textContent = 'Improve performance when lots of markers';

                const perfHelp = document.createElement("div");
                perfHelp.style.fontSize = "10px";
                perfHelp.style.color = "#6b7280";
                perfHelp.style.marginLeft = "20px";
                perfHelp.style.marginTop = "2px";
                perfHelp.textContent = 'Hides markers at low zoom levels to prevent lag.';

                perfRow.appendChild(perfCheckbox);
                perfRow.appendChild(perfLabel);
                container.appendChild(perfRow);
                container.appendChild(perfHelp);
                // ---- END PERFORMANCE SECTION ----

                // ACCEPTED warning banner
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
                table.className = "wfsmm-circle-table";
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
                    showChk.className = "wfsmm-modal-checkbox";
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
                    customiseLink.style.color = "#2563eb";
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

                // Initialise warning visibility based on current ACCEPTED setting
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
                if (typeof mapCfg.performanceMaxVisibleMarkers !== "number") {
                    mapCfg.performanceMaxVisibleMarkers = PERFORMANCE_MAX_VISIBLE_MARKERS;
                }

                // Styles + enabled flags are already kept in cfg objects by change handlers,
                // so we just need to save & refresh.
                saveSettings();

                // Rebuild markers with new styles/visibility
                clearNominationMarkers();
                refreshNominationMarkers();

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

        // If there's already a modal with this ID, remove it to avoid duplicates
        const existing = document.getElementById(id);
        if (existing && existing.parentNode) {
            existing.parentNode.removeChild(existing);
        }

        // Backdrop
        const backdrop = document.createElement("div");
        backdrop.id = id;
        backdrop.className = "wfsmm-modal-backdrop";
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
        dialog.className = "wfsmm-modal-dialog";
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
        header.className = "wfsmm-modal-header";
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
        body.className = "wfsmm-modal-body";
        Object.assign(body.style, {
            padding: "8px 12px",
            overflowY: "auto",
            flex: "1 1 auto"
        });

        // Footer
        const footer = document.createElement("div");
        footer.className = "wfsmm-modal-footer";
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

        // Build content and get ctx
        let ctx = null;
        if (typeof buildContent === "function") {
            ctx = buildContent(body) || {};
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

        // Optional: close when clicking outside dialog
        backdrop.addEventListener("click", (evt) => {
            if (evt.target === backdrop) {
                closeModal();
            }
        });

        document.addEventListener("keydown", keyHandler);
    }

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
    // Nominations -> Map markers
    // -----------------------------

    let nominationMarkers = {};

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
                scale: cfg.scale
            }
        });

        marker.addListener("click", () => {
            console.log('click mew');
            // 1) Locally show selection (but preserve colour coding)
            selectNominationMarker(marker);

            // 2) Tell the main plugin: this POI is the selected one
            sendPoiToBridge(poi);

            // 3) Update contribution management links on the side panel
            updateNominationActionLinks(poi);

        });

        return marker;
    }

    function clearNominationSelection() {
        hideNominationActionLinks();

        if (lastSelectedNomMarker && lastSelectedNomOriginalIcon) {
            lastSelectedNomMarker.setIcon(lastSelectedNomOriginalIcon);
        }
        lastSelectedNomMarker = null;
        lastSelectedNomOriginalIcon = null;
    }

    function selectNominationMarker(marker) {
        // Remove highlight from previous selected nomination marker
        clearNominationSelection();

        if (!marker || !marker.getIcon) return;

        const icon = marker.getIcon();
        if (!icon) return;

        // Remember original so we can restore later
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

    // Bounds-based, marker-reuse, with enabled-flag support
    function refreshNominationMarkers() {
        console.log('refreshing markers');
        if (!submitMap || !nominations || !Array.isArray(nominations)) {
            return;
        }

        const bounds = submitMap.getBounds();
        if (!bounds) {
            // Map not fully initialised yet
            return;
        }

        const mapCfg = userSettings.map || {};
        const performanceModeEnabled = !!mapCfg.performanceModeEnabled;
        const maxVisibleMarkers = typeof mapCfg.performanceMaxVisibleMarkers === "number"
        ? mapCfg.performanceMaxVisibleMarkers
        : PERFORMANCE_MAX_VISIBLE_MARKERS;

        // First pass: find all nominations that *would* be visible
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
                // Don't show markers for this status at all
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
            // 1) Try removing ACCEPTED only
            const excludeAccepted = new Set(["ACCEPTED"]);
            const withoutAccepted = filterCandidateIdsByStatus(candidateIds, candidatePoisById, excludeAccepted);

            if (withoutAccepted.length <= maxVisibleMarkers) {
                finalCandidateIds = withoutAccepted;
            } else {
                // 2) Try removing ACCEPTED + REJECTED + DUPLICATE + WITHDRAWN
                const excludeAcceptedRejectedDup = new Set(["ACCEPTED", "REJECTED", "DUPLICATE", "WITHDRAWN"]);
                const withoutAcceptedRejectedDup = filterCandidateIdsByStatus(candidateIds, candidatePoisById, excludeAcceptedRejectedDup);

                if (withoutAcceptedRejectedDup.length <= maxVisibleMarkers) {
                    finalCandidateIds = withoutAcceptedRejectedDup;
                } else {
                    // 3) Still too many → hide everything
                    clearNominationMarkers();
                    return;
                }
            }
        }

        // Second pass: actually create/show markers for the chosen candidate set
        const inBoundsIds = new Set(finalCandidateIds);

        finalCandidateIds.forEach(id => {
            const poi = candidatePoisById[id];
            if (!poi) return;

            let marker = nominationMarkers[id];
            const cfg = getMarkerConfigForStatus(poi.status);

            // Base icon from current status
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
                // New marker
                marker = new google.maps.Marker({
                    map: null, // attach later when in-bounds
                    position: { lat: poi.lat, lng: poi.lng },
                    title: `${poi.title || "No title"} (${String(poi.status || "").toUpperCase() || "UNKNOWN"})`,
                    icon: baseIcon
                });

                marker.addListener("click", () => {
                    selectNominationMarker(marker);
                    sendPoiToBridge(poi);
                    updateNominationActionLinks(poi);
                });

                nominationMarkers[id] = marker;
            } else {
                // Existing marker: update its icon to match new status
                if (marker === lastSelectedNomMarker) {
                    // Update selected marker styling based on new base icon
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
                marker.setMap(submitMap);
            }
        });

        // Hide markers that are no longer in bounds or no longer eligible
        Object.entries(nominationMarkers).forEach(([id, marker]) => {
            if (!marker) return;
            if (!inBoundsIds.has(id) && marker.getMap()) {
                marker.setMap(null);
            }
        });
    }


    // -----------------------------
    // Managing Contribution status via map
    // -----------------------------

    function getCookie(name) {
        const match = document.cookie.match(new RegExp("(^|; )" + name + "=([^;]*)"));
        return match ? decodeURIComponent(match[2]) : null;
    }

    function getCsrfToken() {
        return getCookie("XSRF-TOKEN") || "";
    }

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

    function hideNominationActionLinks() {
        const container = document.querySelector(".wfsmm-poi-function-links");
        if (!container) return;

        const ids = [
            "#wfsmm-function-hold",
            "#wfsmm-function-release-hold",
            "#wfsmm-function-withdraw"
        ];
        ids.forEach(sel => {
            const el = container.querySelector(sel);
            if (el) el.style.display = "none";
        });
    }

    function updateNominationActionLinks(poi) {
        if (!poi || poi.type !== "NOMINATION") {
            hideNominationActionLinks();
            return;
        }

        const container = document.querySelector(".wfsmm-poi-function-links");
        if (!container) return;

        const status = String(poi.status || "").toUpperCase();
        const id = poi.id;
        if (!id) return;

        // Ensure links exist (create once, reuse)
        let holdLink = container.querySelector("#wfsmm-function-hold");
        if (!holdLink) {
            holdLink = document.createElement("a");
            holdLink.id = "wfsmm-function-hold";
            holdLink.textContent = "Place On Hold";
            holdLink.style.cursor = "pointer";
            holdLink.style.marginLeft = "8px";
            holdLink.addEventListener("click", ev => {
                ev.preventDefault();
                const targetId = holdLink.dataset.id;
                if (!targetId) return;
                sendManageActionForNomination("hold", targetId);
            });
            container.appendChild(holdLink);
        }

        let releaseHoldLink = container.querySelector("#wfsmm-function-release-hold");
        if (!releaseHoldLink) {
            releaseHoldLink = document.createElement("a");
            releaseHoldLink.id = "wfsmm-function-release-hold";
            releaseHoldLink.textContent = "Release Hold";
            releaseHoldLink.style.cursor = "pointer";
            releaseHoldLink.style.marginLeft = "8px";
            releaseHoldLink.addEventListener("click", ev => {
                ev.preventDefault();
                const targetId = releaseHoldLink.dataset.id;
                if (!targetId) return;
                sendManageActionForNomination("releasehold", targetId);
            });
            container.appendChild(releaseHoldLink);
        }

        let withdrawLink = container.querySelector("#wfsmm-function-withdraw");
        if (!withdrawLink) {
            withdrawLink = document.createElement("a");
            withdrawLink.id = "wfsmm-function-withdraw";
            withdrawLink.textContent = "Withdraw";
            withdrawLink.style.cursor = "pointer";
            withdrawLink.style.marginLeft = "8px";
            withdrawLink.addEventListener("click", ev => {
                ev.preventDefault();
                const targetId = withdrawLink.dataset.id;
                if (!targetId) return;
                sendManageActionForNomination("withdraw", targetId);
            });
            container.appendChild(withdrawLink);
        }

        // Update the id on each link so they act on the selected POI
        holdLink.dataset.id = id;
        releaseHoldLink.dataset.id = id;
        withdrawLink.dataset.id = id;

        console.log('still going');
        // Show/hide based on current status
        if (status === "NOMINATED") {
            // NOMINATED → can Hold or Withdraw
            holdLink.style.display = "inline-block";
            withdrawLink.style.display = "inline-block";
            releaseHoldLink.style.display = "none";
        } else if (status === "HELD") {
            // HELD → can Release Hold or Withdraw
            holdLink.style.display = "none";
            withdrawLink.style.display = "none";
            releaseHoldLink.style.display = "inline-block";
        } else {
            // Any other status → hide all three
            holdLink.style.display = "none";
            withdrawLink.style.display = "none";
            releaseHoldLink.style.display = "none";
        }
    }

    // -----------------------------
    // POI bridge (cross-userscript data bus)
    // -----------------------------

    function sendPoiToBridge(poi) {
        if (!poi) return;

        const bridge = document.getElementById(POI_BRIDGE_ID);
        if (!bridge) return;

        const payload = {
            guid: poi.id || "",
            title: poi.title || "(untitled)",
            description: poi.description || "",
            lat: (typeof poi.lat === "number") ? poi.lat : null,
            lng: (typeof poi.lng === "number") ? poi.lng : null,
            imageUrl: poi.imageUrl || "",
            status: poi.status || "",
            source: POI_BRIDGE_SOURCE
        };

        try {
            bridge.setAttribute("data-payload", JSON.stringify(payload));
        } catch (e) {
            console.warn("[ContribOverlay] Failed to serialise POI for bridge", e);
        }
    }

    function setupBridgeSelectionWatcher() {
        const bridge = document.getElementById(POI_BRIDGE_ID);
        if (!bridge) return;

        if (bridge._wfContribObserverAttached) return; // avoid double observers
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
                    // If it’s malformed, safest is to clear our selection
                    clearNominationSelection();
                    continue;
                }

                // If *we* triggered this change, don't clear ourselves
                if (payload.source === POI_BRIDGE_SOURCE) {
                    return;
                }

                // Another plugin (e.g. main map plugin) selected something:
                // unhighlight our nomination marker.
                clearNominationSelection();
            }
        });

        observer.observe(bridge, {
            attributes: true,
            attributeFilter: ["data-payload"]
        });
    }

    // -----------------------------
    // Plugin bootstrap
    // -----------------------------

    function bootstrap() {
        loadSettings();
        loadNominationsFromIDB();
        startMapPanelWatcher();
        fetchLatestNominations();
        setupBridgeSelectionWatcher();
    }

    bootstrap();

})();
