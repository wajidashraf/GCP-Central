'use client';

import Button from '@/src/components/ui/button';

interface ReviewerSuggestionType {
  id: string;
  reviewerName?: string | null;
  suggestion: string;
  createdAt: string | Date;
}

interface ReviewerSuggestionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  suggestions: ReviewerSuggestionType[];
}

export default function ReviewerSuggestionsModal({
  isOpen,
  onClose,
  suggestions,
}: ReviewerSuggestionsModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-3xl rounded-lg bg-white p-6 shadow-lg">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-bold text-[var(--text)]">Reviewer Notifications</h2>
          <span className="rounded-full bg-[var(--brand-100)] px-3 py-1 text-xs font-semibold text-[var(--brand-700)]">
            {suggestions.length} suggestion{suggestions.length === 1 ? '' : 's'}
          </span>
        </div>

        <div className="max-h-[60vh] space-y-3 overflow-y-auto pr-1">
          {suggestions.map((item, index) => (
            <details key={item.id} className="rounded-lg border border-[var(--border)] bg-white">
              <summary className="cursor-pointer list-none px-4 py-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-sm font-semibold text-[var(--text)]">
                    {index + 1}. {item.reviewerName || 'Reviewer'}
                  </span>
                  <span className="text-xs text-[var(--text-muted)]">
                    {new Date(item.createdAt).toLocaleString()}
                  </span>
                </div>
              </summary>
              <div className="border-t border-[var(--border)] px-4 py-3">
                <p className="whitespace-pre-wrap text-sm text-[var(--text)]">{item.suggestion}</p>
              </div>
            </details>
          ))}
        </div>

        <div className="mt-5 flex justify-end">
          <Button type="button" variant="secondary" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </div>
  );
}
