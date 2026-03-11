// ==UserScript==
// @name         Wayfarer Map Mods - Report Wayspots
// @version      3.1.4
// @description  Displays Reported Wayspots history on the map and adds additional reporting mechanisms.
// @namespace    https://gitlab.com/Tntnnbltn/wayfarer-addons
// @downloadURL  https://gitlab.com/Tntnnbltn/wayfarer-addons/-/raw/main/wayfarer-map-mods-report-wayspot.user.js
// @updateURL    https://gitlab.com/Tntnnbltn/wayfarer-addons/-/raw/main/wayfarer-map-mods-report-wayspot.user.js
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

    // Report table modal
    const REPORT_HISTORY_LINK_ID = "wfmapmods-settings-reporting-history";
    const REPORT_HISTORY_MODAL_ID = "wfmapmods-report-history-backdrop";
    const REPORT_HISTORY_PAGE_SIZE = 10;
    const WFMM_DETAILS_ROW_CLASS = "wfmm-reporting-details-row";

    // Api endpoint urls
    const WFMM_GCS_ENDPOINT_PART = "/api/v1/vault/mapview/gcs?";
    const WFMM_LIVE_POIS_ENDPOINT_PART = "/api/v1/vault/live-pois-in-radius?";

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
        preferredLanguage: "niantic_form_field_20181112193004636-810bc70ee8c9615",
        typeOfLocation: "niantic_form_field_20181102230310264-4041184eb6fa399",
        reasonForRemovalRequest: "niantic_form_field_20181106014139979-551d4e76e210179",
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
        "deutschland": "Germany",
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
    const userSettings = {
        reporting: {
            name: "",
            email: "",
            propertyOwner: false,
            preferredLanguage: "English",
            typeOfLocation: "",
            reasonForRemovalRequest: ""
        },

        // Controls which pulse types are visible on the map
        pulseVisibility: {
            live: true,
            modified: true,
            reinstated: true,
            retired: false
        }
    };

    // Helshift-side state
    let helpshiftCurrentWayspotPayload = null;

    // Map element
    let wfMap = null;
    let mapAttached = false;
    const GCS_MIN_ZOOM = 18;

    // Report history table
    let WFMM_REPORTING_HISTORY_CTX = null;

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
        injectCss();
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


    /**
     * Reads ALL records from reportedWayspots store.
     * Returns Array<rec>.
     */
    function loadAllReportedWayspotsFromIDB() {
        return getReportedWayspotsIDBInstance().then((db) => new Promise((resolve) => {
            const out = [];
            try {
                const tx = db.transaction(REPORTED_STORE_NAME, "readonly");
                const store = tx.objectStore(REPORTED_STORE_NAME);

                const req = store.openCursor(null, "next"); // natural order; we'll sort in JS

                req.onsuccess = (ev) => {
                    const cursor = ev.target.result;
                    if (!cursor) return;
                    out.push(cursor.value);
                    cursor.continue();
                };

                req.onerror = () => {
                    // still resolve, but empty
                    resolve([]);
                };

                tx.oncomplete = () => {
                    try { db.close(); } catch {}
                    resolve(out);
                };

                tx.onabort = tx.onerror = () => {
                    try { db.close(); } catch {}
                    resolve([]);
                };
            } catch (e) {
                try { db.close(); } catch {}
                resolve([]);
            }
        })).catch((err) => {
            console.warn("[Base] IndexedDB not available (read reporting history):", err);
            return [];
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

    function patchReportedWayspotInIDB(id, patch) {
        if (!id || typeof id !== "string") return Promise.resolve(false);
        if (!patch || typeof patch !== "object") return Promise.resolve(false);

        return getReportedWayspotsIDBInstance().then(db => new Promise((resolve) => {
            let tx;
            try {
                tx = db.transaction(REPORTED_STORE_NAME, "readwrite");
                const store = tx.objectStore(REPORTED_STORE_NAME);

                const getReq = store.get(id);

                getReq.onsuccess = () => {
                    const rec = getReq.result;
                    if (!rec) {
                        // record missing; nothing to patch
                        resolve(false);
                        return;
                    }

                    const updated = Object.assign({}, rec, patch);

                    const putReq = store.put(updated);
                    putReq.onerror = () => {
                        console.warn("[Report Wayspot] Failed to patch record:", id, putReq.error);
                    };
                };

                getReq.onerror = () => {
                    console.warn("[Report Wayspot] Failed to read record for patch:", id, getReq.error);
                    resolve(false);
                };

                tx.oncomplete = () => {
                    try { db.close(); } catch {}
                    resolve(true);
                };
                tx.onabort = tx.onerror = () => {
                    try { db.close(); } catch {}
                    resolve(false);
                };
            } catch (e) {
                try { db.close(); } catch {}
                resolve(false);
            }
        })).catch(err => {
            console.warn("[Report Wayspot] IndexedDB not available (patch):", err);
            return false;
        });
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
            insertReportingHistoryLinkIfReady();
            insertReportingSettingsLinkIfReady();
            startPoiBridgeWatcherIfReady();
            attachToMapIfNeeded();
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

            // Open immediately while the click gesture is still active
            const popup = window.open('about:blank', '_blank');

            // Then do async work
            handleReportWayspotClick(popup);
        });
    }

    function insertReportingHistoryLinkIfReady() {
        const settingsBody = document.querySelector(".wfmapmods-settings-links");
        if (!settingsBody) return;

        // Already injected
        if (document.getElementById(REPORT_HISTORY_LINK_ID)) return;

        const link = document.createElement("a");
        link.id = REPORT_HISTORY_LINK_ID;
        link.textContent = "Reporting History";
        link.style.cursor = "pointer";

        settingsBody.appendChild(link);

        link.addEventListener("click", (ev) => {
            ev.preventDefault();
            openReportingHistoryModal();
        });
    }


    function insertReportingSettingsLinkIfReady() {
        const settingsBody = document.querySelector(".wfmapmods-settings-links");
        if (!settingsBody) return;

        if (document.getElementById("wfmapmods-settings-reporting")) return;

        const link = document.createElement("a");
        link.id = "wfmapmods-settings-reporting";
        link.textContent = "Reporting Settings";
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

        // Assumes userSettings is initialised with full structure
        const reporting = userSettings.reporting;
        const pulseVisibility = userSettings.pulseVisibility;

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

        const TYPE_OF_LOCATION_OPTIONS = [
            { value: "", label: "[Leave Blank]" },
            { value: "Apartment/Condominium", label: "Apartment/Condominium" },
            { value: "Business/Corporate campus", label: "Business/Corporate campus" },
            { value: "Cemetery", label: "Cemetery" },
            { value: "College/University campus", label: "College/University campus" },
            { value: "Government office/property", label: "Government office/property" },
            { value: "Historical site/landmark", label: "Historical site/landmark" },
            { value: "Public park", label: "Public park" },
            { value: "Place of worship", label: "Place of worship" },
            { value: "Private residence or farm", label: "Private residence or farm" },
            { value: "School (K-12)", label: "School (K-12)" },
        ];

        const REASON_FOR_REMOVAL_OPTIONS = [
            { value: "", label: "[Leave blank]" },
            { value: "It’s on private property ", label: "It’s on private property" },
            { value: "Applying limiting hours of operations to public parks", label: "Applying limiting hours of operations to public parks" },
            { value: "Safety concern - on a major roadway, highway, or bridge", label: "Safety concern - on a major roadway, highway, or bridge" },
            { value: "Safety concern - interfering with emergency operations", label: "Safety concern - interfering with emergency operations" },
            { value: "Safety concern - on an industrial site or power plant", label: "Safety concern - on an industrial site or power plant" },
            { value: "Safety concern - on an airport runway or train tracks", label: "Safety concern - on an airport runway or train tracks" },
            { value: "Safety concern - in the middle of a body of water with no land", label: "Safety concern - in the middle of a body of water with no land" },
        ];

        // Validate against current option lists (guards against stale/invalid localStorage)
        const savedPreferredLanguage =
              (typeof reporting.preferredLanguage === "string" && LANGUAGE_OPTIONS.includes(reporting.preferredLanguage))
        ? reporting.preferredLanguage
        : "English";

        const savedTypeOfLocation =
              (typeof reporting.typeOfLocation === "string" &&
               TYPE_OF_LOCATION_OPTIONS.some(o => o.value === reporting.typeOfLocation))
        ? reporting.typeOfLocation
        : "";

        const savedReasonForRemoval =
              (typeof reporting.reasonForRemovalRequest === "string" &&
               REASON_FOR_REMOVAL_OPTIONS.some(o => o.value === reporting.reasonForRemovalRequest))
        ? reporting.reasonForRemovalRequest
        : "";

        // Values straight from settings
        const savedPropertyOwner = !!reporting.propertyOwner;

        const savedPulseLive       = !!pulseVisibility.live;
        const savedPulseModified   = !!pulseVisibility.modified;
        const savedPulseRetired    = !!pulseVisibility.retired;
        const savedPulseReinstated = !!pulseVisibility.reinstated;

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
            marginBottom: "8px"
        });
        dialog.appendChild(title);

        // =========================================================================
        // Section 1: Pulse settings (FIRST)
        // =========================================================================
        const pulseSectionTitle = document.createElement("div");
        pulseSectionTitle.textContent = "Pulse indicators";
        Object.assign(pulseSectionTitle.style, {
            fontSize: "12px",
            fontWeight: "600",
            marginTop: "2px",
            marginBottom: "6px"
        });
        dialog.appendChild(pulseSectionTitle);

        const pulseSectionHelper = document.createElement("div");
        pulseSectionHelper.textContent = "Show a pulsing marker behind reported Wayspots based on last known status.";
        Object.assign(pulseSectionHelper.style, {
            fontSize: "11px",
            color: "#4b5563",
            marginBottom: "8px",
            lineHeight: "1.4"
        });
        dialog.appendChild(pulseSectionHelper);

        function makeCheckboxInline(labelText, checked) {
            const wrap = document.createElement("label");
            Object.assign(wrap.style, {
                display: "flex",
                alignItems: "center",
                gap: "6px",
                userSelect: "none",
                fontSize: "11px",
                color: "#374151",
                cursor: "pointer"
            });

            const cb = document.createElement("input");
            cb.type = "checkbox";
            cb.checked = !!checked;
            cb.style.margin = "0";

            const txt = document.createElement("span");
            txt.textContent = labelText;

            wrap.appendChild(cb);
            wrap.appendChild(txt);

            return { wrap, cb };
        }

        // One row, 4 checkboxes: Live, Modified, Retired, Reinstated (in that order)
        const pulseRow = document.createElement("div");
        Object.assign(pulseRow.style, {
            display: "flex",
            flexDirection: "column",
            gap: "6px",
            marginBottom: "10px",
            paddingLeft: "14px"
        });

        const liveCb = makeCheckboxInline("Live (Red)", savedPulseLive);
        const modCb  = makeCheckboxInline("Modified (Yellow)", savedPulseModified);
        const retCb  = makeCheckboxInline("Retired (Grey)", savedPulseRetired);
        const reinCb = makeCheckboxInline("Reinstated (Purple)", savedPulseReinstated);

        pulseRow.appendChild(liveCb.wrap);
        pulseRow.appendChild(modCb.wrap);
        pulseRow.appendChild(retCb.wrap);
        pulseRow.appendChild(reinCb.wrap);
        dialog.appendChild(pulseRow);

        // Divider between sections
        const divider = document.createElement("div");
        Object.assign(divider.style, {
            height: "1px",
            background: "#e5e7eb",
            margin: "8px 0 10px"
        });
        dialog.appendChild(divider);

        // =========================================================================
        // Section 2: Form settings
        // =========================================================================
        const formSectionTitle = document.createElement("div");
        formSectionTitle.textContent = "Auto-fill webform";
        Object.assign(formSectionTitle.style, {
            fontSize: "12px",
            fontWeight: "600",
            marginBottom: "6px"
        });
        dialog.appendChild(formSectionTitle);

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

            inputEl.style.flex = "1 1 0";
            inputEl.style.minWidth = "0";
            inputEl.style.width = "100%";
            inputEl.style.fontSize = "11px";
            inputEl.style.padding = "3px 4px";
            inputEl.style.borderRadius = "4px";
            inputEl.style.border = "1px solid #d1d5db";
            inputEl.style.boxSizing = "border-box";

            if (inputEl.tagName === "SELECT") {
                inputEl.style.whiteSpace = "normal";
            }

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

        // --- Type of Location dropdown ---
        const typeOfLocationSelect = document.createElement("select");
        for (const item of TYPE_OF_LOCATION_OPTIONS) {
            const opt = document.createElement("option");
            opt.value = item.value;
            opt.textContent = item.label;
            typeOfLocationSelect.appendChild(opt);
        }
        typeOfLocationSelect.value = savedTypeOfLocation;
        dialog.appendChild(makeRow("Type of Location:", typeOfLocationSelect));

        // --- Reason for Removal Request dropdown ---
        const reasonForRemovalSelect = document.createElement("select");
        for (const item of REASON_FOR_REMOVAL_OPTIONS) {
            const opt = document.createElement("option");
            opt.value = item.value;
            opt.textContent = item.label;
            reasonForRemovalSelect.appendChild(opt);
        }
        reasonForRemovalSelect.value = savedReasonForRemoval;
        dialog.appendChild(makeRow("Reason for Removal:", reasonForRemovalSelect));

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
        dialog.appendChild(makeRow("I am the owner:", propertyOwnerSelect));

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
            // Snapshot pulse settings before change (to detect changes)
            const prevPulseVisibility = { ...userSettings.pulseVisibility };

            // --- Save pulse settings ---
            userSettings.pulseVisibility.live       = !!liveCb.cb.checked;
            userSettings.pulseVisibility.modified   = !!modCb.cb.checked;
            userSettings.pulseVisibility.retired    = !!retCb.cb.checked;
            userSettings.pulseVisibility.reinstated = !!reinCb.cb.checked;

            const pulsesChanged =
                  prevPulseVisibility.live !== userSettings.pulseVisibility.live ||
                  prevPulseVisibility.modified !== userSettings.pulseVisibility.modified ||
                  prevPulseVisibility.retired !== userSettings.pulseVisibility.retired ||
                  prevPulseVisibility.reinstated !== userSettings.pulseVisibility.reinstated;

            // --- Save form fields ---
            userSettings.reporting.name = nameInput.value.trim();
            userSettings.reporting.email = emailInput.value.trim();
            userSettings.reporting.typeOfLocation = typeOfLocationSelect.value || "";
            userSettings.reporting.reasonForRemovalRequest = reasonForRemovalSelect.value || "";
            userSettings.reporting.propertyOwner = (propertyOwnerSelect.value === "yes");
            userSettings.reporting.preferredLanguage = languageSelect.value || "English";

            saveSettings();

            if (pulsesChanged) {
                // Hide/show pulses according to new settings
                try { schedulePulseRefresh(0); } catch {}
            }

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

        if (status === 'LIVE' || status === 'ACCEPTED') {
            // Condition 2: LIVE/ACCEPTED from any other plug-in, but must match a loaded POI lat,lng
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

    async function handleReportWayspotClick(popup) {
        const wayspotData = collectCurrentWayspotData();

        loadSettings();
        const reporting = userSettings.reporting || {};

        const basePayload = {
            ...wayspotData,
            name: reporting.name || null,
            email: reporting.email || null,
            propertyOwner: typeof reporting.propertyOwner === "boolean" ? reporting.propertyOwner : false,
            preferredLanguage:
            (typeof reporting.preferredLanguage === "string" && reporting.preferredLanguage.trim())
            ? reporting.preferredLanguage.trim()
            : "English",
            typeOfLocation:
            (typeof reporting.typeOfLocation === "string" && reporting.typeOfLocation.trim())
            ? reporting.typeOfLocation.trim()
            : null,
            reasonForRemovalRequest:
            (typeof reporting.reasonForRemovalRequest === "string" && reporting.reasonForRemovalRequest.trim())
            ? reporting.reasonForRemovalRequest.trim()
            : null,
        };

        if (basePayload.lat != null && basePayload.lng != null) {
            try {
                const geoResults = await pageReverseGeocode(basePayload.lat, basePayload.lng);
                const geo = extractBestAddress(geoResults);

                basePayload.address  ||= geo.street1;
                basePayload.city     ||= geo.city;
                basePayload.state    ||= geo.state;
                basePayload.country  ||= geo.country;
                basePayload.postcode ||= geo.postcode;
                basePayload.addressString ||= geo.formatted || [geo.street1, geo.city, geo.state, geo.postcode, geo.country]
                    .filter(Boolean)
                    .join(", ");
            } catch (e) {
                console.warn("[Report Wayspot] Reverse geocode failed:", e);
                basePayload.address  ||= "Unknown";
                basePayload.city     ||= "Unknown";
                basePayload.state    ||= "Unknown";
                basePayload.country  ||= "Unknown";
                basePayload.postcode ||= "-";
                basePayload.addressString ||= "Unknown";
            }
        }

        openHelpshiftWithData(basePayload, popup);
    }


    function collectCurrentWayspotData() {
        let guid = null;
        let title = null;
        let lat = null;
        let lng = null;
        let status = null;
        let description = null;
        let imageUrl = null;
        let isCommunityContributed = null;

        const bridge = document.getElementById('wfmapmods-poi-bridge');

        if (!bridge) {
            console.warn('[Report Wayspot] POI bridge element #wfmapmods-poi-bridge not found.');
        } else {
            const payloadAttr = bridge.getAttribute('data-payload');

            if (payloadAttr) {
                const jsonStr = payloadAttr
                .replace(/&quot;/g, '"')
                .replace(/&amp;/g, '&');

                try {
                    const payload = JSON.parse(jsonStr);

                    if (payload && typeof payload === 'object') {
                        if (typeof payload.guid === "string") guid = payload.guid;
                        if (typeof payload.title === "string") title = payload.title;
                        if (typeof payload.description === "string") description = payload.description;
                        if (typeof payload.imageUrl === "string") imageUrl = payload.imageUrl;
                        if (payload.status) status = payload.status;
                        if (payload.lat !== undefined) lat = payload.lat;
                        if (payload.lng !== undefined) lng = payload.lng;
                        if (typeof payload.isCommunityContributed === "boolean") {
                            isCommunityContributed = payload.isCommunityContributed;
                        }
                    }
                } catch (err) {
                    console.warn('[Report Wayspot] Failed to parse data-payload JSON:', err);
                }
            } else {
                console.warn('[Report Wayspot] #wfmapmods-poi-bridge has no data-payload attribute.');
            }
        }

        const latNum = (typeof lat === "number" && Number.isFinite(lat)) ? lat : null;
        const lngNum = (typeof lng === "number" && Number.isFinite(lng)) ? lng : null;

        return {
            name: null,
            email: null,
            preferredLanguage: null,

            address: null,
            city: null,
            state: null,
            country: null,
            postcode: null,
            addressString: null,

            guid,
            title,
            lat: latNum,
            lng: lngNum,
            description,
            imageUrl,
            status,
            isCommunityContributed,
        };
    }

    // If you decide to use this later, it now just reuses the same pattern
    function openHelpshiftWithData(data, popup) {
        const payload = Object.assign({ timestamp: Date.now() }, data || {});
        lastReportPayload = payload;

        if (popup) {
            popup.location.href = REPORT_URL;
        } else {
            // fallback if popup was blocked or null
            window.location.href = REPORT_URL;
        }
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
    // AddressString backfill (rate-limited reverse geocode)
    // ======================================================================

    const WFMM_ADDR_BACKFILL = {
        running: false,
        abortToken: null,
    };

    function sleep(ms) {
        return new Promise(r => setTimeout(r, ms));
    }

    function isMissingAddressString(rec) {
        // "doesn't exist at all for the record" + also treat empty/whitespace as missing
        if (!rec || typeof rec !== "object") return false;

        if (!("addressString" in rec)) return true;

        const v = rec.addressString;
        if (v == null) return true;
        if (typeof v !== "string") return true;
        if (!v.trim()) return true;

        return false;
    }

    function getCoordsForAddressBackfill(rec) {
        // Use the "effective" coords: prefer new coords if present
        const { lat, lng } = getEffectiveCoords(rec);
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
        return { lat, lng };
    }

    async function backfillMissingAddressStrings({
        records,
        onPatched,          // optional callback per successful patch
        onDone,             // optional callback once complete
        delayMs = 5000,
        timeoutMs = 10000,
        abortToken,
    } = {}) {
        if (!Array.isArray(records) || !records.length) return;

        // Build a stable list of candidates (missing address only)
        const todo = records.filter(r => isMissingAddressString(r) && r?.id);

        for (const rec of todo) {
            if (abortToken?.aborted) break;

            // Re-check right before doing work (record might have been patched already)
            if (!isMissingAddressString(rec)) continue;

            const coords = getCoordsForAddressBackfill(rec);
            if (!coords) continue;

            try {
                const results = await pageReverseGeocode(coords.lat, coords.lng, timeoutMs);

                // You already have scoring/parsing; we only need formatted_address
                const best = extractBestAddress(results);
                const formatted = (best && typeof best.formatted === "string") ? best.formatted.trim() : "";

                if (formatted) {
                    // Patch ONLY if still missing right now
                    if (isMissingAddressString(rec)) {
                        const ok = await patchReportedWayspotInIDB(rec.id, { addressString: formatted });
                        if (ok) {
                            // Update in-memory copies so UI/logic sees it immediately
                            rec.addressString = formatted;
                            const cached = WFMM_CACHE.byId.get(rec.id);
                            if (cached) cached.addressString = formatted;

                            if (typeof onPatched === "function") onPatched(rec.id, formatted);
                        }
                    }
                }
            } catch (e) {
                // Don’t fail the whole run; just continue
                console.warn("[WFMM] address backfill failed for", rec?.id, e);
            }

            // Rate limit: one every 5 seconds
            if (abortToken?.aborted) break;
            await sleep(delayMs);
        }

        if (typeof onDone === "function") onDone();
    }

    function startAddressBackfillForModal(ctx) {
        if (!ctx || !Array.isArray(ctx.allReports)) return;

        // Only run one backfill worker at a time globally
        if (WFMM_ADDR_BACKFILL.running) return;

        WFMM_ADDR_BACKFILL.running = true;
        const token = { aborted: false };
        WFMM_ADDR_BACKFILL.abortToken = token;

        // Optional: you can show progress in console, or update UI after patches
        backfillMissingAddressStrings({
            records: ctx.allReports,
            delayMs: 5000,
            timeoutMs: 10000,
            abortToken: token,
            onPatched: () => {
                // If addresses impact filtering or display, re-apply filters so it appears.
                // This is safe but may be a bit “chatty” if many patches; you can debounce if you want.
                try {
                    applyFiltersAndRender(ctx);
                    updateSortIndicators(ctx);
                } catch {}
            },
            onDone: () => {
                WFMM_ADDR_BACKFILL.running = false;
                WFMM_ADDR_BACKFILL.abortToken = null;
            }
        }).catch((e) => {
            console.warn("[WFMM] address backfill worker crashed:", e);
            WFMM_ADDR_BACKFILL.running = false;
            WFMM_ADDR_BACKFILL.abortToken = null;
        });
    }

    function stopAddressBackfill() {
        const t = WFMM_ADDR_BACKFILL.abortToken;
        if (t) t.aborted = true;
        WFMM_ADDR_BACKFILL.abortToken = null;
        WFMM_ADDR_BACKFILL.running = false;
    }

    // ======================================================================
    // Reporting History Modal
    // ======================================================================

    function openReportingHistoryModal() {
        // Avoid duplicates
        if (document.getElementById(REPORT_HISTORY_MODAL_ID)) return;

        openModal({
            id: REPORT_HISTORY_MODAL_ID,
            title: "Reporting History",
            width: 720,
            showFooterButtons: false,
            buildContent: (dialog, _okBtn, closeModal) => {
                const ctx = {
                    closeModal,
                    allReports: [],
                    page: 0,
                    pageSize: REPORT_HISTORY_PAGE_SIZE,
                    sortKey: "timestampMs",
                    sortDir: "desc", // default: most recent first
                    tableBody: null,
                    pageInfoEl: null,
                    prevBtn: null,
                    nextBtn: null,
                    loadingWrap: null,
                    emptyWrap: null,
                    showTicket: true,
                    columns: null,
                    thead: null,
                    viewReports: [],
                    filters: {
                        flag: "all",
                        status: "all",
                        title: "",
                        ticket: "",
                        address: ""
                    },
                    filterEls: null,
                    openDetailsId: null,
                };

                WFMM_REPORTING_HISTORY_CTX = ctx;

                // make sure we clear it on close
                const origClose = closeModal;
                ctx.closeModal = () => {
                    try { WFMM_REPORTING_HISTORY_CTX = null; } catch {}
                    try { stopAddressBackfill(); } catch {}
                    origClose();
                };

                // Layout wrapper
                const wrap = document.createElement("div");
                wrap.className = "wfmapmods-reporting-wrap";

                // Top controls row: Close button
                const topRow = document.createElement("div");
                topRow.className = "wfmapmods-reporting-top-row";

                const hint = document.createElement("div");
                hint.className = "wfmapmods-reporting-text-sm";
                hint.textContent = "Click a row to view details. Click 🔍 to fly to that location and update status.";
                topRow.appendChild(hint);

                wrap.appendChild(topRow);

                // Loading state
                const loadingWrap = document.createElement("div");
                loadingWrap.className = "wfmapmods-reporting-loading-wrap";

                const spinner = document.createElement("div");
                spinner.className = "wfmapmods-reporting-spinner";
                loadingWrap.appendChild(spinner);

                const loadingText = document.createElement("div");
                loadingText.className = "wfmapmods-reporting-text-sm";
                loadingText.textContent = "Loading report history…";
                loadingWrap.appendChild(loadingText);

                ctx.loadingWrap = loadingWrap;
                wrap.appendChild(loadingWrap);

                // Empty state
                const emptyWrap = document.createElement("div");
                emptyWrap.className = "wfmapmods-reporting-empty-wrap wfmapmods-reporting-text-sm";
                emptyWrap.textContent = "No reports found.";
                ctx.emptyWrap = emptyWrap;
                wrap.appendChild(emptyWrap);

                // Filters row (above table)
                wrap.appendChild(buildFiltersRow(ctx));

                // Table
                const table = document.createElement("table");
                table.className = "wfmapmods-reporting-table";
                ctx.tableEl = table;

                const thead = document.createElement("thead");
                ctx.thead = thead;
                table.appendChild(thead);

                const tbody = document.createElement("tbody");
                ctx.tableBody = tbody;
                table.appendChild(tbody);

                wrap.appendChild(table);

                // Pager row
                const pager = document.createElement("div");
                pager.className = "wfmapmods-reporting-pager";

                const left = document.createElement("div");
                left.className = "wfmapmods-reporting-pager-left";

                const prevBtn = document.createElement("button");
                prevBtn.type = "button";
                prevBtn.className = "wfmapmods-reporting-btn";
                prevBtn.textContent = "Previous";
                prevBtn.addEventListener("click", () => {
                    if (ctx.page <= 0) return;
                    ctx.page--;
                    renderReportingHistory(ctx);
                });

                const nextBtn = document.createElement("button");
                nextBtn.type = "button";
                nextBtn.className = "wfmapmods-reporting-btn";
                nextBtn.textContent = "Next";
                nextBtn.addEventListener("click", () => {
                    const totalPages = getTotalPages((ctx.viewReports || []).length, ctx.pageSize);
                    if (ctx.page + 1 >= totalPages) return;
                    ctx.page++;
                    renderReportingHistory(ctx);
                });

                ctx.prevBtn = prevBtn;
                ctx.nextBtn = nextBtn;

                left.appendChild(prevBtn);
                left.appendChild(nextBtn);

                const pageInfo = document.createElement("div");
                pageInfo.className = "wfmapmods-reporting-text-sm";
                ctx.pageInfoEl = pageInfo;

                const center = document.createElement("div");
                center.className = "wfmapmods-reporting-pager-center";
                center.appendChild(pageInfo);

                const right = document.createElement("div");
                right.className = "wfmapmods-reporting-pager-right";

                const exportBtn = document.createElement("button");
                exportBtn.type = "button";
                exportBtn.className = "wfmapmods-reporting-btn";
                exportBtn.textContent = "Export 0 Reports to CSV";
                exportBtn.addEventListener("click", () => exportReportsToCsv(ctx));

                ctx.exportBtn = exportBtn; // keep your existing update logic
                right.appendChild(exportBtn);

                pager.appendChild(left);
                pager.appendChild(center);
                pager.appendChild(right);

                wrap.appendChild(pager);


                dialog.appendChild(wrap);

                // Async load
                loadAllReportedWayspotsFromIDB()
                    .then((reports) => {
                    ctx.allReports = (Array.isArray(reports) ? reports : []).map(normalizeReportRecord);

                    // Decide whether to show Ticket column:
                    // show only if ANY record has a non-empty ticket string
                    ctx.showTicket = ctx.allReports.some(r => typeof r?.ticket === "string" && r.ticket.trim().length > 0);

                    // Build columns + header now that we know showTicket
                    buildReportingHistoryColumns(ctx);
                    buildReportingHistoryHeader(ctx);

                    // Hide loading
                    if (ctx.loadingWrap) ctx.loadingWrap.style.display = "none";

                    // Empty state check uses *allReports* (raw data)
                    if (!ctx.allReports.length) {
                        if (ctx.emptyWrap) ctx.emptyWrap.style.display = "";
                        ctx.viewReports = [];
                        renderReportingHistory(ctx);
                        return;
                    }

                    // Not empty → hide empty message and render filtered/sorted view
                    if (ctx.emptyWrap) ctx.emptyWrap.style.display = "none";
                    applyFiltersAndRender(ctx);

                    // Kick off background backfill for missing addressString (1 every 5 seconds)
                    startAddressBackfillForModal(ctx);
                })
                    .catch((err) => {
                    console.warn("[Base] Failed to load reporting history:", err);
                    if (ctx.loadingWrap) ctx.loadingWrap.style.display = "none";
                    if (ctx.emptyWrap) {
                        ctx.emptyWrap.textContent = "Could not load report history (see console).";
                        ctx.emptyWrap.style.display = "";
                    }
                });

                return ctx;
            },
        });
    }

    // ======================================================================
    // Modal Framework
    // ======================================================================

    function openModal({ id, title, buildContent, onOk, width, showFooterButtons }) {
        if (document.getElementById(id)) return;

        const backdrop = document.createElement("div");
        backdrop.id = id;
        backdrop.className = "wfmapmods-reporting-backdrop";

        const dialog = document.createElement("div");
        dialog.className = "wfmapmods-reporting-dialog wfmapmods-reporting-dialog--flex";

        if (typeof width === "number") {
            dialog.style.width = width + "px";
            dialog.style.maxWidth = "min(96vw," + width + "px)";
        }

        const header = document.createElement("div");
        header.className = "wfmapmods-reporting-title";
        header.textContent = title || "";
        dialog.appendChild(header);

        let okBtn = null;
        let cancelBtn = null;
        let ctx = null;
        let closed = false;

        function closeModal() {
            if (closed) return;
            closed = true;
            document.removeEventListener("keydown", escHandler);
            backdrop.remove();
            ctx = null;
        }

        function escHandler(ev) {
            if (ev.key === "Escape") {
                ev.stopPropagation();
                closeModal();
            }
        }

        let footer = null;
        if (showFooterButtons !== false) {
            footer = document.createElement("div");
            footer.className = "wfmapmods-reporting-footer";

            cancelBtn = document.createElement("button");
            cancelBtn.type = "button";
            cancelBtn.textContent = "Cancel";
            cancelBtn.className = "wfmapmods-reporting-btn";

            okBtn = document.createElement("button");
            okBtn.type = "button";
            okBtn.textContent = "OK";
            okBtn.className = "wfmapmods-reporting-btn wfmapmods-reporting-btn-primary";

            cancelBtn.addEventListener("click", closeModal);
            okBtn.addEventListener("click", () => {
                if (onOk) onOk(ctx, closeModal);
            });

            footer.appendChild(cancelBtn);
            footer.appendChild(okBtn);
        }

        // Let caller build the content
        ctx = buildContent ? buildContent(dialog, okBtn, closeModal) : null;

        if (footer) dialog.appendChild(footer);

        // Backdrop click close (simple + safe)
        backdrop.addEventListener("pointerdown", (ev) => {
            if (ev.target === backdrop) backdrop.__wfmmDown = true;
        });
        backdrop.addEventListener("pointerup", (ev) => {
            if (backdrop.__wfmmDown && ev.target === backdrop) closeModal();
            backdrop.__wfmmDown = false;
        });
        backdrop.addEventListener("pointercancel", () => {
            backdrop.__wfmmDown = false;
        });

        document.addEventListener("keydown", escHandler);

        backdrop.appendChild(dialog);
        document.body.appendChild(backdrop);

        return { closeModal };
    }

    // ======================================================================
    // Reporting History UI Builders
    // ======================================================================

    function buildReportingHistoryColumns(ctx) {
        ctx.columns = [
            { key: "flagged", label: "★", align: "center", width: "45px", minWidth: 45 },
            { key: "title", label: "Title", align: "left", width: "53%" },
            { key: "timestampMs", label: "Reported", align: "left", width: "18%" },
            { key: "lastKnownStatus", label: "Status", align: "left", width: "14%" },
            { key: "__go", label: "", align: "center", width: "8%", noSort: true },
        ];
    }

    function buildReportingHistoryHeader(ctx) {
        const thead = ctx?.thead;
        const columns = ctx?.columns;
        if (!thead || !Array.isArray(columns)) return;

        thead.innerHTML = "";
        const headRow = document.createElement("tr");

        for (const col of columns) {
            const th = document.createElement("th");
            th.textContent = col.label;
            th.className = "wfmapmods-reporting-th" + (!col.noSort ? " wfmapmods-reporting-th--sortable" : "");

            th.style.width = col.width;
            if (col.minWidth) th.style.minWidth = col.minWidth + "px";
            th.style.textAlign = col.align;

            if (!col.noSort) {
                th.style.cursor = "pointer";
                th.title = "Sort";

                th.addEventListener("click", () => {
                    if (ctx.sortKey === col.key) {
                        ctx.sortDir = (ctx.sortDir === "asc") ? "desc" : "asc";
                    } else {
                        ctx.sortKey = col.key;
                        // reasonable defaults per column
                        if (col.key === "timestampMs") ctx.sortDir = "desc";
                        else if (col.key === "flagged") ctx.sortDir = "desc"; // flagged first
                        else if (col.key === "lastKnownStatus") ctx.sortDir = "asc"; // Live→Modified→Retired
                        else ctx.sortDir = "asc";
                    }

                    ctx.page = 0;
                    ctx.openDetailsId = null; // collapse on sort to avoid weirdness
                    applyFiltersAndRender(ctx);
                    updateSortIndicators(ctx);
                });
            }

            headRow.appendChild(th);
        }

        thead.appendChild(headRow);
        updateSortIndicators(ctx);
    }

    function updateSortIndicators(ctx) {
        const thead = ctx?.thead;
        const columns = ctx?.columns;
        if (!thead || !Array.isArray(columns)) return;

        const ths = [...thead.querySelectorAll("th")];

        for (let i = 0; i < ths.length; i++) {
            const th = ths[i];
            const col = columns[i];
            if (!col) continue;

            th.textContent = col.label;

            if (!col.noSort && col.key === ctx.sortKey) {
                th.textContent = col.label + (ctx.sortDir === "asc" ? " ▲" : " ▼");
            }
        }
    }

    function buildFiltersRow(ctx) {
        const row = document.createElement("div");
        row.className = "wfmapmods-reporting-filters";

        const mkLabel = (txt) => {
            const l = document.createElement("span");
            l.textContent = txt;
            l.className = "wfmapmods-reporting-label";
            return l;
        };

        const starLabel = mkLabel("Star:");
        const flagSel = document.createElement("select");
        flagSel.className = "wfmapmods-reporting-btn wfmapmods-reporting-select";
        for (const [val, lab] of [["all", "All"], ["on", "Starred"], ["off", "Not starred"]]) {
            const o = document.createElement("option");
            o.value = val;
            o.textContent = lab;
            flagSel.appendChild(o);
        }

        const statusLabel = mkLabel("Status:");
        const statusSel = document.createElement("select");
        statusSel.className = "wfmapmods-reporting-btn wfmapmods-reporting-select";
        for (const [val, lab] of [["all", "All"], ["Live", "Live"], ["Modified", "Modified"], ["Retired", "Retired"]]) {
            const o = document.createElement("option");
            o.value = val;
            o.textContent = lab;
            statusSel.appendChild(o);
        }

        const titleLabel = mkLabel("Title:");
        const titleInput = document.createElement("input");
        titleInput.type = "text";
        titleInput.placeholder = "contains…";
        titleInput.className = "wfmapmods-reporting-input";

        const ticketLabel = mkLabel("Ticket Number:");
        const ticketInput = document.createElement("input");
        ticketInput.type = "text";
        ticketInput.placeholder = "contains…";
        ticketInput.className = "wfmapmods-reporting-input wfmapmods-reporting-input--ticket";

        const addressLabel = mkLabel("Address:");
        const addressInput = document.createElement("input");
        addressInput.type = "text";
        addressInput.placeholder = "contains…";
        addressInput.className = "wfmapmods-reporting-input";

        const clearBtn = document.createElement("button");
        clearBtn.type = "button";
        clearBtn.className = "wfmapmods-reporting-btn";
        clearBtn.textContent = "Clear filters";

        const apply = () => {
            ctx.filters.flag = flagSel.value;
            ctx.filters.status = statusSel.value;
            ctx.filters.title = titleInput.value || "";
            ctx.filters.ticket = ticketInput.value || "";
            ctx.filters.address = addressInput.value || "";
            ctx.page = 0;
            ctx.openDetailsId = null;
            applyFiltersAndRender(ctx);
            updateSortIndicators(ctx);
        };

        flagSel.addEventListener("change", apply);
        statusSel.addEventListener("change", apply);

        let t = null;
        titleInput.addEventListener("input", () => {
            clearTimeout(t);
            t = setTimeout(apply, 150);
        });

        clearBtn.addEventListener("click", () => {
            flagSel.value = "all";
            statusSel.value = "all";
            titleInput.value = "";
            ticketInput.value = "";
            addressInput.value = "";
            apply();
        });

        ticketInput.addEventListener("input", () => {
            clearTimeout(t);
            t = setTimeout(apply, 150);
        });

        addressInput.addEventListener("input", () => {
            clearTimeout(t);
            t = setTimeout(apply, 150);
        });


        row.appendChild(starLabel);
        row.appendChild(flagSel);

        row.appendChild(titleLabel);
        row.appendChild(titleInput);

        row.appendChild(statusLabel);
        row.appendChild(statusSel);

        const fullRowBreak = () => {
            const br = document.createElement("div");
            br.className = "wfmapmods-reporting-row-break";
            return br;
        };

        row.appendChild(fullRowBreak());

        row.appendChild(ticketLabel);
        row.appendChild(ticketInput);

        row.appendChild(addressLabel);
        row.appendChild(addressInput);

        const spacer = document.createElement("div");
        spacer.className = "wfmapmods-reporting-filters-spacer";
        row.appendChild(spacer);

        row.appendChild(clearBtn);

        ctx.filterEls = { flagSel, statusSel, titleInput, clearBtn };
        return row;
    }

    function buildDetailsBlock(rec) {
        const wrap = document.createElement("div");
        wrap.className = "wfmapmods-reporting-details";

        // Row container: image (left) + details (right)
        const row = document.createElement("div");
        row.className = "wfmapmods-reporting-details-row";

        // LEFT: Image (optional)
        if (rec.imageUrl) {
            const imgWrap = document.createElement("div");
            imgWrap.className = "wfmapmods-reporting-details-imgwrap";

            const link = document.createElement("a");
            link.href = rec.imageUrl + "=s0";
            link.target = "_blank";
            link.rel = "noopener noreferrer";

            const img = document.createElement("img");
            img.src = rec.imageUrl + "=s120-c";
            img.className = "wfmapmods-reporting-details-img";

            link.appendChild(img);
            imgWrap.appendChild(link);
            row.appendChild(imgWrap);
        }

        // RIGHT: Details grid
        const detailsCol = document.createElement("div");
        detailsCol.className = "wfmapmods-reporting-details-col";

        const grid = document.createElement("div");
        grid.className = "wfmapmods-reporting-details-grid";

        const addRow = (label, value) => {
            if (value == null || value === "") return;

            const k = document.createElement("div");
            k.textContent = label;
            k.className = "wfmapmods-reporting-details-k";

            const v = document.createElement("div");
            v.textContent = value;
            v.className = "wfmapmods-reporting-details-v";

            grid.appendChild(k);
            grid.appendChild(v);
        };

        // Row order
        addRow("Ticket", rec.ticket);
        addRow("New Title", rec.title_new);
        addRow("Description", rec.description);
        addRow("New Description", rec.description_new);

        const coords =
              (typeof rec.lat === "number" && typeof rec.lng === "number")
        ? `${rec.lat.toFixed(6)}, ${rec.lng.toFixed(6)}`
        : null;
        addRow("Coordinates", coords);

        if (typeof rec.lat_new === "number" && typeof rec.lng_new === "number") {
            addRow("New Coordinates", `${rec.lat_new.toFixed(6)}, ${rec.lng_new.toFixed(6)}`);
        }

        addRow("Address", rec.addressString);
        addRow("Removal Reason", rec.removalReasonText);
        addRow("Supporting Text", rec.supportingText);

        const mechanismLabel =
              rec.reportMechanism === "wayfarer-map"
        ? "Wayfarer Map"
        : rec.reportMechanism === "pgo-locations-web"
        ? "Web Form"
        : rec.reportMechanism;

        addRow("Report Mechanism", mechanismLabel);

        // Last Seen (fallback to timestampMs)
        const lastSeenMs =
              (typeof rec.lastSeenMs === "number" && Number.isFinite(rec.lastSeenMs))
        ? rec.lastSeenMs
        : ((typeof rec.timestampMs === "number" && Number.isFinite(rec.timestampMs))
           ? rec.timestampMs
           : null);

        addRow("Last Seen", lastSeenMs != null ? formatDateTime(lastSeenMs) : null);

        // First Noticed Missing (only if exists)
        if (typeof rec.firstNoticedMissingMs === "number" && Number.isFinite(rec.firstNoticedMissingMs)) {
            addRow("First Noticed Missing", formatDateTime(rec.firstNoticedMissingMs));
        }

        detailsCol.appendChild(grid);
        row.appendChild(detailsCol);
        wrap.appendChild(row);

        return wrap;
    }

    function closeOpenDetailsRow(ctx, tbody) {
        if (!ctx?.openDetailsId || !tbody) return;

        const id = ctx.openDetailsId;

        const main = tbody.querySelector(
            `tr.wfmm-reporting-main-row[data-rec-id="${cssEscape(id)}"]`
        );
        const details = tbody.querySelector(
            `tr.${WFMM_DETAILS_ROW_CLASS}[data-rec-id="${cssEscape(id)}"]`
        );

        if (details) details.style.display = "none";
        if (main) {
            main.classList.remove("wfmm-expanded");
            if (main.__wfmmExpBtn) main.__wfmmExpBtn.textContent = "▸";
        }

        ctx.openDetailsId = null;
    }

    // ======================================================================
    // Reporting History Rendering & Actions
    // ======================================================================

    function applyFiltersAndRender(ctx) {
        const all = Array.isArray(ctx.allReports) ? ctx.allReports : [];
        const f = ctx.filters || { flag: "all", status: "all", title: "" };

        const titleNeedle = (f.title || "").trim().toLowerCase();
        const ticketNeedle = (f.ticket || "").trim().toLowerCase();
        const addressNeedle = (f.address || "").trim().toLowerCase();

        let out = all.filter(rec => {
            if (!rec || typeof rec !== "object") return false;

            // flag filter
            if (f.flag === "on" && !rec.flagged) return false;
            if (f.flag === "off" && rec.flagged) return false;

            // status filter
            if (f.status && f.status !== "all") {
                const s = (rec.lastKnownStatus || "Live");
                if (s !== f.status) return false;
            }

            // title contains filter
            if (titleNeedle) {
                const t = (typeof rec.title === "string" ? rec.title : "").toLowerCase();
                if (!t.includes(titleNeedle)) return false;
            }

            // ticket filter
            if (ticketNeedle) {
                const t = (typeof rec.ticket === "string" ? rec.ticket : "").toLowerCase();
                if (!t.includes(ticketNeedle)) return false;
            }

            // address filter
            if (addressNeedle) {
                const a = (typeof rec.addressString === "string" ? rec.addressString : "").toLowerCase();
                if (!a.includes(addressNeedle)) return false;
            }

            return true;
        });

        // sort filtered view
        sortReportsInPlace(out, ctx.sortKey, ctx.sortDir);

        ctx.viewReports = out;

        // clamp page
        const totalPages = getTotalPages(out.length, ctx.pageSize);
        if (ctx.page >= totalPages) ctx.page = Math.max(0, totalPages - 1);

        renderReportingHistory(ctx);

        if (ctx.exportBtn) {
            ctx.exportBtn.textContent = `Export to CSV`;
        }
    }

    function renderReportingHistory(ctx) {
        const tbody = ctx?.tableBody;
        if (!tbody) return;

        tbody.innerHTML = "";

        const list = Array.isArray(ctx.viewReports) ? ctx.viewReports : [];

        const total = list.length;
        const totalPages = getTotalPages(total, ctx.pageSize);
        const page = Math.min(Math.max(0, ctx.page), Math.max(0, totalPages - 1));
        ctx.page = page;

        const start = page * ctx.pageSize;
        const end = Math.min(total, start + ctx.pageSize);
        const slice = list.slice(start, end);

        // helper: detect selection (Range means user highlighted text)
        const hasTextSelection = () => {
            try {
                const sel = window.getSelection?.();
                return !!(sel && sel.type === "Range" && String(sel).trim().length > 0);
            } catch {
                return false;
            }
        };

        for (const rec of slice) {
            const recId = rec?.id || "";
            const title = (typeof rec?.title === "string" && rec.title.trim()) ? rec.title.trim() : "(untitled)";
            const lat = (typeof rec?.lat === "number" && Number.isFinite(rec.lat)) ? rec.lat : null;
            const lng = (typeof rec?.lng === "number" && Number.isFinite(rec.lng)) ? rec.lng : null;

            const coords = (lat !== null && lng !== null) ? `${lat.toFixed(6)},${lng.toFixed(6)}` : "—";
            const ticket = (typeof rec?.ticket === "string" && rec.ticket.trim()) ? rec.ticket.trim() : null;
            const reason = (typeof rec?.removalReasonText === "string" && rec.removalReasonText.trim()) ? rec.removalReasonText.trim() : "—";
            const supportingRaw = (typeof rec?.supportingText === "string") ? rec.supportingText.trim() : "";
            const supporting = supportingRaw ? supportingRaw : null;

            const reportDate = (typeof rec?.timestampMs === "number" && Number.isFinite(rec.timestampMs))
            ? formatDateOnly(rec.timestampMs)
            : "—";

            const status = (typeof rec?.lastKnownStatus === "string" && rec.lastKnownStatus)
            ? rec.lastKnownStatus
            : "Live";

            const lastSeenMs = (typeof rec?.lastSeenMs === "number" && Number.isFinite(rec.lastSeenMs))
            ? rec.lastSeenMs
            : (typeof rec?.timestampMs === "number" && Number.isFinite(rec.timestampMs) ? rec.timestampMs : null);

            // MAIN ROW
            const trMain = document.createElement("tr");
            trMain.className = "wfmm-reporting-main-row wfmapmods-reporting-row-main";
            trMain.dataset.recId = recId;

            // drag detection (for click vs drag-select)
            let down = null;
            const DRAG_PX = 6;

            trMain.addEventListener("pointerdown", (ev) => {
                // only left click / primary pointer
                if (ev.button !== 0) return;
                down = { x: ev.clientX, y: ev.clientY, dragged: false };
            });

            trMain.addEventListener("pointermove", (ev) => {
                if (!down) return;
                const dx = ev.clientX - down.x;
                const dy = ev.clientY - down.y;
                if (Math.hypot(dx, dy) >= DRAG_PX) down.dragged = true;
            });

            trMain.addEventListener("pointerup", () => {
                // keep down until click handler runs
                // (we'll clear it there)
            });

            const toggleDetailsForThisRow = () => {
                if (!recId) return;

                // do not toggle if user is selecting text
                if (hasTextSelection()) return;

                // do not toggle if this was a drag
                if (down?.dragged) return;

                // close other open row first
                if (ctx.openDetailsId && ctx.openDetailsId !== recId) {
                    closeOpenDetailsRow(ctx, tbody);
                }

                const isOpen = (ctx.openDetailsId === recId) && (trDetails.style.display !== "none");

                if (isOpen) {
                    trDetails.style.display = "none";
                    trMain.classList.remove("wfmm-expanded");
                    if (trMain.__wfmmExpBtn) trMain.__wfmmExpBtn.textContent = "▸";
                    ctx.openDetailsId = null;
                } else {
                    trDetails.style.display = "";
                    trMain.classList.add("wfmm-expanded");
                    if (trMain.__wfmmExpBtn) trMain.__wfmmExpBtn.textContent = "▾";
                    ctx.openDetailsId = recId;
                }
            };

            // 1) Star (bigger)
            {
                const tdFlag = document.createElement("td");
                tdFlag.className =
                    "wfmapmods-reporting-cell wfmapmods-reporting-align-center " +
                    "wfmapmods-reporting-cell--no-ellipsis wfmapmods-reporting-cell-flag";

                const btn = document.createElement("button");
                btn.type = "button";
                btn.className = "wfmapmods-reporting-btn wfmapmods-reporting-btn--star";

                const setStar = (flagged) => {
                    btn.textContent = flagged ? "★" : "☆";
                    btn.title = flagged ? "Unstar" : "Star";
                };
                setStar(!!rec.flagged);

                btn.addEventListener("click", async (ev) => {
                    ev.stopPropagation();

                    const next = !rec.flagged;
                    rec.flagged = next;
                    setStar(next);

                    const ok = await patchReportedWayspotInIDB(rec.id, { flagged: next });
                    if (!ok) {
                        rec.flagged = !next;
                        setStar(rec.flagged);
                        return;
                    }

                    // IMPORTANT: avoid sudden reordering when sorted by stars.
                    // Only re-apply filters if the current filter would change membership.
                    const flagFilter = ctx.filters?.flag || "all";
                    const mustReFilter =
                          (flagFilter === "on" && !next) ||   // user unstarred, but filter wants starred-only
                          (flagFilter === "off" && next);     // user starred, but filter wants unstarred-only

                    if (mustReFilter) {
                        ctx.page = 0;
                        ctx.openDetailsId = null;
                        applyFiltersAndRender(ctx);
                        updateSortIndicators(ctx);
                    }
                    // else: do nothing (no resort, no rerender) -> row stays put
                });

                tdFlag.appendChild(btn);
                trMain.appendChild(tdFlag);
            }

            // 2) Title (row click expands; title stays selectable)
            {
                const tdTitle = document.createElement("td");
                tdTitle.className = "wfmapmods-reporting-cell wfmapmods-reporting-align-left";

                const titleSpan = document.createElement("span");
                titleSpan.textContent = title;
                titleSpan.className = "wfmapmods-reporting-title-selectable";

                tdTitle.appendChild(titleSpan);
                trMain.appendChild(tdTitle);
            }

            // 3) Report date
            trMain.appendChild(td(reportDate, "left"));

            // 4) Status (sortable key: lastKnownStatus)
            {
                const tdStatus = td(status, "left");
                if (lastSeenMs) tdStatus.title = "Last seen: " + formatDateTime(lastSeenMs);
                trMain.appendChild(tdStatus);
            }

            // 5) Magnifier (no toggle)
            {
                const tdGo = document.createElement("td");
                tdGo.className =
                    "wfmapmods-reporting-cell wfmapmods-reporting-align-center wfmapmods-reporting-cell--no-ellipsis";

                const goBtn = document.createElement("button");
                goBtn.type = "button";
                goBtn.className = "wfmapmods-reporting-btn wfmapmods-reporting-btn--go";
                goBtn.title = "Go to location";
                goBtn.innerHTML = magnifierSvg(14);

                const canGo = (lat !== null && lng !== null && typeof google !== "undefined" && google?.maps);
                if (!canGo) {
                    goBtn.disabled = true;
                    goBtn.title = "Map not ready / missing coordinates";
                } else {
                    goBtn.addEventListener("click", (ev) => {
                        ev.stopPropagation();
                        try {
                            const ll = new google.maps.LatLng(lat, lng);
                            flyToLatLngAndPlaceSubmission(ll);
                        } catch (e) {
                        } finally {
                            // Don't close the modal
                            // if (typeof ctx.closeModal === "function") ctx.closeModal();
                        }
                    });
                }

                tdGo.appendChild(goBtn);
                trMain.appendChild(tdGo);
            }

            // Row click toggles details (but not on drag-select or text selection)
            trMain.addEventListener("click", () => {
                try { down = down || { dragged: false }; } catch {}
                toggleDetailsForThisRow();
                down = null;
            });

            // DETAILS ROW
            const trDetails = document.createElement("tr");
            trDetails.className = WFMM_DETAILS_ROW_CLASS;
            trDetails.dataset.recId = recId;
            trDetails.style.display = "none";

            // allow copying in details without closing
            trDetails.addEventListener("click", (ev) => ev.stopPropagation());

            const tdDetails = document.createElement("td");
            tdDetails.colSpan = Array.isArray(ctx.columns) ? ctx.columns.length : 6;
            tdDetails.className = "wfmapmods-reporting-details-cell";

            tdDetails.appendChild(buildDetailsBlock(rec));
            trDetails.appendChild(tdDetails);

            // restore open state if needed
            if (ctx.openDetailsId && ctx.openDetailsId === recId) {
                trDetails.style.display = "";
                trMain.classList.add("wfmm-expanded");
                if (trMain.__wfmmExpBtn) trMain.__wfmmExpBtn.textContent = "▾";
            }

            tbody.appendChild(trMain);
            tbody.appendChild(trDetails);
        }

        // If open row not on this page anymore, clear it
        if (ctx.openDetailsId && !slice.some(r => r?.id === ctx.openDetailsId)) {
            ctx.openDetailsId = null;
        }

        // Pager state
        if (ctx.pageInfoEl) {
            if (total === 0) ctx.pageInfoEl.textContent = "0 reports";
            else ctx.pageInfoEl.textContent = `${start + 1}-${end} of ${total} (page ${page + 1}/${Math.max(1, totalPages)})`;
        }

        if (ctx.prevBtn) ctx.prevBtn.disabled = (page <= 0);
        if (ctx.nextBtn) ctx.nextBtn.disabled = (page + 1 >= totalPages);
    }

    function applyPatchToReportingHistoryModal(id, patch) {
        const ctx = WFMM_REPORTING_HISTORY_CTX;
        if (!ctx || !id || !patch) return;

        // Update master list
        const a = Array.isArray(ctx.allReports) ? ctx.allReports : [];
        const r1 = a.find(x => x && x.id === id);
        if (r1) Object.assign(r1, patch);

        // Update current view list (IMPORTANT: don't rebuild viewReports via filters)
        const v = Array.isArray(ctx.viewReports) ? ctx.viewReports : [];
        const r2 = v.find(x => x && x.id === id);
        if (r2 && r2 !== r1) Object.assign(r2, patch);

        // Debounced repaint of the current page only
        if (ctx.__wfmmLiveTimer) return;
        ctx.__wfmmLiveTimer = setTimeout(() => {
            ctx.__wfmmLiveTimer = null;
            try { renderReportingHistory(ctx); } catch {}
        }, 50);
    }

    function exportReportsToCsv(ctx) {
        const rows = Array.isArray(ctx.viewReports) ? ctx.viewReports : [];
        if (!rows.length) {
            alert("No reports to export.");
            return;
        }

        // Sort most recent -> oldest by timestampMs
        const sorted = [...rows].sort((a, b) => (b?.timestampMs ?? 0) - (a?.timestampMs ?? 0));

        // CSV escape helper
        const esc = (v) => {
            if (v === null || v === undefined) return "";
            const s = String(v);
            if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
            return s;
        };

        // ms -> YYYY-MM-DD (UTC). If you prefer local time, change toLocalDate below.
        const toYMD = (ms) => {
            if (ms === null || ms === undefined || ms === "") return "";
            const n = Number(ms);
            if (!Number.isFinite(n)) return "";
            return new Date(n).toISOString().slice(0, 10);
        };

        const mapLink = (lat, lng) => {
            if (!Number.isFinite(Number(lat)) || !Number.isFinite(Number(lng))) return "";
            // Note: you asked for ?${lat},${lng} (no param name). Keeping exactly that:
            return `https://wayfarer.nianticlabs.com/new/mapview?${lat},${lng}`;
        };

        // Define EXACT columns and order
        const columns = [
            { header: "Date",                 value: (r) => toYMD(r.timestampMs) },
            { header: "Ticket",               value: (r) => r.ticket },
            { header: "Guid",                 value: (r) => r.guid },
            { header: "Title",                value: (r) => r.title },
            { header: "Description",          value: (r) => r.description },
            { header: "Lat",                  value: (r) => r.lat },
            { header: "Lng",                  value: (r) => r.lng },
            { header: "Map link",             value: (r) => mapLink(r.lat, r.lng) },
            { header: "Image URL",            value: (r) => r.imageUrl },
            { header: "Removal reason",       value: (r) => r.removalReasonText },
            { header: "Supporting text",      value: (r) => r.supportingText },
            { header: "Report mechanism",     value: (r) => r.reportMechanism },
            { header: "Last known status",    value: (r) => r.lastKnownStatus },
            {
                header: "Last Seen",
                value: (r) => toYMD(r.lastSeenMs ?? r.timestampMs),
            },
            {
                header: "First noticed missing",
                value: (r) => toYMD(r.firstNoticedMissingMs),
            },
            { header: "flagged",              value: (r) => r.flagged },
        ];

        const headers = columns.map(c => c.header);

        const lines = [];
        lines.push(headers.map(esc).join(","));

        for (const rec of sorted) {
            lines.push(columns.map(c => esc(c.value(rec))).join(","));
        }

        const csv = "\uFEFF" + lines.join("\n"); // UTF-8 BOM for Excel

        // Download
        const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);

        const a = document.createElement("a");
        a.href = url;

        const ts = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
        a.download = `wfmapmods-report-history-${ts}.csv`;

        document.body.appendChild(a);
        a.click();

        setTimeout(() => {
            URL.revokeObjectURL(url);
            a.remove();
        }, 0);
    }

    // ======================================================================
    // Reporting History Data & Sorting
    // ======================================================================

    function normalizeReportRecord(r) {
        if (!r || typeof r !== "object") return r;

        if (typeof r.flagged !== "boolean") r.flagged = false;

        if (typeof r.lastKnownStatus !== "string" || !r.lastKnownStatus) {
            r.lastKnownStatus = "Live";
        }

        if (typeof r.lastSeenMs !== "number" || !Number.isFinite(r.lastSeenMs)) {
            r.lastSeenMs = (typeof r.timestampMs === "number" && Number.isFinite(r.timestampMs))
                ? r.timestampMs
            : Date.now();
        }

        return r;
    }

    /**
     * Sorts the FULL array in-place (not just the current page).
     * sortKey: "flagged" | "title" | "timestampMs" | "lastKnownStatus"
     * sortDir: "asc" | "desc"
     */
    function sortReportsInPlace(arr, sortKey, sortDir) {
        if (!Array.isArray(arr) || !arr.length) return;

        const key = sortKey || "timestampMs";
        const dir = (sortDir === "asc") ? 1 : -1;

        arr.sort((a, b) => {
            const av = getSortValue(a, key);
            const bv = getSortValue(b, key);

            // nulls last
            const aNull = (av === null || av === undefined);
            const bNull = (bv === null || bv === undefined);
            if (aNull && bNull) return 0;
            if (aNull) return 1;
            if (bNull) return -1;

            // string compare for any string-sort key
            if (typeof av === "string" || typeof bv === "string") {
                const as = String(av).toLowerCase();
                const bs = String(bv).toLowerCase();
                if (as < bs) return -1 * dir;
                if (as > bs) return 1 * dir;
                return 0;
            }

            // numeric compare
            const an = Number(av);
            const bn = Number(bv);
            if (!Number.isFinite(an) && !Number.isFinite(bn)) return 0;
            if (!Number.isFinite(an)) return 1;
            if (!Number.isFinite(bn)) return -1;
            return (an - bn) * dir;
        });
    }

    function getSortValue(rec, key) {
        if (!rec || typeof rec !== "object") return null;

        switch (key) {
            case "flagged":
                return rec.flagged ? 1 : 0;

            case "lastKnownStatus": {
                // define a stable ordering
                const s = (rec.lastKnownStatus || "Live");
                if (s === "Live") return 1;
                if (s === "Modified") return 2;
                if (s === "Retired") return 3;
                return 9;
            }

            case "title":
                return (typeof rec.title === "string") ? rec.title : "";

            case "timestampMs":
                return (typeof rec.timestampMs === "number" && Number.isFinite(rec.timestampMs)) ? rec.timestampMs : null;

            default:
                return null;
        }
    }

    function getTotalPages(totalItems, pageSize) {
        const n = Number(totalItems) || 0;
        const ps = Number(pageSize) || 1;
        return Math.max(1, Math.ceil(n / ps));
    }

    // ======================================================================
    // Formatting & DOM Helpers
    // ======================================================================

    function td(text, align) {
        const cell = document.createElement("td");
        cell.textContent = String(text ?? "");

        const a = (align === "center") ? "wfmapmods-reporting-align-center" : "wfmapmods-reporting-align-left";
        cell.className = `wfmapmods-reporting-cell ${a}`;

        return cell;
    }

    function formatDateOnly(timestampMs) {
        try {
            // system locale, date only
            return new Date(timestampMs).toLocaleDateString();
        } catch {
            return String(timestampMs);
        }
    }

    function formatDateTime(timestampMs) {
        try {
            return new Date(timestampMs).toLocaleString();
        } catch {
            return String(timestampMs);
        }
    }

    function magnifierSvg(sizePx = 14) {
        const s = Number(sizePx) || 14;
        // inline SVG (no external dependencies)
        return `
    <svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <circle cx="11" cy="11" r="7"></circle>
      <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
    </svg>
  `.trim();
    }

    function cssEscape(s) {
        // CSS.escape is not supported in all userscript environments
        const str = String(s ?? "");
        if (typeof CSS !== "undefined" && CSS.escape) return CSS.escape(str);
        return str.replace(/["\\#.;?+*~':!^$[\]()=>|/@]/g, "\\$&");
    }

    // ======================================================================
    // Geometry & Spatial Helpers
    // ======================================================================

    function haversineMeters(lat1, lng1, lat2, lng2) {
        const R = 6371000;
        const toRad = x => x * Math.PI / 180;

        const dLat = toRad(lat2 - lat1);
        const dLng = toRad(lng2 - lng1);

        const a =
              Math.sin(dLat / 2) ** 2 +
              Math.cos(toRad(lat1)) *
              Math.cos(toRad(lat2)) *
              Math.sin(dLng / 2) ** 2;

        return 2 * R * Math.asin(Math.sqrt(a));
    }

    function pointInBounds(lat, lng, bounds) {
        if (!bounds || !bounds.ne || !bounds.sw) return false;

        return (
            lat <= bounds.ne.lat &&
            lat >= bounds.sw.lat &&
            lng <= bounds.ne.lng &&
            lng >= bounds.sw.lng
        );
    }

    function getEffectiveCoords(rec) {
        if (typeof rec.lat_new === "number" && typeof rec.lng_new === "number") {
            return { lat: rec.lat_new, lng: rec.lng_new };
        }
        return { lat: rec.lat, lng: rec.lng };
    }

    // ======================================================================
    // Text Normalization
    // ======================================================================

    function normText(s) {
        if (s == null) return "";
        return String(s)
            .replace(/\s+/g, " ")
            .trim();
    }

    // ======================================================================
    // POI Observation & Reconciliation
    // ======================================================================

    async function observePois(pois) {
        await ensureCacheLoaded();
        if (!WFMM_CACHE.ready) return;

        for (const poi of pois) {
            const ids = WFMM_CACHE.byGuid.get(poi.guid);
            if (!ids) continue;

            for (const id of ids) {
                const rec = WFMM_CACHE.byId.get(id);
                if (rec) handleObservedPoiCached(rec, poi);
            }
        }
    }

    function handleObservedPoiCached(rec, poi) {
        const patch = {};
        let statusChange = null;

        // -------------------------
        // #0 — Backfill missing data
        // -------------------------
        const poiDesc = (typeof poi.description === "string") ? poi.description : "";
        const poiTitle = (typeof poi.title === "string") ? poi.title : "";
        const poiImg = (typeof poi.imageUrl === "string") ? poi.imageUrl : "";

        if (rec.description === undefined && normText(poiDesc)) patch.description = poiDesc;
        if (rec.imageUrl === undefined && normText(poiImg)) patch.imageUrl = poiImg;
        if (rec.isCommunityContributed == null && typeof poi.isCommunityContributed === "boolean") {
            patch.isCommunityContributed = poi.isCommunityContributed;
        }

        // Compute "effective old" values AFTER considering backfill patch
        const oldTitleEff = (patch.title ?? rec.title ?? "");
        const oldDescEff  = (patch.description ?? rec.description ?? "");

        const changes = {};

        // Title compare (normalized)
        if (normText(poiTitle) && normText(poiTitle) !== normText(oldTitleEff)) {
            changes.title_new = poiTitle;
        }

        // Description compare (normalized; allow empty)
        if (normText(poiDesc) !== normText(oldDescEff)) {
            changes.description_new = poiDesc;
        }

        // Location compare
        const { lat: oldLat, lng: oldLng } = getEffectiveCoords(rec);
        if (Number.isFinite(oldLat) && Number.isFinite(oldLng) && Number.isFinite(poi.lat) && Number.isFinite(poi.lng)) {
            const d = haversineMeters(oldLat, oldLng, poi.lat, poi.lng);
            if (d > 5) { // reduce GPS jitter
                changes.lat_new = poi.lat;
                changes.lng_new = poi.lng;
            }
        }

        // Only mark Modified if the change is real (and not just backfill)
        if (Object.keys(changes).length) {
            Object.assign(patch, changes);
            statusChange = "Modified";
        }

        // reinstatement rules (with stale gcs guard)
        if (rec.lastKnownStatus === "Retired") {
            const missingTs = (typeof rec.firstNoticedMissingMs === "number") ? rec.firstNoticedMissingMs : null;

            if (poi.source === "gcs" && missingTs != null && typeof poi.seenAtMs === "number" && poi.seenAtMs <= missingTs) {
                // stale gcs - don't change status
            } else {
                if (Number.isFinite(oldLat) && Number.isFinite(oldLng) && Number.isFinite(poi.lat) && Number.isFinite(poi.lng)) {
                    const d = haversineMeters(oldLat, oldLng, poi.lat, poi.lng);
                    if (d > 100) statusChange = "Modified";
                    else {
                        statusChange = "Reinstated";
                        patch.reinstatedMs = poi.seenAtMs;
                    }
                } else {
                    statusChange = "Reinstated";
                    patch.reinstatedMs = poi.seenAtMs;
                }
            }
        }

        // lastSeen bump (newer wins)
        if (typeof poi.seenAtMs === "number" && (!rec.lastSeenMs || poi.seenAtMs > rec.lastSeenMs)) {
            patch.lastSeenMs = poi.seenAtMs;
        }

        if (statusChange) patch.lastKnownStatus = statusChange;

        if (Object.keys(patch).length) enqueuePatch(rec.id, patch);
    }

    function markRetiredCached(rec, ts) {
        if (rec.firstNoticedMissingMs) return;
        enqueuePatch(rec.id, { lastKnownStatus: "Retired", firstNoticedMissingMs: ts });
    }

    function detectMissingFromGcsCached(gcsPois, bounds, responseTs) {
        const seen = new Set(gcsPois.map(p => p.guid));
        if (!bounds) return;

        for (const id of gridCandidatesInBounds(bounds)) {
            const rec = WFMM_CACHE.byId.get(id);
            if (!rec?.guid) continue;
            if (rec.lastKnownStatus === "Retired") continue;

            const { lat, lng } = getEffectiveCoords(rec);
            if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
            if (!pointInBounds(lat, lng, bounds)) continue; // keep exact check

            if (!seen.has(rec.guid)) {
                markRetiredCached(rec, responseTs);
            }
        }
    }

    function detectMissingFromLiveCached(livePois, center, radius) {
        const seen = new Set(livePois.map(p => p.guid));

        for (const id of gridCandidatesInRadius(center, radius)) {
            const rec = WFMM_CACHE.byId.get(id);
            if (!rec?.guid) continue;
            if (rec.isCommunityContributed !== true) continue;
            if (rec.lastKnownStatus === "Retired") continue;

            const { lat, lng } = getEffectiveCoords(rec);
            if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;

            // Exact circle test
            const d = haversineMeters(lat, lng, center.lat, center.lng);
            if (d <= radius && !seen.has(rec.guid)) {
                markRetiredCached(rec, Date.now());
            }
        }
    }

    // ======================================================================
    // Network Response Handlers
    // ======================================================================

    async function onLivePoisResponse(json) {
        await ensureCacheLoaded();
        if (!WFMM_CACHE.ready) return;

        const pois = (json?.result?.pois || []).map(p => ({
            guid: p.guid,
            title: p.title,
            description: p.description ?? "",
            imageUrl: p.imageUrl ?? "",
            lat: p.lat,
            lng: p.lng,
            seenAtMs: Date.now(),
            source: "live",
        }));

        observePois(pois);

        detectMissingFromLiveCached(
            pois,
            json.result.location,
            json.result.radius
        );
    }

    async function onGcsResponse(json, bounds) {
        await ensureCacheLoaded();
        if (!WFMM_CACHE.ready) return;

        const pois = [];
        let responseTs = 0;

        for (const cell of json?.result?.data || []) {
            const cellTs = Number(cell?.metadata?.generatedTimestamp);
            if (Number.isFinite(cellTs)) responseTs = Math.max(responseTs, cellTs);

            for (const p of cell.pois || []) {
                const lat = (typeof p.latE6 === "number") ? p.latE6 / 1e6 : null;
                const lng = (typeof p.lngE6 === "number") ? p.lngE6 / 1e6 : null;
                if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;

                // Use the cell timestamp as the last seen time
                const seenAtMs = Number.isFinite(cellTs) ? cellTs : Date.now();

                pois.push({
                    guid: p.poiId,
                    title: p.title,
                    description: p.description ?? "",
                    imageUrl: p.mainImage ?? "",
                    isCommunityContributed: p.isCommunityContributed,
                    lat, lng,
                    seenAtMs,
                    source: "gcs",
                });
            }
        }

        if (!responseTs) responseTs = Date.now();

        observePois(pois);
        detectMissingFromGcsCached(pois, bounds, responseTs);
    }


    // ======================================================================
    // Listen: GCS responses
    // ======================================================================

    function parseGcsBoundsFromUrl(url) {
        try {
            const u = new URL(url, location.origin);
            const neRaw = u.searchParams.get("ne");
            const swRaw = u.searchParams.get("sw");
            if (!neRaw || !swRaw) return null;

            const parsePair = (s) => {
                const m = String(s).match(/\(\s*([-\d.]+)\s*,\s*([-\d.]+)\s*\)/);
                if (!m) return null;
                return { lat: Number(m[1]), lng: Number(m[2]) };
            };

            const ne = parsePair(neRaw);
            const sw = parsePair(swRaw);
            if (!ne || !sw) return null;

            return { ne, sw };
        } catch {
            return null;
        }
    }

    (function installGcsXhrListener() {
        const origOpen = XMLHttpRequest.prototype.open;
        const origSend = XMLHttpRequest.prototype.send;

        XMLHttpRequest.prototype.open = function (method, url) {
            try { this.__wfmm_url = url; } catch {}
            return origOpen.apply(this, arguments);
        };

        XMLHttpRequest.prototype.send = function () {
            const url = String(this.__wfmm_url || "");

            if (url.includes(WFMM_GCS_ENDPOINT_PART)) {
                const bounds = parseGcsBoundsFromUrl(url);

                this.addEventListener("load", () => {
                    try {
                        if (this.status < 200 || this.status >= 300) return;
                        const json = JSON.parse(this.responseText);
                        if (json?.code && json.code !== "OK") return;
                        if (json?.result?.success === false) return;

                        onGcsResponse(json, bounds);
                    } catch (e) {
                        console.warn("WFMM - Reporting: GCS handler error:", e);
                    }
                });
            }

            return origSend.apply(this, arguments);
        };
    })();

    // ======================================================================
    // Listen: live-pois-in-radius responses
    // ======================================================================

    (function installLivePoisXhrListener() {
        const origOpen = XMLHttpRequest.prototype.open;
        const origSend = XMLHttpRequest.prototype.send;

        XMLHttpRequest.prototype.open = function (method, url) {
            try { this.__wfmm_url = url; } catch {}
            return origOpen.apply(this, arguments);
        };

        XMLHttpRequest.prototype.send = function () {
            try {
                const url = String(this.__wfmm_url || "");
                if (url.includes(WFMM_LIVE_POIS_ENDPOINT_PART)) {
                    this.addEventListener("load", () => {
                        try {
                            if (this.status < 200 || this.status >= 300) return;

                            const json = JSON.parse(this.responseText);
                            if (json?.code && json.code !== "OK") return;

                            onLivePoisResponse(json);
                        } catch (e) {
                            console.warn("WFMM - Reporting: live-pois-in-radious parse/handler error:", e);
                        }
                    });
                }
            } catch (e) {
                console.warn("WFMM - Reporting: Listener install error:", e);
            }

            return origSend.apply(this, arguments);
        };
    })();

    // ======================================================================
    // Attach to map
    // ======================================================================

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

    async function attachToMapIfNeeded() {
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

        ensurePulseOverlayClass();
        wfmmEnsurePulseLayer(wfMap);
        schedulePulseRefresh(0);
    }

    function teardownMap() {
        if (!mapAttached) return;
        wfMap = null;
        mapAttached = false;
    }

    // ======================================================================
    // Map Navigation
    // ======================================================================

    function flyToLatLngAndPlaceSubmission(latLng) {
        if (!wfMap || !latLng || typeof google === "undefined" || !google.maps) return;

        const lat = latLng.lat;
        const lng = latLng.lng;

        emitSubmitCoords(lat, lng, "mapview");
        // Center map
        wfMap.setCenter(latLng);

        // Ensure zoom
        const z = wfMap.getZoom();
        if (typeof z === "number" && z < GCS_MIN_ZOOM) {
            wfMap.setZoom(GCS_MIN_ZOOM);
        }

        // Allow map to settle before firing click
        google.maps.event.addListenerOnce(wfMap, "idle", () => {
            try {
                google.maps.event.trigger(wfMap, "click", { latLng });
            } catch (e) {
            }
        });
    }

    function emitSubmitCoords(lat, lng, source = "mapview") {
        window.dispatchEvent(new CustomEvent("wf:submit-coords", {
            detail: { lat, lng, source, ts: Date.now() }
        }));
    }

    // ======================================================================
    // Reported Wayspots Cache (in-memory)
    // ======================================================================

    const WFMM_CACHE = {
        ready: false,
        loading: null,
        loadedAtMs: 0,

        // guid -> Set(recordId)
        byGuid: new Map(),
        // recordId -> record object (we keep a mutable copy)
        byId: new Map(),
    };

    // How often to refresh from IDB (ms)
    const WFMM_CACHE_TTL_MS = 120_000; // 2 minutes

    function wfmmIndexRecord(rec) {
        if (!rec?.id || !rec?.guid) return;

        WFMM_CACHE.byId.set(rec.id, rec);

        let set = WFMM_CACHE.byGuid.get(rec.guid);
        if (!set) WFMM_CACHE.byGuid.set(rec.guid, (set = new Set()));
        set.add(rec.id);
    }

    function wfmmClearCache() {
        WFMM_CACHE.ready = false;
        WFMM_CACHE.byGuid.clear();
        WFMM_CACHE.byId.clear();
        WFMM_CACHE.loadedAtMs = 0;
    }

    function ensureCacheLoaded({ force = false } = {}) {
        if (WFMM_CACHE.loading) return WFMM_CACHE.loading;

        const stale = !WFMM_CACHE.ready || (Date.now() - WFMM_CACHE.loadedAtMs > WFMM_CACHE_TTL_MS);
        if (!force && !stale) return Promise.resolve(true);

        WFMM_CACHE.loading = loadAllReportedWayspotsFromIDB()
            .then((records) => {
            wfmmClearCache();
            gridClear();

            for (const r of (records || [])) {
                wfmmIndexRecord(r);
                gridAddOrMoveRecord(r);
            }

            if (wfMap) {
                wfmmEnsurePulseLayer(wfMap);
                schedulePulseRefresh(0);
            }

            WFMM_CACHE.ready = true;
            WFMM_CACHE.loadedAtMs = Date.now();
            return true;
        })
            .catch((e) => {
            console.warn("[WFMM] cache load failed:", e);
            return false;
        })
            .finally(() => {
            WFMM_CACHE.loading = null;
        });

        return WFMM_CACHE.loading;
    }

    // ======================================================================
    // Patch queue (coalesce per recordId)
    // ======================================================================

    const WFMM_PATCH_QUEUE = {
        pending: new Map(),   // id -> patch object
        flushTimer: null,
        flushDelayMs: 300,
    };

    function enqueuePatch(id, patch) {
        if (!id || !patch || typeof patch !== "object") return;

        const prev = WFMM_PATCH_QUEUE.pending.get(id);
        if (prev) Object.assign(prev, patch);
        else WFMM_PATCH_QUEUE.pending.set(id, { ...patch });

        if (!WFMM_PATCH_QUEUE.flushTimer) {
            WFMM_PATCH_QUEUE.flushTimer = setTimeout(flushPatches, WFMM_PATCH_QUEUE.flushDelayMs);
        }
    }

    async function flushPatches() {
        clearTimeout(WFMM_PATCH_QUEUE.flushTimer);
        WFMM_PATCH_QUEUE.flushTimer = null;

        const entries = Array.from(WFMM_PATCH_QUEUE.pending.entries());
        WFMM_PATCH_QUEUE.pending.clear();

        for (const [id, patch] of entries) {
            // Skip empty patch
            if (!patch || !Object.keys(patch).length) continue;

            const ok = await patchReportedWayspotInIDB(id, patch);
            if (!ok) continue;

            // Update in-memory copy so future logic uses latest values
            const rec = WFMM_CACHE.byId.get(id);
            if (rec) Object.assign(rec, patch);

            applyPatchToReportingHistoryModal(id, patch);

            // If coords can change, update pulse positions
            schedulePulseRefresh(50);
        }
    }

    // ======================================================================
    // Spatial index (grid buckets)
    // ======================================================================

    const WFMM_GRID = {
        // bucketKey -> Set(recordId)
        buckets: new Map(),
        // recordId -> bucketKey (so we can move it if coords change)
        idToBucket: new Map(),
    };

    // ~1.1km lat. Tweak if you want denser/sparser buckets.
    const GRID_DEG = 0.01;

    function bucketKeyForLatLng(lat, lng) {
        const x = Math.floor(lat / GRID_DEG);
        const y = Math.floor(lng / GRID_DEG);
        return `${x}:${y}`;
    }

    function gridAddOrMoveRecord(rec) {
        const { lat, lng } = getEffectiveCoords(rec);
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;

        const key = bucketKeyForLatLng(lat, lng);
        const prevKey = WFMM_GRID.idToBucket.get(rec.id);

        if (prevKey === key) return;

        if (prevKey) {
            const prevSet = WFMM_GRID.buckets.get(prevKey);
            if (prevSet) {
                prevSet.delete(rec.id);
                if (!prevSet.size) WFMM_GRID.buckets.delete(prevKey);
            }
        }

        let set = WFMM_GRID.buckets.get(key);
        if (!set) WFMM_GRID.buckets.set(key, (set = new Set()));
        set.add(rec.id);
        WFMM_GRID.idToBucket.set(rec.id, key);
    }

    function gridClear() {
        WFMM_GRID.buckets.clear();
        WFMM_GRID.idToBucket.clear();
    }

    // Iterate recordIds in buckets overlapping a bounds box
    function* gridCandidatesInBounds(bounds) {
        const { ne, sw } = bounds;
        const minX = Math.floor(sw.lat / GRID_DEG);
        const maxX = Math.floor(ne.lat / GRID_DEG);
        const minY = Math.floor(sw.lng / GRID_DEG);
        const maxY = Math.floor(ne.lng / GRID_DEG);

        for (let x = minX; x <= maxX; x++) {
            for (let y = minY; y <= maxY; y++) {
                const set = WFMM_GRID.buckets.get(`${x}:${y}`);
                if (!set) continue;
                for (const id of set) yield id;
            }
        }
    }

    // Iterate recordIds in buckets overlapping a radius (via bbox first)
    function* gridCandidatesInRadius(center, radiusMeters) {
        // Quick bbox around circle (approx; refine with haversine afterward)
        const latDeg = radiusMeters / 111_320; // meters per degree latitude
        const lngDeg = radiusMeters / (111_320 * Math.cos(center.lat * Math.PI / 180));

        const bounds = {
            ne: { lat: center.lat + latDeg, lng: center.lng + lngDeg },
            sw: { lat: center.lat - latDeg, lng: center.lng - lngDeg },
        };

        yield* gridCandidatesInBounds(bounds);
    }

    // ======================================================================
    // Pulsing "reported" indicators (non-clickable, behind markers)
    // ======================================================================

    const WFMM_PULSES = {
        map: null,
        overlaysById: new Map(),  // report recordId -> overlay instance
        refreshTimer: null,
    };

    let WfmmPulseOverlay = null;

    function ensurePulseOverlayClass() {
        if (WfmmPulseOverlay) return true;
        if (typeof google === "undefined" || !google.maps?.OverlayView) return false;

        WfmmPulseOverlay = class extends google.maps.OverlayView {
            constructor(latLng, opts = {}) {
                super();
                this.latLng = latLng;
                this.sizePx = opts.sizePx || 40;
                this.scaleWithZoom = !!opts.scaleWithZoom;
                this.status = opts.status || "Live";
                this.div = null;
            }

            onAdd() {
                const div = document.createElement("div");
                div.className = "wfmm-reported-pulse";
                div.style.width = this.sizePx + "px";
                div.style.height = this.sizePx + "px";
                div.style.pointerEvents = "none";
                div.style.position = "absolute";

                this.applyStatusClass(div);

                this.div = div;
                this.getPanes().overlayLayer.appendChild(div);
            }

            applyStatusClass(div) {
                const status = (this.status || "").toLowerCase();

                div.classList.remove(
                    "wfmm-reported-live",
                    "wfmm-reported-modified",
                    "wfmm-reported-retired",
                    "wfmm-reported-reinstated"
                );

                switch (status) {
                    case "modified":
                        div.classList.add("wfmm-reported-modified");
                        break;
                    case "retired":
                        div.classList.add("wfmm-reported-retired");
                        break;
                    case "reinstated":
                        div.classList.add("wfmm-reported-reinstated");
                        break;
                    default:
                        div.classList.add("wfmm-reported-live");
                }
            }

            setStatus(status) {
                this.status = status;
                if (this.div) {
                    this.applyStatusClass(this.div);
                }
            }

            draw() {
                if (!this.div) return;

                const proj = this.getProjection();
                if (!proj) return;

                const p = proj.fromLatLngToDivPixel(this.latLng);
                if (!p) return;

                this.div.style.left = p.x + "px";
                this.div.style.top  = p.y + "px";
                this.div.style.transform = "translate(-50%, -50%)";
            }

            onRemove() {
                this.div?.remove();
                this.div = null;
            }

            setLatLng(latLng) {
                this.latLng = latLng;
                this.draw();
            }
        };

        return true;
    }

    // Debounced refresh so you can call it freely
    function schedulePulseRefresh(delay = 100) {
        clearTimeout(WFMM_PULSES.refreshTimer);
        WFMM_PULSES.refreshTimer = setTimeout(() => {
            try { wfmmRefreshPulses(); } catch {}
        }, delay);
    }

    function wfmmEnsurePulseLayer(map) {
        if (!map || typeof google === "undefined" || !google.maps) return false;
        if (WFMM_PULSES.map === map) return true;

        // map changed (or first attach) -> teardown old overlays
        wfmmClearPulses();
        WFMM_PULSES.map = map;

        // Reposition on zoom/drag for smoothness (OverlayView will redraw anyway; this is just extra safety)
        map.addListener?.("zoom_changed", () => schedulePulseRefresh(50));
        map.addListener?.("idle", () => schedulePulseRefresh(50));

        return true;
    }

    function wfmmClearPulses() {
        for (const ov of WFMM_PULSES.overlaysById.values()) {
            try { ov.setMap(null); } catch {}
        }
        WFMM_PULSES.overlaysById.clear();
    }

    // Build a stable list of reported records -> pulse overlays
    function wfmmRefreshPulses() {
        const map = WFMM_PULSES.map;
        if (!map) return;

        // Zoom gate: hide pulses below threshold to reduce lag
        if (!wfmmShouldShowPulses(map)) {
            wfmmClearPulses();
            return;
        }

        // Use your in-memory cache if loaded; fallback to nothing
        const records = Array.from(WFMM_CACHE?.byId?.values?.() || []);

        const visibility = userSettings.pulseVisibility;

        const wanted = [];
        for (const rec of records) {
            if (!rec?.id) continue;

            const { lat, lng } = getEffectiveCoords(rec);
            if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;

            const statusKey = (rec.lastKnownStatus || "Live").toLowerCase();
            if (!visibility[statusKey]) continue;

            wanted.push({
                id: rec.id,
                lat,
                lng,
                status: rec.lastKnownStatus || "Live"
            });
        }

        const wantedIds = new Set(wanted.map(x => x.id));

        // Remove overlays for records that no longer exist
        for (const [id, ov] of WFMM_PULSES.overlaysById.entries()) {
            if (!wantedIds.has(id)) {
                try { ov.setMap(null); } catch {}
                WFMM_PULSES.overlaysById.delete(id);
            }
        }

        // Add/update overlays
        for (const w of wanted) {
            const ll = new google.maps.LatLng(w.lat, w.lng);
            const existing = WFMM_PULSES.overlaysById.get(w.id);

            if (!existing) {
                const ov = new WfmmPulseOverlay(ll, {
                    sizePx: 40,
                    scaleWithZoom: false,
                    status: w.status,
                });
                ov.setMap(map);
                WFMM_PULSES.overlaysById.set(w.id, ov);
            } else {
                existing.setLatLng(ll);
                existing.setStatus(w.status);
            }
        }
    }

    // Hide on low zoom levels
    function wfmmShouldShowPulses(map) {
        if (!map || typeof map.getZoom !== "function") return true;
        const z = map.getZoom();
        return (typeof z === "number") && z >= 8;
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
        await setTypeOfLocationDropdownAsync(wayspot.typeOfLocation);
        const helpshiftCountries = HELPSHIFT_COUNTRIES;
        const resolved = resolveHelpshiftCountryName(wayspot.country, helpshiftCountries);
        await setCountryInStaticDropdownAsync(resolved || wayspot.country);
        await setRemovalReasonDropdownAsync(wayspot.reasonForRemovalRequest);
        await setPropertyOwnerDropdownYesNoAsync(wayspot.propertyOwner);
        await setPreferredLanguageDropdownAsync(wayspot.preferredLanguage);

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
                    const itemTitle = (p?.getAttribute("title") || p?.textContent || "").trim();
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

    function setTypeOfLocationDropdownAsync(typeOfLocation) {
        const t = String(typeOfLocation || "").trim();
        if (!t) return Promise.resolve(false);

        return setStaticDropdownByTitleAsync(HS_DROPDOWN_SLOTS.typeOfLocation, t, {
            useSearch: true
        });
    }

    function setRemovalReasonDropdownAsync(reasonText) {
        const t = String(reasonText || "").trim();
        if (!t) return Promise.resolve(false);

        return setStaticDropdownByTitleAsync(HS_DROPDOWN_SLOTS.reasonForRemovalRequest, t, {
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

        const timestampMs =
              (typeof respJson?.created_at_epoch === "number" && Number.isFinite(respJson.created_at_epoch))
        ? respJson.created_at_epoch
        : Date.now();

        const wp = wayspotPayload || {};

        const removalReasonCode = extractRemovalReasonCode(reqParsed?.meta);

        return {
            // Primary Key – unique per report
            id: makeReportId(timestampMs),

            // Wayspot identity & location
            guid:          (typeof wp.guid === "string") ? wp.guid : null,
            title:         (typeof wp.title === "string") ? wp.title : null,
            lat:           (typeof wp.lat === "number") ? wp.lat : null,
            lng:           (typeof wp.lng === "number") ? wp.lng : null,
            description:   (typeof wp.description === "string") ? wp.description : null,
            imageUrl:      (typeof wp.imageUrl === "string") ? wp.imageUrl : null,
            addressString: (typeof wp.addressString === "string") ? wp.addressString : null,
            isCommunityContributed: (typeof wp.isCommunityContributed === "boolean") ? wp.isCommunityContributed : null,

            // Report metadata
            ticket,
            timestampMs,
            reportMechanism: "pgo-locations-web",

            // Report details
            removalReasonCode,
            removalReasonText: resolveRemovalReasonText(removalReasonCode),
            supportingText: (typeof reqParsed?.message === "string") ? reqParsed.message : null
        };
    }

    // ======================================================================
    // Css styles
    // ======================================================================

    function injectCss() {
        const STYLE_ID = "wfmapmods-reporting-history-css";
        if (document.getElementById(STYLE_ID)) return;

        const style = document.createElement("style");
        style.id = STYLE_ID;
        style.type = "text/css";
        style.textContent = `
/* Modal (EXISTING) */
.wfmapmods-reporting-backdrop{
  position:fixed; inset:0; z-index:2000;
  display:flex; align-items:center; justify-content:center;
  background:rgba(0,0,0,.35);
  padding:12px;
}
.wfmapmods-reporting-dialog{
  background:#fff; border-radius:10px;
  box-shadow: 0 10px 30px rgba(0,0,0,.25);
  padding:14px;
  max-width: min(96vw, 860px);
  width: min(860px, 96vw);
  overflow: hidden;
}
.wfmapmods-reporting-title{
  font-size:16px; font-weight:700;
  margin-bottom:10px;
}
.wfmapmods-reporting-footer{
  display:flex; justify-content:flex-end; gap:8px;
  margin-top:12px;
}

/* Buttons (EXISTING) */
.wfmapmods-reporting-btn{
  border:1px solid rgba(0,0,0,.2);
  background:#fff;
  border-radius:8px;
  padding:6px 10px;
  cursor:pointer;
  font-size:12px;
}
.wfmapmods-reporting-btn:disabled{
  opacity:.5;
  cursor:not-allowed;
}
.wfmapmods-reporting-btn-primary{
  background:#2563eb;
  color:#fff;
  border-color:#2563eb;
}

/* Table (EXISTING) */
.wfmapmods-reporting-table{
  width:100%;
  border-collapse:collapse;
  font-size:12px;
  table-layout:fixed;
}
.wfmapmods-reporting-table th,
.wfmapmods-reporting-table td{
  border-bottom:1px solid rgba(0,0,0,.1);
  padding:6px 6px;
  white-space:nowrap;
  overflow:hidden;
  text-overflow:ellipsis;
}
.wfmapmods-reporting-table th{
  text-align:left;
  user-select:none;
  cursor:pointer;
}

/* Spinner */
.wfmapmods-reporting-spinner{
  width:16px; height:16px;
  border:2px solid rgba(0,0,0,.2);
  border-top-color: rgba(0,0,0,.55);
  border-radius:50%;
  animation: wfmapmodsReportingSpin .8s linear infinite;
}
@keyframes wfmapmodsReportingSpin {
  from { transform: rotate(0deg); }
  to   { transform: rotate(360deg); }
}

/* Main vertical wrapper in modal content */
.wfmapmods-reporting-wrap{
  display:flex;
  flex-direction:column;
  gap:10px;
  margin-top:6px;
  flex: 1 1 auto;            /* key */
  min-height: 0;             /* key */
  overflow: auto;            /* key: scroll inside modal */
}

/* Top row with hint + buttons */
.wfmapmods-reporting-top-row{
  display:flex;
  justify-content:space-between;
  align-items:center;
}

/* Small helper text (hint/loading/page info/empty) */
.wfmapmods-reporting-text-sm{
  font-size:12px;
  color:#374151;
}

/* Loading row */
.wfmapmods-reporting-loading-wrap{
  display:flex;
  align-items:center;
  gap:10px;
  padding:6px 0;
}

/* Empty state */
.wfmapmods-reporting-empty-wrap{
  display:none; /* toggled via JS */
}

/* Pager */
.wfmapmods-reporting-pager{
  display:flex;
  justify-content:space-between;
  align-items:center;
  gap:10px;
}
.wfmapmods-reporting-pager-left{
  display:flex;
  gap:8px;
  align-items:center;
}

/* Dialog layout (replaces dialog.style.maxHeight/display/flexDirection) */
.wfmapmods-reporting-dialog--flex{
  max-height:90vh;
  display:flex;
  flex-direction:column;
  min-height: 0;
}

/* Table header cell base (replaces many th.style.*) */
.wfmapmods-reporting-th{
  user-select:none;
  white-space:nowrap;
  overflow:hidden;
  text-overflow:ellipsis;
}

/* Sortable header cells */
.wfmapmods-reporting-th--sortable{
  cursor:pointer;
}

/* Filters row container */
.wfmapmods-reporting-filters{
  display:flex;
  flex-wrap:wrap;
  gap:8px;
  align-items:center;
  padding:6px 0;
}

/* Label in filters/details */
.wfmapmods-reporting-label{
  font-size:12px;
  color:#374151;
  user-select:none;
}

/* Make selects look compact while reusing .wfmapmods-reporting-btn base */
.wfmapmods-reporting-select{
  padding:2px 6px;
}

/* Text input styling */
.wfmapmods-reporting-input{
  font-size:12px;
  padding:3px 6px;
  border:1px solid #d1d5db;
  border-radius:6px;
  min-width:180px;
}

/* Full-width break in flex row */
.wfmapmods-reporting-row-break{
  flex-basis:100%;
  height:0;
}

/* Details block wrapper */
.wfmapmods-reporting-details{
  margin-top:6px;
  overflow-y:auto;
  max-height:55vh;
  padding:0;
  white-space:normal;
  overflow-x:hidden;
  max-width:100%;
}

/* Details row container: image + details */
.wfmapmods-reporting-details-row{
  display:flex;
  align-items:flex-start;
  gap:12px;
  flex-wrap:wrap; /* stack on narrow widths */
}

/* Image column wrapper */
.wfmapmods-reporting-details-imgwrap{
  width:120px;
  height:120px;
  flex:0 0 120px;
}

/* Details image */
.wfmapmods-reporting-details-img{
  width:120px;
  height:120px;
  object-fit:cover;
  border-radius:6px;
  display:block;
}

/* Right-hand column */
.wfmapmods-reporting-details-col{
  flex:1 1 280px;
  min-width:0; /* important for long text */
}

/* Details grid */
.wfmapmods-reporting-details-grid{
  display:grid;
  grid-template-columns:130px 1fr;
  row-gap:4px;
  column-gap:10px;
}

/* Details key/value cells */
.wfmapmods-reporting-details-k{
  font-weight:600;
  color:#374151;
  user-select:none;
}
.wfmapmods-reporting-details-v{
  color:#111827;
  white-space:normal;
  min-width:0;
  max-width:100%;
  overflow-wrap:anywhere;
  word-break:break-word;
}

/* Clickable main rows */
.wfmapmods-reporting-row-main{
  cursor:pointer;
}

/* Common cell baseline (replaces td() helper inline styles) */
.wfmapmods-reporting-cell{
  white-space:nowrap;
  overflow:hidden;
  text-overflow:ellipsis;
}

/* Alignment helpers */
.wfmapmods-reporting-align-left{ text-align:left; }
.wfmapmods-reporting-align-center{ text-align:center; }

/* Cells that must not ellipsis (e.g., icon buttons) */
.wfmapmods-reporting-cell--no-ellipsis{
  white-space:nowrap;
  overflow:visible;
  text-overflow:clip;
}

/* Star column cell sizing */
.wfmapmods-reporting-cell-flag{
  width:45px;
  min-width:45px;
}

/* Star button (bigger click target, big star) */
.wfmapmods-reporting-btn--star{
  padding:0 8px;
  line-height:1;
  font-size:16px;
  min-width:28px;
  user-select:none;
}

/* Title span should be selectable even though row is clickable */
.wfmapmods-reporting-title-selectable{
  user-select:text;
}

/* Go/magnifier button */
.wfmapmods-reporting-btn--go{
  padding:2px 6px;
  line-height:1;
}

/* Disabled go button (you already set disabled=true in JS; this styles it) */
.wfmapmods-reporting-btn--go:disabled{
  opacity:.5;
  cursor:not-allowed;
}

/* Details row cell content should wrap */
.wfmapmods-reporting-details-cell{
  white-space:normal;
  overflow-x:hidden;
}

/* Pager: 3-zone layout (left / centered info / right) */
.wfmapmods-reporting-pager{
  display:grid;
  grid-template-columns: 1fr auto 1fr;
  align-items:center;
  gap:10px;
}

.wfmapmods-reporting-pager-left{
  justify-self:start;
  display:flex;
  gap:8px;
  align-items:center;
}

.wfmapmods-reporting-pager-center{
  justify-self:center;
}

.wfmapmods-reporting-pager-right{
  justify-self:end;
}

/* Filters: push "Clear filters" to the far right */
.wfmapmods-reporting-filters-spacer{
  margin-left:auto;
}

/* Make clear filters read as a command, not an input */
.wfmapmods-reporting-btn--clear{
  border-color: transparent;
  background: transparent;
  color:#374151;
}
.wfmapmods-reporting-btn--clear:hover{
  border-color: rgba(0,0,0,.15);
  background: rgba(0,0,0,.03);
}

/* Narrow Ticket input */
.wfmapmods-reporting-input--ticket{
  min-width: 100px;
  width: 100px;
}

.wfmapmods-reporting-dialog{
  color: rgb(82, 82, 82);
}

.wfmapmods-reporting-title,
.wfmapmods-reporting-text-sm,
.wfmapmods-reporting-label,
.wfmapmods-reporting-table,
.wfmapmods-reporting-table th,
.wfmapmods-reporting-table td,
.wfmapmods-reporting-th,
.wfmapmods-reporting-cell,
.wfmapmods-reporting-details-k,
.wfmapmods-reporting-details-v{
  color: rgb(82, 82, 82);
  opacity: 1;
}

.wfmapmods-reporting-input{
  color: rgb(82, 82, 82);
  opacity: 1;
}

.wfmapmods-reporting-input::placeholder{
  color: rgba(82, 82, 82, 0.55);
  opacity: 1;
}

.wfmapmods-reporting-btn{
  color: rgb(82, 82, 82);
  opacity: 1;
}

.wfmapmods-reporting-btn-primary{
  color: #fff;
  opacity: 1;
}
  `;
        document.head.appendChild(style);
    }

    (function injectWfmmPulseCss() {
        if (document.getElementById("wfmm-pulse-css")) return;

        const style = document.createElement("style");
        style.id = "wfmm-pulse-css";
        style.textContent = `
@keyframes wfmmPulseRing {
  0%   { transform: scale(0.65); opacity: 0.85; }
  70%  { transform: scale(1.8);  opacity: 0.00; }
  100% { transform: scale(1.8);  opacity: 0.00; }
}

.wfmm-reported-pulse {
  position: absolute;
  width: 34px;
  height: 34px;
  border-radius: 9999px;
  pointer-events: none;
  will-change: transform, opacity;
}

/* expanding ring */
.wfmm-reported-pulse::before {
  content: "";
  position: absolute;
  inset: 0;
  border-radius: 9999px;
  border: 2px solid var(--wfmm-color, rgba(255,0,0,0.95));
  box-shadow: 0 0 6px var(--wfmm-glow, rgba(255,0,0,0.65));
  transform-origin: 50% 50%;
  animation: wfmmPulseRing 1.25s ease-out infinite;
}

/* core dot */
.wfmm-reported-pulse::after {
  content: "";
  position: absolute;
  left: 50%;
  top: 50%;
  width: 9px;
  height: 9px;
  transform: translate(-50%, -50%);
  border-radius: 9999px;
  background: var(--wfmm-color, rgba(255,0,0,0.95));
  box-shadow: 0 0 7px var(--wfmm-glow, rgba(255,0,0,0.85));
}

/* status colours */
.wfmm-reported-live {
  --wfmm-color: rgba(255, 0, 0, 0.95);
  --wfmm-glow:  rgba(255, 0, 0, 0.65);
}

.wfmm-reported-modified {
  --wfmm-color: rgba(255, 210, 0, 0.95);
  --wfmm-glow:  rgba(255, 210, 0, 0.65);
}

.wfmm-reported-retired {
  --wfmm-color: rgba(90, 90, 90, 0.95);
  --wfmm-glow:  rgba(90, 90, 90, 0.65);
}

.wfmm-reported-reinstated {
  --wfmm-color: rgba(170, 0, 255, 0.95);
  --wfmm-glow:  rgba(170, 0, 255, 0.65);
}
  `;
        document.head.appendChild(style);
    })();

    // ======================================================================
    // Entry point
    // ======================================================================

    if (CURRENT_ORIGIN === ORIGIN_WAYFARER) {
        initWayfarer();
    } else if (CURRENT_ORIGIN === ORIGIN_HELPSHIFT) {
        initHelpshift();
    }

})();
