// ==UserScript==
// @name         Wayfarer Map Mods - s2 Cells
// @version      3.0.0
// @description  Feature enhancement for the submission map
// @namespace    https://gitlab.com/Tntnnbltn/wayfarer-addons
// @downloadURL  https://gitlab.com/Tntnnbltn/wayfarer-addons/-/raw/main/wayfarer-map-mods-s2-cells.user.js
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

(function() {
    'use strict';

    // =====================================================
    // Constants / Configuration
    // =====================================================

    // Map route we attach to
    const SUBMIT_ROUTE = "/new/submit/new";
    const MAPVIEW_ROUTE = "/new/mapview";

    // Minimum zoom at which GCS API loads Wayspots
    const GCS_MIN_ZOOM = 18;

    // LocalStorage key for this plugin
    const SETTINGS_KEY = "wfmap_s2_settings";

    // S2 PGO inclusion rules
    const POI_CELL_LEVEL = 17;
    const GYM_THRESHOLDS = [2, 6, 20]; // game items per L14 cell for gym creation

    // IndexedDB
    const DB_NAME = "wayfarer-tools-db";
    const POI_STORE_NAME = "gamePois";
    const MANUAL_ID_PREFIX = "s2-pogo-";

    // POI Bridge
    const POI_BRIDGE_ID = "wfmapmods-poi-bridge";
    const POI_BRIDGE_SOURCE = "wfmm-s2";

    const POI_TYPE_TO_PGO_ENTITY = {
        stop: "POKESTOP",
        gym: "GYM",
        powerspot: "POWERSPOT"
    };

    // Cross plug-in button toggles
    const WF_TOGGLE_GROUP = "wf-lefttop-controls";
    const WF_TOGGLE_ACTIVE_CLASS = "wf-toggle-active";
    let manualImportControlEl = null;
    let manualImportClassObserver = null;
    let manualImportMapClickListener = null;

    // -----------------------------
    // SVG icons
    // -----------------------------

    const MANUAL_IMPORT_SVG = `<svg width="20" height="20" viewBox="0 0 821.52 1461.2" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false"><path d="M410.76 0C203.04.14 30.93 152.53 0 351.61l211.27.39c26.99-84.43 106.09-145.55 199.49-145.6 93.25.11 172.24 61.13 199.33 145.41l211.2.19C790.58 152.8 618.51.26 410.76 0zm0 280c-75.11 0-136 60.89-136 136s60.89 136 136 136 136-60.89 136-136-60.89-136-136-136zM.23 480c30.71 199.2 202.78 351.74 410.53 352 207.72-.14 379.83-152.53 410.76-351.61L610.25 480c-26.99 84.43-106.09 145.55-199.49 145.6-93.25-.11-172.24-61.13-199.33-145.41z"/><path d="m380.39 818.72h65.085v465.16h-65.085z" stroke-width="4.402"/><ellipse cx="415.18" cy="1345.9" rx="305.69" ry="115.2" stroke-width="6"/></svg>`;

    // =====================================================
    // Core map & overlay state
    // =====================================================

    // Google Map + S2 overlay
    let wfMap = null;
    let s2Overlay = null;
    let mapAttached = false;

    // Map listeners
    let idleListener = null;
    let zoomListener = null;

    // =====================================================
    // Live POI data
    // =====================================================

    // Stored game POIs (IndexedDB + in-memory cache)
    // key = id (guid or synthetic lat,lng), value = record
    let manualPois = new Map();

    // =====================================================
    // Manual POI markers (Stops / Gyms / Power Spots)
    // =====================================================

    let manualPoiMarkers = [];
    // Selection tracking
    let lastSelectedPoiId = null;
    let lastSelectedMarker = null;
    let lastSelectedMarkerOriginalIcon = null;

    // =====================================================
    // S2 cell shading + overlay reuse
    // =====================================================

    // L14-specific overlays
    let l14CellLabels = [];

    // Reuse maps for shading polygons (prevents churn)
    const l17ShadeByCellId = new Map(); // cellId -> { path, polys: google.maps.Polygon[] }
    const l14ShadeByCellId = new Map(); // cellId -> google.maps.Polygon

    // Shading caches (invalidate via shadePoiVersion)
    let shadePoiVersion = 0; // increment when POIs change
    let allPoisCache = null; // cached filtered list (stops + gyms)
    let l17CountsCache = null; // Map(cellId -> { cell, count })
    let l14StatsCache = null; // Map(cellId -> { cell, gameItems, gyms })

    // Prevent unnecessary redraw work
    let lastShadeKey = "";
    let lastGridKey = "";

    // =====================================================
    // Highlighted submission cell
    // =====================================================

    let submitCellHighlight = null;
    let submitCellLat = null;
    let submitCellLng = null;

    // =====================================================
    // Counters for remaining POI until gym
    // =====================================================

    // Cached live GCS counts by L14 cell (only for confirmed-complete cells)
    const l14GcsCountsByCellId = new Map();
    // cellId -> { cell, gcsItems, gcsGyms, confirmedAt }

    // =====================================================
    // DOM observers & route / panel tracking
    // =====================================================

    // POI bridge observer (controls POI type UI visibility)
    let poiBridgeObserver = null;

    // Map panel presence tracking
    let mapPanelObserver = null;
    let mapPanelMutationScheduled = false;

    // =====================================================
    // Lat/Lng watcher (submission location changes)
    // =====================================================

    let latLngBodyObserver = null;
    let latLngObserver = null;
    let latLngTargetEl = null;

    // =====================================================
    // UI / interaction state
    // =====================================================

    // Keyboard shortcuts installed flag (Ctrl+Alt+P/G/W/N)
    let poiTypeShortcutsInstalled = false;

    // -----------------------------
    // Mapview GCS POIs
    // -----------------------------
    let mapviewGamePois = [];
    let mapviewPoisSignature = "";


    let gcsLastQueryBounds = null;
    let gcsLastQueryStamp = 0;
    let gcsLastCompletedStamp = 0;

    // -----------------------------
    // Settings utilities
    // -----------------------------

    let userSettings = {
        _meta: { schemaVersion: 2 },

        master: { enabled: true },

        primary: {
            enabled: true,
            level: 17,
            color: "#00b303",
            lineWidth: 1,
            lineOpacity: 1
        },

        secondary: {
            enabled: true,
            level: 14,
            color: "#FF0000",
            lineWidth: 2,
            lineOpacity: 1
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
            lineOpacity: 1
        },

        l14Cells: {
            enabled: true,
            shadeUndercrowded: true,
            shadeOvercrowded: true,
            undercrowdedColor: "#facc15",
            undercrowdedOpacity: 0.45,
            overcrowdedColor: "#f97373",
            overcrowdedOpacity: 0.45,
            showLabels: true
        },

        poiMarkers: {
            stop: {
                enabled: true,
                markerSize: 8,
                borderColor: "#0000cd",
                borderOpacity: 1,
                borderWidth: 2,
                fillColor: "#00bfff",
                fillOpacity: 1
            },
            gym: {
                enabled: true,
                markerSize: 8,
                borderColor: "#ffffff",
                borderOpacity: 1,
                borderWidth: 2,
                fillColor: "#ff2450",
                fillOpacity: 1
            },
            powerspot: {
                enabled: true,
                markerSize: 8,
                borderColor: "#e762d3",
                borderOpacity: 1,
                borderWidth: 2,
                fillColor: "#f195eb",
                fillOpacity: 1
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

            // No saved settings: seed defaults so other plugins can read them
            if (!saved) {
                saveSettings();
                return;
            }

            const parsed = JSON.parse(saved);
            const savedSchema = parsed?._meta?.schemaVersion;
            const currentSchema = userSettings?._meta?.schemaVersion;

            // Schema missing or mismatched: wipe + seed defaults
            if (savedSchema !== currentSchema) {
                localStorage.removeItem(SETTINGS_KEY);
                saveSettings();
                return;
            }

            // Normal case: merge saved values into defaults
            mergeDeep(userSettings, parsed);
        } catch (e) {
            console.error(`${SETTINGS_KEY} - Failed to load settings:`, e);

            // Corrupt JSON (or other failure): wipe + seed defaults
            try {
                localStorage.removeItem(SETTINGS_KEY);
                saveSettings();
            } catch {}
        }
    }

    function saveSettings() {
        try {
            localStorage.setItem(SETTINGS_KEY, JSON.stringify(userSettings));
        } catch (e) {
            console.error(`${SETTINGS_KEY} - Failed to save settings:`, e);
        }
    }

    function hasAnyFeatureEnabled() {
        const s = userSettings;

        return !!(
            s?.primary?.enabled ||
            s?.secondary?.enabled ||
            s?.poiCells?.enabled ||
            s?.highlightCell?.enabled ||
            s?.l14Cells?.enabled
        );
    }

    function enableAllFeatures() {
        const s = userSettings;

        s.primary.enabled = true;
        s.secondary.enabled = true;
        s.poiCells.enabled = true;
        s.highlightCell.enabled = true;
    }

    // ======================================
    // IndexedDB persistence + in-memory cache
    // ======================================

    function getManualPoisIDBInstance(version) {
        return new Promise((resolve, reject) => {
            if (!window.indexedDB) {
                reject(new Error("This browser doesn't support IndexedDB"));
                return;
            }

            const openRequest = (typeof version === "number")
            ? indexedDB.open(DB_NAME, version)
            : indexedDB.open(DB_NAME);

            openRequest.onsuccess = (event) => {
                const db = event.target.result;

                // If our store does not exist, bump version and create it.
                if (!db.objectStoreNames.contains(POI_STORE_NAME)) {
                    const currentVersion = db.version;
                    db.close();
                    getManualPoisIDBInstance(currentVersion + 1).then(resolve, reject);
                    return;
                }

                resolve(db);
            };

            openRequest.onupgradeneeded = (event) => {
                const db = event.target.result;
                if (!db.objectStoreNames.contains(POI_STORE_NAME)) {
                    // keyPath "id" = guid or synthetic lat,lng id
                    db.createObjectStore(POI_STORE_NAME, { keyPath: "id" });
                }
            };

            openRequest.onerror = (event) => {
                reject(event.target.error || new Error("Failed to open IndexedDB"));
            };
        });
    }

    function recalcOverlays() {
        bumpShadePoiVersion();
        shadePoiCells();
        refreshManualPoiMarkers();
    }

    // Load all manual POIs from IDB into memory
    function loadManualPoisFromIDB() {
        getManualPoisIDBInstance().then(db => {
            const tx = db.transaction(POI_STORE_NAME, "readonly");
            const store = tx.objectStore(POI_STORE_NAME);
            const req = store.getAll();

            req.onsuccess = () => {
                const all = req.result || [];
                manualPois = new Map(all.filter(isManualRecord).map(r => [r.id, r]));
            };

            req.onerror = () => {
                console.warn("[S2] Failed to load game POIs from IndexedDB", req.error);
            };

            tx.oncomplete = () => {
                db.close();
                recalcOverlays();
                refreshManualMarkerLayersOptions();
            };

            tx.onerror = () => {
                console.warn("[S2] Transaction error while loading game POIs", tx.error);
                db.close();
            };
        }).catch(err => {
            console.warn("[S2] IndexedDB not available (load game POIs):", err);
        });
    }

    // Upsert a single game POI
    function saveManualPoiToIDB(poi) {
        if (!poi || !poi.id) return Promise.resolve();

        return getManualPoisIDBInstance().then(db => new Promise((resolve, reject) => {
            const tx = db.transaction(POI_STORE_NAME, "readwrite");
            const store = tx.objectStore(POI_STORE_NAME);

            store.put(poi); // upsert by keyPath "id"
            manualPois.set(poi.id, poi);

            tx.oncomplete = () => {
                db.close();
                recalcOverlays();
                refreshManualMarkerLayersOptions();
                resolve();
            };

            tx.onerror = () => {
                console.warn("[S2] Transaction error while saving game POI", tx.error);
                db.close();
                reject(tx.error);
            };

            tx.onabort = () => {
                console.warn("[S2] Transaction aborted while saving game POI", tx.error);
                db.close();
                reject(tx.error);
            };
        })).catch(err => {
            console.warn("[S2] IndexedDB not available (save game POI):", err);
        });
    }

    // Delete a stored game POI by id
    function deleteManualPoiFromIDB(id) {
        if (!id) return Promise.resolve();

        return getManualPoisIDBInstance().then(db => new Promise((resolve, reject) => {
            const tx = db.transaction(POI_STORE_NAME, "readwrite");
            const store = tx.objectStore(POI_STORE_NAME);

            store.delete(id);
            manualPois.delete(id);

            tx.oncomplete = () => {
                db.close();
                recalcOverlays();
                refreshManualMarkerLayersOptions();
                resolve();
            };

            tx.onerror = () => {
                console.warn("[S2] Transaction error while deleting game POI", tx.error);
                db.close();
                reject(tx.error);
            };

            tx.onabort = () => {
                console.warn("[S2] Transaction aborted while deleting game POI", tx.error);
                db.close();
                reject(tx.error);
            };
        })).catch(err => {
            console.warn("[S2] IndexedDB not available (delete game POI):", err);
        });
    }

    // ==================================
    // POI bridge watcher
    // ==================================

    // Not currently used. Saved for future development
    function startPoiBridgeWatcher() {
        if (poiBridgeObserver) return;

        let attempts = 10;

        const tryAttach = () => {
            const bridge = document.getElementById(POI_BRIDGE_ID);

            if (!bridge) {
                if (attempts-- > 0) {
                    setTimeout(tryAttach, 100);
                }
                return;
            }

            poiBridgeObserver = new MutationObserver(mutations => {
                for (const m of mutations) {
                    if (m.type !== "attributes" || m.attributeName !== "data-payload") continue;

                    const raw = bridge.getAttribute("data-payload");
                    if (!raw) {
                        // No payload → just clear our selection
                        clearSelection();
                        continue;
                    }

                    let payload;
                    try {
                        payload = JSON.parse(raw);
                    } catch {
                        // Malformed payload: safest is to clear our selection
                        clearSelection();
                        continue;
                    }

                    // If this change was triggered by this overlay, ignore it
                    if (payload.source === POI_BRIDGE_SOURCE) {
                        return;
                    }

                    // Another plugin (e.g. main map) selected something:
                    // unhighlight our nomination marker.
                    clearSelection();
                }
            });

            poiBridgeObserver.observe(bridge, {
                attributes: true,
                attributeFilter: ["data-payload"]
            });
        };

        tryAttach();
    }

    function stopPoiBridgeWatcher() {
        if (poiBridgeObserver) {
            poiBridgeObserver.disconnect();
            poiBridgeObserver = null;
        }
    }

    // ======================================
    // POI bridge (manual-only)
    // ======================================

    // Identify manual imports reliably.
    function isManualRecord(rec) {
        const id = rec?.id;
        return typeof id === "string" && id.startsWith(MANUAL_ID_PREFIX);
    }

    // Read the current POI payload from the bridge element.
    // Not currently used.
    function getCurrentBridgePayload() {
        const bridge = document.getElementById(POI_BRIDGE_ID);
        if (!bridge) return null;

        const payloadRaw = bridge.getAttribute("data-payload");
        if (!payloadRaw) return null;

        try {
            return JSON.parse(payloadRaw);
        } catch (e) {
            console.error("[S2] Failed to parse POI bridge payload:", e);
            return null;
        }
    }

    // Build the payload sent via the POI bridge (manual-only).
    function buildBridgePayloadFromPoi(poi) {
        if (!poi || !isManualRecord(poi)) return null;

        const type = poi.poiType || "unknown";

        // Note: Keep this payload shape stable because another script depends on it.
        return {
            title: poi.title || "",
            description: poi.description || "",
            lat: typeof poi.lat === "number" ? poi.lat : null,
            lng: typeof poi.lng === "number" ? poi.lng : null,
            imageUrl: poi.imageUrl || "",

            status: poi.status || "",

            source: POI_BRIDGE_SOURCE,

            dataSourceLogo: "",
            dataSourceText: "Manual import",

            pgoEntity: POI_TYPE_TO_PGO_ENTITY[type] || "UNKNOWN"
        };
    }

    // Push manual POI info into the bridge so WFMM Base can update the side panel.
    function sendPoiToBridge(poi) {
        const payload = buildBridgePayloadFromPoi(poi);
        if (!payload) return;

        const bridge = document.getElementById(POI_BRIDGE_ID);
        if (!bridge) return;

        try {
            bridge.setAttribute("data-payload", JSON.stringify(payload));
        } catch (e) {
            console.warn("[S2] Failed to serialise manual POI for bridge", e);
        }
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
            // entering map route
            startMapPanelWatcher();
        } else {
            // leaving map route
            stopMapPanelWatcher();
            teardownMap();
            stopLatLngWatcher();
            stopPoiBridgeWatcher();
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

    async function attachS2ToMapIfNeeded() {
        // If we think we're attached but the underlying map is gone, reset and reattach
        if (mapAttached) {
            if (wfMap && !isMapStale(wfMap)) return;
            teardownMap();
        }

        const map = await getWfMap();

        if (!map) {
            console.warn("[S2] Map not found – cannot attach");
            return;
        }

        wfMap = map;
        initS2Overlay();
    }

    function teardownMap() {
        if (!mapAttached) return;

        // Remove polygons
        clearPoiCellPolygons();
        clearManualPoiMarkers();

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

        removeManualImportMapButton();

        // Drop references to the old map + POIs
        wfMap = null;

        mapAttached = false;
    }

    function startMapPanelWatcher() {
        if (mapPanelObserver) return; // don't double-start

        // Run once at start in case the panel is already there
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

    function handlePanelChange() {
        if (!document.querySelector("#wfmapmods-side-panel")) return;

        // Panel is present: initialise once and stop observing
        stopMapPanelWatcher();
        attachS2ToMapIfNeeded();
        insertS2SettingsLinks();
        startLatLngWatcher();
        insertS2LayersOption();
        startPoiBridgeWatcher();
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

    function startLatLngWatcher() {
        // Only initialise once
        if (latLngBodyObserver || latLngObserver) return;

        function stopBodyObserver() {
            if (!latLngBodyObserver) return;
            latLngBodyObserver.disconnect();
            latLngBodyObserver = null;
        }

        function attachToLatLngElement(el) {
            // If we're already observing this exact element, do nothing
            if (latLngTargetEl === el && latLngObserver) return;

            // Disconnect old element observer (if any)
            if (latLngObserver) {
                latLngObserver.disconnect();
                latLngObserver = null;
            }

            latLngTargetEl = el;

            // Element found: stop watching the entire DOM
            stopBodyObserver();

            let lastText = (el.textContent || "").trim();
            const initialCoords = parseLatLng(lastText);
            if (initialCoords) {
                handleLatLngChange(initialCoords.lat, initialCoords.lng);
            }

            // Watch for coordinate text updates
            latLngObserver = new MutationObserver(() => {
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
            const el = document.querySelector(".submit-coordinates-text");
            if (!el) return;
            attachToLatLngElement(el);
        }

        // Wait for element to appear (once)
        latLngBodyObserver = new MutationObserver(() => {
            findAndAttachLatLngElement();
        });

        latLngBodyObserver.observe(document.body, {
            childList: true,
            subtree: true
        });

        // Try immediately in case it's already present
        findAndAttachLatLngElement();
    }

    function stopLatLngWatcher() {
        if (latLngObserver) {
            latLngObserver.disconnect();
            latLngObserver = null;
        }
        if (latLngBodyObserver) {
            latLngBodyObserver.disconnect();
            latLngBodyObserver = null;
        }
        latLngTargetEl = null;
    }

    // ==================================
    // Layers options and functionality
    // ==================================

    function insertS2LayersOption() {
        const menu = document.querySelector(".wfmapmods-layers-menu");
        if (!menu) return;

        if (menu.querySelector("#wfmapmods-layers-s2cells")) return;

        const label = document.createElement("label");
        label.className = "wfmapmods-layers-option";
        label.id = "wfmapmods-s2-layers-s2cells";

        const checkbox = document.createElement("input");
        checkbox.type = "checkbox";
        checkbox.checked = !!userSettings.master.enabled;
        checkbox.className = "wfmapmods-layers-checkbox";

        const span = document.createElement("span");
        span.textContent = "S2 cells";
        span.className = "wfmapmods-layers-label";

        label.appendChild(checkbox);
        label.appendChild(span);
        menu.appendChild(label);

        refreshManualMarkerLayersOptions();

        checkbox.addEventListener("change", () => {
            const enabled = checkbox.checked;

            userSettings.master.enabled = enabled;

            // The master control was disabled.
            // Remove grids, highlighting, shading
            // Do not remove markers - separate
            if (!enabled) {
                if (s2Overlay) {
                    s2Overlay.clear();
                    s2Overlay = null;
                }
                lastGridKey = "";
                lastShadeKey = "";
                clearPoiCellPolygons();

                if (submitCellHighlight) {
                    submitCellHighlight.setMap(null);
                    submitCellHighlight = null;
                }

                saveSettings();
                return;
            }

            // The master control was enabled
            // Re-enable grids, highlighting, shading
            if (!hasAnyFeatureEnabled()) {
                enableAllFeatures();
            }

            saveSettings();

            if (wfMap) {
                if (!s2Overlay) {
                    initS2Overlay();
                } else {
                    updateS2Grid();
                    shadePoiCells();
                }
                refreshHighlightCell();
            }
        });
    }

    function getManualTypeCounts() {
        const counts = { stop: 0, gym: 0, powerspot: 0 };

        for (const poi of manualPois.values()) {
            if (!isManualRecord(poi)) continue;

            const t = (poi.poiType || "").toLowerCase();
            if (t === "stop" || t === "gym" || t === "powerspot") {
                counts[t]++;
            }
        }

        return counts;
    }

    function ensureLayersOption(menu, id, labelText, checked, onChange) {
        let label = menu.querySelector(`#${id}`);
        if (!label) {
            label = document.createElement("label");
            label.className = "wfmapmods-layers-option";
            label.id = id;

            const checkbox = document.createElement("input");
            checkbox.type = "checkbox";
            checkbox.className = "wfmapmods-layers-checkbox";

            const span = document.createElement("span");
            span.textContent = labelText;
            span.className = "wfmapmods-layers-label";

            label.appendChild(checkbox);
            label.appendChild(span);
            menu.appendChild(label);

            checkbox.addEventListener("change", () => onChange(checkbox.checked));
        }

        const cb = label.querySelector("input[type='checkbox']");
        if (cb) cb.checked = !!checked;

        return label;
    }

    function removeLayersOption(menu, id) {
        const el = menu.querySelector(`#${id}`);
        if (el) el.remove();
    }

    function refreshManualMarkerLayersOptions() {
        const menu = document.querySelector(".wfmapmods-layers-menu");
        if (!menu) return;

        const counts = getManualTypeCounts();

        // Manual PokéStops
        if (counts.stop > 0) {
            ensureLayersOption(
                menu,
                "wfmapmods-s2-layers-manual-stops",
                "Manual PokéStops",
                userSettings?.poiMarkers?.stop?.enabled !== false,
                (enabled) => {
                    userSettings.poiMarkers.stop.enabled = enabled;
                    saveSettings();
                    // Rendering changes will be implemented later:
                    // refreshManualPoiMarkers();
                }
            );
        } else {
            removeLayersOption(menu, "wfmapmods-s2-layers-manual-stops");
        }

        // Manual Gyms
        if (counts.gym > 0) {
            ensureLayersOption(
                menu,
                "wfmapmods-s2-layers-manual-gyms",
                "Manual Gyms",
                userSettings?.poiMarkers?.gym?.enabled !== false,
                (enabled) => {
                    userSettings.poiMarkers.gym.enabled = enabled;
                    saveSettings();
                    // refreshManualPoiMarkers();
                }
            );
        } else {
            removeLayersOption(menu, "wfmapmods-s2-layers-manual-gyms");
        }

        // Manual Power Spots
        if (counts.powerspot > 0) {
            ensureLayersOption(
                menu,
                "wfmapmods-s2-layers-manual-powerspots",
                "Manual Power Spots",
                userSettings?.poiMarkers?.powerspot?.enabled !== false,
                (enabled) => {
                    userSettings.poiMarkers.powerspot.enabled = enabled;
                    saveSettings();
                    // refreshManualPoiMarkers();
                }
            );
        } else {
            removeLayersOption(menu, "wfmapmods-s2-layers-manual-powerspots");
        }
    }

    // ==================================
    // Modal helpers
    // ==================================

    function clamp(num, min, max, fallback = min) {
        const n = Number(num);
        if (Number.isNaN(n)) return fallback;
        return Math.min(max, Math.max(min, n));
    }

    function hexToRgba(hex, opacity) {
        let h = (hex || "#000000").replace("#", "");
        if (h.length === 3) h = h.split("").map(ch => ch + ch).join("");
        const r = parseInt(h.slice(0, 2), 16);
        const g = parseInt(h.slice(2, 4), 16);
        const b = parseInt(h.slice(4, 6), 16);
        const a = typeof opacity === "number" ? opacity : 1;
        return `rgba(${r}, ${g}, ${b}, ${a})`;
    }

    function redrawAll() {
        if (wfMap && s2Overlay) {
            s2Overlay.clear();
            drawS2Grid();
            shadePoiCells();
        } else if (wfMap && !s2Overlay) {
            initS2Overlay();
        }

        refreshHighlightCell();
        refreshManualPoiMarkers();
    }

    // ==================================
    // Settings modal and functionality
    // ==================================

    function insertS2SettingsLinks() {
        const settingsBody = document.querySelector(".wfmapmods-settings-links");
        if (!settingsBody) return;

        // Link #1: S2 Cells
        if (!document.getElementById("wfmapmods-s2-settings-s2cells")) {
            const link1 = document.createElement("a");
            link1.id = "wfmapmods-s2-settings-s2cells";
            link1.textContent = "S2 Cells";
            link1.addEventListener("click", () => openS2CellsSettingsModal());
            settingsBody.appendChild(link1);
        }

        // Link #2: Manual POI Markers
        if (!document.getElementById("wfmapmods-s2-settings-manual-poi-markers")) {
            const link2 = document.createElement("a");
            link2.id = "wfmapmods-s2-settings-manual-poi-markers";
            link2.textContent = "Manual POIs";
            link2.addEventListener("click", () => openManualPoiMarkerSettingsWindow());
            settingsBody.appendChild(link2);
        }
    }

    function openSettingsModal({ id, titleText, buildContent }) {
        if (document.getElementById(id)) return;

        const backdrop = document.createElement("div");
        backdrop.id = id;
        backdrop.className = "wfmapmods-s2-backdrop";

        function closeModal() {
            backdrop.removeEventListener("keydown", escHandler);
            backdrop.remove();
        }

        const dialog = document.createElement("div");
        dialog.className = "wfmapmods-s2-dialog";

        const title = document.createElement("div");
        title.textContent = titleText;
        title.className = "wfmapmods-s2-title";
        dialog.appendChild(title);

        // Caller builds all sections + returns { onOk?, onCancel? }
        const hooks = buildContent({
            dialog,
            backdrop,
            closeModal,
            clamp,
            hexToRgba,
            redrawAll
        }) || {};

        function escHandler(ev) {
            if (ev.key === "Escape") {
                ev.preventDefault();
                ev.stopPropagation();
                if (typeof hooks.onCancel === "function") hooks.onCancel();
                closeModal();
            } else if (ev.key === "Enter") {
                ev.preventDefault();
                ev.stopPropagation();
                if (typeof hooks.onOk === "function") hooks.onOk();
            }
        }

        backdrop.addEventListener("keydown", escHandler);
        backdrop.addEventListener("click", (ev) => {
            if (ev.target === backdrop) {
                if (typeof hooks.onCancel === "function") hooks.onCancel();
                closeModal();
            }
        });

        backdrop.appendChild(dialog);
        document.body.appendChild(backdrop);
        dialog.tabIndex = -1;
        dialog.focus();
    }

    function openS2CellsSettingsModal() {
        openSettingsModal({
            id: "wfmapmods-s2-cells-modal-backdrop",
            titleText: "S2 Cells",
            buildContent({ dialog, closeModal, hexToRgba, redrawAll }) {
                dialog.classList.add("wfmapmods-s2-dialog--poi");
                Object.assign(dialog.style, {
                    width: "440px"
                });

                // Draft-first editing (Cancel discards; OK commits)
                const original = deepClone({
                    primary: userSettings.primary,
                    secondary: userSettings.secondary,
                    poiCells: userSettings.poiCells,
                    highlightCell: userSettings.highlightCell,
                    l14Cells: userSettings.l14Cells,
                });
                const draft = deepClone(original);

                // ---------------------------
                // Helpers
                // ---------------------------
                function makeSection(titleText, hintText, noBorder) {
                    const section = document.createElement("div");
                    section.className =
                        "wfmapmods-s2-section" + (noBorder ? " wfmapmods-s2-section--no-border" : "");

                    if (titleText) {
                        const h = document.createElement("div");
                        h.className = "wfmapmods-s2-section-header";
                        h.textContent = titleText;
                        section.appendChild(h);
                    }

                    if (hintText) {
                        const hint = document.createElement("div");
                        hint.className = "wfmapmods-s2-hint";
                        hint.textContent = hintText;
                        section.appendChild(hint);
                    }
                    return section;
                }

                function setDisabled(el, disabled) {
                    el.style.opacity = disabled ? "0.45" : "1";
                    el.style.pointerEvents = disabled ? "none" : "";
                }

                function makeCheckbox(checked) {
                    const cb = document.createElement("input");
                    cb.type = "checkbox";
                    cb.checked = !!checked;
                    return cb;
                }

                function makeNumber(value, min, max, step) {
                    const i = document.createElement("input");
                    i.type = "number";
                    if (min != null) i.min = String(min);
                    if (max != null) i.max = String(max);
                    if (step != null) i.step = String(step);
                    i.value = String(value ?? "");
                    return i;
                }

                function makeTable(headerLeftBlank, headerA, headerB) {
                    const table = document.createElement("table");
                    table.className = "wfmapmods-s2-celltable";
                    table.style.width = "100%";

                    const colgroup = document.createElement("colgroup");
                    const c0 = document.createElement("col");
                    c0.style.width = "100px";     // fixed left column
                    const c1 = document.createElement("col");
                    c1.style.width = "50%";       // equal split of remaining space
                    const c2 = document.createElement("col");
                    c2.style.width = "50%";       // equal split of remaining space

                    colgroup.appendChild(c0);
                    colgroup.appendChild(c1);
                    colgroup.appendChild(c2);
                    table.appendChild(colgroup);

                    const thead = document.createElement("thead");
                    const tr = document.createElement("tr");

                    const th0 = document.createElement("th");
                    th0.textContent = headerLeftBlank || "";

                    const th1 = document.createElement("th");
                    th1.textContent = headerA;
                    th1.style.textAlign = "center"; // centre headings

                    const th2 = document.createElement("th");
                    th2.textContent = headerB;
                    th2.style.textAlign = "center"; // centre headings

                    tr.appendChild(th0);
                    tr.appendChild(th1);
                    tr.appendChild(th2);
                    thead.appendChild(tr);
                    table.appendChild(thead);

                    const tbody = document.createElement("tbody");
                    table.appendChild(tbody);

                    return { table, tbody };
                }

                function addRow(tbody, leftLabelText, cellAEl, cellBEl) {
                    const tr = document.createElement("tr");

                    const th = document.createElement("th");
                    th.className = "wfmapmods-s2-table-rowhead";
                    th.textContent = leftLabelText;

                    const tdA = document.createElement("td");
                    tdA.className = "wfmapmods-s2-markercell";
                    if (cellAEl) tdA.appendChild(cellAEl);

                    const tdB = document.createElement("td");
                    tdB.className = "wfmapmods-s2-markercell";
                    if (cellBEl) tdB.appendChild(cellBEl);

                    tr.appendChild(th);
                    tr.appendChild(tdA);
                    tr.appendChild(tdB);
                    tbody.appendChild(tr);
                }

                function makePreviewButton(svgHtml, ariaLabel) {
                    const btn = document.createElement("button");
                    btn.type = "button";
                    btn.className = "wfmapmods-s2-markerbtn";
                    if (ariaLabel) btn.setAttribute("aria-label", ariaLabel);
                    btn.innerHTML = svgHtml;
                    return btn;
                }

                // ---------------------------------------------------------
                // Projection helpers (unchanged)
                // ---------------------------------------------------------
                function getWfMapProjection() {
                    if (!wfMap) return null;

                    if (!window.__wfmapmodsProjectionOverlay) {
                        const ov = new google.maps.OverlayView();
                        ov.onAdd = function () {};
                        ov.draw = function () {};
                        ov.onRemove = function () {};
                        ov.setMap(wfMap);
                        window.__wfmapmodsProjectionOverlay = ov;
                    }

                    return window.__wfmapmodsProjectionOverlay.getProjection
                        ? window.__wfmapmodsProjectionOverlay.getProjection()
                    : null;
                }

                function fallbackParallelogramPoints(viewW, viewH, padding) {
                    const left = padding + 4;
                    const top = padding + 2;
                    const right = viewW - padding - 4;
                    const bottom = viewH - padding - 2;
                    const skew = Math.round((right - left) * 0.18);
                    return `${left + skew},${top} ${right},${top} ${right - skew},${bottom} ${left},${bottom}`;
                }

                function getCenterCellSvgPolygonPoints(level, viewW = 84, viewH = 56, padding = 6) {
                    try {
                        const proj = getWfMapProjection();
                        const map = wfMap;
                        if (!map || !proj) return fallbackParallelogramPoints(viewW, viewH, padding);

                        const center = map.getCenter();
                        if (!center) return fallbackParallelogramPoints(viewW, viewH, padding);

                        const latLng = { lat: center.lat(), lng: center.lng() };
                        const cell = S2.S2Cell.FromLatLng(latLng, level);
                        const corners = cell.getCornerLatLngs();

                        const pts = corners.map((c) => {
                            const ll = new google.maps.LatLng(c.lat, c.lng);
                            const p = proj.fromLatLngToDivPixel(ll);
                            return { x: p.x, y: p.y };
                        });

                        let minX = Infinity,
                            minY = Infinity,
                            maxX = -Infinity,
                            maxY = -Infinity;
                        for (const p of pts) {
                            minX = Math.min(minX, p.x);
                            maxX = Math.max(maxX, p.x);
                            minY = Math.min(minY, p.y);
                            maxY = Math.max(maxY, p.y);
                        }

                        const w = Math.max(1e-6, maxX - minX);
                        const h = Math.max(1e-6, maxY - minY);

                        const innerW = Math.max(1, viewW - padding * 2);
                        const innerH = Math.max(1, viewH - padding * 2);

                        const s = Math.min(innerW / w, innerH / h);
                        const offsetX = padding + (innerW - w * s) / 2;
                        const offsetY = padding + (innerH - h * s) / 2;

                        const scaled = pts.map((p) => ({
                            x: (p.x - minX) * s + offsetX,
                            y: (p.y - minY) * s + offsetY,
                        }));

                        return scaled.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
                    } catch (e) {
                        return fallbackParallelogramPoints(viewW, viewH, padding);
                    }
                }

                // ---------------------------------------------------------
                // NEW: polygon scaling (0.70 rules)
                // ---------------------------------------------------------
                function scalePolygonPoints(pointsStr, factor, viewW, viewH) {
                    if (!factor || factor === 1) return pointsStr;

                    const pts = pointsStr
                    .trim()
                    .split(/\s+/)
                    .map((pair) => {
                        const [x, y] = pair.split(",").map(Number);
                        return { x, y };
                    });

                    // scale about the center of the viewbox
                    const cx = viewW / 2;
                    const cy = viewH / 2;

                    const scaled = pts.map((p) => ({
                        x: cx + (p.x - cx) * factor,
                        y: cy + (p.y - cy) * factor,
                    }));

                    return scaled.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
                }

                function gridMinLevel() {
                    const p = clamp(draft.primary.level ?? 17, 1, 30, 17);
                    const s = clamp(draft.secondary.level ?? 14, 1, 30, 14);
                    return Math.min(p, s);
                }

                function polygonScaleFactorForGrid(which /* "primary"|"secondary" */) {
                    const p = clamp(draft.primary.level ?? 17, 1, 30, 17);
                    const s = clamp(draft.secondary.level ?? 14, 1, 30, 14);
                    if (p === s) return 1;

                    const smaller = p < s ? "primary" : "secondary";
                    return which === smaller ? 1.0 : 0.7;
                }

                // Retrieve the Pokestop marker style from WFMM Base to use in the preview
                function safeParseJson(str) {
                    try { return JSON.parse(str); } catch (e) { return null; }
                }

                function loadWfmmSettingsFromLocalStorage() {
                    const raw = localStorage.getItem("wfmap_settings");
                    if (!raw) return null;
                    return safeParseJson(raw);
                }

                function getCommunityPokestopGenericStyleFromWfmm() {
                    const s = loadWfmmSettingsFromLocalStorage();
                    const generic =
                          s?.poi?.appearance?.styles?.["community:pokestop"]?.generic ||
                          s?.poi?.appearance?.defaults?.generic ||
                          null;

                    if (!generic) return null;

                    // Normalize & clamp
                    return {
                        markerSize: Number(generic.markerSize ?? 8),
                        borderColor: String(generic.borderColor ?? "#0000cd"),
                        borderWidth: Number(generic.borderWidth ?? 2),
                        borderOpacity: Number(generic.borderOpacity ?? 1.0),
                        fillColor: String(generic.fillColor ?? "#00bfff"),
                        fillOpacity: Number(generic.fillOpacity ?? 1.0),
                    };
                }

                function renderGenericCircleMarkerSvg({ cx, cy, style }) {
                    // "2 sizes smaller" => subtract 2 from markerSize, with min 3
                    const size = Math.max(3, (style.markerSize ?? 8) - 2);

                    // Interpret markerSize as diameter-ish; we’ll treat it as radius for SVG clarity
                    // If in your system markerSize is already radius, this still looks fine—just smaller.
                    const r = size;

                    // Stroke thickness rule: if > 1, reduce by 1
                    let strokeW = Number(style.borderWidth ?? 2);
                    if (strokeW > 1) strokeW = strokeW - 1;

                    const stroke = hexToRgba(style.borderColor, clamp(style.borderOpacity ?? 1, 0, 1, 1));
                    const fill = hexToRgba(style.fillColor, clamp(style.fillOpacity ?? 1, 0, 1, 1));

                    return `<circle cx="${cx}" cy="${cy}" r="${r}"
    fill="${fill}"
    stroke="${stroke}"
    stroke-width="${strokeW}"></circle>`;
                }

                // ---------------------------------------------------------
                // SVG builders with overlays + disabled text
                // ---------------------------------------------------------
                function svgWithOverlay({
                    viewW,
                    viewH,
                    polygonPoints,
                    fill,
                    stroke,
                    strokeWidth,
                    overallOpacity = 1, // should fade ONLY polygon + overlays
                    labelText,
                    labelOpacity = 0.95,
                    overlaysSvg = ""
                }) {
                    const safeText = labelText ? String(labelText).replace(/</g, "&lt;") : "";

                    return `
<svg width="${viewW}" height="${viewH}" viewBox="0 0 ${viewW} ${viewH}" aria-hidden="true" focusable="false">
  <g opacity="${overallOpacity}">
    <polygon points="${polygonPoints}"
      fill="${fill || "transparent"}"
      stroke="${stroke || "transparent"}"
      stroke-width="${strokeWidth ?? 0}"
      stroke-linejoin="round"></polygon>

    ${overlaysSvg || ""}
  </g>

  ${
                    labelText
                        ? `<text x="${viewW / 2}" y="${viewH / 2 + 5}"
            text-anchor="middle"
            font-size="14"
            font-weight="400"
            opacity="${labelOpacity}"
            style="paint-order: stroke; stroke: rgba(0,0,0,0.35); stroke-width: 1px;">
            ${safeText}
         </text>`
                    : ""
                }
</svg>`;
                }

                function s2CellStrokeSvg(level, cfg, opts = {}) {
                    const viewW = opts.viewW ?? 84;
                    const viewH = opts.viewH ?? 56;
                    const scaleFactor = opts.scaleFactor ?? 1;

                    const rawPts = getBasePreviewPolygonPoints();
                    const pts = scalePolygonPoints(rawPts, scaleFactor, viewW, viewH);

                    const stroke = hexToRgba(cfg.color || "#000000", clamp(cfg.lineOpacity ?? 1, 0, 1, 1));
                    const w = clamp(cfg.lineWidth ?? 2, 0.5, 10, 2);

                    return svgWithOverlay({
                        viewW,
                        viewH,
                        polygonPoints: pts,
                        fill: "transparent",
                        stroke,
                        strokeWidth: w,
                        overallOpacity: opts.overallOpacity ?? 1,
                        labelText: opts.labelText,
                        overlaysSvg: opts.overlaysSvg,
                    });
                }


                function s2CellFillSvg(level, fillColor, fillOpacity, opts = {}) {
                    const viewW = opts.viewW ?? 84;
                    const viewH = opts.viewH ?? 56;
                    const scaleFactor = opts.scaleFactor ?? 1;

                    const rawPts = getBasePreviewPolygonPoints();
                    const pts = scalePolygonPoints(rawPts, scaleFactor, viewW, viewH);

                    const fill = hexToRgba(fillColor || "#000000", clamp(fillOpacity ?? 0.3, 0, 1, 0.3));

                    return svgWithOverlay({
                        viewW,
                        viewH,
                        polygonPoints: pts,
                        fill,
                        stroke: "transparent",
                        strokeWidth: 0,
                        overallOpacity: opts.overallOpacity ?? 1,
                        labelText: opts.labelText,
                        overlaysSvg: opts.overlaysSvg,
                    });
                }


                function enabledGridCfgForLevel(level) {
                    const p = draft.primary;
                    const s = draft.secondary;

                    if (p?.enabled && (p.level ?? 17) === level) return p;
                    if (s?.enabled && (s.level ?? 14) === level) return s;
                    return null;
                }

                // ---------------------------------------------------------
                // Polygon cache (computed once per modal open)
                // ---------------------------------------------------------
                const __polygonCache = {
                    base: null,   // canonical full-size polygon
                    viewW: 84,
                    viewH: 56,
                };

                function getBasePreviewPolygonPoints() {
                    if (__polygonCache.base) return __polygonCache.base;

                    const { viewW, viewH } = __polygonCache;

                    // Use any representative level (geometry identical at this scale)
                    const pts = getCenterCellSvgPolygonPoints(
                        17,        // arbitrary canonical level
                        viewW,
                        viewH,
                        6
                    );

                    __polygonCache.base = pts;
                    return pts;
                }

                // ---------------------------------------------------------
                // Preview renderers (new behaviour)
                // ---------------------------------------------------------
                function gridPreviewSvg(which /* primary|secondary */) {
                    const cfg = draft[which];
                    const lvl = clamp(cfg.level ?? (which === "primary" ? 17 : 14), 1, 30, 17);
                    const enabled = !!cfg.enabled;

                    const scaleFactor = polygonScaleFactorForGrid(which);

                    return s2CellStrokeSvg(
                        lvl,
                        cfg,
                        {
                            scaleFactor,
                            overallOpacity: enabled ? 1 : 0.35,
                            labelText: enabled ? String(lvl) : "Disabled",
                        }
                    );
                }

                function l17PoiShadingPreviewSvg() {
                    const enabled = !!draft.poiCells.enabled;

                    // L17 shading + highlight previews use scaleFactor 0.70
                    const scaleFactor = 0.7;

                    const borderCfg = enabledGridCfgForLevel(17);
                    const borderSvg = borderCfg
                    ? (() => {
                        const stroke = hexToRgba(borderCfg.color || "#000000", clamp(borderCfg.lineOpacity ?? 1, 0, 1, 1));
                        const w = clamp(borderCfg.lineWidth ?? 2, 0.5, 10, 2);
                        // render just a polygon stroke on top; we reuse the same scaled polygon points
                        const viewW = 84, viewH = 56;
                        const rawPts = getBasePreviewPolygonPoints();
                        const pts = scalePolygonPoints(rawPts, scaleFactor, viewW, viewH);
                        return `<polygon points="${pts}" fill="transparent" stroke="${stroke}" stroke-width="${w}" stroke-linejoin="round"></polygon>`;
                    })()
                    : "";

                    const markerStyle = getCommunityPokestopGenericStyleFromWfmm();
                    const markerSvg = markerStyle
                    ? renderGenericCircleMarkerSvg({ cx: 42, cy: 28, style: markerStyle })
                    : `
    <circle cx="42" cy="28" r="8" fill="rgba(30,136,229,0.95)"></circle>
    <circle cx="42" cy="28" r="3.2" fill="rgba(255,255,255,0.95)"></circle>
  `;

                    // Base fill
                    const base = s2CellFillSvg(
                        17,
                        draft.poiCells.color,
                        draft.poiCells.fillOpacity,
                        {
                            scaleFactor,
                            overallOpacity: enabled ? 1 : 0.35,
                            labelText: enabled ? "" : "Disabled",
                            overlaysSvg: `${borderSvg}${markerSvg}`,
                        }
                    );

                    return base;
                }

                function l17HighlightPreviewSvg() {
                    const enabled = !!draft.highlightCell.enabled;
                    const scaleFactor = 0.7;

                    // Selection pin overlay (top of parallelogram)
                    const pinW = 18;
                    const pinH = 26;
                    const pinX = (84 - pinW) / 2;
                    const pinY = 2;

                    const overlays = `
<image href="https://wayfarer.nianticlabs.com/img/map_selection_pin.svg"
       x="${pinX}" y="${pinY}" width="${pinW}" height="${pinH}" opacity="${enabled ? 1 : 0.6}"></image>`;

                    return s2CellStrokeSvg(
                        17,
                        draft.highlightCell,
                        {
                            scaleFactor,
                            overallOpacity: enabled ? 1 : 0.35,
                            labelText: enabled ? "" : "Disabled",
                            overlaysSvg: overlays,
                        }
                    );
                }

                function l14FillPreviewSvg(kind /* "over" | "under" */) {
                    // L14 shading uses current size (scaleFactor 1)
                    const scaleFactor = 1;

                    const enabled = kind === "over"
                    ? !!draft.l14Cells.shadeOvercrowded
                    : !!draft.l14Cells.shadeUndercrowded;

                    const fillColor = kind === "over"
                    ? draft.l14Cells.overcrowdedColor
                    : draft.l14Cells.undercrowdedColor;

                    const fillOpacity = kind === "over"
                    ? draft.l14Cells.overcrowdedOpacity
                    : draft.l14Cells.undercrowdedOpacity;

                    const borderCfg = enabledGridCfgForLevel(14);
                    const borderSvg = borderCfg
                    ? (() => {
                        const stroke = hexToRgba(borderCfg.color || "#000000", clamp(borderCfg.lineOpacity ?? 1, 0, 1, 1));
                        const w = clamp(borderCfg.lineWidth ?? 2, 0.5, 10, 2);
                        const viewW = 84, viewH = 56;
                        const rawPts = getBasePreviewPolygonPoints();
                        const pts = scalePolygonPoints(rawPts, scaleFactor, viewW, viewH);
                        return `<polygon points="${pts}" fill="transparent" stroke="${stroke}" stroke-width="${w}" stroke-linejoin="round"></polygon>`;
                    })()
                    : "";

                    return s2CellFillSvg(
                        14,
                        fillColor,
                        fillOpacity,
                        {
                            scaleFactor,
                            overallOpacity: enabled ? 1 : 0.35,
                            labelText: enabled ? "" : "Disabled",
                            overlaysSvg: borderSvg,
                        }
                    );
                }

                // If projection isn't ready at first paint, retry once shortly after opening.
                function refreshAllPreviews() {
                    refreshGridPreviews();
                    refreshL17Previews();
                    refreshL14Previews();
                }

                // ---------------------------
                // Intro (updated text)
                // ---------------------------
                dialog.appendChild(
                    makeSection(
                        null,
                        "Configure S2 overlays via the preview buttons. Each preview opens a settings panel where you can enable/disable the overlay and adjust its styling.",
                        false
                    )
                );

                // =========================================================
                // Section: S2 Grids
                // =========================================================

                const gridsSection = makeSection(null, null, false);
                const grids = makeTable("", "Primary Grid", "Secondary Grid");
                gridsSection.appendChild(grids.table);
                dialog.appendChild(gridsSection);

                const primaryBtn = makePreviewButton(gridPreviewSvg("primary"), "Primary grid settings");
                const secondaryBtn = makePreviewButton(gridPreviewSvg("secondary"), "Secondary grid settings");

                function refreshGridPreviews() {
                    primaryBtn.innerHTML = gridPreviewSvg("primary");
                    secondaryBtn.innerHTML = gridPreviewSvg("secondary");
                }

                primaryBtn.addEventListener("click", () => {
                    openS2GridSubModal({
                        idKey: "primary-grid",
                        title: "Primary Grid",
                        cfg: draft.primary,
                        returnFocusEl: dialog,
                        onApply() {
                            refreshGridPreviews();
                            refreshL17Previews();
                            refreshL14Previews();
                        },
                    });
                });

                secondaryBtn.addEventListener("click", () => {
                    openS2GridSubModal({
                        idKey: "secondary-grid",
                        title: "Secondary Grid",
                        cfg: draft.secondary,
                        returnFocusEl: dialog,
                        onApply() {
                            refreshGridPreviews();
                            refreshL17Previews();
                            refreshL14Previews();
                        },
                    });
                });

                // No enable checkbox, no size input, no "Appearance" row label
                addRow(grids.tbody, "S2 Grids", primaryBtn, secondaryBtn);

                // =========================================================
                // Section: Level 17 Cells
                // =========================================================

                const l17Section = makeSection(null, null, false);
                const l17 = makeTable("", "Shade occupied cells", "Highlight selected cell");
                l17Section.appendChild(l17.table);
                dialog.appendChild(l17Section);

                const shadingBtn = makePreviewButton(l17PoiShadingPreviewSvg(), "Cell shading settings");
                const highlightBtn = makePreviewButton(l17HighlightPreviewSvg(), "Cell highlight settings");

                function refreshL17Previews() {
                    shadingBtn.innerHTML = l17PoiShadingPreviewSvg();
                    highlightBtn.innerHTML = l17HighlightPreviewSvg();
                }

                shadingBtn.addEventListener("click", () => {
                    openS2FillOnlySubModal({
                        idKey: "l17-shading",
                        title: "Cell Shading (L17)",
                        cfg: draft.poiCells,
                        keys: { enabled: "enabled", color: "color", opacity: "fillOpacity" },
                        showEnable: true, // moved enable here
                        returnFocusEl: dialog,
                        onApply() {
                            refreshL17Previews();
                        },
                    });
                });

                highlightBtn.addEventListener("click", () => {
                    openS2StrokeOnlySubModal({
                        idKey: "l17-highlight",
                        title: "Cell Highlight (L17)",
                        cfg: draft.highlightCell,
                        keys: { enabled: "enabled", color: "color", width: "lineWidth", opacity: "lineOpacity" },
                        showEnable: true, // moved enable here
                        returnFocusEl: dialog,
                        onApply() {
                            refreshL17Previews();
                        },
                    });
                });

                // No enable checkbox rows in main modal
                addRow(l17.tbody, "Level 17 Cells", shadingBtn, highlightBtn);

                // =========================================================
                // Section: Level 14 Cells
                // =========================================================

                const l14Section = makeSection(null, null, true);

                const l14 = makeTable("", "Shade overcrowded L14 cells", "Shade undercrowded L14 cells");
                l14Section.appendChild(l14.table);

                // Keep ONLY the "Show L14 gym creation counters"
                const labelsRow = document.createElement("div");
                labelsRow.className = "wfmapmods-s2-row";
                labelsRow.style.marginBottom = "8px";
                labelsRow.style.gap = "8px";

                const labelsWrap = document.createElement("label");
                labelsWrap.style.display = "flex";
                labelsWrap.style.alignItems = "center";
                labelsWrap.style.gap = "8px";
                labelsWrap.style.cursor = "pointer";

                const labelsEnable = document.createElement("input");
                labelsEnable.type = "checkbox";
                labelsEnable.checked = !!draft.l14Cells.showLabels;

                const labelsText = document.createElement("span");
                labelsText.textContent = "Display counters for how many POIs are required to spawn a new gym";

                labelsEnable.addEventListener("change", () => {
                    draft.l14Cells.showLabels = !!labelsEnable.checked;
                });

                labelsWrap.appendChild(labelsEnable);
                labelsWrap.appendChild(labelsText);
                labelsRow.appendChild(labelsWrap);
                l14Section.appendChild(labelsRow);

                const overcrowdedBtn = makePreviewButton(l14FillPreviewSvg("over"), "Overcrowded settings");
                const undercrowdedBtn = makePreviewButton(l14FillPreviewSvg("under"), "Undercrowded settings");

                function refreshL14Previews() {
                    overcrowdedBtn.innerHTML = l14FillPreviewSvg("over");
                    undercrowdedBtn.innerHTML = l14FillPreviewSvg("under");
                    labelsEnable.checked = !!draft.l14Cells.showLabels;
                }

                overcrowdedBtn.addEventListener("click", () => {
                    openS2FillOnlySubModal({
                        idKey: "l14-overcrowded",
                        title: "Overcrowded (L14)",
                        cfg: draft.l14Cells,
                        keys: {
                            enabled: "shadeOvercrowded",
                            color: "overcrowdedColor",
                            opacity: "overcrowdedOpacity",
                        },
                        showEnable: true, // moved enable here
                        returnFocusEl: dialog,
                        onApply() {
                            refreshL14Previews();
                        },
                    });
                });

                undercrowdedBtn.addEventListener("click", () => {
                    openS2FillOnlySubModal({
                        idKey: "l14-undercrowded",
                        title: "Undercrowded (L14)",
                        cfg: draft.l14Cells,
                        keys: {
                            enabled: "shadeUndercrowded",
                            color: "undercrowdedColor",
                            opacity: "undercrowdedOpacity",
                        },
                        showEnable: true, // moved enable here
                        returnFocusEl: dialog,
                        onApply() {
                            refreshL14Previews();
                        },
                    });
                });

                addRow(l14.tbody, "Level 14 Cells", overcrowdedBtn, undercrowdedBtn);

                dialog.appendChild(l14Section);

                // Initial preview state
                refreshAllPreviews();
                setTimeout(() => refreshAllPreviews(), 0);

                // =========================================================
                // Footer
                // =========================================================
                const buttonsRow = document.createElement("div");
                buttonsRow.className = "wfmapmods-s2-buttons";

                const cancelBtn = document.createElement("button");
                cancelBtn.type = "button";
                cancelBtn.textContent = "Cancel";
                cancelBtn.className = "wfmapmods-s2-btn wfmapmods-s2-btn-cancel";

                const okBtn = document.createElement("button");
                okBtn.type = "button";
                okBtn.textContent = "OK";
                okBtn.className = "wfmapmods-s2-btn wfmapmods-s2-btn-ok";

                buttonsRow.appendChild(cancelBtn);
                buttonsRow.appendChild(okBtn);
                dialog.appendChild(buttonsRow);

                function restoreOriginalInMemory() {
                    userSettings.primary = deepClone(original.primary);
                    userSettings.secondary = deepClone(original.secondary);
                    userSettings.poiCells = deepClone(original.poiCells);
                    userSettings.highlightCell = deepClone(original.highlightCell);
                    userSettings.l14Cells = deepClone(original.l14Cells);
                }

                function applyDraftToUserSettings() {
                    userSettings.primary = deepClone(draft.primary);
                    userSettings.secondary = deepClone(draft.secondary);
                    userSettings.poiCells = deepClone(draft.poiCells);
                    userSettings.highlightCell = deepClone(draft.highlightCell);
                    userSettings.l14Cells = deepClone(draft.l14Cells);
                }

                cancelBtn.addEventListener("click", () => {
                    restoreOriginalInMemory();
                    if (typeof redrawAll === "function") redrawAll();
                    closeModal();
                });

                okBtn.addEventListener("click", () => {
                    applyDraftToUserSettings();
                    saveSettings();
                    if (typeof redrawAll === "function") redrawAll();
                    closeModal();
                });

                dialog.tabIndex = -1;
                dialog.focus();

                return {
                    onOk: () => okBtn.click(),
                    onCancel: () => {
                        restoreOriginalInMemory();
                        if (typeof redrawAll === "function") redrawAll();
                    },
                };

                // ---------------------------------------------------------
                // Submodals
                // ---------------------------------------------------------

                function openS2GridSubModal({ idKey, title, cfg, returnFocusEl, onApply }) {
                    const existing = document.getElementById(`wfmapmods-s2-grid-style-${idKey}`);
                    if (existing) return;

                    const backdrop = document.createElement("div");
                    backdrop.id = `wfmapmods-s2-grid-style-${idKey}`;
                    backdrop.className = "wfmapmods-s2-backdrop";

                    const modal = document.createElement("div");
                    modal.className = "wfmapmods-s2-dialog wfmapmods-s2-dialog--poi";
                    Object.assign(modal.style, { width: "250px", minWidth: "200px", maxWidth: "380px" });

                    const titleEl = document.createElement("div");
                    titleEl.className = "wfmapmods-s2-title";
                    titleEl.textContent = title;
                    modal.appendChild(titleEl);

                    const section = document.createElement("div");
                    section.className = "wfmapmods-s2-section wfmapmods-s2-section--no-border";

                    function makeRow(labelText, inputEl) {
                        const row = document.createElement("div");
                        row.className = "wfmapmods-s2-row wfmapmods-s2-row--narrow";

                        const lab = document.createElement("label");
                        lab.className = "wfmapmods-s2-label";
                        lab.textContent = labelText;

                        row.appendChild(lab);
                        row.appendChild(inputEl);
                        return row;
                    }

                    // Enable (moved here)
                    const enableInput = document.createElement("input");
                    enableInput.type = "checkbox";
                    enableInput.checked = !!cfg.enabled;

                    const enableWrap = document.createElement("label");
                    enableWrap.style.display = "flex";
                    enableWrap.style.alignItems = "center";
                    enableWrap.style.gap = "8px";
                    enableWrap.style.cursor = "pointer";
                    const enableText = document.createElement("span");
                    enableText.textContent = "Enabled";
                    enableWrap.appendChild(enableInput);
                    enableWrap.appendChild(enableText);

                    // Level (moved here)
                    const levelInput = makeNumber(cfg.level ?? 17, 1, 30, 1);

                    // Stroke settings
                    const colorInput = document.createElement("input");
                    colorInput.type = "color";
                    colorInput.value = cfg.color || "#000000";

                    const widthInput = document.createElement("input");
                    widthInput.type = "number";
                    widthInput.min = "0.5";
                    widthInput.max = "10";
                    widthInput.step = "0.5";
                    widthInput.value = String(typeof cfg.lineWidth === "number" ? cfg.lineWidth : 2);

                    const opacityInput = document.createElement("input");
                    opacityInput.type = "number";
                    opacityInput.min = "0";
                    opacityInput.max = "1";
                    opacityInput.step = "0.05";
                    opacityInput.value = String(typeof cfg.lineOpacity === "number" ? cfg.lineOpacity : 1);

                    section.appendChild(makeRow("Enable", enableWrap));
                    section.appendChild(makeRow("Cell level", levelInput));
                    section.appendChild(makeRow("Line colour", colorInput));
                    section.appendChild(makeRow("Line thickness", widthInput));
                    section.appendChild(makeRow("Line opacity (0–1)", opacityInput));
                    modal.appendChild(section);

                    const buttons = document.createElement("div");
                    buttons.className = "wfmapmods-s2-buttons";

                    const cancelBtn = document.createElement("button");
                    cancelBtn.type = "button";
                    cancelBtn.textContent = "Cancel";
                    cancelBtn.className = "wfmapmods-s2-btn wfmapmods-s2-btn-cancel";

                    const okBtn = document.createElement("button");
                    okBtn.type = "button";
                    okBtn.textContent = "OK";
                    okBtn.className = "wfmapmods-s2-btn wfmapmods-s2-btn-ok";

                    buttons.appendChild(cancelBtn);
                    buttons.appendChild(okBtn);
                    modal.appendChild(buttons);

                    let pointerDownOnBackdrop = false;

                    function close() {
                        backdrop.removeEventListener("keydown", keyHandler, true);
                        backdrop.remove();
                        if (returnFocusEl) setTimeout(() => returnFocusEl.focus(), 0);
                    }

                    cancelBtn.addEventListener("click", close);

                    okBtn.addEventListener("click", () => {
                        cfg.enabled = !!enableInput.checked;
                        cfg.level = clamp(levelInput.value, 1, 30, cfg.level ?? 17);

                        cfg.color = colorInput.value || cfg.color || "#000000";
                        cfg.lineWidth = clamp(widthInput.value, 0.5, 10, cfg.lineWidth ?? 2);
                        cfg.lineOpacity = clamp(opacityInput.value, 0, 1, cfg.lineOpacity ?? 1);

                        if (typeof onApply === "function") onApply();
                        close();
                    });

                    backdrop.addEventListener("pointerdown", (ev) => {
                        pointerDownOnBackdrop = ev.target === backdrop;
                    });

                    backdrop.addEventListener("pointerup", (ev) => {
                        if (pointerDownOnBackdrop && ev.target === backdrop) close();
                        pointerDownOnBackdrop = false;
                    });

                    backdrop.addEventListener("pointercancel", () => {
                        pointerDownOnBackdrop = false;
                    });

                    function keyHandler(ev) {
                        if (ev.key === "Escape") {
                            ev.preventDefault();
                            ev.stopPropagation();
                            close();
                        } else if (ev.key === "Enter") {
                            ev.preventDefault();
                            ev.stopPropagation();
                            okBtn.click();
                        }
                    }
                    backdrop.addEventListener("keydown", keyHandler, true);

                    backdrop.appendChild(modal);
                    document.body.appendChild(backdrop);

                    modal.tabIndex = -1;
                    modal.focus();
                }

                function openS2FillOnlySubModal({ idKey, title, cfg, keys, showEnable, returnFocusEl, onApply }) {
                    const existing = document.getElementById(`wfmapmods-s2-fill-style-${idKey}`);
                    if (existing) return;

                    const backdrop = document.createElement("div");
                    backdrop.id = `wfmapmods-s2-fill-style-${idKey}`;
                    backdrop.className = "wfmapmods-s2-backdrop";

                    const modal = document.createElement("div");
                    modal.className = "wfmapmods-s2-dialog wfmapmods-s2-dialog--poi";
                    Object.assign(modal.style, { width: "320px", minWidth: "300px", maxWidth: "360px" });

                    const titleEl = document.createElement("div");
                    titleEl.className = "wfmapmods-s2-title";
                    titleEl.textContent = title;
                    modal.appendChild(titleEl);

                    const section = document.createElement("div");
                    section.className = "wfmapmods-s2-section wfmapmods-s2-section--no-border";

                    function makeRow(labelText, inputEl) {
                        const row = document.createElement("div");
                        row.className = "wfmapmods-s2-row wfmapmods-s2-row--narrow";

                        const lab = document.createElement("label");
                        lab.className = "wfmapmods-s2-label";
                        lab.textContent = labelText;

                        row.appendChild(lab);
                        row.appendChild(inputEl);
                        return row;
                    }

                    let enableInput = null;
                    if (showEnable && keys.enabled) {
                        enableInput = document.createElement("input");
                        enableInput.type = "checkbox";
                        enableInput.checked = !!cfg[keys.enabled];

                        const enableWrap = document.createElement("label");
                        enableWrap.style.display = "flex";
                        enableWrap.style.alignItems = "center";
                        enableWrap.style.gap = "8px";
                        enableWrap.style.cursor = "pointer";

                        const enableText = document.createElement("span");
                        enableText.textContent = "Enabled";

                        enableWrap.appendChild(enableInput);
                        enableWrap.appendChild(enableText);

                        section.appendChild(makeRow("Enable", enableWrap));
                    }

                    const colorInput = document.createElement("input");
                    colorInput.type = "color";
                    colorInput.value = cfg[keys.color] || "#000000";

                    const opacityInput = document.createElement("input");
                    opacityInput.type = "number";
                    opacityInput.min = "0";
                    opacityInput.max = "1";
                    opacityInput.step = "0.05";
                    opacityInput.value = String(typeof cfg[keys.opacity] === "number" ? cfg[keys.opacity] : 0.3);

                    section.appendChild(makeRow("Fill colour", colorInput));
                    section.appendChild(makeRow("Fill opacity (0–1)", opacityInput));
                    modal.appendChild(section);

                    const buttons = document.createElement("div");
                    buttons.className = "wfmapmods-s2-buttons";

                    const cancelBtn = document.createElement("button");
                    cancelBtn.type = "button";
                    cancelBtn.textContent = "Cancel";
                    cancelBtn.className = "wfmapmods-s2-btn wfmapmods-s2-btn-cancel";

                    const okBtn = document.createElement("button");
                    okBtn.type = "button";
                    okBtn.textContent = "OK";
                    okBtn.className = "wfmapmods-s2-btn wfmapmods-s2-btn-ok";

                    buttons.appendChild(cancelBtn);
                    buttons.appendChild(okBtn);
                    modal.appendChild(buttons);

                    let pointerDownOnBackdrop = false;

                    function close() {
                        backdrop.removeEventListener("keydown", keyHandler, true);
                        backdrop.remove();
                        if (returnFocusEl) setTimeout(() => returnFocusEl.focus(), 0);
                    }

                    cancelBtn.addEventListener("click", close);

                    okBtn.addEventListener("click", () => {
                        if (enableInput && keys.enabled) cfg[keys.enabled] = !!enableInput.checked;

                        cfg[keys.color] = colorInput.value || cfg[keys.color] || "#000000";
                        cfg[keys.opacity] = clamp(opacityInput.value, 0, 1, cfg[keys.opacity] ?? 0.3);

                        if (typeof onApply === "function") onApply();
                        close();
                    });

                    backdrop.addEventListener("pointerdown", (ev) => {
                        pointerDownOnBackdrop = ev.target === backdrop;
                    });

                    backdrop.addEventListener("pointerup", (ev) => {
                        if (pointerDownOnBackdrop && ev.target === backdrop) close();
                        pointerDownOnBackdrop = false;
                    });

                    backdrop.addEventListener("pointercancel", () => {
                        pointerDownOnBackdrop = false;
                    });

                    function keyHandler(ev) {
                        if (ev.key === "Escape") {
                            ev.preventDefault();
                            ev.stopPropagation();
                            close();
                        } else if (ev.key === "Enter") {
                            ev.preventDefault();
                            ev.stopPropagation();
                            okBtn.click();
                        }
                    }
                    backdrop.addEventListener("keydown", keyHandler, true);

                    backdrop.appendChild(modal);
                    document.body.appendChild(backdrop);

                    modal.tabIndex = -1;
                    modal.focus();
                }

                function openS2StrokeOnlySubModal({ idKey, title, cfg, keys, showEnable, returnFocusEl, onApply }) {
                    const existing = document.getElementById(`wfmapmods-s2-stroke-style-${idKey}`);
                    if (existing) return;

                    const backdrop = document.createElement("div");
                    backdrop.id = `wfmapmods-s2-stroke-style-${idKey}`;
                    backdrop.className = "wfmapmods-s2-backdrop";

                    const modal = document.createElement("div");
                    modal.className = "wfmapmods-s2-dialog wfmapmods-s2-dialog--poi";
                    Object.assign(modal.style, { width: "320px", minWidth: "300px", maxWidth: "360px" });

                    const titleEl = document.createElement("div");
                    titleEl.className = "wfmapmods-s2-title";
                    titleEl.textContent = title;
                    modal.appendChild(titleEl);

                    const section = document.createElement("div");
                    section.className = "wfmapmods-s2-section wfmapmods-s2-section--no-border";

                    function makeRow(labelText, inputEl) {
                        const row = document.createElement("div");
                        row.className = "wfmapmods-s2-row wfmapmods-s2-row--narrow";

                        const lab = document.createElement("label");
                        lab.className = "wfmapmods-s2-label";
                        lab.textContent = labelText;

                        row.appendChild(lab);
                        row.appendChild(inputEl);
                        return row;
                    }

                    let enableInput = null;
                    if (showEnable && keys.enabled) {
                        enableInput = document.createElement("input");
                        enableInput.type = "checkbox";
                        enableInput.checked = !!cfg[keys.enabled];

                        const enableWrap = document.createElement("label");
                        enableWrap.style.display = "flex";
                        enableWrap.style.alignItems = "center";
                        enableWrap.style.gap = "8px";
                        enableWrap.style.cursor = "pointer";

                        const enableText = document.createElement("span");
                        enableText.textContent = "Enabled";

                        enableWrap.appendChild(enableInput);
                        enableWrap.appendChild(enableText);

                        section.appendChild(makeRow("Enable", enableWrap));
                    }

                    const colorInput = document.createElement("input");
                    colorInput.type = "color";
                    colorInput.value = cfg[keys.color] || "#000000";

                    const widthInput = document.createElement("input");
                    widthInput.type = "number";
                    widthInput.min = "0.5";
                    widthInput.max = "10";
                    widthInput.step = "0.5";
                    widthInput.value = String(typeof cfg[keys.width] === "number" ? cfg[keys.width] : 2);

                    const opacityInput = document.createElement("input");
                    opacityInput.type = "number";
                    opacityInput.min = "0";
                    opacityInput.max = "1";
                    opacityInput.step = "0.05";
                    opacityInput.value = String(typeof cfg[keys.opacity] === "number" ? cfg[keys.opacity] : 1);

                    section.appendChild(makeRow("Line colour", colorInput));
                    section.appendChild(makeRow("Line thickness", widthInput));
                    section.appendChild(makeRow("Line opacity (0–1)", opacityInput));
                    modal.appendChild(section);

                    const buttons = document.createElement("div");
                    buttons.className = "wfmapmods-s2-buttons";

                    const cancelBtn = document.createElement("button");
                    cancelBtn.type = "button";
                    cancelBtn.textContent = "Cancel";
                    cancelBtn.className = "wfmapmods-s2-btn wfmapmods-s2-btn-cancel";

                    const okBtn = document.createElement("button");
                    okBtn.type = "button";
                    okBtn.textContent = "OK";
                    okBtn.className = "wfmapmods-s2-btn wfmapmods-s2-btn-ok";

                    buttons.appendChild(cancelBtn);
                    buttons.appendChild(okBtn);
                    modal.appendChild(buttons);

                    let pointerDownOnBackdrop = false;

                    function close() {
                        backdrop.removeEventListener("keydown", keyHandler, true);
                        backdrop.remove();
                        if (returnFocusEl) setTimeout(() => returnFocusEl.focus(), 0);
                    }

                    cancelBtn.addEventListener("click", close);

                    okBtn.addEventListener("click", () => {
                        if (enableInput && keys.enabled) cfg[keys.enabled] = !!enableInput.checked;

                        cfg[keys.color] = colorInput.value || cfg[keys.color] || "#000000";
                        cfg[keys.width] = clamp(widthInput.value, 0.5, 10, cfg[keys.width] ?? 2);
                        cfg[keys.opacity] = clamp(opacityInput.value, 0, 1, cfg[keys.opacity] ?? 1);

                        if (typeof onApply === "function") onApply();
                        close();
                    });

                    backdrop.addEventListener("pointerdown", (ev) => {
                        pointerDownOnBackdrop = ev.target === backdrop;
                    });

                    backdrop.addEventListener("pointerup", (ev) => {
                        if (pointerDownOnBackdrop && ev.target === backdrop) close();
                        pointerDownOnBackdrop = false;
                    });

                    backdrop.addEventListener("pointercancel", () => {
                        pointerDownOnBackdrop = false;
                    });

                    function keyHandler(ev) {
                        if (ev.key === "Escape") {
                            ev.preventDefault();
                            ev.stopPropagation();
                            close();
                        } else if (ev.key === "Enter") {
                            ev.preventDefault();
                            ev.stopPropagation();
                            okBtn.click();
                        }
                    }
                    backdrop.addEventListener("keydown", keyHandler, true);

                    backdrop.appendChild(modal);
                    document.body.appendChild(backdrop);

                    modal.tabIndex = -1;
                    modal.focus();
                }
            },
        });
    }

    function openManualPoiMarkerSettingsWindow() {
        openSettingsModal({
            id: "wfmapmods-s2-manual-pois-modal-backdrop",
            titleText: "Manual marker options",
            buildContent({ dialog, closeModal, hexToRgba }) {
                // Match the slimmer layout in your example screenshot.
                dialog.classList.add("wfmapmods-s2-dialog--poi");
                Object.assign(dialog.style, {
                    width: "320px",
                    minWidth: "320px",
                    maxWidth: "440px"
                });

                // Work on a draft copy so the main modal can be cancelled without persisting changes.
                const originalPoiMarkers = deepClone(userSettings.poiMarkers);
                const draftPoiMarkers = deepClone(userSettings.poiMarkers);

                // Intro / hint text.
                const hintSection = document.createElement("div");
                hintSection.className = "wfmapmods-s2-section";
                const hint = document.createElement("div");
                hint.className = "wfmapmods-s2-hint";
                hint.textContent =
                    "These settings control markers which were manually added via S2 plug-in. Click the marker to customise its appearance.";
                hintSection.appendChild(hint);
                dialog.appendChild(hintSection);

                // Replicate-from-base link (does not save; updates the draft + previews only)
                const replicateRow = document.createElement("div");
                replicateRow.className = "wfmapmods-s2-row";
                replicateRow.style.marginBottom = "8px";

                const replicateLink = document.createElement("button");
                replicateLink.type = "button";
                replicateLink.className = "wfmapmods-s2-link-button";
                replicateLink.textContent = "Replicate marker styles from Wayfarer Map Mods – Base";

                replicateRow.appendChild(replicateLink);
                dialog.appendChild(replicateRow);

                replicateLink.addEventListener("click", () => {
                    const res = replicateMarkerStylesFromBaseIntoDraft(draftPoiMarkers);

                    if (!res.ok) {
                        showToastNearElement(replicateLink, res.message || "Failed to replicate marker styles.");
                        return;
                    }

                    ["stop", "gym", "powerspot"].forEach((k) => {
                        renderMarkerPreviewButton(previewButtons[k], draftPoiMarkers[k], hexToRgba);
                    });

                    if (res.changed) {
                        showToastNearElement(replicateLink, "Marker styles updated.");
                    } else {
                        showToastNearElement(replicateLink, "Marker styles already matched WFMM - Base. No changes made.");
                    }
                });

                const TYPES = [
                    { key: "stop", label: "PokéStops" },
                    { key: "gym", label: "Gyms" },
                    { key: "powerspot", label: "Power Spots" }
                ];

                // Marker table with clickable previews.
                const tableSection = document.createElement("div");
                tableSection.className = "wfmapmods-s2-section wfmapmods-s2-section--no-border";

                const table = document.createElement("table");
                table.className = "wfmapmods-s2-markertable";

                const colgroup = document.createElement("colgroup");
                const col1 = document.createElement("col");
                col1.style.width = "160px";
                const col2 = document.createElement("col");
                colgroup.appendChild(col1);
                colgroup.appendChild(col2);
                table.appendChild(colgroup);

                const tbody = document.createElement("tbody");
                table.appendChild(tbody);

                // Keep references to preview buttons so the sub-modal can re-render them.
                const previewButtons = {};

                TYPES.forEach(({ key, label }) => {
                    const tr = document.createElement("tr");

                    const rowHead = document.createElement("th");
                    rowHead.className = "wfmapmods-s2-markertable-rowhead";
                    rowHead.textContent = label;

                    const td = document.createElement("td");
                    td.className = "wfmapmods-s2-markercell";

                    const previewBtn = document.createElement("button");
                    previewBtn.type = "button";
                    previewBtn.className = "wfmapmods-s2-markerbtn";
                    previewBtn.setAttribute("aria-label", `Customise ${label} marker`);

                    previewButtons[key] = previewBtn;
                    renderMarkerPreviewButton(previewBtn, draftPoiMarkers[key], hexToRgba);

                    previewBtn.addEventListener("click", () => {
                        openPoiMarkerStyleSubModal({
                            typeKey: key,
                            label,
                            cfg: draftPoiMarkers[key],
                            hexToRgba,
                            returnFocusEl: dialog,
                            onApply(updatedCfg) {
                                draftPoiMarkers[key] = updatedCfg;
                                renderMarkerPreviewButton(previewButtons[key], draftPoiMarkers[key], hexToRgba);
                            }
                        });
                    });

                    td.appendChild(previewBtn);
                    tr.appendChild(rowHead);
                    tr.appendChild(td);
                    tbody.appendChild(tr);
                });

                tableSection.appendChild(table);
                dialog.appendChild(tableSection);

                // Footer buttons.
                const buttonsRow = document.createElement("div");
                buttonsRow.className = "wfmapmods-s2-buttons";

                const cancelBtn = document.createElement("button");
                cancelBtn.type = "button";
                cancelBtn.textContent = "Cancel";
                cancelBtn.className = "wfmapmods-s2-btn wfmapmods-s2-btn-cancel";

                const okBtn = document.createElement("button");
                okBtn.type = "button";
                okBtn.textContent = "OK";
                okBtn.className = "wfmapmods-s2-btn wfmapmods-s2-btn-ok";

                buttonsRow.appendChild(cancelBtn);
                buttonsRow.appendChild(okBtn);
                dialog.appendChild(buttonsRow);

                cancelBtn.addEventListener("click", () => {
                    // Discard: restore original settings in memory and exit without saving.
                    userSettings.poiMarkers = originalPoiMarkers;
                    closeModal();
                });

                okBtn.addEventListener("click", () => {
                    // Commit: persist and refresh the map markers.
                    userSettings.poiMarkers = deepClone(draftPoiMarkers);
                    saveSettings();
                    refreshManualPoiMarkers();
                    closeModal();
                });

                // Let openSettingsModal handle Escape / outside click. Ensure cancel paths discard.
                return {
                    onOk: () => okBtn.click(),
                    onCancel: () => {
                        userSettings.poiMarkers = originalPoiMarkers;
                    }
                };
            }
        });
    }

    /**
     * Sub-modal for editing one marker type.
     * OK/Enter applies changes to the draft (main modal) and re-renders its preview.
     * Cancel/Escape/outside click closes without applying changes.
     */
    function openPoiMarkerStyleSubModal({ typeKey, label, cfg, hexToRgba, onApply, returnFocusEl }) {
        const existing = document.getElementById(`wfmapmods-s2-marker-style-${typeKey}`);
        if (existing) return;

        // Local working copy. Only applied back to the draft when OK is pressed.
        const local = deepClone(cfg);

        const backdrop = document.createElement("div");
        backdrop.id = `wfmapmods-s2-marker-style-${typeKey}`;
        backdrop.className = "wfmapmods-s2-backdrop";

        const dialog = document.createElement("div");
        dialog.className = "wfmapmods-s2-dialog wfmapmods-s2-dialog--poi";
        Object.assign(dialog.style, {
            width: "300px",
            minWidth: "300px",
            maxWidth: "360px"
        });

        const title = document.createElement("div");
        title.className = "wfmapmods-s2-title";
        title.textContent = `Manual Markers • ${label}`;
        dialog.appendChild(title);

        const section = document.createElement("div");
        section.className = "wfmapmods-s2-section wfmapmods-s2-section--no-border";

        function makeRow(labelText, inputEl) {
            const row = document.createElement("div");
            row.className = "wfmapmods-s2-row wfmapmods-s2-row--narrow";

            const lab = document.createElement("label");
            lab.className = "wfmapmods-s2-label";
            lab.textContent = labelText;

            row.appendChild(lab);
            row.appendChild(inputEl);
            return row;
        }

        function makeColor(value) {
            const i = document.createElement("input");
            i.type = "color";
            i.value = value;
            return i;
        }

        function makeNum(value, min, max, step) {
            const i = document.createElement("input");
            i.type = "number";
            i.min = String(min);
            i.max = String(max);
            i.step = String(step);
            i.value = String(value);
            return i;
        }

        const sizeInput = makeNum(local.markerSize ?? 8, 2, 30, 1);

        const strokeColorInput = makeColor(local.borderColor || "#000000");
        const strokeWidthInput = makeNum(local.borderWidth ?? 2, 0, 10, 0.5);
        const strokeOpacityInput = makeNum(local.borderOpacity ?? 1, 0, 1, 0.05);

        const fillColorInput = makeColor(local.fillColor || "#000000");
        const fillOpacityInput = makeNum(local.fillOpacity ?? 1, 0, 1, 0.05);

        section.appendChild(makeRow("Marker size", sizeInput));
        section.appendChild(makeRow("Stroke colour", strokeColorInput));
        section.appendChild(makeRow("Stroke thickness (px)", strokeWidthInput));
        section.appendChild(makeRow("Stroke opacity (0–1)", strokeOpacityInput));
        section.appendChild(makeRow("Fill colour", fillColorInput));
        section.appendChild(makeRow("Fill opacity (0–1)", fillOpacityInput));

        dialog.appendChild(section);

        // Footer buttons
        const buttonsRow = document.createElement("div");
        buttonsRow.className = "wfmapmods-s2-buttons";

        const cancelBtn = document.createElement("button");
        cancelBtn.type = "button";
        cancelBtn.textContent = "Cancel";
        cancelBtn.className = "wfmapmods-s2-btn wfmapmods-s2-btn-cancel";

        const okBtn = document.createElement("button");
        okBtn.type = "button";
        okBtn.textContent = "OK";
        okBtn.className = "wfmapmods-s2-btn wfmapmods-s2-btn-ok";

        buttonsRow.appendChild(cancelBtn);
        buttonsRow.appendChild(okBtn);
        dialog.appendChild(buttonsRow);

        function close() {
            backdrop.removeEventListener("keydown", keyHandler, true);
            backdrop.remove();

            // Restore keyboard handling to the parent modal
            if (returnFocusEl) {
                // Next tick to avoid focusing something while DOM is mid-update
                setTimeout(() => {
                    returnFocusEl.tabIndex = -1;  // ensure focusable
                    returnFocusEl.focus();
                }, 0);
            }
        }

        cancelBtn.addEventListener("click", close);

        function applyInputsToLocal() {
            // Read inputs and write back into local before returning it.
            local.markerSize = clamp(sizeInput.value, 2, 30, local.markerSize ?? 8);

            local.borderColor = strokeColorInput.value || local.borderColor || "#000000";
            local.borderWidth = clamp(strokeWidthInput.value, 0, 10, local.borderWidth ?? 2);
            local.borderOpacity = clamp(strokeOpacityInput.value, 0, 1, local.borderOpacity ?? 1);

            local.fillColor = fillColorInput.value || local.fillColor || "#000000";
            local.fillOpacity = clamp(fillOpacityInput.value, 0, 1, local.fillOpacity ?? 1);
        }

        okBtn.addEventListener("click", () => {
            applyInputsToLocal();
            if (typeof onApply === "function") onApply(deepClone(local));
            close();
        });

        let pointerDownOnBackdrop = false;

        // Record where the interaction starts
        backdrop.addEventListener("pointerdown", (ev) => {
            pointerDownOnBackdrop = (ev.target === backdrop);
        });

        // Close only if it both started AND ended on the backdrop
        backdrop.addEventListener("pointerup", (ev) => {
            if (pointerDownOnBackdrop && ev.target === backdrop) {
                close();
            }
            pointerDownOnBackdrop = false;
        });

        // Safety reset (e.g., pointer is cancelled)
        backdrop.addEventListener("pointercancel", () => {
            pointerDownOnBackdrop = false;
        });

        // Capture key events so Enter/Escape do not bubble to the parent modal.
        function keyHandler(ev) {
            if (ev.key === "Escape") {
                ev.preventDefault();
                ev.stopPropagation();
                close();
            } else if (ev.key === "Enter") {
                ev.preventDefault();
                ev.stopPropagation();
                okBtn.click();
            }
        }
        backdrop.addEventListener("keydown", keyHandler, true);

        backdrop.appendChild(dialog);
        document.body.appendChild(backdrop);

        dialog.tabIndex = -1;
        dialog.focus();
    }

    function replicateMarkerStylesFromBaseIntoDraft(draftPoiMarkers) {
        try {
            const raw = localStorage.getItem("wfmap_settings");
            if (!raw) {
                return { ok: false, message: "Base settings not found in local storage." };
            }

            const base = JSON.parse(raw);
            const styles = base?.poi?.appearance?.styles;
            if (!styles) {
                return { ok: false, message: "Base settings structure not found." };
            }

            const mapping = [
                { bucket: "community:pokestop", target: "stop" },
                { bucket: "community:gym", target: "gym" },
                { bucket: "community:powerspot", target: "powerspot" }
            ];

            let changed = false;

            for (const { bucket, target } of mapping) {
                const generic = styles?.[bucket]?.generic;
                if (!generic) {
                    return { ok: false, message: `Base settings missing ${bucket}.generic.` };
                }

                const targetCfg = draftPoiMarkers[target];

                const fields = [
                    "markerSize",
                    "borderColor",
                    "borderWidth",
                    "borderOpacity",
                    "fillColor",
                    "fillOpacity"
                ];

                for (const field of fields) {
                    if (targetCfg[field] !== generic[field]) {
                        changed = true;
                        targetCfg[field] = generic[field];
                    }
                }
            }

            return {
                ok: true,
                changed
            };
        } catch (e) {
            console.error("Failed to replicate marker styles from wfmap_settings:", e);
            return { ok: false, message: "Failed to read base settings." };
        }
    }

    function renderMarkerPreviewButton(btn, cfg, hexToRgba) {
        btn.innerHTML = markerPreviewSvg(cfg, hexToRgba);
    }

    function markerPreviewSvg(cfg, hexToRgba) {
        const r = typeof cfg.markerSize === "number" ? cfg.markerSize : 8;
        const strokeW = typeof cfg.borderWidth === "number" ? cfg.borderWidth : 2;

        const strokeOp = typeof cfg.borderOpacity === "number" ? cfg.borderOpacity : 1;
        const fillOp = typeof cfg.fillOpacity === "number" ? cfg.fillOpacity : 1;

        // Your existing helper converts hex + opacity to an rgba() string.
        const stroke = hexToRgba(cfg.borderColor || "#000000", clamp(strokeOp, 0, 1, 1));
        const fill = hexToRgba(cfg.fillColor || "#000000", clamp(fillOp, 0, 1, 1));

        return `
    <svg width="44" height="44" viewBox="0 0 44 44" aria-hidden="true" focusable="false">
      <circle cx="22" cy="22" r="${r}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeW}"></circle>
    </svg>
  `;
    }

    function showToastNearElement(anchorEl, message, durationMs = 1200) {
        // Remove any existing toast
        const existing = document.getElementById("wfmapmods-s2-toast");
        if (existing) existing.remove();

        const toast = document.createElement("div");
        toast.id = "wfmapmods-s2-toast";
        toast.className = "wfmapmods-s2-toast";
        toast.textContent = message;

        document.body.appendChild(toast);

        // Position after it's in the DOM (so we can measure it)
        const a = anchorEl.getBoundingClientRect();
        const t = toast.getBoundingClientRect();

        // Prefer above the link; if not enough room, put below
        const padding = 8;
        let top = a.top - t.height - padding;
        if (top < 8) top = a.bottom + padding;

        // Center horizontally over the link, clamped to viewport
        let left = a.left + (a.width / 2) - (t.width / 2);
        left = Math.max(8, Math.min(left, window.innerWidth - t.width - 8));

        toast.style.top = `${Math.round(top)}px`;
        toast.style.left = `${Math.round(left)}px`;

        // Show
        requestAnimationFrame(() => toast.classList.add("wfmapmods-s2-toast--show"));

        // Hide then remove
        window.setTimeout(() => {
            toast.classList.remove("wfmapmods-s2-toast--show");
            window.setTimeout(() => toast.remove(), 150);
        }, durationMs);
    }

    function deepClone(obj) {
        return JSON.parse(JSON.stringify(obj));
    }


    // ==================================
    // Manual import: map button 
    // ==================================

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

    function setManualImportCursor(enabled) {
        if (!wfMap) return;
        wfMap.setOptions({ draggableCursor: enabled ? "default" : null });
    }

    function insertManualImportMapButton() {
        if (!wfMap || !google.maps) return;
        if (manualImportControlEl) return;

        const btn = document.createElement("button");
        manualImportControlEl = btn;

        btn.type = "button";
        btn.title = "Add manual Pokémon GO POI (click map)";
        btn.setAttribute("aria-label", "Add manual Pokémon GO POI");
        btn.className = "wf-manual-import-btn";
        btn.dataset.wfToggleGroup = WF_TOGGLE_GROUP;

        // icon
        const iconWrap = document.createElement("div");
        iconWrap.innerHTML = MANUAL_IMPORT_SVG;

        const svg = iconWrap.querySelector("svg");
        if (svg) {
            svg.setAttribute("width", "24");
            svg.setAttribute("height", "24");
            // Keep icon dark; active state is background only
            svg.style.fill = "#111827";
            svg.style.stroke = "#111827";
        }
        btn.appendChild(iconWrap);

        // Click toggles mode (does NOT open modal immediately)
        btn.addEventListener("click", (e) => {
            e.preventDefault();
            e.stopPropagation();

            wfExclusiveToggle(btn, WF_TOGGLE_GROUP);
            syncManualImportEnabledFromDom();
        });

        // Add to map controls
        wfMap.controls[google.maps.ControlPosition.LEFT_TOP].push(btn);

        // React if other plugins steal the active class
        observeManualImportClass();

        // Start disabled on load
        syncManualImportEnabledFromDom();
    }

    // Remove the control from DOM on teardown (optional but tidy)
    function removeManualImportMapButton() {
        disableManualImportMode();

        if (manualImportClassObserver) {
            manualImportClassObserver.disconnect();
            manualImportClassObserver = null;
        }

        if (manualImportControlEl?.parentNode) {
            manualImportControlEl.parentNode.removeChild(manualImportControlEl);
        }
        manualImportControlEl = null;
    }

    function syncManualImportEnabledFromDom() {
        const enabled = !!manualImportControlEl?.classList.contains(WF_TOGGLE_ACTIVE_CLASS);
        if (enabled) enableManualImportMode();
        else disableManualImportMode();
    }

    function observeManualImportClass() {
        if (!manualImportControlEl) return;
        if (manualImportClassObserver) manualImportClassObserver.disconnect();

        manualImportClassObserver = new MutationObserver(syncManualImportEnabledFromDom);
        manualImportClassObserver.observe(manualImportControlEl, {
            attributes: true,
            attributeFilter: ["class"],
        });
    }

    function enableManualImportMode() {
        if (!wfMap || !google?.maps) return;
        if (manualImportMapClickListener) return;

        setManualImportCursor(true);

        manualImportMapClickListener = wfMap.addListener("click", (e) => {
            if (!e?.latLng) return;
            const lat = e.latLng.lat();
            const lng = e.latLng.lng();

            openManualImportDialog({ mode: "create", clickedLat: lat, clickedLng: lng });
        });
    }

    function disableManualImportMode() {
        if (manualImportMapClickListener) {
            google.maps.event.removeListener(manualImportMapClickListener);
            manualImportMapClickListener = null;
        }

        setManualImportCursor(false);
    }

    // ==================================
    // Manual import dialog
    // ==================================

    // Create a unique id for manually added Stops/Gyms.
    // No guid as they are not live Wayspots
    function generateManualImportId(lat, lng) {
        const ts = Date.now();
        const rand = Math.random().toString(16).slice(2, 10);
        const latStr = (typeof lat === "number" && Number.isFinite(lat)) ? lat.toFixed(6) : "x";
        const lngStr = (typeof lng === "number" && Number.isFinite(lng)) ? lng.toFixed(6) : "y";
        return `s2-pogo-${ts}-${rand}-${latStr},${lngStr}`;
    }

    // Best guess for “current” location.
    // 1) use submission marker coords if you track them
    // 2) else use map centre
    function getManualImportDefaultLatLng() {
        if (typeof submitCellLat === "number" && Number.isFinite(submitCellLat) &&
            typeof submitCellLng === "number" && Number.isFinite(submitCellLng)) {
            return { lat: submitCellLat, lng: submitCellLng };
        }

        if (wfMap && typeof wfMap.getCenter === "function") {
            const c = wfMap.getCenter();
            if (c && typeof c.lat === "function" && typeof c.lng === "function") {
                return { lat: c.lat(), lng: c.lng() };
            }
        }

        return { lat: null, lng: null };
    }

    function openManualImportDialog({ mode = "create", poi = null, clickedLat = null, clickedLng = null } = {}) {
        const isEdit = mode === "edit" && poi && poi.id;

        // Resolve starting coordinates safely
        let lat = null, lng = null;

        if (isEdit) {
            lat = Number.isFinite(poi.lat) ? poi.lat : null;
            lng = Number.isFinite(poi.lng) ? poi.lng : null;
        } else {
            // Create mode: prefer clicked, else fallback
            const fallback = getManualImportDefaultLatLng();

            const latCandidate = (typeof clickedLat === "number" && Number.isFinite(clickedLat)) ? clickedLat : fallback.lat;
            const lngCandidate = (typeof clickedLng === "number" && Number.isFinite(clickedLng)) ? clickedLng : fallback.lng;

            lat = (typeof latCandidate === "number" && Number.isFinite(latCandidate)) ? Number(latCandidate.toFixed(6)) : null;
            lng = (typeof lngCandidate === "number" && Number.isFinite(lngCandidate)) ? Number(lngCandidate.toFixed(6)) : null;
        }

        // Backdrop
        const backdrop = document.createElement("div");
        backdrop.className = "wfmapmods-s2-backdrop";
        backdrop.tabIndex = -1;

        // Dialog
        const dialog = document.createElement("div");
        dialog.className = "wfmapmods-s2-dialog wfmapmods-s2-dialog--poi";
        dialog.tabIndex = -1;

        const title = document.createElement("div");
        title.className = "wfmapmods-s2-title";
        title.textContent = isEdit ? "Edit manual Pokémon GO POI" : "Add manual Pokémon GO POI";

        const hint = document.createElement("div");
        hint.className = "wfmapmods-manualimport-hint";
        hint.textContent = "Add Pokéstops and Gyms not on the map (e.g. Sponsored, imports)";

        function row(labelText, inputEl) {
            const wrap = document.createElement("div");
            Object.assign(wrap.style, { display: "flex", flexDirection: "column", gap: "4px" });

            const lab = document.createElement("div");
            lab.textContent = labelText;
            Object.assign(lab.style, { fontSize: "12px", fontWeight: "600" });

            Object.assign(inputEl.style, {
                fontSize: "12px",
                padding: "6px 8px",
                border: "1px solid #d1d5db",
                borderRadius: "6px"
            });

            wrap.appendChild(lab);
            wrap.appendChild(inputEl);
            return wrap;
        }

        // Type
        const typeSel = document.createElement("select");
        ["stop", "gym", "powerspot"].forEach(t => {
            const opt = document.createElement("option");
            opt.value = t;
            opt.textContent = (t === "stop") ? "PokéStop" : (t === "gym") ? "Gym" : "Power Spot";
            typeSel.appendChild(opt);
        });

        // Title
        const titleIn = document.createElement("input");
        titleIn.type = "text";
        titleIn.placeholder = "Title (required)";

        // Lat/Lng
        const latIn = document.createElement("input");
        latIn.type = "number";
        latIn.step = "0.000001";
        latIn.placeholder = "Latitude";
        if (Number.isFinite(lat)) latIn.value = String(lat);

        const lngIn = document.createElement("input");
        lngIn.type = "number";
        lngIn.step = "0.000001";
        lngIn.placeholder = "Longitude";
        if (Number.isFinite(lng)) lngIn.value = String(lng);

        // Image URL
        const imgIn = document.createElement("input");
        imgIn.type = "text";
        imgIn.placeholder = "Image URL (optional)";

        const statusLine = document.createElement("div");
        Object.assign(statusLine.style, { fontSize: "11px", color: "#6b7280", minHeight: "14px" });

        // Prefill in edit mode
        if (isEdit) {
            typeSel.value = poi.poiType || "stop";
            titleIn.value = poi.title || "";
            if (Number.isFinite(poi.lat)) latIn.value = String(poi.lat);
            if (Number.isFinite(poi.lng)) lngIn.value = String(poi.lng);
            imgIn.value = poi.imageUrl || "";
        }

        // Buttons
        const btnRow = document.createElement("div");
        btnRow.className = "wfmapmods-s2-buttons";

        const cancelBtn = document.createElement("button");
        cancelBtn.type = "button";
        cancelBtn.className = "wfmapmods-s2-btn wfmapmods-s2-btn-cancel";
        cancelBtn.textContent = "Cancel";

        const saveBtn = document.createElement("button");
        saveBtn.type = "button";
        saveBtn.className = "wfmapmods-s2-btn wfmapmods-s2-btn-ok";
        saveBtn.textContent = "Save";

        // Delete (edit only)
        let deleteBtn = null;
        if (isEdit) {
            deleteBtn = document.createElement("button");
            deleteBtn.type = "button";
            deleteBtn.className = "wfmapmods-s2-btn wfmapmods-s2-btn-danger";
            deleteBtn.textContent = "Delete";
            btnRow.appendChild(deleteBtn);
        }

        btnRow.appendChild(cancelBtn);
        btnRow.appendChild(saveBtn);

        dialog.appendChild(title);
        dialog.appendChild(hint);
        dialog.appendChild(row("Type", typeSel));
        dialog.appendChild(row("Title", titleIn));
        dialog.appendChild(row("Latitude", latIn));
        dialog.appendChild(row("Longitude", lngIn));
        dialog.appendChild(row("Image URL", imgIn));
        dialog.appendChild(statusLine);
        dialog.appendChild(btnRow);

        backdrop.appendChild(dialog);
        document.body.appendChild(backdrop);
        dialog.focus();

        function close() {
            backdrop.remove();
        }

        backdrop.addEventListener("click", (ev) => {
            if (ev.target === backdrop) close();
        });

        cancelBtn.addEventListener("click", close);

        // Escape closes
        backdrop.addEventListener("keydown", (ev) => {
            if (ev.key === "Escape") {
                ev.preventDefault();
                ev.stopPropagation();
                close();
            }
        });

        if (deleteBtn) {
            deleteBtn.addEventListener("click", async () => {
                if (!poi?.id) return;
                if (!confirm("Delete this manual POI?")) return;

                deleteBtn.disabled = true;
                saveBtn.disabled = true;
                cancelBtn.disabled = true;
                statusLine.textContent = "Deleting…";

                try {
                    await deleteManualPoiFromIDB(poi.id);
                    clearSelection(); // optional: remove highlight
                    statusLine.textContent = "Deleted.";
                    close();
                } catch (e) {
                    console.error("[S2] manual import delete failed:", e);
                    statusLine.textContent = "Delete failed (see console).";
                    deleteBtn.disabled = false;
                    saveBtn.disabled = false;
                    cancelBtn.disabled = false;
                }
            });
        }

        saveBtn.addEventListener("click", async () => {
            const poiType = typeSel.value;
            const titleVal = (titleIn.value || "").trim();
            const latVal = Number(latIn.value);
            const lngVal = Number(lngIn.value);
            const imageUrl = (imgIn.value || "").trim();

            if (!titleVal) { statusLine.textContent = "Title is required."; return; }
            if (!Number.isFinite(latVal) || !Number.isFinite(lngVal)) {
                statusLine.textContent = "Latitude/Longitude must be valid numbers.";
                return;
            }

            saveBtn.disabled = true;
            cancelBtn.disabled = true;
            if (deleteBtn) deleteBtn.disabled = true;
            statusLine.textContent = "Saving…";

            try {
                // If editing, preserve the same record unless coords changed
                let id = isEdit ? poi.id : generateManualImportId(latVal, lngVal);

                const coordsChanged =
                      isEdit &&
                      (Number.isFinite(poi.lat) && Number.isFinite(poi.lng)) &&
                      (poi.lat !== latVal || poi.lng !== lngVal);

                // If coords changed, treat as "move": new id, delete old
                if (coordsChanged) {
                    const newId = generateManualImportId(latVal, lngVal);
                    await deleteManualPoiFromIDB(poi.id);
                    id = newId;
                }

                const record = {
                    id,
                    guid: null,
                    lat: latVal,
                    lng: lngVal,
                    title: titleVal,
                    description: "",
                    imageUrl: imageUrl,
                    status: "MANUAL IMPORT",
                    game: "pokemon-go",
                    poiType,
                    updatedAt: Date.now(),
                    _iitcGuid: id
                };

                await saveManualPoiToIDB(record);
                sendPoiToBridge(record);

                statusLine.textContent = "Saved.";
                close();
            } catch (e) {
                console.error("[S2] manual import save failed:", e);
                statusLine.textContent = "Save failed (see console).";
                saveBtn.disabled = false;
                cancelBtn.disabled = false;
                if (deleteBtn) deleteBtn.disabled = false;
            }
        });
    }

    // ==================================
    // Mapview / GCS interception (game status)
    // ==================================
    (function hookMapviewGcsXHR() {
        const XHR = window.XMLHttpRequest || XMLHttpRequest;

        const origOpen = XHR.prototype.open;
        const origSend = XHR.prototype.send;

        XHR.prototype.open = function(method, url, ...rest) {
            this._wfmm_url = url;
            return origOpen.call(this, method, url, ...rest);
        };

        XHR.prototype.send = function(...args) {
            if (this._wfmm_url && this._wfmm_url.includes("/api/v1/vault/mapview/gcs")) {

                // Track what the native site queried (includes its own padding)
                const thisStamp = ++gcsLastQueryStamp;
                const qb = parseNeSwFromMapviewUrl(this._wfmm_url);
                if (qb) gcsLastQueryBounds = qb;

                this.addEventListener("load", () => {
                    try {
                        // Ignore out-of-order responses: only the latest request should mark "complete"
                        if (thisStamp !== gcsLastQueryStamp) return;

                        // Mark that the latest query has completed
                        gcsLastCompletedStamp = thisStamp;

                        const json = JSON.parse(this.responseText || "{}");

                        const parsed = parseMapviewGcsPois(json);
                        updateL14GcsCountsCache(parsed, gcsLastQueryBounds);
                        pruneL14GcsCache?.();

                        // Only update + redraw if it meaningfully changed
                        const sig = buildMapviewSignature(parsed);
                        if (sig !== mapviewPoisSignature) {
                            mapviewPoisSignature = sig;
                            mapviewGamePois = parsed;

                            // Force shading/stats cache invalidation + redraw
                            bumpShadePoiVersion();
                            shadePoiCells();
                            refreshManualPoiMarkers?.();
                        } else {
                            // Even if POIs didn't change, the completion state may have changed;
                            // we still need a redraw so labels can appear once query is complete.
                            // bumpShadePoiVersion();
                            shadePoiCells();
                        }

                    } catch (e) {
                        console.warn("[S2] Failed to parse mapview/gcs response:", e);
                    }
                });
            }

            return origSend.apply(this, args);
        };

        // ---------- helpers ----------

        function parseMapviewGcsPois(json) {
            const out = [];

            const ok = json?.result?.success === true;
            const data = Array.isArray(json?.result?.data) ? json.result.data : null;
            if (!ok || !data) return out;

            for (const cellBlock of data) {
                const pois = Array.isArray(cellBlock?.pois) ? cellBlock.pois : [];
                for (const p of pois) {
                    if (!p) continue;

                    const gmo = Array.isArray(p.gmo) ? p.gmo : [];
                    const pogo = pickActiveHoloHoloEntity(gmo);
                    if (!pogo) continue; // not an ACTIVE HOLOHOLO stop/gym

                    const lat = typeof p.latE6 === "number" ? (p.latE6 / 1e6) : null;
                    const lng = typeof p.lngE6 === "number" ? (p.lngE6 / 1e6) : null;
                    if (lat == null || lng == null) continue;

                    // poiId is the Wayfarer GUID
                    const guid = p.poiId || null;
                    if (!guid) continue;

                    // Normalise to your existing data model used by shading
                    out.push({
                        id: guid,
                        guid: guid,
                        lat,
                        lng,
                        title: p.title || "",
                        description: p.description || "",
                        imageUrl: p.mainImage || "",
                        poiType: pogo === "GYM" ? "gym" : "stop",
                        game: "pokemon-go",
                        status: "LIVE",
                        source: "mapview-gcs",
                        updatedAt: Date.now()
                    });
                }
            }

            return out;
        }

        function pickActiveHoloHoloEntity(gmoArr) {
            // Prefer GYM over POKESTOP if somehow both appear.
            let hasStop = false;

            for (const g of gmoArr) {
                if (!g) continue;
                if (g.gameBrand !== "HOLOHOLO") continue;
                if (g.status !== "ACTIVE") continue;

                if (g.entity === "GYM") return "GYM";
                if (g.entity === "POKESTOP") hasStop = true;
            }

            return hasStop ? "POKESTOP" : null;
        }

        function buildMapviewSignature(list) {
            // Cheap signature: count + sorted stable keys
            const keys = (list || []).map(p => `${p.guid}@${p.poiType}`).sort();
            return `${keys.length}|${keys.join(",")}`;
        }
    })();

    function updateL14GcsCountsCache(gcsPois, queryBounds) {
        if (!queryBounds) return;
        if (!Array.isArray(gcsPois) || !gcsPois.length) return;

        const L14_LEVEL = 14;

        // 1) Count this response's GCS POIs per L14
        const tmp = new Map(); // cellId -> { cell, gcsItems, gcsGyms }

        for (const p of gcsPois) {
            if (!p || typeof p.lat !== "number" || typeof p.lng !== "number") continue;

            const cell = S2.S2Cell.FromLatLng({ lat: p.lat, lng: p.lng }, L14_LEVEL);
            const cellId = cell.toString();

            let info = tmp.get(cellId);
            if (!info) {
                info = { cell, gcsItems: 0, gcsGyms: 0 };
                tmp.set(cellId, info);
            }

            info.gcsItems++;
            if (p.poiType === "gym") info.gcsGyms++;
        }

        // 2) Only promote counts into the long-lived cache if the L14 cell is "complete"
        const now = Date.now();

        for (const [cellId, info] of tmp.entries()) {
            const centre = getCellCentreLatLng(info.cell);
            if (!centre) continue;

            // Your completeness rule: L14 centre inside last query bounds
            if (!pointInQueryBounds(centre, queryBounds)) continue;

            l14GcsCountsByCellId.set(cellId, {
                cell: info.cell,
                gcsItems: info.gcsItems,
                gcsGyms: info.gcsGyms,
                confirmedAt: now
            });
        }
    }

    function pruneL14GcsCache(max = 2500) {
        if (l14GcsCountsByCellId.size <= max) return;

        const entries = [...l14GcsCountsByCellId.entries()]
        .sort((a, b) => (a[1].confirmedAt || 0) - (b[1].confirmedAt || 0));

        const remove = entries.length - max;
        for (let i = 0; i < remove; i++) {
            l14GcsCountsByCellId.delete(entries[i][0]);
        }
    }

    function isPogoStopGym(p) {
        return p &&
            p.game === "pokemon-go" &&
            (p.poiType === "stop" || p.poiType === "gym") &&
            typeof p.lat === "number" &&
            typeof p.lng === "number";
    }

    function isPogoMarkerType(p) {
        // For markers we want stop/gym/powerspot
        return p &&
            p.game === "pokemon-go" &&
            (p.poiType === "stop" || p.poiType === "gym" || p.poiType === "powerspot") &&
            typeof p.lat === "number" &&
            typeof p.lng === "number";
    }

    function getManualPoisArray() {
        return manualPois ? Array.from(manualPois.values()) : [];
    }

    function getManualStopGymArray() {
        return getManualPoisArray().filter(isPogoStopGym);
    }

    function getManualMarkerPoisArray() {
        return getManualPoisArray().filter(isPogoMarkerType);
    }

    // ==================================
    // GCS L14 cell counter processing
    // ==================================

    function parseNeSwFromMapviewUrl(url) {
        try {
            const u = new URL(url, location.origin);
            const neRaw = u.searchParams.get("ne");
            const swRaw = u.searchParams.get("sw");
            if (!neRaw || !swRaw) return null;

            const parsePair = (s) => {
                // "(lat,lng)" or "lat,lng"
                const cleaned = String(s).replace(/[()]/g, "").trim();
                const parts = cleaned.split(",").map(v => v.trim());
                if (parts.length < 2) return null;
                const lat = Number(parts[0]);
                const lng = Number(parts[1]);
                if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
                return { lat, lng };
            };

            const ne = parsePair(neRaw);
            const sw = parsePair(swRaw);
            if (!ne || !sw) return null;

            // normalize (just in case)
            return {
                ne: { lat: Math.max(ne.lat, sw.lat), lng: Math.max(ne.lng, sw.lng) },
                sw: { lat: Math.min(ne.lat, sw.lat), lng: Math.min(ne.lng, sw.lng) }
            };
        } catch {
            return null;
        }
    }

    function pointInQueryBounds(pt, qb) {
        if (!pt || !qb) return false;
        return (
            pt.lat >= qb.sw.lat && pt.lat <= qb.ne.lat &&
            pt.lng >= qb.sw.lng && pt.lng <= qb.ne.lng
        );
    }

    function getCellCentreLatLng(cell) {
        // Your S2 cell lib exposes getLatLng() -> {lat,lng}
        try {
            const c = cell.getLatLng();
            if (!c) return null;
            return { lat: c.lat, lng: c.lng };
        } catch {
            return null;
        }
    }

    // Gate L14 labels when using mapview/gcs to avoid undercount flicker.
    function canShowL14CounterLabel(cell) {
        if (!cell) return false;
        return l14GcsCountsByCellId.has(cell.toString());
    }

    // ==================================
    // S2 grid overlay (lines)
    // ==================================

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

            // if (map.getZoom() < GCS_MIN_ZOOM) return;

            if (gridLevel >= 2 && gridLevel < (map.getZoom())) {
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
                clickable: false,
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

            let minLat = Infinity, maxLat = -Infinity;
            let minLng = Infinity, maxLng = -Infinity;

            for (const c of corners) {
                const lat = typeof c.lat === "function" ? c.lat() : c.lat;
                const lng = typeof c.lng === "function" ? c.lng() : c.lng;
                if (lat < minLat) minLat = lat;
                if (lat > maxLat) maxLat = lat;
                if (lng < minLng) minLng = lng;
                if (lng > maxLng) maxLng = lng;
            }

            const bne = mapBounds.getNorthEast();
            const bsw = mapBounds.getSouthWest();

            if (maxLat < bsw.lat() || minLat > bne.lat()) return false;
            if (maxLng < bsw.lng() || minLng > bne.lng()) return false;
            return true;
        }
    }

    // Compute which S2 grid layers should be drawn
    function getEnabledS2Layers() {
        const layers = [];
        const { master, primary, secondary } = userSettings;

        // Disable if turned off via layers option
        if (!master || master.enabled === false) {
            return layers;
        }

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

    function computeGridKey() {
        const z = wfMap.getZoom();
        const b = wfMap.getBounds();
        if (!b) return "";

        const ne = b.getNorthEast(), sw = b.getSouthWest();
        const layers = getEnabledS2Layers()
        .slice()
        .sort((a,b) => a.level - b.level)
        .map(l => `${l.level}:${l.color}:${l.lineWidth}:${l.lineOpacity}`)
        .join("|");

        // Quantise bounds so tiny pans don't force a redraw
        const q = (n) => Math.round(n * 2000) / 2000; // ~0.0005 deg (~55m) step
        return `${z}|${q(sw.lat())},${q(sw.lng())}|${q(ne.lat())},${q(ne.lng())}|${layers}`;
    }

    async function drawS2Grid() {
        if (!wfMap || !s2Overlay) return;

        const layers = getEnabledS2Layers();
        if (!layers.length) return;

        // Draw from smallest cells to largest so larger grid lines end up on top.
        layers.sort((a, b) => a.level - b.level);

        for (let i = layers.length - 1; i >= 0; i--) {
            const layer = layers[i];
            await s2Overlay.drawCellGrid(
                wfMap,
                layer.level,
                layer.color,
                layer.lineWidth,
                layer.lineOpacity
            );
        }
    }

    function updateS2Grid() {
        if (!wfMap || !s2Overlay) return;

        const key = computeGridKey();
        if (key && key === lastGridKey) return;
        lastGridKey = key;

        s2Overlay.clear();
        drawS2Grid();
    }

    function initS2Overlay() {
        if (!wfMap) return;
        if (s2Overlay) return;

        s2Overlay = new S2Overlay();

        drawS2Grid();
        shadePoiCells();
        refreshManualPoiMarkers();

        idleListener = wfMap.addListener("idle", () => {
            updateS2Grid();
            shadePoiCells();
            refreshManualPoiMarkers();
        });

        mapAttached = true;

        insertManualImportMapButton();
    }

    // ==================================
    // Shading and Stats Helpers
    // ==================================

    function bumpShadePoiVersion() {
        shadePoiVersion++;
        lastShadeKey = "";
        allPoisCache = null;
        l17CountsCache = null;
        l14StatsCache = null;
    }

    function getPoisForShadingCached() {
        if (allPoisCache) return allPoisCache;

        const manualStopGym = getManualStopGymArray();
        const gcs = Array.isArray(mapviewGamePois) ? mapviewGamePois : [];

        // live (gcs) is already stop/gym from your parser; manual adds sponsored/etc
        allPoisCache = gcs.concat(manualStopGym);
        return allPoisCache;
    }

    function buildL17Counts(allPois) {
        const counts = new Map();
        for (const p of allPois) {
            const cell = S2.S2Cell.FromLatLng({ lat: p.lat, lng: p.lng }, POI_CELL_LEVEL);
            const cellId = cell.toString();
            let info = counts.get(cellId);
            if (!info) {
                info = { cell, count: 0 };
                counts.set(cellId, info);
            }
            info.count++;
        }
        return counts;
    }

    function buildL14Stats(allPois) {
        const L14_LEVEL = 14;
        const stats = new Map();
        for (const p of allPois) {
            const cell = S2.S2Cell.FromLatLng({ lat: p.lat, lng: p.lng }, L14_LEVEL);
            const cellId = cell.toString();
            let info = stats.get(cellId);
            if (!info) {
                info = { cell, gameItems: 0, gyms: 0 };
                stats.set(cellId, info);
            }
            info.gameItems++;
            if (p.poiType === "gym") info.gyms++;
        }
        return stats;
    }

    function buildL14StatsFromCachedCounts(drawBounds) {
        const L14_LEVEL = 14;
        const stats = new Map();

        // 1) Start with cached GCS counts (ONLY for confirmed-complete L14s)
        for (const [cellId, rec] of l14GcsCountsByCellId.entries()) {
            const cell = rec?.cell;
            if (!cell) continue;

            if (drawBounds && !cellIntersectsBounds(cell, drawBounds)) continue;

            stats.set(cellId, {
                cell,
                gameItems: rec.gcsItems || 0, // stops+gyms
                gyms: rec.gcsGyms || 0
            });
        }

        // 2) Add manual stops/gyms on top (manual powerspots are intentionally excluded)
        for (const p of getManualStopGymArray()) {
            const cell = S2.S2Cell.FromLatLng({ lat: p.lat, lng: p.lng }, L14_LEVEL);
            const cellId = cell.toString();

            if (drawBounds && !cellIntersectsBounds(cell, drawBounds)) continue;

            let info = stats.get(cellId);
            if (!info) {
                info = { cell, gameItems: 0, gyms: 0 };
                stats.set(cellId, info);
            }

            info.gameItems++;
            if (p.poiType === "gym") info.gyms++;
        }

        return stats;
    }

    // Similar idea to your grid key: skip if nothing meaningful changed
    function computeShadeKey() {
        if (!wfMap) return "";

        const z = wfMap.getZoom();
        const b = wfMap.getBounds?.();
        if (!b || typeof z !== "number") return "";

        // Quantise bounds to avoid tiny pan redraws
        const q = (n) => Math.round(n * 2000) / 2000;
        const ne = b.getNorthEast(), sw = b.getSouthWest();

        const s2 = userSettings.poiCells || {};
        const l14 = userSettings.l14Cells || {};

        const settingsKey = [
            !!s2.enabled, s2.color, s2.fillOpacity,
            !!l14.enabled, !!l14.showLabels,
            l14.undercrowdedColor, l14.undercrowdedOpacity,
            l14.overcrowdedColor, l14.overcrowdedOpacity,
            l14.shadeUndercrowded !== false,
            l14.shadeOvercrowded !== false
        ].join("|");

        // include version so POI changes force refresh
        return `${z}|${q(sw.lat())},${q(sw.lng())}|${q(ne.lat())},${q(ne.lng())}|v${shadePoiVersion}|${settingsKey}`;
    }

    function expandBounds(bounds, padFrac = 0.15) {
        // padFrac = 0.15 means extend by 15% each direction (reduces edge popping)
        const ne = bounds.getNorthEast();
        const sw = bounds.getSouthWest();

        const latSpan = ne.lat() - sw.lat();
        const lngSpan = ne.lng() - sw.lng();

        const padLat = latSpan * padFrac;
        const padLng = lngSpan * padFrac;

        const exSw = new google.maps.LatLng(sw.lat() - padLat, sw.lng() - padLng);
        const exNe = new google.maps.LatLng(ne.lat() + padLat, ne.lng() + padLng);

        return new google.maps.LatLngBounds(exSw, exNe);
    }

    function cellIntersectsBounds(cell, bounds) {
        // Fast bbox test using the cell’s corners
        const corners = cell.getCornerLatLngs();

        let minLat = Infinity, maxLat = -Infinity;
        let minLng = Infinity, maxLng = -Infinity;

        for (const c of corners) {
            const lat = (typeof c.lat === "function") ? c.lat() : c.lat;
            const lng = (typeof c.lng === "function") ? c.lng() : c.lng;
            if (lat < minLat) minLat = lat;
            if (lat > maxLat) maxLat = lat;
            if (lng < minLng) minLng = lng;
            if (lng > maxLng) maxLng = lng;
        }

        const bne = bounds.getNorthEast();
        const bsw = bounds.getSouthWest();

        // bbox intersection
        if (maxLat < bsw.lat() || minLat > bne.lat()) return false;
        if (maxLng < bsw.lng() || minLng > bne.lng()) return false;
        return true;
    }

    // ==================================
    // Cell shading + L14 gym overlays
    // ==================================

    function clearPoiCellPolygons() {
        clearL17ShadingOnly();
        clearL14ShadingOnly();
    }

    function clearL17ShadingOnly() {
        for (const [, entry] of l17ShadeByCellId) {
            if (entry?.polys?.length) {
                for (const poly of entry.polys) {
                    if (poly?.setMap) poly.setMap(null);
                }
            }
        }
        l17ShadeByCellId.clear();
    }

    function clearL14ShadingOnly() {
        for (const [, poly] of l14ShadeByCellId) {
            if (poly?.setMap) poly.setMap(null);
        }
        l14ShadeByCellId.clear();

        // labels already have their own reuse logic; easiest is to remove them when layer off
        if (Array.isArray(l14CellLabels)) {
            for (const m of l14CellLabels) if (m?.setMap) m.setMap(null);
        }
        l14CellLabels = [];
    }

    function getCellCenterFromCorners(cell) {
        const corners = cell.getCornerLatLngs();
        let sumLat = 0, sumLng = 0, count = 0;
        corners.forEach(c => {
            const lat = typeof c.lat === "function" ? c.lat() : c.lat;
            const lng = typeof c.lng === "function" ? c.lng() : c.lng;
            sumLat += lat;
            sumLng += lng;
            count++;
        });
        return { lat: sumLat / count, lng: sumLng / count };
    }

    function computeExpectedGyms(gameItems) {
        if (gameItems < 2) return 0;
        if (gameItems < 6) return 1;
        if (gameItems < 20) return 2;
        return 3; // Niantic cap
    }

    function computeRemainingToNextGym(gameItems, gyms) {
        // Already at or above the cap – no further gyms possible
        if (gyms >= GYM_THRESHOLDS.length) {
            return null;
        }

        // Which gym are we working towards?
        // 0 gyms -> threshold[0] (1st gym)
        // 1 gym  -> threshold[1] (2nd gym)
        // 2 gyms -> threshold[2] (3rd gym)
        const targetIndex = gyms;
        let targetItems = GYM_THRESHOLDS[targetIndex];

        // If we've already passed that threshold (overfull / not upgraded yet),
        // move on to the next one, if any.
        if (gameItems >= targetItems) {
            const nextIndex = targetIndex + 1;
            if (nextIndex >= GYM_THRESHOLDS.length) {
                // No more thresholds (already at max gym tier for this cell)
                return null;
            }
            targetItems = GYM_THRESHOLDS[nextIndex];
        }

        const remaining = targetItems - gameItems;
        return remaining > 0 ? remaining : 0;
    }

    function shadePoiCells() {
        if (!wfMap) return;
        if (!userSettings.master || userSettings.master.enabled === false) return;

        const key = computeShadeKey();
        if (key && key === lastShadeKey) return;
        lastShadeKey = key;

        const s2Settings = userSettings.poiCells || {};
        const l14 = userSettings.l14Cells || {};

        const zoom = wfMap.getZoom();
        if (typeof zoom !== "number") return;

        const bounds = wfMap.getBounds?.();
        if (!bounds) return;

        const drawBounds = expandBounds(bounds, 0.15);

        const allPois = getPoisForShadingCached();

        if (!allPois.length) {
            clearPoiCellPolygons();
            return;
        }

        // Build caches once per POI version
        if (!l17CountsCache) l17CountsCache = buildL17Counts(allPois);

        // NEW: L14 stats come from cached GCS L14 counts + manual POIs
        if (!l14StatsCache) l14StatsCache = buildL14StatsFromCachedCounts(drawBounds);

        // L17 shading
        if (s2Settings.enabled && zoom >= GCS_MIN_ZOOM) {
            drawL17FromCountsCache(l17CountsCache, s2Settings, drawBounds);
        } else {
            clearL17ShadingOnly();
        }

        // L14 overlays
        if (l14.enabled && zoom >= GCS_MIN_ZOOM) {
            drawL14FromStatsCache(l14StatsCache, drawBounds);
        } else {
            clearL14ShadingOnly();
        }
    }

    function drawL17FromCountsCache(counts, s2Settings, drawBounds) {
        const fillColor = s2Settings.color || "#000000";
        const baseFillOpacity = (typeof s2Settings.fillOpacity === "number")
        ? s2Settings.fillOpacity
        : 0.2;

        const seen = new Set();

        for (const [cellId, info] of counts.entries()) {
            if (!cellIntersectsBounds(info.cell, drawBounds)) continue;
            seen.add(cellId);

            let entry = l17ShadeByCellId.get(cellId);
            if (!entry) {
                const corners = info.cell.getCornerLatLngs();
                const path = corners.map(c => ({
                    lat: typeof c.lat === "function" ? c.lat() : c.lat,
                    lng: typeof c.lng === "function" ? c.lng() : c.lng
                }));
                path.push(path[0]);
                entry = { path, polys: [] };
                l17ShadeByCellId.set(cellId, entry);
            }

            const desiredCount = info.count;
            const currentCount = entry.polys.length;

            for (let i = currentCount; i < desiredCount; i++) {
                const poly = new google.maps.Polygon({
                    map: wfMap,
                    paths: entry.path,
                    strokeColor: fillColor,
                    strokeOpacity: 0.7,
                    strokeWeight: 1,
                    fillColor: fillColor,
                    fillOpacity: baseFillOpacity,
                    clickable: false,
                    zIndex: 3000 + i
                });
                entry.polys.push(poly);
            }

            for (let i = desiredCount; i < currentCount; i++) {
                entry.polys[i]?.setMap?.(null);
            }
            if (currentCount > desiredCount) entry.polys.length = desiredCount;

            // Style updates only
            for (let i = 0; i < entry.polys.length; i++) {
                entry.polys[i].setOptions({
                    strokeColor: fillColor,
                    fillColor: fillColor,
                    fillOpacity: baseFillOpacity,
                    zIndex: 3000 + i
                });
                if (entry.polys[i].getMap?.() !== wfMap) entry.polys[i].setMap(wfMap);
            }
        }

        for (const [cellId, entry] of l17ShadeByCellId.entries()) {
            if (seen.has(cellId)) continue;
            for (const poly of entry.polys) poly?.setMap?.(null);
            l17ShadeByCellId.delete(cellId);
        }
    }

    function drawL14FromStatsCache(cellMap, drawBounds) {
        const l14 = userSettings.l14Cells || {};
        const MIN_L14_LABEL_ZOOM = GCS_MIN_ZOOM;

        const zoom = wfMap.getZoom?.();
        const shouldShowLabels = l14.showLabels && zoom != null && zoom >= MIN_L14_LABEL_ZOOM;

        // --- shading (reuse) ---
        const seenShade = new Set();
        for (const [cellId, info] of cellMap.entries()) {
            if (!cellIntersectsBounds(info.cell, drawBounds)) continue;
            seenShade.add(cellId);

            // NEW: gate shading when mapview is active and the cell isn't "complete"
            const canShade = canShowL14CounterLabel(info.cell);

            let fillColor = null;
            let fillOpacity = 0;

            if (canShade) {
                const expectedGyms = computeExpectedGyms(info.gameItems);

                if (info.gyms < expectedGyms && l14.shadeUndercrowded !== false) {
                    fillColor = l14.undercrowdedColor || "#facc15";
                    fillOpacity = (typeof l14.undercrowdedOpacity === "number") ? l14.undercrowdedOpacity : 0.45;
                } else if (info.gyms > expectedGyms && l14.shadeOvercrowded !== false) {
                    fillColor = l14.overcrowdedColor || "#f97373";
                    fillOpacity = (typeof l14.overcrowdedOpacity === "number") ? l14.overcrowdedOpacity : 0.45;
                }
            }

            // If canShade is false, this will render as "no fill" (opacity 0) for that cell
            upsertL14ShadePolygon(cellId, info.cell, fillColor, fillOpacity);
        }

        for (const [cellId, poly] of l14ShadeByCellId.entries()) {
            if (seenShade.has(cellId)) continue;
            poly?.setMap?.(null);
            l14ShadeByCellId.delete(cellId);
        }

        // --- labels (reuse) ---
        const existingById = new Map();
        if (Array.isArray(l14CellLabels)) {
            for (const m of l14CellLabels) if (m?.__cellId) existingById.set(m.__cellId, m);
        }

        if (!shouldShowLabels) {
            for (const m of l14CellLabels || []) m?.setMap?.(null);
            l14CellLabels = [];
            return;
        }

        const nextLabels = [];

        for (const [cellId, info] of cellMap.entries()) {
            if (!cellIntersectsBounds(info.cell, drawBounds)) continue;

            const old = existingById.get(cellId);

            // NEW: gate label when mapview is active + query not yet complete for this cell
            if (!canShowL14CounterLabel(info.cell)) {
                if (old) old.setMap(null);
                continue;
            }

            const remaining = computeRemainingToNextGym(info.gameItems, info.gyms);

            if (remaining == null) {
                if (old) old.setMap(null);
                continue;
            }

            const centre = getCellCenterFromCorners(info.cell);
            const isClose = typeof remaining === "number" && remaining >= 1 && remaining <= 2;
            const fillColor = isClose ? (l14.undercrowdedColor || "#facc15") : "#ffffff";

            let marker = old;

            // If we already have the same value, do minimal updates
            if (marker && marker.__remaining === remaining && marker.__isClose === isClose) {
                marker.setPosition(centre);
                if (marker.getMap?.() !== wfMap) marker.setMap(wfMap);
                nextLabels.push(marker);
                continue;
            }

            const icon = {
                path: google.maps.SymbolPath.CIRCLE,
                scale: 11,
                fillColor,
                fillOpacity: 0.97,
                strokeColor: "#111827",
                strokeOpacity: 0.9,
                strokeWeight: 2
            };

            const label = {
                text: String(remaining),
                color: "#111827",
                fontSize: "13px",
                fontWeight: "700"
            };

            if (!marker) {
                marker = new google.maps.Marker({
                    map: wfMap,
                    position: centre,
                    clickable: false,
                    icon,
                    label,
                    zIndex: 7500
                });
                marker.__cellId = cellId;
            } else {
                marker.setPosition(centre);
                marker.setIcon(icon);
                marker.setLabel(label);
                if (marker.getMap?.() !== wfMap) marker.setMap(wfMap);
            }

            marker.__remaining = remaining;
            marker.__isClose = isClose;

            nextLabels.push(marker);
        }

        const keep = new Set(nextLabels);
        for (const m of l14CellLabels || []) {
            if (!keep.has(m)) m?.setMap?.(null);
        }
        l14CellLabels = nextLabels;
    }

    function upsertL14ShadePolygon(cellId, cell, fillColor, fillOpacity) {
        let poly = l14ShadeByCellId.get(cellId);
        if (!poly) {
            const corners = cell.getCornerLatLngs();
            const path = corners.map(c => ({
                lat: typeof c.lat === "function" ? c.lat() : c.lat,
                lng: typeof c.lng === "function" ? c.lng() : c.lng
            }));
            path.push(path[0]);

            poly = new google.maps.Polygon({
                map: wfMap,
                paths: path,
                strokeColor: "#9ca3af",
                strokeOpacity: 0,
                strokeWeight: 1,
                clickable: false,
                zIndex: 4000
            });
            l14ShadeByCellId.set(cellId, poly);
        }

        poly.setOptions({
            fillColor: fillColor || "#000000",
            fillOpacity: fillColor ? fillOpacity : 0
        });

        if (poly.getMap?.() !== wfMap) poly.setMap(wfMap);
        return poly;
    }

    // -----------------------------
    // Game POI markers (Stops / Gyms / Power Spots)
    // -----------------------------

    function clearManualPoiMarkers() {
        if (!Array.isArray(manualPoiMarkers) || !manualPoiMarkers.length) return;
        manualPoiMarkers.forEach(m => {
            if (m && m.setMap) m.setMap(null);
        });
        manualPoiMarkers = [];
    }

    // Return style for a given POI type
    function getMarkerStyleForPoiType(type) {
        const cfg = userSettings.poiMarkers?.[type];
        if (!cfg) return null;

        return {
            fillColor: cfg.fillColor,
            fillOpacity: cfg.fillOpacity,
            borderColor: cfg.borderColor,
            borderOpacity: cfg.borderOpacity,
            borderWidth: cfg.borderWidth,
            markerSize: cfg.markerSize
        };
    }

    function refreshManualPoiMarkers() {
        if (!wfMap || !google?.maps) return;

        const zoom = wfMap.getZoom?.();

        if (zoom < 1) {
            clearManualPoiMarkers();
            return;
        }

        if (!manualPois || !manualPois.size) {
            clearManualPoiMarkers();
            return;
        }

        const bounds = wfMap.getBounds?.();
        if (!bounds) return;

        const ne = bounds.getNorthEast();
        const sw = bounds.getSouthWest();
        const neLat = ne.lat(), neLng = ne.lng();
        const swLat = sw.lat(), swLng = sw.lng();

        const inView = (lat, lng) => (
            lat >= swLat && lat <= neLat && lng >= swLng && lng <= neLng
        );

        const existingById = new Map();
        if (Array.isArray(manualPoiMarkers)) {
            for (const m of manualPoiMarkers) {
                if (m?.__poiId) existingById.set(m.__poiId, m);
            }
        }

        const nextMarkers = [];
        const kept = new Set();

        for (const poi of getManualMarkerPoisArray()) {
            const style = getMarkerStyleForPoiType(poi.poiType);
            if (!style) continue;

            const id = poi.id;

            const visible = inView(poi.lat, poi.lng);

            let marker = existingById.get(id);

            if (!marker) {
                if (!visible) continue; // don't create offscreen markers

                // note to self: POI_STATUS
                const fillOpacity = style.fillOpacity;

                const strokeOpacity = style.borderOpacity;

                const icon = {
                    path: google.maps.SymbolPath.CIRCLE,
                    scale: style.markerSize,
                    fillColor: style.fillColor,
                    fillOpacity,
                    strokeColor: style.borderColor,
                    strokeOpacity,
                    strokeWeight: style.borderWidth
                };

                marker = new google.maps.Marker({
                    map: wfMap,
                    position: { lat: poi.lat, lng: poi.lng },
                    icon,
                    title: poi.title || "",
                    zIndex: 7000 + (poi.poiType === "gym" ? 10 : poi.poiType === "stop" ? 5 : 0)
                });

                marker.__poiId = id;
                marker.__lat = poi.lat;
                marker.__lng = poi.lng;
                marker.__iconKey =
                    `${poi.poiType}|${poi.status}|` +
                    `${style.markerSize}|${style.fillColor}|${style.fillOpacity}|` +
                    `${style.borderColor}|${style.borderOpacity}|${style.borderWidth}`;

                marker.addListener("click", () => {
                    sendPoiToBridge(poi);
                    selectMarker(marker);
                    injectManualPoiEditLink(poi);
                });
            } else {
                if (!visible) {
                    // prefer setVisible(false) if you decide to keep markers attached
                    marker.setMap(null);
                    continue;
                }

                const iconKey =
                      `${poi.poiType}|${poi.status}|` +
                      `${style.markerSize}|${style.fillColor}|${style.fillOpacity}|` +
                      `${style.borderColor}|${style.borderOpacity}|${style.borderWidth}`;

                if (marker.__lat !== poi.lat || marker.__lng !== poi.lng) {
                    marker.setPosition({ lat: poi.lat, lng: poi.lng });
                    marker.__lat = poi.lat;
                    marker.__lng = poi.lng;
                }
                if (marker.__iconKey !== iconKey) {
                    const fillOpacity = style.fillOpacity;

                    const strokeOpacity = style.borderOpacity;

                    marker.setIcon({
                        path: google.maps.SymbolPath.CIRCLE,
                        scale: style.markerSize,
                        fillColor: style.fillColor,
                        fillOpacity,
                        strokeColor: style.borderColor,
                        strokeOpacity,
                        strokeWeight: style.borderWidth
                    });
                    marker.__iconKey = iconKey;
                }
                if (marker.getMap() !== wfMap) marker.setMap(wfMap);
            }

            nextMarkers.push(marker);
            kept.add(marker);
        }

        if (Array.isArray(manualPoiMarkers)) {
            for (const m of manualPoiMarkers) {
                if (m?.setMap && !kept.has(m)) m.setMap(null);
            }
        }

        manualPoiMarkers = nextMarkers;
    }

    /**
     * Mark a nomination marker as selected by visually highlighting it
     * and remembering the original icon so it can be restored later.
     */
    function selectMarker(marker) {
        // Remove highlight from any previously selected marker
        clearSelection();

        if (!marker || !marker.getIcon) return;

        const icon = marker.getIcon();
        if (!icon) return;

        // Remember original icon so we can restore it on deselect
        lastSelectedMarkerOriginalIcon = { ...icon };
        lastSelectedMarker = marker;

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
     * Clear the current nomination selection and restore the previous marker styling.
     */
    function clearSelection() {
        if (lastSelectedMarker && lastSelectedMarkerOriginalIcon) {
            lastSelectedMarker.setIcon(lastSelectedMarkerOriginalIcon);
        }
        lastSelectedMarker = null;
        lastSelectedMarkerOriginalIcon = null;
        lastSelectedPoiId = null;
    }

    function injectManualPoiEditLink(poi) {
        // Only manual records get edit UI
        if (!poi || !isManualRecord?.(poi)) return;

        const host = document.querySelector(".wfmapmods-poi-function-links");
        if (!host) return;

        // Remove any previous edit link we injected
        host.querySelectorAll('[data-wf-manualpoi-edit="1"]').forEach(el => el.remove());

        const link = document.createElement("a");
        link.href = "#";
        link.className = "wfmapmods-link-block";
        link.textContent = "Edit";
        link.dataset.wfManualpoiEdit = "1";

        link.addEventListener("click", (e) => {
            e.preventDefault();
            e.stopPropagation();
            openManualImportDialog({ mode: "edit", poi });
        });

        host.appendChild(linkf);
    }

    // -----------------------------
    // Highlight current cell
    // -----------------------------

    function highlightSubmitCell(lat, lng) {
        submitCellLat = lat;
        submitCellLng = lng;

        if (!wfMap || typeof google === "undefined" || !google.maps) return;

        const masterEnabled = !userSettings.master || userSettings.master.enabled !== false;
        const cfg = userSettings.highlightCell || {};
        const highlightEnabled = cfg.enabled !== false;

        // Always clear any existing polygon first
        if (submitCellHighlight) {
            submitCellHighlight.setMap(null);
            submitCellHighlight = null;
        }

        // If master or highlight are disabled, stop here
        if (!masterEnabled || !highlightEnabled) {
            return;
        }

        const strokeColor = cfg.color || "#FF0000";
        const strokeWeight = typeof cfg.lineWidth === "number" ? cfg.lineWidth : 4;
        const strokeOpacity = typeof cfg.lineOpacity === "number" ? cfg.lineOpacity : 1.0;

        const cell = S2.S2Cell.FromLatLng({ lat, lng }, POI_CELL_LEVEL);

        const corners = cell.getCornerLatLngs();
        const path = corners.map(c => ({
            lat: typeof c.lat === "function" ? c.lat() : c.lat,
            lng: typeof c.lng === "function" ? c.lng() : c.lng
        }));
        path.push(path[0]);

        submitCellHighlight = new google.maps.Polygon({
            map: wfMap,
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

    function injectS2CSS() {
        if (document.getElementById("wfmapmods-s2-css")) return;

        const css = document.createElement("style");
        css.id = "wfmapmods-s2-css";
        css.textContent = `
/* =========================================================
   Wayfarer Map Mods - S2 CSS
   ========================================================= */

/* =====================
   Backdrop (modal overlay)
   ===================== */
.wfmapmods-s2-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.35);
  z-index: 2000;

  display: flex;
  align-items: center;
  justify-content: center;

  overflow-y: auto;
  padding: 12px 0;
}

/* =====================
   Dialog container
   ===================== */
.wfmapmods-s2-dialog {
  background: #ffffff;
  border-radius: 8px;
  box-shadow: 0 10px 25px rgba(0, 0, 0, 0.35);

  /* Keep your existing sizing, but make it predictable */
  min-width: 380px;
  max-width: 520px;
  width: calc(100% - 32px);
  max-height: 80vh;

  display: flex;
  flex-direction: column;

  overflow-y: auto;
  padding: 10px 12px 8px;
  box-sizing: border-box;

  font-family: Roboto, Arial, sans-serif;
  font-size: 12px;
  color: #111827;
}

.wfmapmods-s2-dialog.wfmapmods-s2-dialog--poi {
  min-width: 320px;          /* smaller than your global 380px */
  max-width: 440px;          /* matches your example */
  width: 440px;              /* fixed look like screenshots */
  max-height: 80vh;

  padding: 10px 12px 10px;   /* tighter than default */
}

.wfmapmods-s2-title {
  font-size: 15px;
  font-weight: 600;
  margin-bottom: 10px;
}

/* =====================
   Sections
   ===================== */
.wfmapmods-s2-section {
  margin-bottom: 6px;
  padding-bottom: 6px;
  border-bottom: 1px solid #e5e7eb;
}

.wfmapmods-s2-section--no-border {
  border-bottom: none;
}

.wfmapmods-s2-section-header {
  font-weight: 500;
  margin-bottom: 4px;
}

/* Hint / helper text used under headers */
.wfmapmods-s2-hint {
  font-size: 11px;
  margin-bottom: 6px;
  color: #374151;
}

/* =====================
   Rows & layout utilities
   ===================== */
.wfmapmods-s2-row {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-bottom: 2px;

}

/* Marker rows in your modals (the ones with "Customise…" on the right) */
.wfmapmods-s2-row-marker {
  align-items: center;
}

/* Left chunk inside marker rows (checkbox + label + optional "Level" controls) */
.wfmapmods-s2-row-left {
  display: flex;
  align-items: center;
  gap: 6px;
  flex: 1;
}

/* Right chunk inside marker rows (usually the "Customise…" link button) */
.wfmapmods-s2-row-right {
  margin-left: auto;
}

/* "Level" label spacing */
.wfmapmods-s2-level-label {
  font-size: 11px;
  margin-left: 10px;
  color: #374151;
}

/* Grid toggle label (wider label variant) */
.wfmapmods-s2-grid-toggle-label {
  min-width: 130px;
  font-size: 11px;
  color: #374151;
}

/* Optional generic label style (used elsewhere) */
.wfmapmods-s2-label {
  flex: 0 0 110px;
  font-size: 11px;
  color: #374151;
}

/* =====================
   Inputs
   ===================== */
.wfmapmods-s2-row input[type="number"] {
  width: 60px;
  box-sizing: border-box;

  font-size: 11px;
  padding: 2px 4px;

  border: 1px solid #d1d5db;
  border-radius: 3px;
  background: #ffffff;
}

.wfmapmods-s2-row input[type="color"] {
  width: 32px;
  height: 20px;
  padding: 0;

  border: none;
  background: none;
}

/* =====================
   Buttons
   ===================== */
.wfmapmods-s2-buttons {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 4px;
}

.wfmapmods-s2-btn {
  padding: 4px 12px;
  border-radius: 4px;
  border: 1px solid transparent;

  cursor: pointer;
  font-size: 12px;
  font-family: inherit;
}

.wfmapmods-s2-btn-cancel {
  background: #ffffff;
  border-color: #d1d5db;
  color: #111827;
}

.wfmapmods-s2-btn-ok {
  background: #2563eb;
  border-color: #2563eb;
  color: #ffffff;
}

/* Link-style button used for "Customise…" */
.wfmapmods-s2-link-button {
  background: transparent;
  border: none;
  cursor: pointer;

  font-size: 11px;
  text-decoration: underline;

  padding: 0;
  margin: 0;

  color: #2563eb;
}

/* =====================
   Marker rows alignment / preview
   ===================== */

/* Fixed-width left column so previews line up */
.wfmapmods-s2-marker-left {
  flex: 0 0 140px;
}

/* Preview column – consistent sizing */
.wfmapmods-s2-marker-preview {
  flex: 0 0 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-left: 10px;
}

.wfmapmods-s2-marker-preview-circle {
  border-radius: 50%;
  box-sizing: border-box;
}

/* ===== Manual marker table ===== */
.wfmapmods-s2-markertable {
  width: 100%;
  border-collapse: separate;
  border-spacing: 0 8px;
}

.wfmapmods-s2-markertable col:first-child {
  width: 120px !important;
}

.wfmapmods-s2-markertable thead th {
  font-size: 12px;
  font-weight: 600;
  color: #111827;
  text-align: left;
  padding: 0 0 0 0;
}

.wfmapmods-s2-markertable-rowhead {
  font-size: 12px;
  font-weight: 600;
  color: #111827;
  text-align: left;
  padding-right: 10px;
  white-space: nowrap;
}

.wfmapmods-s2-markercell {
  padding: 0;
}

/* The clickable preview button */
.wfmapmods-s2-markerbtn {
  width: 100%;
  min-height: 64px;
  border: 1px solid #e5e7eb;
  border-radius: 10px;
  background: #ffffff;
  cursor: pointer;

  display: flex;
  align-items: center;
  justify-content: center;
}

.wfmapmods-s2-markerbtn:hover {
  border-color: #cbd5e1;
}

.wfmapmods-s2-markerbtn:focus {
  outline: 2px solid rgba(37, 99, 235, 0.35);
  outline-offset: 2px;
}

/* Submodal row density */
.wfmapmods-s2-row--narrow {
  gap: 10px;
  margin-bottom: 6px;
}

/* Transient feedback toast (soft, tooltip-like) */
.wfmapmods-s2-toast {
  position: fixed;
  z-index: 2100;
  background: rgba(55, 65, 81, 0.95); /* slate-700-ish */
  color: #f9fafb;                    /* very light grey, not pure white */
  font-size: 11px;
  line-height: 1.25;
  padding: 6px 8px;
  border-radius: 6px;
  box-shadow: 0 6px 14px rgba(0,0,0,0.18);
  pointer-events: none;

  opacity: 0;
  transform: translateY(-4px);
  transition: opacity 120ms ease, transform 120ms ease;
}

.wfmapmods-s2-toast--show {
  opacity: 1;
  transform: translateY(0);
}

/* ===== S2 cell settings table ===== */
.wfmapmods-s2-celltable {
  width: 100%;
  border-collapse: separate;
  border-spacing: 0 8px;
  table-layout: fixed; /* important: makes column widths behave predictably */
}

    .wf-manual-import-btn {
      width: 32px;
      height: 32px;
      margin-top: 10px;
      margin-left: 10px;
      padding: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      background: #ffffff;
      border: 2px solid #ffffff;
      border-radius: 3px;
      box-shadow: 0 1px 4px rgba(0,0,0,0.3);
      cursor: pointer;
      user-select: none;
      -webkit-tap-highlight-color: transparent;
    }

    .wf-manual-import-btn:hover { background: #f9fafb; }

    /* Shared active style (same class as your other plugins) */
.wf-manual-import-btn.wf-toggle-active {
  background: #ffce04;
  border-color: #ffce04;
}

    /* Ensure icon doesn't steal clicks */
    .wf-manual-import-btn * { pointer-events: none; }


.wfmapmods-manualimport-hint {
  font-size: 11px;
  color: #6b7280;
  margin-top: -6px;
}

.wfmapmods-s2-btn-danger {
  background: #ffffff;
  border-color: #dc2626;
  color: #b91c1c;
}

.wfmapmods-s2-btn-danger:hover {
  background: rgba(220, 38, 38, 0.08);
}

/* =========================================================
   iOS: prevent Safari input auto-zoom (<16px font-size)
   Strategy: force 16px font-size, then visually scale down
   ========================================================= */

html.wf-ios .wfmapmods-s2-dialog input[type="text"],
html.wf-ios .wfmapmods-s2-dialog input[type="number"],
html.wf-ios .wfmapmods-s2-dialog input[type="search"],
html.wf-ios .wfmapmods-s2-dialog textarea,
html.wf-ios .wfmapmods-s2-dialog select {
  font-size: 16px !important; /* must beat inline styles in row() */
}

/* Manual POI modal uses ~12px look → scale 12/16 = 0.75 */
html.wf-ios .wfmapmods-s2-dialog.wfmapmods-s2-dialog--poi input[type="text"],
html.wf-ios .wfmapmods-s2-dialog.wfmapmods-s2-dialog--poi input[type="number"],
html.wf-ios .wfmapmods-s2-dialog.wfmapmods-s2-dialog--poi select {
  transform: scale(0.75);
  transform-origin: left center;
  width: calc(100% / 0.75); /* keep visual width ~same after scaling */
}

/* Settings modal number inputs use 60px width and ~11px look → scale 11/16 = 0.6875 */
html.wf-ios .wfmapmods-s2-row input[type="number"] {
  transform: scale(0.6875);
  transform-origin: left center;
  width: calc(60px / 0.6875); /* ≈ 87.27px so it looks like 60px after scaling */
}
`;
        document.head.appendChild(css);
    }

    // -----------------------------
    // Plugin bootstrap
    // -----------------------------

    function bootstrap() {
        loadSettings();
        injectS2CSS();
        loadManualPoisFromIDB();
        setupMapRouteWatcher();
    }

    bootstrap();

})();