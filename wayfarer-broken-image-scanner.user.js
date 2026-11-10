// ==UserScript==
// @name         Wayfarer Broken Image Scanner
// @version      0.3.0
// @author       Tntnnbltn (fork maintained by JeremyChuaWX)
// @description  Scans your Wayfarer submissions for broken image urls
// @namespace    https://github.com/JeremyChuaWX/wayfarer-addons
// @downloadURL  https://jeremychuawx.github.io/wayfarer-addons/wayfarer-broken-image-scanner.user.js
// @updateURL    https://jeremychuawx.github.io/wayfarer-addons/wayfarer-broken-image-scanner.user.js
// @homepageURL  https://jeremychuawx.github.io/wayfarer-addons/guides/wayfarer-broken-image-scanner.html
// @supportURL   https://github.com/JeremyChuaWX/wayfarer-addons/issues
// @match        https://wayfarer.scopely.com/*
// @run-at       document-start
// @grant        none
// @inject-into  page
// ==/UserScript==

// Copyright 2026 tntnnbltn
// Modified by JeremyChuaWX, 2026-11 — see https://github.com/JeremyChuaWX/wayfarer-addons/commits/main

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

    // Wayfarer is a React single-page app. The Submit page (/submit) loads the
    // list of submissions with fetch('/api/v1/vault/manage'). We watch that
    // request to keep a copy of the list, and fetch it ourselves on click if
    // we haven't seen it yet.
    const MANAGE_PATH = '/api/v1/vault/manage';
    const SUBMIT_PATH = '/submit';
    const BUTTON_ID = 'wfbi-scan-button';

    let submissions = null;
    let lastScanSummary = null;
    let scanning = false;

    hookFetch();
    watchPage();

    function hookFetch() {
        const origFetch = window.fetch;
        if (typeof origFetch !== 'function' || origFetch.__wfbiHooked) return;

        const hooked = function (input, init) {
            const promise = origFetch.apply(window, arguments);
            try {
                const method = String((init && init.method) || (input instanceof Request ? input.method : 'GET')).toUpperCase();
                const url = new URL(input instanceof Request ? input.url : String(input), location.href);
                if (method === 'GET' && url.origin === location.origin && url.pathname === MANAGE_PATH) {
                    promise.then((res) => {
                        if (res && res.ok) {
                            res.clone().json().then(storeManageResponse).catch(() => {});
                        }
                    }).catch(() => {});
                }
            } catch (e) {
                // Never break the page's own requests.
            }
            return promise;
        };
        hooked.__wfbiHooked = true;
        window.fetch = hooked;
    }

    // Returns true if the response contained a submissions list.
    function storeManageResponse(json) {
        if (!json || json.captcha) return false;
        const result = json.result;
        if (!result || !Array.isArray(result.submissions)) {
            console.warn('[Broken Image Scanner] Wayfarer response missing result.submissions');
            return false;
        }
        submissions = result.submissions;
        return true;
    }

    async function loadSubmissions() {
        if (Array.isArray(submissions)) return submissions;
        const res = await fetch(MANAGE_PATH, { credentials: 'same-origin' });
        if (!res.ok) throw new Error(`Wayfarer answered ${res.status}`);
        if (!storeManageResponse(await res.json())) throw new Error('Wayfarer did not send a submissions list');
        return submissions;
    }

    // Keeps the button on the Submit page. React re-renders and client-side
    // navigation can remove it, so re-check whenever the page changes. The
    // check does nothing (and changes nothing) once the button is in place,
    // so our own insertion can't set off an endless loop.
    function watchPage() {
        let queued = false;
        const check = () => {
            queued = false;
            if (location.pathname.replace(/\/+$/, '') !== SUBMIT_PATH) return;
            if (document.getElementById(BUTTON_ID)) return;
            addScanButton();
        };
        const schedule = () => {
            if (queued) return;
            queued = true;
            requestAnimationFrame(check);
        };
        const start = () => {
            new MutationObserver(schedule).observe(document.documentElement, { childList: true, subtree: true });
            schedule();
        };
        if (document.documentElement) start();
        else document.addEventListener('readystatechange', start, { once: true });
        window.addEventListener('popstate', schedule);
    }

    // The tab row ("Submissions (N)" / "Drafts (N)") is a <nav> made of
    // buttons inside the page body; the site header's <nav> uses links.
    function findTabRow() {
        for (const nav of document.querySelectorAll('#root nav')) {
            if (nav.closest('header')) continue;
            const kids = Array.from(nav.children).filter(el => el.id !== BUTTON_ID);
            if (kids.length >= 2 && kids.every(el => el.tagName === 'BUTTON')) return nav;
        }
        return null;
    }

    function addScanButton() {
        const tabRow = findTabRow();
        if (!tabRow) return;

        addCss();

        const scanButton = document.createElement('button');
        scanButton.id = BUTTON_ID;
        scanButton.type = 'button';
        scanButton.className = 'wayfarerns__button';
        scanButton.textContent = 'Scan Broken Images';
        scanButton.disabled = scanning;
        scanButton.addEventListener('click', onScanButtonClick);

        tabRow.appendChild(scanButton);
    }

    function setButtonBusy(busy) {
        scanning = busy;
        const btn = document.getElementById(BUTTON_ID);
        if (btn) btn.disabled = busy;
    }

    async function onScanButtonClick() {
        if (scanning) return;
        setButtonBusy(true);
        try {
            await runScan();
        } catch (e) {
            console.error('[Broken Image Scanner] scan failed', e);
            updateScanStatus(`Could not finish the scan: ${e && e.message ? e.message : e}\n\nReload the page and try again.`);
        } finally {
            setButtonBusy(false);
        }
    }

    async function runScan() {
        openModal('Broken Image Scan', 'Loading your submissions...');
        const list = await loadSubmissions();
        if (!Array.isArray(list) || list.length === 0) {
            openModal('Broken Image Scan', 'You have no submissions to scan.');
            return;
        }

        lastScanSummary = null;
        openScanModal();

        const relevant = list
        .filter(sub => sub && (sub.type === 'NOMINATION' || sub.type === 'PHOTO'))
        .map(normalizeSubmission)
        .filter(Boolean);

        const nominationCount = relevant.filter(x => x.kind === 'Nomination').length;
        const photoCount = relevant.filter(x => x.kind === 'Photo Edit').length;

        updateScanStatus(`Preparing scan...\n${nominationCount} nominations and ${photoCount} photo edits queued.`);

        const brokenItems = [];
        let completed = 0;
        const total = relevant.length;

        await runParallelQueue(
            relevant,
            15,
            async (item) => {
                const broken = !(await testImageWithRetry(item.imageUrl));
                if (broken) {
                    brokenItems.push(item);
                }

                completed++;

                lastScanSummary = {
                    nominationCount,
                    photoCount,
                    brokenItems: [...brokenItems]
                };

                refreshReportFromLastScan();

                updateScanStatus(
                    `Scanning images...\n` +
                    `Processed ${completed}/${total}\n` +
                    `Broken found so far: ${brokenItems.length}`
                );
            }
        );

        lastScanSummary = {
            nominationCount,
            photoCount,
            brokenItems: [...brokenItems]
        };

        refreshReportFromLastScan();

        updateScanStatus(
            `Scan complete.\n` +
            `Processed ${total}/${total}\n` +
            `Broken images found: ${brokenItems.length}`
        );
    }

    function normalizeSubmission(sub) {
        if (sub.type === 'NOMINATION') {
            if (!sub.imageUrl) return null;
            return {
                rawType: sub.type,
                kind: 'Nomination',
                status: String(sub.status || 'UNKNOWN'),
                imageUrl: String(sub.imageUrl),
                day: String(sub.day || ''),
                title: String(sub.title || ''),
                lat: Number(sub.lat),
                lng: Number(sub.lng)
            };
        }

        if (sub.type === 'PHOTO') {
            if (!sub.imageUrl || !sub.poiData) return null;
            return {
                rawType: sub.type,
                kind: 'Photo Edit',
                status: String(sub.status || 'UNKNOWN'),
                imageUrl: String(sub.imageUrl),
                day: String(sub.day || ''),
                title: String(sub.poiData.title || ''),
                lat: Number(sub.poiData.lat),
                lng: Number(sub.poiData.lng)
            };
        }

        return null;
    }

    async function testImageWithRetry(imageUrl) {
        const testUrl = buildSmallImageUrl(imageUrl);

        const firstTry = await testImageUrl(testUrl);
        if (firstTry) return true;

        const secondTry = await testImageUrl(testUrl);
        return secondTry;
    }

    function buildSmallImageUrl(imageUrl) {
        return `${imageUrl}=s10`;
    }

    function testImageUrl(url) {
        return new Promise((resolve) => {
            const img = new Image();
            let settled = false;

            const cleanup = () => {
                img.onload = null;
                img.onerror = null;
            };

            const done = (result) => {
                if (settled) return;
                settled = true;
                cleanup();
                resolve(result);
            };

            const timeoutId = setTimeout(() => done(false), 10000);

            img.onload = () => {
                clearTimeout(timeoutId);
                done(true);
            };

            img.onerror = () => {
                clearTimeout(timeoutId);
                done(false);
            };

            img.src = url;
        });
    }

    async function runParallelQueue(items, workerCount, workerFn) {
        let index = 0;

        async function worker() {
            while (true) {
                const currentIndex = index++;
                if (currentIndex >= items.length) return;
                await workerFn(items[currentIndex], currentIndex);
            }
        }

        const workers = [];
        const limit = Math.min(workerCount, items.length);
        for (let i = 0; i < limit; i++) {
            workers.push(worker());
        }

        await Promise.all(workers);
    }

    function shouldExcludeRejectedDuplicate() {
        const el = document.getElementById('wfbi-exclude-rejected');
        return el ? el.checked : true;
    }

    function refreshReportFromLastScan() {
        if (!lastScanSummary) {
            setReportText('');
            return;
        }

        const report = buildReport(lastScanSummary);
        setReportText(report);
    }

    function buildReport({ nominationCount, photoCount, brokenItems }) {
        const exclude = shouldExcludeRejectedDuplicate();

        const filteredItems = exclude
        ? brokenItems.filter(item =>
                             item.status !== 'REJECTED' && item.status !== 'DUPLICATE'
                            )
        : brokenItems;

        const grouped = new Map();

        for (const item of filteredItems) {
            const sectionKey = `${item.kind}|||${item.status}`;
            if (!grouped.has(sectionKey)) {
                grouped.set(sectionKey, []);
            }
            grouped.get(sectionKey).push(item);
        }

        for (const entries of grouped.values()) {
            entries.sort((a, b) => {
                const dateA = a.day || '';
                const dateB = b.day || '';
                if (dateA < dateB) return -1;
                if (dateA > dateB) return 1;
                return 0;
            });
        }

        const orderedKeys = Array.from(grouped.keys()).sort((a, b) => {
            const [kindA, statusA] = a.split('|||');
            const [kindB, statusB] = b.split('|||');

            if (kindA !== kindB) {
                return kindA.localeCompare(kindB);
            }
            return statusA.localeCompare(statusB);
        });

        const lines = [];
        lines.push(`${nominationCount} nominations and ${photoCount} photo edits analysed.`);
        lines.push(`Identified total of ${filteredItems.length} broken images.`);
        if (exclude) {
            lines.push('(Rejected and Duplicate submissions excluded)');
        }
        lines.push('');

        for (const key of orderedKeys) {
            const [kind, status] = key.split('|||');
            lines.push(`${kind} - ${status}`);

            const entries = grouped.get(key);
            for (const item of entries) {
                lines.push(formatReportLine(item));
            }
            lines.push('');
        }

        return lines.join('\n').trim();
    }

    function formatReportLine(item) {
        const title = item.title || '';
        const lat = Number.isFinite(item.lat) ? item.lat.toFixed(6) : 'NaN';
        const lng = Number.isFinite(item.lng) ? item.lng.toFixed(6) : 'NaN';
        return `[${item.day}] "${title}" (${lat},${lng})`;
    }

    function openScanModal() {
        ensureModal();

        document.getElementById('wfbi-modal-title').textContent = 'Broken Image Scan';
        document.getElementById('wfbi-modal-status').textContent = 'Starting scan...';
        document.getElementById('wfbi-modal-report').value = '';
        document.getElementById('wfbi-modal-backdrop').style.display = 'flex';
    }

    function openModal(title, message) {
        ensureModal();

        document.getElementById('wfbi-modal-title').textContent = title;
        document.getElementById('wfbi-modal-status').textContent = message;
        document.getElementById('wfbi-modal-report').value = '';
        document.getElementById('wfbi-modal-backdrop').style.display = 'flex';
    }

    function updateScanStatus(text) {
        const statusEl = document.getElementById('wfbi-modal-status');
        if (statusEl) {
            statusEl.textContent = text;
        }
    }

    function setReportText(text) {
        const reportEl = document.getElementById('wfbi-modal-report');
        if (reportEl) {
            reportEl.value = text;
        }
    }

    function ensureModal() {
        if (document.getElementById('wfbi-modal-backdrop')) return;

        const backdrop = document.createElement('div');
        backdrop.id = 'wfbi-modal-backdrop';
        backdrop.className = 'wfbi-modal-backdrop';

        const modal = document.createElement('div');
        modal.className = 'wfbi-modal';

        const header = document.createElement('div');
        header.className = 'wfbi-modal-header';

        const title = document.createElement('div');
        title.id = 'wfbi-modal-title';
        title.className = 'wfbi-modal-title';
        title.textContent = 'Broken Image Scan';

        const closeBtn = document.createElement('button');
        closeBtn.className = 'wfbi-close-button';
        closeBtn.textContent = '×';
        closeBtn.addEventListener('click', closeModal);

        header.appendChild(title);
        header.appendChild(closeBtn);

        const status = document.createElement('pre');
        status.id = 'wfbi-modal-status';
        status.className = 'wfbi-modal-status';
        status.textContent = '';

        const optionsRow = document.createElement('div');
        optionsRow.className = 'wfbi-options-row';

        const excludeCheckbox = document.createElement('input');
        excludeCheckbox.type = 'checkbox';
        excludeCheckbox.id = 'wfbi-exclude-rejected';
        excludeCheckbox.checked = true;
        excludeCheckbox.addEventListener('change', refreshReportFromLastScan);

        const excludeLabel = document.createElement('label');
        excludeLabel.htmlFor = 'wfbi-exclude-rejected';
        excludeLabel.textContent = 'Exclude Rejected and Duplicate submissions';

        optionsRow.appendChild(excludeCheckbox);
        optionsRow.appendChild(excludeLabel);

        const textarea = document.createElement('textarea');
        textarea.id = 'wfbi-modal-report';
        textarea.className = 'wfbi-modal-report';
        textarea.placeholder = 'Report will appear here...';

        const infoBox = document.createElement('div');
        infoBox.className = 'wfbi-info-box';

        const infoText = document.createElement('div');
        infoText.textContent = 'Users can share their results in the following bug report on the Community Forums:';

        const infoList = document.createElement('ul');
        infoList.className = 'wfbi-info-list';

        const infoItem = document.createElement('li');

        const infoLink = document.createElement('a');
        infoLink.href = 'https://community.wayfarer.scopely.com/t/broken-wayspot-images-for-wayspots-originally-submitted-via-ingress-prime-beta-in-2019/113002';
        infoLink.target = '_blank';
        infoLink.rel = 'noopener noreferrer';
        infoLink.textContent = 'Broken Wayspot Images Bug Report';

        infoItem.appendChild(infoLink);
        infoList.appendChild(infoItem);
        infoBox.appendChild(infoText);
        infoBox.appendChild(infoList);

        const footer = document.createElement('div');
        footer.className = 'wfbi-modal-footer';

        const copyBtn = document.createElement('button');
        copyBtn.className = 'wayfarerns__button';
        copyBtn.textContent = 'Copy Report';
        copyBtn.addEventListener('click', async () => {
            const value = textarea.value || '';
            try {
                await navigator.clipboard.writeText(value);
                updateScanStatus((document.getElementById('wfbi-modal-status').textContent || '') + '\nCopied report to clipboard.');
            } catch (e) {
                textarea.select();
                document.execCommand('copy');
            }
        });

        const closeFooterBtn = document.createElement('button');
        closeFooterBtn.className = 'wayfarerns__button';
        closeFooterBtn.textContent = 'Close';
        closeFooterBtn.addEventListener('click', closeModal);

        footer.appendChild(copyBtn);
        footer.appendChild(closeFooterBtn);

        modal.appendChild(header);
        modal.appendChild(status);
        modal.appendChild(optionsRow);
        modal.appendChild(textarea);
        modal.appendChild(infoBox);
        modal.appendChild(footer);
        backdrop.appendChild(modal);

        backdrop.addEventListener('click', (e) => {
            if (e.target === backdrop) {
                closeModal();
            }
        });

        document.body.appendChild(backdrop);
    }

    function closeModal() {
        const backdrop = document.getElementById('wfbi-modal-backdrop');
        if (backdrop) {
            backdrop.style.display = 'none';
        }
    }

    function addCss() {
        if (document.getElementById('wfbi-style')) return;

const css = `
    .wayfarerns__button {
        background-color: #e5e5e5;
        border: none;
        color: #ff4713;
        padding: 8px 12px;
        border-radius: .375rem;
        text-align: center;
        text-decoration: none;
        display: inline-block;
        font-size: 15px;
        line-height: 1.3;
        cursor: pointer;
    }

    .wayfarerns__button:hover {
        background-color: #bdbbbb;
        transition: 0.2s;
    }

    .wayfarerns__button:disabled {
        opacity: 0.6;
        cursor: progress;
    }

    #wfbi-scan-button {
        margin-left: auto;
        margin-bottom: 6px;
        white-space: nowrap;
    }

    .wfbi-modal-footer .wayfarerns__button {
        margin: 10px 0;
    }



    .wfbi-modal-backdrop {
        position: fixed;
        inset: 0;
        background: rgba(0,0,0,0.55);
        z-index: 99999;
        display: none;
        align-items: center;
        justify-content: center;
        padding: 24px;
    }

    .wfbi-modal {
        width: min(900px, 100%);
        height: min(90vh, 900px);
        background: #ffffff;
        color: #111111;
        border-radius: 12px;
        box-shadow: 0 12px 32px rgba(0,0,0,0.35);
        display: flex;
        flex-direction: column;
        overflow: hidden;
    }


    .wfbi-modal-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 16px 20px;
        border-bottom: 1px solid #d0d0d0;
        font-weight: bold;
        flex: 0 0 auto;
    }


    .wfbi-modal-title {
        font-size: 20px;
    }

    .wfbi-close-button {
        border: none;
        background: transparent;
        font-size: 28px;
        line-height: 1;
        cursor: pointer;
        color: inherit;
    }

    .wfbi-modal-status {
        margin: 0;
        padding: 16px 20px;
        white-space: pre-wrap;
        border-bottom: 1px solid #d0d0d0;
        font-family: monospace;
        font-size: 14px;
        flex: 0 0 auto;
    }


    .wfbi-options-row {
        margin: 0 20px;
        padding: 10px 0 14px 0;
        display: flex;
        align-items: center;
        gap: 10px;
        font-size: 14px;
        border-bottom: 1px solid #d0d0d0;
        flex: 0 0 auto;
    }


    #wfbi-exclude-rejected {
        width: 16px;
        height: 16px;
        cursor: pointer;
    }

    .wfbi-options-row label {
        cursor: pointer;
        user-select: none;
    }

    .wfbi-modal-report {
        width: calc(100% - 40px);
        margin: 20px;
        flex: 1 1 auto;
        min-height: 120px;
        resize: none;
        font-family: monospace;
        font-size: 14px;
        line-height: 1.4;
        padding: 12px;
        border: 1px solid #c8c8c8;
        border-radius: 8px;
        box-sizing: border-box;
        background: #fafafa;
        color: #111111;
        overflow: auto;
    }


    .wfbi-info-box {
        margin: 0 20px 10px 20px;
        padding: 10px 12px;
        border-radius: 8px;
        background: #f3f3f3;
        font-size: 13px;
        line-height: 1.4;
        flex: 0 0 auto;
    }

    .wfbi-info-box a {
        display: inline-block;
        margin-top: 6px;
        color: #ff4713;
        text-decoration: underline;
    }



    .wfbi-modal-footer {
        display: flex;
        justify-content: flex-end;
        gap: 8px;
        padding: 0 10px 10px 10px;
        flex: 0 0 auto;
    }
`;

        const style = document.createElement('style');
        style.id = 'wfbi-style';
        style.type = 'text/css';
        style.textContent = css;
        (document.head || document.documentElement).appendChild(style);
    }
})();
