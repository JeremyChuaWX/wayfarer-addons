// ==UserScript==
// @name         Wayfarer Submission Map Mods
// @version      0.0.1
// @description  Feature enhancement for the submission map
// @namespace    https://gitlab.com/Tntnnbltn/wayfarer-addons
// @downloadURL  https://gitlab.com/Tntnnbltn/wayfarer-addons/wayfarer-submission-map-mods.user.js
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


(function() {

    let submitMap = null;
    let poiMarkers = [];
    let poiInfoWindow = null;
    let markersByGuid = {};
    let poiRadiusCircle = null;
    let defaultMarkerObserver = null;
    let lastFetchLat = null;
    let lastFetchLng = null;
    let radius = 200;


    function init() {
        injectMarkerCss();
        initLatLngObserver();
        getSubmitMap();
    }

    // ------------------ LAT/LNG DIV OBSERVER -----------------------------

    function initLatLngObserver() {
        // Find the coordinates from the lat,lng displayed above the map
        const el = findLatLngDiv();
        if (!el) {
            setTimeout(initLatLngObserver, 500);
            return;
        }

        let lastText = el.textContent.trim();
        const initialCoords = parseLatLng(lastText);

        if (initialCoords) {
            window.currentLat = initialCoords.lat;
            window.currentLng = initialCoords.lng;
            clearDefaultMarkers();
            requestPoisAndRefreshMap(initialCoords.lat, initialCoords.lng);
        }

        // Check for when the coordinates change, i.e. marker is moved
        const observer = new MutationObserver(() => {
            const newText = el.textContent.trim();
            if (newText === lastText) return;
            lastText = newText;

            const coords = parseLatLng(newText);
            if (!coords) return;

            handleLatLngChange(coords.lat, coords.lng);
        });

        observer.observe(el, {
            childList: true,
            subtree: true,
            characterData: true
        });
    }

    function handleLatLngChange(newLat, newLng) {
        window.currentLat = newLat;
        window.currentLng = newLng;

        // Close any info window
        if (poiInfoWindow) {
            poiInfoWindow.close();
        }

        // If marker moved >20 metres, reload POIs
        // Avoid if <20 metres to prevent needless calls to the server
        const dist = distanceMeters(lastFetchLat, lastFetchLng, newLat, newLng);
        if (dist >= 20) {
            requestPoisAndRefreshMap(newLat, newLng);
        }
    }

    function requestPoisAndRefreshMap(lat, lng) {
        // Update coordinates for last fetched data
        // Used for checking if later moves are >20 metres
        lastFetchLat = lat;
        lastFetchLng = lng;

        // Request POI data for new position
        fetchLivePois(lat, lng);
    }

    function parseLatLng(text) {
        if (!text) return null;
        const parts = text.split(',');
        if (parts.length !== 2) return null;

        const lat = parseFloat(parts[0].trim());
        const lng = parseFloat(parts[1].trim());

        if (isNaN(lat) || isNaN(lng)) return null;
        return { lat, lng };
    }

    function findLatLngDiv() {
        return document.querySelector('.text-gray-400.text-xs');
    }

    function fetchLivePois(lat, lng) {
        const url = `/api/v1/vault/live-pois-in-radius?lat=${lat}&lng=${lng}&radius=${radius}`;

        const xhr = new XMLHttpRequest();
        xhr.open("GET", url, true);

        xhr.onload = function () {
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

    // ------------------ GET GOOGLE MAP INSTANCE ------------------------


    function getSubmitMap() {
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

    function clearDefaultMarkers() {
        // Remove the default duplicate markers placed on the map
        // These will be replaced with our own custom ones
        // Does not remove submission marker (z index 1000)
        const gmMarkers = document.querySelectorAll('.gm-style div');

        gmMarkers.forEach(el => {
            const w = el.style.width;
            const h = el.style.height;
            const z = el.style.zIndex;

            if (z === "1" && w === "36px" && h === "56px") {
                el.remove();
            }
        });
    }


    function updatePoisOnMap() {
        if (!submitMap || !Array.isArray(window.currentPois)) return;

        // Single InfoWindow reused for all markers
        if (!poiInfoWindow) {
            poiInfoWindow = new google.maps.InfoWindow();
        }

        // Draw 200m radius around loaded POI locations
        updatePoiRadiusCircle();

        // Build a set of guids from the new POI list
        const newGuids = new Set(window.currentPois.map(p => p.guid));

        // 1) Remove markers for POIs that are no longer in range
        removeStaleMarkers(newGuids);

        // 2) Add or update markers for current POIs
        for (const poi of window.currentPois) {
            upsertPoiMarker(poi);
        }

        poiMarkers = Object.values(markersByGuid).map(e => e.marker);
    }

    function updatePoiRadiusCircle() {
        if (!submitMap || lastFetchLat == null || lastFetchLng == null) {
            return;
        }

        const center = { lat: lastFetchLat, lng: lastFetchLng };

        if (!poiRadiusCircle) {
            poiRadiusCircle = new google.maps.Circle({
                map: submitMap,
                center,
                radius: radius,
                strokeColor: '#4285F4',
                strokeOpacity: 0.8,
                strokeWeight: 2,
                fillOpacity: 0.0,
                clickable: false
            });
        } else {
            poiRadiusCircle.setCenter(center);
            poiRadiusCircle.setRadius(radius);
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
        const iconUrl = poi.imageUrl + "=s36-c";

        const marker = new google.maps.Marker({
            position: { lat: poi.lat, lng: poi.lng },
            map: submitMap,
            title: poi.title,
            icon: {
                url: iconUrl,
                scaledSize: new google.maps.Size(36, 36),
                anchor: new google.maps.Point(18, 18)
            }
        });

        marker.addListener("click", () => {
            poiInfoWindow.setContent(createOverlay(poi));
            poiInfoWindow.open({
                map: submitMap,
                anchor: marker
            });
        });

        return marker;
    }

    function upsertPoiMarker(poi) {
        const guid = poi.guid;
        const existing = markersByGuid[guid];

        if (existing) {
            const marker = existing.marker;
            const pos = marker.getPosition();

            if (!pos || pos.lat() !== poi.lat || pos.lng() !== poi.lng) {
                marker.setPosition({ lat: poi.lat, lng: poi.lng });
            }

            existing.poi = poi;
        } else {
            const marker = createPoiMarker(poi);
            markersByGuid[guid] = { marker, poi };
        }
    }

    function createOverlay(poi) {
        const title = escapeHtml(poi.title);
        const desc = escapeHtml(poi.description || "");
        const latStr = poi.lat.toFixed(6);
        const lngStr = poi.lng.toFixed(6);

        const iwImgUrl = poi.imageUrl + "=w240"; // preview
        const fullImgUrl = poi.imageUrl + "=s0"; // open full size

        return `
            <div class="agm-info-window-content">
               <div class="wf-nearby-iw-content flex flex-col max-w-[240px]">

                   <!-- Title -->
                   <div class="font-medium truncate text-base mb-1" title="${title}">
                       ${title}
                   </div>

                   <!-- Lat / Lng -->
                   <div class="text-xs text-gray-500 mb-2">
                       ${latStr}, ${lngStr}
                   </div>

                   <!-- Image Banner -->
                   <div style="width: 240px; height: 96px; overflow:hidden; margin-bottom:0.5rem;">
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
                   <div class="text-sm">${desc}</div>
               </div>
           </div>
       `;
    }

    async function onPoisFetched() {
        if (!submitMap) {
            submitMap = await getSubmitMap();

            // Remove clickable POIs
            submitMap.setOptions({
                clickableIcons: false,  // disables click areas on POIs
            });

            clearDefaultMarkers();
            injectSearchBox();
        }
        updatePoisOnMap();
    }

    function injectSearchBox() {
        if (!submitMap) return;

        const input = document.createElement("input");
        input.type = "text";
        input.placeholder = "Search places or coordinates…";

        input.style.cssText = `
        position: absolute;
        top: 12px;
        left: 12px;
        z-index: 9999;
        width: 260px;
        padding: 6px 10px;
        border-radius: 4px;
        border: 1px solid #ccc;
        background: white;
        font-size: 14px;
        box-shadow: 0 2px 6px rgba(0,0,0,0.3);
    `;

        const mapDiv = submitMap.getDiv();
        mapDiv.style.position = "relative";
        mapDiv.appendChild(input);

        // Try to enable Places autocomplete if available
        try {
            const autocomplete = new google.maps.places.Autocomplete(input, {
                fields: ["geometry", "name"],
            });

            autocomplete.addListener("place_changed", () => {
                const place = autocomplete.getPlace();
                if (!place?.geometry) return;

                const loc = place.geometry.location;
                const lat = loc.lat();
                const lng = loc.lng();

                const latLng = new google.maps.LatLng(lat, lng);

                submitMap.setCenter(latLng);

                // Simulate a click at this location so Wayfarer's own handler runs
                google.maps.event.trigger(submitMap, "click", { latLng });
            });
        } catch (err) {
            console.warn("Places API not available; autocomplete disabled.", err);
        }

        // Support raw lat,lng input via Enter key
        input.addEventListener("keydown", (e) => {
            if (e.key !== "Enter") return;

            const parsed = parseLatLng(input.value.trim());
            if (!parsed) return;

            const { lat, lng } = parsed;
            const latLng = new google.maps.LatLng(lat, lng);

            submitMap.setCenter(latLng);
            google.maps.event.trigger(submitMap, "click", { latLng });
        });
    }


    function escapeHtml(str) {
        if (!str) return "";
        return String(str)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
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

    function injectMarkerCss() {
        const style = document.createElement('style');
        style.textContent = `
        /* Target Google Maps markers using the thumbnail URL pattern */
        .gm-style img[src*="lh3.googleusercontent.com"][src*="=s36-c"] {
            border-radius: 50% !important;
            width: 36px !important;
            height: 36px !important;
            object-fit: cover;
        }
    `;
        document.head.appendChild(style);
    }


    init();

})();