# Ticket Sync Setup

Ticket Sync uses a Google Apps Script web app to keep your Ticket Manager sessions in sync across devices.

> **Keep your Web app URL private.** Anyone with the deployed `/exec` URL can access your Ticket Sync endpoint.

## 1. Create the Apps Script project

1. Go to [Google Apps Script](https://script.google.com/) and sign in to the Google account you want to use for Ticket Sync.
2. Select **New project**.
3. Give the project a name, such as **Wayfarer Ticket Sync**.
4. Open the default `Code.gs` file.
5. Replace its contents with the provided `Code.gs` file.
6. Save the project.

## 2. Deploy the web app

1. Select **Deploy → New deployment**.
2. Select **Web app** as the deployment type.
3. Set **Execute as** to **Me**.
4. Set **Who has access** to **Anyone**.
5. Select **Deploy**.
6. Approve the requested Google permissions.
7. Copy the **Web app URL**.

The URL should look like:

```text
https://script.google.com/macros/s/DEPLOYMENT_ID/exec
```

Use the deployed URL ending in `/exec`. Do not use a `/dev` test URL.

The private Ticket Sync data file is created automatically in your Google Drive when the first sync is completed.

## 3. Connect Ticket Sync

1. Open **Wayfarer Ticket Manager**.
2. Open the **☰** menu.
3. Select **Ticket Sync**.
4. Paste the Web app `/exec` URL.
5. Select **Save & Sync**.

To use Ticket Sync on another device, enter the same `/exec` URL there.

## Updating `Code.gs`

If a newer `Code.gs` file is provided:

1. Replace the contents of `Code.gs` in your Apps Script project.
2. Save the project.
3. Select **Deploy → Manage deployments**.
4. Edit the existing Web app deployment.
5. Select **New version**.
6. Deploy the update.

Updating the existing deployment keeps the same `/exec` URL, so your devices do not need to be configured again.

## Resetting synced data

To clear all synced Ticket Sync data:

1. Open the Apps Script project.
2. Select `resetTicketSyncData` from the function selector.
3. Select **Run**.

This clears the remote Ticket Sync store. Devices that still contain old local tickets may upload them again after the reset.

## Troubleshooting

If Ticket Sync cannot connect, check that:

- the URL is the deployed `/exec` URL;
- the deployment type is **Web app**;
- **Execute as** is set to **Me**;
- **Who has access** is set to **Anyone**;
- the latest `Code.gs` has been deployed, not only saved in the editor.

Opening the `/exec` URL in a browser should return a small JSON response identifying the Ticket Sync service.

If you update `Code.gs`, remember to create a new deployment version under **Manage deployments**. Saving the script alone does not update the live web app.
