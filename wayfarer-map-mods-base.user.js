// ==UserScript==
// @name         Wayfarer Map Mods - Base
// @version      2.2.7
// @description  Base plug-in for Wayfarer Maps
// @namespace    https://gitlab.com/Tntnnbltn/wayfarer-addons
// @downloadURL  https://gitlab.com/Tntnnbltn/wayfarer-addons/-/raw/main/wayfarer-map-mods-base.user.js
// @homepageURL  https://gitlab.com/Tntnnbltn/wayfarer-addons
// @match        https://wayfarer.nianticlabs.com/*
// @run-at       document-start
// @grant        none
// @require      https://unpkg.com/heic2any@0.0.4/dist/heic2any.min.js
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
// <https://gitlab.com/Tntnnbltn/wayfarer-addons/-/blob/main/LICENSE>
// If not, see <https://www.gnu.org/licenses/>.


(function() {
    'use strict';

    // ==================================
    // Global state & constants
    // ==================================

    // ----- Constants -----
    const MAP_MODE = {
        MOBILE: "mobile",
        DESKTOP: "desktop"
    };

    // ----- Radius for retrieving POIs -----
    let radius = 200;
    let poiMovementThreshold = radius * 0.25;

    // ----- Radius for submitting POIs -----
    let submitRadius = 10000;

    // ----- Map instance & core map state -----
    let submitMap = null;
    let currentMapMode = null;
    let poiInfoWindow = null;
    let CenterPinOverlay = null;
    let centerPinOverlay = null;
    let desktopSubmitMarker = null;
    let desktopSubmitMarkerIcon = null;

    // ----- POI & marker state -----
    let markersByGuid = {};
    let lastFetchLat = null;
    let lastFetchLng = null;

    // ----- Deep link state -----
    let deepLinkTarget = null;
    let skipRestoreMapViewForThisLoad = false;
    let deepLinkSelectionPending = false;

    // ----- Observers & watchers -----
    let latLngObserver = null;
    let latLngBodyObserver = null;
    let latLngTargetEl = null;
    let sidebarObserver = null;
    let pinnedWarningObserver = null;
    let poiBridgeObserver = null;
    let lastBridgePayload = null;

    // ----- Selected marker styling ---
    let lastSelectedPoi = null;
    let selectedPoiGuid = null;
    let selectedPoiCircle80m = null;
    let genericMarkerOriginalIcons = {};

    // ----- UI element references -----
    let sidePanelEl = null;
    let mapRightClickMenuEl = null;
    let layersControlEl = null;
    let wayspotsLayerCheckboxEl = null;
    let draftSubmissionsLayerCheckboxEl = null;

    // ----- User / submitter positional state -----
    let userLocationMarker = null;
    let submitterLocation = null;

    // ----- Behaviour flags -----
    let mapTypeListenerBound = false;
    let mapClickCloseBound = false;


    // ----- Sidebar state -----
    let sidePanelCollapsed = false;


    // ----- LocalStorage key for this plugin -----
    const SETTINGS_KEY = "wfmap_settings";

    // ----- Nomination status text -----
    const STATUS_LABELS = {
        LIVE: "Live",
        NOMINATED: "In Queue",
        NIANTIC_REVIEW: "Niantic Review",
        APPEALED: "Appeal Pending",
        HELD: "On Hold",
        WITHDRAWN: "Withdrawn",
        REJECTED: "Not Accepted",
        DUPLICATE: "Duplicate",
        ACCEPTED: "Accepted",
    };

    // ==================================
    // SVG Logos
    // ==================================
    const WAYFARER_LOGO_SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 168.64822 385.63867"><g transform="translate(-1713.3254,-206.92756)"><path fill="#000000" d="m 1796.8177,206.93648 c -1.4336,0.0214 -2.8694,0.0811 -4.3086,0.17968 -46.5329,3.18681 -81.4741,42.22048 -79.0664,88.33008 0.6634,12.70543 1.194,14.21682 45.043,128.26758 12.3703,32.17497 22.7806,59.4 23.1328,60.5 0.9228,2.88168 3.7726,6.02575 7.6817,8.47656 7.3893,4.63273 19.8475,0.73709 23.4296,-7.32617 2.4087,-5.42181 55.0508,-143.34771 61.4317,-160.95508 6.7916,-18.74043 8.5934,-28.23315 7.5273,-39.66015 -2.0038,-21.47603 -10.6317,-39.26432 -26.3027,-54.23633 -16.3041,-15.57678 -37.0635,-23.89663 -58.5684,-23.57617 z m 0.6875,51.41406 a 33.067028,33.067028 0 0 1 33.0664,33.0664 33.067028,33.067028 0 0 1 -33.0664,33.06641 33.067028,33.067028 0 0 1 -33.0683,-33.06641 33.067028,33.067028 0 0 1 33.0683,-33.0664 z m 0.8184,269.64648 c -4.5709,-0.16021 -9.2407,0.67626 -13.7168,2.65625 -5.8988,2.6093 -13.0929,9.51789 -16.1582,15.51953 -3.6613,7.16844 -4.2239,17.96942 -1.3359,25.6211 3.4496,9.13947 10.5363,16.08888 19.9726,19.58789 5.5946,2.0745 18.5971,1.31232 24.1582,-1.41602 14.0914,-6.91328 21.5412,-22.84569 17.5488,-37.52539 -3.945,-14.50608 -16.7561,-23.96272 -30.4687,-24.44336 z" /></g></svg>';
    const SUBMISSION_PIN = '<svg width="30" height="47" viewBox="0 0 30 47" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M14.5146 0C22.5308 1.85546e-05 29.0293 6.49846 29.0293 14.5146C29.0293 22.0646 23.2643 28.2678 15.8965 28.9639V44.2354C15.8963 44.9986 15.278 45.6172 14.5146 45.6172C13.7513 45.6172 13.132 44.9986 13.1318 44.2354V28.9639C5.76427 28.2676 1.65052e-05 22.0644 0 14.5146C0 6.49845 6.49845 0 14.5146 0ZM14.5176 9.67676C11.8457 9.67693 9.67969 11.8427 9.67969 14.5146C9.67978 17.1865 11.8457 19.3524 14.5176 19.3525C17.1896 19.3525 19.3564 17.1866 19.3564 14.5146C19.3564 11.8426 17.1896 9.67676 14.5176 9.67676Z" fill="#FF4713"/><path opacity="0.3" d="M14.5145 46.9998C16.4231 46.9998 17.9703 46.2262 17.9703 45.2719C17.9703 44.3176 16.4231 43.5439 14.5145 43.5439C12.6058 43.5439 11.0586 44.3176 11.0586 45.2719C11.0586 46.2262 12.6058 46.9998 14.5145 46.9998Z" fill="#FF4713"/></svg>';

    // ==================================
    // User settings & configuration
    // ==================================

    let userSettings = {
        poi: {
            markerType: "generic", // "thumbnail" or "generic"

            thumbnail: {
                borderColor: "#ffffff",
                borderWidth: 3,
                borderOpacity: 0.7
            },

            generic: {
                borderColor: "#ff6600",
                borderWidth: 2,
                borderOpacity: 1.0,
                fillColor: "#ff6600",
                fillOpacity: 0.5
            }
        },
        map: {
            defaultType: "roadmap",
            rememberLastView: true,

            // 200 m “Nearby Wayspots” radius around the current marker
            nearbyRadius: {
                enabled: true,
                strokeColor: "#4285F4",
                strokeOpacity: 0.8,
                strokeWidth: 2,
                fillColor: "#4285F4",
                fillOpacity: 0.0
            },

            // 10 km “user submit radius” around original location
            submitRadius: {
                enabled: true,
                strokeColor: "#e13cff",
                strokeOpacity: 0.8,
                strokeWidth: 4,
                fillColor: "#e13cff",
                fillOpacity: 0.0
            },

            // 80 m interaction radius around the selected wayspot
            interactRadius: {
                enabled: true,
                strokeColor: "#ffcc33",
                strokeOpacity: 0.9,
                strokeWidth: 2,
                fillColor: "#ffed24",
                fillOpacity: 0.05
            },

            // 22 m PowerSpot radius around the submission marker
            powerSpotRadius: {
                enabled: true,
                strokeColor: "#ff47c5",
                strokeOpacity: 1.0,
                strokeWidth: 1.5,
                fillColor: "#ffffff",
                fillOpacity: 0.0
            }
        },
        layers: {
            wayspots: {
                enabled: true
            }
        }
    };

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

    // ==================================
    // General helpers
    // ==================================

    const awaitElement = get => new Promise((resolve, reject) => {
        let triesLeft = 10;
        const queryLoop = () => {
            const ref = get();
            if (ref) resolve(ref);
            else if (!triesLeft) reject();
            else setTimeout(queryLoop, 100);
            triesLeft--;
        }
        queryLoop();
    });

    function escapeHtml(str) {
        if (!str) return "";
        return String(str)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    function hexToRgba(hex, opacity) {
        const h = hex.replace("#", "");
        const r = parseInt(h.substring(0, 2), 16);
        const g = parseInt(h.substring(2, 4), 16);
        const b = parseInt(h.substring(4, 6), 16);
        return `rgba(${r}, ${g}, ${b}, ${opacity})`;
    }

    function toRad(deg) {
        return deg * Math.PI / 180;
    }

    // Haversine distance in metres
    function distanceMeters(lat1, lng1, lat2, lng2) {
        const R = 6371000; // Earth radius in metres
        const dLat = toRad(lat2 - lat1);
        const dLng = toRad(lng2 - lng1);
        const a =
              Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
              Math.sin(dLng / 2) * Math.sin(dLng / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
    }

    // ==================================
    // Navigation state & sidebar integration
    // ==================================

    function setupSidebarTracking(sidebar) {
        if (window._wfmapmodsSidebarTrackingSetup) return;
        window._wfmapmodsSidebarTrackingSetup = true;

        sidebar.addEventListener('click', (e) => {
            const a = e.target.closest('a.sidebar-link');
            if (!a) return;

            // Collect all <a.sidebar-link> in order
            const wrappers = sidebar.querySelectorAll('app-sidebar-link');
            const links = Array.from(wrappers)
            .map(w => w.querySelector('a.sidebar-link'))
            .filter(Boolean);

            const index = links.indexOf(a);

            // By convention:
            //   index 1 => Submit (2nd item)
            //   index 2 => our Map (3rd item)
            const submitLink = links[1] || null;
            const mapLink = links[2] || null;

            // If it's the Map button (3rd link), let its own click handler manage state
            if (index === 2 && mapLink === a) {
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

    function addMapSidebarLink() {
        if (document.querySelector('app-sidebar-link a.sidebar-link.sidebar-wayfarermap')) {
            if (sidebarObserver) sidebarObserver.disconnect();
            return;
        }

        const sidebar = document.querySelector('app-sidebar');
        if (!sidebar) return;

        // Use the order of links to detect submit button
        //  - 0: first nav item (Showcase)
        //  - 1: second nav item (Submit)
        //  - 2: where we want to insert our Map entry
        const wrappers = sidebar.querySelectorAll('app-sidebar-link');
        if (wrappers.length < 2) {
            // Sidebar not fully built yet; wait for more nodes
            return;
        }

        const submitWrapper = wrappers[1]; // 2nd item in the list
        const submitAnchor = submitWrapper.querySelector('a.sidebar-link');
        if (!submitAnchor || !submitWrapper.parentNode) return;

        // Clone the whole app-sidebar-link node so it keeps styling/structure
        const mapWrapper = submitWrapper.cloneNode(true);
        const mapAnchor = mapWrapper.querySelector('a.sidebar-link');
        if (!mapAnchor) return;

        // Adjust attributes for the new Map entry
        mapAnchor.classList.remove('sidebar-link--active');
        mapAnchor.classList.add('sidebar-link--map');
        mapAnchor.classList.add('sidebar-wayfarermap');
        mapAnchor.title = 'Map';
        mapAnchor.setAttribute('data-wfmapmods-role', 'map');

        const span = mapAnchor.querySelector('span');
        if (span) {
            span.textContent = 'Map';
        }

        // Intercept click and mark that we came from the Map button
        mapAnchor.addEventListener('click', function(e) {
            e.preventDefault();

            const url = '/new/submit/new'; // SPA-style path

            // Mark that this navigation came from the Map button
            sessionStorage.setItem('wf_map_nav', '1');

            // Try SPA-style navigation first
            if (window.history && typeof window.history.pushState === 'function') {
                window.history.pushState({}, '', url);

                // Nudge Angular's router by emitting a popstate event
                try {
                    window.dispatchEvent(new PopStateEvent('popstate', {
                        state: {}
                    }));
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

        // Insert right after the second nav item (Submit),
        // which makes us the 3rd <app-sidebar-link>
        submitWrapper.parentNode.insertBefore(mapWrapper, submitWrapper.nextSibling);

        // Once added, we can stop observing
        if (sidebarObserver) sidebarObserver.disconnect();
    }

    function setupSidebarObserver() {
        if (sidebarObserver) return;

        // Observe DOM changes until the sidebar appears
        sidebarObserver = new MutationObserver(() => {
            const sidebar = document.querySelector('app-sidebar');
            if (sidebar) {
                addMapSidebarLink();
                setupSidebarTracking(sidebar);
            }
        });

        sidebarObserver.observe(document.body, {
            childList: true,
            subtree: true,
        });

        // Also try immediately in case the sidebar is already there
        addMapSidebarLink();
    }

    // ==================================
    // Format page for map view
    // ==================================

    let wfMapResizeListenerAttached = false;

    function formatPageForMapMode() {
        // Only run when arriving via Map button
        if (sessionStorage.getItem('wf_map_nav') !== '1') return;

        // Only run on the correct route
        if (location.pathname !== '/new/submit/new') return;

        const interval = setInterval(() => {
            // --- Change the active highlight to the Map button ----
            setSidebarActiveForMapMode();

            const root = document.querySelector('app-submit-wayspot.ng-star-inserted');
            if (!root) return;

            const mapComp = root.querySelector('app-submit-wayspot-map');
            if (!mapComp) return;

            const container = root.querySelector(':scope > div');
            if (!container) {
                console.warn("Wayfarer Map: container div not found under app-submit-wayspot");
                return;
            }

            clearInterval(interval);

            // --- Hide everything other than the map ----

            // Find the direct child that contains the map component once
            const mapSection = Array.from(container.children).find((child) =>
                                                                   child.contains(mapComp)
                                                                  );

            // 1) Hide all siblings of the map section
            Array.from(container.children).forEach((child) => {
                if (child === mapSection) return;
                child.style.display = 'none';
            });

            // 2) Inside the map section, hide everything except the map host itself
            if (mapSection) {
                Array.from(mapSection.children).forEach((child) => {
                    if (child === mapComp || child.contains(mapComp)) {
                        // keep the map host (and any wrapper immediately around it)
                        return;
                    }
                    child.style.display = 'none';
                });
            }

            // --- Remove padding from mat-sidenav-content (full-screen map) ----
            removeSidenavPaddingForMapPage();

            // --- Remove Niantic width limiter ----
            const limiter = container.closest('.max-w-7xl');
            if (limiter) {
                limiter.classList.remove('max-w-7xl');
                limiter.dataset.wfRemovedMaxWidth = "1";
            }

            // --- Disable vertical scrolling ----
            let node = root;
            while (node && node !== document.body) {
                if (node instanceof HTMLElement) {
                    const cs = getComputedStyle(node);
                    if (cs.overflowY === 'auto' || cs.overflowY === 'scroll') {
                        node.style.overflowY = 'hidden';
                    }
                }
                node = node.parentElement;
            }

            // --- Resize map to fill viewport ----
            resizeSubmitMapToViewport();
            if (!wfMapResizeListenerAttached) {
                window.addEventListener('resize', resizeSubmitMapToViewport);
                wfMapResizeListenerAttached = true;
            }
        }, 150);
    }

    function setSidebarActiveForMapMode() {
        const sidebar = document.querySelector('app-sidebar');
        if (!sidebar) return;

        const wrappers = sidebar.querySelectorAll('app-sidebar-link');
        if (wrappers.length < 3) return;

        const submitLink = wrappers[1].querySelector('a.sidebar-link');
        const mapLink = wrappers[2].querySelector('a.sidebar-link');

        if (!submitLink || !mapLink) return;

        submitLink.classList.remove('sidebar-link--active');
        mapLink.classList.add('sidebar-link--active');
    }

    function removeSidenavPaddingForMapPage() {
        const sidenavContent = document.querySelector('mat-sidenav-content');
        if (sidenavContent) {
            sidenavContent.classList.remove('p-4');
        }
    }

    function restoreSidenavPadding() {
        const sidenavContent = document.querySelector('mat-sidenav-content');
        if (sidenavContent && !sidenavContent.classList.contains('p-4')) {
            sidenavContent.classList.add('p-4');
        }
    }

    function restoreScrolling() {
        let node = document.querySelector('mat-sidenav-content');
        while (node && node !== document.body) {
            if (node instanceof HTMLElement) {
                if (node.style.overflowY === 'hidden') {
                    node.style.overflowY = ''; // remove inline override
                }
            }
            node = node.parentElement;
        }
    }

    function restoreWidthLimiter() {
        const limiter = document.querySelector('[data-wf-removed-max-width="1"]');
        if (limiter) {
            limiter.classList.add('max-w-7xl');
            delete limiter.dataset.wfRemovedMaxWidth;
        }
    }

    function applySidenavPaddingForCurrentRoute() {
        const fromMap = sessionStorage.getItem('wf_map_nav') === '1';
        const onMapPage = location.pathname === '/new/submit/new';

        if (fromMap && onMapPage) {
            removeSidenavPaddingForMapPage();
        } else {
            restoreSidenavPadding();
            restoreScrolling();
            restoreWidthLimiter();

            // Clean up resize listener when leaving map mode
            if (wfMapResizeListenerAttached) {
                window.removeEventListener('resize', resizeSubmitMapToViewport);
                wfMapResizeListenerAttached = false;
            }
        }
    }

    function initSidenavPaddingRouteWatcher() {
        if (window._wfmapmodsSidenavPaddingWatcherInitialised) return;
        window._wfmapmodsSidenavPaddingWatcherInitialised = true;

        // React to back/forward and any manual popstate dispatches
        window.addEventListener('popstate', () => {
            applySidenavPaddingForCurrentRoute();
        });

        // Wrap history.pushState so any SPA navigation is noticed too
        const origPushState = history.pushState;
        history.pushState = function (...args) {
            const ret = origPushState.apply(this, args);
            // Apply after the URL/path has actually changed
            setTimeout(applySidenavPaddingForCurrentRoute, 0);
            return ret;
        };

        // Initial pass for the current route
        applySidenavPaddingForCurrentRoute();
    }

    async function resizeSubmitMapToViewport() {
        let mapContainer;

        try {
            mapContainer = await awaitElement(() =>
                                              document.querySelector('.submit-wayspot-map-container')
                                             );
        } catch (err) {
            console.warn("Wayfarer Map: Map container not found:", err);
            return;
        }

        function adjustHeight() {
            const rect = mapContainer.getBoundingClientRect();
            const offsetTop = rect.top;

            // Remaining vertical space
            let targetHeight = window.innerHeight - offsetTop; // margin
            if (targetHeight < 200) targetHeight = 200;

            mapContainer.style.height = targetHeight + 'px';
        }

        // Adjust immediately
        adjustHeight();
    }

    // ==================================
    // Layers button
    // ==================================

    function ensureLayersControl() {
        if (!submitMap || typeof google === "undefined" || !google.maps) return;

        // If our old control was attached to a stale map, forget it
        if (layersControlEl && !document.body.contains(layersControlEl)) {
            layersControlEl = null;
            wayspotsLayerCheckboxEl = null;
        }

        const mapDiv = submitMap.getDiv();
        if (!mapDiv) return;

        // Make sure the map container can host absolutely positioned children
        const currentPos = window.getComputedStyle(mapDiv).position;
        if (currentPos === "static" || !currentPos) {
            mapDiv.style.position = "relative";
        }

        const wayspotsEnabled = isWayspotsLayerEnabled();

        if (!layersControlEl) {
            const root = document.createElement("div");
            root.id = "wfmapmods-layers-control";
            root.className = "wfmapmods-layers-root";

            Object.assign(root.style, {
                position: "absolute",
                top: "10px",
                zIndex: "1100"
                // 'right' is set by updateLayersControlPosition()
            });

            // Toggle button
            const button = document.createElement("button");
            button.type = "button";
            button.className = "wfmapmods-layers-toggle";
            button.setAttribute("aria-label", "Map layers");

            // Your SVG icon (scaled with CSS)
            button.innerHTML = `
            <span class="wfmapmods-layers-icon" aria-hidden="true">
                <svg viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg" focusable="false">
                    <path d="M0.682 9.431l14.847 8.085c0.149 0.081 0.313 0.122 0.479 0.122 0.163 0 0.326-0.040 0.474-0.12l15.003-8.085c0.327-0.176 0.53-0.52 0.525-0.892s-0.216-0.711-0.547-0.88l-14.848-7.54c-0.283-0.143-0.617-0.144-0.902-0.002l-15.002 7.54c-0.332 0.167-0.545 0.505-0.551 0.877s0.196 0.717 0.521 0.895zM16.161 2.134l12.692 6.446-12.843 6.921-12.693-6.912zM31.292 15.010l-2.968-1.507-2.142 1.155 2.5 1.27-12.842 6.921-12.694-6.912 2.666-1.34-2.136-1.164-3.135 1.575c-0.332 0.167-0.545 0.505-0.551 0.877s0.196 0.717 0.521 0.895l14.847 8.085c0.149 0.081 0.313 0.122 0.479 0.122 0.163 0 0.326-0.040 0.474-0.12l15.003-8.085c0.327-0.176 0.53-0.52 0.525-0.892s-0.215-0.711-0.546-0.88zM31.292 22.010l-2.811-1.382-2.142 1.155 2.344 1.145-12.843 6.921-12.694-6.912 2.478-1.121-2.136-1.164-2.947 1.357c-0.332 0.167-0.545 0.505-0.551 0.877s0.196 0.717 0.521 0.895l14.847 8.085c0.149 0.081 0.313 0.122 0.479 0.122 0.163 0 0.326-0.040 0.475-0.12l15.003-8.085c0.327-0.176 0.53-0.52 0.525-0.892-0.005-0.373-0.215-0.712-0.546-0.88z"></path>
                </svg>
            </span>
        `;

            // Menu container (overlays where the button was)
            const menu = document.createElement("div");
            menu.className = "wfmapmods-layers-menu";

            // Wayspots checkbox row
            const wayspotLabel = document.createElement("label");
            wayspotLabel.className = "wfmapmods-layers-option";

            const chk = document.createElement("input");
            chk.type = "checkbox";
            chk.className = "wfmapmods-layers-checkbox";
            chk.checked = wayspotsEnabled;

            const textSpan = document.createElement("span");
            textSpan.className = "wfmapmods-layers-label";
            textSpan.textContent = "Wayspots";

            wayspotLabel.appendChild(chk);
            wayspotLabel.appendChild(textSpan);
            menu.appendChild(wayspotLabel);

            // Draft submissions checkbox row
            const draftsEnabled = isDraftLayerEnabled();

            const draftsLabel = document.createElement("label");
            draftsLabel.className = "wfmapmods-layers-option";

            const draftsChk = document.createElement("input");
            draftsChk.type = "checkbox";
            draftsChk.className = "wfmapmods-layers-checkbox";
            draftsChk.checked = draftsEnabled;

            const draftsTextSpan = document.createElement("span");
            draftsTextSpan.className = "wfmapmods-layers-label";
            draftsTextSpan.textContent = "Draft submissions";

            draftsLabel.appendChild(draftsChk);
            draftsLabel.appendChild(draftsTextSpan);
            menu.appendChild(draftsLabel);

            root.appendChild(button);
            root.appendChild(menu);
            mapDiv.appendChild(root);

            layersControlEl = root;
            wayspotsLayerCheckboxEl = chk;
            draftSubmissionsLayerCheckboxEl = draftsChk;

            // Hover (mouse) and click (touch) behaviour
            let menuOpen = false;

            function setMenuOpen(open) {
                menuOpen = open;
                if (open) {
                    root.classList.add("wfmapmods-layers-open");
                } else {
                    root.classList.remove("wfmapmods-layers-open");
                }
            }

            // Hover for pointer devices
            root.addEventListener("mouseenter", () => setMenuOpen(true));
            root.addEventListener("mouseleave", () => setMenuOpen(false));

            // Click for touch / explicit toggle
            button.addEventListener("click", (e) => {
                e.stopPropagation();
                setMenuOpen(!menuOpen);
            });

            document.addEventListener("click", (e) => {
                if (!root.contains(e.target)) {
                    setMenuOpen(false);
                }
            });

            // Checkbox change handler (Wayspots)
            chk.addEventListener("change", () => {
                if (!userSettings.layers) userSettings.layers = {};
                if (!userSettings.layers.wayspots) userSettings.layers.wayspots = {};
                userSettings.layers.wayspots.enabled = !!chk.checked;

                applyWayspotVisibilityToAllMarkers();
                saveSettings();
            });

            // Checkbox change handler (Drafts)
            draftsChk.addEventListener("change", () => {
                if (!userSettings.layers) userSettings.layers = {};
                if (!userSettings.layers.drafts) userSettings.layers.drafts = {};
                userSettings.layers.drafts.enabled = !!draftsChk.checked;

                applyDraftVisibilityToAllMarkers();
                saveSettings();
            });

            // Initial positioning with sidebar state
            updateLayersControlPosition();
        } else {
            // Control already exists; just sync checkbox + position
            if (wayspotsLayerCheckboxEl) {
                wayspotsLayerCheckboxEl.checked = wayspotsEnabled;
            }
            if (draftSubmissionsLayerCheckboxEl) {
                draftSubmissionsLayerCheckboxEl.checked = isDraftLayerEnabled();
            }
            updateLayersControlPosition();
        }
    }

    function isDraftLayerEnabled() {
        const layers = (userSettings && userSettings.layers) || {};
        const draftsLayer = layers.drafts || {};
        // Default to ON if not explicitly disabled
        return draftsLayer.enabled !== false;
    }

    function applyDraftVisibilityToAllMarkers() {
        const enabled = isDraftLayerEnabled();
        if (!Array.isArray(draftMarkers)) return;

        draftMarkers.forEach(m => {
            if (m && typeof m.setVisible === "function") {
                m.setVisible(enabled);
            }
        });
    }

    function isWayspotsLayerEnabled() {
        const layers = userSettings.layers;
        return layers.wayspots.enabled;
    }

    function applyWayspotVisibilityToMarkerEntry(entry) {
        if (!entry || !entry.marker) return;
        const enabled = isWayspotsLayerEnabled();
        entry.marker.setMap(enabled ? submitMap : null);
    }

    function applyWayspotVisibilityToAllMarkers() {
        if (!submitMap) return;
        for (const guid in markersByGuid) {
            applyWayspotVisibilityToMarkerEntry(markersByGuid[guid]);
        }
    }

    // ==================================
    // Side panel UI (search, details, commands, settings)
    // ==================================

    function ensureSidePanel() {
        if (!submitMap || typeof google === "undefined" || !google.maps) return;

        const mapDiv = submitMap.getDiv();
        if (!mapDiv) return;

        // Make sure the map container can host absolutely positioned children
        const currentPos = window.getComputedStyle(mapDiv).position;
        if (currentPos === "static" || !currentPos) {
            mapDiv.style.position = "relative";
        }

        if (!sidePanelEl) {
            const panel = document.createElement("div");
            panel.id = "wfmapmods-side-panel";
            panel.className = "wfmapmods-sidepanel-root";

            Object.assign(panel.style, {
                position: "absolute",
                top: "10px",
                right: "10px",
                width: "300px",
                maxWidth: "calc(100% - 40px)",
                height: "calc(100% - 20px)",
                background: "rgba(255, 255, 255, 0.95)",
                color: "#111827",
                borderRadius: "8px",
                boxShadow: "0 2px 8px rgba(0,0,0,0.35)",
                zIndex: "1000",
                display: "flex",
                flexDirection: "column",
                overflow: "visible",
                boxSizing: "border-box",
                fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
            });

            // --- Collapsible toggle tab on left edge ---
            const toggleTab = document.createElement("button");
            toggleTab.id = "wfmapmods-sidepanel-toggle";
            toggleTab.type = "button";
            // text will be set by applySidePanelCollapseState()
            toggleTab.textContent = "▶";

            toggleTab.addEventListener("click", () => {
                sidePanelCollapsed = !sidePanelCollapsed;
                applySidePanelCollapseState();
            });

            panel.appendChild(toggleTab);

            // ===== Scrollable content (everything inside panel) =====
            const content = document.createElement("div");
            content.className = "wfmapmods-sidepanel-content";
            Object.assign(content.style, {
                flex: "1",
                padding: "0",
                fontSize: "13px",
                overflowY: "auto",
                display: "flex",
                flexDirection: "column",
                gap: "0",
            });

            // ==============================
            // SECTION 1: Search bar
            // ==============================
            const searchSection = document.createElement("section");
            searchSection.className = "wfmapmods-section wfmapmods-section-search";

            // Container that visually looks like one input
            const searchBox = document.createElement("div");
            searchBox.id = "searchbox";
            Object.assign(searchBox.style, {
                display: "flex",
                alignItems: "center",
                gap: "4px",
                background: "#e5e7eb", // slightly darker than panel
                borderRadius: "6px",
                border: "1px solid #d1d5db",
                padding: "2px 4px",
                boxSizing: "border-box",
            });

            /** SEARCH ICON **/
            const searchIconWrapper = document.createElement("div");
            searchIconWrapper.id = "searchicon";
            Object.assign(searchIconWrapper.style, {
                flex: "0 0 auto",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
            });

            const searchIconImg = document.createElement("img");
            searchIconImg.alt = "Search";
            searchIconImg.src = "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIGhlaWdodD0iMjRweCIgdmlld0JveD0iMCAtOTYwIDk2MCA5NjAiIHdpZHRoPSIyNHB4IiBmaWxsPSIjMTcxNzE3Ij48cGF0aCBkPSJNNzg0LTEyMCA1MzItMzcycS0zMCAyNC02OSAzOHQtODMgMTRxLTEwOSAwLTE4NC41LTc1LjVUMTIwLTU4MHEwLTEwOSA3NS41LTE4NC41VDM4MC04NDBxMTA5IDAgMTg0LjUgNzUuNVQ2NDAtNTgwcTAgNDQtMTQgODN0LTM4IDY5bDI1MiAyNTItNTYgNTZaTTM4MC00MDBxNzUgMCAxMjcuNS01Mi41VDU2MC01ODBxMC03NS01Mi41LTEyNy41VDM4MC03NjBxLTc1IDAtMTI3LjUgNTIuNVQyMDAtNTgwcTAgNzUgNTIuNSAxMjcuNVQzODAtNDAwWiIvPjwvc3ZnPg==";
            Object.assign(searchIconImg.style, {
                width: "20px",
                height: "20px",
            });
            searchIconWrapper.appendChild(searchIconImg);

            /** GEOLOCATION BUTTON **/
            const geoButton = document.createElement("button");
            geoButton.title = "Current location";
            geoButton.id = "buttongeolocation";
            geoButton.type = "button";
            Object.assign(geoButton.style, {
                flex: "0 0 auto",
                border: "none",
                padding: "0",
                margin: "0",
                background: "none",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
            });

            const geoIconImg = document.createElement("img");
            geoIconImg.alt = "Current location";
            geoIconImg.src = "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIGhlaWdodD0iMjRweCIgdmlld0JveD0iMCAtOTYwIDk2MCA5NjAiIHdpZHRoPSIyNHB4IiBmaWxsPSIjMTcxNzE3Ij48cGF0aCBkPSJNNDQwLTQydi04MHEtMTI1LTE0LTIxNC41LTEwMy41VDEyMi00NDBINDJ2LTgwaDgwcTE0LTEyNSAxMDMuNS0yMTQuNVQ0NDAtODM4di04MGg4MHY4MHExMjUgMTQgMjE0LjUgMTAzLjVUODM4LTUyMGg4MHY4MGgtODBxLTE0IDEyNS0xMDMuNSAyMTQuNVQ1MjAtMTIydjgwaC04MFptNDAtMTU4cTExNiAwIDE5OC04MnQ4Mi0xOThxMC0xMTYtODItMTk4dC0xOTgtODJxLTExNiAwLTE5OCA4MnQtODIgMTk4cTAgMTE2IDgyIDE5OHQxOTggODJabTAtMTIwcS02NiAwLTExMy00N3QtNDctMTEzcTAtNjYgNDctMTEzdDExMy00N3E2NiAwIDExMyA0N3Q0NyAxMTNxMCA2Ni00NyAxMTN0LTExMyA0N1ptMC04MHEzMyAwIDU2LjUtMjMuNVQ1NjAtNDgwcTAtMzMtMjMuNS01Ni41VDQ4MC01NjBxLTMzIDAtNTYuNSAyMy41VDQwMC00ODBxMCAzMyAyMy41IDU2LjVUNDgwLTQwMFptMC04MFoiLz48L3N2Zz4=";
            Object.assign(geoIconImg.style, {
                width: "20px",
                height: "20px",
            });
            geoButton.appendChild(geoIconImg);

            /** INPUT **/
            const searchInput = document.createElement("input");
            searchInput.id = "wfmapmods-search-input";
            searchInput.type = "search";
            searchInput.placeholder = "Search location…";
            Object.assign(searchInput.style, {
                flex: "1 1 auto",
                fontSize: "12px",
                border: "none", // no separate border
                outline: "none",
                background: "transparent", // blends with container background
                padding: "0 2px", // minimal left/right padding
                minWidth: "0", // prevent overflow in flex
            });

            // ----- Behaviour wiring -----
            searchInput.addEventListener("keydown", (ev) => {
                if (ev.key === "Enter") {
                    ev.preventDefault();
                    if (typeof handleSearchSubmit === "function") {
                        handleSearchSubmit(searchInput.value);
                    }
                } else if (ev.key === "Escape") {
                    searchInput.value = "";
                    searchInput.blur();
                }
            });

            searchIconWrapper.addEventListener("click", () => {
                if (typeof handleSearchSubmit === "function") {
                    handleSearchSubmit(searchInput.value);
                }
            });

            // Geolocation click
            geoButton.addEventListener("click", () => {
                triggerGeolocation(submitMap);
            });

            // Places autocomplete
            if (typeof setupSearchAutocomplete === "function") {
                setupSearchAutocomplete(searchInput);
            }

            // Assemble search box
            searchBox.appendChild(searchIconWrapper);
            searchBox.appendChild(searchInput);
            searchBox.appendChild(geoButton);

            searchSection.appendChild(searchBox);

            // ==============================
            // SECTION 2: Wayspot Details
            // ==============================

            const detailsSection = document.createElement("section");
            detailsSection.className = "wfmapmods-section wfmapmods-section-details";
            detailsSection.style.display = "none"; // hidden until a wayspot is clicked

            const detailsBody = document.createElement("div");
            detailsBody.className = "wfmapmods-section-body wfmapmods-section-details-body";
            Object.assign(detailsBody.style, {
                display: "flex",
                flexDirection: "column",
                gap: "6px",
            });

            // Title (single line, ellipsis, centred)
            const titleValue = document.createElement("div");
            titleValue.className = "wfmapmods-detail-value wfmapmods-detail-title";
            Object.assign(titleValue.style, {
                fontSize: "15px",
                fontWeight: "600",
                color: "#111827",
                minHeight: "18px",
                textAlign: "center",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
            });
            titleValue.textContent = "";

            // Image box – circular 200x200, clipped, with blue border
            const imageBox = document.createElement("div");
            imageBox.className = "wfmapmods-detail-image-box";
            Object.assign(imageBox.style, {
                width: "200px",
                height: "200px",
                borderRadius: "50%",
                border: "10px solid #154aab",
                background: "#e5e7eb",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#9ca3af",
                fontSize: "12px",
                overflow: "hidden",
                alignSelf: "center",
            });

            const imagePlaceholder = document.createElement("div");
            imagePlaceholder.className = "wfmapmods-detail-image-placeholder";
            imagePlaceholder.textContent = "No image selected";
            imageBox.appendChild(imagePlaceholder);

            // Coordinates – mimic wf-copy-coords style
            const coordsValue = document.createElement("div");
            coordsValue.className = "wfmapmods-detail-value wfmapmods-detail-coords";
            Object.assign(coordsValue.style, {
                fontFamily: "Roboto, Arial, sans-serif",
                fontSize: "12px",
                fontWeight: "300",
                color: "#737373",
                minHeight: "14px",
                textAlign: "center",
                cursor: "pointer",
                textDecoration: "none",
                fontFeatureSettings: "normal",
                fontVariantNumeric: "normal",
            });
            coordsValue.textContent = "";

            // Status row (logo + status tag)
            const statusValue = document.createElement("div");
            statusValue.className = "wfmapmods-detail-status";
            Object.assign(statusValue.style, {
                minHeight: "18px",
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
            });

            // Inner row so we can control left/right content
            const statusRow = document.createElement("div");
            statusRow.className = "wfmapmods-detail-status-row";
            Object.assign(statusRow.style, {
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
            });

            // POI source/logo container (for use by other scripts)
            const poiSourceContainer = document.createElement("div");
            poiSourceContainer.className = "wfmapmods-detail-poi-source";
            Object.assign(poiSourceContainer.style, {
                alignItems: "center",
                justifyContent: "center",
                marginRight: "6px",
                height: "24px",
                width: "auto",
                boxSizing: "content-box",
                display: "none"
            });

            const statusTagContainer = document.createElement("div");
            statusTagContainer.className = "wfmapmods-detail-status-tag-container";
            Object.assign(statusTagContainer.style, {
                display: "flex",
                alignItems: "center",
            });

            statusRow.appendChild(poiSourceContainer);
            statusRow.appendChild(statusTagContainer);
            statusValue.appendChild(statusRow);

            detailsBody.appendChild(titleValue);
            detailsBody.appendChild(imageBox);
            detailsBody.appendChild(coordsValue);
            detailsBody.appendChild(statusValue);
            detailsSection.appendChild(detailsBody);

            // Divider between search/details and commands/settings
            const divider1 = document.createElement("div");
            divider1.className = "wfmapmods-section-divider wfmapmods-section-divider-details wfmapmods-divider-1";
            Object.assign(divider1.style, {
                borderTop: "1px solid #e5e7eb",
                margin: "4px 0",
            });

            const divider2 = document.createElement("div");
            divider2.className = "wfmapmods-section-divider wfmapmods-divider-2";
            Object.assign(divider2.style, {
                borderTop: "1px solid #e5e7eb",
                margin: "4px 0",
            });

            const divider3 = document.createElement("div");
            divider3.className = "wfmapmods-section-divider wfmapmods-divider-3";
            Object.assign(divider3.style, {
                borderTop: "1px solid #e5e7eb",
                margin: "4px 0",
            });

            // ==============================
            // SECTION 3: Wayspot Function Links
            // ==============================

            const parser = new DOMParser();

            const poiFunctionsSection = document.createElement("section");
            poiFunctionsSection.className = "wfmapmods-section wfmapmods-section-poi-functions";
            poiFunctionsSection.style.display = "none"; // hidden until POI is selected

            // Single row containing wayspot icon + links
            const poiFunctionsRow = document.createElement("div");
            Object.assign(poiFunctionsRow.style, {
                display: "flex",
                alignItems: "center",
                gap: "6px",
                padding: "4px 4px 0 4px",
                fontSize: "12px",
                fontWeight: "600",
                color: "#374151"
            });

            // Wayspot icon SVG (recolour fill to #fb4c21)
            const wayspotSvg = parser.parseFromString(WAYFARER_LOGO_SVG, "image/svg+xml").documentElement;
            wayspotSvg.setAttribute("width", "16");
            wayspotSvg.setAttribute("height", "24");
            wayspotSvg.setAttribute("aria-hidden", "true");

            // ensure the path fill is our desired colour
            const wayspotPath = wayspotSvg.querySelector("path");
            if (wayspotPath) {
                wayspotPath.setAttribute("fill", "#fb4c21");
            }

            // Container for links (shared with settings styling)
            const poiFunctionLinks = document.createElement("div");
            poiFunctionLinks.className = "wfmapmods-link-block wfmapmods-poi-function-links";
            poiFunctionLinks.style.gap = "8px"; // match location section spacing a bit

            // --- Deep link (hidden until a POI is selected) ---
            const deepLinkA = document.createElement("a");
            deepLinkA.href = "#";
            deepLinkA.style.display = "none"; // becomes visible on selection
            deepLinkA.textContent = "Wayspot link";

            deepLinkA.addEventListener("click", (ev) => {
                ev.preventDefault();
                const url = deepLinkA.dataset.link;
                if (!url) return;

                navigator.clipboard?.writeText(url).catch(() => {});

                const original = deepLinkA.textContent;
                deepLinkA.textContent = "Copied!";
                setTimeout(() => {
                    deepLinkA.textContent = original;
                }, 1200);
            });

            // Assemble: [wayspot icon][links...]
            poiFunctionLinks.appendChild(deepLinkA);
            poiFunctionsRow.appendChild(wayspotSvg);
            poiFunctionsRow.appendChild(poiFunctionLinks);
            poiFunctionsSection.appendChild(poiFunctionsRow);


            // ==============================
            // SECTION 4: Location Functions (submission marker)
            // ==============================

            const locationFunctionsSection = document.createElement("section");
            locationFunctionsSection.className = "wfmapmods-section wfmapmods-section-location-functions";

            // Single row containing pin + links
            const locationRow = document.createElement("div");
            Object.assign(locationRow.style, {
                display: "flex",
                alignItems: "center",
                gap: "6px",
                padding: "4px 4px 0 4px",
                fontSize: "12px",
                fontWeight: "600",
                color: "#374151"
            });

            // Pin icon SVG
            const pinIconSvg = parser.parseFromString(SUBMISSION_PIN, "image/svg+xml").documentElement;
            pinIconSvg.setAttribute("width", "14");
            pinIconSvg.setAttribute("height", "21");
            pinIconSvg.setAttribute("aria-hidden", "true");
            const pinIcon = pinIconSvg;

            // Links row (same styling as other link blocks)
            const locationLinksRow = document.createElement("div");
            locationLinksRow.className = "wfmapmods-link-block wfmapmods-location-links";
            locationLinksRow.style.gap = "8px";

            const linkSubmitWayspot = document.createElement("a");
            linkSubmitWayspot.href = "#";
            linkSubmitWayspot.textContent = "Submit";

            const linkCopyCoords = document.createElement("a");
            linkCopyCoords.href = "#";
            linkCopyCoords.textContent = "Copy coords";

            const linkNearby = document.createElement("a");
            linkNearby.href = "#";
            linkNearby.textContent = "Nearby Wayspots";

            locationLinksRow.appendChild(linkSubmitWayspot);
            locationLinksRow.appendChild(linkCopyCoords);
            locationLinksRow.appendChild(linkNearby);

            // Assemble the single row: [pinIcon][links...]
            locationRow.appendChild(pinIcon);
            locationRow.appendChild(locationLinksRow);

            // Put row into the section
            locationFunctionsSection.appendChild(locationRow);

            // Click handlers -> helper functions (defined elsewhere)
            linkSubmitWayspot.addEventListener("click", (ev) => {
                ev.preventDefault();
                handleLocationSubmitWayspotClick();
            });

            linkCopyCoords.addEventListener("click", (ev) => {
                ev.preventDefault();
                handleCopyLocationCoordsClick(linkCopyCoords);
            });

            linkNearby.addEventListener("click", (ev) => {
                ev.preventDefault();
                openNearbyWayspotsModal();
            });

            // ==============================
            // SECTION 5: Settings
            // ==============================

            const settingsSection = document.createElement("section");
            settingsSection.className = "wfmapmods-section wfmapmods-section-settings";

            // Container the links will go inside
            const settingsBody = document.createElement("div");
            settingsBody.className = "wfmapmods-link-block wfmapmods-settings-links";

            // Add the default two links:
            const linkMapOptions = document.createElement("a");
            linkMapOptions.textContent = "Map options";
            linkMapOptions.href = "#";
            settingsBody.appendChild(linkMapOptions);

            const linkMarkers = document.createElement("a");
            linkMarkers.textContent = "Markers";
            linkMarkers.href = "#";
            settingsBody.appendChild(linkMarkers);

            linkMapOptions.addEventListener("click", (e) => {
                e.preventDefault();
                openMapOptionsWindow();
            });

            linkMarkers.addEventListener("click", (e) => {
                e.preventDefault();
                openMarkerSettingsWindow();
            });

            // Append to section
            settingsSection.appendChild(settingsBody);

            content.appendChild(searchSection);
            content.appendChild(detailsSection);
            content.appendChild(divider1);
            content.appendChild(poiFunctionsSection);
            content.appendChild(divider2);
            content.appendChild(locationFunctionsSection);
            content.appendChild(divider3);
            content.appendChild(settingsSection);

            detailsSection.style.padding = "8px 4px";
            locationFunctionsSection.style.padding = "8px 4px";
            poiFunctionsSection.style.padding = "8px 4px";
            settingsSection.style.padding = "8px 4px";

            panel.appendChild(content);
            mapDiv.appendChild(panel);
            sidePanelEl = panel;
            applySidePanelCollapseState();
        } else if (!mapDiv.contains(sidePanelEl)) {
            // Defensive: re-attach if map DOM changed
            mapDiv.appendChild(sidePanelEl);
            applySidePanelCollapseState();
        }

        adjustMapControlsForSidePanel();
    }

    function buildStatusTag(statusRaw) {
        const status = (statusRaw || "LIVE").toString().toUpperCase();

        // --- Determine colour variant ---
        let variant = "queue"; // default: grey
        if (status === "ACCEPTED" || status === "LIVE") {
            variant = "accepted"; // green
        } else if (status === "REJECTED" || status === "DUPLICATE") {
            variant = "rejected"; // red
        }

        // --- Determine display label ---
        const label = STATUS_LABELS[status] || status;

        const span = document.createElement("span");
        span.className = `wfmapmods-status-tag wfmapmods-status-tag--${variant}`;
        span.textContent = label;

        return span;
    }

    function updateLayersControlPosition() {
        if (!layersControlEl) return;

        const gap = 10; // px
        const panelWidth = 300; // matches side panel width

        // When panel is expanded, button sits just to the left of it.
        // When collapsed, button hugs the right edge of the map.
        const rightPx = sidePanelCollapsed
        ? gap                      // panel collapsed → near map edge
        : panelWidth + gap * 2;    // panel visible: 10 (panel right) + 300 (width) + 10 (gap) = 320

        layersControlEl.style.right = rightPx + "px";
    }

    function applySidePanelCollapseState() {
        if (!sidePanelEl) return;

        const toggleTab = sidePanelEl.querySelector("#wfmapmods-sidepanel-toggle");

        if (sidePanelCollapsed) {
            sidePanelEl.classList.add("wfmapmods-sidepanel-collapsed");
            if (toggleTab) toggleTab.textContent = "◀"; // collapsed → arrow points left (open)
        } else {
            sidePanelEl.classList.remove("wfmapmods-sidepanel-collapsed");
            if (toggleTab) toggleTab.textContent = "▶"; // expanded → arrow points right (close)
        }

        // Keep the layers button in sync with sidebar state
        updateLayersControlPosition();
    }

    function adjustMapControlsForSidePanel() {
        if (!submitMap || typeof google === "undefined" || !google.maps) return;

        // Move built-in controls to the left so they don't sit under the panel
        submitMap.setOptions({
            zoomControlOptions: {
                position: google.maps.ControlPosition.LEFT_BOTTOM,
            },
            fullscreenControlOptions: {
                position: google.maps.ControlPosition.LEFT_BOTTOM,
            },
            streetViewControlOptions: {
                position: google.maps.ControlPosition.LEFT_BOTTOM,
            }
        });

        // NOTE: your custom geolocation control is currently added at RIGHT_BOTTOM.
        // With the side panel on the right, that will be underneath the panel.
        // If you want it on the left too, you can change addGeolocationControl
        // to use LEFT_BOTTOM instead of RIGHT_BOTTOM.
    }

    function populateSidePanelFromPoi(poi) {
        if (!poi) return;

        // Make sure the panel exists
        ensureSidePanel();
        if (!sidePanelEl) return;

        const detailsSection      = sidePanelEl.querySelector(".wfmapmods-section-details");
        const poiFunctionsSection = sidePanelEl.querySelector(".wfmapmods-section-poi-functions");
        const divider             = sidePanelEl.querySelector(".wfmapmods-section-divider-details");
        const titleEl             = sidePanelEl.querySelector(".wfmapmods-detail-title");
        const statusEl            = sidePanelEl.querySelector(".wfmapmods-detail-status-tag-container");
        const coordsEl            = sidePanelEl.querySelector(".wfmapmods-detail-coords");
        const imgBox              = sidePanelEl.querySelector(".wfmapmods-detail-image-box");
        const sourceLogoEl        = sidePanelEl.querySelector(".wfmapmods-detail-poi-source");

        // Reveal the details and poi functions sections the first time we have a POI
        if (detailsSection && poiFunctionsSection) {
            detailsSection.style.display = "block";
            poiFunctionsSection.style.display = "block";
        }
        if (divider) {
            divider.style.display = "block";
        }

        // ----- Title -----
        if (titleEl) {
            const title = poi.title
            titleEl.textContent = title;
            titleEl.title = title; // full title on hover
        }

        // ----- Status tag -----
        if (statusEl) {
            const status = poi.status || "LIVE";
            statusEl.innerHTML = ""; // clear any previous tag
            statusEl.appendChild(buildStatusTag(status));
        }

        // ----- Source logo -----
        if (sourceLogoEl) {
            sourceLogoEl.innerHTML = poi.dataSourceLogo;

            if (sourceLogoEl.innerHTML === "") {
                sourceLogoEl.style.display = "none";
            } else {
                sourceLogoEl.title = poi.sourceText;

                Object.assign(sourceLogoEl.style, {
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    width: "24px",
                    height: "24px",
                    flex: "0 0 24px",
                    boxSizing: "content-box",
                    marginRight: "6px"
                });

                const insertedSvg = sourceLogoEl.querySelector("svg");
                if (insertedSvg) {
                    Object.assign(insertedSvg.style, {
                        width: "100%",     // fill the 24×24 box
                        height: "100%",
                        display: "block"
                    });
                }
            }
        }

        // ----- Status + Coordinates -----
        if (coordsEl) {
            const latStr = (typeof poi.lat === "number" && Number.isFinite(poi.lat))
            ? poi.lat.toFixed(6)
            : "--";
            const lngStr = (typeof poi.lng === "number" && Number.isFinite(poi.lng))
            ? poi.lng.toFixed(6)
            : "--";

            coordsEl.textContent = `${latStr}, ${lngStr}`;
            coordsEl.dataset.lat = String(poi.lat ?? "");
            coordsEl.dataset.lng = String(poi.lng ?? "");

            coordsEl.style.cursor = "pointer";
            coordsEl.style.textDecoration = "none";
            coordsEl.style.color = "inherit";
            coordsEl.title = "Click to copy coordinates";

            // Avoid stacking multiple listeners – just overwrite onclick
            coordsEl.onclick = () => {
                const lat = coordsEl.dataset.lat;
                const lng = coordsEl.dataset.lng;
                if (!lat || !lng) return;
                navigator.clipboard?.writeText(`${lat}, ${lng}`).catch(() => {});
            };

            // Build deep link
            if (poi.lat && poi.lng) {
                const url = buildDeepLinkUrl(poi.lat, poi.lng);

                const deepLinkA = sidePanelEl.querySelector(".wfmapmods-poi-function-links a");
                if (deepLinkA) {
                    deepLinkA.dataset.link = url;
                    deepLinkA.style.display = "inline-block";
                    deepLinkA.textContent = "Wayspot link";
                }
            }
        }

        // ----- Image – circular, clipped -----
        if (imgBox) {
            imgBox.innerHTML = "";

            // Always (re)set the border based on latest POI data
            const borderColor = poi.borderColor || "#154AAB";
            imgBox.style.border = `10px solid ${borderColor}`;

            if (poi.imageUrl) {
                const img = document.createElement("img");
                img.className = "wfmapmods-detail-image";
                img.src = poi.imageUrl;

                Object.assign(img.style, {
                    width: "100%",
                    height: "100%",
                    objectFit: "cover",
                    display: "block",
                    cursor: "pointer",
                });

                img.addEventListener("click", () => {
                    openWayspotDetailOverlay(poi);
                });

                imgBox.appendChild(img);
            } else {
                const placeholder = document.createElement("div");
                placeholder.className = "wfmapmods-detail-image-placeholder";
                placeholder.textContent = "No image available";

                Object.assign(placeholder.style, {
                    color: "#9ca3af",
                    fontSize: "12px",
                    textAlign: "center",
                });

                imgBox.appendChild(placeholder);
            }
        }
    }

    // ==================================
    // Side panel location functions (submission marker)
    // ==================================

    function handleLocationSubmitWayspotClick() {
        if (typeof window.currentLat !== "number" || typeof window.currentLng !== "number") {
            alert("Submission marker location is not set yet.");
            return;
        }

        // Use the submission bridge defined in the Base plugin
        const bridge = document.getElementById("wfmapmods-submit-bridge");
        if (!bridge) {
            alert("Submission bridge is not available (Base plug-in submit bridge missing).");
            return;
        }

        const payload = {
            source: "wfmapmods-base-location",
            poi: {
                id: null,
                title: "",
                description: "",
                supportingStatement: "",
                lat: window.currentLat,
                lng: window.currentLng
            },
            images: {
                mainUrl: "",
                supportingUrls: []
            }
        };

        try {
            bridge.setAttribute("data-submission", JSON.stringify(payload));
        } catch (e) {
            console.warn("Wayfarer Map: failed to serialise location submit payload", e, payload);
        }
    }

    function handleCopyLocationCoordsClick(linkEl) {
        if (typeof window.currentLat !== "number" || typeof window.currentLng !== "number") {
            alert("Submission marker location is not set yet.");
            return;
        }

        const text = `${window.currentLat},${window.currentLng}`;

        function showCopiedTemp() {
            if (!linkEl) return;
            const original = linkEl.textContent;
            linkEl.textContent = "Copied!";
            setTimeout(() => {
                linkEl.textContent = original;
            }, 1200);
        }

        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(text)
                .then(showCopiedTemp)
                .catch(() => {
                // Fallback path
                const ta = document.createElement("textarea");
                ta.value = text;
                document.body.appendChild(ta);
                ta.select();
                try {
                    document.execCommand("copy");
                } catch {
                    // ignore
                }
                document.body.removeChild(ta);
                showCopiedTemp();
            });
        } else {
            const ta = document.createElement("textarea");
            ta.value = text;
            document.body.appendChild(ta);
            ta.select();
            try {
                document.execCommand("copy");
            } catch {
                // ignore
            }
            document.body.removeChild(ta);
            showCopiedTemp();
        }
    }

    // ==================================
    // Export nearby Wayspots
    // ==================================

    function openNearbyWayspotsModal() {
        const pois = Array.isArray(window.currentPois) ? window.currentPois : [];

        const lines = pois.map((p) => {
            const title = p.title || "";
            const lat = (typeof p.lat === "number") ? p.lat : Number(p.lat || 0);
            const lng = (typeof p.lng === "number") ? p.lng : Number(p.lng || 0);
            return `"${title}" at ${lat},${lng}`;
        });

        openSettingsModal({
            id: "wfmapmods-nearbywayspots-modal",
            title: "Nearby Wayspots",
            width: 400,
            showFooterButtons: false,
            buildContent(dialog) {

                const section = document.createElement("div");
                section.className = "wfmapmods-modal-section";
                section.style.paddingBottom = "4px";

                // Intro
                const intro = document.createElement("div");
                intro.style.fontSize = "11px";
                intro.style.marginBottom = "6px";
                intro.style.lineHeight = "1.4";
                intro.style.color = "#374151";
                intro.textContent = pois.length
                    ? `Nearby Wayspots relative to the submission marker:`
                : "No Wayspots found near the submission marker.";
                section.appendChild(intro);

                // Textarea
                const textarea = document.createElement("textarea");
                textarea.readOnly = true;
                textarea.style.width = "100%";
                textarea.style.boxSizing = "border-box";
                textarea.style.fontSize = "11px";
                textarea.style.padding = "4px 6px";
                textarea.style.minHeight = "140px";
                textarea.style.resize = "vertical";
                textarea.style.border = "1px solid #d1d5db";
                textarea.style.borderRadius = "4px";
                textarea.value = lines.join("\n");
                section.appendChild(textarea);

                // Export to CSV button (right-aligned)
                const btnRow = document.createElement("div");
                btnRow.style.marginTop = "6px";
                btnRow.style.display = "flex";
                btnRow.style.justifyContent = "flex-end";

                const exportBtn = document.createElement("button");
                exportBtn.type = "button";
                exportBtn.textContent = "Export to CSV";
                exportBtn.className = "wfmapmods-modal-btn";
                exportBtn.style.padding = "4px 10px";
                exportBtn.addEventListener("click", (ev) => {
                    ev.preventDefault();
                    exportNearbyWayspotsCsv();
                });

                btnRow.appendChild(exportBtn);
                section.appendChild(btnRow);

                dialog.appendChild(section);

                return { textarea };
            }
        });
    }



    function escapeCsvField(v) {
        if (v == null) return "";
        const s = String(v);
        if (/[",\n]/.test(s)) {
            return '"' + s.replace(/"/g, '""') + '"';
        }
        return s;
    }

    function exportNearbyWayspotsCsv() {
        const pois = Array.isArray(window.currentPois) ? window.currentPois : [];
        if (!pois.length) {
            alert("No nearby Wayspots are currently loaded.");
            return;
        }

        const rows = [];
        // Header
        rows.push(["guid", "title", "description", "lat", "lng", "imageUrl"]);

        for (const p of pois) {
            rows.push([
                p.guid || "",
                p.title || "",
                p.description || "",
                (typeof p.lat === "number") ? p.lat : (p.lat || ""),
                (typeof p.lng === "number") ? p.lng : (p.lng || ""),
                p.imageUrl || ""
            ]);
        }

        const csv = rows
        .map((r) => r.map(escapeCsvField).join(","))
        .join("\r\n");

        // Add UTF-8 BOM so Excel displays special characters correctly
        const bom = "\uFEFF";
        const blob = new Blob([bom + csv], { type: "text/csv;charset=utf-8" });
        const url = URL.createObjectURL(blob);

        const a = document.createElement("a");
        a.href = url;

        const ts = new Date().toISOString().slice(0, 10);
        a.download = `nearby-wayspots-${ts}.csv`;

        document.body.appendChild(a);
        a.click();

        setTimeout(() => {
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        }, 0);
    }


    // ==================================
    // POI bridge (cross-userscript data bus)
    // ==================================

    function createBridges() {
        startPoiBridgeObserver();
        startSubmissionBridgeObserver();
    }

    function ensurePoiBridgeElement() {
        let el = document.getElementById("wfmapmods-poi-bridge");
        if (!el) {
            el = document.createElement("div");
            el.id = "wfmapmods-poi-bridge";
            el.style.display = "none";
            el.setAttribute("data-wfmapmods-bridge", "1");
            document.body.appendChild(el);
        }
        return el;
    }

    function startPoiBridgeObserver() {
        const bridge = ensurePoiBridgeElement();

        if (poiBridgeObserver) return;

        poiBridgeObserver = new MutationObserver(() => {
            const payloadStr = bridge.getAttribute("data-payload");
            if (!payloadStr) return;

            let payload;
            try {
                payload = JSON.parse(payloadStr);
            } catch (e) {
                console.warn("Wayfarer Map: Failed to parse POI bridge payload:", e, payloadStr);
                return;
            }

            lastBridgePayload = payload;
            handleBridgePoiPayload(payload);
        });

        poiBridgeObserver.observe(bridge, {
            attributes: true,
            attributeFilter: ["data-payload"],
        });
    }

    // Called whenever the bridge gets new POI data (from any userscript)
    function handleBridgePoiPayload(payload) {
        const poi = {
            guid: payload.guid || null,
            id: payload.id || null,
            title: payload.title || "(untitled)",
            description: payload.description || payload.desc || "",
            lat: typeof payload.lat === "number" ? payload.lat : Number(payload.lat),
            lng: typeof payload.lng === "number" ? payload.lng : Number(payload.lng),
            imageUrl: payload.imageUrl || payload.image || "",
            status: payload.status || "",
            source: payload.source || "",
            dataSourceLogo: payload.dataSourceLogo || "",
            dataSourceText: payload.dataSourceText || "",
            borderColor: payload.borderColor || "",
        };

        populateSidePanelFromPoi(poi);
        applyPoiSelectionVisuals(poi);
    }

    function publishPoiToBridge(poi, extra) {
        const bridge = ensurePoiBridgeElement();

        const payload = Object.assign({
            guid: poi.guid,
            title: poi.title,
            description: poi.description,
            lat: poi.lat,
            lng: poi.lng,
            imageUrl: poi.imageUrl,
            status: "LIVE",
            source: "wfmapmods-base",
        },
                                      extra || {}
                                     );

        try {
            bridge.setAttribute("data-payload", JSON.stringify(payload));
        } catch (e) {
            console.warn("Wayfarer Map: Failed to serialise POI for bridge:", e, payload);
        }
    }

    // ==================================
    // Submission bridge (cross-userscript submission bus)
    // ==================================

    const SUBMISSION_BRIDGE_ID = "wfmapmods-submit-bridge";
    let submissionBridgeObserver = null;

    function ensureSubmissionBridgeElement() {
        let el = document.getElementById(SUBMISSION_BRIDGE_ID);
        if (!el) {
            el = document.createElement("div");
            el.id = SUBMISSION_BRIDGE_ID;
            el.style.display = "none";
            el.setAttribute("data-wfmapmods-bridge", "submit");
            document.body.appendChild(el);
        }
        return el;
    }

    function startSubmissionBridgeObserver() {
        const bridge = ensureSubmissionBridgeElement();

        if (submissionBridgeObserver) return;

        submissionBridgeObserver = new MutationObserver(() => {
            const payloadStr = bridge.getAttribute("data-submission");
            if (!payloadStr) return;

            // Clear immediately so new submissions can re-trigger
            bridge.setAttribute("data-submission", "");

            let payload;
            try {
                payload = JSON.parse(payloadStr);
            } catch (e) {
                console.warn("Wayfarer Map: Failed to parse submission bridge payload:", e, payloadStr);
                return;
            }

            handleSubmissionBridgePayload(payload);
        });

        submissionBridgeObserver.observe(bridge, {
            attributes: true,
            attributeFilter: ["data-submission"]
        });
    }

    function handleSubmissionBridgePayload(payload) {
        if (!payload || typeof payload !== "object") return;

        const mode = (payload.mode || "RESUBMIT").toUpperCase();
        const poi = payload.poi || {};
        const images = payload.images || {};

        const submitData = {
            source: payload.source || "",
            poi: {
                id: poi.id || poi.guid || poi.recordId || null,
                title: poi.title || "",
                description: poi.description || poi.desc || "",
                supportingStatement: poi.supportingStatement || poi.statement || "",
                lat: typeof poi.lat === "number" ? poi.lat : (poi.lat != null ? Number(poi.lat) : null),
                lng: typeof poi.lng === "number" ? poi.lng : (poi.lng != null ? Number(poi.lng) : null)
            },
            images: {
                mainUrl: images.mainUrl || poi.imageUrl || poi.imageServingUrl || "",
                supportingUrls: Array.isArray(images.supportingUrls)
                ? images.supportingUrls
                : (images.supportingUrl ? [images.supportingUrl] : [])
            }
        };

        openSubmissionEditModal(submitData);
    }

    // ==================================
    // Submission API helpers
    // ==================================

    function getCookie(name) {
        const match = document.cookie.match(new RegExp("(^|; )" + name + "=([^;]*)"));
        return match ? decodeURIComponent(match[2]) : null;
    }

    function getCsrfToken() {
        return getCookie("XSRF-TOKEN") || "";
    }

    function postJsonWithCsrf(url, bodyObj) {
        return new Promise((resolve, reject) => {
            const xhr = new XMLHttpRequest();
            xhr.open("POST", url, true);
            xhr.withCredentials = true;
            xhr.setRequestHeader("Content-Type", "application/json;charset=UTF-8");

            const csrf = getCsrfToken();
            if (csrf) {
                xhr.setRequestHeader("x-csrf-token", csrf);
            }

            xhr.onload = function () {
                if (xhr.status < 200 || xhr.status >= 300) {
                    return reject(new Error("HTTP " + xhr.status + " for " + url));
                }

                let json = null;
                try {
                    json = JSON.parse(xhr.responseText || "{}");
                } catch (e) {
                    return reject(e);
                }
                resolve(json);
            };

            xhr.onerror = function () {
                reject(new Error("Network error for " + url));
            };

            xhr.send(JSON.stringify(bodyObj));
        });
    }

    function fetchImageBlobForSubmit(url) {
        return new Promise(async (resolve, reject) => {
            if (!url) {
                resolve(null);
                return;
            }

            try {
                const res = await fetch(url, {
                    mode: "cors",
                    credentials: "omit"
                });

                if (!res.ok) {
                    reject(new Error("Image fetch failed: HTTP " + res.status));
                    return;
                }

                const blob = await res.blob();
                resolve(blob);
            } catch (err) {
                console.error("fetchImageBlobForSubmit: fetch() failed for", url, err);
                reject(err);
            }
        });
    }

    function putImageToSignedUrlForSubmit(url, blob) {
        if (!url || !blob) return Promise.resolve();

        return blob.arrayBuffer().then((buf) => {
            return fetch(url, {
                method: "PUT",
                body: buf
                // IMPORTANT: no Content-Type header
            }).then((res) => {
                if (!res.ok) {
                    throw new Error("PUT to signed URL failed: " + res.status);
                }
            });
        });
    }

    async function submitWayspotViaApi(submitData) {
        const { poi, images } = submitData || {};
        if (!poi) return;

        const title = (poi.title || "").trim();
        const description = (poi.description || "").trim();
        const supportingStatement = (poi.supportingStatement || "").trim();
        const lat = poi.lat;
        const lng = poi.lng;

        if (!title || !description || !supportingStatement) {
            alert("Title, description and supporting statement are required.");
            return;
        }
        if (typeof lat !== "number" || typeof lng !== "number" || !Number.isFinite(lat) || !Number.isFinite(lng)) {
            alert("Submission is missing valid coordinates.");
            return;
        }

        // New image model: { main, supporting[] }
        const mainState = images && images.main;
        const supportingStates = images && Array.isArray(images.supporting) ? images.supporting : [];

        if (!mainState) {
            alert("Submission is missing a main image.");
            return;
        }
        if (supportingStates.length < 1 || supportingStates.length > 5) {
            alert("Submission must have between 1 and 5 supporting images.");
            return;
        }

        const confirmText =
              "This will submit a new nomination with the provided details.\n\n" +
              "This will consume one of your available nominations.\n\n" +
              "Do you want to continue?";
        if (!window.confirm(confirmText)) {
            return;
        }

        try {
            // --- Build image blobs (file or URL-based) ---

            async function resolveBlobFromState(state) {
                if (!state) return null;
                if (state.sourceType === "file" && state.file instanceof Blob) {
                    return state.file;
                }
                if (state.url) {
                    return await fetchImageBlobForSubmit(state.url);
                }
                return null;
            }

            const mainBlob = await resolveBlobFromState(mainState);
            if (!mainBlob) {
                alert("Could not load main image data.");
                return;
            }

            const supportingBlobs = [];
            for (const s of supportingStates) {
                const b = await resolveBlobFromState(s);
                if (b) supportingBlobs.push(b);
            }

            // --- Start submission ---
            const startPayload = {
                title,
                description,
                lat,
                lng,
                supportingStatement,
                supportingImageCount: supportingBlobs.length
            };

            const startResp = await postJsonWithCsrf("/api/v1/vault/submit/start", startPayload);

            if (!startResp || startResp.captcha) {
                console.warn("Wayfarer Map: submit/start response has captcha or no JSON", startResp);
                alert("Submit/start failed or requires captcha. Please submit manually.");
                return;
            }

            const result = startResp.result || {};
            const imageUrlMap = result.imageUrlMap || result.uploadUrlMap || {};
            const submissionId = result.submissionId || result.nominationId;

            if (!submissionId) {
                console.warn("Wayfarer Map: No submissionId/nominationId in submit/start result", startResp);
                alert("Submit/start did not return a submissionId.");
                return;
            }

            const mainUploadUrl =
                  imageUrlMap.main ||
                  imageUrlMap.mainImage ||
                  imageUrlMap.image ||
                  null;

            if (!mainUploadUrl) {
                console.warn("Wayfarer Map: No main image URL returned from submit/start", startResp);
                alert("Submit/start did not return main image URL.");
                return;
            }

            // --- Upload main + supporting via signed URLs ---
            await putImageToSignedUrlForSubmit(mainUploadUrl, mainBlob);

            let supportingUploadUrls = [];
            if (Array.isArray(imageUrlMap.supportingImages)) {
                supportingUploadUrls = imageUrlMap.supportingImages;
            } else if (Array.isArray(imageUrlMap.supporting)) {
                supportingUploadUrls = imageUrlMap.supporting;
            } else if (typeof imageUrlMap.supporting === "string") {
                supportingUploadUrls = [imageUrlMap.supporting];
            }

            for (let i = 0; i < supportingBlobs.length; i++) {
                const blob = supportingBlobs[i];
                const url = supportingUploadUrls[i];
                if (!blob || !url) continue;
                await putImageToSignedUrlForSubmit(url, blob);
            }

            // --- Complete submission ---

            const completePayload = submissionId;
            const completeResp = await postJsonWithCsrf(
                "/api/v1/vault/submit/complete?submissionId=" + encodeURIComponent(submissionId),
                completePayload
            );

            if (!completeResp || completeResp.captcha) {
                console.warn("Wayfarer Map: submit/complete response has captcha or no JSON", completeResp);
                alert("Submit/complete failed or requires captcha. Please check the site manually.");
                return;
            }

            if (completeResp.result !== "DONE") {
                console.warn("Wayfarer Map: submit/complete returned non-DONE result", completeResp);
                alert("Submit/complete did not succeed: " + (completeResp.code || completeResp.result));
                return;
            }
            alert("Nomination submitted.");
        } catch (err) {
            console.error("Wayfarer Map: submitWayspotViaApi failed:", err);
            alert("Error while submitting nomination – see console for details.");
        }
    }


    // ==================================
    // Submission interface
    // ==================================

    function wfmapmodsFormatLatLng(lat, lng) {
        if (typeof lat !== "number" || typeof lng !== "number" || !Number.isFinite(lat) || !Number.isFinite(lng)) {
            return "Unknown";
        }
        return lat.toFixed(6) + ", " + lng.toFixed(6);
    }

    function openSubmissionEditModal(submitData) {
        openSettingsModal({
            id: "wfmapmods-submission-edit",
            title: "Submit Wayspot",
            width: 500,
            buildContent(body, okBtn, closeModal) {   // <-- now accepts okBtn, closeModal
                const poi = submitData.poi || {};
                const originalImages = submitData.images || {};

                // imageState: what we will actually submit
                const imageState = {
                    main: null,
                    supporting: []
                };

                // ---- normalise starting lat/lng and push into submitData ----
                let currentLat = (typeof poi.lat === "number" && Number.isFinite(poi.lat))
                ? poi.lat
                : (typeof window.currentLat === "number" ? window.currentLat : null);

                let currentLng = (typeof poi.lng === "number" && Number.isFinite(poi.lng))
                ? poi.lng
                : (typeof window.currentLng === "number" ? window.currentLng : null);

                submitData.poi = submitData.poi || {};
                if (typeof currentLat === "number" && typeof currentLng === "number") {
                    submitData.poi.lat = currentLat;
                    submitData.poi.lng = currentLng;
                }

                // Ensure submitterLocation is set (for distance rules, if used)
                if (typeof getSubmitterLocation === "function") {
                    getSubmitterLocation();
                }

                // --- seed images from URLs OR from saved draft structure ---

                // Case 1: draft-style structure { main, supporting[] }
                if (originalImages.main) {
                    imageState.main = originalImages.main;
                } else if (originalImages.mainUrl) {
                    imageState.main = {
                        sourceType: "url",
                        url: originalImages.mainUrl,
                        file: null
                    };
                }

                if (Array.isArray(originalImages.supporting)) {
                    imageState.supporting = originalImages.supporting.slice();
                } else if (Array.isArray(originalImages.supportingUrls)) {
                    originalImages.supportingUrls.forEach((u) => {
                        if (!u) return;
                        imageState.supporting.push({
                            sourceType: "url",
                            url: u,
                            file: null
                        });
                    });
                }

                const wrapper = document.createElement("div");
                wrapper.style.display = "flex";
                wrapper.style.flexDirection = "column";
                wrapper.style.gap = "8px";
                wrapper.style.fontSize = "13px";

                // Hidden file inputs for main and supporting
                const mainFileInput = document.createElement("input");
                mainFileInput.type = "file";
                mainFileInput.accept = "image/*";
                mainFileInput.style.display = "none";

                const supportingFileInput = document.createElement("input");
                supportingFileInput.type = "file";
                supportingFileInput.accept = "image/*";
                supportingFileInput.style.display = "none";

                wrapper.appendChild(mainFileInput);
                wrapper.appendChild(supportingFileInput);

                // Images container
                const imagesRow = document.createElement("div");
                imagesRow.style.display = "flex";
                imagesRow.style.flexWrap = "wrap";
                imagesRow.style.gap = "8px";
                imagesRow.style.marginBottom = "4px";
                wrapper.appendChild(imagesRow);

                // --- Helpers for images UI ---

                function createImageBlock(labelText, imgObj, onRemove, onChangeClick) {
                    const block = document.createElement("div");
                    block.style.display = "flex";
                    block.style.flexDirection = "column";
                    block.style.alignItems = "center";
                    block.style.fontSize = "11px";
                    block.style.flex = "0 0 auto";
                    block.style.position = "relative";

                    const label = document.createElement("div");
                    label.style.marginBottom = "4px";
                    label.style.fontWeight = "bold";
                    label.textContent = labelText;
                    block.appendChild(label);

                    const thumbWrapper = document.createElement("div");
                    thumbWrapper.style.position = "relative";

                    const img = document.createElement("img");
                    img.src = imgObj.url;
                    img.style.maxWidth = "80px";
                    img.style.maxHeight = "80px";
                    img.style.objectFit = "cover";
                    img.style.borderRadius = "4px";
                    img.style.border = "1px solid rgb(209, 213, 219)";
                    img.style.cursor = onChangeClick ? "pointer" : "default";

                    if (onChangeClick) {
                        img.addEventListener("click", (ev) => {
                            ev.preventDefault();
                            onChangeClick();
                        });
                    }

                    // Remove "X"
                    const removeBtn = document.createElement("button");
                    removeBtn.type = "button";
                    removeBtn.textContent = "×";
                    removeBtn.style.position = "absolute";
                    removeBtn.style.top = "-6px";
                    removeBtn.style.right = "-6px";
                    removeBtn.style.width = "18px";
                    removeBtn.style.height = "18px";
                    removeBtn.style.borderRadius = "50%";
                    removeBtn.style.border = "none";
                    removeBtn.style.background = "rgba(0,0,0,0.7)";
                    removeBtn.style.color = "#fff";
                    removeBtn.style.cursor = "pointer";
                    removeBtn.style.fontSize = "12px";
                    removeBtn.style.lineHeight = "18px";
                    removeBtn.style.padding = "0";

                    removeBtn.addEventListener("click", (ev) => {
                        ev.preventDefault();
                        onRemove();
                    });

                    thumbWrapper.appendChild(img);
                    thumbWrapper.appendChild(removeBtn);
                    block.appendChild(thumbWrapper);

                    return block;
                }

                function createPlaceholderBlock(labelText, onClick) {
                    const block = document.createElement("div");
                    block.style.display = "flex";
                    block.style.flexDirection = "column";
                    block.style.alignItems = "center";
                    block.style.fontSize = "11px";
                    block.style.flex = "0 0 auto";

                    const label = document.createElement("div");
                    label.style.marginBottom = "4px";
                    label.style.fontWeight = "bold";
                    label.textContent = labelText;
                    block.appendChild(label);

                    const box = document.createElement("div");
                    box.style.width = "80px";
                    box.style.height = "80px";
                    box.style.borderRadius = "4px";
                    box.style.border = "1px dashed rgb(209, 213, 219)";
                    box.style.display = "flex";
                    box.style.alignItems = "center";
                    box.style.justifyContent = "center";
                    box.style.cursor = "pointer";
                    box.style.fontSize = "24px";
                    box.style.color = "#9ca3af";
                    box.textContent = "+";

                    box.addEventListener("click", (ev) => {
                        ev.preventDefault();
                        onClick();
                    });

                    block.appendChild(box);
                    return block;
                }

                function renderImages() {
                    imagesRow.innerHTML = "";

                    // Main photo block
                    if (imageState.main) {
                        const mainBlock = createImageBlock(
                            "Main photo",
                            imageState.main,
                            () => {
                                imageState.main = null;
                                renderImages();
                                validate();
                            },
                            () => {
                                // Click main image -> choose new image
                                mainFileInput.click();
                            }
                        );
                        imagesRow.appendChild(mainBlock);
                    } else {
                        const mainPlaceholder = createPlaceholderBlock("Main photo", () => {
                            mainFileInput.click();
                        });
                        imagesRow.appendChild(mainPlaceholder);
                    }

                    // Supporting photo blocks
                    imageState.supporting.forEach((imgObj, idx) => {
                        const supBlock = createImageBlock(
                            "Supporting " + (idx + 1),
                            imgObj,
                            () => {
                                imageState.supporting.splice(idx, 1);
                                renderImages();
                                validate();
                            },
                            null // for now, click doesn't change; remove + add instead
                        );
                        imagesRow.appendChild(supBlock);
                    });

                    // Placeholder for new supporting if < 5
                    if (imageState.supporting.length < 5) {
                        const supPlaceholder = createPlaceholderBlock("Supporting", () => {
                            supportingFileInput.click();
                        });
                        imagesRow.appendChild(supPlaceholder);
                    }
                }

                // File input handlers
                mainFileInput.addEventListener("change", async (ev) => {
                    const file = ev.target.files && ev.target.files[0];
                    if (!file) return;

                    try {
                        const { blob, dataUrl } = await convertFileToJpeg(file);

                        imageState.main = {
                            sourceType: "file",
                            url: dataUrl,  // always JPEG preview
                            file: blob     // always JPEG blob for upload
                        };

                        mainFileInput.value = "";
                        renderImages();
                        validate();
                    } catch (err) {
                        console.error("Main image conversion failed:", err);
                        alert("Could not load image: " + err.message);
                        mainFileInput.value = "";
                    }
                });

                supportingFileInput.addEventListener("change", async (ev) => {
                    const files = ev.target.files;
                    if (!files || !files.length) return;

                    for (let i = 0; i < files.length; i++) {
                        if (imageState.supporting.length >= 5) break;
                        const file = files[i];
                        try {
                            const { blob, dataUrl } = await convertFileToJpeg(file);

                            imageState.supporting.push({
                                sourceType: "file",
                                url: dataUrl,  // always JPEG
                                file: blob     // always JPEG blob
                            });
                        } catch (err) {
                            console.error("Supporting image conversion failed:", err);
                            alert("Could not load one of the images: " + err.message);
                        }
                    }

                    supportingFileInput.value = "";
                    renderImages();
                    validate();
                });

                // Initial render of images
                renderImages();

                // ==========================
                // Location row (lat,lng)
                // ==========================

                const locationRow = document.createElement("div");
                locationRow.style.display = "flex";
                locationRow.style.alignItems = "center";
                locationRow.style.gap = "8px";
                locationRow.style.padding = "4px 0";

                const locationLabel = document.createElement("div");
                locationLabel.style.fontSize = "11px";
                locationLabel.style.fontWeight = "bold";
                locationLabel.textContent = "Location";

                const locationRight = document.createElement("div");
                locationRight.style.display = "flex";
                locationRight.style.alignItems = "center";
                locationRight.style.gap = "6px";

                const locationValue = document.createElement("div");
                locationValue.style.fontSize = "12px";
                locationValue.style.fontWeight = "normal";
                locationValue.style.color = "#374151";
                locationValue.style.fontFamily = "";
                locationValue.textContent = wfmapmodsFormatLatLng(currentLat, currentLng);

                const changeBtn = document.createElement("button");
                changeBtn.type = "button";
                changeBtn.textContent = "Change";
                changeBtn.style.fontSize = "11px";
                changeBtn.style.padding = "2px 6px";
                changeBtn.style.borderRadius = "4px";
                changeBtn.style.border = "1px solid #d1d5db";
                changeBtn.style.background = "#f9fafb";
                changeBtn.style.cursor = "pointer";

                changeBtn.addEventListener("mouseenter", () => {
                    changeBtn.style.background = "#e5e7eb";
                });
                changeBtn.addEventListener("mouseleave", () => {
                    changeBtn.style.background = "#f9fafb";
                });

                // --- Change button behaviour ---
                changeBtn.addEventListener("click", () => {
                    const backdrop = document.getElementById("wfmapmods-submission-edit");
                    if (!backdrop) return;

                    // Starting reference point: either current submitData coords or current window coords
                    const startLat = (typeof submitData.poi.lat === "number" ? submitData.poi.lat : window.currentLat);
                    const startLng = (typeof submitData.poi.lng === "number" ? submitData.poi.lng : window.currentLng);

                    // Hide modal so user can see the map
                    backdrop.style.display = "none";

                    if (currentMapMode === MAP_MODE.MOBILE) {
                        // Explicit “Confirm location” flow on mobile
                        startMobileLocationChange(backdrop, submitData, locationValue, validate);
                    } else {
                        // Keep existing automatic behaviour on desktop
                        startDesktopLocationChange(backdrop, submitData, locationValue, validate, startLat, startLng);
                    }
                });

                locationRight.appendChild(locationValue);
                locationRight.appendChild(changeBtn);

                locationRow.appendChild(locationLabel);
                locationRow.appendChild(locationRight);

                // Insert location row under images, before Title/Description fields
                wrapper.appendChild(locationRow);

                // Warning about distance (hidden by default)
                const distanceWarning = document.createElement("div");
                distanceWarning.style.fontSize = "11px";
                distanceWarning.style.color = "#b91c1c";
                distanceWarning.style.marginTop = "2px";
                distanceWarning.style.display = "none";
                wrapper.appendChild(distanceWarning);

                // --- Helpers for fields with char count ---

                function addLabeledInput(labelText, initialValue, maxLen) {
                    const container = document.createElement("div");
                    container.style.display = "flex";
                    container.style.flexDirection = "column";
                    container.style.gap = "2px";

                    const label = document.createElement("label");
                    label.style.fontSize = "11px";
                    label.style.fontWeight = "bold";
                    label.textContent = labelText;

                    const input = document.createElement("input");
                    input.type = "text";
                    input.value = initialValue || "";
                    if (maxLen) input.maxLength = maxLen;
                    input.style.width = "100%";
                    input.style.boxSizing = "border-box";
                    input.style.fontSize = "12px";
                    input.style.padding = "4px 6px";
                    input.style.border = "1px solid rgb(209, 213, 219)";
                    input.style.borderRadius = "4px";
                    input.style.backgroundColor = "#ffffff";

                    const counter = document.createElement("div");
                    counter.style.fontSize = "10px";
                    counter.style.color = "rgb(107,114,128)";
                    counter.style.textAlign = "right";

                    function updateCounter() {
                        const len = input.value.length;
                        if (maxLen) {
                            counter.textContent = `${len} / ${maxLen}`;
                        } else {
                            counter.textContent = `${len}`;
                        }
                    }
                    updateCounter();

                    input.addEventListener("input", () => {
                        updateCounter();
                        validate();
                    });

                    container.appendChild(label);
                    container.appendChild(input);
                    container.appendChild(counter);

                    wrapper.appendChild(container);
                    return input;
                }

                function addLabeledTextarea(labelText, initialValue, maxLen, rows) {
                    const container = document.createElement("div");
                    container.style.display = "flex";
                    container.style.flexDirection = "column";
                    container.style.gap = "2px";

                    const label = document.createElement("label");
                    label.style.fontSize = "11px";
                    label.style.fontWeight = "bold";
                    label.textContent = labelText;

                    const textarea = document.createElement("textarea");
                    textarea.value = initialValue || "";
                    if (rows) textarea.rows = rows;
                    if (maxLen) textarea.maxLength = maxLen;
                    textarea.style.width = "100%";
                    textarea.style.boxSizing = "border-box";
                    textarea.style.fontSize = "12px";
                    textarea.style.padding = "4px 6px";
                    textarea.style.resize = "vertical";
                    textarea.style.border = "1px solid rgb(209, 213, 219)";
                    textarea.style.borderRadius = "4px";
                    textarea.style.backgroundColor = "#ffffff";

                    const counter = document.createElement("div");
                    counter.style.fontSize = "10px";
                    counter.style.color = "rgb(107,114,128)";
                    counter.style.textAlign = "right";

                    function updateCounter() {
                        const len = textarea.value.length;
                        if (maxLen) {
                            counter.textContent = `${len} / ${maxLen}`;
                        } else {
                            counter.textContent = `${len}`;
                        }
                    }
                    updateCounter();

                    textarea.addEventListener("input", () => {
                        updateCounter();
                        validate();
                    });

                    container.appendChild(label);
                    container.appendChild(textarea);
                    container.appendChild(counter);

                    wrapper.appendChild(container);
                    return textarea;
                }


                // --- Helpers for fields with char count (your existing addLabeledInput/addLabeledTextarea) ---
                const titleMax = 128;
                const descMax = 512;
                const suppMax = 3000;

                const titleInput = addLabeledInput("Title", poi.title || "", titleMax);
                const descInput = addLabeledTextarea("Description", poi.description || "", descMax, 3);
                const suppInput = addLabeledTextarea(
                    "Supporting statement",
                    poi.supportingStatement || "",
                    suppMax,
                    3
                );

                body.appendChild(wrapper);

                function setOkButtonState(enabled) {
                    const backdrop = document.getElementById("wfmapmods-submission-edit");
                    if (!backdrop) return;
                    const okBtn = backdrop.querySelector(".wfmapmods-modal-btn-primary");
                    if (!okBtn) return;
                    okBtn.disabled = !enabled;
                    okBtn.style.opacity = enabled ? "1" : "0.6";
                    okBtn.style.cursor = enabled ? "pointer" : "not-allowed";
                }

                function validate() {
                    const t = titleInput.value.trim();
                    const d = descInput.value.trim();
                    const s = suppInput.value.trim();

                    const hasMain = !!imageState.main;
                    const supportingCount = imageState.supporting.length;

                    const textValid = !!t && !!d && !!s;
                    const imageValid = hasMain && supportingCount >= 1 && supportingCount <= 5;

                    // --- Figure out the marker location ---
                    let markerLat = null;
                    let markerLng = null;

                    if (
                        submitData.poi &&
                        typeof submitData.poi.lat === "number" && Number.isFinite(submitData.poi.lat) &&
                        typeof submitData.poi.lng === "number" && Number.isFinite(submitData.poi.lng)
                    ) {
                        markerLat = submitData.poi.lat;
                        markerLng = submitData.poi.lng;
                    } else if (
                        typeof currentLat === "number" && Number.isFinite(currentLat) &&
                        typeof currentLng === "number" && Number.isFinite(currentLng)
                    ) {
                        // Fallback to initial snapshot if poi hasn't got coords for some reason
                        markerLat = currentLat;
                        markerLng = currentLng;
                    }

                    // --- Distance validity (submitterLocation vs marker) ---
                    let distanceValid = true;
                    let distanceKm = null;

                    if (
                        submitterLocation &&
                        typeof submitterLocation.lat === "number" &&
                        typeof submitterLocation.lng === "number" &&
                        markerLat != null &&
                        markerLng != null
                    ) {
                        const dMeters = distanceMeters(
                            submitterLocation.lat,
                            submitterLocation.lng,
                            markerLat,
                            markerLng
                        );
                        distanceKm = dMeters / 1000;
                        if (dMeters > submitRadius) {
                            distanceValid = false;
                        }
                    }

                    if (!distanceValid && distanceKm != null) {
                        distanceWarning.style.display = "block";
                        distanceWarning.textContent =
                            `Submission disabled: The submission pin is ` +
                            `${distanceKm.toFixed(1)} km from your initial location ` +
                            `(max ${(submitRadius / 1000).toFixed(1)} km).`;
                    } else {
                        distanceWarning.style.display = "none";
                        distanceWarning.textContent = "";
                    }

                    const valid = textValid && imageValid && distanceValid;
                    setOkButtonState(valid);
                }

                setTimeout(validate, 0);

                // Add Save Draft button into footer
                setTimeout(() => {
                    const backdrop = document.getElementById("wfmapmods-submission-edit");
                    if (!backdrop) return;
                    const footer = backdrop.querySelector(".wfmapmods-modal-footer");
                    if (!footer) return;

                    // Save draft button
                    if (!footer.querySelector(".wfmapmods-btn-save-draft")) {
                        const saveBtn = document.createElement("button");
                        saveBtn.type = "button";
                        saveBtn.textContent = "Save draft";
                        saveBtn.className = "wfmapmods-modal-btn wfmapmods-btn-save-draft";

                        footer.insertBefore(saveBtn, footer.firstChild);

                        saveBtn.addEventListener("click", async () => {
                            const title = titleInput.value.trim();
                            const description = descInput.value.trim();
                            const supportingStatement = suppInput.value.trim();

                            let lat = null;
                            let lng = null;

                            if (
                                submitData.poi &&
                                typeof submitData.poi.lat === "number" && Number.isFinite(submitData.poi.lat) &&
                                typeof submitData.poi.lng === "number" && Number.isFinite(submitData.poi.lng)
                            ) {
                                lat = submitData.poi.lat;
                                lng = submitData.poi.lng;
                            } else if (
                                typeof currentLat === "number" && Number.isFinite(currentLat) &&
                                typeof currentLng === "number" && Number.isFinite(currentLng)
                            ) {
                                // Fallback to initial snapshot if poi didn’t get updated for some reason
                                lat = currentLat;
                                lng = currentLng;
                            }

                            if (
                                typeof lat !== "number" || typeof lng !== "number" ||
                                !Number.isFinite(lat) || !Number.isFinite(lng)
                            ) {
                                alert("Cannot save draft: submission is missing a valid location.");
                                return;
                            }

                            const now = Date.now();
                            const draftId = submitData.draftId ||
                                  ("draft-" + now + "-" + Math.random().toString(36).slice(2));

                            submitData.draftId = draftId;

                            const draft = {
                                id: draftId,
                                createdAt: submitData.createdAt || now,
                                updatedAt: now,
                                poi: {
                                    lat,
                                    lng,
                                    title,
                                    description,
                                    supportingStatement
                                },
                                images: {
                                    main: imageState.main || null,
                                    supporting: imageState.supporting.slice()
                                }
                            };

                            await saveDraftSubmissionToIDB(draft);
                            closeModal();
                        });

                    }

                    // Delete draft button (only if opened from a draft)
                    if (submitData.fromDraft && submitData.draftId && !footer.querySelector(".wfmapmods-btn-delete-draft")) {
                        const deleteBtn = document.createElement("button");
                        deleteBtn.type = "button";
                        deleteBtn.textContent = "Delete draft";
                        deleteBtn.className = "wfmapmods-modal-btn wfmapmods-btn-delete-draft";

                        // Place Delete Draft to the left of Save Draft (if present),
                        // or as first child otherwise
                        const firstButton = footer.firstChild;
                        footer.insertBefore(deleteBtn, firstButton || null);

                        deleteBtn.addEventListener("click", async () => {
                            const confirmed = window.confirm("Delete this draft submission?");
                            if (!confirmed) return;

                            await deleteDraftSubmissionFromIDB(submitData.draftId);
                            closeModal();
                        });
                    }
                }, 0);

                // At the end of buildContent you still return ctx as before:
                return {
                    submitData,
                    titleInput,
                    descInput,
                    suppInput,
                    imageState
                };
            },
            onOk(ctx, closeModal) {
                const title = ctx.titleInput.value.trim();
                const description = ctx.descInput.value.trim();
                const supportingStatement = ctx.suppInput.value.trim();

                if (!title || !description || !supportingStatement) {
                    return;
                }

                const hasMain = !!ctx.imageState.main;
                const supportingCount = ctx.imageState.supporting.length;
                if (!hasMain || supportingCount < 1 || supportingCount > 5) {
                    return;
                }

                const merged = Object.assign({}, ctx.submitData);

                merged.poi = Object.assign({}, merged.poi, {
                    title,
                    description,
                    supportingStatement
                });

                merged.images = {
                    main: ctx.imageState.main,
                    supporting: ctx.imageState.supporting
                };

                // If this was a draft, remove it once we submit
                if (merged.draftId) {
                    deleteDraftSubmissionFromIDB(merged.draftId);
                }

                submitWayspotViaApi(merged);
                closeModal();
            }
        });
    }

    function startDesktopLocationChange(backdrop, submitData, locationValue, validate, startLat, startLng) {
        const epsilon = 1e-7;
        const intervalMs = 400;

        const timerId = window.setInterval(() => {
            const modalStillExists = document.getElementById("wfmapmods-submission-edit");
            if (!modalStillExists) {
                // Modal was closed; stop watching.
                window.clearInterval(timerId);
                return;
            }

            const newLat = window.currentLat;
            const newLng = window.currentLng;

            if (typeof newLat !== "number" || typeof newLng !== "number") {
                return;
            }

            const changed =
                  typeof startLat !== "number" ||
                  typeof startLng !== "number" ||
                  Math.abs(newLat - startLat) > epsilon ||
                  Math.abs(newLng - startLng) > epsilon;

            if (changed) {
                window.clearInterval(timerId);

                // Update submitData + local variables used for display
                submitData.poi = submitData.poi || {};
                submitData.poi.lat = newLat;
                submitData.poi.lng = newLng;

                window.currentLat = newLat;
                window.currentLng = newLng;
                locationValue.textContent = wfmapmodsFormatLatLng(newLat, newLng);

                // Show modal again
                backdrop.style.display = "";

                validate();
            }
        }, intervalMs);
    }

    function startMobileLocationChange(backdrop, submitData, locationValue, validate) {
        if (!submitMap || typeof google === "undefined" || !google.maps) {
            // If something is wrong with the map, just re-show the modal and bail
            backdrop.style.display = "";
            return;
        }

        const mapDiv = submitMap.getDiv();
        if (!mapDiv) {
            backdrop.style.display = "";
            return;
        }

        // Hide the side panel so we can see the map
        sidePanelCollapsed = true;
        applySidePanelCollapseState();

        // Remove any existing bar (defensive)
        let bar = document.getElementById("wfmapmods-confirm-location-bar");
        if (bar && bar.parentNode) {
            bar.parentNode.removeChild(bar);
        }

        bar = document.createElement("div");
        bar.id = "wfmapmods-confirm-location-bar";

        Object.assign(bar.style, {
            position: "absolute",
            left: "50%",
            bottom: "16px",
            transform: "translateX(-50%)",
            zIndex: "1200",
            background: "rgba(17, 24, 39, 0.9)",  // dark grey
            color: "#f9fafb",
            padding: "6px 10px",
            borderRadius: "9999px",
            display: "flex",
            alignItems: "center",
            gap: "8px",
            boxShadow: "0 2px 6px rgba(0,0,0,0.4)",
            maxWidth: "calc(100% - 32px)",
            fontSize: "12px",
            boxSizing: "border-box"
        });

        const label = document.createElement("span");
        label.textContent = "Move the map, then tap Confirm location.";
        label.style.flex = "1 1 auto";
        label.style.whiteSpace = "nowrap";
        label.style.overflow = "hidden";
        label.style.textOverflow = "ellipsis";

        const confirmBtn = document.createElement("button");
        confirmBtn.type = "button";
        confirmBtn.textContent = "Confirm";
        Object.assign(confirmBtn.style, {
            fontSize: "11px",
            padding: "4px 8px",
            borderRadius: "9999px",
            border: "none",
            background: "#3b82f6",
            color: "#ffffff",
            cursor: "pointer",
            whiteSpace: "nowrap"
        });

        const cancelBtn = document.createElement("button");
        cancelBtn.type = "button";
        cancelBtn.textContent = "Cancel";
        Object.assign(cancelBtn.style, {
            fontSize: "11px",
            padding: "4px 8px",
            borderRadius: "9999px",
            border: "none",
            background: "#6b7280",
            color: "#ffffff",
            cursor: "pointer",
            whiteSpace: "nowrap"
        });

        bar.appendChild(label);
        bar.appendChild(cancelBtn);
        bar.appendChild(confirmBtn);
        mapDiv.appendChild(bar);

        const cleanup = () => {
            const existing = document.getElementById("wfmapmods-confirm-location-bar");
            if (existing && existing.parentNode) {
                existing.parentNode.removeChild(existing);
            }
        };

        // Cancel = discard changes and reopen modal
        cancelBtn.addEventListener("click", () => {
            cleanup();
            backdrop.style.display = "";
        });

        // Confirm = use currentLat/currentLng at the time of the click
        confirmBtn.addEventListener("click", () => {
            const modalStillExists = document.getElementById("wfmapmods-submission-edit");
            if (!modalStillExists) {
                cleanup();
                return;
            }

            const newLat = window.currentLat;
            const newLng = window.currentLng;

            if (typeof newLat === "number" && typeof newLng === "number") {
                submitData.poi = submitData.poi || {};
                submitData.poi.lat = newLat;
                submitData.poi.lng = newLng;

                window.currentLat = newLat;
                window.currentLng = newLng;
                locationValue.textContent = wfmapmodsFormatLatLng(newLat, newLng);
            }

            cleanup();
            backdrop.style.display = "";
            validate();
        });
    }

    // ================================================
    // Universal Image Conversion: HEIC/PNG/WebP → JPEG
    // ================================================

    function isHeic(file) {
        const type = (file.type || "").toLowerCase();
        const name = (file.name || "").toLowerCase();
        return (
            type === "image/heic" ||
            type === "image/heif" ||
            name.endsWith(".heic") ||
            name.endsWith(".heif")
        );
    }

    function isConvertibleFormat(file) {
        const type = (file.type || "").toLowerCase();
        return (
            isHeic(file) ||
            type === "image/png" ||
            type === "image/webp" ||
            type === "image/jpeg" ||
            type === "image/jpg"
        );
    }

    function blobToDataURL(blob) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = () => reject(new Error("Failed to read blob as dataURL."));
            reader.readAsDataURL(blob);
        });
    }

    function fileToDataURL(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = () => reject(new Error("Failed to read file as dataURL."));
            reader.readAsDataURL(file);
        });
    }

    /**
 * Convert any image File → JPEG Blob + JPEG dataURL
 * HEIC → JPEG (heic2any)
 * PNG/WebP → JPEG (canvas)
 * JPEG → JPEG (no conversion)
 */
    async function convertFileToJpeg(file) {
        if (!file) throw new Error("No file provided.");

        if (!isConvertibleFormat(file)) {
            throw new Error("Unsupported image format. Please use JPG/PNG/WebP/HEIC.");
        }

        const type = (file.type || "").toLowerCase();

        // ================================
        // 1. HEIC / HEIF → JPEG (heic2any)
        // ================================
        if (isHeic(file)) {
            const heic2anyLib =
                  (typeof heic2any === "function" && heic2any) ||
                  (typeof window !== "undefined" &&
                   typeof window.heic2any === "function" &&
                   window.heic2any);

            if (!heic2anyLib) {
                console.error(
                    "[Base] heic2any missing",
                    "heic2any =", typeof heic2any,
                    "window.heic2any =", typeof window !== "undefined" ? typeof window.heic2any : "no-window"
                );
                throw new Error("heic2any library is missing.");
            }

            const resultBlob = await heic2anyLib({
                blob: file,
                toType: "image/jpeg",
                quality: 0.9
            });

            const jpegBlob = Array.isArray(resultBlob) ? resultBlob[0] : resultBlob;
            const dataUrl = await blobToDataURL(jpegBlob);
            return { blob: jpegBlob, dataUrl };
        }


        // ==========================================
        // 2. PNG / WebP → JPEG via canvas conversion
        // ==========================================
        if (type === "image/png" || type === "image/webp") {
            const bitmap = await createImageBitmap(file);

            const canvas = document.createElement("canvas");
            canvas.width = bitmap.width;
            canvas.height = bitmap.height;

            const ctx = canvas.getContext("2d");
            ctx.drawImage(bitmap, 0, 0);

            const jpegBlob = await new Promise((resolve) =>
                                               canvas.toBlob(resolve, "image/jpeg", 0.9)
                                              );

            const dataUrl = await blobToDataURL(jpegBlob);
            return { blob: jpegBlob, dataUrl };
        }

        // ===============================
        // 3. JPEG → JPEG (no conversion)
        // ===============================
        if (type === "image/jpeg" || type === "image/jpg") {
            const dataUrl = await fileToDataURL(file);
            return { blob: file, dataUrl };
        }

        throw new Error("Unhandled file format.");
    }

    // ======================================
    // Draft submission storage (IndexedDB)
    // ======================================
    const DRAFT_STORE_NAME = "draftSubmissions";

    let draftSubmissions = [];
    let draftMarkers = [];

    // Opens an IDB database connection for wayfarer-tools-db, ensuring DRAFT_STORE_NAME exists.
    function getDraftsIDBInstance(version) {
        return new Promise((resolve, reject) => {
            if (!window.indexedDB) {
                reject("This browser doesn't support IndexedDB!");
                return;
            }

            const openRequest = indexedDB.open("wayfarer-tools-db", version);

            openRequest.onsuccess = (event) => {
                const db = event.target.result;
                const dbVer = db.version;
                if (!db.objectStoreNames.contains(DRAFT_STORE_NAME)) {
                    db.close();
                    // Bump version and create store
                    getDraftsIDBInstance(dbVer + 1).then(resolve, reject);
                } else {
                    resolve(db);
                }
            };

            openRequest.onupgradeneeded = (event) => {
                const db = event.target.result;
                if (!db.objectStoreNames.contains(DRAFT_STORE_NAME)) {
                    db.createObjectStore(DRAFT_STORE_NAME, { keyPath: "id" });
                }
            };

            openRequest.onerror = (event) => {
                reject(event.target.error || "Failed to open IndexedDB for drafts");
            };
        });
    }

    // Load all draft submissions into memory + markers
    function loadDraftSubmissionsFromIDB() {
        getDraftsIDBInstance().then(db => {
            const tx = db.transaction(DRAFT_STORE_NAME, "readonly");
            const store = tx.objectStore(DRAFT_STORE_NAME);
            const req = store.getAll();

            req.onsuccess = () => {
                draftSubmissions = req.result || [];
                db.close();
                refreshDraftMarkers();
            };

            req.onerror = () => {
                console.warn("[Base] Failed to load draft submissions from IndexedDB", req.error);
                db.close();
            };
        }).catch(err => {
            console.warn("[Base] IndexedDB not available (load drafts):", err);
        });
    }

    // Upsert a single draft submission
    function saveDraftSubmissionToIDB(draft) {
        if (!draft || !draft.id) return Promise.resolve();

        return getDraftsIDBInstance().then(db => new Promise((resolve, reject) => {
            const tx = db.transaction(DRAFT_STORE_NAME, "readwrite");
            const store = tx.objectStore(DRAFT_STORE_NAME);

            const req = store.put(draft); // upsert by keyPath 'id'

            req.onsuccess = () => {
                // Update in-memory copy too
                const idx = draftSubmissions.findIndex(d => d.id === draft.id);
                if (idx >= 0) {
                    draftSubmissions[idx] = draft;
                } else {
                    draftSubmissions.push(draft);
                }
            };

            req.onerror = () => {
                console.warn("[Base] Failed to save draft submission", req.error);
            };

            tx.oncomplete = () => {
                db.close();
                refreshDraftMarkers();
                resolve();
            };

            tx.onerror = () => {
                console.warn("[Base] Transaction error while saving draft submission", tx.error);
                db.close();
                reject(tx.error);
            };
        })).catch(err => {
            console.warn("[Base] IndexedDB not available (save draft):", err);
        });
    }

    // Delete a draft by id
    function deleteDraftSubmissionFromIDB(id) {
        if (!id) return Promise.resolve();

        return getDraftsIDBInstance().then(db => new Promise((resolve, reject) => {
            const tx = db.transaction(DRAFT_STORE_NAME, "readwrite");
            const store = tx.objectStore(DRAFT_STORE_NAME);

            const req = store.delete(id);

            req.onsuccess = () => {
                draftSubmissions = draftSubmissions.filter(d => d.id !== id);
            };

            req.onerror = () => {
                console.warn("[Base] Failed to delete draft submission", req.error);
            };

            tx.oncomplete = () => {
                db.close();
                refreshDraftMarkers();
                resolve();
            };

            tx.onerror = () => {
                console.warn("[Base] Transaction error while deleting draft submission", tx.error);
                db.close();
                reject(tx.error);
            };
        })).catch(err => {
            console.warn("[Base] IndexedDB not available (delete draft):", err);
        });
    }

    function refreshDraftMarkers() {
        if (!submitMap || typeof google === "undefined" || !google.maps) return;

        // Clear old markers
        draftMarkers.forEach(m => {
            if (m && typeof m.setMap === "function") {
                m.setMap(null);
            }
        });
        draftMarkers = [];

        draftSubmissions.forEach(draft => {
            const poi = draft.poi || {};
            const lat = poi.lat;
            const lng = poi.lng;
            if (typeof lat !== "number" || typeof lng !== "number" || !Number.isFinite(lat) || !Number.isFinite(lng)) {
                return;
            }

            const position = new google.maps.LatLng(lat, lng);

            const marker = new google.maps.Marker({
                position,
                map: submitMap,
                title: poi.title || "Draft nomination",
                optimized: false
                // icon: "data:image/svg+xml;base64,...."
            });

            marker.setVisible(isDraftLayerEnabled());

            marker.addListener("click", () => {
                // 1. Centre the map on this draft
                if (submitMap) {
                    // You can use setCenter or panTo
                    submitMap.setCenter(position);
                    // Optional: also force a zoom level for drafts
                    // submitMap.setZoom(18);
                }

                // 2. Simulate a map click at this location so all your
                //    existing map-click logic runs (pin placement, etc.)
                if (google && google.maps && submitMap) {
                    google.maps.event.trigger(submitMap, "click", {
                        latLng: position
                    });
                }

                // 3. Open the edit modal with this draft’s data
                openSubmissionEditModal({
                    poi: {
                        lat,
                        lng,
                        title: poi.title || "",
                        description: poi.description || "",
                        supportingStatement: poi.supportingStatement || ""
                    },
                    images: draft.images || {},
                    draftId: draft.id,
                    createdAt: draft.createdAt,
                    fromDraft: true
                });
            });

            draftMarkers.push(marker);
        });
    }

    // ==================================
    // Marker selection
    // ==================================

    function applyPoiSelectionVisuals(poi) {
        if (!submitMap || !poi || typeof google === "undefined" || !google.maps) return;

        // ---- Clear previous selection first ----
        clearSelectedMarkers(); // remove magenta class from all thumbnails
        clearGenericMarkerSelection(); // restore original icons for generic markers

        selectedPoiGuid = poi.guid || null;
        lastSelectedPoi = poi; // remember for mode changes

        // ---- Find matching marker (if this plugin created one) ----
        let markerEntry = null;
        if (poi.guid && markersByGuid[poi.guid]) {
            markerEntry = markersByGuid[poi.guid];
        }

        const latLng = new google.maps.LatLng(poi.lat, poi.lng);

        // ---- Highlight marker ----
        if (markerEntry && markerEntry.marker) {
            const marker = markerEntry.marker;

            if (userSettings.poi.markerType === "thumbnail") {
                markMarkerSelectedByMarker(marker, poi);
            } else if (userSettings.poi.markerType === "generic") {
                highlightGenericMarker(marker, poi);
            }
        }

        // ---- Draw 80 m circle around selected POI ----
        updateSelectedPoiCircle(poi.lat, poi.lng);

        // ---- Show InfoWindow ONLY in mobile mode ----
        if (currentMapMode === MAP_MODE.MOBILE) {
            showPoiInfoWindowForSelection(poi, latLng);
        }
    }

    function clearGenericMarkerSelection() {
        if (!genericMarkerOriginalIcons) return;

        Object.keys(genericMarkerOriginalIcons).forEach((guid) => {
            const entry = markersByGuid[guid];
            const originalIcon = genericMarkerOriginalIcons[guid];

            if (entry && entry.marker && originalIcon) {
                entry.marker.setIcon(originalIcon);
            }
        });

        genericMarkerOriginalIcons = {};
    }

    function highlightGenericMarker(marker, poi) {
        if (!marker || !poi) return;

        const guid = poi.guid;
        const currentIcon = marker.getIcon ? marker.getIcon() : null;

        // Remember original icon so we can revert on next selection
        if (guid && currentIcon && !genericMarkerOriginalIcons[guid]) {
            // clone shallowly – icon is a plain object
            genericMarkerOriginalIcons[guid] = Object.assign({}, currentIcon);
        }

        const base = currentIcon || {
            path: google.maps.SymbolPath.CIRCLE,
            scale: 8,
            strokeColor: "#ff6600",
            strokeOpacity: 1,
            strokeWeight: 2,
            fillColor: "#ff6600",
            fillOpacity: 0.5
        };

        // Selected: keep fillColor / fillOpacity (status colouring),
        // only “power up” the border + size.
        const selectedIcon = Object.assign({}, base, {
            strokeColor: "#ff00ff",
            strokeOpacity: 1,
            strokeWeight: (base.strokeWeight || 2) + 2,
            scale: (base.scale || 8) + 1
            // fillColor and fillOpacity are inherited from base unchanged
        });

        marker.setIcon(selectedIcon);
    }

    // ==================================
    // Info Window (Mobile Only)
    // ==================================

    function showPoiInfoWindowForSelection(poi, latLng) {
        if (!submitMap || !poi) return;
        if (currentMapMode !== MAP_MODE.MOBILE) {
            // Only allow InfoWindows in mobile mode
            if (poiInfoWindow) {
                poiInfoWindow.close();
            }
            return;
        }

        if (!poiInfoWindow) {
            poiInfoWindow = new google.maps.InfoWindow();
        }

        poiInfoWindow.setOptions({
            disableAutoPan: true
        });

        poiInfoWindow.setContent(createInfoWindow(poi));

        poiInfoWindow.setPosition(latLng);
        poiInfoWindow.open(submitMap);

        google.maps.event.addListenerOnce(
            poiInfoWindow,
            "domready",
            attachInfoWindowDomHandlers
        );
    }

    function createInfoWindow(poi) {
        const title  = escapeHtml(poi.title);
        const desc   = escapeHtml(poi.description || "");
        const latStr = poi.lat.toFixed(6);
        const lngStr = poi.lng.toFixed(6);

        const iwImgUrl   = poi.imageUrl + "=w240";
        const fullImgUrl = poi.imageUrl + "=s0";

        return `
<div class="agm-info-window-content wfmapmods-iw-root wf-nearby-iw-content">

    <div class="wfmapmods-iw-content">

        <!-- Header -->
        <div class="wfmapmods-iw-header">
            <div class="wfmapmods-iw-title" title="${title}">
                <span
                    class="wfmapmods-iw-copy-title"
                    data-copy="${title.replace(/"/g, '&quot;')}"
                    title="Click to copy title"
                >${title}</span>
            </div>

            <button class="wfmapmods-iw-close" title="Close">×</button>
        </div>

        <!-- Coordinates -->
        <div class="wfmapmods-iw-coords">
            <span
                class="wfmapmods-iw-copy-coords"
                data-lat="${latStr}"
                data-lng="${lngStr}"
                title="Click to copy coordinates"
            >
                ${latStr}, ${lngStr}
            </span>
        </div>

        <!-- Image -->
        <div class="wfmapmods-iw-img-wrapper">
            <a href="${fullImgUrl}" target="_blank" rel="noopener noreferrer" class="wfmapmods-iw-img-link">
                <img src="${iwImgUrl}" alt="${title}" class="wfmapmods-iw-img"/>
            </a>
        </div>

        <!-- Description -->
        <div class="wfmapmods-iw-desc">${desc}</div>

    </div>
</div>`;
    }


    function attachInfoWindowDomHandlers() {
        // ---- Copy Coordinates ----
        const coordEl = document.querySelector(".wfmapmods-iw-copy-coords");
        if (coordEl) {
            coordEl.addEventListener("click", () => {
                const lat = coordEl.getAttribute("data-lat");
                const lng = coordEl.getAttribute("data-lng");
                const coords = `${lat}, ${lng}`;

                if (navigator.clipboard?.writeText) {
                    navigator.clipboard.writeText(coords).catch(err =>
                                                                console.error("Clipboard copy failed:", err)
                                                               );
                } else {
                    window.prompt("Copy to clipboard:", coords);
                }
            }, {
                once: true
            });
        }

        // ---- Copy Title ----
        const titleEl = document.querySelector(".wfmapmods-iw-copy-title");
        if (titleEl) {
            titleEl.addEventListener("click", () => {
                const text = titleEl.getAttribute("data-copy");

                if (navigator.clipboard?.writeText) {
                    navigator.clipboard.writeText(text).catch(err =>
                                                              console.error("Clipboard copy failed:", err)
                                                             );
                } else {
                    window.prompt("Copy to clipboard:", text);
                }
            }, {
                once: true
            });
        }

        // ---- Close button ----
        const closeBtn = document.querySelector(".wfmapmods-iw-close");
        if (closeBtn) {
            closeBtn.addEventListener("click", (e) => {
                e.stopPropagation(); // prevent clicking map behind it
                poiInfoWindow.close();
            }, {
                once: true
            });
        }
    }

    // ==================================
    // Wayspot Details Overlay
    // ==================================

    function openWayspotDetailOverlay(poi) {
        if (!poi || !poi.imageUrl) return;

        // Avoid multiple overlays at once
        const existing = document.getElementById("wfmapmods-wayspot-overlay");
        if (existing) {
            existing.remove();
        }

        const fullImgUrl = poi.imageUrl;
        const title = escapeHtml(poi.title || "(untitled)");
        const desc  = escapeHtml(poi.description || "");

        // Backdrop
        const backdrop = document.createElement("div");
        backdrop.id = "wfmapmods-wayspot-overlay";
        backdrop.className = "wfmapmods-wayspot-overlay-backdrop";

        // Dialog
        const dialog = document.createElement("div");
        dialog.className = "wfmapmods-wayspot-overlay-dialog";

        // Header (title + close)
        const header = document.createElement("div");
        header.className = "wfmapmods-wayspot-overlay-header";

        const titleEl = document.createElement("div");
        titleEl.className = "wfmapmods-wayspot-overlay-title";
        titleEl.textContent = poi.title || "(untitled)";

        const closeBtn = document.createElement("button");
        closeBtn.type = "button";
        closeBtn.className = "wfmapmods-wayspot-overlay-close";
        closeBtn.textContent = "×";
        closeBtn.title = "Close";

        // Title + close button both live in the header
        header.appendChild(titleEl);
        header.appendChild(closeBtn);

        // Header goes once at the top of the dialog
        dialog.appendChild(header);

        // Image (wrapped in link to =s0 in new tab)
        const imageWrapper = document.createElement("a");
        imageWrapper.href = fullImgUrl + "=s0";
        imageWrapper.target = "_blank";
        imageWrapper.rel = "noopener noreferrer";
        imageWrapper.className = "wfmapmods-wayspot-overlay-image-link";

        const imgEl = document.createElement("img");
        imgEl.src = fullImgUrl;
        imgEl.alt = poi.title || "";
        imgEl.className = "wfmapmods-wayspot-overlay-image";

        imageWrapper.appendChild(imgEl);

        // Description
        const descEl = document.createElement("div");
        descEl.className = "wfmapmods-wayspot-overlay-desc";
        descEl.textContent = poi.description || "";

        dialog.appendChild(imageWrapper);
        dialog.appendChild(descEl);
        backdrop.appendChild(dialog);
        document.body.appendChild(backdrop);

        function closeOverlay() {
            if (wayspotOverlayEscHandler) {
                document.removeEventListener("keydown", wayspotOverlayEscHandler);
                wayspotOverlayEscHandler = null;
            }
            backdrop.remove();
        }

        // Close on X
        closeBtn.addEventListener("click", (e) => {
            e.stopPropagation();
            closeOverlay();
        });

        // Close on click-away (clicking the backdrop but not the dialog)
        backdrop.addEventListener("click", (e) => {
            if (e.target === backdrop) {
                closeOverlay();
            }
        });

        // Close on Escape
        wayspotOverlayEscHandler = (ev) => {
            if (ev.key === "Escape") {
                closeOverlay();
            }
        };
        document.addEventListener("keydown", wayspotOverlayEscHandler);
    }

    // ==================================
    // Settings menus
    // ==================================

    function openMapOptionsWindow() {
        const mapCfg = userSettings.map;

        openSettingsModal({
            id: "wfmapmods-mapopt-backdrop",
            title: "Map options",
            buildContent(dialog) {
                // ---- General behaviour ----
                const generalSection = document.createElement("div");
                generalSection.className = "wfmapmods-modal-section";

                const generalHeader = document.createElement("div");
                generalHeader.className = "wfmapmods-modal-section-header";
                generalHeader.textContent = "General behaviour";
                generalSection.appendChild(generalHeader);

                const rememberChk = document.createElement("input");
                rememberChk.type = "checkbox";
                rememberChk.className = "wfmapmods-modal-checkbox";
                rememberChk.checked = !!mapCfg.rememberLastView;
                generalSection.appendChild(
                    createSettingsRow("Remember last map view", rememberChk, {
                        narrowLabel: true
                    })
                );

                dialog.appendChild(generalSection);

                // ---- Circle configs (init from mapCfg) ----
                const nr = mapCfg.nearbyRadius;
                const sr = mapCfg.submitRadius;
                const spr = mapCfg.interactRadius;
                const pr = mapCfg.powerSpotRadius;

                // ---- Circle overlays section with table ----
                const circlesSection = document.createElement("div");
                circlesSection.className = "wfmapmods-modal-section";

                const circlesHeader = document.createElement("div");
                circlesHeader.className = "wfmapmods-modal-section-header";
                circlesHeader.textContent = "Circle overlays";
                circlesSection.appendChild(circlesHeader);

                const table = document.createElement("table");
                table.className = "wfmapmods-circle-table";

                Object.assign(table.style, {
                    width: "100%",
                    borderCollapse: "collapse",
                    fontSize: "11px"
                });

                function makeTH(text) {
                    const th = document.createElement("th");
                    th.textContent = text;
                    th.style.padding = "2px 4px";
                    th.style.textAlign = "center";
                    return th;
                }

                function makeTD() {
                    const td = document.createElement("td");
                    td.style.padding = "2px 4px";
                    td.style.textAlign = "center";
                    return td;
                }

                function styleColorInput(input) {
                    input.className = "wfmapmods-modal-color";
                    input.style.width = "26px";
                    input.style.padding = "0";
                }

                function styleNumericInput(input) {
                    input.className = "wfmapmods-modal-input-small";
                    input.style.textAlign = "center";
                }

                // Header row (columns in order of size)
                // 1) PowerSpot Radius (22m)     – powerSpotRadius
                // 2) Nearby Wayspots (200m)     – nearbyRadius
                // 3) Interaction Radius (80m)   – interactRadius
                // 4) Submission Range (10km)    – submitRadius
                const headerRow = document.createElement("tr");

                const thLabel = makeTH("");
                thLabel.style.textAlign = "left";

                const thPowerSpot = makeTH("Power Spot Radius (22m)");
                const thNearby = makeTH("Nearby Wayspots (200m)");
                const thSelected = makeTH("Interaction Radius (80m)");
                const thSubmit = makeTH(`Submission Range (${submitRadius/1000}km)`);

                headerRow.appendChild(thLabel);
                headerRow.appendChild(thPowerSpot);
                headerRow.appendChild(thNearby);
                headerRow.appendChild(thSelected);
                headerRow.appendChild(thSubmit);
                table.appendChild(headerRow);

                // ---- Row 1: Show / enabled ----
                const rowShow = document.createElement("tr");
                const showLabel = document.createElement("td");
                showLabel.textContent = "Show circle";
                showLabel.style.padding = "2px 4px";
                showLabel.style.whiteSpace = "nowrap";
                rowShow.appendChild(showLabel);

                const powerSpotEnabledChk = document.createElement("input");
                powerSpotEnabledChk.type = "checkbox";
                powerSpotEnabledChk.className = "wfmapmods-modal-checkbox";
                powerSpotEnabledChk.checked = !!pr.enabled;

                const nearbyEnabledChk = document.createElement("input");
                nearbyEnabledChk.type = "checkbox";
                nearbyEnabledChk.className = "wfmapmods-modal-checkbox";
                nearbyEnabledChk.checked = !!nr.enabled;

                const selectedEnabledChk = document.createElement("input");
                selectedEnabledChk.type = "checkbox";
                selectedEnabledChk.className = "wfmapmods-modal-checkbox";
                selectedEnabledChk.checked = !!spr.enabled;

                const submitEnabledChk = document.createElement("input");
                submitEnabledChk.type = "checkbox";
                submitEnabledChk.className = "wfmapmods-modal-checkbox";
                submitEnabledChk.checked = !!sr.enabled;

                const tdShowPowerSpot = makeTD();
                const tdShowNearby = makeTD();
                const tdShowSelected = makeTD();
                const tdShowSubmit = makeTD();

                tdShowPowerSpot.appendChild(powerSpotEnabledChk);
                tdShowNearby.appendChild(nearbyEnabledChk);
                tdShowSelected.appendChild(selectedEnabledChk);
                tdShowSubmit.appendChild(submitEnabledChk);

                rowShow.appendChild(tdShowPowerSpot);
                rowShow.appendChild(tdShowNearby);
                rowShow.appendChild(tdShowSelected);
                rowShow.appendChild(tdShowSubmit);
                table.appendChild(rowShow);

                // ---- Row 2: Line colour ----
                const rowLineColor = document.createElement("tr");
                const lineColorLabel = document.createElement("td");
                lineColorLabel.textContent = "Line colour";
                lineColorLabel.style.padding = "2px 4px";
                lineColorLabel.style.whiteSpace = "nowrap";
                rowLineColor.appendChild(lineColorLabel);

                const powerSpotStrokeColorInput = document.createElement("input");
                powerSpotStrokeColorInput.type = "color";
                powerSpotStrokeColorInput.value = pr.strokeColor || "#ffffff";
                styleColorInput(powerSpotStrokeColorInput);

                const nearbyStrokeColorInput = document.createElement("input");
                nearbyStrokeColorInput.type = "color";
                nearbyStrokeColorInput.value = nr.strokeColor || "#4285F4";
                styleColorInput(nearbyStrokeColorInput);

                const selectedStrokeColorInput = document.createElement("input");
                selectedStrokeColorInput.type = "color";
                selectedStrokeColorInput.value = spr.strokeColor || "#ff00ff";
                styleColorInput(selectedStrokeColorInput);

                const submitStrokeColorInput = document.createElement("input");
                submitStrokeColorInput.type = "color";
                submitStrokeColorInput.value = sr.strokeColor || "#8b5cf6";
                styleColorInput(submitStrokeColorInput);

                const tdLCPowerSpot = makeTD();
                const tdLCNearby = makeTD();
                const tdLCSelected = makeTD();
                const tdLCSubmit = makeTD();

                tdLCPowerSpot.appendChild(powerSpotStrokeColorInput);
                tdLCNearby.appendChild(nearbyStrokeColorInput);
                tdLCSelected.appendChild(selectedStrokeColorInput);
                tdLCSubmit.appendChild(submitStrokeColorInput);

                rowLineColor.appendChild(tdLCPowerSpot);
                rowLineColor.appendChild(tdLCNearby);
                rowLineColor.appendChild(tdLCSelected);
                rowLineColor.appendChild(tdLCSubmit);
                table.appendChild(rowLineColor);

                // ---- Row 3: Line thickness ----
                const rowLineWidth = document.createElement("tr");
                const lineWidthLabel = document.createElement("td");
                lineWidthLabel.textContent = "Line thickness";
                lineWidthLabel.style.padding = "2px 4px";
                lineWidthLabel.style.whiteSpace = "nowrap";
                rowLineWidth.appendChild(lineWidthLabel);

                const powerSpotStrokeWidthInput = document.createElement("input");
                powerSpotStrokeWidthInput.type = "number";
                powerSpotStrokeWidthInput.min = "0";
                powerSpotStrokeWidthInput.max = "10";
                powerSpotStrokeWidthInput.step = "0.5";
                powerSpotStrokeWidthInput.value = pr.strokeWidth ?? 1.5;
                styleNumericInput(powerSpotStrokeWidthInput);

                const nearbyStrokeWidthInput = document.createElement("input");
                nearbyStrokeWidthInput.type = "number";
                nearbyStrokeWidthInput.min = "0";
                nearbyStrokeWidthInput.max = "10";
                nearbyStrokeWidthInput.step = "0.5";
                nearbyStrokeWidthInput.value = nr.strokeWidth ?? 2;
                styleNumericInput(nearbyStrokeWidthInput);

                const selectedStrokeWidthInput = document.createElement("input");
                selectedStrokeWidthInput.type = "number";
                selectedStrokeWidthInput.min = "0";
                selectedStrokeWidthInput.max = "10";
                selectedStrokeWidthInput.step = "0.5";
                selectedStrokeWidthInput.value = spr.strokeWidth ?? 2;
                styleNumericInput(selectedStrokeWidthInput);

                const submitStrokeWidthInput = document.createElement("input");
                submitStrokeWidthInput.type = "number";
                submitStrokeWidthInput.min = "0";
                submitStrokeWidthInput.max = "10";
                submitStrokeWidthInput.step = "0.5";
                submitStrokeWidthInput.value = sr.strokeWidth ?? 2;
                styleNumericInput(submitStrokeWidthInput);

                const tdLWPowerSpot = makeTD();
                const tdLWNearby = makeTD();
                const tdLWSelected = makeTD();
                const tdLWSubmit = makeTD();

                tdLWPowerSpot.appendChild(powerSpotStrokeWidthInput);
                tdLWNearby.appendChild(nearbyStrokeWidthInput);
                tdLWSelected.appendChild(selectedStrokeWidthInput);
                tdLWSubmit.appendChild(submitStrokeWidthInput);

                rowLineWidth.appendChild(tdLWPowerSpot);
                rowLineWidth.appendChild(tdLWNearby);
                rowLineWidth.appendChild(tdLWSelected);
                rowLineWidth.appendChild(tdLWSubmit);
                table.appendChild(rowLineWidth);

                // ---- Row 4: Line opacity ----
                const rowLineOpacity = document.createElement("tr");
                const lineOpacityLabel = document.createElement("td");
                lineOpacityLabel.textContent = "Line opacity";
                lineOpacityLabel.style.padding = "2px 4px";
                lineOpacityLabel.style.whiteSpace = "nowrap";
                rowLineOpacity.appendChild(lineOpacityLabel);

                const powerSpotStrokeOpacityInput = document.createElement("input");
                powerSpotStrokeOpacityInput.type = "number";
                powerSpotStrokeOpacityInput.min = "0";
                powerSpotStrokeOpacityInput.max = "1";
                powerSpotStrokeOpacityInput.step = "0.05";
                powerSpotStrokeOpacityInput.value = pr.strokeOpacity ?? 1.0;
                styleNumericInput(powerSpotStrokeOpacityInput);

                const nearbyStrokeOpacityInput = document.createElement("input");
                nearbyStrokeOpacityInput.type = "number";
                nearbyStrokeOpacityInput.min = "0";
                nearbyStrokeOpacityInput.max = "1";
                nearbyStrokeOpacityInput.step = "0.05";
                nearbyStrokeOpacityInput.value = nr.strokeOpacity ?? 0.8;
                styleNumericInput(nearbyStrokeOpacityInput);

                const selectedStrokeOpacityInput = document.createElement("input");
                selectedStrokeOpacityInput.type = "number";
                selectedStrokeOpacityInput.min = "0";
                selectedStrokeOpacityInput.max = "1";
                selectedStrokeOpacityInput.step = "0.05";
                selectedStrokeOpacityInput.value = spr.strokeOpacity ?? 0.9;
                styleNumericInput(selectedStrokeOpacityInput);

                const submitStrokeOpacityInput = document.createElement("input");
                submitStrokeOpacityInput.type = "number";
                submitStrokeOpacityInput.min = "0";
                submitStrokeOpacityInput.max = "1";
                submitStrokeOpacityInput.step = "0.05";
                submitStrokeOpacityInput.value = sr.strokeOpacity ?? 0.8;
                styleNumericInput(submitStrokeOpacityInput);

                const tdLOPowerSpot = makeTD();
                const tdLONearby = makeTD();
                const tdLOSelected = makeTD();
                const tdLOSubmit = makeTD();

                tdLOPowerSpot.appendChild(powerSpotStrokeOpacityInput);
                tdLONearby.appendChild(nearbyStrokeOpacityInput);
                tdLOSelected.appendChild(selectedStrokeOpacityInput);
                tdLOSubmit.appendChild(submitStrokeOpacityInput);

                rowLineOpacity.appendChild(tdLOPowerSpot);
                rowLineOpacity.appendChild(tdLONearby);
                rowLineOpacity.appendChild(tdLOSelected);
                rowLineOpacity.appendChild(tdLOSubmit);
                table.appendChild(rowLineOpacity);

                // ---- Row 5: Fill colour ----
                const rowFillColor = document.createElement("tr");
                const fillColorLabel = document.createElement("td");
                fillColorLabel.textContent = "Fill colour";
                fillColorLabel.style.padding = "2px 4px";
                fillColorLabel.style.whiteSpace = "nowrap";
                rowFillColor.appendChild(fillColorLabel);

                const powerSpotFillColorInput = document.createElement("input");
                powerSpotFillColorInput.type = "color";
                powerSpotFillColorInput.value = pr.fillColor || "#ffffff";
                styleColorInput(powerSpotFillColorInput);

                const nearbyFillColorInput = document.createElement("input");
                nearbyFillColorInput.type = "color";
                nearbyFillColorInput.value = nr.fillColor || "#4285F4";
                styleColorInput(nearbyFillColorInput);

                const selectedFillColorInput = document.createElement("input");
                selectedFillColorInput.type = "color";
                selectedFillColorInput.value = spr.fillColor || "#ff00ff";
                styleColorInput(selectedFillColorInput);

                const submitFillColorInput = document.createElement("input");
                submitFillColorInput.type = "color";
                submitFillColorInput.value = sr.fillColor || "#8b5cf6";
                styleColorInput(submitFillColorInput);

                const tdFCPowerSpot = makeTD();
                const tdFCNearby = makeTD();
                const tdFCSelected = makeTD();
                const tdFCSubmit = makeTD();

                tdFCPowerSpot.appendChild(powerSpotFillColorInput);
                tdFCNearby.appendChild(nearbyFillColorInput);
                tdFCSelected.appendChild(selectedFillColorInput);
                tdFCSubmit.appendChild(submitFillColorInput);

                rowFillColor.appendChild(tdFCPowerSpot);
                rowFillColor.appendChild(tdFCNearby);
                rowFillColor.appendChild(tdFCSelected);
                rowFillColor.appendChild(tdFCSubmit);
                table.appendChild(rowFillColor);

                // ---- Row 6: Fill opacity ----
                const rowFillOpacity = document.createElement("tr");
                const fillOpacityLabel = document.createElement("td");
                fillOpacityLabel.textContent = "Fill opacity";
                fillOpacityLabel.style.padding = "2px 4px";
                fillOpacityLabel.style.whiteSpace = "nowrap";
                rowFillOpacity.appendChild(fillOpacityLabel);

                const powerSpotFillOpacityInput = document.createElement("input");
                powerSpotFillOpacityInput.type = "number";
                powerSpotFillOpacityInput.min = "0";
                powerSpotFillOpacityInput.max = "1";
                powerSpotFillOpacityInput.step = "0.05";
                powerSpotFillOpacityInput.value = pr.fillOpacity ?? 0.0;
                styleNumericInput(powerSpotFillOpacityInput);

                const nearbyFillOpacityInput = document.createElement("input");
                nearbyFillOpacityInput.type = "number";
                nearbyFillOpacityInput.min = "0";
                nearbyFillOpacityInput.max = "1";
                nearbyFillOpacityInput.step = "0.05";
                nearbyFillOpacityInput.value = nr.fillOpacity ?? 0.0;
                styleNumericInput(nearbyFillOpacityInput);

                const selectedFillOpacityInput = document.createElement("input");
                selectedFillOpacityInput.type = "number";
                selectedFillOpacityInput.min = "0";
                selectedFillOpacityInput.max = "1";
                selectedFillOpacityInput.step = "0.05";
                selectedFillOpacityInput.value = spr.fillOpacity ?? 0.05;
                styleNumericInput(selectedFillOpacityInput);

                const submitFillOpacityInput = document.createElement("input");
                submitFillOpacityInput.type = "number";
                submitFillOpacityInput.min = "0";
                submitFillOpacityInput.max = "1";
                submitFillOpacityInput.step = "0.05";
                submitFillOpacityInput.value = sr.fillOpacity ?? 0.0;
                styleNumericInput(submitFillOpacityInput);

                const tdFOPowerSpot = makeTD();
                const tdFONearby = makeTD();
                const tdFOSelected = makeTD();
                const tdFOSubmit = makeTD();

                tdFOPowerSpot.appendChild(powerSpotFillOpacityInput);
                tdFONearby.appendChild(nearbyFillOpacityInput);
                tdFOSelected.appendChild(selectedFillOpacityInput);
                tdFOSubmit.appendChild(submitFillOpacityInput);

                rowFillOpacity.appendChild(tdFOPowerSpot);
                rowFillOpacity.appendChild(tdFONearby);
                rowFillOpacity.appendChild(tdFOSelected);
                rowFillOpacity.appendChild(tdFOSubmit);
                table.appendChild(rowFillOpacity);

                circlesSection.appendChild(table);
                dialog.appendChild(circlesSection);

                // Return references needed by onOk
                return {
                    rememberChk,
                    nr,
                    sr,
                    spr,
                    pr,
                    powerSpotEnabledChk,
                    powerSpotStrokeColorInput,
                    powerSpotStrokeWidthInput,
                    powerSpotStrokeOpacityInput,
                    powerSpotFillColorInput,
                    powerSpotFillOpacityInput,
                    nearbyEnabledChk,
                    nearbyStrokeColorInput,
                    nearbyStrokeWidthInput,
                    nearbyStrokeOpacityInput,
                    nearbyFillColorInput,
                    nearbyFillOpacityInput,
                    submitEnabledChk,
                    submitStrokeColorInput,
                    submitStrokeWidthInput,
                    submitStrokeOpacityInput,
                    submitFillColorInput,
                    submitFillOpacityInput,
                    selectedEnabledChk,
                    selectedStrokeColorInput,
                    selectedStrokeWidthInput,
                    selectedStrokeOpacityInput,
                    selectedFillColorInput,
                    selectedFillOpacityInput
                };
            },
            onOk(ctx, closeModal) {
                const {
                    rememberChk,
                    nr,
                    sr,
                    spr,
                    pr,
                    powerSpotEnabledChk,
                    powerSpotStrokeColorInput,
                    powerSpotStrokeWidthInput,
                    powerSpotStrokeOpacityInput,
                    powerSpotFillColorInput,
                    powerSpotFillOpacityInput,
                    nearbyEnabledChk,
                    nearbyStrokeColorInput,
                    nearbyStrokeWidthInput,
                    nearbyStrokeOpacityInput,
                    nearbyFillColorInput,
                    nearbyFillOpacityInput,
                    submitEnabledChk,
                    submitStrokeColorInput,
                    submitStrokeWidthInput,
                    submitStrokeOpacityInput,
                    submitFillColorInput,
                    submitFillOpacityInput,
                    selectedEnabledChk,
                    selectedStrokeColorInput,
                    selectedStrokeWidthInput,
                    selectedStrokeOpacityInput,
                    selectedFillColorInput,
                    selectedFillOpacityInput
                } = ctx;

                mapCfg.rememberLastView = !!rememberChk.checked;

                // Power Spot (22m)
                pr.enabled = !!powerSpotEnabledChk.checked;
                pr.strokeColor = powerSpotStrokeColorInput.value || "#ffffff";
                pr.strokeWidth = clamp(powerSpotStrokeWidthInput.value, 0, 10, 1.5);
                pr.strokeOpacity = clamp(powerSpotStrokeOpacityInput.value, 0, 1, 1.0);
                pr.fillColor = powerSpotFillColorInput.value || "#ffffff";
                pr.fillOpacity = clamp(powerSpotFillOpacityInput.value, 0, 1, 0.0);

                // Nearby (200m)
                nr.enabled = !!nearbyEnabledChk.checked;
                nr.strokeColor = nearbyStrokeColorInput.value || "#4285F4";
                nr.strokeWidth = clamp(nearbyStrokeWidthInput.value, 0, 10, 2);
                nr.strokeOpacity = clamp(nearbyStrokeOpacityInput.value, 0, 1, 0.8);
                nr.fillColor = nearbyFillColorInput.value || "#4285F4";
                nr.fillOpacity = clamp(nearbyFillOpacityInput.value, 0, 1, 0.0);

                // Submit (10km)
                sr.enabled = !!submitEnabledChk.checked;
                sr.strokeColor = submitStrokeColorInput.value || "#8b5cf6";
                sr.strokeWidth = clamp(submitStrokeWidthInput.value, 0, 10, 2);
                sr.strokeOpacity = clamp(submitStrokeOpacityInput.value, 0, 1, 0.8);
                sr.fillColor = submitFillColorInput.value || "#8b5cf6";
                sr.fillOpacity = clamp(submitFillOpacityInput.value, 0, 1, 0.0);

                // Interaction (80m)
                spr.enabled = !!selectedEnabledChk.checked;
                spr.strokeColor = selectedStrokeColorInput.value || "#ff00ff";
                spr.strokeWidth = clamp(selectedStrokeWidthInput.value, 0, 10, 2);
                spr.strokeOpacity = clamp(selectedStrokeOpacityInput.value, 0, 1, 0.9);
                spr.fillColor = selectedFillColorInput.value || "#ff00ff";
                spr.fillOpacity = clamp(selectedFillOpacityInput.value, 0, 1, 0.05);

                saveSettings();
                updateNearbyWayspotsRadiusCircle();
                updateSubmitRadiusCircle();
                updatePowerSpotRadiusCircle();

                // Refresh selected POI circle if one is active
                if (typeof selectedPoiGuid === "string" && selectedPoiGuid && markersByGuid[selectedPoiGuid]) {
                    const selectedEntry = markersByGuid[selectedPoiGuid];
                    if (selectedEntry && selectedEntry.poi) {
                        updateSelectedPoiCircle(selectedEntry.poi.lat, selectedEntry.poi.lng);
                    }
                }

                closeModal();
            }
        });
    }

    let wayspotOverlayEscHandler = null;

    function openMarkerSettingsWindow() {
        const poi = userSettings.poi || (userSettings.poi = {
            markerType: "thumbnail",
            thumbnail: {
                borderColor: "#ffffff",
                borderWidth: 3,
                borderOpacity: 0.7
            },
            generic: {
                borderColor: "#ff6600",
                borderWidth: 2,
                borderOpacity: 1.0,
                fillColor: "#ff6600",
                fillOpacity: 0.5
            }
        });

        openSettingsModal({
            id: "wfmapmods-marker-backdrop",
            title: "Marker options",
            buildContent(dialog) {
                const typeSection = document.createElement("div");
                typeSection.className = "wfmapmods-modal-section";

                const typeHeader = document.createElement("div");
                typeHeader.className = "wfmapmods-modal-section-header";
                typeHeader.textContent = "Marker type";
                typeSection.appendChild(typeHeader);

                const typeSelect = document.createElement("select");
                typeSelect.className = "wfmapmods-modal-select";
                const optThumb = document.createElement("option");
                optThumb.value = "thumbnail";
                optThumb.textContent = "Thumbnail";
                const optGeneric = document.createElement("option");
                optGeneric.value = "generic";
                optGeneric.textContent = "Generic marker";
                typeSelect.appendChild(optThumb);
                typeSelect.appendChild(optGeneric);
                typeSelect.value = poi.markerType || "thumbnail";

                typeSection.appendChild(
                    createSettingsRow("Marker type", typeSelect, {
                        narrowLabel: true
                    })
                );
                dialog.appendChild(typeSection);

                // Thumbnail section
                const thumbSection = document.createElement("div");
                thumbSection.className = "wfmapmods-modal-section";

                const thumbHeader = document.createElement("div");
                thumbHeader.className = "wfmapmods-modal-section-header";
                thumbHeader.textContent = "Thumbnail marker border";
                thumbSection.appendChild(thumbHeader);

                const thumbBorderColorInput = document.createElement("input");
                thumbBorderColorInput.type = "color";
                thumbBorderColorInput.className = "wfmapmods-modal-color";
                thumbBorderColorInput.value = poi.thumbnail.borderColor || "#ffffff";
                thumbSection.appendChild(
                    createSettingsRow("Border colour", thumbBorderColorInput, {
                        narrowLabel: true
                    })
                );

                const thumbBorderWidthInput = document.createElement("input");
                thumbBorderWidthInput.type = "number";
                thumbBorderWidthInput.min = "0";
                thumbBorderWidthInput.max = "10";
                thumbBorderWidthInput.step = "1";
                thumbBorderWidthInput.className = "wfmapmods-modal-input-small";
                thumbBorderWidthInput.value = poi.thumbnail.borderWidth ?? 3;
                thumbSection.appendChild(
                    createSettingsRow("Border stroke (px)", thumbBorderWidthInput, {
                        narrowLabel: true
                    })
                );

                const thumbBorderOpacityInput = document.createElement("input");
                thumbBorderOpacityInput.type = "number";
                thumbBorderOpacityInput.min = "0";
                thumbBorderOpacityInput.max = "1";
                thumbBorderOpacityInput.step = "0.1";
                thumbBorderOpacityInput.className = "wfmapmods-modal-input-small";
                thumbBorderOpacityInput.value = poi.thumbnail.borderOpacity ?? 0.7;
                thumbSection.appendChild(
                    createSettingsRow("Border opacity (0–1)", thumbBorderOpacityInput, {
                        narrowLabel: true
                    })
                );

                dialog.appendChild(thumbSection);

                // Generic section
                const genSection = document.createElement("div");
                genSection.className = "wfmapmods-modal-section";

                const genHeader = document.createElement("div");
                genHeader.className = "wfmapmods-modal-section-header";
                genHeader.textContent = "Generic marker style";
                genSection.appendChild(genHeader);

                const genBorderColorInput = document.createElement("input");
                genBorderColorInput.type = "color";
                genBorderColorInput.className = "wfmapmods-modal-color";
                genBorderColorInput.value = poi.generic.borderColor || "#ff6600";
                genSection.appendChild(
                    createSettingsRow("Border colour", genBorderColorInput, {
                        narrowLabel: true
                    })
                );

                const genBorderWidthInput = document.createElement("input");
                genBorderWidthInput.type = "number";
                genBorderWidthInput.min = "0";
                genBorderWidthInput.max = "10";
                genBorderWidthInput.step = "1";
                genBorderWidthInput.className = "wfmapmods-modal-input-small";
                genBorderWidthInput.value = poi.generic.borderWidth ?? 2;
                genSection.appendChild(
                    createSettingsRow("Border stroke (px)", genBorderWidthInput, {
                        narrowLabel: true
                    })
                );

                const genBorderOpacityInput = document.createElement("input");
                genBorderOpacityInput.type = "number";
                genBorderOpacityInput.min = "0";
                genBorderOpacityInput.max = "1";
                genBorderOpacityInput.step = "0.1";
                genBorderOpacityInput.className = "wfmapmods-modal-input-small";
                genBorderOpacityInput.value = poi.generic.borderOpacity ?? 1.0;
                genSection.appendChild(
                    createSettingsRow("Border opacity (0–1)", genBorderOpacityInput, {
                        narrowLabel: true
                    })
                );

                const genFillColorInput = document.createElement("input");
                genFillColorInput.type = "color";
                genFillColorInput.className = "wfmapmods-modal-color";
                genFillColorInput.value = poi.generic.fillColor || "#ff6600";
                genSection.appendChild(
                    createSettingsRow("Fill colour", genFillColorInput, {
                        narrowLabel: true
                    })
                );

                const genFillOpacityInput = document.createElement("input");
                genFillOpacityInput.type = "number";
                genFillOpacityInput.min = "0";
                genFillOpacityInput.max = "1";
                genFillOpacityInput.step = "0.1";
                genFillOpacityInput.className = "wfmapmods-modal-input-small";
                genFillOpacityInput.value = poi.generic.fillOpacity ?? 0.5;
                genSection.appendChild(
                    createSettingsRow("Fill opacity (0–1)", genFillOpacityInput, {
                        narrowLabel: true
                    })
                );

                dialog.appendChild(genSection);

                function updateVisibility() {
                    const t = typeSelect.value;
                    thumbSection.style.display = (t === "thumbnail") ? "block" : "none";
                    genSection.style.display = (t === "generic") ? "block" : "none";
                }
                updateVisibility();
                typeSelect.addEventListener("change", updateVisibility);

                return {
                    typeSelect,
                    thumbBorderColorInput,
                    thumbBorderWidthInput,
                    thumbBorderOpacityInput,
                    genBorderColorInput,
                    genBorderWidthInput,
                    genBorderOpacityInput,
                    genFillColorInput,
                    genFillOpacityInput
                };
            },
            onOk(ctx, closeModal) {
                poi.markerType = ctx.typeSelect.value === "generic" ? "generic" : "thumbnail";

                poi.thumbnail.borderColor = ctx.thumbBorderColorInput.value || "#ffffff";
                poi.thumbnail.borderWidth = clamp(ctx.thumbBorderWidthInput.value, 0, 10, 3);
                poi.thumbnail.borderOpacity = clamp(ctx.thumbBorderOpacityInput.value, 0, 1, 0.7);

                poi.generic.borderColor = ctx.genBorderColorInput.value || "#ff6600";
                poi.generic.borderWidth = clamp(ctx.genBorderWidthInput.value, 0, 10, 2);
                poi.generic.borderOpacity = clamp(ctx.genBorderOpacityInput.value, 0, 1, 1.0);
                poi.generic.fillColor = ctx.genFillColorInput.value || "#ff6600";
                poi.generic.fillOpacity = clamp(ctx.genFillOpacityInput.value, 0, 1, 0.5);

                saveSettings();
                injectCss();
                rebuildAllPoiMarkers();

                closeModal();
            }
        });
    }

    function createSettingsRow(labelText, inputEl, opts = {}) {
        const row = document.createElement("div");
        row.className = "wfmapmods-modal-row";
        if (opts.narrowLabel) {
            row.classList.add("wfmapmods-modal-row--narrow");
        }

        const label = document.createElement("label");
        label.textContent = labelText;

        row.appendChild(label);
        row.appendChild(inputEl);
        return row;
    }

    function openSettingsModal({ id, title, buildContent, onOk, width, showFooterButtons }) {
        if (document.getElementById(id)) return; // Modal already open

        const backdrop = document.createElement("div");
        backdrop.id = id;
        backdrop.className = "wfmapmods-modal-backdrop";

        const dialog = document.createElement("div");
        dialog.className = "wfmapmods-modal-dialog";

        if (typeof width === "number") {
            dialog.style.width = width + "px";
            dialog.style.maxWidth = width + "px";
        } else if (id === "wfmapmods-mapopt-backdrop") {
            dialog.style.width = "400px";
            dialog.style.maxWidth = "400px";
        }

        const header = document.createElement("div");
        header.className = "wfmapmods-modal-title";
        header.textContent = title;
        dialog.appendChild(header);

        let okBtn = null;
        let cancelBtn = null;

        function closeModal() {
            document.removeEventListener("keydown", escHandler);
            backdrop.remove();
        }

        function escHandler(ev) {
            if (ev.key === "Escape") {
                closeModal();
            } else if (ev.key === "Enter" && okBtn) {
                ev.preventDefault();
                okBtn.click();
            }
        }

        let footer = null;
        if (showFooterButtons !== false) {
            footer = document.createElement("div");
            footer.className = "wfmapmods-modal-footer";

            cancelBtn = document.createElement("button");
            cancelBtn.type = "button";
            cancelBtn.textContent = "Cancel";
            cancelBtn.className = "wfmapmods-modal-btn";

            okBtn = document.createElement("button");
            okBtn.type = "button";
            okBtn.textContent = "OK";
            okBtn.className = "wfmapmods-modal-btn wfmapmods-modal-btn-primary";

            footer.appendChild(cancelBtn);
            footer.appendChild(okBtn);
        }

        const ctx = buildContent(dialog, okBtn, closeModal);

        if (footer) {
            cancelBtn.addEventListener("click", closeModal);

            okBtn.addEventListener("click", () => {
                if (onOk) onOk(ctx, closeModal);
            });

            dialog.appendChild(footer);
        }

        // Backdrop & ESC handling
        backdrop.addEventListener("click", (ev) => {
            if (ev.target === backdrop) closeModal();
        });
        document.addEventListener("keydown", escHandler);

        // Add dialog to DOM
        backdrop.appendChild(dialog);
        document.body.appendChild(backdrop);
    }

    function clamp(num, min, max, fallback) {
        num = Number(num);
        if (Number.isNaN(num)) return fallback;
        return Math.min(max, Math.max(min, num));
    }

    // -----------------------------
    // Desktop vs Mobile Browser Handling
    // -----------------------------

    function hasMobilePin() {
        return !!document.querySelector(
            '.nia-map__center-img-overlay'
        );
    }

    function hasDesktopPin() {
        const desktopImg = document.querySelector(
            '.gm-style div[style*="z-index: 1000"][style*="width: 36px"][style*="height: 56px"] img[src*="map_selection_pin.svg"]'
        );
        return !!desktopImg;
    }

    function detectMapMode() {
        if (hasMobilePin()) {
            return MAP_MODE.MOBILE;
        }

        if (hasDesktopPin()) {
            return MAP_MODE.DESKTOP;
        }

        // Unknown / not initialised yet
        return null;
    }

    function applyMobileMapMode() {
        // Hide native center pin overlay and show custom overlay.
        hideNativeCenterPin();
        ensureCenterPinOverlay();

        // Hide our custom made desktop pin
        removeDesktopSubmitMarker();

        // Recenter on the current submission coordinates
        // This is to prevent misalignment between lat,lng and visual pin
        recenterMapOnCurrentSubmission();

        // Collapse sidepanel
        sidePanelCollapsed = true;
        applySidePanelCollapseState();

        // If we already have a selected POI, show its InfoWindow now
        if (lastSelectedPoi) {
            const latLng = new google.maps.LatLng(lastSelectedPoi.lat, lastSelectedPoi.lng);
            showPoiInfoWindowForSelection(lastSelectedPoi, latLng);
        }
    }

    function applyDesktopMapMode() {
        // Remove our mobile overlay in desktop mode
        removeCenterPinOverlay();

        // Ensure desktop submission marker exists
        ensureDesktopSubmitMarker();

        // Side panel: expand in desktop
        sidePanelCollapsed = false;
        applySidePanelCollapseState();

        // Close any open InfoWindow when leaving mobile mode
        if (poiInfoWindow) {
            poiInfoWindow.close();
        }
    }

    function getDesktopSubmitMarkerIcon() {
        if (desktopSubmitMarkerIcon) return desktopSubmitMarkerIcon;
        if (typeof google === "undefined" || !google.maps) return null;

        desktopSubmitMarkerIcon = {
            url: "data:image/svg+xml;charset=UTF-8," + encodeURIComponent(SUBMISSION_PIN),
            // match Niantic desktop pin size
            scaledSize: new google.maps.Size(36, 56),
            // bottom-centre of the image sits on the LatLng
            anchor: new google.maps.Point(18, 56)
        };

        return desktopSubmitMarkerIcon;
    }

    function ensureDesktopSubmitMarker() {
        if (!submitMap || typeof google === "undefined" || !google.maps) return;

        const icon = getDesktopSubmitMarkerIcon();
        if (!icon) return;

        if (!desktopSubmitMarker) {
            desktopSubmitMarker = new google.maps.Marker({
                map: submitMap,
                clickable: false,
                zIndex: 999,
                optimized: false,
                icon: icon   // includes scaledSize + anchor from helper
            });
        }

        updateDesktopSubmitMarkerPosition();
    }

    function updateDesktopSubmitMarkerPosition() {
        if (!desktopSubmitMarker || !submitMap) return;
        if (typeof window.currentLat !== "number" || typeof window.currentLng !== "number") return;

        const latLng = new google.maps.LatLng(window.currentLat, window.currentLng);
        desktopSubmitMarker.setPosition(latLng);
    }

    function removeDesktopSubmitMarker() {
        if (desktopSubmitMarker) {
            desktopSubmitMarker.setMap(null);
            desktopSubmitMarker = null;
        }
    }


    function initMapModeWatcher() {
        const updateMode = () => {
            const newMode = detectMapMode();
            if (!newMode || newMode === currentMapMode) return;

            const oldMode = currentMapMode;
            currentMapMode = newMode;
            window.wfmapmodsMapMode = newMode;

            if (newMode === MAP_MODE.MOBILE) {
                applyMobileMapMode();
            } else if (newMode === MAP_MODE.DESKTOP) {
                applyDesktopMapMode();
            }
        };

        const observer = new MutationObserver((mutations) => {
            let centerPinTouched = false;

            for (const m of mutations) {
                for (const node of m.addedNodes) {
                    if (!(node instanceof HTMLElement)) continue;

                    if (node.matches(".center-pin-container") ||
                        (node.querySelector && node.querySelector(".center-pin-container"))) {
                        centerPinTouched = true;
                    }
                }
            }

            updateMode();
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true
        });

        window.addEventListener("resize", updateMode);

        // Initial pass
        updateMode();
    }

    // -----------------------------
    // Fixes for mobile browser
    // -----------------------------

    function recenterMapOnCurrentSubmission() {
        if (!submitMap || typeof google === "undefined" || !google.maps) {
            console.info("Wayfarer Map: recenter skipped – map not ready");
            return;
        }

        if (typeof window.currentLat !== "number" || typeof window.currentLng !== "number") {
            console.info(
                "Wayfarer Map: recenter skipped – currentLat/currentLng not set",
                window.currentLat,
                window.currentLng
            );
            return;
        }

        const latLng = new google.maps.LatLng(window.currentLat, window.currentLng);

        submitMap.setCenter(latLng);

        // Keep Wayfarer’s internal state in sync
        google.maps.event.trigger(submitMap, "click", {
            latLng
        });
    }

    function hideNativeCenterPin() {
        const pinContainer = document.querySelector(".nia-map__center-img-overlay");
        if (!pinContainer) return;

        pinContainer.style.setProperty("display", "none", "important");
    }

    function ensureCenterPinOverlay() {
        if (!submitMap) return;
        if (!ensureCenterPinClass()) return;

        if (!centerPinOverlay) {
            centerPinOverlay = new CenterPinOverlay(submitMap);
        }
    }

    function removeCenterPinOverlay() {
        if (centerPinOverlay) {
            centerPinOverlay.setMap(null);
            centerPinOverlay = null;
        }
    }

    function ensureCenterPinClass() {
        if (CenterPinOverlay) return true;

        if (typeof google === "undefined" ||
            !google.maps ||
            !google.maps.OverlayView) {
            return false;
        }

        CenterPinOverlay = class extends google.maps.OverlayView {
            constructor(map) {
                super();
                this.map = map;
                this.div = null;

                // Kick off OverlayView lifecycle
                this.setMap(map);
            }

            onAdd() {
                const div = document.createElement("div");
                div.style.position = "absolute";
                div.style.pointerEvents = "none"; // don’t block map/info clicks
                div.style.zIndex = "999"; // under floatPane (InfoWindow), over tiles

                const img = document.createElement("img");
                img.src = "/img/map_selection_pin.svg";
                img.alt = "Center pin";

                img.style.width = "40px";
                img.style.height = "40px";
                img.style.display = "block";

                div.appendChild(img);
                this.div = div;

                this.getPanes().overlayLayer.appendChild(div);
            }

            draw() {
                if (!this.div) return;

                const projection = this.getProjection();
                if (!projection) return;

                const map = this.getMap();
                if (!map) return;

                const center = map.getCenter();
                if (!center) return;

                const point = projection.fromLatLngToDivPixel(center);
                if (!point) return;

                const size = 40; // 40 × 40 mobile pin

                // Horizontally: center the pin on x
                this.div.style.left = (point.x - size / 2) + "px";

                // Vertically: put the *bottom* of the pin on the center point
                // so the “tip” / bottom edge sits exactly at the map center
                this.div.style.top = (point.y - size) + "px";
            }

            onRemove() {
                if (this.div && this.div.parentNode) {
                    this.div.parentNode.removeChild(this.div);
                }
                this.div = null;
            }
        };

        return true;
    }

    // ==================================
    // Lat/Lng observers - Find submit location
    // ==================================

    function watchForLatLngElement() {
        // Only initialise once
        if (latLngBodyObserver) return;

        function attachToLatLngElement(el) {
            // If we're already observing this exact element, do nothing
            if (latLngTargetEl === el && latLngObserver) return;

            // Disconnect old element observer (if any)
            if (latLngObserver) {
                latLngObserver.disconnect();
                latLngObserver = null;
            }

            latLngTargetEl = el;

            let lastText = (el.textContent || "").trim();
            const initialCoords = parseLatLng(lastText);

            if (initialCoords) {
                window.currentLat = initialCoords.lat;
                window.currentLng = initialCoords.lng;

                // Treat this as our first fetch position
                lastFetchLat = initialCoords.lat;
                lastFetchLng = initialCoords.lng;

                fetchLivePois(initialCoords.lat, initialCoords.lng);

                // Update 22m powerSpot radius circle
                updatePowerSpotRadiusCircle(initialCoords.lat, initialCoords.lng);

                if (currentMapMode === MAP_MODE.DESKTOP) {
                    updateDesktopSubmitMarkerPosition();
                }
            }

            // Watch for changes to the coordinates text
            latLngObserver = new MutationObserver(() => {
                // If element has been removed from DOM, stop observing.
                if (!document.body.contains(el)) {
                    latLngObserver.disconnect();
                    latLngObserver = null;
                    latLngTargetEl = null;
                    return;
                }

                const newText = (el.textContent || "").trim();
                if (newText === lastText) return;
                lastText = newText;

                const coords = parseLatLng(newText);
                if (!coords) return;

                handleLatLngChange(coords.lat, coords.lng);
            });

            latLngObserver.observe(el, {
                childList: true,
                subtree: true,
                characterData: true
            });
        }

        function findAndAttachLatLngElement() {
            const el = document.querySelector('.submit-coordinates-text') || document.querySelector('.text-gray-400.text-xs');
            if (!el) return;
            attachToLatLngElement(el);
        }

        // Body-level observer: watches for the lat/lng element appearing / being replaced
        latLngBodyObserver = new MutationObserver(() => {
            findAndAttachLatLngElement();
        });

        latLngBodyObserver.observe(document.body, {
            childList: true,
            subtree: true
        });

        // Try immediately in case the element is already present
        findAndAttachLatLngElement();
    }

    function handleLatLngChange(newLat, newLng) {
        window.currentLat = newLat;
        window.currentLng = newLng;

        // Update 22m Power Spot radius circle
        updatePowerSpotRadiusCircle(newLat, newLng);

        // Move our custom desktop submission marker (desktop mode only)
        if (currentMapMode === MAP_MODE.DESKTOP) {
            updateDesktopSubmitMarkerPosition();
        }

        // Save map coordinates so we can restore view after refresh
        saveMapView();

        // Marker must move a certain distance before loading new POIs
        // Defaults to 25% of POI radius (i.e. 50 metres)
        // Prevents spamming calls to server for minor pin movements
        const dist = distanceMeters(lastFetchLat, lastFetchLng, newLat, newLng);
        if (dist > poiMovementThreshold) {
            lastFetchLat = newLat;
            lastFetchLng = newLng;
            fetchLivePois(newLat, newLng);
        }
    }

    function parseLatLng(text) {
        if (!text) return null;
        const parts = text.split(',');
        if (parts.length !== 2) return null;

        const lat = parseFloat(parts[0].trim());
        const lng = parseFloat(parts[1].trim());

        if (isNaN(lat) || isNaN(lng)) return null;
        return {
            lat,
            lng
        };
    }

    // ==================================
    // Fetch nearby POIs
    // ==================================

    function fetchLivePois(lat, lng) {
        const url = `/api/v1/vault/live-pois-in-radius?lat=${lat}&lng=${lng}&radius=${radius}`;

        const xhr = new XMLHttpRequest();
        xhr.open("GET", url, true);

        xhr.onload = function() {
            if (xhr.status === 200) {
                try {
                    const json = JSON.parse(xhr.responseText);
                    window.currentPois = json?.result?.pois || [];
                    onPoisFetched();

                } catch (e) {
                    console.error("POI JSON parse error", e);
                }
            } else {
                console.error("POI request failed:", xhr.status);
            }
        };

        xhr.onerror = () => console.error("POI network error");
        xhr.send();
    }

    async function onPoisFetched() {
        // Treat stale map as "no map"
        if (!submitMap || isMapStale()) {
            mapClickCloseBound = false;
            submitMap = await getMap();
            if (!submitMap) {
                console.warn("Wayfarer Map: getMap() returned null");
                return;
            }

            setUpNewMap();
        }

        syncPoiMarkersWithCurrentPois();

        // If we came here via ?lat,lng, try to auto-select the nearest POI
        if (deepLinkSelectionPending) {
            trySelectDeepLinkedPoi();
        }
    }

    // ==================================
    // Map instance management
    // ==================================

    function getMap() {
        return new Promise(resolve => {
            let attempts = 40;

            function tryFindMap() {
                const candidates = document.querySelectorAll('app-submit-wayspot-map nia-map');
                let foundMap = null;

                candidates.forEach(el => {
                    if (foundMap || !el.__ngContext__) return;

                    const ctx = el.__ngContext__;

                    for (const entry of ctx) {
                        if (!entry) continue;

                        try {
                            if (entry.componentRef && entry.componentRef.map) {
                                foundMap = entry.componentRef.map;
                                break;
                            }
                        } catch {
                            /* ignore invalid entries */
                        }
                    }
                });

                if (foundMap) {
                    resolve(foundMap);
                    return;
                }

                if (attempts-- <= 0) {
                    console.warn("Failed to find submit map after several attempts");
                    resolve(null);
                    return;
                }

                setTimeout(tryFindMap, 250);
            }

            tryFindMap();
        });
    }

    function isMapStale() {
        if (!submitMap || !submitMap.getDiv) return true;

        const div = submitMap.getDiv();
        if (!div) return true;

        // If the map's DOM container is no longer attached, this is a stale map
        if (!document.body.contains(div)) {
            return true;
        }

        return false;
    }

    function setUpNewMap() {
        setGoogleMapControls();
        getSubmitterLocation();
        if (deepLinkTarget) {
            applyDeepLinkMapView();
        } else {
            restoreMapView();
        }
        initMapRightClickCopy();

        desktopSubmitMarker = null;
        centerPinOverlay = null;

        if (currentMapMode === MAP_MODE.MOBILE) {
            hideNativeCenterPin();
            ensureCenterPinOverlay();
        } else if (currentMapMode === MAP_MODE.DESKTOP) {
            ensureDesktopSubmitMarker();
        }

        submitMap.addListener("idle", () => {
            saveMapView();
        });

        initUserLocationMarker(submitMap);

        if (!mapClickCloseBound) {
            mapClickCloseBound = true;
            submitMap.addListener("click", () => {
                if (poiInfoWindow) {
                    poiInfoWindow.close();
                }
            });
        }

        ensureSidePanel();
        ensureLayersControl();
        applyWayspotVisibilityToAllMarkers();
        loadDraftSubmissionsFromIDB();
    }

    function setGoogleMapControls() {
        let mapTypeControlOptions = {
            style: google.maps.MapTypeControlStyle.HORIZONTAL_BAR,
            position: google.maps.ControlPosition.TOP_LEFT,
            mapTypeIds: ["roadmap", "satellite", "hybrid"],
        };

        submitMap.setOptions({
            clickableIcons: false,
            cameraControl: false,
            mapTypeControl: true,
            mapTypeControlOptions
        });
    }

    function initUserLocationMarker(map) {
        userLocationMarker = new google.maps.Marker({
            map,
            clickable: false,
            zIndex: 9999,
            optimized: false,
            icon: {
                path: google.maps.SymbolPath.CIRCLE,
                scale: 8,
                fillColor: '#4285F4',
                fillOpacity: 0.9,
                strokeColor: 'white',
                strokeWeight: 2
            }
        });

        // Hide by default until we have a position
        userLocationMarker.setVisible(false);
    }

    function triggerGeolocation(map) {
        if (!navigator.geolocation) {
            console.warn("Wayfarer Map: Geolocation not supported");
            return;
        }

        navigator.geolocation.getCurrentPosition(
            (pos) => {
                const lat = pos.coords.latitude;
                const lng = pos.coords.longitude;

                const latLng = new google.maps.LatLng(lat, lng);

                // Move the user-location blue dot
                userLocationMarker.setPosition(latLng);
                userLocationMarker.setVisible(true);

                // Center map smoothly
                map.panTo(latLng);
                map.setZoom(Math.max(map.getZoom(), 17));
            },
            (err) => {
                console.warn("Wayfarer Map: Geolocation failed:", err.message);
            }, {
                enableHighAccuracy: true,
                maximumAge: 5000,
                timeout: 8000
            }
        );
    }

    // ==================================
    // Get user location
    // ==================================

    function getSubmitterLocation() {
        if (!submitterLocation) {
            const initialCenter = submitMap.getCenter();
            if (initialCenter) {
                submitterLocation = {
                    lat: initialCenter.lat(),
                    lng: initialCenter.lng()
                };

                updateSubmitRadiusCircle();
            }
        }
    }

    // ==================================
    // Right click to copy coordinates
    // ==================================

    function initMapRightClickCopy() {
        if (!submitMap || typeof google === "undefined" || !google.maps) return;
        if (submitMap._wfmapmodsRightClickBound) return; // guard so we only bind once
        submitMap._wfmapmodsRightClickBound = true;

        google.maps.event.addListener(submitMap, "rightclick", (ev) => {
            if (!ev || !ev.latLng) return;

            // Prevent the browser's own context menu
            if (ev.domEvent && typeof ev.domEvent.preventDefault === "function") {
                ev.domEvent.preventDefault();
            }

            const lat = ev.latLng.lat();
            const lng = ev.latLng.lng();
            showMapRightClickMenu(lat, lng, ev);
        });
    }

    function showMapRightClickMenu(lat, lng, ev) {
        const mapDiv = submitMap && submitMap.getDiv
        ? submitMap.getDiv()
        : null;
        if (!mapDiv) return;

        // Remove any existing menu first
        if (mapRightClickMenuEl) {
            mapRightClickMenuEl.remove();
            mapRightClickMenuEl = null;
        }

        const rect = mapDiv.getBoundingClientRect();
        const domEvt = ev && ev.domEvent;
        const clientX = domEvt && typeof domEvt.clientX === "number"
        ? domEvt.clientX
        : rect.left + rect.width / 2;
        const clientY = domEvt && typeof domEvt.clientY === "number"
        ? domEvt.clientY
        : rect.top + rect.height / 2;

        const coordsText = `${lat.toFixed(6)}, ${lng.toFixed(6)}`;

        const menu = document.createElement("div");
        menu.className = "wfmapmods-map-context-menu";
        Object.assign(menu.style, {
            position: "absolute",
            top: (clientY - rect.top) + "px",
            left: (clientX - rect.left) + "px",
            transform: "translate(4px, 4px)",
            background: "#ffffff",
            border: "1px solid rgba(0,0,0,0.15)",
            borderRadius: "4px",
            padding: "6px 8px",
            boxShadow: "0 2px 6px rgba(0,0,0,0.25)",
            fontSize: "12px",
            zIndex: "1500",
            whiteSpace: "nowrap",
            cursor: "default",
        });

        const label = document.createElement("div");
        label.textContent = coordsText;
        label.style.marginBottom = "4px";
        label.style.fontFamily = "Roboto, Arial, sans-serif";
        menu.appendChild(label);

        const copyBtn = document.createElement("button");
        copyBtn.type = "button";
        copyBtn.textContent = "Copy";
        Object.assign(copyBtn.style, {
            fontSize: "12px",
            padding: "2px 8px",
            borderRadius: "3px",
            border: "1px solid #d1d5db",
            background: "#f3f4f6",
            cursor: "pointer",
        });

        copyBtn.addEventListener("click", () => {
            if (navigator.clipboard && navigator.clipboard.writeText) {
                navigator.clipboard.writeText(coordsText).catch(() => {});
            }
            removeMenu();
        });

        // Allow clicking the label to copy coordinates.
        label.style.cursor = "pointer";
        label.title = "Click to copy coordinates";
        label.addEventListener("click", () => {
            if (navigator.clipboard && navigator.clipboard.writeText) {
                navigator.clipboard.writeText(coordsText).catch(() => {});
            }
            removeMenu();
        });

        menu.appendChild(copyBtn);
        mapDiv.appendChild(menu);
        mapRightClickMenuEl = menu;

        function removeMenu() {
            if (!mapRightClickMenuEl) return;
            mapRightClickMenuEl.remove();
            mapRightClickMenuEl = null;
            document.removeEventListener("click", docClickHandler, true);
            document.removeEventListener("contextmenu", docClickHandler, true);
            document.removeEventListener("keydown", keyHandler, true);
        }

        function docClickHandler(e2) {
            if (!mapRightClickMenuEl) return;
            if (e2.target === menu || menu.contains(e2.target)) return; // clicking inside is ok
            removeMenu();
        }

        function keyHandler(e2) {
            if (e2.key === "Escape") {
                removeMenu();
            }
        }

        // Close on click-away, right-click elsewhere, or Escape
        document.addEventListener("click", docClickHandler, true);
        document.addEventListener("contextmenu", docClickHandler, true);
        document.addEventListener("keydown", keyHandler, true);
    }

    // ==================================
    // Map view persistence
    // ==================================

    const MAP_VIEW_KEY = "wfmapmods-map-view";

    function saveMapView() {
        try {
            if (!submitMap || typeof google === "undefined" || !google.maps) return;

            const center = submitMap.getCenter();
            if (!center) return;

            const zoom = submitMap.getZoom();

            let markerLat = window.currentLat;
            let markerLng = window.currentLng;

            const data = {
                lat: center.lat(),
                lng: center.lng(),
                zoom: typeof zoom === "number" ? zoom : null,
                markerLat: markerLat,
                markerLng: markerLng
            };

            localStorage.setItem(MAP_VIEW_KEY, JSON.stringify(data));
        } catch (e) {
            console.warn("Wayfarer Map: Failed to save map view:", e);
        }
    }

    function restoreMapView() {
        // If we have a deep-link for this load, do not restore the saved map view
        if (skipRestoreMapViewForThisLoad) return;

        if (!userSettings.map || !userSettings.map.rememberLastView) return;
        if (!submitMap) return;

        const raw = localStorage.getItem(MAP_VIEW_KEY);
        if (!raw) return;

        let parsed;
        try {
            parsed = JSON.parse(raw);
        } catch (e) {
            console.warn("Wayfarer Map: Failed to parse saved map view:", e);
            return;
        }

        const lat = parseFloat(parsed.lat);
        const lng = parseFloat(parsed.lng);
        const zoom = parsed.zoom != null ? parseInt(parsed.zoom, 10) : null;

        const markerLat = parsed.markerLat != null ? parseFloat(parsed.markerLat) : null;
        const markerLng = parsed.markerLng != null ? parseFloat(parsed.markerLng) : null;

        if (Number.isNaN(lat) || Number.isNaN(lng)) return;

        const centerLatLng = new google.maps.LatLng(lat, lng);

        // Restore map camera
        submitMap.setCenter(centerLatLng);
        if (typeof zoom === "number" && !Number.isNaN(zoom)) {
            submitMap.setZoom(zoom);
        }

        // --- Restore submission marker location ---
        if (!Number.isNaN(markerLat) && !Number.isNaN(markerLng)) {
            const savedMarkerLatLng = new google.maps.LatLng(markerLat, markerLng);

            // Simulate a click at the stored submission marker coordinates
            // This triggers the same internal Wayfarer logic as a real user click.
            google.maps.event.trigger(submitMap, "click", {
                latLng: savedMarkerLatLng
            });
        }
    }

    // ==================================
    // Deep links
    // ==================================

    function parseDeepLinkFromLocation() {
        const search = window.location.search || "";
        if (!search || search.length < 3) return null;

        // Only treat it as a deep link if there are NO '=' characters:
        if (search.indexOf("=") !== -1) return null;

        const raw = decodeURIComponent(search.substring(1));
        return parseLatLng(raw);
    }

    function buildDeepLinkUrl(lat, lng) {
        if (typeof lat !== "number" || typeof lng !== "number" ||
            !Number.isFinite(lat) || !Number.isFinite(lng)) {
            return window.location.href;
        }

        const base = window.location.origin + window.location.pathname;
        const latStr = lat.toFixed(6);
        const lngStr = lng.toFixed(6);
        return `${base}?${latStr},${lngStr}`;
    }

    function applyDeepLinkMapView() {
        if (!submitMap || !deepLinkTarget) return;

        const { lat, lng } = deepLinkTarget;
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;

        const centerLatLng = new google.maps.LatLng(lat, lng);

        // Center map on the deep-linked coordinates
        submitMap.setCenter(centerLatLng);

        const currentZoom = submitMap.getZoom();
        if (typeof currentZoom !== "number" || currentZoom < 17) {
            submitMap.setZoom(18);
        }

        // Move the submission marker to this location by simulating a click
        google.maps.event.trigger(submitMap, "click", {
            latLng: centerLatLng
        });

        // Mark that we still need to auto-select when POIs load
        deepLinkSelectionPending = true;
        skipRestoreMapViewForThisLoad = true;
    }

    function trySelectDeepLinkedPoi() {
        if (!deepLinkTarget || !Array.isArray(window.currentPois) || window.currentPois.length === 0) {
            return;
        }

        const { lat: targetLat, lng: targetLng } = deepLinkTarget;
        if (!Number.isFinite(targetLat) || !Number.isFinite(targetLng)) return;

        const MAX_DISTANCE_METRES = 2;

        let closestPoi = null;
        let closestDistance = Infinity;

        for (const poi of window.currentPois) {
            if (!Number.isFinite(poi.lat) || !Number.isFinite(poi.lng)) continue;

            const d = distanceMeters(targetLat, targetLng, poi.lat, poi.lng);
            if (d <= MAX_DISTANCE_METRES && d < closestDistance) {
                closestDistance = d;
                closestPoi = poi;
            }
        }

        // If nothing is within 2m, stay in "pending" mode.
        // This is to counteract initial fetch on page load messing things up
        if (!closestPoi) {
            console.log('Deep Links: No POI within 2m yet; will try again on next POI fetch');
            return;
        }

        // We found a match: publish and then clear the deep-link state.
        publishPoiToBridge(closestPoi, {
            status: closestPoi.status || "LIVE",
            source: "wfmapmods-deeplink"
        });

        // Reset values ONLY on success
        deepLinkTarget = null;
        skipRestoreMapViewForThisLoad = false;
        deepLinkSelectionPending = false;
    }

    // ==================================
    // Search & geocoding helpers
    // ==================================

    function handleSearchSubmit(rawValue) {
        if (!submitMap) return;

        const value = (rawValue || "").trim();
        if (!value) return;

        // 1) Try to parse "lat,lng"
        const latLng = tryParseLatLng(value);
        if (latLng) {
            flyToLatLngAndClick(latLng);
            return;
        }

        // 2) Fallback to geocoding the address
        if (typeof google !== "undefined" && google.maps && google.maps.Geocoder) {
            const geocoder = new google.maps.Geocoder();
            geocoder.geocode({
                address: value
            }, (results, status) => {
                if (status === "OK" && results && results[0]) {
                    const loc = results[0].geometry.location;
                    flyToLatLngAndClick(loc);
                } else {
                    console.warn("[Wayfarer Map] Geocode failed:", status);
                }
            });
        } else {
            console.warn("[Wayfarer Map] Google Maps Geocoder not available");
        }
    }

    function tryParseLatLng(str) {
        // Basic "lat,lng" parser: e.g. "-31.9535, 115.8570"
        const match = str.match(/^\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*$/);
        if (!match) return null;

        const lat = parseFloat(match[1]);
        const lng = parseFloat(match[2]);
        if (isNaN(lat) || isNaN(lng)) return null;

        return new google.maps.LatLng(lat, lng);
    }

    function flyToLatLngAndClick(latLng) {
        if (!submitMap || !latLng) return;

        submitMap.setCenter(latLng);

        const z = submitMap.getZoom();
        if (typeof z === "number" && z < 17) {
            submitMap.setZoom(17);
        }

        // Simulate a map click at this location so your existing logic runs
        google.maps.event.trigger(submitMap, "click", {
            latLng
        });
    }

    function setupSearchAutocomplete(inputEl) {
        if (!inputEl) return;
        if (typeof google === "undefined" || !google.maps || !google.maps.places) {
            // Places library not loaded; silent no-op
            return;
        }

        try {
            const autocomplete = new google.maps.places.Autocomplete(inputEl, {
                fields: ["geometry", "name"],
            });

            autocomplete.addListener("place_changed", () => {
                const place = autocomplete.getPlace();
                if (!place || !place.geometry || !place.geometry.location) return;
                flyToLatLngAndClick(place.geometry.location);
            });
        } catch (e) {
            console.warn("[Wayfarer Map] Failed to init Places Autocomplete:", e);
        }
    }

    // ==================================
    // Create circular overlays
    // ==================================

    function updatePowerSpotRadiusCircle(lat, lng) {
        updateCircleOverlay({
            circleRefName: "powerSpotRadiusCircle",
            center: {
                lat: lat,
                lng: lng
            },
            radiusMeters: 22,
            style: userSettings.map.powerSpotRadius
        });
    }

    function updateNearbyWayspotsRadiusCircle() {
        updateCircleOverlay({
            circleRefName: "nearbyWayspotsRadiusCircle",
            center: {
                lat: lastFetchLat,
                lng: lastFetchLng
            },
            radiusMeters: radius,
            style: userSettings.map.nearbyRadius
        });
    }

    function updateSubmitRadiusCircle() {
        updateCircleOverlay({
            circleRefName: "submitRadiusCircle",
            center: submitterLocation,
            radiusMeters: submitRadius,
            style: userSettings.map.submitRadius
        });
    }

    function updateSelectedPoiCircle(lat, lng) {
        updateCircleOverlay({
            circleRefName: "selectedPoiCircle80m",
            center: {
                lat,
                lng
            },
            radiusMeters: 80,
            style: userSettings.map.interactRadius
        });
    }

    function updateCircleOverlay(opts) {
        const {
            circleRefName,
            center,
            radiusMeters,
            style,
        } = opts;

        if (!submitMap || !center) return;

        const {
            enabled,
            strokeColor,
            strokeOpacity,
            strokeWidth,
            fillColor,
            fillOpacity
        } = style || {};

        let circle = window[circleRefName] || null;


        // Don't draw circle if setting is turned off
        if (enabled === false) {
            if (circle) {
                circle.setMap(null);
                window[circleRefName] = null;
            }
            return;
        }

        if (!circle) {
            // Create a fresh circle on the current map
            circle = new google.maps.Circle({
                map: submitMap,
                center,
                radius: radiusMeters,
                strokeColor: strokeColor,
                strokeOpacity: strokeOpacity ?? 0.8,
                strokeWeight: strokeWidth ?? 2,
                fillColor: fillColor,
                fillOpacity: fillOpacity ?? 0.0,
                clickable: false
            });

            window[circleRefName] = circle;
        } else {
            // Reuse existing circle, but ensure it's on the current map
            circle.setOptions({
                strokeColor: strokeColor,
                strokeOpacity: strokeOpacity ?? 0.8,
                strokeWeight: strokeWidth ?? 2,
                fillColor: fillColor,
                fillOpacity: fillOpacity ?? 0.0,
                clickable: false
            });
            circle.setCenter(center);
            circle.setRadius(radiusMeters);
            circle.setMap(submitMap); // <- important for when the map has been recreated
        }
    }

    // ==================================
    // Create POI markers
    // ==================================

    function syncPoiMarkersWithCurrentPois() {
        if (!submitMap || !Array.isArray(window.currentPois)) return;

        // Single InfoWindow reused for all markers
        if (!poiInfoWindow) {
            poiInfoWindow = new google.maps.InfoWindow();
        }

        // Draw 200m radius around loaded POI locations
        updateNearbyWayspotsRadiusCircle();

        // Build a set of guids from the new POI list
        const newGuids = new Set(window.currentPois.map(p => p.guid));

        // 1) Remove markers for POIs that are no longer in range
        removeStaleMarkers(newGuids);

        // 2) Add or update markers for current POIs
        for (const poi of window.currentPois) {
            upsertPoiMarker(poi);
        }
    }

    function removeStaleMarkers(newGuids) {
        for (const guid in markersByGuid) {
            if (!newGuids.has(guid)) {
                const entry = markersByGuid[guid];
                if (entry && entry.marker) {
                    entry.marker.setMap(null);
                }
                delete markersByGuid[guid];
            }
        }
    }

    function createPoiMarker(poi) {
        const markerType = userSettings.poi.markerType || 'thumbnail';
        const mapForMarker = isWayspotsLayerEnabled() ? submitMap : null;

        // Thumbnail marker (image-based)
        if (markerType === 'thumbnail') {
            const size = 36;
            const iconUrl = poi.imageUrl + `=s${size}-c`;

            const marker = new google.maps.Marker({
                position: {
                    lat: poi.lat,
                    lng: poi.lng
                },
                map: mapForMarker,
                title: poi.title,
                icon: {
                    url: iconUrl,
                    scaledSize: new google.maps.Size(size, size),
                    anchor: new google.maps.Point(size / 2, size / 2)
                },
                optimized: false,
            });

            addListenersToPoiMarker(marker, poi);
            return marker;
        }

        // Generic marker (simple circle) – uses generic border/fill settings
        const g = userSettings.poi.generic;
        const marker = new google.maps.Marker({
            position: {
                lat: poi.lat,
                lng: poi.lng
            },
            map: mapForMarker,
            title: poi.title,
            icon: {
                path: google.maps.SymbolPath.CIRCLE,
                strokeColor: g.borderColor,
                strokeOpacity: g.borderOpacity,
                strokeWeight: g.borderWidth,
                fillColor: g.fillColor,
                fillOpacity: g.fillOpacity,
                scale: 8 // tweak if you want bigger/smaller circle
            },
            optimized: false,
        });

        addListenersToPoiMarker(marker, poi);
        return marker;
    }

    function addListenersToPoiMarker(marker, poi) {
        marker.addListener("click", () => {
            // Just publish to the bridge; the bridge handler will:
            // - update side panel
            // - apply visual selection
            // - open InfoWindow
            publishPoiToBridge(poi, {
                status: "LIVE",
                source: "wfmapmods-base"
            });
        });
    }

    function upsertPoiMarker(poi) {
        const guid = poi.guid;
        const existing = markersByGuid[guid];

        if (existing) {
            const marker = existing.marker;
            const pos = marker.getPosition();

            if (!pos || pos.lat() !== poi.lat || pos.lng() !== poi.lng) {
                marker.setPosition({
                    lat: poi.lat,
                    lng: poi.lng
                });
            }

            existing.poi = poi;
        } else {
            const marker = createPoiMarker(poi);
            markersByGuid[guid] = {
                marker,
                poi
            };
        }
    }

    function rebuildAllPoiMarkers() {
        if (!submitMap || !Array.isArray(window.currentPois)) return;

        // Remove existing markers
        for (const guid in markersByGuid) {
            const entry = markersByGuid[guid];
            if (entry && entry.marker) {
                entry.marker.setMap(null);
            }
        }
        markersByGuid = {};

        // Recreate using current userSettings.poi
        for (const poi of window.currentPois) {
            upsertPoiMarker(poi);
        }
    }

    // ==================================
    // Marker selection helpers
    // ==================================

    function clearSelectedMarkers() {
        // Remove the "selected" class from anything using it
        document.querySelectorAll(".wfmapmods-marker-selected").forEach((el) => {
            el.classList.remove("wfmapmods-marker-selected");
        });
    }

    // Small helper to safely escape attribute values for use in a CSS [src="..."] selector
    function escapeAttrValue(value) {
        return String(value).replace(/"/g, '\\"');
    }

    function markMarkerSelectedByMarker(marker, poi) {
        if (!marker || typeof google === "undefined" || !google.maps) return;

        let icon = marker.getIcon && marker.getIcon();
        let url = null;

        if (typeof icon === "string") {
            url = icon;
        } else if (icon && typeof icon.url === "string") {
            url = icon.url;
        }

        // Fallback: reconstruct from poi image if needed
        if (!url && poi && poi.imageUrl) {
            const size = 36;
            url = poi.imageUrl + `=s${size}-c`;
        }

        if (!url) return;

        // Find the underlying <img> that Google Maps is using for this marker
        // Use ^= (starts with) to be tolerant of extra params Google may append.
        const selector = `.gm-style img[src^="${escapeAttrValue(url)}"]`;
        const imgs = document.querySelectorAll(selector);

        imgs.forEach((img) => {
            img.classList.add("wfmapmods-marker-selected");
        });
    }

    // ==================================
    // css styles
    // ==================================

    function injectCss() {
        const {
            borderColor,
            borderWidth,
            borderOpacity
        } = userSettings.poi?.thumbnail || {};
        const thumbBorderRGBA = borderColor ? hexToRgba(borderColor, borderOpacity) : "rgba(0,0,0,0.5)";

        const cssText = `
    /* ============================================================
       WAYFARER MAP MOD
       ============================================================ */

    /* -------------------------
       Modal Backdrop + Dialog
       ------------------------- */
    .wfmapmods-modal-backdrop {
        position: fixed;
        inset: 0;
        background: rgba(0,0,0,0.35);
        z-index: 2000;
        display: flex;
        align-items: center;
        justify-content: center;
        overflow-y: auto;
        padding: 12px 0;
    }

    .wfmapmods-modal-dialog {
        background: #ffffff;
        border-radius: 8px;
        box-shadow: 0 10px 25px rgba(0,0,0,0.35);
        width: 280px;
        max-width: calc(100% - 32px);
        padding: 12px 14px 10px;
        box-sizing: border-box;
        font-family: Roboto, Arial, sans-serif;
        font-size: 12px;
        color: #111827;
        max-height: 90vh;
        overflow-y: auto;
    }

    .wfmapmods-modal-title {
        font-size: 15px;
        font-weight: 600;
        margin-bottom: 10px;
    }

    .wfmapmods-modal-section {
        border-bottom: 1px solid #e5e7eb;
        padding-bottom: 6px;
        margin-bottom: 6px;
    }

    .wfmapmods-modal-section:last-of-type {
        border-bottom: none;
        padding-bottom: 0;
        margin-bottom: 0;
    }

    .wfmapmods-modal-section-header {
        font-weight: 500;
        margin-bottom: 4px;
    }

    .wfmapmods-modal-row {
        display: flex;
        align-items: center;
        margin-bottom: 3px;
        gap: 4px;
    }

    .wfmapmods-modal-row label {
        flex: 0 0 150px;
        font-size: 11px;
        color: #374151;
    }

    .wfmapmods-modal-row--narrow label {
        flex: 0 0 140px;
    }

    .wfmapmods-modal-input-small {
        width: 60px;
        padding: 2px 4px;
        font-size: 11px;
        box-sizing: border-box;
    }

    .wfmapmods-modal-color {
        width: 40px;
        height: 22px;
        padding: 0;
        border: none;
        background: none;
    }

    .wfmapmods-modal-checkbox {
        width: 16px;
        height: 16px;
    }

    .wfmapmods-modal-select {
        flex: 0 0 auto;
        padding: 2px 4px;
        font-size: 11px;
    }

    .wfmapmods-modal-footer {
        display: flex;
        justify-content: flex-end;
        gap: 8px;
        margin-top: 6px;
    }

    .wfmapmods-modal-btn {
        padding: 4px 10px;
        border-radius: 4px;
        border: 1px solid #d1d5db;
        background: #ffffff;
        cursor: pointer;
        font-size: 12px;
    }

    .wfmapmods-modal-btn-primary {
        border-color: #2563eb;
        background: #2563eb;
        color: #ffffff;
    }

    /* -------------------------
       Marker Thumbnails
       ------------------------- */
    .gm-style img[src*="lh3.googleusercontent.com"][src*="=s36-c"] {
        border-radius: 50% !important;
        width: 36px !important;
        height: 36px !important;
        object-fit: cover !important;
        box-sizing: border-box !important;
        border: ${borderWidth || 2}px solid ${thumbBorderRGBA} !important;
    }

    /* -------------------------
       Modify default markers
       ------------------------- */
    .gm-style div[style*="width: 36px"][style*="height: 56px"] {
        display: none !important;
    }

    .gm-style div[style*="z-index: 999"][style*="width: 36px"][style*="height: 56px"] {
        display: block !important;
        pointer-events: none !important;
    }

     .gm-style div[style*="z-index: 103"]
            div[style*="z-index: -1"]
            div:is([style*="z-index: 98"], [style*="z-index: 99"]) canvas {
        display: none !important;
    }

    /* -------------------------
       Sidebar Icon & Link
       ------------------------- */
    .sidebar-wayfarermap svg {
        width: 24px;
        height: 24px;
        filter: none;
        fill: currentColor;
    }

    a.sidebar-link.sidebar-wayfarermap {
        color: #d3d3d3 !important;
    }

    a.sidebar-link.sidebar-wayfarermap:hover {
        color: #ffffff !important;
    }

    /* -------------------------
       Search Placeholder Styles
       ------------------------- */
    #wfmapmods-search-input::placeholder {
        color: #6B7280 !important;
    }
    #wfmapmods-search-input:-ms-input-placeholder {
        color: #6B7280 !important;
    }
    #wfmapmods-search-input::-ms-input-placeholder {
        color: #6B7280 !important;
    }

    /* -------------------------
       Settings & POI Function Links
       ------------------------- */
    .wfmapmods-link-block {
        display: flex;
        flex-wrap: wrap;
        gap: 0px 4px;
        padding: 4px 0;
    }

    .wfmapmods-link-block a {
        font-size: 12px;
        font-weight: 400;
        color: #6b7280;
        text-decoration: none;
        white-space: nowrap;
        cursor: pointer;
        padding: 0px 4px;
        border-radius: 3px;
    }

    .wfmapmods-link-block a:hover {
        text-decoration: underline;
    }

    .wfmapmods-link-disabled {
        color: #9ca3af !important;
        cursor: not-allowed !important;
        text-decoration: none !important;
    }

    /* -------------------------
       Wayspot detail overlay
       ------------------------- */
    .wfmapmods-wayspot-overlay-backdrop {
        position: fixed;
        inset: 0;
        background: rgba(0,0,0,0.55);
        z-index: 2500;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 12px;
        box-sizing: border-box;
    }

    .wfmapmods-wayspot-overlay-dialog {
        position: relative;
        background: #ffffff;
        border-radius: 8px;
        box-shadow: 0 10px 25px rgba(0,0,0,0.45);
        max-width: 550px;
        width: 100%;
        max-height: 90vh;
        display: flex;
        flex-direction: column;
        box-sizing: border-box;
        padding: 10px 12px 12px;
        font-family: Roboto, Arial, sans-serif;
        color: #111827;
        overflow: hidden;
        align-items: stretch;
    }

    .wfmapmods-wayspot-overlay-header {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        margin-bottom: 8px;
        gap: 8px;
        width: 100%;
    }

    .wfmapmods-wayspot-overlay-title {
        font-size: 15px;
        font-weight: 600;
        text-align: center;
        flex: 1 1 auto;
        width: 100%;
        overflow-wrap: anywhere;
        white-space: normal;
    }

    .wfmapmods-wayspot-overlay-close {
        flex: 0 0 24px;
        align-self: flex-start;

        border: 1px solid rgba(0,0,0,0.2);
        background: #ffffff;
        border-radius: 9999px;
        width: 24px;
        height: 24px;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 0;
        cursor: pointer;
        font-size: 16px;
        line-height: 1;
        font-weight: 600;
    }

    .wfmapmods-wayspot-overlay-image-link {
       display: inline-block;
        margin-bottom: 8px;
        text-align: center;
    }

    .wfmapmods-wayspot-overlay-image {
        display: block;
        max-width: 100% !important;
        max-height: 500px !important;
        width: auto !important;
        height: auto !important;
        object-fit: contain !important;
        border-radius: 6px;
        background: #000;
        margin: 0 auto;
    }

    .wfmapmods-wayspot-overlay-desc {
        font-size: 13px;
        color: #374151;
        text-align: center;
        margin: 0 auto;
        overflow-y: auto;
        max-height: 20vh;
        padding-right: 2px;
    }

    /* -------------------------
       Side panel drawer / toggle
       ------------------------- */

    .wfmapmods-sidepanel-root {
        transition: transform 0.25s ease-out;
    }

    /* Slide the panel to the right so only the tab remains visible.
       28px here should match the tab width. */
    .wfmapmods-sidepanel-root.wfmapmods-sidepanel-collapsed {
        transform: translateX(calc(100% + 11px));
    }

    #wfmapmods-sidepanel-toggle {
        position: absolute;
        top: 30%;
        left: -25px;              /* stick it on the left edge */
        transform: translateY(-50%);
        width: 25px;
        height: 56px;
        border-radius: 8px 0 0 8px;
        border: 1px solid #d1d5db;
        border-right: none;
        background: #f3f4f6;
        color: #374151;
        font-size: 14px;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        padding: 0;
        box-shadow: 0 1px 4px rgba(0,0,0,0.15);
    }

    #wfmapmods-sidepanel-toggle:hover {
        background: #e5e7eb;
    }

    /* -------------------------
       Selected marker highlight
       ------------------------- */

    /* Thumbnail markers (lh3 Googleusercontent icons) */
    .gm-style img[src*="lh3.googleusercontent.com"][src*="=s36-c"].wfmapmods-marker-selected {
        border-color: #ff00ff !important;
        border-width: 3px !important;
        border-style: solid !important;
        opacity: 1 !important;
    }

    /* Fallback: any marker image with this class */
    .gm-style img.wfmapmods-marker-selected {
        border-color: #ff00ff !important;
        border-width: 3px !important;
        border-style: solid !important;
        opacity: 1 !important;
    }

    /* -------------------------
       Status tags
       ------------------------- */

    .wfmapmods-status-tag {
        display: inline-block;
        white-space: nowrap;
        border-radius: 9999px; /* pill shape */
        padding: 0.25rem 0.5rem;
        font-size: 0.75rem;
        line-height: 1rem;
        text-transform: uppercase;
        font-weight: 500;
    }
    .wfmapmods-status-tag--accepted {
        background-color: rgba(187, 247, 208, 1); /* light green */
        color: rgba(21, 128, 61, 1);              /* dark green */
    }
    .wfmapmods-status-tag--rejected {
        background-color: rgba(254, 202, 202, 1); /* light red */
        color: rgba(220, 38, 38, 1);              /* dark red */
    }
    .wfmapmods-status-tag--queue {
        background-color: rgba(212, 212, 212, 1); /* light grey */
        color: rgba(23, 23, 23, 1);               /* dark grey */
    }

    /* -------------------------
       Wayfarer Map - Info Window Styles
       ------------------------- */

    .wfmapmods-iw-root {
        position: relative;
    }

    .wfmapmods-iw-content {
        display: flex;
        flex-direction: column;
        max-width: 220px;
        font-family: Roboto, Arial, sans-serif;
        color: #000;
    }

    /* Header row */
    .wfmapmods-iw-header {
        display: flex;
        align-items: flex-start;
        gap: 4px;
        margin-top: 6px;
        margin-bottom: 4px;
    }

    /* Title container */
    .wfmapmods-iw-title {
        flex: 1 1 auto;
        min-width: 0;
        font-size: 14px;
        font-weight: 500;
        margin-top: 6px;
    }

    /* Actual title text */
    .wfmapmods-iw-copy-title {
        display: block;
        cursor: pointer;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
    }

    /* Close button */
    .wfmapmods-iw-close {
        flex: 0 0 24px;
        width: 24px;
        height: 24px;
        background: #fff;
        border: 1px solid rgba(0,0,0,0.15);
        border-radius: 9999px;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 16px;
        font-weight: 600;
        cursor: pointer;
        padding: 0;
    }

    /* Coordinates row */
    .wfmapmods-iw-coords {
        font-size: 12px;
        color: #6b7280;
        margin-bottom: 8px;
    }

    .wfmapmods-iw-copy-coords {
        cursor: pointer;
    }

    /* Image wrapper */
    .wfmapmods-iw-img-wrapper {
        width: 220px;
        height: 96px;
        overflow: hidden;
        margin-bottom: 8px;
    }

    .wfmapmods-iw-img-link {
        display: block;
        width: 100%;
        height: 100%;
    }

    .wfmapmods-iw-img {
        display: block;
        width: 100%;
        height: 100%;
        object-fit: cover;
    }

    /* Description */
    .wfmapmods-iw-desc {
        font-size: 14px;
    }

    /* -------------------------
       Google Maps info window: hide default close button
       ------------------------- */

    /* Hide the default Google Maps close "X" */
    .gm-style-iw-chr .gm-ui-hover-effect {
        display: none !important;
    }

    /* Collapse the header chrome so there isn't a big white bar */
    .gm-style-iw-chr {
        height: 0 !important;
        padding: 0 !important;
        margin: 0 !important;
    }

    /* -------------------------
       Layers control (top-right)
       ------------------------- */
    .wfmapmods-layers-root {
        font-family: Roboto, Arial, sans-serif;
        font-size: 12px;
        pointer-events: auto;
    }

    .wfmapmods-layers-toggle {
        border: 1px solid rgba(0, 0, 0, 0.2);
        border-radius: 4px;
        background: #ffffff;
        padding: 4px 6px;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        box-shadow: 0 1px 3px rgba(0,0,0,0.25);
        outline: none;
        position: relative;
    }

    .wfmapmods-layers-toggle:hover {
        box-shadow: 0 2px 4px rgba(0,0,0,0.3);
    }

    .wfmapmods-layers-toggle:focus-visible {
        box-shadow: 0 0 0 2px #2563eb;
    }

    .wfmapmods-layers-icon {
        width: 25px;
        height: 25px;
        display: block;
    }

    .wfmapmods-layers-icon svg {
        width: 100%;
        height: 100%;
        fill: #666666;
    }

    .wfmapmods-layers-menu {
        position: absolute;
        top: 0;
        right: 0;
        padding: 6px 8px;
        background: #ffffff;
        border-radius: 6px;
        box-shadow: 0 2px 6px rgba(0,0,0,0.3);
        display: none;
        white-space: nowrap;
        flex-direction: column;
        gap: 4px;
        align-items: flex-start;
        }

    .wfmapmods-layers-root.wfmapmods-layers-open .wfmapmods-layers-toggle {
        display: none;
    }

    .wfmapmods-layers-root.wfmapmods-layers-open .wfmapmods-layers-menu {
        display: flex;
    }

    .wfmapmods-layers-option {
        display: flex;
        align-items: center;
        gap: 4px;
        cursor: pointer;
    }

    .wfmapmods-layers-checkbox {
        width: 14px;
        height: 14px;
        cursor: pointer;
    }

    .wfmapmods-layers-label {
        font-size: 11px;
        color: #111827;
        cursor: pointer;
    }

    /* -------------------------
       Remove map padding
       ------------------------- */
    .submit-wayspot-container {
        padding: 0 !important;
    }
    `;

        let style = document.getElementById("wfmapmods-all-css");
        if (style) {
            // Update existing style with new settings
            style.textContent = cssText;
        } else {
            // First time: create it
            style = document.createElement("style");
            style.id = "wfmapmods-all-css";
            style.textContent = cssText;
            document.head.appendChild(style);
        }
    }


    // ==================================
    // Bootstrap & event wiring
    // ==================================

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', setupSidebarObserver);
    } else {
        setupSidebarObserver();
    }

    // Initial map-mode layout on load
    formatPageForMapMode();
    // updateSidebarActiveForMapMode();

    // Keep behaviour in sync with SPA navigation
    window.addEventListener('popstate', () => {
        formatPageForMapMode();
        // updateSidebarActiveForMapMode();
    });


    function init() {
        const coordsFromUrl = parseDeepLinkFromLocation();
        if (coordsFromUrl) {
            deepLinkTarget = coordsFromUrl;
            skipRestoreMapViewForThisLoad = true;
            sessionStorage.setItem('wf_map_nav', '1');
            formatPageForMapMode();
        }

        loadSettings();
        injectCss();
        watchForLatLngElement();
        initMapModeWatcher();
        initSidenavPaddingRouteWatcher();
        createBridges();
    }
    init();

})();