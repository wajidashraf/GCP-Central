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

export default function EngagementSlotsPage() {
  const [slots, setSlots] = useState<Slot[]>([]);
  const [reviewers, setReviewers] = useState<Reviewer[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const response = await fetch('/api/admin/engagement-slots', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slotName: formData.slotName,
          startTime: new Date(formData.startTime),
          endTime: new Date(formData.endTime),
          attendees: formData.attendees,
        }),
      });

      if (response.ok) {
        setFormData({ slotName: '', startTime: '', endTime: '', attendees: [] });
        setIsModalOpen(false);
        fetchSlots();
      } else {
        alert('Error creating slot');
      }
    } catch (error) {
      console.error('Error creating slot:', error);
      alert('Error creating slot');
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
      <header className="page-header sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="page-title">Engagement Slots</h1>
          <p className="page-subtitle">Create and manage engagement slots for request reviews</p>
        </div>
        <Button
          onClick={() => setIsModalOpen(true)}
          variant="primary"
          size="sm"
        >
          + Create Slot
        </Button>
      </header>

      <section className="surface-card p-5">
        {slots.length > 0 ? (
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

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="startTime" className="mb-2 block text-sm font-medium text-[var(--text)]">
                    Start Time
                  </label>
                  <input
                    id="startTime"
                    type="datetime-local"
                    value={formData.startTime}
                    onChange={e => setFormData(prev => ({ ...prev, startTime: e.target.value }))}
                    className="w-full rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-sm text-[var(--text)] focus:border-[var(--brand-500)] focus:outline-none focus:ring-2 focus:ring-[var(--brand-100)]"
                    disabled={isSubmitting}
                    required
                  />
                </div>

                <div>
                  <label htmlFor="endTime" className="mb-2 block text-sm font-medium text-[var(--text)]">
                    End Time
                  </label>
                  <input
                    id="endTime"
                    type="datetime-local"
                    value={formData.endTime}
                    onChange={e => setFormData(prev => ({ ...prev, endTime: e.target.value }))}
                    className="w-full rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-sm text-[var(--text)] focus:border-[var(--brand-500)] focus:outline-none focus:ring-2 focus:ring-[var(--brand-100)]"
                    disabled={isSubmitting}
                    required
                  />
                </div>
              </div>

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
                  onClick={() => setIsModalOpen(false)}
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
