// ==UserScript==
// @name         Wayfarer Map - s2 Cells
// @version      0.1.0
// @description  Feature enhancement for the submission map
// @namespace    https://gitlab.com/Tntnnbltn/wayfarer-addons
// @downloadURL  https://gitlab.com/Tntnnbltn/wayfarer-addons/-/raw/main/wayfarer-map-s2-cells.user.js
// @homepageURL  https://gitlab.com/Tntnnbltn/wayfarer-addons
// @match        https://wayfarer.nianticlabs.com/*
// @run-at       document-start
// ==/UserScript==

(function() {
    'use strict';

    let submitMap = null;
    let s2Overlay = null;
    let poiCellPolygons = [];
    let s2Pois = [];
    const POI_CELL_LEVEL = 17;
    let mapAttached = false;
    let idleListener = null;
    let zoomListener = null;

    // Highlighted cell
    let submitCellHighlight = null;
    let submitCellLat = null;
    let submitCellLng = null;

    // For watching the lat/lng element
    let latLngBodyObserver = null;
    let latLngObserver = null;
    let latLngTargetEl = null;



    // LocalStorage key for this plugin
    const SETTINGS_KEY = "wfmap_s2_settings";

    // -----------------------------
    // Settings (defaults + storage)
    // -----------------------------

    const userSettings = {
        primary: {
            enabled: true,
            level: 17,
            color: "#00B303",
            lineWidth: 1,
            lineOpacity: 1.0
        },
        secondary: {
            enabled: true,
            level: 14,
            color: "#FF0000",
            lineWidth: 2,
            lineOpacity: 1.0
        },
        poiCells: {
            enabled: true,
            color: "#000000",
            fillOpacity: 0.2
        },
        highlightCell: {
            enabled: true,
            color: "#FF0000",
            lineWidth: 4,
            lineOpacity: 1.0
        }
    };

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
            attachS2ToMapIfNeeded();
            insertS2SettingsLink();
        } else if (!panelPresent && lastPanelPresent) {
            // We just left the map page
            teardownS2ForMap();
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
                    console.warn("[S2] Failed to find submit map after several attempts");
                    resolve(null);
                    return;
                }

                setTimeout(tryFindMap, 250);
            }

            tryFindMap();
        });
    }

    function teardownS2ForMap() {
        if (!mapAttached) return;

        // Remove polygons
        clearPoiCellPolygons();

        // Clear S2 grid lines
        if (s2Overlay) {
            s2Overlay.clear();
            s2Overlay = null;
        }

        // Remove listeners we attached
        if (idleListener) {
            idleListener.remove();
            idleListener = null;
        }
        if (zoomListener) {
            zoomListener.remove();
            zoomListener = null;
        }

        // Drop references to the old map + POIs
        submitMap = null;
        s2Pois = [];

        mapAttached = false;
    }

    async function attachS2ToMapIfNeeded() {
        if (mapAttached) return;

        const map = await getSubmitMap();

        if (!map) {
            console.warn("[S2] Map not found – cannot attach");
            return;
        }

        submitMap = map;
        initS2Overlay();
    }

    // ==================================
    // Lat/Lng observers - Find submit location
    // ==================================

    function parseLatLng(text) {
        if (!text) return null;
        const parts = text.split(',');
        if (parts.length !== 2) return null;

        const lat = parseFloat(parts[0].trim());
        const lng = parseFloat(parts[1].trim());

        if (isNaN(lat) || isNaN(lng)) return null;
        return { lat, lng };
    }

    function handleLatLngChange(newLat, newLng) {
        // Whenever the marker moves, update the L17 highlight
        highlightSubmitCell(newLat, newLng);
    }

    function watchForLatLngElement() {
        // Only initialise once
        if (latLngBodyObserver) return;

        function attachToLatLngElement(el) {
            // If we're already observing this exact element, do nothing
            if (latLngTargetEl === el && latLngObserver) return;

            // Disconnect old element observer (if any)
            if (latLngObserver) {
                latLngObserver.disconnect();
                latLngObserver = null;
            }

            latLngTargetEl = el;

            let lastText = (el.textContent || "").trim();
            const initialCoords = parseLatLng(lastText);

            if (initialCoords) {
                handleLatLngChange(initialCoords.lat, initialCoords.lng);
            }

            // Watch for changes to the coordinates text
            latLngObserver = new MutationObserver(() => {
                // If element has been removed from DOM, stop observing.
                if (!document.body.contains(el)) {
                    latLngObserver.disconnect();
                    latLngObserver = null;
                    latLngTargetEl = null;
                    return;
                }

                const newText = (el.textContent || "").trim();
                if (newText === lastText) return;
                lastText = newText;

                const coords = parseLatLng(newText);
                if (!coords) return;

                handleLatLngChange(coords.lat, coords.lng);
            });

            latLngObserver.observe(el, {
                childList: true,
                subtree: true,
                characterData: true
            });
        }

        function findAndAttachLatLngElement() {
            // Adjust this selector if Niantic change their DOM
            const el = document.querySelector('.text-gray-400.text-xs');
            if (!el) return;
            attachToLatLngElement(el);
        }

        // Body-level observer: watches for the lat/lng element appearing / being replaced
        latLngBodyObserver = new MutationObserver(() => {
            findAndAttachLatLngElement();
        });

        latLngBodyObserver.observe(document.body, {
            childList: true,
            subtree: true
        });

        // Try immediately in case the element is already present
        findAndAttachLatLngElement();
    }

    // -----------------------------
    // Add settings controls
    // -----------------------------

    function insertS2SettingsLink() {
        // Wait for main sidebar to exist
        const panelCheck = setInterval(() => {
            const settingsBody = document.querySelector(".wfsmm-settings-links");
            if (!settingsBody) return; // retry

            clearInterval(panelCheck);

            // Prevent duplicate link insertion
            if (document.getElementById("wfsmm-settings-s2cells")) return;

            // Create <a> link
            const link = document.createElement("a");
            link.id = "wfsmm-settings-s2cells";
            link.textContent = "S2 Cells";

            // Append to the settings section
            settingsBody.appendChild(link);

            // Event listener for the link
            link.addEventListener("click", () => {
                openS2SettingsWindow();
            });
        }, 300);
    }

    function openS2SettingsWindow() {
        // Don’t open two modals at once
        if (document.getElementById("wfsmm-s2-modal-backdrop")) return;

        // --- Backdrop ---
        const backdrop = document.createElement("div");
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

        // Close helper
        function closeModal() {
            backdrop.remove();
        }

        // --- Dialog container ---
        const dialog = document.createElement("div");
        Object.assign(dialog.style, {
            background: "#ffffff",
            borderRadius: "8px",
            boxShadow: "0 10px 25px rgba(0,0,0,0.35)",
            width: "250px",
            maxWidth: "calc(100% - 32px)",
            padding: "10px 12px 8px",
            boxSizing: "border-box",
            fontFamily: "Roboto, Arial, sans-serif",
            fontSize: "12px",
            color: "#111827",
            maxHeight: "90vh",
            overflowY: "auto"
        });


        // --- Title ---
        const title = document.createElement("div");
        title.textContent = "S2 Cell Options";
        Object.assign(title.style, {
            fontSize: "15px",
            fontWeight: "600",
            marginBottom: "10px"
        });
        dialog.appendChild(title);

        // --- Helper to build a labeled row ---
        function makeRow(labelText, inputEl) {
            const row = document.createElement("div");
            Object.assign(row.style, {
                display: "flex",
                alignItems: "center",
                marginBottom: "2px",
                gap: "4px"
            });

            const label = document.createElement("label");
            label.textContent = labelText;
            Object.assign(label.style, {
                flex: "0 0 110px",
                fontSize: "11px",
                color: "#374151"
            });

            inputEl.style.flex = inputEl.type === "checkbox" ? "0 0 auto" : "0 0 auto";

            row.appendChild(label);
            row.appendChild(inputEl);
            return row;
        }

        // Simple clamp helper
        function clamp(num, min, max) {
            num = Number(num);
            if (Number.isNaN(num)) return min;
            return Math.min(max, Math.max(min, num));
        }

        // --- PRIMARY GRID CONTROLS ---
        const primary = userSettings.primary;

        const primaryGroup = document.createElement("div");
        Object.assign(primaryGroup.style, {
            borderBottom: "1px solid #e5e7eb",
            paddingBottom: "6px",
            marginBottom: "6px"
        });

        const primaryHeader = document.createElement("div");
        primaryHeader.textContent = "Primary grid";
        Object.assign(primaryHeader.style, {
            fontWeight: "500",
            marginBottom: "4px"
        });
        primaryGroup.appendChild(primaryHeader);

        const primaryEnabledInput = document.createElement("input");
        primaryEnabledInput.type = "checkbox";
        primaryEnabledInput.checked = !!primary.enabled;
        primaryGroup.appendChild(makeRow("Enabled", primaryEnabledInput));

        const primaryLevelInput = document.createElement("input");
        primaryLevelInput.type = "number";
        primaryLevelInput.min = "1";
        primaryLevelInput.max = "30";
        primaryLevelInput.value = primary.level ?? 17;
        primaryGroup.appendChild(makeRow("Grid level (1–30)", primaryLevelInput));

        const primaryColorInput = document.createElement("input");
        primaryColorInput.type = "color";
        primaryColorInput.value = primary.color || "#00B303";
        primaryGroup.appendChild(makeRow("Line colour", primaryColorInput));

        const primaryWidthInput = document.createElement("input");
        primaryWidthInput.type = "number";
        primaryWidthInput.min = "0.5";
        primaryWidthInput.max = "10";
        primaryWidthInput.step = "0.5";
        primaryWidthInput.value = primary.lineWidth ?? 1;
        primaryGroup.appendChild(makeRow("Line thickness", primaryWidthInput));

        const primaryOpacityInput = document.createElement("input");
        primaryOpacityInput.type = "number";
        primaryOpacityInput.min = "0";
        primaryOpacityInput.max = "1";
        primaryOpacityInput.step = "0.05";
        primaryOpacityInput.value = primary.lineOpacity ?? 1.0;
        primaryGroup.appendChild(makeRow("Line opacity", primaryOpacityInput));

        dialog.appendChild(primaryGroup);

        // --- SECONDARY GRID CONTROLS ---
        const secondary = userSettings.secondary;

        const secondaryGroup = document.createElement("div");
        Object.assign(secondaryGroup.style, {
            borderBottom: "1px solid #e5e7eb",
            paddingBottom: "8px",
            marginBottom: "8px"
        });

        const secondaryHeader = document.createElement("div");
        secondaryHeader.textContent = "Secondary grid";
        Object.assign(secondaryHeader.style, {
            fontWeight: "500",
            marginBottom: "4px"
        });
        secondaryGroup.appendChild(secondaryHeader);

        const secondaryEnabledInput = document.createElement("input");
        secondaryEnabledInput.type = "checkbox";
        secondaryEnabledInput.checked = !!secondary.enabled;
        secondaryGroup.appendChild(makeRow("Enabled", secondaryEnabledInput));

        const secondaryLevelInput = document.createElement("input");
        secondaryLevelInput.type = "number";
        secondaryLevelInput.min = "1";
        secondaryLevelInput.max = "30";
        secondaryLevelInput.value = secondary.level ?? 14;
        secondaryGroup.appendChild(makeRow("Grid level (1–30)", secondaryLevelInput));

        const secondaryColorInput = document.createElement("input");
        secondaryColorInput.type = "color";
        secondaryColorInput.value = secondary.color || "#FF0000";
        secondaryGroup.appendChild(makeRow("Line colour", secondaryColorInput));

        const secondaryWidthInput = document.createElement("input");
        secondaryWidthInput.type = "number";
        secondaryWidthInput.min = "0.5";
        secondaryWidthInput.max = "10";
        secondaryWidthInput.step = "0.5";
        secondaryWidthInput.value = secondary.lineWidth ?? 2;
        secondaryGroup.appendChild(makeRow("Line thickness", secondaryWidthInput));

        const secondaryOpacityInput = document.createElement("input");
        secondaryOpacityInput.type = "number";
        secondaryOpacityInput.min = "0";
        secondaryOpacityInput.max = "1";
        secondaryOpacityInput.step = "0.05";
        secondaryOpacityInput.value = secondary.lineOpacity ?? 1.0;
        secondaryGroup.appendChild(makeRow("Line opacity", secondaryOpacityInput));

        dialog.appendChild(secondaryGroup);

        // --- SHADED CELLS CONTROLS ---
        const poiCells = userSettings.poiCells;

        const highlight = userSettings.highlightCell;

        const shadeGroup = document.createElement("div");
        Object.assign(shadeGroup.style, {
            paddingBottom: "4px",
            marginBottom: "8px"
        });

        const shadeHeader = document.createElement("div");
        shadeHeader.textContent = "Shaded cells";
        Object.assign(shadeHeader.style, {
            fontWeight: "500",
            marginBottom: "4px"
        });
        shadeGroup.appendChild(shadeHeader);

        const shadeEnabledInput = document.createElement("input");
        shadeEnabledInput.type = "checkbox";
        shadeEnabledInput.checked = !!poiCells.enabled;
        shadeGroup.appendChild(makeRow("Enabled", shadeEnabledInput));

        const shadeColorInput = document.createElement("input");
        shadeColorInput.type = "color";
        shadeColorInput.value = poiCells.color || "#000000";
        shadeGroup.appendChild(makeRow("Shade colour", shadeColorInput));

        const shadeOpacityInput = document.createElement("input");
        shadeOpacityInput.type = "number";
        shadeOpacityInput.min = "0";
        shadeOpacityInput.max = "1";
        shadeOpacityInput.step = "0.05";
        shadeOpacityInput.value = poiCells.fillOpacity ?? 0.2;
        shadeGroup.appendChild(makeRow("Shade opacity", shadeOpacityInput));

        dialog.appendChild(shadeGroup);

        // --- SUBMISSION CELL HIGHLIGHT CONTROLS ---
        const highlightGroup = document.createElement("div");
        Object.assign(highlightGroup.style, {
            borderTop: "1px solid #e5e7eb",
            paddingTop: "6px",
            marginTop: "6px",
            paddingBottom: "4px",
            marginBottom: "4px"
        });

        const highlightHeader = document.createElement("div");
        highlightHeader.textContent = "Submission cell highlight";
        Object.assign(highlightHeader.style, {
            fontWeight: "500",
            marginBottom: "4px"
        });
        highlightGroup.appendChild(highlightHeader);

        const highlightEnabledInput = document.createElement("input");
        highlightEnabledInput.type = "checkbox";
        highlightEnabledInput.checked = !!highlight.enabled;
        highlightGroup.appendChild(makeRow("Enabled", highlightEnabledInput));

        const highlightColorInput = document.createElement("input");
        highlightColorInput.type = "color";
        highlightColorInput.value = highlight.color || "#FF0000";
        highlightGroup.appendChild(makeRow("Line colour", highlightColorInput));

        const highlightWidthInput = document.createElement("input");
        highlightWidthInput.type = "number";
        highlightWidthInput.min = "0.5";
        highlightWidthInput.max = "10";
        highlightWidthInput.step = "0.5";
        highlightWidthInput.value = highlight.lineWidth ?? 4;
        highlightGroup.appendChild(makeRow("Line thickness", highlightWidthInput));

        const highlightOpacityInput = document.createElement("input");
        highlightOpacityInput.type = "number";
        highlightOpacityInput.min = "0";
        highlightOpacityInput.max = "1";
        highlightOpacityInput.step = "0.05";
        highlightOpacityInput.value = highlight.lineOpacity ?? 1.0;
        highlightGroup.appendChild(makeRow("Line opacity", highlightOpacityInput));

        dialog.appendChild(highlightGroup);

        // --- Buttons row ---
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

        // --- Wire up buttons ---

        function redrawS2() {
            // Adjust this to match your existing overlay functions
            if (submitMap && s2Overlay) {
                s2Overlay.clear();
                drawS2Grid();
                shadePoiCells();
            } else if (submitMap && !s2Overlay) {
                // If overlay hasn’t been initialised yet
                initS2Overlay();
            }

            refreshHighlightCell();
        }

        cancelBtn.addEventListener("click", () => {
            // Reload from localStorage (discard any interim changes you might have made elsewhere)
            loadSettings();
            redrawS2();
            closeModal();
        });

        okBtn.addEventListener("click", () => {
            // PRIMARY
            primary.enabled = !!primaryEnabledInput.checked;
            primary.level = clamp(primaryLevelInput.value, 1, 30);
            primary.color = primaryColorInput.value || "#00B303";
            primary.lineWidth = clamp(primaryWidthInput.value, 0.5, 10);
            primary.lineOpacity = clamp(primaryOpacityInput.value, 0, 1);

            // SECONDARY
            secondary.enabled = !!secondaryEnabledInput.checked;
            secondary.level = clamp(secondaryLevelInput.value, 1, 30);
            secondary.color = secondaryColorInput.value || "#FF0000";
            secondary.lineWidth = clamp(secondaryWidthInput.value, 0.5, 10);
            secondary.lineOpacity = clamp(secondaryOpacityInput.value, 0, 1);

            // SHADED CELLS
            poiCells.enabled = !!shadeEnabledInput.checked;
            poiCells.color = shadeColorInput.value || "#000000";
            poiCells.fillOpacity = clamp(shadeOpacityInput.value, 0, 1);

            // SUBMISSION CELL HIGHLIGHT
            highlight.enabled = !!highlightEnabledInput.checked;
            highlight.color = highlightColorInput.value || "#FF0000";
            highlight.lineWidth = clamp(highlightWidthInput.value, 0.5, 10);
            highlight.lineOpacity = clamp(highlightOpacityInput.value, 0, 1);

            // Persist + redraw
            saveSettings();
            redrawS2();
            closeModal();
        });

        document.addEventListener("keydown", function escHandler(ev) {
            if (ev.key === "Escape") {
                closeModal(backdrop);
                document.removeEventListener("keydown", escHandler);
            }

            if (ev.key === "Enter") {
                ev.preventDefault();
                okBtn.click(); // triggers the full OK logic
            }
        });

        backdrop.addEventListener("click", (ev) => {
            if (ev.target === backdrop) {
                loadSettings();
                redrawS2();
                closeModal();
            }
        });

        // Assemble
        backdrop.appendChild(dialog);
        document.body.appendChild(backdrop);
    }

    // -----------------------------
    // Live POI interception
    // -----------------------------

    (function hookLivePoisXHR() {
        const XHR = window.XMLHttpRequest || XMLHttpRequest;

        const origOpen = XHR.prototype.open;
        const origSend = XHR.prototype.send;

        XHR.prototype.open = function(method, url, ...rest) {
            this._s2_url = url; // remember URL
            return origOpen.call(this, method, url, ...rest);
        };

        XHR.prototype.send = function(...args) {
            this.addEventListener("load", function() {
                try {
                    if (this._s2_url && this._s2_url.includes("/api/v1/vault/live-pois-in-radius")) {
                        const json = JSON.parse(this.responseText);
                        const pois = (json && json.result && Array.isArray(json.result.pois)) ?
                              json.result.pois : [];

                        s2Pois = pois;

                        // If the map is ready, re-shade cells immediately
                        if (submitMap) {
                            shadePoiCells();
                        }
                    }
                } catch (e) {
                    console.error("[S2] error parsing live-pois-in-radius response:", e);
                }
            });

            return origSend.apply(this, args);
        };
    })();

    // -----------------------------
    // S2 grid overlay (lines)
    // -----------------------------

    class S2Overlay {
        constructor() {
            this.polyLines = [];
        }

        checkMapBoundsReady(map) {
            return !!(map && map.getBounds && map.getBounds());
        }

        until(conditionFunction, map) {
            const poll = (resolve) => {
                if (conditionFunction(map)) resolve();
                else setTimeout(() => poll(resolve), 400);
            };
            return new Promise(poll);
        }

        clear() {
            this.polyLines.forEach(line => line.setMap(null));
            this.polyLines = [];
        }

        async drawCellGrid(map, gridLevel, strokeColor, strokeWidth = 1, strokeOpacity = 1.0) {
            await this.until(this.checkMapBoundsReady, map);
            const bounds = map.getBounds();

            const seenCells = {};
            const cellsToDraw = [];

            if (gridLevel >= 2 && gridLevel < (map.getZoom() + 2)) {
                const latLng = map.getCenter();
                const cell = S2.S2Cell.FromLatLng(this.getLatLngPoint(latLng), gridLevel);
                cellsToDraw.push(cell);
                seenCells[cell.toString()] = true;

                while (cellsToDraw.length > 0) {
                    const curCell = cellsToDraw.pop();
                    const neighbors = curCell.getNeighbors();

                    for (let n = 0; n < neighbors.length; n++) {
                        const nStr = neighbors[n].toString();
                        if (!seenCells[nStr]) {
                            seenCells[nStr] = true;
                            if (this.isCellOnScreen(bounds, neighbors[n])) {
                                cellsToDraw.push(neighbors[n]);
                            }
                        }
                    }

                    this.drawCell(map, curCell, strokeColor, strokeWidth, strokeOpacity);
                }
            }
        }

        drawCell(map, cell, strokeColor, strokeWidth, strokeOpacity) {
            const cellCorners = cell.getCornerLatLngs();
            cellCorners[4] = cellCorners[0];

            const polyline = new google.maps.Polyline({
                path: cellCorners,
                geodesic: true,
                fillColor: 'grey',
                fillOpacity: 0.0,
                strokeColor: strokeColor,
                strokeOpacity: strokeOpacity,
                strokeWeight: strokeWidth,
                map: map
            });
            this.polyLines.push(polyline);
        }

        getLatLngPoint(data) {
            return {
                lat: typeof data.lat === 'function' ? data.lat() : data.lat,
                lng: typeof data.lng === 'function' ? data.lng() : data.lng
            };
        }

        isCellOnScreen(mapBounds, cell) {
            const corners = cell.getCornerLatLngs();
            for (let i = 0; i < corners.length; i++) {
                if (mapBounds.intersects(new google.maps.LatLngBounds(corners[i]))) {
                    return true;
                }
            }
            return false;
        }
    }

    // Compute which S2 grid layers should be drawn
    function getEnabledS2Layers() {
        const layers = [];
        const {
            primary,
            secondary
        } = userSettings;

        if (primary.enabled) {
            layers.push({
                level: primary.level,
                color: primary.color,
                lineWidth: primary.lineWidth,
                lineOpacity: primary.lineOpacity ?? 1.0
            });
        }

        if (secondary.enabled) {
            layers.push({
                level: secondary.level,
                color: secondary.color,
                lineWidth: secondary.lineWidth,
                lineOpacity: secondary.lineOpacity ?? 1.0
            });
        }

        return layers;
    }

    async function drawS2Grid() {
        if (!submitMap || !s2Overlay) return;

        const layers = getEnabledS2Layers();
        if (!layers.length) return;

        // Draw from smallest cells to largest so larger grid lines end up on top.
        layers.sort((a, b) => a.level - b.level);

        for (let i = layers.length - 1; i >= 0; i--) {
            const layer = layers[i];
            await s2Overlay.drawCellGrid(
                submitMap,
                layer.level,
                layer.color,
                layer.lineWidth,
                layer.lineOpacity
            );
        }
    }

    function updateS2Grid() {
        if (!submitMap || !s2Overlay) return;

        s2Overlay.clear();
        drawS2Grid();
    }

    function initS2Overlay() {
        if (!submitMap) return;
        if (s2Overlay) return;

        s2Overlay = new S2Overlay();

        drawS2Grid();
        shadePoiCells();

        idleListener = submitMap.addListener("idle", () => {
            updateS2Grid();
            shadePoiCells();
        });

        zoomListener = submitMap.addListener("zoom_changed", () => {
            shadePoiCells();
        });

        mapAttached = true;
    }

    // -----------------------------
    // POI cell shading
    // -----------------------------

    function clearPoiCellPolygons() {
        if (!poiCellPolygons.length) return;
        poiCellPolygons.forEach(poly => {
            if (poly && poly.setMap) poly.setMap(null);
        });
        poiCellPolygons = [];
    }

    function shadePoiCells() {
        if (!submitMap) {
            clearPoiCellPolygons();
            return;
        }

        const pois = s2Pois;
        if (!pois.length) {
            clearPoiCellPolygons();
            return;
        }

        const s2Settings = userSettings.poiCells;
        if (!s2Settings || !s2Settings.enabled) {
            clearPoiCellPolygons();
            return;
        }

        const zoom = submitMap.getZoom();
        if (typeof zoom === "number" && zoom <= 15) {
            clearPoiCellPolygons();
            return;
        }

        clearPoiCellPolygons();

        const seen = new Set();
        const fillColor = s2Settings.color || "#000000";
        const fillOpacity = (typeof s2Settings.fillOpacity === "number") ?
              s2Settings.fillOpacity :
        0.2;

        for (const poi of pois) {
            if (typeof poi.lat !== "number" || typeof poi.lng !== "number") continue;

            const cell = S2.S2Cell.FromLatLng({
                lat: poi.lat,
                lng: poi.lng
            },
                                              POI_CELL_LEVEL
                                             );

            const cellId = cell.toString();
            if (seen.has(cellId)) continue;
            seen.add(cellId);

            const corners = cell.getCornerLatLngs();
            const path = corners.map(c => ({
                lat: typeof c.lat === "function" ? c.lat() : c.lat,
                lng: typeof c.lng === "function" ? c.lng() : c.lng
            }));
            path.push(path[0]);

            const poly = new google.maps.Polygon({
                map: submitMap,
                paths: path,
                strokeColor: fillColor,
                strokeOpacity: 0.7,
                strokeWeight: 1,
                fillColor: fillColor,
                fillOpacity: fillOpacity,
                clickable: false,
            });

            poiCellPolygons.push(poly);
        }
    }

    // -----------------------------
    // Highlight current cell
    // -----------------------------

    function highlightSubmitCell(lat, lng) {
        submitCellLat = lat;
        submitCellLng = lng;

        if (!submitMap || typeof google === "undefined" || !google.maps) return;

        const cfg = userSettings.highlightCell || {};
        const enabled = cfg.enabled !== false; // default to true if missing

        // Clear existing highlight polygon if any
        if (submitCellHighlight) {
            submitCellHighlight.setMap(null);
            submitCellHighlight = null;
        }

        if (!enabled) {
            return; // user has disabled the highlight
        }

        const strokeColor = cfg.color || "#FF0000";
        const strokeWeight = typeof cfg.lineWidth === "number" ? cfg.lineWidth : 4;
        const strokeOpacity = typeof cfg.lineOpacity === "number" ? cfg.lineOpacity : 1.0;

        // Build the L17 S2 cell around the marker
        const cell = S2.S2Cell.FromLatLng({ lat, lng }, POI_CELL_LEVEL); // POI_CELL_LEVEL = 17

        const corners = cell.getCornerLatLngs();
        const path = corners.map(c => ({
            lat: typeof c.lat === "function" ? c.lat() : c.lat,
            lng: typeof c.lng === "function" ? c.lng() : c.lng
        }));
        path.push(path[0]); // close polygon

        submitCellHighlight = new google.maps.Polygon({
            map: submitMap,
            paths: path,
            strokeColor,
            strokeOpacity,
            strokeWeight,
            fillOpacity: 0,
            clickable: false,
            zIndex: 9999
        });
    }

    // Helper to reapply highlight when settings change
    function refreshHighlightCell() {
        if (submitCellLat == null || submitCellLng == null) return;
        highlightSubmitCell(submitCellLat, submitCellLng);
    }


    // -----------------------------
    // S2 library
    // -----------------------------
    (function(exports) {
        'use strict';

        var S2 = exports.S2 = {
            L: {}
        };

        S2.L.LatLng = function( /*Number*/ rawLat, /*Number*/ rawLng, /*Boolean*/ noWrap) {
            var lat = parseFloat(rawLat, 10);
            var lng = parseFloat(rawLng, 10);

            if (isNaN(lat) || isNaN(lng)) {
                throw new Error('Invalid LatLng object: (' + rawLat + ', ' + rawLng + ')');
            }

            if (noWrap !== true) {
                lat = Math.max(Math.min(lat, 90), -90); // clamp latitude into -90..90
                lng = (lng + 180) % 360 + ((lng < -180 || lng === 180) ? 180 : -180); // wrap longtitude into -180..180
            }

            return {
                lat: lat,
                lng: lng
            };
        };

        S2.L.LatLng.DEG_TO_RAD = Math.PI / 180;
        S2.L.LatLng.RAD_TO_DEG = 180 / Math.PI;

        S2.LatLngToXYZ = function(latLng) {
            var d2r = S2.L.LatLng.DEG_TO_RAD;

            var phi = latLng.lat * d2r;
            var theta = latLng.lng * d2r;

            var cosphi = Math.cos(phi);

            return [Math.cos(theta) * cosphi, Math.sin(theta) * cosphi, Math.sin(phi)];
        };

        S2.XYZToLatLng = function(xyz) {
            var r2d = S2.L.LatLng.RAD_TO_DEG;

            var lat = Math.atan2(xyz[2], Math.sqrt(xyz[0] * xyz[0] + xyz[1] * xyz[1]));
            var lng = Math.atan2(xyz[1], xyz[0]);

            return S2.L.LatLng(lat * r2d, lng * r2d);
        };

        var largestAbsComponent = function(xyz) {
            var temp = [Math.abs(xyz[0]), Math.abs(xyz[1]), Math.abs(xyz[2])];

            if (temp[0] > temp[1]) {
                if (temp[0] > temp[2]) {
                    return 0;
                } else {
                    return 2;
                }
            } else {
                if (temp[1] > temp[2]) {
                    return 1;
                } else {
                    return 2;
                }
            }

        };

        var faceXYZToUV = function(face, xyz) {
            var u, v;

            switch (face) {
                case 0:
                    u = xyz[1] / xyz[0];
                    v = xyz[2] / xyz[0];
                    break;
                case 1:
                    u = -xyz[0] / xyz[1];
                    v = xyz[2] / xyz[1];
                    break;
                case 2:
                    u = -xyz[0] / xyz[2];
                    v = -xyz[1] / xyz[2];
                    break;
                case 3:
                    u = xyz[2] / xyz[0];
                    v = xyz[1] / xyz[0];
                    break;
                case 4:
                    u = xyz[2] / xyz[1];
                    v = -xyz[0] / xyz[1];
                    break;
                case 5:
                    u = -xyz[1] / xyz[2];
                    v = -xyz[0] / xyz[2];
                    break;
                default:
                    throw {
                        error: 'Invalid face'
                    };
            }

            return [u, v];
        };



        S2.XYZToFaceUV = function(xyz) {
            var face = largestAbsComponent(xyz);

            if (xyz[face] < 0) {
                face += 3;
            }

            var uv = faceXYZToUV(face, xyz);

            return [face, uv];
        };

        S2.FaceUVToXYZ = function(face, uv) {
            var u = uv[0];
            var v = uv[1];

            switch (face) {
                case 0:
                    return [1, u, v];
                case 1:
                    return [-u, 1, v];
                case 2:
                    return [-u, -v, 1];
                case 3:
                    return [-1, -v, -u];
                case 4:
                    return [v, -1, -u];
                case 5:
                    return [v, u, -1];
                default:
                    throw {
                        error: 'Invalid face'
                    };
            }
        };

        var singleSTtoUV = function(st) {
            if (st >= 0.5) {
                return (1 / 3.0) * (4 * st * st - 1);
            } else {
                return (1 / 3.0) * (1 - (4 * (1 - st) * (1 - st)));
            }
        };

        S2.STToUV = function(st) {
            return [singleSTtoUV(st[0]), singleSTtoUV(st[1])];
        };


        var singleUVtoST = function(uv) {
            if (uv >= 0) {
                return 0.5 * Math.sqrt(1 + 3 * uv);
            } else {
                return 1 - 0.5 * Math.sqrt(1 - 3 * uv);
            }
        };
        S2.UVToST = function(uv) {
            return [singleUVtoST(uv[0]), singleUVtoST(uv[1])];
        };


        S2.STToIJ = function(st, order) {
            var maxSize = (1 << order);

            var singleSTtoIJ = function(st) {
                var ij = Math.floor(st * maxSize);
                return Math.max(0, Math.min(maxSize - 1, ij));
            };

            return [singleSTtoIJ(st[0]), singleSTtoIJ(st[1])];
        };


        S2.IJToST = function(ij, order, offsets) {
            var maxSize = (1 << order);

            return [
                (ij[0] + offsets[0]) / maxSize,
                (ij[1] + offsets[1]) / maxSize
            ];
        };



        var rotateAndFlipQuadrant = function(n, point, rx, ry) {
            var newX, newY;
            if (ry == 0) {
                if (rx == 1) {
                    point.x = n - 1 - point.x;
                    point.y = n - 1 - point.y

                }

                var x = point.x;
                point.x = point.y
                point.y = x;
            }

        }


        // hilbert space-filling curve
        // based on http://blog.notdot.net/2009/11/Damn-Cool-Algorithms-Spatial-indexing-with-Quadtrees-and-Hilbert-Curves
        // note: rather than calculating the final integer hilbert position, we just return the list of quads
        // this ensures no precision issues with large orders (S3 cell IDs use up to 30), and is more
        // convenient for pulling out the individual bits as needed later
        var pointToHilbertQuadList = function(x, y, order, face) {
            var hilbertMap = {
                'a': [
                    [0, 'd'],
                    [1, 'a'],
                    [3, 'b'],
                    [2, 'a']
                ],
                'b': [
                    [2, 'b'],
                    [1, 'b'],
                    [3, 'a'],
                    [0, 'c']
                ],
                'c': [
                    [2, 'c'],
                    [3, 'd'],
                    [1, 'c'],
                    [0, 'b']
                ],
                'd': [
                    [0, 'a'],
                    [3, 'c'],
                    [1, 'd'],
                    [2, 'd']
                ]
            };

            if ('number' !== typeof face) {
                console.warn(new Error("called pointToHilbertQuadList without face value, defaulting to '0'").stack);
            }
            var currentSquare = (face % 2) ? 'd' : 'a';
            var positions = [];

            for (var i = order - 1; i >= 0; i--) {

                var mask = 1 << i;

                var quad_x = x & mask ? 1 : 0;
                var quad_y = y & mask ? 1 : 0;

                var t = hilbertMap[currentSquare][quad_x * 2 + quad_y];

                positions.push(t[0]);

                currentSquare = t[1];
            }

            return positions;
        };

        // S2Cell class

        S2.S2Cell = function() {};

        S2.S2Cell.FromHilbertQuadKey = function(hilbertQuadkey) {
            var parts = hilbertQuadkey.split('/');
            var face = parseInt(parts[0]);
            var position = parts[1];
            var maxLevel = position.length;
            var point = {
                x: 0,
                y: 0
            };
            var i;
            var level;
            var bit;
            var rx, ry;
            var val;

            for (i = maxLevel - 1; i >= 0; i--) {

                level = maxLevel - i;
                bit = position[i];
                rx = 0;
                ry = 0;
                if (bit === '1') {
                    ry = 1;
                } else if (bit === '2') {
                    rx = 1;
                    ry = 1;
                } else if (bit === '3') {
                    rx = 1;
                }

                val = Math.pow(2, level - 1);
                rotateAndFlipQuadrant(val, point, rx, ry);

                point.x += val * rx;
                point.y += val * ry;

            }

            if (face % 2 === 1) {
                var t = point.x;
                point.x = point.y;
                point.y = t;
            }


            return S2.S2Cell.FromFaceIJ(parseInt(face), [point.x, point.y], level);
        };

        //static method to construct
        S2.S2Cell.FromLatLng = function(latLng, level) {
            if ((!latLng.lat && latLng.lat !== 0) || (!latLng.lng && latLng.lng !== 0)) {
                throw new Error("Pass { lat: lat, lng: lng } to S2.S2Cell.FromLatLng");
            }
            var xyz = S2.LatLngToXYZ(latLng);

            var faceuv = S2.XYZToFaceUV(xyz);
            var st = S2.UVToST(faceuv[1]);

            var ij = S2.STToIJ(st, level);

            return S2.S2Cell.FromFaceIJ(faceuv[0], ij, level);
        };

        S2.S2Cell.FromFaceIJ = function(face, ij, level) {
            var cell = new S2.S2Cell();
            cell.face = face;
            cell.ij = ij;
            cell.level = level;

            return cell;
        };


        S2.S2Cell.prototype.toString = function() {
            return 'F' + this.face + 'ij[' + this.ij[0] + ',' + this.ij[1] + ']@' + this.level;
        };

        S2.S2Cell.prototype.getLatLng = function() {
            var st = S2.IJToST(this.ij, this.level, [0.5, 0.5]);
            var uv = S2.STToUV(st);
            var xyz = S2.FaceUVToXYZ(this.face, uv);

            return S2.XYZToLatLng(xyz);
        };

        S2.S2Cell.prototype.getCornerLatLngs = function() {
            var result = [];
            var offsets = [
                [0.0, 0.0],
                [0.0, 1.0],
                [1.0, 1.0],
                [1.0, 0.0]
            ];

            for (var i = 0; i < 4; i++) {
                var st = S2.IJToST(this.ij, this.level, offsets[i]);
                var uv = S2.STToUV(st);
                var xyz = S2.FaceUVToXYZ(this.face, uv);

                result.push(S2.XYZToLatLng(xyz));
            }
            return result;
        };


        S2.S2Cell.prototype.getFaceAndQuads = function() {
            var quads = pointToHilbertQuadList(this.ij[0], this.ij[1], this.level, this.face);

            return [this.face, quads];
        };
        S2.S2Cell.prototype.toHilbertQuadkey = function() {
            var quads = pointToHilbertQuadList(this.ij[0], this.ij[1], this.level, this.face);

            return this.face.toString(10) + '/' + quads.join('');
        };

        S2.latLngToNeighborKeys = S2.S2Cell.latLngToNeighborKeys = function(lat, lng, level) {
            return S2.S2Cell.FromLatLng({
                lat: lat,
                lng: lng
            }, level).getNeighbors().map(function(cell) {
                return cell.toHilbertQuadkey();
            });
        };
        S2.S2Cell.prototype.getNeighbors = function() {

            var fromFaceIJWrap = function(face, ij, level) {
                var maxSize = (1 << level);
                if (ij[0] >= 0 && ij[1] >= 0 && ij[0] < maxSize && ij[1] < maxSize) {
                    // no wrapping out of bounds
                    return S2.S2Cell.FromFaceIJ(face, ij, level);
                } else {
                    // the new i,j are out of range.
                    // with the assumption that they're only a little past the borders we can just take the points as
                    // just beyond the cube face, project to XYZ, then re-create FaceUV from the XYZ vector

                    var st = S2.IJToST(ij, level, [0.5, 0.5]);
                    var uv = S2.STToUV(st);
                    var xyz = S2.FaceUVToXYZ(face, uv);
                    var faceuv = S2.XYZToFaceUV(xyz);
                    face = faceuv[0];
                    uv = faceuv[1];
                    st = S2.UVToST(uv);
                    ij = S2.STToIJ(st, level);
                    return S2.S2Cell.FromFaceIJ(face, ij, level);
                }
            };

            var face = this.face;
            var i = this.ij[0];
            var j = this.ij[1];
            var level = this.level;


            return [
                fromFaceIJWrap(face, [i - 1, j], level),
                fromFaceIJWrap(face, [i, j - 1], level),
                fromFaceIJWrap(face, [i + 1, j], level),
                fromFaceIJWrap(face, [i, j + 1], level)
            ];

        };

        //
        // Functional Style
        //
        S2.FACE_BITS = 3;
        S2.MAX_LEVEL = 30;
        S2.POS_BITS = (2 * S2.MAX_LEVEL) + 1; // 61 (60 bits of data, 1 bit lsb marker)

        S2.facePosLevelToId = S2.S2Cell.facePosLevelToId = S2.fromFacePosLevel = function(faceN, posS, levelN) {
            var Long = exports.dcodeIO && exports.dcodeIO.Long || require('long');
            var faceB;
            var posB;
            var bin;

            if (!levelN) {
                levelN = posS.length;
            }
            if (posS.length > levelN) {
                posS = posS.substr(0, levelN);
            }

            // 3-bit face value
            faceB = Long.fromString(faceN.toString(10), true, 10).toString(2);
            while (faceB.length < S2.FACE_BITS) {
                faceB = '0' + faceB;
            }

            // 60-bit position value
            posB = Long.fromString(posS, true, 4).toString(2);
            while (posB.length < (2 * levelN)) {
                posB = '0' + posB;
            }

            bin = faceB + posB;
            // 1-bit lsb marker
            bin += '1';
            // n-bit padding to 64-bits
            while (bin.length < (S2.FACE_BITS + S2.POS_BITS)) {
                bin += '0';
            }

            return Long.fromString(bin, true, 2).toString(10);
        };

        S2.keyToId = S2.S2Cell.keyToId = S2.toId = S2.toCellId = S2.fromKey = function(key) {
            var parts = key.split('/');

            return S2.fromFacePosLevel(parts[0], parts[1], parts[1].length);
        };

        S2.idToKey = S2.S2Cell.idToKey = S2.S2Cell.toKey = S2.toKey = S2.fromId = S2.fromCellId = S2.S2Cell.toHilbertQuadkey = S2.toHilbertQuadkey = function(idS) {
            var Long = exports.dcodeIO && exports.dcodeIO.Long || require('long');
            var bin = Long.fromString(idS, true, 10).toString(2);

            while (bin.length < (S2.FACE_BITS + S2.POS_BITS)) {
                bin = '0' + bin;
            }

            // MUST come AFTER binstr has been left-padded with '0's
            var lsbIndex = bin.lastIndexOf('1');
            // substr(start, len)
            // substring(start, end) // includes start, does not include end
            var faceB = bin.substring(0, 3);
            // posB will always be a multiple of 2 (or it's invalid)
            var posB = bin.substring(3, lsbIndex);
            var levelN = posB.length / 2;

            var faceS = Long.fromString(faceB, true, 2).toString(10);
            var posS = Long.fromString(posB, true, 2).toString(4);

            while (posS.length < levelN) {
                posS = '0' + posS;
            }

            return faceS + '/' + posS;
        };

        S2.keyToLatLng = S2.S2Cell.keyToLatLng = function(key) {
            var cell2 = S2.S2Cell.FromHilbertQuadKey(key);
            return cell2.getLatLng();
        };

        S2.idToLatLng = S2.S2Cell.idToLatLng = function(id) {
            var key = S2.idToKey(id);
            return S2.keyToLatLng(key);
        };

        S2.S2Cell.latLngToKey = S2.latLngToKey = S2.latLngToQuadkey = function(lat, lng, level) {
            if (isNaN(level) || level < 1 || level > 30) {
                throw new Error("'level' is not a number between 1 and 30 (but it should be)");
            }
            return S2.S2Cell.FromLatLng({
                lat: lat,
                lng: lng
            }, level).toHilbertQuadkey();
        };

        S2.stepKey = function(key, num) {
            var Long = exports.dcodeIO && exports.dcodeIO.Long || require('long');
            var parts = key.split('/');

            var faceS = parts[0];
            var posS = parts[1];
            var level = parts[1].length;

            var posL = Long.fromString(posS, true, 4);
            // TODO handle wrapping (0 === pos + 1)
            // (only on the 12 edges of the globe)
            var otherL;
            if (num > 0) {
                otherL = posL.add(Math.abs(num));
            } else if (num < 0) {
                otherL = posL.subtract(Math.abs(num));
            }
            var otherS = otherL.toString(4);

            if ('0' === otherS) {
                console.warning(new Error("face/position wrapping is not yet supported"));
            }

            while (otherS.length < level) {
                otherS = '0' + otherS;
            }

            return faceS + '/' + otherS;
        };

        S2.S2Cell.prevKey = S2.prevKey = function(key) {
            return S2.stepKey(key, -1);
        };

        S2.S2Cell.nextKey = S2.nextKey = function(key) {
            return S2.stepKey(key, 1);
        };

    })('undefined' !== typeof module ? module.exports : window);

    // -----------------------------
    // css styling
    // -----------------------------

    function injectS2SettingsCSS() {
        if (document.getElementById("wfsmm-s2settings-css")) return;

        const css = document.createElement("style");
        css.id = "wfsmm-s2settings-css";
        css.textContent = `
        /* Backdrop */
        .wfsmm-s2-overlay-bg {
            position: fixed;
            inset: 0;
            background: rgba(0,0,0,0.5);
            z-index: 99999;
            display: flex;
            align-items: center;
            justify-content: center;
        }

        /* Popup container */
        .wfsmm-s2-overlay {
            background: #fff;
            border-radius: 8px;
            padding: 16px 20px;
            width: 360px;
            box-shadow: 0 4px 20px rgba(0,0,0,0.25);
            font-family: system-ui, sans-serif;
        }

        .wfsmm-s2-overlay h2 {
            font-size: 16px;
            font-weight: 600;
            margin: 0 0 12px 0;
            text-align: center;
        }

        /* Form grid layout */
        .wfsmm-s2-grid {
            display: grid;
            grid-template-columns: 1fr auto;
            row-gap: 10px;
            column-gap: 8px;
            align-items: center;
        }

        .wfsmm-s2-grid label {
            font-size: 13px;
        }

        /* Small numeric input */
        .wfsmm-s2-input-small {
            width: 48px;
            padding: 2px 4px;
            font-size: 12px;
            box-sizing: border-box;
        }

        /* Switches / checkboxes */
        .wfsmm-s2-checkbox {
            width: 16px;
            height: 16px;
        }

        /* Color pickers */
        .wfsmm-s2-color {
            width: 36px;
            height: 22px;
            padding: 0;
            border: none;
            background: none;
        }

        /* Footer buttons */
        .wfsmm-s2-footer {
            margin-top: 16px;
            display: flex;
            justify-content: space-between;
        }

        .wfsmm-s2-btn {
            padding: 6px 16px;
            font-size: 13px;
            border-radius: 6px;
            border: none;
            cursor: pointer;
        }

        .wfsmm-s2-btn-save {
            background: #2563eb;
            color: white;
        }

        .wfsmm-s2-btn-cancel {
            background: #e5e7eb;
        }
    `;

        document.head.appendChild(css);
    }

    // -----------------------------
    // Plugin bootstrap
    // -----------------------------

    function bootstrap() {
        loadSettings();
        startMapPanelWatcher();
        injectS2SettingsCSS();
        watchForLatLngElement();
    }

    bootstrap();

})();