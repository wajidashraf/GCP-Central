export const SHAREPOINT_LIST_FILES = {
  companiesSeed: "company-records.json",
} as const;

export const SHAREPOINT_COMPANY_FIELDS = {
  title: "Title",
  uuid: "uuid",
  companyName: "companyName",
  companyCode: "companyCode",
  sector: "sector",
} as const;

/** Engagements list: base columns plus lookup-style references (add as single-line text in SharePoint). */
export const SHAREPOINT_ENGAGEMENT_FIELDS = {
  title: "Title",
  uuid: "uuid",
  engagementNumber: "engagementNumber",
  name: "name",
  type: "type",
  location: "location",
  status: "status",
  notes: "notes",
  requestUuid: "requestUuid",
  slotItemId: "slotItemId",
  requestorUserId: "requestorUserId",
} as const;
