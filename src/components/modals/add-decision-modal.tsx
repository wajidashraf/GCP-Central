'use client';

import { useEffect, useMemo, useState } from 'react';
import Button from '@/src/components/ui/button';
import { getVerifierDecisionCodesForRequestType } from '@/src/constants/verifierDecisionCodes';

interface AddDecisionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: { comment: string; decisionCode: string }) => Promise<void>;
  requestType: string;
  initialComment?: string | null;
  initialDecisionCode?: string | null;
  isLoading?: boolean;
}

export default function AddDecisionModal({
  isOpen,
  onClose,
  onSubmit,
  requestType,
  initialComment = '',
  initialDecisionCode = '',
  isLoading = false,
}: AddDecisionModalProps) {
  const options = useMemo(
    () => getVerifierDecisionCodesForRequestType(requestType),
    [requestType]
  );

  const [comment, setComment] = useState('');
  const [decisionCode, setDecisionCode] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    setComment(initialComment ?? '');
    const raw = (initialDecisionCode ?? '').trim();
    const validInitial = options.some((o) => o.value === raw) ? raw : '';
    setDecisionCode(validInitial);
    setError('');
  }, [isOpen, initialComment, initialDecisionCode, options]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!decisionCode) {
      setError('Please select a decision code before submitting.');
      return;
    }
    try {
      await onSubmit({ comment: comment.trim(), decisionCode });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit');
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !isLoading) onClose();
      }}
    >
      <div
        className="flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-xl bg-white shadow-xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-decision-title"
      >
        <div className="border-b border-[var(--border)] px-6 py-4">
          <h2 id="add-decision-title" className="text-xl font-bold text-[var(--text)]">
            Add decision
          </h2>
          <p className="mt-1 text-sm text-[var(--text-muted)]">
            Enter your verifier comment and decision code. Submitting will move this request to Pending
            Review.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-6 py-5">
            <div>
              <label htmlFor="verifier-comment" className="mb-2 block text-sm font-medium text-[var(--text)]">
                Verifier comment
              </label>
              <textarea
                id="verifier-comment"
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Add or update your verifier comment…"
                rows={6}
                disabled={isLoading}
                className="w-full rounded-lg border border-[var(--border)] bg-white p-3 text-sm text-[var(--text)] placeholder:text-[var(--text-muted)] focus:border-[var(--brand-500)] focus:outline-none focus:ring-2 focus:ring-[var(--brand-100)]"
              />
            </div>

            <fieldset className="space-y-2">
              <legend className="text-sm font-medium text-[var(--text)]">
                Decision code <span className="text-red-600">*</span>
              </legend>
              <p className="text-xs text-[var(--text-muted)]">
                Select one review decision code. Code W is only shown for applicable request types.
              </p>
              <div className="space-y-2 rounded-lg border border-[var(--border)] bg-[var(--surface-muted)]/40 p-3">
                {options.map((opt) => (
                  <label
                    key={opt.value}
                    className="flex cursor-pointer gap-3 rounded-md border border-transparent p-2 hover:bg-white/80 has-[:checked]:border-[var(--brand-300)] has-[:checked]:bg-white"
                  >
                    <input
                      type="radio"
                      name="decisionCode"
                      value={opt.value}
                      checked={decisionCode === opt.value}
                      onChange={() => setDecisionCode(opt.value)}
                      disabled={isLoading}
                      className="mt-1 h-4 w-4 shrink-0 accent-[var(--brand-600)]"
                    />
                    <span className="text-sm leading-snug text-[var(--text)]">{opt.label}</span>
                  </label>
                ))}
              </div>
            </fieldset>

            {error ? (
              <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700" role="alert">
                {error}
              </div>
            ) : null}
          </div>

          <div className="flex shrink-0 justify-end gap-2 border-t border-[var(--border)] bg-white px-6 py-4">
            <Button type="button" variant="secondary" onClick={onClose} disabled={isLoading}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" disabled={isLoading}>
              {isLoading ? 'Submitting…' : 'Submit'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
