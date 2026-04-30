import type { StspPicDetailsInput } from "@/lib/validations/stsp";

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

export type StspProjectDetailsState = {
  projectId: string;
  projectCode: string;
  companyId: string;
  companyCode: string;
  companyName: string;
  tenderProposalSubmissionDate: string;
  tenderValidityPeriodDays: string;
};

export type StspPicDetailsState = StspPicDetailsInput;

export type StspRiskItemState = {
  riskIdentified: string;
  mitigationPlan: string;
};

export type UploadedAssetState = {
  documentUrl: string;
  documentPublicId: string;
  documentFileName: string;
  documentMimeType: string;
  documentSizeBytes: number;
};

export const STSP_STEPPER_STEPS = [
  { id: "basic-information", label: "Basic Information" },
  { id: "project-details", label: "Project Details" },
  { id: "pic", label: "PIC" },
  { id: "stsp-information-1", label: "ST/SP Information" },
  { id: "stsp-information-2", label: "ST/SP Information" },
  { id: "documents", label: "Documents" },
] as const;
