# 🚆 Train Time

![Repo Size](https://img.shields.io/github/repo-size/willblake01/train-time)
![Last Commit](https://img.shields.io/github/last-commit/willblake01/train-time)
![Open Issues](https://img.shields.io/github/issues/willblake01/train-time)
![Stars](https://img.shields.io/github/stars/willblake01/train-time?style=social)
![MIT License](https://img.shields.io/badge/license-MIT-green)

![Train Time](https://res.cloudinary.com/willblake01/image/upload/q_auto/f_auto/v1770242732/portfolio/projects/train-time.webp)

**Train Time** is an Amtrak trip planner and live tracker. Browse departures from any Amtrak station on any date, build multi-leg trips that are checked for valid connections, and follow each train's live position and delays on travel day.

**Live demo:** [train-time-rosy.vercel.app](https://train-time-rosy.vercel.app)

---

## 🚀 Overview

Train Time lets you:

- **Browse a station departure board** for any of 500+ Amtrak stations and any date in the published timetable, with live delays, status, and track numbers for trains that are running
- **Plan multi-leg trips**: pick a train, choose where you get off, and the board moves to your transfer station showing only trains you can still catch
- **Avoid impossible connections**: legs must leave from where the previous one arrives, after it arrives, and tight transfers are flagged
- **Track your trip on travel day**: each leg shows its train's live status, matched to the exact run you're riding
- **Keep trips private**: every visitor gets their own trips through anonymous sign-in, with no account required

---

## 📦 Features

### Departure board
- Departures for any station and date, from Amtrak's official timetable
- Live overlay for trains running now: delays, "Boarding", estimated times, and track numbers
- Trains that have already left drop off the board automatically
- Times shown in each station's local time zone
- Light and dark themes that follow the system setting

### Trip planner
- Create a trip with a name, departure station, and destination
- Add legs straight from the board; "Get off at" lists only stops where riders are allowed to get off
- **Add leg** jumps the board to the trip's last arrival station and date, filtered to trains leaving after you arrive
- Connection rules enforced when saving: same station, after arrival, with warnings for tight transfers
- Building stops automatically once a leg reaches the trip's destination

### My Trips
- Each trip shows its route (e.g. `AUS → FLG`), numbered legs, and departure dates
- Live status per leg on travel day; future legs show as **Scheduled**
- Warnings between legs for missed, tight, or disconnected transfers
- Changes sync in real time across open tabs

---

## 🏗 How It Works

```mermaid
flowchart LR
  GTFS["Amtrak GTFS feed"] -->|"weekly GitHub Action"| Build["build-schedule script"]
  Build --> Schedule["data/schedule.json"]
  Schedule --> Server["Next.js API routes<br/>and getStaticProps"]
  Amtraker["Amtraker live API"] --> Server
  Server --> Board["Departure board"]
  Refresh["/api/refresh<br/>(Firebase Admin SDK)"] --> RTD[("Firebase<br/>Realtime Database")]
  Amtraker --> Refresh
  RTD <-->|"anonymous auth"| Trips["My Trips"]
```

**Two data layers, one interface.** The board depends on a single function, `getDepartures(station, { date, after })`. It reads the scheduled trains for that date from the timetable, then overlays live data when the date is close to today. If live data is unavailable, it falls back to the timetable alone.

**The timetable** comes from Amtrak's official GTFS feed. A build script converts the ~18 MB feed into a compact `schedule.json` (about 1 MB, read only by the server). A weekly GitHub Action downloads the latest feed, rebuilds the file, runs the tests, and opens a pull request when the schedule changes, so every update is reviewed before it ships.

**Live data** comes from the [Amtraker](https://amtraker.com) API. The server caches it for a minute per instance, shares in-flight requests, and times out slow responses, so traffic to the app never multiplies requests to the upstream API.

**Trips** live in Firebase Realtime Database under each visitor's anonymous user ID. A throttled server endpoint refreshes live status only for trains in legs happening around today, and writes it with the Admin SDK, since browsers can't write live data.

---

## 🧠 Engineering Highlights

### Getting GTFS times right
Transit timetables are easy to get subtly wrong. The conversion and lookup code handles:

- **Agency-time stop times**: Amtrak lists every time in Eastern time, even for stations in other zones
- **Times past midnight**: long-distance trips count up from their service day (the Sunset Limited reaches Los Angeles at `56:35`)
- **Daylight saving changes**: times are anchored to "noon minus 12 hours" on the service date, as the GTFS spec defines
- **Boarding-only and drop-off-only stops**, which the live feed doesn't report
- **A data error in the feed**: Arizona stations are listed in Mountain time with daylight saving, but Arizona doesn't observe it, so the build corrects them to `America/Phoenix`

### Merging scheduled and live trains
Scheduled trains are matched to live runs by train number plus scheduled time at the station, within a window, so runs of the same train on consecutive days never get mixed up. Live-only trains (extra or rescheduled runs) are kept, and departed trains are dropped.

### Security
- Each visitor's trips are private: database rules allow reads and writes only by the owning anonymous user
- Live status can only be written server-side with the Firebase Admin SDK; service account credentials stay in server-only environment variables
- The refresh endpoint is POST-only, runs at most once a minute (enforced with a database transaction), and only fetches trains that appear in saved legs, with a hard cap per run
- API inputs are validated (station codes, dates, times), and external and user-written data is parsed with [Zod](https://zod.dev) so malformed records are skipped instead of breaking the page

### Resilience
- Timeouts on upstream requests, with a timetable-only fallback when live data is down
- Firebase Authentication initializes lazily, so a configuration problem affects sign-in only, not the rest of the page or the build
- The schedule build refuses to publish a feed that's missing files, looks truncated, or doesn't cover the coming weeks

---

## 🧪 Testing

Unit tests (Jest) cover the logic that's easiest to get wrong:

- GTFS conversion: filtering to Amtrak trains, past-midnight times, boarding rules, quoted fields, and validation
- Timetable lookups: service days, daylight saving transitions, after-midnight departures, Arizona time
- Live/scheduled merging and matching saved legs to their live runs
- Trip rules: connections, contiguity checks, and parsing stored trips
- Time formatting that fails safely on bad input

```bash
npm test
```

---

## 🛠 Tech Stack

![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=white)
![React](https://img.shields.io/badge/React-61DAFB?logo=react&logoColor=black)
![Next.js](https://img.shields.io/badge/Next.js-000000?logo=next.js&logoColor=white)
![MUI](https://img.shields.io/badge/MUI-007FFF?logo=mui&logoColor=white)
![Firebase](https://img.shields.io/badge/Firebase-FFCA28?logo=firebase&logoColor=black)
![Zod](https://img.shields.io/badge/Zod-3E67B1?logo=zod&logoColor=white)
![Jest](https://img.shields.io/badge/Jest-C21325?logo=jest&logoColor=white)
![GitHub Actions](https://img.shields.io/badge/GitHub_Actions-2088FF?logo=githubactions&logoColor=white)
![Vercel](https://img.shields.io/badge/Vercel-000000?logo=vercel&logoColor=white)

- **Next.js** (Pages Router) with incremental static regeneration and API routes
- **MUI** with CSS-variable light and dark color schemes
- **Firebase** Realtime Database, Anonymous Authentication, and the Admin SDK
- **Jest** for unit tests, **Zod** for runtime validation
- **GitHub Actions** for the weekly timetable update, **Vercel** for hosting

---

## 📁 Project Structure

```
train-time/
├─ .github/workflows/
│  └─ update-schedule.yml   # Weekly: rebuild the timetable and open a PR
├─ components/
│  ├─ DepartureBoard.tsx    # Station board with date picker and live status
│  ├─ AddToTripDialogue.tsx # Pick where to get off and which trip; enforces connection rules
│  ├─ MyTrips.tsx           # Trips, legs, live status, and connection warnings
│  ├─ NewTrip.tsx           # Create a trip with departure and destination
│  └─ Jumbotron.tsx
├─ data/
│  └─ schedule.json         # Generated timetable (server-only)
├─ pages/
│  ├─ index.tsx             # Page composition and trip-building state
│  └─ api/
│     ├─ departures.ts      # GET departures for a station, date, and time
│     └─ refresh.ts         # POST: throttled live-status refresh for saved legs
├─ scripts/
│  ├─ build-schedule.ts     # Download, convert, validate, and write the timetable
│  └─ schedule/convert.ts   # GTFS → schedule.json conversion (pure, tested)
├─ styles/theme.ts          # MUI theme with light and dark schemes
└─ utils/
   ├─ timetable.ts          # Service dates, GTFS time math, scheduled departures, live merge
   ├─ trips.ts              # Trip and leg rules
   ├─ amtrak.ts             # Amtraker client and validation
   ├─ amtrakServer.ts       # Server-only: timetable + live data for getDepartures
   ├─ firebaseActions.ts    # Anonymous sign-in and per-user trip storage
   └─ firebaseAdmin.ts      # Server-only: Admin SDK for live status writes
```

---

## ⚙️ Setup & Installation

```bash
git clone https://github.com/willblake01/train-time.git
cd train-time
npm install
npm run dev
```

### Environment variables

Create `.env.local`:

```bash
# Firebase web config (public by design; protected by database rules)
NEXT_PUBLIC_FIREBASE_API_KEY=...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=...
NEXT_PUBLIC_FIREBASE_DATABASE_URL=...
NEXT_PUBLIC_FIREBASE_PROJECT_ID=...
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=...
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=...
NEXT_PUBLIC_FIREBASE_APP_ID=...

# Firebase Admin service account (server-only: never prefix with NEXT_PUBLIC_)
FIREBASE_PROJECT_ID=...
FIREBASE_CLIENT_EMAIL=...
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
FIREBASE_DATABASE_URL=...
```

### Firebase

1. Enable **Authentication → Sign-in method → Anonymous**
2. Create a Realtime Database and publish rules that limit `users/{uid}` to its owner and make `liveStatus` read-only for clients
3. Generate a service account key (**Project settings → Service accounts**) for the server variables above

### Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Start the development server |
| `npm run build` | Production build |
| `npm test` | Run the unit tests |
| `npm run lint` | Lint with ESLint |
| `npm run build:schedule` | Download Amtrak's GTFS feed and rebuild `data/schedule.json` |
| `npm run build:schedule -- --zip ./GTFS.zip` | Rebuild from a zip you already have |

---

## 📊 Data Sources & Attribution

- **Live train data** from [Amtraker](https://amtraker.com), used under the [Open Data Commons Attribution License](https://opendatacommons.org/licenses/by/1-0/). Attribution is shown on the departure board.
- **Timetable** from Amtrak's official GTFS feed. Amtrak and the Amtrak logo are trademarks of the National Railroad Passenger Corporation. This project is not affiliated with Amtrak.

---

## 📈 Roadmap

- Live connection warnings ("leg 1 is running 40 minutes late, so your connection is at risk")
- Google sign-in so trips follow you across devices, and sharing a trip by link
- Firebase App Check to block scripted access
- Shorter display names for stations
- Amtrak Thruway bus connections
- A phone-friendly layout for My Trips

---

## 📜 License

MIT License
