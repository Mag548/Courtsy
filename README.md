# CourtQueue

A modern, real-time court booking and queue management app for public tennis and pickleball courts in Oakville, Burlington, and Halton Hills, Ontario.

![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=next.js)
![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?logo=typescript)
![Supabase](https://img.shields.io/badge/Supabase-Database%20%2B%20Auth-green?logo=supabase)
![TailwindCSS](https://img.shields.io/badge/TailwindCSS-3-38bdf8?logo=tailwindcss)

---

## Features

- **Interactive Map** — Browse 24+ public courts on a Google Maps view, sorted by proximity to your location
- **Real-time Queue System** — Join a live queue for any court; position updates instantly for everyone
- **30-Minute Sessions** — Court sessions are timed with a live countdown; the next player is automatically notified when a spot opens
- **Session Extension** — Extend your session by 15 minutes if no one else is waiting (one-time per session)
- **Invite Friends** — Generate a shareable invite code/link so others can join your booking slot
- **Active Sessions Tab** — See and manage all your queued or active bookings from a single sidebar panel
- **In-Map Directions** — Get turn-by-turn directions drawn directly on the map, or open Google Maps externally
- **Location Search** — Search for any address and re-center the map with Google Places Autocomplete
- **Authentication** — Sign in with Google or email/password via Supabase Auth

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router) |
| Language | TypeScript |
| Styling | TailwindCSS + shadcn/ui |
| Database | Supabase (PostgreSQL) |
| Auth | Supabase Auth (Google OAuth + Email) |
| Realtime | Supabase Realtime subscriptions |
| Maps | Google Maps JavaScript API |
| Geocoding | Nominatim (OpenStreetMap) |
| Deployment | Vercel |

---

## Getting Started

### Prerequisites

- Node.js 18+
- A [Supabase](https://supabase.com) project
- A [Google Maps API key](https://console.cloud.google.com) with Maps JavaScript API + Places API enabled

### Installation

```bash
git clone https://github.com/YOUR_USERNAME/CourtQueue.git
cd CourtQueue
npm install
```

### Environment Variables

Create a `.env.local` file in the root:

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=your_google_maps_api_key
```

### Run Locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## Database Schema

The app uses the following Supabase tables:

- **`courts`** — Court locations with coordinates, type, and amenities
- **`queues`** — One queue per court
- **`queue_entries`** — Individual user queue slots with status tracking
- **`court_sessions`** — Active 30-minute play sessions with expiry timestamps
- **`users`** — User profiles synced from Supabase Auth

---

## Courts Coverage

24 public courts across three municipalities:

- **Oakville** — Shell Park, Maplegrove Park, River Oaks Park, Hopedale Park, Trafalgar Park Community Centre, Sovereign Park, Valleybrook Park, Fowley Park, and more
- **Burlington** — Ireland Park, Tansley Woods Park, Optimist Park, Sycamore Park, Brant Hills Community Centre, and more
- **Halton Hills** — Eighth Line Park, Prospect Park, Emmerson Park, Joseph Gibbons Courts

---

## License

MIT
