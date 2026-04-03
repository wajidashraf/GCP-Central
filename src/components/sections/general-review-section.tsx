'use client';

import { useState } from 'react';
import Button from '@/src/components/ui/button';

interface VerifierCommentType {
  id: string;
  comment: string;
  decisionCode: string;
  verifiedBy: string;
  createdAt: string | Date;
}

interface ReviewerSuggestionType {
  id: string;
  suggestion: string;
  action?: string | null;
  createdAt: string | Date;
}

interface GeneralReviewSectionProps {
  verifierComment?: VerifierCommentType | null;
  reviewerSuggestions?: ReviewerSuggestionType[];
  userRole?: string;
  onUpdateSuggestion?: (suggestionId: string, action: string) => Promise<void>;
}

const ACTION_OPTIONS = [
  { value: 'accepted', label: 'Accepted' },
  { value: 'no_need', label: 'No Need' },
  { value: 'pending', label: 'Pending' },
] as const;

export default function GeneralReviewSection({
  verifierComment,
  reviewerSuggestions = [],
  userRole,
  onUpdateSuggestion,
}: GeneralReviewSectionProps) {
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);
  const [updating, setUpdating] = useState<string | null>(null);

  const canManageSuggestions = ['verifier', 'admin'].includes(userRole || '');

  const handleActionSelect = async (suggestionId: string, action: string) => {
    if (!onUpdateSuggestion) return;
    
    setUpdating(suggestionId);
    try {
      await onUpdateSuggestion(suggestionId, action);
      setActiveDropdown(null);
    } finally {
      setUpdating(null);
    }
  };

  if (!verifierComment && reviewerSuggestions.length === 0) {
    return null;
  }

  return (
    <div className="rounded-lg border border-[var(--border)] bg-white p-5">
      <h3 className="mb-4 text-lg font-semibold text-[var(--text)]">General Review</h3>
      
      <div className="space-y-5">
        {/* Verifier Comment Section */}
        {verifierComment && (
          <div className="rounded-lg bg-blue-50 p-4">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-sm font-semibold text-blue-900">Verifier Comment</span>
              <span className="text-xs text-blue-700">
                by {verifierComment.verifiedBy} • {new Date(verifierComment.createdAt).toLocaleDateString()}
              </span>
            </div>
            <p className="whitespace-pre-wrap text-sm text-[var(--text)]">{verifierComment.comment}</p>
            <div className="mt-2 flex items-center gap-2">
              <span className="text-xs font-medium uppercase text-blue-700">Decision:</span>
              <span className={`inline-block rounded px-2 py-1 text-xs font-semibold ${
                verifierComment.decisionCode === 'approved'
                  ? 'bg-green-100 text-green-700'
                  : verifierComment.decisionCode === 'rejected'
                  ? 'bg-red-100 text-red-700'
                  : 'bg-yellow-100 text-yellow-700'
              }`}>
                {verifierComment.decisionCode.charAt(0).toUpperCase() + verifierComment.decisionCode.slice(1)}
              </span>
            </div>
          </div>
        )}

        {/* Reviewer Suggestions Section */}
        {reviewerSuggestions.length > 0 && (
          <div>
            <h4 className="mb-3 text-sm font-semibold text-[var(--text)]">Reviewer Comments</h4>
            <div className="space-y-3">
              {reviewerSuggestions.map((suggestion) => (
                <div key={suggestion.id} className="rounded-lg bg-gray-50 p-4">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-sm font-semibold text-gray-900">Reviewer Suggestion</span>
                    <span className="text-xs text-gray-600">
                      {new Date(suggestion.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                  <p className="mb-3 whitespace-pre-wrap text-sm text-[var(--text)]">{suggestion.suggestion}</p>
                  
                  {canManageSuggestions && (
                    <div className="relative inline-block">
                      <button
                        type="button"
                        onClick={() => setActiveDropdown(activeDropdown === suggestion.id ? null : suggestion.id)}
                        disabled={updating === suggestion.id}
                        className="flex items-center gap-2 rounded-md border border-[var(--border)] bg-white px-3 py-1.5 text-xs font-medium text-[var(--text)] hover:bg-gray-50 disabled:opacity-50"
                      >
                        {suggestion.action || 'Select Action'}
                        <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                        </svg>
                      </button>

                      {activeDropdown === suggestion.id && (
                        <div className="absolute top-full left-0 z-10 mt-1 w-48 rounded-lg border border-[var(--border)] bg-white shadow-lg">
                          {ACTION_OPTIONS.map(({ value, label }) => (
                            <button
                              key={value}
                              type="button"
                              onClick={() => handleActionSelect(suggestion.id, value)}
                              className="w-full px-3 py-2 text-left text-xs hover:bg-gray-100 first:rounded-t-lg last:rounded-b-lg"
                            >
                              {label}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                  {!canManageSuggestions && suggestion.action && (
                    <span className="inline-block rounded px-2 py-1 text-xs font-semibold bg-gray-200 text-gray-700">
                      {suggestion.action}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
