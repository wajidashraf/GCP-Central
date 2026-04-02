/**
 * Status and Engagement Enums
 * Represents engagement status, project status, and lifecycle states
 */

import type { SelectOption } from './types';

// ============================================================================
// Engagement Status
// ============================================================================

/**
 * Array format for engagement status selection
 */
export const ENGAGEMENT_STATUS: SelectOption<number>[] = [
  { value: 1, label: 'Scheduled' },
  { value: 2, label: 'Completed' },
  { value: 0, label: 'Cancelled' },
] as const;

/**
 * Map format for engagement status lookups
 */
export const ENGAGEMENT_STATUS_MAP = {
  SCHEDULED: { value: 1, label: 'Scheduled' },
  COMPLETED: { value: 2, label: 'Completed' },
  CANCELLED: { value: 0, label: 'Cancelled' },
} as const;

export type EngagementStatusValue = typeof ENGAGEMENT_STATUS[number]['value'];

// ============================================================================
// Project Status
// ============================================================================

/**
 * Array format for project status selection
 */
export const PROJECT_STATUS: SelectOption<number>[] = [
  { value: 0, label: 'Inactive' },
  { value: 1, label: 'Active' },
  { value: 2, label: 'Completed' },
  { value: 3, label: 'Dead' },
] as const;

/**
 * Map format for project status lookups
 */
export const PROJECT_STATUS_MAP = {
  INACTIVE: { value: 0, label: 'Inactive' },
  ACTIVE: { value: 1, label: 'Active' },
  COMPLETED: { value: 2, label: 'Completed' },
  DEAD: { value: 3, label: 'Dead' },
} as const;

export type ProjectStatusValue = typeof PROJECT_STATUS[number]['value'];

// ============================================================================
// SLA State
// ============================================================================

/**
 * Array format for SLA state selection
 */
export const SLA_STATE: SelectOption<number>[] = [
  { value: 1, label: 'On Track' },
  { value: 2, label: 'Warning' },
  { value: 3, label: 'Breached' },
] as const;

/**
 * Map format for SLA state lookups
 */
export const SLA_STATE_MAP = {
  ON_TRACK: { value: 1, label: 'On Track' },
  WARNING: { value: 2, label: 'Warning' },
  BREACHED: { value: 3, label: 'Breached' },
} as const;

export type SLAStateValue = typeof SLA_STATE[number]['value'];
