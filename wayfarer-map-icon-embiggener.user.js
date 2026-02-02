// ==UserScript==
// @name         Wayfarer Map Icon Embiggener
// @version      1.0.1
// @description  Makes the map icon in the sidebar not awkwardly smaller than the rest of the icons
// @namespace    https://gitlab.com/Tntnnbltn/wayfarer-addons
// @downloadURL  https://gitlab.com/Tntnnbltn/wayfarer-addons/-/raw/main/wayfarer-map-icon-embiggener.user.js
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


(function () {
  'use strict';

  const SCALE = 1.13;

  const css = `
    img.sidebar-link__icon[src="/img/map-outlined-24px.svg"] {
      transform: scale(${SCALE});
      transform-origin: center;
    }
  `;

  function injectStyle(text) {
    const style = document.createElement('style');
    style.textContent = text;
    document.documentElement.appendChild(style);
  }

  injectStyle(css);

})();