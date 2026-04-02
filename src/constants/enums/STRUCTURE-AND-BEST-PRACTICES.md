/**
 * RECOMMENDED FOLDER STRUCTURE FOR NEXT.JS
 * 
 * This document outlines the best location for enum constants, types,
 * and helper utilities in a production Next.js application
 */

// ============================================================================
// FOLDER STRUCTURE
// ============================================================================

/*
src/
├── constants/                    # All application constants
│   ├── enums/                    # Enum definitions (THIS FOLDER)
│   │   ├── types.ts              # Shared SelectOption and helper types
│   │   ├── sectors.ts            # Sector and domain enums
│   │   ├── companyCodes.ts       # Company identifiers
│   │   ├── organizational.ts     # Roles, decision codes
│   │   ├── status.ts             # Status enums (engagement, project, SLA)
│   │   ├── procurement.ts        # Procurement methods, registration types
│   │   ├── matters.ts            # Matters and outcomes
│   │   ├── requestStatus.ts      # Comprehensive request workflow statuses
│   │   ├── soaCodes.ts           # Statement of Account codes
│   │   ├── utils.ts              # Helper functions for enum operations
│   │   ├── index.ts              # Barrel export (main entry point)
│   │   ├── EXAMPLE-form-component.tsx        # Form usage example
│   │   ├── EXAMPLE-zod-validation.ts         # Zod schema examples
│   │   └── EXAMPLE-tables-and-filters.tsx    # Table/dashboard examples
│   ├── config.ts                 # App configuration constants
│   └── messages.ts               # Error/info messages
│
├── lib/                          # Shared utilities
│   ├── db.ts                     # Database utilities
│   ├── api.ts                    # API helpers
│   └── validation/               # Zod schemas (or combine with constants)
│       └── request.schema.ts
│
├── components/                   # Reusable React components
│   ├── forms/
│   │   ├── RequestForm.tsx       # Uses enums
│   │   └── ProjectForm.tsx
│   ├── tables/
│   │   └── RequestTable.tsx      # Uses enum utilities for display
│   └── common/
│       ├── EnumSelect.tsx        # Generic enum select component
│       └── StatusBadge.tsx       # Status display component
│
├── app/                          # Next.js app router
│   ├── api/
│   │   ├── requests/route.ts     # Uses REQUEST_STATUS, REQUEST_CATEGORIES
│   │   ├── projects/route.ts     # Uses PROJECT_STATUS, SECTORS
│   │   └── ...
│   ├── (dashboard)/
│   │   ├── layout.tsx
│   │   ├── page.tsx
│   │   ├── requests/page.tsx     # Uses RequestTable with enums
│   │   └── projects/page.tsx
│   └── ...
│
└── types/
    └── index.ts                  # Global TypeScript types
*/

// ============================================================================
// WHY THIS STRUCTURE?
// ============================================================================

/*
1. CENTRALIZED LOCATION
   - src/constants/enums/ keeps all enums in one place
   - Easy to find and maintain
   - Single source of truth across the app

2. SCALABILITY
   - Organized by domain (sectors, organizational, procurement)
   - Each domain in its own file (~50-100 lines max)
   - Easy to find specific enum without scrolling
   - Can easily add more domains as app grows

3. TYPE SAFETY
   - Shared types in types.ts prevent duplication
   - Type exports enable compile-time validation
   - Zod integration ready

4. REUSABILITY
   - Utils file provides common enum operations
   - No need to repeat lookups/filters in components
   - DRY (Don't Repeat Yourself) principle

5. TESTING & DOCUMENTATION
   - Each file is self-contained and testable
   - Example files show usage patterns
   - Easy to mock in tests

*/

// ============================================================================
// IMPORTS & USAGE IN YOUR CODE
// ============================================================================

/*
✅ GOOD: Import from barrel export
import { REQUEST_STATUS, SECTORS, type SelectOption } from '@/constants/enums';

✅ GOOD: Use utilities
import { getLabelByValue, isValidEnumValue } from '@/constants/enums/utils';

✅ ALSO GOOD: Import specific enum if you only need one
import { REQUEST_STATUS } from '@/constants/enums/requestStatus';

❌ DON'T: Import from individual enum files at deep paths
import { REQUEST_STATUS } from '@/constants/enums/requestStatus'; // At directory level, not from src

*/

// ============================================================================
// WHERE TO STORE RELATED CODE
// ============================================================================

/*
ENUMS:
  → src/constants/enums/ ✅

ZOD VALIDATION SCHEMAS:
  → Option 1: src/lib/validation/*.schema.ts (if you have many schemas)
  → Option 2: Create EXAMPLE-zod-validation.ts in enums folder (quick start)
  → Option 3: Alongside form components (co-locate with usage)
  → Best practice: Separate file per feature (see examples)

ENUM UTILITIES:
  → src/constants/enums/utils.ts ✅

REUSABLE ENUM SELECT COMPONENTS:
  → src/components/common/EnumSelect.tsx (generic)
  → src/components/common/StatusBadge.tsx (specific)
  → src/components/forms/RequestForm.tsx (feature-specific)

API ROUTES USING ENUMS:
  → app/api/requests/route.ts (uses enum validation via Zod)
  → app/api/projects/route.ts

*/

// ============================================================================
// BEST PRACTICES
// ============================================================================

/*
1. USE AS CONST
   ✅ export const AREAS: SelectOption<number>[] = [...] as const;
   Benefits: Type inference, runtime immutability

2. CREATE BOTH ARRAY AND MAP VERSIONS
   ✅ Array: for form selects and dropdowns
   ✅ Map: for quick lookups by key and type-safe access

3. USE TYPE UNIONS
   export const AREA_VALUES = [1, 2, 3, 4, 5, 6, 7] as const;
   export type AreaValueUnion = (typeof AREA_VALUES)[number];

4. DOCUMENT UNCLEAR VALUES WITH TODOS
   */ // TODO: Verify exact label from source document
   { value: 11, label: '...' },
   /*

5. GROUP RELATED ENUMS
   ✅ Keep status enums together (engagement, project, SLA)
   ✅ Put request-related enums in one file
   ✅ Organize by business domain

6. PRESERVE EXACT VALUES
   ✅ Never convert or transform numeric values
   ❌ Don't normalize labels if source uses inconsistent capitalization

7. USE MEANINGFUL KEY NAMES
   ✅ SECTORS_MAP keys: UTILITY, CONSTRUCTION, HOSPITAL
   ❌ Bad: VALUE_1, VALUE_2, VALUE_3

8. HELPER FOR STATUS WORKFLOW
   export const REQUEST_STATUS_GROUPS = { 
     INITIAL: [0, 1, 2],
     REVIEW: [4, 5, 6],
     RESOLVED: [13, 14, 15],
   }

*/

// ============================================================================
// GETTING ENUM LABEL IN COMPONENTS
// ============================================================================

/*
// Option 1: Using utility function
import { getLabelByValue } from '@/constants/enums/utils';

const statusLabel = getLabelByValue(REQUEST_STATUS, status);

// Option 2: Using map for quicker lookups (if you know the key)
import { REQUEST_STATUS_MAP } from '@/constants/enums';

const statusLabel = REQUEST_STATUS_MAP.NEW.label; // 'New'

// Option 3: Search array directly
const option = REQUEST_STATUS.find(opt => opt.value === status);
const label = option?.label || 'Unknown';

// BEST PRACTICE:
// Use utility functions for flexibility and maintainability
const label = getLabelByValue(REQUEST_STATUS, status) ?? 'Unknown';
*/

// ============================================================================
// VALIDATION WITH ZOD
// ============================================================================

/*
import { z } from 'zod';
import { REQUEST_STATUS, isValidEnumValue } from '@/constants/enums';

// Option 1: Using refine
const schema = z.object({
  status: z.number().refine(
    val => isValidEnumValue(REQUEST_STATUS, val),
    'Invalid status'
  )
});

// Option 2: Using enum values
const statusValues = REQUEST_STATUS.map(s => s.value) as [number, ...number[]];
const schema = z.object({
  status: z.enum(statusValues)
});

// Option 3: Custom helper (recommended)
import { createEnumValidator } from '@/constants/enums/utils';
const isValidStatus = createEnumValidator(REQUEST_STATUS);

// Then in schema:
const schema = z.object({
  status: z.number().refine(isValidStatus, 'Invalid status')
});
*/

// ============================================================================
// TESTING ENUMS
// ============================================================================

/*
// Example test file: src/constants/enums/__tests__/sectors.test.ts

import { SECTORS, SECTORS_MAP } from '../sectors';
import { getLabelByValue, isValidEnumValue } from '../utils';

describe('SECTORS', () => {
  it('should have all unique values', () => {
    const values = SECTORS.map(s => s.value);
    const unique = new Set(values);
    expect(unique.size).toBe(values.length);
  });

  it('should lookup label by value', () => {
    expect(getLabelByValue(SECTORS, 1)).toBe('Utility');
    expect(getLabelByValue(SECTORS, 999)).toBeUndefined();
  });

  it('should validate enum values', () => {
    expect(isValidEnumValue(SECTORS, 1)).toBe(true);
    expect(isValidEnumValue(SECTORS, 999)).toBe(false);
  });

  it('should have matching array and map', () => {
    SECTORS.forEach(s => {
      const mapEntry = Object.values(SECTORS_MAP).find(
        entry => entry.value === s.value
      );
      expect(mapEntry?.label).toBe(s.label);
    });
  });
});
*/

// ============================================================================
// MONGODB INTEGRATION EXAMPLE
// ============================================================================

/*
// src/lib/db/requests.ts

import { db } from '@/lib/db';
import { REQUEST_STATUS } from '@/constants/enums';
import type { Request } from '@/types/request';

export async function updateRequestStatus(
  requestId: string,
  newStatus: number
): Promise<Request> {
  // Validate enum value
  if (!REQUEST_STATUS.some(s => s.value === newStatus)) {
    throw new Error(`Invalid request status: ${newStatus}`);
  }

  return await db.collection('requests').findOneAndUpdate(
    { _id: requestId },
    { $set: { status: newStatus, updatedAt: new Date() } },
    { returnDocument: 'after' }
  );
}

// Usage:
const request = await updateRequestStatus(id, REQUEST_STATUS_MAP.SUBMITTED.value);
*/

// ============================================================================
// ADMIN DASHBOARD PATTERN
// ============================================================================

/*
// Component that shows all enum values for management

import { SECTORS, REQUEST_STATUS } from '@/constants/enums';
import type { SelectOption } from '@/constants/enums/types';

function EnumManagementPanel({
  enumName,
  options,
}: {
  enumName: string;
  options: SelectOption<number>[];
}) {
  return (
    <div className="space-y-2">
      <h3 className="font-bold">{enumName}</h3>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b">
            <th>Value</th>
            <th>Label</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {options.map(opt => (
            <tr key={opt.value} className="border-b">
              <td>{opt.value}</td>
              <td>{opt.label}</td>
              <td>Edit | Delete</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// Usage:
<EnumManagementPanel enumName="Request Status" options={REQUEST_STATUS} />
*/
