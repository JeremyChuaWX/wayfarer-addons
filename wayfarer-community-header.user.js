// ==UserScript==
// @name         Wayfarer Community Header Layout
// @version      1.2.9
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
    gap: 2px;
    line-height: 1;
  }

  .wayfarer-flag-switcher a {
    display: block;
    text-decoration: none !important;
    font-size: 18px;
    line-height: 1;
    padding: 0;
    margin: 0;
  }

  .wayfarer-flag-switcher a:hover {
    transform: scale(1.08);
  }

  @media (max-width: 800px) {
    html,
    body {
      max-width: 100vw !important;
      overflow-x: hidden !important;
    }

    header.d-header,
    header.d-header .wrap,
    header.d-header .contents {
      max-width: 100vw !important;
      min-width: 0 !important;
      overflow-x: clip !important;
    }

    header.d-header .contents {
      display: flex !important;
      align-items: center !important;
      gap: 0.15rem !important;
    }

    header.d-header .home-logo-wrapper-outlet {
      display: flex !important;
      visibility: visible !important;
      opacity: 1 !important;
      flex: 0 1 38px !important;
      min-width: 34px !important;
      max-width: 38px !important;
      overflow: visible !important;
    }

    header.d-header .title,
    header.d-header .title a {
      display: flex !important;
      visibility: visible !important;
      opacity: 1 !important;
      width: auto !important;
      min-width: 0 !important;
      overflow: visible !important;
    }

    header.d-header #site-logo.logo-mobile {
      display: block !important;
      visibility: visible !important;
      opacity: 1 !important;
      width: auto !important;
      max-width: 38px !important;
      height: auto !important;
    }

    header.d-header .before-header-panel-outlet {
      flex: 1 1 auto !important;
      min-width: 0 !important;
      overflow: hidden !important;
    }

    header.d-header .custom-header-links {
      display: flex !important;
      align-items: center !important;
      gap: 0.25rem !important;
      min-width: 0 !important;
      max-width: 100% !important;
      overflow: hidden !important;
    }

    header.d-header .custom-header-links li {
      min-width: 0 !important;
      flex: 0 1 auto !important;
    }

    header.d-header .help-center-custom-header-links,
    header.d-header .help-center-custom-header-links.headerLink--keep,
    header.d-header .help-center-custom-header-links.headerLink--vdm,
    header.d-header .help-center-custom-header-links.headerLink--en {
      display: none !important;
      visibility: hidden !important;
      width: 0 !important;
      max-width: 0 !important;
      overflow: hidden !important;
    }

    header.d-header.wayfarer-logged-out .reporting-abuse-custom-header-links,
    header.d-header.wayfarer-logged-out .wayspot-removals-custom-header-links {
      display: none !important;
      visibility: hidden !important;
      width: 0 !important;
      max-width: 0 !important;
      overflow: hidden !important;
    }

    header.d-header.wayfarer-logged-in .reporting-abuse-custom-header-links,
    header.d-header.wayfarer-logged-in .wayspot-removals-custom-header-links {
      display: list-item !important;
      visibility: visible !important;
      width: auto !important;
      max-width: 4.1rem !important;
      overflow: hidden !important;
    }

    header.d-header .custom-header-links li a {
      display: inline-flex !important;
      align-items: center !important;
      justify-content: center !important;
      text-align: center !important;
      white-space: normal !important;
      line-height: 1.05 !important;
      font-size: 0.86rem !important;
      max-width: 4.1rem !important;
      padding: 0 0.08rem !important;
      box-sizing: border-box !important;
    }

    header.d-header .wayfarer-flag-switcher a {
      font-size: 16px !important;
      line-height: 1 !important;
      margin: 0 !important;
      padding: 0 !important;
      max-width: none !important;
    }

    header.d-header .panel {
      flex: 0 0 auto !important;
      min-width: 0 !important;
      overflow: visible !important;
    }

    header.d-header .d-header-icons {
      display: flex !important;
      align-items: center !important;
      gap: 0 !important;
      margin: 0 !important;
      padding: 0 !important;
    }

    header.d-header .d-header-icons li {
      margin: 0 !important;
      padding: 0 !important;
    }

    header.d-header.wayfarer-logged-in .btn-icon {
      padding: 0.2rem !important;
    }

    header.d-header.wayfarer-logged-in .d-header-icons svg,
    header.d-header.wayfarer-logged-in .d-header-icons img.avatar {
      transform: scale(0.95);
      transform-origin: center;
    }

    header.d-header.wayfarer-logged-in .header-dropdown-toggle button {
      display: flex;
      align-items: center;
      justify-content: center;
    }
  }
`;
        document.documentElement.appendChild(style);
    }

    function isLoggedOut(header) {
        return !![...header.querySelectorAll("button, a")].find(
            (el) => el.textContent.trim().toLowerCase() === "log in"
        );
    }

    function tweakHeader() {
        const header = document.querySelector("header.d-header");
        if (!header) return;

        const loggedOut = isLoggedOut(header);
        header.classList.toggle("wayfarer-logged-out", loggedOut);
        header.classList.toggle("wayfarer-logged-in", !loggedOut);

        header
            .querySelectorAll(".wayfarer-custom-header-links")
            .forEach((el) => el.remove());

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

        const reporting = header.querySelector(".reporting-abuse-custom-header-links");
        const removals = header.querySelector(".wayspot-removals-custom-header-links");

        [reporting, removals].forEach((el) => {
            if (!el) return;
            el.classList.remove("headerLink--vdo");
            el.classList.add("headerLink--keep");
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