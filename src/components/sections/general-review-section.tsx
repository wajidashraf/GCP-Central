'use client';

import { useState } from 'react';
import { SectionTitle } from './request-form-shared';
import ReviewerSuggestionsModal from '@/src/components/modals/reviewer-suggestions-modal';

interface VerifierCommentType {
  id: string;
  comment: string;
  decisionCode: string;
  verifiedBy: string;
  createdAt: string | Date;
}

interface ReviewerSuggestionType {
  id: string;
  reviewerName?: string | null;
  suggestion: string;
  action?: string | null;
  createdAt: string | Date;
}

interface GeneralReviewSectionProps {
  verifierComment?: VerifierCommentType | null;
  reviewerSuggestions?: ReviewerSuggestionType[];
  userRole?: string;
  userRoles?: string[];
  status: string;
}

export default function GeneralReviewSection({
  verifierComment,
  reviewerSuggestions = [],
  userRole,
  userRoles = [],
  status,
}: GeneralReviewSectionProps) {
  const [isSuggestionsModalOpen, setIsSuggestionsModalOpen] = useState(false);

  const roleSet = new Set([userRole, ...userRoles].filter(Boolean).map((role) => String(role).toLowerCase()));
  const canSeeSuggestions = roleSet.has('reviewer') || roleSet.has('verifier') || roleSet.has('admin');

  if (!verifierComment && reviewerSuggestions.length === 0) {
    return null;
  }

  return (
    <div>
      <SectionTitle title="General Review" />

      <div className="mt-3 rounded-xl border border-[var(--border)] bg-white p-4">
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

            </div>
          )}

          {/* Reviewer Suggestions Section */}
          {reviewerSuggestions.length > 0 && canSeeSuggestions && status === 'draft review' && (
            <div className="flex justify-end">
               <button
                  type="button"
                  onClick={() => setIsSuggestionsModalOpen(true)}
                  aria-describedby="reviewer-suggestions-tooltip"
                  className="animate-pulse-soft rounded-md border border-[#7A4D00] bg-[#F2CB7A] px-2 py-1 text-xs font-semibold text-[#3D2600] shadow-sm transition-colors duration-200 hover:bg-[#E6AC40]"
                >
                  ({reviewerSuggestions.length}) Reviewer Suggestions
                </button>
            </div>
          )}
        </div>
      </div>

      <ReviewerSuggestionsModal
        isOpen={isSuggestionsModalOpen}
        onClose={() => setIsSuggestionsModalOpen(false)}
        suggestions={reviewerSuggestions}
      />
    </div>
  );
}
