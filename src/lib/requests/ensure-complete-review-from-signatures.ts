import prisma from '@/lib/prisma';
import { REQUEST_STATUS_MAP } from '@/src/constants/enums/requestStatus';

const PENDING_REVIEW = REQUEST_STATUS_MAP.PENDING_REVIEW.label.toLowerCase();
const COMPLETE_REVIEW_LABEL = REQUEST_STATUS_MAP.COMPLETE_REVIEW.label;

const MIN_PREPARED = 1;
const MIN_CONFIRMED = 2;

/**
 * If the request is still Pending Review but signature counts already meet the
 * Complete Review rule, promote status. Handles legacy rows where `type` casing
 * might differ, and repairs missed updates from older deploys.
 */
export async function ensureCompleteReviewFromSignatures(
  requestId: string,
  currentStatus: string
): Promise<boolean> {
  if (currentStatus.trim().toLowerCase() !== PENDING_REVIEW) {
    return false;
  }

  const sigs = await prisma.requestSignature.findMany({
    where: { requestId },
    select: { type: true },
  });

  const prepared = sigs.filter((s) => s.type.trim().toLowerCase() === 'prepared').length;
  const confirmed = sigs.filter((s) => s.type.trim().toLowerCase() === 'confirmed').length;

  if (prepared >= MIN_PREPARED && confirmed >= MIN_CONFIRMED) {
    await prisma.request.update({
      where: { id: requestId },
      data: { status: COMPLETE_REVIEW_LABEL },
    });
    return true;
  }

  return false;
}
