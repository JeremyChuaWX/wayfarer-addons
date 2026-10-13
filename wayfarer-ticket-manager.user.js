// ==UserScript==
// @name         Wayfarer Ticket Manager
// @version      0.10.0
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

        // Helpshift displays message times but does not always insert date
        // separators. Match the rendered messages to their API timestamps.
        const datedMessages = new Map();
        let dateSessionAui = localStorage.getItem('aui:scopelye-2d29204ff805eac');
        let dateRenderQueued = false;

        function normaliseDateMessageText(text) {
            return String(text || '').replace(/\s+/g, ' ').trim();
        }

        function getApiMessageText(body) {
            const template = document.createElement('template');
            template.innerHTML = body;
            return normaliseDateMessageText(template.content.textContent);
        }

        function collectMessageDates(data) {
            const activeAui = localStorage.getItem('aui:scopelye-2d29204ff805eac');
            if (activeAui !== dateSessionAui) {
                datedMessages.clear();
                dateSessionAui = activeAui;
            }

            const messages = [];
            if (Array.isArray(data?.issues)) {
                for (const issue of data.issues) {
                    if (Array.isArray(issue?.messages)) messages.push(...issue.messages);
                }
            }
            if (Array.isArray(data?.messages)) messages.push(...data.messages);
            if (data?.body && data?.created_at) messages.push(data);

            for (const message of messages) {
                const timestamp = Number(message?.created_at);
                if (!Number.isFinite(timestamp) || typeof message?.body !== 'string' ||
                    !message.body || !message.id) continue;
                const body = getApiMessageText(message.body);
                if (body) datedMessages.set(message.id, { timestamp, body });
            }

            // Older ticket history can span many pages. Retain a bounded set.
            if (datedMessages.size > 1000) {
                const latest = [...datedMessages.entries()]
                    .sort((a, b) => b[1].timestamp - a[1].timestamp)
                    .slice(0, 1000);
                datedMessages.clear();
                for (const [id, message] of latest) datedMessages.set(id, message);
            }
            scheduleMessageDates();
        }

        function matchesDisplayedTime(messageNode, timestamp) {
            const displayed = messageNode.querySelector('.hs-message__timestamp')?.textContent
                ?.trim().toUpperCase().replace(/\s+/g, ' ');
            if (!displayed) return true;
            const date = new Date(timestamp);
            const hour = date.getHours() % 12 || 12;
            const minute = String(date.getMinutes()).padStart(2, '0');
            const period = date.getHours() < 12 ? 'AM' : 'PM';
            // An unknown/24-hour format is not enough to reject a text match.
            if (!/^\d{1,2}:\d{2} (AM|PM)$/.test(displayed)) return true;
            return displayed === `${String(hour).padStart(2, '0')}:${minute} ${period}` ||
                displayed === `${hour}:${minute} ${period}`;
        }

        function renderMessageDates() {
            const list = document.querySelector('.hs-message-list');
            if (!list || !datedMessages.size) return;

            const timeline = [...datedMessages.values()]
                .sort((a, b) => a.timestamp - b.timestamp);
            // Use the closest preceding native date, not a global set of dates.
            // A September heading elsewhere in the conversation must never
            // suppress an October heading.
            function precedingNativeDate(node) {
                for (let previous = node.previousElementSibling; previous;
                     previous = previous.previousElementSibling) {
                    if (previous.hasAttribute('data-wftm-day')) continue;
                    let label;
                    if (previous.matches('.hs-message--timestamp')) {
                        label = previous.querySelector('.hs-message__chat-separator-content-text');
                    } else if (previous.matches('.hs-message__chat-separator-wrapper')) {
                        label = previous.querySelector('.hs-message--timestamp .hs-message__chat-separator-content-text');
                    }
                    if (label) return normaliseDateMessageText(label.textContent);
                }
                return '';
            }
            const needed = new Map();
            let cursor = 0;
            let previousDate = '';

            for (const message of list.querySelectorAll(':scope > .hs-message')) {
                const content = message.querySelector('.hs-message__item');
                if (!content) continue;
                const body = normaliseDateMessageText(content.textContent);
                // Bot-only state transitions have no visible message, so align
                // by text (and time where available), not by array positions.
                let index = timeline.findIndex((item, i) => i >= cursor &&
                    item.body === body && matchesDisplayedTime(message, item.timestamp));
                if (index < 0) continue;

                cursor = index + 1;
                const date = new Date(timeline[index].timestamp);
                const day = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
                if (day !== previousDate) {
                    needed.set(message, {
                        day,
                        label: new Intl.DateTimeFormat('en-US', {
                            weekday: 'long', month: 'long', day: 'numeric', year: 'numeric'
                        }).format(date)
                    });
                }
                previousDate = day;
            }

            // Keep existing dates if an API fragment cannot be matched. Remove
            // only when the adjacent message is gone, its confirmed day changes,
            // or Helpshift has inserted its own separator for that day.
            for (const wrapper of list.querySelectorAll(':scope > [data-wftm-day]')) {
                const message = wrapper.nextElementSibling;
                const expected = needed.get(message);
                if (!wrapper.matches('.hs-message__chat-separator-wrapper') ||
                    !message?.matches('.hs-message--left, .hs-message--right') ||
                    (expected && expected.day !== wrapper.dataset.wftmDay) ||
                    precedingNativeDate(wrapper) === wrapper.textContent.trim()) {
                    wrapper.remove();
                }
            }
            for (const [message, date] of needed) {
                const previous = message.previousElementSibling;
                if (previous?.dataset.wftmDay === date.day ||
                    precedingNativeDate(message) === date.label) continue;
                // Use Helpshift's native full-width wrapper so the pill is
                // centred across the conversation, not the narrower bubble area.
                const wrapper = document.createElement('div');
                wrapper.className = 'hs-message__chat-separator-wrapper';
                wrapper.dataset.wftmDay = date.day;
                const heading = document.createElement('div');
                heading.className = 'hs-message hs-message--timestamp';
                const label = document.createElement('span');
                label.className = 'hs-message__chat-separator-content-text';
                label.textContent = date.label;
                heading.appendChild(label);
                wrapper.appendChild(heading);
                list.insertBefore(wrapper, message);
            }
        }

        function scheduleMessageDates() {
            if (dateRenderQueued) return;
            dateRenderQueued = true;
            requestAnimationFrame(() => {
                dateRenderQueued = false;
                renderMessageDates();
            });
        }

        function watchMessageList() {
            // Includes replacements of the message list when changing tickets.
            const observer = new MutationObserver(mutations => {
                if (mutations.some(mutation => {
                    const element = mutation.target.nodeType === 1 ? mutation.target : null;
                    if (element?.closest('.hs-message-list')) return true;
                    return [...mutation.addedNodes].some(node => node.nodeType === 1 &&
                        (node.matches?.('.hs-message-list') || node.querySelector?.('.hs-message-list')));
                })) scheduleMessageDates();
            });
            observer.observe(document.documentElement, { childList: true, subtree: true });
            scheduleMessageDates();
        }

        if (document.documentElement) watchMessageList();
        else document.addEventListener('DOMContentLoaded', watchMessageList, { once: true });

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

            const { type, payload, requestId } = event.data;

            if (type === 'clearSession' || (type === 'restoreSession' && payload?.aui)) {
                let success = true;
                try {
                    if (type === 'clearSession') {
                        clearLocalStorage();
                    } else {
                        updateLocalStorage(payload);
                    }
                } catch (error) {
                    success = false;
                    console.error('Ticket Manager: Could not prepare Helpshift session', error);
                }

                // Do not reload the widget until its own origin has written the session.
                window.parent.postMessage({
                    source: WFTM_SOURCE,
                    type: 'sessionPrepared',
                    requestId,
                    payload: { success }
                }, ORIGIN_WAYFARER);
            }
        }

        window.addEventListener('message', handleParentMessage);

        function parseResponse() {
            try {
                const json = JSON.parse(this.responseText);
                if (!json) return;
                // A fresh anonymous identity may be created after this frame loads.
                // Report its credentials before passing ticket history to the parent.
                loadAndSendSessionValues();
                collectMessageDates(json);
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
                // Associate each response with the Helpshift identity that received it.
                sessionAui: localStorage.getItem('aui:scopelye-2d29204ff805eac'),
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
        // Conversation fragments are associated with the ticket identity and
        // message ID, rather than a single global "next message" flag.
        const wayspotMessageCache = new Map();
        let ticketButtonAdded = false;
        let iframeObserverStarted = false;
        let routeHooked = false;
        let waitingForIframe = false;
        let pendingTicketSwitch = null;
        let ticketSwitchRequestId = 0;
        let chatWidgetOpen = null;
        let ticketScan = null;
        let pausedTicketScan = null;
        let ticketScanStatus = '';
        const TICKET_SCAN_RESPONSE_TIMEOUT_MS = 15000;
        const TICKET_SCAN_SETTLE_MS = 100;
        const HELPSHIFT_RECEIVE_SOUND_URL =
              'https://webchat.helpshift.com/3.151.0/assets/audio/receive.mp3';
        let unreadSoundTarget = null;
        let notificationSound = null;

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
                return button;
            };

            const scanButton = addMenuButton('Check for updates', () => {
                if (ticketScan) stopTicketScan('Update scan paused.');
                else if (pausedTicketScan) continueTicketScan();
                else startTicketScan();
            });
            scanButton.classList.add('wftm-scan-action');
            scanButton.textContent = getTicketScanActionLabel();
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

        function observeChatOpenState() {
            window.addEventListener('wftm-widget-toggle', event => {
                chatWidgetOpen = event.detail === true;
            });

            const script = document.createElement('script');
            script.textContent = `(() => {
                if (typeof window.Helpshift === 'function') {
                    window.Helpshift('addEventListener', 'widgetToggle', data => {
                        window.dispatchEvent(new CustomEvent('wftm-widget-toggle', {
                            detail: data.visible === true
                        }));
                    });
                }
            })();`;
            document.documentElement.appendChild(script);
            script.remove();
        }

        function isHelpChatIframeVisible(iframe) {
            const style = getComputedStyle(iframe);
            const rect = iframe.getBoundingClientRect();
            return style.display !== 'none' && style.visibility !== 'hidden' &&
                rect.width > 150 && rect.height > 150;
        }

        function isHelpChatOpen(iframe) {
            // Prefer the SDK's own toggle state when one has been reported.
            return chatWidgetOpen ?? isHelpChatIframeVisible(iframe);
        }

        // Follow the visible 48px Helpshift button, which sits 16px inside
        // its 80px launcher iframe. Preserve the original 58px gap between
        // button edges and their common vertical alignment.
        function syncTicketManagerPosition() {
            const launcher = document.getElementById('hs-web-sdk-iframe-launcher');
            const button = document.querySelector('.wftm-containerDiv');
            if (!launcher || !button) return;

            const chat = launcher.getBoundingClientRect();
            if (!chat.width || !chat.height) return;

            // Compare both elements in rendered viewport coordinates. On mobile
            // Safari, pinch-zoom can make a fixed element's CSS left/top use a
            // different viewport origin from getBoundingClientRect().
            const rect = button.getBoundingClientRect();
            const left = (parseFloat(button.style.left) || 0) +
                chat.right - 16 - button.offsetWidth - 58 - rect.left;
            const top = (parseFloat(button.style.top) || 0) +
                chat.bottom - 16 - button.offsetHeight - rect.top;
            button.style.left = `${left}px`;
            button.style.top = `${top}px`;
            button.style.visibility = 'visible';

            const panel = document.getElementById('ticketInterfaceContainer');
            if (!panel) return;

            // Keep the existing full-screen layout on small screens. Desktop
            // positioning is always derived from the ticket launcher instead.
            if (window.matchMedia?.('(max-width: 640px)').matches) {
                panel.style.left = '';
                panel.style.top = '';
                panel.style.height = '';
            } else {
                // Anchor the bottom as before, but shrink the scrollable ticket
                // list when a short window would push the header off-screen.
                const bottom = top + button.offsetHeight - 55;
                panel.style.height = `${Math.min(500, Math.max(60, bottom - 8))}px`;
                panel.style.left = `${left + button.offsetWidth + 62 - panel.offsetWidth}px`;
                panel.style.top = `${Math.max(8, bottom - panel.offsetHeight)}px`;
            }
            panel.style.visibility = 'visible';
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
            syncTicketManagerPosition();

            // Keep the manager open if the launcher is temporarily hidden by routing.
            // WFMM mobile fullscreen dialogs still take precedence over this panel.
            if (isWfmmMobileFullscreenModalOpen()) {
                removeInterfaceContainer();
            }
        }

        // Reattach when Helpshift recreates its launcher. Also watch ancestors:
        // another userscript may move the launcher by styling its parent.
        const observeHelpLauncherVisibility = () => {
            let launcher = null;
            let launcherObserver = null;
            let launcherResizeObserver = null;
            let followUntil = 0;
            let followFrame = null;

            // Follow CSS transitions too: one style mutation can animate the
            // launcher's position without causing further attribute mutations.
            const followLauncherMotion = () => {
                followUntil = performance.now() + 750;
                if (followFrame !== null) return;
                const frame = () => {
                    followFrame = null;
                    syncTicketManagerPosition();
                    if (performance.now() < followUntil) {
                        followFrame = requestAnimationFrame(frame);
                    }
                };
                followFrame = requestAnimationFrame(frame);
            };

            const attachLauncherObserver = () => {
                const nextLauncher = document.getElementById('hs-web-sdk-iframe-launcher');

                if (nextLauncher !== launcher) {
                    launcherObserver?.disconnect();
                    launcherResizeObserver?.disconnect();
                    launcherObserver = null;
                    launcherResizeObserver = null;
                    launcher = nextLauncher;

                    if (launcher) {
                        launcherObserver = new MutationObserver(() => {
                            syncTicketButtonVisibility();
                            followLauncherMotion();
                        });
                        for (let node = launcher; node; node = node.parentElement) {
                            launcherObserver.observe(node, {
                                attributes: true,
                                attributeFilter: ['style', 'class', 'hidden']
                            });
                        }
                        if (typeof ResizeObserver === 'function') {
                            launcherResizeObserver = new ResizeObserver(syncTicketManagerPosition);
                            launcherResizeObserver.observe(launcher);
                        }
                        followLauncherMotion();
                    }
                }

                syncTicketButtonVisibility();
            };

            const documentObserver = new MutationObserver(attachLauncherObserver);
            documentObserver.observe(document.documentElement, {
                childList: true,
                subtree: true
            });

            window.addEventListener('resize', syncTicketManagerPosition);
            window.addEventListener('scroll', syncTicketManagerPosition, { capture: true, passive: true });
            if (window.visualViewport) {
                window.visualViewport.addEventListener('resize', syncTicketManagerPosition);
                // Pinch-panning may move the visual viewport without a resize.
                window.visualViewport.addEventListener('scroll', syncTicketManagerPosition);
            }

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

        function ensureTicketManagerLoaded() {
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
                    observeHelpLauncherVisibility();
                    observeChatOpenState();
                    iframeObserverStarted = true;
                }
            })
                .catch(() => {
                waitingForIframe = false;
                console.error('Iframe not found.');
            });
        }

        function handleRouteChange() {
            // The persistent Helpshift widget remains available on every Wayfarer route.
            // Route changes should neither dismiss the manager nor interrupt scans.
            ensureTicketManagerLoaded();
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
        ensureTicketManagerLoaded();

        function finishTicketSwitch(success = false) {
            if (!pendingTicketSwitch) return;
            const switchedAui = pendingTicketSwitch.aui;
            clearTimeout(pendingTicketSwitch.timeout);
            pendingTicketSwitch = null;
            if (ticketScan && ticketScan.awaitingAui === switchedAui && !success) {
                console.warn('Ticket Manager: Scan ticket session failed to load', {
                    ticket: ticketScan.positionByAui.get(switchedAui)
                });
                stopTicketScan(`Update scan stopped: ticket ${ticketScan.positionByAui.get(switchedAui)} session failed to load.`);
            }
        }

        // Persistent Help Chat and the native site initialise Helpshift in page
        // context. Run the API there as well, even with userscript isolation.
        function callHelpshift(command) {
            let result = null;
            const handleResult = event => { result = event.detail; };
            window.addEventListener('wftm-helpshift-reload', handleResult, { once: true });

            const script = document.createElement('script');
            script.textContent = `(() => {
                let status = 'ok';
                try {
                    if (typeof window.Helpshift !== 'function') {
                        throw new Error('Helpshift SDK is not available');
                    }
                    window.Helpshift(${JSON.stringify(command)});
                } catch (error) {
                    console.error('Ticket Manager: Helpshift command failed', error);
                    status = 'error';
                }
                window.dispatchEvent(new CustomEvent('wftm-helpshift-reload', { detail: status }));
            })();`;
            document.documentElement.appendChild(script);
            script.remove();
            window.removeEventListener('wftm-helpshift-reload', handleResult);
            return result === 'ok';
        }

        function reloadHelpWidget() {
            return callHelpshift('updateHelpshiftConfig');
        }

        // Restoring a saved identity works through the SDK config reload.
        // Creating a new anonymous identity needs a fresh iframe document:
        // the SDK can otherwise retain the current conversation in memory.
        function reloadHelpIframe() {
            const iframe = document.getElementById('hs-web-sdk-iframe');
            if (!iframe) return false;

            const src = iframe.getAttribute('src');
            if (!src || new URL(src, location.href).origin !== ORIGIN_HELPSHIFT) {
                console.error('Ticket Manager: Helpshift iframe has no reloadable URL.');
                return false;
            }

            const reopenChat = isHelpChatOpen(iframe);
            if (pendingTicketSwitch) pendingTicketSwitch.reopenChat = reopenChat;
            const switchId = pendingTicketSwitch?.id;

            // Sync the SDK's open/closed state before replacing only the frame.
            // Without this, the SDK treats the first launcher click as "close".
            if (reopenChat && !callHelpshift('close')) return false;

            if (reopenChat) {
                iframe.addEventListener('load', () => {
                    // The iframe's load event can precede readiness of the chat app.
                    // Retry the SDK open command until the window is visibly open.
                    let attempts = 0;
                    let visibleChecks = 0;
                    const reopen = () => {
                        if (ticketSwitchRequestId !== switchId ||
                            document.getElementById('hs-web-sdk-iframe') !== iframe) return;

                        if (isHelpChatIframeVisible(iframe)) {
                            // Ensure the widget stays open through initialisation.
                            if (++visibleChecks >= 2) return;
                        } else {
                            visibleChecks = 0;
                            if (++attempts > 8) {
                                console.warn('Ticket Manager: Help Chat did not reopen automatically.');
                                return;
                            }
                            callHelpshift('open');
                        }
                        setTimeout(reopen, 400);
                    };
                    setTimeout(reopen, 200);
                }, { once: true });
            }

            iframe.src = src;
            return true;
        }

        window.addEventListener('message', function(event) {
            if (event.origin !== ORIGIN_HELPSHIFT) return;
            if (!isSafeObject(event.data)) return;
            if (event.data.source !== WFTM_SOURCE) return;

            // An old iframe must never finish a switch or update ticket metadata.
            const iframe = document.getElementById('hs-web-sdk-iframe');
            if (!iframe || event.source !== iframe.contentWindow) return;

            const { type, payload, requestId, sessionAui } = event.data;

            if (type === 'sessionPrepared') {
                if (!pendingTicketSwitch ||
                    pendingTicketSwitch.phase !== 'preparing' ||
                    requestId !== pendingTicketSwitch.id) return;

                if (!payload?.success) {
                    console.error('Ticket Manager: Session could not be prepared.');
                    finishTicketSwitch();
                    return;
                }

                pendingTicketSwitch.phase = 'reloading';
                const creatingNewTicket = pendingTicketSwitch.type === 'clearSession';
                const reloaded = creatingNewTicket ? reloadHelpIframe() : reloadHelpWidget();
                if (!reloaded) {
                    console.error('Ticket Manager: Could not reload Helpshift. Refresh Wayfarer manually.');
                    finishTicketSwitch();
                    return;
                }

                if (creatingNewTicket) {
                    // Do not associate the fresh conversation with the previous AUI.
                    currentSession = null;
                    currentSessionCredentials = null;
                    refreshTicketManagerTickets();
                }

                clearTimeout(pendingTicketSwitch.timeout);
                pendingTicketSwitch.timeout = setTimeout(() => {
                    console.warn('Ticket Manager: No session confirmation after widget reload. Check the chat; refresh Wayfarer if needed.');
                    finishTicketSwitch();
                }, 10000);
                return;
            }

            if (type === 'sessionValues') {
                let bufferedHistory = [];
                if (pendingTicketSwitch) {
                    if (pendingTicketSwitch.phase !== 'reloading') return;
                    if (pendingTicketSwitch.type === 'clearSession') {
                        // A blank first report is normal while Helpshift generates
                        // its new anonymous identity. Ignore the previous AUI too.
                        if (!payload?.di || !payload?.aui ||
                            payload.aui === pendingTicketSwitch.previousAui) return;
                    } else if (payload?.aui !== pendingTicketSwitch.aui) {
                        return;
                    }
                    // Helpshift may deliver history before it confirms the new
                    // identity. Once confirmed, consume only that identity's
                    // buffered responses rather than losing its first messages.
                    bufferedHistory = pendingTicketSwitch.queuedHistory || [];
                    finishTicketSwitch(true);
                    if (ticketScan?.restoreUnsaved &&
                        ticketScan.awaitingAui === payload?.aui &&
                        ticketScan.index >= ticketScan.order.length) {
                        stopTicketScan(`Update scan complete: ${ticketScan.order.length} tickets checked.`, { complete: true });
                    }
                }

                const previousSession = currentSession;
                currentSession = payload?.aui || null;
                currentSessionCredentials = payload?.di ? {
                    di: payload.di,
                    asi: payload.asi
                } : null;
                if (previousSession !== currentSession) {
                    // Keep conversation fragments for their original ticket;
                    // a different ticket's messages must not alter them.
                    refreshTicketManagerTickets();
                }
                if (ticketScan?.awaitingHistory && ticketScan.awaitingAui === currentSession) {
                    ticketScan.sessionConfirmed = true;
                    logTicketScan('Session confirmed', { bufferedResponses: bufferedHistory.length });
                }
                for (const response of bufferedHistory) {
                    if (response.sessionAui !== currentSession) continue;
                    handleTicketHistory(response.payload, response.sessionAui);
                }
            } else if (type === 'ticketHistory' && payload) {
                if (pendingTicketSwitch) {
                    // Buffer only responses known to belong to the new identity.
                    // Responses from the previous iframe/session are discarded.
                    const switching = pendingTicketSwitch;
                    const belongsToNewTicket = switching.phase === 'reloading' &&
                        sessionAui &&
                        (switching.type === 'clearSession'
                            ? sessionAui !== switching.previousAui
                            : sessionAui === switching.aui);
                    if (belongsToNewTicket) {
                        switching.queuedHistory.push({ sessionAui, payload });
                        if (switching.queuedHistory.length > 30) switching.queuedHistory.shift();
                        logTicketScan('Conversation response buffered until session confirmation');
                    } else if (ticketScan?.awaitingHistory) {
                        ticketScan.lastResponseRejection = 'unexpected session during switch';
                        logTicketScan('Conversation response rejected', { reason: 'unexpected session during switch' });
                    }
                    return;
                }
                // Do not apply a delayed response to the wrong ticket.
                if (sessionAui && sessionAui !== currentSession) {
                    if (ticketScan?.awaitingHistory) {
                        ticketScan.lastResponseRejection = 'session mismatch';
                        logTicketScan('Conversation response rejected', { reason: 'session mismatch' });
                    }
                    return;
                }
                handleTicketHistory(payload, sessionAui);
            }
        });

        // Updating the ticket summary must not prevent the scan from seeing
        // a valid response. Likewise, scan failures must be reported explicitly.
        function handleTicketHistory(data, sessionAui) {
            try {
                processTicketData(data);
            } catch (error) {
                console.error('Ticket Manager: Ticket summary processing failed', {
                    errorType: error?.name || 'UnknownError'
                });
                logTicketScan('Ticket summary processing failed');
            }
            try {
                notifyIfSwitchedTicketIsUnread(data, sessionAui);
            } catch (error) {
                console.error('Ticket Manager: Unread notification check failed', {
                    errorType: error?.name || 'UnknownError'
                });
            }
            try {
                processTicketScanResponse(data, sessionAui);
            } catch (error) {
                console.error('Ticket Manager: Scan response processing failed', {
                    errorType: error?.name || 'UnknownError'
                });
                if (ticketScan?.awaitingHistory) {
                    const ticketNumber = ticketScan.positionByAui.get(ticketScan.awaitingAui);
                    stopTicketScan(`Update scan stopped: ticket ${ticketNumber} response processing failed.`);
                }
            }
        }

        function postToHelp(type, payload = null, requestId = null) {
            const iframe = document.getElementById('hs-web-sdk-iframe');
            if (!iframe || !iframe.contentWindow) {
                console.warn('Ticket Manager: Helpshift iframe not available');
                return false;
            }

            iframe.contentWindow.postMessage({
                source: WFTM_SOURCE,
                type,
                payload,
                requestId
            }, ORIGIN_HELPSHIFT);

            return true;
        }

        function switchTicket(type, data = null) {
            if (pendingTicketSwitch) return false;

            const id = ++ticketSwitchRequestId;
            if (!postToHelp(type, data, id)) {
                return false;
            }

            saveDataToLocalStorage();
            // Arm a short-lived unread check only when restoring an identity.
            // A new ticket and an ordinary incoming message do not need a replay.
            unreadSoundTarget = type === 'restoreSession' ? {
                aui: data.aui,
                expires: Date.now() + 20000
            } : null;
            pendingTicketSwitch = {
                id,
                type,
                aui: data?.aui || null,
                previousAui: currentSession,
                phase: 'preparing',
                queuedHistory: [],
                timeout: setTimeout(() => {
                    console.warn('Ticket Manager: Helpshift did not confirm the session change. Refresh Wayfarer if needed.');
                    finishTicketSwitch();
                }, 5000)
            };
            return true;
        }

        // The SDK normally plays this sound when a reply arrives, but not when
        // switching to a stored identity whose messages are already unread.
        function playUnreadReplySound() {
            try {
                if (!notificationSound) {
                    notificationSound = new Audio(HELPSHIFT_RECEIVE_SOUND_URL);
                    notificationSound.preload = 'auto';
                }
                notificationSound.currentTime = 0;
                const playback = notificationSound.play();
                playback?.catch(error => {
                    console.warn('Ticket Manager: Unread reply sound could not play', error);
                });
            } catch (error) {
                console.warn('Ticket Manager: Unread reply sound could not play', error);
            }
        }

        function notifyIfSwitchedTicketIsUnread(data, sessionAui) {
            if (!unreadSoundTarget || pendingTicketSwitch ||
                unreadSoundTarget.aui !== currentSession ||
                Date.now() > unreadSoundTarget.expires ||
                (sessionAui && sessionAui !== unreadSoundTarget.aui)) return;

            if (hasUnreadTicketReply(data)) {
                // A single request may be reported twice by the XHR listener.
                // Only replay the sound once for each ticket switch.
                unreadSoundTarget = null;
                playUnreadReplySound();
            }
        }

        function restoreOldTicket(data) {
            if (ticketScan) stopTicketScan('Update scan stopped by manual ticket selection.');
            switchTicket('restoreSession', data);
        }

        function generateNewTicket(event) {
            event?.preventDefault();
            if (ticketScan) stopTicketScan('Update scan stopped by creating a ticket.');
            switchTicket('clearSession');
        }

        function saveDataToLocalStorage() {
            if (!currentSession || !helpChatSessions[currentSession]) return;

            const storedData = JSON.parse(localStorage.getItem(OBJECT_STORE_NAME)) || {};
            storedData[currentSession] = helpChatSessions[currentSession];
            localStorage.setItem(OBJECT_STORE_NAME, JSON.stringify(storedData));
            queueTicketSyncOperation('upsert', currentSession, helpChatSessions[currentSession]);
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
            // Conversation responses often update the ticket summary while
            // the manager is already open. Redraw only when a visible summary
            // field changes, avoiding unnecessary rebuilds during polling.
            const previousSessionData = helpChatSessions[currentSession];
            const previousSummary = previousSessionData
                ? JSON.stringify([previousSessionData.type, previousSessionData.wayspot, previousSessionData.inProgress])
                : null;

            if (data.body) {
                if (!ensureCurrentSessionStored()) return;
                processTicketMessages([data]);
            } else if (Array.isArray(data.issues) && data.issues.length > 0) {
                if (!ensureCurrentSessionStored()) return;
                processTicketUpdate(data);
            } else {
                return;
            }

            const updatedSessionData = helpChatSessions[currentSession];
            const updatedSummary = updatedSessionData
                ? JSON.stringify([updatedSessionData.type, updatedSessionData.wayspot, updatedSessionData.inProgress])
                : null;
            if (previousSummary !== updatedSummary) {
                refreshTicketManagerTickets();
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
            if (!Array.isArray(messages) || !messages.length || !currentSession) return;
            const session = helpChatSessions[currentSession];
            if (!session) return;

            const lastMessage = messages[messages.length - 1];
            session.inProgress = lastMessage.type !== 'Confirmation Accepted';

            // New-ticket messages can arrive in separate API responses, and may
            // be processed out of order. Accumulate question and user-answer
            // fragments by message ID for this ticket, then order by timestamp.
            let cache = wayspotMessageCache.get(currentSession);
            if (!cache) {
                cache = new Map();
                wayspotMessageCache.set(currentSession, cache);
            }

            const wayspotQuestions = [
                'What is the name of the Wayspot?',
                'Jak se jmenuje WaysPot?',
                'Wie heißt der Waypot?',
                '¿Cuál es el nombre de Wayspot?',
                'Quel est le nom du Wayspot?',
                'Qual è il nome di The Wayspot?',
                'Wayspotの名前は何ですか？',
                'Wayspot의 이름은 무엇입니까?',
                'Qual é o nome do Wayspot?',
                'Wat is de naam van de WaySpot?',
                'Hva heter WaysPot?',
                'Jak nazywa się Wayspot?',
                'Vad heter The WaysPot?',
                'Wayspot ชื่ออะไร?',
                'Wayspot的名稱是什麼？',
                'तरीके का नाम क्या है?',
                "Wayspot'un adı nedir?"
            ].map(decodeHTMLEntities);

            for (const message of messages) {
                if (!message || typeof message.body !== 'string' || !message.body) continue;
                const body = decodeHTMLEntities(message.body);
                const isQuestion = wayspotQuestions.includes(body);
                const fromUser = message.origin !== 'admin' && (
                    message.author?.roles?.includes('user') ||
                    message.author?.role === 'u' ||
                    ['mobile', 'webmessenger'].includes(message.origin) ||
                    /Input Response/i.test(message.type || '')
                );
                if (!isQuestion && !fromUser) continue;

                const timestamp = Number(message.created_at);
                if (!Number.isFinite(timestamp)) continue;
                const key = message.id || `${timestamp}:${message.type}:${body}`;
                cache.set(key, { timestamp, body, isQuestion, fromUser });
            }

            // Avoid retaining unbounded history while switching many tickets.
            if (cache.size > 60) {
                const latest = [...cache.entries()]
                    .sort((a, b) => b[1].timestamp - a[1].timestamp)
                    .slice(0, 60);
                cache.clear();
                for (const [key, value] of latest) cache.set(key, value);
            }

            const issueCreatedAt = Number(session.ticketTypeTimestamp);
            const earliest = Number.isFinite(issueCreatedAt) ? issueCreatedAt : -Infinity;
            const timeline = [...cache.values()]
                .filter(message => message.timestamp >= earliest)
                .sort((a, b) => a.timestamp - b.timestamp);
            let awaitingAnswer = false;
            let latestAnswer = null;
            for (const message of timeline) {
                if (message.isQuestion) {
                    awaitingAnswer = true;
                } else if (awaitingAnswer && message.fromUser) {
                    latestAnswer = message;
                    awaitingAnswer = false;
                }
            }

            if (latestAnswer && latestAnswer.timestamp > (session.wayspotTimestamp || 0)) {
                session.wayspot = latestAnswer.body;
                session.wayspotTimestamp = latestAnswer.timestamp;
            }
            saveDataToLocalStorage();
        }

        function getTicketScanActionLabel() {
            return ticketScan ? 'Stop update scan' :
                pausedTicketScan ? 'Continue update scan' : 'Check for updates';
        }

        // Reveal the launcher clockwise as tickets finish, one wedge per ticket.
        function updateTicketScanProgress() {
            const button = document.getElementById('ticketSwitchButton');
            const overlay = document.querySelector('.wftm-scan-progress');
            if (!button || !overlay) return;

            const scan = ticketScan || pausedTicketScan;
            if (!scan || !scan.order.length || scan.completedCount >= scan.order.length) {
                overlay.hidden = true;
                button.setAttribute('aria-label', 'Switch Tickets');
                button.removeAttribute('title');
                return;
            }

            const completed = scan.completedCount || 0;
            const progress = completed / scan.order.length;
            const angle = progress * 360;
            overlay.hidden = false;
            overlay.style.background = `conic-gradient(transparent 0deg ${angle}deg, rgba(10, 17, 28, 0.82) ${angle}deg 360deg)`;
            const percentage = Math.round(progress * 100);
            button.setAttribute('aria-label', `Switch Tickets — scan ${percentage}% complete`);
            button.title = `Update scan: ${completed} of ${scan.order.length} tickets checked (${percentage}%)`;
        }

        function showTicketScanStatus(message) {
            ticketScanStatus = message;
            updateTicketScanProgress();
            document.querySelectorAll('.wftm-scan-status').forEach(element => {
                element.textContent = message;
                element.hidden = !message;
            });
            document.querySelectorAll('.wftm-scan-action').forEach(button => {
                button.textContent = getTicketScanActionLabel();
            });
        }

        // The conversation response reports individual message read states. Ignore
        // preissues and non-display bot lifecycle events, which can stay "sent".
        function hasUnreadTicketReply(data) {
            const issues = Array.isArray(data.issues) ? data.issues :
                (data.type === 'issue' ? [data] : []);
            return issues.some(issue => issue.type === 'issue' &&
                Array.isArray(issue.messages) && issue.messages.some(message =>
                    message?.origin === 'admin' && message.state === 'sent' &&
                    !['Bot Started', 'Bot Ended'].includes(message.type)
                ));
        }

        // Diagnostics deliberately omit AUIs, session credentials and message bodies.
        function logTicketScan(event, details = {}) {
            const scan = ticketScan;
            if (!scan) return;
            console.debug('Ticket Manager: Update scan', {
                event,
                ticket: scan.awaitingAui ? scan.positionByAui.get(scan.awaitingAui) : null,
                position: scan.index,
                total: scan.order.length,
                elapsedMs: scan.scanStepStartedAt ? Date.now() - scan.scanStepStartedAt : null,
                ...details
            });
        }

        function stopTicketScan(message, options = {}) {
            const scan = ticketScan;
            if (!scan) return;
            logTicketScan('Scan stopped', { reason: message });
            clearTimeout(scan.timeout);
            clearTimeout(scan.settleTimer);
            clearTimeout(scan.nextTimer);
            ticketScan = null;
            scan.timeout = scan.settleTimer = scan.nextTimer = null;

            if (options.checkedCurrent) {
                // An unread reply confirms that the current ticket was checked.
                scan.completedCount = Math.max(scan.completedCount || 0, scan.index);
            }

            if (options.complete) {
                // The next Check for updates starts a new lap.
                pausedTicketScan = null;
            } else {
                // A reply has been confirmed on this ticket, so resume AFTER it.
                // An interrupted/incomplete ticket must instead be retried.
                if (scan.awaitingHistory && !options.checkedCurrent) {
                    scan.index = Math.max(0, scan.index - 1);
                }
                scan.awaitingHistory = false;
                scan.awaitingAui = null;
                scan.gotResponse = false;
                pausedTicketScan = scan;
            }

            showTicketScanStatus(message);

            // Restore the user's original chat state. An unread reply should
            // not open a chat that was closed when the scan started.
            if (scan.wasChatOpen) {
                if (!callHelpshift('open')) {
                    console.warn('Ticket Manager: Could not reopen Help Chat after scan.');
                }
            }
        }

        function finishTicketScan() {
            const scan = ticketScan;
            if (!scan) return;
            const originalAui = scan.originalAui;

            // The saved starting ticket is deliberately the last item in a lap.
            // If the user began on an unused identity, restore it as well.
            if (scan.restoreUnsaved && originalAui !== currentSession) {
                // Keep the return-to-start requirement until sessionValues confirms it.
                // If the switch is interrupted, Continue can retry this final step.
                scan.awaitingAui = originalAui;
                scan.awaitingHistory = false;
                showTicketScanStatus('Returning to starting ticket…');
                const original = scan.originalCredentials;
                if (!switchTicket('restoreSession', {
                    aui: originalAui, di: original.di, asi: original.asi
                })) {
                    stopTicketScan('Update scan stopped: could not restore starting ticket.');
                } else {
                    scan.timeout = setTimeout(() => {
                        stopTicketScan('Update scan stopped: starting ticket did not reload.');
                    }, TICKET_SCAN_RESPONSE_TIMEOUT_MS);
                }
                return;
            }
            stopTicketScan(`Update scan complete: ${scan.order.length} tickets checked.`, { complete: true });
        }

        function advanceTicketScan() {
            const scan = ticketScan;
            if (!scan) return;
            clearTimeout(scan.timeout);
            clearTimeout(scan.settleTimer);
            scan.timeout = null;
            scan.settleTimer = null;

            if (scan.index >= scan.order.length) {
                finishTicketScan();
                return;
            }

            const aui = scan.order[scan.index];
            const session = helpChatSessions[aui];
            if (!isValidTicketSession(session)) {
                stopTicketScan('Update scan stopped: ticket is no longer available.');
                return;
            }

            scan.index++;
            scan.awaitingAui = aui;
            scan.awaitingHistory = true;
            scan.gotResponse = false;
            scan.sessionConfirmed = false;
            scan.lastResponseRejection = null;
            scan.scanStepStartedAt = Date.now();
            logTicketScan('Switching ticket');
            showTicketScanStatus(`Checking ticket ${scan.positionByAui.get(aui)} (${scan.index} of ${scan.order.length})…`);

            if (!switchTicket('restoreSession', { aui, di: session.di, asi: session.asi })) {
                stopTicketScan('Update scan stopped: ticket switch failed.');
                return;
            }

            // Stop only if the expected identity never delivered usable history.
            scan.timeout = setTimeout(() => {
                if (ticketScan !== scan || scan.gotResponse || scan.awaitingAui !== aui) return;
                const reason = !scan.sessionConfirmed
                    ? 'session was not confirmed'
                    : scan.lastResponseRejection
                        ? `conversation response rejected (${scan.lastResponseRejection})`
                        : 'no conversation response received';
                console.warn('Ticket Manager: Update scan timed out', {
                    ticket: scan.positionByAui.get(aui),
                    position: scan.index,
                    sessionConfirmed: scan.sessionConfirmed,
                    reason
                });
                stopTicketScan(`Update scan stopped: ticket ${scan.positionByAui.get(aui)} — ${reason}.`);
            }, TICKET_SCAN_RESPONSE_TIMEOUT_MS);
        }

        function processTicketScanResponse(data, sessionAui) {
            const scan = ticketScan;
            if (!scan || !scan.awaitingHistory || !scan.awaitingAui) return;

            if (scan.awaitingAui !== currentSession ||
                (sessionAui && sessionAui !== scan.awaitingAui)) {
                scan.lastResponseRejection = 'session mismatch';
                logTicketScan('Conversation response rejected', { reason: 'session mismatch' });
                return;
            }

            // Either a conversation list or an issue detail can carry the state.
            if (!Array.isArray(data.issues) &&
                !(data.type === 'issue' && Array.isArray(data.messages))) {
                scan.lastResponseRejection = 'unrecognised response format';
                logTicketScan('Conversation response rejected', { reason: 'unrecognised response format' });
                return;
            }

            if (hasUnreadTicketReply(data)) {
                const ticketNumber = scan.positionByAui.get(scan.awaitingAui);
                logTicketScan('Unread reply detected');
                stopTicketScan(`Unread Wayfarer reply found in ticket ${ticketNumber}.`, { checkedCurrent: true });
                return;
            }

            // The response timeout applies only until the first valid response.
            // Keep the settling period in case additional history arrives.
            scan.gotResponse = true;
            clearTimeout(scan.timeout);
            scan.timeout = null;
            logTicketScan('Conversation response accepted');
            clearTimeout(scan.settleTimer);
            scan.settleTimer = setTimeout(() => {
                if (ticketScan !== scan) return;
                logTicketScan('Conversation settling complete');
                scan.completedCount = Math.max(scan.completedCount || 0, scan.index);
                updateTicketScanProgress();
                advanceTicketScan();
            }, TICKET_SCAN_SETTLE_MS);
        }

        function continueTicketScan() {
            if (!pausedTicketScan || ticketScan) return;
            if (pendingTicketSwitch) {
                showTicketScanStatus('Wait for the current ticket to finish loading before continuing.');
                return;
            }

            const iframe = document.getElementById('hs-web-sdk-iframe');
            if (!iframe) {
                showTicketScanStatus('Help Chat is not available.');
                return;
            }

            const wasChatOpen = isHelpChatOpen(iframe);
            if (wasChatOpen && !callHelpshift('close')) {
                showTicketScanStatus('Could not close chat to continue checking unread messages.');
                return;
            }

            ticketScan = pausedTicketScan;
            pausedTicketScan = null;
            // If chat was opened to read a reply during the pause, restore
            // that open state once the remaining scan finishes.
            ticketScan.wasChatOpen ||= wasChatOpen;
            showTicketScanStatus(`Continuing update scan (${ticketScan.index} of ${ticketScan.order.length} checked)…`);
            ticketScan.nextTimer = setTimeout(advanceTicketScan, wasChatOpen ? 500 : 0);
        }

        function startTicketScan() {
            if (ticketScan || pausedTicketScan || pendingTicketSwitch) return;
            const saved = Object.keys(helpChatSessions).filter(aui =>
                !isTicketSyncTombstoned(aui) && isValidTicketSession(helpChatSessions[aui]));
            if (!saved.length) {
                showTicketScanStatus('No saved tickets to check.');
                return;
            }

            const iframe = document.getElementById('hs-web-sdk-iframe');
            if (!iframe) {
                showTicketScanStatus('Help Chat is not available.');
                return;
            }

            const startingIndex = saved.indexOf(currentSession);
            // Starting at ticket 6 means 7..n, 1..5, and 6 last.
            const order = startingIndex >= 0
                ? saved.slice(startingIndex + 1).concat(saved.slice(0, startingIndex + 1))
                : saved;
            const wasChatOpen = isHelpChatOpen(iframe);
            if (wasChatOpen && !callHelpshift('close')) {
                showTicketScanStatus('Could not close chat to check unread messages.');
                return;
            }

            ticketScan = {
                order,
                positionByAui: new Map(saved.map((aui, index) => [aui, index + 1])),
                index: 0,
                completedCount: 0,
                originalAui: currentSession,
                originalCredentials: currentSessionCredentials,
                restoreUnsaved: startingIndex < 0 && Boolean(currentSession && currentSessionCredentials?.di),
                wasChatOpen,
                awaitingAui: null,
                awaitingHistory: false,
                sessionConfirmed: false,
                lastResponseRejection: null,
                scanStepStartedAt: null,
                timeout: null,
                settleTimer: null,
                nextTimer: null
            };
            showTicketScanStatus('Starting update scan…');
            // Give the SDK's close operation a chance to take effect, so
            // automatically viewing a conversation cannot mark it as read.
            ticketScan.nextTimer = setTimeout(advanceTicketScan, wasChatOpen ? 500 : 0);
        }

        function refreshTicketManagerTickets() {
            const container = document.getElementById('ticketInterfaceContainer');
            const tbody = container?.querySelector('.wftm-table-container tbody');
            if (!tbody) return;

            const scrollContainer = tbody.closest('.wftm-table-container');
            const scrollTop = scrollContainer.scrollTop;
            tbody.replaceChildren();
            let index = 1;

            for (const [aui, session] of Object.entries(helpChatSessions)) {
                const row = document.createElement('tr');
                const number = document.createElement('td');
                number.textContent = index++;
                number.style.textAlign = 'center';

                const summary = document.createElement('td');
                summary.style.textAlign = 'left';
                if (!session.type) {
                    summary.textContent = 'No active ticket';
                } else {
                    summary.textContent =
                        (session.inProgress === false ? '[Previous ticket] ' : '') +
                        session.type + (session.wayspot ? `: ${session.wayspot}` : '');
                }

                const restore = document.createElement('td');
                restore.style.textAlign = 'center';
                if (aui !== currentSession) {
                    const restoreIcon = document.createElement('span');
                    restoreIcon.textContent = '♻️';
                    restoreIcon.style.cursor = 'pointer';
                    restoreIcon.addEventListener('click', () => {
                        const selected = helpChatSessions[aui];
                        if (selected) restoreOldTicket({ aui, asi: selected.asi, di: selected.di });
                    });
                    restore.appendChild(restoreIcon);
                }

                const remove = document.createElement('td');
                remove.style.textAlign = 'center';
                const removeIcon = document.createElement('span');
                removeIcon.textContent = '🗑️';
                removeIcon.style.cursor = 'pointer';
                removeIcon.addEventListener('click', () => {
                    delete helpChatSessions[aui];
                    const stored = JSON.parse(localStorage.getItem(OBJECT_STORE_NAME)) || {};
                    delete stored[aui];
                    localStorage.setItem(OBJECT_STORE_NAME, JSON.stringify(stored));
                    queueTicketSyncOperation('delete', aui);
                    refreshTicketManagerTickets();
                    if (Object.keys(helpChatSessions).length === 0) generateNewTicket();
                });
                remove.appendChild(removeIcon);

                row.append(number, summary, restore, remove);
                tbody.appendChild(row);
            }

            // Display a newly generated, unused Helpshift identity without
            // writing it to storage or synchronising it.
            if (currentSession && currentSessionCredentials?.di &&
                !helpChatSessions[currentSession] && !isTicketSyncTombstoned(currentSession)) {
                const row = document.createElement('tr');
                for (const value of [index++, 'No active ticket', '', '']) {
                    const cell = document.createElement('td');
                    cell.textContent = value;
                    row.appendChild(cell);
                }
                row.cells[0].style.textAlign = 'center';
                row.cells[1].style.textAlign = 'left';
                tbody.appendChild(row);
            }

            const newRow = document.createElement('tr');
            const number = document.createElement('td');
            number.textContent = index;
            number.style.textAlign = 'center';

            const newTicketCell = document.createElement('td');
            newTicketCell.style.textAlign = 'left';
            const newTicketLink = document.createElement('a');
            newTicketLink.href = '#';
            newTicketLink.textContent = 'Create a new ticket';
            newTicketLink.style.fontWeight = 'bold';
            newTicketLink.addEventListener('click', generateNewTicket);
            newTicketCell.appendChild(newTicketLink);
            newRow.append(number, newTicketCell,
                document.createElement('td'), document.createElement('td'));
            tbody.appendChild(newRow);
            scrollContainer.scrollTop = scrollTop;
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

            // The overlay never captures clicks; the original launcher remains usable.
            const scanProgress = document.createElement('div');
            scanProgress.className = 'wftm-scan-progress';
            scanProgress.setAttribute('aria-hidden', 'true');
            scanProgress.hidden = true;
            containerDiv.appendChild(scanProgress);
            document.body.appendChild(containerDiv);
            syncTicketManagerPosition();
            updateTicketScanProgress();

            // Add event listener to the button
            const ticketSwitchButton = document.getElementById('ticketSwitchButton');
            ticketSwitchButton.addEventListener('click', function() {
                if (document.getElementById('ticketInterfaceContainer')) {
                    // Hide the manager without interrupting an active update scan.
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
                    closeButton.addEventListener('click', () => {
                        removeInterfaceContainer();
                    });

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

                    const scanStatus = document.createElement('div');
                    scanStatus.className = 'wftm-scan-status';
                    scanStatus.setAttribute('role', 'status');
                    scanStatus.textContent = ticketScanStatus;
                    scanStatus.hidden = !ticketScanStatus;
                    interfaceContainer.appendChild(scanStatus);

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

                    // Populate the table in place, so selecting a ticket never
                    // destroys the Ticket Manager panel.
                    table.appendChild(tbody);

                    const tableContainer = document.createElement('div');
                    tableContainer.classList.add('wftm-table-container');
                    tableContainer.appendChild(table);
                    interfaceContainer.appendChild(tableContainer);
                    document.body.appendChild(interfaceContainer);
                    syncTicketManagerPosition();
                    refreshTicketManagerTickets();
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
    margin: 0;
    padding: 0;
    box-sizing: content-box;
    outline: none;
    inset: auto;
    left: 0;
    top: 0;
    visibility: hidden;
}
.wftm-scan-progress {
    position: absolute;
    inset: 0;
    border-radius: 50%;
    z-index: 1;
    pointer-events: none;
}
.wftm-scan-progress[hidden] { display: none; }
.wftm-interface-container {
    display: flex;
    flex-direction: column;
    position: fixed;
    inset: auto;
    visibility: hidden;
    min-height: 0;
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
/* Visible while checking tickets, and keeps the final result available. */
.wftm-scan-status {
    flex: 0 0 auto;
    padding: 8px 13px;
    color: #374151;
    background-color: #fff5ea;
    font-family: sans-serif;
    font-size: 12px;
    line-height: 1.4;
}
.wftm-scan-status[hidden] { display: none; }
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