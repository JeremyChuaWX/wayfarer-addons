// ==UserScript==
// @name         Wayfarer Ticket Manager
// @version      0.2.0
// @description  Support for simultaneous tickets
// @namespace    https://gitlab.com/Tntnnbltn/wayfarer-addons
// @downloadURL  https://gitlab.com/Tntnnbltn/wayfarer-addons/-/raw/main/wayfarer-ticket-manager.user.js
// @updateURL    https://gitlab.com/Tntnnbltn/wayfarer-addons/-/raw/main/wayfarer-ticket-manager.user.js
// @homepageURL  https://gitlab.com/Tntnnbltn/wayfarer-addons
// @match        https://wayfarer.nianticlabs.com/*
// @match        https://webchat.helpshift.com/*
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

function init() {

    const ORIGIN_WAYFARER = 'https://wayfarer.nianticlabs.com';
    const ORIGIN_HELPSHIFT = 'https://webchat.helpshift.com';
    const OBJECT_STORE_NAME = 'helpChatSessions';

    const WFTM_SOURCE = 'wftm';

    function isSafeObject(value) {
        return value && typeof value === 'object';
    }

    function initHelp() {

        (function(open) {
            XMLHttpRequest.prototype.open = function(method, url) {
                if (method === 'POST') {
                    if (url === 'https://api.helpshift.com/websdk/niantic/conversations/history' ||
                        url === 'https://api.helpshift.com/websdk/niantic/conversations/updates' ||
                        url.startsWith('https://api.helpshift.com/websdk/niantic/issues/')) {
                        this.addEventListener('load', parseResponse, false);
                        this.addEventListener('readystatechange', function() {
                            if (this.readyState === 4) { // Check if request is complete
                                parseResponse.call(this); // Call parseResponse function when request is complete
                            }
                        });
                    }
                }
                open.apply(this, arguments);
            };
        })(XMLHttpRequest.prototype.open);

        function handleParentMessage(event) {
            if (event.origin !== ORIGIN_WAYFARER) return;
            if (!isSafeObject(event.data)) return;
            if (event.data.source !== WFTM_SOURCE) return;

            const { type, payload } = event.data;

            if (type === 'clearSession') {
                clearLocalStorage();
            } else if (type === 'restoreSession' && payload && payload.aui) {
                updateLocalStorage(payload);
            }
        }

        window.addEventListener('message', handleParentMessage);

        function parseResponse() {
            try {
                const json = JSON.parse(this.responseText);
                if (!json) return;
                console.log(json);
                sendTicketHistory(json);
            } catch (ex) {
                console.error('Error parsing JSON:', ex);
            }
        }

        function loadAndSendSessionValues() {
            const di = localStorage.getItem('di:niantic-4d50991f7c85c5b');
            const asi = localStorage.getItem('asi:niantic-4d50991f7c85c5b');
            const aui = localStorage.getItem('aui:niantic-4d50991f7c85c5b');

            window.parent.postMessage({
                source: WFTM_SOURCE,
                type: 'sessionValues',
                payload: { di, asi, aui }
            }, ORIGIN_WAYFARER);
        }

        loadAndSendSessionValues();

        function sendTicketHistory(data) {
            window.parent.postMessage({
                source: WFTM_SOURCE,
                type: 'ticketHistory',
                payload: data
            }, ORIGIN_WAYFARER);
        }

        function clearLocalStorage() {
            localStorage.clear();
        }

        function updateLocalStorage(data) {
            const suffix = 'niantic-4d50991f7c85c5b';

            const diKey = `di:${suffix}`;
            const asiKey = `asi:${suffix}`;
            const auiKey = `aui:${suffix}`;
            const configKey = `config:${suffix}`;

            const previousAui = localStorage.getItem(auiKey);

            localStorage.setItem(diKey, data.di);
            localStorage.setItem(asiKey, data.asi);
            localStorage.setItem(auiKey, data.aui);

            const rawConfig = localStorage.getItem(configKey);
            if (!rawConfig) return;

            try {
                const configData = JSON.parse(rawConfig);

                // Helpshift now appears to expect the active AUI to exist inside configData.
                // If the restored AUI does not have a config entry, copy one from the current session.
                if (!configData[data.aui]) {
                    if (previousAui && configData[previousAui]) {
                        configData[data.aui] = configData[previousAui];
                    } else {
                        const configKeys = Object.keys(configData);
                        const fallbackKey = configKeys[configKeys.length - 1];

                        if (fallbackKey) {
                            configData[data.aui] = configData[fallbackKey];
                        }
                    }
                }

                // Do not delete old config entries. Current Helpshift storage may contain several.
                localStorage.setItem(configKey, JSON.stringify(configData));
            } catch (ex) {
                console.error('Ticket Manager: Failed to update Helpshift config storage', ex);
            }
        }
    }


    function initWF() {
        let helpChatSessions = JSON.parse(localStorage.getItem(OBJECT_STORE_NAME)) || {};
        let currentSession;
        let isTheNextMessageTheWayspotTitle = false;
        let ticketButtonAdded = false;
        let iframeObserverStarted = false;
        let routeHooked = false;
        let waitingForIframe = false;

        const awaitElement = get => new Promise((resolve, reject) => {
            let triesLeft = 20;

            const queryLoop = () => {
                const ref = get();

                if (ref) {
                    resolve(ref);
                    return;
                }

                triesLeft -= 1;

                if (triesLeft <= 0) {
                    reject(new Error('Element not found'));
                    return;
                }

                setTimeout(queryLoop, 1000);
            };

            queryLoop();
        });

        const decodeHTMLEntities = str => {
            const doc = new DOMParser().parseFromString(str, "text/html");
            return doc.documentElement.textContent;
        };

        // Function to observe changes to iframe width properties
        // Used to detect when the Help Chat is opened
        const observeIframeWidthChanges = () => {
            const iframe = document.getElementById('hs-web-sdk-iframe');
            if (iframe) {
                const observer = new MutationObserver(mutationsList => {
                    for (const mutation of mutationsList) {
                        if (mutation.type === 'attributes' && (mutation.attributeName === 'style' || mutation.attributeName === 'min-width' || mutation.attributeName === 'max-width')) {
                            removeInterfaceContainer();
                        }
                    }
                });
                observer.observe(iframe, { attributes: true });
            }
        };


        function isHelpRoute() {
            return location.origin === ORIGIN_WAYFARER &&
                location.pathname === '/new/help';
        }

        function ensureTicketManagerLoaded(options = {}) {
            const { requireHelpRoute = false } = options;

            if (requireHelpRoute && !isHelpRoute()) {
                removeInterfaceContainer();
                return;
            }

            if (document.getElementById('ticketSwitchButton')) {
                ticketButtonAdded = true;
            }

            if (ticketButtonAdded && iframeObserverStarted) {
                return;
            }

            if (waitingForIframe) {
                return;
            }

            waitingForIframe = true;

            awaitElement(() => document.getElementById('hs-web-sdk-iframe'))
                .then(() => {
                waitingForIframe = false;

                if (!ticketButtonAdded && !document.getElementById('ticketSwitchButton')) {
                    addTicketSwitchButton();
                    ticketButtonAdded = true;
                }

                if (!iframeObserverStarted) {
                    observeIframeWidthChanges();
                    iframeObserverStarted = true;
                }
            })
                .catch(() => {
                waitingForIframe = false;
                console.error('Iframe not found.');
            });
        }

        function handleRouteChange() {
            if (isHelpRoute()) {
                ensureTicketManagerLoaded({ requireHelpRoute: true });
            } else {
                removeInterfaceContainer();
            }
        }

        function hookRouteChanges() {
            if (routeHooked) return;
            routeHooked = true;

            const originalPushState = history.pushState;
            const originalReplaceState = history.replaceState;

            history.pushState = function(...args) {
                originalPushState.apply(this, args);
                setTimeout(handleRouteChange, 0);
            };

            history.replaceState = function(...args) {
                originalReplaceState.apply(this, args);
                setTimeout(handleRouteChange, 0);
            };

            window.addEventListener('popstate', () => {
                setTimeout(handleRouteChange, 0);
            });
        }

        hookRouteChanges();

        // Initial page-load check: look for the iframe regardless of current route.
        ensureTicketManagerLoaded({ requireHelpRoute: false });

        window.addEventListener('message', function(event) {
            if (event.origin !== ORIGIN_HELPSHIFT) return;
            if (!isSafeObject(event.data)) return;
            if (event.data.source !== WFTM_SOURCE) return;

            const { type, payload } = event.data;

            if (type === 'sessionValues' && payload && payload.di && payload.aui) {
                currentSession = payload.aui;

                if (!helpChatSessions[payload.aui]) {
                    helpChatSessions[payload.aui] = {
                        di: payload.di,
                        asi: payload.asi
                    };
                    saveDataToLocalStorage();
                }
            } else if (type === 'ticketHistory' && payload) {
                processTicketData(payload);
            }
        });

        function postToHelp(type, payload = null) {
            const iframe = document.getElementById('hs-web-sdk-iframe');
            if (!iframe || !iframe.contentWindow) {
                console.warn('Ticket Manager: Helpshift iframe not available');
                return false;
            }

            iframe.contentWindow.postMessage({
                source: WFTM_SOURCE,
                type,
                payload
            }, ORIGIN_HELPSHIFT);

            return true;
        }

        function restoreOldTicket(data) {
            const sent = postToHelp('restoreSession', data);
            if (!sent) return;

            saveDataToLocalStorage();
            refreshPage();
        }

        function generateNewTicket() {
            const sent = postToHelp('clearSession');
            if (!sent) return;

            saveDataToLocalStorage();
            refreshPage();
        }

        function saveDataToLocalStorage() {
            const storedData = JSON.parse(localStorage.getItem(OBJECT_STORE_NAME)) || {};
            storedData[currentSession] = helpChatSessions[currentSession];
            localStorage.setItem(OBJECT_STORE_NAME, JSON.stringify(storedData));
        }

        function refreshPage() {
            setTimeout(function() {
                location.reload();
            }, 50);
        }

        function processTicketData(data) {
            if (data.body) {
                let messages = [];
                messages.push(data);
                processTicketMessages(messages);
            } else if (data.issues) {
                processTicketUpdate(data);
            }
        }

        function processTicketUpdate(data) {
            const issues = data.issues;

            if (issues.length > 0) {
                let mostRecentTicket;

                if (issues.length === 1) {
                    mostRecentTicket = issues[0];
                } else if (issues.length > 1) {
                    mostRecentTicket = issues.reduce((prev, current) => {
                        return (new Date(current.created_at) > new Date(prev.created_at)) ? current : prev;
                    });
                } else {
                    console.error("Ticket Manager: Unexpected error in identifying most recent ticket");
                }

                // Set the ticket type based on the most recent ticket's title
                if (mostRecentTicket && mostRecentTicket.title) {
                    const ticketType = categorizeTicketTitle(mostRecentTicket.title);
                    const newTimestamp = mostRecentTicket.created_at;

                    const currentSessionData = helpChatSessions[currentSession];
                    const existingTimestamp = currentSessionData.ticketTypeTimestamp || 0;

                    if (newTimestamp > existingTimestamp) {
                        currentSessionData.type = ticketType;
                        currentSessionData.ticketTypeTimestamp = newTimestamp;
                        helpChatSessions[currentSession].inProgress = true;
                    }

                    // Clear old Wayspot title if its timestamp is older
                    if (currentSessionData.wayspot && currentSessionData.wayspotTimestamp) {
                        if (currentSessionData.wayspotTimestamp < newTimestamp) {
                            currentSessionData.wayspot = null;
                            currentSessionData.wayspotTimestamp = null;
                        }
                    }
                }

                processTicketMessages(mostRecentTicket.messages);
            }
        }

        function categorizeTicketTitle(title) {
            const arrowSeparator = "→ ";
            const parts = title.split(arrowSeparator);

            if (parts.length > 1) {
                const extractedType = parts[1].trim();
                return extractedType;
            } else {
                console.warn("Ticket Manager couldn't parse title: ", title);
                return "???";
            }
        }

        function processTicketMessages(messages) {
            const lastMessage = messages[messages.length - 1];

            if (lastMessage.type === "Confirmation Accepted") {
                helpChatSessions[currentSession].inProgress = false;
                const storedData = JSON.parse(localStorage.getItem(OBJECT_STORE_NAME)) || {};
                storedData[currentSession] = helpChatSessions[currentSession];
                localStorage.setItem(OBJECT_STORE_NAME, JSON.stringify(storedData));
            } else {
                helpChatSessions[currentSession].inProgress = true;

                let wayspotFound = false;
                let wayspotName = '';
                let wayspotTimestamp;

                const wayspotQuestions = [
                    { lang: 'en', question: "What is the name of the Wayspot?" },
                    { lang: 'cs', question: "Jak se jmenuje WaysPot?" },
                    { lang: 'de', question: "Wie heißt der Waypot?" },
                    { lang: 'es', question: "¿Cuál es el nombre de Wayspot?" },
                    { lang: 'fr', question: "Quel est le nom du Wayspot?" },
                    { lang: 'it', question: "Qual è il nome di The Wayspot?" },
                    { lang: 'ja', question: "Wayspotの名前は何ですか？" },
                    { lang: 'ko', question: "Wayspot의 이름은 무엇입니까?" },
                    { lang: 'pt', question: "Qual é o nome do Wayspot?" },
                    { lang: 'nl', question: "Wat is de naam van de WaySpot?" },
                    { lang: 'no', question: "Hva heter WaysPot?" },
                    { lang: 'pl', question: "Jak nazywa się Wayspot?" },
                    { lang: 'sv', question: "Vad heter The WaysPot?" },
                    { lang: 'th', question: "Wayspot ชื่ออะไร?" },
                    { lang: 'zh', question: "Wayspot的名稱是什麼？" },
                    { lang: 'hi', question: "तरीके का नाम क्या है?" },
                    { lang: 'tr', question: "Wayspot'un adı nedir?" },
                ];

                for (let i = 0; i < wayspotQuestions.length; i++) {
                    const currentQuestion = decodeHTMLEntities(wayspotQuestions[i].question);
                    const decodedLastMessage = decodeHTMLEntities(lastMessage.body);
                    if (decodedLastMessage === currentQuestion) {
                        isTheNextMessageTheWayspotTitle = true;
                        break;
                    }
                }

                if (messages.length > 1) {
                    for (let i = messages.length - 1; i >= 0; i--) {
                        const currentMessage = messages[i];
                        const nextMessage = messages[i + 1];

                        if (currentMessage && currentMessage.body && nextMessage && nextMessage.body) {
                            for (let i = 0; i < wayspotQuestions.length; i++) {
                                const currentQuestion = decodeHTMLEntities(wayspotQuestions[i].question);
                                const currentBody = decodeHTMLEntities(currentMessage.body);
                                if (currentBody === currentQuestion && nextMessage.body) {
                                    wayspotFound = true;
                                    wayspotName = decodeHTMLEntities(nextMessage.body);
                                    wayspotTimestamp = nextMessage.created_at;
                                    break;
                                }
                            }
                        }
                    }
                } else if (messages.length === 1) {
                    const currentMessage = messages[0];
                    const currentBody = decodeHTMLEntities(currentMessage.body);

                    // Check if current message matches any known "Wayspot question"
                    // This is a backup to stop it putting "What is the name of the Wayspot?" as the Wayspot title
                    const isCurrentMessageAQuestion = wayspotQuestions.some(q =>
                                                                            currentBody === decodeHTMLEntities(q.question)
                                                                           );

                    if (isTheNextMessageTheWayspotTitle && !isCurrentMessageAQuestion) {
                        wayspotName = currentBody;
                        wayspotTimestamp = currentMessage.created_at;
                        wayspotFound = true;
                        isTheNextMessageTheWayspotTitle = false;
                    }
                }

                if (wayspotFound) {
                    const currentSessionData = helpChatSessions[currentSession];
                    const existingWayspotTimestamp = currentSessionData.wayspotTimestamp || 0;

                    if (wayspotTimestamp > existingWayspotTimestamp) {
                        currentSessionData.wayspot = wayspotName;
                        currentSessionData.wayspotTimestamp = wayspotTimestamp;
                    }
                }

                saveDataToLocalStorage();
            }
        }

        function removeInterfaceContainer() {
            const interfaceContainer = document.getElementById('ticketInterfaceContainer');
            if (interfaceContainer) {
                interfaceContainer.remove();
            }
        }

        function addTicketSwitchButton() {
            if (document.getElementById('ticketSwitchButton')) {
                ticketButtonAdded = true;
                return;
            }

            const containerDiv = document.createElement('div');
            containerDiv.classList.add('wftm-containerDiv');

            containerDiv.innerHTML = `
        <button aria-label="Switch Tickets" id="ticketSwitchButton" style="position: absolute; top: 0px; left: 0px; width: 48px; height: 48px; background: linear-gradient(131deg, rgba(216, 88, 19, 0.75), rgb(216, 88, 19) 123%); border-radius: 50%; cursor: pointer; box-sizing: border-box; padding: 12px 10px 8px; border: none; outline-offset: -4px; outline: rgba(0, 103, 244, 0.4) solid 0px;" class="hs-websdk-launcher-anti-clockwise">
          <span style="background: rgb(233, 75, 75); border-radius: 50%; color: rgb(255, 255, 255); width: 20px; height: 20px; line-height: 20px; text-align: center; font-size: 12px; position: absolute; top: 0px; right: 4px; font-family: sans-serif; left: auto; display: none;"></span>
          <span>
            <svg fill="#ffffff" version="1.1" id="Layer_1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 512 512" xml:space="preserve">
              <g>
                <g>
                  <g>
                    <path d="M72.837,213.333H320c11.782,0,21.333-9.551,21.333-21.333c0-11.782-9.551-21.333-21.333-21.333H72.837l48.915-48.915
				c8.331-8.331,8.331-21.839,0-30.17c-8.331-8.331-21.839-8.331-30.17,0L6.248,176.915c-0.497,0.497-0.967,1.02-1.413,1.564
				c-0.202,0.246-0.378,0.506-0.567,0.759c-0.228,0.304-0.463,0.601-0.675,0.918c-0.203,0.303-0.379,0.618-0.565,0.929
				c-0.171,0.286-0.351,0.566-0.509,0.861c-0.17,0.317-0.314,0.644-0.466,0.968c-0.145,0.307-0.298,0.609-0.429,0.924
				c-0.13,0.315-0.236,0.637-0.35,0.957c-0.121,0.337-0.25,0.669-0.354,1.013c-0.097,0.32-0.168,0.645-0.249,0.969
				c-0.089,0.351-0.187,0.698-0.258,1.056c-0.074,0.375-0.118,0.753-0.172,1.13c-0.044,0.311-0.104,0.618-0.135,0.933
				c-0.138,1.4-0.138,2.811,0,4.211c0.031,0.315,0.09,0.621,0.135,0.933c0.054,0.377,0.098,0.756,0.173,1.13
				c0.071,0.358,0.169,0.704,0.258,1.055c0.081,0.324,0.152,0.649,0.249,0.969c0.104,0.344,0.233,0.677,0.354,1.013
				c0.115,0.32,0.22,0.642,0.35,0.957c0.13,0.315,0.284,0.616,0.429,0.923c0.153,0.324,0.297,0.651,0.467,0.969
				c0.158,0.294,0.337,0.573,0.508,0.859c0.186,0.312,0.362,0.627,0.565,0.931c0.211,0.316,0.446,0.612,0.673,0.916
				c0.19,0.254,0.366,0.514,0.569,0.761c0.443,0.54,0.91,1.059,1.403,1.552c0.004,0.004,0.006,0.008,0.01,0.011l85.333,85.333
				c8.331,8.331,21.839,8.331,30.17,0c8.331-8.331,8.331-21.839,0-30.17L72.837,213.333z" />
                    <path d="M507.164,333.522c0.204-0.248,0.38-0.509,0.571-0.764c0.226-0.302,0.461-0.598,0.671-0.913
				c0.204-0.304,0.38-0.62,0.566-0.932c0.17-0.285,0.349-0.564,0.506-0.857c0.17-0.318,0.315-0.646,0.468-0.971
				c0.145-0.306,0.297-0.607,0.428-0.921c0.13-0.315,0.236-0.637,0.35-0.957c0.121-0.337,0.25-0.669,0.354-1.013
				c0.097-0.32,0.168-0.646,0.249-0.969c0.089-0.351,0.187-0.698,0.258-1.055c0.074-0.375,0.118-0.753,0.173-1.13
				c0.044-0.311,0.104-0.617,0.135-0.933c0.138-1.4,0.138-2.811,0-4.211c-0.031-0.315-0.09-0.621-0.135-0.933
				c-0.054-0.377-0.098-0.756-0.173-1.13c-0.071-0.358-0.169-0.704-0.258-1.055c-0.081-0.324-0.152-0.649-0.249-0.969
				c-0.104-0.344-0.233-0.677-0.354-1.013c-0.115-0.32-0.22-0.642-0.35-0.957c-0.13-0.314-0.283-0.615-0.428-0.921
				c-0.153-0.325-0.297-0.653-0.468-0.971c-0.157-0.293-0.336-0.572-0.506-0.857c-0.186-0.312-0.363-0.628-0.566-0.932
				c-0.211-0.315-0.445-0.611-0.671-0.913c-0.191-0.255-0.368-0.516-0.571-0.764c-0.439-0.535-0.903-1.05-1.392-1.54
				c-0.007-0.008-0.014-0.016-0.021-0.023l-85.333-85.333c-8.331-8.331-21.839-8.331-30.17,0s-8.331,21.839,0,30.17l48.915,48.915
				H192c-11.782,0-21.333,9.551-21.333,21.333s9.551,21.333,21.333,21.333h247.163l-48.915,48.915
				c-8.331,8.331-8.331,21.839,0,30.17s21.839,8.331,30.17,0l85.333-85.333c0.008-0.008,0.014-0.016,0.021-0.023
				C506.261,334.572,506.725,334.057,507.164,333.522z" />
                  </g>
                </g>
              </g>
            </svg>
          </span>
        </button>
    `;

            document.body.appendChild(containerDiv);

            // Add event listener to the button
            const ticketSwitchButton = document.getElementById('ticketSwitchButton');
            ticketSwitchButton.addEventListener('click', function() {
                if (document.getElementById('ticketInterfaceContainer')) {
                    // If interfaceContainer exists, remove it to prevent doubles
                    removeInterfaceContainer();
                } else {
                    // If interfaceContainer doesn't exist, create it
                    const interfaceContainer = document.createElement('div');
                    interfaceContainer.id = 'ticketInterfaceContainer';
                    interfaceContainer.classList.add('wftm-interface-container');

                    const header = document.createElement('header');
                    header.classList.add('wftm-header');

                    const avatarTitleWrapper = document.createElement('div');
                    avatarTitleWrapper.classList.add('wftm-avatarTitleWrapper');

                    const avatarWrapper = document.createElement('div');
                    avatarWrapper.classList.add('wftm-avatarWrapper');

                    const avatarImage = document.createElement('img');
                    avatarImage.src = 'https://s3.amazonaws.com/assets.helpshift.com/niantic/avatar/5b16a10a-a694-4302-9218-337ec26b3150/64.png';
                    avatarImage.alt = 'Avatar Image';
                    avatarImage.classList.add('wftm-avatarImage');
                    avatarWrapper.appendChild(avatarImage);

                    const textWrapper = document.createElement('div');
                    textWrapper.classList.add('wftm-textWrapper');

                    const titleText = document.createElement('span');
                    titleText.textContent = 'Wayfarer Ticket Manager';
                    titleText.classList.add('wftm-titleText');
                    textWrapper.appendChild(titleText);

                    const closeButton = document.createElement('button');
                    closeButton.setAttribute('aria-label', 'Close chat');
                    closeButton.classList.add('wftm-closeButton');
                    closeButton.textContent = '×';
                    closeButton.addEventListener('click', removeInterfaceContainer);

                    avatarTitleWrapper.appendChild(avatarWrapper);
                    avatarTitleWrapper.appendChild(textWrapper);
                    header.appendChild(avatarTitleWrapper);
                    header.appendChild(closeButton);
                    interfaceContainer.appendChild(header);

                    // Create the table
                    const table = document.createElement('table');
                    table.style.color = '#000000';
                    table.style.width = '100%';
                    const tbody = document.createElement('tbody');

                    // Create table headers
                    const thead = document.createElement('thead');
                    const headerRow = document.createElement('tr');

                    // Create and style the header cells
                    const headerNumber = document.createElement('th');
                    headerNumber.textContent = '#';
                    headerNumber.style.textAlign = 'center';

                    const headerSummary = document.createElement('th');
                    headerSummary.textContent = 'Ticket summary';
                    headerSummary.style.textAlign = 'left';

                    const headerRestore = document.createElement('th');
                    headerRestore.textContent = 'Restore';
                    headerRestore.style.textAlign = 'center';

                    const headerDelete = document.createElement('th');
                    headerDelete.textContent = 'Delete';
                    headerDelete.style.textAlign = 'center';

                    headerRow.appendChild(headerNumber);
                    headerRow.appendChild(headerSummary);
                    headerRow.appendChild(headerRestore);
                    headerRow.appendChild(headerDelete);

                    thead.appendChild(headerRow);
                    table.appendChild(thead);

                    // Populate table with helpChatSessions data
                    let index = 1;
                    for (const key in helpChatSessions) {
                        const rowData = helpChatSessions[key];
                        const row = document.createElement('tr');

                        // Create and style the cells
                        const cellNumber = document.createElement('td');
                        cellNumber.textContent = index;
                        cellNumber.style.textAlign = 'center';

                        const cellSummary = document.createElement('td');
                        cellSummary.style.textAlign = 'left';
                        if (rowData.inProgress === false || !rowData.type) {
                            if (!rowData.type) {
                                cellSummary.textContent = 'No active ticket';
                            } else {
                                cellSummary.textContent = `[Previous ticket] ${rowData.type}`;
                                if (rowData.wayspot) {
                                    cellSummary.textContent += `: ${rowData.wayspot}`;
                                }
                            }
                        } else {
                            cellSummary.textContent = rowData.type;
                            if (rowData.wayspot) {
                                cellSummary.textContent += `: ${rowData.wayspot}`;
                            }
                        }

                        const cellRestore = document.createElement('td');
                        cellRestore.style.textAlign = 'center';
                        if (key !== currentSession) {
                            const restoreText = document.createElement('span');
                            restoreText.style.cursor = 'pointer';
                            restoreText.textContent = '♻️';
                            cellRestore.appendChild(restoreText);
                        }

                        const cellDelete = document.createElement('td');
                        cellDelete.style.textAlign = 'center';
                        const deleteText = document.createElement('span');
                        deleteText.style.cursor = 'pointer';
                        deleteText.textContent = '🗑️';
                        cellDelete.appendChild(deleteText);

                        row.appendChild(cellNumber);
                        row.appendChild(cellSummary);
                        row.appendChild(cellRestore);
                        row.appendChild(cellDelete);
                        tbody.appendChild(row);
                        index++;

                        cellDelete.addEventListener('click', function() {
                            const aui = key;
                            // Handle delete action using aui value
                            deleteTicket(aui);
                        });

                        if (key !== currentSession) {
                            cellRestore.addEventListener('click', function() {
                                const aui = key;
                                const asi = helpChatSessions[aui].asi;
                                const di = helpChatSessions[aui].di;
                                restoreOldTicket({ aui, asi, di });
                            });
                        }
                    }

                    // Create the last row for creating a new ticket
                    const lastRow = document.createElement('tr');

                    // Create and style the cells
                    const cellNumberLast = document.createElement('td');
                    cellNumberLast.textContent = index;
                    cellNumberLast.style.textAlign = 'center';

                    const cellSummaryNew = document.createElement('td');
                    cellSummaryNew.style.textAlign = 'left';
                    const linkNewTicket = document.createElement('a');
                    linkNewTicket.href = '#';
                    linkNewTicket.textContent = 'Create a new ticket';
                    linkNewTicket.style.fontWeight = 'bold';
                    linkNewTicket.addEventListener('click', generateNewTicket);
                    cellSummaryNew.appendChild(linkNewTicket);

                    // Create empty cells for the last two columns
                    const cellEmpty1 = document.createElement('td');
                    const cellEmpty2 = document.createElement('td');

                    // Append cells to the last row
                    lastRow.appendChild(cellNumberLast);
                    lastRow.appendChild(cellSummaryNew);
                    lastRow.appendChild(cellEmpty1);
                    lastRow.appendChild(cellEmpty2);
                    tbody.appendChild(lastRow);

                    table.appendChild(tbody);

                    // Create a container for the table with a fixed height and overflow auto
                    const tableContainer = document.createElement('div');
                    tableContainer.style.height = '440px';
                    tableContainer.style.overflow = 'auto';

                    tableContainer.appendChild(table);
                    interfaceContainer.appendChild(tableContainer);

                    document.body.appendChild(interfaceContainer);

                    function deleteTicket(aui) {
                        // Find the index of the aui in the keys of helpChatSessions
                        const keys = Object.keys(helpChatSessions);
                        const index = keys.indexOf(aui);

                        // Remove the corresponding row from the table
                        table.deleteRow(index + 1); // Add 1 to offset the header row

                        // Remove the aui from helpChatSessions
                        delete helpChatSessions[aui];

                        // Remove the aui entry from local storage
                        const storedData = JSON.parse(localStorage.getItem(OBJECT_STORE_NAME)) || {};
                        delete storedData[aui];
                        localStorage.setItem(OBJECT_STORE_NAME, JSON.stringify(storedData));

                        // Update the visual display of row numbers to the AUI and remove it from the tablege
                        const rows = table.querySelectorAll('tr');
                        let rowIndex = 1; // Start from 1 to match the initial index
                        for (let i = 1; i < rows.length; i++) {
                            const row = rows[i];
                            row.cells[0].textContent = rowIndex;
                            rowIndex++;
                        }

                        // Check if helpChatSessions is empty and generate a new ticket if so
                        if (Object.keys(helpChatSessions).length === 0) {
                            generateNewTicket();
                        }
                    }
                }
            });
        }

        // Define CSS styles as a string
        const styles = `
.wftm-containerDiv {
    position: fixed;
    width: 48px;
    height: 48px;
    z-index: 9999991;
    box-shadow: rgba(0, 0, 0, 0.4) 0px 2px 24px 0px;
    border-radius: 50%;
    border: none;
    overflow: hidden;
    margin: 4px;
    padding: 0px;
    box-sizing: content-box;
    outline: none;
    inset: auto 74px 16px auto;
}
.wftm-interface-container {
    display: block;
    position: fixed;
    inset: auto 16px 75px auto;
    min-height: 500px;
    max-height: 500px;
    min-width: 360px;
    max-width: 380px;
    height: calc(100% - 32px);
    width: 100%;
    border: none;
    border-radius: 12px;
    z-index: 9999999;
    overflow: hidden;
    background-color: #f0f2f4;
    transform: translate3d(0px, 0px, 0px);
    box-shadow: rgba(0, 0, 0, 0.2) 0px 4px 32px;
    animation: 0.3s cubic-bezier(0.25, 0.1, 0.25, 1) 0s 1 normal none running hs-websdk-slide-up;
}
.wftm-header {
    display: flex;
    flex: 0 0 auto;
    align-items: center;
    justify-content: space-between;
    height: 60px;
    padding: 0 16px;
    color: var(--header-text-color, #FFFFFF, #111827);
    background: linear-gradient(98deg, var(--header-bg-start-color, #d85813), var(--header-bg-start-color, #d85813bf) 130%);
}
.wftm-avatarTitleWrapper {
    display: flex;
    flex: 0 0 auto;
    align-items: center;
}
.wftm-avatarWrapper {
    position: relative;
}
.wftm-avatarImage {
    height: 36px;
    width: 36px;
    min-width: 36px;
    border-radius: 50%;
}
.wftm-textWrapper {
    padding-left: 16px;
    width: 100%;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: 16px;
    font-weight: 600;
}
.wftm-titleText {
    color: var(--text-color, white);
}
.wftm-closeButton {
    padding: 0;
    margin: 0;
    cursor: pointer;
    background-color: transparent;
    border: none;
    align-items: center;
    justify-content: center;
    height: 36px;
    min-width: 36px;
    border-radius: 50%;
    display: flex;
    color: white;
    font-size: 24px;
}
`

        // Create a style element
        const styleElement = document.createElement('style');
        styleElement.textContent = styles;

        // Append the style element to the document head
        document.head.appendChild(styleElement);
    }


    if (window.origin === ORIGIN_HELPSHIFT) {
        initHelp();
    } else if (window.origin === ORIGIN_WAYFARER) {
        initWF();
    }
}

init();