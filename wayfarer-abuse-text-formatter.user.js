// ==UserScript==
// @name         Wayfarer Abuse Text Formatter
// @version      0.2.1
// @author       Tntnnbltn (fork maintained by JeremyChuaWX)
// @description  Adds text for copy & paste into Abuse form
// @namespace    https://github.com/JeremyChuaWX/wayfarer-addons
// @downloadURL  https://jeremychuawx.github.io/wayfarer-addons/wayfarer-abuse-text-formatter.user.js
// @updateURL    https://jeremychuawx.github.io/wayfarer-addons/wayfarer-abuse-text-formatter.user.js
// @homepageURL  https://jeremychuawx.github.io/wayfarer-addons/guides/wayfarer-abuse-text-formatter.html
// @supportURL   https://github.com/JeremyChuaWX/wayfarer-addons/issues
// @match        https://wayfarer.scopely.com/*
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
/* eslint indent: ['error', 2] */

(function() {

    /**
     * Overwrite the open method of the XMLHttpRequest.prototype to intercept the server calls
     */
    (function (open) {
        XMLHttpRequest.prototype.open = function (method, url) {
            if (url == '/api/v1/vault/review') {
                if (method == 'GET') {
                    this.addEventListener('load', checkResponse, false);
                }
            }
            open.apply(this, arguments);
        };
    })(XMLHttpRequest.prototype.open);

    function checkResponse(e) {
        try {
            const response = this.response;
            const json = JSON.parse(response);
            if (!json) {
                console.warn('Failed to parse response from Wayfarer');
                return;
            }
            // ignore if it's related to captchas
            if (json.captcha) return;

            const candidate = json.result;
            if (!candidate) {
                console.warn('Wayfarer\'s response didn\'t include a candidate.');
                return;
            }

            if (candidate.type === 'NEW' || candidate.type === 'PHOTO') {
                insertReportLink(candidate);
            } else if (candidate.type === 'EDIT') {
                insertEditReportLink(candidate);
            }

        } catch (e) {
            console.log(e); // eslint-disable-line no-console
        }
    }

     const awaitElement = get => new Promise((resolve, reject) => {
                let triesLeft = 30;
                const queryLoop = () => {
                        const ref = get();
                        if (ref) resolve(ref);
                        else if (!triesLeft) reject();
                        else setTimeout(queryLoop, 100);
                        triesLeft--;
                }
                queryLoop();
     });

    function createReportText(candidate) {
        const { title, lat, lng } = candidate;

        // Create a new div element
        const newDiv = document.createElement('div');

        // Set the content of the new div element
        if (title) {
            newDiv.textContent = `"${title}" at ${lat},${lng} `;
        } else {
            newDiv.textContent = `[Unknown Title] at ${lat},${lng} `;
        }

        // Create a hyperlink element
        const reportLink = document.createElement('a');
        reportLink.textContent = '[Report]';
        reportLink.href = 'https://scopelyexplore.helpshift.com/hc/en/10-wayfarer/faq/1999-reporting-abuse-in-wayfarer/';
        // Open in a new tab so the in-progress review isn't lost.
        reportLink.target = '_blank';
        reportLink.rel = 'noopener noreferrer';

        // Append the hyperlink element to the new div element
        newDiv.appendChild(reportLink);

        return newDiv;
    }

    function insertReportLink(candidate) {
        // Use awaitElement to wait for the target div element to be available
        awaitElement(() => document.querySelector('.mt-2'))
            .then(targetElement => {
            const { title, lat, lng } = candidate;

            const abuseTextDiv = createReportText(candidate);

            // Insert the new div element before the target element
            targetElement.parentNode.insertBefore(abuseTextDiv, targetElement);
        })
            .catch(() => {
            console.log("Target div element not found.");
        });
    }

    function insertEditReportLink(candidate) {
        // Use awaitElement to wait for the target div element to be available
        awaitElement(() => document.querySelector('.review-edit-info'))
            .then(targetElement => {

            const abuseTextDiv = createReportText(candidate);

            // Insert the new div element as the second child of the target element
            if (targetElement.children.length >= 1) {
                targetElement.insertBefore(abuseTextDiv, targetElement.children[1]);
            } else {
                targetElement.appendChild(abuseTextDiv); // If no child exists, simply append
            }
        })
            .catch(() => {
            console.log("Target div element not found.");
        });
    }

})();