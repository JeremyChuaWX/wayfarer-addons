// ==UserScript==
// @name         Wayfarer Persistent Help Chat
// @version      1.1.0
// @description  Makes the Help Chat button always visible
// @namespace    https://gitlab.com/Tntnnbltn/wayfarer-addons
// @downloadURL  https://gitlab.com/Tntnnbltn/wayfarer-addons/-/raw/main/wayfarer-persistent-help-chat.user.js
// @updateURL    https://gitlab.com/Tntnnbltn/wayfarer-addons/-/raw/main/wayfarer-persistent-help-chat.user.js
// @homepageURL  https://gitlab.com/Tntnnbltn/wayfarer-addons
// @match        https://wayfarer.scopely.com/*
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

(() => {
  function runInPageContext(fn) {
    const script = document.createElement("script");
    script.textContent = `(${fn})();`;
    document.documentElement.appendChild(script);
    script.remove();
  }

  runInPageContext(() => {
    const MARKER_ID = "helpshift-script";
    const HS_SCRIPT_ID = "hs-chat";
    const HS_SCRIPT_SRC = "https://webchat.helpshift.com/latest/webChat.js";
    const PROPERTIES_URL = "/api/v1/vault/properties";

    // Fallback only. Normally these values are obtained from Wayfarer's
    // authenticated properties response so future Helpshift migrations do
    // not require another userscript update.
    const FALLBACK_HELP_SHIFT_WEB_CHAT = {
      domain: "scopelyexplore",
      platformId: "scopelyexplore_platform_20260629224850348-2d29204ff805eac"
    };

    function ensureMarker() {
      if (document.getElementById(MARKER_ID)) return;

      const marker = document.createElement("script");
      marker.id = MARKER_ID;
      marker.type = "application/json";
      marker.textContent = JSON.stringify({
        injectedBy: "userscript",
        purpose: "Prevent duplicate native Helpshift bootstrap"
      });

      (document.head || document.documentElement).appendChild(marker);
    }

    function getWayfarerLanguage() {
      const raw =
        document.documentElement.getAttribute("lang") ||
        navigator.language ||
        "en";
      const normalised = raw.replace("-", "_");

      if (normalised === "zh_TW") return "zh-hant";

      return normalised.substring(0, 2);
    }

    async function getHelpShiftWebChat() {
      try {
        const response = await fetch(PROPERTIES_URL, {
          credentials: "same-origin"
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const data = await response.json();
        const helpShiftWebChat = data?.result?.helpShiftWebChat;

        if (!helpShiftWebChat?.domain || !helpShiftWebChat?.platformId) {
          throw new Error("helpShiftWebChat config missing from properties response");
        }

        return helpShiftWebChat;
      } catch (error) {
        console.warn(
          "[Wayfarer Helpshift userscript] Could not read current Helpshift config; using fallback.",
          error
        );
        return FALLBACK_HELP_SHIFT_WEB_CHAT;
      }
    }

    function ensureHelpshiftQueue() {
      if (typeof window.Helpshift === "function") return;

      const queued = function () {
        queued.q.push(arguments);
      };

      queued.q = [];
      window.Helpshift = queued;
    }

    function setHelpshiftConfig(helpShiftWebChat) {
      window.helpshiftConfig = {
        ...(window.helpshiftConfig || {}),
        platformId: helpShiftWebChat.platformId,
        domain: helpShiftWebChat.domain,
        language: getWayfarerLanguage(),

        widgetOptions: {
          ...((window.helpshiftConfig && window.helpshiftConfig.widgetOptions) || {}),
          showLauncher: true,
          position: "bottom-right"
        }
      };
    }

    async function loadOrUpdateHelpshift() {
      ensureMarker();

      const helpShiftWebChat = await getHelpShiftWebChat();
      setHelpshiftConfig(helpShiftWebChat);
      ensureHelpshiftQueue();

      const existingScript = document.getElementById(HS_SCRIPT_ID);
      if (existingScript) {
        if (typeof window.Helpshift === "function") {
          window.Helpshift("update");
        }
        return;
      }

      const hsScript = document.createElement("script");
      hsScript.id = HS_SCRIPT_ID;
      hsScript.async = true;
      hsScript.src = HS_SCRIPT_SRC;

      hsScript.addEventListener("load", () => {
        if (typeof window.Helpshift === "function") {
          window.Helpshift("init");
        }
      });

      hsScript.addEventListener("error", () => {
        console.error("[Wayfarer Helpshift userscript] Failed to load Helpshift webChat.js");
      });

      (document.head || document.documentElement).appendChild(hsScript);
    }

    // Reserve Wayfarer's native marker immediately so it does not initialise
    // a second Helpshift instance while we obtain the current configuration.
    ensureMarker();

    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", loadOrUpdateHelpshift, { once: true });
    } else {
      loadOrUpdateHelpshift();
    }
  });
})();
