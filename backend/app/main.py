import json
import sqlite3
from contextlib import contextmanager
from datetime import datetime
from pathlib import Path

from fastapi import FastAPI, Header, HTTPException, Query, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field, field_validator

DB_PATH = Path(__file__).resolve().parent.parent / "data" / "campus.db"
DB_PATH.parent.mkdir(parents=True, exist_ok=True)

app = FastAPI(title="CampusSync API", version="1.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def get_connection():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


@contextmanager
def db_session():
    conn = get_connection()
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def init_db():
    with db_session() as conn:
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                email TEXT UNIQUE NOT NULL,
                role TEXT NOT NULL DEFAULT 'student',
                password_hash TEXT
            )
            """
        )
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS rooms (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                building TEXT NOT NULL,
                capacity INTEGER NOT NULL,
                floor TEXT,
                status TEXT NOT NULL DEFAULT 'available',
                description TEXT,
                room_type TEXT NOT NULL DEFAULT 'classroom'
            )
            """
        )
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS equipment (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL UNIQUE
            )
            """
        )
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS room_equipment (
                room_id INTEGER NOT NULL,
                equipment_id INTEGER NOT NULL,
                FOREIGN KEY(room_id) REFERENCES rooms(id),
                FOREIGN KEY(equipment_id) REFERENCES equipment(id),
                PRIMARY KEY(room_id, equipment_id)
            )
            """
        )
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS bookings (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                room_id INTEGER NOT NULL,
                user_id INTEGER NOT NULL,
                event_date TEXT NOT NULL,
                start_time TEXT NOT NULL,
                end_time TEXT NOT NULL,
                attendees INTEGER NOT NULL,
                purpose TEXT NOT NULL,
                status TEXT NOT NULL DEFAULT 'pending',
                required_equipment TEXT NOT NULL DEFAULT '[]',
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY(room_id) REFERENCES rooms(id),
                FOREIGN KEY(user_id) REFERENCES users(id)
            )
            """
        )

        user_count = conn.execute("SELECT COUNT(*) FROM users").fetchone()[0]
        if user_count == 0:
            conn.execute(
                "INSERT INTO users (name, email, role) VALUES (?, ?, ?), (?, ?, ?), (?, ?, ?)",
                (
                    "Aisha Okafor",
                    "aisha@campus.edu",
                    "student",
                    "David Mensah",
                    "david@campus.edu",
                    "student",
                    "Campus Admin",
                    "admin@campus.edu",
                    "admin",
                ),
            )

        room_count = conn.execute("SELECT COUNT(*) FROM rooms").fetchone()[0]
        if room_count == 0:
            rooms = [
                ("A101", "Engineering", 40, "1", "available", "Lecture hall with flexible seating", "classroom"),
                ("B204", "Science", 22, "2", "available", "Small seminar room", "seminar"),
                ("C305", "Arts", 60, "3", "available", "Large event space with stage lighting", "event"),
                ("D210", "Business", 35, "2", "available", "Lab and presentation room", "classroom"),
                ("E115", "Engineering", 18, "1", "available", "Discussion room", "seminar"),
            ]
            conn.executemany(
                "INSERT INTO rooms (name, building, capacity, floor, status, description, room_type) VALUES (?, ?, ?, ?, ?, ?, ?)",
                rooms,
            )

        equipment_names = ["Projector", "Whiteboard", "Computers", "Audio equipment", "Air conditioning"]
        for name in equipment_names:
            conn.execute(
                "INSERT OR IGNORE INTO equipment (name) VALUES (?)",
                (name,),
            )

        if conn.execute("SELECT COUNT(*) FROM room_equipment").fetchone()[0] == 0:
            equipment_lookup = {name: conn.execute("SELECT id FROM equipment WHERE name = ?", (name,)).fetchone()[0] for name in equipment_names}
            room_equipment = {
                1: ["Projector", "Whiteboard", "Computers", "Air conditioning"],
                2: ["Whiteboard", "Projector"],
                3: ["Projector", "Audio equipment", "Air conditioning"],
                4: ["Projector", "Computers", "Whiteboard"],
                5: ["Whiteboard", "Air conditioning"],
            }
            rows = []
            for room_id, names in room_equipment.items():
                for name in names:
                    rows.append((room_id, equipment_lookup[name]))
            conn.executemany("INSERT INTO room_equipment (room_id, equipment_id) VALUES (?, ?)", rows)

        if conn.execute("SELECT COUNT(*) FROM bookings").fetchone()[0] == 0:
            conn.execute(
                """
                INSERT INTO bookings (room_id, user_id, event_date, start_time, end_time, attendees, purpose, status, required_equipment)
                VALUES
                    (1, 1, '2026-10-15', '09:00', '11:00', 25, 'Orientation briefing', 'confirmed', '["Projector"]'),
                    (3, 1, '2026-10-15', '14:00', '16:00', 50, 'Cultural festival rehearsal', 'pending', '["Audio equipment","Projector"]'),
                    (2, 1, '2026-10-17', '13:00', '15:00', 20, 'Capstone mentoring', 'pending', '["Whiteboard"]')
                """
            )


init_db()


class RoomSearchRequest(BaseModel):
    date: str
    start_time: str
    end_time: str
    attendees: int = Field(..., gt=0)
    equipment: list[str] = Field(default_factory=list)
    building: str | None = None

    @field_validator("start_time", "end_time")
    @classmethod
    def validate_time_format(cls, value: str):
        try:
            datetime.strptime(value, "%H:%M")
            return value
        except ValueError as exc:
            raise ValueError("Time must use HH:MM format") from exc

    @field_validator("date")
    @classmethod
    def validate_date(cls, value: str):
        try:
            datetime.strptime(value, "%Y-%m-%d")
            return value
        except ValueError as exc:
            raise ValueError("Date must use YYYY-MM-DD format") from exc


class BookingCreate(BaseModel):
    room_id: int
    user_id: int
    event_date: str
    start_time: str
    end_time: str
    attendees: int = Field(..., gt=0)
    purpose: str = Field(..., min_length=3)
    required_equipment: list[str] = Field(default_factory=list)
    status: str = "pending"

    @field_validator("start_time", "end_time")
    @classmethod
    def validate_time_format(cls, value: str):
        try:
            datetime.strptime(value, "%H:%M")
            return value
        except ValueError as exc:
            raise ValueError("Time must use HH:MM format") from exc

    @field_validator("event_date")
    @classmethod
    def validate_date(cls, value: str):
        try:
            datetime.strptime(value, "%Y-%m-%d")
            return value
        except ValueError as exc:
            raise ValueError("Date must use YYYY-MM-DD format") from exc


class BookingStatusUpdate(BaseModel):
    status: str


def get_equipment_for_room(room_id: int):
    with db_session() as conn:
        rows = conn.execute(
            """
            SELECT e.name
            FROM equipment e
            INNER JOIN room_equipment re ON re.equipment_id = e.id
            WHERE re.room_id = ?
            ORDER BY e.name
            """,
            (room_id,),
        ).fetchall()
        return [row["name"] for row in rows]


def room_has_conflict(room_id: int, event_date: str, new_start: str, new_end: str):
    with db_session() as conn:
        rows = conn.execute(
            """
            SELECT id, start_time, end_time
            FROM bookings
            WHERE room_id = ?
              AND event_date = ?
              AND status IN ('pending', 'confirmed')
            """,
            (room_id, event_date),
        ).fetchall()
    for row in rows:
        existing_start = row["start_time"]
        existing_end = row["end_time"]
        if existing_start < new_end and new_start < existing_end:
            return True
    return False


def get_room_by_id(room_id: int):
    with db_session() as conn:
        row = conn.execute("SELECT * FROM rooms WHERE id = ?", (room_id,)).fetchone()
        if not row:
            return None
        return dict(row)


def room_is_eligible(room: dict, search: RoomSearchRequest):
    booked_conflict = room_has_conflict(room["id"], search.date, search.start_time, search.end_time)
    if booked_conflict:
        return False, "Room is unavailable for the selected period."
    if room["capacity"] < search.attendees:
        return False, "Room capacity is too small for the expected attendees."
    if room["status"] != "available":
        return False, "Room is currently marked unavailable."
    equipment = set(get_equipment_for_room(room["id"]))
    required = set(search.equipment)
    missing = sorted(required - equipment)
    if missing:
        return False, f"Room is missing required equipment: {', '.join(missing)}."
    return True, "Room meets all hard requirements."


def build_recommendation_reason(room: dict, search: RoomSearchRequest, equipment: list[str]):
    capacity_gap = room["capacity"] - search.attendees
    best_fit = "comfortably fits" if capacity_gap >= 0 else "fits"
    equipment_text = ", ".join(equipment[:2]) if equipment else "basic teaching tools"
    if search.building and room["building"].lower() == search.building.lower():
        building_note = " and matches your preferred building"
    else:
        building_note = ""
    return (
        f"Recommended because this room accommodates your {search.attendees} attendees, includes {equipment_text}, "
        f"and is available for the full requested period{building_note}."
    )


@app.get("/health")
def health_check():
    return {"status": "ok", "service": "CampusSync API"}


@app.get("/rooms")
def list_rooms():
    with db_session() as conn:
        rows = conn.execute("SELECT * FROM rooms ORDER BY building, name").fetchall()
    result = []
    for row in rows:
        room = dict(row)
        room["equipment"] = get_equipment_for_room(room["id"])
        result.append(room)
    return result


@app.get("/rooms/search")
def search_rooms(
    date: str = Query(...),
    start_time: str = Query(...),
    end_time: str = Query(...),
    attendees: int = Query(...),
    equipment: list[str] = Query(default_factory=list),
    building: str | None = Query(default=None),
):
    try:
        search = RoomSearchRequest(
            date=date,
            start_time=start_time,
            end_time=end_time,
            attendees=attendees,
            equipment=equipment,
            building=building,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    if datetime.strptime(search.start_time, "%H:%M") >= datetime.strptime(search.end_time, "%H:%M"):
        raise HTTPException(status_code=400, detail="Start time must be earlier than end time.")

    results = []
    with db_session() as conn:
        rows = conn.execute("SELECT * FROM rooms ORDER BY building, name").fetchall()

    for row in rows:
        room = dict(row)
        room_equipment = get_equipment_for_room(room["id"])
        eligible, reason = room_is_eligible(room, search)
        if not eligible:
            continue
        score = 0
        score += max(0, 100 - abs(room["capacity"] - search.attendees) * 2)
        score += len(set(room_equipment) & set(search.equipment)) * 15
        if search.building and room["building"].lower() == search.building.lower():
            score += 20
        if room["room_type"] == "event" and search.attendees > 25:
            score += 30
        result = {
            "id": room["id"],
            "name": room["name"],
            "building": room["building"],
            "capacity": room["capacity"],
            "equipment": room_equipment,
            "status": "available",
            "recommendation": build_recommendation_reason(room, search, room_equipment),
            "score": score,
        }
        results.append(result)

    results.sort(key=lambda item: (-item["score"], -item["capacity"], item["name"]))
    return {"results": results, "request": search.model_dump()}


@app.post("/bookings", status_code=status.HTTP_201_CREATED)
def create_booking(payload: BookingCreate):
    if payload.start_time >= payload.end_time:
        raise HTTPException(status_code=400, detail="Start time must be earlier than end time.")

    room = get_room_by_id(payload.room_id)
    if not room:
        raise HTTPException(status_code=404, detail="Room not found.")
    if room["capacity"] < payload.attendees:
        raise HTTPException(status_code=400, detail="Room capacity is insufficient for the requested attendees.")
    if room["status"] != "available":
        raise HTTPException(status_code=400, detail="Room is currently marked unavailable.")

    room_equipment = set(get_equipment_for_room(payload.room_id))
    missing = sorted(set(payload.required_equipment) - room_equipment)
    if missing:
        raise HTTPException(status_code=400, detail=f"Room is missing required equipment: {', '.join(missing)}")

    if room_has_conflict(payload.room_id, payload.event_date, payload.start_time, payload.end_time):
        raise HTTPException(status_code=409, detail="This room is already booked for the requested time period.")

    with db_session() as conn:
        cursor = conn.execute(
            """
            INSERT INTO bookings (room_id, user_id, event_date, start_time, end_time, attendees, purpose, status, required_equipment)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                payload.room_id,
                payload.user_id,
                payload.event_date,
                payload.start_time,
                payload.end_time,
                payload.attendees,
                payload.purpose,
                payload.status,
                json.dumps(payload.required_equipment),
            ),
        )
        booking_id = cursor.lastrowid

    return {
        "id": booking_id,
        "room_id": payload.room_id,
        "status": payload.status,
        "message": "Booking request submitted successfully.",
    }


@app.get("/bookings")
def list_bookings(user_id: int | None = None):
    with db_session() as conn:
        if user_id is not None:
            rows = conn.execute(
                "SELECT * FROM bookings WHERE user_id = ? ORDER BY event_date, start_time",
                (user_id,),
            ).fetchall()
        else:
            rows = conn.execute("SELECT * FROM bookings ORDER BY event_date, start_time").fetchall()
    return [dict(row) for row in rows]


@app.patch("/bookings/{booking_id}/status")
def update_booking_status(booking_id: int, payload: BookingStatusUpdate, x_user_role: str | None = Header(default=None, alias="X-User-Role")):
    if x_user_role != "admin":
        raise HTTPException(status_code=403, detail="Administrator access required to change booking status.")

    with db_session() as conn:
        booking = conn.execute("SELECT * FROM bookings WHERE id = ?", (booking_id,)).fetchone()
        if not booking:
            raise HTTPException(status_code=404, detail="Booking not found.")
        if payload.status not in {"pending", "confirmed", "rejected", "cancelled"}:
            raise HTTPException(status_code=400, detail="Invalid booking status.")
        conn.execute(
            "UPDATE bookings SET status = ? WHERE id = ?",
            (payload.status, booking_id),
        )
    return {"id": booking_id, "status": payload.status, "message": "Booking status updated."}


@app.get("/admin/requests")
def admin_requests():
    with db_session() as conn:
        rows = conn.execute("SELECT * FROM bookings ORDER BY event_date, start_time").fetchall()
    return [dict(row) for row in rows]


@app.get("/analytics")
def analytics():
    with db_session() as conn:
        total_rooms = conn.execute("SELECT COUNT(*) FROM rooms").fetchone()[0]
        total_bookings = conn.execute("SELECT COUNT(*) FROM bookings").fetchone()[0]
        pending = conn.execute("SELECT COUNT(*) FROM bookings WHERE status = 'pending'").fetchone()[0]
        confirmed = conn.execute("SELECT COUNT(*) FROM bookings WHERE status = 'confirmed'").fetchone()[0]
        rooms = conn.execute("SELECT * FROM rooms ORDER BY building, name").fetchall()
        utilization = []
        for room in rooms:
            room_id = room["id"]
            room_hours = conn.execute(
                "SELECT COALESCE(SUM((strftime('%s', end_time) - strftime('%s', start_time)) / 3600), 0) FROM bookings WHERE room_id = ? AND status IN ('confirmed', 'pending')",
                (room_id,),
            ).fetchone()[0]
            utilization.append({
                "room_id": room_id,
                "name": room["name"],
                "booked_hours": room_hours,
                "utilization_rate": round((room_hours / 36) * 100, 2) if room_hours else 0.0,
            })

    return {
        "total_rooms": total_rooms,
        "total_bookings": total_bookings,
        "pending_bookings": pending,
        "confirmed_bookings": confirmed,
        "room_utilization": utilization,
        "top_rooms": sorted(utilization, key=lambda x: x["booked_hours"], reverse=True)[:3],
    }


@app.get("/")
def index():
    return {"message": "CampusSync backend is running."}
