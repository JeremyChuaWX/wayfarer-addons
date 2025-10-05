// ==UserScript==
// @name         Wayfarer Duplicate Map Tracker
// @version      0.0.1
// @description  Collects data from the Wayfarer Duplicates Map and tracks new and modified Wayspots
// @namespace    https://github.com/tehstone/wayfarer-addons/
// @downloadURL  https://github.com/tehstone/wayfarer-addons/
// @homepageURL  https://github.com/tehstone/wayfarer-addons/
// @match        https://wayfarer.nianticlabs.com/*
// @require      https://cdn.jsdelivr.net/chartist.js/latest/chartist.min.js
// @resource     CT_CSS https://cdn.jsdelivr.net/chartist.js/latest/chartist.min.css
// @grant        GM_getResourceText
// ==/UserScript==

// Copyright 2025 Tntnnbltn

// This script is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.

// This script is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU General Public License for more details.

// You can find a copy of the GNU General Public License in the root
// directory of this script's GitHub repository:
// <https://github.com/tehstone/wayfarer-addons/blob/main/LICENSE>
// If not, see <https://www.gnu.org/licenses/>.

/* eslint-env es6 */
/* eslint no-var: "error" */


(() => {
    let userHash = 0;
    const OBJECT_STORE_NAME = 'duplicateHistory';

    // Overwrite the open method of the XMLHttpRequest.prototype to intercept the server calls
    (function (open) {
        XMLHttpRequest.prototype.open = function(method, url) {
            const args = this;
            if (url == '/api/v1/vault/review' && method == 'GET') {
                this.addEventListener('load', handleXHRResult(handleIncomingReview), false);
            }
            open.apply(this, arguments);
        };
    })(XMLHttpRequest.prototype.open);

    // Perform validation on result to ensure the request was successful before it's processed further.
    // If validation passes, passes the result to callback function.
    const handleXHRResult = callback => function(e) {
        try {
            const response = this.response;
            const json = JSON.parse(response);
            if (!json) return;
            if (json.captcha) return;
            if (!json.result) return;
            callback(json.result, e);
        } catch (err) {
            console.error(err);
        }
    };

    const handleIncomingReview = result => new Promise((resolve, reject) => {

        if (!result.nearbyPortals || !Array.isArray(result.nearbyPortals) || result.nearbyPortals.length === 0) {
            return reject("No nearby portals to store.");
        }

        getIDBInstance().then(db => {
            const tx = db.transaction(["duplicateHistory"], "readwrite");
            const objectStore = tx.objectStore("duplicateHistory");

            let newWayspots = [];
            let updatedCount = 0;

            let updatedSummaries = [];

            const processPortal = (portal, done) => {
                const getRequest = objectStore.get(portal.guid);
                getRequest.onsuccess = () => {
                    const existing = getRequest.result;
                    let dataToStore;

                    if (existing) {
                        let changed = false;
                        const changes = [];     // ← track just‐now diffs
                        dataToStore = { ...existing };

                        if (existing.imageUrl !== portal.imageUrl) {
                            changes.push(`${portal.title} has a new photo`);
                            dataToStore._oldImageUrl = existing.imageUrl;
                            dataToStore.imageUrl   = portal.imageUrl;
                            changed = true;
                        }
                        if (existing.lat !== portal.lat || existing.lng !== portal.lng) {
                            changes.push(
                                `${portal.title} has moved from `
                                + `(${existing.lat.toFixed(5)},${existing.lng.toFixed(5)}) `
                                + `to `
                                + `(${portal.lat.toFixed(5)},${portal.lng.toFixed(5)})`
                            );
                            dataToStore._oldLat = existing.lat;
                            dataToStore._oldLng = existing.lng;
                            dataToStore.lat     = portal.lat;
                            dataToStore.lng     = portal.lng;
                            changed = true;
                        }
                        if (existing.title !== portal.title) {
                            changes.push(
                                `${portal.title} has a new title (former title: "${existing.title}")`
                            );
                            dataToStore._oldTitle = existing.title;
                            dataToStore.title     = portal.title;
                            changed = true;
                        }
                        if (existing.description !== portal.description) {
                            changes.push(`${portal.title} has a new description`);
                            dataToStore._oldDescription = existing.description;
                            dataToStore.description     = portal.description;
                            changed = true;
                        }

                        // always update timestamp
                        dataToStore._lastImported = Date.now();
                        objectStore.put(dataToStore);

                        if (changed) {
                            updatedCount++;
                            // stash the per-portal change summary for display later:
                            updatedSummaries.push({ guid: portal.guid, title: portal.title, changes });
                        }

                    } else {
                        dataToStore = { ...portal, _lastImported: Date.now() };
                        objectStore.put(dataToStore);
                        newWayspots.push(portal);
                    }

                    done();
                };
            };
            let processed = 0;
            const finish = () => {
                tx.oncomplete = () => {
                    // Now check for "missing" portals
                    const readTx = db.transaction(["duplicateHistory"], "readonly");
                    const readStore = readTx.objectStore("duplicateHistory");
                    const getAllReq = readStore.getAll();
                    getAllReq.onsuccess = () => {
                        const storedPortals = getAllReq.result;
                        const reviewCoords = [result.lat, result.lng];
                        const nearbyGuids = new Set(result.nearbyPortals.map(p => p.guid));

                        const missingNearby = storedPortals
                        .map(p => {
                            const distKm = haversineDistance(reviewCoords, [p.lat, p.lng]);
                            return {
                                ...p,
                                distance: distKm * 1000 // Convert to metres
                            };
                        })
                        .filter(p => p.distance <= 500 && !nearbyGuids.has(p.guid));

                        // 1. show the counts bar
                        displayPortalCounts(
                            result.nearbyPortals.length,
                            newWayspots,
                            updatedCount,
                            missingNearby
                        );

                        // 2. show the detailed change log
                        if (updatedSummaries.length) {
                            displayUpdates(updatedSummaries);
                        }

                        db.close();
                        resolve();
                    };
                    readTx.onerror = reject;
                };
                tx.onerror = reject;
            };

            for (const portal of result.nearbyPortals) {
                processPortal(portal, () => {
                    processed++;
                    if (processed === result.nearbyPortals.length) finish();
                });
            }
        }).catch(reject);
    });

    function displayPortalCounts(totalDetected, newWayspots = [], updatedSummaries = [], missingPortals = []) {

        const container = document.querySelector('#check-duplicates-card');
        if (!container) {
            console.warn('check-duplicates-card not found.');
            return;
        }

        const newCount = newWayspots.length;
        const updatedCount = updatedSummaries.length;
        const missingCount = missingPortals.length;

        const statusSegments = [];
        if (newCount > 0) statusSegments.push(`<a href="#" id="toggle-new">${newCount} new</a>`);
        if (updatedCount > 0) statusSegments.push(`<a href="#" id="toggle-updated">${updatedCount} updated</a>`);
        if (missingCount > 0) statusSegments.push(`<a href="#" id="toggle-missing">${missingCount} missing</a>`);

        const summaryHTML = `${totalDetected} nearby Wayspots detected.` +
              (statusSegments.length ? ` ${statusSegments.join('; ')}` : '');

        // Remove previous inserted content
        const oldText = container.querySelector('.wfds');
        if (oldText) oldText.remove();
        const oldDetails = container.querySelector('.wfds-details');
        if (oldDetails) oldDetails.remove();

        // Create and insert summary
        const messageContainer = document.createElement('div');
        messageContainer.className = 'wfds';

        const summaryDiv = document.createElement('div');
        summaryDiv.innerHTML = summaryHTML;
        messageContainer.appendChild(summaryDiv);

        const detailsContainer = document.createElement('div');
        detailsContainer.className = 'wfds-details';

        const createListSection = (id, titleText, items) => {
            const section = document.createElement('div');
            section.id = id;
            section.style.display = 'none';

            const heading = document.createElement('strong');
            heading.textContent = titleText;
            section.appendChild(heading);

            const list = document.createElement('ul');
            list.className = 'wfds-list';  // Apply the wfds-list class here

            items.forEach(text => {
                const li = document.createElement('li');
                li.textContent = text;
                list.appendChild(li);
            });

            section.appendChild(list);
            return section;
        };

        // New Wayspots
        if (newCount > 0) {
            const newItems = newWayspots.map(p => `${p.title} (${p.lat}, ${p.lng})`);
            detailsContainer.appendChild(createListSection('section-new', 'New Wayspots:', newItems));
        }

        // Updated Wayspots
        if (updatedCount > 0) {
            const updatedItems = [];
            updatedSummaries.forEach(({ title, changes }) => {
                changes.forEach(line => {
                    updatedItems.push(line);
                });
            });
            detailsContainer.appendChild(createListSection('section-updated', 'Updated Wayspots:', updatedItems));
        }

        // Missing Wayspots
        if (missingCount > 0) {
            const missingItems = missingPortals.map(p => `${p.title} (${p.lat}, ${p.lng})`);
            detailsContainer.appendChild(createListSection('section-missing', 'Missing Wayspots:', missingItems));
        }

        // Insert everything into the DOM
        const target = container.querySelector('.wf-review-card__body');
        if (target && target.parentNode) {
            target.parentNode.insertBefore(messageContainer, target);
            target.parentNode.insertBefore(detailsContainer, target);
        } else {
            console.warn('.wf-review-card__body not found within #check-duplicates-card');
        }

        // Toggle functionality
        const toggle = (id, sectionId) => {
            const el = document.getElementById(id);
            const section = document.getElementById(sectionId);
            if (el && section) {
                el.addEventListener('click', (e) => {
                    e.preventDefault();
                    section.style.display = (section.style.display === 'none') ? 'block' : 'none';
                });
            }
        };

        toggle('toggle-new', 'section-new');
        toggle('toggle-updated', 'section-updated');
        toggle('toggle-missing', 'section-missing');
    }

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

    const windowRef = typeof unsafeWindow !== 'undefined' ? unsafeWindow : window;
    if (!windowRef.wft_plugins_api) windowRef.wft_plugins_api = {};
    windowRef.wft_plugins_api.reviewHistory = {
        getAll: () => new Promise((resolve, reject) => getIDBInstance().then(db => {
            const tx = db.transaction([OBJECT_STORE_NAME], 'readonly');
            tx.oncomplete = event => db.close();
            const objectStore = tx.objectStore(OBJECT_STORE_NAME);
            const getAllReviews = objectStore.getAll();
            getAllReviews.onsuccess = () => {
                const { result } = getAllReviews;
                resolve(result);
            };
        }))
    };

    function haversineDistance(coords1, coords2) {
        function toRad(x) {
            return x * Math.PI / 180;
        }

        let lat1 = coords1[0];
        let lon1 = coords1[1];

        let lat2 = coords2[0];
        let lon2 = coords2[1];
        let R = 6371; // km

        let x1 = lat2 - lat1;
        let dLat = toRad(x1);
        let x2 = lon2 - lon1;
        let dLon = toRad(x2)
        let a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
        let c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        let d = R * c;

        // returns in kilometers
        return d;
    }

    function insertAfter(newNode, referenceNode) {
        referenceNode.parentNode.insertBefore(newNode, referenceNode.nextSibling);
    }

    // Returns an copy of obj containing only the keys specified in the keys array.
    const filterObject = (obj, keys) => Object
    .keys(obj)
    .filter(key => keys.includes(key))
    .reduce((nObj, key) => { nObj[key] = obj[key]; return nObj; }, {});

    // Opens an IDB database connection.
    // IT IS YOUR RESPONSIBILITY TO CLOSE THE RETURNED DATABASE CONNECTION WHEN YOU ARE DONE WITH IT.
    // THIS FUNCTION DOES NOT DO THIS FOR YOU - YOU HAVE TO CALL db.close()!
    const getIDBInstance = version => new Promise((resolve, reject) => {
        'use strict';

        if (!window.indexedDB) {
            reject('This browser doesn\'t support IndexedDB!');
            return;
        }

        const openRequest = indexedDB.open('wayfarer-tools-db', version);
        openRequest.onsuccess = event => {
            const db = event.target.result;
            const dbVer = db.version;
            console.log(`IndexedDB initialization complete (database version ${dbVer}).`);
            if (!db.objectStoreNames.contains(OBJECT_STORE_NAME)) {
                db.close();
                console.log(`Database does not contain column ${OBJECT_STORE_NAME}. Closing and incrementing version.`);
                getIDBInstance(dbVer + 1).then(resolve);
            } else {
                resolve(db);
            }
        };
        openRequest.onupgradeneeded = event => {
            console.log('Upgrading database...');
            const db = event.target.result;
            if (!db.objectStoreNames.contains(OBJECT_STORE_NAME)) {
                db.createObjectStore("duplicateHistory", { keyPath: "guid" });
            }
        };
    });

    (() => {
        const css = `
        .wfds-list {
            margin-top: 4px;
            list-style-type: disc;
            padding-left: 20px;
            font-size: 0.9em;
        }
        `;
        const style = document.createElement('style');
        style.type = 'text/css';
        style.innerHTML = css;
        // We're loading this script on document-start, which means <head> does not exist yet.
        // Wait for it to start existing before we try to add the CSS to it.
        const tryAdd = setInterval(() => {
            const head = document.querySelector('head');
            if (head) {
                clearInterval(tryAdd);
                head.appendChild(style);
            }
        }, 100);
    })();
})();

