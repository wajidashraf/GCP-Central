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
  createdAt: string | Date;
}

interface GeneralReviewSectionClientProps {
  verifierComment?: VerifierCommentType | null;
  reviewerSuggestions?: ReviewerSuggestionType[];
  userRole?: string;
  userRoles?: string[];
  status: string;
}

export default function GeneralReviewSectionClient({
  verifierComment,
  reviewerSuggestions = [],
  status,
  userRole,
  userRoles = [],
}: GeneralReviewSectionClientProps) {
  return (
    <GeneralReviewSection
      verifierComment={verifierComment}
      reviewerSuggestions={reviewerSuggestions}
      userRole={userRole}
      userRoles={userRoles}
      status={status}
    />
  );
}
