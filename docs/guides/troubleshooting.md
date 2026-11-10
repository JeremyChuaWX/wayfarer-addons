# Help & troubleshooting

## Installing, step by step

<a id="chrome"></a>

### Chrome, Edge, Brave, Opera

1. Install [Tampermonkey](https://www.tampermonkey.net/) from your browser's extension store.
2. **Turn on user scripts.** Recent versions of Chrome-based browsers block add-ons like these until you allow them:
   1. Right-click the Tampermonkey icon in the toolbar. If you can't see it, click the puzzle-piece icon first.
   2. Choose **Manage extension**.
   3. Turn on **Allow User Scripts**.
   4. If there's no such switch, open `chrome://extensions` (or `edge://extensions`) instead and turn on **Developer mode** in the top-right corner.
3. Go back to the [add-on list](../index.html#addons) and click **Install** on an add-on.
4. Tampermonkey opens a page showing the add-on's details. Click **Install** there.

### Firefox (computer and Android)

1. Install [Tampermonkey](https://addons.mozilla.org/firefox/addon/tampermonkey/) from Firefox Add-ons.
2. Click **Install** on an add-on, then **Install** again on the Tampermonkey page that opens.

### Safari (Mac, iPhone, iPad)

1. Install [Userscripts](https://apps.apple.com/app/userscripts/id1463298887) from the App Store.
2. Open it once and follow its instructions to switch it on in Safari's extension settings, then allow it on **All Websites** (or at least the sites you use the add-ons on).
3. In Safari, tap **Install** on an add-on. A page of code will open; that's expected.
4. Open the Userscripts extension menu (the puzzle-piece / **ᴬA** button in the address bar) and tap **Install** in it.

## Something isn't working

**Clicking Install just shows a page of code.**
Your userscript manager isn't installed, or it's switched off. On Safari this is normal; see step 4 above.

**The add-on is installed but nothing happens.**
- Refresh the website page.
- Open your userscript manager's dashboard and check the add-on's switch is on.
- On Chrome, Edge or Brave, check **Allow User Scripts** / **Developer mode** is on ([see above](#chrome)).
- Make sure you're on the right website: each add-on only runs on the site listed above it on the install page.

**I see everything twice (two buttons, two panels).**
You have two copies installed, probably the original GitLab version and this one. Open your userscript manager's dashboard and delete the older copy.

**It worked before but broke recently.**
Wayfarer and the Pokémon GO map change from time to time, and that can break add-ons. First check for updates. In Tampermonkey, open its menu, go to **Utilities**, and click **Check for userscript updates**. If it's still broken, [report the problem](https://github.com/JeremyChuaWX/wayfarer-addons/issues/new) and say which add-on it is, which browser you use, and what you expected to happen.

## Updates

Add-ons update themselves automatically, usually within a day of a new version. You don't need to reinstall them.

## Turning add-ons off or removing them

Open your userscript manager's dashboard (click its icon, then **Dashboard**). Use the switch next to an add-on to turn it off, or the bin icon to delete it.

## Is this safe?

These add-ons only run on the websites they're made for, and their full source code is [public](https://github.com/JeremyChuaWX/wayfarer-addons). They don't send your data anywhere except where a guide says so. For example, the Ticket Manager's optional sync stores your tickets in *your own* Google Drive, and the Pokémon GO Map Search looks up place names using OpenStreetMap.

They aren't made or endorsed by Niantic or Scopely. Use them at your own discretion.
