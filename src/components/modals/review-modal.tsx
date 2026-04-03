'use client';

import { useState } from 'react';
import Button from '@/src/components/ui/button';

interface ReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: { suggestion: string }) => Promise<void>;
  isLoading?: boolean;
}

export default function ReviewModal({
  isOpen,
  onClose,
  onSubmit,
  isLoading = false,
}: ReviewModalProps) {
  const [suggestion, setSuggestion] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!suggestion.trim()) {
      setError('Please enter a suggestion');
      return;
    }

    try {
      await onSubmit({ suggestion });
      setSuggestion('');
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit suggestion');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-2xl rounded-lg bg-white p-6 shadow-lg">
        <h2 className="mb-4 text-2xl font-bold text-[var(--text)]">Review Request Data</h2>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="suggestion" className="mb-2 block text-sm font-medium text-[var(--text)]">
              Suggestion / Comments
            </label>
            <textarea
              id="suggestion"
              value={suggestion}
              onChange={(e) => setSuggestion(e.target.value)}
              placeholder="Enter your suggestions or comments..."
              className="w-full rounded-lg border border-[var(--border)] bg-white p-3 text-sm text-[var(--text)] placeholder:text-[var(--text-muted)] focus:border-[var(--brand-500)] focus:outline-none focus:ring-2 focus:ring-[var(--brand-100)]"
              rows={5}
              disabled={isLoading}
            />
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
              {isLoading ? 'Submitting...' : 'Submit Suggestion'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
