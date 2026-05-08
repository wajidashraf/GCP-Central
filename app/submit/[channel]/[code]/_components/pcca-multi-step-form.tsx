"use client";

import { useCallback, useEffect, useMemo, useState, useTransition, type ChangeEvent } from "react";
import { useRouter } from "next/navigation";
import Button from "@/src/components/ui/button";
import { InputField, SelectField, type SelectFieldOption } from "@/src/components/forms/fields";
import MultiStepStepper from "@/src/components/forms/multi-step-stepper";
import { clearPersistedFormState, readPersistedFormState, writePersistedFormState } from "@/src/components/forms/session-storage";
import UploadedDocumentPreview from "@/src/components/forms/uploaded-document-preview";
import {
  PCCA_ALLOWED_DOCUMENT_MIME_TYPES,
  PCCA_FORM_CODE,
  PCCA_MAX_DOCUMENT_SIZE_BYTES,
  PCCA_REQUEST_TITLE,
  createPccaBaseRequestSchema,
  savePccaDetailsSchema,
  savePccaProjectDetailsSchema,
  submitPccaRequestSchema,
} from "@/lib/validations/pcca";
import { createPccaBaseRequest, savePccaDetails, savePccaProjectDetails, submitPccaRequest } from "../_actions/pcca";
import { PCCA_STEPPER_STEPS, type PccaCostRow, type PccaProjectDetailsState, type ProjectOption, type RequestorContext, type UploadedAssetState } from "../_config/pcca-form-schema";

type FieldErrors = Record<string, string[]>;
type AlertState = { type: "success" | "error" | "info"; message: string } | null;
type PccaFormProps = {
  channel: "gcpc" | "gcp";
  requestor: RequestorContext;
  projects: ReadonlyArray<ProjectOption>;
  canSubmitRequest: boolean;
  requestType?: string;
  requestTitle?: string;
  formLabel?: string;
  storageKey?: string;
  uploadFolder?: string;
};

type PersistedPccaState = {
  currentStep: number;
  requestId: string | null;
  requestNo: string | null;
  projectDetails: PccaProjectDetailsState;
  revenueRows: PccaCostRow[];
  costRows: PccaCostRow[];
  constructionCostRm: string;
  internalCost: string;
  remarks: string;
  uploadedDocument: UploadedAssetState | null;
  acknowledgement: boolean;
};

const PCCA_SESSION_STORAGE_KEY = "gcp-central:form:pcca:v2";
const MAX_FILE_SIZE_MB = PCCA_MAX_DOCUMENT_SIZE_BYTES / (1024 * 1024);
const acceptedDocumentTypes = PCCA_ALLOWED_DOCUMENT_MIME_TYPES.join(",");

function toNumberOrUndefined(value: string) {
  if (!value.trim()) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function sumField(rows: PccaCostRow[], key: "cost" | "price_revenue_rm") {
  return rows.reduce((acc, row) => acc + (Number(row[key] ?? "0") || 0), 0);
}

function DynamicBQTable({
  title,
  amountLabel,
  amountKey,
  rows,
  setRows,
}: {
  title: string;
  amountLabel: string;
  amountKey: "cost" | "price_revenue_rm";
  rows: PccaCostRow[];
  setRows: (next: PccaCostRow[]) => void;
}) {
  return (
    <div className="rounded-xl border border-[var(--border)] p-4">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm font-semibold text-[var(--text)]">{title}</p>
        <Button type="button" variant="secondary" size="sm" onClick={() => setRows([...rows, { work_description_bq: "", [amountKey]: "" }])}>
          + Add Row
        </Button>
      </div>
      <div className="space-y-2">
        {rows.map((row, index) => (
          <div key={`${title}-${index}`} className="grid gap-2 md:grid-cols-[1fr_220px_auto]">
            <input
              className="input"
              placeholder="Work Description (BQ)"
              value={row.work_description_bq}
              onChange={(e) =>
                setRows(rows.map((item, i) => (i === index ? { ...item, work_description_bq: e.target.value } : item)))
              }
            />
            <input
              className="input"
              type="number"
              placeholder={amountLabel}
              value={row[amountKey] ?? ""}
              onChange={(e) =>
                setRows(rows.map((item, i) => (i === index ? { ...item, [amountKey]: e.target.value } : item)))
              }
            />
            <Button
              type="button"
              variant="ghost"
              className="text-[var(--danger-text)]"
              onClick={() => setRows(rows.filter((_, i) => i !== index).length ? rows.filter((_, i) => i !== index) : [{ work_description_bq: "", [amountKey]: "" }])}
            >
              Remove
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function PccaMultiStepForm({
  channel,
  requestor,
  projects,
  canSubmitRequest,
  requestType = PCCA_FORM_CODE,
  requestTitle = PCCA_REQUEST_TITLE,
  formLabel = "PCCA",
  storageKey = PCCA_SESSION_STORAGE_KEY,
  uploadFolder = "gcp-central/pcca",
}: PccaFormProps) {
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

  const [projectDetails, setProjectDetails] = useState<PccaProjectDetailsState>({
    projectId: "",
    projectCode: "",
    companyId: requestor.companyId,
    companyCode: requestor.companyCode,
    companyName: requestor.companyName,
  });
  const [revenueRows, setRevenueRows] = useState<PccaCostRow[]>([{ work_description_bq: "", price_revenue_rm: "" }]);
  const [costRows, setCostRows] = useState<PccaCostRow[]>([{ work_description_bq: "", cost: "" }]);
  const [constructionCostRm, setConstructionCostRm] = useState("");
  const [internalCost, setInternalCost] = useState("");
  const [remarks, setRemarks] = useState("");
  const [uploadedDocument, setUploadedDocument] = useState<UploadedAssetState | null>(null);
  const [acknowledgement, setAcknowledgement] = useState(false);

  const isBusy = isPending || isUploading;
  const totalRevenue = useMemo(() => sumField(revenueRows, "price_revenue_rm"), [revenueRows]);
  const totalCost = useMemo(() => sumField(costRows, "cost"), [costRows]);

  const projectOptions: ReadonlyArray<SelectFieldOption> = useMemo(
    () => [{ value: "", label: projects.length ? "Select a project" : "No projects available" }, ...projects.map((project) => ({ value: project.id, label: project.projectName }))],
    [projects]
  );

  const handleProjectSelection = useCallback(
    (projectId: string) => {
      const selectedProject = projects.find((project) => project.id === projectId);
      if (!selectedProject) {
        setProjectDetails((current) => ({ ...current, projectId: "", projectCode: "", companyId: requestor.companyId, companyCode: requestor.companyCode, companyName: requestor.companyName }));
        return;
      }
      setProjectDetails((current) => ({ ...current, projectId: selectedProject.id, projectCode: selectedProject.projectCode.trim(), companyId: requestor.companyId, companyCode: requestor.companyCode, companyName: requestor.companyName }));
    },
    [projects, requestor.companyCode, requestor.companyId, requestor.companyName]
  );

  useEffect(() => {
    const persisted = readPersistedFormState<PersistedPccaState>(storageKey);
    if (persisted) {
      setCurrentStep(Math.min(Math.max(persisted.currentStep, 1), PCCA_STEPPER_STEPS.length));
      setRequestId(persisted.requestId);
      setRequestNo(persisted.requestNo);
      setProjectDetails(persisted.projectDetails);
      setRevenueRows(persisted.revenueRows);
      setCostRows(persisted.costRows);
      setConstructionCostRm(persisted.constructionCostRm);
      setInternalCost(persisted.internalCost);
      setRemarks(persisted.remarks);
      setUploadedDocument(persisted.uploadedDocument);
      setAcknowledgement(persisted.acknowledgement);
    }
    setHasHydratedFromSession(true);
  }, [storageKey]);

  useEffect(() => {
    if (!hasHydratedFromSession || isSubmitted) return;
    writePersistedFormState<PersistedPccaState>(storageKey, {
      currentStep,
      requestId,
      requestNo,
      projectDetails,
      revenueRows,
      costRows,
      constructionCostRm,
      internalCost,
      remarks,
      uploadedDocument,
      acknowledgement,
    });
  }, [acknowledgement, constructionCostRm, costRows, currentStep, hasHydratedFromSession, internalCost, isSubmitted, projectDetails, remarks, requestId, requestNo, revenueRows, storageKey, uploadedDocument]);

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
    if (!PCCA_ALLOWED_DOCUMENT_MIME_TYPES.includes(file.type as (typeof PCCA_ALLOWED_DOCUMENT_MIME_TYPES)[number])) {
      setErrorState("Unsupported file type.");
      return;
    }
    if (file.size <= 0 || file.size > PCCA_MAX_DOCUMENT_SIZE_BYTES) {
      setErrorState(`File must be within 0-${MAX_FILE_SIZE_MB}MB.`);
      return;
    }

    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.set("file", file);
      formData.set("folder", uploadFolder);
      formData.set("requestType", requestType);
      if (requestId) {
        formData.set("requestId", requestId);
      }
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
      requestType,
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
    const validated = createPccaBaseRequestSchema.safeParse(payload);
    if (!validated.success) return setErrorState("Please review the pre-populated basic information fields.");
    startTransition(async () => {
      const result = await createPccaBaseRequest(validated.data);
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
    const payload = { requestId, projectId: projectDetails.projectId, projectCode: projectDetails.projectCode, companyId: projectDetails.companyId, companyCode: projectDetails.companyCode, companyName: projectDetails.companyName };
    const validated = savePccaProjectDetailsSchema.safeParse(payload);
    if (!validated.success) return setErrorState("Please correct project details.");
    startTransition(async () => {
      const result = await savePccaProjectDetails(validated.data);
      if (!result.success) return setErrorState(result.message, result.fieldErrors);
      setCurrentStep(3);
    });
  }

  function handleSaveStep4() {
    resetFeedback();
    if (!requestId) return setErrorState("Base request not found. Please complete Step 1 first.");

    const payload = {
      requestId,
      priceRevenueFromContractBq: revenueRows,
      costFromContractBq: costRows,
      totalRevenueRm: totalRevenue,
      totalCostRm: totalCost,
      constructionCostRm: toNumberOrUndefined(constructionCostRm),
      internalCost: toNumberOrUndefined(internalCost),
      remarks,
    };
    const validated = savePccaDetailsSchema.safeParse(payload);
    if (!validated.success) return setErrorState("Please complete PCCA details before proceeding.");

    startTransition(async () => {
      const result = await savePccaDetails(validated.data);
      if (!result.success) return setErrorState(result.message, result.fieldErrors);
      setCurrentStep(5);
      setAlertState({ type: "info", message: `${formLabel} details saved. Upload final document and submit.` });
    });
  }

  function handleFinalSubmit() {
    resetFeedback();
    if (!requestId) return setErrorState("Base request not found.");
    if (!uploadedDocument) return setErrorState("Please upload final document.");
    const payload = { requestId, acknowledgement, ...uploadedDocument };
    const validated = submitPccaRequestSchema.safeParse(payload);
    if (!validated.success) return setErrorState("Please complete acknowledgement and document requirements.");
    startTransition(async () => {
      const result = await submitPccaRequest(validated.data);
      if (!result.success) return setErrorState(result.message, result.fieldErrors);
      setIsSubmitted(true);
      clearPersistedFormState(storageKey);
      setAlertState({ type: "success", message: `${formLabel} request ${result.data.requestNo} submitted successfully.` });
      router.push("/requests");
    });
  }

  return (
    <div className="surface-card p-5 sm:p-6">
      <MultiStepStepper steps={PCCA_STEPPER_STEPS} currentStep={currentStep} isSubmitted={isSubmitted} />
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
            <InputField label="Request Title" value={requestTitle} readOnly inputClassName="bg-slate-50" />
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
            <SelectField label="Project Name" required options={projectOptions} value={projectDetails.projectId} onChange={(e) => handleProjectSelection(e.target.value)} />
            <InputField label="Project Code" value={projectDetails.projectCode} readOnly inputClassName="bg-slate-50" />
            <InputField label="Company" value={`${projectDetails.companyName} (${projectDetails.companyCode})`} readOnly inputClassName="bg-slate-50" containerClassName="md:col-span-2" />
          </div>
          <div className="flex flex-wrap justify-between gap-3 pt-2">
            <Button type="button" variant="secondary" onClick={() => setCurrentStep(1)} disabled={isBusy}>Previous</Button>
            <Button type="button" onClick={handleSaveStep2} loading={isBusy}>{isBusy ? "Saving..." : "Next Step"}</Button>
          </div>
        </section>
      ) : null}

      {currentStep === 3 ? (
        <section className="space-y-4">
          <DynamicBQTable title="Price/Revenue (from Contract BQ)" amountLabel="Price / Revenue (RM)" amountKey="price_revenue_rm" rows={revenueRows} setRows={setRevenueRows} />
          <DynamicBQTable title="Cost (from Contract BQ)" amountLabel="Cost (RM)" amountKey="cost" rows={costRows} setRows={setCostRows} />
          <div className="flex flex-wrap justify-between gap-3 pt-2">
            <Button type="button" variant="secondary" onClick={() => setCurrentStep(2)}>Previous</Button>
            <Button type="button" onClick={() => setCurrentStep(4)}>Next Step</Button>
          </div>
        </section>
      ) : null}

      {currentStep === 4 ? (
        <section className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <InputField label="Total Revenue (RM)" type="number" value={String(totalRevenue)} readOnly inputClassName="bg-slate-50" />
            <InputField label="Total Cost (RM)" type="number" value={String(totalCost)} readOnly inputClassName="bg-slate-50" />
            <InputField label="Construction cost (RM)" type="number" value={constructionCostRm} onChange={(e) => setConstructionCostRm(e.target.value)} />
            <InputField label="Internal Cost" type="number" value={internalCost} onChange={(e) => setInternalCost(e.target.value)} />
            <InputField label="Remarks" value={remarks} onChange={(e) => setRemarks(e.target.value)} containerClassName="md:col-span-2" />
          </div>
          <div className="flex flex-wrap justify-between gap-3 pt-2">
            <Button type="button" variant="secondary" onClick={() => setCurrentStep(3)}>Previous</Button>
            <Button type="button" onClick={handleSaveStep4} loading={isBusy}>{isBusy ? "Saving..." : "Next Step"}</Button>
          </div>
        </section>
      ) : null}

      {currentStep === 5 ? (
        <section className="space-y-4">
          <div className="upload-section">
            <p className="text-sm font-semibold text-[var(--text)]">Final Document Upload</p>
            <input type="file" accept={acceptedDocumentTypes} onChange={handleFileUpload} className="input py-2" />
            <p className="text-xs text-[var(--text-subtle)]">Allowed: PDF, Word, Excel, JPG, PNG. Max size: {MAX_FILE_SIZE_MB}MB.</p>
            {uploadedDocument ? <UploadedDocumentPreview documentUrl={uploadedDocument.documentUrl} documentPublicId={uploadedDocument.documentPublicId} documentFileName={uploadedDocument.documentFileName} documentMimeType={uploadedDocument.documentMimeType} documentSizeBytes={uploadedDocument.documentSizeBytes} requestId={requestId} requestType={PCCA_FORM_CODE} onRemoved={() => { setUploadedDocument(null); setAlertState({ type: "info", message: "Uploaded document removed." }); }} /> : null}
          </div>
          <label className="flex items-start gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface-soft)] p-3">
            <input type="checkbox" className="mt-1" checked={acknowledgement} onChange={(e) => setAcknowledgement(e.target.checked)} />
            <span className="text-sm text-[var(--text)]">I acknowledge that the uploaded document and submitted details are accurate.</span>
          </label>
          <div className="flex flex-wrap justify-between gap-3 pt-2">
            <Button type="button" variant="secondary" onClick={() => setCurrentStep(4)} disabled={isBusy || isSubmitted}>Previous</Button>
            {canSubmitRequest ? <Button type="button" onClick={handleFinalSubmit} loading={isBusy || isSubmitted}>{isSubmitted ? "Submitted" : isBusy ? "Submitting..." : `Submit ${formLabel}`}</Button> : null}
          </div>
        </section>
      ) : null}

      {requestNo ? <p className="mt-5 text-xs text-[var(--text-subtle)]">Request reference: {requestNo}</p> : null}
    </div>
  );
}
