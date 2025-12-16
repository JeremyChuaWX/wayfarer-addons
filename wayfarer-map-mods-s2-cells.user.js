// ==UserScript==
// @name         Wayfarer Map Mods - s2 Cells
// @version      0.2.2
// @description  Feature enhancement for the submission map
// @namespace    https://gitlab.com/Tntnnbltn/wayfarer-addons
// @downloadURL  https://gitlab.com/Tntnnbltn/wayfarer-addons/-/raw/main/wayfarer-map-mods-s2-cells.user.js
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
// <https://gitlab.com/Tntnnbltn/wayfarer-addons/-/blob/main/LICENSE>
// If not, see <https://www.gnu.org/licenses/>.

(function() {
    'use strict';

    // =====================================================
    // Constants / Configuration
    // =====================================================

    // Map route we attach to
    const MAP_PATH = "/new/submit/new";

    // LocalStorage key for this plugin
    const SETTINGS_KEY = "wfmap_s2_settings";

    // S2 PGO inclusion rules
    const POI_CELL_LEVEL = 17;
    const GYM_THRESHOLDS = [2, 6, 20]; // game items per L14 cell for gym creation

    // Performance tuning
    const GAME_POI_MIN_ZOOM = 13; // hide game POI markers below this zoom

    // IndexedDB
    const DB_NAME = "wayfarer-tools-db";
    const POI_STORE_NAME = "gamePois";

    // POI Bridge
    const POI_BRIDGE_ID = "wfmapmods-poi-bridge";
    const POI_BRIDGE_SOURCE = "wfmm-s2";

    // Possible POI lifecycle states
    const POI_STATUS = {
        LIVE: "LIVE",
        MISSING: "MISSING"
    };

    // -----------------------------
    // POI Type Icons (inline SVG)
    // -----------------------------

    const POI_TYPE_ICONS = {
        stop: `
<svg version="1.1" viewBox="0 0 1115.9 1101.7" xmlns="http://www.w3.org/2000/svg">
<g transform="translate(-245.24 -83.265)">
<path d="m813.38 1174.4c-10.371-1.659-19.241-8.2434-24.438-18.139-2.4331-4.6333-2.7761-6.3928-2.7842-14.284-8e-3 -7.8282 0.35271-9.737 2.7706-14.66 3.3492-6.82 9.0296-12.176 16.579-15.632 5.1975-2.3795 7.0814-2.618 26.294-3.3281 70.912-2.6209 132.02-17.83 192.85-48.001 92.909-46.081 166.45-119.41 211.97-211.38 15.916-32.153 25.414-57.509 33.992-90.743 9.6717-37.473 12.482-59.116 15.378-118.43 0.6267-12.832 7.347-22.516 19.541-28.157 7.9296-3.6682 18.31-3.6682 26.24 0 7.5903 3.5112 13.256 8.8592 16.6 15.669 2.7764 5.6536 2.7798 5.6861 2.7418 26.661-0.1069 59.08-13.18 124.45-36.898 184.5-7.3982 18.731-27.18 58.742-37.575 76-50.561 83.941-119.71 150.15-205.54 196.8-68.76 37.372-152.13 60.417-226.95 62.735-9.35 0.2896-19.025 0.6676-21.5 0.8401s-6.6458-0.03-9.2685-0.4492zm-536.37-516.61c-8.5764-3.2681-14.152-8.4392-18.944-17.571-2.0436-3.8942-2.4136-6.2336-2.748-17.377-0.41806-13.931 0.99604-38.409 3.4155-59.123 15.686-134.29 83.432-259.01 188.27-346.61 71.176-59.469 160.02-100.6 250.14-115.81 31.306-5.2822 75.128-8.9969 91.74-7.7766 13.033 0.95744 23.701 7.7778 28.98 18.527 2.4179 4.9236 2.7786 6.8323 2.7706 14.661-8e-3 7.8914-0.35101 9.6509-2.7842 14.284-5.3833 10.251-13.878 16.366-25.342 18.244-3.2254 0.52822-11.264 0.96766-17.864 0.97652-39.001 0.0524-90.862 9.0576-132.78 23.056-182.54 60.96-309.73 227.17-319.68 417.73-0.53719 10.291-1.1432 22.312-1.3467 26.712-0.43056 9.3098-3.3598 16.162-9.5587 22.361-6.1575 6.1575-12.235 8.5901-22.139 8.8607-5.3597 0.14645-9.8408-0.27864-12.129-1.1506z" fill="#1e0ae5" stroke="#1b0ae6" stroke-width="20"/>
<path d="m772.19 1031.9c-81.594-5.873-157.25-35.673-222.19-87.523-17.267-13.785-46.517-43.024-60.401-60.378-33.012-41.263-58.142-89.176-72.465-138.16-4.1042-14.037-10.135-40.079-10.135-43.767v-2.0723h239.63l4.3442 8.5677c16.569 32.678 42.21 57.932 75.524 74.382 14.922 7.3686 23.695 10.445 40.5 14.202 9.383 2.0978 12.947 2.3444 33.5 2.318 21.648-0.0278 23.705-0.1949 35-2.8424 32.384-7.5908 59.188-22.351 81.983-45.145 12.657-12.657 22.037-25.376 30.041-40.733l5.6025-10.75h239.87v2.0723c0 3.6406-6.0086 29.656-9.9931 43.267-27.759 94.824-91.337 177.66-176.07 229.41-69.679 42.55-153.64 62.994-234.74 57.156zm20.307-333.02c-15.025-1.4152-27.17-7.4144-39.088-19.308-6.1971-6.1844-9.0433-9.9917-12.174-16.285-13.082-26.298-7.9869-57.216 12.735-77.283 26.04-25.216 66.387-25 92.446 0.49573 25.073 24.532 26.097 65.702 2.2679 91.175-15.393 16.455-33.612 23.331-56.187 21.204zm-385.5-134.27c0-5.3686 7.6813-36.577 13.195-53.61 19.089-58.97 50.704-111.25 94.281-155.89 34.902-35.759 68.852-60.316 112.79-81.588 110.17-53.333 240.43-52.772 348.78 1.5041 43.031 21.556 75.359 45.212 109.48 80.11 53.9 55.131 89.972 123.02 105.52 198.59 1.0752 5.2254 1.9549 10.126 1.9549 10.891 0 1.1792-18.231 1.3807-120.25 1.3294l-120.25-0.0605-3.8699-8.0654c-14.559-30.342-45.036-60.249-76.631-75.199-58.891-27.865-127.32-19.617-177.51 21.397-16.601 13.564-33.22 34.115-42.182 52.161l-4.8038 9.6722-120.25 0.0777c-102.03 0.06592-120.25-0.13293-120.25-1.3122z" fill="#0074d9" stroke="#0075db" stroke-width="50"/>
</g>
</svg>

        `,
        gym: `
<svg version="1.1" viewBox="0 0 654.32 696.7" xmlns="http://www.w3.org/2000/svg">
<g transform="translate(-155.17 -129.6)" fill="#ff0202">
<path d="m474.15 825.81c-1.6812-5.2991-19.54-71.464-25.052-92.813-2.7688-10.725-12.779-48.075-22.245-83l-17.211-63.5-26.069-0.0232c-27.672-0.0246-33.369-0.64919-54.77-6.0044-28.239-7.0662-59.671-21.947-82.102-38.869-10.248-7.7317-24.918-21.31-33.948-31.423-8.4062-9.4144-19.299-23.964-18.522-24.74 0.57377-0.57377 28.362-15.482 56.273-30.191 11-5.7969 29.139-15.438 40.308-21.425l20.308-10.885 6.1915 5.6366c26.757 24.359 62.321 32.391 96.168 21.72 14.961-4.7167 24.796-10.595 36.361-21.73 23.599-22.722 34.392-53.022 29.748-83.512-0.87528-5.7458-1.2525-10.754-0.83831-11.129 0.4142-0.3751 9.7531-5.3938 20.753-11.153 19.806-10.369 55.473-29.315 112.5-59.758 16.225-8.6616 34.45-18.353 40.5-21.536s22.925-12.185 37.5-20.004 35.725-19.067 47-24.997c11.275-5.9295 32.134-17.041 46.354-24.692 14.22-7.6508 25.98-13.77 26.134-13.598 0.27904 0.31187-39.844 80.897-232.58 467.13-98.304 196.99-101.74 203.7-102.76 200.5z"/>
<path d="m376 426.43c-13.74-2.3692-21.701-5.4347-31.639-12.183-11.065-7.5143-20.23-19.67-24.901-33.027-3.561-10.183-4.4975-28.09-2.0248-38.718 4.944-21.25 20.879-39.567 41.564-47.779 17.943-7.1225 39.48-5.845 57.202 3.3929 8.2599 4.3057 23.139 19.137 27.475 27.386 6.2429 11.878 7.8285 18.605 7.778 33-0.0399 11.395-0.38012 14.004-2.7558 21.131-7.081 21.243-26.356 39.571-47.199 44.881-6.1542 1.5677-21.038 2.6869-25.5 1.9175zm20.369-18.937c25.519-6.6468 42.248-32.192 37.652-57.492-6.1338-33.767-42.008-52.047-72.642-37.016-30.462 14.947-37.711 54.882-14.545 80.121 12.111 13.194 31.969 18.962 49.535 14.387z" stroke="#f00" stroke-width="5"/>
<path d="m167.62 433.75c-7.9115-22.511-11.425-41.875-12.293-67.75-1.6732-49.863 10.689-93.275 38.443-135 22.561-33.917 51.907-59.565 88.735-77.55 37.152-18.144 75.012-25.888 114.37-23.393 58.398 3.7012 111.4 28.197 151.63 70.074 8.7851 9.1457 24.5 28.443 24.5 30.085 0 0.32594-11.362 6.6531-25.25 14.06-59.054 31.498-77.685 41.411-84.924 45.186l-7.6736 4.0015-6.3559-6.1032c-10.452-10.037-23.512-17.491-38.5-21.973-11.914-3.5632-32.913-4.4567-45.379-1.9308-17.615 3.5692-33.758 11.98-47.342 24.666-17.829 16.651-28.514 39.41-30.222 64.378-0.53883 7.8769 0.74469 23.988 2.2167 27.824 0.28936 0.75404-1.058 2.0088-3.2904 3.0643-2.0792 0.98304-20.88 10.907-41.78 22.053-49.614 26.46-72.498 38.559-72.932 38.559-0.19298 0-1.972-4.6125-3.9533-10.25z"/>
</g>
</svg>
        `,
        powerspot: `
<svg width="264.47mm" height="253.69mm" version="1.1" viewBox="0 0 264.47 253.69" xml:space="preserve" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"><defs><linearGradient id="c" x1="61.207" x2="449.01" y1="103.22" y2="103.22" gradientTransform="translate(-2,-37.5)" gradientUnits="userSpaceOnUse"><stop stop-color="#a260c3" offset="0"/><stop stop-color="#9a6fb4" offset=".5"/><stop stop-color="#a678ca" offset="1"/></linearGradient><linearGradient id="b" x1="58.189" x2="449.44" y1="26.182" y2="26.182" gradientTransform="translate(1,23.5)" gradientUnits="userSpaceOnUse"><stop stop-color="#a271c0" stop-opacity=".99608" offset="0"/><stop stop-color="#a885bd" offset=".25"/><stop stop-color="#a68dbc" offset=".49845"/><stop stop-color="#ad98bf" offset=".75"/><stop stop-color="#b2a2ca" offset=".96478"/><stop stop-color="#ebe7fc" offset="1"/></linearGradient><filter id="f" x="-.045401" y="-.026893" width="1.0908" height="1.0538" color-interpolation-filters="sRGB"><feGaussianBlur stdDeviation="4.7619707"/></filter><filter id="l" x="-.080472" y="-.065628" width="1.1609" height="1.1313" color-interpolation-filters="sRGB"><feGaussianBlur stdDeviation="7.9663468"/></filter><filter id="e" x="-.082663" y="-.043292" width="1.1653" height="1.0866" color-interpolation-filters="sRGB"><feGaussianBlur stdDeviation="4.1877723"/></filter><linearGradient id="a" x1="256.37" x2="255.61" y1="358.89" y2="323.89" gradientUnits="userSpaceOnUse"><stop stop-color="#e8429d" offset="0"/><stop stop-color="#e8429d" stop-opacity="0" offset="1"/></linearGradient><filter id="d" x="-.50929" y="-.1014" width="2.0186" height="1.2028" color-interpolation-filters="sRGB"><feGaussianBlur stdDeviation="7.1606199"/></filter><filter id="k" x="-1.0421" y="-.0073109" width="3.0843" height="1.0146" color-interpolation-filters="sRGB"><feGaussianBlur stdDeviation="1.2281692"/></filter><filter id="j" x="-.69224" y="-.12867" width="2.3845" height="1.2573" color-interpolation-filters="sRGB"><feGaussianBlur stdDeviation="2.5494275"/></filter><filter id="i" x="-.2729" y="-.064634" width="1.5458" height="1.1293" color-interpolation-filters="sRGB"><feGaussianBlur stdDeviation="1.4472579"/></filter><filter id="h" x="-.2729" y="-.064634" width="1.5458" height="1.1293" color-interpolation-filters="sRGB"><feGaussianBlur stdDeviation="1.4472579"/></filter><filter id="g" x="-.2729" y="-.064634" width="1.5458" height="1.1293" color-interpolation-filters="sRGB"><feGaussianBlur stdDeviation="1.4472579"/></filter></defs><g transform="translate(26.603 -30.162)"><path transform="matrix(.91985 0 0 .40137 -124.58 58.711)" d="m252.08 490.73s-8.4853-10.253-7.0711-13.081 8.1317-6.7175 3.8891-13.789-8.1317-14.849-4.2426-22.981c3.8891-8.1317 7.4246-15.91 2.4749-22.274-4.9498-6.364-6.364-8.4853-2.1213-16.263 4.2426-7.7782 10.607-11.667 6.0104-27.577-4.5962-15.91-5.3033-32.173-10.253-38.537-4.9498-6.364-4.9498-4.9497-7.7782-19.445-2.8284-14.496 1.4142-20.153-6.0104-27.931s-29.345-33.234-28.638-50.205c0.70711-16.971-73.893-167.94-73.893-167.94l251.73-3.5355-87.681 197.28s-6.7175 8.1317-6.364 15.556c0.35355 7.4246 0.35355 10.96-3.182 16.617-3.5355 5.6569-10.607 19.799-8.4853 24.042 2.1213 4.2426-8.8388 25.809-8.8388 31.113s-3.8891 39.244-1.4142 41.719c2.4749 2.4749 7.4246 3.8891 6.0104 7.4246-1.4142 3.5355-8.1317 11.314-7.7782 12.374s10.607 9.8995 8.1317 14.849c-2.4749 4.9497-8.8388 19.799-6.7175 22.627 2.1213 2.8284 8.1317 17.678 5.6569 22.274-2.4749 4.5962-7.7782 19.092-7.7782 19.092z" fill="#d14e9e" filter="url(#f)" opacity=".84552"/><path transform="matrix(.71076 0 0 .26289 -74.586 77.669)" d="m132.23 73.539 237.59 0.70711-113.84 290.62z" fill="#ed61e2" filter="url(#l)" stroke-linejoin="round" stroke-miterlimit="20" stroke-width="3.954" style="mix-blend-mode:normal"/><path transform="matrix(.91298 0 0 .37461 -124.86 68.513)" d="m188.09 82.024c6.4328 10.613 15.349 19.707 18.819 31.933 9.6899 20.348 15.989 42.191 18.678 64.555 2.0983 13.108 7.1957 25.398 11.885 37.698 3.4875 10.673 3.6002 21.985 2.8226 33.045 1.1596 13.044 10 23.731 12.268 36.515 2.8673 6.8333 7.8417 19.825 9.0545 23.3 4.4958-12.021 10.609-23.762 10.759-36.927 2.0724-23.824-6.6382-48.321 1.9312-71.516 3.402-11.987 7.5436-23.729 9.5663-36.041 3.3059-11.552 4.747-23.457 5.9936-35.365 2.368-10.427 9.766-18.772 12.953-29.022 1.6534-6.7536 13.918-19.255 1.02-21.44-15.322 0.71665-30.71 1.0726-46.001-0.30055-18.384 0.38057-36.752-0.31045-55.088-1.546-1.8242-0.01585-3.6495 0.02954-5.4692 0.16241" fill="#faf9fb" filter="url(#e)" opacity=".34053"/><path transform="matrix(.91298 0 0 .55196 -124.86 3.8505)" d="m253.14 491.09s-5.3033-7.4246-5.3033-12.021c0-4.5962 5.6568-7.7782 1.7678-13.789-3.8891-6.0104-13.435-15.556-8.4853-24.042 4.9498-8.4853 9.5459-19.092 5.3033-24.749-4.2426-5.6568-2.1213-3.182 0.35356-13.435 2.4749-10.253 8.1317-23.335 3.8891-33.941s-11.314-45.608-14.142-47.023 33.588 1.0607 33.588 1.0607-6.7175 21.92-6.0104 30.406c0.70711 8.4853 3.182 19.799-1.0607 28.638-0.97963 2.0409-1.7678 8.1317 0.35356 10.607 2.1213 2.4749 8.8388 13.435 4.9497 19.445-3.8891 6.0104-3.182 10.253-2.8284 14.496 0.35355 4.2426 5.3033 8.1317 3.5355 12.374s-8.4853 8.4853-6.364 15.556 8.4853 14.849 4.9498 19.092c-3.5355 4.2426-4.5962 10.253-4.5962 14.142s-9.8995 3.182-9.8995 3.182z" fill="url(#a)" filter="url(#d)"/><ellipse cx="109.32" cy="274.87" rx="13.923" ry="5.9119" fill="#a16b96" stroke="#e564eb" stroke-linejoin="round" stroke-miterlimit="20" stroke-width="2.3011"/><g transform="matrix(.92339 0 0 .39875 -127.54 80.122)" fill="#fff"><rect x="254.91" y="85.143" width="2.8284" height="403.18" filter="url(#k)" style="mix-blend-mode:normal"/><ellipse transform="matrix(.96441 0 0 1 9.2465 -14.506)" cx="256.33" cy="306.8" rx="4.4194" ry="23.776" filter="url(#j)" opacity=".73256" style="mix-blend-mode:normal"/><ellipse transform="matrix(.82784 0 0 1 44.635 -22.317)" cx="255.64" cy="252.95" rx="6.364" ry="26.87" filter="url(#i)" opacity=".74917" style="mix-blend-mode:normal"/><ellipse transform="matrix(.82784 0 0 1 44.098 -153.97)" cx="255.64" cy="252.95" rx="6.364" ry="26.87" filter="url(#h)" opacity=".74917" style="mix-blend-mode:normal"/><ellipse transform="matrix(.82784 0 0 1 44.617 -88.223)" cx="255.64" cy="252.95" rx="6.364" ry="26.87" filter="url(#g)" opacity=".74917" style="mix-blend-mode:normal"/></g><g transform="matrix(.66856 0 0 1.0507 -66.765 23.778)"><path d="m109.96 41.012c131.86 21.042 260.18 16.679 298.4 1.0607l25.102-12.374-12.374-10.96s-64.225-7.8817-91.803-9.6495c-27.577-1.7678-99.47-0.95711-121.39-0.60355s-102.18 5.3033-111.37 8.8388c-9.1924 3.5355-23.688 9.1924-23.688 9.1924l8.8388 14.142z" fill="#9e7da1"/><ellipse cx="251.97" cy="42.28" rx="141.83" ry="15.458" fill="#779953"/><path d="m60.268 44.416 13.689 19.268s22.25 20.5 149.75 21.5c127.5 1 161.08-8.3092 178.4-10.784 17.324-2.4749 28.284-7.6014 28.284-7.6014s6.9827-4.6846 10.872-9.6343c3.8891-4.9497 9.0156-11.49 9.0156-11.49l-148.58 13.347-172.53-3.5355z" fill="url(#c)"/><path d="m60.104 32.173s-0.17678-4.2426 1.2374-5.1265c1.4142-0.88388 3.2991-1.7615 14.672-6.0104 11.667-4.3588 20.663-6.0239 26.663-6.7739 6-0.75 9.6768-0.11612 9.6768-0.11612s-20.783 5.6525-24.319 8.1274-6.364 3.5355-1.0607 7.0711 31.969 11.255 67.175 13.435c35.355 2.1893 98.288 3.182 131.88 2.4749 33.588-0.70711 96.874-3.8891 110.66-6.7175s24.395-6.0104 26.87-8.8388 1.3244-5.6861-2.1213-7.7782c-4.9498-3.0052-34.471-7.7782-34.471-7.7782s13.45-1.4541 28.284 0.17678c18.686 2.0543 28.365 8.0198 32.704 10.43s2.8284 6.364 2.8284 6.364l-4.2426 9.8995-123.74 15.203-211.42-4.9497-47.023-12.728z" fill="#dfbceb"/><path d="m60.427 32.342-0.35355 11.857s20.966 14.844 67.689 17.6c46.625 2.75 78.177 6.7197 133.43 5.9697s141.5-7.25 161-12.25 27.912-9.9393 27.912-9.9393l0.33839-14.061s-6 6.25-27.5 10-105.18 10.174-160.5 10.75-144.5-0.98598-174.11-9.6771c-21.897-6.426-27.901-10.25-27.901-10.25z" fill="url(#b)"/><path d="m101.16 17.78s46.083-9.4178 169.09-9.2803c90.54 0.10116 148.25 11.375 148.25 11.375l9.4528-2.2108s-24.54-10.831-157.58-11.539c-165.31-0.8803-177.77 10.643-177.77 10.643z" fill="#dfbceb"/></g></g></svg>
        `
    };

    // =====================================================
    // Core map & overlay state
    // =====================================================

    // Google Map + S2 overlay
    let submitMap = null;
    let s2Overlay = null;
    let mapAttached = false;

    // Map listeners
    let idleListener = null;
    let zoomListener = null;

    // =====================================================
    // Live POI data
    // =====================================================

    // Live POIs returned from live-pois-in-radius
    let s2Pois = [];

    // Stored game POIs (IndexedDB + in-memory cache)
    // key = id (guid or synthetic lat,lng), value = record
    let gamePois = new Map();

    // =====================================================
    // Game POI markers (Stops / Gyms / Power Spots)
    // =====================================================

    let gamePoiMarkers = [];


    // =====================================================
    // S2 cell shading + overlay reuse
    // =====================================================

    // L14-specific overlays
    let l14CellLabels = [];

    // Reuse maps for shading polygons (prevents churn)
    const l17ShadeByCellId = new Map(); // cellId -> { path, polys: google.maps.Polygon[] }
    const l14ShadeByCellId = new Map(); // cellId -> google.maps.Polygon

    // Shading caches (invalidate via shadePoiVersion)
    let shadePoiVersion = 0; // increment when POIs change
    let allPoisCache = null; // cached filtered list (stops + gyms)
    let l17CountsCache = null; // Map(cellId -> { cell, count })
    let l14StatsCache = null; // Map(cellId -> { cell, gameItems, gyms })

    // Prevent unnecessary redraw work
    let lastShadeKey = "";
    let lastGridKey = "";

    // =====================================================
    // Highlighted submission cell
    // =====================================================

    let submitCellHighlight = null;
    let submitCellLat = null;
    let submitCellLng = null;

    // =====================================================
    // DOM observers & route / panel tracking
    // =====================================================

    // POI bridge observer (controls POI type UI visibility)
    let poiBridgeObserver = null;

    // Map panel presence tracking
    let mapPanelObserver = null;
    let mapPanelMutationScheduled = false;

    // =====================================================
    // Lat/Lng watcher (submission location changes)
    // =====================================================

    let latLngBodyObserver = null;
    let latLngObserver = null;
    let latLngTargetEl = null;

    // =====================================================
    // UI / interaction state
    // =====================================================

    // Keyboard shortcuts installed flag (Ctrl+Alt+P/G/W/N)
    let poiTypeShortcutsInstalled = false;

    // -----------------------------
    // Settings utilities
    // -----------------------------

    const userSettings = {
        master: {
            // Master toggle for S2 overlays (grid lines, shading, highlighting).
            enabled: true
        },

        // Primary S2 grid (L17 by default)
        primary: {
            enabled: true,
            level: 17,
            color: "#00B303",
            lineWidth: 1,
            lineOpacity: 1.0
        },

        // Secondary S2 grid (L14 by default)
        secondary: {
            enabled: true,
            level: 14,
            color: "#FF0000",
            lineWidth: 2,
            lineOpacity: 1.0
        },

        // L17 cell shading based on Pokémon GO POIs (darker when >1 POI in a cell)
        poiCells: {
            enabled: true,
            color: "#000000",
            fillOpacity: 0.2
        },

        // Highlight for the current submission cell (L17)
        highlightCell: {
            enabled: true,
            color: "#FF0000",
            lineWidth: 4,
            lineOpacity: 1.0
        },

        // L14 gym-logic overlays (under/overcrowded shading + labels)
        l14Cells: {
            enabled: true,
            shadeUndercrowded: true,
            shadeOvercrowded: true,
            undercrowdedColor: "#facc15",
            undercrowdedOpacity: 0.45,
            overcrowdedColor: "#f97373",
            overcrowdedOpacity: 0.45,
            showLabels: true
        },

        // Pokémon GO POI marker styling
        poiMarkers: {
            hideAtLowZoom: {
                enabled: true
            },
            stop: {
                enabled: true,
                markerSize: 8,
                borderColor: "#0000cd",
                borderOpacity: 1.0,
                borderWidth: 2,
                fillColor: "#00bfff",
                fillOpacity: 1.0
            },
            gym: {
                enabled: true,
                markerSize: 8,
                borderColor: "#bf2424",
                borderOpacity: 1.0,
                borderWidth: 2,
                fillColor: "#ff0000",
                fillOpacity: 1.0
            },
            powerspot: {
                enabled: true,
                markerSize: 7,
                borderColor: "#e762d3",
                borderOpacity: 1.0,
                borderWidth: 2,
                fillColor: "#f195eb",
                fillOpacity: 1.0
            },
            na: {
                enabled: false,
                markerSize: 8,
                borderColor: "#474747",
                borderOpacity: 1.0,
                borderWidth: 2,
                fillColor: "#ffe8b8",
                fillOpacity: 1.0
            }
        }
    };

    // Edit code to 'true' to show N/A markers on the map
    userSettings.poiMarkers.na.enabled = false;

    function mergeDeep(target, source) {
        for (const key in source) {
            const srcVal = source[key];
            const tgtVal = target[key];

            if (
                typeof srcVal === "object" &&
                srcVal !== null &&
                !Array.isArray(srcVal)
            ) {
                if (typeof tgtVal !== "object" || tgtVal === null) {
                    target[key] = {};
                }
                mergeDeep(target[key], srcVal);
            } else {
                target[key] = srcVal;
            }
        }
    }

    function loadSettings() {
        try {
            const saved = localStorage.getItem(SETTINGS_KEY);
            if (!saved) return;

            mergeDeep(userSettings, JSON.parse(saved));
        } catch (e) {
            console.error(`${SETTINGS_KEY} - Failed to load settings:`, e);
        }
    }

    function saveSettings() {
        try {
            localStorage.setItem(SETTINGS_KEY, JSON.stringify(userSettings));
        } catch (e) {
            console.error(`${SETTINGS_KEY} - Failed to save settings:`, e);
        }
    }

    function hasAnyFeatureEnabled() {
        const s = userSettings;

        return !!(
            s?.primary?.enabled ||
            s?.secondary?.enabled ||
            s?.poiCells?.enabled ||
            s?.highlightCell?.enabled
        );
    }

    function enableAllFeatures() {
        const s = userSettings;

        s.primary.enabled = true;
        s.secondary.enabled = true;
        s.poiCells.enabled = true;
        s.highlightCell.enabled = true;
    }

    // ======================================
    // IndexedDB persistence + in-memory cache
    // ======================================

    function getGamePoisIDBInstance(version) {
        return new Promise((resolve, reject) => {
            if (!window.indexedDB) {
                reject(new Error("This browser doesn't support IndexedDB"));
                return;
            }

            const openRequest = (typeof version === "number")
            ? indexedDB.open(DB_NAME, version)
            : indexedDB.open(DB_NAME);

            openRequest.onsuccess = (event) => {
                const db = event.target.result;

                // If our store does not exist, bump version and create it.
                if (!db.objectStoreNames.contains(POI_STORE_NAME)) {
                    const currentVersion = db.version;
                    db.close();
                    getGamePoisIDBInstance(currentVersion + 1).then(resolve, reject);
                    return;
                }

                resolve(db);
            };

            openRequest.onupgradeneeded = (event) => {
                const db = event.target.result;
                if (!db.objectStoreNames.contains(POI_STORE_NAME)) {
                    // keyPath "id" = guid or synthetic lat,lng id
                    db.createObjectStore(POI_STORE_NAME, { keyPath: "id" });
                }
            };

            openRequest.onerror = (event) => {
                reject(event.target.error || new Error("Failed to open IndexedDB"));
            };
        });
    }

    // Build a stable ID for a POI
    function buildGamePoiId(guid, lat, lng) {
        if (guid) return guid;
        if (typeof lat === "number" && typeof lng === "number") {
            // Fixed decimals so we don't get float noise in ids
            return `${lat.toFixed(7)},${lng.toFixed(7)}`;
        }
        return null;
    }

    function recalcOverlays() {
        bumpShadePoiVersion();
        shadePoiCells();
        refreshGamePoiMarkers();
    }

    // Load all stored POIs into memory
    function loadGamePoisFromIDB() {
        getGamePoisIDBInstance().then(db => {
            const tx = db.transaction(POI_STORE_NAME, "readonly");
            const store = tx.objectStore(POI_STORE_NAME);
            const req = store.getAll();

            req.onsuccess = () => {
                const all = req.result || [];
                gamePois = new Map();
                for (const rec of all) {
                    if (rec && rec.id) gamePois.set(rec.id, rec);
                }
            };

            req.onerror = () => {
                console.warn("[S2] Failed to load game POIs from IndexedDB", req.error);
            };

            tx.oncomplete = () => {
                db.close();
                recalcOverlays();
            };

            tx.onerror = () => {
                console.warn("[S2] Transaction error while loading game POIs", tx.error);
                db.close();
            };
        }).catch(err => {
            console.warn("[S2] IndexedDB not available (load game POIs):", err);
        });
    }

    // Upsert a single game POI
    function saveGamePoiToIDB(poi) {
        if (!poi || !poi.id) return Promise.resolve();

        return getGamePoisIDBInstance().then(db => new Promise((resolve, reject) => {
            const tx = db.transaction(POI_STORE_NAME, "readwrite");
            const store = tx.objectStore(POI_STORE_NAME);

            store.put(poi); // upsert by keyPath "id"
            gamePois.set(poi.id, poi);

            tx.oncomplete = () => {
                db.close();
                recalcOverlays();
                resolve();
            };

            tx.onerror = () => {
                console.warn("[S2] Transaction error while saving game POI", tx.error);
                db.close();
                reject(tx.error);
            };

            tx.onabort = () => {
                console.warn("[S2] Transaction aborted while saving game POI", tx.error);
                db.close();
                reject(tx.error);
            };
        })).catch(err => {
            console.warn("[S2] IndexedDB not available (save game POI):", err);
        });
    }

    // Delete a stored game POI by id
    function deleteGamePoiFromIDB(id) {
        if (!id) return Promise.resolve();

        return getGamePoisIDBInstance().then(db => new Promise((resolve, reject) => {
            const tx = db.transaction(POI_STORE_NAME, "readwrite");
            const store = tx.objectStore(POI_STORE_NAME);

            store.delete(id);
            gamePois.delete(id);

            tx.oncomplete = () => {
                db.close();
                recalcOverlays();
                resolve();
            };

            tx.onerror = () => {
                console.warn("[S2] Transaction error while deleting game POI", tx.error);
                db.close();
                reject(tx.error);
            };

            tx.onabort = () => {
                console.warn("[S2] Transaction aborted while deleting game POI", tx.error);
                db.close();
                reject(tx.error);
            };
        })).catch(err => {
            console.warn("[S2] IndexedDB not available (delete game POI):", err);
        });
    }

    // Bulk upsert POIs (used for IITC import).
    async function bulkUpsertGamePoisToIDB(records, opts = {}) {
        const onProgress = typeof opts.onProgress === "function" ? opts.onProgress : null;

        // Process this many records per transaction, then yield so the UI can repaint.
        const chunkSize = Number.isFinite(opts.yieldEvery) ? Math.max(1, opts.yieldEvery) : 250;

        // If true, skip the final overlay redraw (caller can trigger it later).
        const suppressRecalc = opts.suppressRecalc === true;

        if (!Array.isArray(records) || records.length === 0) {
            if (onProgress) onProgress(0, 0);
            return;
        }

        if (!gamePois) gamePois = new Map();

        const db = await getGamePoisIDBInstance();
        try {
            let written = 0;

            for (let start = 0; start < records.length; start += chunkSize) {
                const end = Math.min(start + chunkSize, records.length);

                await new Promise((resolve, reject) => {
                    const tx = db.transaction(POI_STORE_NAME, "readwrite");
                    const store = tx.objectStore(POI_STORE_NAME);

                    for (let i = start; i < end; i++) {
                        const poi = records[i];
                        if (!poi || !poi.id) continue;
                        store.put(poi);
                        gamePois.set(poi.id, poi);
                    }

                    tx.oncomplete = () => resolve();
                    tx.onerror = () => reject(tx.error || new Error("Bulk transaction failed"));
                    tx.onabort = () => reject(tx.error || new Error("Bulk transaction aborted"));
                });

                written = end;
                if (onProgress) onProgress(written, records.length);

                // Yield so progress UI updates render.
                await new Promise(r => setTimeout(r, 0));
            }
        } finally {
            db.close();
        }

        if (!suppressRecalc) {
            recalcOverlays();
        }
    }

    // ======================================
    // POI bridge + stored/live lookup
    // ======================================

    // Read the current POI payload from the bridge element.
    function getCurrentBridgePayload() {
        const bridge = document.getElementById(POI_BRIDGE_ID);
        if (!bridge) return null;

        const payloadRaw = bridge.getAttribute("data-payload");
        if (!payloadRaw) return null;

        try {
            return JSON.parse(payloadRaw);
        } catch (e) {
            console.error("[S2] Failed to parse POI bridge payload:", e);
            return null;
        }
    }

    // Find a stored record that corresponds to a bridge payload.
    function findStoredGamePoiForPayload(payload) {
        if (!payload || !gamePois || !gamePois.size) return null;

        // Fast path: payloads created by this plugin include storedId.
        if (payload.storedId && gamePois.has(payload.storedId)) {
            return gamePois.get(payload.storedId);
        }

        const guid = payload.guid || null;
        if (!guid) return null;

        // Fallback: scan for matching guid.
        for (const rec of gamePois.values()) {
            if (rec && rec.guid === guid) return rec;
        }
        return null;
    }

    // Try to find the current live POI entry that matches a stored record.
    function findLivePoiForStoredGamePoi(stored) {
        if (!stored || !Array.isArray(s2Pois) || !s2Pois.length) return null;

        const guid = stored.guid || stored.id || null;
        const lat  = typeof stored.lat === "number" ? stored.lat : null;
        const lng  = typeof stored.lng === "number" ? stored.lng : null;

        for (const p of s2Pois) {
            if (!p) continue;

            // Match by guid/id when available.
            if (guid && (p.guid === guid || p.id === guid)) return p;

            // Fallback: exact coordinates.
            if (
                lat != null && lng != null &&
                typeof p.lat === "number" && typeof p.lng === "number" &&
                p.lat === lat && p.lng === lng
            ) {
                return p;
            }
        }

        return null;
    }

    // Return a human-readable label for a Pokémon GO POI type.
    function getDisplayNameForPoiType(type) {
        switch (type) {
            case "stop":      return "PokéStop";
            case "gym":       return "Gym";
            case "powerspot": return "Power Spot";
            default:          return "Unknown";
        }
    }

    // Return the marker border colour for a POI type, with a safe fallback.
    function getStrokeColorForPoiType(type) {
        const cfg = userSettings.poiMarkers?.[type];
        return cfg?.borderColor || "#154aab";
    }

    // Build the payload sent via the POI bridge, preferring live data when available.
    function buildBridgePayloadFromPoi(stored, live) {
        const storedId = stored?.id || null;

        let guid = stored?.guid || null;
        let title = stored?.title || "";
        let description = stored?.description || "";
        let lat = stored?.lat ?? null;
        let lng = stored?.lng ?? null;
        let imageUrl = stored?.imageUrl || "";
        let status = stored?.status || "";

        // Prefer live details when available.
        if (live) {
            guid = live.guid || live.id || guid;
            title = live.title || title;
            description = live.description || description;
            lat = (typeof live.lat === "number") ? live.lat : lat;
            lng = (typeof live.lng === "number") ? live.lng : lng;
            imageUrl = live.imageUrl || imageUrl;
            status = "LIVE";
        }

        const type = stored?.poiType || "unknown";
        const dataSourceLogo = POI_TYPE_ICONS[type] || "";
        const dataSourceText = getDisplayNameForPoiType(type);
        const borderColor = getStrokeColorForPoiType(type);

        return {
            storedId,
            guid,
            title,
            description,
            lat,
            lng,
            imageUrl,
            status,
            type,
            source: POI_BRIDGE_SOURCE,
            dataSourceLogo,
            dataSourceText,
            borderColor
        };
    }

    // Persist newer live details back into the stored record (only for real stored POIs).
    function mergeLiveDetailsIntoStoredPoi(stored, live) {
        if (!stored || !live) return stored;
        if (!gamePois || !stored.id || !gamePois.has(stored.id)) return stored;

        let changed = false;
        const merged = { ...stored };

        if (typeof live.title === "string" && live.title !== merged.title) {
            merged.title = live.title;
            changed = true;
        }

        if (typeof live.description === "string" && live.description !== merged.description) {
            merged.description = live.description;
            changed = true;
        }

        if (typeof live.lat === "number" && live.lat !== merged.lat) {
            merged.lat = live.lat;
            changed = true;
        }

        if (typeof live.lng === "number" && live.lng !== merged.lng) {
            merged.lng = live.lng;
            changed = true;
        }

        // Allow clearing: if live.imageUrl is an empty string, accept that as "no image".
        if (typeof live.imageUrl === "string" && live.imageUrl !== (merged.imageUrl || "")) {
            merged.imageUrl = live.imageUrl;
            changed = true;
        }

        if (merged.status !== "LIVE") {
            merged.status = "LIVE";
            changed = true;
        }

        if (changed) {
            merged.updatedAt = Date.now();
            saveGamePoiToIDB(merged);
            return merged;
        }

        return stored;
    }

    // Push POI info into the bridge, then optionally enrich via live-pois-in-radius.
    function sendPoiToBridge(poi) {
        if (!poi) return;

        const bridge = document.getElementById(POI_BRIDGE_ID);
        if (!bridge) return;

        const liveFromCache = findLivePoiForStoredGamePoi(poi);
        const initialPayload = buildBridgePayloadFromPoi(poi, liveFromCache);

        let initialStr;
        try {
            initialStr = JSON.stringify(initialPayload);
            bridge.setAttribute("data-payload", initialStr);
        } catch (e) {
            console.warn("[S2] Failed to serialise POI for bridge", e);
            return;
        }

        // If we already have live data, don’t fetch again.
        if (liveFromCache) return;

        // Enrich details; guard against updating a different POI if selection changes.
        const expectedStoredId = initialPayload.storedId || null;
        const expectedGuid = initialPayload.guid || null;

        fetchLivePoiDetailsForStoredPoi(poi).then(live => {
            if (!live) return;

            const current = getCurrentBridgePayload();
            if (!current) return;

            if (
                (expectedStoredId && current.storedId !== expectedStoredId) ||
                (!expectedStoredId && expectedGuid && current.guid !== expectedGuid)
            ) {
                return; // selection changed since the request started
            }

            const updatedPayload = buildBridgePayloadFromPoi(poi, live);

            try {
                bridge.setAttribute("data-payload", JSON.stringify(updatedPayload));
            } catch (e) {
                console.warn("[S2] Failed to update POI bridge payload with live details", e);
            }
        });
    }

    // ======================================
    // IITC Import (PokéStops / Gyms / Power Spots)
    // ======================================

    // Manual (user-added) IITC entries use s2-pogo-* ids and do not correspond to Wayfarer guids.
    const IITC_IMPORT_MANUAL_STATUS  = "MANUAL IMPORT";
    const IITC_IMPORT_DEFAULT_STATUS = "IITC IMPORT"; // only used to fill blank status
    const IITC_MANUAL_GUID_PREFIX    = "s2-pogo-";


    async function promptAndImportIitcJson() {
        const file = await pickJsonFile();
        const text = await file.text();

        let json;
        try {
            json = JSON.parse(text);
        } catch {
            throw new Error("Invalid JSON.");
        }

        return importIitcPogoJson(json);
    }

    function pickJsonFile() {
        return new Promise((resolve, reject) => {
            const input = document.createElement("input");
            input.type = "file";
            input.accept = "application/json,.json";
            input.style.display = "none";

            input.addEventListener("change", () => {
                const f = input.files && input.files[0];
                input.remove();
                if (!f) return reject(new Error("No file selected."));
                resolve(f);
            });

            document.body.appendChild(input);
            input.click();
        });
    }

    function toNum(v) {
        if (typeof v === "number" && Number.isFinite(v)) return v;
        if (typeof v === "string") {
            const s = v.trim();
            if (!s) return null;
            const n = Number(s);
            return Number.isFinite(n) ? n : null;
        }
        return null;
    }

    function isFiniteNum(v) {
        return typeof v === "number" && Number.isFinite(v);
    }

    function isNonEmptyString(s) {
        return typeof s === "string" && s.trim() !== "";
    }

    // Prefer the existing DB record; only fill missing fields from import.
    // Returns { merged, changed } to avoid a second shallow-equality pass.
    function mergePreferExisting(existing, imported) {
        const merged = { ...existing };
        let changed = false;

        // These are fixed/authoritative from DB perspective
        merged.id = existing.id;
        merged.game = existing.game || "pokemon-go";

        const fillIfEmpty = (key) => {
            if (!isNonEmptyString(merged[key]) && isNonEmptyString(imported[key])) {
                merged[key] = imported[key];
                changed = true;
            }
        };

        const fillIfNotFinite = (key) => {
            if (!isFiniteNum(merged[key]) && isFiniteNum(imported[key])) {
                merged[key] = imported[key];
                changed = true;
            }
        };

        fillIfEmpty("poiType");
        fillIfEmpty("title");
        fillIfNotFinite("lat");
        fillIfNotFinite("lng");
        fillIfEmpty("description");
        fillIfEmpty("imageUrl");
        fillIfEmpty("guid");
        fillIfEmpty("status");

        if (isNonEmptyString(imported._iitcGuid) && merged._iitcGuid !== imported._iitcGuid) {
            merged._iitcGuid = imported._iitcGuid;
            changed = true;
        }

        return { merged, changed };
    }

    /**
     * Import IITC JSON into the plugin's IndexedDB format.
     * Conflict policy: existing DB values win; IITC only fills blanks.
     */
    async function importIitcPogoJson(iitc, ui = {}) {
        const summary = { created: 0, matched: 0, updated: 0, skipped: 0, total: 0 };
        if (!iitc || typeof iitc !== "object") return summary;

        const groups = [
            { key: "pokestops",  poiType: "stop" },
            { key: "gyms",       poiType: "gym" },
            { key: "powerspots", poiType: "powerspot" }
        ];

        const waypoints = (iitc.waypoints && typeof iitc.waypoints === "object") ? iitc.waypoints : {};

        // Pass 1: count total for progress UI (no allocations)
        for (const g of groups) {
            const bucket = iitc[g.key];
            if (!bucket || typeof bucket !== "object") continue;
            summary.total += Object.keys(bucket).length;
        }
        if (!summary.total) return summary;

        if (!gamePois) gamePois = new Map();

        const toWrite = [];
        let processed = 0;

        const onScanProgress = (typeof ui.onScanProgress === "function") ? ui.onScanProgress : null;
        const tick = () => {
            processed++;
            if (onScanProgress) onScanProgress(processed, summary.total);
        };

        // Pass 2: stream records and decide what to write
        for (const g of groups) {
            const bucket = iitc[g.key];
            if (!bucket || typeof bucket !== "object") continue;

            for (const [rawGuid, obj] of Object.entries(bucket)) {
                // IITC stores the guid as the key; obj.guid is usually the same.
                const id = String((obj && obj.guid) || rawGuid || "").trim();
                if (!id) {
                    summary.skipped++;
                    tick();
                    continue;
                }

                const isManual = id.startsWith(IITC_MANUAL_GUID_PREFIX);

                const lat = toNum(obj && obj.lat);
                const lng = toNum(obj && obj.lng);
                const title = (obj && typeof obj.name === "string") ? obj.name : "";

                // Waypoints can contain images even if the bucket entry doesn’t.
                const wp = waypoints[id] || null;
                const imageUrl = (wp && typeof wp.image === "string") ? wp.image : "";

                // Import record:
                // - id always equals IITC guid/key
                // - guid is null for manual s2-pogo-* entries, otherwise guid=id
                const imported = {
                    id,
                    guid: isManual ? null : id,
                    lat,
                    lng,
                    title,
                    description: "",
                    imageUrl: imageUrl || "",
                    status: isManual ? IITC_IMPORT_MANUAL_STATUS : IITC_IMPORT_DEFAULT_STATUS,
                    game: "pokemon-go",
                    poiType: g.poiType,
                    updatedAt: Date.now(),
                    _iitcGuid: id
                };

                const existing = gamePois.get(id) || null;

                if (!existing) {
                    // Skip records without numeric coords (markers/shading require numbers).
                    if (!isFiniteNum(imported.lat) || !isFiniteNum(imported.lng)) {
                        summary.skipped++;
                        tick();
                        continue;
                    }
                    toWrite.push(imported);
                    summary.created++;
                    tick();
                    continue;
                }

                summary.matched++;

                const { merged, changed } = mergePreferExisting(existing, imported);
                if (changed) {
                    merged.updatedAt = Date.now();
                    toWrite.push(merged);
                    summary.updated++;
                }

                tick();
            }
        }

        // Bulk write once + one redraw at end
        if (toWrite.length) {
            await bulkUpsertGamePoisToIDB(toWrite, {
                yieldEvery: 250,
                onProgress: ui.onWriteProgress
            });
        } else {
            if (typeof ui.onWriteProgress === "function") ui.onWriteProgress(0, 0);
        }

        return summary;
    }

    // -----------------------------
    // Map lifecycle + DOM watchers
    // -----------------------------

    function isOnMapPage() {
        return window.location.pathname.startsWith(MAP_PATH);
    }

    function onMapRouteChange() {
        if (isOnMapPage()) {
            // entering map route
            startMapPanelWatcher();
        } else {
            // leaving map route
            stopMapPanelWatcher();
            teardownMap();
            stopLatLngWatcher();
            stopPoiBridgeWatcher();
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
                    console.warn("[S2] Failed to find submit map after several attempts");
                    resolve(null);
                    return;
                }

                setTimeout(tryFindMap, 250);
            }

            tryFindMap();
        });
    }

    async function attachS2ToMapIfNeeded() {
        if (mapAttached) return;

        const map = await getSubmitMap();

        if (!map) {
            console.warn("[S2] Map not found – cannot attach");
            return;
        }

        submitMap = map;
        initS2Overlay();
    }

    function teardownMap() {
        if (!mapAttached) return;

        // Remove polygons
        clearPoiCellPolygons();
        clearGamePoiMarkers();

        // Clear S2 grid lines
        if (s2Overlay) {
            s2Overlay.clear();
            s2Overlay = null;
        }

        // Remove listeners we attached
        if (idleListener) {
            idleListener.remove();
            idleListener = null;
        }
        if (zoomListener) {
            zoomListener.remove();
            zoomListener = null;
        }

        // Drop references to the old map + POIs
        submitMap = null;
        s2Pois = [];

        mapAttached = false;

        removeManualImportMapButton();
    }

    function startMapPanelWatcher() {
        if (mapPanelObserver) return; // don't double-start

        // Run once at start in case the panel is already there
        handlePanelChange();

        mapPanelObserver = new MutationObserver(() => {
            // Debounce: collapse many mutations into one handler call
            if (mapPanelMutationScheduled) return;

            mapPanelMutationScheduled = true;

            requestAnimationFrame(() => {
                mapPanelMutationScheduled = false;
                handlePanelChange();
            });
        });

        mapPanelObserver.observe(document.body, {
            childList: true,
            subtree: true
        });
    }

    function stopMapPanelWatcher() {
        if (mapPanelObserver) {
            mapPanelObserver.disconnect();
            mapPanelObserver = null;
        }
        mapPanelMutationScheduled = false;
    }

    function handlePanelChange() {
        if (!document.querySelector("#wfmapmods-side-panel")) return;

        // Panel is present: initialise once and stop observing
        stopMapPanelWatcher();
        attachS2ToMapIfNeeded();
        insertS2SettingsLinks();
        startLatLngWatcher();
        insertS2LayersOption();
        insertPoiTypeUI();
        startPoiBridgeWatcher();
    }

    // ==================================
    // Lat/Lng observers - Find submit location
    // ==================================

    function parseLatLng(text) {
        if (!text) return null;
        const parts = text.split(',');
        if (parts.length !== 2) return null;

        const lat = parseFloat(parts[0].trim());
        const lng = parseFloat(parts[1].trim());

        if (isNaN(lat) || isNaN(lng)) return null;
        return { lat, lng };
    }

    function handleLatLngChange(newLat, newLng) {
        // Whenever the marker moves, update the L17 highlight
        highlightSubmitCell(newLat, newLng);
    }

    function startLatLngWatcher() {
        // Only initialise once
        if (latLngBodyObserver || latLngObserver) return;

        function stopBodyObserver() {
            if (!latLngBodyObserver) return;
            latLngBodyObserver.disconnect();
            latLngBodyObserver = null;
        }

        function attachToLatLngElement(el) {
            // If we're already observing this exact element, do nothing
            if (latLngTargetEl === el && latLngObserver) return;

            // Disconnect old element observer (if any)
            if (latLngObserver) {
                latLngObserver.disconnect();
                latLngObserver = null;
            }

            latLngTargetEl = el;

            // Element found: stop watching the entire DOM
            stopBodyObserver();

            let lastText = (el.textContent || "").trim();
            const initialCoords = parseLatLng(lastText);
            if (initialCoords) {
                handleLatLngChange(initialCoords.lat, initialCoords.lng);
            }

            // Watch for coordinate text updates
            latLngObserver = new MutationObserver(() => {
                const newText = (el.textContent || "").trim();
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

        function findAndAttachLatLngElement() {
            const el = document.querySelector(".submit-coordinates-text");
            if (!el) return;
            attachToLatLngElement(el);
        }

        // Wait for element to appear (once)
        latLngBodyObserver = new MutationObserver(() => {
            findAndAttachLatLngElement();
        });

        latLngBodyObserver.observe(document.body, {
            childList: true,
            subtree: true
        });

        // Try immediately in case it's already present
        findAndAttachLatLngElement();
    }

    function stopLatLngWatcher() {
        if (latLngObserver) {
            latLngObserver.disconnect();
            latLngObserver = null;
        }
        if (latLngBodyObserver) {
            latLngBodyObserver.disconnect();
            latLngBodyObserver = null;
        }
        latLngTargetEl = null;
    }

    // ==================================
    // POI bridge watcher & POI type UI visibility
    // ==================================

    function getPoiTypeSections() {
        return document.querySelectorAll(".wfmapmods-section-poi-types");
    }

    function setPoiTypeSectionsVisible(sections, visible) {
        const desired = visible ? "" : "none";
        sections.forEach(sec => {
            if (sec.style.display !== desired) {
                sec.style.display = desired;
            }
        });
    }

    function updatePoiTypeSectionsForBridge() {
        const payload = getCurrentBridgePayload();
        const sections = getPoiTypeSections();

        if (!payload) {
            setPoiTypeSectionsVisible(sections, false);
            return;
        }

        const guid = payload.guid || null;
        const lat  = (typeof payload.lat === "number") ? payload.lat : null;
        const lng  = (typeof payload.lng === "number") ? payload.lng : null;

        const payloadType = payload.type || null;

        // Only treat these types as "recognised"
        const isRecognisedType =
              payloadType === "stop" ||
              payloadType === "gym" ||
              payloadType === "powerspot" ||
              payloadType === "na";

        // Show when:
        // - the bridge already carries a recognised game type, OR
        // - it has a guid (normal Wayspot click), OR
        // - it matches a live-poi by exact coords (accepted ring fallback)
        let shouldShow = false;

        if (isRecognisedType || guid) {
            shouldShow = true;
        } else if (lat != null && lng != null && Array.isArray(s2Pois) && s2Pois.length) {
            shouldShow = s2Pois.some(p =>
                                     p &&
                                     typeof p.lat === "number" &&
                                     typeof p.lng === "number" &&
                                     p.lat === lat &&
                                     p.lng === lng
                                    );
        }

        if (!shouldShow) {
            setPoiTypeSectionsVisible(sections, false);
            return;
        }

        setPoiTypeSectionsVisible(sections, true);

        // Determine selected type: DB wins, otherwise use recognised payload type
        const stored = findStoredGamePoiForPayload(payload);
        const selectedType = stored?.poiType || (isRecognisedType ? payloadType : null);

        sections.forEach(sec => {
            const container = sec.querySelector(".wfmapmods-poi-type-links");
            applySelectedPoiTypeToContainer(container, selectedType);
        });
    }

    function startPoiBridgeWatcher() {
        if (poiBridgeObserver) return;

        let attempts = 10;

        const tryAttach = () => {
            const bridge = document.getElementById(POI_BRIDGE_ID);

            if (!bridge) {
                if (attempts-- > 0) {
                    setTimeout(tryAttach, 100);
                } else {
                    setPoiTypeSectionsVisible(getPoiTypeSections(), false);
                }
                return;
            }

            poiBridgeObserver = new MutationObserver(mutations => {
                for (const m of mutations) {
                    if (m.type === "attributes" && m.attributeName === "data-payload") {
                        updatePoiTypeSectionsForBridge();
                        break;
                    }
                }
            });

            poiBridgeObserver.observe(bridge, {
                attributes: true,
                attributeFilter: ["data-payload"]
            });

            // Initial sync
            updatePoiTypeSectionsForBridge();
        };

        tryAttach();
    }

    function stopPoiBridgeWatcher() {
        if (poiBridgeObserver) {
            poiBridgeObserver.disconnect();
            poiBridgeObserver = null;
        }
        setPoiTypeSectionsVisible(getPoiTypeSections(), false);
    }

    // ==================================
    // Sidebar integration points (links/options)
    // ==================================
    function insertS2LayersOption() {
        const menu = document.querySelector(".wfmapmods-layers-menu");
        if (!menu) return;

        if (menu.querySelector("#wfmapmods-layers-s2cells")) return;

        // ---------------------------------
        // Master "S2 cells" toggle
        // ---------------------------------
        const label = document.createElement("label");
        label.className = "wfmapmods-layers-option";
        label.id = "wfmapmods-layers-s2cells";

        const checkbox = document.createElement("input");
        checkbox.type = "checkbox";
        checkbox.checked = !userSettings.master || userSettings.master.enabled !== false;
        checkbox.className = "wfmapmods-layers-checkbox";

        const span = document.createElement("span");
        span.textContent = "S2 cells";
        span.className = "wfmapmods-layers-label";

        label.appendChild(checkbox);
        label.appendChild(span);
        menu.appendChild(label);

        checkbox.addEventListener("change", () => {
            const enabled = checkbox.checked;

            userSettings.master.enabled = enabled;

            if (!enabled) {
                if (s2Overlay) {
                    s2Overlay.clear();
                    s2Overlay = null;
                }
                lastGridKey = "";
                clearPoiCellPolygons();
                clearL14ShadingOnly();

                if (submitCellHighlight) {
                    submitCellHighlight.setMap(null);
                    submitCellHighlight = null;
                }

                saveSettings();
                return;
            }

            if (!hasAnyFeatureEnabled()) {
                enableAllFeatures();
            }

            saveSettings();

            if (submitMap) {
                if (!s2Overlay) {
                    initS2Overlay();
                } else {
                    updateS2Grid();
                    shadePoiCells();
                }
                refreshHighlightCell();
            }
        });

        // ---------------------------------
        // Helper to add a per-type toggle
        // ---------------------------------
        function addPoiLayerToggle(typeKey, labelText) {
            const id = `wfmapmods-layers-${typeKey}`;
            if (menu.querySelector(`#${id}`)) return;

            const label = document.createElement("label");
            label.className = "wfmapmods-layers-option";
            label.id = id;

            const checkbox = document.createElement("input");
            checkbox.type = "checkbox";
            checkbox.className = "wfmapmods-layers-checkbox";

            // Read current enabled flag from settings (default true if present)
            const cfg = userSettings.poiMarkers?.[typeKey];
            checkbox.checked = !!(cfg && cfg.enabled !== false);

            const span = document.createElement("span");
            span.textContent = labelText;
            span.className = "wfmapmods-layers-label";

            label.appendChild(checkbox);
            label.appendChild(span);
            menu.appendChild(label);

            checkbox.addEventListener("change", () => {
                const enabled = checkbox.checked;

                if (!userSettings.poiMarkers) {
                    userSettings.poiMarkers = {};
                }
                if (!userSettings.poiMarkers[typeKey]) {
                    userSettings.poiMarkers[typeKey] = {};
                }

                userSettings.poiMarkers[typeKey].enabled = enabled;

                saveSettings();
                // Rebuild markers using the new visibility settings
                refreshGamePoiMarkers();
            });
        }

        // ---------------------------------
        // Per-POI-type toggles
        // ---------------------------------
        addPoiLayerToggle("stop", "PokéStops");
        addPoiLayerToggle("gym", "Gyms");
        addPoiLayerToggle("powerspot", "Power Spots");
    }

    function insertS2SettingsLinks() {
        const settingsBody = document.querySelector(".wfmapmods-settings-links");
        if (!settingsBody) return;

        // Link #1: S2 Cells
        if (!document.getElementById("wfmapmods-settings-s2cells")) {
            const link1 = document.createElement("a");
            link1.id = "wfmapmods-settings-s2cells";
            link1.textContent = "S2 Cells";
            link1.addEventListener("click", () => openS2CellsSettingsWindow());
            settingsBody.appendChild(link1);
        }

        // Link #2: PGO POIs
        if (!document.getElementById("wfmapmods-settings-pgo-pois")) {
            const link2 = document.createElement("a");
            link2.id = "wfmapmods-settings-pgo-pois";
            link2.textContent = "PGO POIs";
            link2.addEventListener("click", () => openPogoPoisSettingsWindow());
            settingsBody.appendChild(link2);
        }
    }

    // ==================================
    // Settings windows (UI modals)
    // ==================================

    function openSettingsModal({ id, titleText, buildContent }) {
        if (document.getElementById(id)) return;

        const backdrop = document.createElement("div");
        backdrop.id = id;
        backdrop.className = "wfmapmods-s2-backdrop";

        function closeModal() {
            backdrop.removeEventListener("keydown", escHandler);
            backdrop.remove();
        }

        const dialog = document.createElement("div");
        dialog.className = "wfmapmods-s2-dialog";
        Object.assign(dialog.style, {
            minWidth: "380px",
            maxWidth: "520px",
            maxHeight: "80vh",
            display: "flex",
            flexDirection: "column"
        });

        const title = document.createElement("div");
        title.textContent = titleText;
        title.className = "wfmapmods-s2-title";
        dialog.appendChild(title);

        // ---- shared helpers ----
        function clamp(num, min, max) {
            num = Number(num);
            if (Number.isNaN(num)) return min;
            return Math.min(max, Math.max(min, num));
        }

        function styleAsLinkButton(btn) {
            btn.type = "button";
            btn.className = "wfmapmods-s2-link-button";
            Object.assign(btn.style, {
                background: "transparent",
                border: "none",
                cursor: "pointer",
                fontSize: "11px",
                textDecoration: "underline",
                padding: "0",
                margin: "0"
            });
        }

        function hexToRgba(hex, opacity) {
            let h = (hex || "#000000").replace("#", "");
            if (h.length === 3) h = h.split("").map(ch => ch + ch).join("");
            const r = parseInt(h.slice(0, 2), 16);
            const g = parseInt(h.slice(2, 4), 16);
            const b = parseInt(h.slice(4, 6), 16);
            const a = typeof opacity === "number" ? opacity : 1;
            return `rgba(${r}, ${g}, ${b}, ${a})`;
        }

        function redrawAll() {
            if (submitMap && s2Overlay) {
                s2Overlay.clear();
                drawS2Grid();
                shadePoiCells();
            } else if (submitMap && !s2Overlay) {
                initS2Overlay();
            }

            refreshHighlightCell();
            refreshGamePoiMarkers();
        }

        // Caller builds all sections + returns { onOk?, onCancel? }
        const hooks = buildContent({
            dialog,
            backdrop,
            closeModal,
            clamp,
            styleAsLinkButton,
            hexToRgba,
            redrawAll
        }) || {};

        function escHandler(ev) {
            if (ev.key === "Escape") {
                ev.preventDefault();
                ev.stopPropagation();
                if (typeof hooks.onCancel === "function") hooks.onCancel();
                closeModal();
            } else if (ev.key === "Enter") {
                ev.preventDefault();
                ev.stopPropagation();
                if (typeof hooks.onOk === "function") hooks.onOk();
            }
        }

        backdrop.addEventListener("keydown", escHandler);
        backdrop.addEventListener("click", (ev) => {
            if (ev.target === backdrop) {
                if (typeof hooks.onCancel === "function") hooks.onCancel();
                closeModal();
            }
        });

        backdrop.appendChild(dialog);
        document.body.appendChild(backdrop);
        dialog.tabIndex = -1;
        dialog.focus();
    }

    function openS2CellsSettingsWindow() {
        openSettingsModal({
            id: "wfmapmods-s2cells-modal-backdrop",
            titleText: "S2 Cells Options",
            buildContent({ dialog, closeModal, clamp, styleAsLinkButton, redrawAll }) {
                // Ensure settings objects exist
                userSettings.primary = userSettings.primary || {};
                userSettings.secondary = userSettings.secondary || {};
                userSettings.poiCells = userSettings.poiCells || {};
                userSettings.highlightCell = userSettings.highlightCell || {};
                userSettings.l14Cells = userSettings.l14Cells || {};

                const primary   = userSettings.primary;
                const secondary = userSettings.secondary;
                const poiCells  = userSettings.poiCells;
                const highlight = userSettings.highlightCell;
                const l14       = userSettings.l14Cells;

                // =========================
                // S2 GRIDS (primary + secondary)
                // =========================
                const gridsGroup = document.createElement("div");
                gridsGroup.className = "wfmapmods-s2-section";

                const gridsHeader = document.createElement("div");
                gridsHeader.textContent = "S2 Grids";
                gridsHeader.className = "wfmapmods-s2-section-header";
                gridsGroup.appendChild(gridsHeader);

                const gridsHint = document.createElement("div");
                gridsHint.textContent = "Show primary/secondary S2 grids and adjust their levels. Use Customise… to change line style.";
                gridsHint.style.fontSize = "11px";
                gridsHint.style.marginBottom = "6px";
                gridsGroup.appendChild(gridsHint);

                // Primary row
                const primaryRow = document.createElement("div");
                primaryRow.className = "wfmapmods-s2-row wfmapmods-s2-row-marker";

                const primaryLeft = document.createElement("div");
                primaryLeft.style.display = "flex";
                primaryLeft.style.alignItems = "center";
                primaryLeft.style.gap = "6px";

                const primaryEnabledInput = document.createElement("input");
                primaryEnabledInput.type = "checkbox";
                primaryEnabledInput.checked = primary.enabled !== false;

                const primaryLabel = document.createElement("span");
                primaryLabel.textContent = "Show primary grid";
                primaryLabel.className = "wfmapmods-s2-grid-toggle-label";

                const primaryLevelLabel = document.createElement("span");
                primaryLevelLabel.textContent = "Level";
                primaryLevelLabel.style.fontSize = "11px";
                primaryLevelLabel.style.marginLeft = "10px";

                const primaryLevelInput = document.createElement("input");
                primaryLevelInput.type = "number";
                primaryLevelInput.min = "1";
                primaryLevelInput.max = "30";
                primaryLevelInput.value = primary.level ?? 17;
                primaryLevelInput.style.width = "60px";

                primaryLeft.appendChild(primaryEnabledInput);
                primaryLeft.appendChild(primaryLabel);
                primaryLeft.appendChild(primaryLevelLabel);
                primaryLeft.appendChild(primaryLevelInput);

                const primaryCustomBtn = document.createElement("button");
                primaryCustomBtn.textContent = "Customise…";
                styleAsLinkButton(primaryCustomBtn);
                primaryCustomBtn.style.marginLeft = "auto";
                primaryCustomBtn.addEventListener("click", () => {
                    openGridStyleModal("primary", "Primary grid", primary, () => {
                        saveSettings();
                        redrawAll();
                    });
                });

                primaryRow.appendChild(primaryLeft);
                primaryRow.appendChild(primaryCustomBtn);
                gridsGroup.appendChild(primaryRow);

                // Secondary row
                const secondaryRow = document.createElement("div");
                secondaryRow.className = "wfmapmods-s2-row wfmapmods-s2-row-marker";

                const secondaryLeft = document.createElement("div");
                secondaryLeft.style.display = "flex";
                secondaryLeft.style.alignItems = "center";
                secondaryLeft.style.gap = "6px";

                const secondaryEnabledInput = document.createElement("input");
                secondaryEnabledInput.type = "checkbox";
                secondaryEnabledInput.checked = secondary.enabled !== false;

                const secondaryLabel = document.createElement("span");
                secondaryLabel.textContent = "Show secondary grid";
                secondaryLabel.className = "wfmapmods-s2-grid-toggle-label";

                const secondaryLevelLabel = document.createElement("span");
                secondaryLevelLabel.textContent = "Level";
                secondaryLevelLabel.style.fontSize = "11px";
                secondaryLevelLabel.style.marginLeft = "10px";

                const secondaryLevelInput = document.createElement("input");
                secondaryLevelInput.type = "number";
                secondaryLevelInput.min = "1";
                secondaryLevelInput.max = "30";
                secondaryLevelInput.value = secondary.level ?? 14;
                secondaryLevelInput.style.width = "60px";

                secondaryLeft.appendChild(secondaryEnabledInput);
                secondaryLeft.appendChild(secondaryLabel);
                secondaryLeft.appendChild(secondaryLevelLabel);
                secondaryLeft.appendChild(secondaryLevelInput);

                const secondaryCustomBtn = document.createElement("button");
                secondaryCustomBtn.textContent = "Customise…";
                styleAsLinkButton(secondaryCustomBtn);
                secondaryCustomBtn.style.marginLeft = "auto";
                secondaryCustomBtn.addEventListener("click", () => {
                    openGridStyleModal("secondary", "Secondary grid", secondary, () => {
                        saveSettings();
                        redrawAll();
                    });
                });

                secondaryRow.appendChild(secondaryLeft);
                secondaryRow.appendChild(secondaryCustomBtn);
                gridsGroup.appendChild(secondaryRow);

                dialog.appendChild(gridsGroup);

                // =========================
                // S2 CELL SHADING (L17 + L14)
                // =========================
                const shadingGroup = document.createElement("div");
                shadingGroup.className = "wfmapmods-s2-section";

                const shadingHeader = document.createElement("div");
                shadingHeader.textContent = "S2 Cell Shading";
                shadingHeader.className = "wfmapmods-s2-section-header";
                shadingGroup.appendChild(shadingHeader);

                const shadingHint = document.createElement("div");
                shadingHint.textContent = "Shading options for L14 and L17 cells based on PokéStops and Gyms.";
                shadingHint.style.fontSize = "11px";
                shadingHint.style.marginBottom = "6px";
                shadingGroup.appendChild(shadingHint);

                // L17 shaded cells
                const shadeRow = document.createElement("div");
                shadeRow.className = "wfmapmods-s2-row wfmapmods-s2-row-marker";

                const shadeLeft = document.createElement("div");
                shadeLeft.style.display = "flex";
                shadeLeft.style.alignItems = "center";
                shadeLeft.style.gap = "6px";

                const shadeEnabledInput = document.createElement("input");
                shadeEnabledInput.type = "checkbox";
                shadeEnabledInput.checked = poiCells.enabled !== false;

                const shadeLabel = document.createElement("span");
                shadeLabel.textContent = "Shade L17 occupied cells";

                shadeLeft.appendChild(shadeEnabledInput);
                shadeLeft.appendChild(shadeLabel);

                const shadeCustomBtn = document.createElement("button");
                shadeCustomBtn.textContent = "Customise…";
                styleAsLinkButton(shadeCustomBtn);
                shadeCustomBtn.style.marginLeft = "auto";
                shadeCustomBtn.addEventListener("click", () => {
                    openShadingStyleModal(
                        "l17",
                        "L17 shaded cells options",
                        poiCells,
                        "color",
                        "fillOpacity",
                        () => {
                            saveSettings();
                            shadePoiCells();
                        }
                    );
                });

                shadeRow.appendChild(shadeLeft);
                shadeRow.appendChild(shadeCustomBtn);
                shadingGroup.appendChild(shadeRow);

                // L14 undercrowded
                const l14UnderRow = document.createElement("div");
                l14UnderRow.className = "wfmapmods-s2-row wfmapmods-s2-row-marker";

                const l14UnderLeft = document.createElement("div");
                l14UnderLeft.style.display = "flex";
                l14UnderLeft.style.alignItems = "center";
                l14UnderLeft.style.gap = "6px";

                const l14UnderInput = document.createElement("input");
                l14UnderInput.type = "checkbox";
                l14UnderInput.checked = l14.shadeUndercrowded !== false;

                const l14UnderLabel = document.createElement("span");
                l14UnderLabel.textContent = "Shade L14 undercrowded gym cells";

                l14UnderLeft.appendChild(l14UnderInput);
                l14UnderLeft.appendChild(l14UnderLabel);

                const l14UnderCustomBtn = document.createElement("button");
                l14UnderCustomBtn.textContent = "Customise…";
                styleAsLinkButton(l14UnderCustomBtn);
                l14UnderCustomBtn.style.marginLeft = "auto";
                l14UnderCustomBtn.addEventListener("click", () => {
                    openShadingStyleModal(
                        "l14-under",
                        "Undercrowded L14 shading",
                        l14,
                        "undercrowdedColor",
                        "undercrowdedOpacity",
                        () => {
                            saveSettings();
                            shadePoiCells();
                        }
                    );
                });

                l14UnderRow.appendChild(l14UnderLeft);
                l14UnderRow.appendChild(l14UnderCustomBtn);
                shadingGroup.appendChild(l14UnderRow);

                // L14 overcrowded
                const l14OverRow = document.createElement("div");
                l14OverRow.className = "wfmapmods-s2-row wfmapmods-s2-row-marker";

                const l14OverLeft = document.createElement("div");
                l14OverLeft.style.display = "flex";
                l14OverLeft.style.alignItems = "center";
                l14OverLeft.style.gap = "6px";

                const l14OverInput = document.createElement("input");
                l14OverInput.type = "checkbox";
                l14OverInput.checked = l14.shadeOvercrowded !== false;

                const l14OverLabel = document.createElement("span");
                l14OverLabel.textContent = "Shade L14 overcrowded gym cells";

                l14OverLeft.appendChild(l14OverInput);
                l14OverLeft.appendChild(l14OverLabel);

                const l14OverCustomBtn = document.createElement("button");
                l14OverCustomBtn.textContent = "Customise…";
                styleAsLinkButton(l14OverCustomBtn);
                l14OverCustomBtn.style.marginLeft = "auto";
                l14OverCustomBtn.addEventListener("click", () => {
                    openShadingStyleModal(
                        "l14-over",
                        "Overcrowded L14 shading",
                        l14,
                        "overcrowdedColor",
                        "overcrowdedOpacity",
                        () => {
                            saveSettings();
                            shadePoiCells();
                        }
                    );
                });

                l14OverRow.appendChild(l14OverLeft);
                l14OverRow.appendChild(l14OverCustomBtn);
                shadingGroup.appendChild(l14OverRow);

                dialog.appendChild(shadingGroup);

                // =========================
                // S2 CELL HIGHLIGHTING
                // =========================
                const highlightGroup = document.createElement("div");
                highlightGroup.className = "wfmapmods-s2-section";

                const highlightHeader = document.createElement("div");
                highlightHeader.textContent = "S2 Cell Highlighting";
                highlightHeader.className = "wfmapmods-s2-section-header";
                highlightGroup.appendChild(highlightHeader);

                const highlightHint = document.createElement("div");
                highlightHint.textContent = "Highlight the L17 cell that contains the current submission marker.";
                highlightHint.style.fontSize = "11px";
                highlightHint.style.marginBottom = "6px";
                highlightGroup.appendChild(highlightHint);

                const highlightRow = document.createElement("div");
                highlightRow.className = "wfmapmods-s2-row wfmapmods-s2-row-marker";

                const highlightLeft = document.createElement("div");
                highlightLeft.style.display = "flex";
                highlightLeft.style.alignItems = "center";
                highlightLeft.style.gap = "6px";

                const highlightEnabledInput = document.createElement("input");
                highlightEnabledInput.type = "checkbox";
                highlightEnabledInput.checked = highlight.enabled !== false;

                const highlightLabel = document.createElement("span");
                highlightLabel.textContent = "Highlight submission L17 cell";

                highlightLeft.appendChild(highlightEnabledInput);
                highlightLeft.appendChild(highlightLabel);

                const highlightCustomBtn = document.createElement("button");
                highlightCustomBtn.textContent = "Customise…";
                styleAsLinkButton(highlightCustomBtn);
                highlightCustomBtn.style.marginLeft = "auto";
                highlightCustomBtn.addEventListener("click", () => {
                    openHighlightStyleModal(highlight, () => {
                        saveSettings();
                        refreshHighlightCell();
                    });
                });

                highlightRow.appendChild(highlightLeft);
                highlightRow.appendChild(highlightCustomBtn);
                highlightGroup.appendChild(highlightRow);

                dialog.appendChild(highlightGroup);

                // =========================
                // GYM ANALYSIS (labels only)
                // =========================
                const gymGroup = document.createElement("div");
                gymGroup.className = "wfmapmods-s2-section wfmapmods-s2-section--no-border";

                const gymHeader = document.createElement("div");
                gymHeader.textContent = "Gym Analysis";
                gymHeader.className = "wfmapmods-s2-section-header";
                gymGroup.appendChild(gymHeader);

                const gymHint = document.createElement("div");
                gymHint.textContent = "Show labels indicating how many POIs are needed until the next gym in each L14 cell.";
                gymHint.style.fontSize = "11px";
                gymHint.style.marginBottom = "6px";
                gymGroup.appendChild(gymHint);

                const l14LabelsRow = document.createElement("div");
                l14LabelsRow.className = "wfmapmods-s2-row";

                const l14LabelsInput = document.createElement("input");
                l14LabelsInput.type = "checkbox";
                l14LabelsInput.checked = l14.showLabels !== false;

                const l14LabelsLabel = document.createElement("span");
                l14LabelsLabel.textContent = "Show “POIs until next gym” labels";

                l14LabelsRow.appendChild(l14LabelsInput);
                l14LabelsRow.appendChild(l14LabelsLabel);
                gymGroup.appendChild(l14LabelsRow);

                dialog.appendChild(gymGroup);

                // =========================
                // Buttons
                // =========================
                const buttonsRow = document.createElement("div");
                buttonsRow.className = "wfmapmods-s2-buttons";

                const cancelBtn = document.createElement("button");
                cancelBtn.type = "button";
                cancelBtn.textContent = "Cancel";
                cancelBtn.className = "wfmapmods-s2-btn wfmapmods-s2-btn-cancel";

                const okBtn = document.createElement("button");
                okBtn.type = "button";
                okBtn.textContent = "OK";
                okBtn.className = "wfmapmods-s2-btn wfmapmods-s2-btn-ok";

                buttonsRow.appendChild(cancelBtn);
                buttonsRow.appendChild(okBtn);
                dialog.appendChild(buttonsRow);

                cancelBtn.addEventListener("click", () => {
                    loadSettings();
                    redrawAll();
                    closeModal();
                });

                okBtn.addEventListener("click", () => {
                    // PRIMARY
                    primary.enabled = !!primaryEnabledInput.checked;
                    primary.level   = clamp(primaryLevelInput.value, 1, 30, primary.level ?? 17);

                    // SECONDARY
                    secondary.enabled = !!secondaryEnabledInput.checked;
                    secondary.level   = clamp(secondaryLevelInput.value, 1, 30, secondary.level ?? 14);

                    // L17 shading
                    poiCells.enabled = !!shadeEnabledInput.checked;

                    // Submission highlight
                    highlight.enabled = !!highlightEnabledInput.checked;

                    // L14 shading + labels
                    const underOn  = !!l14UnderInput.checked;
                    const overOn   = !!l14OverInput.checked;
                    const labelsOn = !!l14LabelsInput.checked;

                    l14.shadeUndercrowded = underOn;
                    l14.shadeOvercrowded  = overOn;
                    l14.showLabels        = labelsOn;
                    l14.enabled           = !!(underOn || overOn || labelsOn);

                    saveSettings();
                    redrawAll();
                    closeModal();
                });

                return {
                    onOk: () => okBtn.click(),
                    onCancel: () => {
                        loadSettings();
                        redrawAll();
                    }
                };
            }
        });
    }

    function openPogoPoisSettingsWindow() {
        openSettingsModal({
            id: "wfmapmods-pgo-pois-modal-backdrop",
            titleText: "Pokémon GO POIs",
            buildContent({ dialog, closeModal, styleAsLinkButton, hexToRgba, redrawAll }) {
                // Thinner modal (this window doesn’t need the default width)
                Object.assign(dialog.style, {
                    minWidth: "320px",
                    maxWidth: "420px"
                });

                userSettings.poiMarkers = userSettings.poiMarkers || {};
                userSettings.poiMarkers.hideAtLowZoom =
                    userSettings.poiMarkers.hideAtLowZoom || { enabled: true };

                const poiMarkers = userSettings.poiMarkers;

                // ===============================
                // Marker options
                // ===============================
                const markerGroup = document.createElement("div");
                markerGroup.className = "wfmapmods-s2-section";

                const markerHeader = document.createElement("div");
                markerHeader.textContent = "Pokémon GO Markers";
                markerHeader.className = "wfmapmods-s2-section-header";
                markerGroup.appendChild(markerHeader);

                const markerHint = document.createElement("div");
                markerHint.textContent = "Toggle marker types and adjust their appearance.";
                markerHint.style.fontSize = "11px";
                markerHint.style.marginBottom = "6px";
                markerGroup.appendChild(markerHint);

                const TYPES = [
                    { key: "stop",      label: "PokéStops" },
                    { key: "gym",       label: "Gyms" },
                    { key: "powerspot", label: "Power Spots" }
                ];

                // Ensure per-type cfg exists so UI never crashes
                for (const { key } of TYPES) {
                    poiMarkers[key] = poiMarkers[key] || { enabled: true };
                }

                const markerRows = {};

                TYPES.forEach(({ key, label }) => {
                    const cfg = poiMarkers[key];

                    const row = document.createElement("div");
                    row.className = "wfmapmods-s2-row wfmapmods-s2-row-marker";

                    const left = document.createElement("div");
                    left.className = "wfmapmods-s2-marker-left";
                    left.style.display = "flex";
                    left.style.alignItems = "center";
                    left.style.gap = "6px";

                    const showCheckbox = document.createElement("input");
                    showCheckbox.type = "checkbox";
                    showCheckbox.checked = cfg.enabled !== false;

                    const showLabel = document.createElement("span");
                    showLabel.textContent = label;

                    left.appendChild(showCheckbox);
                    left.appendChild(showLabel);

                    // Preview container + circle (for alignment)
                    const previewWrapper = document.createElement("div");
                    previewWrapper.className = "wfmapmods-s2-marker-preview";

                    const preview = document.createElement("div");
                    preview.className = "wfmapmods-s2-marker-preview-circle";
                    previewWrapper.appendChild(preview);

                    function updatePreview() {
                        const borderColor  = cfg.borderColor || "#000000";
                        const borderWidth  = typeof cfg.borderWidth === "number" ? cfg.borderWidth : 2;
                        const borderOp     = typeof cfg.borderOpacity === "number" ? cfg.borderOpacity : 1.0;
                        const fillColor    = cfg.fillColor || "#000000";
                        const fillOpacity  = typeof cfg.fillOpacity === "number" ? cfg.fillOpacity : 1.0;
                        const size         = typeof cfg.markerSize === "number" ? cfg.markerSize : 8;

                        // Clamp visual size so huge markers don’t break layout
                        const px = Math.max(6, Math.min(18, size * 2));
                        preview.style.width  = `${px}px`;
                        preview.style.height = `${px}px`;
                        preview.style.border = `${borderWidth}px solid ${hexToRgba(borderColor, borderOp)}`;
                        preview.style.backgroundColor = hexToRgba(fillColor, fillOpacity);
                    }

                    updatePreview();

                    const customiseBtn = document.createElement("button");
                    customiseBtn.textContent = "Customise…";
                    styleAsLinkButton(customiseBtn);
                    customiseBtn.style.marginLeft = "auto";

                    markerRows[key] = { showCheckbox, cfg, updatePreview };

                    customiseBtn.addEventListener("click", () => {
                        openPoiMarkerStyleModal(key, label, cfg, () => {
                            saveSettings();
                            refreshGamePoiMarkers();
                            updatePreview();
                        });
                    });

                    row.appendChild(left);
                    row.appendChild(previewWrapper);
                    row.appendChild(customiseBtn);
                    markerGroup.appendChild(row);
                });

                dialog.appendChild(markerGroup);

                // ===============================
                // Performance (low zoom)
                // ===============================
                const perfGroup = document.createElement("div");
                perfGroup.className = "wfmapmods-s2-section";

                const perfHeader = document.createElement("div");
                perfHeader.textContent = "Performance";
                perfHeader.className = "wfmapmods-s2-section-header";
                perfGroup.appendChild(perfHeader);

                const perfHint = document.createElement("div");
                perfHint.textContent = "Hide markers at low zoom levels to keep the map responsive when you have lots of POIs.";
                perfHint.style.fontSize = "11px";
                perfHint.style.marginBottom = "6px";
                perfGroup.appendChild(perfHint);

                const lowZoomRow = document.createElement("div");
                lowZoomRow.className = "wfmapmods-s2-row";

                const lowZoomInput = document.createElement("input");
                lowZoomInput.type = "checkbox";
                lowZoomInput.checked = poiMarkers.hideAtLowZoom?.enabled !== false;

                const lowZoomLabel = document.createElement("span");
                lowZoomLabel.textContent = "Hide game POI markers at low zoom levels";

                lowZoomRow.appendChild(lowZoomInput);
                lowZoomRow.appendChild(lowZoomLabel);
                perfGroup.appendChild(lowZoomRow);

                dialog.appendChild(perfGroup);

                // ===============================
                // Import from IITC (bottom)
                // ===============================
                const importGroup = document.createElement("div");
                importGroup.className = "wfmapmods-s2-section wfmapmods-s2-section--no-border";

                const importHeader = document.createElement("div");
                importHeader.textContent = "Import from IITC";
                importHeader.className = "wfmapmods-s2-section-header";
                importGroup.appendChild(importHeader);

                const importHint = document.createElement("div");
                importHint.textContent =
                    'Export a Pokestops and Gyms .json from IITC via the "Pogo Actions" link and then import here to transfer across your POI collection.';
                importHint.style.fontSize = "11px";
                importHint.style.marginBottom = "6px";
                importGroup.appendChild(importHint);

                const importRow = document.createElement("div");
                importRow.className = "wfmapmods-s2-row";
                importRow.style.display = "flex";
                importRow.style.flexDirection = "column";
                importRow.style.gap = "6px";

                const importBtn = document.createElement("button");
                importBtn.type = "button";
                importBtn.textContent = "Import from IITC JSON…";
                styleAsLinkButton(importBtn);

                const importStatus = document.createElement("div");
                importStatus.style.fontSize = "11px";
                importStatus.style.color = "#6b7280";
                importStatus.textContent = "";

                const progressWrap = document.createElement("div");
                progressWrap.style.display = "none";
                progressWrap.style.flexDirection = "column";
                progressWrap.style.gap = "4px";

                const scanLine = document.createElement("div");
                scanLine.style.fontSize = "11px";
                scanLine.style.color = "#6b7280";

                const writeLine = document.createElement("div");
                writeLine.style.fontSize = "11px";
                writeLine.style.color = "#6b7280";

                const bar = document.createElement("progress");
                bar.max = 1;
                bar.value = 0;
                bar.style.width = "100%";
                bar.style.height = "10px";

                progressWrap.appendChild(scanLine);
                progressWrap.appendChild(writeLine);
                progressWrap.appendChild(bar);

                importRow.appendChild(importBtn);
                importRow.appendChild(importStatus);
                importRow.appendChild(progressWrap);
                importGroup.appendChild(importRow);

                importBtn.addEventListener("click", async () => {
                    importBtn.disabled = true;
                    importStatus.textContent = "";
                    progressWrap.style.display = "flex";
                    scanLine.textContent = "Scanning IITC data…";
                    writeLine.textContent = "";
                    bar.value = 0;

                    try {
                        const file = await pickJsonFile();
                        const text = await file.text();
                        const json = JSON.parse(text);

                        let scanTotal = 0;

                        const summary = await importIitcPogoJson(json, {
                            onScanProgress(done, total) {
                                scanTotal = total;
                                bar.max = Math.max(1, total);
                                bar.value = done;
                                scanLine.textContent = `Scanning… ${done} / ${total}`;
                            },
                            onWriteProgress(done, total) {
                                writeLine.textContent = `Writing to IndexedDB… ${done} / ${total}`;
                            }
                        });

                        bar.value = bar.max;
                        scanLine.textContent = "✔ Scan complete";
                        writeLine.textContent = `✔ Import complete (${scanTotal} items)`;

                        importStatus.textContent =
                            `Imported: ${summary.created} new, ` +
                            `${summary.updated} updated, ` +
                            `${summary.matched} matched, ` +
                            `${summary.skipped} skipped`;

                        redrawAll();
                    } catch (e) {
                        console.error("[IITC] Import failed", e);
                        scanLine.textContent = "✖ Import failed";
                        writeLine.textContent = "";
                        importStatus.textContent = "Import failed (see console)";
                    } finally {
                        importBtn.disabled = false;
                    }
                });

                dialog.appendChild(importGroup);

                // =========================
                // Buttons
                // =========================
                const buttonsRow = document.createElement("div");
                buttonsRow.className = "wfmapmods-s2-buttons";

                const cancelBtn = document.createElement("button");
                cancelBtn.type = "button";
                cancelBtn.textContent = "Cancel";
                cancelBtn.className = "wfmapmods-s2-btn wfmapmods-s2-btn-cancel";

                const okBtn = document.createElement("button");
                okBtn.type = "button";
                okBtn.textContent = "OK";
                okBtn.className = "wfmapmods-s2-btn wfmapmods-s2-btn-ok";

                buttonsRow.appendChild(cancelBtn);
                buttonsRow.appendChild(okBtn);
                dialog.appendChild(buttonsRow);

                cancelBtn.addEventListener("click", () => {
                    loadSettings();
                    redrawAll();
                    closeModal();
                });

                okBtn.addEventListener("click", () => {
                    // Low-zoom marker option
                    poiMarkers.hideAtLowZoom = poiMarkers.hideAtLowZoom || {};
                    poiMarkers.hideAtLowZoom.enabled = !!lowZoomInput.checked;

                    // Per-type enabled flags
                    TYPES.forEach(({ key }) => {
                        const row = markerRows[key];
                        if (!row) return;
                        row.cfg.enabled = !!row.showCheckbox.checked;
                    });

                    saveSettings();
                    refreshGamePoiMarkers();
                    closeModal();
                });

                return {
                    onOk: () => okBtn.click(),
                    onCancel: () => {
                        loadSettings();
                        redrawAll();
                    }
                };
            }
        });
    }


    function openGridStyleModal(key, label, cfg, onUpdated) {
        const existing = document.getElementById(`wfmapmods-s2-grid-style-${key}`);
        if (existing) return;

        const backdrop = document.createElement("div");
        backdrop.id = `wfmapmods-s2-grid-style-${key}`;
        backdrop.className = "wfmapmods-s2-backdrop";

        function close() {
            backdrop.removeEventListener("keydown", escHandler);
            backdrop.remove();
        }

        function escHandler(ev) {
            if (ev.key === "Escape") {
                ev.preventDefault();
                ev.stopPropagation();
                close();
            } else if (ev.key === "Enter") {
                ev.preventDefault();
                ev.stopPropagation();
                okBtn.click();
            }
        }

        const dialog = document.createElement("div");
        dialog.className = "wfmapmods-s2-dialog";

        const title = document.createElement("div");
        title.className = "wfmapmods-s2-title";
        title.textContent = `Customise ${label}`;
        dialog.appendChild(title);

        function makeRow(labelText, inputEl) {
            const row = document.createElement("div");
            row.className = "wfmapmods-s2-row";

            const labelEl = document.createElement("label");
            labelEl.textContent = labelText;
            labelEl.className = "wfmapmods-s2-label";

            row.appendChild(labelEl);
            row.appendChild(inputEl);
            return row;
        }

        function clamp(num, min, max, def) {
            num = Number(num);
            if (Number.isNaN(num)) return def;
            return Math.min(max, Math.max(min, num));
        }

        const colorInput = document.createElement("input");
        colorInput.type = "color";
        colorInput.value = cfg.color || (key === "primary" ? "#00B303" : "#FF0000");

        const widthInput = document.createElement("input");
        widthInput.type = "number";
        widthInput.min = "0.5";
        widthInput.max = "10";
        widthInput.step = "0.5";
        widthInput.value = cfg.lineWidth ?? (key === "primary" ? 1 : 2);

        const opacityInput = document.createElement("input");
        opacityInput.type = "number";
        opacityInput.min = "0";
        opacityInput.max = "1";
        opacityInput.step = "0.05";
        opacityInput.value = cfg.lineOpacity ?? 1.0;

        dialog.appendChild(makeRow("Line colour", colorInput));
        dialog.appendChild(makeRow("Line thickness", widthInput));
        dialog.appendChild(makeRow("Line opacity", opacityInput));

        const buttonsRow = document.createElement("div");
        buttonsRow.className = "wfmapmods-s2-buttons";

        const cancelBtn = document.createElement("button");
        cancelBtn.type = "button";
        cancelBtn.textContent = "Cancel";
        cancelBtn.className = "wfmapmods-s2-btn wfmapmods-s2-btn-cancel";

        const okBtn = document.createElement("button");
        okBtn.type = "button";
        okBtn.textContent = "OK";
        okBtn.className = "wfmapmods-s2-btn wfmapmods-s2-btn-ok";

        buttonsRow.appendChild(cancelBtn);
        buttonsRow.appendChild(okBtn);
        dialog.appendChild(buttonsRow);

        cancelBtn.addEventListener("click", () => {
            close();
        });

        okBtn.addEventListener("click", () => {
            cfg.color = colorInput.value || cfg.color || "#00B303";
            cfg.lineWidth = clamp(widthInput.value, 0.5, 10, cfg.lineWidth ?? 1);
            cfg.lineOpacity = clamp(opacityInput.value, 0, 1, cfg.lineOpacity ?? 1.0);

            if (typeof onUpdated === "function") {
                onUpdated();
            }
            close();
        });

        backdrop.addEventListener("click", (ev) => {
            if (ev.target === backdrop) close();
        });

        backdrop.appendChild(dialog);
        document.body.appendChild(backdrop);

        backdrop.addEventListener("keydown", escHandler);
        dialog.tabIndex = -1;
        dialog.focus();
    }

    function openShadingStyleModal(id, title, cfg, colorKey, opacityKey, onUpdated) {
        const existing = document.getElementById(`wfmapmods-s2-shading-${id}`);
        if (existing) return;

        const backdrop = document.createElement("div");
        backdrop.id = `wfmapmods-s2-shading-${id}`;
        backdrop.className = "wfmapmods-s2-backdrop";

        function close() {
            backdrop.removeEventListener("keydown", escHandler);
            backdrop.remove();
        }

        function escHandler(ev) {
            if (ev.key === "Escape") {
                ev.preventDefault();
                ev.stopPropagation();
                close();
            } else if (ev.key === "Enter") {
                ev.preventDefault();
                ev.stopPropagation();
                okBtn.click();
            }
        }

        const dialog = document.createElement("div");
        dialog.className = "wfmapmods-s2-dialog";

        const heading = document.createElement("div");
        heading.className = "wfmapmods-s2-title";
        heading.textContent = title;
        dialog.appendChild(heading);

        function makeRow(labelText, inputEl) {
            const row = document.createElement("div");
            row.className = "wfmapmods-s2-row";

            const labelEl = document.createElement("label");
            labelEl.textContent = labelText;
            labelEl.className = "wfmapmods-s2-label";

            row.appendChild(labelEl);
            row.appendChild(inputEl);
            return row;
        }

        function clamp(num, min, max, def) {
            num = Number(num);
            if (Number.isNaN(num)) return def;
            return Math.min(max, Math.max(min, num));
        }

        const colorInput = document.createElement("input");
        colorInput.type = "color";
        colorInput.value = cfg[colorKey] || "#000000";

        const opacityInput = document.createElement("input");
        opacityInput.type = "number";
        opacityInput.min = "0";
        opacityInput.max = "1";
        opacityInput.step = "0.05";
        opacityInput.value =
            typeof cfg[opacityKey] === "number" ? cfg[opacityKey] : 0.45;

        dialog.appendChild(makeRow("Shade colour", colorInput));
        dialog.appendChild(makeRow("Shade opacity", opacityInput));

        const buttonsRow = document.createElement("div");
        buttonsRow.className = "wfmapmods-s2-buttons";

        const cancelBtn = document.createElement("button");
        cancelBtn.type = "button";
        cancelBtn.textContent = "Cancel";
        cancelBtn.className = "wfmapmods-s2-btn wfmapmods-s2-btn-cancel";

        const okBtn = document.createElement("button");
        okBtn.type = "button";
        okBtn.textContent = "OK";
        okBtn.className = "wfmapmods-s2-btn wfmapmods-s2-btn-ok";

        buttonsRow.appendChild(cancelBtn);
        buttonsRow.appendChild(okBtn);
        dialog.appendChild(buttonsRow);

        cancelBtn.addEventListener("click", () => {
            close();
        });

        okBtn.addEventListener("click", () => {
            cfg[colorKey] = colorInput.value || cfg[colorKey] || "#000000";
            cfg[opacityKey] = clamp(opacityInput.value, 0, 1, cfg[opacityKey] ?? 0.45);

            if (typeof onUpdated === "function") {
                onUpdated();
            }
            close();
        });

        backdrop.addEventListener("click", (ev) => {
            if (ev.target === backdrop) close();
        });

        backdrop.appendChild(dialog);
        document.body.appendChild(backdrop);

        backdrop.addEventListener("keydown", escHandler);
        dialog.tabIndex = -1;
        dialog.focus();
    }

    function openHighlightStyleModal(highlightCfg, onUpdated) {
        if (document.getElementById("wfmapmods-s2-highlight-modal-backdrop")) return;

        const backdrop = document.createElement("div");
        backdrop.id = "wfmapmods-s2-highlight-modal-backdrop";
        backdrop.className = "wfmapmods-s2-backdrop";

        function close() {
            backdrop.removeEventListener("keydown", escHandler);
            backdrop.remove();
        }

        function escHandler(ev) {
            if (ev.key === "Escape") {
                ev.preventDefault();
                ev.stopPropagation();
                close();
            } else if (ev.key === "Enter") {
                ev.preventDefault();
                ev.stopPropagation();
                okBtn.click();
            }
        }

        const dialog = document.createElement("div");
        dialog.className = "wfmapmods-s2-dialog";

        const title = document.createElement("div");
        title.className = "wfmapmods-s2-title";
        title.textContent = "Submission highlight options";
        dialog.appendChild(title);

        function makeRow(labelText, inputEl) {
            const row = document.createElement("div");
            row.className = "wfmapmods-s2-row";

            const labelEl = document.createElement("label");
            labelEl.textContent = labelText;
            labelEl.className = "wfmapmods-s2-label";

            row.appendChild(labelEl);
            row.appendChild(inputEl);
            return row;
        }

        function clamp(num, min, max, def) {
            num = Number(num);
            if (Number.isNaN(num)) return def;
            return Math.min(max, Math.max(min, num));
        }

        const colorInput = document.createElement("input");
        colorInput.type = "color";
        colorInput.value = highlightCfg.color || "#FF0000";

        const widthInput = document.createElement("input");
        widthInput.type = "number";
        widthInput.min = "0.5";
        widthInput.max = "10";
        widthInput.step = "0.5";
        widthInput.value = highlightCfg.lineWidth ?? 4;

        const opacityInput = document.createElement("input");
        opacityInput.type = "number";
        opacityInput.min = "0";
        opacityInput.max = "1";
        opacityInput.step = "0.05";
        opacityInput.value = highlightCfg.lineOpacity ?? 1.0;

        dialog.appendChild(makeRow("Line colour", colorInput));
        dialog.appendChild(makeRow("Line thickness", widthInput));
        dialog.appendChild(makeRow("Line opacity", opacityInput));

        const buttonsRow = document.createElement("div");
        buttonsRow.className = "wfmapmods-s2-buttons";

        const cancelBtn = document.createElement("button");
        cancelBtn.type = "button";
        cancelBtn.textContent = "Cancel";
        cancelBtn.className = "wfmapmods-s2-btn wfmapmods-s2-btn-cancel";

        const okBtn = document.createElement("button");
        okBtn.type = "button";
        okBtn.textContent = "OK";
        okBtn.className = "wfmapmods-s2-btn wfmapmods-s2-btn-ok";

        buttonsRow.appendChild(cancelBtn);
        buttonsRow.appendChild(okBtn);
        dialog.appendChild(buttonsRow);

        cancelBtn.addEventListener("click", () => {
            close();
        });

        okBtn.addEventListener("click", () => {
            highlightCfg.color = colorInput.value || highlightCfg.color || "#FF0000";
            highlightCfg.lineWidth = clamp(widthInput.value, 0.5, 10, highlightCfg.lineWidth ?? 4);
            highlightCfg.lineOpacity = clamp(opacityInput.value, 0, 1, highlightCfg.lineOpacity ?? 1.0);

            if (typeof onUpdated === "function") {
                onUpdated();
            }
            close();
        });

        backdrop.addEventListener("click", (ev) => {
            if (ev.target === backdrop) close();
        });

        backdrop.appendChild(dialog);
        document.body.appendChild(backdrop);

        backdrop.addEventListener("keydown", escHandler);
        dialog.tabIndex = -1;
        dialog.focus();
    }

    function openPoiMarkerStyleModal(typeKey, label, cfg, onUpdated) {
        const existing = document.getElementById(`wfmapmods-s2-marker-style-${typeKey}`);
        if (existing) return;

        const backdrop = document.createElement("div");
        backdrop.id = `wfmapmods-s2-marker-style-${typeKey}`;
        backdrop.className = "wfmapmods-s2-backdrop";

        function close() {
            backdrop.removeEventListener("keydown", escHandler);
            backdrop.remove();
        }

        function escHandler(ev) {
            if (ev.key === "Escape") {
                ev.preventDefault();
                ev.stopPropagation();
                close();
            } else if (ev.key === "Enter") {
                ev.preventDefault();
                ev.stopPropagation();
                okBtn.click();
            }
        }

        const dialog = document.createElement("div");
        dialog.className = "wfmapmods-s2-dialog";

        const title = document.createElement("div");
        title.className = "wfmapmods-s2-title";
        title.textContent = `Customise markers – ${label}`;
        dialog.appendChild(title);

        const section = document.createElement("div");
        section.className = "wfmapmods-s2-section";

        const desc = document.createElement("div");
        desc.style.fontSize = "11px";
        desc.style.marginBottom = "6px";
        desc.textContent = "Adjust how these markers appear on the map. Changes apply when you click OK.";
        section.appendChild(desc);

        const form = document.createElement("div");
        form.style.display = "grid";
        form.style.gridTemplateColumns = "max-content 1fr";
        form.style.rowGap = "4px";
        form.style.columnGap = "8px";
        form.style.alignItems = "center";

        function makeLabel(text) {
            const labelEl = document.createElement("label");
            labelEl.textContent = text;
            labelEl.style.fontSize = "11px";
            return labelEl;
        }

        function makeColorInput(value) {
            const input = document.createElement("input");
            input.type = "color";
            input.value = value;
            input.style.width = "40px";
            input.style.padding = "0";
            return input;
        }

        function makeNumberInput(value, min, max, step) {
            const input = document.createElement("input");
            input.type = "number";
            input.value = value;
            input.min = String(min);
            input.max = String(max);
            input.step = String(step);
            input.style.width = "70px";
            input.style.fontSize = "11px";
            input.style.padding = "2px 4px";
            input.style.boxSizing = "border-box";
            return input;
        }

        function clamp(num, min, max, fallback) {
            num = Number(num);
            if (Number.isNaN(num)) return fallback;
            return Math.min(max, Math.max(min, num));
        }

        function hexToRgba(hex, opacity) {
            let h = hex.replace("#", "");
            if (h.length === 3) {
                h = h.split("").map(ch => ch + ch).join("");
            }
            const r = parseInt(h.slice(0, 2), 16);
            const g = parseInt(h.slice(2, 4), 16);
            const b = parseInt(h.slice(4, 6), 16);
            return `rgba(${r}, ${g}, ${b}, ${opacity})`;
        }

        const borderColorInput = makeColorInput(cfg.borderColor || "#000000");
        const borderOpacityInput = makeNumberInput(
            cfg.borderOpacity ?? 1.0,
            0, 1, 0.05
        );
        const borderWidthInput = makeNumberInput(
            cfg.borderWidth ?? 2,
            0, 10, 0.5
        );

        const fillColorInput = makeColorInput(cfg.fillColor || "#000000");
        const fillOpacityInput = makeNumberInput(
            cfg.fillOpacity ?? 1.0,
            0, 1, 0.05
        );

        const sizeInput = makeNumberInput(
            cfg.markerSize ?? 8,
            2, 30, 1
        );

        // Layout
        form.appendChild(makeLabel("Border colour"));
        form.appendChild(borderColorInput);

        form.appendChild(makeLabel("Border opacity"));
        form.appendChild(borderOpacityInput);

        form.appendChild(makeLabel("Border width"));
        form.appendChild(borderWidthInput);

        form.appendChild(makeLabel("Fill colour"));
        form.appendChild(fillColorInput);

        form.appendChild(makeLabel("Fill opacity"));
        form.appendChild(fillOpacityInput);

        form.appendChild(makeLabel("Marker size"));
        form.appendChild(sizeInput);

        section.appendChild(form);

        const previewLabel = document.createElement("div");
        previewLabel.textContent = "Preview";
        previewLabel.style.marginTop = "8px";
        previewLabel.style.marginBottom = "4px";
        previewLabel.style.fontSize = "11px";
        previewLabel.style.fontWeight = "bold";

        const preview = document.createElement("div");
        preview.style.display = "inline-block";
        preview.style.borderRadius = "50%";
        preview.style.boxSizing = "border-box";

        section.appendChild(previewLabel);
        section.appendChild(preview);

        dialog.appendChild(section);

        function updatePreview() {
            const borderColor = borderColorInput.value || "#000000";
            const borderOpacity = clamp(borderOpacityInput.value, 0, 1, 1.0);
            const borderWidth = clamp(borderWidthInput.value, 0, 10, 2);
            const fillColor = fillColorInput.value || "#000000";
            const fillOpacity = clamp(fillOpacityInput.value, 0, 1, 1.0);
            const size = clamp(sizeInput.value, 2, 30, 8);

            const sizePx = size * 2;
            preview.style.width = `${sizePx}px`;
            preview.style.height = `${sizePx}px`;
            preview.style.border = `${borderWidth}px solid ${hexToRgba(borderColor, borderOpacity)}`;
            preview.style.backgroundColor = hexToRgba(fillColor, fillOpacity);
        }

        [
            borderColorInput,
            borderOpacityInput,
            borderWidthInput,
            fillColorInput,
            fillOpacityInput,
            sizeInput
        ].forEach(el => el.addEventListener("input", updatePreview));

        updatePreview();

        const buttonsRow = document.createElement("div");
        buttonsRow.className = "wfmapmods-s2-buttons";

        const cancelBtn = document.createElement("button");
        cancelBtn.type = "button";
        cancelBtn.textContent = "Cancel";
        cancelBtn.className = "wfmapmods-s2-btn wfmapmods-s2-btn-cancel";

        const okBtn = document.createElement("button");
        okBtn.type = "button";
        okBtn.textContent = "OK";
        okBtn.className = "wfmapmods-s2-btn wfmapmods-s2-btn-ok";

        buttonsRow.appendChild(cancelBtn);
        buttonsRow.appendChild(okBtn);
        dialog.appendChild(buttonsRow);

        cancelBtn.addEventListener("click", () => {
            close();
        });

        okBtn.addEventListener("click", () => {
            cfg.borderColor = borderColorInput.value || cfg.borderColor || "#000000";
            cfg.borderOpacity = clamp(borderOpacityInput.value, 0, 1, cfg.borderOpacity ?? 1.0);
            cfg.borderWidth = clamp(borderWidthInput.value, 0, 10, cfg.borderWidth ?? 2);

            cfg.fillColor = fillColorInput.value || cfg.fillColor || "#000000";
            cfg.fillOpacity = clamp(fillOpacityInput.value, 0, 1, cfg.fillOpacity ?? 1.0);

            cfg.markerSize = clamp(sizeInput.value, 2, 30, cfg.markerSize ?? 8);

            if (typeof onUpdated === "function") {
                onUpdated();
            }

            close();
        });

        backdrop.addEventListener("click", (ev) => {
            if (ev.target === backdrop) {
                close();
            }
        });

        backdrop.appendChild(dialog);
        document.body.appendChild(backdrop);

        backdrop.addEventListener("keydown", escHandler);
        dialog.tabIndex = -1;
        dialog.focus();
    }

    // ==================================
    // Manual import: map button + dialog
    // ==================================

    let manualImportControlEl = null;

    // Your provided SVG (kept inline; we style via CSS-in-JS below)
    const MANUAL_IMPORT_SVG = `
<svg width="20" height="20" viewBox="0 0 821.52 1461.2" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">
  <path d="M410.76 0C203.04.14 30.93 152.53 0 351.61l211.27.39c26.99-84.43 106.09-145.55 199.49-145.6 93.25.11 172.24 61.13 199.33 145.41l211.2.19C790.58 152.8 618.51.26 410.76 0zm0 280c-75.11 0-136 60.89-136 136s60.89 136 136 136 136-60.89 136-136-60.89-136-136-136zM.23 480c30.71 199.2 202.78 351.74 410.53 352 207.72-.14 379.83-152.53 410.76-351.61L610.25 480c-26.99 84.43-106.09 145.55-199.49 145.6-93.25-.11-172.24-61.13-199.33-145.41z"/>
  <path d="m380.39 818.72h65.085v465.16h-65.085z" stroke-width="4.402"/>
  <ellipse cx="415.18" cy="1345.9" rx="305.69" ry="115.2" stroke-width="6"/>
</svg>
`;

    // Create a stable-ish manual id compatible with your IITC manual detection.
    // guid MUST be null for these.
    function generateManualImportId(lat, lng) {
        const ts = Date.now();
        const rand = Math.random().toString(16).slice(2, 10);
        // include rounded coords for human sanity; keep ID uniqueness via ts+rand
        const latStr = (typeof lat === "number" && Number.isFinite(lat)) ? lat.toFixed(6) : "x";
        const lngStr = (typeof lng === "number" && Number.isFinite(lng)) ? lng.toFixed(6) : "y";
        return `s2-pogo-${ts}-${rand}-${latStr},${lngStr}`;
    }

    // Best guess for “current” location.
    // 1) use submission marker coords if you track them
    // 2) else use map centre
    function getManualImportDefaultLatLng() {
        if (typeof submitCellLat === "number" && Number.isFinite(submitCellLat) &&
            typeof submitCellLng === "number" && Number.isFinite(submitCellLng)) {
            return { lat: submitCellLat, lng: submitCellLng };
        }

        if (submitMap && typeof submitMap.getCenter === "function") {
            const c = submitMap.getCenter();
            if (c && typeof c.lat === "function" && typeof c.lng === "function") {
                return { lat: c.lat(), lng: c.lng() };
            }
        }

        return { lat: null, lng: null };
    }

    // Adds a 32x32 control button to TOP_LEFT (only once)
    function insertManualImportMapButton() {
        if (!submitMap || !google.maps) return;
        if (manualImportControlEl) return; // already added

        const btn = document.createElement("button");
        manualImportControlEl = btn;

        btn.type = "button";
        btn.title = "Add manual Pokémon GO POI";
        btn.setAttribute("aria-label", "Add manual Pokémon GO POI");

        Object.assign(btn.style, {
            width: "32px",
            height: "32px",
            marginTop: "10px",
            marginLeft: "10px",
            padding: "0",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "#ffffff",
            border: "2px solid #ffffff",
            borderRadius: "3px",
            boxShadow: "0 1px 4px rgba(0,0,0,0.3)",
            cursor: "pointer",
            userSelect: "none",
        });

        // icon
        const iconWrap = document.createElement("div");
        iconWrap.innerHTML = MANUAL_IMPORT_SVG;
        const svg = iconWrap.querySelector("svg");
        if (svg) {
            svg.setAttribute("width", "24");
            svg.setAttribute("height", "24");
            svg.style.fill = "#111827";
            svg.style.stroke = "#111827";
        }
        btn.appendChild(iconWrap);

        btn.addEventListener("mouseenter", () => (btn.style.background = "#f9fafb"));
        btn.addEventListener("mouseleave", () => (btn.style.background = "#ffffff"));

        btn.addEventListener("click", () => {
            openManualImportDialog();
        });

        // Add to map controls
        submitMap.controls[google.maps.ControlPosition.LEFT].push(btn);
    }

    // Remove the control from DOM on teardown (optional but tidy)
    function removeManualImportMapButton() {
        if (manualImportControlEl && manualImportControlEl.parentNode) {
            manualImportControlEl.parentNode.removeChild(manualImportControlEl);
        }
        manualImportControlEl = null;
    }

    function openManualImportDialog() {
        const { lat, lng } = getManualImportDefaultLatLng();

        // Backdrop
        const backdrop = document.createElement("div");
        Object.assign(backdrop.style, {
            position: "fixed",
            inset: "0",
            background: "rgba(0,0,0,0.45)",
            zIndex: "999999",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            overflowY: "auto",
            padding: "16px",
            WebkitOverflowScrolling: "touch"
        });

        // Dialog
        const dialog = document.createElement("div");
        Object.assign(dialog.style, {
            width: "360px",
            maxWidth: "92vw",
            background: "#ffffff",
            color: "#111827",
            borderRadius: "10px",
            boxShadow: "0 8px 30px rgba(0,0,0,0.35)",
            padding: "12px",
            fontFamily: "Roboto, Arial, sans-serif",
            display: "flex",
            flexDirection: "column",
            gap: "10px",
            maxHeight: "calc(100vh - 32px)",
            overflowY: "auto"
        });

        const title = document.createElement("div");
        title.textContent = "Add manual Pokémon GO POI";
        Object.assign(title.style, { fontSize: "14px", fontWeight: "700" });

        const hint = document.createElement("div");
        hint.textContent = "Add Pokestops and Gym not on the map (e.g. Sponsored, imports)";
        Object.assign(hint.style, { fontSize: "11px", color: "#6b7280" });

        function row(labelText, inputEl) {
            const wrap = document.createElement("div");
            Object.assign(wrap.style, { display: "flex", flexDirection: "column", gap: "4px" });

            const lab = document.createElement("div");
            lab.textContent = labelText;
            Object.assign(lab.style, { fontSize: "12px", fontWeight: "600" });

            Object.assign(inputEl.style, {
                fontSize: "12px",
                padding: "6px 8px",
                border: "1px solid #d1d5db",
                borderRadius: "6px"
            });

            wrap.appendChild(lab);
            wrap.appendChild(inputEl);
            return wrap;
        }

        // Type
        const typeSel = document.createElement("select");
        ["stop", "gym", "powerspot"].forEach(t => {
            const opt = document.createElement("option");
            opt.value = t;
            opt.textContent = (t === "stop") ? "PokéStop" : (t === "gym") ? "Gym" : "Power Spot";
            typeSel.appendChild(opt);
        });

        // Title
        const titleIn = document.createElement("input");
        titleIn.type = "text";
        titleIn.placeholder = "Title (required)";

        // Lat/Lng
        const latIn = document.createElement("input");
        latIn.type = "number";
        latIn.step = "0.000001";
        latIn.placeholder = "Latitude";
        if (typeof lat === "number" && Number.isFinite(lat)) latIn.value = String(lat);

        const lngIn = document.createElement("input");
        lngIn.type = "number";
        lngIn.step = "0.000001";
        lngIn.placeholder = "Longitude";
        if (typeof lng === "number" && Number.isFinite(lng)) lngIn.value = String(lng);

        // Image URL
        const imgIn = document.createElement("input");
        imgIn.type = "text";
        imgIn.placeholder = "Image URL (optional)";

        const statusLine = document.createElement("div");
        Object.assign(statusLine.style, { fontSize: "11px", color: "#6b7280", minHeight: "14px" });

        // Buttons
        const btnRow = document.createElement("div");
        Object.assign(btnRow.style, { display: "flex", justifyContent: "flex-end", gap: "8px", marginTop: "4px" });

        const cancelBtn = document.createElement("button");
        cancelBtn.type = "button";
        cancelBtn.textContent = "Cancel";
        Object.assign(cancelBtn.style, {
            padding: "6px 10px",
            borderRadius: "6px",
            border: "1px solid #d1d5db",
            background: "#ffffff",
            cursor: "pointer",
            fontSize: "12px"
        });

        const saveBtn = document.createElement("button");
        saveBtn.type = "button";
        saveBtn.textContent = "Save";
        Object.assign(saveBtn.style, {
            padding: "6px 10px",
            borderRadius: "6px",
            border: "1px solid #111827",
            background: "#111827",
            color: "#ffffff",
            cursor: "pointer",
            fontSize: "12px"
        });

        btnRow.appendChild(cancelBtn);
        btnRow.appendChild(saveBtn);

        dialog.appendChild(title);
        dialog.appendChild(hint);
        dialog.appendChild(row("Type", typeSel));
        dialog.appendChild(row("Title", titleIn));
        dialog.appendChild(row("Latitude", latIn));
        dialog.appendChild(row("Longitude", lngIn));
        dialog.appendChild(row("Image URL", imgIn));
        dialog.appendChild(statusLine);
        dialog.appendChild(btnRow);

        backdrop.appendChild(dialog);
        document.body.appendChild(backdrop);

        function close() {
            backdrop.remove();
        }

        backdrop.addEventListener("click", (ev) => {
            if (ev.target === backdrop) close();
        });

        cancelBtn.addEventListener("click", close);

        // Escape closes
        function onKey(ev) {
            if (ev.key === "Escape") {
                ev.preventDefault();
                ev.stopPropagation();
                close();
            }
        }
        backdrop.addEventListener("keydown", onKey);
        dialog.tabIndex = -1;
        dialog.focus();

        saveBtn.addEventListener("click", async () => {
            const poiType = typeSel.value;
            const titleVal = (titleIn.value || "").trim();
            const latVal = Number(latIn.value);
            const lngVal = Number(lngIn.value);
            const imageUrl = (imgIn.value || "").trim();

            if (!titleVal) {
                statusLine.textContent = "Title is required.";
                return;
            }
            if (!Number.isFinite(latVal) || !Number.isFinite(lngVal)) {
                statusLine.textContent = "Latitude/Longitude must be valid numbers.";
                return;
            }

            saveBtn.disabled = true;
            cancelBtn.disabled = true;
            statusLine.textContent = "Saving…";

            const id = generateManualImportId(latVal, lngVal);

            const record = {
                id,
                guid: null, // manual import
                lat: latVal,
                lng: lngVal,
                title: titleVal,
                description: "",
                imageUrl: imageUrl,
                status: "MANUAL IMPORT",
                game: "pokemon-go",
                poiType,
                updatedAt: Date.now(),

                // Optional: keep for compatibility with your IITC/manual detection flows
                _iitcGuid: id
            };

            try {
                await saveGamePoiToIDB(record);

                // select it (details panel + POI type UI should sync via bridge watcher)
                sendPoiToBridge(record);

                statusLine.textContent = "Saved.";
                close();
            } catch (e) {
                console.error("[S2] manual import save failed:", e);
                statusLine.textContent = "Save failed (see console).";
                saveBtn.disabled = false;
                cancelBtn.disabled = false;
            }
        });
    }

    // ==================================
    // POI type UI (PokeStops, Gyms, etc)
    // ==================================

    function insertPoiTypeUI() {
        const sections = document.querySelectorAll(".wfmapmods-section-poi-functions");
        if (!sections.length) return;

        sections.forEach(section => {
            if (section.dataset.s2PoiTypesInjected === "1") return;
            section.dataset.s2PoiTypesInjected = "1";

            // Section wrapper
            const poiTypesSection = document.createElement("section");
            poiTypesSection.className = "wfmapmods-section wfmapmods-section-poi-types";

            // Start hidden – will be toggled by the bridge watcher
            poiTypesSection.style.display = "none";

            // Row: match the wayspot functions row padding + layout
            const row = document.createElement("div");
            row.className = "wfmapmods-poi-types-row";

            // Left label
            const label = document.createElement("div");
            label.className = "wfmapmods-poi-types-label";
            label.textContent = "Pokémon Go:";

            // Right: icon group
            const buttonsBlock = document.createElement("div");
            buttonsBlock.className = "wfmapmods-link-block wfmapmods-poi-type-links";

            const config = [
                { key: "stop",      label: "PokéStop",   shortcutKey: "p" },
                { key: "gym",       label: "Gym",        shortcutKey: "g" },
                { key: "powerspot", label: "Power Spot", shortcutKey: "w" },
                { key: "na",        label: "N/A",        shortcutKey: "n" }
            ];

            config.forEach(({ key, label: text, shortcutKey }) => {
                const btn = document.createElement("button");
                btn.type = "button";
                btn.className = "wfmapmods-poi-type-button";
                btn.setAttribute("data-poi-type", key);
                const shortcut = shortcutKey ? getShortcutStringForKey(shortcutKey) : "";
                const tip = withOptionalShortcutLabel(text, shortcut);

                btn.setAttribute("title", tip);
                btn.setAttribute("aria-label", tip);

                const content = document.createElement("span");
                content.className = "wfmapmods-poi-type-content";

                if (key === "na") {
                    content.textContent = "N/A";
                } else {
                    const svgMarkup = POI_TYPE_ICONS[key] || "";
                    content.innerHTML = svgMarkup;
                }

                btn.appendChild(content);
                buttonsBlock.appendChild(btn);

                // --- Click handler: save to IDB ---
                btn.addEventListener("click", () => {
                    handlePoiTypeClick(key, buttonsBlock);
                });
            });

            row.appendChild(label);
            row.appendChild(buttonsBlock);
            poiTypesSection.appendChild(row);

            // Insert immediately after the POI functions section
            section.insertAdjacentElement("afterend", poiTypesSection);
        });

        installPoiTypeShortcuts();
    }

    function applySelectedPoiTypeToContainer(containerEl, poiType) {
        if (!containerEl) return;
        const btns = containerEl.querySelectorAll(".wfmapmods-poi-type-button");
        btns.forEach(btn => {
            const type = btn.getAttribute("data-poi-type");
            if (poiType && type === poiType) {
                btn.setAttribute("data-selected", "1");
            } else {
                btn.removeAttribute("data-selected");
            }
        });
    }

    function handlePoiTypeClick(poiType, containerEl) {
        const payload = getCurrentBridgePayload();
        if (!payload) return;

        const guid = payload.guid || null;
        const lat = typeof payload.lat === "number" ? payload.lat : null;
        const lng = typeof payload.lng === "number" ? payload.lng : null;

        const id = payload.storedId || buildGamePoiId(guid, lat, lng);
        if (!id) return;

        const btn = containerEl.querySelector(
            `.wfmapmods-poi-type-button[data-poi-type="${poiType}"]`
        );
        const alreadySelected = btn && btn.getAttribute("data-selected") === "1";

        // If this type is already selected, clicking again = clear / delete
        if (alreadySelected) {
            applySelectedPoiTypeToContainer(containerEl, null);

            deleteGamePoiFromIDB(id).then(() => {
                // Send a “plain” payload based on the WF bridge payload only,
                // with no explicit poiType, so the panel updates.
                const pseudoStored = {
                    id,
                    guid,
                    lat,
                    lng,
                    title: payload.title || "",
                    description: payload.description || "",
                    imageUrl: payload.imageUrl || "",
                    status: payload.status || "",
                    game: "pokemon-go",
                    poiType: null,
                    updatedAt: Date.now()
                };

                sendPoiToBridge(pseudoStored);
            });

            return;
        }

        // Otherwise, we’re setting a new type
        const existing = gamePois.get(id) || findStoredGamePoiForPayload(payload) || {};

        const record = {
            id,
            guid: guid || existing.guid || null,
            lat: lat != null ? lat : existing.lat,
            lng: lng != null ? lng : existing.lng,
            title: payload.title || existing.title || "",
            description: payload.description || existing.description || "",
            imageUrl: payload.imageUrl || existing.imageUrl || "",
            status: payload.status || existing.status || "",
            game: "pokemon-go",
            poiType,
            updatedAt: Date.now()
        };

        // Preserve any extra fields (e.g. _iitcGuid) that might be on the existing record
        for (const k in existing) {
            if (!(k in record)) {
                record[k] = existing[k];
            }
        }

        saveGamePoiToIDB(record).then(() => {
            applySelectedPoiTypeToContainer(containerEl, poiType);
            // Push updated info (incl. new type) into the bridge
            sendPoiToBridge(record);
        });
    }

    /**
     * Find the currently active POI type button container for the selected wayspot panel.
     * Assumes your bridge watcher shows exactly one `.wfmapmods-section-poi-types` at a time.
     */
    function getActivePoiTypeContainerEl() {
        const sections = document.querySelectorAll(".wfmapmods-section-poi-types");
        for (const sec of sections) {
            if (!isElementVisible(sec)) continue;
            const container = sec.querySelector(".wfmapmods-poi-type-links");
            if (container) return container;
        }
        return null;
    }

    function isTypingContext(el) {
        if (!el) return false;
        const tag = (el.tagName || "").toLowerCase();
        return (
            tag === "input" ||
            tag === "textarea" ||
            tag === "select" ||
            el.isContentEditable
        );
    }

    function isElementVisible(el) {
        // robust enough for your use (display:none toggles, hidden panels, etc.)
        return !!(el && el.offsetParent !== null);
    }

    function getShortcutStringForKey(letter) {
        const ua = navigator.userAgent || "";
        const platform = navigator.platform || "";

        const isMac = /Mac|iPhone|iPad|iPod/i.test(platform) || /Mac OS X/i.test(ua);
        const isIOS = /iPhone|iPad|iPod/i.test(ua);

        if (isIOS) return ""; // typically no physical keyboard

        if (isMac) return `Ctrl + ⌥ + ${letter.toUpperCase()}`;

        return `Ctrl + Alt + ${letter.toUpperCase()}`;
    }

    function withOptionalShortcutLabel(label, shortcut) {
        return shortcut ? `${label} (${shortcut})` : label;
    }

    function installPoiTypeShortcuts() {
        if (poiTypeShortcutsInstalled) return;
        poiTypeShortcutsInstalled = true;

        document.addEventListener("keydown", (ev) => {
            // Don’t steal shortcuts while typing
            if (isTypingContext(ev.target)) return;

            // Mac Control+Option = ctrlKey + altKey in JS
            // This will also work on Windows/Linux if users press Ctrl+Alt.
            const hasCombo = ev.ctrlKey && ev.altKey;
            if (!hasCombo) return;

            // Don’t trigger when other modifiers are involved (optional but reduces collisions)
            if (ev.metaKey) return;

            const code = ev.code || "";
            let poiType = null;

            if (code === "KeyP") poiType = "stop";
            else if (code === "KeyG") poiType = "gym";
            else if (code === "KeyW") poiType = "powerspot";
            else if (code === "KeyN") poiType = "na";
            else return;

            const containerEl = getActivePoiTypeContainerEl();
            if (!containerEl) return;

            // If there’s no selected payload, do nothing
            const payload = getCurrentBridgePayload?.();
            if (!payload) return;

            ev.preventDefault();
            ev.stopPropagation();

            handlePoiTypeClick(poiType, containerEl);
        }, true); // capture helps beat page-level handlers
    }

    // ==================================
    // Live POI interception
    // ==================================

    (function hookLivePoisXHR() {
        const XHR = window.XMLHttpRequest || XMLHttpRequest;

        const origOpen = XHR.prototype.open;
        const origSend = XHR.prototype.send;

        XHR.prototype.open = function(method, url, ...rest) {
            this._s2_url = url; // remember URL
            return origOpen.call(this, method, url, ...rest);
        };

        XHR.prototype.send = function(...args) {
            if (this._s2_url && this._s2_url.includes("/api/v1/vault/live-pois-in-radius")) {

                this.addEventListener("load", () => {
                    try {
                        const json = JSON.parse(this.responseText);
                        const pois = (json?.result?.pois && Array.isArray(json.result.pois))
                        ? json.result.pois
                        : [];

                        // Extract radius from the request URL
                        const urlObj = new URL(this._s2_url, location.origin);
                        const radius = Number(urlObj.searchParams.get("radius")) || 0;

                        if (radius < 10) {
                            // ---- MERGE behaviour for small-radius calls ----
                            for (const p of pois) {
                                mergePoiIntoS2Pois(p);
                                // NEW: sync into IDB if this POI is already stored
                                const stored = findStoredGamePoiForLivePoi(p);
                                if (stored) {
                                    mergeLiveDetailsIntoStoredPoi(stored, p);
                                }
                            }
                        } else {
                            // ---- NORMAL behaviour ----
                            s2Pois = pois;

                            // NEW: for full refreshes, also sync stored POIs with any matching lives
                            for (const p of pois) {
                                const stored = findStoredGamePoiForLivePoi(p);
                                if (stored) {
                                    mergeLiveDetailsIntoStoredPoi(stored, p);
                                }
                            }
                        }

                    } catch (e) {
                        console.error("[S2] error parsing live-pois-in-radius response:", e);
                    }
                });
            }

            return origSend.apply(this, args);
        };

        // Merge single POI into s2Pois, replacing existing one
        function mergePoiIntoS2Pois(newPoi) {
            // Try matching by guid first
            if (newPoi.guid) {
                const idx = s2Pois.findIndex(p => p.guid === newPoi.guid);
                if (idx >= 0) {
                    s2Pois[idx] = newPoi;
                    return;
                }
            }

            // Otherwise match by exact lat/lng
            const idx2 = s2Pois.findIndex(p =>
                                          p.lat === newPoi.lat && p.lng === newPoi.lng
                                         );

            if (idx2 >= 0) {
                s2Pois[idx2] = newPoi;
                return;
            }

            // Otherwise append it
            s2Pois.push(newPoi);
        }

    })();

    function findStoredGamePoiForLivePoi(live) {
        if (!live || !gamePois || !gamePois.size) return null;

        const guid = live.guid || live.id || null;
        const lat  = typeof live.lat === "number" ? live.lat : null;
        const lng  = typeof live.lng === "number" ? live.lng : null;

        // 1) Try matching by guid/id
        if (guid) {
            for (const rec of gamePois.values()) {
                if (rec.guid === guid || rec.id === guid) {
                    return rec;
                }
            }
        }

        // 2) Fallback: exact lat/lng match
        if (lat != null && lng != null) {
            for (const rec of gamePois.values()) {
                if (
                    typeof rec.lat === "number" &&
                    typeof rec.lng === "number" &&
                    rec.lat === lat &&
                    rec.lng === lng
                ) {
                    return rec;
                }
            }
        }

        return null;
    }

    // Fire a live-pois-in-radius request around this stored POI and
    // try to find a matching live POI in the response.
    function fetchLivePoiDetailsForStoredPoi(stored) {
        return new Promise((resolve) => {
            if (!stored) {
                resolve(null);
                return;
            }

            const lat = typeof stored.lat === "number" ? stored.lat : null;
            const lng = typeof stored.lng === "number" ? stored.lng : null;

            if (lat == null || lng == null) {
                resolve(null);
                return;
            }

            const url = `/api/v1/vault/live-pois-in-radius?lat=${encodeURIComponent(lat)}&lng=${encodeURIComponent(lng)}&radius=5`;

            const xhr = new XMLHttpRequest();
            xhr.open("GET", url, true);

            xhr.onload = function() {
                try {
                    if (xhr.status < 200 || xhr.status >= 300) {
                        resolve(null);
                        return;
                    }

                    const json = JSON.parse(xhr.responseText);
                    const pois = (json && json.result && Array.isArray(json.result.pois))
                    ? json.result.pois
                    : [];

                    if (!pois.length) {
                        // No live POIs returned at all → definitely missing
                        markStoredPoiAsMissing(stored);
                        resolve(null);
                        return;
                    }

                    const targetGuid = stored.guid || stored.id || null;
                    const sLat = typeof stored.lat === "number" ? stored.lat : null;
                    const sLng = typeof stored.lng === "number" ? stored.lng : null;

                    // 1) Try guid/id match
                    if (targetGuid) {
                        const byGuid = pois.find(p => p && (p.guid === targetGuid || p.id === targetGuid));
                        if (byGuid) {
                            resolve(byGuid);
                            return;
                        }
                    }

                    // 2) Try exact lat/lng match
                    if (sLat != null && sLng != null) {
                        const byCoords = pois.find(p =>
                                                   p &&
                                                   typeof p.lat === "number" &&
                                                   typeof p.lng === "number" &&
                                                   p.lat === sLat &&
                                                   p.lng === sLng
                                                  );
                        if (byCoords) {
                            resolve(byCoords);
                            return;
                        }
                    }

                    // POI could not be found
                    markStoredPoiAsMissing(stored);
                    resolve(null);
                } catch (e) {
                    console.warn("[S2] Failed to parse live-pois-in-radius details", e);
                    resolve(null);
                }
            };

            xhr.onerror = function() {
                console.warn("[S2] live-pois-in-radius request failed");
                resolve(null);
            };

            xhr.send();
        });
    }

    function markStoredPoiAsMissing(stored) {
        if (!stored || !stored.id) return;

        // Only update if status is not already MISSING
        if (stored.status === "MISSING") return;

        // Don't change to missing if it is a manual import
        if (stored.status === "MANUAL IMPORT") return;

        const updated = {
            ...stored,
            status: "MISSING",
            updatedAt: Date.now()
        };

        saveGamePoiToIDB(updated).then(() => {
            sendPoiToBridge(updated);
        });
    }

    // ==================================
    // S2 grid overlay (lines)
    // ==================================

    class S2Overlay {
        constructor() {
            this.polyLines = [];
        }

        checkMapBoundsReady(map) {
            return !!(map && map.getBounds && map.getBounds());
        }

        until(conditionFunction, map) {
            const poll = (resolve) => {
                if (conditionFunction(map)) resolve();
                else setTimeout(() => poll(resolve), 400);
            };
            return new Promise(poll);
        }

        clear() {
            this.polyLines.forEach(line => line.setMap(null));
            this.polyLines = [];
        }

        async drawCellGrid(map, gridLevel, strokeColor, strokeWidth = 1, strokeOpacity = 1.0) {
            await this.until(this.checkMapBoundsReady, map);
            const bounds = map.getBounds();

            const seenCells = {};
            const cellsToDraw = [];

            if (gridLevel >= 2 && gridLevel < (map.getZoom() + 2)) {
                const latLng = map.getCenter();
                const cell = S2.S2Cell.FromLatLng(this.getLatLngPoint(latLng), gridLevel);
                cellsToDraw.push(cell);
                seenCells[cell.toString()] = true;

                while (cellsToDraw.length > 0) {
                    const curCell = cellsToDraw.pop();
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
            cellCorners[4] = cellCorners[0];

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
            return {
                lat: typeof data.lat === 'function' ? data.lat() : data.lat,
                lng: typeof data.lng === 'function' ? data.lng() : data.lng
            };
        }

        isCellOnScreen(mapBounds, cell) {
            const corners = cell.getCornerLatLngs();

            let minLat = Infinity, maxLat = -Infinity;
            let minLng = Infinity, maxLng = -Infinity;

            for (const c of corners) {
                const lat = typeof c.lat === "function" ? c.lat() : c.lat;
                const lng = typeof c.lng === "function" ? c.lng() : c.lng;
                if (lat < minLat) minLat = lat;
                if (lat > maxLat) maxLat = lat;
                if (lng < minLng) minLng = lng;
                if (lng > maxLng) maxLng = lng;
            }

            const bne = mapBounds.getNorthEast();
            const bsw = mapBounds.getSouthWest();

            if (maxLat < bsw.lat() || minLat > bne.lat()) return false;
            if (maxLng < bsw.lng() || minLng > bne.lng()) return false;
            return true;
        }
    }

    // Compute which S2 grid layers should be drawn
    function getEnabledS2Layers() {
        const layers = [];
        const { master, primary, secondary } = userSettings;

        // Disable if turned off via layers option
        if (!master || master.enabled === false) {
            return layers;
        }

        if (primary.enabled) {
            layers.push({
                level: primary.level,
                color: primary.color,
                lineWidth: primary.lineWidth,
                lineOpacity: primary.lineOpacity ?? 1.0
            });
        }

        if (secondary.enabled) {
            layers.push({
                level: secondary.level,
                color: secondary.color,
                lineWidth: secondary.lineWidth,
                lineOpacity: secondary.lineOpacity ?? 1.0
            });
        }

        return layers;
    }

    function computeGridKey() {
        const z = submitMap.getZoom();
        const b = submitMap.getBounds();
        if (!b) return "";

        const ne = b.getNorthEast(), sw = b.getSouthWest();
        const layers = getEnabledS2Layers()
        .slice()
        .sort((a,b) => a.level - b.level)
        .map(l => `${l.level}:${l.color}:${l.lineWidth}:${l.lineOpacity}`)
        .join("|");

        // Quantise bounds so tiny pans don't force a redraw
        const q = (n) => Math.round(n * 2000) / 2000; // ~0.0005 deg (~55m) step
        return `${z}|${q(sw.lat())},${q(sw.lng())}|${q(ne.lat())},${q(ne.lng())}|${layers}`;
    }

    async function drawS2Grid() {
        if (!submitMap || !s2Overlay) return;

        const layers = getEnabledS2Layers();
        if (!layers.length) return;

        // Draw from smallest cells to largest so larger grid lines end up on top.
        layers.sort((a, b) => a.level - b.level);

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

        const key = computeGridKey();
        if (key && key === lastGridKey) return;
        lastGridKey = key;

        s2Overlay.clear();
        drawS2Grid();
    }

    function initS2Overlay() {
        if (!submitMap) return;
        if (s2Overlay) return;

        s2Overlay = new S2Overlay();

        drawS2Grid();
        shadePoiCells();
        refreshGamePoiMarkers();

        idleListener = submitMap.addListener("idle", () => {
            updateS2Grid();
            shadePoiCells();
            refreshGamePoiMarkers();
        });

        mapAttached = true;

        insertManualImportMapButton();
    }

    // ==================================
    // Shading and Stats Helpers
    // ==================================

    function bumpShadePoiVersion() {
        shadePoiVersion++;
        lastShadeKey = "";
        allPoisCache = null;
        l17CountsCache = null;
        l14StatsCache = null;
    }

    function getAllPoisCached() {
        if (allPoisCache) return allPoisCache;

        allPoisCache = Array.from(gamePois.values()).filter(p =>
                                                            p &&
                                                            p.game === "pokemon-go" &&
                                                            (p.poiType === "stop" || p.poiType === "gym") &&
                                                            typeof p.lat === "number" &&
                                                            typeof p.lng === "number"
                                                           );

        return allPoisCache;
    }

    function buildL17Counts(allPois) {
        const counts = new Map();
        for (const p of allPois) {
            const cell = S2.S2Cell.FromLatLng({ lat: p.lat, lng: p.lng }, POI_CELL_LEVEL);
            const cellId = cell.toString();
            let info = counts.get(cellId);
            if (!info) {
                info = { cell, count: 0 };
                counts.set(cellId, info);
            }
            info.count++;
        }
        return counts;
    }

    function buildL14Stats(allPois) {
        const L14_LEVEL = 14;
        const stats = new Map();
        for (const p of allPois) {
            const cell = S2.S2Cell.FromLatLng({ lat: p.lat, lng: p.lng }, L14_LEVEL);
            const cellId = cell.toString();
            let info = stats.get(cellId);
            if (!info) {
                info = { cell, gameItems: 0, gyms: 0 };
                stats.set(cellId, info);
            }
            info.gameItems++;
            if (p.poiType === "gym") info.gyms++;
        }
        return stats;
    }

    // Similar idea to your grid key: skip if nothing meaningful changed
    function computeShadeKey() {
        if (!submitMap) return "";

        const z = submitMap.getZoom();
        const b = submitMap.getBounds?.();
        if (!b || typeof z !== "number") return "";

        // Quantise bounds to avoid tiny pan redraws
        const q = (n) => Math.round(n * 2000) / 2000;
        const ne = b.getNorthEast(), sw = b.getSouthWest();

        const s2 = userSettings.poiCells || {};
        const l14 = userSettings.l14Cells || {};

        const settingsKey = [
            !!s2.enabled, s2.color, s2.fillOpacity,
            !!l14.enabled, !!l14.showLabels,
            l14.undercrowdedColor, l14.undercrowdedOpacity,
            l14.overcrowdedColor, l14.overcrowdedOpacity,
            l14.shadeUndercrowded !== false,
            l14.shadeOvercrowded !== false
        ].join("|");

        // include version so POI changes force refresh
        return `${z}|${q(sw.lat())},${q(sw.lng())}|${q(ne.lat())},${q(ne.lng())}|v${shadePoiVersion}|${settingsKey}`;
    }

    function expandBounds(bounds, padFrac = 0.15) {
        // padFrac = 0.15 means extend by 15% each direction (reduces edge popping)
        const ne = bounds.getNorthEast();
        const sw = bounds.getSouthWest();

        const latSpan = ne.lat() - sw.lat();
        const lngSpan = ne.lng() - sw.lng();

        const padLat = latSpan * padFrac;
        const padLng = lngSpan * padFrac;

        const exSw = new google.maps.LatLng(sw.lat() - padLat, sw.lng() - padLng);
        const exNe = new google.maps.LatLng(ne.lat() + padLat, ne.lng() + padLng);

        return new google.maps.LatLngBounds(exSw, exNe);
    }

    function cellIntersectsBounds(cell, bounds) {
        // Fast bbox test using the cell’s corners
        const corners = cell.getCornerLatLngs();

        let minLat = Infinity, maxLat = -Infinity;
        let minLng = Infinity, maxLng = -Infinity;

        for (const c of corners) {
            const lat = (typeof c.lat === "function") ? c.lat() : c.lat;
            const lng = (typeof c.lng === "function") ? c.lng() : c.lng;
            if (lat < minLat) minLat = lat;
            if (lat > maxLat) maxLat = lat;
            if (lng < minLng) minLng = lng;
            if (lng > maxLng) maxLng = lng;
        }

        const bne = bounds.getNorthEast();
        const bsw = bounds.getSouthWest();

        // bbox intersection
        if (maxLat < bsw.lat() || minLat > bne.lat()) return false;
        if (maxLng < bsw.lng() || minLng > bne.lng()) return false;
        return true;
    }

    // ==================================
    // Cell shading + L14 gym overlays
    // ==================================

    function clearPoiCellPolygons() {
        // Clear L17 shading (reused stacks)
        for (const [, entry] of l17ShadeByCellId) {
            if (entry?.polys?.length) {
                for (const poly of entry.polys) {
                    if (poly?.setMap) poly.setMap(null);
                }
            }
        }
        l17ShadeByCellId.clear();

        // Clear L14 shading polys (reused)
        for (const [, poly] of l14ShadeByCellId) {
            if (poly?.setMap) poly.setMap(null);
        }
        l14ShadeByCellId.clear();
    }

    function clearL17ShadingOnly() {
        for (const [, entry] of l17ShadeByCellId) {
            if (entry?.polys?.length) {
                for (const poly of entry.polys) {
                    if (poly?.setMap) poly.setMap(null);
                }
            }
        }
        l17ShadeByCellId.clear();
    }

    function clearL14ShadingOnly() {
        for (const [, poly] of l14ShadeByCellId) {
            if (poly?.setMap) poly.setMap(null);
        }
        l14ShadeByCellId.clear();

        // labels already have their own reuse logic; easiest is to remove them when layer off
        if (Array.isArray(l14CellLabels)) {
            for (const m of l14CellLabels) if (m?.setMap) m.setMap(null);
        }
        l14CellLabels = [];
    }

    function getCellCenterFromCorners(cell) {
        const corners = cell.getCornerLatLngs();
        let sumLat = 0, sumLng = 0, count = 0;
        corners.forEach(c => {
            const lat = typeof c.lat === "function" ? c.lat() : c.lat;
            const lng = typeof c.lng === "function" ? c.lng() : c.lng;
            sumLat += lat;
            sumLng += lng;
            count++;
        });
        return { lat: sumLat / count, lng: sumLng / count };
    }

    function computeExpectedGyms(gameItems) {
        if (gameItems < 2) return 0;
        if (gameItems < 6) return 1;
        if (gameItems < 20) return 2;
        return 3; // Niantic cap
    }

    function computeRemainingToNextGym(gameItems, gyms) {
        // Already at or above the cap – no further gyms possible
        if (gyms >= GYM_THRESHOLDS.length) {
            return null;
        }

        // Which gym are we working towards?
        // 0 gyms -> threshold[0] (1st gym)
        // 1 gym  -> threshold[1] (2nd gym)
        // 2 gyms -> threshold[2] (3rd gym)
        const targetIndex = gyms;
        let targetItems = GYM_THRESHOLDS[targetIndex];

        // If we've already passed that threshold (overfull / not upgraded yet),
        // move on to the next one, if any.
        if (gameItems >= targetItems) {
            const nextIndex = targetIndex + 1;
            if (nextIndex >= GYM_THRESHOLDS.length) {
                // No more thresholds (already at max gym tier for this cell)
                return null;
            }
            targetItems = GYM_THRESHOLDS[nextIndex];
        }

        const remaining = targetItems - gameItems;
        return remaining > 0 ? remaining : 0;
    }

    function shadePoiCells() {
        if (!submitMap) return;
        if (!userSettings.master || userSettings.master.enabled === false) return;

        const key = computeShadeKey();
        if (key && key === lastShadeKey) return;
        lastShadeKey = key;

        const s2Settings = userSettings.poiCells || {};
        const l14 = userSettings.l14Cells || {};

        const zoom = submitMap.getZoom();
        if (typeof zoom !== "number") return;

        const bounds = submitMap.getBounds?.();
        if (!bounds) return;

        const drawBounds = expandBounds(bounds, 0.15);

        const allPois = getAllPoisCached();

        if (!allPois.length) {
            clearPoiCellPolygons();
            return;
        }

        // Build caches once per POI version
        if (!l17CountsCache) l17CountsCache = buildL17Counts(allPois);
        if (!l14StatsCache)  l14StatsCache  = buildL14Stats(allPois);

        // L17 shading
        if (s2Settings.enabled && zoom >= 16) {
            drawL17FromCountsCache(l17CountsCache, s2Settings, drawBounds);
        } else {
            clearL17ShadingOnly();
        }

        // L14 overlays
        if (l14.enabled && zoom >= 13) {
            drawL14FromStatsCache(l14StatsCache, drawBounds);
        } else {
            clearL14ShadingOnly();
        }
    }

    function drawL17FromCountsCache(counts, s2Settings, drawBounds) {
        const fillColor = s2Settings.color || "#000000";
        const baseFillOpacity = (typeof s2Settings.fillOpacity === "number")
        ? s2Settings.fillOpacity
        : 0.2;

        const seen = new Set();

        for (const [cellId, info] of counts.entries()) {
            if (!cellIntersectsBounds(info.cell, drawBounds)) continue;
            seen.add(cellId);

            let entry = l17ShadeByCellId.get(cellId);
            if (!entry) {
                const corners = info.cell.getCornerLatLngs();
                const path = corners.map(c => ({
                    lat: typeof c.lat === "function" ? c.lat() : c.lat,
                    lng: typeof c.lng === "function" ? c.lng() : c.lng
                }));
                path.push(path[0]);
                entry = { path, polys: [] };
                l17ShadeByCellId.set(cellId, entry);
            }

            const desiredCount = info.count;
            const currentCount = entry.polys.length;

            for (let i = currentCount; i < desiredCount; i++) {
                const poly = new google.maps.Polygon({
                    map: submitMap,
                    paths: entry.path,
                    strokeColor: fillColor,
                    strokeOpacity: 0.7,
                    strokeWeight: 1,
                    fillColor: fillColor,
                    fillOpacity: baseFillOpacity,
                    clickable: false,
                    zIndex: 3000 + i
                });
                entry.polys.push(poly);
            }

            for (let i = desiredCount; i < currentCount; i++) {
                entry.polys[i]?.setMap?.(null);
            }
            if (currentCount > desiredCount) entry.polys.length = desiredCount;

            // Style updates only
            for (let i = 0; i < entry.polys.length; i++) {
                entry.polys[i].setOptions({
                    strokeColor: fillColor,
                    fillColor: fillColor,
                    fillOpacity: baseFillOpacity,
                    zIndex: 3000 + i
                });
                if (entry.polys[i].getMap?.() !== submitMap) entry.polys[i].setMap(submitMap);
            }
        }

        for (const [cellId, entry] of l17ShadeByCellId.entries()) {
            if (seen.has(cellId)) continue;
            for (const poly of entry.polys) poly?.setMap?.(null);
            l17ShadeByCellId.delete(cellId);
        }
    }

    function drawL14FromStatsCache(cellMap, drawBounds) {
        const l14 = userSettings.l14Cells || {};
        const MIN_L14_LABEL_ZOOM = 14;

        const zoom = submitMap.getZoom?.();
        const shouldShowLabels = l14.showLabels && zoom != null && zoom >= MIN_L14_LABEL_ZOOM;

        // --- shading (reuse) ---
        const seenShade = new Set();
        for (const [cellId, info] of cellMap.entries()) {
            if (!cellIntersectsBounds(info.cell, drawBounds)) continue;
            seenShade.add(cellId);

            const expectedGyms = computeExpectedGyms(info.gameItems);

            let fillColor = null;
            let fillOpacity = 0;

            if (info.gyms < expectedGyms && l14.shadeUndercrowded !== false) {
                fillColor = l14.undercrowdedColor || "#facc15";
                fillOpacity = (typeof l14.undercrowdedOpacity === "number") ? l14.undercrowdedOpacity : 0.45;
            } else if (info.gyms > expectedGyms && l14.shadeOvercrowded !== false) {
                fillColor = l14.overcrowdedColor || "#f97373";
                fillOpacity = (typeof l14.overcrowdedOpacity === "number") ? l14.overcrowdedOpacity : 0.45;
            }

            upsertL14ShadePolygon(cellId, info.cell, fillColor, fillOpacity);
        }

        for (const [cellId, poly] of l14ShadeByCellId.entries()) {
            if (seenShade.has(cellId)) continue;
            poly?.setMap?.(null);
            l14ShadeByCellId.delete(cellId);
        }

        // --- labels (reuse) ---
        const existingById = new Map();
        if (Array.isArray(l14CellLabels)) {
            for (const m of l14CellLabels) if (m?.__cellId) existingById.set(m.__cellId, m);
        }

        if (!shouldShowLabels) {
            for (const m of l14CellLabels || []) m?.setMap?.(null);
            l14CellLabels = [];
            return;
        }

        const nextLabels = [];

        for (const [cellId, info] of cellMap.entries()) {
            if (!cellIntersectsBounds(info.cell, drawBounds)) continue;

            const remaining = computeRemainingToNextGym(info.gameItems, info.gyms);
            const old = existingById.get(cellId);

            if (remaining == null) {
                if (old) old.setMap(null);
                continue;
            }

            const centre = getCellCenterFromCorners(info.cell);
            const isClose = typeof remaining === "number" && remaining >= 1 && remaining <= 2;
            const fillColor = isClose ? (l14.undercrowdedColor || "#facc15") : "#ffffff";

            let marker = old;

            // If we already have the same value, do minimal updates
            if (marker && marker.__remaining === remaining && marker.__isClose === isClose) {
                // Still ensure it’s positioned correctly and visible
                marker.setPosition(centre);
                if (marker.getMap?.() !== submitMap) marker.setMap(submitMap);
                nextLabels.push(marker);
                continue;
            }

            const icon = {
                path: google.maps.SymbolPath.CIRCLE,
                scale: 11,
                fillColor,
                fillOpacity: 0.97,
                strokeColor: "#111827",
                strokeOpacity: 0.9,
                strokeWeight: 2
            };

            const label = {
                text: String(remaining),
                color: "#111827",
                fontSize: "13px",
                fontWeight: "700"
            };

            if (!marker) {
                marker = new google.maps.Marker({
                    map: submitMap,
                    position: centre,
                    clickable: false,
                    icon,
                    label,
                    zIndex: 7500
                });
                marker.__cellId = cellId;
            } else {
                marker.setPosition(centre);
                marker.setIcon(icon);
                marker.setLabel(label);
                if (marker.getMap?.() !== submitMap) marker.setMap(submitMap);
            }

            marker.__remaining = remaining;
            marker.__isClose = isClose;

            nextLabels.push(marker);
        }

        const keep = new Set(nextLabels);
        for (const m of l14CellLabels || []) {
            if (!keep.has(m)) m?.setMap?.(null);
        }
        l14CellLabels = nextLabels;
    }

    function upsertL14ShadePolygon(cellId, cell, fillColor, fillOpacity) {
        let poly = l14ShadeByCellId.get(cellId);
        if (!poly) {
            const corners = cell.getCornerLatLngs();
            const path = corners.map(c => ({
                lat: typeof c.lat === "function" ? c.lat() : c.lat,
                lng: typeof c.lng === "function" ? c.lng() : c.lng
            }));
            path.push(path[0]);

            poly = new google.maps.Polygon({
                map: submitMap,
                paths: path,
                strokeColor: "#9ca3af",
                strokeOpacity: 0,
                strokeWeight: 1,
                clickable: false,
                zIndex: 4000
            });
            l14ShadeByCellId.set(cellId, poly);
        }

        poly.setOptions({
            fillColor: fillColor || "#000000",
            fillOpacity: fillColor ? fillOpacity : 0
        });

        if (poly.getMap?.() !== submitMap) poly.setMap(submitMap);
        return poly;
    }

    // -----------------------------
    // Game POI markers (Stops / Gyms / Power Spots)
    // -----------------------------

    function clearGamePoiMarkers() {
        if (!Array.isArray(gamePoiMarkers) || !gamePoiMarkers.length) return;
        gamePoiMarkers.forEach(m => {
            if (m && m.setMap) m.setMap(null);
        });
        gamePoiMarkers = [];
    }

    // Return style for a given POI type
    function getMarkerStyleForPoiType(type) {
        const cfg = userSettings.poiMarkers?.[type];
        if (!cfg || cfg.enabled === false) return null;

        return {
            fillColor: cfg.fillColor,
            fillOpacity: cfg.fillOpacity,
            borderColor: cfg.borderColor,
            borderOpacity: cfg.borderOpacity,
            borderWidth: cfg.borderWidth,
            markerSize: cfg.markerSize
        };
    }

    function refreshGamePoiMarkers() {
        if (!submitMap || !google?.maps) return;

        const zoom = submitMap.getZoom?.();
        const lowZoomEnabled = userSettings.poiMarkers?.hideAtLowZoom?.enabled !== false;

        if (lowZoomEnabled && typeof zoom === "number" && zoom < GAME_POI_MIN_ZOOM) {
            clearGamePoiMarkers();
            return;
        }

        if (!gamePois || !gamePois.size) {
            clearGamePoiMarkers();
            return;
        }

        const bounds = submitMap.getBounds?.();
        if (!bounds) return;

        const ne = bounds.getNorthEast();
        const sw = bounds.getSouthWest();
        const neLat = ne.lat(), neLng = ne.lng();
        const swLat = sw.lat(), swLng = sw.lng();

        const inView = (lat, lng) => (
            lat >= swLat && lat <= neLat && lng >= swLng && lng <= neLng
        );

        const existingById = new Map();
        if (Array.isArray(gamePoiMarkers)) {
            for (const m of gamePoiMarkers) {
                if (m?.__poiId) existingById.set(m.__poiId, m);
            }
        }

        const nextMarkers = [];
        const kept = new Set();

        for (const poi of gamePois.values()) {
            if (!poi || poi.game !== "pokemon-go") continue;
            if (typeof poi.lat !== "number" || typeof poi.lng !== "number") continue;

            const style = getMarkerStyleForPoiType(poi.poiType);
            if (!style) continue;

            const id = poi.id || buildGamePoiId(poi.guid, poi.lat, poi.lng);
            if (!id) continue;

            const visible = inView(poi.lat, poi.lng);

            let marker = existingById.get(id);

            if (!marker) {
                if (!visible) continue; // don't create offscreen markers

                const fillOpacity = poi.status === POI_STATUS?.MISSING
                ? style.fillOpacity * 0.3
                : style.fillOpacity;

                const strokeOpacity = poi.status === POI_STATUS?.MISSING
                ? style.borderOpacity * 0.8
                : style.borderOpacity;

                const icon = {
                    path: google.maps.SymbolPath.CIRCLE,
                    scale: style.markerSize,
                    fillColor: style.fillColor,
                    fillOpacity,
                    strokeColor: style.borderColor,
                    strokeOpacity,
                    strokeWeight: style.borderWidth
                };

                marker = new google.maps.Marker({
                    map: submitMap,
                    position: { lat: poi.lat, lng: poi.lng },
                    icon,
                    title: poi.title || "",
                    zIndex: 7000 + (poi.poiType === "gym" ? 10 : poi.poiType === "stop" ? 5 : 0)
                });

                marker.__poiId = id;
                marker.__lat = poi.lat;
                marker.__lng = poi.lng;
                marker.__iconKey =
                    `${poi.poiType}|${poi.status}|` +
                    `${style.markerSize}|${style.fillColor}|${style.fillOpacity}|` +
                    `${style.borderColor}|${style.borderOpacity}|${style.borderWidth}`;

                marker.addListener("click", () => sendPoiToBridge(poi));
            } else {
                if (!visible) {
                    // prefer setVisible(false) if you decide to keep markers attached
                    marker.setMap(null);
                    continue;
                }

                const iconKey =
                      `${poi.poiType}|${poi.status}|` +
                      `${style.markerSize}|${style.fillColor}|${style.fillOpacity}|` +
                      `${style.borderColor}|${style.borderOpacity}|${style.borderWidth}`;

                if (marker.__lat !== poi.lat || marker.__lng !== poi.lng) {
                    marker.setPosition({ lat: poi.lat, lng: poi.lng });
                    marker.__lat = poi.lat;
                    marker.__lng = poi.lng;
                }
                if (marker.__iconKey !== iconKey) {
                    const fillOpacity = poi.status === POI_STATUS?.MISSING
                    ? style.fillOpacity * 0.3
                    : style.fillOpacity;

                    const strokeOpacity = poi.status === POI_STATUS?.MISSING
                    ? style.borderOpacity * 0.8
                    : style.borderOpacity;

                    marker.setIcon({
                        path: google.maps.SymbolPath.CIRCLE,
                        scale: style.markerSize,
                        fillColor: style.fillColor,
                        fillOpacity,
                        strokeColor: style.borderColor,
                        strokeOpacity,
                        strokeWeight: style.borderWidth
                    });
                    marker.__iconKey = iconKey;
                }
                if (marker.getMap() !== submitMap) marker.setMap(submitMap);
            }

            nextMarkers.push(marker);
            kept.add(marker);
        }

        if (Array.isArray(gamePoiMarkers)) {
            for (const m of gamePoiMarkers) {
                if (m?.setMap && !kept.has(m)) m.setMap(null);
            }
        }

        gamePoiMarkers = nextMarkers;
    }

    // -----------------------------
    // Highlight current cell
    // -----------------------------

    function highlightSubmitCell(lat, lng) {
        submitCellLat = lat;
        submitCellLng = lng;

        if (!submitMap || typeof google === "undefined" || !google.maps) return;

        const masterEnabled = !userSettings.master || userSettings.master.enabled !== false;
        const cfg = userSettings.highlightCell || {};
        const highlightEnabled = cfg.enabled !== false;

        // Always clear any existing polygon first
        if (submitCellHighlight) {
            submitCellHighlight.setMap(null);
            submitCellHighlight = null;
        }

        // If master or highlight are disabled, stop here
        if (!masterEnabled || !highlightEnabled) {
            return;
        }

        const strokeColor = cfg.color || "#FF0000";
        const strokeWeight = typeof cfg.lineWidth === "number" ? cfg.lineWidth : 4;
        const strokeOpacity = typeof cfg.lineOpacity === "number" ? cfg.lineOpacity : 1.0;

        const cell = S2.S2Cell.FromLatLng({ lat, lng }, POI_CELL_LEVEL);

        const corners = cell.getCornerLatLngs();
        const path = corners.map(c => ({
            lat: typeof c.lat === "function" ? c.lat() : c.lat,
            lng: typeof c.lng === "function" ? c.lng() : c.lng
        }));
        path.push(path[0]);

        submitCellHighlight = new google.maps.Polygon({
            map: submitMap,
            paths: path,
            strokeColor,
            strokeOpacity,
            strokeWeight,
            fillOpacity: 0,
            clickable: false,
            zIndex: 9999
        });
    }

    // Helper to reapply highlight when settings change
    function refreshHighlightCell() {
        if (submitCellLat == null || submitCellLng == null) return;
        highlightSubmitCell(submitCellLat, submitCellLng);
    }

    // -----------------------------
    // S2 library
    // -----------------------------
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

    // -----------------------------
    // css styling
    // -----------------------------

    function injectS2SettingsCSS() {
        if (document.getElementById("wfmapmods-s2settings-css")) return;

        const css = document.createElement("style");
        css.id = "wfmapmods-s2settings-css";
        css.textContent = `
    /* Backdrop */
    .wfmapmods-s2-backdrop {
        position: fixed;
        inset: 0;
        background: rgba(0,0,0,0.35);
        z-index: 2000;
        display: flex;
        align-items: center;
        justify-content: center;
        overflow-y: auto;
        padding-top: 12px;
        padding-bottom: 12px;
    }

    /* Dialog container */
    .wfmapmods-s2-dialog {
        background: #ffffff;
        border-radius: 8px;
        box-shadow: 0 10px 25px rgba(0,0,0,0.35);
        width: 250px;
        max-width: calc(100% - 32px);
        padding: 10px 12px 8px;
        box-sizing: border-box;
        font-family: Roboto, Arial, sans-serif;
        font-size: 12px;
        color: #111827;
        max-height: 90vh;
        overflow-y: auto;
    }

    .wfmapmods-s2-title {
        font-size: 15px;
        font-weight: 600;
        margin-bottom: 10px;
    }

    .wfmapmods-s2-section {
        padding-bottom: 6px;
        margin-bottom: 6px;
        border-bottom: 1px solid #e5e7eb;
    }

    .wfmapmods-s2-section--no-border {
        border-bottom: none;
    }

    .wfmapmods-s2-section-header {
        font-weight: 500;
        margin-bottom: 4px;
    }

    .wfmapmods-s2-row {
        display: flex;
        align-items: center;
        margin-bottom: 2px;
        gap: 4px;
    }

    .wfmapmods-s2-label {
        flex: 0 0 110px;
        font-size: 11px;
        color: #374151;
    }

    .wfmapmods-s2-row input[type="number"] {
        width: 60px;
        box-sizing: border-box;
        font-size: 11px;
        padding: 2px 4px;
    }

    .wfmapmods-s2-row input[type="color"] {
        width: 32px;
        height: 20px;
        padding: 0;
        border: none;
        background: none;
    }

    .wfmapmods-s2-section-highlight {
        border-top: 1px solid #e5e7eb;
        padding-top: 6px;
        margin-top: 6px;
        padding-bottom: 4px;
        margin-bottom: 4px;
        border-bottom: none;
    }

    .wfmapmods-s2-buttons {
        display: flex;
        justify-content: flex-end;
        gap: 8px;
        margin-top: 4px;
    }

    .wfmapmods-s2-btn {
        padding: 4px 12px;
        border-radius: 4px;
        border: 1px solid transparent;
        cursor: pointer;
        font-size: 12px;
        font-family: inherit;
    }

    .wfmapmods-s2-btn-cancel {
        background: #ffffff;
        border-color: #d1d5db;
        color: #111827;
    }

    .wfmapmods-s2-btn-ok {
        background: #2563eb;
        border-color: #2563eb;
        color: #ffffff;
    }

.wfmapmods-s2-row input[type="number"] {
    width: 60px;
    box-sizing: border-box;
    font-size: 11px;
    padding: 2px 4px;
    border: 1px solid #d1d5db; /* visible border */
    border-radius: 3px;
    background: #ffffff;
}

.wfmapmods-s2-grid-toggle-label {
    min-width: 130px;    /* tweak this to taste */
    font-size: 11px;
    color: #374151;
}

/* Fixed-width left column for marker rows so previews line up */
.wfmapmods-s2-marker-left {
    flex: 0 0 140px;  /* tweak this value to taste */
}

/* Preview column – same for all rows */
.wfmapmods-s2-marker-preview {
    flex: 0 0 32px;
    display: flex;
    align-items: center;
    justify-content: center;
    margin-left: 10px;
}

.wfmapmods-s2-marker-preview-circle {
    border-radius: 50%;
    box-sizing: border-box;
}

    //=====================
    // POI Icons
    //=====================

    .wfmapmods-section-poi-types {
        margin-top: 4px;
    }

    .wfmapmods-poi-types-row {
        display: flex;
        align-items: center;
        gap: 6px;
        padding: 4px 4px 0 4px;
        font-size: 12px;
        font-weight: 600;
        color: #374151;
    }

    .wfmapmods-poi-types-label {
        font-size: 12px;
        color: #374151;
        padding-right: 8px;
    }

    .wfmapmods-poi-type-links {
        display: flex;
        flex-wrap: wrap;
        gap: 16px;
    }

    .wfmapmods-poi-type-button {
        border: none;
        background: transparent;
        padding: 0;
        margin: 0;
        cursor: default; /* no behaviour yet */
        display: inline-flex;
        align-items: center;
        justify-content: center;
    }

    .wfmapmods-poi-type-button:focus-visible {
        outline: 2px solid #2563eb;
        outline-offset: 1px;
    }

    /* Icon sizing & greyscale */
    .wfmapmods-poi-type-button .wfmapmods-poi-type-content svg {
        width: 18px;
        height: 18px;
        display: block;

        /* Greyscale by default */
        filter: grayscale(1);
        transition: filter 0.15s ease-out, transform 0.1s ease-out;
    }

    /* On hover/focus: restore original colours */
    .wfmapmods-poi-type-button:hover .wfmapmods-poi-type-content svg,
    .wfmapmods-poi-type-button:focus-visible .wfmapmods-poi-type-content svg {
        filter: none;
        transform: scale(1.1); /* tiny “pop” effect */
    }

/* Base N/A button */
.wfmapmods-poi-type-button[data-poi-type="na"] {
    position: relative;
    padding: 0px;
    cursor: default;
    display: inline-flex;
    align-items: center;
    justify-content: center;
}

/* N/A text */
.wfmapmods-poi-type-button[data-poi-type="na"] .wfmapmods-poi-type-content {
    position: relative;
    font-size: 12px;
    font-weight: 600;
    z-index: 2;
}

/* Ellipse ALWAYS visible, but greyed by default */
.wfmapmods-poi-type-button[data-poi-type="na"]::before {
    content: "";
    position: absolute;
    inset: 0;
    background: #d1d5db;       /* grey ellipse */
    border-radius: 50%;
    opacity: 1;
    transform: scaleX(0.82) scaleY(0.70); /* <-- shorter & balanced */
    filter: grayscale(1);
    transition:
        filter 0.15s ease-out,
        background 0.15s ease-out,
        transform 0.1s ease-out;
    z-index: 1;
}

/* Hover/focus: slightly larger but still not overpowering */
.wfmapmods-poi-type-button[data-poi-type="na"]:hover::before,
.wfmapmods-poi-type-button[data-poi-type="na"]:focus-visible::before {
    background: #facc15;
    filter: none;
    transform: scaleX(0.92) scaleY(0.78); /* gentle pop, still subtle */
}

/* Focus outline accessibility */
.wfmapmods-poi-type-button[data-poi-type="na"]:focus-visible {
    outline: 2px solid #2563eb;
    outline-offset: 2px;
}

    /* Selected POI type: keep icon coloured even when not hovered */
    .wfmapmods-poi-type-button[data-selected="1"] .wfmapmods-poi-type-content svg {
        filter: none;
    }

    /* Selected N/A: keep ellipse yellow even when not hovered */
    .wfmapmods-poi-type-button[data-poi-type="na"][data-selected="1"]::before {
        background: #facc15;
        filter: none;
    }
    `;

        document.head.appendChild(css);
    }


    // -----------------------------
    // Plugin bootstrap
    // -----------------------------

    function bootstrap() {
        loadSettings();
        injectS2SettingsCSS();
        loadGamePoisFromIDB();
        setupMapRouteWatcher();
    }

    bootstrap();

})();