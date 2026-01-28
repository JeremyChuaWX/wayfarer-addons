// ==UserScript==
// @name         Wayfarer Map Mods - Apple Maps Tiles
// @version      3.0.0
// @description  Adds Apple Maps as an extra base map provider in Wayfarer, using a token fetched via satellites.pro
// @namespace    https://gitlab.com/Tntnnbltn/wayfarer-addons
// @downloadURL  https://gitlab.com/Tntnnbltn/wayfarer-addons/-/raw/main/wayfarer-map-mods-apple-map-tiles.user.js
// @homepageURL  https://gitlab.com/Tntnnbltn/wayfarer-addons
// @match        https://wayfarer.nianticlabs.com/*
// @match        https://satellites.pro/*
// @run-at       document-start
// ==/UserScript==

(function () {
    'use strict';

    const host = location.hostname;

    // ============================================================
    //  A) satellites.pro SIDE: intercept Apple bootstrap + postMessage
    // ============================================================
    if (host.endsWith('satellites.pro')) {
        // ---- Config ----
        const APPLE_BOOTSTRAP_PREFIX = 'https://cdn.apple-mapkit.com/ma/bootstrap';
        const TARGET_ORIGIN = 'https://wayfarer.nianticlabs.com';

        function processBootstrapJson(json) {
            if (!json || !json.tileSources || !Array.isArray(json.tileSources)) return;

            // Prefer satellite imagery
            const satelliteSource = json.tileSources.find(ts => ts.tileSource === 'satellite');
            if (!satelliteSource) {
                console.warn('[WF AppleMaps] No satellite tileSource found in bootstrap.');
                return;
            }

            const domains = satelliteSource.domains || json.madabaDomains || [];
            const baseDomain = domains[0] ? ('https://' + domains[0]) : json.madabaBaseUrl || 'https://cdn.apple-mapkit.com';

            let path = satelliteSource.path;
            if (!path) {
                console.warn('[WF AppleMaps] No path in satellite tileSource.');
                return;
            }

            // Build URL template. We hard-code tileSizeIndex=2, resolution=1, and leave z/x/y as placeholders.
            // Example path: "/tile?style=7&size={{tileSizeIndex}}&scale={{resolution}}&z={{z}}&x={{x}}&y={{y}}&v=10271&accessKey=..."
            let urlTemplate = baseDomain + path;
            urlTemplate = urlTemplate
                .replace('{{tileSizeIndex}}', '2')
                .replace('{{resolution}}', '1')
                .replace('{{z}}', '{z}')
                .replace('{{x}}', '{x}')
                .replace('{{y}}', '{y}');

            const accessKey = json.accessKey;
            if (!accessKey) {
                console.warn('[WF AppleMaps] No accessKey field on bootstrap JSON.');
                return;
            }

            const targetWindow = window.parent || window.opener;
            if (!targetWindow) {
                console.warn('[WF AppleMaps] No parent/opener; cannot post config back to Wayfarer.');
                return;
            }

            const payload = {
                type: 'WF_APPLE_MAPKIT_CONFIG',
                urlTemplate,
                accessKey
            };

            try {
                targetWindow.postMessage(payload, TARGET_ORIGIN);
                console.info('[WF AppleMaps] Sent Apple MapKit config back to Wayfarer.');
            } catch (e) {
                console.error('[WF AppleMaps] Failed to postMessage to Wayfarer:', e);
            }
        }

        // ---- fetch interception ----
        if (typeof window.fetch === 'function') {
            const origFetch = window.fetch;
            window.fetch = function (input, init) {
                const url = typeof input === 'string' ? input : (input && input.url);
                const isBootstrap = url && url.startsWith(APPLE_BOOTSTRAP_PREFIX);

                return origFetch.apply(this, arguments).then(response => {
                    if (isBootstrap) {
                        // Clone so we don't disturb the original response.
                        response.clone().json().then(processBootstrapJson).catch(() => { /* ignore */ });
                    }
                    return response;
                });
            };
        }

        // ---- XHR interception ----
        (function () {
            const origOpen = XMLHttpRequest.prototype.open;
            const origSend = XMLHttpRequest.prototype.send;

            XMLHttpRequest.prototype.open = function (method, url) {
                this._wfApple_url = url;
                return origOpen.apply(this, arguments);
            };

            XMLHttpRequest.prototype.send = function () {
                if (this._wfApple_url && this._wfApple_url.startsWith(APPLE_BOOTSTRAP_PREFIX)) {
                    this.addEventListener('load', function () {
                        try {
                            const text = this.responseText;
                            if (!text) return;
                            const json = JSON.parse(text);
                            processBootstrapJson(json);
                        } catch (e) {
                            console.error('[WF AppleMaps] Failed to parse bootstrap XHR response:', e);
                        }
                    });
                }
                return origSend.apply(this, arguments);
            };
        })();

        // satellites.pro side done
        return;
    }

    // ============================================================
    //  B) WAYFARER SIDE: add Apple map type + handle config
    // ============================================================
    if (!host.endsWith('wayfarer.nianticlabs.com')) {
        return;
    }

    let wfMap = null;
    let mapAttached = false;

    const SUBMIT_ROUTE = "/new/submit/new";
    const MAPVIEW_ROUTE = "/new/mapview";

    let mapPanelObserver = null;
    let mapPanelMutationScheduled = false;

    const APPLE_CONFIG_KEY = 'wfmap_applemaps_config';

    let lastNonAppleMapType = 'roadmap';
    let helperFrame = null;
    let suppressAppleChange = false;

    // -----------------------------
    // Apple config storage + expiry
    // -----------------------------

    function loadAppleConfig() {
        try {
            const raw = localStorage.getItem(APPLE_CONFIG_KEY);
            if (!raw) return null;
            const cfg = JSON.parse(raw);
            if (!cfg || !cfg.urlTemplate || !cfg.accessKey || !cfg.expiresAt) return null;

            if (Date.now() > cfg.expiresAt) {
                // expired
                localStorage.removeItem(APPLE_CONFIG_KEY);
                return null;
            }

            return cfg;
        } catch (e) {
            console.error('[WF AppleMaps] Failed to load config:', e);
            return null;
        }
    }

    function saveAppleConfig(cfg) {
        try {
            localStorage.setItem(APPLE_CONFIG_KEY, JSON.stringify(cfg));
        } catch (e) {
            console.error('[WF AppleMaps] Failed to save config:', e);
        }
    }

    function estimateExpiryFromAccessKey(accessKey) {
        // First part (before "_") is UNIX timestamp in SECONDS,
        // and already represents the expiry time.
        if (!accessKey || typeof accessKey !== 'string') {
            return Date.now() + 5 * 60 * 1000; // fallback 5 minutes
        }

        const firstPart = accessKey.split('_', 1)[0];
        const tsSeconds = Number(firstPart);

        if (!Number.isFinite(tsSeconds) || tsSeconds <= 0) {
            return Date.now() + 5 * 60 * 1000;
        }

        return tsSeconds * 1000; // convert to ms for Date.now comparison
    }

    // -----------------------------
    // Helper tab + postMessage handler
    // -----------------------------

    function openHelperFrame() {
        // If the iframe already exists, do nothing
        if (helperFrame && document.body.contains(helperFrame)) {
            return;
        }

        helperFrame = document.createElement('iframe');
        helperFrame.src = 'https://satellites.pro/';
        helperFrame.style.display = 'none';
        helperFrame.id = 'wf-apple-helper-frame';

        document.body.appendChild(helperFrame);
    }


    function handleMessageFromHelper(event) {
        if (!event.origin || !event.origin.endsWith('satellites.pro')) return;
        const data = event.data;

        if (!data || data.type !== 'WF_APPLE_MAPKIT_CONFIG') return;

        const urlTemplate = data.urlTemplate;
        const accessKey = data.accessKey;

        if (!urlTemplate || !accessKey) {
            console.warn('[WF AppleMaps] Received config without urlTemplate or accessKey.');
            return;
        }

        const expiresAt = estimateExpiryFromAccessKey(accessKey);

        const cfg = {
            urlTemplate,
            accessKey,
            expiresAt
        };

        saveAppleConfig(cfg);
        console.info('[WF AppleMaps] Received and saved new Apple MapKit config. Expires at:', new Date(expiresAt).toISOString());

        // Remove helper iframe if present
        try {
            if (helperFrame && helperFrame.parentNode) {
                helperFrame.parentNode.removeChild(helperFrame);
            }
        } catch (e) {
            // ignore
        }
        helperFrame = null;

        // If the map is ready, ensure Apple basemap exists and switch to it
        if (wfMap) {
            ensureAppleBasemap(wfMap);
            wfMap.setMapTypeId('Apple');
        }
    }


    window.addEventListener('message', handleMessageFromHelper, false);

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
            teardownBaseMapsForMap();
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

        window.addEventListener('popstate', wrappedRouteChange);

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
 * Detect when the map side panel appears and attach Apple basemap.
 * Teardown is handled via route changes (onMapRouteChange).
 */
    function handlePanelChange() {
        const panelPresent = !!document.querySelector('#wfmapmods-side-panel');

        if (panelPresent) {
            attachBasemapsToMapIfNeeded();
            // We've done our one-time setup for this visit; no need to keep watching
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

    function teardownBaseMapsForMap() {
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

            // stale / missing
            wfMap = null;
            mapAttached = false;
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

        initAppleBaseMap();
        mapAttached = true;
    }

    // -----------------------------
    // Apple base map integration
    // -----------------------------

    function initAppleBaseMap() {
        if (!wfMap) return;
        if (wfMap._wfAppleBasemapInitialised) return;
        wfMap._wfAppleBasemapInitialised = true;

        // Remember the current map type as the "fallback" (non-Apple)
        lastNonAppleMapType = wfMap.getMapTypeId() || 'roadmap';

        // 1) Ensure the Apple map type exists in mapTypes
        ensureAppleBasemap(wfMap);

        // 2) Read any existing mapTypeControlOptions so we don't clobber other plugins
        const existingOptions = wfMap.get('mapTypeControlOptions') || {};

        // Start with the existing mapTypeIds if present, otherwise default to the common ones
        let mapTypeIds;
        if (Array.isArray(existingOptions.mapTypeIds)) {
            mapTypeIds = existingOptions.mapTypeIds.slice(); // shallow copy
        } else {
            mapTypeIds = ['roadmap', 'satellite', 'hybrid'];
        }

        // Add "Apple" if it's not already there
        if (!mapTypeIds.includes('Apple')) {
            mapTypeIds.push('Apple');
        }

        // Preserve existing style/position if present, otherwise leave them alone
        const newOptions = Object.assign({}, existingOptions, {
            mapTypeIds
        });

        console.log(newOptions);

        wfMap.setOptions({
            mapTypeControl: true,
            mapTypeControlOptions: newOptions
        });

        attachMapTypeChangeListener();
    }


    function ensureAppleBasemap(map) {
        if (!map.mapTypes) return;
        if (map.mapTypes.get('Apple')) return;
        const appleMapType = new google.maps.ImageMapType({
            getTileUrl: function (coord, zoom) {
                const normalizedCoord = getNormalizedCoord(coord, zoom);
                if (!normalizedCoord) return '';

                const cfg = loadAppleConfig();
                if (!cfg || !cfg.urlTemplate) {
                    // No valid config yet; url stays empty; listener handles opening satellites.pro
                    return '';
                }

                return cfg.urlTemplate
                    .replace('{z}', zoom)
                    .replace('{x}', normalizedCoord.x)
                    .replace('{y}', normalizedCoord.y);
            },
            tileSize: new google.maps.Size(256, 256),
            maxZoom: 20,
            minZoom: 3,
            name: 'Apple'
        });

        map.mapTypes.set('Apple', appleMapType);
    }

    function attachMapTypeChangeListener() {
        if (!wfMap) return;
        if (wfMap._wfAppleMapTypeListenerAttached) return;
        wfMap._wfAppleMapTypeListenerAttached = true;

        if (google.maps && google.maps.event) {
            google.maps.event.addListener(wfMap, 'maptypeid_changed', () => {
                if (suppressAppleChange) return;

                const current = wfMap.getMapTypeId();
                if (!current) return;

                if (current === 'Apple') {
                    const cfg = loadAppleConfig();
                    if (!cfg) {
                        console.info('[WF AppleMaps] No valid Apple config; opening satellites.pro helper tab.');

                        suppressAppleChange = true;
                        wfMap.setMapTypeId(lastNonAppleMapType || 'roadmap');
                        suppressAppleChange = false;

                        openHelperFrame();
                    }
                } else {
                    lastNonAppleMapType = current;
                }
            });
        }
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
    // Bootstrap
    // -----------------------------

    function bootstrap() {
        setupMapRouteWatcher();
    }

    bootstrap();

})();
