import importlib
import sys
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import app.main as app_module


@pytest.fixture(autouse=True)
def reset_database():
    db_path = Path(__file__).resolve().parents[1] / "data" / "campus.db"
    if db_path.exists():
        db_path.unlink()
    importlib.reload(app_module)
    yield
    if db_path.exists():
        db_path.unlink()


client = TestClient(app_module.app)


def test_room_search_filters_capacity_and_equipment():
    response = client.get(
        "/rooms/search",
        params={
            "date": "2026-10-15",
            "start_time": "09:00",
            "end_time": "11:00",
            "attendees": 40,
            "equipment": ["Projector"],
            "building": "Engineering",
        },
    )
    assert response.status_code == 200
    payload = response.json()
    assert payload["results"]
    for room in payload["results"]:
        assert room["capacity"] >= 40
        assert "Projector" in room["equipment"]


def test_overlapping_booking_is_rejected():
    response = client.post(
        "/bookings",
        json={
            "room_id": 1,
            "user_id": 2,
            "event_date": "2026-10-15",
            "start_time": "10:00",
            "end_time": "12:00",
            "attendees": 20,
            "purpose": "Midterm review",
            "status": "pending",
            "required_equipment": ["Projector"],
        },
    )
    assert response.status_code == 409


def test_back_to_back_bookings_are_allowed():
    response = client.post(
        "/bookings",
        json={
            "room_id": 1,
            "user_id": 2,
            "event_date": "2026-10-15",
            "start_time": "12:00",
            "end_time": "13:00",
            "attendees": 20,
            "purpose": "Back-to-back booking",
            "status": "pending",
            "required_equipment": ["Projector"],
        },
    )
    assert response.status_code == 201


def test_invalid_time_range_rejected():
    response = client.post(
        "/bookings",
        json={
            "room_id": 1,
            "user_id": 2,
            "event_date": "2026-10-15",
            "start_time": "15:00",
            "end_time": "14:00",
            "attendees": 20,
            "purpose": "Invalid times",
            "status": "pending",
            "required_equipment": ["Projector"],
        },
    )
    assert response.status_code == 400


def test_admin_approval_requires_role_header():
    response = client.patch(
        "/bookings/1/status",
        json={"status": "approved"},
    )
    assert response.status_code == 403
