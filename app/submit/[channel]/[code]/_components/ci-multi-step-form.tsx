"use client";

import { useCallback, useEffect, useMemo, useState, useTransition, type ChangeEvent } from "react";
import { useRouter } from "next/navigation";
import Button from "@/src/components/ui/button";
import { InputField, SelectField, TextareaField, type SelectFieldOption } from "@/src/components/forms/fields";
import MultiStepStepper from "@/src/components/forms/multi-step-stepper";
import { clearPersistedFormState, readPersistedFormState, writePersistedFormState } from "@/src/components/forms/session-storage";
import UploadedDocumentPreview from "@/src/components/forms/uploaded-document-preview";
import {
  CI_ALLOWED_DOCUMENT_MIME_TYPES,
  CI_FORM_CODE,
  CI_MAX_DOCUMENT_SIZE_BYTES,
  CI_REQUEST_TITLE,
  createCiBaseRequestSchema,
  saveCiDetailsSchema,
  submitCiRequestSchema,
} from "@/lib/validations/ci";
import { createCiBaseRequest, saveCiDetails, submitCiRequest } from "../_actions/ci";
import { CI_STEPPER_STEPS, type ProjectOption, type RequestorContext, type UploadedAssetState } from "../_config/ci-form-schema";

type AlertState = { type: "success" | "error" | "info"; message: string } | null;
type FieldErrors = Record<string, string[]>;

type CiFormProps = {
  channel: "gcpc" | "gcp";
  requestor: RequestorContext;
  projects: ReadonlyArray<ProjectOption>;
  canSubmitRequest: boolean;
};

type PersistedCiState = {
  currentStep: number;
  requestId: string | null;
  requestNo: string | null;
  projectId: string;
  projectCode: string;
  companyId: string;
  companyCode: string;
  companyName: string;
  companyRoleInIssue: string;
  category: string;
  voBriefOfIssues: string;
  voChronologyOfEvent: string;
  voTimeAndCostImpact: string;
  voContractClauseEntitlement: string;
  voAdvisoryRequiredFromGcp: string;
  paymentBriefOfIssues: string;
  paymentChronologyOfEvent: string;
  paymentContractClauseEntitlement: string;
  paymentAdvisoryRequiredFromGcp: string;
  uploadedDocument: UploadedAssetState | null;
  acknowledgement: boolean;
};

const CI_SESSION_STORAGE_KEY = "gcp-central:form:ci:v1";
const MAX_FILE_SIZE_MB = CI_MAX_DOCUMENT_SIZE_BYTES / (1024 * 1024);
const acceptedDocumentTypes = CI_ALLOWED_DOCUMENT_MIME_TYPES.join(",");
const companyRoleOptions: SelectFieldOption[] = [
  { value: "", label: "Select role" },
  { value: "Client Developer / Project Owner", label: "Client Developer / Project Owner" },
  { value: "DB Contractor / Main Contractor Tier 1", label: "DB Contractor / Main Contractor Tier 1" },
  { value: "Subcontractor Tier 2 and below", label: "Subcontractor Tier 2 and below" },
];
const categoryOptions: SelectFieldOption[] = [
  { value: "", label: "Select category" },
  { value: "VARIATION ORDER (VO)", label: "VARIATION ORDER (VO)" },
  { value: "EXTENSION OF TIME (EOT)", label: "EXTENSION OF TIME (EOT)" },
  { value: "LOSS & EXPENSE (L&E)", label: "LOSS & EXPENSE (L&E)" },
];

export default function CiMultiStepForm({ channel, requestor, projects, canSubmitRequest }: CiFormProps) {
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

  const [projectId, setProjectId] = useState("");
  const [projectCode, setProjectCode] = useState("");
  const [companyId] = useState(requestor.companyId);
  const [companyCode] = useState(requestor.companyCode);
  const [companyName] = useState(requestor.companyName);
  const [companyRoleInIssue, setCompanyRoleInIssue] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("");
  const [voBriefOfIssues, setVoBriefOfIssues] = useState("");
  const [voChronologyOfEvent, setVoChronologyOfEvent] = useState("");
  const [voTimeAndCostImpact, setVoTimeAndCostImpact] = useState("");
  const [voContractClauseEntitlement, setVoContractClauseEntitlement] = useState("");
  const [voAdvisoryRequiredFromGcp, setVoAdvisoryRequiredFromGcp] = useState("");
  const [paymentBriefOfIssues, setPaymentBriefOfIssues] = useState("");
  const [paymentChronologyOfEvent, setPaymentChronologyOfEvent] = useState("");
  const [paymentContractClauseEntitlement, setPaymentContractClauseEntitlement] = useState("");
  const [paymentAdvisoryRequiredFromGcp, setPaymentAdvisoryRequiredFromGcp] = useState("");
  const [uploadedDocument, setUploadedDocument] = useState<UploadedAssetState | null>(null);
  const [acknowledgement, setAcknowledgement] = useState(false);

  const isBusy = isPending || isUploading;
  const projectOptions: ReadonlyArray<SelectFieldOption> = useMemo(
    () => [{ value: "", label: projects.length ? "Select a project" : "No projects available" }, ...projects.map((project) => ({ value: project.id, label: project.projectName }))],
    [projects]
  );

  const handleProjectSelection = useCallback(
    (nextProjectId: string) => {
      setProjectId(nextProjectId);
      const selectedProject = projects.find((project) => project.id === nextProjectId);
      setProjectCode(selectedProject?.projectCode?.trim() ?? "");
    },
    [projects]
  );

  useEffect(() => {
    const persisted = readPersistedFormState<PersistedCiState>(CI_SESSION_STORAGE_KEY);
    if (persisted) {
      setCurrentStep(Math.min(Math.max(persisted.currentStep, 1), CI_STEPPER_STEPS.length));
      setRequestId(persisted.requestId);
      setRequestNo(persisted.requestNo);
      setProjectId(persisted.projectId);
      setProjectCode(persisted.projectCode);
      setCompanyRoleInIssue(persisted.companyRoleInIssue);
      setSelectedCategory(persisted.category);
      setVoBriefOfIssues(persisted.voBriefOfIssues);
      setVoChronologyOfEvent(persisted.voChronologyOfEvent);
      setVoTimeAndCostImpact(persisted.voTimeAndCostImpact);
      setVoContractClauseEntitlement(persisted.voContractClauseEntitlement);
      setVoAdvisoryRequiredFromGcp(persisted.voAdvisoryRequiredFromGcp);
      setPaymentBriefOfIssues(persisted.paymentBriefOfIssues);
      setPaymentChronologyOfEvent(persisted.paymentChronologyOfEvent);
      setPaymentContractClauseEntitlement(persisted.paymentContractClauseEntitlement);
      setPaymentAdvisoryRequiredFromGcp(persisted.paymentAdvisoryRequiredFromGcp);
      setUploadedDocument(persisted.uploadedDocument);
      setAcknowledgement(persisted.acknowledgement);
    }
    setHasHydratedFromSession(true);
  }, []);

  useEffect(() => {
    if (!hasHydratedFromSession || isSubmitted) return;
    writePersistedFormState<PersistedCiState>(CI_SESSION_STORAGE_KEY, {
      currentStep,
      requestId,
      requestNo,
      projectId,
      projectCode,
      companyId,
      companyCode,
      companyName,
      companyRoleInIssue,
      category: selectedCategory,
      voBriefOfIssues,
      voChronologyOfEvent,
      voTimeAndCostImpact,
      voContractClauseEntitlement,
      voAdvisoryRequiredFromGcp,
      paymentBriefOfIssues,
      paymentChronologyOfEvent,
      paymentContractClauseEntitlement,
      paymentAdvisoryRequiredFromGcp,
      uploadedDocument,
      acknowledgement,
    });
  }, [acknowledgement, companyCode, companyId, companyName, companyRoleInIssue, currentStep, hasHydratedFromSession, isSubmitted, paymentAdvisoryRequiredFromGcp, paymentBriefOfIssues, paymentChronologyOfEvent, paymentContractClauseEntitlement, projectCode, projectId, requestId, requestNo, selectedCategory, uploadedDocument, voAdvisoryRequiredFromGcp, voBriefOfIssues, voChronologyOfEvent, voContractClauseEntitlement, voTimeAndCostImpact]);

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
    if (!CI_ALLOWED_DOCUMENT_MIME_TYPES.includes(file.type as (typeof CI_ALLOWED_DOCUMENT_MIME_TYPES)[number])) {
      setErrorState("Unsupported file type.");
      return;
    }
    if (file.size <= 0 || file.size > CI_MAX_DOCUMENT_SIZE_BYTES) {
      setErrorState(`File must be within 0-${MAX_FILE_SIZE_MB}MB.`);
      return;
    }

    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.set("file", file);
      formData.set("folder", "gcp-central/ci");
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
      requestType: CI_FORM_CODE,
      routingType: category,
      requestTitle: CI_REQUEST_TITLE,
      category,
      requestorId: requestor.id,
      requestorName: requestor.name,
      requestorEmail: requestor.email,
      companyId: requestor.companyId,
      companyCode: requestor.companyCode,
      companyName: requestor.companyName,
    };
    const validated = createCiBaseRequestSchema.safeParse(payload);
    if (!validated.success) return setErrorState("Please review the pre-populated basic information fields.");
    startTransition(async () => {
      const result = await createCiBaseRequest(validated.data);
      if (!result.success) return setErrorState(result.message, result.fieldErrors);
      setRequestId(result.data.requestId);
      setRequestNo(result.data.requestNo);
      setCurrentStep(2);
      setAlertState({ type: "info", message: `Base request created (${result.data.requestNo}). Continue with project details.` });
    });
  }

  function handleSaveStep2() {
    if (!projectId || !companyRoleInIssue) {
      setErrorState("Please complete project details and role of company.");
      return;
    }
    setCurrentStep(3);
  }

  function handleSaveStep3() {
    if (!selectedCategory || !voBriefOfIssues || !voChronologyOfEvent || !voTimeAndCostImpact || !voContractClauseEntitlement || !voAdvisoryRequiredFromGcp) {
      setErrorState("Please complete all VO, EOT, L&E information fields.");
      return;
    }
    setCurrentStep(4);
  }

  function handleSaveStep4() {
    resetFeedback();
    if (!requestId) return setErrorState("Base request not found. Please complete Step 1 first.");
    const payload = {
      requestId,
      projectId,
      projectCode,
      companyId,
      companyCode,
      companyName,
      companyRoleInIssue,
      category: selectedCategory,
      voBriefOfIssues,
      voChronologyOfEvent,
      voTimeAndCostImpact,
      voContractClauseEntitlement,
      voAdvisoryRequiredFromGcp,
      paymentBriefOfIssues,
      paymentChronologyOfEvent,
      paymentContractClauseEntitlement,
      paymentAdvisoryRequiredFromGcp,
    };
    const validated = saveCiDetailsSchema.safeParse(payload);
    if (!validated.success) return setErrorState("Please complete payment information before proceeding.");
    startTransition(async () => {
      const result = await saveCiDetails(validated.data);
      if (!result.success) return setErrorState(result.message, result.fieldErrors);
      setCurrentStep(5);
      setAlertState({ type: "info", message: "CI details saved. Upload document and submit." });
    });
  }

  function handleFinalSubmit() {
    resetFeedback();
    if (!requestId) return setErrorState("Base request not found.");
    if (!uploadedDocument) return setErrorState("Please upload final document.");
    const payload = { requestId, acknowledgement, ...uploadedDocument };
    const validated = submitCiRequestSchema.safeParse(payload);
    if (!validated.success) return setErrorState("Please complete acknowledgement and document requirements.");
    startTransition(async () => {
      const result = await submitCiRequest(validated.data);
      if (!result.success) return setErrorState(result.message, result.fieldErrors);
      setIsSubmitted(true);
      clearPersistedFormState(CI_SESSION_STORAGE_KEY);
      setAlertState({ type: "success", message: `CI request ${result.data.requestNo} submitted successfully.` });
      router.push("/requests");
    });
  }

  return (
    <div className="surface-card p-5 sm:p-6">
      <MultiStepStepper steps={CI_STEPPER_STEPS} currentStep={currentStep} isSubmitted={isSubmitted} />
      {alertState ? (
        <div className={`alert mb-5 ${alertState.type === "error" ? "alert--danger" : alertState.type === "success" ? "alert--success" : "alert--info"}`}>
          <p className="alert__title">{alertState.type === "error" ? "Action required" : alertState.type === "success" ? "Success" : "Info"}</p>
          <p className="alert__body">{alertState.message}</p>
        </div>
      ) : null}

      {currentStep === 1 ? (
        <section className="space-y-4">
          <p className="text-sm text-[var(--text-muted)]">Please review your basic information before proceeding.</p>
          <div className="grid gap-4 md:grid-cols-2">
            <InputField label="Request Title" value={CI_REQUEST_TITLE} readOnly inputClassName="bg-slate-50" />
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
            <SelectField label="Project Name" required options={projectOptions} value={projectId} onChange={(e) => handleProjectSelection(e.target.value)} />
            <InputField label="Project Code" value={projectCode} readOnly inputClassName="bg-slate-50" />
            <InputField label="Company" value={`${companyName} (${companyCode})`} readOnly inputClassName="bg-slate-50" />
            <SelectField label="Role of Company in this Issue" required options={companyRoleOptions} value={companyRoleInIssue} onChange={(e) => setCompanyRoleInIssue(e.target.value)} />
          </div>
          <div className="flex flex-wrap justify-between gap-3 pt-2">
            <Button type="button" variant="secondary" onClick={() => setCurrentStep(1)} disabled={isBusy}>Previous</Button>
            <Button type="button" onClick={handleSaveStep2} disabled={isBusy}>Next Step</Button>
          </div>
        </section>
      ) : null}

      {currentStep === 3 ? (
        <section className="space-y-4">
          <p className="text-sm font-semibold text-[var(--text)]">VO, EOT, L&E Information</p>
          <div className="grid gap-4">
            <SelectField label="Select Category" required options={categoryOptions} value={selectedCategory} onChange={(e) => setSelectedCategory(e.target.value)} />
            <TextareaField label="Brief of Issues" required value={voBriefOfIssues} onChange={(e) => setVoBriefOfIssues(e.target.value)} />
            <TextareaField label="Chronology of Event" required value={voChronologyOfEvent} onChange={(e) => setVoChronologyOfEvent(e.target.value)} />
            <TextareaField label="Time & Cost Impact" required value={voTimeAndCostImpact} onChange={(e) => setVoTimeAndCostImpact(e.target.value)} />
            <TextareaField label="Contract Clause / Entitlement" required value={voContractClauseEntitlement} onChange={(e) => setVoContractClauseEntitlement(e.target.value)} />
            <TextareaField label="Advisory Required from GCP" required value={voAdvisoryRequiredFromGcp} onChange={(e) => setVoAdvisoryRequiredFromGcp(e.target.value)} />
          </div>
          <div className="flex flex-wrap justify-between gap-3 pt-2">
            <Button type="button" variant="secondary" onClick={() => setCurrentStep(2)} disabled={isBusy}>Previous</Button>
            <Button type="button" onClick={handleSaveStep3} disabled={isBusy}>Next Step</Button>
          </div>
        </section>
      ) : null}

      {currentStep === 4 ? (
        <section className="space-y-4">
          <p className="text-sm font-semibold text-[var(--text)]">Payments Information</p>
          <div className="grid gap-4">
            <TextareaField label="Brief of Issues" required value={paymentBriefOfIssues} onChange={(e) => setPaymentBriefOfIssues(e.target.value)} />
            <TextareaField label="Chronology of Event" required value={paymentChronologyOfEvent} onChange={(e) => setPaymentChronologyOfEvent(e.target.value)} />
            <TextareaField label="Contract Clause / Entitlement" required value={paymentContractClauseEntitlement} onChange={(e) => setPaymentContractClauseEntitlement(e.target.value)} />
            <TextareaField label="Advisory Required from GCP" required value={paymentAdvisoryRequiredFromGcp} onChange={(e) => setPaymentAdvisoryRequiredFromGcp(e.target.value)} />
          </div>
          <div className="flex flex-wrap justify-between gap-3 pt-2">
            <Button type="button" variant="secondary" onClick={() => setCurrentStep(3)} disabled={isBusy}>Previous</Button>
            <Button type="button" onClick={handleSaveStep4} loading={isBusy}>{isBusy ? "Saving..." : "Next Step"}</Button>
          </div>
        </section>
      ) : null}

      {currentStep === 5 ? (
        <section className="space-y-4">
          <div className="space-y-3 rounded-xl border border-[var(--border)] p-4">
            <p className="text-sm font-semibold text-[var(--text)]">Final Document Upload</p>
            <input type="file" accept={acceptedDocumentTypes} onChange={handleFileUpload} className="input py-2" />
            <p className="text-xs text-[var(--text-subtle)]">Allowed: PDF, Word, Excel, JPG, PNG. Max size: {MAX_FILE_SIZE_MB}MB.</p>
            {uploadedDocument ? <UploadedDocumentPreview documentUrl={uploadedDocument.documentUrl} documentFileName={uploadedDocument.documentFileName} documentMimeType={uploadedDocument.documentMimeType} documentSizeBytes={uploadedDocument.documentSizeBytes} /> : null}
          </div>
          <label className="flex items-start gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface-soft)] p-3">
            <input type="checkbox" className="mt-1" checked={acknowledgement} onChange={(e) => setAcknowledgement(e.target.checked)} />
            <span className="text-sm text-[var(--text)]">I acknowledge that the uploaded document and submitted details are accurate.</span>
          </label>
          <div className="flex flex-wrap justify-between gap-3 pt-2">
            <Button type="button" variant="secondary" onClick={() => setCurrentStep(4)} disabled={isBusy || isSubmitted}>Previous</Button>
            {canSubmitRequest ? <Button type="button" onClick={handleFinalSubmit} loading={isBusy || isSubmitted}>{isSubmitted ? "Submitted" : isBusy ? "Submitting..." : "Submit CI"}</Button> : null}
          </div>
        </section>
      ) : null}

      {requestNo ? <p className="mt-5 text-xs text-[var(--text-subtle)]">Request reference: {requestNo}</p> : null}
    </div>
  );
}
