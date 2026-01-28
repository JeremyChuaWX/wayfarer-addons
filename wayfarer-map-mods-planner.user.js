// ==UserScript==
// @name         Wayfarer Map Mods - Planner
// @version      3.0.1
// @description  Load and edit planner POIs from a Google Sheet and show them as pins on the Wayfarer submission map.
// @namespace    https://gitlab.com/Tntnnbltn/wayfarer-addons
// @downloadURL  https://gitlab.com/Tntnnbltn/wayfarer-addons/-/raw/main/wayfarer-map-mods-planner.user.js
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
// directory of this script's GitHub repository:
// <https://gitlab.com/Tntnnbltn/wayfarer-addons/-/blob/main/LICENSE>
// If not, see <https://www.gnu.org/licenses/>.

(function () {
    'use strict';

    // -----------------------------
    // Constants & settings
    // -----------------------------

    const SETTINGS_KEY = "wfmap_planner_settings";

    const SUBMIT_ROUTE = "/new/submit/new";
    const MAPVIEW_ROUTE = "/new/mapview";

    const POI_BRIDGE_SOURCE = "wfmapmods-planner";
    const SUBMISSION_BRIDGE_ID = "wfmapmods-submit-bridge";

    const WF_TOGGLE_GROUP = "wf-lefttop-controls";
    const WF_TOGGLE_ACTIVE_CLASS = "wf-toggle-active";
    let plannerClassObserver = null;

    const PERFORMANCE_MAX_VISIBLE_MARKERS = 500;

    let plannerInfoWindow = null;

    let activeEditContext = null;

    let addModeEnabled = false;

    // ----------------------------------
    // Performance caches / knobs
    // ----------------------------------

    const PLANNER_LABEL_MIN_ZOOM = 14;

    const pinIconCache = new Map();
    let refreshScheduled = false;
    let refreshPending = false;

    function scheduleRefreshPlannerMarkers() {
        if (refreshScheduled) { refreshPending = true; return; }
        refreshScheduled = true;

        requestAnimationFrame(() => {
            refreshScheduled = false;
            refreshPlannerMarkers();
            if (refreshPending) {
                refreshPending = false;
                scheduleRefreshPlannerMarkers();
            }
        });
    }

    // ----------------------------------
    // Settings
    // ----------------------------------

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

    let wfMap = null;
    let mapAttached = false;
    let mapPanelObserver = null;
    let mapPanelMutationScheduled = false;

    /** Planner POIs array (as returned by Apps Script). */
    let plannerPois = [];

    /** id -> google.maps.Marker */
    let plannerMarkers = {};

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
    // Map lifecycle + route watcher
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
        mapPanelMutationScheduled = false;
    }

    /**
 * Detect when the map side panel appears and attach the planner overlay.
 * Teardown is handled by onMapRouteChange() when we leave the map route.
 */
    function handlePanelChange() {
        const panelPresent = !!document.querySelector("#wfmapmods-side-panel");

        if (panelPresent) {
            attachPlannerToMapIfNeeded();
            insertPlannerSettingsLink();
            insertPlannerLayersToggle();
            stopMapPanelWatcher();
        }
    }

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

    function teardownMap() {
        if (!mapAttached) return;
        clearPlannerMarkers();
        wfMap = null;
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
            checkbox.className = "wfmapmods-layers-checkbox";

            const text = document.createElement("span");
            text.textContent = "Planner";
            text.className = "wfmapmods-layers-label";

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

        function normalizeImageUrl(url = "") {
            // Send original resolution images to the submit screen
            if (!url.startsWith("https://lh3.googleusercontent.com/")) return url;
            return url.replace(/=[a-z]\d+$/i, "") + "=s0";
        }

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
                mainUrl: normalizeImageUrl(poi.candidateimageurl),
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

    function getPlannerPinSymbol(color) {
        const key = color || "#a855f7";

        let icon = pinIconCache.get(key);
        if (icon) return icon;

        const svg = getGenericMarkerSvg(key, 'class="wfmapmods-planner-marker"');
        const url = "data:image/svg+xml;charset=UTF-8," + encodeURIComponent(svg);

        icon = {
            url,
            scaledSize: new google.maps.Size(25, 41),
            anchor: new google.maps.Point(12.5, 41)
        };

        pinIconCache.set(key, icon);
        return icon;
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
            this.setMap(wfMap);
        };

        PlannerLabelOverlay.prototype = new google.maps.OverlayView();

        PlannerLabelOverlay.prototype.onAdd = function () {
            const pane = this.getPanes().overlayImage;
            const div = document.createElement("div");
            div.className = "wfmap-planner-marker-label";

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

            // Keep dynamic positioning inline
            this.div.style.left = pos.x + "px";
            this.div.style.top = (pos.y + 4) + "px";
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

    function applyPlannerMarkerVisuals(marker, icon, titleText, labelText, showLabel) {
        // Icon
        if (marker._plannerIcon !== icon) {
            marker.setIcon(icon);
            marker._plannerIcon = icon;
        }

        // Title
        if (marker._plannerTitle !== titleText) {
            marker.setTitle(titleText);
            marker._plannerTitle = titleText;
        }

        // Label visibility + text
        if (!showLabel) {
            if (marker._plannerLabelVisible) {
                if (marker._plannerLabelOverlay) marker._plannerLabelOverlay.setMap(null);
                marker._plannerLabelVisible = false;
            }
            return;
        }

        ensurePlannerLabelOverlayClass();

        const newText = labelText || "";

        if (!marker._plannerLabelOverlay) {
            marker._plannerLabelOverlay = new PlannerLabelOverlay(marker, newText);
            marker._plannerLabelVisible = true;
            marker._plannerLabelText = newText;
            return;
        }

        if (marker._plannerLabelText !== newText) {
            marker._plannerLabelOverlay.setText(newText);
            marker._plannerLabelText = newText;
        }

        if (!marker._plannerLabelVisible) {
            marker._plannerLabelOverlay.setMap(wfMap);
            marker._plannerLabelVisible = true;
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
        controlUI.dataset.wfToggleGroup = WF_TOGGLE_GROUP;

        // Classes instead of inline styling
        controlDiv.className = "wfmap-planner-add-control";
        controlUI.className = "wfmap-planner-add-control-btn";

        controlUI.textContent = "P+";
        controlDiv.appendChild(controlUI);

        observePlannerToggleClass(controlUI);

        controlUI.addEventListener("click", (e) => {
            e.preventDefault();
            e.stopPropagation();

            const enabled = wfExclusiveToggle(controlUI, WF_TOGGLE_GROUP);

            addModeEnabled = enabled;

            // Turning OFF add mode: cancel any unsaved edit & close window
            if (!addModeEnabled) {
                revertActiveEditIfNeeded();
                if (plannerInfoWindow) plannerInfoWindow.close();
            }

            // addModeEnabled ? enablePlannerAddMode() : disablePlannerAddMode();
        });

        // Place with other default controls (left top)
        map.controls[google.maps.ControlPosition.LEFT_TOP].push(controlDiv);
    }

    function wfExclusiveToggle(buttonEl, group = WF_TOGGLE_GROUP) {
        if (!buttonEl) return false;

        // Mark it as part of the group so other scripts can find it
        buttonEl.dataset.wfToggleGroup = group;

        const isActive = buttonEl.classList.contains(WF_TOGGLE_ACTIVE_CLASS);

        if (isActive) {
            // Clicking an active button turns it off
            buttonEl.classList.remove(WF_TOGGLE_ACTIVE_CLASS);
            return false;
        }

        // Turn off all other toggles in this group
        document
            .querySelectorAll(`[data-wf-toggle-group="${group}"].${WF_TOGGLE_ACTIVE_CLASS}`)
            .forEach((el) => {
            if (el !== buttonEl) el.classList.remove(WF_TOGGLE_ACTIVE_CLASS);
        });

        // Turn this one on
        buttonEl.classList.add(WF_TOGGLE_ACTIVE_CLASS);
        return true;
    }

    function syncPlannerEnabledFromDom(controlUI) {
        const enabled = controlUI.classList.contains(WF_TOGGLE_ACTIVE_CLASS);

        // Change map cursor depending on mode
        setMapCursorForSubmissionPin(enabled);

        if (enabled === addModeEnabled) return;

        addModeEnabled = enabled;

        if (!addModeEnabled) {
            revertActiveEditIfNeeded();
            if (plannerInfoWindow) plannerInfoWindow.close();
        }
    }

    function setMapCursorForSubmissionPin(enabled) {
        if (!wfMap) return;

        wfMap.setOptions({
            draggableCursor: enabled ? "default" : null
        });
    }

    function observePlannerToggleClass(controlUI) {
        if (!controlUI) return;
        if (plannerClassObserver) plannerClassObserver.disconnect();

        plannerClassObserver = new MutationObserver(() => {
            syncPlannerEnabledFromDom(controlUI);
        });

        plannerClassObserver.observe(controlUI, {
            attributes: true,
            attributeFilter: ["class"],
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

    async function attachPlannerToMapIfNeeded() {
        // 1) If we think we're attached, verify the map is still alive.
        if (mapAttached) {
            const hasLiveMap = wfMap && !isMapStale(wfMap);

            if (hasLiveMap) {
                refreshPlannerMarkers();
                return;
            }

            // We thought we were attached, but the underlying map is gone/stale.
            teardownMap();
            // fall through to reattach
        }

        const map = await getWfMap();
        if (!map) {
            console.warn("[Planner] Map not found – cannot attach");
            return;
        }

        wfMap = map;
        mapAttached = true;

        if (!wfMap._plannerOverlayBoundsListenerAdded) {
            wfMap.addListener("idle", scheduleRefreshPlannerMarkers);
            wfMap._plannerOverlayBoundsListenerAdded = true;
        }

        // Add the P+ button
        createPlannerAddControl(wfMap);

        // One map-click handler for both normal clicks and add mode
        if (!wfMap._plannerMapClickHandlerAdded) {
            wfMap.addListener("click", (ev) => {
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

            wfMap._plannerMapClickHandlerAdded = true;
        }

        refreshPlannerMarkers();
    }

    function handleAddModeClick(latLng) {
        if (!wfMap || !latLng) return;

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
            map: wfMap,
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
        if (!wfMap || !Array.isArray(plannerPois)) {
            return;
        }

        const plannerCfg = userSettings.planner || {};
        if (plannerCfg.layerEnabled === false) {
            clearPlannerMarkers();
            return;
        }

        const bounds = wfMap.getBounds();
        if (!bounds) {
            return;
        }

        const performanceModeEnabled = !!plannerCfg.performanceModeEnabled;
        const maxVisibleMarkers = PERFORMANCE_MAX_VISIBLE_MARKERS;

        // First: find all POIs that should be shown in current bounds.
        const candidateIds = [];
        const candidateById = {};

        plannerPois.forEach(poi => {
            if (!poi) return;

            let lat = poi.lat;
            let lng = poi.lng;
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

            const icon = getPlannerPinSymbol(color);

            let marker = plannerMarkers[id];

            const titleStatus = String(poi.status || "").toUpperCase() || "UNKNOWN";
            const titleText = `${poi.title || "(untitled)"} (${titleStatus})`;

            // Titles only shown at/above zoom threshold
            const zoom = wfMap.getZoom ? wfMap.getZoom() : null;
            const showTitles =
                  !!(plannerCfg.showTitles) &&
                  (zoom == null || zoom >= PLANNER_LABEL_MIN_ZOOM);

            if (!marker) {
                marker = new google.maps.Marker({
                    map: null,
                    position: { lat: poi.lat, lng: poi.lng },
                    title: titleText,
                    icon,
                    draggable: !!(userSettings.planner && userSettings.planner.enableDragging),
                    optimized: false
                });

                marker.addListener("click", () => {
                    openPlannerInfoWindow(marker, poi);
                });

                if (marker.getDraggable()) {
                    marker.addListener("dragend", (ev) => {
                        const newPos = ev.latLng;
                        if (!newPos) return;
                        marker.setPosition(newPos);
                        openPlannerInfoWindow(marker, poi);
                    });
                }

                plannerMarkers[id] = marker;
            }

            // Only apply icon/title/label when changed
            applyPlannerMarkerVisuals(marker, icon, titleText, poi.title || "", showTitles);

            // Put marker on map if needed
            if (!marker.getMap()) {
                marker.setMap(wfMap);
            }
        });

        // Hide markers that are no longer in bounds.
        Object.entries(plannerMarkers).forEach(([id, marker]) => {
            if (!marker) return;

            if (!inBoundsIds.has(id) && marker.getMap()) {
                marker.setMap(null);

                if (marker._plannerLabelOverlay) {
                    marker._plannerLabelOverlay.setMap(null);
                }

                marker._plannerLabelVisible = false;
            }
        });
    }


    // -----------------------------
    // Planner info window
    // -----------------------------
    function openPlannerInfoWindow(marker, poi, options) {
        options = options || {};
        const isNew = !!options.isNew;

        if (!wfMap || !marker || !poi) return;

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
        // keep your existing classes, add wfmap-planner- styling class
        container.className = "wfmapmods-planner-popup wfmap-planner-popup wf-nearby-iw-content";

        function labelEl(text) {
            const el = document.createElement("div");
            el.textContent = text;
            el.className = "wfmap-planner-field-label";
            return el;
        }

        function inputText(initial = "") {
            const el = document.createElement("input");
            el.type = "text";
            el.value = initial;
            el.className = "wfmap-planner-field";
            return el;
        }

        function textarea(initial = "") {
            const el = document.createElement("textarea");
            el.value = initial;
            el.rows = 3;
            el.className = "wfmap-planner-field wfmap-planner-textarea";
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
        statusSelect.className = "wfmap-planner-select";

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
        const descInput = textarea(poi.description || "");
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
            previewImg.className = "wfmapmods-imagePreview wfmap-planner-image-preview";

            previewContainer.appendChild(previewImg);
            container.appendChild(previewContainer);

            function updatePreview(url) {
                const trimmed = (url || "").trim();
                if (!trimmed) {
                    previewImg.classList.remove("wfmap-planner-image-preview--shown");
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
                previewImg.classList.add("wfmap-planner-image-preview--shown");
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
        expander.className = "wfmap-planner-expander";
        container.appendChild(expander);

        const extraData = document.createElement("div");
        extraData.className = "wfmapmods-extraData wfmap-planner-extra";
        container.appendChild(extraData);

        let expanded = false;
        expander.addEventListener("click", () => {
            expanded = !expanded;

            extraData.classList.toggle("wfmap-planner-extra--shown", expanded);
            expander.classList.toggle("wfmap-planner-expander--expanded", expanded);

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
        actions.className = "wfmap-planner-actions";

        // helper: creates a text-style link
        function makeLink(text, extraClass = "") {
            const link = document.createElement("span");
            link.textContent = text;
            link.className = `wfmap-planner-link${extraClass ? " " + extraClass : ""}`;
            return link;
        }

        // LEFT: DELETE
        const leftBox = document.createElement("div");
        if (poi.id) {
            const del = makeLink("Delete", "wfmap-planner-link--danger");
            del.addEventListener("click", (ev) => {
                ev.preventDefault();
                openPlannerDeleteConfirm(poi.id);
            });
            leftBox.appendChild(del);
        }
        actions.appendChild(leftBox);

        // CENTER: SUBMIT
        const centerBox = document.createElement("div");
        centerBox.className = "wfmap-planner-actions-center";

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
        closeX.className = "wfmap-planner-close";

        closeX.addEventListener("click", () => {
            revertActiveEditIfNeeded();
            if (plannerInfoWindow) {
                plannerInfoWindow.close();
            }
        });
        container.appendChild(closeX);

        plannerInfoWindow.open(wfMap, marker);
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
            link.className = "wfmap-planner-settings-link";

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
                section.className = "wfmapmods-modal-section wfmap-planner-settings-section";

                function label(text) {
                    const el = document.createElement("label");
                    el.textContent = text;
                    el.className = "wfmap-planner-settings-label";
                    return el;
                }

                function checkboxRow(text, checked) {
                    const row = document.createElement("label");
                    row.className = "wfmap-planner-settings-checkbox-row";

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
                urlInput.className = "wfmap-planner-settings-url-input";

                const urlHint = document.createElement("div");
                urlHint.className = "wfmap-planner-settings-hint";
                urlHint.textContent =
                    "Paste the Apps Script web app URL (short 'exec' URL).";

                const refreshBtn = document.createElement("button");
                refreshBtn.type = "button";
                refreshBtn.textContent = "Update planner data";
                refreshBtn.className = "wfmap-planner-settings-refresh-btn";

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
                    `Performance mode (Hides markers at low zoom levels. Only kicks in if there would be >${PERFORMANCE_MAX_VISIBLE_MARKERS} markers on the screen.)`,
                    userSettings.planner.performanceModeEnabled
                );

                const customMarkersLink = document.createElement("a");
                customMarkersLink.href = "#";
                customMarkersLink.textContent = "Customise pin colours per status";
                customMarkersLink.className = "wfmap-planner-settings-link";

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
                hint.className = "wfmap-planner-markerstyles-hint";
                hint.textContent = "Choose which planner statuses to show and adjust their pin colour.";
                container.appendChild(hint);

                const table = document.createElement("table");
                table.className = "wfmap-planner-markerstyles-table";

                function makeTH(text, extraClass = "") {
                    const th = document.createElement("th");
                    th.textContent = text;
                    th.className = `wfmap-planner-markerstyles-th${extraClass ? " " + extraClass : ""}`;
                    return th;
                }

                function makeTD(extraClass = "") {
                    const td = document.createElement("td");
                    td.className = `wfmap-planner-markerstyles-td${extraClass ? " " + extraClass : ""}`;
                    return td;
                }

                const header = document.createElement("tr");
                const thStatus = makeTH("Status");
                const thShow = makeTH("Show", "wfmap-planner-markerstyles-center");
                const thColor = makeTH("Colour", "wfmap-planner-markerstyles-center");

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

                    const tdShow = makeTD("wfmap-planner-markerstyles-center");
                    const cb = document.createElement("input");
                    cb.type = "checkbox";
                    cb.checked = cfg.enabled !== false;
                    tdShow.appendChild(cb);
                    row.appendChild(tdShow);

                    const tdColor = makeTD("wfmap-planner-markerstyles-center");
                    const colorInput = document.createElement("input");
                    colorInput.type = "color";
                    colorInput.value = cfg.color || "#a855f7";
                    colorInput.className = "wfmap-planner-markerstyles-color";
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
    // Generic modal helper
    // -----------------------------

    // -----------------------------
    // Generic modal helper
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
        backdrop.className = "wfmapmods-modal-backdrop wfmap-planner-modal-backdrop";

        const dialog = document.createElement("div");
        dialog.className = "wfmapmods-modal-dialog wfmap-planner-modal-dialog";

        const header = document.createElement("div");
        header.className = "wfmapmods-modal-header wfmap-planner-modal-header";

        const titleEl = document.createElement("div");
        titleEl.textContent = title || "Settings";

        const closeBtn = document.createElement("button");
        closeBtn.type = "button";
        closeBtn.textContent = "×";
        closeBtn.className = "wfmap-planner-modal-close";

        header.appendChild(titleEl);
        header.appendChild(closeBtn);

        const body = document.createElement("div");
        body.className = "wfmapmods-modal-body wfmap-planner-modal-body";

        const footer = document.createElement("div");
        footer.className = "wfmapmods-modal-footer wfmap-planner-modal-footer";

        const cancelBtn = document.createElement("button");
        cancelBtn.type = "button";
        cancelBtn.textContent = "Cancel";
        cancelBtn.className = "wfmap-planner-modal-btn";

        const okBtn = document.createElement("button");
        okBtn.type = "button";
        okBtn.textContent = "OK";
        okBtn.className = "wfmap-planner-modal-btn";

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
    // css styling
    // -----------------------------

    function injectCSS() {
        if (document.getElementById("wfmapmods-planner-css")) return;

        const css = document.createElement("style");
        css.id = "wfmapmods-planner-css";
        css.textContent = `
/* =====================
   Planner marker label overlay
   ===================== */
.wfmap-planner-marker-label {
  position: absolute;
  white-space: nowrap;
  font-size: 14px;
  font-weight: bold;
  color: rgba(255, 241, 0, 0.9);
  text-shadow:
    0 0 2px #000000,
    0 0 4px #000000,
    -1px -1px 2px #000000,
    1px 1px 2px #000000;
  pointer-events: none;
  transform: translate(-50%, 0);
}

/* =====================
   Planner add control (P+)
   ===================== */
.wfmap-planner-add-control {
  margin-top: 10px;
  margin-left: 10px;
}

.wfmap-planner-add-control-btn {
  background-color: #ffffff;
  border: 2px solid #ffffff;
  border-radius: 3px;
  box-shadow: 0 1px 4px rgba(0,0,0,0.3);
  cursor: pointer;
  text-align: center;
  width: 32px;
  height: 32px;
  line-height: 30px;
  font-size: 16px;
  font-weight: bold;
  color: #000;
  user-select: none;
}

.wf-toggle-active {
  background-color: #ffce04 !important;
  border-color: #ffce04 !important;
  color: #000000 !important;
}

/* =====================
   Planner info window container
   ===================== */
.wfmap-planner-popup {
  max-width: 260px;
  font-size: 12px;
  color: #111827;
  position: relative;
  padding-top: 4px;
}

/* =====================
   Info window field labels
   ===================== */
.wfmap-planner-field-label {
  font-size: 11px;
  font-weight: bold;
  margin-top: 4px;
}

/* =====================
   Inputs (text, textarea, select)
   ===================== */
.wfmap-planner-field,
.wfmap-planner-select {
  width: 100%;
  box-sizing: border-box;
  font-size: 12px;
  padding: 2px 4px;
  margin-top: 2px;
  border: 1px solid #d1d5db;
  border-radius: 3px;
}

.wfmap-planner-textarea {
  resize: vertical; /* optional but nice */
}

/* =====================
   Image preview
   ===================== */
.wfmap-planner-image-preview {
  max-width: 100%;
  max-height: 150px;
  margin-top: 4px;
  display: none;
}

.wfmap-planner-image-preview.wfmap-planner-image-preview--shown {
  display: block;
}

/* =====================
   Expander + extra fields
   ===================== */
.wfmap-planner-expander {
  cursor: pointer;
  display: inline-block;
  margin-top: 4px;
  font-size: 14px;
  transform: rotate(90deg); /* downwards (collapsed) */
}

.wfmap-planner-expander.wfmap-planner-expander--expanded {
  transform: rotate(-90deg);
}

.wfmap-planner-extra {
  display: none;
  margin-top: 4px;
  border-top: 1px solid #e5e7eb;
  padding-top: 4px;
}

.wfmap-planner-extra.wfmap-planner-extra--shown {
  display: block;
}

/* =====================
   Bottom actions row
   ===================== */
.wfmap-planner-actions {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 6px;
  font-size: 12px;
}

.wfmap-planner-actions-center {
  flex: 1;
  display: flex;
  justify-content: center;
}

/* =====================
   Text links (Delete / Submit / Save)
   ===================== */
.wfmap-planner-link {
  cursor: pointer;
  color: #2563eb;
  text-decoration: underline;
}

.wfmap-planner-link--danger {
  color: #dc2626;
}

/* =====================
   Close (X)
   ===================== */
.wfmap-planner-close {
  position: absolute;
  top: 4px;
  right: 6px;
  cursor: pointer;
  font-size: 18px;
  font-weight: bold;
  line-height: 12px;
  color: #555;
}

/* =====================
   Planner settings modal
   ===================== */
.wfmap-planner-settings-section {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.wfmap-planner-settings-label {
  font-size: 11px;
  font-weight: bold;
}

.wfmap-planner-settings-checkbox-row {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
}

.wfmap-planner-settings-url-input {
  width: 100%;
  box-sizing: border-box;
  font-size: 12px;
  padding: 4px 6px;
  border: 1px solid #d1d5db;
  border-radius: 4px;
  background-color: #ffffff;
}

.wfmap-planner-settings-hint {
  font-size: 10px;
  color: #6b7280;
}

.wfmap-planner-settings-refresh-btn {
  padding: 4px 8px;
  font-size: 11px;
  cursor: pointer;
  align-self: flex-start;
}

.wfmap-planner-settings-link {
  font-size: 11px;
  text-decoration: underline;
  align-self: flex-start;
  cursor: pointer;
}

/* =====================
   Planner marker styles modal
   ===================== */
.wfmap-planner-markerstyles-hint {
  font-size: 11px;
  margin-bottom: 6px;
}

.wfmap-planner-markerstyles-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 11px;
}

.wfmap-planner-markerstyles-th {
  padding: 2px 4px;
  text-align: left;
}

.wfmap-planner-markerstyles-td {
  padding: 2px 4px;
  vertical-align: middle;
}

.wfmap-planner-markerstyles-center {
  text-align: center;
}

.wfmap-planner-markerstyles-color {
  width: 40px;
  height: 20px;
}

/* =====================
   Backdrop (modal overlay)
   ===================== */
.wfmap-planner-modal-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.4);
  z-index: 9999;
  display: flex;
  align-items: center;
  justify-content: center;
}

/* =====================
   Modal dialog shell
   ===================== */
.wfmap-planner-modal-dialog {
  background: #fff;
  color: #000;
  min-width: 350px;
  max-width: 500px;
  max-height: 80vh;
  border-radius: 4px;
  box-shadow: 0 2px 12px rgba(0,0,0,0.4);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  font-size: 13px;
}

/* =====================
   Header
   ===================== */
.wfmap-planner-modal-header {
  padding: 8px 12px;
  border-bottom: 1px solid #ddd;
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-weight: bold;
}

/* =====================
   Close button
   ===================== */
.wfmap-planner-modal-close {
  border: none;
  background: transparent;
  cursor: pointer;
  font-size: 16px;
  line-height: 1;
}

/* =====================
   Body
   ===================== */
.wfmap-planner-modal-body {
  padding: 8px 12px;
  overflow-y: auto;
  flex: 1 1 auto;
}

/* =====================
   Footer + action buttons
   ===================== */
.wfmap-planner-modal-footer {
  padding: 8px 12px;
  border-top: 1px solid #ddd;
  text-align: right;
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}

.wfmap-planner-modal-btn {
  padding: 4px 10px;
  cursor: pointer;
}
`;
        document.head.appendChild(css);
    }

    // -----------------------------
    // Bootstrap
    // -----------------------------

    function bootstrap() {
        loadSettings();
        injectCSS();
        setupMapRouteWatcher();

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
