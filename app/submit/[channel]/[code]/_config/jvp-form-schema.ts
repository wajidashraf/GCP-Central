import type { JvpPicDetailsInput } from "@/lib/validations/jvp";

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

export type JvpProjectDetailsState = {
  projectId: string;
  projectCode: string;
  companyId: string;
  companyCode: string;
  companyName: string;
};

export type JvpPicDetailsState = JvpPicDetailsInput;

export type JvpRiskItemState = {
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

export const JVP_STEPPER_STEPS = [
  { id: "basic-information", label: "Basic Information" },
  { id: "project-details", label: "Project Details" },
  { id: "pic", label: "PIC" },
  { id: "jvp-information-1", label: "JVP Information" },
  { id: "jvp-information-2", label: "JVP Information" },
  { id: "jvp-information-3", label: "JVP Information" },
  { id: "documents", label: "Documents" },
] as const;
