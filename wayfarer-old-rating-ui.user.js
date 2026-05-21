// ==UserScript==
// @name         Wayfarer Old Rating UI
// @version      0.0.3
// @description  Restores the Rating UI on the Profile page
// @namespace    https://gitlab.com/Tntnnbltn/wayfarer-addons
// @downloadURL  https://gitlab.com/Tntnnbltn/wayfarer-addons/-/raw/main/wayfarer-old-rating-ui.user.js
// @updateURL    https://gitlab.com/Tntnnbltn/wayfarer-addons/-/raw/main/wayfarer-old-rating-ui.user.js
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
    'use strict';

    /******************************************************************
     * STATE AND CONSTANTS
     ******************************************************************/
    const state = {
        performance: null,
        darkMode: false,
        language: 'en'
    };

    const ORDER = ['poor', 'fair', 'good', 'great'];

    const DEFAULT_RATING_DATA = {
        poor: {
            label: 'Poor',
            description: 'Oh no! Time to freshen up on the review guidelines.'
        },
        fair: {
            label: 'Fair',
            description: 'Not bad! Try reviewing a few more Wayspots.'
        },
        good: {
            label: 'Good',
            description: 'Nice achievement, keep up the good work!'
        },
        great: {
            label: 'Great',
            description: "You're a top notch Wayfinder!"
        }
    };

    /******************************************************************
     * GENERIC HELPERS
     ******************************************************************/
    function normalizeRating(value) {
        if (!value || typeof value !== 'string') return null;

        const normalized = value.trim().toLowerCase();
        return ORDER.includes(normalized) ? normalized : null;
    }

    function setPerformance(value) {
        const normalized = normalizeRating(value);
        if (!normalized) return false;

        state.performance = normalized;
        return true;
    }

    function setLanguage(value) {
        if (!value || typeof value !== 'string') return false;

        state.language = value;
        return true;
    }

    function applyWrapperTheme(wrapper) {
        wrapper.classList.remove('theme-light', 'theme-dark');
        wrapper.classList.add(state.darkMode ? 'theme-dark' : 'theme-light');
    }

    function refreshUi() {
        if (!isProfilePage()) return;

        updateExistingBars();
        scanAndInsert();
    }

    function refreshUiWithRetry(attempt = 0) {
        if (!isProfilePage()) return;

        refreshUi();

        const hasBar = document.querySelector('[data-old-wayfinder-rating="true"]');

        if (!hasBar && attempt < 10) {
            setTimeout(() => refreshUiWithRetry(attempt + 1), 200);
        }
    }

    function isProfilePage() {
        return window.location.pathname === '/new/profile';
    }

    /******************************************************************
     * THEME DETECTION
     ******************************************************************/

    function isHtmlCurrentlyDark() {
        return document.documentElement.classList.contains('dark');
    }

    function normalizeDarkModeSetting(value) {
        if (!value || typeof value !== 'string') return null;

        const normalized = value.trim().toUpperCase();

        if (normalized === 'ENABLED') return 'ENABLED';
        if (normalized === 'DISABLED') return 'DISABLED';
        if (normalized === 'AUTO') return 'AUTO';

        return null;
    }

    function resolveDarkMode(settingValue) {
        const normalized = normalizeDarkModeSetting(settingValue);
        if (normalized === null) return null;

        if (normalized === 'ENABLED') return true;
        if (normalized === 'DISABLED') return false;

        // AUTO → detect from page
        return isHtmlCurrentlyDark();
    }

    function setDarkMode(value) {
        const resolved = resolveDarkMode(value);
        if (resolved === null) return false;

        state.darkMode = resolved;
        return true;
    }

    function refreshDarkModeFromHtmlIfNeeded() {
        const html = document.documentElement;
        if (!html) return;

        const looksDark = html.classList.contains('dark');

        if (state.darkMode !== looksDark) {
            state.darkMode = looksDark;
            refreshUi();
        }
    }

    /******************************************************************
     * TRANSLATION STORAGE HELPERS
     ******************************************************************/

    function getTranslocoTranslations() {
        try {
            const raw = localStorage.getItem('@transloco/translations');
            if (!raw) return null;
            return JSON.parse(raw);
        } catch (err) {
            console.error('Wayfinder old rating: failed to parse transloco translations', err);
            return null;
        }
    }

    /******************************************************************
     * OLD RATING TRANSLATION HELPERS
     ******************************************************************/

    function hasValidFlattenedRatingTranslations(languageCode, translations) {
        if (!languageCode || !translations || typeof translations !== 'object') return false;

        const langData = translations[languageCode];
        if (!langData || typeof langData !== 'object') return false;

        return ORDER.every((key) => {
            return (
                typeof langData[`rating.${key}.label`] === 'string' &&
                typeof langData[`rating.${key}.description`] === 'string'
            );
        });
    }

    function getRatingData() {
        const translations = getTranslocoTranslations();
        const currentLanguage = state.language;

        if (hasValidFlattenedRatingTranslations(currentLanguage, translations)) {
            const langData = translations[currentLanguage];

            return {
                poor: {
                    label: langData['rating.poor.label'],
                    description: langData['rating.poor.description']
                },
                fair: {
                    label: langData['rating.fair.label'],
                    description: langData['rating.fair.description']
                },
                good: {
                    label: langData['rating.good.label'],
                    description: langData['rating.good.description']
                },
                great: {
                    label: langData['rating.great.label'],
                    description: langData['rating.great.description']
                }
            };
        }

        if (hasValidFlattenedRatingTranslations('en', translations)) {
            const langData = translations.en;

            return {
                poor: {
                    label: langData['rating.poor.label'],
                    description: langData['rating.poor.description']
                },
                fair: {
                    label: langData['rating.fair.label'],
                    description: langData['rating.fair.description']
                },
                good: {
                    label: langData['rating.good.label'],
                    description: langData['rating.good.description']
                },
                great: {
                    label: langData['rating.great.label'],
                    description: langData['rating.great.description']
                }
            };
        }

        return DEFAULT_RATING_DATA;
    }

    /******************************************************************
     * OLD RATING BAR RENDERING
     ******************************************************************/

    function createOldRatingBar() {
        const ratingData = getRatingData();

        const wrapper = document.createElement('div');
        wrapper.className = 'wf-old-rating-wrapper';
        wrapper.dataset.oldWayfinderRating = 'true';
        applyWrapperTheme(wrapper);

        const bar = document.createElement('div');
        bar.className = 'wf-old-rating-bar';

        ORDER.forEach((key) => {
            const segment = document.createElement('div');
            segment.className = 'wf-old-rating-segment';
            segment.dataset.ratingKey = key;
            segment.textContent = ratingData[key].label;

            if (key === state.performance) {
                segment.classList.add('is-active');

                const tooltip = document.createElement('div');
                tooltip.className = 'wf-old-rating-tooltip';
                tooltip.textContent = ratingData[key].description;
                segment.appendChild(tooltip);
            }

            bar.appendChild(segment);
        });

        wrapper.appendChild(bar);
        return wrapper;
    }

    function updateExistingBars() {
        const ratingData = getRatingData();
        const wrappers = document.querySelectorAll('[data-old-wayfinder-rating="true"]');

        wrappers.forEach((wrapper) => {
            applyWrapperTheme(wrapper);

            const segments = wrapper.querySelectorAll('.wf-old-rating-segment');

            segments.forEach((segment) => {
                const key = segment.dataset.ratingKey;
                const existingTooltip = segment.querySelector('.wf-old-rating-tooltip');

                segment.classList.remove('is-active');
                segment.textContent = ratingData[key].label;

                if (existingTooltip) {
                    existingTooltip.remove();
                }

                if (key === state.performance) {
                    segment.classList.add('is-active');

                    const tooltip = document.createElement('div');
                    tooltip.className = 'wf-old-rating-tooltip';
                    tooltip.textContent = ratingData[key].description;
                    segment.appendChild(tooltip);
                }
            });
        });
    }

    /******************************************************************
     * CARD INSERTION
     ******************************************************************/

    function insertBarIntoCard(card) {
        if (!card || card.querySelector('[data-old-wayfinder-rating="true"]')) return;

        const inline = card.querySelector('.wf-cred-inline');
        if (!inline) return;

        const newBar = inline.querySelector('.wf-cred-inline__bar');

        if (!newBar) return;

        const oldBar = createOldRatingBar();
        newBar.parentNode.insertBefore(oldBar, newBar);
    }

    function scanAndInsert() {
        const cards = document.querySelectorAll('wf-credibility-card');
        cards.forEach(insertBarIntoCard);
    }

    /******************************************************************
     * API RESPONSE HANDLERS
     ******************************************************************/

    function parseProfile() {
        try {
            if (!this.responseText) return;

            const data = JSON.parse(this.responseText);
            const result = data?.result;

            if (!result) return;

            let changed = false;

            if (setPerformance(result.performance)) {
                changed = true;
            }

            if (changed && isProfilePage()) {
                refreshUiWithRetry();
            }
        } catch (err) {
            console.error('Wayfinder old rating: failed to parse profile response', err);
        }
    }

    function parseProperties() {
        try {
            if (!this.responseText) return;

            const data = JSON.parse(this.responseText);
            const result = data?.result;

            if (!result) return;

            let changed = false;

            if (setPerformance(result.performance)) {
                changed = true;
            }

            if (setDarkMode(result.darkMode)) {
                changed = true;
            }

            if (setLanguage(result.language)) {
                changed = true;
            }

            if (changed) {
                refreshUi();
            }
        } catch (err) {
            console.error('Wayfinder old rating: failed to parse properties response', err);
        }
    }

    function parseSettingsChange() {
        try {
            const bodyText = this._wfRequestBody;
            if (!bodyText) return;

            const payload = JSON.parse(bodyText);
            if (!payload || typeof payload !== 'object') return;

            let changed = false;

            if (typeof payload.language === 'string') {
                if (setLanguage(payload.language)) {
                    changed = true;
                }
            }

            if (typeof payload.darkMode === 'string') {
                if (setDarkMode(payload.darkMode)) {
                    changed = true;
                }
            }

            if (changed) {
                refreshUi();
            }

        } catch (err) {
            console.error('Wayfinder old rating: failed to parse settings request payload', err);
        }
    }

    /******************************************************************
     * NETWORK INTERCEPTS
     ******************************************************************/

    function installApiListeners() {
        const originalOpen = XMLHttpRequest.prototype.open;
        const originalSend = XMLHttpRequest.prototype.send;

        XMLHttpRequest.prototype.open = function (method, url) {
            const isProfile =
                  (url === '/api/v1/vault/profile' ||
                   url === 'https://wayfarer.nianticlabs.com/api/v1/vault/profile') &&
                  method === 'GET';

            const isProperties =
                  (url === '/api/v1/vault/properties' ||
                   url === 'https://wayfarer.nianticlabs.com/api/v1/vault/properties') &&
                  method === 'GET';

            const isSettingsPost =
                  (url === '/api/v1/vault/settings' ||
                   url === 'https://wayfarer.nianticlabs.com/api/v1/vault/settings') &&
                  method === 'POST';

            if (isProfile) {
                this.addEventListener('load', parseProfile, false);
            } else if (isProperties) {
                this.addEventListener('load', parseProperties, false);
            } else if (isSettingsPost) {
                this.addEventListener('load', parseSettingsChange, false);
            }

            return originalOpen.apply(this, arguments);
        };

        XMLHttpRequest.prototype.send = function (body) {
            this._wfRequestBody = body;
            return originalSend.apply(this, arguments);
        };
    }

    /******************************************************************
     * DOM OBSERVERS
     ******************************************************************/

    function installHtmlThemeObserver() {
        const html = document.documentElement;
        if (!html) return;

        const observer = new MutationObserver((mutations) => {
            for (const mutation of mutations) {
                if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
                    refreshDarkModeFromHtmlIfNeeded();
                    break;
                }
            }
        });

        observer.observe(html, {
            attributes: true,
            attributeFilter: ['class']
        });
    }


    /******************************************************************
     * STYLE INJECTION
     ******************************************************************/
    function injectStyles() {
        if (document.getElementById('wf-old-rating-style')) return;

        const style = document.createElement('style');
        style.id = 'wf-old-rating-style';
        style.textContent = `
            .wf-old-rating-wrapper {
                margin: 12px 0 18px 0;
                position: relative;
            }

            .wf-old-rating-bar {
                display: inline-flex;
                align-items: stretch;
                width: auto;
                max-width: 100%;
                border-radius: 16px;
                overflow: visible;
                box-sizing: border-box;
                user-select: none;
                position: relative;
            }

            .wf-old-rating-segment {
                display: block;
                box-sizing: border-box;
                position: relative;
                cursor: default;
                user-select: none;
                text-align: center;

                font-family: Akkurat, ui-sans-serif, system-ui, -apple-system, "system-ui", "Segoe UI", Roboto, "Helvetica Neue", Arial, "Noto Sans", sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", "Noto Color Emoji";
                font-feature-settings: "tnum";
                font-variant-numeric: tabular-nums;
                font-size: 14px;
                line-height: 21px;
                font-weight: 400;

                padding: 4px 24px;
                height: 31px;
                min-height: 31px;

                transition: background-color 0.15s ease, color 0.15s ease;
                -webkit-tap-highlight-color: rgba(0, 0, 0, 0);
            }

            .wf-old-rating-segment:first-child {
                border-top-left-radius: 16px;
                border-bottom-left-radius: 16px;
            }

            .wf-old-rating-segment:last-child {
                border-top-right-radius: 16px;
                border-bottom-right-radius: 16px;
            }

            .wf-old-rating-tooltip {
                position: absolute;
                left: 50%;
                bottom: calc(100% + 6px);
                transform: translateX(-50%);

                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;

                padding: 8px 16px;
                border-radius: 4px;

                font-family: Roboto, "Helvetica Neue", sans-serif;
                font-feature-settings: "tnum";
                font-variant-numeric: tabular-nums;
                font-size: 12px;
                line-height: 18px;

                background: rgba(97, 97, 97, 0.9);
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
                border-color: rgba(97, 97, 97, 0.9) transparent transparent transparent;
            }

            .wf-old-rating-segment.is-active:hover .wf-old-rating-tooltip {
                opacity: 1;
                visibility: visible;
            }

            /* Light mode */
            .wf-old-rating-wrapper.theme-light .wf-old-rating-segment {
                color: rgb(82, 82, 82);
                background-color: transparent;
                border-top: 1px solid rgb(196, 181, 253);
                border-bottom: 1px solid rgb(196, 181, 253);
                border-left: 1px solid rgb(196, 181, 253);
                border-right: none;
            }

            .wf-old-rating-wrapper.theme-light .wf-old-rating-segment:last-child {
                border-right: 1px solid rgb(196, 181, 253);
            }

            .wf-old-rating-wrapper.theme-light .wf-old-rating-segment.is-active {
                background-color: rgb(196, 181, 253);
                color: rgb(0, 0, 0);
                border-right: 1px solid rgb(196, 181, 253);
            }

            /* Dark mode */
            .wf-old-rating-wrapper.theme-dark .wf-old-rating-segment {
                color: rgb(212, 212, 212);
                background-color: transparent;
                border-top: 1px solid rgb(196, 181, 253);
                border-bottom: 1px solid rgb(196, 181, 253);
                border-left: 1px solid rgb(196, 181, 253);
                border-right: none;
            }

            .wf-old-rating-wrapper.theme-dark .wf-old-rating-segment:last-child {
                border-right: 1px solid rgb(196, 181, 253);
            }

            .wf-old-rating-wrapper.theme-dark .wf-old-rating-segment.is-active {
                background-color: rgb(196, 181, 253);
                color: rgb(0, 0, 0);
                border-right: 1px solid rgb(196, 181, 253);
            }
        `;

        document.head.appendChild(style);
    }

    /******************************************************************
     * INITIALIZATION
     ******************************************************************/
    function init() {
        injectStyles();
        installApiListeners();
        scanAndInsert();
        installHtmlThemeObserver();
        refreshDarkModeFromHtmlIfNeeded();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();