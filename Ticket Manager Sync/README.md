# Wayfarer Ticket Manager 0.7.0 — Ticket Sync

This package adds optional cross-device Ticket Sync to **Wayfarer Ticket Manager**. Ticket Sync uses a dedicated Google Apps Script web app and a private JSON file in your Google Drive.

The Ticket Sync API is **version 1**.

## What it does

Ticket Manager continues to keep its working sessions in the browser under `helpChatSessions`. When Ticket Sync is configured, it also synchronises those sessions through your Apps Script deployment.

- New tickets and ticket updates sync automatically.
- Changes from another device are downloaded when Wayfarer opens or becomes active again.
- Deleted tickets are stored remotely as tombstones so an older device cannot recreate them.
- **Import Tickets** is treated as an explicit restore and can intentionally restore a previously deleted ticket.
- **Sync now** is available from the Ticket Sync settings.

> **Keep your Apps Script `/exec` URL private.** Anyone with that URL can access the Ticket Sync endpoint and the Ticket Manager session data stored through it.

---

# Set up Ticket Sync

## 1. Create the Apps Script project

1. Sign in to the Google account that will own your Ticket Sync data.
2. Open [Google Apps Script](https://script.google.com/).
3. Create a **New project**.
4. Give it a name such as `Wayfarer Ticket Manager Sync`.
5. Open the default `Code.gs` file and replace its contents with the `Code.gs` from this package.
6. Save the project.

Use a separate Apps Script project for Ticket Sync rather than adding it to Wayfarer Planner.

## 2. Deploy the web app

1. Choose **Deploy → New deployment**.
2. Select **Web app**.
3. Enter a title, e.g. `Ticket sync`
4. Set **Execute as** to **Me**.
5. Set **Who has access** to **Anyone**.
6. Deploy and approve the requested permissions.
7. Copy the **Web app URL**.

It should look like:

```text
https://script.google.com/macros/s/DEPLOYMENT_ID/exec
```

Use the deployed URL ending in `/exec`, not a `/dev` test URL.

The private Drive file `Wayfarer Ticket Manager Sync.json` is created automatically on the first successful sync.

Do not share the `/exec` URL or the private JSON file.

## 3. Configure Ticket Manager

1. Open Wayfarer.
2. Open **Wayfarer Ticket Manager**.
3. Select the **☰** menu beside the close button.
4. Choose **Ticket Sync**.
5. Enter the Apps Script `/exec` URL.
6. Choose **Save & Sync**.

On another device, install Ticket Manager and enter the same `/exec` URL.

Ticket Sync runs automatically when:

- Wayfarer starts;
- a Ticket Manager session is added or updated;
- a ticket is deleted;
- the Wayfarer tab becomes visible again;
- the browser window regains focus.

You can also use **☰ → Ticket Sync → Sync now**.

---

# Sync behaviour

## First sync

If the remote store is empty, the current device uploads its local tickets. If remote records already exist, Ticket Manager merges the remote state with local tickets that have never existed remotely.

## Deletions

Deleting a ticket removes it locally and sends a delete operation to the server. The server keeps a tombstone containing the ticket identifier and revision rather than removing the record entirely.

Other devices remove that ticket on their next sync. A normal update from an older device cannot overwrite the tombstone.

Tombstones are retained indefinitely because they are small and prevent deleted tickets from returning.

## Conflicts

Each remote record has a revision. Normal updates include the revision last seen by that device. If a newer server revision already exists, the stale update is ignored and the newer server state wins.

Deletes always win over normal updates.

Manual **Import Tickets** is the exception: importing a ticket is treated as an explicit restore and can replace a tombstone.

---

# Disable Ticket Sync on one device

Open **☰ → Ticket Sync** and choose **Disable Sync**.

This removes the Apps Script URL and sync bookkeeping from that browser. It does not delete local Ticket Manager tickets, remote records, or settings on other devices.

If you configure the same URL again later, the existing remote state and tombstones apply again.

---

# Reset all remote Ticket Sync data

To clear all remote tickets and tombstones:

1. Open the Apps Script project.
2. Select `resetTicketSyncData` from the function selector.
3. Run it.

Use this carefully. Once tombstones are cleared, an old device that still contains a deleted ticket can seed it into the empty remote store again.

---

# Updating `Code.gs`

When a later Ticket Manager release includes an updated backend:

1. Replace the contents of `Code.gs` in your Apps Script project.
2. Save it.
3. Choose **Deploy → Manage deployments**.
4. Edit the existing Web app deployment.
5. Create or select a **New version** and deploy it.

Keeping the same deployment preserves the `/exec` URL, so Ticket Manager does not need to be reconfigured on each device.

---

# Troubleshooting

## API version mismatch

The Ticket Manager userscript and `Code.gs` are from different Ticket Sync API versions. Update both and redeploy the Apps Script web app.

## Failed to fetch / network error

Check that:

- the URL ends in `/exec`;
- the deployment type is **Web app**;
- it executes as the deploying account;
- access is set to **Anyone**;
- the current version of `Code.gs` has been deployed rather than only saved.

Opening the `/exec` URL directly should return:

```json
{"ok":true,"version":1,"service":"Wayfarer Ticket Manager Sync"}
```

## A deleted ticket returned

Check that every device is using the Ticket Manager build with Ticket Sync and that the deployed Apps Script is API version 1.

A normal stale update cannot replace a tombstone. **Import Tickets** can intentionally restore one.

## The JSON file is visible in Drive

That is expected. It is the private Ticket Sync data store. Do not share it.
