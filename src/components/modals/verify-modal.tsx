'use client';

import { useState } from 'react';
import Button from '@/src/components/ui/button';

const DECISION_CODES = [
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'resubmit', label: 'Need Resubmission' },
] as const;

interface VerifyModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: { comment: string; decisionCode: string }) => Promise<void>;
  isLoading?: boolean;
}

export default function VerifyModal({
  isOpen,
  onClose,
  onSubmit,
  isLoading = false,
}: VerifyModalProps) {
  const [comment, setComment] = useState('');
  const [decisionCode, setDecisionCode] = useState<string>('approved');
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!comment.trim()) {
      setError('Please enter a comment');
      return;
    }

    try {
      await onSubmit({ comment, decisionCode });
      setComment('');
      setDecisionCode('approved');
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit verification');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-2xl rounded-lg bg-white p-6 shadow-lg">
        <h2 className="mb-4 text-2xl font-bold text-[var(--text)]">Verify Request Data</h2>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="comment" className="mb-2 block text-sm font-medium text-[var(--text)]">
              Verification Comment
            </label>
            <textarea
              id="comment"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Enter your verification comments..."
              className="w-full rounded-lg border border-[var(--border)] bg-white p-3 text-sm text-[var(--text)] placeholder:text-[var(--text-muted)] focus:border-[var(--brand-500)] focus:outline-none focus:ring-2 focus:ring-[var(--brand-100)]"
              rows={5}
              disabled={isLoading}
            />
          </div>

          <div>
            <label className="mb-3 block text-sm font-medium text-[var(--text)]">Decision Code</label>
            <div className="space-y-2">
              {DECISION_CODES.map(({ value, label }) => (
                <label key={value} className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="decisionCode"
                    value={value}
                    checked={decisionCode === value}
                    onChange={(e) => setDecisionCode(e.target.value)}
                    disabled={isLoading}
                    className="h-4 w-4 cursor-pointer"
                  />
                  <span className="text-sm text-[var(--text)]">{label}</span>
                </label>
              ))}
            </div>
          </div>

          {error && (
            <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div>
          )}

          <div className="flex justify-end gap-2 pt-4">
            <Button
              type="button"
              variant="secondary"
              onClick={onClose}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              disabled={isLoading}
            >
              {isLoading ? 'Submitting...' : 'Submit Verification'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
