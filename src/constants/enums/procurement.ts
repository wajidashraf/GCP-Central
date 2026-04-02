/**
 * Procurement and Request Enums
 * Represents procurement methods, request types, and related classifications
 */

import type { SelectOption } from './types';

// ============================================================================
// Procurement Methods
// ============================================================================

/**
 * Array format for procurement method selection
 */
export const PROCUREMENT_METHODS: SelectOption<number>[] = [
  { value: 0, label: 'Selective Tendering' },
  { value: 1, label: 'Direct Negotiation' },
] as const;

/**
 * Map format for procurement method lookups
 */
export const PROCUREMENT_METHODS_MAP = {
  SELECTIVE_TENDERING: { value: 0, label: 'Selective Tendering' },
  DIRECT_NEGOTIATION: { value: 1, label: 'Direct Negotiation' },
} as const;

export type ProcurementMethodValue = typeof PROCUREMENT_METHODS[number]['value'];

// ============================================================================
// Registration Type
// ============================================================================

/**
 * Array format for registration type selection
 */
export const REGISTRATION_TYPES: SelectOption<number>[] = [
  { value: 1, label: 'Tender List' },
  { value: 2, label: 'Proposal List' },
] as const;

/**
 * Map format for registration type lookups
 */
export const REGISTRATION_TYPES_MAP = {
  TENDER_LIST: { value: 1, label: 'Tender List' },
  PROPOSAL_LIST: { value: 2, label: 'Proposal List' },
} as const;

export type RegistrationTypeValue = typeof REGISTRATION_TYPES[number]['value'];

// ============================================================================
// Request Category
// ============================================================================

/**
 * Array format for request category selection
 */
export const REQUEST_CATEGORIES: SelectOption<number>[] = [
  { value: 1, label: 'GCP' },
  { value: 2, label: 'GCPC' },
] as const;

/**
 * Map format for request category lookups
 */
export const REQUEST_CATEGORIES_MAP = {
  GCP: { value: 1, label: 'GCP' },
  GCPC: { value: 2, label: 'GCPC' },
} as const;

export type RequestCategoryValue = typeof REQUEST_CATEGORIES[number]['value'];
