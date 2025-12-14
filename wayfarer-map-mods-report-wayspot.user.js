// ==UserScript==
// @name         Wayfarer Map Mods - Report Wayspots
// @version      0.3.0
// @description  Adds a "Report Wayspot" link to the side panel and pre-fills the Helpshift form
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
// directory of this script's GitLab repository:
// <https://gitlab.com/Tntnnbltn/wayfarer-addons/-/blob/main/LICENSE>
// If not, see <https://www.gnu.org/licenses/>.

(function () {
    'use strict';

    // ======================================================================
    // Globals + constants
    // ======================================================================

    // Script identity / settings
    const SCRIPT_UUID = "1ba36113-7f8a-4ff8-9451-d5bfca869633";
    const SETTINGS_KEY = "wfmap_report_wayspot_settings";

    // Origins + URLs
    const ORIGIN_WAYFARER = "https://wayfarer.nianticlabs.com";
    const ORIGIN_HELPSHIFT = "https://niantic.helpshift.com";
    const REPORT_URL = "https://niantic.helpshift.com/hc/en/5-report-an-issue-with-a-pokestop-gym/contact-us/?p=web&contact=1&l=en";
    const CURRENT_ORIGIN = window.location.origin;

    // postMessage protocol
    const MSG_EXECUTOR = SCRIPT_UUID;
    const MSG_GET_DATA = "wf-report-get-data";
    const MSG_DATA = "wf-report-data";

    // Wayfarer routes / DOM ids
    const SUBMIT_PATH = "/new/submit/new";
    const POI_BRIDGE_ID = "wfmapmods-poi-bridge";
    const SIDE_PANEL_ID = "wfmapmods-side-panel";

    // Geocoder bridge postMessage types (page-context bridge)
    const WFMM_GEO_REQ = "wfmm-geocode-req";
    const WFMM_GEO_RES = "wfmm-geocode-res";

    // Helpshift form slots
    const HS_SLOTS = {
        name: "niantic_form_field_20180829003003565-76757f675145667",
        email: "niantic_form_field_20180829003003570-d2b19abe3155a0b",
        title: "niantic_form_field_20181211224850128-efdfc202dc778ac",
        latlon: "niantic_form_field_20181106014139990-b5f071a799fac06",
        address: "niantic_form_field_20181211224719769-a7344f7cdb793cf",
        city: "niantic_form_field_20181211224807182-f5413d861a8199c",
        state: "niantic_form_field_20190624210109230-d8ec77a2ab51d49",
        postcode: "niantic_form_field_20190624210109237-37afb1f548efd12"
    };

    // Helpshift country dropdown slot
    const HS_COUNTRY_SLOT = "niantic_form_field_20190926192331730-5f5841a93bbe40b";

    // Helpshift countries (big list)
    const HELPSHIFT_COUNTRIES = [
        "Afghanistan",
        "Åland Islands",
        "Albania",
        "Algeria",
        "American Samoa",
        "Andorra",
        "Angola",
        "Anguilla",
        "Antarctica",
        "Antigua and Barbuda",
        "Argentina",
        "Armenia",
        "Aruba",
        "Australia",
        "Austria",
        "Azerbaijan",
        "Bahamas",
        "Bahrain",
        "Bangladesh",
        "Barbados",
        "Belarus",
        "Belgium",
        "Belize",
        "Benin",
        "Bermuda",
        "Bhutan",
        "Bolivia",
        "Bonaire, Sint Eustatius and Saba",
        "Bosnia and Herzegovina",
        "Botswana",
        "Bouvet Island",
        "Brazil",
        "British Indian Ocean Territory ",
        "Brunei Darussalam",
        "Bulgaria",
        "Burkina Faso",
        "Burundi",
        "Cabo Verde",
        "Cambodia",
        "Cameroon",
        "Canada",
        "Cayman Islands",
        "Central African Republic",
        "Chad",
        "Chile",
        "China",
        "Christmas Island",
        "Cocos (Keeling) Islands",
        "Colombia",
        "Comoros",
        "Congo",
        "Cook Islands",
        "Costa Rica",
        "Côte d'Ivoire",
        "Croatia",
        "Cuba",
        "Curaçao",
        "Cyprus",
        "Czechia",
        "Democratic People's Republic of Korea",
        "Democratic Republic of the Congo",
        "Denmark",
        "Djibouti",
        "Dominica",
        "Dominican Republic",
        "Ecuador",
        "Egypt",
        "El Salvador",
        "Equatorial Guinea",
        "Eritrea",
        "Estonia",
        "Eswatini",
        "Ethiopia",
        "Falkland Islands  [Malvinas]",
        "Faroe Islands ",
        "Fiji",
        "Finland",
        "France",
        "French Guiana",
        "French Polynesia",
        "French Southern Territories ",
        "Gabon",
        "Gambia",
        "Georgia",
        "Germany",
        "Ghana",
        "Gibraltar",
        "Greece",
        "Greenland",
        "Grenada",
        "Guadeloupe",
        "Guam",
        "Guatemala",
        "Guernsey",
        "Guinea-Bissau",
        "Guinea",
        "Guyana",
        "Haiti",
        "Heard Island and McDonald Islands",
        "Holy See ",
        "Honduras",
        "Hong Kong",
        "Hungary",
        "Iceland",
        "India",
        "Indonesia",
        "Iran",
        "Iraq",
        "Ireland",
        "Isle of Man",
        "Israel",
        "Italy",
        "Jamaica",
        "Japan",
        "Jersey",
        "Jordan",
        "Kazakhstan",
        "Kenya",
        "Kiribati",
        "Kuwait",
        "Kyrgyzstan",
        "Lao People's Democratic Republic ",
        "Latvia",
        "Lebanon",
        "Lesotho",
        "Liberia",
        "Libya",
        "Liechtenstein",
        "Lithuania",
        "Luxembourg",
        "Macao",
        "Madagascar",
        "Malawi",
        "Malaysia",
        "Maldives",
        "Mali",
        "Malta",
        "Marshall Islands",
        "Martinique",
        "Mauritania",
        "Mauritius",
        "Mayotte",
        "Mexico",
        "Micronesia (Federated States of)",
        "Moldova (the Republic of)",
        "Monaco",
        "Mongolia",
        "Montenegro",
        "Montserrat",
        "Morocco",
        "Mozambique",
        "Myanmar",
        "Namibia",
        "Nauru",
        "Nepal",
        "Netherlands",
        "New Caledonia",
        "New Zealand",
        "Nicaragua",
        "Niger",
        "Nigeria",
        "Niue",
        "Norfolk Island",
        "North Macedonia",
        "Northern Mariana Islands ",
        "Norway",
        "Oman",
        "Pakistan",
        "Palau",
        "Palestine, State of",
        "Panama",
        "Papua New Guinea",
        "Paraguay",
        "Peru",
        "Philippines",
        "Pitcairn",
        "Poland",
        "Portugal",
        "Puerto Rico",
        "Qatar",
        "Republic of Korea",
        "Réunion",
        "Romania",
        "Russian Federation ",
        "Rwanda",
        "Saint Barthélemy",
        "Saint Helena, Ascension and Tristan da Cunha",
        "Saint Kitts and Nevis",
        "Saint Lucia",
        "Saint Martin (French)",
        "Saint Pierre and Miquelon",
        "Saint Vincent and the Grenadines",
        "Samoa",
        "San Marino",
        "Sao Tome and Principe",
        "Saudi Arabia",
        "Senegal",
        "Serbia",
        "Seychelles",
        "Sierra Leone",
        "Singapore",
        "Sint Maarten (Dutch)",
        "Slovakia",
        "Slovenia",
        "Solomon Islands",
        "Somalia",
        "South Africa",
        "South Georgia and the South Sandwich Islands",
        "South Sudan",
        "Spain",
        "Sri Lanka",
        "Sudan",
        "Suriname",
        "Svalbard and Jan Mayen",
        "Sweden",
        "Switzerland",
        "Syrian Arab Republic",
        "Taiwan (Province of China)",
        "Tajikistan",
        "Tanzania, the United Republic of",
        "Thailand",
        "Timor-Leste",
        "Togo",
        "Tokelau",
        "Tonga",
        "Trinidad and Tobago",
        "Tunisia",
        "Turkey",
        "Turkmenistan",
        "Turks and Caicos",
        "Tuvalu",
        "Uganda",
        "Ukraine",
        "United Arab Emirates",
        "United Kingdom",
        "United States Minor Outlying Islands ",
        "United States of America",
        "Uruguay",
        "Uzbekistan",
        "Vanuatu",
        "Venezuela (Bolivarian Republic of)",
        "Vietnam",
        "Virgin Islands (British)",
        "Virgin Islands (U.S.)",
        "Wallis and Futuna",
        "Western Sahara",
        "Yemen",
        "Zambia",
        "Zimbabwe",
    ];

    // Country aliases
    const COUNTRY_ALIASES = {
        "usa": "United States of America",
        "us": "United States of America",
        "united states": "United States of America",
        "uk": "United Kingdom",
        "uae": "United Arab Emirates",
        "south korea": "Republic of Korea",
        "north korea": "Democratic People's Republic of Korea",
        "dr congo": "Democratic Republic of the Congo",
        "drc": "Democratic Republic of the Congo",
        "syria": "Syrian Arab Republic",
        "russia": "Russian Federation ",
        "venezuela": "Venezuela (Bolivarian Republic of)",
        "tanzania": "Tanzania, the United Republic of",
        "laos": "Lao People's Democratic Republic ",
        "moldova": "Moldova (the Republic of)",
        "micronesia": "Micronesia (Federated States of)",
        "palestine": "Palestine, State of",
        "taiwan": "Taiwan (Province of China)",
        "macau": "Macao",
        "cape verde": "Cabo Verde",
        "czech republic": "Czechia",
        "swaziland": "Eswatini",
        "east timor": "Timor-Leste",
        "ivory coast": "Côte d'Ivoire",
        "reunion": "Réunion",
        "curacao": "Curaçao",
        "vatican city": "Holy See ",
    };

    // ======================================================================
    // Shared state
    // ======================================================================

    let lastReportPayload = null;

    // Wayfarer-side state
    let livePois = [];
    let sidePanelObserver = null;
    let sidePanelMutationScheduled = false;

    // Settings cache
    const userSettings = {};

    // ======================================================================
    // Utilities
    // ======================================================================

    function getPageWin() {
        return (typeof unsafeWindow !== "undefined") ? unsafeWindow : window;
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

    // ======================================================================
    // WAYFARER
    // ======================================================================

    // ======================================================================
    // Wayfarer boot + route lifecycle
    // ======================================================================

    function initWayfarer() {
        hookLivePoisXHR();
        loadSettings();
        setupWayfarerMessaging();
        setupRouteWatcher();
    }

    function isOnSubmitPage() {
        // Adjust if Wayfarer ever changes the path or uses a trailing slash
        return window.location.pathname.startsWith(SUBMIT_PATH);
    }

    function onRouteChange() {
        if (isOnSubmitPage()) {
            // We’re on /new/submit/new → ensure the side panel watcher is running
            startSidePanelWatcher();
        } else {
            // Any other internal route → stop watching to save work
            stopSidePanelWatcher();
        }
    }

    function setupRouteWatcher() {
        const origPushState = history.pushState;
        const origReplaceState = history.replaceState;

        function wrappedRouteChange() {
            onRouteChange();
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

        // Handle the initial URL on page load
        wrappedRouteChange();
    }

    // ======================================================================
    // Wayfarer data sources (live-pois-in-radius)
    // ======================================================================

    function hookLivePoisXHR() {
        const XHR = window.XMLHttpRequest || XMLHttpRequest;
        if (!XHR || XHR.__wfReportHooked) return;

        XHR.__wfReportHooked = true;

        const origOpen = XHR.prototype.open;
        const origSend = XHR.prototype.send;

        XHR.prototype.open = function (method, url, ...rest) {
            this._wf_report_url = url;
            return origOpen.call(this, method, url, ...rest);
        };

        XHR.prototype.send = function (...args) {
            this.addEventListener("load", function () {
                try {
                    if (!this._wf_report_url ||
                        !this._wf_report_url.includes("/api/v1/vault/live-pois-in-radius")) {
                        return;
                    }

                    const json = JSON.parse(this.responseText);
                    const pois = (json &&
                                  json.result &&
                                  Array.isArray(json.result.pois))
                    ? json.result.pois
                    : [];

                    let radius = 0;
                    try {
                        const urlObj = new URL(this._wf_report_url, location.origin);
                        radius = Number(urlObj.searchParams.get("radius")) || 0;
                    } catch {
                        radius = 0; // fall back to merge behaviour
                    }

                    if (radius < 10) {
                        if (!Array.isArray(livePois)) livePois = [];
                        for (const p of pois) {
                            mergePoiIntoLivePois(p);
                        }
                    } else {
                        livePois = pois;
                    }
                } catch (e) {
                    console.error("[Report Wayspot] error parsing live-pois-in-radius response:", e);
                }
            });

            return origSend.apply(this, args);
        };
    }

    function mergePoiIntoLivePois(newPoi) {
        if (!newPoi) return;

        if (newPoi.guid) {
            const idx = livePois.findIndex(p => p && p.guid === newPoi.guid);
            if (idx >= 0) {
                livePois[idx] = newPoi;
                return;
            }
        }

        const idx2 = livePois.findIndex(p =>
                                        p &&
                                        typeof p.lat === "number" &&
                                        typeof p.lng === "number" &&
                                        p.lat === newPoi.lat &&
                                        p.lng === newPoi.lng
                                       );

        if (idx2 >= 0) {
            livePois[idx2] = newPoi;
            return;
        }

        livePois.push(newPoi);
    }

    // ======================================================================
    // Wayfarer DOM observers (side panel + POI bridge)
    // ======================================================================

    function startSidePanelWatcher() {
        // Don't create multiple observers
        if (sidePanelObserver) return;

        // Run once immediately for the current DOM
        sidePanelMutationHandler();

        sidePanelObserver = new MutationObserver(() => {
            // Simple debounce: collapse many mutations into one handler call
            if (sidePanelMutationScheduled) return;

            sidePanelMutationScheduled = true;
            setTimeout(() => {
                sidePanelMutationScheduled = false;
                sidePanelMutationHandler();
            }, 50); // tweak if you want, 50ms is usually fine
        });

        sidePanelObserver.observe(document.documentElement || document.body, {
            childList: true,
            subtree: true
        });
    }

    function stopSidePanelWatcher() {
        if (sidePanelObserver) {
            sidePanelObserver.disconnect();
            sidePanelObserver = null;
        }
    }

    function sidePanelMutationHandler() {
        const panelPresent = !!document.querySelector("#wfmapmods-side-panel");

        if (panelPresent) {
            insertReportWayspotLinkIfReady();
            insertReportingSettingsLinkIfReady();
            startPoiBridgeWatcherIfReady();
            stopSidePanelWatcher();
        }

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

    // ======================================================================
    // Wayfarer UI injection
    // ======================================================================

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
        // Don't open a second copy if one is already there
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

        // We'll assign this after we create saveBtn, but we need
        // a reference here so closeModal can remove it.
        let escHandler;

        function closeModal() {
            backdrop.remove();
            if (escHandler) {
                document.removeEventListener("keydown", escHandler);
            }
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

            saveSettings();
            closeModal();
        });

        // ESC closes, Enter = Save
        escHandler = function (ev) {
            if (ev.key === "Escape") {
                ev.preventDefault();
                closeModal();
            } else if (ev.key === "Enter") {
                ev.preventDefault();
                saveBtn.click();
            }
        };

        document.addEventListener("keydown", escHandler);

        // Click on backdrop (but not dialog) closes
        backdrop.addEventListener("click", (ev) => {
            if (ev.target === backdrop) {
                closeModal();
            }
        });

        backdrop.appendChild(dialog);
        document.body.appendChild(backdrop);
    }

    // ======================================================================
    // Wayfarer: POI bridge read + report-link gating
    // ======================================================================

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

    function shouldShowReportLink(info, livePois) {
        if (!info) return false;

        const { status, source, lat, lng } = info;

        if (status === 'LIVE' && source === 'wfmapmods-base') {
            // Condition 1: live marker from the base plug-in
            return true;
        }

        if (source === 'wfmm-s2' && status !== 'MISSING' && status !== 'MANUAL IMPORT') {
            // Condition 2: Gym/Pokestop custom marker from s2 plug-in
            // Code may need to be adjusted for manually placed markers
            return true;
        }

        if (status === 'LIVE' || status === 'ACCEPTED') {
            // Condition 3: LIVE/ACCEPTED from any other plug-in, but must match a loaded POI lat,lng
            const pois = Array.isArray(livePois) ? livePois : [];
            return pois.some(p => p?.lat === lat && p?.lng === lng);
        }

        return false;
    }

    function updateReportWayspotLinkVisibility() {
        const link = document.getElementById('wfmapmods-settings-report-wayspot');
        if (!link) return;

        const info = getCurrentWayspotBridgeData();
        const visible = shouldShowReportLink(info, livePois);

        link.style.display = visible ? '' : 'none';
    }

    // ======================================================================
    // Wayfarer: report click flow
    // ======================================================================

    async function handleReportWayspotClick() {
        const wayspotData = collectCurrentWayspotData();

        loadSettings();
        const reporting = userSettings.reporting || {};

        const basePayload = {
            ...wayspotData,
            name: reporting.name || null,
            email: reporting.email || null
        };

        const needsAddress =
              !(basePayload.address &&
                basePayload.city &&
                basePayload.state &&
                basePayload.country &&
                basePayload.postcode);

        if (needsAddress && basePayload.lat != null && basePayload.lng != null) {
            try {
                const geoResults = await pageReverseGeocode(basePayload.lat, basePayload.lng);
                const geo = extractBestAddress(geoResults);

                basePayload.address  ||= geo.street1;
                basePayload.city     ||= geo.city;
                basePayload.state    ||= geo.state;
                basePayload.country  ||= geo.country;
                basePayload.postcode ||= geo.postcode;

                basePayload.rawAddress ||= geo.formatted;
            } catch (e) {
                console.warn("[Report Wayspot] Reverse geocode failed:", e);

                // Hard fallbacks (mandatory fields)
                basePayload.address  ||= "Unknown";
                basePayload.city     ||= "Unknown";
                basePayload.state    ||= "Unknown";
                basePayload.country  ||= "Unknown";
                basePayload.postcode ||= "0000";
            }
        }

        openHelpshiftWithData(basePayload);
    }

    function collectCurrentWayspotData() {
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

    // If you decide to use this later, it now just reuses the same pattern
    function openHelpshiftWithData(data) {
        const payload = Object.assign({ timestamp: Date.now() }, data || {});
        lastReportPayload = payload;
        window.open(REPORT_URL, '_blank');
    }

    // ======================================================================
    // Geocoder bridge (in-page injection + reverse geocode)
    // ======================================================================

    function injectPageGeocoderBridge() {
        if (document.getElementById("wfmm-geocoder-bridge")) return;

        const script = document.createElement("script");
        script.id = "wfmm-geocoder-bridge";
        script.textContent = `
        (function () {
            const REQ = ${JSON.stringify(WFMM_GEO_REQ)};
            const RES = ${JSON.stringify(WFMM_GEO_RES)};

            function geocodeAll(lat, lng) {
                return new Promise((resolve, reject) => {
                    if (!window.google || !google.maps || !google.maps.Geocoder) {
                        reject("google.maps.Geocoder not available");
                        return;
                    }

                    const geocoder = new google.maps.Geocoder();
                    geocoder.geocode({ location: { lat, lng } }, (results, status) => {
                        if (status !== "OK" || !Array.isArray(results) || !results.length) {
                            reject("Geocoder failed: " + status);
                            return;
                        }

                        // Return JSON-safe subset only
                        resolve(results.slice(0, 6).map(r => ({
                            formatted_address: r.formatted_address || null,
                            types: Array.isArray(r.types) ? r.types.slice() : [],
                            address_components: Array.isArray(r.address_components)
                                ? r.address_components.map(c => ({
                                    long_name: c.long_name || null,
                                    short_name: c.short_name || null,
                                    types: Array.isArray(c.types) ? c.types.slice() : []
                                }))
                                : []
                        })));
                    });
                });
            }

            window.addEventListener("message", async (ev) => {
                const d = ev.data;
                if (!d || d.type !== REQ) return;

                try {
                    const results = await geocodeAll(d.lat, d.lng);
                    window.postMessage({
                        type: RES,
                        id: d.id,
                        ok: true,
                        results
                    }, "*");
                } catch (e) {
                    window.postMessage({
                        type: RES,
                        id: d.id,
                        ok: false,
                        error: String(e)
                    }, "*");
                }
            });
        })();
    `;

        (document.head || document.documentElement).appendChild(script);
    }

    function pageReverseGeocode(lat, lng, timeoutMs = 10000) {
        injectPageGeocoderBridge();

        const id = Date.now() + "-" + Math.random().toString(16).slice(2);

        return new Promise((resolve, reject) => {
            const timer = setTimeout(() => {
                window.removeEventListener("message", onMessage);
                reject(new Error("Reverse geocode timeout"));
            }, timeoutMs);

            function onMessage(ev) {
                const d = ev.data;
                if (!d || d.type !== WFMM_GEO_RES || d.id !== id) return;

                clearTimeout(timer);
                window.removeEventListener("message", onMessage);

                if (d.ok) resolve(d.results);
                else reject(new Error(d.error || "Reverse geocode failed"));
            }

            window.addEventListener("message", onMessage);
            window.postMessage({
                type: WFMM_GEO_REQ,
                id,
                lat,
                lng
            }, "*");
        });
    }

    // ======================================================================
    // Reverse geocode parsing + scoring
    // ======================================================================

    function pick(components, type) {
        const c = components.find(x => x?.types?.includes(type));
        return c ? c.long_name : null;
    }

    function pickFirst(components, types) {
        for (const t of types) {
            const v = pick(components, t);
            if (v) return v;
        }
        return null;
    }

    function isBadRouteName(route) {
        if (!route) return true;
        const r = String(route).trim().toLowerCase();

        // Too generic to be useful
        const bad = new Set([
            "road", "street", "st", "rd", "avenue", "ave", "lane", "ln",
            "drive", "dr", "highway", "hwy", "boulevard", "blvd", "way", "path"
        ]);

        if (bad.has(r)) return true;

        // Very short / non-descriptive
        if (r.length <= 3) return true;

        return false;
    }

    function scoreResult(r) {
        const comps = r.address_components || [];
        const types = r.types || [];

        const route = pick(comps, "route");
        const hasGoodRoute = route && !isBadRouteName(route);

        let s = 0;

        // Strong signal, but not absolute
        if (types.includes("street_address")) s += 35;
        if (types.includes("premise")) s += 15;
        if (types.includes("establishment")) s += 12;
        if (types.includes("point_of_interest")) s += 8;

        // Components
        if (pick(comps, "street_number")) s += 20;
        if (pick(comps, "postal_code")) s += 25;

        // Route quality matters
        if (hasGoodRoute) s += 25;
        else if (route) s -= 30; // penalise generic routes like "Road"

        // City/state/country presence
        if (pickFirst(comps, ["locality", "postal_town"])) s += 12;
        if (pickFirst(comps, ["administrative_area_level_1"])) s += 10;
        if (pick(comps, "country")) s += 8;

        // If result is ONLY a plus_code type, down-rank it unless nothing else works
        if (types.length === 1 && types[0] === "plus_code") s -= 20;

        return s;
    }

    function extractBestAddress(results) {
        const best = (results || [])
        .slice()
        .sort((a, b) => scoreResult(b) - scoreResult(a))[0];

        const comps = best?.address_components || [];
        const formatted = best?.formatted_address || null;

        const streetNumber = pick(comps, "street_number");
        const route = pick(comps, "route");

        let street1 = null;

        // Only use route if it looks meaningful
        if (route && !isBadRouteName(route)) {
            street1 = [streetNumber, route].filter(Boolean).join(" ").trim() || null;
        }

        // If route was bad or missing, fall back to formatted first segment
        if (!street1 && formatted) {
            street1 = formatted.split(",")[0].trim() || null;
        }

        return {
            street1: street1 || "Unknown",
            city: pickFirst(comps, [
                "locality",
                "postal_town",
                "administrative_area_level_3",
                "administrative_area_level_2",
                "sublocality",
                "sublocality_level_1"
            ]) || "Unknown",
            state: pickFirst(comps, [
                "administrative_area_level_1",
                "administrative_area_level_2"
            ]) || "Unknown",
            country: pick(comps, "country") || "Unknown",
            postcode: pick(comps, "postal_code") || "0000",
            formatted
        };
    }

    // ======================================================================
    // Cross-window messaging (Wayfarer ↔ Helpshift)
    // ======================================================================

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

    // ======================================================================
    // Helpshift boot
    // ======================================================================

    function initHelpshift() {
        setupHelpshiftMessaging();
        requestWayspotDataFromOpener();
    }

    // ======================================================================
    // Helpshift DOM helpers (shadow-root aware)
    // ======================================================================

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

    function findField(key) {
        const slot = HS_SLOTS[key];
        return slot ? getShadowInputBySlot(slot) : null;
    }

    // ======================================================================
    // Helpshift form fill
    // ======================================================================

    function waitForHelpshiftFormAndFill(wayspotData) {
        const maxAttempts = 60;
        let attempts = 0;

        const intervalId = setInterval(() => {
            attempts++;

            const titleInput = findField('title');
            const latLonInput = findField('latlon');

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

    function setFormValue(el, value) {
        if (!el) return;
        if (value == null || value === "") return;

        el.value = value;
        el.dispatchEvent(new Event("input", { bubbles: true }));
        el.dispatchEvent(new Event("change", { bubbles: true }));
    }

    function fillHelpshiftForm(wayspot) {
        const nameInput = findField('name');
        setFormValue(nameInput, wayspot.name);

        const emailInput = findField('email');
        setFormValue(emailInput, wayspot.email);

        const titleInput = findField('title');
        setFormValue(titleInput, wayspot.title);

        const latLonInput = findField('latlon');
        if (latLonInput && wayspot.lat != null && wayspot.lng != null) {
            const latLonStr = `${wayspot.lat}, ${wayspot.lng}`;
            setFormValue(latLonInput, latLonStr);
        }

        const addrInput = findField('address');
        setFormValue(addrInput, wayspot.address);

        const cityInput = findField('city');
        setFormValue(cityInput, wayspot.city);

        const stateInput = findField('state');
        setFormValue(stateInput, wayspot.state);

        const postcodeInput = findField('postcode');
        setFormValue(postcodeInput, wayspot.postcode);

        const helpshiftCountries = HELPSHIFT_COUNTRIES; // array of the titles from your list
        const resolved = resolveHelpshiftCountryName(wayspot.country, helpshiftCountries);

        if (resolved) {
            setCountryInStaticDropdown(resolved);
        } else {
            // fallback: try raw value anyway
            setCountryInStaticDropdown(wayspot.country);
        }
    }

    // ======================================================================
    // Helpshift: country dropdown + scroll
    // ======================================================================

    function findCountryDropdownHost() {
        // Your confirmed slot
        return querySelectorDeep(
            'static-dropdown[slot="niantic_form_field_20190926192331730-5f5841a93bbe40b"]'
        );
    }

    function clickReal(el) {
        const w = getPageWin();
        if (!el) return;
        // Some components require mousedown rather than click
        el.dispatchEvent(new w.MouseEvent("mousedown", { bubbles: true, cancelable: true }));
        el.dispatchEvent(new w.MouseEvent("mouseup",   { bubbles: true, cancelable: true }));
        el.click?.();
    }

    function setInputValue(inputEl, value) {
        const w = (typeof unsafeWindow !== "undefined") ? unsafeWindow : window;
        if (!inputEl) return;

        inputEl.value = value;
        inputEl.dispatchEvent(new w.Event("input", { bubbles: true }));
        inputEl.dispatchEvent(new w.Event("change", { bubbles: true }));
    }

    function setCountryInStaticDropdown(countryName) {
        const host = findCountryDropdownHost();
        if (!host?.shadowRoot) return false;

        const sr = host.shadowRoot;

        // 1) Open it: click the title container (this matches your HTML)
        const opener =
              sr.querySelector(".hc-static-dropdown__search-input-title-container") ||
              sr.querySelector(".hc-static-dropdown__search-input-title") ||
              sr.querySelector(".hc-static-dropdown");

        if (!opener) return false;
        clickReal(opener);

        // 2) Wait until modal exists inside shadow root, then fill search and click option
        const t0 = Date.now();
        const timeoutMs = 5000;

        const timer = setInterval(() => {
            const modal = sr.querySelector(".hc-static-dropdown__popover-modal");
            if (!modal) {
                if (Date.now() - t0 > timeoutMs) {
                    clearInterval(timer);
                }
                return;
            }

            // Search input is inside <hc-input> shadow root (as your HTML shows)
            const hcInputHost = sr.querySelector("hc-input.hc-static-dropdown__search-input");
            const searchInput = hcInputHost?.shadowRoot?.querySelector("input.static-dropdown-input");

            if (searchInput) {
                setInputValue(searchInput, countryName);
            }

            // Find a matching <li> by its <p title="...">
            const items = Array.from(sr.querySelectorAll("li.hc-static-dropdown__popover-item"));
            const match = items.find(li => {
                const p = li.querySelector("p.hc-static-dropdown__item-title");
                const title = p?.getAttribute("title") || p?.textContent?.trim();
                return title === countryName;
            });

            if (match) {
                clickReal(match);
                clearInterval(timer);
                scrollHelpshiftToTop();
            }
        }, 100);

        return true;
    }

    function getHelpshiftScroller() {
        return document.querySelector(".content-wrapper.js-content-wrapper");
    }

    function scrollHelpshiftToTop() {
        const scroller = getHelpshiftScroller();
        if (!scroller) return;

        // Stop focus fighting the scroll
        try { document.activeElement?.blur?.(); } catch {}

        // Force to top (repeat a few times because the dropdown focus can re-scroll)
        scroller.scrollTop = 0;
        setTimeout(() => { scroller.scrollTop = 0; }, 50);
        setTimeout(() => { scroller.scrollTop = 0; }, 150);
        setTimeout(() => { scroller.scrollTop = 0; }, 350);
    }

    function normalizeCountryKey(s) {
        return String(s || "")
            .trim()
            .toLowerCase()
        // strip accents (Côte d'Ivoire, Réunion, Curaçao, Åland, etc.)
            .normalize("NFKD").replace(/[\u0300-\u036f]/g, "")
        // unify apostrophes
            .replace(/[’‘`]/g, "'")
        // remove dots after abbreviations (U.S. -> US)
            .replace(/\./g, "")
        // collapse whitespace
            .replace(/\s+/g, " ")
        // remove surrounding junk punctuation
            .replace(/^[\s,;()\-]+|[\s,;()\-]+$/g, "");
    }

    function stripLeadingThe(k) {
        return k.startsWith("the ") ? k.slice(4) : k;
    }

    function buildHelpshiftCountryLookup(helpshiftTitles) {
        const byNorm = new Map();

        for (const title of helpshiftTitles) {
            const norm = normalizeCountryKey(title);
            if (norm) byNorm.set(norm, title);

            // also index without leading "the"
            const noThe = stripLeadingThe(norm);
            if (noThe && !byNorm.has(noThe)) byNorm.set(noThe, title);
        }

        return byNorm;
    }

    function resolveHelpshiftCountryName(googleCountry, helpshiftTitles) {
        const inputRaw = String(googleCountry || "").trim();
        if (!inputRaw) return null;

        const byNorm = buildHelpshiftCountryLookup(helpshiftTitles);

        // 1) direct exact match via normalization
        let k = normalizeCountryKey(inputRaw);
        const direct = byNorm.get(k) || byNorm.get(stripLeadingThe(k));
        if (direct) return direct;

        // 2) alias table
        const aliasTarget = COUNTRY_ALIASES[k] || COUNTRY_ALIASES[stripLeadingThe(k)];
        if (aliasTarget) {
            // Ensure aliasTarget exists in Helpshift list; if not, still return it (but you'll see mismatch)
            return byNorm.get(normalizeCountryKey(aliasTarget)) || aliasTarget;
        }

        // 3) safe fuzzy fallback: only if there is a single clear candidate
        // Example: "Venezuela, Bolivarian Republic of" -> "Venezuela (Bolivarian Republic of)"
        const candidates = [];
        for (const [normTitle, originalTitle] of byNorm.entries()) {
            if (normTitle.includes(k) || k.includes(normTitle)) {
                candidates.push(originalTitle);
            }
        }

        // Only accept if unambiguous
        if (candidates.length === 1) return candidates[0];

        return null; // give up safely
    }

    // ======================================================================
    // Entry point
    // ======================================================================

    if (CURRENT_ORIGIN === ORIGIN_WAYFARER) {
        initWayfarer();
    } else if (CURRENT_ORIGIN === ORIGIN_HELPSHIFT) {
        initHelpshift();
    }

})();
