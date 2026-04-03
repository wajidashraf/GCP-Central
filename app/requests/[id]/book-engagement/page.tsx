'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Button from '@/src/components/ui/button';

interface Slot {
  id: string;
  slotName: string;
  startTime: string;
  endTime: string;
  attendees: string[];
}

interface SelectedSlot extends Slot {
  reviewerCount: number;
}

export default function BookEngagementPage() {
  const router = useRouter();
  const params = useParams();
  const requestId = params.id as string;

  const [slots, setSlots] = useState<Slot[]>([]);
  const [selectedSlotId, setSelectedSlotId] = useState<string>('');
  const [notes, setNotes] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchSlots();
  }, []);

  const fetchSlots = async () => {
    try {
      const response = await fetch('/api/admin/engagement-slots');
      if (response.ok) {
        const data = await response.json();
        setSlots(data);
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

    setIsSubmitting(true);

    try {
      const response = await fetch(`/api/requests/${requestId}/book-engagement`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slotId: selectedSlotId,
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
          <h1 className="page-title">Book Engagement</h1>
          <p className="page-subtitle">Select a time slot for your engagement meeting</p>
        </div>
        <Button href={`/requests/${requestId}`} variant="secondary" size="sm">
          Back to request
        </Button>
      </header>

      <section className="surface-card p-5">
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="mb-3 block text-sm font-medium text-[var(--text)]">
              Available Slots
            </label>

            {slots.length > 0 ? (
              <div className="space-y-3">
                {slots.map(slot => (
                  <label
                    key={slot.id}
                    className="flex items-start gap-3 rounded-lg border border-[var(--border)] p-4 hover:bg-gray-50"
                  >
                    <input
                      type="radio"
                      name="slot"
                      value={slot.id}
                      checked={selectedSlotId === slot.id}
                      onChange={(e) => setSelectedSlotId(e.target.value)}
                      disabled={isSubmitting}
                      className="h-4 w-4 cursor-pointer mt-1"
                    />
                    <div className="flex-1">
                      <div className="font-semibold text-[var(--text)]">{slot.slotName}</div>
                      <div className="mt-1 text-sm text-[var(--text-muted)]">
                        <div>
                          Start: {new Date(slot.startTime).toLocaleString('en-GB', {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </div>
                        <div>
                          End: {new Date(slot.endTime).toLocaleString('en-GB', {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </div>
                        <div className="mt-1">
                          Reviewers: {slot.attendees.length}
                        </div>
                      </div>
                    </div>
                  </label>
                ))}
              </div>
            ) : (
              <div className="rounded-lg bg-yellow-50 p-4 text-sm text-yellow-700">
                No slots available. Please contact the admin to create slots.
              </div>
            )}
          </div>

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
            <div className="rounded-lg bg-red-50 p-4 text-sm text-red-700">
              {error}
            </div>
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
              disabled={isSubmitting || slots.length === 0}
            >
              {isSubmitting ? 'Booking...' : 'Book Engagement'}
            </Button>
          </div>
        </form>
      </section>
    </div>
  );
}
