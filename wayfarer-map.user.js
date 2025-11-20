// ==UserScript==
// @name         Wayfarer Map
// @version      0.0.2
// @description  Provides a link to a map in the Wayfarer menu
// @namespace    https://gitlab.com/Tntnnbltn/wayfarer-addons
// @downloadURL  https://gitlab.com/Tntnnbltn/wayfarer-addons/wayfarer-map.user.js
// @homepageURL  https://gitlab.com/Tntnnbltn/wayfarer-addons
// @match        https://wayfarer.nianticlabs.com/*
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
// directory of this script's GitHub repository:
// <https://github.com/tehstone/wayfarer-addons/blob/main/LICENSE>
// If not, see <https://www.gnu.org/licenses/>.

(function () {
    'use strict';

    // -------------------------------------------------------------------------
    // State
    // -------------------------------------------------------------------------

    let observer = null;
    let pinnedWarningObserver = null;

    // Persisted flag: did we navigate to /new/submit/new via the Map button?
    let navigatedFromMap = sessionStorage.getItem('wf_map_nav') === '1';

    // If we are NOT on /new/submit/new at load, reset the flag
    if (location.pathname !== '/new/submit/new') {
        navigatedFromMap = false;
        sessionStorage.setItem('wf_map_nav', '0');
    }

    // -------------------------------------------------------------------------
    // Generic helpers
    // -------------------------------------------------------------------------

    function waitForElement(selector, timeout = 5000) {
        return new Promise((resolve, reject) => {
            const element = document.querySelector(selector);
            if (element) return resolve(element);

            const mo = new MutationObserver(() => {
                const el = document.querySelector(selector);
                if (el) {
                    mo.disconnect();
                    resolve(el);
                }
            });

            mo.observe(document.body, { childList: true, subtree: true });

            setTimeout(() => {
                mo.disconnect();
                reject(`Timed out waiting for: ${selector}`);
            }, timeout);
        });
    }

    // -------------------------------------------------------------------------
    // Layout helpers (padding + map height)
    // -------------------------------------------------------------------------

    async function removeBottomPadding() {
        try {
            const content = await waitForElement('.mat-drawer-content.mat-sidenav-content');

            // Remove Tailwind class (pb-12) if present
            content.classList.remove('pb-12');

            // Enforce padding-bottom: 0px !important
            content.style.setProperty('padding-bottom', '0px', 'important');

        } catch (err) {
            console.warn('[Wayfarer Map] Could not remove bottom padding:', err);
        }
    }

    async function resizeSubmitMapToViewport() {
        let mapContainer;

        try {
            mapContainer = await waitForElement('.submit-wayspot-map-container');
        } catch (err) {
            console.warn('[Wayfarer Map] Map container not found:', err);
            return;
        }

        function adjustHeight() {
            const rect = mapContainer.getBoundingClientRect();
            const offsetTop = rect.top;

            // Calculate remaining vertical space
            let targetHeight = window.innerHeight - offsetTop - 30; // margin
            if (targetHeight < 200) targetHeight = 200;

            mapContainer.style.height = targetHeight + 'px';
        }

        // Adjust immediately
        adjustHeight();

        // Re-adjust on resize
        window.addEventListener('resize', adjustHeight);

        // Re-adjust after Google Maps initializes (extra-safe)
        setTimeout(adjustHeight, 200);
        setTimeout(adjustHeight, 500);
    }

    function suppressPinnedLocationWarningsIfMapMode() {
        const fromMap = sessionStorage.getItem('wf_map_nav') === '1';
        const onMapPage = location.pathname === '/new/submit/new';

        if (!fromMap || !onMapPage) return;

        const nodes = document.querySelectorAll('div.mt-2.text-sm.text-red-600');
        nodes.forEach((el) => {
            const text = (el.textContent || '').trim();
            if (text.startsWith('Pinned location must be within 10 km')) {
                el.remove();
            }
        });
    }

    function startPinnedWarningSuppressor() {
        if (pinnedWarningObserver) return;

        pinnedWarningObserver = new MutationObserver(() => {
            suppressPinnedLocationWarningsIfMapMode();
        });

        pinnedWarningObserver.observe(document.body, {
            childList: true,
            subtree: true,
        });

        // Clean up anything already rendered
        suppressPinnedLocationWarningsIfMapMode();
    }

    // -------------------------------------------------------------------------
    // Sidebar active state / tracking
    // -------------------------------------------------------------------------

    function updateSidebarActiveForMapMode() {
        const fromMap = sessionStorage.getItem('wf_map_nav') === '1';
        const onMapPage = location.pathname === '/new/submit/new';

        // Only care about the special case: map-nav + correct route
        if (!onMapPage || !fromMap) return;

        let tries = 30; // 30 * 100ms = 3s max

        const interval = setInterval(() => {
            const submitLink = document.querySelector('app-sidebar-link a.sidebar-link[title="Submit"]');
            const mapLink = document.querySelector('app-sidebar-link a.sidebar-link.sidebar-wayfarermap');

            if (submitLink && mapLink) {
                // Remove highlight from Submit
                submitLink.classList.remove('sidebar-link--active');

                // Give active highlight to Map
                mapLink.classList.add('sidebar-link--active');

                clearInterval(interval);
                return;
            }

            tries--;
            if (tries <= 0) {
                console.warn('[MapMode] Could not find Submit/Map links to update active state');
                clearInterval(interval);
            }
        }, 100);
    }

    function setupSidebarTracking(sidebar) {
        if (window._wf_sidebarTrackingSetup) return;
        window._wf_sidebarTrackingSetup = true;

        sidebar.addEventListener('click', (e) => {
            const a = e.target.closest('a.sidebar-link');
            if (!a) return;

            const mapLink = document.querySelector('a.sidebar-link.sidebar-wayfarermap');

            // If it's the Map button, let its own click handler do the work
            if (a.classList.contains('sidebar-wayfarermap')) {
                return;
            }

            // Any other sidebar link → we're not "from Map" anymore
            sessionStorage.setItem('wf_map_nav', '0');

            // Remove Map's active state if present
            if (mapLink) {
                mapLink.classList.remove('sidebar-link--active');
            }

            // Ensure ONLY the clicked link has sidebar-link--active
            document
                .querySelectorAll('a.sidebar-link.sidebar-link--active')
                .forEach((el) => el.classList.remove('sidebar-link--active'));

            a.classList.add('sidebar-link--active');
        });
    }

    // -------------------------------------------------------------------------
    // Sidebar Map link injection
    // -------------------------------------------------------------------------

    function addMapSidebarLink() {
        // Don't add it twice
        if (document.querySelector('app-sidebar-link a.sidebar-link.sidebar-link--map')) {
            if (observer) observer.disconnect();
            return;
        }

        // Find the existing "Submit" link
        const submitAnchor = document.querySelector(
            'app-sidebar-link a.sidebar-link[title="Submit"]'
        );
        if (!submitAnchor) return; // sidebar not ready yet

        const submitWrapper = submitAnchor.closest('app-sidebar-link');
        if (!submitWrapper || !submitWrapper.parentNode) return;

        // Clone the whole app-sidebar-link node so it keeps styling/structure
        const mapWrapper = submitWrapper.cloneNode(true);
        const mapAnchor = mapWrapper.querySelector('a.sidebar-link');
        if (!mapAnchor) return;

        // Adjust attributes for the new Map entry
        mapAnchor.classList.remove('sidebar-link--active');
        mapAnchor.classList.add('sidebar-link--map');
        mapAnchor.classList.add('sidebar-wayfarermap');
        mapAnchor.title = 'Map';

        const span = mapAnchor.querySelector('span');
        if (span) {
            span.textContent = 'Map';
        }

        // Intercept click and mark that we came from the Map button
        mapAnchor.addEventListener('click', function (e) {
            e.preventDefault();

            const url = '/new/submit/new'; // SPA-style path

            // Mark that this navigation came from the Map button
            navigatedFromMap = true;
            sessionStorage.setItem('wf_map_nav', '1');

            // Try SPA-style navigation first
            if (window.history && typeof window.history.pushState === 'function') {
                window.history.pushState({}, '', url);

                // Nudge Angular's router by emitting a popstate event
                try {
                    window.dispatchEvent(new PopStateEvent('popstate', { state: {} }));
                } catch (err) {
                    const evt = document.createEvent('PopStateEvent');
                    evt.initPopStateEvent('popstate', true, true, {});
                    window.dispatchEvent(evt);
                }
            } else {
                // Fallback: full reload
                window.location.href = url;
            }
        });

        // Remove old icon
        const oldIcon = mapAnchor.querySelector('img.sidebar-link__icon');
        if (oldIcon) oldIcon.remove();

        // Insert inline SVG icon
        mapAnchor.insertAdjacentHTML(
            'afterbegin',
            `<svg viewBox="0 0 75 75" width="24" height="24"
                 fill="currentColor" class="sidebar-link__icon">
                <path d="M 8.755372e-7,11.25 26.250001,0 l 22.5,11.25 23.6362,-10.1287 c 0.2854,-0.1224 0.5966,-0.1719 0.9058,-0.1443 0.3092,0.0277 0.6067,0.1317 0.8658,0.3027 0.2591,0.171 0.4717,0.4036 0.6187,0.677 0.147,0.2735 0.2238,0.5791 0.2235,0.8896 V 63.75 l -26.25,11.25 -22.5,-11.25 -23.6362001,10.1288 c -0.2854,0.1223 -0.5966,0.1718 -0.9058,0.1442 -0.3092,-0.0277 -0.6067,-0.1317 -0.86580002,-0.3027 -0.2591,-0.171 -0.4717,-0.4036 -0.6187,-0.677 C 0.07650088,72.7698 -2.9912446e-4,72.4642 8.755372e-7,72.1537 Z M 52.500001,65.2313 l 15,-6.4276 v -47.43 l -15,6.4276 z m -7.5,-0.4913 V 17.76 l -15,-7.5 v 46.98 z m -22.5,-7.5412 V 9.7688 L 7.5000009,16.1962 v 47.43 z"/>
             </svg>`
        );

        // Insert right after "Submit"
        submitWrapper.parentNode.insertBefore(mapWrapper, submitWrapper.nextSibling);

        // Once added, we can stop observing
        if (observer) observer.disconnect();
    }

    // -------------------------------------------------------------------------
    // Page modification for Map mode (/new/submit/new via Map Button)
    // -------------------------------------------------------------------------

    function modifySubmitNewPageForMapMode() {
        // Run only if we reached this page via Map button
        const fromMap = sessionStorage.getItem('wf_map_nav') === '1';
        if (!fromMap) return;

        // Only on correct route
        if (location.pathname !== '/new/submit/new') return;

        // Wait for Angular to render the page
        const interval = setInterval(() => {
            const root = document.querySelector('app-submit-wayspot.ng-star-inserted');
            if (!root) return;

            const container = root.querySelector(':scope > div');
            if (!container) return;

            const h1 = container.querySelector('h1');
            const sections = container.querySelectorAll('div.section');
            const submitButton = container.querySelector('div.submit-button-container');

            if (sections.length < 4) return;

            clearInterval(interval);

            // Remove the unwanted elements
            if (h1) h1.remove();
            if (sections[0]) sections[0].remove();
            if (sections[1]) sections[1].remove();

            // Keep & tag section[2]
            if (sections[2]) {
                sections[2].classList.add('parent-map-div');

                // Remove child <h4> and <h5> inside parent-map-div
                const h4 = sections[2].querySelector('h4');
                const h5 = sections[2].querySelector('h5');
                if (h4) h4.remove();
                if (h5) h5.remove();
            }

            if (sections[3]) sections[3].remove();
            if (submitButton) submitButton.remove();

            removeBottomPadding();
            resizeSubmitMapToViewport();

            // Also keep it in sync on window resizes
            window.addEventListener('resize', resizeSubmitMapToViewport);

            // Start suppressing "pinned location" warnings only in Map mode
            startPinnedWarningSuppressor();
        }, 150);
    }

    // -------------------------------------------------------------------------
    // Observer + wiring
    // -------------------------------------------------------------------------

    function setupObserver() {
        // Observe DOM changes until the sidebar appears
        observer = new MutationObserver(() => {
            const sidebar = document.querySelector('app-sidebar');
            if (sidebar) {
                addMapSidebarLink();
                setupSidebarTracking(sidebar);
            }
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true,
        });

        // Also try immediately in case the sidebar is already there
        addMapSidebarLink();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', setupObserver);
    } else {
        setupObserver();
    }

    // Run map-mode logic for initial load
    modifySubmitNewPageForMapMode();
    updateSidebarActiveForMapMode();

    // Keep behaviour in sync with SPA navigation
    window.addEventListener('popstate', () => {
        modifySubmitNewPageForMapMode();
        updateSidebarActiveForMapMode();
    });

    // -------------------------------------------------------------------------
    // CSS injection
    // -------------------------------------------------------------------------

    const style = document.createElement('style');
    style.type = 'text/css';
    style.innerHTML = `
        /* Make the SVG use the link's text color */
        .sidebar-wayfarermap svg {
            width: 24px;
            height: 24px;
            filter: none;
            fill: currentColor;
        }

        /* Normal colour */
        a.sidebar-link.sidebar-wayfarermap {
            color: #d3d3d3 !important;
        }

        /* Hover colour */
        a.sidebar-link.sidebar-wayfarermap:hover {
            color: #ffffff !important;
        }
    `;
    document.head.appendChild(style);

})();
