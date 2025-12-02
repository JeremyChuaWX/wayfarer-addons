// ==UserScript==
// @name         Wayfarer Map Mods - Spatial Overlay
// @version      0.1.1
// @description  Highlights differences between Niantic Spatial POIs and Wayfarer POIs
// @namespace    https://gitlab.com/Tntnnbltn/wayfarer-addons
// @downloadURL  https://gitlab.com/Tntnnbltn/wayfarer-addons/-/raw/main/wayfarer-map-mods-spatial-overlay.user.js
// @homepageURL  https://gitlab.com/Tntnnbltn/wayfarer-addons
// @match        https://wayfarer.nianticlabs.com/*
// @match        https://lightship.dev/account/geospatial-browser/*
// @run-at       document-start
// @grant        unsafeWindow
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
    "use strict";

    // =====================================================================
    // SHARED CONSTANTS
    // =====================================================================

    // Shared identifiers and origins – must match on both sides
    const uuid = "d2bb84b4-28bb-4755-bc7c-0258170ef365"; // arbitrary, but must be identical in both halves
    const ORIGIN_WAYFARER = "https://wayfarer.nianticlabs.com";
    const ORIGIN_LIGHTSHIP = "https://lightship.dev";
    const GEOSPATIAL_URL = "https://lightship.dev/account/geospatial-browser/";

    // POI bridge wiring
    const POI_BRIDGE_ID = "wfmapmods-poi-bridge";
    const POI_BRIDGE_SOURCE = "wfmapmods-spatial";

    // Settings key
    const SETTINGS_KEY = "wfmap_spatial_overlay_settings";

    // Niantic Spatial logo (used in the map control and POI bridge payload)
    const SPATIAL_LOGO_SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 375.99823 376.76566"><g transform="translate(-4.9476901,-11.658211)"><path fill="#000000" d="M 243.46978,387.94667 C 216.35092,384.45085 186.00377,360.40312 156.77769,319.25 152.38345,313.0625 148.19025,308 147.45946,308 c -0.73079,0 -4.39563,0.63801 -8.14408,1.4178 -8.70655,1.81122 -28.94558,4.26825 -41.81538,5.07641 C 84.485244,315.31148 64.373218,313.53696 52.492216,310.5231 28.586921,304.45902 11.51048,289.57522 6.532909,270.46504 -1.8569067,238.25436 23.317928,198.94257 75.826331,162.25983 c 7.768564,-5.42717 9.238167,-6.86991 8.798498,-8.63764 C 80.98378,138.98305 78,112.63306 78,95.117811 78,57.844074 88.298972,31.574567 107.77759,19.164335 123.29165,9.2800061 144.12725,9.1510897 163.95031,18.816776 197.63899,35.243302 233.36137,78.404252 263.00673,138.5 c 37.179,75.36758 53.1113,154.43085 40.9024,202.97619 -8.05559,32.03088 -31.66063,50.18027 -60.43935,46.47048 z M 264.2614,361.6927 c 5.72399,-3.35448 9.30997,-7.59103 12.8597,-15.1927 10.75004,-23.02099 9.97404,-61.461 -2.20857,-109.404 C 254.25834,155.81427 206.0879,73.666616 162.20726,44.893639 c -10.93656,-7.17121 -17.06273,-9.267705 -27.28127,-9.336182 -7.85207,-0.05262 -8.98726,0.197807 -13.48193,2.974152 -9.09878,5.620289 -14.60845,15.245831 -18.16712,31.738464 -2.59116,12.008724 -2.30871,40.573607 0.57969,58.625767 1.17885,7.36771 2.14337,13.499 2.14337,13.62508 0,0.12608 9.1125,-4.35902 20.25,-9.9669 21.96445,-11.05938 38.54774,-18.1597 60.00557,-25.69206 l 13.75556,-4.82863 6.65261,9.99183 c 3.65893,5.49551 6.46892,10.15706 6.24443,10.35899 -0.22449,0.20194 -6.48317,2.27164 -13.90817,4.59934 -43.61466,13.67294 -93.03169,39.39968 -124.864515,65.00506 -49.083303,39.48116 -60.107638,75.88566 -27.73718,91.59358 C 58.241704,289.3292 65.620991,290.5 90,290.5 c 17.89599,0 23.83039,-0.39155 35.40213,-2.33585 39.12634,-6.57404 82.52468,-21.09495 121.73033,-40.73049 C 255.29586,243.34515 262.36878,240 262.85006,240 263.70142,240 268,258.26716 268,261.88511 c 0,1.34672 -3.86509,3.65767 -15.12521,9.04337 -23.50241,11.24119 -43.33837,19.141 -66.66091,26.54818 l -13.28611,4.21963 6.32484,8.58208 c 20.13503,27.32088 40.35347,45.23847 59.13523,52.40565 8.5101,3.24749 19.34922,2.8322 25.87356,-0.99132 z M 122.57801,261.15567 C 119.03804,254.0913 113.6408,242.3712 110.58413,235.11102 105.27544,222.50183 95,194.8493 95,193.17213 95,192.28429 113.41352,180 114.74436,180 c 0.46387,0 2.1114,3.9375 3.66116,8.75 7.19692,22.34859 18.36077,49.31742 28.56379,69.0023 3.20774,6.18877 5.53941,11.42993 5.18147,11.64703 C 151.1949,269.97911 132.29408,274 130.5246,274 c -0.9346,0 -3.96368,-4.89601 -7.94659,-12.84433 z m 63.41552,-36.03004 C 175.20065,221.58437 167,210.73613 167,200 c 0,-5.01583 2.96935,-12.60419 6.58492,-16.82817 5.49811,-6.42331 10.43154,-8.62092 19.41508,-8.6485 6.43753,-0.0198 8.24435,0.38938 12.75433,2.88811 8.64378,4.78904 13.117,12.31552 13.20178,22.21283 0.12311,14.37268 -9.9738,25.15638 -24.31978,25.97402 -3.37498,0.19235 -7.26424,-0.0203 -8.6428,-0.47266 z m 125.73015,10.14068 c -0.22799,-0.42147 -1.70353,-5.80226 -3.27898,-11.9573 l -2.86445,-11.19099 2.9561,-2.30901 c 37.03562,-28.9285 54.64736,-57.23937 47.90937,-77.01428 -6.14298,-18.02868 -34.14166,-27.13273 -73.30074,-23.83447 -8.60474,0.72475 -16.7105,1.36768 -18.0128,1.42873 -1.97744,0.0927 -3.41464,-1.62011 -8.71726,-10.38899 l -6.34943,-10.5 7.43271,-1.172283 c 62.09326,-9.793308 104.70359,1.740812 119.21031,32.268843 3.44846,7.25697 3.78738,8.75619 4.14348,18.32871 0.47944,12.88802 -0.75989,18.84815 -6.43068,30.92625 -9.3308,19.87345 -27.08194,39.88562 -52.42131,59.0984 -9.06332,6.87198 -9.74811,7.29289 -10.27632,6.31639 z"/></g></svg>';

    // ---------------------------------------------------------------------
    // Small utility
    // ---------------------------------------------------------------------

    function awaitElement(selectorOrFn, timeoutMs = 60000, intervalMs = 200) {
        return new Promise((resolve, reject) => {
            const start = Date.now();
            function check() {
                const el =
                      typeof selectorOrFn === "function"
                ? selectorOrFn()
                : document.querySelector(selectorOrFn);
                if (el) return resolve(el);
                if (Date.now() - start > timeoutMs) {
                    return reject(new Error("awaitElement timeout"));
                }
                setTimeout(check, intervalMs);
            }
            check();
        });
    }

    // =====================================================================
    // WAYFARER SIDE
    // =====================================================================

    // -----------------------------
    // Settings (defaults + storage)
    // -----------------------------

    const userSettings = {
        spatialMarkers: {
            // Live + guid match (in both Spatial + Wayfarer)
            LIVE_MATCH: {
                enabled: true,
                circleFillColor: "#22c55e",
                circleFillOpacity: 0.2,
                circleRadius: 12,
                circleStrokeColor: "#157e1c",
                circleStrokeOpacity: 0.8,
                circleStrokeWeight: 1
            },
            // Live in Spatial only (not present in Wayfarer)
            LIVE_ONLY: {
                enabled: true,
                markerFillColor: "#b80fb2",
                markerFillOpacity: 0.9,
                markerStrokeColor: "#ffffff",
                markerStrokeOpacity: 1,
                markerStrokeWeight: 1,
                markerScale: 4,
                circleFillColor: "#fde047",
                circleFillOpacity: 0.6,
                circleRadius: 12,
                circleStrokeColor: "#0bad1e",
                circleStrokeOpacity: 0.7,
                circleStrokeWeight: 1
            },
            // Retired in Spatial but still live as a Wayfarer POI
            RETIRED_MATCH: {
                enabled: true,
                circleFillColor: "#ef4444",
                circleFillOpacity: 0.3,
                circleRadius: 12,
                circleStrokeColor: "#d91212",
                circleStrokeOpacity: 0.8,
                circleStrokeWeight: 4
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

    function getSpatialCfg(key) {
        const root = userSettings.spatialMarkers || {};
        return root[key] || {};
    }

    // -----------------------------
    // Wayfarer-side state
    // -----------------------------

    let wfSubmitMap = null;
    let wfSpatialButton = null;
    let wfSpatialChildWindow = null;
    let wfConnectedToGeospatial = false;
    let wfLastLatLng = null;
    let wfNextRequestId = 1;
    let wfSpatialEnabled = false;
    let wfChildMonitorInterval = null;
    let wfLatLngBodyObserver = null;
    let wfLatLngObserver = null;
    let wfLatLngTargetEl = null;
    let wfSpatialMarkers = [];
    let wfSpatialCircles = [];

    // Wayfarer-live POIs (from XHR)
    let wfWayfarerGuidSet = new Set();

    // Last spatial response so we can re-render when WF POIs change
    let wfLastSpatialResponseData = null;

    // -----------------------------
    // Bootstrap
    // -----------------------------

    function wfBootstrap() {
        loadSettings();
        wfInsertSettingsLink();

        wfGetSubmitMap().then((map) => {
            wfSubmitMap = map;
            if (!wfSubmitMap) {
                console.warn("[Spatial] Submit map not available.");
                return;
            }

            wfCreateSpatialControl(wfSubmitMap);
            wfWatchForLatLngElement();
            wfSetupMessageListener();
        });
    }

    // ------------------------------------------------------------
    // Hook Wayfarer XHR to capture live-pois data (guid, lat, lng)
    // ------------------------------------------------------------

    function wfHookWayfarerPoisXHR() {
        const XHR = window.XMLHttpRequest;
        if (!XHR || XHR._wfSpatialHooked) return;
        XHR._wfSpatialHooked = true;

        const origOpen = XHR.prototype.open;
        const origSend = XHR.prototype.send;

        XHR.prototype.open = function (method, url, ...rest) {
            try {
                this._wfSpatialMethod = method;
                this._wfSpatialUrl = typeof url === "string" ? url : "";
            } catch {
                // ignore
            }
            return origOpen.call(this, method, url, ...rest);
        };

        XHR.prototype.send = function (...args) {
            this.addEventListener(
                "load",
                function () {
                    try {
                        if (this._wfSpatialMethod !== "GET") return;
                        const url = this._wfSpatialUrl || "";
                        if (!url.includes("/api/v1/vault/live-pois-in-radius")) {
                            return;
                        }

                        const raw = this.responseText || this.response;
                        if (!raw) return;

                        let json;
                        try {
                            json = JSON.parse(raw);
                        } catch (e) {
                            console.warn("[Spatial] XHR: failed to parse live-pois JSON", e);
                            return;
                        }

                        const pois =
                              json &&
                              json.result &&
                              Array.isArray(json.result.pois)
                        ? json.result.pois
                        : [];

                        wfWayfarerGuidSet = new Set(
                            pois
                            .map((p) => p && (p.guid || p.id) || null)
                            .filter(Boolean)
                        );

                        // Re-render spatial markers now that we know which ones match
                        if (wfLastSpatialResponseData) {
                            wfHandleSpatialPoiResponse(wfLastSpatialResponseData);
                        }
                    } catch (err) {
                        console.warn("[Spatial] Error processing live-pois-in-radius XHR:", err);
                    }
                },
                false
            );

            return origSend.apply(this, args);
        };
    }

    // ------------------------------------------------------------
    // Map discovery and control
    // ------------------------------------------------------------

    function wfGetSubmitMap() {
        return new Promise((resolve) => {
            let attempts = 40;

            function tryFindMap() {
                const candidates = document.querySelectorAll(
                    "app-submit-wayspot-map nia-map"
                );
                let foundMap = null;

                candidates.forEach((el) => {
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
                    console.warn(
                        "[Spatial] Failed to find submit map after several attempts"
                    );
                    resolve(null);
                    return;
                }

                setTimeout(tryFindMap, 250);
            }

            tryFindMap();
        });
    }

    function wfCreateSpatialControl(map) {
        if (!google || !google.maps || !map) return;
        if (map._spatialControlAdded) return;
        map._spatialControlAdded = true;

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
            width: "32px",
            height: "32px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            userSelect: "none"
        });

        const iconWrapper = document.createElement("div");
        iconWrapper.innerHTML = SPATIAL_LOGO_SVG;
        Object.assign(iconWrapper.style, {
            width: "20px",
            height: "20px"
        });

        controlUI.appendChild(iconWrapper);
        controlDiv.appendChild(controlUI);

        controlUI.addEventListener("click", () => {
            if (wfSpatialEnabled) {
                wfDisableSpatialOverlay();
            } else {
                wfEnableSpatialOverlay();
            }
        });

        map.controls[google.maps.ControlPosition.LEFT_TOP].push(controlDiv);
        wfSpatialButton = controlUI;
        wfUpdateControlAppearance();
    }

    function wfEnableSpatialOverlay() {
        wfSpatialEnabled = true;
        wfUpdateControlAppearance();

        // Open the child tab if needed
        wfOpenSpatialChild();

        // Monitor the child window so the overlay turns off if it is closed
        if (!wfChildMonitorInterval) {
            wfChildMonitorInterval = setInterval(() => {
                if (!wfSpatialEnabled) return;
                if (wfSpatialChildWindow && wfSpatialChildWindow.closed) {
                    wfSpatialChildWindow = null;
                    wfDisableSpatialOverlay();
                }
            }, 1000);
        }

        // If already connected and coordinates are known, send them immediately
        if (wfConnectedToGeospatial && wfLastLatLng) {
            wfSendCoordsToGeospatial(wfLastLatLng.lat, wfLastLatLng.lng);
        }
    }

    function wfDisableSpatialOverlay() {
        wfSpatialEnabled = false;

        // Stop monitoring if not needed
        if (wfChildMonitorInterval) {
            clearInterval(wfChildMonitorInterval);
            wfChildMonitorInterval = null;
        }

        // Clear overlay graphics and update control state
        wfClearSpatialMarkers();
        wfUpdateControlAppearance();
    }

    function wfUpdateControlAppearance() {
        if (!wfSpatialButton) return;

        // OFF: white
        if (!wfSpatialEnabled) {
            wfSpatialButton.style.backgroundColor = "#ffffff";
            wfSpatialButton.style.borderColor = "#ffffff";
            return;
        }

        // ON + CONNECTED: green
        if (wfConnectedToGeospatial) {
            wfSpatialButton.style.backgroundColor = "#6ffe5e";
            wfSpatialButton.style.borderColor = "#6ffe5e";
            return;
        }

        // ON + CONNECTING: yellow
        wfSpatialButton.style.backgroundColor = "#ffce04";
        wfSpatialButton.style.borderColor = "#ffce04";
    }

    function wfOpenSpatialChild() {
        if (wfSpatialChildWindow && !wfSpatialChildWindow.closed) {
            return;
        }

        // If current coordinates are known, open Geospatial Browser at that location
        let url = GEOSPATIAL_URL;

        if (
            wfLastLatLng &&
            typeof wfLastLatLng.lat === "number" &&
            typeof wfLastLatLng.lng === "number"
        ) {
            const { lat, lng } = wfLastLatLng;
            url = `${GEOSPATIAL_URL}${lat},${lng},15,,`;
        }

        try {
            wfSpatialChildWindow = window.open(
                url,
                "niantic_spatial_child"
            );
        } catch (e) {
            console.warn("[Spatial] Failed to open child window:", e);
            wfSpatialChildWindow = null;
        }

        // Expect a PING from the child once it is ready
        wfConnectedToGeospatial = false;
        wfUpdateControlAppearance();
    }

    // ------------------------------------------------------------
    // Lat/Lng watcher – tracks the submit map coordinates display
    // ------------------------------------------------------------

    function wfParseLatLng(text) {
        if (!text) return null;
        const parts = text.split(",");
        if (parts.length !== 2) return null;

        const lat = parseFloat(parts[0].trim());
        const lng = parseFloat(parts[1].trim());
        if (Number.isNaN(lat) || Number.isNaN(lng)) return null;

        return { lat, lng };
    }

    function wfHandleLatLngChange(lat, lng) {
        wfLastLatLng = { lat, lng };
        wfSendCoordsToGeospatial(lat, lng);
    }

    function wfWatchForLatLngElement() {
        if (wfLatLngBodyObserver) return;

        function attachToLatLngElement(el) {
            if (wfLatLngTargetEl === el && wfLatLngObserver) return;

            if (wfLatLngObserver) {
                wfLatLngObserver.disconnect();
                wfLatLngObserver = null;
            }

            wfLatLngTargetEl = el;
            let lastText = (el.textContent || "").trim();
            const initialCoords = wfParseLatLng(lastText);
            if (initialCoords) {
                wfHandleLatLngChange(initialCoords.lat, initialCoords.lng);
            }

            wfLatLngObserver = new MutationObserver(() => {
                if (!document.body.contains(el)) {
                    wfLatLngObserver.disconnect();
                    wfLatLngObserver = null;
                    wfLatLngTargetEl = null;
                    return;
                }

                const newText = (el.textContent || "").trim();
                if (newText === lastText) return;
                lastText = newText;

                const coords = wfParseLatLng(newText);
                if (!coords) return;
                wfHandleLatLngChange(coords.lat, coords.lng);
            });

            wfLatLngObserver.observe(el, {
                childList: true,
                subtree: true,
                characterData: true
            });
        }

        function findAndAttachLatLngElement() {
            const el =
                  document.querySelector(".submit-coordinates-text") ||
                  document.querySelector(".text-gray-400.text-xs");
            if (!el) return;
            attachToLatLngElement(el);
        }

        wfLatLngBodyObserver = new MutationObserver(() => {
            findAndAttachLatLngElement();
        });

        wfLatLngBodyObserver.observe(document.body, {
            childList: true,
            subtree: true
        });

        findAndAttachLatLngElement();
    }

    // ------------------------------------------------------------
    // postMessage wiring (Wayfarer <-> Geospatial)
    // ------------------------------------------------------------

    function wfSetupMessageListener() {
        window.addEventListener(
            "message",
            (event) => {
                if (event.origin !== ORIGIN_LIGHTSHIP) return;
                const data = event.data || {};
                if (data.uuid !== uuid) return;

                if (data.type === "PING") {
                    wfSpatialChildWindow = event.source;
                    wfConnectedToGeospatial = true;
                    wfUpdateControlAppearance();

                    try {
                        event.source.postMessage(
                            { uuid, type: "PONG", data: null },
                            ORIGIN_LIGHTSHIP
                        );
                    } catch (e) {
                        console.warn("[Spatial] Failed to send PONG:", e);
                    }

                    if (wfLastLatLng) {
                        wfSendCoordsToGeospatial(
                            wfLastLatLng.lat,
                            wfLastLatLng.lng
                        );
                    }
                } else if (data.type === "RESPONSE") {
                    wfHandleSpatialPoiResponse(data.data);
                } else if (data.type === "ERROR" || data.type === "EXCEPTION") {
                    console.warn("[Spatial] Error from geospatial:", data.data);
                }
            },
            false
        );
    }

    function wfSendCoordsToGeospatial(lat, lng) {
        if (
            !wfSpatialChildWindow ||
            wfSpatialChildWindow.closed ||
            !wfConnectedToGeospatial
        ) {
            return;
        }

        const reqId = wfNextRequestId++;

        const msg = {
            uuid,
            type: "REQUEST",
            data: { lat, lng },
            req: reqId
        };

        try {
            wfSpatialChildWindow.postMessage(msg, ORIGIN_LIGHTSHIP);
        } catch (e) {
            console.warn("[Spatial] Failed to send REQUEST:", e);
        }
    }

    // ------------------------------------------------------------
    // Marker / circle helpers
    // ------------------------------------------------------------

    function wfClearSpatialMarkers() {
        wfSpatialMarkers.forEach((m) => m.setMap(null));
        wfSpatialMarkers = [];
        wfSpatialCircles.forEach((c) => c.setMap(null));
        wfSpatialCircles = [];
    }

    function wfDistanceMeters(a, b) {
        if (!a || !b) return Infinity;
        const R = 6371000; // Earth radius (m)
        const toRad = (deg) => deg * Math.PI / 180;

        const dLat = toRad(b.lat - a.lat);
        const dLng = toRad(b.lng - a.lng);
        const lat1 = toRad(a.lat);
        const lat2 = toRad(b.lat);

        const sinDLat = Math.sin(dLat / 2);
        const sinDLng = Math.sin(dLng / 2);

        const h =
              sinDLat * sinDLat +
              Math.cos(lat1) * Math.cos(lat2) * sinDLng * sinDLng;

        const c = 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
        return R * c;
    }

    function wfExtractPoiLatLng(poi) {
        if (!poi || typeof poi !== "object") return null;

        if (typeof poi.lat === "number" && typeof poi.lng === "number") {
            return { lat: poi.lat, lng: poi.lng };
        }
        if (typeof poi.latitude === "number" && typeof poi.longitude === "number") {
            return { lat: poi.latitude, lng: poi.longitude };
        }
        if (
            poi.location &&
            typeof poi.location.lat === "number" &&
            typeof poi.location.lng === "number"
        ) {
            return { lat: poi.location.lat, lng: poi.location.lng };
        }

        return null;
    }

    function wfCreateCircle(pos, cfg, extraOpts) {
        if (!wfSubmitMap || !google || !google.maps) return null;

        const circle = new google.maps.Circle(
            Object.assign(
                {
                    map: wfSubmitMap,
                    center: pos,
                    radius: cfg.circleRadius ?? 30,
                    strokeColor: cfg.circleStrokeColor || cfg.circleFillColor || "#000000",
                    strokeWeight: cfg.circleStrokeWeight ?? 0,
                    strokeOpacity: cfg.circleStrokeOpacity ?? 0.0,
                    fillColor: cfg.circleFillColor || "#000000",
                    fillOpacity: cfg.circleFillOpacity ?? 0.2,
                    clickable: false,
                    zIndex: cfg.zIndex ?? 10
                },
                extraOpts || {}
            )
        );

        wfSpatialCircles.push(circle);
        return circle;
    }

    function wfCreateMarker(pos, cfg, poi, clickable) {
        if (!wfSubmitMap || !google || !google.maps) return null;

        const marker = new google.maps.Marker({
            map: wfSubmitMap,
            position: pos,
            icon: {
                path: google.maps.SymbolPath.CIRCLE,
                scale: cfg.markerScale ?? 5,
                fillColor: cfg.markerFillColor || "#000000",
                fillOpacity: cfg.markerFillOpacity ?? 0.9,
                strokeColor: cfg.markerStrokeColor || "#ffffff",
                strokeWeight: cfg.markerStrokeWeight ?? 1,
                strokeOpacity: cfg.markerStrokeOpacity ?? 1.0
            },
            clickable: !!clickable,
            zIndex: 100
        });

        marker._spatialPoi = poi;

        if (clickable) {
            marker.addListener("click", () => {
                wfSendPoiToBridge(marker._spatialPoi || poi);
            });
        }

        wfSpatialMarkers.push(marker);
        return marker;
    }

    // ------------------------------------------------------------
    // Main response handler from Spatial
    // ------------------------------------------------------------

    function wfHandleSpatialPoiResponse(responseData) {
        // If the overlay is off, do nothing.
        if (!wfSpatialEnabled) return;
        if (!responseData) return;

        wfLastSpatialResponseData = responseData;

        if (!wfSubmitMap) {
            // Map not ready yet – handler will be triggered again when needed.
            return;
        }

        wfClearSpatialMarkers();

        const pois = Array.isArray(responseData.pois)
        ? responseData.pois
        : Array.isArray(responseData)
        ? responseData
        : [];

        pois.forEach((poi) => {
            const pos = wfExtractPoiLatLng(poi);
            if (!pos) return;

            const state = (poi.state || "").toUpperCase();

            if (state === "GAME_REJECTED") {
                return;
            }

            const spatialId = poi.id || null;
            const hasGuidMatch =
                  !!spatialId && wfWayfarerGuidSet && wfWayfarerGuidSet.has(spatialId);

            if (state === "LIVE") {
                if (hasGuidMatch) {
                    // LIVE + guid match → green circle only
                    const cfg = getSpatialCfg("LIVE_MATCH");
                    if (cfg.enabled === false) return;
                    wfCreateCircle(pos, cfg, { zIndex: 5 });
                } else {
                    // LIVE + no match
                    const cfg = getSpatialCfg("LIVE_ONLY");
                    if (cfg.enabled === false) return;

                    // Always show the small live marker...
                    wfCreateMarker(pos, cfg, poi, true);

                    // ...but only draw the yellow circle if within 200 m of the current WF center.
                    // This avoids highlighting POIs outside the Wayfarer fetch radius.
                    if (wfLastLatLng) {
                        const d = wfDistanceMeters(wfLastLatLng, pos);
                        if (d <= 200) {
                            wfCreateCircle(pos, cfg, { zIndex: 5 });
                        }
                    }
                }
                return;
            }

            if (state === "RETIRED" && hasGuidMatch) {
                // RETIRED + guid match → red circle only
                const cfg = getSpatialCfg("RETIRED_MATCH");
                if (cfg.enabled === false) return;
                wfCreateCircle(pos, cfg, { zIndex: 5 });
            }
        });
    }

    // ------------------------------------------------------------
    // POI bridge integration
    // ------------------------------------------------------------

    function wfSendPoiToBridge(poi) {
        const bridge = document.getElementById(POI_BRIDGE_ID);
        if (!bridge || !poi) return;

        const loc = wfExtractPoiLatLng(poi) || {};
        const lat = typeof loc.lat === "number" ? loc.lat : null;
        const lng = typeof loc.lng === "number" ? loc.lng : null;

        let imageUrl = "";
        if (Array.isArray(poi.images) && poi.images.length > 0) {
            const img = poi.images[1] || poi.images[0];
            if (img && typeof img.url === "string") {
                imageUrl = img.url;
            }
        }

        const payload = {
            guid: poi.id || poi.guid || "",
            title: poi.title || "(untitled)",
            description: poi.description || "",
            lat,
            lng,
            imageUrl,
            status: poi.state || "",
            source: POI_BRIDGE_SOURCE,
            dataSourceLogo: SPATIAL_LOGO_SVG,
            dataSourceText: "Niantic Spatial POI"
        };

        try {
            bridge.setAttribute("data-payload", JSON.stringify(payload));
        } catch (e) {
            console.warn("[SpatialOverlay] Failed to serialise POI for bridge", e);
        }
    }

    // ------------------------------------------------------------
    // Settings UI – “Spatial overlay” entry + modal
    // ------------------------------------------------------------

    function wfInsertSettingsLink() {
        const interval = setInterval(() => {
            const settingsBody = document.querySelector(".wfmapmods-settings-links");
            if (!settingsBody) return;

            clearInterval(interval);

            if (document.getElementById("wfmapmods-settings-spatial-overlay")) return;

            const link = document.createElement("a");
            link.id = "wfmapmods-settings-spatial-overlay";
            link.textContent = "Spatial overlay";
            link.style.cursor = "pointer";

            settingsBody.appendChild(link);

            link.addEventListener("click", (ev) => {
                ev.preventDefault();
                wfOpenSpatialSettingsWindow();
            });
        }, 300);
    }

    /**
     * Opens a modal to customise the visual style for one Spatial status
     * (LIVE_MATCH, LIVE_ONLY, RETIRED_MATCH).
     */
    function wfOpenSpatialStyleModal(statusKey, label, cfg, hasCircle, hasMarker, onUpdated) {
        // Remove any existing modal with the same id
        const existing = document.getElementById(`wfmapmods-spatial-style-${statusKey}`);
        if (existing && existing.parentNode) {
            existing.parentNode.removeChild(existing);
        }

        const backdrop = document.createElement("div");
        backdrop.id = `wfmapmods-spatial-style-${statusKey}`;
        Object.assign(backdrop.style, {
            position: "fixed",
            inset: "0",
            background: "rgba(0,0,0,0.4)",
            zIndex: "10000",
            display: "flex",
            alignItems: "center",
            justifyContent: "center"
        });

        const dialog = document.createElement("div");
        Object.assign(dialog.style, {
            background: "#fff",
            color: "#000",
            minWidth: "200px",
            maxWidth: "520px",
            maxHeight: "80vh",
            borderRadius: "4px",
            boxShadow: "0 2px 12px rgba(0,0,0,0.4)",
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
            fontSize: "13px"
        });

        const header = document.createElement("div");
        Object.assign(header.style, {
            padding: "6px 10px",
            borderBottom: "1px solid #ddd",
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            gap: "6px",
            fontWeight: "bold",
            fontSize: "13px",
            whiteSpace: "normal",
            wordBreak: "break-word"
        });
        header.textContent = `Customise – ${label}`;


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
        header.appendChild(closeBtn);

        const body = document.createElement("div");
        Object.assign(body.style, {
            padding: "8px 12px",
            overflowY: "auto",
            flex: "1 1 auto"
        });

        const footer = document.createElement("div");
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

        // Helpers for building inputs
        function makeLabel(text) {
            const l = document.createElement("label");
            l.textContent = text;
            l.style.fontSize = "11px";
            return l;
        }
        function makeColorInput(value) {
            const input = document.createElement("input");
            input.type = "color";
            input.value = value;
            input.style.width = "40px";
            input.style.padding = "0";
            return input;
        }
        function makeNumberInput(value, min, max, step, width = "70px") {
            const input = document.createElement("input");
            input.type = "number";
            input.value = value;
            input.min = String(min);
            input.max = String(max);
            input.step = String(step);
            input.style.width = width;
            input.style.fontSize = "11px";
            input.style.padding = "2px 4px";
            input.style.boxSizing = "border-box";
            return input;
        }

        const ctx = {};

        // ----- Circle style section -----
        if (hasCircle) {
            const section = document.createElement("div");
            section.style.marginBottom = "10px";

            const title = document.createElement("div");
            title.textContent = "Highlight circle";
            title.style.fontSize = "11px";
            title.style.fontWeight = "bold";
            title.style.marginBottom = "4px";
            section.appendChild(title);

            const form = document.createElement("div");
            form.style.display = "grid";
            form.style.gridTemplateColumns = "max-content 1fr";
            form.style.rowGap = "4px";
            form.style.columnGap = "8px";
            form.style.alignItems = "center";

            const cStrokeColorInput = makeColorInput(cfg.circleStrokeColor || cfg.circleFillColor || "#000000");
            const cStrokeOpacityInput = makeNumberInput(cfg.circleStrokeOpacity ?? 0.8, 0, 1, 0.05);
            const cStrokeWidthInput = makeNumberInput(cfg.circleStrokeWeight ?? 1, 0, 10, 0.5);
            const cFillColorInput = makeColorInput(cfg.circleFillColor || "#000000");
            const cFillOpacityInput = makeNumberInput(cfg.circleFillOpacity ?? 0.4, 0, 1, 0.05);
            const cRadiusInput = makeNumberInput(cfg.circleRadius ?? 12, 1, 500, 1, "80px");

            form.appendChild(makeLabel("Border colour"));
            form.appendChild(cStrokeColorInput);

            form.appendChild(makeLabel("Border opacity"));
            form.appendChild(cStrokeOpacityInput);

            form.appendChild(makeLabel("Border width"));
            form.appendChild(cStrokeWidthInput);

            form.appendChild(makeLabel("Fill colour"));
            form.appendChild(cFillColorInput);

            form.appendChild(makeLabel("Fill opacity"));
            form.appendChild(cFillOpacityInput);

            form.appendChild(makeLabel("Radius (m)"));
            form.appendChild(cRadiusInput);

            section.appendChild(form);

            body.appendChild(section);

            ctx.circle = {
                cStrokeColorInput,
                cStrokeOpacityInput,
                cStrokeWidthInput,
                cFillColorInput,
                cFillOpacityInput,
                cRadiusInput,
            };
        }

        // ----- Marker style section -----
        if (hasMarker) {
            const section = document.createElement("div");
            section.style.marginBottom = "4px";

            const title = document.createElement("div");
            title.textContent = "Marker";
            title.style.fontSize = "11px";
            title.style.fontWeight = "bold";
            title.style.marginBottom = "4px";
            section.appendChild(title);

            const form = document.createElement("div");
            form.style.display = "grid";
            form.style.gridTemplateColumns = "max-content 1fr";
            form.style.rowGap = "4px";
            form.style.columnGap = "8px";
            form.style.alignItems = "center";

            const mStrokeColorInput = makeColorInput(cfg.markerStrokeColor || "#000000");
            const mStrokeOpacityInput = makeNumberInput(cfg.markerStrokeOpacity ?? 1.0, 0, 1, 0.05);
            const mStrokeWidthInput = makeNumberInput(cfg.markerStrokeWeight ?? 1, 0, 10, 0.5);
            const mFillColorInput = makeColorInput(cfg.markerFillColor || "#000000");
            const mFillOpacityInput = makeNumberInput(cfg.markerFillOpacity ?? 0.9, 0, 1, 0.05);
            const mScaleInput = makeNumberInput(cfg.markerScale ?? 4, 2, 30, 1);

            form.appendChild(makeLabel("Border colour"));
            form.appendChild(mStrokeColorInput);

            form.appendChild(makeLabel("Border opacity"));
            form.appendChild(mStrokeOpacityInput);

            form.appendChild(makeLabel("Border width"));
            form.appendChild(mStrokeWidthInput);

            form.appendChild(makeLabel("Fill colour"));
            form.appendChild(mFillColorInput);

            form.appendChild(makeLabel("Fill opacity"));
            form.appendChild(mFillOpacityInput);

            form.appendChild(makeLabel("Marker size"));
            form.appendChild(mScaleInput);

            section.appendChild(form);

            body.appendChild(section);

            ctx.marker = {
                mStrokeColorInput,
                mStrokeOpacityInput,
                mStrokeWidthInput,
                mFillColorInput,
                mFillOpacityInput,
                mScaleInput,
            };
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

        document.addEventListener("keydown", keyHandler);
        closeBtn.addEventListener("click", closeModal);
        cancelBtn.addEventListener("click", closeModal);
        backdrop.addEventListener("click", (evt) => {
            if (evt.target === backdrop) {
                closeModal();
            }
        });

        okBtn.addEventListener("click", () => {
            // Commit circle settings
            if (ctx.circle) {
                const {
                    cStrokeColorInput,
                    cStrokeOpacityInput,
                    cStrokeWidthInput,
                    cFillColorInput,
                    cFillOpacityInput,
                    cRadiusInput
                } = ctx.circle;

                cfg.circleStrokeColor = cStrokeColorInput.value || cfg.circleStrokeColor || cfg.circleFillColor || "#000000";
                cfg.circleStrokeOpacity = wfClamp(cStrokeOpacityInput.value, 0, 1, cfg.circleStrokeOpacity ?? 0.8);
                cfg.circleStrokeWeight = wfClamp(cStrokeWidthInput.value, 0, 10, cfg.circleStrokeWeight ?? 1);
                cfg.circleFillColor = cFillColorInput.value || cfg.circleFillColor || "#000000";
                cfg.circleFillOpacity = wfClamp(cFillOpacityInput.value, 0, 1, cfg.circleFillOpacity ?? 0.4);
                cfg.circleRadius = wfClamp(cRadiusInput.value, 1, 500, cfg.circleRadius ?? 12);
            }

            // Commit marker settings
            if (ctx.marker) {
                const {
                    mStrokeColorInput,
                    mStrokeOpacityInput,
                    mStrokeWidthInput,
                    mFillColorInput,
                    mFillOpacityInput,
                    mScaleInput
                } = ctx.marker;

                cfg.markerStrokeColor = mStrokeColorInput.value || cfg.markerStrokeColor || "#000000";
                cfg.markerStrokeOpacity = wfClamp(mStrokeOpacityInput.value, 0, 1, cfg.markerStrokeOpacity ?? 1.0);
                cfg.markerStrokeWeight = wfClamp(mStrokeWidthInput.value, 0, 10, cfg.markerStrokeWeight ?? 1);
                cfg.markerFillColor = mFillColorInput.value || cfg.markerFillColor || "#000000";
                cfg.markerFillOpacity = wfClamp(mFillOpacityInput.value, 0, 1, cfg.markerFillOpacity ?? 0.9);
                cfg.markerScale = wfClamp(mScaleInput.value, 2, 30, cfg.markerScale ?? 4);
            }

            if (typeof onUpdated === "function") {
                onUpdated();
            }

            closeModal();
        });
    }

    function wfOpenSpatialSettingsWindow() {
        const existing = document.getElementById(
            "wfmapmods-spatial-settings-backdrop"
        );
        if (existing && existing.parentNode) {
            existing.parentNode.removeChild(existing);
        }

        const backdrop = document.createElement("div");
        backdrop.id = "wfmapmods-spatial-settings-backdrop";
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
        Object.assign(dialog.style, {
            background: "#fff",
            color: "#000",
            minWidth: "260px",
            maxWidth: "360px",
            maxHeight: "80vh",
            borderRadius: "4px",
            boxShadow: "0 2px 12px rgba(0,0,0,0.4)",
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
            fontSize: "12px"
        });

        const header = document.createElement("div");
        Object.assign(header.style, {
            padding: "8px 12px",
            borderBottom: "1px solid #ddd",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            fontWeight: "bold"
        });
        header.textContent = "Spatial overlay options";

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
        header.appendChild(closeBtn);

        const body = document.createElement("div");
        Object.assign(body.style, {
            padding: "8px 12px",
            overflowY: "auto",
            flex: "1 1 auto"
        });

        const introNote = document.createElement("div");
        introNote.style.fontSize = "11px";
        introNote.style.marginBottom = "12px";
        introNote.textContent =
            `This plug-in highlights similarities and differences between Wayfarer POI data and Niantic Spatial POI data. ` +
            `Use requires a developer account for lightship.dev. No data from either site is stored. ` +
            `If using this plug-in, please consider the Terms of Service of both services.`;
        body.appendChild(introNote);

        const footer = document.createElement("div");
        Object.assign(footer.style, {
            padding: "8px 12px",
            borderTop: "1px solid #ddd",
            textAlign: "right",
            display: "flex",
            justifyContent: "flex-end",
            gap: "8px"
        });

        const hint = document.createElement("div");
        hint.style.fontSize = "11px";
        hint.style.marginBottom = "12px -";
        hint.textContent =
            `POIs which are live in Wayfarer will be shown with a colour-coded background based on Spatial status. ` +
            `POIs which appear in Spatial but not in Wayfarer will also be represented with a clickable marker. ` +
            `Visual appearance for each type of marker can be customised.`;
        body.appendChild(hint);

        const table = document.createElement("table");
        table.style.width = "100%";
        table.style.borderCollapse = "collapse";
        table.style.fontSize = "11px";

        function addHeaderRow() {
            const tr = document.createElement("tr");

            const thType = document.createElement("th");
            const thShow = document.createElement("th");
            const thCustomise = document.createElement("th");

            thType.textContent = "Type";
            thShow.textContent = "Show";
            thCustomise.textContent = " ";

            [thType, thShow, thCustomise].forEach((th) => {
                th.style.textAlign = "left";
                th.style.padding = "2px 4px";
            });

            thShow.style.textAlign = "center";
            thCustomise.style.textAlign = "right";

            tr.appendChild(thType);
            tr.appendChild(thShow);
            tr.appendChild(thCustomise);
            table.appendChild(tr);
        }

        addHeaderRow();

        const rows = [
            {
                key: "LIVE_MATCH",
                label: "Live in both Spatial AND Wayfarer",
                help: "(e.g. Approved prior to split)",
                hasCircle: true,
                hasMarker: false
            },
            {
                key: "LIVE_ONLY",
                label: "Live in Spatial but not in Wayfarer",
                help: "(e.g. Newer Ingress submissions)",
                hasCircle: true,
                hasMarker: true
            },
            {
                key: "RETIRED_MATCH",
                label: "Retired in Spatial but live in Wayfarer",
                help: "(e.g. Retired from Ingress after split)",
                hasCircle: true,
                hasMarker: false
            }
        ];

        function makeCell() {
            const cell = document.createElement("td");
            cell.style.padding = "2px 4px";
            cell.style.verticalAlign = "middle";
            return cell;
        }

        rows.forEach((rowDef) => {
            const cfg = getSpatialCfg(rowDef.key);

            const tr = document.createElement("tr");
            tr.style.padding = "4px 0";

            const tdLabel = makeCell();

            const labelContainer = document.createElement("div");
            labelContainer.style.display = "flex";
            labelContainer.style.flexDirection = "column";

            const mainLabel = document.createElement("span");
            mainLabel.textContent = rowDef.label;

            const helper = document.createElement("span");
            helper.textContent = rowDef.help || "";
            helper.style.fontSize = "10px";
            helper.style.fontStyle = "italic";
            helper.style.opacity = "0.75";
            helper.style.marginTop = "2px";

            labelContainer.appendChild(mainLabel);
            if (rowDef.help) labelContainer.appendChild(helper);

            tdLabel.appendChild(labelContainer);

            tr.appendChild(tdLabel);

            const tdShow = makeCell();
            tdShow.style.textAlign = "center";
            const showChk = document.createElement("input");
            showChk.type = "checkbox";
            showChk.checked = cfg.enabled !== false;
            tdShow.appendChild(showChk);
            tr.appendChild(tdShow);

            const tdCustomise = makeCell();
            tdCustomise.style.textAlign = "right";
            const customiseBtn = document.createElement("button");
            customiseBtn.type = "button";
            customiseBtn.textContent = "Customise";
            customiseBtn.style.background = "transparent";
            customiseBtn.style.border = "none";
            customiseBtn.style.cursor = "pointer";
            customiseBtn.style.fontSize = "11px";
            customiseBtn.style.textDecoration = "underline";
            tdCustomise.appendChild(customiseBtn);
            tr.appendChild(tdCustomise);

            table.appendChild(tr);

            showChk.addEventListener("change", () => {
                cfg.enabled = !!showChk.checked;
            });

            customiseBtn.addEventListener("click", () => {
                // Open style modal for this status
                wfOpenSpatialStyleModal(
                    rowDef.key,
                    rowDef.label,
                    cfg,
                    rowDef.hasCircle,
                    rowDef.hasMarker,
                    () => {
                        // Re-render live markers immediately with new styles
                        if (wfLastSpatialResponseData) {
                            wfHandleSpatialPoiResponse(wfLastSpatialResponseData);
                        }
                    }
                );
            });
        });

        body.appendChild(table);

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

        document.addEventListener("keydown", keyHandler);

        closeBtn.addEventListener("click", closeModal);
        cancelBtn.addEventListener("click", closeModal);

        okBtn.addEventListener("click", () => {
            // Enabled flags & styles are already on cfg via handlers / style modal
            saveSettings();

            if (wfLastSpatialResponseData) {
                wfHandleSpatialPoiResponse(wfLastSpatialResponseData);
            }

            closeModal();
        });

        backdrop.addEventListener("click", (evt) => {
            if (evt.target === backdrop) {
                closeModal();
            }
        });
    }

    // =====================================================================
    // HELPERS
    // =====================================================================

    // Simple numeric clamp helper
    function wfClamp(value, min, max, fallback) {
        let n = Number(value);
        if (!Number.isFinite(n)) return fallback;
        if (n < min) return min;
        if (n > max) return max;
        return n;
    }

    // =====================================================================
    // LIGHTSHIP / GEOSPATIAL SIDE
    // =====================================================================

    function lsInit() {
        let vpsInit = null;
        let vpsUuid = null;
        let btn = null;
        let newToken = null;

        if (window.opener) {
            window.addEventListener("message", (e) => {
                if (e.origin !== ORIGIN_WAYFARER || e.data.uuid !== uuid) return;

                if (e.data.type === "REQUEST") {
                    // Wayfarer sent new coordinates
                    if (vpsInit && vpsUuid) {
                        const lat = e.data.data.lat;
                        const lng = e.data.data.lng;

                        history.replaceState(
                            history.state,
                            "",
                            `https://lightship.dev/account/geospatial-browser/${lat},${lng},15,,`
                        );

                        unsafeWindow
                            .fetch(
                            `/v1/vps/getPoisInRadius/${vpsUuid}/${lat}/${lng}/500`,
                            {
                                ...vpsInit,
                                _wflsiRequestID: e.data.req
                            }
                        )
                            .then(() => {})
                            .catch((err) => {
                            console.error(err);
                            e.source.postMessage(
                                {
                                    uuid,
                                    type: "EXCEPTION",
                                    data: err,
                                    req: e.data.req
                                },
                                ORIGIN_WAYFARER
                            );
                        });
                    } else {
                        e.source.postMessage(
                            {
                                uuid,
                                type: "ERROR",
                                data: "VPS is not initialized yet!",
                                req: e.data.req
                            },
                            ORIGIN_WAYFARER
                        );
                    }
                } else if (e.data.type === "PONG") {
                    // Wayfarer acknowledged the PING
                    if (btn) btn.parentNode.removeChild(btn);
                    btn = document.createElement("button");
                    btn.disabled = true;
                    btn.style.padding = "15px";
                    btn.style.marginRight = "16px";
                    btn.style.borderRadius = "0.1875rem";
                    btn.style.color = "green";
                    btn.style.backgroundColor = "#cfc";
                    btn.textContent = "\u{1F4E1} Connected to Wayfarer";

                    const acctBtn = document.querySelector(
                        "header .account-menu button"
                    );
                    if (acctBtn && acctBtn.parentNode) {
                        acctBtn.parentNode.insertBefore(btn, acctBtn);
                    }

                    const intv = setInterval(() => {
                        if (!window.opener) {
                            clearInterval(intv);
                            if (btn && btn.parentNode) {
                                btn.parentNode.removeChild(btn);
                            }
                        } else if (!btn.closest("html")) {
                            clearInterval(intv);
                            tryAddConnectedButton();
                        }
                    }, 200);
                }
            });

            const tryAddConnectedButton = () =>
            awaitElement(() =>
                         document.querySelector("header .account-menu button")
                        ).then(() => {
                // Initiate handshake with Wayfarer
                window.opener.postMessage(
                    { uuid, type: "PING", data: null },
                    ORIGIN_WAYFARER
                );
            });

            tryAddConnectedButton();

            // Hook fetch so we can detect getPoisInRadius and forward results
            (function (f) {
                unsafeWindow.fetch = async (url, init = {}) => {
                    const resp = await f(url, init);
                    const rsc = resp.clone();

                    if (
                        rsc.url.startsWith(
                            "https://lightship.dev/v1/vps/getPoisInRadius"
                        )
                    ) {
                        vpsInit = { ...init };
                        const match = rsc.url.match(
                            /[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}/
                        );
                        if (match) {
                            vpsUuid = match[0];
                        }

                        if (newToken) {
                            if (!vpsInit.headers) vpsInit.headers = {};
                            vpsInit.headers.Authorization = newToken;
                            newToken = null;
                            console.log("Applied new access token");
                        }

                        rsc.json()
                            .then((data) => {
                            // Forward POI data back to Wayfarer
                            if (window.opener) {
                                window.opener.postMessage(
                                    {
                                        uuid,
                                        type: "RESPONSE",
                                        data,
                                        req: init._wflsiRequestID
                                    },
                                    ORIGIN_WAYFARER
                                );
                            }
                        })
                            .catch(console.error);
                    } else if (
                        rsc.url.startsWith(
                            "https://securetoken.googleapis.com/v1/token"
                        )
                    ) {
                        rsc.json()
                            .then((data) => {
                            newToken = data.access_token;
                            console.log("Received new access token");
                        })
                            .catch(console.error);
                    }

                    return resp;
                };
            })(unsafeWindow.fetch);
        } else {
            // Running directly on lightship.dev without an opener – no Wayfarer integration needed.
        }
    }

    // =====================================================================
    // ENTRY POINT
    // =====================================================================

    const origin = window.location.origin;

    if (origin === ORIGIN_WAYFARER) {
        // Hook XHR early so live-pois requests are captured
        wfHookWayfarerPoisXHR();

        if (document.readyState === "loading") {
            document.addEventListener("DOMContentLoaded", wfBootstrap);
        } else {
            wfBootstrap();
        }
    } else if (origin === ORIGIN_LIGHTSHIP) {
        if (document.readyState === "loading") {
            document.addEventListener("DOMContentLoaded", lsInit);
        } else {
            lsInit();
        }
    }
})();
