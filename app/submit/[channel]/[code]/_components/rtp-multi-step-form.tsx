"use client";

import { useMemo, useState, useTransition, type ChangeEvent } from "react";
import { useRouter } from "next/navigation";
import Button from "@/src/components/ui/button";
import {
  CheckboxField,
  InputField,
  SelectField,
  TextareaField,
} from "@/src/components/forms/fields";
import MultiStepStepper from "@/src/components/forms/multi-step-stepper";
import { REGISTRATION_TYPES } from "@/src/constants/enums";
import {
  createRtpBaseRequestSchema,
  saveRtpDetailsSchema,
  submitRtpRequestSchema,
  RTP_ALLOWED_DOCUMENT_MIME_TYPES,
  RTP_FORM_CODE,
  RTP_MAX_DOCUMENT_SIZE_BYTES,
} from "@/lib/validations/rtp";
import {
  createRtpBaseRequest,
  saveRtpDetails,
  submitRtpRequest,
} from "../_actions/rtp";

type FieldErrors = Record<string, string[]>;

type AlertState =
  | {
      type: "success" | "error" | "info";
      message: string;
    }
  | null;

type UploadedDocument = {
  documentUrl: string;
  documentPublicId: string;
  documentFileName: string;
  documentMimeType: string;
  documentSizeBytes: number;
};

type RequestorContext = {
  id: string;
  name: string;
  email: string;
  companyId: string;
  companyCode: string;
  companyName: string;
};

type RtpMultiStepFormProps = {
  channel: "gcpc" | "gcp";
  requestTitle: string;
  requestor: RequestorContext;
};

const STEPS = [
  { id: "basic-information", label: "Basic Information" },
  { id: "project-details", label: "Project Details" },
  { id: "documents", label: "Documents" },
] as const;
const MAX_FILE_SIZE_MB = RTP_MAX_DOCUMENT_SIZE_BYTES / (1024 * 1024);
const acceptedDocumentTypes = RTP_ALLOWED_DOCUMENT_MIME_TYPES.join(",");
const registrationTypeOptions = REGISTRATION_TYPES.map((option) => ({
  value: option.value,
  label: option.label,
}));
const documentMetadataSchema = submitRtpRequestSchema.pick({
  documentUrl: true,
  documentPublicId: true,
  documentFileName: true,
  documentMimeType: true,
  documentSizeBytes: true,
});

function flattenFieldErrors(error: { flatten: () => { fieldErrors: FieldErrors } }) {
  return error.flatten().fieldErrors;
}

function formatFileSize(bytes: number) {
  if (bytes < 1024) {
    return `${bytes} B`;
  }

  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }

  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export default function RtpMultiStepForm({
  channel,
  requestTitle,
  requestor,
}: RtpMultiStepFormProps) {
  const router = useRouter();
  const category = useMemo(() => channel.toUpperCase() as "GCP" | "GCPC", [channel]);

  const [currentStep, setCurrentStep] = useState(1);
  const [requestId, setRequestId] = useState<string | null>(null);
  const [requestNo, setRequestNo] = useState<string | null>(null);
  const [projectId, setProjectId] = useState<string | null>(null);
  const [isSubmitted, setIsSubmitted] = useState(false);

  const [details, setDetails] = useState({
    clientName: "",
    registrationType: 1,
    tenderClosingDate: "",
    projectName: "",
    projectDescription: "",
  });

  const [specialProject, setSpecialProject] = useState(false);
  const [acknowledgement, setAcknowledgement] = useState(false);
  const [uploadedDocument, setUploadedDocument] = useState<UploadedDocument | null>(null);

  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [alertState, setAlertState] = useState<AlertState>(null);

  const [isUploading, setIsUploading] = useState(false);
  const [isPending, startTransition] = useTransition();

  const isBusy = isPending || isUploading;

  function setErrorState(message: string, errors?: FieldErrors) {
    setAlertState({ type: "error", message });
    setFieldErrors(errors ?? {});
  }

  function resetFeedback() {
    setAlertState(null);
    setFieldErrors({});
  }

  function getFieldError(name: string) {
    return fieldErrors[name]?.[0];
  }

  const documentUploadError =
    getFieldError("documentFileName") ??
    getFieldError("documentMimeType") ??
    getFieldError("documentSizeBytes");

  function handleCreateBaseRequest() {
    resetFeedback();

    const payload = {
      requestType: RTP_FORM_CODE,
      routingType: category,
      requestTitle,
      category,
      requestorId: requestor.id,
      requestorName: requestor.name,
      requestorEmail: requestor.email,
      companyId: requestor.companyId,
      companyCode: requestor.companyCode,
      companyName: requestor.companyName,
    };

    const validatedInput = createRtpBaseRequestSchema.safeParse(payload);
    if (!validatedInput.success) {
      setErrorState(
        "Please review the pre-populated basic information fields.",
        flattenFieldErrors(validatedInput.error)
      );
      return;
    }

    startTransition(async () => {
      const result = await createRtpBaseRequest(validatedInput.data);

      if (!result.success) {
        setErrorState(result.message, result.fieldErrors);
        return;
      }

      setRequestId(result.data.requestId);
      setRequestNo(result.data.requestNo);
      setCurrentStep(2);
      setAlertState({
        type: "info",
        message: `Base request created (${result.data.requestNo}). Continue with project details.`,
      });
    });
  }

  function handleSaveStep2() {
    resetFeedback();

    if (!requestId) {
      setErrorState("Base request not found. Please complete Step 1 first.");
      setCurrentStep(1);
      return;
    }

    const payload = {
      requestId,
      clientName: details.clientName,
      registrationType: details.registrationType,
      tenderClosingDate: details.tenderClosingDate,
      projectName: details.projectName,
      projectDescription: details.projectDescription,
      companyId: requestor.companyId,
      companyCode: requestor.companyCode,
      companyName: requestor.companyName,
    };

    const validatedInput = saveRtpDetailsSchema.safeParse(payload);
    if (!validatedInput.success) {
      setErrorState("Please correct the project details fields.", flattenFieldErrors(validatedInput.error));
      return;
    }

    startTransition(async () => {
      const result = await saveRtpDetails(validatedInput.data);

      if (!result.success) {
        setErrorState(result.message, result.fieldErrors);
        return;
      }

      setProjectId(result.data.projectId);
      setCurrentStep(3);
      setAlertState({
        type: "info",
        message: "Project details saved. Upload documents and submit the request.",
      });
    });
  }

  async function handleFileUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    resetFeedback();

    if (!RTP_ALLOWED_DOCUMENT_MIME_TYPES.includes(file.type as (typeof RTP_ALLOWED_DOCUMENT_MIME_TYPES)[number])) {
      setErrorState("Unsupported file type.", {
        documentMimeType: ["Please upload PDF, Office, JPG, or PNG files only."],
      });
      return;
    }

    if (file.size <= 0 || file.size > RTP_MAX_DOCUMENT_SIZE_BYTES) {
      setErrorState(`File must be within 0-${MAX_FILE_SIZE_MB}MB.`, {
        documentSizeBytes: [`Maximum allowed file size is ${MAX_FILE_SIZE_MB}MB.`],
      });
      return;
    }

    setIsUploading(true);

    try {
      const formData = new FormData();
      formData.set("file", file);
      formData.set("folder", "gcp-central/rtp");

      const response = await fetch("/api/uploads/cloudinary", {
        method: "POST",
        body: formData,
      });

      const responseData = (await response.json()) as
        | UploadedDocument
        | { message?: string };

      if (!response.ok) {
        const message =
          "message" in responseData && responseData.message
            ? responseData.message
            : "Document upload failed.";
        setErrorState(message);
        return;
      }

      const validatedDocument = documentMetadataSchema.safeParse(responseData);
      if (!validatedDocument.success) {
        setErrorState("Uploaded document metadata is invalid.", flattenFieldErrors(validatedDocument.error));
        return;
      }

      setUploadedDocument(validatedDocument.data);
      setAlertState({
        type: "success",
        message: `Document uploaded: ${validatedDocument.data.documentFileName}`,
      });
    } catch {
      setErrorState("An unexpected error occurred while uploading document.");
    } finally {
      setIsUploading(false);
    }
  }

  function handleFinalSubmit() {
    resetFeedback();

    if (!requestId) {
      setErrorState("Base request not found. Please complete Step 1 first.");
      setCurrentStep(1);
      return;
    }

    if (!projectId) {
      setErrorState("Project details were not saved. Please complete Step 2 first.");
      setCurrentStep(2);
      return;
    }

    if (!uploadedDocument) {
      setErrorState("Please upload at least one document before final submission.", {
        documentFileName: ["Document upload is required"],
      });
      return;
    }

    const payload = {
      requestId,
      acknowledgement,
      specialProject,
      ...uploadedDocument,
    };

    const validatedInput = submitRtpRequestSchema.safeParse(payload);
    if (!validatedInput.success) {
      setErrorState(
        "Please complete acknowledgement and document requirements.",
        flattenFieldErrors(validatedInput.error)
      );
      return;
    }

    startTransition(async () => {
      const result = await submitRtpRequest(validatedInput.data);

      if (!result.success) {
        setErrorState(result.message, result.fieldErrors);
        return;
      }

      setIsSubmitted(true);
      setAlertState({
        type: "success",
        message: `RTP request ${result.data.requestNo} submitted successfully.`,
      });
      router.push("/requests");
    });
  }

  return (
    <div className="surface-card p-5 sm:p-6">
      <MultiStepStepper steps={STEPS} currentStep={currentStep} isSubmitted={isSubmitted} />

      {alertState ? (
        <div
          className={`alert mb-5 ${
            alertState.type === "error"
              ? "alert--danger"
              : alertState.type === "success"
                ? "alert--success"
                : "alert--info"
          }`}
        >
          <p className="alert__title">
            {alertState.type === "error"
              ? "Action required"
              : alertState.type === "success"
                ? "Success"
                : "Info"}
          </p>
          <p className="alert__body">{alertState.message}</p>
        </div>
      ) : null}

      {currentStep === 1 ? (
        <section className="space-y-4">
          <p className="text-sm text-[var(--text-muted)]">
            Request title, category, requestor details, and company are auto-populated and locked.
          </p>

          <div className="grid gap-4 md:grid-cols-2">
            <InputField label="Request Title" value={requestTitle} readOnly inputClassName="bg-slate-50" />
            <InputField label="Category" value={category} readOnly inputClassName="bg-slate-50" />
            <InputField label="Requestor Name" value={requestor.name} readOnly inputClassName="bg-slate-50" />
            <InputField label="Requestor Email" value={requestor.email} readOnly inputClassName="bg-slate-50" />
            <InputField
              label="Company"
              value={`${requestor.companyName} (${requestor.companyCode})`}
              readOnly
              inputClassName="bg-slate-50"
              containerClassName="md:col-span-2"
            />
          </div>

          <div className="flex flex-wrap justify-end gap-3 pt-2">
            <Button href="/submit" variant="secondary" size="md">
              Cancel
            </Button>
            <Button type="button" onClick={handleCreateBaseRequest} loading={isBusy}>
              {isBusy ? "Saving..." : "Next Step"}
            </Button>
          </div>
        </section>
      ) : null}

      {currentStep === 2 ? (
        <section className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <InputField
              label="Client Name"
              value={details.clientName}
              onChange={(event) =>
                setDetails((current) => ({ ...current, clientName: event.target.value }))
              }
              placeholder="Enter client name"
              error={getFieldError("clientName")}
            />

            <SelectField
              label="Registration Type"
              value={details.registrationType}
              onChange={(event) =>
                setDetails((current) => ({
                  ...current,
                  registrationType: Number(event.target.value),
                }))
              }
              options={registrationTypeOptions}
              error={getFieldError("registrationType")}
            />

            <InputField
              label="Tender Closing Date"
              type="date"
              value={details.tenderClosingDate}
              onChange={(event) =>
                setDetails((current) => ({
                  ...current,
                  tenderClosingDate: event.target.value,
                }))
              }
              error={getFieldError("tenderClosingDate")}
            />

            <InputField
              label="Project Name"
              value={details.projectName}
              onChange={(event) =>
                setDetails((current) => ({ ...current, projectName: event.target.value }))
              }
              placeholder="Enter project name"
              error={getFieldError("projectName")}
            />

            <TextareaField
              label="Project Description"
              value={details.projectDescription}
              onChange={(event) =>
                setDetails((current) => ({
                  ...current,
                  projectDescription: event.target.value,
                }))
              }
              placeholder="Describe project scope and objective"
              error={getFieldError("projectDescription")}
              containerClassName="md:col-span-2"
            />

            <InputField
              label="Company"
              value={`${requestor.companyName} (${requestor.companyCode})`}
              readOnly
              inputClassName="bg-slate-50"
              containerClassName="md:col-span-2"
            />
          </div>

          <div className="flex flex-wrap justify-between gap-3 pt-2">
            <Button type="button" variant="secondary" onClick={() => setCurrentStep(1)} disabled={isBusy}>
              Previous
            </Button>
            <Button type="button" onClick={handleSaveStep2} loading={isBusy}>
              {isBusy ? "Saving..." : "Next Step"}
            </Button>
          </div>
        </section>
      ) : null}

      {currentStep === 3 ? (
        <section className="space-y-4">
          <div className="space-y-1">
            <label className="text-sm font-medium text-[var(--text)]">Document Upload</label>
            <input type="file" accept={acceptedDocumentTypes} onChange={handleFileUpload} className="input py-2" />
            <p className="text-xs text-[var(--text-subtle)]">
              Allowed: PDF, Word, Excel, JPG, PNG. Max size: {MAX_FILE_SIZE_MB}MB.
            </p>
            {getFieldError("documentFileName") ? (
              <p className="text-xs text-[var(--danger-text)]">{getFieldError("documentFileName")}</p>
            ) : null}
            {getFieldError("documentMimeType") ? (
              <p className="text-xs text-[var(--danger-text)]">{getFieldError("documentMimeType")}</p>
            ) : null}
            {getFieldError("documentSizeBytes") ? (
              <p className="text-xs text-[var(--danger-text)]">{getFieldError("documentSizeBytes")}</p>
            ) : null}
          </div>

          {uploadedDocument ? (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">
              <p className="font-medium">{uploadedDocument.documentFileName}</p>
              <p className="mt-0.5 text-xs text-emerald-700/90">
                {uploadedDocument.documentMimeType} • {formatFileSize(uploadedDocument.documentSizeBytes)}
              </p>
            </div>
          ) : null}

          <label className="flex items-start gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface-soft)] p-3">
            <input
              type="checkbox"
              checked={acknowledgement}
              onChange={(event) => setAcknowledgement(event.target.checked)}
              className="mt-1"
            />
            <span className="text-sm text-[var(--text)]">
              I acknowledge that the uploaded document and submitted details are accurate.
              <span className="ml-1 text-[var(--danger-text)]">*</span>
            </span>
          </label>
          {getFieldError("acknowledgement") ? (
            <p className="text-xs text-[var(--danger-text)]">{getFieldError("acknowledgement")}</p>
          ) : null}

          <label className="flex items-start gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface-soft)] p-3">
            <input
              type="checkbox"
              checked={specialProject}
              onChange={(event) => setSpecialProject(event.target.checked)}
              className="mt-1"
            />
            <span className="text-sm text-[var(--text)]">Special project (optional)</span>
          </label>

          <div className="flex flex-wrap justify-between gap-3 pt-2">
            <Button type="button" variant="secondary" onClick={() => setCurrentStep(2)} disabled={isBusy || isSubmitted}>
              Previous
            </Button>
            <Button type="button" onClick={handleFinalSubmit} loading={isBusy || isSubmitted}>
              {isSubmitted ? "Submitted" : isBusy ? "Submitting..." : "Submit RTP"}
            </Button>
          </div>
        </section>
      ) : null}

      {requestNo ? (
        <p className="mt-5 text-xs text-[var(--text-subtle)]">Request reference: {requestNo}</p>
      ) : null}
    </div>
  );
}
