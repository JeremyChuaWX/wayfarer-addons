// ==UserScript==
// @name         Wayfarer Map Mods - Exif Auto-Center
// @version      0.0.2
// @description  Read EXIF GPS from the main photo upload and auto-center the submit map.
// @namespace    https://gitlab.com/Tntnnbltn/wayfarer-addons
// @downloadURL  https://gitlab.com/Tntnnbltn/wayfarer-addons/-/raw/main/wayfarer-map-mods-exif-auto-center.user.js
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
// <https://gitlab.com/Tntnnbltn/wayfarer-addons/-/blob/main/LICENSE>
// If not, see <https://www.gnu.org/licenses/>.

(function () {
    'use strict';

    // ================================
    // Helpers — get submit map instance
    // ================================

    /**
     * Locate the Wayfarer submit map instance by walking Angular's __ngContext__.
     * Resolves with the map or null after several attempts.
     */
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
                    console.log('[Exif Auto-Center] Found submit map');
                    resolve(foundMap);
                    return;
                }

                if (attempts-- <= 0) {
                    console.warn('[Exif Auto-Center] Failed to find submit map after several attempts');
                    resolve(null);
                    return;
                }

                setTimeout(tryFindMap, 250);
            }

            tryFindMap();
        });
    }

    /**
     * Center the submit map on the given latitude/longitude.
     * If the map is not ready yet, we'll wait for it.
     */
    async function centerMapOn(latitude, longitude) {
        const map = await getMap();
        if (!map) {
            console.warn('[Exif Auto-Center] Map not available, cannot center');
            return;
        }

        try {
            const latLng = new google.maps.LatLng(latitude, longitude);
            map.setCenter(latLng);

            // Optional: only adjust zoom if it's very zoomed out
            const currentZoom = map.getZoom();
            if (typeof currentZoom === 'number' && currentZoom < 17) {
                map.setZoom(17);
            }

            console.log('[Exif Auto-Center] Map centered on EXIF GPS', latitude, longitude);
        } catch (e) {
            console.error('[Exif Auto-Center] Failed to center map:', e);
        }
    }

    // ================================
    // EXIF handling
    // ================================

    /**
     * Attach a change listener to a file input so that when the user
     * selects an image, we read EXIF GPS and center the map.
     */
    function bindExifListenerToInput(input) {
        if (!input || input._wfsExifBound) return;
        input._wfsExifBound = true;

        console.log('[Exif Auto-Center] Binding EXIF listener to', input);

        input.addEventListener('change', async () => {
            const file = input.files && input.files[0];
            if (!file) return;

            console.log('[Exif Auto-Center] File selected, reading EXIF…', file.name);

            try {
                // exifr.gps returns only GPS-related tags; full.umd.js already loaded via @require
                const gps = await exifr.gps(file);
                if (!gps) {
                    console.log('[Exif Auto-Center] No EXIF GPS in image');
                    return;
                }

                const { latitude, longitude } = gps;
                if (typeof latitude === 'number' && typeof longitude === 'number') {
                    console.log('[Exif Auto-Center] Found GPS', latitude, longitude);
                    centerMapOn(latitude, longitude);
                } else {
                    console.log('[Exif Auto-Center] EXIF GPS missing lat/lng', gps);
                }
            } catch (err) {
                console.error('[Exif Auto-Center] EXIF parse failed', err);
            }
        });
    }

    /**
     * Look for the main photo upload input and bind the EXIF listener.
     * You can tweak selectors here if Niantic changes their DOM.
     */
    function scanForMainPhotoInputs(root = document) {
        const inputs = root.querySelectorAll(
            [
                // Typical main photo upload area in submit flow
                'app-wayspot-image-entry input[type="file"]',
                // Fallback for image-only file inputs
                'input[type="file"][accept*="image"]'
            ].join(', ')
        );

        if (inputs.length) {
            console.log('[Exif Auto-Center] Found image file inputs:', inputs.length);
        }

        inputs.forEach(bindExifListenerToInput);
    }

    // ================================
    // Bootstrapping / SPA handling
    // ================================

    // MutationObserver for SPA navigation + lazy-loaded components
    const mo = new MutationObserver(mutations => {
        for (const m of mutations) {
            for (const node of m.addedNodes) {
                if (!(node instanceof HTMLElement)) continue;

                // If a new submit component or image entry appears, rescan inside it
                if (node.matches &&
                    node.matches('app-submit-wayspot, app-wayspot-image-entry, form, div')
                ) {
                    scanForMainPhotoInputs(node);
                } else if (node.querySelector) {
                    scanForMainPhotoInputs(node);
                }
            }
        }
    });

    function startObservers() {
        mo.observe(document.documentElement, {
            childList: true,
            subtree: true
        });
        scanForMainPhotoInputs();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', startObservers);
    } else {
        startObservers();
    }

    // In case Wayfarer SPA routing swaps out the submit view
    window.addEventListener('popstate', () => {
        setTimeout(() => scanForMainPhotoInputs(), 500);
    });
})();
