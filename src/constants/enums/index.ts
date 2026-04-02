/**
 * Enums Barrel Export
 * Central export point for all enum definitions and types
 *
 * Usage:
 * import { SECTORS, REQUEST_STATUS, SECTORS_MAP } from '@/constants/enums';
 * import type { SelectOption } from '@/constants/enums';
 */

// ============================================================================
// Types
// ============================================================================
export type {
  SelectOption,
  OptionValue,
  EnumMap,
  EnumValueType,
  RequiredSelectOption,
} from './types';

// ============================================================================
// Sectors & Companies
// ============================================================================
export {
  SECTORS,
  SECTORS_MAP,
  type SectorValue,
  type SectorValueUnion,
  SECTOR_VALUES,
} from './sectors';

export {
  COMPANY_CODES,
  COMPANY_CODES_MAP,
  type CompanyCodeValue,
  type CompanyCodeValueUnion,
  COMPANY_CODE_VALUES,
} from './companyCodes';

// ============================================================================
// Organizational & Roles
// ============================================================================
export {
  COMPANY_ROLES,
  COMPANY_ROLES_MAP,
  DECISION_CODES,
  DECISION_CODES_MAP,
  type CompanyRoleValue,
  type DecisionCodeValue,
} from './organizational';

// ============================================================================
// Status Management
// ============================================================================
export {
  ENGAGEMENT_STATUS,
  ENGAGEMENT_STATUS_MAP,
  PROJECT_STATUS,
  PROJECT_STATUS_MAP,
  SLA_STATE,
  SLA_STATE_MAP,
  type EngagementStatusValue,
  type ProjectStatusValue,
  type SLAStateValue,
} from './status';

// ============================================================================
// Procurement & Requests
// ============================================================================
export {
  PROCUREMENT_METHODS,
  PROCUREMENT_METHODS_MAP,
  REGISTRATION_TYPES,
  REGISTRATION_TYPES_MAP,
  REQUEST_CATEGORIES,
  REQUEST_CATEGORIES_MAP,
  type ProcurementMethodValue,
  type RegistrationTypeValue,
  type RequestCategoryValue,
} from './procurement';

// ============================================================================
// Matters & Outcomes
// ============================================================================
export {
  MATTERS,
  MATTERS_MAP,
  OUTCOMES,
  OUTCOMES_MAP,
  type MatterValue,
  type OutcomeValue,
} from './matters';

// ============================================================================
// Request Status
// ============================================================================
export {
  REQUEST_STATUS,
  REQUEST_STATUS_MAP,
  REQUEST_STATUS_GROUPS,
  type RequestStatusValue,
} from './requestStatus';

// ============================================================================
// SOA Codes
// ============================================================================
export {
  SOA_CODES,
  SOA_CODES_MAP,
  type SOACodeValue,
} from './soaCodes';

// ============================================================================
// Utilities
// ============================================================================
export {
  getLabelByValue,
  getValueByLabel,
  filterOptions,
  isValidEnumValue,
  getEnumValues,
  getEnumLabels,
  enumToObject,
  coerceEnumValue,
  createEnumValidator,
  groupEnumOptions,
  searchEnumOptions,
  getRequestStatusLabel,
  getSectorLabel,
  getProjectStatusInfo,
  isRequestInTerminalState,
} from './utils';
