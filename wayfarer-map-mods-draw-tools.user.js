// ==UserScript==
// @name         Wayfarer Map Mods - Draw Tools
// @version      0.1.0
// @description  Adds simple drawing tools (markers, polylines, circles) to the Wayfarer submission map, with persistence.
// @namespace    https://gitlab.com/Tntnnbltn/wayfarer-addons
// @downloadURL  https://gitlab.com/Tntnnbltn/wayfarer-addons/-/raw/main/wayfarer-map-mods-draw-tools.user.js
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

    let submitMap = null;
    let mapAttached = false;

    const isTouchDevice = !!(
        "ontouchstart" in window ||
        (navigator && (navigator.maxTouchPoints > 0 || navigator.msMaxTouchPoints > 0))
    );

    const SETTINGS_KEY = "wfmap_drawing_tools_settings";

    const userSettings = {};

    function ensureDrawingDefaults() {
        if (!userSettings.drawing) {
            userSettings.drawing = {};
        }
        if (!userSettings.drawing.color) {
            userSettings.drawing.color = "#ff0000";
        }
        if (!Array.isArray(userSettings.drawing.shapes)) {
            userSettings.drawing.shapes = [];
        }
        // New defaults
        if (typeof userSettings.drawing.enabled !== "boolean") {
            userSettings.drawing.enabled = true; // default: enabled
        }
        if (!userSettings.drawing.position) {
            userSettings.drawing.position = "left"; // default: left
        }
    }

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
            if (!saved) {
                ensureDrawingDefaults();
                return;
            }

            mergeDeep(userSettings, JSON.parse(saved));
            ensureDrawingDefaults();
        } catch (e) {
            console.error(`${SETTINGS_KEY} - Failed to load settings:`, e);
            ensureDrawingDefaults();
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

    let lastPanelPresent = false;

    function handlePanelChange() {
        const panelPresent = !!document.querySelector("#wfmapmods-side-panel");

        if (panelPresent && !lastPanelPresent) {
            attachDrawingToolsToMapIfNeeded();
            insertDrawingSettingsLink();
        } else if (!panelPresent && lastPanelPresent) {
            teardownDrawingToolsForMap();
        }

        if (panelPresent) {
            insertDrawingLayersOption();
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
                    console.warn("[DrawingTools] Failed to find submit map after several attempts");
                    resolve(null);
                    return;
                }

                setTimeout(tryFindMap, 250);
            }

            tryFindMap();
        });
    }

    function teardownDrawingToolsForMap() {
        if (!mapAttached) return;

        // Reset modes and restore submission marker visibility
        currentMode = null;
        deleteMode = false;
        document.body.classList.remove("wf-drawing-active");
        clearModeListeners();
        refreshOverlayClickability();

        // Remove overlays from the map but keep saved shapes in settings
        clearInMemoryShapes(true);

        // Reset map-related globals so a fresh map can be initialised cleanly
        submitMap = null;
        mapAttached = false;

        // Allow controls + helpers to be recreated next time we attach
        drawingControlsAdded = false;
        drawingControlsPosition = null;
        drawingControlDiv = null;
        circleLabelDiv = null;
        polyLabelDiv = null;
        projectionHelper = null;
        mapProjection = null;
        overlayOffset = { x: 0, y: 0 };
    }

    async function attachDrawingToolsToMapIfNeeded() {
        if (mapAttached) return;

        const map = await getSubmitMap();

        if (!map) {
            console.warn("[DrawingTools] Map not found – cannot attach");
            return;
        }

        submitMap = map;
        initDrawingTools();
        mapAttached = true;
    }

    // -----------------------------
    // Settings link + modal
    // -----------------------------

    function insertDrawingSettingsLink() {
        const panelCheck = setInterval(() => {
            const settingsBody = document.querySelector(".wfmapmods-settings-links");
            if (!settingsBody) return;

            clearInterval(panelCheck);

            if (document.getElementById("wfmapmods-settings-drawing")) return;

            const link = document.createElement("a");
            link.id = "wfmapmods-settings-drawing";
            link.textContent = "Drawing Tools";

            settingsBody.appendChild(link);

            link.addEventListener("click", () => {
                openDrawingSettingsWindow();
            });
        }, 300);
    }

    function openDrawingSettingsWindow() {
        if (document.getElementById("wfmapmods-drawing-modal-backdrop")) return;

        const drawingSettings = userSettings.drawing || {};
        const currentColor = drawingSettings.color || "#ff0000";
        const currentEnabled = drawingSettings.enabled !== false;
        const currentPosition = drawingSettings.position || "left";

        const backdrop = document.createElement("div");
        backdrop.id = "wfmapmods-drawing-modal-backdrop";
        Object.assign(backdrop.style, {
            position: "fixed",
            inset: "0",
            background: "rgba(0,0,0,0.35)",
            zIndex: "2000",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            overflowY: "auto",
            paddingTop: "12px",
            paddingBottom: "12px"
        });

        function closeModal() {
            backdrop.remove();
        }

        const dialog = document.createElement("div");
        Object.assign(dialog.style, {
            background: "#ffffff",
            borderRadius: "8px",
            boxShadow: "0 10px 25px rgba(0,0,0,0.35)",
            width: "260px",
            maxWidth: "calc(100% - 32px)",
            padding: "10px 12px 8px",
            boxSizing: "border-box",
            fontFamily: "Roboto, Arial, sans-serif",
            fontSize: "12px",
            color: "#111827",
            maxHeight: "90vh",
            overflowY: "auto"
        });

        const title = document.createElement("div");
        title.textContent = "Drawing Tool Settings";
        Object.assign(title.style, {
            fontSize: "15px",
            fontWeight: "600",
            marginBottom: "10px"
        });
        dialog.appendChild(title);

        function makeRow(labelText, inputEl) {
            const row = document.createElement("div");
            Object.assign(row.style, {
                display: "flex",
                alignItems: "center",
                marginBottom: "6px",
                gap: "6px"
            });

            const label = document.createElement("label");
            label.textContent = labelText;
            Object.assign(label.style, {
                flex: "0 0 120px",
                fontSize: "11px",
                color: "#374151"
            });

            inputEl.style.flex = "1 0 auto";

            row.appendChild(label);
            row.appendChild(inputEl);
            return row;
        }

        // Enable / disable checkbox
        const enabledInput = document.createElement("input");
        enabledInput.type = "checkbox";
        enabledInput.checked = currentEnabled;
        dialog.appendChild(makeRow("Enable tools:", enabledInput));

        // Position select
        const positionSelect = document.createElement("select");
        [
            { value: "left", label: "Left" },
            { value: "top", label: "Top" },
            { value: "bottom", label: "Bottom" }
        ].forEach(optData => {
            const opt = document.createElement("option");
            opt.value = optData.value;
            opt.textContent = optData.label;
            positionSelect.appendChild(opt);
        });
        positionSelect.value = currentPosition;
        dialog.appendChild(makeRow("Controls at:", positionSelect));

        // Colour picker
        const colorInput = document.createElement("input");
        colorInput.type = "color";
        colorInput.value = currentColor;
        dialog.appendChild(makeRow("Shape colour:", colorInput));

        const hint = document.createElement("div");
        hint.textContent = "New shapes will use this colour. Existing shapes keep their original colour.";
        Object.assign(hint.style, {
            fontSize: "11px",
            color: "#6b7280",
            marginTop: "2px",
            marginBottom: "8px"
        });
        dialog.appendChild(hint);

        const buttonsRow = document.createElement("div");
        Object.assign(buttonsRow.style, {
            display: "flex",
            justifyContent: "flex-end",
            gap: "8px",
            marginTop: "4px"
        });

        const cancelBtn = document.createElement("button");
        cancelBtn.type = "button";
        cancelBtn.textContent = "Cancel";
        Object.assign(cancelBtn.style, {
            padding: "4px 10px",
            borderRadius: "4px",
            border: "1px solid #d1d5db",
            background: "#ffffff",
            cursor: "pointer",
            fontSize: "12px"
        });

        const okBtn = document.createElement("button");
        okBtn.type = "button";
        okBtn.textContent = "OK";
        Object.assign(okBtn.style, {
            padding: "4px 12px",
            borderRadius: "4px",
            border: "1px solid #2563eb",
            background: "#2563eb",
            color: "#ffffff",
            cursor: "pointer",
            fontSize: "12px"
        });

        buttonsRow.appendChild(cancelBtn);
        buttonsRow.appendChild(okBtn);
        dialog.appendChild(buttonsRow);

        cancelBtn.addEventListener("click", () => {
            closeModal();
        });

        okBtn.addEventListener("click", () => {
            const newColor = colorInput.value || "#ff0000";
            const newEnabled = !!enabledInput.checked;
            const newPosition = positionSelect.value || "left";

            ensureDrawingDefaults();
            userSettings.drawing.color = newColor;
            userSettings.drawing.enabled = newEnabled;
            userSettings.drawing.position = newPosition;
            saveSettings();

            currentShapeColor = newColor;

            if (submitMap) {
                applyDrawingEnabledState();
            }

            closeModal();
        });

        document.addEventListener("keydown", function escHandler(ev) {
            if (ev.key === "Escape") {
                closeModal();
                document.removeEventListener("keydown", escHandler);
            }
            if (ev.key === "Enter") {
                ev.preventDefault();
                okBtn.click();
            }
        });

        backdrop.addEventListener("click", (ev) => {
            if (ev.target === backdrop) {
                closeModal();
            }
        });

        backdrop.appendChild(dialog);
        document.body.appendChild(backdrop);
    }

    // -----------------------------
    // Drawing tools state
    // -----------------------------

    let drawingControlsAdded = false;
    let drawingControlDiv = null;
    let drawingControlsPosition = null;

    let allShapes = [];
    let currentShapeColor = "#ff0000";
    let deleteMode = false;

    let modeListeners = [];
    let domModeListeners = [];
    let drawingClickHandler = null;

    let layersOptionCheckbox = null;

    function clearModeListeners() {
        modeListeners.forEach(l => google.maps.event.removeListener(l));
        modeListeners = [];

        domModeListeners.forEach(info => {
            try {
                info.target.removeEventListener(info.type, info.handler, info.options || false);
            } catch {
                // ignore
            }
        });
        domModeListeners = [];

        drawingClickHandler = null;
    }

    function addDomModeListener(target, type, handler, options) {
        const opts = options || false;
        target.addEventListener(type, handler, opts);
        domModeListeners.push({ target, type, handler, options: opts });
    }


    function clearInMemoryShapes(keepSettings) {
        allShapes.forEach(entry => {
            try {
                entry.overlay.setMap(null);
            } catch {
                // ignore
            }
        });
        allShapes = [];

        if (!keepSettings) {
            ensureDrawingDefaults();
            userSettings.drawing.shapes = [];
            saveSettings();
        }
    }

    function persistShapes() {
        ensureDrawingDefaults();
        const shapes = allShapes.map(entry => entry.data);
        userSettings.drawing.shapes = shapes;
        saveSettings();
    }

    // Only clickable in delete mode
    function refreshOverlayClickability() {
        const interactive = deleteMode;
        allShapes.forEach(entry => {
            if (!entry.overlay || !entry.overlay.setOptions) return;
            try {
                entry.overlay.setOptions({ clickable: interactive });
            } catch {
                // ignore
            }
        });
    }

    function registerShape(overlay, data, skipPersist) {
        const entry = { overlay, data };
        allShapes.push(entry);

        overlay.addListener("click", () => {
            if (!deleteMode) return;

            overlay.setMap(null);
            const idx = allShapes.indexOf(entry);
            if (idx >= 0) {
                allShapes.splice(idx, 1);
                persistShapes();
            }
        });

        refreshOverlayClickability();

        if (!skipPersist) {
            persistShapes();
        }
    }

    function rebuildShapesFromSettings() {
        clearInMemoryShapes(true);

        const drawingSettings = userSettings.drawing || {};
        const savedShapes = drawingSettings.shapes || [];
        currentShapeColor = drawingSettings.color || "#ff0000";

        savedShapes.forEach(data => {
            try {
                if (data.type === "marker") {
                    recreateMarker(data);
                } else if (data.type === "polyline") {
                    recreatePolyline(data);
                } else if (data.type === "circle") {
                    recreateCircle(data);
                }
            } catch (e) {
                console.error("[DrawingTools] Failed to recreate shape:", e, data);
            }
        });

        persistShapes();
    }

    function createMarkerIcon(color) {
        return {
            path: "M 0 -24 C -6.627 -24 -12 -18.627 -12 -12 C -12 -5 -3 7 0 12 C 3 7 12 -5 12 -12 C 12 -18.627 6.627 -24 0 -24 z",
            fillColor: color,
            fillOpacity: 1,
            strokeColor: "#202124",
            strokeWeight: 1,
            scale: 1,
            anchor: new google.maps.Point(0, 12)
        };
    }

    function recreateMarker(data) {
        const color = data.color || currentShapeColor;
        const marker = new google.maps.Marker({
            map: submitMap,
            position: new google.maps.LatLng(data.position.lat, data.position.lng),
            icon: createMarkerIcon(color),
            clickable: false
        });

        registerShape(marker, {
            type: "marker",
            position: data.position,
            color
        }, true);
    }

    function recreatePolyline(data) {
        const color = data.color || currentShapeColor;
        const path = (data.path || []).map(p => new google.maps.LatLng(p.lat, p.lng));
        const polyline = new google.maps.Polyline({
            map: submitMap,
            path,
            strokeColor: color,
            strokeWeight: 3,
            clickable: false
        });

        registerShape(polyline, {
            type: "polyline",
            path: data.path || [],
            color
        }, true);
    }

    function recreateCircle(data) {
        const color = data.color || currentShapeColor;
        const circle = new google.maps.Circle({
            map: submitMap,
            center: new google.maps.LatLng(data.center.lat, data.center.lng),
            radius: data.radius,
            strokeColor: color,
            strokeWeight: 2,
            fillColor: color,
            fillOpacity: 0.1,
            clickable: false
        });

        registerShape(circle, {
            type: "circle",
            center: data.center,
            radius: data.radius,
            color
        }, true);
    }

    function initDrawingTools() {
        if (!submitMap) return;

        ensureDrawingDefaults();
        currentShapeColor = userSettings.drawing.color || "#ff0000";

        ensurePinHideCSS();
        ensureProjectionHelper();
        attachMarkerClickCapture();

        applyDrawingEnabledState();

        submitMap._wfDrawingToolsInitialised = true;
    }

    // -----------------------------
    // Layers options
    // -----------------------------

    function syncLayersCheckboxFromSettings() {
        if (!layersOptionCheckbox) return;
        ensureDrawingDefaults();
        layersOptionCheckbox.checked = userSettings.drawing.enabled !== false;
    }

    function insertDrawingLayersOption() {
        // Find the layers menu created by your other plugin
        const menu = document.querySelector(".wfmapmods-layers-menu");
        if (!menu) return;

        // If we've already added our option, just resync its state
        let existingLabel = menu.querySelector(".wfmapmods-layers-option-drawing");
        if (existingLabel) {
            const cb = existingLabel.querySelector('input[type="checkbox"]');
            if (cb) {
                layersOptionCheckbox = cb;
                syncLayersCheckboxFromSettings();
            }
            return;
        }

        ensureDrawingDefaults();
        const enabled = userSettings.drawing.enabled !== false;

        const label = document.createElement("label");
        label.className = "wfmapmods-layers-option wfmapmods-layers-option-drawing";

        const input = document.createElement("input");
        input.type = "checkbox";
        input.checked = enabled;
        input.className = "wfmapmods-layers-checkbox";

        input.addEventListener("change", () => {
            ensureDrawingDefaults();
            userSettings.drawing.enabled = input.checked;
            saveSettings();
            applyDrawingEnabledState(); // this will handle showing/hiding tools + shapes
        });

        const span = document.createElement("span");
        span.textContent = "Draw tools";
        span.className = "wfmapmods-layers-label";

        label.appendChild(input);
        label.appendChild(span);
        menu.appendChild(label);

        layersOptionCheckbox = input;
    }

    // -----------------------------
    // Map controls + modes
    // -----------------------------

    let currentMode = null; // "marker"|"polyline"|"circle"|"delete"|null
    const modeButtons = {};

    let pinHideStyleInjected = false;

    function ensurePinHideCSS() {
        if (pinHideStyleInjected) return;
        const style = document.createElement("style");
        style.textContent = `
            body.wf-drawing-active img[src$="map_selection_pin.svg"] {
                display: none !important;
            }
        `;
        document.head.appendChild(style);
        pinHideStyleInjected = true;
    }

    function updateSelectionPinVisibility() {
        if (currentMode) {
            document.body.classList.add("wf-drawing-active");
        } else {
            document.body.classList.remove("wf-drawing-active");
        }
    }

    function getControlPositionForSetting(posStr) {
        switch (posStr) {
            case "top": return google.maps.ControlPosition.TOP_CENTER;
            case "bottom": return google.maps.ControlPosition.BOTTOM_CENTER;
            case "left":
            default: return google.maps.ControlPosition.LEFT_TOP;
        }
    }

    function updateControlsLayout() {
        if (!drawingControlDiv) return;

        const drawingSettings = userSettings.drawing || {};
        const posSetting = drawingSettings.position || "left";

        if (posSetting === "top" || posSetting === "bottom") {
            drawingControlDiv.style.flexDirection = "row";
            drawingControlDiv.style.alignItems = "center";

            // Optional: tweak title spacing a bit for horizontal layout
            const titleEl = drawingControlDiv.firstChild;
            if (titleEl && titleEl.style) {
                titleEl.style.marginBottom = "0";
                titleEl.style.marginRight = "6px";
            }
        } else {
            drawingControlDiv.style.flexDirection = "column";
            drawingControlDiv.style.alignItems = "stretch";

            const titleEl = drawingControlDiv.firstChild;
            if (titleEl && titleEl.style) {
                titleEl.style.marginRight = "0";
                titleEl.style.marginBottom = "2px";
            }
        }
    }

    function applyControlPosition() {
        if (!submitMap || !drawingControlDiv) return;

        const drawingSettings = userSettings.drawing || {};
        const posSetting = drawingSettings.position || "left";
        const newPos = getControlPositionForSetting(posSetting);

        if (drawingControlsPosition === newPos) {
            // Still update layout if the position setting changed but the ControlPosition enum didn't
            updateControlsLayout();
            return;
        }

        // Remove from old position if present
        if (drawingControlsPosition != null) {
            const arr = submitMap.controls[drawingControlsPosition];
            const a = arr.getArray();
            const idx = a.indexOf(drawingControlDiv);
            if (idx > -1) {
                arr.removeAt(idx);
            }
        }

        drawingControlsPosition = newPos;
        submitMap.controls[newPos].push(drawingControlDiv);

        // Adjust flex layout for the new position
        updateControlsLayout();
    }

    function applyDrawingEnabledState() {
        ensureDrawingDefaults();
        const drawingSettings = userSettings.drawing || {};
        const enabled = drawingSettings.enabled !== false;

        // Always reset modes when changing enabled state
        currentMode = null;
        deleteMode = false;
        clearModeListeners();
        document.body.classList.remove("wf-drawing-active");
        refreshOverlayClickability();

        syncLayersCheckboxFromSettings();

        if (!submitMap) return;

        if (!enabled) {
            // Hide controls
            if (drawingControlDiv && drawingControlsPosition != null) {
                const arr = submitMap.controls[drawingControlsPosition];
                const a = arr.getArray();
                const idx = a.indexOf(drawingControlDiv);
                if (idx > -1) {
                    arr.removeAt(idx);
                }
            }
            drawingControlsAdded = false;
            drawingControlsPosition = null;
            drawingControlDiv = null;

            // Remove shapes but keep settings
            clearInMemoryShapes(true);
            return;
        }

        // Enabled
        if (!drawingControlsAdded) {
            createDrawingControls(submitMap);
        } else {
            applyControlPosition();
        }

        // Rebuild shapes from saved settings
        rebuildShapesFromSettings();
    }

    function setMode(newMode) {
        if (newMode === currentMode) {
            newMode = null; // toggle off
        }

        clearModeListeners();

        currentMode = newMode;
        deleteMode = (newMode === "delete");

        Object.entries(modeButtons).forEach(([mode, btn]) => {
            if (mode === newMode) {
                btn.style.background = "#2563eb";
                btn.style.color = "#ffffff";
            } else {
                btn.style.background = "#ffffff";
                btn.style.color = "#111827";
            }

            if (mode === "delete") {
                btn.style.borderColor = deleteMode ? "#dc2626" : "#d1d5db";
            } else {
                btn.style.borderColor = "#d1d5db";
            }
        });

        updateSelectionPinVisibility();
        refreshOverlayClickability();

        if (submitMap) {
            submitMap.setOptions({
                draggableCursor: newMode ? "crosshair" : null
            });
        }

        if (!submitMap) return;

        if (newMode === "marker") {
            enableMarkerMode();
        } else if (newMode === "polyline") {
            enablePolylineMode();
        } else if (newMode === "circle") {
            enableCircleMode();
        }
    }

    function createButton(text, title) {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.textContent = text;
        Object.assign(btn.style, {
            padding: "4px 6px",
            margin: "2px",
            fontSize: "11px",
            borderRadius: "4px",
            border: "1px solid #d1d5db",
            background: "#ffffff",
            cursor: "pointer",
            fontFamily: "Roboto, Arial, sans-serif"
        });
        btn.title = title;
        return btn;
    }

    function createDrawingControls(map) {
        if (drawingControlsAdded) return;
        drawingControlsAdded = true;

        const controlDiv = document.createElement("div");
        Object.assign(controlDiv.style, {
            background: "rgba(255,255,255,0.9)",
            borderRadius: "6px",
            padding: "4px",
            margin: "10px",
            boxShadow: "0 1px 4px rgba(0,0,0,0.3)",
            display: "flex",
            flexDirection: "column",
            alignItems: "stretch"
        });

        const title = document.createElement("div");
        title.textContent = "Draw";
        Object.assign(title.style, {
            fontSize: "11px",
            fontWeight: "600",
            marginBottom: "2px",
            textAlign: "center"
        });
        controlDiv.appendChild(title);

        const btnMarker = createButton("Marker", "Click the map to add markers");
        const btnLine = createButton("Polyline", "Click to add points; right-click or double-click to finish");
        const btnCircle = createButton("Circle", "Click centre, move, click again to set radius");
        const btnDelete = createButton("Delete", "Delete mode: click shapes to remove");
        const btnDeleteAll = createButton("Delete all", "Delete all drawn shapes");

        btnDeleteAll.style.borderColor = "#dc2626";
        btnDeleteAll.style.color = "#b91c1c";

        modeButtons.marker = btnMarker;
        modeButtons.polyline = btnLine;
        modeButtons.circle = btnCircle;
        modeButtons.delete = btnDelete;

        btnMarker.addEventListener("click", () => setMode("marker"));
        btnLine.addEventListener("click", () => setMode("polyline"));
        btnCircle.addEventListener("click", () => setMode("circle"));
        btnDelete.addEventListener("click", () => setMode("delete"));
        btnDeleteAll.addEventListener("click", () => {
            if (!allShapes.length) return;
            if (!confirm("Delete all drawn shapes?")) return;
            clearInMemoryShapes(false);
        });

        controlDiv.appendChild(btnMarker);
        controlDiv.appendChild(btnLine);
        controlDiv.appendChild(btnCircle);

        const sep = document.createElement("div");
        Object.assign(sep.style, {
            borderTop: "1px solid #e5e7eb",
            margin: "2px 0"
        });
        controlDiv.appendChild(sep);

        controlDiv.appendChild(btnDelete);
        controlDiv.appendChild(btnDeleteAll);

        drawingControlDiv = controlDiv;
        drawingControlsPosition = null;
        applyControlPosition();
    }

    // -----------------------------
    // Projection helper + label DIVs
    // -----------------------------

    let projectionHelper = null;
    let mapProjection = null;
    let overlayOffset = { x: 0, y: 0 };

    let circleLabelDiv = null;
    let polyLabelDiv = null;

    function ensureProjectionHelper() {
        if (projectionHelper || !submitMap || !google.maps || !google.maps.OverlayView) return;

        function PH() {}
        PH.prototype = Object.create(google.maps.OverlayView.prototype);
        PH.prototype.onAdd = function () {};
        PH.prototype.onRemove = function () {};
        PH.prototype.draw = function () {
            const proj = this.getProjection();
            if (!proj || !submitMap) return;

            mapProjection = proj;

            // Calibrate offset: where does the map centre land in overlay pixels vs actual map div?
            const mapDiv = submitMap.getDiv();
            const rect = mapDiv.getBoundingClientRect();
            const centerLatLng = submitMap.getCenter();

            const overlayCenterPx = proj.fromLatLngToDivPixel(centerLatLng);
            if (!overlayCenterPx) return;

            const mapCenterX = rect.width / 2;
            const mapCenterY = rect.height / 2;

            overlayOffset = {
                x: mapCenterX - overlayCenterPx.x,
                y: mapCenterY - overlayCenterPx.y
            };
        };

        projectionHelper = new PH();
        projectionHelper.setMap(submitMap);
    }

    function ensureLabelDiv(kind) {
        if (!submitMap) return null;
        const mapDiv = submitMap.getDiv();
        if (!mapDiv) return null;

        // Ensure mapDiv is the positioning context
        const cs = getComputedStyle(mapDiv);
        if (cs.position === "static") {
            mapDiv.style.position = "relative";
        }

        if (kind === "circle") {
            if (!circleLabelDiv) {
                const div = document.createElement("div");
                Object.assign(div.style, {
                    position: "absolute",
                    transform: "translate(-50%, -50%)",
                    whiteSpace: "nowrap",
                    fontSize: "11px",
                    color: "#111827",
                    background: "transparent",
                    padding: "0",
                    border: "none",
                    pointerEvents: "none",
                    display: "none",
                    zIndex: "9999"
                });
                mapDiv.appendChild(div);
                circleLabelDiv = div;
            }
            return circleLabelDiv;
        } else if (kind === "polyline") {
            if (!polyLabelDiv) {
                const div = document.createElement("div");
                Object.assign(div.style, {
                    position: "absolute",
                    transform: "translate(-50%, -50%)",
                    whiteSpace: "nowrap",
                    fontSize: "11px",
                    color: "#111827",
                    background: "transparent",
                    padding: "0",
                    border: "none",
                    pointerEvents: "none",
                    display: "none",
                    zIndex: "9999"
                });
                mapDiv.appendChild(div);
                polyLabelDiv = div;
            }
            return polyLabelDiv;
        }
        return null;
    }

    function positionLabelDiv(div, fromLatLng, toLatLng, text) {
        if (!div || !fromLatLng || !toLatLng || !mapProjection) return;

        const cPx = mapProjection.fromLatLngToDivPixel(fromLatLng);
        const ePx = mapProjection.fromLatLngToDivPixel(toLatLng);
        if (!cPx || !ePx) return;

        const dx = ePx.x - cPx.x;
        const dy = ePx.y - cPx.y;

        let midX = cPx.x + dx * 0.5;
        let midY = cPx.y + dy * 0.5;

        const len = Math.sqrt(dx * dx + dy * dy) || 1;
        const off = 10;
        const offX = -dy / len * off;
        const offY = dx / len * off;

        midX += offX;
        midY += offY;

        // Adjust for the overlay→mapDiv offset
        midX += overlayOffset.x;
        midY += overlayOffset.y;

        div.style.left = midX + "px";
        div.style.top = midY + "px";
        div.textContent = text;
        div.style.display = "block";
    }

    function latLngFromClientXY(ev) {
        if (!submitMap || !mapProjection) return null;
        const mapDiv = submitMap.getDiv();
        const rect = mapDiv.getBoundingClientRect();

        // MapDiv → overlay pixel coordinates (undo the offset we apply for labels)
        const x = ev.clientX - rect.left - overlayOffset.x;
        const y = ev.clientY - rect.top - overlayOffset.y;

        return mapProjection.fromDivPixelToLatLng(new google.maps.Point(x, y));
    }


    // -----------------------------
    // Drawing click helpers
    // -----------------------------

    function enableMarkerMode() {
        if (!submitMap) return;

        drawingClickHandler = (latLng) => {
            const color = currentShapeColor;
            const marker = new google.maps.Marker({
                map: submitMap,
                position: latLng,
                icon: createMarkerIcon(color),
                clickable: false
            });

            const pos = { lat: latLng.lat(), lng: latLng.lng() };

            registerShape(marker, {
                type: "marker",
                position: pos,
                color
            });
        };

        const listener = submitMap.addListener("click", (ev) => {
            if (drawingClickHandler && ev && ev.latLng) {
                drawingClickHandler(ev.latLng);
            }
        });

        modeListeners.push(listener);
    }

    function enablePolylineMode() {
        if (!submitMap) return;

        ensureProjectionHelper();

        const color = currentShapeColor;
        const fixedPoints = []; // committed vertices
        const vertexMarkers = [];

        let tempPolyline = new google.maps.Polyline({
            map: submitMap,
            path: [],
            strokeColor: color,
            strokeWeight: 3,
            clickable: false
        });

        const labelDiv = ensureLabelDiv("polyline");

        function totalLengthMeters(points) {
            if (points.length < 2) return 0;
            let sum = 0;
            for (let i = 1; i < points.length; i++) {
                sum += distanceMeters(points[i - 1], points[i]);
            }
            return sum;
        }

        function clearVertexMarkers() {
            vertexMarkers.forEach(m => {
                try {
                    m.setMap(null);
                } catch {
                    // ignore
                }
            });
        }

        function finishPolyline() {
            const path = tempPolyline.getPath().getArray();
            if (path.length < 2) {
                tempPolyline.setMap(null);
                clearVertexMarkers();
            } else {
                const storedPath = path.map(ll => ({ lat: ll.lat(), lng: ll.lng() }));
                registerShape(tempPolyline, {
                    type: "polyline",
                    path: storedPath,
                    color
                });
                clearVertexMarkers();
            }
            if (labelDiv) {
                labelDiv.style.display = "none";
            }
            setMode(null);
        }

        // Check if a click is close (in screen pixels) to any existing vertex
        function isNearExistingVertex(latLng) {
            if (!mapProjection || !fixedPoints.length) return false;

            const clickPx = mapProjection.fromLatLngToDivPixel(latLng);
            if (!clickPx) return false;

            const threshold = 10; // pixels
            const thr2 = threshold * threshold;

            for (const v of fixedPoints) {
                const vPx = mapProjection.fromLatLngToDivPixel(v);
                if (!vPx) continue;
                const dx = vPx.x - clickPx.x;
                const dy = vPx.y - clickPx.y;
                if (dx * dx + dy * dy <= thr2) {
                    return true;
                }
            }
            return false;
        }

        function addVertexMarker(latLng) {
            const marker = new google.maps.Marker({
                map: submitMap,
                position: latLng,
                clickable: true,
                zIndex: 9999,
                cursor: "pointer",
                icon: {
                    // 8×8px square, centred on the point
                    path: "M -4 -4 L 4 -4 L 4 4 L -4 4 Z",
                    fillColor: "#ffffff",
                    fillOpacity: 1,
                    strokeColor: "#000000",
                    strokeWeight: 1,
                    anchor: new google.maps.Point(0, 0),
                    scale: 1
                },
                optimized: false
            });

            // Clicking the square behaves like clicking at that vertex
            marker.addListener("click", (ev) => {
                const pos = marker.getPosition();
                if (pos && drawingClickHandler) {
                    drawingClickHandler(pos);
                }
                if (ev && ev.domEvent) {
                    ev.domEvent.stopPropagation();
                    ev.domEvent.preventDefault();
                }
            });

            vertexMarkers.push(marker);
        }

        // Unified handler used for:
        // - map clicks
        // - POI marker snaps (attachMarkerClickCapture)
        // - white square clicks
        drawingClickHandler = (latLng) => {
            // If we already have a polyline and click near any existing vertex, terminate
            if (fixedPoints.length >= 2 && isNearExistingVertex(latLng)) {
                finishPolyline();
                return;
            }

            // Otherwise, add a new vertex
            fixedPoints.push(latLng);
            tempPolyline.setPath(fixedPoints);
            addVertexMarker(latLng);
        };

        const clickListener = submitMap.addListener("click", (ev) => {
            if (!drawingClickHandler || !ev || !ev.latLng) return;
            drawingClickHandler(ev.latLng);
        });

        const moveListener = submitMap.addListener("mousemove", (ev) => {
            if (!ev || !ev.latLng) return;
            if (!fixedPoints.length) return;

            const hover = ev.latLng;
            const path = fixedPoints.concat([hover]);
            tempPolyline.setPath(path);

            if (labelDiv) {
                const length = totalLengthMeters(path).toFixed(1);
                const last = fixedPoints[fixedPoints.length - 1];
                positionLabelDiv(labelDiv, last, hover, `${length} m`);
            }
        });

        const dblClickListener = submitMap.addListener("dblclick", (ev) => {
            if (ev && ev.stop) ev.stop();
            finishPolyline();
        });

        const rightClickListener = submitMap.addListener("rightclick", () => {
            finishPolyline();
        });

        modeListeners.push(clickListener, moveListener, dblClickListener, rightClickListener);
    }





    // distance between two LatLngs in meters
    function distanceMeters(a, b) {
        const R = 6371000;
        const lat1 = a.lat() * Math.PI / 180;
        const lat2 = b.lat() * Math.PI / 180;
        const dLat = (b.lat() - a.lat()) * Math.PI / 180;
        const dLng = (b.lng() - a.lng()) * Math.PI / 180;

        const sinDLat = Math.sin(dLat / 2);
        const sinDLng = Math.sin(dLng / 2);

        const r = sinDLat * sinDLat +
              Math.cos(lat1) * Math.cos(lat2) * sinDLng * sinDLng;

        const c = 2 * Math.atan2(Math.sqrt(r), Math.sqrt(1 - r));
        return R * c;
    }

    // -----------------------------
    // Circle mode with dotted radius + DOM label
    // -----------------------------

    function enableCircleMode() {
        if (!submitMap) return;

        if (isTouchDevice) {
            enableCircleModeTouch();
            return;
        }

        // --- existing desktop (mouse) behaviour ---
        ensureProjectionHelper();

        const color = currentShapeColor;
        let center = null;
        let tempCircle = null;
        let tempRadiusLine = null;

        const labelDiv = ensureLabelDiv("circle");

        drawingClickHandler = (latLng) => {
            if (!center) {
                center = latLng;

                tempCircle = new google.maps.Circle({
                    map: submitMap,
                    center,
                    radius: 0,
                    strokeColor: color,
                    strokeWeight: 2,
                    fillColor: color,
                    fillOpacity: 0.1,
                    clickable: false
                });

                tempRadiusLine = new google.maps.Polyline({
                    map: submitMap,
                    path: [center, center],
                    strokeOpacity: 0,
                    clickable: false,
                    icons: [{
                        icon: {
                            path: "M 0,-1 0,1",
                            strokeOpacity: 1,
                            scale: 2
                        },
                        offset: "0",
                        repeat: "10px"
                    }]
                });

                if (labelDiv) {
                    positionLabelDiv(labelDiv, center, center, "0.0 m");
                }
            } else {
                const edge = latLng;
                const radius = distanceMeters(center, edge);

                if (!tempCircle || radius <= 1) {
                    if (tempCircle) tempCircle.setMap(null);
                    if (tempRadiusLine) tempRadiusLine.setMap(null);
                } else {
                    tempCircle.setRadius(radius);
                    registerShape(tempCircle, {
                        type: "circle",
                        center: { lat: center.lat(), lng: center.lng() },
                        radius,
                        color
                    });
                    if (tempRadiusLine) tempRadiusLine.setMap(null);
                }

                if (labelDiv) {
                    labelDiv.style.display = "none";
                }

                setMode(null);
            }
        };

        const clickListener = submitMap.addListener("click", (ev) => {
            if (!drawingClickHandler || !ev || !ev.latLng) return;
            drawingClickHandler(ev.latLng);
        });

        const moveListener = submitMap.addListener("mousemove", (ev) => {
            if (!center || !tempCircle || !tempRadiusLine || !ev || !ev.latLng) return;

            const edge = ev.latLng;
            const radius = distanceMeters(center, edge);
            tempCircle.setRadius(radius);

            // end of the radius line slightly inside the circle edge
            const factor = 0.95;
            const lat = center.lat() + (edge.lat() - center.lat()) * factor;
            const lng = center.lng() + (edge.lng() - center.lng()) * factor;
            const endPoint = new google.maps.LatLng(lat, lng);

            tempRadiusLine.setPath([center, endPoint]);

            if (labelDiv) {
                const metres = radius.toFixed(1);
                positionLabelDiv(labelDiv, center, endPoint, `${metres} m`);
            }
        });

        modeListeners.push(clickListener, moveListener);
    }

    function enableCircleModeTouch() {
        if (!submitMap) return;

        ensureProjectionHelper();

        const color = currentShapeColor;
        const mapDiv = submitMap.getDiv();
        if (!mapDiv) return;

        let center = null;
        let tempCircle = null;
        let tempRadiusLine = null;
        let lastEdge = null;

        const labelDiv = ensureLabelDiv("circle");

        function latLngFromTouch(touch) {
            if (!submitMap || !mapProjection) return null;
            const rect = mapDiv.getBoundingClientRect();

            const x = touch.clientX - rect.left - overlayOffset.x;
            const y = touch.clientY - rect.top - overlayOffset.y;

            return mapProjection.fromDivPixelToLatLng(new google.maps.Point(x, y));
        }

        function onTouchStart(ev) {
            if (!isTouchDevice || currentMode !== "circle") return;
            if (!ev.touches || !ev.touches.length) return;

            ev.preventDefault();
            ev.stopPropagation();

            const touch = ev.touches[0];
            const latLng = latLngFromTouch(touch);
            if (!latLng) return;

            center = latLng;
            lastEdge = latLng;

            tempCircle = new google.maps.Circle({
                map: submitMap,
                center,
                radius: 0,
                strokeColor: color,
                strokeWeight: 2,
                fillColor: color,
                fillOpacity: 0.1,
                clickable: false
            });

            tempRadiusLine = new google.maps.Polyline({
                map: submitMap,
                path: [center, center],
                strokeOpacity: 0,
                clickable: false,
                icons: [{
                    icon: {
                        path: "M 0,-1 0,1",
                        strokeOpacity: 1,
                        scale: 2
                    },
                    offset: "0",
                    repeat: "10px"
                }]
            });

            if (labelDiv) {
                positionLabelDiv(labelDiv, center, center, "0.0 m");
            }
        }

        function onTouchMove(ev) {
            if (!center || !tempCircle || !tempRadiusLine) return;
            if (!ev.touches || !ev.touches.length) return;

            ev.preventDefault();
            ev.stopPropagation();

            const touch = ev.touches[0];
            const edge = latLngFromTouch(touch);
            if (!edge) return;

            lastEdge = edge;

            const radius = distanceMeters(center, edge);
            tempCircle.setRadius(radius);

            const factor = 0.95;
            const lat = center.lat() + (edge.lat() - center.lat()) * factor;
            const lng = center.lng() + (edge.lng() - center.lng()) * factor;
            const endPoint = new google.maps.LatLng(lat, lng);

            tempRadiusLine.setPath([center, endPoint]);

            if (labelDiv) {
                const metres = radius.toFixed(1);
                positionLabelDiv(labelDiv, center, endPoint, `${metres} m`);
            }
        }

        function onTouchEnd(ev) {
            if (!center || !tempCircle) {
                setMode(null);
                return;
            }

            ev.preventDefault();
            ev.stopPropagation();

            const edge = lastEdge || center;
            const radius = distanceMeters(center, edge);

            if (!tempCircle || radius <= 1) {
                if (tempCircle) tempCircle.setMap(null);
                if (tempRadiusLine) tempRadiusLine.setMap(null);
            } else {
                tempCircle.setRadius(radius);
                registerShape(tempCircle, {
                    type: "circle",
                    center: { lat: center.lat(), lng: center.lng() },
                    radius,
                    color
                });
                if (tempRadiusLine) tempRadiusLine.setMap(null);
            }

            if (labelDiv) {
                labelDiv.style.display = "none";
            }

            setMode(null); // cleans up listeners via clearModeListeners
        }

        // Capture touches on the map DIV before Google Maps sees them
        addDomModeListener(mapDiv, "touchstart", onTouchStart, { passive: false, capture: true });
        addDomModeListener(mapDiv, "touchmove", onTouchMove, { passive: false, capture: true });
        addDomModeListener(mapDiv, "touchend", onTouchEnd, { passive: false, capture: true });
        addDomModeListener(mapDiv, "touchcancel", onTouchEnd, { passive: false, capture: true });
    }


    // -----------------------------
    // Global DOM capture for clicks on markers (snap)
    // -----------------------------

    function attachMarkerClickCapture() {
        if (document._wfDrawingToolsCaptureAttached) return;
        document._wfDrawingToolsCaptureAttached = true;

        document.addEventListener("click", (ev) => {
            // Only active when a drawing mode is on and we have a handler
            if (!currentMode || !drawingClickHandler || !submitMap) return;

            const mapDiv = submitMap.getDiv();
            if (!mapDiv) return;
            if (!mapDiv.contains(ev.target)) return;

            // Only intercept *Google* marker / POI images
            if (!(ev.target instanceof HTMLImageElement)) return;
            const src = ev.target.src || "";
            // POI/marker images are usually served from gstatic/googleapis
            if (!/gstatic\.com|googleapis\.com/i.test(src)) return;

            ensureProjectionHelper();
            if (!mapProjection) return;

            const latLng = latLngFromClientXY(ev);
            if (!latLng) return;

            // Stop the original click so Maps doesn't do its default marker behaviour
            ev.stopPropagation();
            ev.preventDefault();

            // Treat the marker click as a drawing click at that LatLng
            drawingClickHandler(latLng);
        }, true);
    }

    // -----------------------------
    // Plugin bootstrap
    // -----------------------------

    function bootstrap() {
        loadSettings();
        startMapPanelWatcher();
    }

    bootstrap();

})();
