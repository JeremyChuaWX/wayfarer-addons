// ==UserScript==
// @name         Pokémon Go Map Search
// @version      0.1.0
// @description  Improves the functionality of the Pokemon Go Map search bar
// @namespace    https://gitlab.com/Tntnnbltn/wayfarer-addons
// @downloadURL  https://gitlab.com/Tntnnbltn/wayfarer-addons/-/raw/main/pokemon-go-map-search.user.js
// @updateURL    https://gitlab.com/Tntnnbltn/wayfarer-addons/-/raw/main/pokemon-go-map-search.user.js
// @homepageURL  https://gitlab.com/Tntnnbltn/wayfarer-addons
// @match        https://pokemongo.com/gamemap*
// @run-at       document-start
// @grant        unsafeWindow
// @grant        GM_xmlhttpRequest
// @connect      nominatim.openstreetmap.org
// @connect      photon.komoot.io
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


(() => {
    'use strict';

    const W = typeof unsafeWindow !== 'undefined' ? unsafeWindow : window;

    const CONFIG = {
        coordZoom: 17,
        searchZoom: 16,
    };

    const state = {
        maps: [],
        activeMap: null,
        marker: null,
        originalGoogle: W.google,
        uiInjected: false,
    };

    function debug(...args) {
        console.debug('[PGO Better Search]', ...args);
    }

    // ---------------------------------------------------------------------------
    // Geocoding via Tampermonkey, outside page CSP
    // ---------------------------------------------------------------------------

    function gmRequestJson(url) {
        return new Promise((resolve, reject) => {
            GM_xmlhttpRequest({
                method: 'GET',
                url,
                headers: {
                    Accept: 'application/json'
                },
                timeout: 15000,
                onload: response => {
                    if (response.status < 200 || response.status >= 300) {
                        reject(new Error(`HTTP ${response.status}`));
                        return;
                    }

                    try {
                        resolve(JSON.parse(response.responseText));
                    } catch (err) {
                        reject(new Error(`Invalid JSON: ${err.message}`));
                    }
                },
                onerror: () => reject(new Error('Network error')),
                ontimeout: () => reject(new Error('Request timed out')),
            });
        });
    }

    async function geocodeNominatim(query) {
        const url = new URL('https://nominatim.openstreetmap.org/search');
        url.searchParams.set('q', query);
        url.searchParams.set('format', 'jsonv2');
        url.searchParams.set('limit', '1');
        url.searchParams.set('addressdetails', '1');

        const results = await gmRequestJson(url.toString());

        if (!Array.isArray(results) || !results[0]) {
            throw new Error('No OpenStreetMap result');
        }

        const lat = Number(results[0].lat);
        const lng = Number(results[0].lon);

        if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
            throw new Error('OpenStreetMap result had invalid coordinates');
        }

        return {
            lat,
            lng,
            label: results[0].display_name || query,
            provider: 'OpenStreetMap',
        };
    }

    async function geocodePhoton(query) {
        const url = new URL('https://photon.komoot.io/api/');
        url.searchParams.set('q', query);
        url.searchParams.set('limit', '1');

        const data = await gmRequestJson(url.toString());
        const feature = data?.features?.[0];

        if (!feature?.geometry?.coordinates) {
            throw new Error('No Photon result');
        }

        const [lng, lat] = feature.geometry.coordinates;
        const props = feature.properties || {};

        return {
            lat: Number(lat),
            lng: Number(lng),
            label: [props.name, props.city, props.state, props.country].filter(Boolean).join(', ') || query,
            provider: 'Photon',
        };
    }

    async function autocompletePhoton(query) {
        const value = String(query || '').trim();
        if (value.length < 3) return [];

        const url = new URL('https://photon.komoot.io/api/');
        url.searchParams.set('q', value);
        url.searchParams.set('limit', '5');

        const data = await gmRequestJson(url.toString());

        const features = Array.isArray(data?.features) ? data.features : [];

        return features
            .map(feature => {
            const [lng, lat] = feature.geometry?.coordinates || [];
            const props = feature.properties || {};

            const main = props.name || props.street || props.city || props.county || value;
            const sub = [
                props.city,
                props.state,
                props.country,
            ].filter(Boolean).join(', ');

            return {
                lat: Number(lat),
                lng: Number(lng),
                label: sub ? `${main}, ${sub}` : main,
                main,
                sub,
                provider: 'Photon',
            };
        })
            .filter(r => Number.isFinite(r.lat) && Number.isFinite(r.lng));
    }

    async function geocodePublic(query) {
        const attempts = [
            query,
        ];

        const errors = [];

        for (const q of attempts) {
            try {
                return await geocodeNominatim(q);
            } catch (err) {
                errors.push(`OSM "${q}": ${err.message}`);
            }

            try {
                return await geocodePhoton(q);
            } catch (err) {
                errors.push(`Photon "${q}": ${err.message}`);
            }
        }

        console.warn('[PGO Better Search] Geocoder errors:', errors);
        throw new Error(`Could not find "${query}".`);
    }

    // ---------------------------------------------------------------------------
    // Google Maps capture
    // ---------------------------------------------------------------------------

    function isMapLike(obj) {
        return !!obj &&
            typeof obj.setCenter === 'function' &&
            typeof obj.setZoom === 'function' &&
            typeof obj.getCenter === 'function' &&
            typeof obj.getZoom === 'function' &&
            typeof obj.getDiv === 'function';
    }

    function registerMap(map, source) {
        if (!isMapLike(map)) return map;

        if (!state.maps.includes(map)) {
            state.maps.push(map);
            state.activeMap = map;
            W.__pgoBetterSearchMap = map;
            debug(`Captured map via ${source}`, map);
        }

        return map;
    }

    function patchMapPrototype(MapCtor) {
        if (!MapCtor?.prototype || MapCtor.prototype.__pgoBetterSearchPatched) return;

        for (const method of ['setCenter', 'setZoom', 'panTo', 'fitBounds', 'getCenter', 'getZoom', 'getDiv']) {
            const original = MapCtor.prototype[method];
            if (typeof original !== 'function') continue;

            MapCtor.prototype[method] = function(...args) {
                registerMap(this, `prototype.${method}`);
                return original.apply(this, args);
            };
        }

        MapCtor.prototype.__pgoBetterSearchPatched = true;
    }

    function wrapMapConstructor(MapCtor) {
        if (!MapCtor || MapCtor.__pgoBetterSearchWrapped) return MapCtor;

        patchMapPrototype(MapCtor);

        function WrappedMap(...args) {
            const map = Reflect.construct(MapCtor, args, new.target || WrappedMap);
            registerMap(map, 'constructor');
            return map;
        }

        Object.setPrototypeOf(WrappedMap, MapCtor);
        WrappedMap.prototype = MapCtor.prototype;

        WrappedMap.__pgoBetterSearchWrapped = true;
        return WrappedMap;
    }

    function patchMapsObject(maps) {
        if (!maps || maps.__pgoBetterSearchPatched) return;

        let mapValue = maps.Map;

        Object.defineProperty(maps, 'Map', {
            configurable: true,
            enumerable: true,
            get() {
                return mapValue;
            },
            set(value) {
                mapValue = wrapMapConstructor(value);
            },
        });

        if (mapValue) maps.Map = mapValue;

        if (typeof maps.importLibrary === 'function' && !maps.importLibrary.__pgoBetterSearchPatched) {
            const originalImportLibrary = maps.importLibrary.bind(maps);

            maps.importLibrary = async function(...args) {
                const lib = await originalImportLibrary(...args);

                if (args[0] === 'maps' && lib?.Map) {
                    lib.Map = wrapMapConstructor(lib.Map);
                }

                return lib;
            };

            maps.importLibrary.__pgoBetterSearchPatched = true;
        }

        maps.__pgoBetterSearchPatched = true;
        debug('Patched google.maps.');
    }

    function patchGoogleObject(google) {
        if (!google || google.__pgoBetterSearchPatched) return;

        let mapsValue = google.maps;

        Object.defineProperty(google, 'maps', {
            configurable: true,
            enumerable: true,
            get() {
                return mapsValue;
            },
            set(value) {
                mapsValue = value;
                patchMapsObject(mapsValue);
            },
        });

        if (mapsValue) google.maps = mapsValue;

        google.__pgoBetterSearchPatched = true;
        debug('Patched window.google.');
    }

    function installGoogleTrap() {
        let googleValue = state.originalGoogle;

        Object.defineProperty(W, 'google', {
            configurable: true,
            enumerable: true,
            get() {
                return googleValue;
            },
            set(value) {
                googleValue = value;
                patchGoogleObject(googleValue);
            },
        });

        if (googleValue) W.google = googleValue;

        debug('Installed google trap inside gamemap iframe.');
    }

    function waitForMap(timeoutMs = 20000) {
        return new Promise((resolve, reject) => {
            const started = Date.now();

            const timer = setInterval(() => {
                const map = state.activeMap || W.__pgoBetterSearchMap;

                if (map && isMapLike(map)) {
                    clearInterval(timer);
                    resolve(map);
                    return;
                }

                if (Date.now() - started > timeoutMs) {
                    clearInterval(timer);
                    reject(new Error('Could not find the Google Maps object.'));
                }
            }, 100);
        });
    }

    // ---------------------------------------------------------------------------
    // Search logic
    // ---------------------------------------------------------------------------

    function parseLatLng(input) {
        const str = String(input || '').trim();

        const decMatch = str.match(
            /^\s*\(?\s*([+-]?(?:\d+(?:\.\d+)?|\.\d+))\s*(?:,\s*|\s+)([+-]?(?:\d+(?:\.\d+)?|\.\d+))\s*\)?\s*$/
        );

        if (!decMatch) return null;

        const lat = Number(decMatch[1]);
        const lng = Number(decMatch[2]);

        if (
            Number.isFinite(lat) &&
            Number.isFinite(lng) &&
            lat >= -90 &&
            lat <= 90 &&
            lng >= -180 &&
            lng <= 180
        ) {
            return {
                lat,
                lng
            };
        }

        return null;
    }

    async function placeMarker(map, position, title) {
        try {
            const maps = W.google?.maps;
            if (!maps?.Marker) return;

            if (!state.marker) {
                state.marker = new maps.Marker({
                    map,
                    position,
                    title,
                });
            } else {
                state.marker.setMap(map);
                state.marker.setPosition(position);
                state.marker.setTitle(title);
            }
        } catch (err) {
            debug('Marker failed:', err);
        }
    }

    async function moveMapTo(lat, lng, zoom, label) {
        const map = await waitForMap();
        const position = {
            lat,
            lng
        };

        map.setCenter(position);
        map.setZoom(zoom);

        await placeMarker(map, position, label);
    }

    async function handleSearchSubmit(rawValue) {
        const value = String(rawValue || '').trim();
        if (!value) return '';

        const coords = parseLatLng(value);

        if (coords) {
            await moveMapTo(coords.lat, coords.lng, CONFIG.coordZoom, `${coords.lat}, ${coords.lng}`);
            return `Moved to ${coords.lat}, ${coords.lng}`;
        }

        const result = await geocodePublic(value);
        await moveMapTo(result.lat, result.lng, CONFIG.searchZoom, result.label);

        return `${result.label} (${result.provider})`;
    }

    // ---------------------------------------------------------------------------
    // Css Styles
    // ---------------------------------------------------------------------------

    function injectStyles() {
        if (document.getElementById('pgo-better-search-style')) return;

        const style = document.createElement('style');
        style.id = 'pgo-better-search-style';
        style.textContent = `
      #pgo-better-search-wrap {
        position: relative;
        display: inline-flex;
        align-items: center;
        margin-left: 8px;
        margin-right: 8px;
        flex: 0 0 auto;
      }

      #pgo-better-searchbox {
        display: flex;
        align-items: center;
        gap: 8px;
        width: 360px;
        max-width: 38vw;
        height: 42px;
        padding: 0 10px;
        border-radius: 14px;
        background: rgba(255, 255, 255, 0.96);
        box-shadow: 0 4px 16px rgba(0, 0, 0, 0.16);
        color: #111827;
        box-sizing: border-box;
        font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      }

      #pgo-better-search-wrap.pgo-floating-wrapper {
        position: fixed;
        left: 16px;
        bottom: 24px;
        z-index: 2147483647;
      }

      #pgo-better-searchbox.pgo-floating-fallback {
        max-width: min(420px, calc(100vw - 32px));
      }

      #pgo-better-suggestions {
        position: absolute;
        top: calc(100% + 6px);
        left: 0;
        right: 0;
        max-height: 280px;
        overflow-y: auto;
        border-radius: 12px;
        background: white;
        box-shadow: 0 8px 24px rgba(0, 0, 0, 0.22);
        z-index: 2147483647;
        display: none;
        font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      }

      .pgo-better-suggestion {
        display: flex;
        gap: 10px;
        align-items: flex-start;
        width: 100%;
        padding: 10px 12px;
        border: 0;
        border-bottom: 1px solid #e5e7eb;
        background: white;
        color: #111827;
        text-align: left;
        cursor: pointer;
      }

      .pgo-better-suggestion:hover,
      .pgo-better-suggestion.pgo-active {
        background: #f3f4f6;
      }

      .pgo-better-suggestion-icon {
        flex: 0 0 auto;
        color: #9ca3af;
        font-size: 18px;
        line-height: 1.2;
      }

      .pgo-better-suggestion-main {
        font-weight: 700;
        font-size: 14px;
        line-height: 1.2;
      }

      .pgo-better-suggestion-sub {
        margin-top: 2px;
        font-size: 12px;
        color: #6b7280;
        line-height: 1.2;
      }

      #pgo-better-search-icon,
      #pgo-better-geo-btn {
        width: 28px;
        height: 28px;
        flex: 0 0 auto;
        border: 0;
        border-radius: 8px;
        background: transparent;
        display: grid;
        place-items: center;
        cursor: pointer;
        padding: 0;
      }

      #pgo-better-search-icon:hover,
      #pgo-better-geo-btn:hover {
        background: rgba(0, 0, 0, 0.08);
      }

      #pgo-better-search-input {
        flex: 1 1 auto;
        min-width: 0;
        height: 34px;
        border: 0;
        outline: none;
        background: transparent;
        color: #111827;
        font-size: 14px;
      }

      #pgo-better-search-status {
        position: absolute;
        top: calc(100% + 6px);
        left: 0;
        right: 0;
        padding: 7px 10px;
        border-radius: 10px;
        background: rgba(17, 24, 39, 0.9);
        color: white;
        font-size: 12px;
        line-height: 1.3;
        display: none;
        z-index: 2147483647;
      }
    `;

        document.documentElement.appendChild(style);
    }

    function iconSvg(type) {
        const paths = {
            search: 'M784-120 532-372q-30 24-69 38t-83 14q-109 0-184.5-75.5T120-580q0-109 75.5-184.5T380-840q109 0 184.5 75.5T640-580q0 44-14 83t-38 69l252 252-56 56ZM380-400q75 0 127.5-52.5T560-580q0-75-52.5-127.5T380-760q-75 0-127.5 52.5T200-580q0 75 52.5 127.5T380-400Z',
            geo: 'M440-42v-80q-125-14-214.5-103.5T122-440H42v-80h80q14-125 103.5-214.5T440-838v-80h80v80q125 14 214.5 103.5T838-520h80v80h-80q-14 125-103.5 214.5T520-122v80h-80Zm40-158q116 0 198-82t82-198q0-116-82-198t-198-82q-116 0-198 82t-82 198q0 116 82 198t198 82Zm0-120q-66 0-113-47t-47-113q0-66 47-113t113-47q66 0 113 47t47 113q0 66-47 113t-113 47Zm0-80q33 0 56.5-23.5T560-480q0-33-23.5-56.5T480-560q-33 0-56.5 23.5T400-480q0 33 23.5 56.5T480-400Z',
        };

        return `
      <svg xmlns="http://www.w3.org/2000/svg" height="22" viewBox="0 -960 960 960" width="22" fill="#171717">
        <path d="${paths[type]}"></path>
      </svg>
    `;
    }

    function buildSearchUI() {
        const wrap = document.createElement('section');
        wrap.id = 'pgo-better-search-wrap';

        const searchBox = document.createElement('div');
        searchBox.id = 'pgo-better-searchbox';

        const searchButton = document.createElement('button');
        searchButton.id = 'pgo-better-search-icon';
        searchButton.type = 'button';
        searchButton.title = 'Search';
        searchButton.innerHTML = iconSvg('search');

        const input = document.createElement('input');
        input.id = 'pgo-better-search-input';
        input.type = 'search';
        input.placeholder = 'Search location or lat,lng';

        const geoButton = document.createElement('button');
        geoButton.id = 'pgo-better-geo-btn';
        geoButton.type = 'button';
        geoButton.title = 'Current location';
        geoButton.innerHTML = iconSvg('geo');

        const status = document.createElement('div');
        status.id = 'pgo-better-search-status';

        const suggestions = document.createElement('div');
        suggestions.id = 'pgo-better-suggestions';

        searchBox.appendChild(searchButton);
        searchBox.appendChild(input);
        searchBox.appendChild(geoButton);
        wrap.appendChild(searchBox);
        wrap.appendChild(suggestions);
        wrap.appendChild(status);

        function setStatus(message, isError = false) {
            status.textContent = message || '';
            status.style.display = message ? 'block' : 'none';
            status.style.background = isError ?
                'rgba(153, 27, 27, 0.92)' :
            'rgba(17, 24, 39, 0.9)';
        }

        let autocompleteTimer = null;
        let autocompleteRequestId = 0;
        let autocompleteResults = [];
        let activeSuggestionIndex = -1;

        function cancelAutocomplete() {
            clearTimeout(autocompleteTimer);
            autocompleteRequestId++;
            hideSuggestions();
        }

        function hideSuggestions() {
            suggestions.style.display = 'none';
            suggestions.innerHTML = '';
            autocompleteResults = [];
            activeSuggestionIndex = -1;
        }

        function renderSuggestions(results) {
            suggestions.innerHTML = '';

            autocompleteResults = results;
            activeSuggestionIndex = -1;

            if (!results.length) {
                hideSuggestions();
                return;
            }

            for (const [index, result] of results.entries()) {
                const btn = document.createElement('button');
                btn.type = 'button';
                btn.className = 'pgo-better-suggestion';

                btn.innerHTML = `
      <div class="pgo-better-suggestion-icon">📍</div>
      <div>
        <div class="pgo-better-suggestion-main"></div>
        <div class="pgo-better-suggestion-sub"></div>
      </div>
    `;

                btn.querySelector('.pgo-better-suggestion-main').textContent = result.main || result.label;
                btn.querySelector('.pgo-better-suggestion-sub').textContent = result.sub || '';

                btn.addEventListener('mousedown', ev => {
                    ev.preventDefault();
                });

                btn.addEventListener('click', async () => {
                    input.value = result.label;
                    cancelAutocomplete();
                    setStatus('Moving…');

                    try {
                        await moveMapTo(result.lat, result.lng, CONFIG.searchZoom, result.label);
                        setStatus('');
                    } catch (err) {
                        console.error('[PGO Better Search]', err);
                        setStatus(err.message || String(err), true);
                    }
                });

                suggestions.appendChild(btn);
            }

            suggestions.style.display = 'block';
        }

        function updateActiveSuggestion() {
            const items = [...suggestions.querySelectorAll('.pgo-better-suggestion')];

            items.forEach((item, index) => {
                item.classList.toggle('pgo-active', index === activeSuggestionIndex);
            });

            if (activeSuggestionIndex >= 0 && items[activeSuggestionIndex]) {
                items[activeSuggestionIndex].scrollIntoView({
                    block: 'nearest'
                });
            }
        }

        async function fetchAutocomplete() {
            const value = input.value.trim();

            if (parseLatLng(value)) {
                hideSuggestions();
                return;
            }

            if (value.length < 3) {
                hideSuggestions();
                return;
            }

            const requestId = ++autocompleteRequestId;

            try {
                const results = await autocompletePhoton(value);

                if (requestId !== autocompleteRequestId) return;

                renderSuggestions(results);
            } catch (err) {
                if (requestId !== autocompleteRequestId) return;

                console.warn('[PGO Better Search] Autocomplete failed:', err);
                hideSuggestions();
            }
        }

        input.addEventListener('input', () => {
            clearTimeout(autocompleteTimer);
            autocompleteTimer = setTimeout(fetchAutocomplete, 300);
        });

        input.addEventListener('blur', () => {
            setTimeout(hideSuggestions, 150);
        });

        async function submit() {
            const value = input.value.trim();
            if (!value) return;

            // Cancel any pending autocomplete request before moving the map.
            cancelAutocomplete();

            setStatus('Searching…');

            try {
                const msg = await handleSearchSubmit(value);

                // Hide status after success.
                setStatus('');

                console.debug('[PGO Better Search] Search result:', msg);
            } catch (err) {
                console.error('[PGO Better Search]', err);
                setStatus(err.message || String(err), true);
            }
        }

        input.addEventListener('keydown', ev => {
            const hasSuggestions = suggestions.style.display === 'block' && autocompleteResults.length > 0;

            if (ev.key === 'ArrowDown' && hasSuggestions) {
                ev.preventDefault();
                activeSuggestionIndex = Math.min(activeSuggestionIndex + 1, autocompleteResults.length - 1);
                updateActiveSuggestion();
                return;
            }

            if (ev.key === 'ArrowUp' && hasSuggestions) {
                ev.preventDefault();
                activeSuggestionIndex = Math.max(activeSuggestionIndex - 1, 0);
                updateActiveSuggestion();
                return;
            }

            if (ev.key === 'Enter') {
                ev.preventDefault();

                if (hasSuggestions && activeSuggestionIndex >= 0) {
                    const selected = autocompleteResults[activeSuggestionIndex];

                    input.value = selected.label;

                    // Cancel any pending autocomplete before moving.
                    cancelAutocomplete();

                    setStatus('Moving…');

                    moveMapTo(selected.lat, selected.lng, CONFIG.searchZoom, selected.label)
                        .then(() => setStatus(''))
                        .catch(err => {
                        console.error('[PGO Better Search]', err);
                        setStatus(err.message || String(err), true);
                    });

                    return;
                }

                cancelAutocomplete();
                submit();
                return;
            }

            if (ev.key === 'Escape') {
                input.value = '';
                input.blur();
                hideSuggestions();
                setStatus('');
            }
        });

        searchButton.addEventListener('click', submit);

        geoButton.addEventListener('click', () => {
            if (!navigator.geolocation) {
                setStatus('Browser geolocation is not available.', true);
                return;
            }

            setStatus('Getting current location…');

            navigator.geolocation.getCurrentPosition(
                async pos => {
                    const lat = pos.coords.latitude;
                    const lng = pos.coords.longitude;

                    try {
                        await moveMapTo(lat, lng, CONFIG.coordZoom, 'Current location');
                        setStatus('');
                    } catch (err) {
                        setStatus(err.message || String(err), true);
                    }
                },
                err => {
                    setStatus(err.message || 'Could not get current location.', true);
                }, {
                    enableHighAccuracy: true,
                    timeout: 10000,
                    maximumAge: 60000,
                }
            );
        });

        return {
            wrap,
            searchBox
        };
    }

    function iconUrlOf(el) {
        return String(el?.getAttribute?.('icon') || '').toLowerCase();
    }

    function isLocationControlButton(btn) {
        if (!btn) return false;

        const icons = [...btn.querySelectorAll('ion-icon')].map(iconUrlOf);

        return icons.some(url =>
                          url.includes('/location.') ||
                          url.includes('location.')
                         );
    }

    function isKnownFilterButton(btn) {
        if (!btn) return false;

        const icons = [...btn.querySelectorAll('ion-icon')].map(iconUrlOf);

        return icons.some(url =>
                          url.includes('/boss.') ||
                          url.includes('/super_mega_level.') ||
                          url.includes('/live-event.') ||
                          url.includes('/pgo-gmax.') ||
                          url.includes('/pgo-dmax.') ||
                          url.includes('/pgo-gym.') ||
                          url.includes('/pgo-route.') ||
                          url.includes('/pgo-pokestop.')
                         );
    }

    function findMapLocationButton() {
        return [...document.querySelectorAll('ion-button, button')]
            .find(isLocationControlButton) || null;
    }

    function findToolbarRowFromLocationButton(locationButton) {
        let node = locationButton.parentElement;

        while (node && node !== document.body && node !== document.documentElement) {
            const buttons = [...node.querySelectorAll('ion-button, button')];

            const hasLocation = buttons.some(isLocationControlButton);
            const hasOtherFilters = buttons.some(isKnownFilterButton);

            // This identifies the row containing the location control plus the filter buttons,
            // without relying on English/Japanese/etc text.
            if (hasLocation && hasOtherFilters) {
                return node;
            }

            node = node.parentElement;
        }

        return null;
    }

    function findMapLocationSlot() {
        const locationButton = findMapLocationButton();
        if (!locationButton) return null;

        const toolbarRow = findToolbarRowFromLocationButton(locationButton);
        if (!toolbarRow) {
            console.warn('[PGO Better Search] Could not identify toolbar row from icons.');
            return null;
        }

        // Replace only the direct child of the toolbar row that contains the location button.
        // This avoids replacing the whole row and deleting the other controls.
        for (const child of [...toolbarRow.children]) {
            if (child.contains(locationButton)) {
                return child;
            }
        }

        return null;
    }

    function injectSearchUI() {
        injectStyles();

        const existingWrap = document.getElementById('pgo-better-search-wrap');
        const slot = findMapLocationSlot();

        if (existingWrap && slot && !slot.contains(existingWrap)) {
            existingWrap.classList.remove('pgo-floating-wrapper');
            existingWrap.querySelector('#pgo-better-searchbox')?.classList.remove('pgo-floating-fallback');

            console.debug('[PGO Better Search] Replacing slot:', slot);

            slot.replaceWith(existingWrap);

            state.uiInjected = true;
            debug('Moved search UI into location toolbar slot.');
            return;
        }

        if (existingWrap) return;

        const { wrap, searchBox } = buildSearchUI();

        if (slot) {
            console.debug('[PGO Better Search] Replacing slot:', slot);

            slot.replaceWith(wrap);

            state.uiInjected = true;
            debug('Replaced location toolbar slot with search UI.');
            return;
        }

        // Temporary fallback only. Do not set state.uiInjected here.
        wrap.classList.add('pgo-floating-wrapper');
        searchBox.classList.add('pgo-floating-fallback');
        document.body.appendChild(wrap);

        debug('Location toolbar slot not found yet; using temporary fallback UI.');
    }

    function startObservers() {
        const observer = new MutationObserver(() => {
            injectSearchUI();
        });

        observer.observe(document.documentElement, {
            childList: true,
            subtree: true,
        });

        injectSearchUI();
    }

    installGoogleTrap();

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', startObservers, {
            once: true
        });
    } else {
        startObservers();
    }
})();