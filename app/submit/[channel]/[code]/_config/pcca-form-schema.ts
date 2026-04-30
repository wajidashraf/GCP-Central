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

export type PccaProjectDetailsState = {
  projectId: string;
  projectCode: string;
  companyId: string;
  companyCode: string;
  companyName: string;
};

export type PccaCostRow = {
  work_description_bq: string;
  cost?: string;
  price_revenue_rm?: string;
};

export type UploadedAssetState = {
  documentUrl: string;
  documentPublicId: string;
  documentFileName: string;
  documentMimeType: string;
  documentSizeBytes: number;
};

export const PCCA_STEPPER_STEPS = [
  { id: "basic-information", label: "Basic Information" },
  { id: "project-details", label: "Project Details" },
  { id: "cost-details", label: "Cost Details" },
  { id: "cost-summary", label: "Cost Summary" },
  { id: "documents", label: "Documents" },
] as const;
