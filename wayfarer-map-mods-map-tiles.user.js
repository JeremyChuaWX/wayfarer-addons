// ==UserScript==
// @name         Wayfarer Map Mods - Map Tiles
// @version      0.0.3
// @description  Adds extra base map providers (Bing, Esri, OSM, etc.) to the submission map
// @namespace    https://gitlab.com/Tntnnbltn/wayfarer-addons
// @downloadURL  https://gitlab.com/Tntnnbltn/wayfarer-addons/-/raw/main/wayfarer-map-mods-map-tiles.user.js
// @homepageURL  https://gitlab.com/Tntnnbltn/wayfarer-addons
// @match        https://wayfarer.nianticlabs.com/*
// @run-at       document-start
// ==/UserScript==

(function () {
    'use strict';

    let submitMap = null;
    let mapAttached = false;

    const SETTINGS_KEY = "wfmap_base_tiles_settings";

    const BUILTIN_TYPES = ["roadmap", "satellite", "hybrid"];
    const CUSTOM_PROVIDER_NAMES = ["Bing", "Esri", "Esri Clarity", "OSM"];

    // -----------------------------
    // Settings (defaults + storage)
    // -----------------------------

    const userSettings = {
        map: {}
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
        const panelPresent = !!document.querySelector("#wfmapmods-side-panel");

        if (panelPresent && !lastPanelPresent) {
            // We just arrived on the map page
            attachBasemapsToMapIfNeeded();
            insertBaseMapSettingsLink();
        } else if (!panelPresent && lastPanelPresent) {
            // We just left the map page
            teardownBaseMapsForMap();
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
                    console.warn("[BaseMaps] Failed to find submit map after several attempts");
                    resolve(null);
                    return;
                }

                setTimeout(tryFindMap, 250);
            }

            tryFindMap();
        });
    }

    function teardownBaseMapsForMap() {
        if (!mapAttached) return;

        submitMap = null;
        mapAttached = false;
    }

    async function attachBasemapsToMapIfNeeded() {
        if (mapAttached) return;

        const map = await getSubmitMap();

        if (!map) {
            console.warn("[BaseMaps] Map not found – cannot attach");
            return;
        }

        submitMap = map;
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
            if (submitMap) {
                submitMap._wfmapmodsBasemapsInitialised = false;
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
        if (!submitMap) return;
        if (submitMap._wfmapmodsBasemapsInitialised) return;
        submitMap._wfmapmodsBasemapsInitialised = true;

        // Make sure the structure exists
        if (!userSettings.map) userSettings.map = {};
        if (!userSettings.map.providers) userSettings.map.providers = {};

        let mapTypeControlOptions = {
            style: google.maps.MapTypeControlStyle.DROPDOWN_MENU,
            position: google.maps.ControlPosition.TOP_LEFT,
            mapTypeIds: ["roadmap", "satellite", "hybrid"]
        };

        // Add extra services
        mapTypeControlOptions = setupMapLayer(
            submitMap, mapTypeControlOptions,
            "Bing", 20, 0,
            "https://t0.tiles.virtualearth.net/tiles/a{quadKey}.jpeg?g=1398"
        );
        mapTypeControlOptions = setupMapLayer(
            submitMap, mapTypeControlOptions,
            "Esri", 19, 0,
            "https://wayback.maptiles.arcgis.com/arcgis/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
        );
        mapTypeControlOptions = setupMapLayer(
            submitMap, mapTypeControlOptions,
            "Esri Clarity", 19, 0,
            "https://clarity.maptiles.arcgis.com/arcgis/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
        );
        mapTypeControlOptions = setupMapLayer(
            submitMap, mapTypeControlOptions,
            "OSM", 19, 0,
            "https://tile.openstreetmap.org/{z}/{x}/{y}.png"
        );

        submitMap.setOptions({
            mapTypeControl: true,
            mapTypeControlOptions
        });

        // Choose initial map type
        setInitialMapType();

        // Start tracking "last used"
        attachLastUsedListener();
    }

    function setInitialMapType() {
        if (!submitMap) return;

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
            preferredType = submitMap.getMapTypeId() || "roadmap";
        }

        const hasType = submitMap.mapTypes && submitMap.mapTypes.get(preferredType);
        if (hasType) {
            submitMap.setMapTypeId(preferredType);
        } else {
            submitMap.setMapTypeId("roadmap");
        }
    }


    function attachLastUsedListener() {
        if (!submitMap) return;
        if (submitMap._wfmapmodsLastUsedListenerAttached) return;
        submitMap._wfmapmodsLastUsedListenerAttached = true;

        if (google.maps && google.maps.event) {
            google.maps.event.addListener(submitMap, "maptypeid_changed", () => {
                const current = submitMap.getMapTypeId();
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
        startMapPanelWatcher();
    }

    bootstrap();

})();
