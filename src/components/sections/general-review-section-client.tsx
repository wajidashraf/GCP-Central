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
  sourceRole?: string | null;
  createdAt: string | Date;
}

interface GeneralReviewSectionClientProps {
  verifierComment?: VerifierCommentType | null;
  reviewerDecisionCode?: string | null;
  reviewerSuggestions?: ReviewerSuggestionType[];
  workingGcpcSuggestions?: ReviewerSuggestionType[];
  userRole?: string;
  userRoles?: string[];
  status: string;
}

export default function GeneralReviewSectionClient({
  verifierComment,
  reviewerDecisionCode = null,
  reviewerSuggestions = [],
  workingGcpcSuggestions = [],
  status,
  userRole,
  userRoles = [],
}: GeneralReviewSectionClientProps) {
  return (
    <GeneralReviewSection
      verifierComment={verifierComment}
      reviewerDecisionCode={reviewerDecisionCode}
      reviewerSuggestions={reviewerSuggestions}
      workingGcpcSuggestions={workingGcpcSuggestions}
      userRole={userRole}
      userRoles={userRoles}
      status={status}
    />
  );
}
