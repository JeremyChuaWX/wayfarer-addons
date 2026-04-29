// ==UserScript==
// @name         Niantic Wayfarer Header Tweaks
// @namespace    https://community.wayfarer.nianticlabs.com/
// @version      1.1.0
// @description  Replace Japanese forum text link with US/JP flags, remove Wayfarer link, and show extra links on mobile.
// @match        https://community.wayfarer.nianticlabs.com/*
// @grant        none
// @run-at       document-start
// ==/UserScript==

(function () {
  "use strict";

  const HOME_URL = "https://community.wayfarer.nianticlabs.com/";
  const JP_URL = "https://community.wayfarer.nianticlabs.com/c/japan/56";

  function addStyles() {
    if (document.getElementById("wayfarer-header-tweaks-style")) return;

    const style = document.createElement("style");
    style.id = "wayfarer-header-tweaks-style";
    style.textContent = `
      /* ===== FLAG STACK ===== */
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

      /* ===== MOBILE FIXES ===== */
      @media (max-width: 767px) {
        header.d-header .contents {
          display: flex !important;
          align-items: center;
          width: 100%;
          overflow: hidden !important;
        }

        .before-header-panel-outlet {
          flex: 1 1 auto !important;
          min-width: 0 !important;
          overflow: visible !important;
        }

        .custom-header-links {
          display: flex !important;
          align-items: center;
          flex-wrap: wrap !important;
          gap: 0.15rem 0.45rem;
          max-width: 100%;
          overflow: visible !important;
        }

        .custom-header-links li {
          flex: 0 1 auto;
          max-width: 4.8rem;
          text-align: center;
        }

        .custom-header-links li a {
          display: inline-block !important;
          font-size: 0.82rem !important;
          line-height: 1.05 !important;
          white-space: normal !important;
          text-align: center;
        }

        /* Force desktop-only links to show on mobile */
        .custom-header-links .reporting-abuse-custom-header-links,
        .custom-header-links .wayspot-removals-custom-header-links {
          display: list-item !important;
          visibility: visible !important;
        }

        .panel {
          flex: 0 0 auto !important;
        }

        .icons.d-header-icons {
          display: flex !important;
          align-items: center;
          gap: 0.15rem;
        }

        .wayfarer-flag-switcher {
          width: 1.5rem;
        }

        .wayfarer-flag-switcher a {
          font-size: 15px;
          line-height: 0.75;
          margin: -2px 0;
        }
      }
    `;

    document.documentElement.appendChild(style);
  }

  function tweakHeader() {
    const header = document.querySelector("header.d-header");
    if (!header) return;

    // Remove "Wayfarer" link
    header
      .querySelectorAll(".wayfarer-custom-header-links")
      .forEach((el) => el.remove());

    // Replace Japanese link with flags
    const japaneseLinkItem =
      header.querySelector(".日本コミュニティ-custom-header-links") ||
      [...header.querySelectorAll(".custom-header-links li")].find((li) =>
        li.textContent.includes("日本コミュニティ")
      );

    if (japaneseLinkItem && !japaneseLinkItem.classList.contains("wayfarer-flags-applied")) {
      japaneseLinkItem.classList.add("wayfarer-flags-applied");
      japaneseLinkItem.innerHTML = `
        <span class="wayfarer-flag-switcher">
          <a href="${HOME_URL}" title="English Community">🇺🇸</a>
          <a href="${JP_URL}" title="日本コミュニティ">🇯🇵</a>
        </span>
      `;
    }

    // Ensure mobile visibility for extra links
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