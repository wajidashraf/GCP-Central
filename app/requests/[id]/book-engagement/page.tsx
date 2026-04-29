'use client';

import { useEffect, useMemo, useState, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Button from '@/src/components/ui/button';

// ─── Types ───────────────────────────────────────────────────────────────────

interface Slot {
  id: string;
  slotName: string;
  startTime: string;
  endTime: string;
  attendees: string[];
  status?: string | null;
}

interface Engagement {
  id: string;
  engagementNumber: string;
  name: string;
  type: 'virtual' | 'in_person';
  meetingRoom?: string;
  manualLocation?: string;
  notes?: string;
  status: number; // 0 = Cancelled, 1 = Scheduled, 2 = Completed
  slot: {
    startTime: string;
    endTime: string;
  };
}

interface BookingMeta {
  request: {
    requestNo: string;
    requestTitle: string;
  };
  nextEngagementNumber: string;
  existingEngagement: Engagement | null;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const MEETING_ROOMS = [
  'O3CS Meeting Room',
  'Hyrangea Meeting Room',
  'Petunia Meeting Room',
  'Other',
] as const;

const ENGAGEMENT_STATUS = {
  CANCELLED: 0,
  SCHEDULED: 1,
  COMPLETED: 2,
} as const;

const STATUS_LABELS: Record<number, string> = {
  0: 'Cancelled',
  1: 'Scheduled',
  2: 'Completed',
};

const STATUS_STYLES: Record<number, string> = {
  0: 'bg-red-100 text-red-700 border-red-200',
  1: 'bg-blue-100 text-blue-700 border-blue-200',
  2: 'bg-green-100 text-green-700 border-green-200',
};

const MAX_MONTHS_AHEAD = 6;

// ─── Utilities ───────────────────────────────────────────────────────────────

function getMonthKey(value: string): string {
  const date = new Date(value);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function formatMonthLabel(monthKey: string): string {
  const [year, month] = monthKey.split('-').map(Number);
  return new Date(year, month - 1).toLocaleString('en-GB', {
    month: 'long',
    year: 'numeric',
  });
}

function formatSlotDate(value: string): string {
  return new Date(value).toLocaleDateString('en-GB', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

function formatSlotTime(value: string): string {
  return new Date(value).toLocaleTimeString('en-GB', {
    hour: 'numeric',
    minute: '2-digit',
  });
}

function formatDateTime(value: string): string {
  return new Date(value).toLocaleString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function getDurationMinutes(startTime: string, endTime: string): number {
  const start = new Date(startTime).getTime();
  const end = new Date(endTime).getTime();
  return Math.max(Math.round((end - start) / 60000), 0);
}

/**
 * Filter slots to only those:
 *  - After the current date/time
 *  - Within the next MAX_MONTHS_AHEAD months
 *  - With no status OR status === 'available'
 */
function filterAvailableSlots(slots: Slot[]): Slot[] {
  const now = new Date();
  const cutoff = new Date();
  cutoff.setMonth(cutoff.getMonth() + MAX_MONTHS_AHEAD);
  cutoff.setHours(23, 59, 59, 999); // include the full last day

  return slots.filter((slot) => {
    const start = new Date(slot.startTime);
    const isAvailable = !slot.status || slot.status === 'available';
    return isAvailable && start > now && start <= cutoff;
  });
}

// ─── Sub-components ──────────────────────────────────────────────────────────

interface ExistingEngagementBannerProps {
  engagement: Engagement;
  isActioning: boolean;
  onComplete: () => void;
  onCancel: () => void;
}

function ExistingEngagementBanner({
  engagement,
  isActioning,
  onComplete,
  onCancel,
}: ExistingEngagementBannerProps) {
  const isScheduled = engagement.status === ENGAGEMENT_STATUS.SCHEDULED;

  const location =
    engagement.type === 'virtual'
      ? 'Virtual'
      : engagement.meetingRoom === 'Other'
      ? engagement.manualLocation
      : engagement.meetingRoom;

  return (
    <div className="rounded-xl border border-[var(--border)] bg-amber-50 p-5 shadow-sm">
      {/* Header */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <svg
            className="h-5 w-5 shrink-0 text-amber-600"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <h2 className="text-sm font-semibold text-amber-800">
            An engagement already exists for this request
          </h2>
        </div>
        <span
          className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold ${
            STATUS_STYLES[engagement.status]
          }`}
        >
          {STATUS_LABELS[engagement.status]}
        </span>
      </div>

      {/* Engagement details */}
      <div className="mb-5 grid gap-x-6 gap-y-2 rounded-lg bg-white p-4 text-sm sm:grid-cols-2 lg:grid-cols-3">
        <Detail label="Engagement #" value={engagement.engagementNumber} />
        <Detail label="Name" value={engagement.name} />
        <Detail label="Type" value={engagement.type === 'virtual' ? 'Virtual' : 'In-Person'} />
        <Detail label="Date & Time" value={formatDateTime(engagement.slot.startTime)} />
        <Detail
          label="Duration"
          value={`${getDurationMinutes(engagement.slot.startTime, engagement.slot.endTime)} minutes`}
        />
        {location && <Detail label="Location" value={location} />}
        {engagement.notes && (
          <Detail label="Notes" value={engagement.notes} className="sm:col-span-2 lg:col-span-3" />
        )}
      </div>

      {/* Actions — only shown when engagement is Scheduled */}
      {isScheduled && (
        <div className="flex flex-wrap items-center gap-3">
          <Button
            type="button"
            variant="primary"
            size="sm"
            onClick={onComplete}
            disabled={isActioning}
          >
            {isActioning ? 'Updating…' : '✓ Mark as Completed'}
          </Button>
          <Button
            type="button"
            variant="danger"
            size="sm"
            onClick={onCancel}
            disabled={isActioning}
          >
            {isActioning ? 'Updating…' : '✕ Cancel Engagement'}
          </Button>
        </div>
      )}
    </div>
  );
}

interface DetailProps {
  label: string;
  value: string;
  className?: string;
}

function Detail({ label, value, className = '' }: DetailProps) {
  return (
    <div className={className}>
      <dt className="text-xs font-medium text-[var(--text-muted)]">{label}</dt>
      <dd className="mt-0.5 text-sm text-[var(--text)]">{value}</dd>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function BookEngagementPage() {
  const router = useRouter();
  const params = useParams();
  const requestId = params.id as string;

  // ── Data state
  const [slots, setSlots] = useState<Slot[]>([]);
  const [bookingMeta, setBookingMeta] = useState<BookingMeta | null>(null);

  // ── Form state
  const [engagementName, setEngagementName] = useState('');
  const [selectedSlotId, setSelectedSlotId] = useState('');
  const [selectedMonth, setSelectedMonth] = useState('');
  const [engagementType, setEngagementType] = useState<'virtual' | 'in_person'>('virtual');
  const [meetingRoom, setMeetingRoom] = useState('');
  const [manualLocation, setManualLocation] = useState('');
  const [notes, setNotes] = useState('');

  // ── UI state
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isActioning, setIsActioning] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  // ─── Derived state ──────────────────────────────────────────────────────────

  const existingEngagement = bookingMeta?.existingEngagement ?? null;

  /**
   * Determine whether the booking form should be shown.
   *
   * Rules:
   *  - No existing engagement → show form
   *  - Existing engagement is Cancelled → show form (user can rebook with same number)
   *  - Existing engagement is Completed → show form (user can create a new one with next number)
   *  - Existing engagement is Scheduled → hide form (must cancel/complete first)
   */
  const canCreateNewEngagement =
    !existingEngagement ||
    existingEngagement.status === ENGAGEMENT_STATUS.CANCELLED ||
    existingEngagement.status === ENGAGEMENT_STATUS.COMPLETED;

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

  // ─── Data fetching ──────────────────────────────────────────────────────────

  const fetchInitialData = useCallback(async () => {
    setIsLoading(true);
    setError('');
    try {
      const [slotsRes, metaRes] = await Promise.all([
        fetch('/api/admin/engagement-slots'),
        fetch(`/api/requests/${requestId}/book-engagement`),
      ]);

      if (!metaRes.ok) {
        const data = await metaRes.json();
        throw new Error(data.error || 'Failed to fetch request details');
      }

      const meta: BookingMeta = await metaRes.json();
      setBookingMeta(meta);

      if (!slotsRes.ok) throw new Error('Failed to fetch slots');

      const allSlots: Slot[] = await slotsRes.json();
      const available = filterAvailableSlots(allSlots);
      setSlots(available);

      if (available.length > 0) {
        setSelectedMonth(getMonthKey(available[0].startTime));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load page data');
    } finally {
      setIsLoading(false);
    }
  }, [requestId]);

  useEffect(() => {
    fetchInitialData();
  }, [fetchInitialData]);

  // ─── Engagement actions ─────────────────────────────────────────────────────

  const updateEngagementStatus = useCallback(
    async (status: number, label: string) => {
      if (!existingEngagement) return;
      setIsActioning(true);
      setError('');
      setSuccessMessage('');

      try {
        const res = await fetch(
          `/api/requests/${requestId}/engagements/${existingEngagement.id}/status`,
          {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status }),
          },
        );

        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || `Failed to ${label.toLowerCase()} engagement`);
        }

        setSuccessMessage(`Engagement ${label.toLowerCase()} successfully.`);
        // Refresh page data so the banner & form reflect the new state
        await fetchInitialData();
      } catch (err) {
        setError(err instanceof Error ? err.message : `Failed to ${label.toLowerCase()} engagement`);
      } finally {
        setIsActioning(false);
      }
    },
    [existingEngagement, requestId, fetchInitialData],
  );

  const handleComplete = () => updateEngagementStatus(ENGAGEMENT_STATUS.COMPLETED, 'Completed');
  const handleCancel = () => updateEngagementStatus(ENGAGEMENT_STATUS.CANCELLED, 'Cancelled');

  // ─── Form submission ────────────────────────────────────────────────────────

  const validateForm = (): string | null => {
    if (!engagementName.trim()) return 'Please enter an engagement name.';
    if (!selectedSlotId) return 'Please select a time slot.';
    if (engagementType === 'in_person') {
      const hasLocation = meetingRoom === 'Other' ? manualLocation.trim() : meetingRoom;
      if (!hasLocation) return 'Please select or enter a meeting location.';
    }
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMessage('');

    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/requests/${requestId}/book-engagement`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slotId: selectedSlotId,
          name: engagementName,
          type: engagementType,
          meetingRoom: engagementType === 'in_person' ? meetingRoom : undefined,
          manualLocation: engagementType === 'in_person' && meetingRoom === 'Other'
            ? manualLocation
            : undefined,
          notes: notes.trim() || null,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to book engagement');
      }

      router.push(`/requests/${requestId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to book engagement');
    } finally {
      setIsSubmitting(false);
    }
  };

  // ─── Render ─────────────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="space-y-6">
        <header className="page-header">
          <h1 className="page-title">Book Engagement</h1>
        </header>
        <div className="surface-card flex items-center justify-center gap-3 p-8 text-sm text-[var(--text-muted)]">
          <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
          </svg>
          Loading engagement details…
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ── Page Header ── */}
      <header className="page-header sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-3">
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

        <div className="flex flex-wrap items-center gap-3">
          {bookingMeta?.request.requestNo && (
            <span className="text-sm text-[var(--text-muted)]">
              Request:{' '}
              <span className="font-medium text-[var(--text)]">
                {bookingMeta.request.requestNo}
              </span>
            </span>
          )}
          <Button href={`/requests/${requestId}`} variant="secondary" size="sm">
            Back to request
          </Button>
        </div>
      </header>

      {/* ── Global feedback ── */}
      {successMessage && (
        <div className="flex items-center gap-2 rounded-lg bg-green-50 p-4 text-sm text-green-700">
          <svg className="h-4 w-4 shrink-0" fill="currentColor" viewBox="0 0 20 20">
            <path
              fillRule="evenodd"
              d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
              clipRule="evenodd"
            />
          </svg>
          {successMessage}
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 rounded-lg bg-red-50 p-4 text-sm text-red-700">
          <svg className="h-4 w-4 shrink-0" fill="currentColor" viewBox="0 0 20 20">
            <path
              fillRule="evenodd"
              d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
              clipRule="evenodd"
            />
          </svg>
          {error}
        </div>
      )}

      {/* ── Existing engagement banner ── */}
      {existingEngagement && (
        <ExistingEngagementBanner
          engagement={existingEngagement}
          isActioning={isActioning}
          onComplete={handleComplete}
          onCancel={handleCancel}
        />
      )}

      {/* ── Booking form ── */}
      {canCreateNewEngagement && (
        <section className="surface-card p-5">
          {/* Contextual heading when rebooking after completion */}
          {existingEngagement?.status === ENGAGEMENT_STATUS.COMPLETED && (
            <div className="mb-5 rounded-lg bg-blue-50 p-3 text-sm text-blue-700">
              The previous engagement was completed. You can schedule a new engagement below — it
              will be assigned number{' '}
              <strong>{bookingMeta?.nextEngagementNumber}</strong>.
            </div>
          )}

          {existingEngagement?.status === ENGAGEMENT_STATUS.CANCELLED && (
            <div className="mb-5 rounded-lg bg-gray-50 p-3 text-sm text-gray-600">
              The previous engagement was cancelled. You can reschedule below — it will reuse
              number <strong>{bookingMeta?.nextEngagementNumber}</strong>.
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6" noValidate>
            {/* Engagement Name */}
            <div>
              <label
                htmlFor="engagementName"
                className="mb-2 block text-sm font-medium text-[var(--text)]"
              >
                Engagement Name <span className="text-red-600">*</span>
              </label>
              <input
                id="engagementName"
                type="text"
                value={engagementName}
                onChange={(e) => setEngagementName(e.target.value)}
                className="w-full rounded-lg border border-[var(--border)] bg-white p-3 text-sm text-[var(--text)] focus:border-[var(--brand-500)] focus:outline-none focus:ring-2 focus:ring-[var(--brand-100)] disabled:opacity-60"
                disabled={isSubmitting}
                required
              />
            </div>

            {/* Month selector */}
            <div>
              <label
                htmlFor="month"
                className="mb-2 block text-sm font-medium text-[var(--text)]"
              >
                Filter by Month <span className="text-red-600">*</span>
              </label>
              {monthOptions.length === 0 ? (
                <div className="rounded-lg bg-yellow-50 p-4 text-sm text-yellow-700">
                  No available slots in the next {MAX_MONTHS_AHEAD} months.
                </div>
              ) : (
                <select
                  id="month"
                  value={selectedMonth}
                  onChange={(e) => {
                    setSelectedMonth(e.target.value);
                    setSelectedSlotId('');
                  }}
                  className="w-full rounded-lg border border-[var(--border)] bg-white p-3 text-sm text-[var(--text)] focus:border-[var(--brand-500)] focus:outline-none focus:ring-2 focus:ring-[var(--brand-100)] disabled:opacity-60"
                  disabled={isSubmitting}
                >
                  {monthOptions.map(([monthKey, count]) => (
                    <option key={monthKey} value={monthKey}>
                      {formatMonthLabel(monthKey)} ({count} slot{count !== 1 ? 's' : ''} available)
                    </option>
                  ))}
                </select>
              )}
            </div>

            {/* Slot picker */}
            {monthOptions.length > 0 && (
              <div>
                <label className="mb-3 block text-sm font-medium text-[var(--text)]">
                  Available Time Slots <span className="text-red-600">*</span>{' '}
                  <span className="font-normal text-[var(--text-muted)]">
                    ({visibleSlots.length} available)
                  </span>
                </label>

                {visibleSlots.length > 0 ? (
                  <div className="rounded-lg border border-[var(--border)] bg-gray-50 p-4">
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                      {visibleSlots.map((slot) => {
                        const selected = selectedSlotId === slot.id;
                        return (
                          <label
                            key={slot.id}
                            className={`cursor-pointer rounded-lg border bg-white p-4 shadow-sm transition-all ${
                              selected
                                ? 'border-[var(--brand-600)] ring-2 ring-[var(--brand-200)]'
                                : 'border-[var(--border)] hover:border-[var(--brand-300)] hover:shadow-md'
                            } ${isSubmitting ? 'pointer-events-none opacity-60' : ''}`}
                          >
                            <div className="flex items-start gap-3">
                              <input
                                type="radio"
                                name="slot"
                                value={slot.id}
                                checked={selected}
                                onChange={(e) => setSelectedSlotId(e.target.value)}
                                disabled={isSubmitting}
                                className="mt-1 h-4 w-4 cursor-pointer accent-[var(--brand-600)]"
                              />
                              <div className="mt-1 text-sm">
                                <div className="font-semibold text-[var(--text)]">
                                  {formatSlotDate(slot.startTime)}
                                </div>
                                <div className="mt-1 font-medium text-[var(--text)]">
                                  {formatSlotTime(slot.startTime)} –{' '}
                                  {formatSlotTime(slot.endTime)}
                                </div>
                                <div className="mt-1 text-xs text-[var(--text-muted)]">
                                  {getDurationMinutes(slot.startTime, slot.endTime)} min
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
            )}

            {/* Engagement type */}
            <div>
              <label className="mb-3 block text-sm font-medium text-[var(--text)]">
                Engagement Type <span className="text-red-600">*</span>
              </label>
              <div className="flex flex-wrap gap-6 text-sm text-[var(--text)]">
                {(['virtual', 'in_person'] as const).map((type) => (
                  <label key={type} className="flex cursor-pointer items-center gap-2">
                    <input
                      type="radio"
                      name="engagementType"
                      value={type}
                      checked={engagementType === type}
                      onChange={() => {
                        setEngagementType(type);
                        setMeetingRoom('');
                        setManualLocation('');
                      }}
                      disabled={isSubmitting}
                      className="accent-[var(--brand-600)]"
                    />
                    {type === 'virtual' ? 'Virtual' : 'In-Person'}
                  </label>
                ))}
              </div>
            </div>

            {/* Location (in-person only) */}
            {engagementType === 'in_person' && (
              <div className="space-y-4">
                <div>
                  <label
                    htmlFor="meetingRoom"
                    className="mb-2 block text-sm font-medium text-[var(--text)]"
                  >
                    Meeting Location <span className="text-red-600">*</span>
                  </label>
                  <select
                    id="meetingRoom"
                    value={meetingRoom}
                    onChange={(e) => {
                      setMeetingRoom(e.target.value);
                      setManualLocation('');
                    }}
                    className="w-full rounded-lg border border-[var(--border)] bg-white p-3 text-sm text-[var(--text)] focus:border-[var(--brand-500)] focus:outline-none focus:ring-2 focus:ring-[var(--brand-100)] disabled:opacity-60"
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
                    <label
                      htmlFor="manualLocation"
                      className="mb-2 block text-sm font-medium text-[var(--text)]"
                    >
                      Enter Location <span className="text-red-600">*</span>
                    </label>
                    <input
                      id="manualLocation"
                      type="text"
                      value={manualLocation}
                      onChange={(e) => setManualLocation(e.target.value)}
                      placeholder="Enter meeting location"
                      className="w-full rounded-lg border border-[var(--border)] bg-white p-3 text-sm text-[var(--text)] placeholder:text-[var(--text-muted)] focus:border-[var(--brand-500)] focus:outline-none focus:ring-2 focus:ring-[var(--brand-100)] disabled:opacity-60"
                      disabled={isSubmitting}
                      required
                    />
                  </div>
                )}
              </div>
            )}

            {/* Notes */}
            <div>
              <label
                htmlFor="notes"
                className="mb-2 block text-sm font-medium text-[var(--text)]"
              >
                Additional Notes{' '}
                <span className="font-normal text-[var(--text-muted)]">(Optional)</span>
              </label>
              <textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Add any additional notes for the engagement…"
                className="w-full rounded-lg border border-[var(--border)] bg-white p-3 text-sm text-[var(--text)] placeholder:text-[var(--text-muted)] focus:border-[var(--brand-500)] focus:outline-none focus:ring-2 focus:ring-[var(--brand-100)] disabled:opacity-60"
                rows={4}
                disabled={isSubmitting}
              />
            </div>

            {/* Form actions */}
            <div className="flex justify-end gap-2 border-t border-[var(--border)] pt-4">
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
                disabled={isSubmitting || slots.length === 0}
              >
                {isSubmitting ? 'Booking…' : 'Book Engagement'}
              </Button>
            </div>
          </form>
        </section>
      )}

      {/* Fallback when engagement is scheduled and form is locked */}
      {!canCreateNewEngagement && (
        <div className="surface-card p-5 text-center text-sm text-[var(--text-muted)]">
          Complete or cancel the existing engagement above before scheduling a new one.
        </div>
      )}
    </div>
  );
}