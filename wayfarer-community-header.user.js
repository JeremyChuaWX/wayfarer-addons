// ==UserScript==
// @name         Wayfarer Community Header Layout
// @version      1.2.1
// @description  Changes the header links on Wayfarer Community Forum
// @namespace    https://gitlab.com/Tntnnbltn/wayfarer-addons
// @downloadURL  https://gitlab.com/Tntnnbltn/wayfarer-addons/-/raw/main/wayfarer-community-header.user.js
// @updateURL    https://gitlab.com/Tntnnbltn/wayfarer-addons/-/raw/main/wayfarer-community-header.user.js
// @homepageURL  https://gitlab.com/Tntnnbltn/wayfarer-addons
// @match        https://community.wayfarer.nianticlabs.com/*
// @run-at       document-start
// @grant        none
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

  const HOME_URL = "https://community.wayfarer.nianticlabs.com/";
  const JP_URL = "https://community.wayfarer.nianticlabs.com/c/japan/56";

  function addStyles() {
    if (document.getElementById("wayfarer-header-tweaks-style")) return;

    const style = document.createElement("style");
    style.id = "wayfarer-header-tweaks-style";
    style.textContent = `
      .wayfarer-flag-switcher {
        display: inline-flex !important;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 0;              /* remove extra spacing */
        line-height: 0.8;    /* tighten emoji line box */
      }

      .wayfarer-flag-switcher a {
        display: block;
        text-decoration: none !important;
        font-size: 18px;
        line-height: 0.8;    /* reduces vertical whitespace */
        padding: 0;
        margin: -1px 0;      /* slight overlap for tighter stack */
      }

      .wayfarer-flag-switcher a:hover {
        transform: scale(1.08);
      }

      @media (max-width: 767px) {
        .custom-header-links {
          display: flex !important;
          align-items: center;
          gap: 0.55rem;
        }

        .custom-header-links .reporting-abuse-custom-header-links,
        .custom-header-links .wayspot-removals-custom-header-links {
          display: list-item !important;
          visibility: visible !important;
        }

        .custom-header-links .reporting-abuse-custom-header-links a,
        .custom-header-links .wayspot-removals-custom-header-links a {
          display: inline-block !important;
          font-size: 0.78rem;
          white-space: nowrap;
        }

        .wayfarer-flag-switcher a {
          font-size: 16px;
        }
      }
    `;

    document.documentElement.appendChild(style);
  }

  function tweakHeader() {
    const header = document.querySelector("header.d-header");
    if (!header) return;

    // Remove the external "Wayfarer" text link.
    header
      .querySelectorAll(".wayfarer-custom-header-links")
      .forEach((el) => el.remove());

    // Replace the Japanese community text link with stacked US/JP flags.
    const japaneseLinkItem =
      header.querySelector(".日本コミュニティ-custom-header-links") ||
      [...header.querySelectorAll(".custom-header-links li")].find((li) =>
        li.textContent.includes("日本コミュニティ")
      );

    if (japaneseLinkItem && !japaneseLinkItem.classList.contains("wayfarer-flags-applied")) {
      japaneseLinkItem.classList.add("wayfarer-flags-applied");
      japaneseLinkItem.innerHTML = `
        <span class="wayfarer-flag-switcher" aria-label="Community language links">
          <a href="${HOME_URL}" title="English Community" aria-label="English Community">🇺🇸</a>
          <a href="${JP_URL}" title="日本コミュニティ" aria-label="日本コミュニティ">🇯🇵</a>
        </span>
      `;
    }

    // Ensure these desktop links are visible on mobile too.
    const reporting = header.querySelector(".reporting-abuse-custom-header-links");
    const removals = header.querySelector(".wayspot-removals-custom-header-links");

    [reporting, removals].forEach((el) => {
      if (!el) return;
      el.classList.remove("headerLink--vdo");
      el.classList.add("headerLink--keep");
      el.style.display = "";
      el.style.visibility = "";
    });
  }

  function start() {
    addStyles();
    tweakHeader();

    const observer = new MutationObserver(() => tweakHeader());

    observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start);
  } else {
    start();
  }
})();