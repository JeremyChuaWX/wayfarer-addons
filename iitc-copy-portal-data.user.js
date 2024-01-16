// ==UserScript==
// @name IITC Plugin: Copy Lightship Data
// @id lightshipCopyData
// @category Info
// @version 0.0.1
// @namespace    https://gitlab.com/Tntnnbltn/wayfarer-addons
// @downloadURL  https://gitlab.com/Tntnnbltn/wayfarer-addons/-/raw/main/iitc-copy-portal-data.user.js
// @updateURL    https://gitlab.com/Tntnnbltn/wayfarer-addons/-/raw/main/iitc-copy-portal-data.user.js
// @homepageURL  https://gitlab.com/Tntnnbltn/wayfarer-addons
// @description Copies portal data from IITC in the format of a JSON string
// @include https://intel.ingress.com/*
// @match https://intel.ingress.com/*
// @grant none
// ==/UserScript==

function wrapper(plugin_info) {

    // Make sure that window.plugin exists. IITC defines it as a no-op function,
    // and other plugins assume the same.
    if (typeof window.plugin !== "function") window.plugin = function () {};

    window.plugin.PortalOpenInGame = function () {};
    const thisPlugin = window.plugin.lightshipCopyData;

    // Name of the IITC build for first-party plugins
    plugin_info.buildName = "lightshipCopyData";

    // Datetime-derived version of the plugin
    plugin_info.dateTimeVersion = "202401162348";

    // ID/name of the plugin
    plugin_info.pluginId = "lightshipCopyData";

    const setup = function() {
        window.addHook('portalDetailsUpdated', function(data) {
            const guid = data.guid;
            const title = data.portalData.title
            const lat = data.portalData.latE6 / 1000000;
            const lng = data.portalData.lngE6 / 1000000;

            const jsonObject = {
                guid: guid,
                title: title,
                lat: lat,
                lng: lng
            };

            const jsonString = JSON.stringify(jsonObject);

            const link = document.createElement('a');
            link.textContent = 'Copy Portal Data';
            link.addEventListener('click', function(e) {
                navigator.clipboard.writeText(jsonString);
            });
            
            const div = document.createElement('div');
            div.appendChild(link);
            const aside = document.createElement('aside');
            aside.appendChild(div);
            $("div.linkdetails").append(aside);
        });
    }
    setup.info = plugin_info;
    if (window.iitcLoaded) {
        setup();
    } else {
        if (!window.bootPlugins) {
            window.bootPlugins = [];
        }
        window.bootPlugins.push(setup);
    }
}

(function () {
    const plugin_info = {};
    if (typeof GM_info !== 'undefined' && GM_info && GM_info.script) {
        plugin_info.script = {
            version: GM_info.script.version,
            name: GM_info.script.name,
            description: GM_info.script.description
        };
    }
    // Greasemonkey. It will be quite hard to debug
    if (typeof unsafeWindow != 'undefined' || typeof GM_info == 'undefined' || GM_info.scriptHandler != 'Tampermonkey') {
        // inject code into site context
        const script = document.createElement('script');
        script.appendChild(document.createTextNode('(' + wrapper + ')(' + JSON.stringify(plugin_info) + ');'));
        (document.body || document.head || document.documentElement).appendChild(script);
    } else {
        // Tampermonkey, run code directly
        wrapper(plugin_info);
    }
})();
