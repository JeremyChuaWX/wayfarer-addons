// ==UserScript==
// @name         Mission Creator Exporter
// @description  Exports search results from Mission Creator as a csv
// @namespace    https://gitlab.com/Tntnnbltn/wayfarer-addons
// @downloadURL  https://gitlab.com/Tntnnbltn/wayfarer-addons/-/raw/main/mission-exporter.user.js
// @homepageURL  https://gitlab.com/Tntnnbltn/wayfarer-addons
// @version      0.1.0
// @match        https://missions.ingress.com/*
// ==/UserScript==

/* eslint-env es6 */
/* eslint no-var: "error" */

function init() {
	if (typeof window.plugin !== 'function') window.plugin = function () { };

    // Use own namespace for plugin
    if (typeof window.plugin.umm !== 'function') window.plugin.umm = function () { };

    let thisPlugin = window.plugin.imcstwo;

	'use strict';
	let portals = {};
	let overlay;
    let portalList = [];
    let exportButton;
    let resetButton;

	(function (open) {
		XMLHttpRequest.prototype.open = function (method, url) {
			if (method == 'POST') {
				if (url == '/api/author/getClusterDetails' ||
					url == '/api/author/searchPOIs') {
					this.addEventListener('load', parseCluster, false);
				}
			}
			open.apply(this, arguments);
		};
	})(XMLHttpRequest.prototype.open);

	function parseCluster() {
		const response = this.response;
		const json = JSON.parse(response);
		if (!json) {
			console.log("failed to parse response")
			return;
		}
		// ignore if it's related to captchas
		if (json.captcha) {
			return;
        }

		const cluster = json;

        cluster.pois.forEach(p => {
            // Check each element is a portal, and that it hasn't already been added. If so, add it to the list.
            if (p.type === "PORTAL" && !portalList.find(log => log.guid === p.guid)) {
                portalList.push(p);
            }
        });

        updateButtons();
	}

    function exportPortalListToCsv() {
        // Add headers to the CSV string
        let csvString = "guid,title,description,lat,lng,image,intel link,geospatial link\n";

        // Convert the data to a CSV string
        csvString += portalList.map(d => `${d.guid},${JSON.stringify(d.title).replace("#", "")},${JSON.stringify(d.description).replace("#", "")},${d.location.latitude},${d.location.longitude},${d.imageUrl},https://intel.ingress.com/intel?pll=${d.location.latitude}%2c${d.location.longitude},https://lightship.dev/account/geospatial-browser/${d.location.latitude}%2C${d.location.longitude}%2C14%2C%2C${d.guid}`).join("\n");

        // Create a link element and trigger a click event to download the file
        const link = document.createElement("a");
        link.href = "data:text/csv;charset=utf-8," + encodeURI(csvString);
        link.download = "MissionPortals.csv";
        link.click();
    }

    function updateButtons() {
        // Check if the export button already exists
        const existingExportButton = document.querySelector('.footer .pull-left .export');
        if (existingExportButton) {
            // Remove the existing export button
            existingExportButton.remove();
        }

        // Check if the reset button already exists
        const existingResetButton = document.querySelector('.footer .pull-left .reset');
        if (existingResetButton) {
            // Remove the existing reset button
            existingResetButton.remove();
        }

        // Get the Live Missions button
        const liveMissionsButton = document.querySelector('.footer .pull-left .big');

        // Create the Export button
        const exportButton = document.createElement('button');
        exportButton.className = 'export';
        exportButton.innerHTML = `Export ${portalList.length}`;
        exportButton.style = "margin-left:20px;";
        exportButton.addEventListener('click', exportPortalListToCsv);

        // Create Reset button
        const resetButton = document.createElement('button');
        resetButton.className = 'reset';
        resetButton.innerHTML = `Reset`;
        resetButton.style = "margin-left:20px;";
        resetButton.addEventListener('click', resetPortalList);

        // Insert the Export button after the Live Missions button
        liveMissionsButton.insertAdjacentElement('afterend', exportButton);

        // Insert the Reset button after the Export button
        exportButton.insertAdjacentElement('afterend', resetButton);
    }

    function resetPortalList() {
        portalList.length = 0;
        updateButtons()
    }

}

init();
