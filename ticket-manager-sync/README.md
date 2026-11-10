# Ticket Sync Setup

Ticket Sync uses a Google Apps Script web app to keep your Ticket Manager sessions in sync across devices.

You only need Ticket Sync if you use Wayfarer Ticket Manager on more than one browser or device (for example, a desktop and a phone) and want the same ticket list everywhere. If you only use one browser, you do not need it.

Setup takes about 10 minutes and needs a Google account. It is free.

> **Keep your Web app URL private.** Anyone with the deployed `/exec` URL can access your Ticket Sync endpoint, including your saved ticket sessions. Those sessions contain the private identifiers that let a browser open your Wayfarer support chats. Do not post the URL in chats, screenshots or bug reports.

## 1. Create the Apps Script project

1. Go to [Google Apps Script](https://script.google.com/) and sign in to the Google account you want to use for Ticket Sync.
2. Select **New project**.
3. Select **Untitled project** at the top of the page and give the project a name, such as **Wayfarer Ticket Sync**.
4. On the left, the default `Code.gs` file is already open. It contains a few lines such as `function myFunction() { }`.
5. Delete everything in that file, so it is completely empty.
6. Open the provided [`Code.gs`](Code.gs) file, copy **all** of its text (from the first `/**` line to the last `}`), and paste it into the empty editor.
7. Save the project (the disk icon, or **Ctrl+S** / **Cmd+S**).

## 2. Deploy the web app

1. Select the blue **Deploy** button at the top right, then **New deployment**.
2. Next to **Select type**, select the gear icon, then **Web app**.
3. Set **Execute as** to **Me**.
4. Set **Who has access** to **Anyone**.
   Do not choose **Anyone with Google account** or **Only myself**. Ticket Sync will not be able to connect with those settings.
5. Select **Deploy**.
6. Approve the requested Google permissions (see the next section if this looks alarming).
7. Copy the **Web app URL**.

The URL should look like:

```text
https://script.google.com/macros/s/DEPLOYMENT_ID/exec
```

Use the deployed URL ending in `/exec`. Do not use a `/dev` test URL.

The private Ticket Sync data file (**Wayfarer Ticket Manager Sync.json**) is created automatically in your Google Drive when the first sync is completed.

### Approving the Google permissions

Because this is your own personal script and not a published app, Google shows extra warnings the first time. This is expected.

1. Select **Authorize access** (or **Review permissions**).
2. Choose the Google account you signed in with.
3. If you see **Google hasn't verified this app**, select **Advanced**, then **Go to Wayfarer Ticket Sync (unsafe)** (the name matches your project name).
4. Google lists what the script can do. Ticket Sync needs access to Google Drive so it can create and update its own data file. Select **Allow**.

The script runs only in your own Google account. It stores only the Ticket Sync data file and does not read your other Drive files.

If the permission window is blank, closes immediately, or shows an error, you may be signed in to several Google accounts at once. Try again in a private/incognito window signed in to only the account you want to use.

### Check that it works

Paste the `/exec` URL into a new browser tab. You should see a short line of text similar to:

```text
{"ok":true,"version":1,"service":"Wayfarer Ticket Manager Sync"}
```

If you see a Google sign-in page or an error page instead, check the **Who has access** setting.

## 3. Connect Ticket Sync

1. Open Wayfarer and select the orange round **Switch Tickets** button (two arrows) next to the Help Chat button at the bottom right. This opens **Wayfarer Ticket Manager**.
2. Open the **☰** menu.
3. Select **Ticket Sync**.
4. Paste the Web app `/exec` URL into **Script URL**.
5. Select **Save & Sync**.

When it works, the status line in the Ticket Sync window shows **Synced.** After that, each device syncs automatically when Wayfarer is loaded and shortly after its tickets change. Tickets added on another device appear the next time this device syncs; select **Sync now** in the Ticket Sync window (or reload Wayfarer) to fetch them straight away.

To use Ticket Sync on another device, enter the same `/exec` URL there. The first sync on each device uploads any tickets that device already has, so they appear on your other devices too.

To stop syncing on a device, open **Ticket Sync** and select **Disable Sync**. Your tickets stay on that device; it simply stops syncing.

## Updating `Code.gs`

If a newer `Code.gs` file is provided:

1. Replace the contents of `Code.gs` in your Apps Script project.
2. Save the project.
3. Select **Deploy → Manage deployments**.
4. Select your existing Web app deployment, then the pencil (**Edit**) icon.
5. Under **Version**, select **New version**.
6. Select **Deploy**. Approve permissions again if asked.

Updating the existing deployment keeps the same `/exec` URL, so your devices do not need to be configured again. Do not use **New deployment** for updates; that creates a different URL.

## Resetting synced data

To clear all synced Ticket Sync data:

1. Open the Apps Script project.
2. Select `resetTicketSyncData` from the function selector (the drop-down next to **Run** and **Debug** at the top of the editor).
3. Select **Run**. Approve permissions if asked.

This clears the remote Ticket Sync store. It does not delete tickets stored on your devices. Devices that still contain old local tickets may upload them again after the reset.

After a reset, on each device: open **Ticket Sync**, select **Disable Sync**, paste the URL again and select **Save & Sync**. This makes the device start again from the reset store instead of only fetching recent changes.

## Troubleshooting

If Ticket Sync cannot connect, check that:

- the URL is the deployed `/exec` URL;
- the deployment type is **Web app**;
- **Execute as** is set to **Me**;
- **Who has access** is set to **Anyone**;
- the latest `Code.gs` has been deployed, not only saved in the editor.

Opening the `/exec` URL in a browser should return a small JSON response identifying the Ticket Sync service.

If you update `Code.gs`, remember to create a new deployment version under **Manage deployments**. Saving the script alone does not update the live web app.

If the status shows **Ticket Sync data file could not be opened.**, the Drive data file was probably permanently deleted. In the Apps Script project, open **Project Settings** (gear icon on the left), find **Script Properties**, and delete the `WFTM_SYNC_FILE_ID` property. A new, empty data file is created on the next sync.
