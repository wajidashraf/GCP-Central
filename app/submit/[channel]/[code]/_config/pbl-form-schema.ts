import type { ChangeEvent } from "react";
import type { ConfigDrivenStepDefinition } from "@/src/components/forms/config-driven-fields";
import { PROCUREMENT_METHODS } from "@/src/constants/enums";

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

export type PblDetailsState = {
  projectId: string;
  projectCode: string;
  companyId: string;
  companyCode: string;
  companyName: string;
  procurementMethod: number;
};

export type PblFormSchemaContext = {
  requestTitle: string;
  category: "GCP" | "GCPC";
  requestor: RequestorContext;
  projectOptions: ReadonlyArray<ProjectOption>;
  details: PblDetailsState;
  onProjectSelect: (projectId: string) => void;
  updateDetails: (updates: Partial<PblDetailsState>) => void;
  acceptedDocumentTypes: string;
  maxFileSizeMb: number;
  onFileUpload: (event: ChangeEvent<HTMLInputElement>) => void;
  acknowledgement: boolean;
  setAcknowledgement: (value: boolean) => void;
};

const procurementMethodOptions = PROCUREMENT_METHODS.map((option) => ({
  value: option.value,
  label: option.label,
}));

export const PBL_FORM_STEPS: ReadonlyArray<
  ConfigDrivenStepDefinition<PblFormSchemaContext>
> = [
  {
    id: "basic-information",
    label: "Basic Information",
    description:
      "Request title, category, and requestor details are auto-populated and locked.",
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
    ],
  },
  {
    id: "project-details",
    label: "Project Details",
    description:
      "Select a project from the database. Project code and company are auto-filled and locked.",
    fieldsContainerClassName: "grid gap-4 md:grid-cols-2",
    fields: [
      {
        id: "project",
        kind: "select",
        label: "Project Name",
        required: true,
        options: (context) => [
          {
            value: "",
            label:
              context.projectOptions.length > 0
                ? "Select a project"
                : "No projects available",
          },
          ...context.projectOptions.map((project) => ({
            value: project.id,
            label: project.projectName,
          })),
        ],
        value: (context) => context.details.projectId,
        onChange: (event, context) => context.onProjectSelect(event.target.value),
        errorKey: "projectId",
      },
      {
        id: "project-code",
        kind: "input",
        label: "Project Code",
        value: (context) => context.details.projectCode,
        readOnly: true,
        inputClassName: "bg-slate-50",
        placeholder: "Project code",
        errorKey: "projectCode",
      },
      {
        id: "company",
        kind: "input",
        label: "Company",
        value: (context) =>
          `${context.details.companyName} (${context.details.companyCode})`,
        readOnly: true,
        inputClassName: "bg-slate-50",
      },
      {
        id: "procurement-method",
        kind: "select",
        label: "Procurement Method",
        required: true,
        options: procurementMethodOptions,
        value: (context) => context.details.procurementMethod,
        onChange: (event, context) =>
          context.updateDetails({
            procurementMethod: Number(event.target.value),
          }),
        errorKey: "procurementMethod",
      },
    ],
  },
  {
    id: "bidders-list",
    label: "Bidders List",
    description:
      "Add one or more prospective bidders. If fewer than 3 bidders are provided, a justification is required.",
    fields: [],
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
        required: true,
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
    ],
  },
] as const;

export const PBL_STEPPER_STEPS = PBL_FORM_STEPS.map((step) => ({
  id: step.id,
  label: step.label,
}));
