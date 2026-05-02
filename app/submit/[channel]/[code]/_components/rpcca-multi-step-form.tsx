"use client";

import { useCallback, useEffect, useMemo, useState, useTransition, type ChangeEvent } from "react";
import { useRouter } from "next/navigation";
import Button from "@/src/components/ui/button";
import SquareCloseIcon from "@/src/components/ui/square-close-icon";
import { InputField, SelectField, type SelectFieldOption } from "@/src/components/forms/fields";
import MultiStepStepper from "@/src/components/forms/multi-step-stepper";
import { clearPersistedFormState, readPersistedFormState, writePersistedFormState } from "@/src/components/forms/session-storage";
import UploadedDocumentPreview from "@/src/components/forms/uploaded-document-preview";
import {
  PCCA_ALLOWED_DOCUMENT_MIME_TYPES,
  PCCA_MAX_DOCUMENT_SIZE_BYTES,
  REVISED_PCCA_FORM_CODE,
  REVISED_PCCA_REQUEST_TITLE,
  createPccaBaseRequestSchema,
  savePccaDetailsSchema,
  savePccaProjectDetailsSchema,
  submitPccaRequestSchema,
} from "@/lib/validations/pcca";
import { createPccaBaseRequest, savePccaDetails, savePccaProjectDetails, submitPccaRequest } from "../_actions/pcca";
import type { ProjectOption, RequestorContext, UploadedAssetState } from "../_config/pcca-form-schema";

type AlertState = { type: "success" | "error" | "info"; message: string } | null;

type RpccaWorkItemRow = {
  workDescription: string;
  revenue: string;
  cost: string;
  voDescription: string;
  voRevenue: string;
  voCost: string;
};

type RpccaFormProps = {
  channel: "gcpc" | "gcp";
  requestor: RequestorContext;
  projects: ReadonlyArray<ProjectOption>;
  canSubmitRequest: boolean;
};

type PersistedRpccaState = {
  currentStep: number;
  requestId: string | null;
  requestNo: string | null;
  projectId: string;
  projectCode: string;
  companyId: string;
  companyCode: string;
  companyName: string;
  workItemRows: RpccaWorkItemRow[];
  remarks: string;
  uploadedDocument: UploadedAssetState | null;
  acknowledgement: boolean;
};

const RPCCA_SESSION_STORAGE_KEY = "gcp-central:form:rpcca:v1";
const RPCCA_STEPS = [
  { id: "basic-information", label: "Basic Information" },
  { id: "project-details", label: "Project Details" },
  { id: "work-item-entry", label: "Work Item Entry" },
  { id: "documents", label: "Documents" },
] as const;
const MAX_FILE_SIZE_MB = PCCA_MAX_DOCUMENT_SIZE_BYTES / (1024 * 1024);
const acceptedDocumentTypes = PCCA_ALLOWED_DOCUMENT_MIME_TYPES.join(",");

export default function RpccaMultiStepForm({ channel, requestor, projects, canSubmitRequest }: RpccaFormProps) {
  const router = useRouter();
  const category = useMemo(() => channel.toUpperCase() as "GCP" | "GCPC", [channel]);
  const [currentStep, setCurrentStep] = useState(1);
  const [requestId, setRequestId] = useState<string | null>(null);
  const [requestNo, setRequestNo] = useState<string | null>(null);
  const [projectId, setProjectId] = useState("");
  const [projectCode, setProjectCode] = useState("");
  const [companyId] = useState(requestor.companyId);
  const [companyCode] = useState(requestor.companyCode);
  const [companyName] = useState(requestor.companyName);
  const [workItemRows, setWorkItemRows] = useState<RpccaWorkItemRow[]>([
    { workDescription: "", revenue: "", cost: "", voDescription: "", voRevenue: "", voCost: "" },
  ]);
  const [remarks, setRemarks] = useState("");
  const [uploadedDocument, setUploadedDocument] = useState<UploadedAssetState | null>(null);
  const [acknowledgement, setAcknowledgement] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [alertState, setAlertState] = useState<AlertState>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [hasHydratedFromSession, setHasHydratedFromSession] = useState(false);
  const isBusy = isUploading || isPending;

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
    const persisted = readPersistedFormState<PersistedRpccaState>(RPCCA_SESSION_STORAGE_KEY);
    if (persisted) {
      setCurrentStep(Math.min(Math.max(persisted.currentStep, 1), RPCCA_STEPS.length));
      setRequestId(persisted.requestId);
      setRequestNo(persisted.requestNo);
      setProjectId(persisted.projectId);
      setProjectCode(persisted.projectCode);
      setWorkItemRows(persisted.workItemRows);
      setRemarks(persisted.remarks);
      setUploadedDocument(persisted.uploadedDocument);
      setAcknowledgement(persisted.acknowledgement);
    }
    setHasHydratedFromSession(true);
  }, []);

  useEffect(() => {
    if (!hasHydratedFromSession || isSubmitted) return;
    writePersistedFormState<PersistedRpccaState>(RPCCA_SESSION_STORAGE_KEY, {
      currentStep,
      requestId,
      requestNo,
      projectId,
      projectCode,
      companyId,
      companyCode,
      companyName,
      workItemRows,
      remarks,
      uploadedDocument,
      acknowledgement,
    });
  }, [acknowledgement, companyCode, companyId, companyName, currentStep, hasHydratedFromSession, isSubmitted, projectCode, projectId, remarks, requestId, requestNo, uploadedDocument, workItemRows]);

  function setError(message: string) {
    setAlertState({ type: "error", message });
  }

  function resetFeedback() {
    setAlertState(null);
  }

  async function handleFileUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    resetFeedback();

    if (!PCCA_ALLOWED_DOCUMENT_MIME_TYPES.includes(file.type as (typeof PCCA_ALLOWED_DOCUMENT_MIME_TYPES)[number])) {
      setError("Unsupported file type.");
      return;
    }
    if (file.size <= 0 || file.size > PCCA_MAX_DOCUMENT_SIZE_BYTES) {
      setError(`File must be within 0-${MAX_FILE_SIZE_MB}MB.`);
      return;
    }

    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.set("file", file);
      formData.set("folder", "gcp-central/rpcca");
      const response = await fetch("/api/uploads/cloudinary", { method: "POST", body: formData });
      const responseData = (await response.json()) as UploadedAssetState | { message?: string };
      if (!response.ok) {
        setError("message" in responseData && responseData.message ? responseData.message : "Document upload failed.");
        return;
      }
      setUploadedDocument(responseData as UploadedAssetState);
      setAlertState({ type: "success", message: `Document uploaded: ${(responseData as UploadedAssetState).documentFileName}` });
    } catch {
      setError("Unexpected upload error.");
    } finally {
      setIsUploading(false);
    }
  }

  function handleCreateBaseRequest() {
    resetFeedback();
    const payload = {
      requestType: REVISED_PCCA_FORM_CODE,
      routingType: category,
      requestTitle: REVISED_PCCA_REQUEST_TITLE,
      category,
      requestorId: requestor.id,
      requestorName: requestor.name,
      requestorEmail: requestor.email,
      companyId: requestor.companyId,
      companyCode: requestor.companyCode,
      companyName: requestor.companyName,
    };

    const validated = createPccaBaseRequestSchema.safeParse(payload);
    if (!validated.success) return setError("Please review the pre-populated basic information fields.");

    startTransition(async () => {
      const result = await createPccaBaseRequest(validated.data);
      if (!result.success) return setError(result.message);
      setRequestId(result.data.requestId);
      setRequestNo(result.data.requestNo);
      setCurrentStep(2);
      setAlertState({ type: "info", message: `Base request created (${result.data.requestNo}). Continue with project details.` });
    });
  }

  function handleSaveStep2() {
    resetFeedback();
    if (!requestId) return setError("Base request not found. Please complete Step 1 first.");

    const payload = { requestId, projectId, projectCode, companyId, companyCode, companyName };
    const validated = savePccaProjectDetailsSchema.safeParse(payload);
    if (!validated.success) return setError("Please correct project details.");

    startTransition(async () => {
      const result = await savePccaProjectDetails(validated.data);
      if (!result.success) return setError(result.message);
      setCurrentStep(3);
    });
  }

  function handleSaveStep3() {
    resetFeedback();
    if (!requestId) return setError("Base request not found. Please complete Step 1 first.");

    const hasAnyValue = workItemRows.some((row) =>
      [row.workDescription, row.revenue, row.cost, row.voDescription, row.voRevenue, row.voCost].some((value) => value.trim() !== "")
    );
    if (!hasAnyValue) return setError("Please add at least one work item entry.");

    const payload = {
      requestId,
      priceRevenueFromContractBq: workItemRows,
      costFromContractBq: [],
      remarks,
    };
    const validated = savePccaDetailsSchema.safeParse(payload);
    if (!validated.success) return setError("Please complete Work Item Entry before proceeding.");

    startTransition(async () => {
      const result = await savePccaDetails(validated.data);
      if (!result.success) return setError(result.message);
      setCurrentStep(4);
      setAlertState({ type: "info", message: "Work Item Entry saved. Upload supporting documents to submit." });
    });
  }

  function handleFinalSubmit() {
    resetFeedback();
    if (!requestId) return setError("Base request not found.");
    if (!uploadedDocument) return setError("Please upload final document.");

    const payload = { requestId, acknowledgement, ...uploadedDocument };
    const validated = submitPccaRequestSchema.safeParse(payload);
    if (!validated.success) return setError("Please complete acknowledgement and document requirements.");

    startTransition(async () => {
      const result = await submitPccaRequest(validated.data);
      if (!result.success) return setError(result.message);
      setIsSubmitted(true);
      clearPersistedFormState(RPCCA_SESSION_STORAGE_KEY);
      setAlertState({ type: "success", message: `RPCCA request ${result.data.requestNo} submitted successfully.` });
      router.push("/requests");
    });
  }

  return (
    <div className="surface-card p-5 sm:p-6">
      <MultiStepStepper steps={RPCCA_STEPS} currentStep={currentStep} isSubmitted={isSubmitted} />
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
            <InputField label="Request Title" value={REVISED_PCCA_REQUEST_TITLE} readOnly inputClassName="bg-slate-50" />
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
            <InputField label="Company" value={`${companyName} (${companyCode})`} readOnly inputClassName="bg-slate-50" containerClassName="md:col-span-2" />
          </div>
          <div className="flex flex-wrap justify-between gap-3 pt-2">
            <Button type="button" variant="secondary" onClick={() => setCurrentStep(1)} disabled={isBusy}>Previous</Button>
            <Button type="button" onClick={handleSaveStep2} loading={isBusy}>{isBusy ? "Saving..." : "Next Step"}</Button>
          </div>
        </section>
      ) : null}

      {currentStep === 3 ? (
        <section className="space-y-4">
          <div className="overflow-x-auto rounded-xl border border-[var(--border)] p-3">
            <table className="min-w-[980px] table-auto border-collapse text-sm">
              <thead>
                <tr className="bg-[var(--surface-soft)]">
                  <th className="p-2 text-left">Work Description (BQ)</th>
                  <th className="p-2 text-left">Price/Revenue (RM)</th>
                  <th className="p-2 text-left">Cost (RM)</th>
                  <th className="p-2 text-left">Description (VO)</th>
                  <th className="p-2 text-left">Revenue (VO)</th>
                  <th className="p-2 text-left">VO Cost (RM)</th>
                  <th className="p-2 text-left">Action</th>
                </tr>
              </thead>
              <tbody>
                {workItemRows.map((row, index) => (
                  <tr key={`rpcca-row-${index}`} className="border-t border-[var(--border)]">
                    <td className="p-2"><input className="input" value={row.workDescription} onChange={(e) => setWorkItemRows(workItemRows.map((item, i) => i === index ? { ...item, workDescription: e.target.value } : item))} /></td>
                    <td className="p-2"><input className="input" type="number" value={row.revenue} onChange={(e) => setWorkItemRows(workItemRows.map((item, i) => i === index ? { ...item, revenue: e.target.value } : item))} /></td>
                    <td className="p-2"><input className="input" type="number" value={row.cost} onChange={(e) => setWorkItemRows(workItemRows.map((item, i) => i === index ? { ...item, cost: e.target.value } : item))} /></td>
                    <td className="p-2"><input className="input" value={row.voDescription} onChange={(e) => setWorkItemRows(workItemRows.map((item, i) => i === index ? { ...item, voDescription: e.target.value } : item))} /></td>
                    <td className="p-2"><input className="input" type="number" value={row.voRevenue} onChange={(e) => setWorkItemRows(workItemRows.map((item, i) => i === index ? { ...item, voRevenue: e.target.value } : item))} /></td>
                    <td className="p-2"><input className="input" type="number" value={row.voCost} onChange={(e) => setWorkItemRows(workItemRows.map((item, i) => i === index ? { ...item, voCost: e.target.value } : item))} /></td>
                    <td className="p-2">
                      <Button
                        type="button"
                        variant="ghost"
                        className="h-8 w-8 border border-[var(--danger-bg)] p-0 text-[var(--danger-text)] hover:border-[var(--danger-text)] hover:bg-[var(--danger-bg)]"
                        onClick={() => setWorkItemRows(workItemRows.filter((_, i) => i !== index).length ? workItemRows.filter((_, i) => i !== index) : [{ workDescription: "", revenue: "", cost: "", voDescription: "", voRevenue: "", voCost: "" }])}
                      >
                        <SquareCloseIcon className="h-10 w-10" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex justify-end">
            <Button type="button" variant="secondary" size="sm" onClick={() => setWorkItemRows([...workItemRows, { workDescription: "", revenue: "", cost: "", voDescription: "", voRevenue: "", voCost: "" }])}>
              + Add Row
            </Button>
          </div>
          <InputField label="Remarks" value={remarks} onChange={(e) => setRemarks(e.target.value)} />

          <div className="flex flex-wrap justify-between gap-3 pt-2">
            <Button type="button" variant="secondary" onClick={() => setCurrentStep(2)} disabled={isBusy}>Previous</Button>
            <Button type="button" onClick={handleSaveStep3} loading={isBusy}>{isBusy ? "Saving..." : "Next Step"}</Button>
          </div>
        </section>
      ) : null}

      {currentStep === 4 ? (
        <section className="space-y-4">
          <div className="upload-section">
            <p className="text-sm font-semibold text-[var(--text)]">Supporting Documents</p>
            <input type="file" accept={acceptedDocumentTypes} onChange={handleFileUpload} className="input py-2" />
            <p className="text-xs text-[var(--text-subtle)]">Allowed: PDF, Word, Excel, JPG, PNG. Max size: {MAX_FILE_SIZE_MB}MB.</p>
            {uploadedDocument ? <UploadedDocumentPreview documentUrl={uploadedDocument.documentUrl} documentPublicId={uploadedDocument.documentPublicId} documentFileName={uploadedDocument.documentFileName} documentMimeType={uploadedDocument.documentMimeType} documentSizeBytes={uploadedDocument.documentSizeBytes} requestId={requestId} requestType={REVISED_PCCA_FORM_CODE} onRemoved={() => { setUploadedDocument(null); setAlertState({ type: "info", message: "Uploaded document removed." }); }} /> : null}
          </div>
          <label className="flex items-start gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface-soft)] p-3">
            <input type="checkbox" className="mt-1" checked={acknowledgement} onChange={(e) => setAcknowledgement(e.target.checked)} />
            <span className="text-sm text-[var(--text)]">I acknowledge that the uploaded document and submitted details are accurate.</span>
          </label>
          <div className="flex flex-wrap justify-between gap-3 pt-2">
            <Button type="button" variant="secondary" onClick={() => setCurrentStep(3)} disabled={isBusy || isSubmitted}>Previous</Button>
            {canSubmitRequest ? <Button type="button" onClick={handleFinalSubmit} loading={isBusy || isSubmitted}>{isSubmitted ? "Submitted" : isBusy ? "Submitting..." : "Submit RPCCA"}</Button> : null}
          </div>
        </section>
      ) : null}

      {requestNo ? <p className="mt-5 text-xs text-[var(--text-subtle)]">Request reference: {requestNo}</p> : null}
    </div>
  );
}
