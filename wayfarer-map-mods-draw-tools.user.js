// ==UserScript==
// @name         Wayfarer Map Mods - Draw Tools
// @version      3.0.0
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



    // =============================
    // Constants and environment
    // =============================

    const SETTINGS_KEY = "wfmap_drawing_tools_settings";

    const SUBMIT_ROUTE = "/new/submit/new";
    const MAPVIEW_ROUTE = "/new/mapview";

    // panel polling for settings link injection
    const SETTINGS_LINK_POLL_MS = 300;
    const SETTINGS_LINK_MAX_TRIES = 60;

    // polyline finish behaviour
    const VERTEX_SNAP_PX = 10;

    // tiny-shape discard threshold
    const MIN_LENGTH_METERS = 1;

    // UI z-indexes
    const DRAWING_MODAL_ZINDEX = 8000;
    const LABEL_ZINDEX = 9999;

    // One-time environment detection (computed constant)
    const isTouchDevice = !!(
        "ontouchstart" in window ||
        (navigator && (navigator.maxTouchPoints > 0 || navigator.msMaxTouchPoints > 0))
    );

    // Cross-script exclusive toggle
    const WF_TOGGLE_GROUP = "wf-lefttop-controls";
    const WF_TOGGLE_ACTIVE_CLASS = "wf-toggle-active";
    let wfGlobalToggleObserver = null;

    // =============================
    // Mutable state
    // =============================

    // -----------------------------
    // Map attachment state
    // -----------------------------
    let wfMap = null;
    let mapAttached = false;

    let mapPanelObserver = null;
    let mapPanelMutationScheduled = false;

    // -----------------------------
    // UI: controls + toggles
    // -----------------------------
    let drawingControlsAdded = false;
    let drawingControlDiv = null;
    let drawingControlsPosition = null;

    let layersOptionCheckbox = null;
    const modeButtons = {};          // static container; contents mutate
    let pinHideStyleInjected = false;

    // -----------------------------
    // Drawing: mode + listeners
    // -----------------------------
    let currentMode = null;          // "marker"|"arrow"|"polyline"|"circle"|"delete"|null
    let deleteMode = false;

    let modeListeners = [];
    let domModeListeners = [];
    let drawingClickHandler = null;

    let cancelCurrentDrawing = null;
    let escapeHandlerAttached = false;

    // -----------------------------
    // Drawing: shape registry
    // -----------------------------
    let allShapes = [];
    let currentShapeColor = "#ff0000";

    // -----------------------------
    // Geometry / overlay helpers
    // -----------------------------
    let projectionHelper = null;
    let mapProjection = null;
    let overlayOffset = { x: 0, y: 0 };

    let circleLabelDiv = null;
    let polyLabelDiv = null;

    // -----------------------------
    // Settings model
    // -----------------------------
    const userSettings = {};

    // -----------------------------
    // Settings and persistence
    // -----------------------------

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
    // Exclusive toggle
    // -----------------------------

    // When a draw tools button is clicked, it disables other active toggles from other scripts
    // e.g. Submission pin toggle on Mapview page (WFMM Base)
    function wfExclusiveToggle(buttonEl, group = WF_TOGGLE_GROUP) {
        if (!buttonEl) return false;

        buttonEl.dataset.wfToggleGroup = group;

        const isActive = buttonEl.classList.contains(WF_TOGGLE_ACTIVE_CLASS);
        if (isActive) {
            buttonEl.classList.remove(WF_TOGGLE_ACTIVE_CLASS);
            return false;
        }

        document
            .querySelectorAll(`[data-wf-toggle-group="${group}"].${WF_TOGGLE_ACTIVE_CLASS}`)
            .forEach((el) => {
            if (el !== buttonEl) el.classList.remove(WF_TOGGLE_ACTIVE_CLASS);
        });

        buttonEl.classList.add(WF_TOGGLE_ACTIVE_CLASS);
        return true;
    }

    function attachGlobalToggleObserver() {
        if (wfGlobalToggleObserver) return;

        wfGlobalToggleObserver = new MutationObserver((mutations) => {
            // If we have no active drawing mode, nothing to do
            if (!currentMode) return;

            // Is any draw-mode button currently active?
            const activeDrawBtn = Object.values(modeButtons).find((b) =>
                                                                  b?.classList?.contains(WF_TOGGLE_ACTIVE_CLASS)
                                                                 );

            // If our draw button lost active state, another plugin stole it → turn off drawing
            if (!activeDrawBtn) {
                setMode(null);
            }
        });

        wfGlobalToggleObserver.observe(document.body, {
            subtree: true,
            attributes: true,
            attributeFilter: ["class"],
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

    function handlePanelChange() {
        const panelPresent = !!document.querySelector("#wfmapmods-side-panel");

        if (panelPresent) {
            attachDrawingToolsToMapIfNeeded();
            insertDrawingSettingsLink();
            insertDrawingLayersOption();
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

    async function attachDrawingToolsToMapIfNeeded() {
        // If we think we're attached, but the map div is gone, treat as detached
        if (mapAttached && wfMap && wfMap.getDiv && wfMap.getDiv()?.isConnected) {
            return;
        }

        // We were "attached" but the old map is gone
        if (mapAttached) {
            teardownMap();
        }

        const map = await getWfMap();
        if (!map) {
            console.warn("[DrawingTools] Map not found – cannot attach");
            return;
        }

        wfMap = map;
        initDrawingTools();
        mapAttached = true;
    }


    function teardownMap() {
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
        wfMap = null;
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

    // -----------------------------
    // UI: Settings link + modal
    // -----------------------------

    function insertDrawingSettingsLink() {
        let tries = 0;
        const panelCheck = setInterval(() => {
            if (++tries > SETTINGS_LINK_MAX_TRIES) { clearInterval(panelCheck); return; }

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
        }, SETTINGS_LINK_POLL_MS);
    }

    function openDrawingSettingsWindow() {
        if (document.getElementById("wfmapmods-drawing-modal-backdrop")) return;

        const drawingSettings = userSettings.drawing || {};
        const currentColor = drawingSettings.color || "#ff0000";
        const currentEnabled = drawingSettings.enabled !== false;
        const currentPosition = drawingSettings.position || "left";

        const backdrop = document.createElement("div");
        backdrop.id = "wfmapmods-drawing-modal-backdrop";
        backdrop.className = "wfmapmods-modal-backdrop";

        const dialog = document.createElement("div");
        dialog.className = "wfmapmods-modal";

        const title = document.createElement("div");
        title.className = "wfmapmods-modal__title";
        title.textContent = "Drawing Tool Settings";
        dialog.appendChild(title);

        function makeRow(labelText, inputEl) {
            const row = document.createElement("div");
            row.className = "wfmapmods-modal__row";

            const label = document.createElement("label");
            label.className = "wfmapmods-modal__label";
            label.textContent = labelText;

            inputEl.classList.add("wfmapmods-modal__control");

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
        hint.className = "wfmapmods-modal__hint";
        hint.textContent = "New shapes will use this colour. Existing shapes keep their original colour.";
        dialog.appendChild(hint);

        const buttonsRow = document.createElement("div");
        buttonsRow.className = "wfmapmods-modal__buttons";

        const cancelBtn = document.createElement("button");
        cancelBtn.type = "button";
        cancelBtn.textContent = "Cancel";
        cancelBtn.className = "wfmapmods-btn";

        const okBtn = document.createElement("button");
        okBtn.type = "button";
        okBtn.textContent = "OK";
        okBtn.className = "wfmapmods-btn wfmapmods-btn--primary";

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

            if (wfMap) {
                applyDrawingEnabledState();
            }

            closeModal();
        });

        function escHandler(ev) {
            if (ev.key === "Escape") closeModal();
            if (ev.key === "Enter") { ev.preventDefault(); okBtn.click(); }
        }

        function closeModal() {
            document.removeEventListener("keydown", escHandler);
            backdrop.remove();
        }

        document.addEventListener("keydown", escHandler);

        backdrop.addEventListener("click", (ev) => {
            if (ev.target === backdrop) {
                closeModal();
            }
        });

        backdrop.appendChild(dialog);
        document.body.appendChild(backdrop);
    }

    // -----------------------------
    // UI: Layers menu option
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
    // UI: Map controls
    // -----------------------------

    function createButton(text, title, extraClass = "") {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.textContent = text;
        btn.title = title;
        btn.className = `wfmapmods-draw-btn ${extraClass}`.trim();
        return btn;
    }

    function createDrawingControls() {
        if (drawingControlsAdded) return;
        drawingControlsAdded = true;

        const controlDiv = document.createElement("div");
        controlDiv.className = "wfmapmods-draw-controls";

        const title = document.createElement("div");
        title.className = "wfmapmods-draw-controls__title";
        title.textContent = "Draw";
        controlDiv.appendChild(title);

        const btnMarker = createButton("Marker", "Click the map to add markers");
        const btnArrow = createButton("Arrow", "Click start, move, click end to place an arrow");
        const btnLine = createButton("Polyline", "Click to add points; right-click or double-click to finish");
        const btnCircle = createButton("Circle", "Click centre, move, click again to set radius");
        const btnDelete = createButton("Delete", "Delete mode: click shapes to remove", "wfmapmods-draw-btn--delete");
        const btnDeleteAll = createButton("Delete all", "Delete all drawn shapes", "wfmapmods-draw-btn--danger");

        [btnMarker, btnArrow, btnLine, btnCircle, btnDelete].forEach((b) => {
            b.dataset.wfToggleGroup = WF_TOGGLE_GROUP;
        });

        modeButtons.marker = btnMarker;
        modeButtons.arrow = btnArrow;
        modeButtons.polyline = btnLine;
        modeButtons.circle = btnCircle;
        modeButtons.delete = btnDelete;

        btnMarker.addEventListener("click", () => onModeButtonClick("marker"));
        btnArrow.addEventListener("click", () => onModeButtonClick("arrow"));
        btnLine.addEventListener("click", () => onModeButtonClick("polyline"));
        btnCircle.addEventListener("click", () => onModeButtonClick("circle"));
        btnDelete.addEventListener("click", () => onModeButtonClick("delete"));
        btnDeleteAll.addEventListener("click", () => {
            if (!allShapes.length) return;
            if (!confirm("Delete all drawn shapes?")) return;
            clearInMemoryShapes(false);
        });

        controlDiv.appendChild(btnMarker);
        controlDiv.appendChild(btnArrow);
        controlDiv.appendChild(btnLine);
        controlDiv.appendChild(btnCircle);

        const sep = document.createElement("div");
        sep.className = "wfmapmods-draw-sep";
        controlDiv.appendChild(sep);

        controlDiv.appendChild(btnDelete);
        controlDiv.appendChild(btnDeleteAll);

        drawingControlDiv = controlDiv;
        drawingControlsPosition = null;
        applyControlPosition();
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

        const posSetting = (userSettings.drawing || {}).position || "left";
        drawingControlDiv.classList.toggle(
            "is-horizontal",
            posSetting === "top" || posSetting === "bottom"
        );
    }

    function applyControlPosition() {
        if (!wfMap || !drawingControlDiv) return;

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
            const arr = wfMap.controls[drawingControlsPosition];
            const a = arr.getArray();
            const idx = a.indexOf(drawingControlDiv);
            if (idx > -1) {
                arr.removeAt(idx);
            }
        }

        drawingControlsPosition = newPos;
        wfMap.controls[newPos].push(drawingControlDiv);

        // Adjust flex layout for the new position
        updateControlsLayout();
    }

    // =============================
    // Core drawing state and management
    // =============================

    // -----------------------------
    // Mode handling and listeners
    // -----------------------------

    function isTypingTarget(el) {
        if (!el) return false;
        const tag = (el.tagName || "").toLowerCase();
        return tag === "input" || tag === "textarea" || tag === "select" || el.isContentEditable;
    }

    function attachEscapeToCancelHandler() {
        if (escapeHandlerAttached) return;
        escapeHandlerAttached = true;

        document.addEventListener("keydown", (ev) => {
            if (ev.key !== "Escape") return;

            // Only when a drawing mode is active (don’t interfere with other UI)
            if (!currentMode) return;

            // Avoid hijacking Escape while typing in inputs
            if (isTypingTarget(ev.target)) return;

            // Avoid fighting your own settings modal or any other modal/backdrop
            if (document.getElementById("wfmapmods-drawing-modal-backdrop")) return;

            // If the plugin is disabled, do nothing
            ensureDrawingDefaults();
            if (userSettings.drawing.enabled === false) return;

            // Cancel any partially drawn object first
            if (typeof cancelCurrentDrawing === "function") {
                try { cancelCurrentDrawing(); } catch { /* ignore */ }
            }

            // Deselect the tool + clean up listeners/UI
            setMode(null);

            ev.preventDefault();
            ev.stopPropagation();
        }, true); // capture so we get it early
    }

    function addDomModeListener(target, type, handler, options) {
        const opts = options || false;
        target.addEventListener(type, handler, opts);
        domModeListeners.push({ target, type, handler, options: opts });
    }

    function clearModeListeners() {
        modeListeners.forEach(l => google.maps.event.removeListener(l));
        modeListeners = [];

        domModeListeners.forEach(info => {
            try {
                info.target.removeEventListener(info.type, info.handler, info.options || false);
            } catch { /* ignore */ }
        });
        domModeListeners = [];

        drawingClickHandler = null;
        cancelCurrentDrawing = null;
    }

    function setMode(newMode) {
        if (newMode === currentMode) {
            newMode = null; // toggle off
        }

        clearModeListeners();

        currentMode = newMode;
        deleteMode = (newMode === "delete");

        // Sync shared toggle class to the current mode
        Object.entries(modeButtons).forEach(([mode, btn]) => {
            btn.classList.toggle(WF_TOGGLE_ACTIVE_CLASS, mode === currentMode && !!currentMode);
        });

        updateSelectionPinVisibility();
        refreshOverlayClickability();

        if (wfMap) {
            wfMap.setOptions({
                draggableCursor: newMode ? "crosshair" : null
            });
        }

        if (!wfMap) return;

        if (newMode === "marker") {
            enableMarkerMode();
        } else if (newMode === "polyline") {
            enablePolylineMode();
        } else if (newMode === "circle") {
            enableCircleMode();
        } else if (newMode === "arrow") {
            enableArrowMode();
        }

    }

    function onModeButtonClick(mode) {
        const btn = modeButtons[mode];
        if (!btn) return;

        // If clicking the already-active mode, toggle off
        const alreadyActive = btn.classList.contains(WF_TOGGLE_ACTIVE_CLASS);
        if (alreadyActive) {
            btn.classList.remove(WF_TOGGLE_ACTIVE_CLASS);
            setMode(null);
            return;
        }

        // Turn off other plugin toggles + make this the single active toggle
        wfExclusiveToggle(btn, WF_TOGGLE_GROUP);

        // Now enable the mode
        setMode(mode);
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

        if (!wfMap) return;

        if (!enabled) {
            // Hide controls
            if (drawingControlDiv && drawingControlsPosition != null) {
                const arr = wfMap.controls[drawingControlsPosition];
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
            createDrawingControls();
        } else {
            applyControlPosition();
        }

        // Rebuild shapes from saved settings
        rebuildShapesFromSettings();
    }

    function updateSelectionPinVisibility() {
        if (currentMode) {
            document.body.classList.add("wf-drawing-active");
        } else {
            document.body.classList.remove("wf-drawing-active");
        }
    }

    // -----------------------------
    // Shape registry and persistence
    // -----------------------------

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

        const rebuilders = {
            marker: recreateMarker,
            polyline: recreatePolyline,
            circle: recreateCircle,
            arrow: recreateArrow
        };

        savedShapes.forEach(data => {
            const type = data && data.type;
            const rebuild = rebuilders[type];

            if (!rebuild) return;

            try {
                rebuild(data);
            } catch (e) {
                console.error("[DrawingTools] Failed to recreate shape:", e, data);
            }
        });

        persistShapes();
    }

    // -----------------------------
    // Shape reconstruction helpers
    // -----------------------------

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

    function createArrowPolylineOptions(color) {
        return {
            strokeColor: color,
            strokeWeight: 3,
            clickable: false,
            icons: [{
                icon: {
                    path: google.maps.SymbolPath.FORWARD_CLOSED_ARROW,
                    strokeColor: color,
                    fillColor: color,
                    fillOpacity: 1,
                    strokeWeight: 1,
                    scale: 3
                },
                offset: "100%"
            }]
        };
    }

    function recreateMarker(data) {
        const color = data.color || currentShapeColor;
        const marker = new google.maps.Marker({
            map: wfMap,
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
            map: wfMap,
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
            map: wfMap,
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

    function recreateArrow(data) {
        const color = data.color || currentShapeColor;

        const start = new google.maps.LatLng(data.start.lat, data.start.lng);
        const end   = new google.maps.LatLng(data.end.lat, data.end.lng);

        const arrow = new google.maps.Polyline({
            map: wfMap,
            path: [start, end],
            ...createArrowPolylineOptions(color)
        });

        registerShape(arrow, {
            type: "arrow",
            start: data.start,
            end: data.end,
            color
        }, true);
    }

    // =============================
    // Geometry and overlay helpers
    // =============================

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

    function ensureProjectionHelper() {
        if (projectionHelper || !wfMap || !google.maps || !google.maps.OverlayView) return;

        function PH() {}
        PH.prototype = Object.create(google.maps.OverlayView.prototype);
        PH.prototype.onAdd = function () {};
        PH.prototype.onRemove = function () {};
        PH.prototype.draw = function () {
            const proj = this.getProjection();
            if (!proj || !wfMap) return;

            mapProjection = proj;

            // Calibrate offset: where does the map centre land in overlay pixels vs actual map div?
            const mapDiv = wfMap.getDiv();
            const rect = mapDiv.getBoundingClientRect();
            const centerLatLng = wfMap.getCenter();

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
        projectionHelper.setMap(wfMap);
    }

    function ensureLabelDiv(kind) {
        if (!wfMap) return null;
        const mapDiv = wfMap.getDiv();
        if (!mapDiv) return null;

        // Ensure mapDiv is the positioning context
        const cs = getComputedStyle(mapDiv);
        if (cs.position === "static") {
            mapDiv.style.position = "relative";
        }

        if (kind === "circle") {
            if (!circleLabelDiv) {
                const div = document.createElement("div");
                div.className = "wfmapmods-measure-label";
                mapDiv.appendChild(div);
                circleLabelDiv = div;
            }
            return circleLabelDiv;
        } else if (kind === "polyline") {
            if (!polyLabelDiv) {
                const div = document.createElement("div");
                div.className = "wfmapmods-measure-label";
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
        if (!wfMap || !mapProjection) return null;
        const mapDiv = wfMap.getDiv();
        const rect = mapDiv.getBoundingClientRect();

        // MapDiv → overlay pixel coordinates (undo the offset we apply for labels)
        const x = ev.clientX - rect.left - overlayOffset.x;
        const y = ev.clientY - rect.top - overlayOffset.y;

        return mapProjection.fromDivPixelToLatLng(new google.maps.Point(x, y));
    }

    // =============================
    // Drawing mode implementations
    // =============================

    function enableMarkerMode() {
        if (!wfMap) return;

        cancelCurrentDrawing = () => {}; // nothing to cancel, Escape will just deselect

        drawingClickHandler = (latLng) => {
            const color = currentShapeColor;
            const marker = new google.maps.Marker({
                map: wfMap,
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

        const listener = wfMap.addListener("click", (ev) => {
            if (drawingClickHandler && ev && ev.latLng) {
                drawingClickHandler(ev.latLng);
            }
        });

        modeListeners.push(listener);
    }

    function enableArrowMode() {
        if (!wfMap) return;

        ensureProjectionHelper();

        const color = currentShapeColor;
        let start = null;
        let tempArrow = null;

        const labelDiv = ensureLabelDiv("polyline"); // reuse the polyline label div if you like

        function finishArrow(endLatLng) {
            if (!start || !endLatLng || !tempArrow) {
                setMode(null);
                return;
            }

            const s = { lat: start.lat(), lng: start.lng() };
            const e = { lat: endLatLng.lat(), lng: endLatLng.lng() };

            // If basically zero-length, discard
            const radius = distanceMeters(start, endLatLng);
            if (radius <= MIN_LENGTH_METERS) {
                tempArrow.setMap(null);
                if (labelDiv) labelDiv.style.display = "none";
                setMode(null);
                return;
            }

            tempArrow.setPath([start, endLatLng]);

            registerShape(tempArrow, {
                type: "arrow",
                start: s,
                end: e,
                color
            });

            if (labelDiv) labelDiv.style.display = "none";
            setMode(null);
        }

        cancelCurrentDrawing = () => {
            try { tempArrow && tempArrow.setMap(null); } catch {}
            if (labelDiv) labelDiv.style.display = "none";
            start = null;
            tempArrow = null;
        };

        drawingClickHandler = (latLng) => {
            if (!start) {
                start = latLng;

                tempArrow = new google.maps.Polyline({
                    map: wfMap,
                    path: [start, start],
                    ...createArrowPolylineOptions(color)
                });

                if (labelDiv) {
                    positionLabelDiv(labelDiv, start, start, "0.0 m");
                }
                return;
            }

            finishArrow(latLng);
        };

        const clickListener = wfMap.addListener("click", (ev) => {
            if (!drawingClickHandler || !ev || !ev.latLng) return;
            drawingClickHandler(ev.latLng);
        });

        const moveListener = wfMap.addListener("mousemove", (ev) => {
            if (!start || !tempArrow || !ev || !ev.latLng) return;

            const end = ev.latLng;
            tempArrow.setPath([start, end]);

            if (labelDiv) {
                const metres = distanceMeters(start, end).toFixed(1);
                positionLabelDiv(labelDiv, start, end, `${metres} m`);
            }
        });

        const rightClickListener = wfMap.addListener("rightclick", () => {
            // cancel if they haven’t placed an end yet
            if (tempArrow) tempArrow.setMap(null);
            if (labelDiv) labelDiv.style.display = "none";
            setMode(null);
        });

        modeListeners.push(clickListener, moveListener, rightClickListener);
    }

    function enablePolylineMode() {
        if (!wfMap) return;

        ensureProjectionHelper();

        const color = currentShapeColor;
        const fixedPoints = []; // committed vertices
        const vertexMarkers = [];

        let tempPolyline = new google.maps.Polyline({
            map: wfMap,
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

            const threshold = VERTEX_SNAP_PX;
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
                map: wfMap,
                position: latLng,
                clickable: true,
                zIndex: DRAWING_MODAL_ZINDEX,
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

        cancelCurrentDrawing = () => {
            try { tempPolyline && tempPolyline.setMap(null); } catch {}
            try { clearVertexMarkers(); } catch {}
            if (labelDiv) labelDiv.style.display = "none";
        };

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

        const clickListener = wfMap.addListener("click", (ev) => {
            if (!drawingClickHandler || !ev || !ev.latLng) return;
            drawingClickHandler(ev.latLng);
        });

        const moveListener = wfMap.addListener("mousemove", (ev) => {
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

        const dblClickListener = wfMap.addListener("dblclick", (ev) => {
            if (ev && ev.stop) ev.stop();
            finishPolyline();
        });

        const rightClickListener = wfMap.addListener("rightclick", () => {
            finishPolyline();
        });

        modeListeners.push(clickListener, moveListener, dblClickListener, rightClickListener);
    }

    function enableCircleMode() {
        if (!wfMap) return;

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
                    map: wfMap,
                    center,
                    radius: 0,
                    strokeColor: color,
                    strokeWeight: 2,
                    fillColor: color,
                    fillOpacity: 0.1,
                    clickable: false
                });

                tempRadiusLine = new google.maps.Polyline({
                    map: wfMap,
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

        cancelCurrentDrawing = () => {
            try { tempCircle && tempCircle.setMap(null); } catch {}
            try { tempRadiusLine && tempRadiusLine.setMap(null); } catch {}
            if (labelDiv) labelDiv.style.display = "none";
            center = null;
            tempCircle = null;
            tempRadiusLine = null;
        };

        const clickListener = wfMap.addListener("click", (ev) => {
            if (!drawingClickHandler || !ev || !ev.latLng) return;
            drawingClickHandler(ev.latLng);
        });

        const moveListener = wfMap.addListener("mousemove", (ev) => {
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
        if (!wfMap) return;

        ensureProjectionHelper();

        const color = currentShapeColor;
        const mapDiv = wfMap.getDiv();
        if (!mapDiv) return;

        let center = null;
        let tempCircle = null;
        let tempRadiusLine = null;
        let lastEdge = null;

        const labelDiv = ensureLabelDiv("circle");

        function latLngFromTouch(touch) {
            if (!wfMap || !mapProjection) return null;
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
                map: wfMap,
                center,
                radius: 0,
                strokeColor: color,
                strokeWeight: 2,
                fillColor: color,
                fillOpacity: 0.1,
                clickable: false
            });

            tempRadiusLine = new google.maps.Polyline({
                map: wfMap,
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

        cancelCurrentDrawing = () => {
            try { tempCircle && tempCircle.setMap(null); } catch {}
            try { tempRadiusLine && tempRadiusLine.setMap(null); } catch {}
            if (labelDiv) labelDiv.style.display = "none";
            center = null;
            tempCircle = null;
            tempRadiusLine = null;
            lastEdge = null;
        };

        // Capture touches on the map DIV before Google Maps sees them
        addDomModeListener(mapDiv, "touchstart", onTouchStart, { passive: false, capture: true });
        addDomModeListener(mapDiv, "touchmove", onTouchMove, { passive: false, capture: true });
        addDomModeListener(mapDiv, "touchend", onTouchEnd, { passive: false, capture: true });
        addDomModeListener(mapDiv, "touchcancel", onTouchEnd, { passive: false, capture: true });
    }

    // =============================
    // Global capture hooks
    // =============================

    function attachMarkerClickCapture() {
        if (document._wfDrawingToolsCaptureAttached) return;
        document._wfDrawingToolsCaptureAttached = true;

        document.addEventListener("click", (ev) => {
            // Only active when a drawing mode is on and we have a handler
            if (!currentMode || !drawingClickHandler || !wfMap) return;

            const mapDiv = wfMap.getDiv();
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

    // =============================
    // Css styles
    // =============================

    function injectDrawingToolsCSS() {
        const STYLE_ID = "wfmap-drawing-tools-css";
        if (document.getElementById(STYLE_ID)) return;

        const style = document.createElement("style");
        style.id = STYLE_ID;
        style.textContent = `
/* ============================
   Drawing tools: controls panel
   ============================ */
.wfmapmods-draw-controls {
  background: rgba(255,255,255,0.9);
  border-radius: 6px;
  padding: 4px;
  margin: 10px;
  box-shadow: 0 1px 4px rgba(0,0,0,0.3);
  display: flex;
  flex-direction: column;
  align-items: stretch;
  font-family: Roboto, Arial, sans-serif;
  user-select: none;
}

.wfmapmods-draw-controls.is-horizontal {
  flex-direction: row;
  align-items: center;
}

.wfmapmods-draw-controls__title {
  font-size: 11px;
  font-weight: 600;
  margin-bottom: 2px;
  text-align: center;
  color: #6b7280;
}

.wfmapmods-draw-controls.is-horizontal .wfmapmods-draw-controls__title {
  margin-bottom: 0;
  margin-right: 6px;
}

.wfmapmods-draw-sep {
  border-top: 1px solid #e5e7eb;
  margin: 2px 0;
}

/* ============================
   Buttons
   ============================ */
.wfmapmods-draw-btn {
  padding: 4px 6px;
  margin: 2px;
  font-size: 11px;
  border-radius: 4px;
  border: 1px solid #d1d5db;
  background: #ffffff;
  cursor: pointer;
  color: #111827;
  line-height: 1.2;
  text-align: center;
  font-family: Roboto, Arial, sans-serif;
  -webkit-tap-highlight-color: transparent;
}

.wfmapmods-draw-btn:hover { background: #f3f4f6; }

.wfmapmods-draw-btn:focus {
  outline: none;
  box-shadow: 0 0 0 2px rgba(37, 99, 235, 0.25);
}

.wfmapmods-draw-btn--danger {
  border-color: #dc2626;
  color: #b91c1c;
}
.wfmapmods-draw-btn--danger:hover {
  background: rgba(220, 38, 38, 0.08);
}

.wfmapmods-draw-btn--delete.wf-toggle-active {
  border-color: #dc2626 !important;
}

/* Your shared exclusive-toggle ON state */
.wf-toggle-active {
  background-color: #ffce04 !important;
  border-color: #ffce04 !important;
  color: #000000 !important;
}

/* ============================
   Modal (settings)
   ============================ */
.wfmapmods-modal-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.35);
  z-index: 2000;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow-y: auto;
  padding: 12px 0;
}

.wfmapmods-modal {
  background: #ffffff;
  border-radius: 8px;
  box-shadow: 0 10px 25px rgba(0,0,0,0.35);
  width: 260px;
  max-width: calc(100% - 32px);
  padding: 10px 12px 8px;
  box-sizing: border-box;
  font-family: Roboto, Arial, sans-serif;
  font-size: 12px;
  color: #111827;
  max-height: 90vh;
  overflow-y: auto;
}

.wfmapmods-modal__title {
  font-size: 15px;
  font-weight: 600;
  margin-bottom: 10px;
}

.wfmapmods-modal__row {
  display: flex;
  align-items: center;
  margin-bottom: 6px;
  gap: 6px;
}

.wfmapmods-modal__label {
  flex: 0 0 120px;
  font-size: 11px;
  color: #374151;
}

.wfmapmods-modal__control {
  flex: 1 0 auto;
}

.wfmapmods-modal__hint {
  font-size: 11px;
  color: #6b7280;
  margin: 2px 0 8px;
}

.wfmapmods-modal__buttons {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 4px;
}

.wfmapmods-btn {
  padding: 4px 10px;
  border-radius: 4px;
  border: 1px solid #d1d5db;
  background: #ffffff;
  cursor: pointer;
  font-size: 12px;
}

.wfmapmods-btn--primary {
  padding: 4px 12px;
  border-color: #2563eb;
  background: #2563eb;
  color: #ffffff;
}

/* ============================
   Measure labels (circle/line)
   ============================ */
.wfmapmods-measure-label {
  position: absolute;
  transform: translate(-50%, -50%);
  white-space: nowrap;
  font-size: 11px;
  color: #111827;
  background: transparent;
  padding: 0;
  border: none;
  pointer-events: none;
  display: none;
  z-index: ${LABEL_ZINDEX};
}

/* Hide selection pin while drawing */
body.wf-drawing-active img[src$="map_selection_pin.svg"] {
  display: none !important;
}
`;
        document.head.appendChild(style);
    }

    // =============================
    // Initialisation
    // =============================

    function initDrawingTools() {
        if (!wfMap) return;

        ensureDrawingDefaults();
        currentShapeColor = userSettings.drawing.color || "#ff0000";

        ensureProjectionHelper();
        attachMarkerClickCapture();
        attachEscapeToCancelHandler();

        applyDrawingEnabledState();

        attachGlobalToggleObserver();

        wfMap._wfDrawingToolsInitialised = true;
    }

    function bootstrap() {
        loadSettings();
        setupMapRouteWatcher();
        injectDrawingToolsCSS();
    }

    bootstrap();

})();
