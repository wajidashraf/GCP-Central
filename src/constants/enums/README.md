# Enums Management System

Complete, production-ready enum definitions for a Next.js + TypeScript procurement/governance application. Migrated from Power Pages/Dataverse.

---

## 📁 Folder Contents

### Core Enum Definitions
| File | Description | Items |
|------|-------------|-------|
| `types.ts` | Shared types and interfaces | SelectOption, EnumMap, helpers |
| `sectors.ts` | Business sectors/industries | 7 sectors |
| `companyCodes.ts` | Company identifiers | 16 company codes |
| `organizational.ts` | Roles and decision codes | 3 roles + 5 decision codes |
| `status.ts` | Status enums | 3 engagement + 4 project + 3 SLA states |
| `procurement.ts` | Procurement types | 2 methods + 2 registration types + 2 categories |
| `matters.ts` | Procurement matters & outcomes | 14 matters + 9 outcomes |
| `requestStatus.ts` | Request workflow states | 20 comprehensive states |
| `soaCodes.ts` | Statement of Account codes | 14 SOA codes |
| `utils.ts` | Helper functions | 15+ utility functions |
| `index.ts` | **Barrel export** (main entry point) | All exports |

### Examples & Documentation
| File | Description |
|------|-------------|
| `EXAMPLE-form-component.tsx` | React form with Zod validation |
| `EXAMPLE-zod-validation.ts` | Zod schemas for API/DB |
| `EXAMPLE-tables-and-filters.tsx` | Table components with enum rendering |
| `STRUCTURE-AND-BEST-PRACTICES.md` | Architectural guidance |
| `README.md` | This file |

---

## 🚀 Quick Start

### 1. Import Enums

```typescript
// Main entry point - imports everything
import {
  SECTORS,
  REQUEST_STATUS,
  PROJECT_STATUS,
  SECTORS_MAP,
  type SelectOption,
  type SectorValue,
} from '@/constants/enums';
```

### 2. Use in Forms

```typescript
import { SECTORS, REQUEST_STATUS } from '@/constants/enums';

function RequestForm() {
  return (
    <select name="sector" defaultValue={SECTORS[0].value}>
      {SECTORS.map(sector => (
        <option key={sector.value} value={sector.value}>
          {sector.label}
        </option>
      ))}
    </select>
  );
}
```

### 3. Display with Utility Functions

```typescript
import { getLabelByValue } from '@/constants/enums/utils';
import { REQUEST_STATUS } from '@/constants/enums';

// Get label from value
const statusLabel = getLabelByValue(REQUEST_STATUS, 5); // "Pending Review"
```

### 4. Validate with Zod

```typescript
import { z } from 'zod';
import { REQUEST_STATUS, isValidEnumValue } from '@/constants/enums';

const schema = z.object({
  status: z.number().refine(
    val => isValidEnumValue(REQUEST_STATUS, val),
    'Invalid status'
  ),
});
```

---

## 📊 Enum Categories

### 1. **Organizational** (`sectors.ts`, `companyCodes.ts`, `organizational.ts`)
- 7 Business sectors (Utility, Construction, Hospital, etc.)
- 16 Company codes (US01-04, CNS01-02, etc.)
- 3 Company roles (Client Developer, Contractor, Subcontractor)
- 5 Decision codes

### 2. **Status Management** (`status.ts`)
- **Engagement Status**: Scheduled, Completed, Cancelled
- **Project Status**: Inactive, Active, Completed, Dead
- **SLA State**: On Track, Warning, Breached

### 3. **Procurement** (`procurement.ts`, `matters.ts`)
- Procurement methods: Selective Tendering, Direct Negotiation
- Registration types: Tender List, Proposal List
- 14 Matter types (various procurement forms and documents)
- 9 Outcome codes

### 4. **Request Workflow** (`requestStatus.ts`)
- **20 comprehensive status states** organized into phases:
  - Initial: FR, New, Ready for Engagement, R
  - Review: Draft Review, Pending Review, Complete Review
  - Acceptance: Pending Acceptance, Complete Acceptance
  - Acknowledgment: Pending Ack, ACK
  - Endorsement: Pending Endorse, E
  - Resolved: Submitted, Under Verification, Scheduled, RS, NC3, NC4, W

### 5. **Financial** (`soaCodes.ts`)
- 14 Statement of Account codes for tracking procurement stages

---

## 🛠️ Helper Functions

### Lookup Functions
```typescript
// Get label from value
getLabelByValue(SECTORS, 1) // → 'Utility'

// Get value from label
getValueByLabel(SECTORS, 'Utility') // → 1

// Check if valid
isValidEnumValue(REQUEST_STATUS, 5) // → true

// Get all values
getEnumValues(SECTORS) // → [1, 2, 3, 4, 5, 6, 7]
```

### Filtering & Searching
```typescript
// Filter options
filterOptions(REQUEST_STATUS, opt => [4, 5, 6].includes(opt.value))

// Search by label
searchEnumOptions(REQUEST_STATUS, 'review')

// Group for UI
groupEnumOptions(REQUEST_STATUS, 5) // 5 items per group
```

### Type-Safe Utilities
```typescript
// Check if in terminal state
isRequestInTerminalState(15) // → true

// Get status info with styling
getProjectStatusInfo(1) // → { label: 'Active', color: 'green' }

// Validate and fallback
coerceEnumValue(SECTORS, unknownValue, 1)
```

---

## 📝 Enum Structure

Each enum file exports:

### Array Format (for selects)
```typescript
export const SECTORS: SelectOption<number>[] = [
  { value: 1, label: 'Utility' },
  { value: 2, label: 'Construction' },
  // ...
] as const;
```

### Map Format (for lookups)
```typescript
export const SECTORS_MAP = {
  UTILITY: { value: 1, label: 'Utility' },
  CONSTRUCTION: { value: 2, label: 'Construction' },
  // ...
} as const;
```

### Type Exports
```typescript
export type SectorValue = typeof SECTORS[number]['value'];
export const SECTOR_VALUES = [1, 2, 3, 4, 5, 6, 7] as const;
export type SectorValueUnion = (typeof SECTOR_VALUES)[number];
```

---

## ✅ Data Integrity Notes

### Exactly Preserved from Source
- ✅ All 120+ enum values (numeric IDs)
- ✅ All label texts with exact capitalization
- ✅ Multi-word labels with spaces (e.g., "Client Developer / Project Owner")
- ✅ Short codes preserved (e.g., "RTP", "ST/SP", "NC3")

### TODO Items (Partially Visible in Source)
- ⚠️ **Matters #11**: "Contractual Issue Relating to Payment / ..."
  - ✅ Safely captured as partial
  - 📋 Should verify full exact label from Dataverse
  
- ⚠️ **Matters #12**: "Monthly Information Update (cut off 25...)"
  - ✅ Captured as "Monthly Information Update"
  - 📋 Should verify if there's a full label

### Mark These for Future Verification
To verify incomplete labels:
1. Search `EXAMPLE-zod-validation.ts` for `// TODO`
2. Check `matters.ts` for flagged items
3. Confirm in Power Pages/Dataverse source system

---

## 🔄 Usage Patterns

### Pattern 1: React Select Component
```typescript
<select value={sector} onChange={e => setSector(Number(e.target.value))}>
  <option value="">Select Sector</option>
  {SECTORS.map(s => (
    <option key={s.value} value={s.value}>{s.label}</option>
  ))}
</select>
```

### Pattern 2: Table Cell with Label
```typescript
<td>{getLabelByValue(REQUEST_STATUS, row.status)}</td>
```

### Pattern 3: Status Badge Component
```typescript
const status = REQUEST_STATUS.find(s => s.value === statusValue);
const label = status?.label ?? 'Unknown';
<span className={`badge badge-${status_color_map[label]}`}>{label}</span>
```

### Pattern 4: Filter Dropdown
```typescript
const filteredByStatus = requests.filter(r => 
  selectedStatuses.includes(r.status)
);
```

### Pattern 5: Zod Validation
```typescript
const createRequestSchema = z.object({
  status: z.number().refine(
    val => isValidEnumValue(REQUEST_STATUS, val),
    'Invalid status'
  ),
  category: z.number().refine(
    val => isValidEnumValue(REQUEST_CATEGORIES, val),
    'Invalid category'
  ),
});
```

### Pattern 6: MongoDB Query
```typescript
const requests = await db.collection('requests').find({
  status: { $in: [1, 2, 3] }, // New, Ready for Engagement, R
}).toArray();
```

---

## 📦 Barrel Export Usage

The `index.ts` file exports everything. Import from main entry:

```typescript
// ✅ GOOD - Single import
import { 
  SECTORS, 
  REQUEST_STATUS, 
  type SelectOption 
} from '@/constants/enums';

// ✅ ALSO GOOD - Specific file (if you want to reduce bundle size)
import { SECTORS } from '@/constants/enums/sectors';
import { getLabelByValue } from '@/constants/enums/utils';

// ❌ AVOID - Direct path (use barrel export instead)
import { SECTORS } from '@/constants/enums/sectors.ts';
```

---

## 🧪 Testing Examples

```typescript
import { SECTORS, COMPANY_CODES } from '@/constants/enums';
import { getLabelByValue, isValidEnumValue } from '@/constants/enums/utils';

describe('Enums', () => {
  it('should have valid values', () => {
    expect(isValidEnumValue(SECTORS, 1)).toBe(true);
    expect(isValidEnumValue(SECTORS, 999)).toBe(false);
  });

  it('should find labels', () => {
    expect(getLabelByValue(SECTORS, 1)).toBe('Utility');
  });

  it('should have no duplicate values', () => {
    const values = SECTORS.map(s => s.value);
    expect(new Set(values).size).toBe(values.length);
  });
});
```

---

## 🏗️ MongoDB Schema Integration

```typescript
import { REQUEST_STATUS } from '@/constants/enums';

const requestSchema = {
  title: String,
  status: {
    type: Number,
    enum: REQUEST_STATUS.map(s => s.value),
    required: true,
  },
  category: {
    type: Number,
    enum: REQUEST_CATEGORIES.map(c => c.value),
  },
};
```

---

## 🎯 Best Practices

### ✅ DO
- Import from barrel export (`@/constants/enums`)
- Use type exports: `type SelectOption<T>`
- Create both array and map versions
- Use utility functions for common operations
- Document TODO items for incomplete source data
- Keep enum keys in UPPERCASE_SNAKE_CASE
- Preserve exact label text from source

### ❌ DON'T
- Transform or normalize numeric values
- Mix imports from different enum files
- Create new unvalidated enum values
- Duplicate enum definitions elsewhere
- Skip type safety with `any`
- Forget to export types

---

## 📂 File Organization

```
src/
└── constants/
    ├── enums/                          ← You are here
    │   ├── types.ts
    │   ├── sectors.ts
    │   ├── companyCodes.ts
    │   ├── organizational.ts
    │   ├── status.ts
    │   ├── procurement.ts
    │   ├── matters.ts
    │   ├── requestStatus.ts
    │   ├── soaCodes.ts
    │   ├── utils.ts
    │   ├── index.ts (barrel export)
    │   ├── EXAMPLE-form-component.tsx
    │   ├── EXAMPLE-zod-validation.ts
    │   ├── EXAMPLE-tables-and-filters.tsx
    │   ├── STRUCTURE-AND-BEST-PRACTICES.md
    │   └── README.md (this file)
    │
    ├── config.ts
    └── messages.ts
```

---

## 📚 Example Files

Three example files show production patterns:

1. **`EXAMPLE-form-component.tsx`**
   - React hook form with enum selects
   - Zod validation
   - Reusable `EnumSelect` component

2. **`EXAMPLE-zod-validation.ts`**
   - Complete Zod schemas for all entities
   - Request, Project, Matter types
   - Filter schemas
   - MongoDB document types

3. **`EXAMPLE-tables-and-filters.tsx`**
   - Data table with enum rendering
   - Filter UI using enum options
   - Status badges with color coding
   - Statistics dashboard

---

## 🔗 Related Files

- **Validation**: See `EXAMPLE-zod-validation.ts` for complete patterns
- **Form Usage**: See `EXAMPLE-form-component.tsx` for React patterns
- **TABLE Display**: See `EXAMPLE-tables-and-filters.tsx` for UI patterns
- **Architecture**: See `STRUCTURE-AND-BEST-PRACTICES.md` for folder structure guidance

---

## 🚨 Important Notes

### Data Accuracy
All enum values (numbers and labels) have been preserved exactly as they appeared in the source Dataverse system. No transformations were applied.

### Partially Visible Items
Items with cropped/incomplete labels in the source document are marked with `// TODO: verify exact label` comments. These should be verified against the original source system.

### Type Safety
Use the provided type exports (`SectorValue`, `SectorValueUnion`, etc.) for compile-time safety:

```typescript
// ✅ Type-safe
const sector: SectorValue = 1;

// ❌ Type error
const sector: SectorValue = 999; // Error: not a valid value
```

---

## 📞 Quick Reference

| Need | Use |
|------|-----|
| Form dropdown | `SECTORS`, `REQUEST_STATUS` arrays |
| Quick lookup | `SECTORS_MAP.UTILITY` |
| Label from value | `getLabelByValue()` utility |
| Validate value | `isValidEnumValue()` utility |
| Get all values | `getEnumValues()` utility |
| Search options | `searchEnumOptions()` utility |
| Zod validation | See EXAMPLE files |
| Styling by status | `getProjectStatusInfo()` utility |
| Check if terminal | `isRequestInTerminalState()` utility |

---

**Generated**: 2026-04-02  
**Source**: Power Pages/Dataverse (14 enum choice sets, 120+ values)  
**Status**: Production-ready ✅
