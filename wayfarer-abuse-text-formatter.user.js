// ==UserScript==
// @name         Wayfarer Abuse Text Formatter
// @version      0.3.0
// @author       Tntnnbltn (fork maintained by JeremyChuaWX)
// @description  Adds text for copy & paste into Abuse form
// @namespace    https://github.com/JeremyChuaWX/wayfarer-addons
// @downloadURL  https://jeremychuawx.github.io/wayfarer-addons/wayfarer-abuse-text-formatter.user.js
// @updateURL    https://jeremychuawx.github.io/wayfarer-addons/wayfarer-abuse-text-formatter.user.js
// @homepageURL  https://jeremychuawx.github.io/wayfarer-addons/guides/wayfarer-abuse-text-formatter.html
// @supportURL   https://github.com/JeremyChuaWX/wayfarer-addons/issues
// @match        https://wayfarer.scopely.com/*
// @run-at       document-start
// @grant        none
// @inject-into  page
// ==/UserScript==

// Copyright 2024 tnt
// Modified by JeremyChuaWX, 2026-11 — see https://github.com/JeremyChuaWX/wayfarer-addons/commits/main

// This script is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.

// This script is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.    See the
// GNU General Public License for more details.

// You can find a copy of the GNU General Public License in the root
// directory of this script's GitHub repository:
// <https://github.com/tehstone/wayfarer-addons/blob/main/LICENSE>
// If not, see <https://www.gnu.org/licenses/>.

/* eslint-env es6 */
/* eslint no-var: "error" */

(function () {
    'use strict';

    // Runs in the page itself (see @inject-into) so it can watch the website's
    // own requests. Guard against being injected twice.
    if (window.__wfaAbuseTextFormatter) return;
    window.__wfaAbuseTextFormatter = true;

    const REVIEW_API = '/api/v1/vault/review';
    const REPORT_URL = 'https://scopelyexplore.helpshift.com/hc/en/10-wayfarer/faq/1999-reporting-abuse-in-wayfarer/';
    const LINE_CLASS = 'wfa-abuse-text';

    let candidate = null; // The nomination currently being reviewed.
    let observer = null;
    let pending = null;

    // Wayfarer loads each review with fetch('/api/v1/vault/review'). Read a copy
    // of the response; the website gets the original untouched.
    const originalFetch = window.fetch;
    window.fetch = function (input, init) {
        const result = originalFetch.apply(this, arguments);
        try {
            if (isReviewRequest(input, init)) {
                result.then(response => {
                    if (response.ok) response.clone().json().then(onReview).catch(() => {});
                }).catch(() => {});
            }
        } catch (e) {
            console.warn('[Abuse Text Formatter]', e);
        }
        return result;
    };

    function isReviewRequest(input, init) {
        const url = typeof input === 'string' || input instanceof URL ? String(input) : input?.url;
        const method = (init?.method || (input instanceof Request ? input.method : 'GET')).toUpperCase();
        if (!url || method !== 'GET') return false;
        const parsed = new URL(url, location.href);
        return parsed.origin === location.origin && parsed.pathname === REVIEW_API;
    }

    function onReview(json) {
        // Ignore captcha responses and empty queues.
        const next = json && !json.captcha ? json.result : null;
        candidate = next && typeof next.lat === 'number' && typeof next.lng === 'number' ? next : null;
        document.querySelectorAll('.' + LINE_CLASS).forEach(el => el.remove());
        if (candidate) watch();
        else stopWatching();
    }

    function reportText({ title, lat, lng }) {
        return `${title ? `"${title}"` : '[Unknown Title]'} at ${lat},${lng} `;
    }

    function createLine(text) {
        const line = document.createElement('div');
        line.className = LINE_CLASS;
        line.style.cssText = 'margin-top:8px;font-size:14px;line-height:1.5;user-select:text;overflow-wrap:anywhere;';
        line.append(text);

        const link = document.createElement('a');
        link.textContent = '[Report]';
        link.href = REPORT_URL;
        // Open in a new tab so the in-progress review isn't lost.
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        link.style.cssText = 'text-decoration:underline;';
        line.appendChild(link);
        return line;
    }

    // Show the line under the "Review" page heading. That heading is the same
    // for every kind of review, so this works for new, photo and edit reviews.
    function placeLine() {
        pending = null;
        if (!candidate) return;
        if (!/^\/review(\/|$)/.test(location.pathname)) {
            // Left the Review page: the next visit loads a fresh review.
            candidate = null;
            stopWatching();
            return;
        }
        const heading = document.getElementById('review-page-title') || document.querySelector('main h1');
        if (!heading?.parentElement) return;

        const text = reportText(candidate);
        const existing = heading.parentElement.querySelector(':scope > .' + LINE_CLASS);
        if (existing && existing.firstChild?.nodeValue === text) return; // Already showing.
        existing?.remove();
        heading.parentElement.appendChild(createLine(text));
    }

    // React rebuilds parts of the page at any time, which can throw the line
    // away. Put it back when that happens. placeLine() does nothing while the
    // line is in place, so adding it doesn't cause another round of changes.
    function watch() {
        placeLine();
        if (observer) return;
        observer = new MutationObserver(() => {
            if (!pending) pending = setTimeout(placeLine, 100);
        });
        observer.observe(document.documentElement, { childList: true, subtree: true });
    }

    function stopWatching() {
        observer?.disconnect();
        observer = null;
        if (pending) clearTimeout(pending);
        pending = null;
    }
})();
