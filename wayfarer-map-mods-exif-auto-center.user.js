// ==UserScript==
// @name         Wayfarer Map Mods - Exif Auto-Center
// @version      0.3.0
// @author       Tntnnbltn (fork maintained by JeremyChuaWX)
// @description  Retired: Wayfarer now moves the nomination map to the main photo's location by itself.
// @namespace    https://github.com/JeremyChuaWX/wayfarer-addons
// @downloadURL  https://jeremychuawx.github.io/wayfarer-addons/wayfarer-map-mods-exif-auto-center.user.js
// @updateURL    https://jeremychuawx.github.io/wayfarer-addons/wayfarer-map-mods-exif-auto-center.user.js
// @homepageURL  https://jeremychuawx.github.io/wayfarer-addons/guides/wayfarer-map-mods-exif-auto-center.html
// @supportURL   https://github.com/JeremyChuaWX/wayfarer-addons/issues
// @match        https://wayfarer.scopely.com/*
// @run-at       document-idle
// @grant        none
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
// directory of this script's GitHub repository:
// <https://gitlab.com/Tntnnbltn/wayfarer-addons/-/blob/main/LICENSE>
// If not, see <https://www.gnu.org/licenses/>.

// Retired in version 0.3.0.
//
// Wayfarer's rebuilt nomination page (/submit/new) now does this add-on's job
// itself: when you choose the primary photo it reads the photo's GPS location
// and moves the map and the location pin there. Running this add-on as well
// would only move the map a second time, so it no longer does anything.
//
// The previous version (0.2.2) only worked on the old /new/submit/new page,
// which no longer exists. This update just stops it loading the EXIF library
// on every Wayfarer page. You can safely remove the add-on from Tampermonkey.
