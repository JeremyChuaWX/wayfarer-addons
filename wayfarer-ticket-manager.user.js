// ==UserScript==
// @name         Wayfarer Ticket Manager
// @version      0.7.1
// @description  Support for simultaneous tickets with optional cross-device sync
// @namespace    https://gitlab.com/Tntnnbltn/wayfarer-addons
// @downloadURL  https://gitlab.com/Tntnnbltn/wayfarer-addons/-/raw/main/wayfarer-ticket-manager.user.js
// @updateURL    https://gitlab.com/Tntnnbltn/wayfarer-addons/-/raw/main/wayfarer-ticket-manager.user.js
// @homepageURL  https://gitlab.com/Tntnnbltn/wayfarer-addons
// @match        https://wayfarer.scopely.com/*
// @match        https://webchat.helpshift.com/*
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

function init() {

    const ORIGIN_WAYFARER = 'https://wayfarer.scopely.com';
    const ORIGIN_HELPSHIFT = 'https://webchat.helpshift.com';
    const OBJECT_STORE_NAME = 'helpChatSessions';

    const WFTM_SOURCE = 'wftm';

    function isSafeObject(value) {
        return value && typeof value === 'object';
    }

    function initHelp() {

        (function(open) {
            XMLHttpRequest.prototype.open = function(method, url) {
                if (method === 'POST') {
                    if (url === 'https://api.helpshift.com/websdk/scopelyexplore/conversations/history' ||
                        url === 'https://api.helpshift.com/websdk/scopelyexplore/conversations/updates' ||
                        url.startsWith('https://api.helpshift.com/websdk/scopelyexplore/issues/')) {
                        this.addEventListener('load', parseResponse, false);
                        this.addEventListener('readystatechange', function() {
                            if (this.readyState === 4) { // Check if request is complete
                                parseResponse.call(this); // Call parseResponse function when request is complete
                            }
                        });
                    }
                }
                open.apply(this, arguments);
            };
        })(XMLHttpRequest.prototype.open);

        function handleParentMessage(event) {
            if (event.origin !== ORIGIN_WAYFARER) return;
            if (!isSafeObject(event.data)) return;
            if (event.data.source !== WFTM_SOURCE) return;

            const { type, payload } = event.data;

            if (type === 'clearSession') {
                clearLocalStorage();
            } else if (type === 'restoreSession' && payload && payload.aui) {
                updateLocalStorage(payload);
            }
        }

        window.addEventListener('message', handleParentMessage);

        function parseResponse() {
            try {
                const json = JSON.parse(this.responseText);
                if (!json) return;
                sendTicketHistory(json);
            } catch (ex) {
                console.error('Error parsing JSON:', ex);
            }
        }

        function loadAndSendSessionValues() {
            const di = localStorage.getItem('di:scopelye-2d29204ff805eac');
            const asi = localStorage.getItem('asi:scopelye-2d29204ff805eac');
            const aui = localStorage.getItem('aui:scopelye-2d29204ff805eac');

            window.parent.postMessage({
                source: WFTM_SOURCE,
                type: 'sessionValues',
                payload: { di, asi, aui }
            }, ORIGIN_WAYFARER);
        }

        loadAndSendSessionValues();

        function sendTicketHistory(data) {
            window.parent.postMessage({
                source: WFTM_SOURCE,
                type: 'ticketHistory',
                payload: data
            }, ORIGIN_WAYFARER);
        }

        function clearLocalStorage() {
            localStorage.clear();
        }

        function updateLocalStorage(data) {
            const suffix = 'scopelye-2d29204ff805eac';

            const diKey = `di:${suffix}`;
            const asiKey = `asi:${suffix}`;
            const auiKey = `aui:${suffix}`;
            const configKey = `config:${suffix}`;

            const previousAui = localStorage.getItem(auiKey);

            localStorage.setItem(diKey, data.di);
            localStorage.setItem(asiKey, data.asi);
            localStorage.setItem(auiKey, data.aui);

            const rawConfig = localStorage.getItem(configKey);
            if (!rawConfig) return;

            try {
                const configData = JSON.parse(rawConfig);

                // Helpshift now appears to expect the active AUI to exist inside configData.
                // If the restored AUI does not have a config entry, copy one from the current session.
                if (!configData[data.aui]) {
                    if (previousAui && configData[previousAui]) {
                        configData[data.aui] = configData[previousAui];
                    } else {
                        const configKeys = Object.keys(configData);
                        const fallbackKey = configKeys[configKeys.length - 1];

                        if (fallbackKey) {
                            configData[data.aui] = configData[fallbackKey];
                        }
                    }
                }

                // Do not delete old config entries. Current Helpshift storage may contain several.
                localStorage.setItem(configKey, JSON.stringify(configData));
            } catch (ex) {
                console.error('Ticket Manager: Failed to update Helpshift config storage', ex);
            }
        }
    }


    function initWF() {
        let helpChatSessions = JSON.parse(localStorage.getItem(OBJECT_STORE_NAME)) || {};
        let currentSession;
        let currentSessionCredentials;
        let isTheNextMessageTheWayspotTitle = false;
        let ticketButtonAdded = false;
        let iframeObserverStarted = false;
        let routeHooked = false;
        let waitingForIframe = false;

        const TICKET_SYNC_CONFIG_KEY = 'wftmSyncConfig';
        const TICKET_SYNC_STATE_KEY = 'wftmSyncState';
        const TICKET_SYNC_STATE_VERSION = 1;
        const TICKET_SYNC_API_VERSION = 1;
        const TICKET_SYNC_DELAY_MS = 750;
        const TICKET_SYNC_TIMEOUT_MS = 20000;
        const TICKET_SYNC_INSTALLATION_URL =
              'https://gitlab.com/Tntnnbltn/wayfarer-addons/-/blob/main/ticket-manager-sync/README.md';

        let ticketSyncState = loadTicketSyncState();
        let ticketSyncTimer = null;
        let ticketSyncRequest = null;
        let ticketSyncUiNeedsRefresh = false;
        let ticketSyncStatus = getTicketSyncConfig()
            ? 'Ready to sync.'
            : 'Ticket Sync is not configured.';
        let ticketSyncStatusKind = '';

        function createTicketSyncId() {
            if (globalThis.crypto && typeof globalThis.crypto.randomUUID === 'function') {
                return globalThis.crypto.randomUUID();
            }
            return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
        }

        function cloneTicketSyncValue(value) {
            return JSON.parse(JSON.stringify(value));
        }

        function ticketSyncFingerprint(value) {
            if (Array.isArray(value)) {
                return `[${value.map(ticketSyncFingerprint).join(',')}]`;
            }
            if (!isSafeObject(value)) {
                return JSON.stringify(value);
            }
            return `{${Object.keys(value).sort().map(key =>
                `${JSON.stringify(key)}:${ticketSyncFingerprint(value[key])}`
            ).join(',')}}`;
        }

        function isValidTicketSyncUrl(value) {
            try {
                const url = new URL(String(value || '').trim());
                return url.protocol === 'https:' &&
                    url.hostname === 'script.google.com' &&
                    /^\/macros\/s\/[^/]+\/exec$/.test(url.pathname);
            } catch {
                return false;
            }
        }

        function getTicketSyncConfig() {
            try {
                const parsed = JSON.parse(localStorage.getItem(TICKET_SYNC_CONFIG_KEY) || 'null');
                if (!isSafeObject(parsed) || Array.isArray(parsed)) return null;
                const url = String(parsed.url || '').trim();
                if (!isValidTicketSyncUrl(url)) return null;
                return { url };
            } catch {
                return null;
            }
        }

        function defaultTicketSyncState() {
            return {
                version: TICKET_SYNC_STATE_VERSION,
                revision: 0,
                records: {},
                outbox: []
            };
        }

        function isValidTicketSyncOperation(operation) {
            return isSafeObject(operation) &&
                !Array.isArray(operation) &&
                typeof operation.id === 'string' &&
                typeof operation.aui === 'string' &&
                !isUnsafeObjectKey(operation.aui) &&
                (operation.type === 'upsert' || operation.type === 'delete') &&
                (operation.type === 'delete' || (
                    isSafeObject(operation.session) &&
                    !Array.isArray(operation.session) &&
                    Number.isInteger(operation.baseRevision) &&
                    operation.baseRevision >= 0
                ));
        }

        function loadTicketSyncState() {
            try {
                const parsed = JSON.parse(localStorage.getItem(TICKET_SYNC_STATE_KEY) || 'null');
                if (!isSafeObject(parsed) || parsed.version !== TICKET_SYNC_STATE_VERSION) {
                    return defaultTicketSyncState();
                }
                return {
                    version: TICKET_SYNC_STATE_VERSION,
                    revision: Number.isInteger(parsed.revision) && parsed.revision >= 0
                        ? parsed.revision
                        : 0,
                    records: isSafeObject(parsed.records) && !Array.isArray(parsed.records)
                        ? parsed.records
                        : {},
                    outbox: Array.isArray(parsed.outbox)
                        ? parsed.outbox.filter(isValidTicketSyncOperation)
                        : []
                };
            } catch {
                return defaultTicketSyncState();
            }
        }

        function saveTicketSyncState() {
            localStorage.setItem(TICKET_SYNC_STATE_KEY, JSON.stringify(ticketSyncState));
        }

        function getLatestPendingTicketOperation(aui) {
            for (let i = ticketSyncState.outbox.length - 1; i >= 0; i--) {
                if (ticketSyncState.outbox[i].aui === aui) {
                    return ticketSyncState.outbox[i];
                }
            }
            return null;
        }

        function isTicketSyncTombstoned(aui) {
            const pending = getLatestPendingTicketOperation(aui);
            if (pending) return pending.type === 'delete';
            return ticketSyncState.records?.[aui]?.deleted === true;
        }

        function queueTicketSyncOperation(type, aui, session = null, options = {}) {
            if (!getTicketSyncConfig()) return;
            if (typeof aui !== 'string' || !aui || isUnsafeObjectKey(aui)) return;

            const recordMeta = ticketSyncState.records?.[aui];
            if (type === 'delete' && recordMeta?.deleted === true &&
                !getLatestPendingTicketOperation(aui)) {
                return;
            }

            ticketSyncState.outbox = ticketSyncState.outbox.filter(operation => operation.aui !== aui);

            if (type === 'delete') {
                ticketSyncState.outbox.push({
                    id: createTicketSyncId(),
                    type: 'delete',
                    aui
                });
            } else {
                if (!isValidTicketSession(session)) return;
                const force = options.force === true;
                const fingerprint = ticketSyncFingerprint(session);
                if (!force &&
                    recordMeta &&
                    recordMeta.deleted !== true &&
                    recordMeta.fingerprint === fingerprint) {
                    return;
                }
                ticketSyncState.outbox.push({
                    id: createTicketSyncId(),
                    type: 'upsert',
                    aui,
                    baseRevision: Number.isInteger(recordMeta?.revision)
                        ? recordMeta.revision
                        : 0,
                    force,
                    session: cloneTicketSyncValue(session)
                });
            }

            saveTicketSyncState();
            scheduleTicketSync();
        }

        function applyTicketSyncChanges(changes, replace = false) {
            const records = Object.create(null);
            const sessions = Object.create(null);

            if (!replace) {
                if (isSafeObject(ticketSyncState.records) && !Array.isArray(ticketSyncState.records)) {
                    for (const [aui, meta] of Object.entries(ticketSyncState.records)) {
                        if (!aui || isUnsafeObjectKey(aui) || !isSafeObject(meta) || Array.isArray(meta)) continue;
                        records[aui] = cloneTicketSyncValue(meta);
                    }
                }

                for (const [aui, session] of Object.entries(helpChatSessions)) {
                    if (!aui || isUnsafeObjectKey(aui) || !isValidTicketSession(session)) continue;
                    sessions[aui] = cloneTicketSyncValue(session);
                }
            }

            if (!isSafeObject(changes) || Array.isArray(changes)) {
                return { records, sessions };
            }

            for (const [aui, record] of Object.entries(changes)) {
                if (!aui || isUnsafeObjectKey(aui) || !isSafeObject(record) || Array.isArray(record)) {
                    continue;
                }

                const revision = Number(record.revision);
                if (!Number.isInteger(revision) || revision < 0) continue;

                if (record.deleted === true) {
                    records[aui] = { revision, deleted: true };
                    delete sessions[aui];
                } else if (isValidTicketSession(record.session)) {
                    records[aui] = {
                        revision,
                        deleted: false,
                        fingerprint: ticketSyncFingerprint(record.session)
                    };
                    sessions[aui] = cloneTicketSyncValue(record.session);
                }
            }

            return { records, sessions };
        }

        function overlayPendingTicketOperations(sessions) {
            for (const operation of ticketSyncState.outbox) {
                if (operation.type === 'delete') {
                    delete sessions[operation.aui];
                } else if (operation.type === 'upsert') {
                    sessions[operation.aui] = cloneTicketSyncValue(operation.session);
                }
            }
        }

        function writeTicketSessionsFromSync(sessions) {
            const currentFingerprint = ticketSyncFingerprint(helpChatSessions);
            const nextFingerprint = ticketSyncFingerprint(sessions);
            if (currentFingerprint === nextFingerprint) return false;

            helpChatSessions = sessions;
            localStorage.setItem(OBJECT_STORE_NAME, JSON.stringify(sessions));

            if (document.getElementById('ticketInterfaceContainer')) {
                if (document.getElementById('wftmSyncModal')) {
                    ticketSyncUiNeedsRefresh = true;
                } else {
                    refreshTicketManagerInterface();
                }
            }
            return true;
        }

        async function callTicketSyncApi(config, operations) {
            const body = new URLSearchParams();
            body.set('payload', JSON.stringify({
                version: TICKET_SYNC_API_VERSION,
                sinceRevision: ticketSyncState.revision,
                operations
            }));

            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), TICKET_SYNC_TIMEOUT_MS);
            let response;
            try {
                response = await fetch(config.url, {
                    method: 'POST',
                    credentials: 'omit',
                    body,
                    signal: controller.signal
                });
            } catch (error) {
                if (error?.name === 'AbortError') {
                    throw new Error('Ticket Sync request timed out.');
                }
                throw new Error('Ticket Sync could not reach the Apps Script web app.');
            } finally {
                clearTimeout(timeout);
            }

            if (!response.ok) {
                throw new Error(`Ticket Sync request failed with HTTP ${response.status}.`);
            }

            let result;
            try {
                result = await response.json();
            } catch {
                throw new Error('Ticket Sync returned invalid JSON.');
            }

            if (!isSafeObject(result) || result.ok !== true) {
                throw new Error(result?.error?.message || 'Ticket Sync returned an error.');
            }
            if (Number(result.version) !== TICKET_SYNC_API_VERSION) {
                throw new Error('Ticket Sync API version mismatch. Update Code.gs and redeploy it.');
            }
            if (!isSafeObject(result.changes) || Array.isArray(result.changes) ||
                !Array.isArray(result.results) || typeof result.full !== 'boolean') {
                throw new Error('Ticket Sync response is incomplete.');
            }
            return result;
        }

        function setTicketSyncStatus(message, kind = '') {
            ticketSyncStatus = message;
            ticketSyncStatusKind = kind;
            document.querySelectorAll('.wftm-sync-status').forEach(element => {
                element.textContent = message;
                element.dataset.kind = kind;
            });
        }

        async function syncTicketSessions() {
            if (ticketSyncRequest) return ticketSyncRequest;

            const config = getTicketSyncConfig();
            if (!config) {
                setTicketSyncStatus('Ticket Sync is not configured.');
                return false;
            }

            ticketSyncRequest = (async () => {
                setTicketSyncStatus('Syncing…');
                const outgoing = ticketSyncState.outbox.map(operation => cloneTicketSyncValue(operation));

                try {
                    const result = await callTicketSyncApi(config, outgoing);
                    const resolvedIds = new Set(
                        result.results
                            .filter(item => isSafeObject(item) && typeof item.id === 'string')
                            .map(item => item.id)
                    );

                    ticketSyncState.outbox = ticketSyncState.outbox.filter(operation =>
                        !resolvedIds.has(operation.id)
                    );
                    const fullSnapshot = result.full === true;
                    ticketSyncState.revision = Number.isInteger(result.revision)
                        ? result.revision
                        : ticketSyncState.revision;
                    const applied = applyTicketSyncChanges(result.changes, fullSnapshot);
                    ticketSyncState.records = applied.records;

                    // Rebase operations queued while the request was in flight onto
                    // the latest canonical record revision returned by the server.
                    ticketSyncState.outbox.forEach(operation => {
                        if (operation.type !== 'upsert') return;
                        const meta = ticketSyncState.records[operation.aui];
                        operation.baseRevision = Number.isInteger(meta?.revision)
                            ? meta.revision
                            : 0;
                    });

                    const merged = applied.sessions;

                    if (fullSnapshot) {
                        const remoteKeys = new Set(Object.keys(result.changes));
                        for (const [aui, session] of Object.entries(helpChatSessions)) {
                            if (!remoteKeys.has(aui) &&
                                !getLatestPendingTicketOperation(aui) &&
                                isValidTicketSession(session)) {
                                merged[aui] = cloneTicketSyncValue(session);
                                queueTicketSyncOperation('upsert', aui, session);
                            }
                        }
                    }

                    overlayPendingTicketOperations(merged);
                    writeTicketSessionsFromSync(merged);

                    saveTicketSyncState();

                    const conflicts = result.results.filter(item =>
                        item?.status === 'stale' || item?.status === 'tombstoned'
                    ).length;
                    if (conflicts > 0) {
                        setTicketSyncStatus(
                            `Synced. ${conflicts} stale local change${conflicts === 1 ? '' : 's'} replaced by newer synced data.`,
                            'warning'
                        );
                    } else {
                        setTicketSyncStatus('Synced.', 'success');
                    }

                    if (ticketSyncState.outbox.length > 0) {
                        scheduleTicketSync(50);
                    }
                    return true;
                } catch (error) {
                    console.error('Ticket Manager: Ticket Sync failed', error);
                    setTicketSyncStatus(error?.message || 'Ticket Sync failed.', 'error');
                    return false;
                }
            })();

            try {
                return await ticketSyncRequest;
            } finally {
                ticketSyncRequest = null;
            }
        }

        function scheduleTicketSync(delay = TICKET_SYNC_DELAY_MS) {
            if (!getTicketSyncConfig()) return;
            clearTimeout(ticketSyncTimer);
            ticketSyncTimer = setTimeout(() => {
                ticketSyncTimer = null;
                syncTicketSessions();
            }, delay);
        }

        function saveTicketSyncConfig(url) {
            url = String(url || '').trim();
            if (!isValidTicketSyncUrl(url)) {
                throw new Error('Enter a deployed Google Apps Script URL ending in /exec.');
            }

            const previous = getTicketSyncConfig();
            localStorage.setItem(TICKET_SYNC_CONFIG_KEY, JSON.stringify({ url }));

            if (!previous || previous.url !== url) {
                ticketSyncState = defaultTicketSyncState();
                saveTicketSyncState();
            }
            setTicketSyncStatus('Ticket Sync configured.');
        }

        function disableTicketSync() {
            clearTimeout(ticketSyncTimer);
            ticketSyncTimer = null;
            localStorage.removeItem(TICKET_SYNC_CONFIG_KEY);
            localStorage.removeItem(TICKET_SYNC_STATE_KEY);
            ticketSyncState = defaultTicketSyncState();
            setTicketSyncStatus('Ticket Sync is disabled.');
        }

        function startTicketSync() {
            if (getTicketSyncConfig()) {
                scheduleTicketSync(0);
            }
        }

        const awaitElement = get => new Promise((resolve, reject) => {
            let triesLeft = 20;

            const queryLoop = () => {
                const ref = get();

                if (ref) {
                    resolve(ref);
                    return;
                }

                triesLeft -= 1;

                if (triesLeft <= 0) {
                    reject(new Error('Element not found'));
                    return;
                }

                setTimeout(queryLoop, 1000);
            };

            queryLoop();
        });

        const decodeHTMLEntities = str => {
            const doc = new DOMParser().parseFromString(str, "text/html");
            return doc.documentElement.textContent;
        };

        function exportTicketSessions() {
            try {
                const storedSessions =
                      JSON.parse(localStorage.getItem(OBJECT_STORE_NAME)) || {};

                const sessionCount = Object.keys(storedSessions).length;

                if (sessionCount === 0) {
                    alert("There are no Ticket Manager sessions to export.");
                    return;
                }

                const shouldExport = confirm(
                    `Export ${sessionCount} Ticket Manager session` +
                    `${sessionCount === 1 ? "" : "s"}?\n\n` +
                    "The exported file contains private Helpshift session " +
                    "identifiers. Store it securely and do not share it."
                );

                if (!shouldExport) return;

                /*
         * Export the same object structure stored under helpChatSessions.
         * This means the file can be written directly back to local storage.
         */
                const json = JSON.stringify(storedSessions, null, 2);
                const blob = new Blob([json], {
                    type: "application/json"
                });

                const url = URL.createObjectURL(blob);
                const link = document.createElement("a");
                const date = new Date().toISOString().slice(0, 10);

                link.href = url;
                link.download = `wayfarer-ticket-sessions-${date}.json`;
                link.style.display = "none";

                document.body.appendChild(link);
                link.click();
                link.remove();

                setTimeout(() => {
                    URL.revokeObjectURL(url);
                }, 0);
            } catch (ex) {
                console.error(
                    "Ticket Manager: Failed to export ticket sessions",
                    ex
                );

                alert("Ticket sessions could not be exported.");
            }
        }

        async function importTicketSessionsFile(file) {
            if (!file) return;

            try {
                const raw = await file.text();
                const parsed = JSON.parse(raw);
                const importedSessions =
                      validateAndNormaliseTicketSessions(parsed);

                const importedCount = Object.keys(importedSessions).length;

                if (importedCount === 0) {
                    throw new Error(
                        "The selected file does not contain any ticket sessions."
                    );
                }

                const storedSessions =
                      JSON.parse(localStorage.getItem(OBJECT_STORE_NAME)) || {};

                const existingCount = Object.keys(storedSessions).length;
                const duplicateCount = Object.keys(importedSessions).filter(
                    aui => Object.prototype.hasOwnProperty.call(
                        storedSessions,
                        aui
                    )
                ).length;

                let confirmationMessage =
                    `Import ${importedCount} Ticket Manager session` +
                    `${importedCount === 1 ? "" : "s"}?\n\n` +
                    `The imported sessions will be merged with your ` +
                    `${existingCount} existing session` +
                    `${existingCount === 1 ? "" : "s"}.`;

                if (duplicateCount > 0) {
                    confirmationMessage +=
                        `\n\n${duplicateCount} existing session` +
                        `${duplicateCount === 1 ? "" : "s"} with matching ` +
                        `identifiers will be replaced.`;
                }

                confirmationMessage +=
                    "\n\nOnly import files that you created and trust.";

                if (!confirm(confirmationMessage)) return;

                /*
         * Use an object without a prototype while merging to avoid special
         * object keys changing the object's prototype.
         */
                const mergedSessions = Object.create(null);

                Object.entries(storedSessions).forEach(([aui, session]) => {
                    if (!isUnsafeObjectKey(aui)) {
                        mergedSessions[aui] = session;
                    }
                });

                Object.entries(importedSessions).forEach(([aui, session]) => {
                    mergedSessions[aui] = session;
                });

                helpChatSessions = mergedSessions;

                localStorage.setItem(
                    OBJECT_STORE_NAME,
                    JSON.stringify(mergedSessions)
                );

                // Import is an explicit restore action. If an imported AUI was
                // previously deleted on another device, allow this operation to
                // intentionally replace the remote tombstone.
                Object.entries(importedSessions).forEach(([aui, session]) => {
                    queueTicketSyncOperation('upsert', aui, session, { force: true });
                });

                refreshTicketManagerInterface();

                alert(
                    `${importedCount} Ticket Manager session` +
                    `${importedCount === 1 ? "" : "s"} imported successfully.`
                );
            } catch (ex) {
                console.error(
                    "Ticket Manager: Failed to import ticket sessions",
                    ex
                );

                alert(
                    ex instanceof Error
                    ? ex.message
                    : "Ticket sessions could not be imported."
                );
            }
        }

        function validateAndNormaliseTicketSessions(data) {
            /*
     * The normal export is the raw helpChatSessions object. This also
     * accepts a future wrapper containing a "sessions" property.
     */
            const source =
                  isSafeObject(data) &&
                  !Array.isArray(data) &&
                  isSafeObject(data.sessions) &&
                  !Array.isArray(data.sessions)
            ? data.sessions
            : data;

            if (
                !isSafeObject(source) ||
                Array.isArray(source)
            ) {
                throw new Error(
                    "The selected file is not a valid Ticket Manager export."
                );
            }

            const normalised = Object.create(null);

            for (const [aui, session] of Object.entries(source)) {
                if (
                    typeof aui !== "string" ||
                    !aui.trim() ||
                    isUnsafeObjectKey(aui)
                ) {
                    throw new Error(
                        "The import contains an invalid session identifier."
                    );
                }

                if (!isValidTicketSession(session)) {
                    throw new Error(
                        `The session "${aui}" contains invalid or incomplete data.`
                    );
                }

                /*
         * JSON cloning removes unexpected prototypes while preserving the
         * complete session structure and any future primitive properties.
         */
                normalised[aui] = JSON.parse(JSON.stringify(session));
            }

            return normalised;
        }

        function isValidTicketSession(session) {
            if (
                !isSafeObject(session) ||
                Array.isArray(session)
            ) {
                return false;
            }

            /*
     * DI is required when restoring a Ticket Manager session.
     * ASI may occasionally be null or absent in older stored sessions.
     */
            if (
                typeof session.di !== "string" ||
                !session.di.trim()
            ) {
                return false;
            }

            if (
                session.asi !== undefined &&
                session.asi !== null &&
                typeof session.asi !== "string"
            ) {
                return false;
            }

            if (
                session.inProgress !== undefined &&
                typeof session.inProgress !== "boolean"
            ) {
                return false;
            }

            if (
                session.type !== undefined &&
                session.type !== null &&
                typeof session.type !== "string"
            ) {
                return false;
            }

            if (
                session.wayspot !== undefined &&
                session.wayspot !== null &&
                typeof session.wayspot !== "string"
            ) {
                return false;
            }

            if (
                !isValidOptionalTimestamp(session.ticketTypeTimestamp) ||
                !isValidOptionalTimestamp(session.wayspotTimestamp)
            ) {
                return false;
            }

            return true;
        }

        function isValidOptionalTimestamp(value) {
            return (
                value === undefined ||
                value === null ||
                typeof value === "string" ||
                (
                    typeof value === "number" &&
                    Number.isFinite(value)
                )
            );
        }

        function isUnsafeObjectKey(key) {
            return (
                key === "__proto__" ||
                key === "prototype" ||
                key === "constructor"
            );
        }

        function refreshTicketManagerInterface() {
            removeInterfaceContainer();

            /*
     * Reopen the interface so the imported sessions are shown immediately.
     */
            const ticketSwitchButton =
                  document.getElementById("ticketSwitchButton");

            if (ticketSwitchButton) {
                setTimeout(() => {
                    ticketSwitchButton.click();
                }, 0);
            }
        }

        function openTicketImportPicker() {
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = '.json,application/json';
            input.hidden = true;
            document.body.appendChild(input);

            const cleanup = () => input.remove();
            input.addEventListener('cancel', cleanup, { once: true });
            input.addEventListener('change', async () => {
                const file = input.files?.[0];
                try {
                    await importTicketSessionsFile(file);
                } finally {
                    cleanup();
                }
            }, { once: true });

            input.click();
        }

        function createTicketManagerMenu(interfaceContainer, menuButton) {
            const menu = document.createElement('div');
            menu.classList.add('wftm-menu');
            menu.hidden = true;

            const addMenuButton = (label, handler) => {
                const button = document.createElement('button');
                button.type = 'button';
                button.classList.add('wftm-menu-item');
                button.textContent = label;
                button.addEventListener('click', event => {
                    event.stopPropagation();
                    menu.hidden = true;
                    menuButton.setAttribute('aria-expanded', 'false');
                    handler();
                });
                menu.appendChild(button);
            };

            addMenuButton('Ticket Sync', () => openTicketSyncModal(interfaceContainer));
            addMenuButton('Export Tickets', exportTicketSessions);
            addMenuButton('Import Tickets', openTicketImportPicker);

            menuButton.addEventListener('click', event => {
                event.stopPropagation();
                const willOpen = menu.hidden;
                menu.hidden = !willOpen;
                menuButton.setAttribute('aria-expanded', willOpen ? 'true' : 'false');
            });

            interfaceContainer.addEventListener('click', event => {
                if (!menu.hidden && !menu.contains(event.target) && event.target !== menuButton) {
                    menu.hidden = true;
                    menuButton.setAttribute('aria-expanded', 'false');
                }
            });

            return menu;
        }

        function openTicketSyncModal(interfaceContainer) {
            const existingModal = document.getElementById('wftmSyncModal');
            if (existingModal) {
                existingModal._wftmCleanup?.();
                existingModal.remove();
            }

            const config = getTicketSyncConfig();
            const backdrop = document.createElement('div');
            backdrop.id = 'wftmSyncModal';
            backdrop.classList.add('wftm-modal-backdrop');

            const modal = document.createElement('div');
            modal.classList.add('wftm-modal');
            modal.setAttribute('role', 'dialog');
            modal.setAttribute('aria-modal', 'true');
            modal.setAttribute('aria-labelledby', 'wftmSyncTitle');

            const title = document.createElement('h2');
            title.id = 'wftmSyncTitle';
            title.classList.add('wftm-modal-title');
            title.textContent = 'Ticket Sync';

            const description = document.createElement('p');
            description.classList.add('wftm-modal-description');
            description.textContent =
                'Sync Ticket Manager sessions between your devices using a dedicated Google Apps Script.';

            const urlLabel = document.createElement('label');
            urlLabel.classList.add('wftm-field-label');
            urlLabel.textContent = 'Script URL';
            const urlInput = document.createElement('input');
            urlInput.type = 'url';
            urlInput.classList.add('wftm-field-input');
            urlInput.placeholder = 'https://script.google.com/macros/s/…/exec';
            urlInput.value = config?.url || '';
            urlInput.autocomplete = 'off';
            urlInput.spellcheck = false;
            urlLabel.appendChild(urlInput);

            const instructions = document.createElement('a');
            instructions.classList.add('wftm-sync-instructions');
            instructions.href = TICKET_SYNC_INSTALLATION_URL;
            instructions.target = '_blank';
            instructions.rel = 'noopener noreferrer';
            instructions.textContent = 'Ticket Sync installation instructions';

            const status = document.createElement('div');
            status.classList.add('wftm-sync-status');
            status.textContent = ticketSyncStatus;
            status.dataset.kind = ticketSyncStatusKind;

            const buttonRow = document.createElement('div');
            buttonRow.classList.add('wftm-modal-buttons');

            const disableButton = document.createElement('button');
            disableButton.type = 'button';
            disableButton.classList.add('wftm-modal-button', 'wftm-modal-button-secondary');
            disableButton.textContent = 'Disable Sync';
            disableButton.hidden = !config;

            const syncNowButton = document.createElement('button');
            syncNowButton.type = 'button';
            syncNowButton.classList.add('wftm-modal-button', 'wftm-modal-button-secondary');
            syncNowButton.textContent = 'Sync now';
            syncNowButton.hidden = !config;

            const saveButton = document.createElement('button');
            saveButton.type = 'button';
            saveButton.classList.add('wftm-modal-button', 'wftm-modal-button-primary');
            saveButton.textContent = 'Save & Sync';

            const closeButton = document.createElement('button');
            closeButton.type = 'button';
            closeButton.classList.add('wftm-modal-close');
            closeButton.setAttribute('aria-label', 'Close Ticket Sync settings');
            closeButton.textContent = '×';

            const cleanupModal = () => {
                document.removeEventListener('keydown', handleKeyDown);
            };
            backdrop._wftmCleanup = cleanupModal;

            const closeModal = () => {
                cleanupModal();
                backdrop.remove();
                if (ticketSyncUiNeedsRefresh) {
                    ticketSyncUiNeedsRefresh = false;
                    refreshTicketManagerInterface();
                }
            };
            const handleKeyDown = event => {
                if (event.key === 'Escape') closeModal();
            };

            closeButton.addEventListener('click', closeModal);
            backdrop.addEventListener('click', event => {
                if (event.target === backdrop) closeModal();
            });
            document.addEventListener('keydown', handleKeyDown);

            saveButton.addEventListener('click', async () => {
                try {
                    saveTicketSyncConfig(urlInput.value);
                    disableButton.hidden = false;
                    syncNowButton.hidden = false;
                    saveButton.disabled = true;
                    syncNowButton.disabled = true;
                    await syncTicketSessions();
                } catch (error) {
                    setTicketSyncStatus(error?.message || 'Ticket Sync could not be configured.', 'error');
                } finally {
                    saveButton.disabled = false;
                    syncNowButton.disabled = false;
                }
            });

            syncNowButton.addEventListener('click', async () => {
                syncNowButton.disabled = true;
                saveButton.disabled = true;
                try {
                    await syncTicketSessions();
                } finally {
                    syncNowButton.disabled = false;
                    saveButton.disabled = false;
                }
            });

            disableButton.addEventListener('click', () => {
                disableTicketSync();
                urlInput.value = '';
                disableButton.hidden = true;
                syncNowButton.hidden = true;
            });

            const titleRow = document.createElement('div');
            titleRow.classList.add('wftm-modal-title-row');
            titleRow.appendChild(title);
            titleRow.appendChild(closeButton);

            buttonRow.appendChild(disableButton);
            buttonRow.appendChild(syncNowButton);
            buttonRow.appendChild(saveButton);

            modal.appendChild(titleRow);
            modal.appendChild(description);
            modal.appendChild(urlLabel);
            modal.appendChild(instructions);
            modal.appendChild(status);
            modal.appendChild(buttonRow);
            backdrop.appendChild(modal);
            interfaceContainer.appendChild(backdrop);

            setTimeout(() => urlInput.focus(), 0);
        }

        function isWfmmMobileFullscreenModalOpen() {
            const isMobile = window.matchMedia
                ? window.matchMedia('(max-width: 640px)').matches
                : (window.innerWidth || document.documentElement.clientWidth || 0) <= 640;

            if (!isMobile) return false;

            return Boolean(document.querySelector(
                '.wfmm-modal-backdrop[data-wfmm-mobile="fullscreen"], ' +
                '.wfmapmods-modal-backdrop[data-wfmm-mobile="fullscreen"]'
            ));
        }

        // Mirror normal Helpshift launcher visibility where it is observable,
        // and independently mirror WFMM's mobile fullscreen-modal suppression.
        function syncTicketButtonVisibility() {
            const launcher = document.getElementById('hs-web-sdk-iframe-launcher');
            const ticketButton = document.querySelector('.wftm-containerDiv');

            if (!ticketButton) return;

            let launcherHidden = !launcher;

            if (launcher) {
                const launcherStyle = getComputedStyle(launcher);
                launcherHidden =
                    launcher.hidden ||
                    launcher.style.display === 'none' ||
                    launcherStyle.display === 'none' ||
                    launcherStyle.visibility === 'hidden';
            }

            const hidden = launcherHidden || isWfmmMobileFullscreenModalOpen();

            ticketButton.style.display = hidden ? 'none' : '';

            if (hidden) {
                removeInterfaceContainer();
            }
        }

        // Function to observe changes to the Help Chat panel iframe.
        // Used to detect when the Help Chat is opened.
        const observeIframeWidthChanges = () => {
            const iframe = document.getElementById('hs-web-sdk-iframe');
            if (iframe) {
                const observer = new MutationObserver(mutationsList => {
                    for (const mutation of mutationsList) {
                        if (mutation.type === 'attributes' && (mutation.attributeName === 'style' || mutation.attributeName === 'min-width' || mutation.attributeName === 'max-width')) {
                            removeInterfaceContainer();
                        }
                    }
                });
                observer.observe(iframe, { attributes: true });
            }
        };

        // Helpshift can hide, show, remove, or recreate its launcher iframe.
        // WFMM fullscreen modals are also added/removed from the document. Watch
        // both so Ticket Manager follows the effective launcher visibility.
        const observeHelpLauncherVisibility = () => {
            let launcher = null;
            let launcherObserver = null;

            const attachLauncherObserver = () => {
                const nextLauncher = document.getElementById('hs-web-sdk-iframe-launcher');

                if (nextLauncher !== launcher) {
                    launcherObserver?.disconnect();
                    launcherObserver = null;
                    launcher = nextLauncher;

                    if (launcher) {
                        launcherObserver = new MutationObserver(syncTicketButtonVisibility);
                        launcherObserver.observe(launcher, {
                            attributes: true,
                            attributeFilter: ['style', 'class', 'hidden']
                        });
                    }
                }

                syncTicketButtonVisibility();
            };

            const documentObserver = new MutationObserver(attachLauncherObserver);
            documentObserver.observe(document.documentElement, {
                childList: true,
                subtree: true
            });

            if (window.matchMedia) {
                const mobileQuery = window.matchMedia('(max-width: 640px)');
                if (typeof mobileQuery.addEventListener === 'function') {
                    mobileQuery.addEventListener('change', syncTicketButtonVisibility);
                } else if (typeof mobileQuery.addListener === 'function') {
                    mobileQuery.addListener(syncTicketButtonVisibility);
                }
            }

            attachLauncherObserver();
        };


        function isHelpRoute() {
            return location.origin === ORIGIN_WAYFARER &&
                location.pathname === '/new/help';
        }

        function ensureTicketManagerLoaded(options = {}) {
            const { requireHelpRoute = false } = options;

            if (requireHelpRoute && !isHelpRoute()) {
                removeInterfaceContainer();
                return;
            }

            if (document.getElementById('ticketSwitchButton')) {
                ticketButtonAdded = true;
            }

            if (ticketButtonAdded && iframeObserverStarted) {
                return;
            }

            if (waitingForIframe) {
                return;
            }

            waitingForIframe = true;

            awaitElement(() => document.getElementById('hs-web-sdk-iframe'))
                .then(() => {
                waitingForIframe = false;

                if (!ticketButtonAdded && !document.getElementById('ticketSwitchButton')) {
                    addTicketSwitchButton();
                    ticketButtonAdded = true;
                }

                if (!iframeObserverStarted) {
                    observeIframeWidthChanges();
                    observeHelpLauncherVisibility();
                    iframeObserverStarted = true;
                }
            })
                .catch(() => {
                waitingForIframe = false;
                console.error('Iframe not found.');
            });
        }

        function handleRouteChange() {
            if (isHelpRoute()) {
                ensureTicketManagerLoaded({ requireHelpRoute: true });
            } else {
                removeInterfaceContainer();
            }
        }

        function hookRouteChanges() {
            if (routeHooked) return;
            routeHooked = true;

            const originalPushState = history.pushState;
            const originalReplaceState = history.replaceState;

            history.pushState = function(...args) {
                originalPushState.apply(this, args);
                setTimeout(handleRouteChange, 0);
            };

            history.replaceState = function(...args) {
                originalReplaceState.apply(this, args);
                setTimeout(handleRouteChange, 0);
            };

            window.addEventListener('popstate', () => {
                setTimeout(handleRouteChange, 0);
            });
        }

        hookRouteChanges();
        startTicketSync();

        // Initial page-load check: look for the iframe regardless of current route.
        ensureTicketManagerLoaded({ requireHelpRoute: false });

        window.addEventListener('message', function(event) {
            if (event.origin !== ORIGIN_HELPSHIFT) return;
            if (!isSafeObject(event.data)) return;
            if (event.data.source !== WFTM_SOURCE) return;

            const { type, payload } = event.data;

            if (type === 'sessionValues' && payload && payload.di && payload.aui) {
                const previousSession = currentSession;
                currentSession = payload.aui;
                currentSessionCredentials = {
                    di: payload.di,
                    asi: payload.asi
                };

                if (previousSession !== currentSession && document.getElementById('ticketInterfaceContainer')) {
                    if (document.getElementById('wftmSyncModal')) {
                        ticketSyncUiNeedsRefresh = true;
                    } else {
                        refreshTicketManagerInterface();
                    }
                }
            } else if (type === 'ticketHistory' && payload) {
                processTicketData(payload);
            }
        });

        function postToHelp(type, payload = null) {
            const iframe = document.getElementById('hs-web-sdk-iframe');
            if (!iframe || !iframe.contentWindow) {
                console.warn('Ticket Manager: Helpshift iframe not available');
                return false;
            }

            iframe.contentWindow.postMessage({
                source: WFTM_SOURCE,
                type,
                payload
            }, ORIGIN_HELPSHIFT);

            return true;
        }

        function restoreOldTicket(data) {
            const sent = postToHelp('restoreSession', data);
            if (!sent) return;

            saveDataToLocalStorage();
            refreshPage();
        }

        function generateNewTicket() {
            const sent = postToHelp('clearSession');
            if (!sent) return;

            saveDataToLocalStorage();
            refreshPage();
        }

        function saveDataToLocalStorage() {
            if (!currentSession || !helpChatSessions[currentSession]) return;

            const storedData = JSON.parse(localStorage.getItem(OBJECT_STORE_NAME)) || {};
            storedData[currentSession] = helpChatSessions[currentSession];
            localStorage.setItem(OBJECT_STORE_NAME, JSON.stringify(storedData));
            queueTicketSyncOperation('upsert', currentSession, helpChatSessions[currentSession]);
        }

        function refreshPage() {
            setTimeout(function() {
                location.reload();
            }, 50);
        }

        function ensureCurrentSessionStored() {
            if (!currentSession || isTicketSyncTombstoned(currentSession)) return false;
            if (helpChatSessions[currentSession]) return true;
            if (!currentSessionCredentials?.di) return false;

            helpChatSessions[currentSession] = {
                di: currentSessionCredentials.di,
                asi: currentSessionCredentials.asi
            };
            return true;
        }

        function processTicketData(data) {
            if (data.body) {
                if (!ensureCurrentSessionStored()) return;
                processTicketMessages([data]);
            } else if (Array.isArray(data.issues) && data.issues.length > 0) {
                if (!ensureCurrentSessionStored()) return;
                processTicketUpdate(data);
            }
        }

        function processTicketUpdate(data) {
            const issues = data.issues;

            if (issues.length > 0) {
                let mostRecentTicket;

                if (issues.length === 1) {
                    mostRecentTicket = issues[0];
                } else if (issues.length > 1) {
                    mostRecentTicket = issues.reduce((prev, current) => {
                        return (new Date(current.created_at) > new Date(prev.created_at)) ? current : prev;
                    });
                } else {
                    console.error("Ticket Manager: Unexpected error in identifying most recent ticket");
                }

                // Set the ticket type based on the most recent ticket's title
                if (mostRecentTicket && mostRecentTicket.title) {
                    const ticketType = categorizeTicketTitle(mostRecentTicket.title);
                    const newTimestamp = mostRecentTicket.created_at;

                    const currentSessionData = helpChatSessions[currentSession];
                    const existingTimestamp = currentSessionData.ticketTypeTimestamp || 0;

                    if (newTimestamp > existingTimestamp) {
                        currentSessionData.type = ticketType;
                        currentSessionData.ticketTypeTimestamp = newTimestamp;
                        helpChatSessions[currentSession].inProgress = true;
                    }

                    // Clear old Wayspot title if its timestamp is older
                    if (currentSessionData.wayspot && currentSessionData.wayspotTimestamp) {
                        if (currentSessionData.wayspotTimestamp < newTimestamp) {
                            currentSessionData.wayspot = null;
                            currentSessionData.wayspotTimestamp = null;
                        }
                    }
                }

                processTicketMessages(mostRecentTicket.messages);
            }
        }

        function categorizeTicketTitle(title) {
            const arrowSeparator = "→ ";
            const parts = title.split(arrowSeparator);

            if (parts.length > 1) {
                const extractedType = parts[1].trim();
                return extractedType;
            } else {
                console.warn("Ticket Manager couldn't parse title: ", title);
                return "???";
            }
        }

        function processTicketMessages(messages) {
            const lastMessage = messages[messages.length - 1];

            if (lastMessage.type === "Confirmation Accepted") {
                helpChatSessions[currentSession].inProgress = false;
                saveDataToLocalStorage();
            } else {
                helpChatSessions[currentSession].inProgress = true;

                let wayspotFound = false;
                let wayspotName = '';
                let wayspotTimestamp;

                const wayspotQuestions = [
                    { lang: 'en', question: "What is the name of the Wayspot?" },
                    { lang: 'cs', question: "Jak se jmenuje WaysPot?" },
                    { lang: 'de', question: "Wie heißt der Waypot?" },
                    { lang: 'es', question: "¿Cuál es el nombre de Wayspot?" },
                    { lang: 'fr', question: "Quel est le nom du Wayspot?" },
                    { lang: 'it', question: "Qual è il nome di The Wayspot?" },
                    { lang: 'ja', question: "Wayspotの名前は何ですか？" },
                    { lang: 'ko', question: "Wayspot의 이름은 무엇입니까?" },
                    { lang: 'pt', question: "Qual é o nome do Wayspot?" },
                    { lang: 'nl', question: "Wat is de naam van de WaySpot?" },
                    { lang: 'no', question: "Hva heter WaysPot?" },
                    { lang: 'pl', question: "Jak nazywa się Wayspot?" },
                    { lang: 'sv', question: "Vad heter The WaysPot?" },
                    { lang: 'th', question: "Wayspot ชื่ออะไร?" },
                    { lang: 'zh', question: "Wayspot的名稱是什麼？" },
                    { lang: 'hi', question: "तरीके का नाम क्या है?" },
                    { lang: 'tr', question: "Wayspot'un adı nedir?" },
                ];

                for (let i = 0; i < wayspotQuestions.length; i++) {
                    const currentQuestion = decodeHTMLEntities(wayspotQuestions[i].question);
                    const decodedLastMessage = decodeHTMLEntities(lastMessage.body);
                    if (decodedLastMessage === currentQuestion) {
                        isTheNextMessageTheWayspotTitle = true;
                        break;
                    }
                }

                if (messages.length > 1) {
                    for (let i = messages.length - 1; i >= 0; i--) {
                        const currentMessage = messages[i];
                        const nextMessage = messages[i + 1];

                        if (currentMessage && currentMessage.body && nextMessage && nextMessage.body) {
                            for (let i = 0; i < wayspotQuestions.length; i++) {
                                const currentQuestion = decodeHTMLEntities(wayspotQuestions[i].question);
                                const currentBody = decodeHTMLEntities(currentMessage.body);
                                if (currentBody === currentQuestion && nextMessage.body) {
                                    wayspotFound = true;
                                    wayspotName = decodeHTMLEntities(nextMessage.body);
                                    wayspotTimestamp = nextMessage.created_at;
                                    break;
                                }
                            }
                        }
                    }
                } else if (messages.length === 1) {
                    const currentMessage = messages[0];
                    const currentBody = decodeHTMLEntities(currentMessage.body);

                    // Check if current message matches any known "Wayspot question"
                    // This is a backup to stop it putting "What is the name of the Wayspot?" as the Wayspot title
                    const isCurrentMessageAQuestion = wayspotQuestions.some(q =>
                                                                            currentBody === decodeHTMLEntities(q.question)
                                                                           );

                    if (isTheNextMessageTheWayspotTitle && !isCurrentMessageAQuestion) {
                        wayspotName = currentBody;
                        wayspotTimestamp = currentMessage.created_at;
                        wayspotFound = true;
                        isTheNextMessageTheWayspotTitle = false;
                    }
                }

                if (wayspotFound) {
                    const currentSessionData = helpChatSessions[currentSession];
                    const existingWayspotTimestamp = currentSessionData.wayspotTimestamp || 0;

                    if (wayspotTimestamp > existingWayspotTimestamp) {
                        currentSessionData.wayspot = wayspotName;
                        currentSessionData.wayspotTimestamp = wayspotTimestamp;
                    }
                }

                saveDataToLocalStorage();
            }
        }

        function removeInterfaceContainer() {
            const syncModal = document.getElementById('wftmSyncModal');
            if (syncModal && typeof syncModal._wftmCleanup === 'function') {
                syncModal._wftmCleanup();
            }

            const interfaceContainer = document.getElementById('ticketInterfaceContainer');
            if (interfaceContainer) {
                interfaceContainer.remove();
            }
        }

        function addTicketSwitchButton() {
            if (document.getElementById('ticketSwitchButton')) {
                ticketButtonAdded = true;
                return;
            }

            const containerDiv = document.createElement('div');
            containerDiv.classList.add('wftm-containerDiv');

            containerDiv.innerHTML = `
        <button aria-label="Switch Tickets" id="ticketSwitchButton" style="position: absolute; top: 0px; left: 0px; width: 48px; height: 48px; background: linear-gradient(131deg, rgba(216, 88, 19, 0.75), rgb(216, 88, 19) 123%); border-radius: 50%; cursor: pointer; box-sizing: border-box; padding: 12px 10px 8px; border: none; outline-offset: -4px; outline: rgba(0, 103, 244, 0.4) solid 0px;" class="hs-websdk-launcher-anti-clockwise">
          <span style="background: rgb(233, 75, 75); border-radius: 50%; color: rgb(255, 255, 255); width: 20px; height: 20px; line-height: 20px; text-align: center; font-size: 12px; position: absolute; top: 0px; right: 4px; font-family: sans-serif; left: auto; display: none;"></span>
          <span>
            <svg fill="#ffffff" version="1.1" id="Layer_1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 512 512" xml:space="preserve">
              <g>
                <g>
                  <g>
                    <path d="M72.837,213.333H320c11.782,0,21.333-9.551,21.333-21.333c0-11.782-9.551-21.333-21.333-21.333H72.837l48.915-48.915
				c8.331-8.331,8.331-21.839,0-30.17c-8.331-8.331-21.839-8.331-30.17,0L6.248,176.915c-0.497,0.497-0.967,1.02-1.413,1.564
				c-0.202,0.246-0.378,0.506-0.567,0.759c-0.228,0.304-0.463,0.601-0.675,0.918c-0.203,0.303-0.379,0.618-0.565,0.929
				c-0.171,0.286-0.351,0.566-0.509,0.861c-0.17,0.317-0.314,0.644-0.466,0.968c-0.145,0.307-0.298,0.609-0.429,0.924
				c-0.13,0.315-0.236,0.637-0.35,0.957c-0.121,0.337-0.25,0.669-0.354,1.013c-0.097,0.32-0.168,0.645-0.249,0.969
				c-0.089,0.351-0.187,0.698-0.258,1.056c-0.074,0.375-0.118,0.753-0.172,1.13c-0.044,0.311-0.104,0.618-0.135,0.933
				c-0.138,1.4-0.138,2.811,0,4.211c0.031,0.315,0.09,0.621,0.135,0.933c0.054,0.377,0.098,0.756,0.173,1.13
				c0.071,0.358,0.169,0.704,0.258,1.055c0.081,0.324,0.152,0.649,0.249,0.969c0.104,0.344,0.233,0.677,0.354,1.013
				c0.115,0.32,0.22,0.642,0.35,0.957c0.13,0.315,0.284,0.616,0.429,0.923c0.153,0.324,0.297,0.651,0.467,0.969
				c0.158,0.294,0.337,0.573,0.508,0.859c0.186,0.312,0.362,0.627,0.565,0.931c0.211,0.316,0.446,0.612,0.673,0.916
				c0.19,0.254,0.366,0.514,0.569,0.761c0.443,0.54,0.91,1.059,1.403,1.552c0.004,0.004,0.006,0.008,0.01,0.011l85.333,85.333
				c8.331,8.331,21.839,8.331,30.17,0c8.331-8.331,8.331-21.839,0-30.17L72.837,213.333z" />
                    <path d="M507.164,333.522c0.204-0.248,0.38-0.509,0.571-0.764c0.226-0.302,0.461-0.598,0.671-0.913
				c0.204-0.304,0.38-0.62,0.566-0.932c0.17-0.285,0.349-0.564,0.506-0.857c0.17-0.318,0.315-0.646,0.468-0.971
				c0.145-0.306,0.297-0.607,0.428-0.921c0.13-0.315,0.236-0.637,0.35-0.957c0.121-0.337,0.25-0.669,0.354-1.013
				c0.097-0.32,0.168-0.646,0.249-0.969c0.089-0.351,0.187-0.698,0.258-1.055c0.074-0.375,0.118-0.753,0.173-1.13
				c0.044-0.311,0.104-0.617,0.135-0.933c0.138-1.4,0.138-2.811,0-4.211c-0.031-0.315-0.09-0.621-0.135-0.933
				c-0.054-0.377-0.098-0.756-0.173-1.13c-0.071-0.358-0.169-0.704-0.258-1.055c-0.081-0.324-0.152-0.649-0.249-0.969
				c-0.104-0.344-0.233-0.677-0.354-1.013c-0.115-0.32-0.22-0.642-0.35-0.957c-0.13-0.314-0.283-0.615-0.428-0.921
				c-0.153-0.325-0.297-0.653-0.468-0.971c-0.157-0.293-0.336-0.572-0.506-0.857c-0.186-0.312-0.363-0.628-0.566-0.932
				c-0.211-0.315-0.445-0.611-0.671-0.913c-0.191-0.255-0.368-0.516-0.571-0.764c-0.439-0.535-0.903-1.05-1.392-1.54
				c-0.007-0.008-0.014-0.016-0.021-0.023l-85.333-85.333c-8.331-8.331-21.839-8.331-30.17,0s-8.331,21.839,0,30.17l48.915,48.915
				H192c-11.782,0-21.333,9.551-21.333,21.333s9.551,21.333,21.333,21.333h247.163l-48.915,48.915
				c-8.331,8.331-8.331,21.839,0,30.17s21.839,8.331,30.17,0l85.333-85.333c0.008-0.008,0.014-0.016,0.021-0.023
				C506.261,334.572,506.725,334.057,507.164,333.522z" />
                  </g>
                </g>
              </g>
            </svg>
          </span>
        </button>
    `;

            document.body.appendChild(containerDiv);

            // Add event listener to the button
            const ticketSwitchButton = document.getElementById('ticketSwitchButton');
            ticketSwitchButton.addEventListener('click', function() {
                if (document.getElementById('ticketInterfaceContainer')) {
                    // If interfaceContainer exists, remove it to prevent doubles
                    removeInterfaceContainer();
                } else {
                    // If interfaceContainer doesn't exist, create it
                    const interfaceContainer = document.createElement('div');
                    interfaceContainer.id = 'ticketInterfaceContainer';
                    interfaceContainer.classList.add('wftm-interface-container');

                    const header = document.createElement('header');
                    header.classList.add('wftm-header');

                    const avatarTitleWrapper = document.createElement('div');
                    avatarTitleWrapper.classList.add('wftm-avatarTitleWrapper');

                    const avatarWrapper = document.createElement('div');
                    avatarWrapper.classList.add('wftm-avatarWrapper');

                    const avatarImage = document.createElement('img');
                    avatarImage.src = 'https://s3.amazonaws.com/assets.helpshift.com/niantic/avatar/5b16a10a-a694-4302-9218-337ec26b3150/64.png';
                    avatarImage.alt = 'Avatar Image';
                    avatarImage.classList.add('wftm-avatarImage');
                    avatarWrapper.appendChild(avatarImage);

                    const textWrapper = document.createElement('div');
                    textWrapper.classList.add('wftm-textWrapper');

                    const titleText = document.createElement('span');
                    titleText.textContent = 'Wayfarer Ticket Manager';
                    titleText.classList.add('wftm-titleText');
                    textWrapper.appendChild(titleText);

                    const menuButton = document.createElement('button');
                    menuButton.type = 'button';
                    menuButton.setAttribute('aria-label', 'Ticket Manager menu');
                    menuButton.setAttribute('aria-haspopup', 'menu');
                    menuButton.setAttribute('aria-expanded', 'false');
                    menuButton.classList.add('wftm-menuButton');
                    menuButton.textContent = '☰';

                    const closeButton = document.createElement('button');
                    closeButton.type = 'button';
                    closeButton.setAttribute('aria-label', 'Close Ticket Manager');
                    closeButton.classList.add('wftm-closeButton');
                    closeButton.textContent = '×';
                    closeButton.addEventListener('click', removeInterfaceContainer);

                    const headerActions = document.createElement('div');
                    headerActions.classList.add('wftm-headerActions');
                    headerActions.appendChild(menuButton);
                    headerActions.appendChild(closeButton);

                    avatarTitleWrapper.appendChild(avatarWrapper);
                    avatarTitleWrapper.appendChild(textWrapper);
                    header.appendChild(avatarTitleWrapper);
                    header.appendChild(headerActions);
                    interfaceContainer.appendChild(header);
                    interfaceContainer.appendChild(
                        createTicketManagerMenu(interfaceContainer, menuButton)
                    );

                    // Create the table
                    const table = document.createElement('table');
                    table.style.color = '#000000';
                    table.style.width = '100%';
                    const tbody = document.createElement('tbody');

                    // Create table headers
                    const thead = document.createElement('thead');
                    const headerRow = document.createElement('tr');

                    // Create and style the header cells
                    const headerNumber = document.createElement('th');
                    headerNumber.textContent = '#';
                    headerNumber.style.textAlign = 'center';

                    const headerSummary = document.createElement('th');
                    headerSummary.textContent = 'Ticket summary';
                    headerSummary.style.textAlign = 'left';

                    const headerRestore = document.createElement('th');
                    headerRestore.textContent = 'Restore';
                    headerRestore.style.textAlign = 'center';

                    const headerDelete = document.createElement('th');
                    headerDelete.textContent = 'Delete';
                    headerDelete.style.textAlign = 'center';

                    headerRow.appendChild(headerNumber);
                    headerRow.appendChild(headerSummary);
                    headerRow.appendChild(headerRestore);
                    headerRow.appendChild(headerDelete);

                    thead.appendChild(headerRow);
                    table.appendChild(thead);

                    // Populate table with helpChatSessions data
                    let index = 1;
                    for (const key in helpChatSessions) {
                        const rowData = helpChatSessions[key];
                        const row = document.createElement('tr');

                        // Create and style the cells
                        const cellNumber = document.createElement('td');
                        cellNumber.textContent = index;
                        cellNumber.style.textAlign = 'center';

                        const cellSummary = document.createElement('td');
                        cellSummary.style.textAlign = 'left';
                        if (rowData.inProgress === false || !rowData.type) {
                            if (!rowData.type) {
                                cellSummary.textContent = 'No active ticket';
                            } else {
                                cellSummary.textContent = `[Previous ticket] ${rowData.type}`;
                                if (rowData.wayspot) {
                                    cellSummary.textContent += `: ${rowData.wayspot}`;
                                }
                            }
                        } else {
                            cellSummary.textContent = rowData.type;
                            if (rowData.wayspot) {
                                cellSummary.textContent += `: ${rowData.wayspot}`;
                            }
                        }

                        const cellRestore = document.createElement('td');
                        cellRestore.style.textAlign = 'center';
                        if (key !== currentSession) {
                            const restoreText = document.createElement('span');
                            restoreText.style.cursor = 'pointer';
                            restoreText.textContent = '♻️';
                            cellRestore.appendChild(restoreText);
                        }

                        const cellDelete = document.createElement('td');
                        cellDelete.style.textAlign = 'center';
                        const deleteText = document.createElement('span');
                        deleteText.style.cursor = 'pointer';
                        deleteText.textContent = '🗑️';
                        cellDelete.appendChild(deleteText);

                        row.appendChild(cellNumber);
                        row.appendChild(cellSummary);
                        row.appendChild(cellRestore);
                        row.appendChild(cellDelete);
                        tbody.appendChild(row);
                        index++;

                        cellDelete.addEventListener('click', function() {
                            const aui = key;
                            // Handle delete action using aui value
                            deleteTicket(aui);
                        });

                        if (key !== currentSession) {
                            cellRestore.addEventListener('click', function() {
                                const aui = key;
                                const asi = helpChatSessions[aui].asi;
                                const di = helpChatSessions[aui].di;
                                restoreOldTicket({ aui, asi, di });
                            });
                        }
                    }

                    // Show the current unused Helpshift session without storing or syncing it.
                    if (currentSession &&
                        currentSessionCredentials?.di &&
                        !helpChatSessions[currentSession] &&
                        !isTicketSyncTombstoned(currentSession)) {
                        const row = document.createElement('tr');

                        const cellNumber = document.createElement('td');
                        cellNumber.textContent = index;
                        cellNumber.style.textAlign = 'center';

                        const cellSummary = document.createElement('td');
                        cellSummary.style.textAlign = 'left';
                        cellSummary.textContent = 'No active ticket';

                        const cellRestore = document.createElement('td');
                        const cellDelete = document.createElement('td');

                        row.appendChild(cellNumber);
                        row.appendChild(cellSummary);
                        row.appendChild(cellRestore);
                        row.appendChild(cellDelete);
                        tbody.appendChild(row);
                        index++;
                    }

                    // Create the last row for creating a new ticket
                    const lastRow = document.createElement('tr');

                    // Create and style the cells
                    const cellNumberLast = document.createElement('td');
                    cellNumberLast.textContent = index;
                    cellNumberLast.style.textAlign = 'center';

                    const cellSummaryNew = document.createElement('td');
                    cellSummaryNew.style.textAlign = 'left';
                    const linkNewTicket = document.createElement('a');
                    linkNewTicket.href = '#';
                    linkNewTicket.textContent = 'Create a new ticket';
                    linkNewTicket.style.fontWeight = 'bold';
                    linkNewTicket.addEventListener('click', generateNewTicket);
                    cellSummaryNew.appendChild(linkNewTicket);

                    // Create empty cells for the last two columns
                    const cellEmpty1 = document.createElement('td');
                    const cellEmpty2 = document.createElement('td');

                    // Append cells to the last row
                    lastRow.appendChild(cellNumberLast);
                    lastRow.appendChild(cellSummaryNew);
                    lastRow.appendChild(cellEmpty1);
                    lastRow.appendChild(cellEmpty2);
                    tbody.appendChild(lastRow);

                    table.appendChild(tbody);

                    // The table fills the space previously occupied by the
                    // Export/Import footer. Those actions now live in the header menu.
                    const tableContainer = document.createElement('div');
                    tableContainer.classList.add('wftm-table-container');

                    tableContainer.appendChild(table);
                    interfaceContainer.appendChild(tableContainer);

                    document.body.appendChild(interfaceContainer);
                    function deleteTicket(aui) {
                        // Find the index of the aui in the keys of helpChatSessions
                        const keys = Object.keys(helpChatSessions);
                        const index = keys.indexOf(aui);

                        // Remove the corresponding row from the table
                        table.deleteRow(index + 1); // Add 1 to offset the header row

                        // Remove the aui from helpChatSessions
                        delete helpChatSessions[aui];

                        // Remove the aui entry from local storage
                        const storedData = JSON.parse(localStorage.getItem(OBJECT_STORE_NAME)) || {};
                        delete storedData[aui];
                        localStorage.setItem(OBJECT_STORE_NAME, JSON.stringify(storedData));
                        queueTicketSyncOperation('delete', aui);

                        // Update the visual display of row numbers to the AUI and remove it from the tablege
                        const rows = table.querySelectorAll('tr');
                        let rowIndex = 1; // Start from 1 to match the initial index
                        for (let i = 1; i < rows.length; i++) {
                            const row = rows[i];
                            row.cells[0].textContent = rowIndex;
                            rowIndex++;
                        }

                        // Check if helpChatSessions is empty and generate a new ticket if so
                        if (Object.keys(helpChatSessions).length === 0) {
                            generateNewTicket();
                        }
                    }
                }
            });
        }

        // Define CSS styles as a string
        const styles = `
.wftm-containerDiv {
    position: fixed;
    width: 48px;
    height: 48px;
    z-index: 9999991;
    box-shadow: rgba(0, 0, 0, 0.4) 0px 2px 24px 0px;
    border-radius: 50%;
    border: none;
    overflow: hidden;
    margin: 4px;
    padding: 0px;
    box-sizing: content-box;
    outline: none;
    inset: auto 74px 16px auto;
}
.wftm-interface-container {
    display: flex;
    flex-direction: column;
    position: fixed;
    inset: auto 16px 75px auto;
    min-height: 500px;
    max-height: 500px;
    min-width: 360px;
    max-width: 380px;
    height: calc(100% - 32px);
    width: 100%;
    border: none;
    border-radius: 12px;
    z-index: 9999999;
    overflow: hidden;
    background-color: #f0f2f4;
    transform: translate3d(0px, 0px, 0px);
    box-shadow: rgba(0, 0, 0, 0.2) 0px 4px 32px;
    animation: 0.3s cubic-bezier(0.25, 0.1, 0.25, 1) 0s 1 normal none running hs-websdk-slide-up;
}
.wftm-header {
    display: flex;
    position: relative;
    z-index: 2;
    flex: 0 0 auto;
    align-items: center;
    justify-content: space-between;
    height: 60px;
    padding: 0 16px;
    color: var(--header-text-color, #FFFFFF, #111827);
    background: linear-gradient(98deg, var(--header-bg-start-color, #d85813), var(--header-bg-start-color, #d85813bf) 130%);
}
.wftm-avatarTitleWrapper {
    display: flex;
    flex: 0 0 auto;
    align-items: center;
}
.wftm-avatarWrapper {
    position: relative;
}
.wftm-avatarImage {
    height: 36px;
    width: 36px;
    min-width: 36px;
    border-radius: 50%;
}
.wftm-textWrapper {
    padding-left: 16px;
    width: 100%;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: 16px;
    font-weight: 600;
}
.wftm-titleText {
    color: var(--text-color, white);
}
.wftm-headerActions {
    display: flex;
    flex: 0 0 auto;
    align-items: center;
    gap: 2px;
}
.wftm-menuButton,
.wftm-closeButton {
    padding: 0;
    margin: 0;
    cursor: pointer;
    background-color: transparent;
    border: none;
    align-items: center;
    justify-content: center;
    height: 36px;
    min-width: 36px;
    border-radius: 50%;
    display: flex;
    color: white;
}
.wftm-menuButton {
    font-size: 20px;
    line-height: 1;
}
.wftm-closeButton {
    font-size: 24px;
}
.wftm-menuButton:hover,
.wftm-closeButton:hover {
    background: rgba(255, 255, 255, 0.14);
}
.wftm-menuButton:focus-visible,
.wftm-closeButton:focus-visible {
    outline: 2px solid rgba(255, 255, 255, 0.85);
    outline-offset: -2px;
}
.wftm-menu {
    position: absolute;
    top: 54px;
    right: 12px;
    z-index: 6;
    min-width: 170px;
    padding: 6px;
    background: #ffffff;
    border: 1px solid #d8dde3;
    border-radius: 8px;
    box-shadow: rgba(0, 0, 0, 0.22) 0 4px 18px;
}
.wftm-menu[hidden] {
    display: none;
}
.wftm-menu-item {
    display: block;
    width: 100%;
    padding: 9px 10px;
    border: 0;
    border-radius: 5px;
    color: #111827;
    background: transparent;
    cursor: pointer;
    text-align: left;
    font-family: sans-serif;
    font-size: 13px;
}
.wftm-menu-item:hover,
.wftm-menu-item:focus-visible {
    background: #f0f2f4;
    outline: none;
}
.wftm-table-container {
    flex: 1 1 auto;
    min-height: 0;
    overflow: auto;
}
.wftm-modal-backdrop {
    position: absolute;
    inset: 0;
    z-index: 10;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 16px;
    box-sizing: border-box;
    background: rgba(17, 24, 39, 0.45);
}
.wftm-modal {
    width: 100%;
    max-width: 340px;
    padding: 16px;
    box-sizing: border-box;
    border-radius: 10px;
    background: #ffffff;
    color: #111827;
    box-shadow: rgba(0, 0, 0, 0.3) 0 8px 28px;
    font-family: sans-serif;
}
.wftm-modal-title-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
}
.wftm-modal-title {
    margin: 0;
    font-size: 18px;
    line-height: 1.3;
}
.wftm-modal-close {
    flex: 0 0 auto;
    width: 32px;
    height: 32px;
    padding: 0;
    border: 0;
    border-radius: 50%;
    background: transparent;
    color: #4b5563;
    cursor: pointer;
    font-size: 24px;
    line-height: 1;
}
.wftm-modal-close:hover {
    background: #f0f2f4;
}
.wftm-modal-description {
    margin: 8px 0 12px;
    color: #4b5563;
    font-size: 12px;
    line-height: 1.4;
}
.wftm-field-label {
    display: block;
    margin-top: 10px;
    color: #374151;
    font-size: 12px;
    font-weight: 600;
}
.wftm-field-input {
    display: block;
    width: 100%;
    margin-top: 5px;
    padding: 8px 9px;
    box-sizing: border-box;
    border: 1px solid #cbd1d8;
    border-radius: 5px;
    color: #111827;
    background: #ffffff;
    font-family: sans-serif;
    font-size: 12px;
}
.wftm-field-input:focus {
    border-color: #d85813;
    outline: 2px solid rgba(216, 88, 19, 0.18);
}
.wftm-sync-instructions {
    display: inline-block;
    margin-top: 10px;
    color: #b5470e;
    font-size: 12px;
    font-weight: 600;
    text-decoration: none;
}
.wftm-sync-instructions:hover {
    text-decoration: underline;
}
.wftm-sync-status {
    margin-top: 10px;
    min-height: 16px;
    color: #6b7280;
    font-size: 11px;
    line-height: 1.4;
}
.wftm-sync-status[data-kind="success"] {
    color: #166534;
}
.wftm-sync-status[data-kind="warning"] {
    color: #92400e;
}
.wftm-sync-status[data-kind="error"] {
    color: #b91c1c;
}
.wftm-modal-buttons {
    display: flex;
    flex-wrap: wrap;
    justify-content: flex-end;
    gap: 7px;
    margin-top: 14px;
}
.wftm-modal-button {
    min-height: 32px;
    padding: 6px 9px;
    border-radius: 5px;
    cursor: pointer;
    font-family: sans-serif;
    font-size: 12px;
    font-weight: 600;
}
.wftm-modal-button:disabled {
    opacity: 0.6;
    cursor: default;
}
.wftm-modal-button-primary {
    border: 1px solid #d85813;
    color: #ffffff;
    background: #d85813;
}
.wftm-modal-button-primary:hover:not(:disabled) {
    background: #bd4b0f;
}
.wftm-modal-button-secondary {
    border: 1px solid #cbd1d8;
    color: #374151;
    background: #ffffff;
}
.wftm-modal-button-secondary:hover:not(:disabled) {
    background: #f0f2f4;
}
.wftm-modal-button:focus-visible {
    outline: 2px solid rgba(0, 103, 244, 0.4);
    outline-offset: 1px;
}
@media (max-width: 640px) {
    .wftm-interface-container {
        inset: 0;
        width: 100%;
        min-width: 0;
        max-width: none;
        height: 100vh;
        height: 100dvh;
        min-height: 0;
        max-height: none;
        border-radius: 0;
    }
}

`

        // Create a style element
        const styleElement = document.createElement('style');
        styleElement.textContent = styles;

        // Append the style element to the document head
        document.head.appendChild(styleElement);
    }


    if (window.origin === ORIGIN_HELPSHIFT) {
        initHelp();
    } else if (window.origin === ORIGIN_WAYFARER) {
        initWF();
    }
}

init();