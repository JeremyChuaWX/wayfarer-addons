// ==UserScript==
// @name         Pokémon Go Map Routes
// @version      0.1.4
// @description  Adds a Routes filter that discovers and displays Pokémon GO Routes on the Pokemon Go map
// @namespace    https://gitlab.com/Tntnnbltn/wayfarer-addons
// @downloadURL  https://gitlab.com/Tntnnbltn/wayfarer-addons/-/raw/main/pokemon-go-map-routes.user.js
// @updateURL    https://gitlab.com/Tntnnbltn/wayfarer-addons/-/raw/main/pokemon-go-map-routes.user.js
// @homepageURL  https://gitlab.com/Tntnnbltn/wayfarer-addons
// @match        https://pokemongo.com/gamemap*
// @run-at       document-start
// @grant        none
// @inject-into  page
// ==/UserScript==

// Copyright 2026 tntnnbltn

// This script is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.

// This script is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
// GNU General Public License for more details.

// You can find a copy of the GNU General Public License in the root
// directory of this script's GitLab repository:
// <https://gitlab.com/Tntnnbltn/wayfarer-addons/-/blob/main/LICENSE>
// If not, see <https://www.gnu.org/licenses/>.

(() => {
    'use strict';

    const GRAPHQL_URL = 'https://niantic-social-api.nianticlabs.com/graphql';

    const CONFIG = {
        minZoom: 16,
        s2Level: 15,
        maxCells: 120,
        scanDebounceMs: 180,
        viewportPaddingRatio: 0.06,
        realityChannelId: 'da83476a-c4da-4312-a610-a4f2fc2c37f0',
        summaryStartMarker: {
            color: '#2d9d62',
            label: 'S',
            size: 30,
            zIndex: 850,
        },
        summaryEndMarker: {
            color: '#d64b4b',
            label: 'E',
            size: 30,
            zIndex: 850,
        },
        selectedLine: {
            strokeColor: '#f06436',
            strokeOpacity: 0.95,
            strokeWeight: 6,
            zIndex: 920,
        },
    };

    const MAP_ROUTES_QUERY = `
        query PgoGameMapObjectsByS2CellsProvider_mapObjectsByS2Cells_Query(
          $realityChannelMapObjectsByS2CellsInput: RealityChannelMapObjectsByS2CellsInput!
        ) {
          realityChannelMapObjectsByS2Cells(input: $realityChannelMapObjectsByS2CellsInput) {
            mapObjectsByS2CellsAndTypes {
              s2CellId
              mapObjectsByType {
                type
                mapObjects {
                  id
                  mapObjectType
                  pgoRoute {
                    id
                    distanceMeters
                    reversible
                    tagList
                    startPoi {
                      fortId
                      location { latitude longitude }
                    }
                    endPoi {
                      fortId
                      location { latitude longitude }
                    }
                  }
                }
              }
            }
          }
        }
    `;

    const ROUTE_DETAILS_QUERY = `
        query PgoRouteDetails($ids: [ID!]!) {
          gameMapObjectsByID(ids: $ids) {
            id
            mapObjectType
            pgoRoute {
              id
              name
              distanceMeters
              durationSeconds
              reversible
              tagList
              startPoi {
                fortId
                imageUrl
                location { latitude longitude }
              }
              endPoi {
                fortId
                location { latitude longitude }
              }
              locationList { latitude longitude }
            }
          }
        }
    `;

    const state = {
        active: false,
        map: null,
        scanTimer: null,
        scanController: null,
        scanSequence: 0,
        lastCellSignature: '',
        routeSummaries: new Map(),
        summaryOverlays: new Map(),
        detailCache: new Map(),
        selectedGraphId: null,
        selectedPolyline: null,
        selectedStart: null,
        selectedEnd: null,
        infoWindow: null,
        uiObserver: null,
        uiRaf: null,
        statusTimer: null,
        listenedMaps: new WeakSet(),
    };

    function debug(...args) {
        console.debug('[PGO Routes]', ...args);
    }

    function getPageWindow() {
        try {
            if (typeof unsafeWindow !== 'undefined') return unsafeWindow;
        } catch (_) {}

        return window;
    }

    function getPgoMapMods() {
        const W = getPageWindow();

        if (W.__pgoMapMods?.version >= 1) {
            return W.__pgoMapMods;
        }

        const api = W.__pgoMapMods = {
            version: 1,
            maps: [],
            activeMap: null,
            callbacks: [],
            hookInstalled: false,

            isMapLike(obj) {
                return !!obj &&
                    typeof obj.setCenter === 'function' &&
                    typeof obj.setZoom === 'function' &&
                    typeof obj.getCenter === 'function' &&
                    typeof obj.getZoom === 'function' &&
                    typeof obj.getDiv === 'function';
            },

            registerMap(map, source = 'unknown') {
                if (!api.isMapLike(map)) return map;

                if (!api.maps.includes(map)) {
                    api.maps.push(map);
                    api.activeMap = map;
                    W.__pgoGoogleMap = map;

                    for (const callback of [...api.callbacks]) {
                        try {
                            callback(map);
                        } catch (err) {
                            console.error('[PGO MapMods] Map callback failed:', err);
                        }
                    }

                    try {
                        W.dispatchEvent(new CustomEvent('pgo-mapmods:map-ready', {
                            detail: { map, source },
                        }));
                    } catch (_) {}
                }

                return map;
            },

            getMap() {
                return api.activeMap || W.__pgoGoogleMap || api.maps[0] || null;
            },

            whenMapReady(callback) {
                const map = api.getMap();

                if (map) {
                    callback(map);
                    return;
                }

                api.callbacks.push(callback);
            },

            installGoogleHook() {
                if (api.hookInstalled) return;
                api.hookInstalled = true;

                function patchMapPrototype(MapCtor) {
                    if (!MapCtor?.prototype || MapCtor.prototype.__pgoMapModsPatched) return;

                    for (const method of [
                        'setCenter',
                        'setZoom',
                        'panTo',
                        'fitBounds',
                        'getCenter',
                        'getZoom',
                        'getBounds',
                        'getDiv',
                    ]) {
                        const original = MapCtor.prototype[method];
                        if (typeof original !== 'function') continue;

                        MapCtor.prototype[method] = function (...args) {
                            api.registerMap(this, `prototype.${method}`);
                            return original.apply(this, args);
                        };
                    }

                    MapCtor.prototype.__pgoMapModsPatched = true;
                }

                function wrapMapConstructor(MapCtor) {
                    if (!MapCtor) return MapCtor;
                    if (MapCtor.__pgoMapModsWrapped) return MapCtor;

                    patchMapPrototype(MapCtor);

                    function WrappedMap(...args) {
                        const map = Reflect.construct(MapCtor, args, new.target || WrappedMap);
                        api.registerMap(map, 'constructor');
                        return map;
                    }

                    Object.setPrototypeOf(WrappedMap, MapCtor);
                    WrappedMap.prototype = MapCtor.prototype;

                    for (const key of Reflect.ownKeys(MapCtor)) {
                        if (key === 'prototype') continue;

                        try {
                            Object.defineProperty(
                                WrappedMap,
                                key,
                                Object.getOwnPropertyDescriptor(MapCtor, key)
                            );
                        } catch (_) {}
                    }

                    WrappedMap.__pgoMapModsWrapped = true;
                    WrappedMap.__pgoMapModsOriginal = MapCtor;
                    return WrappedMap;
                }

                function patchMapsObject(maps) {
                    if (!maps || maps.__pgoMapModsPatched) return;

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

                    if (typeof maps.importLibrary === 'function' && !maps.importLibrary.__pgoMapModsPatched) {
                        const originalImportLibrary = maps.importLibrary.bind(maps);

                        maps.importLibrary = async function (...args) {
                            const lib = await originalImportLibrary(...args);

                            if (args[0] === 'maps' && lib?.Map) {
                                lib.Map = wrapMapConstructor(lib.Map);
                            }

                            return lib;
                        };

                        maps.importLibrary.__pgoMapModsPatched = true;
                    }

                    maps.__pgoMapModsPatched = true;
                }

                function patchGoogleObject(google) {
                    if (!google || google.__pgoMapModsPatched) return;

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
                    google.__pgoMapModsPatched = true;
                }

                let googleValue = W.google;

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
            },
        };

        api.installGoogleHook();
        return api;
    }

    // Use the same request shape as WFMM's working Pokémon GO API client.
    // In particular, omit credentials and avoid optional custom headers. Sending
    // cookies together with x-client-info can cause the browser's CORS preflight
    // to reject an otherwise public GraphQL request.
    async function graphqlRequest(body, signal) {
        const response = await getPageWindow().fetch(GRAPHQL_URL, {
            method: 'POST',
            credentials: 'omit',
            headers: {
                'content-type': 'application/json',
            },
            body: JSON.stringify(body),
            signal,
        });

        const text = await response.text();

        let json;
        try {
            json = JSON.parse(text);
        } catch (_) {
            throw new Error(
                `PGO GraphQL returned a non-JSON response ` +
                `(HTTP ${response.status}): ${text.slice(0, 300)}`
            );
        }

        if (!response.ok) {
            throw new Error(
                `PGO GraphQL HTTP ${response.status}: ` +
                `${JSON.stringify(json).slice(0, 500)}`
            );
        }

        if (Array.isArray(json?.errors) && json.errors.length) {
            throw new Error(
                `PGO GraphQL errors: ${JSON.stringify(json.errors).slice(0, 1000)}`
            );
        }

        return json;
    }

    // -------------------------------------------------------------------------
    // S2 helpers (small browser-safe subset; no external library required)
    // -------------------------------------------------------------------------

    const S2 = (() => {
        const DEG_TO_RAD = Math.PI / 180;
        const RAD_TO_DEG = 180 / Math.PI;

        function latLng(rawLat, rawLng, noWrap) {
            let lat = Number(rawLat);
            let lng = Number(rawLng);

            if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
                throw new Error(`Invalid LatLng object: (${rawLat}, ${rawLng})`);
            }

            if (noWrap !== true) {
                lat = Math.max(Math.min(lat, 90), -90);
                lng = (lng + 180) % 360 + ((lng < -180 || lng === 180) ? 180 : -180);
            }

            return { lat, lng };
        }

        function latLngToXYZ(value) {
            const phi = value.lat * DEG_TO_RAD;
            const theta = value.lng * DEG_TO_RAD;
            const cosPhi = Math.cos(phi);

            return [
                Math.cos(theta) * cosPhi,
                Math.sin(theta) * cosPhi,
                Math.sin(phi),
            ];
        }

        function xyzToLatLng(xyz) {
            const lat = Math.atan2(xyz[2], Math.sqrt(xyz[0] ** 2 + xyz[1] ** 2));
            const lng = Math.atan2(xyz[1], xyz[0]);
            return latLng(lat * RAD_TO_DEG, lng * RAD_TO_DEG);
        }

        function largestAbsComponent(xyz) {
            const values = xyz.map(Math.abs);
            if (values[0] > values[1]) return values[0] > values[2] ? 0 : 2;
            return values[1] > values[2] ? 1 : 2;
        }

        function faceXYZToUV(face, xyz) {
            switch (face) {
                case 0: return [xyz[1] / xyz[0], xyz[2] / xyz[0]];
                case 1: return [-xyz[0] / xyz[1], xyz[2] / xyz[1]];
                case 2: return [-xyz[0] / xyz[2], -xyz[1] / xyz[2]];
                case 3: return [xyz[2] / xyz[0], xyz[1] / xyz[0]];
                case 4: return [xyz[2] / xyz[1], -xyz[0] / xyz[1]];
                case 5: return [-xyz[1] / xyz[2], -xyz[0] / xyz[2]];
                default: throw new Error('Invalid S2 face');
            }
        }

        function xyzToFaceUV(xyz) {
            let face = largestAbsComponent(xyz);
            if (xyz[face] < 0) face += 3;
            return [face, faceXYZToUV(face, xyz)];
        }

        function faceUVToXYZ(face, uv) {
            const [u, v] = uv;

            switch (face) {
                case 0: return [1, u, v];
                case 1: return [-u, 1, v];
                case 2: return [-u, -v, 1];
                case 3: return [-1, -v, -u];
                case 4: return [v, -1, -u];
                case 5: return [v, u, -1];
                default: throw new Error('Invalid S2 face');
            }
        }

        function singleSTToUV(st) {
            return st >= 0.5
                ? (1 / 3) * (4 * st * st - 1)
                : (1 / 3) * (1 - 4 * (1 - st) * (1 - st));
        }

        function stToUV(st) {
            return [singleSTToUV(st[0]), singleSTToUV(st[1])];
        }

        function singleUVToST(uv) {
            return uv >= 0
                ? 0.5 * Math.sqrt(1 + 3 * uv)
                : 1 - 0.5 * Math.sqrt(1 - 3 * uv);
        }

        function uvToST(uv) {
            return [singleUVToST(uv[0]), singleUVToST(uv[1])];
        }

        function stToIJ(st, level) {
            const maxSize = 1 << level;
            const convert = value => Math.max(0, Math.min(maxSize - 1, Math.floor(value * maxSize)));
            return [convert(st[0]), convert(st[1])];
        }

        function ijToST(ij, level, offsets) {
            const maxSize = 1 << level;
            return [
                (ij[0] + offsets[0]) / maxSize,
                (ij[1] + offsets[1]) / maxSize,
            ];
        }

        function pointToHilbertQuadList(x, y, level, face) {
            const hilbertMap = {
                a: [[0, 'd'], [1, 'a'], [3, 'b'], [2, 'a']],
                b: [[2, 'b'], [1, 'b'], [3, 'a'], [0, 'c']],
                c: [[2, 'c'], [3, 'd'], [1, 'c'], [0, 'b']],
                d: [[0, 'a'], [3, 'c'], [1, 'd'], [2, 'd']],
            };

            let currentSquare = face % 2 ? 'd' : 'a';
            const positions = [];

            for (let i = level - 1; i >= 0; i -= 1) {
                const mask = 1 << i;
                const quadX = x & mask ? 1 : 0;
                const quadY = y & mask ? 1 : 0;
                const next = hilbertMap[currentSquare][quadX * 2 + quadY];
                positions.push(next[0]);
                currentSquare = next[1];
            }

            return positions;
        }

        class Cell {
            constructor(face, ij, level) {
                this.face = face;
                this.ij = ij;
                this.level = level;
            }

            static fromLatLng(value, level) {
                const xyz = latLngToXYZ(value);
                const [face, uv] = xyzToFaceUV(xyz);
                const st = uvToST(uv);
                return new Cell(face, stToIJ(st, level), level);
            }

            getLatLng() {
                const st = ijToST(this.ij, this.level, [0.5, 0.5]);
                return xyzToLatLng(faceUVToXYZ(this.face, stToUV(st)));
            }

            getCornerLatLngs() {
                return [
                    [0, 0],
                    [0, 1],
                    [1, 1],
                    [1, 0],
                ].map(offset => {
                    const st = ijToST(this.ij, this.level, offset);
                    return xyzToLatLng(faceUVToXYZ(this.face, stToUV(st)));
                });
            }

            toHilbertQuadkey() {
                const quads = pointToHilbertQuadList(
                    this.ij[0],
                    this.ij[1],
                    this.level,
                    this.face
                );

                return `${this.face}/${quads.join('')}`;
            }

            getNeighbors() {
                const fromFaceIJWrap = (face, ij, level) => {
                    const maxSize = 1 << level;

                    if (ij[0] >= 0 && ij[1] >= 0 && ij[0] < maxSize && ij[1] < maxSize) {
                        return new Cell(face, ij, level);
                    }

                    const st = ijToST(ij, level, [0.5, 0.5]);
                    const xyz = faceUVToXYZ(face, stToUV(st));
                    const [wrappedFace, uv] = xyzToFaceUV(xyz);
                    return new Cell(wrappedFace, stToIJ(uvToST(uv), level), level);
                };

                const [i, j] = this.ij;

                return [
                    fromFaceIJWrap(this.face, [i - 1, j], this.level),
                    fromFaceIJWrap(this.face, [i, j - 1], this.level),
                    fromFaceIJWrap(this.face, [i + 1, j], this.level),
                    fromFaceIJWrap(this.face, [i, j + 1], this.level),
                ];
            }
        }

        function quadkeyToUnsignedId(key) {
            const [faceText, position = ''] = key.split('/');
            const face = BigInt(faceText);
            const level = position.length;
            let positionValue = 0n;

            for (const digit of position) {
                positionValue = positionValue * 4n + BigInt(digit);
            }

            const positionShift = BigInt(61 - 2 * level);
            const markerShift = BigInt(60 - 2 * level);

            return (face << 61n) |
                (positionValue << positionShift) |
                (1n << markerShift);
        }

        function cellToSignedId(cell) {
            const unsigned = quadkeyToUnsignedId(cell.toHilbertQuadkey());
            return unsigned >= (1n << 63n)
                ? (unsigned - (1n << 64n)).toString()
                : unsigned.toString();
        }

        return { Cell, cellToSignedId };
    })();

    function wrapLng(lng) {
        return ((((lng + 180) % 360) + 360) % 360) - 180;
    }

    function boundsToBox(bounds) {
        const ne = bounds.getNorthEast();
        const sw = bounds.getSouthWest();

        let north = ne.lat();
        let south = sw.lat();
        let east = ne.lng();
        let west = sw.lng();

        const latPad = Math.max(0.00005, Math.abs(north - south) * CONFIG.viewportPaddingRatio);
        let lngSpan = east - west;
        if (lngSpan < 0) lngSpan += 360;
        const lngPad = Math.max(0.00005, lngSpan * CONFIG.viewportPaddingRatio);

        north = Math.min(90, north + latPad);
        south = Math.max(-90, south - latPad);
        east = wrapLng(east + lngPad);
        west = wrapLng(west - lngPad);

        return { north, south, east, west };
    }

    function lngInBox(lng, box) {
        const wrapped = wrapLng(lng);

        if (box.west <= box.east) {
            return wrapped >= box.west && wrapped <= box.east;
        }

        return wrapped >= box.west || wrapped <= box.east;
    }

    function pointInBox(value, box) {
        return value.lat >= box.south &&
            value.lat <= box.north &&
            lngInBox(value.lng, box);
    }

    function cellIntersectsBox(cell, box) {
        const corners = cell.getCornerLatLngs();
        const center = cell.getLatLng();

        if (pointInBox(center, box)) return true;
        if (corners.some(corner => pointInBox(corner, box))) return true;

        const cellNorth = Math.max(...corners.map(corner => corner.lat));
        const cellSouth = Math.min(...corners.map(corner => corner.lat));

        if (cellSouth > box.north || cellNorth < box.south) return false;

        if (box.west <= box.east) {
            const lngs = corners.map(corner => wrapLng(corner.lng));
            const cellWest = Math.min(...lngs);
            const cellEast = Math.max(...lngs);
            return !(cellEast < box.west || cellWest > box.east);
        }

        return true;
    }

    function cellKey(cell) {
        return `${cell.level}:${cell.toHilbertQuadkey()}`;
    }

    function getVisibleCells(map, bounds) {
        const center = map.getCenter();
        const box = boundsToBox(bounds);
        const start = S2.Cell.fromLatLng({ lat: center.lat(), lng: center.lng() }, CONFIG.s2Level);
        const queue = [start];
        const queued = new Set([cellKey(start)]);
        const visible = [];

        while (queue.length && visible.length <= CONFIG.maxCells) {
            const cell = queue.shift();
            if (!cellIntersectsBox(cell, box)) continue;

            visible.push(cell);

            for (const neighbor of cell.getNeighbors()) {
                const key = cellKey(neighbor);
                if (queued.has(key)) continue;
                queued.add(key);
                queue.push(neighbor);
            }
        }

        if (visible.length > CONFIG.maxCells) {
            throw new Error(`Too many map cells (${visible.length}). Zoom in further to load Routes.`);
        }

        return visible;
    }

    // -------------------------------------------------------------------------
    // Route requests and parsing
    // -------------------------------------------------------------------------

    function makeMapRequest(cellIds) {
        return {
            operationName: 'PgoGameMapObjectsByS2CellsProvider_mapObjectsByS2Cells_Query',
            query: MAP_ROUTES_QUERY,
            variables: {
                realityChannelMapObjectsByS2CellsInput: {
                    realityChannelId: CONFIG.realityChannelId,
                    s2CellLevel: CONFIG.s2Level,
                    sourcesByS2Cells: cellIds.map(s2CellId => ({
                        s2CellId,
                        sources: [{
                            name: 'PGO',
                            dropTypes: ['PGO_ROUTE'],
                        }],
                    })),
                },
            },
        };
    }

    function makeDetailsRequest(graphId) {
        return {
            operationName: 'PgoRouteDetails',
            query: ROUTE_DETAILS_QUERY,
            variables: { ids: [graphId] },
        };
    }

    function toPosition(location) {
        const lat = Number(location?.latitude);
        const lng = Number(location?.longitude);
        return Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null;
    }

    function parseRouteSummaries(json) {
        const groups = json?.data?.realityChannelMapObjectsByS2Cells?.mapObjectsByS2CellsAndTypes;
        const routes = new Map();

        if (!Array.isArray(groups)) return routes;

        for (const cellGroup of groups) {
            for (const typeGroup of cellGroup?.mapObjectsByType || []) {
                for (const object of typeGroup?.mapObjects || []) {
                    if (object?.mapObjectType !== 'PGO_ROUTE' || !object?.pgoRoute || !object?.id) continue;

                    const start = toPosition(object.pgoRoute.startPoi?.location);
                    const end = toPosition(object.pgoRoute.endPoi?.location);
                    if (!start || !end) continue;

                    routes.set(object.id, {
                        graphId: object.id,
                        routeId: object.pgoRoute.id,
                        distanceMeters: Number(object.pgoRoute.distanceMeters) || 0,
                        reversible: Boolean(object.pgoRoute.reversible),
                        tagList: Array.isArray(object.pgoRoute.tagList) ? object.pgoRoute.tagList : [],
                        startFortId: object.pgoRoute.startPoi?.fortId || '',
                        endFortId: object.pgoRoute.endPoi?.fortId || '',
                        start,
                        end,
                    });
                }
            }
        }

        return routes;
    }

    function parseRouteDetail(json, graphId) {
        const object = json?.data?.gameMapObjectsByID?.find(item => item?.id === graphId) ||
            json?.data?.gameMapObjectsByID?.[0];

        if (!object?.pgoRoute) {
            throw new Error('The route detail response did not include a route.');
        }

        const route = object.pgoRoute;
        const start = toPosition(route.startPoi?.location);
        const end = toPosition(route.endPoi?.location);
        const locationList = (route.locationList || []).map(toPosition).filter(Boolean);

        if (!start || !end) {
            throw new Error('The route detail response did not include valid endpoints.');
        }

        return {
            graphId: object.id || graphId,
            routeId: route.id,
            name: String(route.name || 'Pokémon GO Route'),
            distanceMeters: Number(route.distanceMeters) || 0,
            durationSeconds: Number(route.durationSeconds) || 0,
            reversible: Boolean(route.reversible),
            tagList: Array.isArray(route.tagList) ? route.tagList : [],
            startFortId: route.startPoi?.fortId || '',
            endFortId: route.endPoi?.fortId || '',
            startImageUrl: route.startPoi?.imageUrl || '',
            start,
            end,
            locationList,
        };
    }

    // -------------------------------------------------------------------------
    // Google Maps overlays
    // -------------------------------------------------------------------------

    function getMaps() {
        return getPageWindow().google?.maps || null;
    }

    function clearOverlay(overlay) {
        try {
            overlay?.setMap?.(null);
        } catch (_) {}
    }

    function clearSummaryOverlays() {
        for (const overlaySet of state.summaryOverlays.values()) {
            clearOverlay(overlaySet.start);
            clearOverlay(overlaySet.end);
        }

        state.summaryOverlays.clear();
        state.routeSummaries.clear();
    }

    function clearSelectedRoute() {
        clearOverlay(state.selectedPolyline);
        clearOverlay(state.selectedStart);
        clearOverlay(state.selectedEnd);
        state.selectedPolyline = null;
        state.selectedStart = null;
        state.selectedEnd = null;
        state.selectedGraphId = null;

        try {
            state.infoWindow?.close?.();
        } catch (_) {}
    }

    function clearAllRoutes() {
        clearSummaryOverlays();
        clearSelectedRoute();
        state.lastCellSignature = '';
    }

    function endpointMarkerSvg(color, label) {
        const safeColor = String(color || '#7556db').replace(/[^#(),.%a-zA-Z0-9\s-]/g, '');
        const safeLabel = String(label || '').slice(0, 1).replace(/[<>&"']/g, '');
        const svg = `
            <svg xmlns="http://www.w3.org/2000/svg" width="30" height="40" viewBox="0 0 30 40">
                <path d="M15 1C7.27 1 1 7.27 1 15c0 10.65 14 24 14 24s14-13.35 14-24C29 7.27 22.73 1 15 1Z"
                    fill="${safeColor}" stroke="#fff" stroke-width="2"/>
                <circle cx="15" cy="15" r="7" fill="#fff"/>
                <text x="15" y="19" text-anchor="middle" font-family="Arial, sans-serif"
                    font-size="11" font-weight="700" fill="${safeColor}">${safeLabel}</text>
            </svg>
        `.trim();

        return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
    }

    function createEndpointMarker(position, options = {}) {
        const maps = getMaps();
        if (!maps?.Marker || !state.map) return null;

        const size = Math.max(20, Number(options.size) || 30);
        const height = Math.round(size * 4 / 3);

        return new maps.Marker({
            map: state.map,
            position,
            clickable: options.clickable !== false,
            title: options.title || '',
            zIndex: options.zIndex || 850,
            icon: {
                url: endpointMarkerSvg(options.color, options.label),
                scaledSize: new maps.Size(size, height),
                anchor: new maps.Point(size / 2, height - 1),
            },
        });
    }

    function addRouteClickListener(overlay, route) {
        if (!overlay?.addListener) return;

        overlay.addListener('click', event => {
            selectRoute(route, event?.latLng).catch(error => {
                console.error('[PGO Routes] Could not load route details:', error);
                showStatus(error.message || 'Could not load route details.', 'error', 6000);
                showRouteError(route, error);
            });
        });
    }

    function renderRouteSummaries(routes) {
        const maps = getMaps();
        if (!state.map || !maps?.Marker) return;

        const wanted = new Set(routes.keys());

        for (const [graphId, overlaySet] of state.summaryOverlays.entries()) {
            if (wanted.has(graphId)) continue;
            clearOverlay(overlaySet.start);
            clearOverlay(overlaySet.end);
            state.summaryOverlays.delete(graphId);
        }

        for (const route of routes.values()) {
            const existing = state.summaryOverlays.get(route.graphId);

            if (existing) {
                existing.start.setPosition(route.start);
                existing.end.setPosition(route.end);
                existing.route = route;
                continue;
            }

            const start = createEndpointMarker(route.start, {
                ...CONFIG.summaryStartMarker,
                title: 'Route start',
            });
            const end = createEndpointMarker(route.end, {
                ...CONFIG.summaryEndMarker,
                title: 'Route end',
            });
            const overlaySet = { start, end, route };
            state.summaryOverlays.set(route.graphId, overlaySet);

            addRouteClickListener(start, route);
            addRouteClickListener(end, route);
        }

        state.routeSummaries = routes;
    }

    function routePath(detail) {
        const points = [...detail.locationList];

        if (!points.length || !samePosition(points[0], detail.start)) {
            points.unshift(detail.start);
        }

        if (!samePosition(points[points.length - 1], detail.end)) {
            points.push(detail.end);
        }

        return points;
    }

    function samePosition(a, b) {
        if (!a || !b) return false;
        return Math.abs(a.lat - b.lat) < 1e-7 && Math.abs(a.lng - b.lng) < 1e-7;
    }

    function renderSelectedRoute(detail) {
        const maps = getMaps();
        if (!state.map || !maps?.Polyline) return;

        clearOverlay(state.selectedPolyline);
        clearOverlay(state.selectedStart);
        clearOverlay(state.selectedEnd);

        state.selectedGraphId = detail.graphId;
        state.selectedPolyline = new maps.Polyline({
            map: state.map,
            path: routePath(detail),
            geodesic: true,
            clickable: true,
            ...CONFIG.selectedLine,
        });

        state.selectedStart = createEndpointMarker(detail.start, {
            color: '#2d9d62',
            label: 'S',
            size: 34,
            title: 'Selected route start',
            zIndex: 950,
        });

        state.selectedEnd = createEndpointMarker(detail.end, {
            color: '#d64b4b',
            label: 'E',
            size: 34,
            title: 'Selected route end',
            zIndex: 950,
        });

        const reopen = event => showRouteInfo(detail, event?.latLng || detail.start);
        state.selectedPolyline.addListener?.('click', reopen);
        state.selectedStart?.addListener?.('click', reopen);
        state.selectedEnd?.addListener?.('click', reopen);
    }

    function ensureInfoWindow() {
        const maps = getMaps();
        if (!state.infoWindow && maps?.InfoWindow) {
            state.infoWindow = new maps.InfoWindow({
                headerDisabled: true,
                maxWidth: 280,
            });
        }
        return state.infoWindow;
    }

    function formatDistance(metres) {
        const value = Number(metres) || 0;
        return value >= 1000
            ? `${(value / 1000).toFixed(value >= 10000 ? 1 : 2)} km (${Math.round(value).toLocaleString()} m)`
            : `${Math.round(value).toLocaleString()} m`;
    }

    function formatDuration(seconds) {
        const totalMinutes = Math.max(0, Math.round((Number(seconds) || 0) / 60));
        if (!totalMinutes) return '';
        const hours = Math.floor(totalMinutes / 60);
        const minutes = totalMinutes % 60;
        return hours ? `${hours} hr ${minutes} min` : `${minutes} min`;
    }

    function createInfoShell(titleText) {
        const root = document.createElement('div');
        root.className = 'pgo-routes-info';

        const header = document.createElement('div');
        header.className = 'pgo-routes-info-header';

        const title = document.createElement('div');
        title.className = 'pgo-routes-info-title';
        title.textContent = titleText;
        header.appendChild(title);

        const closeButton = document.createElement('button');
        closeButton.type = 'button';
        closeButton.className = 'pgo-routes-info-close';
        closeButton.setAttribute('aria-label', 'Close route details');
        closeButton.title = 'Close';
        closeButton.textContent = '×';
        closeButton.addEventListener('click', () => {
            try {
                state.infoWindow?.close?.();
            } catch (_) {}
        });
        header.appendChild(closeButton);

        root.appendChild(header);
        return root;
    }

    function addInfoRow(root, label, value) {
        const row = document.createElement('div');
        row.className = 'pgo-routes-info-row';

        const labelNode = document.createElement('strong');
        labelNode.textContent = `${label}: `;
        row.appendChild(labelNode);
        row.appendChild(document.createTextNode(value));
        root.appendChild(row);
    }

    function createInfoContent(detail) {
        const root = createInfoShell(detail.name || 'Pokémon GO Route');

        addInfoRow(root, 'Distance', formatDistance(detail.distanceMeters));

        const duration = formatDuration(detail.durationSeconds);
        if (duration) addInfoRow(root, 'Duration', duration);
        if (detail.reversible) addInfoRow(root, 'Direction', 'Reversible');

        return root;
    }

    function createLoadingContent(route) {
        const root = createInfoShell('Loading Route…');
        addInfoRow(root, 'Distance', formatDistance(route.distanceMeters));
        return root;
    }

    function showInfoContent(content, position) {
        const infoWindow = ensureInfoWindow();
        if (!infoWindow || !state.map) return;

        infoWindow.setContent(content);
        infoWindow.setPosition(position);
        infoWindow.open(state.map);
    }

    function showRouteInfo(detail, position = detail.start) {
        showInfoContent(createInfoContent(detail), position);
    }

    function showRouteError(route, error) {
        const root = createInfoShell('Could not load Route');

        const message = document.createElement('div');
        message.className = 'pgo-routes-info-row';
        message.textContent = error?.message || 'Unknown error';
        root.appendChild(message);
        showInfoContent(root, route.start);
    }

    async function selectRoute(route, clickPosition) {
        if (!state.active) return;

        showInfoContent(createLoadingContent(route), clickPosition || route.start);

        let detail = state.detailCache.get(route.graphId);

        if (!detail) {
            const json = await graphqlRequest(makeDetailsRequest(route.graphId));
            detail = parseRouteDetail(json, route.graphId);
            state.detailCache.set(route.graphId, detail);
        }

        if (!state.active) return;
        renderSelectedRoute(detail);
        showRouteInfo(detail, clickPosition || detail.start);
    }

    // -------------------------------------------------------------------------
    // Scanning and map lifecycle
    // -------------------------------------------------------------------------

    async function scanVisibleRoutes() {
        if (!state.active || !state.map) return;

        const zoom = state.map.getZoom();
        const bounds = state.map.getBounds();

        if (typeof zoom !== 'number' || !bounds) return;

        if (zoom < CONFIG.minZoom) {
            state.scanController?.abort();
            clearAllRoutes();
            updateButtonState();
            showStatus(`Zoom to level ${CONFIG.minZoom} or closer to load Routes.`, 'info', 4500);
            return;
        }

        let cells;

        try {
            cells = getVisibleCells(state.map, bounds);
        } catch (error) {
            clearAllRoutes();
            updateButtonState();
            showStatus(error.message, 'error', 5500);
            return;
        }

        const cellIds = cells.map(S2.cellToSignedId).sort();
        const signature = cellIds.join(',');

        if (signature === state.lastCellSignature) return;

        state.scanController?.abort();
        state.scanController = new AbortController();
        const sequence = ++state.scanSequence;

        setButtonBusy(true);

        try {
            const json = await graphqlRequest(makeMapRequest(cellIds), state.scanController.signal);
            if (!state.active || sequence !== state.scanSequence) return;

            const routes = parseRouteSummaries(json);
            state.lastCellSignature = signature;
            renderRouteSummaries(routes);

            if (state.selectedGraphId && !routes.has(state.selectedGraphId)) {
                clearSelectedRoute();
            }

            updateButtonState();
            showStatus(
                routes.size ? `${routes.size} Route${routes.size === 1 ? '' : 's'} loaded.` : 'No Routes found in these map bounds.',
                'success',
                2600
            );
        } catch (error) {
            if (error?.name === 'AbortError') return;
            console.error('[PGO Routes] Route scan failed:', error);
            showStatus(error.message || 'Could not load Routes.', 'error', 6500);
        } finally {
            if (sequence === state.scanSequence) setButtonBusy(false);
        }
    }

    function scheduleScan() {
        if (!state.active) return;
        clearTimeout(state.scanTimer);
        state.scanTimer = setTimeout(() => {
            scanVisibleRoutes().catch(error => {
                console.error('[PGO Routes] Scan failed:', error);
            });
        }, CONFIG.scanDebounceMs);
    }

    function attachMap(map) {
        if (!map) return;
        state.map = map;

        if (state.listenedMaps.has(map)) return;
        state.listenedMaps.add(map);

        const maps = getMaps();
        if (!maps?.event) return;

        maps.event.addListener(map, 'idle', scheduleScan);
        maps.event.addListener(map, 'zoom_changed', () => {
            state.lastCellSignature = '';
        });

        if (state.active) scheduleScan();
    }

    function setActive(active) {
        state.active = Boolean(active);
        state.lastCellSignature = '';

        if (!state.active) {
            clearTimeout(state.scanTimer);
            state.scanController?.abort();
            state.scanSequence += 1;
            clearAllRoutes();
        } else {
            scheduleScan();
        }

        updateButtonState();
    }

    // -------------------------------------------------------------------------
    // Toolbar UI
    // -------------------------------------------------------------------------

    function injectStyles() {
        if (document.getElementById('pgo-routes-styles')) return;

        const style = document.createElement('style');
        style.id = 'pgo-routes-styles';
        style.textContent = `
            #pgo-routes-button {
                --color: #171717;
                --padding-start: 8px;
                --padding-end: 8px;
                min-width: 38px;
            }

            #pgo-routes-button.pgo-routes-active {
                --background: rgba(255, 255, 255, 0.92);
                --border-radius: 18px;
                --box-shadow: 0 1px 5px rgba(0, 0, 0, 0.18);
            }

            #pgo-routes-button.pgo-routes-busy {
                opacity: 0.68;
            }

            #pgo-routes-button .pgo-routes-icon-slot,
            #pgo-routes-button .pgo-routes-close-slot {
                display: inline-flex;
                align-items: center;
                justify-content: center;
                flex: 0 0 auto;
            }

            #pgo-routes-button .pgo-routes-icon-slot svg {
                width: 19px;
                height: 19px;
                display: block;
            }

            #pgo-routes-button .pgo-routes-close-slot svg {
                width: 9px;
                height: 9px;
                display: block;
            }

            #pgo-routes-button .pgo-routes-label {
                white-space: nowrap;
            }

            #pgo-routes-status {
                position: fixed;
                left: 50%;
                top: 82px;
                z-index: 2147483646;
                transform: translateX(-50%);
                max-width: min(520px, calc(100vw - 28px));
                padding: 8px 12px;
                border-radius: 8px;
                background: rgba(28, 28, 30, 0.94);
                color: #ffffff;
                font: 600 13px/1.35 system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
                text-align: center;
                box-shadow: 0 3px 12px rgba(0, 0, 0, 0.28);
                pointer-events: none;
            }

            #pgo-routes-status[data-kind="error"] {
                background: rgba(145, 34, 34, 0.96);
            }

            #pgo-routes-status[data-kind="success"] {
                background: rgba(24, 104, 63, 0.96);
            }

            .pgo-routes-info {
                min-width: 170px;
                max-width: 260px;
                margin: 0;
                padding: 0;
                color: #171717;
                font: 13px/1.35 system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
            }

            .pgo-routes-info-header {
                display: flex;
                align-items: flex-start;
                gap: 8px;
                margin: 0 0 6px;
            }

            .pgo-routes-info-title {
                flex: 1 1 auto;
                min-width: 0;
                margin: 0;
                font-size: 15px;
                font-weight: 750;
                line-height: 1.25;
            }

            .pgo-routes-info-close {
                display: inline-flex;
                align-items: center;
                justify-content: center;
                flex: 0 0 auto;
                width: 22px;
                height: 22px;
                margin: -3px -3px 0 2px;
                padding: 0;
                border: 0;
                border-radius: 50%;
                background: transparent;
                color: #68727d;
                font: 400 24px/1 Arial, sans-serif;
                cursor: pointer;
            }

            .pgo-routes-info-close:hover,
            .pgo-routes-info-close:focus-visible {
                background: rgba(0, 0, 0, 0.08);
                color: #27313a;
                outline: none;
            }

            .pgo-routes-info-row + .pgo-routes-info-row {
                margin-top: 3px;
            }

            /* The newer Google Maps InfoWindow reserves a separate 48px header
               row. Hide it only for this script's window; the compact close
               button above remains available. */
            .gm-style-iw-c:has(.pgo-routes-info) .gm-style-iw-chr,
            .gm-style-iw:has(.pgo-routes-info) .gm-style-iw-chr {
                display: none !important;
            }

            .gm-style-iw-c:has(.pgo-routes-info) .gm-style-iw-d,
            .gm-style-iw:has(.pgo-routes-info) .gm-style-iw-d {
                padding: 0 !important;
                overflow: auto !important;
            }
        `;

        (document.head || document.documentElement).appendChild(style);
    }

    function iconUrlOf(element) {
        return String(element?.getAttribute?.('icon') || '').toLowerCase();
    }

    function isNativeRouteButton(button) {
        if (!button || button.id === 'pgo-routes-button') return false;

        const icons = [...button.querySelectorAll('ion-icon')].map(iconUrlOf);
        if (icons.some(url => url.includes('/pgo-route.') || url.includes('pgo-route.'))) return true;

        return [...button.querySelectorAll('span')]
            .some(span => span.textContent?.trim().toLowerCase() === 'routes');
    }

    function isKnownFilterButton(button) {
        if (!button) return false;
        if (button.id === 'pgo-routes-button') return true;

        const icons = [...button.querySelectorAll('ion-icon')].map(iconUrlOf);

        return icons.some(url =>
            url.includes('/boss.') ||
            url.includes('/super_mega_level.') ||
            url.includes('/live-event.') ||
            url.includes('/pgo-gmax.') ||
            url.includes('/pgo-dmax.') ||
            url.includes('/pgo-gym.') ||
            url.includes('/pgo-pokestop.') ||
            url.includes('/pgo-route.')
        );
    }

    function findFilterContainer() {
        const buttons = [...document.querySelectorAll('ion-button')].filter(isKnownFilterButton);
        if (!buttons.length) return null;

        for (let index = buttons.length - 1; index >= 0; index -= 1) {
            const button = buttons[index];
            let wrapper = button.parentElement;

            while (wrapper && wrapper !== document.body && wrapper !== document.documentElement) {
                const parent = wrapper.parentElement;
                if (!parent) break;

                const directFilterChildren = [...parent.children].filter(child =>
                    [...child.querySelectorAll('ion-button')].some(isKnownFilterButton)
                );

                if (directFilterChildren.length >= 2) {
                    return { parent, templateWrapper: directFilterChildren[directFilterChildren.length - 1] };
                }

                wrapper = parent;
            }
        }

        return null;
    }

    function routeIconSlot() {
        const slot = document.createElement('span');
        slot.slot = 'icon-only';
        slot.className = 'pgo-routes-icon-slot';
        slot.innerHTML = `
            <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M6.1 17.2c2.9-5.8 6.1-2.5 8.1-7.1 1-2.3 2.2-3.2 3.7-3.7"
                      stroke="currentColor" stroke-width="2.15" stroke-linecap="round"/>
                <circle cx="5" cy="19" r="2.4" fill="currentColor"/>
                <circle cx="19" cy="5" r="2.4" fill="currentColor"/>
            </svg>
        `;
        return slot;
    }

    function closeIconSlot() {
        const slot = document.createElement('span');
        slot.slot = 'end';
        slot.className = 'pgo-routes-close-slot';
        slot.innerHTML = `
            <svg viewBox="0 0 10 10" fill="none" aria-hidden="true">
                <path d="M1.5 1.5 8.5 8.5M8.5 1.5 1.5 8.5"
                      stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>
            </svg>
        `;
        return slot;
    }

    function createRoutesButton(templateWrapper) {
        const wrapper = document.createElement('div');
        wrapper.id = 'pgo-routes-button-wrap';
        wrapper.className = templateWrapper?.className || '';

        const templateButton = templateWrapper?.querySelector('ion-button');
        const button = document.createElement('ion-button');
        button.id = 'pgo-routes-button';
        button.setAttribute('fill', templateButton?.getAttribute('fill') || 'clear');
        button.setAttribute('size', templateButton?.getAttribute('size') || 'small');
        button.className = templateButton?.className || '';
        button.type = 'button';

        button.appendChild(routeIconSlot());

        const spacer = document.createElement('div');
        spacer.style.cssText = 'width:6px;flex:0 0 auto;';
        button.appendChild(spacer);

        const label = document.createElement('span');
        label.className = `${templateButton?.querySelector('span')?.className || ''} pgo-routes-label`.trim();
        label.textContent = 'Routes';
        button.appendChild(label);

        button.addEventListener('click', event => {
            event.preventDefault();
            event.stopPropagation();
            setActive(!state.active);
        });

        wrapper.appendChild(button);
        return wrapper;
    }

    function injectRoutesButton() {
        injectStyles();

        if ([...document.querySelectorAll('ion-button')].some(isNativeRouteButton)) {
            document.getElementById('pgo-routes-button-wrap')?.remove();
            return;
        }

        const existing = document.getElementById('pgo-routes-button-wrap');
        const found = findFilterContainer();
        if (!found) return;

        if (existing) {
            if (existing.parentElement !== found.parent) {
                found.parent.appendChild(existing);
            } else if (existing !== found.parent.lastElementChild) {
                found.parent.appendChild(existing);
            }
            updateButtonState();
            return;
        }

        found.parent.appendChild(createRoutesButton(found.templateWrapper));
        updateButtonState();
    }

    function updateButtonState() {
        const button = document.getElementById('pgo-routes-button');
        if (!button) return;

        button.classList.toggle('pgo-routes-active', state.active);

        const existingClose = button.querySelector('.pgo-routes-close-slot');
        if (state.active && !existingClose) button.appendChild(closeIconSlot());
        if (!state.active && existingClose) existingClose.remove();

        const count = state.routeSummaries.size;
        const zoom = state.map?.getZoom?.();

        if (state.active && typeof zoom === 'number' && zoom < CONFIG.minZoom) {
            button.title = `Routes active — zoom to ${CONFIG.minZoom} or closer`;
        } else if (state.active) {
            button.title = `${count} Route${count === 1 ? '' : 's'} loaded — click to hide`;
        } else {
            button.title = 'Show Routes';
        }
    }

    function setButtonBusy(busy) {
        document.getElementById('pgo-routes-button')
            ?.classList.toggle('pgo-routes-busy', Boolean(busy));
    }

    function showStatus(message, kind = 'info', durationMs = 3500) {
        if (!document.body || !message) return;

        let status = document.getElementById('pgo-routes-status');
        if (!status) {
            status = document.createElement('div');
            status.id = 'pgo-routes-status';
            document.body.appendChild(status);
        }

        status.dataset.kind = kind;
        status.textContent = message;
        status.hidden = false;

        clearTimeout(state.statusTimer);
        state.statusTimer = setTimeout(() => {
            status.hidden = true;
        }, durationMs);
    }

    function scheduleUiInjection() {
        if (state.uiRaf !== null) return;

        state.uiRaf = requestAnimationFrame(() => {
            state.uiRaf = null;
            injectRoutesButton();
        });
    }

    function startUiObserver() {
        if (state.uiObserver) return;

        state.uiObserver = new MutationObserver(scheduleUiInjection);
        state.uiObserver.observe(document.documentElement, {
            childList: true,
            subtree: true,
        });

        scheduleUiInjection();
    }

    // -------------------------------------------------------------------------
    // Bootstrap
    // -------------------------------------------------------------------------

    const PgoMapMods = getPgoMapMods();
    PgoMapMods.whenMapReady(attachMap);

    const existingMap = PgoMapMods.getMap();
    if (existingMap) attachMap(existingMap);

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', startUiObserver, { once: true });
    } else {
        startUiObserver();
    }
})();
