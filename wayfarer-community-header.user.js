// ==UserScript==
// @name         Wayfarer Community Header Layout
// @version      1.2.0
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
        gap: 0;
        line-height: 0.8;
      }

      .wayfarer-flag-switcher a {
        display: block;
        text-decoration: none !important;
        font-size: 18px;
        line-height: 0.8;
        padding: 0;
        margin: -1px 0;
      }

      .wayfarer-flag-switcher a:hover {
        transform: scale(1.08);
      }

      @media (max-width: 767px) {
        header.d-header .contents {
          display: flex !important;
          align-items: center !important;
          gap: clamp(0.25rem, 1.1vw, 0.55rem);
        }

        header.d-header .before-header-panel-outlet {
          flex: 1 1 auto !important;
          min-width: 0 !important;
        }

        header.d-header .custom-header-links {
          display: flex !important;
          align-items: center !important;
          justify-content: flex-start !important;
          gap: clamp(0.35rem, 1.6vw, 0.8rem);
          min-width: 0 !important;
          max-width: 100% !important;
          overflow: hidden !important;
          white-space: normal !important;
        }

        header.d-header .custom-header-links li {
          display: flex !important;
          align-items: center !important;
          justify-content: center !important;
          min-width: 0 !important;
          flex: 0 1 auto !important;
          visibility: visible !important;
        }

        header.d-header .custom-header-links li a {
          display: block !important;
          font-size: clamp(0.66rem, 2.35vw, 1rem) !important;
          line-height: 1.05 !important;
          white-space: normal !important;
          text-align: center !important;
          word-break: normal !important;
          overflow-wrap: normal !important;
          padding: 0 !important;
        }

        header.d-header .help-center-custom-header-links,
        header.d-header .reporting-abuse-custom-header-links,
        header.d-header .wayspot-removals-custom-header-links {
          flex: 1 1 0 !important;
        }

        header.d-header .reporting-abuse-custom-header-links,
        header.d-header .wayspot-removals-custom-header-links {
          display: flex !important;
          visibility: visible !important;
        }

        header.d-header .wayfarer-flag-link {
          flex: 0 0 auto !important;
        }

        header.d-header .wayfarer-flag-switcher a {
          font-size: clamp(14px, 3.3vw, 18px) !important;
          line-height: 0.75 !important;
          margin: -2px 0 !important;
        }

        header.d-header .panel {
          flex: 0 0 auto !important;
        }

        header.d-header .d-header-icons {
          gap: 0 !important;
        }

        header.d-header #search-button,
        header.d-header #toggle-hamburger-menu,
        header.d-header #toggle-current-user {
          padding-left: clamp(0.15rem, 0.8vw, 0.4rem) !important;
          padding-right: clamp(0.15rem, 0.8vw, 0.4rem) !important;
        }
      }

      @media (max-width: 430px) {
        header.d-header .custom-header-links {
          gap: 0.32rem !important;
        }

        header.d-header .custom-header-links li a {
          font-size: clamp(0.58rem, 2.6vw, 0.82rem) !important;
          line-height: 1.02 !important;
        }
      }
    `;

    document.documentElement.appendChild(style);
  }

  function tweakHeader() {
    const header = document.querySelector("header.d-header");
    if (!header) return;

    header
      .querySelectorAll(".wayfarer-custom-header-links")
      .forEach((el) => el.remove());

    const japaneseLinkItem =
      header.querySelector(".日本コミュニティ-custom-header-links") ||
      [...header.querySelectorAll(".custom-header-links li")].find((li) =>
        li.textContent.includes("日本コミュニティ")
      );

    if (japaneseLinkItem && !japaneseLinkItem.classList.contains("wayfarer-flags-applied")) {
      japaneseLinkItem.classList.add("wayfarer-flags-applied", "wayfarer-flag-link");
      japaneseLinkItem.innerHTML = `
        <span class="wayfarer-flag-switcher" aria-label="Community language links">
          <a href="${HOME_URL}" title="English Community" aria-label="English Community">🇺🇸</a>
          <a href="${JP_URL}" title="日本コミュニティ" aria-label="日本コミュニティ">🇯🇵</a>
        </span>
      `;
    }

    const links = header.querySelector(".custom-header-links");
    if (!links) return;

    ensureLink(
      links,
      "reporting-abuse-custom-header-links",
      "Reporting Abuse",
      "https://niantic.helpshift.com/hc/en/21-wayfarer/faq/2190-reporting-abuse-in-wayfarer/?l=en&p=web"
    );

    ensureLink(
      links,
      "wayspot-removals-custom-header-links",
      "Wayspot Removals",
      "https://niantic.helpshift.com/hc/en/21-wayfarer/faq/4212-reporting-a-wayspot/?l=en&p=web"
    );

    [".help-center-custom-header-links", ".reporting-abuse-custom-header-links", ".wayspot-removals-custom-header-links"].forEach(
      (selector) => {
        const item = header.querySelector(selector);
        if (!item) return;

        item.classList.remove("headerLink--vdo");
        item.classList.add("headerLink--keep");
        item.style.display = "";
        item.style.visibility = "";
      }
    );
  }

  function ensureLink(parent, className, text, href) {
    let item = parent.querySelector(`.${className}`);

    if (!item) {
      item = document.createElement("li");
      item.className = `headerLink headerLink--en headerLink--keep ${className}`;
      item.innerHTML = `<a title="${text}" href="${href}" target="_blank">${text}</a>`;
      parent.appendChild(item);
    }

    const a = item.querySelector("a");
    if (a) {
      a.textContent = text;
      a.title = text;
      a.href = href;
      a.target = "_blank";
    }
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