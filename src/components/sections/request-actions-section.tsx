'use client';

import { useState } from 'react';
import Button from '@/src/components/ui/button';
import VerifyModal from '@/src/components/modals/verify-modal';
import ReviewModal from '@/src/components/modals/review-modal';
import GeneralReviewSection from '@/src/components/sections/general-review-section';
import { useRouter } from 'next/navigation';

interface RequestActionsSectionProps {
  requestId: string;
  status: string;
  userRole?: string;
  verifierComment?: {
    id: string;
    comment: string;
    decisionCode: string;
    verifiedBy: string;
    createdAt: string | Date;
  } | null;
  reviewerSuggestions?: Array<{
    id: string;
    suggestion: string;
    action?: string | null;
    createdAt: string | Date;
  }>;
  hasEngagementSlots?: boolean;
}

export default function RequestActionsSection({
  requestId,
  status,
  userRole,
  verifierComment,
  reviewerSuggestions = [],
  hasEngagementSlots,
}: RequestActionsSectionProps) {
  const router = useRouter();
  const [verifyModalOpen, setVerifyModalOpen] = useState(false);
  const [reviewModalOpen, setReviewModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const normalizedStatus = status.trim().toLowerCase();
  const canVerify = userRole === 'verifier' && (normalizedStatus === 'new' || normalizedStatus === 'under verification') && !verifierComment;
  const canReview = userRole === 'reviewer' && ['in review', 'pending review', 'draft review'].includes(normalizedStatus);
  const canBookEngagement = userRole === 'requestor' && ['ready for engagement', 'acknowledged', 'scheduled', 'in review'].includes(normalizedStatus) && hasEngagementSlots;

  const handleVerifySubmit = async (data: { comment: string; decisionCode: string }) => {
    setIsSubmitting(true);
    try {
      const response = await fetch(`/api/requests/${requestId}/verifier-comment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (!response.ok) throw new Error('Failed to submit verification');
      
      setVerifyModalOpen(false);
      router.refresh();
    } catch (error) {
      throw error;
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReviewSubmit = async (data: { suggestion: string }) => {
    setIsSubmitting(true);
    try {
      const response = await fetch(`/api/requests/${requestId}/reviewer-suggestion`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (!response.ok) throw new Error('Failed to submit suggestion');
      
      setReviewModalOpen(false);
      router.refresh();
    } catch (error) {
      throw error;
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateSuggestion = async (suggestionId: string, action: string) => {
    try {
      const response = await fetch(`/api/requests/${requestId}/reviewer-suggestion`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ suggestionId, action }),
      });

      if (!response.ok) throw new Error('Failed to update suggestion');
      
      router.refresh();
    } catch (error) {
      throw error;
    }
  };

  return (
    <>
      <div className="rounded-lg border border-[var(--border)] bg-white p-5">
        <h3 className="mb-4 text-lg font-semibold text-[var(--text)]">Actions</h3>
        <div className="flex flex-wrap gap-2">
          {canVerify && (
            <Button
              variant="primary"
              size="sm"
              onClick={() => setVerifyModalOpen(true)}
            >
              Verify Data
            </Button>
          )}

          {canReview && (
            <Button
              variant="accent"
              size="sm"
              onClick={() => setReviewModalOpen(true)}
            >
              Review Request Data
            </Button>
          )}

          {canBookEngagement && (
            <Button
              href={`/requests/${requestId}/book-engagement`}
              variant="secondary"
              size="sm"
            >
              Book Engagement
            </Button>
          )}
        </div>
        <p className="mt-2 text-xs text-[var(--text-muted)]">
          Actions are displayed based on your role and request status.
        </p>
      </div>

      {/* General Review Section */}
      <GeneralReviewSection
        verifierComment={verifierComment}
        reviewerSuggestions={reviewerSuggestions}
        userRole={userRole}
        onUpdateSuggestion={handleUpdateSuggestion}
      />

      {/* Modals */}
      <VerifyModal
        isOpen={verifyModalOpen}
        onClose={() => setVerifyModalOpen(false)}
        onSubmit={handleVerifySubmit}
        isLoading={isSubmitting}
      />

      <ReviewModal
        isOpen={reviewModalOpen}
        onClose={() => setReviewModalOpen(false)}
        onSubmit={handleReviewSubmit}
        isLoading={isSubmitting}
      />
    </>
  );
}
