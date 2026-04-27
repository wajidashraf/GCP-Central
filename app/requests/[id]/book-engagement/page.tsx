'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Button from '@/src/components/ui/button';

interface Slot {
  id: string;
  slotName: string;
  startTime: string;
  endTime: string;
  attendees: string[];
  status?: string | null;
}

interface BookingMeta {
  request: {
    requestNo: string;
    requestTitle: string;
  };
  nextEngagementNumber: string;
}

const MEETING_ROOMS = [
  'O3CS Meeting Room',
  'Hyrangea Meeting Room',
  'Petunia Meeting Room',
  'Other',
];

function getMonthKey(value: string) {
  const date = new Date(value);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function formatMonthLabel(monthKey: string) {
  const [year, month] = monthKey.split('-').map(Number);
  return new Date(year, month - 1).toLocaleString('en-GB', {
    month: 'long',
    year: 'numeric',
  });
}

function formatSlotDate(value: string) {
  return new Date(value).toLocaleDateString('en-GB', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

function formatSlotTime(value: string) {
  return new Date(value).toLocaleTimeString('en-GB', {
    hour: 'numeric',
    minute: '2-digit',
  });
}

function getDurationMinutes(startTime: string, endTime: string) {
  const start = new Date(startTime).getTime();
  const end = new Date(endTime).getTime();
  return Math.max(Math.round((end - start) / 60000), 0);
}

export default function BookEngagementPage() {
  const router = useRouter();
  const params = useParams();
  const requestId = params.id as string;

  const [slots, setSlots] = useState<Slot[]>([]);
  const [bookingMeta, setBookingMeta] = useState<BookingMeta | null>(null);
  const [engagementName, setEngagementName] = useState('');
  const [selectedSlotId, setSelectedSlotId] = useState<string>('');
  const [selectedMonth, setSelectedMonth] = useState('');
  const [engagementType, setEngagementType] = useState<'virtual' | 'in_person'>('virtual');
  const [meetingRoom, setMeetingRoom] = useState('');
  const [manualLocation, setManualLocation] = useState('');
  const [notes, setNotes] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchInitialData();
  }, []);

  const monthOptions = useMemo(() => {
    const counts = new Map<string, number>();
    slots.forEach((slot) => {
      const key = getMonthKey(slot.startTime);
      counts.set(key, (counts.get(key) ?? 0) + 1);
    });
    return Array.from(counts.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [slots]);

  const visibleSlots = useMemo(() => {
    if (!selectedMonth) return slots;
    return slots.filter((slot) => getMonthKey(slot.startTime) === selectedMonth);
  }, [selectedMonth, slots]);

  const fetchInitialData = async () => {
    try {
      const [slotsResponse, metaResponse] = await Promise.all([
        fetch('/api/admin/engagement-slots'),
        fetch(`/api/requests/${requestId}/book-engagement`),
      ]);

      if (!metaResponse.ok) {
        const errorData = await metaResponse.json();
        throw new Error(errorData.error || 'Failed to fetch request details');
      }

      const meta: BookingMeta = await metaResponse.json();
      setBookingMeta(meta);

      if (slotsResponse.ok) {
        const data: Slot[] = await slotsResponse.json();

        const now = new Date();
        const oneMonthLater = new Date();
        oneMonthLater.setMonth(oneMonthLater.getMonth() + 1);

        const filtered = data.filter((slot) => {
          const start = new Date(slot.startTime);
          const isAvailable = !slot.status || slot.status === 'available';
          return isAvailable && start >= now && start <= oneMonthLater;
        });

        setSlots(filtered);
        if (filtered.length > 0) {
          setSelectedMonth(getMonthKey(filtered[0].startTime));
        }
      } else {
        setError('Failed to fetch slots');
      }
    } catch (err) {
      setError('Error fetching slots');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!selectedSlotId) {
      setError('Please select a slot');
      return;
    }

    if (!engagementName.trim()) {
      setError('Please enter an engagement name');
      return;
    }

    if (engagementType === 'in_person') {
      const hasLocation = meetingRoom === 'Other' ? manualLocation.trim() : meetingRoom;
      if (!hasLocation) {
        setError('Please select or enter a meeting location');
        return;
      }
    }

    setIsSubmitting(true);

    try {
      const response = await fetch(`/api/requests/${requestId}/book-engagement`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slotId: selectedSlotId,
          name: engagementName,
          type: engagementType,
          meetingRoom,
          manualLocation,
          notes: notes || null,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to book engagement');
      }

      router.push(`/requests/${requestId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to book engagement');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <header className="page-header">
          <h1 className="page-title">Book Engagement</h1>
        </header>
        <div className="surface-card p-5 text-center">Loading slots...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header className="page-header sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="page-title">Schedule Engagement</h1>
            {bookingMeta?.nextEngagementNumber && (
              <span className="rounded-md bg-[var(--brand-600)] px-2 py-1 text-xs font-semibold text-white">
                {bookingMeta.nextEngagementNumber}
              </span>
            )}
          </div>
          <p className="page-subtitle">
            {bookingMeta?.request.requestTitle ?? 'Select a time slot for your engagement meeting'}
          </p>
        </div>
        {bookingMeta?.request.requestNo && (
          <div className="text-sm font-medium text-[var(--text)]">
            Request: <span className="text-[var(--text-muted)]">{bookingMeta.request.requestNo}</span>
          </div>
        )}
        <Button href={`/requests/${requestId}`} variant="secondary" size="sm">
          Back to request
        </Button>
      </header>

      <section className="surface-card p-5">
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label htmlFor="engagementName" className="mb-2 block text-sm font-medium text-[var(--text)]">
              Engagement Name <span className="text-red-600">*</span>
            </label>
            <input
              id="engagementName"
              type="text"
              value={engagementName}
              onChange={(e) => setEngagementName(e.target.value)}
              className="w-full rounded-lg border border-[var(--border)] bg-white p-3 text-sm text-[var(--text)] focus:border-[var(--brand-500)] focus:outline-none focus:ring-2 focus:ring-[var(--brand-100)]"
              disabled={isSubmitting}
              required
            />
          </div>

          <div>
            <label htmlFor="month" className="mb-2 block text-sm font-medium text-[var(--text)]">
              Select Month <span className="text-red-600">*</span>
            </label>
            <select
              id="month"
              value={selectedMonth}
              onChange={(e) => {
                setSelectedMonth(e.target.value);
                setSelectedSlotId('');
              }}
              className="w-full rounded-lg border border-[var(--border)] bg-white p-3 text-sm text-[var(--text)] focus:border-[var(--brand-500)] focus:outline-none focus:ring-2 focus:ring-[var(--brand-100)]"
              disabled={isSubmitting || monthOptions.length === 0}
            >
              {monthOptions.length === 0 ? (
                <option value="">No available months</option>
              ) : (
                monthOptions.map(([monthKey, count]) => (
                  <option key={monthKey} value={monthKey}>
                    {formatMonthLabel(monthKey)} ({count} slots available)
                  </option>
                ))
              )}
            </select>
          </div>

          <div>
            <label className="mb-3 block text-sm font-medium text-[var(--text)]">
              Available Time Slots <span className="text-red-600">*</span>{' '}
              <span className="font-normal text-[var(--text-muted)]">({visibleSlots.length} available)</span>
            </label>

            {visibleSlots.length > 0 ? (
              <div className="rounded-lg border border-[var(--border)] bg-gray-50 p-4">
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {visibleSlots.map((slot) => {
                  const selected = selectedSlotId === slot.id;
                  return (
                  <label
                    key={slot.id}
                    className={`cursor-pointer rounded-lg border bg-white p-4 shadow-sm transition ${
                      selected
                        ? 'border-[var(--brand-600)] ring-2 ring-[var(--brand-200)]'
                        : 'border-[var(--border)] hover:border-[var(--brand-300)]'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <input
                        type="radio"
                        name="slot"
                        value={slot.id}
                        checked={selected}
                        onChange={(e) => setSelectedSlotId(e.target.value)}
                        disabled={isSubmitting}
                        className="mt-1 h-4 w-4 cursor-pointer"
                      />
                      <div className="mt-1 text-sm text-[var(--text-muted)]">
                        <div className="font-medium text-[var(--text)]">{formatSlotDate(slot.startTime)}</div>
                        <div className="mt-2 text-xs font-semibold">{getDurationMinutes(slot.startTime, slot.endTime)} minutes</div>
                        <div className="mt-1 font-semibold text-[var(--text)]">
                          {formatSlotTime(slot.startTime)} - {formatSlotTime(slot.endTime)}
                        </div>
                      </div>
                    </div>
                  </label>
                  );
                })}
                </div>
              </div>
            ) : (
              <div className="rounded-lg bg-yellow-50 p-4 text-sm text-yellow-700">
                No available slots for the selected month.
              </div>
            )}
          </div>

          <div>
            <label className="mb-3 block text-sm font-medium text-[var(--text)]">
              Engagement Type <span className="text-red-600">*</span>
            </label>
            <div className="flex flex-wrap gap-6 text-sm text-[var(--text)]">
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="engagementType"
                  value="virtual"
                  checked={engagementType === 'virtual'}
                  onChange={() => setEngagementType('virtual')}
                  disabled={isSubmitting}
                />
                Virtual
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="engagementType"
                  value="in_person"
                  checked={engagementType === 'in_person'}
                  onChange={() => setEngagementType('in_person')}
                  disabled={isSubmitting}
                />
                In-Person
              </label>
            </div>
          </div>

          {engagementType === 'in_person' && (
            <div className="space-y-4">
              <div>
                <label htmlFor="meetingRoom" className="mb-2 block text-sm font-medium text-[var(--text)]">
                  Meeting Location <span className="text-red-600">*</span>
                </label>
                <select
                  id="meetingRoom"
                  value={meetingRoom}
                  onChange={(e) => setMeetingRoom(e.target.value)}
                  className="w-full rounded-lg border border-[var(--border)] bg-white p-3 text-sm text-[var(--text)] focus:border-[var(--brand-500)] focus:outline-none focus:ring-2 focus:ring-[var(--brand-100)]"
                  disabled={isSubmitting}
                  required
                >
                  <option value="">Select a location</option>
                  {MEETING_ROOMS.map((room) => (
                    <option key={room} value={room}>
                      {room === 'Other' ? 'Other (enter manually)' : room}
                    </option>
                  ))}
                </select>
              </div>

              {meetingRoom === 'Other' && (
                <div>
                  <label htmlFor="manualLocation" className="mb-2 block text-sm font-medium text-[var(--text)]">
                    Manual Meeting Location <span className="text-red-600">*</span>
                  </label>
                  <input
                    id="manualLocation"
                    type="text"
                    value={manualLocation}
                    onChange={(e) => setManualLocation(e.target.value)}
                    placeholder="Enter meeting location"
                    className="w-full rounded-lg border border-[var(--border)] bg-white p-3 text-sm text-[var(--text)] placeholder:text-[var(--text-muted)] focus:border-[var(--brand-500)] focus:outline-none focus:ring-2 focus:ring-[var(--brand-100)]"
                    disabled={isSubmitting}
                    required
                  />
                </div>
              )}
            </div>
          )}

          <div>
            <label htmlFor="notes" className="mb-2 block text-sm font-medium text-[var(--text)]">
              Additional Notes (Optional)
            </label>
            <textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add any additional notes for the engagement..."
              className="w-full rounded-lg border border-[var(--border)] bg-white p-3 text-sm text-[var(--text)] placeholder:text-[var(--text-muted)] focus:border-[var(--brand-500)] focus:outline-none focus:ring-2 focus:ring-[var(--brand-100)]"
              rows={4}
              disabled={isSubmitting}
            />
          </div>

          {error && (
            <div className="rounded-lg bg-red-50 p-4 text-sm text-red-700">{error}</div>
          )}

          <div className="flex justify-end gap-2 pt-4">
            <Button
              type="button"
              variant="secondary"
              onClick={() => router.back()}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              disabled={isSubmitting || visibleSlots.length === 0}
            >
              {isSubmitting ? 'Booking...' : 'Book Engagement'}
            </Button>
          </div>
        </form>
      </section>
    </div>
  );
}
