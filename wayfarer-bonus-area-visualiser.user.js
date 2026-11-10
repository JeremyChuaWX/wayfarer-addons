// ==UserScript==
// @name         Wayfarer Bonus Area Visualiser
// @version      1.3.0
// @author       Tntnnbltn (fork maintained by JeremyChuaWX)
// @description  Shows L7 cells covered by Home and Bonus areas
// @namespace    https://github.com/JeremyChuaWX/wayfarer-addons
// @downloadURL  https://jeremychuawx.github.io/wayfarer-addons/wayfarer-bonus-area-visualiser.user.js
// @updateURL    https://jeremychuawx.github.io/wayfarer-addons/wayfarer-bonus-area-visualiser.user.js
// @homepageURL  https://jeremychuawx.github.io/wayfarer-addons/guides/wayfarer-bonus-area-visualiser.html
// @supportURL   https://github.com/JeremyChuaWX/wayfarer-addons/issues
// @match        https://wayfarer.scopely.com/*
// @run-at       document-start
// @grant        none
// @inject-into  page
// ==/UserScript==

// Copyright 2026 tntnnbltn
// Modified by JeremyChuaWX, 2026-11 — see https://github.com/JeremyChuaWX/wayfarer-addons/commits/main

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

    // Wayfarer's Settings window (avatar menu → Settings → Location) shows a
    // small map for the Hometown location and one for the Bonus location, each
    // with a pin. This draws the S2 cells around each pin.
    //
    // Runs in the page itself (see @inject-into) so it can see the Google Maps
    // objects the website creates. The website builds each pin with
    // `new google.maps.Marker({ map, position })`, which goes through
    // Marker.prototype.setMap / setPosition, so patching those two is enough to
    // notice pins appearing, moving and disappearing. Nothing is polled once
    // Google Maps has loaded, and nothing watches the page for changes.
    // Squares are only drawn on maps inside the Settings window.

    // Every Settings window (desktop dialog or full-screen on phones) is labelled by this id.
    const SETTINGS_DIALOG = '[aria-labelledby="wayfarer-settings-menu-title"]';

    // map -> { marker, polys } for each settings map we've drawn on
    const drawn = new Map();

    // Maps we've already zoomed out once (only done when a map first shows a pin).
    const fitted = new WeakSet();

    function isSettingsMap(map) {
        try {
            const div = map?.getDiv?.();
            return !!div?.closest?.(SETTINGS_DIALOG);
        } catch {
            return false;
        }
    }

    function toLatLng(pos) {
        if (!pos) return null;
        const lat = typeof pos.lat === "function" ? pos.lat() : pos.lat;
        const lng = typeof pos.lng === "function" ? pos.lng() : pos.lng;
        if (typeof lat !== "number" || typeof lng !== "number" || !isFinite(lat) || !isFinite(lng)) return null;
        return { lat, lng };
    }

    function clearMap(map) {
        const entry = drawn.get(map);
        if (!entry) return;
        for (const p of entry.polys) {
            try { p.setMap(null); } catch {}
        }
        drawn.delete(map);
    }

    // Forget maps that the website has thrown away (Settings window closed).
    function forgetClosedMaps() {
        for (const map of [...drawn.keys()]) {
            let attached = false;
            try { attached = !!map.getDiv()?.isConnected; } catch {}
            if (!attached) clearMap(map);
        }
    }

    function drawCells(map, marker, latLng) {
        if (typeof google.maps.Polygon !== "function") return;
        const prev = drawn.get(map);
        if (prev && prev.marker === marker && prev.key === `${latLng.lat},${latLng.lng}`) return;
        clearMap(map);
        forgetClosedMaps();

        // At approximately 60 degrees North, cell size increases
        // Use Level 6 instead of Level 7 cells in this case
        const level = latLng.lat > 60 ? 6 : 7;

        const center = S2.S2Cell.FromLatLng(latLng, level);
        const cells = [center, ...center.getSurrounding()];
        const polys = [];
        const allCorners = [];

        for (const cell of cells) {
            const corners = cell.getCornerLatLngs().map(c => ({ lat: c.lat, lng: c.lng }));
            allCorners.push(...corners);
            polys.push(new google.maps.Polygon({
                map,
                paths: corners,
                strokeColor: "#000000",
                strokeOpacity: 1,
                strokeWeight: 2,
                fillColor: "#90EE90",
                fillOpacity: 0.25,
                clickable: false,
                zIndex: 1
            }));
        }

        drawn.set(map, { marker, polys, key: `${latLng.lat},${latLng.lng}` });

        if (!fitted.has(map)) {
            fitted.add(map);
            zoomOutToShow(map, latLng, allCorners);
        }
    }

    // The website opens these maps zoomed in too far to see the squares'
    // edges. The first time a map shows a pin, zoom out just enough to show all
    // nine squares, keeping the pin in the middle. Later pin moves (the user
    // picking a new spot) leave the zoom alone.
    function zoomOutToShow(map, pin, corners) {
        const bounds = new google.maps.LatLngBounds();
        for (const c of corners) {
            bounds.extend(c);
            // Mirror each corner around the pin so the pin stays centred.
            bounds.extend({ lat: 2 * pin.lat - c.lat, lng: 2 * pin.lng - c.lng });
        }
        const current = map.getBounds();
        if (!current) {
            // Map not drawn yet: zooming now gets undone, so wait until it has.
            google.maps.event.addListenerOnce(map, "idle", () => {
                if (drawn.has(map)) zoomOutToShow(map, pin, corners);
            });
            return;
        }
        if (current.contains(bounds.getNorthEast()) && current.contains(bounds.getSouthWest())) return;
        map.fitBounds(bounds, 8);
    }

    // Called after a pin's map or position changes.
    function onMarkerChanged(marker) {
        let map = null, latLng = null;
        try {
            map = marker.getMap();
            latLng = toLatLng(marker.getPosition());
        } catch {
            return;
        }

        // Pin removed: remove the squares it owned.
        if (!map || !latLng) {
            for (const [m, entry] of drawn) {
                if (entry.marker === marker) clearMap(m);
            }
            return;
        }

        if (!isSettingsMap(map)) return;

        // "Use my current location" adds a blue dot (a drawn symbol, not a pin
        // picture). Only the location pin counts.
        let icon = null;
        try { icon = marker.getIcon(); } catch {}
        if (icon && typeof icon === "object" && icon.path != null) return;

        drawCells(map, marker, latLng);
    }

    function patchMarker(Marker) {
        const proto = Marker?.prototype;
        if (!proto || proto.__wfBonusAreaPatched) return;
        proto.__wfBonusAreaPatched = true;

        for (const method of ["setMap", "setPosition"]) {
            const original = proto[method];
            if (typeof original !== "function") continue;
            proto[method] = function (...args) {
                const ret = original.apply(this, args);
                queueCheck(this);
                return ret;
            };
        }
    }

    // A new pin gets its map, position and icon one after another, in any
    // order. Look at it once they're all set, just after the current code.
    const pending = new Set();
    function queueCheck(marker) {
        if (!pending.size) queueMicrotask(flushChecks);
        pending.add(marker);
    }
    function flushChecks() {
        const markers = [...pending];
        pending.clear();
        for (const marker of markers) {
            try {
                onMarkerChanged(marker);
            } catch (e) {
                console.error("[Bonus Area Visualiser]", e);
            }
        }
    }

    // Wayfarer only loads Google Maps when a map is first shown (e.g. when the
    // Settings window opens), and places the pins straight away. To be in time,
    // catch the moment google → google.maps → google.maps.Marker is assigned.
    // The page still gets and sets the same values as before.
    const trapped = new WeakMap(); // object -> Set of trapped keys
    function whenAssigned(obj, key, fn) {
        if (!obj || (typeof obj !== "object" && typeof obj !== "function")) return;
        const keys = trapped.get(obj) ?? new Set();
        if (keys.has(key)) return;
        const desc = Object.getOwnPropertyDescriptor(obj, key);
        if (desc && !desc.configurable) {
            if (obj[key]) fn(obj[key]);
            return;
        }
        keys.add(key);
        trapped.set(obj, keys);

        let value = desc && "value" in desc ? desc.value : undefined;
        const get = desc?.get ? function () { return desc.get.call(this); } : () => value;
        const set = desc?.set ? function (v) { desc.set.call(this, v); } : (v) => { value = v; };
        Object.defineProperty(obj, key, {
            configurable: true,
            enumerable: desc ? desc.enumerable : true,
            get,
            set(v) {
                set.call(this, v);
                try { fn(get.call(this)); } catch (e) { console.error("[Bonus Area Visualiser]", e); }
            },
        });
        const current = get.call(obj);
        if (current) fn(current);
    }

    function hookGoogleMaps() {
        whenAssigned(window, "google", (google) =>
            whenAssigned(google, "maps", (maps) =>
                whenAssigned(maps, "Marker", patchMarker)));

        // Backup in case Google Maps is ever loaded in a way the hook above
        // misses: check a few times a second until it's there, then stop.
        const tick = () => {
            const Marker = window.google?.maps?.Marker;
            if (typeof Marker === "function") {
                patchMarker(Marker);
                return;
            }
            setTimeout(tick, 250);
        };
        tick();
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
    hookGoogleMaps();
})();
