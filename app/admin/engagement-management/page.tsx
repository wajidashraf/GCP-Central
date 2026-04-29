'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Button from '@/src/components/ui/button';

interface Reviewer {
  id: string;
  name: string;
  email: string;
}

interface ManagedEngagement {
  id: string;
  engagementNumber: string | null;
  name: string | null;
  type: string | null;
  location: string | null;
  notes: string | null;
  status: string;
  createdAt: string;
  request: {
    id: string;
    requestNo: string;
    requestTitle: string;
    requestorId: string;
    requestorName: string;
    requestorEmail: string;
  };
  slot: {
    id: string;
    slotName: string;
    startTime: string;
    endTime: string;
  };
  createdBy: {
    id: string;
    name: string;
    email: string;
  };
  reviewers: Reviewer[];
}

interface SlotOption {
  id: string;
  slotName: string;
  startTime: string;
  endTime: string;
  status?: string | null;
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export default function EngagementManagementPage() {
  const [engagements, setEngagements] = useState<ManagedEngagement[]>([]);
  const [slots, setSlots] = useState<SlotOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [editingEngagement, setEditingEngagement] = useState<ManagedEngagement | null>(null);
  const [selectedSlotId, setSelectedSlotId] = useState('');

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const [engagementsRes, slotsRes] = await Promise.all([
        fetch('/api/admin/engagement-management'),
        fetch('/api/admin/engagement-slots'),
      ]);

      if (!engagementsRes.ok) {
        const data = await engagementsRes.json().catch(() => null);
        throw new Error(data?.error || 'Failed to load scheduled engagements');
      }
      if (!slotsRes.ok) {
        const data = await slotsRes.json().catch(() => null);
        throw new Error(data?.error || 'Failed to load engagement slots');
      }

      const [engagementsData, slotsData] = await Promise.all([engagementsRes.json(), slotsRes.json()]);
      setEngagements(engagementsData);
      setSlots(slotsData);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Failed to load engagement management');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const visibleSlots = useMemo(() => {
    const now = new Date();
    return slots.filter((slot) => {
      const start = new Date(slot.startTime);
      return start > now && (!slot.status || slot.status === 'available');
    });
  }, [slots]);

  const handleOpenReschedule = (engagement: ManagedEngagement) => {
    setErrorMessage(null);
    setSuccessMessage(null);
    setEditingEngagement(engagement);
    setSelectedSlotId('');
  };

  const handleReschedule = async () => {
    if (!editingEngagement || !selectedSlotId) {
      setErrorMessage('Please select a new slot before updating.');
      return;
    }
    setIsSaving(true);
    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      const response = await fetch(`/api/admin/engagement-management/${editingEngagement.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reschedule', slotId: selectedSlotId }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.error || 'Failed to update engagement schedule');
      }

      setSuccessMessage('Engagement schedule updated. Requestor and reviewers have been notified.');
      setEditingEngagement(null);
      setSelectedSlotId('');
      await fetchData();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Failed to update engagement');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancelEngagement = async (engagement: ManagedEngagement) => {
    const confirmed = window.confirm(
      `Cancel ${engagement.engagementNumber || engagement.name || 'this engagement'}?`
    );
    if (!confirmed) return;

    setIsSaving(true);
    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      const response = await fetch(`/api/admin/engagement-management/${engagement.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'cancel' }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.error || 'Failed to cancel engagement');
      }

      setSuccessMessage('Engagement cancelled and status updated. Notifications were sent by email.');
      await fetchData();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Failed to cancel engagement');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <Button href={`/admin`} variant="secondary" size="sm">
        Back
      </Button>
      <header className="page-header">
        <h1 className="page-title">Engagement Management</h1>
        <p className="page-subtitle">
          View scheduled engagements with creator/reviewer details, update date-time, and cancel when needed.
        </p>
      </header>

      {errorMessage ? (
        <div className="alert alert--danger">
          <p className="alert__title">Action failed</p>
          <p className="alert__body">{errorMessage}</p>
        </div>
      ) : null}

      {successMessage ? (
        <div className="alert alert--success">
          <p className="alert__title">Updated</p>
          <p className="alert__body">{successMessage}</p>
        </div>
      ) : null}

      <section className="surface-card p-5">
        {isLoading ? (
          <p className="text-sm text-[var(--text-muted)]">Loading scheduled engagements...</p>
        ) : engagements.length === 0 ? (
          <p className="text-sm text-[var(--text-muted)]">No scheduled engagements found.</p>
        ) : (
          <div className="space-y-4">
            {engagements.map((engagement) => (
              <article key={engagement.id} className="rounded-lg border border-[var(--border)] p-4">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <h2 className="text-base font-semibold text-[var(--text)]">
                    {engagement.engagementNumber || 'Engagement'} - {engagement.name || 'Untitled'}
                  </h2>
                  <span
                    className={`badge ${
                      engagement.status === 'Re-Schedule' ? 'badge--warning' : 'badge--info'
                    }`}
                  >
                    {engagement.status === 'Re-Schedule' ? 'Re-Schedule' : 'Scheduled'}
                  </span>
                </div>

                <div className="grid gap-3 text-sm md:grid-cols-2 lg:grid-cols-3">
                  <p>
                    <strong>Request:</strong> {engagement.request.requestNo}
                  </p>
                  <p>
                    <strong>Request title:</strong> {engagement.request.requestTitle}
                  </p>
                  <p>
                    <strong>Type:</strong> {engagement.type || 'N/A'}
                  </p>
                  <p>
                    <strong>Date & time:</strong> {formatDateTime(engagement.slot.startTime)}
                  </p>
                  <p>
                    <strong>End:</strong> {formatDateTime(engagement.slot.endTime)}
                  </p>
                  <p>
                    <strong>Location:</strong> {engagement.location || 'Virtual / Not specified'}
                  </p>
                  <p>
                    <strong>Created by:</strong> {engagement.createdBy.name} ({engagement.createdBy.email})
                  </p>
                  <p>
                    <strong>Requestor:</strong> {engagement.request.requestorName} ({engagement.request.requestorEmail})
                  </p>
                  <p>
                    <strong>Reviewers:</strong>{' '}
                    {engagement.reviewers.length
                      ? engagement.reviewers.map((reviewer) => reviewer.name).join(', ')
                      : 'No reviewers assigned'}
                  </p>
                </div>

                {engagement.notes ? (
                  <p className="mt-3 text-sm text-[var(--text-muted)]">
                    <strong>Notes:</strong> {engagement.notes}
                  </p>
                ) : null}

                <div className="mt-4 flex flex-wrap gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => handleOpenReschedule(engagement)}
                    disabled={isSaving}
                  >
                    Update Date / Time
                  </Button>
                  <Button
                    variant="danger"
                    size="sm"
                    onClick={() => handleCancelEngagement(engagement)}
                    disabled={isSaving}
                  >
                    Cancel Engagement
                  </Button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      {editingEngagement ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-2xl rounded-lg bg-white p-6 shadow-lg">
            <h2 className="text-lg font-semibold text-[var(--text)]">Update Engagement Date & Time</h2>
            <p className="mt-1 text-sm text-[var(--text-muted)]">
              {editingEngagement.engagementNumber || editingEngagement.name || 'Engagement'} for{' '}
              {editingEngagement.request.requestNo}
            </p>

            <div className="mt-4 space-y-2">
              <label htmlFor="newSlot" className="block text-sm font-medium text-[var(--text)]">
                Select new slot
              </label>
              <select
                id="newSlot"
                value={selectedSlotId}
                onChange={(event) => setSelectedSlotId(event.target.value)}
                className="w-full rounded-lg border border-[var(--border)] bg-white p-3 text-sm text-[var(--text)] focus:border-[var(--brand-500)] focus:outline-none focus:ring-2 focus:ring-[var(--brand-100)]"
              >
                <option value="">Choose an available future slot</option>
                {visibleSlots
                  .filter((slot) => slot.id !== editingEngagement.slot.id)
                  .map((slot) => (
                    <option key={slot.id} value={slot.id}>
                      {slot.slotName} - {formatDateTime(slot.startTime)}
                    </option>
                  ))}
              </select>
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <Button
                variant="secondary"
                onClick={() => {
                  setEditingEngagement(null);
                  setSelectedSlotId('');
                }}
                disabled={isSaving}
              >
                Close
              </Button>
              <Button variant="primary" onClick={handleReschedule} disabled={isSaving || !selectedSlotId}>
                {isSaving ? 'Updating...' : 'Save New Time'}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
