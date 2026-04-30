export type ReviewerDecisionCodeOption = { value: string; label: string };

const CODE_1: ReviewerDecisionCodeOption = {
  value: '1',
  label: 'Code 1: Proceed with acceptance of review.',
};

const CODE_2: ReviewerDecisionCodeOption = {
  value: '2',
  label: 'Code 2: Resubmit for review, critical information missing.',
};

const CODE_3: ReviewerDecisionCodeOption = {
  value: '3',
  label: 'Code 3: No submission for review. Non-compliance.',
};

const CODE_4: ReviewerDecisionCodeOption = {
  value: '4',
  label: 'Code 4: Exempted for review and approve by Main GCPC (signed letter as attached).',
};

const CODE_W: ReviewerDecisionCodeOption = {
  value: '5',
  label: 'Code W: Waived for review. Company attached signed Waiver Form from Group CEO.',
};

const BASE_CODES: ReviewerDecisionCodeOption[] = [CODE_1, CODE_2, CODE_3, CODE_4];

/** Matches legacy behaviour: extra Code W for Submission of Tender / Proposal style types. */
export function requestTypeShowsCodeW(requestType: string): boolean {
  const t = requestType.trim().toLowerCase();
  return t.includes('submission of tender') || (t.includes('tender') && t.includes('proposal'));
}

export function getReviewerDecisionCodesForRequestType(
  requestType: string
): ReviewerDecisionCodeOption[] {
  if (requestTypeShowsCodeW(requestType)) {
    return [...BASE_CODES, CODE_W];
  }
  return [...BASE_CODES];
}

export function isValidReviewerDecisionCodeForRequestType(
  requestType: string,
  code: string
): boolean {
  const normalized = code.trim();
  const allowed = new Set(getReviewerDecisionCodesForRequestType(requestType).map((c) => c.value));
  return allowed.has(normalized);
}

/** Human-readable label for numeric codes saved on the request; returns null for unknown values. */
export function labelForStoredDecisionCode(code: string): string | null {
  const normalized = code.trim();
  const all: ReviewerDecisionCodeOption[] = [CODE_1, CODE_2, CODE_3, CODE_4, CODE_W];
  return all.find((c) => c.value === normalized)?.label ?? null;
}
