// ==UserScript==
// @name         Wayfarer Map Mods - Bookmarks
// @version      0.2.0
// @description  Bookmark locations and Wayspots on the Wayfarer Map
// @namespace    https://gitlab.com/Tntnnbltn/wayfarer-addons
// @downloadURL  https://gitlab.com/Tntnnbltn/wayfarer-addons/-/raw/main/wayfarer-map-mods-bookmarks.user.js
// @updateURL    https://gitlab.com/Tntnnbltn/wayfarer-addons/-/raw/main/wayfarer-map-mods-bookmarks.user.js
// @homepageURL  https://gitlab.com/Tntnnbltn/wayfarer-addons
// @match        https://wayfarer.nianticlabs.com/*
// @run-at       document-start
// @grant        none
// ==/UserScript==

// Copyright 2026 tntnnbltn
// Inspired by IITC Bookmarks plug-in by ZasoGD

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

/* eslint-disable no-multi-spaces */

(function () {
    "use strict";

    const STORAGE_KEY = "wfmap_bookmarks_storage_v1";
    const POI_BRIDGE_ID = "wfmapmods-poi-bridge";

    const SUBMIT_ROUTE = "/new/submit/new";
    const MAPVIEW_ROUTE = "/new/mapview";
    const DEFAULT_OTHER_FOLDER_ID = "idOthers";

    const BOOKMARK_SPRITE =
          "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAC8AAABPCAMAAABMDWzEAAAANlBMVEX/////zgD/zgD///////8Aru7/zgAAru4TtPAAAADA7PtAwvLk9/6b3/n///8Aru510/b/zgDZKp6YAAAACnRSTlOAxo5FtDw9mPoA9GJiegAAAklJREFUeF6dle26ozAIhFO1NkK+vP+b3WbBJRwM7dn5lad9BweoaThI63Z42hfmLn4rLv84d8WvpWxe+fNcFL+VUtzy57kLv67lrbDOqu/nW8tfQ1i3MmjbfrKPc9BjCYfiy2qjjNoDZRfcaBnxnl8Mm8KN4bFzv6q6lVT/P369+DBZFmsZ+LAmWbHllz7XB/OBwDDhF1rVIvwFhHt+vw4dqbViKdC0wHySSsE3e/FxpHPpAo+vUehUSCk7PBuYTpCUw/JsAIoipzlfUTHimPGNMujQ7LA86sSqm2x4BFXbOjTPSWJFxtgpbRTFd+VITdPGQG3b8hArCbm7n9vVefqZxT8I0G2Y+Yi4XFNy+Jqpn695WlP6ksdWSJB9PmJrkMqolADyjIdyrzSrD1Pc8lND8vrNFvfnkw3u8NYAn+ev+M/7iorPH3n8Jd9+mT+b8fg8EBZb+o4n+n0gx4yPMp5MZ3LkW77XJAaZZkdmPtv7JGG9EfLLrnkS3DjiRWseej6OrnXd0ub/hQbftIPHCnfzjDz6sXjy3seKoBqXG97yqiCgmFv198uNYy7XptHlr8aHcbk8NW5veMtrg+A1Ojy3oCeLDs9zgfEHEi2vu03INu4Y/fk3OVOo6N2f8u5IqDs+NvMaYOJQaHj5rut1vGIda/zk5dmdfh7H8XypUJpP0luNne56xnEdildRRPyIfMMDSnGWhEJQvEQZittQwoONYkP946OOMnsERuZNFKMXOYiXkXsO4U0UL1QwffqPCH4Us4xgovih/gBs1LqNE0afwAAAAABJRU5ErkJggg==";

    let wfMap = null;
    let mapPanelObserver = null;
    let mapPanelMutationScheduled = false;
    let currentPoi = null;

    let windowDrag = null;
    let sortDrag = null;
    let suppressClickUntil = 0;

    const state = {
        data: null,
        booted: false
    };

    function defaultData() {
        return {
            maps: [
                {
                    id: DEFAULT_OTHER_FOLDER_ID,
                    type: "folder",
                    label: "Others",
                    open: true,
                    children: []
                }
            ],
            wayspots: [
                {
                    id: DEFAULT_OTHER_FOLDER_ID,
                    type: "folder",
                    label: "Others",
                    open: true,
                    children: []
                }
            ],
            ui: {
                visible: false,
                activeTab: "maps",
                deleteMode: false,
                left: 390,
                top: 120,
                width: 250
            }
        };
    }

    function loadData() {
        const raw = localStorage.getItem(STORAGE_KEY);
        state.data = raw ? JSON.parse(raw) : defaultData();
    }

    function normaliseRootOrder(list) {
        const other = list.find(n => n.id === DEFAULT_OTHER_FOLDER_ID);
        const folders = list.filter(n => n.type === "folder" && n.id !== DEFAULT_OTHER_FOLDER_ID);

        list.length = 0;
        list.push(...folders, other);
    }

    function saveData() {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(state.data));
        } catch (e) {
            console.warn("[WF Bookmarks] Failed to save storage.", e);
        }
    }

    function exportBookmarks() {
        try {
            const json = JSON.stringify(state.data, null, 2);
            const blob = new Blob([json], {
                type: "application/json"
            });

            const url = URL.createObjectURL(blob);
            const link = document.createElement("a");
            const date = new Date().toISOString().slice(0, 10);

            link.href = url;
            link.download = `wayfarer-bookmarks-${date}.json`;
            link.style.display = "none";

            document.body.appendChild(link);
            link.click();
            link.remove();

            setTimeout(() => {
                URL.revokeObjectURL(url);
            }, 0);
        } catch (e) {
            console.warn("[WF Bookmarks] Failed to export bookmarks.", e);
            alert("Bookmarks could not be exported.");
        }
    }

    async function importBookmarksFile(file) {
        if (!file) return;

        try {
            const raw = await file.text();
            const imported = JSON.parse(raw);

            if (!isValidBookmarkData(imported)) {
                throw new Error(
                    "The selected file is not a valid Wayfarer Bookmarks export."
                );
            }

            const shouldReplace = confirm(
                "Importing this file will replace all current bookmarks " +
                "and bookmark folders. Continue?"
            );

            if (!shouldReplace) return;

            state.data = imported;

            normaliseImportedData();
            saveData();

            const box = document.getElementById("wf-bookmarks-box");

            if (box) {
                box.style.left = `${state.data.ui.left}px`;
                box.style.top = `${state.data.ui.top}px`;
                box.style.width = `${state.data.ui.width}px`;
            }

            renderBookmarks();
            updateBoxVisibility();

            alert("Bookmarks imported successfully.");
        } catch (e) {
            console.warn("[WF Bookmarks] Failed to import bookmarks.", e);

            alert(
                e instanceof Error
                ? e.message
                : "Bookmarks could not be imported."
            );
        }
    }

    function isValidBookmarkData(data) {
        if (
            !data ||
            typeof data !== "object" ||
            Array.isArray(data)
        ) {
            return false;
        }

        if (
            !Array.isArray(data.maps) ||
            !Array.isArray(data.wayspots)
        ) {
            return false;
        }

        if (
            !data.ui ||
            typeof data.ui !== "object" ||
            Array.isArray(data.ui)
        ) {
            return false;
        }

        return (
            isValidBookmarkRoot(data.maps, "maps") &&
            isValidBookmarkRoot(data.wayspots, "wayspots")
        );
    }

    function isValidBookmarkRoot(nodes, tab) {
        if (!Array.isArray(nodes)) return false;

        const others = nodes.filter(node => {
            return (
                node &&
                node.id === DEFAULT_OTHER_FOLDER_ID &&
                node.type === "folder" &&
                Array.isArray(node.children)
            );
        });

        if (others.length !== 1) return false;

        return nodes.every(node => {
            return isValidBookmarkNode(node, tab, true);
        });
    }

    function isValidBookmarkNode(node, tab, isRoot) {
        if (
            !node ||
            typeof node !== "object" ||
            Array.isArray(node)
        ) {
            return false;
        }

        if (
            typeof node.id !== "string" ||
            typeof node.type !== "string"
        ) {
            return false;
        }

        if (node.type === "folder") {
            if (!Array.isArray(node.children)) return false;

            // Custom folders are supported only at the root level.
            if (
                !isRoot &&
                node.id !== DEFAULT_OTHER_FOLDER_ID
            ) {
                return false;
            }

            return node.children.every(child => {
                return isValidBookmarkNode(child, tab, false);
            });
        }

        // Individual bookmarks must be inside a folder or "Others".
        if (isRoot) return false;

        if (tab === "maps" && node.type === "map") {
            return (
                Number.isFinite(Number(node.lat)) &&
                Number.isFinite(Number(node.lng)) &&
                Number.isFinite(Number(node.zoom))
            );
        }

        if (
            tab === "wayspots" &&
            node.type === "wayspot"
        ) {
            return (
                typeof node.poiId === "string" &&
                Number.isFinite(Number(node.lat)) &&
                Number.isFinite(Number(node.lng))
            );
        }

        return false;
    }

    function normaliseImportedData() {
        const defaults = defaultData();
        const importedUi = state.data.ui || {};

        state.data.ui = {
            ...defaults.ui,
            ...importedUi,

            visible: !!importedUi.visible,
            deleteMode: !!importedUi.deleteMode,

            activeTab:
            importedUi.activeTab === "wayspots"
            ? "wayspots"
            : "maps",

            left: Number.isFinite(Number(importedUi.left))
            ? Number(importedUi.left)
            : defaults.ui.left,

            top: Number.isFinite(Number(importedUi.top))
            ? Number(importedUi.top)
            : defaults.ui.top,

            width: Number.isFinite(Number(importedUi.width))
            ? Math.max(180, Number(importedUi.width))
            : defaults.ui.width
        };

        normaliseRootOrder(state.data.maps);
        normaliseRootOrder(state.data.wayspots);
    }

    function generateId(prefix) {
        return `${prefix}${Date.now()}${Math.floor(Math.random() * 100000)}`;
    }

    function isOnMapCapableRoute() {
        // Programmed to not occur on the submit route as the UI is too cramped
        // const p = window.location.pathname;
        // return p.startsWith(SUBMIT_ROUTE) || p.startsWith(MAPVIEW_ROUTE);
        return location.pathname.startsWith(MAPVIEW_ROUTE);
    }

    function setupMapRouteWatcher() {
        const originalPushState = history.pushState;
        const originalReplaceState = history.replaceState;

        history.pushState = function (...args) {
            const ret = originalPushState.apply(this, args);
            onMapRouteChange();
            return ret;
        };

        history.replaceState = function (...args) {
            const ret = originalReplaceState.apply(this, args);
            onMapRouteChange();
            return ret;
        };

        window.addEventListener("popstate", onMapRouteChange);
        onMapRouteChange();
    }

    function onMapRouteChange() {
        if (isOnMapCapableRoute()) {
            startMapPanelWatcher();
            injectUiIfNeeded();
            attachBookmarksToMapIfNeeded();
        } else {
            stopMapPanelWatcher();
            teardownMap();
            destroyUi();
        }
    }

    function startMapPanelWatcher() {
        if (mapPanelObserver) return;

        handlePanelChange();

        mapPanelObserver = new MutationObserver(() => {
            if (mapPanelMutationScheduled) return;

            mapPanelMutationScheduled = true;
            requestAnimationFrame(() => {
                mapPanelMutationScheduled = false;
                handlePanelChange();
            });
        });

        mapPanelObserver.observe(document.body || document.documentElement, {
            childList: true,
            subtree: true
        });
    }

    function stopMapPanelWatcher() {
        if (!mapPanelObserver) return;
        mapPanelObserver.disconnect();
        mapPanelObserver = null;
    }

    function handlePanelChange() {
        if (!isOnMapCapableRoute()) {
            destroyUi();
            return;
        }

        injectUiIfNeeded();
        setupPoiBridgeWatcher();
        attachBookmarksToMapIfNeeded();
        injectBookmarkActionIfNeeded();
        alignTriggerToMap();
    }

    function looksLikeGoogleMap(obj) {
        return obj
        && typeof obj.getCenter === "function"
        && typeof obj.getZoom === "function"
        && typeof obj.setCenter === "function"
        && typeof obj.getDiv === "function";
    }

    function getMapFromNgContext(ctx) {
        for (const entry of ctx) {
            if (looksLikeGoogleMap(entry)) return entry;
        }

        return null;
    }

    function getWfMap() {
        return new Promise(resolve => {
            let attempts = 80;

            const tick = () => {
                for (const el of document.querySelectorAll("app-wf-base-map, nia-map")) {
                    const map = el.__ngContext__ && getMapFromNgContext(el.__ngContext__);
                    if (map) return resolve(map);
                }

                if (--attempts <= 0) return resolve(null);
                setTimeout(tick, 250);
            };

            tick();
        });
    }

    function isMapStale(map) {
        return !map || !map.getDiv().isConnected;
    }

    async function ensureLiveMap() {
        if (!isMapStale(wfMap)) return wfMap;
        wfMap = await getWfMap();
        return wfMap;
    }

    async function attachBookmarksToMapIfNeeded() {
        if (!isOnMapCapableRoute()) return;
        await ensureLiveMap();
        alignTriggerToMap();
    }

    function teardownMap() {
        wfMap = null;
    }

    function setupPoiBridgeWatcher() {
        let bridge = document.getElementById(POI_BRIDGE_ID);

        if (!bridge) {
            bridge = document.createElement("div");
            bridge.id = POI_BRIDGE_ID;
            bridge.style.display = "none";
            document.documentElement.appendChild(bridge);
        }

        if (bridge._wfBookmarksObserverAttached) return;
        bridge._wfBookmarksObserverAttached = true;

        const observer = new MutationObserver(mutations => {
            for (const m of mutations) {
                if (m.type !== "attributes" || m.attributeName !== "data-payload") continue;
                readPoiBridgePayload();
                updateBookmarkActionState();
            }
        });

        observer.observe(bridge, {
            attributes: true,
            attributeFilter: ["data-payload"]
        });

        readPoiBridgePayload();
    }

    function readPoiBridgePayload() {
        const raw = document.getElementById(POI_BRIDGE_ID)?.getAttribute("data-payload");
        currentPoi = raw ? payloadToPoi(JSON.parse(raw)) : null;
    }

    function payloadToPoi(payload) {
        const lat = Number(payload.lat);
        const lng = Number(payload.lng);

        return {
            poiId: payload.poiId || payload.id || payload.guid,
            title: payload.title || "(untitled)",
            lat,
            lng
        };
    }

    function injectUiIfNeeded() {
        if (!isOnMapCapableRoute() || !document.body) return;

        injectCss();

        if (!document.getElementById("wf-bookmarks-trigger-mask")) {
            createTrigger();
        }

        if (!document.getElementById("wf-bookmarks-box")) {
            createBookmarksBox();
        }

        updateBoxVisibility();
        alignTriggerToMap();
    }

    function destroyUi() {
        document.getElementById("wf-bookmarks-trigger-mask")?.remove();
        document.getElementById("wf-bookmarks-box")?.remove();
        cleanupSortDrag(true);
        sortDrag = null;
        windowDrag = null;
    }

    function createTrigger() {
        const mask = document.createElement("div");
        mask.id = "wf-bookmarks-trigger-mask";

        const trigger = document.createElement("a");
        trigger.id = "wf-bookmarks-trigger";
        trigger.href = "#";
        trigger.title = "Bookmarks";
        trigger.textContent = "Bookmarks";

        trigger.addEventListener("click", evt => {
            evt.preventDefault();

            if (!isOnMapCapableRoute()) return;

            state.data.ui.visible = true;
            saveData();
            updateBoxVisibility();
        });

        mask.appendChild(trigger);
        document.body.appendChild(mask);
    }

    function alignTriggerToMap() {
        const mask = document.getElementById("wf-bookmarks-trigger-mask");
        if (!mask || !isOnMapCapableRoute()) return;

        const div = wfMap && wfMap.getDiv();
        const rect = div && div.getBoundingClientRect();

        const left = rect && rect.width
        ? Math.round(rect.left + rect.width * 0.20)
        : 280;

        const top = rect && rect.height
        ? Math.round(rect.top)
        : 76;

        mask.style.left = `${left}px`;
        mask.style.top = `${top}px`;
    }

    function createBookmarksBox() {
        const box = document.createElement("div");
        box.id = "wf-bookmarks-box";
        box.innerHTML = `
            <div id="wf-bookmarks-topbar" class="wf-bookmarks-handle">
                <button id="wf-bookmarks-min" type="button" title="Minimise">-</button>
                <div class="wf-bookmarks-title">...</div>
                <button id="wf-bookmarks-delete-toggle" type="button" title="Delete mode"></button>
            </div>

<div class="wf-bookmarks-tabs">
    <button class="wf-bookmarks-tab" type="button" data-tab="maps">Maps</button>
    <button class="wf-bookmarks-tab" type="button" data-tab="wayspots">Wayspots</button>
</div>

<div class="wf-bookmarks-transfer-row">
    <button
        id="wf-bookmarks-export"
        type="button"
        title="Export bookmarks to a JSON file"
    >
        Export
    </button>

    <button
        id="wf-bookmarks-import"
        type="button"
        title="Import bookmarks from a JSON file"
    >
        Import
    </button>

    <input
        id="wf-bookmarks-import-file"
        type="file"
        accept=".json,application/json"
        hidden
    />
</div>

<div class="wf-bookmarks-add-row" data-for-tab="maps">
                <input id="wf-bookmarks-label-input-maps" placeholder="Insert label" />
                <button id="wf-bookmarks-add-map" type="button">+ Map</button>
                <button id="wf-bookmarks-add-folder-maps" type="button">+ Folder</button>
            </div>

            <div class="wf-bookmarks-add-row" data-for-tab="wayspots">
                <input id="wf-bookmarks-label-input-wayspots" placeholder="Insert label" />
                <button id="wf-bookmarks-add-folder-wayspots" type="button">+ Folder</button>
            </div>

            <div id="wf-bookmarks-list-maps" class="wf-bookmarks-list" data-tab="maps"></div>
            <div id="wf-bookmarks-list-wayspots" class="wf-bookmarks-list" data-tab="wayspots"></div>
        `;

        box.style.left = `${state.data.ui.left}px`;
        box.style.top = `${state.data.ui.top}px`;
        box.style.width = `${state.data.ui.width}px`;

        document.body.appendChild(box);

        makeWindowDraggable(box, box.querySelector(".wf-bookmarks-handle"));
        wireUiEvents();
        renderBookmarks();
    }

    function wireUiEvents() {
        document.getElementById("wf-bookmarks-min")?.addEventListener("click", evt => {
            evt.preventDefault();
            state.data.ui.visible = false;
            saveData();
            updateBoxVisibility();
        });

        document.getElementById("wf-bookmarks-delete-toggle")?.addEventListener("click", evt => {
            evt.preventDefault();
            state.data.ui.deleteMode = !state.data.ui.deleteMode;
            saveData();
            renderBookmarks();
        });

        document.getElementById("wf-bookmarks-export")?.addEventListener(
            "click",
            evt => {
                evt.preventDefault();
                exportBookmarks();
            }
        );

        document.getElementById("wf-bookmarks-import")?.addEventListener(
            "click",
            evt => {
                evt.preventDefault();

                document
                    .getElementById("wf-bookmarks-import-file")
                    ?.click();
            }
        );

        document.getElementById("wf-bookmarks-import-file")?.addEventListener(
            "change",
            evt => {
                importBookmarksFile(evt.target.files?.[0]);

                // Clearing the input allows the same file to be selected again.
                evt.target.value = "";
            }
        );

        document.querySelectorAll("#wf-bookmarks-box .wf-bookmarks-tab").forEach(btn => {
            btn.addEventListener("click", evt => {
                evt.preventDefault();
                state.data.ui.activeTab = btn.dataset.tab || "maps";
                saveData();
                renderBookmarks();
            });
        });

        document.getElementById("wf-bookmarks-add-map")?.addEventListener("click", evt => {
            evt.preventDefault();
            addCurrentMapBookmark();
        });

        document.getElementById("wf-bookmarks-add-folder-maps")?.addEventListener("click", evt => {
            evt.preventDefault();
            addFolder("maps");
        });

        document.getElementById("wf-bookmarks-add-folder-wayspots")?.addEventListener("click", evt => {
            evt.preventDefault();
            addFolder("wayspots");
        });

        ["maps", "wayspots"].forEach(tab => {
            const input = document.getElementById(`wf-bookmarks-label-input-${tab}`);
            if (!input) return;

            input.addEventListener("keydown", evt => {
                if (evt.key !== "Enter") return;

                evt.preventDefault();

                if (tab === "maps") {
                    addCurrentMapBookmark();
                } else {
                    addFolder("wayspots");
                }
            });
        });
    }

    function updateBoxVisibility() {
        const box = document.getElementById("wf-bookmarks-box");
        const mask = document.getElementById("wf-bookmarks-trigger-mask");

        if (!isOnMapCapableRoute()) {
            if (box) box.style.display = "none";
            if (mask) mask.style.display = "none";
            return;
        }

        if (box) box.style.display = state.data.ui.visible ? "block" : "none";
        if (mask) mask.style.display = state.data.ui.visible ? "none" : "block";
    }

    function renderBookmarks() {
        const box = document.getElementById("wf-bookmarks-box");
        if (!box || !state.data) return;

        normaliseRootOrder(state.data.maps);
        normaliseRootOrder(state.data.wayspots);

        const activeTab = state.data.ui.activeTab || "maps";

        box.classList.toggle("wf-bookmarks-delete-mode", !!state.data.ui.deleteMode);

        box.querySelectorAll(".wf-bookmarks-tab").forEach(btn => {
            btn.classList.toggle("active", btn.dataset.tab === activeTab);
        });

        box.querySelectorAll(".wf-bookmarks-add-row").forEach(row => {
            row.style.display = row.dataset.forTab === activeTab ? "block" : "none";
        });

        box.querySelectorAll(".wf-bookmarks-list").forEach(list => {
            list.style.display = list.dataset.tab === activeTab ? "block" : "none";
        });

        renderList("maps");
        renderList("wayspots");
        updateBookmarkActionState();
    }

    function renderList(tab) {
        const container = document.getElementById(`wf-bookmarks-list-${tab}`);
        if (!container) return;

        const root = document.createElement("ul");
        root.className = "wf-bookmarks-root wf-bookmarks-sort-container";
        root.dataset.tab = tab;
        root.dataset.parentId = "root";

        const folders = getCustomFolders(tab);
        const other = getOtherFolder(tab);
        const rootBookmarks = other.children || [];

        folders.forEach((folder, index) => {
            root.appendChild(renderNode(tab, folder, "root", index));
        });

        rootBookmarks.forEach((node, index) => {
            root.appendChild(renderNode(tab, node, DEFAULT_OTHER_FOLDER_ID, index));
        });

        /*
     * Important:
     * If there are no unfoldered bookmarks, we still need a visible root-level
     * drop row after the folders. This gives you somewhere to drag a bookmark
     * out of a folder and into "Others"/unfoldered.
     */
        if (rootBookmarks.length === 0) {
            const emptyRootDropRow = createEmptyDropRow(tab, "root");
            emptyRootDropRow.classList.add("wf-bookmarks-empty-root-drop-row");
            root.appendChild(emptyRootDropRow);
        }

        container.innerHTML = "";
        container.appendChild(root);
    }

    function renderNode(tab, node, parentId, index) {
        const li = document.createElement("li");
        li.className = `wf-bookmarks-node wf-bookmarks-${node.type}`;
        li.dataset.id = node.id;
        li.dataset.type = node.type;
        li.dataset.tab = tab;
        li.dataset.parentId = parentId;
        li.dataset.index = String(index);

        if (node.type === "folder") {
            li.classList.toggle("wf-bookmarks-folder-open", !!node.open);
            li.classList.toggle("wf-bookmarks-folder-closed", !node.open);
        }

        if (node.id !== DEFAULT_OTHER_FOLDER_ID) {
            li.addEventListener("mousedown", evt => beginSortDrag(evt, tab, node.id, parentId));
        }

        if (node.type === "folder") {
            li.appendChild(renderFolderHeader(tab, node));

            /*
         * Important:
         * Only create/append the child UL while the folder is open.
         * The previous version appended an empty child UL even when closed.
         * Because the CSS gave that UL a min-height, closed folders left blank rows.
         */
            if (node.open) {
                const childUl = document.createElement("ul");
                childUl.className = "wf-bookmarks-folder-children wf-bookmarks-sort-container";
                childUl.dataset.tab = tab;
                childUl.dataset.parentId = node.id;

                const children = node.children || [];

                children.forEach((child, childIndex) => {
                    childUl.appendChild(renderNode(tab, child, node.id, childIndex));
                });

                if (children.length === 0) {
                    childUl.appendChild(createEmptyDropRow(tab, node.id));
                }

                li.appendChild(childUl);
            }
        } else {
            li.appendChild(renderBookmarkRow(tab, node));
        }

        return li;
    }

    function renderFolderHeader(tab, folder) {
        const row = document.createElement("div");
        row.className = "wf-bookmarks-row wf-bookmarks-folder-row";

        const del = createDeleteButton(() => removeNode(tab, folder.id));

        const toggle = document.createElement("button");
        toggle.type = "button";
        toggle.className = "wf-bookmarks-folder-toggle";
        toggle.textContent = folder.open ? "▼" : "▶";
        toggle.title = folder.open ? "Close folder" : "Open folder";

        toggle.addEventListener("click", evt => {
            evt.preventDefault();
            evt.stopPropagation();
            folder.open = !folder.open;
            saveData();
            renderBookmarks();
        });

        const label = document.createElement("button");
        label.type = "button";
        label.className = "wf-bookmarks-label wf-bookmarks-folder-label";
        label.textContent = folder.label || "Folder";

        label.addEventListener("click", evt => {
            evt.preventDefault();
            evt.stopPropagation();
            folder.open = !folder.open;
            saveData();
            renderBookmarks();
        });

        row.appendChild(del);
        row.appendChild(toggle);
        row.appendChild(label);

        return row;
    }

    function renderBookmarkRow(tab, bookmark) {
        const row = document.createElement("div");
        row.className = "wf-bookmarks-row wf-bookmarks-bookmark-row";

        const del = createDeleteButton(() => removeNode(tab, bookmark.id));

        const label = document.createElement("button");
        label.type = "button";
        label.className = "wf-bookmarks-label wf-bookmarks-bookmark-label";

        if (tab === "maps") {
            label.textContent = bookmark.label || `${bookmark.lat},${bookmark.lng} [${bookmark.zoom}]`;
            label.title = "Restore saved map view";
            label.addEventListener("click", evt => {
                if (Date.now() < suppressClickUntil) return;
                evt.preventDefault();
                evt.stopPropagation();
                restoreMapBookmark(bookmark);
            });
        } else {
            label.textContent = bookmark.label || "(untitled Wayspot)";
            label.title = "Centre map on saved Wayspot";
            label.addEventListener("click", evt => {
                if (Date.now() < suppressClickUntil) return;
                evt.preventDefault();
                evt.stopPropagation();
                restoreWayspotBookmark(bookmark);
            });
        }

        row.appendChild(del);
        row.appendChild(label);

        return row;
    }

    function createDeleteButton(onClick) {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "wf-bookmarks-delete";
        btn.textContent = "X";
        btn.title = "Delete";

        btn.addEventListener("mousedown", evt => {
            evt.preventDefault();
            evt.stopPropagation();
        });

        btn.addEventListener("click", evt => {
            evt.preventDefault();
            evt.stopPropagation();
            onClick();
        });

        return btn;
    }

    function createEmptyDropRow(tab, parentId) {
        const row = document.createElement("li");
        row.className = "wf-bookmarks-empty-drop-row";
        row.dataset.tab = tab;
        row.dataset.parentId = parentId;
        return row;
    }

    function beginSortDrag(evt, tab, id, parentId) {
        if (evt.button !== 0) return;
        if (evt.target?.closest?.(".wf-bookmarks-delete")) return;
        if (evt.target?.closest?.(".wf-bookmarks-folder-toggle")) return;

        evt.stopPropagation();

        const nodeInfo = findNode(tab, id);
        if (!nodeInfo) return;

        const draggedEl = evt.currentTarget;
        const rect = draggedEl.getBoundingClientRect();

        sortDrag = {
            tab,
            id,
            parentId,
            itemType: nodeInfo.node.type,
            startX: evt.clientX,
            startY: evt.clientY,
            offsetX: evt.clientX - rect.left,
            offsetY: evt.clientY - rect.top,
            sourceEl: draggedEl,
            ghost: null,
            placeholder: null,
            moved: false
        };

        document.addEventListener("mousemove", handleSortMove, true);
        document.addEventListener("mouseup", finishSortDrag, true);
    }

    function handleSortMove(evt) {
        if (!sortDrag) return;

        const dx = evt.clientX - sortDrag.startX;
        const dy = evt.clientY - sortDrag.startY;

        if (!sortDrag.moved && Math.sqrt(dx * dx + dy * dy) < 4) return;

        if (!sortDrag.moved) {
            startActualSortDrag();
        }

        sortDrag.moved = true;

        evt.preventDefault();
        evt.stopPropagation();

        sortDrag.ghost.style.left = `${evt.clientX - sortDrag.offsetX}px`;
        sortDrag.ghost.style.top = `${evt.clientY - sortDrag.offsetY}px`;

        updateSortPlaceholder(evt.clientX, evt.clientY);
    }

    function startActualSortDrag() {
        const source = sortDrag.sourceEl;
        const rect = source.getBoundingClientRect();

        const placeholder = document.createElement("li");
        placeholder.className = `wf-bookmarks-sort-placeholder wf-bookmarks-placeholder-${sortDrag.itemType}`;
        placeholder.dataset.type = sortDrag.itemType;
        placeholder.style.height = `${Math.max(22, rect.height)}px`;

        const ghost = source.cloneNode(true);
        ghost.classList.add("wf-bookmarks-sort-ghost");
        ghost.style.width = `${rect.width}px`;
        ghost.style.height = `${rect.height}px`;
        ghost.style.left = `${rect.left}px`;
        ghost.style.top = `${rect.top}px`;

        source.parentNode.insertBefore(placeholder, source);
        source.style.display = "none";
        document.body.appendChild(ghost);

        sortDrag.placeholder = placeholder;
        sortDrag.ghost = ghost;

        document.body.classList.add("wf-bookmarks-sorting");
    }

    function updateSortPlaceholder(clientX, clientY) {
        const placeholder = sortDrag.placeholder;
        if (!placeholder) return;

        placeholder.style.display = "none";
        const under = document.elementFromPoint(clientX, clientY);
        placeholder.style.display = "";

        /*
     * Reset any special drop metadata from the previous mousemove.
     */
        delete placeholder.dataset.dropParentId;
        delete placeholder.dataset.dropIndex;

        /*
     * Dropping a bookmark onto a folder header should put it in that folder.
     * This is especially needed for closed folders, because their child UL is
     * not rendered, so there is no folder-children sort container to detect.
     */
        const folderLi = under?.closest?.(".wf-bookmarks-folder");

        if (
            folderLi &&
            sortDrag.itemType !== "folder" &&
            folderLi.dataset.tab === sortDrag.tab &&
            folderLi.dataset.id &&
            folderLi.dataset.id !== sortDrag.id &&
            canDrop(sortDrag.tab, sortDrag.id, folderLi.dataset.id)
        ) {
            const folderInfo = findNode(sortDrag.tab, folderLi.dataset.id);
            const folderChildren = folderInfo?.node?.children || [];

            placeholder.dataset.dropParentId = folderLi.dataset.id;
            placeholder.dataset.dropIndex = String(folderChildren.length);

            /*
         * Visual cue:
         * Put the placeholder directly after the folder header/folder block.
         * On mouseup, finishSortDrag uses the dataset above, not the visual
         * parent, so the bookmark is still moved into the folder.
         */
            if (folderLi.parentNode) {
                folderLi.parentNode.insertBefore(placeholder, folderLi.nextSibling);
            }

            return;
        }

        const container = under?.closest?.(".wf-bookmarks-sort-container");
        if (!container) return;

        const tab = container.dataset.tab;
        const targetParentId = container.dataset.parentId;

        if (tab !== sortDrag.tab) return;
        if (!canDrop(sortDrag.tab, sortDrag.id, targetParentId)) return;

        if (targetParentId === "root") {
            updateRootPlaceholder(container, clientY);
        } else {
            updateFolderPlaceholder(container, clientY);
        }
    }

    function updateRootPlaceholder(container, clientY) {
        const draggedIsFolder = sortDrag.itemType === "folder";

        const candidates = Array.from(container.children).filter(el => {
            if (el === sortDrag.placeholder || el === sortDrag.sourceEl) return false;
            if (!el.classList.contains("wf-bookmarks-node")) return false;

            const isFolder = el.dataset.type === "folder";
            return draggedIsFolder ? isFolder : !isFolder;
        });

        let beforeEl = null;

        for (const item of candidates) {
            const r = item.getBoundingClientRect();
            if (clientY < r.top + r.height / 2) {
                beforeEl = item;
                break;
            }
        }

        if (beforeEl) {
            container.insertBefore(sortDrag.placeholder, beforeEl);
            return;
        }

        if (draggedIsFolder) {
            const firstBookmark = Array.from(container.children).find(el => {
                return el.classList.contains("wf-bookmarks-node") && el.dataset.type !== "folder";
            });

            if (firstBookmark) {
                container.insertBefore(sortDrag.placeholder, firstBookmark);
            } else {
                container.appendChild(sortDrag.placeholder);
            }
        } else {
            container.appendChild(sortDrag.placeholder);
        }
    }

    function updateFolderPlaceholder(container, clientY) {
        if (sortDrag.itemType === "folder") return;

        const candidates = Array.from(container.children).filter(el => {
            if (el === sortDrag.placeholder || el === sortDrag.sourceEl) return false;
            return el.classList.contains("wf-bookmarks-node") && el.dataset.type !== "folder";
        });

        let beforeEl = null;

        for (const item of candidates) {
            const r = item.getBoundingClientRect();
            if (clientY < r.top + r.height / 2) {
                beforeEl = item;
                break;
            }
        }

        const emptyRow = container.querySelector(":scope > .wf-bookmarks-empty-drop-row");

        if (beforeEl) {
            container.insertBefore(sortDrag.placeholder, beforeEl);
        } else if (emptyRow) {
            container.insertBefore(sortDrag.placeholder, emptyRow);
        } else {
            container.appendChild(sortDrag.placeholder);
        }
    }

    function finishSortDrag(evt) {
        document.removeEventListener("mousemove", handleSortMove, true);
        document.removeEventListener("mouseup", finishSortDrag, true);

        if (!sortDrag) return;

        const drag = sortDrag;

        if (drag.moved && drag.placeholder) {
            evt.preventDefault();
            evt.stopPropagation();

            const parentEl = drag.placeholder.closest(".wf-bookmarks-sort-container");

            /*
         * Usually the target comes from the placeholder's parent container.
         * But when dropping onto a closed folder, updateSortPlaceholder stores
         * the intended folder target directly on the placeholder.
         */
            const targetParentId =
                  drag.placeholder.dataset.dropParentId ||
                  parentEl?.dataset?.parentId ||
                  "root";

            const targetIndex =
                  drag.placeholder.dataset.dropIndex !== undefined
            ? Number(drag.placeholder.dataset.dropIndex)
            : calculatePlaceholderIndex(parentEl, drag.placeholder, drag.itemType, targetParentId);

            cleanupSortDrag(false);

            if (canDrop(drag.tab, drag.id, targetParentId)) {
                moveNode(drag.tab, drag.id, targetParentId, targetIndex);
            } else {
                renderBookmarks();
            }

            suppressClickUntil = Date.now() + 250;
            sortDrag = null;
            return;
        }

        cleanupSortDrag(true);
        sortDrag = null;
    }

    function calculatePlaceholderIndex(container, placeholder, itemType, targetParentId) {
        if (!container) return 0;

        const children = Array.from(container.children);
        let index = 0;

        for (const el of children) {
            if (el === placeholder) break;
            if (el === sortDrag.sourceEl) continue;
            if (!el.classList.contains("wf-bookmarks-node")) continue;

            if (targetParentId === "root") {
                const isFolder = el.dataset.type === "folder";
                if (itemType === "folder" && isFolder) index++;
                if (itemType !== "folder" && !isFolder) index++;
            } else {
                if (el.dataset.type !== "folder") index++;
            }
        }

        return index;
    }

    function cleanupSortDrag(showSource) {
        if (!sortDrag) return;

        if (sortDrag.sourceEl) {
            sortDrag.sourceEl.style.display = showSource ? "" : "none";
        }

        sortDrag.ghost?.remove();
        sortDrag.placeholder?.remove();

        document.body.classList.remove("wf-bookmarks-sorting");
    }

    function canDrop(tab, draggedId, targetParentId) {
        if (!draggedId) return false;

        const dragged = findNode(tab, draggedId);
        if (!dragged) return false;

        if (dragged.node.type === "folder") {
            return targetParentId === "root";
        }

        if (draggedId === targetParentId) return false;

        return true;
    }

    function getList(tab) {
        return tab === "wayspots" ? state.data.wayspots : state.data.maps;
    }

    function getOtherFolder(tab) {
        return getList(tab).find(n => n.id === DEFAULT_OTHER_FOLDER_ID);
    }

    function getCustomFolders(tab) {
        return getList(tab).filter(n => n.type === "folder" && n.id !== DEFAULT_OTHER_FOLDER_ID);
    }

    function getInputLabel(tab) {
        const input = document.getElementById(`wf-bookmarks-label-input-${tab}`);
        const label = (input?.value || "").trim();

        if (input) input.value = "";

        return label;
    }

    async function addCurrentMapBookmark() {
        const map = await ensureLiveMap();

        if (!map) {
            alert("Map is not available yet.");
            return;
        }

        const label = getInputLabel("maps");

        try {
            const center = map.getCenter();
            const lat = roundCoord(typeof center.lat === "function" ? center.lat() : center.lat);
            const lng = roundCoord(typeof center.lng === "function" ? center.lng() : center.lng);
            const zoom = Number(map.getZoom());

            const bookmark = {
                id: generateId("map"),
                type: "map",
                label: label || `${lat},${lng} [${zoom}]`,
                lat,
                lng,
                zoom: Number.isFinite(zoom) ? zoom : 18
            };

            addNodeToOther("maps", bookmark);
            saveData();
            renderBookmarks();
        } catch (e) {
            console.warn("[WF Bookmarks] Failed to save map bookmark.", e);
            alert("Could not read the current map centre.");
        }
    }

    function addFolder(tab) {
        const label = getInputLabel(tab) || "Folder";

        const folder = {
            id: generateId("folder"),
            type: "folder",
            label,
            open: true,
            children: []
        };

        const list = getList(tab);
        const otherIndex = list.findIndex(n => n.id === DEFAULT_OTHER_FOLDER_ID);

        if (otherIndex >= 0) {
            list.splice(otherIndex, 0, folder);
        } else {
            list.push(folder);
        }

        normaliseRootOrder(list);
        saveData();
        renderBookmarks();
    }

    function addCurrentWayspotBookmark() {
        readPoiBridgePayload();

        if (!currentPoi) {
            alert("No Wayspot is currently selected.");
            return;
        }

        const existing = findWayspotBookmark(currentPoi);

        if (existing) {
            alert("This Wayspot is already bookmarked.");
            return;
        }

        const bookmark = {
            id: generateId("wayspot"),
            type: "wayspot",
            poiId: currentPoi.poiId,
            label: currentPoi.title,
            lat: Number(currentPoi.lat),
            lng: Number(currentPoi.lng)
        };

        addNodeToOther("wayspots", bookmark);
        saveData();
        renderBookmarks();
    }

    function addNodeToOther(tab, node) {
        const other = getOtherFolder(tab);
        other.children.push(node);
    }

    function removeNode(tab, id) {
        if (id === DEFAULT_OTHER_FOLDER_ID) return;

        const removed = removeNodeFromArray(getList(tab), id);

        if (removed) {
            saveData();
            renderBookmarks();
        }
    }

    function removeNodeFromArray(arr, id) {
        if (!Array.isArray(arr)) return null;

        const idx = arr.findIndex(n => n.id === id);

        if (idx >= 0) {
            return arr.splice(idx, 1)[0];
        }

        for (const node of arr) {
            if (node.type === "folder" && Array.isArray(node.children)) {
                const removed = removeNodeFromArray(node.children, id);
                if (removed) return removed;
            }
        }

        return null;
    }

    function moveNode(tab, id, targetParentId, targetIndex) {
        const original = findNode(tab, id);
        if (!original) return;

        const removed = removeNodeFromArray(getList(tab), id);
        if (!removed) return;

        let targetArray;
        let targetActualParentId = targetParentId;

        if (removed.type === "folder") {
            targetArray = getCustomFolders(tab);
            targetActualParentId = "root";
        } else if (targetParentId === "root") {
            targetArray = getOtherFolder(tab).children;
            targetActualParentId = DEFAULT_OTHER_FOLDER_ID;
        } else {
            const target = findNode(tab, targetParentId);

            if (!target || target.node.type !== "folder") {
                targetArray = getOtherFolder(tab).children;
                targetActualParentId = DEFAULT_OTHER_FOLDER_ID;
            } else {
                target.node.children = target.node.children || [];
                target.node.open = true;
                targetArray = target.node.children;
                targetActualParentId = target.node.id;
            }
        }

        let adjustedTargetIndex = Number(targetIndex) || 0;

        if (original.parentId === targetActualParentId && original.index < adjustedTargetIndex) {
            adjustedTargetIndex--;
        }

        const safeIndex = Math.max(0, Math.min(adjustedTargetIndex, targetArray.length));
        targetArray.splice(safeIndex, 0, removed);

        if (removed.type === "folder") {
            const other = getOtherFolder(tab);
            const list = getList(tab);
            list.length = 0;
            list.push(...targetArray, other);
        }

        normaliseRootOrder(getList(tab));
        saveData();
        renderBookmarks();
    }

    function findNode(tab, id) {
        if (id === "root") {
            return {
                node: null,
                parentId: null,
                index: -1,
                array: getList(tab)
            };
        }

        return findNodeInArray(getList(tab), id, "root");
    }

    function findNodeInArray(arr, id, parentId) {
        for (let i = 0; i < arr.length; i++) {
            const node = arr[i];

            if (node.id === id) {
                return { node, parentId, index: i, array: arr };
            }

            if (node.type === "folder") {
                const found = findNodeInArray(node.children, id, node.id);
                if (found) return found;
            }
        }

        return null;
    }

    function findWayspotBookmark(poi) {
        return findNodeByPredicate(state.data.wayspots, node =>
                                   node.type === "wayspot" && node.poiId === poi.poiId
                                  );
    }

    function findNodeByPredicate(nodes, predicate) {
        for (const node of nodes) {
            if (predicate(node)) return node;

            if (node.type === "folder") {
                const found = findNodeByPredicate(node.children, predicate);
                if (found) return found;
            }
        }

        return null;
    }

    async function restoreMapBookmark(bookmark) {
        const map = await ensureLiveMap();

        if (!map) {
            alert("Map is not available yet.");
            return;
        }

        const latLng = makeLatLng(Number(bookmark.lat), Number(bookmark.lng));
        map.setZoom(Number(bookmark.zoom));
        map.setCenter(latLng);
        map.panTo(latLng);
    }

    async function restoreWayspotBookmark(bookmark) {
        const map = await ensureLiveMap();

        if (!map) {
            alert("Map is not available yet.");
            return;
        }

        const latLng = makeLatLng(Number(bookmark.lat), Number(bookmark.lng));

        if (map.getZoom() < 18) map.setZoom(18);

        map.setCenter(latLng);
        map.panTo(latLng);

        selectLivePoiByIdWhenLoaded(bookmark.poiId);
    }

    function selectLivePoiByIdWhenLoaded(poiId) {
        const started = Date.now();
        const timeout = 8000;

        const timer = setInterval(() => {
            const poi = findLivePoiById(poiId);

            if (poi) {
                clearInterval(timer);
                publishLivePoiToBridge(poi);
                updateBookmarkActionState();
                return;
            }

            if (Date.now() - started > timeout) {
                clearInterval(timer);
                console.warn("[WF Bookmarks] Could not find live POI with ID:", poiId);
            }
        }, 250);
    }

    function publishLivePoiToBridge(poi) {
        const bridge = document.getElementById(POI_BRIDGE_ID);
        if (!bridge) return;

        const payload = {
            guid: poi.guid,
            poiId: poi.guid,
            title: poi.title,
            description: poi.description,
            lat: poi.lat,
            lng: poi.lng,
            imageUrl: poi.imageUrl,
            status: poi.status || "LIVE",
            dataSourceText: poi.dataSourceText,
            borderColor: poi.borderColor,
            isCommunityContributed: poi.isCommunityContributed,
            pgoEntity: poi.pgoEntity || "",
            pgoEntityStatus: poi.pgoEntityStatus || "",
            hasAdditionalImages: poi.hasAdditionalImages || false
        };

        bridge.setAttribute("data-payload", JSON.stringify(payload));
    }

    function findLivePoiById(poiId) {
        if (!Array.isArray(window.currentPois)) return null;

        const targetId = String(poiId || "");

        return window.currentPois.find(poi => {
            return String(poi.guid || poi.poiId || poi.id || "") === targetId;
        }) || null;
    }

    function makeLatLng(lat, lng) {
        return window.google?.maps?.LatLng
            ? new google.maps.LatLng(lat, lng)
        : { lat, lng };
    }

    function injectBookmarkActionIfNeeded() {
        if (!isOnMapCapableRoute()) return;

        const container = document.querySelector(".wfmapmods-poi-function-links");
        if (!container) return;

        let link = container.querySelector("#wf-bookmarks-function-bookmark");

        if (!link) {
            link = document.createElement("a");
            link.id = "wf-bookmarks-function-bookmark";
            link.href = "#";
            link.textContent = "☆ Bookmark";
            link.style.cursor = "pointer";

            link.addEventListener("click", evt => {
                evt.preventDefault();

                readPoiBridgePayload();

                if (!currentPoi) {
                    alert("No Wayspot is currently selected.");
                    return;
                }

                const existing = findWayspotBookmark(currentPoi);

                if (existing) {
                    removeNode("wayspots", existing.id);
                } else {
                    addCurrentWayspotBookmark();
                }

                updateBookmarkActionState();
            });

            container.appendChild(link);
        }

        updateBookmarkActionState();
    }

    function updateBookmarkActionState() {
        const link = document.getElementById("wf-bookmarks-function-bookmark");
        if (!link) return;

        readPoiBridgePayload();

        if (!currentPoi) {
            link.style.display = "none";
            return;
        }

        link.style.display = "";

        const existing = findWayspotBookmark(currentPoi);

        link.textContent = existing ? "★ Bookmarked" : "☆ Bookmark";
        link.title = existing ? "Remove this Wayspot bookmark" : "Bookmark this Wayspot";
    }

    function makeWindowDraggable(box, handle) {
        if (!box || !handle) return;

        handle.addEventListener("mousedown", evt => {
            if (evt.button !== 0) return;
            if (evt.target?.closest?.("button")) return;

            windowDrag = {
                startX: evt.clientX,
                startY: evt.clientY,
                startLeft: box.offsetLeft,
                startTop: box.offsetTop
            };

            document.addEventListener("mousemove", handleWindowMove, true);
            document.addEventListener("mouseup", finishWindowDrag, true);

            document.body.classList.add("wf-bookmarks-window-dragging");
            evt.preventDefault();
        });
    }

    function handleWindowMove(evt) {
        if (!windowDrag) return;

        const box = document.getElementById("wf-bookmarks-box");
        if (!box) return;

        const newLeft = Math.max(0, Math.min(window.innerWidth - 80, windowDrag.startLeft + evt.clientX - windowDrag.startX));
        const newTop = Math.max(0, Math.min(window.innerHeight - 40, windowDrag.startTop + evt.clientY - windowDrag.startY));

        box.style.left = `${newLeft}px`;
        box.style.top = `${newTop}px`;
    }

    function finishWindowDrag() {
        document.removeEventListener("mousemove", handleWindowMove, true);
        document.removeEventListener("mouseup", finishWindowDrag, true);

        const box = document.getElementById("wf-bookmarks-box");

        if (box) {
            state.data.ui.left = box.offsetLeft;
            state.data.ui.top = box.offsetTop;
            saveData();
        }

        windowDrag = null;
        document.body.classList.remove("wf-bookmarks-window-dragging");
    }

    function roundCoord(n) {
        return Math.round(Number(n) * 1e6) / 1e6;
    }

    function injectCss() {
        if (document.getElementById("wf-bookmarks-css")) return;

        const style = document.createElement("style");
        style.id = "wf-bookmarks-css";
        style.textContent = `
        :root {
            --wf-bookmarks-bg: rgba(8,48,78,0.85);
            --wf-bookmarks-bg-strong: rgba(8,48,78,0.3);
            --wf-bookmarks-bg-dark: rgba(0,0,0,0.3);
            --wf-bookmarks-bg-dark-hover: rgba(0,0,0,0.6);
            --wf-bookmarks-bg-drop: rgba(8,48,78,0.55);
            --wf-bookmarks-border: #20a8b1;
            --wf-bookmarks-gold: #ffce00;
            --wf-bookmarks-white: #fff;
            --wf-bookmarks-font: Verdana, Geneva, sans-serif;
        }

        #wf-bookmarks-box,
        #wf-bookmarks-box *,
        #wf-bookmarks-trigger-mask,
        #wf-bookmarks-trigger-mask * {
            box-sizing: border-box;
        }

        #wf-bookmarks-box,
        #wf-bookmarks-box * {
            border-color: var(--wf-bookmarks-border);
            border-style: solid;
            font-family: var(--wf-bookmarks-font);
            font-size: 12px;
            line-height: 22px;
            margin: 0;
            text-indent: 0;
            text-decoration: none;
        }

        #wf-bookmarks-trigger-mask {
            position: fixed;
            overflow: hidden;
            width: 47px;
            height: 64px;
            z-index: 2999;
            pointer-events: auto;
        }

        #wf-bookmarks-trigger {
            display: block;
            position: absolute;
            top: 0;
            left: 0;
            width: 47px;
            height: 64px;
            margin-top: -36px;
            cursor: pointer;
            background-image: url("${BOOKMARK_SPRITE}");
            background-position: center bottom;
            background-repeat: no-repeat;
            transition: margin-top 100ms ease-in-out;
            text-indent: -9999px;
            text-decoration: none;
        }

        #wf-bookmarks-trigger-mask:hover #wf-bookmarks-trigger {
            margin-top: 0;
        }

        #wf-bookmarks-box {
            position: fixed;
            z-index: 4001;
            width: 250px;
            overflow: hidden;
            color: var(--wf-bookmarks-white);
            background: var(--wf-bookmarks-bg-strong);
            border: 1px solid var(--wf-bookmarks-border);
        }

        #wf-bookmarks-topbar {
            display: grid;
            grid-template-columns: 10% 80% 10%;
            height: 15px;
            overflow: hidden;
            background: var(--wf-bookmarks-bg);
            border-top-width: 1px;
            border-bottom-width: 1px;
            cursor: move;
        }

        #wf-bookmarks-topbar * {
            height: 14px !important;
            line-height: 10px !important;
        }

        #wf-bookmarks-min,
        #wf-bookmarks-delete-toggle {
            display: block;
            cursor: pointer;
            color: var(--wf-bookmarks-border);
            background: transparent;
            font-weight: bold;
            text-align: center;
            font-size: 18px !important;
        }

        #wf-bookmarks-min {
            border-right-width: 1px;
        }

        #wf-bookmarks-min:hover {
            color: var(--wf-bookmarks-gold);
        }

        #wf-bookmarks-delete-toggle {
            overflow: hidden;
            text-indent: -999px;
            background: #b42e2e;
            border-left-width: 1px;
        }

        .wf-bookmarks-title {
            text-align: center;
            color: var(--wf-bookmarks-white);
            line-height: 6px !important;
            letter-spacing: 3px;
        }

        .wf-bookmarks-tabs {
            display: grid;
            grid-template-columns: 1fr 1fr;
            height: 28px;
            overflow: hidden;
            background: var(--wf-bookmarks-bg);
            border-bottom-width: 1px;
        }

        .wf-bookmarks-tab {
            display: block;
            height: 28px;
            padding: 4px 0 23px;
            text-align: center;
            color: #788;
            background: var(--wf-bookmarks-bg-dark);
            cursor: pointer;
            font-size: 13px !important;
            font-weight: bold;
            border-left-width: 1px;
        }

        .wf-bookmarks-tab.active {
            cursor: default;
            color: var(--wf-bookmarks-white) !important;
            background: transparent;
        }

        .wf-bookmarks-tab:hover {
            color: var(--wf-bookmarks-gold);
            background: transparent;
        }

.wf-bookmarks-transfer-row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    height: 25px;
    overflow: hidden;
    background: var(--wf-bookmarks-bg);
    border-bottom-width: 1px;
}

.wf-bookmarks-transfer-row button {
    display: block;
    height: 25px !important;
    padding: 2px 0 21px;
    cursor: pointer;
    color: var(--wf-bookmarks-border);
    background: var(--wf-bookmarks-bg-dark);
    border-left-width: 1px;
    font-size: 12px !important;
    line-height: 20px !important;
    text-align: center;
}

.wf-bookmarks-transfer-row button:hover {
    color: #000;
    background: var(--wf-bookmarks-gold);
}

        .wf-bookmarks-add-row {
            height: 28px;
            overflow: hidden;
            background: var(--wf-bookmarks-bg);
            border-bottom-width: 1px;
            border-right-width: 1px;
        }

        .wf-bookmarks-add-row input,
        .wf-bookmarks-add-row button {
            display: block;
            float: left;
            height: 28px !important;
            background: var(--wf-bookmarks-bg-dark);
            border-left-width: 1px;
        }

        .wf-bookmarks-add-row input {
            color: var(--wf-bookmarks-gold);
            padding: 4px 8px 1px;
            font-size: 12px !important;
            line-height: 12px !important;
            outline: 0;
        }

        .wf-bookmarks-add-row input:hover,
        .wf-bookmarks-add-row input:focus {
            background: var(--wf-bookmarks-bg-dark-hover);
        }

        .wf-bookmarks-add-row input::placeholder {
            color: rgba(255,255,255,0.55);
            font-style: italic;
        }

        .wf-bookmarks-add-row button {
            cursor: pointer;
            color: var(--wf-bookmarks-border);
            font-size: 12px !important;
            text-align: center;
            line-height: 20px !important;
            padding: 4px 0 23px;
        }

        .wf-bookmarks-add-row button:hover {
            color: #000;
            background: var(--wf-bookmarks-gold);
        }

        .wf-bookmarks-add-row[data-for-tab="maps"] input {
            width: 42%;
        }

        .wf-bookmarks-add-row[data-for-tab="maps"] button {
            width: 29%;
        }

        .wf-bookmarks-add-row[data-for-tab="wayspots"] input {
            width: 65%;
        }

        .wf-bookmarks-add-row[data-for-tab="wayspots"] button {
            width: 35%;
        }

        .wf-bookmarks-list,
        .wf-bookmarks-list > ul,
        .wf-bookmarks-root,
        .wf-bookmarks-folder-children {
            list-style: none;
            margin: 0;
            padding: 0;
        }

        .wf-bookmarks-list > ul {
            clear: both;
            color: var(--wf-bookmarks-white);
            overflow-x: hidden;
            overflow-y: auto;
            max-height: 580px;
        }

        .wf-bookmarks-node {
            display: block;
            overflow: hidden;
            background: var(--wf-bookmarks-bg);
        }

        .wf-bookmarks-folder {
            border-left-width: 1px;
            border-right-width: 1px;
            border-top-width: 1px;
        }

        .wf-bookmarks-row {
            display: block;
            height: 22px;
            overflow: hidden;
            background: var(--wf-bookmarks-bg);
            border-bottom-width: 1px;
        }

        .wf-bookmarks-row:hover {
            background: var(--wf-bookmarks-bg-dark);
        }

        .wf-bookmarks-folder-row {
            height: 25px;
            background: #069;
            border-bottom-width: 1px;
        }

        .wf-bookmarks-delete,
        .wf-bookmarks-folder-toggle,
        .wf-bookmarks-label {
            display: block;
            float: left;
            height: 22px;
            overflow: hidden;
            cursor: pointer;
            background: transparent;
        }

        .wf-bookmarks-folder-row .wf-bookmarks-delete,
        .wf-bookmarks-folder-row .wf-bookmarks-folder-toggle,
        .wf-bookmarks-folder-row .wf-bookmarks-label {
            height: 25px;
            line-height: 25px !important;
        }

        .wf-bookmarks-delete {
            display: none;
            width: 10%;
            text-align: center;
            color: var(--wf-bookmarks-white);
            border-right-width: 1px;
        }

        #wf-bookmarks-box.wf-bookmarks-delete-mode .wf-bookmarks-delete {
            display: block;
        }

        .wf-bookmarks-delete:hover {
            color: var(--wf-bookmarks-white);
            background: #e22 !important;
        }

        .wf-bookmarks-folder-toggle {
            width: 10%;
            text-align: center;
            color: var(--wf-bookmarks-white);
            font-size: 12px !important;
        }

        .wf-bookmarks-folder-label {
            width: 90%;
            color: var(--wf-bookmarks-white);
            text-align: left;
            padding: 0;
            font-size: 12px !important;
        }

        #wf-bookmarks-box.wf-bookmarks-delete-mode .wf-bookmarks-folder-label {
            width: 80%;
        }

        .wf-bookmarks-bookmark-label {
            width: 100%;
            padding: 0 10px 0 8px;
            color: var(--wf-bookmarks-gold);
            text-align: left;
            white-space: nowrap;
            text-overflow: ellipsis;
            background: var(--wf-bookmarks-bg);
        }

        #wf-bookmarks-box.wf-bookmarks-delete-mode .wf-bookmarks-bookmark-label {
            width: 90%;
        }

        .wf-bookmarks-folder-children {
            display: block;
            width: 100%;
            margin-left: 0;
            min-height: 0;
        }

        .wf-bookmarks-folder-children .wf-bookmarks-bookmark-row {
            width: 100%;
            padding-left: 0;
        }

        .wf-bookmarks-folder-children .wf-bookmarks-bookmark-label {
            width: 90% !important;
            margin-left: 10% !important;
        }

        .wf-bookmarks-root > .wf-bookmarks-bookmark > .wf-bookmarks-bookmark-row > .wf-bookmarks-bookmark-label {
            width: 100% !important;
            margin-left: 0 !important;
        }

        #wf-bookmarks-box.wf-bookmarks-delete-mode .wf-bookmarks-folder-children .wf-bookmarks-bookmark-label {
            width: 80% !important;
            margin-left: 0 !important;
        }

        .wf-bookmarks-folder-closed > .wf-bookmarks-folder-children {
            display: none !important;
            height: 0 !important;
            min-height: 0 !important;
        }

        .wf-bookmarks-empty-drop-row,
        .wf-bookmarks-sort-placeholder {
            display: block;
            height: 22px;
            background: var(--wf-bookmarks-bg-drop);
            border-bottom-width: 1px;
            box-shadow: inset 1px 0 0 var(--wf-bookmarks-border);
        }

        .wf-bookmarks-empty-drop-row {
            overflow: hidden;
        }

        .wf-bookmarks-sort-ghost {
            position: fixed;
            z-index: 999999;
            pointer-events: none;
            opacity: 0.95;
            border-width: 1px;
            box-shadow: 0 2px 6px rgba(0,0,0,0.35);
        }

        .wf-bookmarks-sort-ghost .wf-bookmarks-label {
            color: #03fe03;
        }

        .wf-bookmarks-sort-ghost,
        .wf-bookmarks-sort-ghost * {
            font-family: var(--wf-bookmarks-font);
            font-size: 12px !important;
            line-height: 22px !important;
        }

        .wf-bookmarks-sorting,
        .wf-bookmarks-sorting *,
        body.wf-bookmarks-window-dragging {
            cursor: move !important;
            user-select: none !important;
        }
    `;

        document.head.appendChild(style);
    }

    function boot() {
        if (state.booted) return;
        state.booted = true;

        loadData();
        injectCss();

        const ready = () => {
            setupPoiBridgeWatcher();
            setupMapRouteWatcher();
        };

        if (document.readyState === "loading") {
            document.addEventListener("DOMContentLoaded", ready, { once: true });
        } else {
            ready();
        }
    }

    boot();
})();