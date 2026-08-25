// ==UserScript==
// @name         Wayfarer Bonus Area Visualiser
// @version      1.2.0
// @description  Shows L7 cells covered by Home and Bonus areas
// @namespace    https://gitlab.com/Tntnnbltn/wayfarer-addons
// @downloadURL  https://gitlab.com/Tntnnbltn/wayfarer-addons/-/raw/main/wayfarer-bonus-area-visualiser.user.js
// @updateURL    https://gitlab.com/Tntnnbltn/wayfarer-addons/-/raw/main/wayfarer-bonus-area-visualiser.user.js
// @homepageURL  https://gitlab.com/Tntnnbltn/wayfarer-addons
// @match        https://wayfarer.scopely.com/*
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

(() => {
    "use strict";

    const TARGET_ROUTE = "/new/settings";

    let routeActive = false;
    let lastLoggedKey = null;

    // Map + overlays (polygons)
    let settingsMap = null;
    let s2Polys = [];

    // -------------------------
    // Route detection
    // -------------------------
    function isOnTargetRoute() {
        return location.pathname === TARGET_ROUTE;
    }

    function teardownRoute() {
        routeActive = false;
        lastLoggedKey = null;
        settingsMap = null;
        clearS2();
    }

    function startRoute() {
        if (routeActive) return;
        routeActive = true;
        lastLoggedKey = null;
        ensureGoogleMapsPatched();
    }

    function installRouteWatcher() {
        const origPushState = history.pushState;
        const fireRouteCheck = () => queueMicrotask(checkRoute);

        history.pushState = function (...args) {
            const ret = origPushState.apply(this, args);
            fireRouteCheck();
            return ret;
        };

        // window.addEventListener("popstate", fireRouteCheck, true);
        fireRouteCheck();
    }

    function checkRoute() {
        const onTarget = isOnTargetRoute();
        if (onTarget && !routeActive) startRoute();
        if (!onTarget && routeActive) teardownRoute();
    }

    // -------------------------
    // Google Maps patching
    // -------------------------
    function ensureGoogleMapsPatched() {
        waitForGoogleMaps(() => {
            const g = window.google;
            if (!g?.maps) return;
            patchGoogleMaps(g.maps);
        });
    }

    function waitForGoogleMaps(onReady) {
        const tick = () => {
            const g = window.google;
            if (g && g.maps && typeof g.maps.Marker === "function") {
                onReady();
                return;
            }
            setTimeout(tick, 250);
        };
        tick();
    }

    function isDivInsideLocationSettingMap(div) {
        return !!div?.closest?.("wf-location-setting-map");
    }

    function clearS2() {
        for (const p of s2Polys) {
            try { p.setMap(null); } catch {}
        }
        s2Polys = [];
    }

    function redrawS2(latLng) {
        if (!settingsMap || !latLng) return;

        clearS2();

        // At approximately 60 degrees North, cell size increases
        // Use Level 6 instead of Level 7 cells in this case
        const level = latLng.lat > 60 ? 6 : 7;

        const center = S2.S2Cell.FromLatLng(latLng, level);
        const cells = [center, ...center.getSurrounding()];

        for (const cell of cells) {
            const corners = cell.getCornerLatLngs().map(c => ({ lat: c.lat, lng: c.lng }));

            const poly = new google.maps.Polygon({
                map: settingsMap,
                paths: corners,
                strokeColor: "#000000",
                strokeOpacity: 1,
                strokeWeight: 2,
                fillColor: "#90EE90",
                fillOpacity: 0.25,
                clickable: false
            });

            s2Polys.push(poly);
        }
    }

    function patchGoogleMaps(maps) {
        const origSetPosition = maps.Marker.prototype.setPosition;

        maps.Marker.prototype.setPosition = function (pos) {
            const ret = origSetPosition.call(this, pos);

            if (!routeActive || !pos) return ret;

            const lat = pos.lat;
            const lng = pos.lng;
            if (typeof lat !== "number" || typeof lng !== "number") return ret;

            const key = `${lat.toFixed(6)},${lng.toFixed(6)}`;
            if (key === lastLoggedKey) return ret;

            // Only react to markers on the settings map
            const m = this;
            const mMap = typeof m.getMap === "function" ? m.getMap() : null;
            const mDiv = mMap && typeof mMap.getDiv === "function" ? mMap.getDiv() : null;

            if (!mDiv || !isDivInsideLocationSettingMap(mDiv)) return ret;

            settingsMap = mMap;
            lastLoggedKey = key;

            // Redraw S2 L7 cell + 8 neighbours
            redrawS2({ lat, lng });

            return ret;
        };
    }

    // -------------------------
    // S2 Geometry (L7 cells)
    // -------------------------
    const d2r = Math.PI / 180.0;
    const r2d = 180.0 / Math.PI;

    const S2 = {};

    function LatLngToXYZ(latLng) {
        const phi = latLng.lat * d2r;
        const theta = latLng.lng * d2r;
        const cosphi = Math.cos(phi);
        return [Math.cos(theta) * cosphi, Math.sin(theta) * cosphi, Math.sin(phi)];
    }

    function XYZToLatLng(xyz) {
        const lat = Math.atan2(xyz[2], Math.sqrt(xyz[0] * xyz[0] + xyz[1] * xyz[1]));
        const lng = Math.atan2(xyz[1], xyz[0]);
        return { lat: lat * r2d, lng: lng * r2d };
    }

    function largestAbsComponent(xyz) {
        const temp = [Math.abs(xyz[0]), Math.abs(xyz[1]), Math.abs(xyz[2])];
        if (temp[0] > temp[1]) return temp[0] > temp[2] ? 0 : 2;
        return temp[1] > temp[2] ? 1 : 2;
    }

    function faceXYZToUV(face, xyz) {
        let u, v;
        switch (face) {
            case 0: u = xyz[1] / xyz[0]; v = xyz[2] / xyz[0]; break;
            case 1: u = -xyz[0] / xyz[1]; v = xyz[2] / xyz[1]; break;
            case 2: u = -xyz[0] / xyz[2]; v = -xyz[1] / xyz[2]; break;
            case 3: u = xyz[2] / xyz[0]; v = xyz[1] / xyz[0]; break;
            case 4: u = xyz[2] / xyz[1]; v = -xyz[0] / xyz[1]; break;
            case 5: u = -xyz[1] / xyz[2]; v = -xyz[0] / xyz[2]; break;
            default: throw new Error("Invalid face");
        }
        return [u, v];
    }

    function XYZToFaceUV(xyz) {
        let face = largestAbsComponent(xyz);
        if (xyz[face] < 0) face += 3;
        return [face, faceXYZToUV(face, xyz)];
    }

    function FaceUVToXYZ(face, uv) {
        const u = uv[0], v = uv[1];
        switch (face) {
            case 0: return [1, u, v];
            case 1: return [-u, 1, v];
            case 2: return [-u, -v, 1];
            case 3: return [-1, -v, -u];
            case 4: return [v, -1, -u];
            case 5: return [v, u, -1];
            default: throw new Error("Invalid face");
        }
    }

    function STToUV(st) {
        const f = (s) => (s >= 0.5) ? (1 / 3) * (4 * s * s - 1) : (1 / 3) * (1 - 4 * (1 - s) * (1 - s));
        return [f(st[0]), f(st[1])];
    }

    function UVToST(uv) {
        const f = (u) => (u >= 0) ? 0.5 * Math.sqrt(1 + 3 * u) : 1 - 0.5 * Math.sqrt(1 - 3 * u);
        return [f(uv[0]), f(uv[1])];
    }

    function STToIJ(st, order) {
        const maxSize = 1 << order;
        const f = (s) => {
            const ij = Math.floor(s * maxSize);
            return Math.max(0, Math.min(maxSize - 1, ij));
        };
        return [f(st[0]), f(st[1])];
    }

    function IJToST(ij, order, offsets) {
        const maxSize = 1 << order;
        return [(ij[0] + offsets[0]) / maxSize, (ij[1] + offsets[1]) / maxSize];
    }

    S2.S2Cell = function () {};

    S2.S2Cell.FromLatLng = function (latLng, level) {
        const xyz = LatLngToXYZ(latLng);
        const faceuv = XYZToFaceUV(xyz);
        const st = UVToST(faceuv[1]);
        const ij = STToIJ(st, level);
        return S2.S2Cell.FromFaceIJ(faceuv[0], ij, level);
    };

    S2.S2Cell.FromFaceIJ = function (face, ij, level) {
        const cell = new S2.S2Cell();
        cell.face = face;
        cell.ij = ij;
        cell.level = level;
        return cell;
    };

    S2.S2Cell.prototype.getCornerLatLngs = function () {
        const offsets = [[0,0],[0,1],[1,1],[1,0]];
        return offsets.map((o) => {
            const st = IJToST(this.ij, this.level, o);
            const uv = STToUV(st);
            const xyz = FaceUVToXYZ(this.face, uv);
            return XYZToLatLng(xyz);
        });
    };

    S2.S2Cell.prototype.getSurrounding = function () {
        const fromFaceIJWrap = (face, ij, level) => {
            const maxSize = 1 << level;
            if (ij[0] >= 0 && ij[1] >= 0 && ij[0] < maxSize && ij[1] < maxSize) {
                return S2.S2Cell.FromFaceIJ(face, ij, level);
            }
            let st = IJToST(ij, level, [0.5, 0.5]);
            let uv = STToUV(st);
            const xyz = FaceUVToXYZ(face, uv);
            const faceuv = XYZToFaceUV(xyz);
            face = faceuv[0];
            uv = faceuv[1];
            st = UVToST(uv);
            ij = STToIJ(st, level);
            return S2.S2Cell.FromFaceIJ(face, ij, level);
        };

        const face = this.face;
        const i = this.ij[0];
        const j = this.ij[1];
        const level = this.level;

        const deltas = [
            { a: -1, b: 0 }, { a: 0, b: -1 }, { a: 1, b: 0 }, { a: 0, b: 1 },
            { a: -1, b: -1 }, { a: 1, b: 1 }, { a: -1, b: 1 }, { a: 1, b: -1 }
        ];

        return deltas.map(d => fromFaceIJWrap(face, [i + d.a, j + d.b], level));
    };

    // -------------------------
    // Boot
    // -------------------------
    installRouteWatcher();
})();
