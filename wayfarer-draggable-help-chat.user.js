// ==UserScript==
// @name         Wayfarer Draggable Help Chat
// @version      1.0.0
// @description  Base plug-in for Wayfarer Maps
// @namespace    https://gitlab.com/Tntnnbltn/wayfarer-addons
// @downloadURL  https://gitlab.com/Tntnnbltn/wayfarer-addons/-/raw/main/wayfarer-draggable-help-chat.user.js
// @updateURL    https://gitlab.com/Tntnnbltn/wayfarer-addons/-/raw/main/wayfarer-draggable-help-chat.user.js
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
// directory of this script's GitLab repository:
// <https://gitlab.com/Tntnnbltn/wayfarer-addons/-/blob/main/LICENSE>
// If not, see <https://www.gnu.org/licenses/>.


(function () {
    "use strict";

    const STORE_KEY = "wfmm_hs_drag_v3";
    const IFRAME_ID = "hs-web-sdk-iframe";

    const DRAG_BAR_HEIGHT = 64;
    const DRAG_BAR_EXCLUDE_RIGHT_PX = 72; // leave X clickable

    const DEFAULT_W = 380;
    const DEFAULT_H = 560;
    const DEFAULT_OFFSET = { right: 16, bottom: 16 };

    let pageObserver = null;

    function clamp(n, min, max) {
        return Math.max(min, Math.min(max, n));
    }

    function safeParse(json, fallback) {
        try { return JSON.parse(json); } catch { return fallback; }
    }

    function loadState() {
        return safeParse(localStorage.getItem(STORE_KEY), null);
    }

    function saveState(state) {
        localStorage.setItem(STORE_KEY, JSON.stringify(state));
    }

    function isHelpRoute() {
        return location.pathname === "/new/help";
    }

    function startPageObserverIfNeeded() {
        if (pageObserver) return; // already running
        pageObserver = new MutationObserver(() => {
            const iframe = findHelpshiftIframe();
            if (iframe) makeIframeDraggable(iframe);
        });

        pageObserver.observe(document.documentElement, { childList: true, subtree: true });

        // In case it already exists right now on the help route
        const iframeNow = findHelpshiftIframe();
        if (iframeNow) makeIframeDraggable(iframeNow);
    }

    function stopPageObserverIfRunning() {
        if (!pageObserver) return;
        pageObserver.disconnect();
        pageObserver = null;
    }

    function onRouteMaybeChanged() {
        if (isHelpRoute()) {
            startPageObserverIfNeeded();
        } else {
            stopPageObserverIfRunning();
        }
    }

    function installRouteWatcher() {
        const origPushState = history.pushState;
        const origReplaceState = history.replaceState;

        function fire() {
            // Defer so location updates settle
            setTimeout(onRouteMaybeChanged, 0);
        }

        history.pushState = function (...args) {
            const ret = origPushState.apply(this, args);
            fire();
            return ret;
        };

        history.replaceState = function (...args) {
            const ret = origReplaceState.apply(this, args);
            fire();
            return ret;
        };

        window.addEventListener("popstate", fire, true);

        // Initial check
        onRouteMaybeChanged();
    }

    function injectCss() {
        if (document.getElementById("wfmm-hs-drag-css")) return;

        const css = `
#wfmm-hs-wrap {
  position: fixed !important;
  z-index: 2147483646 !important;
  box-sizing: border-box !important;
  border-radius: 12px !important;
  overflow: hidden !important;
  box-shadow: rgba(0,0,0,0.25) 0 8px 40px !important;
  background: transparent !important;
}

/* IMPORTANT: DO NOT force iframe display.
   Helpshift controls visibility by toggling iframe display:none/block. */
#wfmm-hs-wrap > iframe {
  width: 100% !important;
  height: 100% !important;
  border: 0 !important;
}

/* Drag overlay: leave right side clickable for the X */
#wfmm-hs-dragbar {
  position: absolute !important;
  top: 0 !important;
  left: 0 !important;
  right: ${DRAG_BAR_EXCLUDE_RIGHT_PX}px !important;
  height: ${DRAG_BAR_HEIGHT}px !important;
  cursor: grab !important;
  z-index: 2147483647 !important;
  background: rgba(0,0,0,0) !important;
}

#wfmm-hs-wrap:hover #wfmm-hs-dragbar {
  background: rgba(0,0,0,0.02) !important;
}

#wfmm-hs-dragbar.wfmm-dragging {
  cursor: grabbing !important;
}
    `.trim();

        const style = document.createElement("style");
        style.id = "wfmm-hs-drag-css";
        style.textContent = css;
        document.head.appendChild(style);
    }

    function isIframeIntendedVisible(iframe) {
        return iframe.style.display !== "none";
    }
    function setWrapVisible(wrap, visible) {
        wrap.style.display = visible ? "block" : "none";
    }

    function applyPosition(wrap, left, top) {
        wrap.style.inset = "auto";
        wrap.style.left = `${left}px`;
        wrap.style.top = `${top}px`;
        wrap.style.right = "auto";
        wrap.style.bottom = "auto";
    }

    function findHelpshiftIframe() {
        const el = document.getElementById(IFRAME_ID);
        return (el && el.tagName === "IFRAME") ? el : null;
    }

    function makeIframeDraggable(iframe) {
        if (!iframe || iframe.__wfmmWrapped) return;
        iframe.__wfmmWrapped = true;

        injectCss();

        const wrap = document.createElement("div");
        wrap.id = "wfmm-hs-wrap";

        const dragbar = document.createElement("div");
        dragbar.id = "wfmm-hs-dragbar";
        dragbar.title = "Drag chat";

        // Insert wrapper and move iframe inside
        const parent = iframe.parentNode;
        parent.insertBefore(wrap, iframe);
        wrap.appendChild(iframe);
        wrap.appendChild(dragbar);

        // Fixed size
        wrap.style.width = `${DEFAULT_W}px`;
        wrap.style.height = `${DEFAULT_H}px`;

        function syncVisibility() {
            if (iframe.style.position !== "static") {
                iframe.style.position = "static";
            }
            setWrapVisible(wrap, isIframeIntendedVisible(iframe));
        }

        // Restore saved position or default
        const saved = loadState();
        if (saved && typeof saved.left === "number" && typeof saved.top === "number") {
            applyPosition(wrap, saved.left, saved.top);
        } else {
            const left = clamp(window.innerWidth - DEFAULT_W - DEFAULT_OFFSET.right, 0, window.innerWidth - DEFAULT_W);
            const top = clamp(window.innerHeight - DEFAULT_H - DEFAULT_OFFSET.bottom, 0, window.innerHeight - DEFAULT_H);
            applyPosition(wrap, left, top);
            saveState({ left, top });
        }

        // Initial visibility
        syncVisibility();

        // Drag logic
        let dragging = false;
        let startX = 0, startY = 0;
        let startLeft = 0, startTop = 0;

        function onDragStart(ev) {
            if (wrap.style.display === "none") return;

            dragging = true;
            dragbar.classList.add("wfmm-dragging");
            wrap.setPointerCapture?.(ev.pointerId);

            const rect = wrap.getBoundingClientRect();
            startX = ev.clientX;
            startY = ev.clientY;
            startLeft = rect.left;
            startTop = rect.top;

            ev.preventDefault();
            ev.stopPropagation();
        }

        function onDragMove(ev) {
            if (!dragging) return;

            const dx = ev.clientX - startX;
            const dy = ev.clientY - startY;

            const newLeft = clamp(startLeft + dx, 0, window.innerWidth - wrap.offsetWidth);
            const newTop = clamp(startTop + dy, 0, window.innerHeight - wrap.offsetHeight);

            applyPosition(wrap, newLeft, newTop);
            ev.preventDefault();
        }

        function onDragEnd(ev) {
            if (!dragging) return;

            dragging = false;
            dragbar.classList.remove("wfmm-dragging");
            try { wrap.releasePointerCapture?.(ev.pointerId); } catch {}

            const rect = wrap.getBoundingClientRect();
            saveState({ left: rect.left, top: rect.top });
            ev.preventDefault();
        }

        dragbar.addEventListener("pointerdown", onDragStart);
        window.addEventListener("pointermove", onDragMove, { passive: false });
        window.addEventListener("pointerup", onDragEnd, { passive: false });
        window.addEventListener("pointercancel", onDragEnd, { passive: false });

        window.addEventListener("resize", () => {
            const rect = wrap.getBoundingClientRect();
            const left = clamp(rect.left, 0, window.innerWidth - rect.width);
            const top = clamp(rect.top, 0, window.innerHeight - rect.height);
            applyPosition(wrap, left, top);
            saveState({ left, top });
        });

        // Observe iframe style/class changes (display none/block toggles usually appear here)
        const mo = new MutationObserver(syncVisibility);
        mo.observe(iframe, { attributes: true, attributeFilter: ["style"] });
    }

    function boot() {
        installRouteWatcher();
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", boot, { once: true });
    } else {
        boot();
    }
})();
