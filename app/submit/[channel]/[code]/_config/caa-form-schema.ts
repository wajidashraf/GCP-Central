export type RequestorContext = {
  id: string;
  name: string;
  email: string;
  companyId: string;
  companyCode: string;
  companyName: string;
};

export type ProjectOption = {
  id: string;
  projectName: string;
  projectCode: string;
  companyId: string;
  companyCode: string;
  companyName: string;
};

export type CaaProjectDetailsState = {
  projectId: string;
  projectCode: string;
  companyId: string;
  companyCode: string;
  companyName: string;
};

export type CaaSimpleTableRow = {
  no_of_days: string;
  clause_reference: string;
  description: string;
};

export type UploadedAssetState = {
  documentUrl: string;
  documentPublicId: string;
  documentFileName: string;
  documentMimeType: string;
  documentSizeBytes: number;
};

export const CAA_STEPPER_STEPS = [
  { id: "basic-information", label: "Basic Information" },
  { id: "project-details", label: "Project Details" },
  { id: "cost-information", label: "Cost Information" },
  { id: "caa-information-1", label: "CAA Information" },
  { id: "caa-information-2", label: "CAA Information" },
  { id: "caa-information-3", label: "CAA Information" },
  { id: "caa-information-4", label: "CAA Information" },
  { id: "caa-information-5", label: "CAA Information" },
  { id: "documents", label: "Documents" },
] as const;
