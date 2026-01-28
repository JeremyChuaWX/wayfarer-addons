// ==UserScript==
// @name         Wayfarer Map Mods - Base
// @version      3.0.3
// @description  Base plug-in for Wayfarer Maps
// @namespace    https://gitlab.com/Tntnnbltn/wayfarer-addons
// @downloadURL  https://gitlab.com/Tntnnbltn/wayfarer-addons/-/raw/main/wayfarer-map-mods-base.user.js
// @homepageURL  https://gitlab.com/Tntnnbltn/wayfarer-addons
// @match        https://wayfarer.nianticlabs.com/*
// @run-at       document-start
// @grant        none
// @require      https://cdn.jsdelivr.net/npm/heic-to@1.3.0/dist/iife/heic-to.js
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


(function() {
    'use strict';

    // ==================================
    // Global state & constants
    // ==================================

    // ----- Constants -----
    const MAP_MODE = {
        MOBILE: "mobile",
        DESKTOP: "desktop"
    };

    const GCS_MIN_ZOOM = 18;

    // ----- URLs and API -----
    const SUBMIT_ROUTE = "/new/submit/new";
    const MAPVIEW_ROUTE = "/new/mapview";
    const GCS_ENDPOINT_PART = "/api/v1/vault/mapview/gcs";

    // ----- Indexed DB -------
    const DB_NAME = "wayfarer-tools-db";
    const DRAFT_STORE_NAME = "draftSubmissions";
    const REPORTED_STORE_NAME = "reportedWayspots";

    // ----- Nomination status text -----
    const STATUS_LABELS = {
        LIVE: "Live",
        NOMINATED: "In Queue",
        NIANTIC_REVIEW: "Niantic Review",
        APPEALED: "Appeal Pending",
        HELD: "On Hold",
        WITHDRAWN: "Withdrawn",
        REJECTED: "Not Accepted",
        DUPLICATE: "Duplicate",
        ACCEPTED: "Accepted",
    };

    // ----- Logos and image URLs -----
    const WAYFARER_LOGO_SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 168.64822 385.63867"><g transform="translate(-1713.3254,-206.92756)"><path fill="#000000" d="m 1796.8177,206.93648 c -1.4336,0.0214 -2.8694,0.0811 -4.3086,0.17968 -46.5329,3.18681 -81.4741,42.22048 -79.0664,88.33008 0.6634,12.70543 1.194,14.21682 45.043,128.26758 12.3703,32.17497 22.7806,59.4 23.1328,60.5 0.9228,2.88168 3.7726,6.02575 7.6817,8.47656 7.3893,4.63273 19.8475,0.73709 23.4296,-7.32617 2.4087,-5.42181 55.0508,-143.34771 61.4317,-160.95508 6.7916,-18.74043 8.5934,-28.23315 7.5273,-39.66015 -2.0038,-21.47603 -10.6317,-39.26432 -26.3027,-54.23633 -16.3041,-15.57678 -37.0635,-23.89663 -58.5684,-23.57617 z m 0.6875,51.41406 a 33.067028,33.067028 0 0 1 33.0664,33.0664 33.067028,33.067028 0 0 1 -33.0664,33.06641 33.067028,33.067028 0 0 1 -33.0683,-33.06641 33.067028,33.067028 0 0 1 33.0683,-33.0664 z m 0.8184,269.64648 c -4.5709,-0.16021 -9.2407,0.67626 -13.7168,2.65625 -5.8988,2.6093 -13.0929,9.51789 -16.1582,15.51953 -3.6613,7.16844 -4.2239,17.96942 -1.3359,25.6211 3.4496,9.13947 10.5363,16.08888 19.9726,19.58789 5.5946,2.0745 18.5971,1.31232 24.1582,-1.41602 14.0914,-6.91328 21.5412,-22.84569 17.5488,-37.52539 -3.945,-14.50608 -16.7561,-23.96272 -30.4687,-24.44336 z" /></g></svg>';
    const SUBMISSION_PIN = '<svg width="30" height="47" viewBox="0 0 30 47" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M14.5146 0C22.5308 1.85546e-05 29.0293 6.49846 29.0293 14.5146C29.0293 22.0646 23.2643 28.2678 15.8965 28.9639V44.2354C15.8963 44.9986 15.278 45.6172 14.5146 45.6172C13.7513 45.6172 13.132 44.9986 13.1318 44.2354V28.9639C5.76427 28.2676 1.65052e-05 22.0644 0 14.5146C0 6.49845 6.49845 0 14.5146 0ZM14.5176 9.67676C11.8457 9.67693 9.67969 11.8427 9.67969 14.5146C9.67978 17.1865 11.8457 19.3524 14.5176 19.3525C17.1896 19.3525 19.3564 17.1866 19.3564 14.5146C19.3564 11.8426 17.1896 9.67676 14.5176 9.67676Z" fill="#FF4713"/><path opacity="0.3" d="M14.5145 46.9998C16.4231 46.9998 17.9703 46.2262 17.9703 45.2719C17.9703 44.3176 16.4231 43.5439 14.5145 43.5439C12.6058 43.5439 11.0586 44.3176 11.0586 45.2719C11.0586 46.2262 12.6058 46.9998 14.5145 46.9998Z" fill="#FF4713"/></svg>';
    const LAYERS_BUTTON_SVG = '<svg viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg" focusable="false"><path d="M0.682 9.431l14.847 8.085c0.149 0.081 0.313 0.122 0.479 0.122 0.163 0 0.326-0.040 0.474-0.12l15.003-8.085c0.327-0.176 0.53-0.52 0.525-0.892s-0.216-0.711-0.547-0.88l-14.848-7.54c-0.283-0.143-0.617-0.144-0.902-0.002l-15.002 7.54c-0.332 0.167-0.545 0.505-0.551 0.877s0.196 0.717 0.521 0.895zM16.161 2.134l12.692 6.446-12.843 6.921-12.693-6.912zM31.292 15.010l-2.968-1.507-2.142 1.155 2.5 1.27-12.842 6.921-12.694-6.912 2.666-1.34-2.136-1.164-3.135 1.575c-0.332 0.167-0.545 0.505-0.551 0.877s0.196 0.717 0.521 0.895l14.847 8.085c0.149 0.081 0.313 0.122 0.479 0.122 0.163 0 0.326-0.040 0.474-0.12l15.003-8.085c0.327-0.176 0.53-0.52 0.525-0.892s-0.215-0.711-0.546-0.88zM31.292 22.010l-2.811-1.382-2.142 1.155 2.344 1.145-12.843 6.921-12.694-6.912 2.478-1.121-2.136-1.164-2.947 1.357c-0.332 0.167-0.545 0.505-0.551 0.877s0.196 0.717 0.521 0.895l14.847 8.085c0.149 0.081 0.313 0.122 0.479 0.122 0.163 0 0.326-0.040 0.475-0.12l15.003-8.085c0.327-0.176 0.53-0.52 0.525-0.892-0.005-0.373-0.215-0.712-0.546-0.88z"></path></svg>'
    const FILTER_BUTTON_SVG = '<svg width="800px" height="800px" fill="#000000" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg"><path d="M12,25l6.67,6.67a1,1,0,0,0,.7.29.91.91,0,0,0,.39-.08,1,1,0,0,0,.61-.92V13.08L31.71,1.71A1,1,0,0,0,31.92.62,1,1,0,0,0,31,0H1A1,1,0,0,0,.08.62,1,1,0,0,0,.29,1.71L11.67,13.08V24.33A1,1,0,0,0,12,25ZM3.41,2H28.59l-10,10a1,1,0,0,0-.3.71V28.59l-4.66-4.67V12.67a1,1,0,0,0-.3-.71Z"/></svg>'
    const COMMUNITY_CONTRIBUTED_ICON_SVG = '<?xml version="1.0" encoding="UTF-8"?><svg fill="none" viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg"><path d="m5.6334 1.3516c-0.50443 0.0567-1.0357 0.24936-1.4667 0.53188-0.36184 0.23718-0.70932 0.58463-0.94979 0.94973-0.78295 1.1887-0.72416 2.7338 0.1474 3.875 0.10802 0.14144 0.38819 0.42714 0.53572 0.54632 1.2057 0.97403 2.9032 0.9936 4.1417 0.04773 0.14143-0.10801 0.42713-0.38818 0.54631-0.53571 0.99149-1.2273 0.99149-2.9727 0-4.2-0.11918-0.14754-0.40488-0.4277-0.54631-0.53572-0.49627-0.37902-1.0793-0.6129-1.6952-0.67998-0.18546-0.0202-0.53-0.01985-0.71315 7.5e-4zm4.8648 0.08803c-0.2 0.05795-0.347 0.18372-0.4371 0.37392-0.0479 0.1012-0.0527 0.12575-0.0521 0.26966 8e-4 0.19997 0.0414 0.3112 0.1611 0.44222 0.1089 0.11918 0.1778 0.158 0.4224 0.23813 0.3291 0.10782 0.5563 0.24029 0.7854 0.45792 0.3188 0.30283 0.5445 0.73942 0.6043 1.169 0.0678 0.48778-0.0446 0.97453-0.3209 1.3896-0.2689 0.40396-0.6499 0.67815-1.1399 0.82046-0.2265 0.06577-0.3661 0.18097-0.4603 0.37975-0.0479 0.1012-0.0527 0.12575-0.0521 0.26967 5e-4 0.12493 0.0087 0.17867 0.0389 0.25475 0.0535 0.13475 0.1916 0.27977 0.3325 0.34912 0.1037 0.0511 0.1214 0.05445 0.2859 0.05431 0.1628-1.5e-4 0.1904-0.0053 0.3837-0.07151 0.5184-0.17755 0.9379-0.43845 1.317-0.81904 0.4676-0.46955 0.7672-1.0311 0.9087-1.7033 0.0537-0.25502 0.0744-0.76184 0.0419-1.0254-0.1134-0.92072-0.5822-1.7371-1.3092-2.2798-0.2227-0.16625-0.3312-0.23205-0.5775-0.35048-0.4001-0.19242-0.745-0.27337-0.9327-0.21897zm-4.7565 1.246c-0.43014 0.05483-0.83595 0.2563-1.1511 0.57147-0.9752 0.97518-0.69465 2.6096 0.55112 3.2108 0.75761 0.36563 1.6669 0.20833 2.2675-0.39225 0.85882-0.8588 0.76173-2.2684-0.20672-3.002-0.41085-0.3112-0.94675-0.45357-1.4608-0.38805zm-2.1083 6.666c-0.60401 0.0679-1.2736 0.34538-1.7167 0.71138-0.70502 0.5824-1.1359 1.3716-1.2324 2.2571-0.009933 0.0911-0.017633 0.5146-0.017633 0.969 0 0.7583 2e-3 0.8137 0.03305 0.9132 0.083083 0.2662 0.35281 0.4643 0.63221 0.4643 0.28347 0 0.5512-0.1958 0.63502-0.4643 0.03093-0.0991 0.03305-0.1547 0.03305-0.8671 0-0.4248 0.00765-0.8236 0.01732-0.9024 0.05563-0.4537 0.25013-0.8526 0.57323-1.1757 0.32308-0.3231 0.72203-0.5176 1.1757-0.5732 0.09082-0.0112 0.88805-0.0173 2.2338-0.0173s2.143 0.0061 2.2338 0.0173c0.22266 0.0273 0.4426 0.0926 0.64123 0.1904 0.61495 0.3028 1.0243 0.8787 1.1077 1.5585 0.00967 0.0788 0.0173 0.4776 0.0173 0.9024 0 0.7124 0.0021 0.768 0.0331 0.8671 0.0831 0.2662 0.3528 0.4643 0.6322 0.4643 0.2835 0 0.5512-0.1958 0.635-0.4643 0.0311-0.0995 0.0331-0.1549 0.0331-0.9132 0-0.4544-0.0077-0.8779-0.0177-0.969-0.0697-0.6398-0.325-1.2551-0.7277-1.7535-0.1192-0.1476-0.4049-0.4277-0.5463-0.5358-0.49628-0.37897-1.0793-0.61285-1.6952-0.67993-0.1956-0.02132-4.5231-0.02062-4.7132 7.5e-4zm8.8648 0.08803c-0.2 0.05795-0.347 0.18372-0.4371 0.37392-0.0479 0.1012-0.0527 0.12575-0.0521 0.26963 8e-4 0.2 0.0414 0.3112 0.1611 0.4422 0.1093 0.1197 0.1777 0.158 0.4274 0.2398 0.2431 0.0797 0.4187 0.1697 0.6083 0.312 0.3081 0.2312 0.5472 0.5589 0.6751 0.9253 0.1056 0.3023 0.1062 0.3091 0.1181 1.2724 0.0121 0.9837 0.0088 0.9549 0.1308 1.1163 0.276 0.365 0.7962 0.365 1.0743 0 0.0347-0.0457 0.078-0.1306 0.0962-0.1889 0.0311-0.0995 0.0331-0.1549 0.0331-0.9132 0-0.4544-0.0077-0.8779-0.0177-0.969-0.0692-0.636-0.3274-1.2581-0.7277-1.7535-0.1192-0.1476-0.4049-0.4278-0.5463-0.5357-0.2883-0.22012-0.6618-0.41718-1.0083-0.53202-0.2354-0.07796-0.4055-0.0968-0.5352-0.05923z" clip-rule="evenodd" fill="currentColor" fill-rule="evenodd"/></svg>'
    const IMPORT_ICON_SVG = '<?xml version="1.0" encoding="UTF-8"?><svg viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg"><path d="m4.6667 2.6667c0-0.36819 0.29847-0.66667 0.66666-0.66667h2.6667c0.36819 0 0.66667 0.29848 0.66667 0.66667v2.6667c0 0.36819-0.29848 0.66667-0.66667 0.66667s-0.66667-0.29848-0.66667-0.66667v-2h-2c-0.36819 0-0.66666-0.29847-0.66666-0.66666z" clip-rule="evenodd" fill="currentColor" fill-rule="evenodd"/><path d="m4 6c-0.36819 0-0.66667 0.29848-0.66667 0.66667v5.3333c0 0.3682 0.29848 0.6667 0.66667 0.6667h8c0.3682 0 0.6667-0.2985 0.6667-0.6667v-5.3333c0-0.36819-0.2985-0.66667-0.6667-0.66667h-8zm-2 0.66667c0-1.1046 0.89543-2 2-2h8c1.1046 0 2 0.89543 2 2v5.3333c0 1.1046-0.8954 2-2 2h-8c-1.1046 0-2-0.8954-2-2v-5.3333z" clip-rule="evenodd" fill="currentColor" fill-rule="evenodd"/><path d="m0.66669 9.3333c0-0.36819 0.29848-0.66666 0.66666-0.66666h1.3333c0.36819 0 0.66666 0.29847 0.66666 0.66666s-0.29847 0.66667-0.66666 0.66667h-1.3333c-0.36819 0-0.66666-0.29848-0.66666-0.66667z" clip-rule="evenodd" fill="currentColor" fill-rule="evenodd"/><path d="m12.667 9.3333c0-0.36819 0.2985-0.66666 0.6667-0.66666h1.3333c0.3682 0 0.6667 0.29847 0.6667 0.66666s-0.2985 0.66667-0.6667 0.66667h-1.3333c-0.3682 0-0.6667-0.29848-0.6667-0.66667z" clip-rule="evenodd" fill="currentColor" fill-rule="evenodd"/><path d="M10 8C10.3682 8 10.6667 8.29848 10.6667 8.66667V10C10.6667 10.3682 10.3682 10.6667 10 10.6667C9.63183 10.6667 9.33335 10.3682 9.33335 10V8.66667C9.33335 8.29848 9.63183 8 10 8Z" clip-rule="evenodd" fill="currentColor" fill-rule="evenodd"/><path d="m6 8c0.36819 0 0.66667 0.29848 0.66667 0.66667v1.3333c0 0.3682-0.29848 0.6667-0.66667 0.6667s-0.66667-0.2985-0.66667-0.6667v-1.3333c0-0.36819 0.29848-0.66667 0.66667-0.66667z" clip-rule="evenodd" fill="currentColor" fill-rule="evenodd"/></svg>'
    const POI_TYPE_ICONS = {
        stop: `<svg version="1.1" viewBox="0 0 1115.9 1101.7" xmlns="http://www.w3.org/2000/svg"><g transform="translate(-245.24 -83.265)"><path d="m813.38 1174.4c-10.371-1.659-19.241-8.2434-24.438-18.139-2.4331-4.6333-2.7761-6.3928-2.7842-14.284-8e-3 -7.8282 0.35271-9.737 2.7706-14.66 3.3492-6.82 9.0296-12.176 16.579-15.632 5.1975-2.3795 7.0814-2.618 26.294-3.3281 70.912-2.6209 132.02-17.83 192.85-48.001 92.909-46.081 166.45-119.41 211.97-211.38 15.916-32.153 25.414-57.509 33.992-90.743 9.6717-37.473 12.482-59.116 15.378-118.43 0.6267-12.832 7.347-22.516 19.541-28.157 7.9296-3.6682 18.31-3.6682 26.24 0 7.5903 3.5112 13.256 8.8592 16.6 15.669 2.7764 5.6536 2.7798 5.6861 2.7418 26.661-0.1069 59.08-13.18 124.45-36.898 184.5-7.3982 18.731-27.18 58.742-37.575 76-50.561 83.941-119.71 150.15-205.54 196.8-68.76 37.372-152.13 60.417-226.95 62.735-9.35 0.2896-19.025 0.6676-21.5 0.8401s-6.6458-0.03-9.2685-0.4492zm-536.37-516.61c-8.5764-3.2681-14.152-8.4392-18.944-17.571-2.0436-3.8942-2.4136-6.2336-2.748-17.377-0.41806-13.931 0.99604-38.409 3.4155-59.123 15.686-134.29 83.432-259.01 188.27-346.61 71.176-59.469 160.02-100.6 250.14-115.81 31.306-5.2822 75.128-8.9969 91.74-7.7766 13.033 0.95744 23.701 7.7778 28.98 18.527 2.4179 4.9236 2.7786 6.8323 2.7706 14.661-8e-3 7.8914-0.35101 9.6509-2.7842 14.284-5.3833 10.251-13.878 16.366-25.342 18.244-3.2254 0.52822-11.264 0.96766-17.864 0.97652-39.001 0.0524-90.862 9.0576-132.78 23.056-182.54 60.96-309.73 227.17-319.68 417.73-0.53719 10.291-1.1432 22.312-1.3467 26.712-0.43056 9.3098-3.3598 16.162-9.5587 22.361-6.1575 6.1575-12.235 8.5901-22.139 8.8607-5.3597 0.14645-9.8408-0.27864-12.129-1.1506z" fill="#1e0ae5" stroke="#1b0ae6" stroke-width="20"/><path d="m772.19 1031.9c-81.594-5.873-157.25-35.673-222.19-87.523-17.267-13.785-46.517-43.024-60.401-60.378-33.012-41.263-58.142-89.176-72.465-138.16-4.1042-14.037-10.135-40.079-10.135-43.767v-2.0723h239.63l4.3442 8.5677c16.569 32.678 42.21 57.932 75.524 74.382 14.922 7.3686 23.695 10.445 40.5 14.202 9.383 2.0978 12.947 2.3444 33.5 2.318 21.648-0.0278 23.705-0.1949 35-2.8424 32.384-7.5908 59.188-22.351 81.983-45.145 12.657-12.657 22.037-25.376 30.041-40.733l5.6025-10.75h239.87v2.0723c0 3.6406-6.0086 29.656-9.9931 43.267-27.759 94.824-91.337 177.66-176.07 229.41-69.679 42.55-153.64 62.994-234.74 57.156zm20.307-333.02c-15.025-1.4152-27.17-7.4144-39.088-19.308-6.1971-6.1844-9.0433-9.9917-12.174-16.285-13.082-26.298-7.9869-57.216 12.735-77.283 26.04-25.216 66.387-25 92.446 0.49573 25.073 24.532 26.097 65.702 2.2679 91.175-15.393 16.455-33.612 23.331-56.187 21.204zm-385.5-134.27c0-5.3686 7.6813-36.577 13.195-53.61 19.089-58.97 50.704-111.25 94.281-155.89 34.902-35.759 68.852-60.316 112.79-81.588 110.17-53.333 240.43-52.772 348.78 1.5041 43.031 21.556 75.359 45.212 109.48 80.11 53.9 55.131 89.972 123.02 105.52 198.59 1.0752 5.2254 1.9549 10.126 1.9549 10.891 0 1.1792-18.231 1.3807-120.25 1.3294l-120.25-0.0605-3.8699-8.0654c-14.559-30.342-45.036-60.249-76.631-75.199-58.891-27.865-127.32-19.617-177.51 21.397-16.601 13.564-33.22 34.115-42.182 52.161l-4.8038 9.6722-120.25 0.0777c-102.03 0.06592-120.25-0.13293-120.25-1.3122z" fill="#0074d9" stroke="#0075db" stroke-width="50"/></g></svg>`,
        gym: `<svg version="1.1" viewBox="0 0 654.32 696.7" xmlns="http://www.w3.org/2000/svg"><g transform="translate(-155.17 -129.6)" fill="#ff0202"><path d="m474.15 825.81c-1.6812-5.2991-19.54-71.464-25.052-92.813-2.7688-10.725-12.779-48.075-22.245-83l-17.211-63.5-26.069-0.0232c-27.672-0.0246-33.369-0.64919-54.77-6.0044-28.239-7.0662-59.671-21.947-82.102-38.869-10.248-7.7317-24.918-21.31-33.948-31.423-8.4062-9.4144-19.299-23.964-18.522-24.74 0.57377-0.57377 28.362-15.482 56.273-30.191 11-5.7969 29.139-15.438 40.308-21.425l20.308-10.885 6.1915 5.6366c26.757 24.359 62.321 32.391 96.168 21.72 14.961-4.7167 24.796-10.595 36.361-21.73 23.599-22.722 34.392-53.022 29.748-83.512-0.87528-5.7458-1.2525-10.754-0.83831-11.129 0.4142-0.3751 9.7531-5.3938 20.753-11.153 19.806-10.369 55.473-29.315 112.5-59.758 16.225-8.6616 34.45-18.353 40.5-21.536s22.925-12.185 37.5-20.004 35.725-19.067 47-24.997c11.275-5.9295 32.134-17.041 46.354-24.692 14.22-7.6508 25.98-13.77 26.134-13.598 0.27904 0.31187-39.844 80.897-232.58 467.13-98.304 196.99-101.74 203.7-102.76 200.5z"/><path d="m376 426.43c-13.74-2.3692-21.701-5.4347-31.639-12.183-11.065-7.5143-20.23-19.67-24.901-33.027-3.561-10.183-4.4975-28.09-2.0248-38.718 4.944-21.25 20.879-39.567 41.564-47.779 17.943-7.1225 39.48-5.845 57.202 3.3929 8.2599 4.3057 23.139 19.137 27.475 27.386 6.2429 11.878 7.8285 18.605 7.778 33-0.0399 11.395-0.38012 14.004-2.7558 21.131-7.081 21.243-26.356 39.571-47.199 44.881-6.1542 1.5677-21.038 2.6869-25.5 1.9175zm20.369-18.937c25.519-6.6468 42.248-32.192 37.652-57.492-6.1338-33.767-42.008-52.047-72.642-37.016-30.462 14.947-37.711 54.882-14.545 80.121 12.111 13.194 31.969 18.962 49.535 14.387z" stroke="#f00" stroke-width="5"/><path d="m167.62 433.75c-7.9115-22.511-11.425-41.875-12.293-67.75-1.6732-49.863 10.689-93.275 38.443-135 22.561-33.917 51.907-59.565 88.735-77.55 37.152-18.144 75.012-25.888 114.37-23.393 58.398 3.7012 111.4 28.197 151.63 70.074 8.7851 9.1457 24.5 28.443 24.5 30.085 0 0.32594-11.362 6.6531-25.25 14.06-59.054 31.498-77.685 41.411-84.924 45.186l-7.6736 4.0015-6.3559-6.1032c-10.452-10.037-23.512-17.491-38.5-21.973-11.914-3.5632-32.913-4.4567-45.379-1.9308-17.615 3.5692-33.758 11.98-47.342 24.666-17.829 16.651-28.514 39.41-30.222 64.378-0.53883 7.8769 0.74469 23.988 2.2167 27.824 0.28936 0.75404-1.058 2.0088-3.2904 3.0643-2.0792 0.98304-20.88 10.907-41.78 22.053-49.614 26.46-72.498 38.559-72.932 38.559-0.19298 0-1.972-4.6125-3.9533-10.25z"/></g></svg>`,
        powerspot: `<svg width="264.47mm" height="253.69mm" version="1.1" viewBox="0 0 264.47 253.69" xml:space="preserve" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"><defs><linearGradient id="c" x1="61.207" x2="449.01" y1="103.22" y2="103.22" gradientTransform="translate(-2,-37.5)" gradientUnits="userSpaceOnUse"><stop stop-color="#a260c3" offset="0"/><stop stop-color="#9a6fb4" offset=".5"/><stop stop-color="#a678ca" offset="1"/></linearGradient><linearGradient id="b" x1="58.189" x2="449.44" y1="26.182" y2="26.182" gradientTransform="translate(1,23.5)" gradientUnits="userSpaceOnUse"><stop stop-color="#a271c0" stop-opacity=".99608" offset="0"/><stop stop-color="#a885bd" offset=".25"/><stop stop-color="#a68dbc" offset=".49845"/><stop stop-color="#ad98bf" offset=".75"/><stop stop-color="#b2a2ca" offset=".96478"/><stop stop-color="#ebe7fc" offset="1"/></linearGradient><filter id="f" x="-.045401" y="-.026893" width="1.0908" height="1.0538" color-interpolation-filters="sRGB"><feGaussianBlur stdDeviation="4.7619707"/></filter><filter id="l" x="-.080472" y="-.065628" width="1.1609" height="1.1313" color-interpolation-filters="sRGB"><feGaussianBlur stdDeviation="7.9663468"/></filter><filter id="e" x="-.082663" y="-.043292" width="1.1653" height="1.0866" color-interpolation-filters="sRGB"><feGaussianBlur stdDeviation="4.1877723"/></filter><linearGradient id="a" x1="256.37" x2="255.61" y1="358.89" y2="323.89" gradientUnits="userSpaceOnUse"><stop stop-color="#e8429d" offset="0"/><stop stop-color="#e8429d" stop-opacity="0" offset="1"/></linearGradient><filter id="d" x="-.50929" y="-.1014" width="2.0186" height="1.2028" color-interpolation-filters="sRGB"><feGaussianBlur stdDeviation="7.1606199"/></filter><filter id="k" x="-1.0421" y="-.0073109" width="3.0843" height="1.0146" color-interpolation-filters="sRGB"><feGaussianBlur stdDeviation="1.2281692"/></filter><filter id="j" x="-.69224" y="-.12867" width="2.3845" height="1.2573" color-interpolation-filters="sRGB"><feGaussianBlur stdDeviation="2.5494275"/></filter><filter id="i" x="-.2729" y="-.064634" width="1.5458" height="1.1293" color-interpolation-filters="sRGB"><feGaussianBlur stdDeviation="1.4472579"/></filter><filter id="h" x="-.2729" y="-.064634" width="1.5458" height="1.1293" color-interpolation-filters="sRGB"><feGaussianBlur stdDeviation="1.4472579"/></filter><filter id="g" x="-.2729" y="-.064634" width="1.5458" height="1.1293" color-interpolation-filters="sRGB"><feGaussianBlur stdDeviation="1.4472579"/></filter></defs><g transform="translate(26.603 -30.162)"><path transform="matrix(.91985 0 0 .40137 -124.58 58.711)" d="m252.08 490.73s-8.4853-10.253-7.0711-13.081 8.1317-6.7175 3.8891-13.789-8.1317-14.849-4.2426-22.981c3.8891-8.1317 7.4246-15.91 2.4749-22.274-4.9498-6.364-6.364-8.4853-2.1213-16.263 4.2426-7.7782 10.607-11.667 6.0104-27.577-4.5962-15.91-5.3033-32.173-10.253-38.537-4.9498-6.364-4.9498-4.9497-7.7782-19.445-2.8284-14.496 1.4142-20.153-6.0104-27.931s-29.345-33.234-28.638-50.205c0.70711-16.971-73.893-167.94-73.893-167.94l251.73-3.5355-87.681 197.28s-6.7175 8.1317-6.364 15.556c0.35355 7.4246 0.35355 10.96-3.182 16.617-3.5355 5.6569-10.607 19.799-8.4853 24.042 2.1213 4.2426-8.8388 25.809-8.8388 31.113s-3.8891 39.244-1.4142 41.719c2.4749 2.4749 7.4246 3.8891 6.0104 7.4246-1.4142 3.5355-8.1317 11.314-7.7782 12.374s10.607 9.8995 8.1317 14.849c-2.4749 4.9497-8.8388 19.799-6.7175 22.627 2.1213 2.8284 8.1317 17.678 5.6569 22.274-2.4749 4.5962-7.7782 19.092-7.7782 19.092z" fill="#d14e9e" filter="url(#f)" opacity=".84552"/><path transform="matrix(.71076 0 0 .26289 -74.586 77.669)" d="m132.23 73.539 237.59 0.70711-113.84 290.62z" fill="#ed61e2" filter="url(#l)" stroke-linejoin="round" stroke-miterlimit="20" stroke-width="3.954" style="mix-blend-mode:normal"/><path transform="matrix(.91298 0 0 .37461 -124.86 68.513)" d="m188.09 82.024c6.4328 10.613 15.349 19.707 18.819 31.933 9.6899 20.348 15.989 42.191 18.678 64.555 2.0983 13.108 7.1957 25.398 11.885 37.698 3.4875 10.673 3.6002 21.985 2.8226 33.045 1.1596 13.044 10 23.731 12.268 36.515 2.8673 6.8333 7.8417 19.825 9.0545 23.3 4.4958-12.021 10.609-23.762 10.759-36.927 2.0724-23.824-6.6382-48.321 1.9312-71.516 3.402-11.987 7.5436-23.729 9.5663-36.041 3.3059-11.552 4.747-23.457 5.9936-35.365 2.368-10.427 9.766-18.772 12.953-29.022 1.6534-6.7536 13.918-19.255 1.02-21.44-15.322 0.71665-30.71 1.0726-46.001-0.30055-18.384 0.38057-36.752-0.31045-55.088-1.546-1.8242-0.01585-3.6495 0.02954-5.4692 0.16241" fill="#faf9fb" filter="url(#e)" opacity=".34053"/><path transform="matrix(.91298 0 0 .55196 -124.86 3.8505)" d="m253.14 491.09s-5.3033-7.4246-5.3033-12.021c0-4.5962 5.6568-7.7782 1.7678-13.789-3.8891-6.0104-13.435-15.556-8.4853-24.042 4.9498-8.4853 9.5459-19.092 5.3033-24.749-4.2426-5.6568-2.1213-3.182 0.35356-13.435 2.4749-10.253 8.1317-23.335 3.8891-33.941s-11.314-45.608-14.142-47.023 33.588 1.0607 33.588 1.0607-6.7175 21.92-6.0104 30.406c0.70711 8.4853 3.182 19.799-1.0607 28.638-0.97963 2.0409-1.7678 8.1317 0.35356 10.607 2.1213 2.4749 8.8388 13.435 4.9497 19.445-3.8891 6.0104-3.182 10.253-2.8284 14.496 0.35355 4.2426 5.3033 8.1317 3.5355 12.374s-8.4853 8.4853-6.364 15.556 8.4853 14.849 4.9498 19.092c-3.5355 4.2426-4.5962 10.253-4.5962 14.142s-9.8995 3.182-9.8995 3.182z" fill="url(#a)" filter="url(#d)"/><ellipse cx="109.32" cy="274.87" rx="13.923" ry="5.9119" fill="#a16b96" stroke="#e564eb" stroke-linejoin="round" stroke-miterlimit="20" stroke-width="2.3011"/><g transform="matrix(.92339 0 0 .39875 -127.54 80.122)" fill="#fff"><rect x="254.91" y="85.143" width="2.8284" height="403.18" filter="url(#k)" style="mix-blend-mode:normal"/><ellipse transform="matrix(.96441 0 0 1 9.2465 -14.506)" cx="256.33" cy="306.8" rx="4.4194" ry="23.776" filter="url(#j)" opacity=".73256" style="mix-blend-mode:normal"/><ellipse transform="matrix(.82784 0 0 1 44.635 -22.317)" cx="255.64" cy="252.95" rx="6.364" ry="26.87" filter="url(#i)" opacity=".74917" style="mix-blend-mode:normal"/><ellipse transform="matrix(.82784 0 0 1 44.098 -153.97)" cx="255.64" cy="252.95" rx="6.364" ry="26.87" filter="url(#h)" opacity=".74917" style="mix-blend-mode:normal"/><ellipse transform="matrix(.82784 0 0 1 44.617 -88.223)" cx="255.64" cy="252.95" rx="6.364" ry="26.87" filter="url(#g)" opacity=".74917" style="mix-blend-mode:normal"/></g><g transform="matrix(.66856 0 0 1.0507 -66.765 23.778)"><path d="m109.96 41.012c131.86 21.042 260.18 16.679 298.4 1.0607l25.102-12.374-12.374-10.96s-64.225-7.8817-91.803-9.6495c-27.577-1.7678-99.47-0.95711-121.39-0.60355s-102.18 5.3033-111.37 8.8388c-9.1924 3.5355-23.688 9.1924-23.688 9.1924l8.8388 14.142z" fill="#9e7da1"/><ellipse cx="251.97" cy="42.28" rx="141.83" ry="15.458" fill="#779953"/><path d="m60.268 44.416 13.689 19.268s22.25 20.5 149.75 21.5c127.5 1 161.08-8.3092 178.4-10.784 17.324-2.4749 28.284-7.6014 28.284-7.6014s6.9827-4.6846 10.872-9.6343c3.8891-4.9497 9.0156-11.49 9.0156-11.49l-148.58 13.347-172.53-3.5355z" fill="url(#c)"/><path d="m60.104 32.173s-0.17678-4.2426 1.2374-5.1265c1.4142-0.88388 3.2991-1.7615 14.672-6.0104 11.667-4.3588 20.663-6.0239 26.663-6.7739 6-0.75 9.6768-0.11612 9.6768-0.11612s-20.783 5.6525-24.319 8.1274-6.364 3.5355-1.0607 7.0711 31.969 11.255 67.175 13.435c35.355 2.1893 98.288 3.182 131.88 2.4749 33.588-0.70711 96.874-3.8891 110.66-6.7175s24.395-6.0104 26.87-8.8388 1.3244-5.6861-2.1213-7.7782c-4.9498-3.0052-34.471-7.7782-34.471-7.7782s13.45-1.4541 28.284 0.17678c18.686 2.0543 28.365 8.0198 32.704 10.43s2.8284 6.364 2.8284 6.364l-4.2426 9.8995-123.74 15.203-211.42-4.9497-47.023-12.728z" fill="#dfbceb"/><path d="m60.427 32.342-0.35355 11.857s20.966 14.844 67.689 17.6c46.625 2.75 78.177 6.7197 133.43 5.9697s141.5-7.25 161-12.25 27.912-9.9393 27.912-9.9393l0.33839-14.061s-6 6.25-27.5 10-105.18 10.174-160.5 10.75-144.5-0.98598-174.11-9.6771c-21.897-6.426-27.901-10.25-27.901-10.25z" fill="url(#b)"/><path d="m101.16 17.78s46.083-9.4178 169.09-9.2803c90.54 0.10116 148.25 11.375 148.25 11.375l9.4528-2.2108s-24.54-10.831-157.58-11.539c-165.31-0.8803-177.77 10.643-177.77 10.643z" fill="#dfbceb"/></g></g></svg>`
    };
    const MAP_MENU_ICON_SVG = '<svg viewBox="0 0 75 75" width="24" height="24" fill="currentColor" class="sidebar-link__icon"><path d="M 8.755372e-7,11.25 26.250001,0 l 22.5,11.25 23.6362,-10.1287 c 0.2854,-0.1224 0.5966,-0.1719 0.9058,-0.1443 0.3092,0.0277 0.6067,0.1317 0.8658,0.3027 0.2591,0.171 0.4717,0.4036 0.6187,0.677 0.147,0.2735 0.2238,0.5791 0.2235,0.8896 V 63.75 l -26.25,11.25 -22.5,-11.25 -23.6362001,10.1288 c -0.2854,0.1223 -0.5966,0.1718 -0.9058,0.1442 -0.3092,-0.0277 -0.6067,-0.1317 -0.86580002,-0.3027 -0.2591,-0.171 -0.4717,-0.4036 -0.6187,-0.677 C 0.07650088,72.7698 -2.9912446e-4,72.4642 8.755372e-7,72.1537 Z M 52.500001,65.2313 l 15,-6.4276 v -47.43 l -15,6.4276 z m -7.5,-0.4913 V 17.76 l -15,-7.5 v 46.98 z m -22.5,-7.5412 V 9.7688 L 7.5000009,16.1962 v 47.43 z"/></svg>'

    const NIANTIC_PLACEHOLDER_IMAGE_URL = 'https://lh3.googleusercontent.com/fs2mYM4r9Qq93ejdOP_2lwefRNLVa9tqmJW7XXwqNhMCMXNKwoJoFuMboBpXwnKUf7fJGImbajM9mHAOMlndt5A-Ts9Qh9f_t6YoaQ6u';
    const NIANTIC_PLACEHOLDER_IMAGE_SVG = '<svg version="1.1" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg"><g><rect x="19.525" y="73.763" width="471.86" height="381.83" fill="#fff"/><path d="m0 256v-256h512v512h-512zm428 132.49c0-1.1628-15.686-31.755-21.273-41.488-13.063-22.758-28.877-43.934-39.302-52.629-8.4886-7.0799-14.865-9.8079-22.925-9.8079-5.6554 0-7.9929 0.5175-12.169 2.6941-6.9797 3.6378-15.887 11.197-21.795 18.494l-4.872 6.0188-5.3031-8.4468c-27.388-43.625-50.763-68.948-72.361-78.396-4.5315-1.9821-7.1729-2.4077-15-2.417-8.6645-0.0102-10.106 0.27589-16.393 3.2534-23.475 11.117-47.467 38.663-78.03 89.587-9.956 16.589-38.577 70.789-38.577 73.053 0 0.32698 78.3 0.59452 174 0.59452s174-0.23062 174-0.5125zm-57.087-142.03c8.7149-2.0542 15.448-5.8767 22.213-12.611 18.155-18.073 18.11-47.611-0.10065-65.822-27.047-27.047-72.692-12.169-79.206 25.818-3.9486 23.027 11.287 46.359 34.18 52.342 8.1463 2.1293 14.707 2.2075 22.913 0.273z" fill="#d1cdc4"/></g></svg>'


    // ----- Cross-script toggle group -----
    const WF_TOGGLE_GROUP = "wf-lefttop-controls";
    const WF_TOGGLE_ACTIVE_CLASS = "wf-toggle-active";

    // ----- API checking ------
    let poiImagesApiLive = false;
    let reportApiLive = false;

    // ----- Available quotas -----
    let availableQuotas = {
        lastFetchedMs: 0,
        data: {}, // e.g. { "POI_TAKEDOWN_REQUEST": { submissionsLeft, dailyNewSubmissions, maxSubmissions }, ... }
        code: null,
        captcha: false
    };

    // ----- Route stuff -----
    let routeChangeSeq = 0;
    let lastSetupRouteKey = null;
    let routeChangeTimer = null;
    let submitIdleListener = null;

    // ----- Radius for retrieving POIs -----
    let radius = 200;
    let poiMovementThreshold = radius * 0.25;

    // ----- Radius for submitting POIs -----
    let submitRadius = 10000;

    // ----- Map instance & core map state -----
    let wfMap = null;
    let currentMapMode = null;
    let poiInfoWindow = null;
    let CenterPinOverlay = null;
    let centerPinOverlay = null;
    let desktopSubmitMarker = null;
    let desktopSubmitMarkerIcon = null;

    // ----- POI & marker state -----
    let poisByGuid = new Map();   // guid -> normalized POI
    let gcsGuids = new Set();     // current GCS viewport set
    let liveGuids = new Set();    // current live radius set
    let livePoisByGuid = new Map(); // guid -> last live POI seen
    let gcsPoisByGuid  = new Map(); // guid -> last gcs POI seen
    let _publishScheduled = false; // Debounced publish (coalesce multiple updates in same tick)
    let markersByGuid = {};

    let lastFetchLat = null;
    let lastFetchLng = null;

    // ----- Deep link state -----
    let deepLinkTarget = null;
    let skipRestoreMapViewForThisLoad = false;
    let deepLinkSelectionPending = false;

    // ----- Observers & watchers -----
    let latLngObserver = null;
    let latLngBodyObserver = null;
    let latLngTargetEl = null;
    let sidebarObserver = null;
    let pinnedWarningObserver = null;
    let poiBridgeObserver = null;
    let lastBridgePayload = null;
    let zoomHintObserver = null;
    let zoomHintClickBound = false;

    // ----- Selected marker styling ---
    let lastSelectedPoi = null;
    let selectedPoiGuid = null;
    let selectedPoiCircle80m = null;

    // ----- UI element references -----
    let sidePanelEl = null;
    let mapRightClickMenuEl = null;
    let topRightControlsBarEl = null;
    let filterControlEl = null;
    let layersControlEl = null;
    let wayspotsLayerCheckboxEl = null;
    let draftSubmissionsLayerCheckboxEl = null;
    let wayspotOverlayState = null;

    // ------ Submission pin mapview button ------
    let submissionPinButton = null;
    let submissionPinClassObserver = null;
    let submissionPinMarker = null;
    let submissionPinMapClickListener = null;

    // ----- Filter options -----
    let filterSourceRadioAllEl = null;
    let filterSourceRadioCommunityEl = null;
    let filterSourceRadioOtherEl = null;

    let filterChkPokestopEl = null;
    let filterChkGymEl = null;
    let filterChkPowerspotEl = null;
    let filterChkNoneEl = null;

    // ----- User / submitter positional state -----
    let userLocationMarker = null;
    let submitterLocation = null;
    let geoWatchId = null;

    // ----- Behaviour flags -----
    let mapTypeListenerBound = false;
    let mapClickCloseBound = false;

    // ----- Sidepanel state -----
    let sidePanelCollapsed = false;

    // ----- LocalStorage key for this plugin -----
    const SETTINGS_KEY = "wfmap_settings";

    // Geolocation loading - bug fix
    let geoKickStartedForSubmit = false;
    let lastPathname = location.pathname;

    // ------- Sidebar menu management ------
    let wfMapActiveEnforcerTimer = null;

    // ------- Thumbnail management ---------
    const THUMB_IMAGE_CACHE_MAX = 800;

    let wfMapmodsIsUploading = false;

    // ==================================
    // User settings & configuration
    // ==================================

    let userSettings = {
        _meta: {
            schemaVersion: 2
        },

        poi: {
            appearance: {
                styleBy: {
                    source: true,
                    gameObject: true
                },

                defaults: {
                    thumbnail: {
                        size: 36,
                        borderColor: "#ffffff",
                        borderWidth: 3,
                        borderOpacity: 0.7
                    },
                    generic: {
                        borderColor: "#ff6600",
                        markerSize: 8,
                        borderWidth: 2,
                        borderOpacity: 1,
                        fillColor: "#ff6600",
                        fillOpacity: 0.5
                    }
                },

                styles: {
                    "community:wayspot": {
                        markerType: "generic",
                        thumbnail: { size: 36, borderColor: "#ffffff", borderWidth: 3, borderOpacity: 1 },
                        generic:   { markerSize: 8, borderColor: "#ff6600", borderWidth: 2, borderOpacity: 1, fillColor: "#ff6600", fillOpacity: 0.5 }
                    },
                    "import:wayspot": {
                        markerType: "generic",
                        thumbnail: { size: 20, borderColor: "#ffffff", borderWidth: 2, borderOpacity: 1 },
                        generic:   { markerSize: 5, borderColor: "#000000", borderWidth: 1, borderOpacity: 0.8, fillColor: "#ffffff", fillOpacity: 0.5 }
                    },

                    "community:pokestop": {
                        markerType: "generic",
                        thumbnail: { size: 36, borderColor: "#0f1fff", borderWidth: 3, borderOpacity: 1 },
                        generic:   { markerSize: 8, borderColor: "#0000cd", borderWidth: 2, borderOpacity: 1, fillColor: "#00bfff", fillOpacity: 1 }
                    },
                    "community:gym": {
                        markerType: "generic",
                        thumbnail: { size: 36, borderColor: "#ff0a0a", borderWidth: 3, borderOpacity: 1 },
                        generic:   { markerSize: 8, borderColor: "#ffffff", borderWidth: 2, borderOpacity: 1, fillColor: "#ff2450", fillOpacity: 1 }
                    },
                    "community:powerspot": {
                        markerType: "generic",
                        thumbnail: { size: 36, borderColor: "#ff94ea", borderWidth: 3, borderOpacity: 1 },
                        generic:   { markerSize: 8, borderColor: "#e762d3", borderWidth: 2, borderOpacity: 1, fillColor: "#f195eb", fillOpacity: 1 }
                    },

                    "import:pokestop": {
                        markerType: "generic",
                        thumbnail: { size: 20, borderColor: "#0f1fff", borderWidth: 2, borderOpacity: 1 },
                        generic:   { markerSize: 5, borderColor: "#0000cd", borderWidth: 1, borderOpacity: 1, fillColor: "#00bfff", fillOpacity: 1 }
                    },
                    "import:gym": {
                        markerType: "generic",
                        thumbnail: { size: 20, borderColor: "#ff0a0a", borderWidth: 2, borderOpacity: 1 },
                        generic:   { markerSize: 5, borderColor: "#ffffff", borderWidth: 1, borderOpacity: 1, fillColor: "#ff0000", fillOpacity: 1 }
                    },
                    "import:powerspot": {
                        markerType: "generic",
                        thumbnail: { size: 20, borderColor: "#ff94ea", borderWidth: 2, borderOpacity: 1 },
                        generic:   { markerSize: 5, borderColor: "#e762d3", borderWidth: 1, borderOpacity: 1, fillColor: "#f195eb", fillOpacity: 1 }
                    }
                }
            },

            filters: {
                source: {
                    community: true,
                    import: true
                },
                gameObject: {
                    pokestop: true,
                    gym: true,
                    powerspot: true,
                    none: true
                }
            }
        },

        map: {
            rememberLastView: true,
            nearbyRadius: { enabled: true, strokeColor: "#4285F4", strokeOpacity: 0.8, strokeWidth: 2, fillColor: "#4285F4", fillOpacity: 0 },
            submitRadius: { enabled: true, strokeColor: "#e13cff", strokeOpacity: 0.8, strokeWidth: 4, fillColor: "#e13cff", fillOpacity: 0 },
            interactRadius: { enabled: true, strokeColor: "#ffcc33", strokeOpacity: 0.9, strokeWidth: 2, fillColor: "#ffed24", fillOpacity: 0.05 },
            powerSpotRadius: { enabled: true, strokeColor: "#ff47c5", strokeOpacity: 1, strokeWidth: 1.5, fillColor: "#ffffff", fillOpacity: 0 }
        },

        layers: {
            wayspots: { enabled: true },
            drafts: { enabled: true }
        }
    };

    function loadSettings() {
        try {
            const saved = localStorage.getItem(SETTINGS_KEY);

            // First run: nothing saved yet
            if (!saved) {
                localStorage.setItem(SETTINGS_KEY, JSON.stringify(userSettings));
                return;
            }

            const parsed = JSON.parse(saved);
            const savedSchema = parsed?._meta?.schemaVersion;

            // Old or incompatible settings → wipe + re-seed
            if (savedSchema !== userSettings._meta.schemaVersion) {
                localStorage.setItem(SETTINGS_KEY, JSON.stringify(userSettings));
                return;
            }

            // Normal case
            mergeDeep(userSettings, parsed);
        } catch (e) {
            console.error(`${SETTINGS_KEY} - Failed to load settings:`, e);

            // Corrupt JSON → reset + re-seed
            try {
                localStorage.setItem(SETTINGS_KEY, JSON.stringify(userSettings));
            } catch {}
        }
    }

    function saveSettings() {
        try {
            localStorage.setItem(SETTINGS_KEY, JSON.stringify(userSettings));
        } catch (e) {
            console.error(`${SETTINGS_KEY} - Failed to save settings:`, e);
        }
    }

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

    // ==================================
    // General helpers
    // ==================================

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

    function escapeHtml(str) {
        if (!str) return "";
        return String(str)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    function hexToRgba(hex, opacity) {
        const h = hex.replace("#", "");
        const r = parseInt(h.substring(0, 2), 16);
        const g = parseInt(h.substring(2, 4), 16);
        const b = parseInt(h.substring(4, 6), 16);
        return `rgba(${r}, ${g}, ${b}, ${opacity})`;
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

    function isIOS() {
        return (
            /iPad|iPhone|iPod/.test(navigator.userAgent) ||
            (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
        );
    }

    // ==================================
    // API Checks
    // ==================================

    async function checkWhichApisAreLive() {
        // kick both off in parallel and wait for both
        await Promise.all([
            isPoiImagesApiLive(),
            isReportApiLive(),
        ]);
    }

    async function isPoiImagesApiLive() {
        try {
            const r = await fetch("/api/v1/vault/mapview/poi-images", {
                credentials: "include"
            });
            poiImagesApiLive = (r.status === 200);
        } catch {
            poiImagesApiLive = false;
        }
    }

    async function isReportApiLive() {
        try {
            const res = await fetch("/api/v1/vault/mapview/poi-report", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Accept": "application/json",
                    "x-angular": "true",
                    "x-csrf-token": decodeURIComponent(
                        document.cookie
                        .split("; ")
                        .find(c => c.startsWith("XSRF-TOKEN="))
                        ?.split("=")[1] || ""
                    )
                },
                // Intentionally invalid payload — should not consume a report token
                body: JSON.stringify({ comment: "" })
            });

            const contentType = res.headers.get("content-type") || "";
            if (!contentType.includes("application/json")) {
                reportApiLive = false;
                return;
            }

            // If JSON parses, the API exists
            await res.json();
            reportApiLive = true;

        } catch {
            reportApiLive = false;
        }
    }

    // ==================================
    // Navigation state & sidebar integration
    // ==================================

    function sidebarAlreadyHasNativeMapLink(sidebar) {
        const links = Array.from(sidebar.querySelectorAll('app-sidebar-link a.sidebar-link')).filter(Boolean);

        return links.some(a => {
            const href = a.getAttribute('href') || '';
            if (href === MAPVIEW_ROUTE) return true;

            const img = a.querySelector('img.sidebar-link__icon');
            const src = img?.getAttribute('src') || '';
            if (src === '/img/map-outlined-24px.svg') return true;

            return false;
        });
    }

    function setupSidebarTracking(sidebar) {
        if (window._wfmapmodsSidebarTrackingSetup) return;
        window._wfmapmodsSidebarTrackingSetup = true;

        sidebar.addEventListener('click', (e) => {
            const a = e.target.closest('a.sidebar-link');
            if (!a) return;

            // Identify Map link robustly (order-independent)
            const mapLink = sidebar.querySelector('a.sidebar-link.sidebar-wayfarermap');

            const clickedIsMap = mapLink && a === mapLink;

            // If it's the Map button, let its own click handler manage state/highlight
            if (clickedIsMap) {
                return;
            }

            // Any other sidebar link → we're not "from Map" anymore
            localStorage.setItem('wf_map_nav', '0');

            // Remove Map's active state if present
            if (mapLink) {
                mapLink.classList.remove('sidebar-link--active');
            }

            // Ensure ONLY the clicked link has sidebar-link--active
            sidebar
                .querySelectorAll('a.sidebar-link.sidebar-link--active')
                .forEach((el) => el.classList.remove('sidebar-link--active'));

            a.classList.add('sidebar-link--active');
        });
    }

    function addMapSidebarLink() {
        const sidebar = document.querySelector('app-sidebar');
        if (!sidebar) return;

        if (sidebarAlreadyHasNativeMapLink(sidebar)) {
            if (sidebarObserver) sidebarObserver.disconnect();
            return;
        }

        if (document.querySelector('app-sidebar-link a.sidebar-link.sidebar-wayfarermap')) {
            if (sidebarObserver) sidebarObserver.disconnect();
            return;
        }

        // Use the order of links to detect submit button
        //  - 0: first nav item (Showcase)
        //  - 1: second nav item (Submit)
        //  - 2: where we want to insert our Map entry
        const wrappers = sidebar.querySelectorAll('app-sidebar-link');
        if (wrappers.length < 2) {
            // Sidebar not fully built yet; wait for more nodes
            return;
        }

        const submitWrapper = wrappers[1]; // 2nd item in the list
        const submitAnchor = submitWrapper.querySelector('a.sidebar-link');
        if (!submitAnchor || !submitWrapper.parentNode) return;

        // Clone the whole app-sidebar-link node so it keeps styling/structure
        const mapWrapper = submitWrapper.cloneNode(true);
        const mapAnchor = mapWrapper.querySelector('a.sidebar-link');
        if (!mapAnchor) return;

        // Adjust attributes for the new Map entry
        mapAnchor.classList.remove('sidebar-link--active');
        mapAnchor.classList.add('sidebar-link--map');
        mapAnchor.classList.add('sidebar-wayfarermap');
        mapAnchor.title = 'Map';
        mapAnchor.setAttribute('data-wfmapmods-role', 'map');

        const span = mapAnchor.querySelector('span');
        if (span) {
            span.textContent = 'Map';
        }

        // Intercept click and mark that we came from the Map button
        mapAnchor.addEventListener('click', function(e) {
            e.preventDefault();

            const url = SUBMIT_ROUTE;

            // Mark that this navigation came from the Map button
            localStorage.setItem('wf_map_nav', '1');

            // Try SPA-style navigation first
            if (window.history && typeof window.history.pushState === 'function') {
                window.history.pushState({}, '', url);

                // Nudge Angular's router by emitting a popstate event
                try {
                    window.dispatchEvent(new PopStateEvent('popstate', {
                        state: {}
                    }));
                } catch (err) {
                    const evt = document.createEvent('PopStateEvent');
                    evt.initPopStateEvent('popstate', true, true, {});
                    window.dispatchEvent(evt);
                }
            } else {
                // Fallback: full reload
                window.location.href = url;
            }
        });

        // Remove old icon
        const oldIcon = mapAnchor.querySelector('img.sidebar-link__icon');
        if (oldIcon) oldIcon.remove();

        // Insert icon from server (no inline SVG)
        const mapIcon = document.createElement('img');
        mapIcon.className = 'sidebar-link__icon';
        mapIcon.src = '/img/map-outlined-24px.svg';
        mapIcon.alt = 'Map';

        mapAnchor.insertAdjacentElement('afterbegin', mapIcon);

        // Insert right after the second nav item (Submit),
        // which makes us the 3rd <app-sidebar-link>
        submitWrapper.parentNode.insertBefore(mapWrapper, submitWrapper);

        // Once added, we can stop observing
        if (sidebarObserver) sidebarObserver.disconnect();
    }

    function setupSidebarObserver() {
        if (sidebarObserver) return;

        // Observe DOM changes until the sidebar appears
        sidebarObserver = new MutationObserver(() => {
            const sidebar = document.querySelector('app-sidebar');
            if (sidebar) {
                addMapSidebarLink();
                setupSidebarTracking(sidebar);
            }
        });

        sidebarObserver.observe(document.body, {
            childList: true,
            subtree: true,
        });

        // Also try immediately in case the sidebar is already there
        addMapSidebarLink();
    }

    // ==================================
    // Format page for map view
    // ==================================

    let wfMapResizeListenerAttached = false;
    let wfMapModeInterval = null;

    function formatPageForMapMode() {
        if (localStorage.getItem('wf_map_nav') !== '1') return;
        if (location.pathname !== SUBMIT_ROUTE) return;

        startMapSidebarActiveEnforcement();

        if (wfMapModeInterval) clearInterval(wfMapModeInterval);

        wfMapModeInterval = setInterval(() => {
            if (localStorage.getItem('wf_map_nav') !== '1' || location.pathname !== SUBMIT_ROUTE) {
                clearInterval(wfMapModeInterval);
                wfMapModeInterval = null;
                return;
            }

            const root = document.querySelector('app-submit-wayspot.ng-star-inserted');
            if (!root) return;

            const mapComp = root.querySelector('app-submit-wayspot-map');
            if (!mapComp) return;

            const container = root.querySelector(':scope > div');
            if (!container) return;

            // stop polling once we can apply
            clearInterval(wfMapModeInterval);
            wfMapModeInterval = null;

            // Find the direct child that contains the map component once
            const mapSection = Array.from(container.children).find(child => child.contains(mapComp));
            if (!mapSection) return;

            // Mark the container + body as map mode (CSS handles padding/scrolling/width)
            container.classList.add('wfmapmods-mapmode');
            setMapModeEnabled(true);

            mapSection.classList.add('wfmapmods-mapsection');

            const mapKeep = Array.from(mapSection.children).find(ch => ch.contains(mapComp));
            if (mapKeep) mapKeep.classList.add('wfmapmods-mapkeep');

            // Optional: compute top offset once so height = 100vh - offset
            // (prevents map going under any fixed header)
            resizeWfMapToViewport();

            if (!wfMapResizeListenerAttached) {
                window.addEventListener('resize', resizeWfMapToViewport);
                wfMapResizeListenerAttached = true;
            }
        }, 150);
    }

    function setSidebarActiveForMapMode() {
        const sidebar = document.querySelector('app-sidebar');
        if (!sidebar) return;

        const wrappers = sidebar.querySelectorAll('app-sidebar-link');
        if (wrappers.length < 3) return;

        const submitLink = wrappers[1].querySelector('a.sidebar-link');
        const mapLink = wrappers[2].querySelector('a.sidebar-link');

        if (!submitLink || !mapLink) return;

        submitLink.classList.remove('sidebar-link--active');
        mapLink.classList.add('sidebar-link--active');
    }

    function clearSidebarActiveForMapMode() {
        const sidebar = document.querySelector('app-sidebar');
        if (!sidebar) return;

        const wrappers = sidebar.querySelectorAll('app-sidebar-link');
        if (wrappers.length < 3) return;

        const mapLink = wrappers[2].querySelector('a.sidebar-link');
        if (mapLink) mapLink.classList.remove('sidebar-link--active');
    }

    function enforceMapAsOnlyActiveSidebarLink() {
        const sidebar = document.querySelector('app-sidebar');
        if (!sidebar) return;

        // Find Map link
        const mapLink = sidebar.querySelector('a.sidebar-link.sidebar-wayfarermap');

        if (!mapLink) return;

        // Remove active from ALL sidebar links first (this clears Submit)
        sidebar
            .querySelectorAll('a.sidebar-link.sidebar-link--active')
            .forEach((el) => el.classList.remove('sidebar-link--active'));

        // Then force Map active
        mapLink.classList.add('sidebar-link--active');
    }

    function startMapSidebarActiveEnforcement(durationMs = 1200) {
        const start = performance.now();

        // Initial assert
        enforceMapAsOnlyActiveSidebarLink();

        if (wfMapActiveEnforcerTimer) {
            clearInterval(wfMapActiveEnforcerTimer);
        }

        wfMapActiveEnforcerTimer = setInterval(() => {
            // Stop if we left map mode or route
            if (
                localStorage.getItem('wf_map_nav') !== '1' ||
                location.pathname !== SUBMIT_ROUTE
            ) {
                clearInterval(wfMapActiveEnforcerTimer);
                wfMapActiveEnforcerTimer = null;
                return;
            }

            enforceMapAsOnlyActiveSidebarLink();

            // Stop after bounded window
            if (performance.now() - start > durationMs) {
                clearInterval(wfMapActiveEnforcerTimer);
                wfMapActiveEnforcerTimer = null;
            }
        }, 100);
    }

    function setMapModeEnabled(enabled) {
        document.body.classList.toggle('wfmapmods-mapmode-body', !!enabled);

        if (!enabled) {
            document.documentElement.style.removeProperty('--wfmapmods-map-top-offset');
        }
    }

    function removeSidenavPaddingForMapPage() {
        return;
        const sidenavContent = document.querySelector('mat-sidenav-content');
        if (sidenavContent) {
            sidenavContent.classList.remove('p-4');
        }
    }

    function restoreSidenavPadding() {
        return;
        const sidenavContent = document.querySelector('mat-sidenav-content');
        if (sidenavContent && !sidenavContent.classList.contains('p-4')) {
            sidenavContent.classList.add('p-4');
        }
    }

    function restoreScrolling() {
        return;
        let node = document.querySelector('mat-sidenav-content');
        while (node && node !== document.body) {
            if (node instanceof HTMLElement) {
                if (node.style.overflowY === 'hidden') {
                    node.style.overflowY = ''; // remove inline override
                }
            }
            node = node.parentElement;
        }
    }

    function restoreWidthLimiter() {
        return;
        const limiter = document.querySelector('[data-wf-removed-max-width="1"]');
        if (limiter) {
            limiter.classList.add('max-w-7xl');
            delete limiter.dataset.wfRemovedMaxWidth;
        }
    }

    function applySidenavPaddingForCurrentRoute() {
        const fromMap = localStorage.getItem('wf_map_nav') === '1';
        const onMapPage = location.pathname === SUBMIT_ROUTE;

        const enable = fromMap && onMapPage;

        // Toggle body mode (CSS does the rest)
        setMapModeEnabled(enable);

        if (!enable) {
            // Leaving map mode: clear your nav flag and sidebar enforcement
            if (fromMap && !onMapPage) {
                localStorage.setItem('wf_map_nav', '0');

                if (wfMapActiveEnforcerTimer) {
                    clearInterval(wfMapActiveEnforcerTimer);
                    wfMapActiveEnforcerTimer = null;
                }
                clearSidebarActiveForMapMode();
            }

            // Remove container markers (so your CSS no longer hides content)
            const root = document.querySelector('app-submit-wayspot.ng-star-inserted');
            const container = root && root.querySelector(':scope > div');
            if (container) {
                container.classList.remove('wfmapmods-mapmode');
                const mapSection = container.querySelector('.wfmapmods-mapsection');
                if (mapSection) mapSection.classList.remove('wfmapmods-mapsection');
                const mapKeep = container.querySelector('.wfmapmods-mapkeep');
                if (mapKeep) mapKeep.classList.remove('wfmapmods-mapkeep');
            }

            if (wfMapResizeListenerAttached) {
                window.removeEventListener('resize', resizeWfMapToViewport);
                wfMapResizeListenerAttached = false;
            }
        }
    }

    async function resizeWfMapToViewport() {
        let mapContainer;

        try {
            mapContainer = await awaitElement(() =>
                                              document.querySelector('.submit-wayspot-map-container')
                                             );
        } catch (err) {
            console.warn("Wayfarer Map: Map container not found:", err);
            return;
        }

        const rect = mapContainer.getBoundingClientRect();
        const offsetTop = Math.max(0, Math.round(rect.top));

        // Let CSS do: height: calc(100vh - var(--wfmapmods-map-top-offset))
        document.documentElement.style.setProperty('--wfmapmods-map-top-offset', offsetTop + 'px');
    }

    function initSidenavPaddingRouteWatcher() {
        if (window._wfmapmodsSidenavPaddingWatcherInitialised) return;
        window._wfmapmodsSidenavPaddingWatcherInitialised = true;

        // React to back/forward and any manual popstate dispatches
        window.addEventListener('popstate', () => {
            applySidenavPaddingForCurrentRoute();
            handleRouteChangeForGeoKick();
        });

        // Wrap history.pushState so any SPA navigation is noticed too
        const origPushState = history.pushState;
        history.pushState = function (...args) {
            const ret = origPushState.apply(this, args);
            setTimeout(() => {
                applySidenavPaddingForCurrentRoute();
                handleRouteChangeForGeoKick();
            }, 0);
            return ret;
        };

        // Initial pass for the current route
        applySidenavPaddingForCurrentRoute();
        handleRouteChangeForGeoKick();
    }

    // ==================================
    // Geolocation bug fix
    // ==================================

    // This code does a call for navigator.geolocation.getCurrentPosition when the map page is loading.
    // Doing this fixes an issue on some browsers where the site will say location is not found.
    async function kickstartGeolocationIfOnSubmitPage() {
        // if (geoKickStartedForSubmit) return;
        if (location.pathname !== SUBMIT_ROUTE) return;

        try {
            // Wait until the submit component actually exists
            await awaitElement(() =>
                               document.querySelector("app-submit-wayspot")
                              );
        } catch {
            // If it never appears, just bail silently
            return;
        }

        geoKickStartedForSubmit = true;

        try {
            navigator.geolocation.getCurrentPosition(
                () => {},
                () => {},
                { enableHighAccuracy: true }
            );
        } catch (e) {
            // Never throw – this must not break Wayfarer
            console.debug("WF Map Mods: geolocation kickstart failed", e);
        }
    }

    function handleRouteChangeForGeoKick() {
        const now = location.pathname;

        // If we LEFT the submit page, allow the kick to run again next time we return.
        if (lastPathname === SUBMIT_ROUTE && now !== SUBMIT_ROUTE) {
            geoKickStartedForSubmit = false;
        }

        lastPathname = now;

        // If we are ON the submit page, attempt the kick (guarded).
        kickstartGeolocationIfOnSubmitPage();
    }

    // ==================================
    // Create layers and filters buttons
    // ==================================

    function createIconMenuControl({
        id,
        svg,
        ariaLabel,
        buildMenu,
        rootClassName,
        buttonClassName,
        iconClassName,
        menuClassName,
        openClassName
    }) {
        const root = document.createElement("div");
        root.className = rootClassName || "wfmapmods-iconmenu";
        root.dataset.iconmenuId = id;

        const button = document.createElement("button");
        button.type = "button";
        button.className = buttonClassName || "wfmapmods-iconmenu-toggle";
        button.setAttribute("aria-label", ariaLabel);

        const iconSpan = document.createElement("span");
        iconSpan.className = iconClassName || "wfmapmods-iconmenu-icon";
        iconSpan.setAttribute("aria-hidden", "true");
        iconSpan.innerHTML = svg;
        button.appendChild(iconSpan);

        const menu = document.createElement("div");
        menu.className = menuClassName || "wfmapmods-iconmenu-menu";
        if (typeof buildMenu === "function") buildMenu(menu);

        root.appendChild(button);
        root.appendChild(menu);

        let open = false;
        const baseOpenCls = "wfmapmods-iconmenu-open";
        const extraOpenCls = openClassName && openClassName !== baseOpenCls ? openClassName : null;

        const setOpen = (v) => {
            open = !!v;
            root.classList.toggle(baseOpenCls, open);
            if (extraOpenCls) root.classList.toggle(extraOpenCls, open);
            button.setAttribute("aria-expanded", String(open));
        };

        const canHover = window.matchMedia?.("(hover: hover)")?.matches;

        if (canHover) {
            root.addEventListener("mouseenter", () => setOpen(true));
            root.addEventListener("mouseleave", () => setOpen(false));
        }

        button.addEventListener("click", (e) => {
            e.stopPropagation();
            setOpen(!open);
        });

        // Close when clicking outside
        document.addEventListener("pointerdown", (e) => {
            if (!root.contains(e.target)) setOpen(false);
        }, { capture: true });

        return { root, button, menu, setOpen };
    }

    function ensureTopRightControlsBar(mapDiv) {
        let bar = mapDiv.querySelector("#wfmapmods-topright-controls");
        if (bar) return bar;

        bar = document.createElement("div");
        bar.id = "wfmapmods-topright-controls";
        mapDiv.appendChild(bar);
        return bar;
    }

    function ensureMapTopRightControls() {
        if (!wfMap || typeof google === "undefined" || !google.maps) return;

        const mapDiv = wfMap.getDiv();
        if (!mapDiv) return;

        // Create / get shared bar
        topRightControlsBarEl = ensureTopRightControlsBar(mapDiv);

        // Filter control (left)
        if (!filterControlEl || !document.body.contains(filterControlEl)) {
            const filterControl = createIconMenuControl({
                id: "filter",
                svg: FILTER_BUTTON_SVG,
                ariaLabel: "Filters",
                rootClassName: "wfmapmods-filters-root wfmapmods-iconmenu",
                buttonClassName: "wfmapmods-filters-toggle wfmapmods-iconmenu-toggle",
                iconClassName: "wfmapmods-filters-icon wfmapmods-iconmenu-icon",
                menuClassName: "wfmapmods-filters-menu wfmapmods-iconmenu-menu",
                openClassName: "wfmapmods-filters-open",
                buildMenu: (menu) => buildFiltersMenu(menu)
            });

            filterControlEl = filterControl.root;
            topRightControlsBarEl.appendChild(filterControlEl);
        } else {
            syncFiltersMenuUI();
        }

        // Layers control (right)
        if (!layersControlEl || !document.body.contains(layersControlEl)) {
            const layersControl = createIconMenuControl({
                id: "layers",
                svg: LAYERS_BUTTON_SVG,
                ariaLabel: "Map layers",
                rootClassName: "wfmapmods-layers-root wfmapmods-iconmenu",
                buttonClassName: "wfmapmods-layers-toggle wfmapmods-iconmenu-toggle",
                iconClassName: "wfmapmods-layers-icon wfmapmods-iconmenu-icon",
                menuClassName: "wfmapmods-layers-menu wfmapmods-iconmenu-menu",
                openClassName: "wfmapmods-layers-open",
                buildMenu: (menu) => {buildLayersMenu(menu);}
            });

            layersControlEl = layersControl.root;
            topRightControlsBarEl.appendChild(layersControlEl);
        } else {
            syncLayersMenuUI();
        }

        // Apply any sidebar-dependent positioning you already have
        updateLayersControlPosition();
    }

    // ==================================
    // Layers button functionality
    // ==================================

    function buildLayersMenu(menu) {
        menu.innerHTML = "";

        // Wayspots checkbox row
        const wayspotLabel = document.createElement("label");
        wayspotLabel.className = "wfmapmods-layers-option";

        const wayspotsChk = document.createElement("input");
        wayspotsChk.type = "checkbox";
        wayspotsChk.className = "wfmapmods-layers-checkbox";
        wayspotsChk.checked = isWayspotsLayerEnabled();

        const wayspotsText = document.createElement("span");
        wayspotsText.className = "wfmapmods-layers-label";
        wayspotsText.textContent = "Wayspots";

        wayspotLabel.appendChild(wayspotsChk);
        wayspotLabel.appendChild(wayspotsText);
        menu.appendChild(wayspotLabel);

        // Draft submissions checkbox row
        const draftsLabel = document.createElement("label");
        draftsLabel.className = "wfmapmods-layers-option";

        const draftsChk = document.createElement("input");
        draftsChk.type = "checkbox";
        draftsChk.className = "wfmapmods-layers-checkbox";
        draftsChk.checked = isDraftLayerEnabled();

        const draftsText = document.createElement("span");
        draftsText.className = "wfmapmods-layers-label";
        draftsText.textContent = "Draft submissions";

        draftsLabel.appendChild(draftsChk);
        draftsLabel.appendChild(draftsText);
        menu.appendChild(draftsLabel);

        // Save refs for syncing later
        wayspotsLayerCheckboxEl = wayspotsChk;
        draftSubmissionsLayerCheckboxEl = draftsChk;

        // Checkbox change handler (Wayspots)
        wayspotsChk.addEventListener("change", () => {
            userSettings.layers.wayspots.enabled = !!wayspotsChk.checked;
            applyPoiVisibilityToAllMarkers();
            saveSettings();
        });

        // Checkbox change handler (Drafts)
        draftsChk.addEventListener("change", () => {
            userSettings.layers.drafts.enabled = !!draftsChk.checked;
            applyDraftVisibilityToAllMarkers();
            saveSettings();
        });
    }

    function syncLayersMenuUI() {
        if (wayspotsLayerCheckboxEl) wayspotsLayerCheckboxEl.checked = isWayspotsLayerEnabled();
        if (draftSubmissionsLayerCheckboxEl) draftSubmissionsLayerCheckboxEl.checked = isDraftLayerEnabled();
    }

    function isDraftLayerEnabled() {
        const layers = (userSettings && userSettings.layers) || {};
        const draftsLayer = layers.drafts || {};
        // Default to ON if not explicitly disabled
        return draftsLayer.enabled !== false;
    }

    function applyDraftVisibilityToAllMarkers() {
        const enabled = isDraftLayerEnabled();
        if (!Array.isArray(draftMarkers)) return;

        draftMarkers.forEach(m => {
            if (m && typeof m.setVisible === "function") {
                m.setVisible(enabled);
            }
        });
    }

    function isWayspotsLayerEnabled() {
        const layers = userSettings.layers;
        return layers.wayspots.enabled;
    }

    function applyWayspotVisibilityToMarkerEntry(entry) {
        if (!entry || !entry.marker) return;
        const enabled = isWayspotsLayerEnabled();
        entry.marker.setMap(enabled ? wfMap : null);
    }

    function applyWayspotVisibilityToAllMarkers() {
        if (!wfMap) return;
        for (const guid in markersByGuid) {
            applyWayspotVisibilityToMarkerEntry(markersByGuid[guid]);
        }
    }

    // ==================================
    // Filter button functionality
    // ==================================

    function getSelectedSourceModeFromSettings() {
        const src = userSettings.poi.filters.source;
        const community = !!src.community;
        const imp = !!src.import;

        if (community && imp) return "all";
        if (community && !imp) return "community";
        if (!community && imp) return "other";

        // If someone saved an invalid combo (both false), treat as "all"
        return "all";
    }

    function applySourceModeToSettings(mode) {
        const src = userSettings.poi.filters.source;
        if (mode === "community") {
            src.community = true;
            src.import = false;
        } else if (mode === "other") {
            src.community = false;
            src.import = true;
        } else {
            // "all"
            src.community = true;
            src.import = true;
        }
    }

    function areAllGameEntitiesDisabled() {
        const go = userSettings.poi.filters.gameObject;
        return !go.pokestop && !go.gym && !go.powerspot && !go.none;
    }

    function enforceWayspotsLayerBasedOnEntities() {
        // Rule:
        // - If all entities disabled => wayspots layer disabled
        // - If any entity enabled and wayspots layer was disabled => enable wayspots layer
        const anyEnabled = !areAllGameEntitiesDisabled();

        if (!anyEnabled) {
            userSettings.layers.wayspots.enabled = false;
        } else if (userSettings.layers.wayspots.enabled === false) {
            userSettings.layers.wayspots.enabled = true;
        }
    }

    function onFiltersChanged() {
        userSettings.poi.filters.enabled = true;

        const beforeWayspotsLayer = userSettings.layers.wayspots.enabled;
        enforceWayspotsLayerBasedOnEntities();

        saveSettings();

        // If filters auto-toggled the wayspots layer, reflect it in the layers UI immediately
        if (userSettings.layers.wayspots.enabled !== beforeWayspotsLayer) {
            syncLayersMenuUI();
        }

        // Apply filters to existing markers immediately
        applyPoiVisibilityToAllMarkers(true);
    }

    function buildFiltersMenu(menu) {
        menu.innerHTML = "";

        // Container for nicer spacing
        const wrap = document.createElement("div");
        wrap.className = "wfmapmods-filters-wrap";

        // ---------- Section: Source radio ----------
        const sourceSection = document.createElement("div");
        sourceSection.className = "wfmapmods-filters-section";

        const sourceTitle = document.createElement("div");
        sourceTitle.className = "wfmapmods-filters-section-title";
        sourceTitle.textContent = "Filter by source…";

        const sourceOptions = document.createElement("div");
        sourceOptions.className = "wfmapmods-filters-options";

        const radioName = "wfmapmods-filter-source"; // shared name ensures radio behaviour

        function makeRadioRow(labelText, value) {
            const label = document.createElement("label");
            label.className = "wfmapmods-filters-option";

            const input = document.createElement("input");
            input.type = "radio";
            input.name = radioName;
            input.value = value;

            // set checked from settings
            input.checked = (getSelectedSourceModeFromSettings() === value);

            input.addEventListener("change", () => {
                if (!input.checked) return;
                applySourceModeToSettings(value);
                onFiltersChanged();
            });

            const span = document.createElement("span");
            span.textContent = labelText;
            span.className = "wfmapmods-filters-label";

            label.appendChild(input);
            label.appendChild(span);
            sourceOptions.appendChild(label);

            return input;
        }

        filterSourceRadioAllEl = makeRadioRow("All sources", "all");
        filterSourceRadioCommunityEl = makeRadioRow("Community", "community");
        filterSourceRadioOtherEl = makeRadioRow("Imports", "other");

        sourceSection.appendChild(sourceTitle);
        sourceSection.appendChild(sourceOptions);

        // ---------- Section: Game entity checkboxes ----------
        const entitySection = document.createElement("div");
        entitySection.className = "wfmapmods-filters-section";

        const entityTitle = document.createElement("div");
        entityTitle.className = "wfmapmods-filters-section-title";
        entityTitle.textContent = "Filter by Pokémon Go…";

        const entityOptions = document.createElement("div");
        entityOptions.className = "wfmapmods-filters-options";

        function makeCheckboxRow(labelText, key) {
            const label = document.createElement("label");
            label.className = "wfmapmods-filters-option";

            const input = document.createElement("input");
            input.type = "checkbox";
            input.className = "wfmapmods-filters-checkbox";
            input.checked = !!userSettings.poi.filters.gameObject[key];

            input.addEventListener("change", () => {
                userSettings.poi.filters.gameObject[key] = !!input.checked;
                onFiltersChanged();
            });

            const span = document.createElement("span");
            span.textContent = labelText;
            span.className = "wfmapmods-filters-label";

            label.appendChild(input);
            label.appendChild(span);
            entityOptions.appendChild(label);

            return input;
        }

        filterChkPokestopEl = makeCheckboxRow("PokéStop", "pokestop");
        filterChkGymEl = makeCheckboxRow("Gym", "gym");
        filterChkPowerspotEl = makeCheckboxRow("Power Spot", "powerspot");
        filterChkNoneEl = makeCheckboxRow("Not in game", "none");

        entitySection.appendChild(entityTitle);
        entitySection.appendChild(entityOptions);

        // Put sections together
        wrap.appendChild(sourceSection);
        wrap.appendChild(entitySection);
        menu.appendChild(wrap);

        // Ensure UI reflects current settings (and enforces wayspots layer rule on initial build too)
        enforceWayspotsLayerBasedOnEntities();
    }

    function syncFiltersMenuUI() {
        // Radios
        const mode = getSelectedSourceModeFromSettings();
        if (filterSourceRadioAllEl) filterSourceRadioAllEl.checked = (mode === "all");
        if (filterSourceRadioCommunityEl) filterSourceRadioCommunityEl.checked = (mode === "community");
        if (filterSourceRadioOtherEl) filterSourceRadioOtherEl.checked = (mode === "other");

        // Checkboxes
        const go = userSettings.poi.filters.gameObject;
        if (filterChkPokestopEl) filterChkPokestopEl.checked = !!go.pokestop;
        if (filterChkGymEl) filterChkGymEl.checked = !!go.gym;
        if (filterChkPowerspotEl) filterChkPowerspotEl.checked = !!go.powerspot;
        if (filterChkNoneEl) filterChkNoneEl.checked = !!go.none;

        // Enforce coupling rule + persist if it changes
        const before = userSettings.layers.wayspots.enabled;
        enforceWayspotsLayerBasedOnEntities();
        if (userSettings.layers.wayspots.enabled !== before) {
            saveSettings();
        }
    }

    // ==================================
    // Side panel UI (search, details, commands, settings)
    // ==================================

    function ensureSidePanel() {
        if (!wfMap || typeof google === "undefined" || !google.maps) return;

        const mapDiv = wfMap.getDiv();
        if (!mapDiv) return;

        // Ensure map container can host absolutely positioned children
        const currentPos = window.getComputedStyle(mapDiv).position;
        if (currentPos === "static" || !currentPos) {
            mapDiv.style.position = "relative";
        }

        if (!sidePanelEl) {
            const panel = document.createElement("div");
            panel.id = "wfmapmods-side-panel";
            panel.className = "wfmapmods-sidepanel-root";

            // --- Collapsible toggle tab on left edge ---
            const toggleTab = document.createElement("button");
            toggleTab.id = "wfmapmods-sidepanel-toggle";
            toggleTab.type = "button";
            toggleTab.textContent = "▶";

            toggleTab.addEventListener("click", () => {
                sidePanelCollapsed = !sidePanelCollapsed;
                applySidePanelCollapseState();
            });

            panel.appendChild(toggleTab);

            // ===== Scrollable content =====
            const content = document.createElement("div");
            content.className = "wfmapmods-sidepanel-content";

            // ==============================
            // SECTION 1: Search bar
            // ==============================
            const searchSection = document.createElement("section");
            searchSection.className = "wfmapmods-section wfmapmods-section-search";

            const searchBox = document.createElement("div");
            searchBox.id = "wfmapmods-searchbox";

            /** SEARCH ICON **/
            const searchIconWrapper = document.createElement("div");
            searchIconWrapper.className = "wfmapmods-searchicon";

            const searchIconImg = document.createElement("img");
            searchIconImg.className = "wfmapmods-iconimg";
            searchIconImg.alt = "Search";
            searchIconImg.src =
                "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIGhlaWdodD0iMjRweCIgdmlld0JveD0iMCAtOTYwIDk2MCA5NjAiIHdpZHRoPSIyNHB4IiBmaWxsPSIjMTcxNzE3Ij48cGF0aCBkPSJNNzg0LTEyMCA1MzItMzcycS0zMCAyNC02OSAzOHQtODMgMTRxLTEwOSAwLTE4NC41LTc1LjVUMTIwLTU4MHEwLTEwOSA3NS41LTE4NC41VDM4MC04NDBxMTA5IDAgMTg0LjUgNzUuNVQ2NDAtNTgwcTAgNDQtMTQgODN0LTM4IDY5bDI1MiAyNTItNTYgNTZaTTM4MC00MDBxNzUgMCAxMjcuNS01Mi41VDU2MC01ODBxMC03NS01Mi41LTEyNy41VDM4MC03NjBxLTc1IDAtMTI3LjUgNTIuNVQyMDAtNTgwcTAgNzUgNTIuNSAxMjcuNVQzODAtNDAwWiIvPjwvc3ZnPg==";
            searchIconWrapper.appendChild(searchIconImg);

            /** INPUT **/
            const searchInput = document.createElement("input");
            searchInput.id = "wfmapmods-search-input";
            searchInput.type = "search";
            searchInput.placeholder = "Search location…";

            // Behaviour wiring
            searchInput.addEventListener("keydown", (ev) => {
                if (ev.key === "Enter") {
                    ev.preventDefault();
                    if (typeof handleSearchSubmit === "function") {
                        handleSearchSubmit(searchInput.value);
                    }
                } else if (ev.key === "Escape") {
                    searchInput.value = "";
                    searchInput.blur();
                }
            });

            searchIconWrapper.addEventListener("click", () => {
                if (typeof handleSearchSubmit === "function") {
                    handleSearchSubmit(searchInput.value);
                }
            });

            /** GEOLOCATION BUTTON **/
            const geoButton = document.createElement("button");
            geoButton.title = "Current location";
            geoButton.id = "wfmapmods-geo-btn";
            geoButton.type = "button";

            const geoIconImg = document.createElement("img");
            geoIconImg.className = "wfmapmods-iconimg";
            geoIconImg.alt = "Current location";
            geoIconImg.src =
                "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIGhlaWdodD0iMjRweCIgdmlld0JveD0iMCAtOTYwIDk2MCA5NjAiIHdpZHRoPSIyNHB4IiBmaWxsPSIjMTcxNzE3Ij48cGF0aCBkPSJNNDQwLTQydi04MHEtMTI1LTE0LTIxNC41LTEwMy41VDEyMi00NDBINDJ2LTgwaDgwcTE0LTEyNSAxMDMuNS0yMTQuNVQ0NDAtODM4di04MGg4MHY4MHExMjUgMTQgMjE0LjUgMTAzLjVUODM4LTUyMGg4MHY4MGgtODBxLTE0IDEyNS0xMDMuNSAyMTQuNVQ1MjAtMTIydjgwaC04MFptNDAtMTU4cTExNiAwIDE5OC04MnQ4Mi0xOThxMC0xMTYtODItMTk4dC0xOTgtODJxLTExNiAwLTE5OCA4MnQtODIgMTk4cTAgMTE2IDgyIDE5OHQxOTggODJabTAtMTIwcS02NiAwLTExMy00N3QtNDctMTEzcTAtNjYgNDctMTEzdDExMy00N3E2NiAwIDExMyA0N3Q0NyAxMTNxMCA2Ni00NyAxMTN0LTExMyA0N1ptMC04MHEzMyAwIDU2LjUtMjMuNVQ1NjAtNDgwcTAtMzMtMjMuNS01Ni41VDQ4MC01NjBxLTMzIDAtNTYuNSAyMy41VDQwMC00ODBxMCAzMyAyMy41IDU2LjVUNDgwLTQwMFptMC04MFoiLz48L3N2Zz4=";
            geoButton.appendChild(geoIconImg);

            geoButton.addEventListener("click", () => {
                focusMapOnSubmitterLocation(wfMap);
            });

            // Places autocomplete
            if (typeof setupSearchAutocomplete === "function") {
                setupSearchAutocomplete(searchInput);
            }

            // Assemble search box
            searchBox.appendChild(searchIconWrapper);
            searchBox.appendChild(searchInput);
            searchBox.appendChild(geoButton);
            searchSection.appendChild(searchBox);

            // ==============================
            // SECTION 2: Wayspot Details
            // ==============================
            const detailsSection = document.createElement("section");
            detailsSection.className = "wfmapmods-section wfmapmods-section-details wfmapmods-is-hidden";

            const detailsBody = document.createElement("div");
            detailsBody.className = "wfmapmods-section-body wfmapmods-section-details-body";

            const titleValue = document.createElement("div");
            titleValue.className = "wfmapmods-detail-value wfmapmods-detail-title";
            titleValue.textContent = "";

            const imageBox = document.createElement("div");
            imageBox.className = "wfmapmods-detail-image-box";

            const imagePlaceholder = document.createElement("div");
            imagePlaceholder.className = "wfmapmods-detail-image-placeholder";
            imagePlaceholder.textContent = "No image selected";
            imageBox.appendChild(imagePlaceholder);

            const coordsValue = document.createElement("div");
            coordsValue.className = "wfmapmods-detail-value wfmapmods-detail-coords";
            coordsValue.textContent = "";

            const statusValue = document.createElement("div");
            statusValue.className = "wfmapmods-detail-status";

            const statusRow = document.createElement("div");
            statusRow.className = "wfmapmods-detail-status-row";

            const poiSourceContainer = document.createElement("div");
            poiSourceContainer.className = "wfmapmods-detail-poi-source";

            const pgoEntityContainer = document.createElement("div");
            pgoEntityContainer.className = "wfmapmods-detail-pgo-entity-logo";

            const statusTagContainer = document.createElement("div");
            statusTagContainer.className = "wfmapmods-detail-status-tag-container";

            const communityLogoContainer = document.createElement("div");
            communityLogoContainer.className = "wfmapmods-detail-community-logo";

            statusRow.appendChild(poiSourceContainer);
            statusRow.appendChild(pgoEntityContainer);
            statusRow.appendChild(statusTagContainer);
            statusRow.appendChild(communityLogoContainer);
            statusValue.appendChild(statusRow);

            detailsBody.appendChild(titleValue);
            detailsBody.appendChild(imageBox);
            detailsBody.appendChild(coordsValue);
            detailsBody.appendChild(statusValue);
            detailsSection.appendChild(detailsBody);

            // Divider(s)
            const divider1 = document.createElement("div");
            divider1.className = "wfmapmods-section-divider wfmapmods-section-divider-details wfmapmods-divider-1";

            const divider2 = document.createElement("div");
            divider2.className = "wfmapmods-section-divider wfmapmods-divider-2";

            const divider3 = document.createElement("div");
            divider3.className = "wfmapmods-section-divider wfmapmods-divider-3";

            // ==============================
            // SECTION 3: Wayspot Function Links
            // ==============================
            const parser = new DOMParser();

            const poiFunctionsSection = document.createElement("section");
            poiFunctionsSection.className = "wfmapmods-section wfmapmods-section-poi-functions wfmapmods-is-hidden";

            const poiFunctionsRow = document.createElement("div");
            poiFunctionsRow.className = "wfmapmods-iconlinks-row";

            const wayspotSvg = parser.parseFromString(WAYFARER_LOGO_SVG, "image/svg+xml").documentElement;
            wayspotSvg.setAttribute("width", "16");
            wayspotSvg.setAttribute("height", "24");
            wayspotSvg.setAttribute("aria-hidden", "true");
            const wayspotPath = wayspotSvg.querySelector("path");
            if (wayspotPath) wayspotPath.setAttribute("fill", "#fb4c21");

            const poiFunctionLinks = document.createElement("div");
            poiFunctionLinks.className = "wfmapmods-link-block wfmapmods-link-block--spaced wfmapmods-poi-function-links";

            // --- Wayspot deep link ---
            const deepLinkA = document.createElement("a");
            deepLinkA.href = "#";
            deepLinkA.classList.add("wfmapmods-is-hidden", "wfmapmods-poi-deeplink");
            deepLinkA.textContent = "Wayspot link";

            deepLinkA.addEventListener("click", (ev) => {
                ev.preventDefault();
                const url = deepLinkA.dataset.link;
                if (!url) return;

                navigator.clipboard?.writeText(url).catch(() => {});
                const original = deepLinkA.textContent;
                deepLinkA.textContent = "Copied!";
                setTimeout(() => (deepLinkA.textContent = original), 1200);
            });

            // --- Report link ---
            const reportA = document.createElement("a");
            reportA.href = "#";
            reportA.classList.add("wfmapmods-is-hidden", "wfmapmods-poi-reportlink");
            reportA.textContent = "Report";

            reportA.addEventListener("click", (ev) => {
                ev.preventDefault();
                if (!lastSelectedPoi) return;
                openPoiReportModal(lastSelectedPoi);
            });

            poiFunctionLinks.appendChild(deepLinkA);
            poiFunctionLinks.appendChild(reportA);
            poiFunctionsRow.appendChild(wayspotSvg);
            poiFunctionsRow.appendChild(poiFunctionLinks);
            poiFunctionsSection.appendChild(poiFunctionsRow);

            // ==============================
            // SECTION 4: Location Functions (submission marker)
            // ==============================
            const locationFunctionsSection = document.createElement("section");
            locationFunctionsSection.className = "wfmapmods-section wfmapmods-section-location-functions";

            const locationRow = document.createElement("div");
            locationRow.className = "wfmapmods-iconlinks-row";

            const pinIconSvg = parser.parseFromString(SUBMISSION_PIN, "image/svg+xml").documentElement;
            pinIconSvg.setAttribute("width", "14");
            pinIconSvg.setAttribute("height", "21");
            pinIconSvg.setAttribute("aria-hidden", "true");

            const locationLinksRow = document.createElement("div");
            locationLinksRow.className = "wfmapmods-link-block wfmapmods-link-block--spaced wfmapmods-location-links";

            const linkSubmitWayspot = document.createElement("a");
            linkSubmitWayspot.href = "#";
            linkSubmitWayspot.textContent = "Submit";

            const linkCopyCoords = document.createElement("a");
            linkCopyCoords.href = "#";
            linkCopyCoords.textContent = "Copy Pin Coordinates";

            locationLinksRow.appendChild(linkSubmitWayspot);
            locationLinksRow.appendChild(linkCopyCoords);

            locationRow.appendChild(pinIconSvg);
            locationRow.appendChild(locationLinksRow);
            locationFunctionsSection.appendChild(locationRow);

            linkSubmitWayspot.addEventListener("click", (ev) => {
                ev.preventDefault();
                handleLocationSubmitWayspotClick();
            });

            linkCopyCoords.addEventListener("click", (ev) => {
                ev.preventDefault();
                handleCopyLocationCoordsClick(linkCopyCoords);
            });

            // ==============================
            // SECTION 5: Settings
            // ==============================
            const settingsSection = document.createElement("section");
            settingsSection.className = "wfmapmods-section wfmapmods-section-settings";

            const settingsBody = document.createElement("div");
            settingsBody.className = "wfmapmods-link-block wfmapmods-settings-links";

            const linkMapOptions = document.createElement("a");
            linkMapOptions.textContent = "Map options";
            linkMapOptions.href = "#";

            const linkMarkers = document.createElement("a");
            linkMarkers.textContent = "Markers";
            linkMarkers.href = "#";

            const linkNearby = document.createElement("a");
            linkNearby.href = "#";
            linkNearby.textContent = "Nearby Wayspots";

            settingsBody.appendChild(linkMapOptions);
            settingsBody.appendChild(linkMarkers);
            settingsBody.appendChild(linkNearby);

            linkMapOptions.addEventListener("click", (e) => {
                e.preventDefault();
                openMapOptionsWindow();
            });

            linkMarkers.addEventListener("click", (e) => {
                e.preventDefault();
                openMarkerSettingsWindow();
            });

            linkNearby.addEventListener("click", (ev) => {
                ev.preventDefault();
                openNearbyWayspotsModal();
            });

            settingsSection.appendChild(settingsBody);

            // Assemble content
            content.appendChild(searchSection);
            content.appendChild(detailsSection);
            content.appendChild(divider1);
            content.appendChild(poiFunctionsSection);
            content.appendChild(divider2);
            content.appendChild(locationFunctionsSection);
            content.appendChild(divider3);
            content.appendChild(settingsSection);

            panel.appendChild(content);
            mapDiv.appendChild(panel);

            sidePanelEl = panel;
            applySidePanelCollapseState();
        } else if (!mapDiv.contains(sidePanelEl)) {
            mapDiv.appendChild(sidePanelEl);
            applySidePanelCollapseState();
        }

        adjustMapControlsForSidePanel();
    }

    function buildStatusTag(statusRaw) {
        const status = (statusRaw || "LIVE").toString().toUpperCase();

        // --- Determine colour variant ---
        let variant = "queue"; // default: grey
        if (status === "ACCEPTED" || status === "LIVE") {
            variant = "accepted"; // green
        } else if (status === "REJECTED" || status === "DUPLICATE") {
            variant = "rejected"; // red
        }

        // --- Determine display label ---
        const label = STATUS_LABELS[status] || status;

        const span = document.createElement("span");
        span.className = `wfmapmods-status-tag wfmapmods-status-tag--${variant}`;
        span.textContent = label;

        return span;
    }

    function updateLayersControlPosition() {
        if (!topRightControlsBarEl) return;

        const gap = 10;
        const panelWidth = 300;

        const rightPx = sidePanelCollapsed ? gap : panelWidth + gap * 2;
        topRightControlsBarEl.style.right = rightPx + "px";
    }

    function applySidePanelCollapseState() {
        if (!sidePanelEl) return;

        const toggleTab = sidePanelEl.querySelector("#wfmapmods-sidepanel-toggle");
        sidePanelEl.classList.toggle("wfmapmods-sidepanel-collapsed", !!sidePanelCollapsed);

        if (toggleTab) {
            toggleTab.textContent = sidePanelCollapsed ? "◀" : "▶";
        }

        updateLayersControlPosition();
    }

    function adjustMapControlsForSidePanel() {
        if (!wfMap || typeof google === "undefined" || !google.maps) return;

        // Move built-in controls to the left so they don't sit under the panel
        wfMap.setOptions({
            zoomControlOptions: {
                position: google.maps.ControlPosition.LEFT_BOTTOM,
            },
            fullscreenControlOptions: {
                position: google.maps.ControlPosition.LEFT_BOTTOM,
            },
            streetViewControlOptions: {
                position: google.maps.ControlPosition.LEFT_BOTTOM,
            }
        });

        // NOTE: your custom geolocation control is currently added at RIGHT_BOTTOM.
        // With the side panel on the right, that will be underneath the panel.
        // If you want it on the left too, you can change addGeolocationControl
        // to use LEFT_BOTTOM instead of RIGHT_BOTTOM.
    }

    function populateSidePanelFromPoi(poi) {
        if (!poi) return;

        ensureSidePanel();
        if (!sidePanelEl) return;

        const detailsSection      = sidePanelEl.querySelector(".wfmapmods-section-details");
        const poiFunctionsSection = sidePanelEl.querySelector(".wfmapmods-section-poi-functions");
        const divider             = sidePanelEl.querySelector(".wfmapmods-section-divider-details");
        const titleEl             = sidePanelEl.querySelector(".wfmapmods-detail-title");
        const statusEl            = sidePanelEl.querySelector(".wfmapmods-detail-status-tag-container");
        const coordsEl            = sidePanelEl.querySelector(".wfmapmods-detail-coords");
        const imgBox              = sidePanelEl.querySelector(".wfmapmods-detail-image-box");
        const sourceLogoEl        = sidePanelEl.querySelector(".wfmapmods-detail-poi-source");
        const pgoEntityLogoEl     = sidePanelEl.querySelector(".wfmapmods-detail-pgo-entity-logo");
        const communityLogoEl     = sidePanelEl.querySelector(".wfmapmods-detail-community-logo");

        // Reveal the details + POI functions + divider (your CSS uses !important on hidden)
        if (detailsSection) detailsSection.classList.remove("wfmapmods-is-hidden");
        if (poiFunctionsSection) poiFunctionsSection.classList.remove("wfmapmods-is-hidden");
        if (divider) divider.classList.remove("wfmapmods-is-hidden");

        // ----- Title -----
        if (titleEl) {
            const title = poi.title || "";
            titleEl.textContent = title;
            titleEl.title = title;
        }

        // ----- Status tag -----
        if (statusEl) {
            const status = poi.status || "LIVE";
            statusEl.innerHTML = "";
            statusEl.appendChild(buildStatusTag(status));
        }

        // ----- Source logo -----
        if (sourceLogoEl) {
            sourceLogoEl.innerHTML = poi.dataSourceLogo || "";

            const hasLogo = !!sourceLogoEl.innerHTML.trim();
            // base CSS has display:none; so we only need to set display:flex when present
            sourceLogoEl.style.display = hasLogo ? "flex" : "none";

            if (hasLogo) {
                sourceLogoEl.title = poi.dataSourceText || "";

                // keep your sizing without needing new CSS
                Object.assign(sourceLogoEl.style, {
                    alignItems: "center",
                    justifyContent: "center",
                    width: "24px",
                    height: "24px",
                    flex: "0 0 24px",
                    boxSizing: "content-box",
                    marginRight: "6px"
                });

                const insertedSvg = sourceLogoEl.querySelector("svg");
                if (insertedSvg) {
                    Object.assign(insertedSvg.style, {
                        width: "100%",
                        height: "100%",
                        display: "block"
                    });
                }
            } else {
                sourceLogoEl.removeAttribute("title");
            }
        }

        // ----- PGO Game Entity Icon -----
        if (pgoEntityLogoEl) {
            const entityRaw = (poi?.pgoEntity || "").toUpperCase();       // "POKESTOP" | "GYM" | "POWERSPOT" | ""
            const statusRaw = (poi?.pgoEntityStatus || "").toUpperCase(); // "ACTIVE" | "INACTIVE" | ""

            const iconSvg =
                  entityRaw === "POKESTOP" ? POI_TYPE_ICONS.stop :
            entityRaw === "GYM"      ? POI_TYPE_ICONS.gym :
            entityRaw === "POWERSPOT"? POI_TYPE_ICONS.powerspot :
            "";

            const label =
                  entityRaw === "POKESTOP" ? "PokéStop" :
            entityRaw === "GYM"      ? "Gym" :
            entityRaw === "POWERSPOT"? "Power Spot" :
            "";

            const isInactive = (statusRaw === "INACTIVE");
            const showSlash = isInactive && (entityRaw === "POKESTOP" || entityRaw === "GYM");

            if (!iconSvg) {
                pgoEntityLogoEl.style.display = "none";
                pgoEntityLogoEl.innerHTML = "";
                pgoEntityLogoEl.removeAttribute("title");
                delete pgoEntityLogoEl.dataset.inactive;
                delete pgoEntityLogoEl.dataset.slashed;
            } else {
                pgoEntityLogoEl.style.display = "flex";
                pgoEntityLogoEl.style.position = "relative";
                pgoEntityLogoEl.style.overflow = "visible";

                pgoEntityLogoEl.innerHTML = iconSvg + (showSlash
                                                       ? `<span class="wfmapmods-pgo-inactive-slash" aria-hidden="true"></span>`
                                                       : "");

                const svg = pgoEntityLogoEl.querySelector("svg");
                if (svg) {
                    Object.assign(svg.style, { width: "100%", height: "100%", display: "block" });
                    svg.style.opacity = isInactive ? "0.35" : "1";
                    svg.style.filter = isInactive ? "grayscale(1)" : "";
                }

                if (!isInactive) {
                    pgoEntityLogoEl.title = label;
                } else if (entityRaw === "POWERSPOT") {
                    pgoEntityLogoEl.title = "This Power Spot may appear during this rotation but is not currently active.";
                } else {
                    pgoEntityLogoEl.title = `This ${label} has a status of 'Inactive'.\nIt will not appear in Pokémon Go.`;
                }

                pgoEntityLogoEl.dataset.inactive = isInactive ? "1" : "0";
                pgoEntityLogoEl.dataset.slashed = showSlash ? "1" : "0";
            }
        }

        // ----- Community / Import logo -----
        if (communityLogoEl) {
            const cc = poi?.isCommunityContributed;
            const iconSvg =
                  cc === true  ? COMMUNITY_CONTRIBUTED_ICON_SVG :
            cc === false ? IMPORT_ICON_SVG :
            "";

            if (!iconSvg) {
                communityLogoEl.style.display = "none";
                communityLogoEl.innerHTML = "";
                communityLogoEl.removeAttribute("title");
                delete communityLogoEl.dataset.iconKey;
            } else {
                communityLogoEl.style.display = "flex";

                const iconKey = (cc === true) ? "community" : "import";
                if (communityLogoEl.dataset.iconKey !== iconKey) {
                    communityLogoEl.innerHTML = iconSvg;
                    communityLogoEl.dataset.iconKey = iconKey;

                    const svg = communityLogoEl.querySelector("svg");
                    if (svg) Object.assign(svg.style, { width: "100%", height: "100%", display: "block" });
                }

                communityLogoEl.title = (cc === true) ? "Community Contributed" : "Imported Wayspot";
            }
        }

        // ----- Coordinates + deep link -----
        if (coordsEl) {
            const coordsText = formatCoords(poi.lat, poi.lng); // consistent format everywhere

            coordsEl.textContent = coordsText ? `(${coordsText})` : "--";
            coordsEl.dataset.lat = String(poi.lat ?? "");
            coordsEl.dataset.lng = String(poi.lng ?? "");
            coordsEl.title = coordsText ? "Copy Wayspot coordinates" : "";

            coordsEl.onclick = () => {
                copyCoordsToClipboard(coordsEl.dataset.lat, coordsEl.dataset.lng).catch(() => {});
            };

            const deepLinkA = sidePanelEl.querySelector(".wfmapmods-poi-function-links .wfmapmods-poi-deeplink");
            const reportA = sidePanelEl.querySelector(".wfmapmods-poi-function-links .wfmapmods-poi-reportlink");

            if (poi.lat && poi.lng) {
                const url = buildDeepLinkUrl(poi.lat, poi.lng);

                if (deepLinkA) {
                    deepLinkA.dataset.link = url;
                    deepLinkA.textContent = "Wayspot link";
                    deepLinkA.classList.remove("wfmapmods-is-hidden");
                }
            }

            // Show report link if we have a guid and >00 submissions
            if (!poi.guid) {
                reportA.classList.add("wfmapmods-is-hidden");
                delete reportA.dataset.poiId;
            } else {
                reportA.dataset.poiId = poi.guid;
                reportA.classList.remove("wfmapmods-is-hidden");

                const available = getQuota("POI_TAKEDOWN_REQUEST")?.submissionsLeft ?? 0;

                const disabled = available <= 0;
                reportA.classList.toggle("wfmapmods-link-disabled", disabled);
                reportA.setAttribute("aria-disabled", disabled ? "true" : "false");
            }
        }

        // ----- Image -----
        if (imgBox) {
            imgBox.innerHTML = "";

            const borderColor = poi.borderColor || "#154AAB";
            imgBox.style.border = `10px solid ${borderColor}`;
            imgBox.style.cursor = "pointer";

            // Ensure only one click handler
            imgBox.onclick = () => openWayspotDetailOverlay(poi);

            if (poi.imageUrl) {
                const img = document.createElement("img");
                img.className = "wfmapmods-detail-image";
                img.src = poi.imageUrl;
                // if you want, you can move these to CSS later
                Object.assign(img.style, { width: "100%", height: "100%", objectFit: "cover", display: "block" });
                imgBox.appendChild(img);
            } else {
                const placeholder = document.createElement("div");
                placeholder.className = "wfmapmods-detail-image-placeholder";
                placeholder.textContent = "No image available";
                Object.assign(placeholder.style, {
                    color: "#9ca3af",
                    fontSize: "12px",
                    textAlign: "center",
                    width: "100%",
                    height: "100%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center"
                });
                imgBox.appendChild(placeholder);
            }
        }
    }


    // ==================================
    // Side panel location functions (submission marker)
    // ==================================

    function handleLocationSubmitWayspotClick() {
        if (typeof window.currentLat !== "number" || typeof window.currentLng !== "number") {
            alert("Submission marker location is not set yet.");
            return;
        }

        // Use the submission bridge defined in the Base plugin
        const bridge = document.getElementById("wfmapmods-submit-bridge");
        if (!bridge) {
            alert("Submission bridge is not available (Base plug-in submit bridge missing).");
            return;
        }

        const payload = {
            source: "wfmapmods-base-location",
            poi: {
                id: null,
                title: "",
                description: "",
                supportingStatement: "",
                lat: window.currentLat,
                lng: window.currentLng
            },
            images: {
                mainUrl: "",
                supportingUrls: []
            }
        };

        try {
            bridge.setAttribute("data-submission", JSON.stringify(payload));
        } catch (e) {
            console.warn("Wayfarer Map: failed to serialise location submit payload", e, payload);
        }
    }

    function handleCopyLocationCoordsClick(linkEl) {
        if (typeof window.currentLat !== "number" || typeof window.currentLng !== "number") {
            alert("Submission marker location is not set yet.");
            return;
        }

        const showCopiedTemp = () => {
            if (!linkEl) return;
            const original = linkEl.textContent;
            linkEl.textContent = "Copied!";
            setTimeout(() => (linkEl.textContent = original), 1200);
        };

        copyCoordsToClipboard(window.currentLat, window.currentLng)
            .then(showCopiedTemp)
            .catch(() => {
            // Even if copy fails, keep UX consistent (optional)
            showCopiedTemp();
        });
    }

    // ==================================
    // Export nearby Wayspots
    // ==================================

    function openNearbyWayspotsModal() {
        const pois = Array.isArray(window.currentPois) ? window.currentPois : [];

        const lines = pois.map((p) => {
            const title = p.title || "";
            const lat = (typeof p.lat === "number") ? p.lat : Number(p.lat || 0);
            const lng = (typeof p.lng === "number") ? p.lng : Number(p.lng || 0);
            return `"${title}" at ${lat},${lng}`;
        });

        openModal({
            id: "wfmapmods-nearbywayspots-modal",
            title: "Nearby Wayspots",
            width: 400,
            showFooterButtons: false,
            buildContent(dialog) {
                const section = document.createElement("div");
                section.className = "wfmapmods-modal-section";

                const intro = document.createElement("div");
                intro.className = "wfmapmods-modal-intro";
                intro.textContent = pois.length
                    ? "Nearby Wayspots relative to the submission marker:"
                : "No Wayspots found near the submission marker.";
                section.appendChild(intro);

                const textarea = document.createElement("textarea");
                textarea.className = "wfmapmods-modal-textarea";
                textarea.readOnly = true;
                textarea.value = lines.join("\n");
                section.appendChild(textarea);

                const actions = document.createElement("div");
                actions.className = "wfmapmods-modal-actions";

                const exportBtn = document.createElement("button");
                exportBtn.type = "button";
                exportBtn.textContent = "Export to CSV";
                exportBtn.className = "wfmapmods-modal-btn";
                exportBtn.addEventListener("click", (ev) => {
                    ev.preventDefault();
                    exportNearbyWayspotsCsv();
                });

                actions.appendChild(exportBtn);
                section.appendChild(actions);

                dialog.appendChild(section);
                return { textarea };
            }
        });
    }


    function escapeCsvField(v) {
        if (v == null) return "";
        const s = String(v);
        if (/[",\n]/.test(s)) {
            return '"' + s.replace(/"/g, '""') + '"';
        }
        return s;
    }

    /**
     * Wayspot Source:
     * - true  => "Community"
     * - false => "Import"
     * - null/undefined => ""
     */
    function getWayspotSourceLabel(p) {
        const v = p?.isCommunityContributed;
        if (v === true) return "Community";
        if (v === false) return "Import";
        return "";
    }

    function exportNearbyWayspotsCsv() {
        const pois = Array.isArray(window.currentPois) ? window.currentPois : [];
        if (!pois.length) {
            alert("No nearby Wayspots are currently loaded.");
            return;
        }

        const rows = [];
        // Header
        rows.push([
            "guid",
            "title",
            "description",
            "address",
            "lat",
            "lng",
            "imageUrl",
            "wayspotSource",
            "gameEntity",
            "gameStatus"
        ]);

        for (const p of pois) {
            const srcLabel = getWayspotSourceLabel(p);

            rows.push([
                p.guid || "",
                p.title || "",
                p.description || "",
                p.address || "",
                (typeof p.lat === "number") ? p.lat : (p.lat || ""),
                (typeof p.lng === "number") ? p.lng : (p.lng || ""),
                p.imageUrl || "",
                srcLabel,
                p.pgoEntity,
                p.pgoEntityStatus
            ]);
        }

        const csv = rows
        .map((r) => r.map(escapeCsvField).join(","))
        .join("\r\n");

        // Add UTF-8 BOM so Excel displays special characters correctly
        const bom = "\uFEFF";
        const blob = new Blob([bom + csv], { type: "text/csv;charset=utf-8" });
        const url = URL.createObjectURL(blob);

        const a = document.createElement("a");
        a.href = url;

        const ts = new Date().toISOString().slice(0, 10);
        a.download = `nearby-wayspots-${ts}.csv`;

        document.body.appendChild(a);
        a.click();

        setTimeout(() => {
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        }, 0);
    }


    // ==================================
    // POI bridge (cross-userscript data bus)
    // ==================================

    function createBridges() {
        startPoiBridgeObserver();
        startSubmissionBridgeObserver();
    }

    function ensurePoiBridgeElement() {
        let el = document.getElementById("wfmapmods-poi-bridge");
        if (!el) {
            el = document.createElement("div");
            el.id = "wfmapmods-poi-bridge";
            el.style.display = "none";
            el.setAttribute("data-wfmapmods-bridge", "1");
            document.body.appendChild(el);
        }
        return el;
    }

    function startPoiBridgeObserver() {
        const bridge = ensurePoiBridgeElement();

        if (poiBridgeObserver) return;

        poiBridgeObserver = new MutationObserver(() => {
            const payloadStr = bridge.getAttribute("data-payload");
            if (!payloadStr) return;

            let payload;
            try {
                payload = JSON.parse(payloadStr);
            } catch (e) {
                console.warn("Wayfarer Map: Failed to parse POI bridge payload:", e, payloadStr);
                return;
            }

            lastBridgePayload = payload;
            handleBridgePoiPayload(payload);
        });

        poiBridgeObserver.observe(bridge, {
            attributes: true,
            attributeFilter: ["data-payload"],
        });
    }

    // Called whenever the bridge gets new POI data (from any userscript)
    function handleBridgePoiPayload(payload) {
        const poi = {
            guid: payload.guid || null,
            id: payload.id || null,
            title: payload.title || "(untitled)",
            description: payload.description || payload.desc || "",
            lat: typeof payload.lat === "number" ? payload.lat : Number(payload.lat),
            lng: typeof payload.lng === "number" ? payload.lng : Number(payload.lng),
            imageUrl: payload.imageUrl || payload.image || "",
            status: payload.status || "",
            source: payload.source || "",
            dataSourceLogo: payload.dataSourceLogo || "",
            dataSourceText: payload.dataSourceText || "",
            borderColor: payload.borderColor || "",
            isCommunityContributed: payload.isCommunityContributed,
            pgoEntity: payload.pgoEntity || "",
            pgoEntityStatus: payload.pgoEntityStatus || ""
        };

        populateSidePanelFromPoi(poi);
        applyPoiSelectionVisuals(poi);
    }

    function publishPoiToBridge(poi, extra) {
        const bridge = ensurePoiBridgeElement();

        const payload = Object.assign({
            guid: poi.guid,
            title: poi.title,
            description: poi.description,
            lat: poi.lat,
            lng: poi.lng,
            imageUrl: poi.imageUrl,
            status: "LIVE",
            source: "wfmapmods-base",
            isCommunityContributed: poi.isCommunityContributed,
            pgoEntity: poi.pgoEntity || "",
            pgoEntityStatus: poi.pgoEntityStatus || ""
        }, extra || {});

        try {
            bridge.setAttribute("data-payload", JSON.stringify(payload));
        } catch (e) {
            console.warn("Wayfarer Map: Failed to serialise POI for bridge:", e, payload);
        }
    }


    // ==================================
    // Submission bridge (cross-userscript submission bus)
    // ==================================

    const SUBMISSION_BRIDGE_ID = "wfmapmods-submit-bridge";
    let submissionBridgeObserver = null;

    function ensureSubmissionBridgeElement() {
        let el = document.getElementById(SUBMISSION_BRIDGE_ID);
        if (!el) {
            el = document.createElement("div");
            el.id = SUBMISSION_BRIDGE_ID;
            el.style.display = "none";
            el.setAttribute("data-wfmapmods-bridge", "submit");
            document.body.appendChild(el);
        }
        return el;
    }

    function startSubmissionBridgeObserver() {
        const bridge = ensureSubmissionBridgeElement();

        if (submissionBridgeObserver) return;

        submissionBridgeObserver = new MutationObserver(() => {
            const payloadStr = bridge.getAttribute("data-submission");
            if (!payloadStr) return;

            // Clear immediately so new submissions can re-trigger
            bridge.setAttribute("data-submission", "");

            let payload;
            try {
                payload = JSON.parse(payloadStr);
            } catch (e) {
                console.warn("Wayfarer Map: Failed to parse submission bridge payload:", e, payloadStr);
                return;
            }

            handleSubmissionBridgePayload(payload);
        });

        submissionBridgeObserver.observe(bridge, {
            attributes: true,
            attributeFilter: ["data-submission"]
        });
    }

    function handleSubmissionBridgePayload(payload) {
        if (!payload || typeof payload !== "object") return;

        const mode = (payload.mode || "RESUBMIT").toUpperCase();
        const poi = payload.poi || {};
        const images = payload.images || {};

        const submitData = {
            source: payload.source || "",
            poi: {
                id: poi.id || poi.guid || poi.recordId || null,
                title: poi.title || "",
                description: poi.description || poi.desc || "",
                supportingStatement: poi.supportingStatement || poi.statement || "",
                lat: typeof poi.lat === "number" ? poi.lat : (poi.lat != null ? Number(poi.lat) : null),
                lng: typeof poi.lng === "number" ? poi.lng : (poi.lng != null ? Number(poi.lng) : null)
            },
            images: {
                mainUrl: images.mainUrl || poi.imageUrl || poi.imageServingUrl || "",
                supportingUrls: Array.isArray(images.supportingUrls)
                ? images.supportingUrls
                : (images.supportingUrl ? [images.supportingUrl] : [])
            }
        };

        openSubmissionEditModal(submitData);
    }

    // ==================================
    // Submission API helpers
    // ==================================

    function getCookie(name) {
        const match = document.cookie.match(new RegExp("(^|; )" + name + "=([^;]*)"));
        return match ? decodeURIComponent(match[2]) : null;
    }

    function getCsrfToken() {
        return getCookie("XSRF-TOKEN") || "";
    }

    function postJsonWithCsrf(url, bodyObj) {
        return new Promise((resolve, reject) => {
            const xhr = new XMLHttpRequest();
            xhr.open("POST", url, true);
            xhr.withCredentials = true;
            xhr.setRequestHeader("Content-Type", "application/json;charset=UTF-8");

            const csrf = getCsrfToken();
            if (csrf) {
                xhr.setRequestHeader("x-csrf-token", csrf);
            }

            xhr.onload = function () {
                if (xhr.status < 200 || xhr.status >= 300) {
                    return reject(new Error("HTTP " + xhr.status + " for " + url));
                }

                let json = null;
                try {
                    json = JSON.parse(xhr.responseText || "{}");
                } catch (e) {
                    return reject(e);
                }
                resolve(json);
            };

            xhr.onerror = function () {
                reject(new Error("Network error for " + url));
            };

            xhr.send(JSON.stringify(bodyObj));
        });
    }

    function fetchImageBlobForSubmit(url) {
        return new Promise(async (resolve, reject) => {
            if (!url) {
                resolve(null);
                return;
            }

            try {
                const res = await fetch(url, {
                    mode: "cors",
                    credentials: "omit"
                });

                if (!res.ok) {
                    reject(new Error("Image fetch failed: HTTP " + res.status));
                    return;
                }

                const blob = await res.blob();
                resolve(blob);
            } catch (err) {
                console.error("fetchImageBlobForSubmit: fetch() failed for", url, err);
                reject(err);
            }
        });
    }

    function putImageToSignedUrlForSubmit(url, blob) {
        if (!url || !blob) return Promise.resolve();

        return blob.arrayBuffer().then((buf) => {
            return fetch(url, {
                method: "PUT",
                body: buf
                // IMPORTANT: no Content-Type header
            }).then((res) => {
                if (!res.ok) {
                    throw new Error("PUT to signed URL failed: " + res.status);
                }
            });
        });
    }

    async function submitWayspotViaApi(submitData, options = {}) {
        const { poi, images } = submitData || {};
        if (!poi) return;

        const title = (poi.title || "").trim();
        const description = (poi.description || "").trim();
        const supportingStatement = (poi.supportingStatement || "").trim();
        const lat = poi.lat;
        const lng = poi.lng;

        if (!title || !description) {
            alert("Title and description are required.");
            return;
        }
        if (typeof lat !== "number" || typeof lng !== "number" || !Number.isFinite(lat) || !Number.isFinite(lng)) {
            alert("Submission is missing valid coordinates.");
            return;
        }

        const mainState = images && images.main;
        const supportingStates = images && Array.isArray(images.supporting) ? images.supporting : [];

        if (!mainState) {
            alert("Submission is missing a main image.");
            return;
        }
        if (supportingStates.length < 1 || supportingStates.length > 5) {
            alert("Submission must have between 1 and 5 supporting images.");
            return;
        }

        const confirmText =
              "This will submit a new nomination with the provided details.\n\n" +
              "This will consume one of your available nominations.\n\n" +
              "Do you want to continue?";
        if (!window.confirm(confirmText)) {
            return;
        }

        // User confirmed → begin critical operation
        wfMapmodsIsUploading = true;

        // 0–20% = prep work
        wfmapmodsSetSubmitProgress("Starting nomination…", 5);

        // Helper for image-upload range: 20–90%
        function imageUploadPercent(done, total) {
            const start = 20;
            const end = 90;
            if (total <= 0) return start;
            const frac = done / total;
            return start + Math.floor(frac * (end - start));
        }

        try {
            wfmapmodsSetSubmitProgress("Preparing images…", 10);

            async function resolveBlobFromState(state) {
                if (!state) return null;
                if (state.sourceType === "file" && state.file instanceof Blob) {
                    return state.file;
                }
                if (state.url) return await fetchImageBlobForSubmit(state.url);
                return null;
            }

            const mainBlob = await resolveBlobFromState(mainState);
            if (!mainBlob) {
                wfmapmodsHideSubmitProgress();
                wfMapmodsIsUploading = false;
                alert("Could not load main image data.");
                return;
            }

            const supportingBlobs = [];
            for (const s of supportingStates) {
                const b = await resolveBlobFromState(s);
                if (b) supportingBlobs.push(b);
            }

            wfmapmodsSetSubmitProgress("Contacting Wayfarer…", 20);

            const startPayload = {
                title,
                description,
                lat,
                lng,
                supportingStatement,
                supportingImageCount: supportingBlobs.length
            };

            console.log("[WF Submit] /submit/start payload:", startPayload);

            const startResp = await postJsonWithCsrf("/api/v1/vault/submit/start", startPayload);

            console.log("[WF Submit] /submit/start response raw:", startResp);

            if (!startResp || startResp.captcha) {
                wfmapmodsHideSubmitProgress();
                wfMapmodsIsUploading = false;
                alert("Submit/start failed or requires captcha. Please submit manually.");
                return;
            }

            const result = startResp.result || {};
            const imageUrlMap = result.imageUrlMap || result.uploadUrlMap || {};
            const submissionId = result.submissionId || result.nominationId;

            console.log("[WF Submit] submissionId:", submissionId);
            console.log("[WF Submit] imageUrlMap:", imageUrlMap);

            if (!submissionId) {
                wfmapmodsHideSubmitProgress();
                wfMapmodsIsUploading = false;
                alert("Submit/start did not return a submissionId.");
                return;
            }

            // === Main image URL ===
            const mainUploadUrl = imageUrlMap.main || null;

            if (!mainUploadUrl) {
                wfmapmodsHideSubmitProgress();
                wfMapmodsIsUploading = false;
                alert("Submit/start did not return main image URL.");
                return;
            }

            // =====================================================
            // Build supporting URLs
            // =====================================================

            let supportingUploadUrls = [];

            // Collect supporting, supporting1, supporting2, ...
            const supportingKeys = Object.keys(imageUrlMap)
            .filter(k => k === "supporting" || /^supporting\d+$/.test(k))
            .sort((a, b) => {
                if (a === "supporting") return -1;
                if (b === "supporting") return 1;
                const na = parseInt(a.replace("supporting", ""), 10);
                const nb = parseInt(b.replace("supporting", ""), 10);
                return na - nb;
            });

            supportingUploadUrls = supportingKeys
                .map(k => imageUrlMap[k])
                .filter(Boolean);

            const totalSupporting = supportingBlobs.length;
            const totalImages = 1 + totalSupporting; // main + supporting
            let uploadedImages = 0;

            // Hard fail if Wayfarer didn't give us a URL for every supporting image.
            if (totalSupporting > 0 && supportingUploadUrls.length < totalSupporting) {
                const msg =
                      "[WF Submit] MISMATCH: Need " + totalSupporting +
                      " supporting URLs but only got " + supportingUploadUrls.length;
                console.warn(msg, { supportingUploadUrls, supportingBlobs });

                wfmapmodsHideSubmitProgress();
                wfMapmodsIsUploading = false;
                alert(
                    "Error preparing your nomination:\n\n" +
                    "Wayfarer did not return upload URLs for all supporting photos.\n" +
                    "The nomination has NOT been submitted.\n\n" +
                    "Please screenshot console log and share on WDD #tools."
                );
                return;
            }

            // === Upload main image (first of totalImages) ===
            uploadedImages = 0;
            uploadedImages++;

            const mainPct = imageUploadPercent(uploadedImages, totalImages);
            wfmapmodsSetSubmitProgress(
                `Uploading main photo…`,
                mainPct
            );
            console.log("[WF Submit] PUT main image to:", mainUploadUrl);
            await putImageToSignedUrlForSubmit(mainUploadUrl, mainBlob);

            // === Upload supporting ===
            if (totalSupporting > 0) {
                wfmapmodsSetSubmitProgress(
                    `Uploading supporting photos (0 of ${totalSupporting})…`,
                    imageUploadPercent(uploadedImages, totalImages)
                );
            }

            let uploadedSupportingCount = 0;

            for (let i = 0; i < totalSupporting; i++) {
                const blob = supportingBlobs[i];
                const url = supportingUploadUrls[i];

                if (!blob || !url) {
                    console.warn(
                        "[WF Submit] Missing blob/url for supporting image index",
                        i,
                        "blob:", !!blob,
                        "url:", url
                    );

                    wfmapmodsHideSubmitProgress();
                    wfMapmodsIsUploading = false;
                    alert(
                        "Error uploading supporting photos:\n\n" +
                        "One of the supporting images could not be prepared for upload.\n" +
                        "The nomination has NOT been submitted.\n\n" +
                        "Please screenshot console log and share on WDD #tools."
                    );
                    return;
                }

                uploadedSupportingCount++;
                uploadedImages++;

                const pct = imageUploadPercent(uploadedImages, totalImages);
                const label = `Uploading supporting photos (${uploadedSupportingCount} of ${totalSupporting})…`;

                wfmapmodsSetSubmitProgress(label, pct);

                console.log(`[WF Submit] PUT supporting image #${uploadedSupportingCount} to:`, url);
                await putImageToSignedUrlForSubmit(url, blob);
            }

            // === Complete submission ===
            wfmapmodsSetSubmitProgress("Finalising nomination…", 95);

            const completePayload = submissionId;
            const completeUrl =
                  "/api/v1/vault/submit/complete?submissionId=" + encodeURIComponent(submissionId);

            console.log("[WF Submit] /submit/complete URL:", completeUrl);
            console.log("[WF Submit] /submit/complete payload:", completePayload);

            const completeResp = await postJsonWithCsrf(completeUrl, completePayload);

            console.log("[WF Submit] /submit/complete response raw:", completeResp);

            if (!completeResp || completeResp.captcha) {
                wfmapmodsHideSubmitProgress();
                wfMapmodsIsUploading = false;
                alert("Submit/complete failed or requires captcha.");
                return;
            }

            if (completeResp.result !== "DONE") {
                wfmapmodsHideSubmitProgress();
                wfMapmodsIsUploading = false;
                alert("Submit/complete did not succeed: " + (completeResp.code || completeResp.result));
                return;
            }

            // ONLY delete draft after complete succeeded
            if (options.draftIdToDelete) {
                try {
                    await deleteDraftSubmissionFromIDB(options.draftIdToDelete);
                } catch (e) {
                    console.warn("[WF Submit] Draft deletion failed:", e);
                    // don't fail the submission UI just because cleanup failed
                }
            }

            wfmapmodsSetSubmitProgress("Nomination submitted!", 100);
            console.log("[WF Submit] DONE for submissionId:", submissionId);

            wfMapmodsIsUploading = false;

            wfmapmodsHideSubmitProgress(1500);

        } catch (err) {
            console.error("Wayfarer Map: submitWayspotViaApi failed:", err);
            wfmapmodsHideSubmitProgress();
            wfMapmodsIsUploading = false;
            alert("Error while submitting nomination — see console for details.");
        } finally {
            // Refresh quotas regardless of success/failure/early-return
            updateAvailability({ force: true }).catch(() => {});
        }
    }

    window.addEventListener("beforeunload", (e) => {
        if (wfMapmodsIsUploading) {
            // Required for Chrome
            e.preventDefault();
            e.returnValue = "An upload is still in progress. Leaving now will cancel it permanently and you will lose one nomination quota.";
            return e.returnValue;
        }
    });

    // ==============================
    // Submit progress bar on the map
    // ==============================

    function wfmapmodsGetOrCreateProgressBar() {
        if (!wfMap || typeof wfMap.getDiv !== "function") return null;

        const mapDiv = wfMap.getDiv();
        if (!mapDiv) return null;

        if (!mapDiv.style.position) mapDiv.style.position = "relative";

        let bar = mapDiv.querySelector("#wfmapmods-submit-progress");
        if (bar) return bar;

        bar = document.createElement("div");
        bar.id = "wfmapmods-submit-progress";
        bar.className = "is-hidden";
        bar.innerHTML = `
    <div class="wfmapmods-progress-inner">
      <div class="wfmapmods-progress-text">Preparing nomination…</div>
      <div class="wfmapmods-progress-track">
        <div class="wfmapmods-progress-fill"></div>
      </div>
    </div>
  `;

        // Cache references on the element
        bar._textEl = bar.querySelector(".wfmapmods-progress-text");
        bar._fillEl = bar.querySelector(".wfmapmods-progress-fill");

        mapDiv.appendChild(bar);
        return bar;
    }

    function wfmapmodsSetSubmitProgress(text, percent, show = true) {
        const bar = wfmapmodsGetOrCreateProgressBar();
        if (!bar) return;

        bar.classList.toggle("is-hidden", !show);

        if (typeof text === "string" && bar._textEl) bar._textEl.textContent = text;

        if (typeof percent === "number" && bar._fillEl) {
            const clamped = Math.max(0, Math.min(100, percent));
            // (see #2 below)
            bar._fillEl.style.setProperty("--wfmapmods-progress", clamped + "%");
        }
    }

    function wfmapmodsHideSubmitProgress(delayMs) {
        const mapDiv = wfMap?.getDiv?.();
        const bar = mapDiv ? mapDiv.querySelector("#wfmapmods-submit-progress") : null;
        if (!bar) return;

        const hide = () => bar.classList.add("is-hidden");
        if (typeof delayMs === "number" && delayMs > 0) setTimeout(hide, delayMs);
        else hide();
    }

    // ==================================
    // Submission interface
    // ==================================

    function wfmapmodsFormatLatLng(lat, lng) {
        if (typeof lat !== "number" || typeof lng !== "number" || !Number.isFinite(lat) || !Number.isFinite(lng)) {
            return "Unknown";
        }
        return lat.toFixed(6) + ", " + lng.toFixed(6);
    }

    function openSubmissionEditModal(submitData) {
        openModal({
            id: "wfmapmods-submission-edit",
            title: "Submit Wayspot",
            width: 500,
            buildContent(body, okBtn, closeModal) {
                const poi = submitData.poi || {};
                const originalImages = submitData.images || {};

                // imageState: what we will actually submit
                const imageState = {
                    main: null,
                    supporting: []
                };

                // ---- normalise starting lat/lng and push into submitData ----
                let currentLat = (typeof poi.lat === "number" && Number.isFinite(poi.lat))
                ? poi.lat
                : (typeof window.currentLat === "number" ? window.currentLat : null);

                let currentLng = (typeof poi.lng === "number" && Number.isFinite(poi.lng))
                ? poi.lng
                : (typeof window.currentLng === "number" ? window.currentLng : null);

                submitData.poi = submitData.poi || {};
                if (typeof currentLat === "number" && typeof currentLng === "number") {
                    submitData.poi.lat = currentLat;
                    submitData.poi.lng = currentLng;
                }

                // Ensure submitterLocation is set (for distance rules, if used)
                if (typeof getSubmitterLocation === "function") {
                    getSubmitterLocation();
                }

                // --- seed images from URLs OR from saved draft structure ---

                // Case 1: draft-style structure { main, supporting[] }
                if (originalImages.main) {
                    imageState.main = originalImages.main;
                } else if (originalImages.mainUrl) {
                    imageState.main = {
                        sourceType: "url",
                        url: originalImages.mainUrl,
                        file: null
                    };
                }

                if (Array.isArray(originalImages.supporting)) {
                    imageState.supporting = originalImages.supporting.slice();
                } else if (Array.isArray(originalImages.supportingUrls)) {
                    originalImages.supportingUrls.forEach((u) => {
                        if (!u) return;
                        imageState.supporting.push({
                            sourceType: "url",
                            url: u,
                            file: null
                        });
                    });
                }

                const wrapper = document.createElement("div");
                wrapper.className = "wfmapmods-submit-wrap";

                // Hidden file inputs for main and supporting
                const mainFileInput = document.createElement("input");
                mainFileInput.type = "file";
                mainFileInput.accept = "image/*";
                mainFileInput.className = "wfmapmods-hidden";

                const supportingFileInput = document.createElement("input");
                supportingFileInput.type = "file";
                supportingFileInput.accept = "image/*";
                supportingFileInput.className = "wfmapmods-hidden";

                wrapper.appendChild(mainFileInput);
                wrapper.appendChild(supportingFileInput);

                // Images container
                const imagesRow = document.createElement("div");
                imagesRow.className = "wfmapmods-submit-images";
                wrapper.appendChild(imagesRow);

                // --- Helpers  ---

                function createPhotoBlock({
                    labelText,
                    state,            // "placeholder" | "pending" | "ready"
                    url = null,       // required for "ready"
                    onPick = null,    // for placeholder + (optional) ready click
                    onRemove = null   // for pending/ready remove
                }) {
                    const block = document.createElement("div");
                    block.className = "wfmapmods-submit-imgblock";

                    const label = document.createElement("div");
                    label.className = "wfmapmods-submit-imglabel";
                    label.textContent = labelText;
                    block.appendChild(label);

                    const wrap = document.createElement("div");
                    wrap.className = "wfmapmods-submit-thumbwrap";
                    block.appendChild(wrap);

                    // Tile
                    const tile = document.createElement("div");
                    tile.className = "wfmapmods-submit-tile";
                    wrap.appendChild(tile);

                    if (state === "placeholder") {
                        tile.classList.add("wfmapmods-submit-tile--placeholder");
                        tile.textContent = "+";
                        tile.addEventListener("click", (ev) => {
                            ev.preventDefault();
                            onPick && onPick();
                        });
                        return block;
                    }

                    if (state === "pending") {
                        tile.classList.add("wfmapmods-submit-tile--pending");
                        const spinner = document.createElement("div");
                        spinner.className = "wfmapmods-spinner";
                        tile.appendChild(spinner);
                    }

                    if (state === "ready") {
                        const img = document.createElement("img");
                        img.className = "wfmapmods-submit-thumb";
                        img.src = url;
                        tile.appendChild(img);

                        if (onPick) {
                            img.classList.add("is-clickable");
                            img.addEventListener("click", (ev) => {
                                ev.preventDefault();
                                onPick();
                            });
                        }
                    }

                    // Remove button (pending + ready)
                    if (onRemove) {
                        const removeBtn = document.createElement("button");
                        removeBtn.type = "button";
                        removeBtn.className = "wfmapmods-submit-remove";
                        removeBtn.textContent = "×";
                        removeBtn.addEventListener("click", (ev) => {
                            ev.preventDefault();
                            onRemove();
                        });
                        wrap.appendChild(removeBtn);
                    }

                    return block;
                }

                function renderImages() {
                    imagesRow.textContent = "";

                    // Main
                    if (!imageState.main) {
                        imagesRow.appendChild(createPhotoBlock({
                            labelText: "Main photo",
                            state: "placeholder",
                            onPick: () => mainFileInput.click()
                        }));
                    } else if (imageState.main._pending) {
                        imagesRow.appendChild(createPhotoBlock({
                            labelText: "Main photo",
                            state: "pending",
                            onRemove: () => { imageState.main = null; renderImages(); validate(); }
                        }));
                    } else {
                        imagesRow.appendChild(createPhotoBlock({
                            labelText: "Main photo",
                            state: "ready",
                            url: imageState.main.url,
                            onPick: () => mainFileInput.click(),
                            onRemove: () => { imageState.main = null; renderImages(); validate(); }
                        }));
                    }

                    // Supporting
                    imageState.supporting.forEach((imgObj, idx) => {
                        imagesRow.appendChild(createPhotoBlock({
                            labelText: "Supporting " + (idx + 1),
                            state: imgObj._pending ? "pending" : "ready",
                            url: imgObj.url,
                            onRemove: () => { imageState.supporting.splice(idx, 1); renderImages(); validate(); }
                        }));
                    });

                    if (imageState.supporting.length < 5) {
                        imagesRow.appendChild(createPhotoBlock({
                            labelText: "Supporting",
                            state: "placeholder",
                            onPick: () => supportingFileInput.click()
                        }));
                    }
                }

                // File input handlers
                mainFileInput.addEventListener("change", (ev) => {
                    const file = ev.target.files && ev.target.files[0];
                    if (!file) return;

                    // Set pending state immediately → spinner shows
                    imageState.main = {
                        sourceType: "file",
                        url: null,
                        file: null,
                        _pending: true
                    };

                    renderImages();
                    validate();

                    convertFileToJpeg(file).then(({ blob, dataUrl }) => {
                        if (!imageState.main) return; // was cleared while converting

                        imageState.main.url = dataUrl;   // JPEG preview
                        imageState.main.file = blob;     // JPEG blob for upload
                        imageState.main._pending = false;

                        renderImages();
                        validate();
                    }).catch((err) => {
                        console.error("Main image conversion failed:", err);
                        alert("Could not load image: " + err.message);
                        imageState.main = null;
                        renderImages();
                        validate();
                    }).finally(() => {
                        mainFileInput.value = "";
                    });
                });

                supportingFileInput.addEventListener("change", (ev) => {
                    const files = ev.target.files;
                    if (!files || !files.length) return;

                    for (let i = 0; i < files.length; i++) {
                        if (imageState.supporting.length >= 5) break;
                        const file = files[i];

                        // Create a pending entry: occupies a slot, shows the spinner box
                        const imgObj = {
                            sourceType: "file",
                            url: null,       // will be set when conversion finishes
                            file: null,      // final JPEG blob goes here
                            _pending: true   // flag used by renderImages
                        };

                        const idx = imageState.supporting.length;
                        imageState.supporting.push(imgObj);

                        // Immediately update UI so:
                        // - the spinner appears
                        // - and the next "+" placeholder appears if <5
                        renderImages();
                        validate();

                        // Convert in the background
                        convertFileToJpeg(file).then(({ blob, dataUrl }) => {
                            const target = imageState.supporting[idx];
                            if (!target) return; // entry removed while converting

                            target.url = dataUrl;  // JPEG preview
                            target.file = blob;    // JPEG blob for upload
                            target._pending = false;

                            renderImages();
                            validate();
                        }).catch((err) => {
                            console.error("Supporting image conversion failed:", err);
                            alert("Could not load one of the images: " + err.message);

                            // Remove the pending entry on error
                            const currentIndex = imageState.supporting.indexOf(imgObj);
                            if (currentIndex !== -1) {
                                imageState.supporting.splice(currentIndex, 1);
                                renderImages();
                                validate();
                            }
                        });
                    }

                    supportingFileInput.value = "";
                });

                // Initial render of images
                renderImages();

                // ==========================
                // Location row (lat,lng)
                // ==========================

                const locationRow = document.createElement("div");
                locationRow.className = "wfmapmods-submit-location";

                const locationLabel = document.createElement("div");
                locationLabel.className = "wfmapmods-submit-location-label";
                locationLabel.textContent = "Location";

                const locationRight = document.createElement("div");
                locationRight.className = "wfmapmods-submit-location-right";

                const locationValue = document.createElement("div");
                locationValue.className = "wfmapmods-submit-location-value";
                locationValue.textContent = wfmapmodsFormatLatLng(currentLat, currentLng);

                const changeBtn = document.createElement("button");
                changeBtn.type = "button";
                changeBtn.className = "wfmapmods-submit-changebtn";
                changeBtn.textContent = "Change";

                // --- Change button behaviour ---
                changeBtn.addEventListener("click", () => {
                    const backdrop = document.getElementById("wfmapmods-submission-edit");
                    if (!backdrop) return;

                    // Starting reference point: either current submitData coords or current window coords
                    const startLat = (typeof submitData.poi.lat === "number" ? submitData.poi.lat : window.currentLat);
                    const startLng = (typeof submitData.poi.lng === "number" ? submitData.poi.lng : window.currentLng);

                    // Hide modal so user can see the map
                    backdrop.style.display = "none";

                    if (currentMapMode === MAP_MODE.MOBILE) {
                        // Explicit “Confirm location” flow on mobile
                        startMobileLocationChange(backdrop, submitData, locationValue, validate);
                    } else {
                        // Keep existing automatic behaviour on desktop
                        startDesktopLocationChange(backdrop, submitData, locationValue, validate, startLat, startLng);
                    }
                });

                locationRight.appendChild(locationValue);
                locationRight.appendChild(changeBtn);

                locationRow.appendChild(locationLabel);
                locationRow.appendChild(locationRight);

                // Insert location row under images, before Title/Description fields
                wrapper.appendChild(locationRow);

                // Warning about distance (hidden by default)
                const distanceWarning = document.createElement("div");
                distanceWarning.className = "wfmapmods-submit-warning";
                wrapper.appendChild(distanceWarning);

                // --- Insert text input fields ---

                function addLabeledField({ labelText, value, maxLen, rows = null, onChange }) {
                    const container = document.createElement("div");
                    container.className = "wfmapmods-submit-field";

                    const label = document.createElement("label");
                    label.textContent = labelText;

                    const el = rows ? document.createElement("textarea") : document.createElement("input");
                    if (!rows) el.type = "text";
                    if (rows) el.rows = rows;
                    el.value = value || "";
                    if (maxLen) el.maxLength = maxLen;
                    el.className = rows ? "wfmapmods-submit-textarea" : "wfmapmods-submit-input";

                    const counter = document.createElement("div");
                    counter.className = "wfmapmods-submit-counter";

                    const update = () => {
                        const len = el.value.length;
                        counter.textContent = maxLen ? `${len} / ${maxLen}` : `${len}`;
                    };
                    update();

                    el.addEventListener("input", () => {
                        update();
                        onChange && onChange();
                    });

                    container.append(label, el, counter);
                    wrapper.appendChild(container);
                    return el;
                }

                const titleInput = addLabeledField({ labelText:"Title", value: poi.title, maxLen: 128, onChange: validate });
                const descInput  = addLabeledField({ labelText:"Description", value: poi.description, maxLen: 512, rows: 3, onChange: validate });
                const suppInput  = addLabeledField({ labelText:"Supporting statement", value: poi.supportingStatement, maxLen: 3000, rows: 3, onChange: validate });

                body.appendChild(wrapper);


                // ==========================
                // Nomination quota info
                // ==========================

                const quotaInfo = document.createElement("div");
                quotaInfo.className = "wfmapmods-modal-intro";
                quotaInfo.style.marginTop = "8px";

                function renderQuotaText() {
                    const n = getNominationsAvailableToday();
                    quotaInfo.textContent = `You have ${n} ${n === 1 ? "nomination" : "nominations"} available today.`;
                }

                renderQuotaText();
                body.appendChild(quotaInfo);

                // Refresh in background; only update if changed
                updateAvailability({ force: true }).then(() => {
                    const newText = `You have ${getNominationsAvailableToday()} ${
                    getNominationsAvailableToday() === 1 ? "nomination" : "nominations"
                    } available today.`;

                    if (quotaInfo.textContent !== newText) {
                        quotaInfo.textContent = newText;
                    }
                }).catch(() => {});

                // ==========================
                // Submit Validation
                // ==========================
                function setOkButtonState(enabled) {
                    const backdrop = document.getElementById("wfmapmods-submission-edit");
                    if (!backdrop) return;

                    const ok = backdrop.querySelector(".wfmapmods-modal-btn-primary");
                    if (!ok) return;

                    ok.disabled = !enabled;
                    ok.classList.toggle("wfmapmods-btn-disabled", !enabled);
                }

                function showWarning(msg) {
                    distanceWarning.textContent = msg || "";
                    distanceWarning.classList.toggle("is-visible", !!msg);
                }

                function validate() {
                    const t = titleInput.value.trim();
                    const d = descInput.value.trim();

                    const textValid = !!t && !!d;

                    // --- Image validity ---
                    const mainReady = !!imageState.main && !imageState.main._pending;
                    const supportingCount = imageState.supporting.length;
                    const hasPendingSupporting = imageState.supporting.some(img => img && img._pending);

                    const imageValid =
                          mainReady &&
                          supportingCount >= 1 &&
                          supportingCount <= 5 &&
                          !hasPendingSupporting;


                    // --- Figure out the marker location ---
                    let markerLat = null;
                    let markerLng = null;

                    if (
                        submitData.poi &&
                        typeof submitData.poi.lat === "number" && Number.isFinite(submitData.poi.lat) &&
                        typeof submitData.poi.lng === "number" && Number.isFinite(submitData.poi.lng)
                    ) {
                        markerLat = submitData.poi.lat;
                        markerLng = submitData.poi.lng;
                    } else if (
                        typeof currentLat === "number" && Number.isFinite(currentLat) &&
                        typeof currentLng === "number" && Number.isFinite(currentLng)
                    ) {
                        // Fallback to initial snapshot if poi hasn't got coords for some reason
                        markerLat = currentLat;
                        markerLng = currentLng;
                    }

                    // --- Distance validity (submitterLocation vs marker) ---
                    let distanceValid = true;
                    let distanceKm = null;

                    if (!hasSubmitterLocation()) {
                        distanceValid = false;
                        showWarning("Submission disabled: waiting for your device location (check browser permissions).");
                    } else if (markerLat != null && markerLng != null) {
                        const dMeters = distanceMeters(
                            submitterLocation.lat,
                            submitterLocation.lng,
                            markerLat,
                            markerLng
                        );
                        distanceKm = dMeters / 1000;

                        if (dMeters > submitRadius) {
                            distanceValid = false;
                            distanceValid = false;
                            showWarning(`Submission disabled: The submission pin is ${distanceKm.toFixed(1)} km from your current location (max ${(submitRadius/1000).toFixed(1)} km).`);
                        } else {
                            showWarning("");
                        }
                    }

                    const valid = textValid && imageValid && distanceValid;
                    setOkButtonState(valid);
                }

                setTimeout(validate, 0);

                // Add Save Draft button into footer
                setTimeout(() => {
                    const backdrop = document.getElementById("wfmapmods-submission-edit");
                    if (!backdrop) return;
                    const footer = backdrop.querySelector(".wfmapmods-modal-footer");
                    if (!footer) return;

                    // Save draft button
                    if (!footer.querySelector(".wfmapmods-btn-save-draft")) {
                        const saveBtn = document.createElement("button");
                        saveBtn.type = "button";
                        saveBtn.textContent = "Save draft";
                        saveBtn.className = "wfmapmods-modal-btn wfmapmods-btn-save-draft";

                        footer.insertBefore(saveBtn, footer.firstChild);

                        saveBtn.addEventListener("click", async () => {
                            const title = titleInput.value.trim();
                            const description = descInput.value.trim();
                            const supportingStatement = suppInput.value.trim();

                            let lat = null;
                            let lng = null;

                            if (
                                submitData.poi &&
                                typeof submitData.poi.lat === "number" && Number.isFinite(submitData.poi.lat) &&
                                typeof submitData.poi.lng === "number" && Number.isFinite(submitData.poi.lng)
                            ) {
                                lat = submitData.poi.lat;
                                lng = submitData.poi.lng;
                            } else if (
                                typeof currentLat === "number" && Number.isFinite(currentLat) &&
                                typeof currentLng === "number" && Number.isFinite(currentLng)
                            ) {
                                // Fallback to initial snapshot if poi didn’t get updated for some reason
                                lat = currentLat;
                                lng = currentLng;
                            }

                            if (
                                typeof lat !== "number" || typeof lng !== "number" ||
                                !Number.isFinite(lat) || !Number.isFinite(lng)
                            ) {
                                alert("Cannot save draft: submission is missing a valid location.");
                                return;
                            }

                            const now = Date.now();
                            const draftId = submitData.draftId ||
                                  ("draft-" + now + "-" + Math.random().toString(36).slice(2));

                            submitData.draftId = draftId;

                            const draft = {
                                id: draftId,
                                createdAt: submitData.createdAt || now,
                                updatedAt: now,
                                poi: {
                                    lat,
                                    lng,
                                    title,
                                    description,
                                    supportingStatement
                                },
                                images: {
                                    main: imageState.main || null,
                                    supporting: imageState.supporting.slice()
                                }
                            };

                            await saveDraftSubmissionToIDB(draft);
                            closeModal();
                        });

                    }

                    // Delete draft button (only if opened from a draft)
                    if (submitData.fromDraft && submitData.draftId && !footer.querySelector(".wfmapmods-btn-delete-draft")) {
                        const deleteBtn = document.createElement("button");
                        deleteBtn.type = "button";
                        deleteBtn.textContent = "Delete draft";
                        deleteBtn.className = "wfmapmods-modal-btn wfmapmods-btn-delete-draft";

                        // Place Delete Draft to the left of Save Draft (if present),
                        // or as first child otherwise
                        const firstButton = footer.firstChild;
                        footer.insertBefore(deleteBtn, firstButton || null);

                        deleteBtn.addEventListener("click", async () => {
                            const confirmed = window.confirm("Delete this draft submission?");
                            if (!confirmed) return;

                            await deleteDraftSubmissionFromIDB(submitData.draftId);
                            closeModal();
                        });
                    }
                }, 0);

                // At the end of buildContent you still return ctx as before:
                return {
                    submitData,
                    titleInput,
                    descInput,
                    suppInput,
                    imageState
                };
            },
            onOk(ctx, closeModal) {
                const title = ctx.titleInput.value.trim();
                const description = ctx.descInput.value.trim();
                const supportingStatement = ctx.suppInput.value.trim();

                if (!title || !description) {
                    return;
                }

                const hasMain = !!ctx.imageState.main;
                const supportingCount = ctx.imageState.supporting.length;
                if (!hasMain || supportingCount < 1 || supportingCount > 5) {
                    return;
                }

                const merged = Object.assign({}, ctx.submitData);

                merged.poi = Object.assign({}, merged.poi, {
                    title,
                    description,
                    supportingStatement
                });

                merged.images = {
                    main: ctx.imageState.main,
                    supporting: ctx.imageState.supporting
                };

                submitWayspotViaApi(merged, { draftIdToDelete: merged.draftId });
                closeModal();
            }
        });
    }

    function startDesktopLocationChange(backdrop, submitData, locationValue, validate, startLat, startLng) {
        // Turn on the submission pin button on mapview mode
        if (submissionPinButton) {
            const isActive = submissionPinButton.classList.contains(WF_TOGGLE_ACTIVE_CLASS);
            if (!isActive) {
                wfExclusiveToggle(submissionPinButton, WF_TOGGLE_GROUP);
                syncSubmissionPinEnabledFromDom();
                // Need to ensure this is cleared otherwise modal might re-open immediately
                window.currentLat = null;
                window.currentLng = null;
            }
        }

        const epsilon = 1e-7;
        const intervalMs = 400;

        const timerId = window.setInterval(() => {
            const modalStillExists = document.getElementById("wfmapmods-submission-edit");
            if (!modalStillExists) {
                // Modal was closed; stop watching.
                window.clearInterval(timerId);
                return;
            }

            const newLat = window.currentLat;
            const newLng = window.currentLng;

            if (typeof newLat !== "number" || typeof newLng !== "number") {
                return;
            }

            const changed =
                  typeof startLat !== "number" ||
                  typeof startLng !== "number" ||
                  Math.abs(newLat - startLat) > epsilon ||
                  Math.abs(newLng - startLng) > epsilon;

            if (changed) {
                window.clearInterval(timerId);

                // Update submitData + local variables used for display
                submitData.poi = submitData.poi || {};
                submitData.poi.lat = newLat;
                submitData.poi.lng = newLng;

                window.currentLat = newLat;
                window.currentLng = newLng;
                locationValue.textContent = wfmapmodsFormatLatLng(newLat, newLng);

                // Show modal again
                backdrop.style.display = "";

                validate();
            }
        }, intervalMs);
    }

    function startMobileLocationChange(backdrop, submitData, locationValue, validate) {
        if (!wfMap || typeof google === "undefined" || !google.maps) {
            backdrop.style.display = "";
            return;
        }

        const mapDiv = wfMap.getDiv();
        if (!mapDiv) {
            backdrop.style.display = "";
            return;
        }

        // Hide the side panel so we can see the map
        sidePanelCollapsed = true;
        applySidePanelCollapseState();

        // Remove any existing bar (defensive)
        const existing = document.getElementById("wfmapmods-confirm-location-bar");
        if (existing) existing.remove();

        const bar = document.createElement("div");
        bar.id = "wfmapmods-confirm-location-bar";
        bar.className = "wfmapmods-confirmbar";

        const label = document.createElement("span");
        label.className = "wfmapmods-confirmbar__label";
        label.textContent = "Move the map, then tap Confirm location.";

        const cancelBtn = document.createElement("button");
        cancelBtn.type = "button";
        cancelBtn.className = "wfmapmods-modal-btn wfmapmods-confirmbar__btn wfmapmods-confirmbar__btn--cancel";
        cancelBtn.textContent = "Cancel";

        const confirmBtn = document.createElement("button");
        confirmBtn.type = "button";
        confirmBtn.className = "wfmapmods-modal-btn wfmapmods-modal-btn-primary wfmapmods-confirmbar__btn wfmapmods-confirmbar__btn--confirm";
        confirmBtn.textContent = "Confirm";

        bar.appendChild(label);
        bar.appendChild(cancelBtn);
        bar.appendChild(confirmBtn);
        mapDiv.appendChild(bar);

        const cleanup = () => {
            const b = document.getElementById("wfmapmods-confirm-location-bar");
            if (b) b.remove();
        };

        cancelBtn.addEventListener("click", () => {
            cleanup();
            backdrop.style.display = "";
        });

        confirmBtn.addEventListener("click", () => {
            const modalStillExists = document.getElementById("wfmapmods-submission-edit");
            if (!modalStillExists) {
                cleanup();
                return;
            }

            const newLat = window.currentLat;
            const newLng = window.currentLng;

            if (typeof newLat === "number" && typeof newLng === "number") {
                submitData.poi = submitData.poi || {};
                submitData.poi.lat = newLat;
                submitData.poi.lng = newLng;

                window.currentLat = newLat;
                window.currentLng = newLng;
                locationValue.textContent = wfmapmodsFormatLatLng(newLat, newLng);
            }

            cleanup();
            backdrop.style.display = "";
            validate();
        });
    }

    // ================================================
    // Universal Image Conversion: HEIC/PNG/WebP → JPEG
    // ================================================

    function isHeic(file) {
        const type = (file.type || "").toLowerCase();
        const name = (file.name || "").toLowerCase();
        return (
            type === "image/heic" ||
            type === "image/heif" ||
            name.endsWith(".heic") ||
            name.endsWith(".heif")
        );
    }

    function isConvertibleFormat(file) {
        const type = (file.type || "").toLowerCase();
        return (
            isHeic(file) ||
            type === "image/png" ||
            type === "image/webp" ||
            type === "image/jpeg" ||
            type === "image/jpg"
        );
    }

    function blobToDataURL(blob) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = () => reject(new Error("Failed to read blob as dataURL."));
            reader.readAsDataURL(blob);
        });
    }

    function fileToDataURL(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = () => reject(new Error("Failed to read file as dataURL."));
            reader.readAsDataURL(file);
        });
    }

    function getHeicToLib() {
        // IIFE build defines a global function `HeicTo` with helpers like `HeicTo.isHeic`.
        const lib = (typeof HeicTo !== "undefined" && HeicTo)
        || (typeof unsafeWindow !== "undefined" && unsafeWindow.HeicTo);

        if (!lib) throw new Error("HeicTo library missing (did @require load?)");
        return lib;
    }

    /**
     * Convert any image File → JPEG Blob + JPEG dataURL
     * HEIC → JPEG (heic2any)
     * PNG/WebP → JPEG (canvas)
     * JPEG → JPEG (no conversion)
     */
    async function convertFileToJpeg(file) {
        if (!file) throw new Error("No file provided.");

        if (!isConvertibleFormat(file)) {
            throw new Error("Unsupported image format. Please use JPG/PNG/WebP/HEIC.");
        }

        const type = (file.type || "").toLowerCase();

        // ================================
        // 1. HEIC / HEIF → JPEG (heic-to)
        // ================================
        if (isHeic(file)) {
            const HeicToLib = getHeicToLib();

            // Optional but nice: confirm it's really HEIC using content sniffing
            // (heic-to supports this)
            if (typeof HeicToLib.isHeic === "function") {
                const ok = await HeicToLib.isHeic(file);
                if (!ok) {
                    // Not actually HEIC even though extension/type says it is — fall through
                    // to the canvas path (or throw if you prefer).
                    return await convertViaCanvasToJpeg(file);
                }
            }

            const jpegBlob = await HeicToLib({
                blob: file,
                type: "image/jpeg",
                quality: 0.9
            });

            const dataUrl = await blobToDataURL(jpegBlob);
            return { blob: jpegBlob, dataUrl };
        }


        // ==========================================
        // 2. PNG / WebP → JPEG via canvas conversion
        // ==========================================
        if (type === "image/png" || type === "image/webp") {
            const bitmap = await createImageBitmap(file);

            const canvas = document.createElement("canvas");
            canvas.width = bitmap.width;
            canvas.height = bitmap.height;

            const ctx = canvas.getContext("2d");
            ctx.drawImage(bitmap, 0, 0);

            const jpegBlob = await new Promise((resolve) =>
                                               canvas.toBlob(resolve, "image/jpeg", 0.9)
                                              );

            const dataUrl = await blobToDataURL(jpegBlob);
            return { blob: jpegBlob, dataUrl };
        }

        // ===============================
        // 3. JPEG → JPEG (no conversion)
        // ===============================
        if (type === "image/jpeg" || type === "image/jpg") {
            const dataUrl = await fileToDataURL(file);
            return { blob: file, dataUrl };
        }

        throw new Error("Unhandled file format.");
    }

    // ======================================
    // Draft submissions
    // ======================================
    let draftSubmissions = [];
    let draftMarkers = [];

    // Opens an IDB database connection for wayfarer-tools-db, ensuring DRAFT_STORE_NAME exists.
    function getDraftsIDBInstance(version) {
        return new Promise((resolve, reject) => {
            if (!window.indexedDB) {
                reject("This browser doesn't support IndexedDB!");
                return;
            }

            const openRequest = indexedDB.open(DB_NAME, version);

            openRequest.onsuccess = (event) => {
                const db = event.target.result;
                const dbVer = db.version;
                if (!db.objectStoreNames.contains(DRAFT_STORE_NAME)) {
                    db.close();
                    // Bump version and create store
                    getDraftsIDBInstance(dbVer + 1).then(resolve, reject);
                } else {
                    resolve(db);
                }
            };

            openRequest.onupgradeneeded = (event) => {
                const db = event.target.result;
                if (!db.objectStoreNames.contains(DRAFT_STORE_NAME)) {
                    db.createObjectStore(DRAFT_STORE_NAME, { keyPath: "id" });
                }
            };

            openRequest.onerror = (event) => {
                reject(event.target.error || "Failed to open IndexedDB for drafts");
            };
        });
    }

    // Load draft metadata - no images
    function toDraftMeta(draft) {
        if (!draft) return null;
        const poi = draft.poi || {};
        return {
            id: draft.id,
            createdAt: draft.createdAt,
            poi: {
                lat: poi.lat,
                lng: poi.lng,
                title: poi.title,
                description: poi.description,
                supportingStatement: poi.supportingStatement
            }
        };
    }

    // Load all draft submissions into memory (META ONLY) + markers
    function loadDraftSubmissionsFromIDB() {
        getDraftsIDBInstance().then(db => {
            const tx = db.transaction(DRAFT_STORE_NAME, "readonly");
            const store = tx.objectStore(DRAFT_STORE_NAME);

            const result = [];
            const req = store.openCursor();

            req.onsuccess = (e) => {
                const cursor = e.target.result;
                if (!cursor) {
                    draftSubmissions = result;
                    db.close();
                    refreshDraftMarkers();
                    return;
                }

                // cursor.value includes images, but we do NOT retain them:
                const meta = toDraftMeta(cursor.value);
                if (meta) result.push(meta);

                cursor.continue();
            };

            req.onerror = () => {
                console.warn("[Base] Failed to cursor drafts from IndexedDB", req.error);
                db.close();
            };
        }).catch(err => {
            console.warn("[Base] IndexedDB not available (load drafts):", err);
        });
    }

    function loadDraftByIdFromIDB(id) {
        if (!id) return Promise.resolve(null);

        return getDraftsIDBInstance().then(db => new Promise((resolve) => {
            const tx = db.transaction(DRAFT_STORE_NAME, "readonly");
            const store = tx.objectStore(DRAFT_STORE_NAME);
            const req = store.get(id);

            req.onsuccess = () => { db.close(); resolve(req.result || null); };
            req.onerror   = () => {
                console.warn("[Base] Failed to load draft by id", req.error);
                db.close();
                resolve(null);
            };
        }));
    }

    // Upsert a single draft submission
    function saveDraftSubmissionToIDB(draft) {
        if (!draft || !draft.id) return Promise.resolve();

        return getDraftsIDBInstance().then(db => new Promise((resolve, reject) => {
            const tx = db.transaction(DRAFT_STORE_NAME, "readwrite");
            const store = tx.objectStore(DRAFT_STORE_NAME);

            const req = store.put(draft); // upsert by keyPath 'id'

            req.onsuccess = () => {
                // Update in-memory copy too
                const idx = draftSubmissions.findIndex(d => d.id === draft.id);
                if (idx >= 0) {
                    draftSubmissions[idx] = draft;
                } else {
                    draftSubmissions.push(draft);
                }
            };

            req.onerror = () => {
                console.warn("[Base] Failed to save draft submission", req.error);
            };

            tx.oncomplete = () => {
                db.close();
                refreshDraftMarkers();
                resolve();
            };

            tx.onerror = () => {
                console.warn("[Base] Transaction error while saving draft submission", tx.error);
                db.close();
                reject(tx.error);
            };
        })).catch(err => {
            console.warn("[Base] IndexedDB not available (save draft):", err);
        });
    }

    // Delete a draft by id
    function deleteDraftSubmissionFromIDB(id) {
        if (!id) return Promise.resolve();

        return getDraftsIDBInstance().then(db => new Promise((resolve, reject) => {
            const tx = db.transaction(DRAFT_STORE_NAME, "readwrite");
            const store = tx.objectStore(DRAFT_STORE_NAME);

            const req = store.delete(id);

            req.onsuccess = () => {
                draftSubmissions = draftSubmissions.filter(d => d.id !== id);
            };

            req.onerror = () => {
                console.warn("[Base] Failed to delete draft submission", req.error);
            };

            tx.oncomplete = () => {
                db.close();
                refreshDraftMarkers();
                resolve();
            };

            tx.onerror = () => {
                console.warn("[Base] Transaction error while deleting draft submission", tx.error);
                db.close();
                reject(tx.error);
            };
        })).catch(err => {
            console.warn("[Base] IndexedDB not available (delete draft):", err);
        });
    }

    function refreshDraftMarkers() {
        if (!wfMap || typeof google === "undefined" || !google.maps) return;

        // Clear old markers
        draftMarkers.forEach(m => {
            if (m && typeof m.setMap === "function") {
                m.setMap(null);
            }
        });
        draftMarkers = [];

        draftSubmissions.forEach(draft => {
            const poi = draft.poi || {};
            const lat = poi.lat;
            const lng = poi.lng;
            if (typeof lat !== "number" || typeof lng !== "number" || !Number.isFinite(lat) || !Number.isFinite(lng)) {
                return;
            }

            const position = new google.maps.LatLng(lat, lng);

            const marker = new google.maps.Marker({
                position,
                map: wfMap,
                title: poi.title || "Draft nomination",
                optimized: false
                // icon: "data:image/svg+xml;base64,...."
            });

            marker.setVisible(isDraftLayerEnabled());

            marker.addListener("click", () => {
                if (wfMap) wfMap.setCenter(position);

                if (google?.maps && wfMap) {
                    google.maps.event.trigger(wfMap, "click", { latLng: position });
                }

                loadDraftByIdFromIDB(draft.id).then(fullDraft => {
                    const images = fullDraft?.images || {};

                    openSubmissionEditModal({
                        poi: {
                            lat,
                            lng,
                            title: poi.title || "",
                            description: poi.description || "",
                            supportingStatement: poi.supportingStatement || ""
                        },
                        images,
                        draftId: draft.id,
                        createdAt: draft.createdAt,
                        fromDraft: true
                    });
                });
            });

            draftMarkers.push(marker);
        });
    }

    // =========================================
    // Drafts from native "New Submission" form
    // =========================================

    function wfmapmodsBuildDraftFromNativeSubmitForm() {
        const container = document.querySelector("app-submit-wayspot .submit-wayspot-container");
        if (!container) {
            alert("Cannot save draft: submission form not found.");
            return null;
        }

        // --- Text fields ---
        const titleEl = container.querySelector("textarea#title");
        const descEl = container.querySelector("textarea#description");
        const suppEl = container.querySelector("textarea#supportingStatement");

        const title = titleEl ? titleEl.value.trim() : "";
        const description = descEl ? descEl.value.trim() : "";
        const supportingStatement = suppEl ? suppEl.value.trim() : "";

        // --- Location: use window.currentLat/Lng as requested ---
        let lat = (typeof window.currentLat === "number" && Number.isFinite(window.currentLat))
        ? window.currentLat
        : null;
        let lng = (typeof window.currentLng === "number" && Number.isFinite(window.currentLng))
        ? window.currentLng
        : null;

        if (
            typeof lat !== "number" || typeof lng !== "number" ||
            !Number.isFinite(lat) || !Number.isFinite(lng)
        ) {
            alert("Cannot save draft: missing valid map location (currentLat/currentLng).");
            return null;
        }

        // --- Main photo (step 1) ---
        // In the "after upload" state there's .image-container img
        let mainImgObj = null;
        const mainImgEl = container.querySelector(
            ".submit-wayspot-section:nth-of-type(1) app-wayspot-image-entry .image-container img"
        );

        if (mainImgEl && mainImgEl.src && mainImgEl.src.startsWith("data:image/")) {
            mainImgObj = {
                sourceType: "dataUrl",
                url: mainImgEl.src,
                file: null
            };
        }

        // --- Supporting photos (step 2) ---
        const supportingImgEls = container.querySelectorAll(
            ".submit-wayspot-section:nth-of-type(2) .submit-supporting-images-container .supporting-image-container img"
        );

        const supportingImages = [];
        supportingImgEls.forEach((img) => {
            if (!img || !img.src || !img.src.startsWith("data:image/")) return;
            supportingImages.push({
                sourceType: "dataUrl",
                url: img.src,
                file: null
            });
        });

        const now = Date.now();
        const draftId = "native-draft-" + now + "-" + Math.random().toString(36).slice(2);

        const draft = {
            id: draftId,
            createdAt: now,
            updatedAt: now,
            poi: {
                lat,
                lng,
                title,
                description,
                supportingStatement
            },
            images: {
                main: mainImgObj,                 // can be null if they didn’t pick one yet
                supporting: supportingImages      // 0–5 items
            }
        };

        return draft;
    }

    function wfmapmodsInjectNativeSubmitSaveDraftButton() {
        const container = document.querySelector("app-submit-wayspot .submit-wayspot-container");
        if (!container) return;

        const buttonContainer = container.querySelector(".submit-button-container");
        if (!buttonContainer) return;

        // Avoid adding multiple times
        if (buttonContainer.querySelector(".wfmapmods-btn-native-save-draft")) return;

        const saveBtn = document.createElement("button");
        saveBtn.type = "button";
        saveBtn.textContent = "Save draft";
        saveBtn.className = "wf-button wfmapmods-btn-native-save-draft";
        saveBtn.style.marginLeft = "8px";

        saveBtn.addEventListener("click", async () => {
            try {
                const draft = wfmapmodsBuildDraftFromNativeSubmitForm();
                if (!draft) return;

                await saveDraftSubmissionToIDB(draft);
                alert("Draft saved. It will appear as a draft pin on the map.");
            } catch (err) {
                console.error("[Base] Failed to save native form draft:", err);
                alert("Could not save draft – see console for details.");
            }
        });

        // Insert after the native Submit button
        const nativeSubmit = buttonContainer.querySelector("button[type='submit']");
        if (nativeSubmit && nativeSubmit.parentNode === buttonContainer) {
            nativeSubmit.insertAdjacentElement("afterend", saveBtn);
        } else {
            buttonContainer.appendChild(saveBtn);
        }
    }

    // ==============================
    // Report progress bar on the map
    // ==============================

    function wfmapmodsGetOrCreateReportProgressBar() {
        if (!wfMap || typeof wfMap.getDiv !== "function") return null;

        const mapDiv = wfMap.getDiv();
        if (!mapDiv) return null;

        if (!mapDiv.style.position) mapDiv.style.position = "relative";

        let bar = mapDiv.querySelector("#wfmapmods-report-progress");
        if (bar) return bar;

        bar = document.createElement("div");
        bar.id = "wfmapmods-report-progress";
        bar.className = "is-hidden";
        bar.innerHTML = `
      <div class="wfmapmods-progress-inner">
        <div class="wfmapmods-progress-text">Preparing report…</div>
        <div class="wfmapmods-progress-track">
          <div class="wfmapmods-progress-fill"></div>
        </div>
      </div>
    `;

        bar._textEl = bar.querySelector(".wfmapmods-progress-text");
        bar._fillEl = bar.querySelector(".wfmapmods-progress-fill");

        mapDiv.appendChild(bar);
        return bar;
    }

    function wfmapmodsSetReportProgress(text, percent, show = true) {
        const bar = wfmapmodsGetOrCreateReportProgressBar();
        if (!bar) return;

        bar.classList.toggle("is-hidden", !show);

        if (typeof text === "string" && bar._textEl) bar._textEl.textContent = text;

        if (typeof percent === "number" && bar._fillEl) {
            const clamped = Math.max(0, Math.min(100, percent));
            bar._fillEl.style.setProperty("--wfmapmods-progress", clamped + "%");
        }
    }

    function wfmapmodsHideReportProgress(delayMs) {
        const mapDiv = wfMap?.getDiv?.();
        const bar = mapDiv ? mapDiv.querySelector("#wfmapmods-report-progress") : null;
        if (!bar) return;

        const hide = () => bar.classList.add("is-hidden");
        if (typeof delayMs === "number" && delayMs > 0) setTimeout(hide, delayMs);
        else hide();
    }

    // ==============================
    // Report modal + submit
    // ==============================

    function openPoiReportModal(poi) {
        const availableReports = getReportsAvailableToday();
        const additionalReports = getReportsAvailableTomorrow();

        const REASONS = [
            { label: "Unsafe access",                 value: "UNSAFE" },
            { label: "Sensitive location",            value: "SENSITIVE" },
            { label: "Location does not exist",       value: "LOCATION_DOES_NOT_EXIST" },
            { label: "Abusive content",               value: "ABUSE" },
            { label: "Private residential property",  value: "PRIVATE_RESIDENTIAL_PROPERTY" },
            { label: "School (K-12)",                 value: "SCHOOL" },
            { label: "Duplicate Wayspot",             value: "DUPLICATE" }
        ];

        // Create a quick lookup so we can store the human label too
        const reasonLabelByValue = Object.fromEntries(REASONS.map(r => [r.value, r.label]));

        openModal({
            id: "wfmapmods-poi-report",
            title: "Report Wayspot",
            width: 320,
            buildContent(dialog, okBtn, closeModal) {
                // Intro
                const intro = document.createElement("div");
                intro.className = "wfmapmods-modal-intro";
                intro.textContent = "What's the reason for reporting this Wayspot?";
                dialog.appendChild(intro);

                // Reasons (radio)
                const reasonsWrap = document.createElement("div");
                reasonsWrap.className = "wfmapmods-modal-section";

                const groupName = "wfmapmods-report-reason";

                REASONS.forEach((r) => {
                    const row = document.createElement("label");
                    row.style.display = "flex";
                    row.style.alignItems = "center";
                    row.style.gap = "8px";
                    row.style.fontSize = "12px";
                    row.style.margin = "4px 0";
                    row.style.cursor = "pointer";

                    const radio = document.createElement("input");
                    radio.type = "radio";
                    radio.name = groupName;
                    radio.value = r.value;

                    const text = document.createElement("span");
                    text.textContent = r.label;

                    row.appendChild(radio);
                    row.appendChild(text);
                    reasonsWrap.appendChild(row);
                });

                dialog.appendChild(reasonsWrap);

                // Supporting statement
                const statementHeader = document.createElement("div");
                statementHeader.className = "wfmapmods-modal-section-header";
                statementHeader.textContent = "Supporting statement (optional)";
                dialog.appendChild(statementHeader);

                const textarea = document.createElement("textarea");
                textarea.className = "wfmapmods-modal-textarea";
                textarea.maxLength = 3000;
                textarea.placeholder =
                    "Add any additional information relevant to the report.";
                textarea.rows = 4;
                textarea.style.minHeight = "unset";
                textarea.style.height = "auto";

                dialog.appendChild(textarea);

                // Counter
                const counter = document.createElement("div");
                counter.className = "wfmapmods-submit-counter"; // reuse existing small counter styling
                counter.textContent = `0 / 3000`;
                dialog.appendChild(counter);

                textarea.addEventListener("input", () => {
                    counter.textContent = `${textarea.value.length} / 3000`;
                });

                // Quota text (placeholders you said you'll finalize later)
                const quota = document.createElement("div");
                quota.className = "wfmapmods-modal-intro";
                quota.style.marginTop = "8px";
                quota.innerHTML =
                    `You have ${availableReports} ${availableReports === 1 ? "report" : "reports"} available today.<br>` +
                    `You will have ${additionalReports} ${additionalReports === 1 ? "report" : "reports"} available tomorrow.`;
                dialog.appendChild(quota);

                return { poi, textarea, groupName, reasonLabelByValue };
            },
            onOk(ctx, closeModal) {
                const { poi, textarea, groupName, reasonLabelByValue } = ctx || {};
                if (!poi || !poi.guid) {
                    alert("No Wayspot selected.");
                    return;
                }

                // Read selected reason
                const checked = document.querySelector(`input[name="${groupName}"]:checked`);
                const reasonCode = checked ? checked.value : null;

                if (!reasonCode) {
                    alert("Please select a reason.");
                    return;
                }

                const reasonText = reasonLabelByValue ? reasonLabelByValue[reasonCode] : null;
                const comment = (textarea?.value || "").trim();

                closeModal();

                // Pass POI + both code/text to the API submit
                submitPoiReportViaApi({ poi, reasonCode, reasonText, comment });
            }
        });
    }

    async function submitPoiReportViaApi({ poi, reasonCode, reasonText, comment }) {
        wfmapmodsSetReportProgress("Submitting report…", 20, true);

        const poiId = poi?.guid; // you said "guid <-- this is the poi.guid"
        if (!poiId) {
            wfmapmodsSetReportProgress("Report failed (missing Wayspot guid).", 100, true);
            wfmapmodsHideReportProgress(3000);
            return;
        }

        const payload = {
            comment: comment || "",
            poiId: poiId,
            reason: reasonCode
        };

        try {
            wfmapmodsSetReportProgress("Contacting Wayfarer…", 55, true);

            const resp = await postJsonWithCsrf("/api/v1/vault/mapview/poi-report", payload);

            // Fail fast on empty/captcha/non-success
            if (!resp || resp.captcha || !isPoiReportApiSuccess(resp)) {
                wfmapmodsSetReportProgress("Report failed (captcha or unsuccessful response).", 100, true);
                wfmapmodsHideReportProgress(2500);
                updateAvailability({ force: true });
                return;
            }

            // SUCCESS -> write to reportedWayspots
            const timestampMs = Date.now();

            const rec = buildTicketRecordFromWayfarerMapApi({
                poi,
                reasonCode,
                reasonText,
                supportingText: comment || "",
                timestampMs
            });

            // Save (best-effort; do not block UX on failure)
            saveReportedWayspotToIDB(rec).then(ok => {
                if (ok) {
                    console.log("[Base] Saved wayfarer-map report record:", rec);
                } else {
                    console.warn("[Base] Failed to save wayfarer-map report record (collision or IDB error).", rec);
                }
            });

            wfmapmodsSetReportProgress("Report submitted!", 100, true);
            wfmapmodsHideReportProgress(1500);
            updateAvailability({ force: true });

        } catch (err) {
            console.error("Wayfarer Map: submitPoiReportViaApi failed:", err);
            wfmapmodsSetReportProgress("Report failed (see console).", 100, true);
            wfmapmodsHideReportProgress(3000);
            updateAvailability({ force: true });
        }
    }

    // ======================================================================
    // Report history store (Wayfarer-side) - replicated from plugin #2
    // ======================================================================

    // Optional but recommended for future queries/sorting by mechanism+timestamp
    const REPORTED_IDX_MECH_TS = "byMechanismTimestamp";

    /**
     * Open wayfarer-tools-db ensuring REPORTED_STORE_NAME exists.
     * Creates an index on ["reportMechanism","timestampMs"] (non-unique).
     */
    function getReportedWayspotsIDBInstance(version) {
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

                // If store missing, bump version and create it.
                if (!db.objectStoreNames.contains(REPORTED_STORE_NAME)) {
                    const currentVersion = db.version;
                    db.close();
                    getReportedWayspotsIDBInstance(currentVersion + 1).then(resolve, reject);
                    return;
                }

                resolve(db);
            };

            openRequest.onupgradeneeded = (event) => {
                const db = event.target.result;

                let store;
                if (!db.objectStoreNames.contains(REPORTED_STORE_NAME)) {
                    store = db.createObjectStore(REPORTED_STORE_NAME, { keyPath: "id" });
                } else {
                    store = event.target.transaction.objectStore(REPORTED_STORE_NAME);
                }

                // Create index (safe to call only if missing)
                if (!store.indexNames.contains(REPORTED_IDX_MECH_TS)) {
                    store.createIndex(REPORTED_IDX_MECH_TS, ["reportMechanism", "timestampMs"], { unique: false });
                }
            };

            openRequest.onerror = (event) => {
                reject(event.target.error || new Error("Failed to open IndexedDB"));
            };
        });
    }

    /**
     * Same ID format as plugin #2 for compatibility.
     */
    function makeReportId(timestampMs = Date.now()) {
        const t = Number(timestampMs || Date.now());
        const timePart = t.toString(36).padStart(10, "0");
        const randPart = Math.random().toString(36).slice(2, 12);
        return `rpt_${timePart}_${randPart}`;
    }

    /**
     * Save a single report record. Uses add() so duplicates won't overwrite.
     * Returns Promise<boolean> -> true if saved, false if collision/failure.
     */
    function saveReportedWayspotToIDB(rec) {
        if (!rec || typeof rec.timestampMs !== "number" || !Number.isFinite(rec.timestampMs)) {
            console.warn("[Base] Refusing to save report record: missing/invalid timestampMs", rec);
            return Promise.resolve(false);
        }

        if (!rec.id || typeof rec.id !== "string") {
            console.warn("[Base] Refusing to save report record: missing id", rec);
            return Promise.resolve(false);
        }

        return getReportedWayspotsIDBInstance().then(db => new Promise((resolve) => {
            const tx = db.transaction(REPORTED_STORE_NAME, "readwrite");
            const store = tx.objectStore(REPORTED_STORE_NAME);

            const req = store.add(rec); // add() fails on duplicate id

            req.onerror = () => {
                console.warn("[Base] Collision: report record not saved because id already exists:", rec.id, req.error, rec);
                // tx aborts -> handled below
            };

            tx.oncomplete = () => {
                db.close();
                resolve(true);
            };

            tx.onabort = () => {
                db.close();
                resolve(false);
            };

            tx.onerror = () => {
                db.close();
                resolve(false);
            };
        })).catch(err => {
            console.warn("[Base] IndexedDB not available (save reported wayspot):", err);
            return false;
        });
    }

    /**
     * Build the record format compatible with plugin #2, using "wayfarer-map".
     * ticket is null because the API mechanism doesn't return it.
     */
    function buildTicketRecordFromWayfarerMapApi({ poi, reasonCode, reasonText, supportingText, timestampMs }) {
        const wp = poi || {};
        const guid  = (typeof wp.guid === "string" && wp.guid.trim()) ? wp.guid.trim() : null;
        const title = (typeof wp.title === "string" && wp.title.trim()) ? wp.title.trim() : null;

        const lat = (typeof wp.lat === "number" && Number.isFinite(wp.lat)) ? wp.lat : null;
        const lng = (typeof wp.lng === "number" && Number.isFinite(wp.lng)) ? wp.lng : null;

        return {
            // Primary Key - Unique ID
            id: makeReportId(timestampMs),

            // Wayspot being reported
            guid,
            title,
            lat,
            lng,

            // Report metadata
            ticket: null,
            timestampMs,
            reportMechanism: "wayfarer-map",

            removalReasonCode: (typeof reasonCode === "string" && reasonCode.trim()) ? reasonCode.trim() : null,
            removalReasonText: (typeof reasonText === "string" && reasonText.trim()) ? reasonText.trim() : null,
            supportingText: (typeof supportingText === "string" && supportingText.trim()) ? supportingText.trim() : null
        };
    }

    /**
     * Best-effort success check for the /poi-report API response.
     */
    function isPoiReportApiSuccess(resp) {
        // Your sample response:
        // { result: { success: true }, captcha: false, code: "OK", ... }
        return !!(resp && resp.captcha === false && resp.result && resp.result.success === true);
    }

    // ==================================
    // Info Window (Mobile Only)
    // ==================================

    function showPoiInfoWindowForSelection(poi, latLng) {
        if (!wfMap || !poi) return;
        if (currentMapMode !== MAP_MODE.MOBILE) {
            // Only allow InfoWindows in mobile mode
            if (poiInfoWindow) {
                poiInfoWindow.close();
            }
            return;
        }

        if (!poiInfoWindow) {
            poiInfoWindow = new google.maps.InfoWindow();
        }

        poiInfoWindow.setOptions({
            disableAutoPan: true
        });

        poiInfoWindow.setContent(createInfoWindow(poi));

        poiInfoWindow.setPosition(latLng);
        poiInfoWindow.open(wfMap);

        google.maps.event.addListenerOnce(
            poiInfoWindow,
            "domready",
            attachInfoWindowDomHandlers
        );
    }

    function createInfoWindow(poi) {
        const title  = escapeHtml(poi.title);
        const desc   = escapeHtml(poi.description || "");
        const latStr = poi.lat.toFixed(6);
        const lngStr = poi.lng.toFixed(6);

        const iwImgUrl   = poi.imageUrl + "=w240";
        const fullImgUrl = poi.imageUrl + "=s0";

        return `
<div class="agm-info-window-content wfmapmods-iw-root wf-nearby-iw-content">

    <div class="wfmapmods-iw-content">

        <!-- Header -->
        <div class="wfmapmods-iw-header">
            <div class="wfmapmods-iw-title" title="${title}">
                <span
                    class="wfmapmods-iw-copy-title"
                    data-copy="${title.replace(/"/g, '&quot;')}"
                    title="Click to copy title"
                >${title}</span>
            </div>

            <button class="wfmapmods-iw-close" title="Close">×</button>
        </div>

        <!-- Coordinates -->
        <div class="wfmapmods-iw-coords">
            <span
                class="wfmapmods-iw-copy-coords"
                data-lat="${latStr}"
                data-lng="${lngStr}"
                title="Click to copy coordinates of selected Wayspot"
            >
                ${latStr},${lngStr}
            </span>
        </div>

        <!-- Image -->
        <div class="wfmapmods-iw-img-wrapper">
            <a href="${fullImgUrl}" target="_blank" rel="noopener noreferrer" class="wfmapmods-iw-img-link">
                <img src="${iwImgUrl}" alt="${title}" class="wfmapmods-iw-img"/>
            </a>
        </div>

        <!-- Description -->
        <div class="wfmapmods-iw-desc">${desc}</div>

    </div>
</div>`;
    }


    function attachInfoWindowDomHandlers() {
        // ---- Copy Coordinates ----
        const coordEl = document.querySelector(".wfmapmods-iw-copy-coords");
        if (coordEl) {
            coordEl.addEventListener("click", () => {
                copyCoordsToClipboard(coordEl.dataset.lat, coordEl.dataset.lng)
                    .catch(err => console.error("Clipboard copy failed:", err));
            }, { once: true });
        }

        // ---- Copy Title ----
        const titleEl = document.querySelector(".wfmapmods-iw-copy-title");
        if (titleEl) {
            titleEl.addEventListener("click", () => {
                const text = titleEl.getAttribute("data-copy") || "";
                copyTextToClipboard(text)
                    .catch(err => console.error("Clipboard copy failed:", err));
            }, { once: true });
        }

        // ---- Close button ----
        const closeBtn = document.querySelector(".wfmapmods-iw-close");
        if (closeBtn) {
            closeBtn.addEventListener("click", (e) => {
                e.stopPropagation();
                poiInfoWindow.close();
            }, { once: true });
        }
    }

    // ==================================
    // Wayspot Details Overlay
    // ==================================

    function getOverlayImageUrls(poi) {
        const mainUrl = poi?.imageUrl || NIANTIC_PLACEHOLDER_IMAGE_URL;

        const additional = Array.isArray(poi?.additionalImages) ? poi.additionalImages : [];
        const additionalUrls = additional.map(x => x?.imageUrl).filter(Boolean);

        const out = [];
        const seen = new Set();
        for (const u of [mainUrl, ...additionalUrls]) {
            if (!u || seen.has(u)) continue;
            seen.add(u);
            out.push(u);
        }
        return { mainUrl, allUrls: out };
    }

    function createWayspotOverlayDom(poi, mainUrl, allUrls) {
        const backdrop = document.createElement("div");
        backdrop.id = "wfmapmods-wayspot-overlay";
        backdrop.className = "wfmapmods-wayspot-overlay-backdrop";

        const dialog = document.createElement("div");
        dialog.className = "wfmapmods-wayspot-overlay-dialog";

        const header = document.createElement("div");
        header.className = "wfmapmods-wayspot-overlay-header";

        const titleEl = document.createElement("div");
        titleEl.className = "wfmapmods-wayspot-overlay-title";
        titleEl.textContent = poi?.title || "(untitled)";

        const closeBtn = document.createElement("button");
        closeBtn.type = "button";
        closeBtn.className = "wfmapmods-wayspot-overlay-close";
        closeBtn.textContent = "×";
        closeBtn.title = "Close";

        header.appendChild(titleEl);
        header.appendChild(closeBtn);
        dialog.appendChild(header);

        // Carousel only if >1
        let carouselEl = null;
        if (allUrls.length > 1) {
            carouselEl = document.createElement("div");
            carouselEl.className = "wfmapmods-wayspot-overlay-carousel";
            dialog.appendChild(carouselEl);
        }

        const imageWrapper = document.createElement("a");
        imageWrapper.href = mainUrl + "=s0";
        imageWrapper.target = "_blank";
        imageWrapper.rel = "noopener noreferrer";
        imageWrapper.className = "wfmapmods-wayspot-overlay-image-link";

        const imgEl = document.createElement("img");
        imgEl.src = mainUrl;
        imgEl.alt = poi?.title || "";
        imgEl.className = "wfmapmods-wayspot-overlay-image";

        imageWrapper.appendChild(imgEl);

        const descEl = document.createElement("div");
        descEl.className = "wfmapmods-wayspot-overlay-desc";
        descEl.textContent = poi?.description || "";

        dialog.appendChild(imageWrapper);
        dialog.appendChild(descEl);

        backdrop.appendChild(dialog);

        return { backdrop, dialog, closeBtn, carouselEl, imageWrapper, imgEl };
    }

    function setOverlayMainImage(state, url) {
        if (!state || !url) return;

        state.currentMainUrl = url;
        state.imgEl.src = url;
        state.imageWrapper.href = url + "=s0";

        const carouselEl = state.carouselEl;
        if (!carouselEl) return;

        // Toggle an "active" class instead of inline styles
        const thumbs = carouselEl.querySelectorAll('img[data-url]');
        thumbs.forEach(t => {
            t.classList.toggle("is-active", t.getAttribute("data-url") === url);
        });
    }

    function buildOverlayCarousel(state, allUrls) {
        const carouselEl = state.carouselEl;
        if (!carouselEl) return;

        carouselEl.innerHTML = "";

        for (const url of allUrls) {
            const t = document.createElement("img");
            t.src = url;
            t.alt = state.poi?.title || "";
            t.setAttribute("data-url", url);
            t.className = "wfmapmods-wayspot-overlay-thumb";

            t.addEventListener("click", (e) => {
                e.preventDefault();
                e.stopPropagation();
                setOverlayMainImage(state, url);
            });

            carouselEl.appendChild(t);
        }
    }

    function closeWayspotDetailOverlay() {
        const state = wayspotOverlayState;
        if (!state?.backdrop) return;

        try { document.removeEventListener("keydown", state.escHandler); } catch {}
        try { state.backdrop.remove(); } catch {}

        wayspotOverlayState = null;
    }

    function openWayspotDetailOverlay(poi) {
        if (!poi) return;

        closeWayspotDetailOverlay();

        const { mainUrl, allUrls } = getOverlayImageUrls(poi);

        const dom = createWayspotOverlayDom(poi, mainUrl, allUrls);
        document.body.appendChild(dom.backdrop);

        const state = {
            poi,
            backdrop: dom.backdrop,
            carouselEl: dom.carouselEl,
            imageWrapper: dom.imageWrapper,
            imgEl: dom.imgEl,
            currentMainUrl: mainUrl,
            escHandler: null
        };

        if (state.carouselEl) {
            buildOverlayCarousel(state, allUrls);
            setOverlayMainImage(state, state.currentMainUrl);
        }

        dom.closeBtn.addEventListener("click", (e) => {
            e.stopPropagation();
            closeWayspotDetailOverlay();
        });

        state.backdrop.addEventListener("click", (e) => {
            if (e.target === state.backdrop) closeWayspotDetailOverlay();
        });

        state.escHandler = (ev) => {
            if (ev.key === "Escape") closeWayspotDetailOverlay();
        };

        wayspotOverlayState = state;
        document.addEventListener("keydown", state.escHandler);

        // Optional: fetch additional images if needed
        if (
            shouldFetchAdditionalImages(poi) &&
            (!Array.isArray(poi.additionalImages) || poi.additionalImages.length === 0)
        ) {
            const guid = poi.guid;

            fetchPoiImagesForGuid(guid).then((images) => {
                if (wayspotOverlayState?.backdrop !== state.backdrop) return;
                if (!document.body.contains(state.backdrop)) return;

                poi.additionalImages = images;

                const { allUrls } = getOverlayImageUrls(poi);
                if (allUrls.length <= 1) return;

                closeWayspotDetailOverlay();
                openWayspotDetailOverlay(poi);
            });
        }
    }

    // ==================================
    // Settings menus
    // ==================================

    function openMapOptionsWindow() {
        const mapCfg = userSettings.map;

        openModal({
            id: "wfmapmods-mapopt-backdrop",
            title: "Map options",
            buildContent(dialog) {
                // ---- General behaviour ----
                const generalSection = document.createElement("div");
                generalSection.className = "wfmapmods-modal-section";

                const generalHeader = document.createElement("div");
                generalHeader.className = "wfmapmods-modal-section-header";
                generalHeader.textContent = "General behaviour";
                generalSection.appendChild(generalHeader);

                const rememberChk = document.createElement("input");
                rememberChk.type = "checkbox";
                rememberChk.className = "wfmapmods-modal-checkbox";
                rememberChk.checked = !!mapCfg.rememberLastView;
                generalSection.appendChild(
                    createSettingsRow("Remember last map location", rememberChk, {
                        narrowLabel: true
                    })
                );

                dialog.appendChild(generalSection);

                // ---- Circle configs (init from mapCfg) ----
                const nr = mapCfg.nearbyRadius;
                const sr = mapCfg.submitRadius;
                const spr = mapCfg.interactRadius;
                const pr = mapCfg.powerSpotRadius;

                // ---- Circle overlays section with table ----
                const circlesSection = document.createElement("div");
                circlesSection.className = "wfmapmods-modal-section";

                const circlesHeader = document.createElement("div");
                circlesHeader.className = "wfmapmods-modal-section-header";
                circlesHeader.textContent = "Circle overlays";
                circlesSection.appendChild(circlesHeader);

                const table = document.createElement("table");
                table.className = "wfmapmods-circle-table";

                function makeTH(text, extraClass) {
                    const th = document.createElement("th");
                    th.textContent = text;
                    if (extraClass) th.className = extraClass;
                    return th;
                }

                function makeTD(extraClass) {
                    const td = document.createElement("td");
                    if (extraClass) td.className = extraClass;
                    return td;
                }

                function styleColorInput(input) {
                    input.className = "wfmapmods-modal-color";
                    input.style.width = "26px";
                    input.style.padding = "0";
                }

                function styleNumericInput(input) {
                    input.className = "wfmapmods-modal-input-small";
                    input.style.textAlign = "center";
                }

                // Header row (columns in order of size)
                // 1) PowerSpot Radius (22m)     – powerSpotRadius
                // 2) Nearby Wayspots (200m)     – nearbyRadius
                // 3) Interaction Radius (80m)   – interactRadius
                // 4) Submission Range (10km)    – submitRadius
                const headerRow = document.createElement("tr");

                const thLabel = makeTH("");
                thLabel.style.textAlign = "left";

                const thPowerSpot = makeTH("Power Spot Radius (22m)");
                const thNearby = makeTH("Nearby Wayspots (200m)");
                const thSelected = makeTH("Interaction Radius (80m)");
                const thSubmit = makeTH(`Submission Range (${submitRadius/1000}km)`);

                headerRow.appendChild(thLabel);
                headerRow.appendChild(thPowerSpot);
                headerRow.appendChild(thNearby);
                headerRow.appendChild(thSelected);
                headerRow.appendChild(thSubmit);
                table.appendChild(headerRow);

                // ---- Row 1: Show / enabled ----
                const rowShow = document.createElement("tr");
                const showLabel = document.createElement("td");
                showLabel.textContent = "Show circle";
                showLabel.style.padding = "2px 4px";
                showLabel.style.whiteSpace = "nowrap";
                rowShow.appendChild(showLabel);

                const powerSpotEnabledChk = document.createElement("input");
                powerSpotEnabledChk.type = "checkbox";
                powerSpotEnabledChk.className = "wfmapmods-modal-checkbox";
                powerSpotEnabledChk.checked = !!pr.enabled;

                const nearbyEnabledChk = document.createElement("input");
                nearbyEnabledChk.type = "checkbox";
                nearbyEnabledChk.className = "wfmapmods-modal-checkbox";
                nearbyEnabledChk.checked = !!nr.enabled;

                const selectedEnabledChk = document.createElement("input");
                selectedEnabledChk.type = "checkbox";
                selectedEnabledChk.className = "wfmapmods-modal-checkbox";
                selectedEnabledChk.checked = !!spr.enabled;

                const submitEnabledChk = document.createElement("input");
                submitEnabledChk.type = "checkbox";
                submitEnabledChk.className = "wfmapmods-modal-checkbox";
                submitEnabledChk.checked = !!sr.enabled;

                const tdShowPowerSpot = makeTD();
                const tdShowNearby = makeTD();
                const tdShowSelected = makeTD();
                const tdShowSubmit = makeTD();

                tdShowPowerSpot.appendChild(powerSpotEnabledChk);
                tdShowNearby.appendChild(nearbyEnabledChk);
                tdShowSelected.appendChild(selectedEnabledChk);
                tdShowSubmit.appendChild(submitEnabledChk);

                rowShow.appendChild(tdShowPowerSpot);
                rowShow.appendChild(tdShowNearby);
                rowShow.appendChild(tdShowSelected);
                rowShow.appendChild(tdShowSubmit);
                table.appendChild(rowShow);

                // ---- Row 2: Line colour ----
                const rowLineColor = document.createElement("tr");
                const lineColorLabel = document.createElement("td");
                lineColorLabel.textContent = "Line colour";
                lineColorLabel.style.padding = "2px 4px";
                rowLineColor.appendChild(lineColorLabel);

                const powerSpotStrokeColorInput = document.createElement("input");
                powerSpotStrokeColorInput.type = "color";
                powerSpotStrokeColorInput.value = pr.strokeColor || "#ffffff";
                styleColorInput(powerSpotStrokeColorInput);

                const nearbyStrokeColorInput = document.createElement("input");
                nearbyStrokeColorInput.type = "color";
                nearbyStrokeColorInput.value = nr.strokeColor || "#4285F4";
                styleColorInput(nearbyStrokeColorInput);

                const selectedStrokeColorInput = document.createElement("input");
                selectedStrokeColorInput.type = "color";
                selectedStrokeColorInput.value = spr.strokeColor || "#ff00ff";
                styleColorInput(selectedStrokeColorInput);

                const submitStrokeColorInput = document.createElement("input");
                submitStrokeColorInput.type = "color";
                submitStrokeColorInput.value = sr.strokeColor || "#8b5cf6";
                styleColorInput(submitStrokeColorInput);

                const tdLCPowerSpot = makeTD();
                const tdLCNearby = makeTD();
                const tdLCSelected = makeTD();
                const tdLCSubmit = makeTD();

                tdLCPowerSpot.appendChild(powerSpotStrokeColorInput);
                tdLCNearby.appendChild(nearbyStrokeColorInput);
                tdLCSelected.appendChild(selectedStrokeColorInput);
                tdLCSubmit.appendChild(submitStrokeColorInput);

                rowLineColor.appendChild(tdLCPowerSpot);
                rowLineColor.appendChild(tdLCNearby);
                rowLineColor.appendChild(tdLCSelected);
                rowLineColor.appendChild(tdLCSubmit);
                table.appendChild(rowLineColor);

                // ---- Row 3: Line thickness ----
                const rowLineWidth = document.createElement("tr");
                const lineWidthLabel = document.createElement("td");
                lineWidthLabel.textContent = "Line thickness";
                lineWidthLabel.style.padding = "2px 4px";
                lineWidthLabel.style.whiteSpace = "nowrap";
                rowLineWidth.appendChild(lineWidthLabel);

                const powerSpotStrokeWidthInput = document.createElement("input");
                powerSpotStrokeWidthInput.type = "number";
                powerSpotStrokeWidthInput.min = "0";
                powerSpotStrokeWidthInput.max = "10";
                powerSpotStrokeWidthInput.step = "0.5";
                powerSpotStrokeWidthInput.value = pr.strokeWidth ?? 1.5;
                styleNumericInput(powerSpotStrokeWidthInput);

                const nearbyStrokeWidthInput = document.createElement("input");
                nearbyStrokeWidthInput.type = "number";
                nearbyStrokeWidthInput.min = "0";
                nearbyStrokeWidthInput.max = "10";
                nearbyStrokeWidthInput.step = "0.5";
                nearbyStrokeWidthInput.value = nr.strokeWidth ?? 2;
                styleNumericInput(nearbyStrokeWidthInput);

                const selectedStrokeWidthInput = document.createElement("input");
                selectedStrokeWidthInput.type = "number";
                selectedStrokeWidthInput.min = "0";
                selectedStrokeWidthInput.max = "10";
                selectedStrokeWidthInput.step = "0.5";
                selectedStrokeWidthInput.value = spr.strokeWidth ?? 2;
                styleNumericInput(selectedStrokeWidthInput);

                const submitStrokeWidthInput = document.createElement("input");
                submitStrokeWidthInput.type = "number";
                submitStrokeWidthInput.min = "0";
                submitStrokeWidthInput.max = "10";
                submitStrokeWidthInput.step = "0.5";
                submitStrokeWidthInput.value = sr.strokeWidth ?? 2;
                styleNumericInput(submitStrokeWidthInput);

                const tdLWPowerSpot = makeTD();
                const tdLWNearby = makeTD();
                const tdLWSelected = makeTD();
                const tdLWSubmit = makeTD();

                tdLWPowerSpot.appendChild(powerSpotStrokeWidthInput);
                tdLWNearby.appendChild(nearbyStrokeWidthInput);
                tdLWSelected.appendChild(selectedStrokeWidthInput);
                tdLWSubmit.appendChild(submitStrokeWidthInput);

                rowLineWidth.appendChild(tdLWPowerSpot);
                rowLineWidth.appendChild(tdLWNearby);
                rowLineWidth.appendChild(tdLWSelected);
                rowLineWidth.appendChild(tdLWSubmit);
                table.appendChild(rowLineWidth);

                // ---- Row 4: Line opacity ----
                const rowLineOpacity = document.createElement("tr");
                const lineOpacityLabel = document.createElement("td");
                lineOpacityLabel.textContent = "Line opacity";
                lineOpacityLabel.style.padding = "2px 4px";
                lineOpacityLabel.style.whiteSpace = "nowrap";
                rowLineOpacity.appendChild(lineOpacityLabel);

                const powerSpotStrokeOpacityInput = document.createElement("input");
                powerSpotStrokeOpacityInput.type = "number";
                powerSpotStrokeOpacityInput.min = "0";
                powerSpotStrokeOpacityInput.max = "1";
                powerSpotStrokeOpacityInput.step = "0.05";
                powerSpotStrokeOpacityInput.value = pr.strokeOpacity ?? 1.0;
                styleNumericInput(powerSpotStrokeOpacityInput);

                const nearbyStrokeOpacityInput = document.createElement("input");
                nearbyStrokeOpacityInput.type = "number";
                nearbyStrokeOpacityInput.min = "0";
                nearbyStrokeOpacityInput.max = "1";
                nearbyStrokeOpacityInput.step = "0.05";
                nearbyStrokeOpacityInput.value = nr.strokeOpacity ?? 0.8;
                styleNumericInput(nearbyStrokeOpacityInput);

                const selectedStrokeOpacityInput = document.createElement("input");
                selectedStrokeOpacityInput.type = "number";
                selectedStrokeOpacityInput.min = "0";
                selectedStrokeOpacityInput.max = "1";
                selectedStrokeOpacityInput.step = "0.05";
                selectedStrokeOpacityInput.value = spr.strokeOpacity ?? 0.9;
                styleNumericInput(selectedStrokeOpacityInput);

                const submitStrokeOpacityInput = document.createElement("input");
                submitStrokeOpacityInput.type = "number";
                submitStrokeOpacityInput.min = "0";
                submitStrokeOpacityInput.max = "1";
                submitStrokeOpacityInput.step = "0.05";
                submitStrokeOpacityInput.value = sr.strokeOpacity ?? 0.8;
                styleNumericInput(submitStrokeOpacityInput);

                const tdLOPowerSpot = makeTD();
                const tdLONearby = makeTD();
                const tdLOSelected = makeTD();
                const tdLOSubmit = makeTD();

                tdLOPowerSpot.appendChild(powerSpotStrokeOpacityInput);
                tdLONearby.appendChild(nearbyStrokeOpacityInput);
                tdLOSelected.appendChild(selectedStrokeOpacityInput);
                tdLOSubmit.appendChild(submitStrokeOpacityInput);

                rowLineOpacity.appendChild(tdLOPowerSpot);
                rowLineOpacity.appendChild(tdLONearby);
                rowLineOpacity.appendChild(tdLOSelected);
                rowLineOpacity.appendChild(tdLOSubmit);
                table.appendChild(rowLineOpacity);

                // ---- Row 5: Fill colour ----
                const rowFillColor = document.createElement("tr");
                const fillColorLabel = document.createElement("td");
                fillColorLabel.textContent = "Fill colour";
                fillColorLabel.style.padding = "2px 4px";
                fillColorLabel.style.whiteSpace = "nowrap";
                rowFillColor.appendChild(fillColorLabel);

                const powerSpotFillColorInput = document.createElement("input");
                powerSpotFillColorInput.type = "color";
                powerSpotFillColorInput.value = pr.fillColor || "#ffffff";
                styleColorInput(powerSpotFillColorInput);

                const nearbyFillColorInput = document.createElement("input");
                nearbyFillColorInput.type = "color";
                nearbyFillColorInput.value = nr.fillColor || "#4285F4";
                styleColorInput(nearbyFillColorInput);

                const selectedFillColorInput = document.createElement("input");
                selectedFillColorInput.type = "color";
                selectedFillColorInput.value = spr.fillColor || "#ff00ff";
                styleColorInput(selectedFillColorInput);

                const submitFillColorInput = document.createElement("input");
                submitFillColorInput.type = "color";
                submitFillColorInput.value = sr.fillColor || "#8b5cf6";
                styleColorInput(submitFillColorInput);

                const tdFCPowerSpot = makeTD();
                const tdFCNearby = makeTD();
                const tdFCSelected = makeTD();
                const tdFCSubmit = makeTD();

                tdFCPowerSpot.appendChild(powerSpotFillColorInput);
                tdFCNearby.appendChild(nearbyFillColorInput);
                tdFCSelected.appendChild(selectedFillColorInput);
                tdFCSubmit.appendChild(submitFillColorInput);

                rowFillColor.appendChild(tdFCPowerSpot);
                rowFillColor.appendChild(tdFCNearby);
                rowFillColor.appendChild(tdFCSelected);
                rowFillColor.appendChild(tdFCSubmit);
                table.appendChild(rowFillColor);

                // ---- Row 6: Fill opacity ----
                const rowFillOpacity = document.createElement("tr");
                const fillOpacityLabel = document.createElement("td");
                fillOpacityLabel.textContent = "Fill opacity";
                fillOpacityLabel.style.padding = "2px 4px";
                fillOpacityLabel.style.whiteSpace = "nowrap";
                rowFillOpacity.appendChild(fillOpacityLabel);

                const powerSpotFillOpacityInput = document.createElement("input");
                powerSpotFillOpacityInput.type = "number";
                powerSpotFillOpacityInput.min = "0";
                powerSpotFillOpacityInput.max = "1";
                powerSpotFillOpacityInput.step = "0.05";
                powerSpotFillOpacityInput.value = pr.fillOpacity ?? 0.0;
                styleNumericInput(powerSpotFillOpacityInput);

                const nearbyFillOpacityInput = document.createElement("input");
                nearbyFillOpacityInput.type = "number";
                nearbyFillOpacityInput.min = "0";
                nearbyFillOpacityInput.max = "1";
                nearbyFillOpacityInput.step = "0.05";
                nearbyFillOpacityInput.value = nr.fillOpacity ?? 0.0;
                styleNumericInput(nearbyFillOpacityInput);

                const selectedFillOpacityInput = document.createElement("input");
                selectedFillOpacityInput.type = "number";
                selectedFillOpacityInput.min = "0";
                selectedFillOpacityInput.max = "1";
                selectedFillOpacityInput.step = "0.05";
                selectedFillOpacityInput.value = spr.fillOpacity ?? 0.05;
                styleNumericInput(selectedFillOpacityInput);

                const submitFillOpacityInput = document.createElement("input");
                submitFillOpacityInput.type = "number";
                submitFillOpacityInput.min = "0";
                submitFillOpacityInput.max = "1";
                submitFillOpacityInput.step = "0.05";
                submitFillOpacityInput.value = sr.fillOpacity ?? 0.0;
                styleNumericInput(submitFillOpacityInput);

                const tdFOPowerSpot = makeTD();
                const tdFONearby = makeTD();
                const tdFOSelected = makeTD();
                const tdFOSubmit = makeTD();

                tdFOPowerSpot.appendChild(powerSpotFillOpacityInput);
                tdFONearby.appendChild(nearbyFillOpacityInput);
                tdFOSelected.appendChild(selectedFillOpacityInput);
                tdFOSubmit.appendChild(submitFillOpacityInput);

                rowFillOpacity.appendChild(tdFOPowerSpot);
                rowFillOpacity.appendChild(tdFONearby);
                rowFillOpacity.appendChild(tdFOSelected);
                rowFillOpacity.appendChild(tdFOSubmit);
                table.appendChild(rowFillOpacity);

                circlesSection.appendChild(table);
                dialog.appendChild(circlesSection);

                // Return references needed by onOk
                return {
                    rememberChk,
                    nr,
                    sr,
                    spr,
                    pr,
                    powerSpotEnabledChk,
                    powerSpotStrokeColorInput,
                    powerSpotStrokeWidthInput,
                    powerSpotStrokeOpacityInput,
                    powerSpotFillColorInput,
                    powerSpotFillOpacityInput,
                    nearbyEnabledChk,
                    nearbyStrokeColorInput,
                    nearbyStrokeWidthInput,
                    nearbyStrokeOpacityInput,
                    nearbyFillColorInput,
                    nearbyFillOpacityInput,
                    submitEnabledChk,
                    submitStrokeColorInput,
                    submitStrokeWidthInput,
                    submitStrokeOpacityInput,
                    submitFillColorInput,
                    submitFillOpacityInput,
                    selectedEnabledChk,
                    selectedStrokeColorInput,
                    selectedStrokeWidthInput,
                    selectedStrokeOpacityInput,
                    selectedFillColorInput,
                    selectedFillOpacityInput
                };
            },
            onOk(ctx, closeModal) {
                const {
                    rememberChk,
                    nr,
                    sr,
                    spr,
                    pr,
                    powerSpotEnabledChk,
                    powerSpotStrokeColorInput,
                    powerSpotStrokeWidthInput,
                    powerSpotStrokeOpacityInput,
                    powerSpotFillColorInput,
                    powerSpotFillOpacityInput,
                    nearbyEnabledChk,
                    nearbyStrokeColorInput,
                    nearbyStrokeWidthInput,
                    nearbyStrokeOpacityInput,
                    nearbyFillColorInput,
                    nearbyFillOpacityInput,
                    submitEnabledChk,
                    submitStrokeColorInput,
                    submitStrokeWidthInput,
                    submitStrokeOpacityInput,
                    submitFillColorInput,
                    submitFillOpacityInput,
                    selectedEnabledChk,
                    selectedStrokeColorInput,
                    selectedStrokeWidthInput,
                    selectedStrokeOpacityInput,
                    selectedFillColorInput,
                    selectedFillOpacityInput
                } = ctx;

                mapCfg.rememberLastView = !!rememberChk.checked;

                // Power Spot (22m)
                pr.enabled = !!powerSpotEnabledChk.checked;
                pr.strokeColor = powerSpotStrokeColorInput.value || "#ffffff";
                pr.strokeWidth = clamp(powerSpotStrokeWidthInput.value, 0, 10, 1.5);
                pr.strokeOpacity = clamp(powerSpotStrokeOpacityInput.value, 0, 1, 1.0);
                pr.fillColor = powerSpotFillColorInput.value || "#ffffff";
                pr.fillOpacity = clamp(powerSpotFillOpacityInput.value, 0, 1, 0.0);

                // Nearby (200m)
                nr.enabled = !!nearbyEnabledChk.checked;
                nr.strokeColor = nearbyStrokeColorInput.value || "#4285F4";
                nr.strokeWidth = clamp(nearbyStrokeWidthInput.value, 0, 10, 2);
                nr.strokeOpacity = clamp(nearbyStrokeOpacityInput.value, 0, 1, 0.8);
                nr.fillColor = nearbyFillColorInput.value || "#4285F4";
                nr.fillOpacity = clamp(nearbyFillOpacityInput.value, 0, 1, 0.0);

                // Submit (10km)
                sr.enabled = !!submitEnabledChk.checked;
                sr.strokeColor = submitStrokeColorInput.value || "#8b5cf6";
                sr.strokeWidth = clamp(submitStrokeWidthInput.value, 0, 10, 2);
                sr.strokeOpacity = clamp(submitStrokeOpacityInput.value, 0, 1, 0.8);
                sr.fillColor = submitFillColorInput.value || "#8b5cf6";
                sr.fillOpacity = clamp(submitFillOpacityInput.value, 0, 1, 0.0);

                // Interaction (80m)
                spr.enabled = !!selectedEnabledChk.checked;
                spr.strokeColor = selectedStrokeColorInput.value || "#ff00ff";
                spr.strokeWidth = clamp(selectedStrokeWidthInput.value, 0, 10, 2);
                spr.strokeOpacity = clamp(selectedStrokeOpacityInput.value, 0, 1, 0.9);
                spr.fillColor = selectedFillColorInput.value || "#ff00ff";
                spr.fillOpacity = clamp(selectedFillOpacityInput.value, 0, 1, 0.05);

                saveSettings();
                updateNearbyWayspotsRadiusCircle();
                updateSubmitRadiusCircle();
                updatePowerSpotRadiusCircle();

                // Refresh selected POI circle if one is active
                if (typeof selectedPoiGuid === "string" && selectedPoiGuid && markersByGuid[selectedPoiGuid]) {
                    const selectedEntry = markersByGuid[selectedPoiGuid];
                    if (selectedEntry && selectedEntry.poi) {
                        updateSelectedPoiCircle(selectedEntry.poi.lat, selectedEntry.poi.lng);
                    }
                }

                closeModal();
            }
        });
    }

    let wayspotOverlayEscHandler = null;

    function openMarkerSettingsWindow() {
        const liveA = userSettings.poi.appearance;
        const draftA = JSON.parse(JSON.stringify(liveA));
        const a = draftA; // everything in this modal uses the draft

        const SOURCES = [
            { key: "community", label: "Community Contributed" },
            { key: "import", label: "Imports" }
        ];
        const KINDS = [
            { key: "wayspot", label: "Wayspots" },
            { key: "pokestop", label: "Pokestops" },
            { key: "gym", label: "Gyms" },
            { key: "powerspot", label: "Power Spots" }
        ];

        function getBucketKeyForTableCell(colSourceKeyOrNull, rowKindKey) {
            // Table uses “collapsed” keys when checkbox is off.
            const sourceKey = (colSourceKeyOrNull || "community");
            return `${sourceKey}:${rowKindKey}`;
        }

        function ensureBucketExists(styleKey) {
            const bucket = a.styles[styleKey];
            if (bucket) return bucket;

            a.styles[styleKey] = {
                markerType: "generic",
                thumbnail: { ...a.defaults.thumbnail },
                generic: { ...a.defaults.generic }
            };
            return a.styles[styleKey];
        }

        function makeMarkerPreviewEl(styleKey) {
            ensureBucketExists(styleKey);
            const bucket = a.styles[styleKey];
            const markerType = bucket.markerType || "generic";

            const previewWrap = document.createElement("div");
            previewWrap.className = "wfmapmods-markerpreview";

            if (markerType === "thumbnail") {
                const t = { ...a.defaults.thumbnail, ...(bucket.thumbnail || {}) };
                const size = clamp(t.size, 8, 96, 36);

                const url = `https://lh3.googleusercontent.com/fs2mYM4r9Qq93ejdOP_2lwefRNLVa9tqmJW7XXwqNhMCMXNKwoJoFuMboBpXwnKUf7fJGImbajM9mHAOMlndt5A-Ts9Qh9f_t6YoaQ6u=s${size}`;

                const frame = document.createElement("div");
                frame.className = "wfmapmods-thumbframe";
                frame.style.setProperty("--wfmapmods-thumb-size", size + "px");

                // image (full opacity)
                const img = document.createElement("img");
                img.src = url;
                frame.appendChild(img);

                // border overlay (opacity applies ONLY here)
                const ring = document.createElement("div");
                ring.className = "wfmapmods-thumbring";
                ring.style.borderColor = t.borderColor || "#ffffff";
                ring.style.borderWidth = (t.borderWidth ?? 3) + "px";
                ring.style.opacity = String(t.borderOpacity ?? 0.7);
                frame.appendChild(ring);

                previewWrap.appendChild(frame);
                return previewWrap;
            }


            const g = { ...a.defaults.generic, ...(bucket.generic || {}) };

            // Render a little SVG circle that matches your SymbolPath.CIRCLE styling
            const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
            svg.setAttribute("width", "44");
            svg.setAttribute("height", "44");
            svg.setAttribute("viewBox", "0 0 44 44");

            const c = document.createElementNS("http://www.w3.org/2000/svg", "circle");
            c.setAttribute("cx", "22");
            c.setAttribute("cy", "22");

            const r = clamp(g.markerSize ?? 8, 1, 20, 8);
            c.setAttribute("r", String(r));

            c.setAttribute("fill", g.fillColor || "#ff6600");
            c.setAttribute("fill-opacity", String(clamp(g.fillOpacity ?? 0.5, 0, 1, 0.5)));
            c.setAttribute("stroke", g.borderColor || "#ff6600");
            c.setAttribute("stroke-opacity", String(clamp(g.borderOpacity ?? 1.0, 0, 1, 1.0)));
            c.setAttribute("stroke-width", String(clamp(g.borderWidth ?? 2, 0, 20, 2)));

            svg.appendChild(c);
            previewWrap.appendChild(svg);
            return previewWrap;
        }

        function openBucketEditorSubmodal(styleKey, headerLabel, onSaved) {
            ensureBucketExists(styleKey);
            const bucket = a.styles[styleKey];

            openModal({
                id: "wfmapmods-marker-sub-backdrop",
                title: headerLabel,
                width: 420,
                buildContent(dialog) {
                    const draft = JSON.parse(JSON.stringify(bucket));

                    // Marker type dropdown
                    const typeSection = document.createElement("div");
                    typeSection.className = "wfmapmods-modal-section";

                    const typeSelect = document.createElement("select");
                    typeSelect.className = "wfmapmods-modal-select";
                    typeSelect.innerHTML = `
          <option value="thumbnail">Thumbnail</option>
          <option value="generic">Generic marker</option>
        `;
                    typeSelect.value = draft.markerType || "generic";

                    typeSection.appendChild(
                        createSettingsRow("Marker type", typeSelect, { narrowLabel: true })
                    );
                    dialog.appendChild(typeSection);

                    // Thumbnail controls
                    const thumbSection = document.createElement("div");
                    thumbSection.className = "wfmapmods-modal-section";

                    const t = { ...(a.defaults.thumbnail || {}), ...(draft.thumbnail || {}) };

                    const thumbSizeInput = document.createElement("input");
                    thumbSizeInput.type = "number";
                    thumbSizeInput.min = "8";
                    thumbSizeInput.max = "96";
                    thumbSizeInput.step = "1";
                    thumbSizeInput.className = "wfmapmods-modal-input-small";
                    thumbSizeInput.value = t.size ?? 36;

                    const thumbBorderColorInput = document.createElement("input");
                    thumbBorderColorInput.type = "color";
                    thumbBorderColorInput.className = "wfmapmods-modal-color";
                    thumbBorderColorInput.value = normalizeHexColor(t.borderColor, "#ffffff");

                    const thumbBorderWidthInput = document.createElement("input");
                    thumbBorderWidthInput.type = "number";
                    thumbBorderWidthInput.min = "0";
                    thumbBorderWidthInput.max = "20";
                    thumbBorderWidthInput.step = "1";
                    thumbBorderWidthInput.className = "wfmapmods-modal-input-small";
                    thumbBorderWidthInput.value = t.borderWidth ?? 3;

                    const thumbBorderOpacityInput = document.createElement("input");
                    thumbBorderOpacityInput.type = "number";
                    thumbBorderOpacityInput.min = "0";
                    thumbBorderOpacityInput.max = "1";
                    thumbBorderOpacityInput.step = "0.1";
                    thumbBorderOpacityInput.className = "wfmapmods-modal-input-small";
                    thumbBorderOpacityInput.value = t.borderOpacity ?? 0.7;

                    thumbSection.appendChild(createSettingsRow("Thumbnail size (px)", thumbSizeInput, { narrowLabel: true }));
                    thumbSection.appendChild(createSettingsRow("Border colour", thumbBorderColorInput, { narrowLabel: true }));
                    thumbSection.appendChild(createSettingsRow("Border stroke (px)", thumbBorderWidthInput, { narrowLabel: true }));
                    thumbSection.appendChild(createSettingsRow("Border opacity (0–1)", thumbBorderOpacityInput, { narrowLabel: true }));
                    dialog.appendChild(thumbSection);

                    // Generic controls
                    const genSection = document.createElement("div");
                    genSection.className = "wfmapmods-modal-section";

                    const g = { ...(a.defaults.generic || {}), ...(draft.generic || {}) };

                    const genMarkerSizeInput = document.createElement("input");
                    genMarkerSizeInput.type = "number";
                    genMarkerSizeInput.min = "1";
                    genMarkerSizeInput.max = "50";
                    genMarkerSizeInput.step = "1";
                    genMarkerSizeInput.className = "wfmapmods-modal-input-small";
                    genMarkerSizeInput.value = g.markerSize ?? 8;

                    const genBorderColorInput = document.createElement("input");
                    genBorderColorInput.type = "color";
                    genBorderColorInput.className = "wfmapmods-modal-color";
                    genBorderColorInput.value = normalizeHexColor(g.borderColor, "#ff6600");

                    const genBorderWidthInput = document.createElement("input");
                    genBorderWidthInput.type = "number";
                    genBorderWidthInput.min = "0";
                    genBorderWidthInput.max = "20";
                    genBorderWidthInput.step = "1";
                    genBorderWidthInput.className = "wfmapmods-modal-input-small";
                    genBorderWidthInput.value = g.borderWidth ?? 2;

                    const genBorderOpacityInput = document.createElement("input");
                    genBorderOpacityInput.type = "number";
                    genBorderOpacityInput.min = "0";
                    genBorderOpacityInput.max = "1";
                    genBorderOpacityInput.step = "0.1";
                    genBorderOpacityInput.className = "wfmapmods-modal-input-small";
                    genBorderOpacityInput.value = g.borderOpacity ?? 1.0;

                    const genFillColorInput = document.createElement("input");
                    genFillColorInput.type = "color";
                    genFillColorInput.className = "wfmapmods-modal-color";
                    genFillColorInput.value = normalizeHexColor(g.fillColor, "#ff6600");

                    const genFillOpacityInput = document.createElement("input");
                    genFillOpacityInput.type = "number";
                    genFillOpacityInput.min = "0";
                    genFillOpacityInput.max = "1";
                    genFillOpacityInput.step = "0.1";
                    genFillOpacityInput.className = "wfmapmods-modal-input-small";
                    genFillOpacityInput.value = g.fillOpacity ?? 0.5;

                    genSection.appendChild(createSettingsRow("Marker size", genMarkerSizeInput, { narrowLabel: true }));
                    genSection.appendChild(createSettingsRow("Border colour", genBorderColorInput, { narrowLabel: true }));
                    genSection.appendChild(createSettingsRow("Border stroke (px)", genBorderWidthInput, { narrowLabel: true }));
                    genSection.appendChild(createSettingsRow("Border opacity (0–1)", genBorderOpacityInput, { narrowLabel: true }));
                    genSection.appendChild(createSettingsRow("Fill colour", genFillColorInput, { narrowLabel: true }));
                    genSection.appendChild(createSettingsRow("Fill opacity (0–1)", genFillOpacityInput, { narrowLabel: true }));
                    dialog.appendChild(genSection);

                    function updateVisibility() {
                        const t = typeSelect.value;
                        thumbSection.classList.toggle("wfmapmods-hidden", t !== "thumbnail");
                        genSection.classList.toggle("wfmapmods-hidden", t !== "generic");
                    }
                    updateVisibility();
                    typeSelect.addEventListener("change", updateVisibility);

                    return {
                        typeSelect,
                        thumbSizeInput,
                        thumbBorderColorInput,
                        thumbBorderWidthInput,
                        thumbBorderOpacityInput,
                        genMarkerSizeInput,
                        genBorderColorInput,
                        genBorderWidthInput,
                        genBorderOpacityInput,
                        genFillColorInput,
                        genFillOpacityInput
                    };
                },
                onOk(ctx, closeModal) {
                    // Commit to bucket
                    bucket.markerType = (ctx.typeSelect.value === "thumbnail") ? "thumbnail" : "generic";

                    bucket.thumbnail = bucket.thumbnail || {};
                    bucket.thumbnail.size = clamp(ctx.thumbSizeInput.value, 8, 96, 36);
                    bucket.thumbnail.borderColor = normalizeHexColor(ctx.thumbBorderColorInput.value, "#ffffff");
                    bucket.thumbnail.borderWidth = clamp(ctx.thumbBorderWidthInput.value, 0, 20, 3);
                    bucket.thumbnail.borderOpacity = clamp(ctx.thumbBorderOpacityInput.value, 0, 1, 0.7);

                    bucket.generic = bucket.generic || {};
                    bucket.generic.markerSize = clamp(ctx.genMarkerSizeInput.value, 1, 50, 8);
                    bucket.generic.borderColor = normalizeHexColor(ctx.genBorderColorInput.value, "#ff6600");
                    bucket.generic.borderWidth = clamp(ctx.genBorderWidthInput.value, 0, 20, 2);
                    bucket.generic.borderOpacity = clamp(ctx.genBorderOpacityInput.value, 0, 1, 1.0);
                    bucket.generic.fillColor = normalizeHexColor(ctx.genFillColorInput.value, "#ff6600");
                    bucket.generic.fillOpacity = clamp(ctx.genFillOpacityInput.value, 0, 1, 0.5);

                    closeModal();

                    if (typeof onSaved === "function") {
                        onSaved();
                    }
                }
            });
        }

        openModal({
            id: "wfmapmods-marker-backdrop",
            title: "Marker options",
            width: 450,
            buildContent(dialog) {
                // Checkbox #1
                const bySourceInput = document.createElement("input");
                bySourceInput.type = "checkbox";
                bySourceInput.checked = (a.styleBy.source !== false);

                // Checkbox #2
                const byTypeInput = document.createElement("input");
                byTypeInput.type = "checkbox";
                byTypeInput.checked = !!a.styleBy.gameObject;

                // Top section
                const top = document.createElement("div");
                top.className = "wfmapmods-modal-section";

                function createCheckboxRow(labelText, checkboxEl) {
                    const row = document.createElement("div");
                    row.className = "wfmapmods-clickrow";

                    const label = document.createElement("div");
                    label.className = "wfmapmods-clickrow-text";
                    label.textContent = labelText;

                    row.addEventListener("click", (ev) => {
                        if (ev.target === checkboxEl) return;
                        checkboxEl.checked = !checkboxEl.checked;
                        checkboxEl.dispatchEvent(new Event("change", { bubbles: true }));
                    });

                    row.appendChild(checkboxEl);
                    row.appendChild(label);
                    return row;
                }

                top.appendChild(createCheckboxRow("Style differently for Community Contributions vs. Imports", bySourceInput));
                top.appendChild(createCheckboxRow("Style differently depending on PGO entity type", byTypeInput));

                const hint = document.createElement("div");
                hint.className = "wfmapmods-modal-hint";
                hint.textContent = "Click the marker to customise its appearance";
                top.appendChild(hint);

                dialog.appendChild(top);

                // Table container
                const tableSection = document.createElement("div");
                tableSection.className = "wfmapmods-modal-section";
                dialog.appendChild(tableSection);

                function renderTable() {
                    tableSection.innerHTML = "";

                    // live-update styleBy from checkboxes (so createPoiMarker resolution matches UI)
                    a.styleBy.source = !!bySourceInput.checked;
                    a.styleBy.gameObject = !!byTypeInput.checked;

                    const showSources = a.styleBy.source;
                    const showKinds = a.styleBy.gameObject;

                    const cols = showSources
                    ? SOURCES.map(s => ({ sourceKey: s.key, label: s.label }))
                    : [{ sourceKey: null, label: "Community Contributed & Imports" }];

                    const rows = showKinds
                    ? KINDS
                    : [KINDS[0]]; // wayspot only

                    // Build table
                    const table = document.createElement("table");
                    table.className = "wfmapmods-markertable";

                    const colgroup = document.createElement("colgroup");

                    // row header column
                    const col0 = document.createElement("col");
                    col0.style.width = "100px";
                    colgroup.appendChild(col0);

                    // data columns split evenly
                    const remaining = `calc((100% - 160px) / ${cols.length})`;
                    cols.forEach(() => {
                        const c = document.createElement("col");
                        c.style.width = remaining;
                        colgroup.appendChild(c);
                    });

                    table.appendChild(colgroup);

                    // Header row
                    const thead = document.createElement("thead");
                    const trh = document.createElement("tr");

                    const corner = document.createElement("th");
                    corner.style.width = "160px";
                    corner.textContent = "";
                    trh.appendChild(corner);

                    cols.forEach(col => {
                        const th = document.createElement("th");
                        th.textContent = col.label;
                        trh.appendChild(th);
                    });

                    thead.appendChild(trh);
                    table.appendChild(thead);

                    // Body
                    const tbody = document.createElement("tbody");

                    rows.forEach(row => {
                        const tr = document.createElement("tr");

                        const rowHead = document.createElement("th");
                        rowHead.className = "wfmapmods-markertable-rowhead";
                        rowHead.textContent = row.label;
                        tr.appendChild(rowHead);

                        cols.forEach(col => {
                            const styleKey = getBucketKeyForTableCell(col.sourceKey, row.key);
                            ensureBucketExists(styleKey);

                            const td = document.createElement("td");
                            td.className = "wfmapmods-markercell";

                            // whole cell as link
                            td.addEventListener("click", () => {
                                const colLabel = col.label;
                                const headerLabel = `${colLabel} • ${row.label}`;
                                openBucketEditorSubmodal(styleKey, headerLabel, () => {
                                    renderTable();              // refresh previews
                                });
                            });

                            td.appendChild(makeMarkerPreviewEl(styleKey));
                            tr.appendChild(td);
                        });

                        tbody.appendChild(tr);
                    });

                    table.appendChild(tbody);
                    tableSection.appendChild(table);
                }

                // Initial
                renderTable();

                // Dynamic updates when toggles change
                bySourceInput.addEventListener("change", () => {
                    a.styleBy.source = !!bySourceInput.checked;
                    renderTable();
                });
                byTypeInput.addEventListener("change", () => {
                    a.styleBy.gameObject = !!byTypeInput.checked;
                    renderTable();
                });

                return { bySourceInput, byTypeInput };
            },

            onOk(ctx, closeModal) {
                // Commit draft -> live
                userSettings.poi.appearance = draftA;

                saveSettings();
                rebuildAllPoiMarkers();
                closeModal();
            }
        });
    }

    function createSettingsRow(labelText, inputEl, opts = {}) {
        const row = document.createElement("div");
        row.className = "wfmapmods-modal-row";
        if (opts.narrowLabel) {
            row.classList.add("wfmapmods-modal-row--narrow");
        }

        const label = document.createElement("label");
        label.textContent = labelText;

        row.appendChild(label);
        row.appendChild(inputEl);
        return row;
    }

    function wfmmGetModalStack() {
        const k = "__wfmmModalStack";
        if (!window[k]) window[k] = [];
        return window[k];
    }

    function openModal({ id, title, buildContent, onOk, width, showFooterButtons }) {
        if (document.getElementById(id)) return; // Modal already open

        const backdrop = document.createElement("div");
        backdrop.id = id;
        backdrop.className = "wfmapmods-modal-backdrop";

        const stack = wfmmGetModalStack();
        stack.push(id);

        const dialog = document.createElement("div");
        dialog.className = "wfmapmods-modal-dialog";

        if (typeof width === "number") {
            dialog.style.width = width + "px";
            dialog.style.maxWidth = width + "px";
        } else if (id === "wfmapmods-mapopt-backdrop") {
            dialog.style.width = "400px";
            dialog.style.maxWidth = "400px";
        }

        const header = document.createElement("div");
        header.className = "wfmapmods-modal-title";
        header.textContent = title;
        dialog.appendChild(header);

        let okBtn = null;
        let cancelBtn = null;

        function closeModal() {
            document.removeEventListener("keydown", escHandler);

            // remove this modal from stack (safe even if out of order)
            const stack = wfmmGetModalStack();
            const idx = stack.lastIndexOf(id);
            if (idx !== -1) stack.splice(idx, 1);

            ctx = null;

            if (okBtn) {
                okBtn.replaceWith(okBtn.cloneNode(true));
                okBtn = null;
            }
            if (cancelBtn) {
                cancelBtn.replaceWith(cancelBtn.cloneNode(true));
                cancelBtn = null;
            }

            backdrop.remove();
        }

        function escHandler(ev) {
            const stack = wfmmGetModalStack();
            if (stack[stack.length - 1] !== id) return; // ONLY top-most modal reacts

            if (ev.key === "Escape") {
                ev.stopPropagation();
                closeModal();
            } else if (ev.key === "Enter" && okBtn) {
                ev.preventDefault();
                ev.stopPropagation();
                okBtn.click();
            }
        }

        let footer = null;
        if (showFooterButtons !== false) {
            footer = document.createElement("div");
            footer.className = "wfmapmods-modal-footer";

            cancelBtn = document.createElement("button");
            cancelBtn.type = "button";
            cancelBtn.textContent = "Cancel";
            cancelBtn.className = "wfmapmods-modal-btn";

            okBtn = document.createElement("button");
            okBtn.type = "button";
            okBtn.textContent = "OK";
            okBtn.className = "wfmapmods-modal-btn wfmapmods-modal-btn-primary";

            footer.appendChild(cancelBtn);
            footer.appendChild(okBtn);
        }

        let ctx = null;
        ctx = buildContent(dialog, okBtn, closeModal);

        if (footer) {
            cancelBtn.addEventListener("click", closeModal);

            okBtn.addEventListener("click", () => {
                if (onOk) onOk(ctx, closeModal);
            });

            dialog.appendChild(footer);
        }

        // Backdrop & ESC handling
        let pointerDownOnBackdrop = false;

        backdrop.addEventListener("pointerdown", (ev) => {
            pointerDownOnBackdrop = (ev.target === backdrop);
        });

        backdrop.addEventListener("pointerup", (ev) => {
            // only close if the press started on the backdrop AND ended on backdrop
            if (pointerDownOnBackdrop && ev.target === backdrop) closeModal();
            pointerDownOnBackdrop = false;
        });

        // also reset if pointer is cancelled (e.g. OS gesture)
        backdrop.addEventListener("pointercancel", () => {
            pointerDownOnBackdrop = false;
        });

        document.addEventListener("keydown", escHandler);

        // Add dialog to DOM
        backdrop.appendChild(dialog);
        document.body.appendChild(backdrop);
    }

    function clamp(num, min, max, fallback) {
        num = Number(num);
        if (Number.isNaN(num)) return fallback;
        return Math.min(max, Math.max(min, num));
    }

    function normalizeHexColor(v, fallback) {
        if (typeof v !== "string") return fallback;
        const s = v.trim();
        if (/^#[0-9a-fA-F]{3}$/.test(s) || /^#[0-9a-fA-F]{6}$/.test(s)) return s;
        return fallback;
    }

    // -----------------------------
    // Desktop vs Mobile Browser Handling
    // -----------------------------

    function hasMobilePin() {
        return !!document.querySelector(
            '.nia-map__center-img-overlay'
        );
    }

    function hasDesktopPin() {
        const desktopImg = document.querySelector(
            '.gm-style div[style*="z-index: 1000"][style*="width: 36px"][style*="height: 56px"] img[src*="map_selection_pin.svg"]'
        );
        return !!desktopImg;
    }

    function detectMapMode() {
        if (hasMobilePin()) {
            return MAP_MODE.MOBILE;
        }

        if (hasDesktopPin()) {
            return MAP_MODE.DESKTOP;
        }

        // Unknown / not initialised yet
        return null;
    }

    function applyMobileMapMode() {
        // Hide native center pin overlay and show custom overlay.
        hideNativeCenterPin();
        ensureCenterPinOverlay();

        // Hide our custom made desktop pin
        removeDesktopSubmitMarker();

        // Recenter on the current submission coordinates
        // This is to prevent misalignment between lat,lng and visual pin
        recenterMapOnCurrentSubmission();

        // Collapse sidepanel
        sidePanelCollapsed = true;
        applySidePanelCollapseState();

        // If we already have a selected POI, show its InfoWindow now
        if (lastSelectedPoi) {
            const latLng = new google.maps.LatLng(lastSelectedPoi.lat, lastSelectedPoi.lng);
            showPoiInfoWindowForSelection(lastSelectedPoi, latLng);
        }
    }

    function applyDesktopMapMode() {
        // Remove our mobile overlay in desktop mode
        removeCenterPinOverlay();

        // Ensure desktop submission marker exists
        ensureDesktopSubmitMarker();

        // Side panel: expand in desktop
        sidePanelCollapsed = false;
        applySidePanelCollapseState();

        // Close any open InfoWindow when leaving mobile mode
        if (poiInfoWindow) {
            poiInfoWindow.close();
        }
    }

    function getDesktopSubmitMarkerIcon() {
        if (desktopSubmitMarkerIcon) return desktopSubmitMarkerIcon;
        if (typeof google === "undefined" || !google.maps) return null;

        desktopSubmitMarkerIcon = {
            url: "data:image/svg+xml;charset=UTF-8," + encodeURIComponent(SUBMISSION_PIN),
            // match Niantic desktop pin size
            scaledSize: new google.maps.Size(36, 56),
            // bottom-centre of the image sits on the LatLng
            anchor: new google.maps.Point(18, 56)
        };

        return desktopSubmitMarkerIcon;
    }

    function ensureDesktopSubmitMarker() {
        if (!wfMap || typeof google === "undefined" || !google.maps) return;

        const icon = getDesktopSubmitMarkerIcon();
        if (!icon) return;

        if (!desktopSubmitMarker) {
            desktopSubmitMarker = new google.maps.Marker({
                map: wfMap,
                clickable: false,
                zIndex: 999,
                optimized: false,
                icon: icon   // includes scaledSize + anchor from helper
            });
        }

        updateDesktopSubmitMarkerPosition();
    }

    function updateDesktopSubmitMarkerPosition() {
        if (!desktopSubmitMarker || !wfMap) return;
        if (typeof window.currentLat !== "number" || typeof window.currentLng !== "number") return;

        const latLng = new google.maps.LatLng(window.currentLat, window.currentLng);
        desktopSubmitMarker.setPosition(latLng);
    }

    function removeDesktopSubmitMarker() {
        if (desktopSubmitMarker) {
            desktopSubmitMarker.setMap(null);
            desktopSubmitMarker = null;
        }
    }


    function initMapModeWatcher() {
        const updateMode = () => {
            const newMode = detectMapMode();
            if (!newMode || newMode === currentMapMode) return;

            const oldMode = currentMapMode;
            currentMapMode = newMode;
            window.wfmapmodsMapMode = newMode;

            if (newMode === MAP_MODE.MOBILE) {
                applyMobileMapMode();
            } else if (newMode === MAP_MODE.DESKTOP) {
                applyDesktopMapMode();
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
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true
        });

        window.addEventListener("resize", updateMode);

        // Initial pass
        updateMode();
    }

    // -----------------------------
    // Fixes for mobile browser
    // -----------------------------

    function recenterMapOnCurrentSubmission() {
        if (!wfMap || typeof google === "undefined" || !google.maps) {
            console.info("Wayfarer Map: recenter skipped – map not ready");
            return;
        }

        if (typeof window.currentLat !== "number" || typeof window.currentLng !== "number") {
            console.info(
                "Wayfarer Map: recenter skipped – currentLat/currentLng not set",
                window.currentLat,
                window.currentLng
            );
            return;
        }

        const latLng = new google.maps.LatLng(window.currentLat, window.currentLng);

        wfMap.setCenter(latLng);

        // Keep Wayfarer’s internal state in sync
        google.maps.event.trigger(wfMap, "click", {
            latLng
        });
    }

    function hideNativeCenterPin() {
        const pinContainer = document.querySelector(".nia-map__center-img-overlay");
        if (!pinContainer) return;

        pinContainer.style.setProperty("display", "none", "important");
    }

    function ensureCenterPinOverlay() {
        if (!wfMap) return;
        if (!ensureCenterPinClass()) return;

        if (!centerPinOverlay) {
            centerPinOverlay = new CenterPinOverlay(wfMap);
        }
    }

    function removeCenterPinOverlay() {
        if (centerPinOverlay) {
            centerPinOverlay.setMap(null);
            centerPinOverlay = null;
        }
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
                div.style.pointerEvents = "none"; // don’t block map/info clicks
                div.style.zIndex = "999"; // under floatPane (InfoWindow), over tiles

                const img = document.createElement("img");
                img.src = "/img/map_selection_pin.svg";
                img.alt = "Center pin";

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
                this.div.style.top = (point.y - size) + "px";
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

    // ==================================
    // Lat/Lng observers - Find submit location
    // ==================================

    function watchForLatLngElement() {
        if (!isOnSubmitRoute()) return;

        // Only initialise once
        if (latLngBodyObserver) return;

        function attachToLatLngElement(el) {
            // If we're already observing this exact element, do nothing
            if (latLngTargetEl === el && latLngObserver) return;

            // Disconnect old element observer (if any)
            if (latLngObserver) {
                latLngObserver.disconnect();
                latLngObserver = null;
            }

            latLngTargetEl = el;

            let lastText = (el.textContent || "").trim();
            const initialCoords = parseLatLng(lastText);

            if (initialCoords) {
                window.currentLat = initialCoords.lat;
                window.currentLng = initialCoords.lng;

                // Treat this as our first fetch position
                lastFetchLat = initialCoords.lat;
                lastFetchLng = initialCoords.lng;

                fetchLivePois(initialCoords.lat, initialCoords.lng);

                // Update 22m powerSpot radius circle
                updatePowerSpotRadiusCircle(initialCoords.lat, initialCoords.lng);

                if (currentMapMode === MAP_MODE.DESKTOP) {
                    updateDesktopSubmitMarkerPosition();
                }
            }

            // Watch for changes to the coordinates text
            latLngObserver = new MutationObserver(() => {
                // If element has been removed from DOM, stop observing.
                if (!document.body.contains(el)) {
                    latLngObserver.disconnect();
                    latLngObserver = null;
                    latLngTargetEl = null;
                    return;
                }

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
            const el = document.querySelector('.submit-coordinates-text') || document.querySelector('.text-gray-400.text-xs');
            if (!el) return;
            attachToLatLngElement(el);
        }

        // Body-level observer: watches for the lat/lng element appearing / being replaced
        latLngBodyObserver = new MutationObserver(() => {
            findAndAttachLatLngElement();
        });

        latLngBodyObserver.observe(document.body, {
            childList: true,
            subtree: true
        });

        // Try immediately in case the element is already present
        findAndAttachLatLngElement();
    }

    function handleLatLngChange(newLat, newLng) {
        window.currentLat = newLat;
        window.currentLng = newLng;

        // Update 22m Power Spot radius circle
        updatePowerSpotRadiusCircle(newLat, newLng);

        // Move our custom desktop submission marker (desktop mode only)
        if (currentMapMode === MAP_MODE.DESKTOP) {
            updateDesktopSubmitMarkerPosition();
        }

        // Save map coordinates so we can restore view after refresh
        saveMapView();

        // Marker must move a certain distance before loading new POIs
        // Defaults to 25% of POI radius (i.e. 50 metres)
        // Prevents spamming calls to server for minor pin movements
        const dist = distanceMeters(lastFetchLat, lastFetchLng, newLat, newLng);
        if (dist > poiMovementThreshold) {
            lastFetchLat = newLat;
            lastFetchLng = newLng;
            fetchLivePois(newLat, newLng);
        }
    }

    function parseLatLng(text) {
        if (!text) return null;
        const parts = text.split(',');
        if (parts.length !== 2) return null;

        const lat = parseFloat(parts[0].trim());
        const lng = parseFloat(parts[1].trim());

        if (isNaN(lat) || isNaN(lng)) return null;
        return {
            lat,
            lng
        };
    }

    // ==================================
    // POI Store
    // ==================================

    function schedulePoisPublish() {
        if (_publishScheduled) return;
        _publishScheduled = true;

        queueMicrotask(() => {
            _publishScheduled = false;
            window.currentPois = Array.from(poisByGuid.values());
            onPoisFetched(); // will call syncPoiMarkersWithCurrentPois()
        });
    }

    // ==================================
    // POI → Map UI synchronization
    // ==================================

    async function onPoisFetched() {
        if (!wfMap || isMapStale()) {
            mapClickCloseBound = false;
            wfMap = await getMap();
            if (!wfMap) return;
            setUpNewMap();
        }

        syncPoiMarkersWithCurrentPois();

        if (deepLinkSelectionPending) {
            trySelectDeepLinkedPoi();
        }
    }

    // ==================================
    // POI Normalisers
    // ==================================

    function normalizeIsCommunityContributed(v) {
        // Default to true unless explicitly false
        return (v === false) ? false : true;
    }

    function normalizeLivePoisInRadiusPoi(p) {
        const guid = String(p.guid ?? p.poiId ?? "");
        if (!guid) return null;

        const lat = p.lat;
        const lng = p.lng;

        const title = p.title ?? "";
        const description = p.description ?? "";
        const rawImageUrl = (p.imageUrl ?? p.mainImage ?? "");

        const imageUrl = normalizeImageUrlMaybeUpgrade({
            guid,
            title,
            lat,
            lng,
            imageUrl: rawImageUrl
        });

        return {
            guid,
            lat,
            lng,
            title,
            description,
            imageUrl
        };
    }

    function normalizeGcsPoi(p) {
        if (!p) return null;

        const guid = String(p.poiId ?? "");
        if (!guid) return null;

        const lat = (typeof p.latE6 === "number") ? (p.latE6 / 1e6) : null;
        const lng = (typeof p.lngE6 === "number") ? (p.lngE6 / 1e6) : null;
        if (lat == null || lng == null) return null;

        const title = p.title ?? "";
        const description = p.description ?? "";

        const gmo = Array.isArray(p.gmo) ? p.gmo : [];
        const { pgoEntity, pgoEntityStatus } = extractPgoFromGmo(gmo);

        const rawImageUrl = (p.mainImage ?? "");
        const imageUrl = normalizeImageUrlMaybeUpgrade({
            guid,
            title,
            lat,
            lng,
            imageUrl: rawImageUrl
        });

        return {
            guid,
            lat,
            lng,
            title,
            description,
            imageUrl,

            // GCS-preferred fields
            address: p.address,
            gmo,
            isCommunityContributed: p.isCommunityContributed,
            hasAdditionalImages: p.hasAdditionalImages,
            pgoEntity,
            pgoEntityStatus
        };
    }

    function extractAndNormalizeGcsPois(json) {
        const data = json?.result?.data;
        if (!Array.isArray(data)) return [];

        const out = [];
        for (const cell of data) {
            const pois = cell?.pois;
            if (!Array.isArray(pois)) continue;

            for (const p of pois) {
                const norm = normalizeGcsPoi(p);
                if (norm) out.push(norm);
            }
        }
        return out;
    }

    function extractPgoFromGmo(gmo) {
        const arr = Array.isArray(gmo) ? gmo : [];
        const hh = arr.find(x => x && x.gameBrand === "HOLOHOLO");
        return {
            pgoEntity: hh?.entity || "",
            pgoEntityStatus: hh?.status || ""
        };
    }

    function normalizeImageUrlMaybeUpgrade({ guid, title, lat, lng, imageUrl }) {
        if (typeof imageUrl === "string" && imageUrl.startsWith("http://")) {
            console.warn("[POI] Insecure imageUrl upgraded to https", {
                guid,
                title,
                lat,
                lng,
                imageUrl
            });

            return "https://" + imageUrl.slice("http://".length);
        }
        return imageUrl ?? "";
    }

    // ==================================
    // POI Ingestion
    // ==================================

    function getOtherSourceSet(sourceName) {
        // only two sources right now
        return (sourceName === "gcs") ? liveGuids : gcsGuids;
    }

    function getSourceSet(sourceName) {
        return (sourceName === "gcs") ? gcsGuids : liveGuids;
    }

    function setSourceSet(sourceName, nextSet) {
        if (sourceName === "gcs") gcsGuids = nextSet;
        else liveGuids = nextSet;
    }

    function buildCombinedPoi(guid) {
        const hasLiveActive = liveGuids.has(guid);
        const hasGcsActive  = gcsGuids.has(guid);

        // If neither source currently claims it, it shouldn't exist in the combined store
        if (!hasLiveActive && !hasGcsActive) return null;

        const live = livePoisByGuid.get(guid) || null;

        // IMPORTANT RULE:
        // Only include GCS fields if the POI is currently in the GCS set.
        // If GCS dropped it, revert to live-only.
        const gcs = hasGcsActive ? (gcsPoisByGuid.get(guid) || null) : null;

        // Start with GCS (so address/gmo/pgo/isCommunityContributed/hasAdditionalImages come from GCS)
        const out = gcs ? { ...gcs } : { guid };

        // Now overlay the LIVE-preferred fields if we have live data cached
        // (and we keep it even if Live is no longer active, as long as GCS is still active)
        if (live) {
            out.guid = guid;

            // Live-preferred fields
            out.title = live.title ?? out.title ?? "";
            out.description = live.description ?? out.description ?? "";
            out.lat = (typeof live.lat === "number") ? live.lat : out.lat;
            out.lng = (typeof live.lng === "number") ? live.lng : out.lng;
            out.imageUrl = (live.imageUrl ?? out.imageUrl ?? "");
        }

        return out;
    }

    function recomputeCombinedForGuids(guids) {
        let didPrune = false;

        for (const guid of guids) {
            const combined = buildCombinedPoi(guid);

            if (!combined) {
                // no longer active in either source
                if (poisByGuid.delete(guid)) didPrune = true;

                // cleanup caches if fully gone
                if (!gcsGuids.has(guid)) gcsPoisByGuid.delete(guid);
                if (!liveGuids.has(guid) && !gcsGuids.has(guid)) livePoisByGuid.delete(guid);
                continue;
            }

            poisByGuid.set(guid, combined);
        }

        schedulePoisPublish();
        if (didPrune) pruneThumbQueue();
    }

    /**
     * Apply a full "snapshot" update from one source ("live" or "gcs").
     * - Upserts POIs into poisByGuid
     * - Removes POIs that were previously supplied by this source but not in the new snapshot,
     *   unless they are still present in the other source's active set.
     */
    function applySourcePoisSnapshot(sourceName, normalizedPois) {
        const prevSet = getSourceSet(sourceName);
        const otherSet = getOtherSourceSet(sourceName);

        const nextSet = new Set();
        const affected = new Set(prevSet); // start with previous actives

        const sourceMap = (sourceName === "gcs") ? gcsPoisByGuid : livePoisByGuid;

        for (const poi of normalizedPois) {
            if (!poi?.guid) continue;
            const guid = poi.guid;

            nextSet.add(guid);
            affected.add(guid);

            // Cache per-source data (do NOT write directly to poisByGuid here)
            sourceMap.set(guid, poi);
        }

        // Identify removals from this source
        for (const guid of prevSet) {
            if (nextSet.has(guid)) continue;

            affected.add(guid);

            if (sourceName === "gcs") {
                // GCS no longer claims it -> drop GCS cache now
                gcsPoisByGuid.delete(guid);
            } else {
                // Live no longer claims it:
                // If GCS still claims it, we KEEP the live cache (sticky live fields).
                // If GCS doesn't claim it either, drop the live cache.
                if (!gcsGuids.has(guid)) {
                    livePoisByGuid.delete(guid);
                }
            }
        }

        // Update active set for this source
        setSourceSet(sourceName, nextSet);

        // Recompute combined POIs only for impacted guids
        recomputeCombinedForGuids(affected);
    }

    // ==================================
    // Network: Live Pois in Radius API
    // ==================================

    function fetchLivePois(lat, lng) {
        const url = `/api/v1/vault/live-pois-in-radius?lat=${lat}&lng=${lng}&radius=${radius}`;

        const xhr = new XMLHttpRequest();
        xhr.open("GET", url, true);

        xhr.onload = function () {
            if (xhr.status !== 200) {
                console.error("POI request failed:", xhr.status);
                return;
            }

            let json;
            try {
                json = JSON.parse(xhr.responseText);
            } catch (e) {
                console.error("POI JSON parse error", e);
                return;
            }

            const livePois = json?.result?.pois || [];
            const normalized = [];

            for (const p of livePois) {
                const norm = normalizeLivePoisInRadiusPoi(p);
                if (norm) normalized.push(norm);
            }

            applySourcePoisSnapshot("live", normalized);
        };

        xhr.onerror = () => console.error("POI network error");
        xhr.send();
    }

    // ==================================
    // Network: Mapview/gcs api
    // ==================================

    function handleGcsResponseText(responseText) {
        if (!responseText) return;

        let json;
        try {
            json = JSON.parse(responseText);
        } catch {
            return;
        }

        if (json?.code && json.code !== "OK") return;
        if (json?.result?.success === false) return;

        const normalized = extractAndNormalizeGcsPois(json);

        // IMPORTANT: even if empty, this should clear gcsGuids and prune stale ones
        applySourcePoisSnapshot("gcs", normalized);
    }

    (function interceptXhrForGcs() {
        const origOpen = XMLHttpRequest.prototype.open;
        const origSend = XMLHttpRequest.prototype.send;

        XMLHttpRequest.prototype.open = function (method, url) {
            try { this._wfmm_url = url; } catch {}
            return origOpen.apply(this, arguments);
        };

        XMLHttpRequest.prototype.send = function () {
            try {
                const url = this._wfmm_url || "";
                if (typeof url === "string" && url.includes(GCS_ENDPOINT_PART)) {
                    this.addEventListener("load", function () {
                        try {
                            if (this.status >= 200 && this.status < 300) {
                                handleGcsResponseText(this.responseText);
                            }
                        } catch (e) {
                            console.error("[GCS][XHR] handler error:", e);
                        }
                    });
                }
            } catch (e) {
                console.error("[GCS][XHR] intercept error:", e);
            }

            return origSend.apply(this, arguments);
        };
    })();

    function requestGcsPoisForBounds(map) {
        const zoom = map.getZoom?.();
        if (typeof zoom !== "number" || zoom < GCS_MIN_ZOOM) {
            clearGcsPois();
            return;
        }

        // If on the Mapview route, stop after clearing gcs data
        // Mapview will do its own calls to gcs api
        if (isOnMapviewRoute()) return;

        // If on Submit route, call gcs api manually
        const bounds = map.getBounds?.();
        if (!bounds) return;

        const ne = bounds.getNorthEast();
        const sw = bounds.getSouthWest();

        const url = `/api/v1/vault/mapview/gcs?ne=(${ne.lat()},${ne.lng()})&sw=(${sw.lat()},${sw.lng()})`;

        try {
            if (map._wfmmGcsXhr) map._wfmmGcsXhr.abort();
        } catch (_) {}

        const xhr = new XMLHttpRequest();
        map._wfmmGcsXhr = xhr;

        xhr.open("GET", url, true);
        xhr.withCredentials = true;

        // No onload parsing here — interceptor handles it.
        xhr.send();
    }

    function clearGcsPois() {
        const prevSet = gcsGuids;
        gcsGuids = new Set();

        // Remove GCS cache for everything that was in GCS
        for (const guid of prevSet) {
            gcsPoisByGuid.delete(guid);
        }

        // Recompute combined for anything that was affected
        // - if still in liveGuids => becomes live-only
        // - if not in liveGuids => disappears
        recomputeCombinedForGuids(prevSet);
    }

    // ==================================
    // Mapview POI additional images (carousel support)
    // ==================================

    // Cache: guid -> { images: [{imageGuid, imageUrl}], fetchedAt }
    // Note: we keep it separate from your IDB; this is purely mapview detail enrichment.
    const poiImagesByGuid = new Map();

    // Optional: limit cache growth
    const POI_IMAGES_CACHE_MAX = 500;

    // Track in-flight fetches to avoid duplicate calls
    const poiImagesInFlight = new Map(); // guid -> Promise

    function shouldFetchAdditionalImages(poi) {
        // Your rule: fetch if hasAdditionalImages is NOT false (true/null/undefined allowed)
        if (!poi) return false;
        if (!poiImagesApiLive) return false;
        if (poi.hasAdditionalImages === false) return false;
        if (!poi.guid) return false;
        return true;
    }

    function normalisePoiImagesResponse(json) {
        const imgs = Array.isArray(json?.result?.images) ? json.result.images : [];
        return imgs
            .map(x => ({
            imageGuid: x?.imageGuid || null,
            imageUrl: x?.imageUrl || null
        }))
            .filter(x => !!x.imageUrl);
    }

    function evictOldPoiImagesCacheIfNeeded() {
        if (poiImagesByGuid.size <= POI_IMAGES_CACHE_MAX) return;

        // simple FIFO-ish eviction: remove oldest fetchedAt
        let oldestKey = null;
        let oldestAt = Infinity;

        for (const [k, v] of poiImagesByGuid.entries()) {
            const t = v?.fetchedAt || 0;
            if (t < oldestAt) {
                oldestAt = t;
                oldestKey = k;
            }
        }
        if (oldestKey) poiImagesByGuid.delete(oldestKey);
    }

    function fetchPoiImagesForGuid(guid) {
        if (!guid) return Promise.resolve([]);

        // cache hit
        const cached = poiImagesByGuid.get(guid);
        if (cached && Array.isArray(cached.images)) return Promise.resolve(cached.images);

        // in-flight de-dup
        if (poiImagesInFlight.has(guid)) return poiImagesInFlight.get(guid);

        const p = new Promise((resolve) => {
            const url = `/api/v1/vault/mapview/poi-images?poiId=${encodeURIComponent(guid)}`;

            const xhr = new XMLHttpRequest();
            xhr.open("GET", url, true);

            xhr.onload = function () {
                try {
                    if (xhr.status < 200 || xhr.status >= 300) {
                        resolve([]);
                        return;
                    }
                    const json = JSON.parse(xhr.responseText || "{}");
                    const images = normalisePoiImagesResponse(json);

                    poiImagesByGuid.set(guid, {
                        images,
                        fetchedAt: Date.now()
                    });
                    evictOldPoiImagesCacheIfNeeded();

                    resolve(images);
                } catch {
                    resolve([]);
                }
            };

            xhr.onerror = function () {
                resolve([]);
            };

            xhr.send();
        }).finally(() => {
            poiImagesInFlight.delete(guid);
        });

        poiImagesInFlight.set(guid, p);
        return p;
    }

    /**
 * Enrich a POI object with additionalImages (array) if available.
 * This is safe to call repeatedly; it only writes if the POI is still selected.
 */
    function ensurePoiAdditionalImagesLoaded(poi) {
        if (!shouldFetchAdditionalImages(poi)) return;

        const guid = poi.guid;

        // If already present on the POI, don't refetch
        if (Array.isArray(poi.additionalImages) && poi.additionalImages.length) return;

        fetchPoiImagesForGuid(guid).then((images) => {
            // If selection changed since request started, ignore
            if (selectedPoiGuid !== guid) return;

            // Attach to lastSelectedPoi (and the current arg if it's the same object)
            // images = [{imageGuid, imageUrl}]
            if (lastSelectedPoi && lastSelectedPoi.guid === guid) {
                lastSelectedPoi.additionalImages = images;
            }
            if (poi && poi.guid === guid) {
                poi.additionalImages = images;
            }
        });
    }

    // ==============================
    // Availability / Quotas
    // ==============================

    function getQuota(key) {
        return availableQuotas?.data?.[key] || null;
    }

    function getReportsAvailableToday() {
        return getQuota("POI_TAKEDOWN_REQUEST")?.submissionsLeft ?? 0;
    }

    function getReportsAvailableTomorrow() {
        return getQuota("POI_TAKEDOWN_REQUEST")?.dailyNewSubmissions ?? 0;
    }

    function getNominationsAvailableToday() {
        return getQuota("POI_SUBMISSION")?.submissionsLeft ?? 0;
    }

    async function updateAvailability({ force = false } = {}) {
        const now = Date.now();
        const ageMs = now - (availableQuotas.lastFetchedMs || 0);
        const CACHE_MS = 15000;

        if (!force && availableQuotas.lastFetchedMs && ageMs < CACHE_MS) {
            return availableQuotas;
        }

        return fetch("/api/v1/vault/submit/available", {
            method: "GET",
            credentials: "include"
        })
            .then(res => {
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            return res.json();
        })
            .then(json => {
            availableQuotas = {
                lastFetchedMs: now,
                data: (json && json.result) ? json.result : {},
                code: json?.code ?? null,
                captcha: !!json?.captcha
            };
            return availableQuotas;
        })
            .catch(err => {
            console.warn("[Availability] Failed to fetch /submit/available:", err);
            return availableQuotas; // keep prior cache
        });
    }

    // ==================================
    // Map instance management
    // ==================================

    function getPath() {
        return window.location.pathname || "";
    }

    function isOnSubmitRoute() {
        return getPath().startsWith(SUBMIT_ROUTE);
    }

    function isOnMapviewRoute() {
        return getPath().startsWith(MAPVIEW_ROUTE);
    }

    function isOnMapCapableRoute() {
        return isOnSubmitRoute() || isOnMapviewRoute();
    }

    function currentMapRouteKey() {
        return (window.location.pathname || "") + (window.location.search || "");
    }

    function scheduleMapRouteChange() {
        if (routeChangeTimer) clearTimeout(routeChangeTimer);
        // Small delay to collapse rapid replaceState/pushState bursts during Angular boot
        routeChangeTimer = setTimeout(() => {
            onMapRouteChange().catch(err => console.error("onMapRouteChange error", err));
        }, 50);
    }

    async function onMapRouteChange() {
        const seq = ++routeChangeSeq;

        const onMapRoute = isOnMapCapableRoute();
        const routeKey = currentMapRouteKey();

        if (!onMapRoute) {
            lastSetupRouteKey = null;
            teardownMap();
            return;
        }

        watchForLatLngElement();

        // If we already successfully set up this exact page state, don’t redo.
        if (routeKey === lastSetupRouteKey && wfMap && !isMapStale()) {
            return;
        }

        // Bug fix for geolocation on submit page
        kickstartGeolocationIfOnSubmitPage();

        // Tear down old map state now (safe even if wfMap is null)
        teardownMap();

        // Apply css styles specific for this route
        applyCssForCurrentRoute();

        // Stop zooming in on iOS devices
        setIOSMapZoomLock(true);

        // Find a fresh map
        const map = await getMap();

        // If another route change happened while waiting, abandon this run
        if (seq !== routeChangeSeq) return;

        if (!map) {
            console.warn("Wayfarer Map: getMap() returned null on route", routeKey);
            return;
        }

        wfMap = map;

        // Now we can set up
        setUpNewMap();

        // Mark success AFTER setup completes
        lastSetupRouteKey = routeKey;
    }

    function setIOSMapZoomLock(enabled) {
        if (!isIOS()) return;

        let meta = document.querySelector('meta[name="viewport"]');
        if (!meta) return; // or create it, but minimal = just bail

        if (enabled) {
            meta.setAttribute(
                "content",
                "width=device-width, initial-scale=1, viewport-fit=cover, maximum-scale=1, user-scalable=no"
            );
        } else {
            // restore to what you observed as the site's stable default
            meta.setAttribute(
                "content",
                "width=device-width, initial-scale=1, viewport-fit=cover"
            );
        }
    }

    function setupMapRouteWatcher() {
        const origPushState = history.pushState;
        const origReplaceState = history.replaceState;

        history.pushState = function (...args) {
            const ret = origPushState.apply(this, args);
            scheduleMapRouteChange();
            return ret;
        };

        history.replaceState = function (...args) {
            const ret = origReplaceState.apply(this, args);
            scheduleMapRouteChange();
            return ret;
        };

        window.addEventListener("popstate", scheduleMapRouteChange);

        // Initial load
        scheduleMapRouteChange();
    }

    function looksLikeGoogleMap(obj) {
        return !!(obj &&
                  typeof obj.getCenter === "function" &&
                  typeof obj.addListener === "function" &&
                  typeof obj.getDiv === "function");
    }

    function extractMapFromCtxEntry(entry) {
        if (!entry) return null;
        if (looksLikeGoogleMap(entry)) return entry; // mapview
        const m = entry?.componentRef?.map;          // submit
        return looksLikeGoogleMap(m) ? m : null;
    }

    function getMap() {
        return new Promise((resolve) => {
            let attempts = 80;

            function tryFindMap() {
                const candidates = document.querySelectorAll("app-submit-wayspot-map nia-map, app-wf-base-map");

                for (const el of candidates) {
                    const ctx = el && el.__ngContext__;
                    if (!ctx) continue;

                    for (const entry of ctx) {
                        try {
                            const map = extractMapFromCtxEntry(entry);
                            if (map) return resolve(map);
                        } catch { /* ignore */ }
                    }
                }

                if (attempts-- <= 0) return resolve(null);
                setTimeout(tryFindMap, 250);
            }

            tryFindMap();
        });
    }


    function isMapStale() {
        if (!wfMap || !wfMap.getDiv) return true;

        const div = wfMap.getDiv();
        if (!div) return true;

        // If the map's DOM container is no longer attached, this is a stale map
        if (!document.body.contains(div)) {
            return true;
        }

        return false;
    }

    function setUpNewMap() {
        setGoogleMapControls();

        if (deepLinkTarget) {
            applyDeepLinkMapView();
        } else {
            restoreMapView();
        }

        initMapRightClickCopy();

        // desktopSubmitMarker = null;
        // centerPinOverlay = null;

        wfMap.addListener("idle", () => {
            saveMapView();
            requestGcsPoisForBounds(wfMap);
        });

        initUserLocationMarker(wfMap);
        startGeolocationTracking(wfMap);

        if (!mapClickCloseBound) {
            mapClickCloseBound = true;
            wfMap.addListener("click", () => {
                if (poiInfoWindow) {
                    poiInfoWindow.close();
                }
            });
        }

        ensureSidePanel();
        ensureMapTopRightControls();
        applyPoiVisibilityToAllMarkers();
        loadDraftSubmissionsFromIDB();

        if (isOnSubmitRoute()) {
            // As a 'save draft' button to the submit webform
            wfmapmodsInjectNativeSubmitSaveDraftButton();

            // Code for modifying the pin on the Submit map
            if (currentMapMode === MAP_MODE.MOBILE) {
                hideNativeCenterPin();
                ensureCenterPinOverlay();
            } else if (currentMapMode === MAP_MODE.DESKTOP) {
                ensureDesktopSubmitMarker();
            }
        }

        if (isOnMapviewRoute()) {
            applyMapViewHiddenUi();
            initZoomHintClickToZoom(wfMap);
            createSubmissionPinControl();
        }

        updateAvailability();
    }

    function setGoogleMapControls() {
        if (!wfMap || !wfMap.setOptions) return;

        wfMap.setOptions({
            disableDefaultUI: false,
            zoomControl: true,
            streetViewControl: true,
            fullscreenControl: false,
            mapTypeControl: true,
            cameraControl: false,
            tilt: 0,
            mapTypeControlOptions: {
                style: google.maps.MapTypeControlStyle.DROPDOWN_MENU,
                position: google.maps.ControlPosition.TOP_LEFT,
                mapTypeIds: ["roadmap", "satellite", "hybrid"]
            }
        });

        // Override custom map stylers on mapview page
        const styles = [];
        wfMap.setOptions({ styles });
    }

    function applyMapViewHiddenUi() {
        if (!window.location.pathname.startsWith(MAPVIEW_ROUTE)) return;

        // Hide the top controls bar
        document.querySelectorAll(".top-controls").forEach(el => {
            el.classList.add("wfmapmods-hidden");
        });

        // Hide the map legend
        document.querySelectorAll("app-map-legend").forEach(el => {
            el.classList.add("wfmapmods-hidden");
        });

        // Hide the map controls
        document.querySelectorAll("app-map-controls").forEach(el => {
            el.classList.add("wfmapmods-hidden");
        });
    }

    function initUserLocationMarker(map) {
        userLocationMarker = new google.maps.Marker({
            map,
            clickable: false,
            zIndex: 9999,
            optimized: false,
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

    function focusMapOnSubmitterLocation(map) {
        if (!map) return;

        if (!hasSubmitterLocation()) {
            console.warn("Wayfarer Map: No live location yet");
            // Optionally show a toast/alert: “Waiting for location permission…”
            return;
        }

        const latLng = new google.maps.LatLng(submitterLocation.lat, submitterLocation.lng);

        map.panTo(latLng);
        map.setZoom(Math.max(map.getZoom(), 18));
    }

    function teardownMap() {
        // Close info window
        try {
            if (poiInfoWindow) poiInfoWindow.close();
        } catch {}

        closeWayspotDetailOverlay();

        if (zoomHintObserver) {
            zoomHintObserver.disconnect();
            zoomHintObserver = null;
        }

        setIOSMapZoomLock(false);

        // Reset map click guard and map reference
        mapClickCloseBound = false;
        wfMap = null;

        // Reset map-mode artifacts so setup rebuilds them cleanly
        desktopSubmitMarker = null;
        centerPinOverlay = null;

        stopGeolocationTracking();

        // Remove POIs
        poisByGuid.clear();
        gcsGuids.clear();
        liveGuids.clear();
        window.currentPois = [];
        clearAllPoiMarkers();

        // Submission pin control cleanup
        try {
            if (submissionPinClassObserver) {
                submissionPinClassObserver.disconnect();
                submissionPinClassObserver = null;
            }
        } catch {}
        submissionPinButton = null;

        // Remove route-specific Niantic css
        removeInjectedCss("wfmapmods-submit-route-css");
        removeInjectedCss("wfmapmods-mapview-route-css");
    }


    // ==================================
    // Submission pin button
    // ==================================

    /**
 * Creates the "submission pin" toggle control on the map (Mapview route only).
 * - Google Maps control in LEFT_TOP
 * - Click toggles submissionPinEnabled
 */
    function createSubmissionPinControl() {
        if (typeof isOnMapviewRoute === "function" && !isOnMapviewRoute()) return;

        const map = wfMap;
        if (!window.google || !google.maps || !map) return;

        if (map._submissionPinControlAdded) return;
        map._submissionPinControlAdded = true;

        const controlDiv = document.createElement("div");
        const controlUI = document.createElement("div");
        controlUI.className = "wf-submission-pin-control";
        controlUI.title = "Toggle submission pin";
        controlUI.dataset.wfToggleGroup = WF_TOGGLE_GROUP;

        const iconWrapper = document.createElement("span");
        iconWrapper.className = "wf-icon-wrapper";
        iconWrapper.innerHTML = SUBMISSION_PIN;

        const svg = iconWrapper.querySelector("svg");

        controlUI.appendChild(iconWrapper);
        controlDiv.appendChild(controlUI);

        // IMPORTANT: stop map gestures in CAPTURE phase, before Google Maps handles them
        const swallow = (e) => {
            e.preventDefault();
            e.stopPropagation();
        };

        ["pointerdown", "mousedown", "touchstart", "dblclick"].forEach((type) => {
            controlUI.addEventListener(type, swallow, { capture: true, passive: false });
        });

        controlUI.addEventListener("click", (e) => {
            e.preventDefault();
            e.stopPropagation();

            wfExclusiveToggle(controlUI, WF_TOGGLE_GROUP);
            syncSubmissionPinEnabledFromDom();
        });

        map.controls[google.maps.ControlPosition.LEFT_TOP].push(controlDiv);
        submissionPinButton = controlUI;

        // Start observing so we react when another plugin turns us off
        observeSubmissionPinClass();

        // Ensure mode matches initial state
        syncSubmissionPinEnabledFromDom();
    }

    function syncSubmissionPinEnabledFromDom() {
        const enabled = !!submissionPinButton?.classList.contains(WF_TOGGLE_ACTIVE_CLASS);

        // Cursor reflects mode immediately
        setMapCursorForSubmissionPin(enabled);

        if (enabled) {
            // Stay hidden until we actually have coordinates (i.e. first click)
            setLocationFunctionsHidden(true);

            // Enter placement mode (bind click listener)
            enableSubmissionPinMode();
        } else {
            // Turn off: always hide panel and clean up
            setLocationFunctionsHidden(true);

            disableSubmissionPinMode();
            clearSubmissionRelatedCircles();
        }
    }

    function observeSubmissionPinClass() {
        if (!submissionPinButton) return;
        if (submissionPinClassObserver) submissionPinClassObserver.disconnect();

        submissionPinClassObserver = new MutationObserver(() => {
            syncSubmissionPinEnabledFromDom();
        });

        submissionPinClassObserver.observe(submissionPinButton, {
            attributes: true,
            attributeFilter: ["class"],
        });
    }

    function wfExclusiveToggle(buttonEl, group = WF_TOGGLE_GROUP) {
        if (!buttonEl) return false;

        // Mark it as part of the group so other scripts can find it
        buttonEl.dataset.wfToggleGroup = group;

        const isActive = buttonEl.classList.contains(WF_TOGGLE_ACTIVE_CLASS);

        if (isActive) {
            // Clicking an active button turns it off
            buttonEl.classList.remove(WF_TOGGLE_ACTIVE_CLASS);
            return false;
        }

        // Turn off all other toggles in this group
        document
            .querySelectorAll(`[data-wf-toggle-group="${group}"].${WF_TOGGLE_ACTIVE_CLASS}`)
            .forEach((el) => {
            if (el !== buttonEl) el.classList.remove(WF_TOGGLE_ACTIVE_CLASS);
        });

        // Turn this one on
        buttonEl.classList.add(WF_TOGGLE_ACTIVE_CLASS);
        return true;
    }

    // ==================================
    // Submission pin on Mapview page
    // ==================================

    // Turn SVG string into a marker icon URL
    function svgToDataUrl(svg) {
        // Keep it simple + safe for Google Maps icon url
        const encoded = encodeURIComponent(svg)
        .replace(/'/g, "%27")
        .replace(/"/g, "%22");
        return `data:image/svg+xml;charset=UTF-8,${encoded}`;
    }

    // Build the marker icon with correct anchor at bottom-centre
    function getSubmissionPinIcon(pxWidth = 30, pxHeight = 47) {
        return {
            url: svgToDataUrl(SUBMISSION_PIN),
            scaledSize: new google.maps.Size(pxWidth, pxHeight),
            anchor: new google.maps.Point(pxWidth / 2, pxHeight), // bottom-centre
        };
    }

    function enableSubmissionPinMode() {
        const map = wfMap;
        if (!map || !google?.maps) return;

        if (submissionPinMapClickListener) return; // avoid double-binding

        submissionPinMapClickListener = map.addListener("click", (e) => {
            if (!e?.latLng) return;

            const lat = e.latLng.lat();
            const lng = e.latLng.lng();

            // Create or move marker
            if (!submissionPinMarker) {
                submissionPinMarker = new google.maps.Marker({
                    map,
                    position: e.latLng,
                    clickable: false,
                    icon: getSubmissionPinIcon(30, 47),
                    zIndex: 999999,
                });
            } else {
                submissionPinMarker.setPosition(e.latLng);
                submissionPinMarker.setMap(map);
            }

            // Update global coordinates
            window.currentLat = lat;
            window.currentLng = lng;

            // Now that we have valid coords, show the panel
            setLocationFunctionsHidden(false);

            handleLatLngChange(lat, lng);
        });
    }

    function disableSubmissionPinMode() {
        // Remove click listener
        if (submissionPinMapClickListener) {
            google.maps.event.removeListener(submissionPinMapClickListener);
            submissionPinMapClickListener = null;
        }

        // Remove marker
        if (submissionPinMarker) {
            submissionPinMarker.setMap(null);
            submissionPinMarker = null;
        }
    }

    function setLocationFunctionsHidden(hidden) {
        document
            .querySelectorAll(".wfmapmods-section-location-functions")
            .forEach((el) => el.classList.toggle("wfmapmods-hidden", hidden));

        document
            .querySelectorAll(".wfmapmods-divider-3")
            .forEach((el) => el.classList.toggle("wfmapmods-hidden", hidden));
    }

    function setMapCursorForSubmissionPin(enabled) {
        if (!wfMap) return;

        wfMap.setOptions({
            draggableCursor: enabled ? "default" : null
        });
    }

    // ==================================
    // Get user location
    // ==================================

    function setSubmitterLocation(lat, lng) {
        if (typeof lat !== "number" || typeof lng !== "number") return;

        submitterLocation = { lat, lng };

        // Update radius circle immediately
        updateSubmitRadiusCircle();
    }

    function hasSubmitterLocation() {
        return !!(
            submitterLocation &&
            typeof submitterLocation.lat === "number" &&
            typeof submitterLocation.lng === "number" &&
            Number.isFinite(submitterLocation.lat) &&
            Number.isFinite(submitterLocation.lng)
        );
    }

    function startGeolocationTracking(map) {
        if (!navigator.geolocation) {
            console.warn("Wayfarer Map: Geolocation not supported");
            return;
        }

        // Avoid multiple watches
        if (geoWatchId != null) return;

        // Optional: do a one-shot first so UI populates quickly
        navigator.geolocation.getCurrentPosition(
            (pos) => {
                const lat = pos.coords.latitude;
                const lng = pos.coords.longitude;

                setSubmitterLocation(lat, lng, pos.timestamp || Date.now());

                // Move blue dot
                if (userLocationMarker) {
                    userLocationMarker.setPosition(new google.maps.LatLng(lat, lng));
                    userLocationMarker.setVisible(true);
                }
            },
            (err) => {
                console.warn("Wayfarer Map: initial geolocation failed:", err.message);
                // Don’t return; we can still try watchPosition below (sometimes succeeds)
            },
            {
                enableHighAccuracy: true,
                maximumAge: 5000,
                timeout: 8000
            }
        );

        geoWatchId = navigator.geolocation.watchPosition(
            (pos) => {
                const lat = pos.coords.latitude;
                const lng = pos.coords.longitude;

                setSubmitterLocation(lat, lng, pos.timestamp || Date.now());

                // Move user-location blue dot
                if (userLocationMarker) {
                    userLocationMarker.setPosition(new google.maps.LatLng(lat, lng));
                    userLocationMarker.setVisible(true);
                }
            },
            (err) => {
                // IMPORTANT: watchPosition can error intermittently (esp. Android)
                console.warn("Wayfarer Map: watchPosition error:", err.message);
            },
            {
                enableHighAccuracy: true,
                maximumAge: 5000,
                timeout: 15000
            }
        );
    }

    function stopGeolocationTracking() {
        if (geoWatchId != null && navigator.geolocation) {
            navigator.geolocation.clearWatch(geoWatchId);
        }
        geoWatchId = null;
    }

    // ==============================
    // Clipboard + coordinate helpers
    // ==============================

    function formatCoords(lat, lng, decimals = 6) {
        const la = Number(lat);
        const ln = Number(lng);
        if (!Number.isFinite(la) || !Number.isFinite(ln)) return "";
        return `${la.toFixed(decimals)},${ln.toFixed(decimals)}`; // no space, consistent everywhere
    }

    function copyTextToClipboard(text) {
        if (!text) return Promise.reject(new Error("Nothing to copy"));

        if (navigator.clipboard?.writeText) {
            return navigator.clipboard.writeText(text);
        }

        // Fallback
        return new Promise((resolve, reject) => {
            const ta = document.createElement("textarea");
            ta.value = text;
            ta.setAttribute("readonly", "");
            ta.style.position = "fixed";
            ta.style.left = "-9999px";
            document.body.appendChild(ta);
            ta.select();

            let ok = false;
            try {
                ok = document.execCommand("copy");
            } catch {
                ok = false;
            } finally {
                document.body.removeChild(ta);
            }

            ok ? resolve() : reject(new Error("execCommand copy failed"));
        });
    }

    function copyCoordsToClipboard(lat, lng, decimals = 6) {
        const text = formatCoords(lat, lng, decimals);
        if (!text) return Promise.reject(new Error("Invalid coordinates"));
        return copyTextToClipboard(text);
    }

    // ==================================
    // Right click to copy coordinates
    // ==================================

    function initMapRightClickCopy() {
        if (!wfMap || typeof google === "undefined" || !google.maps) return;
        if (wfMap._wfmapmodsRightClickBound) return;
        wfMap._wfmapmodsRightClickBound = true;

        google.maps.event.addListener(wfMap, "rightclick", (ev) => {
            if (!ev?.latLng) return;

            // Prevent browser context menu
            ev?.domEvent?.preventDefault?.();

            const lat = ev.latLng.lat();
            const lng = ev.latLng.lng();
            showMapRightClickMenu(lat, lng, ev);
        });
    }

    function showMapRightClickMenu(lat, lng, ev) {
        const mapDiv = wfMap?.getDiv?.();
        if (!mapDiv) return;

        removeMapRightClickMenu();

        const rect = mapDiv.getBoundingClientRect();
        const domEvt = ev?.domEvent;

        const clientX = typeof domEvt?.clientX === "number" ? domEvt.clientX : rect.left + rect.width / 2;
        const clientY = typeof domEvt?.clientY === "number" ? domEvt.clientY : rect.top + rect.height / 2;

        const coordsText = formatCoords(lat, lng); // <-- single source of truth
        if (!coordsText) return;

        const menu = document.createElement("div");
        menu.className = "wfmapmods-map-context-menu";
        menu.style.setProperty("--wfmapmods-menu-left", `${clientX - rect.left}px`);
        menu.style.setProperty("--wfmapmods-menu-top", `${clientY - rect.top}px`);

        const label = document.createElement("div");
        label.className = "wfmapmods-map-context-label";
        label.textContent = coordsText;
        label.title = "Click to copy map coordinates";

        const copyBtn = document.createElement("button");
        copyBtn.type = "button";
        copyBtn.className = "wfmapmods-map-context-btn";
        copyBtn.textContent = "Copy";

        const doCopy = () => {
            copyTextToClipboard(coordsText).catch(() => {});
            removeMapRightClickMenu();
        };

        label.addEventListener("click", doCopy);
        copyBtn.addEventListener("click", doCopy);

        menu.append(label, copyBtn);
        mapDiv.appendChild(menu);
        mapRightClickMenuEl = menu;

        document.addEventListener("click", mapRightClickDocHandler, true);
        document.addEventListener("contextmenu", mapRightClickDocHandler, true);
        document.addEventListener("keydown", mapRightClickKeyHandler, true);
    }

    function removeMapRightClickMenu() {
        if (!mapRightClickMenuEl) return;
        mapRightClickMenuEl.remove();
        mapRightClickMenuEl = null;
        document.removeEventListener("click", mapRightClickDocHandler, true);
        document.removeEventListener("contextmenu", mapRightClickDocHandler, true);
        document.removeEventListener("keydown", mapRightClickKeyHandler, true);
    }

    function mapRightClickDocHandler(e) {
        if (!mapRightClickMenuEl) return;
        if (e.target === mapRightClickMenuEl || mapRightClickMenuEl.contains(e.target)) return;
        removeMapRightClickMenu();
    }

    function mapRightClickKeyHandler(e) {
        if (e.key === "Escape") removeMapRightClickMenu();
    }

    // ==================================
    // Left click on zoom hint to zoom to POI loading level
    // ==================================

    function initZoomHintClickToZoom(map) {
        if (!map) return;

        // If it's already on the page right now, bind immediately
        bindZoomHintPillIfPresent(map);

        // Watch for Angular adding/removing it as zoom changes
        if (zoomHintObserver) zoomHintObserver.disconnect();

        zoomHintObserver = new MutationObserver(() => {
            bindZoomHintPillIfPresent(map);
        });

        zoomHintObserver.observe(document.body, {
            childList: true,
            subtree: true,
        });
    }

    function bindZoomHintPillIfPresent(map) {
        // Narrow selector to the pill you described
        const pill = document.querySelector(".zoom-hint-pill");
        if (!pill) return;

        // Avoid binding multiple times as MutationObserver fires
        if (pill.dataset.wfmmClickBound === "1") return;
        pill.dataset.wfmmClickBound = "1";

        // Use capture so we can intercept early, then stop it reaching the map
        pill.addEventListener("click", (e) => {
            // Prevent the map click behind it
            e.preventDefault();
            e.stopPropagation();
            if (typeof e.stopImmediatePropagation === "function") e.stopImmediatePropagation();

            // Zoom to the minimum zoom you want (your global constant)
            const current = map.getZoom?.();
            if (typeof current === "number" && current >= GCS_MIN_ZOOM) return;

            const center = map.getCenter?.();
            map.setZoom?.(GCS_MIN_ZOOM);

            // Optional: keep the same center stable after zoom
            if (center && map.panTo) map.panTo(center);
        }, true);

        // (Optional) If the element is click-through because of CSS layering,
        // reinforce it inline as well.
        pill.style.pointerEvents = "auto";
    }

    // ==================================
    // Map view persistence
    // ==================================

    const MAP_VIEW_KEY = "wfmapmods-map-view";

    function saveMapView() {
        try {
            if (!wfMap || typeof google === "undefined" || !google.maps) return;

            const center = wfMap.getCenter();
            if (!center) return;

            const zoom = wfMap.getZoom();

            let markerLat = window.currentLat;
            let markerLng = window.currentLng;

            const data = {
                lat: center.lat(),
                lng: center.lng(),
                zoom: typeof zoom === "number" ? zoom : null,
                markerLat: markerLat,
                markerLng: markerLng
            };

            localStorage.setItem(MAP_VIEW_KEY, JSON.stringify(data));
        } catch (e) {
            console.warn("Wayfarer Map: Failed to save map view:", e);
        }
    }

    function restoreMapView() {
        // If we have a deep-link for this load, do not restore the saved map view
        if (skipRestoreMapViewForThisLoad) return;

        if (!userSettings.map || !userSettings.map.rememberLastView) return;
        if (!wfMap) return;

        const raw = localStorage.getItem(MAP_VIEW_KEY);
        if (!raw) return;

        let parsed;
        try {
            parsed = JSON.parse(raw);
        } catch (e) {
            console.warn("Wayfarer Map: Failed to parse saved map view:", e);
            return;
        }

        const lat = parseFloat(parsed.lat);
        const lng = parseFloat(parsed.lng);
        const zoom = parsed.zoom != null ? parseInt(parsed.zoom, 10) : null;

        const markerLat = parsed.markerLat != null ? parseFloat(parsed.markerLat) : null;
        const markerLng = parsed.markerLng != null ? parseFloat(parsed.markerLng) : null;

        if (Number.isNaN(lat) || Number.isNaN(lng)) return;

        // Capture the specific map instance and route key for safety
        const mapAtSchedule = wfMap;
        const routeKeyAtSchedule = currentMapRouteKey();

        // Don’t restore immediately: wait for first render/idle so projection & internals exist.
        google.maps.event.addListenerOnce(mapAtSchedule, "idle", () => {
            // If we navigated again, or the map changed / is stale, abandon.
            if (mapAtSchedule !== wfMap) return;
            if (routeKeyAtSchedule !== currentMapRouteKey()) return;
            if (isMapStale()) return;

            const centerLatLng = new google.maps.LatLng(lat, lng);

            try {
                mapAtSchedule.setCenter(centerLatLng);
                if (typeof zoom === "number" && !Number.isNaN(zoom)) {
                    mapAtSchedule.setZoom(zoom);
                }
            } catch (e) {
                console.warn("Wayfarer Map: restore setCenter/setZoom failed:", e);
                return;
            }

            // --- Restore submission marker location ---
            // Do this on the next tick *after* camera changes settle.
            if (!Number.isNaN(markerLat) && !Number.isNaN(markerLng)) {
                const savedMarkerLatLng = new google.maps.LatLng(markerLat, markerLng);

                setTimeout(() => {
                    // Re-check again right before firing the synthetic click
                    if (mapAtSchedule !== wfMap) return;
                    if (routeKeyAtSchedule !== currentMapRouteKey()) return;
                    if (isMapStale()) return;

                    try {
                        google.maps.event.trigger(mapAtSchedule, "click", { latLng: savedMarkerLatLng });
                    } catch (e) {
                    }
                }, 0);
            }
        });
    }


    // ==================================
    // Deep links
    // ==================================

    function parseDeepLinkFromLocation() {
        const search = window.location.search || "";
        if (!search || search.length < 3) return null;

        // Only treat it as a deep link if there are NO '=' characters:
        if (search.indexOf("=") !== -1) return null;

        const raw = decodeURIComponent(search.substring(1));
        return parseLatLng(raw);
    }

    function buildDeepLinkUrl(lat, lng) {
        if (typeof lat !== "number" || typeof lng !== "number" ||
            !Number.isFinite(lat) || !Number.isFinite(lng)) {
            return window.location.href;
        }

        const base = window.location.origin + window.location.pathname;
        const latStr = lat.toFixed(6);
        const lngStr = lng.toFixed(6);
        return `${base}?${latStr},${lngStr}`;
    }

    function applyDeepLinkMapView() {
        if (!wfMap || !deepLinkTarget) return;

        const { lat, lng } = deepLinkTarget;
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;

        const centerLatLng = new google.maps.LatLng(lat, lng);

        flyToLatLngAndClick(centerLatLng);

        // Mark that we still need to auto-select when POIs load
        deepLinkSelectionPending = true;
        skipRestoreMapViewForThisLoad = true;
    }

    function trySelectDeepLinkedPoi() {
        if (!deepLinkTarget || !Array.isArray(window.currentPois) || window.currentPois.length === 0) {
            return;
        }

        const { lat: targetLat, lng: targetLng } = deepLinkTarget;
        if (!Number.isFinite(targetLat) || !Number.isFinite(targetLng)) return;

        const MAX_DISTANCE_METRES = 2;

        let closestPoi = null;
        let closestDistance = Infinity;

        for (const poi of window.currentPois) {
            if (!Number.isFinite(poi.lat) || !Number.isFinite(poi.lng)) continue;

            const d = distanceMeters(targetLat, targetLng, poi.lat, poi.lng);
            if (d <= MAX_DISTANCE_METRES && d < closestDistance) {
                closestDistance = d;
                closestPoi = poi;
            }
        }

        // If nothing is within 2m, stay in "pending" mode.
        // This is to counteract initial fetch on page load messing things up
        if (!closestPoi) {
            console.log('Deep Links: No POI within 2m yet; will try again on next POI fetch');
            return;
        }

        // We found a match: publish and then clear the deep-link state.
        publishPoiToBridge(closestPoi);

        // Reset values ONLY on success
        deepLinkTarget = null;
        skipRestoreMapViewForThisLoad = false;
        deepLinkSelectionPending = false;
    }

    // ==================================
    // Search & geocoding helpers
    // ==================================

    function handleSearchSubmit(rawValue) {
        if (!wfMap) return;

        const value = (rawValue || "").trim();
        if (!value) return;

        // 1) Try to parse "lat,lng"
        const latLng = tryParseLatLng(value);
        if (latLng) {
            flyToLatLngAndClick(latLng);
            return;
        }

        // 2) Fallback to geocoding the address
        if (typeof google !== "undefined" && google.maps && google.maps.Geocoder) {
            const geocoder = new google.maps.Geocoder();
            geocoder.geocode({
                address: value
            }, (results, status) => {
                if (status === "OK" && results && results[0]) {
                    const loc = results[0].geometry.location;
                    flyToLatLngAndClick(loc);
                } else {
                    console.warn("[Wayfarer Map] Geocode failed:", status);
                }
            });
        } else {
            console.warn("[Wayfarer Map] Google Maps Geocoder not available");
        }
    }

    function tryParseLatLng(str) {
        // Basic "lat,lng" parser: e.g. "-31.9535, 115.8570"
        const match = str.match(/^\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*$/);
        if (!match) return null;

        const lat = parseFloat(match[1]);
        const lng = parseFloat(match[2]);
        if (isNaN(lat) || isNaN(lng)) return null;

        return new google.maps.LatLng(lat, lng);
    }

    function flyToLatLngAndClick(latLng) {
        if (!wfMap || !latLng) return;

        wfMap.setCenter(latLng);

        const z = wfMap.getZoom();
        if (typeof z === "number" && z < GCS_MIN_ZOOM) {
            wfMap.setZoom(GCS_MIN_ZOOM);
        }

        // Simulate a map click at this location so your existing logic runs
        google.maps.event.trigger(wfMap, "click", {
            latLng
        });
    }

    function setupSearchAutocomplete(inputEl) {
        if (!inputEl) return;
        if (typeof google === "undefined" || !google.maps || !google.maps.places) {
            // Places library not loaded; silent no-op
            return;
        }

        try {
            const autocomplete = new google.maps.places.Autocomplete(inputEl, {
                fields: ["geometry", "name"],
            });

            autocomplete.addListener("place_changed", () => {
                const place = autocomplete.getPlace();
                if (!place || !place.geometry || !place.geometry.location) return;
                flyToLatLngAndClick(place.geometry.location);
            });
        } catch (e) {
            console.warn("[Wayfarer Map] Failed to init Places Autocomplete:", e);
        }
    }

    // ==================================
    // Create circular overlays
    // ==================================

    function isValidLatLng(lat, lng) {
        return (
            typeof lat === "number" &&
            typeof lng === "number" &&
            Number.isFinite(lat) &&
            Number.isFinite(lng)
        );
    }

    function updatePowerSpotRadiusCircle(lat, lng) {
        if (!isValidLatLng(lat, lng)) return;

        updateCircleOverlay({
            circleRefName: "powerSpotRadiusCircle",
            center: {
                lat: lat,
                lng: lng
            },
            radiusMeters: 22,
            style: userSettings.map.powerSpotRadius
        });
    }

    function updateNearbyWayspotsRadiusCircle() {
        if (!isValidLatLng(lastFetchLat, lastFetchLng)) return;

        updateCircleOverlay({
            circleRefName: "nearbyWayspotsRadiusCircle",
            center: {
                lat: lastFetchLat,
                lng: lastFetchLng
            },
            radiusMeters: radius,
            style: userSettings.map.nearbyRadius
        });
    }

    function updateSubmitRadiusCircle() {
        updateCircleOverlay({
            circleRefName: "submitRadiusCircle",
            center: submitterLocation,
            radiusMeters: submitRadius,
            style: userSettings.map.submitRadius
        });
    }

    function updateSelectedPoiCircle(lat, lng) {
        if (!isValidLatLng(lat, lng)) return;

        updateCircleOverlay({
            circleRefName: "selectedPoiCircle80m",
            center: {
                lat,
                lng
            },
            radiusMeters: 80,
            style: userSettings.map.interactRadius
        });
    }

    function updateCircleOverlay(opts) {
        const {
            circleRefName,
            center,
            radiusMeters,
            style,
        } = opts;

        if (!wfMap) return;

        const {
            enabled,
            strokeColor,
            strokeOpacity,
            strokeWidth,
            fillColor,
            fillOpacity
        } = style || {};

        let circle = window[circleRefName] || null;

        // 1) Setting off -> always clear, regardless of center
        if (enabled === false) {
            if (circle) {
                circle.setMap(null);
                window[circleRefName] = null;
            }
            return;
        }

        // 2) No center -> treat as "hide/clear"
        if (!center) {
            if (circle) {
                circle.setMap(null);
                window[circleRefName] = null;
            }
            return;
        }

        // (Optional) guard against bogus radius
        const r = (typeof radiusMeters === "number" && Number.isFinite(radiusMeters) && radiusMeters >= 0)
        ? radiusMeters
        : 0;

        if (!circle) {
            circle = new google.maps.Circle({
                map: wfMap,
                center,
                radius: r,
                strokeColor: strokeColor,
                strokeOpacity: strokeOpacity ?? 0.8,
                strokeWeight: strokeWidth ?? 2,
                fillColor: fillColor,
                fillOpacity: fillOpacity ?? 0.0,
                clickable: false
            });

            window[circleRefName] = circle;
        } else {
            circle.setOptions({
                strokeColor: strokeColor,
                strokeOpacity: strokeOpacity ?? 0.8,
                strokeWeight: strokeWidth ?? 2,
                fillColor: fillColor,
                fillOpacity: fillOpacity ?? 0.0,
                clickable: false
            });
            circle.setCenter(center);
            circle.setRadius(r);
            circle.setMap(wfMap); // keep this for recreated map instances
        }
    }

    function clearSubmissionRelatedCircles() {
        updateCircleOverlay({
            circleRefName: "powerSpotRadiusCircle",
            center: null,
            radiusMeters: 0,
            style: { enabled: false }
        });

        updateCircleOverlay({
            circleRefName: "nearbyWayspotsRadiusCircle",
            center: null,
            radiusMeters: 0,
            style: { enabled: false }
        });
    }

    // ==================================
    // POI classification + filtering
    // ==================================

    function getPoiSource(poi) {
        // Default to community if the flag is missing or undefined
        return poi?.isCommunityContributed === false ? "import" : "community";
    }

    function getPoiGameObject(poi) {
        const entity = (poi?.pgoEntity || "").toUpperCase();
        const status = (poi?.pgoEntityStatus || "").toUpperCase();
        if (status !== "ACTIVE") return "none";

        if (entity === "GYM") return "gym";
        if (entity === "POKESTOP") return "pokestop";
        if (entity === "POWERSPOT") return "powerspot";
        return "none";
    }

    function shouldShowPoi(poi) {
        const f = userSettings?.poi?.filters;
        if (!f || f.enabled === false) return true;

        const src = getPoiSource(poi);
        const obj = getPoiGameObject(poi);

        const srcOk = f.source?.[src] !== false;          // default true
        const objOk = f.gameObject?.[obj] !== false;      // default true
        return srcOk && objOk;
    }

    // ==================================
    // POI appearance resolution (style keys, zIndex)
    // ==================================

    function getPoiMarkerZIndex(poi) {
        const obj = getPoiGameObject(poi);

        let baseZ;

        switch (obj) {
            case "gym":
                baseZ = 2000;
                break;
            case "pokestop":
                baseZ = 1900;
                break;
            case "powerspot":
                baseZ = 1800;
                break;
            default: // wayspot / none
                baseZ = 1700;
        }

        if (poi.guid && poi.guid === selectedPoiGuid) {
            return baseZ + 1000;
        }

        return baseZ;
    }

    function getPoiAppearanceKey(poi) {
        const a = userSettings.poi.appearance;

        const source = a.styleBy.source
        ? getPoiSource(poi)
        : "community";

        const obj = getPoiGameObject(poi);
        const kind = (a.styleBy.gameObject && (obj === "pokestop" || obj === "gym" || obj === "powerspot"))
        ? obj
        : "wayspot";

        return `${source}:${kind}`;
    }

    function getResolvedPoiAppearance(poi) {
        const a = userSettings.poi.appearance;

        const key = getPoiAppearanceKey(poi);
        const bucket = a.styles?.[key] || {};

        const markerType = bucket.markerType || "generic";

        // Merge defaults + bucket configs
        const thumbnail = { ...(a.defaults.thumbnail || {}), ...(bucket.thumbnail || {}) };
        const generic = { ...(a.defaults.generic || {}), ...(bucket.generic || {}) };

        return { key, markerType, thumbnail, generic };
    }

    function applyMarkerZIndex(marker, poi) {
        if (!marker || !poi) return;

        const base = getPoiMarkerZIndex(poi);
        const selected = (poi.guid && poi.guid === selectedPoiGuid);

        const z = selected ? (base + 1000) : base;

        // optional short-circuit
        if (marker.__wfmmZ === z) return;
        marker.__wfmmZ = z;

        if (typeof marker.setZIndex === "function") marker.setZIndex(z);
    }

    // ==================================
    // Thumbnail rendering pipeline (queue, cache, fetch, SVG icons)
    // ==================================

    // Simple concurrency limiter
    let _wfmmThumbFetchActive = 0;
    const _wfmmThumbFetchQueue = [];

    function limitConcurrency(max, fn, meta = {}) {
        let job;

        const promise = new Promise((resolve, reject) => {
            job = {
                max,
                fn,
                resolve,
                reject,
                started: false,
                ...meta
            };

            // Always enqueue normally. Selection promotion happens later.
            _wfmmThumbFetchQueue.push(job);

            pumpThumbQueue();
        });

        // Attach so callers can promote later
        promise.__wfmmJob = job;
        return promise;
    }

    function pumpThumbQueue() {
        if (_wfmmThumbFetchQueue.length === 0) return;

        const job = _wfmmThumbFetchQueue[0];
        if (_wfmmThumbFetchActive >= job.max) return;

        _wfmmThumbFetchQueue.shift();
        job.started = true;
        _wfmmThumbFetchActive++;

        Promise.resolve()
            .then(job.fn)
            .then(job.resolve, job.reject)
            .finally(() => {
            _wfmmThumbFetchActive--;
            pumpThumbQueue();
        });
    }

    function promoteQueuedThumbJob(job) {
        if (!job || job.started) return false;

        const idx = _wfmmThumbFetchQueue.indexOf(job);
        if (idx === -1) return false;

        _wfmmThumbFetchQueue.splice(idx, 1);
        _wfmmThumbFetchQueue.unshift(job);
        job.priority = true;

        pumpThumbQueue();
        return true;
    }

    function pruneThumbQueue() {
        if (_wfmmThumbFetchQueue.length === 0) return;

        for (let i = _wfmmThumbFetchQueue.length - 1; i >= 0; i--) {
            const job = _wfmmThumbFetchQueue[i];
            if (job.guid && !isGuidStillWanted(job.guid)) {
                // reject so awaiters don't hang
                job.reject?.(new Error("stale"));
                _wfmmThumbFetchQueue.splice(i, 1);
            }
        }
    }

    function isGuidStillWanted(guid) {
        return !!guid && poisByGuid && poisByGuid.has(guid);
    }

    function isPoiStillActive(guid, marker) {
        const entry = markersByGuid?.[guid];
        return !!entry && entry.marker === marker;
    }

    function getThumbImageCache() {
        if (!wfMap) return null;
        if (!wfMap._wfmmThumbImageCache) wfMap._wfmmThumbImageCache = new Map(); // key -> imageDataUrl
        return wfMap._wfmmThumbImageCache;
    }

    function getThumbImageInFlight() {
        if (!wfMap) return null;
        if (!wfMap._wfmmThumbImageInFlight) wfMap._wfmmThumbImageInFlight = new Map(); // key -> Promise<imageDataUrl>
        return wfMap._wfmmThumbImageInFlight;
    }

    function imageCacheGet(key) {
        const cache = getThumbImageCache();
        if (!cache || !cache.has(key)) return null;
        const v = cache.get(key);
        // LRU refresh
        cache.delete(key);
        cache.set(key, v);
        return v;
    }

    function imageCacheSet(key, value) {
        const cache = getThumbImageCache();
        if (!cache) return;
        if (cache.has(key)) cache.delete(key);
        cache.set(key, value);

        // LRU eviction
        while (cache.size > THUMB_IMAGE_CACHE_MAX) {
            const firstKey = cache.keys().next().value;
            cache.delete(firstKey);
        }
    }

    function blobToDataUrl(blob) {
        return new Promise((resolve, reject) => {
            const r = new FileReader();
            r.onload = () => resolve(r.result); // data:image/jpeg;base64,...
            r.onerror = reject;
            r.readAsDataURL(blob);
        });
    }

    function isNianticPlaceholderUrl(url) {
        if (!url) return false;
        // Use startsWith to tolerate appended params (=s36-c etc.)
        return String(url).startsWith(NIANTIC_PLACEHOLDER_IMAGE_URL);
    }

    function getNianticPlaceholderSvgDataUrl() {
        // Cache on wfMap or globally
        if (wfMap && wfMap._wfmmNianticPlaceholderSvgUrl) return wfMap._wfmmNianticPlaceholderSvgUrl;

        const svgUrl = "data:image/svg+xml;charset=UTF-8," + encodeURIComponent(NIANTIC_PLACEHOLDER_IMAGE_SVG);

        if (wfMap) wfMap._wfmmNianticPlaceholderSvgUrl = svgUrl;
        return svgUrl;
    }

    async function getOrFetchThumbImageDataUrl(rawImageUrl, size, guid, marker) {
        const key = `IMG|${rawImageUrl}|${size}`;

        const hit = imageCacheGet(key);
        if (hit) return hit;

        if (isNianticPlaceholderUrl(rawImageUrl)) {
            const v = getNianticPlaceholderSvgDataUrl();
            imageCacheSet(key, v);
            return v;
        }

        const inflight = getThumbImageInFlight();
        if (inflight?.has(key)) {
            const entry = inflight.get(key); // { promise, job }

            // If this call is for the selected POI, promote if still queued
            const wantsPriority = (guid && guid === selectedPoiGuid);
            if (wantsPriority) promoteQueuedThumbJob(entry?.job);

            return entry.promise;
        }

        const p = limitConcurrency(8, async () => {
            if (guid && !isGuidStillWanted(guid)) throw new Error("stale");
            if (guid && marker && !isPoiStillActive(guid, marker)) throw new Error("stale");

            const res = await fetch(rawImageUrl, { mode: "cors" });
            if (!res.ok) throw new Error(`fetch failed ${res.status}`);

            const blob = await res.blob();
            const dataUrl = await blobToDataUrl(blob);

            if (guid && !isGuidStillWanted(guid)) throw new Error("stale");
            if (guid && marker && !isPoiStillActive(guid, marker)) throw new Error("stale");

            return dataUrl;
        }, { guid, cacheKey: key });

        inflight?.set(key, { promise: p, job: p.__wfmmJob });

        try {
            const dataUrl = await p;
            imageCacheSet(key, dataUrl);
            return dataUrl;
        } finally {
            inflight?.delete(key);
        }
    }

    function svgThumbnailIconUrlEmbedded(imageDataUrl, size, borderColor, borderWidth, borderOpacity) {
        const s = Number(size) || 36;
        const r = s / 2;
        const bw = Math.max(0, Number(borderWidth) || 0);
        const bo = Math.min(1, Math.max(0, Number(borderOpacity) || 0));
        const bc = borderColor || "#ffffff";

        const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}" viewBox="0 0 ${s} ${s}">
      <defs>
        <clipPath id="c"><circle cx="${r}" cy="${r}" r="${r}"/></clipPath>
      </defs>

      <image href="${imageDataUrl}" x="0" y="0" width="${s}" height="${s}"
        preserveAspectRatio="xMidYMid slice"
        clip-path="url(#c)"/>

      ${bw > 0 ? `<circle cx="${r}" cy="${r}" r="${r - bw / 2}"
        fill="none" stroke="${bc}" stroke-width="${bw}" stroke-opacity="${bo}"/>` : ``}
    </svg>
  `.trim();

        return "data:image/svg+xml;charset=UTF-8," + encodeURIComponent(svg);
    }

    function makeThumbSvgIconUrlFromImageData(imageDataUrl, size, bc, bw, bo) {
        return svgThumbnailIconUrlEmbedded(imageDataUrl, size, bc, bw, bo);
    }

    function makeWayfarerLogoDataUrl(fillColor = "#ff4613") {
        // Force-fill any path(s) in the logo SVG to the desired color.
        // This targets fill="..." and also plain fill='#...'
        const colored = String(WAYFARER_LOGO_SVG)
        .replace(/fill\s*=\s*["'][^"']*["']/gi, `fill="${fillColor}"`);

        return "data:image/svg+xml;charset=UTF-8," + encodeURIComponent(colored);
    }

    function svgWayfarerPlaceholderIconUrl(size, borderColor, borderWidth, borderOpacity) {
        const s = Number(size) || 36;
        const r = s / 2;

        const bw = Math.max(0, Number(borderWidth) || 0);
        const bo = Math.min(1, Math.max(0, Number(borderOpacity) || 0));
        const bc = borderColor || "#ffffff";

        // White background inside the circle
        const bg = "#ffffff";

        // Logo color
        const logoColor = "#ff4613";
        const logoDataUrl = makeWayfarerLogoDataUrl(logoColor);

        // Fit logo inside circle
        const pad = s * 0.18;
        const imgSize = s - pad * 2;

        const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}" viewBox="0 0 ${s} ${s}">
      <defs>
        <clipPath id="c"><circle cx="${r}" cy="${r}" r="${r}"/></clipPath>
      </defs>

      <!-- white background -->
      <circle cx="${r}" cy="${r}" r="${r}" fill="${bg}" />

      <!-- logo centered -->
      <image href="${logoDataUrl}" x="${pad}" y="${pad}" width="${imgSize}" height="${imgSize}"
        preserveAspectRatio="xMidYMid meet" clip-path="url(#c)" />

      <!-- border -->
      ${bw > 0 ? `<circle cx="${r}" cy="${r}" r="${r - bw / 2}"
        fill="none" stroke="${bc}" stroke-width="${bw}" stroke-opacity="${bo}"/>` : ``}
    </svg>
  `.trim();

        return "data:image/svg+xml;charset=UTF-8," + encodeURIComponent(svg);
    }


    function getThumbPlaceholderCache() {
        if (!wfMap) return null;
        if (!wfMap._wfmmThumbPlaceholderCache) wfMap._wfmmThumbPlaceholderCache = new Map();
        return wfMap._wfmmThumbPlaceholderCache;
    }

    function getWayfarerPlaceholderUrl(size, bc, bw, bo) {
        const cache = getThumbPlaceholderCache();
        const key = `${size}|${bc}|${bw}|${bo}|WFPLACEHOLDER`;
        if (cache && cache.has(key)) return cache.get(key);

        const url = svgWayfarerPlaceholderIconUrl(size, bc, bw, bo);
        if (cache) cache.set(key, url);
        return url;
    }

    function setMarkerThumbIcon(marker, url, size)  {
        marker.setIcon({
            url: url,
            scaledSize: new google.maps.Size(size, size),
            anchor: new google.maps.Point(size / 2, size / 2)
        });
    }

    function applyNianticPlaceholderThumbNow(marker, size, bc, bw, bo) {
        const imageDataUrl = getNianticPlaceholderSvgDataUrl(); // data:image/svg+xml...
        const svgUrl = makeThumbSvgIconUrlFromImageData(imageDataUrl, size, bc, bw, bo);
        setMarkerThumbIcon(marker, svgUrl, size);
        marker.__wfmmThumbApplied = true;
    }

    function bumpMarkerRenderToken(marker) {
        marker.__wfmmRenderToken = (marker.__wfmmRenderToken || 0) + 1;
        return marker.__wfmmRenderToken;
    }

    // ==================================
    // Marker event wiring (click, bridge, etc.)
    // ==================================

    function addListenersToPoiMarker(marker, poi) {
        const guid = poi.guid;

        marker.addListener("click", () => {
            const latest = markersByGuid?.[guid]?.poi;
            if (!latest) return;

            publishPoiToBridge(latest);
        });
    }

    // ==================================
    // Marker visuals (thumbnail + generic rendering)
    // ==================================

    function getMarkerVisibilityForPoi(poi) {
        const layerOn = isWayspotsLayerEnabled();
        const visibleNow = layerOn && shouldShowPoi(poi);
        const mapForMarker = layerOn ? wfMap : null;
        return { layerOn, visibleNow, mapForMarker };
    }

    function getThumbParamsFromPoi(poi, ap) {
        const size = clamp(ap.thumbnail.size, 8, 96, 36);

        const rawUrl = poi.imageUrl
        ? poi.imageUrl + `=s${size}-c`
        : NIANTIC_PLACEHOLDER_IMAGE_URL + `=s${size}-c`;

        const t = ap.thumbnail || {};
        const baseBw = clamp(t.borderWidth, 0, 20, 3);
        const baseBc = normalizeHexColor(t.borderColor, "#ffffff");
        const baseBo = clamp(t.borderOpacity, 0, 1, 0.7);

        return { size, rawUrl, baseBw, baseBc, baseBo };
    }

    function resolveThumbBorderForPoi(guid, baseBw, baseBc, baseBo) {
        const selected = (guid && guid === selectedPoiGuid);
        return {
            bc: selected ? "#ff00ff" : baseBc,
            bw: selected ? clamp(baseBw + 2, 0, 20, 5) : baseBw,
            bo: selected ? 1 : baseBo,
            selected
        };
    }

    function applyThumbnailVisuals(marker, poi, ap) {
        const guid = poi.guid;
        const { size, rawUrl, baseBw, baseBc, baseBo } = getThumbParamsFromPoi(poi, ap);
        const { bc, bw, bo } = resolveThumbBorderForPoi(guid, baseBw, baseBc, baseBo);

        const styleKey = `TH|${rawUrl}|${size}|${bc}|${bw}|${bo}`;
        if (marker.__wfmmThumbStyleKey === styleKey) return;
        marker.__wfmmThumbStyleKey = styleKey;

        // Instant selection border even while loading:
        // - If the "image" is Niantic placeholder, render synchronously.
        if (isNianticPlaceholderUrl(rawUrl)) {
            const imageDataUrl = getNianticPlaceholderSvgDataUrl();
            const svgUrl = makeThumbSvgIconUrlFromImageData(imageDataUrl, size, bc, bw, bo);
            setMarkerThumbIcon(marker, svgUrl, size);
            marker.__wfmmThumbApplied = true;
            return;
        }

        // If still showing loading placeholder, update it immediately to current border.
        if (!marker.__wfmmThumbApplied) {
            const placeholderUrl = getWayfarerPlaceholderUrl(size, bc, bw, bo);
            setMarkerThumbIcon(marker, placeholderUrl, size);
        }

        const token = bumpMarkerRenderToken(marker);

        getOrFetchThumbImageDataUrl(rawUrl, size, guid, marker)
            .then((imageDataUrl) => {
            const cur = markersByGuid?.[guid];
            if (!cur || cur.marker !== marker) return;
            if (marker.__wfmmRenderToken !== token) return;

            // Decide border at apply-time again (selection may have changed)
            const final = resolveThumbBorderForPoi(guid, baseBw, baseBc, baseBo);
            const svgUrl = makeThumbSvgIconUrlFromImageData(imageDataUrl, size, final.bc, final.bw, final.bo);

            setMarkerThumbIcon(marker, svgUrl, size);
            marker.__wfmmThumbApplied = true;

            // Keep the styleKey consistent with what we actually applied
            marker.__wfmmThumbStyleKey = `TH|${rawUrl}|${size}|${final.bc}|${final.bw}|${final.bo}`;
        })
            .catch(() => {});
    }

    function applyGenericVisuals(marker, poi, ap) {
        const s = ap.generic || {};
        const baseIcon = {
            path: google.maps.SymbolPath.CIRCLE,
            strokeColor: s.borderColor,
            strokeOpacity: s.borderOpacity,
            strokeWeight: s.borderWidth,
            fillColor: s.fillColor,
            fillOpacity: s.fillOpacity,
            scale: s.markerSize ?? 8
        };

        const selected = (poi.guid && poi.guid === selectedPoiGuid);
        if (!selected) {
            marker.setIcon(baseIcon);
            return;
        }

        marker.setIcon({
            ...baseIcon,
            strokeColor: "#ff00ff",
            strokeOpacity: 1,
            strokeWeight: (baseIcon.strokeWeight || 2) + 2,
            scale: (baseIcon.scale || 8) + 1
        });
    }

    function clearSelectedMarkers() {
        // Remove the "selected" class from anything using it
        document.querySelectorAll(".wfmapmods-marker-selected").forEach((el) => {
            el.classList.remove("wfmapmods-marker-selected");
        });
    }

    function highlightThumbnailMarker(marker, poi, ap) {
        // NEW: selection is state; rendering happens in refreshPoiMarkerIcon
        const entry = markersByGuid?.[poi.guid];
        if (!entry || entry.marker !== marker) return;
        refreshPoiMarkerIcon(entry);
    }

    // ==================================
    // Marker lifecycle (create, refresh, upsert, sync, rebuild, clear)
    // ==================================

    function createPoiMarker(poi) {
        const ap = getResolvedPoiAppearance(poi);
        const { visibleNow, mapForMarker } = getMarkerVisibilityForPoi(poi);
        const zIndex = getPoiMarkerZIndex(poi);

        // Disable optimized thumbnails on submit route
        // Clashes with css that hides the canvas to get rid of default markers
        const optimized =
              !(isOnSubmitRoute() && ap.markerType === "thumbnail");

        const marker = new google.maps.Marker({
            position: { lat: poi.lat, lng: poi.lng },
            map: mapForMarker,
            visible: visibleNow,
            title: poi.title,
            zIndex,
            optimized
        });

        marker.__wfmmStyled = true;
        marker.__wfmmGuid = poi.guid;

        // init thumbnail state
        if (ap.markerType === "thumbnail") {
            marker.__wfmmThumbApplied = false;
            marker.__wfmmThumbStyleKey = null;

            // set an immediate placeholder (with correct current border)
            const { size, baseBw, baseBc, baseBo } = getThumbParamsFromPoi(poi, ap);
            const { bc, bw, bo } = resolveThumbBorderForPoi(poi.guid, baseBw, baseBc, baseBo);
            const placeholderUrl = getWayfarerPlaceholderUrl(size, bc, bw, bo);
            setMarkerThumbIcon(marker, placeholderUrl, size);

            // kick async final render
            applyThumbnailVisuals(marker, poi, ap);
        } else {
            applyGenericVisuals(marker, poi, ap);
        }

        addListenersToPoiMarker(marker, poi);
        return marker;
    }

    function refreshPoiMarkerIcon(entry) {
        const marker = entry?.marker;
        const poi = entry?.poi;
        if (!marker || !poi) return;

        applyMarkerZIndex(marker, poi);

        const visibleNow = isWayspotsLayerEnabled() && shouldShowPoi(poi);
        if (marker.__wfmmVisible !== visibleNow) {
            marker.__wfmmVisible = visibleNow;
            marker.setVisible(visibleNow);
        }

        const ap = getResolvedPoiAppearance(poi);

        if (ap.markerType === "thumbnail") {
            applyThumbnailVisuals(marker, poi, ap);
        } else {
            applyGenericVisuals(marker, poi, ap);
        }
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

            // zIndex
            if (typeof marker.setZIndex === "function") {
                marker.setZIndex(getPoiMarkerZIndex(poi));
            }

            refreshPoiMarkerIcon(existing);

        } else {
            const marker = createPoiMarker(poi);
            markersByGuid[guid] = { marker, poi };
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

    function syncPoiMarkersWithCurrentPois() {
        if (!wfMap || !Array.isArray(window.currentPois)) return;

        if (!poiInfoWindow) {
            poiInfoWindow = new google.maps.InfoWindow();
        }

        updateNearbyWayspotsRadiusCircle();

        // Filter POIs we actually want to render as markers
        const visiblePois = window.currentPois;

        // Build a set of guids from the visible POI list (important!)
        const newGuids = new Set(visiblePois.map(p => p.guid));

        removeStaleMarkers(newGuids);

        for (const poi of visiblePois) {
            upsertPoiMarker(poi);
        }
    }

    function rebuildAllPoiMarkers() {
        if (!wfMap || !Array.isArray(window.currentPois)) return;

        // Remove existing markers
        for (const guid in markersByGuid) {
            const entry = markersByGuid[guid];
            if (entry && entry.marker) {
                entry.marker.setMap(null);
            }
        }
        markersByGuid = {};

        // Recreate using current userSettings.poi
        for (const poi of window.currentPois) {
            upsertPoiMarker(poi);
        }
    }

    function clearAllPoiMarkers() {
        try {
            if (markersByGuid) {
                for (const guid in markersByGuid) {
                    const entry = markersByGuid[guid];
                    if (entry && entry.marker) {
                        entry.marker.setMap(null);
                    }
                }
            }
        } catch (e) {
            console.warn("[GCS] Failed to clear markers:", e);
        }

        // Hard reset the index to release references
        markersByGuid = {};
    }

    // ==================================
    // Visibility helpers (layer/filter visibility propagation)
    // ==================================

    function applyPoiVisibilityToMarkerEntry(entry) {
        if (!entry || !entry.marker) return;

        const marker = entry.marker;
        const poi = entry.poi;

        const layerOn = isWayspotsLayerEnabled();
        const filterOn = shouldShowPoi(poi);

        const visible = layerOn && filterOn;

        // Use setVisible instead of setMap
        marker.setVisible(visible);
    }

    function applyPoiVisibilityToAllMarkers() {
        if (!wfMap) return;
        for (const guid in markersByGuid) {
            applyPoiVisibilityToMarkerEntry(markersByGuid[guid]);
        }
    }

    // ==================================
    // Selection handling (state + selection visuals orchestration)
    // ==================================

    function applyPoiSelectionVisuals(poi) {
        if (!wfMap || !poi || typeof google === "undefined" || !google.maps) return;

        const prevGuid = selectedPoiGuid;
        const nextGuid = poi.guid || null;

        clearSelectedMarkers();

        selectedPoiGuid = nextGuid;
        lastSelectedPoi = poi;

        if (prevGuid && markersByGuid?.[prevGuid]) refreshPoiMarkerIcon(markersByGuid[prevGuid]);
        if (nextGuid && markersByGuid?.[nextGuid]) refreshPoiMarkerIcon(markersByGuid[nextGuid]);

        ensurePoiAdditionalImagesLoaded(poi);
        updateSelectedPoiCircle(poi.lat, poi.lng);

        if (currentMapMode === MAP_MODE.MOBILE) {
            const latLng = new google.maps.LatLng(poi.lat, poi.lng);
            showPoiInfoWindowForSelection(poi, latLng);
        }
    }

    // ==================================
    // css styles
    // ==================================

    function injectCss() {
        const {
            borderColor,
            borderWidth,
            borderOpacity
        } = userSettings.poi?.thumbnail || {};
        const thumbBorderRGBA = borderColor ? hexToRgba(borderColor, borderOpacity) : "rgba(0,0,0,0.5)";

        const cssText = `
/* =============================================================================
   WAYFARER MAP MOD (wfmm)
   ============================================================================= */

/* =============================================================================
   01) Sidebar Icon & Link
   ============================================================================= */

.sidebar-wayfarermap svg {
    width: 24px;
    height: 24px;
    filter: none;
    fill: currentColor; }

/* =============================================================================
   02) Modal: Backdrop + Dialog
   ============================================================================= */

.wfmapmods-modal-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.35);
  z-index: 2000;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow-y: auto;
  padding: 12px 0;
}

.wfmapmods-modal-dialog {
  background: #ffffff;
  border-radius: 8px;
  box-shadow: 0 10px 25px rgba(0, 0, 0, 0.35);
  width: 280px;
  max-width: calc(100% - 32px);
  padding: 12px 14px 10px;
  box-sizing: border-box;
  font-family: Roboto, Arial, sans-serif;
  font-size: 12px;
  color: #111827;
  max-height: 90vh;
  overflow-y: auto;
}

.wfmapmods-modal-title {
  font-size: 15px;
  font-weight: 600;
  margin-bottom: 10px;
}

.wfmapmods-modal-section {
  border-bottom: 1px solid #e5e7eb;
  padding-bottom: 6px;
  margin-bottom: 6px;
}

.wfmapmods-modal-section:last-of-type {
  border-bottom: none;
  padding-bottom: 0;
  margin-bottom: 0;
}

.wfmapmods-modal-section-header {
  font-weight: 500;
  margin-bottom: 4px;
}

.wfmapmods-modal-row {
  display: flex;
  align-items: center;
  margin-bottom: 3px;
  gap: 4px;
}

.wfmapmods-modal-row label {
  flex: 0 0 150px;
  font-size: 11px;
  color: #374151;
}

.wfmapmods-modal-row--narrow label {
  flex: 0 0 140px;
}

.wfmapmods-modal-input-small {
  width: 60px;
  padding: 2px 4px;
  font-size: 11px;
  box-sizing: border-box;
}

.wfmapmods-modal-color {
  width: 40px;
  height: 22px;
  padding: 0;
  border: none;
  background: none;
}

.wfmapmods-modal-checkbox {
  width: 16px;
  height: 16px;
}

.wfmapmods-modal-select {
  flex: 0 0 auto;
  padding: 2px 4px;
  font-size: 11px;
}

.wfmapmods-modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 6px;
}

.wfmapmods-modal-btn {
  padding: 4px 10px;
  border-radius: 4px;
  border: 1px solid #d1d5db;
  background: #ffffff;
  cursor: pointer;
  font-size: 12px;
}

.wfmapmods-modal-btn-primary {
  border-color: #2563eb;
  background: #2563eb;
  color: #ffffff;
}

.wfmapmods-modal-intro {
  font-size: 11px;
  margin-bottom: 6px;
  line-height: 1.4;
  color: #374151;
}

.wfmapmods-modal-textarea {
  width: 100%;
  box-sizing: border-box;
  font-size: 11px;
  padding: 4px 6px;
  min-height: 140px;
  resize: vertical;
  border: 1px solid #d1d5db;
  border-radius: 4px;
}

.wfmapmods-modal-actions {
  margin-top: 6px;
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}

.wfmapmods-clickrow {
  display: flex;
  align-items: center;
  gap: 10px;
  cursor: pointer;
}

.wfmapmods-clickrow > input[type="checkbox"] {
  flex: 0 0 auto;
}

.wfmapmods-clickrow-text {
  flex: 1 1 auto;
}

.wfmapmods-modal-hint {
  margin-top: 8px;
  font-size: 13px;
  opacity: 0.9;
}

.wfmapmods-markertable {
  width: 100%;
  border-collapse: separate;
  border-spacing: 8px;
  table-layout: fixed;
}

.wfmapmods-markertable th {
  text-align: center;
  font-weight: 600;
}

.wfmapmods-markertable th.wfmapmods-markertable-rowhead {
  text-align: left;
}

.wfmapmods-markercell {
  background: rgba(0,0,0,0.03);
  border: 1px solid rgba(0,0,0,0.10);
  border-radius: 10px;
  padding: 8px;
  cursor: pointer;
  user-select: none;
}

.wfmapmods-markerpreview {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 48px;
}

.wfmapmods-thumbframe {
  position: relative;
  border-radius: 50%;
  overflow: hidden;
  box-sizing: border-box;
}

.wfmapmods-thumbframe img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.wfmapmods-thumbring {
  position: absolute;
  inset: 0;
  border-radius: 50%;
  box-sizing: border-box;
  border-style: solid;
  pointer-events: none;
}

.wfmapmods-thumbframe {
  width: var(--wfmapmods-thumb-size, 36px);
  height: var(--wfmapmods-thumb-size, 36px);
}

/* =============================================================================
   03) Search Input Placeholder
   ============================================================================= */

#wfmapmods-search-input::placeholder,
#wfmapmods-search-input:-ms-input-placeholder,
#wfmapmods-search-input::-ms-input-placeholder {
  color: #6b7280 !important;
}

/* =============================================================================
   04) Link Blocks (Settings & POI Function Links)
   ============================================================================= */

.wfmapmods-link-block {
  display: flex;
  flex-wrap: wrap;
  gap: 0 4px;
  padding: 4px 0;
}

.wfmapmods-link-block a {
  font-size: 12px;
  font-weight: 400;
  color: #6b7280;
  text-decoration: none;
  white-space: nowrap;
  cursor: pointer;
  padding: 0 4px;
  border-radius: 3px;
}

.wfmapmods-link-block a:hover {
  text-decoration: underline;
}

.wfmapmods-link-disabled {
  color: #9ca3af !important;
  cursor: not-allowed !important;
  text-decoration: none !important;
}

/* =============================================================================
   05) Wayspot Detail Overlay (Dialog)
   ============================================================================= */

.wfmapmods-wayspot-overlay-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.55);
  z-index: 2500;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 12px;
  box-sizing: border-box;
}

.wfmapmods-wayspot-overlay-dialog {
  position: relative;
  background: #ffffff;
  border-radius: 8px;
  box-shadow: 0 10px 25px rgba(0, 0, 0, 0.45);
  max-width: 550px;
  width: 100%;
  max-height: 90vh;
  display: flex;
  flex-direction: column;
  box-sizing: border-box;
  padding: 10px 12px 12px;
  font-family: Roboto, Arial, sans-serif;
  color: #111827;
  overflow: hidden;
  align-items: stretch;
}

.wfmapmods-wayspot-overlay-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  margin-bottom: 8px;
  gap: 8px;
  width: 100%;
}

.wfmapmods-wayspot-overlay-title {
  font-size: 15px;
  font-weight: 600;
  text-align: center;
  flex: 1 1 auto;
  width: 100%;
  overflow-wrap: anywhere;
  white-space: normal;
}

.wfmapmods-wayspot-overlay-close {
  flex: 0 0 24px;
  align-self: flex-start;
  border: 1px solid rgba(0, 0, 0, 0.2);
  background: #ffffff;
  border-radius: 9999px;
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  cursor: pointer;
  font-size: 16px;
  line-height: 1;
  font-weight: 600;
}

.wfmapmods-wayspot-overlay-image-link {
  display: inline-block;
  margin-bottom: 8px;
  text-align: center;
}

.wfmapmods-wayspot-overlay-image {
  display: block;
  max-width: 100% !important;
  max-height: 500px !important;
  width: auto !important;
  height: auto !important;
  object-fit: contain !important;
  border-radius: 6px;
  background: #000;
  margin: 0 auto;
}

.wfmapmods-wayspot-overlay-desc {
  font-size: 13px;
  color: #374151;
  text-align: center;
  margin: 0 auto;
  overflow-y: auto;
  max-height: 20vh;
  padding-right: 2px;
}

/* Overlay: Carousel thumbnails */
.wfmapmods-wayspot-overlay-carousel {
  display: flex;
  gap: 8px;
  overflow-x: auto;
  padding: 8px 0;
  margin-bottom: 8px;
}

.wfmapmods-wayspot-overlay-thumb {
  width: 56px;
  height: 56px;
  object-fit: cover;
  border-radius: 8px;
  cursor: pointer;
  flex: 0 0 auto;
  opacity: 0.85;
  outline: none;
}

.wfmapmods-wayspot-overlay-thumb.is-active {
  opacity: 1;
  outline: 2px solid #111827;
}

/* =============================================================================
   06) Side Panel
   ============================================================================= */

.wfmapmods-sidepanel-root {
  transition: transform 0.25s ease-out;
}

/* Slide panel so only the tab remains visible */
.wfmapmods-sidepanel-root.wfmapmods-sidepanel-collapsed {
  transform: translateX(calc(100% + 11px));
}

#wfmapmods-sidepanel-toggle {
  position: absolute;
  top: 30%;
  left: -25px;
  transform: translateY(-50%);
  width: 25px;
  height: 56px;
  border-radius: 8px 0 0 8px;
  border: 1px solid #d1d5db;
  border-right: none;
  background: #f3f4f6;
  color: #374151;
  font-size: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  padding: 0;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.15);
}

#wfmapmods-sidepanel-toggle:hover {
  background: #e5e7eb;
}

/* Side panel container */
#wfmapmods-side-panel.wfmapmods-sidepanel-root {
  position: absolute;
  top: 10px;
  right: 10px;
  width: 300px;
  max-width: calc(100% - 40px);
  height: calc(100% - 20px);
  background: rgba(255, 255, 255, 0.95);
  color: #111827;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.35);
  z-index: 1000;
  display: flex;
  flex-direction: column;
  overflow: visible;
  box-sizing: border-box;
  font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
}

/* Scrollable panel content */
.wfmapmods-sidepanel-content {
  flex: 1 1 auto;
  padding: 0;
  font-size: 13px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 0;
}

/* Generic section padding */
.wfmapmods-sidepanel-content .wfmapmods-section {
  padding: 8px 4px;
}

/* Search section: remove inherited section padding */
.wfmapmods-sidepanel-content .wfmapmods-section-search {
  padding: 0;
}

/* Dividers */
.wfmapmods-section-divider {
  border-top: 1px solid #e5e7eb;
  margin: 4px 0;
}

/* Search box (looks like one input) */
#wfmapmods-searchbox {
  display: flex;
  align-items: center;
  gap: 4px;
  background: #e5e7eb;
  border-radius: 6px;
  border: 1px solid #d1d5db;
  padding: 2px 4px;
  box-sizing: border-box;
}

.wfmapmods-searchicon {
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  justify-content: center;
}

.wfmapmods-iconimg {
  width: 20px;
  height: 20px;
  display: block;
}

#wfmapmods-geo-btn {
  flex: 0 0 auto;
  border: none;
  padding: 0;
  margin: 0;
  background: none;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
}

/* Input */
#wfmapmods-search-input {
  flex: 1 1 auto;
  font-size: 12px;
  border: none;
  outline: none;
  background: transparent;
  padding: 0 2px;
  min-width: 0;
}

/* Details section layout */
.wfmapmods-section-details-body {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.wfmapmods-detail-title {
  font-size: 15px;
  font-weight: 600;
  color: #111827;
  min-height: 18px;
  text-align: center;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.wfmapmods-detail-image-box {
  width: 200px;
  height: 200px;
  border-radius: 50%;
  border: 10px solid #154aab;
  background: #e5e7eb;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #9ca3af;
  font-size: 12px;
  overflow: hidden;
  align-self: center;
}

.wfmapmods-detail-coords {
  font-family: Roboto, Arial, sans-serif;
  font-size: 12px;
  font-weight: 300;
  color: #737373;
  min-height: 14px;
  text-align: center;
  cursor: pointer;
  text-decoration: none;
  font-feature-settings: normal;
  font-variant-numeric: normal;
}

.wfmapmods-detail-status {
  min-height: 18px;
  display: flex;
  justify-content: center;
  align-items: center;
}

.wfmapmods-detail-status-row {
  display: flex;
  align-items: center;
  justify-content: center;
}

.wfmapmods-detail-poi-source,
.wfmapmods-detail-pgo-entity-logo,
.wfmapmods-detail-community-logo {
  align-items: center;
  justify-content: center;
  height: 20px;
  width: auto;
  box-sizing: content-box;
  display: none;
}

.wfmapmods-detail-poi-source,
.wfmapmods-detail-pgo-entity-logo {
  margin-right: 10px;
}

.wfmapmods-detail-community-logo {
  margin-left: 10px;
}

.wfmapmods-detail-status-tag-container {
  display: flex;
  align-items: center;
}

/* “Row with icon + link block” used by POI + Location rows */
.wfmapmods-iconlinks-row {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 4px 0 4px;
  font-size: 12px;
  font-weight: 600;
  color: #374151;
}

/* Link block spacing override (instead of setting style.gap inline) */
.wfmapmods-link-block.wfmapmods-link-block--spaced {
  gap: 0 8px; /* preserves wrap, increases horizontal gap */
}

/* Simple visibility helper (instead of style.display = "none") */
.wfmapmods-is-hidden {
  display: none !important;
}

.wfmapmods-map-host {
  position: relative;
}

/* =============================================================================
   07) Status Tags
   ============================================================================= */

.wfmapmods-status-tag {
  display: inline-block;
  white-space: nowrap;
  border-radius: 9999px;
  padding: 0.25rem 0.5rem;
  font-size: 0.75rem;
  line-height: 1rem;
  text-transform: uppercase;
  font-weight: 500;
}

.wfmapmods-status-tag--accepted {
  background-color: rgba(187, 247, 208, 1);
  color: rgba(21, 128, 61, 1);
}

.wfmapmods-status-tag--rejected {
  background-color: rgba(254, 202, 202, 1);
  color: rgba(220, 38, 38, 1);
}

.wfmapmods-status-tag--queue {
  background-color: rgba(212, 212, 212, 1);
  color: rgba(23, 23, 23, 1);
}

/* =============================================================================
   08) Info Window (Wayfarer Map)
   ============================================================================= */

.wfmapmods-iw-root {
  position: relative;
}

.gm-style-iw-c {
  background-color: #fff !important;
}

.wfmapmods-iw-content {
  display: flex;
  flex-direction: column;
  max-width: 220px;
  font-family: Roboto, Arial, sans-serif;
  color: #000;
}

.wfmapmods-iw-header {
  display: flex;
  align-items: flex-start;
  gap: 4px;
  margin-top: 6px;
  margin-bottom: 4px;
}

.wfmapmods-iw-title {
  flex: 1 1 auto;
  min-width: 0;
  font-size: 14px;
  font-weight: 500;
  margin-top: 6px;
}

.wfmapmods-iw-copy-title {
  display: block;
  cursor: pointer;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.wfmapmods-iw-close {
  flex: 0 0 24px;
  width: 24px;
  height: 24px;
  background: #fff;
  border: 1px solid rgba(0, 0, 0, 0.15);
  border-radius: 9999px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
  padding: 0;
}

.wfmapmods-iw-coords {
  font-size: 12px;
  color: #6b7280;
  margin-bottom: 8px;
}

.wfmapmods-iw-copy-coords {
  cursor: pointer;
}

.wfmapmods-iw-img-wrapper {
  width: 220px;
  height: 96px;
  overflow: hidden;
  margin-bottom: 8px;
}

.wfmapmods-iw-img-link {
  display: block;
  width: 100%;
  height: 100%;
}

.wfmapmods-iw-img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.wfmapmods-iw-desc {
  font-size: 14px;
}

/* Info window: hide Google Maps default close button + chrome */
.gm-style-iw-chr .gm-ui-hover-effect {
  display: none !important;
}

.gm-style-iw-chr {
  height: 0 !important;
  padding: 0 !important;
  margin: 0 !important;
}

/* =============================================================================
   09) Icon Menu Controls (Filters/Layers/etc.)
   ============================================================================= */

.wfmapmods-iconmenu {
  font-family: Roboto, Arial, sans-serif;
  font-size: 12px;
  pointer-events: auto;
  position: relative;
}

.wfmapmods-iconmenu-toggle {
  border: 1px solid rgba(0, 0, 0, 0.2);
  border-radius: 4px;
  background: #ffffff;
  padding: 4px 6px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.25);
  outline: none;
  position: relative;
}

.wfmapmods-iconmenu-toggle:hover {
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
}

.wfmapmods-iconmenu-toggle:focus-visible {
  box-shadow: 0 0 0 2px #2563eb;
}

.wfmapmods-iconmenu-icon {
  width: 25px;
  height: 25px;
  display: block;
}

.wfmapmods-iconmenu-icon svg {
  width: 100%;
  height: 100%;
  fill: #666666;
  display: block;
}

.wfmapmods-iconmenu-menu {
  position: absolute;
  top: 0;
  right: 0;
  padding: 6px 8px;
  background: #ffffff;
  border-radius: 6px;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.3);
  display: none;
  white-space: nowrap;
  flex-direction: column;
  gap: 4px;
  align-items: flex-start;
  z-index: 1;
}

.wfmapmods-iconmenu.wfmapmods-iconmenu-open .wfmapmods-iconmenu-toggle {
  display: none;
}

.wfmapmods-iconmenu.wfmapmods-iconmenu-open .wfmapmods-iconmenu-menu {
  display: flex;
}

/* Optional helper for filters icon */
.wfmapmods-filters-icon {
  display: flex;
  align-items: center;
  justify-content: center;
}

.wfmapmods-filters-icon svg {
  width: 90%;
  height: 90%;
}

#wfmapmods-topright-controls {
  position: absolute;
  top: 10px;
  right: 10px;
  z-index: 1100;
  display: flex;
  align-items: flex-start;
  gap: 8px;
}

.wfmapmods-filters-wrap {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.wfmapmods-filters-section {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.wfmapmods-filters-section-title {
  font-size: 11px;
  font-weight: 600;
  color: #111827;
}

.wfmapmods-filters-options {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

/* option rows */
.wfmapmods-filters-option {
  display: flex;
  align-items: center;
  gap: 6px;
  cursor: pointer;
}

.wfmapmods-filters-label {
  font-size: 11px;
  color: #111827;
}

.wfmapmods-filters-checkbox {
  width: 14px;
  height: 14px;
}

.wfmapmods-layers-option {
  display: flex;
  align-items: center;
  gap: 6px;
  cursor: pointer;
}

.wfmapmods-layers-checkbox {
  width: 14px;
  height: 14px;
}

.wfmapmods-layers-label {
  font-size: 11px;
  color: #111827;
}

/* =============================================================================
   10) Spinner (Loading)
   ============================================================================= */

@keyframes wfmapmods-spin {
  to { transform: rotate(360deg); }
}

.wfmapmods-spinner {
  box-sizing: border-box;
  width: 24px;
  height: 24px;
  border-radius: 9999px;
  border: 3px solid rgba(156, 163, 175, 0.6);
  border-top-color: #3b82f6;
  animation: wfmapmods-spin 0.7s linear infinite;
}

/* =============================================================================
   11) Submit UI (Images + Fields + Table)
   ============================================================================= */

/* Settings modal: circle table */
.wfmapmods-circle-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 11px;
}

.wfmapmods-circle-table th,
.wfmapmods-circle-table td {
  padding: 2px 4px;
  text-align: center;
}

.wfmapmods-circle-table th:first-child,
.wfmapmods-circle-table td:first-child {
  text-align: left;
  white-space: nowrap;
}

.wfmapmods-circle-table .wfmapmods-modal-color {
  width: 26px;
  height: 22px;
  padding: 0;
}

.wfmapmods-circle-table .wfmapmods-modal-input-small {
  width: 64px;
  text-align: center;
}

/* Submission modal layout */
.wfmapmods-submit-wrap {
  display: flex;
  flex-direction: column;
  gap: 8px;
  font-size: 13px;
}

.wfmapmods-submit-images {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 4px;
}

.wfmapmods-submit-imgblock {
  display: flex;
  flex-direction: column;
  align-items: center;
  font-size: 11px;
  flex: 0 0 auto;
  position: relative;
}

.wfmapmods-submit-imglabel {
  margin-bottom: 4px;
  font-weight: 700;
}

.wfmapmods-submit-thumbwrap {
  position: relative;
}

.wfmapmods-submit-thumb {
  max-width: 80px;
  max-height: 80px;
  object-fit: cover;
  border-radius: 4px;
  border: 1px solid rgb(209, 213, 219);
}

.wfmapmods-submit-remove {
  position: absolute;
  top: -6px;
  right: -6px;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  border: none;
  background: rgba(0, 0, 0, 0.7);
  color: #fff;
  cursor: pointer;
  font-size: 12px;
  line-height: 18px;
  padding: 0;
}

.wfmapmods-submit-box {
  width: 80px;
  height: 80px;
  border-radius: 4px;
  border: 1px dashed rgb(209, 213, 219);
  display: flex;
  align-items: center;
  justify-content: center;
  background: #f9fafb;
}

.wfmapmods-submit-box--clickable {
  cursor: pointer;
  font-size: 24px;
  color: #9ca3af;
  background: #fff;
}

.wfmapmods-submit-location {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 0;
}

.wfmapmods-submit-location-label {
  font-size: 11px;
  font-weight: 700;
}

.wfmapmods-submit-location-right {
  display: flex;
  align-items: center;
  gap: 6px;
}

.wfmapmods-submit-location-value {
  font-size: 12px;
  color: #374151;
}

.wfmapmods-submit-changebtn {
  font-size: 11px;
  padding: 2px 6px;
  border-radius: 4px;
  border: 1px solid #d1d5db;
  background: #f9fafb;
  cursor: pointer;
}

.wfmapmods-submit-changebtn:hover {
  background: #e5e7eb;
}

.wfmapmods-submit-field {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.wfmapmods-submit-field label {
  font-size: 11px;
  font-weight: 700;
}

.wfmapmods-submit-input,
.wfmapmods-submit-textarea {
  width: 100%;
  box-sizing: border-box;
  font-size: 12px;
  padding: 4px 6px;
  border: 1px solid rgb(209, 213, 219);
  border-radius: 4px;
  background: #fff;
}

.wfmapmods-submit-textarea {
  resize: vertical;
}

.wfmapmods-submit-counter {
  font-size: 10px;
  color: rgb(107, 114, 128);
  text-align: right;
}

.wfmapmods-submit-warning {
  font-size: 11px;
  color: #b91c1c;
  margin-top: 2px;
  display: none;
}

.wfmapmods-hidden {
  display: none !important;
}

/* Replaces setOkButtonState opacity/cursor inline styles */
.wfmapmods-btn-disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

/* Make thumbs clickable */
.wfmapmods-submit-thumb.is-clickable {
  cursor: pointer;
}

/* One image “tile” that can be: placeholder | pending | ready */
.wfmapmods-submit-tile {
  position: relative;
  width: 80px;
  height: 80px;
  border-radius: 4px;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
}

/* placeholder look */
.wfmapmods-submit-tile--placeholder {
  border: 1px dashed rgb(209, 213, 219);
  background: #fff;
  font-size: 24px;
  color: #9ca3af;
  cursor: pointer;
}

/* pending look */
.wfmapmods-submit-tile--pending {
  border: 1px dashed rgb(209, 213, 219);
  background: #f9fafb;
}

/* ready image */
.wfmapmods-submit-tile img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

/* Warning show/hide via class instead of inline */
.wfmapmods-submit-warning.is-visible {
  display: block;
}

/* =============================================================================
   12) Mobile Confirm Location Bar
   ============================================================================= */

.wfmapmods-confirmbar {
  position: absolute;
  left: 50%;
  bottom: 16px;
  transform: translateX(-50%);
  z-index: 1200;
  display: flex;
  align-items: center;
  gap: 8px;
  max-width: calc(100% - 32px);
  box-sizing: border-box;
  background: rgba(17, 24, 39, 0.9);
  color: #f9fafb;
  padding: 6px 10px;
  border-radius: 9999px;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.4);
  font-family: Roboto, Arial, sans-serif;
  font-size: 12px;
  pointer-events: auto;
}

.wfmapmods-confirmbar__label {
  flex: 1 1 auto;
  min-width: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.wfmapmods-confirmbar__btn {
  font-size: 11px;
  padding: 4px 8px;
  border-radius: 9999px;
  white-space: nowrap;
}

.wfmapmods-confirmbar__btn--cancel {
  border-color: rgba(255, 255, 255, 0.25);
  background: rgba(255, 255, 255, 0.10);
  color: #ffffff;
}

/* =============================================================================
   13) Layout / Map Mode Tweaks + Visibility Utilities
   ============================================================================= */

/* Remove map padding (Wayfarer submit container) */
.submit-wayspot-container {
  padding: 0 !important;
}

/* Hide helper */
.wfmapmods-hidden,
.wfmapmods-hidden * {
  display: none !important;
}

/* Map mode: hide everything by default, then opt-in what you need */
.wfmapmods-mapmode > * {
  display: none !important;
}

.wfmapmods-mapmode > .wfmapmods-mapsection {
  display: block !important;
}

.wfmapmods-mapmode > .wfmapmods-mapsection > * {
  display: none !important;
}

.wfmapmods-mapmode > .wfmapmods-mapsection > .wfmapmods-mapkeep {
  display: block !important;
}

/* Map mode: remove Niantic width limiter (container-scoped) */
body.wfmapmods-mapmode-body .max-w-7xl {
  max-width: none !important;
}

/* Map mode: remove padding */
body.wfmapmods-mapmode-body mat-sidenav-content.p-4 {
  padding: 0 !important;
}

/* Map mode: kill vertical scrolling */
body.wfmapmods-mapmode-body,
body.wfmapmods-mapmode-body mat-sidenav-content,
body.wfmapmods-mapmode-body app-submit-wayspot,
body.wfmapmods-mapmode-body app-submit-wayspot > div {
  overflow-y: hidden !important;
}

/* Map mode: let the map fill viewport */
body.wfmapmods-mapmode-body .submit-wayspot-map-container {
  height: calc(100vh - var(--wfmapmods-map-top-offset, 0px)) !important;
  max-height: 100vh !important;
}

/* =============================================================================
   14) Modify the default zoom hint
   ============================================================================= */

/* Zoom hint: make clickable */
.zoom-hint-pill {
  pointer-events: auto !important;
  cursor: pointer !important;
}

/* =============================================================================
   15) PGO: Inactive Gym/Pokestop Slash Overlay
   ============================================================================= */

.wfmapmods-pgo-inactive-slash {
  position: absolute;
  left: -10%;
  top: 50%;
  width: 120%;
  height: 3px;
  background: #d11a2a;
  transform: translateY(-50%) rotate(-35deg);
  border-radius: 2px;
  pointer-events: none;
  box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.7);
}

/* =============================================================================
   16) Submit Progress Bar (Map Overlay)
   ============================================================================= */

#wfmapmods-submit-progress {
  position: absolute;
  top: 8px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 9999;
  max-width: 420px;
  width: 70%;
  pointer-events: none;
  font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  font-size: 12px;
}

#wfmapmods-submit-progress.is-hidden {
  display: none;
}

.wfmapmods-progress-inner {
  background: rgba(17, 24, 39, 0.92);
  color: #f9fafb;
  border-radius: 9999px;
  padding: 6px 10px;
  box-shadow: 0 6px 14px rgba(0, 0, 0, 0.45);
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.wfmapmods-progress-track {
  width: 100%;
  height: 6px;
  border-radius: 9999px;
  background: rgba(55, 65, 81, 0.9);
  overflow: hidden;
}

.wfmapmods-progress-fill {
  height: 100%;
  width: var(--wfmapmods-progress, 10%);
  border-radius: 9999px;
  background: #3b82f6;
  transition: width 0.25s ease;
}

/* =============================================================================
   17) Map Context Menu (Right-click copy coords)
   ============================================================================= */

.wfmapmods-map-context-menu {
  position: absolute;
  transform: translate(4px, 4px);
  background: #ffffff;
  color: #111827;
  border: 1px solid rgba(0,0,0,0.15);
  border-radius: 6px;
  padding: 6px 8px;
  box-shadow: 0 2px 6px rgba(0,0,0,0.25);
  font-size: 12px;
  z-index: 1500;
  white-space: nowrap;
  cursor: default;
  font-family: Roboto, Arial, sans-serif;

  /* driven by JS */
  top: var(--wfmapmods-menu-top, 0px);
  left: var(--wfmapmods-menu-left, 0px);
}

.wfmapmods-map-context-label {
  margin-bottom: 4px;
  cursor: pointer;
}

.wfmapmods-map-context-btn {
  font-size: 12px;
  padding: 2px 8px;
  border-radius: 3px;
  border: 1px solid #d1d5db;
  background: #f3f4f6;
  cursor: pointer;
}

.wfmapmods-map-context-btn:hover {
  background: #e5e7eb;
}

/* =============================================================================
   17) Submission Pin button and toggle
   ============================================================================= */

    .wf-submission-pin-control {
      background-color: #ffffff;
      border: 2px solid #ffffff;
      border-radius: 3px;
      box-shadow: 0 1px 4px rgba(0,0,0,0.3);
      cursor: pointer;
      margin-top: 10px;
      margin-left: 10px;
      width: 32px;
      height: 32px;
      display: flex;
      align-items: center;
      justify-content: center;
      user-select: none;
    }

    /* Icon wrapper sizing */
    .wf-submission-pin-control .wf-icon-wrapper {
      width: 16px;
      height: 16px;
      display: inline-flex;
      align-items: center;
      justify-content: center;

      /* CRITICAL: let clicks pass through the SVG/wrapper */
      pointer-events: none;
    }

    /* Make SVG smaller and blocky */
    .wf-submission-pin-control svg {
      width: 14px;
      height: auto;
      display: block;

      /* extra safety: SVG itself shouldn't intercept clicks */
      pointer-events: none;
    }

    /* Force icon to black */
    .wf-submission-pin-control svg,
    .wf-submission-pin-control svg * {
      fill: #000000 !important;
      stroke: #000000 !important;
    }

.wf-toggle-active {
  background-color: #ffce04 !important;
  border-color: #ffce04 !important;
  color: #000000 !important;
}

/* =============================================================================
   Report Progress Bar (Map Overlay)
   ============================================================================= */

#wfmapmods-report-progress {
  position: absolute;
  top: 8px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 9999;
  max-width: 420px;
  width: 70%;
  pointer-events: none;
  font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  font-size: 12px;
}

#wfmapmods-report-progress.is-hidden {
  display: none;
}
  `

        let style = document.getElementById("wfmapmods-all-css");
        if (!style) {
            style = document.createElement("style");
            style.id = "wfmapmods-all-css";
            style.textContent = cssText;
            document.head.appendChild(style);
        }
    }

    function injectSubmitRouteCss() {
        // Css which overrides default styling
        // Specific to Submit route
        // Remove upon leaving via Teardown
        const cssText = `
/* =============================================================================
   Google Maps Marker Overrides (Submit Route)
   ============================================================================= */

/* Hide default Wayspots */
.gm-style div[style*="width: 36px"][style*="height: 56px"] {
  display: none !important;
}

/* Re-enable the submission marker */
.gm-style div[style*="z-index: 999"][style*="width: 36px"][style*="height: 56px"] {
  display: block !important;
  pointer-events: none !important;
}

/* Hide canvas layer used for some default marker rendering */
  .gm-style div[style*="z-index: 103"]
    div[style*="z-index: -1"]
    div:is([style*="z-index: 98"], [style*="z-index: 99"]) canvas {
    display: none !important;
  }
      `

        let style = document.createElement("style");
        style.id = "wfmapmods-submit-route-css";
        style.textContent = cssText;
        document.head.appendChild(style);
    }

    function injectMapviewRouteCss() {
        // Css which overrides default styling
        // Specific to Mapview route
        // Will be removed upon leaving via Teardown
        const cssText = `
/* =============================================================================
   Google Maps Marker Overrides (Mapview Route)
   ============================================================================= */

/* Hide default Wayspots on Mapview route */
canvas#deckgl-overlay {
  display: none !important;
}
      `

        let style = document.createElement("style");
        style.id = "wfmapmods-mapview-route-css";
        style.textContent = cssText;
        document.head.appendChild(style);
    }

    function removeInjectedCss(id) {
        const style = document.getElementById(id);
        if (style) style.remove();
    }

    function applyCssForCurrentRoute() {
        if (location.pathname === SUBMIT_ROUTE) {
            injectSubmitRouteCss();
            return;
        }

        if (location.pathname === MAPVIEW_ROUTE) {
            injectMapviewRouteCss();
            return;
        }
    }

    // ==================================
    // Bootstrap & event wiring
    // ==================================

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', setupSidebarObserver);
    } else {
        setupSidebarObserver();
    }

    // Initial map-mode layout on load
    formatPageForMapMode();

    // Keep behaviour in sync with SPA navigation
    window.addEventListener('popstate', () => {
        formatPageForMapMode();
        // updateSidebarActiveForMapMode();
    });


    function init() {
        const coordsFromUrl = parseDeepLinkFromLocation();
        if (coordsFromUrl) {
            deepLinkTarget = coordsFromUrl;
            skipRestoreMapViewForThisLoad = true;
            localStorage.setItem('wf_map_nav', '1');
            formatPageForMapMode();
        }

        loadSettings();
        injectCss();
        applyCssForCurrentRoute();
        initMapModeWatcher();
        initSidenavPaddingRouteWatcher();
        createBridges();
        setupMapRouteWatcher();

        checkWhichApisAreLive();
    }
    init();

})();