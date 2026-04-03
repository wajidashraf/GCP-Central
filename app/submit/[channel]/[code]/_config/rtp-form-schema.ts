import type { ChangeEvent } from "react";
import type { ConfigDrivenStepDefinition } from "@/src/components/forms/config-driven-fields";
import { REGISTRATION_TYPES } from "@/src/constants/enums";

export type RequestorContext = {
  id: string;
  name: string;
  email: string;
  companyId: string;
  companyCode: string;
  companyName: string;
};

export type RtpDetailsState = {
  clientName: string;
  registrationType: number;
  tenderClosingDate: string;
  projectName: string;
  projectDescription: string;
};

export type RtpFormSchemaContext = {
  requestTitle: string;
  category: "GCP" | "GCPC";
  requestor: RequestorContext;
  details: RtpDetailsState;
  updateDetails: (updates: Partial<RtpDetailsState>) => void;
  acceptedDocumentTypes: string;
  maxFileSizeMb: number;
  onFileUpload: (event: ChangeEvent<HTMLInputElement>) => void;
  acknowledgement: boolean;
  setAcknowledgement: (value: boolean) => void;
  specialProject: boolean;
  setSpecialProject: (value: boolean) => void;
};

const registrationTypeOptions = REGISTRATION_TYPES.map((option) => ({
  value: option.value,
  label: option.label,
}));

export const RTP_FORM_STEPS: ReadonlyArray<
  ConfigDrivenStepDefinition<RtpFormSchemaContext>
> = [
  {
    id: "basic-information",
    label: "Basic Information",
    description:
      "Request title, category, requestor details, and company are auto-populated and locked.",
    fieldsContainerClassName: "grid gap-4 md:grid-cols-2",
    fields: [
      {
        id: "request-title",
        kind: "input",
        label: "Request Title",
        value: (context) => context.requestTitle,
        readOnly: true,
        inputClassName: "bg-slate-50",
      },
      {
        id: "category",
        kind: "input",
        label: "Category",
        value: (context) => context.category,
        readOnly: true,
        inputClassName: "bg-slate-50",
      },
      {
        id: "requestor-name",
        kind: "input",
        label: "Requestor Name",
        value: (context) => context.requestor.name,
        readOnly: true,
        inputClassName: "bg-slate-50",
      },
      {
        id: "requestor-email",
        kind: "input",
        label: "Requestor Email",
        value: (context) => context.requestor.email,
        readOnly: true,
        inputClassName: "bg-slate-50",
      },
      {
        id: "company",
        kind: "input",
        label: "Company",
        value: (context) =>
          `${context.requestor.companyName} (${context.requestor.companyCode})`,
        readOnly: true,
        inputClassName: "bg-slate-50",
        containerClassName: "md:col-span-2",
      },
    ],
  },
  {
    id: "project-details",
    label: "Project Details",
    fieldsContainerClassName: "grid gap-4 md:grid-cols-2",
    fields: [
      {
        id: "client-name",
        kind: "input",
        label: "Client Name",
        value: (context) => context.details.clientName,
        onChange: (event, context) =>
          context.updateDetails({ clientName: event.target.value }),
        placeholder: "Enter client name",
        errorKey: "clientName",
      },
      {
        id: "registration-type",
        kind: "select",
        label: "Registration Type",
        options: registrationTypeOptions,
        value: (context) => context.details.registrationType,
        onChange: (event, context) =>
          context.updateDetails({
            registrationType: Number(event.target.value),
          }),
        errorKey: "registrationType",
      },
      {
        id: "tender-closing-date",
        kind: "input",
        inputType: "date",
        label: "Tender Closing Date",
        value: (context) => context.details.tenderClosingDate,
        onChange: (event, context) =>
          context.updateDetails({ tenderClosingDate: event.target.value }),
        errorKey: "tenderClosingDate",
      },
      {
        id: "project-name",
        kind: "input",
        label: "Project Name",
        value: (context) => context.details.projectName,
        onChange: (event, context) =>
          context.updateDetails({ projectName: event.target.value }),
        placeholder: "Enter project name",
        errorKey: "projectName",
      },
      {
        id: "project-description",
        kind: "textarea",
        label: "Project Description",
        value: (context) => context.details.projectDescription,
        onChange: (event, context) =>
          context.updateDetails({ projectDescription: event.target.value }),
        placeholder: "Describe project scope and objective",
        errorKey: "projectDescription",
        containerClassName: "md:col-span-2",
      },
      {
        id: "company-info",
        kind: "input",
        label: "Company",
        value: (context) =>
          `${context.requestor.companyName} (${context.requestor.companyCode})`,
        readOnly: true,
        inputClassName: "bg-slate-50",
        containerClassName: "md:col-span-2",
      },
    ],
  },
  {
    id: "documents",
    label: "Documents",
    fieldsContainerClassName: "space-y-4",
    fields: [
      {
        id: "document-upload",
        kind: "input",
        inputType: "file",
        label: "Document Upload",
        accept: (context) => context.acceptedDocumentTypes,
        onChange: (event, context) => context.onFileUpload(event),
        inputClassName: "py-2",
        hint: (context) =>
          `Allowed: PDF, Word, Excel, JPG, PNG. Max size: ${context.maxFileSizeMb}MB.`,
        errorKey: "documentUpload",
      },
      {
        id: "acknowledgement",
        kind: "checkbox",
        label: "I acknowledge that the uploaded document and submitted details are accurate.",
        checked: (context) => context.acknowledgement,
        onChange: (event, context) => context.setAcknowledgement(event.target.checked),
        required: true,
        errorKey: "acknowledgement",
      },
      {
        id: "special-project",
        kind: "checkbox",
        label: "Special project (optional)",
        checked: (context) => context.specialProject,
        onChange: (event, context) => context.setSpecialProject(event.target.checked),
      },
    ],
  },
] as const;

export const RTP_STEPPER_STEPS = RTP_FORM_STEPS.map((step) => ({
  id: step.id,
  label: step.label,
}));
