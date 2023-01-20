// ==UserScript==
// @name IITC Plugin: Open in Prime
// @id portalOpenInGame
// @category Info
// @version 0.1.6
// @downloadURL https://varden.info/~m/iitc/iitc-open-prime.user.js
// @updateURL https://varden.info/~m/iitc/iitc-open-prime.user.js
// @description Adds a QR code that opens Ingress Prime to the selected portal.
// @author Marius Lindvall
// @require https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js
// @include https://intel.ingress.com/*
// @match https://intel.ingress.com/*
// @grant none
// ==/UserScript==

function wrapper(plugin_info) {

    // Make sure that window.plugin exists. IITC defines it as a no-op function,
    // and other plugins assume the same.
    if (typeof window.plugin !== "function") window.plugin = function () {};

    window.plugin.PortalOpenInGame = function () {};
    const thisPlugin = window.plugin.PortalOpenInGame;

    // Name of the IITC build for first-party plugins
    plugin_info.buildName = "PortalOpenInGame";

    // Datetime-derived version of the plugin
    plugin_info.dateTimeVersion = "202203152054";

    // ID/name of the plugin
    plugin_info.pluginId = "portalopeningame";

    const setup = function() {
        window.addHook('portalDetailsUpdated', function(data) {
            const guid = data.guid;
            const lat = data.portalData.latE6 / 1000000;
            const lng = data.portalData.lngE6 / 1000000;
            const url = `https://link.ingress.com/?link=https%3a%2f%2fintel.ingress.com%2Fportal%2f${guid}&apn=com.nianticproject.ingress&isi=576505181&ibi=com.google.ingress&ifl=https%3a%2f%2fapps.apple.com%2fapp%2fingress%2fid576505181&ofl=https%3a%2f%2fintel.ingress.com%2fintel%3fpll%3d${lat}%2c${lng}`;

            const link = document.createElement('a');
            link.textContent = 'Open in Prime';
            link.addEventListener('click', function(e) {
                if (window.isSmartphone()) {
                    window.open(url);
                } else {
                    const container = dialog({
                        width: 'auto',
                        html: '<div style="background-color:#fff; padding: 10px;"><div class="prime-qrcode" style="width: 512px; height: 512px;"></div></div>',
                        title: 'Open in Ingress Prime',
                        buttons: {
                            'Copy to clipboard': function() {
                                navigator.clipboard.writeText(url);
                                container.dialog('close');
                            }
                        }
                    });

                    const div = container[0];
                    const codebox = div.querySelector('.prime-qrcode');
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
