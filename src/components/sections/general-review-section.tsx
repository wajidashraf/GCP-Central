'use client';

import { useState } from 'react';
import { SectionTitle } from './request-form-shared';
import ReviewerSuggestionsModal from '@/src/components/modals/reviewer-suggestions-modal';
import { labelForStoredDecisionCode } from '@/src/constants/verifierDecisionCodes';

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
  sourceRole?: string | null;
  action?: string | null;
  createdAt: string | Date;
}

interface GeneralReviewSectionProps {
  verifierComment?: VerifierCommentType | null;
  reviewerSuggestions?: ReviewerSuggestionType[];
  workingGcpcSuggestions?: ReviewerSuggestionType[];
  userRole?: string;
  userRoles?: string[];
  status: string;
}

export default function GeneralReviewSection({
  verifierComment,
  reviewerSuggestions = [],
  workingGcpcSuggestions = [],
  userRole,
  userRoles = [],
  status,
}: GeneralReviewSectionProps) {
  const [isSuggestionsModalOpen, setIsSuggestionsModalOpen] = useState(false);
  const [isWorkingGcpcSuggestionsModalOpen, setIsWorkingGcpcSuggestionsModalOpen] = useState(false);

  const normalizedStatus = status.trim().toLowerCase();
  const roleSet = new Set([userRole, ...userRoles].filter(Boolean).map((role) => String(role).toLowerCase()));
  const canSeeSuggestions = roleSet.has('reviewer') || roleSet.has('verifier') || roleSet.has('admin');
  const canSeeWorkingGcpcSuggestions = (roleSet.has('working_gcpc') || roleSet.has('verifier')) && normalizedStatus === 'draft review';
  /** Reviewer suggestions are relevant during open review (R) and after verifier marks draft review */
  const showReviewerSuggestionsLink = normalizedStatus === 'r' 

  if (!verifierComment && reviewerSuggestions.length === 0 && workingGcpcSuggestions.length === 0) {
    return null;
  }

  return (
    <div>
      <SectionTitle title="General Review" />

      <div className="mt-3 rounded-xl border border-[var(--border)] bg-white p-4">
        <div className="">
          {/* Verifier Comment Section */}
          {verifierComment && (
            <div className="rounded-lg bg-blue-50 p-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-blue-900">Verifier Comment</span>
                <span className="text-xs text-blue-700">
                  by {verifierComment.verifiedBy} • {new Date(verifierComment.createdAt).toLocaleDateString()}
                </span>
              </div>
              <p className="whitespace-pre-wrap text-sm text-[var(--text)]">{verifierComment.comment}</p>
             
            </div>
          )}

          {/* Reviewer Suggestions Section */}
          <div className="flex flex-wrap justify-end gap-2">
            {reviewerSuggestions.length > 0 && canSeeSuggestions && showReviewerSuggestionsLink && (
              <button
                  type="button"
                  onClick={() => setIsSuggestionsModalOpen(true)}
                  aria-describedby="reviewer-suggestions-tooltip"
                  className="animate-pulse-soft rounded-md border border-[#7A4D00] bg-[#F2CB7A] px-2 py-1 text-xs font-semibold text-[#3D2600] shadow-sm transition-colors duration-200 hover:bg-[#E6AC40]"
                >
                  ({reviewerSuggestions.length}) Reviewer Suggestions
              </button>
            )}

            {workingGcpcSuggestions.length > 0 && canSeeWorkingGcpcSuggestions && (
              <button
                type="button"
                onClick={() => setIsWorkingGcpcSuggestionsModalOpen(true)}
                aria-describedby="working-gcpc-suggestions-tooltip"
                className="animate-pulse-soft rounded-md border border-[#1E40AF] bg-[#DBEAFE] px-2 py-1 text-xs font-semibold text-[#1E3A8A] shadow-sm transition-colors duration-200 hover:bg-[#BFDBFE]"
              >
                ({workingGcpcSuggestions.length}) Working GCPC Suggestions
              </button>
            )}
          </div>
        </div>
      </div>

      <ReviewerSuggestionsModal
        isOpen={isSuggestionsModalOpen}
        onClose={() => setIsSuggestionsModalOpen(false)}
        suggestions={reviewerSuggestions}
      />
      <ReviewerSuggestionsModal
        isOpen={isWorkingGcpcSuggestionsModalOpen}
        onClose={() => setIsWorkingGcpcSuggestionsModalOpen(false)}
        suggestions={workingGcpcSuggestions}
      />
    </div>
  );
}
