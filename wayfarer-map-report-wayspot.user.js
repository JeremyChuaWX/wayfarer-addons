// ==UserScript==
// @name         Wayfarer Map - Report Wayspots
// @version      0.0.1
// @description  Adds a "Report Wayspot" link to the side panel and pre-fills the Helpshift form using POI bridge data
// @namespace    https://gitlab.com/Tntnnbltn/wayfarer-addons
// @downloadURL  https://gitlab.com/Tntnnbltn/wayfarer-addons/-/raw/main/wayfarer-map-report-wayspot.user.js
// @homepageURL  https://gitlab.com/Tntnnbltn/wayfarer-addons
// @match        https://wayfarer.nianticlabs.com/*
// @match        https://niantic.helpshift.com/hc/en/5-report-an-issue-with-a-pokestop-gym/contact-us/*
// @run-at       document-start
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_deleteValue
// @grant        GM_addValueChangeListener
// ==/UserScript==

(function () {
    'use strict';

    // Random UUID, unique to this userscript
    const uuid = '1ba36113-7f8a-4ff8-9451-d5bfca869633';

    const SETTINGS_KEY = "wfmap_report_wayspot_settings";

    const ORIGIN_WAYFARER = 'https://wayfarer.nianticlabs.com';
    const ORIGIN_HELPSHIFT = 'https://niantic.helpshift.com';

    // TODO: Change this to the specific abuse form URL if needed.
    const REPORT_URL = 'https://niantic.helpshift.com/hc/en/5-report-an-issue-with-a-pokestop-gym/contact-us/?p=web&contact=1&l=en';

    const CURRENT_ORIGIN = window.location.origin;

    // ======================================================================
    // WAYFARER SIDE
    // ======================================================================

    const userSettings = {
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

    function initWayfarer() {
        startSidePanelWatcher();
        loadSettings();
    }

    function startSidePanelWatcher() {
        // Run once immediately
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
        const settingsBody = document.querySelector('.wfsmm-poi-function-links');
        if (!settingsBody) return;

        if (document.getElementById('wfsmm-settings-report-wayspot')) return;

        const link = document.createElement('a');
        link.id = 'wfsmm-settings-report-wayspot';
        link.textContent = 'Report Wayspot';
        link.style.cursor = 'pointer';

        settingsBody.appendChild(link);

        link.addEventListener('click', (ev) => {
            ev.preventDefault();
            handleReportWayspotClick();
        });
    }

    function insertReportingSettingsLinkIfReady() {
        const settingsBody = document.querySelector(".wfsmm-settings-links");
        if (!settingsBody) return;

        if (document.getElementById("wfsmm-settings-reporting")) return;

        const link = document.createElement("a");
        link.id = "wfsmm-settings-reporting";
        link.textContent = "Reporting";
        link.style.cursor = "pointer";

        settingsBody.appendChild(link);

        link.addEventListener("click", (ev) => {
            ev.preventDefault();
            openReportingSettingsWindow();
        });
    }

 function openReportingSettingsWindow() {
    if (document.getElementById("wfsmm-reporting-modal-backdrop")) return;

    // Ensure global settings are loaded into userSettings
    loadSettings();

    // Read existing reporting settings (if any)
    const reporting = (userSettings.reporting && typeof userSettings.reporting === "object")
        ? userSettings.reporting
        : {};

    // --- Backdrop ---
    const backdrop = document.createElement("div");
    backdrop.id = "wfsmm-reporting-modal-backdrop";
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
        const wayspotData = collectCurrentWayspotData();

        // Ensure settings loaded
        loadSettings();
        const reporting = (userSettings.reporting && typeof userSettings.reporting === "object")
        ? userSettings.reporting
        : {};

        const payload = Object.assign(
            { timestamp: Date.now() },
            wayspotData || {},
            {
                name: reporting.name || null,
                email: reporting.email || null
            }
        );

        GM_setValue(uuid, payload);
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

                if (parsed.address)  merged.address  = parsed.address;
                if (parsed.city)     merged.city     = parsed.city;
                if (parsed.state)    merged.state    = parsed.state;
                if (parsed.postcode) merged.postcode = parsed.postcode;
                if (parsed.country)  merged.country  = parsed.country;

                openHelpshiftWithData(merged);
            } else if (attempts >= maxAttempts) {
                // Timed out waiting → just go with what we already have
                clearInterval(intervalId);
                openHelpshiftWithData(baseWayspot);
            }
        }, 250);
    }


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

    function openHelpshiftWithData(data) {
        const payload = Object.assign({ timestamp: Date.now() }, data || {});
        GM_setValue(uuid, payload);
        window.open(REPORT_URL, '_blank');
    }

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
                if (/^\d{3,}$/.test(tok)) { // "6053", "400027", "75017", etc.
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

            // City may be before state/postcode OR after postcode (e.g. "75017 Paris")
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
            // the previous part for city (India-style addresses)
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
            // e.g. "4W39+3C Embleton WA"  OR  "Some Place Name"
            const seg = remainingParts[0];
            const tokens = seg.split(/\s+/);
            const plusCode = tokens[0] && tokens[0].includes("+") ? tokens[0] : null;
            result.address = seg;

            if (plusCode && tokens.length > 1) {
                const rest = tokens.slice(1);
                const last = rest[rest.length - 1];
                if (/^[A-Z]{1,3}$/.test(last)) {
                    // Looks like a state code (e.g. "WA")
                    result.state = last;
                    result.city = rest.slice(0, -1).join(" ") || null;
                } else {
                    result.city = rest.join(" ") || null;
                }
            }

            return result;
        }

        // e.g. "RR2R+QH Vĩnh Hưng District, Long An, Vietnam"
        // remainingParts = ["RR2R+QH Vĩnh Hưng District", "Long An"]
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
        const includeDomAddress = options.includeDomAddress !== false; // default: true

        let title = null;
        let lat = null;
        let lng = null;

        // New: fields for address components
        let address = null;
        let city = null;
        let state = null;
        let country = null;
        let postcode = null;

        const bridge = document.getElementById('wfsmm-poi-bridge');

        if (!bridge) {
            console.warn('[Report Wayspot] POI bridge element #wfsmm-poi-bridge not found.');
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
                        if (payload.address)  address  = payload.address;
                        if (payload.city)     city     = payload.city;
                        if (payload.state)    state    = payload.state;
                        if (payload.country)  country  = payload.country;
                        if (payload.postcode) postcode = payload.postcode;
                    }
                } catch (err) {
                    console.warn('[Report Wayspot] Failed to parse data-payload JSON:', err);
                }
            } else {
                console.warn('[Report Wayspot] #wfsmm-poi-bridge has no data-payload attribute.');
            }
        }

        // If any of the address fields are missing AND we're allowed to,
        // try to read them from the Wayfarer DOM
        if (includeDomAddress && (!address || !city || !state || !postcode || !country)) {
            const parsed = extractAddressFromDom();
            if (parsed) {
                if (!address  && parsed.address)  address  = parsed.address;
                if (!city     && parsed.city)     city     = parsed.city;
                if (!state    && parsed.state)    state    = parsed.state;
                if (!postcode && parsed.postcode) postcode = parsed.postcode;
                if (!country  && parsed.country)  country  = parsed.country;
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
            address: address  || null,
            city:    city     || null,
            state:   state    || null,
            country: country  || null,
            postcode: postcode || null,

            // from POI bridge
            title: title || null,
            lat: latNum,
            lng: lngNum
        };

        return result;
    }

    // ======================================================================
    // HELPSHIFT SIDE (shadow-DOM aware, minimal logging)
    // ======================================================================

    function initHelpshift() {
        const data = GM_getValue(uuid);

        if (data) {
            waitForHelpshiftFormAndFill(data);
        } else {
            GM_addValueChangeListener(uuid, (name, oldValue, newValue) => {
                if (name === uuid && newValue) {
                    waitForHelpshiftFormAndFill(newValue);
                }
            });
        }
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


    if (CURRENT_ORIGIN === ORIGIN_WAYFARER) {
        initWayfarer();
    } else if (CURRENT_ORIGIN === ORIGIN_HELPSHIFT) {
        initHelpshift();
    }

})();
