'use client';

import { useEffect, useState } from 'react';
import Button from '@/src/components/ui/button';

interface Slot {
  id: string;
  slotName: string;
  startTime: Date;
  endTime: Date;
  attendees: string[];
  createdAt: Date;
}

interface Reviewer {
  id: string;
  name: string;
  email: string;
}

const DURATION_OPTIONS = [
  { value: '15', label: '15 mins', minutes: 15 },
  { value: '30', label: '30 mins', minutes: 30 },
  { value: '45', label: '45 mins', minutes: 45 },
  { value: '60', label: '60 mins', minutes: 60 },
  { value: '90', label: '1.5 hours', minutes: 90 },
  { value: 'custom', label: 'Custom', minutes: null },
] as const;

type DurationOptionValue = (typeof DURATION_OPTIONS)[number]['value'];

function toLocalDateTimeInputValue(date: Date) {
  const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return localDate.toISOString().slice(0, 16);
}

function addMinutesToDateTime(dateTimeValue: string, minutes: number) {
  const startDate = new Date(dateTimeValue);
  if (Number.isNaN(startDate.getTime())) {
    return '';
  }

  const endDate = new Date(startDate.getTime() + minutes * 60_000);
  return toLocalDateTimeInputValue(endDate);
}

export default function EngagementSlotsPage() {
  const [slots, setSlots] = useState<Slot[]>([]);
  const [reviewers, setReviewers] = useState<Reviewer[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [durationPreset, setDurationPreset] = useState<DurationOptionValue>('30');
  const [customDurationMinutes, setCustomDurationMinutes] = useState('30');
  const [formData, setFormData] = useState({
    slotName: '',
    startTime: '',
    endTime: '',
    attendees: [] as string[],
  });

  useEffect(() => {
    fetchSlots();
    fetchReviewers();
  }, []);

  const fetchSlots = async () => {
    try {
      const response = await fetch('/api/admin/engagement-slots');
      if (response.ok) {
        const data = await response.json();
        setSlots(data);
      }
    } catch (error) {
      console.error('Error fetching slots:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchReviewers = async () => {
    try {
      const response = await fetch('/api/admin/reviewers');
      if (response.ok) {
        const data = await response.json();
        setReviewers(data);
      }
    } catch (error) {
      console.error('Error fetching reviewers:', error);
    }
  };

  const applyDuration = (startTime: string, preset: DurationOptionValue, customMinutes: string) => {
    if (!startTime) {
      return '';
    }

    const matchedOption = DURATION_OPTIONS.find((option) => option.value === preset);
    if (!matchedOption) {
      return '';
    }

    if (matchedOption.value !== 'custom') {
      return addMinutesToDateTime(startTime, matchedOption.minutes ?? 0);
    }

    const parsedCustomMinutes = Number(customMinutes);
    if (!Number.isFinite(parsedCustomMinutes) || parsedCustomMinutes <= 0) {
      return '';
    }

    return addMinutesToDateTime(startTime, parsedCustomMinutes);
  };

  const handleStartTimeChange = (startTime: string) => {
    setFormData((prev) => ({
      ...prev,
      startTime,
      endTime: applyDuration(startTime, durationPreset, customDurationMinutes),
    }));
  };

  const handleDurationPresetChange = (nextPreset: DurationOptionValue) => {
    setDurationPreset(nextPreset);
    setFormData((prev) => ({
      ...prev,
      endTime: applyDuration(prev.startTime, nextPreset, customDurationMinutes),
    }));
  };

  const handleCustomDurationChange = (value: string) => {
    setCustomDurationMinutes(value);
    setFormData((prev) => ({
      ...prev,
      endTime: applyDuration(prev.startTime, durationPreset, value),
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (formData.attendees.length < 1) {
      setErrorMessage('Please select at least one reviewer attendee.');
      return;
    }

    if (!formData.startTime || !formData.endTime) {
      setErrorMessage('Please select start date-time and duration.');
      return;
    }

    const startDate = new Date(formData.startTime);
    const endDate = new Date(formData.endTime);
    if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime()) || endDate <= startDate) {
      setErrorMessage('End date-time must be later than start date-time.');
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch('/api/admin/engagement-slots', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slotName: formData.slotName.trim(),
          startTime: formData.startTime,
          endTime: formData.endTime,
          attendees: formData.attendees,
        }),
      });

      if (response.ok) {
        setFormData({ slotName: '', startTime: '', endTime: '', attendees: [] });
        setDurationPreset('30');
        setCustomDurationMinutes('30');
        setErrorMessage(null);
        setIsModalOpen(false);
        fetchSlots();
      } else {
        const responseData = (await response.json().catch(() => null)) as { error?: string } | null;
        setErrorMessage(responseData?.error ?? 'Error creating slot.');
      }
    } catch (error) {
      console.error('Error creating slot:', error);
      setErrorMessage('Error creating slot.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAttendeeToggle = (reviewerId: string) => {
    setFormData(prev => ({
      ...prev,
      attendees: prev.attendees.includes(reviewerId)
        ? prev.attendees.filter(id => id !== reviewerId)
        : [...prev.attendees, reviewerId],
    }));
  };

  return (
    <div className="space-y-6">
      <Button href={`/admin`} variant="secondary" size="sm">
            Back
          </Button>
      <header className="page-header sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="page-title">Engagement Slots</h1>
          <p className="page-subtitle">Create and manage engagement slots for request reviews</p>
        </div>
        <Button
          onClick={() => {
            setErrorMessage(null);
            setIsModalOpen(true);
          }}
          variant="primary"
          size="sm"
        >
          + Create Slot
        </Button>
      </header>

      <section className="surface-card p-5">
        {isLoading ? (
          <p className="text-center text-[var(--text-muted)]">Loading slots...</p>
        ) : slots.length > 0 ? (
          <div className="table-shell">
            <table>
              <thead>
                <tr>
                  <th>Slot Name</th>
                  <th>Start Time</th>
                  <th>End Time</th>
                  <th>Attendees</th>
                  <th>Created</th>
                </tr>
              </thead>
              <tbody>
                {slots.map(slot => (
                  <tr key={slot.id}>
                    <td>{slot.slotName}</td>
                    <td>{new Date(slot.startTime).toLocaleString()}</td>
                    <td>{new Date(slot.endTime).toLocaleString()}</td>
                    <td>{slot.attendees.length} reviewers</td>
                    <td>{new Date(slot.createdAt).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-center text-[var(--text-muted)]">No slots created yet</p>
        )}
      </section>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-2xl rounded-lg bg-white p-6 shadow-lg">
            <h2 className="mb-4 text-2xl font-bold text-[var(--text)]">Create Engagement Slot</h2>
            
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="slotName" className="mb-2 block text-sm font-medium text-[var(--text)]">
                  Slot Name
                </label>
                <input
                  id="slotName"
                  type="text"
                  value={formData.slotName}
                  onChange={e => setFormData(prev => ({ ...prev, slotName: e.target.value }))}
                  placeholder="e.g., Meeting A - Jan 15"
                  className="w-full rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-sm text-[var(--text)] placeholder:text-[var(--text-muted)] focus:border-[var(--brand-500)] focus:outline-none focus:ring-2 focus:ring-[var(--brand-100)]"
                  disabled={isSubmitting}
                  required
                />
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <label htmlFor="startTime" className="mb-2 block text-sm font-medium text-[var(--text)]">
                    Start Date & Time
                  </label>
                  <input
                    id="startTime"
                    type="datetime-local"
                    value={formData.startTime}
                    onChange={e => handleStartTimeChange(e.target.value)}
                    className="w-full rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-sm text-[var(--text)] focus:border-[var(--brand-500)] focus:outline-none focus:ring-2 focus:ring-[var(--brand-100)]"
                    disabled={isSubmitting}
                    required
                  />
                </div>

                <div>
                  <label htmlFor="duration" className="mb-2 block text-sm font-medium text-[var(--text)]">
                    Duration
                  </label>
                  <select
                    id="duration"
                    value={durationPreset}
                    onChange={(e) => handleDurationPresetChange(e.target.value as DurationOptionValue)}
                    className="w-full rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-sm text-[var(--text)] focus:border-[var(--brand-500)] focus:outline-none focus:ring-2 focus:ring-[var(--brand-100)]"
                    disabled={isSubmitting}
                  >
                    {DURATION_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {durationPreset === 'custom' ? (
                <div>
                  <label htmlFor="customDurationMinutes" className="mb-2 block text-sm font-medium text-[var(--text)]">
                    Custom Duration (minutes)
                  </label>
                  <input
                    id="customDurationMinutes"
                    type="number"
                    min={1}
                    step={1}
                    value={customDurationMinutes}
                    onChange={(e) => handleCustomDurationChange(e.target.value)}
                    className="w-full rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-sm text-[var(--text)] focus:border-[var(--brand-500)] focus:outline-none focus:ring-2 focus:ring-[var(--brand-100)]"
                    disabled={isSubmitting}
                    required
                  />
                </div>
              ) : null}

              <div>
                <label htmlFor="endTime" className="mb-2 block text-sm font-medium text-[var(--text)]">
                  End Date & Time (auto)
                </label>
                <input
                  id="endTime"
                  type="datetime-local"
                  value={formData.endTime}
                  className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] px-3 py-2 text-sm text-[var(--text)]"
                  disabled
                  required
                />
                <p className="mt-1 text-xs text-[var(--text-subtle)]">
                  Auto-calculated from selected start date-time and duration.
                </p>
              </div>

              {errorMessage ? (
                <div className="alert alert--danger">
                  <p className="alert__title">Unable to create slot</p>
                  <p className="alert__body">{errorMessage}</p>
                </div>
              ) : null}

              <div>
                <label className="mb-3 block text-sm font-medium text-[var(--text)]">
                  Select Reviewers (Attendees)
                </label>
                <div className="max-h-48 space-y-2 overflow-y-auto rounded-lg border border-[var(--border)] bg-white p-3">
                  {reviewers.length > 0 ? (
                    reviewers.map(reviewer => (
                      <label key={reviewer.id} className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={formData.attendees.includes(reviewer.id)}
                          onChange={() => handleAttendeeToggle(reviewer.id)}
                          disabled={isSubmitting}
                          className="h-4 w-4 cursor-pointer"
                        />
                        <span className="text-sm text-[var(--text)]">
                          {reviewer.name} ({reviewer.email})
                        </span>
                      </label>
                    ))
                  ) : (
                    <p className="text-sm text-[var(--text-muted)]">No reviewers available</p>
                  )}
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => {
                    setErrorMessage(null);
                    setIsModalOpen(false);
                  }}
                  disabled={isSubmitting}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? 'Creating...' : 'Create Slot'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
