// ==UserScript==
// @name         Wayfarer Photo Contributions
// @version      0.2.17
// @description  Add photos to the contributions page
// @namespace    https://gitlab.com/Tntnnbltn/wayfarer-addons
// @downloadURL  https://gitlab.com/Tntnnbltn/wayfarer-addons/-/raw/main/wayfarer-photo-contributions.user.js
// @updateURL    https://gitlab.com/Tntnnbltn/wayfarer-addons/-/raw/main/wayfarer-photo-contributions.user.js
// @homepageURL  https://gitlab.com/Tntnnbltn/wayfarer-addons
// @match        https://wayfarer.nianticlabs.com/*
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

function init() {
    const OBJECT_STORE_NAME = 'photoSubmissions';
    let nominations;
    let photoListItems;

    let holdProcessing = false;

    let filterSettings = {
        pending: true,
        accepted: true,
        rejected: true,
    };

    let currentDisplay = 'wayspots';

    let groupingSetting;
    initializeGroupingSetting();

    let currentSearchTerm = '';
    let arrangementSettings = 'RECENT';
    let sortDirection = 'DESCENDING';

    let photoSubmissions = [];

    let language = 'en';

    const strings = {
        en: {
            switchToPhotos: 'Switch to Photos',
            switchToNominations: 'Switch to Wayspots',
            pending: 'Pending',
            submitted: 'Submitted',
            linkPhotos: 'Link Photos',
            linkPhotosExplanation1: 'Use this function to link together photo submissions for the same Wayspot.',
            linkPhotosExplanation2: 'Click each photo which would you like to connect to this entry.',
            submittedPhotos: 'Submitted photos:',
            submittedWayspots: 'Submitted Wayspots:',
            editData: 'Edit Wayspot Data',
            formSeparator: ':',
            latitude: 'Latitude',
            longitude: 'Longitude',
            city: 'City',
            state: 'State',
            importData: 'Import Wayspot Data',
            importDataExplanation: 'Manually import Wayspot data in JSON format from external sources such as Ingress IITC.',
            settingsHeader: 'Grouping of Photo Contributions',
            settingsExplanation1: 'When turned on, the Wayfarer Photo Contributions plug-in will display all of the photos for the same Wayspot as a single entry on the Contribution Management page. This will require user input to manually link the photos together.',
            settingsExplanation2: 'When turned off, each photo will be displayed in the Contribution Management page as an individual entry, even if photos have been linked together as belonging to the same Wayspot.',
            notificationString: `Found a submitted photo during a Wayfarer review! Details for '{title}' have been synchronised to the Contributions Management page.`,
        },
        ja_JP: {
            switchToPhotos: '写真に切り替える',
            switchToNominations: 'Wayspotsに切り替える',
            pending: '保留中',
            submitted: '提出済み',
            linkPhotos: '写真のリンク',
            linkPhotosExplanation1: '同じWayspotに投稿された写真をリンクさせる機能です。',
            linkPhotosExplanation2: 'リンクしたい写真をクリックしてください。',
            submittedPhotos: '投稿写真:',
            submittedWayspots: '投稿されたWayspots:',
            editData: 'Wayspotデータの編集',
            formSeparator: '',
            latitude: '緯度',
            longitude: '経度',
            city: '都市名',
            state: '州',
            importData: 'Wayspotデータのインポート',
            importDataExplanation: 'Wayspot データを Ingress IITC などの外部ソースから JSON 形式で手動インポートします。',
            settingsHeader: '写真投稿のグループ化',
            settingsExplanation1: 'Wayfarer Photo Contributionsプラグイン をオンにすると、投稿管理ページに同じWayspotのすべての写真が1つの項目として表示されます。この場合、写真を手動でリンクさせるためのユーザー入力が必要になります。',
            settingsExplanation2: 'オフにすると、同じWayspotに属する写真としてリンクされている場合でも、各写真は個別のエントリーとして投稿管理ページに表示されます。',
            notificationString: `Wayfarerレビュー中に投稿された写真を発見！「{title}」の詳細が投稿管理ページに同期されました。`,
        },
        ko_KR: {
            switchToPhotos: '사진으로 전환',
            switchToNominations: 'Wayspot으로 전환',
            pending: '보류 중',
            submitted: '제출된',
            linkPhotos: '사진 서로 연결',
            linkPhotosExplanation1: '이 기능을 사용하여 동일한 Wayspot에 대한 사진 제출을 연결할 수 있습니다.',
            linkPhotosExplanation2: '이 항목에 연결하려는 각 사진을 클릭합니다.',
            submittedPhotos: '제출된 사진:',
            submittedWayspots: '제출된 Wayspot:',
            editData: 'Wayspot 데이터 편집',
            formSeparator: ':',
            latitude: '위도',
            longitude: '경도',
            city: '도시',
            state: '주',
            importData: 'Wayspot 데이터 가져오기',
            importDataExplanation: 'Ingress IITC와 같은 외부 소스에서 JSON 형식의 Wayspot 데이터를 수동으로 가져옵니다.',
            settingsHeader: '사진 기여 그룹화',
            settingsExplanation1: '이 기능을 켜면, Wafarer Photo Contributions 플러그인이 동일한 Wayspot에 대한 모든 사진을 기여 관리 페이지에 단일 항목으로 표시합니다. 이 경우 사진을 수동으로 연결하려면 사용자의 입력이 필요합니다.',
            settingsExplanation2: '이 기능을 끄면 사진이 동일한 Wayspot에 속하는 것으로 서로 연결되어 있더라도 각 사진이 기여도 관리 페이지에 개별 항목으로 표시됩니다.',
            notificationString: `웨이페어러 심사 중 제출된 사진을 찾았습니다! '{title}'에 대한 세부 정보가 기여 관리 페이지에 동기화되었습니다.`,
        },
        pt_BR: {
            switchToPhotos: 'Mudar para fotos',
            switchToNominations: 'Mudar para Wayspots',
            pending: 'Pendente',
            submitted: 'Submetido',
            linkPhotos: 'Vincular fotos',
            linkPhotosExplanation1: 'Use essa função para vincular envios de fotos para o mesmo Wayspot.',
            linkPhotosExplanation2: 'Clique em cada foto que você deseja conectar a este registro.',
            submittedPhotos: 'Fotos enviadas:',
            submittedWayspots: 'Wayspots enviados:',
            editData: 'Editar dados do Wayspot',
            formSeparator: ':',
            latitude: 'Latitude',
            longitude: 'Longitude',
            city: 'Cidade',
            state: 'Estado',
            importData: 'Importar dados do Wayspot',
            importDataExplanation: 'Importe manualmente os dados do Wayspot no formato JSON de fontes externas, como o Ingress IITC.',
            settingsHeader: 'Agrupamento de contribuições de fotos',
            settingsExplanation1: 'Quando ativado, o plug-in Wayfarer Photos Contributions exibirá todas as fotos para o mesmo Wayspot como uma única entrada na página Gerenciamento de Contribuições. Isso exigirá a entrada do usuário para vincular manualmente as fotos.',
            settingsExplanation2: 'Quando desativado, cada foto será exibida na página Gerenciamento de Contribuições como uma entrada individual, mesmo que as fotos tenham sido vinculadas como pertencentes ao mesmo Wayspot.',
            notificationString: `Encontrei uma foto enviada durante uma revisão do Wayfarer! Os detalhes de '{title}' foram sincronizados com a página Gerenciamento de contribuições.`,
        },
        cs_CZ: {
            switchToPhotos: 'Přepněte na Fotky',
            switchToNominations: 'Přepněte na Wayspoty',
            pending: 'čekající',
            submitted: 'Předloženo',
            linkPhotos: 'Propojení fotografií',
            linkPhotosExplanation1: 'Pomocí této funkce můžete propojit dohromady odeslané fotografie pro stejný Wayspot.',
            linkPhotosExplanation2: 'Klikněte na každou fotografii, kterou chcete k tomuto záznamu připojit.',
            submittedPhotos: 'Odeslané fotografie:',
            submittedWayspots: 'Odeslané Wayspoty:',
            editData: 'Upravit údaje o Wayspotu',
            formSeparator: ':',
            latitude: 'Zeměpisná šířka',
            longitude: 'Zeměpisná délka',
            city: 'Město',
            state: 'Stát',
            importData: 'Importovat data Wayspot',
            importDataExplanation: 'Ručně importujte data Wayspot ve formátu JSON z externích zdrojů, například Ingress IITC.',
            settingsHeader: 'Seskupení příspěvků fotografií',
            settingsExplanation1: 'Je-li zapnut, zobrazí zásuvný modul Wayfarer Photos Contributions všechny fotografie pro stejný Wayspot jako jedinou položku na stránce Správa příspěvků. To bude vyžadovat vstup uživatele, aby fotografie ručně spojil dohromady.',
            settingsExplanation2: 'Je-li vypnut, každá fotografie se na stránce Správa příspěvků zobrazí jako samostatná položka, i když byly fotografie spojeny dohromady jako patřící ke stejnému Wayspotu.',
            notificationString: `Nalezena odeslaná fotografie během recenze Wayfarer! Podrobnosti pro '{title}' byly synchronizovány se stránkou Správa příspěvků.`,
        },
        es_ES: {
            switchToPhotos: 'Cambiar a fotos',
            switchToNominations: 'Cambiar a Wayspots',
            pending: 'Pendiente',
            submitted: 'Enviado',
            linkPhotos: 'Vincular fotos',
            linkPhotosExplanation1: 'Utilice esta función para vincular las fotos enviadas para el mismo Wayspot.',
            linkPhotosExplanation2: 'Haga clic en cada foto que desea conectar a esta entrada.',
            submittedPhotos: 'Fotos enviadas:',
            submittedWayspots: 'Wayspots enviados:',
            editData: 'Editar datos del Wayspot',
            formSeparator: ':',
            latitude: 'Latitud',
            longitude: 'Longitud',
            city: 'Ciudad',
            state: 'Estado',
            importData: 'Importar datos del Wayspot',
            importDataExplanation: 'Importe manualmente datos del Wayspot en formato JSON desde fuentes externas como Ingress IITC.',
            settingsHeader: 'Agrupación de contribuciones de fotos',
            settingsExplanation1: 'Cuando está activado, el complemento Wayfarer Photos Contributions mostrará todas las fotos del mismo Wayspot como una única entrada en la página de gestión de contribuciones. Esto requerirá la intervención del usuario para vincular manualmente las fotos.',
            settingsExplanation2: 'Si está desactivado, cada foto se mostrará en la página de gestión de contribuciones como una entrada individual, incluso si las fotos se han vinculado entre sí como pertenecientes al mismo Wayspot.',
            notificationString: `Se ha encontrado una foto enviada durante una revisión de Wayfarer. Los datos de '{title}' se han sincronizado con la página de gestión de contribuciones.`,
        },
        de_DE: {
            switchToPhotos: 'Zu Fotos wechseln',
            switchToNominations: 'Zu Wayspots wechseln',
            pending: 'Ausstehend',
            submitted: 'Eingereicht',
            linkPhotos: 'Fotos miteinander verknüpfen',
            linkPhotosExplanation1: 'Mit dieser Funktion könnt ihr Fotos, die für denselben Wayspot eingereicht wurden, miteinander verknüpfen.',
            linkPhotosExplanation2: 'Klickt auf jedes Foto, das ihr mit diesem Eintrag verbinden möchtet.',
            submittedPhotos: 'Eingereichte Fotos:',
            submittedWayspots: 'Eingereichte Wayspots:',
            editData: 'Wayspot-Daten bearbeiten',
            formSeparator: ':',
            latitude: 'Breitengrad',
            longitude: 'Längengrad',
            city: 'Stadt',
            state: 'Staat',
            importData: 'Wayspot-Daten importieren',
            importDataExplanation: 'Manuelles Importieren von Wayspot-Daten im JSON-Format aus externen Quellen wie Ingress IITC.',
            settingsHeader: 'Gruppierung von Fotobeiträgen',
            settingsExplanation1: 'Wenn diese Funktion aktiviert ist, zeigt das Wayfarer Photos Contributions Plug-in alle Fotos für denselben Wayspot als einen einzigen Eintrag auf der Seite Contribution Management an. Dies erfordert eine Benutzereingabe, um die Fotos manuell miteinander zu verknüpfen.',
            settingsExplanation2: 'Wenn das Plug-in ausgeschaltet ist, wird jedes Foto auf der Seite Beitragsverwaltung als einzelner Eintrag angezeigt, auch wenn die Fotos mit demselben Wayspot verknüpft wurden.',
            notificationString: `Ein eingereichtes Foto bei einer Wayfarer-Bewertung gefunden! Die Details für '{title}' wurden mit der Seite der Beitragsverwaltung synchronisiert.`,
        },
        fr_FR: {
            switchToPhotos: 'Vers les photos',
            switchToNominations: 'Vers les Wayspots',
            pending: 'En attente',
            submitted: 'Proposée',
            linkPhotos: 'Lier des photos',
            linkPhotosExplanation1: 'Utilisez cette fonction pour lier des photos soumises pour le même Wayspot.',
            linkPhotosExplanation2: 'Cliquez sur chaque photo que vous souhaitez lier à cette entrée.',
            submittedPhotos: 'Photos proposées :',
            submittedWayspots: 'Wayspots proposés :',
            editData: 'Modifier les données du Wayspot',
            formSeparator: ' :',
            latitude: 'Latitude',
            longitude: 'Longitude',
            city: 'Ville',
            state: 'État',
            importData: 'Importer les données du Wayspot',
            importDataExplanation: 'Importer manuellement des données Wayspot au format JSON à partir de sources externes telles que Ingress IITC.',
            settingsHeader: 'Regroupement des contributions photos',
            settingsExplanation1: "Lorsqu'il est actif, le plug-in Wayfarer Photos Contributions affiche toutes les photos d'un même Wayspot sous la forme d'une entrée unique sur la page de gestion des contributions. Une intervention de l'utilisateur sera nécessaire pour lier les photos entre elles manuellement.",
            settingsExplanation2: "Lorsqu'il est désactivé, chaque photo sera affichée dans la page de gestion des contributions comme une entrée individuelle, même si les photos ont été liées entre elles comme appartenant au même Wayspot.",
            notificationString: `J'ai trouvé une photo proposée lors de l'examen d'une proposition Wayfarer ! Les détails de '{title}' ont été synchronisés avec la page de gestion des contributions.`,
        },
        it_IT: {
            switchToPhotos: 'Passa alle foto',
            switchToNominations: 'Passa a Wayspot',
            pending: 'In attesa di',
            submitted: 'Inviate',
            linkPhotos: 'Collegamento di foto',
            linkPhotosExplanation1: 'Utilizzare questa funzione per collegare tra loro le foto inviate per lo stesso Wayspot.',
            linkPhotosExplanation2: 'Fare clic su ciascuna foto che si desidera collegare a questa voce.',
            submittedPhotos: 'Foto inviate:',
            submittedWayspots: 'Wayspot inviati:',
            editData: 'Modifica dati Wayspot',
            formSeparator: ':',
            latitude: 'Latitudine',
            longitude: 'Longitudine',
            city: 'Città',
            state: 'Stato',
            importData: 'Importazione di dati Wayspot',
            importDataExplanation: 'Importa manualmente i dati Wayspot in formato JSON da fonti esterne come Ingress IITC.',
            settingsHeader: 'Raggruppamento dei contributi fotografici',
            settingsExplanation1: "Se attivato, il plug-in Contributi fotografici del Wayfarer visualizza tutte le foto dello stesso Wayspot come un'unica voce nella pagina di gestione dei contributi. Ciò richiede l'intervento dell'utente per collegare manualmente le foto tra loro.",
            settingsExplanation2: "Quando è disattivato, ogni foto verrà visualizzata nella pagina di gestione dei contributi come voce singola, anche se le foto sono state collegate insieme come appartenenti allo stesso Wayspot.",
            notificationString: `Trovata una foto inviata durante una revisione del Wayfarer! I dettagli di "{title}" sono stati sincronizzati nella pagina di gestione dei contributi.`,
        },
        in: {
            switchToPhotos: 'Beralih ke foto',
            switchToNominations: 'Beralih ke wayspot',
            pending: 'Tertangguh',
            submitted: 'Diserahkan',
            linkPhotos: 'Tautkan Foto',
            linkPhotosExplanation1: 'Gunakan fungsi ini untuk menautkan foto/gambar nominasi untuk Wayspot yang sama.',
            linkPhotosExplanation2: 'Tekan masing-masing foto/gambar yang ingin ditautkan pada nominasi ini.',
            submittedPhotos: 'Foto/gambar yang diajukan:',
            submittedWayspots: 'Wayspot yang diajukan:',
            editData: 'Edit Data Wayspot',
            formSeparator: ':',
            latitude: 'Garis Lintang',
            longitude: 'Garis Bujur',
            city: 'Kota',
            state: 'Provinsi',
            importData: 'Impor Data Wayspot',
            importDataExplanation: 'Impor data Wayspot secara manual dalam bentuk JSON format dari sumber eksternal seperti Ingress IITC',
            settingsHeader: 'Mengelompokan kontribusi Foto/Gambar',
            settingsExplanation1: 'Jika dinyalakan, plug-in Kontribusi Foto/Gambar Wayspot akan menampilkan semua Foto/Gambar untuk Wayspot yang sama sebagai nominasi tunggal pada laman Manajemen Kontribusi. Hal ini akan memerlukan masukan pengguna untuk menautkan foto/gambar secara manual.',
            settingsExplanation2: 'Jika dimatikan, masing-masing foto/gambar akan ditampilkan pada laman Manajemen Kontribusi sebagai masukan individu, bahkan jika foto/gambar tersebut telah ditautkan bersama untuk Wayspot yang sama.',
            notificationString: `Menemukan foto/gambar yang diajukan selama ulasan Wayfarer! Detail untuk '{title}' telah disinkronisasikan ke halaman Manajemen Kontribusi.`,
        },
        nl_NL: {
            switchToPhotos: `Wisselen naar foto's`,
            switchToNominations: 'Wisselen naar wayspots',
            pending: 'In behandeling',
            submitted: 'Ingediend',
            linkPhotos: `Foto's aan elkaar koppelen`,
            linkPhotosExplanation1: 'Gebruik deze functie om foto-inzendingen voor dezelfde Wayspot aan elkaar te koppelen.',
            linkPhotosExplanation2: 'Klik op elke foto die je wilt koppelen aan dit item.',
            submittedPhotos: "Ingediende foto's:",
            submittedWayspots: 'Ingediende Wayspots:',
            editData: 'Bewerk Wayspot Data',
            formSeparator: ':',
            latitude: 'Breedtegraad',
            longitude: 'Lengtegraad',
            city: 'Stad',
            state: 'Staat',
            importData: 'Wayspot Data Importeren',
            importDataExplanation: 'Importeer handmatig Wayspot data in JSON formaat van externe bronnen zoals Ingress IITC.',
            settingsHeader: 'Groeperen van fotobijdragen',
            settingsExplanation1: "Als de plug-in Wayfarer Foto's Bijdragen is ingeschakeld, worden alle foto's voor dezelfde Wayspot als één item weergegeven op de Bijdragenbeheer pagina. Dit vereist gebruikersinvoer om de foto's handmatig aan elkaar te koppelen.",
            settingsExplanation2: "Als deze optie is uitgeschakeld, wordt elke foto op de Contribution Management pagina individueel weergegeven, zelfs als foto's aan dezelfde Wayspot zijn gekoppeld.",
            notificationString: `Een ingediende foto gevonden tijdens een Wayfarer review! Details voor '{title}' zijn gesynchroniseerd naar de Bijdragenbeheer pagina.`,
        },
        no_NO: {
            switchToPhotos: 'Bytt til bilder',
            switchToNominations: 'Bytt til nominasjoner',
            pending: 'Avventer',
            submitted: 'Sendt',
            linkPhotos: 'Koble sammen bilder',
            linkPhotosExplanation1: 'Bruk denne funksjonen til å koble sammen bilder som er sendt inn for samme Wayspot.',
            linkPhotosExplanation2: 'Klikk på hvert bilde som du ønsker å koble til denne oppføringen.',
            submittedPhotos: 'Innsendte bilder:',
            submittedWayspots: 'Innsendte Wayspots:',
            editData: 'Rediger Wayspot-data',
            formSeparator: ':',
            latitude: 'Breddegrad',
            longitude: 'Lengdegrad',
            city: 'By',
            state: 'Delstat',
            importData: 'Importere Wayspot-data',
            importDataExplanation: 'Importer Wayspot-data manuelt i JSON-format fra eksterne kilder som Ingress IITC.',
            settingsHeader: 'Gruppering av fotobidrag',
            settingsExplanation1: 'Når denne funksjonen er slått på, vil Wayfarer Photos Contributions-plugin-modulen vise alle bildene for samme Wayspot som én enkelt oppføring på Contribution Management-siden. Dette krever at brukeren manuelt kobler bildene sammen.',
            settingsExplanation2: 'Når den er slått av, vil hvert bilde vises på siden for bidragsadministrasjon som en individuell oppføring, selv om bildene er koblet sammen som tilhørende samme Wayspot.',
            notificationString: `Fant et innsendt bilde under en Wayfarer-gjennomgang! Detaljer for '{title}' har blitt synkronisert med siden for bidragshåndtering.`,
        },
        pl_PL: {
            switchToPhotos: 'Przełącz na zdjęcia',
            switchToNominations: 'Przejdź do Wayspotów',
            pending: 'W oczekiwaniu',
            submitted: 'Zgłoszony',
            linkPhotos: 'Połącz zdjęcia',
            linkPhotosExplanation1: 'Ta funkcja służy do łączenia zdjęć przesłanych dla tego samego Wayspota.',
            linkPhotosExplanation2: 'Kliknij każde zdjęcie, które chcesz połączyć z tym wpisem.',
            submittedPhotos: 'Zgłoszone zdjęcia:',
            submittedWayspots: 'Zgłoszone Wayspoty:',
            editData: 'Edytuj dane Wayspota',
            formSeparator: ':',
            latitude: 'Szerokość geograficzna',
            longitude: 'Długość geograficzna',
            city: 'Miasto',
            state: 'Stan',
            importData: 'Importowanie danych Wayspot',
            importDataExplanation: 'Ręcznie importuj dane Wayspot w formacie JSON z zewnętrznych źródeł, takich jak Ingress IITC.',
            settingsHeader: 'Grupowanie zgłoszonych zdjęć',
            settingsExplanation1: 'Po włączeniu, wtyczka Wayfarer Photos Contributions wyświetli wszystkie zdjęcia dla tego samego Wayspota jako pojedynczy wpis na stronie Zarządzanie zgłoszeniami. Będzie to wymagało ręcznego połączenia zdjęć przez użytkownika.',
            settingsExplanation2: 'Po jej wyłączeniu, każde zdjęcie będzie wyświetlane na stronie Zarządzanie zgłoszeniami jako osobny wpis, nawet jeśli zdjęcia zostały połączone jako należące do tego samego Wayspota.',
            notificationString: `Znaleziono zgłoszone zdjęcie podczas oceniania Wayfarer. Szczegół dotyczące "{title}" zostały zsynchronizowane ze stroną Zarządzanie zgłoszeniami`,
        },
        ru_RU: {
            switchToPhotos: 'Переключиться на фотографии',
            switchToNominations: 'Переключиться на Wayspots',
            pending: 'В процессе',
            submitted: 'Предложено',
            linkPhotos: 'Связать фотографии вместе',
            linkPhotosExplanation1: 'Используйте эту функцию, чтобы связать вместе фотографии, предложенные для одного и того же Wayspot.',
            linkPhotosExplanation2: 'Кликните на каждую фотографию, которую вы хотите связать с этой записью.',
            submittedPhotos: 'Предложенные фотографии:',
            submittedWayspots: 'Предложенные Wayspots:',
            editData: 'Редактировать данные Wayspot',
            formSeparator: ':',
            latitude: 'Широта',
            longitude: 'Долгота',
            city: 'Город',
            state: 'Регион',
            importData: 'Импорт данных Wayspot',
            importDataExplanation: 'Ручной импорт данных Wayspot в формате JSON из внешних источников, таких как Ingress IITC.',
            settingsHeader: 'Группировка фотовкладов',
            settingsExplanation1: 'При включении плагин Wayfarer Photos Contributions отображает все фотографии для одной точки Wayspot в виде одной записи на странице управления предложениями. При этом пользователю потребуется вручную связать фотографии вместе.',
            settingsExplanation2: 'Если плагин выключен, каждая фотография будет отображаться на странице управления предложениями как отдельная запись, даже если фотографии были связаны вместе как относящиеся к одному Wayspot.',
            notificationString: `Нашел предложенную фотографию во время рецензии Wayfarer! Данные для '{title}' были синхронизированы на страницу управления вкладами.`,
        },
        sv_SE: {
            switchToPhotos: 'Byt till foton',
            switchToNominations: 'Byt till Wayspots',
            pending: 'I väntan på',
            submitted: 'Inskickad',
            linkPhotos: 'Länka foton tillsammans',
            linkPhotosExplanation1: 'Använd denna funktion för att länka samman foton som skickats in för samma Wayspot.',
            linkPhotosExplanation2: 'Klicka på varje foto som du vill koppla till den här posten.',
            submittedPhotos: 'Inskickade foton:',
            submittedWayspots: 'Inskickade Wayspots:',
            editData: 'Redigera Wayspot-data',
            formSeparator: ':',
            latitude: 'Latitud',
            longitude: 'Longitud',
            city: 'Stad',
            state: 'Delstat',
            importData: 'Importera Wayspot-data',
            importDataExplanation: 'Importera Wayspot-data manuellt i JSON-format från externa källor som Ingress IITC.',
            settingsHeader: 'Gruppering av fotobidrag',
            settingsExplanation1: 'När den är aktiverad kommer insticksprogrammet Wayfarer Photo Contributions att visa alla foton för samma Wayspot som en enda post på sidan Contribution Management. Detta kräver att användaren manuellt länkar samman bilderna.',
            settingsExplanation2: 'När den är avstängd kommer varje foto att visas på sidan Bidragshantering som en enskild post, även om foton har länkats ihop som tillhörande samma Wayspot.',
            notificationString: `Hittade ett inskickat foto under en Wayfarer-granskning! Detaljer för '{title}' har synkroniserats till bidragshanteringssidan.`,
        },
        th_TH: {
            switchToPhotos: 'สลับไปที่รูปถ่าย',
            switchToNominations: 'สลับไปที่ Wayspots',
            pending: 'รอดำเนินการ',
            submitted: 'ส่ง',
            linkPhotos: 'เชื่อมโยงรูปภาพเข้าด้วยกัน',
            linkPhotosExplanation1: 'ใช้ฟังก์ชันนี้เพื่อเชื่อมโยงการส่งภาพถ่ายสำหรับ Wayspot เดียวกัน',
            linkPhotosExplanation2: 'คลิกแต่ละภาพที่คุณต้องการเชื่อมต่อกับรายการนี้',
            submittedPhotos: 'ภาพถ่ายที่ส่ง:',
            submittedWayspots: 'Wayspots ที่ส่ง:',
            editData: 'แก้ไขข้อมูล Wayspot',
            formSeparator: ':',
            latitude: 'ละติจูด',
            longitude: 'ลองจิจูด',
            city: 'เมือง',
            state: 'สถานะ',
            importData: 'นำเข้าข้อมูล Wayspot',
            importDataExplanation: 'นำเข้าข้อมูล Wayspot ด้วยตนเองในรูปแบบ JSON จากแหล่งภายนอก เช่น Ingress IITC',
            settingsHeader: 'การจัดกลุ่มผลงานภาพถ่าย',
            settingsExplanation1: 'เมื่อเปิดใช้งาน ปลั๊กอิน Wayfarer Photo Contributions จะแสดงภาพถ่ายทั้งหมดสำหรับ Wayspot เดียวกันเป็นรายการเดียวบนหน้าการจัดการการมีส่วนร่วม ซึ่งจะต้องมีการป้อนข้อมูลจากผู้ใช้เพื่อเชื่อมโยงรูปภาพเข้าด้วยกันด้วยตนเอง',
            settingsExplanation2: 'เมื่อปิด รูปภาพแต่ละรูปจะแสดงในหน้าการจัดการการมีส่วนร่วมเป็นรายการเดี่ยว แม้ว่ารูปภาพจะเชื่อมโยงเข้าด้วยกันเป็นของ Wayspot เดียวกันก็ตาม',
            notificationString: `พบรูปถ่ายที่ส่งมาในระหว่างการรีวิว Wayfarer! รายละเอียดสำหรับ '{title}' ได้รับการซิงโครไนซ์กับหน้าการจัดการการมีส่วนร่วมแล้ว`,
        },
        zh_TW: {
            switchToPhotos: '切換到照片',
            switchToNominations: '切換到 Wayspots',
            pending: '待辦的',
            submitted: '已提交',
            linkPhotos: '將照片連結在一起',
            linkPhotosExplanation1: '使用此功能可將同一 Wayspot 的照片提交連結在一起。',
            linkPhotosExplanation2: '點擊您想要連接到此條目的每張照片。',
            submittedPhotos: '提交的照片：',
            submittedWayspots: '提交的 Wayspots：',
            editData: '編輯 Wayspot 數據',
            formSeparator: '：',
            latitude: '緯度',
            longitude: '經度',
            city: '城市',
            state: '狀態',
            importData: '匯入 Wayspot 數據',
            importDataExplanation: '從 Ingress IITC 等外部來源手動匯入 JSON 格式的 Wayspot 資料。',
            settingsHeader: '照片貢獻分組',
            settingsExplanation1: '開啟後，Wayfarer Photo Contributions 外掛程式將在「貢獻管理」頁面上將同一 Wayspot 的所有照片顯示為單一條目。 這將需要用戶輸入來手動將照片連結在一起。',
            settingsExplanation2: '關閉後，每張照片都將作為單獨的條目顯示在「貢獻管理」頁面中，即使照片已連結在一起屬於同一 Wayspot。',
            notificationString: `在 Wayfarer 評論期間發現提交的照片！ 「{title}」的詳細資訊已同步至貢獻管理頁面。`,
        },
        bn_IN: {
            switchToPhotos: 'ছবিতে স্যুইচ করুন',
            switchToNominations: 'ওয়েস্পটে স্যুইচ করুন',
            pending: 'বিচারাধীন',
            submitted: 'জমা দেওয়া হয়েছে',
            linkPhotos: 'ছবি লিঙ্ক করুন',
            linkPhotosExplanation1: 'একই ওয়েস্পটের ছবিগুলিকে একসাথে লিঙ্ক করতে এই ফাংশনটি ব্যবহার করুন৷',
            linkPhotosExplanation2: 'লিঙ্ক করতে চান এমন প্রতিটি ছবিতে ক্লিক করুন।',
            submittedPhotos: 'জমা দেওয়া ছবি:',
            submittedWayspots: 'জমা দেওয়া Wayspots:',
            editData: 'Wayspot ডেটা সম্পাদনা করুন',
            formSeparator: ':',
            latitude: 'অক্ষাংশ',
            longitude: 'দ্রাঘিমাংশ',
            city: 'শহর',
            state: 'রাজ্য',
            importData: 'Wayspot ডেটা আমদানি করুন',
            importDataExplanation: 'Ingress IITC এর মতো বাহ্যিক উৎস থেকে JSON ফর্ম্যাটে ম্যানুয়ালি Wayspot ডেটা আমদানি করুন৷',
            settingsHeader: 'ফটো অবদানের গ্রুপিং',
            settingsExplanation1: ' চালু করা হলে, Wayfarer Photo Contributions প্লাগ-ইন কন্ট্রিবিউশন ম্যানেজমেন্ট পাতায় একক এন্ট্রি হিসাবে একই Wayspot-এর সমস্ত ছবি দেখাবে। ছবিগুলিকে ম্যানুয়ালি লিঙ্ক করার জন্য ব্যবহারকারীর ইনপুটের প্রয়োজন হবে৷',
            settingsExplanation2: 'বন্ধ থাকলে, প্রতিটি ছবি এক-একটি পৃথক এন্ট্রি হিসাবে কন্ট্রিবিউশন ম্যানেজমেন্ট পাতায় দেখা যাবে; এমনকি ছবিগুলি একই Wayspot-এর অন্তর্গত হিসাবে একসাথে লিঙ্ক করা থাকলেও৷',
            notificationString: `একটি Wayfarer পর্যালোচনা সময় একটি জমা ফটো পাওয়া গেছে! '{title}'-এর বিবরণ অবদান ব্যবস্থাপনা পৃষ্ঠায় সিঙ্ক্রোনাইজ করা হয়েছে।`,
        },
        hi_IN: {
            switchToPhotos: 'फ़ोटो पर स्विच करें',
            switchToNominations: 'वेस्पॉट्स पर स्विच करें',
            pending: 'लंबित',
            submitted: 'प्रस्तुत',
            linkPhotos: 'फ़ोटो को एक साथ लिंक करें',
            linkPhotosExplanation1: 'एक ही वेस्पॉट के लिए फोटो सबमिशन को एक साथ जोड़ने के लिए इस फ़ंक्शन का उपयोग करें।',
            linkPhotosExplanation2: 'प्रत्येक फोटो पर क्लिक करें जिसे आप इस प्रविष्टि से जोड़ना चाहेंगे।',
            submittedPhotos: 'आपकी सबमिट की गई तस्वीरें:',
            submittedWayspots: 'आपके सबमिट किए गए वेस्पॉट्स:',
            editData: 'वेस्पॉट डेटा संपादित करें',
            formSeparator: ':',
            latitude: 'अक्षांश',
            longitude: 'देशांतर',
            city: 'शहर',
            state: 'राज्य',
            importData: 'वेस्पॉट डेटा आयात करें',
            importDataExplanation: 'Ingress IITC जैसे बाहरी स्रोतों से JSON प्रारूप में वेस्पॉट डेटा को मैन्युअल रूप से आयात करें।',
            settingsHeader: 'फोटो योगदान का समूहन',
            settingsExplanation1: 'चालू होने पर, वेफ़रर फोटो कंट्रीब्यूशन प्लग-इन एक ही वेस्पॉट के लिए सभी फ़ोटो को कंट्रीब्यूशन मैनेजमेंट पेज पर एकल प्रविष्टि के रूप में प्रदर्शित करेगा। इसके लिए फ़ोटो को मैन्युअल रूप से एक साथ लिंक करने के लिए उपयोगकर्ता इनपुट की आवश्यकता होगी।',
            settingsExplanation2: 'बंद होने पर, प्रत्येक फ़ोटो को योगदान प्रबंधन पृष्ठ में एक व्यक्तिगत प्रविष्टि के रूप में प्रदर्शित किया जाएगा, भले ही फ़ोटो को एक ही वेस्पॉट से संबंधित होने के कारण एक साथ लिंक किया गया हो।',
            notificationString: `वेफ़रर समीक्षा के दौरान सबमिट की गई एक फ़ोटो मिली! '{title}' का विवरण योगदान प्रबंधन पृष्ठ पर सिंक्रनाइज़ किया गया है।`,
        },
        mr_IN: {
            switchToPhotos: 'फोटोंवर स्विच करा',
            switchToNominations: 'वेस्पॉट्सवर स्विच करा',
            pending: 'प्रलंबित',
            submitted: 'सबमिट केले',
            linkPhotos: 'फोटो एकत्र लिंक करा',
            linkPhotosExplanation1: 'समान वेस्पॉटसाठी फोटो सबमिशन एकत्र जोडण्यासाठी हे कार्य वापरा.',
            linkPhotosExplanation2: 'तुम्ही या एंट्रीशी कनेक्ट करू इच्छित असलेल्या प्रत्येक फोटोवर क्लिक करा.',
            submittedPhotos: 'तुमचे सबमिट केलेले फोटो:',
            submittedWayspots: 'तुमचे सबमिट केलेले वेस्पॉट्स:',
            editData: 'वेस्पॉट डेटा संपादित करा',
            formSeparator: ':',
            latitude: 'अक्षांश',
            longitude: 'रेखांश',
            city: 'शहर',
            state: 'राज्य',
            importData: 'वेस्पॉट डेटा आयात करा',
            importDataExplanation: 'Ingress IITC सारख्या बाह्य स्त्रोतांकडून JSON फॉरमॅटमध्ये वेस्पॉट डेटा मॅन्युअली इंपोर्ट करा.',
            settingsHeader: 'फोटो योगदानांचे गट करणे',
            settingsExplanation1: 'चालू केल्यावर, Wayfarer Photo Contributions प्लग-इन योगदान व्यवस्थापन पृष्ठावरील एकाच एंट्रीच्या रूपात समान वेस्पॉटसाठी सर्व फोटो प्रदर्शित करेल. फोटो एकत्र जोडण्यासाठी वापरकर्ता इनपुटची आवश्यकता असेल.',
            settingsExplanation2: 'बंद केल्यावर, प्रत्येक फोटो योगदान व्यवस्थापन पृष्ठावर वैयक्तिक एंट्री म्हणून प्रदर्शित केला जाईल, जरी फोटो एकाच वेस्पॉटशी संबंधित म्हणून एकत्र जोडले गेले असले तरीही.',
            notificationString: `वेफेअर पुनरावलोकनादरम्यान सबमिट केलेला फोटो सापडला! '{title}' साठीचे तपशील योगदान व्यवस्थापन पृष्ठावर समक्रमित केले गेले आहेत.`,
        },
        ta_IN: {
            switchToPhotos: 'புகைப்படங்களுக்கு மாறவும்',
            switchToNominations: 'Wayspots க்கு மாறவும்',
            pending: 'நிலுவையில் உள்ளது',
            submitted: 'சமர்ப்பிக்கப்பட்டது',
            linkPhotos: 'புகைப்படங்களை ஒன்றாக இணைக்கவும்',
            linkPhotosExplanation1: 'ஒரே Wayspotக்கான புகைப்பட சமர்ப்பிப்புகளை ஒன்றாக இணைக்க இந்தச் செயல்பாட்டைப் பயன்படுத்தவும்.',
            linkPhotosExplanation2: 'இந்த பதிவில் இணைக்க விரும்பும் ஒவ்வொரு புகைப்படத்தையும் கிளிக் செய்யவும்.',
            submittedPhotos: 'நீங்கள் சமர்ப்பித்த புகைப்படங்கள்:',
            submittedWayspots: 'நீங்கள் சமர்ப்பித்த Wayspots:',
            editData: 'Wayspot தரவைத் திருத்தவும்',
            formSeparator: ':',
            latitude: 'அட்சரேகை',
            longitude: 'தீர்க்கரேகை',
            city: 'நகரம்',
            state: 'மாநிலம்',
            importData: 'Wayspot தரவை இறக்குமதி செய்யவும்',
            importDataExplanation: 'Ingress IITC போன்ற வெளிப்புற மூலங்களிலிருந்து JSON வடிவத்தில் Wayspot தரவை கைமுறையாக இறக்குமதி செய்யவும்.',
            settingsHeader: 'புகைப்படப் பங்களிப்புகளின் குழுவாக்கம்',
            settingsExplanation1: 'இயக்கப்பட்டிருக்கும் போது, Wayfarer Photo Contributions செருகுநிரலானது, ஒரே Wayspotக்கான அனைத்துப் புகைப்படங்களையும் பங்களிப்பு மேலாண்மைப் பக்கத்தில் ஒரே பதிவாகக் காண்பிக்கும். புகைப்படங்களை கைமுறையாக ஒன்றாக இணைக்க பயனர் உள்ளீடு தேவைப்படும்.',
            settingsExplanation2: 'அணைக்கப்படும் போது, ஒவ்வொரு புகைப்படமும் ஒரே Wayspot க்கு சொந்தமானவை என ஒன்றாக இணைக்கப்பட்டிருந்தாலும், பங்களிப்பு மேலாண்மை பக்கத்தில் தனிப்பட்ட உள்ளீட்டாக காட்டப்படும்.',
            notificationString: `வேஃபேரர் மதிப்பாய்வின் போது சமர்ப்பிக்கப்பட்ட புகைப்படம் கிடைத்தது! '{title}' க்கான விவரங்கள் பங்களிப்புகள் மேலாண்மை பக்கத்துடன் ஒத்திசைக்கப்பட்டுள்ளன.`,
        },
        te_IN: {
            switchToPhotos: 'ఫోటోలను ఒకదానితో ఒకటి లింక్ చేయండి',
            switchToNominations: 'వేస్‌పాట్‌లకు మారండి',
            pending: 'పెండింగ్‌లో ఉంది',
            submitted: 'సమర్పించబడింది',
            linkPhotos: 'ఫోటోలను ఒకదానితో ఒకటి లింక్ చేయండి',
            linkPhotosExplanation1: 'ఒకే వేస్‌పాట్ కోసం ఫోటో సమర్పణలను కలిపి లింక్ చేయడానికి ఈ ఫంక్షన్‌ని ఉపయోగించండి.',
            linkPhotosExplanation2: 'మీరు ఈ ఎంట్రీకి కనెక్ట్ చేయాలనుకుంటున్న ప్రతి ఫోటోను క్లిక్ చేయండి.',
            submittedPhotos: 'మీరు సమర్పించిన ఫోటోలు:',
            submittedWayspots: 'మీరు సమర్పించిన వేస్‌పాట్‌లు:',
            editData: 'వేస్పాట్ డేటాను సవరించండి',
            formSeparator: ':',
            latitude: 'అక్షాంశం',
            longitude: 'రేఖాంశం',
            city: 'నగరం',
            state: 'రాష్ట్రం',
            importData: 'వేస్‌పాట్ డేటాను దిగుమతి చేయండి',
            importDataExplanation: 'Ingress IITC వంటి బాహ్య మూలాల నుండి JSON ఆకృతిలో వేస్‌పాట్ డేటాను మాన్యువల్‌గా దిగుమతి చేయండి.',
            settingsHeader: 'ఫోటో సహకారాల సమూహనం',
            settingsExplanation1: 'ఆన్ చేసినప్పుడు, Wayfarer ఫోటో కంట్రిబ్యూషన్స్ ప్లగ్-ఇన్ కంట్రిబ్యూషన్ మేనేజ్‌మెంట్ పేజీలో ఒకే ఎంట్రీగా ఒకే వేస్పాట్ కోసం అన్ని ఫోటోలను ప్రదర్శిస్తుంది. ఇది ఫోటోలను మాన్యువల్‌గా లింక్ చేయడానికి వినియోగదారు ఇన్‌పుట్ అవసరం.',
            settingsExplanation2: 'ఆపివేయబడినప్పుడు, ఫోటోలు ఒకే వేస్‌పాట్‌కు చెందినవిగా కలిసి లింక్ చేయబడినప్పటికీ, ప్రతి ఫోటో సహకార నిర్వహణ పేజీలో వ్యక్తిగత ఎంట్రీగా ప్రదర్శించబడుతుంది.',
            notificationString: `వేఫేరర్ సమీక్షలో సమర్పించిన ఫోటో కనుగొనబడింది! '{title}' కోసం వివరాలు సహకార నిర్వహణ పేజీకి సమకాలీకరించబడ్డాయి.`,
        },
        tl_PH: {
            switchToPhotos: 'Lumipat sa mga larawan',
            switchToNominations: 'Lumipat sa Wayspots',
            pending: 'Nakabinbin',
            submitted: 'Isinumite',
            linkPhotos: 'Ipangkat ang mga Larawan',
            linkPhotosExplanation1: 'Gamitin ang function na ito upang pag-ugnayin ang mga isinumiteng larawan para sa iisang partikular na Wayspot.',
            linkPhotosExplanation2: 'I-click ang bawat larawan na gusto mong ikonekta sa entry na ito.',
            submittedPhotos: 'Mga isinumiteng larawan:',
            submittedWayspots: 'Mga isinumite na Wayspot:',
            editData: 'I-edit ang Wayspot Data',
            formSeparator: ':',
            latitude: 'Latitude',
            longitude: 'Longitude',
            city: 'Lungsod',
            state: 'Lalawigan/Estado',
            importData: 'Mag-import ng data ng Wayspot',
            importDataExplanation: 'Manu-manong mag-import ng data ng Wayspot sa JSON-format mula sa mga external na source gaya ng INGRESS IITC.',
            settingsHeader: 'Pagpapangkat ng mga Larawang Kontribusyon',
            settingsExplanation1: 'Kapag naka-on, ipinapakita ng Wayfarer Photo Contributions plug-in ang lahat ng larawan para sa isang partikular na Wayspot bilang isang entry sa page ng Contribution Management. Mangangailangan ito ng input ng user upang manu-manong i-link ang mga larawan na magkaka-ugnay.',
            settingsExplanation2: 'Kapag naka-off, ang bawat larawan ay ipapakita sa pahina ng Pamamahala ng Kontribusyon bilang isang indibidwal na entry, kahit na ang mga larawan ay nai-ugnay na kabilang sa isang partikular na Wayspot.',
            notificationString: `Nakakita ng isinumiteng larawan sa panahon ng pagsusuri ng Wayfarer! Ang mga detalye para sa '{title}' ay na-synchronize sa page ng Contributions Management.`,
        },
        tr_TR: {
            switchToPhotos: 'Fotoğraflara geç',
            switchToNominations: `Wayspots'a geç`,
            pending: 'Askıda olması',
            submitted: 'Gönderilen',
            linkPhotos: 'Fotoğrafları Bağlayın',
            linkPhotosExplanation1: 'Aynı Wayspot için fotoğraf gönderimlerini ilişkilendirmek için bu işlevi kullanın.',
            linkPhotosExplanation2: 'Bu girişe bağlamak istediğiniz her bir fotoğrafa tıklayın.',
            submittedPhotos: 'Gönderilen fotoğraflar:',
            submittedWayspots: 'Gönderilen Wayspots:',
            editData: 'Wayspot Verilerini Düzenle',
            formSeparator: ':',
            latitude: 'Enlem',
            longitude: 'Boylam',
            city: 'Şehir',
            state: 'Eyalet',
            importData: 'Wayspot Verilerini İçe Aktar',
            importDataExplanation: 'Wayspot verilerini Ingress IITC gibi harici kaynaklardan JSON formatında manuel olarak içe aktarın.',
            settingsHeader: 'Fotoğraf Katkılarının Gruplandırılması',
            settingsExplanation1: 'Wayfarer Photo Contributions eklentisi açıldığında, aynı Wayspot için tüm fotoğraflar Katkı Yönetimi sayfasında tek bir giriş olarak görüntülenecektir. Bu, fotoğrafları manuel olarak birbirine bağlamak için kullanıcı girişi gerektirecektir.',
            settingsExplanation2: "Kapatıldığında, fotoğraflar aynı Wayspot'a ait olarak birbirine bağlanmış olsa bile, her fotoğraf Katkı Yönetimi sayfasında ayrı bir giriş olarak görüntülenecektir.",
            notificationString: `Wayfarer incelemesi sırasında gönderilen bir fotoğraf bulundu! '{title}' ile ilgili ayrıntılar Katkı Yönetimi sayfasına senkronize edildi.`,
        }
    };

    // Function to check localStorage for wfpc_grouping_setting and assign the value to groupingSetting
    function initializeGroupingSetting() {
        const storedSetting = localStorage.getItem('wfpc_grouping_setting');
        groupingSetting = storedSetting === 'true';

        // If there is no value saved in localStorage, default to true
        if (storedSetting === null) {
            groupingSetting = true;
        }
    }


    const getL10N = () => {
        const i18n = JSON.parse(localStorage['@transloco/translations']);
        return i18n[language];
    };

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
            } else if (url == '/api/v1/vault/properties') {
                if (method == 'GET') {
                    this.addEventListener('load', interceptProperties, false);
                }
            } else if (url == '/api/v1/vault/review') {
                if (method == 'GET') {
                    this.addEventListener('load', parseReview, false);
                }
            } else if (url == '/api/v1/vault/settings') {
                if (method == 'GET') {
                    this.addEventListener('load', interceptSettings, false);
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

    function parseReview(e) {
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

            const result = json.result

            if (result.type === 'NEW' && result.nearbyPortals) {
                result.nearbyPortals.forEach(portal => {
                    extractLightshipDataFromReview(portal, 'NEW');
                });
                return;
            }
            if (result.type === 'EDIT' || result.type === 'PHOTO') {
                extractLightshipDataFromReview(result, result.type);
                return;
            }
        } catch (e)    {
            console.log(e); // eslint-disable-line no-console
        }
    }

    function interceptProperties() {
        try {
            const response = this.response;
            const json = JSON.parse(response);
            if (!json) return;
            if (!json.result || !json.result.language) return;

            const validLanguageCodes = [
                'en', 'ja_JP', 'ko_KR', 'pt_BR', 'cs_CZ', 'de_DE', 'es_ES',
                'fr_FR', 'it_IT', 'in', 'nl_NL', 'no_NO', 'pl_PL', 'ru_RU',
                'sv_SE', 'th_TH', 'zh_TW', 'bn_IN', 'hi_IN', 'mr_IN', 'ta_IN',
                'te_IN', 'tl_PH', 'tr_TR'
            ];

            language = json.result.language;
            if (!validLanguageCodes.includes(language)) {
                language = 'en'; // Fallback to 'en' if language is not in the valid codes
            }
        } catch (e) {
            console.error(e);
        }
    }

    function interceptSettings() {
        try {
            const response = this.response;
            const json = JSON.parse(response);
            if (!json) return;

            modifySettingsPage();
        } catch (e) {
            console.error(e);
        }
    }

    function extractLightshipDataFromReview(response, reviewType) {
        let matchingSubmission;

        if (reviewType === 'PHOTO') {
            // Check if any of the newPhotos URLs appear in photoSubmissions
            matchingSubmission = photoSubmissions.find(submission =>
                                                       response.newPhotos.some(photo => photo.value === submission.imageUrl || photo.value === submission.lightship.parentNomination)
                                                      );
        } else {
            const imageUrl = response.imageUrl;
            if (imageUrl) {
                matchingSubmission = photoSubmissions.find(submission => submission.imageUrl === imageUrl || submission.lightship.parentNomination === imageUrl);
            }
        }

        if (matchingSubmission) {
            // Check for changes before updating the matching submission with lightship data
            let changeDetected = false;

            changeDetected =
                response.title !== undefined && response.title !== matchingSubmission.lightship.title ||
                response.description !== undefined && response.description !== matchingSubmission.lightship.description ||
                response.lat !== undefined && response.lat !== matchingSubmission.lightship.lat ||
                response.lng !== undefined && response.lng !== matchingSubmission.lightship.lng ||
                response.guid !== undefined && response.guid !== matchingSubmission.lightship.guid;

            // Update the matching submission with lightship data only if changes are detected
            if (changeDetected) {
                matchingSubmission.lightship = {
                    ...matchingSubmission.lightship, // Copy existing properties
                    guid: response.guid !== undefined ? response.guid : matchingSubmission.lightship.guid || null,
                    title: response.title !== undefined ? response.title : matchingSubmission.lightship.title || null,
                    description: response.description !== undefined ? response.description : matchingSubmission.lightship.description || null,
                    lat: response.lat !== undefined ? response.lat : matchingSubmission.lightship.lat,
                    lng: response.lng !== undefined ? response.lng : matchingSubmission.lightship.lng,
                    _lastImported: new Date().getTime(),
                };

                matchingSubmission.submitted.edited = true;

                createNotification(response.title);

                synchronizeLightshipData(matchingSubmission, 'review');
            }
        }
    }

    function createNotification(title) {
        console.log(`Found a submitted photo during a Wayfarer review! Details for '${title}' have been synchronised to the Contributions Management page.`);

        const existingWfpcNotify = document.getElementById("wfpcNotify");
        const existingWfnshNotify = document.getElementById("wfnshNotify");

        if (existingWfpcNotify === null && existingWfnshNotify === null) {
            let container = document.createElement("div");
            container.id = "wfpcNotify";
            document.getElementsByTagName("body")[0].appendChild(container);
        }

        const notificationString = strings[language].notificationString.replace('{title}', title);

        const notification = document.createElement('div');
        notification.classList.add('wfpcNotification');
        notification.addEventListener('click', () => notification.parentNode.removeChild(notification));
        const content = document.createElement('p');
        content.textContent = notificationString;
        notification.appendChild(content);
        if (existingWfnshNotify) {
            existingWfnshNotify.appendChild(notification);
        } else {
            awaitElement(() => document.getElementById('wfpcNotify')).then(ref => ref.appendChild(notification));
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

            // Check if the object store with the old keyPath 'uuid' exists.
            if (db.objectStoreNames.contains(OBJECT_STORE_NAME) &&
                db.transaction([OBJECT_STORE_NAME]).objectStore(OBJECT_STORE_NAME).keyPath === 'uuid') {
                db.close();
                console.log(`Deleting object store ${OBJECT_STORE_NAME} with keyPath 'uuid'. Closing and incrementing version.`);

                // Delete the existing object store
                const deleteRequest = indexedDB.open('wayfarer-tools-db', dbVer + 1);
                deleteRequest.onupgradeneeded = deleteEvent => {
                    const deleteDB = deleteEvent.target.result;
                    deleteDB.deleteObjectStore(OBJECT_STORE_NAME);
                };

                deleteRequest.onsuccess = () => {
                    getIDBInstance(dbVer + 1).then(resolve);
                };
            } else if (!db.objectStoreNames.contains(OBJECT_STORE_NAME)) {
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

            // Create the object store with the new keyPath 'imageUrl'
            if (!db.objectStoreNames.contains(OBJECT_STORE_NAME)) {
                db.createObjectStore(OBJECT_STORE_NAME, { keyPath: 'imageUrl' });
            }
        };
    });

    // Call the functions to load submission data and email data from the IDB
    loadPhotoSubmissionsFromIDB().then(() => {
        // Now that photo submissions are loaded, proceed to load email data
        loadEmailDataFromIDB();
    });

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
                    if (photoSubmission.edited && photoSubmission.imageUrl) {
                        // Remove the 'edited' property
                        delete photoSubmission.edited;

                        // Save the rest of the data to IDB
                        const request = objectStore.put(photoSubmission);

                        request.onerror = () => {
                            console.error(`Error saving photo submission with image url: ${photoSubmission.imageUrl}`);
                            reject(`Error saving photo submission with image url: ${photoSubmission.imageUrl}`);
                        };
                    }
                });

                // Delete entries from IDB with image url not present in photoSubmissions
                // Could be because a Redacted Rejection has been matched to the real photo
                objectStore.openCursor().onsuccess = event => {
                    const cursor = event.target.result;
                    if (cursor) {
                        const storedImageUrl = cursor.value.imageUrl;
                        if (!photoSubmissions.some(submission => submission.imageUrl === storedImageUrl)) {
                            const deleteRequest = cursor.delete();
                            deleteRequest.onerror = () => {
                                console.error(`Error deleting photo submission with image url: ${storedImageUrl}`);
                                reject(`Error deleting photo submission with image url: ${storedImageUrl}`);
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

    // Function to log all email Message IDs and extract information to emailData
    async function loadEmailDataFromIDB() {
        try {
            const windowRef = typeof unsafeWindow !== 'undefined' ? unsafeWindow : window;
            // Check if the API and emailImport are defined
            if (windowRef.wft_plugins_api && windowRef.wft_plugins_api.emailImport) {

                const unprocessedEmails = [];

                // Create a list of already used message IDs so we don't reprocess same emails
                const existingMessageIds = [];
                for (const submission of photoSubmissions) {
                    if (submission.submitted) {
                        existingMessageIds.push(submission.submitted.messageId);
                    }
                    if (submission.outcome) {
                        existingMessageIds.push(submission.outcome.messageId);
                    }
                }

                await windowRef.wft_plugins_api.emailImport.prepare();
                for await (const email of windowRef.wft_plugins_api.emailImport.iterate()) {

                    try {
                        const messageClassify = email.classify();

                        // Skip emails which are not photo emails
                        if (messageClassify.type !== 'PHOTO_RECEIVED' && messageClassify.type !== 'PHOTO_DECIDED') {
                            continue;
                        }
                    } catch (error) {
                        console.error('Error retrieving email class:', error);
                    }

                    const messageId = email.messageID;

                    // Skip emails which we already have data for in the Photo Contributions plug-in
                    if (existingMessageIds.includes(messageId)) {
                        continue;
                    }

                    const emailInfo = parseEmailData(email);

                    unprocessedEmails.push(emailInfo);
                }

                extractDataFromEmails(unprocessedEmails);

                windowRef.wft_plugins_api.emailImport.addListener('wayfarer-photo-contributions.user.js', {
                    onImportStarted: async () => {
                        holdProcessing = true;
                    },
                    onImportCompleted: async () => {
                        holdProcessing = false;
                        createAllPhotoListItems();
                        sortAndFilterPhotoSubmissions();
                    },
                    onEmailImported: async email => {
                        const unprocessedEmails = [];
                        const emailInfo = parseEmailData(email);
                        unprocessedEmails.push(emailInfo);
                        await extractDataFromEmails(unprocessedEmails);
                    }
                });
            } else {
                console.error('window.wft_plugins_api.emailImport is not defined.');
            }
        } catch (error) {
            console.error('Error retrieving email instances:', error);
        }
    }

    function parseEmailData(email) {
        const messageId = email.messageID;
        const subject = email.getHeader('Subject');
        const date = email.getHeader('Date');
        const received = email.getHeader('Received', true);
        const xReceived = email.getHeader('X-Received', true);
        const from = email.getHeader('From');
        const importedDate = email.importedDate;
        const textHtml = email.getBody('text/html');
        const textPlain = email.getBody('text/plain');

        const classify = email.classify
        const language = classify.language

        const emailInfo = {
            messageId,
            subject,
            date,
            received,
            xReceived,
            from,
            language,
            importedDate,
            textHtml,
            textPlain,
        };

        return emailInfo;
    }

    appendFilterCssStyles();
    appendCustomCssStyles();

    async function modifyContributionsPage() {
        try {
            const pageHeader = await awaitElement(() => document.querySelector('wf-page-header'));

            const nextSibling = pageHeader.nextSibling;
            if (nextSibling) {
                nextSibling.classList.add('noms-list');
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

    function modifySettingsPage() {
        const l10n = getL10N();

        return new Promise(async (resolve, reject) => {
            try {
                // Wait for any element with class settings__item to be present
                const settingsItem = await awaitElement(() => document.querySelector('.settings__item'));

                // Find the parent of the settings__item element
                const parentDiv = settingsItem.parentElement;

                // Create a new div element for the settings item
                const newSettingsItem = document.createElement('div');
                newSettingsItem.classList.add('settings__item', 'settings-item');

                // Create and append the header div
                const headerDiv = document.createElement('div');
                headerDiv.classList.add('settings-item__header');

                // Create and append the title div
                const titleDiv = document.createElement('div');
                titleDiv.textContent = strings[language].settingsHeader;

                // Create and append the toggle container div
                const toggleContainerDiv = document.createElement('div');

                // Create and append the wf-slide-toggle element
                const wfSlideToggle = document.createElement('wf-slide-toggle');
                wfSlideToggle.setAttribute('color', 'primary');

                // Create and append the mat-slide-toggle element
                const matSlideToggle = document.createElement('mat-slide-toggle');
                matSlideToggle.classList.add('mat-slide-toggle', 'mat-primary');
                matSlideToggle.setAttribute('id', 'photo-grouping-slide-toggle');
                matSlideToggle.setAttribute('tabindex', '-1');

                // Create and append the label element
                const labelElement = document.createElement('label');
                labelElement.classList.add('mat-slide-toggle-label');
                labelElement.setAttribute('for', 'photo-grouping-toggle-input');

                // Create and append the mat-slide-toggle-bar element
                const matSlideToggleBar = document.createElement('div');
                matSlideToggleBar.classList.add('mat-slide-toggle-bar', 'mat-slide-toggle-bar-no-side-margin');

                // Create and append the input element
                const inputElement = document.createElement('input');
                inputElement.setAttribute('type', 'checkbox');
                inputElement.setAttribute('role', 'switch');
                inputElement.classList.add('mat-slide-toggle-input', 'cdk-visually-hidden');
                inputElement.setAttribute('id', 'photo-grouping-toggle-input');
                inputElement.setAttribute('tabindex', '0');
                inputElement.setAttribute('aria-checked', 'false');
                inputElement.addEventListener('change', toggleGroupingSettings);

                // Create and append the mat-slide-toggle-thumb-container element
                const thumbContainer = document.createElement('div');
                thumbContainer.classList.add('mat-slide-toggle-thumb-container');

                // Create and append the mat-slide-toggle-thumb element
                const thumbElement = document.createElement('div');
                thumbElement.classList.add('mat-slide-toggle-thumb');

                // Create and append the mat-ripple element
                const rippleElement = document.createElement('div');
                rippleElement.classList.add('mat-ripple', 'mat-slide-toggle-ripple', 'mat-focus-indicator');

                // Create and append the mat-ripple-element element
                const rippleChildElement = document.createElement('div');
                rippleChildElement.classList.add('mat-ripple-element', 'mat-slide-toggle-persistent-ripple');

                // Create and append the span element for mat-slide-toggle-content
                const spanElement = document.createElement('span');
                spanElement.classList.add('mat-slide-toggle-content');

                // Create and append the span element with display none
                const hiddenSpanElement = document.createElement('span');
                hiddenSpanElement.style.display = 'none';
                hiddenSpanElement.innerHTML = '&nbsp;';

                // Append the created elements to their respective parents
                thumbContainer.appendChild(thumbElement);
                thumbContainer.appendChild(rippleElement);
                rippleElement.appendChild(rippleChildElement);
                matSlideToggleBar.appendChild(inputElement);
                matSlideToggleBar.appendChild(thumbContainer);
                labelElement.appendChild(matSlideToggleBar);
                labelElement.appendChild(spanElement);
                spanElement.appendChild(hiddenSpanElement);
                matSlideToggle.appendChild(labelElement);
                wfSlideToggle.appendChild(matSlideToggle);
                toggleContainerDiv.appendChild(wfSlideToggle);

                headerDiv.appendChild(titleDiv);
                headerDiv.appendChild(toggleContainerDiv);
                // Create and append the value div
                const valueDiv = document.createElement('div');
                valueDiv.classList.add('settings-item__value');

                // Create and append the description div
                const descriptionDiv = document.createElement('div');
                descriptionDiv.classList.add('settings-item__description');

                // Create and append the first description paragraph
                const descriptionParagraph1 = document.createElement('div');
                descriptionParagraph1.textContent = strings[language].settingsExplanation1;

                // Create and append the second description paragraph with margin-top class
                const descriptionParagraph2 = document.createElement('div');
                descriptionParagraph2.classList.add('mt-2');
                descriptionParagraph2.textContent = strings[language].settingsExplanation2;

                // Append the created elements to the descriptionDiv
                descriptionDiv.appendChild(descriptionParagraph1);
                descriptionDiv.appendChild(descriptionParagraph2);

                // Append the child div elements to the newSettingsItem
                newSettingsItem.appendChild(headerDiv);
                newSettingsItem.appendChild(valueDiv);
                newSettingsItem.appendChild(descriptionDiv);

                // Insert the newSettingsItem as the fourth child in the parent div
                parentDiv.insertBefore(newSettingsItem, parentDiv.children[3]);

                setGroupingSettings();

                function setGroupingSettings() {
                    inputElement.setAttribute('aria-checked', groupingSetting.toString());
                    matSlideToggle.classList.toggle('mat-checked', groupingSetting);
                    valueDiv.textContent = groupingSetting ? l10n['global.on'] : l10n['global.off'];
                }

                function toggleGroupingSettings() {
                    groupingSetting = !groupingSetting;
                    localStorage.setItem('wfpc_grouping_setting', groupingSetting);
                    setGroupingSettings()
                }

                resolve();
            } catch (error) {
                console.error('Error modifying settings page:', error);
                reject(error);
            }
        });
    }

    function updateGroupedItemsCss() {
        const showGroupTag = groupingSetting === true;

        document.querySelectorAll('.wfpc-groupPhotoItemTag').forEach(tag => {
            tag.style.display = showGroupTag ? 'inline-block' : 'none';
        });

        document.querySelectorAll('.wfpc-singlePhotoItemTag').forEach(tag => {
            tag.style.display = showGroupTag ? 'none' : 'inline-block';
        });
    }

    function modifyExistingNominationsList() {
        // Find the existing button
        const existingButton = document.querySelector('.nominations__reverse-btn');

        if (existingButton) {
            // Create a new div with the specified class
            const newDiv = document.createElement('div');
            newDiv.className = 'flex flex-row';

            const newButton = document.createElement('button');
            newButton.classList.add('wf-button', 'wfpc-photos-list-buttons', 'wf-button--icon');
            newButton.setAttribute('wf-button', '');
            newButton.setAttribute('wftype', 'icon');
            newButton.id = 'switch-to-photos-button';

            const spanElement = document.createElement('span');
            spanElement.className = 'text-xs';
            spanElement.id = 'switch-to-photos-text';
            spanElement.innerText = `[ ${strings[language].switchToPhotos} ]`;

            // Attach click event listener to newButton
            newButton.addEventListener('click', toggleDisplayedList);

            // Append elements
            newButton.appendChild(spanElement);
            newDiv.appendChild(newButton);
            existingButton.parentNode.insertBefore(newDiv, existingButton);

            // Move existingButton inside newDiv
            newDiv.appendChild(existingButton);
        }
    }

    function toggleDisplayedList() {
        const photosListDiv = document.querySelector('.wfpc-photos-list');
        const nomsListDiv = document.querySelector('.noms-list');
        const nominationDetailsPane = document.querySelector('app-details-pane');
        const photoDetailsPane = document.querySelector('.wfpc-details-pane');

        // Check the current visibility state of photos-list
        const isPhotosListHidden = photosListDiv.classList.contains('hidden-list');

        // Toggle classes based on isPhotosListHidden
        photosListDiv.classList.toggle('hidden-list', !isPhotosListHidden);
        nomsListDiv.classList.toggle('hidden-list', isPhotosListHidden);

        if (nominationDetailsPane) {
            nominationDetailsPane.classList.toggle('hidden-list', isPhotosListHidden);
        }

        // Adjust logic based on visibility state
        if (isPhotosListHidden) {
            currentDisplay = 'photos';
            sortAndFilterPhotoSubmissions();
        } else {
            currentDisplay = 'wayspots';
            if (photoDetailsPane) {
                photoDetailsPane.remove();
            }
        }
    }

    // Function to extract additional data from emails
    function extractDataFromEmails(emails) {
        let skippedDuplicateEmailsCount = 0;
        let skippedMalformedEmailsCount = 0;
        let emailsToBeProcessedCount = 0;

        // console.log(`Photo Contributions: Received ${emails.length} from email API database.`);

        for (let i = emails.length - 1; i >= 0; i--) {
            const email = emails[i];

            // Extract timestamps from dates
            // Note to self: In future could be used to skip older email imports
            extractTimestampFromEmail(email);

            // Check if we have already used this email before. If so, skip it.
            const isAlreadyUsed = photoSubmissions.some(submission =>
                                                        submission.submitted.messageId === email.messageId || submission.outcome.messageId === email.messageId
                                                       );

            if (isAlreadyUsed) {
                skippedDuplicateEmailsCount++;
                emails.splice(i, 1);
                continue;
            }

            // Check if it matches a known media format by trying to extract Wayspot title
            extractTitleAndStatus(email);
            if (!email.title) {
                skippedMalformedEmailsCount++;
                emails.splice(i, 1);
                continue;
            }

            // Define an array of replacement pairs
            const replacements = [
                ["&amp;", "&"],
                ["&apos;", "'"],
                ["&quot;", "\""]
            ];

            // Perform replacements on title string
            if (email.title) {
                replacements.forEach(([oldStr, newStr]) => {
                    email.title = email.title.replace(new RegExp(oldStr, "g"), newStr);
                });
            }

            // Extract the image URL from media emails
            extractImageFromEmail(email);
            emailsToBeProcessedCount++;
        }

        // Remove unneccesary parts of the email
        const emailData = emails.map(email => {
            const { subject, textPlain, textHtml, date, ...rest } = email;
            return { ...rest };
        });

        // if (skippedDuplicateEmailsCount > 0) {
        //    console.log(`Photo Contributions: Skipped ${skippedDuplicateEmailsCount} email(s) because they are a duplicate or the email details are already assigned to a photo.`);
        //}
        //if (skippedMalformedEmailsCount > 0) {
        //    console.log(`Photo Contributions: Skipped ${skippedMalformedEmailsCount} email(s) because the email didn't match a known email template.`);
        //}

        matchEmailsToWayspots(emailData);

        if (!holdProcessing) {
            createAllPhotoListItems();
            sortAndFilterPhotoSubmissions();
        }
    }

    function extractTimestampFromEmail(email) {
        // Attempt to extract the timestamp from the received and x-received headers.
        // This is more accurate than using the date field as it may include milliseconds
        const regex1 = /\b([A-Za-z]{3},.*[+-]\d{4}(\s\([A-Z]+\))?)/;
        const regex2 = /\b(\d{4}-\d{2}-\d{2}\s.*\s[+-]\d{4}\s)/;

        // Function to extract timestamp from the last item of an array of strings
        function extractTimestampFromArray(arr) {
            const lastItem = arr[arr.length - 1];
            const match = regex1.exec(lastItem) || regex2.exec(lastItem);
            return match ? new Date(match[1]).getTime() : null;
        }

        // Function to adjust timestamp for rounding
        function adjustTimestampForRounding(timestamp) {
            const lastThreeDigits = timestamp.toString().slice(-3);
            return lastThreeDigits === '000' ? timestamp + 1000 : timestamp;
        }

        // Extract timestamps from email.received and email.xReceived
        const timestampReceived = extractTimestampFromArray(email.received);
        const timestampXReceived = extractTimestampFromArray(email.xReceived);

        // Compare and use the adjusted lowest timestamp for comparison
        if (timestampReceived !== null || timestampXReceived !== null) {
            const adjustedTimestampReceived = adjustTimestampForRounding(timestampReceived || Infinity);
            const adjustedTimestampXReceived = adjustTimestampForRounding(timestampXReceived || Infinity);

            // Use if-else statement to determine the smallest adjusted timestamp
            if (adjustedTimestampReceived < adjustedTimestampXReceived) {
                // Save the original timestamp for the smaller adjusted timestamp
                email.timestamp = timestampReceived;
                email.comparisonTimestamp = adjustedTimestampReceived;
            } else {
                // Save the original timestamp for the smaller adjusted timestamp
                email.timestamp = timestampXReceived;
                email.comparisonTimestamp = adjustedTimestampXReceived;
            }
        } else {
            // If no matches for either, use the new Date(email.date)
            const date = new Date(email.date);
            // Save the original timestamp
            email.timestamp = date.getTime();
        }

        const importedDate = new Date(email.importedDate);
        email.importedTimestamp = importedDate.getTime();
    }

    function extractImageFromEmail(email) {
        const textToSearch = email.textHtml || email.textPlain || '';

        const urlRegex = /http[s]?:\/\/[^\s<"]+/g;
        const matches = textToSearch.match(urlRegex);

        // Check whether the URL corresponds to a known photo URL format
        if (matches) {
            const imageMatch = matches.find(url => url.includes('ggpht') || url.includes('googleusercontent'));
            if (imageMatch) {
                email.imageUrl = imageMatch.replace(/^http:/, 'https:');
            }
        }
    }

    function extractTitleAndStatus(email) {
        const subject = email.subject;
        const from = email.from;
        const emailText = email.textPlain || email.textHtml;

        if (from === 'notices@wayfarer.nianticlabs.com') {

            const wayfarerSubmittedTemplates = {
                en: /Thanks! Niantic Wayspot Photo received for (?<title>.+)!/,
                bn: /ধন্যবাদ! (?<title>.+) এর জন্য Niantic Wayspot Photo পাওয়া গিয়েছে!/,
                cs: /Děkujeme! Přijali jsme Photo pro Niantic Wayspot (?<title>.+)!/,
                de: /Danke! Wir haben den Upload Photo für den Wayspot (?<title>.+) erhalten!/,
                es: /¡Gracias! ¡Hemos recibido el Photo del Wayspot de Niantic para (?<title>.+)!/,
                fr: /Remerciements ! Contribution de Wayspot Niantic Photo reçue pour (?<title>.+) !/,
                hi: /धन्यवाद! (?<title>.+) (के लिए Niantic Wayspot संपादन सुझाव प्राप्त हुआ!|साठी Niantic वेस्पॉट Photo प्राप्त झाले!)/,
                it: /Grazie! Abbiamo ricevuto Photo di Niantic Wayspot per (?<title>.+)./,
                ja: /ありがとうございます。 Niantic Wayspot Photo「(?<title>.+)」が受領されました。/,
                ko: /감사합니다! (?<title>.+)에 대한 Niantic Wayspot Photo 제출 완료/,
                mr: /धन्यवाद! (?<title>.+) साठी Niantic वेस्पॉट Photo प्राप्त झाले!/,
                nl: /Bedankt! Niantic Wayspot-Photo ontvangen voor (?<title>.+)!/,
                no: /Takk! Vi har mottatt Photo for Niantic-Wayspot-en (?<title>.+)!/,
                pl: /Dziękujemy! Odebrano materiały Photo Wayspotu Niantic (?<title>.+)./,
                pt: /Agradecemos o envio de Photo para o Niantic Wayspot (?<title>.+)!/,
                ru: /Спасибо! Получено: Photo Niantic Wayspot для (?<title>.+)/,
                sv: /Tack! Niantic Wayspot Photo togs emot för (?<title>.+)!/,
                ta: /நன்றி! (?<title>.+) -க்கான Niantic Wayspot Photo பெறப்பட்டது!/,
                te: /ధన్యవాదాలు! (?<title>.+)! కొరకు Niantic Wayspot Photo అందుకున్నాము!/,
                th: /ขอบคุณ! ได้รับ Niantic Wayspot Photo สำหรับ (?<title>.+) แล้ว!/,
                zh: /感謝你！ 我們已收到 (?<title>.+) 的 Niantic Wayspot Photo/
            };

            const wayfarerOutcomeTemplates = {
                en: {
                    title: /Niantic Wayspot media submission decided for (?<title>.+)/,
                    body: /Thank you for your Wayspot Photo submission for (?<title>.+) on (?<month>\w{3}) (?<day>\d{1,2}), (?<year>\d{4})/,
                    acceptanceText: 'Congratulations, the community has decided to accept your Wayspot Photo submission',
                    acceptanceTextNIA: 'Congratulations, our team has decided to accept your Wayspot Photo submission',
                },
                bn: {
                    title: /(?<title>.+)-এর জন্য Niantic Wayspot মিডিয়া জমা দেওয়ার সিদ্ধান্ত নেওয়া হয়েছে/,
                    body: /(?<month>\w{3}) (?<day>\d{1,2}), (?<year>\d{4})-এ (?<title>.+)-এর জন্য আপনার Wayspot Photo জমা দেওয়ার জন্য আপনাকে ধন্যবাদ জানাই/,
                    body_new_date_format: /(?<day>\d{1,2}) (?<month>.+?), (?<year>\d{4})-এ (?<title>.+)-এর জন্য আপনার Wayspot Photo জমা দেওয়ার জন্য আপনাকে ধন্যবাদ জানাই/,
                    acceptanceText: 'অভিনন্দন, সম্প্রদায়ের সিদ্ধান্ত অনুসারে আপনার Wayspot Photo-এর সম্পাদনার জমাকরণ তারা স্বীকার করেছেন',
                    acceptanceTextNIA: 'অভিনন্দন, আমাদের দল সিদ্ধান্ত নিয়েছে Photo-এর সম্পাদনার জমাকরণ তারা স্বীকার করেছেন',
                },
                cs: {
                    title: /Rozhodnutí o odeslání obrázku Niantic Wayspotu (?<title>.+)/,
                    body: /děkujeme za odeslání návrhu pro položku Photo Wayspotu (?<title>.+) ze dne (?<day>\d{1,2})\.\s?(?<month>\d{1,2})\.\s?(?<year>\d{4})/,
                    acceptanceText: 'Gratulujeme, komunita se rozhodla přijmout vaáš příspěvek Photo pro Wayspot',
                    acceptanceTextNIA: 'Gratulujeme, náš tým rozhodl přijmout vaáš příspěvek Photo pro Wayspot',
                },
                de: {
                    title: /Entscheidung zu deinem Upload für den Wayspot (?<title>.+)/,
                    body: /danke, dass du am (?<day>\d{1,2})\.(?<month>\d{2})\.(?<year>\d{4}) den Upload Photo für den Wayspot (?<title>.*) eingereicht hast/,
                    acceptanceText: 'Glückwunsch, die Community hat entschieden, deinen Upload Photo zu einem Wayspot zu akzeptieren',
                    acceptanceTextNIA: 'Glückwunsch, unser Team hat entschieden, deinen Upload Photo zu einem Wayspot zu akzeptieren.',
                },
                es: {
                    title: /Decisión tomada sobre el envío de archivo de Wayspot de Niantic para (?<title>.+)/,
                    body: /Gracias por el Photo del Wayspot para (?<title>.+) enviado el día (?<day>\d{1,2})[-\s](?<month>\w{3})\.?[-\s](?<year>\d{4})/,
                    acceptanceText: 'Enhorabuena, la comunidad ha decidido aceptar el envío de Photo de tu Wayspot',
                    acceptanceTextNIA: 'Enhorabuena, nuestro equipo ha decidido aceptar el envío de Photo de tu Wayspot.',
                },
                fr: {
                    title: /Résultat concernant le Wayspot Niantic (?<title>.+)/,
                    body: /Merci pour votre contribution de Wayspot Photo pour (?<title>.+) le (?<day>\d{1,2}) (?<month>[a-zA-Zéû]{3,4})\.? (?<year>\d{4})/,
                    acceptanceText: 'Félicitations, la communauté a décidé d’accepter votre proposition de Wayspot Photo',
                    acceptanceTextNIA: 'Félicitations, notre équipe a décidé d’accepter votre proposition de Wayspot Photo.',
                },
                hi: {
                    title: /(?<title>.+) के लिए तह Niantic Wayspot मीडिया सबमिशन/,
                    body: /प्रिय (?<username>.+),(\s+)(?<title>.+) पर (?<day>\d{1,2}) (?<month>.+?) (?<year>\d{4}) लिए आपके Wayspot Photo सबमिशन के लिए धन्यवाद।/,
                    body_new_date_format: /प्रिय (?<username>.+),([^]+?)(?<title>.+) पर (?<day>\d{1,2}) (?<month>.+?) (?<year>\d{4}) लिए आपके Wayspot Photo सबमिशन के लिए धन्यवाद।/,
                    acceptanceText: 'बधाई, समुदाय ने को आपके Wayspot संपादन को स्वीकार करने का निर्णय लिया है।',
                    acceptanceTextNIA: 'बधाई हमारी टीम ने का फ़ैसला लिया है को स्वीकार.',
                },
                it: {
                    title: /Proposta di contenuti multimediali di Niantic Wayspot decisa per (?<title>.+)/,
                    body: /grazie per la proposta di contenuti multimediali Photo di Wayspot per (?<title>.+) in data (?<day>\d{1,2})[- ](?<month>\w{3})[- ](?<year>\d{4})/,
                    acceptanceText: 'Congratulazioni, la tua proposta di Photo di Wayspot è stata accettata dalla comunità Wayfarer',
                    acceptanceTextNIA: 'Congratulazioni, il nostro team ha deciso di Photo di Wayspot è stata accettata.',
                },
                ja: {
                    title: /Niantic Wayspotのメディア申請「(?<title>.+)」が決定しました/,
                    body: /(?<year>\d{4})\/(?<month>\d{2})\/(?<day>\d{1,2})にWayspot Photo「(?<title>.+)」に関して申請していただき、ありがとうございました/,
                    acceptanceText: 'おめでとうございます。コミュニティはあなたのWayspot Photo申請を承認しました',
                    acceptanceTextNIA: 'おめでとうございます。当社のチームは次のことを決定しました Photo申請を承認しました。',
                },
                ko: {
                    title: /^(?<title>.+)에 대한 Niantic Wayspot 미디어 제안 결정 완료/,
                    body: /(?<year>\d{4})\. (?<month>\d{1,2})\. (?<day>\d{1,2})\.?에 (?<title>.+)에 대한 Wayspot Photo 미디어를 제출해 주셔서 감사합니다/,
                    acceptanceText: '기쁘게도, 커뮤니티에서 제안하신 Wayspot Photo 제안을 승인했습니다.',
                    acceptanceTextNIA: '기쁘게도, 우리 팀은 결정했습니다 Photo 제안을 승인했습니다.',
                },
                mr: {
                    title: /(?<title>.+) साठी Niantic वेस्पॉट मीडिया सबमिशनचा निर्णय घेतला/,
                    body: /(?<month>\w{3}) (?<day>\d{1,2}), (?<year>\d{4}) रोजी (?<title>.+) साठी तुमच्या वेस्पॉट Photo सबमिशनबद्दल धन्यवाद/,
                    body_new_date_format: /(?<day>\d{1,2}) (?<month>.+?), (?<year>\d{4}) रोजी (?<title>.+) साठी तुमच्या वेस्पॉट Photo सबमिशनबद्दल धन्यवाद/,
                    acceptanceText: 'अभिनंदन, समुदायाने तुमचे Photo सबमिशन स्वीकारण्याचा निर्णय घेतला आहे.',
                    acceptanceTextNIA: 'अभिनंदन, आमच्या टीमने निर्णय घेतला आहे Photo सबमिशन स्वीकारण्याचा निर्णय घेतला आहे.',
                },
                nl: {
                    title: /Besluit over Niantic Wayspot-media-inzending voor (?<title>.+)/,
                    body: /Bedankt voor je Wayspot-Photo-inzending voor (?<title>.+) op (?<day>\d{1,2})[- ](?<month>\w{3})\.?[- ](?<year>\d{4})/,
                    acceptanceText: 'Gefeliciteerd, de gemeenschap heeft besloten om je Wayspot-Photo-inzending wel te accepteren',
                    acceptanceTextNIA: 'Gefeliciteerd, ons team heeft besloten om je Wayspot om je Wayspot-Photo-inzending wel te accepteren.',
                },
                no: {
                    title: /En avgjørelse er tatt for Niantic Wayspot-medieinnholdet som er sendt inn for (?<title>.+)/,
                    body: /Takk for Photo-innholdet for Wayspot-en (?<title>.+), som du sendte inn (?<day>\d{1,2})\.(?<month>\w{3})\.(?<year>\d{4})/,
                    acceptanceText: 'Gratulerer – brukerne har valgt å godta Photo-innholdet du sendte inn for Wayspot-en',
                    acceptanceTextNIA: 'NO MATCHING TEMPLATE',
                },
                pl: {
                    title: /Decyzja na temat zgłoszenia materiałów do Wayspotu Niantic (?<title>.+)/,
                    body: /Dziękujemy za zgłoszenie (?<year>\d{4})-(?<month>\d{2})-(?<day>\d{1,2}) materiałów Photo do Wayspotu „(?<title>.+)”/,
                    body_new_date_format: /Dziękujemy za zgłoszenie (?<day>\d{1,2}) (?<month>\w{3}) (?<year>\d{4}) materiałów Photo do Wayspotu „(?<title>.+)”/,
                    acceptanceText: 'Gratulujemy, społeczność zdecydowała zaakceptować zgłoszenia materiałów Photo do Wayspotu',
                    acceptanceTextNIA: 'Gratulujemy, nasz zespół zdecydowała zaakceptować zgłoszenia materiałów Photo do Wayspotu.',
                },
                pt: {
                    title: /Decisão sobre o envio de mídia para o Niantic Wayspot (?<title>.+)/,
                    body: /Agradecemos o seu envio de Photo para o Wayspot (?<title>.+) em (?<day>\d{1,2})(?:\/| de )(?<month>\w{3})(?:\/| de )(?<year>\d{4})/,
                    acceptanceText: 'Parabéns, a comunidade decidiu aceitar o seu envio de Photo para o Wayspot',
                    acceptanceTextNIA: 'Parabéns, nossa equipe decidiu aceitar o seu envio de Photo para o Wayspot.',
                },
                ru: {
                    title: /Вынесено решение по предложению по файлу для (?<title>.+)/,
                    body: /Благодарим за заявку Wayfarer \(Photo\) для (?<title>.+), отправленную (?<day>\d{1,2})\.(?<month>\d{2})\.(?<year>\d{4})/,
                    body_new_date_format: /Благодарим за заявку Wayfarer \(Photo\) для (?<title>.+), отправленную (?<day>\d{1,2}) (?<month>.+?) (?<year>\d{4}) г\./,
                    acceptanceText: 'Поздравляем, сообщество решило принять ваше предложение по файлу (Photo) для Wayspot',
                    acceptanceTextNIA: 'Поздравляем, наша команда решила принять ваше предложение по файлу (Photo) для Wayspot.',
                },
                sv: {
                    title: /Niantic Wayspot-medieinlämning har beslutats om för (?<title>.+)/,
                    body: /Tack för din Wayspot Photo-inlämning för (?<title>.+) den (?<year>\d{4})-(?<month>\w{3})-(?<day>\d{1,2})/,
                    body_new_date_format: /Tack för din Wayspot Photo-inlämning för (?<title>.+) den (?<day>\d{1,2}) (?<month>\w{3})\.? (?<year>\d{4})/,
                    acceptanceText: 'Grattis måste vi meddela att vår community har beslutat att acceptera din Wayspot Photo-inlämning',
                    acceptanceTextNIA: 'Grattis informera dig om att vårt team har valt att att acceptera din Wayspot Photo-inlämning.',
                },
                ta: {
                    title: /(?<title>.+) -க்கான Niantic Wayspot மீடியா சமர்ப்பிப்பு பரிசீலிக்கப்பட்டது/,
                    body: /நாளது தேதியில் (?<month>\w{3}) (?<day>\d{1,2}), (?<year>\d{4}), (?<title>.+) -க்கான உங்களது Wayspot Photo சமர்ப்பிப்பிற்கு நன்றி/,
                    body_new_date_format: /நாளது தேதியில் (?<day>\d{1,2}) (?<month>.+?), (?<year>\d{4}), (?<title>.+) -க்கான உங்களது Wayspot Photo சமர்ப்பிப்பிற்கு நன்றி/,
                    acceptanceText: 'வாழ்த்துக்கள், குழு உங்கள் Wayspot – Photo -ஐ - ஏற்றுக்கொள்வதாக முடிவு செய்திருக்கிறது',
                    acceptanceTextNIA: 'வாழ்த்துக்கள், எங்கள் குழு முடிவு செய்துள்ளது Photo -ஐ - ஏற்றுக்கொள்வதாக முடிவு செய்திருக்கிறது.',
                },
                te: {
                    title: /(?<title>.+) కొరకు Niantic వేస్పాట్ మీడియా సమర్పణపై నిర్ణయం/,
                    body: /(?<month>\w{3}) (?<day>\d{1,2}), (?<year>\d{4}) తేదీన (?<title>.+) కొరకు మీరు సమర్పించిన Photo ను బట్టి ధన్యవాదాలు/,
                    body_new_date_format: /(?<day>\d{1,2}) (?<month>.+?), (?<year>\d{4}) తేదీన (?<title>.+) కొరకు మీరు సమర్పించిన Photo ను బట్టి ధన్యవాదాలు/,
                    acceptanceText: 'అభినందనలు, మీరు సమర్పించిన వేస్పాట్ Photo ను అంగీకరించడానికి ఉండటానికి కమ్యూనిటీ నిర్ణయించింది',
                    acceptanceTextNIA: 'అభినందనలు, మీరు సమర్పించిన వేస్పాట్ Photo ను అంగీకరించడానికి మా బృందం నిర్ణయించింది',
                },
                th: {
                    title: /ผลการตัดสินการส่งมีเดีย Niantic Wayspot สำหรับ (?<title>.+)/,
                    body: /ขอบคุณสำหรับการส่ง Wayspot Photo เรื่อง (?<title>.+) เมื่อวันที่ (?<day>\d{1,2}) (?<month>.*)? (?<year>\d{4})/,
                    acceptanceText: 'ขอแสดงความยินดี ชุมชนได้ตัดสินใจ ยอมรับ Wayspot Photo ของคุณ',
                    acceptanceTextNIA: 'ขอแสดงความยินดี ทีมงานของเราได้ตัดสินใจินใจ ยอมรับ Wayspot Photo',
                },
                zh: {
                    title: /社群已對你為 (?<title>.+) 提交的 Niantic Wayspot 媒體做出決定/,
                    body: /感謝你在 (?<year>\d{4})[-年](?<month>\d{1,2})[-月](?<day>\d{1,2})日? 為 (?<title>.+) 提交 Wayspot Photo/,
                    acceptanceText: '恭喜，社群已決定 接受你提交的 Wayspot Photo',
                    acceptanceTextNIA: '恭喜，本團隊決定 接受你提交的 Wayspot Photo',
                }
            }

            // Process Wayfarer Submitted emails.
            for (const lang in wayfarerSubmittedTemplates) {
                const pattern = wayfarerSubmittedTemplates[lang];
                const match = subject.match(pattern);

                if (match) {
                    const title = match.groups.title;
                    email.title = title;
                    email.template = 'Wayfarer';
                    email.status = 'submitted';
                    return;
                }
            }

            // Process Wayfarer Outcome Templates
            for (const lang in wayfarerOutcomeTemplates) {
                const langTemplates = wayfarerOutcomeTemplates[lang];
                const titleMatch = subject.match(langTemplates.title);

                if (titleMatch) {
                    const title = titleMatch.groups.title;
                    const bodyMatch = emailText.match(langTemplates.body);

                    if (bodyMatch) {
                        const day = bodyMatch.groups.day;
                        const month = bodyMatch.groups.month.toLowerCase();
                        const year = bodyMatch.groups.year;

                        email.originalSubmissionDate = convertDateComponents(lang, day, month, year);
                    } else if (langTemplates.body_new_date_format) {
                        const newBodyMatch = emailText.match(langTemplates.body_new_date_format);

                        if (newBodyMatch) {
                            const day = newBodyMatch.groups.day;
                            const month = newBodyMatch.groups.month.toLowerCase();
                            const year = newBodyMatch.groups.year;

                            email.originalSubmissionDate = convertDateComponents(lang, day, month, year, 'new');
                        }
                    }

                    if (emailText.includes(langTemplates.acceptanceText)) {
                        email.status = 'accepted';
                    } else if (emailText.includes(langTemplates.acceptanceTextNIA)) {
                        email.status = 'accepted';
                        email.decisionNIA = true;
                    } else {
                        email.status = 'rejected';
                    }

                    email.title = title;
                    email.template = 'Wayfarer';

                    return;
                }
            }

        } else if (from === 'hello@pokemongolive.com') {

            const pokemonSubmissionTemplates = {
                en: {
                    subject: /Photo Submission Received/,
                    body: /Photo submission confirmation: (?<title>.+)/,
                    id: /ID: (?<id>\S+)/,
                },
                de: {
                    subject: /Fotovorschlag erhalten/,
                    body: /wir haben dein eingereichtes Foto erhalten: (?<title>.+)/,
                    id: /ID: (?<id>\S+)/,
                }
            };

            const pokemonOutcomeTemplates = {
                en: {
                    subject: /Photo Submission (Accepted|Rejected)/,
                    body: /Photo review complete: (?<title>.+)/,
                    submissionDate: /Submission Date:([^]+?)(?<month>\w{3}) (?<day>\d{1,2}), (?<year>\d{4})/,
                    acceptanceText: 'Good work, Trainer',
                    id: /ID: (?<id>\S+)/,
                },
                de: {
                    subject: /Fotovorschlag (akzeptiert|abgelehnt)/,
                    body: /die Überprüfung deines Fotos ist abgeschlossen: (?<title>.+)/,
                    submissionDate: /Eingangsdatum:([^]+?)(?<day>\d{1,2})\.(?<month>\d{2})\.(?<year>\d{4})/,
                    acceptanceText: 'Gute Arbeit, Trainer',
                    id: /ID: (?<id>\S+)/,
                },
                zh: {
                    subject: /你投稿的照片通過審核了/,
                    body: /我們已完成下列照片的審核[:：] (?<title>.+)/,
                    submissionDate: /提交日期\s*[:：]\s*(?<year>\d{4})-(?<month>\d{1,2})-(?<day>\d{1,2})/,
                    acceptanceText: '現已反映在寶可補給站/道館上',
                    id: /ID: (?<id>\S+)/,
                }
            };

            // Process Pokemon Go Submitted Templates
            for (const lang in pokemonSubmissionTemplates) {
                const langTemplates = pokemonSubmissionTemplates[lang];
                const subjectMatch = subject.match(langTemplates.subject);
                const bodyMatch = emailText.match(langTemplates.body);
                const idMatch = emailText.match(langTemplates.id);

                if (subjectMatch && bodyMatch) {
                    email.status = 'submitted';
                    email.template = 'Pokemon Go';

                    email.title = bodyMatch.groups.title

                    if (idMatch) {
                        email.id = idMatch.groups.id;
                    }

                    return;
                }
            }

            // Process Pokemon Go Outcome Templates
            for (const lang in pokemonOutcomeTemplates) {
                const langTemplates = pokemonOutcomeTemplates[lang];
                const subjectMatch = subject.match(langTemplates.subject);
                const bodyMatch = emailText.match(langTemplates.body);
                const submissionDateMatch = emailText.match(langTemplates.submissionDate);
                const idMatch = emailText.match(langTemplates.id);

                if (subjectMatch && bodyMatch) {

                    email.template = "Pokemon Go";
                    email.title = bodyMatch.groups.title;

                    if (submissionDateMatch) {
                        const day = submissionDateMatch.groups.day;
                        const month = submissionDateMatch.groups.month.toLowerCase();
                        const year = submissionDateMatch.groups.year;

                        email.originalSubmissionDate = convertDateComponents(lang, day, month, year);
                    }

                    if (idMatch) {
                        email.id = idMatch.groups.id;
                    }

                    if (emailText.normalize().includes(langTemplates.acceptanceText.normalize())) {
                        email.status = 'accepted';
                    } else {
                        email.status = 'rejected';
                    }

                    return;
                }
            }
        } else {
            const ingressSubmittedTemplates = {
                en: {
                    title: /Portal photo submission confirmation(?:\s*:\s*(?<title>.+))?/,
                    id: /ID: (?<id>\S+)/,
                },
                de: {
                    title: /Portalfotovorschlag erhalten(?:\s*:\s*(?<title>.+))?/,
                    id: /ID: (?<id>\S+)/,
                },
            };

            const ingressOutcomeTemplates = {
                en: {
                    title: /Portal photo review complete(?:\s*:\s*(?<title>.+))?/,
                    submissionDate: /Submission Date:([^]+?)(?<month>\w{3}) (?<day>\d{1,2}), (?<year>\d{4})/,
                    id: /ID: (?<id>\S+)/,
                    acceptanceText: 'Good work, Agent'
                },
                de: {
                    title: /Überprüfung des Portalfotos abgeschlossen(?:\s*:\s*(?<title>.+))?/,
                    submissionDate: /das Datum der Einreichung:([^]+?)(?<day>\d{1,2})\.(?<month>\d{2})\.(?<year>\d{4})/,
                    id: /ID: (?<id>\S+)/,
                    acceptanceText: 'Ausgezeichnete Arbeit, Agent'
                },
                fr: {
                    title: /Évaluation de proposition de photo de Portail terminée(?:\s*:\s*(?<title>.+))?/,
                    submissionDate: /Date de Soumission: (?<day>\d{1,2}) (?<month>[a-zA-Z]{3,4})\.? (?<year>\d{4})/,
                    id: /ID: (?<id>\S+)/,
                    acceptanceText: 'Beau travail, Agent'
                },
                it: {
                    title: /Analisi della foto del Portale completata(?:\s*:\s*(?<title>.+))?/,
                    submissionDate: /Data di presentazione:([^]+?)(?<day>\d{1,2})-(?<month>\w{3})-(?<year>\d{4})/,
                    id: /ID: (?<id>\S+)/,
                    acceptanceText: 'Ben fatto, Agente'
                },
                ko: {
                    title: /포탈 사진 검토 완료(?:\s*:\s*(?<title>.+))?/,
                    submissionDate: /제출일:([^]+?)(?<year>\d{4})\.\s*(?<month>\d{1,2})\.\s*(?<day>\d{1,2})/,
                    id: /ID: (?<id>\S+)/,
                    acceptanceText: '수고하셨습니다'
                },
                pt: {
                    title: /A análise da foto do Portal foi concluída(?:\s*:\s*(?<title>.+))?/,
                    submissionDate: /Data de submissão:([^]+?)(?<day>\d{1,2})\/(?<month>[a-zA-Zéû]+)\/(?<year>\d{4})/,
                    id: /ID: (?<id>\S+)/,
                    acceptanceText: 'Bom trabalho, Agente'
                },
            };

            // Process Ingress Submitted Templates
            for (const lang in ingressSubmittedTemplates) {
                const langTemplates = ingressSubmittedTemplates[lang];
                const subjectMatch = subject.match(langTemplates.title);
                const bodyMatch = emailText.match(langTemplates.title);
                const idMatch = emailText.match(langTemplates.id);

                if (subjectMatch || bodyMatch) {
                    email.status = 'submitted';

                    const title = (subjectMatch && subjectMatch.groups.title) || (bodyMatch && bodyMatch.groups.title);
                    if (title) {
                        email.title = title.trim();
                        email.template = (subjectMatch && subjectMatch.groups.title) ? 'Ingress Redacted' : 'Ingress Prime';
                    }

                    if (idMatch) {
                        email.id = idMatch.groups.id;
                    }

                    return;
                }
            }

            // Process Ingress Outcome Templates
            for (const lang in ingressOutcomeTemplates) {
                const langTemplates = ingressOutcomeTemplates[lang];
                const subjectTitleMatch = subject.match(langTemplates.title);
                const bodyTitleMatch = emailText.match(langTemplates.title);
                const submissionDateMatch = emailText.match(langTemplates.submissionDate);
                const idMatch = emailText.match(langTemplates.id);

                if (subjectTitleMatch || (bodyTitleMatch && bodyTitleMatch.groups.title)) {

                    const title = (subjectTitleMatch && subjectTitleMatch.groups.title) || (bodyTitleMatch && bodyTitleMatch.groups.title);
                    if (title) {
                        email.title = title.trim();
                        email.template = (subjectTitleMatch && subjectTitleMatch.groups.title) ? 'Ingress Redacted' : 'Ingress Prime';
                    }

                    if (submissionDateMatch) {
                        const day = submissionDateMatch.groups.day;
                        const month = submissionDateMatch.groups.month.toLowerCase();
                        const year = submissionDateMatch.groups.year;

                        email.originalSubmissionDate = convertDateComponents(lang, day, month, year);
                    }

                    if (idMatch) {
                        email.id = idMatch.groups.id;
                    }

                    if (emailText.includes(langTemplates.acceptanceText)) {
                        email.status = 'accepted';
                    } else {
                        email.status = 'rejected';
                    }

                    return;
                }
            }
        }

        function convertDateComponents(lang, dayString, monthString, yearString, format) {
            const months = {
                en: ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'],
                bn: ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'],
                bn_new: ['জানু', 'ফেব', 'মার্চ', 'এপ্রিল', 'মে', 'জুন', 'জুলাই', 'আগস্ট', 'সেপ্টেম্বর', 'অক্টোবর', 'নভেম্বর', 'ডিসেম্বর'],
                cs: ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12'],
                de: ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12'],
                es: ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sept', 'oct', 'nov', 'dic'],
                fr: ['janv', 'févr', 'mars', 'avr', 'mai', 'juin', 'juil', 'août', 'sept', 'oct', 'nov', 'déc'],
                hi: ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'],
                hi_new: ['जन॰', 'फ़र॰', 'मार्च', 'अप्रैल', 'मई', 'जून', 'जुल॰', 'अग॰', 'सित॰', 'अक्तू॰', 'नव॰', 'दिस॰'],
                it: ['gen', 'feb', 'mar', 'apr', 'mag', 'giu', 'lug', 'ago', 'set', 'ott', 'nov', 'dic'],
                ja: ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12'],
                ko: ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12'],
                mr: ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'],
                mr_new: ['जाने', 'फेब्रु', 'मार्च', 'एप्रि', 'मे', 'जून', 'जुलै', 'ऑग', 'सप्टें', 'ऑक्टो', 'नोव्हें', 'डिसें'],
                nl: ['jan', 'feb', 'mrt', 'apr', 'mei', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec'],
                no: ['jan', 'feb', 'mar', 'apr', 'mai', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'des'],
                pl: ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12'],
                pl_new: ['sty', 'lut', 'mar', 'kwi', 'maj', 'cze', 'lip', 'sie', 'wrz', 'paź', 'lis', 'gru'],
                pt: ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'],
                ru: ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12'],
                ru_new: ['янв.', 'февр.', 'мар.', 'апр.', 'мая', 'июн.', 'июл.', 'авг.', 'сент.', 'окт.', 'нояб.', 'дек.'],
                sv: ['jan', 'feb', 'mar', 'apr', 'maj', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec'],
                sv_new: ['jan', 'feb', 'mar', 'apr', 'maj', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec'],
                ta: ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'],
                ta_new: ['ஜன.', 'பிப்.', 'மார்.', 'ஏப்.', 'மே', 'ஜூன்', 'ஜூலை', 'ஆக.', 'செப்.', 'அக்.', 'நவ.', 'டிச.'],
                te: ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'],
                te_new: ['జన', 'ఫిబ్ర', 'మార్చి', 'ఏప్రి', 'మే', 'జూన్', 'జులై', 'ఆగ', 'సెప్టెం', 'అక్టో', 'నవం', 'డిసెం'],
                th: ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'],
                zh: ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12']
            };

            const day = parseInt(dayString, 10);

            const normalizedMonthString = monthString.normalize();

            let monthIndex;

            if (format !== 'new') {
                monthIndex = months[lang].findIndex(m => m.normalize() === normalizedMonthString.toLowerCase());
            } else {
                monthIndex = months[`${lang}_new`].findIndex(m => m.normalize() === normalizedMonthString.toLowerCase());
            }

            const year = parseInt(yearString, 10);

            const originalSubmissionDate = new Date(year, monthIndex, day);
            return originalSubmissionDate;
        }
    }

    function extractUsingRegex(email, emailText, regex, months) {
        const match = emailText.match(regex);

        if (match) {
            const title = match.groups.title;
            const day = match.groups.day;
            const month = match.groups.month;
            const year = match.groups.year;

            if (title) {
                email.title = title;
            }

            if (day && month && year) {
                // Convert the date string to a JavaScript Date object
                const monthIndex = months.indexOf(month.toLowerCase());
                if (monthIndex !== -1) {
                    const formattedDateString = `${year}-${('0' + (monthIndex + 1)).slice(-2)}-${('0' + day).slice(-2)}`;
                    const dateObject = new Date(formattedDateString);
                    email.originalSubmissionDate = dateObject;
                }
            }
        }
    }

    // Helper function to create a new submission object
    function createNewSubmission(imageUrl, email, status) {
        return {
            imageUrl,
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
            outcome: (status === 'accepted' || status === 'rejected') ? {
                id: email.id,
                messageId: email.messageId,
                template: email.template,
                timestamp: email.timestamp,
                title: email.title,
                result: status,
                submittedDate: email.submittedDate,
            } : {
                id: null,
                messageId: null,
                template: null,
                timestamp: null,
                title: null,
                result: null,
                submittedDate: null,
            },
            lightship: {},
        };
    }


    function matchEmailsToWayspots(emailData) {
        // Keep track of which emails have been used for matching
        emailData.forEach(email => email.used = false);

        // Create a list of unique Wayspots from the unique image URLs
        emailData.forEach(email => {
            if (email.imageUrl && !photoSubmissions.some(submission => submission.imageUrl === email.imageUrl)) {
                const newSubmission = createNewSubmission(email.imageUrl, email, null);
                photoSubmissions.push(newSubmission);
            }
        });

        // Match submission emails to Wayspots using unique image URLs
        // Works for most templates except some older rejection templates
        emailData.forEach(email => {
            if (email.imageUrl) {
                const matchingSubmission = photoSubmissions.find(submission => submission.imageUrl === email.imageUrl);

                // Add data from the email to the submission
                if (matchingSubmission) {
                    // Account for photo appeals with two outcome emails.
                    if (
                        email.status !== 'submitted' &&
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
            if (email.id && !email.used && email.status !== 'submitted') {
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
                const newSubmission = createNewSubmission(null, email, 'rejected');
                photoSubmissions.push(newSubmission);
            }
        });

        // Add unique entries for unique emails with shared image IDs
        // Template: Ingress Redacted rejection
        emailData.forEach(email => {
            if (email.status === 'rejected' && email.template === 'Ingress Redacted') {
                const matchingSubmission = photoSubmissions.find(submission =>
                                                                 submission.outcome.messageId === email.messageId
                                                                );

                if (!matchingSubmission) {
                    email.used = true;
                    const newSubmission = createNewSubmission(email.imageUrl, email, 'rejected');
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
            if (submission.outcome.result === 'rejected' && !submission.matched && submission.outcome.template === 'Ingress Redacted') {

                const matchingSubmission = photoSubmissions.find(sub =>
                                                                 sub.submitted.title === submission.outcome.title &&
                                                                 sub.status === 'pending' &&
                                                                 !sub.matched &&
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
            if (
                submission.lightship.title &&
                (!submission.outcome.timestamp || submission.lightship._lastImported > submission.outcome.timestamp)
            ) {
                submission.title = submission.lightship.title;
            } else if (submission.outcome.title) {
                submission.title = submission.outcome.title;
            } else {
                submission.title = submission.submitted.title;
            }

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
            if (email.decisionNIA) {
                submission.outcome.decidedBy = 'NIA';
            }
        }
    }

    function createPhotosDiv() {
        const l10n = getL10N();
        const photosListDiv = document.createElement('div');
        photosListDiv.classList.add('wfpc-photos-list', 'hidden-list');

        // Constructing the HTML content
        const htmlContent = `
   <div class="w-full">
      <div class="flex flex-col mb-4">
         <div class="flex flex-row">
            <app-nominations-search class="flex-grow">
               <div class="flex flex-col"><span class="relative top-2 left-3 text-xs bg-gray-100 w-min">${l10n['nominations.search.title']}</span><input id="photos-search-input" type="text" class="w-full bg-transparent py-1 px-2 border border-black rounded-md"></div>
               <!---->
            </app-nominations-search>
            <button wf-button="" wftype="icon" class="wf-button cursor-pointer self-end ml-4 wf-button--icon" id="photos-filter-button"><img src="img/options.svg" alt="" class="dark:filter-icon"></button>
         </div>
         <div class="mt-2">
         <div class="flex flex-row">
                     <button wf-button="" wftype="icon" class="wf-button wfpc-photos-list-buttons wf-button--icon" id="switch-to-nominations-button">
               <span class="text-xs" id="switch-to-nominations-text">[ ${strings[language].switchToNominations} ]</span>
            </button>
            <button wf-button="" wftype="icon" class="wf-button wfpc-photos-list-buttons wf-button--icon" id="photos-sort-button">
               <span class="text-xs" id="photo-sort-text">${l10n['nominations.filter.recent']}</span>
               <mat-icon role="img" class="mat-icon notranslate material-icons mat-icon-no-color" aria-hidden="true" data-mat-icon-type="font">expand_more</mat-icon>
            </button>
         </div>
         </div>
         <!---->
      </div>
      <app-nominations-list class="w-full">
         <div>
            <cdk-virtual-scroll-viewport class="wfpc-cdk-virtual-scroll-viewport card">
               <div class="wfpc-photos-list-box" style="transform: translateY(0px);">
                  <!---->
               </div>
               <div class="wfpc-cdk-virtual-scroll-spacer" id="photo-scroll-spacer"></div>
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

        // // Add an event listener to the "Switch to Wayspots" button
        const switchToNominationsButton = document.getElementById('switch-to-nominations-button');
        switchToNominationsButton.addEventListener('click', toggleDisplayedList);

        // Add event listener for both search boxes (original + photos)
        const photosSearchInput = document.getElementById('photos-search-input');
        if (photosSearchInput) {
            photosSearchInput.addEventListener('input', (event) => {
                currentSearchTerm = event.target.value;
                updateSearchBoxes(currentSearchTerm);
            });
        }
        const wayspotSearchInput = document.querySelector('app-nominations-search input');
        if (wayspotSearchInput) {
            wayspotSearchInput.addEventListener('input', (event) => {
                currentSearchTerm = event.target.value;
                updateSearchBoxes(currentSearchTerm);
            });
        }

        // Add event listener for filter button
        const photosFilterButton = document.getElementById('photos-filter-button');
        photosFilterButton.addEventListener('click', createFilterOverlay);

        // Add event listener for the sort button
        const sortButton = document.getElementById('photos-sort-button');
        sortButton.addEventListener('click', handleSortButtonClicked);

        createAllPhotoListItems();
        sortAndFilterPhotoSubmissions();
    }

    function sortAndFilterPhotoSubmissions() {
        // Filter photoListItems based on filterSettings and currentSearchTerm
        const filteredPhotoListItems = photoListItems.filter((item) => {
            const matchesFilterSettings = groupingSetting
            ? (filterSettings.pending && item.pendingCount > 0) ||
                  (filterSettings.accepted && item.acceptedCount > 0) ||
                  (filterSettings.rejected && item.rejectedCount > 0)
            : (filterSettings.pending && item.status === 'pending') ||
                  (filterSettings.accepted && item.status === 'accepted') ||
                  (filterSettings.rejected && item.status === 'rejected');

            const trimmedSearchTerm = currentSearchTerm.trim().toLowerCase();
            const searchTitle = item.searchTitle.toLowerCase();
            const matchesSearch = !trimmedSearchTerm || searchTitle.includes(trimmedSearchTerm);

            const matchesGroup = groupingSetting ? item.group : true;

            return matchesFilterSettings && matchesSearch && matchesGroup;
        });

        // Sort the remaining values
        const sortedPhotoListItems = filteredPhotoListItems.sort((a, b) => {
            if (arrangementSettings === 'RECENT') {
                return sortDirection === 'ASCENDING' ? a.timestamp - b.timestamp : b.timestamp - a.timestamp;
            } else if (arrangementSettings === 'ALPHABETICAL') {
                const titleA = a.sortTitle.toLowerCase();
                const titleB = b.sortTitle.toLowerCase();
                return sortDirection === 'ASCENDING' ? titleA.localeCompare(titleB) : titleB.localeCompare(titleA);
            }
            return 0; // Default case, no sorting
        });

        // Join the matching photo items' HTML
        const newPhotoListItemsHTML = sortedPhotoListItems.map(item => item.html).join('');

        // Replace photosListBox.innerHTML with the joined HTML
        const photosListBox = document.getElementsByClassName("wfpc-photos-list-box")[0];

        if (photosListBox) {
            photosListBox.innerHTML = newPhotoListItemsHTML;
            photosListBox.removeEventListener('click', handlePhotosListBoxClick);
            photosListBox.addEventListener('click', handlePhotosListBoxClick);
        }

        updateGroupedItemsCss();

        // Set the height for the photo-scroll-spacer element to match the number of submissions
        const photoScrollSpacer = document.getElementById('photo-scroll-spacer');
        if (photoScrollSpacer) {
            const spacerHeight = sortedPhotoListItems.length * 128;
            photoScrollSpacer.style.height = spacerHeight + 'px';
        }
    }

    function handlePhotosListBoxClick(event) {
        // Replace photosListBox.innerHTML with the joined HTML
        const photosListBox = document.getElementsByClassName("wfpc-photos-list-box")[0];

        const clickedItem = event.target.closest('app-nominations-list-item');

        if (clickedItem) {
            // Remove selection highlighting from all items in the photos list
            const allItems = photosListBox.querySelectorAll('app-nominations-list-item');
            allItems.forEach(item => {
                const childDiv = item.querySelector('.nominations-item');
                if (childDiv) {
                    childDiv.classList.remove('nominations-item--selected');
                }
            });

            // Add selection highlighting to the clicked box
            const selectedChildDiv = clickedItem.querySelector('.nominations-item');
            if (selectedChildDiv) {
                selectedChildDiv.classList.add('nominations-item--selected');
            }

            // Extract the imgUrl associated with the clicked item (assuming it's the first child)
            const imgUrl = clickedItem.querySelector('.wfpc-photo-list-image').src;

            // Create the photo details pane using the imgUrl
            createPhotoDetailsPane(imgUrl);
        }
    }

    function createAllPhotoListItems() {
        photoListItems = [];

        photoSubmissions.forEach((submission) => {
            const photoListItem = createPhotoListItem(submission);
            if (photoListItem !== null) {
                photoListItems.push(photoListItem);
            }
        });
    }

    function createPhotoListItem(submission) {
        if (submission.submitted.timestamp === null) {
            return null; // Skip submissions with null timestamps
        }

        const sortTitle = submission.title;
        const status = submission.status;

        let submittedTitle = submission.submitted.title === sortTitle ? '' : submission.submitted.title || '';
        let outcomeTitle = submission.outcome.title === sortTitle ? '' : submission.outcome.title || '';

        const searchTitle = [sortTitle, submittedTitle, outcomeTitle].join(' / ');

        let linkedSubmissions;
        let groupData;

        const imageUrl = submission.imageUrl;

        // Create data for grouped display if the submission is not linked to anything
        if (!submission.linkedTo) {
            linkedSubmissions = findLinkedPhotoSubmissions(submission);

            // Count the number of nominations in the group by status
            const statusCounts = {};

            linkedSubmissions.forEach(linkedSubmission => {
                const linkedStatus = linkedSubmission.status;
                statusCounts[linkedStatus] = (statusCounts[linkedStatus] || 0) + 1;
            });

            groupData = {
                acceptedCount: statusCounts.accepted || 0,
                rejectedCount: statusCounts.rejected || 0,
                pendingCount: statusCounts.pending || 0,
            };
        }

        const html = createPhotosListHtml(submission, groupData);

        // Determine whether the submission is linked or not and set the 'group' property accordingly
        const group = !submission.linkedTo;

        return {
            sortTitle,
            status,
            searchTitle,
            imageUrl,
            timestamp: submission.submitted.timestamp,
            html: html,
            group: group,
            ...groupData,
        };
    }

    function createPhotosListHtml(photoSubmission, groupData) {
        const l10n = getL10N();

        const {
            imageUrl,
            title,
            status,
            submitted
        } = photoSubmission;

        const submittedTimestamp = submitted ? submitted.timestamp : null;

        const city = photoSubmission.lightship.city || '';
        const state = photoSubmission.lightship.state || '';
        const address = `${city && state ? `${city}, ${state}` : city || state}`;

        const outcomeClass = (() => {
            switch (status) {
                case "pending":
                    return "queue";
                case "accepted":
                    return "accepted";
                case "rejected":
                    return "rejected";
            }
        })();

        const outcomeText = (() => {
            switch (status) {
                case "pending":
                    return strings[language].pending;
                case "accepted":
                    return l10n['nominations.status.accepted'];
                case "rejected":
                    return l10n['nominations.status.notaccepted'];
            }
        })();

        const acceptedCount = groupData && groupData.acceptedCount ? groupData.acceptedCount : 0;
        const rejectedCount = groupData && groupData.rejectedCount ? groupData.rejectedCount : 0;
        const pendingCount = groupData && groupData.pendingCount ? groupData.pendingCount : 0;

        const totalCount = acceptedCount + rejectedCount + pendingCount;

        // Determine if the sash icon should be added
        const includeSashIcon = photoSubmission.status === "accepted" || acceptedCount > 0;

        // Add the sash icon HTML if needed
        const sashIconHTML = includeSashIcon
        ? `<img src="/img/sash.svg" class="wfpc-photo-list-sash">`
        : "";

        // Determine the count strings
        const acceptedCountHTML = acceptedCount > 0 ? `<span class="nomination-tag--accepted wfpc-groupPhotoItemTag">${totalCount > 1 ? `${acceptedCount}× ` : ''}${l10n['nominations.status.accepted']}</span>` : '';
        const rejectedCountHTML = rejectedCount > 0 ? `<span class="nomination-tag--rejected wfpc-groupPhotoItemTag">${totalCount > 1 ? `${rejectedCount}× ` : ''}${l10n['nominations.status.notaccepted']}</span>` : '';
        const pendingCountHTML = pendingCount > 0 ? `<span class="nomination-tag--queue wfpc-groupPhotoItemTag">${totalCount > 1 ? `${pendingCount}× ` : ''}${strings[language].pending}</span>` : '';

        const htmlContent = `
    <app-nominations-list-item>
      <div class="nominations-item">
        <img class="wfpc-photo-list-image" src="${imageUrl}">
        <div class="wfpc-photo-list-text-div">
          <div class="wfpc-photo-list-text-inner-div">
            <div>
              <div class="font-bold">${title}</div>
              <div class="text-xs">${address}</div>
            </div> ${sashIconHTML}
          </div>
          <div class="flex flex-row justify-between items-center my-2">
            <app-nomination-tag-set class="flex flex-wrap nominations-item__tags">
              <app-nomination-tag class="mr-1">
                <div class="nomination-tag">
                  <span class="nomination-tag--${outcomeClass} wfpc-singlePhotoItemTag"> ${outcomeText} </span>
                  ${acceptedCountHTML}
                  ${rejectedCountHTML}
                  ${pendingCountHTML}
                </div>
              </app-nomination-tag>
            </app-nomination-tag-set>
            <div class="text-xs whitespace-nowrap">${formatDate(submittedTimestamp)}
            </div>
          </div>
        </div>
      </div>
    </app-nominations-list-item>
    `;

        return htmlContent;
    }

    function updatePhotoListItem(submission) {
        const existingIndex = photoListItems.findIndex(item => item.imageUrl === submission.imageUrl);

        if (existingIndex !== -1) {
            // PhotoListItem found, remove it
            photoListItems.splice(existingIndex, 1);
        }

        // Create and add the updated PhotoListItem
        const updatedPhotoListItem = createPhotoListItem(submission);
        if (updatedPhotoListItem !== null) {
            photoListItems.push(updatedPhotoListItem);
        }
    }

    // Function to synchronise the search boxes
    function updateSearchBoxes(value) {
        const photosSearchInput = document.getElementById('photos-search-input');
        if (photosSearchInput) {
            photosSearchInput.value = value;
        }

        const appNominationsSearchInput = document.querySelector('app-nominations-search input');
        if (appNominationsSearchInput) {
            appNominationsSearchInput.value = value;
        }

        // Only filter the photos list if photos is currently being displayed
        if (currentDisplay === 'photos') {
            sortAndFilterPhotoSubmissions();
        }
    }

    function createOverlayContainer(width, contentCallback) {
        // Create a new div with class "cdk-overlay-container"
        const newOverlayContainer = document.createElement('div');
        newOverlayContainer.classList.add('cdk-overlay-photos-container');

        // Create backdrop element
        const backdrop = document.createElement('div');
        backdrop.classList.add('cdk-overlay-backdrop', 'cdk-overlay-dark-backdrop', 'cdk-overlay-backdrop-showing');
        backdrop.addEventListener('click', clearOverlay);

        // Create global overlay wrapper
        const globalOverlayWrapper = document.createElement('div');
        globalOverlayWrapper.classList.add('cdk-global-overlay-wrapper');
        globalOverlayWrapper.style.justifyContent = 'center';
        globalOverlayWrapper.style.alignItems = 'center';

        // Create cdk-overlay-pane
        const cdkOverlayPane = document.createElement('div');
        cdkOverlayPane.id = 'cdk-overlay-1';
        cdkOverlayPane.classList.add('cdk-overlay-pane');
        cdkOverlayPane.style.maxWidth = '80vw';
        cdkOverlayPane.style.width = width;
        cdkOverlayPane.style.position = 'static';

        // Create mat-dialog-container
        const matDialogContainer = document.createElement('mat-dialog-container');
        matDialogContainer.classList.add('mat-dialog-container');

        // Use the callback function to create the specific content
        const specificContent = contentCallback();
        matDialogContainer.appendChild(specificContent);

        // Append mat-dialog-container to cdk-overlay-pane
        cdkOverlayPane.appendChild(matDialogContainer);

        // Append backdrop, global overlay wrapper, and cdk-overlay-pane to the new overlay container
        newOverlayContainer.appendChild(backdrop);
        newOverlayContainer.appendChild(globalOverlayWrapper);
        globalOverlayWrapper.appendChild(cdkOverlayPane);

        return newOverlayContainer;
    }

    function createButtonsContainer(cancelId, cancelText, acceptId, acceptText, acceptCallback) {
        // Create buttons div
        const buttonsContainerDiv = document.createElement('div');
        buttonsContainerDiv.classList.add('flex', 'flex-row', 'w-full', 'justify-between', 'mt-4');

        // Create cancel button
        const cancelButton = document.createElement('button');
        cancelButton.id = cancelId;
        cancelButton.classList.add('wf-button');
        cancelButton.textContent = cancelText;
        cancelButton.addEventListener('click', clearOverlay);

        // Create accept button
        const acceptButton = document.createElement('button');
        acceptButton.id = acceptId;
        acceptButton.setAttribute('wftype', 'primary');
        acceptButton.classList.add('wf-button', 'wf-button--primary');
        acceptButton.textContent = acceptText;
        acceptButton.addEventListener('click', acceptCallback);

        // Append buttons to buttons div
        buttonsContainerDiv.appendChild(cancelButton);
        buttonsContainerDiv.appendChild(acceptButton);

        return buttonsContainerDiv;
    }

    // Function to create filter overlay
    function createFilterOverlay() {
        const l10n = getL10N();

        // Create content for the overlay
        function createOverlayContent() {
            const appNominationsSortModal = document.createElement('app-nominations-sort-modal');

            // Create div for 'Arrange' section of filter overlay
            const arrangeDiv = document.createElement('div');
            arrangeDiv.classList.add('mt-4');
            const arrangeHeader = document.createElement('h4');
            arrangeHeader.classList.add('mb-2');
            arrangeHeader.textContent = l10n['nominations.filter.header'];
            arrangeDiv.appendChild(arrangeHeader);

            // Create ratio buttons for 'Arrange' section of filter overlay
            const arrangeRadioGroup = createRadioGroup('arrange');
            const radioAlphabetical = createRadioButton('photo-radio-alphabetical', l10n['nominations.filter.title'], 'ALPHABETICAL', 'arrange');
            const radioRecent = createRadioButton('photo-radio-recent', l10n['nominations.filter.recent'], 'RECENT', 'arrange');
            arrangeRadioGroup.appendChild(radioAlphabetical);
            arrangeRadioGroup.appendChild(radioRecent);
            arrangeDiv.appendChild(arrangeRadioGroup);

            // Create div for 'Sort' section of filter overlay
            const sortDiv = document.createElement('div');
            sortDiv.classList.add('mt-4');
            const sortHeader = document.createElement('h4');
            sortHeader.classList.add('mb-2');
            sortHeader.textContent = l10n['nominations.filter.subheader'];

            // Create checkbox container and checkboxes
            const checkboxContainerDiv = document.createElement('div');
            checkboxContainerDiv.classList.add('sort-modal__statuses', 'flex', 'flex-col');

            const pendingCheckbox = createCheckbox('photo-filter-pending', strings[language].pending, 'pending');
            const acceptedCheckbox = createCheckbox('photo-filter-accepted', l10n['nominations.status.accepted'], 'accepted');
            const rejectedCheckbox = createCheckbox('photo-filter-rejected', l10n['nominations.status.notaccepted'], 'rejected')

            checkboxContainerDiv.appendChild(pendingCheckbox);
            checkboxContainerDiv.appendChild(acceptedCheckbox);
            checkboxContainerDiv.appendChild(rejectedCheckbox);

            sortDiv.appendChild(sortHeader);
            sortDiv.appendChild(checkboxContainerDiv);

            // Create buttons div
            const buttonsContainerDiv = createButtonsContainer('filter_cancel', l10n['nominations.btns.cancel'], 'filter_accept', l10n['nominations.btns.filter'], handleFilterButtonClick);

            // Append header, content, and buttons divs to app-nominations-sort-modal
            appNominationsSortModal.appendChild(arrangeDiv);
            appNominationsSortModal.appendChild(sortDiv);
            appNominationsSortModal.appendChild(buttonsContainerDiv);

            return appNominationsSortModal;
        }

        const newOverlayContainer = createOverlayContainer('300px', createOverlayContent);

        // Append the new overlay container to the end of the body
        document.body.appendChild(newOverlayContainer);

        // Initialise filter settings to match last used setting
        initializeFilterSettings();
    }

    function createRadioGroup(groupName) {
        const radioGroup = document.createElement('div');
        radioGroup.classList.add('mat-radio-group', 'flex', 'flex-col', 'space-y-2');
        radioGroup.setAttribute('name', groupName); // Set the name attribute

        return radioGroup;
    }

    function createRadioButton(id, labelText, value, groupName) {
        const radioGroup = createRadioGroup(groupName);

        const radioButton = document.createElement('mat-radio-button');
        radioButton.classList.add('mat-radio-button', 'mat-accent');
        radioButton.id = id;

        const label = document.createElement('label');
        label.classList.add('mat-radio-label');
        label.setAttribute('for', `${id}-input`);

        const radioContainer = document.createElement('span');
        radioContainer.classList.add('mat-radio-container');

        const outerCircle = document.createElement('span');
        outerCircle.classList.add('mat-radio-outer-circle');

        const innerCircle = document.createElement('span');
        innerCircle.classList.add('mat-radio-inner-circle');

        const input = document.createElement('input');
        input.type = 'radio';
        input.classList.add('mat-radio-input', 'cdk-visually-hidden');
        input.id = `${id}-input`;
        input.value = value;
        input.addEventListener('click', handleRadioButtonClick);

        const rippleContainer = document.createElement('span');
        rippleContainer.setAttribute('mat-ripple', '');
        rippleContainer.classList.add('mat-ripple', 'mat-radio-ripple', 'mat-focus-indicator');

        const rippleElement = document.createElement('span');
        rippleElement.classList.add('mat-ripple-element', 'mat-radio-persistent-ripple');

        rippleContainer.appendChild(rippleElement);
        radioContainer.append(outerCircle, innerCircle, input, rippleContainer);

        const labelContent = document.createElement('span');
        labelContent.classList.add('mat-radio-label-content');
        labelContent.innerHTML = `<span style="display: none;">&nbsp;</span>${labelText}`;

        label.appendChild(radioContainer);
        label.appendChild(labelContent);
        radioButton.appendChild(label);

        return radioButton;
    }

    function createCheckbox(id, label, value) {
        const wfCheckbox = document.createElement('wf-checkbox');
        wfCheckbox.setAttribute('value', value);
        wfCheckbox.classList.add('wfpc-checkbox');

        const matCheckbox = document.createElement('mat-checkbox');
        matCheckbox.classList.add('mat-checkbox', 'mat-accent');
        matCheckbox.id = id;

        const labelElement = document.createElement('label');
        labelElement.classList.add('mat-checkbox-layout');
        labelElement.setAttribute('for', `${id}-input`);

        const matCheckboxInnerContainer = document.createElement('span');
        matCheckboxInnerContainer.classList.add('mat-checkbox-inner-container');

        const checkboxInput = document.createElement('input');
        checkboxInput.type = 'checkbox';
        checkboxInput.classList.add('mat-checkbox-input', 'cdk-visually-hidden');
        checkboxInput.id = `${id}-input`;

        const rippleContainer = document.createElement('span');
        rippleContainer.classList.add('mat-ripple', 'mat-checkbox-ripple', 'mat-focus-indicator');

        const rippleElement = document.createElement('span');
        rippleElement.classList.add('mat-ripple-element', 'mat-checkbox-persistent-ripple');

        const checkboxFrame = document.createElement('span');
        checkboxFrame.classList.add('mat-checkbox-frame');

        const checkboxBackground = document.createElement('span');
        checkboxBackground.classList.add('mat-checkbox-background');

        const checkmarkSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        checkmarkSvg.setAttribute('version', '1.1');
        checkmarkSvg.setAttribute('focusable', 'false');
        checkmarkSvg.setAttribute('viewBox', '0 0 24 24');
        checkmarkSvg.setAttribute('xml:space', 'preserve');
        checkmarkSvg.classList.add('mat-checkbox-checkmark');

        const checkmarkPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        checkmarkPath.setAttribute('fill', 'none');
        checkmarkPath.setAttribute('stroke', 'white');
        checkmarkPath.setAttribute('d', 'M4.1,12.7 9,17.6 20.3,6.3');
        checkmarkPath.classList.add('mat-checkbox-checkmark-path');

        const mixedmark = document.createElement('span');
        mixedmark.classList.add('mat-checkbox-mixedmark');

        const checkboxLabel = document.createElement('span');
        checkboxLabel.classList.add('mat-checkbox-label');
        checkboxLabel.innerHTML = `<span style="display: none;">&nbsp;</span> ${label}`;

        // Attach event listener to the checkbox
        matCheckbox.addEventListener('click', handleCheckboxClick);

        // Append elements in the hierarchy
        wfCheckbox.appendChild(matCheckbox);
        labelElement.appendChild(matCheckboxInnerContainer);
        matCheckboxInnerContainer.appendChild(checkboxInput);
        matCheckboxInnerContainer.appendChild(rippleContainer);
        rippleContainer.appendChild(rippleElement);
        matCheckboxInnerContainer.appendChild(checkboxFrame);
        matCheckboxInnerContainer.appendChild(checkboxBackground);
        checkboxBackground.appendChild(checkmarkSvg);
        checkmarkSvg.appendChild(checkmarkPath);
        checkboxBackground.appendChild(mixedmark);
        labelElement.appendChild(checkboxLabel);
        matCheckbox.appendChild(labelElement);

        return wfCheckbox;
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
        const l10n = getL10N();
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
            sortText.textContent = l10n['nominations.filter.recent'];
            sortDirection = 'DESCENDING';
        } else if (arrangementSettings === 'ALPHABETICAL') {
            sortText.textContent = l10n['nominations.filter.title'];
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

    // Function to create filter overlay
    function createMatchPhotoOverlay(thisSubmission) {
        const l10n = getL10N();

        let searchInput, imagesLabel, nominationImagesLabel;

        // Create content for the overlay
        function createOverlayContent() {
            const appNominationsSortModal = document.createElement('app-nominations-sort-modal');

            // Create header div
            const headerDiv = document.createElement('div');
            const headerText = document.createElement('h4');
            headerText.classList.add('mb-2');
            headerText.textContent = strings[language].linkPhotos;
            headerDiv.appendChild(headerText);

            const headerExplanation = document.createElement('p');
            headerExplanation.textContent = strings[language].linkPhotosExplanation1;
            headerDiv.appendChild(headerExplanation);

            const headerExplanation2 = document.createElement('p');
            headerExplanation2.textContent = strings[language].linkPhotosExplanation2;
            headerDiv.appendChild(headerExplanation2);

            // Create a search box
            const searchContainer = document.createElement('searchContainer');
            searchContainer.classList.add('flex', 'flex-col');

            const searchLabel = document.createElement('span');
            searchLabel.classList.add('wfpc-search-header');
            searchLabel.textContent = l10n['nominations.search.title'];

            searchInput = document.createElement('input');
            searchInput.setAttribute('type', 'text');
            searchInput.classList.add('wfpc-input', 'border-black');
            searchInput.value = thisSubmission.title;

            searchContainer.appendChild(searchLabel);
            searchContainer.appendChild(searchInput);

            const imagesDiv = document.createElement('div');

            imagesLabel = document.createElement('p');
            imagesLabel.classList.add('mt-4', 'text-xs', 'hidden');
            imagesLabel.textContent = strings[language].submittedPhotos;

            // Create container to save the images from other photo submissions
            const imagesContainer = document.createElement('div');
            imagesContainer.id = 'imagesContainer';
            imagesContainer.classList.add('flex', 'flex-row');
            imagesContainer.style.overflowX = 'auto';

            nominationImagesLabel = document.createElement('p');
            nominationImagesLabel.classList.add('mt-4', 'text-xs', 'hidden');
            nominationImagesLabel.textContent = strings[language].submittedWayspots;

            // Create container to save the images from Wayspot nominations
            const nominationImagesContainer = document.createElement('div');
            nominationImagesContainer.id = 'nominationImagesContainer';
            nominationImagesContainer.classList.add('flex', 'flex-row');
            nominationImagesContainer.style.overflowX = 'auto';

            imagesDiv.appendChild(imagesLabel);
            imagesDiv.appendChild(imagesContainer);
            imagesDiv.appendChild(nominationImagesLabel);
            imagesDiv.appendChild(nominationImagesContainer);

            // Create buttons div
            const buttonsContainerDiv = createButtonsContainer('match_cancel', l10n['nominations.btns.cancel'], 'match_accept', l10n['settings.button.save'], saveLinkedPhotos);

            // Append header, content, and buttons divs to app-nominations-sort-modal
            appNominationsSortModal.appendChild(headerDiv);
            appNominationsSortModal.appendChild(searchContainer);
            appNominationsSortModal.appendChild(imagesDiv);
            appNominationsSortModal.appendChild(buttonsContainerDiv);

            return appNominationsSortModal;
        }

        // Use the createOverlayContainer function with the callback
        const newOverlayContainer = createOverlayContainer('600px', createOverlayContent);

        // Append the new overlay container to the end of the body
        document.body.appendChild(newOverlayContainer);


        // Add an event listener to the search input for real-time filtering
        searchInput.addEventListener('input', handleSearchInput);

        // Define variables to check linked and original status
        const isLinked = !!thisSubmission.linkedTo;

        let firstSubmission;

        if (!isLinked) {
            firstSubmission = thisSubmission;
        } else {
            firstSubmission = photoSubmissions.find(submission => submission.imageUrl === thisSubmission.linkedTo) || thisSubmission;
        }

        const linkedSubmissions = photoSubmissions.filter(submission => submission.linkedTo === firstSubmission.imageUrl);

        findAndDisplayMatchingPhotos(thisSubmission.title.toLowerCase());

        // Function to handle real-time filtering
        function handleSearchInput() {
            const searchTerm = searchInput.value.normalize().toLowerCase();
            findAndDisplayMatchingPhotos(searchTerm);
        }

        function findAndDisplayMatchingPhotos(searchTerm) {
            // Clear any existing images
            const imagesContainer = document.getElementById('imagesContainer');
            const nominationImagesContainer = document.getElementById('nominationImagesContainer');
            if (imagesContainer) {
                imagesContainer.innerHTML = '';
            }
            if (nominationImagesContainer) {
                nominationImagesContainer.innerHTML = '';
            }

            // Create a Set to store unique submissions
            const uniqueSubmissions = new Set();

            // Add firstSubmission and linkedSubmissions to the Set
            uniqueSubmissions.add(firstSubmission);
            linkedSubmissions.forEach(submission => uniqueSubmissions.add(submission));

            // Filter photoSubmissions based on the search term
            photoSubmissions.forEach(submission => {
                const isMatching = submission.title.toLowerCase().normalize().includes(searchTerm);
                if (isMatching) {
                    uniqueSubmissions.add(submission);
                }
            });

            // Remove thisSubmission from the Set
            uniqueSubmissions.delete(thisSubmission);

            // Only show the label if there are photos
            const matchingSubmissions = Array.from(uniqueSubmissions);

            if (matchingSubmissions.length > 0) {
                imagesLabel.classList.remove('hidden');
            } else {
                imagesLabel.classList.add('hidden');
            }

            // Also filter nominations for the search term and status 'ACCEPTED'
            let matchingNominations = [];
            let parentNomination;

            // Check if thisSubmission has a parentNomination
            if (thisSubmission.lightship.parentNomination) {
                parentNomination = nominations.find(nomination => nomination.imageUrl === thisSubmission.lightship.parentNomination);

                if (parentNomination) {
                    matchingNominations.push(parentNomination);
                }
            }

            // Filter other nominations based on the search term and status 'ACCEPTED'
            nominations.forEach((nomination) => {
                if ((!thisSubmission.lightship.parentNomination || nomination.imageUrl !== thisSubmission.lightship.parentNomination)
                    && nomination.title.normalize().toLowerCase().includes(searchTerm)
                    && nomination.status === 'ACCEPTED') {
                    matchingNominations.push(nomination);
                }
            });

            if (matchingNominations.length > 0) {
                nominationImagesLabel.classList.remove('hidden');
            } else {
                nominationImagesLabel.classList.add('hidden');
            }

            // Create and display images for each matching photo submission
            matchingSubmissions.forEach(submission => {
                const image = document.createElement('img');
                image.src = submission.imageUrl;
                image.alt = submission.title;
                image.title = submission.title;
                image.style.height = '150px';
                image.style.marginRight = '10px';
                image.addEventListener('click', () => toggleSelection(image));

                // Check if the image corresponds to firstSubmission or linkedSubmissions and initialize as selected
                if (submission === firstSubmission || linkedSubmissions.includes(submission)) {
                    image.classList.add('selected');
                    image.style.border = '10px solid #209129';
                }

                imagesContainer.appendChild(image);
            });

            // Create and display images for each matching nomination submission
            matchingNominations.forEach(nomination => {
                const image = document.createElement('img');
                image.src = nomination.imageUrl;
                image.alt = nomination.title;
                image.title = nomination.title;
                image.style.height = '150px';
                image.style.marginRight = '10px';
                image.addEventListener('click', () => toggleSelectionForNominations(image));

                // Check if the image corresponds to firstSubmission or linkedSubmissions and initialize as selected
                if (nomination === parentNomination) {
                    image.classList.add('selected');
                    image.style.border = '10px solid #209129';
                }
                nominationImagesContainer.appendChild(image);
            });
        }

        // Function to toggle image selection
        function toggleSelection(image) {
            const isSelected = image.classList.toggle('selected');
            image.style.border = isSelected ? '10px solid #209129' : 'none';
        }

        // Function to toggle image selection for matchingNominations
        function toggleSelectionForNominations(image) {
            const isSelected = image.classList.contains('selected');

            // Unselect all other matching nominations
            const nominationImages = document.querySelectorAll('#nominationImagesContainer img.selected');
            nominationImages.forEach(nominationImage => {
                if (nominationImage !== image) {
                    nominationImage.classList.remove('selected');
                    nominationImage.style.border = 'none';
                }
            });

            // Toggle selection for the clicked image
            image.classList.toggle('selected');
            image.style.border = isSelected ? 'none' : '10px solid #209129';
        }

        function saveLinkedPhotos() {
            const selectedImages = document.querySelectorAll('#imagesContainer img.selected');
            const selectedNominations = document.querySelectorAll('#nominationImagesContainer img.selected');

            // Get the imageUrl of the selected nomination (if any)
            const selectedNominationImageUrl = selectedNominations.length > 0 ? selectedNominations[0].src : undefined;

            if (selectedImages.length > 0 || linkedSubmissions.length > 0 || thisSubmission.lightship.parentNomination || selectedNominationImageUrl) {
                const selectedSubmissions = [thisSubmission, ...Array.from(selectedImages).map(image => {
                    return photoSubmissions.find(submission => submission.imageUrl === image.src);
                })];

                // Find the newest submission
                const newestSubmission = selectedSubmissions.reduce((newest, current) => {
                    return current.submitted.timestamp > newest.submitted.timestamp ? current : newest;
                }, selectedSubmissions[0]);

                // Clear linked status from all submissions
                // This allows previously linked submissions to get unlinked.
                linkedSubmissions.forEach(submission => {
                    submission.linkedTo = undefined;
                    submission.lightship = {};
                    submission.edited = true;
                });

                // Add linking to the current selected submissions
                // This is a reference to the oldest submission from the linked set.
                selectedSubmissions.forEach(submission => {
                    submission.linkedTo = newestSubmission === submission ? undefined : newestSubmission.imageUrl;
                    if (selectedNominationImageUrl) {
                        submission.lightship.parentNomination = selectedNominationImageUrl;
                    }
                    submission.edited = true;
                });

                // No selected nominations, remove parentNomination from linked submissions
                // Important to removing a linked Wayspot nomination
                if (selectedNominations.length === 0) {
                    selectedSubmissions.forEach(submission => {
                        if (submission.lightship.parentNomination) {
                            delete submission.lightship.parentNomination;
                            submission.edited = true;
                        }
                    });
                }

                clearOverlay();

                synchronizeLightshipData(thisSubmission, 'contributions');

                // If grouping mode is on, then remove associated photo list items, recreate and resort the list.
                // Not required if grouping mode is off.
                if (groupingSetting = true) {
                    const submissionsToUpdate = Array.from(new Set([...selectedSubmissions, ...linkedSubmissions]));

                    submissionsToUpdate.forEach(submission => {
                        updatePhotoListItem(submission);
                    });

                    sortAndFilterPhotoSubmissions()
                }
            }

            clearOverlay();
        }
    }

    // Function to create filter overlay
    function createImportDataOverlay(thisSubmission) {
        const l10n = getL10N();

        let textarea;

        // Create content for the overlay
        function createOverlayContent() {
            const appNominationsSortModal = document.createElement('app-nominations-sort-modal');

            // Create header div
            const headerDiv = document.createElement('div');
            const headerText = document.createElement('h4');
            headerText.classList.add('mb-2');
            headerText.textContent = strings[language].importData;
            headerDiv.appendChild(headerText);

            const headerExplanation = document.createElement('p');
            headerExplanation.textContent = strings[language].importDataExplanation;
            headerDiv.appendChild(headerExplanation);
            headerDiv.classList.add('mb-4');

            // Show the format for the input.
            const jsonStructure = `{
    "guid": "GUID",
    "title": "TITLE",
    "description": "DESCRIPTION",
    "lat": lat,
    "lng": lng,
    "city": "CITY",
    "state": "STATE",
    "country": "COUNTRY"
}`;

            textarea = document.createElement('textarea');
            textarea.rows = 10;
            textarea.placeholder = jsonStructure;
            textarea.classList.add('wfpc-input');

            // Create buttons div
            const buttonsContainerDiv = createButtonsContainer('import_cancel', l10n['nominations.btns.cancel'], 'import_accept', l10n['settings.button.save'], () => processImportedData(thisSubmission, textarea.value));

            // Append header, content, and buttons divs to app-nominations-sort-modal
            appNominationsSortModal.appendChild(headerDiv);
            appNominationsSortModal.appendChild(textarea);
            appNominationsSortModal.appendChild(buttonsContainerDiv);

            return appNominationsSortModal;
        }

        // Use the createOverlayContainer function with the callback
        const newOverlayContainer = createOverlayContainer('400px', createOverlayContent);

        // Append the new overlay container to the end of the body
        document.body.appendChild(newOverlayContainer);

        textarea.focus();
    }

    // Function to ensure that all linked submissions inherit the same Lightship data
    function synchronizeLightshipData(thisSubmission, referredFrom) {
        // Find all linked submissions to thisSubmission
        const linkedSubmissions = findLinkedPhotoSubmissions(thisSubmission);

        let parentNomination;
        let nominationTimestamp;

        // Attempt to find a parentNomination (i.e. submissions have been linked to a nomination from nomination list)
        linkedSubmissions.forEach(submission => {
            if (referredFrom === 'contributions' && submission.lightship.parentNomination) {
                parentNomination = nominations.find(nomination => nomination.imageUrl === submission.lightship.parentNomination);

                if (parentNomination) {
                    nominationTimestamp = Date.parse(parentNomination.day);
                }
            }
        });

        // Helper function to find the lightship data with the most recent _lastImported timestamp
        function findMostRecentLightshipData(lightshipField) {
            return linkedSubmissions.reduce((mostRecentData, currentData) => {
                if (currentData.lightship[lightshipField]) {
                    const currentTimestamp = currentData.lightship._lastImported;
                    const mostRecentTimestamp = mostRecentData._lastImported || 0;

                    // Check if mostRecentTimestamp is greater than 0 before considering the current submission
                    if (mostRecentTimestamp > 0 && currentTimestamp <= mostRecentTimestamp) {
                        return mostRecentData;
                    }

                    return currentData.lightship;
                }

                return mostRecentData;
            }, {});
        }

        // Create a new variable to temporarily store the lightshipData
        let lightshipData = {};

        // Copy additional values if parentNomination exists
        if (parentNomination) {
            // Only copy if the field is not already present in lightshipData or is null/undefined
            // This prevents parentNomination overwriting more recent data (hopefully)
            if (lightshipData.description === undefined || lightshipData.description === null) {
                lightshipData.description = parentNomination.description;
            }

            if (lightshipData.lat === undefined || lightshipData.lat === null) {
                lightshipData.lat = parentNomination.lat;
            }

            if (lightshipData.lng === undefined || lightshipData.lng === null) {
                lightshipData.lng = parentNomination.lng;
            }

            if (lightshipData.city === undefined || lightshipData.city === null) {
                lightshipData.city = parentNomination.city;
            }

            if (lightshipData.state === undefined || lightshipData.state === null) {
                lightshipData.state = parentNomination.state;
            }

            if (lightshipData._lastImported === undefined || lightshipData._lastImported === null) {
                lightshipData._lastImported = nominationTimestamp;
            }
        }

        // Remove fields with deleted flags
        // This may have been set during manual editing of Wayspot data
        if (thisSubmission.lightship.deletedFields) {
            Object.keys(thisSubmission.lightship.deletedFields).forEach(deletedField => {
                linkedSubmissions.forEach(submission => {
                    if (deletedField !== 'title') {
                        linkedSubmissions.forEach(submission => {
                            delete submission.lightship[deletedField];
                        });
                    }
                });
            });
        }

        // Remove the deleted flags themselves
        delete thisSubmission.lightship.deletedFields;

        // Copy across values from linked submissions
        ['guid', 'title', 'description', 'lat', 'lng', 'city', 'state', 'country', '_lastImported'].forEach(field => {
            const mostRecentData = findMostRecentLightshipData(field);

            // Only overwrite if mostRecentData[field] exists
            if (mostRecentData[field] !== undefined && mostRecentData[field] !== null) {
                lightshipData[field] = mostRecentData[field];
            }
        });

        // Push values from lightshipData into all linked submissions
        linkedSubmissions.forEach(submission => {
            submission.edited = true;
            // Iterate over all fields in lightshipData and update linked submissions
            ['guid', 'title', 'description', 'lat', 'lng', 'city', 'state', 'country', '_lastImported'].forEach(field => {
                if (field === 'title' && lightshipData.title !== undefined && lightshipData.title !== null && lightshipData.title !== '') {
                    submission.title = lightshipData.title;
                } else {
                    submission.lightship[field] = lightshipData[field];
                }
            });
        });

        if (referredFrom === 'contributions') {
            createPhotoDetailsPane(thisSubmission.imageUrl);
            updatePhotoListItems(linkedSubmissions);
        }

        savePhotoSubmissionsToIDB();
    }

    // Updates the title and address of the photo list items after a change in details.
    // Only required if grouping setting is false.
    // Otherwise, the photo items get completely rewritten more extensively.
    function updatePhotoListItems(linkedSubmissions) {
        const photosListDiv = document.querySelector('.wfpc-photos-list');

        linkedSubmissions.forEach(linkedSubmission => {
            const imageUrl = linkedSubmission.imageUrl;
            const title = linkedSubmission.title;
            const city = linkedSubmission.lightship.city || '';
            const state = linkedSubmission.lightship.state || '';

            // Find the corresponding photo list item based on imageUrl
            const photoListItem = photosListDiv.querySelector(`.nominations-item img[src="${imageUrl}"]`);

            if (photoListItem) {
                const listItem = photoListItem.closest('.nominations-item');

                if (listItem) {
                    const titleElement = listItem.querySelector('.font-bold');
                    const addressElement = listItem.querySelector('.text-xs');

                    if (titleElement) {
                        titleElement.textContent = title;
                    }

                    if (addressElement) {
                        const address = `${city && state ? `${city}, ${state}` : city || state}`;
                        addressElement.textContent = address;
                    }
                }
            }
        });
    }

    function findLinkedPhotoSubmissions(thisSubmission) {
        // Determine the URL to which the submissions are linked
        const linkingUrl = thisSubmission.linkedTo || thisSubmission.imageUrl;

        // Find linked submissions
        const linkedSubmissions = [
            ...photoSubmissions.filter(submission => submission.linkedTo === linkingUrl),
            ...photoSubmissions.filter(submission => submission.imageUrl === linkingUrl)
        ];

        return linkedSubmissions;
    }

    function createImageOverlay(imageUrl) {
        const overlayDiv = document.createElement('div');
        overlayDiv.classList.add('cdk-overlay-photos-container');
        overlayDiv.innerHTML = `
      <div class="cdk-overlay-backdrop wf-image-modal-backdrop cdk-overlay-backdrop-showing"></div>
      <div class="cdk-global-overlay-wrapper">
        <div class="cdk-overlay-pane wf-image-modal-panel">
          <mat-dialog-container>
            <wf-image-dialog>
              <div class="fixed inset-0 flex items-center justify-center cursor-pointer">
                <img class="max-h-full object-contain cursor-pointer" src="${imageUrl}=s0">
              </div>
              <button class="absolute p-4 text-white dark:text-white" type="button">
                <mat-icon class="material-icons">clear</mat-icon>
              </button>
            </wf-image-dialog>
          </mat-dialog-container>
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

    function createPhotoDetailsPane(imgUrl) {
        // Find the corresponding photoSubmission based on the imgUrl
        const photoSubmission = photoSubmissions.find(submission => submission.imageUrl === imgUrl);

        const l10n = getL10N();

        // Clear existing details pane if present
        const existingPhotoDetailsPane = document.querySelector('.wfpc-details-pane');
        if (existingPhotoDetailsPane) {
            existingPhotoDetailsPane.remove();
        }

        // Extract information from the photoSubmission object
        const { title, submission, status, imageUrl } = photoSubmission;
        const submittedTimestamp = photoSubmission.submitted.timestamp;
        const outcomeTimestamp = photoSubmission.outcome ? photoSubmission.outcome.timestamp : null;

        let currentImageUrl = imageUrl;

        const guid = photoSubmission.lightship.guid || '';
        const description = photoSubmission.lightship.description || '';

        const city = photoSubmission.lightship.city || '';
        const state = photoSubmission.lightship.state || '';
        const address = `${city && state ? `${city}, ${state}` : city || state}`;

        const lat = photoSubmission.lightship.lat;
        const lng = photoSubmission.lightship.lng;
        const coordinates = (lat && lng) ? `${lat.toFixed(6)},${lng.toFixed(6)}` : '';

        // Create the details pane structure
        const detailsPane = document.createElement('photo-details-pane');
        detailsPane.classList.add('wfpc-details-pane');

        const detailsPaneButtonsContainer = document.createElement('photo-details-menu');
        detailsPaneButtonsContainer.classList.add('wfpc-details-buttons-div');

        const matchPhotosButton = document.createElement('button');
        matchPhotosButton.classList.add('wf-button');
        matchPhotosButton.style.marginLeft = '0.8rem';
        matchPhotosButton.textContent = strings[language].linkPhotos;
        matchPhotosButton.addEventListener('click', function () {
            createMatchPhotoOverlay(photoSubmission);
        });
        detailsPaneButtonsContainer.appendChild(matchPhotosButton);

        const editMetadataButton = document.createElement('button');
        editMetadataButton.classList.add('wf-button');
        editMetadataButton.style.marginLeft = '0.8rem';
        editMetadataButton.textContent = strings[language].editData;
        editMetadataButton.addEventListener('click', function () {
            createMetadataEditOverlay(photoSubmission);
        });
        detailsPaneButtonsContainer.appendChild(editMetadataButton);

        const importButton = document.createElement('button');
        importButton.classList.add('wf-button');
        importButton.style.marginLeft = '0.8rem';
        importButton.textContent = strings[language].importData;
        importButton.addEventListener('click', function () {
            createImportDataOverlay(photoSubmission);
        });
        detailsPaneButtonsContainer.appendChild(importButton);

        detailsPane.appendChild(detailsPaneButtonsContainer);

        const detailsPaneInner = document.createElement('div');
        detailsPaneInner.classList.add('wfpc-details-pane-card', 'card', 'dark:bg-gray-800');

        detailsPane.appendChild(detailsPaneInner);

        // Create the header div containing the title
        const detailsHeaderDiv = document.createElement('div');
        detailsHeaderDiv.classList.add('wfpc-details-header');

        const innerHeaderDiv = document.createElement('div');

        const h4Element = document.createElement('h4');
        h4Element.textContent = title;

        if (coordinates) {
            const intelLink = document.createElement('a');
            intelLink.setAttribute('href', `https://intel.ingress.com/?ll=${coordinates}&z=16`);
            intelLink.setAttribute('target', '_blank');
            intelLink.setAttribute('title', 'Open in Intel');
            h4Element.setAttribute('style', 'color: rgba(59,130,246,var(--tw-text-opacity)) !important;');

            intelLink.appendChild(h4Element);
            innerHeaderDiv.appendChild(intelLink);
        } else {
            innerHeaderDiv.appendChild(h4Element);
        }

        detailsHeaderDiv.appendChild(innerHeaderDiv);
        detailsPaneInner.appendChild(detailsHeaderDiv);

        // Create the address and coordinates text (if data is present)
        const addressParagraph = document.createElement('p');
        addressParagraph.classList.add('wfpc-details-address');

        if (address) {
            addressParagraph.textContent = `${address} `;
        }

        if (coordinates) {
            addressParagraph.textContent += `(${coordinates})`;
            addressParagraph.style.cursor = 'pointer';
            addressParagraph.setAttribute('title', 'Copy coordinates to clipboard');
            addressParagraph.addEventListener('click', () => {
                navigator.clipboard.writeText(coordinates);
            });
        }

        detailsPaneInner.appendChild(addressParagraph);

        // Create and append the image element
        const imageElement = document.createElement('img');
        imageElement.classList.add('wfpc-details-image');
        imageElement.setAttribute('role', 'button');
        imageElement.setAttribute('src', imageUrl);
        imageElement.addEventListener('click', function () {
            createImageOverlay(currentImageUrl);
        });

        // Find linked submissions
        const linkedSubmissions = findLinkedPhotoSubmissions(photoSubmission);

        // Check if groupingSetting is true
        if (groupingSetting && linkedSubmissions.length > 1) {
            linkedSubmissions.sort((a, b) => b.submitted.timestamp - a.submitted.timestamp);

            // Create an image carousel
            const carouselImagesContainer = document.createElement('div');
            carouselImagesContainer.classList.add('wfpc-details-carousel-container');

            // Create a container for each linked submission
            linkedSubmissions.forEach(linkedSubmission => {

                // Container for each linked submission
                const linkedSubmissionContainer = document.createElement('div');
                linkedSubmissionContainer.classList.add('wfpc-linked-submission-container');

                // Image element for the linked submission
                const linkedImage = document.createElement('img');
                linkedImage.classList.add('wfpc-details-carousel-image');
                linkedImage.setAttribute('src', linkedSubmission.imageUrl);

                linkedImage.addEventListener('load', () => {
                    // Adjust the width based on the actual image width
                    linkedImage.style.width = 'auto';
                });

                linkedImage.addEventListener('click', () => {
                    // Replace the current image with the clicked image
                    currentImageUrl = linkedSubmission.imageUrl;
                    imageElement.setAttribute('src', linkedSubmission.imageUrl);

                    // Place border around currently selected image
                    document.querySelectorAll('.wfpc-details-carousel-image').forEach(image => {
                        image.classList.remove('wfpc-carousel-image-selected');
                    });
                    linkedImage.classList.add('wfpc-carousel-image-selected');

                    // Replace existing outcomes dropdown
                    const existingDropdown = document.querySelector('.wfpcDropdown');
                    if (existingDropdown) {
                        existingDropdown.remove();
                    }
                    createOutcomeDropdown(linkedSubmission);

                    // Update the appeal button
                    removeAppealButton()
                    addAppealButton(linkedSubmission);
                });

                linkedSubmissionContainer.appendChild(linkedImage);

                // Create the outcome coloured box for the linked submission
                let statusClass = linkedSubmission.status === 'pending' ? 'queue' : linkedSubmission.status;

                const tagSetElement = document.createElement('app-nomination-tag-set');
                tagSetElement.setAttribute('class', 'flex flex-row');
                const tagElement = document.createElement('app-nomination-tag');
                const divElement = document.createElement('div');
                divElement.setAttribute('class', 'nomination-tag');
                const spanElement = document.createElement('span');
                spanElement.setAttribute('class', `nomination-tag--${statusClass}`);

                const outcomeText = linkedSubmission.status === "pending"
                ? strings[language].pending
                : linkedSubmission.status === "accepted"
                ? l10n['nominations.status.accepted']
                : linkedSubmission.status === "rejected"
                ? l10n['nominations.status.notaccepted']
                : strings[language].pending; // Default text if none of the conditions match
                spanElement.textContent = outcomeText;

                divElement.appendChild(spanElement);
                tagElement.appendChild(divElement);
                tagSetElement.appendChild(tagElement);

                const outcomeDisplayDiv = document.createElement('div');
                outcomeDisplayDiv.classList.add('wfpc-details-outcome-div', 'mt-2');
                outcomeDisplayDiv.appendChild(tagSetElement);

                linkedSubmissionContainer.appendChild(outcomeDisplayDiv);

                // Append the container for the linked submission to the carousel
                carouselImagesContainer.appendChild(linkedSubmissionContainer);
            });

            detailsPaneInner.appendChild(carouselImagesContainer);
        }

        const outcomeDisplayDiv = document.createElement('div');
        outcomeDisplayDiv.classList.add('wfpc-details-outcome-div');

        detailsPaneInner.appendChild(outcomeDisplayDiv);

        const tagSetElement = document.createElement('app-nomination-tag-set');
        tagSetElement.setAttribute('class', 'flex flex-row');

        if (!groupingSetting || linkedSubmissions.length === 1) {
            // Create the outcome coloured box
            let statusClass = status === 'pending' ? 'queue' : status;


            const tagElement = document.createElement('app-nomination-tag');
            const divElement = document.createElement('div');
            divElement.setAttribute('class', 'nomination-tag');
            const spanElement = document.createElement('span');
            spanElement.setAttribute('class', `nomination-tag--${statusClass}`);

            const outcomeText = status === "pending"
            ? strings[language].pending
            : status === "accepted"
            ? l10n['nominations.status.accepted']
            : status === "rejected"
            ? l10n['nominations.status.notaccepted']
            : strings[language].pending; // Default text if none of the conditions match
            spanElement.textContent = outcomeText;

            divElement.appendChild(spanElement);
            tagElement.appendChild(divElement);
            tagSetElement.appendChild(tagElement);
        }

        outcomeDisplayDiv.appendChild(tagSetElement);

        function createOutcomeDropdown(submission) {
            const status = submission.status;
            const submittedDate = formatDate(submission.submitted.timestamp);
            const outcomeDate = formatDate(submission.outcome.timestamp);

            // Create the drop down for the submitted date and decision date
            // Utilise same system as Nomination Status History for consistency.
            const wfpcDropdown = document.createElement('div');
            wfpcDropdown.setAttribute('class', 'wfpcDropdown');

            const wfpcDDLeftBox = document.createElement('a');
            wfpcDDLeftBox.setAttribute('class', 'wfpcDDLeftBox');
            wfpcDDLeftBox.textContent = '▶';

            const wfpcDDRightBox = document.createElement('div');
            wfpcDDRightBox.setAttribute('class', 'wfpcDDRightBox');

            const wfpcOneLineParagraph = document.createElement('p');
            wfpcOneLineParagraph.setAttribute('class', 'wfpcOneLine');
            wfpcOneLineParagraph.style.display = 'block';

            if (status === 'pending') {
                wfpcOneLineParagraph.textContent = `${submittedDate} - ${strings[language].submitted}`;
            } else if (status === 'accepted') {
                wfpcOneLineParagraph.textContent = `${outcomeDate} - ${l10n['nominations.status.accepted']}`;
            } else if (status === 'rejected') {
                wfpcOneLineParagraph.textContent = `${outcomeDate} - ${l10n['nominations.status.notaccepted']}`;
            }

            if (status != 'pending' && submission.outcome.decidedBy && submission.outcome.decidedBy === 'NIA') {
                wfpcOneLineParagraph.textContent += ' (NIA)';
            }

            wfpcDDRightBox.appendChild(wfpcOneLineParagraph);

            const wfpcInnerDiv = document.createElement('div');
            wfpcInnerDiv.setAttribute('class', 'wfpcInner');
            wfpcInnerDiv.style.display = 'none';

            const windowRef = typeof unsafeWindow !== 'undefined' ? unsafeWindow : window;

            function createLinkElement(textContent, messageId, clickHandler) {
                const linkElement = document.createElement('a');
                linkElement.textContent = textContent;
                linkElement.addEventListener('click', e => {
                    e.stopPropagation();
                    windowRef.wft_plugins_api.emailImport.get(messageId).then(eml => eml.display());
                });
                return linkElement;
            }

            if (windowRef.wft_plugins_api && windowRef.wft_plugins_api.emailImport) {
                const submittedLink = createLinkElement(strings[language].submitted, submission.submitted.messageId);
                const submittedLine = document.createElement('p');
                submittedLine.appendChild(document.createTextNode(`${submittedDate} - `));
                submittedLine.appendChild(submittedLink);
                wfpcInnerDiv.appendChild(submittedLine);

                if (status !== 'pending') {
                    let outcomeText = status === 'accepted' ? l10n['nominations.status.accepted'] : l10n['nominations.status.notaccepted'];
                    if (submission.outcome.decidedBy && submission.outcome.decidedBy === 'NIA') {
                        outcomeText += ' (NIA)';
                    }
                    const outcomeLink = createLinkElement(outcomeText, submission.outcome.messageId);
                    const outcomeLine = document.createElement('p');
                    outcomeLine.appendChild(document.createTextNode(`${outcomeDate} - `));
                    outcomeLine.appendChild(outcomeLink);
                    wfpcInnerDiv.appendChild(outcomeLine);
                }
            } else {
                wfpcInnerDiv.appendChild(document.createTextNode(`${submittedDate} - ${strings[language].submitted}`));

                if (status !== 'pending') {
                    const outcomeText = status === 'accepted' ? l10n['nominations.status.accepted'] : l10n['nominations.status.notaccepted'];
                    wfpcInnerDiv.appendChild(document.createTextNode(`${outcomeDate} - ${outcomeText}`));
                }
            }

            wfpcDDRightBox.appendChild(wfpcInnerDiv);

            wfpcDropdown.appendChild(wfpcDDLeftBox);
            wfpcDropdown.appendChild(wfpcDDRightBox);

            outcomeDisplayDiv.appendChild(wfpcDropdown);

            wfpcDropdown.addEventListener('click', () => {
                wfpcOneLineParagraph.style.display = (wfpcOneLineParagraph.style.display === 'none') ? 'block' : 'none';
                wfpcInnerDiv.style.display = (wfpcInnerDiv.style.display === 'none') ? 'block' : 'none';
                wfpcDDLeftBox.textContent = (wfpcDDLeftBox.textContent === '▶') ? '▼' : '▶';
            });
        }

        createOutcomeDropdown(photoSubmission);

        detailsPaneInner.appendChild(imageElement);

        // Create the description section if it exists
        if (description) {
            const descriptionSection = document.createElement('div');
            descriptionSection.classList.add('wfpc-details-description-div');

            const descriptionHeader = document.createElement('h5');
            descriptionHeader.classList.add('wfpc-details-description-header');
            descriptionHeader.textContent = l10n['nominations.item.description'];

            const descriptionDiv = document.createElement('div');
            descriptionDiv.textContent = description;

            descriptionSection.appendChild(descriptionHeader);
            descriptionSection.appendChild(descriptionDiv);

            detailsPaneInner.appendChild(descriptionSection);
        }

        // Find the parent of wf-page-header
        const pageHeaderParent = document.querySelector('wf-page-header').parentNode;

        // Attach the details pane as the next sibling of the parent
        pageHeaderParent.parentNode.insertBefore(detailsPane, pageHeaderParent.nextSibling);

        // Initialise highlighting of currently selected image from carousel
        if (groupingSetting && linkedSubmissions.length > 1) {
            const matchingImage = document.querySelector(`.wfpc-details-carousel-image[src="${currentImageUrl}"]`);
            if (matchingImage) {
                matchingImage.classList.add('wfpc-carousel-image-selected');
            }
        }

        addAppealButton(photoSubmission);

        function addAppealButton(photoSubmission) {
            if (photoSubmission.status === 'rejected') {
                const appealButton = document.createElement('button');
                appealButton.classList.add('wf-button', 'wf-button--accent');
                appealButton.textContent = l10n['nominations.item.appeal'];
                appealButton.id = 'wfpc-appeal-button';
                appealButton.title = 'Copy appeal template to clipboard and open new forum appeal';
                appealButton.addEventListener('click', function () {
                    handleAppealButton(photoSubmission);
                });
                detailsPaneButtonsContainer.insertBefore(appealButton, detailsPaneButtonsContainer.firstChild);
            }
        }

        function removeAppealButton() {
            const appealButton = document.getElementById('wfpc-appeal-button');
            if (appealButton) {
                appealButton.remove();
            }
        }
    }

    // Function to create metadata edit overlay
    function createMetadataEditOverlay(submission) {
        const l10n = getL10N();

        const {
            title = '',
            status = '',
            submittedTimestamp = '',
            outcomeTimestamp = '',
            lightship: {
                description = '',
                lat = '',
                lng = '',
                city = '',
                state = ''
            } = {}
        } = submission;

        const latRounded = (lat) ? lat.toFixed(6) : '';
        const lngRounded = (lng) ? lng.toFixed(6) : ''

        // Create content for the overlay
        function createOverlayContent() {
            const appNominationsSortModal = document.createElement('app-nominations-sort-modal');

            // Create div for Wayspot details
            const wayspotDetailsDiv = document.createElement('div');
            wayspotDetailsDiv.classList.add('details-div');
            wayspotDetailsDiv.classList.add('mt-2');

            // Create header
            const header = document.createElement('h4');
            header.textContent = strings[language].editData;
            header.classList.add('mb-4');
            wayspotDetailsDiv.appendChild(header);

            // Usage
            const wayspotDetailsTable = document.createElement('table');
            const wayspotDetailsTbody = document.createElement('tbody');

            // Row 1
            wayspotDetailsTbody.appendChild(createTableRow([
                document.createTextNode(`${l10n['nominations.item.title']}${strings[language].formSeparator}`),
                createInputElement('input', 'text', 'title', title)
            ], 3));

            // Row 2
            wayspotDetailsTbody.appendChild(createTableRow([
                document.createTextNode(`${l10n['nominations.item.description']}${strings[language].formSeparator}`),
                createInputElement('textarea', '', 'description', description, 3)
            ], 4));

            // Row 3
            wayspotDetailsTbody.appendChild(createTableRow([
                document.createTextNode(`${strings[language].latitude}${strings[language].formSeparator}`),
                createInputElement('input', 'number', 'latitude', latRounded),
                document.createTextNode(`${strings[language].longitude}${strings[language].formSeparator}`),
                createInputElement('input', 'number', 'longitude', lngRounded)
            ]));

            // Row 4
            wayspotDetailsTbody.appendChild(createTableRow([
                document.createTextNode(`${strings[language].city}${strings[language].formSeparator}`),
                createInputElement('input', 'text', 'city', city),
                document.createTextNode(`${strings[language].state}${strings[language].formSeparator}`),
                createInputElement('input', 'text', 'state', state)
            ]));

            wayspotDetailsTable.appendChild(wayspotDetailsTbody);
            wayspotDetailsDiv.appendChild(wayspotDetailsTable);

            // Create buttons div
            const buttonsContainerDiv = createButtonsContainer('metadata_cancel', l10n['nominations.btns.cancel'], 'metadata_accept', l10n['settings.button.save'], function() {
                handleWayspotDataSaveButton(submission);
            });

            // Append Wayspot and Photo details divs, buttons div to app-nominations-sort-modal
            appNominationsSortModal.appendChild(wayspotDetailsDiv);
            appNominationsSortModal.appendChild(buttonsContainerDiv);

            return appNominationsSortModal;
        }

        // Use the createOverlayContainer function with the callback
        const newOverlayContainer = createOverlayContainer('550px', createOverlayContent);

        // Append the new overlay container to the end of the body
        document.body.appendChild(newOverlayContainer);
    }

    // Helper function to create a table row in details table
    function createTableRow(cells, colspan) {
        const row = document.createElement('tr');

        cells.forEach((cell, index) => {
            const cellElement = document.createElement('td');
            cellElement.classList.add('wfpc-table-cell');

            // Set colspan for the input cells in the first and second rows
            if (colspan && (index === 1 || index === 3)) {
                cellElement.colSpan = colspan;
            }

            cellElement.appendChild(cell);
            row.appendChild(cellElement);
        });

        return row;
    }

    // Helper function to create input element
    function createInputElement(input, type, id, value, rows) {
        const inputElement = document.createElement(input);
        inputElement.type = type;
        inputElement.id = id;
        inputElement.value = value;
        inputElement.classList.add('wfpc-input', 'border-black');

        if (input === 'textarea') {
            inputElement.rows = rows;
        }

        return inputElement;
    }

    // Helper function to create a row in details div
    function createRow(...rowInputs) {
        const rowDiv = document.createElement('div');
        rowDiv.classList.add('details-row', 'flex', 'flex-row', 'mt-2');

        rowInputs.forEach(({ labelText, inputElement }) => {
            const labelDiv = document.createElement('div');
            labelDiv.classList.add('details-label');
            labelDiv.textContent = labelText;

            const inputDiv = document.createElement('div');
            inputDiv.classList.add('details-input');

            // Ensure inputElement is a valid node before appending
            if (inputElement instanceof Node) {
                inputDiv.appendChild(inputElement);
            } else {
                console.error('Invalid inputElement:', inputElement);
            }

            rowDiv.appendChild(labelDiv);
            rowDiv.appendChild(inputDiv);
        });

        return rowDiv;
    }

    // Function to handle saving Wayspot data
    function handleWayspotDataSaveButton(thisSubmission) {
        // Define a reusable function to check and set deletedFields
        function checkAndSetDeletedField(inputElement, field, oldData) {
            if (oldData[field] !== undefined && oldData[field] !== null && oldData[field] !== '' && inputElement.value === '') {
                thisSubmission.lightship.deletedFields[field] = true;
            }
        }

        // Define the field names and corresponding const declarations
        const fieldMappings = [
            { name: 'title', inputElement: document.getElementById('title') },
            { name: 'description', inputElement: document.getElementById('description') },
            { name: 'lat', inputElement: document.getElementById('latitude') },
            { name: 'lng', inputElement: document.getElementById('longitude') },
            { name: 'city', inputElement: document.getElementById('city') },
            { name: 'state', inputElement: document.getElementById('state') }
        ];

        // Get input elements and save inputs to thisSubmission.lightship
        fieldMappings.forEach(({ name, inputElement }) => {
            const oldLightship = { ...thisSubmission.lightship }; // Make a copy of the current lightship data

            thisSubmission.lightship[name] = inputElement.value || '';

            // Convert lat and lng values to numbers
            if (name === 'lat' || name === 'lng') {
                thisSubmission.lightship[name] = parseFloat(inputElement.value) || 0;
            } else {
                thisSubmission.lightship[name] = inputElement.value || '';
            }

            // Set a flag to indicate whether a field has been explicitly deleted
            thisSubmission.lightship.deletedFields = {};

            // Check and set deletedFields for each field
            checkAndSetDeletedField(inputElement, name, oldLightship);
        });

        // Set lastImported timestamp
        thisSubmission.lightship._lastImported = Date.now();

        // Call functions
        synchronizeLightshipData(thisSubmission, 'contributions');
        clearOverlay();
    }

    // Function to process imported data
    function processImportedData(thisSubmission, json) {
        // Check if the textarea is empty
        if (json.trim() === '') {
            // If empty, directly clear the overlay
            clearOverlay();
            return;
        }

        try {
            // Try to parse the JSON data
            const importedData = JSON.parse(json);

            // Check if importedData is an object
            if (typeof importedData === 'object' && importedData !== null) {
                // Check for the existence of specific fields and assign them if they exist
                thisSubmission.lightship.guid = importedData.guid || thisSubmission.lightship.guid;
                thisSubmission.lightship.title = importedData.title || thisSubmission.lightship.title;
                thisSubmission.lightship.description = importedData.description || thisSubmission.lightship.description;
                thisSubmission.lightship.lat = importedData.lat || thisSubmission.lightship.lat;
                thisSubmission.lightship.lng = importedData.lng || thisSubmission.lightship.lng;
                thisSubmission.lightship.city = importedData.city || thisSubmission.lightship.city;
                thisSubmission.lightship.state = importedData.state || thisSubmission.lightship.state;
                thisSubmission.lightship.country = importedData.country || thisSubmission.lightship.country;
                thisSubmission.lightship._lastImported = Date.now();

                // Call synchronizeLightshipData
                synchronizeLightshipData(thisSubmission, 'contributions');

                // Clear the overlay
                clearOverlay();
            } else {
                // Display a warning message if the parsed data is not an object
                alert('Invalid JSON format. Please provide a valid JSON object.');
            }
        } catch (error) {
            // Handle any parsing errors
            console.error('Error parsing JSON:', error);
            alert('Error parsing JSON. Please provide valid JSON data.');
        }
    }

    function handleAppealButton(submission) {
        const {
            title = '[Title]',
            lightship: {
                lat = '',
                lng = '',
                city = '[City]',
                country = '[Country]',
            } = {}
        } = submission;

        const coordinates = (lat && lng) ? `${lat.toFixed(6)},${lng.toFixed(6)}` : '[Lat/Long]';

        const appealString = `Title of the Wayspot: ${title}

Location: ${coordinates}

City: ${city}

Country: ${country}

Screenshot of the Rejection Email: [Attach Screenshot]

Photos to support your claim: [Attach photo]

Additional information: [If you have more explanations, add them here]`;

        navigator.clipboard
            .writeText(appealString)
            .then(() => {
            window.open('https://community.wayfarer.nianticlabs.com/post/discussion/wayspot-photo', '_blank');
        })
            .catch(() => {
            alert(`Unexpected error copying clipboard data`);
        });
    }

    function formatDate(timestamp) {
        if (!timestamp) return '-';

        const date = new Date(timestamp);
        const options = { year: 'numeric', month: 'short', day: 'numeric' };
        return date.toLocaleDateString(undefined, options);
    }

    // Imports css associated with the filter overlay
    // This is normally generated the first time you click the filter button
    function appendFilterCssStyles() {
        const styleElement = document.createElement('style');
        styleElement.textContent = `
  .mat-dialog-container {
    display: block;
    padding: 24px;
    border-radius: 4px;
    box-sizing: border-box;
    overflow: auto;
    outline: 0;
    width: 100%;
    height: 100%;
    min-height: inherit;
    max-height: inherit
  }

  .cdk-high-contrast-active .mat-dialog-container {
    outline: solid 1px
  }

  .mat-dialog-content {
    display: block;
    margin: 0 -24px;
    padding: 0 24px;
    max-height: 65vh;
    overflow: auto;
    -webkit-overflow-scrolling: touch
  }

  .mat-dialog-title {
    margin: 0 0 20px;
    display: block
  }

  .mat-dialog-actions {
    padding: 8px 0;
    display: flex;
    flex-wrap: wrap;
    min-height: 52px;
    align-items: center;
    box-sizing: content-box;
    margin-bottom: -24px
  }

  .mat-dialog-actions[align=end] {
    justify-content: flex-end
  }

  .mat-dialog-actions[align=center] {
    justify-content: center
  }

  .mat-dialog-actions .mat-button-base+.mat-button-base,
  .mat-dialog-actions .mat-mdc-button-base+.mat-mdc-button-base {
    margin-left: 8px
  }

  [dir=rtl] .mat-dialog-actions .mat-button-base+.mat-button-base,
  [dir=rtl] .mat-dialog-actions .mat-mdc-button-base+.mat-mdc-button-base {
    margin-left: 0;
    margin-right: 8px
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
          `;

        document.head.appendChild(styleElement);
    }

    function appendCustomCssStyles() {
        const styleElement = document.createElement('style');
        styleElement.textContent = `
  .hidden-list {
    display: none !important;
  }
  .wf-image-modal {
    cursor: pointer
  }
  .wfpcDropdown {
     cursor: pointer;
  }
  .wfpcDropdown .wfpcInner {
     display: none;
  }
  .wfpcDropdown .wfpcDDLeftBox {
     float: left;
     margin-right: 7px;
     display: block;
  }
  .wfpcDropdown .wfpcDDRightBox {
     float: right;
  }
  .wfpc-details-image {
    margin-bottom: 1rem;
    margin-left: auto;
    margin-right: auto;
    border-radius: 0.25rem;
    max-height: 50vh;
    cursor: pointer;
  }
  .wfpc-details-pane {
    position: relative;
    margin-top: 4rem;
    margin-left: 1rem;
    width: 100%;
    max-width: 42rem;
    top: 0;
    right: 0;
    bottom: 0;
    left: 0;
    z-index: 20;
  }
  .wfpc-details-header {
    margin-top: 1rem;
    margin-bottom: 1rem;
    display: flex;
    align-items: center;
    justify-content: space-between;
  }
  .wfpc-details-address {
    margin-bottom: 1rem!important;
    margin: 0;
  }
  .wfpc-details-description-div {
    margin-bottom: 1rem;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
  }
  .wfpc-details-description-header {
    margin-bottom: 0.5rem;
    font-size: 0.875rem;
    line-height: 1.25rem;
    --tw-text-opacity: 1;
    color: rgba(115, 115, 115, var(--tw-text-opacity));
  }
  .wfpc-details-buttons-div {
    display: flex !important;
    margin-bottom: 1.5rem !important;
    justify-content: flex-end !important;
  }
  .wfpc-details-pane-card {
    display: flex;
    height: 100%;
    width: 100%;
    flex-direction: column;
    padding: 2rem;
  }
  .wfpc-details-outcome-div {
    margin-bottom: 1rem;
    justify-content: space-between!important;
    flex-direction: row!important;
    display: flex!important;
  }
  .wfpc-search-header {
    font-size: .75rem!important;
    line-height: 1rem!important;
    width: min-content!important;
    left: 0.75rem!important;
    top: 0.5rem!important;
    position: relative!important;
    background-color: #fff; /* Default background color */

    /* Dark mode styles */
    .dark & {
        background-color: #424242;
    }

    opacity: 1; /* Fully opaque */
  }
  .wfpc-input {
    padding-left: 0.5rem!important;
    padding-right: 0.5rem!important;
    padding-top: 0.25rem!important;
    padding-bottom: 0.25rem!important;
    background-color: initial!important;
    --tw-border-opacity: 1!important;
    border-width: 1px!important;
    border-radius: 0.375rem!important;
    width: 100%!important;
  }
  .wfpc-table-cell {
    border-width: 0px!important;
    text-align: right;
    vertical-align: middle;
  }
  .wfpc-groupPhotoItemTag {
    margin-right: 0.5rem !important;
  }
  .wfpc-singlePhotoItemTag {
    margin-right: 0.5rem !important;
  }
  .wfpc-details-carousel-container {
    display: flex;
    overflow-x: auto;
  }
  .wfpc-details-carousel-image {
    height: 120px;
    width: 120px;
    max-width: 300px;
    margin-right: 8px;
  }
  .wfpc-linked-submission-container {
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
  }
  .wfpc-photo-list-sash {
    top: -1.25rem!important;
    left: 1rem!important;
    position: relative!important;
  }
  .wfpc-photo-list-image {
    object-fit: cover!important;
    border-radius: 0.25rem!important;
    width: 6rem!important;
    height: 5rem!important;
    margin-right: 1rem!important;
  }
  .wfpc-photo-list-text-div {
    padding-top: 0.75rem!important;
    padding-bottom: 0.75rem!important;
    justify-content: space-between!important;
    display: flex!important;
    flex-direction: column!important;
    width: 100%!important;
    height: 100%!important;
  }
  .wfpc-photo-list-text-inner-div {
    display: flex!important;
    flex-direction: row!important;
    justify-content: space-between!important;
  }
  .wfpc-carousel-image-selected {
    border-width: 4px;
    --tw-border-opacity: 1;
    border-color: rgba(239, 163, 142, var(--tw-border-opacity));
    --tw-bg-opacity: 1;
    background-color: rgba(229, 229, 229, var(--tw-bg-opacity));
  }
  .wfpc-photos-list {
    display: flex;
    flex-direction: row!important;
  }
  .wfpc-cdk-virtual-scroll-spacer {
    position: absolute;
    top: 0;
    left: 0;
    width: 1px;
    transform-origin: 0 0;
  }
  .wfpc-photos-list-box {
    position: absolute;
    top: 0;
    left: 0;
    contain: content;
    min-width: 100%;
  }
  .wfpc-cdk-virtual-scroll-viewport {
    height: 70vh;
    width: 28rem;
    overflow-y: auto;
    --tw-shadow: 0 10px 15px -3px #0000001a, 0 4px 6px -2px #0000000d;
    box-shadow: var(--tw-ring-offset-shadow, 0 0 #0000), var(--tw-ring-shadow, 0 0 #0000), var(--tw-shadow);
    display: block;
    position: relative;
    overflow: auto;
    contain: strict;
    transform: translateZ(0);
    will-change: scroll-position;
  }
  .wfpc-photos-list-buttons {
    margin-left: auto;
    cursor: pointer;
  }
  .wfpc-checkbox {
    margin-bottom: 0.5rem;
  }
  .wfpcNotification {
    font-weight: bold;
    border-radius: 1em;
    padding: 1em;
    margin-top: 1.5em;
    color: white;
    background-color: #23699e;
  }
  #wfpcNotify {
    position: absolute;
    bottom: 1em;
    right: 1em;
    width: 30em;
    z-index: 100;
  }
    `;

        document.head.appendChild(styleElement);
    }
}

init();