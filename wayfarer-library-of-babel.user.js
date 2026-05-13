// ==UserScript==
// @name         Wayfarer - Library of Babel
// @version      1.2.0
// @description  Plug-in for automating collection of multi-language Wayfarer email templates
// @namespace    https://gitlab.com/Tntnnbltn/wayfarer-addons
// @downloadURL  https://gitlab.com/Tntnnbltn/wayfarer-addons/-/raw/main/wayfarer-library-of-babel.user.js
// @updateURL    https://gitlab.com/Tntnnbltn/wayfarer-addons/-/raw/main/wayfarer-library-of-babel.user.js
// @homepageURL  https://gitlab.com/Tntnnbltn/wayfarer-addons
// @match        https://wayfarer.nianticlabs.com/*
// @run-at       document-start
// @grant        none
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
    "use strict";

    // =========================================================================
    // Constants
    // =========================================================================

    const SCRIPT_PREFIX = "[LibraryOfBabel]";
    const DB_NAME = "wayfarer-tools-db";
    const STORE_NAME = "submissionLanguages";

    const SUBMIT_ROUTE = "/new/submit/new";
    const MAPVIEW_ROUTE = "/new/mapview";

    const SETTINGS_ENDPOINT = "/api/v1/vault/settings";
    const SUBMIT_NOW_ENDPOINT = "/api/v1/vault/submit/now";
    const MANAGE_ENDPOINT = "/api/v1/vault/manage";
    const SUBMIT_UPLOAD_ENDPOINT = "/api/v1/vault/submit/upload";
    const POI_REPORT_ENDPOINT = "/api/v1/vault/mapview/poi-report";

    const BABEL_LINK_ID = "wfmapmods-library-of-babel-link";
    const BABEL_MODAL_BACKDROP_ID = "wfmapmods-babel-modal-backdrop";
    const BABEL_DETAIL_BACKDROP_ID = "wfmapmods-babel-detail-modal-backdrop";

    const SUBMISSION_MODAL_ID = "wfmapmods-submission-edit";

    const BABEL_SETTINGS_LINK_ID = "wfmapmods-library-of-babel-settings-link";
    const BABEL_SETTINGS_BACKDROP_ID = "wfmapmods-babel-settings-modal-backdrop";

    const MANAGE_MATCH_WINDOW_DAYS = 7; // safety window for matching stale unmatched submissions

    const NOMINATIONS_ROUTE = "/new/nominations";
    const BABEL_DETAIL_PANEL_ID = "wfmapmods-babel-details-panel";

    let latestManageSubmissionsById = new Map();
    let latestSelectedManageId = null;

    const EMAIL_KEYS = [
        "submissionReceived",
        "communityApproved",
        "nianticApproved",
        "approvalUnknown",
        "communityRejected",
        "nianticRejected",
        "rejectionUnknown",
        "appealReceived",
        "appealAccepted",
        "appealRejected"
    ];

    const SUMMARY_EXPORT_KEYS = [
        "submissionReceived",
        "communityApproved",
        "nianticApproved",
        "communityRejected",
        "nianticRejected",
        "appealReceived",
        "appealAccepted",
        "appealRejected"
    ];

    const REQUIRED_TEMPLATE_KEYS = [
        "submissionReceived",
        "communityApproved",
        "communityRejected",
        "nianticApproved",
        "nianticRejected",
        "appealReceived",
        "appealAccepted",
        "appealRejected"
    ];

    const EMAIL_LABELS = {
        submissionReceived: "Submitted",
        communityApproved: "Community ✓",
        nianticApproved: "NIA ✓",
        approvalUnknown: "Approval ?",
        communityRejected: "Community ✗",
        nianticRejected: "NIA ✗",
        rejectionUnknown: "Rejection ?",
        appealReceived: "Appealed",
        appealAccepted: "Appeal ✓",
        appealRejected: "Appeal ✗"
    };

    const EMAIL_SCORE_WEIGHTS = {
        submissionReceived: 10,
        communityApproved: 5,
        communityRejected: 5,
        nianticApproved: 5,
        nianticRejected: 5,
        appealReceived: 2,
        appealAccepted: 1,
        appealRejected: 1
    };

    const LANGUAGES = [
        "en", "ja_JP", "ko_KR", "pt_BR", "cs_CZ", "de_DE", "es_ES", "fr_FR",
        "it_IT", "nl_LN", "no_NO", "pl_PL", "ru_RU", "sv_SE", "th_TH",
        "zh_TW", "hi_IN", "id_ID", "tr_TR"
    ];

    // Correct nl language code from your requested list.
    // If Wayfarer actually uses nl_NL, keep this line and remove nl_LN above.
    LANGUAGES[LANGUAGES.indexOf("nl_LN")] = "nl_NL";

    const FALLBACK_DEFAULT_LANGUAGE = "en";

    const BABEL_SETTINGS_STORAGE_KEY = "wfmapmods-library-of-babel-settings-v1";

    const DEFAULT_BABEL_SETTINGS = {
        defaultLanguage: "en",
        submissionLanguages: LANGUAGES.filter(lang => !["en", "id_ID", "tr_TR"].includes(lang)),
        deletionLanguages: LANGUAGES.filter(lang => lang !== "en"),
        lastDeletionLanguage: null,
        username: "",
        importedSummaries: []
    };

    // Sort order by country code / language code as requested
    const SORTED_LANGUAGES = [...LANGUAGES].sort((a, b) => a.localeCompare(b));

    // =========================================================================
    // Runtime state
    // =========================================================================

    let sidePanelObserver = null;
    let sidePanelMutationScheduled = false;

    let submissionModalObserver = null;
    let submissionModalMutationScheduled = false;

    let submissionModalArmed = false;
    let pendingSubmissionLanguage = null;
    let pendingSubmissionSessionId = null;
    let pendingSubmissionStartedAt = null;
    let languageSwitchInFlight = false;
    let successfulSubmitOccurredForCurrentModal = false;

    let latestKnownLanguage = FALLBACK_DEFAULT_LANGUAGE;

    let babelDataCache = [];
    let lastManageRefreshAt = null;

    let submissionCancelTimer = null;
    let submitInitiated = false;
    let submitInitiatedAt = null;

    let babelSettings = deepClone(DEFAULT_BABEL_SETTINGS);

    let libraryOfBabelModalNeedsRefresh = false;

    let deletionModalObserver = null;
    let deletionModalMutationScheduled = false;
    let deletionModalArmed = false;
    let pendingDeletionLanguage = null;
    let deletionReportSucceededForCurrentModal = false;
    let deletionReportHandledForCurrentModal = false;
    let deletionCancelTimer = null;
    let deletionModalClosedAt = null;
    let deletionReportInitiatedAt = null;

    let submitNowInitiated = false;
    let submitNowInitiatedAt = null;

    // =========================================================================
    // Logging helpers
    // =========================================================================

    function log(...args) {
        console.log(SCRIPT_PREFIX, ...args);
    }

    function warn(...args) {
        console.warn(SCRIPT_PREFIX, ...args);
    }

    function error(...args) {
        console.error(SCRIPT_PREFIX, ...args);
    }

    // =========================================================================
    // Generic helpers
    // =========================================================================

    function isOnMapCapableRoute() {
        const p = window.location.pathname;
        return p.startsWith(SUBMIT_ROUTE) || p.startsWith(MAPVIEW_ROUTE);
    }

    function nowIso() {
        return new Date().toISOString();
    }

    function todayYYYYMMDD() {
        return new Date().toISOString().slice(0, 10);
    }

    function randomId(prefix = "lob") {
        return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    }

    function deepClone(obj) {
        return JSON.parse(JSON.stringify(obj));
    }

    function safeJsonParse(text) {
        try {
            return JSON.parse(text);
        } catch {
            return null;
        }
    }

    function normalizeApiPath(url) {
        if (typeof url !== "string") return url;

        try {
            return new URL(url, window.location.origin).pathname;
        } catch {
            return url.split("?")[0];
        }
    }

    function isObject(v) {
        return !!v && typeof v === "object" && !Array.isArray(v);
    }

    function truncateCoordinate6(value) {
        const n = Number(value);
        if (!Number.isFinite(n)) return null;
        return Math.trunc(n * 1e6) / 1e6;
    }

    function fixed6(value) {
        const n = Number(value);
        if (!Number.isFinite(n)) return "";
        return n.toFixed(6);
    }

    function coordsEqual6(a, b) {
        return truncateCoordinate6(a) === truncateCoordinate6(b);
    }

    function daysBetween(dateStrA, dateStrB) {
        const a = new Date(dateStrA);
        const b = new Date(dateStrB);
        if (Number.isNaN(+a) || Number.isNaN(+b)) return Infinity;
        const diff = Math.abs(b.getTime() - a.getTime());
        return diff / (1000 * 60 * 60 * 24);
    }

    function makeEmptyEmails() {
        return {
            submissionReceived: false,
            communityApproved: false,
            nianticApproved: false,
            approvalUnknown: false,
            communityRejected: false,
            nianticRejected: false,
            rejectionUnknown: false,
            appealReceived: false,
            appealAccepted: false,
            appealRejected: false
        };
    }

    function ensureRecordShape(record) {
        const emails = Object.assign(makeEmptyEmails(), record.emails || {});

        return Object.assign({
            id: randomId("lob-rec"),
            type: "nomination",
            sourceId: null,
            createdAt: nowIso(),
            updatedAt: nowIso(),
            day: todayYYYYMMDD(),
            language: getDefaultLanguage(),
            originalTitle: "",
            latestTitle: "",
            description: "",
            statement: "",
            lat: null,
            lng: null,
            lat6: null,
            lng6: null,
            status: "",
            sawVoting: false,
            sawNianticVoting: false,
            sawReturnedFromNianticVoting: false,
            canAppeal: false,
            appealResolved: false,
            appealNotes: "",
            userAppealNotes: "",
            appealPlanned: false,
            matchedToManage: false,
            trackingComplete: false,
            pendingForScoring: false,
            manualOverrides: {},
            lastSeenAt: null,
            submissionSessionId: null
        }, record, { emails });
    }

    function canStillGenerateOutcomeEmails(record) {
        // For scoring pending count only:
        // - Count unresolved active nominations
        // - DO NOT count rejected-without-resolved-appeal
        // - DO NOT count finished accepted / appeal-resolved outcomes
        const status = normalizeNominationStatus(record.status);

        if (record.trackingComplete) return false;
        if (record.appealResolved) return false;

        if (status === "REJECTED") return false;
        if (status === "ACCEPTED") return false;
        if (status === "WITHDRAWN") return false;

        return true;
    }

    function shouldKeepTracking(record) {
        const status = normalizeNominationStatus(record.status);

        if (record.appealResolved) return false;
        if (status === "ACCEPTED") return false;
        if (status === "WITHDRAWN") return false;

        // Keep tracking rejected/duplicate because it may later be appealed
        return true;
    }

    function byCountryCodeSort(a, b) {
        return a.localeCompare(b);
    }

    function makeCheckMark(value) {
        return value ? "✓" : "";
    }

    function makeMainModalOutcomeMark(hasTemplates, key, unknownKey) {
        if (hasTemplates && hasTemplates[key]) return "✓";
        if (hasTemplates && hasTemplates[unknownKey]) return "?";
        return "";
    }

    function mergeEmails(existingEmails, inferredEmails, manualOverrides) {
        const out = Object.assign(makeEmptyEmails(), existingEmails || {});
        const overrides = manualOverrides || {};

        for (const key of EMAIL_KEYS) {
            if (key in overrides) {
                out[key] = !!overrides[key];
            } else if (key in inferredEmails) {
                out[key] = !!inferredEmails[key];
            }
        }

        // Approval outcomes are mutually exclusive.
        if (out.communityApproved || out.nianticApproved) {
            out.approvalUnknown = false;
        }

        if (out.approvalUnknown) {
            out.communityApproved = false;
            out.nianticApproved = false;
        }

        // Rejection outcomes are mutually exclusive.
        if (out.communityRejected || out.nianticRejected) {
            out.rejectionUnknown = false;
        }

        if (out.rejectionUnknown) {
            out.communityRejected = false;
            out.nianticRejected = false;
        }

        return out;
    }

    function normalizeNominationStatus(status) {
        const s = String(status || "").toUpperCase();
        return s === "DUPLICATE" ? "REJECTED" : s;
    }

    function isCommunityVotingStatus(status) {
        const s = String(status || "").toUpperCase().replace(/[_-]+/g, " ").trim();
        return s === "VOTING";
    }

    function isNianticVotingStatus(status) {
        const s = String(status || "").toUpperCase().replace(/[_-]+/g, " ").trim();
        return s === "NIANTIC REVIEW";
    }

    function isNominatedStatus(status) {
        const s = String(status || "").toUpperCase().replace(/[_-]+/g, " ").trim();
        return s === "NOMINATED";
    }

    function clearFirstOutcomeInference(inferred) {
        inferred.communityApproved = false;
        inferred.nianticApproved = false;
        inferred.approvalUnknown = false;
        inferred.communityRejected = false;
        inferred.nianticRejected = false;
        inferred.rejectionUnknown = false;
    }

    function updateVotingPathFlags(record, currentStatus) {
        const wasNianticVoting = !!record.sawNianticVoting;
        const isCurrentlyNianticVoting = isNianticVotingStatus(currentStatus);
        const isCurrentlyCommunityVoting = isCommunityVotingStatus(currentStatus);
        const isCurrentlyNominated = isNominatedStatus(currentStatus);

        if (isCurrentlyCommunityVoting) {
            record.sawVoting = true;
        }

        if (isCurrentlyNianticVoting) {
            record.sawNianticVoting = true;
        }

        if (wasNianticVoting && isCurrentlyNominated) {
            record.sawReturnedFromNianticVoting = true;
            record.sawVoting = true;
        }
    }

    function hasAnyApprovalOutcome(emails) {
        return !!(
            emails &&
            (
                emails.communityApproved ||
                emails.nianticApproved ||
                emails.approvalUnknown
            )
        );
    }

    function hasAnyRejectionOutcome(emails) {
        return !!(
            emails &&
            (
                emails.communityRejected ||
                emails.nianticRejected ||
                emails.rejectionUnknown
            )
        );
    }

    // =========================================================================
    // IndexedDB helpers
    // =========================================================================

    function getDBInstance(version) {
        return new Promise((resolve, reject) => {
            if (!window.indexedDB) {
                reject(new Error("This browser doesn't support IndexedDB"));
                return;
            }

            const openRequest = indexedDB.open(DB_NAME, version);

            openRequest.onsuccess = (event) => {
                const db = event.target.result;
                const dbVer = db.version;

                if (!db.objectStoreNames.contains(STORE_NAME)) {
                    db.close();
                    getDBInstance(dbVer + 1).then(resolve, reject);
                    return;
                }

                resolve(db);
            };

            openRequest.onupgradeneeded = (event) => {
                const db = event.target.result;

                if (!db.objectStoreNames.contains(STORE_NAME)) {
                    const store = db.createObjectStore(STORE_NAME, { keyPath: "id" });
                    store.createIndex("sourceId", "sourceId", { unique: false });
                    store.createIndex("language", "language", { unique: false });
                    store.createIndex("day", "day", { unique: false });
                    store.createIndex("submissionSessionId", "submissionSessionId", { unique: false });
                } else {
                    const store = event.target.transaction.objectStore(STORE_NAME);
                    if (!store.indexNames.contains("sourceId")) {
                        store.createIndex("sourceId", "sourceId", { unique: false });
                    }
                    if (!store.indexNames.contains("language")) {
                        store.createIndex("language", "language", { unique: false });
                    }
                    if (!store.indexNames.contains("day")) {
                        store.createIndex("day", "day", { unique: false });
                    }
                    if (!store.indexNames.contains("submissionSessionId")) {
                        store.createIndex("submissionSessionId", "submissionSessionId", { unique: false });
                    }
                }
            };

            openRequest.onerror = (event) => {
                reject(event.target.error || new Error("Failed to open IndexedDB"));
            };
        });
    }

    async function withStore(mode, fn) {
        const db = await getDBInstance();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(STORE_NAME, mode);
            const store = tx.objectStore(STORE_NAME);

            let settled = false;

            tx.oncomplete = () => {
                if (!settled) resolve(undefined);
                db.close();
            };

            tx.onerror = (event) => {
                settled = true;
                reject(event.target.error || new Error("IndexedDB transaction failed"));
                db.close();
            };

            tx.onabort = (event) => {
                settled = true;
                reject(event.target.error || new Error("IndexedDB transaction aborted"));
                db.close();
            };

            try {
                const maybePromise = fn(store, tx);
                Promise.resolve(maybePromise)
                    .then((result) => {
                    settled = true;
                    resolve(result);
                })
                    .catch((err) => {
                    settled = true;
                    reject(err);
                });
            } catch (err) {
                settled = true;
                reject(err);
            }
        });
    }

    function requestToPromise(req) {
        return new Promise((resolve, reject) => {
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => reject(req.error || new Error("IndexedDB request failed"));
        });
    }

    async function getAllRecords() {
        return withStore("readonly", async (store) => {
            const req = store.getAll();
            const results = await requestToPromise(req);
            return (results || []).map(ensureRecordShape);
        });
    }

    async function putRecord(record) {
        const shaped = ensureRecordShape(record);
        shaped.updatedAt = nowIso();

        await withStore("readwrite", async (store) => {
            const req = store.put(shaped);
            await requestToPromise(req);
        });

        return shaped;
    }

    async function putRecords(records) {
        await withStore("readwrite", async (store) => {
            for (const r of records) {
                const shaped = ensureRecordShape(r);
                shaped.updatedAt = nowIso();
                const req = store.put(shaped);
                await requestToPromise(req);
            }
        });
    }

    async function getRecordById(id) {
        return withStore("readonly", async (store) => {
            const req = store.get(id);
            const result = await requestToPromise(req);
            return result ? ensureRecordShape(result) : null;
        });
    }

    async function getRecordBySourceId(sourceId) {
        return withStore("readonly", async (store) => {
            const idx = store.index("sourceId");
            const req = idx.getAll(sourceId);
            const results = await requestToPromise(req);
            return (results || []).map(ensureRecordShape);
        });
    }

    async function refreshCache() {
        babelDataCache = await getAllRecords();
        return babelDataCache;
    }

    function isOnNominationsRoute() {
        return window.location.pathname.startsWith(NOMINATIONS_ROUTE);
    }

    function setLatestManageCache(submissions) {
        latestManageSubmissionsById = new Map();
        for (const submission of submissions || []) {
            if (submission && submission.id) {
                latestManageSubmissionsById.set(submission.id, submission);
            }
        }
    }

    async function getBabelRecordForSourceId(sourceId) {
        const records = await getAllRecords();
        return records.find(r => r.sourceId === sourceId) || null;
    }

    async function upsertNominationLanguageFromManage(sourceId, language) {
        if (!sourceId) throw new Error("sourceId is required");
        if (!language) throw new Error("language is required");

        const submission = latestManageSubmissionsById.get(sourceId);
        if (!submission) {
            throw new Error(`No cached manage submission found for sourceId ${sourceId}`);
        }

        const records = await getAllRecords();
        let record = records.find(r => r.sourceId === sourceId) || null;

        if (!record) {
            record = ensureRecordShape({
                id: randomId("lob-rec"),
                type: "nomination",
                sourceId,
                matchedToManage: true,
                createdAt: nowIso()
            });
        }

        record.language = language;
        record.sourceId = sourceId;
        record.matchedToManage = true;

        record.day = submission.day || record.day || todayYYYYMMDD();
        record.originalTitle = record.originalTitle || submission.title || "";
        record.latestTitle = submission.title || record.latestTitle || record.originalTitle || "";
        record.description = submission.description || record.description || "";
        record.statement = submission.statement || record.statement || "";

        const subLat = Number(submission.lat);
        const subLng = Number(submission.lng);

        if (Number.isFinite(subLat)) {
            record.lat = subLat;
            record.lat6 = truncateCoordinate6(subLat);
        }

        if (Number.isFinite(subLng)) {
            record.lng = subLng;
            record.lng6 = truncateCoordinate6(subLng);
        }

        record.status = normalizeNominationStatus(submission.status || record.status);
        record.canAppeal = !!submission.canAppeal;
        record.appealResolved = !!submission.appealResolved;
        record.appealNotes = submission.appealNotes || "";
        record.userAppealNotes = submission.userAppealNotes || "";
        record.lastSeenAt = nowIso();

        updateVotingPathFlags(record, submission.status);

        record.emails = Object.assign(makeEmptyEmails(), record.emails || {});
        record.emails.submissionReceived = true;

        const inferredEmails = inferEmailsForSubmission(record, submission);
        record.emails = mergeEmails(record.emails, inferredEmails, record.manualOverrides);

        if (record.emails && record.emails.appealReceived) {
            record.appealPlanned = false;
        }

        record.trackingComplete = !shouldKeepTracking(record);
        record.pendingForScoring = canStillGenerateOutcomeEmails(record);

        await putRecord(record);
        await refreshCache();

        return record;
    }

    function normaliseLanguageList(list, fallbackList) {
        if (!Array.isArray(list)) return [...fallbackList];

        const valid = list.filter(lang => LANGUAGES.includes(lang));
        return [...new Set(valid)];
    }

    function normaliseUsername(value) {
        return String(value || "").trim();
    }

    function normaliseImportedSummaryLanguageRow(row) {
        if (!isObject(row)) return null;

        const language = row.language || row.languageId || row.language_id;
        if (!LANGUAGES.includes(language)) return null;

        const source = isObject(row.hasTemplates)
        ? row.hasTemplates
        : isObject(row.emails)
        ? row.emails
        : row;

        const out = {
            language
        };

        for (const key of SUMMARY_EXPORT_KEYS) {
            out[key] = !!source[key];
        }

        return out;
    }

    function normaliseImportedSummaries(raw) {
        if (!Array.isArray(raw)) return [];

        const byUsername = new Map();

        for (const item of raw) {
            if (!isObject(item)) continue;

            const username = normaliseUsername(item.username);
            if (!username) continue;

            const rawLanguages = Array.isArray(item.languages)
            ? item.languages
            : Array.isArray(item.summary)
            ? item.summary
            : Array.isArray(item.rows)
            ? item.rows
            : [];

            const languages = rawLanguages
            .map(normaliseImportedSummaryLanguageRow)
            .filter(Boolean);

            byUsername.set(username, {
                username,
                importedAt: item.importedAt || nowIso(),
                languages
            });
        }

        return Array.from(byUsername.values());
    }

    async function buildLanguageSummaryExport() {
        const username = normaliseUsername(babelSettings.username);

        if (!username) {
            throw new Error("Please enter a username in Library of Babel settings before exporting.");
        }

        const { rows } = await getLanguageSummaryRows();

        return {
            app: "Wayfarer Library of Babel",
            type: "language-summary",
            version: 1,
            username,
            exportedAt: nowIso(),
            languages: rows.map(row => {
                const out = {
                    language: row.language,
                    languageId: row.language
                };

                for (const key of SUMMARY_EXPORT_KEYS) {
                    out[key] = !!(row.hasTemplates && row.hasTemplates[key]);
                }

                return out;
            })
        };
    }

    async function copyTextToClipboard(text) {
        if (navigator.clipboard && window.isSecureContext) {
            await navigator.clipboard.writeText(text);
            return;
        }

        const textarea = document.createElement("textarea");
        textarea.value = text;
        textarea.setAttribute("readonly", "");
        textarea.style.position = "fixed";
        textarea.style.left = "-9999px";
        textarea.style.top = "-9999px";

        document.body.appendChild(textarea);
        textarea.focus();
        textarea.select();

        const successful = document.execCommand("copy");
        textarea.remove();

        if (!successful) {
            throw new Error("Clipboard copy failed.");
        }
    }

    async function exportLanguageSummaryJson() {
        try {
            const exportObject = await buildLanguageSummaryExport();
            const exportText = JSON.stringify(exportObject, null, 2);

            await copyTextToClipboard(exportText);

            alert("Language summary copied to clipboard.");
        } catch (err) {
            alert(err.message || "Unable to copy summary to clipboard.");
            warn("Unable to copy summary to clipboard", err);
        }
    }

    function normaliseImportedSummaryPayload(payload) {
        const parsed = typeof payload === "string"
        ? safeJsonParse(payload)
        : payload;

        if (!isObject(parsed)) {
            throw new Error("Import failed: the pasted text is not valid JSON.");
        }

        const username = normaliseUsername(parsed.username);
        if (!username) {
            throw new Error("Import failed: the summary does not include a username.");
        }

        const rawLanguages = Array.isArray(parsed.languages)
        ? parsed.languages
        : Array.isArray(parsed.summary)
        ? parsed.summary
        : Array.isArray(parsed.rows)
        ? parsed.rows
        : null;

        if (!Array.isArray(rawLanguages)) {
            throw new Error("Import failed: the summary does not include a languages array.");
        }

        const languages = rawLanguages
        .map(normaliseImportedSummaryLanguageRow)
        .filter(Boolean);

        if (languages.length === 0) {
            throw new Error("Import failed: no recognised language rows were found.");
        }

        return {
            username,
            importedAt: nowIso(),
            languages
        };
    }

    function upsertImportedLanguageSummary(importedSummary) {
        const existing = normaliseImportedSummaries(babelSettings.importedSummaries);
        const index = existing.findIndex(s => s.username === importedSummary.username);

        if (index >= 0) {
            existing[index] = importedSummary;
        } else {
            existing.push(importedSummary);
        }

        saveBabelSettings(Object.assign({}, babelSettings, {
            importedSummaries: existing
        }));

        return importedSummary;
    }

    async function importLanguageSummaryJson() {
        const pasted = prompt("Paste a Library of Babel language summary JSON export:");

        if (!pasted) return;

        try {
            const importedSummary = normaliseImportedSummaryPayload(pasted);
            upsertImportedLanguageSummary(importedSummary);

            await refreshOpenLibraryOfBabelModal();

            alert(`Imported summary for ${importedSummary.username}.`);
        } catch (err) {
            alert(err.message || "Unable to import summary.");
            warn("Unable to import summary", err);
        }
    }

    function getImportedSummaryUsersFor(language, emailKey) {
        const users = [];

        for (const summary of normaliseImportedSummaries(babelSettings.importedSummaries)) {
            const row = summary.languages.find(r => r.language === language);
            if (row && row[emailKey]) {
                users.push(summary.username);
            }
        }

        return users;
    }

    function appendSummaryMarkCell(tr, ownMark, importedUsers, importedMark = "✓", isTop = false) {
        const td = document.createElement("td");
        styleCell(td, false);

        td.style.width = "64px";
        td.style.minWidth = "64px";
        td.style.maxWidth = "64px";

        if (isTop) {
            td.style.background = "#fffbea";
        }

        if (ownMark) {
            td.textContent = ownMark;
        } else if (importedUsers && importedUsers.length > 0) {
            const span = document.createElement("span");
            span.textContent = `${importedMark}*`;
            span.title = importedUsers.join(", ");
            span.style.color = "#9ca3af";
            span.style.fontWeight = "600";
            td.appendChild(span);
        }

        tr.appendChild(td);
        return td;
    }

    async function refreshOpenLibraryOfBabelModal() {
        const existing = document.getElementById(BABEL_MODAL_BACKDROP_ID);

        if (!existing) {
            libraryOfBabelModalNeedsRefresh = false;
            return;
        }

        existing.remove();
        await refreshCache();
        libraryOfBabelModalNeedsRefresh = false;
        await openLibraryOfBabelModal();
    }

    function normaliseBabelSettings(raw) {
        const fallback = deepClone(DEFAULT_BABEL_SETTINGS);
        const input = isObject(raw) ? raw : {};

        let defaultLanguage = input.defaultLanguage;
        if (!LANGUAGES.includes(defaultLanguage)) {
            defaultLanguage = fallback.defaultLanguage;
        }

        const submissionLanguages = normaliseLanguageList(
            input.submissionLanguages,
            fallback.submissionLanguages
        );

        const deletionLanguages = normaliseLanguageList(
            input.deletionLanguages,
            fallback.deletionLanguages
        );

        let lastDeletionLanguage = input.lastDeletionLanguage || null;
        if (lastDeletionLanguage && !LANGUAGES.includes(lastDeletionLanguage)) {
            lastDeletionLanguage = null;
        }

        return {
            defaultLanguage,
            submissionLanguages,
            deletionLanguages,
            lastDeletionLanguage,
            username: normaliseUsername(input.username),
            importedSummaries: normaliseImportedSummaries(input.importedSummaries)
        };
    }

    function loadBabelSettings() {
        const rawText = localStorage.getItem(BABEL_SETTINGS_STORAGE_KEY);
        const parsed = rawText ? safeJsonParse(rawText) : null;

        babelSettings = normaliseBabelSettings(parsed);
        saveBabelSettings(babelSettings);

        return babelSettings;
    }

    function saveBabelSettings(settings) {
        babelSettings = normaliseBabelSettings(settings);
        localStorage.setItem(BABEL_SETTINGS_STORAGE_KEY, JSON.stringify(babelSettings));
        return babelSettings;
    }

    function getDefaultLanguage() {
        return babelSettings.defaultLanguage || FALLBACK_DEFAULT_LANGUAGE;
    }

    function getSubmissionLanguages() {
        return normaliseLanguageList(
            babelSettings.submissionLanguages,
            DEFAULT_BABEL_SETTINGS.submissionLanguages
        );
    }

    function getDeletionLanguages() {
        return normaliseLanguageList(
            babelSettings.deletionLanguages,
            DEFAULT_BABEL_SETTINGS.deletionLanguages
        );
    }

    function updateLastDeletionLanguage(language) {
        if (!LANGUAGES.includes(language)) return;

        const nextSettings = Object.assign({}, babelSettings, {
            lastDeletionLanguage: language
        });

        saveBabelSettings(nextSettings);
    }

    function chooseNextDeletionLanguage() {
        const deletionLanguages = getDeletionLanguages();

        if (deletionLanguages.length === 0) {
            warn("No deletion languages configured; falling back to default language");
            return getDefaultLanguage();
        }

        const last = babelSettings.lastDeletionLanguage;
        const lastIndex = deletionLanguages.indexOf(last);

        const nextIndex = lastIndex >= 0
        ? (lastIndex + 1) % deletionLanguages.length
        : 0;

        return deletionLanguages[nextIndex];
    }

    // =========================================================================
    // Language scoring
    // =========================================================================

    function hasPendingNominationForScoring(record) {
        const status = normalizeNominationStatus(record.status);

        if (record.trackingComplete) return false;
        if (record.appealResolved) return false;

        // Rejected items are still tracked for possible appeal,
        // but do NOT count as pending for scoring.
        if (status === "REJECTED") return false;
        if (status === "ACCEPTED") return false;
        if (status === "WITHDRAWN") return false;
        if (status === "APPEALED") return false; // first outcome already happened

        return true;
    }

    function hasPendingAppealForScoring(record) {
        if (record.appealResolved) return false;

        const emails = record.emails || {};
        return !!emails.appealReceived;
    }

    function isLanguageComplete(hasTemplates) {
        return REQUIRED_TEMPLATE_KEYS.every(key => !!hasTemplates[key]);
    }

    function computeLanguageScore(summary) {
        const has = summary.hasTemplates;

        let score = 0;

        // Base score from missing templates
        for (const [emailKey, weight] of Object.entries(EMAIL_SCORE_WEIGHTS)) {
            if (!has[emailKey]) {
                score += weight;
            }
        }

        // If all four first-outcome templates are missing, and at least one
        // nomination is pending, then one of those outcomes is guaranteed eventually.
        const missingAllFourFirstOutcomes =
              !has.communityApproved &&
              !has.communityRejected &&
              !has.nianticApproved &&
              !has.nianticRejected;

        if (missingAllFourFirstOutcomes && summary.pendingNominations > 0) {
            score -= 4.5;
        }

        // If both appeal outcomes are missing, and at least one appeal is unresolved,
        // then one of those appeal outcomes is guaranteed eventually.
        const missingBothAppealOutcomes =
              !has.appealAccepted &&
              !has.appealRejected;

        if (missingBothAppealOutcomes && summary.pendingAppeals > 0) {
            score -= 1;
        }

        // General damping so one language doesn't dominate long submission runs
        score -= 0.5 * summary.pendingNominations;

        return score;
    }

    function computeLanguageSummaries(records) {
        const summaries = {};
        const submissionLanguages = new Set(getSubmissionLanguages());

        for (const lang of SORTED_LANGUAGES) {
            summaries[lang] = {
                language: lang,
                hasTemplates: makeEmptyEmails(),
                pendingNominations: 0,
                appealPlanned: 0,
                pendingAppeals: 0,
                score: 0,
                records: [],
                excluded: false,
                excludedReason: ""
            };
        }

        for (const record of records) {
            const lang = record.language;
            if (!summaries[lang]) continue;

            const summary = summaries[lang];
            summary.records.push(record);

            for (const key of EMAIL_KEYS) {
                if (record.emails && record.emails[key]) {
                    summary.hasTemplates[key] = true;
                }
            }

            if (hasPendingNominationForScoring(record)) {
                summary.pendingNominations += 1;
            }

            if (record.appealPlanned && !(record.emails && record.emails.appealReceived)) {
                summary.appealPlanned += 1;
            }

            if (hasPendingAppealForScoring(record)) {
                summary.pendingAppeals += 1;
            }
        }

        for (const lang of SORTED_LANGUAGES) {
            const summary = summaries[lang];

            if (!submissionLanguages.has(lang)) {
                summary.excluded = true;
                summary.excludedReason = "Disabled";
                summary.score = -Infinity;
                continue;
            }

            if (isLanguageComplete(summary.hasTemplates)) {
                summary.excluded = true;
                summary.excludedReason = "Complete";
                summary.score = -Infinity;
                continue;
            }

            summary.score = computeLanguageScore(summary);
        }

        return summaries;
    }

    function chooseBestLanguage(records) {
        const summaries = computeLanguageSummaries(records);
        const defaultLanguage = getDefaultLanguage();

        const candidateRows = SORTED_LANGUAGES
        .map(lang => summaries[lang])
        .filter(summary => !summary.excluded);

        if (candidateRows.length === 0) {
            warn("No eligible incomplete submission languages found; falling back to default language");
            return {
                selectedLanguage: defaultLanguage,
                summaries,
                consoleRows: []
            };
        }

        const maxScore = Math.max(...candidateRows.map(r => r.score));
        const scoreTied = candidateRows.filter(r => r.score === maxScore);
        const minPending = Math.min(...scoreTied.map(r => r.pendingNominations));
        const finalists = scoreTied.filter(r => r.pendingNominations === minPending);

        const selected = finalists[Math.floor(Math.random() * finalists.length)];

        const consoleRows = SORTED_LANGUAGES.map(lang => {
            const r = summaries[lang];
            return {
                language: r.language,
                submissionReceived: !!r.hasTemplates.submissionReceived,
                communityApproved: !!r.hasTemplates.communityApproved,
                communityRejected: !!r.hasTemplates.communityRejected,
                nianticApproved: !!r.hasTemplates.nianticApproved,
                nianticRejected: !!r.hasTemplates.nianticRejected,
                appealReceived: !!r.hasTemplates.appealReceived,
                appealAccepted: !!r.hasTemplates.appealAccepted,
                appealRejected: !!r.hasTemplates.appealRejected,
                pendingNominations: r.pendingNominations,
                pendingAppeals: r.pendingAppeals,
                score: r.excluded ? `EXCLUDED: ${r.excludedReason}` : r.score,
                selected: r.language === selected.language
            };
        });

        log("Selected submission language:", selected.language);

        return {
            selectedLanguage: selected.language,
            summaries,
            consoleRows
        };
    }

    // =========================================================================
    // Network helpers
    // =========================================================================

    function getCookie(name) {
        const match = document.cookie.match(new RegExp("(^|; )" + name + "=([^;]*)"));
        return match ? decodeURIComponent(match[2]) : null;
    }

    function getCsrfToken() {
        return getCookie("XSRF-TOKEN") || "";
    }

    function setLanguageXHR(language) {
        return new Promise((resolve, reject) => {
            const xhr = new XMLHttpRequest();
            xhr.open("POST", SETTINGS_ENDPOINT, true);
            xhr.withCredentials = true;
            xhr.setRequestHeader("Content-Type", "application/json;charset=UTF-8");

            const csrf = getCsrfToken();
            if (csrf) {
                xhr.setRequestHeader("x-csrf-token", csrf);
            }

            xhr.onload = function () {
                const text = xhr.responseText || xhr.response;
                const json = safeJsonParse(text);

                if (xhr.status >= 200 && xhr.status < 300 && json && json.code === "OK") {
                    latestKnownLanguage = language;
                    resolve(json);
                } else {
                    reject(new Error(`Language switch failed (${xhr.status}): ${text}`));
                }
            };

            xhr.onerror = function () {
                reject(new Error("Network error while switching language"));
            };

            xhr.send(JSON.stringify({ language }));
        });
    }

    async function safeSwitchLanguage(language, reason) {
        if (languageSwitchInFlight) {
            warn("Language switch already in flight; skipping", language, reason);
            return false;
        }

        languageSwitchInFlight = true;
        try {
            log(`Switching language to ${language} (${reason})`);
            await setLanguageXHR(language);
            return true;
        } catch (err) {
            error(`Failed to switch language to ${language} (${reason})`, err);
            return false;
        } finally {
            languageSwitchInFlight = false;
        }
    }

    // =========================================================================
    // Submission + matching logic
    // =========================================================================

    function buildRecordFromSubmitPayload(payload, language, submissionSessionId) {
        return ensureRecordShape({
            id: randomId("lob-rec"),
            type: "nomination",
            sourceId: null,
            createdAt: nowIso(),
            updatedAt: nowIso(),
            day: todayYYYYMMDD(),
            language,
            originalTitle: payload.title || "",
            latestTitle: payload.title || "",
            description: payload.description || "",
            statement: payload.supportingStatement || "",
            lat: Number(payload.lat),
            lng: Number(payload.lng),
            lat6: truncateCoordinate6(payload.lat),
            lng6: truncateCoordinate6(payload.lng),
            status: "NOMINATED",
            sawVoting: false,
            sawNianticVoting: false,
            sawReturnedFromNianticVoting: false,
            canAppeal: false,
            appealResolved: false,
            appealNotes: "",
            userAppealNotes: "",
            matchedToManage: false,
            trackingComplete: false,
            pendingForScoring: true,
            lastSeenAt: null,
            submissionSessionId,
            emails: Object.assign(makeEmptyEmails(), {
                submissionReceived: true
            })
        });
    }

    async function handleSuccessfulSubmitPayload(payload) {
        if (submissionCancelTimer) {
            clearTimeout(submissionCancelTimer);
            submissionCancelTimer = null;
        }

        const language = pendingSubmissionLanguage || latestKnownLanguage || getDefaultLanguage();
        const submissionSessionId = pendingSubmissionSessionId || randomId("lob-sub");

        const record = buildRecordFromSubmitPayload(payload, language, submissionSessionId);
        await putRecord(record);

        successfulSubmitOccurredForCurrentModal = true;

        await safeSwitchLanguage(getDefaultLanguage(), "post-submit revert");

        pendingSubmissionLanguage = null;
        pendingSubmissionSessionId = null;
        pendingSubmissionStartedAt = null;
        submitNowInitiated = false;
        submitNowInitiatedAt = null;

        await refreshCache();
    }

    function nominationLooksLikeMatch(record, submission) {
        if (!record || !submission) return false;

        const sameDay = record.day === submission.day;
        const sameLat = coordsEqual6(record.lat6, submission.lat);
        const sameLng = coordsEqual6(record.lng6, submission.lng);

        if (!(sameDay && sameLat && sameLng)) {
            return false;
        }

        return true;
    }

    function scoreMatchConfidence(record, submission) {
        let score = 0;

        if (record.day === submission.day) score += 100;
        if (coordsEqual6(record.lat6, submission.lat)) score += 100;
        if (coordsEqual6(record.lng6, submission.lng)) score += 100;

        const recTitle = String(record.originalTitle || "").trim();
        const subTitle = String(submission.title || "").trim();
        if (recTitle && subTitle && recTitle === subTitle) score += 20;

        const recDesc = String(record.description || "").trim();
        const subDesc = String(submission.description || "").trim();
        if (recDesc && subDesc && recDesc === subDesc) score += 10;

        const recStmt = String(record.statement || "").trim();
        const subStmt = String(submission.statement || "").trim();
        if (recStmt && subStmt && recStmt === subStmt) score += 10;

        return score;
    }

    function inferEmailsForSubmission(record, submission) {
        const existingEmails = Object.assign(makeEmptyEmails(), record.emails || {});
        const inferred = Object.assign(makeEmptyEmails(), existingEmails);

        const status = normalizeNominationStatus(record.status);
        const rawStatus = submission.status || record.status || "";
        const appealResolved = !!submission.appealResolved;
        const appealNotes = submission.appealNotes || "";
        const userAppealNotes = submission.userAppealNotes || "";

        inferred.submissionReceived = true;

        const wasAppealed = status === "APPEALED" || appealNotes !== "" || userAppealNotes !== "" || appealResolved;

        if (wasAppealed) {
            inferred.appealReceived = true;
        }

        updateVotingPathFlags(record, rawStatus);

        function isNominatedStatus(status) {
            const s = String(status || "").toUpperCase().replace(/[_-]+/g, " ").trim();
            return s === "NOMINATED";
        }

        if (appealResolved && status === "ACCEPTED") {
            inferred.appealReceived = true;
            inferred.appealAccepted = true;
            return inferred;
        }

        if (appealResolved && status === "REJECTED") {
            inferred.appealReceived = true;
            inferred.appealRejected = true;
            return inferred;
        }

        if (status === "ACCEPTED" && !appealResolved) {
            // Do not overwrite existing/manual approval classification.
            if (hasAnyApprovalOutcome(existingEmails)) {
                return inferred;
            }

            if (record.sawVoting) {
                inferred.communityApproved = true;
            } else if (record.sawNianticVoting && !record.sawVoting) {
                inferred.nianticApproved = true;
            } else {
                inferred.approvalUnknown = true;
            }

            return inferred;
        }

        if (status === "REJECTED" && !appealResolved) {
            // Do not overwrite existing/manual rejection classification.
            if (hasAnyRejectionOutcome(existingEmails)) {
                return inferred;
            }

            if (record.sawVoting) {
                inferred.communityRejected = true;
            } else if (record.sawNianticVoting && !record.sawVoting) {
                inferred.nianticRejected = true;
            } else {
                inferred.rejectionUnknown = true;
            }

            return inferred;
        }

        return inferred;
    }

    async function reconcileManageSubmissions(manageSubmissions) {
        const records = await getAllRecords();
        const updated = [];
        const unmatchedDiagnostics = [];

        for (const submission of manageSubmissions) {
            const sourceId = submission.id;

            // First preference: match existing record already linked by sourceId
            let linkedRecord = records.find(r => r.sourceId && r.sourceId === sourceId) || null;

            if (!linkedRecord) {
                // Find unmatched records that could correspond to this contribution
                const candidates = records
                .filter(r =>
                        r.type === "nomination" &&
                        !r.sourceId &&
                        daysBetween(r.day, submission.day) <= MANAGE_MATCH_WINDOW_DAYS &&
                        nominationLooksLikeMatch(r, submission)
                       )
                .map(r => ({ record: r, score: scoreMatchConfidence(r, submission) }))
                .sort((a, b) => b.score - a.score);

                if (candidates.length > 0) {
                    linkedRecord = candidates[0].record;
                    linkedRecord.sourceId = sourceId;
                    linkedRecord.matchedToManage = true;
                }
            }

            if (!linkedRecord) continue;

            // =========================================================
            // Backfill coordinates for historical/manual records
            // =========================================================
            const submissionLat = Number(submission.lat);
            const submissionLng = Number(submission.lng);
            const submissionLat6 = truncateCoordinate6(submission.lat);
            const submissionLng6 = truncateCoordinate6(submission.lng);

            const hadMissingCoords =
                  linkedRecord.lat == null ||
                  linkedRecord.lng == null ||
                  linkedRecord.lat6 == null ||
                  linkedRecord.lng6 == null;

            if (hadMissingCoords) {
                linkedRecord.lat = Number.isFinite(submissionLat) ? submissionLat : linkedRecord.lat;
                linkedRecord.lng = Number.isFinite(submissionLng) ? submissionLng : linkedRecord.lng;
                linkedRecord.lat6 = submissionLat6 != null ? submissionLat6 : linkedRecord.lat6;
                linkedRecord.lng6 = submissionLng6 != null ? submissionLng6 : linkedRecord.lng6;
            }

            linkedRecord.status = normalizeNominationStatus(submission.status || linkedRecord.status);
            linkedRecord.latestTitle = submission.title || linkedRecord.latestTitle || linkedRecord.originalTitle;
            linkedRecord.description = submission.description || linkedRecord.description;
            linkedRecord.statement = submission.statement || linkedRecord.statement;
            linkedRecord.canAppeal = !!submission.canAppeal;
            linkedRecord.appealResolved = !!submission.appealResolved;
            linkedRecord.appealNotes = submission.appealNotes || "";
            linkedRecord.userAppealNotes = submission.userAppealNotes || "";
            linkedRecord.lastSeenAt = nowIso();

            updateVotingPathFlags(linkedRecord, submission.status);

            const inferredEmails = inferEmailsForSubmission(linkedRecord, submission);
            linkedRecord.emails = mergeEmails(linkedRecord.emails, inferredEmails, linkedRecord.manualOverrides);

            if (linkedRecord.emails && linkedRecord.emails.appealReceived) {
                linkedRecord.appealPlanned = false;
            }

            linkedRecord.trackingComplete = !shouldKeepTracking(linkedRecord);
            linkedRecord.pendingForScoring = canStillGenerateOutcomeEmails(linkedRecord);

            updated.push(linkedRecord);
        }

        // Diagnostics for unmatched stored records
        const stillUnmatched = records.filter(r =>
                                              r.type === "nomination" &&
                                              !r.sourceId &&
                                              daysBetween(r.day, todayYYYYMMDD()) <= MANAGE_MATCH_WINDOW_DAYS
                                             );

        for (const record of stillUnmatched) {
            const candidateMatches = manageSubmissions
            .map(sub => ({
                id: sub.id,
                score: scoreMatchConfidence(record, sub),
                day: sub.day,
                title: sub.title,
                lat: truncateCoordinate6(sub.lat),
                lng: truncateCoordinate6(sub.lng),
                status: sub.status
            }))
            .filter(x => x.score > 0)
            .sort((a, b) => b.score - a.score)
            .slice(0, 5);

            unmatchedDiagnostics.push({
                localId: record.id,
                submissionSessionId: record.submissionSessionId,
                originalTitle: record.originalTitle,
                day: record.day,
                lat6: record.lat6,
                lng6: record.lng6,
                candidateMatches
            });
        }

        if (updated.length > 0) {
            await putRecords(updated);
        }

        await refreshCache();
        return updated;
    }

    // =========================================================================
    // UI summary helpers
    // =========================================================================

    async function getLanguageSummaryRows() {
        const records = await getAllRecords();
        const summaries = computeLanguageSummaries(records);
        const displayLanguages = new Set(getSubmissionLanguages());

        const rows = SORTED_LANGUAGES
        .filter(lang => displayLanguages.has(lang))
        .map(lang => ({
            language: lang,
            hasTemplates: summaries[lang].hasTemplates,
            pendingNominations: summaries[lang].pendingNominations,
            appealPlanned: summaries[lang].appealPlanned,
            pendingAppeals: summaries[lang].pendingAppeals,
            score: summaries[lang].excluded ? "" : summaries[lang].score,
            excluded: summaries[lang].excluded,
            excludedReason: summaries[lang].excludedReason
        }));

        const eligibleRows = rows.filter(r => !r.excluded);
        const maxScore = eligibleRows.length ? Math.max(...eligibleRows.map(r => Number(r.score))) : -Infinity;

        const topLanguages = new Set(
            eligibleRows
            .filter(r => Number(r.score) === maxScore)
            .map(r => r.language)
        );

        return { rows, topLanguages };
    }

    async function getLanguageRecords(language) {
        const records = await getAllRecords();

        return records
            .filter(r => r.language === language)
            .sort((a, b) => {
            const dayCompare = String(b.day || "").localeCompare(String(a.day || ""));
            if (dayCompare !== 0) return dayCompare;

            const aTime = new Date(a.createdAt || a.updatedAt || a.lastSeenAt || 0).getTime();
            const bTime = new Date(b.createdAt || b.updatedAt || b.lastSeenAt || 0).getTime();

            return bTime - aTime;
        });
    }

    // =========================================================================
    // Modal UI
    // =========================================================================

    function styleButton(btn, primary = false) {
        Object.assign(btn.style, {
            padding: "5px 10px",
            borderRadius: "4px",
            border: primary ? "1px solid #2563eb" : "1px solid #d1d5db",
            background: primary ? "#2563eb" : "#ffffff",
            color: primary ? "#ffffff" : "#111827",
            cursor: "pointer",
            fontSize: "12px"
        });
    }

    function makeBackdrop(id) {
        const backdrop = document.createElement("div");
        backdrop.id = id;
        Object.assign(backdrop.style, {
            position: "fixed",
            inset: "0",
            background: "rgba(0,0,0,0.35)",
            zIndex: "2500",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            overflowY: "auto",
            paddingTop: "8px",
            paddingBottom: "8px"
        });
        return backdrop;
    }

    function attachEscapeHandler(backdrop, onClose) {
        function closeBackdrop() {
            if (typeof onClose === "function") {
                onClose();
            } else {
                backdrop.remove();
            }
        }

        function onKeyDown(ev) {
            if (ev.key !== "Escape") return;

            // Only act if THIS backdrop is the top-most modal
            const allBackdrops = Array.from(document.querySelectorAll("body > div"));
            const topMost = allBackdrops[allBackdrops.length - 1];

            if (topMost !== backdrop) return;

            ev.stopPropagation();
            ev.preventDefault();

            closeBackdrop();
            document.removeEventListener("keydown", onKeyDown, true);
        }

        document.addEventListener("keydown", onKeyDown, true);

        // Clean up if removed manually (click etc.)
        const observer = new MutationObserver(() => {
            if (!document.body.contains(backdrop)) {
                document.removeEventListener("keydown", onKeyDown, true);
                observer.disconnect();
            }
        });

        observer.observe(document.body, { childList: true });
    }

    function makeDialog(width = "70vw", height = "70vh") {
        const dialog = document.createElement("div");
        Object.assign(dialog.style, {
            background: "#ffffff",
            borderRadius: "8px",
            boxShadow: "0 10px 25px rgba(0,0,0,0.35)",
            width,
            maxWidth: width,
            padding: "10px 12px 8px",
            boxSizing: "border-box",
            fontFamily: "Roboto, Arial, sans-serif",
            fontSize: "11px",
            color: "#111827",
            maxHeight: height,
            overflowY: "auto",
            overflowX: "auto"
        });
        return dialog;
    }

    function makeSimpleTable() {
        const table = document.createElement("table");
        Object.assign(table.style, {
            width: "100%",
            borderCollapse: "collapse",
            fontSize: "11px",
            tableLayout: "fixed"
        });
        return table;
    }

    function styleCell(cell, header = false) {
        Object.assign(cell.style, {
            border: "1px solid #e5e7eb",
            padding: "3px 5px",
            lineHeight: "1.15",
            height: "22px",
            textAlign: "center",
            verticalAlign: "middle",
            background: header ? "#f3f4f6" : "#ffffff",
            fontWeight: header ? "600" : "400",
            boxSizing: "border-box"
        });
    }

    function createHeaderRow(headers) {
        const tr = document.createElement("tr");
        for (const h of headers) {
            const th = document.createElement("th");
            th.textContent = h;
            styleCell(th, true);
            tr.appendChild(th);
        }
        return tr;
    }

    function makeCommunityIcon() {
        const span = document.createElement("span");
        span.innerHTML = `
        <svg fill="none" viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg" style="width:14px;height:14px;display:inline-block;vertical-align:middle;">
            <path d="m5.6334 1.3516c-0.50443 0.0567-1.0357 0.24936-1.4667 0.53188-0.36184 0.23718-0.70932 0.58463-0.94979 0.94973-0.78295 1.1887-0.72416 2.7338 0.1474 3.875 0.10802 0.14144 0.38819 0.42714 0.53572 0.54632 1.2057 0.97403 2.9032 0.9936 4.1417 0.04773 0.14143-0.10801 0.42713-0.38818 0.54631-0.53571 0.99149-1.2273 0.99149-2.9727 0-4.2-0.11918-0.14754-0.40488-0.4277-0.54631-0.53572-0.49627-0.37902-1.0793-0.6129-1.6952-0.67998-0.18546-0.0202-0.53-0.01985-0.71315 7.5e-4zm4.8648 0.08803c-0.2 0.05795-0.347 0.18372-0.4371 0.37392-0.0479 0.1012-0.0527 0.12575-0.0521 0.26966 8e-4 0.19997 0.0414 0.3112 0.1611 0.44222 0.1089 0.11918 0.1778 0.158 0.4224 0.23813 0.3291 0.10782 0.5563 0.24029 0.7854 0.45792 0.3188 0.30283 0.5445 0.73942 0.6043 1.169 0.0678 0.48778-0.0446 0.97453-0.3209 1.3896-0.2689 0.40396-0.6499 0.67815-1.1399 0.82046-0.2265 0.06577-0.3661 0.18097-0.4603 0.37975-0.0479 0.1012-0.0527 0.12575-0.0521 0.26967 5e-4 0.12493 0.0087 0.17867 0.0389 0.25475 0.0535 0.13475 0.1916 0.27977 0.3325 0.34912 0.1037 0.0511 0.1214 0.05445 0.2859 0.05431 0.1628-1.5e-4 0.1904-0.0053 0.3837-0.07151 0.5184-0.17755 0.9379-0.43845 1.317-0.81904 0.4676-0.46955 0.7672-1.0311 0.9087-1.7033 0.0537-0.25502 0.0744-0.76184 0.0419-1.0254-0.1134-0.92072-0.5822-1.7371-1.3092-2.2798-0.2227-0.16625-0.3312-0.23205-0.5775-0.35048-0.4001-0.19242-0.745-0.27337-0.9327-0.21897zm-4.7565 1.246c-0.43014 0.05483-0.83595 0.2563-1.1511 0.57147-0.9752 0.97518-0.69465 2.6096 0.55112 3.2108 0.75761 0.36563 1.6669 0.20833 2.2675-0.39225 0.85882-0.8588 0.76173-2.2684-0.20672-3.002-0.41085-0.3112-0.94675-0.45357-1.4608-0.38805zm-2.1083 6.666c-0.60401 0.0679-1.2736 0.34538-1.7167 0.71138-0.70502 0.5824-1.1359 1.3716-1.2324 2.2571-0.009933 0.0911-0.017633 0.5146-0.017633 0.969 0 0.7583 2e-3 0.8137 0.03305 0.9132 0.083083 0.2662 0.35281 0.4643 0.63221 0.4643 0.28347 0 0.5512-0.1958 0.63502-0.4643 0.03093-0.0991 0.03305-0.1547 0.03305-0.8671 0-0.4248 0.00765-0.8236 0.01732-0.9024 0.05563-0.4537 0.25013-0.8526 0.57323-1.1757 0.32308-0.3231 0.72203-0.5176 1.1757-0.5732 0.09082-0.0112 0.88805-0.0173 2.2338-0.0173s2.143 0.0061 2.2338 0.0173c0.22266 0.0273 0.4426 0.0926 0.64123 0.1904 0.61495 0.3028 1.0243 0.8787 1.1077 1.5585 0.00967 0.0788 0.0173 0.4776 0.0173 0.9024 0 0.7124 0.0021 0.768 0.0331 0.8671 0.0831 0.2662 0.3528 0.4643 0.6322 0.4643 0.2835 0 0.5512-0.1958 0.635-0.4643 0.0311-0.0995 0.0331-0.1549 0.0331-0.9132 0-0.4544-0.0077-0.8779-0.0177-0.969-0.0697-0.6398-0.325-1.2551-0.7277-1.7535-0.1192-0.1476-0.4049-0.4277-0.5463-0.5358-0.49628-0.37897-1.0793-0.61285-1.6952-0.67993-0.1956-0.02132-4.5231-0.02062-4.7132 7.5e-4zm8.8648 0.08803c-0.2 0.05795-0.347 0.18372-0.4371 0.37392-0.0479 0.1012-0.0527 0.12575-0.0521 0.26963 8e-4 0.2 0.0414 0.3112 0.1611 0.4422 0.1093 0.1197 0.1777 0.158 0.4274 0.2398 0.2431 0.0797 0.4187 0.1697 0.6083 0.312 0.3081 0.2312 0.5472 0.5589 0.6751 0.9253 0.1056 0.3023 0.1062 0.3091 0.1181 1.2724 0.0121 0.9837 0.0088 0.9549 0.1308 1.1163 0.276 0.365 0.7962 0.365 1.0743 0 0.0347-0.0457 0.078-0.1306 0.0962-0.1889 0.0311-0.0995 0.0331-0.1549 0.0331-0.9132 0-0.4544-0.0077-0.8779-0.0177-0.969-0.0692-0.636-0.3274-1.2581-0.7277-1.7535-0.1192-0.1476-0.4049-0.4278-0.5463-0.5357-0.2883-0.22012-0.6618-0.41718-1.0083-0.53202-0.2354-0.07796-0.4055-0.0968-0.5352-0.05923z" clip-rule="evenodd" fill="currentColor" fill-rule="evenodd"/>
        </svg>
    `;
        return span;
    }

    function makeNianticIcon() {
        const img = document.createElement("img");
        img.src = "/imgpub/logos/niantic-airship.svg";
        img.alt = "Niantic";
        Object.assign(img.style, {
            width: "16px",
            height: "16px",
            display: "inline-block",
            verticalAlign: "middle"
        });
        return img;
    }

    function makeEnvelopeIcon() {
        const span = document.createElement("span");
        span.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg"
             width="14" height="14"
             viewBox="0 0 16 16"
             fill="#000000"
             style="display:inline-block;vertical-align:middle;">
            <path d="M0 4a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2zm2-1a1 1 0 0 0-1 1v.217l7 4.2 7-4.2V4a1 1 0 0 0-1-1zm13 2.383-4.708 2.825L15 11.105zm-.034 6.876-5.64-3.471L8 9.583l-1.326-.795-5.64 3.47A1 1 0 0 0 2 13h12a1 1 0 0 0 .966-.741M1 11.105l4.708-2.897L1 5.383z"/>
        </svg>
    `;
        return span;
    }

    function appendHeaderContent(cell, content) {
        if (content instanceof Node) {
            cell.appendChild(content);
        } else {
            cell.textContent = content;
        }
    }

    function createBabelGroupedHeaderRow() {
        const tr = document.createElement("tr");

        const headers = [
            { text: "Language", rowspan: 2 },
            { text: "Details", rowspan: 2 },
            { content: makeEnvelopeIcon(), rowspan: 2, title: "Submitted" },
            { text: "Approved ✓", colspan: 2 },
            { text: "Rejected ✗", colspan: 2 },
            { text: "Appeals", colspan: 3 },
            { text: "Pending", rowspan: 2 },
            { text: "Planned Appeals", rowspan: 2 },
            { text: "Pending Appeals", rowspan: 2 },
            { text: "Score", rowspan: 2 }
        ];

        for (const h of headers) {
            const th = document.createElement("th");
            styleCell(th, true);

            if (h.content) {
                appendHeaderContent(th, h.content);
            } else {
                th.textContent = h.text;
            }

            if (h.rowspan) th.rowSpan = h.rowspan;
            if (h.colspan) th.colSpan = h.colspan;
            if (h.title) th.title = h.title;

            tr.appendChild(th);
        }

        return tr;
    }

    function createBabelSubHeaderRow() {
        const tr = document.createElement("tr");

        const headers = [
            { content: makeCommunityIcon(), title: "Community approved" },
            { content: makeNianticIcon(), title: "Niantic approved" },
            { content: makeCommunityIcon(), title: "Community rejected" },
            { content: makeNianticIcon(), title: "Niantic rejected" },
            { content: makeEnvelopeIcon(), title: "Appeal submitted" },
            { content: "✓", title: "Appeal accepted" },
            { content: "✗", title: "Appeal rejected" }
        ];

        for (const h of headers) {
            const th = document.createElement("th");
            styleCell(th, true);
            th.title = h.title;
            appendHeaderContent(th, h.content);
            tr.appendChild(th);
        }

        return tr;
    }

    async function openLibraryOfBabelModal() {
        if (document.getElementById(BABEL_MODAL_BACKDROP_ID)) return;

        const { rows, topLanguages } = await getLanguageSummaryRows();
        const backdrop = makeBackdrop(BABEL_MODAL_BACKDROP_ID);
        const dialog = makeDialog("70vw", "70vh");

        const title = document.createElement("div");
        title.textContent = "Library of Babel";
        Object.assign(title.style, {
            fontSize: "18px",
            fontWeight: "600",
            marginBottom: "10px"
        });
        dialog.appendChild(title);

        const table = makeSimpleTable();

        const colgroup = document.createElement("colgroup");

        const colLanguage = document.createElement("col");
        colLanguage.style.width = "70px";
        colgroup.appendChild(colLanguage);

        const colDetails = document.createElement("col");
        colDetails.style.width = "70px";
        colgroup.appendChild(colDetails);

        for (let i = 0; i < 8; i++) {
            const col = document.createElement("col");
            col.style.width = "64px";
            colgroup.appendChild(col);
        }

        for (let i = 0; i < 4; i++) {
            const col = document.createElement("col");
            col.style.width = "70px";
            colgroup.appendChild(col);
        }

        table.appendChild(colgroup);

        const thead = document.createElement("thead");
        thead.appendChild(createBabelGroupedHeaderRow());
        thead.appendChild(createBabelSubHeaderRow());
        table.appendChild(thead);

        const tbody = document.createElement("tbody");

        for (const row of rows) {
            const tr = document.createElement("tr");
            const isTop = topLanguages.has(row.language);
            const scoreText = row.excluded ? "—" : String(row.score);

            const languageTd = document.createElement("td");
            languageTd.textContent = row.language;
            styleCell(languageTd, false);
            languageTd.style.textAlign = "left";
            if (isTop) languageTd.style.background = "#fffbea";
            tr.appendChild(languageTd);

            const detailTd = document.createElement("td");
            styleCell(detailTd, false);

            if (isTop) {
                detailTd.style.background = "#fffbea";
            }

            const detailLink = document.createElement("a");
            detailLink.href = "#";
            detailLink.textContent = "View";
            detailLink.style.cursor = "pointer";
            detailLink.addEventListener("click", (ev) => {
                ev.preventDefault();
                openLanguageDetailModal(row.language);
            });

            detailTd.appendChild(detailLink);
            tr.appendChild(detailTd);

            appendSummaryMarkCell(
                tr,
                makeCheckMark(row.hasTemplates.submissionReceived),
                getImportedSummaryUsersFor(row.language, "submissionReceived"),
                "✓",
                isTop
            );

            appendSummaryMarkCell(
                tr,
                makeMainModalOutcomeMark(row.hasTemplates, "communityApproved", "approvalUnknown"),
                getImportedSummaryUsersFor(row.language, "communityApproved"),
                "✓",
                isTop
            );

            appendSummaryMarkCell(
                tr,
                makeMainModalOutcomeMark(row.hasTemplates, "nianticApproved", "approvalUnknown"),
                getImportedSummaryUsersFor(row.language, "nianticApproved"),
                "✓",
                isTop
            );

            appendSummaryMarkCell(
                tr,
                makeMainModalOutcomeMark(row.hasTemplates, "communityRejected", "rejectionUnknown"),
                getImportedSummaryUsersFor(row.language, "communityRejected"),
                "✓",
                isTop
            );

            appendSummaryMarkCell(
                tr,
                makeMainModalOutcomeMark(row.hasTemplates, "nianticRejected", "rejectionUnknown"),
                getImportedSummaryUsersFor(row.language, "nianticRejected"),
                "✓",
                isTop
            );

            appendSummaryMarkCell(
                tr,
                makeCheckMark(row.hasTemplates.appealReceived),
                getImportedSummaryUsersFor(row.language, "appealReceived"),
                "✓",
                isTop
            );

            appendSummaryMarkCell(
                tr,
                makeCheckMark(row.hasTemplates.appealAccepted),
                getImportedSummaryUsersFor(row.language, "appealAccepted"),
                "✓",
                isTop
            );

            appendSummaryMarkCell(
                tr,
                makeCheckMark(row.hasTemplates.appealRejected),
                getImportedSummaryUsersFor(row.language, "appealRejected"),
                "✓",
                isTop
            );

            const textCells = [
                String(row.pendingNominations),
                String(row.appealPlanned || 0),
                String(row.pendingAppeals || 0),
                scoreText
            ];

            for (const value of textCells) {
                const td = document.createElement("td");
                td.textContent = value;
                styleCell(td, false);
                if (isTop) td.style.background = "#fffbea";
                tr.appendChild(td);
            }

            tbody.appendChild(tr);
        }

        table.appendChild(tbody);
        dialog.appendChild(table);

        const buttonsRow = document.createElement("div");
        Object.assign(buttonsRow.style, {
            display: "flex",
            justifyContent: "flex-end",
            gap: "8px",
            marginTop: "10px"
        });

        const exportBtn = document.createElement("button");
        exportBtn.type = "button";
        exportBtn.textContent = "Export Summary";
        styleButton(exportBtn, false);
        exportBtn.addEventListener("click", () => {
            void exportLanguageSummaryJson();
        });

        const importBtn = document.createElement("button");
        importBtn.type = "button";
        importBtn.textContent = "Import Summary";
        styleButton(importBtn, false);
        importBtn.addEventListener("click", () => {
            void importLanguageSummaryJson();
        });

        const refreshBtn = document.createElement("button");
        refreshBtn.type = "button";
        refreshBtn.textContent = "Refresh";
        styleButton(refreshBtn, false);
        refreshBtn.addEventListener("click", async () => {
            backdrop.remove();
            await refreshCache();
            openLibraryOfBabelModal();
        });

        const settingsBtn = document.createElement("button");
        settingsBtn.type = "button";
        settingsBtn.textContent = "Settings";
        styleButton(settingsBtn, false);
        settingsBtn.addEventListener("click", () => {
            openBabelSettingsModal();
        });

        const closeBtn = document.createElement("button");
        closeBtn.type = "button";
        closeBtn.textContent = "Close";
        styleButton(closeBtn, true);
        closeBtn.addEventListener("click", () => backdrop.remove());

        buttonsRow.appendChild(settingsBtn);
        buttonsRow.appendChild(exportBtn);
        buttonsRow.appendChild(importBtn);
        buttonsRow.appendChild(refreshBtn);
        buttonsRow.appendChild(closeBtn);
        dialog.appendChild(buttonsRow);

        backdrop.addEventListener("click", (ev) => {
            if (ev.target === backdrop) backdrop.remove();
        });

        backdrop.appendChild(dialog);
        document.body.appendChild(backdrop);

        attachEscapeHandler(backdrop);
    }

    async function openLanguageDetailModal(language) {
        const existing = document.getElementById(BABEL_DETAIL_BACKDROP_ID);
        if (existing) existing.remove();

        const records = await getLanguageRecords(language);

        const backdrop = makeBackdrop(BABEL_DETAIL_BACKDROP_ID);
        const dialog = makeDialog("82vw", "78vh");

        async function closeDetailModal() {
            backdrop.remove();

            if (libraryOfBabelModalNeedsRefresh) {
                await refreshOpenLibraryOfBabelModal();
            }
        }

        const title = document.createElement("div");
        title.textContent = `Library of Babel — ${language}`;
        Object.assign(title.style, {
            fontSize: "17px",
            fontWeight: "600",
            marginBottom: "10px"
        });
        dialog.appendChild(title);

        const table = makeSimpleTable();

        const colgroup = document.createElement("colgroup");

        for (const width of ["90px", "260px", "150px"]) {
            const col = document.createElement("col");
            col.style.width = width;
            colgroup.appendChild(col);
        }

        for (let i = 0; i < 9; i++) {
            const col = document.createElement("col");
            col.style.width = "48px";
            colgroup.appendChild(col);
        }

        for (const width of ["105px", "56px", "52px"]) {
            const col = document.createElement("col");
            col.style.width = width;
            colgroup.appendChild(col);
        }

        table.appendChild(colgroup);

        const thead = document.createElement("thead");

        const topHeader = document.createElement("tr");

        const topHeaders = [
            { text: "Date", rowspan: 2 },
            { text: "Title", rowspan: 2 },
            { text: "Coordinates", rowspan: 2 },
            { text: "Approved ✓", colspan: 3 },
            { text: "Rejected ✗", colspan: 3 },
            { text: "Appeals", colspan: 3 },
            { text: "Status", rowspan: 2 },
            { text: "Appeal\nPlanned", rowspan: 2 },
            { text: "ID\nMatched", rowspan: 2 }
        ];

        for (const h of topHeaders) {
            const th = document.createElement("th");
            styleCell(th, true);
            th.style.whiteSpace = "normal";
            th.style.lineHeight = "1.1";
            th.textContent = h.text;
            th.style.whiteSpace = "pre-line";
            if (h.rowspan) th.rowSpan = h.rowspan;
            if (h.colspan) th.colSpan = h.colspan;
            topHeader.appendChild(th);
        }

        const subHeader = document.createElement("tr");

        const subHeaders = [
            { content: makeCommunityIcon(), title: "Community approved" },
            { content: makeNianticIcon(), title: "Niantic approved" },
            { content: "?", title: "Approval source unknown" },

            { content: makeCommunityIcon(), title: "Community rejected" },
            { content: makeNianticIcon(), title: "Niantic rejected" },
            { content: "?", title: "Rejection source unknown" },

            { content: makeEnvelopeIcon(), title: "Appeal submitted" },
            { content: "✓", title: "Appeal accepted" },
            { content: "✗", title: "Appeal rejected" }
        ];

        for (const h of subHeaders) {
            const th = document.createElement("th");
            styleCell(th, true);
            th.title = h.title;
            appendHeaderContent(th, h.content);
            subHeader.appendChild(th);
        }

        thead.appendChild(topHeader);
        thead.appendChild(subHeader);
        table.appendChild(thead);

        const tbody = document.createElement("tbody");

        const detailEmailKeys = [
            "communityApproved",
            "nianticApproved",
            "approvalUnknown",

            "communityRejected",
            "nianticRejected",
            "rejectionUnknown",

            "appealReceived",
            "appealAccepted",
            "appealRejected"
        ];

        for (const record of records) {
            const tr = document.createElement("tr");

            const coordText = `${fixed6(record.lat6)}, ${fixed6(record.lng6)}`;

            const basicValues = [
                record.day || "",
                record.latestTitle || record.originalTitle || "",
                coordText
            ];

            for (let i = 0; i < basicValues.length; i++) {
                const td = document.createElement("td");
                td.textContent = basicValues[i];
                styleCell(td, false);

                if (i === 1 || i === 2) {
                    td.style.textAlign = "left";
                }

                tr.appendChild(td);
            }

            for (const emailKey of detailEmailKeys) {
                const td = document.createElement("td");
                styleCell(td, false);
                td.style.width = "64px";
                td.style.minWidth = "64px";
                td.style.maxWidth = "64px";

                const checkbox = document.createElement("input");
                checkbox.type = "checkbox";
                checkbox.checked = !!(record.emails && record.emails[emailKey]);

                checkbox.addEventListener("change", async () => {
                    const fresh = await getRecordById(record.id);
                    if (!fresh) return;

                    const overrides = Object.assign({}, fresh.manualOverrides || {});
                    overrides[emailKey] = checkbox.checked;

                    fresh.manualOverrides = overrides;
                    fresh.emails = Object.assign({}, fresh.emails, { [emailKey]: checkbox.checked });

                    if (fresh.emails && fresh.emails.appealReceived) {
                        fresh.appealPlanned = false;
                    }

                    await putRecord(fresh);
                    await refreshCache();

                    libraryOfBabelModalNeedsRefresh = true;

                    if (emailKey === "appealReceived" && checkbox.checked) {
                        openLanguageDetailModal(language);
                    }
                });

                td.appendChild(checkbox);
                tr.appendChild(td);
            }

            const statusTd = document.createElement("td");
            statusTd.textContent = record.status || "";
            styleCell(statusTd, false);
            tr.appendChild(statusTd);

            const appealPlannedTd = document.createElement("td");
            styleCell(appealPlannedTd, false);

            const appealAlreadyReceived = !!(record.emails && record.emails.appealReceived);

            const appealPlannedCheckbox = document.createElement("input");
            appealPlannedCheckbox.type = "checkbox";
            appealPlannedCheckbox.checked = !!record.appealPlanned && !appealAlreadyReceived;
            appealPlannedCheckbox.disabled = appealAlreadyReceived;
            appealPlannedCheckbox.title = appealAlreadyReceived
                ? "Already appealed"
            : "Mark that you plan to appeal this nomination";

            appealPlannedCheckbox.addEventListener("change", async () => {
                const fresh = await getRecordById(record.id);
                if (!fresh) return;

                if (fresh.emails && fresh.emails.appealReceived) {
                    fresh.appealPlanned = false;
                } else {
                    fresh.appealPlanned = appealPlannedCheckbox.checked;
                }

                await putRecord(fresh);
                await refreshCache();

                libraryOfBabelModalNeedsRefresh = true;
            });

            appealPlannedTd.appendChild(appealPlannedCheckbox);
            tr.appendChild(appealPlannedTd);

            const matchedTd = document.createElement("td");
            matchedTd.textContent = record.sourceId ? "✓" : "";
            styleCell(matchedTd, false);
            tr.appendChild(matchedTd);

            tbody.appendChild(tr);
        }

        table.appendChild(tbody);
        dialog.appendChild(table);

        const buttonsRow = document.createElement("div");
        Object.assign(buttonsRow.style, {
            display: "flex",
            justifyContent: "flex-end",
            gap: "8px",
            marginTop: "10px"
        });

        const closeBtn = document.createElement("button");
        closeBtn.type = "button";
        closeBtn.textContent = "Close";
        styleButton(closeBtn, true);
        closeBtn.addEventListener("click", () => {
            void closeDetailModal();
        });

        buttonsRow.appendChild(closeBtn);
        dialog.appendChild(buttonsRow);

        backdrop.addEventListener("click", (ev) => {
            if (ev.target === backdrop) {
                void closeDetailModal();
            }
        });

        backdrop.appendChild(dialog);
        document.body.appendChild(backdrop);

        attachEscapeHandler(backdrop, () => {
            void closeDetailModal();
        });
    }

    // =========================================================================
    // Contribution Management UI
    // =========================================================================

    function bindNominationsListClickHandler() {
        const list = document.querySelector("app-submissions-list");
        if (!list || list.dataset.lobClickBound === "1") return;

        list.dataset.lobClickBound = "1";

        list.addEventListener("click", (e) => {
            const item = e.target.closest("app-submissions-list-item");
            if (!item) return;

            const ctx = item.__ngContext__;
            if (!ctx) return;

            const data = ctx[22]; // confirmed stable in other plugin
            if (!data || !data.id) return;

            const sourceId = data.id;

            latestSelectedManageId = sourceId;

            void tryInjectBabelPanelWithRetry(sourceId);
        });
    }

    async function tryInjectBabelPanelWithRetry(sourceId, maxAttempts = 12, delayMs = 150) {
        if (!sourceId) return;

        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
            // Stop retrying if the user has already clicked to a different nomination
            if (latestSelectedManageId !== sourceId) return;

            const inserted = await injectBabelPanelIntoDetailsPane(sourceId);
            if (inserted) {
                return;
            }

            await new Promise(resolve => setTimeout(resolve, delayMs));
        }

        warn(`Failed to inject Babel language control for ${sourceId} after ${maxAttempts} attempts`);
    }

    async function injectBabelPanelIntoDetailsPane(sourceId = latestSelectedManageId) {
        if (!isOnNominationsRoute()) return false;
        if (!sourceId) return false;

        const detailsCard = document.querySelector("app-details-pane .details-pane");
        if (!detailsCard) return false;

        const submission = latestManageSubmissionsById.get(sourceId);
        if (!submission) return false;

        const coordsLine = detailsCard.querySelector('p[title="Copy coordinates to clipboard"]');
        if (!coordsLine) return false;

        const existingRecord = await getBabelRecordForSourceId(sourceId);

        // Reuse wrapper if already created
        let wrapper = coordsLine.parentElement;
        const wrapperIsOurs = wrapper && wrapper.dataset && wrapper.dataset.lobCoordsRow === "1";

        if (!wrapperIsOurs) {
            wrapper = document.createElement("div");
            wrapper.dataset.lobCoordsRow = "1";

            Object.assign(wrapper.style, {
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: "12px",
                width: "100%"
            });

            coordsLine.parentNode.insertBefore(wrapper, coordsLine);
            wrapper.appendChild(coordsLine);

            Object.assign(coordsLine.style, {
                margin: "0",
                flex: "1 1 auto"
            });
        }

        // If row already exists for this exact source, just sync the dropdown and stop
        let row = wrapper.querySelector(`#${BABEL_DETAIL_PANEL_ID}`);
        if (row && row.dataset.sourceId === sourceId) {
            const select = row.querySelector("select");
            if (select) {
                const desiredValue = existingRecord?.language || "";
                if (select.value !== desiredValue) {
                    select.value = desiredValue;
                }
            }
            return true;
        }

        // If there is an old row from another selected nomination, replace it once
        if (row) {
            row.remove();
        }

        row = document.createElement("div");
        row.id = BABEL_DETAIL_PANEL_ID;
        row.dataset.sourceId = sourceId;

        Object.assign(row.style, {
            display: "flex",
            alignItems: "center",
            justifyContent: "flex-end",
            gap: "6px",
            marginLeft: "12px",
            flex: "0 0 auto",
            fontSize: "12px",
            color: "#374151",
            whiteSpace: "nowrap"
        });

        const label = document.createElement("span");
        label.textContent = "Language:";
        label.style.fontWeight = "500";

        const select = document.createElement("select");
        Object.assign(select.style, {
            padding: "2px 6px",
            border: "1px solid #d1d5db",
            borderRadius: "4px",
            fontSize: "12px",
            background: "#ffffff",
            color: "#111827",
            minWidth: "90px"
        });

        const blankOpt = document.createElement("option");
        blankOpt.value = "";
        blankOpt.textContent = "-";
        select.appendChild(blankOpt);

        for (const lang of SORTED_LANGUAGES) {
            const opt = document.createElement("option");
            opt.value = lang;
            opt.textContent = lang;
            select.appendChild(opt);
        }

        select.value = existingRecord?.language || "";

        select.addEventListener("change", async () => {
            try {
                if (!select.value) {
                    status.textContent = "";
                    return;
                }

                status.textContent = "...";

                const record = await upsertNominationLanguageFromManage(sourceId, select.value);
                row.dataset.sourceId = record.sourceId || sourceId;

                status.textContent = "Saved";
                setTimeout(() => {
                    if (status.textContent === "Saved") {
                        status.textContent = "";
                    }
                }, 1200);
            } catch (err) {
                console.error("[LibraryOfBabel] Failed to save nomination language:", err);
                status.textContent = "Error";
            }
        });

        const status = document.createElement("span");
        status.textContent = "";
        Object.assign(status.style, {
            minWidth: "38px",
            fontSize: "11px",
            color: "#6b7280"
        });

        row.appendChild(label);
        row.appendChild(select);
        row.appendChild(status);

        wrapper.appendChild(row);
        return true;
    }

    function openBabelSettingsModal() {
        const existing = document.getElementById(BABEL_SETTINGS_BACKDROP_ID);
        if (existing) existing.remove();

        const workingSettings = deepClone(babelSettings);

        const backdrop = makeBackdrop(BABEL_SETTINGS_BACKDROP_ID);
        const dialog = makeDialog("520px", "80vh");

        const title = document.createElement("div");
        title.textContent = "Library of Babel Settings";
        Object.assign(title.style, {
            fontSize: "18px",
            fontWeight: "600",
            marginBottom: "10px"
        });
        dialog.appendChild(title);

        const usernameRow = document.createElement("div");
        Object.assign(usernameRow.style, {
            marginBottom: "12px"
        });

        const usernameLabel = document.createElement("label");
        usernameLabel.textContent = "Username: ";
        usernameLabel.style.fontWeight = "600";

        const usernameInput = document.createElement("input");
        usernameInput.type = "text";
        usernameInput.value = workingSettings.username || "";
        usernameInput.placeholder = "Username for shared summaries";
        Object.assign(usernameInput.style, {
            marginLeft: "6px",
            padding: "4px 6px",
            width: "260px",
            border: "1px solid #d1d5db",
            borderRadius: "4px"
        });

        usernameRow.appendChild(usernameLabel);
        usernameRow.appendChild(usernameInput);
        dialog.appendChild(usernameRow);

        const defaultRow = document.createElement("div");
        Object.assign(defaultRow.style, {
            marginBottom: "12px"
        });

        const defaultLabel = document.createElement("label");
        defaultLabel.textContent = "Default language: ";
        defaultLabel.style.fontWeight = "600";

        const defaultSelect = document.createElement("select");
        Object.assign(defaultSelect.style, {
            marginLeft: "6px",
            padding: "4px 6px"
        });

        for (const lang of SORTED_LANGUAGES) {
            const opt = document.createElement("option");
            opt.value = lang;
            opt.textContent = lang;
            defaultSelect.appendChild(opt);
        }

        defaultSelect.value = workingSettings.defaultLanguage;

        defaultRow.appendChild(defaultLabel);
        defaultRow.appendChild(defaultSelect);
        dialog.appendChild(defaultRow);

        function makeLanguageCheckboxSection(titleText, selectedLanguages) {
            const section = document.createElement("div");
            Object.assign(section.style, {
                marginTop: "12px",
                borderTop: "1px solid #e5e7eb",
                paddingTop: "10px"
            });

            const heading = document.createElement("div");
            heading.textContent = titleText;
            Object.assign(heading.style, {
                fontWeight: "600",
                marginBottom: "6px"
            });

            section.appendChild(heading);

            const grid = document.createElement("div");
            Object.assign(grid.style, {
                display: "grid",
                gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
                gap: "4px 8px"
            });

            const checkboxMap = new Map();

            for (const lang of SORTED_LANGUAGES) {
                const label = document.createElement("label");
                Object.assign(label.style, {
                    display: "flex",
                    alignItems: "center",
                    gap: "4px",
                    cursor: "pointer"
                });

                const checkbox = document.createElement("input");
                checkbox.type = "checkbox";
                checkbox.checked = selectedLanguages.includes(lang);

                checkboxMap.set(lang, checkbox);

                const span = document.createElement("span");
                span.textContent = lang;

                label.appendChild(checkbox);
                label.appendChild(span);
                grid.appendChild(label);
            }

            section.appendChild(grid);

            return { section, checkboxMap };
        }

        const submissionSection = makeLanguageCheckboxSection(
            "Languages used for submissions",
            workingSettings.submissionLanguages
        );

        const deletionSection = makeLanguageCheckboxSection(
            "Languages used for deletions",
            workingSettings.deletionLanguages
        );

        dialog.appendChild(submissionSection.section);
        dialog.appendChild(deletionSection.section);

        const importedSection = document.createElement("div");
        Object.assign(importedSection.style, {
            marginTop: "12px",
            borderTop: "1px solid #e5e7eb",
            paddingTop: "10px",
            color: "#374151"
        });

        const importedHeading = document.createElement("div");
        importedHeading.textContent = "Imported summaries";
        Object.assign(importedHeading.style, {
            fontWeight: "600",
            marginBottom: "6px"
        });

        const importedSummaries = normaliseImportedSummaries(workingSettings.importedSummaries);

        const importedList = document.createElement("div");
        Object.assign(importedList.style, {
            display: "flex",
            flexDirection: "column",
            gap: "6px",
            fontSize: "11px"
        });

        if (importedSummaries.length === 0) {
            const emptyText = document.createElement("div");
            emptyText.textContent = "None imported";
            importedList.appendChild(emptyText);
        } else {
            for (const summary of importedSummaries) {
                const row = document.createElement("div");
                Object.assign(row.style, {
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: "8px",
                    border: "1px solid #e5e7eb",
                    borderRadius: "4px",
                    padding: "4px 6px",
                    background: "#ffffff"
                });

                const text = document.createElement("span");
                text.textContent = summary.username;
                text.title = summary.importedAt
                    ? `Imported: ${summary.importedAt}`
                : "";

                const deleteBtn = document.createElement("button");
                deleteBtn.type = "button";
                deleteBtn.textContent = "Delete";
                styleButton(deleteBtn, false);

                deleteBtn.addEventListener("click", () => {
                    const confirmed = confirm(`Delete imported summary for ${summary.username}?`);
                    if (!confirmed) return;

                    const nextImportedSummaries = normaliseImportedSummaries(babelSettings.importedSummaries)
                    .filter(s => s.username !== summary.username);

                    saveBabelSettings(Object.assign({}, babelSettings, {
                        importedSummaries: nextImportedSummaries
                    }));

                    backdrop.remove();

                    if (document.getElementById(BABEL_MODAL_BACKDROP_ID)) {
                        void refreshOpenLibraryOfBabelModal();
                    }

                    openBabelSettingsModal();
                });

                row.appendChild(text);
                row.appendChild(deleteBtn);
                importedList.appendChild(row);
            }
        }

        importedSection.appendChild(importedHeading);
        importedSection.appendChild(importedList);
        dialog.appendChild(importedSection);

        const buttonsRow = document.createElement("div");
        Object.assign(buttonsRow.style, {
            display: "flex",
            justifyContent: "flex-end",
            gap: "8px",
            marginTop: "14px"
        });

        const cancelBtn = document.createElement("button");
        cancelBtn.type = "button";
        cancelBtn.textContent = "Cancel";
        styleButton(cancelBtn, false);
        cancelBtn.addEventListener("click", () => backdrop.remove());

        const okBtn = document.createElement("button");
        okBtn.type = "button";
        okBtn.textContent = "OK";
        styleButton(okBtn, true);

        okBtn.addEventListener("click", () => {
            const submissionLanguages = [];
            const deletionLanguages = [];

            for (const [lang, checkbox] of submissionSection.checkboxMap.entries()) {
                if (checkbox.checked) submissionLanguages.push(lang);
            }

            for (const [lang, checkbox] of deletionSection.checkboxMap.entries()) {
                if (checkbox.checked) deletionLanguages.push(lang);
            }

            saveBabelSettings({
                defaultLanguage: defaultSelect.value,
                submissionLanguages,
                deletionLanguages,
                lastDeletionLanguage: babelSettings.lastDeletionLanguage,
                username: usernameInput.value,
                importedSummaries: babelSettings.importedSummaries
            });

            backdrop.remove();

            if (document.getElementById(BABEL_MODAL_BACKDROP_ID)) {
                void refreshOpenLibraryOfBabelModal();
            }
        });

        buttonsRow.appendChild(cancelBtn);
        buttonsRow.appendChild(okBtn);
        dialog.appendChild(buttonsRow);

        backdrop.addEventListener("click", (ev) => {
            if (ev.target === backdrop) backdrop.remove();
        });

        backdrop.appendChild(dialog);
        document.body.appendChild(backdrop);

        attachEscapeHandler(backdrop);
    }

    // =========================================================================
    // Side panel / route watchers
    // =========================================================================

    function insertLibraryOfBabelLinkIfReady() {
        const settingsBody = document.querySelector(".wfmapmods-settings-links");
        if (!settingsBody) return false;

        if (!document.getElementById(BABEL_LINK_ID)) {
            const link = document.createElement("a");
            link.id = BABEL_LINK_ID;
            link.textContent = "Library of Babel";
            link.style.cursor = "pointer";

            link.addEventListener("click", (ev) => {
                ev.preventDefault();
                openLibraryOfBabelModal();
            });

            settingsBody.appendChild(link);
        }

        return true;
    }

    function sidePanelMutationHandler() {
        const panelPresent = !!document.querySelector("#wfmapmods-side-panel");

        if (panelPresent) {
            const injected = insertLibraryOfBabelLinkIfReady();
            if (injected) {
                startSubmissionModalWatcher();
                startDeletionModalWatcher();
            }
        }
    }

    function startSidePanelWatcher() {
        if (sidePanelObserver) return;

        sidePanelMutationHandler();

        sidePanelObserver = new MutationObserver(() => {
            if (sidePanelMutationScheduled) return;
            sidePanelMutationScheduled = true;

            setTimeout(() => {
                sidePanelMutationScheduled = false;
                sidePanelMutationHandler();
            }, 50);
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

    // =========================================================================
    // Submission modal handlers
    // =========================================================================

    function handleSubmissionModalAppeared() {
        if (submissionModalArmed) return;
        submissionModalArmed = true;
        successfulSubmitOccurredForCurrentModal = false;
        submitNowInitiated = false;
        submitNowInitiatedAt = null;

        if (submissionCancelTimer) {
            clearTimeout(submissionCancelTimer);
            submissionCancelTimer = null;
        }

        pendingSubmissionSessionId = randomId("lob-sub");
        pendingSubmissionStartedAt = nowIso();

        void (async () => {
            try {
                const records = await getAllRecords();
                const selection = chooseBestLanguage(records);
                pendingSubmissionLanguage = selection.selectedLanguage;
                await safeSwitchLanguage(pendingSubmissionLanguage, "submission modal opened");
            } catch (err) {
                error("Error during modal-open language preparation", err);
            }
        })();
    }

    function handleSubmissionModalDisappeared() {
        if (!submissionModalArmed) return;

        submissionModalArmed = false;

        if (submissionCancelTimer) {
            clearTimeout(submissionCancelTimer);
            submissionCancelTimer = null;
        }

        submissionCancelTimer = setTimeout(async () => {
            submissionCancelTimer = null;

            if (submitNowInitiated || successfulSubmitOccurredForCurrentModal) {
                log("Submission modal closed after submit/now was initiated; not treating as cancel");
                return;
            }

            log("Submission modal closed and no submit/now request detected; reverting to default language");

            await safeSwitchLanguage(getDefaultLanguage(), "submission modal cancelled");

            pendingSubmissionLanguage = null;
            pendingSubmissionSessionId = null;
            pendingSubmissionStartedAt = null;

            submitInitiated = false;
            submitInitiatedAt = null;
            submitNowInitiated = false;
            submitNowInitiatedAt = null;

            successfulSubmitOccurredForCurrentModal = false;
        }, 1000);
    }

    function submissionModalMutationHandler() {
        const modalPresent = !!document.getElementById(SUBMISSION_MODAL_ID);

        if (modalPresent) {
            handleSubmissionModalAppeared();
        } else {
            handleSubmissionModalDisappeared();
        }
    }

    function startSubmissionModalWatcher() {
        if (submissionModalObserver) return;

        submissionModalMutationHandler();

        submissionModalObserver = new MutationObserver(() => {
            if (submissionModalMutationScheduled) return;
            submissionModalMutationScheduled = true;

            setTimeout(() => {
                submissionModalMutationScheduled = false;
                submissionModalMutationHandler();
            }, 50);
        });

        submissionModalObserver.observe(document.documentElement || document.body, {
            childList: true,
            subtree: true
        });
    }

    function stopSubmissionModalWatcher() {
        if (submissionModalObserver) {
            submissionModalObserver.disconnect();
            submissionModalObserver = null;
        }

        submissionModalArmed = false;
        successfulSubmitOccurredForCurrentModal = false;
        pendingSubmissionLanguage = null;
        pendingSubmissionSessionId = null;
        pendingSubmissionStartedAt = null;
    }

    // =========================================================================
    // Deletion modal handlers
    // =========================================================================

    function handleDeletionModalAppeared() {
        if (deletionModalArmed) return;

        deletionModalArmed = true;
        deletionReportSucceededForCurrentModal = false;
        deletionReportHandledForCurrentModal = false;
        deletionModalClosedAt = null;
        deletionReportInitiatedAt = null;

        pendingDeletionLanguage = chooseNextDeletionLanguage();

        log("Planned deletion language:", pendingDeletionLanguage);

        if (deletionCancelTimer) {
            clearTimeout(deletionCancelTimer);
            deletionCancelTimer = null;
        }

        void safeSwitchLanguage(pendingDeletionLanguage, "deletion report modal opened");
    }

    function handleDeletionModalDisappeared() {
        if (!deletionModalArmed) return;

        deletionModalArmed = false;
        deletionModalClosedAt = Date.now();

        if (deletionCancelTimer) {
            clearTimeout(deletionCancelTimer);
            deletionCancelTimer = null;
        }

        deletionCancelTimer = setTimeout(async () => {
            deletionCancelTimer = null;

            if (deletionReportHandledForCurrentModal || deletionReportSucceededForCurrentModal || deletionReportInitiatedAt) {
                return;
            }

            await safeSwitchLanguage(getDefaultLanguage(), "deletion report modal cancelled");

            pendingDeletionLanguage = null;
            deletionReportSucceededForCurrentModal = false;
            deletionReportHandledForCurrentModal = false;
            deletionModalClosedAt = null;
            deletionReportInitiatedAt = null;
        }, 1100);
    }

    function deletionModalMutationHandler() {
        const modal =
              document.getElementById("wfmapmods-poi-report")

        const modalPresent = !!modal;

        if (modalPresent) {
            handleDeletionModalAppeared();
        } else {
            handleDeletionModalDisappeared();
        }
    }

    function startDeletionModalWatcher() {
        if (deletionModalObserver) return;

        deletionModalMutationHandler();

        deletionModalObserver = new MutationObserver(() => {
            if (deletionModalMutationScheduled) return;
            deletionModalMutationScheduled = true;

            setTimeout(() => {
                deletionModalMutationScheduled = false;
                deletionModalMutationHandler();
            }, 50);
        });

        deletionModalObserver.observe(document.documentElement || document.body, {
            childList: true,
            subtree: true
        });
    }

    function stopDeletionModalWatcher() {
        if (deletionModalObserver) {
            deletionModalObserver.disconnect();
            deletionModalObserver = null;
        }

        deletionModalArmed = false;
        deletionReportSucceededForCurrentModal = false;
        pendingDeletionLanguage = null;
        deletionModalClosedAt = null;
        deletionReportInitiatedAt = null;
        deletionReportHandledForCurrentModal = false;

        if (deletionCancelTimer) {
            clearTimeout(deletionCancelTimer);
            deletionCancelTimer = null;
        }
    }

    // =========================================================================
    // Route change handlers
    // =========================================================================

    function onRouteChange() {
        if (isOnMapCapableRoute()) {
            startSidePanelWatcher();
        } else {
            stopSidePanelWatcher();
            stopSubmissionModalWatcher();
            stopDeletionModalWatcher();
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

        wrappedRouteChange();
    }

    // =========================================================================
    // XHR interception
    // =========================================================================

    (function patchXHR(open, send) {
        XMLHttpRequest.prototype.open = function (method, url) {
            const upperMethod = (method || "GET").toUpperCase();
            const cleanUrl = normalizeApiPath(url);

            this._lobMethod = upperMethod;
            this._lobUrl = cleanUrl;

            // =============================
            // Detect submit/upload START
            // =============================
            if (upperMethod === "GET" && cleanUrl === SUBMIT_UPLOAD_ENDPOINT) {
                submitInitiated = true;
                submitInitiatedAt = Date.now();

                if (submissionCancelTimer) {
                    clearTimeout(submissionCancelTimer);
                    submissionCancelTimer = null;
                }
            }

            // =============================
            // Intercept GET /manage
            // =============================
            if (upperMethod === "GET" && cleanUrl === MANAGE_ENDPOINT) {
                this.addEventListener("load", function () {
                    try {
                        const response = this.responseText || this.response;
                        const json = response ? JSON.parse(response) : null;

                        if (!json || json.captcha || json.code !== "OK") return;

                        const submissions = json?.result?.submissions;
                        if (!Array.isArray(submissions)) return;

                        lastManageRefreshAt = nowIso();
                        setLatestManageCache(submissions);

                        void reconcileManageSubmissions(submissions).catch(err => {
                            error("Error reconciling manage submissions", err);
                        });

                        setTimeout(bindNominationsListClickHandler, 0);

                        if (latestSelectedManageId) {
                            void tryInjectBabelPanelWithRetry(latestSelectedManageId, 3, 100);
                        }
                    } catch (err) {
                        warn("Error handling manage response:", err);
                    }
                }, false);
            }

            // =============================
            // Intercept POST /submit/now
            // =============================
            if (upperMethod === "POST" && cleanUrl === SUBMIT_NOW_ENDPOINT) {
                submitNowInitiated = true;
                submitNowInitiatedAt = Date.now();

                if (submissionCancelTimer) {
                    clearTimeout(submissionCancelTimer);
                    submissionCancelTimer = null;
                }

                this.addEventListener("load", function () {
                    try {
                        const response = this.responseText || this.response;
                        const json = response ? JSON.parse(response) : null;

                        if (!json || json.captcha) {
                            warn("submit/now response missing or captcha required");
                            return;
                        }

                        if (json.result !== "DONE") {
                            warn("submit/now did not succeed:", json);
                            return;
                        }

                        const payload = this._lobSubmitNowPayload;
                        if (!payload) {
                            warn("submit/now succeeded but no payload was captured");
                            return;
                        }

                        void handleSuccessfulSubmitPayload(payload).catch(err => {
                            error("Error storing submit/now payload", err);
                        });
                    } catch (err) {
                        warn("Error handling submit/now response:", err);
                    }
                }, false);
            }

            // =============================
            // Intercept POST poi-report deletion
            // =============================
            if (upperMethod === "POST" && cleanUrl === POI_REPORT_ENDPOINT) {
                deletionReportInitiatedAt = Date.now();
                deletionReportSucceededForCurrentModal = true;
                deletionReportHandledForCurrentModal = true;

                log("Detected poi-report request start", {
                    pendingDeletionLanguage,
                    deletionModalClosedAt,
                    deletionReportInitiatedAt
                });

                if (deletionCancelTimer) {
                    clearTimeout(deletionCancelTimer);
                    deletionCancelTimer = null;
                }

                this.addEventListener("load", function () {
                    try {
                        const response = this.responseText || this.response;
                        const json = response ? JSON.parse(response) : null;

                        const succeeded =
                              this.status >= 200 &&
                              this.status < 300 &&
                              json &&
                              !json.captcha &&
                              (
                                  json.code === "OK" ||
                                  json.result === "DONE" ||
                                  json.result === "OK"
                              );

                        if (!succeeded) {
                            deletionReportSucceededForCurrentModal = false;
                            deletionReportHandledForCurrentModal = false;

                            warn("poi-report did not succeed:", {
                                status: this.status,
                                response: json || response
                            });

                            return;
                        }

                        if (pendingDeletionLanguage) {
                            updateLastDeletionLanguage(pendingDeletionLanguage);
                            log("Saved last deletion language:", pendingDeletionLanguage);
                        }

                        void safeSwitchLanguage(getDefaultLanguage(), "post-deletion revert").then(() => {
                            pendingDeletionLanguage = null;
                            deletionReportSucceededForCurrentModal = false;

                            // Do NOT clear deletionReportHandledForCurrentModal here.
                            // It must remain true until the modal close watcher has run,
                            // otherwise modal close is misclassified as cancel.
                        });
                    } catch (err) {
                        deletionReportSucceededForCurrentModal = false;
                        deletionReportHandledForCurrentModal = false;
                        warn("Error handling poi-report response:", err);
                    }
                }, false);
            }

            // =============================
            // Track settings POST
            // =============================
            if (upperMethod === "POST" && cleanUrl === SETTINGS_ENDPOINT) {
                this.addEventListener("load", function () {
                    try {
                        const body = this._lobSettingsPayload;
                        if (!body || !body.language) return;

                        const response = this.responseText || this.response;
                        const json = response ? JSON.parse(response) : null;

                        if (json && json.code === "OK") {
                            latestKnownLanguage = body.language;
                        }
                    } catch (err) {
                        warn("Error observing settings response:", err);
                    }
                }, false);
            }

            open.apply(this, arguments);
        };

        XMLHttpRequest.prototype.send = function (body) {
            const method = this._lobMethod;
            const url = this._lobUrl;

            try {
                if (typeof body === "string" && body) {
                    const parsed = safeJsonParse(body);

                    if (method === "POST" && url === SUBMIT_NOW_ENDPOINT && parsed) {
                        this._lobSubmitNowPayload = parsed;
                    }

                    if (method === "POST" && url === SETTINGS_ENDPOINT && parsed) {
                        this._lobSettingsPayload = parsed;
                    }

                    if (method === "POST" && typeof url === "string" && url.startsWith(`${MANAGE_ENDPOINT}/`) && parsed) {
                        this._lobManagePayload = parsed;
                    }
                }
            } catch (err) {
                warn("Error parsing XHR send body:", err);
            }

            send.apply(this, arguments);
        };
    })(XMLHttpRequest.prototype.open, XMLHttpRequest.prototype.send);

    // =========================================================================
    // Init
    // =========================================================================

    async function init() {
        try {
            loadBabelSettings();

            latestKnownLanguage = getDefaultLanguage();

            await refreshCache();
            setupRouteWatcher();
        } catch (err) {
            error("Initialisation failed", err);
        }
    }

    init();

})();