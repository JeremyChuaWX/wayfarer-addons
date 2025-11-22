// ==UserScript==
// @name         Wayfarer Map - Contributions Overlay
// @version      0.0.1
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

    // These are now only used by the existing settings modal UI.
    const BUILTIN_TYPES = ["roadmap", "satellite", "hybrid"];
    const CUSTOM_PROVIDER_NAMES = ["Bing", "Esri", "Esri Clarity", "OSM"];

    // -----------------------------
    // Settings (defaults + storage)
    // -----------------------------

    // Default marker config lives here and can be overridden by localStorage.
    // enabled: all true except ACCEPTED: false.
    const userSettings = {
        map: {},
        markers: {
            statuses: {
                // Fallback style if a status isn't explicitly listed
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
                    strokeColor: "#22c55e", // green
                    strokeWeight: 2,
                    strokeOpacity: 1.0,
                    fillColor: "#22c55e",
                    fillOpacity: 0.6,
                    scale: 8,
                    enabled: false        // <--- only one disabled by default
                },
                REJECTED: {
                    strokeColor: "#ff0000", // red
                    strokeWeight: 2,
                    strokeOpacity: 1.0,
                    fillColor: "#ff0000",
                    fillOpacity: 0.7,
                    scale: 8,
                    enabled: true
                },
                DUPLICATE: {
                    strokeColor: "#ff0000", // red
                    strokeWeight: 2,
                    strokeOpacity: 1.0,
                    fillColor: "#ff0000",
                    fillOpacity: 0.7,
                    scale: 8,
                    enabled: true
                },
                VOTING: {
                    strokeColor: "#002ec7", // blue
                    strokeWeight: 2,
                    strokeOpacity: 1.0,
                    fillColor: "#002ec7",
                    fillOpacity: 0.6,
                    scale: 8,
                    enabled: true
                },
                NOMINATED: {
                    strokeColor: "#38bdf8", // light blue
                    strokeWeight: 2,
                    strokeOpacity: 1.0,
                    fillColor: "#38bdf8",
                    fillOpacity: 0.6,
                    scale: 8,
                    enabled: true
                },
                HELD: {
                    strokeColor: "#facc15", // yellow
                    strokeWeight: 2,
                    strokeOpacity: 1.0,
                    fillColor: "#facc15",
                    fillOpacity: 0.6,
                    scale: 8,
                    enabled: true
                },
                WITHDRAWN: {
                    strokeColor: "#9ca3af", // grey
                    strokeWeight: 2,
                    strokeOpacity: 1.0,
                    fillColor: "#9ca3af",
                    fillOpacity: 0.6,
                    scale: 8,
                    enabled: true
                },
                NIANTIC_REVIEW: {
                    strokeColor: "#001661", // dark blue
                    strokeWeight: 2,
                    strokeOpacity: 1.0,
                    fillColor: "#001661",
                    fillOpacity: 0.6,
                    scale: 8,
                    enabled: true
                },
                APPEALED: {
                    strokeColor: "#a855f7", // purple
                    strokeWeight: 2,
                    strokeOpacity: 1.0,
                    fillColor: "#a855f7",
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

        const STATUS_ROWS = [
            { key: "ACCEPTED",        label: "Accepted" },
            { key: "NOMINATED",       label: "Nominated" },
            { key: "VOTING",          label: "Voting" },
            { key: "NIANTIC_REVIEW",  label: "Niantic Review" },
            { key: "APPEALED",        label: "Appealed" },
            { key: "HELD",            label: "Hold" },
            { key: "WITHDRAWN",       label: "Withdrawn" },
            { key: "REJECTED",        label: "Rejected" },
            { key: "DUPLICATE",       label: "Duplicate" }
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
                const section = document.createElement("div");
                section.className = "wfsmm-modal-section";

                const header = document.createElement("div");
                header.className = "wfsmm-modal-section-header";
                header.textContent = "Marker style by contribution status";
                section.appendChild(header);

                const hint = document.createElement("div");
                hint.style.fontSize = "11px";
                hint.style.marginBottom = "4px";
                hint.textContent = "Adjust the appearance of markers for each status. Preview updates live; click OK to apply.";
                section.appendChild(hint);

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
                    th.style.textAlign = "center";
                    return th;
                }

                function makeTD() {
                    const td = document.createElement("td");
                    td.style.padding = "2px 4px";
                    td.style.textAlign = "center";
                    return td;
                }

                function styleColorInput(input) {
                    input.className = "wfsmm-modal-color";
                    input.style.width = "26px";
                    input.style.padding = "0";
                }

                function styleNumericInput(input) {
                    input.className = "wfsmm-modal-input-small";
                    input.style.textAlign = "center";
                    input.style.width = "38px";
                    input.style.padding = "0 2px";
                }

                // Header row
                const headerRow = document.createElement("tr");
                const thStatus = makeTH("Status");
                thStatus.style.textAlign = "left";
                const thEnabled = makeTH("Show");
                const thStrokeColor = makeTH("Line colour");
                const thStrokeOpacity = makeTH("Line opacity");
                const thStrokeWidth = makeTH("Line width");
                const thFillColor = makeTH("Fill colour");
                const thFillOpacity = makeTH("Fill opacity");
                const thScale = makeTH("Size");
                const thPreview = makeTH("Preview");

                headerRow.appendChild(thStatus);
                headerRow.appendChild(thEnabled);
                headerRow.appendChild(thStrokeColor);
                headerRow.appendChild(thStrokeOpacity);
                headerRow.appendChild(thStrokeWidth);
                headerRow.appendChild(thFillColor);
                headerRow.appendChild(thFillOpacity);
                headerRow.appendChild(thScale);
                headerRow.appendChild(thPreview);
                table.appendChild(headerRow);

                const ctx = { rows: {} };

                STATUS_ROWS.forEach(({ key, label }) => {
                    const cfg = ensureCfgForStatus(key);

                    const row = document.createElement("tr");

                    // Status label
                    const tdLabel = makeTD();
                    tdLabel.style.textAlign = "left";
                    tdLabel.style.whiteSpace = "nowrap";
                    tdLabel.textContent = label;
                    row.appendChild(tdLabel);

                    // Enabled checkbox
                    const tdEnabled = makeTD();
                    const enabledChk = document.createElement("input");
                    enabledChk.type = "checkbox";
                    enabledChk.className = "wfsmm-modal-checkbox";
                    enabledChk.checked = cfg.enabled !== false;
                    tdEnabled.appendChild(enabledChk);
                    row.appendChild(tdEnabled);

                    // Stroke colour
                    const tdStrokeColor = makeTD();
                    const strokeColorInput = document.createElement("input");
                    strokeColorInput.type = "color";
                    strokeColorInput.value = cfg.strokeColor || markersCfg.DEFAULT.strokeColor;
                    styleColorInput(strokeColorInput);
                    tdStrokeColor.appendChild(strokeColorInput);
                    row.appendChild(tdStrokeColor);

                    // Stroke opacity
                    const tdStrokeOpacity = makeTD();
                    const strokeOpacityInput = document.createElement("input");
                    strokeOpacityInput.type = "number";
                    strokeOpacityInput.min = "0";
                    strokeOpacityInput.max = "1";
                    strokeOpacityInput.step = "0.05";
                    strokeOpacityInput.value = cfg.strokeOpacity ?? 1.0;
                    styleNumericInput(strokeOpacityInput);
                    tdStrokeOpacity.appendChild(strokeOpacityInput);
                    row.appendChild(tdStrokeOpacity);

                    // Stroke width
                    const tdStrokeWidth = makeTD();
                    const strokeWidthInput = document.createElement("input");
                    strokeWidthInput.type = "number";
                    strokeWidthInput.min = "0";
                    strokeWidthInput.max = "10";
                    strokeWidthInput.step = "0.5";
                    strokeWidthInput.value = cfg.strokeWeight ?? 2;
                    styleNumericInput(strokeWidthInput);
                    tdStrokeWidth.appendChild(strokeWidthInput);
                    row.appendChild(tdStrokeWidth);

                    // Fill colour
                    const tdFillColor = makeTD();
                    const fillColorInput = document.createElement("input");
                    fillColorInput.type = "color";
                    fillColorInput.value = cfg.fillColor || markersCfg.DEFAULT.fillColor;
                    styleColorInput(fillColorInput);
                    tdFillColor.appendChild(fillColorInput);
                    row.appendChild(tdFillColor);

                    // Fill opacity
                    const tdFillOpacity = makeTD();
                    const fillOpacityInput = document.createElement("input");
                    fillOpacityInput.type = "number";
                    fillOpacityInput.min = "0";
                    fillOpacityInput.max = "1";
                    fillOpacityInput.step = "0.05";
                    fillOpacityInput.value = cfg.fillOpacity ?? 0.5;
                    styleNumericInput(fillOpacityInput);
                    tdFillOpacity.appendChild(fillOpacityInput);
                    row.appendChild(tdFillOpacity);

                    // Scale (marker size)
                    const tdScale = makeTD();
                    const scaleInput = document.createElement("input");
                    scaleInput.type = "number";
                    scaleInput.min = "2";
                    scaleInput.max = "30";
                    scaleInput.step = "1";
                    scaleInput.value = cfg.scale ?? 8;
                    styleNumericInput(scaleInput);
                    tdScale.appendChild(scaleInput);
                    row.appendChild(tdScale);

                    // Preview
                    const tdPreview = makeTD();
                    const preview = document.createElement("div");
                    preview.style.display = "inline-block";
                    preview.style.borderRadius = "50%";
                    preview.style.boxSizing = "border-box";
                    preview.style.verticalAlign = "middle";
                    tdPreview.appendChild(preview);
                    row.appendChild(tdPreview);

                    table.appendChild(row);

                    // Live preview update
                    function updatePreview() {
                        const enabled = !!enabledChk.checked;
                        const strokeColor = strokeColorInput.value || "#000000";
                        const strokeOpacity = clamp(strokeOpacityInput.value, 0, 1, 1.0);
                        const strokeWidth = clamp(strokeWidthInput.value, 0, 10, 2);
                        const fillColor = fillColorInput.value || "#000000";
                        const fillOpacity = clamp(fillOpacityInput.value, 0, 1, 0.5);
                        const scale = clamp(scaleInput.value, 2, 30, 8);

                        const sizePx = scale * 2; // arbitrary but looks reasonable
                        preview.style.width = `${sizePx}px`;
                        preview.style.height = `${sizePx}px`;

                        preview.style.border = `${strokeWidth}px solid ${hexToRgba(strokeColor, strokeOpacity)}`;
                        preview.style.backgroundColor = hexToRgba(fillColor, fillOpacity);
                    }

                    [enabledChk, strokeColorInput, strokeOpacityInput,
                     strokeWidthInput, fillColorInput, fillOpacityInput, scaleInput]
                        .forEach(el => el.addEventListener("input", updatePreview));

                    updatePreview();

                    ctx.rows[key] = {
                        enabledChk,
                        strokeColorInput,
                        strokeOpacityInput,
                        strokeWidthInput,
                        fillColorInput,
                        fillOpacityInput,
                        scaleInput
                    };
                });

                section.appendChild(table);
                dialog.appendChild(section);

                return ctx;
            },
            onOk(ctx, closeModal) {
                const rows = ctx.rows || {};
                Object.keys(rows).forEach(key => {
                    const row = rows[key];
                    const cfg = ensureCfgForStatus(key);

                    cfg.enabled = !!row.enabledChk.checked;
                    cfg.strokeColor = row.strokeColorInput.value || cfg.strokeColor || "#6b7280";
                    cfg.strokeOpacity = clamp(row.strokeOpacityInput.value, 0, 1, cfg.strokeOpacity ?? 1.0);
                    cfg.strokeWeight = clamp(row.strokeWidthInput.value, 0, 10, cfg.strokeWeight ?? 2);
                    cfg.fillColor = row.fillColorInput.value || cfg.fillColor || "#6b7280";
                    cfg.fillOpacity = clamp(row.fillOpacityInput.value, 0, 1, cfg.fillOpacity ?? 0.5);
                    cfg.scale = clamp(row.scaleInput.value, 2, 30, cfg.scale ?? 8);
                });

                saveSettings();

                // Rebuild markers with new styles
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
            minWidth: "550px",
            maxWidth: "750px",
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
    // Parse Contributions data
    // -----------------------------

    let nominations = null;

    /**
     * Overwrite the open method of the XMLHttpRequest.prototype to intercept the server calls
     */
    (function (open) {
        XMLHttpRequest.prototype.open = function (method, url) {
            if (url === '/api/v1/vault/manage' && method === 'GET') {
                this.addEventListener('load', parseNominationsFromResponse, false);
            }
            open.apply(this, arguments);
        };
    })(XMLHttpRequest.prototype.open);

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
            // 1) Locally show selection (but preserve colour coding)
            selectNominationMarker(marker);

            // 2) Tell the main plugin: this POI is the selected one
            sendPoiToBridge(poi);
        });

        return marker;
    }


    function clearNominationSelection() {
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

        // Build a "selected" icon that:
        // - keeps fillColor + fillOpacity (status colour)
        // - adds a stronger magenta stroke
        // - thickens stroke
        // - slightly increases size
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

    // Bounds-based, marker-reuse, with enabled-flag support
    function refreshNominationMarkers() {
        if (!submitMap || !nominations || !Array.isArray(nominations)) {
            return;
        }

        const bounds = submitMap.getBounds();
        if (!bounds) {
            // Map not fully initialised yet
            return;
        }

        const inBoundsIds = new Set();

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
            inBoundsIds.add(id);

            let marker = nominationMarkers[id];
            if (!marker) {
                marker = createNominationMarker(poi);
                nominationMarkers[id] = marker;
            }

            if (!marker.getMap()) {
                marker.setMap(submitMap);
            }
        });

        // Hide markers that are no longer in bounds OR are now disabled
        Object.entries(nominationMarkers).forEach(([id, marker]) => {
            if (!marker) return;
            if (!inBoundsIds.has(id) && marker.getMap()) {
                marker.setMap(null);
            }
        });
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
