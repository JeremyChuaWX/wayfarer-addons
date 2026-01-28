// ==UserScript==
// @name         Wayfarer Map Mods - Map Tiles
// @version      3.0.0
// @description  Adds extra base map providers (Bing, Esri, OSM, etc.) to the submission map
// @namespace    https://gitlab.com/Tntnnbltn/wayfarer-addons
// @downloadURL  https://gitlab.com/Tntnnbltn/wayfarer-addons/-/raw/main/wayfarer-map-mods-map-tiles.user.js
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

    let wfMap = null;
    let mapAttached = false;

    const SUBMIT_ROUTE = "/new/submit/new";
    const MAPVIEW_ROUTE = "/new/mapview";

    let mapPanelObserver = null;
    let mapPanelMutationScheduled = false;

    const SETTINGS_KEY = "wfmap_base_tiles_settings";

    const BUILTIN_TYPES = ["roadmap", "satellite", "hybrid"];
    const CUSTOM_PROVIDER_NAMES = [
        "Bing",
        "Esri",
        "Esri Clarity",
        "OSM",
        "CartoDB DarkMatter",
        "CartoDB Positron"
    ];

    // -----------------------------
    // Settings (defaults + storage)
    // -----------------------------

    const userSettings = {
        map: {
            defaultType: "last-used"
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
        mapPanelMutationScheduled = false;
    }

    /**
 * Detect when the map side panel appears and attach base maps.
 * Teardown is handled by route changes (onMapRouteChange).
 */
    function handlePanelChange() {
        const panelPresent = !!document.querySelector("#wfmapmods-side-panel");

        if (panelPresent) {
            // We just arrived on (or are already on) the map page
            attachBasemapsToMapIfNeeded();
            insertBaseMapSettingsLink();
            // We’ve done our one-time setup for this visit; no need to keep watching
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

        wfMap = null;
        mapAttached = false;
    }

    function isMapStale(map) {
        try {
            const div = map && map.getDiv && map.getDiv();
            return !div || !div.isConnected;
        } catch {
            return true;
        }
    }

    async function attachBasemapsToMapIfNeeded() {
        // If we think we're attached but the underlying map is gone, reset and reattach
        if (mapAttached) {
            if (wfMap && !isMapStale(wfMap)) return;

            teardownMap();
        }

        const map = await getWfMap();
        if (!map) {
            console.warn("[BaseMaps] Map not found – cannot attach");
            return;
        }

        wfMap = map;

        // Important: new map instance => allow init on this new object
        wfMap._wfmapmodsBasemapsInitialised = false;
        wfMap._wfmapmodsLastUsedListenerAttached = false;

        initCustomBaseMaps();
        mapAttached = true;
    }

    // -----------------------------
    // Settings link + modal
    // -----------------------------

    function insertBaseMapSettingsLink() {
        const panelCheck = setInterval(() => {
            const settingsBody = document.querySelector(".wfmapmods-settings-links");
            if (!settingsBody) return; // retry

            clearInterval(panelCheck);

            // Prevent duplicate link insertion
            if (document.getElementById("wfmapmods-settings-basemaps")) return;

            const link = document.createElement("a");
            link.id = "wfmapmods-settings-basemaps";
            link.textContent = "Map Tiles";

            settingsBody.appendChild(link);

            link.addEventListener("click", () => {
                openBaseMapSettingsWindow();
            });
        }, 300);
    }

    function openBaseMapSettingsWindow() {
        // Please do not change this function yet. Await instructions.
        if (document.getElementById("wfmapmods-basemap-modal-backdrop")) return;

        const mapSettings = userSettings.map || {};
        const providers = mapSettings.providers || {};

        // --- Backdrop ---
        const backdrop = document.createElement("div");
        backdrop.id = "wfmapmods-basemap-modal-backdrop";
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

        // --- Dialog container ---
        const dialog = document.createElement("div");
        Object.assign(dialog.style, {
            background: "#ffffff",
            borderRadius: "8px",
            boxShadow: "0 10px 25px rgba(0,0,0,0.35)",
            width: "280px",
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
        title.textContent = "Map Tile Options";
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
                marginBottom: "4px",
                gap: "4px"
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

        // --- Default base map type ---
        const defaultGroup = document.createElement("div");
        Object.assign(defaultGroup.style, {
            borderBottom: "1px solid #e5e7eb",
            paddingBottom: "6px",
            marginBottom: "6px"
        });

        const defaultHeader = document.createElement("div");
        defaultHeader.textContent = "Default map tiles";
        Object.assign(defaultHeader.style, {
            fontWeight: "500",
            marginBottom: "4px"
        });
        defaultGroup.appendChild(defaultHeader);

        const defaultSelect = document.createElement("select");

        // Special option: last-used
        const optLast = document.createElement("option");
        optLast.value = "last-used";
        optLast.textContent = "Last used";
        defaultSelect.appendChild(optLast);

        const allTypes = [...BUILTIN_TYPES, ...CUSTOM_PROVIDER_NAMES];
        allTypes.forEach(name => {
            const opt = document.createElement("option");
            opt.value = name;
            opt.textContent = name;
            defaultSelect.appendChild(opt);
        });

        defaultSelect.value = mapSettings.defaultType || "last-used";

        defaultGroup.appendChild(makeRow("Start with:", defaultSelect));
        dialog.appendChild(defaultGroup);

        // --- Provider toggles ---
        const providersGroup = document.createElement("div");
        Object.assign(providersGroup.style, {
            paddingBottom: "4px",
            marginBottom: "8px"
        });

        const providersHeader = document.createElement("div");
        providersHeader.textContent = "Extra providers";
        Object.assign(providersHeader.style, {
            fontWeight: "500",
            marginBottom: "4px"
        });
        providersGroup.appendChild(providersHeader);

        const providerCheckboxes = {};

        CUSTOM_PROVIDER_NAMES.forEach(name => {
            const checkbox = document.createElement("input");
            checkbox.type = "checkbox";
            // If value is explicitly false, disable; otherwise default to true
            checkbox.checked = providers[name] !== false;
            providerCheckboxes[name] = checkbox;
            providersGroup.appendChild(makeRow(name, checkbox));
        });

        dialog.appendChild(providersGroup);

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

        // --- Button handlers ---

        cancelBtn.addEventListener("click", () => {
            closeModal();
        });

        okBtn.addEventListener("click", () => {
            if (!mapSettings.providers) mapSettings.providers = {};

            mapSettings.defaultType = defaultSelect.value || "last-used";

            CUSTOM_PROVIDER_NAMES.forEach(name => {
                mapSettings.providers[name] = !!providerCheckboxes[name].checked;
            });

            saveSettings();

            // Re-init base maps with new settings
            if (wfMap) {
                wfMap._wfmapmodsBasemapsInitialised = false;
                initCustomBaseMaps();
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
    // Add base maps
    // -----------------------------


    function initCustomBaseMaps() {
        if (!wfMap) return;
        if (wfMap._wfmapmodsBasemapsInitialised) return;
        wfMap._wfmapmodsBasemapsInitialised = true;

        // Make sure the structure exists
        if (!userSettings.map) userSettings.map = {};
        if (!userSettings.map.providers) userSettings.map.providers = {};

        const isEnabled = (name) => userSettings.map.providers?.[name] !== false;

        const existing = wfMap.get("mapTypeControlOptions") || {};
        const baseIds = Array.isArray(existing.mapTypeIds) ? existing.mapTypeIds.slice()
        : ["roadmap", "satellite", "hybrid"];

        let mapTypeControlOptions = Object.assign({}, existing, {
            style: google.maps.MapTypeControlStyle.DROPDOWN_MENU,
            position: google.maps.ControlPosition.TOP_LEFT,
            mapTypeIds: baseIds
        });

        // Add extra services
        if (isEnabled("Bing")) {
            mapTypeControlOptions = setupMapLayer(
                wfMap, mapTypeControlOptions,
                "Bing", 20, 0,
                "https://t0.tiles.virtualearth.net/tiles/a{quadKey}.jpeg?g=1398"
            );
        }

        if (isEnabled("Esri")) {
            mapTypeControlOptions = setupMapLayer(
                wfMap, mapTypeControlOptions,
                "Esri", 19, 0,
                "https://wayback.maptiles.arcgis.com/arcgis/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
            );
        }

        if (isEnabled("Esri Clarity")) {
            mapTypeControlOptions = setupMapLayer(
                wfMap, mapTypeControlOptions,
                "Esri Clarity", 19, 0,
                "https://clarity.maptiles.arcgis.com/arcgis/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
            );
        }

        if (isEnabled("OSM")) {
            mapTypeControlOptions = setupMapLayer(
                wfMap, mapTypeControlOptions,
                "OSM", 19, 0,
                "https://tile.openstreetmap.org/{z}/{x}/{y}.png"
            );
        }

        if (isEnabled("CartoDB DarkMatter")) {
            mapTypeControlOptions = setupMapLayer(
                wfMap, mapTypeControlOptions,
                "CartoDB DarkMatter", 20, 0,
                "https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png"
            );
        }

        if (isEnabled("CartoDB Positron")) {
            mapTypeControlOptions = setupMapLayer(
                wfMap, mapTypeControlOptions,
                "CartoDB Positron", 20, 0,
                "https://a.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png"
            );
        }

        wfMap.setOptions({
            mapTypeControl: true,
            mapTypeControlOptions,
            tilt: 0,
            heading: 0
        });

        // Start tracking "last used"
        attachLastUsedListener();

        // Choose initial map type
        setInitialMapType();
    }

    function setInitialMapType() {
        if (!wfMap) return;

        const mapSettings = userSettings.map || {};
        const savedDefault = mapSettings.defaultType;
        const lastUsed = mapSettings.lastUsedType;

        let preferredType;

        if (savedDefault === "last-used" && lastUsed) {
            // Use the last used type if we have one
            preferredType = lastUsed;
        } else if (savedDefault && savedDefault !== "last-used") {
            // Use an explicit default type from settings
            preferredType = savedDefault;
        } else {
            // Fallback: keep current map type or go to roadmap
            preferredType = wfMap.getMapTypeId() || "roadmap";
        }

        const hasType = wfMap.mapTypes && wfMap.mapTypes.get(preferredType);
        if (hasType) {
            wfMap.setMapTypeId(preferredType);
        } else {
            wfMap.setMapTypeId("roadmap");
        }
    }


    function attachLastUsedListener() {
        if (!wfMap) return;
        if (wfMap._wfmapmodsLastUsedListenerAttached) return;
        wfMap._wfmapmodsLastUsedListenerAttached = true;

        if (google.maps && google.maps.event) {
            google.maps.event.addListener(wfMap, "maptypeid_changed", () => {
                const current = wfMap.getMapTypeId();
                if (!current) return;

                if (!userSettings.map) userSettings.map = {};
                userSettings.map.lastUsedType = current;
                saveSettings();
            });
        }
    }


    function setupMapLayer(map, mapTypeControlOptions, name, maxZoom, minZoom, url) {
        const mapType = new google.maps.ImageMapType({
            getTileUrl: function (coord, zoom) {
                const normalizedCoord = getNormalizedCoord(coord, zoom);
                if (!normalizedCoord) return "";

                if (name === "Bing") {
                    const quadKey = getBingMapsQuadKey(normalizedCoord.x, normalizedCoord.y, zoom);
                    return url.replace("{quadKey}", quadKey);
                } else {
                    return url
                        .replace("{z}", zoom)
                        .replace("{x}", normalizedCoord.x)
                        .replace("{y}", normalizedCoord.y);
                }
            },
            tileSize: new google.maps.Size(256, 256),
            maxZoom: maxZoom,
            minZoom: minZoom,
            radius: 1738000,
            name: name
        });

        if (!mapTypeControlOptions.mapTypeIds.includes(name)) {
            mapTypeControlOptions.mapTypeIds.push(name);
        }

        map.mapTypes.set(name, mapType);

        return mapTypeControlOptions;
    }


    function getBingMapsQuadKey(x, y, z) {
        let quadKey = "";
        for (let i = z; i > 0; i--) {
            let digit = 0;
            const mask = 1 << (i - 1);
            if ((x & mask) !== 0) digit += 1;
            if ((y & mask) !== 0) digit += 2;
            quadKey += digit;
        }
        return quadKey;
    }

    // Normalises the coords so tiles repeat across the x axis (horizontally)
    function getNormalizedCoord(coord, zoom) {
        const y = coord.y;
        let x = coord.x;

        const tileRange = 1 << zoom;

        // don't repeat across y-axis
        if (y < 0 || y >= tileRange) {
            return null;
        }

        // repeat across x-axis
        if (x < 0 || x >= tileRange) {
            x = ((x % tileRange) + tileRange) % tileRange;
        }
        return { x, y };
    }

    // -----------------------------
    // Plugin bootstrap
    // -----------------------------

    function bootstrap() {
        loadSettings();
        setupMapRouteWatcher();
    }

    bootstrap();

})();
