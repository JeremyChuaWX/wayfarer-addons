// ==UserScript==
// @name         Wayfarer Map Mods - Open In Prime
// @version      0.1.1
// @description  Base plug-in for Wayfarer Maps
// @namespace    https://gitlab.com/Tntnnbltn/wayfarer-addons
// @downloadURL  https://gitlab.com/Tntnnbltn/wayfarer-addons/-/raw/main/wayfarer-map-mods-open-in-prime.user.js
// @homepageURL  https://gitlab.com/Tntnnbltn/wayfarer-addons
// @match        https://wayfarer.nianticlabs.com/*
// @run-at       document-start
// @grant        none
// @require      https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js
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
    "use strict";

    const POI_BRIDGE_ID = "wfmapmods-poi-bridge";
    const LINK_CONTAINER_SELECTOR = ".wfmapmods-poi-function-links";
    const OPEN_PRIME_LINK_ID = "wfmapmods-open-prime-link";
    const MAP_PATH = "/new/submit/new";
    const ALLOWED_PRIME_STATUSES = new Set(["LIVE", "ACCEPTED"]);

    let currentGuid = null;
    let lastPayload = null;
    let openInPrimeLink = null;
    let bridgeObserverAttached = false;
    let poiHookAttached = false;
    let mapPanelPollId = null;

    // -------------
    // Bootstrap & DOM wiring
    // -------------

    function bootstrap() {
        setupMapRouteWatcher();
    }

    function isOnMapPage() {
        return window.location.pathname.startsWith(MAP_PATH);
    }

    function onMapRouteChange() {
        if (isOnMapPage()) {
            startMapPanelWatcher();
        } else {
            stopMapPanelWatcher();
        }
    }

    function setupMapRouteWatcher() {
        const origPushState = history.pushState;
        const origReplaceState = history.replaceState;

        function wrappedRouteChange() {
            onMapRouteChange();
        }

        history.pushState = function (...args) {
            const ret = origPushState.apply(this, args);
            wrappedRouteChange();
            return ret;
        };

        history.replaceState = function (...args) {
            const ret = origReplaceState.apply(this, args);
            wrappedRouteChange();
            return ret;
        };

        window.addEventListener("popstate", wrappedRouteChange);

        // Initial load
        wrappedRouteChange();
    }

    function startMapPanelWatcher() {
        // Don’t double-start
        if (mapPanelPollId) return;

        mapPanelPollId = setInterval(() => {
            const containerReady = ensurePoiFunctionsLinkContainer();
            const bridgeReady = !!document.getElementById(POI_BRIDGE_ID);

            if (containerReady && bridgeReady) {
                stopMapPanelWatcher();
                setupBridgeObserver();
                setupPoiDataHook();
            }
        }, 500);
    }

    function stopMapPanelWatcher() {
        if (mapPanelPollId) {
            clearInterval(mapPanelPollId);
            mapPanelPollId = null;
        }
    }

    // Ensure the link container exists and add our "Open in Prime" link if needed
    function ensurePoiFunctionsLinkContainer() {
        const container = document.querySelector(LINK_CONTAINER_SELECTOR);
        if (!container) return false;

        if (!openInPrimeLink) {
            const link = document.createElement("a");
            link.id = OPEN_PRIME_LINK_ID;
            link.href = "#";
            link.textContent = "Open in Prime";
            // hidden until we have a guid
            link.style.display = "none";

            link.addEventListener("click", (ev) => {
                ev.preventDefault();
                if (!currentGuid) return;
                openPrimeQrModal(currentGuid);
            });

            container.appendChild(link);
            openInPrimeLink = link;
        }

        updateLinkVisibility();
        return true;
    }

    // -------------
    // POI bridge handling
    // -------------

    function setupBridgeObserver() {
        if (bridgeObserverAttached) return;

        const bridge = document.getElementById(POI_BRIDGE_ID);
        if (!bridge) return;

        bridgeObserverAttached = true;

        const updateFromPayload = () => {
            const raw = bridge.getAttribute("data-payload");
            if (!raw) {
                lastPayload = null;
                resolveGuidFromState();
                return;
            }

            let payload;
            try {
                payload = JSON.parse(raw);
            } catch {
                lastPayload = null;
                resolveGuidFromState();
                return;
            }

            lastPayload = payload || null;
            resolveGuidFromState();
        };

        // Initial read
        updateFromPayload();

        const observer = new MutationObserver((mutations) => {
            for (const m of mutations) {
                if (m.type === "attributes" && m.attributeName === "data-payload") {
                    updateFromPayload();
                }
            }
        });

        observer.observe(bridge, {
            attributes: true,
            attributeFilter: ["data-payload"],
        });
    }

    // -------------
    // POI data hook (onPoisFetched + window.currentPois)
    // -------------

    function setupPoiDataHook() {
        if (poiHookAttached) return;
        poiHookAttached = true;

        const prevOnPoisFetched = window.onPoisFetched;

        window.onPoisFetched = function(...args) {
            // Let existing handler run first, so window.currentPois is up to date
            if (typeof prevOnPoisFetched === "function") {
                try {
                    prevOnPoisFetched.apply(this, args);
                } catch (e) {
                    console.warn("[WF Open In Prime] Error in previous onPoisFetched:", e);
                }
            }

            // Then re-resolve guid based on the latest currentPois + lastPayload
            try {
                resolveGuidFromState();
            } catch (e) {
                console.warn("[WF Open In Prime] Error resolving guid from POIs:", e);
            }
        };
    }

    // -------------
    // guid resolution logic
    // -------------

    function resolveGuidFromState() {
        const payload = lastPayload;

        // No selection → hide link
        if (!payload) return setGuid(null);

        const status = (payload.status || "").toString().trim().toUpperCase();
        const allow = ALLOWED_PRIME_STATUSES.has(status) || payload.source === "wfmm-s2";

        if (!allow) return setGuid(null);

        // 1) Prefer guid directly from POI bridge
        if (typeof payload.guid === "string" && payload.guid.trim()) {
            return setGuid(payload.guid.trim());
        }

        // 2) Fallback: coordinate match against currentPois
        const { lat, lng } = payload;
        if (lat == null || lng == null) return setGuid(null);

        const pois = Array.isArray(window.currentPois) ? window.currentPois : [];
        const match = pois.find(p => p?.guid && p.lat === lat && p.lng === lng);

        return setGuid(match ? match.guid.trim() : null);
    }

    function setGuid(guid) {
        currentGuid = guid;
        updateLinkVisibility();
    }

    function updateLinkVisibility() {
        if (!openInPrimeLink) return;
        openInPrimeLink.style.display = currentGuid ? "" : "none";
    }

    // -------------
    // QR modal with buttons
    // -------------

    function openPrimeQrModal(guid) {
        const url = `https://link.ingress.com/portal/${guid}`;

        // Overlay
        const overlay = document.createElement("div");
        Object.assign(overlay.style, {
            position: "fixed",
            inset: "0",
            background: "rgba(0,0,0,0.55)",
            zIndex: "20000",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "12px",
        });

        // Dialog (slim)
        const dialog = document.createElement("div");
        Object.assign(dialog.style, {
            background: "#ffffff",
            borderRadius: "8px",
            padding: "16px",
            width: "100%",
            maxWidth: "270px",
            boxSizing: "border-box",
            boxShadow: "0 12px 30px rgba(0,0,0,0.35)",
            fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
            color: "#111827",
            position: "relative",
        });

        // Title
        const titleEl = document.createElement("h2");
        titleEl.textContent = "Open in Ingress Prime";
        Object.assign(titleEl.style, {
            margin: "0 0 8px 0",
            fontSize: "15px",
            fontWeight: "600",
            textAlign: "center",
        });

        // Note
        const noteEl = document.createElement("p");
        noteEl.textContent =
            "Note: Deep link to Ingress Prime will not work if the Wayspot is not a portal.";
        Object.assign(noteEl.style, {
            margin: "0 0 8px 0",
            fontSize: "11px",
            lineHeight: "1.35",
            color: "#4b5563",
            textAlign: "center",
        });

        // QR container
        const qrContainer = document.createElement("div");
        Object.assign(qrContainer.style, {
            width: "200px",
            height: "200px",
            margin: "0 auto 14px auto",
        });

        // Buttons row (vertical for clarity)
        const buttonsRow = document.createElement("div");
        Object.assign(buttonsRow.style, {
            display: "flex",
            flexDirection: "column",
            gap: "8px",
            marginTop: "6px",
        });

        function makeButton(text, background, color) {
            const btn = document.createElement("button");
            btn.textContent = text;
            Object.assign(btn.style, {
                padding: "8px 12px",
                borderRadius: "6px",
                border: "none",
                background,
                color,
                fontSize: "13px",
                cursor: "pointer",
                width: "100%",
                fontWeight: "600",
            });
            return btn;
        }

        const openBtn = makeButton("Open Link", "#2563eb", "#ffffff");
        const copyBtn = makeButton("Copy Link", "#4b5563", "#ffffff");
        const closeBtn = makeButton("Close", "#e5e7eb", "#111827");

        // Button behavior
        openBtn.addEventListener("click", () => {
            window.open(url, "_blank");
        });

        copyBtn.addEventListener("click", () => {
            navigator.clipboard?.writeText(url);
            const original = copyBtn.textContent;
            copyBtn.textContent = "Copied!";
            setTimeout(() => (copyBtn.textContent = original), 1200);
        });

        const closeOverlay = () => overlay.remove();
        closeBtn.addEventListener("click", closeOverlay);

        overlay.addEventListener("click", (ev) => {
            if (ev.target === overlay) closeOverlay();
        });

        // Assemble modal
        buttonsRow.appendChild(openBtn);
        buttonsRow.appendChild(copyBtn);
        buttonsRow.appendChild(closeBtn);

        dialog.appendChild(titleEl);
        dialog.appendChild(noteEl);
        dialog.appendChild(qrContainer);
        dialog.appendChild(buttonsRow);

        overlay.appendChild(dialog);
        document.body.appendChild(overlay);

        // Create QR code
        try {
            // QRCode comes from qrcodejs (@require)
            new QRCode(qrContainer, {
                text: url,
                width: 200,
                height: 200,
            });
        } catch (err) {
            console.warn("[WF Open In Prime] QR code generation failed:", err);
        }
    }

    // Start after DOM ready
    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", bootstrap);
    } else {
        bootstrap();
    }
})();
