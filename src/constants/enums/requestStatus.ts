/**
 * Request Status Enum
 * Represents the complete workflow states for requests
 * This is the most comprehensive status enum with 20 states
 */

import type { SelectOption } from './types';

/**
 * Array format for request status selection
 * Represents the complete request lifecycle from initial submission to final resolution
 */
export const REQUEST_STATUS: SelectOption<number>[] = [
  { value: 0, label: 'FR' },
  { value: 1, label: 'New' },
  { value: 2, label: 'Ready for Engagement' },
  { value: 3, label: 'R' },
  { value: 4, label: 'Draft Review' },
  { value: 5, label: 'Pending Review' },
  { value: 6, label: 'Complete Review' },
  { value: 7, label: 'Pending Acceptance' },
  { value: 8, label: 'Complete Acceptance' },
  { value: 9, label: 'Pending Ack' },
  { value: 10, label: 'ACK' },
  { value: 11, label: 'Pending Endorse' },
  { value: 12, label: 'E' },
  { value: 13, label: 'Submitted' },
  { value: 14, label: 'Under Verification' },
  { value: 15, label: 'Scheduled' },
  { value: 16, label: 'RS' },
  { value: 17, label: 'NC3' },
  { value: 18, label: 'NC4' },
  { value: 19, label: 'W' },
] as const;

/**
 * Map format for request status lookups
 * Keys use uppercase snake_case for safe TypeScript access
 */
export const REQUEST_STATUS_MAP = {
  FR: { value: 0, label: 'FR' },
  NEW: { value: 1, label: 'New' },
  READY_FOR_ENGAGEMENT: { value: 2, label: 'Ready for Engagement' },
  R: { value: 3, label: 'R' },
  DRAFT_REVIEW: { value: 4, label: 'Draft Review' },
  PENDING_REVIEW: { value: 5, label: 'Pending Review' },
  COMPLETE_REVIEW: { value: 6, label: 'Complete Review' },
  PENDING_ACCEPTANCE: { value: 7, label: 'Pending Acceptance' },
  COMPLETE_ACCEPTANCE: { value: 8, label: 'Complete Acceptance' },
  PENDING_ACK: { value: 9, label: 'Pending Ack' },
  ACK: { value: 10, label: 'ACK' },
  PENDING_ENDORSE: { value: 11, label: 'Pending Endorse' },
  E: { value: 12, label: 'E' },
  SUBMITTED: { value: 13, label: 'Submitted' },
  UNDER_VERIFICATION: { value: 14, label: 'Under Verification' },
  SCHEDULED: { value: 15, label: 'Scheduled' },
  RS: { value: 16, label: 'RS' },
  NC3: { value: 17, label: 'NC3' },
  NC4: { value: 18, label: 'NC4' },
  W: { value: 19, label: 'W' },
} as const;

export type RequestStatusValue = typeof REQUEST_STATUS[number]['value'];

/**
 * Groupings of request statuses for workflow management
 * Useful for UI filtering, notifications, and business logic
 */
export const REQUEST_STATUS_GROUPS = {
  /** Initial states when request is created */
  INITIAL: [0, 1, 2, 3] as const,

  /** Review phase states */
  REVIEW: [4, 5, 6] as const,

  /** Acceptance phase states */
  ACCEPTANCE: [7, 8] as const,

  /** Acknowledgment phase states */
  ACKNOWLEDGMENT: [9, 10] as const,

  /** Endorsement phase states */
  ENDORSEMENT: [11, 12] as const,

  /** Final/resolved states */
  RESOLVED: [13, 14, 15, 16, 17, 18, 19] as const,
} as const;
