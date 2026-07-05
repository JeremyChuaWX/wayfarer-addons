// ==UserScript==
// @name         Wayfarer Map Mods - Base
// @version      3.14.1
// @description  Base plug-in for the Wayfarer Map
// @namespace    https://gitlab.com/Tntnnbltn/wayfarer-addons
// @downloadURL  https://gitlab.com/Tntnnbltn/wayfarer-addons/-/raw/main/wayfarer-map-mods-base.user.js
// @updateURL    https://gitlab.com/Tntnnbltn/wayfarer-addons/-/raw/main/wayfarer-map-mods-base.user.js
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

/* eslint-disable no-multi-spaces */

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

    const GCS_MIN_ZOOM = 16;
    const LOWZOOM_GCS_MAX_ZOOM = GCS_MIN_ZOOM - 1;
    const NORMAL_GCS_CELL_LEVEL = 14;
    const POWER_SPOT_RING_MIN_ZOOM = 18;

    // ----- Radius for retrieving POIs -----
    const RADIUS_FOR_LIVE_POIS_API = 350;
    const POI_MOVEMENT_THRESHOLD = RADIUS_FOR_LIVE_POIS_API * 0.20;
    const SUBMIT_RADIUS_GCS_SOURCE_KIND = "submit-radius-gcs";
    const SUBMIT_RADIUS_GCS_PADDING_METERS = 25;

    // ----- URLs and API -----
    const SUBMIT_ROUTE = "/new/submit/new";
    const MAPVIEW_ROUTE = "/new/mapview";
    const GCS_ENDPOINT_PART = "/api/v1/vault/mapview/gcs";
    const LOWZOOM_GCS_ENDPOINT_PART = "/api/v1/vault/mapview/lowzoom/gcs";

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

    // ----- Image gallery -----
    const GALLERY_SORT_MODES = {
        PHOTO_VOTES: "photo_votes",
        PHOTO_AGE_DESC: "photo_age_desc",
        PHOTO_AGE_ASC: "photo_age_asc",
        CODENAME_ASC: "codename_asc"
    };

    const GALLERY_SORT_LABELS = {
        [GALLERY_SORT_MODES.PHOTO_VOTES]: "Photo Vote ▼",
        [GALLERY_SORT_MODES.PHOTO_AGE_DESC]: "Photo Age ▼",
        [GALLERY_SORT_MODES.PHOTO_AGE_ASC]: "Photo Age ▲",
        [GALLERY_SORT_MODES.CODENAME_ASC]: "Codename A-Z"
    };

    // ----- Timestamps ------
    const COURTS_OF_THE_WORLD_IMPORT_TIMESTAMP_MS = 1661286015088;
    const WAYSPOST_PHOTO_ESTIMATE_CUTOFF_TIMESTAMP_MS = Date.UTC(2019, 7, 1); // 1 Aug 2019

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
    const COURTS_OF_THE_WORLD_BASKETBALL_ICON_SVG = '<?xml version="1.0" encoding="UTF-8"?><svg enable-background="new 0 0 324.5 75" version="1.1" viewBox="0 0 44.8 44.8" xml:space="preserve" xmlns="http://www.w3.org/2000/svg"><g transform="translate(-8.4,-8.3)"><path d="m53.2 30.1c-0.3-12-10.2-21.8-22.3-21.8-6.4 0-12 2.7-16.1 6.9 4.8 3.1 10.5 4.7 16.4 4.7v1.4c-6.3 0-12.3-1.7-17.4-5.1-3.1 3.8-5.1 8.6-5.3 13.8h22.7v-8.8c2.8 0 5.6-0.4 8.2-1.1 1.3 3 2.1 6.4 2.1 9.9h-10.3v1.4h10.3c-0.1 3.4-0.9 6.8-2.1 9.9-2.6-0.7-5.3-1.1-8.2-1.1v-8.8h-22.8c0.2 5.2 2.1 10.1 5.3 13.8 5.1-3.3 11-5 17.4-5.1v1.4c-5.9 0-11.6 1.6-16.4 4.7 4 4.2 9.8 6.9 16.1 6.9 12.1 0 22-9.7 22.4-21.8zm-22.1-10.1v-10c3.3 2.3 5.8 5.4 7.6 8.9-2.4 0.7-4.9 1.1-7.6 1.1zm2.2-10.1c4.9 0.6 9.2 2.8 12.5 6.1-1.8 1-3.7 1.9-5.7 2.5-1.7-3.3-3.9-6.2-6.8-8.6zm-2.2 31.7c2.6 0 5.2 0.3 7.6 1-1.8 3.5-4.4 6.5-7.6 8.9zm2.1 10.1c2.9-2.3 5.2-5.3 6.9-8.7 2 0.6 4 1.5 5.8 2.5-3.4 3.3-7.8 5.6-12.7 6.2zm13.6-7.2c-1.9-1.1-4-2.1-6.1-2.8 1.4-3.2 2.1-6.6 2.2-10.3h8.9c-0.1 5.1-2 9.5-5 13.1zm-3.9-14.4c-0.1-3.6-0.9-7.1-2.2-10.3 2.1-0.7 4.2-1.6 6.1-2.8 3 3.5 4.9 8.1 5.1 13z" fill="#f56446"/></g></svg>';
    const MULTIPLE_PHOTOS_ICON_SVG = '<?xml version="1.0" encoding="UTF-8"?><svg width="213.89mm" height="174.57mm" version="1.1" viewBox="0 0 213.89 174.57" xml:space="preserve" xmlns="http://www.w3.org/2000/svg"><g transform="translate(.37645 -61.503)" stroke="#000"><path d="m20.58 234.35c-2.1979-0.45333-4.3682-1.2169-6.4149-2.257-6.4704-3.288-11.346-9.7044-12.757-16.789-0.37803-1.8976-0.41406-6.9772-0.34816-49.08l0.073514-46.964 0.75131-2.249c2.5535-7.6435 7.6747-13.136 14.714-15.78 4.7657-1.7901 0.19699-1.6827 71.583-1.6827 69.486 0 66.655-0.05266 70.619 1.3134 6.4979 2.2392 11.883 7.2028 14.613 13.469 1.949 4.4731 1.8159 0.59305 1.8159 52.951v46.964l-0.59839 2.249c-2.2583 8.4875-8.4728 14.786-17.279 17.514l-1.9666 0.60907-66.543 0.0436c-54.732 0.0359-66.848-0.0193-68.262-0.31106zm134.11-9.7731c4.5541-1.2121 8.2075-4.5122 10.029-9.059l0.72159-1.8014 0.0705-45.773c0.0485-31.486-0.0171-46.196-0.21004-47.128-0.81061-3.9142-4.0123-8.0299-7.6712-9.8612-1.2326-0.61691-2.7869-1.1514-3.8712-1.3313-1.3261-0.21992-19.188-0.28069-66.635-0.2267l-64.823 0.0738-1.6898 0.6103c-4.5638 1.6483-8.0747 5.3194-9.399 9.8276-0.38123 1.2978-0.4236 6.0252-0.42363 47.261-2.4e-5 44.835 0.01117 45.856 0.52105 47.506 1.4434 4.6715 5.2815 8.4549 9.933 9.7915 1.4829 0.42612 5.8844 0.45721 66.807 0.47188 55.73 0.0134 65.426-0.0393 66.64-0.36238zm-131.33-16.195c-2.4136-1.2724-3.593-3.8706-2.7651-6.0916 0.41636-1.1169 48.277-48.964 49.596-49.582 1.344-0.6299 2.6253-0.62976 3.9688 4.3e-4 0.71554 0.33565 6.1562 5.6033 16.797 16.263l15.739 15.767 6.7506-6.7126c7.2339-7.1932 7.7045-7.537 9.8482-7.1942 0.58243 0.0931 1.3739 0.33603 1.7588 0.53976 0.3849 0.20374 7.385 7.0762 15.556 15.272 14.313 14.357 14.866 14.948 15.117 16.168 0.78588 3.8084-2.5512 6.9035-6.1957 5.7465-0.81949-0.26016-3.5955-2.8903-13.923-13.192l-12.9-12.867-12.765 12.755c-8.7899 8.7828-13.071 12.881-13.749 13.161-3.3223 1.3718-6.5569-0.93883-6.5569-4.6838 0-0.86013 0.16833-1.6611 0.43314-2.0611 0.23823-0.3598 2.5295-2.7681 5.0917-5.3518l4.6585-4.6976-27.646-27.646-22.027 22.001c-12.115 12.1-22.408 22.191-22.873 22.423-1.0705 0.53375-2.8855 0.52567-3.9157-0.0174zm162.19-10.906c-1.2588-0.57806-1.823-1.1681-2.3712-2.4801-0.53831-1.2884-0.50581-2.7348 0.0907-4.0337 0.85215-1.8557 2.4559-2.7753 4.8517-2.782 5.1604-0.0144 10.423-3.3231 12.843-8.0751 1.4757-2.8971 1.3939 0.0276 1.3918-49.76-2e-3 -44.827-0.0132-45.848-0.52316-47.499-1.4742-4.7713-5.4911-8.6432-10.236-9.8665-1.462-0.37694-8.1808-0.41915-66.713-0.41915h-65.088l-1.8138 0.5524c-3.3718 1.0269-6.0344 2.982-7.8808 5.7867-1.5706 2.3859-2.2584 4.4138-2.5206 7.4317-0.24736 2.8478-0.66251 3.8888-1.9294 4.8379-1.0775 0.80724-1.8377 1.0418-3.2823 1.0128-1.8302-0.03674-3.6626-1.3282-4.308-3.0362-0.42906-1.1356-0.33031-4.2762 0.21799-6.9328 1.8685-9.053 8.4663-16.044 17.652-18.705l2.0889-0.60503h66.94c62.924 0 67.04 0.02776 68.614 0.46277 0.92073 0.25452 2.4685 0.78001 3.4396 1.1678 5.9166 2.3625 10.999 7.4329 13.411 13.38 1.8391 4.5338 1.7387 1.2995 1.6572 53.384l-0.0735 46.964-0.7513 2.249c-2.0244 6.06-5.8269 10.951-10.885 14.001-4.499 2.7128-12.071 4.227-14.822 2.964z" stroke-width="2.8"/><circle cx="106.85" cy="140.48" r="11.938" fill="#fff" stroke-linejoin="round" stroke-miterlimit="20" stroke-width="9.404"/></g></svg>'

    const NIANTIC_PLACEHOLDER_IMAGE_URL = 'https://lh3.googleusercontent.com/fs2mYM4r9Qq93ejdOP_2lwefRNLVa9tqmJW7XXwqNhMCMXNKwoJoFuMboBpXwnKUf7fJGImbajM9mHAOMlndt5A-Ts9Qh9f_t6YoaQ6u';
    const NIANTIC_PLACEHOLDER_IMAGE_SVG = '<svg version="1.1" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg"><g><rect x="19.525" y="73.763" width="471.86" height="381.83" fill="#fff"/><path d="m0 256v-256h512v512h-512zm428 132.49c0-1.1628-15.686-31.755-21.273-41.488-13.063-22.758-28.877-43.934-39.302-52.629-8.4886-7.0799-14.865-9.8079-22.925-9.8079-5.6554 0-7.9929 0.5175-12.169 2.6941-6.9797 3.6378-15.887 11.197-21.795 18.494l-4.872 6.0188-5.3031-8.4468c-27.388-43.625-50.763-68.948-72.361-78.396-4.5315-1.9821-7.1729-2.4077-15-2.417-8.6645-0.0102-10.106 0.27589-16.393 3.2534-23.475 11.117-47.467 38.663-78.03 89.587-9.956 16.589-38.577 70.789-38.577 73.053 0 0.32698 78.3 0.59452 174 0.59452s174-0.23062 174-0.5125zm-57.087-142.03c8.7149-2.0542 15.448-5.8767 22.213-12.611 18.155-18.073 18.11-47.611-0.10065-65.822-27.047-27.047-72.692-12.169-79.206 25.818-3.9486 23.027 11.287 46.359 34.18 52.342 8.1463 2.1293 14.707 2.2075 22.913 0.273z" fill="#d1cdc4"/></g></svg>'


    // ----- Cross-script toggle group -----
    const WF_TOGGLE_GROUP = "wf-lefttop-controls";
    const WF_TOGGLE_ACTIVE_CLASS = "wf-toggle-active";

    // Geocoder bridge postMessage types (page-context bridge)
    const WFMM_GEO_REQ = "wfmm-geocode-req";
    const WFMM_GEO_RES = "wfmm-geocode-res";

    // ==================================
    // Canvas marker rendering test
    // ==================================

    const WFMM_CANVAS_GENERIC_MARKERS_TEST = true;

    let poiCanvasOverlay = null;

    // Same GUID index idea, but generic markers can now be canvas-backed.
    // Entry shape:
    //   { renderer: "google", marker, poi }
    //   { renderer: "canvas", marker: null, poi }

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
    let powerSpotRingsByGuid = {}; // guid -> google.maps.Circle

    let lastFetchLat = null;
    let lastFetchLng = null;

    // ----- Local draft submissions -----
    let draftSubmissions = [];
    let draftMarkers = [];
    let draftMarkerLabelOverlays = [];

    let remoteDraftSubmissions = [];
    let remoteDraftMarkers = [];
    let remoteDraftMarkerLabelOverlays = [];

    let DraftMarkerLabelOverlay = null;

    // ----- Select Wayspot after deep link or search -----
    const DEEP_LINK_REASSERT_DELAYS_MS = [0, 250, 750, 1500, 3000, 5000];
    const DEEP_LINK_TOLERANCE_METRES = 10;

    let deepLinkTarget = null;
    let pendingSelectLatLng = null;
    let pendingSelect = false;
    let skipRestoreMapViewForThisLoad = false;
    let pendingSelectSourcesNeeded = null; // Set("live","gcs")
    let pendingSelectSourcesSeen = null;   // Set("live","gcs")
    let deepLinkReassertTimers = [];
    let deepLinkStartedAt = 0;

    // ----- Observers & watchers -----
    let latLngObserver = null;
    let latLngBodyObserver = null;
    let latLngTargetEl = null;
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

    // ---- Desktop vs Mobile observers ------
    let mapModeObserver = null;
    let mapModeRouteKey = null;

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
            hideZoomText: false,
            showAddress: false,
            showWayspotApprovalDate: true,
            estimatePre2019WayspotAgesFromPhotos: false,
            showWayspotSubmitterCodename: true,
            rememberLastGallerySort: false,
            lastGallerySortMode: "photo_votes",
            showPowerSpotRadiusAroundPokestopsAndGyms: false,
            displayInactivePowerSpotsAsActive: false,
            defaultDraftSaveLocation: "remote",
            showDraftMarkerTitles: false,
            recommendSquareSubmitPhotos: true,
            nearbyRadius: { enabled: true, strokeColor: "#4285F4", strokeOpacity: 0.8, strokeWidth: 2, fillColor: "#4285F4", fillOpacity: 0 },
            submitRadius: { enabled: true, strokeColor: "#e13cff", strokeOpacity: 0.8, strokeWidth: 4, fillColor: "#e13cff", fillOpacity: 0 },
            interactRadius: { enabled: true, strokeColor: "#ffcc33", strokeOpacity: 0.9, strokeWidth: 2, fillColor: "#ffed24", fillOpacity: 0.05 },
            powerSpotRadius: { enabled: true, strokeColor: "#ff47c5", strokeOpacity: 1, strokeWidth: 1.5, fillColor: "#ffffff", fillOpacity: 0 }
        },

        photoEditor: {
            guides: {
                circleGuide: false,
                ruleOfThirds: true,
                safeZone25: false,
                centreGuide: false
            }
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
    // Address reverse geocoder
    // ==================================

    async function getFormattedAddressString(lat, lng) {
        if (typeof lat !== "number" || !Number.isFinite(lat)) return null;
        if (typeof lng !== "number" || !Number.isFinite(lng)) return null;

        try {
            const results = await pageReverseGeocode(lat, lng);
            const first = Array.isArray(results) ? results[0] : null;
            const formatted = first?.formatted_address;
            return (typeof formatted === "string") ? formatted : null;
        } catch (e) {
            console.warn("[Wayfarer Map] Reverse geocode failed:", e);
            return null;
        }
    }

    function pageReverseGeocode(lat, lng, timeoutMs = 10000) {
        injectPageGeocoderBridge();

        const id = Date.now() + "-" + Math.random().toString(16).slice(2);

        return new Promise((resolve, reject) => {
            const timer = setTimeout(() => {
                window.removeEventListener("message", onMessage);
                reject(new Error("Reverse geocode timeout"));
            }, timeoutMs);

            function onMessage(ev) {
                const d = ev.data;
                if (!d || d.type !== WFMM_GEO_RES || d.id !== id) return;

                clearTimeout(timer);
                window.removeEventListener("message", onMessage);

                if (d.ok) resolve(d.results);
                else reject(new Error(d.error || "Reverse geocode failed"));
            }

            window.addEventListener("message", onMessage);
            window.postMessage({ type: WFMM_GEO_REQ, id, lat, lng }, "*");
        });
    }

    function injectPageGeocoderBridge() {
        if (document.getElementById("wfmm-geocoder-bridge")) return;

        const script = document.createElement("script");
        script.id = "wfmm-geocoder-bridge";
        script.textContent = `
        (function () {
            const REQ = ${JSON.stringify(WFMM_GEO_REQ)};
            const RES = ${JSON.stringify(WFMM_GEO_RES)};

            function geocodeAll(lat, lng) {
                return new Promise((resolve, reject) => {
                    if (!window.google || !google.maps || !google.maps.Geocoder) {
                        reject("google.maps.Geocoder not available");
                        return;
                    }

                    const geocoder = new google.maps.Geocoder();
                    geocoder.geocode({ location: { lat, lng } }, (results, status) => {
                        if (status !== "OK" || !Array.isArray(results) || !results.length) {
                            reject("Geocoder failed: " + status);
                            return;
                        }

                        // Return JSON-safe subset only
                        resolve(results.slice(0, 6).map(r => ({
                            formatted_address: r.formatted_address || null,
                            types: Array.isArray(r.types) ? r.types.slice() : [],
                            address_components: Array.isArray(r.address_components)
                                ? r.address_components.map(c => ({
                                    long_name: c.long_name || null,
                                    short_name: c.short_name || null,
                                    types: Array.isArray(c.types) ? c.types.slice() : []
                                }))
                                : []
                        })));
                    });
                });
            }

            window.addEventListener("message", async (ev) => {
                const d = ev.data;
                if (!d || d.type !== REQ) return;

                try {
                    const results = await geocodeAll(d.lat, d.lng);
                    window.postMessage({
                        type: RES,
                        id: d.id,
                        ok: true,
                        results
                    }, "*");
                } catch (e) {
                    window.postMessage({
                        type: RES,
                        id: d.id,
                        ok: false,
                        error: String(e)
                    }, "*");
                }
            });
        })();
    `;

        (document.head || document.documentElement).appendChild(script);
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
            refreshAllPoiMarkers();
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

        if (Array.isArray(draftMarkers)) {
            draftMarkers.forEach(m => {
                if (m && typeof m.setVisible === "function") {
                    m.setVisible(enabled);
                }
            });
        }

        if (Array.isArray(remoteDraftMarkers)) {
            remoteDraftMarkers.forEach(m => {
                if (m && typeof m.setVisible === "function") {
                    m.setVisible(enabled);
                }
            });
        }

        applyDraftMarkerTitleVisibilityToAllOverlays();
    }

    function isWayspotsLayerEnabled() {
        const layers = (userSettings && userSettings.layers) || {};
        const wayspotsLayer = layers.wayspots || {};
        // Default to ON unless explicitly disabled
        return wayspotsLayer.enabled !== false;
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

    function onFiltersChanged() {
        userSettings.poi.filters.enabled = true;
        saveSettings();
        refreshAllPoiMarkers();
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
    }

    function syncFiltersMenuUI() {
        const mode = getSelectedSourceModeFromSettings();
        if (filterSourceRadioAllEl) filterSourceRadioAllEl.checked = (mode === "all");
        if (filterSourceRadioCommunityEl) filterSourceRadioCommunityEl.checked = (mode === "community");
        if (filterSourceRadioOtherEl) filterSourceRadioOtherEl.checked = (mode === "other");

        const go = userSettings.poi.filters.gameObject;
        if (filterChkPokestopEl) filterChkPokestopEl.checked = !!go.pokestop;
        if (filterChkGymEl) filterChkGymEl.checked = !!go.gym;
        if (filterChkPowerspotEl) filterChkPowerspotEl.checked = !!go.powerspot;
        if (filterChkNoneEl) filterChkNoneEl.checked = !!go.none;
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

            const addressValue = document.createElement("div");
            addressValue.className = "wfmapmods-detail-address";
            addressValue.textContent = "";

            const approvalDateValue = document.createElement("div");
            approvalDateValue.className = "wfmapmods-detail-poi-approval-date";
            approvalDateValue.textContent = "";

            const submitterValue = document.createElement("div");
            submitterValue.className = "wfmapmods-detail-poi-submitter";
            submitterValue.textContent = "";

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

            // Multiple photos icon/link
            const multiplePhotosContainer = document.createElement("div");
            multiplePhotosContainer.className = "wfmapmods-detail-multiple-photos wfmapmods-is-hidden";
            const multiplePhotosLink = document.createElement("a");
            multiplePhotosLink.className = "wfmapmods-detail-multiple-photos-link";
            multiplePhotosLink.href = "#";
            multiplePhotosLink.innerHTML = MULTIPLE_PHOTOS_ICON_SVG;
            multiplePhotosLink.title = "View all photos";
            multiplePhotosLink.setAttribute("aria-label", "View all photos");

            multiplePhotosContainer.appendChild(multiplePhotosLink);

            statusRow.appendChild(poiSourceContainer);
            statusRow.appendChild(pgoEntityContainer);
            statusRow.appendChild(statusTagContainer);
            statusRow.appendChild(communityLogoContainer);
            statusRow.appendChild(multiplePhotosContainer);
            statusValue.appendChild(statusRow);

            detailsBody.appendChild(titleValue);
            detailsBody.appendChild(imageBox);
            detailsBody.appendChild(coordsValue);
            detailsBody.appendChild(addressValue);
            detailsBody.appendChild(approvalDateValue);
            detailsBody.appendChild(submitterValue);
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

            // --- Wayspot focus map ---
            const focusLinkA = document.createElement("a");
            focusLinkA.href = "#";
            focusLinkA.classList.add("wfmapmods-is-hidden", "wfmapmods-poi-focusmap");
            focusLinkA.textContent = "Focus Map";

            focusLinkA.addEventListener("click", (ev) => {
                ev.preventDefault();
                if (!lastSelectedPoi) return;
                const lat = lastSelectedPoi.lat;
                const lng = lastSelectedPoi.lng;
                if (typeof lat !== "number" || typeof lng !== "number" || !Number.isFinite(lat) || !Number.isFinite(lng)) {
                    return;
                }
                const position = new google.maps.LatLng(lat, lng);
                flyToLatLngAndPlaceSubmission(position)
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
            poiFunctionLinks.appendChild(focusLinkA);
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

            const draftSettings = document.createElement("a");
            draftSettings.textContent = "Drafts";
            draftSettings.href = "#";

            const linkNearby = document.createElement("a");
            linkNearby.href = "#";
            linkNearby.textContent = "Nearby Wayspots";

            settingsBody.appendChild(linkMapOptions);
            settingsBody.appendChild(linkMarkers);
            settingsBody.appendChild(draftSettings);
            settingsBody.appendChild(linkNearby);

            linkMapOptions.addEventListener("click", (e) => {
                e.preventDefault();
                openMapOptionsWindow();
            });

            linkMarkers.addEventListener("click", (e) => {
                e.preventDefault();
                openMarkerSettingsWindow();
            });

            draftSettings.addEventListener("click", (e) => {
                e.preventDefault();
                openDraftSettingsWindow();
            });

            linkNearby.addEventListener("click", (ev) => {
                ev.preventDefault();
                openNearbyWayspotsModal();
            });

            settingsSection.appendChild(settingsBody);

            // ==============================
            // SECTION 6: Last map sync
            // ==============================
            const lastSyncSection = document.createElement("div");
            lastSyncSection.className = "wfmapmods-last-sync wfmapmods-is-hidden";
            lastSyncSection.style.textAlign = "center";
            lastSyncSection.style.fontSize = "11px";
            lastSyncSection.style.opacity = "0.75";
            lastSyncSection.style.padding = "10px 6px 6px";

            lastMapSyncEl = lastSyncSection;
            renderLastMapSyncLabel();
            ensureLastMapSyncTimer();

            // Assemble content
            content.appendChild(searchSection);
            content.appendChild(detailsSection);
            content.appendChild(divider1);
            content.appendChild(poiFunctionsSection);
            content.appendChild(divider2);
            content.appendChild(locationFunctionsSection);
            content.appendChild(divider3);
            content.appendChild(settingsSection);
            content.appendChild(lastSyncSection);

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

    function renderPoiGameEntityIcon(pgoEntityLogoEl, poi) {
        if (!pgoEntityLogoEl) return;

        if (isCourtsOfTheWorldPoi(poi)) {
            pgoEntityLogoEl.style.display = "flex";
            pgoEntityLogoEl.style.position = "relative";
            pgoEntityLogoEl.style.overflow = "visible";
            pgoEntityLogoEl.innerHTML = COURTS_OF_THE_WORLD_BASKETBALL_ICON_SVG;
            pgoEntityLogoEl.title = "Courts of the World imports do not natively appear on the Wayfarer Map, and lack data about Gym or PokéStop status.";
            pgoEntityLogoEl.dataset.inactive = "0";
            pgoEntityLogoEl.dataset.slashed = "0";
            pgoEntityLogoEl.dataset.iconKey = "courts-of-the-world";

            const svg = pgoEntityLogoEl.querySelector("svg");
            if (svg) {
                Object.assign(svg.style, {
                    width: "100%",
                    height: "100%",
                    display: "block",
                    opacity: "1",
                    filter: ""
                });
            }

            return;
        }

        const entityRaw = (poi?.pgoEntity || "").toUpperCase();
        const statusRaw = (poi?.pgoEntityStatus || "").toUpperCase();

        const iconSvg =
              entityRaw === "POKESTOP" ? POI_TYPE_ICONS.stop :
        entityRaw === "GYM" ? POI_TYPE_ICONS.gym :
        entityRaw === "POWERSPOT" ? POI_TYPE_ICONS.powerspot :
        "";

        const label =
              entityRaw === "POKESTOP" ? "PokéStop" :
        entityRaw === "GYM" ? "Gym" :
        entityRaw === "POWERSPOT" ? "Power Spot" :
        "";

        const isInactive = statusRaw === "INACTIVE";
        const showSlash = isInactive && (entityRaw === "POKESTOP" || entityRaw === "GYM");

        if (!iconSvg) {
            pgoEntityLogoEl.style.display = "none";
            pgoEntityLogoEl.innerHTML = "";
            pgoEntityLogoEl.removeAttribute("title");
            delete pgoEntityLogoEl.dataset.inactive;
            delete pgoEntityLogoEl.dataset.slashed;
            delete pgoEntityLogoEl.dataset.iconKey;
            return;
        }

        pgoEntityLogoEl.style.display = "flex";
        pgoEntityLogoEl.style.position = "relative";
        pgoEntityLogoEl.style.overflow = "visible";

        const iconKey = `${entityRaw}|${statusRaw}|${showSlash ? "slashed" : "normal"}`;
        if (pgoEntityLogoEl.dataset.iconKey !== iconKey) {
            pgoEntityLogoEl.innerHTML = iconSvg + (showSlash
                                                   ? `<span class="wfmapmods-pgo-inactive-slash" aria-hidden="true"></span>`
                                                   : "");
            pgoEntityLogoEl.dataset.iconKey = iconKey;
        }

        const svg = pgoEntityLogoEl.querySelector("svg");
        if (svg) {
            Object.assign(svg.style, {
                width: "100%",
                height: "100%",
                display: "block"
            });
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

    function renderPoiCommunityContributionIcon(communityLogoEl, poi) {
        if (!communityLogoEl) return;

        const cc = isCourtsOfTheWorldPoi(poi) ? false : poi?.isCommunityContributed;

        const iconSvg =
              cc === true ? COMMUNITY_CONTRIBUTED_ICON_SVG :
        cc === false ? IMPORT_ICON_SVG :
        "";

        if (!iconSvg) {
            communityLogoEl.style.display = "none";
            communityLogoEl.innerHTML = "";
            communityLogoEl.removeAttribute("title");
            delete communityLogoEl.dataset.iconKey;
            return;
        }

        communityLogoEl.style.display = "flex";

        const iconKey = cc === true ? "community" : "import";
        if (communityLogoEl.dataset.iconKey !== iconKey) {
            communityLogoEl.innerHTML = iconSvg;
            communityLogoEl.dataset.iconKey = iconKey;

            const svg = communityLogoEl.querySelector("svg");
            if (svg) {
                Object.assign(svg.style, {
                    width: "100%",
                    height: "100%",
                    display: "block"
                });
            }
        }

        communityLogoEl.title = cc === true ? "Community Contributed" : "Imported Wayspot";
    }

    function refreshSelectedPoiStatusIconsFromPoi(poi) {
        if (!sidePanelEl || !poi) return;

        renderPoiGameEntityIcon(
            sidePanelEl.querySelector(".wfmapmods-detail-pgo-entity-logo"),
            poi
        );

        renderPoiCommunityContributionIcon(
            sidePanelEl.querySelector(".wfmapmods-detail-community-logo"),
            poi
        );
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
        updateTopRightControlsVisibility();
    }

    function collapseSidePanelIfOpen() {
        if (currentMapMode !== MAP_MODE.MOBILE) return;
        if (!sidePanelEl) return;
        if (sidePanelCollapsed) return;

        sidePanelCollapsed = true;
        applySidePanelCollapseState();
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
    }

    function populateSidePanelFromPoi(poi) {
        if (!poi) return;

        ensureSidePanel();
        if (!sidePanelEl) return;

        const detailsSection       = sidePanelEl.querySelector(".wfmapmods-section-details");
        const poiFunctionsSection  = sidePanelEl.querySelector(".wfmapmods-section-poi-functions");
        const divider              = sidePanelEl.querySelector(".wfmapmods-section-divider-details");
        const titleEl              = sidePanelEl.querySelector(".wfmapmods-detail-title");
        const statusEl             = sidePanelEl.querySelector(".wfmapmods-detail-status-tag-container");
        const coordsEl             = sidePanelEl.querySelector(".wfmapmods-detail-coords");
        const addressEl            = sidePanelEl.querySelector(".wfmapmods-detail-address");
        const approvalDateEl       = sidePanelEl.querySelector(".wfmapmods-detail-poi-approval-date");
        const submitterEl          = sidePanelEl.querySelector(".wfmapmods-detail-poi-submitter");
        const imgBox               = sidePanelEl.querySelector(".wfmapmods-detail-image-box");
        const sourceLogoEl         = sidePanelEl.querySelector(".wfmapmods-detail-poi-source");
        const pgoEntityLogoEl      = sidePanelEl.querySelector(".wfmapmods-detail-pgo-entity-logo");
        const communityLogoEl      = sidePanelEl.querySelector(".wfmapmods-detail-community-logo");
        const multiplePhotosEl     = sidePanelEl.querySelector(".wfmapmods-detail-multiple-photos");
        const multiplePhotosLinkEl = sidePanelEl.querySelector(".wfmapmods-detail-multiple-photos-link");

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
        renderPoiGameEntityIcon(pgoEntityLogoEl, poi);

        // ----- Community / Import logo -----
        renderPoiCommunityContributionIcon(communityLogoEl, poi);

        // ----- Multiple photos icon/link -----
        if (multiplePhotosEl && multiplePhotosLinkEl) {
            updateSelectedPoiGalleryButton(poi);

            const guidAtRequestTime = poi?.guid || null;

            ensurePoiImagesLoaded(poi, { onlyIfStillSelected: false })
                .then(() => {
                refreshSelectedPoiGalleryButtonFromLoadedImages(poi, guidAtRequestTime);
            })
                .catch(err => {
                console.warn("[WFMM] Failed to update gallery button from poi-images:", err);
            });
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
            const focusLinkA = sidePanelEl.querySelector(".wfmapmods-poi-function-links .wfmapmods-poi-focusmap");
            const reportA = sidePanelEl.querySelector(".wfmapmods-poi-function-links .wfmapmods-poi-reportlink");

            if (poi.lat && poi.lng) {

                if(focusLinkA) {
                    focusLinkA.classList.remove("wfmapmods-is-hidden");
                }

                const url = buildDeepLinkUrl(poi.lat, poi.lng);

                if (deepLinkA) {
                    deepLinkA.dataset.link = url;
                    deepLinkA.textContent = "Wayspot link";
                    deepLinkA.classList.remove("wfmapmods-is-hidden");
                }
            }

            // Show report link if we have a guid and >00 submissions
            if (!reportA) {
                // Report link element not present in this panel/template
            } else if (!poi.guid) {
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

        // ----- Address -----
        if (addressEl) {
            if (!userSettings?.map?.showAddress) {
                setSelectedPoiAddressInPanel("");
            } else {
                setSelectedPoiAddressInPanel(poi.address || "");
            }
        }

        // ----- POI details metadata from poi-details -----
        if (approvalDateEl || submitterEl) {
            updateSelectedPoiDetailsMetadataFromPoi(poi);

            if (userSettings?.map?.showWayspotApprovalDate || userSettings?.map?.showWayspotSubmitterCodename) {
                ensureSelectedPoiDetailsMetadataLoaded(poi).catch(err => {
                    console.warn("[WFMM - Base] Failed to load POI details metadata:", err);
                });
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
    // Display address for poi details
    // ==================================

    async function ensureSelectedPoiAddressLoaded(poi) {
        try {
            if (!poi || !userSettings?.map?.showAddress) return;
            if (!isValidLatLng(poi.lat, poi.lng)) return;

            // If we already have it, just paint it
            if (poi.address) {
                if (poi.guid && poi.guid === selectedPoiGuid) setSelectedPoiAddressInPanel(poi.address);
                return;
            }

            // Show a temporary placeholder in the panel
            if (poi.guid && poi.guid === selectedPoiGuid) setSelectedPoiAddressInPanel("Loading address…");

            const guid = poi.guid;
            const addr = await getFormattedAddressString(poi.lat, poi.lng);

            // selection may have changed
            if (guid && guid !== selectedPoiGuid) return;

            poi.address = addr || "";
            if (poi.address) setSelectedPoiAddressInPanel(poi.address);
            else setSelectedPoiAddressInPanel("");
        } catch {
            // fail silently
            if (poi?.guid && poi.guid === selectedPoiGuid) setSelectedPoiAddressInPanel("");
        }
    }

    function clearSelectedPoiAddressInPanel() {
        if (!sidePanelEl) return;
        const el = sidePanelEl.querySelector(".wfmapmods-detail-address");
        if (el) el.textContent = "";
    }

    function setSelectedPoiAddressInPanel(text) {
        if (!sidePanelEl) return;

        const el = sidePanelEl.querySelector(".wfmapmods-detail-address");
        if (!el) return;

        if (!text) {
            el.textContent = "";
            el.title = "";
            el.style.cursor = "";
            el.onclick = null;
            return;
        }

        el.textContent = text;
        el.title = "Copy address";
        el.style.cursor = "pointer";

        el.onclick = () => {
            copyAddressToClipboard(text).catch(() => {});
        };
    }

    function formatPoiDetailsDateFromTimestampMs(timestampMs) {
        const safeTimestamp = normaliseNullableTimestampMs(timestampMs);
        if (safeTimestamp === null) return "";

        const date = new Date(safeTimestamp);
        if (Number.isNaN(date.getTime())) return "";

        const locales = Array.isArray(navigator.languages) && navigator.languages.length
        ? navigator.languages
        : (navigator.language || undefined);

        return new Intl.DateTimeFormat(locales, {
            year: "numeric",
            month: "short",
            day: "numeric"
        }).format(date);
    }

    function getPoiApprovalDateText(poi) {
        return formatPoiDetailsDateFromTimestampMs(poi?.creationTimestampMs);
    }

    function getPoiSubmitterCodenameText(poi) {
        return normaliseNullableString(poi?.submitterTrainerName)?.trim() || "";
    }

    function getPoiDetailsDateVerb(poi) {
        return isImportedPoi(poi) ? "Imported" : "Approved";
    }

    function clearSelectedPoiDetailsMetadataInPanel() {
        if (!sidePanelEl) return;

        const approvalEl = sidePanelEl.querySelector(".wfmapmods-detail-poi-approval-date");
        const submitterEl = sidePanelEl.querySelector(".wfmapmods-detail-poi-submitter");

        if (approvalEl) {
            approvalEl.textContent = "";
            approvalEl.classList.add("wfmapmods-is-hidden");
        }

        if (submitterEl) {
            submitterEl.textContent = "";
            submitterEl.classList.add("wfmapmods-is-hidden");
        }
    }

    function updateSelectedPoiDetailsMetadataFromPoi(poi) {
        if (!sidePanelEl || !poi) return;

        const approvalEl = sidePanelEl.querySelector(".wfmapmods-detail-poi-approval-date");
        const submitterEl = sidePanelEl.querySelector(".wfmapmods-detail-poi-submitter");

        const dateLine = getPoiDetailsDateLine(poi);
        const dateTitle = getPoiDetailsDateTitle(poi);
        const submitterName = getPoiSubmitterCodenameText(poi);

        if (approvalEl) {
            const shouldShowDate = !!userSettings?.map?.showWayspotApprovalDate && !!dateLine;

            approvalEl.textContent = shouldShowDate ? dateLine : "";
            approvalEl.title = shouldShowDate ? dateTitle : "";
            approvalEl.classList.toggle("wfmapmods-is-hidden", !shouldShowDate);
            approvalEl.classList.toggle("wfmapmods-detail-poi-date-estimated", shouldShowDate && !!dateTitle);
        }

        if (submitterEl) {
            const shouldShowSubmitter = !!userSettings?.map?.showWayspotSubmitterCodename && !!submitterName;

            submitterEl.textContent = shouldShowSubmitter ? `Submitted by ${submitterName}` : "";
            submitterEl.classList.toggle("wfmapmods-is-hidden", !shouldShowSubmitter);
        }
    }

    function getOldestPoiImageTimestampMs(poi) {
        const records = buildPoiImageRecordList(poi);

        let oldest = null;

        for (const record of records) {
            const timestamp = normaliseNullableTimestampMs(record?.creationTimestampMs);
            if (timestamp === null) continue;

            if (oldest === null || timestamp < oldest) {
                oldest = timestamp;
            }
        }

        return oldest;
    }

    function canEstimatePoiCreationDateFromPhotos(poi) {
        if (!userSettings?.map?.estimatePre2019WayspotAgesFromPhotos) return false;
        if (normaliseNullableTimestampMs(poi?.creationTimestampMs) !== null) return false;

        const oldestPhotoTimestamp = getOldestPoiImageTimestampMs(poi);
        if (oldestPhotoTimestamp === null) return false;

        return oldestPhotoTimestamp < WAYSPOST_PHOTO_ESTIMATE_CUTOFF_TIMESTAMP_MS;
    }

    function getEstimatedPoiCreationTimestampMsFromPhotos(poi) {
        if (!canEstimatePoiCreationDateFromPhotos(poi)) return null;
        return getOldestPoiImageTimestampMs(poi);
    }

    function getPoiDetailsDateInfo(poi) {
        const actualTimestamp = normaliseNullableTimestampMs(poi?.creationTimestampMs);

        if (actualTimestamp !== null) {
            return {
                timestampMs: actualTimestamp,
                estimated: false,
                verb: getPoiDetailsDateVerb(poi)
            };
        }

        const estimatedTimestamp = getEstimatedPoiCreationTimestampMsFromPhotos(poi);

        if (estimatedTimestamp !== null) {
            return {
                timestampMs: estimatedTimestamp,
                estimated: true,
                verb: "Approved"
            };
        }

        return {
            timestampMs: null,
            estimated: false,
            verb: ""
        };
    }

    function getPoiDetailsDateLine(poi) {
        const info = getPoiDetailsDateInfo(poi);
        if (info.timestampMs === null) return "";

        const dateText = formatPoiDetailsDateFromTimestampMs(info.timestampMs);
        if (!dateText) return "";

        return `${info.verb} ${dateText}${info.estimated ? "*" : ""}`;
    }

    function getPoiDetailsDateTitle(poi) {
        const info = getPoiDetailsDateInfo(poi);

        if (info.estimated) {
            return "Estimated creation date based on oldest photo";
        }

        return "";
    }

    async function ensureSelectedPoiDetailsMetadataLoaded(poi) {
        if (!poi || !poi.guid) {
            clearSelectedPoiDetailsMetadataInPanel();
            return;
        }

        if (!userSettings?.map?.showWayspotApprovalDate && !userSettings?.map?.showWayspotSubmitterCodename) {
            clearSelectedPoiDetailsMetadataInPanel();
            return;
        }

        updateSelectedPoiDetailsMetadataFromPoi(poi);
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

    function getExportablePois() {
        const pois = Array.isArray(window.currentPois) ? window.currentPois : [];
        if (!pois.length) return [];

        const zoom = wfMap?.getZoom?.();
        const useFilters = typeof zoom === "number" && zoom >= GCS_MIN_ZOOM;

        if (!useFilters) return pois;

        // Only export POIs that are currently "visible" under your filters/layer logic
        return pois.filter((p) => getMarkerVisibilityForPoi(p).visibleNow);
    }

    function isExportFilteredByUserSettings() {
        const zoom = wfMap?.getZoom?.();
        if (typeof zoom !== "number" || zoom < GCS_MIN_ZOOM) return false;

        const f = userSettings?.poi?.filters;
        return !!(f && f.enabled !== false);
    }

    function openNearbyWayspotsModal() {
        const pois = getExportablePois();

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
                if (!pois.length) {
                    intro.textContent = "No Wayspots are currently loaded onto the map.";
                } else if (isExportFilteredByUserSettings()) {
                    intro.textContent = "Showing only Wayspots that match your current filters.";
                } else {
                    intro.textContent = "Nearby Wayspots which are loaded onto the map.";
                }
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
        const pois = getExportablePois();
        if (!pois.length) {
            alert("No nearby Wayspots are currently visible with the active filters/layers.");
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

            const lat = (typeof p.lat === "number") ? p.lat : Number(p.lat);
            const lng = (typeof p.lng === "number") ? p.lng : Number(p.lng);

            rows.push([
                p.guid || "",
                p.title || "",
                p.description || "",
                p.address || "",
                Number.isFinite(lat) ? lat : (p.lat || ""),
                Number.isFinite(lng) ? lng : (p.lng || ""),
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
            pgoEntityStatus: payload.pgoEntityStatus || "",
            hasAdditionalImages: payload.hasAdditionalImages,
        };

        populateSidePanelFromPoi(poi);
        applyPoiSelectionVisuals(poi);

        // Address (only if enabled)
        if (userSettings?.map?.showAddress) {
            ensureSelectedPoiAddressLoaded(poi);
        } else {
            clearSelectedPoiAddressInPanel();
        }
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
            pgoEntityStatus: poi.pgoEntityStatus || "",
            hasAdditionalImages: poi.hasAdditionalImages || false,
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

    // ==========================================
    // Main Photo Editor - 1:1 Square Crop Tool
    // ==========================================

    function getPhotoEditorGuideSettings() {
        return userSettings.photoEditor.guides;
    }

    function savePhotoEditorGuideSettingsFromState(state) {
        const guides = getPhotoEditorGuideSettings();

        guides.circleGuide = !!state.showCircleGuide;
        guides.ruleOfThirds = !!state.showThirds;
        guides.safeZone25 = !!state.showSafeZone;
        guides.centreGuide = !!state.showCenter;

        saveSettings();
    }

    function canvasToBlob(canvas, type, quality) {
        return new Promise((resolve, reject) => {
            canvas.toBlob((blob) => {
                if (!blob) reject(new Error("Could not create edited image blob."));
                else resolve(blob);
            }, type, quality);
        });
    }

    function loadImageFromUrl(url) {
        return new Promise((resolve, reject) => {
            const img = new Image();

            img.onload = () => resolve(img);
            img.onerror = () => reject(new Error("Could not load image."));

            // Safe for blob/data URLs. For remote URLs, fetch-to-blob below is preferred.
            img.src = url;
        });
    }

    function getOriginalGoogleusercontentUrl(url) {
        if (!url || typeof url !== "string") return url;

        // Only alter Googleusercontent image serving URLs.
        if (!/\/\/[^/]*googleusercontent\.com\//i.test(url)) return url;

        // Remove existing size transform at the end, then request original size.
        if (/[?&=](s|w|h)\d+/i.test(url) || /=s\d+/i.test(url) || /=w\d+-h\d+/i.test(url)) {
            return url.replace(/=s\d+(?:-[a-z])?$/i, "=s0")
                .replace(/=w\d+-h\d+(?:-[a-z])?$/i, "=s0");
        }

        // If it has no trailing transform, append original-size request.
        if (!/[?&]$/.test(url) && !/=s0$/i.test(url)) {
            return url + "=s0";
        }

        return url;
    }

    function getImageDisplayUrl(state) {
        if (!state) return null;

        return state._wfmmEditPreviewDataUrl ||
            state.url ||
            null;
    }

    function getImageEditUrl(state) {
        if (!state) return null;

        const url =
              state.servingUrl ||
              state.url ||
              null;

        return getOriginalGoogleusercontentUrl(url);
    }

    function canEditImageState(state) {
        if (!state || state._pending) return false;

        return state.file instanceof Blob ||
            !!getImageEditUrl(state);
    }


    async function blobFromImageState(state) {
        if (!state) return null;

        if (state.file instanceof Blob) {
            return state.file;
        }

        const url = getImageEditUrl(state);

        if (!url) {
            throw new Error("This image cannot be edited because it does not include a usable image URL.");
        }

        return await fetchImageBlobForSubmit(url);
    }

    function roundEditNumber(value) {
        return Math.round(Number(value) * 1000) / 1000;
    }

    function getOrientedSizeForEdit(sourceW, sourceH, quarterTurns) {
        const r = ((quarterTurns % 4) + 4) % 4;

        if (r === 1 || r === 3) {
            return { w: sourceH, h: sourceW };
        }

        return { w: sourceW, h: sourceH };
    }

    function createDefaultMainPhotoEdit(sourceW, sourceH, quarterTurns = 0, freeRotationDeg = 0) {
        const s = getOrientedSizeForEdit(sourceW, sourceH, quarterTurns);

        const a =
              Math.abs(Math.cos(freeRotationDeg * Math.PI / 180)) +
              Math.abs(Math.sin(freeRotationDeg * Math.PI / 180));

        const cropSize = Math.floor(Math.min(s.w, s.h) / Math.max(1, a));

        return {
            version: 1,
            sourceW,
            sourceH,
            rotationQuarterTurns: quarterTurns,
            freeRotationDeg,
            cropX: (s.w - cropSize) / 2,
            cropY: (s.h - cropSize) / 2,
            cropSize
        };
    }

    function normaliseMainPhotoEdit(edit) {
        if (!edit) return null;

        return {
            version: 1,
            sourceW: edit.sourceW,
            sourceH: edit.sourceH,
            rotationQuarterTurns: edit.rotationQuarterTurns,
            freeRotationDeg: edit.freeRotationDeg,
            cropX: edit.cropX,
            cropY: edit.cropY,
            cropSize: edit.cropSize
        };
    }

    function mainPhotoEditSignature(edit) {
        if (!edit) return "";

        return JSON.stringify({
            sourceW: Math.round(edit.sourceW),
            sourceH: Math.round(edit.sourceH),
            rotationQuarterTurns: ((edit.rotationQuarterTurns % 4) + 4) % 4,
            freeRotationDeg: roundEditNumber(edit.freeRotationDeg),
            cropX: Math.round(edit.cropX),
            cropY: Math.round(edit.cropY),
            cropSize: Math.round(edit.cropSize)
        });
    }

    function isDefaultMainPhotoEdit(edit) {
        if (!edit) return true;

        // If the source is not already square, even the default centred square crop
        // is a real edit and must be preserved.
        if (Math.round(edit.sourceW) !== Math.round(edit.sourceH)) {
            return false;
        }

        const def = createDefaultMainPhotoEdit(edit.sourceW, edit.sourceH, 0, 0);

        return mainPhotoEditSignature(edit) === mainPhotoEditSignature(def);
    }

    function cloneImageStateWithEdit(originalState, edit, previewDataUrl) {
        const next = Object.assign({}, originalState);

        if (isDefaultMainPhotoEdit(edit)) {
            delete next._wfmmEdit;
            delete next._wfmmEditPreviewDataUrl;
            return next;
        }

        next._wfmmEdit = normaliseMainPhotoEdit(edit);
        next._wfmmEditPreviewDataUrl = previewDataUrl;

        return next;
    }

    function makeOrientedCanvasForEdit(img, quarterTurns) {
        const sourceW = img.naturalWidth || img.width;
        const sourceH = img.naturalHeight || img.height;
        const s = getOrientedSizeForEdit(sourceW, sourceH, quarterTurns);
        const r = ((quarterTurns % 4) + 4) % 4;

        const canvas = document.createElement("canvas");
        canvas.width = s.w;
        canvas.height = s.h;

        const ctx = canvas.getContext("2d", { alpha: false });
        ctx.fillStyle = "#000";
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        ctx.save();

        if (r === 0) {
            ctx.drawImage(img, 0, 0);
        } else if (r === 1) {
            ctx.translate(s.w, 0);
            ctx.rotate(Math.PI / 2);
            ctx.drawImage(img, 0, 0);
        } else if (r === 2) {
            ctx.translate(s.w, s.h);
            ctx.rotate(Math.PI);
            ctx.drawImage(img, 0, 0);
        } else if (r === 3) {
            ctx.translate(0, s.h);
            ctx.rotate(-Math.PI / 2);
            ctx.drawImage(img, 0, 0);
        }

        ctx.restore();

        return canvas;
    }

    function renderMainPhotoEditToCanvas(img, edit, outputSize = null) {
        const e = normaliseMainPhotoEdit(edit);
        if (!e) throw new Error("Missing photo edit data.");

        const outSize = Math.max(64, Math.floor(outputSize || e.cropSize));
        const scale = outSize / e.cropSize;

        const oriented = makeOrientedCanvasForEdit(img, e.rotationQuarterTurns);

        const out = document.createElement("canvas");
        out.width = outSize;
        out.height = outSize;

        const ctx = out.getContext("2d", { alpha: false });
        ctx.fillStyle = "#000";
        ctx.fillRect(0, 0, outSize, outSize);

        ctx.save();

        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = "high";

        ctx.translate(outSize / 2, outSize / 2);
        ctx.rotate(e.freeRotationDeg * Math.PI / 180);
        ctx.scale(scale, scale);
        ctx.translate(
            -(e.cropX + e.cropSize / 2),
            -(e.cropY + e.cropSize / 2)
        );

        ctx.drawImage(oriented, 0, 0);

        ctx.restore();

        return out;
    }

    async function renderMainPhotoEditToBlob(imageState, edit, options = {}) {
        const blob = await blobFromImageState(imageState);
        const objectUrl = URL.createObjectURL(blob);

        try {
            const img = await loadImageFromUrl(objectUrl);
            const canvas = renderMainPhotoEditToCanvas(img, edit, options.outputSize);
            return await canvasToBlob(canvas, "image/jpeg", options.quality || 0.94);
        } finally {
            URL.revokeObjectURL(objectUrl);
        }
    }

    async function renderMainPhotoEditPreviewDataUrl(imageState, edit) {
        const blob = await renderMainPhotoEditToBlob(imageState, edit, {
            outputSize: 512,
            quality: 0.86
        });

        return await new Promise((resolve, reject) => {
            const reader = new FileReader();

            reader.onload = () => resolve(reader.result);
            reader.onerror = () => reject(reader.error || new Error("Could not create edited preview."));
            reader.readAsDataURL(blob);
        });
    }

    async function resolveImageBlobForSubmit(state) {
        if (!state) return null;

        if (state.file instanceof Blob) {
            return state.file;
        }

        const url = getImageEditUrl(state);

        if (url) {
            return await fetchImageBlobForSubmit(url);
        }

        return null;
    }

    function openMainPhotoEditor(options) {
        const { imageState, onSave } = options || {};

        if (!imageState) {
            alert("No main photo has been loaded yet.");
            return;
        }

        const originalState = imageState;

        let objectUrlToRevoke = null;
        let resizeCanvasHandler = null;
        let editorClosed = false;

        const backdrop = document.createElement("div");
        backdrop.className = "wfmm-photo-editor-backdrop";

        const editor = document.createElement("div");
        editor.className = "wfmm-photo-editor";

        editor.innerHTML = `
        <div class="wfmm-photo-editor-header">
            <div>
                <div class="wfmm-photo-editor-title">Edit main photo</div>
                <div class="wfmm-photo-editor-subtitle">
                    Loading the full-resolution image…
                </div>
            </div>
        </div>

        <div class="wfmm-photo-editor-body">
            <div class="wfmm-photo-editor-loading">
                <div class="wfmm-photo-editor-loading-inner">
                    <div class="wfmm-photo-editor-loading-title">Loading photo…</div>
                    <div class="wfmm-photo-editor-loading-detail">Fetching the original image for editing.</div>
                </div>
            </div>
        </div>

        <div class="wfmm-photo-editor-footer">
            <div></div>
            <div>
                <button type="button" data-action="cancel">Cancel</button>
            </div>
        </div>
    `;

        backdrop.appendChild(editor);
        document.body.appendChild(backdrop);

        function closeEditor() {
            editorClosed = true;

            if (objectUrlToRevoke) {
                URL.revokeObjectURL(objectUrlToRevoke);
                objectUrlToRevoke = null;
            }

            backdrop.remove();

            window.removeEventListener("keydown", onEditorKeyDown, true);

            if (resizeCanvasHandler) {
                window.removeEventListener("resize", resizeCanvasHandler);
                resizeCanvasHandler = null;
            }
        }

        function onEditorKeyDown(event) {
            if (event.key === "Escape") {
                event.preventDefault();
                event.stopPropagation();
                event.stopImmediatePropagation();
                closeEditor();
            }
        }

        function onLoadingClick(event) {
            const btn = event.target.closest("button[data-action]");
            if (!btn) return;

            if (btn.dataset.action === "cancel") {
                closeEditor();
            }
        }

        window.addEventListener("keydown", onEditorKeyDown, true);
        editor.addEventListener("click", onLoadingClick);

        blobFromImageState(imageState)
            .then((blob) => {
            const objectUrl = URL.createObjectURL(blob);
            objectUrlToRevoke = objectUrl;

            return loadImageFromUrl(objectUrl).then((img) => ({ img }));
        })
            .then(({ img }) => {
            if (editorClosed) return;

            editor.removeEventListener("click", onLoadingClick);
            buildEditor(img);
        })
            .catch((err) => {
            console.error("[WFMM Photo Editor] Failed to load image:", err);

            if (editorClosed) return;

            editor.innerHTML = `
                <div class="wfmm-photo-editor-header">
                    <div>
                        <div class="wfmm-photo-editor-title">Edit main photo</div>
                        <div class="wfmm-photo-editor-subtitle">
                            The image could not be loaded.
                        </div>
                    </div>
                </div>

                <div class="wfmm-photo-editor-body">
                    <div class="wfmm-photo-editor-loading">
                        <div class="wfmm-photo-editor-loading-inner">
                            <div class="wfmm-photo-editor-loading-title">Could not load photo</div>
                            <div class="wfmm-photo-editor-loading-detail">
                                ${err?.message || "The full-resolution image could not be fetched."}
                            </div>
                        </div>
                    </div>
                </div>

                <div class="wfmm-photo-editor-footer">
                    <div></div>
                    <div>
                        <button type="button" data-action="cancel">Close</button>
                    </div>
                </div>
            `;

            editor.addEventListener("click", onLoadingClick);
        });

        function buildEditor(img) {
            const sourceW = img.naturalWidth || img.width;
            const sourceH = img.naturalHeight || img.height;

            if (!sourceW || !sourceH) {
                closeEditor();
                alert("Could not determine image size.");
                return;
            }

            const savedEdit = normaliseMainPhotoEdit(originalState._wfmmEdit);

            const state = {
                tool: "crop",
                rotationQuarterTurns: 0,
                freeRotationDeg: 0,

                cropX: 0,
                cropY: 0,
                cropSize: 0,

                showCircleGuide: getPhotoEditorGuideSettings().circleGuide,
                showThirds: getPhotoEditorGuideSettings().ruleOfThirds,
                showSafeZone: getPhotoEditorGuideSettings().safeZone25,
                showCenter: getPhotoEditorGuideSettings().centreGuide,
                showPhotoDiscPreview: false,

                activeDrag: null,
                activeHandle: null,
                dragStartX: 0,
                dragStartY: 0,
                startCropX: 0,
                startCropY: 0,
                startCropSize: 0,
                startFreeRotationDeg: 0,
                startPointerAngle: 0,

                layout: null,
                dpr: 1
            };

            const orientedCache = {
                quarterTurns: null,
                canvas: null
            };

            let initialSignature = null;

            function degToRad(deg) {
                return deg * Math.PI / 180;
            }

            function normaliseAngleDeg(deg) {
                while (deg > 180) deg -= 360;
                while (deg < -180) deg += 360;
                return deg;
            }

            function rotatePoint(px, py, cx, cy, angleRad) {
                const dx = px - cx;
                const dy = py - cy;
                const c = Math.cos(angleRad);
                const s = Math.sin(angleRad);

                return {
                    x: cx + dx * c - dy * s,
                    y: cy + dx * s + dy * c
                };
            }

            function orientedSize() {
                return getOrientedSizeForEdit(sourceW, sourceH, state.rotationQuarterTurns);
            }

            function getCurrentEdit() {
                return {
                    version: 1,
                    sourceW,
                    sourceH,
                    rotationQuarterTurns: ((state.rotationQuarterTurns % 4) + 4) % 4,
                    freeRotationDeg: roundEditNumber(state.freeRotationDeg),
                    cropX: roundEditNumber(state.cropX),
                    cropY: roundEditNumber(state.cropY),
                    cropSize: roundEditNumber(state.cropSize)
                };
            }

            function getOrientedCanvas() {
                const r = ((state.rotationQuarterTurns % 4) + 4) % 4;

                if (orientedCache.canvas && orientedCache.quarterTurns === r) {
                    return orientedCache.canvas;
                }

                const canvas = makeOrientedCanvasForEdit(img, r);

                orientedCache.quarterTurns = r;
                orientedCache.canvas = canvas;

                return canvas;
            }

            function maxCropSizeForCurrentRotation() {
                const s = orientedSize();

                const a =
                      Math.abs(Math.cos(degToRad(state.freeRotationDeg))) +
                      Math.abs(Math.sin(degToRad(state.freeRotationDeg)));

                return Math.floor(Math.min(s.w, s.h) / Math.max(1, a));
            }

            function resetCropToMaxCentered() {
                const s = orientedSize();

                state.cropSize = maxCropSizeForCurrentRotation();
                state.cropX = (s.w - state.cropSize) / 2;
                state.cropY = (s.h - state.cropSize) / 2;

                clampCrop();
            }

            function applyEditToState(edit) {
                const e = normaliseMainPhotoEdit(edit);

                if (
                    e &&
                    Math.round(e.sourceW) === Math.round(sourceW) &&
                    Math.round(e.sourceH) === Math.round(sourceH) &&
                    e.cropSize > 0
                ) {
                    state.rotationQuarterTurns = ((e.rotationQuarterTurns % 4) + 4) % 4;
                    state.freeRotationDeg = e.freeRotationDeg;
                    state.cropX = e.cropX;
                    state.cropY = e.cropY;
                    state.cropSize = e.cropSize;
                    clampCrop();
                    return;
                }

                state.rotationQuarterTurns = 0;
                state.freeRotationDeg = 0;
                resetCropToMaxCentered();
            }

            function cropSourceCorners(
            cropX = state.cropX,
             cropY = state.cropY,
             cropSize = state.cropSize
            ) {
                const cx = cropX + cropSize / 2;
                const cy = cropY + cropSize / 2;
                const angle = -degToRad(state.freeRotationDeg);

                return [
                    rotatePoint(cropX, cropY, cx, cy, angle),
                    rotatePoint(cropX + cropSize, cropY, cx, cy, angle),
                    rotatePoint(cropX + cropSize, cropY + cropSize, cx, cy, angle),
                    rotatePoint(cropX, cropY + cropSize, cx, cy, angle)
                ];
            }

            function cropSourceBounds(
            cropX = state.cropX,
             cropY = state.cropY,
             cropSize = state.cropSize
            ) {
                const pts = cropSourceCorners(cropX, cropY, cropSize);

                return {
                    minX: Math.min(...pts.map(p => p.x)),
                    maxX: Math.max(...pts.map(p => p.x)),
                    minY: Math.min(...pts.map(p => p.y)),
                    maxY: Math.max(...pts.map(p => p.y))
                };
            }

            function clampCrop() {
                const s = orientedSize();

                const minCropSize = Math.max(64, Math.floor(Math.min(s.w, s.h) * 0.05));
                const maxCropSize = Math.max(minCropSize, maxCropSizeForCurrentRotation());

                state.cropSize = Math.max(minCropSize, Math.min(maxCropSize, state.cropSize));

                for (let i = 0; i < 4; i++) {
                    const b = cropSourceBounds();

                    if (b.minX < 0) state.cropX += -b.minX;
                    if (b.maxX > s.w) state.cropX -= b.maxX - s.w;

                    if (b.minY < 0) state.cropY += -b.minY;
                    if (b.maxY > s.h) state.cropY -= b.maxY - s.h;
                }

                const finalBounds = cropSourceBounds();

                if (
                    finalBounds.minX < -0.1 ||
                    finalBounds.maxX > s.w + 0.1 ||
                    finalBounds.minY < -0.1 ||
                    finalBounds.maxY > s.h + 0.1
                ) {
                    state.cropSize = maxCropSizeForCurrentRotation();
                    state.cropX = (s.w - state.cropSize) / 2;
                    state.cropY = (s.h - state.cropSize) / 2;
                }
            }

            applyEditToState(savedEdit);
            initialSignature = mainPhotoEditSignature(getCurrentEdit());

            editor.innerHTML = `
            <div class="wfmm-photo-editor-header">
                <div>
                    <div class="wfmm-photo-editor-title">Edit main photo</div>
                </div>
            </div>

            <div class="wfmm-photo-editor-body">
                <div class="wfmm-photo-editor-toolbar">
                    <button type="button" data-tool="crop" class="is-active">Crop / resize</button>
                    <button type="button" data-tool="rotate">Free rotate</button>
                    <button type="button" data-action="rotate90">Rotate 90°</button>
                    <button type="button" data-action="reset">Reset</button>

                    <div class="wfmm-photo-editor-guide-row">
                        <label><input type="checkbox" data-guide="circleGuide"> Circle guide</label>
                        <label><input type="checkbox" data-guide="thirds"> Rule of thirds</label>
                        <label><input type="checkbox" data-guide="safe"> 25% safe zone</label>
                        <label><input type="checkbox" data-guide="center"> Centre</label>
                        <label><input type="checkbox" data-guide="photoDiscPreview"> Photo Disc Preview</label>
                    </div>
                </div>

                <div class="wfmm-photo-editor-canvas-wrap">
                    <canvas id="wfmm-photo-editor-canvas"></canvas>
                </div>
            </div>

            <div class="wfmm-photo-editor-footer">
                <div>
                    <div class="wfmm-photo-editor-output" id="wfmm-photo-editor-output"></div>
                </div>
                <div>
                    <button type="button" data-action="cancel">Cancel</button>
                    <button type="button" class="primary" data-action="save">Save photo</button>
                </div>
            </div>
        `;

            backdrop.appendChild(editor);
            document.body.appendChild(backdrop);

            const canvas = editor.querySelector("#wfmm-photo-editor-canvas");
            const ctx = canvas.getContext("2d", { alpha: false });
            const canvasWrap = editor.querySelector(".wfmm-photo-editor-canvas-wrap");
            const outputInfo = editor.querySelector("#wfmm-photo-editor-output");

            function syncGuideCheckboxes() {
                const guideStates = {
                    circleGuide: state.showCircleGuide,
                    thirds: state.showThirds,
                    safe: state.showSafeZone,
                    center: state.showCenter,
                    photoDiscPreview: state.showPhotoDiscPreview
                };

                for (const [name, checked] of Object.entries(guideStates)) {
                    const input = editor.querySelector(`[data-guide="${name}"]`);
                    if (!input) continue;

                    input.checked = checked;

                    if (name !== "photoDiscPreview") {
                        input.disabled = state.showPhotoDiscPreview;
                    }
                }
            }

            function resizeCanvas() {
                const rect = canvasWrap.getBoundingClientRect();
                const dpr = Math.max(1, Math.min(3, window.devicePixelRatio || 1));

                const cssW = Math.max(1, rect.width);
                const cssH = Math.max(1, rect.height);

                state.dpr = dpr;

                canvas.width = Math.round(cssW * dpr);
                canvas.height = Math.round(cssH * dpr);

                canvas.style.width = cssW + "px";
                canvas.style.height = cssH + "px";

                draw();
            }

            function getDisplayLayout() {
                const cssW = parseFloat(canvas.style.width) || canvasWrap.clientWidth || 600;
                const cssH = parseFloat(canvas.style.height) || canvasWrap.clientHeight || 420;

                const s = orientedSize();
                const pad = Math.max(34, Math.min(86, Math.min(cssW, cssH) * 0.09));

                const scale = Math.min(
                    (cssW - pad * 2) / s.w,
                    (cssH - pad * 2) / s.h
                );

                const imageW = s.w * scale;
                const imageH = s.h * scale;

                return {
                    canvasW: cssW,
                    canvasH: cssH,
                    imageX: (cssW - imageW) / 2,
                    imageY: (cssH - imageH) / 2,
                    imageW,
                    imageH,
                    scale
                };
            }

            function orientedToCanvasX(x) {
                return state.layout.imageX + x * state.layout.scale;
            }

            function orientedToCanvasY(y) {
                return state.layout.imageY + y * state.layout.scale;
            }

            function canvasToOrientedX(x) {
                return (x - state.layout.imageX) / state.layout.scale;
            }

            function canvasToOrientedY(y) {
                return (y - state.layout.imageY) / state.layout.scale;
            }

            function cropRectCanvas() {
                return {
                    x: orientedToCanvasX(state.cropX),
                    y: orientedToCanvasY(state.cropY),
                    size: state.cropSize * state.layout.scale
                };
            }

            function cropCenterCanvas() {
                const r = cropRectCanvas();

                return {
                    x: r.x + r.size / 2,
                    y: r.y + r.size / 2
                };
            }

            function drawImageBehindFixedCrop() {
                const l = state.layout;
                const oriented = getOrientedCanvas();
                const c = cropCenterCanvas();

                ctx.save();
                ctx.translate(c.x, c.y);
                ctx.rotate(degToRad(state.freeRotationDeg));
                ctx.translate(-c.x, -c.y);

                ctx.imageSmoothingEnabled = true;
                ctx.imageSmoothingQuality = "high";

                ctx.drawImage(
                    oriented,
                    l.imageX,
                    l.imageY,
                    l.imageW,
                    l.imageH
                );

                ctx.restore();
            }

            function drawOutsideFade() {
                const r = cropRectCanvas();

                ctx.save();
                ctx.fillStyle = "rgba(255,255,255,0.58)";
                ctx.beginPath();
                ctx.rect(0, 0, state.layout.canvasW, state.layout.canvasH);
                ctx.rect(r.x, r.y, r.size, r.size);
                ctx.fill("evenodd");
                ctx.restore();
            }

            function drawCropBorder() {
                const r = cropRectCanvas();

                ctx.save();

                ctx.strokeStyle = "#2563eb";
                ctx.lineWidth = 2.5;
                ctx.strokeRect(r.x, r.y, r.size, r.size);

                ctx.strokeStyle = "rgba(255,255,255,0.96)";
                ctx.lineWidth = 1;
                ctx.strokeRect(r.x + 2, r.y + 2, r.size - 4, r.size - 4);

                ctx.restore();
            }

            function drawGuidesInsideCrop() {
                if (state.showPhotoDiscPreview) return;

                const r = cropRectCanvas();

                ctx.save();

                ctx.beginPath();
                ctx.rect(r.x, r.y, r.size, r.size);
                ctx.clip();

                if (state.showThirds) {
                    ctx.strokeStyle = "rgba(255,255,255,0.9)";
                    ctx.lineWidth = 1;

                    ctx.beginPath();
                    ctx.moveTo(r.x + r.size / 3, r.y);
                    ctx.lineTo(r.x + r.size / 3, r.y + r.size);
                    ctx.moveTo(r.x + r.size * 2 / 3, r.y);
                    ctx.lineTo(r.x + r.size * 2 / 3, r.y + r.size);
                    ctx.moveTo(r.x, r.y + r.size / 3);
                    ctx.lineTo(r.x + r.size, r.y + r.size / 3);
                    ctx.moveTo(r.x, r.y + r.size * 2 / 3);
                    ctx.lineTo(r.x + r.size, r.y + r.size * 2 / 3);
                    ctx.stroke();
                }

                if (state.showSafeZone) {
                    const p = r.size * 0.25;

                    ctx.strokeStyle = "rgba(245,158,11,0.95)";
                    ctx.lineWidth = 2;
                    ctx.strokeRect(r.x + p, r.y + p, r.size - p * 2, r.size - p * 2);
                }

                if (state.showCenter) {
                    ctx.strokeStyle = "rgba(217,70,239,0.98)";
                    ctx.lineWidth = 2;

                    ctx.beginPath();
                    ctx.moveTo(r.x, r.y);
                    ctx.lineTo(r.x + r.size, r.y + r.size);
                    ctx.moveTo(r.x + r.size, r.y);
                    ctx.lineTo(r.x, r.y + r.size);

                    ctx.moveTo(r.x + r.size / 2, r.y);
                    ctx.lineTo(r.x + r.size / 2, r.y + r.size);
                    ctx.moveTo(r.x, r.y + r.size / 2);
                    ctx.lineTo(r.x + r.size, r.y + r.size / 2);
                    ctx.stroke();
                }

                if (state.showCircleGuide) {
                    ctx.save();

                    ctx.fillStyle = "rgba(0,0,0,0.40)";
                    ctx.beginPath();
                    ctx.rect(r.x, r.y, r.size, r.size);
                    ctx.arc(
                        r.x + r.size / 2,
                        r.y + r.size / 2,
                        r.size / 2,
                        0,
                        Math.PI * 2,
                        true
                    );
                    ctx.fill("evenodd");

                    ctx.strokeStyle = "rgba(255,255,255,0.95)";
                    ctx.lineWidth = 2;
                    ctx.beginPath();
                    ctx.arc(
                        r.x + r.size / 2,
                        r.y + r.size / 2,
                        r.size / 2 - 1,
                        0,
                        Math.PI * 2
                    );
                    ctx.stroke();

                    ctx.restore();
                }

                ctx.restore();
            }

            function drawPhotoDiscPreview() {
                const r = cropRectCanvas();

                const blueWidth = Math.max(6, r.size * 0.026);
                const cropRadius = r.size / 2;
                const blueRadius = cropRadius + blueWidth / 2;

                ctx.save();

                ctx.fillStyle = "#ffffff";
                ctx.beginPath();
                ctx.rect(0, 0, state.layout.canvasW, state.layout.canvasH);
                ctx.arc(
                    r.x + r.size / 2,
                    r.y + r.size / 2,
                    cropRadius,
                    0,
                    Math.PI * 2,
                    true
                );
                ctx.fill("evenodd");

                ctx.strokeStyle = "#1d4ed8";
                ctx.lineWidth = blueWidth;
                ctx.beginPath();
                ctx.arc(
                    r.x + r.size / 2,
                    r.y + r.size / 2,
                    blueRadius,
                    0,
                    Math.PI * 2
                );
                ctx.stroke();

                ctx.restore();
            }

            function drawHandles() {
                const r = cropRectCanvas();
                const handleRadius = state.showPhotoDiscPreview ? 9 : 7;

                const corners = [
                    { name: "tl", x: r.x, y: r.y },
                    { name: "tr", x: r.x + r.size, y: r.y },
                    { name: "br", x: r.x + r.size, y: r.y + r.size },
                    { name: "bl", x: r.x, y: r.y + r.size }
                ];

                ctx.save();

                ctx.fillStyle = "#2563eb";
                ctx.strokeStyle = "#fff";
                ctx.lineWidth = 2;

                for (const p of corners) {
                    ctx.beginPath();
                    ctx.arc(p.x, p.y, handleRadius, 0, Math.PI * 2);
                    ctx.fill();
                    ctx.stroke();
                }

                if (state.tool === "rotate" || state.showPhotoDiscPreview) {
                    const handle = getRotateHandlePoint();
                    const topMid = {
                        x: r.x + r.size / 2,
                        y: r.y
                    };

                    ctx.strokeStyle = "#2563eb";
                    ctx.lineWidth = 2;
                    ctx.beginPath();
                    ctx.moveTo(topMid.x, topMid.y);
                    ctx.lineTo(handle.x, handle.y);
                    ctx.stroke();

                    ctx.fillStyle = "#fff";
                    ctx.strokeStyle = "#2563eb";
                    ctx.lineWidth = 3;
                    ctx.beginPath();
                    ctx.arc(handle.x, handle.y, 12, 0, Math.PI * 2);
                    ctx.fill();
                    ctx.stroke();

                    ctx.fillStyle = "#2563eb";
                    ctx.font = "bold 14px sans-serif";
                    ctx.textAlign = "center";
                    ctx.textBaseline = "middle";
                    ctx.fillText("↻", handle.x, handle.y + 0.5);
                }

                if (state.showPhotoDiscPreview) {
                    ctx.strokeStyle = "rgba(37,99,235,0.85)";
                    ctx.lineWidth = 1.5;
                    ctx.setLineDash([6, 4]);
                    ctx.strokeRect(r.x, r.y, r.size, r.size);
                    ctx.setLineDash([]);
                }

                ctx.restore();
            }

            function draw() {
                state.layout = getDisplayLayout();

                const l = state.layout;

                ctx.save();
                ctx.setTransform(state.dpr, 0, 0, state.dpr, 0, 0);

                ctx.clearRect(0, 0, l.canvasW, l.canvasH);

                ctx.fillStyle = "#eef2f7";
                ctx.fillRect(0, 0, l.canvasW, l.canvasH);

                drawImageBehindFixedCrop();

                if (state.showPhotoDiscPreview) {
                    drawPhotoDiscPreview();
                    drawHandles();
                } else {
                    drawOutsideFade();
                    drawCropBorder();
                    drawGuidesInsideCrop();
                    drawHandles();
                }

                ctx.restore();

                const outSize = Math.floor(state.cropSize);

                outputInfo.textContent =
                    `Original: ${sourceW} × ${sourceH}px. ` +
                    `Output: ${outSize} × ${outSize}px. ` +
                    `Free rotate: ${state.freeRotationDeg.toFixed(1).replace(".0", "")}°.`;
            }

            function getPointerPos(event) {
                const rect = canvas.getBoundingClientRect();

                return {
                    x: event.clientX - rect.left,
                    y: event.clientY - rect.top
                };
            }

            function pointDistance(a, b) {
                return Math.hypot(a.x - b.x, a.y - b.y);
            }

            function hitTestCropCorner(x, y) {
                const r = cropRectCanvas();
                const threshold = state.showPhotoDiscPreview ? 26 : 20;

                const corners = [
                    { name: "tl", x: r.x, y: r.y },
                    { name: "tr", x: r.x + r.size, y: r.y },
                    { name: "br", x: r.x + r.size, y: r.y + r.size },
                    { name: "bl", x: r.x, y: r.y + r.size }
                ];

                return corners.find(p => pointDistance({ x, y }, p) <= threshold)?.name || null;
            }

            function getRotateHandlePoint() {
                const r = cropRectCanvas();

                return {
                    x: r.x + r.size / 2,
                    y: r.y - 36
                };
            }

            function hitTestRotateHandle(x, y) {
                const handle = getRotateHandlePoint();
                return pointDistance({ x, y }, handle) <= 25;
            }

            function hitTestCropBody(x, y) {
                const r = cropRectCanvas();

                return (
                    x >= r.x &&
                    x <= r.x + r.size &&
                    y >= r.y &&
                    y <= r.y + r.size
                );
            }

            function resizeCropFromCorner(cornerName, pointerX, pointerY) {
                const ox = canvasToOrientedX(pointerX);
                const oy = canvasToOrientedY(pointerY);

                const startRight = state.startCropX + state.startCropSize;
                const startBottom = state.startCropY + state.startCropSize;

                let newX = state.startCropX;
                let newY = state.startCropY;
                let newSize = state.startCropSize;

                if (cornerName === "br") {
                    newSize = Math.max(ox - state.startCropX, oy - state.startCropY);
                    newX = state.startCropX;
                    newY = state.startCropY;
                } else if (cornerName === "tl") {
                    newSize = Math.max(startRight - ox, startBottom - oy);
                    newX = startRight - newSize;
                    newY = startBottom - newSize;
                } else if (cornerName === "tr") {
                    newSize = Math.max(ox - state.startCropX, startBottom - oy);
                    newX = state.startCropX;
                    newY = startBottom - newSize;
                } else if (cornerName === "bl") {
                    newSize = Math.max(startRight - ox, oy - state.startCropY);
                    newX = startRight - newSize;
                    newY = state.startCropY;
                }

                state.cropX = newX;
                state.cropY = newY;
                state.cropSize = newSize;

                clampCrop();
            }

            function pointerAngleFromCenter(x, y) {
                const c = cropCenterCanvas();
                return Math.atan2(y - c.y, x - c.x) * 180 / Math.PI;
            }

            canvas.addEventListener("pointerdown", (event) => {
                event.preventDefault();

                const p = getPointerPos(event);

                state.activeDrag = null;
                state.activeHandle = null;

                if ((state.tool === "rotate" || state.showPhotoDiscPreview) && hitTestRotateHandle(p.x, p.y)) {
                    state.activeDrag = "rotate";
                    state.startFreeRotationDeg = state.freeRotationDeg;
                    state.startPointerAngle = pointerAngleFromCenter(p.x, p.y);
                } else {
                    const cropHandle = hitTestCropCorner(p.x, p.y);

                    if (cropHandle) {
                        state.activeDrag = "resize";
                        state.activeHandle = cropHandle;
                    } else if (hitTestCropBody(p.x, p.y)) {
                        state.activeDrag = "move";
                    }
                }

                if (!state.activeDrag) return;

                state.dragStartX = p.x;
                state.dragStartY = p.y;
                state.startCropX = state.cropX;
                state.startCropY = state.cropY;
                state.startCropSize = state.cropSize;

                canvas.classList.add("is-dragging");
                canvas.setPointerCapture(event.pointerId);
            });

            canvas.addEventListener("pointermove", (event) => {
                if (!state.activeDrag) return;

                event.preventDefault();

                const p = getPointerPos(event);

                if (state.activeDrag === "move") {
                    const dx = (p.x - state.dragStartX) / state.layout.scale;
                    const dy = (p.y - state.dragStartY) / state.layout.scale;

                    state.cropX = state.startCropX + dx;
                    state.cropY = state.startCropY + dy;

                    clampCrop();
                } else if (state.activeDrag === "resize") {
                    resizeCropFromCorner(state.activeHandle, p.x, p.y);
                } else if (state.activeDrag === "rotate") {
                    const nowAngle = pointerAngleFromCenter(p.x, p.y);

                    state.freeRotationDeg = normaliseAngleDeg(
                        state.startFreeRotationDeg + (nowAngle - state.startPointerAngle)
                    );

                    clampCrop();
                }

                draw();
            });

            canvas.addEventListener("pointerup", (event) => {
                state.activeDrag = null;
                state.activeHandle = null;
                canvas.classList.remove("is-dragging");

                try {
                    canvas.releasePointerCapture(event.pointerId);
                } catch (e) {}
            });

            canvas.addEventListener("pointercancel", () => {
                state.activeDrag = null;
                state.activeHandle = null;
                canvas.classList.remove("is-dragging");
            });

            async function saveEditSettings() {
                clampCrop();

                const edit = getCurrentEdit();
                const currentSignature = mainPhotoEditSignature(edit);

                const sourceIsSquare = Math.round(sourceW) === Math.round(sourceH);
                const existingEditSignature = originalState._wfmmEdit
                ? mainPhotoEditSignature(originalState._wfmmEdit)
                : "";

                const unchangedFromOpenedState = currentSignature === initialSignature;
                const unchangedFromExistingSavedEdit =
                      existingEditSignature &&
                      currentSignature === existingEditSignature;

                // Only close without saving when:
                // - the source is already square, and
                // - there is no existing saved edit, and
                // - the user made no changes.
                //
                // For non-square images, the default centred square crop is a real edit
                // and must be saved even if the user did not move the crop box.
                if (unchangedFromOpenedState && !originalState._wfmmEdit && sourceIsSquare) {
                    closeEditor();
                    return;
                }

                // If an existing saved edit was opened and nothing changed, just close.
                if (unchangedFromExistingSavedEdit) {
                    closeEditor();
                    return;
                }

                let previewDataUrl = null;

                if (!isDefaultMainPhotoEdit(edit)) {
                    const previewCanvas = renderMainPhotoEditToCanvas(img, edit, 512);
                    previewDataUrl = previewCanvas.toDataURL("image/jpeg", 0.86);
                }

                const updatedState = cloneImageStateWithEdit(originalState, edit, previewDataUrl);

                if (typeof onSave === "function") {
                    onSave(updatedState);
                }

                closeEditor();
            }

            editor.addEventListener("change", (event) => {
                const guide = event.target && event.target.dataset && event.target.dataset.guide;
                if (!guide) return;

                if (guide === "photoDiscPreview") {
                    state.showPhotoDiscPreview = event.target.checked;

                    if (state.showPhotoDiscPreview) {
                        state.showCircleGuide = false;
                        state.showThirds = false;
                        state.showSafeZone = false;
                        state.showCenter = false;
                    } else {
                        const guides = getPhotoEditorGuideSettings();

                        state.showCircleGuide = guides.circleGuide;
                        state.showThirds = guides.ruleOfThirds;
                        state.showSafeZone = guides.safeZone25;
                        state.showCenter = guides.centreGuide;
                    }

                    syncGuideCheckboxes();
                    draw();
                    return;
                }

                if (guide === "circleGuide") state.showCircleGuide = event.target.checked;
                if (guide === "thirds") state.showThirds = event.target.checked;
                if (guide === "safe") state.showSafeZone = event.target.checked;
                if (guide === "center") state.showCenter = event.target.checked;

                savePhotoEditorGuideSettingsFromState(state);
                syncGuideCheckboxes();
                draw();
            });

            editor.addEventListener("click", (event) => {
                const toolBtn = event.target.closest("button[data-tool]");

                if (toolBtn) {
                    state.tool = toolBtn.dataset.tool;

                    editor.querySelectorAll("button[data-tool]").forEach((btn) => {
                        btn.classList.toggle("is-active", btn === toolBtn);
                    });

                    draw();
                    return;
                }

                const btn = event.target.closest("button[data-action]");
                if (!btn) return;

                const action = btn.dataset.action;

                if (action === "close" || action === "cancel") {
                    closeEditor();
                    return;
                }

                if (action === "rotate90") {
                    state.rotationQuarterTurns = (state.rotationQuarterTurns + 1) % 4;
                    state.freeRotationDeg = 0;
                    orientedCache.quarterTurns = null;
                    orientedCache.canvas = null;
                    resetCropToMaxCentered();
                    draw();
                    return;
                }

                if (action === "reset") {
                    state.tool = "crop";
                    state.rotationQuarterTurns = 0;
                    state.freeRotationDeg = 0;
                    orientedCache.quarterTurns = null;
                    orientedCache.canvas = null;
                    resetCropToMaxCentered();

                    state.showCircleGuide = false;
                    state.showPhotoDiscPreview = false;
                    state.showThirds = true;
                    state.showSafeZone = false;
                    state.showCenter = false;

                    editor.querySelectorAll("button[data-tool]").forEach((toolButton) => {
                        toolButton.classList.toggle("is-active", toolButton.dataset.tool === "crop");
                    });

                    syncGuideCheckboxes();
                    draw();
                    return;
                }

                if (action === "save") {
                    saveEditSettings().catch((err) => {
                        console.error("[WFMM Photo Editor] Save failed:", err);
                        alert("Could not save edit settings.");
                    });
                }
            });

            syncGuideCheckboxes();

            resizeCanvasHandler = resizeCanvas;
            window.addEventListener("resize", resizeCanvasHandler);
            requestAnimationFrame(resizeCanvas);
        }
    }

    function attachMainPhotoEditButton(options) {
        const {
            host,
            imageState,
            onEdited
        } = options || {};

        if (!host) return;

        let existing = host.querySelector(".wfmm-photo-edit-btn");

        if (!imageState || imageState._pending) {
            if (existing) existing.remove();
            return;
        }

        if (!existing) {
            existing = document.createElement("button");
            existing.type = "button";
            existing.className = "wfmm-photo-edit-btn";
            host.appendChild(existing);
        }

        existing.textContent = imageState._wfmmEdit ? "Edit photo settings" : "Edit photo";

        existing.onclick = () => {
            openMainPhotoEditor({
                imageState,
                onSave(updatedState) {
                    if (typeof onEdited === "function") {
                        onEdited(updatedState);
                    }
                }
            });
        };
    }

    async function materialiseImageStateForSaveOrSubmit(state) {
        if (!state) return null;

        if (!state._wfmmEdit) {
            return state;
        }

        const editedBlob = await renderMainPhotoEditToBlob(state, state._wfmmEdit, {
            quality: 0.94
        });

        let editedFile;

        try {
            editedFile = new File([editedBlob], "edited-main-photo.jpg", {
                type: editedBlob.type || "image/jpeg",
                lastModified: Date.now()
            });
        } catch (e) {
            editedFile = editedBlob;
        }

        const oldPreviewUrl = state._wfmmEditPreviewDataUrl;
        const oldBlobUrl = state.url && state.url.startsWith("blob:") ? state.url : null;

        const next = {
            sourceType: "file",
            file: editedFile,
            url: URL.createObjectURL(editedBlob),
            gcsPath: null,
            _edited: true,
            _editedAt: Date.now()
        };

        if (oldPreviewUrl) {
            next._wfmmEditPreviewDataUrl = oldPreviewUrl;
        }

        // The edit has now been baked into the file.
        // Do not keep _wfmmEdit, or it will be applied twice later.
        delete next._wfmmEdit;

        if (oldBlobUrl) {
            setTimeout(() => URL.revokeObjectURL(oldBlobUrl), 0);
        }

        return next;
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

    function getJson(url) {
        return new Promise((resolve, reject) => {
            const xhr = new XMLHttpRequest();
            xhr.open("GET", url, true);
            xhr.withCredentials = true;

            xhr.onload = function () {
                if (xhr.status < 200 || xhr.status >= 300) {
                    return reject(new Error("HTTP " + xhr.status + " for " + url));
                }

                try {
                    resolve(JSON.parse(xhr.responseText || "{}"));
                } catch (e) {
                    reject(e);
                }
            };

            xhr.onerror = function () {
                reject(new Error("Network error for " + url));
            };

            xhr.send();
        });
    }

    function getSubmitSupportingSlotName(index) {
        return index === 0 ? "supporting" : "supporting" + index;
    }

    function sortSupportingSlotKeys(keys) {
        return keys
            .filter(k => k === "supporting" || /^supporting\d+$/.test(k))
            .sort((a, b) => {
            if (a === "supporting") return -1;
            if (b === "supporting") return 1;
            const na = parseInt(a.replace("supporting", ""), 10);
            const nb = parseInt(b.replace("supporting", ""), 10);
            return na - nb;
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

        if (!options.skipConfirm && !confirmSubmitWayspot()) {
            return false;
        }

        wfMapmodsIsUploading = true;
        wfmapmodsSetSubmitProgress("Starting nomination…", 5);

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
                return await resolveImageBlobForSubmit(state);
            }

            const totalSupporting = supportingStates.length;

            // ==========================================
            // Build final slot plan
            // ==========================================
            const finalSlots = [];
            const contextToGsImageMap = {};
            const uploadSlots = [];
            const uploadSlotToState = {};

            // Main
            if (mainState.gcsPath) {
                contextToGsImageMap.main = mainState.gcsPath;
            } else {
                uploadSlots.push("main");
                uploadSlotToState.main = mainState;
            }

            // Supporting in final order
            supportingStates.forEach((img, idx) => {
                const slotName = getSubmitSupportingSlotName(idx);
                finalSlots.push(slotName);

                if (img && img.gcsPath) {
                    contextToGsImageMap[slotName] = img.gcsPath;
                } else if (img) {
                    uploadSlots.push(slotName);
                    uploadSlotToState[slotName] = img;
                }
            });

            // Resolve blobs only for slots that actually need upload
            const uploadSlotToBlob = {};
            for (const slotName of uploadSlots) {
                const blob = await resolveBlobFromState(uploadSlotToState[slotName]);

                if (!blob) {
                    wfmapmodsHideSubmitProgress();
                    wfMapmodsIsUploading = false;
                    alert(`Could not load image data for ${slotName}.`);
                    return;
                }

                uploadSlotToBlob[slotName] = blob;
            }

            // ==========================================
            // 1) GET signed upload URLs
            // Always required by native flow, even if 0 images need upload
            // ==========================================
            wfmapmodsSetSubmitProgress("Requesting upload URLs…", 15);

            const uploadUrl =
                  "/api/v1/vault/submit/upload?supportingImageCount=" + encodeURIComponent(totalSupporting);

            console.log("[WFMM - Base] GET upload URL:", uploadUrl);

            const uploadPrepResp = await getJson(uploadUrl);

            console.log("[WFMM - Base] /submit/upload response raw:", uploadPrepResp);

            if (!uploadPrepResp || uploadPrepResp.captcha) {
                wfmapmodsHideSubmitProgress();
                wfMapmodsIsUploading = false;
                alert("Submit/upload failed or requires captcha. Please submit manually.");
                return;
            }

            const imageUrlMap =
                  (uploadPrepResp.result && uploadPrepResp.result.imageUrlMap) || {};

            console.log("[WFMM - Base] imageUrlMap:", imageUrlMap);

            const mainUploadUrl = imageUrlMap.main || null;
            if (!mainUploadUrl) {
                wfmapmodsHideSubmitProgress();
                wfMapmodsIsUploading = false;
                alert("Submit/upload did not return a main image URL.");
                return;
            }

            const supportingKeys = sortSupportingSlotKeys(Object.keys(imageUrlMap));
            const supportingUploadUrlsBySlot = {};

            supportingKeys.forEach((key) => {
                supportingUploadUrlsBySlot[key] = imageUrlMap[key];
            });

            // Validate that any supporting slot needing upload has a URL
            for (const slotName of uploadSlots) {
                if (slotName === "main") continue;

                if (!supportingUploadUrlsBySlot[slotName]) {
                    wfmapmodsHideSubmitProgress();
                    wfMapmodsIsUploading = false;
                    alert(
                        "Error preparing your nomination:\n\n" +
                        `Wayfarer did not return an upload URL for ${slotName}.\n` +
                        "The nomination has NOT been submitted."
                    );
                    return;
                }
            }

            // ==========================================
            // 2) Upload only images that are NOT already in remote draft
            // ==========================================
            let uploadedImages = 0;
            const totalUploadsNeeded = uploadSlots.length;

            function updateUploadProgress() {
                const pct = imageUploadPercent(uploadedImages, totalUploadsNeeded);

                if (totalUploadsNeeded === 0) {
                    wfmapmodsSetSubmitProgress("Using existing draft photos…", 90);
                    return;
                }

                if (uploadedImages === 0) {
                    wfmapmodsSetSubmitProgress(`Uploading photos (0 of ${totalUploadsNeeded})…`, pct);
                } else if (uploadedImages < totalUploadsNeeded) {
                    wfmapmodsSetSubmitProgress(`Uploading photos (${uploadedImages} of ${totalUploadsNeeded})…`, pct);
                } else {
                    wfmapmodsSetSubmitProgress(`Uploading photos (${totalUploadsNeeded} of ${totalUploadsNeeded})…`, pct);
                }
            }

            updateUploadProgress();

            const uploadTasks = [];

            for (const slotName of uploadSlots) {
                const blob = uploadSlotToBlob[slotName];
                const url = slotName === "main"
                ? mainUploadUrl
                : supportingUploadUrlsBySlot[slotName];

                if (!blob || !url) {
                    console.warn(
                        "[WFMM - Base] Missing blob/url for upload slot",
                        slotName,
                        "blob:", !!blob,
                        "url:", url
                    );

                    wfmapmodsHideSubmitProgress();
                    wfMapmodsIsUploading = false;
                    alert(
                        "Error uploading photos:\n\n" +
                        `One of the images (${slotName}) could not be prepared for upload.\n` +
                        "The nomination has NOT been submitted.\n\n" +
                        "No nomination quota should have been consumed."
                    );
                    return;
                }

                console.log(`[WFMM - Base] Starting upload for slot ${slotName} to:`, url);

                uploadTasks.push(
                    putImageToSignedUrlForSubmit(url, blob).then(() => {
                        uploadedImages++;
                        console.log(`[WFMM - Base] Uploaded image for slot ${slotName}`);
                        updateUploadProgress();
                    })
                );
            }

            await Promise.all(uploadTasks);

            // ==========================================
            // 3) Final POST /submit/now
            // ==========================================
            wfmapmodsSetSubmitProgress("Finalising nomination…", 95);

            const nowPayload = {
                title,
                description,
                lat,
                lng,
                supportingStatement,
                supportingImageCount: totalSupporting,
                contextToGsImageMap
            };

            console.log("[WFMM - Base] /submit/now payload:", nowPayload);

            const nowResp = await postJsonWithCsrf("/api/v1/vault/submit/now", nowPayload);

            console.log("[WFMM - Base] /submit/now response raw:", nowResp);

            if (!nowResp || nowResp.captcha) {
                wfmapmodsHideSubmitProgress();
                wfMapmodsIsUploading = false;
                alert("Submit/now failed or requires captcha.");
                return;
            }

            if (nowResp.result !== "DONE") {
                wfmapmodsHideSubmitProgress();
                wfMapmodsIsUploading = false;

                let msg = "Submit/now did not succeed";
                if (nowResp.code || nowResp.result) {
                    msg += ": " + (nowResp.code || nowResp.result);
                }

                if (Array.isArray(nowResp.fieldErrors) && nowResp.fieldErrors.length) {
                    msg += "\n\nField errors:\n" + nowResp.fieldErrors.join("\n");
                }

                alert(msg);
                return;
            }

            // Only delete draft after final submit succeeded
            if (options.draftIdToDelete) {
                try {
                    await deleteDraftSubmissionFromIDB(options.draftIdToDelete);
                } catch (e) {
                    console.warn("[WFMM - Base] Local draft deletion failed:", e);
                }
            }

            if (options.remoteDraftIdToDelete) {
                try {
                    // After successful nomination submit: delete the draft record,
                    // but keep the already-uploaded images.
                    await deleteRemoteDraftSubmission(options.remoteDraftIdToDelete, false);
                } catch (e) {
                    console.warn("[WFMM - Base] Remote draft deletion failed:", e);
                }
            }

            wfmapmodsSetSubmitProgress("Nomination submitted!", 100);
            console.log("[WFMM - Base] DONE");

            wfMapmodsIsUploading = false;
            wfmapmodsHideSubmitProgress(1500);
            return true;
        } catch (err) {
            console.error("Wayfarer Map: submitWayspotViaApi failed:", err);
            wfmapmodsHideSubmitProgress();
            wfMapmodsIsUploading = false;
            alert(
                "Error while submitting nomination.\n\n" +
                "If this failed before the final /submit/now step, no nomination quota should have been consumed.\n" +
                "See console for details."
            );
            return false;
        } finally {
            updateAvailability({ force: true }).catch(() => {});
        }
    }

    function confirmSubmitWayspot() {
        return window.confirm(
            "This will submit a new nomination with the provided details.\n\n" +
            "This will consume one of your available nominations only when the final submit step succeeds.\n\n" +
            "Do you want to continue?"
        );
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
                okBtn.textContent = "Submit";

                const submitBody = document.createElement("div");
                submitBody.className = "wfmapmods-submit-modal-body";

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
                    imageState.main = Object.assign({}, originalImages.main);
                } else if (originalImages.mainUrl) {
                    imageState.main = {
                        sourceType: "url",
                        url: originalImages.mainUrl,
                        file: null
                    };
                }

                if (Array.isArray(originalImages.supporting)) {
                    imageState.supporting = originalImages.supporting.map(img => Object.assign({}, img));
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
                    onPick = null,    // for placeholder + optional ready click
                    onRemove = null,  // for pending/ready remove
                    onEdit = null     // main photo editor button
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

                    if (onRemove) {
                        const removeBtn = document.createElement("button");
                        removeBtn.type = "button";
                        removeBtn.className = "wfmapmods-submit-remove";
                        removeBtn.textContent = "×";
                        removeBtn.addEventListener("click", (ev) => {
                            ev.preventDefault();
                            ev.stopPropagation();
                            onRemove();
                        });
                        wrap.appendChild(removeBtn);
                    }

                    if (state === "ready" && onEdit) {
                        const editBtn = document.createElement("button");
                        editBtn.type = "button";
                        editBtn.className = "wfmapmods-submit-edit-photo";
                        editBtn.textContent = "Edit photo";
                        editBtn.addEventListener("click", (ev) => {
                            ev.preventDefault();
                            ev.stopPropagation();
                            onEdit();
                        });

                        block.appendChild(editBtn);
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
                            onRemove: () => {
                                imageState.main = null;
                                renderImages();
                                validate();
                            }
                        }));
                    } else {
                        imagesRow.appendChild(createPhotoBlock({
                            labelText: "Main photo",
                            state: "ready",
                            url: getImageDisplayUrl(imageState.main),
                            onPick: () => mainFileInput.click(),
                            onRemove: () => {
                                const oldUrl = imageState.main && imageState.main.url;

                                imageState.main = null;

                                if (oldUrl && oldUrl.startsWith("blob:")) {
                                    setTimeout(() => URL.revokeObjectURL(oldUrl), 0);
                                }

                                renderImages();
                                validate();
                            },
                            onEdit: () => {
                                if (!canEditImageState(imageState.main)) {
                                    alert("This image cannot be edited because it does not include a usable image URL.");
                                    return;
                                }

                                if (typeof openMainPhotoEditor !== "function") {
                                    alert("Photo editor is not available.");
                                    return;
                                }

                                openMainPhotoEditor({
                                    imageState: imageState.main,
                                    onSave(editedState) {
                                        const oldUrl = imageState.main && imageState.main.url;

                                        imageState.main = editedState;

                                        if (
                                            oldUrl &&
                                            oldUrl.startsWith("blob:") &&
                                            editedState &&
                                            editedState.url !== oldUrl
                                        ) {
                                            setTimeout(() => URL.revokeObjectURL(oldUrl), 0);
                                        }

                                        renderImages();
                                        validate();
                                    }
                                });
                            }
                        }));
                    }

                    // Supporting
                    imageState.supporting.forEach((imgObj, idx) => {
                        imagesRow.appendChild(createPhotoBlock({
                            labelText: "Supporting " + (idx + 1),
                            state: imgObj._pending ? "pending" : "ready",
                            url: imgObj.url,
                            onRemove: () => {
                                imageState.supporting.splice(idx, 1);
                                renderImages();
                                validate();
                            }
                        }));
                    });

                    if (imageState.supporting.length < 5) {
                        imagesRow.appendChild(createPhotoBlock({
                            labelText: "Supporting",
                            state: "placeholder",
                            onPick: () => supportingFileInput.click()
                        }));
                    }

                    refreshMainPhotoAspectWarning();
                }

                // File input handlers
                mainFileInput.addEventListener("change", (ev) => {
                    const file = ev.target.files && ev.target.files[0];
                    if (!file) return;

                    imageState.main = {
                        sourceType: "file",
                        url: null,
                        file: null,
                        _pending: true
                    };

                    renderImages();
                    validate();

                    convertFileToJpeg(file).then(({ blob, dataUrl }) => {
                        if (!imageState.main) return;

                        imageState.main.url = dataUrl;
                        imageState.main.file = blob;
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

                        const imgObj = {
                            sourceType: "file",
                            url: null,
                            file: null,
                            _pending: true
                        };

                        const idx = imageState.supporting.length;
                        imageState.supporting.push(imgObj);

                        renderImages();
                        validate();

                        convertFileToJpeg(file).then(({ blob, dataUrl }) => {
                            const target = imageState.supporting[idx];
                            if (!target) return;

                            target.url = dataUrl;
                            target.file = blob;
                            target._pending = false;

                            renderImages();
                            validate();
                        }).catch((err) => {
                            console.error("Supporting image conversion failed:", err);
                            alert("Could not load one of the images: " + err.message);

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

                function setMainPhotoAspectWarning(message) {
                    let warning = wrapper.querySelector(".wfmapmods-main-photo-aspect-warning");

                    if (!warning) {
                        warning = document.createElement("div");
                        warning.className = "wfmapmods-main-photo-aspect-warning";
                        imagesRow.insertAdjacentElement("afterend", warning);
                    }

                    warning.textContent = message || "";
                    warning.classList.toggle("is-visible", !!message);
                }

                function checkImageAspectRatio(state, callback) {
                    const url = getImageDisplayUrl(state);

                    if (!url || state._pending) {
                        callback(null);
                        return;
                    }

                    const img = new Image();

                    img.onload = () => {
                        const w = img.naturalWidth || img.width;
                        const h = img.naturalHeight || img.height;

                        if (!w || !h) {
                            callback(null);
                            return;
                        }

                        callback(Math.abs(w - h) <= 1);
                    };

                    img.onerror = () => callback(null);
                    img.src = url;
                }

                function refreshMainPhotoAspectWarning() {
                    if (userSettings.map.recommendSquareSubmitPhotos === false) {
                        setMainPhotoAspectWarning("");
                        return;
                    }

                    const main = imageState.main;

                    if (!main || main._pending) {
                        setMainPhotoAspectWarning("");
                        return;
                    }

                    if (main._wfmmEdit) {
                        setMainPhotoAspectWarning("");
                        return;
                    }

                    checkImageAspectRatio(main, (isSquare) => {
                        if (imageState.main !== main) return;

                        if (isSquare === false) {
                            setMainPhotoAspectWarning("⚠️ Main photo is not 1:1 aspect ratio. Editing is recommended.");
                        } else {
                            setMainPhotoAspectWarning("");
                        }
                    });
                }

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

                changeBtn.addEventListener("click", () => {
                    const backdrop = document.getElementById("wfmapmods-submission-edit");
                    if (!backdrop) return;

                    const startLat = (typeof submitData.poi.lat === "number" ? submitData.poi.lat : window.currentLat);
                    const startLng = (typeof submitData.poi.lng === "number" ? submitData.poi.lng : window.currentLng);

                    backdrop.style.display = "none";

                    if (currentMapMode === MAP_MODE.MOBILE) {
                        startMobileLocationChange(backdrop, submitData, locationValue, validate);
                    } else {
                        startDesktopLocationChange(backdrop, submitData, locationValue, validate, startLat, startLng);
                    }
                });

                locationRight.appendChild(locationValue);
                locationRight.appendChild(changeBtn);

                locationRow.appendChild(locationLabel);
                locationRow.appendChild(locationRight);

                wrapper.appendChild(locationRow);

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

                    el.addEventListener("keydown", (event) => {
                        if (event.key !== "Enter") return;

                        event.preventDefault();
                        event.stopPropagation();

                        el.blur();
                    });

                    container.append(label, el, counter);
                    wrapper.appendChild(container);
                    return el;
                }

                const titleInput = addLabeledField({
                    labelText: "Title",
                    value: poi.title,
                    maxLen: 128,
                    onChange: validate
                });

                const descInput = addLabeledField({
                    labelText: "Description",
                    value: poi.description,
                    maxLen: 512,
                    rows: 2,
                    onChange: validate
                });

                const suppInput = addLabeledField({
                    labelText: "Supporting statement",
                    value: poi.supportingStatement,
                    maxLen: 3000,
                    rows: 2,
                    onChange: validate
                });

                submitBody.appendChild(wrapper);
                body.appendChild(submitBody);

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
                submitBody.appendChild(quotaInfo);

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

                    const mainReady = !!imageState.main && !imageState.main._pending;
                    const supportingCount = imageState.supporting.length;
                    const hasPendingSupporting = imageState.supporting.some(img => img && img._pending);

                    const imageValid =
                          mainReady &&
                          supportingCount >= 1 &&
                          supportingCount <= 5 &&
                          !hasPendingSupporting;

                    const nominationsRemaining = getNominationsAvailableToday();
                    const quotaValid = nominationsRemaining > 0;

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
                        markerLat = currentLat;
                        markerLng = currentLng;
                    }

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
                            showWarning(`Submission disabled: The submission pin is ${distanceKm.toFixed(1)} km from your current location (max ${(submitRadius / 1000).toFixed(1)} km).`);
                        } else if (!quotaValid) {
                            showWarning("Submission disabled: You have 0 nominations available today. You can still save a draft.");
                        } else {
                            showWarning("");
                        }
                    } else if (!quotaValid) {
                        showWarning("Submission disabled: You have 0 nominations available today. You can still save a draft.");
                    }

                    const valid = textValid && imageValid && distanceValid && quotaValid;
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
                            try {
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

                                const mode = getDraftSaveLocationMode(submitData);
                                const now = Date.now();

                                if (imageState.main && imageState.main._wfmmEdit) {
                                    imageState.main = await materialiseImageStateForSaveOrSubmit(imageState.main);
                                    renderImages();
                                    validate();
                                }

                                collapseSidePanelIfOpen();
                                closeModal();

                                if (mode === "remote") {
                                    const remoteDraft = await saveDraftSubmissionToWayfarer({
                                        id: submitData.remoteDraftId || null,
                                        remoteDraftId: submitData.remoteDraftId || null,
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
                                    });

                                    submitData.remoteDraftId = remoteDraft.id;
                                    return;
                                }

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

                            } catch (err) {
                                console.error("[WFMM - Draft Save] Failed:", err);
                                alert(err?.message || "Could not save draft. See console for details.");
                            }
                        });
                    }

                    // Delete draft button (only if opened from a draft)
                    const canDeleteLocalDraft = submitData.fromDraft && submitData.draftId;
                    const canDeleteRemoteDraft = submitData.fromRemoteDraft && submitData.remoteDraftId;

                    if ((canDeleteLocalDraft || canDeleteRemoteDraft) && !footer.querySelector(".wfmapmods-btn-delete-draft")) {
                        const deleteBtn = document.createElement("button");
                        deleteBtn.type = "button";
                        deleteBtn.textContent = "Delete draft";
                        deleteBtn.className = "wfmapmods-modal-btn wfmapmods-btn-delete-draft";

                        const firstButton = footer.firstChild;
                        footer.insertBefore(deleteBtn, firstButton || null);

                        deleteBtn.addEventListener("click", async () => {
                            const confirmed = window.confirm("Delete this draft submission?");
                            if (!confirmed) return;

                            try {
                                if (canDeleteRemoteDraft) {
                                    await deleteRemoteDraftSubmission(submitData.remoteDraftId, true);
                                } else if (canDeleteLocalDraft) {
                                    await deleteDraftSubmissionFromIDB(submitData.draftId);
                                }

                                closeModal();
                            } catch (err) {
                                console.error("[WFMM - Draft Delete] Failed:", err);
                                alert(err?.message || "Could not delete draft. See console for details.");
                            }
                        });
                    }
                }, 0);

                return {
                    submitData,
                    titleInput,
                    descInput,
                    suppInput,
                    imageState
                };
            },
            async onOk(ctx, closeModal) {
                const title = ctx.titleInput.value.trim();
                const description = ctx.descInput.value.trim();
                const supportingStatement = ctx.suppInput.value.trim();

                if (!title || !description) {
                    return;
                }

                if (getNominationsAvailableToday() <= 0) {
                    alert("You have 0 nominations available today. You can still save this as a draft.");
                    return;
                }

                const hasMain = !!ctx.imageState.main && !ctx.imageState.main._pending;
                const supportingCount = ctx.imageState.supporting.length;
                const hasPendingSupporting = ctx.imageState.supporting.some(img => img && img._pending);

                if (!hasMain || supportingCount < 1 || supportingCount > 5 || hasPendingSupporting) {
                    return;
                }

                if (!confirmSubmitWayspot()) {
                    return;
                }

                if (ctx.imageState.main && ctx.imageState.main._wfmmEdit) {
                    ctx.imageState.main = await materialiseImageStateForSaveOrSubmit(ctx.imageState.main);
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

                collapseSidePanelIfOpen();

                submitWayspotViaApi(merged, {
                    draftIdToDelete: merged.draftId || null,
                    remoteDraftIdToDelete: merged.remoteDraftId || null,
                    skipConfirm: true
                });

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



    // ==================================
    // Remote draft helpers (Wayfarer)
    // ==================================

    function getDraftSaveLocationMode(submitData) {
        // If editing a remote draft, always keep it remote
        if (submitData && (submitData.fromRemoteDraft || submitData.remoteDraftId)) {
            return "remote";
        }

        const mode = userSettings?.map?.defaultDraftSaveLocation;
        return mode === "local" ? "local" : "remote";
    }

    function getRemoteDraftUserLatLng() {
        if (
            !submitterLocation ||
            typeof submitterLocation.lat !== "number" || !Number.isFinite(submitterLocation.lat) ||
            typeof submitterLocation.lng !== "number" || !Number.isFinite(submitterLocation.lng)
        ) {
            throw new Error("Cannot save remote draft: submitter location is not available.");
        }

        return {
            userLat: submitterLocation.lat,
            userLng: submitterLocation.lng
        };
    }

    function cloneRemoteImageState(img) {
        if (!img) return null;
        return {
            sourceType: img.sourceType || "remote",
            url: img.url || img.servingUrl || null,
            file: null,
            gcsPath: img.gcsPath || null,
            servingUrl: img.servingUrl || img.url || null
        };
    }

    function normalizeRemoteDraftFromApi(apiDraft) {
        if (!apiDraft) return null;

        const mainHasImage = !!(apiDraft.mainImageGcsPath || apiDraft.mainImageServingUrl);

        const mainImage = mainHasImage ? {
            sourceType: "remote",
            url: apiDraft.mainImageServingUrl || null,
            file: null,
            gcsPath: apiDraft.mainImageGcsPath || null,
            servingUrl: apiDraft.mainImageServingUrl || null
        } : null;

        const supportingGcs = Array.isArray(apiDraft.supportingImageGcsPaths)
        ? apiDraft.supportingImageGcsPaths
        : [];

        const supportingServing = Array.isArray(apiDraft.supportingImageServingUrls)
        ? apiDraft.supportingImageServingUrls
        : [];

        const supporting = [];
        const maxLen = Math.max(supportingGcs.length, supportingServing.length);

        for (let i = 0; i < maxLen; i++) {
            const gcsPath = supportingGcs[i] || null;
            const servingUrl = supportingServing[i] || null;

            if (!gcsPath && !servingUrl) continue;

            supporting.push({
                sourceType: "remote",
                url: servingUrl || null,
                file: null,
                gcsPath: gcsPath || null,
                servingUrl: servingUrl || null
            });
        }

        return {
            id: apiDraft.id,
            remoteDraftId: apiDraft.id,
            lastModified: apiDraft.lastModified || Date.now(),
            poi: {
                lat: apiDraft.lat,
                lng: apiDraft.lng,
                title: apiDraft.title || "",
                description: apiDraft.description || "",
                supportingStatement: apiDraft.supportingStatement || ""
            },
            images: {
                main: mainImage,
                supporting
            }
        };
    }

    function upsertRemoteDraftSubmission(remoteDraft) {
        if (!remoteDraft || !remoteDraft.id) return;

        const idx = remoteDraftSubmissions.findIndex(d => d.id === remoteDraft.id);
        if (idx >= 0) {
            remoteDraftSubmissions[idx] = remoteDraft;
        } else {
            remoteDraftSubmissions.push(remoteDraft);
        }
    }

    function removeRemoteDraftSubmissionById(id) {
        remoteDraftSubmissions = remoteDraftSubmissions.filter(d => d.id !== id);
    }

    function getRemoteSupportingSlotName(index) {
        return index === 0 ? "supporting" : "supporting" + index;
    }

    async function resolveBlobFromDraftImageState(state) {
        if (!state) return null;

        if (state.sourceType === "file" && state.file instanceof Blob) {
            return state.file;
        }

        if (state.url) {
            return await fetchImageBlobForSubmit(state.url);
        }

        return null;
    }

    async function createRemoteDraftShell() {
        const resp = await postJsonWithCsrf("/api/v1/vault/submit/draft/create", {});
        if (!resp || resp.captcha) {
            throw new Error("Remote draft create failed or requires captcha.");
        }

        const draftId = resp?.result?.submissionId || null;
        if (!draftId) {
            throw new Error("Remote draft create did not return submissionId.");
        }

        return draftId;
    }

    async function requestRemoteDraftUploadUrls(draftId, slotNames) {
        if (!draftId) throw new Error("Missing draftId for remote draft upload.");
        if (!Array.isArray(slotNames) || !slotNames.length) return {};

        const url = "/api/v1/vault/submit/draft/upload?draftId=" + encodeURIComponent(draftId);
        const resp = await postJsonWithCsrf(url, slotNames);

        if (!resp || resp.captcha) {
            throw new Error("Remote draft upload URL request failed or requires captcha.");
        }

        const imageUrlMap = resp?.result?.imageUrlMap || {};
        return imageUrlMap;
    }

    async function postRemoteDraftPayload(payload, userLat, userLng) {
        if (typeof userLat !== "number" || !Number.isFinite(userLat) ||
            typeof userLng !== "number" || !Number.isFinite(userLng)) {
            throw new Error("Missing valid userLat/userLng for remote draft save.");
        }

        const url =
              "/api/v1/vault/submit/draft?userLat=" + encodeURIComponent(userLat) +
              "&userLng=" + encodeURIComponent(userLng);

        const resp = await postJsonWithCsrf(url, payload);

        if (!resp || resp.captcha) {
            throw new Error("Remote draft save failed or requires captcha.");
        }

        const savedApiDraft = resp?.result?.poiSubmissionDraft || null;
        if (!savedApiDraft) {
            throw new Error("Remote draft save did not return poiSubmissionDraft.");
        }

        return savedApiDraft;
    }

    async function deleteRemoteDraftSubmission(remoteDraftId, deleteImages) {
        if (!remoteDraftId) return;

        const url =
              "/api/v1/vault/submit/draft/delete?draftId=" + encodeURIComponent(remoteDraftId) +
              "&deleteImages=" + encodeURIComponent(deleteImages ? "true" : "false");

        const resp = await postJsonWithCsrf(url, {});

        if (!resp || resp.captcha) {
            throw new Error("Remote draft delete failed or requires captcha.");
        }

        if (resp.result !== "DONE") {
            throw new Error("Remote draft delete did not return DONE.");
        }

        removeRemoteDraftSubmissionById(remoteDraftId);
        refreshRemoteDraftMarkers();
    }

    async function loadRemoteDraftSubmissionsFromWayfarer() {
        try {
            const all = [];
            let cursor = null;
            let safety = 0;

            do {
                let url = "/api/v1/vault/submit/get/drafts";
                if (cursor) {
                    url += "?cursor=" + encodeURIComponent(cursor);
                }

                const resp = await getJson(url);
                if (!resp || resp.captcha) {
                    throw new Error("Remote draft list failed or requires captcha.");
                }

                const resultObj = resp?.result || {};
                const items = Array.isArray(resultObj.result) ? resultObj.result : [];

                items.forEach(item => {
                    const norm = normalizeRemoteDraftFromApi(item);
                    if (norm) all.push(norm);
                });

                const nextCursor = resultObj.cursor || null;
                if (!nextCursor || nextCursor === cursor) {
                    cursor = null;
                } else {
                    cursor = nextCursor;
                }

                safety++;
                if (safety > 50) {
                    console.warn("[WFMM - Remote Drafts] Pagination safety stop triggered.");
                    break;
                }
            } while (cursor);

            remoteDraftSubmissions = all;
            refreshRemoteDraftMarkers();
        } catch (err) {
            console.warn("[WFMM - Remote Drafts] Failed to load remote drafts:", err);
        }
    }

    async function saveDraftSubmissionToWayfarer(draftInput, options = {}) {
        const showProgress = options.showProgress !== false;
        const poi = draftInput?.poi || {};
        const images = draftInput?.images || {};
        const mainState = images.main || null;
        const supportingStates = Array.isArray(images.supporting) ? images.supporting : [];

        const lat = poi.lat;
        const lng = poi.lng;
        const title = (poi.title || "").trim();
        const description = (poi.description || "").trim();
        const supportingStatement = (poi.supportingStatement || "").trim();

        if (
            typeof lat !== "number" || !Number.isFinite(lat) ||
            typeof lng !== "number" || !Number.isFinite(lng)
        ) {
            throw new Error("Cannot save remote draft: missing valid location.");
        }

        const hasMain = !!mainState && !mainState._pending;
        const hasTitle = !!title;

        if (!hasMain && !hasTitle) {
            throw new Error("Cannot save remote draft: a title or a main photo is required.");
        }

        if (mainState && mainState._pending) {
            throw new Error("Cannot save remote draft while main photo is still processing.");
        }

        if (supportingStates.some(img => img && img._pending)) {
            throw new Error("Cannot save remote draft while supporting photos are still processing.");
        }

        const { userLat, userLng } = getRemoteDraftUserLatLng();

        let draftId = draftInput.remoteDraftId || draftInput.id || null;
        const isNewRemoteDraft = !draftId;

        function imageUploadPercent(done, total) {
            const start = 30;
            const end = 90;
            if (total <= 0) return start;
            const frac = done / total;
            return start + Math.floor(frac * (end - start));
        }

        try {
            if (showProgress) {
                wfmapmodsSetSubmitProgress(
                    isNewRemoteDraft ? "Creating draft…" : "Saving draft…",
                    5
                );
            }

            if (!draftId) {
                draftId = await createRemoteDraftShell();
            }

            // Figure out which images need upload
            const uploadPlan = [];
            const uploadSlotToState = {};

            if (mainState && !mainState.gcsPath) {
                uploadPlan.push("main");
                uploadSlotToState.main = mainState;
            }

            supportingStates.forEach((img, idx) => {
                if (!img) return;
                if (!img.gcsPath) {
                    const slotName = getRemoteSupportingSlotName(idx);
                    uploadPlan.push(slotName);
                    uploadSlotToState[slotName] = img;
                }
            });

            const uploadedSlotMeta = {};

            if (uploadPlan.length) {
                if (showProgress) {
                    wfmapmodsSetSubmitProgress("Requesting draft upload URLs…", 20);
                }

                const imageUrlMap = await requestRemoteDraftUploadUrls(draftId, uploadPlan);

                let uploadedImages = 0;
                const totalImages = uploadPlan.length;

                function updateUploadProgress() {
                    if (!showProgress) return;

                    const pct = imageUploadPercent(uploadedImages, totalImages);
                    if (uploadedImages === 0) {
                        wfmapmodsSetSubmitProgress(`Uploading draft photos (0 of ${totalImages})…`, pct);
                    } else if (uploadedImages < totalImages) {
                        wfmapmodsSetSubmitProgress(`Uploading draft photos (${uploadedImages} of ${totalImages})…`, pct);
                    } else {
                        wfmapmodsSetSubmitProgress(`Uploading draft photos (${totalImages} of ${totalImages})…`, pct);
                    }
                }

                updateUploadProgress();

                for (const slotName of uploadPlan) {
                    const slotInfo = imageUrlMap[slotName];
                    if (!slotInfo || !slotInfo.uploadUrl || !slotInfo.gcsPath) {
                        throw new Error("Missing uploadUrl/gcsPath for remote draft slot: " + slotName);
                    }

                    const blob = await resolveBlobFromDraftImageState(uploadSlotToState[slotName]);
                    if (!blob) {
                        throw new Error("Could not resolve image blob for remote draft slot: " + slotName);
                    }

                    await putImageToSignedUrlForSubmit(slotInfo.uploadUrl, blob);

                    uploadedSlotMeta[slotName] = {
                        gcsPath: slotInfo.gcsPath
                    };

                    uploadedImages++;
                    updateUploadProgress();
                }
            }

            if (showProgress) {
                wfmapmodsSetSubmitProgress("Finalising draft…", 95);
            }

            // Build final payload
            const payload = {
                id: draftId,
                lat,
                lng,
                title,
                description,
                supportingStatement
            };

            if (mainState) {
                if (uploadedSlotMeta.main?.gcsPath) {
                    payload.mainImageGcsPath = uploadedSlotMeta.main.gcsPath;
                } else if (mainState.gcsPath) {
                    payload.mainImageGcsPath = mainState.gcsPath;

                    if (mainState.servingUrl) {
                        payload.mainImageServingUrl = mainState.servingUrl;
                    }
                }
            }

            const supportingImageGcsPaths = [];
            const supportingImageServingUrls = [];

            supportingStates.forEach((img, idx) => {
                if (!img) return;

                const slotName = getRemoteSupportingSlotName(idx);

                if (uploadedSlotMeta[slotName]?.gcsPath) {
                    supportingImageGcsPaths.push(uploadedSlotMeta[slotName].gcsPath);
                } else if (img.gcsPath) {
                    supportingImageGcsPaths.push(img.gcsPath);

                    if (img.servingUrl) {
                        supportingImageServingUrls.push(img.servingUrl);
                    }
                }
            });

            if (supportingImageGcsPaths.length) {
                payload.supportingImageGcsPaths = supportingImageGcsPaths;
            }

            if (supportingImageServingUrls.length) {
                payload.supportingImageServingUrls = supportingImageServingUrls;
            }

            const savedApiDraft = await postRemoteDraftPayload(payload, userLat, userLng);
            const normalized = normalizeRemoteDraftFromApi(savedApiDraft);

            upsertRemoteDraftSubmission(normalized);
            refreshRemoteDraftMarkers();

            if (showProgress) {
                wfmapmodsSetSubmitProgress("Draft saved!", 100);
                wfmapmodsHideSubmitProgress(1200);
            }

            return normalized;

        } catch (err) {
            if (showProgress) {
                wfmapmodsHideSubmitProgress();
            }
            throw err;
        }
    }

    async function migrateLocalDraftsToRemoteQueue(onProgress) {
        const localMetas = Array.isArray(draftSubmissions) ? draftSubmissions.slice() : [];

        let successCount = 0;
        let failCount = 0;
        const failures = [];

        for (let i = 0; i < localMetas.length; i++) {
            const meta = localMetas[i];
            const index = i + 1;

            try {
                if (typeof onProgress === "function") {
                    onProgress({
                        phase: "starting",
                        index,
                        total: localMetas.length,
                        draftId: meta.id,
                        successCount,
                        failCount
                    });
                }

                const fullDraft = await loadDraftByIdFromIDB(meta.id);
                if (!fullDraft) {
                    throw new Error("Could not load local draft from IndexedDB.");
                }

                const poi = fullDraft.poi || {};
                const images = fullDraft.images || {};

                await saveDraftSubmissionToWayfarer({
                    poi: {
                        lat: poi.lat,
                        lng: poi.lng,
                        title: poi.title || "",
                        description: poi.description || "",
                        supportingStatement: poi.supportingStatement || ""
                    },
                    images: {
                        main: images.main || null,
                        supporting: Array.isArray(images.supporting) ? images.supporting.slice() : []
                    }
                }, {
                    showProgress: false
                });

                await deleteDraftSubmissionFromIDB(meta.id);

                successCount++;

                if (typeof onProgress === "function") {
                    onProgress({
                        phase: "success",
                        index,
                        total: localMetas.length,
                        draftId: meta.id,
                        successCount,
                        failCount
                    });
                }
            } catch (err) {
                console.warn("[WFMM - Draft Migration] Failed migrating local draft:", meta?.id, err);

                failCount++;
                failures.push({
                    id: meta?.id || null,
                    error: err?.message || String(err)
                });

                if (typeof onProgress === "function") {
                    onProgress({
                        phase: "error",
                        index,
                        total: localMetas.length,
                        draftId: meta?.id || null,
                        successCount,
                        failCount,
                        error: err
                    });
                }
            }
        }

        return {
            total: localMetas.length,
            successCount,
            failCount,
            failures
        };
    }

    function refreshRemoteDraftMarkers() {
        if (!wfMap || typeof google === "undefined" || !google.maps) return;

        remoteDraftMarkers.forEach(m => {
            if (m && typeof m.setMap === "function") {
                m.setMap(null);
            }
        });
        remoteDraftMarkers = [];

        clearDraftMarkerLabelOverlays(remoteDraftMarkerLabelOverlays);
        remoteDraftMarkerLabelOverlays = [];

        remoteDraftSubmissions.forEach(draft => {
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
                title: poi.title || "Remote draft nomination",
                optimized: false
                // icon: "..." // optional: use a different icon/color for remote drafts
            });

            marker.setVisible(isDraftLayerEnabled());

            marker.addListener("click", () => {
                flyToLatLngAndPlaceSubmission(position);

                openSubmissionEditModal({
                    poi: {
                        lat,
                        lng,
                        title: poi.title || "",
                        description: poi.description || "",
                        supportingStatement: poi.supportingStatement || ""
                    },
                    images: {
                        main: cloneRemoteImageState(draft.images?.main),
                        supporting: (draft.images?.supporting || []).map(cloneRemoteImageState)
                    },
                    remoteDraftId: draft.id,
                    fromRemoteDraft: true,
                    lastModified: draft.lastModified
                });
            });

            remoteDraftMarkers.push(marker);

            const labelOverlay = createDraftMarkerLabelOverlay(marker, poi.title);
            if (labelOverlay) {
                remoteDraftMarkerLabelOverlays.push(labelOverlay);
            }
        });
    }

    // -----------------------------
    // Draft marker title labels
    // -----------------------------

    function isDraftMarkerTitlesEnabled() {
        const mapCfg = (userSettings && userSettings.map) || {};
        return mapCfg.showDraftMarkerTitles === true;
    }

    function ensureDraftMarkerLabelOverlayClass() {
        if (DraftMarkerLabelOverlay) return;

        DraftMarkerLabelOverlay = function (marker, text) {
            this.marker = marker;
            this.text = text || "";
            this.div = null;
            this.visible = true;
            this.setMap(wfMap);
        };

        DraftMarkerLabelOverlay.prototype = new google.maps.OverlayView();

        DraftMarkerLabelOverlay.prototype.onAdd = function () {
            const panes = this.getPanes();
            const pane = panes && panes.overlayImage;
            if (!pane) return;

            const div = document.createElement("div");
            div.className = "wfmapmods-draft-marker-label";
            div.textContent = this.text || "";
            div.style.display = this.visible ? "" : "none";

            pane.appendChild(div);
            this.div = div;
        };

        DraftMarkerLabelOverlay.prototype.draw = function () {
            if (!this.div || !this.marker) return;

            const projection = this.getProjection();
            if (!projection) return;

            const markerPosition = this.marker.getPosition?.();
            if (!markerPosition) return;

            const pos = projection.fromLatLngToDivPixel(markerPosition);
            if (!pos) return;

            this.div.style.left = pos.x + "px";
            this.div.style.top = (pos.y + 4) + "px";
        };

        DraftMarkerLabelOverlay.prototype.onRemove = function () {
            if (this.div && this.div.parentNode) {
                this.div.parentNode.removeChild(this.div);
            }
            this.div = null;
        };

        DraftMarkerLabelOverlay.prototype.setText = function (text) {
            this.text = text || "";
            if (this.div) {
                this.div.textContent = this.text;
            }
        };

        DraftMarkerLabelOverlay.prototype.setVisible = function (visible) {
            this.visible = visible !== false;
            if (this.div) {
                this.div.style.display = this.visible ? "" : "none";
            }
        };
    }

    function createDraftMarkerLabelOverlay(marker, titleText) {
        const text = String(titleText || "").trim();
        if (!marker || !text) return null;
        if (!wfMap || typeof google === "undefined" || !google.maps) return null;

        ensureDraftMarkerLabelOverlayClass();

        const overlay = new DraftMarkerLabelOverlay(marker, text);
        overlay.setVisible(isDraftLayerEnabled() && isDraftMarkerTitlesEnabled());

        return overlay;
    }

    function clearDraftMarkerLabelOverlays(overlays) {
        if (!Array.isArray(overlays)) return;

        overlays.forEach(overlay => {
            if (overlay && typeof overlay.setMap === "function") {
                overlay.setMap(null);
            }
        });
    }

    function applyDraftMarkerTitleVisibilityToAllOverlays() {
        const visible = isDraftLayerEnabled() && isDraftMarkerTitlesEnabled();

        if (Array.isArray(draftMarkerLabelOverlays)) {
            draftMarkerLabelOverlays.forEach(overlay => {
                if (overlay && typeof overlay.setVisible === "function") {
                    overlay.setVisible(visible);
                }
            });
        }

        if (Array.isArray(remoteDraftMarkerLabelOverlays)) {
            remoteDraftMarkerLabelOverlays.forEach(overlay => {
                if (overlay && typeof overlay.setVisible === "function") {
                    overlay.setVisible(visible);
                }
            });
        }
    }

    // ======================================
    // Local draft submissions
    // ======================================

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
                console.warn("[WFMM - Base] Failed to cursor drafts from IndexedDB", req.error);
                db.close();
            };
        }).catch(err => {
            console.warn("[WFMM - Base] IndexedDB not available (load drafts):", err);
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
                console.warn("[WFMM - Base] Failed to load draft by id", req.error);
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
                console.warn("[WFMM - Base] Failed to save draft submission", req.error);
            };

            tx.oncomplete = () => {
                db.close();
                refreshDraftMarkers();
                resolve();
            };

            tx.onerror = () => {
                console.warn("[WFMM - Base] Transaction error while saving draft submission", tx.error);
                db.close();
                reject(tx.error);
            };
        })).catch(err => {
            console.warn("[WFMM - Base] IndexedDB not available (save draft):", err);
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
                console.warn("[WFMM - Base] Failed to delete draft submission", req.error);
            };

            tx.oncomplete = () => {
                db.close();
                refreshDraftMarkers();
                resolve();
            };

            tx.onerror = () => {
                console.warn("[WFMM - Base] Transaction error while deleting draft submission", tx.error);
                db.close();
                reject(tx.error);
            };
        })).catch(err => {
            console.warn("[WFMM - Base] IndexedDB not available (delete draft):", err);
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

        clearDraftMarkerLabelOverlays(draftMarkerLabelOverlays);
        draftMarkerLabelOverlays = [];

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

                flyToLatLngAndPlaceSubmission(position);

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

            const labelOverlay = createDraftMarkerLabelOverlay(marker, poi.title);
            if (labelOverlay) {
                draftMarkerLabelOverlays.push(labelOverlay);
            }
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

            // Best-effort: add addressString (formatted only)
            let addressString = null;
            try {
                addressString = await getFormattedAddressString(poi?.lat, poi?.lng);
            } catch {}

            // Build record (now includes description/imageUrl/addressString)
            const rec = buildTicketRecordFromWayfarerMapApi({
                poi,
                reasonCode,
                reasonText,
                supportingText: comment || "",
                timestampMs,
                addressString
            });

            // Save (best-effort; do not block UX on failure)
            saveReportedWayspotToIDB(rec).then(ok => {
                if (ok) {
                    console.log("[WFMM - Base] Saved wayfarer-map report record:", rec);
                } else {
                    console.warn("[WFMM - Base] Failed to save wayfarer-map report record (collision or IDB error).", rec);
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
    // Report history store
    // ======================================================================

    const REPORTED_IDX_MECH_TS = "byMechanismTimestamp";
    const REPORTED_IDX_TICKET = "byTicket";

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

                if (!store.indexNames.contains(REPORTED_IDX_TICKET)) {
                    store.createIndex(REPORTED_IDX_TICKET, "ticket", { unique: false });
                }
            };

            openRequest.onerror = (event) => {
                reject(event.target.error || new Error("Failed to open IndexedDB"));
            };
        });
    }

    function makeReportId(timestampMs = Date.now()) {
        const t = Number(timestampMs || Date.now());
        const timePart = t.toString(36).padStart(10, "0");
        const randPart = Math.random().toString(36).slice(2, 12);
        return `rpt_${timePart}_${randPart}`;
    }

    function saveReportedWayspotToIDB(rec) {
        if (!rec || typeof rec.timestampMs !== "number" || !Number.isFinite(rec.timestampMs)) {
            console.warn("[WFMM - Base] Refusing to save report record: missing/invalid timestampMs", rec);
            return Promise.resolve(false);
        }

        if (!rec.id || typeof rec.id !== "string") {
            console.warn("[WFMM - Base] Refusing to save report record: missing id", rec);
            return Promise.resolve(false);
        }

        return getReportedWayspotsIDBInstance().then(db => new Promise((resolve) => {
            const tx = db.transaction(REPORTED_STORE_NAME, "readwrite");
            const store = tx.objectStore(REPORTED_STORE_NAME);

            const req = store.add(rec); // add() fails on duplicate id

            req.onerror = () => {
                console.warn("[WFMM - Base] Collision: report record not saved because id already exists:", rec.id, req.error, rec);
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
            console.warn("[WFMM - Base] IndexedDB not available (save reported wayspot):", err);
            return false;
        });
    }

    function buildTicketRecordFromWayfarerMapApi({ poi, reasonCode, reasonText, supportingText, timestampMs, addressString }) {
        const wp = poi || {};

        return {
            // Primary Key - Unique ID
            id: makeReportId(timestampMs),

            // Wayspot being reported (raw)
            guid:        (typeof wp.guid === "string")        ? wp.guid        : null,
            title:       (typeof wp.title === "string")       ? wp.title       : null,
            lat:         (typeof wp.lat === "number" && Number.isFinite(wp.lat)) ? wp.lat : null,
            lng:         (typeof wp.lng === "number" && Number.isFinite(wp.lng)) ? wp.lng : null,
            description: (typeof wp.description === "string") ? wp.description : null,
            imageUrl:    (typeof wp.imageUrl === "string")    ? wp.imageUrl    : null,
            isCommunityContributed:    (typeof wp.isCommunityContributed === "boolean")    ? wp.isCommunityContributed    : null,
            addressString: (typeof addressString === "string") ? addressString : null,

            // Report metadata
            ticket: null,
            timestampMs,
            reportMechanism: "wayfarer-map",

            // Report details (raw)
            removalReasonCode: (typeof reasonCode === "string") ? reasonCode : null,
            removalReasonText: (typeof reasonText === "string") ? reasonText : null,
            supportingText:    (typeof supportingText === "string") ? supportingText : null
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

    function idbFindReportedByTicket(ticketStr) {
        const ticket = String(ticketStr || "").trim();
        if (!/^\d{8}$/.test(ticket)) return Promise.resolve(null);

        return getReportedWayspotsIDBInstance().then(db => new Promise((resolve, reject) => {
            const tx = db.transaction(REPORTED_STORE_NAME, "readonly");
            const store = tx.objectStore(REPORTED_STORE_NAME);

            // Prefer index if present, fallback to scan
            const hasIndex = store.indexNames.contains(REPORTED_IDX_TICKET);

            if (hasIndex) {
                const idx = store.index(REPORTED_IDX_TICKET);
                const req = idx.getAll(IDBKeyRange.only(ticket));

                req.onsuccess = () => {
                    const rows = Array.isArray(req.result) ? req.result : [];
                    const best = rows
                    .filter(r => r && typeof r.lat === "number" && typeof r.lng === "number")
                    .sort((a, b) => (b.timestampMs || 0) - (a.timestampMs || 0))[0] || null;

                    db.close();
                    resolve(best);
                };
                req.onerror = () => { db.close(); reject(req.error); };
            } else {
                // Fallback: scan all (slower, but works if old DB)
                const req = store.getAll();
                req.onsuccess = () => {
                    const all = Array.isArray(req.result) ? req.result : [];
                    const rows = all.filter(r => r && r.ticket === ticket);
                    const best = rows
                    .filter(r => typeof r.lat === "number" && typeof r.lng === "number")
                    .sort((a, b) => (b.timestampMs || 0) - (a.timestampMs || 0))[0] || null;

                    db.close();
                    resolve(best);
                };
                req.onerror = () => { db.close(); reject(req.error); };
            }

            tx.onerror = () => { db.close(); reject(tx.error); };
        })).catch(err => {
            console.warn("[WFMM - Base] IDB ticket search failed:", err);
            return null;
        });
    }

    // ==================================
    // Patch old records missing addressString
    // ==================================

    // Temporary code to add addresses to previously saved reported Wayspots
    // This code segment can be deleted from March 2026 -- Anyone who cares
    // enough for this sort of thing would've updated by then.

    const REPORTED_PATCH_THROTTLE_MS = 5000;

    // Basic sleep helper for throttling
    function sleep(ms) {
        return new Promise(res => setTimeout(res, ms));
    }

    function isMissingAddressString(v) {
        return !(typeof v === "string" && v.trim().length > 0);
    }

    function isFiniteNumber(n) {
        return (typeof n === "number" && Number.isFinite(n));
    }

    /**
     * Get all reported wayspot records that are missing addressString.
     */
    function idbGetAllMissingAddressRecords() {
        return getReportedWayspotsIDBInstance().then(db => new Promise((resolve, reject) => {
            const tx = db.transaction(REPORTED_STORE_NAME, "readonly");
            const store = tx.objectStore(REPORTED_STORE_NAME);

            const req = store.getAll();

            req.onsuccess = () => {
                const all = Array.isArray(req.result) ? req.result : [];
                const missing = all.filter(r => {
                    if (!r || r.reportMechanism !== "wayfarer-map") return false;
                    if (!isMissingAddressString(r.addressString)) return false;
                    // Need lat/lng to patch
                    return isFiniteNumber(r.lat) && isFiniteNumber(r.lng);
                });

                db.close();
                resolve(missing);
            };

            req.onerror = () => {
                db.close();
                reject(req.error || new Error("Failed to read records"));
            };

            tx.onerror = () => {
                db.close();
                reject(tx.error || new Error("IDB tx error"));
            };
        }));
    }

    /**
     * Update a single record in IDB (in-place) by primary key.
     * Uses put() so it overwrites the existing record with same id.
     */
    function idbUpdateReportedWayspotRecord(updatedRec) {
        return getReportedWayspotsIDBInstance().then(db => new Promise((resolve) => {
            const tx = db.transaction(REPORTED_STORE_NAME, "readwrite");
            const store = tx.objectStore(REPORTED_STORE_NAME);

            const req = store.put(updatedRec);

            req.onerror = () => {
                console.warn("[WFMM - Base] Failed to update report record:", updatedRec?.id, req.error);
                // tx will likely abort; resolve on abort below
            };

            tx.oncomplete = () => { db.close(); resolve(true); };
            tx.onabort = () => { db.close(); resolve(false); };
            tx.onerror = () => { db.close(); resolve(false); };
        })).catch(err => {
            console.warn("[WFMM - Base] IndexedDB not available (update reported wayspot):", err);
            return false;
        });
    }

    /**
     * One-off patch run: find records missing addressString and backfill via geocoder.
     * Throttles calls (default: 1 per 5 seconds).
     */
    async function patchMissingAddressStringsOnLoad({
        throttleMs = REPORTED_PATCH_THROTTLE_MS,
        maxToPatch = Infinity
    } = {}) {
        let missing = [];
        try {
            missing = await idbGetAllMissingAddressRecords();
        } catch (e) {
            console.warn("[WFMM - Base] Address patch: could not load records:", e);
            return { ok: false, patched: 0, totalMissing: 0 };
        }

        if (!missing.length) {
            return { ok: true, patched: 0, totalMissing: 0 };
        }

        console.log(`[WFMM - Base] Address patch: ${missing.length} record(s) missing addressString. Starting backfill…`);

        let patched = 0;

        // Sort older -> newer (optional, but nice)
        missing.sort((a, b) => (a.timestampMs || 0) - (b.timestampMs || 0));

        for (const rec of missing) {
            if (patched >= maxToPatch) break;

            // If something else patched it in the meantime, skip (defensive)
            if (!isMissingAddressString(rec.addressString)) continue;

            try {
                const addr = await getFormattedAddressString(rec.lat, rec.lng);

                if (typeof addr === "string" && addr.trim()) {
                    const updated = { ...rec, addressString: addr.trim() };

                    const ok = await idbUpdateReportedWayspotRecord(updated);
                    if (ok) {
                        patched++;
                        console.log("[WFMM - Base] Address patch: updated", updated.id, addr);
                    } else {
                        console.warn("[WFMM - Base] Address patch: failed to write update for", rec.id);
                    }
                } else {
                    console.log("[WFMM - Base] Address patch: no address returned for", rec.id);
                }
            } catch (e) {
                console.warn("[WFMM - Base] Address patch: geocode failed for", rec?.id, e);
            }

            // Throttle between requests so you don't hammer geocoder / hit quota / trigger captcha
            await sleep(throttleMs);
        }

        console.log(`[WFMM - Base] Address patch complete. Patched ${patched}/${missing.length}.`);
        return { ok: true, patched, totalMissing: missing.length };
    }

    // One-off consistency patch on load (non-blocking)
    (() => {
        try {
            patchMissingAddressStringsOnLoad({ throttleMs: 5000 }).then((res) => {
            });
        } catch (e) {
            console.warn("[WFMM - Base] Address patch: failed to start:", e);
        }
    })();

    // ==================================
    // Info Window (Mobile Only)
    // ==================================

    function getPoiImageUrlsForInfoWindow(poi) {
        const raw = (poi?.imageUrl || "").trim();
        if (!raw) {
            return {
                iwImgUrl: NIANTIC_PLACEHOLDER_IMAGE_URL,
                fullImgUrl: NIANTIC_PLACEHOLDER_IMAGE_URL,
                isPlaceholder: true
            };
        }
        return {
            iwImgUrl: raw + "=w240",
            fullImgUrl: raw + "=s0",
            isPlaceholder: false
        };
    }

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

        const { iwImgUrl, fullImgUrl, isPlaceholder } = getPoiImageUrlsForInfoWindow(poi);

        return `
<div class="agm-info-window-content wfmapmods-iw-root wf-nearby-iw-content">
  <div class="wfmapmods-iw-content">

    <div class="wfmapmods-iw-header">
      <div class="wfmapmods-iw-title" title="${title}">
        <span class="wfmapmods-iw-copy-title"
              data-copy="${title.replace(/"/g, '&quot;')}"
              title="Click to copy title">${title}</span>
      </div>
      <button class="wfmapmods-iw-close wfmapmods-close-btn" title="Close">×</button>
    </div>

    <div class="wfmapmods-iw-coords">
      <span class="wfmapmods-iw-copy-coords"
            data-lat="${latStr}"
            data-lng="${lngStr}"
            title="Click to copy coordinates of selected Wayspot">
        ${latStr},${lngStr}
      </span>
    </div>

    <div class="wfmapmods-iw-img-wrapper">
      ${isPlaceholder
            ? `<img src="${iwImgUrl}" alt="" class="wfmapmods-iw-img wfmapmods-iw-img--placeholder"/>`
        : `<a href="${fullImgUrl}" target="_blank" rel="noopener noreferrer" class="wfmapmods-iw-img-link">
             <img src="${iwImgUrl}" alt="${title}" class="wfmapmods-iw-img"/>
           </a>`
    }
    </div>

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

    function getOverlayImageRecords(poi) {
        const records = buildPoiImageRecordList(poi);
        const mainUrl = poi?.imageUrl || NIANTIC_PLACEHOLDER_IMAGE_URL;

        if (records.length) {
            return {
                mainUrl: getImageRecordUrl(records[0]),
                imageRecords: records
            };
        }

        return {
            mainUrl,
            imageRecords: [{
                imageGuid: null,
                imageUrl: mainUrl,
                creationTimestampMs: null,
                playerVoted: null,
                playerVotes: null,
                photographerTrainerName: null
            }]
        };
    }

    function createWayspotOverlayDom(poi, mainUrl, imageRecords) {
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
        closeBtn.className = "wfmapmods-close-btn";
        closeBtn.textContent = "×";
        closeBtn.title = "Close";

        header.appendChild(titleEl);
        header.appendChild(closeBtn);
        dialog.appendChild(header);

        let carouselEl = null;
        if (imageRecords.length > 1) {
            carouselEl = document.createElement("div");
            carouselEl.className = "wfmapmods-wayspot-overlay-carousel";
            dialog.appendChild(carouselEl);
        }

        const imageFrame = document.createElement("div");
        imageFrame.className = "wfmapmods-wayspot-overlay-image-frame";

        const imageWrapper = document.createElement("a");
        imageWrapper.href = withS0(mainUrl);
        imageWrapper.target = "_blank";
        imageWrapper.rel = "noopener noreferrer";
        imageWrapper.className = "wfmapmods-wayspot-overlay-image-link";

        const imgEl = document.createElement("img");
        imgEl.src = mainUrl;
        imgEl.alt = poi?.title || "";
        imgEl.className = "wfmapmods-wayspot-overlay-image";

        imageWrapper.appendChild(imgEl);

        const imageMetaLabel = document.createElement("div");
        imageMetaLabel.className = "wfmapmods-photo-meta-overlay-label wfmapmods-photo-meta-overlay-label--overlay";

        const imageVoteHost = document.createElement("div");
        imageVoteHost.className = "wfmapmods-photo-vote-host wfmapmods-photo-vote-host--overlay";

        imageFrame.appendChild(imageWrapper);
        imageFrame.appendChild(imageMetaLabel);
        imageFrame.appendChild(imageVoteHost);

        const descEl = document.createElement("div");
        descEl.className = "wfmapmods-wayspot-overlay-desc";
        descEl.textContent = poi?.description || "";

        const body = document.createElement("div");
        body.className = "wfmapmods-wayspot-overlay-body";

        body.appendChild(imageFrame);
        body.appendChild(descEl);

        dialog.appendChild(body);
        backdrop.appendChild(dialog);

        return {
            backdrop,
            dialog,
            closeBtn,
            carouselEl,
            imageWrapper,
            imageMetaLabel,
            imageVoteHost,
            imgEl
        };
    }

    function setOverlayMainImage(state, imageRecordOrUrl) {
        if (!state || !imageRecordOrUrl) return;

        const record = typeof imageRecordOrUrl === "string"
        ? state.imageRecords.find(x => getImageRecordUrl(x) === imageRecordOrUrl)
        : imageRecordOrUrl;

        const url = getImageRecordUrl(record);
        if (!url) return;

        state.currentMainUrl = url;
        state.currentImageRecord = record || null;

        state.imgEl.src = url;
        state.imageWrapper.href = withS0(url);

        if (state.imageMetaLabel) {
            const metaText = getPhotoAbbreviatedMetaText(state.currentImageRecord);
            state.imageMetaLabel.textContent = metaText;
            state.imageMetaLabel.classList.toggle("wfmapmods-is-hidden", !metaText);
        }

        renderPoiImageVoteBadgeIntoHost(state.imageVoteHost, state.poi, state.currentImageRecord);

        const carouselEl = state.carouselEl;
        if (!carouselEl) return;

        const thumbs = carouselEl.querySelectorAll('img[data-url]');
        thumbs.forEach(t => {
            t.classList.toggle("is-active", t.getAttribute("data-url") === url);
        });
    }

    function buildOverlayCarousel(state, imageRecords) {
        const carouselEl = state.carouselEl;
        if (!carouselEl) return;

        carouselEl.innerHTML = "";

        for (const record of imageRecords) {
            const url = getImageRecordUrl(record);
            if (!url) continue;

            const t = document.createElement("img");
            t.src = url;
            t.alt = state.poi?.title || "";
            t.setAttribute("data-url", url);
            t.className = "wfmapmods-wayspot-overlay-thumb";

            t.addEventListener("click", (e) => {
                e.preventDefault();
                e.stopPropagation();
                setOverlayMainImage(state, record);
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

        const { mainUrl, imageRecords } = getOverlayImageRecords(poi);

        const dom = createWayspotOverlayDom(poi, mainUrl, imageRecords);
        document.body.appendChild(dom.backdrop);

        const state = {
            poi,
            backdrop: dom.backdrop,
            dialog: dom.dialog,
            carouselEl: dom.carouselEl,
            imageWrapper: dom.imageWrapper,
            imageMetaLabel: dom.imageMetaLabel,
            imageVoteHost: dom.imageVoteHost,
            imgEl: dom.imgEl,
            imageRecords,
            currentMainUrl: mainUrl,
            currentImageRecord: imageRecords[0] || null,
            escHandler: null
        };

        if (state.carouselEl) {
            buildOverlayCarousel(state, imageRecords);
            setOverlayMainImage(state, state.currentImageRecord);
        } else {
            setOverlayMainImage(state, state.currentImageRecord);
        }

        dom.closeBtn.addEventListener("click", (e) => {
            e.stopPropagation();
            closeWayspotDetailOverlay();
        });

        state.backdrop.addEventListener("click", (e) => {
            if (e.target === state.backdrop) closeWayspotDetailOverlay();
        });

        state.escHandler = (ev) => {
            if (ev.key === "Escape" && !document.querySelector(".wfmapmods-gallery-fs")) {
                closeWayspotDetailOverlay();
            }
        };

        wayspotOverlayState = state;
        document.addEventListener("keydown", state.escHandler);

        ensurePoiImagesLoaded(poi, { onlyIfStillSelected: false })
            .then(() => {
            if (wayspotOverlayState?.backdrop !== state.backdrop) return;
            if (!document.body.contains(state.backdrop)) return;

            const refreshed = getOverlayImageRecords(poi);
            const previousUrl = state.currentMainUrl;

            state.imageRecords = refreshed.imageRecords;

            if (state.imageRecords.length > 1 && !state.carouselEl) {
                closeWayspotDetailOverlay();
                openWayspotDetailOverlay(poi);
                return;
            }

            if (state.carouselEl) {
                buildOverlayCarousel(state, state.imageRecords);
            }

            const matchingRecord = state.imageRecords.find(record => getImageRecordUrl(record) === previousUrl)
            || state.imageRecords[0]
            || null;

            if (matchingRecord) {
                setOverlayMainImage(state, matchingRecord);
            }
        })
            .catch(err => {
            console.warn("[WFMM - Base] Overlay image metadata load failed:", err);
        });
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
                        checkboxLeft: true
                    })
                );

                const hideZoomTextChk = document.createElement("input");
                hideZoomTextChk.type = "checkbox";
                hideZoomTextChk.className = "wfmapmods-modal-checkbox";
                hideZoomTextChk.checked = !!mapCfg.hideZoomText;
                generalSection.appendChild(
                    createSettingsRow("Hide zoom hint text", hideZoomTextChk, {
                        checkboxLeft: true
                    })
                );

                const showAddressChk = document.createElement("input");
                showAddressChk.type = "checkbox";
                showAddressChk.className = "wfmapmods-modal-checkbox";
                showAddressChk.checked = !!mapCfg.showAddress;
                generalSection.appendChild(
                    createSettingsRow("Show Wayspot address", showAddressChk, {
                        checkboxLeft: true
                    })
                );

                const showApprovalDateChk = document.createElement("input");
                showApprovalDateChk.type = "checkbox";
                showApprovalDateChk.className = "wfmapmods-modal-checkbox";
                showApprovalDateChk.checked = mapCfg.showWayspotApprovalDate !== false;
                generalSection.appendChild(
                    createSettingsRow("Show Wayspot approval date", showApprovalDateChk, {
                        checkboxLeft: true
                    })
                );

                const estimatePre2019AgeChk = document.createElement("input");
                estimatePre2019AgeChk.type = "checkbox";
                estimatePre2019AgeChk.className = "wfmapmods-modal-checkbox";
                estimatePre2019AgeChk.checked = !!mapCfg.estimatePre2019WayspotAgesFromPhotos;
                estimatePre2019AgeChk.disabled = !showApprovalDateChk.checked;

                const estimatePre2019AgeRow = createSettingsRow("Estimate pre-2019 Wayspot ages from photo approval dates", estimatePre2019AgeChk, {
                    checkboxLeft: true
                });
                estimatePre2019AgeRow.classList.toggle("wfmapmods-setting-row-disabled", estimatePre2019AgeChk.disabled);
                generalSection.appendChild(estimatePre2019AgeRow);

                function syncEstimatePre2019AgeSettingEnabled() {
                    estimatePre2019AgeChk.disabled = !showApprovalDateChk.checked;
                    estimatePre2019AgeRow.classList.toggle("wfmapmods-setting-row-disabled", estimatePre2019AgeChk.disabled);

                    if (estimatePre2019AgeChk.disabled) {
                        estimatePre2019AgeChk.checked = false;
                    }
                }

                showApprovalDateChk.addEventListener("change", syncEstimatePre2019AgeSettingEnabled);

                const showSubmitterCodenameChk = document.createElement("input");
                showSubmitterCodenameChk.type = "checkbox";
                showSubmitterCodenameChk.className = "wfmapmods-modal-checkbox";
                showSubmitterCodenameChk.checked = mapCfg.showWayspotSubmitterCodename !== false;
                generalSection.appendChild(
                    createSettingsRow("Show Wayspot submitter codename", showSubmitterCodenameChk, {
                        checkboxLeft: true
                    })
                );

                const rememberGallerySortChk = document.createElement("input");
                rememberGallerySortChk.type = "checkbox";
                rememberGallerySortChk.className = "wfmapmods-modal-checkbox";
                rememberGallerySortChk.checked = !!mapCfg.rememberLastGallerySort;
                generalSection.appendChild(
                    createSettingsRow("Remember last used gallery sort", rememberGallerySortChk, {
                        checkboxLeft: true
                    })
                );

                const showPsrAllChk = document.createElement("input");
                showPsrAllChk.type = "checkbox";
                showPsrAllChk.className = "wfmapmods-modal-checkbox";
                showPsrAllChk.checked = !!mapCfg.showPowerSpotRadiusAroundPokestopsAndGyms;
                generalSection.appendChild(
                    createSettingsRow("Add 22m Power Spot radius around all PokéStops and Gyms", showPsrAllChk, {
                        checkboxLeft: true
                    })
                );

                const inactivePsAsActiveChk = document.createElement("input");
                inactivePsAsActiveChk.type = "checkbox";
                inactivePsAsActiveChk.className = "wfmapmods-modal-checkbox";
                inactivePsAsActiveChk.checked = !!mapCfg.displayInactivePowerSpotsAsActive;
                generalSection.appendChild(
                    createSettingsRow("Display inactive Power Spots same as active", inactivePsAsActiveChk, {
                        checkboxLeft: true
                    })
                );

                const recommendSquareSubmitPhotosChk = document.createElement("input");
                recommendSquareSubmitPhotosChk.type = "checkbox";
                recommendSquareSubmitPhotosChk.className = "wfmapmods-modal-checkbox";
                recommendSquareSubmitPhotosChk.checked = mapCfg.recommendSquareSubmitPhotos !== false;
                generalSection.appendChild(
                    createSettingsRow("Recommend 1:1 aspect ratio images", recommendSquareSubmitPhotosChk, {
                        checkboxLeft: true
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
                    hideZoomTextChk,
                    showAddressChk,
                    showApprovalDateChk,
                    estimatePre2019AgeChk,
                    showSubmitterCodenameChk,
                    rememberGallerySortChk,
                    showPsrAllChk,
                    inactivePsAsActiveChk,
                    recommendSquareSubmitPhotosChk,
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
                    hideZoomTextChk,
                    showAddressChk,
                    showApprovalDateChk,
                    estimatePre2019AgeChk,
                    showSubmitterCodenameChk,
                    rememberGallerySortChk,
                    showPsrAllChk,
                    inactivePsAsActiveChk,
                    recommendSquareSubmitPhotosChk,
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
                mapCfg.hideZoomText = !!hideZoomTextChk.checked;
                mapCfg.showAddress = !!showAddressChk.checked;
                mapCfg.showWayspotApprovalDate = !!showApprovalDateChk.checked;
                mapCfg.estimatePre2019WayspotAgesFromPhotos =
                    !!showApprovalDateChk.checked && !!estimatePre2019AgeChk.checked;
                mapCfg.showWayspotSubmitterCodename = !!showSubmitterCodenameChk.checked;
                mapCfg.rememberLastGallerySort = !!rememberGallerySortChk.checked;
                mapCfg.lastGallerySortMode = normaliseGallerySortMode(mapCfg.lastGallerySortMode);
                mapCfg.showPowerSpotRadiusAroundPokestopsAndGyms = !!showPsrAllChk.checked;
                mapCfg.recommendSquareSubmitPhotos = !!recommendSquareSubmitPhotosChk.checked;

                // if this changes, marker classification/styling changes (inactive powerspots become "powerspot")
                const prevInactiveAsActive = !!mapCfg.displayInactivePowerSpotsAsActive;
                mapCfg.displayInactivePowerSpotsAsActive = !!inactivePsAsActiveChk.checked;
                const inactiveAsActiveChanged = (prevInactiveAsActive !== mapCfg.displayInactivePowerSpotsAsActive);

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
                applyHideZoomTextCss();

                if (isValidLatLng(window.currentLat, window.currentLng)) {
                    updatePowerSpotRadiusCircle(window.currentLat, window.currentLng);
                    updateSubmissionInteractionCircle(window.currentLat, window.currentLng);
                }

                // Re-evaluate marker filtering/styling if inactive-as-active changed
                if (inactiveAsActiveChanged) {
                    // This ensures filter + style key changes propagate
                    rebuildAllPoiMarkers();
                }

                // Power spot rings around stops/gyms
                syncPowerSpotRingsWithMarkers();

                // If user turned off address, clear it from the panel immediately
                if (!mapCfg.showAddress) {
                    clearSelectedPoiAddressInPanel();
                } else if (lastSelectedPoi && lastSelectedPoi.lat && lastSelectedPoi.lng) {
                    // best-effort refresh for current selection
                    ensureSelectedPoiAddressLoaded(lastSelectedPoi);
                }

                if (!mapCfg.showWayspotApprovalDate && !mapCfg.showWayspotSubmitterCodename) {
                    clearSelectedPoiDetailsMetadataInPanel();
                } else if (lastSelectedPoi && lastSelectedPoi.guid) {
                    updateSelectedPoiDetailsMetadataFromPoi(lastSelectedPoi);

                    ensureSelectedPoiDetailsMetadataLoaded(lastSelectedPoi).catch(err => {
                        console.warn("[WFMM - Base] Failed to refresh POI details metadata:", err);
                    });
                }

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
        if (opts.checkboxLeft) {
            row.classList.add("wfmapmods-modal-row--checkbox-left");
        }

        const label = document.createElement("label");
        label.textContent = labelText;

        // Make the label toggle the input when possible
        // (works great for checkboxes, but harmless otherwise)
        if (!inputEl.id) {
            inputEl.id = `wfmapmods-input-${Math.random().toString(36).slice(2, 10)}`;
        }
        label.htmlFor = inputEl.id;

        if (opts.checkboxLeft) {
            // Checkbox first, then label (label can take remaining space)
            row.appendChild(inputEl);
            row.appendChild(label);
        } else {
            // Existing behavior
            row.appendChild(label);
            row.appendChild(inputEl);
        }

        return row;
    }

    function openDraftSettingsWindow() {
        openModal({
            id: "wfmapmods-draft-settings-backdrop",
            title: "Draft Settings",
            width: 430,
            buildContent(dialog, okBtn, closeModal) {
                const mapCfg = userSettings.map;
                const localCount = Array.isArray(draftSubmissions) ? draftSubmissions.length : 0;
                const remoteCount = Array.isArray(remoteDraftSubmissions) ? remoteDraftSubmissions.length : 0;

                // -------------------------
                // Section: draft marker display
                // -------------------------
                const displaySection = document.createElement("div");
                displaySection.className = "wfmapmods-modal-section";

                const displayHeader = document.createElement("div");
                displayHeader.className = "wfmapmods-modal-section-header";
                displayHeader.textContent = "Draft marker display";
                displaySection.appendChild(displayHeader);

                const showDraftTitlesRow = document.createElement("label");
                showDraftTitlesRow.className = "wfmapmods-layers-option";
                showDraftTitlesRow.style.alignItems = "center";

                const showDraftTitlesChk = document.createElement("input");
                showDraftTitlesChk.type = "checkbox";
                showDraftTitlesChk.className = "wfmapmods-layers-checkbox";
                showDraftTitlesChk.checked = mapCfg.showDraftMarkerTitles === true;

                const showDraftTitlesText = document.createElement("span");
                showDraftTitlesText.className = "wfmapmods-layers-label";
                showDraftTitlesText.style.lineHeight = "1.2";
                showDraftTitlesText.textContent = "Show draft titles under markers";

                showDraftTitlesRow.appendChild(showDraftTitlesChk);
                showDraftTitlesRow.appendChild(showDraftTitlesText);

                displaySection.appendChild(showDraftTitlesRow);
                dialog.appendChild(displaySection);

                // -------------------------
                // Section: draft storage
                // -------------------------
                const storageSection = document.createElement("div");
                storageSection.className = "wfmapmods-modal-section";

                const storageHeader = document.createElement("div");
                storageHeader.className = "wfmapmods-modal-section-header";
                storageHeader.textContent = "Draft storage";
                storageSection.appendChild(storageHeader);

                const storageText = document.createElement("div");
                storageText.className = "wfmapmods-modal-hint";
                storageText.style.whiteSpace = "normal";
                storageText.style.lineHeight = "1.5";
                storageText.innerHTML = `
                There are two possible locations where drafts can be stored:<br>
                • Local on the device<br>
                • Remotely on the Wayfarer website<br><br>
                Remote drafts can be accessed from any device and can be viewed and managed from the
                <a href="https://wayfarer.nianticlabs.com/new/submit" target="_blank" rel="noopener noreferrer">Wayfarer submission page</a>.<br><br>
                Currently, you have <strong>${localCount}</strong> local draft${localCount === 1 ? "" : "s"} and
                <strong>${remoteCount}</strong> remote draft${remoteCount === 1 ? "" : "s"}.
            `;
                storageSection.appendChild(storageText);

                const storageDivider = document.createElement("div");
                storageDivider.className = "wfmapmods-modal-divider";
                storageSection.appendChild(storageDivider);

                const defaultsHeader = document.createElement("div");
                defaultsHeader.className = "wfmapmods-modal-section-header";
                defaultsHeader.textContent = "Preferred storage location";
                storageSection.appendChild(defaultsHeader);

                const defaultSaveLabel = document.createElement("div");
                defaultSaveLabel.className = "wfmapmods-modal-hint";
                defaultSaveLabel.style.whiteSpace = "normal";
                defaultSaveLabel.style.lineHeight = "1.5";
                defaultSaveLabel.style.marginBottom = "10px";
                defaultSaveLabel.textContent = "Where should new drafts be stored?";
                storageSection.appendChild(defaultSaveLabel);

                const defaultSaveSelect = document.createElement("select");
                defaultSaveSelect.className = "wfmapmods-modal-select";
                defaultSaveSelect.style.width = "100%";
                defaultSaveSelect.style.maxWidth = "320px";
                defaultSaveSelect.style.background = "#ffffff";
                defaultSaveSelect.style.border = "1px solid #c8ccd1";
                defaultSaveSelect.style.borderRadius = "4px";
                defaultSaveSelect.style.padding = "6px 8px";
                defaultSaveSelect.style.fontSize = "12px";
                defaultSaveSelect.style.cursor = "pointer";

                const optRemote = document.createElement("option");
                optRemote.value = "remote";
                optRemote.textContent = "Wayfarer website (remote)";

                const optLocal = document.createElement("option");
                optLocal.value = "local";
                optLocal.textContent = "This device only (local)";

                defaultSaveSelect.appendChild(optRemote);
                defaultSaveSelect.appendChild(optLocal);
                defaultSaveSelect.value = mapCfg.defaultDraftSaveLocation === "local" ? "local" : "remote";

                storageSection.appendChild(defaultSaveSelect);
                dialog.appendChild(storageSection);

                // -------------------------
                // Section: migrate local drafts
                // Only show if local drafts exist
                // -------------------------
                let migrationStatus = null;
                let migrateBtn = null;
                let migrationRunning = false;

                if (localCount > 0) {
                    const migrationSection = document.createElement("div");
                    migrationSection.className = "wfmapmods-modal-section";

                    const migrationHeader = document.createElement("div");
                    migrationHeader.className = "wfmapmods-modal-section-header";
                    migrationHeader.textContent = "Migrate local drafts to Wayfarer";
                    migrationSection.appendChild(migrationHeader);

                    const migrationText = document.createElement("div");
                    migrationText.className = "wfmapmods-modal-hint";
                    migrationText.style.whiteSpace = "normal";
                    migrationText.style.lineHeight = "1.5";
                    migrationText.textContent =
                        `${localCount} local draft${localCount === 1 ? "" : "s"} can be migrated to remote drafts on Wayfarer.`;
                    migrationSection.appendChild(migrationText);

                    migrationStatus = document.createElement("div");
                    migrationStatus.className = "wfmapmods-modal-hint";
                    migrationStatus.style.marginTop = "8px";
                    migrationStatus.style.whiteSpace = "normal";
                    migrationStatus.style.lineHeight = "1.5";
                    migrationSection.appendChild(migrationStatus);

                    migrateBtn = document.createElement("button");
                    migrateBtn.type = "button";
                    migrateBtn.textContent = "Migrate local drafts to Wayfarer";
                    migrateBtn.className = "wfmapmods-modal-btn wfmapmods-modal-btn-primary";
                    migrateBtn.style.marginTop = "10px";

                    migrateBtn.addEventListener("click", async () => {
                        const currentLocalCount = Array.isArray(draftSubmissions) ? draftSubmissions.length : 0;
                        if (!currentLocalCount || migrationRunning) return;

                        migrationRunning = true;
                        closeModal();

                        wfmapmodsSetSubmitProgress(`Moving drafts to Wayfarer… 0 of ${currentLocalCount}`, 0);

                        try {
                            const result = await migrateLocalDraftsToRemoteQueue((progress) => {
                                const total = progress.total || 0;
                                const index = progress.index || 0;

                                let completed = 0;

                                if (progress.phase === "starting") {
                                    completed = Math.max(0, index - 1);
                                } else {
                                    completed = index;
                                }

                                const percent = total > 0 ? Math.floor((completed / total) * 100) : 100;

                                wfmapmodsSetSubmitProgress(
                                    `Moving drafts to Wayfarer… ${completed} of ${total}`,
                                    percent
                                );
                            });

                            const finalText = result.failCount > 0
                            ? `Migration finished. ${result.successCount} moved, ${result.failCount} failed.`
                            : `Migration finished. ${result.successCount} moved.`;

                            wfmapmodsSetSubmitProgress(finalText, 100);
                            wfmapmodsHideSubmitProgress(2000);

                        } catch (err) {
                            console.error("[WFMM - Draft Migration] Unexpected migration error:", err);
                            wfmapmodsSetSubmitProgress("Migration failed.", 100);
                            wfmapmodsHideSubmitProgress(2500);
                        } finally {
                            migrationRunning = false;
                        }
                    });

                    migrationSection.appendChild(migrateBtn);
                    dialog.appendChild(migrationSection);
                }

                return {
                    defaultSaveSelect,
                    showDraftTitlesChk
                };
            },
            onOk(ctx, closeModal) {
                const newShowDraftTitles = !!ctx.showDraftTitlesChk.checked;
                const draftTitlesChanged = userSettings.map.showDraftMarkerTitles !== newShowDraftTitles;

                userSettings.map.defaultDraftSaveLocation =
                    ctx.defaultSaveSelect.value === "local" ? "local" : "remote";

                userSettings.map.showDraftMarkerTitles = newShowDraftTitles;

                saveSettings();

                if (draftTitlesChanged) {
                    refreshDraftMarkers();
                    refreshRemoteDraftMarkers();
                } else {
                    applyDraftMarkerTitleVisibilityToAllOverlays();
                }

                closeModal();
            }
        });
    }

    function wfmmGetModalStack() {
        const k = "__wfmmModalStack";
        if (!window[k]) window[k] = [];
        return window[k];
    }

    function openModal({ id, title, buildContent, onOk, width, showFooterButtons, showHeaderClose, buildHeaderControls }) {
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

        // Wrap title + close button (optional)
        const headerRow = document.createElement("div");
        headerRow.style.display = "flex";
        headerRow.style.alignItems = "center";
        headerRow.style.justifyContent = "space-between";
        headerRow.style.gap = "8px";

        // Move the header text node into headerRow
        headerRow.appendChild(header);

        if (typeof buildHeaderControls === "function") {
            const headerControls = buildHeaderControls();
            if (headerControls) {
                headerControls.classList.add("wfmapmods-modal-header-controls");
                headerRow.appendChild(headerControls);
            }
        }

        let headerCloseBtn = null;
        if (showHeaderClose) {
            headerCloseBtn = document.createElement("button");
            headerCloseBtn.type = "button";
            headerCloseBtn.className = "wfmapmods-close-btn";
            headerCloseBtn.textContent = "×";
            headerCloseBtn.setAttribute("aria-label", "Close");
            headerCloseBtn.title = "Close";
            headerCloseBtn.addEventListener("click", (ev) => {
                ev.preventDefault();
                ev.stopPropagation();
                closeModal();
            });
            headerRow.appendChild(headerCloseBtn);
        }

        // Replace previous direct append of header with headerRow
        // (so REMOVE dialog.appendChild(header); above and do:)
        dialog.appendChild(headerRow);

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
                const target = ev.target;
                const tag = target && target.tagName ? target.tagName.toLowerCase() : "";

                const isTextEntry =
                      tag === "input" ||
                      tag === "textarea" ||
                      tag === "select" ||
                      (target && target.isContentEditable);

                if (isTextEntry || ev.isComposing) {
                    return;
                }

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

    // ==================================
    // Desktop vs Mobile Detection
    // ==================================

    function detectSubmitMapMode() {
        // Mobile submit page uses Niantic center overlay element
        if (document.querySelector(".nia-map__center-img-overlay")) {
            return MAP_MODE.MOBILE;
        }

        // Desktop submit page renders the SVG pin in Google Maps DOM
        const desktopImg = document.querySelector(
            '.gm-style div[style*="z-index: 1000"][style*="width: 36px"][style*="height: 56px"] img[src*="map_selection_pin.svg"]'
        );
        if (desktopImg) {
            return MAP_MODE.DESKTOP;
        }

        return null;
    }

    function detectMapviewMapMode() {
        // Mapview page uses a POI panel that gains a "mobile" class in mobile layout
        const panel = document.querySelector("app-poi-detail-panel .poi-panel");
        if (!panel) return null;
        return panel.classList.contains("mobile") ? MAP_MODE.MOBILE : MAP_MODE.DESKTOP;
    }

    function detectMapModeForCurrentRoute() {
        if (isOnSubmitRoute()) return detectSubmitMapMode();
        if (isOnMapviewRoute()) return detectMapviewMapMode();
        return null;
    }

    function applyModeForCurrentRoute(mode) {
        if (isOnSubmitRoute()) {
            if (mode === MAP_MODE.MOBILE) applySubmitMobileMode();
            else applySubmitDesktopMode();
            return;
        }

        if (isOnMapviewRoute()) {
            if (mode === MAP_MODE.MOBILE) applyMapviewMobileMode();
            else applyMapviewDesktopMode();
        }
    }

    function stopMapModeWatcher() {
        if (mapModeObserver) {
            try { mapModeObserver.disconnect(); } catch {}
            mapModeObserver = null;
        }
        mapModeRouteKey = null;
    }

    function startMapModeWatcher() {
        if (!isOnMapCapableRoute()) {
            stopMapModeWatcher();
            return;
        }

        const routeKey = currentMapRouteKey();
        if (mapModeObserver && mapModeRouteKey === routeKey) {
            return; // already watching this route instance
        }

        stopMapModeWatcher();
        mapModeRouteKey = routeKey;

        const updateMode = () => {
            if (!isOnMapCapableRoute()) return;

            const newMode = detectMapModeForCurrentRoute();
            if (!newMode || newMode === currentMapMode) return;

            currentMapMode = newMode;
            window.wfmapmodsMapMode = newMode;

            applyModeForCurrentRoute(newMode);
        };

        mapModeObserver = new MutationObserver((mutations) => {
            for (const m of mutations) {
                if (m.type === "attributes") {
                    updateMode();
                    return;
                }
                if (m.addedNodes && m.addedNodes.length) {
                    updateMode();
                    return;
                }
            }
        });

        mapModeObserver.observe(document.body, {
            childList: true,
            subtree: true,
            attributes: true,
            attributeFilter: ["class"]
        });

        window.addEventListener("resize", updateMode);

        updateMode();
    }

    // ==================================
    // Desktop vs Mobile Handling - Submit Page
    // ==================================

    function applySubmitMobileMode() {
        hideNativeCenterPin();
        ensureCenterPinOverlay();
        removeDesktopSubmitMarker();
        recenterMapOnCurrentSubmission();

        sidePanelCollapsed = true;
        applySidePanelCollapseState();

        if (lastSelectedPoi) {
            const latLng = new google.maps.LatLng(lastSelectedPoi.lat, lastSelectedPoi.lng);
            showPoiInfoWindowForSelection(lastSelectedPoi, latLng);
        }
    }

    function applySubmitDesktopMode() {
        removeCenterPinOverlay();

        ensureDesktopSubmitMarker();

        sidePanelCollapsed = false;
        applySidePanelCollapseState();

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
    // Desktop vs Mobile Handling - Mapview Page
    // ==================================

    function applyMapviewMobileMode() {
        sidePanelCollapsed = true;
        applySidePanelCollapseState();
        updateTopRightControlsVisibility();
    }

    function applyMapviewDesktopMode() {
        sidePanelCollapsed = false;
        applySidePanelCollapseState();
        updateTopRightControlsVisibility();

        if (poiInfoWindow) {
            poiInfoWindow.close();
        }
    }

    function updateTopRightControlsVisibility() {
        const shouldHide = isOnMapviewRoute() &&
              currentMapMode === MAP_MODE.MOBILE &&
              sidePanelCollapsed === false;

        if (filterControlEl) {
            filterControlEl.classList.toggle("wfmapmods-is-hidden", shouldHide);
        }

        if (layersControlEl) {
            layersControlEl.classList.toggle("wfmapmods-is-hidden", shouldHide);
        }
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
                updateSubmissionInteractionCircle(initialCoords.lat, initialCoords.lng);

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
        updateSubmissionInteractionCircle(newLat, newLng);

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
        if (dist > POI_MOVEMENT_THRESHOLD) {
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

        if (pendingSelect) {
            trySelectPendingPoi();
        }
    }

    // ==================================
    // POI Normalisers
    // ==================================

    function getPoiSource(poi) {
        // GCS is authoritative when present.
        // Live-only POIs do not expose this field, so missing/undefined falls back
        // to community as a practical default.
        return poi?.isCommunityContributed === false ? "import" : "community";
    }

    function normalizeIsCommunityContributed(v) {
        // Default to true unless explicitly false
        return (v === false) ? false : true;
    }

    function isLowZoomGcsZoom(zoom) {
        return (typeof zoom === "number" && zoom < GCS_MIN_ZOOM);
    }

    function getLowZoomGcsCellLevelForZoom(zoom) {
        // Niantic lowzoom bands:
        // z3-7  => L3
        // z8-10 => L6
        // z11-12 => L8
        // z13-15 => L11
        if (zoom <= 7) return 3;
        if (zoom <= 10) return 6;
        if (zoom <= 12) return 8;
        return 11;
    }

    function getGcsEndpointKind(url) {
        if (typeof url !== "string") return null;

        // Check lowzoom first. It is a separate endpoint and should be handled
        // as the same logical GCS source, but with lowzoom parsing rules.
        if (url.includes(LOWZOOM_GCS_ENDPOINT_PART)) return "lowzoom-gcs";
        if (url.includes(GCS_ENDPOINT_PART)) return "gcs";

        return null;
    }

    function shouldForceGenericPoiMarkersForCurrentZoom() {
        const zoom = wfMap?.getZoom?.();
        return (typeof zoom === "number" && zoom < GCS_MIN_ZOOM);
    }

    function shouldDisablePoiDetailsForCurrentZoom() {
        const zoom = wfMap?.getZoom?.();

        // Lowzoom L11 data, used from z13-z15, contains full POI data.
        // Below z13, lowzoom data may only contain poiId/lat/lng/isCommunityContributed.
        return (typeof zoom !== "number" || zoom < 13);
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

    function normalizeGcsPoi(p, sourceKind = "gcs") {
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
            isCommunityContributed: normalizeGcsIsCommunityContributed(p, sourceKind),
            hasAdditionalImages: p.hasAdditionalImages,
            pgoEntity,
            pgoEntityStatus,

            // Useful for debugging / future source-specific logic.
            __wfmmGcsSourceKind: sourceKind
        };
    }

    function getGcsCellContainersFromResponseData(data) {
        if (!Array.isArray(data)) return [];
        return data;
    }

    function getPoisFromGcsCellContainer(cell) {
        if (!cell || !Array.isArray(cell.pois)) return [];
        return cell.pois;
    }

    function extractAndNormalizeGcsPois(json, sourceKind = "gcs") {
        const zoom = wfMap?.getZoom?.();
        const isLowzoomResponse = (sourceKind === "lowzoom-gcs");
        const isSubmitRadiusResponse = (sourceKind === SUBMIT_RADIUS_GCS_SOURCE_KIND);

        // Important:
        // Return null for stale cross-band responses so they do NOT clear the
        // current GCS snapshot.
        //
        // Exception:
        // submit-radius-gcs is an intentional normal-GCS request made below z16
        // using a small safe bounding box around the submit pin.
        if (!isSubmitRadiusResponse && typeof zoom === "number") {
            if (isLowzoomResponse && zoom >= GCS_MIN_ZOOM) return null;
            if (!isLowzoomResponse && zoom < GCS_MIN_ZOOM) return null;
        }

        const data = json?.result?.data;
        const cells = getGcsCellContainersFromResponseData(data);

        if (!cells.length) {
            // Valid response, but no cells/POIs.
            // This should be allowed to replace the previous GCS snapshot.
            return [];
        }

        const out = [];
        const seen = new Set();

        for (const cell of cells) {
            const pois = getPoisFromGcsCellContainer(cell);
            if (!Array.isArray(pois)) continue;

            for (const p of pois) {
                const norm = normalizeGcsPoi(p, sourceKind);
                if (!norm || !norm.guid || seen.has(norm.guid)) continue;

                seen.add(norm.guid);
                out.push(norm);
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

        // SUBMIT ROUTE RULE:
        // Only show POIs that are in the live snapshot.
        if (isOnSubmitRoute()) {
            if (!hasLiveActive) return null;
        } else {
            // MAPVIEW ROUTE RULE:
            // If neither source claims it, don't show it.
            if (!hasLiveActive && !hasGcsActive) return null;
        }

        const live = livePoisByGuid.get(guid) || null;

        // Only include GCS fields if GCS currently claims it.
        // On submit route this becomes "enrich live POIs if they also appear in GCS".
        const gcs = hasGcsActive ? (gcsPoisByGuid.get(guid) || null) : null;

        const out = gcs ? { ...gcs } : { guid };

        if (live) {
            out.guid = guid;
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

        // Record that this source has delivered at least one snapshot for this selection attempt
        notePendingSelectSourceSeen(sourceName);
    }

    function notePendingSelectSourceSeen(sourceName) {
        if (!pendingSelect || !pendingSelectSourcesSeen) return;
        if (sourceName !== "live" && sourceName !== "gcs") return;

        pendingSelectSourcesSeen.add(sourceName);
    }

    // ==================================
    // Network: Live Pois in Radius API
    // ==================================

    function fetchLivePois(lat, lng) {
        const url = `/api/v1/vault/live-pois-in-radius?lat=${lat}&lng=${lng}&radius=${RADIUS_FOR_LIVE_POIS_API}`;

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

    function handleGcsResponseText(responseText, sourceKind = "gcs") {
        if (!responseText) return;

        let json;
        try { json = JSON.parse(responseText); } catch { return; }

        if (json?.code && json.code !== "OK") return;
        if (json?.result?.success === false) return;

        updateGcsLatestGeneratedTimestampFromResponse(json);

        const normalized = extractAndNormalizeGcsPois(json, sourceKind);

        // null means "stale response for the wrong zoom band".
        // Do not clear/replace the active GCS source in that case.
        if (!Array.isArray(normalized)) return;

        // Normal GCS and lowzoom GCS intentionally share the same source slot.
        // This means:
        // - normal GCS remains visible until lowzoom replaces it
        // - lowzoom remains visible until normal GCS replaces it
        // - live-pois-in-radius merge behaviour remains unchanged
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
                const sourceKind = getGcsEndpointKind(url);

                if (sourceKind) {
                    this.addEventListener("load", function () {
                        try {
                            if (this.status >= 200 && this.status < 300) {
                                handleGcsResponseText(this.responseText, sourceKind);
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

    function isFiniteNumber(value) {
        return typeof value === "number" && Number.isFinite(value);
    }

    function getSubmitPinLatLng() {
        // Primary source: the submit coordinate watcher already maintains these.
        if (isFiniteNumber(window.currentLat) && isFiniteNumber(window.currentLng)) {
            return {
                lat: window.currentLat,
                lng: window.currentLng
            };
        }

        // Fallback: live-pois-in-radius uses these when available.
        if (isFiniteNumber(lastFetchLat) && isFiniteNumber(lastFetchLng)) {
            return {
                lat: lastFetchLat,
                lng: lastFetchLng
            };
        }

        return null;
    }

    function clampLatitude(lat) {
        return Math.max(-85, Math.min(85, lat));
    }

    function normalizeLongitude(lng) {
        while (lng > 180) lng -= 360;
        while (lng < -180) lng += 360;
        return lng;
    }

    function getBoundsAroundLatLng(lat, lng, radiusMeters) {
        // Approximate metres per degree latitude.
        const latDelta = radiusMeters / 111320;

        // Longitude degrees get smaller toward the poles.
        const cosLat = Math.cos(lat * Math.PI / 180);
        const safeCosLat = Math.max(0.01, Math.abs(cosLat));
        const lngDelta = radiusMeters / (111320 * safeCosLat);

        return {
            ne: {
                lat: clampLatitude(lat + latDelta),
                lng: normalizeLongitude(lng + lngDelta)
            },
            sw: {
                lat: clampLatitude(lat - latDelta),
                lng: normalizeLongitude(lng - lngDelta)
            }
        };
    }

    function requestGcsPoisForBounds(map) {
        // Only run this on the Submit route.
        // The mapview page already does GCS and lowzoom GCS natively.
        if (isOnMapviewRoute()) return;

        const zoom = map.getZoom?.();
        if (typeof zoom !== "number") return;

        let ne;
        let sw;
        let sourceKind = "gcs";

        if (zoom >= GCS_MIN_ZOOM) {
            // At z16+, keep using the full map bounds.
            const bounds = map.getBounds?.();
            if (!bounds) return;

            const nativeNe = bounds.getNorthEast();
            const nativeSw = bounds.getSouthWest();

            ne = {
                lat: nativeNe.lat(),
                lng: nativeNe.lng()
            };

            sw = {
                lat: nativeSw.lat(),
                lng: nativeSw.lng()
            };
        } else {
            // Below z16, do NOT request the whole map bounds.
            // Instead, request normal GCS for a small bounding box around the
            // submit pin, matching the live-pois-in-radius area.
            const submitPin = getSubmitPinLatLng();
            if (!submitPin) return;

            const radiusMeters =
                  (isFiniteNumber(radius) ? radius : 350) + SUBMIT_RADIUS_GCS_PADDING_METERS;

            const syntheticBounds = getBoundsAroundLatLng(
                submitPin.lat,
                submitPin.lng,
                radiusMeters
            );

            ne = syntheticBounds.ne;
            sw = syntheticBounds.sw;
            sourceKind = SUBMIT_RADIUS_GCS_SOURCE_KIND;
        }

        const cellLevel = NORMAL_GCS_CELL_LEVEL;

        const url =
              `${GCS_ENDPOINT_PART}` +
              `?ne=(${ne.lat},${ne.lng})` +
              `&sw=(${sw.lat},${sw.lng})` +
              `&cellLevel=${cellLevel}`;

        // Avoid issuing identical requests repeatedly on idle.
        // Include sourceKind so z<16 submit-radius and z>=16 full-bounds requests
        // are treated as different request classes.
        const requestKey = [
            GCS_ENDPOINT_PART,
            sourceKind,
            cellLevel,
            ne.lat.toFixed(6),
            ne.lng.toFixed(6),
            sw.lat.toFixed(6),
            sw.lng.toFixed(6)
        ].join("|");

        if (map._wfmmLastGcsRequestKey === requestKey) {
            return;
        }

        map._wfmmLastGcsRequestKey = requestKey;

        try { map._wfmmGcsXhr?.abort?.(); } catch (_) {}

        const xhr = new XMLHttpRequest();
        map._wfmmGcsXhr = xhr;

        // Mark this manual request so the global XHR interceptor does not process
        // the same response a second time as ordinary "gcs".
        xhr._wfmm_manualGcsSourceKind = sourceKind;

        xhr.open("GET", url, true);
        xhr.withCredentials = true;

        xhr.onload = function () {
            if (xhr.status >= 200 && xhr.status < 300) {
                handleGcsResponseText(xhr.responseText, sourceKind);
            }
        };

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
    // Mapview POI enrichment: details, images, and image voting
    // ==================================

    // Cache: guid -> { images: [{ imageGuid, imageUrl, creationTimestampMs, playerVoted, playerVotes, photographerTrainerName }], fetchedAt }
    const poiImagesByGuid = new Map();

    // Cache: guid -> { details: { creationTimestampMs, submitterTrainerName }, fetchedAt }
    const poiDetailsByGuid = new Map();

    // Optional: limit cache growth
    const POI_IMAGES_CACHE_MAX = 500;
    const POI_DETAILS_CACHE_MAX = 500;

    // Track in-flight fetches to avoid duplicate calls
    const poiImagesInFlight = new Map();  // guid -> Promise
    const poiDetailsInFlight = new Map(); // guid -> Promise

    function normaliseNullableTimestampMs(value) {
        if (value === null || value === undefined) return null;

        const n = Number(value);
        return Number.isFinite(n) ? n : null;
    }

    function normaliseNullableInteger(value) {
        if (value === null || value === undefined) return null;

        const n = Number(value);
        return Number.isInteger(n) ? n : null;
    }

    function normaliseNullableBoolean(value) {
        return typeof value === "boolean" ? value : null;
    }

    function normaliseNullableString(value) {
        return typeof value === "string" ? value : null;
    }

    function normalisePoiDetailsResponse(json) {
        const result = json?.result || {};
        const creationTimestampMs = normaliseNullableTimestampMs(result.creationTimestampMs);

        return {
            creationTimestampMs,
            submitterTrainerName: normaliseNullableString(result.submitterTrainerName),
            isCourtsOfTheWorldImport: isCourtsOfTheWorldImportTimestamp(creationTimestampMs)
        };
    }

    function normalisePoiImagesResponse(json) {
        const imgs = Array.isArray(json?.result?.images) ? json.result.images : [];

        return imgs
            .map(x => ({
            imageGuid: normaliseNullableString(x?.imageGuid),
            imageUrl: normaliseNullableString(x?.imageUrl),
            creationTimestampMs: normaliseNullableTimestampMs(x?.creationTimestampMs),
            playerVoted: normaliseNullableBoolean(x?.playerVoted),
            playerVotes: normaliseNullableInteger(x?.playerVotes),
            photographerTrainerName: normaliseNullableString(x?.photographerTrainerName)
        }))
            .filter(x => !!x.imageUrl);
    }

    function evictOldCacheEntryIfNeeded(cacheMap, maxSize) {
        if (cacheMap.size <= maxSize) return;

        let oldestKey = null;
        let oldestAt = Infinity;

        for (const [k, v] of cacheMap.entries()) {
            const t = v?.fetchedAt || 0;
            if (t < oldestAt) {
                oldestAt = t;
                oldestKey = k;
            }
        }

        if (oldestKey) cacheMap.delete(oldestKey);
    }

    function attachPoiDetailsToPoi(poi, details) {
        if (!poi || !details) return;

        poi.poiDetails = details;
        poi.creationTimestampMs = details.creationTimestampMs;
        poi.submitterTrainerName = details.submitterTrainerName;
        poi.poiDetailsFetched = true;

        if (details.isCourtsOfTheWorldImport === true) {
            poi.isCourtsOfTheWorldImport = true;
            poi.isCommunityContributed = false;
        }

        enhancePoiForCourtsOfTheWorldImport(poi);
    }

    function attachPoiImagesToPoi(poi, images) {
        if (!poi) return;

        const safeImages = Array.isArray(images) ? images : [];

        poi.poiImages = safeImages;
        poi.additionalImages = safeImages;
        poi.poiImagesFetched = true;

        // Keep the old flag useful, but base it on the actual image count once
        // poi-images has returned. buildPoiImageRecordList also dedupes the GCS
        // main image against the poi-images response.
        poi.hasAdditionalImages = buildPoiImageRecordList(poi).length > 1;
    }

    async function fetchPoiDetailsForGuid(guid, options = {}) {
        if (!guid) return null;

        const force = options.force === true;

        if (!force) {
            const cached = poiDetailsByGuid.get(guid);
            if (cached && cached.details) return cached.details;

            if (poiDetailsInFlight.has(guid)) return poiDetailsInFlight.get(guid);
        }

        const p = (async () => {
            try {
                const url = `/api/v1/vault/mapview/poi-details?poiId=${encodeURIComponent(guid)}`;
                const json = await getJson(url);

                if (!json || json.captcha || (json.code && json.code !== "OK")) {
                    return null;
                }

                const details = normalisePoiDetailsResponse(json);

                poiDetailsByGuid.set(guid, {
                    details,
                    fetchedAt: Date.now()
                });
                evictOldCacheEntryIfNeeded(poiDetailsByGuid, POI_DETAILS_CACHE_MAX);

                return details;
            } catch (err) {
                console.warn("[WFMM - Base] Failed to fetch POI details:", err);
                return null;
            }
        })().finally(() => {
            poiDetailsInFlight.delete(guid);
        });

        poiDetailsInFlight.set(guid, p);
        return p;
    }

    async function fetchPoiImagesForGuid(guid, options = {}) {
        if (!guid) return [];

        const force = options.force === true;

        if (!force) {
            const cached = poiImagesByGuid.get(guid);
            if (cached && Array.isArray(cached.images)) return cached.images;

            if (poiImagesInFlight.has(guid)) return poiImagesInFlight.get(guid);
        }

        const p = (async () => {
            try {
                const url = `/api/v1/vault/mapview/poi-images?poiId=${encodeURIComponent(guid)}`;
                const json = await getJson(url);

                if (!json || json.captcha || (json.code && json.code !== "OK")) {
                    return [];
                }

                const images = normalisePoiImagesResponse(json);

                poiImagesByGuid.set(guid, {
                    images,
                    fetchedAt: Date.now()
                });
                evictOldCacheEntryIfNeeded(poiImagesByGuid, POI_IMAGES_CACHE_MAX);

                return images;
            } catch (err) {
                console.warn("[WFMM - Base] Failed to fetch POI images:", err);
                return [];
            }
        })().finally(() => {
            poiImagesInFlight.delete(guid);
        });

        poiImagesInFlight.set(guid, p);
        return p;
    }

    async function ensurePoiDetailsLoaded(poi, options = {}) {
        if (!poi || !poi.guid) return null;

        const guid = poi.guid;
        const onlyIfStillSelected = options.onlyIfStillSelected !== false;

        if (!options.force && poi.poiDetailsFetched && poi.poiDetails) {
            return poi.poiDetails;
        }

        const details = await fetchPoiDetailsForGuid(guid, options);
        if (!details) return null;

        if (onlyIfStillSelected && selectedPoiGuid !== guid) {
            return details;
        }

        if (lastSelectedPoi && lastSelectedPoi.guid === guid) {
            attachPoiDetailsToPoi(lastSelectedPoi, details);
        }

        if (poi && poi.guid === guid) {
            attachPoiDetailsToPoi(poi, details);
        }

        const markerPoi = markersByGuid?.[guid]?.poi;
        if (markerPoi) {
            attachPoiDetailsToPoi(markerPoi, details);
        }

        return details;
    }

    async function ensurePoiImagesLoaded(poi, options = {}) {
        if (!poi || !poi.guid) return [];

        const guid = poi.guid;
        const onlyIfStillSelected = options.onlyIfStillSelected !== false;

        if (!options.force && poi.poiImagesFetched && Array.isArray(poi.poiImages)) {
            return poi.poiImages;
        }

        const images = await fetchPoiImagesForGuid(guid, options);

        if (onlyIfStillSelected && selectedPoiGuid !== guid) {
            return images;
        }

        if (lastSelectedPoi && lastSelectedPoi.guid === guid) {
            attachPoiImagesToPoi(lastSelectedPoi, images);
        }

        if (poi && poi.guid === guid) {
            attachPoiImagesToPoi(poi, images);
        }

        const markerPoi = markersByGuid?.[guid]?.poi;
        if (markerPoi) {
            attachPoiImagesToPoi(markerPoi, images);
        }

        return images;
    }

    // Backwards-compatible name for existing callers.
    function ensurePoiAdditionalImagesLoaded(poi, options = {}) {
        return ensurePoiImagesLoaded(poi, options);
    }

    function ensureSelectedPoiEnrichmentLoaded(poi) {
        if (!poi || !poi.guid) return;

        const guidAtRequestTime = poi.guid;

        ensurePoiDetailsLoaded(poi)
            .then(() => {
            if (selectedPoiGuid !== guidAtRequestTime) return;

            updateSelectedPoiDetailsMetadataFromPoi(poi);
            refreshSelectedPoiStatusIconsFromPoi(poi);
        })
            .catch(err => {
            console.warn("[WFMM - Base] POI details enrichment failed:", err);
        });

        ensurePoiImagesLoaded(poi)
            .then(() => {
            if (selectedPoiGuid !== guidAtRequestTime) return;

            refreshSelectedPoiGalleryButtonFromLoadedImages(poi, guidAtRequestTime);
            updateSelectedPoiDetailsMetadataFromPoi(poi);
        })
            .catch(err => {
            console.warn("[WFMM - Base] POI image enrichment failed:", err);
        });
    }

    function getCachedPoiImageRecord(poiId, imageGuid) {
        if (!poiId || !imageGuid) return null;

        const cached = poiImagesByGuid.get(poiId);
        const images = Array.isArray(cached?.images) ? cached.images : [];

        return images.find(img => img?.imageGuid === imageGuid) || null;
    }

    function updateCachedPoiImageVoteState(poiId, imageGuid, playerVoted) {
        if (!poiId || !imageGuid || typeof playerVoted !== "boolean") return;

        const cached = poiImagesByGuid.get(poiId);
        const images = Array.isArray(cached?.images) ? cached.images : [];

        for (const img of images) {
            if (!img || img.imageGuid !== imageGuid) continue;

            const previousVoted = img.playerVoted;
            img.playerVoted = playerVoted;

            if (typeof img.playerVotes === "number" && previousVoted !== playerVoted) {
                img.playerVotes += playerVoted ? 1 : -1;
                if (img.playerVotes < 0) img.playerVotes = 0;
            }

            break;
        }

        const selectedImages = Array.isArray(lastSelectedPoi?.poiImages) ? lastSelectedPoi.poiImages : [];
        for (const img of selectedImages) {
            if (!img || img.imageGuid !== imageGuid) continue;

            const previousVoted = img.playerVoted;
            img.playerVoted = playerVoted;

            if (typeof img.playerVotes === "number" && previousVoted !== playerVoted) {
                img.playerVotes += playerVoted ? 1 : -1;
                if (img.playerVotes < 0) img.playerVotes = 0;
            }

            break;
        }
    }

    async function setPoiImageVoteForGuid(poiId, imageGuid, shouldVote) {
        if (!poiId) {
            throw new Error("Cannot vote for image: missing POI id.");
        }

        if (!imageGuid) {
            throw new Error("Cannot vote for image: missing image id.");
        }

        const payload = {
            poiId,
            imageIdsToVoteFor: shouldVote ? [imageGuid] : [],
            imageIdsToUnvote: shouldVote ? [] : [imageGuid]
        };

        const resp = await postJsonWithCsrf("/api/v1/vault/mapview/poi-image-vote", payload);

        if (!resp || resp.captcha || (resp.code && resp.code !== "OK")) {
            throw new Error("POI image vote request failed.");
        }

        updateCachedPoiImageVoteState(poiId, imageGuid, shouldVote);

        return resp;
    }

    function votePoiImageForGuid(poiId, imageGuid) {
        return setPoiImageVoteForGuid(poiId, imageGuid, true);
    }

    function unvotePoiImageForGuid(poiId, imageGuid) {
        return setPoiImageVoteForGuid(poiId, imageGuid, false);
    }

    // ==============================
    // Courts of the World (COTW) POI Handling
    // ==============================

    function isCourtsOfTheWorldImportTimestamp(timestampMs) {
        return normaliseNullableTimestampMs(timestampMs) === COURTS_OF_THE_WORLD_IMPORT_TIMESTAMP_MS;
    }

    function isCourtsOfTheWorldPoi(poi) {
        return poi?.isCourtsOfTheWorldImport === true
        || isCourtsOfTheWorldImportTimestamp(poi?.creationTimestampMs);
    }

    function isImportedPoi(poi) {
        return isCourtsOfTheWorldPoi(poi) || poi?.isCommunityContributed === false;
    }

    function enhancePoiForCourtsOfTheWorldImport(poi) {
        if (!poi || !isCourtsOfTheWorldImportTimestamp(poi.creationTimestampMs)) return;

        poi.isCourtsOfTheWorldImport = true;
        poi.isCommunityContributed = false;
    }

    function isCourtsOfTheWorldImportedPhoto(imageRecord) {
        return isCourtsOfTheWorldImportTimestamp(imageRecord?.creationTimestampMs);
    }

    // ==============================
    // Multiple images gallery
    // ==============================

    function withGoogleSize(url, size) {
        if (!url) return "";
        // Strip any existing "=s<number>" suffix
        const base = url.replace(/=s\d+$/, "");
        return `${base}=s${size}`;
    }

    function withS0(url) {
        return withGoogleSize(url, 0);
    }

    function withS1200(url) {
        return withGoogleSize(url, 1200);
    }

    function buildPoiImageRecordList(poi) {
        const out = [];
        const seenGuids = new Set();
        const seenUrls = new Set();

        function add(record) {
            if (!record) return;

            const imageGuid = record.imageGuid || null;
            const imageUrl = record.imageUrl || record.url || null;
            if (!imageUrl) return;

            // GCS may provide the main image without an imageGuid. poi-images may
            // later return the same imageUrl with metadata and an imageGuid.
            if ((imageGuid && seenGuids.has(imageGuid)) || seenUrls.has(imageUrl)) {
                return;
            }

            seenUrls.add(imageUrl);
            if (imageGuid) seenGuids.add(imageGuid);

            out.push({
                imageGuid,
                imageUrl,
                creationTimestampMs: normaliseNullableTimestampMs(record.creationTimestampMs),
                playerVoted: normaliseNullableBoolean(record.playerVoted),
                playerVotes: normaliseNullableInteger(record.playerVotes),
                photographerTrainerName: normaliseNullableString(record.photographerTrainerName)
            });
        }

        const apiImages = Array.isArray(poi?.poiImages)
        ? poi.poiImages
        : (Array.isArray(poi?.additionalImages) ? poi.additionalImages : []);

        for (const img of apiImages) {
            add(img);
        }

        // Fallback to the GCS main image if poi-images has not loaded yet, failed,
        // or did not include the main image for some reason.
        add({
            imageGuid: poi?.imageGuid || null,
            imageUrl: poi?.imageUrl || null,
            creationTimestampMs: null,
            playerVoted: null,
            playerVotes: null,
            photographerTrainerName: null
        });

        return out;
    }

    function buildPoiImageList(poi) {
        return buildPoiImageRecordList(poi)
            .map(img => img.imageUrl)
            .filter(Boolean);
    }

    function normaliseGallerySortMode(value) {
        return Object.values(GALLERY_SORT_MODES).includes(value)
            ? value
        : GALLERY_SORT_MODES.PHOTO_VOTES;
    }

    function getInitialGallerySortMode() {
        if (userSettings?.map?.rememberLastGallerySort) {
            return normaliseGallerySortMode(userSettings?.map?.lastGallerySortMode);
        }

        return GALLERY_SORT_MODES.PHOTO_VOTES;
    }

    function setLastUsedGallerySortMode(sortMode) {
        const safeMode = normaliseGallerySortMode(sortMode);

        if (!userSettings.map) return safeMode;

        userSettings.map.lastGallerySortMode = safeMode;

        // Always remember the last used mode internally. The setting controls
        // whether this mode is restored when opening the next gallery.
        saveSettings();

        return safeMode;
    }

    function getGalleryRecordTimestamp(record) {
        return normaliseNullableTimestampMs(record?.creationTimestampMs);
    }

    function getGalleryRecordCodename(record) {
        return normaliseNullableString(record?.photographerTrainerName)?.trim() || "";
    }

    function sortGalleryImageRecords(imageRecords, sortMode) {
        const safeMode = normaliseGallerySortMode(sortMode);
        const indexed = (Array.isArray(imageRecords) ? imageRecords : [])
        .map((record, index) => ({ record, index }));

        if (safeMode === GALLERY_SORT_MODES.PHOTO_VOTES) {
            // Photo Vote order is the original poi-images response order.
            return indexed
                .sort((a, b) => a.index - b.index)
                .map(x => x.record);
        }

        if (safeMode === GALLERY_SORT_MODES.PHOTO_AGE_DESC) {
            return indexed
                .sort((a, b) => {
                const at = getGalleryRecordTimestamp(a.record);
                const bt = getGalleryRecordTimestamp(b.record);

                if (at === null && bt === null) return a.index - b.index;
                if (at === null) return 1;
                if (bt === null) return -1;

                return bt - at || a.index - b.index;
            })
                .map(x => x.record);
        }

        if (safeMode === GALLERY_SORT_MODES.PHOTO_AGE_ASC) {
            return indexed
                .sort((a, b) => {
                const at = getGalleryRecordTimestamp(a.record);
                const bt = getGalleryRecordTimestamp(b.record);

                if (at === null && bt === null) return a.index - b.index;
                if (at === null) return 1;
                if (bt === null) return -1;

                return at - bt || a.index - b.index;
            })
                .map(x => x.record);
        }

        if (safeMode === GALLERY_SORT_MODES.CODENAME_ASC) {
            return indexed
                .sort((a, b) => {
                const an = getGalleryRecordCodename(a.record);
                const bn = getGalleryRecordCodename(b.record);

                if (!an && !bn) return a.index - b.index;
                if (!an) return 1;
                if (!bn) return -1;

                return an.localeCompare(bn, undefined, {
                    sensitivity: "base",
                    numeric: true
                }) || a.index - b.index;
            })
                .map(x => x.record);
        }

        return indexed
            .sort((a, b) => a.index - b.index)
            .map(x => x.record);
    }

    function poiHasMultipleGalleryImages(poi) {
        if (!poi) return false;

        // hasAdditionalImages is a useful early hint from GCS, so use it before
        // poi-images has returned.
        if (poi.hasAdditionalImages === true) return true;

        // Once poi-images has been fetched, trust the actual deduped image count.
        if (poi.poiImagesFetched === true) {
            return buildPoiImageRecordList(poi).length > 1;
        }

        return false;
    }

    function getSelectedPoiSidePanelGalleryElements() {
        if (!sidePanelEl) {
            return {
                multiplePhotosEl: null,
                multiplePhotosLinkEl: null
            };
        }

        return {
            multiplePhotosEl: sidePanelEl.querySelector(".wfmapmods-detail-multiple-photos"),
            multiplePhotosLinkEl: sidePanelEl.querySelector(".wfmapmods-detail-multiple-photos-link")
        };
    }

    function updateSelectedPoiGalleryButton(poi) {
        const { multiplePhotosEl, multiplePhotosLinkEl } = getSelectedPoiSidePanelGalleryElements();

        if (!multiplePhotosEl || !multiplePhotosLinkEl || !poi) return;

        const hasMore = poiHasMultipleGalleryImages(poi);

        multiplePhotosEl.classList.toggle("wfmapmods-is-hidden", !hasMore);

        multiplePhotosLinkEl.onclick = (ev) => {
            ev.preventDefault();
            ev.stopPropagation();
            openPoiGalleryModal(poi);
        };
    }

    function refreshSelectedPoiGalleryButtonFromLoadedImages(poi, guidAtRequestTime) {
        if (!poi || !guidAtRequestTime) return;

        // Avoid updating the side panel for a POI that is no longer selected.
        if (selectedPoiGuid !== guidAtRequestTime) return;

        updateSelectedPoiGalleryButton(poi);
    }

    function openPoiGalleryModal(poi) {
        if (!poi) return;

        let rawRecords = [];
        let currentSortMode = getInitialGallerySortMode();
        let renderSortedGallery = null;

        function buildGalleryTitle(photoCount = null) {
            const baseTitle = poi.title ? `Gallery — ${poi.title}` : "Gallery";

            if (!Number.isInteger(photoCount) || photoCount < 0) {
                return baseTitle;
            }

            const photoLabel = photoCount === 1 ? "photo" : "photos";
            return `${baseTitle} (${photoCount} ${photoLabel})`;
        }

        const sortControls = document.createElement("div");
        sortControls.className = "wfmapmods-gallery-header-sort-controls";

        const sortLabel = document.createElement("label");
        sortLabel.className = "wfmapmods-gallery-sort-label";
        sortLabel.textContent = "Sort";

        const sortSelect = document.createElement("select");
        sortSelect.className = "wfmapmods-gallery-sort-select";

        for (const mode of Object.values(GALLERY_SORT_MODES)) {
            const opt = document.createElement("option");
            opt.value = mode;
            opt.textContent = GALLERY_SORT_LABELS[mode] || mode;
            sortSelect.appendChild(opt);
        }

        sortSelect.value = currentSortMode;

        sortLabel.appendChild(sortSelect);
        sortControls.appendChild(sortLabel);

        sortSelect.addEventListener("change", () => {
            currentSortMode = setLastUsedGallerySortMode(sortSelect.value);
            sortSelect.value = currentSortMode;

            if (typeof renderSortedGallery === "function") {
                renderSortedGallery();
            }
        });

        openModal({
            id: "wfmapmods-gallery-backdrop",
            title: buildGalleryTitle(),
            width: 600,
            showFooterButtons: false,
            showHeaderClose: true,
            buildHeaderControls: () => sortControls,
            buildContent: (dialog, _okBtn, closeModal) => {
                const titleEl = dialog.querySelector(".wfmapmods-modal-title");

                const wrap = document.createElement("div");
                wrap.className = "wfmapmods-gallery-wrap";

                const grid = document.createElement("div");
                grid.className = "wfmapmods-gallery-grid";

                const loading = document.createElement("div");
                loading.className = "wfmapmods-gallery-loading";
                loading.textContent = "Loading photos…";

                wrap.appendChild(loading);
                wrap.appendChild(grid);
                dialog.appendChild(wrap);

                function updateGalleryTitle() {
                    if (!titleEl) return;
                    titleEl.textContent = buildGalleryTitle(rawRecords.length);
                }

                function renderTiles(imageRecords) {
                    grid.innerHTML = "";

                    const records = Array.isArray(imageRecords) ? imageRecords : [];

                    if (!records.length) {
                        loading.classList.remove("wfmapmods-is-hidden");
                        loading.textContent = "No photos found.";
                        updateGalleryTitle();
                        return;
                    }

                    loading.classList.add("wfmapmods-is-hidden");

                    records.forEach((record, idx) => {
                        const url = getImageRecordUrl(record);
                        if (!url) return;

                        const tile = document.createElement("div");
                        tile.className = "wfmapmods-gallery-tile";
                        tile.role = "button";
                        tile.tabIndex = 0;

                        const img = document.createElement("img");
                        img.src = url;
                        img.alt = poi.title ? `${poi.title} (${idx + 1}/${records.length})` : `Photo ${idx + 1}`;
                        img.loading = "lazy";

                        tile.appendChild(img);

                        const metaText = getPhotoAbbreviatedMetaText(record);
                        if (metaText) {
                            const metaLabel = document.createElement("div");
                            metaLabel.className = "wfmapmods-photo-meta-overlay-label";
                            metaLabel.textContent = metaText;
                            tile.appendChild(metaLabel);
                        }

                        const voteHost = document.createElement("div");
                        voteHost.className = "wfmapmods-photo-vote-host wfmapmods-photo-vote-host--gallery";
                        tile.appendChild(voteHost);

                        renderPoiImageVoteBadgeIntoHost(voteHost, poi, record);

                        function openFullscreen() {
                            openGalleryFullscreenViewer({
                                dialogEl: dialog,
                                imageRecords: records,
                                startIndex: idx
                            });
                        }

                        tile.addEventListener("click", (ev) => {
                            ev.preventDefault();
                            ev.stopPropagation();
                            openFullscreen();
                        });

                        tile.addEventListener("keydown", (ev) => {
                            if (ev.key !== "Enter" && ev.key !== " ") return;

                            ev.preventDefault();
                            ev.stopPropagation();
                            openFullscreen();
                        });

                        grid.appendChild(tile);
                    });
                }

                renderSortedGallery = function () {
                    const sortedRecords = sortGalleryImageRecords(rawRecords, currentSortMode);
                    updateGalleryTitle();
                    renderTiles(sortedRecords);
                };

                function setRawRecordsAndRender(records) {
                    rawRecords = Array.isArray(records) ? records : [];
                    renderSortedGallery();
                }

                if (poi.poiImagesFetched) {
                    setRawRecordsAndRender(buildPoiImageRecordList(poi));
                } else {
                    ensurePoiImagesLoaded(poi, { onlyIfStillSelected: false })
                        .then(() => {
                        setRawRecordsAndRender(buildPoiImageRecordList(poi));
                    })
                        .catch(err => {
                        console.warn("[WFMM - Base] Gallery image load failed:", err);
                        setRawRecordsAndRender(buildPoiImageRecordList(poi));
                    });
                }

                return { closeModal };
            }
        });
    }

    function getUserPreferredLocales() {
        if (Array.isArray(navigator.languages) && navigator.languages.length) {
            return navigator.languages;
        }

        if (navigator.language) {
            return navigator.language;
        }

        return undefined;
    }

    function formatUserLocaleDateFromTimestampMs(timestampMs) {
        const safeTimestamp = normaliseNullableTimestampMs(timestampMs);
        if (safeTimestamp === null) return "";

        const date = new Date(safeTimestamp);
        if (Number.isNaN(date.getTime())) return "";

        return new Intl.DateTimeFormat(getUserPreferredLocales(), {
            year: "numeric",
            month: "short",
            day: "numeric"
        }).format(date);
    }

    function getPhotoApprovedDateText(imageRecord) {
        return formatUserLocaleDateFromTimestampMs(imageRecord?.creationTimestampMs);
    }

    function getPhotoSubmitterNameText(imageRecord) {
        return normaliseNullableString(imageRecord?.photographerTrainerName)?.trim() || "";
    }

    function getPhotoFullscreenMetaText(imageRecord) {
        if (!imageRecord) return "";

        const approvedDate = getPhotoApprovedDateText(imageRecord);
        const submitterName = getPhotoSubmitterNameText(imageRecord);

        if (isCourtsOfTheWorldImportedPhoto(imageRecord)) {
            const lines = [];

            if (approvedDate) {
                lines.push(`Imported ${approvedDate}`);
            }

            lines.push("Courts of the World");

            return lines.join("\n");
        }

        const lines = [];

        if (approvedDate) {
            lines.push(`Approved ${approvedDate}`);
        }

        if (submitterName) {
            lines.push(`Submitted by ${submitterName}`);
        }

        return lines.join("\n");
    }

    function getPhotoAbbreviatedMetaText(imageRecord) {
        if (!imageRecord) return "";

        const approvedDate = getPhotoApprovedDateText(imageRecord);
        const submitterName = getPhotoSubmitterNameText(imageRecord);

        if (isCourtsOfTheWorldImportedPhoto(imageRecord)) {
            if (approvedDate) {
                return `${approvedDate}, Courts of the World`;
            }

            return "Courts of the World";
        }

        if (approvedDate && submitterName) {
            return `${approvedDate}, ${submitterName}`;
        }

        if (approvedDate) {
            return approvedDate;
        }

        if (submitterName) {
            return submitterName;
        }

        return "";
    }

    // Backwards-compatible name used by openGalleryFullscreenViewer().
    function getPhotoSubmittedText(imageRecord) {
        return getPhotoFullscreenMetaText(imageRecord);
    }

    function buildImageRecordsFromUrls(imageUrls) {
        if (!Array.isArray(imageUrls)) return [];

        return imageUrls
            .filter(Boolean)
            .map(url => ({
            imageGuid: null,
            imageUrl: url,
            creationTimestampMs: null,
            playerVoted: null,
            playerVotes: null,
            photographerTrainerName: null
        }));
    }

    function getImageRecordUrl(imageRecord) {
        return imageRecord?.imageUrl || imageRecord?.url || "";
    }

    function getImageVoteCount(imageRecord) {
        const n = normaliseNullableInteger(imageRecord?.playerVotes);
        return n === null ? null : Math.max(0, n);
    }

    function imageRecordVoteFeatureEnabled(imageRecord) {
        // playerVotes === null means photo voting is disabled or unavailable.
        // playerVotes === 0 means photo voting is enabled and the photo currently has no votes.
        return normaliseNullableInteger(imageRecord?.playerVotes) !== null;
    }

    function imageRecordCanBeVotedOn(poi, imageRecord) {
        return !!poi?.guid
        && !!imageRecord?.imageGuid
        && imageRecordVoteFeatureEnabled(imageRecord);
    }

    function applyVoteStateToDetachedImageRecord(imageRecord, shouldVote) {
        if (!imageRecord || typeof shouldVote !== "boolean") return;

        const previousVoted = imageRecord.playerVoted;
        imageRecord.playerVoted = shouldVote;

        if (previousVoted === shouldVote) return;

        const existingVotes = normaliseNullableInteger(imageRecord.playerVotes);

        if (existingVotes === null) {
            imageRecord.playerVotes = null;
            return;
        }

        imageRecord.playerVotes = existingVotes + (shouldVote ? 1 : -1);
        if (imageRecord.playerVotes < 0) imageRecord.playerVotes = 0;
    }

    function syncDetachedImageRecordFromCachedRecord(detachedRecord, cachedRecord) {
        if (!detachedRecord || !cachedRecord) return;

        detachedRecord.playerVoted = normaliseNullableBoolean(cachedRecord.playerVoted);
        detachedRecord.playerVotes = normaliseNullableInteger(cachedRecord.playerVotes);
    }

    function findCurrentCachedImageRecord(poiId, imageGuid, fallbackRecord = null) {
        if (!poiId || !imageGuid) return fallbackRecord;

        const cached = getCachedPoiImageRecord(poiId, imageGuid);
        return cached || fallbackRecord;
    }

    function cssEscapeValue(value) {
        if (window.CSS && typeof window.CSS.escape === "function") {
            return window.CSS.escape(value);
        }

        return String(value).replace(/["\\]/g, "\\$&");
    }

    function updatePoiImageVoteBadgeElement(button, imageRecord) {
        if (!button || !imageRecord) return;

        const voteCount = getImageVoteCount(imageRecord);

        if (voteCount === null) {
            button.remove();
            return;
        }

        const voted = imageRecord.playerVoted === true;

        button.classList.toggle("wfmapmods-photo-vote-badge--voted", voted);
        button.classList.remove("wfmapmods-photo-vote-badge--pending");
        button.disabled = false;
        button.setAttribute("aria-pressed", voted ? "true" : "false");
        button.title = voted ? "Remove vote from this photo" : "Vote for this photo";

        const countEl = button.querySelector(".wfmapmods-photo-vote-count");
        if (countEl) countEl.textContent = String(voteCount);
    }

    function refreshPoiImageVoteBadges(poiId, imageGuid, fallbackRecord = null) {
        if (!poiId || !imageGuid) return;

        const currentRecord = findCurrentCachedImageRecord(poiId, imageGuid, fallbackRecord);
        if (!currentRecord) return;

        const selector = `.wfmapmods-photo-vote-badge[data-poi-id="${cssEscapeValue(poiId)}"][data-image-guid="${cssEscapeValue(imageGuid)}"]`;
        const buttons = document.querySelectorAll(selector);

        buttons.forEach(button => {
            updatePoiImageVoteBadgeElement(button, currentRecord);
        });
    }

    function createThumbUpSvg() {
        const span = document.createElement("span");
        span.className = "wfmapmods-photo-vote-icon";
        span.setAttribute("aria-hidden", "true");

        span.innerHTML = `
        <svg viewBox="0 0 24 24" focusable="false">
            <path d="M1 21h4V9H1v12zm22-11c0-1.1-.9-2-2-2h-6.31l.95-4.57.03-.32c0-.41-.17-.79-.44-1.06L14.17 1 7.59 7.59C7.22 7.95 7 8.45 7 9v10c0 1.1.9 2 2 2h9c.83 0 1.54-.5 1.84-1.22l3.02-7.05c.09-.23.14-.47.14-.73v-2z"></path>
        </svg>
    `;

        return span;
    }

    function createPoiImageVoteBadge(poi, imageRecord, options = {}) {
        if (!imageRecordCanBeVotedOn(poi, imageRecord)) {
            return null;
        }

        const button = document.createElement("button");
        button.type = "button";
        button.className = "wfmapmods-photo-vote-badge";
        button.dataset.poiId = poi.guid;
        button.dataset.imageGuid = imageRecord.imageGuid;

        const countEl = document.createElement("span");
        countEl.className = "wfmapmods-photo-vote-count";

        button.appendChild(countEl);
        button.appendChild(createThumbUpSvg());

        updatePoiImageVoteBadgeElement(button, imageRecord);

        button.addEventListener("click", async (ev) => {
            ev.preventDefault();
            ev.stopPropagation();

            if (button.dataset.votePending === "true") return;

            const poiId = poi.guid;
            const imageGuid = imageRecord.imageGuid;
            const previousVoted = imageRecord.playerVoted === true;
            const previousVotes = normaliseNullableInteger(imageRecord.playerVotes);
            const shouldVote = !previousVoted;

            button.dataset.votePending = "true";

            // Optimistically update immediately so the UI feels responsive.
            applyVoteStateToDetachedImageRecord(imageRecord, shouldVote);
            updateCachedPoiImageVoteState(poiId, imageGuid, shouldVote);
            refreshPoiImageVoteBadges(poiId, imageGuid, imageRecord);

            if (typeof options.onVoteChanged === "function") {
                options.onVoteChanged({
                    poiId,
                    imageGuid,
                    imageRecord,
                    playerVoted: shouldVote
                });
            }

            try {
                await setPoiImageVoteForGuid(poiId, imageGuid, shouldVote);

                const cachedRecord = getCachedPoiImageRecord(poiId, imageGuid);
                if (cachedRecord) {
                    syncDetachedImageRecordFromCachedRecord(imageRecord, cachedRecord);
                    refreshPoiImageVoteBadges(poiId, imageGuid, imageRecord);
                }
            } catch (err) {
                console.warn("[WFMM - Base] Failed to update photo vote:", err);

                // Revert to the previous local state if the server rejects/fails.
                imageRecord.playerVoted = previousVoted;
                imageRecord.playerVotes = previousVotes;

                const cachedRecord = getCachedPoiImageRecord(poiId, imageGuid);
                if (cachedRecord) {
                    cachedRecord.playerVoted = previousVoted;
                    cachedRecord.playerVotes = previousVotes;
                }

                refreshPoiImageVoteBadges(poiId, imageGuid, imageRecord);
            } finally {
                delete button.dataset.votePending;
            }
        });

        return button;
    }

    function renderPoiImageVoteBadgeIntoHost(hostEl, poi, imageRecord, options = {}) {
        if (!hostEl) return;

        hostEl.innerHTML = "";

        const badge = createPoiImageVoteBadge(poi, imageRecord, options);

        if (!badge) {
            hostEl.classList.add("wfmapmods-is-hidden");
            return;
        }

        hostEl.classList.remove("wfmapmods-is-hidden");
        hostEl.appendChild(badge);
    }

    function openGalleryFullscreenViewer({ dialogEl, imageUrls, imageRecords, startIndex = 0 }) {
        const records = Array.isArray(imageRecords) && imageRecords.length
        ? imageRecords
        : buildImageRecordsFromUrls(imageUrls);

        if (!dialogEl || !records.length) return;

        // Prevent multiple fullscreen layers
        if (document.querySelector(".wfmapmods-gallery-fs")) return;

        let idx = Math.max(0, Math.min(startIndex, records.length - 1));

        function currentRecord() {
            return records[idx] || null;
        }

        function currentUrl() {
            return getImageRecordUrl(currentRecord());
        }

        const fs = document.createElement("div");
        fs.className = "wfmapmods-gallery-fs";

        const closeBtn = document.createElement("button");
        closeBtn.className = "wfmapmods-close-btn wfmapmods-gallery-fs-close";
        closeBtn.type = "button";
        closeBtn.textContent = "×";
        closeBtn.setAttribute("aria-label", "Close fullscreen");

        const leftBtn = document.createElement("button");
        leftBtn.className = "wfmapmods-gallery-fs-nav wfmapmods-gallery-fs-left";
        leftBtn.type = "button";
        leftBtn.setAttribute("aria-label", "Previous photo");
        leftBtn.innerHTML = "‹";

        const rightBtn = document.createElement("button");
        rightBtn.className = "wfmapmods-gallery-fs-nav wfmapmods-gallery-fs-right";
        rightBtn.type = "button";
        rightBtn.setAttribute("aria-label", "Next photo");
        rightBtn.innerHTML = "›";

        const metaEl = document.createElement("div");
        metaEl.className = "wfmapmods-gallery-fs-meta";

        const imgLink = document.createElement("a");
        imgLink.className = "wfmapmods-gallery-fs-imglink";
        imgLink.href = withS0(currentUrl());
        imgLink.target = "_blank";
        imgLink.rel = "noopener noreferrer";
        imgLink.title = "Open image in new tab";

        const img = document.createElement("img");
        img.className = "wfmapmods-gallery-fs-img";
        img.src = withS1200(currentUrl());
        img.alt = `Photo ${idx + 1} of ${records.length}`;

        imgLink.appendChild(img);

        const counter = document.createElement("div");
        counter.className = "wfmapmods-gallery-fs-counter";
        counter.textContent = `${idx + 1}/${records.length}`;

        fs.appendChild(closeBtn);
        fs.appendChild(leftBtn);
        fs.appendChild(rightBtn);
        fs.appendChild(metaEl);
        fs.appendChild(imgLink);
        fs.appendChild(counter);

        document.body.appendChild(fs);

        function updateMeta() {
            const text = getPhotoSubmittedText(currentRecord());
            metaEl.textContent = text;
            metaEl.classList.toggle("wfmapmods-is-hidden", !text);
        }

        function setIndex(next) {
            idx = (next + records.length) % records.length;

            const url = currentUrl();

            img.src = withS1200(url);
            imgLink.href = withS0(url);

            img.alt = `Photo ${idx + 1} of ${records.length}`;
            counter.textContent = `${idx + 1}/${records.length}`;

            updateMeta();

            const urls = records.map(getImageRecordUrl).filter(Boolean);
            prefetchNeighborImages(urls, idx);
        }

        function closeFs() {
            document.removeEventListener("keydown", keyHandlerCapture, true);
            fs.remove();
        }

        const initialUrls = records.map(getImageRecordUrl).filter(Boolean);
        prefetchNeighborImages(initialUrls, idx);
        updateMeta();

        function keyHandlerCapture(ev) {
            if (ev.key === "Escape") {
                ev.preventDefault();
                ev.stopPropagation();
                closeFs();
                return;
            }

            if (ev.key === "ArrowLeft") {
                ev.preventDefault();
                ev.stopPropagation();
                setIndex(idx - 1);
                return;
            }

            if (ev.key === "ArrowRight") {
                ev.preventDefault();
                ev.stopPropagation();
                setIndex(idx + 1);
            }
        }

        closeBtn.addEventListener("click", (ev) => {
            ev.preventDefault();
            ev.stopPropagation();
            closeFs();
        });

        leftBtn.addEventListener("click", (ev) => {
            ev.preventDefault();
            ev.stopPropagation();
            setIndex(idx - 1);
        });

        rightBtn.addEventListener("click", (ev) => {
            ev.preventDefault();
            ev.stopPropagation();
            setIndex(idx + 1);
        });

        fs.addEventListener("click", (ev) => {
            if (ev.target === fs) closeFs();
        });

        document.addEventListener("keydown", keyHandlerCapture, true);

        if (records.length <= 1) {
            leftBtn.classList.add("wfmapmods-is-hidden");
            rightBtn.classList.add("wfmapmods-is-hidden");
            counter.classList.add("wfmapmods-is-hidden");
        }
    }

    const _prefetchCache = new Set();

    function prefetch(url) {
        if (!url) return;
        const u = withS1200(url);
        if (_prefetchCache.has(u)) return;
        _prefetchCache.add(u);

        const img = new Image();
        img.decoding = "async";
        img.src = u;
    }

    function prefetchNeighborImages(urls, idx) {
        if (!Array.isArray(urls) || !urls.length) return;
        const prev = urls[(idx - 1 + urls.length) % urls.length];
        const next = urls[(idx + 1) % urls.length];
        prefetch(prev);
        prefetch(next);
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
            console.warn("[WFMM - Base] Failed to fetch /submit/available:", err);
            return availableQuotas; // keep prior cache
        });
    }

    // ==================================
    // Map sync timestamp
    // ==================================

    let lastMapSyncEl = null;
    let lastMapSyncTimer = null;
    let lastMapSyncObservedTs = null;

    function updateGcsLatestGeneratedTimestampFromResponse(json) {
        const blocks = json?.result?.data;
        if (!Array.isArray(blocks) || blocks.length === 0) return;

        let maxTs = 0;

        for (const cell of blocks) {
            const tsRaw = cell?.metadata?.generatedTimestamp;

            // It will be digits in ms (string or number). Convert safely.
            const ts = (typeof tsRaw === "number")
            ? tsRaw
            : (typeof tsRaw === "string" && /^\d+$/.test(tsRaw))
            ? Number(tsRaw)
            : NaN;

            if (Number.isFinite(ts) && ts > maxTs) maxTs = ts;
        }

        if (maxTs > (window.gcsLatestGeneratedTimestampMs || 0)) {
            window.gcsLatestGeneratedTimestampMs = maxTs;
            renderLastMapSyncLabel();
        }
    }

    function formatHoursAndMinsFromMs(tsMs) {
        if (!Number.isFinite(tsMs) || tsMs <= 0) return "";

        const now = Date.now();
        let diffMs = now - tsMs;
        if (!Number.isFinite(diffMs) || diffMs < 0) diffMs = 0;

        const totalMinutes = Math.floor(diffMs / 60000);
        const totalHours = Math.floor(totalMinutes / 60);

        // If 30 hours or more → switch to days/hours/mins
        if (totalHours >= 30) {
            const days = Math.floor(totalHours / 24);
            const hours = totalHours % 24;
            const minutes = totalMinutes % 60;
            return `${days}d ${hours}h ${minutes}m`;
        }

        // Original behaviour under 30 hours
        const hours = totalHours;
        const minutes = totalMinutes % 60;

        if (hours <= 0) {
            return `${minutes}m`;
        }
        return `${hours}h ${minutes}m`;
    }

    function renderLastMapSyncLabel() {
        if (!lastMapSyncEl) return;

        // Don't show on Submit route
        if (isOnSubmitRoute()) return;

        const ts = window.gcsLatestGeneratedTimestampMs;

        if (!Number.isFinite(ts) || ts <= 0) {
            lastMapSyncEl.classList.add("wfmapmods-is-hidden");
            lastMapSyncEl.textContent = "";
            lastMapSyncObservedTs = null;
            return;
        }

        const age = formatHoursAndMinsFromMs(ts);
        lastMapSyncEl.textContent = `Map data is ${age} old.`;
        lastMapSyncEl.classList.remove("wfmapmods-is-hidden");
        lastMapSyncObservedTs = ts;
    }

    function ensureLastMapSyncTimer() {
        if (lastMapSyncTimer) return;

        // Update “ago” over time even if timestamp doesn't change.
        lastMapSyncTimer = window.setInterval(() => {
            // If the element isn’t on the page anymore, stop.
            if (!lastMapSyncEl || !document.body.contains(lastMapSyncEl)) {
                clearInterval(lastMapSyncTimer);
                lastMapSyncTimer = null;
                return;
            }

            // Only re-render if:
            // - timestamp exists, OR
            // - it previously existed (so we can hide if it disappears)
            const ts = window.gcsLatestGeneratedTimestampMs;
            if (!Number.isFinite(ts) || ts <= 0) {
                if (lastMapSyncObservedTs != null) renderLastMapSyncLabel();
                return;
            }

            // Re-render every minute regardless so hours/minutes tick naturally.
            renderLastMapSyncLabel();
        }, 60 * 1000);
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
        const path = window.location.pathname || "";

        // On mapview, Niantic now mutates ?z=... as the user zooms.
        // That should not count as a real route change.
        if (path.startsWith(MAPVIEW_ROUTE)) {
            return path;
        }

        return path + (window.location.search || "");
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

        // If we already successfully set up this exact page state, don’t redo.
        if (routeKey === lastSetupRouteKey && wfMap && !isMapStale()) {
            return;
        }

        // Tear down old map state now (safe even if wfMap is null)
        teardownMap();

        if (!onMapRoute) {
            lastSetupRouteKey = null;
            teardownMap();
            return;
        }

        watchForLatLngElement();

        // Detect changes between mobile vs. desktop mode
        startMapModeWatcher();

        // Bug fix for geolocation on submit page
        kickstartGeolocationIfOnSubmitPage();

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

            const prevLowzoom = wfMap._wfmmLastIdleWasLowzoom;
            const zoom = wfMap.getZoom?.();
            const nowLowzoom = isLowZoomGcsZoom(zoom);

            requestGcsPoisForBounds(wfMap);

            // If only the zoom band changed but data has not arrived yet, rebuild
            // current markers immediately so thumbnails/clicking obey the current zoom.
            if (typeof prevLowzoom === "boolean" && prevLowzoom !== nowLowzoom) {
                rebuildAllPoiMarkers();
            }

            wfMap._wfmmLastIdleWasLowzoom = nowLowzoom;
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
        refreshAllPoiMarkers();
        loadDraftSubmissionsFromIDB();
        loadRemoteDraftSubmissionsFromWayfarer();

        if (isOnSubmitRoute()) {
            // Code for modifying the pin on the Submit map
            if (currentMapMode === MAP_MODE.MOBILE) {
                hideNativeCenterPin();
                ensureCenterPinOverlay();
            } else if (currentMapMode === MAP_MODE.DESKTOP) {
                ensureDesktopSubmitMarker();
            }
        }

        if (isOnMapviewRoute()) {
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

        // Remove observer for mobile vs desktop
        stopMapModeWatcher();

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

        disableSubmissionPinMode();

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
        if (!isOnMapviewRoute()) return;

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

        controlUI.addEventListener("click", (e) => {
            e.preventDefault();
            e.stopPropagation();

            wfExclusiveToggle(controlUI, WF_TOGGLE_GROUP);
            syncSubmissionPinEnabledFromDom();
        });

        map.controls[google.maps.ControlPosition.LEFT_TOP].push(controlDiv);
        submissionPinButton = controlUI;

        // Initialise as enabled
        controlUI.classList.add(WF_TOGGLE_ACTIVE_CLASS);

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
            hideLocationFunctions();

            // Enter placement mode (bind click listener)
            enableSubmissionPinMode();
        } else {
            // Turn off: always hide panel and clean up
            hideLocationFunctions();

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

            window.currentLat = lat;
            window.currentLng = lng;

            emitSubmitCoords(lat, lng, "mapview");

            handleLatLngChange(lat, lng);

            showLocationFunctions();
        });
    }

    function emitSubmitCoords(lat, lng, source = "mapview") {
        window.dispatchEvent(new CustomEvent("wf:submit-coords", {
            detail: { lat, lng, source, ts: Date.now() }
        }));
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

    function showLocationFunctions() {
        setLocationFunctionsHidden(false);
    }

    function hideLocationFunctions() {
        setLocationFunctionsHidden(true);
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

    function createUserLocationIcon() {
        const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 40 40">
  <circle cx="20" cy="20" r="15" fill="rgba(22,188,240,0.35)">
    <animate attributeName="r"
             values="15;20;15"
             dur="2s"
             repeatCount="indefinite"
             calcMode="spline"
             keySplines="0.4 0 0.6 1; 0.4 0 0.6 1"/>
    <animate attributeName="opacity"
             values="1;0.3;1"
             dur="2s"
             repeatCount="indefinite"
             calcMode="spline"
             keySplines="0.4 0 0.6 1; 0.4 0 0.6 1"/>
  </circle>
  <circle cx="20" cy="20" r="8"
          fill="#0096fe"
          stroke="white"
          stroke-width="4"/>
</svg>`;

        return {
            url: "data:image/svg+xml;charset=UTF-8," + encodeURIComponent(svg),
            scaledSize: new google.maps.Size(40, 40),
            anchor: new google.maps.Point(20, 20)
        };
    }

    function initUserLocationMarker(map) {
        userLocationMarker = new google.maps.Marker({
            map,
            clickable: false,
            zIndex: 9999,
            optimized: false,
            icon: createUserLocationIcon(),
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

    function copyAddressToClipboard(address) {
        if (!address) return Promise.reject(new Error("No address"));
        return copyTextToClipboard(address);
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

    const ZOOM_HINT_CLICK_SELECTOR = [
        ".zoom-hint-pill",
        ".sample-notice"
    ].join(", ");

    const ZOOM_HINT_HIDE_SELECTOR = [
        ".zoom-hint-row",
        ".sample-notice"
    ].join(", ");

    function getZoomHintClickTargets() {
        return Array.from(document.querySelectorAll(ZOOM_HINT_CLICK_SELECTOR));
    }

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
        const targets = getZoomHintClickTargets();
        if (!targets.length) return;

        for (const target of targets) {
            if (!target) continue;

            // Avoid binding multiple times as MutationObserver fires
            if (target.dataset.wfmmClickBound === "1") continue;
            target.dataset.wfmmClickBound = "1";

            target.addEventListener("click", (e) => {
                // Prevent the map click behind it
                e.preventDefault();
                e.stopPropagation();
                if (typeof e.stopImmediatePropagation === "function") e.stopImmediatePropagation();

                const current = map.getZoom?.();
                if (typeof current === "number" && current >= GCS_MIN_ZOOM) return;

                const center = map.getCenter?.();
                map.setZoom?.(GCS_MIN_ZOOM);

                // Keep same centre stable after zoom
                if (center && map.panTo) map.panTo(center);
            }, true);

            // Reinforce clickability in case CSS layering changes
            target.style.pointerEvents = "auto";
            target.style.cursor = "pointer";
        }
    }

    // ==================================
    // Map view persistence
    // ==================================

    const MAP_VIEW_KEY = "wfmapmods-map-view";

    function saveMapView() {
        // Don't do this on Submit page.
        // Map view permanence not used here because it affects drafts.
        if (isOnSubmitRoute()) return;

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

        // Don't restore on the Submit page. It messes with loading location pin of Drafts.
        if (isOnSubmitRoute()) return;

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

            emitSubmitCoords(lat, lng, "mapview");

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
                    if (mapAtSchedule !== wfMap) return;
                    if (routeKeyAtSchedule !== currentMapRouteKey()) return;
                    if (isMapStale()) return;

                    try {
                        if (isOnMapviewRoute()) {
                            placeSubmissionPinOnMapview(savedMarkerLatLng);
                        } else if (isOnSubmitRoute()) {
                            placeSubmissionPinOnSubmit(savedMarkerLatLng);
                        }
                    } catch (e) {
                        console.warn("Wayfarer Map: restore marker failed:", e);
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

        const raw = decodeURIComponent(search.substring(1)).trim();

        const match = raw.match(/^(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)(?=$|[=&])/);

        if (!match) return null;

        const lat = parseFloat(match[1]);
        const lng = parseFloat(match[2]);

        if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
        if (lat < -90 || lat > 90) return null;
        if (lng < -180 || lng > 180) return null;

        console.debug("[WFMM deep link] parse", {
            href: window.location.href,
            search,
            raw,
            match,
            result: match ? {
                lat: parseFloat(match[1]),
                lng: parseFloat(match[2])
            } : null
        });


        return { lat, lng };
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

    function clearDeepLinkReassertTimers() {
        for (const timer of deepLinkReassertTimers) {
            clearTimeout(timer);
        }
        deepLinkReassertTimers = [];
    }

    function getMapCenterLatLng() {
        if (!wfMap || typeof wfMap.getCenter !== "function") return null;

        const center = wfMap.getCenter();
        if (!center) return null;

        const lat = typeof center.lat === "function" ? center.lat() : center.lat;
        const lng = typeof center.lng === "function" ? center.lng() : center.lng;

        if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

        return { lat, lng };
    }

    function distanceFromDeepLinkTarget() {
        if (!deepLinkTarget) return Infinity;

        const center = getMapCenterLatLng();
        if (!center) return Infinity;

        return distanceMeters(
            deepLinkTarget.lat,
            deepLinkTarget.lng,
            center.lat,
            center.lng
        );
    }

    function forceDeepLinkMapView(reason) {
        if (!wfMap || !deepLinkTarget) return;

        const { lat, lng } = deepLinkTarget;
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;

        const distance = distanceFromDeepLinkTarget();

        console.debug("[WFMM deep link] reassert check", {
            reason,
            target: { lat, lng },
            currentCenter: getMapCenterLatLng(),
            distanceFromTarget: distance,
            zoom: wfMap.getZoom && wfMap.getZoom(),
            href: window.location.href
        });

        if (distance <= DEEP_LINK_TOLERANCE_METRES) {
            return;
        }

        const centerLatLng = new google.maps.LatLng(lat, lng);

        flyToLatLngAndPlaceSubmission(centerLatLng);

        if (wfMap.setZoom && wfMap.getZoom && wfMap.getZoom() < GCS_MIN_ZOOM) {
            wfMap.setZoom(GCS_MIN_ZOOM);
        }
    }

    function scheduleDeepLinkReassertion() {
        clearDeepLinkReassertTimers();

        deepLinkStartedAt = Date.now();

        for (const delay of DEEP_LINK_REASSERT_DELAYS_MS) {
            const timer = setTimeout(() => {
                if (!deepLinkTarget || !wfMap || isMapStale()) return;

                forceDeepLinkMapView(`timer-${delay}ms`);

                if (delay === DEEP_LINK_REASSERT_DELAYS_MS[DEEP_LINK_REASSERT_DELAYS_MS.length - 1]) {
                    console.debug("[WFMM deep link] finished reassert window", {
                        finalCenter: getMapCenterLatLng(),
                        finalDistance: distanceFromDeepLinkTarget()
                    });

                    clearDeepLinkReassertTimers();
                }
            }, delay);

            deepLinkReassertTimers.push(timer);
        }
    }

    function applyDeepLinkMapView() {
        if (!wfMap || !deepLinkTarget) return;

        const { lat, lng } = deepLinkTarget;
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;

        skipRestoreMapViewForThisLoad = true;

        queueExactPoiSelect(lat, lng);

        scheduleDeepLinkReassertion();
    }

    function trySelectPendingPoi() {
        if (!pendingSelectLatLng || !pendingSelect || !Array.isArray(window.currentPois) || window.currentPois.length === 0) {
            return;
        }

        const { lat: targetLat, lng: targetLng } = pendingSelectLatLng;
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

        if (!closestPoi) {
            // If both sources have produced a snapshot since we queued, give up.
            if (
                pendingSelectSourcesNeeded &&
                pendingSelectSourcesSeen &&
                pendingSelectSourcesNeeded.size > 0
            ) {
                let allSeen = true;
                for (const s of pendingSelectSourcesNeeded) {
                    if (!pendingSelectSourcesSeen.has(s)) { allSeen = false; break; }
                }

                if (allSeen) {
                    pendingSelectLatLng = null;
                    pendingSelect = false;
                    pendingSelectSourcesNeeded = null;
                    pendingSelectSourcesSeen = null;
                }
            }

            return; // keep pending (or stop if allSeen)
        }

        publishPoiToBridge(closestPoi);

        // clear ONLY on success
        pendingSelectLatLng = null;
        pendingSelect = false;

        // if these are only for deep-link flow, keep them where you set them
        deepLinkTarget = null;
        skipRestoreMapViewForThisLoad = false;
    }


    // ==================================
    // Search & geocoding helpers
    // ==================================

    async function handleSearchSubmit(rawValue) {
        if (!wfMap) return;

        const value = (rawValue || "").trim();
        if (!value) return;

        // 1) Ticket lookup
        const ticket = extractTicketNumber(value);
        if (ticket) {
            const rec = await idbFindReportedByTicket(ticket);
            if (rec && Number.isFinite(rec.lat) && Number.isFinite(rec.lng)) {
                flyToLatLngAndPlaceSubmission(new google.maps.LatLng(rec.lat, rec.lng));
                queueExactPoiSelect(rec.lat, rec.lng);
                return;
            }
            console.warn("[Wayfarer Map] No reported record found for ticket:", ticket);
            // optional: return here to avoid geocoding numeric strings
            // return;
        }

        // 2) Try to parse "lat,lng"
        const latLng = tryParseLatLng(value);
        if (latLng) {
            flyToLatLngAndPlaceSubmission(latLng);
            queueExactPoiSelect(latLng.lat(), latLng.lng());
            return;
        }

        // 3) Fallback to geocoding the address
        if (typeof google !== "undefined" && google.maps && google.maps.Geocoder) {
            const geocoder = new google.maps.Geocoder();
            geocoder.geocode({ address: value }, (results, status) => {
                if (status === "OK" && results && results[0]) {
                    const loc = results[0].geometry.location;
                    flyToLatLngAndPlaceSubmission(loc);
                } else {
                    console.warn("[Wayfarer Map] Geocode failed:", status);
                }
            });
        } else {
            console.warn("[Wayfarer Map] Google Maps Geocoder not available");
        }
    }

    function tryParseLatLng(str) {
        if (typeof str !== "string") return null;

        const isValidLatLng = (lat, lng) => {
            return (
                Number.isFinite(lat) &&
                Number.isFinite(lng) &&
                lat >= -90 &&
                lat <= 90 &&
                lng >= -180 &&
                lng <= 180
            );
        };

        // ---- Decimal degrees: exact input only ----
        const exactDecMatch = str.match(
            /^\s*\(?\s*(-?\d+(?:\.\d+)?)\s*(?:,\s*|\s+)(-?\d+(?:\.\d+)?)\s*\)?\s*$/
        );

        if (exactDecMatch) {
            const lat = parseFloat(exactDecMatch[1]);
            const lng = parseFloat(exactDecMatch[2]);

            if (isValidLatLng(lat, lng)) {
                return new google.maps.LatLng(lat, lng);
            }
        }

        // ---- Decimal degrees embedded inside a larger message ----
        // Requires a comma separator to avoid accidentally treating ordinary
        // space-separated numbers as coordinates.
        const embeddedDecMatch = str.match(
            /(^|[^\d.-])(-?\d{1,2}(?:\.\d+)?)\s*,\s*(-?\d{1,3}(?:\.\d+)?)(?=$|[^\d.])/
        );

        if (embeddedDecMatch) {
            const lat = parseFloat(embeddedDecMatch[2]);
            const lng = parseFloat(embeddedDecMatch[3]);

            if (isValidLatLng(lat, lng)) {
                return new google.maps.LatLng(lat, lng);
            }
        }

        // ---- Decimal degrees with hemisphere letters ----
        const decHemMatch = str.match(
            /^\s*\(?\s*(\d+(?:\.\d+)?)\s*(?:[°º]\s*)?([NS])\s*,?\s+(\d+(?:\.\d+)?)\s*(?:[°º]\s*)?([EW])\s*\)?\s*$/i
        );

        if (decHemMatch) {
            let lat = parseFloat(decHemMatch[1]);
            const latHem = decHemMatch[2].toUpperCase();

            let lng = parseFloat(decHemMatch[3]);
            const lngHem = decHemMatch[4].toUpperCase();

            if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

            if (latHem === "S") lat *= -1;
            if (lngHem === "W") lng *= -1;

            if (isValidLatLng(lat, lng)) {
                return new google.maps.LatLng(lat, lng);
            }
        }

        // ---- Degrees / Minutes / Seconds with hemisphere letters ----
        const dmsMatch = str.match(
            /^\s*\(?\s*([0-9]{1,3})\s*[°º]\s*([0-9]{1,2})\s*['’′]\s*([0-9]{1,2}(?:\.\d+)?)\s*(?:"|”|″)?\s*([NS])\s+([0-9]{1,3})\s*[°º]\s*([0-9]{1,2})\s*['’′]\s*([0-9]{1,2}(?:\.\d+)?)\s*(?:"|”|″)?\s*([EW])\s*\)?\s*$/i
        );

        if (!dmsMatch) return null;

        const latDeg = parseInt(dmsMatch[1], 10);
        const latMin = parseInt(dmsMatch[2], 10);
        const latSec = parseFloat(dmsMatch[3]);
        const latHem = dmsMatch[4].toUpperCase();

        const lngDeg = parseInt(dmsMatch[5], 10);
        const lngMin = parseInt(dmsMatch[6], 10);
        const lngSec = parseFloat(dmsMatch[7]);
        const lngHem = dmsMatch[8].toUpperCase();

        if (
            !Number.isFinite(latDeg) || !Number.isFinite(latMin) || !Number.isFinite(latSec) ||
            !Number.isFinite(lngDeg) || !Number.isFinite(lngMin) || !Number.isFinite(lngSec)
        ) return null;

        if (latMin >= 60 || latSec >= 60 || lngMin >= 60 || lngSec >= 60) return null;

        const dmsToDecimal = (deg, min, sec, hem) => {
            let value = deg + min / 60 + sec / 3600;
            if (hem === "S" || hem === "W") value *= -1;
            return value;
        };

        const lat = dmsToDecimal(latDeg, latMin, latSec, latHem);
        const lng = dmsToDecimal(lngDeg, lngMin, lngSec, lngHem);

        if (!isValidLatLng(lat, lng)) return null;

        return new google.maps.LatLng(lat, lng);
    }

    function extractTicketNumber(raw) {
        const s = String(raw || "").trim();
        if (!s) return null;

        // 8 digits not immediately preceded/followed by another digit
        const m = s.match(/(?:^|[^\d])(\d{8})(?:$|[^\d])/);
        return m ? m[1] : null;
    }

    function flyToLatLngAndPlaceSubmission(latLng) {
        if (!wfMap || !latLng) return;

        wfMap.setCenter(latLng);

        const z = wfMap.getZoom();
        if (typeof z === "number" && z < GCS_MIN_ZOOM) {
            wfMap.setZoom(GCS_MIN_ZOOM);
        }

        if (isOnMapviewRoute()) {
            placeSubmissionPinOnMapview(latLng);
            return;
        }

        if (isOnSubmitRoute()) {
            placeSubmissionPinOnSubmit(latLng);
            return;
        }
    }

    function placeSubmissionPinOnMapview(latLng) {
        const map = wfMap;
        if (!map || !google?.maps || !latLng) return;

        const lat = latLng.lat();
        const lng = latLng.lng();

        // Ensure placement mode is active so the marker exists/behaves consistently
        if (submissionPinButton && !submissionPinButton.classList.contains(WF_TOGGLE_ACTIVE_CLASS)) {
            wfExclusiveToggle(submissionPinButton, WF_TOGGLE_GROUP);
            syncSubmissionPinEnabledFromDom();
        }

        if (!submissionPinMarker) {
            submissionPinMarker = new google.maps.Marker({
                map,
                position: latLng,
                clickable: false,
                icon: getSubmissionPinIcon(30, 47),
                zIndex: 999999,
            });
        } else {
            submissionPinMarker.setPosition(latLng);
            submissionPinMarker.setMap(map);
        }

        window.currentLat = lat;
        window.currentLng = lng;

        showLocationFunctions();
        handleLatLngChange(lat, lng);

        emitSubmitCoords(lat, lng, "mapview");
    }

    function placeSubmissionPinOnSubmit(latLng) {
        if (!latLng) return;

        const lat = latLng.lat();
        const lng = latLng.lng();

        window.currentLat = lat;
        window.currentLng = lng;

        // Keep your submit page visuals consistent
        updateDesktopSubmitMarkerPosition();
        recenterMapOnCurrentSubmission();

        // If your submit flow needs downstream updates, keep them explicit
        handleLatLngChange(lat, lng);
    }

    function queueExactPoiSelect(lat, lng) {
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;

        pendingSelectLatLng = { lat, lng };
        pendingSelect = true;

        pendingSelectSourcesNeeded = new Set(["live", "gcs"]);
        pendingSelectSourcesSeen = new Set();
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
                flyToLatLngAndPlaceSubmission(place.geometry.location);
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
            radiusMeters: RADIUS_FOR_LIVE_POIS_API,
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

    function updateSubmissionInteractionCircle(lat, lng) {
        if (!isValidLatLng(lat, lng)) return;

        updateCircleOverlay({
            circleRefName: "submissionInteractionCircle80m",
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
            circleRefName: "submissionInteractionCircle80m",
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

    function shouldHavePowerSpotRing(poi) {
        if (!poi) return false;
        if (!userSettings?.map?.powerSpotRadius?.enabled) return false;
        if (!userSettings?.map?.showPowerSpotRadiusAroundPokestopsAndGyms) return false;

        const entity = (poi?.pgoEntity || "").toUpperCase();
        const status = (poi?.pgoEntityStatus || "").toUpperCase();

        // only ACTIVE gyms/stops (per your spec)
        if (status !== "ACTIVE") return false;
        return (entity === "GYM" || entity === "POKESTOP");
    }

    function syncPowerSpotRingsWithMarkers() {
        if (!wfMap || typeof google === "undefined" || !google.maps) return;

        const style = userSettings?.map?.powerSpotRadius || {};
        const enabledGlobal =
              !!style.enabled &&
              !!userSettings?.map?.showPowerSpotRadiusAroundPokestopsAndGyms;

        const zoom = wfMap?.getZoom?.();
        const enabledAtCurrentZoom =
              enabledGlobal &&
              typeof zoom === "number" &&
              zoom >= POWER_SPOT_RING_MIN_ZOOM;

        // If off, or zoomed too far out, clear all
        if (!enabledAtCurrentZoom) {
            for (const guid in powerSpotRingsByGuid) {
                powerSpotRingsByGuid[guid]?.setMap?.(null);
            }
            powerSpotRingsByGuid = {};
            return;
        }

        const wanted = new Set();

        for (const guid in markersByGuid) {
            const entry = markersByGuid[guid];
            const poi = entry?.poi;
            if (!poi) continue;

            const isCanvasMarker = entry?.renderer === "canvas";
            const isGoogleMarker = !!entry?.marker;

            // Ignore malformed entries, but allow canvas entries with marker:null.
            if (!isCanvasMarker && !isGoogleMarker) continue;

            // Respect marker visibility decisions. Canvas markers do not have a
            // google.maps.Marker instance, so visibility must be calculated from POI.
            const { visibleNow } = getMarkerVisibilityForPoi(poi);
            if (!visibleNow) continue;

            if (!shouldHavePowerSpotRing(poi)) continue;

            wanted.add(guid);

            const center = { lat: poi.lat, lng: poi.lng };
            let circle = powerSpotRingsByGuid[guid] || null;

            if (!circle) {
                circle = new google.maps.Circle({
                    map: wfMap,
                    center,
                    radius: 22,
                    strokeColor: style.strokeColor,
                    strokeOpacity: style.strokeOpacity ?? 0.8,
                    strokeWeight: style.strokeWidth ?? 2,
                    fillColor: style.fillColor,
                    fillOpacity: style.fillOpacity ?? 0.0,
                    clickable: false
                });

                powerSpotRingsByGuid[guid] = circle;
            } else {
                circle.setOptions({
                    strokeColor: style.strokeColor,
                    strokeOpacity: style.strokeOpacity ?? 0.8,
                    strokeWeight: style.strokeWidth ?? 2,
                    fillColor: style.fillColor,
                    fillOpacity: style.fillOpacity ?? 0.0,
                    clickable: false
                });

                circle.setCenter(center);
                circle.setRadius(22);
                circle.setMap(wfMap);
            }
        }

        // Remove stale rings
        for (const guid in powerSpotRingsByGuid) {
            if (!wanted.has(guid)) {
                powerSpotRingsByGuid[guid]?.setMap?.(null);
                delete powerSpotRingsByGuid[guid];
            }
        }
    }

    // ==================================
    // POI classification + filtering
    // ==================================

    function hasOwn(obj, key) {
        return !!obj && Object.prototype.hasOwnProperty.call(obj, key);
    }

    function normalizeGcsIsCommunityContributed(p, sourceKind = "gcs") {
        if (!p) return undefined;

        // Lowzoom GCS is compact:
        // - true is sent as isCommunityContributed: true
        // - false is omitted entirely
        if (sourceKind === "lowzoom-gcs") {
            return p.isCommunityContributed === true;
        }

        // Normal GCS is explicit and authoritative.
        // It should always be true/false, but keep this defensive.
        if (hasOwn(p, "isCommunityContributed")) {
            return p.isCommunityContributed === true;
        }

        // Unknown only if the expected field is genuinely absent from normal GCS.
        return undefined;
    }

    function getPoiGameObject(poi) {
        const entity = (poi?.pgoEntity || "").toUpperCase();
        const status = (poi?.pgoEntityStatus || "").toUpperCase();

        // Treat inactive Power Spots as active if setting enabled
        const inactivePsAsActive = !!userSettings?.map?.displayInactivePowerSpotsAsActive;

        if (status !== "ACTIVE") {
            if (inactivePsAsActive && entity === "POWERSPOT") return "powerspot";
            return "none";
        }

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

        let markerType = bucket.markerType || "generic";

        // Lowzoom data may lack image/title/detail data below z13,
        // and thumbnails should be disabled for all zooms below z16.
        if (shouldForceGenericPoiMarkersForCurrentZoom()) {
            markerType = "generic";
        }

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
            if (shouldDisablePoiDetailsForCurrentZoom()) return;

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
        if (!layerOn) {
            return { layerOn, visibleNow: false, mapForMarker: null };
        }

        const zoom = wfMap?.getZoom?.();
        const useFilter = typeof zoom === "number" && zoom >= GCS_MIN_ZOOM;

        const visibleNow = useFilter ? shouldShowPoi(poi) : true;
        const mapForMarker = visibleNow ? wfMap : null;

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
        const entry = markersByGuid?.[poi.guid];
        if (!entry || entry.marker !== marker) return;
        refreshPoiMarkerIcon(entry);
    }

    // ==================================
    // Marker canvas
    // ==================================


    let WfmmPoiCanvasOverlayClass = null;

    function getWfmmPoiCanvasOverlayClass() {
        if (WfmmPoiCanvasOverlayClass) return WfmmPoiCanvasOverlayClass;

        if (
            typeof google === "undefined" ||
            !google.maps ||
            !google.maps.OverlayView
        ) {
            return null;
        }

        WfmmPoiCanvasOverlayClass = class WfmmPoiCanvasOverlay extends google.maps.OverlayView {
            constructor(map) {
                super();

                this.canvas = null;
                this.ctx = null;
                this.raf = 0;
                this.hitItems = [];
                this.lastDrawMs = 0;
                this.lastDrawCount = 0;

                this.mapDiv = null;
                this.mouseListeners = [];
                this.mouseDownPoint = null;
                this.mouseMovedSinceDown = false;
                this.hoveredGuid = null;

                this.setMap(map);
            }

            onAdd() {
                const canvas = document.createElement("canvas");
                canvas.id = "wfmapmods-poi-canvas";
                canvas.className = "wfmapmods-poi-canvas";

                canvas.style.position = "absolute";
                canvas.style.left = "0";
                canvas.style.top = "0";
                canvas.style.pointerEvents = "none";
                canvas.style.display = "block";
                canvas.style.zIndex = "950";

                this.canvas = canvas;
                this.ctx = canvas.getContext("2d", { alpha: true });

                const panes = this.getPanes();

                // Visual layer only. Google moves this pane during pan.
                panes.overlayLayer.appendChild(canvas);

                this.mapDiv = wfMap?.getDiv?.() || null;

                // Important:
                // Do NOT redraw on bounds_changed or center_changed.
                // Those fire continuously during pan and cause the flicker/jump.
                this.listeners = [];

                if (this.mapDiv && typeof ResizeObserver !== "undefined") {
                    this.resizeObserver = new ResizeObserver(() => this.requestDraw());
                    this.resizeObserver.observe(this.mapDiv);
                }

                this.installMouseHitTesting();

                this.requestDraw();
            }

            onRemove() {
                this.removeMouseHitTesting();

                if (this.raf) {
                    cancelAnimationFrame(this.raf);
                    this.raf = 0;
                }

                if (Array.isArray(this.listeners)) {
                    this.listeners.forEach((l) => {
                        try {
                            google.maps.event.removeListener(l);
                        } catch (_) {}
                    });
                }

                this.listeners = [];

                if (this.resizeObserver) {
                    try {
                        this.resizeObserver.disconnect();
                    } catch (_) {}
                    this.resizeObserver = null;
                }

                if (this.canvas) {
                    this.canvas.remove();
                }

                this.canvas = null;
                this.ctx = null;
                this.hitItems = [];
            }

            draw() {
                // Google calls draw() during its own overlay layout cycle.
                // Do not defer this through requestAnimationFrame, or the canvas can
                // visibly sit at the old pane position for one frame.
                if (this.raf) {
                    cancelAnimationFrame(this.raf);
                    this.raf = 0;
                }

                this.renderNow();
            }

            requestDraw() {
                if (this.raf) return;

                this.raf = requestAnimationFrame(() => {
                    this.raf = 0;
                    this.renderNow();
                });
            }

            resizeCanvasToMap() {
                if (!this.canvas || !wfMap) return false;

                const div = wfMap.getDiv?.();
                if (!div) return false;

                const w = div.clientWidth || 0;
                const h = div.clientHeight || 0;
                if (!w || !h) return false;

                const dpr = Math.max(1, Math.min(window.devicePixelRatio || 1, 2));

                const pxW = Math.round(w * dpr);
                const pxH = Math.round(h * dpr);

                if (this.canvas.width !== pxW) this.canvas.width = pxW;
                if (this.canvas.height !== pxH) this.canvas.height = pxH;

                this.canvas.style.width = `${w}px`;
                this.canvas.style.height = `${h}px`;

                this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

                return true;
            }

            renderNow() {
                if (!this.canvas || !this.ctx || !wfMap) return;

                const projection = this.getProjection();
                if (!projection) return;

                const mapDiv = wfMap.getDiv?.();
                if (!mapDiv) return;

                const mapW = mapDiv.clientWidth || 0;
                const mapH = mapDiv.clientHeight || 0;
                if (!mapW || !mapH) return;

                const center = wfMap.getCenter?.();
                if (!center) return;

                const centerPx = projection.fromLatLngToDivPixel(center);
                if (!centerPx) return;

                // Overscan means the canvas is larger than the visible map.
                // While panning, Google moves this whole canvas with the map,
                // and already-drawn offscreen markers slide into view smoothly.
                const overscan = 1.0;

                const cssW = Math.round(mapW * (1 + overscan * 2));
                const cssH = Math.round(mapH * (1 + overscan * 2));

                const left = Math.round(centerPx.x - cssW / 2);
                const top = Math.round(centerPx.y - cssH / 2);

                const dpr = Math.max(1, Math.min(window.devicePixelRatio || 1, 2));
                const pxW = Math.round(cssW * dpr);
                const pxH = Math.round(cssH * dpr);

                if (this.canvas.width !== pxW) this.canvas.width = pxW;
                if (this.canvas.height !== pxH) this.canvas.height = pxH;

                this.canvas.style.left = `${left}px`;
                this.canvas.style.top = `${top}px`;
                this.canvas.style.width = `${cssW}px`;
                this.canvas.style.height = `${cssH}px`;

                const ctx = this.ctx;
                ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
                ctx.clearRect(0, 0, cssW, cssH);

                const start = performance.now();
                const items = [];

                for (const guid in markersByGuid) {
                    const entry = markersByGuid[guid];
                    if (!entry || entry.renderer !== "canvas") continue;

                    const poi = entry.poi;
                    if (!poi) continue;

                    const { visibleNow } = getMarkerVisibilityForPoi(poi);
                    if (!visibleNow) continue;

                    const lat = Number(poi.lat);
                    const lng = Number(poi.lng);
                    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;

                    const divPoint = projection.fromLatLngToDivPixel(
                        new google.maps.LatLng(lat, lng)
                    );

                    if (!divPoint) continue;

                    const x = divPoint.x - left;
                    const y = divPoint.y - top;

                    const ap = getResolvedPoiAppearance(poi);
                    const s = ap.generic || {};
                    const selected = poi.guid && poi.guid === selectedPoiGuid;

                    const radius = selected
                    ? (Number(s.markerSize ?? 8) + 1)
                    : Number(s.markerSize ?? 8);

                    const strokeWeight = selected
                    ? (Number(s.borderWidth ?? 2) + 2)
                    : Number(s.borderWidth ?? 2);

                    const pad = Math.max(24, radius + strokeWeight + 4);

                    if (
                        x < -pad ||
                        y < -pad ||
                        x > cssW + pad ||
                        y > cssH + pad
                    ) {
                        continue;
                    }

                    items.push({
                        guid,
                        poi,
                        x,
                        y,
                        radius,
                        strokeWeight,
                        fillColor: s.fillColor || "#ffffff",
                        fillOpacity: clamp(s.fillOpacity, 0, 1, 1),
                        strokeColor: selected ? "#ff00ff" : (s.borderColor || "#000000"),
                        strokeOpacity: selected ? 1 : clamp(s.borderOpacity, 0, 1, 1),
                        zIndex: getPoiMarkerZIndex(poi)
                    });
                }

                items.sort((a, b) => a.zIndex - b.zIndex);

                for (const item of items) {
                    this.drawCircleMarker(ctx, item);
                }

                this.hitItems = items;
                this.lastDrawMs = performance.now() - start;
                this.lastDrawCount = items.length;
            }

            drawCircleMarker(ctx, item) {
                ctx.save();

                ctx.globalAlpha = item.fillOpacity;
                ctx.fillStyle = item.fillColor;

                ctx.beginPath();
                ctx.arc(item.x, item.y, item.radius, 0, Math.PI * 2);
                ctx.fill();

                if (item.strokeWeight > 0) {
                    ctx.globalAlpha = item.strokeOpacity;
                    ctx.strokeStyle = item.strokeColor;
                    ctx.lineWidth = item.strokeWeight;

                    ctx.beginPath();
                    ctx.arc(
                        item.x,
                        item.y,
                        Math.max(0, item.radius - item.strokeWeight / 2),
                        0,
                        Math.PI * 2
                    );
                    ctx.stroke();
                }

                ctx.restore();
            }

            installMouseHitTesting() {
                const mapDiv = this.mapDiv || wfMap?.getDiv?.();
                if (!mapDiv) return;

                this.mapDiv = mapDiv;

                const opts = { capture: true, passive: false };

                mapDiv.addEventListener("mousemove", this.handleMapMouseMove, opts);
                mapDiv.addEventListener("mouseleave", this.handleMapMouseLeave, opts);
                mapDiv.addEventListener("mousedown", this.handleMapMouseDown, opts);
                mapDiv.addEventListener("mouseup", this.handleMapMouseUp, opts);
                mapDiv.addEventListener("click", this.handleMapClick, opts);

                this.mouseListeners = [
                    ["mousemove", this.handleMapMouseMove, opts],
                    ["mouseleave", this.handleMapMouseLeave, opts],
                    ["mousedown", this.handleMapMouseDown, opts],
                    ["mouseup", this.handleMapMouseUp, opts],
                    ["click", this.handleMapClick, opts]
                ];
            }

            removeMouseHitTesting() {
                if (!this.mapDiv || !Array.isArray(this.mouseListeners)) return;

                for (const [type, handler, opts] of this.mouseListeners) {
                    try {
                        this.mapDiv.removeEventListener(type, handler, opts);
                    } catch (_) {}
                }

                this.mouseListeners = [];
                this.hoveredGuid = null;

                try {
                    this.setCanvasMarkerHoverCursor(false);
                } catch (_) {}
            }

            getCanvasPointFromMouseEvent(ev) {
                if (!this.canvas) return null;

                const rect = this.canvas.getBoundingClientRect();

                return {
                    x: ev.clientX - rect.left,
                    y: ev.clientY - rect.top
                };
            }

            getEventPathToMapDiv(ev) {
                const path = typeof ev.composedPath === "function"
                ? ev.composedPath()
                : [];

                if (!path.length) return [];

                const out = [];

                for (const el of path) {
                    if (!el) continue;
                    out.push(el);

                    if (el === this.mapDiv) break;
                }

                return out;
            }

            isElementInteractiveForCanvasHitTest(el) {
                if (!el || el === this.mapDiv || el === this.canvas) return false;
                if (!(el instanceof Element)) return false;

                // Always allow the raw Google map surface to pass through.
                // We only want to block controls/overlays sitting above the map.
                if (el.id === "wfmapmods-poi-canvas") return false;

                // Native and semantic interactive UI.
                if (
                    el.matches?.(
                        [
                            "button",
                            "a[href]",
                            "input",
                            "select",
                            "textarea",
                            "label",
                            "summary",
                            "[role='button']",
                            "[role='link']",
                            "[role='menuitem']",
                            "[role='checkbox']",
                            "[role='switch']",
                            "[tabindex]:not([tabindex='-1'])",
                            "[contenteditable='true']"
                        ].join(", ")
                    )
                ) {
                    return true;
                }

                // Your script's UI should always win over canvas marker hit-testing.
                if (
                    el.closest?.(
                        [
                            ".wfmapmods-panel",
                            ".wfmapmods-side-panel",
                            ".wfmapmods-modal",
                            ".wfmapmods-wayspot-overlay-backdrop",
                            ".wfmapmods-floating-button",
                            ".wfmapmods-layers-button",
                            ".wfmapmods-filter-button",
                            ".wfmapmods-draft-marker",
                            "#wfmapmods-side-panel",
                            "#wfmapmods-settings-modal",
                            "#wfmapmods-layers-button",
                            "#wfmapmods-filter-button"
                        ].join(", ")
                    )
                ) {
                    return true;
                }

                // Niantic / Google UI and common custom overlay controls.
                if (
                    el.closest?.(
                        [
                            ".gm-control-active",
                            ".gmnoprint",
                            ".gm-style-mtc",
                            ".gm-fullscreen-control",
                            ".gm-svpc",
                            ".top-controls",
                            "app-map-controls",
                            "app-map-legend",
                            "app-poi-detail-panel",
                            ".filter-button",
                            ".sample-notice",
                            ".zoom-hint-row",
                            ".zoom-hint-pill"
                        ].join(", ")
                    )
                ) {
                    return true;
                }

                return false;
            }

            isEventBlockedByOverlayUi(ev) {
                if (!this.mapDiv) return false;

                const path = this.getEventPathToMapDiv(ev);

                for (const el of path) {
                    if (this.isElementInteractiveForCanvasHitTest(el)) {
                        return true;
                    }
                }

                // Extra safety: inspect the actual topmost element at this screen point.
                // This catches absolutely-positioned overlays from other scripts even if
                // the composed path is odd.
                const top = document.elementFromPoint?.(ev.clientX, ev.clientY);
                if (top && this.mapDiv.contains(top)) {
                    if (this.isElementInteractiveForCanvasHitTest(top)) {
                        return true;
                    }
                }

                return false;
            }

            findHitItemAtCanvasPoint(x, y) {
                if (!Array.isArray(this.hitItems) || !this.hitItems.length) return null;

                // Reverse order so the visually topmost marker wins.
                for (let i = this.hitItems.length - 1; i >= 0; i--) {
                    const item = this.hitItems[i];
                    if (!item) continue;

                    const visualRadius = Number(item.radius || 0);
                    const strokeWeight = Number(item.strokeWeight || 0);

                    // Keep a very small tolerance for anti-aliasing / easy clicking,
                    // but do not make the hit area much larger than the visible marker.
                    const hitRadius = Math.max(
                        4,
                        visualRadius + Math.ceil(strokeWeight / 2) + 1
                    );

                    const dx = x - item.x;
                    const dy = y - item.y;

                    if ((dx * dx + dy * dy) <= hitRadius * hitRadius) {
                        const latest = markersByGuid?.[item.guid]?.poi;
                        if (!latest) return null;

                        return {
                            item,
                            poi: latest
                        };
                    }
                }

                return null;
            }

            findHitItemFromMouseEvent(ev) {
                if (this.isEventBlockedByOverlayUi(ev)) return null;

                const point = this.getCanvasPointFromMouseEvent(ev);
                if (!point) return null;

                return this.findHitItemAtCanvasPoint(point.x, point.y);
            }

            handleMapMouseMove = (ev) => {
                if (!this.mapDiv) return;

                if (this.mouseDownPoint) {
                    const dx = ev.clientX - this.mouseDownPoint.x;
                    const dy = ev.clientY - this.mouseDownPoint.y;

                    if ((dx * dx + dy * dy) > 16) {
                        this.mouseMovedSinceDown = true;
                    }
                }

                const hit = shouldDisablePoiDetailsForCurrentZoom()
                ? null
                : this.findHitItemFromMouseEvent(ev);

                const guid = hit?.item?.guid || null;

                if (guid !== this.hoveredGuid) {
                    this.hoveredGuid = guid;

                    // Do not fight the map's dragging cursor while the mouse is down.
                    this.setCanvasMarkerHoverCursor(!!guid && !this.mouseDownPoint);
                }
            };

            handleMapMouseLeave = () => {
                this.hoveredGuid = null;
                this.mouseDownPoint = null;
                this.mouseMovedSinceDown = false;
                this.setCanvasMarkerHoverCursor(false);
            };

            handleMapMouseDown = (ev) => {
                if (this.isEventBlockedByOverlayUi(ev)) {
                    this.mouseDownPoint = null;
                    this.mouseMovedSinceDown = false;
                    this.hoveredGuid = null;
                    this.setCanvasMarkerHoverCursor(false);
                    return;
                }

                this.mouseDownPoint = {
                    x: ev.clientX,
                    y: ev.clientY
                };

                this.mouseMovedSinceDown = false;
            };

            handleMapMouseUp = () => {
                this.mouseDownPoint = null;
                this.mouseMovedSinceDown = false;
                this.setCanvasMarkerHoverCursor(
                    !!this.hoveredGuid && !shouldDisablePoiDetailsForCurrentZoom()
                );
            };

            handleMapClick = (ev) => {
                if (this.isEventBlockedByOverlayUi(ev)) {
                    this.mouseDownPoint = null;
                    this.mouseMovedSinceDown = false;
                    return;
                }

                // If the user dragged the map, do not treat the final click as marker click.
                if (this.mouseMovedSinceDown) {
                    this.mouseDownPoint = null;
                    this.mouseMovedSinceDown = false;
                    return;
                }

                if (shouldDisablePoiDetailsForCurrentZoom()) return;

                const hit = this.findHitItemFromMouseEvent(ev);
                if (!hit?.poi) return;

                publishPoiToBridge(hit.poi);

                // Prevent the underlying map click handler from also firing.
                ev.preventDefault();
                ev.stopPropagation();

                if (typeof ev.stopImmediatePropagation === "function") {
                    ev.stopImmediatePropagation();
                }
            };

            setCanvasMarkerHoverCursor(enabled) {
                if (!this.mapDiv) return;

                this.mapDiv.classList.toggle(
                    "wfmapmods-canvas-marker-hover",
                    !!enabled
                );
            }
        };

        return WfmmPoiCanvasOverlayClass;
    }

    function shouldUseCanvasPoiMarker(poi) {
        if (!WFMM_CANVAS_GENERIC_MARKERS_TEST) return false;
        if (!wfMap || !poi) return false;

        const ap = getResolvedPoiAppearance(poi);

        // Test only generic markers first.
        // Thumbnail markers stay as google.maps.Marker because they use the image pipeline.
        return ap.markerType !== "thumbnail";
    }

    function ensurePoiCanvasOverlay() {
        if (!WFMM_CANVAS_GENERIC_MARKERS_TEST) return null;
        if (!wfMap || typeof google === "undefined" || !google.maps) return null;

        if (poiCanvasOverlay && poiCanvasOverlay.getMap && poiCanvasOverlay.getMap() === wfMap) {
            return poiCanvasOverlay;
        }

        if (poiCanvasOverlay) {
            try {
                poiCanvasOverlay.setMap(null);
            } catch (_) {}
            poiCanvasOverlay = null;
        }

        const OverlayClass = getWfmmPoiCanvasOverlayClass();
        if (!OverlayClass) return null;

        poiCanvasOverlay = new OverlayClass(wfMap);
        return poiCanvasOverlay;
    }

    function destroyPoiCanvasOverlay() {
        if (poiCanvasOverlay) {
            try {
                poiCanvasOverlay.setMap(null);
            } catch (_) {}
            poiCanvasOverlay = null;
        }
    }

    function requestPoiCanvasRedraw() {
        if (!poiCanvasOverlay) return;
        poiCanvasOverlay.requestDraw();
    }

    function upsertCanvasPoiMarker(poi) {
        ensurePoiCanvasOverlay();

        const guid = poi?.guid;
        if (!guid) return;

        markersByGuid[guid] = {
            renderer: "canvas",
            marker: null,
            poi
        };

        requestPoiCanvasRedraw();
    }

    function removeCanvasPoiMarker(guid) {
        if (!guid) return;

        const entry = markersByGuid?.[guid];
        if (entry?.renderer === "canvas") {
            delete markersByGuid[guid];
            requestPoiCanvasRedraw();
        }
    }

    // ==================================
    // Marker lifecycle (create, refresh, upsert, sync, rebuild, clear)
    // ==================================

    function createPoiMarker(poi) {
        const ap = getResolvedPoiAppearance(poi);

        if (shouldUseCanvasPoiMarker(poi)) {
            upsertCanvasPoiMarker(poi);
            return null;
        }

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
        marker.__wfmmRenderer = "google";

        if (ap.markerType === "thumbnail") {
            marker.__wfmmThumbApplied = false;
            marker.__wfmmThumbStyleKey = null;

            const { size, baseBw, baseBc, baseBo } = getThumbParamsFromPoi(poi, ap);
            const { bc, bw, bo } = resolveThumbBorderForPoi(poi.guid, baseBw, baseBc, baseBo);
            const placeholderUrl = getWayfarerPlaceholderUrl(size, bc, bw, bo);
            setMarkerThumbIcon(marker, placeholderUrl, size);

            applyThumbnailVisuals(marker, poi, ap);
        } else {
            applyGenericVisuals(marker, poi, ap);
        }

        addListenersToPoiMarker(marker, poi);
        return marker;
    }

    function refreshPoiMarkerIcon(entry) {
        if (!entry) return;

        if (entry.renderer === "canvas") {
            requestPoiCanvasRedraw();
            return;
        }

        const marker = entry?.marker;
        const poi = entry?.poi;
        if (!marker || !poi) return;

        applyMarkerZIndex(marker, poi);

        const { visibleNow, mapForMarker } = getMarkerVisibilityForPoi(poi);

        if (marker.__wfmmVisible !== visibleNow) {
            marker.__wfmmVisible = visibleNow;
            marker.setVisible(visibleNow);
        }

        if (marker.__wfmmMap !== mapForMarker) {
            marker.__wfmmMap = mapForMarker;
            marker.setMap(mapForMarker);
        }

        if (!visibleNow) return;

        const ap = getResolvedPoiAppearance(poi);
        if (ap.markerType === "thumbnail") {
            applyThumbnailVisuals(marker, poi, ap);
        } else {
            applyGenericVisuals(marker, poi, ap);
        }
    }

    function refreshAllPoiMarkers() {
        if (!wfMap) return;

        for (const guid in markersByGuid) {
            refreshPoiMarkerIcon(markersByGuid[guid]);
        }

        requestPoiCanvasRedraw();
        syncPowerSpotRingsWithMarkers();
    }

    function upsertPoiMarker(poi) {
        const guid = poi.guid;
        const existing = markersByGuid[guid];

        const useCanvas = shouldUseCanvasPoiMarker(poi);

        // Existing canvas marker
        if (existing?.renderer === "canvas") {
            if (useCanvas) {
                existing.poi = poi;
                requestPoiCanvasRedraw();
                return;
            }

            // Marker changed from generic/canvas to thumbnail/google.
            delete markersByGuid[guid];
        }

        // Existing Google marker
        if (existing?.renderer === "google" || existing?.marker) {
            if (useCanvas) {
                // Marker changed from thumbnail/google to generic/canvas.
                if (existing.marker) existing.marker.setMap(null);
                delete markersByGuid[guid];
                upsertCanvasPoiMarker(poi);
                return;
            }

            const marker = existing.marker;
            const pos = marker.getPosition();

            if (!pos || pos.lat() !== poi.lat || pos.lng() !== poi.lng) {
                marker.setPosition({ lat: poi.lat, lng: poi.lng });
            }

            existing.poi = poi;
            existing.renderer = "google";

            if (typeof marker.setZIndex === "function") {
                marker.setZIndex(getPoiMarkerZIndex(poi));
            }

            refreshPoiMarkerIcon(existing);
            return;
        }

        // New marker
        if (useCanvas) {
            upsertCanvasPoiMarker(poi);
            return;
        }

        const marker = createPoiMarker(poi);
        markersByGuid[guid] = {
            renderer: "google",
            marker,
            poi
        };
    }

    function removeStaleMarkers(newGuids) {
        let removedCanvasMarker = false;

        for (const guid in markersByGuid) {
            if (!newGuids.has(guid)) {
                const entry = markersByGuid[guid];

                if (entry?.renderer === "canvas") {
                    removedCanvasMarker = true;
                } else if (entry?.marker) {
                    entry.marker.setMap(null);
                }

                delete markersByGuid[guid];
            }
        }

        if (removedCanvasMarker) {
            requestPoiCanvasRedraw();
        }
    }

    function syncPoiMarkersWithCurrentPois() {
        if (!wfMap || !Array.isArray(window.currentPois)) return;

        if (!poiInfoWindow) {
            poiInfoWindow = new google.maps.InfoWindow();
        }

        ensurePoiCanvasOverlay();

        updateNearbyWayspotsRadiusCircle();

        // Filter POIs we actually want to render as markers
        const visiblePois = window.currentPois;

        // Build a set of guids from the visible POI list (important!)
        const newGuids = new Set(visiblePois.map(p => p.guid));

        removeStaleMarkers(newGuids);

        for (const poi of visiblePois) {
            upsertPoiMarker(poi);
        }

        syncPowerSpotRingsWithMarkers();
    }

    function rebuildAllPoiMarkers() {
        if (!wfMap || !Array.isArray(window.currentPois)) return;

        for (const guid in markersByGuid) {
            const entry = markersByGuid[guid];

            if (entry?.renderer === "google" && entry.marker) {
                entry.marker.setMap(null);
            }
        }

        markersByGuid = {};

        ensurePoiCanvasOverlay();

        for (const poi of window.currentPois) {
            upsertPoiMarker(poi);
        }

        requestPoiCanvasRedraw();
        syncPowerSpotRingsWithMarkers();
    }

    function clearAllPoiMarkers() {
        try {
            if (markersByGuid) {
                for (const guid in markersByGuid) {
                    const entry = markersByGuid[guid];

                    if (entry?.renderer === "google" && entry.marker) {
                        entry.marker.setMap(null);
                    }
                }
            }
        } catch (e) {
            console.warn("[GCS] Failed to clear markers:", e);
        }

        markersByGuid = {};

        if (poiCanvasOverlay) {
            requestPoiCanvasRedraw();
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

        ensureSelectedPoiEnrichmentLoaded(poi);
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
   Re-organised into logical sections + duplication removed
   ============================================================================= */

/* =============================================================================
   01) Common helpers / utilities
   ============================================================================= */

.wfmapmods-is-hidden,
.wfmapmods-hidden {
  display: none !important;
}

/* Replaces setOkButtonState opacity/cursor inline styles */
.wfmapmods-btn-disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.wfmapmods-close-btn {
  flex: 0 0 28px;
  width: 28px;
  height: 28px;
  border-radius: 9999px;
  border: 1px solid rgba(0,0,0,0.2);
  background: #ffffff;
  cursor: pointer;
  font-size: 18px;
  line-height: 1;
  font-weight: 600;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
}

/* =============================================================================
   02) Modal: Backdrop + Dialog (generic)
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
  -webkit-overflow-scrolling: touch;
  overscroll-behavior: contain;
  padding: 12px;
  box-sizing: border-box;
}

.wfmapmods-modal-dialog {
  background: #ffffff;
  border-radius: 8px;
  box-shadow: 0 10px 25px rgba(0, 0, 0, 0.35);
  width: 280px;
  max-width: calc(100vw - 24px);
  max-height: calc(100dvh - 24px);
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
  padding: 12px 14px 10px;
  box-sizing: border-box;
  font-family: Roboto, Arial, sans-serif;
  font-size: 12px;
  color: #111827;
}

.wfmapmods-modal-title {
  min-width: 0;
  font-size: 15px;
  font-weight: 600;
  margin-bottom: 10px;
}

.wfmapmods-modal-dialog > div:first-child {
  flex-wrap: nowrap;
}

.wfmapmods-modal-intro {
  font-size: 11px;
  margin-bottom: 6px;
  line-height: 1.4;
  color: #374151;
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

.wfmapmods-modal-footer,
.wfmapmods-modal-actions {
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

/* Mobile modal layout */
@media (max-width: 520px) {
  .wfmapmods-modal-backdrop {
    align-items: flex-start;
    justify-content: center;
    padding: 12px;
    padding-top: max(12px, env(safe-area-inset-top));
    padding-bottom: max(12px, env(safe-area-inset-bottom));
  }

  .wfmapmods-modal-dialog {
    max-width: calc(100vw - 24px);
    max-height: calc(100dvh - 24px);
  }

  .wfmapmods-modal-dialog > div:first-child {
    flex-wrap: wrap;
    align-items: flex-start !important;
  }

  .wfmapmods-modal-title {
    order: 1;
    flex: 1 1 auto;
  }

  .wfmapmods-close-btn {
    order: 2;
    flex: 0 0 28px;
  }

  .wfmapmods-modal-header-controls {
    order: 3;
    width: 100%;
    margin-left: 0;
    margin-top: 8px;
    justify-content: flex-start;
  }

  /* Submission modal becomes a full-screen mobile task panel */
  #wfmapmods-submission-edit.wfmapmods-modal-backdrop {
    align-items: stretch;
    justify-content: stretch;
    padding: 0;
    background: rgba(0, 0, 0, 0.35);
  }

  #wfmapmods-submission-edit .wfmapmods-modal-dialog {
    width: 100vw !important;
    max-width: 100vw;
    height: 100vh;
    max-height: 100vh;
    border-radius: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    background: #fff;
  }

  @supports (height: 100dvh) {
    #wfmapmods-submission-edit .wfmapmods-modal-dialog {
      height: 100dvh;
      max-height: 100dvh;
    }
  }

  @supports (height: 100svh) {
    #wfmapmods-submission-edit .wfmapmods-modal-dialog {
      height: 100svh;
      max-height: 100svh;
    }
  }

  #wfmapmods-submission-edit .wfmapmods-modal-dialog > div:first-child {
    flex: 0 0 auto;
    padding: 10px 12px;
    border-bottom: 1px solid #e5e7eb;
    background: #fff;
    box-sizing: border-box;
  }

  #wfmapmods-submission-edit .wfmapmods-modal-title {
    font-size: 15px;
    font-weight: 600;
    line-height: 1.25;
    margin: 0;
    color: #111827;
  }

  #wfmapmods-submission-edit .wfmapmods-modal-subtitle {
    margin-top: 4px;
    font-size: 12px;
    font-weight: 400;
    line-height: 1.25;
    color: #6b7280;
  }

  #wfmapmods-submission-edit .wfmapmods-close-btn {
    min-width: 32px;
    min-height: 32px;
  }

  #wfmapmods-submission-edit .wfmapmods-submit-modal-body {
    flex: 1 1 auto;
    min-height: 0;
    overflow: auto;
    -webkit-overflow-scrolling: touch;
    overscroll-behavior: contain;
    padding: 10px 12px;
    box-sizing: border-box;
    background: #f9fafb;
  }

  #wfmapmods-submission-edit .wfmapmods-submit-wrap {
    gap: 10px;
  }

  #wfmapmods-submission-edit .wfmapmods-modal-intro {
    margin: 8px 0 0;
    padding: 0;
    background: transparent;
  }

  #wfmapmods-submission-edit .wfmapmods-modal-footer {
    flex: 0 0 auto;
    display: flex;
    flex-wrap: wrap;
    justify-content: flex-end;
    align-items: center;
    gap: 7px;
    margin-top: 0;
    padding: 8px 10px;
    padding-bottom: max(8px, env(safe-area-inset-bottom));
    border-top: 1px solid #e5e7eb;
    background: #fff;
    box-sizing: border-box;
  }

  #wfmapmods-submission-edit .wfmapmods-modal-footer .wfmapmods-modal-btn {
    width: auto;
    min-width: 82px;
    min-height: 34px;
    padding: 6px 10px;
    font-size: 13px;
    line-height: 1.2;
    flex: 0 0 auto;
  }

  #wfmapmods-submission-edit .wfmapmods-modal-footer .wfmapmods-btn-delete-draft {
    color: #b91c1c;
    border-color: #fecaca;
    background: #fff;
  }

  #wfmapmods-submission-edit .wfmapmods-modal-footer .wfmapmods-modal-btn-primary {
    min-width: 82px;
  }
}

/* Clickable “row with checkbox” helper */
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

/* Settings marker table + preview */
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
  width: var(--wfmapmods-thumb-size, 36px);
  height: var(--wfmapmods-thumb-size, 36px);
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

/* =============================================================================
   03) Inputs / placeholder styling
   ============================================================================= */

#wfmapmods-search-input::placeholder,
#wfmapmods-search-input:-ms-input-placeholder,
#wfmapmods-search-input::-ms-input-placeholder {
  color: #6b7280 !important;
}

/* =============================================================================
   04) Link blocks (Settings & POI function links)
   ============================================================================= */

.wfmapmods-link-block {
  display: flex;
  flex-wrap: wrap;
  gap: 0 4px;
  padding: 4px 0;
}

.wfmapmods-link-block.wfmapmods-link-block--spaced {
  gap: 0 8px; /* preserves wrap, increases horizontal gap */
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
   05) Wayspot detail overlay (dialog)
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
  max-width: 500px;
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

.wfmapmods-wayspot-overlay-body {
  flex: 1 1 auto;
  min-height: 0;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
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

.wfmapmods-wayspot-overlay-image-link {
  display: flex;
  margin-bottom: 0;
  text-align: center;
  justify-content: center;
}

.wfmapmods-wayspot-overlay-image-frame {
  position: relative;
  display: table;
  margin: 0 auto 8px;
  max-width: 100%;
}

.wfmapmods-wayspot-overlay-image {
  display: block;
  max-width: 100% !important;
  min-height: 300px;
  max-height: 60vh !important;
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
  max-height: 20vh;
  padding-right: 2px;
}

/* Overlay: carousel thumbnails */
.wfmapmods-wayspot-overlay-carousel {
  display: flex;
  gap: 8px;
  overflow-x: auto;
  padding: 8px 0;
  margin-bottom: 8px;
  height: 72px;
  flex-shrink: 0;
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
   06) Side panel (container + search + details)
   ============================================================================= */

.wfmapmods-map-host {
  position: relative;
}

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

/* Search input */
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

.wfmapmods-detail-address {
  font-size: 10px;
  color: #737373;
  margin-top: 2px;
  line-height: 1.25;
  text-align: center;
  overflow-wrap: anywhere;
}

.wfmapmods-detail-status {
  min-height: 18px;
  display: flex;
  justify-content: center;
  align-items: center;
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

/* Safari-safe status icon sizing + consistent spacing */
.wfmapmods-detail-status-row {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-wrap: nowrap;
  gap: 10px;
}

.wfmapmods-detail-poi-source,
.wfmapmods-detail-pgo-entity-logo,
.wfmapmods-detail-community-logo {
  width: 20px;
  height: 20px;

  /* Safari stability */
  min-width: 20px;
  min-height: 20px;
  flex: 0 0 20px;

  /* toggled visible via JS */
  display: none;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  box-sizing: content-box;
}

/* Kill intrinsic SVG sizing (Safari bug source) */
.wfmapmods-detail-poi-source svg,
.wfmapmods-detail-pgo-entity-logo svg,
.wfmapmods-detail-community-logo svg {
  width: 100% !important;
  height: 100% !important;
  max-width: 100% !important;
  max-height: 100% !important;
  display: block;
}

.wfmapmods-detail-poi-approval-date,
.wfmapmods-detail-poi-submitter {
  font-size: 11px;
  line-height: 1.05;
  color: #777;
  text-align: center;
  margin: 0;
  padding: 0;
  word-break: break-word;
}

.wfmapmods-detail-poi-approval-date {
  margin-top: 2px;
}

.wfmapmods-detail-poi-submitter {
  margin-top: 1px;
}

/* =============================================================================
   07) Status tags
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
   08) Info window (Wayfarer map)
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

/* Hide Google Maps default close button + chrome */
.gm-style-iw-chr .gm-ui-hover-effect {
  display: none !important;
}

.gm-style-iw-chr {
  height: 0 !important;
  padding: 0 !important;
  margin: 0 !important;
}

/* =============================================================================
   09) Icon menu controls (filters/layers/etc.)
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
.wfmapmods-filters-option,
.wfmapmods-layers-option {
  display: flex;
  align-items: center;
  gap: 6px;
  cursor: pointer;
}

.wfmapmods-filters-label,
.wfmapmods-layers-label {
  font-size: 11px;
  color: #111827;
}

.wfmapmods-filters-checkbox,
.wfmapmods-layers-checkbox {
  width: 14px;
  height: 14px;
}

/* =============================================================================
   10) Spinner (loading)
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
   11) Submit UI (images + fields + tables)
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

/* New “tile” approach (placeholder | pending | ready) */
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

.wfmapmods-submit-tile--placeholder {
  border: 1px dashed rgb(209, 213, 219);
  background: #fff;
  font-size: 24px;
  color: #9ca3af;
  cursor: pointer;
}

.wfmapmods-submit-tile--pending {
  border: 1px dashed rgb(209, 213, 219);
  background: #f9fafb;
}

.wfmapmods-submit-tile img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

/* Keep existing thumb class (used elsewhere) */
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

.wfmapmods-submit-thumb.is-clickable {
  cursor: pointer;
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

/* Legacy add box (kept, but grouped) */
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

.wfmapmods-submit-warning.is-visible {
  display: block;
}

#wfmapmods-submission-edit .wfmapmods-submit-textarea {
  min-height: 82px;
}

/* Mobile submission form refinements */
@media (max-width: 520px) {
  #wfmapmods-submission-edit .wfmapmods-submit-images {
    gap: 8px;
    margin-bottom: 2px;
  }

  #wfmapmods-submission-edit .wfmapmods-submit-imgblock {
    font-size: 10px;
  }

  #wfmapmods-submission-edit .wfmapmods-submit-imglabel {
    margin-bottom: 3px;
  }

  #wfmapmods-submission-edit .wfmapmods-submit-tile {
    width: 80px;
    height: 80px;
  }

  #wfmapmods-submission-edit .wfmapmods-submit-thumb {
    max-width: 80px;
    max-height: 80px;
  }

  #wfmapmods-submission-edit .wfmapmods-submit-edit-photo,
  #wfmapmods-submission-edit .wfmapmods-submit-changebtn {
    min-height: 28px;
    padding: 4px 8px;
    font-size: 11px;
  }

  #wfmapmods-submission-edit .wfmapmods-main-photo-aspect-warning {
    margin: 2px 0 0;
    font-size: 12px;
  }

  #wfmapmods-submission-edit .wfmapmods-submit-location {
    align-items: flex-start;
    justify-content: space-between;
    gap: 8px;
    padding: 8px;
    border: 1px solid #e5e7eb;
    border-radius: 8px;
    background: #fff;
  }

  #wfmapmods-submission-edit .wfmapmods-submit-location-label {
    padding-top: 4px;
  }

  #wfmapmods-submission-edit .wfmapmods-submit-location-right {
    flex: 1;
    justify-content: flex-end;
    flex-wrap: wrap;
  }

  #wfmapmods-submission-edit .wfmapmods-submit-location-value {
    font-size: 11px;
  }

  #wfmapmods-submission-edit .wfmapmods-submit-warning {
    font-size: 12px;
    line-height: 1.35;
    padding: 8px;
    border-radius: 8px;
    background: #fef2f2;
  }

  #wfmapmods-submission-edit .wfmapmods-submit-field {
    gap: 3px;
  }

  #wfmapmods-submission-edit .wfmapmods-submit-field label {
    font-size: 12px;
  }

  #wfmapmods-submission-edit .wfmapmods-submit-input,
  #wfmapmods-submission-edit .wfmapmods-submit-textarea {
    font-size: 16px; /* prevents iOS zoom-on-focus */
    padding: 8px 9px;
    border-radius: 7px;
  }

  #wfmapmods-submission-edit .wfmapmods-submit-textarea {
    min-height: 68px;
  }

  #wfmapmods-submission-edit .wfmapmods-submit-counter {
    font-size: 10px;
  }
}

/* Very short mobile screens */
@media (max-width: 520px) and (max-height: 680px) {
  #wfmapmods-submission-edit .wfmapmods-modal-dialog > div:first-child {
    padding-top: 7px;
    padding-bottom: 7px;
  }

  #wfmapmods-submission-edit .wfmapmods-submit-modal-body {
    padding: 8px 10px;
  }

  #wfmapmods-submission-edit .wfmapmods-submit-wrap {
    gap: 8px;
  }

  #wfmapmods-submission-edit .wfmapmods-submit-tile {
    width: 72px;
    height: 72px;
  }

  #wfmapmods-submission-edit .wfmapmods-submit-thumb {
    max-width: 72px;
    max-height: 72px;
  }

  #wfmapmods-submission-edit .wfmapmods-submit-textarea {
    min-height: 56px;
  }

  #wfmapmods-submission-edit .wfmapmods-modal-footer {
    padding-top: 8px;
    padding-bottom: max(8px, env(safe-area-inset-bottom));
  }

  #wfmapmods-submission-edit .wfmapmods-modal-footer .wfmapmods-modal-btn {
    min-height: 36px;
  }
}

/* =============================================================================
   12) Mobile confirm location bar
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
   13) Zoom hint (default UI tweak)
   ============================================================================= */

.zoom-hint-pill {
  pointer-events: auto !important;
  cursor: pointer !important;
}

/* =============================================================================
   14) PGO: inactive gym/pokestop slash overlay
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
   15) Progress bars (submit + report)
   ============================================================================= */

#wfmapmods-submit-progress,
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

#wfmapmods-submit-progress.is-hidden,
#wfmapmods-report-progress.is-hidden {
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
   16) Map context menu (right-click copy coords)
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
   17) Submission pin button + active toggle
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

  /* Let clicks pass through the SVG/wrapper */
  pointer-events: none;
}

/* SVG sizing */
.wf-submission-pin-control svg {
  width: 14px;
  height: auto;
  display: block;
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

.wfmapmods-modal-row--checkbox-left {
    display: flex;
    align-items: center;
    gap: 10px;
}

.wfmapmods-modal-row--checkbox-left input[type="checkbox"] {
    flex: 0 0 auto;
}

.wfmapmods-modal-row--checkbox-left label {
    flex: 1 1 auto;
    white-space: normal;
    min-width: 0; /* important so wrapping works in flex containers */
}

/* =============================================================================
   18) Gallery modal: grid + header sort
   ============================================================================= */

.wfmapmods-detail-multiple-photos {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  flex: 0 0 24px;
  box-sizing: content-box;
}

.wfmapmods-detail-multiple-photos-link {
  display: inline-flex;
  width: 24px;
  height: 24px;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  text-decoration: none;
}

.wfmapmods-detail-multiple-photos-link svg {
  width: 100%;
  height: 100%;
  display: block;
}

.wfmapmods-gallery-wrap {
  margin-top: 8px;
  padding-bottom: 14px;
}

.wfmapmods-gallery-loading {
  font-size: 12px;
  color: #374151;
  margin-bottom: 8px;
}

.wfmapmods-gallery-grid {
  --wfmapmods-gallery-tile-width: clamp(150px, calc((100vw - 88px) / 2), 266px);
  --wfmapmods-gallery-tile-height: calc(var(--wfmapmods-gallery-tile-width) * 200 / 266);

  display: grid;
  grid-template-columns: repeat(2, var(--wfmapmods-gallery-tile-width));
  gap: 10px;
  justify-content: center;
}

.wfmapmods-gallery-tile {
  position: relative;
  width: var(--wfmapmods-gallery-tile-width);
  height: var(--wfmapmods-gallery-tile-height);
  border: 0;
  border-radius: 12px;
  overflow: hidden;
  display: block;
  padding: 0;
  background: rgba(0,0,0,0.06);
  cursor: pointer;
  text-align: inherit;
  font: inherit;
}

.wfmapmods-gallery-tile img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

/* Gallery header sort control */
.wfmapmods-modal-header-controls {
  margin-left: auto;
  display: inline-flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
}

.wfmapmods-gallery-header-sort-controls {
  display: inline-flex;
  align-items: center;
  justify-content: flex-end;
}

.wfmapmods-gallery-sort-label {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  font-weight: 600;
  color: #374151;
  white-space: nowrap;
}

.wfmapmods-gallery-sort-select {
  min-width: 130px;
  height: 28px;
  padding: 2px 8px;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  background: #ffffff;
  color: #111827;
  font-size: 12px;
  font-weight: 600;
}

/* Mobile: sort wraps below title; grid remains two columns where practical. */
@media (max-width: 520px) {
  .wfmapmods-gallery-header-sort-controls {
    width: 100%;
  }

  .wfmapmods-gallery-sort-label {
    width: 100%;
  }

  .wfmapmods-gallery-sort-select {
    flex: 1;
    min-width: 0;
    max-width: 100%;
  }
}

/* Narrow phones: use more available width and shrink tiles further. */
@media (max-width: 410px) {
  #wfmapmods-gallery-backdrop .wfmapmods-modal-dialog {
    width: calc(100vw - 24px) !important;
    max-width: calc(100vw - 24px) !important;
    max-height: calc(100dvh - 24px) !important;
  }

  .wfmapmods-gallery-grid {
    --wfmapmods-gallery-tile-width: clamp(132px, calc((100vw - 88px) / 2), 266px);
    --wfmapmods-gallery-tile-height: calc(var(--wfmapmods-gallery-tile-width) * 200 / 266);

    grid-template-columns: repeat(2, var(--wfmapmods-gallery-tile-width));
  }
}

/* Very narrow phones: only then switch to one column. */
@media (max-width: 330px) {
  .wfmapmods-gallery-grid {
    --wfmapmods-gallery-tile-width: min(266px, calc(100vw - 48px));
    --wfmapmods-gallery-tile-height: calc(var(--wfmapmods-gallery-tile-width) * 200 / 266);

    grid-template-columns: var(--wfmapmods-gallery-tile-width);
  }
}

/* =============================================================================
   19) Fullscreen viewer inside gallery modal
   ============================================================================= */

.wfmapmods-gallery-fs {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.82);
  z-index: 2600;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  box-sizing: border-box;
}

.wfmapmods-gallery-fs-imglink {
  display: flex;
  align-items: center;
  justify-content: center;
  max-width: 100%;
  max-height: 100%;
}

.wfmapmods-gallery-fs-img {
  max-width: 92vw;
  max-height: 86vh;
  width: auto;
  height: auto;
  object-fit: contain;
  border-radius: 10px;
  background: #000;
  display: block;
}

.wfmapmods-gallery-fs-meta {
  position: absolute;
  top: 18px;
  left: 32px;
  z-index: 10003;
  color: #ffffff;
  font-size: 14px;
  font-weight: 600;
  line-height: 1.35;
  text-shadow: 0 1px 3px rgba(0, 0, 0, 0.85);
  pointer-events: none;
  max-width: calc(100vw - 120px);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: pre-line;
}

.wfmapmods-gallery-fs-close {
  position: absolute;
  top: 10px;
  right: 12px;
  width: 30px;
  height: 30px;
  font-size: 22px;
  color: #fff;
  border-color: rgba(255,255,255,0.35);
  background: rgba(0,0,0,0.25);
}

.wfmapmods-gallery-fs-nav {
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  width: 42px;
  height: 42px;
  border-radius: 9999px;
  border: 1px solid rgba(255,255,255,0.35);
  background: rgba(0,0,0,0.25);
  color: #fff;
  font-size: 28px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  user-select: none;
}

.wfmapmods-gallery-fs-left { left: 10px; }
.wfmapmods-gallery-fs-right { right: 10px; }

.wfmapmods-gallery-fs-counter {
  position: absolute;
  bottom: 10px;
  left: 50%;
  transform: translateX(-50%);
  color: #fff;
  font-size: 13px;
  background: rgba(0,0,0,0.35);
  border: 1px solid rgba(255,255,255,0.22);
  padding: 4px 10px;
  border-radius: 9999px;
}

/* =============================================================================
   20) Photo voting buttons
   ============================================================================= */

.wfmapmods-photo-vote-host {
  position: absolute;
  z-index: 3;
  right: 8px;
  bottom: 8px;
}

.wfmapmods-photo-vote-host--overlay {
  right: 10px;
  bottom: 10px;
}

.wfmapmods-photo-vote-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 4px;

  min-width: 42px;
  height: 24px;
  padding: 0 8px;

  border: 0;
  border-radius: 999px;
  background: rgba(32, 32, 32, 0.52);
  color: rgba(255, 255, 255, 0.86);

  font-size: 14px;
  font-weight: 700;
  line-height: 1;

  cursor: pointer;
  box-shadow: none;
  backdrop-filter: blur(1px);

  transition:
    background-color 120ms ease,
    color 120ms ease,
    transform 80ms ease,
    opacity 120ms ease;
}

.wfmapmods-photo-vote-badge:hover {
  background: rgba(20, 20, 20, 0.76);
  color: rgba(255, 255, 255, 0.94);
}

.wfmapmods-photo-vote-badge:active {
  transform: scale(0.97);
}

.wfmapmods-photo-vote-badge:disabled {
  cursor: wait;
  opacity: 0.75;
}

.wfmapmods-photo-vote-badge--voted {
  color: #ffffff;
}

.wfmapmods-photo-vote-badge--pending {
  opacity: 0.7;
}

.wfmapmods-photo-vote-count {
  min-width: 1ch;
  text-align: right;
}

.wfmapmods-photo-vote-icon {
  width: 15px;
  height: 15px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.wfmapmods-photo-vote-icon svg {
  width: 15px;
  height: 15px;
  display: block;
  fill: rgba(255, 255, 255, 0.62);
}

.wfmapmods-photo-vote-badge--voted .wfmapmods-photo-vote-icon svg {
  fill: #ffffff;
}

.wfmapmods-wayspot-overlay-image-frame {
  position: relative;
  display: table;
  margin: 0 auto;
  max-width: 100%;
}

.wfmapmods-photo-meta-overlay-label {
  position: absolute;
  z-index: 3;
  top: 8px;
  left: 8px;
  max-width: calc(100% - 16px);
  padding: 4px 8px;
  border-radius: 999px;
  background: rgba(32, 32, 32, 0.56);
  color: rgba(255, 255, 255, 0.94);
  font-size: 12px;
  font-weight: 650;
  line-height: 1.2;
  pointer-events: none;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.wfmapmods-photo-meta-overlay-label--overlay {
  top: 10px;
  left: 10px;
}

/* =============================================================================
   21) Canvas system
   ============================================================================= */

/* Canvas-rendered generic POI markers */
#wfmapmods-poi-canvas {
  display: block !important;
  visibility: visible !important;
  opacity: 1 !important;
  pointer-events: none !important;
  position: absolute !important;
  z-index: 950 !important;
}

/* Force pointer cursor while hovering a canvas-rendered marker */
.wfmapmods-canvas-marker-hover,
.wfmapmods-canvas-marker-hover * {
  cursor: pointer !important;
}

/* =============================================================================
   22) Photo editing system
   ============================================================================= */

/* Main submit modal: Edit photo button */
.wfmapmods-submit-edit-photo,
.wfmm-photo-edit-btn {
    margin-top: 6px;
    width: auto;
    min-width: 0;
    font-size: 11px;
    padding: 2px 6px;
    border-radius: 4px;
    border: 1px solid #d1d5db;
    background: #f9fafb;
    color: #111827;
    cursor: pointer;
    font: inherit;
    line-height: normal;
    box-shadow: none;
}

.wfmapmods-submit-edit-photo:hover,
.wfmm-photo-edit-btn:hover {
    background: #e5e7eb;
}

/* Main submit modal: non-square warning */
.wfmapmods-main-photo-aspect-warning {
    display: none;
    margin: 8px 0 2px 0;
    color: #b45309;
    font-size: 13px;
    line-height: 1.35;
}

.wfmapmods-main-photo-aspect-warning.is-visible {
    display: block;
}

/* Editor modal */
.wfmm-photo-editor-backdrop {
    position: fixed;
    inset: 0;
    z-index: 999999;
    background: rgba(0, 0, 0, 0.42);
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 12px;
    box-sizing: border-box;
    overflow: auto;
    overscroll-behavior: contain;
}

.wfmm-photo-editor {
    width: min(980px, 96vw);
    height: min(850px, calc(100vh - 24px));
    max-height: calc(100vh - 24px);
    background: #fff;
    color: #111827;
    border-radius: 10px;
    box-shadow: 0 18px 60px rgba(0, 0, 0, 0.35);
    display: flex;
    flex-direction: column;
    overflow: hidden;
    font-family: inherit;
}

@supports (height: 100dvh) {
    .wfmm-photo-editor {
        height: min(850px, calc(100dvh - 24px));
        max-height: calc(100dvh - 24px);
    }
}

@supports (height: 100svh) {
    .wfmm-photo-editor {
        height: min(850px, calc(100svh - 24px));
        max-height: calc(100svh - 24px);
    }
}

.wfmm-photo-editor-header {
    flex: 0 0 auto;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 12px 14px;
    border-bottom: 1px solid #e5e7eb;
    background: #fff;
}

.wfmm-photo-editor-title {
    font-weight: 700;
    font-size: 16px;
}

.wfmm-photo-editor-subtitle {
    color: #6b7280;
    font-size: 12px;
    margin-top: 2px;
}

.wfmm-photo-editor-body {
    flex: 1 1 auto;
    min-height: 0;
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding: 12px;
    background: #f9fafb;
    overflow: auto;
    overscroll-behavior: contain;
}

.wfmm-photo-editor-toolbar {
    flex: 0 0 auto;
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px;
    padding: 8px;
    background: #fff;
    border: 1px solid #e5e7eb;
    border-radius: 8px;
}

.wfmm-photo-editor-guide-row {
    margin-left: auto;
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 10px;
    font-size: 12px;
    color: #374151;
}

.wfmm-photo-editor-guide-row label {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    white-space: nowrap;
}

.wfmm-photo-editor-guide-row input:disabled + span,
.wfmm-photo-editor-guide-row label:has(input:disabled) {
    opacity: 0.55;
    cursor: not-allowed;
}

.wfmm-photo-editor-canvas-wrap {
    flex: 1 1 auto;
    min-height: 220px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: #eef2f7;
    border: 1px solid #e5e7eb;
    border-radius: 8px;
    overflow: hidden;
    touch-action: none;
}

#wfmm-photo-editor-canvas {
    width: 100%;
    height: 100%;
    cursor: default;
    touch-action: none;
}

#wfmm-photo-editor-canvas.is-dragging {
    cursor: grabbing;
}

.wfmm-photo-editor-loading {
    flex: 1 1 auto;
    min-height: 220px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: #eef2f7;
    border: 1px solid #e5e7eb;
    border-radius: 8px;
    color: #4b5563;
    font-size: 14px;
}

.wfmm-photo-editor-loading-inner {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
}

.wfmm-photo-editor-loading-title {
    font-weight: 600;
    color: #111827;
}

.wfmm-photo-editor-loading-detail {
    font-size: 12px;
    color: #6b7280;
}

.wfmm-photo-editor-footer {
    flex: 0 0 auto;
    position: sticky;
    bottom: 0;
    z-index: 2;
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 16px;
    padding: 12px 14px;
    border-top: 1px solid #e5e7eb;
    background: #fff;
}

.wfmm-photo-editor-footer > div:first-child {
    min-width: 0;
    flex: 1;
}

.wfmm-photo-editor-footer > div:last-child {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 10px;
    white-space: nowrap;
    flex-shrink: 0;
}

.wfmm-photo-editor-output {
    font-size: 12px;
    color: #6b7280;
    line-height: 1.35;
}

.wfmm-photo-editor-warning {
    color: #b45309;
    font-size: 12px;
    line-height: 1.35;
    margin-top: 2px;
}

.wfmm-photo-editor button {
    appearance: none;
    border: 1px solid #d1d5db;
    border-radius: 6px;
    padding: 7px 10px;
    margin: 0;
    font: inherit;
    font-size: 12px;
    line-height: 1.2;
    cursor: pointer;
    background: #fff;
    color: #111827;
    box-shadow: none;
}

.wfmm-photo-editor button:hover {
    background: #f3f4f6;
}

.wfmm-photo-editor button.primary {
    background: #2563eb;
    border-color: #2563eb;
    color: #fff;
}

.wfmm-photo-editor button.primary:hover {
    background: #1d4ed8;
}

.wfmm-photo-editor button.is-active {
    background: #dbeafe;
    border-color: #2563eb;
    color: #1d4ed8;
}

.wfmm-photo-editor button.danger {
    color: #b91c1c;
    border-color: #fecaca;
}

.wfmm-photo-editor button.danger:hover {
    background: #fef2f2;
}

/* Mobile layout */
@media (max-width: 760px) {
    .wfmm-photo-editor-backdrop {
        align-items: stretch;
        justify-content: stretch;
        padding: 0;
    }

    .wfmm-photo-editor {
        width: 100vw;
        height: 100vh;
        max-height: 100vh;
        border-radius: 0;
    }

    @supports (height: 100dvh) {
        .wfmm-photo-editor {
            height: 100dvh;
            max-height: 100dvh;
        }
    }

    @supports (height: 100svh) {
        .wfmm-photo-editor {
            height: 100svh;
            max-height: 100svh;
        }
    }

    .wfmm-photo-editor-header {
        padding: 9px 10px;
    }

    .wfmm-photo-editor-title {
        font-size: 15px;
    }

    .wfmm-photo-editor-subtitle {
        font-size: 11px;
        line-height: 1.25;
    }

    .wfmm-photo-editor-body {
        gap: 8px;
        padding: 8px;
    }

    .wfmm-photo-editor-toolbar {
        gap: 6px;
        padding: 6px;
    }

    .wfmm-photo-editor-guide-row {
        margin-left: 0;
        width: 100%;
        gap: 6px 10px;
    }

    .wfmm-photo-editor-canvas-wrap,
    .wfmm-photo-editor-loading {
        min-height: 180px;
    }

    .wfmm-photo-editor-footer {
        padding: 9px 10px;
        gap: 8px;
    }

    .wfmm-photo-editor-footer > div:first-child {
        display: none;
    }

    .wfmm-photo-editor-footer > div:last-child {
        width: 100%;
        justify-content: space-between;
    }

    .wfmm-photo-editor-footer button {
        flex: 1;
        min-height: 38px;
    }
}

/* Very short screens, including some mobile browsers with visible browser chrome */
@media (max-height: 620px) {
    .wfmm-photo-editor-header {
        padding-top: 7px;
        padding-bottom: 7px;
    }

    .wfmm-photo-editor-subtitle {
        display: none;
    }

    .wfmm-photo-editor-body {
        padding: 6px;
        gap: 6px;
    }

    .wfmm-photo-editor-toolbar {
        padding: 6px;
        gap: 5px;
    }

    .wfmm-photo-editor-canvas-wrap,
    .wfmm-photo-editor-loading {
        min-height: 150px;
    }

    .wfmm-photo-editor-footer {
        padding-top: 7px;
        padding-bottom: 7px;
    }
}
`;


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
   Mapview UI Overrides
   ============================================================================= */

/* Hide top controls bar */
.top-controls {
  display: none !important;
}

/* Hide map legend */
app-map-legend {
  display: none !important;
}

/* Hide map controls */
app-map-controls {
  display: none !important;
}

/* Hide POI detail panel */
app-poi-detail-panel {
  display: none !important;
}

/* Hide default Wayspots canvas */
canvas#deckgl-overlay {
  display: none !important;
}

/* Hide Google’s built-in blue geolocation dot */
.gm-style img[src*="rgba(22%2C%20188%2C%20240%2C%200.4)"][src*="%230096ff"] {
  display: none !important;
}

/* Draft marker title labels */
.wfmapmods-draft-marker-label {
  position: absolute;
  white-space: nowrap;
  font-size: 14px;
  font-weight: bold;
  color: rgba(255, 241, 0, 0.9);
  text-shadow:
    0 0 2px #000000,
    0 0 4px #000000,
    -1px -1px 2px #000000,
    1px 1px 2px #000000;
  pointer-events: none;
  transform: translate(-50%, 0);
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

    function applyHideZoomTextCss() {
        const enabled = !!userSettings?.map?.hideZoomText;
        let styleEl = document.getElementById("wfmapmods-hide-zoom-text-style");

        if (enabled) {
            if (!styleEl) {
                styleEl = document.createElement("style");
                styleEl.id = "wfmapmods-hide-zoom-text-style";
                document.head.appendChild(styleEl);
            }

            styleEl.textContent = `
            ${ZOOM_HINT_HIDE_SELECTOR} {
                display: none !important;
            }
        `;
        } else {
            if (styleEl) styleEl.remove();
        }
    }

    // ==================================
    // Bootstrap & event wiring
    // ==================================

    function init() {
        const coordsFromUrl = parseDeepLinkFromLocation();
        if (coordsFromUrl) {
            deepLinkTarget = coordsFromUrl;
            skipRestoreMapViewForThisLoad = true;
            localStorage.setItem('wf_map_nav', '1');
        }

        loadSettings();
        injectCss();
        applyCssForCurrentRoute();
        applyHideZoomTextCss();
        createBridges();
        setupMapRouteWatcher();
    }
    init();

})();