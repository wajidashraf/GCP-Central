'use client';

import { useState } from 'react';
import Button from '@/src/components/ui/button';
import VerifyModal from '@/src/components/modals/verify-modal';
import ReviewModal from '@/src/components/modals/review-modal';
import AddDecisionModal from '@/src/components/modals/add-decision-modal';
import { useRouter } from 'next/navigation';

interface RequestActionsSectionProps {
  requestId: string;
  status: string;
  requestType: string;
  isSpecialProject?: boolean;
  reviewerSuggestionsCount?: number;
  workingGcpcSuggestionsCount?: number;
  userRole?: string;
  userRoles?: string[];
  /** Prefill verifier comment when opening Add decision (from relation or denormalised field). */
  initialVerifierComment?: string | null;
  /** Prefill decision code when it is stored as 1–5 (not a legacy status label). */
  initialVerifierDecisionCode?: string | null;
}

export default function RequestActionsSection({
  requestId,
  status,
  requestType,
  isSpecialProject = false,
  reviewerSuggestionsCount = 0,
  workingGcpcSuggestionsCount = 0,
  userRole,
  userRoles = [],
  initialVerifierComment = null,
  initialVerifierDecisionCode = null,
}: RequestActionsSectionProps) {
  const router = useRouter();
  const [verifyModalOpen, setVerifyModalOpen] = useState(false);
  const [reviewModalOpen, setReviewModalOpen] = useState(false);
  const [addDecisionModalOpen, setAddDecisionModalOpen] = useState(false);
  const [reviewSourceRole, setReviewSourceRole] = useState<'reviewer' | 'working_gcpc'>('reviewer');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const normalizedStatus = status.trim().toLowerCase();
  const normalizedRequestType = requestType.trim().toLowerCase();
  const isRtpRequest =
    normalizedRequestType === 'rtp' ||
    normalizedRequestType.includes('registration of tender') ||
    normalizedRequestType.includes('tender & proposal');
  const roleSet = new Set([userRole, ...userRoles].filter(Boolean).map((role) => String(role).toLowerCase()));
  const hasRole = (role: string) => roleSet.has(role);
  const isAdmin = hasRole('admin');
  const canActAsVerifier = isAdmin || hasRole('verifier');
  const canActAsReviewer = isAdmin || hasRole('reviewer');
  const canActAsWorkingGcpc = isAdmin || hasRole('working_gcpc');
  const canActAsRequestor = isAdmin || hasRole('requestor');
  const isFrOrRs = normalizedStatus === 'fr' || normalizedStatus === 'rs';
  const canVerify = canActAsVerifier && normalizedStatus === 'new';
  const canVerifyRtp = canActAsVerifier && ['new', 'rs'].includes(normalizedStatus);
  const canReview = canActAsReviewer && normalizedStatus === 'r';
  const canMarkReviewAsDraft = canActAsVerifier && reviewerSuggestionsCount > 0 && normalizedStatus === 'r' && !isFrOrRs;
  const canReviewAsWorkingGcpc = canActAsWorkingGcpc && normalizedStatus === 'draft review';
  const canMarkAsPendingReview = canActAsVerifier && workingGcpcSuggestionsCount > 0 && normalizedStatus === 'draft review';
  const canBookEngagement = canActAsRequestor && ['ready for engagement'].includes(normalizedStatus);
  const canMoveToPendingAcceptance =
    (hasRole('admin') || hasRole('hoc')) && normalizedStatus === 'complete review';
  const canOpenEndorsement =
    (hasRole('admin') || hasRole('hoc')) && normalizedStatus === 'pending endorse';
  const canOpenAcknowledgement =
    (hasRole('admin') || hasRole('hoc')) && normalizedStatus === 'pending ack';

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
        body: JSON.stringify({ ...data, sourceRole: reviewSourceRole }),
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

  const handleMarkReviewAsDraft = async () => {
    setIsSubmitting(true);
    try {
      const response = await fetch(`/api/requests/${requestId}/draft-review`, {
        method: 'POST',
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error(payload?.error || 'Failed to mark review as draft');
      router.refresh();
    } catch (error) {
      throw error;
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAddDecisionSubmit = async (data: { comment: string; decisionCode: string }) => {
    setIsSubmitting(true);
    try {
      const response = await fetch(`/api/requests/${requestId}/pending-review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          comment: data.comment,
          decisionCode: data.decisionCode,
        }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error(payload?.error || 'Failed to submit decision');
      setAddDecisionModalOpen(false);
      router.refresh();
    } catch (error) {
      throw error;
    } finally {
      setIsSubmitting(false);
    }
  };

  const openReviewModal = (sourceRole: 'reviewer' | 'working_gcpc') => {
    setReviewSourceRole(sourceRole);
    setReviewModalOpen(true);
  };

  if (isRtpRequest) {
    if (!canVerifyRtp) {
      return null;
    }

    return (
      <>
        <div className="rounded-lg border border-[var(--border)] bg-white p-5">
          <div className="flex flex-wrap gap-2">
            <Button
              variant="primary"
              size="sm"
              onClick={() => setVerifyModalOpen(true)}
            >
              Verify Data
            </Button>
          </div>
        </div>

        <VerifyModal
          isOpen={verifyModalOpen}
          onClose={() => setVerifyModalOpen(false)}
          onSubmit={handleVerifySubmit}
          currentStatus={status}
          requestType={requestType}
          isSpecialProject={isSpecialProject}
          isLoading={isSubmitting}
        />
      </>
    );
  }

  const showActions =
    canVerify ||
    canReview ||
    canMarkReviewAsDraft ||
    canReviewAsWorkingGcpc ||
    canMarkAsPendingReview ||
    canBookEngagement ||
    canMoveToPendingAcceptance ||
    canOpenEndorsement ||
    canOpenAcknowledgement;
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
              onClick={() => openReviewModal('reviewer')}
            >
              Review Data
            </Button>
          )}

          {canMarkReviewAsDraft && (
            <Button
              variant="primary"
              size="sm"
              disabled={isSubmitting}
              onClick={handleMarkReviewAsDraft}
            >
              {isSubmitting ? 'Marking Draft...' : 'Mark Review as Draft'}
            </Button>
          )}

          {canReviewAsWorkingGcpc && (
            <Button
              variant="accent"
              size="sm"
              onClick={() => openReviewModal('working_gcpc')}
            >
              Review Request Data
            </Button>
          )}

          {canMarkAsPendingReview && (
            <Button variant="primary" size="sm" disabled={isSubmitting} onClick={() => setAddDecisionModalOpen(true)}>
              Add decision
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

          {canMoveToPendingAcceptance && (
            <Button variant="primary" size="sm" href={`/requests/${requestId}/review-acceptance`}>
              Accept Review
            </Button>
          )}

          {canOpenEndorsement && (
            <Button variant="primary" size="sm" href={`/requests/${requestId}/endorsement`}>
              ENDORSEMENT
            </Button>
          )}

          {canOpenAcknowledgement && (
            <Button variant="primary" size="sm" href={`/requests/${requestId}/acknowledgement`}>
              Acknowledgement
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

      <AddDecisionModal
        isOpen={addDecisionModalOpen}
        onClose={() => !isSubmitting && setAddDecisionModalOpen(false)}
        onSubmit={handleAddDecisionSubmit}
        requestType={requestType}
        initialComment={initialVerifierComment}
        initialDecisionCode={initialVerifierDecisionCode}
        isLoading={isSubmitting}
      />
    </>
  );
}
