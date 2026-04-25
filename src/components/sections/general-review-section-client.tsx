'use client';

import GeneralReviewSection from './general-review-section';

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

interface GeneralReviewSectionClientProps {
  requestId: string;
  verifierComment?: VerifierCommentType | null;
  reviewerSuggestions?: ReviewerSuggestionType[];
  userRole?: string;
  userRoles?: string[];
}

export default function GeneralReviewSectionClient({
  requestId,
  verifierComment,
  reviewerSuggestions = [],
  userRole,
  userRoles = [],
}: GeneralReviewSectionClientProps) {
  async function handleUpdateSuggestion(suggestionId: string, action: string) {
    try {
      const response = await fetch(`/api/requests/${requestId}/reviewer-suggestion`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ suggestionId, action }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error(payload?.error || 'Failed to update suggestion');
      window.location.reload();
    } catch (error) {
      console.error(error);
      throw error;
    }
  }

  return (
    <GeneralReviewSection
      verifierComment={verifierComment}
      reviewerSuggestions={reviewerSuggestions}
      userRole={userRole}
      userRoles={userRoles}
      onUpdateSuggestion={handleUpdateSuggestion}
    />
  );
}
