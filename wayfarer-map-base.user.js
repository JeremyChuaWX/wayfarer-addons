// ==UserScript==
// @name         Wayfarer Map - Base
// @version      1.0.2
// @description  Base plug-in for Wayfarer Maps
// @namespace    https://gitlab.com/Tntnnbltn/wayfarer-addons
// @downloadURL  https://gitlab.com/Tntnnbltn/wayfarer-addons/-/raw/main/wayfarer-map-base.user.js
// @homepageURL  https://gitlab.com/Tntnnbltn/wayfarer-addons
// @match        https://wayfarer.nianticlabs.com/*
// @require      https://unpkg.com/exifr/dist/full.umd.js
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

    // ----- Map instance & core map state -----
    let submitMap = null;
    let currentMapMode = null;
    let poiInfoWindow = null;
    let CenterPinOverlay = null;
    let centerPinOverlay = null;

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

    // -----------------------------
    // Settings (defaults + storage)
    // -----------------------------

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

            // Use EXIF data from the main photo to initialise the map
            useExifInit: true,

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
    // Helpers
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

    function updateSidebarActiveForMapMode() {
        const fromMap = sessionStorage.getItem('wf_map_nav') === '1';
        const onMapPage = location.pathname === '/new/submit/new';

        // Only care about the special case: map-nav + correct route
        if (!onMapPage || !fromMap) return;

        let tries = 30; // 30 * 100ms = 3s max

        const interval = setInterval(() => {
            const sidebar = document.querySelector('app-sidebar');
            if (!sidebar) {
                if (--tries <= 0) {
                    console.warn("Wayfarer Map: Sidebar not found to update active state");
                    clearInterval(interval);
                }
                return;
            }

            const wrappers = sidebar.querySelectorAll('app-sidebar-link');
            if (wrappers.length < 3) {
                if (--tries <= 0) {
                    console.warn("Wayfarer Map: Not enough sidebar items (need at least 3)");
                    clearInterval(interval);
                }
                return;
            }

            const submitLink = wrappers[1].querySelector('a.sidebar-link');
            const mapLink = wrappers[2].querySelector('a.sidebar-link');

            if (!submitLink || !mapLink) {
                if (--tries <= 0) {
                    console.warn("Wayfarer Map: Could not find submit/map anchors");
                    clearInterval(interval);
                }
                return;
            }

            // Remove highlight from Submit, give it to Map
            submitLink.classList.remove('sidebar-link--active');
            mapLink.classList.add('sidebar-link--active');

            clearInterval(interval);
        }, 100);
    }

    function setupSidebarTracking(sidebar) {
        if (window._wfsmmSidebarTrackingSetup) return;
        window._wfsmmSidebarTrackingSetup = true;

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
        mapAnchor.setAttribute('data-wfsmm-role', 'map');

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

    function formatPageForMapMode() {
        // Only run when arriving via Map button
        if (sessionStorage.getItem('wf_map_nav') !== '1') return;

        // Only run on the correct route
        if (location.pathname !== '/new/submit/new') return;

        const interval = setInterval(() => {
            const root = document.querySelector('app-submit-wayspot.ng-star-inserted');
            if (!root) return;

            const mapComp = root.querySelector('app-submit-wayspot-map');
            if (!mapComp) return;

            const container = root.querySelector(':scope > div');

            clearInterval(interval);

            // --- Remove Niantic width limiter ----
            if (container) {
                const limiter = container.closest('.max-w-7xl');
                if (limiter) limiter.classList.remove('max-w-7xl');
            }

            // --- Hide everything other than the map ----
            if (mapComp.parentElement !== root) {
                root.appendChild(mapComp);
            }

            Array.from(root.children).forEach(child => {
                if (child !== mapComp) {
                    child.style.display = 'none';
                }
            });

            // --- Remove padding from mat-sidenav-content (full-screen map) ----
            const sidenavContent = document.querySelector('mat-sidenav-content');
            if (sidenavContent) {
                sidenavContent.classList.remove('p-4');
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
            window.addEventListener('resize', resizeSubmitMapToViewport);

        }, 150);
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

    function applySidenavPaddingForCurrentRoute() {
        const fromMap = sessionStorage.getItem('wf_map_nav') === '1';
        const onMapPage = location.pathname === '/new/submit/new';

        if (fromMap && onMapPage) {
            removeSidenavPaddingForMapPage();
        } else {
            restoreSidenavPadding();
            restoreScrolling();
        }
    }

    function restoreScrolling() {
        let node = document.querySelector('mat-sidenav-content'); // or your root
        while (node && node !== document.body) {
            if (node instanceof HTMLElement) {
                if (node.style.overflowY === 'hidden') {
                    node.style.overflowY = ''; // remove inline override
                }
            }
            node = node.parentElement;
        }
    }
    function initSidenavPaddingRouteWatcher() {
        if (window._wfsmmSidenavPaddingWatcherInitialised) return;
        window._wfsmmSidenavPaddingWatcherInitialised = true;

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

        // Re-adjust on resize
        window.addEventListener('resize', adjustHeight);
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
            panel.id = "wfsmm-side-panel";
            panel.className = "wfsmm-sidepanel-root";

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
            toggleTab.id = "wfsmm-sidepanel-toggle";
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
            content.className = "wfsmm-sidepanel-content";
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
            searchSection.className = "wfsmm-section wfsmm-section-search";

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
            searchInput.id = "wfsmm-search-input";
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

            // Optional: Places autocomplete
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
            detailsSection.className = "wfsmm-section wfsmm-section-details";
            detailsSection.style.display = "none"; // hidden until a wayspot is clicked

            const detailsBody = document.createElement("div");
            detailsBody.className = "wfsmm-section-body wfsmm-section-details-body";
            Object.assign(detailsBody.style, {
                display: "flex",
                flexDirection: "column",
                gap: "6px",
            });

            // Title (single line, ellipsis, centred)
            const titleValue = document.createElement("div");
            titleValue.className = "wfsmm-detail-value wfsmm-detail-title";
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
            imageBox.className = "wfsmm-detail-image-box";
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
            imagePlaceholder.className = "wfsmm-detail-image-placeholder";
            imagePlaceholder.textContent = "No image selected";
            imageBox.appendChild(imagePlaceholder);

            // Coordinates – mimic wf-copy-coords style
            const coordsValue = document.createElement("div");
            coordsValue.className = "wfsmm-detail-value wfsmm-detail-coords";
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

            detailsBody.appendChild(titleValue);
            detailsBody.appendChild(imageBox);
            detailsBody.appendChild(coordsValue);
            detailsSection.appendChild(detailsBody);

            // Divider between search/details and commands/settings
            const divider1 = document.createElement("div");
            divider1.className = "wfsmm-section-divider wfsmm-section-divider-details wfsmm-divider-1";
            Object.assign(divider1.style, {
                borderTop: "1px solid #e5e7eb",
                margin: "6px 0",
            });

            const divider2 = document.createElement("div");
            divider2.className = "wfsmm-section-divider wfsmm-divider-2";
            Object.assign(divider2.style, {
                borderTop: "1px solid #e5e7eb",
                margin: "6px 0",
            });

            // ==============================
            // SECTION 3: Wayspot Function Links
            // ==============================

            const poiFunctionsSection = document.createElement("section");
            poiFunctionsSection.className = "wfsmm-section wfsmm-section-poi-functions";
            poiFunctionsSection.style.display = "none"; // hidden until POI is selected

            // Container for links (shared with settings styling)
            const poiFunctionLinks = document.createElement("div");
            poiFunctionLinks.className = "wfsmm-link-block wfsmm-poi-function-links";

            // --- Deep link (hidden until a POI is selected) ---
            const deepLinkA = document.createElement("a");
            deepLinkA.href = "#";
            deepLinkA.style.display = "none"; // becomes visible on selection
            deepLinkA.textContent = "Deep link";

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

            // assemble section
            poiFunctionLinks.appendChild(deepLinkA);
            poiFunctionsSection.appendChild(poiFunctionLinks);

            // ==============================
            // SECTION 4: Settings
            // ==============================

            const settingsSection = document.createElement("section");
            settingsSection.className = "wfsmm-section wfsmm-section-settings";

            // Container the links will go inside
            const settingsBody = document.createElement("div");
            settingsBody.className = "wfsmm-link-block wfsmm-settings-links";

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
            content.appendChild(settingsSection);

            detailsSection.style.padding = "8px 4px";
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

    function applySidePanelCollapseState() {
        if (!sidePanelEl) return;

        const toggleTab = sidePanelEl.querySelector("#wfsmm-sidepanel-toggle");

        if (sidePanelCollapsed) {
            sidePanelEl.classList.add("wfsmm-sidepanel-collapsed");
            if (toggleTab) toggleTab.textContent = "◀"; // collapsed → arrow points left (open)
        } else {
            sidePanelEl.classList.remove("wfsmm-sidepanel-collapsed");
            if (toggleTab) toggleTab.textContent = "▶"; // expanded → arrow points right (close)
        }
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

        const detailsSection = sidePanelEl.querySelector(".wfsmm-section-details");
        const poiFunctionsSection = sidePanelEl.querySelector(".wfsmm-section-poi-functions");
        const divider = sidePanelEl.querySelector(".wfsmm-section-divider-details");
        const titleEl = sidePanelEl.querySelector(".wfsmm-detail-title");
        const coordsEl = sidePanelEl.querySelector(".wfsmm-detail-coords");
        const imgBox = sidePanelEl.querySelector(".wfsmm-detail-image-box");

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
            const title = poi.title || "(untitled)";
            titleEl.textContent = title;
            titleEl.title = title; // full title on hover
        }

        // ----- Status + Coordinates -----
        if (coordsEl) {
            const latStr = (typeof poi.lat === "number" && Number.isFinite(poi.lat)) ?
                  poi.lat.toFixed(6) :
            "--";
            const lngStr = (typeof poi.lng === "number" && Number.isFinite(poi.lng)) ?
                  poi.lng.toFixed(6) :
            "--";

            const status = poi.status || "LIVE";

            coordsEl.textContent = `${status}: ${latStr}, ${lngStr}`;
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

                const deepLinkA = sidePanelEl.querySelector(".wfsmm-poi-function-links a");
                if (deepLinkA) {
                    deepLinkA.dataset.link = url;
                    deepLinkA.style.display = "inline-block";
                    deepLinkA.textContent = "Deep link";
                }
            }
        }

        // ----- Image – circular, clipped -----
        if (imgBox) {
            imgBox.innerHTML = ""; // clear placeholder / previous content

            if (poi.imageUrl) {
                const img = document.createElement("img");
                img.className = "wfsmm-detail-image";
                img.src = poi.imageUrl;

                Object.assign(img.style, {
                    width: "100%",
                    height: "100%",
                    objectFit: "cover", // fill the circle, clipped
                    display: "block",
                    cursor: "pointer",
                });

                img.addEventListener("click", () => {
                    openWayspotDetailOverlay(poi);
                });

                imgBox.appendChild(img);
            } else {
                const placeholder = document.createElement("div");
                placeholder.className = "wfsmm-detail-image-placeholder";
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
    // POI bridge (cross-userscript data bus)
    // ==================================

    function ensurePoiBridgeElement() {
        let el = document.getElementById("wfsmm-poi-bridge");
        if (!el) {
            el = document.createElement("div");
            el.id = "wfsmm-poi-bridge";
            el.style.display = "none";
            el.setAttribute("data-wfsmm-bridge", "1");
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
            guid: payload.guid || payload.id || null,
            title: payload.title || "(untitled)",
            description: payload.description || payload.desc || "",
            lat: typeof payload.lat === "number" ? payload.lat : Number(payload.lat),
            lng: typeof payload.lng === "number" ? payload.lng : Number(payload.lng),
            imageUrl: payload.imageUrl || payload.image || "",
            status: payload.status || "",
            source: payload.source || "",
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
            source: "wfsmm-main",
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
<div class="agm-info-window-content" style="position:relative;">

    <div class="wf-nearby-iw-content flex flex-col max-w-[240px]">

        <!-- Header: title + close button -->
        <div class="wf-iw-header"
             style="
                 display:flex;
                 align-items:flex-start;
                 gap:4px;
                 margin-top:6px;
                 margin-bottom:4px;
             "
        >
            <!-- Title (flexes, clips with …) -->
            <div
                class="wf-iw-title font-medium text-base"
                title="${title}"
                style="
                    flex:1 1 auto;
                    min-width:0;
                    color:#000;
                "
            >
                <span
                    class="wf-copy-title"
                    data-copy="${title.replace(/"/g, '&quot;')}"
                    title="Click to copy title"
                    style="
                        cursor:pointer;
                        text-decoration:none;
                        display:block;
                        white-space:nowrap;
                        overflow:hidden;
                        text-overflow:ellipsis;
                    "
                >
                    ${title}
                </span>
            </div>

            <!-- Close button (fixed width on the right) -->
            <button
                class="wf-iw-close"
                title="Close"
                style="
                    flex:0 0 24px;
                    width:24px;
                    height:24px;
                    border-radius:9999px;
                    display:flex;
                    align-items:center;
                    justify-content:center;
                    font-size:16px;
                    font-weight:600;
                    cursor:pointer;
                    background:#ffffff;
                    color:#000000;
                    border:1px solid rgba(0,0,0,0.15);
                "
            >
                ×
            </button>
        </div>

        <!-- Coordinates -->
        <div class="text-xs text-gray-500 mb-2">
            <span
                class="wf-copy-coords"
                data-lat="${latStr}"
                data-lng="${lngStr}"
                title="Click to copy coordinates"
                style="cursor:pointer; text-decoration:none; color:#333;"
            >
                ${latStr}, ${lngStr}
            </span>
        </div>

        <!-- Image -->
        <div style="width:240px; height:96px; overflow:hidden; margin-bottom:0.5rem;">
            <a href="${fullImgUrl}" target="_blank" rel="noopener noreferrer"
               style="display:block; width:100%; height:100%;">
                <img
                    src="${iwImgUrl}"
                    alt="${title}"
                    style="display:block; width:100%; height:100%; object-fit:cover;"
                >
            </a>
        </div>

        <!-- Description -->
        <div class="text-sm" style="color:#000;">
            ${desc}
        </div>
    </div>
</div>
`;
    }

    function attachInfoWindowDomHandlers() {
        // ---- Copy Coordinates ----
        const coordEl = document.querySelector(".wf-copy-coords");
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
            }); // optional: ensure no double binding
        }

        // ---- Copy Title ----
        const titleEl = document.querySelector(".wf-copy-title");
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
        const closeBtn = document.querySelector(".wf-iw-close");
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
        const existing = document.getElementById("wfsmm-wayspot-overlay");
        if (existing) {
            existing.remove();
        }

        const fullImgUrl = poi.imageUrl;
        const title = escapeHtml(poi.title || "(untitled)");
        const desc  = escapeHtml(poi.description || "");

        // Backdrop
        const backdrop = document.createElement("div");
        backdrop.id = "wfsmm-wayspot-overlay";
        backdrop.className = "wfsmm-wayspot-overlay-backdrop";

        // Dialog
        const dialog = document.createElement("div");
        dialog.className = "wfsmm-wayspot-overlay-dialog";

        // Header (title + close)
        const header = document.createElement("div");
        header.className = "wfsmm-wayspot-overlay-header";

        const titleEl = document.createElement("div");
        titleEl.className = "wfsmm-wayspot-overlay-title";
        titleEl.textContent = poi.title || "(untitled)";

        const closeBtn = document.createElement("button");
        closeBtn.type = "button";
        closeBtn.className = "wfsmm-wayspot-overlay-close";
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
        imageWrapper.className = "wfsmm-wayspot-overlay-image-link";

        const imgEl = document.createElement("img");
        imgEl.src = fullImgUrl;
        imgEl.alt = poi.title || "";
        imgEl.className = "wfsmm-wayspot-overlay-image";

        imageWrapper.appendChild(imgEl);

        // Description
        const descEl = document.createElement("div");
        descEl.className = "wfsmm-wayspot-overlay-desc";
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
        const mapCfg = userSettings.map

        openSettingsModal({
            id: "wfsmm-mapopt-backdrop",
            title: "Map options",
            buildContent(dialog) {
                // ---- General behaviour ----
                const generalSection = document.createElement("div");
                generalSection.className = "wfsmm-modal-section";

                const generalHeader = document.createElement("div");
                generalHeader.className = "wfsmm-modal-section-header";
                generalHeader.textContent = "General behaviour";
                generalSection.appendChild(generalHeader);

                const rememberChk = document.createElement("input");
                rememberChk.type = "checkbox";
                rememberChk.className = "wfsmm-modal-checkbox";
                rememberChk.checked = !!mapCfg.rememberLastView;
                generalSection.appendChild(
                    createSettingsRow("Remember last map view", rememberChk, {
                        narrowLabel: true
                    })
                );

                const exifChk = document.createElement("input");
                exifChk.type = "checkbox";
                exifChk.className = "wfsmm-modal-checkbox";
                exifChk.checked = (mapCfg.useExifInit !== false);
                generalSection.appendChild(
                    createSettingsRow("Use EXIF to initialise map marker when submitting", exifChk, {
                        narrowLabel: true
                    })
                );

                dialog.appendChild(generalSection);

                // ---- Circle configs (init from mapCfg) ----
                const nr = mapCfg.nearbyRadius || (mapCfg.nearbyRadius = {
                    enabled: true,
                    strokeColor: "#4285F4",
                    strokeOpacity: 0.8,
                    strokeWidth: 2,
                    fillColor: "#4285F4",
                    fillOpacity: 0.0
                });

                const sr = mapCfg.submitRadius || (mapCfg.submitRadius = {
                    enabled: false,
                    strokeColor: "#8b5cf6",
                    strokeOpacity: 0.8,
                    strokeWidth: 2,
                    fillColor: "#8b5cf6",
                    fillOpacity: 0.0
                });

                const spr = mapCfg.interactRadius || (mapCfg.interactRadius = {
                    enabled: true,
                    strokeColor: "#ff00ff",
                    strokeOpacity: 0.9,
                    strokeWidth: 2,
                    fillColor: "#ff00ff",
                    fillOpacity: 0.05
                });

                // ---- Circle overlays section with table ----
                const circlesSection = document.createElement("div");
                circlesSection.className = "wfsmm-modal-section";

                const circlesHeader = document.createElement("div");
                circlesHeader.className = "wfsmm-modal-section-header";
                circlesHeader.textContent = "Circle overlays";
                circlesSection.appendChild(circlesHeader);

                const table = document.createElement("table");
                table.className = "wfsmm-circle-table";

                Object.assign(table.style, {
                    width: "100%",
                    borderCollapse: "collapse",
                    fontSize: "11px",
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

                // Helper: narrow colour inputs
                function styleColorInput(input) {
                    input.className = "wfsmm-modal-color";
                    input.style.width = "26px";
                    input.style.padding = "0";
                }

                // Helper: centre numeric inputs
                function styleNumericInput(input) {
                    input.className = "wfsmm-modal-input-small";
                    input.style.textAlign = "center";
                }

                // Header row (columns in order of size)
                // 1) Interaction Radius (80m) – interactRadius
                // 2) Nearby Wayspots (200m)  – nearbyRadius
                // 3) Submission Range (10km) – submitRadius
                const headerRow = document.createElement("tr");

                const thLabel = makeTH("");
                thLabel.style.textAlign = "left";

                const thSelected = makeTH("Interaction Radius (80m)");
                const thNearby = makeTH("Nearby Wayspots (200m)");
                const thSubmit = makeTH("Submission Range (10km)");

                headerRow.appendChild(thLabel);
                headerRow.appendChild(thSelected);
                headerRow.appendChild(thNearby);
                headerRow.appendChild(thSubmit);
                table.appendChild(headerRow);

                // ---- Row 1: Show / enabled ----
                const rowShow = document.createElement("tr");
                const showLabel = document.createElement("td");
                showLabel.textContent = "Show circle";
                showLabel.style.padding = "2px 4px";
                showLabel.style.whiteSpace = "nowrap";
                rowShow.appendChild(showLabel);

                const selectedEnabledChk = document.createElement("input");
                selectedEnabledChk.type = "checkbox";
                selectedEnabledChk.className = "wfsmm-modal-checkbox";
                selectedEnabledChk.checked = !!spr.enabled;

                const nearbyEnabledChk = document.createElement("input");
                nearbyEnabledChk.type = "checkbox";
                nearbyEnabledChk.className = "wfsmm-modal-checkbox";
                nearbyEnabledChk.checked = !!nr.enabled;

                const submitEnabledChk = document.createElement("input");
                submitEnabledChk.type = "checkbox";
                submitEnabledChk.className = "wfsmm-modal-checkbox";
                submitEnabledChk.checked = !!sr.enabled;

                const tdShowSelected = makeTD();
                const tdShowNearby = makeTD();
                const tdShowSubmit = makeTD();
                tdShowSelected.appendChild(selectedEnabledChk);
                tdShowNearby.appendChild(nearbyEnabledChk);
                tdShowSubmit.appendChild(submitEnabledChk);

                rowShow.appendChild(tdShowSelected);
                rowShow.appendChild(tdShowNearby);
                rowShow.appendChild(tdShowSubmit);
                table.appendChild(rowShow);

                // ---- Row 2: Line colour ----
                const rowLineColor = document.createElement("tr");
                const lineColorLabel = document.createElement("td");
                lineColorLabel.textContent = "Line colour";
                lineColorLabel.style.padding = "2px 4px";
                lineColorLabel.style.whiteSpace = "nowrap";
                rowLineColor.appendChild(lineColorLabel);

                const selectedStrokeColorInput = document.createElement("input");
                selectedStrokeColorInput.type = "color";
                selectedStrokeColorInput.value = spr.strokeColor || "#ff00ff";
                styleColorInput(selectedStrokeColorInput);

                const nearbyStrokeColorInput = document.createElement("input");
                nearbyStrokeColorInput.type = "color";
                nearbyStrokeColorInput.value = nr.strokeColor || "#4285F4";
                styleColorInput(nearbyStrokeColorInput);

                const submitStrokeColorInput = document.createElement("input");
                submitStrokeColorInput.type = "color";
                submitStrokeColorInput.value = sr.strokeColor || "#8b5cf6";
                styleColorInput(submitStrokeColorInput);

                const tdLCSelected = makeTD();
                const tdLCNearby = makeTD();
                const tdLCSubmit = makeTD();
                tdLCSelected.appendChild(selectedStrokeColorInput);
                tdLCNearby.appendChild(nearbyStrokeColorInput);
                tdLCSubmit.appendChild(submitStrokeColorInput);

                rowLineColor.appendChild(tdLCSelected);
                rowLineColor.appendChild(tdLCNearby);
                rowLineColor.appendChild(tdLCSubmit);
                table.appendChild(rowLineColor);

                // ---- Row 3: Line thickness ----
                const rowLineWidth = document.createElement("tr");
                const lineWidthLabel = document.createElement("td");
                lineWidthLabel.textContent = "Line thickness";
                lineWidthLabel.style.padding = "2px 4px";
                lineWidthLabel.style.whiteSpace = "nowrap";
                rowLineWidth.appendChild(lineWidthLabel);

                const selectedStrokeWidthInput = document.createElement("input");
                selectedStrokeWidthInput.type = "number";
                selectedStrokeWidthInput.min = "0";
                selectedStrokeWidthInput.max = "10";
                selectedStrokeWidthInput.step = "0.5";
                selectedStrokeWidthInput.value = spr.strokeWidth ?? 2;
                styleNumericInput(selectedStrokeWidthInput);

                const nearbyStrokeWidthInput = document.createElement("input");
                nearbyStrokeWidthInput.type = "number";
                nearbyStrokeWidthInput.min = "0";
                nearbyStrokeWidthInput.max = "10";
                nearbyStrokeWidthInput.step = "0.5";
                nearbyStrokeWidthInput.value = nr.strokeWidth ?? 2;
                styleNumericInput(nearbyStrokeWidthInput);

                const submitStrokeWidthInput = document.createElement("input");
                submitStrokeWidthInput.type = "number";
                submitStrokeWidthInput.min = "0";
                submitStrokeWidthInput.max = "10";
                submitStrokeWidthInput.step = "0.5";
                submitStrokeWidthInput.value = sr.strokeWidth ?? 2;
                styleNumericInput(submitStrokeWidthInput);

                const tdLWSelected = makeTD();
                const tdLWNearby = makeTD();
                const tdLWSubmit = makeTD();
                tdLWSelected.appendChild(selectedStrokeWidthInput);
                tdLWNearby.appendChild(nearbyStrokeWidthInput);
                tdLWSubmit.appendChild(submitStrokeWidthInput);

                rowLineWidth.appendChild(tdLWSelected);
                rowLineWidth.appendChild(tdLWNearby);
                rowLineWidth.appendChild(tdLWSubmit);
                table.appendChild(rowLineWidth);

                // ---- Row 4: Line opacity ----
                const rowLineOpacity = document.createElement("tr");
                const lineOpacityLabel = document.createElement("td");
                lineOpacityLabel.textContent = "Line opacity";
                lineOpacityLabel.style.padding = "2px 4px";
                lineOpacityLabel.style.whiteSpace = "nowrap";
                rowLineOpacity.appendChild(lineOpacityLabel);

                const selectedStrokeOpacityInput = document.createElement("input");
                selectedStrokeOpacityInput.type = "number";
                selectedStrokeOpacityInput.min = "0";
                selectedStrokeOpacityInput.max = "1";
                selectedStrokeOpacityInput.step = "0.05";
                selectedStrokeOpacityInput.value = spr.strokeOpacity ?? 0.9;
                styleNumericInput(selectedStrokeOpacityInput);

                const nearbyStrokeOpacityInput = document.createElement("input");
                nearbyStrokeOpacityInput.type = "number";
                nearbyStrokeOpacityInput.min = "0";
                nearbyStrokeOpacityInput.max = "1";
                nearbyStrokeOpacityInput.step = "0.05";
                nearbyStrokeOpacityInput.value = nr.strokeOpacity ?? 0.8;
                styleNumericInput(nearbyStrokeOpacityInput);

                const submitStrokeOpacityInput = document.createElement("input");
                submitStrokeOpacityInput.type = "number";
                submitStrokeOpacityInput.min = "0";
                submitStrokeOpacityInput.max = "1";
                submitStrokeOpacityInput.step = "0.05";
                submitStrokeOpacityInput.value = sr.strokeOpacity ?? 0.8;
                styleNumericInput(submitStrokeOpacityInput);

                const tdLOSelected = makeTD();
                const tdLONearby = makeTD();
                const tdLOSubmit = makeTD();
                tdLOSelected.appendChild(selectedStrokeOpacityInput);
                tdLONearby.appendChild(nearbyStrokeOpacityInput);
                tdLOSubmit.appendChild(submitStrokeOpacityInput);

                rowLineOpacity.appendChild(tdLOSelected);
                rowLineOpacity.appendChild(tdLONearby);
                rowLineOpacity.appendChild(tdLOSubmit);
                table.appendChild(rowLineOpacity);

                // ---- Row 5: Fill colour ----
                const rowFillColor = document.createElement("tr");
                const fillColorLabel = document.createElement("td");
                fillColorLabel.textContent = "Fill colour";
                fillColorLabel.style.padding = "2px 4px";
                fillColorLabel.style.whiteSpace = "nowrap";
                rowFillColor.appendChild(fillColorLabel);

                const selectedFillColorInput = document.createElement("input");
                selectedFillColorInput.type = "color";
                selectedFillColorInput.value = spr.fillColor || "#ff00ff";
                styleColorInput(selectedFillColorInput);

                const nearbyFillColorInput = document.createElement("input");
                nearbyFillColorInput.type = "color";
                nearbyFillColorInput.value = nr.fillColor || "#4285F4";
                styleColorInput(nearbyFillColorInput);

                const submitFillColorInput = document.createElement("input");
                submitFillColorInput.type = "color";
                submitFillColorInput.value = sr.fillColor || "#8b5cf6";
                styleColorInput(submitFillColorInput);

                const tdFCSelected = makeTD();
                const tdFCNearby = makeTD();
                const tdFCSubmit = makeTD();
                tdFCSelected.appendChild(selectedFillColorInput);
                tdFCNearby.appendChild(nearbyFillColorInput);
                tdFCSubmit.appendChild(submitFillColorInput);

                rowFillColor.appendChild(tdFCSelected);
                rowFillColor.appendChild(tdFCNearby);
                rowFillColor.appendChild(tdFCSubmit);
                table.appendChild(rowFillColor);

                // ---- Row 6: Fill opacity ----
                const rowFillOpacity = document.createElement("tr");
                const fillOpacityLabel = document.createElement("td");
                fillOpacityLabel.textContent = "Fill opacity";
                fillOpacityLabel.style.padding = "2px 4px";
                fillOpacityLabel.style.whiteSpace = "nowrap";
                rowFillOpacity.appendChild(fillOpacityLabel);

                const selectedFillOpacityInput = document.createElement("input");
                selectedFillOpacityInput.type = "number";
                selectedFillOpacityInput.min = "0";
                selectedFillOpacityInput.max = "1";
                selectedFillOpacityInput.step = "0.05";
                selectedFillOpacityInput.value = spr.fillOpacity ?? 0.05;
                styleNumericInput(selectedFillOpacityInput);

                const nearbyFillOpacityInput = document.createElement("input");
                nearbyFillOpacityInput.type = "number";
                nearbyFillOpacityInput.min = "0";
                nearbyFillOpacityInput.max = "1";
                nearbyFillOpacityInput.step = "0.05";
                nearbyFillOpacityInput.value = nr.fillOpacity ?? 0.0;
                styleNumericInput(nearbyFillOpacityInput);

                const submitFillOpacityInput = document.createElement("input");
                submitFillOpacityInput.type = "number";
                submitFillOpacityInput.min = "0";
                submitFillOpacityInput.max = "1";
                submitFillOpacityInput.step = "0.05";
                submitFillOpacityInput.value = sr.fillOpacity ?? 0.0;
                styleNumericInput(submitFillOpacityInput);

                const tdFOSelected = makeTD();
                const tdFONearby = makeTD();
                const tdFOSubmit = makeTD();
                tdFOSelected.appendChild(selectedFillOpacityInput);
                tdFONearby.appendChild(nearbyFillOpacityInput);
                tdFOSubmit.appendChild(submitFillOpacityInput);

                rowFillOpacity.appendChild(tdFOSelected);
                rowFillOpacity.appendChild(tdFONearby);
                rowFillOpacity.appendChild(tdFOSubmit);
                table.appendChild(rowFillOpacity);

                circlesSection.appendChild(table);
                dialog.appendChild(circlesSection);

                // Return references needed by onOk
                return {
                    rememberChk,
                    exifChk,
                    nr,
                    sr,
                    spr,
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
                    exifChk,
                    nr,
                    sr,
                    spr,
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
                mapCfg.useExifInit = !!exifChk.checked;

                // Nearby
                nr.enabled = !!nearbyEnabledChk.checked;
                nr.strokeColor = nearbyStrokeColorInput.value || "#4285F4";
                nr.strokeWidth = clamp(nearbyStrokeWidthInput.value, 0, 10, 2);
                nr.strokeOpacity = clamp(nearbyStrokeOpacityInput.value, 0, 1, 0.8);
                nr.fillColor = nearbyFillColorInput.value || "#4285F4";
                nr.fillOpacity = clamp(nearbyFillOpacityInput.value, 0, 1, 0.0);

                // Submit
                sr.enabled = !!submitEnabledChk.checked;
                sr.strokeColor = submitStrokeColorInput.value || "#8b5cf6";
                sr.strokeWidth = clamp(submitStrokeWidthInput.value, 0, 10, 2);
                sr.strokeOpacity = clamp(submitStrokeOpacityInput.value, 0, 1, 0.8);
                sr.fillColor = submitFillColorInput.value || "#8b5cf6";
                sr.fillOpacity = clamp(submitFillOpacityInput.value, 0, 1, 0.0);

                // Selected / Interaction radius
                spr.enabled = !!selectedEnabledChk.checked;
                spr.strokeColor = selectedStrokeColorInput.value || "#ff00ff";
                spr.strokeWidth = clamp(selectedStrokeWidthInput.value, 0, 10, 2);
                spr.strokeOpacity = clamp(selectedStrokeOpacityInput.value, 0, 1, 0.9);
                spr.fillColor = selectedFillColorInput.value || "#ff00ff";
                spr.fillOpacity = clamp(selectedFillOpacityInput.value, 0, 1, 0.05);

                saveSettings();
                updateNearbyWayspotsRadiusCircle();
                updateSubmitRadiusCircle();

                // Optional: immediately refresh the selected POI circle if one is active
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
            id: "wfsmm-marker-backdrop",
            title: "Marker options",
            buildContent(dialog) {
                const typeSection = document.createElement("div");
                typeSection.className = "wfsmm-modal-section";

                const typeHeader = document.createElement("div");
                typeHeader.className = "wfsmm-modal-section-header";
                typeHeader.textContent = "Marker type";
                typeSection.appendChild(typeHeader);

                const typeSelect = document.createElement("select");
                typeSelect.className = "wfsmm-modal-select";
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
                thumbSection.className = "wfsmm-modal-section";

                const thumbHeader = document.createElement("div");
                thumbHeader.className = "wfsmm-modal-section-header";
                thumbHeader.textContent = "Thumbnail marker border";
                thumbSection.appendChild(thumbHeader);

                const thumbBorderColorInput = document.createElement("input");
                thumbBorderColorInput.type = "color";
                thumbBorderColorInput.className = "wfsmm-modal-color";
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
                thumbBorderWidthInput.className = "wfsmm-modal-input-small";
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
                thumbBorderOpacityInput.className = "wfsmm-modal-input-small";
                thumbBorderOpacityInput.value = poi.thumbnail.borderOpacity ?? 0.7;
                thumbSection.appendChild(
                    createSettingsRow("Border opacity (0–1)", thumbBorderOpacityInput, {
                        narrowLabel: true
                    })
                );

                dialog.appendChild(thumbSection);

                // Generic section
                const genSection = document.createElement("div");
                genSection.className = "wfsmm-modal-section";

                const genHeader = document.createElement("div");
                genHeader.className = "wfsmm-modal-section-header";
                genHeader.textContent = "Generic marker style";
                genSection.appendChild(genHeader);

                const genBorderColorInput = document.createElement("input");
                genBorderColorInput.type = "color";
                genBorderColorInput.className = "wfsmm-modal-color";
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
                genBorderWidthInput.className = "wfsmm-modal-input-small";
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
                genBorderOpacityInput.className = "wfsmm-modal-input-small";
                genBorderOpacityInput.value = poi.generic.borderOpacity ?? 1.0;
                genSection.appendChild(
                    createSettingsRow("Border opacity (0–1)", genBorderOpacityInput, {
                        narrowLabel: true
                    })
                );

                const genFillColorInput = document.createElement("input");
                genFillColorInput.type = "color";
                genFillColorInput.className = "wfsmm-modal-color";
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
                genFillOpacityInput.className = "wfsmm-modal-input-small";
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
        row.className = "wfsmm-modal-row";
        if (opts.narrowLabel) {
            row.classList.add("wfsmm-modal-row--narrow");
        }

        const label = document.createElement("label");
        label.textContent = labelText;

        row.appendChild(label);
        row.appendChild(inputEl);
        return row;
    }

    function openSettingsModal({id, title, buildContent, onOk}) {
        if (document.getElementById(id)) return; // already open

        const backdrop = document.createElement("div");
        backdrop.id = id;
        backdrop.className = "wfsmm-modal-backdrop";

        const dialog = document.createElement("div");
        dialog.className = "wfsmm-modal-dialog";

        if (id === "wfsmm-mapopt-backdrop") {
            dialog.style.width = "350px";
            dialog.style.maxWidth = "350px";
        }

        const header = document.createElement("div");
        header.className = "wfsmm-modal-title";
        header.textContent = title;
        dialog.appendChild(header);

        // Let the caller build sections + inputs and return whatever they need
        const ctx = buildContent(dialog);

        // Footer
        const footer = document.createElement("div");
        footer.className = "wfsmm-modal-footer";

        const cancelBtn = document.createElement("button");
        cancelBtn.type = "button";
        cancelBtn.textContent = "Cancel";
        cancelBtn.className = "wfsmm-modal-btn";

        const okBtn = document.createElement("button");
        okBtn.type = "button";
        okBtn.textContent = "OK";
        okBtn.className = "wfsmm-modal-btn wfsmm-modal-btn-primary";

        footer.appendChild(cancelBtn);
        footer.appendChild(okBtn);
        dialog.appendChild(footer);

        function closeModal() {
            document.removeEventListener("keydown", escHandler);
            backdrop.remove();
        }

        function escHandler(ev) {
            if (ev.key === "Escape") {
                closeModal();
            } else if (ev.key === "Enter") {
                ev.preventDefault();
                okBtn.click();
            }
        }

        cancelBtn.addEventListener("click", closeModal);
        okBtn.addEventListener("click", () => {
            onOk(ctx, closeModal);
        });
        backdrop.addEventListener("click", (ev) => {
            if (ev.target === backdrop) {
                closeModal();
            }
        });
        document.addEventListener("keydown", escHandler);

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
            '.center-pin-container .center-pin[src*="map_selection_pin.svg"]'
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
        // Hide Niantic's overlay and use our own
        hideNativeCenterPin();
        ensureCenterPinOverlay();

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

        // Side panel: expand in desktop
        sidePanelCollapsed = false;
        applySidePanelCollapseState();

        // Close any open InfoWindow when leaving mobile mode
        if (poiInfoWindow) {
            poiInfoWindow.close();
        }
    }

    function initMapModeWatcher() {
        const updateMode = () => {
            const newMode = detectMapMode();
            if (!newMode || newMode === currentMapMode) return;

            const oldMode = currentMapMode;
            currentMapMode = newMode;
            window.wfsmmMapMode = newMode;

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
        const pinContainer = document.querySelector(".center-pin-container");
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
            const el = document.querySelector('.text-gray-400.text-xs');
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

        if (currentMapMode === MAP_MODE.MOBILE) {
            hideNativeCenterPin();
            ensureCenterPinOverlay();
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
    }

    function setGoogleMapControls() {
        submitMap.setOptions({
            clickableIcons: false,
            cameraControl: false,
            // fullscreenControl: true,
        });

        let mapTypeControlOptions = {
            style: google.maps.MapTypeControlStyle.HORIZONTAL_BAR,
            position: google.maps.ControlPosition.TOP_LEFT,
            mapTypeIds: ["roadmap", "satellite", "hybrid"]
        };

        submitMap.setOptions({
            mapTypeControl: true,
            mapTypeControlOptions
        });
    }

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

    function initUserLocationMarker(map) {
        userLocationMarker = new google.maps.Marker({
            map,
            clickable: false,
            zIndex: 9999,
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
    // Right click to copy coordinates
    // ==================================

    function initMapRightClickCopy() {
        if (!submitMap || typeof google === "undefined" || !google.maps) return;
        if (submitMap._wfsmmRightClickBound) return; // guard so we only bind once
        submitMap._wfsmmRightClickBound = true;

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
        menu.className = "wfsmm-map-context-menu";
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

        // Optional: also copy when clicking the text itself
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

    const MAP_VIEW_KEY = "wfsmm-map-view";

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
        console.log('trySelectDeepLinkedPoi');
        if (!deepLinkTarget || !Array.isArray(window.currentPois) || window.currentPois.length === 0) {
            return;
        }

        const { lat: targetLat, lng: targetLng } = deepLinkTarget;
        if (!Number.isFinite(targetLat) || !Number.isFinite(targetLng)) return;

        const MAX_DISTANCE_METRES = 2;

        let closestPoi = null;
        let closestDistance = Infinity;

        console.log(window.currentPois);
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
            source: "wfsmm-deeplink"
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

        // Optional: zoom in a bit if too far out
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
            radiusMeters: 10000,
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

        // Thumbnail marker (image-based)
        if (markerType === 'thumbnail') {
            const size = 36;
            const iconUrl = poi.imageUrl + `=s${size}-c`;

            const marker = new google.maps.Marker({
                position: {
                    lat: poi.lat,
                    lng: poi.lng
                },
                map: submitMap,
                title: poi.title,
                icon: {
                    url: iconUrl,
                    scaledSize: new google.maps.Size(size, size),
                    anchor: new google.maps.Point(size / 2, size / 2)
                }
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
            map: submitMap,
            title: poi.title,
            icon: {
                path: google.maps.SymbolPath.CIRCLE,
                strokeColor: g.borderColor,
                strokeOpacity: g.borderOpacity,
                strokeWeight: g.borderWidth,
                fillColor: g.fillColor,
                fillOpacity: g.fillOpacity,
                scale: 8 // tweak if you want bigger/smaller circle
            }
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
                source: "wfsmm-main-marker"
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
        document.querySelectorAll(".wfsmm-marker-selected").forEach((el) => {
            el.classList.remove("wfsmm-marker-selected");
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
            img.classList.add("wfsmm-marker-selected");
        });
    }

    // ==================================
    // Exif Data
    // ==================================

    function watchForMainPhotoUploadAndApplyExif() {
        const intervalMs = 1000;

        const scan = () => {
            const sections = document.querySelectorAll('div.section');

            sections.forEach(section => {
                const h4 = section.querySelector('h4 span.step-number');
                if (!h4) return;

                const stepNum = h4.textContent.trim();

                // Only add event listening to the "Step 1" (Wayspot Photo) button
                // This is to avoid supporting photo exif overwriting main photo
                if (stepNum !== "1") return;

                const container = section.querySelector('app-wayspot-image-entry .image-entry-container');
                if (!container) return;

                if (!container._wfsmmClickHooked) {
                    container._wfsmmClickHooked = true;

                    container.addEventListener("click", () => {
                        let attempts = 0;
                        const maxAttempts = 60;

                        const findInput = () => {
                            attempts++;
                            const input = document.querySelector("#file-input");

                            if (input) {
                                attachExifListenerToFileInput(input);
                                return;
                            }

                            if (attempts < maxAttempts) {
                                setTimeout(findInput, 500);
                            } else {
                                console.warn("Wayfarer Map: #file-input not found (Section 1) after all attempts");
                            }
                        };

                        findInput();
                    });
                }
            });

            setTimeout(scan, intervalMs);
        };

        scan();
    }

    function attachExifListenerToFileInput(input) {
        if (!input) return;
        if (input._wfsmmExifHooked) return;
        input._wfsmmExifHooked = true;

        input.addEventListener('change', async (e) => {
            const files = e.target.files;
            if (!files || !files.length) return;

            const file = files[0];

            const type = file.type || "";
            const name = file.name || "";

            const gps = await extractGpsFromFileOrBuffer(file);
            if (!gps) {
                console.info("Wayfarer Map: No GPS EXIF data found in selected image (or not supported).");
                return;
            }

            console.info("Wayfarer Map: EXIF GPS found:", gps.lat, gps.lng);
            moveMapToExifCoords(gps.lat, gps.lng);
        });
    }

    async function extractGpsFromFileOrBuffer(fileOrBuffer) {
        if (typeof exifr === "undefined" || !exifr.gps) {
            console.warn("Wayfarer Map: exifr library not available");
            return null;
        }

        try {
            // exifr can take File, Blob, ArrayBuffer, etc.
            const gps = await exifr.gps(fileOrBuffer);

            // gps is usually { latitude, longitude, altitude, ... }
            if (!gps || gps.latitude == null || gps.longitude == null) {
                return null;
            }

            return {
                lat: gps.latitude,
                lng: gps.longitude
            };
        } catch (e) {
            console.warn("Wayfarer Map: Failed to read EXIF with exifr:", e);
            return null;
        }
    }

    function moveMapToExifCoords(lat, lng) {
        if (!submitMap || typeof google === "undefined" || !google.maps) return;

        const latLng = new google.maps.LatLng(lat, lng);

        // Center the map
        submitMap.setCenter(latLng);

        // Trigger Wayfarer’s own handler so the pin + address update
        google.maps.event.trigger(submitMap, "click", {
            latLng
        });
    }

    // ==================================
    // Wayspot image entry tweaks
    // ==================================

    function initWayspotImageEntryWatcher() {
        const observer = new MutationObserver(mutations => {
            for (const m of mutations) {
                for (const node of m.addedNodes) {
                    if (!(node instanceof HTMLElement)) continue;

                    // Must be <div class="image-container">
                    if (!node.matches("div.image-container")) continue;

                    // Must be inside <app-wayspot-image-entry>
                    if (!node.closest("app-wayspot-image-entry")) continue;

                    fixMainPhotoAspectRatioForContainer(node);
                }
            }
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true
        });
    }

    function fixMainPhotoAspectRatioForContainer(container) {
        // Remove the width restrictions on the main photo to allow proper aspect ratio to show
        container.style.setProperty("--width", "auto");
        container.style.display = "inline-flex";
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
       WAYFARER MAP MOD - COMBINED CSS (MODAL + MARKERS + SIDEBAR)
       ============================================================ */

    /* -------------------------
       Modal Backdrop + Dialog
       ------------------------- */
    .wfsmm-modal-backdrop {
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

    .wfsmm-modal-dialog {
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

    .wfsmm-modal-title {
        font-size: 15px;
        font-weight: 600;
        margin-bottom: 10px;
    }

    .wfsmm-modal-section {
        border-bottom: 1px solid #e5e7eb;
        padding-bottom: 6px;
        margin-bottom: 6px;
    }

    .wfsmm-modal-section:last-of-type {
        border-bottom: none;
        padding-bottom: 0;
        margin-bottom: 0;
    }

    .wfsmm-modal-section-header {
        font-weight: 500;
        margin-bottom: 4px;
    }

    .wfsmm-modal-row {
        display: flex;
        align-items: center;
        margin-bottom: 3px;
        gap: 4px;
    }

    .wfsmm-modal-row label {
        flex: 0 0 150px;
        font-size: 11px;
        color: #374151;
    }

    .wfsmm-modal-row--narrow label {
        flex: 0 0 140px;
    }

    .wfsmm-modal-input-small {
        width: 60px;
        padding: 2px 4px;
        font-size: 11px;
        box-sizing: border-box;
    }

    .wfsmm-modal-color {
        width: 40px;
        height: 22px;
        padding: 0;
        border: none;
        background: none;
    }

    .wfsmm-modal-checkbox {
        width: 16px;
        height: 16px;
    }

    .wfsmm-modal-select {
        flex: 0 0 auto;
        padding: 2px 4px;
        font-size: 11px;
    }

    .wfsmm-modal-footer {
        display: flex;
        justify-content: flex-end;
        gap: 8px;
        margin-top: 6px;
    }

    .wfsmm-modal-btn {
        padding: 4px 10px;
        border-radius: 4px;
        border: 1px solid #d1d5db;
        background: #ffffff;
        cursor: pointer;
        font-size: 12px;
    }

    .wfsmm-modal-btn-primary {
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

    .gm-style div[style*="z-index: 1000"][style*="width: 36px"][style*="height: 56px"] {
        display: block !important;            /* make visible again */
        pointer-events: none !important;      /* cannot be clicked */
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
    #wfsmm-search-input::placeholder {
        color: #6B7280 !important;
    }
    #wfsmm-search-input:-ms-input-placeholder {
        color: #6B7280 !important;
    }
    #wfsmm-search-input::-ms-input-placeholder {
        color: #6B7280 !important;
    }

    /* -------------------------
       Settings & POI Function Links
       ------------------------- */
    .wfsmm-link-block {
        display: flex;
        flex-wrap: wrap;
        gap: 0px 4px;
        padding: 4px 0;
    }

    .wfsmm-link-block a {
        font-size: 12px;
        font-weight: 400;
        color: #6b7280;
        text-decoration: none;
        white-space: nowrap;
        cursor: pointer;
        padding: 0px 4px;
        border-radius: 3px;
    }

    .wfsmm-link-block a:hover {
        text-decoration: underline;
    }

    /* -------------------------
       Wayspot detail overlay
       ------------------------- */
    .wfsmm-wayspot-overlay-backdrop {
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

    .wfsmm-wayspot-overlay-dialog {
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

    .wfsmm-wayspot-overlay-header {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        margin-bottom: 8px;
        gap: 8px;
        width: 100%;
    }

    .wfsmm-wayspot-overlay-title {
        font-size: 15px;
        font-weight: 600;
        text-align: center;
        flex: 1 1 auto;
        width: 100%;
        overflow-wrap: anywhere;
        white-space: normal;
    }

    .wfsmm-wayspot-overlay-close {
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

    .wfsmm-wayspot-overlay-image-link {
       display: inline-block;
        margin-bottom: 8px;
        text-align: center;
    }

    .wfsmm-wayspot-overlay-image {
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

    .wfsmm-wayspot-overlay-desc {
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

    .wfsmm-sidepanel-root {
        transition: transform 0.25s ease-out;
    }

    /* Slide the panel to the right so only the tab remains visible.
       28px here should match the tab width. */
    .wfsmm-sidepanel-root.wfsmm-sidepanel-collapsed {
        transform: translateX(calc(100% + 11px));
    }

    #wfsmm-sidepanel-toggle {
        position: absolute;
        top: 50%;
        left: -20px;              /* stick it on the left edge */
        transform: translateY(-50%);
        width: 20px;
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

    #wfsmm-sidepanel-toggle:hover {
        background: #e5e7eb;
    }

    /* -------------------------
       Selected marker highlight
       ------------------------- */

    /* Thumbnail markers (lh3 Googleusercontent icons) */
    .gm-style img[src*="lh3.googleusercontent.com"][src*="=s36-c"].wfsmm-marker-selected {
        border-color: #ff00ff !important;
        border-width: 3px !important;
        border-style: solid !important;
        opacity: 1 !important;
    }

    /* Fallback: any marker image with this class */
    .gm-style img.wfsmm-marker-selected {
        border-color: #ff00ff !important;
        border-width: 3px !important;
        border-style: solid !important;
        opacity: 1 !important;
    }

    `;

        let style = document.getElementById("wfsmm-all-css");
        if (style) {
            // Update existing style with new settings
            style.textContent = cssText;
        } else {
            // First time: create it
            style = document.createElement("style");
            style.id = "wfsmm-all-css";
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
    updateSidebarActiveForMapMode();

    // Keep behaviour in sync with SPA navigation
    window.addEventListener('popstate', () => {
        formatPageForMapMode();
        updateSidebarActiveForMapMode();
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
        watchForMainPhotoUploadAndApplyExif();
        initWayspotImageEntryWatcher();
        initMapModeWatcher();
        startPoiBridgeObserver();
        initSidenavPaddingRouteWatcher();
    }
    init();

})();