// ==UserScript==
// @name         Wayfarer Submission Map Mods
// @version      0.0.21
// @description  Feature enhancement for the submission map
// @namespace    https://gitlab.com/Tntnnbltn/wayfarer-addons
// @downloadURL  https://gitlab.com/Tntnnbltn/wayfarer-addons/wayfarer-submission-map-mods.user.js
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
// <https://github.com/tehstone/wayfarer-addons/blob/main/LICENSE>
// If not, see <https://www.gnu.org/licenses/>.


(function() {

    let submitMap = null;
    let poiInfoWindow = null;
    let markersByGuid = {};
    let poiRadiusCircle = null;
    let lastFetchLat = null;
    let lastFetchLng = null;
    let radius = 200;
    let poiMovementThreshold = radius * 0.25;
    let s2Overlay = null;
    let darkMode = false;
    let mapTypeListenerBound = false;
    let latLngObserver = null;
    let latLngTargetEl = null;
    let mapClickCloseBound = false;
    let Crosshair = null;
    let crosshair = null;
    let CenterPinOverlay = null;
    let centerPinOverlay = null;

    // Debug tool - change to true to enable
    let enableCrosshairs = false;

    const MAP_MODE = {
        MOBILE: "mobile",
        DESKTOP: "desktop"
    };

    let currentMapMode = null;

    // Initialize default settings
    let userSettings = {
        poi: {
            markerType: "thumbnail",

            thumbnail: {
                borderColor: "#ffffff",
                borderWidth: 3,
                borderOpacity: 0.7
            },

            generic: {
                borderColor: "#ff6600",
                borderWidth: 2,
                borderOpacity: 1.0,
                fillColor: "#ff6600",
                fillOpacity: 0.5
            }
        },
        s2: {
            primary: {
                enabled: true,
                level: 17,
                color: "#00B303",
                lineWidth: 1,
                lineOpacity: 1.0
            },
            secondary: {
                enabled: true,
                level: 14,
                color: "#FF0000",
                lineWidth: 2,
                lineOpacity: 1.0
            }
        },
        map: {
            defaultType: "roadmap",
            rememberLastView: true,
        }
    };

    loadUserSettings();
    injectMarkerCss();

    function init() {
        injectMarkerCss();
        initLatLngElementWatcher();
        getSubmitMap();
        initUploadExifWatcher();
        initWayspotImageEntryWatcher();
        initMapModeWatcher();
    }

    (function (open) {
        XMLHttpRequest.prototype.open = function (method, url) {
            if (url == '/api/v1/vault/settings') {
                if (method == 'GET') {
                    this.addEventListener('load', interceptSettings, false);
                }
            } else if (url == '/api/v1/vault/properties') {
                if (method == 'GET') {
                    this.addEventListener('load', interceptProperties, false);
                }
            }
            open.apply(this, arguments);
        };
    })(XMLHttpRequest.prototype.open);

    function interceptProperties() {
        try {
            const response = this.response;
            const json = JSON.parse(response);
            if (!json) return;
            if (!json.result || !json.result.darkMode) return;

            const darkModeSetting = json.result.darkMode
            if (darkModeSetting === "DISABLED") {
                darkMode = false;
            } else {
                darkMode = true;
            }
        } catch (e) {
            console.error(e);
        }
    }

    function interceptSettings() {
        try {
            const response = this.response;
            const json = JSON.parse(response);
            if (!json) return;

            modifySettingsPage();
        } catch (e) {
            console.error(e);
        }
    }

    const awaitElement = get => new Promise((resolve, reject) => {
        let triesLeft = 10;
        const queryLoop = () => {
            const ref = get();
            if (ref) resolve(ref);
            else if (!triesLeft) reject();
            else setTimeout(queryLoop, 100);
            triesLeft--;
        }
        queryLoop();
    });

    function modifySettingsPage() {
        return new Promise(async (resolve, reject) => {
            try {
                const settingsItem = await awaitElement(() => document.querySelector('.settings__item'));
                const parentDiv = settingsItem.parentElement;

                const newSettingsItem = document.createElement('div');
                newSettingsItem.classList.add('settings__item', 'settings-item');

                const headerDiv = document.createElement('div');
                headerDiv.classList.add('settings-item__header');
                headerDiv.textContent = 'Submission Map Mods Plug-In';
                headerDiv.style.cursor = "pointer";
                headerDiv.style.userSelect = "none";

                // Toggle label
                const toggleLabel = document.createElement('span');
                toggleLabel.textContent = " (click to show options)";
                toggleLabel.style.fontSize = "12px";
                toggleLabel.style.opacity = "0.7";
                headerDiv.appendChild(toggleLabel);

                const valueDiv = document.createElement('div');
                valueDiv.classList.add('settings-item__value');

                const descriptionDiv = document.createElement('div');
                descriptionDiv.classList.add('settings-item__description');


                // -----------------------
                // MAP BEHAVIOUR SETTINGS
                // -----------------------
                const mapHeader = document.createElement('div');
                mapHeader.textContent = 'Map behaviour';
                mapHeader.style.fontWeight = '600';
                mapHeader.style.margin = '12px 0 6px 0';
                mapHeader.style.fontWeight = "600";
                mapHeader.style.fontSize = "16px";
                mapHeader.style.marginBottom = "10px";

                const mapDescription = document.createElement('div');
                mapDescription.textContent = 'Choose whether the submission map should restore to your last viewed location.';
                mapDescription.style.marginBottom = '8px';
                mapDescription.style.fontSize = '12px';
                mapDescription.style.opacity = '0.8';

                // Checkbox row
                const mapRow = document.createElement('label');
                mapRow.style.display = 'flex';
                mapRow.style.alignItems = 'center';
                mapRow.style.gap = '8px';
                mapRow.style.fontSize = '13px';

                const rememberCheckbox = document.createElement('input');
                rememberCheckbox.type = 'checkbox';
                rememberCheckbox.checked = !!(userSettings.map && userSettings.map.rememberLastView);

                if (darkMode) {
                    rememberCheckbox.style.accentColor = '#f97316'; // orange, optional
                }

                rememberCheckbox.addEventListener('change', () => {
                    if (!userSettings.map) userSettings.map = {};
                    userSettings.map.rememberLastView = rememberCheckbox.checked;
                    saveUserSettings();
                });

                const rememberLabelText = document.createElement('span');
                rememberLabelText.textContent = 'Remember last map view (center + zoom)';

                mapRow.appendChild(rememberCheckbox);
                mapRow.appendChild(rememberLabelText);

                descriptionDiv.appendChild(mapHeader);
                descriptionDiv.appendChild(mapDescription);
                descriptionDiv.appendChild(mapRow);


                // -----------------------
                // POI MARKER SETTINGS
                // -----------------------
                const poiHeader = document.createElement('div');
                poiHeader.textContent = 'POI markers';
                poiHeader.style.fontWeight = '600';
                poiHeader.style.marginBottom = '10px';
                poiHeader.style.marginTop = '25px';
                poiHeader.style.fontSize = "16px";

                const poiDescription = document.createElement('div');
                poiDescription.textContent = 'How would you like POIs to appear on the submission map?';
                poiDescription.style.marginBottom = '8px';
                poiDescription.style.fontSize = '12px';
                poiDescription.style.opacity = '0.8';

                // Marker type dropdown
                const typeRow = document.createElement('div');
                typeRow.style.display = 'flex';
                typeRow.style.alignItems = 'center';
                typeRow.style.gap = '8px';
                typeRow.style.marginBottom = '8px';

                const typeLabel = document.createElement('span');
                typeLabel.textContent = 'Marker type:';

                const markerTypeSelect = document.createElement('select');
                markerTypeSelect.style.padding = '2px 4px';
                markerTypeSelect.style.fontSize = '13px';

                if (darkMode) {
                    markerTypeSelect.style.color = '#000';
                    markerTypeSelect.style.backgroundColor = '#fff';
                }

                const optThumbnail = document.createElement('option');
                optThumbnail.value = 'thumbnail';
                optThumbnail.textContent = 'Thumbnail';

                const optGeneric = document.createElement('option');
                optGeneric.value = 'generic';
                optGeneric.textContent = 'Generic marker';

                markerTypeSelect.appendChild(optThumbnail);
                markerTypeSelect.appendChild(optGeneric);

                markerTypeSelect.value = userSettings.poi.markerType || 'thumbnail';

                markerTypeSelect.addEventListener('change', () => {
                    userSettings.poi.markerType = markerTypeSelect.value;
                    saveUserSettings();
                    updateMarkerOptionsVisibility();
                });

                typeRow.appendChild(typeLabel);
                typeRow.appendChild(markerTypeSelect);

                // Thumbnail options container
                const thumbnailOptionsDiv = document.createElement('div');
                thumbnailOptionsDiv.style.marginLeft = '20px';
                thumbnailOptionsDiv.style.marginBottom = '10px';

                const thumbTitle = document.createElement('div');
                thumbTitle.textContent = 'Thumbnail marker border';
                thumbTitle.style.fontSize = '12px';
                thumbTitle.style.opacity = '0.85';
                thumbTitle.style.marginBottom = '4px';

                // Thumbnail border color
                const thumbBorderColorLabel = document.createElement('label');
                thumbBorderColorLabel.style.display = 'flex';
                thumbBorderColorLabel.style.alignItems = 'center';
                thumbBorderColorLabel.style.gap = '6px';
                thumbBorderColorLabel.style.marginBottom = '4px';

                const thumbBorderColorInput = document.createElement('input');
                thumbBorderColorInput.type = 'color';
                thumbBorderColorInput.value = userSettings.poi.thumbnail.borderColor;
                thumbBorderColorInput.addEventListener('input', () => {
                    userSettings.poi.thumbnail.borderColor = thumbBorderColorInput.value;
                    saveUserSettings();
                    injectMarkerCss();
                });

                const thumbBorderColorText = document.createElement('span');
                thumbBorderColorText.textContent = 'Border colour';

                thumbBorderColorLabel.appendChild(thumbBorderColorInput);
                thumbBorderColorLabel.appendChild(thumbBorderColorText);

                // Thumbnail border width
                const thumbBorderWidthLabel = document.createElement('label');
                thumbBorderWidthLabel.style.display = 'flex';
                thumbBorderWidthLabel.style.alignItems = 'center';
                thumbBorderWidthLabel.style.gap = '6px';
                thumbBorderWidthLabel.style.marginBottom = '4px';

                const thumbBorderWidthInput = document.createElement('input');
                thumbBorderWidthInput.type = 'number';
                thumbBorderWidthInput.min = '0';
                thumbBorderWidthInput.max = '10';
                thumbBorderWidthInput.step = '1';
                thumbBorderWidthInput.style.width = '60px';
                thumbBorderWidthInput.value = userSettings.poi.thumbnail.borderWidth;

                if (darkMode) {
                    thumbBorderWidthInput.style.color = '#000';
                    thumbBorderWidthInput.style.backgroundColor = '#fff';
                }

                thumbBorderWidthInput.addEventListener('change', () => {
                    let val = parseInt(thumbBorderWidthInput.value, 10);
                    if (isNaN(val)) val = 2;
                    if (val < 0) val = 0;
                    if (val > 10) val = 10;
                    userSettings.poi.thumbnail.borderWidth = val;
                    thumbBorderWidthInput.value = val;
                    saveUserSettings();
                    injectMarkerCss();
                });

                const thumbBorderWidthText = document.createElement('span');
                thumbBorderWidthText.textContent = 'Border stroke (px)';

                thumbBorderWidthLabel.appendChild(thumbBorderWidthInput);
                thumbBorderWidthLabel.appendChild(thumbBorderWidthText);

                // Thumbnail border opacity
                const thumbBorderOpacityLabel = document.createElement('label');
                thumbBorderOpacityLabel.style.display = 'flex';
                thumbBorderOpacityLabel.style.alignItems = 'center';
                thumbBorderOpacityLabel.style.gap = '6px';

                const thumbBorderOpacityInput = document.createElement('input');
                thumbBorderOpacityInput.type = 'number';
                thumbBorderOpacityInput.min = '0';
                thumbBorderOpacityInput.max = '1';
                thumbBorderOpacityInput.step = '0.1';
                thumbBorderOpacityInput.style.width = '60px';
                thumbBorderOpacityInput.value = userSettings.poi.thumbnail.borderOpacity;

                if (darkMode) {
                    thumbBorderOpacityInput.style.color = '#000';
                    thumbBorderOpacityInput.style.backgroundColor = '#fff';
                }

                thumbBorderOpacityInput.addEventListener('change', () => {
                    let val = parseFloat(thumbBorderOpacityInput.value);
                    if (isNaN(val)) val = 1.0;
                    if (val < 0) val = 0;
                    if (val > 1) val = 1;
                    userSettings.poi.thumbnail.borderOpacity = val;
                    thumbBorderOpacityInput.value = val;
                    saveUserSettings();
                    injectMarkerCss();
                });

                const thumbBorderOpacityText = document.createElement('span');
                thumbBorderOpacityText.textContent = 'Border opacity (0–1)';

                thumbBorderOpacityLabel.appendChild(thumbBorderOpacityInput);
                thumbBorderOpacityLabel.appendChild(thumbBorderOpacityText);

                thumbnailOptionsDiv.appendChild(thumbTitle);
                thumbnailOptionsDiv.appendChild(thumbBorderColorLabel);
                thumbnailOptionsDiv.appendChild(thumbBorderWidthLabel);
                thumbnailOptionsDiv.appendChild(thumbBorderOpacityLabel);

                // Generic marker options container
                const genericOptionsDiv = document.createElement('div');
                genericOptionsDiv.style.marginLeft = '20px';
                genericOptionsDiv.style.marginBottom = '10px';

                const genericTitle = document.createElement('div');
                genericTitle.textContent = 'Generic marker style';
                genericTitle.style.fontSize = '12px';
                genericTitle.style.opacity = '0.85';
                genericTitle.style.marginBottom = '4px';

                // Generic border color
                const genBorderColorLabel = document.createElement('label');
                genBorderColorLabel.style.display = 'flex';
                genBorderColorLabel.style.alignItems = 'center';
                genBorderColorLabel.style.gap = '6px';
                genBorderColorLabel.style.marginBottom = '4px';

                const genBorderColorInput = document.createElement('input');
                genBorderColorInput.type = 'color';
                genBorderColorInput.value = userSettings.poi.generic.borderColor;
                genBorderColorInput.addEventListener('input', () => {
                    userSettings.poi.generic.borderColor = genBorderColorInput.value;
                    saveUserSettings();
                });

                const genBorderColorText = document.createElement('span');
                genBorderColorText.textContent = 'Border colour';

                genBorderColorLabel.appendChild(genBorderColorInput);
                genBorderColorLabel.appendChild(genBorderColorText);

                // Generic border width
                const genBorderWidthLabel = document.createElement('label');
                genBorderWidthLabel.style.display = 'flex';
                genBorderWidthLabel.style.alignItems = 'center';
                genBorderWidthLabel.style.gap = '6px';
                genBorderWidthLabel.style.marginBottom = '4px';

                const genBorderWidthInput = document.createElement('input');
                genBorderWidthInput.type = 'number';
                genBorderWidthInput.min = '0';
                genBorderWidthInput.max = '10';
                genBorderWidthInput.step = '1';
                genBorderWidthInput.style.width = '60px';
                genBorderWidthInput.value = userSettings.poi.generic.borderWidth;

                if (darkMode) {
                    genBorderWidthInput.style.color = '#000';
                    genBorderWidthInput.style.backgroundColor = '#fff';
                }

                genBorderWidthInput.addEventListener('change', () => {
                    let val = parseInt(genBorderWidthInput.value, 10);
                    if (isNaN(val)) val = 2;
                    if (val < 0) val = 0;
                    if (val > 10) val = 10;
                    userSettings.poi.generic.borderWidth = val;
                    genBorderWidthInput.value = val;
                    saveUserSettings();
                });

                const genBorderWidthText = document.createElement('span');
                genBorderWidthText.textContent = 'Border stroke (px)';

                genBorderWidthLabel.appendChild(genBorderWidthInput);
                genBorderWidthLabel.appendChild(genBorderWidthText);

                // Generic border opacity
                const genBorderOpacityLabel = document.createElement('label');
                genBorderOpacityLabel.style.display = 'flex';
                genBorderOpacityLabel.style.alignItems = 'center';
                genBorderOpacityLabel.style.gap = '6px';
                genBorderOpacityLabel.style.marginBottom = '4px';

                const genBorderOpacityInput = document.createElement('input');
                genBorderOpacityInput.type = 'number';
                genBorderOpacityInput.min = '0';
                genBorderOpacityInput.max = '1';
                genBorderOpacityInput.step = '0.1';
                genBorderOpacityInput.style.width = '60px';
                genBorderOpacityInput.value = userSettings.poi.generic.borderOpacity;

                if (darkMode) {
                    genBorderOpacityInput.style.color = '#000';
                    genBorderOpacityInput.style.backgroundColor = '#fff';
                }

                genBorderOpacityInput.addEventListener('change', () => {
                    let val = parseFloat(genBorderOpacityInput.value);
                    if (isNaN(val)) val = 1.0;
                    if (val < 0) val = 0;
                    if (val > 1) val = 1;
                    userSettings.poi.generic.borderOpacity = val;
                    genBorderOpacityInput.value = val;
                    saveUserSettings();
                });

                const genBorderOpacityText = document.createElement('span');
                genBorderOpacityText.textContent = 'Border opacity (0–1)';

                genBorderOpacityLabel.appendChild(genBorderOpacityInput);
                genBorderOpacityLabel.appendChild(genBorderOpacityText);

                // Generic fill color
                const genFillColorLabel = document.createElement('label');
                genFillColorLabel.style.display = 'flex';
                genFillColorLabel.style.alignItems = 'center';
                genFillColorLabel.style.gap = '6px';
                genFillColorLabel.style.marginBottom = '4px';

                const genFillColorInput = document.createElement('input');
                genFillColorInput.type = 'color';
                genFillColorInput.value = userSettings.poi.generic.fillColor;
                genFillColorInput.addEventListener('input', () => {
                    userSettings.poi.generic.fillColor = genFillColorInput.value;
                    saveUserSettings();
                });

                const genFillColorText = document.createElement('span');
                genFillColorText.textContent = 'Fill colour';

                genFillColorLabel.appendChild(genFillColorInput);
                genFillColorLabel.appendChild(genFillColorText);

                // Generic fill opacity
                const genFillOpacityLabel = document.createElement('label');
                genFillOpacityLabel.style.display = 'flex';
                genFillOpacityLabel.style.alignItems = 'center';
                genFillOpacityLabel.style.gap = '6px';

                const genFillOpacityInput = document.createElement('input');
                genFillOpacityInput.type = 'number';
                genFillOpacityInput.min = '0';
                genFillOpacityInput.max = '1';
                genFillOpacityInput.step = '0.1';
                genFillOpacityInput.style.width = '60px';
                genFillOpacityInput.value = userSettings.poi.generic.fillOpacity;

                if (darkMode) {
                    genFillOpacityInput.style.color = '#000';
                    genFillOpacityInput.style.backgroundColor = '#fff';
                }

                genFillOpacityInput.addEventListener('change', () => {
                    let val = parseFloat(genFillOpacityInput.value);
                    if (isNaN(val)) val = 0.5;
                    if (val < 0) val = 0;
                    if (val > 1) val = 1;
                    userSettings.poi.generic.fillOpacity = val;
                    genFillOpacityInput.value = val;
                    saveUserSettings();
                });

                const genFillOpacityText = document.createElement('span');
                genFillOpacityText.textContent = 'Fill opacity (0–1)';

                genFillOpacityLabel.appendChild(genFillOpacityInput);
                genFillOpacityLabel.appendChild(genFillOpacityText);

                genericOptionsDiv.appendChild(genericTitle);
                genericOptionsDiv.appendChild(genBorderColorLabel);
                genericOptionsDiv.appendChild(genBorderWidthLabel);
                genericOptionsDiv.appendChild(genBorderOpacityLabel);
                genericOptionsDiv.appendChild(genFillColorLabel);
                genericOptionsDiv.appendChild(genFillOpacityLabel);

                // Helper to show/hide sections based on marker type
                function updateMarkerOptionsVisibility() {
                    const type = userSettings.poi.markerType || 'thumbnail';
                    thumbnailOptionsDiv.style.display = (type === 'thumbnail') ? 'block' : 'none';
                    genericOptionsDiv.style.display = (type === 'generic') ? 'block' : 'none';
                }

                updateMarkerOptionsVisibility();

                // -----------------------
                // ADD MARKER UI TO BLOCK
                // -----------------------
                descriptionDiv.appendChild(poiHeader);
                descriptionDiv.appendChild(poiDescription);
                descriptionDiv.appendChild(typeRow);
                descriptionDiv.appendChild(thumbnailOptionsDiv);
                descriptionDiv.appendChild(genericOptionsDiv);

                // -----------------------
                // S2 GRID SETTINGS (TABLE)
                // -----------------------
                const s2Header = document.createElement('div');
                s2Header.textContent = 'S2 Grid';
                s2Header.style.fontWeight = '600';
                s2Header.style.marginBottom = '10px';
                s2Header.style.marginTop = '25px';
                s2Header.style.fontSize = "16px";

                const s2Description = document.createElement('div');
                s2Description.textContent = 'Configure the S2 grid overlays for the submission map.';
                s2Description.style.marginBottom = '8px';
                s2Description.style.fontSize = '12px';
                s2Description.style.opacity = '0.8';

                // Create table
                const table = document.createElement('table');
                table.style.width = '100%';
                table.style.borderCollapse = 'collapse';
                table.style.marginTop = '10px';
                table.style.fontSize = '13px';

                function makeCell(content) {
                    const td = document.createElement('td');
                    td.style.padding = '6px 4px';
                    td.style.verticalAlign = 'middle';
                    td.appendChild(content);
                    return td;
                }

                function makeHeader(text) {
                    const th = document.createElement('th');
                    th.textContent = text;
                    th.style.fontWeight = '600';
                    th.style.padding = '6px';
                    th.style.borderBottom = '1px solid #ccc';
                    th.style.textAlign = 'center';
                    return th;
                }

                // Table header row
                const headerRow = document.createElement('tr');
                headerRow.appendChild(document.createElement('th')); // blank corner cell
                headerRow.appendChild(makeHeader('Primary Grid'));
                headerRow.appendChild(makeHeader('Secondary Grid'));
                table.appendChild(headerRow);

                // Convenience function to create number inputs
                function makeNumberInput(settingsObj, key, min, max, step) {
                    const input = document.createElement('input');
                    input.type = 'number';
                    input.style.width = '70px';
                    input.value = settingsObj[key];
                    input.min = min;
                    input.max = max;
                    input.step = step;

                    if (darkMode) {
                        input.style.color = '#000';
                        input.style.backgroundColor = '#fff';
                    }

                    input.addEventListener('change', () => {
                        let val = parseFloat(input.value);
                        if (isNaN(val)) val = min;
                        if (val < min) val = min;
                        if (val > max) val = max;
                        settingsObj[key] = val;
                        input.value = val;
                        saveUserSettings();
                    });
                    return input;
                }

                // Convenience function to create colour inputs
                function makeColorInput(settingsObj, key) {
                    const input = document.createElement('input');
                    input.type = 'color';
                    input.value = settingsObj[key];
                    input.addEventListener('input', () => {
                        settingsObj[key] = input.value;
                        saveUserSettings();
                    });
                    return input;
                }

                // Convenience function to create toggle checkbox
                function makeToggle(settingsObj) {
                    const box = document.createElement('input');
                    box.type = 'checkbox';
                    box.checked = settingsObj.enabled;
                    box.addEventListener('change', () => {
                        settingsObj.enabled = box.checked;
                        saveUserSettings();
                    });
                    return box;
                }

                // ROW: Enabled toggle
                const rowEnabled = document.createElement('tr');
                rowEnabled.appendChild(makeHeader("Enabled"));

                rowEnabled.appendChild(makeCell(makeToggle(userSettings.s2.primary)));
                rowEnabled.appendChild(makeCell(makeToggle(userSettings.s2.secondary)));
                table.appendChild(rowEnabled);

                // ROW: S2 Level
                const rowLevel = document.createElement('tr');
                rowLevel.appendChild(makeHeader("S2 Level"));

                rowLevel.appendChild(makeCell(makeNumberInput(userSettings.s2.primary, "level", 0, 30, 1)));
                rowLevel.appendChild(makeCell(makeNumberInput(userSettings.s2.secondary, "level", 0, 30, 1)));
                table.appendChild(rowLevel);

                // ROW: Line colour
                const rowColor = document.createElement('tr');
                rowColor.appendChild(makeHeader("Line colour"));

                rowColor.appendChild(makeCell(makeColorInput(userSettings.s2.primary, "color")));
                rowColor.appendChild(makeCell(makeColorInput(userSettings.s2.secondary, "color")));
                table.appendChild(rowColor);

                // ROW: Line width
                const rowWidth = document.createElement('tr');
                rowWidth.appendChild(makeHeader("Line width"));

                rowWidth.appendChild(makeCell(makeNumberInput(userSettings.s2.primary, "lineWidth", 1, 10, 1)));
                rowWidth.appendChild(makeCell(makeNumberInput(userSettings.s2.secondary, "lineWidth", 1, 10, 1)));
                table.appendChild(rowWidth);

                // ROW: Line opacity
                const rowOpacity = document.createElement('tr');
                rowOpacity.appendChild(makeHeader("Line opacity"));

                rowOpacity.appendChild(makeCell(makeNumberInput(userSettings.s2.primary, "lineOpacity", 0, 1, 0.1)));
                rowOpacity.appendChild(makeCell(makeNumberInput(userSettings.s2.secondary, "lineOpacity", 0, 1, 0.1)));
                table.appendChild(rowOpacity);

                // Append to settings UI
                descriptionDiv.appendChild(s2Header);
                descriptionDiv.appendChild(s2Description);
                descriptionDiv.appendChild(table);

                table.querySelectorAll("td").forEach(td => td.style.textAlign = "center");
                table.querySelectorAll("input").forEach(input => input.style.textAlign = "center");

                newSettingsItem.appendChild(headerDiv);
                newSettingsItem.appendChild(valueDiv);
                newSettingsItem.appendChild(descriptionDiv);

                parentDiv.appendChild(newSettingsItem);
                if (parentDiv.children.length >= 4) {
                    parentDiv.insertBefore(newSettingsItem, parentDiv.children[3]);
                }

                // Start with options hidden
                descriptionDiv.style.display = "none";

                // Toggle behaviour
                headerDiv.addEventListener("click", () => {
                    const isHidden = descriptionDiv.style.display === "none";
                    descriptionDiv.style.display = isHidden ? "block" : "none";
                    toggleLabel.textContent = isHidden
                        ? " (click to hide options)"
                    : " (click to show options)";
                });

                resolve();
            } catch (error) {
                console.error('Error modifying settings page:', error);
                reject(error);
            }
        });
    }

    function saveUserSettings() {
        try {
            localStorage.setItem('wfsmm-settings', JSON.stringify(userSettings));
        } catch (e) {
            console.error("Failed to save settings:", e);
        }
    }

    function mergeDeep(target, source) {
        for (const key in source) {
            if (
                typeof source[key] === 'object' &&
                source[key] !== null &&
                !Array.isArray(source[key])
            ) {
                if (!target[key]) target[key] = {};
                mergeDeep(target[key], source[key]);
            } else {
                target[key] = source[key];
            }
        }
    }

    function loadUserSettings() {
        try {
            const saved = localStorage.getItem('wfsmm-settings');
            if (!saved) {
                return;
            }

            const parsed = JSON.parse(saved);
            mergeDeep(userSettings, parsed);

        } catch (e) {
            console.error("Failed to load settings, using defaults:", e);
        }
    }

    function detectMapMode() {
        // 1) Mobile-style centre pin overlay
        const mobilePin = document.querySelector(
            '.center-pin-container .center-pin[src*="map_selection_pin.svg"]'
        );
        if (mobilePin) {
            return MAP_MODE.MOBILE;
        }

        // 2) Desktop-style Google Maps marker wrapper
        const desktopPin = Array.from(
            document.querySelectorAll('.gm-style img[src*="map_selection_pin.svg"]')
        ).find(img => {
            const wrapper = img.closest('div[style*="width: 36px"][style*="height: 56px"]');
            if (!wrapper) return false;

            // z-index isn't guaranteed to be exactly 1000 forever,
            // but a high z-index strongly indicates the desktop marker
            const z = parseInt(wrapper.style.zIndex || "0", 10);
            return z >= 900;
        });

        if (desktopPin) {
            return MAP_MODE.DESKTOP;
        }

        // Unknown / not initialised
        return null;
    }

    const updateMode = () => {
        const newMode = detectMapMode();
        if (!newMode || newMode === currentMapMode) return;

        const oldMode = currentMapMode;
        currentMapMode = newMode;
        window.wfsmmMapMode = newMode;
        console.info("WFSMM: Map mode changed to", oldMode, "→", newMode);

        // If entering MOBILE mode, recenter map on current lat/lng
        // This is to prevent misalignment between coordinates and pin
        if (newMode === MAP_MODE.MOBILE) {
            hideNativeCenterPin();
            ensureCenterPinOverlay();

            if (submitMap &&
                typeof window.currentLat === "number" &&
                typeof window.currentLng === "number") {

                const latLng = new google.maps.LatLng(window.currentLat, window.currentLng);
                submitMap.setCenter(latLng);
            }
        }

        // If leaving MOBILE mode → DESKTOP
        if (newMode === MAP_MODE.DESKTOP) {
            removeCenterPinOverlay();
        }
    };

    function initMapModeWatcher() {
        const updateMode = () => {
            const newMode = detectMapMode();
            if (!newMode || newMode === currentMapMode) return;

            const oldMode = currentMapMode;
            currentMapMode = newMode;
            window.wfsmmMapMode = newMode;

            if (newMode === MAP_MODE.MOBILE) {
                // Hide Niantic's overlay and use our own
                hideNativeCenterPin();
                ensureCenterPinOverlay();

                // Try to recenter on the current submission coordinates
                recenterMapOnCurrentSubmission();
            } else if (newMode === MAP_MODE.DESKTOP) {
                // Remove our mobile overlay in desktop mode
                removeCenterPinOverlay();
            }
        };

        const observer = new MutationObserver((mutations) => {
            let centerPinTouched = false;

            for (const m of mutations) {
                for (const node of m.addedNodes) {
                    if (!(node instanceof HTMLElement)) continue;

                    if (node.matches(".center-pin-container") ||
                        (node.querySelector && node.querySelector(".center-pin-container"))) {
                        centerPinTouched = true;
                    }
                }
            }

            updateMode();

            // If we’re in mobile mode and Niantic recreates the overlay, hide it again
            if (centerPinTouched && currentMapMode === MAP_MODE.MOBILE) {
                hideNativeCenterPin();
                ensureCenterPinOverlay();
            }
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true
        });

        window.addEventListener("resize", updateMode);

        // Initial pass
        updateMode();
    }

    function recenterMapOnCurrentSubmission() {
        if (!submitMap || typeof google === "undefined" || !google.maps) {
            console.info("WFSMM: recenter skipped – map not ready");
            return;
        }

        if (typeof window.currentLat !== "number" || typeof window.currentLng !== "number") {
            console.info(
                "WFSMM: recenter skipped – currentLat/currentLng not set",
                window.currentLat,
                window.currentLng
            );
            return;
        }

        const latLng = new google.maps.LatLng(window.currentLat, window.currentLng);

        submitMap.setCenter(latLng);

        // Keep Wayfarer’s internal state in sync
        google.maps.event.trigger(submitMap, "click", { latLng });
    }

    function hideNativeCenterPin() {
        const pinContainer = document.querySelector(".center-pin-container");
        if (!pinContainer) return;

        pinContainer.style.setProperty("display", "none", "important");
    }

    function initUploadExifWatcher() {
        const intervalMs = 1000;

        const scan = () => {
            const sections = document.querySelectorAll('div.section');

            sections.forEach(section => {
                const h4 = section.querySelector('h4 span.step-number');
                if (!h4) return;

                const stepNum = h4.textContent.trim();

                // Only add event listening to the "Step 1" (Wayspot Photo) button
                // This is to avoid supporting photo exif overwriting main photo
                if (stepNum !== "1") return;

                const container = section.querySelector('app-wayspot-image-entry .image-entry-container');
                if (!container) return;

                if (!container._wfsmmClickHooked) {
                    container._wfsmmClickHooked = true;

                    container.addEventListener("click", () => {
                        let attempts = 0;
                        const maxAttempts = 60;

                        const findInput = () => {
                            attempts++;
                            const input = document.querySelector("#file-input");

                            if (input) {
                                attachExifListenerToFileInput(input);
                                return;
                            }

                            if (attempts < maxAttempts) {
                                setTimeout(findInput, 500);
                            } else {
                                console.warn("WFSMM: #file-input not found (Section 1) after all attempts");
                            }
                        };

                        findInput();
                    });
                }
            });

            setTimeout(scan, intervalMs);
        };

        scan();
    }

    function attachExifListenerToFileInput(input) {
        if (!input) return;
        if (input._wfsmmExifHooked) return;
        input._wfsmmExifHooked = true;

        input.addEventListener('change', async (e) => {
            const files = e.target.files;
            if (!files || !files.length) return;

            const file = files[0];

            const type = file.type || "";
            const name = file.name || "";

            const gps = await extractGpsFromFileOrBuffer(file);
            if (!gps) {
                console.info("WFSMM: No GPS EXIF data found in selected image (or not supported).");
                return;
            }

            console.info("WFSMM: EXIF GPS found:", gps.lat, gps.lng);
            moveMapToExifCoords(gps.lat, gps.lng);
        });
    }

    async function extractGpsFromFileOrBuffer(fileOrBuffer) {
        if (typeof exifr === "undefined" || !exifr.gps) {
            console.warn("WFSMM: exifr library not available");
            return null;
        }

        try {
            // exifr can take File, Blob, ArrayBuffer, etc.
            const gps = await exifr.gps(fileOrBuffer);

            // gps is usually { latitude, longitude, altitude, ... }
            if (!gps || gps.latitude == null || gps.longitude == null) {
                return null;
            }

            return {
                lat: gps.latitude,
                lng: gps.longitude
            };
        } catch (e) {
            console.warn("WFSMM: Failed to read EXIF with exifr:", e);
            return null;
        }
    }

    function moveMapToExifCoords(lat, lng) {
        if (!submitMap || typeof google === "undefined" || !google.maps) return;

        const latLng = new google.maps.LatLng(lat, lng);

        // Center the map
        submitMap.setCenter(latLng);

        // Trigger Wayfarer’s own handler so the pin + address update
        google.maps.event.trigger(submitMap, "click", { latLng });
    }

    function initLatLngObserver() {
        // Find the coordinates from the lat,lng displayed above the map
        const el = findLatLngDiv();
        if (!el) {
            return;
        }

        // If we're already observing this exact element, do nothing
        if (latLngTargetEl === el && latLngObserver) {
            return;
        }

        // If we had an old observer, disconnect it
        if (latLngObserver) {
            latLngObserver.disconnect();
            latLngObserver = null;
        }

        latLngTargetEl = el;

        let lastText = el.textContent.trim();
        const initialCoords = parseLatLng(lastText);

        if (initialCoords) {
            window.currentLat = initialCoords.lat;
            window.currentLng = initialCoords.lng;
            updateCrosshairFromCurrentLatLng();
            requestPoisAndRefreshMap(initialCoords.lat, initialCoords.lng);
        }

        // Check for when the coordinates change, i.e. marker is moved
        latLngObserver = new MutationObserver(() => {
            // If this element got detached, bail; the watcher below will re-init on a new one
            if (!document.body.contains(el)) {
                if (latLngObserver) {
                    latLngObserver.disconnect();
                    latLngObserver = null;
                }
                return;
            }

            const newText = el.textContent.trim();
            if (newText === lastText) return;
            lastText = newText;

            const coords = parseLatLng(newText);
            if (!coords) return;

            handleLatLngChange(coords.lat, coords.lng);
        });

        latLngObserver.observe(el, {
            childList: true,
            subtree: true,
            characterData: true
        });
    }

    function initLatLngElementWatcher() {
        const bodyObserver = new MutationObserver(() => {
            const el = findLatLngDiv();

            // If we find a lat/lng element that's different from our current target,
            // re-run initLatLngObserver to attach to it.
            if (el && el !== latLngTargetEl) {
                initLatLngObserver();
            }
        });

        bodyObserver.observe(document.body, {
            childList: true,
            subtree: true
        });

        // Also attempt initial attach in case map is already there
        initLatLngObserver();
    }

    function handleLatLngChange(newLat, newLng) {
        window.currentLat = newLat;
        window.currentLng = newLng;

        updateCrosshairFromCurrentLatLng();

        // Marker must move a certain distance before loading new POIs
        // Defaults to 25% of POI radius (i.e. 50 metres)
        // Prevents spamming calls to server for minor pin movements
        const dist = distanceMeters(lastFetchLat, lastFetchLng, newLat, newLng);
        if (dist > poiMovementThreshold) {
            requestPoisAndRefreshMap(newLat, newLng);
        }
    }

    function requestPoisAndRefreshMap(lat, lng) {
        // Update coordinates for last fetched data
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
        const markerType = userSettings.poi.markerType || 'thumbnail';

        // Thumbnail marker (image-based)
        if (markerType === 'thumbnail') {
            const size = 36; // fixed for now; can be a setting later if you want
            const iconUrl = poi.imageUrl + "=s36-c";

            const marker = new google.maps.Marker({
                position: { lat: poi.lat, lng: poi.lng },
                map: submitMap,
                title: poi.title,
                icon: {
                    url: iconUrl,
                    scaledSize: new google.maps.Size(size, size),
                    anchor: new google.maps.Point(size / 2, size / 2)
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

        // Generic marker (simple circle) – uses generic border/fill settings
        const g = userSettings.poi.generic;
        const marker = new google.maps.Marker({
            position: { lat: poi.lat, lng: poi.lng },
            map: submitMap,
            title: poi.title,
            icon: {
                path: google.maps.SymbolPath.CIRCLE,
                strokeColor: g.borderColor,
                strokeOpacity: g.borderOpacity,
                strokeWeight: g.borderWidth,
                fillColor: g.fillColor,
                fillOpacity: g.fillOpacity,
                scale: 8 // tweak if you want bigger/smaller circle
            }
        });

        marker.addListener("click", () => {
            poiInfoWindow.setContent(createOverlay(poi));
            poiInfoWindow.open({
                map: submitMap,
                anchor: marker
            });

            // Attach copy handler once the InfoWindow's DOM is ready
            google.maps.event.addListenerOnce(poiInfoWindow, "domready", () => {
                // ---- Copy Coordinates ----
                const coordEl = document.querySelector(".wf-copy-coords");
                if (coordEl) {
                    coordEl.addEventListener("click", () => {
                        const lat = coordEl.getAttribute("data-lat");
                        const lng = coordEl.getAttribute("data-lng");
                        const coords = `${lat}, ${lng}`;

                        if (navigator.clipboard?.writeText) {
                            navigator.clipboard.writeText(coords).catch(err =>
                                                                        console.error("Clipboard copy failed:", err)
                                                                       );
                        } else {
                            window.prompt("Copy to clipboard:", coords);
                        }
                    });
                }

                // ---- Copy Title ----
                const titleEl = document.querySelector(".wf-copy-title");
                if (titleEl) {
                    titleEl.addEventListener("click", () => {
                        const text = titleEl.getAttribute("data-copy");

                        if (navigator.clipboard?.writeText) {
                            navigator.clipboard.writeText(text).catch(err =>
                                                                      console.error("Clipboard copy failed:", err)
                                                                     );
                        } else {
                            window.prompt("Copy to clipboard:", text);
                        }
                    });
                }
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
        const desc  = escapeHtml(poi.description || "");
        const latStr = poi.lat.toFixed(6);
        const lngStr = poi.lng.toFixed(6);

        const iwImgUrl  = poi.imageUrl + "=w240"; // preview
        const fullImgUrl = poi.imageUrl + "=s0";  // open full size

        // Inline styles to override site styles when needed
        const titleStyle = darkMode ? 'color:#000;' : '';
        const descStyle  = darkMode ? 'color:#000;' : '';
        const coordStyle = darkMode ? 'color:#333;' : 'color: inherit;';

        return `
        <div class="agm-info-window-content">
            <div class="wf-nearby-iw-content flex flex-col max-w-[240px]">

                <!-- Title (click to copy) -->
                <div class="font-medium truncate text-base mb-1"
                     title="${title}"
                     style="${titleStyle}">
                    <span
                        class="wf-copy-title"
                        data-copy="${title.replace(/"/g, '&quot;')}"
                        title="Click to copy title"
                        style="cursor: pointer; text-decoration: none;"
                    >
                        ${title}
                    </span>
                </div>

                <!-- Lat/Lng, looks like text but clickable to copy -->
                <div class="text-xs text-gray-500 mb-2">
                    <span
                        class="wf-copy-coords"
                        data-lat="${latStr}"
                        data-lng="${lngStr}"
                        title="Click to copy coordinates"
                        style="cursor: pointer; text-decoration: none; ${coordStyle}"
                    >
                        ${latStr}, ${lngStr}
                    </span>
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
                <div class="text-sm" style="${descStyle}">
                    ${desc}
                </div>
            </div>
        </div>
    `;
    }

    async function onPoisFetched() {
        // Treat stale map as "no map"
        if (!submitMap || isMapStale()) {
            mapClickCloseBound = false;
            submitMap = await getSubmitMap();
            if (!submitMap) {
                console.warn("WFSMM: getSubmitMap() returned null");
                return;
            }

            // Remove clickable icons from Google Maps
            submitMap.setOptions({
                clickableIcons: false,
                cameraControl: false,
                fullscreenControl: true,
            });

            // If we're currently in mobile mode, use our own center pin
            if (currentMapMode === MAP_MODE.MOBILE) {
                hideNativeCenterPin();
                ensureCenterPinOverlay();
            }

            // Base map (map type) change listener
            if (!mapTypeListenerBound) {
                mapTypeListenerBound = true;
                submitMap.addListener("maptypeid_changed", () => {
                    const id = submitMap.getMapTypeId();
                    userSettings.map = userSettings.map || {};
                    userSettings.map.defaultType = id;
                    saveUserSettings();
                });
            }

            // Restore previous view if we have one and the user wants it
            restoreMapViewIfAny();

            // Whenever the map stops moving, remember the view
            submitMap.addListener("idle", () => {
                // always allowed to save; only restore is gated by your setting
                saveMapView();
            });

            addGeolocationControl(submitMap);
            initUserLocationMarker(submitMap);

            injectSearchBox();
            initS2Overlay();
            initCustomBaseMaps();

            if (!mapClickCloseBound) {
                mapClickCloseBound = true;

                submitMap.addListener("click", () => {
                    if (poiInfoWindow) {
                        poiInfoWindow.close();
                    }
                });
            }
        }

        updatePoisOnMap();
    }

    function addGeolocationControl(map) {
        const controlDiv = document.createElement("div");

        // Styling similar to Google Maps own button
        controlDiv.style.background = "white";
        controlDiv.style.border = "2px solid #fff";
        controlDiv.style.borderRadius = "3px";
        controlDiv.style.boxShadow = "0 2px 6px rgba(0,0,0,0.3)";
        controlDiv.style.cursor = "pointer";
        controlDiv.style.margin = "10px";
        controlDiv.style.width = "36px";
        controlDiv.style.height = "36px";
        controlDiv.style.display = "flex";
        controlDiv.style.alignItems = "center";
        controlDiv.style.justifyContent = "center";

        // Icon (simple target icon)
        controlDiv.innerHTML = `
    <div style="
        position: relative;
        width: 20px;
        height: 20px;
    ">
        <!-- Outer circle -->
        <div style="
            width: 16px;
            height: 16px;
            border: 2px solid #666;
            border-radius: 50%;
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
        "></div>

        <!-- Horizontal crosshair lines (with gap near center) -->
        <div style="
            position: absolute;
            top: 50%;
            left: 0;
            width: calc(50% - 5px);
            height: 2px;
            background: #666;
            transform: translateY(-50%);
        "></div>
        <div style="
            position: absolute;
            top: 50%;
            right: 0;
            width: calc(50% - 5px);
            height: 2px;
            background: #666;
            transform: translateY(-50%);
        "></div>

        <!-- Vertical crosshair lines (with gap near center) -->
        <div style="
            position: absolute;
            left: 50%;
            top: 0;
            height: calc(50% - 5px);
            width: 2px;
            background: #666;
            transform: translateX(-50%);
        "></div>
        <div style="
            position: absolute;
            left: 50%;
            bottom: 0;
            height: calc(50% - 5px);
            width: 2px;
            background: #666;
            transform: translateX(-50%);
        "></div>

        <!-- Center dot -->
        <div style="
            width: 6px;
            height: 6px;
            background: #666;
            border-radius: 50%;
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
        "></div>
    </div>
`;
        controlDiv.title = "Show my location";

        controlDiv.addEventListener("click", () => {
            triggerGeolocation(map);
        });

        map.controls[google.maps.ControlPosition.RIGHT_BOTTOM].push(controlDiv);
    }

    let userLocationMarker = null;

    function initUserLocationMarker(map) {
        userLocationMarker = new google.maps.Marker({
            map,
            clickable: false,
            zIndex: 9999,
            icon: {
                path: google.maps.SymbolPath.CIRCLE,
                scale: 8,
                fillColor: '#4285F4',
                fillOpacity: 0.9,
                strokeColor: 'white',
                strokeWeight: 2
            }
        });

        // Hide by default until we have a position
        userLocationMarker.setVisible(false);
    }

    function triggerGeolocation(map) {
        if (!navigator.geolocation) {
            console.warn("WFSMM: Geolocation not supported");
            return;
        }

        navigator.geolocation.getCurrentPosition(
            (pos) => {
                const lat = pos.coords.latitude;
                const lng = pos.coords.longitude;

                const latLng = new google.maps.LatLng(lat, lng);

                // Move the user-location blue dot
                userLocationMarker.setPosition(latLng);
                userLocationMarker.setVisible(true);

                // Center map smoothly
                map.panTo(latLng);
                map.setZoom(Math.max(map.getZoom(), 17));
            },
            (err) => {
                console.warn("WFSMM: Geolocation failed:", err.message);
            },
            {
                enableHighAccuracy: true,
                maximumAge: 5000,
                timeout: 8000
            }
        );
    }

    const MAP_VIEW_KEY = "wfsmm-map-view";

    function saveMapView() {
        try {
            if (!submitMap || typeof google === "undefined" || !google.maps) return;

            const center = submitMap.getCenter();
            if (!center) return;

            const zoom = submitMap.getZoom();

            const data = {
                lat: center.lat(),
                lng: center.lng(),
                zoom: typeof zoom === "number" ? zoom : null
            };

            localStorage.setItem(MAP_VIEW_KEY, JSON.stringify(data));
        } catch (e) {
            console.warn("WFSMM: Failed to save map view:", e);
        }
    }

    function loadSavedMapView() {
        try {
            const raw = localStorage.getItem(MAP_VIEW_KEY);
            if (!raw) return null;

            const parsed = JSON.parse(raw);
            if (!parsed) return null;

            const lat = parseFloat(parsed.lat);
            const lng = parseFloat(parsed.lng);
            const zoom = parsed.zoom != null ? parseInt(parsed.zoom, 10) : null;

            if (Number.isNaN(lat) || Number.isNaN(lng)) return null;

            return { lat, lng, zoom };
        } catch (e) {
            console.warn("WFSMM: Failed to load map view:", e);
            return null;
        }
    }

    function restoreMapViewIfAny() {
        if (!userSettings.map || !userSettings.map.rememberLastView) return;
        if (!submitMap) return;

        const raw = localStorage.getItem(MAP_VIEW_KEY);
        if (!raw) return;

        let parsed;
        try {
            parsed = JSON.parse(raw);
        } catch (e) {
            console.warn("WFSMM: Failed to parse saved map view:", e);
            return;
        }

        const lat = parseFloat(parsed.lat);
        const lng = parseFloat(parsed.lng);
        const zoom = parsed.zoom != null ? parseInt(parsed.zoom, 10) : null;

        if (Number.isNaN(lat) || Number.isNaN(lng)) return;

        const latLng = new google.maps.LatLng(lat, lng);

        // 1) Move the camera
        submitMap.setCenter(latLng);
        if (typeof zoom === "number" && !Number.isNaN(zoom)) {
            submitMap.setZoom(zoom);
        }

        // 2) Simulate a click at this location so Wayfarer moves the pin
        //    and your lat/lng observer + POI fetch pipeline run.
        google.maps.event.trigger(submitMap, "click", { latLng });
    }

    function injectSearchBox() {
        if (!submitMap) return;

        const coordsDiv = findLatLngDiv();
        let headerRow = coordsDiv?.closest("div.flex.items-center") ?? null;

        if (!headerRow) return;

        headerRow.style.display = "flex";
        headerRow.style.flexWrap = "wrap";
        headerRow.style.alignItems = "flex-start";

        const infoContainer = coordsDiv && coordsDiv.parentElement;
        if (infoContainer) {
            infoContainer.style.flex = "1 1 auto";
            infoContainer.style.minWidth = "0";
        }

        const addressDiv = infoContainer
        ? infoContainer.querySelector(".font-medium.text-gray-800")
        : null;

        if (addressDiv) {
            addressDiv.style.whiteSpace = "nowrap";
            addressDiv.style.overflow = "hidden";
            addressDiv.style.textOverflow = "ellipsis";
            addressDiv.style.display = "block";
            addressDiv.style.width = "360px";
        }

        const wrapper = document.createElement("div");

        Object.assign(wrapper.style, {
            display: "flex",
            flexDirection: "column",
            position: "relative",
            marginLeft: "12px",
            marginTop: "4px",
            flexGrow: "1",
            flexShrink: "1",
            flexBasis: "400px",
            minWidth: "350px",
            maxWidth: "100%",
        });

        const label = document.createElement("span");
        label.innerText = "Search";

        Object.assign(label.style, {
            position: "absolute",
            top: "-4px",
            left: "8px",
            fontSize: "12px",
            padding: "0 4px",
            background: darkMode ? "#262626" : "#ffffff",
            color: darkMode ? "#d1d5db" : "#111827",
            width: "max-content",
            zIndex: "1"
        });

        const input = document.createElement("input");
        input.type = "text";
        input.placeholder = "Search places or coordinates…";

        Object.assign(input.style, {
            width: "100%",
            height: "35px",
            background: "transparent",
            padding: "4px 6px",
            borderRadius: "6px",
            border: darkMode ? "1px solid #9ca3af" : "1px solid #000000",
            color: darkMode ? "#f9fafb" : "#111827",
            fontSize: "14px",
            outline: "none",
            marginTop: "6px",
        });

        wrapper.appendChild(label);
        wrapper.appendChild(input);
        headerRow.appendChild(wrapper);

        try {
            const autocomplete = new google.maps.places.Autocomplete(input, {
                fields: ["geometry", "name"],
            });

            autocomplete.addListener("place_changed", () => {
                const place = autocomplete.getPlace();
                if (!place?.geometry) return;
                const loc = place.geometry.location;
                const latLng = new google.maps.LatLng(loc.lat(), loc.lng());
                submitMap.setCenter(latLng);
                google.maps.event.trigger(submitMap, "click", { latLng });
            });
        } catch (err) {
            console.warn("Places API not available;", err);
        }

        input.addEventListener("keydown", (e) => {
            if (e.key !== "Enter") return;
            const parsed = parseLatLng(input.value.trim());
            if (!parsed) return;
            const latLng = new google.maps.LatLng(parsed.lat, parsed.lng);
            submitMap.setCenter(latLng);
            google.maps.event.trigger(submitMap, "click", { latLng });
        });
    }

    function initCustomBaseMaps() {
        if (!submitMap) return;
        if (submitMap._wfsmmBasemapsInitialised) return;
        submitMap._wfsmmBasemapsInitialised = true;

        let mapTypeControlOptions = {
            style: google.maps.MapTypeControlStyle.DROPDOWN_MENU,
            position: google.maps.ControlPosition.TOP_LEFT,
            mapTypeIds: ["roadmap", "satellite", "hybrid"]
        };

        // Add extra services
        mapTypeControlOptions = setupMapLayer(
            submitMap, mapTypeControlOptions,
            "Bing", 19, 0,
            "https://t0.tiles.virtualearth.net/tiles/a{quadKey}.jpeg?g=1398"
        );
        mapTypeControlOptions = setupMapLayer(
            submitMap, mapTypeControlOptions,
            "Esri", 19, 0,
            "https://wayback.maptiles.arcgis.com/arcgis/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
        );
        mapTypeControlOptions = setupMapLayer(
            submitMap, mapTypeControlOptions,
            "Esri Clarity", 19, 0,
            "https://clarity.maptiles.arcgis.com/arcgis/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
        );
        mapTypeControlOptions = setupMapLayer(
            submitMap, mapTypeControlOptions,
            "OSM", 20, 0,
            "https://tile.openstreetmap.org/{z}/{x}/{y}.png"
        );

        submitMap.setOptions({
            mapTypeControl: true,
            mapTypeControlOptions
        });

        const savedType = userSettings.map && userSettings.map.defaultType;
        const preferredType = savedType || "roadmap";

        const hasType = submitMap.mapTypes && submitMap.mapTypes.get(preferredType);
        if (hasType) {
            submitMap.setMapTypeId(preferredType);
        } else {
            submitMap.setMapTypeId("roadmap");
        }
    }

    function setupMapLayer(map, mapTypeControlOptions, name, maxZoom, minZoom, url) {
        const mapType = new google.maps.ImageMapType({
            getTileUrl: function (coord, zoom) {
                const normalizedCoord = getNormalizedCoord(coord, zoom);
                if (!normalizedCoord) return "";

                if (name === "Bing") {
                    const quadKey = getBingMapsQuadKey(normalizedCoord.x, normalizedCoord.y, zoom);
                    return url.replace("{quadKey}", quadKey);
                } else {
                    return url
                        .replace("{z}", zoom)
                        .replace("{x}", normalizedCoord.x)
                        .replace("{y}", normalizedCoord.y);
                }
            },
            tileSize: new google.maps.Size(256, 256),
            maxZoom: maxZoom,
            minZoom: minZoom,
            radius: 1738000,
            name: name
        });

        if (!mapTypeControlOptions.mapTypeIds.includes(name)) {
            mapTypeControlOptions.mapTypeIds.push(name);
        }

        map.mapTypes.set(name, mapType);

        return mapTypeControlOptions;
    }

    function isMapStale() {
        if (!submitMap || !submitMap.getDiv) return true;

        const div = submitMap.getDiv();
        if (!div) return true;

        // If the map's DOM container is no longer attached, this is a stale map
        if (!document.body.contains(div)) {
            return true;
        }

        return false;
    }

    function fixMainPhotoAspectRatioForContainer(container) {
        // Remove the width restrictions on the main photo to allow proper aspect ratio to show
        container.style.setProperty("--width", "auto");
        container.style.display = "inline-flex";
    }

    function initWayspotImageEntryWatcher() {
        const observer = new MutationObserver(mutations => {
            for (const m of mutations) {
                for (const node of m.addedNodes) {
                    if (!(node instanceof HTMLElement)) continue;

                    // Must be <div class="image-container">
                    if (!node.matches("div.image-container")) continue;

                    // Must be inside <app-wayspot-image-entry>
                    if (!node.closest("app-wayspot-image-entry")) continue;

                    fixMainPhotoAspectRatioForContainer(node);
                }
            }
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true
        });
    }

    class S2Overlay {
        constructor() {
            this.polyLines = [];
        }

        check_map_bounds_ready(map) {
            if (!map || map.getBounds === undefined || map.getBounds() === undefined) {
                return false;
            } else {
                return true;
            }
        }

        until(conditionFunction, map) {
            const poll = resolve => {
                if (conditionFunction(map)) resolve();
                else setTimeout(_ => poll(resolve), 400);
            };

            return new Promise(poll);
        }

        // Clear all existing grid lines from the map
        clear() {
            this.polyLines.forEach((line) => {
                line.setMap(null);
            });
            this.polyLines = [];
        }

        async drawCellGrid(map, gridLevel, strokeColor, strokeWidth = 1, strokeOpacity = 1.0) {
            await this.until(this.check_map_bounds_ready, map);
            const bounds = map.getBounds();

            const seenCells = {};
            const cellsToDraw = [];

            // Same visibility rule as before
            if (gridLevel >= 2 && gridLevel < (map.getZoom() + 2)) {
                const latLng = map.getCenter();
                const cell = S2.S2Cell.FromLatLng(this.getLatLngPoint(latLng), gridLevel);
                cellsToDraw.push(cell);
                seenCells[cell.toString()] = true;

                let curCell;
                while (cellsToDraw.length > 0) {
                    curCell = cellsToDraw.pop();
                    const neighbors = curCell.getNeighbors();

                    for (let n = 0; n < neighbors.length; n++) {
                        const nStr = neighbors[n].toString();
                        if (!seenCells[nStr]) {
                            seenCells[nStr] = true;
                            if (this.isCellOnScreen(bounds, neighbors[n])) {
                                cellsToDraw.push(neighbors[n]);
                            }
                        }
                    }

                    this.drawCell(map, curCell, strokeColor, strokeWidth, strokeOpacity);
                }
            }
        }

        drawCell(map, cell, strokeColor, strokeWidth, strokeOpacity) {
            const cellCorners = cell.getCornerLatLngs();
            cellCorners[4] = cellCorners[0]; // loop it

            const polyline = new google.maps.Polyline({
                path: cellCorners,
                geodesic: true,
                fillColor: 'grey',
                fillOpacity: 0.0,
                strokeColor: strokeColor,
                strokeOpacity: strokeOpacity,
                strokeWeight: strokeWidth,
                map: map
            });
            this.polyLines.push(polyline);
        }

        getLatLngPoint(data) {
            const result = {
                lat: typeof data.lat == 'function' ? data.lat() : data.lat,
                lng: typeof data.lng == 'function' ? data.lng() : data.lng
            };
            return result;
        }

        isCellOnScreen(mapBounds, cell) {
            const corners = cell.getCornerLatLngs();
            for (let i = 0; i < corners.length; i++) {
                if (mapBounds.intersects(new google.maps.LatLngBounds(corners[i]))) {
                    return true;
                }
            }
            return false;
        }
    }

    function getEnabledS2Layers() {
        if (!userSettings || !userSettings.s2) return [];

        const layers = [];
        const primary = userSettings.s2.primary;
        const secondary = userSettings.s2.secondary;

        if (primary && primary.enabled) {
            layers.push({
                key: 'primary',
                level: primary.level,
                color: primary.color,
                lineWidth: primary.lineWidth,
                lineOpacity: primary.lineOpacity != null ? primary.lineOpacity : 1.0
            });
        }

        if (secondary && secondary.enabled) {
            layers.push({
                key: 'secondary',
                level: secondary.level,
                color: secondary.color,
                lineWidth: secondary.lineWidth,
                lineOpacity: secondary.lineOpacity != null ? secondary.lineOpacity : 1.0
            });
        }

        return layers;
    }

    function initS2Overlay() {
        if (!submitMap) return;
        if (s2Overlay) return;  // already initialised

        s2Overlay = new S2Overlay();

        // Initial draw
        drawS2Grid();

        // Redraw on map pan/zoom
        s2IdleListener = submitMap.addListener("idle", () => {
            updateS2Grid();
        });
    }

    async function drawS2Grid() {
        if (!submitMap || !s2Overlay) return;

        const layers = getEnabledS2Layers();
        if (!layers.length) return;

        // Decide draw order:
        // - smaller cells = higher level
        // - bigger cells  = lower level
        // We want smaller cells first, bigger cells on top.
        layers.sort((a, b) => a.level - b.level);
        // After sort:
        //   index 0 => lowest level (biggest cells)
        //   last   => highest level (smallest cells)
        // We’ll draw from smallest to biggest:
        //   smallest first -> largest last -> large grid lines on top

        for (let i = layers.length - 1; i >= 0; i--) {
            const layer = layers[i];
            await s2Overlay.drawCellGrid(
                submitMap,
                layer.level,
                layer.color,
                layer.lineWidth,
                layer.lineOpacity
            );
        }
    }

    function updateS2Grid() {
        if (!submitMap || !s2Overlay) return;

        // Clear old lines
        s2Overlay.clear();

        // Redraw according to current userSettings
        drawS2Grid();
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

    function getBingMapsQuadKey(x, y, z) {
        let quadKey = "";
        for (let i = z; i > 0; i--) {
            let digit = 0;
            const mask = 1 << (i - 1);
            if ((x & mask) !== 0) digit += 1;
            if ((y & mask) !== 0) digit += 2;
            quadKey += digit;
        }
        return quadKey;
    }

    // Normalises the coords so tiles repeat across the x axis (horizontally)
    function getNormalizedCoord(coord, zoom) {
        const y = coord.y;
        let x = coord.x;

        const tileRange = 1 << zoom;

        // don't repeat across y-axis
        if (y < 0 || y >= tileRange) {
            return null;
        }

        // repeat across x-axis
        if (x < 0 || x >= tileRange) {
            x = ((x % tileRange) + tileRange) % tileRange;
        }
        return { x, y };
    }

    function hexToRgba(hex, opacity) {
        const h = hex.replace("#", "");
        const r = parseInt(h.substring(0, 2), 16);
        const g = parseInt(h.substring(2, 4), 16);
        const b = parseInt(h.substring(4, 6), 16);
        return `rgba(${r}, ${g}, ${b}, ${opacity})`;
    }

    function injectMarkerCss() {
        // Remove old style tag if reloading settings
        const existing = document.getElementById("wfsmm-marker-style");
        if (existing) existing.remove();

        const { borderColor, borderWidth, borderOpacity } = userSettings.poi.thumbnail;

        // Convert opacity + color into RGBA
        const thumbBorderRGBA = hexToRgba(borderColor, borderOpacity);

        const style = document.createElement('style');
        style.id = "wfsmm-marker-style";
        style.textContent = `
        /* Circular thumbnail marker styling */
        .gm-style img[src*="lh3.googleusercontent.com"][src*="=s36-c"] {
            border-radius: 50% !important;
            width: 36px !important;
            height: 36px !important;
            object-fit: cover !important;
            box-sizing: border-box !important;
            border: ${borderWidth}px solid ${thumbBorderRGBA} !important;
        }

        /* Hide Niantic's default 36x56 z-index:1 markers */
        .gm-style div[style*="width: 36px"][style*="height: 56px"][style*="z-index: 1;"] {
            display: none !important;
        }
    `;
        document.head.appendChild(style);
    }

    function ensureCrosshairClass() {
        if (Crosshair) return true;

        if (typeof google === "undefined" ||
            !google.maps ||
            !google.maps.OverlayView) {
            return false;
        }

        Crosshair = class extends google.maps.OverlayView {
            constructor(position) {
                super();
                this.position = position;
                this.div = null;
            }

            onAdd() {
                const div = document.createElement("div");
                div.style.position = "absolute";
                div.style.width = "20px";
                div.style.height = "20px";
                div.style.pointerEvents = "none";
                div.style.zIndex = "999";

                const hLine = document.createElement("div");
                hLine.style.position = "absolute";
                hLine.style.left = "0";
                hLine.style.top = "9px";
                hLine.style.width = "20px";
                hLine.style.height = "2px";
                hLine.style.background = "#0000FF";

                const vLine = document.createElement("div");
                vLine.style.position = "absolute";
                vLine.style.left = "9px";
                vLine.style.top = "0";
                vLine.style.width = "2px";
                vLine.style.height = "20px";
                vLine.style.background = "#0000FF";

                div.appendChild(hLine);
                div.appendChild(vLine);

                this.div = div;
                this.getPanes().overlayLayer.appendChild(div);
            }

            draw() {
                if (!this.div) return;

                const projection = this.getProjection();
                if (!projection) return;

                const point = projection.fromLatLngToDivPixel(this.position);
                if (!point) return;

                this.div.style.left = (point.x - 10) + "px";
                this.div.style.top = (point.y - 10) + "px";
            }

            onRemove() {
                if (this.div?.parentNode) {
                    this.div.parentNode.removeChild(this.div);
                }
                this.div = null;
            }

            setPosition(latLng) {
                this.position = latLng;
                this.draw();
            }
        };

        return true;
    }

    function ensureCrosshair(lat, lng) {
        if (!submitMap) return;

        if (!ensureCrosshairClass()) {
            return; // Google Maps not ready yet
        }

        const pos = new google.maps.LatLng(lat, lng);

        if (!crosshair) {
            crosshair = new Crosshair(pos);
            crosshair.setMap(submitMap);
        } else {
            crosshair.setPosition(pos);
        }
    }

    function updateCrosshairFromCurrentLatLng() {
        if (typeof window.currentLat !== "number" ||
            typeof window.currentLng !== "number") {
            return;
        }

        if (!enableCrosshairs) {
            return;
        }

        ensureCrosshair(window.currentLat, window.currentLng);
    }

    function ensureCenterPinClass() {
        if (CenterPinOverlay) return true;

        if (typeof google === "undefined" ||
            !google.maps ||
            !google.maps.OverlayView) {
            return false;
        }

        CenterPinOverlay = class extends google.maps.OverlayView {
            constructor(map) {
                super();
                this.map = map;
                this.div = null;

                // Kick off OverlayView lifecycle
                this.setMap(map);
            }

            onAdd() {
                const div = document.createElement("div");
                div.style.position = "absolute";
                div.style.pointerEvents = "none";  // don’t block map/info clicks
                div.style.zIndex = "999";          // under floatPane (InfoWindow), over tiles

                const img = document.createElement("img");
                img.src = "/img/map_selection_pin.svg";
                img.alt = "Center pin";

                // 🔹 Match mobile pin size: 40 × 40
                img.style.width = "40px";
                img.style.height = "40px";
                img.style.display = "block";

                div.appendChild(img);
                this.div = div;

                this.getPanes().overlayLayer.appendChild(div);
            }

            draw() {
                if (!this.div) return;

                const projection = this.getProjection();
                if (!projection) return;

                const map = this.getMap();
                if (!map) return;

                const center = map.getCenter();
                if (!center) return;

                const point = projection.fromLatLngToDivPixel(center);
                if (!point) return;

                const size = 40; // 40 × 40 mobile pin

                // Horizontally: center the pin on x
                this.div.style.left = (point.x - size / 2) + "px";

                // Vertically: put the *bottom* of the pin on the center point
                // so the “tip” / bottom edge sits exactly at the map center
                this.div.style.top  = (point.y - size) + "px";
            }

            onRemove() {
                if (this.div && this.div.parentNode) {
                    this.div.parentNode.removeChild(this.div);
                }
                this.div = null;
            }
        };

        return true;
    }

    function ensureCenterPinOverlay() {
        if (!submitMap) return;
        if (!ensureCenterPinClass()) return;

        if (!centerPinOverlay) {
            centerPinOverlay = new CenterPinOverlay(submitMap);
        }
    }

    function removeCenterPinOverlay() {
        if (centerPinOverlay) {
            centerPinOverlay.setMap(null);
            centerPinOverlay = null;
        }
    }

    // start s2 lib code
    (function(exports) {
        'use strict';

        var S2 = exports.S2 = {
            L: {}
        };

        S2.L.LatLng = function( /*Number*/ rawLat, /*Number*/ rawLng, /*Boolean*/ noWrap) {
            var lat = parseFloat(rawLat, 10);
            var lng = parseFloat(rawLng, 10);

            if (isNaN(lat) || isNaN(lng)) {
                throw new Error('Invalid LatLng object: (' + rawLat + ', ' + rawLng + ')');
            }

            if (noWrap !== true) {
                lat = Math.max(Math.min(lat, 90), -90); // clamp latitude into -90..90
                lng = (lng + 180) % 360 + ((lng < -180 || lng === 180) ? 180 : -180); // wrap longtitude into -180..180
            }

            return {
                lat: lat,
                lng: lng
            };
        };

        S2.L.LatLng.DEG_TO_RAD = Math.PI / 180;
        S2.L.LatLng.RAD_TO_DEG = 180 / Math.PI;

        S2.LatLngToXYZ = function(latLng) {
            var d2r = S2.L.LatLng.DEG_TO_RAD;

            var phi = latLng.lat * d2r;
            var theta = latLng.lng * d2r;

            var cosphi = Math.cos(phi);

            return [Math.cos(theta) * cosphi, Math.sin(theta) * cosphi, Math.sin(phi)];
        };

        S2.XYZToLatLng = function(xyz) {
            var r2d = S2.L.LatLng.RAD_TO_DEG;

            var lat = Math.atan2(xyz[2], Math.sqrt(xyz[0] * xyz[0] + xyz[1] * xyz[1]));
            var lng = Math.atan2(xyz[1], xyz[0]);

            return S2.L.LatLng(lat * r2d, lng * r2d);
        };

        var largestAbsComponent = function(xyz) {
            var temp = [Math.abs(xyz[0]), Math.abs(xyz[1]), Math.abs(xyz[2])];

            if (temp[0] > temp[1]) {
                if (temp[0] > temp[2]) {
                    return 0;
                } else {
                    return 2;
                }
            } else {
                if (temp[1] > temp[2]) {
                    return 1;
                } else {
                    return 2;
                }
            }

        };

        var faceXYZToUV = function(face, xyz) {
            var u, v;

            switch (face) {
                case 0:
                    u = xyz[1] / xyz[0];
                    v = xyz[2] / xyz[0];
                    break;
                case 1:
                    u = -xyz[0] / xyz[1];
                    v = xyz[2] / xyz[1];
                    break;
                case 2:
                    u = -xyz[0] / xyz[2];
                    v = -xyz[1] / xyz[2];
                    break;
                case 3:
                    u = xyz[2] / xyz[0];
                    v = xyz[1] / xyz[0];
                    break;
                case 4:
                    u = xyz[2] / xyz[1];
                    v = -xyz[0] / xyz[1];
                    break;
                case 5:
                    u = -xyz[1] / xyz[2];
                    v = -xyz[0] / xyz[2];
                    break;
                default:
                    throw {
                        error: 'Invalid face'
                    };
            }

            return [u, v];
        };



        S2.XYZToFaceUV = function(xyz) {
            var face = largestAbsComponent(xyz);

            if (xyz[face] < 0) {
                face += 3;
            }

            var uv = faceXYZToUV(face, xyz);

            return [face, uv];
        };

        S2.FaceUVToXYZ = function(face, uv) {
            var u = uv[0];
            var v = uv[1];

            switch (face) {
                case 0:
                    return [1, u, v];
                case 1:
                    return [-u, 1, v];
                case 2:
                    return [-u, -v, 1];
                case 3:
                    return [-1, -v, -u];
                case 4:
                    return [v, -1, -u];
                case 5:
                    return [v, u, -1];
                default:
                    throw {
                        error: 'Invalid face'
                    };
            }
        };

        var singleSTtoUV = function(st) {
            if (st >= 0.5) {
                return (1 / 3.0) * (4 * st * st - 1);
            } else {
                return (1 / 3.0) * (1 - (4 * (1 - st) * (1 - st)));
            }
        };

        S2.STToUV = function(st) {
            return [singleSTtoUV(st[0]), singleSTtoUV(st[1])];
        };


        var singleUVtoST = function(uv) {
            if (uv >= 0) {
                return 0.5 * Math.sqrt(1 + 3 * uv);
            } else {
                return 1 - 0.5 * Math.sqrt(1 - 3 * uv);
            }
        };
        S2.UVToST = function(uv) {
            return [singleUVtoST(uv[0]), singleUVtoST(uv[1])];
        };


        S2.STToIJ = function(st, order) {
            var maxSize = (1 << order);

            var singleSTtoIJ = function(st) {
                var ij = Math.floor(st * maxSize);
                return Math.max(0, Math.min(maxSize - 1, ij));
            };

            return [singleSTtoIJ(st[0]), singleSTtoIJ(st[1])];
        };


        S2.IJToST = function(ij, order, offsets) {
            var maxSize = (1 << order);

            return [
                (ij[0] + offsets[0]) / maxSize,
                (ij[1] + offsets[1]) / maxSize
            ];
        };



        var rotateAndFlipQuadrant = function(n, point, rx, ry) {
            var newX, newY;
            if (ry == 0) {
                if (rx == 1) {
                    point.x = n - 1 - point.x;
                    point.y = n - 1 - point.y

                }

                var x = point.x;
                point.x = point.y
                point.y = x;
            }

        }


        // hilbert space-filling curve
        // based on http://blog.notdot.net/2009/11/Damn-Cool-Algorithms-Spatial-indexing-with-Quadtrees-and-Hilbert-Curves
        // note: rather than calculating the final integer hilbert position, we just return the list of quads
        // this ensures no precision issues with large orders (S3 cell IDs use up to 30), and is more
        // convenient for pulling out the individual bits as needed later
        var pointToHilbertQuadList = function(x, y, order, face) {
            var hilbertMap = {
                'a': [
                    [0, 'd'],
                    [1, 'a'],
                    [3, 'b'],
                    [2, 'a']
                ],
                'b': [
                    [2, 'b'],
                    [1, 'b'],
                    [3, 'a'],
                    [0, 'c']
                ],
                'c': [
                    [2, 'c'],
                    [3, 'd'],
                    [1, 'c'],
                    [0, 'b']
                ],
                'd': [
                    [0, 'a'],
                    [3, 'c'],
                    [1, 'd'],
                    [2, 'd']
                ]
            };

            if ('number' !== typeof face) {
                console.warn(new Error("called pointToHilbertQuadList without face value, defaulting to '0'").stack);
            }
            var currentSquare = (face % 2) ? 'd' : 'a';
            var positions = [];

            for (var i = order - 1; i >= 0; i--) {

                var mask = 1 << i;

                var quad_x = x & mask ? 1 : 0;
                var quad_y = y & mask ? 1 : 0;

                var t = hilbertMap[currentSquare][quad_x * 2 + quad_y];

                positions.push(t[0]);

                currentSquare = t[1];
            }

            return positions;
        };

        // S2Cell class

        S2.S2Cell = function() {};

        S2.S2Cell.FromHilbertQuadKey = function(hilbertQuadkey) {
            var parts = hilbertQuadkey.split('/');
            var face = parseInt(parts[0]);
            var position = parts[1];
            var maxLevel = position.length;
            var point = {
                x: 0,
                y: 0
            };
            var i;
            var level;
            var bit;
            var rx, ry;
            var val;

            for (i = maxLevel - 1; i >= 0; i--) {

                level = maxLevel - i;
                bit = position[i];
                rx = 0;
                ry = 0;
                if (bit === '1') {
                    ry = 1;
                } else if (bit === '2') {
                    rx = 1;
                    ry = 1;
                } else if (bit === '3') {
                    rx = 1;
                }

                val = Math.pow(2, level - 1);
                rotateAndFlipQuadrant(val, point, rx, ry);

                point.x += val * rx;
                point.y += val * ry;

            }

            if (face % 2 === 1) {
                var t = point.x;
                point.x = point.y;
                point.y = t;
            }


            return S2.S2Cell.FromFaceIJ(parseInt(face), [point.x, point.y], level);
        };

        //static method to construct
        S2.S2Cell.FromLatLng = function(latLng, level) {
            if ((!latLng.lat && latLng.lat !== 0) || (!latLng.lng && latLng.lng !== 0)) {
                throw new Error("Pass { lat: lat, lng: lng } to S2.S2Cell.FromLatLng");
            }
            var xyz = S2.LatLngToXYZ(latLng);

            var faceuv = S2.XYZToFaceUV(xyz);
            var st = S2.UVToST(faceuv[1]);

            var ij = S2.STToIJ(st, level);

            return S2.S2Cell.FromFaceIJ(faceuv[0], ij, level);
        };

        S2.S2Cell.FromFaceIJ = function(face, ij, level) {
            var cell = new S2.S2Cell();
            cell.face = face;
            cell.ij = ij;
            cell.level = level;

            return cell;
        };


        S2.S2Cell.prototype.toString = function() {
            return 'F' + this.face + 'ij[' + this.ij[0] + ',' + this.ij[1] + ']@' + this.level;
        };

        S2.S2Cell.prototype.getLatLng = function() {
            var st = S2.IJToST(this.ij, this.level, [0.5, 0.5]);
            var uv = S2.STToUV(st);
            var xyz = S2.FaceUVToXYZ(this.face, uv);

            return S2.XYZToLatLng(xyz);
        };

        S2.S2Cell.prototype.getCornerLatLngs = function() {
            var result = [];
            var offsets = [
                [0.0, 0.0],
                [0.0, 1.0],
                [1.0, 1.0],
                [1.0, 0.0]
            ];

            for (var i = 0; i < 4; i++) {
                var st = S2.IJToST(this.ij, this.level, offsets[i]);
                var uv = S2.STToUV(st);
                var xyz = S2.FaceUVToXYZ(this.face, uv);

                result.push(S2.XYZToLatLng(xyz));
            }
            return result;
        };


        S2.S2Cell.prototype.getFaceAndQuads = function() {
            var quads = pointToHilbertQuadList(this.ij[0], this.ij[1], this.level, this.face);

            return [this.face, quads];
        };
        S2.S2Cell.prototype.toHilbertQuadkey = function() {
            var quads = pointToHilbertQuadList(this.ij[0], this.ij[1], this.level, this.face);

            return this.face.toString(10) + '/' + quads.join('');
        };

        S2.latLngToNeighborKeys = S2.S2Cell.latLngToNeighborKeys = function(lat, lng, level) {
            return S2.S2Cell.FromLatLng({
                lat: lat,
                lng: lng
            }, level).getNeighbors().map(function(cell) {
                return cell.toHilbertQuadkey();
            });
        };
        S2.S2Cell.prototype.getNeighbors = function() {

            var fromFaceIJWrap = function(face, ij, level) {
                var maxSize = (1 << level);
                if (ij[0] >= 0 && ij[1] >= 0 && ij[0] < maxSize && ij[1] < maxSize) {
                    // no wrapping out of bounds
                    return S2.S2Cell.FromFaceIJ(face, ij, level);
                } else {
                    // the new i,j are out of range.
                    // with the assumption that they're only a little past the borders we can just take the points as
                    // just beyond the cube face, project to XYZ, then re-create FaceUV from the XYZ vector

                    var st = S2.IJToST(ij, level, [0.5, 0.5]);
                    var uv = S2.STToUV(st);
                    var xyz = S2.FaceUVToXYZ(face, uv);
                    var faceuv = S2.XYZToFaceUV(xyz);
                    face = faceuv[0];
                    uv = faceuv[1];
                    st = S2.UVToST(uv);
                    ij = S2.STToIJ(st, level);
                    return S2.S2Cell.FromFaceIJ(face, ij, level);
                }
            };

            var face = this.face;
            var i = this.ij[0];
            var j = this.ij[1];
            var level = this.level;


            return [
                fromFaceIJWrap(face, [i - 1, j], level),
                fromFaceIJWrap(face, [i, j - 1], level),
                fromFaceIJWrap(face, [i + 1, j], level),
                fromFaceIJWrap(face, [i, j + 1], level)
            ];

        };

        //
        // Functional Style
        //
        S2.FACE_BITS = 3;
        S2.MAX_LEVEL = 30;
        S2.POS_BITS = (2 * S2.MAX_LEVEL) + 1; // 61 (60 bits of data, 1 bit lsb marker)

        S2.facePosLevelToId = S2.S2Cell.facePosLevelToId = S2.fromFacePosLevel = function(faceN, posS, levelN) {
            var Long = exports.dcodeIO && exports.dcodeIO.Long || require('long');
            var faceB;
            var posB;
            var bin;

            if (!levelN) {
                levelN = posS.length;
            }
            if (posS.length > levelN) {
                posS = posS.substr(0, levelN);
            }

            // 3-bit face value
            faceB = Long.fromString(faceN.toString(10), true, 10).toString(2);
            while (faceB.length < S2.FACE_BITS) {
                faceB = '0' + faceB;
            }

            // 60-bit position value
            posB = Long.fromString(posS, true, 4).toString(2);
            while (posB.length < (2 * levelN)) {
                posB = '0' + posB;
            }

            bin = faceB + posB;
            // 1-bit lsb marker
            bin += '1';
            // n-bit padding to 64-bits
            while (bin.length < (S2.FACE_BITS + S2.POS_BITS)) {
                bin += '0';
            }

            return Long.fromString(bin, true, 2).toString(10);
        };

        S2.keyToId = S2.S2Cell.keyToId = S2.toId = S2.toCellId = S2.fromKey = function(key) {
            var parts = key.split('/');

            return S2.fromFacePosLevel(parts[0], parts[1], parts[1].length);
        };

        S2.idToKey = S2.S2Cell.idToKey = S2.S2Cell.toKey = S2.toKey = S2.fromId = S2.fromCellId = S2.S2Cell.toHilbertQuadkey = S2.toHilbertQuadkey = function(idS) {
            var Long = exports.dcodeIO && exports.dcodeIO.Long || require('long');
            var bin = Long.fromString(idS, true, 10).toString(2);

            while (bin.length < (S2.FACE_BITS + S2.POS_BITS)) {
                bin = '0' + bin;
            }

            // MUST come AFTER binstr has been left-padded with '0's
            var lsbIndex = bin.lastIndexOf('1');
            // substr(start, len)
            // substring(start, end) // includes start, does not include end
            var faceB = bin.substring(0, 3);
            // posB will always be a multiple of 2 (or it's invalid)
            var posB = bin.substring(3, lsbIndex);
            var levelN = posB.length / 2;

            var faceS = Long.fromString(faceB, true, 2).toString(10);
            var posS = Long.fromString(posB, true, 2).toString(4);

            while (posS.length < levelN) {
                posS = '0' + posS;
            }

            return faceS + '/' + posS;
        };

        S2.keyToLatLng = S2.S2Cell.keyToLatLng = function(key) {
            var cell2 = S2.S2Cell.FromHilbertQuadKey(key);
            return cell2.getLatLng();
        };

        S2.idToLatLng = S2.S2Cell.idToLatLng = function(id) {
            var key = S2.idToKey(id);
            return S2.keyToLatLng(key);
        };

        S2.S2Cell.latLngToKey = S2.latLngToKey = S2.latLngToQuadkey = function(lat, lng, level) {
            if (isNaN(level) || level < 1 || level > 30) {
                throw new Error("'level' is not a number between 1 and 30 (but it should be)");
            }
            return S2.S2Cell.FromLatLng({
                lat: lat,
                lng: lng
            }, level).toHilbertQuadkey();
        };

        S2.stepKey = function(key, num) {
            var Long = exports.dcodeIO && exports.dcodeIO.Long || require('long');
            var parts = key.split('/');

            var faceS = parts[0];
            var posS = parts[1];
            var level = parts[1].length;

            var posL = Long.fromString(posS, true, 4);
            // TODO handle wrapping (0 === pos + 1)
            // (only on the 12 edges of the globe)
            var otherL;
            if (num > 0) {
                otherL = posL.add(Math.abs(num));
            } else if (num < 0) {
                otherL = posL.subtract(Math.abs(num));
            }
            var otherS = otherL.toString(4);

            if ('0' === otherS) {
                console.warning(new Error("face/position wrapping is not yet supported"));
            }

            while (otherS.length < level) {
                otherS = '0' + otherS;
            }

            return faceS + '/' + otherS;
        };

        S2.S2Cell.prevKey = S2.prevKey = function(key) {
            return S2.stepKey(key, -1);
        };

        S2.S2Cell.nextKey = S2.nextKey = function(key) {
            return S2.stepKey(key, 1);
        };

    })('undefined' !== typeof module ? module.exports : window);

    init();

})();