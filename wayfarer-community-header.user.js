// ==UserScript==
// @name         Wayfarer Community Header Layout
// @version      1.2.18
// @author       Tntnnbltn (fork maintained by JeremyChuaWX)
// @description  Changes the header links on Wayfarer Community Forum
// @namespace    https://github.com/JeremyChuaWX/wayfarer-addons
// @downloadURL  https://jeremychuawx.github.io/wayfarer-addons/wayfarer-community-header.user.js
// @updateURL    https://jeremychuawx.github.io/wayfarer-addons/wayfarer-community-header.user.js
// @homepageURL  https://jeremychuawx.github.io/wayfarer-addons/guides/wayfarer-community-header.html
// @supportURL   https://github.com/JeremyChuaWX/wayfarer-addons/issues
// @match        https://community.wayfarer.scopely.com/*
// @run-at       document-start
// @grant        none
// ==/UserScript==

// Modified by JeremyChuaWX, 2026-11 — see https://github.com/JeremyChuaWX/wayfarer-addons/commits/main

(function () {
  "use strict";

  const HOME_URL = "https://community.wayfarer.scopely.com/";
  const JP_URL = "https://community.wayfarer.scopely.com/c/japan/56";
  const STYLE_ID = "wayfarer-header-tweaks-style";

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
        gap: 0;
        line-height: 0.78;
      }

      .wayfarer-flag-switcher a {
        display: block;
        text-decoration: none !important;
        font-size: 18px;
        line-height: 0.78;
        padding: 4px 0 !important;
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

      header.d-header.wf-mobile .wayfarer-flag-switcher {
        gap: 4px !important;
        line-height: 1 !important;
      }

      header.d-header.wf-mobile .wayfarer-flag-switcher a {
        font-size: 16px !important;
        line-height: 1 !important;
        margin: 0 !important;
        padding: 1px 0 !important;
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

  function isMobileHeader(header) {
    return !!header.querySelector("#site-logo.logo-mobile");
  }

  function isLoggedIn(header) {
    return !!header.querySelector(
      "#current-user, #toggle-current-user, .current-user, .user-menu-panel"
    );
  }

  function hide(el) {
    if (!el) return;
    el.style.setProperty("display", "none", "important");
    el.style.setProperty("visibility", "hidden", "important");
    el.style.setProperty("width", "0", "important");
    el.style.setProperty("max-width", "0", "important");
    el.style.setProperty("overflow", "hidden", "important");
  }

  function show(el) {
    if (!el) return;
    el.classList.remove("headerLink--vdo");
    el.classList.add("headerLink--keep");
    el.style.setProperty("display", "list-item", "important");
    el.style.setProperty("visibility", "visible", "important");
    el.style.removeProperty("width");
    el.style.removeProperty("max-width");
    el.style.removeProperty("overflow");
  }

  function showMobileCompact(el) {
    if (!el) return;
    el.classList.remove("headerLink--vdo");
    el.classList.add("headerLink--keep");
    el.style.setProperty("display", "list-item", "important");
    el.style.setProperty("visibility", "visible", "important");
    el.style.setProperty("max-width", "4.1rem", "important");
    el.style.setProperty("overflow", "hidden", "important");
  }

  function replaceJapaneseLink(header) {
    const japaneseLinkItem =
      header.querySelector(".日本コミュニティ-custom-header-links") ||
      [...header.querySelectorAll(".custom-header-links li")].find((li) =>
        li.textContent.includes("日本コミュニティ")
      );

    if (!japaneseLinkItem || japaneseLinkItem.classList.contains("wayfarer-flags-applied")) return;

    japaneseLinkItem.classList.add("wayfarer-flags-applied");
    japaneseLinkItem.innerHTML = `
      <span class="wayfarer-flag-switcher" aria-label="Community language links">
        <a href="${HOME_URL}" title="English Community" aria-label="English Community">🇺🇸</a>
        <a href="${JP_URL}" title="日本コミュニティ" aria-label="日本コミュニティ">🇯🇵</a>
      </span>
    `;
  }

  function tweakHeader() {
    ensureStyles();

    const header = document.querySelector("header.d-header");
    if (!header) return;

    const mobile = isMobileHeader(header);
    const loggedIn = isLoggedIn(header);

    header.classList.toggle("wf-mobile", mobile);
    header.classList.toggle("wf-desktop", !mobile);
    header.classList.toggle("wayfarer-logged-in", loggedIn);
    header.classList.toggle("wayfarer-logged-out", !loggedIn);

    header.querySelectorAll(".wayfarer-custom-header-links").forEach((el) => el.remove());

    replaceJapaneseLink(header);

    const help = header.querySelector(".help-center-custom-header-links");
    const reporting = header.querySelector(".reporting-abuse-custom-header-links");
    const removals = header.querySelector(".wayspot-removals-custom-header-links");

    if (!mobile) {
      show(help);
      show(reporting);
      show(removals);
      return;
    }

    hide(help);

    if (loggedIn) {
      showMobileCompact(reporting);
      showMobileCompact(removals);
    } else {
      hide(reporting);
      hide(removals);
    }
  }

  let scheduled = false;
  let observer = null;

  function scheduleTweak() {
    if (scheduled) return;

    scheduled = true;

    requestAnimationFrame(() => {
      scheduled = false;
      tweakHeader();
      // Discard mutation records caused by tweakHeader itself (style text,
      // classList, inline styles) so the observer does not re-trigger every frame.
      if (observer) observer.takeRecords();
    });
  }

  function start() {
    ensureStyles();
    tweakHeader();

    observer = new MutationObserver(scheduleTweak);
    observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["class", "style", "src"],
    });

    window.addEventListener("resize", scheduleTweak);
    window.addEventListener("orientationchange", scheduleTweak);
    window.addEventListener("pageshow", scheduleTweak);
    document.addEventListener("visibilitychange", scheduleTweak);

    setTimeout(scheduleTweak, 250);
    setTimeout(scheduleTweak, 750);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start);
  } else {
    start();
  }
})();