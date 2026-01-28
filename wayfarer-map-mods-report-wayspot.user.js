// ==UserScript==
// @name         Wayfarer Map Mods - Report Wayspots
// @version      3.0.1
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
    const MSG_TICKET = "wf-report-ticket";

    // Wayfarer routes / DOM ids
    const SUBMIT_ROUTE = "/new/submit/new";
    const MAPVIEW_ROUTE = "/new/mapview";
    const POI_BRIDGE_ID = "wfmapmods-poi-bridge";
    const SIDE_PANEL_ID = "wfmapmods-side-panel";

    // Report history store (Wayfarer-side)
    const DB_NAME = "wayfarer-tools-db";
    const REPORTED_STORE_NAME = "reportedWayspots";

    // Geocoder bridge postMessage types (page-context bridge)
    const WFMM_GEO_REQ = "wfmm-geocode-req";
    const WFMM_GEO_RES = "wfmm-geocode-res";

    // Rate limit values for Helpshift web form
    const MAX_HELPSHIFT_TICKETS_PER_HOUR = 10;
    const HELPSHIFT_WINDOW_MS = 60 * 60 * 1000;
    const RATE_LIMIT_REPORT_MECHANISM = "pgo-locations-web";
    const REPORTED_IDX_MECH_TS = "byMechanismTimestamp";

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

    // Helpshift dropdown ids
    const HS_DROPDOWN_SLOTS = {
        country: "niantic_form_field_20190926192331730-5f5841a93bbe40b",
        propertyOwner: "niantic_form_field_20181106191511987-b598f73a256c0ac",
        preferredLanguage: "niantic_form_field_20181112193004636-810bc70ee8c9615"
    };

    // Report codes on Helpshift form
    const REMOVAL_REASON_TEXT_BY_CODE = {
        "niantic_form_text_20181106014139979-8cfd5c3a002f7df": "It’s on private property",
        "niantic_form_text_20200806230605256-06de5949656cf83": "Applying limiting hours of operations to public parks",
        "niantic_form_text_20181106014139979-d78aee9298dc824": "Safety concern - on a major roadway, highway, or bridge",
        "niantic_form_text_20181106014139979-36a3950dc16b720": "Safety concern - interfering with emergency operations",
        "niantic_form_text_20181106014139979-457f0bb6061fbfa": "Safety concern - on an industrial site or power plant",
        "niantic_form_text_20181106014139979-0ab6d91bd225793": "Safety concern - on an airport runway or train tracks",
        "niantic_form_text_20181106014139979-d907c34fbded66b": "Safety concern - in the middle of a body of water with no land"
    };

    const HS_DROPDOWN_DEFAULTS = {
        timeoutMs: 7000,
        pollMs: 75,
        useSearch: true,
        verify: true,
        verifyDelayMs: 80
    };

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
    let rateLimitCache = {
        checkedAtMs: 0,
        state: null
    };
    let rateLimitTimer = null;

    // Settings cache
    const userSettings = {};

    // Helshift-side state
    let helpshiftCurrentWayspotPayload = null;

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

    function formatWaitMs(ms) {
        const s = Math.max(0, Math.ceil(ms / 1000));
        const m = Math.floor(s / 60);
        const r = s % 60;
        if (m <= 0) return `${r}s`;
        return `${m}m ${String(r).padStart(2, "0")}s`;
    }

    function formatTimeLocal(ms) {
        try {
            return new Date(ms).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
        } catch {
            return "";
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

    function isOnMapCapableRoute() {
        const p = window.location.pathname;
        return p.startsWith(SUBMIT_ROUTE) || p.startsWith(MAPVIEW_ROUTE);
    }

    function onRouteChange() {
        if (isOnMapCapableRoute()) {
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
    // Indexed db
    // ======================================================================

    function getReportedWayspotsIDBInstance(version) {
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

                // If store missing, bump version and create it.
                if (!db.objectStoreNames.contains(REPORTED_STORE_NAME)) {
                    const currentVersion = db.version;
                    db.close();
                    getReportedWayspotsIDBInstance(currentVersion + 1).then(resolve, reject);
                    return;
                }

                resolve(db);
            };

            openRequest.onupgradeneeded = (event) => {
                const db = event.target.result;

                let store;
                if (!db.objectStoreNames.contains(REPORTED_STORE_NAME)) {
                    store = db.createObjectStore(REPORTED_STORE_NAME, { keyPath: "id" });
                } else {
                    store = event.target.transaction.objectStore(REPORTED_STORE_NAME);
                }

                if (!store.indexNames.contains(REPORTED_IDX_MECH_TS)) {
                    store.createIndex(REPORTED_IDX_MECH_TS, ["reportMechanism", "timestampMs"], { unique: false });
                }
            };

            openRequest.onerror = (event) => {
                reject(event.target.error || new Error("Failed to open IndexedDB"));
            };
        });
    }

    function saveReportedWayspotToIDB(rec) {
        if (!rec || typeof rec.timestampMs !== "number" || !Number.isFinite(rec.timestampMs)) {
            console.warn("[Report Wayspot] Refusing to save record: missing/invalid timestampMs", rec);
            return Promise.resolve(false);
        }

        if (!rec.id || typeof rec.id !== "string") {
            console.warn("[Report Wayspot] Refusing to save record: missing id", rec);
            return Promise.resolve(false);
        }

        return getReportedWayspotsIDBInstance().then(db => new Promise((resolve) => {
            const tx = db.transaction(REPORTED_STORE_NAME, "readwrite");
            const store = tx.objectStore(REPORTED_STORE_NAME);

            // add() fails on duplicate primary key (id)
            const req = store.add(rec);

            req.onerror = () => {
                console.warn(
                    "[Report Wayspot] Collision: record not saved because id already exists:",
                    rec.id,
                    req.error,
                    rec
                );
                // tx will abort -> resolve(false) below
            };

            tx.oncomplete = () => {
                db.close();
                resolve(true);
            };

            tx.onabort = () => {
                db.close();
                resolve(false);
            };

            tx.onerror = () => {
                db.close();
                resolve(false);
            };
        })).catch(err => {
            console.warn("[Report Wayspot] IndexedDB not available (save):", err);
            return false;
        });
    }

    function makeReportId(timestampMs = Date.now()) {
        // time-first so lexical sort ~= chronological
        const t = Number(timestampMs || Date.now());
        const timePart = t.toString(36).padStart(10, "0");

        // 10 chars random → collision risk is astronomically low
        const randPart = Math.random().toString(36).slice(2, 12);

        return `rpt_${timePart}_${randPart}`;
    }

    // ======================================================================
    // Rate limiting handling
    // ======================================================================

    function getHelpshiftRateLimitStateFromIDB(nowMs = Date.now()) {
        const cutoff = nowMs - HELPSHIFT_WINDOW_MS;

        return getReportedWayspotsIDBInstance().then(db => new Promise((resolve) => {
            try {
                const tx = db.transaction(REPORTED_STORE_NAME, "readonly");
                const store = tx.objectStore(REPORTED_STORE_NAME);

                // Use compound index [mechanism, timestamp]
                const idx = store.index(REPORTED_IDX_MECH_TS);

                const range = IDBKeyRange.bound(
                    [RATE_LIMIT_REPORT_MECHANISM, cutoff],
                    [RATE_LIMIT_REPORT_MECHANISM, nowMs]
                );

                let count = 0;
                let oldestTs = null;

                const req = idx.openCursor(range, "next"); // oldest -> newest

                req.onsuccess = (ev) => {
                    const cursor = ev.target.result;
                    if (!cursor) return; // done

                    const rec = cursor.value;
                    const ts = (typeof rec?.timestampMs === "number") ? rec.timestampMs : null;

                    if (typeof ts === "number") {
                        count++;
                        if (oldestTs === null || ts < oldestTs) oldestTs = ts;
                    }

                    // Early exit: once we've found >= limit, we already know oldest (because cursor is "next")
                    // but keep it safe: oldestTs is already set on first record.
                    if (count >= MAX_HELPSHIFT_TICKETS_PER_HOUR) {
                        // We can stop scanning.
                        try { cursor.advance(1e9); } catch {} // cheap way to end
                        // Alternatively: resolve immediately and ignore tx completion.
                        // We'll just let it finish naturally; still small because window size is small.
                    } else {
                        cursor.continue();
                    }
                };

                req.onerror = () => {
                    resolve({
                        ok: true,
                        countLastHour: 0,
                        oldestTsInWindow: null,
                        nextAllowedAtMs: nowMs,
                        blocked: false
                    });
                };

                tx.oncomplete = () => {
                    db.close();

                    const blocked = count >= MAX_HELPSHIFT_TICKETS_PER_HOUR;
                    const nextAllowedAtMs = blocked && oldestTs != null
                    ? (oldestTs + HELPSHIFT_WINDOW_MS)
                    : nowMs;

                    resolve({
                        ok: true,
                        countLastHour: count,
                        oldestTsInWindow: oldestTs,
                        nextAllowedAtMs,
                        blocked
                    });
                };

                tx.onabort = tx.onerror = () => {
                    db.close();
                    resolve({
                        ok: false,
                        countLastHour: 0,
                        oldestTsInWindow: null,
                        nextAllowedAtMs: nowMs,
                        blocked: false
                    });
                };
            } catch (e) {
                try { db.close(); } catch {}
                resolve({
                    ok: false,
                    countLastHour: 0,
                    oldestTsInWindow: null,
                    nextAllowedAtMs: nowMs,
                    blocked: false
                });
            }
        })).catch(() => ({
            ok: false,
            countLastHour: 0,
            oldestTsInWindow: null,
            nextAllowedAtMs: nowMs,
            blocked: false
        }));
    }

    function getHelpshiftRateLimitStateCached(ttlMs = 3000) {
        const now = Date.now();
        if (rateLimitCache.state && (now - rateLimitCache.checkedAtMs) < ttlMs) {
            return Promise.resolve(rateLimitCache.state);
        }
        return getHelpshiftRateLimitStateFromIDB(now).then(state => {
            rateLimitCache.checkedAtMs = now;
            rateLimitCache.state = state;
            return state;
        });
    }
    function startRateLimitCountdown(link, nextAllowedAtMs) {
        if (rateLimitTimer) return;

        function updateTooltip() {
            const now = Date.now();
            const waitMs = Math.max(0, nextAllowedAtMs - now);

            // Window expired → re-evaluate from IDB once
            if (waitMs <= 0) {
                stopRateLimitCountdown();
                rateLimitCache.checkedAtMs = 0;

                getHelpshiftRateLimitStateCached(0).then(rl => {
                    const l = document.getElementById('wfmapmods-settings-report-wayspot');
                    if (!l) return;
                    applyRateLimitToReportLink(l, rl);
                });
                return;
            }

            // Ceiling to minutes
            const minutesLeft = Math.ceil(waitMs / 60000);

            const count = rateLimitCache?.state?.countLastHour
            ?? MAX_HELPSHIFT_TICKETS_PER_HOUR;

            link.title =
                `Rate limit reached: ${count}/${MAX_HELPSHIFT_TICKETS_PER_HOUR} reports in the last hour.\n` +
                `Next report available in ${minutesLeft} minute${minutesLeft === 1 ? "" : "s"} ` +
                `(at ${formatTimeLocal(nextAllowedAtMs)}).`;
        }

        // Initial update immediately
        updateTooltip();

        // Align updates roughly to minute boundaries
        const now = Date.now();
        const msToNextMinute = 60000 - (now % 60000);

        // First timeout → align to minute edge
        rateLimitTimer = setTimeout(() => {
            updateTooltip();

            // Then once per minute
            rateLimitTimer = setInterval(updateTooltip, 60000);
        }, msToNextMinute);
    }

    function stopRateLimitCountdown() {
        if (rateLimitTimer) {
            clearTimeout(rateLimitTimer);
            clearInterval(rateLimitTimer);
            rateLimitTimer = null;
        }
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

        // Already injected
        if (link) return;

        link = document.createElement('a');
        link.id = linkId;
        link.textContent = 'Web Report';
        link.style.cursor = 'pointer';
        link.style.display = 'none'; // hidden until status known

        // Try to find an existing "Report" link
        const reportAnchor = [...reportLinkBody.querySelectorAll('a')]
        .find(a => a.textContent.trim() === 'Report');

        if (reportAnchor && reportAnchor.parentNode === reportLinkBody) {
            // Insert immediately after "Report"
            reportLinkBody.insertBefore(link, reportAnchor.nextSibling);
        } else {
            // Fallback: append to the end
            reportLinkBody.appendChild(link);
        }

        updateReportWayspotLinkVisibility();

        link.addEventListener('click', (ev) => {
            ev.preventDefault();
            handleReportWayspotClick();
        });
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

        // Defaults
        const defaultPropertyOwner = false; // No
        const defaultPreferredLanguage = "English";

        // Normalise existing values safely
        const savedPropertyOwner =
              typeof reporting.propertyOwner === "boolean"
        ? reporting.propertyOwner
        : defaultPropertyOwner;

        const LANGUAGE_OPTIONS = [
            "English",
            "日本語",
            "한국어",
            "繁體中文",
            "Español",
            "Français",
            "Deutsch",
            "Italiano",
            "Português do Brasil",
            "Thai",
            "русский",
            "Türkçe",
            "Indonesian",
            "Hindi",
        ];

        const savedPreferredLanguage =
              (typeof reporting.preferredLanguage === "string" && LANGUAGE_OPTIONS.includes(reporting.preferredLanguage))
        ? reporting.preferredLanguage
        : defaultPreferredLanguage;

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
            width: "320px",
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
                gap: "6px"
            });

            const label = document.createElement("label");
            label.textContent = labelText;
            Object.assign(label.style, {
                flex: "0 0 120px",
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

        // --- Property Owner (Yes/No dropdown) ---
        const propertyOwnerSelect = document.createElement("select");
        const poNo = document.createElement("option");
        poNo.value = "no";
        poNo.textContent = "No";
        const poYes = document.createElement("option");
        poYes.value = "yes";
        poYes.textContent = "Yes";
        propertyOwnerSelect.appendChild(poNo);
        propertyOwnerSelect.appendChild(poYes);
        propertyOwnerSelect.value = savedPropertyOwner ? "yes" : "no";
        dialog.appendChild(makeRow("Property Owner:", propertyOwnerSelect));

        // --- Preferred Language dropdown ---
        const languageSelect = document.createElement("select");
        for (const lang of LANGUAGE_OPTIONS) {
            const opt = document.createElement("option");
            opt.value = lang;
            opt.textContent = lang;
            languageSelect.appendChild(opt);
        }
        languageSelect.value = savedPreferredLanguage;
        dialog.appendChild(makeRow("Preferred Language:", languageSelect));

        // --- Buttons row ---
        const buttonsRow = document.createElement("div");
        Object.assign(buttonsRow.style, {
            display: "flex",
            justifyContent: "flex-end",
            gap: "8px",
            marginTop: "10px"
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

        cancelBtn.addEventListener("click", () => {
            closeModal();
        });

        saveBtn.addEventListener("click", () => {
            if (!userSettings.reporting || typeof userSettings.reporting !== "object") {
                userSettings.reporting = {};
            }

            userSettings.reporting.name = nameInput.value.trim();
            userSettings.reporting.email = emailInput.value.trim();

            // NEW: save extra settings
            userSettings.reporting.propertyOwner = (propertyOwnerSelect.value === "yes");
            userSettings.reporting.preferredLanguage = languageSelect.value || defaultPreferredLanguage;

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
            return true;
        }

        if (status === 'LIVE' || status === 'ACCEPTED') {
            // Condition 3: LIVE/ACCEPTED from any other plug-in, but must match a loaded POI lat,lng
            const pois = Array.isArray(livePois) ? livePois : [];
            return pois.some(p => p?.lat === lat && p?.lng === lng);
        }

        return false;
    }

    async function updateReportWayspotLinkVisibility() {
        const link = document.getElementById('wfmapmods-settings-report-wayspot');
        if (!link) return;

        const info = getCurrentWayspotBridgeData();
        const visible = shouldShowReportLink(info, livePois);

        if (!visible) {
            link.style.display = "none";
            stopRateLimitCountdown();
            return;
        }

        link.style.display = "";

        // Apply rate limiting state
        const rl = await getHelpshiftRateLimitStateCached(3000);

        applyRateLimitToReportLink(link, rl);
    }

    function applyRateLimitToReportLink(link, rlState) {
        const now = Date.now();

        const count = rlState?.countLastHour || 0;
        const blocked = !!rlState?.blocked;

        // Always show usage in tooltip (helpful even when unblocked)
        if (!blocked) {
            link.dataset.disabled = "";
            link.style.pointerEvents = "";
            link.style.opacity = "";
            link.style.cursor = "pointer";

            link.title = `Reports in last hour: ${count}/${MAX_HELPSHIFT_TICKETS_PER_HOUR}`;
            stopRateLimitCountdown();
            return;
        }

        const nextAt = rlState?.nextAllowedAtMs || (now + 30 * 1000);
        const waitMs = Math.max(0, nextAt - now);

        link.dataset.disabled = "1";
        link.style.pointerEvents = "auto";
        link.style.opacity = "0.45";
        link.style.cursor = "not-allowed";

        link.title =
            `Rate limit reached: ${count}/${MAX_HELPSHIFT_TICKETS_PER_HOUR} reports in the last hour.\n` +
            `Next report available in ${formatWaitMs(waitMs)} (at ${formatTimeLocal(nextAt)}).`;

        startRateLimitCountdown(link, nextAt);
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
            email: reporting.email || null,
            propertyOwner: (typeof reporting.propertyOwner === "boolean") ? reporting.propertyOwner : false,
            preferredLanguage: (typeof reporting.preferredLanguage === "string" && reporting.preferredLanguage.trim())
            ? reporting.preferredLanguage.trim()
            : "English"
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
                basePayload.postcode ||= "-";
            }
        }

        openHelpshiftWithData(basePayload);
    }

    function collectCurrentWayspotData() {
        let guid = null;
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
                        if (typeof payload.guid === "string") {
                            guid = payload.guid;
                        }
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
            guid: guid || null,
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
            postcode: pick(comps, "postal_code") || "-",
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

            // Send POI data to Helpshift form
            if (data.type === MSG_GET_DATA) {
                if (lastReportPayload) {
                    event.source.postMessage({
                        executor: MSG_EXECUTOR,
                        type: MSG_DATA,
                        payload: lastReportPayload
                    }, ORIGIN_HELPSHIFT);
                }
                return;
            }

            // Store submitted tickets in the indexed db
            if (data.type === MSG_TICKET && data.payload) {
                const rec = data.payload;
                if (!rec.id) return;

                saveReportedWayspotToIDB(rec).then(ok => {
                    if (!ok) return;

                    // Update cache cheaply without querying IDB
                    try {
                        const ts = rec.timestampMs;
                        if (typeof ts === "number" && rec.reportMechanism === RATE_LIMIT_REPORT_MECHANISM) {
                            // Bust cache so next UI check is fresh
                            rateLimitCache.checkedAtMs = 0;
                        }
                    } catch {}

                    // Re-evaluate link state (in case we just hit the cap)
                    updateReportWayspotLinkVisibility();

                    console.log("[Report Wayspot] Saved report ticket:", rec);
                }).catch(e => {
                    console.warn("[Report Wayspot] Failed to save report ticket:", e);
                });
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
                helpshiftCurrentWayspotPayload = data.payload;
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
        hookHelpshiftReportIssueXHR();
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
                Promise.resolve(fillHelpshiftForm(wayspotData)).catch(e => {
                    console.warn("[Report Wayspot] fillHelpshiftForm error:", e);
                });
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

    async function fillHelpshiftForm(wayspot) {
        const nameInput = findField('name');
        setFormValue(nameInput, wayspot.name);

        const emailInput = findField('email');
        setFormValue(emailInput, wayspot.email);

        const titleInput = findField('title');
        setFormValue(titleInput, wayspot.title);

        const latLonInput = findField('latlon');
        if (latLonInput && wayspot.lat != null && wayspot.lng != null) {
            setFormValue(latLonInput, `${wayspot.lat}, ${wayspot.lng}`);
        }

        setFormValue(findField('address'), wayspot.address);
        setFormValue(findField('city'), wayspot.city);
        setFormValue(findField('state'), wayspot.state);
        setFormValue(findField('postcode'), wayspot.postcode);

        // ---- Dropdowns: run sequentially to avoid focus/popover fights ----
        await setPropertyOwnerDropdownYesNoAsync(wayspot.propertyOwner);

        await setPreferredLanguageDropdownAsync(wayspot.preferredLanguage);

        const helpshiftCountries = HELPSHIFT_COUNTRIES;
        const resolved = resolveHelpshiftCountryName(wayspot.country, helpshiftCountries);
        await setCountryInStaticDropdownAsync(resolved || wayspot.country);

        // Optional final scroll reset
        scrollHelpshiftToTop();
    }

    // ======================================================================
    // Helpshift: country dropdown + scroll
    // ======================================================================

    function findStaticDropdownHostBySlot(slotName) {
        return slotName ? querySelectorDeep(`static-dropdown[slot="${slotName}"]`) : null;
    }

    function clickReal(el) {
        const w = getPageWin();
        if (!el) return;
        el.dispatchEvent(new w.MouseEvent("mousedown", { bubbles: true, cancelable: true }));
        el.dispatchEvent(new w.MouseEvent("mouseup",   { bubbles: true, cancelable: true }));
        el.click?.();
    }

    function setInputValue(inputEl, value) {
        const w = getPageWin();
        if (!inputEl) return;
        inputEl.value = value;
        inputEl.dispatchEvent(new w.Event("input", { bubbles: true }));
        inputEl.dispatchEvent(new w.Event("change", { bubbles: true }));
    }

    function getStaticDropdownSelectedTitle(sr) {
        const el =
              sr.querySelector(".hc-static-dropdown__search-input-title") ||
              sr.querySelector(".hc-static-dropdown__search-input-title-container") ||
              sr.querySelector(".hc-static-dropdown");

        return el?.textContent?.trim() || null;
    }

    function setStaticDropdownByTitleAsync(slotName, desiredTitle, opts = {}) {
        const o = { ...HS_DROPDOWN_DEFAULTS, ...(opts || {}) };

        return new Promise((resolve) => {
            const title = String(desiredTitle || "").trim();
            if (!title) return resolve(false);

            const host = findStaticDropdownHostBySlot(slotName);
            if (!host?.shadowRoot) return resolve(false);

            const sr = host.shadowRoot;

            // Open dropdown
            const opener =
                  sr.querySelector(".hc-static-dropdown__search-input-title-container") ||
                  sr.querySelector(".hc-static-dropdown__search-input-title") ||
                  sr.querySelector(".hc-static-dropdown");

            if (!opener) return resolve(false);
            clickReal(opener);

            const t0 = Date.now();
            let clicked = false;

            const timer = setInterval(() => {
                if (Date.now() - t0 > o.timeoutMs) {
                    clearInterval(timer);
                    return resolve(false);
                }

                const modal = sr.querySelector(".hc-static-dropdown__popover-modal");
                if (!modal) {
                    if (!clicked) return; // still waiting to open

                    // modal closed after click → optionally verify
                    clearInterval(timer);

                    if (!o.verify) {
                        return resolve(true);
                    }

                    setTimeout(() => {
                        const selected = getStaticDropdownSelectedTitle(sr);
                        const ok = !!(selected && selected.includes(title));
                        resolve(ok);
                    }, o.verifyDelayMs);

                    return;
                }

                // Optional search
                if (o.useSearch) {
                    const hcInputHost = sr.querySelector("hc-input.hc-static-dropdown__search-input");
                    const searchInput = hcInputHost?.shadowRoot?.querySelector("input.static-dropdown-input");
                    if (searchInput) setInputValue(searchInput, title);
                }

                // Find & click match
                const items = Array.from(sr.querySelectorAll("li.hc-static-dropdown__popover-item"));
                const match = items.find(li => {
                    const p = li.querySelector("p.hc-static-dropdown__item-title");
                    const itemTitle = p?.getAttribute("title") || p?.textContent?.trim();
                    return itemTitle === title;
                });

                if (match) {
                    clicked = true;
                    clickReal(match);
                }
            }, o.pollMs);
        });
    }

    function setCountryInStaticDropdownAsync(countryName) {
        return setStaticDropdownByTitleAsync(HS_DROPDOWN_SLOTS.country, countryName, {
            useSearch: true
        });
    }

    function setPropertyOwnerDropdownYesNoAsync(isOwner) {
        const ownerBool = (typeof isOwner === "boolean") ? isOwner : false;
        return setStaticDropdownByTitleAsync(HS_DROPDOWN_SLOTS.propertyOwner, ownerBool ? "Yes" : "No", {
            useSearch: false
        });
    }

    function setPreferredLanguageDropdownAsync(language) {
        const lang = String(language || "").trim() || "English";
        return setStaticDropdownByTitleAsync(HS_DROPDOWN_SLOTS.preferredLanguage, lang, {
            useSearch: true
        });
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

    function isHelpshiftReportIssueUrl(url) {
        try {
            const u = new URL(url, location.origin);
            return u.origin === ORIGIN_HELPSHIFT && u.pathname === "/xhr/support/report-issue/";
        } catch {
            return String(url || "").includes("/xhr/support/report-issue/");
        }
    }

    // Parse XHR request body (FormData or URLSearchParams-string)
    function parseHelpshiftReportIssueBody(body) {
        const out = {
            message: null,
            metaJson: null,
            meta: null,
        };

        try {
            if (!body) return out;

            // FormData
            if (typeof FormData !== "undefined" && body instanceof FormData) {
                out.message = body.get("message") || null;
                out.metaJson = body.get("meta") || null;
            } else if (typeof body === "string") {
                // x-www-form-urlencoded
                const params = new URLSearchParams(body);
                out.message = params.get("message");
                out.metaJson = params.get("meta");
            } else if (body instanceof URLSearchParams) {
                out.message = body.get("message");
                out.metaJson = body.get("meta");
            }
        } catch {}

        if (out.metaJson) {
            try {
                out.meta = JSON.parse(out.metaJson);
            } catch {}
        }

        return out;
    }

    // ======================================================================
    // Parse Helpshift ticket data and return to Wayfarer
    // ======================================================================


    function extractRemovalReasonCode(metaObj) {
        // Your capture: meta.cifs.removals_reason holds a niantic_form_text_* id
        const cifs = metaObj?.cifs;
        const v = cifs?.removals_reason;
        return (typeof v === "string" && v.trim()) ? v.trim() : null;
    }

    function resolveRemovalReasonText(code) {
        if (!code) return null;
        return REMOVAL_REASON_TEXT_BY_CODE[code] || null;
    }

    function postTicketToOpener(ticketRecord) {
        if (!window.opener) return;

        const msg = {
            executor: MSG_EXECUTOR,
            type: MSG_TICKET,
            payload: ticketRecord
        };

        try { window.opener.postMessage(msg, ORIGIN_WAYFARER); } catch {}
    }

    // Helpshift-only: hook XHR to capture report-issue request + response
    function hookHelpshiftReportIssueXHR() {
        const XHR = window.XMLHttpRequest || XMLHttpRequest;
        if (!XHR || XHR.__wfReportIssueHooked) return;
        XHR.__wfReportIssueHooked = true;

        const origOpen = XHR.prototype.open;
        const origSend = XHR.prototype.send;

        XHR.prototype.open = function (method, url, ...rest) {
            this._wf_hs_method = method;
            this._wf_hs_url = url;
            return origOpen.call(this, method, url, ...rest);
        };

        XHR.prototype.send = function (body) {
            const isTarget = (String(this._wf_hs_method || "").toUpperCase() === "POST") && isHelpshiftReportIssueUrl(this._wf_hs_url);

            if (isTarget) {
                this._wf_hs_body = body;

                this.addEventListener("load", () => {
                    let resp = null;
                    try { resp = JSON.parse(this.responseText); } catch {}

                    const parsedReq = parseHelpshiftReportIssueBody(this._wf_hs_body);

                    const ticketRecord = buildTicketRecordFromHelpshift(
                        parsedReq,
                        resp,
                        helpshiftCurrentWayspotPayload
                    );

                    // Sometimes the Helpshift form fails to upload properly
                    // When whether the response included a ticket number.
                    if (!ticketRecord || !ticketRecord.ticket) {
                        console.warn("[Report Wayspot] Helpshift report-issue did not return publish_id; not sending to opener.", {
                            status: this.status,
                            url: this._wf_hs_url,
                            responseSnippet: String(this.responseText || "").slice(0, 200)
                        });
                        return;
                    }

                    postTicketToOpener(ticketRecord);
                });
            }

            return origSend.call(this, body);
        };
    }

    function buildTicketRecordFromHelpshift(reqParsed, respJson, wayspotPayload) {
        const ticket = respJson?.publish_id ? String(respJson.publish_id) : null;

        const timestampMs = (typeof respJson?.created_at_epoch === "number" && Number.isFinite(respJson.created_at_epoch))
        ? respJson.created_at_epoch
        : Date.now();

        const wp = wayspotPayload || {};
        const guid = (typeof wp.guid === "string" && wp.guid.trim()) ? wp.guid.trim() : null;
        const title = (typeof wp.title === "string" && wp.title.trim()) ? wp.title.trim() : null;
        const lat = (typeof wp.lat === "number") ? wp.lat : null;
        const lng = (typeof wp.lng === "number") ? wp.lng : null;

        const removalReasonCode = extractRemovalReasonCode(reqParsed?.meta);
        const removalReasonText = resolveRemovalReasonText(removalReasonCode);

        const supportingText =
              (typeof reqParsed?.message === "string" && reqParsed.message.trim())
        ? reqParsed.message.trim()
        : null;

        return {
            // Primary Key - Unique ID
            id: makeReportId(timestampMs),

            // Wayspot being reported
            guid,
            title,
            lat,
            lng,

            // Report metadata
            ticket,
            timestampMs,
            reportMechanism: "pgo-locations-web",

            removalReasonCode,
            removalReasonText,
            supportingText
        };
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
