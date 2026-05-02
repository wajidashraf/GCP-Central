"use client";

import { useCallback, useEffect, useMemo, useState, useTransition, type ChangeEvent } from "react";
import { useRouter } from "next/navigation";
import Button from "@/src/components/ui/button";
import { InputField, SelectField, type SelectFieldOption } from "@/src/components/forms/fields";
import MultiStepStepper from "@/src/components/forms/multi-step-stepper";
import { clearPersistedFormState, readPersistedFormState, writePersistedFormState } from "@/src/components/forms/session-storage";
import UploadedDocumentPreview from "@/src/components/forms/uploaded-document-preview";
import {
  PP_ALLOWED_DOCUMENT_MIME_TYPES,
  PP_FORM_CODE,
  PP_MAX_DOCUMENT_SIZE_BYTES,
  PP_REQUEST_TITLE,
  createPpBaseRequestSchema,
  savePpDetailsSchema,
  submitPpRequestSchema,
} from "@/lib/validations/pp";
import { createPpBaseRequest, savePpDetails, submitPpRequest } from "../_actions/pp";
import { PP_STEPPER_STEPS, type PpDetailsState, type ProjectOption, type RequestorContext, type UploadedAssetState } from "../_config/pp-form-schema";

type FieldErrors = Record<string, string[]>;
type AlertState = { type: "success" | "error" | "info"; message: string } | null;
type PpFormProps = {
  channel: "gcpc" | "gcp";
  requestor: RequestorContext;
  projects: ReadonlyArray<ProjectOption>;
  canSubmitRequest: boolean;
};

type PersistedPpState = {
  currentStep: number;
  requestId: string | null;
  requestNo: string | null;
  details: PpDetailsState;
  uploadedDocument: UploadedAssetState | null;
  acknowledgement: boolean;
};

const PP_SESSION_STORAGE_KEY = "gcp-central:form:pp:v1";
const MAX_FILE_SIZE_MB = PP_MAX_DOCUMENT_SIZE_BYTES / (1024 * 1024);
const acceptedDocumentTypes = PP_ALLOWED_DOCUMENT_MIME_TYPES.join(",");

export default function PpMultiStepForm({ channel, requestor, projects, canSubmitRequest }: PpFormProps) {
  const router = useRouter();
  const category = useMemo(() => channel.toUpperCase() as "GCP" | "GCPC", [channel]);
  const [currentStep, setCurrentStep] = useState(1);
  const [requestId, setRequestId] = useState<string | null>(null);
  const [requestNo, setRequestNo] = useState<string | null>(null);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [alertState, setAlertState] = useState<AlertState>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [hasHydratedFromSession, setHasHydratedFromSession] = useState(false);

  const [details, setDetails] = useState<PpDetailsState>({
    projectId: "",
    projectCode: "",
    companyId: requestor.companyId,
    companyCode: requestor.companyCode,
    companyName: requestor.companyName,
  });
  const [uploadedDocument, setUploadedDocument] = useState<UploadedAssetState | null>(null);
  const [acknowledgement, setAcknowledgement] = useState(false);

  const isBusy = isPending || isUploading;

  const projectOptions: ReadonlyArray<SelectFieldOption> = useMemo(
    () => [{ value: "", label: projects.length ? "Select a project" : "No projects available" }, ...projects.map((project) => ({ value: project.id, label: project.projectName }))],
    [projects]
  );

  const handleProjectSelection = useCallback(
    (projectId: string) => {
      const selectedProject = projects.find((project) => project.id === projectId);
      if (!selectedProject) {
        setDetails((current) => ({
          ...current,
          projectId: "",
          projectCode: "",
          companyId: requestor.companyId,
          companyCode: requestor.companyCode,
          companyName: requestor.companyName,
        }));
        return;
      }
      setDetails((current) => ({
        ...current,
        projectId: selectedProject.id,
        projectCode: selectedProject.projectCode.trim(),
        companyId: requestor.companyId,
        companyCode: requestor.companyCode,
        companyName: requestor.companyName,
      }));
    },
    [projects, requestor.companyCode, requestor.companyId, requestor.companyName]
  );

  useEffect(() => {
    const persisted = readPersistedFormState<PersistedPpState>(PP_SESSION_STORAGE_KEY);
    if (persisted) {
      setCurrentStep(Math.min(Math.max(persisted.currentStep, 1), PP_STEPPER_STEPS.length));
      setRequestId(persisted.requestId);
      setRequestNo(persisted.requestNo);
      setDetails(persisted.details);
      setUploadedDocument(persisted.uploadedDocument);
      setAcknowledgement(persisted.acknowledgement);
    }
    setHasHydratedFromSession(true);
  }, []);

  useEffect(() => {
    if (!hasHydratedFromSession || isSubmitted) return;
    writePersistedFormState<PersistedPpState>(PP_SESSION_STORAGE_KEY, {
      currentStep,
      requestId,
      requestNo,
      details,
      uploadedDocument,
      acknowledgement,
    });
  }, [acknowledgement, currentStep, details, hasHydratedFromSession, isSubmitted, requestId, requestNo, uploadedDocument]);

  function setErrorState(message: string, errors?: FieldErrors) {
    setAlertState({ type: "error", message });
    void errors;
  }
  function resetFeedback() {
    setAlertState(null);
  }

  async function handleFileUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    resetFeedback();
    if (!PP_ALLOWED_DOCUMENT_MIME_TYPES.includes(file.type as (typeof PP_ALLOWED_DOCUMENT_MIME_TYPES)[number])) {
      setErrorState("Unsupported file type.");
      return;
    }
    if (file.size <= 0 || file.size > PP_MAX_DOCUMENT_SIZE_BYTES) {
      setErrorState(`File must be within 0-${MAX_FILE_SIZE_MB}MB.`);
      return;
    }

    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.set("file", file);
      formData.set("folder", "gcp-central/pp");
      const response = await fetch("/api/uploads/cloudinary", { method: "POST", body: formData });
      const responseData = (await response.json()) as UploadedAssetState | { message?: string };
      if (!response.ok) {
        const message = "message" in responseData && responseData.message ? responseData.message : "Document upload failed.";
        setErrorState(message);
        return;
      }
      setUploadedDocument(responseData as UploadedAssetState);
      setAlertState({ type: "success", message: `Document uploaded: ${(responseData as UploadedAssetState).documentFileName}` });
    } catch {
      setErrorState("Unexpected upload error.");
    } finally {
      setIsUploading(false);
    }
  }

  function handleCreateBaseRequest() {
    resetFeedback();
    const payload = {
      requestType: PP_FORM_CODE,
      routingType: category,
      requestTitle: PP_REQUEST_TITLE,
      category,
      requestorId: requestor.id,
      requestorName: requestor.name,
      requestorEmail: requestor.email,
      companyId: requestor.companyId,
      companyCode: requestor.companyCode,
      companyName: requestor.companyName,
    };
    const validated = createPpBaseRequestSchema.safeParse(payload);
    if (!validated.success) return setErrorState("Please review the pre-populated basic information fields.");
    startTransition(async () => {
      const result = await createPpBaseRequest(validated.data);
      if (!result.success) return setErrorState(result.message, result.fieldErrors);
      setRequestId(result.data.requestId);
      setRequestNo(result.data.requestNo);
      setCurrentStep(2);
      setAlertState({ type: "info", message: `Base request created (${result.data.requestNo}). Continue with project details.` });
    });
  }

  function handleSaveStep2() {
    resetFeedback();
    if (!requestId) return setErrorState("Base request not found. Please complete Step 1 first.");
    const payload = {
      requestId,
      projectId: details.projectId,
      projectCode: details.projectCode,
      companyId: details.companyId,
      companyCode: details.companyCode,
      companyName: details.companyName,
    };
    const validated = savePpDetailsSchema.safeParse(payload);
    if (!validated.success) return setErrorState("Please correct project details.");
    startTransition(async () => {
      const result = await savePpDetails(validated.data);
      if (!result.success) return setErrorState(result.message, result.fieldErrors);
      setCurrentStep(3);
      setAlertState({ type: "info", message: "Project details saved. Upload document and submit." });
    });
  }

  function handleFinalSubmit() {
    resetFeedback();
    if (!requestId) return setErrorState("Base request not found.");
    if (!uploadedDocument) return setErrorState("Please upload final document.");
    const payload = { requestId, acknowledgement, ...uploadedDocument };
    const validated = submitPpRequestSchema.safeParse(payload);
    if (!validated.success) return setErrorState("Please complete acknowledgement and document requirements.");
    startTransition(async () => {
      const result = await submitPpRequest(validated.data);
      if (!result.success) return setErrorState(result.message, result.fieldErrors);
      setIsSubmitted(true);
      clearPersistedFormState(PP_SESSION_STORAGE_KEY);
      setAlertState({ type: "success", message: `PP request ${result.data.requestNo} submitted successfully.` });
      router.push("/requests");
    });
  }

  return (
    <div className="surface-card p-5 sm:p-6">
      <MultiStepStepper steps={PP_STEPPER_STEPS} currentStep={currentStep} isSubmitted={isSubmitted} />
      {alertState ? (
        <div className={`alert mb-5 ${alertState.type === "error" ? "alert--danger" : alertState.type === "success" ? "alert--success" : "alert--info"}`}>
          <p className="alert__title">{alertState.type === "error" ? "Action required" : alertState.type === "success" ? "Success" : "Info"}</p>
          <p className="alert__body">{alertState.message}</p>
        </div>
      ) : null}

      {currentStep === 1 ? (
        <section className="space-y-4">
          <p className="text-sm text-[var(--text-muted)]">Review your basic information before proceeding.</p>
          <div className="grid gap-4 md:grid-cols-2">
            <InputField label="Request Title" value={PP_REQUEST_TITLE} readOnly inputClassName="bg-slate-50" />
            <InputField label="Category" value={category} readOnly inputClassName="bg-slate-50" />
            <InputField label="Requestor Name" value={requestor.name} readOnly inputClassName="bg-slate-50" />
            <InputField label="Requestor Email" value={requestor.email} readOnly inputClassName="bg-slate-50" />
          </div>
          <div className="flex flex-wrap justify-end gap-3 pt-2">
            <Button href="/submit" variant="secondary" size="md">Cancel</Button>
            <Button type="button" onClick={handleCreateBaseRequest} loading={isBusy}>{isBusy ? "Saving..." : "Next Step"}</Button>
          </div>
        </section>
      ) : null}

      {currentStep === 2 ? (
        <section className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <SelectField label="Project Name" required options={projectOptions} value={details.projectId} onChange={(e) => handleProjectSelection(e.target.value)} />
            <InputField label="Project Code" value={details.projectCode} readOnly inputClassName="bg-slate-50" />
            <InputField label="Company" value={`${details.companyName} (${details.companyCode})`} readOnly inputClassName="bg-slate-50" containerClassName="md:col-span-2" />
          </div>
          <div className="flex flex-wrap justify-between gap-3 pt-2">
            <Button type="button" variant="secondary" onClick={() => setCurrentStep(1)} disabled={isBusy}>Previous</Button>
            <Button type="button" onClick={handleSaveStep2} loading={isBusy}>{isBusy ? "Saving..." : "Next Step"}</Button>
          </div>
        </section>
      ) : null}

      {currentStep === 3 ? (
        <section className="space-y-4">
          <div className="upload-section">
            <p className="text-sm font-semibold text-[var(--text)]">Final Document Upload</p>
            <input type="file" accept={acceptedDocumentTypes} onChange={handleFileUpload} className="input py-2" />
            <p className="text-xs text-[var(--text-subtle)]">Allowed: PDF, Word, Excel, JPG, PNG. Max size: {MAX_FILE_SIZE_MB}MB.</p>
            {uploadedDocument ? <UploadedDocumentPreview documentUrl={uploadedDocument.documentUrl} documentPublicId={uploadedDocument.documentPublicId} documentFileName={uploadedDocument.documentFileName} documentMimeType={uploadedDocument.documentMimeType} documentSizeBytes={uploadedDocument.documentSizeBytes} requestId={requestId} requestType={PP_FORM_CODE} onRemoved={() => { setUploadedDocument(null); setAlertState({ type: "info", message: "Uploaded document removed." }); }} /> : null}
          </div>
          <label className="flex items-start gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface-soft)] p-3">
            <input type="checkbox" className="mt-1" checked={acknowledgement} onChange={(e) => setAcknowledgement(e.target.checked)} />
            <span className="text-sm text-[var(--text)]">I acknowledge that the uploaded document and submitted details are accurate.</span>
          </label>
          <div className="flex flex-wrap justify-between gap-3 pt-2">
            <Button type="button" variant="secondary" onClick={() => setCurrentStep(2)} disabled={isBusy || isSubmitted}>Previous</Button>
            {canSubmitRequest ? <Button type="button" onClick={handleFinalSubmit} loading={isBusy || isSubmitted}>{isSubmitted ? "Submitted" : isBusy ? "Submitting..." : "Submit PP"}</Button> : null}
          </div>
        </section>
      ) : null}

      {requestNo ? <p className="mt-5 text-xs text-[var(--text-subtle)]">Request reference: {requestNo}</p> : null}
    </div>
  );
}
