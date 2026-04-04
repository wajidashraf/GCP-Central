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
  userRoles?: string[];
  verifierComment?: {
    id: string;
    comment: string;
    decisionCode: string;
    verifiedBy: string;
    createdAt: string | Date;
  } | null;
  reviewerSuggestions?: Array<{
    id: string;
    reviewerName?: string | null;
    suggestion: string;
    action?: string | null;
    createdAt: string | Date;
  }>;
  hasEngagementSlots?: boolean;
  hasBookedEngagement?: boolean;
}

export default function RequestActionsSection({
  requestId,
  status,
  userRole,
  userRoles = [],
  verifierComment,
  reviewerSuggestions = [],
  hasEngagementSlots,
  hasBookedEngagement = false,
}: RequestActionsSectionProps) {
  const router = useRouter();
  const [verifyModalOpen, setVerifyModalOpen] = useState(false);
  const [reviewModalOpen, setReviewModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const normalizedStatus = status.trim().toLowerCase();
  const roleSet = new Set([userRole, ...userRoles].filter(Boolean).map((role) => String(role).toLowerCase()));
  const hasRole = (role: string) => roleSet.has(role);
  const isVerifiedApproved = verifierComment?.decisionCode?.toString().toLowerCase() === 'approved';
  const canVerify = hasRole('verifier') && ['new', 'submitted', 'under verification', 'pending review', 'in review'].includes(normalizedStatus) && !verifierComment;
  const canReview = hasRole('reviewer') && ['in review', 'pending review', 'draft review', 'scheduled'].includes(normalizedStatus);
  const canBookEngagement = hasRole('requestor')
    && hasEngagementSlots
    && !hasBookedEngagement
    && (isVerifiedApproved || ['new', 'ready for engagement', 'acknowledged', 'scheduled', 'in review'].includes(normalizedStatus));

  const handleVerifySubmit = async (data: { comment: string; decisionCode: string }) => {
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

  const handleUpdateSuggestion = async (suggestionId: string, action: string) => {
    try {
      const response = await fetch(`/api/requests/${requestId}/reviewer-suggestion`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ suggestionId, action }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error(payload?.error || 'Failed to update suggestion');
      
      router.refresh();
    } catch (error) {
      throw error;
    }
  };

  return (
    <>
       {/* General Review Section */}
      <GeneralReviewSection
        verifierComment={verifierComment}
        reviewerSuggestions={reviewerSuggestions}
        userRole={userRole}
        userRoles={userRoles}
        onUpdateSuggestion={handleUpdateSuggestion}
      />
     
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
