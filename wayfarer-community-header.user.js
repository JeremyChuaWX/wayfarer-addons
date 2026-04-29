// ==UserScript==
// @name         Wayfarer Community Header Layout
// @version      1.2.13
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

    const STYLE_ID = "wayfarer-header-tweaks-style";

    function isMobile() {
        return (
            window.matchMedia("(max-width: 800px)").matches ||
            window.innerWidth <= 800 ||
            (window.visualViewport && window.visualViewport.width <= 800)
        );
    }

    function isLoggedIn(header) {
        return !!header.querySelector(
            "#current-user, #toggle-current-user, .current-user, .user-menu-panel"
        );
    }

    function setImportant(el, property, value) {
        el.style.setProperty(property, value, "important");
    }

    function clearInlineVisibility(el) {
        el.style.removeProperty("display");
        el.style.removeProperty("visibility");
        el.style.removeProperty("width");
        el.style.removeProperty("max-width");
        el.style.removeProperty("overflow");
    }

    function ensureStyles() {
        let style = document.getElementById(STYLE_ID);

        if (!style) {
            style = document.createElement("style");
            style.id = STYLE_ID;
            document.head.appendChild(style);
        }

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

      header.d-header.wf-mobile,
      header.d-header.wf-mobile .wrap,
      header.d-header.wf-mobile .contents {
        max-width: 100vw !important;
        min-width: 0 !important;
        overflow-x: clip !important;
      }

      header.d-header.wf-mobile .contents {
        display: flex !important;
        align-items: center !important;
        gap: 0.15rem !important;
      }

      header.d-header.wf-mobile .home-logo-wrapper-outlet {
        display: flex !important;
        visibility: visible !important;
        opacity: 1 !important;
        flex: 0 1 38px !important;
        min-width: 34px !important;
        max-width: 38px !important;
        overflow: visible !important;
      }

      header.d-header.wf-mobile .title,
      header.d-header.wf-mobile .title a {
        display: flex !important;
        visibility: visible !important;
        opacity: 1 !important;
        width: auto !important;
        min-width: 0 !important;
        overflow: visible !important;
      }

      header.d-header.wf-mobile #site-logo.logo-mobile {
        display: block !important;
        visibility: visible !important;
        opacity: 1 !important;
        width: auto !important;
        max-width: 38px !important;
        height: auto !important;
      }

      header.d-header.wf-mobile .before-header-panel-outlet {
        flex: 1 1 auto !important;
        min-width: 0 !important;
        overflow: hidden !important;
      }

      header.d-header.wf-mobile .custom-header-links {
        display: flex !important;
        align-items: center !important;
        gap: 0.25rem !important;
        min-width: 0 !important;
        max-width: 100% !important;
        overflow: hidden !important;
      }

      header.d-header.wf-mobile .custom-header-links li {
        min-width: 0 !important;
        flex: 0 1 auto !important;
      }

      header.d-header.wf-mobile .custom-header-links li a {
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

      header.d-header.wf-mobile .wayfarer-flag-switcher a {
        font-size: 16px !important;
        line-height: 1 !important;
        margin: 0 !important;
        padding: 0 !important;
        max-width: none !important;
      }

      header.d-header.wf-mobile .panel {
        flex: 0 0 auto !important;
        min-width: 0 !important;
        overflow: visible !important;
      }

      header.d-header.wf-mobile .d-header-icons {
        display: flex !important;
        align-items: center !important;
        gap: 0 !important;
        margin: 0 !important;
        padding: 0 !important;
      }

      header.d-header.wf-mobile .d-header-icons li {
        margin: 0 !important;
        padding: 0 !important;
      }

      header.d-header.wf-mobile.wayfarer-logged-in .btn-icon {
        padding: 0.2rem !important;
      }

      header.d-header.wf-mobile.wayfarer-logged-in .d-header-icons svg,
      header.d-header.wf-mobile.wayfarer-logged-in .d-header-icons img.avatar {
        transform: scale(0.95);
        transform-origin: center;
      }

      header.d-header.wf-mobile.wayfarer-logged-in .header-dropdown-toggle button {
        display: flex;
        align-items: center;
        justify-content: center;
      }
    `;
    }

    function replaceJapaneseLink(header) {
        const japaneseLinkItem =
              header.querySelector(".日本コミュニティ-custom-header-links") ||
              [...header.querySelectorAll(".custom-header-links li")].find((li) =>
                                                                           li.textContent.includes("日本コミュニティ")
                                                                          );

        if (!japaneseLinkItem) return;

        if (!japaneseLinkItem.classList.contains("wayfarer-flags-applied")) {
            japaneseLinkItem.classList.add("wayfarer-flags-applied");
            japaneseLinkItem.innerHTML = `
        <span class="wayfarer-flag-switcher" aria-label="Community language links">
          <a href="${HOME_URL}" title="English Community" aria-label="English Community">🇺🇸</a>
          <a href="${JP_URL}" title="日本コミュニティ" aria-label="日本コミュニティ">🇯🇵</a>
        </span>
      `;
        }
    }

    function applyLinkVisibility(header, mobile, loggedIn) {
        const help = header.querySelector(".help-center-custom-header-links");
        const reporting = header.querySelector(".reporting-abuse-custom-header-links");
        const removals = header.querySelector(".wayspot-removals-custom-header-links");

        [help, reporting, removals].forEach((el) => {
            if (!el) return;
            el.classList.remove("headerLink--vdo");
            el.classList.add("headerLink--keep");
            clearInlineVisibility(el);
        });

        if (mobile) {
            if (help) {
                setImportant(help, "display", "none");
                setImportant(help, "visibility", "hidden");
                setImportant(help, "width", "0");
                setImportant(help, "max-width", "0");
                setImportant(help, "overflow", "hidden");
            }

            if (!loggedIn) {
                [reporting, removals].forEach((el) => {
                    if (!el) return;
                    setImportant(el, "display", "none");
                    setImportant(el, "visibility", "hidden");
                    setImportant(el, "width", "0");
                    setImportant(el, "max-width", "0");
                    setImportant(el, "overflow", "hidden");
                });
            } else {
                [reporting, removals].forEach((el) => {
                    if (!el) return;
                    setImportant(el, "display", "list-item");
                    setImportant(el, "visibility", "visible");
                    setImportant(el, "max-width", "4.1rem");
                    setImportant(el, "overflow", "hidden");
                });
            }
        } else {
            [help, reporting, removals].forEach((el) => {
                if (!el) return;
                setImportant(el, "display", "list-item");
                setImportant(el, "visibility", "visible");
                el.style.removeProperty("width");
                el.style.removeProperty("max-width");
                el.style.removeProperty("overflow");
            });
        }
    }

    let scheduled = false;

    function scheduleTweak() {
        if (scheduled) return;
        scheduled = true;

        requestAnimationFrame(() => {
            scheduled = false;
            tweakHeader();
        });
    }

    function tweakHeader() {
        ensureStyles();

        const header = document.querySelector("header.d-header");
        if (!header) return;

        const mobile = isMobile();
        const loggedIn = isLoggedIn(header);

        header.classList.toggle("wf-mobile", mobile);
        header.classList.toggle("wf-desktop", !mobile);
        header.classList.toggle("wayfarer-logged-in", loggedIn);
        header.classList.toggle("wayfarer-logged-out", !loggedIn);

        header
            .querySelectorAll(".wayfarer-custom-header-links")
            .forEach((el) => el.remove());

        replaceJapaneseLink(header);
        applyLinkVisibility(header, mobile, loggedIn);
    }

    function start() {
        ensureStyles();
        tweakHeader();

        const observer = new MutationObserver(scheduleTweak);
        observer.observe(document.documentElement, {
            childList: true,
            subtree: true,
            attributes: true,
            attributeFilter: ["class", "style"],
        });

        window.addEventListener("resize", scheduleTweak);
        window.addEventListener("orientationchange", scheduleTweak);
        window.addEventListener("pageshow", scheduleTweak);
        window.addEventListener("popstate", scheduleTweak);

        if (window.visualViewport) {
            window.visualViewport.addEventListener("resize", scheduleTweak);
        }

        document.addEventListener("visibilitychange", scheduleTweak);

        setTimeout(scheduleTweak, 250);
        setTimeout(scheduleTweak, 750);
        setTimeout(scheduleTweak, 1500);
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", start);
    } else {
        start();
    }
})();