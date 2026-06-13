// ==UserScript==
// @name         Pokémon Go Map Copy Coordinates
// @version      0.1.0
// @description  Adds coordinates to Pokemon Go Map render card
// @namespace    https://gitlab.com/Tntnnbltn/wayfarer-addons
// @downloadURL  https://gitlab.com/Tntnnbltn/wayfarer-addons/-/raw/main/pokemon-go-map-card-coords.user.js
// @updateURL    https://gitlab.com/Tntnnbltn/wayfarer-addons/-/raw/main/pokemon-go-map-card-coords.user.js
// @homepageURL  https://gitlab.com/Tntnnbltn/wayfarer-addons
// @match        https://pokemongo.com/gamemap*
// @run-at       document-start
// @grant        none
// @inject-into  page
// ==/UserScript==

(() => {
    'use strict';

    // -----------------------------
    // Constants / state
    // -----------------------------

    const GRAPHQL_URL_PART = 'niantic-social-api.nianticlabs.com/graphql';

    const state = {
        byId: new Map(),
        byImageUrl: new Map(),
        byName: new Map(),
        lastObjects: [],
        observerStarted: false,
    };

    function debug(...args) {
        console.debug('[PGO Card Coords]', ...args);
    }

    // -----------------------------
    // Data extraction
    // -----------------------------

    function formatCoord(lat, lng) {
        return `${Number(lat).toFixed(6)},${Number(lng).toFixed(6)}`;
    }

    function normaliseImageUrl(url) {
        return String(url || '').split('?')[0].trim();
    }

    function normaliseName(name) {
        return String(name || '').replace(/\s+/g, ' ').trim().toLowerCase();
    }

    function getObjectPayload(mapObject) {
        if (!mapObject) return null;

        if (mapObject.pgoGym) {
            return {
                id: mapObject.id,
                type: 'GYM',
                name: mapObject.pgoGym.name,
                imageUrl: mapObject.pgoGym.imageUrl,
                lat: mapObject.pgoGym.location?.latitude,
                lng: mapObject.pgoGym.location?.longitude,
            };
        }

        if (mapObject.pgoPokestop) {
            return {
                id: mapObject.id,
                type: 'POKESTOP',
                name: mapObject.pgoPokestop.name,
                imageUrl: mapObject.pgoPokestop.imageUrl,
                lat: mapObject.pgoPokestop.location?.latitude,
                lng: mapObject.pgoPokestop.location?.longitude,
            };
        }

        if (mapObject.pgoPowerspot) {
            return {
                id: mapObject.id,
                type: 'POWERSPOT',
                name: mapObject.pgoPowerspot.name,
                imageUrl: null,
                lat: mapObject.pgoPowerspot.location?.latitude,
                lng: mapObject.pgoPowerspot.location?.longitude,
            };
        }

        if (mapObject.pgoRoute) {
            const start = mapObject.pgoRoute.startPoi?.location;

            return {
                id: mapObject.id,
                type: 'ROUTE',
                name: mapObject.pgoRoute.name,
                imageUrl: mapObject.pgoRoute.startPoi?.imageUrl,
                lat: start?.latitude,
                lng: start?.longitude,
            };
        }

        // Events usually expose a location string, not always structured lat/lng
        // in this preview-card query. Only handle them if structured coordinates
        // are present in a future response shape.
        if (mapObject.event) {
            const location = mapObject.event.location;

            if (
                location &&
                typeof location === 'object' &&
                Number.isFinite(Number(location.latitude)) &&
                Number.isFinite(Number(location.longitude))
            ) {
                return {
                    id: mapObject.id,
                    type: 'EVENT',
                    name: mapObject.event.name,
                    imageUrl: mapObject.event.coverPhotoUrl,
                    lat: location.latitude,
                    lng: location.longitude,
                };
            }
        }

        return null;
    }

    function storePayload(payload) {
        if (!payload) return;

        const lat = Number(payload.lat);
        const lng = Number(payload.lng);

        if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;

        const stored = {
            ...payload,
            lat,
            lng,
            coordText: formatCoord(lat, lng),
            storedAt: Date.now(),
        };

        if (stored.id) {
            state.byId.set(stored.id, stored);
        }

        if (stored.imageUrl) {
            state.byImageUrl.set(normaliseImageUrl(stored.imageUrl), stored);
        }

        if (stored.name) {
            state.byName.set(normaliseName(stored.name), stored);
        }

        state.lastObjects.unshift(stored);
        state.lastObjects = state.lastObjects.slice(0, 20);

        debug('Stored map object coordinates:', stored);
    }

    function processGraphQLJson(json) {
        const objects = json?.data?.gameMapObjectsByID;

        if (!Array.isArray(objects)) return;

        for (const obj of objects) {
            storePayload(getObjectPayload(obj));
        }

        scheduleCardScan();
    }

    function looksLikePreviewCardQuery(bodyText) {
        return (
            bodyText.includes('PgoGameMapPreviewCardRenderer_cardQuery') ||
            bodyText.includes('gameMapObjectsByID')
        );
    }

    // -----------------------------
    // Network interception
    // -----------------------------

    function patchFetch() {
        if (!window.fetch || window.fetch.__pgoCardCoordsPatched) return;

        const originalFetch = window.fetch.bind(window);

        window.fetch = async function patchedFetch(input, init) {
            const url = typeof input === 'string' ? input : input?.url || '';
            const body = init?.body || '';

            const response = await originalFetch(input, init);

            try {
                if (
                    String(url).includes(GRAPHQL_URL_PART) &&
                    typeof body === 'string' &&
                    looksLikePreviewCardQuery(body)
                ) {
                    response.clone().json()
                        .then(processGraphQLJson)
                        .catch(err => debug('Could not parse GraphQL fetch response:', err));
                }
            } catch (err) {
                debug('Fetch interception failed:', err);
            }

            return response;
        };

        window.fetch.__pgoCardCoordsPatched = true;
        debug('Patched fetch.');
    }

    function patchXMLHttpRequest() {
        if (!window.XMLHttpRequest || window.XMLHttpRequest.prototype.__pgoCardCoordsPatched) return;

        const originalOpen = window.XMLHttpRequest.prototype.open;
        const originalSend = window.XMLHttpRequest.prototype.send;

        window.XMLHttpRequest.prototype.open = function patchedOpen(method, url, ...rest) {
            this.__pgoCardCoordsUrl = String(url || '');
            return originalOpen.call(this, method, url, ...rest);
        };

        window.XMLHttpRequest.prototype.send = function patchedSend(body) {
            try {
                this.__pgoCardCoordsBody = typeof body === 'string' ? body : '';
            } catch (_) {}

            this.addEventListener('load', () => {
                try {
                    if (
                        String(this.__pgoCardCoordsUrl || '').includes(GRAPHQL_URL_PART) &&
                        looksLikePreviewCardQuery(String(this.__pgoCardCoordsBody || ''))
                    ) {
                        processGraphQLJson(JSON.parse(this.responseText));
                    }
                } catch (err) {
                    debug('XHR interception failed:', err);
                }
            });

            return originalSend.call(this, body);
        };

        window.XMLHttpRequest.prototype.__pgoCardCoordsPatched = true;
        debug('Patched XMLHttpRequest.');
    }

    // -----------------------------
    // Card matching
    // -----------------------------

    function isPreviewCardRoot(el) {
        if (!el || !(el instanceof HTMLElement)) return false;

        // Preview cards have a POI card body with data-poi values such as GYM,
        // POKESTOP, etc. Simple marker anchors do not.
        const hasPoiCard = !!el.querySelector('[data-poi]');

        // Preview cards also have a close button/icon and card-style image/title layout.
        const hasCloseIcon = [...el.querySelectorAll('ion-icon')]
        .some(icon => String(icon.getAttribute('icon') || '').includes('512 512'));

        const hasImage = !!el.querySelector('img[src]');

        return hasPoiCard && (hasImage || hasCloseIcon);
    }

    function getCardRoots() {
        return [...document.querySelectorAll('[id^="map-custom-anchor-"]')]
            .filter(isPreviewCardRoot);
    }

    function findMatchingPayload(card) {
        // Best match: image URL from card.
        const imgs = [...card.querySelectorAll('img[src]')];

        for (const img of imgs) {
            const src = normaliseImageUrl(img.src);

            if (state.byImageUrl.has(src)) {
                return state.byImageUrl.get(src);
            }
        }

        // Second-best: visible POI title.
        const textCandidates = [...card.querySelectorAll('span, div')]
        .map(el => ({
            el,
            text: String(el.textContent || '').replace(/\s+/g, ' ').trim(),
        }))
        .filter(item => item.text && item.text.length <= 120);

        for (const { text } of textCandidates) {
            const key = normaliseName(text);

            if (state.byName.has(key)) {
                return state.byName.get(key);
            }
        }

        // Fallback: most recently fetched object. This is usually correct because
        // clicking a marker triggers the preview-card query immediately before
        // rendering the card.
        return state.lastObjects[0] || null;
    }

    function findTitleRow(card, payload) {
        if (!payload?.name) return null;

        const name = normaliseName(payload.name);

        const spans = [...card.querySelectorAll('span')];

        const titleSpan = spans.find(span =>
                                     normaliseName(span.textContent) === name
                                    );

        if (!titleSpan) return null;

        // In the current DOM, the title span lives inside a compact row with
        // the distance. Insert after that row if possible.
        return titleSpan.parentElement || titleSpan;
    }

    function findDetailsContainer(card) {
        // This is intentionally structural rather than class-name based.
        // The details area is normally the section after the image/icon block.
        const titleishSpans = [...card.querySelectorAll('span')]
        .filter(span => String(span.textContent || '').trim().length > 0);

        if (!titleishSpans.length) return null;

        return titleishSpans[0].closest('div')?.parentElement || titleishSpans[0].parentElement;
    }

    // -----------------------------
    // Clipboard / UI injection
    // -----------------------------

    async function copyText(text) {
        if (navigator.clipboard?.writeText) {
            await navigator.clipboard.writeText(text);
            return;
        }

        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.style.position = 'fixed';
        textarea.style.left = '-9999px';
        textarea.style.top = '-9999px';

        document.body.appendChild(textarea);
        textarea.focus();
        textarea.select();

        try {
            document.execCommand('copy');
        } finally {
            textarea.remove();
        }
    }

    function injectStyles() {
        if (document.getElementById('pgo-card-coords-style')) return;

        const style = document.createElement('style');
        style.id = 'pgo-card-coords-style';
        style.textContent = `
.pgo-card-coords {
    display: block;
    margin-top: 3px;
    padding: 0;
    width: max-content;
    max-width: 100%;

    color: rgb(149, 170, 171);
    cursor: pointer;
    user-select: text;

    font-family: Lato, Figtree, sans-serif;
    font-size: 13px;
    font-style: normal;
    font-weight: 500;
    line-height: 1.35;

    font-feature-settings: normal;
    font-kerning: auto;
    font-optical-sizing: auto;
    font-stretch: 100%;
    font-variant-alternates: normal;
    font-variant-caps: normal;
    font-variant-east-asian: normal;
    font-variant-emoji: normal;
    font-variant-ligatures: normal;
    font-variant-numeric: normal;
    font-variant-position: normal;
    font-variation-settings: normal;

    border-radius: 4px;
}

.pgo-card-coords:hover {
    color: rgb(88, 120, 122);
    text-decoration: underline;
}

.pgo-card-coords.pgo-card-coords-copied {
    color: #047857;
}
        `;

        document.documentElement.appendChild(style);
    }

    function injectCoordsIntoCard(card) {
        if (!isPreviewCardRoot(card)) return;

        const payload = findMatchingPayload(card);
        if (!payload?.coordText) return;

        let coordEl = card.querySelector('.pgo-card-coords');

        if (!coordEl) {
            coordEl = document.createElement('div');
            coordEl.className = 'pgo-card-coords';
            coordEl.title = 'Click to copy coordinates';

            coordEl.addEventListener('click', async event => {
                event.preventDefault();
                event.stopPropagation();

                const text = coordEl.dataset.coordText;
                if (!text) return;

                try {
                    await copyText(text);

                    const originalDisplayText = `(${text})`;

                    coordEl.classList.add('pgo-card-coords-copied');
                    coordEl.textContent = `${originalDisplayText} copied`;

                    clearTimeout(coordEl._pgoCopiedTimer);

                    coordEl._pgoCopiedTimer = setTimeout(() => {
                        coordEl.classList.remove('pgo-card-coords-copied');

                        // Only restore if this element is still showing the same coordinate.
                        if (coordEl.dataset.coordText === text) {
                            coordEl.textContent = originalDisplayText;
                        }
                    }, 1000);
                } catch (err) {
                    console.error('[PGO Card Coords] Copy failed:', err);
                }
            });
        }

        coordEl.dataset.coordText = payload.coordText;
        coordEl.dataset.lat = String(payload.lat);
        coordEl.dataset.lng = String(payload.lng);

        // Do not overwrite the temporary "copied" message during MutationObserver rescans.
        if (!coordEl.classList.contains('pgo-card-coords-copied')) {
            coordEl.textContent = `(${payload.coordText})`;
        }

        const titleRow = findTitleRow(card, payload);
        const detailsContainer = findDetailsContainer(card);

        if (titleRow?.parentElement) {
            if (coordEl.parentElement !== titleRow.parentElement || coordEl.previousElementSibling !== titleRow) {
                titleRow.insertAdjacentElement('afterend', coordEl);
            }

            debug('Inserted/updated coordinates under title:', payload.coordText);
            return;
        }

        if (detailsContainer) {
            if (!detailsContainer.contains(coordEl)) {
                detailsContainer.prepend(coordEl);
            }

            debug('Inserted/updated coordinates in details container:', payload.coordText);
            return;
        }

        // Important: do NOT append to card as a fallback.
        // Some map-custom-anchor elements are marker anchors, not preview cards.
        debug('Could not find safe insertion point for card coordinates.');
    }

    let scanTimer = null;

    function scanCards() {
        injectStyles();

        // Remove accidental orphan coordinate labels from marker anchors / map overlays.
        for (const el of [...document.querySelectorAll('.pgo-card-coords')]) {
            const root = el.closest('[id^="map-custom-anchor-"]');

            if (!root || !isPreviewCardRoot(root)) {
                el.remove();
            }
        }

        for (const card of getCardRoots()) {
            injectCoordsIntoCard(card);
        }
    }

    function scheduleCardScan() {
        clearTimeout(scanTimer);
        scanTimer = setTimeout(scanCards, 50);
    }

    function startCardObserver() {
        if (state.observerStarted) return;
        state.observerStarted = true;

        const observer = new MutationObserver(() => {
            scheduleCardScan();
        });

        observer.observe(document.documentElement, {
            childList: true,
            subtree: true,
            attributes: true,
            characterData: true,
        });

        scheduleCardScan();
        debug('Started card observer.');
    }

    // -----------------------------
    // Bootstrap
    // -----------------------------

    patchFetch();
    patchXMLHttpRequest();

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', startCardObserver, { once: true });
    } else {
        startCardObserver();
    }
})();