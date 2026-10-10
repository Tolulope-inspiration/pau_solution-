# CampusSync

CampusSync is a university classroom and event-booking application designed for a six-hour hackathon MVP. It combines a FastAPI backend with a responsive Next.js frontend to provide room search, intelligent recommendations, booking workflows, and utilisation dashboards.

## Project overview

The product is designed for three key user groups:

- Students searching for suitable classrooms and academic event spaces.
- Administrators approving or rejecting room requests and managing room status.
- Campus planners reviewing room utilization and demand trends.

## Architecture

- Frontend: Next.js + React + Tailwind CSS
- Backend: FastAPI + SQLite
- Analytics: client-side charting with Recharts
- Persistence: SQLite database in `backend/data/campus.db`

## Folder structure

```text
Hackathon/
├── backend/
│   ├── app/
│   │   ├── __init__.py
│   │   └── main.py
│   ├── data/
│   │   └── campus.db
│   ├── tests/
│   │   └── test_booking_rules.py
│   └── requirements.txt
├── frontend/
│   ├── app/
│   │   ├── globals.css
│   │   ├── layout.js
│   │   └── page.js
│   ├── package.json
│   ├── postcss.config.js
│   ├── tailwind.config.js
│   └── node_modules/
├── README.md
└── .gitignore
```

## Core features implemented

- Search for rooms by date, time, capacity, equipment, and building
- Exclude unavailable or over-capacity rooms
- Rank rooms using a transparent scoring algorithm
- Present recommendation explanations to users
- Create booking requests with validation and persistence
- Prevent overlapping bookings using SQLite-backed conflict checks
- Allow back-to-back bookings when end time equals next start time
- Review pending bookings as an administrator
- Approve, reject, and update booking statuses with role checks
- Show sample utilisation analytics for rooms and booking activity
- Provide a responsive layout for mobile and desktop use

## Backend API

The API is served by FastAPI at:

- http://localhost:8000/health
- http://localhost:8000/rooms
- http://localhost:8000/rooms/search
- http://localhost:8000/bookings
- http://localhost:8000/admin/requests
- http://localhost:8000/analytics
- FastAPI docs: http://localhost:8000/docs

## Prerequisites

- Python 3.11+ recommended
- Node.js 18+ or the current LTS version
- npm

## Setup instructions

### 1. Backend

```bash
cd backend
python -m pip install -r requirements.txt
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

### 2. Frontend

```bash
cd frontend
npm install
npm run dev
```

Then open:

- http://localhost:3000

## Testing

```bash
cd backend
python -m pytest tests/test_booking_rules.py
```

This validates the primary booking workflows, including:

- room search and capability filtering
- overlap rejection
- back-to-back booking permission
- invalid time handling
- admin-role enforcement

## Demo flow for judges

1. Open the app at http://localhost:3000.
2. Choose a room search such as Engineering, 40 attendees, Projector, 2026-10-15, 9:00-11:00.
3. Review the ranked room recommendations and explanations.
4. Select a room and submit a booking request.
5. View the booking status in the student dashboard.
6. Use the admin queue to approve or reject a pending request.
7. Review the utilisation analytics cards and chart.

## Known limitations

- This is an MVP and uses SQLite for local prototype persistence.
- Authentication is intentionally simplified as a demo-mode workflow rather than production-grade identity.
- The analytics are sample data and clearly labeled as such.
- Recommendation logic is a transparent, rule-based scoring system rather than ML-based personalization.

## Future improvements

- Role-based auth with real login and secure password hashing
- Audit trail for administrative booking decisions
- Maintenance scheduling and room downtime tracking
- Postgres migration for multi-user production deployment
- AI-assisted natural-language room requests
- More advanced booking forecasting and room utilization models
