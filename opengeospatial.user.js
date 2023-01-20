// ==UserScript==
// @name IITC Plugin: Open in Geospatial Browser
// @id geospatialOpenInGame
// @category Info
// @version 0.1
// @downloadURL https://gitlab.com/Tntnnbltn/wayfarer-addons/-/raw/main/opengeospatial.user.js
// @updateURL https://gitlab.com/Tntnnbltn/wayfarer-addons/-/raw/main/opengeospatial.user.js
// @description Adds a QR code that opens Geospatial Browser to the selected portal.
// @author Marius Lindvall - Modified by Tntnnbltn
// @require https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js
// @include https://intel.ingress.com/*
// @match https://intel.ingress.com/*
// @grant none
// ==/UserScript==

function wrapper(plugin_info) {

    // Make sure that window.plugin exists. IITC defines it as a no-op function,
    // and other plugins assume the same.
    if (typeof window.plugin !== "function") window.plugin = function () {};

    window.plugin.GeospatialOpenInGame = function () {};
    const thisPlugin = window.plugin.GeospatialOpenInGame;

    // Name of the IITC build for first-party plugins
    plugin_info.buildName = "GeospatialOpenInGame";

    // Datetime-derived version of the plugin
    plugin_info.dateTimeVersion = "202301202054";

    // ID/name of the plugin
    plugin_info.pluginId = "geospatialopeningame";

    const setup = function() {
        window.addHook('portalDetailsUpdated', function(data) {
            const guid = data.guid;
            const lat = data.portalData.latE6 / 1000000;
            const lng = data.portalData.lngE6 / 1000000;
            const url = `https://lightship.dev/account/geospatial-browser/${lat},${lng},16,,${guid}`;
            const link = document.createElement('a');
            link.textContent = 'Open in Geospatial';
            link.addEventListener('click', function(e) {
                if (window.isSmartphone()) {
                    window.open(url);
                } else {
                    window.open(url)
                    });

                    const div = container[0];
                    const codebox = div.querySelector('.geospatial-qrcode');
                    new QRCode(codebox, {
                        text: url,
                        width: 512,
                        height: 512,
                    });
                }
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
