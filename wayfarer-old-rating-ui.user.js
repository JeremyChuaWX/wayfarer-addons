// ==UserScript==
// @name         Wayfarer Old Rating UI
// @version      0.2.0
// @author       Tntnnbltn (fork maintained by JeremyChuaWX)
// @description  Restores the Rating UI on the Profile page
// @namespace    https://github.com/JeremyChuaWX/wayfarer-addons
// @downloadURL  https://jeremychuawx.github.io/wayfarer-addons/wayfarer-old-rating-ui.user.js
// @updateURL    https://jeremychuawx.github.io/wayfarer-addons/wayfarer-old-rating-ui.user.js
// @homepageURL  https://jeremychuawx.github.io/wayfarer-addons/guides/wayfarer-old-rating-ui.html
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

    /******************************************************************
     * STATE AND CONSTANTS
     ******************************************************************/
    const PROFILE_API = '/api/v1/vault/profile';
    const PROPERTIES_API = '/api/v1/vault/properties';
    const MESSAGES_API = '/api/v1/vault/messages';

    // The "Wayfinder Tier" card on the Profile page.
    const TIER_CARD_SELECTOR = 'section[aria-labelledby="wayfinder-tier-heading"]';
    const BAR_SELECTOR = '[data-old-wayfinder-rating="true"]';

    const ORDER = ['poor', 'fair', 'good', 'great'];

    const DEFAULT_TEXT = {
        heading: 'Wayfinder rating',
        unavailable: "Wayfarer no longer shares the old rating. You can uninstall the add-on 'Wayfarer Old Rating UI'.",
        poor: { label: 'Poor', description: 'Oh no! Time to freshen up on the review guidelines.' },
        fair: { label: 'Fair', description: 'Not bad! Try reviewing a few more Wayspots.' },
        good: { label: 'Good', description: 'Nice achievement, keep up the good work!' },
        great: { label: 'Great', description: "You're a top notch Wayfinder!" }
    };

    const state = {
        performance: null,       // 'poor' | 'fair' | 'good' | 'great'
        unavailable: false,      // the profile came back without a rating
        text: DEFAULT_TEXT,      // labels, translated when Wayfarer sends them
        version: 0,              // bumped whenever anything above changes
        fallbackStarted: false
    };

    const nativeFetch = window.fetch;

    /******************************************************************
     * DATA
     ******************************************************************/
    function normalizeRating(value) {
        if (typeof value !== 'string') return null;
        const normalized = value.trim().toLowerCase();
        return ORDER.includes(normalized) ? normalized : null;
    }

    function changed() {
        state.version++;
        scheduleCheck();
    }

    function handlePerformance(result, isProfile) {
        if (!result || typeof result !== 'object') return;
        const rating = normalizeRating(result.performance);
        if (rating) {
            if (rating !== state.performance || state.unavailable) {
                state.performance = rating;
                state.unavailable = false;
                changed();
            }
        } else if (isProfile && !state.unavailable) {
            // Only the profile response decides that the rating is gone.
            state.performance = null;
            state.unavailable = true;
            changed();
        }
    }

    function handleMessages(result) {
        if (!result || typeof result !== 'object') return;
        const ok = ORDER.every((key) =>
            typeof result[`rating.${key}.label`] === 'string' &&
            typeof result[`rating.${key}.description`] === 'string');
        if (!ok) return;

        const text = { heading: DEFAULT_TEXT.heading, unavailable: DEFAULT_TEXT.unavailable };
        if (typeof result['upgrades.performance'] === 'string') text.heading = result['upgrades.performance'];
        ORDER.forEach((key) => {
            text[key] = {
                label: result[`rating.${key}.label`],
                description: result[`rating.${key}.description`]
            };
        });
        state.text = text;
        changed();
    }

    const HANDLERS = {
        [PROFILE_API]: (data) => handlePerformance(data?.result, true),
        [PROPERTIES_API]: (data) => handlePerformance(data?.result, false),
        [MESSAGES_API]: (data) => handleMessages(data?.result)
    };

    /******************************************************************
     * NETWORK: read the responses Wayfarer already fetches
     ******************************************************************/
    function requestInfo(input, init) {
        let url = null;
        let method = 'GET';
        if (typeof input === 'string') url = input;
        else if (input instanceof URL) url = input.href;
        else if (input && typeof input.url === 'string') {
            url = input.url;
            if (typeof input.method === 'string') method = input.method;
        }
        if (init && typeof init.method === 'string') method = init.method;
        if (!url) return null;
        const parsed = new URL(url, location.href);
        if (parsed.origin !== location.origin) return null;
        return { path: parsed.pathname, method: method.toUpperCase() };
    }

    function readResponse(handler, response) {
        if (!response || !response.ok) return;
        response.clone().json().then(handler).catch(() => {});
    }

    function installFetchHook() {
        if (typeof nativeFetch !== 'function') return;

        window.fetch = function (input, init) {
            const promise = nativeFetch.apply(this, arguments);
            try {
                const info = requestInfo(input, init);
                const handler = info && info.method === 'GET' && HANDLERS[info.path];
                if (handler) promise.then((r) => readResponse(handler, r), () => {});
            } catch (err) {
                // Never let the add-on break Wayfarer's own requests.
            }
            return promise;
        };
    }

    // If the page loaded its data before the hook was in place, ask once.
    function fetchProfileIfMissing() {
        if (state.fallbackStarted || state.performance || state.unavailable) return;
        state.fallbackStarted = true;
        setTimeout(() => {
            if (state.performance || state.unavailable) return;
            nativeFetch.call(window, PROFILE_API, { credentials: 'same-origin' })
                .then((r) => readResponse(HANDLERS[PROFILE_API], r))
                .catch((err) => console.warn('Wayfarer Old Rating UI: could not load profile', err));
        }, 1500);
    }

    /******************************************************************
     * RENDERING
     ******************************************************************/
    function createBar() {
        const text = state.text;

        const wrapper = document.createElement('div');
        wrapper.className = 'wf-old-rating-wrapper';
        wrapper.dataset.oldWayfinderRating = 'true';
        wrapper.dataset.version = String(state.version);

        const heading = document.createElement('div');
        heading.className = 'wf-old-rating-heading';
        heading.textContent = text.heading;
        wrapper.appendChild(heading);

        if (state.unavailable) {
            const message = document.createElement('div');
            message.className = 'wf-old-rating-unavailable-message';
            message.textContent = text.unavailable;
            wrapper.appendChild(message);
            return wrapper;
        }

        const bar = document.createElement('div');
        bar.className = 'wf-old-rating-bar';
        bar.setAttribute('role', 'list');

        ORDER.forEach((key) => {
            const segment = document.createElement('div');
            segment.className = 'wf-old-rating-segment';
            segment.dataset.ratingKey = key;
            segment.setAttribute('role', 'listitem');
            segment.textContent = text[key].label;

            if (key === state.performance) {
                segment.classList.add('is-active');
                segment.setAttribute('aria-current', 'true');
                segment.title = text[key].description;

                const tooltip = document.createElement('div');
                tooltip.className = 'wf-old-rating-tooltip';
                tooltip.setAttribute('aria-hidden', 'true');
                tooltip.textContent = text[key].description;
                segment.appendChild(tooltip);
            }

            bar.appendChild(segment);
        });

        wrapper.appendChild(bar);
        return wrapper;
    }

    function isProfilePage() {
        return location.pathname.replace(/\/+$/, '') === '/profile';
    }

    // Puts the bar in the Wayfinder Tier card (just under the tier name),
    // or refreshes it if the data changed. Does nothing if it's already right,
    // so the observer below never feeds itself.
    function ensureBar() {
        if (!isProfilePage()) return;

        const card = document.querySelector(TIER_CARD_SELECTOR);
        if (!card) return;

        if (!state.performance && !state.unavailable) {
            fetchProfileIfMissing();
            return;
        }

        const existing = card.querySelector(BAR_SELECTOR);
        if (existing && existing.dataset.version === String(state.version)) return;

        injectStyles();
        const bar = createBar();
        if (existing) {
            existing.replaceWith(bar);
            return;
        }

        const header = card.firstElementChild;
        if (header && header.nextSibling) card.insertBefore(bar, header.nextSibling);
        else card.appendChild(bar);
    }

    let checkScheduled = false;
    function scheduleCheck() {
        if (checkScheduled) return;
        checkScheduled = true;
        requestAnimationFrame(() => {
            checkScheduled = false;
            try {
                ensureBar();
            } catch (err) {
                console.error('Wayfarer Old Rating UI: could not show the rating', err);
            }
        });
    }

    // Wayfarer is a single-page app: the Profile page can appear (or be
    // re-rendered) at any time, so look again whenever the page changes.
    function installPageObserver() {
        const observer = new MutationObserver(() => {
            if (isProfilePage()) scheduleCheck();
        });
        observer.observe(document, { childList: true, subtree: true });
    }

    /******************************************************************
     * STYLE INJECTION
     ******************************************************************/
    // Colours come from Wayfarer's own theme variables, so light and dark
    // mode are followed automatically.
    function injectStyles() {
        if (document.getElementById('wf-old-rating-style')) return;

        const style = document.createElement('style');
        style.id = 'wf-old-rating-style';
        style.textContent = `
            .wf-old-rating-wrapper {
                margin-top: 16px;
                position: relative;
            }

            .wf-old-rating-heading {
                font-size: 14px;
                line-height: 21px;
                font-weight: 500;
                color: var(--wf-theme-text-muted, #737373);
                margin-bottom: 8px;
            }

            .wf-old-rating-bar {
                display: inline-flex;
                align-items: stretch;
                max-width: 100%;
                border-radius: 16px;
                box-sizing: border-box;
                user-select: none;
                position: relative;
            }

            .wf-old-rating-segment {
                display: block;
                box-sizing: border-box;
                position: relative;
                cursor: default;
                text-align: center;
                font-variant-numeric: tabular-nums;
                font-size: 14px;
                line-height: 21px;
                font-weight: 400;
                padding: 4px 24px;
                min-height: 31px;
                color: var(--wf-theme-text-secondary, #525252);
                background-color: transparent;
                border: 1px solid rgb(196, 181, 253);
                border-right: none;
                transition: background-color 0.15s ease, color 0.15s ease;
            }

            .wf-old-rating-segment:first-child {
                border-top-left-radius: 16px;
                border-bottom-left-radius: 16px;
            }

            .wf-old-rating-segment:last-child {
                border-right: 1px solid rgb(196, 181, 253);
                border-top-right-radius: 16px;
                border-bottom-right-radius: 16px;
            }

            .wf-old-rating-segment.is-active {
                background-color: rgb(196, 181, 253);
                color: rgb(0, 0, 0);
                font-weight: 500;
            }

            @media (max-width: 480px) {
                .wf-old-rating-segment { padding: 4px 12px; }
            }

            .wf-old-rating-tooltip {
                position: absolute;
                left: 50%;
                bottom: calc(100% + 6px);
                transform: translateX(-50%);
                white-space: nowrap;
                padding: 8px 16px;
                border-radius: 4px;
                font-size: 12px;
                line-height: 18px;
                font-weight: 400;
                background: rgba(97, 97, 97, 0.95);
                color: #ffffff;
                pointer-events: none;
                z-index: 9999;
                opacity: 0;
                visibility: hidden;
                transition: opacity 0.12s ease;
            }

            .wf-old-rating-tooltip::after {
                content: "";
                position: absolute;
                left: 50%;
                top: 100%;
                transform: translateX(-50%);
                border-width: 6px;
                border-style: solid;
                border-color: rgba(97, 97, 97, 0.95) transparent transparent transparent;
            }

            .wf-old-rating-segment.is-active:hover .wf-old-rating-tooltip {
                opacity: 1;
                visibility: visible;
            }

            .wf-old-rating-unavailable-message {
                font-size: 12px;
                line-height: 18px;
                color: var(--wf-theme-text-muted, #737373);
            }
        `;

        (document.head || document.documentElement).appendChild(style);
    }

    /******************************************************************
     * INITIALIZATION
     ******************************************************************/
    // Hook fetch immediately (document-start) so the first profile and
    // translation requests aren't missed.
    installFetchHook();
    installPageObserver();
    scheduleCheck();
})();
