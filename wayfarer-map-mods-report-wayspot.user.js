// ==UserScript==
// @name         Wayfarer Map Mods - Report Wayspots
// @version      0.1.2
// @description  Adds a "Report Wayspot" link to the side panel and pre-fills the Helpshift form using POI bridge data
// @namespace    https://gitlab.com/Tntnnbltn/wayfarer-addons
// @downloadURL  https://gitlab.com/Tntnnbltn/wayfarer-addons/-/raw/main/wayfarer-map-mods-report-wayspot.user.js
// @homepageURL  https://gitlab.com/Tntnnbltn/wayfarer-addons
// @match        https://wayfarer.nianticlabs.com/*
// @match        https://niantic.helpshift.com/hc/en/5-report-an-issue-with-a-pokestop-gym/contact-us/*
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

    // Random UUID, unique to this userscript
    const uuid = '1ba36113-7f8a-4ff8-9451-d5bfca869633';

    const SETTINGS_KEY = "wfmap_report_wayspot_settings";

    const ORIGIN_WAYFARER = 'https://wayfarer.nianticlabs.com';
    const ORIGIN_HELPSHIFT = 'https://niantic.helpshift.com';

    const REPORT_URL = 'https://niantic.helpshift.com/hc/en/5-report-an-issue-with-a-pokestop-gym/contact-us/?p=web&contact=1&l=en';

    const CURRENT_ORIGIN = window.location.origin;

    // Message types for postMessage
    const MSG_EXECUTOR = uuid;
    const MSG_GET_DATA = 'wf-report-get-data';
    const MSG_DATA = 'wf-report-data';

    // Cache of last report payload in the Wayfarer tab
    let lastReportPayload = null;

    // Track whether we've already hooked onPoisFetched
    let poiHookAttached = false;

    // Cache of live POIs loaded via the live-pois-in-radius API
    let livePois = [];

    // ======================================================================
    // WAYFARER SIDE
    // ======================================================================

    const userSettings = {};

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

    function initWayfarer() {
        hookLivePoisXHR();
        startSidePanelWatcher();
        loadSettings();
        setupWayfarerMessaging();
        startPoiBridgeWatcherIfReady();
    }

    function hookLivePoisXHR() {
        const XHR = window.XMLHttpRequest || XMLHttpRequest;
        if (!XHR || XHR.__wfReportHooked) return; // avoid double-hooking

        XHR.__wfReportHooked = true;

        const origOpen = XHR.prototype.open;
        const origSend = XHR.prototype.send;

        XHR.prototype.open = function(method, url, ...rest) {
            this._wf_report_url = url;
            return origOpen.call(this, method, url, ...rest);
        };

        XHR.prototype.send = function(...args) {
            this.addEventListener("load", function() {
                try {
                    if (this._wf_report_url &&
                        this._wf_report_url.includes("/api/v1/vault/live-pois-in-radius")) {

                        const json = JSON.parse(this.responseText);
                        const pois = (json &&
                                      json.result &&
                                      Array.isArray(json.result.pois))
                        ? json.result.pois
                        : [];

                        livePois = pois;
                    }
                } catch (e) {
                    console.error("[Report Wayspot] error parsing live-pois-in-radius response:", e);
                }
            });

            return origSend.apply(this, args);
        };
    }

    function startSidePanelWatcher() {
        sidePanelMutationHandler();

        const mo = new MutationObserver(sidePanelMutationHandler);
        mo.observe(document.documentElement || document.body, {
            childList: true,
            subtree: true
        });
    }

    function sidePanelMutationHandler() {
        insertReportWayspotLinkIfReady();
        insertReportingSettingsLinkIfReady();
    }

    function insertReportWayspotLinkIfReady() {
        const reportLinkBody = document.querySelector('.wfmapmods-poi-function-links');
        if (!reportLinkBody) return;

        const linkId = 'wfmapmods-settings-report-wayspot';
        let link = document.getElementById(linkId);

        // If link already exists, nothing more to do here
        if (!link) {
            link = document.createElement('a');
            link.id = linkId;
            link.textContent = 'Report';
            link.style.cursor = 'pointer';
            // default hidden until we know the status
            link.style.display = 'none';

            reportLinkBody.appendChild(link);

            updateReportWayspotLinkVisibility();

            link.addEventListener('click', (ev) => {
                ev.preventDefault();
                handleReportWayspotClick();
            });
        }
    }

    function updateReportWayspotLinkVisibility() {
        const link = document.getElementById('wfmapmods-settings-report-wayspot');
        if (!link) return;

        const info = getCurrentWayspotBridgeData();
        console.log(info);
        if (!info || !info.status) {
            link.style.display = 'none';
            return;
        }

        const { status, source, lat, lng } = info;
        let visible = false;

        // Condition 1: LIVE + wfmapmods-main (trust the bridge alone)
        if (status === 'LIVE' && source === 'wfmapmods-base') {
            visible = true;
        } else if (status === 'LIVE' || status === 'ACCEPTED') {
            // Condition 2: LIVE/ACCEPTED from any source, but must match a loaded POI
            if (typeof lat === 'number' && typeof lng === 'number') {
                const pois = Array.isArray(livePois) ? livePois : [];
                console.log("livePois for visibility check:", pois);
                const EPS = 1e-7;

                visible = pois.some(p =>
                    p &&
                    typeof p.lat === 'number' &&
                    typeof p.lng === 'number' &&
                    Math.abs(p.lat - lat) < EPS &&
                    Math.abs(p.lng - lng) < EPS
                );
            }
        }

        link.style.display = visible ? '' : 'none';
    }


    function getCurrentWayspotBridgeData() {
        const bridge = document.getElementById('wfmapmods-poi-bridge');
        if (!bridge) return null;

        const payloadAttr = bridge.getAttribute('data-payload');
        if (!payloadAttr) return null;

        let jsonStr = payloadAttr.replace(/&quot;/g, '"').replace(/&amp;/g, '&');

        try {
            const payload = JSON.parse(jsonStr);
            if (!payload || typeof payload !== 'object') return null;

            const status = typeof payload.status === 'string'
            ? payload.status.toUpperCase()
            : null;

            const source = typeof payload.source === 'string'
            ? payload.source
            : null;

            // Normalise lat/lng to numbers
            let lat = payload.lat;
            let lng = payload.lng;

            if (typeof lat !== 'number' && lat != null && lat !== '') {
                const parsedLat = parseFloat(lat);
                lat = Number.isNaN(parsedLat) ? null : parsedLat;
            }

            if (typeof lng !== 'number' && lng != null && lng !== '') {
                const parsedLng = parseFloat(lng);
                lng = Number.isNaN(parsedLng) ? null : parsedLng;
            }

            return {
                status,
                source,
                lat: typeof lat === 'number' ? lat : null,
                lng: typeof lng === 'number' ? lng : null
            };
        } catch (e) {
            console.warn('[Report Wayspot] Failed to parse bridge payload:', e);
            return null;
        }
    }

    function getCurrentWayspotStatus() {
        const info = getCurrentWayspotBridgeData();
        return info ? info.status : null;
    }

    function startPoiBridgeWatcherIfReady() {
        const bridge = document.getElementById('wfmapmods-poi-bridge');
        if (!bridge) return;

        // Avoid multiple observers on the same element
        if (bridge._wfPoiBridgeObserver) return;

        const mo = new MutationObserver((mutations) => {
            for (const m of mutations) {
                if (m.type === 'attributes' && m.attributeName === 'data-payload') {
                    updateReportWayspotLinkVisibility();
                }
            }
        });

        mo.observe(bridge, {
            attributes: true,
            attributeFilter: ['data-payload']
        });

        bridge._wfPoiBridgeObserver = mo;
    }

    function insertReportingSettingsLinkIfReady() {
        const settingsBody = document.querySelector(".wfmapmods-settings-links");
        if (!settingsBody) return;

        if (document.getElementById("wfmapmods-settings-reporting")) return;

        const link = document.createElement("a");
        link.id = "wfmapmods-settings-reporting";
        link.textContent = "Reporting";
        link.style.cursor = "pointer";

        settingsBody.appendChild(link);

        link.addEventListener("click", (ev) => {
            ev.preventDefault();
            openReportingSettingsWindow();
        });
    }

    function openReportingSettingsWindow() {
        if (document.getElementById("wfmapmods-reporting-modal-backdrop")) return;

        // Ensure global settings are loaded into userSettings
        loadSettings();

        // Read existing reporting settings (if any)
        const reporting = (userSettings.reporting && typeof userSettings.reporting === "object")
        ? userSettings.reporting
        : {};

        // --- Backdrop ---
        const backdrop = document.createElement("div");
        backdrop.id = "wfmapmods-reporting-modal-backdrop";
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
        title.textContent = "Reporting";
        Object.assign(title.style, {
            fontSize: "15px",
            fontWeight: "600",
            marginBottom: "10px"
        });
        dialog.appendChild(title);

        // --- Context / helper text ---
        const helper = document.createElement("div");
        helper.textContent = "Provide details for auto-import into the Report Wayspot webform.";
        Object.assign(helper.style, {
            fontSize: "11px",
            color: "#4b5563",
            marginBottom: "10px",
            lineHeight: "1.4"
        });
        dialog.appendChild(helper);

        function makeRow(labelText, inputEl) {
            const row = document.createElement("div");
            Object.assign(row.style, {
                display: "flex",
                alignItems: "center",
                marginBottom: "6px",
                gap: "4px"
            });

            const label = document.createElement("label");
            label.textContent = labelText;
            Object.assign(label.style, {
                flex: "0 0 80px",
                fontSize: "11px",
                color: "#374151"
            });

            inputEl.style.flex = "1 0 auto";
            inputEl.style.fontSize = "11px";
            inputEl.style.padding = "3px 4px";
            inputEl.style.borderRadius = "4px";
            inputEl.style.border = "1px solid #d1d5db";
            inputEl.style.boxSizing = "border-box";

            row.appendChild(label);
            row.appendChild(inputEl);
            return row;
        }

        // --- Name ---
        const nameInput = document.createElement("input");
        nameInput.type = "text";
        nameInput.placeholder = "Your full name";
        nameInput.value = reporting.name || "";

        dialog.appendChild(makeRow("Name:", nameInput));

        // --- Email ---
        const emailInput = document.createElement("input");
        emailInput.type = "email";
        emailInput.placeholder = "name@example.com";
        emailInput.value = reporting.email || "";

        dialog.appendChild(makeRow("Email:", emailInput));

        // --- Buttons row ---
        const buttonsRow = document.createElement("div");
        Object.assign(buttonsRow.style, {
            display: "flex",
            justifyContent: "flex-end",
            gap: "8px",
            marginTop: "8px"
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

        const saveBtn = document.createElement("button");
        saveBtn.type = "button";
        saveBtn.textContent = "Save";
        Object.assign(saveBtn.style, {
            padding: "4px 12px",
            borderRadius: "4px",
            border: "1px solid #2563eb",
            background: "#2563eb",
            color: "#ffffff",
            cursor: "pointer",
            fontSize: "12px"
        });

        buttonsRow.appendChild(cancelBtn);
        buttonsRow.appendChild(saveBtn);
        dialog.appendChild(buttonsRow);

        // --- Button handlers ---
        cancelBtn.addEventListener("click", () => {
            closeModal();
        });

        saveBtn.addEventListener("click", () => {
            if (!userSettings.reporting || typeof userSettings.reporting !== "object") {
                userSettings.reporting = {};
            }

            userSettings.reporting.name = nameInput.value.trim();
            userSettings.reporting.email = emailInput.value.trim();

            // Uses your existing localStorage-based save
            saveSettings();
            closeModal();
        });

        // ESC closes, Enter = Save
        document.addEventListener("keydown", function escHandler(ev) {
            if (ev.key === "Escape") {
                closeModal();
                document.removeEventListener("keydown", escHandler);
            } else if (ev.key === "Enter") {
                ev.preventDefault();
                saveBtn.click();
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

    function handleReportWayspotClick() {
        console.log('handleReportWayspotClick');
        // Important: don't read address from DOM here; it may be for a different map click.
        // We only want bridge data at this stage.
        const wayspotData = collectCurrentWayspotData({ includeDomAddress: false });

        // Ensure settings loaded
        loadSettings();
        const reporting = (userSettings.reporting && typeof userSettings.reporting === "object")
        ? userSettings.reporting
        : {};

        // Base payload that we WANT to send to Helpshift
        const basePayload = Object.assign(
            {},
            wayspotData || {},
            {
                name: reporting.name || null,
                email: reporting.email || null
            }
        );

        // Do we already have a good address from the POI bridge?
        const hasAddress =
              !!(basePayload.address ||
                 basePayload.city ||
                 basePayload.state ||
                 basePayload.postcode ||
                 basePayload.country);

        // If we have coords but NOT an address, use the original flow:
        //  1) simulate a map click at the POI
        //  2) wait for reverse geocode to fill the "Loading..." field
        //  3) parse that address and then open Helpshift
        if (!hasAddress && basePayload.lat != null && basePayload.lng != null) {
            // Kick off reverse geocoding for THIS POI
            clickMapAtPoi(basePayload.lat, basePayload.lng);

            // Poll the DOM for the updated address and only then open Helpshift
            waitForAddressAndOpen(basePayload);
        } else {
            // Either we already have a proper address from the bridge,
            // or we don't have coords to reverse-geocode with.
            // Go straight to opening Helpshift.
            openHelpshiftWithData(basePayload);
        }
    }

    function setupWayfarerMessaging() {
        window.addEventListener('message', function (event) {
            // Only accept messages from Helpshift
            if (event.origin !== ORIGIN_HELPSHIFT) return;

            const data = event.data || {};
            if (data.executor !== MSG_EXECUTOR) return;

            if (data.type === MSG_GET_DATA) {
                if (lastReportPayload) {
                    event.source.postMessage({
                        executor: MSG_EXECUTOR,
                        type: MSG_DATA,
                        payload: lastReportPayload
                    }, ORIGIN_HELPSHIFT);
                }
            }
        }, false);
    }

    // ======================================================================
    // MAP UTILITIES
    // ======================================================================

    function getMap() {
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
                    console.warn("[Report Wayspot] Failed to find submit map after several attempts");
                    resolve(null);
                    return;
                }

                setTimeout(tryFindMap, 250);
            }

            tryFindMap();
        });
    }

    // Click the submit map at the given lat/lng (Google Maps version)
    async function clickMapAtPoi(lat, lng) {
        const submitMap = await getMap();
        if (!submitMap) {
            console.warn("[Report Wayspot] Map not found, cannot simulate click.");
            return;
        }

        const savedMarkerLatLng = new google.maps.LatLng(lat, lng);

        // Simulate a click at the stored submission marker coordinates.
        // This should trigger the same internal Wayfarer logic as a real user click.
        google.maps.event.trigger(submitMap, "click", {
            latLng: savedMarkerLatLng
        });
    }

    // If you decide to use this later, it now just reuses the same pattern
    function openHelpshiftWithData(data) {
        const payload = Object.assign({ timestamp: Date.now() }, data || {});
        lastReportPayload = payload;
        window.open(REPORT_URL, '_blank');
    }

    function waitForAddressAndOpen(baseWayspot) {
        const maxAttempts = 40;
        let attempts = 0;

        const intervalId = setInterval(() => {
            attempts++;

            const parsed = extractAddressFromDom();
            // We expect extractAddressFromDom() to give us { raw, address, city, state, postcode, country }
            if (parsed && parsed.raw && parsed.raw !== "Loading...") {
                clearInterval(intervalId);

                const merged = Object.assign({}, baseWayspot);

                if (parsed.address) merged.address = parsed.address;
                if (parsed.city) merged.city = parsed.city;
                if (parsed.state) merged.state = parsed.state;
                if (parsed.postcode) merged.postcode = parsed.postcode;
                if (parsed.country) merged.country = parsed.country;

                openHelpshiftWithData(merged);
            } else if (attempts >= maxAttempts) {
                // Timed out waiting → just go with what we already have
                clearInterval(intervalId);
                openHelpshiftWithData(baseWayspot);
            }
        }, 250);
    }

    // ======================================================================
    // ADDRESS PARSING + POI BRIDGE
    // ======================================================================

    function parseAddressText(text) {
        const trimmed = (text || "").trim();
        const result = {
            raw: trimmed || null,
            address: null,
            city: null,
            state: null,
            postcode: null,
            country: null
        };

        if (!trimmed) return result;

        const parts = trimmed.split(",").map(p => p.trim()).filter(Boolean);
        if (parts.length === 0) return result;

        // Country is usually last part if there is more than one
        if (parts.length >= 2) {
            result.country = parts[parts.length - 1];
        }

        // Only one part → treat as generic address / plus-code only
        if (parts.length === 1) {
            result.address = parts[0];
            return result;
        }

        // Try to find a numeric postcode in any part except the last (country)
        let postcode = null;
        let postcodePartIndex = null;
        let postcodeTokenIndex = null;

        for (let i = parts.length - 2; i >= 0 && postcodePartIndex === null; i--) {
            const tokens = parts[i].split(/\s+/);
            for (let j = tokens.length - 1; j >= 0; j--) {
                const tok = tokens[j];
                if (/^\d{3,}$/.test(tok)) {
                    postcode = tok;
                    postcodePartIndex = i;
                    postcodeTokenIndex = j;
                    break;
                }
            }
        }

        if (postcodePartIndex !== null) {
            const tokens = parts[postcodePartIndex].split(/\s+/);
            result.postcode = postcode;

            // State is the token immediately before postcode, if any
            let stateTokenIndex = (postcodeTokenIndex > 0) ? postcodeTokenIndex - 1 : null;
            if (stateTokenIndex !== null) {
                result.state = tokens[stateTokenIndex];
            }

            // City may be before state/postcode OR after postcode
            const cutoff = (stateTokenIndex !== null) ? stateTokenIndex : postcodeTokenIndex;
            const cityFragment = (cutoff > 0) ? tokens.slice(0, cutoff).join(" ") : "";
            const cityTail = (postcodeTokenIndex + 1 < tokens.length)
            ? tokens.slice(postcodeTokenIndex + 1).join(" ")
            : "";

            if (cityFragment) {
                result.city = cityFragment;
            } else if (cityTail) {
                result.city = cityTail;
            }

            // Address is everything before the postcode part, unless we had to steal
            // the previous part for city
            if (!cityFragment && !cityTail && postcodePartIndex - 1 >= 0) {
                // city = previous part, address = everything before that
                result.city = parts[postcodePartIndex - 1];
                if (postcodePartIndex - 1 > 0) {
                    result.address = parts.slice(0, postcodePartIndex - 1).join(", ");
                }
            } else {
                if (postcodePartIndex > 0) {
                    result.address = parts.slice(0, postcodePartIndex).join(", ");
                }
            }

            return result;
        }

        // No postcode → likely plus-code formats or partial addresses
        const remainingParts = parts.slice(0, -1); // everything except country
        if (remainingParts.length === 0) {
            return result;
        }

        if (remainingParts.length === 1) {
            const seg = remainingParts[0];
            const tokens = seg.split(/\s+/);
            const plusCode = tokens[0] && tokens[0].includes("+") ? tokens[0] : null;
            result.address = seg;

            if (plusCode && tokens.length > 1) {
                const rest = tokens.slice(1);
                const last = rest[rest.length - 1];
                if (/^[A-Z]{1,3}$/.test(last)) {
                    result.state = last;
                    result.city = rest.slice(0, -1).join(" ") || null;
                } else {
                    result.city = rest.join(" ") || null;
                }
            }

            return result;
        }

        const first = remainingParts[0];
        const tokens = first.split(/\s+/);
        const plusCode = tokens[0] && tokens[0].includes("+") ? tokens[0] : null;

        if (plusCode) {
            result.address = first;                   // keep plus code + descriptor
            result.city = tokens.slice(1).join(" ") || null;
            result.state = remainingParts[1] || null; // e.g. "Long An"
        } else {
            // Generic fallback
            result.address = first;
            if (remainingParts.length >= 2) {
                result.city = remainingParts[0];
                result.state = remainingParts[1];
            }
        }

        return result;
    }

    function extractAddressFromDom() {
        try {
            const candidates = document.querySelectorAll(".font-medium.text-gray-800");
            for (const el of candidates) {
                const sibling = el.nextElementSibling;
                if (!sibling) continue;

                const sibClass = sibling.classList;
                if (!sibClass.contains("text-gray-400") || !sibClass.contains("text-xs")) continue;

                const coordText = (sibling.textContent || "").trim();
                if (!/^-?\d+\.\d+,\s*-?\d+\.\d+/.test(coordText)) continue; // make sure it's the lat/lng line

                const addressText = (el.textContent || "").trim();
                if (!addressText) continue;

                const parsed = parseAddressText(addressText);
                console.log("[WF→HS] Raw address text:", addressText);
                console.log("[WF→HS] Parsed address object:", parsed);
                return parsed;
            }
        } catch (err) {
            console.warn("[WF→HS] Error in extractAddressFromDom:", err);
        }
        return null;
    }

    function collectCurrentWayspotData(options = {}) {
        console.log('collectCurrentWayspotData');
        const includeDomAddress = options.includeDomAddress !== false; // default: true

        let title = null;
        let lat = null;
        let lng = null;
        let address = null;
        let city = null;
        let state = null;
        let country = null;
        let postcode = null;
        let status = null;

        const bridge = document.getElementById('wfmapmods-poi-bridge');

        if (!bridge) {
            console.warn('[Report Wayspot] POI bridge element #wfmapmods-poi-bridge not found.');
        } else {
            // The other plugin stores a JSON payload in data-payload
            let payloadAttr = bridge.getAttribute('data-payload');

            if (payloadAttr) {
                let jsonStr = payloadAttr;

                // Safety: decode common entities if present
                jsonStr = jsonStr.replace(/&quot;/g, '"').replace(/&amp;/g, '&');

                try {
                    const payload = JSON.parse(jsonStr);

                    if (payload && typeof payload === 'object') {
                        if (typeof payload.title === 'string') {
                            title = payload.title;
                        }
                        if (payload.lat !== undefined) {
                            lat = payload.lat;
                        }
                        if (payload.lng !== undefined) {
                            lng = payload.lng;
                        }

                        // In case the Wayfarer-side script already added these to the JSON:
                        if (payload.address) address = payload.address;
                        if (payload.city) city = payload.city;
                        if (payload.state) state = payload.state;
                        if (payload.country) country = payload.country;
                        if (payload.postcode) postcode = payload.postcode;

                        // NEW: grab status from bridge
                        if (payload.status) status = payload.status;
                    }
                } catch (err) {
                    console.warn('[Report Wayspot] Failed to parse data-payload JSON:', err);
                }
            } else {
                console.warn('[Report Wayspot] #wfmapmods-poi-bridge has no data-payload attribute.');
            }
        }

        // If any of the address fields are missing AND we're allowed to,
        // try to read them from the Wayfarer DOM
        if (includeDomAddress && (!address || !city || !state || !postcode || !country)) {
            const parsed = extractAddressFromDom();
            if (parsed) {
                if (!address && parsed.address) address = parsed.address;
                if (!city && parsed.city) city = parsed.city;
                if (!state && parsed.state) state = parsed.state;
                if (!postcode && parsed.postcode) postcode = parsed.postcode;
                if (!country && parsed.country) country = parsed.country;
            }
        }

        // Normalise lat/lng to numbers if possible
        let latNum = null;
        let lngNum = null;

        if (lat !== null && lat !== undefined && lat !== '') {
            const parsedLat = parseFloat(lat);
            if (!Number.isNaN(parsedLat)) latNum = parsedLat;
        }

        if (lng !== null && lng !== undefined && lng !== '') {
            const parsedLng = parseFloat(lng);
            if (!Number.isNaN(parsedLng)) lngNum = parsedLng;
        }

        const result = {
            // profile/contact fields left null (not provided by bridge)
            name: null,
            email: null,
            preferredLanguage: null,

            // Address bits
            address: address || null,
            city: city || null,
            state: state || null,
            country: country || null,
            postcode: postcode || null,

            // from POI bridge
            title: title || null,
            lat: latNum,
            lng: lngNum,

            // wayspot status from bridge
            status: status || null
        };

        return result;
    }

    // ======================================================================
    // HELPSHIFT SIDE (shadow-DOM aware, using postMessage)
    // ======================================================================

    function initHelpshift() {
        setupHelpshiftMessaging();
        requestWayspotDataFromOpener();
    }

    function requestWayspotDataFromOpener() {
        try {
            if (!window.opener) {
                console.warn("[Report Wayspot] No opener window found; cannot request data.");
                return;
            }

            window.opener.postMessage({
                executor: MSG_EXECUTOR,
                type: MSG_GET_DATA
            }, ORIGIN_WAYFARER);
        } catch (e) {
            console.warn("[Report Wayspot] Failed to request data from opener:", e);
        }
    }

    function setupHelpshiftMessaging() {
        window.addEventListener('message', function (event) {
            // Only accept messages from Wayfarer
            if (event.origin !== ORIGIN_WAYFARER) return;

            const data = event.data || {};
            if (data.executor !== MSG_EXECUTOR) return;

            if (data.type === MSG_DATA && data.payload) {
                // We got the wayspot payload: wait for form, then fill
                waitForHelpshiftFormAndFill(data.payload);
            }
        }, false);
    }

    // -----------------------------------------------------------
    // Deep query helpers (walks open shadow roots)
    // -----------------------------------------------------------

    function querySelectorDeep(selector, root = document) {
        const queue = [root];

        while (queue.length) {
            const node = queue.shift();

            // Try in this root
            try {
                const found = node.querySelector(selector);
                if (found) return found;
            } catch (e) {
                // Some nodes (like text nodes) don't support querySelector
            }

            // Scan children for shadow roots to dive into
            const children = node.querySelectorAll ? node.querySelectorAll("*") : [];
            for (const child of children) {
                if (child.shadowRoot) {
                    queue.push(child.shadowRoot);
                }
            }
        }

        return null;
    }

    function getShadowInputBySlot(slotName) {
        const host = querySelectorDeep(`hc-input[slot="${slotName}"]`);
        if (host && host.shadowRoot) {
            return host.shadowRoot.querySelector("input");
        }
        return null;
    }

    // -----------------------------------------------------------
    // Field-specific finders (using known slot names from your DOM)
    // -----------------------------------------------------------

    // Your Name
    // slot="niantic_form_field_20180829003003565-76757f675145667"
    function findNameInput() {
        return getShadowInputBySlot("niantic_form_field_20180829003003565-76757f675145667");
    }

    // Your email address
    // slot="niantic_form_field_20180829003003570-d2b19abe3155a0b"
    function findEmailInput() {
        return getShadowInputBySlot("niantic_form_field_20180829003003570-d2b19abe3155a0b");
    }

    // Exact name of game location (if known)
    // slot="niantic_form_field_20181211224850128-efdfc202dc778ac"
    function findTitleInput() {
        return getShadowInputBySlot("niantic_form_field_20181211224850128-efdfc202dc778ac");
    }

    // Latitude/Longitude
    // slot="niantic_form_field_20181106014139990-b5f071a799fac06"
    function findLatLonInput() {
        return getShadowInputBySlot("niantic_form_field_20181106014139990-b5f071a799fac06");
    }

    // Address Line 1
    // slot="niantic_form_field_20181211224719769-a7344f7cdb793cf"
    function findAddressInput() {
        return getShadowInputBySlot("niantic_form_field_20181211224719769-a7344f7cdb793cf");
    }

    // City
    // slot="niantic_form_field_20181211224807182-f5413d861a8199c"
    function findCityInput() {
        return getShadowInputBySlot("niantic_form_field_20181211224807182-f5413d861a8199c");
    }

    // State
    // slot="niantic_form_field_20190624210109230-d8ec77a2ab51d49"
    function findStateInput() {
        return getShadowInputBySlot("niantic_form_field_20190624210109230-d8ec77a2ab51d49");
    }

    // Postal Code
    // slot="niantic_form_field_20190624210109237-37afb1f548efd12"
    function findPostcodeInput() {
        return getShadowInputBySlot("niantic_form_field_20190624210109237-37afb1f548efd12");
    }

    // -----------------------------------------------------------
    // Wait for form and then fill
    // -----------------------------------------------------------

    function waitForHelpshiftFormAndFill(wayspotData) {
        const maxAttempts = 60;
        let attempts = 0;

        const intervalId = setInterval(() => {
            attempts++;

            const titleInput = findTitleInput();
            const latLonInput = findLatLonInput();

            const hasAnyField = !!(titleInput || latLonInput);

            if (hasAnyField) {
                clearInterval(intervalId);
                fillHelpshiftForm(wayspotData);
            } else if (attempts >= maxAttempts) {
                console.warn("[Report Wayspot] Failed to find Helpshift contact form inputs after max attempts.");
                clearInterval(intervalId);
            }
        }, 500);
    }

    // -----------------------------------------------------------
    // Generic setter
    // -----------------------------------------------------------

    function setFormValue(el, value) {
        if (!el) return;
        if (value == null || value === "") return;

        el.value = value;
        el.dispatchEvent(new Event("input", { bubbles: true }));
        el.dispatchEvent(new Event("change", { bubbles: true }));
    }

    // -----------------------------------------------------------
    // Fill the form (title + lat,lng + address fields)
    // -----------------------------------------------------------

    function fillHelpshiftForm(wayspot) {
        const nameInput = findNameInput();
        setFormValue(nameInput, wayspot.name);

        const emailInput = findEmailInput();
        setFormValue(emailInput, wayspot.email);

        const titleInput = findTitleInput();
        setFormValue(titleInput, wayspot.title);

        const latLonInput = findLatLonInput();
        if (latLonInput && wayspot.lat != null && wayspot.lng != null) {
            const latLonStr = `${wayspot.lat}, ${wayspot.lng}`;
            setFormValue(latLonInput, latLonStr);
        }

        const addrInput = findAddressInput();
        setFormValue(addrInput, wayspot.address);

        const cityInput = findCityInput();
        setFormValue(cityInput, wayspot.city);

        const stateInput = findStateInput();
        setFormValue(stateInput, wayspot.state);

        const postcodeInput = findPostcodeInput();
        setFormValue(postcodeInput, wayspot.postcode);
    }

    // ======================================================================
    // ENTRY POINT
    // ======================================================================

    if (CURRENT_ORIGIN === ORIGIN_WAYFARER) {
        initWayfarer();
    } else if (CURRENT_ORIGIN === ORIGIN_HELPSHIFT) {
        initHelpshift();
    }

})();
