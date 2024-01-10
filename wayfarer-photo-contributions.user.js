// ==UserScript==
// @name         Wayfarer Photo Contributions
// @version      0.0.1
// @description  Add photos to the contributions page
// @namespace    https://gitlab.com/Tntnnbltn/wayfarer-addons
// @downloadURL  https://gitlab.com/Tntnnbltn/wayfarer-addons/-/raw/main/wayfarer-photo-contributions.user.js
// @homepageURL  https://gitlab.com/Tntnnbltn/wayfarer-addons
// @match        https://wayfarer.nianticlabs.com/*
// ==/UserScript==

// Copyright 2024 tntnnbltn
// This file is not part of the Wayfarer Addons collection but it should be.

// This script is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.

// This script is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU General Public License for more details.

function init() {
    const OBJECT_STORE_NAME = 'photoSubmissions';
    let nominations;
    let ngcontent;
    let nghost;
    let photosListBox;

    let filterSettings = {
        pending: true,
        accepted: true,
        rejected: true,
    };

    let arrangementSettings = 'RECENT';
    let sortDirection = 'DESCENDING';

    let emailData = [];

    let photoSubmissions = [];

    // Attach an event listener for the "Escape" key press
    document.addEventListener('keydown', handleEscapeKey);

    /**
     * Overwrite the open method of the XMLHttpRequest.prototype to intercept the server calls
     */
    (function (open) {
        XMLHttpRequest.prototype.open = function (method, url) {
            if (url == '/api/v1/vault/manage') {
                if (method == 'GET') {
                    this.addEventListener('load', parseNominations, false);
                }
            }
            open.apply(this, arguments);
        };
    })(XMLHttpRequest.prototype.open);

    function parseNominations(e) {
        try {
            const response = this.response;
            const json = JSON.parse(response);
            if (!json) {
                console.log('Failed to parse response from Wayfarer');
                return;
            }
            // ignore if it's related to captchas
            if (json.captcha)
                return;

            nominations = json.result.nominations;
            if (!nominations) {
                console.log('Wayfarer\'s response didn\'t include nominations.');
                return;
            }
            setTimeout(() => {
                modifyContributionsPage();
            }, 300);
        } catch (e)    {
            console.log(e); // eslint-disable-line no-console
        }
    }

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
                db.createObjectStore(OBJECT_STORE_NAME, { keyPath: 'uuid' });
            }
        };
    });

    loadPhotoSubmissionsFromIDB();

    // Function to load photoSubmissions from IndexedDB
    function loadPhotoSubmissionsFromIDB() {
        return new Promise((resolve, reject) => {
            getIDBInstance().then(db => {
                const tx = db.transaction([OBJECT_STORE_NAME], 'readonly');
                tx.oncomplete = event => db.close();
                const objectStore = tx.objectStore(OBJECT_STORE_NAME);
                const getAllSubmissions = objectStore.getAll();

                getAllSubmissions.onsuccess = () => {
                    const { result } = getAllSubmissions;
                    photoSubmissions = result || [];
                    resolve(photoSubmissions);
                };

                getAllSubmissions.onerror = () => {
                    console.error('Error loading photo submissions from IndexedDB');
                    reject('Error loading photo submissions from IndexedDB');
                };
            });
        });
    }

    function savePhotoSubmissionsToIDB() {
        return new Promise((resolve, reject) => {
            getIDBInstance().then(db => {
                const tx = db.transaction([OBJECT_STORE_NAME], 'readwrite');
                tx.oncomplete = event => db.close();
                tx.onerror = () => {
                    console.error('Error saving photo submissions to IndexedDB');
                    reject('Error saving photo submissions to IndexedDB');
                };

                const objectStore = tx.objectStore(OBJECT_STORE_NAME);

                // Process each photoSubmission in the global variable
                photoSubmissions.forEach(photoSubmission => {
                    // Check if 'edited' property is true
                    if (photoSubmission.edited) {
                        // Remove the 'edited' property
                        delete photoSubmission.edited;

                        // Save the rest of the data to IDB
                        const request = objectStore.put(photoSubmission);

                        request.onerror = () => {
                            console.error(`Error saving photo submission with UUID ${photoSubmission.uuid}`);
                            reject(`Error saving photo submission with UUID ${photoSubmission.uuid}`);
                        };
                    }
                });

                // Delete entries from IDB with uuid not present in photoSubmissions
                objectStore.openCursor().onsuccess = event => {
                    const cursor = event.target.result;
                    if (cursor) {
                        const storedUUID = cursor.value.uuid;
                        if (!photoSubmissions.some(submission => submission.uuid === storedUUID)) {
                            const deleteRequest = cursor.delete();
                            deleteRequest.onerror = () => {
                                console.error(`Error deleting photo submission with UUID ${storedUUID}`);
                                reject(`Error deleting photo submission with UUID ${storedUUID}`);
                            };
                        }
                        cursor.continue();
                    } else {
                        // All cursor entries processed
                        resolve();
                    }
                };
            });
        });
    }

    // Function to change the text content of wf-page-header, add a class, hide the next sibling,
    // insert a new div, and identify the _ngcontent string
    async function modifyContributionsPage() {
        try {
            const pageHeader = await awaitElement(() => document.querySelector('wf-page-header'));

            const nextSibling = pageHeader.nextSibling;
            if (nextSibling) {
                // Find the _ngcontent string so inserted code matches existing css styles
                ngcontent = getNgContentString(nextSibling);
                ngcontent = ngcontent.slice(0, -5);
                nghost = ngcontent.replace('content', 'host');

                nextSibling.classList.add('noms-list');

                appendCustomStyles();
                addImportButton();
                modifyExistingNominationsList();
                createPhotosDiv(nextSibling);
            }
        } catch (error) {
            console.error('Wayfarer Photo Contributions: Unknown Error');
        }
    }

    const awaitElement = get => new Promise((resolve, reject) => {
        let triesLeft = 20;
        const queryLoop = () => {
            const ref = get();
            if (ref) resolve(ref);
            else if (!triesLeft) reject();
            else setTimeout(queryLoop, 200);
            triesLeft--;
        }
        queryLoop();
    });

    function modifyExistingNominationsList() {
        // Find the existing button
        const existingButton = document.querySelector('.nominations__reverse-btn');

        if (existingButton) {
            // Create a new div with the specified class
            const newDiv = document.createElement('div');
            newDiv.className = 'flex flex-row';

            // Create the new button
            const newButton = document.createElement('button');
            newButton.className = 'wf-button nominations__reverse-btn wf-button--icon';
            newButton.setAttribute('wf-button', '');
            newButton.setAttribute('wftype', 'icon');
            newButton.setAttribute(`${ngcontent}-c208`, '');
            newButton.id = 'switch-to-photos-button';

            // Create the span element for the new button
            const spanElement = document.createElement('span');
            spanElement.className = 'text-xs';
            spanElement.id = 'switch-to-photos-text';
            spanElement.innerText = '[ Switch to Photos ]';

            // Attach click event listener to newButton
            newButton.addEventListener('click', toggleDisplayedList);

            // Append the span to the new button
            newButton.appendChild(spanElement);

            // Append the new button to the new div
            newDiv.appendChild(newButton);

            // Insert the new div before the existing button
            existingButton.parentNode.insertBefore(newDiv, existingButton);

            // Move existingButton inside newDiv
            newDiv.appendChild(existingButton);
        }
    }

    // Function to extract _ngcontent string from the element's attributes
    function getNgContentString(element) {
        for (const attribute of element.attributes) {
            if (attribute.name.startsWith('_ngcontent-')) {
                return attribute.name;
            }
        }
        return null;
    }

    function addImportButton(nominations) {
        if (document.getElementById('photoImportBtn') !== null) return;

        const ref = document.querySelector('wf-logo');
        const div = document.createElement('div');
        const btn = document.createElement('btn');

        btn.textContent = 'Import photos';
        btn.addEventListener('click', () => {
            const outer = document.createElement('div');
            outer.classList.add('photoImportBg', 'cdk-overlay-photos-container');
            document.querySelector('body').appendChild(outer);

            const backdrop = document.createElement('div');
            backdrop.classList.add('cdk-overlay-backdrop', 'cdk-overlay-dark-backdrop', 'cdk-overlay-backdrop-showing');
            backdrop.addEventListener('click', () => {
                outer.parentNode.removeChild(outer);
            });

            outer.appendChild(backdrop);

            const wrapper = document.createElement('div');
            wrapper.classList.add('cdk-global-overlay-wrapper');
            wrapper.setAttribute('dir', 'ltr');
            wrapper.style.justifyContent = 'center';
            wrapper.style.alignItems = 'center';

            outer.appendChild(wrapper);

            const inner = document.createElement('div');
            inner.classList.add('photoImportInner');
            inner.classList.add('photoImportMethod');
            inner.style.pointerEvents = 'auto';
            wrapper.appendChild(inner);

            const header = document.createElement('h1');
            header.textContent = 'Import photos from emails';
            inner.appendChild(header);

            const sub = document.createElement('p');
            sub.textContent = 'Please select how you want to import your emails.';
            inner.appendChild(sub);

            importMethods.forEach(method => {
                const btn = document.createElement('div');
                btn.classList.add('photoMethodButton');
                btn.style.zIndex = '1000'; // Set the z-index

                if (method.icon) {
                    btn.style.paddingLeft = '60px';
                    btn.style.backgroundImage = 'url(' + method.icon + ')';
                }

                const btnTitle = document.createElement('p');
                btnTitle.classList.add('photoMethodTitle');
                btnTitle.textContent = method.title;
                btn.appendChild(btnTitle);

                const btnDesc = document.createElement('p');
                btnDesc.classList.add('photoMethodDesc');
                btnDesc.textContent = method.description;
                btn.appendChild(btnDesc);

                btn.addEventListener('click', () => {
                    outer.parentNode.removeChild(outer);
                    method.callback(nominations);
                });

                inner.appendChild(btn);
            });
        });

        btn.id = 'photoImportBtn';
        btn.classList.add('photoTopButton');
        div.appendChild(btn);
        ref.parentNode.parentNode.appendChild(div);

        // Add event listener to the overlay backdrop
        const overlayBackdrop = document.querySelector('.cdk-overlay-backdrop');
        if (overlayBackdrop) {
            overlayBackdrop.addEventListener('click', clearOverlay);
        }
    }

    const importMethods = [
        {
            title: 'From *.eml files',
            description: 'Import email files saved and exported from an email client, such as Thunderbird',
            callback: importFromEml,
            icon: 'data:image/svg+xml;base64,PD94bWwgdmVyc2lvbj0iMS4wIiBlbmNvZGluZz0iVVRGLTgiIHN0YW5kYWxvbmU9Im5vIj8+CjxzdmcKICAgdmVyc2lvbj0iMS4xIgogICBpZD0iTGF5ZXJfMSIKICAgeD0iMHB4IgogICB5PSIwcHgiCiAgIHdpZHRoPSIyODM0LjkzOCIKICAgaGVpZ2h0PSIyOTAyLjE5MzEiCiAgIHZpZXdCb3g9IjAgMCAyODM0LjkzNzkgMjkwMi4xOTMxIgogICBlbmFibGUtYmFja2dyb3VuZD0ibmV3IDAgMCA1MzU2LjkyOSA1MDE0Ljk5NyIKICAgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIgogICB4bWxuczpzdmc9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KICA8ZGVmcwogICAgIGlkPSJkZWZzNDMiIC8+CiAgPGcKICAgICBpZD0iZzM4IgogICAgIHRyYW5zZm9ybT0idHJhbnNsYXRlKC0xMzE1LjQ2NCwtOTQ2LjkxMikiPgogICAgPGcKICAgICAgIGlkPSJnMzYiPgogICAgICA8cGF0aAogICAgICAgICBmaWxsPSIjZjM3MDViIgogICAgICAgICBkPSJtIDQwMzUuNDcsMjA0OS44NzkgYyAtMzAuMTYzLC0xOC4zMjEgLTY0LjE3MiwtMjkuNTg3IC0xMDAuODAyLC0yOS41ODcgSCAxNTMxLjExNyBjIC00OC40NSwwIC05Mi42MzUsMTguNzY3IC0xMjguNjk0LDQ5LjQ2MiBsIDEyMTguNzY1LDkzMi43NzkgNC40NzksMS4zNzggLTQuNDc5LDIuNzA2IDEwNi44MTMsODEuNzU0IDEwOC4zNTMsLTg1LjgzOCAtNC4yODgsLTIuNzI5IDQuMjg4LC0xLjI1NyB6IgogICAgICAgICBpZD0icGF0aDYiIC8+CiAgICAgIDxwYXRoCiAgICAgICAgIGZpbGw9IiNmMzcwNWIiCiAgICAgICAgIGQ9Im0gMTQwMi40MiwyMDczLjc5NiBjIDAsMCAxMTY0LjUxMSwtMTEyNi44ODQgMTMzNS41MDEsLTExMjYuODg0IDE3MS4wNjcsMCAxMjk3LjU1MywxMTA2Ljk4IDEyOTcuNTUzLDExMDYuOTggeiIKICAgICAgICAgaWQ9InBhdGg4IiAvPgogICAgICA8ZwogICAgICAgICBpZD0iZzI0Ij4KICAgICAgICA8cmVjdAogICAgICAgICAgIHg9IjE5MDIuMDc4IgogICAgICAgICAgIHk9IjE3NTQuNzI3MSIKICAgICAgICAgICBmaWxsPSIjZmZmZmZmIgogICAgICAgICAgIHdpZHRoPSIxNjkzLjc1MSIKICAgICAgICAgICBoZWlnaHQ9IjE5NzYuMDUyIgogICAgICAgICAgIGlkPSJyZWN0MTAiIC8+CiAgICAgICAgPHJlY3QKICAgICAgICAgICB4PSIyMDIxLjc2NCIKICAgICAgICAgICB5PSIxOTI2LjA0MzkiCiAgICAgICAgICAgZmlsbD0iI2ZmZDA2NiIKICAgICAgICAgICB3aWR0aD0iMTQ1NC4zMDgiCiAgICAgICAgICAgaGVpZ2h0PSI4OC40MDQ5OTkiCiAgICAgICAgICAgaWQ9InJlY3QxMiIgLz4KICAgICAgICA8cmVjdAogICAgICAgICAgIHg9IjIwMjEuNzY0IgogICAgICAgICAgIHk9IjIzMzAuOTc0MSIKICAgICAgICAgICBmaWxsPSIjZmZkMDY2IgogICAgICAgICAgIHdpZHRoPSIxNDU0LjMwOCIKICAgICAgICAgICBoZWlnaHQ9Ijg4LjM2MSIKICAgICAgICAgICBpZD0icmVjdDE0IiAvPgogICAgICAgIDxyZWN0CiAgICAgICAgICAgeD0iMjAyMS43NjQiCiAgICAgICAgICAgeT0iMjEyOC41MTM5IgogICAgICAgICAgIGZpbGw9IiNmZmQwNjYiCiAgICAgICAgICAgd2lkdGg9IjE0NTQuMzA4IgogICAgICAgICAgIGhlaWdodD0iODguMzkxOTk4IgogICAgICAgICAgIGlkPSJyZWN0MTYiIC8+CiAgICAgICAgPHJlY3QKICAgICAgICAgICB4PSIyMDIxLjc2NCIKICAgICAgICAgICB5PSIyNTMzLjQzNDEiCiAgICAgICAgICAgZmlsbD0iI2ZmZDA2NiIKICAgICAgICAgICB3aWR0aD0iMTQ1NC4zMDgiCiAgICAgICAgICAgaGVpZ2h0PSI4OC4zMzAwMDIiCiAgICAgICAgICAgaWQ9InJlY3QxOCIgLz4KICAgICAgICA8cmVjdAogICAgICAgICAgIHg9IjIwMjEuNzY0IgogICAgICAgICAgIHk9IjI3MjIuNzEiCiAgICAgICAgICAgZmlsbD0iI2ZmZDA2NiIKICAgICAgICAgICB3aWR0aD0iMTQ1NC4zMDgiCiAgICAgICAgICAgaGVpZ2h0PSI4OC40MDQ5OTkiCiAgICAgICAgICAgaWQ9InJlY3QyMCIgLz4KICAgICAgICA8cmVjdAogICAgICAgICAgIHg9IjIwMjEuNzY0IgogICAgICAgICAgIHk9IjI5MjUuMjA4IgogICAgICAgICAgIGZpbGw9IiNmZmQwNjYiCiAgICAgICAgICAgd2lkdGg9IjE0NTQuMzA4IgogICAgICAgICAgIGhlaWdodD0iODguMzIzOTk3IgogICAgICAgICAgIGlkPSJyZWN0MjIiIC8+CiAgICAgIDwvZz4KICAgICAgPGcKICAgICAgICAgaWQ9ImczNCI+CiAgICAgICAgPHBvbHlnb24KICAgICAgICAgICBmaWxsPSIjNjZiYmM5IgogICAgICAgICAgIHBvaW50cz0iMjU1Mi42MzQsMjk1NC4wNjkgMjU1Mi44NCwyOTU0LjIzMSAyNTE2LjEyMSwyOTI2LjA4MiAiCiAgICAgICAgICAgaWQ9InBvbHlnb24yNiIgLz4KICAgICAgICA8cGF0aAogICAgICAgICAgIGZpbGw9IiNmN2JhMWQiCiAgICAgICAgICAgZD0ibSAyNTUyLjg0LDI5NTQuMjMxIC0wLjIwNiwtMC4xNjIgLTM2LjUxMywtMjcuOTg3IC0zNDEuODkyLC0yNjEuNTQ5IC03NzEuODA2LC01OTAuNzM2IGMgLTUyLjQwMSw0NC43NjIgLTg2Ljk1OSwxMTUuMzgyIC04Ni45NTksMTk1LjYxNiB2IDEzMzQuNTY5IGMgMCw2OS45MzUgMjYuMDY5LDEzMi41NTEgNjcuMzc2LDE3Ny4xODkgbCA5NTkuMTI1LC01OTkuOTI4IDI3OS4yMjQsLTE3NC42MjEgeiIKICAgICAgICAgICBpZD0icGF0aDI4IiAvPgogICAgICAgIDxwYXRoCiAgICAgICAgICAgZmlsbD0iI2Y3YmExZCIKICAgICAgICAgICBkPSJtIDQwMzUuNDcsMjA1My44OTYgLTg5Ni43ODUsNzA5LjU4NSB2IDAgbCAtMTg5LjYyMSwxNTAuMDc0IC05Ni42MjQsNzYuMzY2IC0xNi4wOTMsMTIuNjA4IDMzOS43ODUsMjE2LjQzMiA4OTcuMjY5LDU3MS40MTIgYyA0Ni43MDYsLTQ0Ljk1MSA3Ny4wMDEsLTExMS4yODIgNzcuMDAxLC0xODYuMzk1IFYgMjI2OS40MSBjIDAsLTkzLjgxNSAtNDYuOTEzLC0xNzQuMzIgLTExNC45MzIsLTIxNS41MTQgeiIKICAgICAgICAgICBpZD0icGF0aDMwIiAvPgogICAgICAgIDxwYXRoCiAgICAgICAgICAgZmlsbD0iI2U0YTMzYSIKICAgICAgICAgICBkPSJtIDMxNzYuMTQsMzIxOC45NjQgLTMzOS43ODYsLTIxNi40MzIgMTYuMDkzLC0xMi42MDggYyAtMC45ODUsMC42MzQgLTg5LjYzMyw1NS42MzUgLTEzMy41ODksNTUuNjM1IC00My43OTIsMCAtMTY1LjI0OCwtOTAuNjg0IC0xNjYuMDE0LC05MS4zMjggbCA2OC4zNTIsNTIuMzg2IC0yNzkuMjI0LDE3NC42MiAtOTU5LjEyOCw1OTkuOTMgYyAzOC41MjYsNDEuODUxIDkwLjY5Nyw2Ny45MzggMTQ4LjI4NCw2Ny45MzggaCAyNDAzLjU0OSBjIDUzLjE2LDAgMTAxLjA4MSwtMjIuNjI5IDEzOC43MzUsLTU4LjczNSB6IgogICAgICAgICAgIGlkPSJwYXRoMzIiIC8+CiAgICAgIDwvZz4KICAgIDwvZz4KICA8L2c+Cjwvc3ZnPgo='
        },
        {
            title: 'Google Apps Script',
            description: '[THIS DOES NOT DO ANYTHING YET - FUTURE FEATURE] Import emails directly from Gmail, using a Google Apps Script',
            callback: console.log('importFromGAScript'),
            icon: 'data:image/svg+xml;base64,PD94bWwgdmVyc2lvbj0iMS4wIiBlbmNvZGluZz0iVVRGLTgiIHN0YW5kYWxvbmU9Im5vIj8+CjxzdmcKICAgdmVyc2lvbj0iMS4xIgogICB3aWR0aD0iNDU2LjEzOTI1IgogICBoZWlnaHQ9IjM2MC44MDg1IgogICBpZD0ic3ZnMjIiCiAgIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyIKICAgeG1sbnM6c3ZnPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CiAgPGRlZnMKICAgICBpZD0iZGVmczI2IiAvPgogIDxyZWN0CiAgICAgZmlsbD0iI2VhNDMzNSIKICAgICB4PSIwIgogICAgIHk9IjI1My41MzAzOCIKICAgICB3aWR0aD0iMzczIgogICAgIGhlaWdodD0iMTA3IgogICAgIHJ4PSI1My41IgogICAgIGlkPSJyZWN0MiIgLz4KICA8cmVjdAogICAgIGZpbGw9IiNmYmJjMDQiCiAgICAgeD0iLTQ5Mi45MDU5NCIKICAgICB5PSItMTE0LjA0NzMzIgogICAgIHdpZHRoPSIzNzMiCiAgICAgaGVpZ2h0PSIxMDciCiAgICAgcng9IjUzLjUiCiAgICAgdHJhbnNmb3JtPSJyb3RhdGUoLTE0NCkiCiAgICAgaWQ9InJlY3Q0IiAvPgogIDxyZWN0CiAgICAgZmlsbD0iIzM0YTg1MyIKICAgICB4PSI3MS4wODQ2MjUiCiAgICAgeT0iLTI2My42ODY5MiIKICAgICB3aWR0aD0iMzczIgogICAgIGhlaWdodD0iMTA3IgogICAgIHJ4PSI1My41IgogICAgIHRyYW5zZm9ybT0icm90YXRlKDcyKSIKICAgICBpZD0icmVjdDYiIC8+CiAgPHJlY3QKICAgICBmaWxsPSIjNDI4NWY0IgogICAgIHg9Ii0yNDYuMDAxMSIKICAgICB5PSIzNDUuOTQzNzMiCiAgICAgd2lkdGg9IjM3MyIKICAgICBoZWlnaHQ9IjEwNyIKICAgICByeD0iNTMuNSIKICAgICB0cmFuc2Zvcm09InJvdGF0ZSgtNzIpIgogICAgIGlkPSJyZWN0OCIgLz4KICA8ZwogICAgIGZpbGw9IiNmZmZmZmYiCiAgICAgaWQ9ImcyMCIKICAgICB0cmFuc2Zvcm09InRyYW5zbGF0ZSgtMjcuNTMwMDAxLC03NS4zNjk2MTMpIj4KICAgIDxjaXJjbGUKICAgICAgIGN4PSIyNjUuODQiCiAgICAgICBjeT0iMTI5LjI4IgogICAgICAgcj0iMjYuNzAwMDAxIgogICAgICAgaWQ9ImNpcmNsZTEwIiAvPgogICAgPGNpcmNsZQogICAgICAgY3g9IjEzMS40NCIKICAgICAgIGN5PSIyMjUuNDQiCiAgICAgICByPSIyNi43MDAwMDEiCiAgICAgICBpZD0iY2lyY2xlMTIiIC8+CiAgICA8Y2lyY2xlCiAgICAgICBjeD0iODEuMzYwMDAxIgogICAgICAgY3k9IjM4Mi42MDAwMSIKICAgICAgIHI9IjI2LjcwMDAwMSIKICAgICAgIGlkPSJjaXJjbGUxNCIgLz4KICAgIDxjaXJjbGUKICAgICAgIGN4PSIzNDguMjIiCiAgICAgICBjeT0iMzgxLjY0MDAxIgogICAgICAgcj0iMjYuNzAwMDAxIgogICAgICAgaWQ9ImNpcmNsZTE2IiAvPgogICAgPGNpcmNsZQogICAgICAgY3g9IjQzMC42NzAwMSIKICAgICAgIGN5PSIxMjcuODkiCiAgICAgICByPSIyNi43MDAwMDEiCiAgICAgICBpZD0iY2lyY2xlMTgiIC8+CiAgPC9nPgo8L3N2Zz4K'
        }
    ];

    function toggleDisplayedList() {
        const photosListDiv = document.querySelector('.photos-list');
        const nomsListDiv = document.querySelector('.noms-list');

        // Check the current visibility state of photos-list
        const isPhotosListHidden = photosListDiv.classList.contains('hidden-list');

        // Define the detailsPane plane for each type
        const nominationDetailsPane = document.querySelector('app-details-pane');
        const photoDetailsPane = document.getElementById('photo-details-pane');

        if (isPhotosListHidden) {
            // Show the photos list, hide the nominations list
            photosListDiv.classList.remove('hidden-list');
            nomsListDiv.classList.add('hidden-list');
            if (nominationDetailsPane) {
                nominationDetailsPane.classList.add('hidden-list');
            }
        } else {
            // Show the nominations list, hide the photos list
            photosListDiv.classList.add('hidden-list');
            nomsListDiv.classList.remove('hidden-list');
            if (nominationDetailsPane) {
                nominationDetailsPane.classList.remove('hidden-list');
            }
            if (photoDetailsPane) {
                photoDetailsPane.remove();
            }
        }
    }

    function importFromEml() {
        // Create a file input element
        const fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.multiple = true;

        // Trigger file input click when function is called
        fileInput.click();

        // Add change event listener to handle selected files
        fileInput.addEventListener('change', async (event) => {
            const files = event.target.files;

            // Process each file asynchronously
            for (const file of files) {
                await extractDataFromEmails(file);
            }

            // After processing all files, activate the following functions
            matchEmailsToWayspots();
            sortAndFilterPhotoSubmissions();
        });
    }

    function extractDataFromEmails(file) {
        return new Promise(resolve => {
            const reader = new FileReader();

            reader.onload = () => {
                const emailText = reader.result;

                // Parse the email using parseMIME
                let [headers, body] = parseMIME(emailText);

                // Find the content-type
                let contentType, charset;
                const contentTypeHeader = headers.find(([token]) => token.toLowerCase() === "content-type");
                if (contentTypeHeader) {
                    const ctValue = contentTypeHeader[1];
                    contentType = parseContentType(ctValue);
                    charset = (contentType.params.charset || 'utf-8').toLowerCase();
                }

                // Work around multipart/alternative
                let plainTextBody, plainTextCharset, unfoldedPlainTextBody;

                if (contentType.type == 'multipart/alternative') {
                    body.split(`--${contentType.params.boundary}`).forEach(part => {
                        const partMime = parseMIME(part);
                        if (!partMime) return;
                        const [ partHead, partBody ] = partMime;
                        if (!partBody.trim().length) return;
                        const innerCTHeader = partHead.find(([token]) => token.toLowerCase() === "content-type");
                        if (innerCTHeader === null) return;
                        contentType = parseContentType(innerCTHeader[1]);
                        if (contentType.type == 'text/html') {
                            body = partBody;
                            charset = (contentType.params.charset || 'utf-8').toLowerCase();
                        }
                        if (contentType.type == 'text/plain') {
                            plainTextBody = partBody;
                            plainTextCharset = (contentType.params.charset || 'utf-8').toLowerCase();
                        }
                    });
                }

                let unfoldedBody = body
                .split(/=\r?\n/).join('')
                .split(/\r?\n/).map(e => {
                    const uriStr = e.split('%').join('=25').split('=').join('%');
                    switch (charset) {
                        case 'utf-8':
                            return decodeURIComponent(uriStr);
                        case 'iso-8859-1':
                        case 'us-ascii':
                        case 'windows-1252':
                            return decodeURIComponent(asciiToUTF8(uriStr));
                        default:
                            throw new Error(`Unknown charset ${charset}.`);
                    }
                }).join('\n');

                if (plainTextBody) {
                    const unfoldedPlainTextBody = plainTextBody
                    .split(/=\r?\n/).join('')
                    .split(/\r?\n/).map(e => {
                        const uriStr = e.split('%').join('=25').split('=').join('%');
                        switch (plainTextCharset) {
                            case 'utf-8':
                                return decodeURIComponent(uriStr);
                            case 'iso-8859-1':
                            case 'us-ascii':
                            case 'windows-1252':
                                return decodeURIComponent(asciiToUTF8(uriStr));
                            default:
                                throw new Error(`Unknown charset ${plainTextCharset}.`);
                        }
                    }).join('\n');

                    // Append unfoldedPlainTextBody to unfoldedBody
                    unfoldedBody += `\n\n${unfoldedPlainTextBody}`;
                }

                let email = {};

                // Extract relevant information from headers
                headers.forEach(([token, field]) => {
                    // (e.g., Date, From, Subject)
                    if (token === "Date") {
                        extractDate(field, email);
                    } else if (token === "Message-ID") {
                        extractMessageId(field, email);
                    } else if (token === "Subject") {
                        extractTitleAndStatus(field, email, unfoldedBody);
                    }
                });

                extractImageUrl(unfoldedBody, email);

                if (email.title) {
                    // Check for duplicates based on unique messageId
                    const isDuplicate = emailData.some(existingEmail => existingEmail.messageId === email.messageId);

                    // Check if messageId is present in photoSubmissions
                    const isMessageIdInSubmissions = photoSubmissions.some(submission =>
                                                                           submission.submitted.messageId === email.messageId || submission.outcome.messageId === email.messageId
                                                                          );

                    if (!isDuplicate && !isMessageIdInSubmissions) {
                        emailData.push(email);
                    } else {
                        console.log('Email skipped because it is a duplicate or its details are already assigned to a photo:', email);
                    }
                } else {
                    console.log('Email skipped because it was an unknown format (no Wayspot title):', email);
                }
                resolve();
            };

            reader.readAsText(file);
        });
    }

    const parseMIME = data => {
        const bound = data.indexOf('\r\n\r\n');
        if (bound < 0) return null;
        const headers = data.substr(0, bound)
        .replaceAll(/\r\n\s/g, ' ')
        .split(/\r\n/).map(e => {
            const b = e.indexOf(':');
            const token = e.substr(0, b);
            // Decode RFC 2047 atoms
            const field = e.substr(b + 1).trim().replaceAll(/=\?([A-Za-z0-9-]+)\?([QqBb])\?([^\?]+)\?=(?:\s+(?==\?[A-Za-z0-9-]+\?[QqBb]\?[^\?]+\?=))?/g, (_, charset, encoding, text) => {
                if (!['utf-8', 'us-ascii', 'iso-8859-1', 'windows-1252'].includes(charset.toLowerCase())) throw new Error(`Unknown charset "${charset}".`);
                switch (encoding) {
                    case 'Q': case 'q':
                        text = text.split('_').join(' ').split('%').join('=25').split('=').join('%');
                        return decodeURIComponent(charset.toLowerCase() == 'utf-8' ? text : asciiToUTF8(text))
                    case 'B': case 'b': return charset.toLowerCase() == 'utf-8' ? atobUTF8(text) : atob(text);
                    default: throw new Error(`Invalid RFC 2047 encoding format "${encoding}".`);
                }
            });
            return [ token, field.trim() ];
        });
        const body = data.substr(bound + 4);
        return [ headers, body ];
    };

    const parseContentType = ctHeader => {
        const m = ctHeader.match(/^(?<type>[^\/]+\/[^\/;\s]+)(?=($|(?<params>(;[^;]*)*)))/);
        const { type, params } = m.groups;
        const paramMap = {};
        if (params) params.substr(1).split(';').forEach(param => {
            const [ attr, value ] = param.trim().split('=');
            paramMap[attr.toLowerCase()] = value.startsWith('"') && value.endsWith('"') ? value.substring(1, value.length - 1) : value;
        });
        return { type: type.toLowerCase(), params: paramMap };
    };

    const atobUTF8 = text => decodeURIComponent(atob(text).split('').map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)).join(''));

    const asciiToUTF8 = text => text.replaceAll(/%([A-Fa-f][0-9A-Fa-f])/g, (match, p1) => {
        const ci = parseInt(p1, 16);
        if (ci <= 0xBF) return '%c2%' + ci.toString(16);
        if (ci >= 0xC0) return '%c3%' + (ci - 0x40).toString(16);
    });

    function extractDate(dateString, email) {
        const date = new Date(dateString);

        // Extract Unix timestamp
        email.timestamp = Math.floor(date.getTime());
    }

    function extractMessageId(field, email) {
        // Assuming field is in the format: "<message-id>"
        const match = field.match(/<([^>]+)>/);
        if (match && match[1]) {
            email.messageId = match[1].trim();
        }
    }

    function extractTitleAndStatus(subject, email, emailText) {

        //  ---------------------------------------- ENGLISH [en] ----------------------------------------

        // WAYFARER TEMPLATES
        // Wayfarer Submitted Template
        if (subject.startsWith("Thanks! Niantic Wayspot Photo received for ")) {
            email.template = "Wayfarer";
            email.title = subject.substring("Thanks! Niantic Wayspot Photo received for ".length, subject.length - 1);
            email.status = "submitted";
        }

        // Wayfarer Decision Template
        if (subject.startsWith("Niantic Wayspot media submission decided for ")) {
            email.title = subject.substring("Niantic Wayspot media submission decided for ".length);
            email.template = "Wayfarer";
            if (emailText.includes("Congratulations,")) {
                email.status = "accepted";
            } else if (emailText.includes("not to accept")) {
                email.status = "rejected";
            }
            const regex = /Thank you for your Wayspot Photo submission for ([^]+?) on (\w{3} \d{1,2}, \d{4}|[^]+?)\./;
            email.originalSubmissionDate = extractSubmissionDate(emailText, regex);
        }

        // INGRESS TEMPLATES
        // Ingress Submitted Template
        if (subject.startsWith("Portal photo submission confirmation")) {
            if (subject.includes(":")) {
                email.template = "Ingress Redacted";
                email.title = subject.substring(subject.indexOf(":") + 1).trim();
            } else {
                email.template = "Ingress Prime";
                email.title = extractWayspotTitleING(emailText, "Portal photo submission confirmation:");
                email.id = extractIdFromEmailText(emailText, "ID:");
            }
            email.status = "submitted";
        }

        // Ingress Decision Template
        if (subject.startsWith("Portal photo review complete")) {
            if (subject.includes(":")) {
                email.template = "Ingress Redacted";
                email.title = subject.substring(subject.indexOf(":") + 1).trim();
            } else {
                email.template = "Ingress Prime";
                email.title = extractWayspotTitleING(emailText, "Portal photo review complete:");
                email.id = extractIdFromEmailText(emailText, "ID:");
            }
            email.status = emailText.includes("Good work,") ? "accepted" : "rejected";
            const regex = /Submission Date: ([^]+?) on (\w{3} \d{1,2}, \d{4}|[^]+?)\./;
            email.originalSubmissionDate = extractSubmissionDate(emailText, regex);
        }

        // POKEMON GO TEMPLATES
        // Pokemon Go Submitted Template
        if (subject.startsWith("Photo Submission Received")) {
            email.template = "Pokemon Go";
            email.title = extractWayspotTitlePGO(emailText, "Photo submission confirmation:");
            email.id = extractIdFromEmailText(emailText, "ID:");
            email.status = "submitted";
        }

        // Pokemon Go Decision Templates
        if (subject.startsWith("Photo Submission Accepted" || subject.startsWith("Photo Submission Rejected"))) {
            email.template = "Pokemon Go";
            email.title = extractWayspotTitlePGO(emailText, "Photo review complete:");
            email.id = extractIdFromEmailText(emailText, "ID:");
            email.status = subject.startsWith("Photo Submission Accepted") ? "accepted" : "rejected";
            const regex = /Submission Date: ([^]+?) on (\w{3} \d{1,2}, \d{4}|[^]+?)\./;
            email.originalSubmissionDate = extractSubmissionDate(emailText, regex);
        }

        //  ---------------------------------------- GERMAN [de] ----------------------------------------

        // WAYFARER TEMPLATES
        // Wayfarer Submitted Template
        if (subject.startsWith("Danke! Wir haben den Upload Photo für den Wayspot ")) {
            email.template = "Wayfarer";
            email.title = subject.substring("Danke! Wir haben den Upload Photo für den Wayspot ".length, subject.indexOf(" erhalten!"));
            email.status = "submitted";
        }

        // Wayfarer Decision Template
        if (subject.startsWith("Entscheidung zu deinem Upload für den Wayspot ")) {
            email.template = "Wayfarer";
            email.title = subject.substring("Entscheidung zu deinem Upload für den Wayspot ".length);
            if (emailText.includes("Glückwunsch,")) {
                email.status = "accepted";
            } else if (emailText.includes("Tut uns leid")) {
                email.status = "rejected";
            }
            const regex = /danke, dass du am (\d{1,2}\.\d{1,2}\.\d{4}) den Upload Photo/;
            email.originalSubmissionDate = extractSubmissionDate(emailText, regex);
        }

        // INGRESS TEMPLATES
        // Ingress Submitted Template
        if (subject.startsWith("Portalfotovorschlag erhalten")) {
            if (subject.includes(":")) {
                email.template = "Ingress Redacted";
                email.title = subject.substring(subject.indexOf(":") + 1).trim();
            } else {
                email.template = "Ingress Prime";
                email.title = extractWayspotTitleING(emailText, "Portalfotovorschlag erhalten:");
                email.id = extractIdFromEmailText(emailText, "ID:");
            }
            email.status = "submitted";
        }

        // Ingress Decision Template
        if (subject.startsWith("Überprüfung des Portalfotos abgeschlossen")) {
            emailText = emailText.replace(/&Uuml;/g, 'Ü').replace(/&uuml;/g, 'ü'); // Character fix for "Überprüfung"
            if (subject.includes(":")) {
                email.template = "Ingress Redacted";
                email.title = subject.substring(subject.indexOf(":") + 1).trim();
            } else {
                email.template = "Ingress Prime";
                email.title = extractWayspotTitleING(emailText, "Überprüfung des Portalfotos abgeschlossen:");
                email.id = extractIdFromEmailText(emailText, "ID:");
            }
            email.status = emailText.includes("Ausgezeichnete Arbeit,") ? "accepted" : "rejected";
            const regex = /das Datum der Einreichung: (\d{1,2}\.\d{1,2}\.\d{4})/;
            email.originalSubmissionDate = extractSubmissionDate(emailText, regex);
        }

        // POKEMON GO TEMPLATES
        // Pokemon Go Submitted Template
        if (subject.startsWith("Fotovorschlag erhalten")) {
            email.template = "Pokemon Go";
            email.title = extractWayspotTitlePGO(emailText, "wir haben dein eingereichtes Foto erhalten:");
            email.id = extractIdFromEmailText(emailText, "ID:");
            email.status = "submitted";
        }

        // Pokemon Go Decision Templates
        if (subject.startsWith("Fotovorschlag akzeptiert" || subject.startsWith("Fotovorschlag abgelehnt"))) {
            email.template = "Pokemon Go";
            emailText = emailText.replace(/&Uuml;/g, 'Ü').replace(/&uuml;/g, 'ü'); // Character fix for "Überprüfung"
            email.title = extractWayspotTitlePGO(emailText, "die Überprüfung deines Fotos ist abgeschlossen:");
            email.id = extractIdFromEmailText(emailText, "ID:");
            email.status = subject.startsWith("Fotovorschlag akzeptiert") ? "accepted" : "rejected";
            const regex = /das Datum der Einreichung: (\d{1,2}\.\d{1,2}\.\d{4})/;
            email.originalSubmissionDate = extractSubmissionDate(emailText, regex);
        }

        //  -------------------------------------- END OF LANGUAGES ----------------------------------------

        // Replace UTF-8 URL-encoded characters
        if (email.title) {
            email.title = email.title.replace(/=([A-Fa-f0-9]{2})/g, function(match, hexCode) {
                return String.fromCharCode(parseInt(hexCode, 16));
            });

            // Use decodeURIComponent to handle remaining URL-encoded characters
            email.title = decodeURIComponent(email.title);

            // Trim and perform additional replacements
            email.title = email.title.replace(/=20/g, '').trim();
            email.title = email.title.replace(/<br \/>/g, '').trim();

            // Define an array of replacement pairs
            const replacements = [
                ["â", "–"],
                ["â", "“"],
                ["â", "”"],
                ["&amp;", "&"],
                ["&apos;", "'"],
                ["&apos;!", "'!"],
                ["&quot;", "\""],
                ["&quot;", "\""],
                ["â", "'"],
                ["â", "'"],
                ["Ã¼", "ü"],
                ["Â½", "½"],
                ["=E2=80=98", "‘"],
                ["=E2=80=99", "’"]
            ];

            // Perform replacements
            if (email.title) {
                replacements.forEach(([oldStr, newStr]) => {
                    email.title = email.title.replace(new RegExp(oldStr, "g"), newStr);
                });
            }
        }
    }

    // Helper function to extract Wayspot title
    function extractWayspotTitleING(text, string) {
        let index = text.indexOf(string);
        if (index !== -1) {
            let remainingText = text.substring(index + string.length);
            let lines = remainingText.split("\n");
            if (lines.length > 1) {
                return lines[1].trim();
            }
        }
        return '';
    }

    // Helper function to extract Wayspot title
    function extractWayspotTitlePGO(emailText, string) {
        let index = emailText.indexOf(string);
        if (index !== -1) {
            let remainingText = emailText.substring(index + string.length);
            let lines = remainingText.split("\n");
            if (lines.length > 0) {
                return lines[0].trim();
            }
        }
        return '';
    }

    function extractSubmissionDate(emailText, regex) {
        const match = emailText.match(regex);
        if (match) {
            const dateString = match[2] || match[1];
            if (dateString) {
                // Convert the date string to a JavaScript Date object
                const dateObject = new Date(dateString.replace(/(\d{2})\.(\d{2})\.(\d{4})/, '$2/$1/$3'));
                return dateObject;
            }
        }
        return null;
    }

    function extractIdFromEmailText(emailText, identifier) {
        const regexPattern = new RegExp(`${identifier}\\s*([\\w\\d+/=]+)`);
        const match = emailText.match(regexPattern);

        if (match && match[1]) {
            return match[1].trim();
        }

        return null; // Return null if no match is found
    }

    function extractImageUrl(unfoldedBody, email) {
        const urlRegex = /http[s]?:\/\/[^\s<"]+/g;
        const matches = unfoldedBody.match(urlRegex);

        // Check whether the URL corresponds to a known photo URL format
        if (matches) {
            const imageMatch = matches.find(url => url.includes('ggpht') || url.includes('googleusercontent'));
            if (imageMatch) {
                email.imageUrl = imageMatch;
            }
        }
    }

    function matchEmailsToWayspots() {
        // Keep track of which emails have been used for matching
        emailData.forEach(email => email.used = false);

        // Create a list of unique Wayspots from the unique image URLs
        emailData.forEach(email => {
            if (email.imageUrl && !photoSubmissions.some(submission => submission.imageUrl === email.imageUrl)) {
                const photoSubmission = {
                    imageUrl: email.imageUrl,
                    edited: true,
                    matched: false,
                    title: null,
                    status: null,
                    uuid: null,
                    submitted: {
                        id: null,
                        messageId: null,
                        template: null,
                        timestamp: null,
                        title: null,
                    },
                    outcome: {
                        id: null,
                        messageId: null,
                        template: null,
                        timestamp: null,
                        title: null,
                        result: null,
                        submittedDate: null,
                    },
                };

                photoSubmissions.push(photoSubmission);
            }
        });

        // Match submission emails to Wayspots using unique image URLs
        // Works for most templates except some older rejection templates
        emailData.forEach(email => {
            if (email.imageUrl) {
                const matchingSubmission = photoSubmissions.find(submission => submission.imageUrl === email.imageUrl);

                // Add data from the email to the submission
                if (matchingSubmission) {
                    saveEmailDataToSubmission(matchingSubmission, email, email.status);
                }
            }
        });

        emailData.forEach(email => {
            if (email.imageUrl) {
                const matchingSubmission = photoSubmissions.find(submission => submission.imageUrl === email.imageUrl);

                // Add data from the email to the submission
                // If there are multiple outcome emails, only save the most recent
                if (matchingSubmission) {
                    if (
                        email.status !== 'pending' &&
                        matchingSubmission.outcome.timestamp &&
                        matchingSubmission.outcome.timestamp > email.timestamp
                    ) {
                        return;
                    } else {
                        saveEmailDataToSubmission(matchingSubmission, email, email.status);
                    }
                }
            }
        });

        // Match emails to Wayspots using unique photo ID from emails
        // Template: Ingress Prime
        // Template: Pokemon Go
        emailData.forEach(email => {
            if (email.id && !email.used) {
                const matchingSubmission = photoSubmissions.find(submission => submission.submitted.id === email.id);

                // Add data from the email to the submission
                if (matchingSubmission) {
                    saveEmailDataToSubmission(matchingSubmission, email, email.status);
                }
            }
        });

        // Add entries for unused emails without image URLs
        // Template: Ingress Prime rejection
        // Template: Pokemon Go rejection(?)
        emailData.forEach(email => {
            if (!email.imageUrl && !email.used && email.status === 'rejected') {
                email.used = true;

                const newSubmission = {
                    imageUrl: null,
                    edited: true,
                    matched: false,
                    title: null,
                    status: null,
                    submitted: {
                        id: null,
                        messageId: null,
                        template: null,
                        timestamp: null,
                        title: null,
                    },
                    outcome: {
                        id: email.id,
                        messageId: email.messageId,
                        template: email.template,
                        timestamp: email.timestamp,
                        title: email.title,
                        result: email.status,
                        submittedDate: email.originalSubmissionDate
                    },
                };

                photoSubmissions.push(newSubmission);
            }
        });

        // Add unique entries for unique emails with shared image IDs
        // Template: Ingress Redacted rejection
        emailData.forEach(email => {
            if (email.status === 'rejected' && email.template === 'Ingress Redacted') {
                // Find matching photoSubmissions with the same imageUrl and outcome.messageId
                const matchingSubmission = photoSubmissions.find(submission =>
                                                                 submission.outcome.messageId === email.messageId
                                                                );

                if (!matchingSubmission) {
                    email.used = true;

                    const newSubmission = {
                        imageUrl: email.imageUrl,
                        edited: true,
                        matched: false,
                        title: null,
                        status: null,
                        submitted: {
                            id: null,
                            messageId: null,
                            template: null,
                            timestamp: null,
                            title: null,
                        },
                        outcome: {
                            id: email.id,
                            messageId: email.messageId,
                            template: email.template,
                            timestamp: email.timestamp,
                            title: email.title,
                            result: email.status,
                            submittedDate: email.originalSubmissionDate
                        },
                    };

                    photoSubmissions.push(newSubmission);
                }
            }
        });

        // Categorise the Wayspots as matched if we have submission and outcome details
        photoSubmissions.forEach(submission => {
            if (submission.submitted.title && submission.outcome.title) {
                submission.matched = true;
                submission.status = submission.outcome.result;
            } else if (submission.submitted.title && !submission.outcome.title) {
                submission.matched = false;
                submission.status = 'pending';
            } else if (!submission.submitted.title && submission.outcome.title) {
                submission.matched = false;
            }
        });

        // There are no more unique strategies for definitively matching remaining photos
        // The following code will attempt to match photos based on guesswork

        // Match emails without an imageUrl
        // This is a backup in case the unique photo id couldn't be found
        // Template: Ingress Prime rejection
        // Template: Pokemon Go rejection
        emailData.forEach(email => {
            if (!email.imageUrl && !email.used && email.status === 'rejected') {
                const matchingSubmission = photoSubmissions.find(submission =>
                                                                 submission.status === 'pending' &&
                                                                 submission.submission.title === email.title &&
                                                                 submission.submitted.timestamp < email.timestamp
                                                                );

                if (matchingSubmission) {
                    // Update the existing entry with the rejection email details
                    saveEmailDataToSubmission(matchingSubmission, email, 'rejected');
                    matchingSubmission.status = 'rejected';
                    matchingSubmission.edited = true;
                    matchingSubmission.matched = true;

                    // Remove the original entry for the rejection in photoSubmissions
                    photoSubmissions = photoSubmissions.filter(submission =>
                                                               submission.outcome.messageId !== email.messageId || submission.matched
                                                              );
                }
            }
        });

        // Attempt to match emails which have different image URLs
        // Template: Ingress Redacted rejection
        for (let i = photoSubmissions.length - 1; i >= 0; i--) {
            const submission = photoSubmissions[i];
            if (submission.outcome.result === 'rejected' && !submission.matched) {

                const matchingSubmission = photoSubmissions.find(sub =>
                                                                 sub.status === 'pending' &&
                                                                 sub.submitted.title === submission.outcome.title &&
                                                                 sub.submitted.timestamp < submission.outcome.timestamp
                                                                );

                if (matchingSubmission) {
                    // Import the outcome and outcomeDate from the unmatched rejection email
                    matchingSubmission.outcome = { ...submission.outcome };
                    matchingSubmission.status = 'rejected';
                    matchingSubmission.edited = true;
                    matchingSubmission.matched = true;

                    // Remove the unmatched rejected photoSubmission
                    photoSubmissions.splice(i, 1);
                }
            }
        }

        // Update the Wayspot data
        photoSubmissions.forEach(submission => {
            submission.title = submission.outcome.title !== null ? submission.outcome.title : submission.submitted.title;
            submission.status = submission.outcome.result !== null ? submission.outcome.result : 'pending';

            // Set the game source based on the email templates
            const submittedTemplate = submission.submitted.template || "";
            const outcomeTemplate = submission.outcome.template || "";

            if (submittedTemplate.includes("Pokemon Go") || outcomeTemplate.includes("Pokemon Go")) {
                submission.gameSource = "Pokemon Go";
            } else if (submittedTemplate.includes("Ingress") || outcomeTemplate.includes("Ingress")) {
                submission.gameSource = "Ingress";
            } else {
                submission.gameSource = "Unknown";
            }

            // Convert outcome submittedDate to timestamp if submitted timestamp is null
            // Use for cases where outcome email is found but submission email is missing
            if (submission.outcome.submittedDate && !submission.submitted.timestamp) {
                submission.submitted.timestamp = new Date(submission.outcome.submittedDate).getTime();
            }

            // Generate UUID by concatenating messageIds
            const messageIdSubmitted = submission.submitted.messageId || "";
            const messageIdOutcome = submission.outcome.messageId || "";
            submission.uuid = messageIdSubmitted + messageIdOutcome;
        });

        savePhotoSubmissionsToIDB();
    }

    function saveEmailDataToSubmission(submission, email, emailType) {
        email.used = true;
        submission.edited = true;

        if (emailType === 'submitted') {
            submission.submitted.id = email.id;
            submission.submitted.messageId = email.messageId;
            submission.submitted.template = email.template;
            submission.submitted.timestamp = email.timestamp;
            submission.submitted.title = email.title;
        } else {
            submission.outcome.id = email.id;
            submission.outcome.messageId = email.messageId;
            submission.outcome.template = email.template;
            submission.outcome.timestamp = email.timestamp;
            submission.outcome.title = email.title;
            submission.outcome.result = email.status;
            submission.outcome.submittedDate = email.originalSubmissionDate;
        }
    }

    function createPhotosDiv() {
        const photosListDiv = document.createElement('div');
        photosListDiv.classList.add('flex', 'flex-row', 'photos-list', 'hidden-list');
        photosListDiv.style.display = 'none !important';

        // Constructing the HTML content
        const htmlContent = `
   <div ${ngcontent}-c208="" class="w-full">
      <div ${ngcontent}-c208="" class="flex flex-col mb-4">
         <div ${ngcontent}-c208="" class="flex flex-row">
            <app-nominations-search ${ngcontent}-c208="" class="flex-grow">
               <div ${ngcontent}-c198="" class="flex flex-col"><span ${ngcontent}-c198="" class="relative top-2 left-3 text-xs bg-gray-100 w-min">Search</span><input ${ngcontent}-c198="" id="photos-search-input" type="text" class="w-full bg-transparent py-1 px-2 border border-black rounded-md"></div>
               <!---->
            </app-nominations-search>
            <button ${ngcontent}-c208="" wf-button="" wftype="icon" class="wf-button cursor-pointer self-end ml-4 wf-button--icon" id="photos-filter-button"><img ${ngcontent}-c208="" src="img/options.svg" alt="" class="dark:filter-icon"></button>
         </div>
         <div ${ngcontent}-c208="" class="mt-2">
         <div class="flex flex-row">
                     <button ${ngcontent}-c208="" wf-button="" wftype="icon" class="wf-button nominations__reverse-btn wf-button--icon" id="switch-to-nominations-button">
               <span ${ngcontent}-c208="" class="text-xs" id="switch-to-nominations-text">[ Switch to Nominations ]</span>
            </button>
            <button ${ngcontent}-c208="" wf-button="" wftype="icon" class="wf-button nominations__reverse-btn wf-button--icon" id="photos-sort-button">
               <span ${ngcontent}-c208="" class="text-xs" id="photo-sort-text">Most Recent</span>
               <mat-icon ${ngcontent}-c208="" role="img" class="mat-icon notranslate material-icons mat-icon-no-color" aria-hidden="true" data-mat-icon-type="font">expand_more</mat-icon>
            </button>
         </div>
         </div>
         <!---->
      </div>
      <app-nominations-list ${ngcontent}-c208="" class="w-full">
         <div ${ngcontent}-c202="">
            <cdk-virtual-scroll-viewport ${ngcontent}-c202="" class="cdk-virtual-scroll-viewport nominations-list card cdk-virtual-scroll-orientation-vertical">
               <div class="cdk-virtual-scroll-content-wrapper photos-list-box" style="transform: translateY(0px);">
                  <!---->
               </div>
               <div class="cdk-virtual-scroll-spacer" id="photo-scroll-spacer"></div>
            </cdk-virtual-scroll-viewport>
         </div>
         <!----><!----><!----><!---->
      </app-nominations-list>
   </div>
    `;

        // Set the HTML content
        photosListDiv.innerHTML = htmlContent;

        // Insert the photosListDiv after the noms-list div
        const nomsListDiv = document.querySelector('.noms-list');
        nomsListDiv.insertAdjacentElement('afterend', photosListDiv);

        // Identify location of photoslistbox for other functions
        photosListBox = document.getElementsByClassName("photos-list-box")[0];

        // // Add an event listener to the "Switch to Nominations" button
        const switchToNominationsButton = document.getElementById('switch-to-nominations-button');
        switchToNominationsButton.addEventListener('click', toggleDisplayedList);

        // Add event listener for search box
        handleSearchInputChange();

        // Add event listener for filter button
        const photosFilterButton = document.getElementById('photos-filter-button');
        photosFilterButton.addEventListener('click', createFilterOverlay);

        // Add event listener for the sort button
        const sortButton = document.getElementById('photos-sort-button');
        sortButton.addEventListener('click', handleSortButtonClicked);

        sortAndFilterPhotoSubmissions();
    }

    function sortAndFilterPhotoSubmissions() {
        // Get the search input element
        const searchInput = document.getElementById('photos-search-input');

        // Filter photoSubmissions based on filterSettings and search input
        const filteredPhotoSubmissions = photoSubmissions.filter((submission) => {
            const matchesFilterSettings =
                  (filterSettings.pending && submission.status === 'pending') ||
                  (filterSettings.accepted && submission.status === 'accepted') ||
                  (filterSettings.rejected && submission.status === 'rejected');

            const matchesSearch =
                  !searchInput ||
                  submission.title.toLowerCase().includes(searchInput.value.trim().toLowerCase()) ||
                  (submission.submitted && submission.submitted.title && submission.submitted.title.toLowerCase().includes(searchInput.value.trim().toLowerCase())) ||
                  (submission.outcome && submission.outcome.title && submission.outcome.title.toLowerCase().includes(searchInput.value.trim().toLowerCase()));

            const hasSubmittedTimestamp = submission.submitted && submission.submitted.timestamp !== null;

            return matchesFilterSettings && matchesSearch && hasSubmittedTimestamp;
        });

        // Sort the remaining values
        const sortedPhotoSubmissions = filteredPhotoSubmissions.sort((a, b) => {
            if (arrangementSettings === 'RECENT') {
                return sortDirection === 'ASCENDING' ? a.submitted.timestamp - b.submitted.timestamp : b.submitted.timestamp - a.submitted.timestamp;
            } else if (arrangementSettings === 'ALPHABETICAL') {
                const titleA = a.title.toLowerCase();
                const titleB = b.title.toLowerCase();
                return sortDirection === 'ASCENDING' ? titleA.localeCompare(titleB) : titleB.localeCompare(titleA);
            }
            return 0; // Default case, no sorting
        });

        // Clear the old list and then add the newly sorted entries
        clearPhotosListBox();
        sortedPhotoSubmissions.forEach(createPhotosListItem);

        // Set the height for the photo-scroll-spacer element to match number of submissions
        const photoScrollSpacer = document.getElementById('photo-scroll-spacer');
        if (photoScrollSpacer) {
            const spacerHeight = sortedPhotoSubmissions.length * 128;
            photoScrollSpacer.style.height = spacerHeight + 'px';
        }
    }

    function createPhotosListItem(photoSubmission) {
        const {
            imageUrl,
            title,
            status,
            submitted,
            outcome
        } = photoSubmission;

        // Extract information from the submitted and outcome objects
        const submittedTitle = submitted ? submitted.title : '';
        const submittedTimestamp = submitted ? submitted.timestamp : null;
        const outcomeTitle = outcome ? outcome.title : '';
        const outcomeTimestamp = outcome ? outcome.timestamp : null;

        // Create the main container for the nominations list item
        const photosItemContainer = document.createElement('app-nominations-list-item');
        photosItemContainer.classList.add(`${ngcontent}-c202`);

        const outcomeClass = status === "pending"
        ? "nomination-tag--queue"
        : status === "accepted"
        ? "nomination-tag--accepted"
        : status === "rejected"
        ? "nomination-tag--rejected"
        : "nomination-tag--queue"; // Default class if none of the conditions match

        // Determine if the sash icon should be added
        const includeSashIcon = photoSubmission.status === "accepted";

        // Add the sash icon HTML if needed
        const sashIconHTML = includeSashIcon
        ? `<img src="/img/sash.svg" alt="" class="relative -top-5 left-4 ng-star-inserted">`
  : "";

        const htmlContent = `
    <div class="nominations-item">
   <img alt="" class="w-24 h-20 rounded mr-4 object-cover" src="${imageUrl}">
   <div class="flex flex-col h-full w-full py-3 justify-between">
      <div class="flex flex-row justify-between">
         <div>
            <div class="flex flex-row items-center">
               <span class="font-bold">${title}</span><!---->
            </div>
            <div class="text-xs"> </div>
         </div>
         ${sashIconHTML}
         <!---->
      </div>
      <div class="flex flex-row justify-between items-center my-2">
         <app-nomination-tag-set class="flex flex-wrap nominations-item__tags">
            <app-nomination-tag ${ngcontent}-c200="" class="mr-1">
            <div class="nomination-tag">
               <!----><!----><!----><!----><!----><!----><span class="${outcomeClass}"> ${status} </span><!----><!----><!----><!----><!---->
            </div>
            <!---->
            </app-nomination-tag>
            <!----><!----><!----><!---->
         </app-nomination-tag-set>
         <div class="text-xs whitespace-nowrap">${formatDate(submittedTimestamp)}</div>
      </div>
   </div>
</div>
<!---->
    `

    // Set the HTML content
    photosItemContainer.innerHTML = htmlContent;

        // Append the nominations list item to the photos-list-box div
        photosListBox.appendChild(photosItemContainer);

        // Add a click event listener to the photosItemContainer
        photosItemContainer.addEventListener('click', () => {
            // Remove selection highlighting from all items in the photos list
            const allItems = photosListBox.querySelectorAll('app-nominations-list-item');
            allItems.forEach(item => {
                const childDiv = item.querySelector('.nominations-item');
                if (childDiv) {
                    childDiv.classList.remove('nominations-item--selected');
                }
            });

            // Add selection highlighting to the chosen box
            const selectedChildDiv = photosItemContainer.querySelector('.nominations-item');
            if (selectedChildDiv) {
                selectedChildDiv.classList.add('nominations-item--selected');
            }

            // Create the photo details pane
            createPhotoDetailsPane(photoSubmission);
        });
    }

    // Function to handle search input change
    function handleSearchInputChange() {
        const searchInput = document.getElementById('photos-search-input');

        if (searchInput) {
            searchInput.addEventListener('input', sortAndFilterPhotoSubmissions);
        }
    }

    // Function to create filter overlay
    function createFilterOverlay() {
        // Reset current filter (just in case)
        clearOverlay();

        // Create a new div with class "cdk-overlay-container"
        const newOverlayContainer = document.createElement('div');
        newOverlayContainer.classList.add('cdk-overlay-photos-container');

        const htmlContent = `
<div class="cdk-overlay-container">
  <div class="cdk-overlay-backdrop cdk-overlay-dark-backdrop cdk-overlay-backdrop-showing"></div>
  <div class="cdk-global-overlay-wrapper" dir="ltr" style="justify-content: center; align-items: center;">
    <div id="cdk-overlay-1" class="cdk-overlay-pane" style="max-width: 80vw; width: 350px; position: static;">
      <div tabindex="0" class="cdk-visually-hidden cdk-focus-trap-anchor" aria-hidden="true"></div>
      <mat-dialog-container tabindex="-1" aria-modal="true" class="mat-dialog-container ng-tns-c129-3 ng-trigger ng-trigger-dialogContainer ng-star-inserted" id="mat-dialog-2" role="dialog" style="transform: none;">
        <app-nominations-sort-modal ${nghost}-c190="" class="ng-star-inserted">
          <div ${ngcontent}-c190="" class="w-full" style="">
            <div ${ngcontent}-c190="">
              <h4 ${ngcontent}-c190="" class="mb-2">Arrange</h4>
              <mat-radio-group ${ngcontent}-c190="" role="radiogroup" formcontrolname="arrangeBy" class="mat-radio-group flex flex-col space-y-2">
                <mat-radio-button ${ngcontent}-c190="" class="mat-radio-button mat-accent" id="photo-radio-alphabetical">
                  <label class="mat-radio-label" for="photo-radio-alphabetical-input">
                    <span class="mat-radio-container">
                      <span class="mat-radio-outer-circle"></span>
                      <span class="mat-radio-inner-circle"></span>
                      <input type="radio" class="mat-radio-input cdk-visually-hidden" id="photo-radio-alphabetical-input" tabindex="0" name="photo-arrange-radio-group" value="ALPHABETICAL">
                      <span mat-ripple="" class="mat-ripple mat-radio-ripple mat-focus-indicator">
                        <span class="mat-ripple-element mat-radio-persistent-ripple"></span>
                      </span>
                    </span>
                    <span class="mat-radio-label-content">
                      <span style="display: none;">&nbsp;</span>Alphabetical </span>
                  </label>
                </mat-radio-button>
                <mat-radio-button ${ngcontent}-c190="" class="mat-radio-button mat-radio-checked mat-accent" id="photo-radio-recent">
                  <label class="mat-radio-label" for="photo-radio-recent-input">
                    <span class="mat-radio-container">
                      <span class="mat-radio-outer-circle"></span>
                      <span class="mat-radio-inner-circle"></span>
                      <input type="radio" class="mat-radio-input cdk-visually-hidden" id="photo-radio-recent-input" tabindex="0" name="photo-arrange-radio-group" value="RECENT">
                      <span mat-ripple="" class="mat-ripple mat-radio-ripple mat-focus-indicator">
                        <span class="mat-ripple-element mat-radio-persistent-ripple"></span>
                      </span>
                    </span>
                    <span class="mat-radio-label-content">
                      <span style="display: none;">&nbsp;</span>Most Recent </span>
                  </label>
                </mat-radio-button>
            </div>
            <div ${ngcontent}-c190="" class="mt-4">
              <h4 ${ngcontent}-c190="" class="mb-2">Show</h4>
              <div ${ngcontent}-c190="" class="sort-modal__statuses flex flex-col">
                <wf-checkbox ${ngcontent}-c190="" value="status" class="wf-checkbox">
                  <mat-checkbox class="mat-checkbox mat-accent" id="photo-filter-pending">
                    <label class="mat-checkbox-layout" for="photo-filter-pending-input">
                      <span class="mat-checkbox-inner-container">
                        <input type="checkbox" class="mat-checkbox-input cdk-visually-hidden" id="photo-filter-pending-input" tabindex="0" aria-checked="false">
                        <span matripple="" class="mat-ripple mat-checkbox-ripple mat-focus-indicator">
                          <span class="mat-ripple-element mat-checkbox-persistent-ripple"></span>
                        </span>
                        <span class="mat-checkbox-frame"></span>
                        <span class="mat-checkbox-background">
                          <svg version="1.1" focusable="false" viewBox="0 0 24 24" xml:space="preserve" class="mat-checkbox-checkmark">
                            <path fill="none" stroke="white" d="M4.1,12.7 9,17.6 20.3,6.3" class="mat-checkbox-checkmark-path"></path>
                          </svg>
                          <span class="mat-checkbox-mixedmark"></span>
                        </span>
                      </span>
                      <span class="mat-checkbox-label">
                        <span style="display: none;">&nbsp;</span> Pending </span>
                    </label>
                  </mat-checkbox>
                </wf-checkbox>
                <wf-checkbox ${ngcontent}-c190="" value="status" class="wf-checkbox">
                  <mat-checkbox class="mat-checkbox mat-accent" id="photo-filter-accepted">
                    <label class="mat-checkbox-layout" for="photo-filter-accepted-input">
                      <span class="mat-checkbox-inner-container">
                        <input type="checkbox" class="mat-checkbox-input cdk-visually-hidden" id="photo-filter-accepted-input" tabindex="0" aria-checked="false">
                        <span matripple="" class="mat-ripple mat-checkbox-ripple mat-focus-indicator">
                          <span class="mat-ripple-element mat-checkbox-persistent-ripple"></span>
                        </span>
                        <span class="mat-checkbox-frame"></span>
                        <span class="mat-checkbox-background">
                          <svg version="1.1" focusable="false" viewBox="0 0 24 24" xml:space="preserve" class="mat-checkbox-checkmark">
                            <path fill="none" stroke="white" d="M4.1,12.7 9,17.6 20.3,6.3" class="mat-checkbox-checkmark-path"></path>
                          </svg>
                          <span class="mat-checkbox-mixedmark"></span>
                        </span>
                      </span>
                      <span class="mat-checkbox-label">
                        <span style="display: none;">&nbsp;</span> Accepted </span>
                    </label>
                  </mat-checkbox>
                </wf-checkbox>
                <wf-checkbox ${ngcontent}-c190="" value="status" class="wf-checkbox">
                  <mat-checkbox class="mat-checkbox mat-accent" id="photo-filter-rejected">
                    <label class="mat-checkbox-layout" for="photo-filter-rejected-input">
                      <span class="mat-checkbox-inner-container">
                        <input type="checkbox" class="mat-checkbox-input cdk-visually-hidden" id="photo-filter-rejected-input" tabindex="0" aria-checked="false">
                        <span matripple="" class="mat-ripple mat-checkbox-ripple mat-focus-indicator">
                          <span class="mat-ripple-element mat-checkbox-persistent-ripple"></span>
                        </span>
                        <span class="mat-checkbox-frame"></span>
                        <span class="mat-checkbox-background">
                          <svg version="1.1" focusable="false" viewBox="0 0 24 24" xml:space="preserve" class="mat-checkbox-checkmark">
                            <path fill="none" stroke="white" d="M4.1,12.7 9,17.6 20.3,6.3" class="mat-checkbox-checkmark-path"></path>
                          </svg>
                          <span class="mat-checkbox-mixedmark"></span>
                        </span>
                      </span>
                      <span class="mat-checkbox-label">
                        <span style="display: none;">&nbsp;</span> Rejected </span>
                    </label>
                  </mat-checkbox>
                </wf-checkbox>
              </div>
              <div ${ngcontent}-c190="" class="flex flex-row w-full justify-between mt-4">
                <button ${ngcontent}-c190="" wf-button="" class="wf-button" id="filter_cancel">Cancel</button>
                <button ${ngcontent}-c190="" wf-button="" wftype="primary" class="wf-button wf-button--primary" id="filter_accept"> Filter </button>
              </div>
            </div>
          </div>
          <!---->
        </app-nominations-sort-modal>
        <!---->
      </mat-dialog-container>
      <div tabindex="0" class="cdk-visually-hidden cdk-focus-trap-anchor" aria-hidden="true"></div>
    </div>
  </div>
</div>
        `

    // Set the HTML content
    newOverlayContainer.innerHTML = htmlContent;

        // Append the new overlay container to the end of the body
        document.body.appendChild(newOverlayContainer);

        // Initialise filter settings to match last used setting
        initializeFilterSettings();

        // Add event listener to the overlay backdrop
        const overlayBackdrop = document.querySelector('.cdk-overlay-backdrop');
        if (overlayBackdrop) {
            overlayBackdrop.addEventListener('click', clearOverlay);
        } else {
            console.error('Filter overlay backdrop not found.');
        }

        // Add event listener to the cancel button
        const cancelButton = document.getElementById('filter_cancel');
        if (cancelButton) {
            cancelButton.addEventListener('click', clearOverlay);
        } else {
            console.error('Cancel button not found.');
        }

        // Add event listeners to each checkbox
        const checkboxes = document.querySelectorAll('.mat-checkbox-input');
        checkboxes.forEach((checkbox) => {
            checkbox.addEventListener('click', handleCheckboxClick);
        });

        // Add event listeners to radio buttons
        const radioButtons = document.querySelectorAll('.mat-radio-input');
        radioButtons.forEach((radioButton) => {
            radioButton.addEventListener('click', handleRadioButtonClick);
        });

        // Add event listen for 'Filter' button
        const filterButton = document.getElementById('filter_accept');
        filterButton.addEventListener('click', handleFilterButtonClick);
    }

    // Function to handle checkbox click event
    function handleCheckboxClick(event) {
        // Get the clicked checkbox
        const checkbox = event.target;

        // Get the parent mat-checkbox element
        const parentCheckbox = checkbox.closest('.mat-checkbox');

        // Invert the value of aria-checked
        const newAriaCheckedValue = checkbox.getAttribute('aria-checked') === 'true' ? 'false' : 'true';
        checkbox.setAttribute('aria-checked', newAriaCheckedValue);

        // Toggle the class of the parent mat-checkbox
        if (newAriaCheckedValue === 'true') {
            parentCheckbox.classList.add('mat-checkbox-checked');
        } else {
            parentCheckbox.classList.remove('mat-checkbox-checked');
        }
    }


    // Function to handle "Filter" button click event
    function handleFilterButtonClick() {
        // Save checkbox settings
        const checkboxes = document.querySelectorAll('.mat-checkbox-input');
        checkboxes.forEach((checkbox) => {
            const checkboxId = checkbox.id.replace('photo-filter-', '').replace('-input', '');
            filterSettings[checkboxId] = checkbox.getAttribute('aria-checked') === 'true';
        });

        // Check if all filter settings are false, then set them all to true
        if (!filterSettings.pending && !filterSettings.accepted && !filterSettings.rejected) {
            filterSettings.pending = true;
            filterSettings.accepted = true;
            filterSettings.rejected = true;
        }

        // Save radio button value
        const selectedRadioButton = document.querySelector('.mat-radio-button.mat-radio-checked .mat-radio-input');
        arrangementSettings = selectedRadioButton ? selectedRadioButton.value : 'RECENT';

        // Update button and text span based on arrangementSettings
        const sortButton = document.getElementById('photos-sort-button');
        const sortText = document.getElementById('photo-sort-text');

        if (arrangementSettings === 'RECENT') {
            sortText.textContent = 'Most Recent';
            sortDirection = 'DESCENDING';
        } else if (arrangementSettings === 'ALPHABETICAL') {
            sortText.textContent = 'Alphabetical';
            sortDirection = 'ASCENDING';
        }

        // Remove the class "reverse-btn--rotate" if present
        sortButton.classList.remove('reverse-btn--rotate');

        clearOverlay();
        sortAndFilterPhotoSubmissions();
    }

    // Function to initialize filter settings
    function initializeFilterSettings() {
        // Leave checkboxes unchecked if all filters are on
        let allTrue = filterSettings.pending && filterSettings.accepted && filterSettings.rejected;

        if (!allTrue) {
            const checkboxes = document.querySelectorAll('.mat-checkbox-input');

            checkboxes.forEach((checkbox) => {
                const checkboxId = checkbox.id.replace('photo-filter-', '').replace('-input', '');
                const parentCheckbox = checkbox.closest('.mat-checkbox');

                if (filterSettings[checkboxId]) {
                    checkbox.setAttribute('aria-checked', 'true');
                    parentCheckbox.classList.add('mat-checkbox-checked');
                } else {
                    checkbox.setAttribute('aria-checked', 'false');
                    parentCheckbox.classList.remove('mat-checkbox-checked');
                }
            });
        }

        // Initialize radio buttons based on arrangementSettings
        const radioButtons = document.querySelectorAll('.mat-radio-button');
        radioButtons.forEach((radioButton) => {
            const parentRadioButton = radioButton.closest('.mat-radio-button');
            const radioButtonId = radioButton.id.replace('photo-radio-', '').replace('-input', '');

            if (arrangementSettings === 'ALPHABETICAL' && radioButtonId === 'alphabetical') {
                parentRadioButton.classList.add('mat-radio-checked');
            } else if (arrangementSettings === 'RECENT' && radioButtonId === 'recent') {
                parentRadioButton.classList.add('mat-radio-checked');
            } else {
                parentRadioButton.classList.remove('mat-radio-checked');
            }
        });
    }

    // Function to handle radio button click event
    function handleRadioButtonClick(event) {
        // Get the clicked radio button
        const radioButton = event.target;

        // Get the parent mat-radio-button element
        const parentRadioButton = radioButton.closest('.mat-radio-button');

        // Unselect all radio buttons
        const allRadioButtons = document.querySelectorAll('.mat-radio-button');
        allRadioButtons.forEach((radioButtonElement) => {
            radioButtonElement.classList.remove('mat-radio-checked');
        });

        // Select the clicked radio button
        parentRadioButton.classList.add('mat-radio-checked');
    }

    // Function to handle sort button click event
    function handleSortButtonClicked() {
        const sortButton = document.getElementById('photos-sort-button');

        // Invert the value of sortDirection
        sortDirection = sortDirection === 'ASCENDING' ? 'DESCENDING' : 'ASCENDING';

        // Toggle the class "reverse-btn--rotate"
        sortButton.classList.toggle('reverse-btn--rotate');

        sortAndFilterPhotoSubmissions();
    }

    // Function to handle the "Escape" key press
    function handleEscapeKey(event) {
        if (event.key === 'Escape') {
            clearOverlay();
        }
    }

    function createImageOverlay(imageUrl) {
        const overlayDiv = document.createElement('div');
        overlayDiv.classList.add('cdk-overlay-photos-container');
        overlayDiv.innerHTML = `
      <div class="cdk-overlay-backdrop wf-image-modal-backdrop cdk-overlay-backdrop-showing"></div>
  <div class="cdk-global-overlay-wrapper" dir="ltr" style="justify-content: center; align-items: center;">
    <div id="cdk-overlay-1" class="cdk-overlay-pane wf-image-modal-panel" style="max-width: 80vw; position: static;">
      <div tabindex="0" class="cdk-visually-hidden cdk-focus-trap-anchor" aria-hidden="true"></div>
      <mat-dialog-container tabindex="-1" aria-modal="true" class="mat-dialog-container ng-tns-c129-2 ng-trigger ng-trigger-dialogContainer ng-star-inserted" id="mat-dialog-1" role="dialog" style="transform: none;">
        <wf-image-dialog class="ng-star-inserted">
          <div ${ngcontent}-c143="" class="fixed inset-0 flex items-center justify-center cursor-pointer">
            <img ${ngcontent}-c143="" class="max-h-full object-contain cursor-pointer" src="${imageUrl}=s0">
          </div>
          <button ${ngcontent}-c143="" mat-dialog-close="" tabindex="0" class="absolute left-0 top-0 p-4 text-white dark:text-white" type="button">
            <mat-icon ${ngcontent}-c143="" role="img" class="mat-icon notranslate material-icons mat-icon-no-color" aria-hidden="true" data-mat-icon-type="font">clear</mat-icon>
          </button>
        </wf-image-dialog>
        <!---->
      </mat-dialog-container>
      <div tabindex="0" class="cdk-visually-hidden cdk-focus-trap-anchor" aria-hidden="true"></div>
    </div>
  </div>
    `;

        // Append the overlayDiv to the body or a specific container
        document.body.appendChild(overlayDiv);

        // Add event listener to the overlay backdrop
        const overlayBackdrop = document.querySelector('.cdk-global-overlay-wrapper');
        if (overlayBackdrop) {
            overlayBackdrop.addEventListener('click', clearOverlay);
        }

        // Add a click event listener to the image element
        const imageElement = document.querySelector('.max-h-full');
        imageElement.addEventListener('click', function () {
            window.open(`${imageUrl}=s0`, '_blank');
        });
    }

    function clearOverlay() {
        const existingOverlayContainer = document.querySelector('.cdk-overlay-photos-container');
        if (existingOverlayContainer) {
            existingOverlayContainer.remove();
        }
    }

    function clearPhotosListBox() {
        photosListBox.innerHTML = "";
    }

    function createPhotoDetailsPane(photoSubmission) {
        // Clear existing details pane if present
        const existingPhotoDetailsPane = document.getElementById('photo-details-pane');
        if (existingPhotoDetailsPane) {
            existingPhotoDetailsPane.remove();
        }

        // Extract information from the photoSubmission object
        const { title, submission, status, imageUrl } = photoSubmission;
        const submittedTimestamp = photoSubmission.submitted.timestamp;
        const outcomeTimestamp = photoSubmission.outcome ? photoSubmission.outcome.timestamp : null;

        // Create the details pane structure
        const detailsPane = document.createElement('photo-details-pane');
        detailsPane.setAttribute('class', 'nominations__detail');
        detailsPane.setAttribute('id', 'photo-details-pane');
        detailsPane.setAttribute(`${ngcontent}-c208`, '');
        detailsPane.setAttribute(`${nghost}-c207`, '');

        let outcomeHtml = '';

        if (status === 'accepted') {
            outcomeHtml = `<p ${ngcontent}-c207="" class="mb=4">Accepted: ${formatDate(outcomeTimestamp)}</p>`
    } else if (status === 'rejected') {
        outcomeHtml = `<p ${ngcontent}-c207="" class="mb=4">Rejected: ${formatDate(outcomeTimestamp)}</p>`
    } else {
        outcomeHtml = `<p ${ngcontent}-c207="" class="mb=4"> </p>`
    }

        detailsPane.innerHTML = `
        <div ${ngcontent}-c207="" class="w-full h-full">
            <div ${ngcontent}-c207="" class="card details-pane dark:bg-gray-800">
            <div ${ngcontent}-c207="">
                <div ${ngcontent}-c207="" class="details-header">
                    <div ${ngcontent}-c207="">
                        <h4 ${ngcontent}-c207="" >${title}</h4>
                    </div>
                </div>
                <p ${ngcontent}-c207="" class="mb=4">Submitted: ${formatDate(submittedTimestamp)}</p>
                ${outcomeHtml}
                <img ${ngcontent}-c207="" role="button" tabindex="0" alt="" wf-image-modal="" class="wf-image-modal details-pane__image" src="${imageUrl}">
            </div>
            </div>
        </div>
    `;

        // Find the parent of wf-page-header
        const pageHeaderParent = document.querySelector('wf-page-header').parentNode;

        // Attach the details pane as the next sibling of the parent
        pageHeaderParent.parentNode.insertBefore(detailsPane, pageHeaderParent.nextSibling);

        // Get the elements with the class 'details-pane__image'
        const imageElements = document.querySelectorAll('.details-pane__image');

        // Add a click event listener to each image element
        imageElements.forEach(imageElement => {
            imageElement.addEventListener('click', function () {
                // Get the imageUrl from the 'src' attribute of the clicked image
                const imageUrl = this.getAttribute('src');

                // Call createImageOverlay with the imageUrl
                createImageOverlay(imageUrl);
            });
        });
    }

    function formatDate(timestamp) {
        if (!timestamp) return '-';

        const date = new Date(timestamp);
        const options = { year: 'numeric', month: 'short', day: 'numeric' };
        return date.toLocaleDateString(undefined, options);
    }

    // Function to append custom styles
    function appendCustomStyles() {
        const styleElement = document.createElement('style');
        styleElement.textContent = `

    .hidden-list {
    display: none !important;
}
            .photoTopButton {
                background-color: #e5e5e5;
                border: none;
                color: #ff4713;
                padding: 10px 10px;
                margin: 10px;
                text-align: center;
                text-decoration: none;
                display: inline-block;
                font-size: 16px;
                cursor: pointer;
            }
            .photoMethodButton {
                background-color: #e5e5e5;
                border: none;
                padding: 10px 10px;
                cursor: pointer;
                width: 100%;
                background-size: 30px;
                background-position: 15px;
                background-repeat: no-repeat;
                margin-bottom: 10px;
            }
            .photoMethodButton .photoMethodTitle {
                color: #ff4713;
                font-size: 16px;
            }
            .photoMethodButton .photoMethodDesc {
                font-size: 12px;
            }
            .photoCancelButton {
                color: #000000;
            }
            .photoGAScriptTable {
                width: 100%;
            }
            .photoGAScriptTable td {
                border: none;
            }
            .photoGAScriptTable input {
                background-color: #ddd;
                width: 100%;
                padding: 5px;
            }
            .dark .photoGAScriptTable input {
                background-color: #222;
            }

            .dark .photoTopButton {
                background-color: #404040;
                color: #20B8E3;
            }
            .dark .photoCancelButton {
                color: #ff0000;
            }
            .dark .photoMethodButton {
                background-color: #404040;
            }
            .dark .photoMethodButton .photoMethodTitle {
                color: #20B8E3;
            }

            .photoImportBg {
                position: fixed;
                top: 0;
                left: 0;
                height: 100vh;
                width: 100vw;
                background-color: rgba(0,0,0,0.5);
                z-index: 100000;
            }
            .photoImportInner {
                position: absolute;
                top: 50%;
                left: 50%;
                transform: translateX(-50%) translateY(-50%);
                width: calc(100vw - 50px);
                height: calc(100vh - 50px);
                overflow-x: hidden;
                overflow-y: scroll;
                background-color: #fff;
                padding: 20px;
                max-width: 900px;
                max-height: 500px;
            }
            .photoImportMethod {
                max-width: 500px;
                height: initial;
            }
            .photoImportGAScriptOptions {
                max-width: 700px;
                height: initial;
            }
            .dark .photoImportInner {
                background-color: #333;
            }
            .photoImportInner h3 {
                font-weight: bold;
                margin: 10px auto;
            }
            .photoImportInner > p {
                margin: 10px auto;
            }
            .photoImportLoading {
                text-align: center;
                position: absolute;
                top: 50%;
                left: 50%;
                transform: translateX(-50%) translateY(-50%);
                padding: 20px;
                background-color: #fff;
            }
            .dark .photoImportLoading {
                background-color: #333;
            }
            .photoImportLoading h2 {
                margin-bottom: 10px;
            }
            .photoImportEntry {
                margin: 10px 0;
            }

.mat-dialog-container{display:block;padding:24px;border-radius:4px;box-sizing:border-box;overflow:auto;outline:0;width:100%;height:100%;min-height:inherit;max-height:inherit}.cdk-high-contrast-active .mat-dialog-container{outline:solid 1px}.mat-dialog-content{display:block;margin:0 -24px;padding:0 24px;max-height:65vh;overflow:auto;-webkit-overflow-scrolling:touch}.mat-dialog-title{margin:0 0 20px;display:block}.mat-dialog-actions{padding:8px 0;display:flex;flex-wrap:wrap;min-height:52px;align-items:center;box-sizing:content-box;margin-bottom:-24px}.mat-dialog-actions[align=end]{justify-content:flex-end}.mat-dialog-actions[align=center]{justify-content:center}.mat-dialog-actions .mat-button-base+.mat-button-base,.mat-dialog-actions .mat-mdc-button-base+.mat-mdc-button-base{margin-left:8px}[dir=rtl] .mat-dialog-actions .mat-button-base+.mat-button-base,[dir=rtl] .mat-dialog-actions .mat-mdc-button-base+.mat-mdc-button-base{margin-left:0;margin-right:8px}
  .sort-modal__statuses[${ngcontent}-c190] {
    display: flex;
    flex-direction: column;
    flex-wrap: wrap;
    max-height: 12rem
  }

  .sort-modal__statuses[${ngcontent}-c190] wf-checkbox[${ngcontent}-c190] {
    margin-bottom: .5rem
  }

  .mat-radio-button {
    display: inline-block;
    -webkit-tap-highlight-color: transparent;
    outline: 0
  }

  .mat-radio-label {
    -webkit-user-select: none;
    -moz-user-select: none;
    -ms-user-select: none;
    user-select: none;
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    white-space: nowrap;
    vertical-align: middle;
    width: 100%
  }

  .mat-radio-container {
    box-sizing: border-box;
    display: inline-block;
    position: relative;
    width: 20px;
    height: 20px;
    flex-shrink: 0
  }

  .mat-radio-outer-circle {
    box-sizing: border-box;
    display: block;
    height: 20px;
    left: 0;
    position: absolute;
    top: 0;
    transition: border-color ease 280ms;
    width: 20px;
    border-width: 2px;
    border-style: solid;
    border-radius: 50%
  }

  ._mat-animation-noopable .mat-radio-outer-circle {
    transition: none
  }

  .mat-radio-inner-circle {
    border-radius: 50%;
    box-sizing: border-box;
    display: block;
    height: 20px;
    left: 0;
    position: absolute;
    top: 0;
    transition: transform ease 280ms, background-color ease 280ms;
    width: 20px;
    transform: scale(0.001);
    -webkit-print-color-adjust: exact;
    color-adjust: exact
  }

  ._mat-animation-noopable .mat-radio-inner-circle {
    transition: none
  }

  .mat-radio-checked .mat-radio-inner-circle {
    transform: scale(0.5)
  }

  .cdk-high-contrast-active .mat-radio-checked .mat-radio-inner-circle {
    border: solid 10px
  }

  .mat-radio-label-content {
    -webkit-user-select: auto;
    -moz-user-select: auto;
    -ms-user-select: auto;
    user-select: auto;
    display: inline-block;
    order: 0;
    line-height: inherit;
    padding-left: 8px;
    padding-right: 0
  }

  [dir=rtl] .mat-radio-label-content {
    padding-right: 8px;
    padding-left: 0
  }

  .mat-radio-label-content.mat-radio-label-before {
    order: -1;
    padding-left: 0;
    padding-right: 8px
  }

  [dir=rtl] .mat-radio-label-content.mat-radio-label-before {
    padding-right: 0;
    padding-left: 8px
  }

  .mat-radio-disabled,
  .mat-radio-disabled .mat-radio-label {
    cursor: default
  }

  .mat-radio-button .mat-radio-ripple {
    position: absolute;
    left: calc(50% - 20px);
    top: calc(50% - 20px);
    height: 40px;
    width: 40px;
    z-index: 1;
    pointer-events: none
  }

  .mat-radio-button .mat-radio-ripple .mat-ripple-element:not(.mat-radio-persistent-ripple) {
    opacity: .16
  }

  .mat-radio-persistent-ripple {
    width: 100%;
    height: 100%;
    transform: none;
    top: 0;
    left: 0
  }

  .mat-radio-container:hover .mat-radio-persistent-ripple {
    opacity: .04
  }

  .mat-radio-button:not(.mat-radio-disabled).cdk-keyboard-focused .mat-radio-persistent-ripple,
  .mat-radio-button:not(.mat-radio-disabled).cdk-program-focused .mat-radio-persistent-ripple {
    opacity: .12
  }

  .mat-radio-persistent-ripple,
  .mat-radio-disabled .mat-radio-container:hover .mat-radio-persistent-ripple {
    opacity: 0
  }

  @media(hover: none) {
    .mat-radio-container:hover .mat-radio-persistent-ripple {
      display: none
    }
  }

  .mat-radio-input {
    bottom: 0;
    left: 50%
  }

  .cdk-high-contrast-active .mat-radio-disabled {
    opacity: .5
  }

  @keyframes mat-checkbox-fade-in-background {
    0% {
      opacity: 0
    }

    50% {
      opacity: 1
    }
  }

  @keyframes mat-checkbox-fade-out-background {

    0%,
    50% {
      opacity: 1
    }

    100% {
      opacity: 0
    }
  }

  @keyframes mat-checkbox-unchecked-checked-checkmark-path {

    0%,
    50% {
      stroke-dashoffset: 22.910259
    }

    50% {
      animation-timing-function: cubic-bezier(0, 0, 0.2, 0.1)
    }

    100% {
      stroke-dashoffset: 0
    }
  }

  @keyframes mat-checkbox-unchecked-indeterminate-mixedmark {

    0%,
    68.2% {
      transform: scaleX(0)
    }

    68.2% {
      animation-timing-function: cubic-bezier(0, 0, 0, 1)
    }

    100% {
      transform: scaleX(1)
    }
  }

  @keyframes mat-checkbox-checked-unchecked-checkmark-path {
    from {
      animation-timing-function: cubic-bezier(0.4, 0, 1, 1);
      stroke-dashoffset: 0
    }

    to {
      stroke-dashoffset: -22.910259
    }
  }

  @keyframes mat-checkbox-checked-indeterminate-checkmark {
    from {
      animation-timing-function: cubic-bezier(0, 0, 0.2, 0.1);
      opacity: 1;
      transform: rotate(0deg)
    }

    to {
      opacity: 0;
      transform: rotate(45deg)
    }
  }

  @keyframes mat-checkbox-indeterminate-checked-checkmark {
    from {
      animation-timing-function: cubic-bezier(0.14, 0, 0, 1);
      opacity: 0;
      transform: rotate(45deg)
    }

    to {
      opacity: 1;
      transform: rotate(360deg)
    }
  }

  @keyframes mat-checkbox-checked-indeterminate-mixedmark {
    from {
      animation-timing-function: cubic-bezier(0, 0, 0.2, 0.1);
      opacity: 0;
      transform: rotate(-45deg)
    }

    to {
      opacity: 1;
      transform: rotate(0deg)
    }
  }

  @keyframes mat-checkbox-indeterminate-checked-mixedmark {
    from {
      animation-timing-function: cubic-bezier(0.14, 0, 0, 1);
      opacity: 1;
      transform: rotate(0deg)
    }

    to {
      opacity: 0;
      transform: rotate(315deg)
    }
  }

  @keyframes mat-checkbox-indeterminate-unchecked-mixedmark {
    0% {
      animation-timing-function: linear;
      opacity: 1;
      transform: scaleX(1)
    }

    32.8%,
    100% {
      opacity: 0;
      transform: scaleX(0)
    }
  }

  .mat-checkbox-background,
  .mat-checkbox-frame {
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    position: absolute;
    border-radius: 2px;
    box-sizing: border-box;
    pointer-events: none
  }

  .mat-checkbox {
    display: inline-block;
    transition: background 400ms cubic-bezier(0.25, 0.8, 0.25, 1), box-shadow 280ms cubic-bezier(0.4, 0, 0.2, 1);
    cursor: pointer;
    -webkit-tap-highlight-color: transparent
  }

  ._mat-animation-noopable.mat-checkbox {
    transition: none;
    animation: none
  }

  .mat-checkbox .mat-ripple-element:not(.mat-checkbox-persistent-ripple) {
    opacity: .16
  }

  .mat-checkbox-layout {
    -webkit-user-select: none;
    -moz-user-select: none;
    -ms-user-select: none;
    user-select: none;
    cursor: inherit;
    align-items: baseline;
    vertical-align: middle;
    display: inline-flex;
    white-space: nowrap
  }

  .mat-checkbox-label {
    -webkit-user-select: auto;
    -moz-user-select: auto;
    -ms-user-select: auto;
    user-select: auto
  }

  .mat-checkbox-inner-container {
    display: inline-block;
    height: 16px;
    line-height: 0;
    margin: auto;
    margin-right: 8px;
    order: 0;
    position: relative;
    vertical-align: middle;
    white-space: nowrap;
    width: 16px;
    flex-shrink: 0
  }

  [dir=rtl] .mat-checkbox-inner-container {
    margin-left: 8px;
    margin-right: auto
  }

  .mat-checkbox-inner-container-no-side-margin {
    margin-left: 0;
    margin-right: 0
  }

  .mat-checkbox-frame {
    background-color: transparent;
    transition: border-color 90ms cubic-bezier(0, 0, 0.2, 0.1);
    border-width: 2px;
    border-style: solid
  }

  ._mat-animation-noopable .mat-checkbox-frame {
    transition: none
  }

  .cdk-high-contrast-active .mat-checkbox.cdk-keyboard-focused .mat-checkbox-frame {
    border-style: dotted
  }

  .mat-checkbox-background {
    align-items: center;
    display: inline-flex;
    justify-content: center;
    transition: background-color 90ms cubic-bezier(0, 0, 0.2, 0.1), opacity 90ms cubic-bezier(0, 0, 0.2, 0.1);
    -webkit-print-color-adjust: exact;
    color-adjust: exact
  }

  ._mat-animation-noopable .mat-checkbox-background {
    transition: none
  }

  .cdk-high-contrast-active .mat-checkbox .mat-checkbox-background {
    background: none
  }

  .mat-checkbox-persistent-ripple {
    display: block;
    width: 100%;
    height: 100%;
    transform: none
  }

  .mat-checkbox-inner-container:hover .mat-checkbox-persistent-ripple {
    opacity: .04
  }

  .mat-checkbox.cdk-keyboard-focused .mat-checkbox-persistent-ripple {
    opacity: .12
  }

  .mat-checkbox-persistent-ripple,
  .mat-checkbox.mat-checkbox-disabled .mat-checkbox-inner-container:hover .mat-checkbox-persistent-ripple {
    opacity: 0
  }

  @media(hover: none) {
    .mat-checkbox-inner-container:hover .mat-checkbox-persistent-ripple {
      display: none
    }
  }

  .mat-checkbox-checkmark {
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    position: absolute;
    width: 100%
  }

  .mat-checkbox-checkmark-path {
    stroke-dashoffset: 22.910259;
    stroke-dasharray: 22.910259;
    stroke-width: 2.1333333333px
  }

  .cdk-high-contrast-black-on-white .mat-checkbox-checkmark-path {
    stroke: #000 !important
  }

  .mat-checkbox-mixedmark {
    width: calc(100% - 6px);
    height: 2px;
    opacity: 0;
    transform: scaleX(0) rotate(0deg);
    border-radius: 2px
  }

  .cdk-high-contrast-active .mat-checkbox-mixedmark {
    height: 0;
    border-top: solid 2px;
    margin-top: 2px
  }

  .mat-checkbox-label-before .mat-checkbox-inner-container {
    order: 1;
    margin-left: 8px;
    margin-right: auto
  }

  [dir=rtl] .mat-checkbox-label-before .mat-checkbox-inner-container {
    margin-left: auto;
    margin-right: 8px
  }

  .mat-checkbox-checked .mat-checkbox-checkmark {
    opacity: 1
  }

  .mat-checkbox-checked .mat-checkbox-checkmark-path {
    stroke-dashoffset: 0
  }

  .mat-checkbox-checked .mat-checkbox-mixedmark {
    transform: scaleX(1) rotate(-45deg)
  }

  .mat-checkbox-indeterminate .mat-checkbox-checkmark {
    opacity: 0;
    transform: rotate(45deg)
  }

  .mat-checkbox-indeterminate .mat-checkbox-checkmark-path {
    stroke-dashoffset: 0
  }

  .mat-checkbox-indeterminate .mat-checkbox-mixedmark {
    opacity: 1;
    transform: scaleX(1) rotate(0deg)
  }

  .mat-checkbox-unchecked .mat-checkbox-background {
    background-color: transparent
  }

  .mat-checkbox-disabled {
    cursor: default
  }

  .cdk-high-contrast-active .mat-checkbox-disabled {
    opacity: .5
  }

  .mat-checkbox-anim-unchecked-checked .mat-checkbox-background {
    animation: 180ms linear 0ms mat-checkbox-fade-in-background
  }

  .mat-checkbox-anim-unchecked-checked .mat-checkbox-checkmark-path {
    animation: 180ms linear 0ms mat-checkbox-unchecked-checked-checkmark-path
  }

  .mat-checkbox-anim-unchecked-indeterminate .mat-checkbox-background {
    animation: 180ms linear 0ms mat-checkbox-fade-in-background
  }

  .mat-checkbox-anim-unchecked-indeterminate .mat-checkbox-mixedmark {
    animation: 90ms linear 0ms mat-checkbox-unchecked-indeterminate-mixedmark
  }

  .mat-checkbox-anim-checked-unchecked .mat-checkbox-background {
    animation: 180ms linear 0ms mat-checkbox-fade-out-background
  }

  .mat-checkbox-anim-checked-unchecked .mat-checkbox-checkmark-path {
    animation: 90ms linear 0ms mat-checkbox-checked-unchecked-checkmark-path
  }

  .mat-checkbox-anim-checked-indeterminate .mat-checkbox-checkmark {
    animation: 90ms linear 0ms mat-checkbox-checked-indeterminate-checkmark
  }

  .mat-checkbox-anim-checked-indeterminate .mat-checkbox-mixedmark {
    animation: 90ms linear 0ms mat-checkbox-checked-indeterminate-mixedmark
  }

  .mat-checkbox-anim-indeterminate-checked .mat-checkbox-checkmark {
    animation: 500ms linear 0ms mat-checkbox-indeterminate-checked-checkmark
  }

  .mat-checkbox-anim-indeterminate-checked .mat-checkbox-mixedmark {
    animation: 500ms linear 0ms mat-checkbox-indeterminate-checked-mixedmark
  }

  .mat-checkbox-anim-indeterminate-unchecked .mat-checkbox-background {
    animation: 180ms linear 0ms mat-checkbox-fade-out-background
  }

  .mat-checkbox-anim-indeterminate-unchecked .mat-checkbox-mixedmark {
    animation: 300ms linear 0ms mat-checkbox-indeterminate-unchecked-mixedmark
  }

  .mat-checkbox-input {
    bottom: 0;
    left: 50%
  }

  .mat-checkbox .mat-checkbox-ripple {
    position: absolute;
    left: calc(50% - 20px);
    top: calc(50% - 20px);
    height: 40px;
    width: 40px;
    z-index: 1;
    pointer-events: none
  }

  .details-pane[${ngcontent}-c207] {
    display: flex;
    height: 100%;
    width: 100%;
    flex-direction: column;
    padding: 2rem
  }

  .details-pane[${ngcontent}-c207]>div[${ngcontent}-c207],
  .details-pane[${ngcontent}-c207]>h4[${ngcontent}-c207],
  .details-pane[${ngcontent}-c207]>img[${ngcontent}-c207],
  .details-pane[${ngcontent}-c207]>p[${ngcontent}-c207] {
    margin-bottom: 1rem
  }

  .details-pane__section[${ngcontent}-c207] {
    display: flex;
    flex-direction: column;
    justify-content: space-between
  }

  .details-pane__section[${ngcontent}-c207] h5[${ngcontent}-c207] {
    margin-bottom: .5rem;
    font-size: .875rem;
    line-height: 1.25rem;
    --tw-text-opacity: 1;
    color: rgba(115, 115, 115, var(--tw-text-opacity))
  }

  .nightwind[${ngcontent}-c207] .details-pane__section[${ngcontent}-c207] h5[${ngcontent}-c207] {
    transition-duration: .3s;
    transition-property: background-color, border-color, color, fill, stroke
  }

  .dark[${ngcontent}-c207] .details-pane__section[${ngcontent}-c207] h5[${ngcontent}-c207] {
    color: rgba(163, 163, 163, var(--tw-text-opacity))
  }

  .dark[${ngcontent}-c207] .details-pane__section[${ngcontent}-c207] h5.nightwind-prevent[${ngcontent}-c207],
  .dark[${ngcontent}-c207] .nightwind-prevent-block[${ngcontent}-c207] .details-pane__section[${ngcontent}-c207] h5[${ngcontent}-c207] {
    color: rgba(115, 115, 115, var(--tw-text-opacity))
  }

  .details-pane__map[${ngcontent}-c207] {
    display: flex;
    flex-grow: 1;
    max-width: 100%;
    min-height: 30rem
  }

  .details-pane__image[${ngcontent}-c207] {
    margin-left: auto;
    margin-right: auto;
    border-radius: .25rem;
    max-height: 50vh
  }

  .details-header[${ngcontent}-c207] {
    margin-top: 1rem;
    margin-bottom: 2rem;
    display: flex;
    align-items: center;
    justify-content: space-between
  }

  [{$nghost}-c205] {
    display: flex;
    flex-direction: column
  }

  [{$nghost}-c205]>[${ngcontent}-c205]:not([hidden])~[${ngcontent}-c205]:not([hidden]) {
    --tw-space-y-reverse: 0;
    margin-top: calc(1rem * calc(1 - var(--tw-space-y-reverse)));
    margin-bottom: calc(1rem * var(--tw-space-y-reverse))
  }

  @media (min-width:640px) {
    [{$nghost}-c205] {
      flex-direction: row
    }

    [{$nghost}-c205]>[${ngcontent}-c205]:not([hidden])~[${ngcontent}-c205]:not([hidden]) {
      --tw-space-y-reverse: 0;
      margin-top: calc(0px * calc(1 - var(--tw-space-y-reverse)));
      margin-bottom: calc(0px * var(--tw-space-y-reverse))
    }

    [{$nghost}-c205]>[${ngcontent}-c205]:not([hidden])~[${ngcontent}-c205]:not([hidden]) {
      --tw-space-x-reverse: 0;
      margin-right: calc(1rem * var(--tw-space-x-reverse));
      margin-left: calc(1rem * calc(1 - var(--tw-space-x-reverse)))
    }

    [{$nghost}-c205] button[${ngcontent}-c205]:not(:first-child) {
      margin-left: 1rem
    }
  }

  .wf-image-modal {
    cursor: pointer
  }
    `;

        // Append the style element to the document head
        document.head.appendChild(styleElement);
    }
}

init();
