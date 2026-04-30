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

export type OthersDetailsState = {
  projectId: string;
  projectCode: string;
  companyId: string;
  companyCode: string;
  companyName: string;
  descriptionOfMatters: string;
};

export type UploadedAssetState = {
  documentUrl: string;
  documentPublicId: string;
  documentFileName: string;
  documentMimeType: string;
  documentSizeBytes: number;
};

export const OTHERS_STEPPER_STEPS = [
  { id: "basic-information", label: "Basic Information" },
  { id: "project-details", label: "Project Details" },
  { id: "documents", label: "Documents" },
] as const;
