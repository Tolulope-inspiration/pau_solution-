'use client';

import { useEffect, useMemo, useState } from 'react';
import { BarChart, Bar, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

const API_URL = 'http://localhost:8000';

const defaultSearch = {
  date: '2026-10-15',
  start_time: '09:00',
  end_time: '11:00',
  attendees: 40,
  equipment: ['Projector'],
  building: 'Engineering',
};

const equipmentOptions = ['Projector', 'Whiteboard', 'Computers', 'Audio equipment', 'Air conditioning'];

function toggleEquipment(current, value) {
  return current.includes(value)
    ? current.filter((item) => item !== value)
    : [...current, value];
}

export default function HomePage() {
  const [search, setSearch] = useState(defaultSearch);
  const [results, setResults] = useState([]);
  const [selectedRoom, setSelectedRoom] = useState(null);
  const [bookingMessage, setBookingMessage] = useState('');
  const [bookings, setBookings] = useState([]);
  const [analytics, setAnalytics] = useState({ total_rooms: 0, total_bookings: 0, pending_bookings: 0, confirmed_bookings: 0, room_utilization: [] });
  const [adminRows, setAdminRows] = useState([]);
  const [loading, setLoading] = useState(false);

  const summaryCards = useMemo(() => [
    { label: 'Upcoming bookings', value: '4', tone: 'navy' },
    { label: 'Pending approvals', value: '2', tone: 'teal' },
    { label: 'Recommended rooms', value: '3', tone: 'slate' },
  ], []);

  async function fetchSearchResults() {
    setLoading(true);
    const params = new URLSearchParams({
      date: search.date,
      start_time: search.start_time,
      end_time: search.end_time,
      attendees: String(search.attendees),
      building: search.building,
    });
    search.equipment.forEach((item) => params.append('equipment', item));

    const response = await fetch(`${API_URL}/rooms/search?${params.toString()}`);
    const data = await response.json();
    setResults(data.results || []);
    setSelectedRoom(data.results?.[0] || null);
    setLoading(false);
  }

  async function fetchBookings() {
    const response = await fetch(`${API_URL}/bookings?user_id=2`);
    const data = await response.json();
    setBookings(data || []);
  }

  async function fetchAdminData() {
    const response = await fetch(`${API_URL}/admin/requests`, {
      headers: { 'X-User-Role': 'admin' },
    });
    const data = await response.json();
    setAdminRows(data || []);
  }

  async function fetchAnalytics() {
    const response = await fetch(`${API_URL}/analytics`);
    const data = await response.json();
    setAnalytics(data);
  }

  useEffect(() => {
    fetchSearchResults();
    fetchBookings();
    fetchAdminData();
    fetchAnalytics();
  }, []);

  async function handleSubmitBooking() {
    if (!selectedRoom) return;

    const payload = {
      room_id: selectedRoom.id,
      user_id: 2,
      event_date: search.date,
      start_time: search.start_time,
      end_time: search.end_time,
      attendees: Number(search.attendees),
      purpose: 'Student-led academic booking',
      required_equipment: search.equipment,
      status: 'pending',
    };

    const response = await fetch(`${API_URL}/bookings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const data = await response.json();
    if (!response.ok) {
      setBookingMessage(`Booking failed: ${data.detail || 'Please review the room request.'}`);
      return;
    }

    setBookingMessage(`Request submitted for ${selectedRoom.name}. Status: ${data.status}.`);
    fetchBookings();
    fetchAdminData();
    fetchAnalytics();
  }

  async function updateBookingStatus(id, status) {
    const response = await fetch(`${API_URL}/bookings/${id}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'X-User-Role': 'admin',
      },
      body: JSON.stringify({ status }),
    });

    if (response.ok) {
      fetchAdminData();
      fetchAnalytics();
      fetchBookings();
    }
  }

  const chartData = analytics.room_utilization?.map((item) => ({
    name: item.name,
    utilisation: item.utilization_rate,
  })) || [];

  return (
    <main className="min-h-screen bg-slate-50 text-slate-800">
      <header className="border-b border-slate-200 bg-white/90 backdrop-blur-sm">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-teal-700">CampusSync</p>
            <h1 className="text-xl font-bold text-slate-900">University booking system</h1>
          </div>
          <nav className="hidden items-center gap-6 text-sm font-medium md:flex">
            <a href="#dashboard" className="text-slate-700 hover:text-teal-700">Dashboard</a>
            <a href="#search" className="text-slate-700 hover:text-teal-700">Find a room</a>
            <a href="#analytics" className="text-slate-700 hover:text-teal-700">Analytics</a>
          </nav>
          <button className="rounded-full bg-navy px-4 py-2 text-sm font-semibold text-white shadow-sm">Demo mode</button>
        </div>
      </header>

      <section id="dashboard" className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="grid gap-6 lg:grid-cols-[1.4fr_0.8fr]">
          <div className="rounded-3xl bg-navy p-8 text-white shadow-xl">
            <p className="text-sm uppercase tracking-[0.22em] text-teal-300">Welcome back</p>
            <h2 className="mt-3 text-3xl font-bold">Aisha, find the right room for your next class or event.</h2>
            <p className="mt-4 max-w-xl text-sm text-slate-200">
              View live availability, compare room suitability, and submit bookings with approval tracking built in.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <button onClick={() => document.getElementById('search')?.scrollIntoView({ behavior: 'smooth' })} className="rounded-full bg-teal-500 px-5 py-3 font-semibold text-slate-950 shadow-md transition hover:bg-teal-400">
                Find a Room
              </button>
              <button className="rounded-full border border-slate-600 bg-slate-900/20 px-5 py-3 font-semibold text-white transition hover:border-teal-300 hover:text-teal-200">
                View bookings
              </button>
            </div>
          </div>

          <div className="grid gap-4">
            {summaryCards.map((card) => (
              <div key={card.label} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-500">{card.label}</span>
                  <span className={`h-2.5 w-2.5 rounded-full ${card.tone === 'navy' ? 'bg-navy' : card.tone === 'teal' ? 'bg-teal-500' : 'bg-slate-400'}`} />
                </div>
                <p className="mt-3 text-3xl font-bold text-slate-900">{card.value}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="search" className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
        <div className="grid gap-8 lg:grid-cols-[380px_1fr]">
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <h3 className="text-xl font-bold text-slate-900">Room search</h3>
            <div className="mt-5 space-y-4">
              <label className="block">
                <span className="mb-1 block text-sm font-medium text-slate-700">Event date</span>
                <input type="date" value={search.date} onChange={(e) => setSearch({ ...search, date: e.target.value })} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 focus:border-teal-500 focus:outline-none" />
              </label>

              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="mb-1 block text-sm font-medium text-slate-700">Start time</span>
                  <input type="time" value={search.start_time} onChange={(e) => setSearch({ ...search, start_time: e.target.value })} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 focus:border-teal-500 focus:outline-none" />
                </label>
                <label className="block">
                  <span className="mb-1 block text-sm font-medium text-slate-700">End time</span>
                  <input type="time" value={search.end_time} onChange={(e) => setSearch({ ...search, end_time: e.target.value })} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 focus:border-teal-500 focus:outline-none" />
                </label>
              </div>

              <label className="block">
                <span className="mb-1 block text-sm font-medium text-slate-700">Attendees</span>
                <input type="number" min="1" value={search.attendees} onChange={(e) => setSearch({ ...search, attendees: Number(e.target.value) })} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 focus:border-teal-500 focus:outline-none" />
              </label>

              <label className="block">
                <span className="mb-1 block text-sm font-medium text-slate-700">Preferred building</span>
                <select value={search.building} onChange={(e) => setSearch({ ...search, building: e.target.value })} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 focus:border-teal-500 focus:outline-none">
                  <option value="">Any building</option>
                  <option value="Engineering">Engineering</option>
                  <option value="Science">Science</option>
                  <option value="Arts">Arts</option>
                  <option value="Business">Business</option>
                </select>
              </label>

              <div>
                <p className="mb-2 text-sm font-medium text-slate-700">Required equipment</p>
                <div className="flex flex-wrap gap-2">
                  {equipmentOptions.map((equipment) => (
                    <button
                      key={equipment}
                      type="button"
                      onClick={() => setSearch({ ...search, equipment: toggleEquipment(search.equipment, equipment) })}
                      className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${search.equipment.includes(equipment) ? 'border-teal-600 bg-teal-50 text-teal-700' : 'border-slate-200 bg-white text-slate-600'}`}
                    >
                      {equipment}
                    </button>
                  ))}
                </div>
              </div>

              <button onClick={fetchSearchResults} className="mt-6 w-full rounded-xl bg-navy px-4 py-3 font-semibold text-white shadow-sm transition hover:bg-slate-800">
                {loading ? 'Searching...' : 'Search rooms'}
              </button>
            </div>
          </div>

          <div className="space-y-5">
            {results.length === 0 ? (
              <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-8 text-center text-slate-500 shadow-sm">
                No rooms match the selected requirements. Adjust the filters or time range.
              </div>
            ) : (
              results.map((room) => (
                <div key={room.id} className={`rounded-3xl border bg-white p-5 shadow-sm transition ${selectedRoom?.id === room.id ? 'border-teal-400 ring-2 ring-teal-100' : 'border-slate-200'}`}>
                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div>
                      <div className="flex items-center gap-3">
                        <h3 className="text-xl font-bold text-slate-900">{room.name}</h3>
                        <span className="rounded-full bg-emerald-100 px-2 py-1 text-xs font-semibold text-emerald-700">Available</span>
                      </div>
                      <p className="mt-1 text-sm text-slate-500">{room.building} · Capacity {room.capacity}</p>
                    </div>
                    <button onClick={() => setSelectedRoom(room)} className="rounded-full border border-slate-200 bg-slate-100 px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:border-teal-600 hover:text-teal-700">
                      Select room
                    </button>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    {room.equipment.map((item) => (
                      <span key={item} className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">{item}</span>
                    ))}
                  </div>

                  <p className="mt-4 text-sm leading-6 text-slate-600">{room.recommendation}</p>
                </div>
              ))
            )}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <h3 className="text-xl font-bold text-slate-900">Booking confirmation</h3>
            {selectedRoom ? (
              <div className="mt-5 space-y-4">
                <div className="rounded-2xl bg-slate-50 p-4">
                  <p className="text-sm text-slate-500">Selected room</p>
                  <p className="mt-1 text-lg font-semibold text-slate-900">{selectedRoom.name} · {selectedRoom.building}</p>
                  <p className="text-sm text-slate-600">Capacity {selectedRoom.capacity} · {selectedRoom.equipment.join(', ')}</p>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-xl border border-slate-200 p-3">
                    <span className="text-xs uppercase tracking-[0.18em] text-slate-500">Date</span>
                    <p className="mt-1 font-medium text-slate-900">{search.date}</p>
                  </div>
                  <div className="rounded-xl border border-slate-200 p-3">
                    <span className="text-xs uppercase tracking-[0.18em] text-slate-500">Time</span>
                    <p className="mt-1 font-medium text-slate-900">{search.start_time} – {search.end_time}</p>
                  </div>
                </div>
                <button onClick={handleSubmitBooking} className="w-full rounded-xl bg-teal-500 px-4 py-3 font-semibold text-slate-950 shadow-sm transition hover:bg-teal-400">
                  Submit booking request
                </button>
                {bookingMessage && <p className="text-sm font-medium text-slate-700">{bookingMessage}</p>}
              </div>
            ) : (
              <p className="mt-5 text-sm text-slate-500">Choose a room from the search results to continue.</p>
            )}
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <h3 className="text-xl font-bold text-slate-900">Upcoming bookings</h3>
            <div className="mt-5 space-y-3">
              {bookings.length === 0 ? (
                <p className="text-sm text-slate-500">No bookings yet.</p>
              ) : (
                bookings.map((booking) => (
                  <div key={booking.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                    <div className="flex items-center justify-between">
                      <p className="font-semibold text-slate-900">Booking #{booking.id}</p>
                      <span className="rounded-full bg-amber-100 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-amber-700">{booking.status}</span>
                    </div>
                    <p className="mt-2 text-sm text-slate-600">{booking.event_date} · {booking.start_time}–{booking.end_time}</p>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </section>

      <section id="analytics" className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-5 flex items-center justify-between">
          <h3 className="text-2xl font-bold text-slate-900">Utilisation analytics</h3>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium uppercase tracking-[0.18em] text-slate-600">Sample data</span>
        </div>

        <div className="grid gap-4 md:grid-cols-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-sm text-slate-500">Total rooms</p>
            <p className="mt-2 text-3xl font-bold text-slate-900">{analytics.total_rooms}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-sm text-slate-500">Total bookings</p>
            <p className="mt-2 text-3xl font-bold text-slate-900">{analytics.total_bookings}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-sm text-slate-500">Pending</p>
            <p className="mt-2 text-3xl font-bold text-slate-900">{analytics.pending_bookings}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-sm text-slate-500">Confirmed</p>
            <p className="mt-2 text-3xl font-bold text-slate-900">{analytics.confirmed_bookings}</p>
          </div>
        </div>

        <div className="mt-6 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip formatter={(value) => [`${value}%`, 'Utilisation']} />
                <Bar dataKey="utilisation" fill="#0f172a" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 pb-16 pt-8 sm:px-6 lg:px-8">
        <h3 className="text-2xl font-bold text-slate-900">Admin queue</h3>
        <div className="mt-6 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">ID</th>
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Date</th>
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Room</th>
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Status</th>
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {adminRows.length === 0 ? (
                <tr>
                  <td className="px-5 py-4 text-sm text-slate-500" colSpan="5">No booking requests to review.</td>
                </tr>
              ) : (
                adminRows.map((row) => (
                  <tr key={row.id}>
                    <td className="px-5 py-4 text-sm font-medium text-slate-900">{row.id}</td>
                    <td className="px-5 py-4 text-sm text-slate-600">{row.event_date}</td>
                    <td className="px-5 py-4 text-sm text-slate-600">Room {row.room_id}</td>
                    <td className="px-5 py-4 text-sm text-slate-600">{row.status}</td>
                    <td className="px-5 py-4">
                      <div className="flex gap-2">
                        <button onClick={() => updateBookingStatus(row.id, 'confirmed')} className="rounded-full bg-emerald-100 px-3 py-1.5 text-xs font-semibold text-emerald-700">Approve</button>
                        <button onClick={() => updateBookingStatus(row.id, 'rejected')} className="rounded-full bg-rose-100 px-3 py-1.5 text-xs font-semibold text-rose-700">Reject</button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
