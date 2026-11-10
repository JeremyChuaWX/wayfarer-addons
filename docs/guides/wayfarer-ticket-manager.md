# Wayfarer Ticket Manager

<!-- summary: Keep several Help Chat support tickets open at once and switch between them. Optional sync across devices. -->

Wayfarer's Help Chat normally lets you have only **one** support conversation ("ticket") per browser. Starting a new one hides the old one. Ticket Manager remembers each conversation, so you can keep several tickets going and switch between them.

It also:

- shows a short summary for each ticket, such as the ticket type and Wayspot name;
- can check all your saved tickets for unread replies from Wayfarer support;
- adds date labels (like "Monday, November 10, 2026") inside the Help Chat;
- can back up your ticket list, and optionally sync it between devices.

## Where to find it

On any Wayfarer page, look at the **bottom right**. There's a new **orange round button with two arrows** just to the left of the normal Help Chat button. Click it to open the **Wayfarer Ticket Manager** panel. Click it again, or the **×**, to close it.

The panel lists your tickets:

| Column | What it means |
|---|---|
| **Ticket summary** | The ticket type and Wayspot, e.g. "Appeal: My Wayspot". **[Previous ticket]** means the conversation has finished. |
| ♻️ **Restore** | Switches the Help Chat to that ticket. The ticket you're on now has no ♻️. |
| 🗑️ **Delete** | Removes the ticket from this list. This does **not** close it with Wayfarer support, but you can't reopen it from this browser any more unless you backed it up first. |

The last row, **Create a new ticket**, starts a brand-new Help Chat conversation. Your existing tickets stay in the list.

## Everyday use

1. Open Help Chat and start a ticket as usual. It's added to the list automatically.
2. **To start another ticket at the same time:** open Ticket Manager, click **Create a new ticket**, then use Help Chat as normal.
3. **To go back to an earlier ticket:** open Ticket Manager and click ♻️ next to it. Wait a few seconds for the chat to reload.

## Checking all tickets for replies

1. Open Ticket Manager and click the **☰** menu.
2. Choose **Check for updates**. It goes through each saved ticket looking for unread replies. The chat is closed while it does this, so messages aren't marked as read by accident.
3. Progress shows as a filling circle on the orange button.
4. If it finds a ticket with an unread reply, it **stops on that ticket** so you can read it. Choose **☰ → Continue update scan** to check the rest.
5. To pause, choose **☰ → Stop update scan**.

When it's done you'll see "Update scan complete" and you'll be back on the ticket you started from.

## Backing up your tickets

- **☰ → Export Tickets** downloads a backup file (e.g. `wayfarer-ticket-sessions-2026-11-10.json`).
- **☰ → Import Tickets** adds the tickets from a backup file to your list.

> **Keep backup files private.** They contain the codes that open your support chats. Don't share them, and only import files you made yourself.

## Using the same tickets on several devices (optional)

Your ticket list is normally stored only in the browser you're using. If you use Wayfarer on a computer *and* a phone, for example, **Ticket Sync** can keep the same list on both. It stores the list in a private file in **your own Google Drive**, and there's no other server involved.

Setting it up takes about 10 minutes and is free: **[Ticket Sync setup guide](./ticket-sync.md)**.

Skip this if you only use one browser.
