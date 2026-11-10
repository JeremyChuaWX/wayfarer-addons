# Pokémon GO Map: Search

<!-- summary: Search the map by place name or by coordinates, or jump to your current location. -->

Replaces the map's location button with a **search box** that understands both **place names** and **coordinates**.

> The Pokémon GO map now asks you to **sign in with your Pokémon GO account** before it shows anything. Sign in first, and the add-on works once the map appears.

## How to use it

The search box is at the top of the [Pokémon GO map](https://pokemongo.com/en/map). It says **Search location or lat,lng**.

**Search for a place:**
1. Type at least 3 letters, e.g. `Tokyo Tower`.
2. Suggestions (📍) appear underneath. Click one, or use the ↑ ↓ arrow keys and press Enter.
3. The map jumps there.

**Go to exact coordinates:**
1. Type them, e.g. `35.6586, 139.7454`, and press Enter.
2. The map jumps there and drops a pin.

**Go to where you are now:**
Click the **crosshair** button at the right of the box. Your browser will ask for permission to use your location.

Press **Esc** to clear the box.

## Privacy

Place-name searches are looked up with free map services ([OpenStreetMap Nominatim](https://nominatim.openstreetmap.org/) and [Photon](https://photon.komoot.io/)). When you first search, Tampermonkey may ask whether to allow the add-on to contact them; choose **Always allow**. Coordinate searches don't contact anything.
