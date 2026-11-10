# Mission Creator Exporter

<!-- summary: Saves the portals you search in the Mission Creator to a spreadsheet file. -->

Collects the portals you look up in the [Ingress Mission Creator](https://missions.ingress.com/) and saves them as a **spreadsheet file** (CSV) that opens in Excel, Google Sheets, or Numbers.

## How to use it

1. Open the Mission Creator and search for portals as usual.
2. After the first results appear, two new buttons show up at the **bottom left**: **Export** (with the number of portals collected so far) and **Reset**.
3. Keep searching. Each new portal is added to the list, and duplicates are skipped.
4. Click **Export** to download **MissionPortals.csv**.
5. Click **Reset** to start a fresh list. Reloading the page also clears it.

## What's in the file

One row per portal, with: ID, title, description, latitude, longitude, image link, Intel map link, and map link.

A few characters are changed so the file opens cleanly: double quotes and `#` become `'`, and line breaks appear as `\n`. Titles starting with `=`, `+`, `-` or `@` get a `'` added at the front. This stops spreadsheet apps treating them as formulas.
