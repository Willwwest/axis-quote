# Route planning

**Routes** (`/admin/routes`) tells the office where everyone goes, in what order, and on which day. It works out of the box: free, open source, and no keys or sign-ups.

## What it does

- **Day.**
  - Shows a map of each person's day, with numbered stops in their color and the road path between them.
  - Each person gets a card with their stops, arrival and start times, and the drive time and miles between stops.
  - Late, overtime and "town center only" stops are flagged.
- **Optimize day.**
  - Re-plans the whole crew for the day: who takes each stop, and in what order. It keeps each stop inside the customer's booked window and each person inside their hours.
  - You can keep everyone's assigned jobs, keep booked times, or both. Checked-in and finished stops never move.
  - It shows the saving before you apply it ("Driving 3h 10m → 1h 55m · saves 1h 15m"), plus what changed for each stop. Nothing is saved until you press **Apply plan**.
- **Plan the week.**
  - Lists approved or booked jobs with no install on the calendar.
  - Puts each one on a route day for its region (Settings → Calendar → Route days), skipping blocked dates. It goes to the person who adds the least driving, within their workdays, hours, areas and the per-day install limit.
  - **Book these** creates the appointments.
- **Send routes.**
  - **Text route to …** opens this phone's Messages app with a link to that person's route.
  - The `/route/:id` page carries the route in the link itself, so it opens on any phone without a sign-in. It shows the stops in order, a map, one-tap navigation (Google Maps, or Apple Maps on iPhone), call/text buttons and a "done" tick for each stop.
  - **Google Maps** buttons open the whole route as driving directions, split into legs of 4 stops because mobile Google Maps takes at most 3 waypoints.
- **My route.** Installers and technicians who can only see their own calendar get just their route, with directions.

## Free services it uses (the defaults)

| Job | Default | Fallback |
|---|---|---|
| Road drive times and route lines | [OSRM](https://project-osrm.org) public server (open source, OpenStreetMap data) | Distance estimate: straight-line × 1.3 at 45 mph |
| Optimizing | Built-in solver, runs in the browser | none needed |
| Finding addresses on the map | [Nominatim](https://nominatim.org) (OpenStreetMap), or [Photon](https://photon.komoot.io) | Town center from the bundled Arizona place list |
| Map | [Leaflet](https://leafletjs.com) with [OpenStreetMap](https://www.openstreetmap.org/copyright) tiles | Pins and lines still draw if tiles fail |

If a service is slow or down, the plan still appears, with a quiet note such as "Road times unavailable: using distance estimates". It never shows an error screen.

**Advanced, optional.** Settings → Routing → Advanced has extra choices that none of the defaults need:

- **Your own OSRM server**, for heavy use.
- **An [OpenRouteService](https://openrouteservice.org) key** (free). It adds their road times and the open-source [VROOM](https://github.com/VROOM-Project/vroom) optimizer. If VROOM can't be reached, planning falls back to the built-in solver.

## Privacy

- **Address lookup:** only the street address is sent, never the customer's name or phone. Lookups run one a second, and the result is saved on this device so each address is looked up once. Settings → Routing → Address lookup → Off keeps every job at its town center.
- **Drive times:** only map coordinates are sent to OSRM, with no names or addresses.

## Settings (Settings → Routing)

- **Home base:** where routes start and end.
- **Work day:**
  - start and end times;
  - time added at each stop;
  - most installs per person per day (for week planning);
  - whether to count the drive home.
- **Each person:**
  - whether they do field work;
  - their own starting address;
  - workdays, hours, and the areas they cover.

## Where it came from

- **extra-mile-apps CRM visit planner:** nearest-neighbor + 2-opt stop ordering, Google Maps leg splitting, and the Leaflet map patterns.
- **U.S. Census Bureau place centers:** public domain, as `src/data/azPlaces.ts`.
- **OSRM, VROOM, OpenRouteService, Nominatim, Photon, Leaflet:** open source. OpenStreetMap data is © OpenStreetMap contributors (ODbL).

## Code

- `src/lib/routing/`: locations, geocoding, travel times, the optimizer, week planning and route links. The UI imports only `src/lib/routing/index.ts`.
- `src/admin/routes/`: the Routes page (Day, Plan the week).
- `src/components/RouteMap.tsx`: the Leaflet map. It's only in the route screens' chunks, so the customer quote app never downloads it.
- `src/public/RoutePage.tsx`: the crew route link page.
- `src/admin/settings/RoutingSettings.tsx`: the Routing settings section.
