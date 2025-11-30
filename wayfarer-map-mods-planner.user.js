// ==UserScript==
// @name         Wayfarer Map Mods - Planner
// @version      0.1.2
// @description  Load and edit planner POIs from a Google Sheet and show them as pins on the Wayfarer submission map.
// @namespace    https://gitlab.com/Tntnnbltn/wayfarer-addons
// @downloadURL  https://gitlab.com/Tntnnbltn/wayfarer-addons/-/raw/main/wayfarer-map-mods-planner.user.js
// @homepageURL  https://gitlab.com/Tntnnbltn/wayfarer-addons
// @match        https://wayfarer.nianticlabs.com/*
// @run-at       document-start
// @grant        none
// ==/UserScript==

(function () {
    'use strict';

    // -----------------------------
    // Constants & settings
    // -----------------------------

    const SETTINGS_KEY = "wfmap_planner_settings";

    const POI_BRIDGE_SOURCE = "wfmapmods-planner";
    const SUBMISSION_BRIDGE_ID = "wfmapmods-submit-bridge";

    const PERFORMANCE_MAX_VISIBLE_MARKERS = 500;

    let plannerInfoWindow = null;

    let activeEditContext = null;

    let addModeEnabled = false;

    // Default marker statuses and colours (can be extended by data).
    const DEFAULT_STATUS_CONFIG = {
        potential:   { title: "Potential",             color: "#808080" },
        held:        { title: "On hold",               color: "#facc15" },
        submitted:   { title: "Submitted",             color: "#fb923c" },
        voting:      { title: "Voting",                color: "#b45309" },
        NIANTIC_REVIEW: { title: "Niantic Review",     color: "#ec4899" },
        live:        { title: "Accepted",              color: "#22c55e" },
        rejected:    { title: "Rejected",              color: "#ef4444" },
        appealed:    { title: "Appealed",              color: "#000000" },
        potentialedit: { title: "Potential edit",      color: "#60a5fa" },
        sentedit:    { title: "Sent edit",             color: "#a855f7" }
    };

    // Base user settings (overridable via localStorage).
    const userSettings = {
        planner: {
            scriptURL: "",
            showTitles: true,
            enableDragging: false,
            enableImagePreview: true,
            performanceModeEnabled: true,
            performanceMaxVisibleMarkers: PERFORMANCE_MAX_VISIBLE_MARKERS,
            layerEnabled: true
        },
        markers: {
            // statusKey -> { color: "#xxxxxx", enabled: true }
            statuses: {}
        }
    };

    // Used when adding new unknown statuses from data.
    const DEFAULT_COLOR_LIST = [
        "#27AE60","#73C6B6","#AEB6BF","#EDBB99","#AF601A",
        "#CB4335","#F1948A","#2874A6","#D6EAF8","#239B56",
        "#909497","#FAE5D3","#85C1E9","#9B59B6","#E67E22",
        "#2980B9","#F2F3F4","#F1C40F","#BB8FCE","#FAD7A0",
        "#C0392B","#F6DDCC","#1ABC9C","#117A65","#283747",
        "#B7950B","#6C3483","#D0ECE7","#82E0AA"
    ];

    // -----------------------------
    // Runtime state
    // -----------------------------

    let submitMap = null;
    let mapAttached = false;

    /** Planner POIs array (as returned by Apps Script). */
    let plannerPois = [];

    /** id -> google.maps.Marker */
    let plannerMarkers = {};

    let lastPanelPresent = false;
    let colorListIndex = 0;

    // -----------------------------
    // Settings load/save
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
            if (saved) {
                mergeDeep(userSettings, JSON.parse(saved));
            }
        } catch (e) {
            console.error(`${SETTINGS_KEY} - Failed to load settings:`, e);
        }

        // Ensure default status config exists for any missing.
        const statusesCfg = userSettings.markers.statuses || (userSettings.markers.statuses = {});
        Object.entries(DEFAULT_STATUS_CONFIG).forEach(([key, def]) => {
            if (!statusesCfg[key]) {
                statusesCfg[key] = {
                    color: def.color,
                    enabled: true
                };
            }
        });
    }

    function saveSettings() {
        try {
            localStorage.setItem(SETTINGS_KEY, JSON.stringify(userSettings));
        } catch (e) {
            console.error(`${SETTINGS_KEY} - Failed to save settings:`, e);
        }
    }

    // -----------------------------
    // Planner data: status config
    // -----------------------------

    function ensureStatusConfigFor(statusKey) {
        const statusesCfg = userSettings.markers.statuses || (userSettings.markers.statuses = {});
        if (!statusesCfg[statusKey]) {
            const fallback = DEFAULT_STATUS_CONFIG[statusKey];
            let color = fallback ? fallback.color : null;
            if (!color) {
                // Assign colour from rotating palette.
                if (colorListIndex >= DEFAULT_COLOR_LIST.length) {
                    colorListIndex = 0;
                }
                color = DEFAULT_COLOR_LIST[colorListIndex++];
            }
            statusesCfg[statusKey] = {
                color,
                enabled: true
            };
        }
        return statusesCfg[statusKey];
    }

    function getStatusLabel(statusKey) {
        const def = DEFAULT_STATUS_CONFIG[statusKey];
        if (def && def.title) return def.title;
        if (!statusKey) return "Unknown";
        const s = String(statusKey);
        return s.charAt(0).toUpperCase() + s.slice(1);
    }

    // -----------------------------
    // Network: Google Apps Script
    // -----------------------------

    function getScriptURL() {
        return (userSettings.planner && userSettings.planner.scriptURL) || "";
    }

    function fetchPlannerData() {
        const url = getScriptURL();
        if (!url) {
            plannerPois = [];
            refreshPlannerMarkers();
            return;
        }

        fetch(url, {
            method: "GET",
            credentials: "omit"
        })
            .then(res => {
            if (!res.ok) {
                throw new Error(`HTTP ${res.status}`);
            }
            return res.text();
        })
            .then(text => {
            let json;
            try {
                json = JSON.parse(text);
            } catch (e) {
                console.error("[Planner] Failed to parse response JSON:", e);
                window.alert("Wayfarer Planner: failed to parse response. Check your script URL.");
                return;
            }
            if (!Array.isArray(json)) {
                console.warn("[Planner] Expected array of POIs from script URL");
                return;
            }

            plannerPois = json.map(p => {
                const lat = typeof p.lat === "number" ? p.lat : parseFloat(p.lat);
                const lng = typeof p.lng === "number" ? p.lng : parseFloat(p.lng);
                return {
                    ...p,
                    lat,
                    lng
                };
            });
            // Ensure any new status keys have config.
            plannerPois.forEach(poi => {
                if (!poi || !poi.status) return;
                ensureStatusConfigFor(String(poi.status));
            });

            refreshPlannerMarkers();
        })
            .catch(err => {
            console.warn("[Planner] Failed to fetch planner data:", err);
            window.alert(
                "Wayfarer Planner: failed to retrieve data from the script URL.\n" +
                "Please verify the URL and that no extension blocks access to Google."
            );
        });
    }

    /**
     * Send create/update for a planner POI.
     * Payload format is kept similar to IITC version for compatibility with the same Apps Script.
     */
    function sendPlannerPoiToScript(poiFields, onSuccess) {
        const url = getScriptURL();
        if (!url) {
            window.alert("Wayfarer Planner: script URL is not configured.");
            return;
        }

        const formData = new FormData();

        // Standard fields (kept compatible with IITC script).
        formData.append("id", poiFields.id || "");
        formData.append("status", poiFields.status || "potential");
        formData.append("title", poiFields.title || "");
        formData.append("description", poiFields.description || "");
        formData.append("lat", String(poiFields.lat || ""));
        formData.append("lng", String(poiFields.lng || ""));
        formData.append("submitteddate", poiFields.submitteddate || "");
        formData.append("candidateimageurl", poiFields.candidateimageurl || "");
        formData.append("nickname", poiFields.nickname || "");

        fetch(url, {
            method: "POST",
            body: formData
        })
            .then(res => res.text())
            .then(text => {
            let data;
            try {
                data = JSON.parse(text);
            } catch (e) {
                console.warn("[Planner] Failed to parse response JSON from POST", e);
                window.alert("Wayfarer Planner: server responded with invalid JSON.");
                return;
            }

            // Normalise lat/lng coming back from Apps Script (often strings)
            if (!data || !data.id) {
                console.warn("[Planner] Response from script did not contain an id", data);
                return;
            }

            const normLat = typeof data.lat === "number" ? data.lat : parseFloat(data.lat);
            const normLng = typeof data.lng === "number" ? data.lng : parseFloat(data.lng);

            if (Number.isNaN(normLat) || Number.isNaN(normLng)) {
                console.warn("[Planner] Response has invalid lat/lng after parse", data.lat, data.lng);
            } else {
                data.lat = normLat;
                data.lng = normLng;
            }

            // Update local collection (replace or insert).
            let updated = false;
            for (let i = 0; i < plannerPois.length; i++) {
                if (plannerPois[i].id === data.id) {
                    plannerPois[i] = data;
                    updated = true;
                    break;
                }
            }
            if (!updated) {
                plannerPois.push(data);
            }

            // Ensure status config exists for this status.
            ensureStatusConfigFor(String(data.status || "potential"));

            refreshPlannerMarkers();

            if (typeof onSuccess === "function") {
                onSuccess(data);
            }
        })
            .catch(err => {
            console.warn("[Planner] Error sending POI to script:", err);
            window.alert("Wayfarer Planner: failed to send data to the script URL.");
        });
    }

    function sendPlannerDelete(id, onSuccess) {
        const url = getScriptURL();
        if (!url) {
            window.alert("Wayfarer Planner: script URL is not configured.");
            return;
        }

        const formData = new FormData();
        formData.append("status", "delete");
        formData.append("id", id);

        fetch(url, {
            method: "POST",
            body: formData
        })
            .then(res => res.text())
            .then(() => {
            // Remove from local collection.
            plannerPois = plannerPois.filter(poi => poi && poi.id !== id);
            refreshPlannerMarkers();

            if (typeof onSuccess === "function") {
                onSuccess();
            }
        })
            .catch(err => {
            console.warn("[Planner] Error sending delete:", err);
            window.alert("Wayfarer Planner: failed to send delete to the script URL.");
        });
    }

    // -----------------------------
    // Map lifecycle
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
            attachPlannerToMapIfNeeded();
            insertPlannerSettingsLink();
            insertPlannerLayersToggle();
        } else if (!panelPresent && lastPanelPresent) {
            teardownPlannerForMap();
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
                            // ignore invalid entries
                        }
                    }
                });

                if (foundMap) {
                    resolve(foundMap);
                    return;
                }

                if (attempts-- <= 0) {
                    console.warn("[Planner] Failed to find submit map after several attempts");
                    resolve(null);
                    return;
                }

                setTimeout(tryFindMap, 250);
            }

            tryFindMap();
        });
    }

    function teardownPlannerForMap() {
        if (!mapAttached) return;
        clearPlannerMarkers();
        submitMap = null;
        mapAttached = false;
    }

    function clearPlannerMarkers() {
        if (!plannerMarkers) return;
        Object.values(plannerMarkers).forEach(m => {
            if (!m) return;
            if (typeof m.setMap === "function") {
                m.setMap(null);
            }
            if (m._plannerLabelOverlay) {
                m._plannerLabelOverlay.setMap(null);
            }
        });
        plannerMarkers = {};
    }


    async function attachPlannerToMapIfNeeded() {
        if (mapAttached) {
            refreshPlannerMarkers();
            return;
        }

        const map = await getSubmitMap();
        if (!map) {
            console.warn("[Planner] Map not found – cannot attach");
            return;
        }

        submitMap = map;
        mapAttached = true;

        // Close the planner info window when clicking the map
        submitMap.addListener("click", () => {
            if (plannerInfoWindow) {
                // If we were editing a marker and didn't save, revert its position
                if (activeEditContext && !activeEditContext.committed) {
                    const { marker, originalLat, originalLng } = activeEditContext;
                    if (
                        marker &&
                        typeof marker.setPosition === "function" &&
                        originalLat != null &&
                        originalLng != null &&
                        !Number.isNaN(originalLat) &&
                        !Number.isNaN(originalLng)
                    ) {
                        marker.setPosition({ lat: originalLat, lng: originalLng });
                    }
                }

                activeEditContext = null;
                plannerInfoWindow.close();
            }
        });

        if (!submitMap._plannerOverlayBoundsListenerAdded) {
            submitMap.addListener("idle", refreshPlannerMarkers);
            submitMap._plannerOverlayBoundsListenerAdded = true;
        }

        // Optional: you could add a click listener for "add new POI" mode later.

        refreshPlannerMarkers();
    }

    // -----------------------------
    // Layers options
    // -----------------------------
    function insertPlannerLayersToggle() {
        const menuCheck = setInterval(() => {
            const menu = document.querySelector(".wfmapmods-layers-menu");
            if (!menu) return; // wait until layers plugin has created the menu

            clearInterval(menuCheck);

            // Avoid duplicates
            if (menu.querySelector("#wfmapmods-layer-planner")) return;

            const plannerCfg = userSettings.planner || (userSettings.planner = {});
            if (typeof plannerCfg.layerEnabled !== "boolean") {
                plannerCfg.layerEnabled = true;
            }

            const label = document.createElement("label");
            label.className = "wfmapmods-layers-option";
            label.id = "wfmapmods-layer-planner";

            const checkbox = document.createElement("input");
            checkbox.type = "checkbox";
            checkbox.checked = plannerCfg.layerEnabled !== false;

            const text = document.createElement("span");
            text.textContent = "Planner";

            label.appendChild(checkbox);
            label.appendChild(text);
            menu.appendChild(label);

            checkbox.addEventListener("change", () => {
                const enabled = checkbox.checked;
                const plannerCfg = userSettings.planner || (userSettings.planner = {});
                plannerCfg.layerEnabled = enabled;
                saveSettings();

                if (!enabled) {
                    // Master off: hide everything & clear selection
                    clearPlannerMarkers();
                } else {
                    // Master on: re-draw markers based on current bounds & status settings
                    refreshPlannerMarkers();
                }
            });
        }, 300);
    }

    // -----------------------------
    // Send Planner POIs to web submission via bridge
    // -----------------------------

    function sendPlannerSubmitToBridge(poi) {
        if (!poi) return;

        const bridge = document.getElementById(SUBMISSION_BRIDGE_ID);
        if (!bridge) {
            console.warn("[Planner] Submission bridge not found");
            return;
        }

        const lat = (typeof poi.lat === "number") ? poi.lat : parseFloat(poi.lat);
        const lng = (typeof poi.lng === "number") ? poi.lng : parseFloat(poi.lng);

        const payload = {
            source: POI_BRIDGE_SOURCE,
            poi: {
                id: null,
                title: poi.title || "",
                description: poi.description || "",
                supportingStatement: poi.statement || "",
                lat: Number.isFinite(lat) ? lat : null,
                lng: Number.isFinite(lng) ? lng : null
            },
            images: {
                mainUrl: poi.candidateimageurl || poi.imageUrl || "",
                supportingUrls: []
            }
        };

        try {
            bridge.setAttribute("data-submission", JSON.stringify(payload));
        } catch (e) {
            console.warn("[Planner] Failed to serialise payload for submission bridge", e, payload);
        }
    }

    // -----------------------------
    // Marker creation & visibility
    // -----------------------------

    function getPlannerMarkerConfigForStatus(statusRaw) {
        const statusKey = String(statusRaw || "potential");
        return ensureStatusConfigFor(statusKey);
    }

    // Simple pin-style symbol using an SVG-like path.
    function getPlannerPinSymbol(color) {
        const svg = getGenericMarkerSvg(color || "#a855f7", 'class="wfmapmods-planner-marker"');
        const url = "data:image/svg+xml;charset=UTF-8," + encodeURIComponent(svg);

        // 25 x 41 viewbox; anchor at the bottom center
        return {
            url,
            scaledSize: new google.maps.Size(25, 41),
            anchor: new google.maps.Point(12.5, 41)
        };
    }

    function getGenericMarkerSvg(color, markerClassName) {
        const markerTemplate = `<?xml version="1.0" encoding="UTF-8"?>
        <svg xmlns="http://www.w3.org/2000/svg" baseProfile="full" viewBox="0 0 25 41" width="25" height="41" ${markerClassName || ""}>
            <path d="M19.4,3.1c-3.3-3.3-6.1-3.3-6.9-3.1c-0.6,0-3.7,0-6.9,3.1c-4,4-1.3,9.4-1.3,9.4s5.6,14.6,6.3,16.3c0.6,1.2,1.3,1.5,1.7,1.5c0,0,0,0,0.2,0h0.2c0.4,0,1.2-0.4,1.7-1.5c0.8-1.7,6.3-16.3,6.3-16.3S23.5,7.2,19.4,3.1z M13.1,12.4c-2.3,0.4-4.4-1.5-4-4c0.2-1.3,1.3-2.5,2.9-2.9c2.3-0.4,4.4,1.5,4,4C15.6,11,14.4,12.2,13.1,12.4z" fill="%COLOR%" stroke="#fff"/>
            <path d="M12.5,34.1c1.9,0,3.5,1.5,3.5,3.5c0,1.9-1.5,3.5-3.5,3.5S9,39.5,9,37.5c0-1.2,0.6-2.2,1.5-2.9 C11.1,34.3,11.8,34.1,12.5,34.1z" fill="%COLOR%" stroke="#fff"/>
        </svg>`;

        return markerTemplate.replace(/%COLOR%/g, color);
    }

    // -----------------------------
    // Marker title labels (shown under the pin)
    // -----------------------------

    let PlannerLabelOverlay = null;

    function ensurePlannerLabelOverlayClass() {
        if (PlannerLabelOverlay) return;

        PlannerLabelOverlay = function (marker, text) {
            this.marker = marker;
            this.text = text || "";
            this.div = null;
            this.setMap(submitMap);
        };

        PlannerLabelOverlay.prototype = new google.maps.OverlayView();

        PlannerLabelOverlay.prototype.onAdd = function () {
            const pane = this.getPanes().overlayImage;
            const div = document.createElement("div");
            div.style.position = "absolute";
            div.style.whiteSpace = "nowrap";
            div.style.fontSize = "14px";
            div.style.fontWeight = "bold";
            div.style.color = "rgba(255, 241, 0, 0.9)";
            div.style.textShadow = [
                "0 0 2px #000000",
                "0 0 4px #000000",
                "-1px -1px 2px #000000",
                "1px 1px 2px #000000"
            ].join(", ");
            div.style.pointerEvents = "none";
            div.textContent = this.text || "";
            pane.appendChild(div);
            this.div = div;
        };

        PlannerLabelOverlay.prototype.draw = function () {
            if (!this.div) return;
            const projection = this.getProjection();
            if (!projection || !this.marker) return;
            const pos = projection.fromLatLngToDivPixel(this.marker.getPosition());
            if (!pos) return;

            const div = this.div;
            // Center horizontally, place slightly under the pin tip
            const x = pos.x - div.offsetWidth / 2;
            const y = pos.y + 4; // tweak if you want a bit lower

            div.style.left = x + "px";
            div.style.top = y + "px";
        };

        PlannerLabelOverlay.prototype.onRemove = function () {
            if (this.div && this.div.parentNode) {
                this.div.parentNode.removeChild(this.div);
            }
            this.div = null;
        };

        PlannerLabelOverlay.prototype.setText = function (text) {
            this.text = text || "";
            if (this.div) {
                this.div.textContent = this.text;
            }
        };
    }

    function updatePlannerMarkerLabel(marker, titleText) {
        const plannerCfg = userSettings.planner || {};
        const showTitles = !!plannerCfg.showTitles;

        // If we’re not showing titles, just hide any overlay
        if (!showTitles) {
            if (marker._plannerLabelOverlay) {
                marker._plannerLabelOverlay.setMap(null);
            }
            return;
        }

        ensurePlannerLabelOverlayClass();

        if (marker._plannerLabelOverlay) {
            marker._plannerLabelOverlay.setText(titleText || "");
            marker._plannerLabelOverlay.setMap(submitMap);
        } else {
            marker._plannerLabelOverlay = new PlannerLabelOverlay(marker, titleText || "");
        }
    }

    function revertActiveEditIfNeeded() {
        if (!activeEditContext || activeEditContext.committed) return;

        const { marker, originalLat, originalLng, isNew } = activeEditContext;
        if (!marker || typeof marker.setMap !== "function") {
            activeEditContext = null;
            return;
        }

        if (isNew) {
            // Unsaved new marker: remove it entirely
            marker.setMap(null);
        } else if (
            originalLat != null &&
            originalLng != null &&
            !Number.isNaN(originalLat) &&
            !Number.isNaN(originalLng)
        ) {
            // Existing marker: snap back to original coords
            marker.setPosition({ lat: originalLat, lng: originalLng });
        }

        activeEditContext = null;
    }

    function createPlannerAddControl(map) {
        if (!google || !google.maps || !map) return;
        if (map._plannerAddControlAdded) return; // avoid duplicates
        map._plannerAddControlAdded = true;

        const controlDiv = document.createElement("div");
        const controlUI = document.createElement("div");

        Object.assign(controlUI.style, {
            backgroundColor: "#ffffff",
            border: "2px solid #ffffff",
            borderRadius: "3px",
            boxShadow: "0 1px 4px rgba(0,0,0,0.3)",
            cursor: "pointer",
            marginTop: "10px",
            marginLeft: "10px",
            textAlign: "center",
            width: "32px",
            height: "32px",
            lineHeight: "30px",
            fontSize: "16px",
            fontWeight: "bold",
            color: "#000",
            userSelect: "none"
        });

        controlUI.textContent = "P+";
        controlDiv.appendChild(controlUI);

        controlUI.addEventListener("click", () => {
            addModeEnabled = !addModeEnabled;

            if (addModeEnabled) {
                controlUI.style.backgroundColor = "#ffce04";
                controlUI.style.borderColor = "#ffce04";
                // optional: darker text for contrast
                controlUI.style.color = "#000000";
            } else {
                controlUI.style.backgroundColor = "#ffffff";
                controlUI.style.borderColor = "#ffffff";
                controlUI.style.color = "#000000"; // or whatever you prefer
            }

            // Turning OFF add mode: cancel any unsaved edit & close window
            if (!addModeEnabled) {
                revertActiveEditIfNeeded();
                if (plannerInfoWindow) {
                    plannerInfoWindow.close();
                }
            }
        });

        // Place with other default controls (left top)
        map.controls[google.maps.ControlPosition.LEFT_TOP].push(controlDiv);
    }

    async function attachPlannerToMapIfNeeded() {
        if (mapAttached) {
            refreshPlannerMarkers();
            return;
        }

        const map = await getSubmitMap();
        if (!map) {
            console.warn("[Planner] Map not found – cannot attach");
            return;
        }

        submitMap = map;
        mapAttached = true;

        if (!submitMap._plannerOverlayBoundsListenerAdded) {
            submitMap.addListener("idle", refreshPlannerMarkers);
            submitMap._plannerOverlayBoundsListenerAdded = true;
        }

        // Add the P+ button
        createPlannerAddControl(submitMap);

        // One map-click handler for both normal clicks and add mode
        if (!submitMap._plannerMapClickHandlerAdded) {
            submitMap.addListener("click", (ev) => {
                const latLng = ev && ev.latLng ? ev.latLng : null;

                if (addModeEnabled && latLng) {
                    // In add mode: clicking the map starts a new pin
                    handleAddModeClick(latLng);
                    return;
                }

                // Not in add mode: clicking the map just closes the window
                if (plannerInfoWindow) {
                    revertActiveEditIfNeeded();
                    plannerInfoWindow.close();
                }
            });

            submitMap._plannerMapClickHandlerAdded = true;
        }

        refreshPlannerMarkers();
    }

    function handleAddModeClick(latLng) {
        if (!submitMap || !latLng) return;

        // Drop any current unsaved edit (existing or new)
        revertActiveEditIfNeeded();
        if (plannerInfoWindow) {
            plannerInfoWindow.close();
        }

        const lat = latLng.lat();
        const lng = latLng.lng();

        // New POI skeleton (no id yet)
        const poi = {
            id: "",
            status: "potential",
            title: "",
            description: "",
            lat,
            lng,
            submitteddate: "",
            candidateimageurl: "",
            nickname: ""
        };

        const cfg = getPlannerMarkerConfigForStatus(poi.status);
        const icon = getPlannerPinSymbol(cfg.color || "#a855f7");

        // Temporary marker (NOT in plannerMarkers / plannerPois yet)
        const marker = new google.maps.Marker({
            map: submitMap,
            position: { lat, lng },
            title: "",
            icon,
            draggable: !!(userSettings.planner && userSettings.planner.enableDragging),
            optimized: false,
        });

        // Clicking it again just re-opens the editor
        marker.addListener("click", () => {
            openPlannerInfoWindow(marker, poi, { isNew: true });
        });

        // Immediately open editor for this new marker
        openPlannerInfoWindow(marker, poi, { isNew: true });
    }


    function refreshPlannerMarkers() {
        if (!submitMap || !Array.isArray(plannerPois)) {
            return;
        }

        const plannerCfg = userSettings.planner || {};
        if (plannerCfg.layerEnabled === false) {
            clearPlannerMarkers();
            return;
        }

        const bounds = submitMap.getBounds();
        if (!bounds) {
            return;
        }

        const performanceModeEnabled = !!plannerCfg.performanceModeEnabled;
        const maxVisibleMarkers =
              typeof plannerCfg.performanceMaxVisibleMarkers === "number"
        ? plannerCfg.performanceMaxVisibleMarkers
        : PERFORMANCE_MAX_VISIBLE_MARKERS;

        // First: find all POIs that should be shown in current bounds.
        const candidateIds = [];
        const candidateById = {};

        plannerPois.forEach(poi => {
            if (!poi) return;

            let lat = poi.lat;
            let lng = poi.lng;

            // Normalise stored lat/lng (in case they came back as strings)
            if (typeof lat === "string") lat = parseFloat(lat);
            if (typeof lng === "string") lng = parseFloat(lng);
            if (Number.isNaN(lat) || Number.isNaN(lng)) return;

            const statusCfg = getPlannerMarkerConfigForStatus(poi.status);
            if (statusCfg.enabled === false) return;

            const id = poi.id || `${lat},${lng}`;

            // If a marker already exists, use its current position (after drag)
            let pos = null;
            const existingMarker = plannerMarkers[id];

            if (existingMarker && typeof existingMarker.getPosition === "function") {
                const mPos = existingMarker.getPosition();
                if (mPos && typeof mPos.lat === "function" && typeof mPos.lng === "function") {
                    pos = mPos;
                }
            }

            // Fallback: use POI’s stored coords
            if (!pos) {
                pos = new google.maps.LatLng(lat, lng);
            }

            if (!bounds.contains(pos)) {
                // Out of view – do not include in candidate list
                return;
            }

            if (!candidateById[id]) {
                candidateIds.push(id);
                candidateById[id] = poi;
            }
        });

        let finalCandidateIds = candidateIds;
        if (performanceModeEnabled && candidateIds.length > maxVisibleMarkers) {
            // Simple fallback: if too many planners, hide all (to avoid lag).
            clearPlannerMarkers();
            return;
        }

        const inBoundsIds = new Set(finalCandidateIds);

        finalCandidateIds.forEach(id => {
            const poi = candidateById[id];
            if (!poi) return;

            const cfg = getPlannerMarkerConfigForStatus(poi.status);
            const color = cfg.color || "#a855f7";

            const baseIcon = getPlannerPinSymbol(color);

            let marker = plannerMarkers[id];

            const titleStatus = String(poi.status || "").toUpperCase() || "UNKNOWN";
            const titleText = `${poi.title || "(untitled)"} (${titleStatus})`;

            if (!marker) {
                marker = new google.maps.Marker({
                    map: null,
                    position: { lat: poi.lat, lng: poi.lng },
                    title: titleText,
                    icon: baseIcon,
                    draggable: !!(userSettings.planner && userSettings.planner.enableDragging),
                    optimized: false,
                });

                marker.addListener("click", () => {
                    openPlannerInfoWindow(marker, poi);
                });

                if (marker.getDraggable()) {
                    marker.addListener("dragend", (ev) => {
                        const newPos = ev.latLng;
                        if (!newPos) return;

                        // Marker is already visually moved by Maps; this is just explicit
                        marker.setPosition(newPos);

                        // Do NOT change poi.lat/lng yet.
                        // Do NOT send to Apps Script yet.
                        // Just open the editor so the user can decide to Save or close.
                        openPlannerInfoWindow(marker, poi);
                    });
                }

                plannerMarkers[id] = marker;
            } else {
                // Update icon & title if needed.
                marker.setIcon(baseIcon);
                if (typeof marker.setTitle === "function") {
                    marker.setTitle(titleText);
                }
            }

            if (!marker.getMap()) {
                marker.setMap(submitMap);
            }

            // Show / hide on-map title label under the pin
            updatePlannerMarkerLabel(marker, poi.title || "");
        });

        // Hide markers that are no longer in bounds.
        Object.entries(plannerMarkers).forEach(([id, marker]) => {
            if (!marker) return;
            if (!inBoundsIds.has(id) && marker.getMap()) {
                marker.setMap(null);
                if (marker._plannerLabelOverlay) {
                    marker._plannerLabelOverlay.setMap(null);
                }
            }
        });
    }


    // -----------------------------
    // Planner info window
    // -----------------------------
    function openPlannerInfoWindow(marker, poi, options) {
        options = options || {};
        const isNew = !!options.isNew;

        if (!submitMap || !marker || !poi) return;

        // If there is an active edit on a different marker and it wasn't saved, revert it
        if (activeEditContext && activeEditContext.marker !== marker && !activeEditContext.committed) {
            revertActiveEditIfNeeded();
        }

        if (!plannerInfoWindow) {
            plannerInfoWindow = new google.maps.InfoWindow();

            // Revert when the user closes via the "X" (or ESC / default close)
            plannerInfoWindow.addListener("closeclick", () => {
                revertActiveEditIfNeeded();
            });
        }

        // Marker position (after drag), fallback to POI coords
        const pos = marker.getPosition && marker.getPosition();
        let currentLat = poi.lat;
        let currentLng = poi.lng;

        if (pos && typeof pos.lat === "function" && typeof pos.lng === "function") {
            currentLat = pos.lat();
            currentLng = pos.lng();
        }

        if (typeof currentLat === "string") currentLat = parseFloat(currentLat);
        if (typeof currentLng === "string") currentLng = parseFloat(currentLng);

        // Record original position for possible revert
        let originalLat = poi.lat;
        let originalLng = poi.lng;
        if (typeof originalLat === "string") originalLat = parseFloat(originalLat);
        if (typeof originalLng === "string") originalLng = parseFloat(originalLng);

        activeEditContext = {
            marker,
            poi,
            originalLat,
            originalLng,
            committed: false,
            isNew
        };

        const container = document.createElement("div");
        container.className = "wfmapmods-planner-popup";
        container.style.maxWidth = "260px";
        container.style.fontSize = "12px";

        function labelEl(text) {
            const el = document.createElement("div");
            el.textContent = text;
            el.style.fontSize = "11px";
            el.style.fontWeight = "bold";
            el.style.marginTop = "4px";
            return el;
        }

        function inputText(initial = "") {
            const el = document.createElement("input");
            el.type = "text";
            el.value = initial;
            el.style.width = "100%";
            el.style.boxSizing = "border-box";
            el.style.fontSize = "12px";
            el.style.padding = "2px 4px";
            el.style.marginTop = "2px";
            el.style.border = "1px solid #d1d5db";
            el.style.borderRadius = "3px";
            return el;
        }

        function textarea(initial = "") {
            const el = document.createElement("textarea");
            el.value = initial;
            el.rows = 3;
            el.style.width = "100%";
            el.style.boxSizing = "border-box";
            el.style.fontSize = "12px";
            el.style.padding = "2px 4px";
            el.style.marginTop = "2px";
            el.style.border = "1px solid #d1d5db";
            el.style.borderRadius = "3px";
            return el;
        }

        // -------------------------
        // Status
        // -------------------------
        const statusesCfg = userSettings.markers.statuses || {};
        const keysSet = new Set([
            ...Object.keys(DEFAULT_STATUS_CONFIG),
            ...Object.keys(statusesCfg),
            ...plannerPois.map(p => p && p.status).filter(Boolean).map(s => String(s))
        ]);
        const allStatusKeys = Array.from(keysSet).sort();

        container.appendChild(labelEl("Status"));
        const statusSelect = document.createElement("select");
        statusSelect.style.width = "100%";
        statusSelect.style.boxSizing = "border-box";
        statusSelect.style.fontSize = "12px";
        statusSelect.style.padding = "2px 4px";
        statusSelect.style.marginTop = "2px";
        statusSelect.style.border = "1px solid #d1d5db";
        statusSelect.style.borderRadius = "3px";

        const currentStatus = poi.status || "potential";

        allStatusKeys.forEach(key => {
            const opt = document.createElement("option");
            opt.value = key;
            opt.textContent = getStatusLabel(key);
            if (key === currentStatus) opt.selected = true;
            statusSelect.appendChild(opt);
        });
        container.appendChild(statusSelect);

        // -------------------------
        // Core fields: Title & Description
        // -------------------------
        container.appendChild(labelEl("Title"));
        const titleInput = inputText(poi.title || "");
        titleInput.placeholder = "Title (required)";
        container.appendChild(titleInput);

        container.appendChild(labelEl("Description"));
        const descInput = inputText(poi.description || "");
        descInput.placeholder = "Description";
        container.appendChild(descInput);

        // -------------------------
        // Image preview (if present)
        // -------------------------
        const rawImgUrl = poi.candidateimageurl || poi.imageUrl || "";
        let previewContainer = null;
        let previewImg = null;

        if (userSettings.planner && userSettings.planner.enableImagePreview) {
            previewContainer = document.createElement("a");
            previewContainer.target = "_blank";
            previewContainer.className = "wfmapmods-imagePreviewContainer";

            previewImg = document.createElement("img");
            previewImg.className = "wfmapmods-imagePreview";
            previewImg.style.maxWidth = "100%";
            previewImg.style.maxHeight = "150px";
            previewImg.style.display = "none";
            previewImg.style.marginTop = "4px";

            previewContainer.appendChild(previewImg);
            container.appendChild(previewContainer);

            function updatePreview(url) {
                const trimmed = (url || "").trim();
                if (!trimmed) {
                    previewImg.style.display = "none";
                    previewImg.removeAttribute("src");
                    previewContainer.removeAttribute("href");
                    return;
                }

                let thumb = trimmed;
                if (thumb.includes("googleusercontent")) {
                    thumb = thumb.replace(/(=.*)?$/, "=s200");
                }
                let full = trimmed;
                if (full.includes("googleusercontent")) {
                    full = full.replace(/(=.*)?$/, "=s0");
                }

                previewImg.src = thumb;
                previewImg.style.display = "block";
                previewContainer.href = full;
            }

            if (rawImgUrl) {
                updatePreview(rawImgUrl);
            }

            // We'll call updatePreview again from imgInput below
            container._updatePreview = updatePreview;
        }

        // -------------------------
        // Expander & extra fields
        // -------------------------
        const expander = document.createElement("div");
        expander.textContent = "»";
        expander.title = "Click to expand additional fields";
        expander.style.cursor = "pointer";
        expander.style.display = "inline-block";
        expander.style.marginTop = "4px";
        expander.style.fontSize = "14px";
        expander.style.transform = "rotate(90deg)"; // downwards (collapsed)
        container.appendChild(expander);

        const extraData = document.createElement("div");
        extraData.className = "wfmapmods-extraData";
        extraData.style.display = "none";
        extraData.style.marginTop = "4px";
        extraData.style.borderTop = "1px solid #e5e7eb";
        extraData.style.paddingTop = "4px";
        container.appendChild(extraData);

        let expanded = false;
        expander.addEventListener("click", () => {
            expanded = !expanded;
            extraData.style.display = expanded ? "block" : "none";
            // mimic Leaflet chevron: rotate down when closed, up when open
            expander.style.transform = expanded ? "rotate(-90deg)" : "rotate(90deg)";
            expander.title = expanded ? "Hide additional fields" : "Click to expand additional fields";
        });

        // Latitude (editable)
        extraData.appendChild(labelEl("Latitude"));
        const latInput = inputText(
            typeof currentLat === "number" && !Number.isNaN(currentLat)
            ? currentLat.toFixed(6)
            : (poi.lat || "")
        );
        latInput.name = "lat";
        extraData.appendChild(latInput);

        // Longitude (editable)
        extraData.appendChild(labelEl("Longitude"));
        const lngInput = inputText(
            typeof currentLng === "number" && !Number.isNaN(currentLng)
            ? currentLng.toFixed(6)
            : (poi.lng || "")
        );
        lngInput.name = "lng";
        extraData.appendChild(lngInput);


        // Submitter (from nickname/submitter, read-only)
        extraData.appendChild(labelEl("Submitter"));
        const submitterInput = inputText(poi.nickname || poi.submitter || "");
        submitterInput.disabled = true;
        extraData.appendChild(submitterInput);

        // Submitted date
        extraData.appendChild(labelEl("Submitted date"));
        const dateInput = inputText(poi.submitteddate || "");
        dateInput.placeholder = "dd-mm-yyyy";
        extraData.appendChild(dateInput);

        // Image URL (editable)
        extraData.appendChild(labelEl("Image URL"));
        const imgInput = inputText(rawImgUrl);
        imgInput.placeholder = "https://?.googleusercontent.com/***";
        extraData.appendChild(imgInput);

        if (userSettings.planner && userSettings.planner.enableImagePreview && container._updatePreview) {
            imgInput.addEventListener("input", () => {
                container._updatePreview(imgInput.value);
            });
        }

        // -------------------------
        // Helper: collect & validate fields
        // -------------------------
        function collectFieldsFromForm() {
            const titleValue = titleInput.value.trim();
            if (!titleValue) {
                window.alert("Title is required.");
                return null;
            }

            const latVal = parseFloat(latInput.value);
            const lngVal = parseFloat(lngInput.value);

            if (Number.isNaN(latVal) || Number.isNaN(lngVal)) {
                window.alert("Latitude and longitude must be valid numbers.");
                return null;
            }
            if (latVal < -90 || latVal > 90 || lngVal < -180 || lngVal > 180) {
                window.alert("Latitude must be between -90 and 90, and longitude between -180 and 180.");
                return null;
            }

            return {
                id: poi.id || "",
                status: statusSelect.value,
                title: titleValue,
                description: descInput.value.trim(),
                lat: latVal,
                lng: lngVal,
                submitteddate: dateInput.value.trim(),
                candidateimageurl: imgInput.value.trim(),
                nickname: poi.nickname || ""
            };
        }

        // ------------------------------------
        // Bottom Text Actions: Delete | Submit | Save
        // ------------------------------------
        const actions = document.createElement("div");
        actions.style.display = "flex";
        actions.style.justifyContent = "space-between";
        actions.style.alignItems = "center";
        actions.style.marginTop = "6px";
        actions.style.fontSize = "12px";

        // helper: creates a text-style link
        function makeLink(text) {
            const link = document.createElement("span");
            link.textContent = text;
            link.style.cursor = "pointer";
            link.style.color = "#2563eb"; // Tailwind-style blue-600
            link.style.textDecoration = "underline";
            return link;
        }

        // LEFT: DELETE
        const leftBox = document.createElement("div");
        if (poi.id) {
            const del = makeLink("Delete");
            del.style.color = "#dc2626"; // subtle red for destructive action
            del.addEventListener("click", (ev) => {
                ev.preventDefault();
                openPlannerDeleteConfirm(poi.id);
            });
            leftBox.appendChild(del);
        }
        actions.appendChild(leftBox);

        // CENTER: SUBMIT
        const centerBox = document.createElement("div");
        centerBox.style.flex = "1";
        centerBox.style.display = "flex";
        centerBox.style.justifyContent = "center";

        const submit = makeLink("Submit");
        submit.addEventListener("click", (ev) => {
            ev.preventDefault();
            const fields = collectFieldsFromForm();
            if (!fields) return;
            sendPlannerSubmitToBridge(fields);
            plannerInfoWindow.close();
        });
        centerBox.appendChild(submit);

        actions.appendChild(centerBox);

        // RIGHT: SAVE
        const rightBox = document.createElement("div");
        const save = makeLink("Save");
        save.addEventListener("click", (ev) => {
            ev.preventDefault();
            const fields = collectFieldsFromForm();
            if (!fields) return;

            const wasNew = !poi.id; // no id yet => new pin

            Object.assign(poi, fields);
            marker.setPosition({ lat: fields.lat, lng: fields.lng });

            // Mark this edit as committed so close doesn't revert/cleanup
            if (activeEditContext && activeEditContext.marker === marker) {
                activeEditContext.committed = true;
            }

            // Close immediately for responsiveness
            if (plannerInfoWindow) {
                plannerInfoWindow.close();
            }

            // Persist to Apps Script (async)
            sendPlannerPoiToScript(fields, () => {
                // For new pins, remove the temporary marker;
                // refreshPlannerMarkers will create the real one from plannerPois
                if (wasNew && typeof marker.setMap === "function") {
                    marker.setMap(null);
                }
            });
        });

        rightBox.appendChild(save);

        actions.appendChild(rightBox);

        container.appendChild(actions);

        plannerInfoWindow.setContent(container);

        // --- Close (X) button ---
        const closeX = document.createElement("div");
        closeX.textContent = "×";
        closeX.style.position = "absolute";
        closeX.style.top = "4px";
        closeX.style.right = "6px";
        closeX.style.cursor = "pointer";
        closeX.style.fontSize = "18px";
        closeX.style.fontWeight = "bold";
        closeX.style.lineHeight = "12px";
        closeX.style.color = "#555";

        closeX.addEventListener("click", () => {
            revertActiveEditIfNeeded();
            if (plannerInfoWindow) {
                plannerInfoWindow.close();
            }
        });
        container.appendChild(closeX);

        // important: container needs to be positioned for absolute child
        container.style.position = "relative";
        container.style.paddingTop = "4px";

        plannerInfoWindow.open(submitMap, marker);
    }

    // -----------------------------
    // Planner editing UI
    // -----------------------------

    function openPlannerDeleteConfirm(id) {
        const confirmed = window.confirm("Do you want to remove this planner candidate?");
        if (!confirmed) return;
        sendPlannerDelete(id, () => {
            if (plannerMarkers[id]) {
                const m = plannerMarkers[id];
                if (m && typeof m.setMap === "function") {
                    m.setMap(null);
                }
                delete plannerMarkers[id];
            }
        });
    }

    // -----------------------------
    // Settings UI
    // -----------------------------

    function insertPlannerSettingsLink() {
        const panelCheck = setInterval(() => {
            const settingsBody = document.querySelector(".wfmapmods-settings-links");
            if (!settingsBody) return;

            clearInterval(panelCheck);

            if (document.getElementById("wfmapmods-settings-planner")) return;

            const link = document.createElement("a");
            link.id = "wfmapmods-settings-planner";
            link.textContent = "Planner";
            link.style.cursor = "pointer";

            settingsBody.appendChild(link);

            link.addEventListener("click", () => {
                openPlannerSettingsModal();
            });
        }, 300);
    }

    function openPlannerSettingsModal() {
        openSettingsModal({
            id: "wf-planner-settings",
            title: "Planner settings",
            buildContent(body, okBtn) {
                const section = document.createElement("div");
                section.className = "wfmapmods-modal-section";
                section.style.display = "flex";
                section.style.flexDirection = "column";
                section.style.gap = "8px";

                function label(text) {
                    const el = document.createElement("label");
                    el.textContent = text;
                    el.style.fontSize = "11px";
                    el.style.fontWeight = "bold";
                    return el;
                }

                function checkboxRow(text, checked) {
                    const row = document.createElement("label");
                    row.style.display = "flex";
                    row.style.alignItems = "center";
                    row.style.gap = "6px";
                    row.style.fontSize = "11px";

                    const cb = document.createElement("input");
                    cb.type = "checkbox";
                    cb.checked = !!checked;

                    const span = document.createElement("span");
                    span.textContent = text;

                    row.appendChild(cb);
                    row.appendChild(span);
                    return { row, cb };
                }

                const urlLabel = label("Script URL");
                const urlInput = document.createElement("input");
                urlInput.type = "url";
                urlInput.placeholder = "https://script.google.com/macros/***/exec";
                urlInput.value = getScriptURL();
                Object.assign(urlInput.style, {
                    width: "100%",
                    boxSizing: "border-box",
                    fontSize: "12px",
                    padding: "4px 6px",
                    border: "1px solid #d1d5db",
                    borderRadius: "4px",
                    backgroundColor: "#ffffff"
                });

                const urlHint = document.createElement("div");
                urlHint.style.fontSize = "10px";
                urlHint.style.color = "#6b7280";
                urlHint.textContent =
                    "Paste the Apps Script web app URL (short 'exec' URL).";

                const refreshBtn = document.createElement("button");
                refreshBtn.type = "button";
                refreshBtn.textContent = "Update planner data";
                Object.assign(refreshBtn.style, {
                    padding: "4px 8px",
                    fontSize: "11px",
                    cursor: "pointer",
                    alignSelf: "flex-start"
                });

                const showTitlesRow = checkboxRow(
                    "Show titles",
                    userSettings.planner.showTitles
                );
                const enableDraggingRow = checkboxRow(
                    "Enable dragging planner markers",
                    userSettings.planner.enableDragging
                );
                const enablePreviewRow = checkboxRow(
                    "Enable image preview",
                    userSettings.planner.enableImagePreview
                );

                const perfRow = checkboxRow(
                    "Performance mode (hide overlays when too many markers)",
                    userSettings.planner.performanceModeEnabled
                );

                const customMarkersLink = document.createElement("a");
                customMarkersLink.href = "#";
                customMarkersLink.textContent = "Customise pin colours per status";
                customMarkersLink.style.fontSize = "11px";
                customMarkersLink.style.textDecoration = "underline";
                customMarkersLink.style.alignSelf = "flex-start";

                customMarkersLink.addEventListener("click", (ev) => {
                    ev.preventDefault();
                    openPlannerMarkerStylesModal();
                });

                refreshBtn.addEventListener("click", () => {
                    userSettings.planner.scriptURL = urlInput.value.trim();
                    saveSettings();
                    fetchPlannerData();
                });

                section.appendChild(urlLabel);
                section.appendChild(urlInput);
                section.appendChild(urlHint);
                section.appendChild(refreshBtn);
                section.appendChild(showTitlesRow.row);
                section.appendChild(enableDraggingRow.row);
                section.appendChild(enablePreviewRow.row);
                section.appendChild(perfRow.row);
                section.appendChild(customMarkersLink);

                body.appendChild(section);

                // We want to react to checkboxes immediately.
                showTitlesRow.cb.addEventListener("change", () => {
                    userSettings.planner.showTitles = showTitlesRow.cb.checked;
                    saveSettings();
                    refreshPlannerMarkers();
                });

                enableDraggingRow.cb.addEventListener("change", () => {
                    userSettings.planner.enableDragging = enableDraggingRow.cb.checked;
                    saveSettings();
                    clearPlannerMarkers();
                    refreshPlannerMarkers();
                });

                enablePreviewRow.cb.addEventListener("change", () => {
                    userSettings.planner.enableImagePreview = enablePreviewRow.cb.checked;
                    saveSettings();
                });

                perfRow.cb.addEventListener("change", () => {
                    userSettings.planner.performanceModeEnabled = perfRow.cb.checked;
                    saveSettings();
                    refreshPlannerMarkers();
                });

                return {
                    urlInput
                };
            },
            onOk(ctx, closeModal) {
                const newUrl = ctx.urlInput.value.trim();

                if (newUrl) {
                    try {
                        new URL(newUrl); // validate
                    } catch {
                        window.alert("The script URL is not a valid URL.");
                        return;
                    }

                    if (!newUrl.startsWith("https://script.google.com/macros/")) {
                        window.alert(
                            "The script URL does not look like a Google Apps Script web app.\n" +
                            "Please use the 'exec' URL provided by 'Deploy > Test deployments / web app'."
                        );
                        return;
                    }

                    if (!newUrl.endsWith("exec")) {
                        window.alert(
                            "Please use the short 'exec' URL for the Apps Script web app (not the long 'user callback' URL)."
                        );
                        return;
                    }

                    if (newUrl.includes(" ")) {
                        window.alert("The URL contains spaces. Please check you've copied it correctly.");
                        return;
                    }
                }

                userSettings.planner.scriptURL = newUrl;
                saveSettings();
                fetchPlannerData();
                closeModal();
            }
        });
    }

    function openPlannerMarkerStylesModal() {
        const statusesCfg = userSettings.markers.statuses || (userSettings.markers.statuses = {});

        // Collect all statuses we know about, including any seen in planner data.
        const keysSet = new Set([
            ...Object.keys(DEFAULT_STATUS_CONFIG),
            ...Object.keys(statusesCfg),
            ...plannerPois.map(poi => poi && poi.status).filter(Boolean).map(s => String(s))
        ]);
        const allKeys = Array.from(keysSet).sort();

        openSettingsModal({
            id: "wf-planner-marker-styles",
            title: "Planner pin appearance",
            buildContent(body) {
                const container = document.createElement("div");
                container.className = "wfmapmods-modal-section";

                const hint = document.createElement("div");
                hint.style.fontSize = "11px";
                hint.style.marginBottom = "6px";
                hint.textContent = "Choose which planner statuses to show and adjust their pin colour.";
                container.appendChild(hint);

                const table = document.createElement("table");
                table.style.width = "100%";
                table.style.borderCollapse = "collapse";
                table.style.fontSize = "11px";

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

                const header = document.createElement("tr");
                const thStatus = makeTH("Status");
                const thShow = makeTH("Show");
                const thColor = makeTH("Colour");

                thShow.style.textAlign = "center";
                thColor.style.textAlign = "center";

                header.appendChild(thStatus);
                header.appendChild(thShow);
                header.appendChild(thColor);
                table.appendChild(header);

                allKeys.forEach(statusKey => {
                    const cfg = ensureStatusConfigFor(statusKey);

                    const row = document.createElement("tr");

                    const tdLabel = makeTD();
                    tdLabel.textContent = getStatusLabel(statusKey);
                    row.appendChild(tdLabel);

                    const tdShow = makeTD();
                    tdShow.style.textAlign = "center";
                    const cb = document.createElement("input");
                    cb.type = "checkbox";
                    cb.checked = cfg.enabled !== false;
                    tdShow.appendChild(cb);
                    row.appendChild(tdShow);

                    const tdColor = makeTD();
                    tdColor.style.textAlign = "center";
                    const colorInput = document.createElement("input");
                    colorInput.type = "color";
                    colorInput.value = cfg.color || "#a855f7";
                    colorInput.style.width = "40px";
                    colorInput.style.height = "20px";
                    tdColor.appendChild(colorInput);
                    row.appendChild(tdColor);

                    cb.addEventListener("change", () => {
                        cfg.enabled = cb.checked;
                    });
                    colorInput.addEventListener("change", () => {
                        cfg.color = colorInput.value || cfg.color;
                    });

                    table.appendChild(row);
                });

                container.appendChild(table);
                body.appendChild(container);

                return {};
            },
            onOk(ctx, closeModal) {
                saveSettings();
                clearPlannerMarkers();
                refreshPlannerMarkers();
                closeModal();
            }
        });
    }

    // -----------------------------
    // Generic modal helper (copied from Contributions style)
    // -----------------------------

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
    // Bootstrap
    // -----------------------------

    function bootstrap() {
        loadSettings();
        startMapPanelWatcher();

        // If a script URL already exists, load data immediately.
        if (getScriptURL()) {
            fetchPlannerData();
        }
    }

    if (document.readyState === "complete" || document.readyState === "interactive") {
        bootstrap();
    } else {
        window.addEventListener("DOMContentLoaded", bootstrap);
    }

})();
