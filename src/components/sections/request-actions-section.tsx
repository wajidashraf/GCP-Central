'use client';

import { useState } from 'react';
import Button from '@/src/components/ui/button';
import VerifyModal from '@/src/components/modals/verify-modal';
import ReviewModal from '@/src/components/modals/review-modal';
import { useRouter } from 'next/navigation';

interface RequestActionsSectionProps {
  requestId: string;
  status: string;
  requestType: string;
  isSpecialProject?: boolean;
  reviewerSuggestionsCount?: number;
  userRole?: string;
  userRoles?: string[];
  hasEngagementSlots?: boolean;
  hasBookedEngagement?: boolean;
}

export default function RequestActionsSection({
  requestId,
  status,
  requestType,
  isSpecialProject = false,
  reviewerSuggestionsCount = 0,
  userRole,
  userRoles = [],
  hasEngagementSlots,
  hasBookedEngagement = false,
}: RequestActionsSectionProps) {
  const router = useRouter();
  const [verifyModalOpen, setVerifyModalOpen] = useState(false);
  const [reviewModalOpen, setReviewModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const normalizedStatus = status.trim().toLowerCase();
  console.log(normalizedStatus);
  const roleSet = new Set([userRole, ...userRoles].filter(Boolean).map((role) => String(role).toLowerCase()));
  console.log(roleSet);
  const hasRole = (role: string) => roleSet.has(role);
  const isAdmin = hasRole('admin');
  const canActAsVerifier = isAdmin || hasRole('verifier');
  const canActAsReviewer = isAdmin || hasRole('reviewer');
  const canActAsRequestor = isAdmin || hasRole('requestor');
  const isFrOrRs = normalizedStatus === 'fr' || normalizedStatus === 'rs';
  const canVerify = canActAsVerifier && normalizedStatus === 'new';
  const canReview = canActAsReviewer && (normalizedStatus === 'R' ||normalizedStatus === 'r');
  const canCompleteReview = canActAsVerifier && reviewerSuggestionsCount > 0 && normalizedStatus === 'R' && !isFrOrRs;
  const canBookEngagement = canActAsRequestor && ['ready for engagement'].includes(normalizedStatus);

  const handleVerifySubmit = async (data: { comment: string; requestStatus: string }) => {
    setIsSubmitting(true);
    try {
      const response = await fetch(`/api/requests/${requestId}/verifier-comment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error(payload?.error || 'Failed to submit verification');
      
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
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error(payload?.error || 'Failed to submit suggestion');
      
      setReviewModalOpen(false);
      router.refresh();
    } catch (error) {
      throw error;
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCompleteReview = async () => {
    setIsSubmitting(true);
    try {
      const response = await fetch(`/api/requests/${requestId}/complete-review`, {
        method: 'POST',
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error(payload?.error || 'Failed to complete review');
      router.refresh();
    } catch (error) {
      throw error;
    } finally {
      setIsSubmitting(false);
    }
  };

  const showActions = canVerify || canReview || canCompleteReview || canBookEngagement;
  if (!showActions) {
    return null;
  }

  return (
    <>
      <div className="rounded-lg border border-[var(--border)] bg-white p-5">
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
              Review Data
            </Button>
          )}

          {canCompleteReview && (
            <Button
              variant="primary"
              size="sm"
              disabled={isSubmitting}
              onClick={handleCompleteReview}
            >
              {isSubmitting ? 'Marking Complete...' : 'Mark Review Complete'}
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
      </div>

      {/* Modals */}
      <VerifyModal
        isOpen={verifyModalOpen}
        onClose={() => setVerifyModalOpen(false)}
        onSubmit={handleVerifySubmit}
        currentStatus={status}
        requestType={requestType}
        isSpecialProject={isSpecialProject}
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
