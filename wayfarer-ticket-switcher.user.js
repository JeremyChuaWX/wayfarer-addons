// ==UserScript==
// @name         Wayfarer Ticket Switcher
// @version      0.0.1
// @description  Support for simultaneous tickets
// @namespace    https://gitlab.com/Tntnnbltn/wayfarer-addons
// @downloadURL  https://gitlab.com/Tntnnbltn/wayfarer-addons/-/raw/main/wayfarer-ticket-switcher.user.js
// @updateURL    https://gitlab.com/Tntnnbltn/wayfarer-addons/-/raw/main/wayfarer-ticket-switcher.user.js
// @homepageURL  https://gitlab.com/Tntnnbltn/wayfarer-addons
// @match        https://wayfarer.nianticlabs.com/*
// @match        https://webchat.helpshift.com/*
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_deleteValue
// @grant        GM_addValueChangeListener
// ==/UserScript==

// Copyright 2024 tntnnbltn

// This script is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.

// This script is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU General Public License for more details.

// ==UserScript==
// @name         Wayfarer Ticket Multi-Pass
// @version      0.0.1
// @description  Support for simultaneous tickets
// @match        https://wayfarer.nianticlabs.com/*
// ==/UserScript==

function init() {

    const uuid = 'aff6f55e-004d-4100-abee-f6f93c108eb5'; // randomly generated, unique to this userscript, please don't re-use in other scripts

    const ORIGIN_WAYFARER = 'https://wayfarer.nianticlabs.com';
    const ORIGIN_HELPSHIFT = 'https://webchat.helpshift.com';
    const OBJECT_STORE_NAME = 'helpChatSessions';

    function initHelp() {

        // Overwrite the open method of the XMLHttpRequest.prototype to intercept the server calls
        (function (open) {
            XMLHttpRequest.prototype.open = function (method, url) {
                if (method == 'POST') {
                    switch (url) {
                        case 'https://api.helpshift.com/websdk/niantic/conversations/history':
                        case 'https://api.helpshift.com/websdk/niantic/conversations/updates':
                            this.addEventListener('load', parseResponse, false);
                    }
                }
                open.apply(this, arguments);
            };
        })(XMLHttpRequest.prototype.open);

        function parseResponse(e) {
            try {
                const json = JSON.parse(this.responseText);
                if (!json) return;
                sendTicketHistory(json);
            } catch (ex) {
            }
        }

        function loadAndSendSessionValues() {
            const di = localStorage.getItem('di:niantic-4d50991f7c85c5b');
            const asi = localStorage.getItem('asi:niantic-4d50991f7c85c5b');
            const aui = localStorage.getItem('aui:niantic-4d50991f7c85c5b');

            const values = { di, asi, aui };

            // Send the values to the parent window (Wayfarer page)
            window.parent.postMessage(values, 'https://wayfarer.nianticlabs.com');
        }

        loadAndSendSessionValues();

        function sendTicketHistory(data) {
            GM_setValue(uuid, data);
            GM_deleteValue(uuid);
        }

        function clearLocalStorage() {
            localStorage.clear();
        }

        function updateLocalStorage(data) {
            localStorage.setItem('di:niantic-4d50991f7c85c5b', data.di);
            localStorage.setItem('asi:niantic-4d50991f7c85c5b', data.asi);
            localStorage.setItem('aui:niantic-4d50991f7c85c5b', data.aui);

            const configKey = 'config:niantic-4d50991f7c85c5b';
            if (localStorage.getItem(configKey)) {
                let configData = JSON.parse(localStorage.getItem(configKey));

                const oldKey = Object.keys(configData)[0];
                const newKey = data.aui;

                configData[newKey] = configData[oldKey];
                delete configData[oldKey];

                localStorage.setItem(configKey, JSON.stringify(configData));
            }
        }

        GM_addValueChangeListener(uuid, (label, data) => {
            if (label === uuid && data) {
                if (data === 'clear') {
                    clearLocalStorage();
                } else if (data.aui) {
                    updateLocalStorage(data);
                }
            }
        });
    }


    function initWF() {
        let helpChatSessions = JSON.parse(localStorage.getItem(OBJECT_STORE_NAME)) || {};

        let currentSession;

        const awaitElement = get => new Promise((resolve, reject) => {
            let triesLeft = 20;
            const queryLoop = () => {
                const ref = get();
                if (ref) resolve(ref);
                else if (!triesLeft) reject();
                else setTimeout(queryLoop, 1000);
                triesLeft;
            }
            queryLoop();
        });

        awaitElement(() => document.getElementById('hs-web-sdk-iframe'))
            .then(() => {
            addTicketSwitchButton();
            observeIframeWidthChanges();
        })
            .catch(() => {
            console.error('Iframe not found.');
        });

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

        window.addEventListener('message', function(event) {
            if (event.origin === 'https://webchat.helpshift.com') {
                const data = event.data;

                if (data.di && data.aui) {
                    currentSession = data.aui

                    if (!helpChatSessions[data.aui]) {
                        helpChatSessions[data.aui] = { di: data.di, asi: data.asi };
                        localStorage.setItem(OBJECT_STORE_NAME, JSON.stringify(helpChatSessions));
                        console.log('New session added to helpChatSessions:', data.aui);
                    } else {
                        console.log('Session already exists in helpChatSessions:', data.aui);
                    }
                }
            }
        });

        function restoreOldTicket(data) {
            GM_setValue(uuid, data);
            GM_deleteValue(uuid);

            refreshPage();
        }

        function generateNewTicket() {
            GM_setValue(uuid, 'clear');
            GM_deleteValue(uuid);

            refreshPage();
        }

        function refreshPage() {
            setTimeout(function() {
                location.reload();
            }, 50);
        }

        GM_addValueChangeListener(uuid, (label, data) => {
            if (label === uuid && data && data.issues) {
                // Create a deep copy of data
                const dataCopy = JSON.parse(JSON.stringify(data));
                processTicketMessages(dataCopy);
            }
        });

        function processTicketMessages(data) {
            let ticketData = {};

            const issues = data.issues;

            const decodeHTMLEntities = str => {
                const doc = new DOMParser().parseFromString(str, "text/html");
                return doc.documentElement.textContent;
            };

            if (issues.length > 0) {

                console.log('DEBUG: Received response with ticket data (>0 issues). Issues response: ', issues);

                let mostRecentTicket;

                if (issues.length === 1) {
                    mostRecentTicket = issues[0];
                } else if (issues.length > 1) {
                    mostRecentTicket = issues.reduce((prev, current) => {
                        return (new Date(current.created_at) > new Date(prev.created_at)) ? current : prev;
                    });
                } else {
                    console.error("Ticker Switcher: Unexpected error in identifying most recent ticket");
                }

                const messages = mostRecentTicket.messages;

                const lastMessage = messages[messages.length - 1];

                if (lastMessage.type === "Confirmation Accepted") {
                    helpChatSessions[currentSession].inProgress = false;
                    helpChatSessions[currentSession].type = '';
                    helpChatSessions[currentSession].wayspot = '';
                    localStorage.setItem(OBJECT_STORE_NAME, JSON.stringify(helpChatSessions));
                } else {
                    helpChatSessions[currentSession].inProgress = true;

                    let ticketType;

                    const translations = [
                        { lang: 'en', values: ["Title or Description Edit", "Image Edit", "Location Edit", "Location Edits > 10m", "Report Wayfarer Abuse", "Wayfarer Access Issues"] },
                        { lang: 'cs', values: ["Úprava názvu nebo popisu", "Úprava obrázku", "Úprava umístění", "Úpravy polohy> 10m", "Nahlásit zneužívání Wayfarer", "Problémy s přístupem Wayfarer"] },
                        { lang: 'de', values: ["Titel- oder Beschreibungsbearbeitung", "Bildbearbeitung", "Standortbearbeitung", "Standort Änderungen> 10 m", "Melden Sie den Missbrauch von Wayfarer", "Wayfarer -Zugriffsprobleme"] },
                        { lang: 'es', values: ["Edición de título o descripción", "Edición de imagen", "Edición de ubicación", "Ediciones de ubicación> 10m", "Informe de abuso de Wayfarer", "Problemas de acceso de Wayfarer"] },
                        { lang: 'fr', values: ["Modification du titre ou de la description", "Modification de l'image", "Modification de l'emplacement", "Modifications de l'emplacement> 10m", "Signaler un abus dans Wayfarer", "Problèmes d'accès à Wayfarer"] },
                        { lang: 'hi', values: ["संपादन शीर्षक या विवरण", "छवि संपादन", "स्थान संपादन", "स्थान संपादन> 10 मी", "वेफ़रर दुरुपयोग की रिपोर्ट करें", "वेफ़रर एक्सेस इश्यूज"] },
                        { lang: 'it', values: ["Modifica Titolo o Descrizione", "Modifica Immagine", "Modifica Posizione", "Modifiche di posizione> 10m", "Segnala abusi viandante", "Problemi di accesso wayfarer"] },
                        { lang: 'ja', values: ["タイトルまたは説明の編集", "画像編集", "位置編集", "ロケーション編集> 10m", "ウェイファーラーの虐待を報告します", "WayFarerアクセス​​の問題"] },
                        { lang: 'ko', values: ["제목 또는 설명 수정", "이미지 수정", "위치 수정", "위치 편집> 10m", "Wayfarer 학대를보고하십시오", "Wayfarer 액세스 문제"] },
                        { lang: 'nl', values: ["Titel- of beschrijvingsbewerking", "Afbeeldingbewerking", "Locatiebewerking", "Locatie -bewerkingen> 10m", "Meld wayfarer misbruik", "Wayfarer toegangsproblemen"] },
                        { lang: 'no', values: ["Tittel- eller beskrivelsesredigering", "Billedredigering", "Stedsredigering", "Sted redigeringer> 10m", "Rapporter Wayfarer misbruk", "Wayfarer tilgangsproblemer"] },
                        { lang: 'pl', values: ["Edycja tytułu lub opisu", "Edycja zdjęcia", "Edycja lokalizacji", "Edyty lokalizacji> 10m", "Zgłoś nadużycie Wayfarer", "Problemy z dostępem do Wayfarer"] },
                        { lang: 'pt', values: ["Edição de título ou descrição", "Edição de imagem", "Edição de localização", "Edições de localização> 10m", "Relatório de abuso de WayFarer", "Problemas de acesso ao WayFarer"] },
                        { lang: 'sv', values: ["Redigera titel eller beskrivning", "Bildredigering", "Platsredigering", "Platsredigeringar> 10m", "Rapportera Wayfarer -missbruk", "Wayfarer Access -problem"] },
                        { lang: 'th', values: ["แก้ไขชื่อเรื่องหรือคำอธิบาย", "แก้ไขรูปภาพ", "แก้ไขที่ตั้ง", "การแก้ไขสถานที่> 10m", "รายงานการละเมิด Wayfarer", "ปัญหาการเข้าถึง Wayfarer"] },
                        { lang: 'tr', values: ["Başlık veya Açıklama Düzenleme", "Resim Düzenleme", "Konum Düzenleme", "Konum Düzenlemeleri> 10m", "Wayfarer istismarını rapor edin", "Wayfarer erişim sorunları"] },
                        { lang: 'zh', values: ["標題或描述編輯", "圖片編輯", "位置編輯", "位置編輯> 10m", "舉報濫用行人", "Wayfarer訪問問題"] },
                    ];

                    for (let i = messages.length - 1; i >= 0; i--) {
                        const message = messages[i];

                        if (message.type === "Option Input Response") {
                            for (let j = 0; j < translations.length; j++) {
                                const langValues = translations[j].values;
                                const decodedBody = decodeHTMLEntities(message.body);
                                const index = langValues.indexOf(decodedBody);

                                if (index !== -1) {
                                    switch (index) {
                                        case 0:
                                            ticketType = 'Text appeal';
                                            break;
                                        case 1:
                                            ticketType = 'Photo appeal';
                                            break;
                                        case 2:
                                            ticketType = 'Location appeal';
                                            break;
                                        case 3:
                                            ticketType = 'Location edit';
                                            break;
                                        case 4:
                                            ticketType = 'Abuse';
                                            break;
                                        case 5:
                                            ticketType = 'Access issues';
                                            break;
                                        default:
                                            break;
                                    }
                                    if (ticketType) {
                                        helpChatSessions[currentSession].type = ticketType;
                                        break;
                                    }
                                }
                            }
                        }
                    }

                    let wayspotFound = false;
                    let wayspotName = '';

                    for (let i = messages.length - 1; i >= 0; i--) {
                        const currentMessage = messages[i];

                        const nextMessage = messages[i + 1];

                        if (currentMessage && currentMessage.body && nextMessage && nextMessage.body) {
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
                                const currentBody = decodeHTMLEntities(currentMessage.body);
                                if (currentBody === currentQuestion && nextMessage.body) {
                                    wayspotFound = true;
                                    wayspotName = nextMessage.body;
                                    break;
                                }
                            }
                        }
                    }

                    if (wayspotFound) {
                        helpChatSessions[currentSession].wayspot = wayspotName;
                    }

                    localStorage.setItem(OBJECT_STORE_NAME, JSON.stringify(helpChatSessions));
                }

            } else {
                console.log('DEBUG: Update response had no ticket data (length of issues was 0).');
            }
        }

        function removeInterfaceContainer() {
            const interfaceContainer = document.getElementById('ticketInterfaceContainer');
            if (interfaceContainer) {
                interfaceContainer.remove();
            }
        }

        function addTicketSwitchButton() {
            const containerDiv = document.createElement('div');
            containerDiv.style.position = 'fixed';
            containerDiv.style.width = '48px';
            containerDiv.style.height = '48px';
            containerDiv.style.zIndex = '9999991';
            containerDiv.style.boxShadow = 'rgba(0, 0, 0, 0.4) 0px 2px 24px 0px';
            containerDiv.style.borderRadius = '50%';
            containerDiv.style.border = 'none';
            containerDiv.style.overflow = 'hidden';
            containerDiv.style.margin = '4px';
            containerDiv.style.padding = '0px';
            containerDiv.style.boxSizing = 'content-box';
            containerDiv.style.outline = 'none';
            containerDiv.style.inset = 'auto 74px 16px auto';
            containerDiv.textContent = 'foo bar';

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
                // Check if interfaceContainer already exists
                if (document.getElementById('ticketInterfaceContainer')) {
                    // If interfaceContainer exists, remove it
                    removeInterfaceContainer();
                } else {
                    // If interfaceContainer doesn't exist, create it
                    const interfaceContainer = document.createElement('div');
                    interfaceContainer.id = 'ticketInterfaceContainer';
                    interfaceContainer.style.display = 'block';
                    interfaceContainer.style.position = 'fixed';
                    interfaceContainer.style.inset = 'auto 16px 75px auto';
                    interfaceContainer.style.minHeight = '500px';
                    interfaceContainer.style.maxHeight = '500px';
                    interfaceContainer.style.minWidth = '360px';
                    interfaceContainer.style.maxWidth = '380px';
                    interfaceContainer.style.height = 'calc(100% - 32px)';
                    interfaceContainer.style.width = '100%';
                    interfaceContainer.style.border = 'none';
                    interfaceContainer.style.borderRadius = '12px';
                    interfaceContainer.style.zIndex = '9999999';
                    interfaceContainer.style.overflow = 'hidden';
                    interfaceContainer.style.backgroundColor = '#f0f2f4';
                    interfaceContainer.style.transform = 'translate3d(0px, 0px, 0px)';
                    interfaceContainer.style.boxShadow = 'rgba(0, 0, 0, 0.2) 0px 4px 32px';
                    interfaceContainer.style.animation = '0.3s cubic-bezier(0.25, 0.1, 0.25, 1) 0s 1 normal none running hs-websdk-slide-up';

                    const header = document.createElement('header');
                    header.style.display = 'flex';
                    header.style.flex = '0 0 auto';
                    header.style.alignItems = 'center';
                    header.style.justifyContent = 'space-between';
                    header.style.height = '60px';
                    header.style.padding = '0px 16px';
                    header.style.padding = '0px 16px';
                    header.style.paddingTop = '0px';
                    header.style.paddingRight = '16px';
                    header.style.paddingLeft = '16px';
                    header.style.color = 'var(--header-text-color, #FFFFFF, #111827)';
                    header.style.background = 'linear-gradient(98deg, var(--header-bg-start-color, #d85813), var(--header-bg-start-color, #d85813bf) 130%)';

                    const avatarTitleWrapper = document.createElement('div');
                    avatarTitleWrapper.style.display = 'flex';
                    avatarTitleWrapper.style.flex = '0 0 auto';
                    avatarTitleWrapper.style.alignItems = 'center';

                    const avatarWrapper = document.createElement('div');
                    avatarWrapper.style.position = 'relative';
                    const avatarImage = document.createElement('img');
                    avatarImage.src = 'https://s3.amazonaws.com/assets.helpshift.com/niantic/avatar/5b16a10a-a694-4302-9218-337ec26b3150/64.png';
                    avatarImage.alt = 'Avatar Image';
                    avatarImage.classList.add('hs-header__avatar', 'hs-avatar__avatar');
                    avatarImage.style.height = '36px';
                    avatarImage.style.width = '36px';
                    avatarImage.style.minWidth = '36px';
                    avatarImage.style.borderRadius = '50%';
                    avatarWrapper.appendChild(avatarImage);

                    const textWrapper = document.createElement('div');
                    textWrapper.style.paddingLeft = '16px';
                    textWrapper.style.width = '100%';
                    textWrapper.style.overflow = 'hidden';
                    textWrapper.style.textOverflow = 'ellipsis';
                    textWrapper.style.whiteSpace = 'nowrap';
                    textWrapper.style.fontSize = '16px';
                    textWrapper.style.fontWeight = '600';

                    const titleText = document.createElement('span');
                    titleText.textContent = 'Wayfarer Ticket Switcher';
                    titleText.style.color = 'var(--text-color, white)';
                    textWrapper.appendChild(titleText);

                    // I couldn't get the close button to render properly
                    // You'll just have to click the ticket switch icon instead to close it!

                    // const closeButton = document.createElement('button');
                    // closeButton.setAttribute('aria-label', 'Close chat');
                    // closeButton.style.padding = '0';
                    // closeButton.style.margin = '0';
                    // closeButton.style.cursor = 'pointer';
                    // closeButton.style.backgroundColor = 'transparent';
                    // closeButton.style.border = 'none';
                    // closeButton.style.alignItems = 'center';
                    // closeButton.style.justifyContent = 'center';
                    // closeButton.style.height = '36px';
                    // closeButton.style.minWidth = '36px';
                    // closeButton.style.borderRadius = '50%';
                    // closeButton.style.display = 'flex';
                    // const closeIcon = document.createElement('svg');
                    // closeIcon.classList.add('hs-header__close-chat-icon', 'hs-ion-icon');
                    // closeIcon.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
                    // closeIcon.setAttributeNS('http://www.w3.org/2000/svg', 'viewBox', '0 0 512 512');
                    // closeIcon.setAttributeNS(null, 'aria-hidden', 'false');
                    // closeIcon.style.width = '24px';
                    // closeIcon.style.height = '24px';
                    // const path = document.createElement('path');
                    // path.setAttribute('d', 'M289.94 256l95-95A24 24 0 00351 127l-95 95-95-95a24 24 0 00-34 34l95 95-95 95a24 24 0 1034 34l95-95 95 95a24 24 0 0034-34z');
                    // closeIcon.appendChild(path);
                    // closeButton.appendChild(closeIcon);

                    avatarTitleWrapper.appendChild(avatarWrapper);
                    avatarTitleWrapper.appendChild(textWrapper);
                    header.appendChild(avatarTitleWrapper);
                    // header.appendChild(closeButton);

                    interfaceContainer.appendChild(header);

                    // Create the table
                    const table = document.createElement('table');
                    table.style.color = '#000000';
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
                            cellSummary.textContent = 'No active ticket';
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
                        if (key !== currentSession) {
                            const deleteText = document.createElement('span');
                            deleteText.style.cursor = 'pointer';
                            deleteText.textContent = '🗑️';
                            cellDelete.appendChild(deleteText);
                        }

                        row.appendChild(cellNumber);
                        row.appendChild(cellSummary);
                        row.appendChild(cellRestore);
                        row.appendChild(cellDelete);
                        tbody.appendChild(row);
                        index++;

                        // Event handling for restore and delete actions
                        if (key !== currentSession) {
                            cellRestore.addEventListener('click', function() {
                                const aui = key;
                                const asi = helpChatSessions[aui].asi;
                                const di = helpChatSessions[aui].di;
                                restoreOldTicket({ aui, asi, di });
                            });

                            cellDelete.addEventListener('click', function() {
                                const aui = key;
                                // Handle delete action using aui value
                                deleteTicket(aui);
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
                        localStorage.setItem(OBJECT_STORE_NAME, JSON.stringify(helpChatSessions));

                        // Update the visual display of row numbers to the AUI and remove it from the table
                        const rows = table.querySelectorAll('tr');
                        let rowIndex = 1; // Start from 1 to match the initial index
                        for (let i = 1; i < rows.length; i++) {
                            const row = rows[i];
                            row.cells[0].textContent = rowIndex;
                            rowIndex++;
                        }
                    }
                }
            });
        }
    }


    if (window.origin === ORIGIN_HELPSHIFT) {
        initHelp();
    } else if (window.origin === ORIGIN_WAYFARER) {
        initWF();
    }
}

init();