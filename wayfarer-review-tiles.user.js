// ==UserScript==
// @name         Wayfarer Review Map Tiles
// @version      0.0.3
// @namespace    https://gitlab.com/tntnnbltn/wayfarer-addons
// @downloadURL  https://gitlab.com/tntnnbltn/wayfarer-addons/raw/main/wayfarer-review-tiles.user.js
// @homepageURL  https://gitlab.com/tntnnbltn/wayfarer-addons
// @description  Add Map Mods to Wayfarer Review Page
// @match        https://wayfarer.nianticlabs.com/*
// ==/UserScript==

/* eslint-env es6 */
/* eslint no-var: "error" */

function init() {
    let candidate;
    let map;

    let pano = null;
    let listenSVFocus = false;

    /**
     * Overwrite the open method of the XMLHttpRequest.prototype to intercept the server calls
     */
    (function(open) {
        XMLHttpRequest.prototype.open = function(method, url) {
            if (url == "/api/v1/vault/review" && method == "GET") {
                this.addEventListener('load', parseCandidate, false);
            } else if (url == "/api/v1/vault/review" && method == "POST") {
                if (pano) {
                    // Street View panorama must be unloaded to avoid it remaining alive in the background
                    // after each review is submitted. The additional photospheres pile up in browser memory
                    // and either slow down the browser, or crash the tab entirely. This was the root cause
                    // behind why reviews would slow down and eventually crash Firefox before Street View was
                    // removed by default in Wayfarer 5.2.
                    pano.setVisible(false);
                    pano = null;
                }
            }
            open.apply(this, arguments);
        };
    })(XMLHttpRequest.prototype.open);

    function parseCandidate(e) {
        try {
            const response = this.response;
            const json = JSON.parse(response);
            if (!json) {
                console.warn('Failed to parse response from Wayfarer');
                return;
            }
            // ignore if it's related to captchas
            if (json.captcha) {
                return;
            }

            candidate = json.result;
            if (!candidate) {
                console.warn('Wayfarer\'s response didn\'t include a candidate.');
                return;
            }
            checkPageType();

        } catch (e) {
            console.log(e); // eslint-disable-line no-console
        }
    }

    function checkPageType() {
        awaitElement(() => (
            document.getElementById('check-duplicates-card') ||
            document.querySelector('app-review-edit')
        )).then(ref => {
            addMapMods();
        })
    };

    function addMapMods() {
        let gmap;
        let mapCtx;

        awaitElement(() =>
                     document.querySelector("nia-map")
                    )
            .then((ref) => {
            gmap = ref;
            mapCtx = gmap.__ngContext__[gmap.__ngContext__.length - 1];

            // Sometimes map wasn't being set. This makes it work.
            const setMapInterval = setInterval(() => {
                map = mapCtx.componentRef.map;
                if (map) {
                    clearInterval(setMapInterval);
                    addMapLayers();
                }
            }, 100);
        })
            .catch(() => {
            return;
        });
    }

    function addMapLayers() {
        // Initialize mapTypeControlOptions here
        let mapTypeControlOptions = {
            style: google.maps.MapTypeControlStyle.DROPDOWN_MENU,
            position: google.maps.ControlPosition.TOP_LEFT,
            mapTypeIds: ['roadmap', 'satellite'],
        };

        mapTypeControlOptions = setupMapLayer(mapTypeControlOptions, "Bing", 19, 0, "https://t0.tiles.virtualearth.net/tiles/a{quadKey}.jpeg?g=1398");
        mapTypeControlOptions = setupMapLayer(mapTypeControlOptions, "Esri", 19, 0, "https://wayback.maptiles.arcgis.com/arcgis/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}");
        mapTypeControlOptions = setupMapLayer(mapTypeControlOptions, "Esri Clarity", 19, 0, "https://clarity.maptiles.arcgis.com/arcgis/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}");
        mapTypeControlOptions = setupMapLayer(mapTypeControlOptions, "OSM", 20, 0, "https://tile.openstreetmap.org/{z}/{x}/{y}.png");

        map.setOptions({
            mapTypeControlOptions: mapTypeControlOptions,
            mapTypeControl: true,
        });
    }

    function setupMapLayer(mapTypeControlOptions, name, maxZoom, minZoom, url, isBing = false) {
        const mapType = new google.maps.ImageMapType({
            getTileUrl: function (coord, zoom) {
                const normalizedCoord = getNormalizedCoord(coord, zoom);

                if (!normalizedCoord) {
                    return "";
                }

                if (name === "Bing") {
                    // For Bing Maps, use the quadkey
                    const quadKey = getBingMapsQuadKey(coord.x, coord.y, zoom);
                    return url.replace('{quadKey}', quadKey);
                } else {
                    // For other layers, replace the placeholders normally
                    return url
                        .replace('{z}', zoom)
                        .replace('{x}', normalizedCoord.x)
                        .replace('{y}', normalizedCoord.y);
                }
            },
            tileSize: new google.maps.Size(256, 256),
            maxZoom: maxZoom,
            minZoom: minZoom,
            radius: 1738000,
            name: name,
        });

        if (!mapTypeControlOptions.mapTypeIds.includes(name)) {
            mapTypeControlOptions.mapTypeIds.push(name);
        }

        map.mapTypes.set(name, mapType);

        return mapTypeControlOptions;
    }

    // Function to convert Google Maps Tile coordinates to Bing Maps QuadKey
    function getBingMapsQuadKey(x, y, z) {
        let quadKey = "";
        for (let i = z; i > 0; i--) {
            let digit = 0;
            const mask = 1 << (i - 1);
            if ((x & mask) != 0) digit += 1;
            if ((y & mask) != 0) digit += 2;
            quadKey += digit;
        }
        return quadKey;
    }

    // Normalizes the coords that tiles repeat across the x axis (horizontally)
    // like the standard Google map tiles.
    function getNormalizedCoord(coord, zoom) {
        const y = coord.y;
        let x = coord.x;
        // tile range in one direction range is dependent on zoom level
        // 0 = 1 tile, 1 = 2 tiles, 2 = 4 tiles, 3 = 8 tiles, etc
        const tileRange = 1 << zoom;

        // don't repeat across y-axis (vertically)
        if (y < 0 || y >= tileRange) {
            return null;
        }

        // repeat across x-axis
        if (x < 0 || x >= tileRange) {
            x = ((x % tileRange) + tileRange) % tileRange;
        }
        return { x: x, y: y };
    }

    //    window.initMap = initMap;


    const awaitElement = get => new Promise((resolve, reject) => {
        let triesLeft = 10;
        const queryLoop = () => {
            const ref = get();
            if (ref) resolve(ref);
            else if (!triesLeft) reject();
            else setTimeout(queryLoop, 100);
            triesLeft--;
        }
        queryLoop();
    });

    function insertAfter(newNode, referenceNode) {
        referenceNode.parentNode.insertBefore(newNode, referenceNode.nextSibling);
    };

}

init();
