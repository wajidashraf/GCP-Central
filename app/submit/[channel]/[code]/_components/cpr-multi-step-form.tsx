"use client";

import { useCallback, useEffect, useMemo, useState, useTransition, type ChangeEvent } from "react";
import { useRouter } from "next/navigation";
import Button from "@/src/components/ui/button";
import { InputField, SelectField, TextareaField, type SelectFieldOption } from "@/src/components/forms/fields";
import MultiStepStepper from "@/src/components/forms/multi-step-stepper";
import { clearPersistedFormState, readPersistedFormState, writePersistedFormState } from "@/src/components/forms/session-storage";
import UploadedDocumentPreview from "@/src/components/forms/uploaded-document-preview";
import {
  CPR_ALLOWED_DOCUMENT_MIME_TYPES,
  CPR_FORM_CODE,
  CPR_MAX_DOCUMENT_SIZE_BYTES,
  CPR_REQUEST_TITLE,
  createCprBaseRequestSchema,
  saveCprDetailsSchema,
  submitCprRequestSchema,
} from "@/lib/validations/cpr";
import { createCprBaseRequest, saveCprDetails, submitCprRequest } from "../_actions/cpr";
import { CPR_STEPPER_STEPS, type ProjectOption, type RequestorContext, type UploadedAssetState } from "../_config/cpr-form-schema";

type AlertState = { type: "success" | "error" | "info"; message: string } | null;
type CprFormProps = { channel: "gcpc" | "gcp"; requestor: RequestorContext; projects: ReadonlyArray<ProjectOption>; canSubmitRequest: boolean; };
type Persisted = Record<string, string | number | boolean | null | UploadedAssetState>;

const CPR_SESSION_STORAGE_KEY = "gcp-central:form:cpr:v1";
const MAX_FILE_SIZE_MB = CPR_MAX_DOCUMENT_SIZE_BYTES / (1024 * 1024);
const acceptedDocumentTypes = CPR_ALLOWED_DOCUMENT_MIME_TYPES.join(",");
const statusOptions: SelectFieldOption[] = [{ value: "", label: "Select status" }, { value: "1", label: "Active" }, { value: "2", label: "Inactive" }];

export default function CprMultiStepForm({ channel, requestor, projects, canSubmitRequest }: CprFormProps) {
  const router = useRouter();
  const category = useMemo(() => channel.toUpperCase() as "GCP" | "GCPC", [channel]);
  const [currentStep, setCurrentStep] = useState(1);
  const [requestId, setRequestId] = useState<string | null>(null);
  const [requestNo, setRequestNo] = useState<string | null>(null);
  const [alertState, setAlertState] = useState<AlertState>(null);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [hasHydratedFromSession, setHasHydratedFromSession] = useState(false);
  const [uploadedDocument, setUploadedDocument] = useState<UploadedAssetState | null>(null);
  const [acknowledgement, setAcknowledgement] = useState(false);
  const [form, setForm] = useState<Record<string, string>>({
    projectId: "", projectCode: "",
    eotLatestNo: "", eotLatestDate: "", eotNewApplicationDate: "", eotNewCompletionDate: "", eotApplicationStatus: "2", eotNewJustifications: "",
    voLatestNo: "", voLatestApprovedCumulativeAmount: "", voNewApplicationAmount: "", voNewApplicationNo: "", voNewApplicationDate: "", voApplicationStatus: "2", voNewJustification: "",
    cumulativeClaimApplicationAmountToDate: "", cumulativeClaimCertifiedAmountToDate: "", pendingCertifiedAmountToDate: "", noOfClaimsForPendingCertifiedAmount: "", newNetCertifiedAmount: "", claimDateForPendingCertifiedAmount: "",
  });

  const isBusy = isPending || isUploading;
  const projectOptions: ReadonlyArray<SelectFieldOption> = useMemo(() => [{ value: "", label: projects.length ? "Select a project" : "No projects available" }, ...projects.map((p) => ({ value: p.id, label: p.projectName }))], [projects]);
  const setField = (k: string, v: string) => setForm((c) => ({ ...c, [k]: v }));

  const handleProjectSelection = useCallback((projectId: string) => {
    const selectedProject = projects.find((project) => project.id === projectId);
    setForm((current) => ({ ...current, projectId, projectCode: selectedProject?.projectCode?.trim() ?? "" }));
  }, [projects]);

  useEffect(() => {
    const persisted = readPersistedFormState<Persisted>(CPR_SESSION_STORAGE_KEY);
    if (persisted) {
      setCurrentStep(Number(persisted.currentStep ?? 1));
      setRequestId((persisted.requestId as string) ?? null);
      setRequestNo((persisted.requestNo as string) ?? null);
      setUploadedDocument((persisted.uploadedDocument as UploadedAssetState) ?? null);
      setAcknowledgement(Boolean(persisted.acknowledgement));
      setForm((current) => ({ ...current, ...Object.fromEntries(Object.entries(persisted).filter(([k]) => k in current)) as Record<string, string> }));
    }
    setHasHydratedFromSession(true);
  }, []);

  useEffect(() => {
    if (!hasHydratedFromSession || isSubmitted) return;
    writePersistedFormState<Persisted>(CPR_SESSION_STORAGE_KEY, { currentStep, requestId, requestNo, ...form, uploadedDocument, acknowledgement });
  }, [acknowledgement, currentStep, form, hasHydratedFromSession, isSubmitted, requestId, requestNo, uploadedDocument]);

  async function handleFileUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setAlertState(null);
    if (!CPR_ALLOWED_DOCUMENT_MIME_TYPES.includes(file.type as (typeof CPR_ALLOWED_DOCUMENT_MIME_TYPES)[number])) return setAlertState({ type: "error", message: "Unsupported file type." });
    if (file.size <= 0 || file.size > CPR_MAX_DOCUMENT_SIZE_BYTES) return setAlertState({ type: "error", message: `File must be within 0-${MAX_FILE_SIZE_MB}MB.` });
    setIsUploading(true);
    try {
      const fd = new FormData();
      fd.set("file", file);
      fd.set("folder", "gcp-central/cpr");
      const response = await fetch("/api/uploads/cloudinary", { method: "POST", body: fd });
      const data = (await response.json()) as UploadedAssetState | { message?: string };
      if (!response.ok) return setAlertState({ type: "error", message: "message" in data && data.message ? data.message : "Document upload failed." });
      setUploadedDocument(data as UploadedAssetState);
      setAlertState({ type: "success", message: `Document uploaded: ${(data as UploadedAssetState).documentFileName}` });
    } catch {
      setAlertState({ type: "error", message: "Unexpected upload error." });
    } finally {
      setIsUploading(false);
    }
  }

  function handleCreateBaseRequest() {
    const payload = { requestType: CPR_FORM_CODE, routingType: category, requestTitle: CPR_REQUEST_TITLE, category, requestorId: requestor.id, requestorName: requestor.name, requestorEmail: requestor.email, companyId: requestor.companyId, companyCode: requestor.companyCode, companyName: requestor.companyName };
    const validated = createCprBaseRequestSchema.safeParse(payload);
    if (!validated.success) return setAlertState({ type: "error", message: "Please review the pre-populated basic information fields." });
    startTransition(async () => {
      const result = await createCprBaseRequest(validated.data);
      if (!result.success) return setAlertState({ type: "error", message: result.message });
      setRequestId(result.data.requestId); setRequestNo(result.data.requestNo); setCurrentStep(2);
    });
  }

  function handleSaveStep5() {
    if (!requestId) return setAlertState({ type: "error", message: "Base request not found. Please complete Step 1 first." });
    const payload = {
      requestId, projectId: form.projectId, projectCode: form.projectCode, companyId: requestor.companyId, companyCode: requestor.companyCode, companyName: requestor.companyName,
      eotLatestNo: form.eotLatestNo, eotLatestDate: form.eotLatestDate, eotNewApplicationDate: form.eotNewApplicationDate, eotNewCompletionDate: form.eotNewCompletionDate, eotApplicationStatus: form.eotApplicationStatus, eotNewJustifications: form.eotNewJustifications,
      voLatestNo: form.voLatestNo, voLatestApprovedCumulativeAmount: form.voLatestApprovedCumulativeAmount, voNewApplicationAmount: form.voNewApplicationAmount, voNewApplicationNo: form.voNewApplicationNo, voNewApplicationDate: form.voNewApplicationDate, voApplicationStatus: form.voApplicationStatus, voNewJustification: form.voNewJustification,
      cumulativeClaimApplicationAmountToDate: form.cumulativeClaimApplicationAmountToDate, cumulativeClaimCertifiedAmountToDate: form.cumulativeClaimCertifiedAmountToDate, pendingCertifiedAmountToDate: form.pendingCertifiedAmountToDate, noOfClaimsForPendingCertifiedAmount: form.noOfClaimsForPendingCertifiedAmount, newNetCertifiedAmount: form.newNetCertifiedAmount, claimDateForPendingCertifiedAmount: form.claimDateForPendingCertifiedAmount,
    };
    const validated = saveCprDetailsSchema.safeParse(payload);
    if (!validated.success) return setAlertState({ type: "error", message: "Please complete CPR details before proceeding." });
    startTransition(async () => {
      const result = await saveCprDetails(validated.data);
      if (!result.success) return setAlertState({ type: "error", message: result.message });
      setCurrentStep(6);
    });
  }

  function handleFinalSubmit() {
    if (!requestId || !uploadedDocument) return setAlertState({ type: "error", message: "Please complete details and upload final document." });
    const validated = submitCprRequestSchema.safeParse({ requestId, acknowledgement, ...uploadedDocument });
    if (!validated.success) return setAlertState({ type: "error", message: "Please complete acknowledgement and document requirements." });
    startTransition(async () => {
      const result = await submitCprRequest(validated.data);
      if (!result.success) return setAlertState({ type: "error", message: result.message });
      setIsSubmitted(true); clearPersistedFormState(CPR_SESSION_STORAGE_KEY); router.push("/requests");
    });
  }

  return (
    <div className="surface-card p-5 sm:p-6">
      <MultiStepStepper steps={CPR_STEPPER_STEPS} currentStep={currentStep} isSubmitted={isSubmitted} />
      {alertState ? <div className={`alert mb-5 ${alertState.type === "error" ? "alert--danger" : alertState.type === "success" ? "alert--success" : "alert--info"}`}><p className="alert__body">{alertState.message}</p></div> : null}

      {currentStep === 1 ? <section className="space-y-4"><div className="grid gap-4 md:grid-cols-2"><InputField label="Request Title" value={CPR_REQUEST_TITLE} readOnly inputClassName="bg-slate-50" /><InputField label="Category" value={category} readOnly inputClassName="bg-slate-50" /><InputField label="Requestor Name" value={requestor.name} readOnly inputClassName="bg-slate-50" /><InputField label="Requestor Email" value={requestor.email} readOnly inputClassName="bg-slate-50" /></div><div className="flex justify-end"><Button type="button" onClick={handleCreateBaseRequest} loading={isBusy}>Next Step</Button></div></section> : null}
      {currentStep === 2 ? <section className="space-y-4"><div className="grid gap-4 md:grid-cols-2"><SelectField label="Project Name" required options={projectOptions} value={form.projectId} onChange={(e) => handleProjectSelection(e.target.value)} /><InputField label="Project Code" value={form.projectCode} readOnly inputClassName="bg-slate-50" /><InputField label="Company" value={`${requestor.companyName} (${requestor.companyCode})`} readOnly inputClassName="bg-slate-50" containerClassName="md:col-span-2" /></div><div className="flex justify-between"><Button type="button" variant="secondary" onClick={() => setCurrentStep(1)}>Previous</Button><Button type="button" onClick={() => setCurrentStep(3)}>Next Step</Button></div></section> : null}
      {currentStep === 3 ? <section className="space-y-4"><InputField label="Latest approved EOT No" value={form.eotLatestNo} onChange={(e) => setField("eotLatestNo", e.target.value)} /><InputField label="Latest approved EOT Date" placeholder="DD/MM/YYYY" value={form.eotLatestDate} onChange={(e) => setField("eotLatestDate", e.target.value)} /><InputField label="New EOT Application Date" placeholder="DD/MM/YYYY" value={form.eotNewApplicationDate} onChange={(e) => setField("eotNewApplicationDate", e.target.value)} /><InputField label="New EOT Completion Date" placeholder="DD/MM/YYYY" value={form.eotNewCompletionDate} onChange={(e) => setField("eotNewCompletionDate", e.target.value)} /><SelectField label="Status of New EOT Application" required options={statusOptions} value={form.eotApplicationStatus} onChange={(e) => setField("eotApplicationStatus", e.target.value)} /><TextareaField label="New EOT Justifications" value={form.eotNewJustifications} onChange={(e) => setField("eotNewJustifications", e.target.value)} /><div className="flex justify-between"><Button type="button" variant="secondary" onClick={() => setCurrentStep(2)}>Previous</Button><Button type="button" onClick={() => setCurrentStep(4)}>Next Step</Button></div></section> : null}
      {currentStep === 4 ? <section className="space-y-4"><InputField label="Latest approved VO No" value={form.voLatestNo} onChange={(e) => setField("voLatestNo", e.target.value)} /><InputField type="number" label="Latest approved VO Cumulative Amount" value={form.voLatestApprovedCumulativeAmount} onChange={(e) => setField("voLatestApprovedCumulativeAmount", e.target.value)} /><InputField type="number" label="New VO Application Amount" value={form.voNewApplicationAmount} onChange={(e) => setField("voNewApplicationAmount", e.target.value)} /><InputField label="New VO Application No." value={form.voNewApplicationNo} onChange={(e) => setField("voNewApplicationNo", e.target.value)} /><InputField label="New VO Application Date" placeholder="DD/MM/YYYY" value={form.voNewApplicationDate} onChange={(e) => setField("voNewApplicationDate", e.target.value)} /><SelectField label="Status of New VO Application" required options={statusOptions} value={form.voApplicationStatus} onChange={(e) => setField("voApplicationStatus", e.target.value)} /><TextareaField label="New VO Justifications" value={form.voNewJustification} onChange={(e) => setField("voNewJustification", e.target.value)} /><div className="flex justify-between"><Button type="button" variant="secondary" onClick={() => setCurrentStep(3)}>Previous</Button><Button type="button" onClick={() => setCurrentStep(5)}>Next Step</Button></div></section> : null}
      {currentStep === 5 ? <section className="space-y-4"><InputField type="number" label="Cumulative Claim Application Amount to date" value={form.cumulativeClaimApplicationAmountToDate} onChange={(e) => setField("cumulativeClaimApplicationAmountToDate", e.target.value)} /><InputField type="number" label="Cumulative Claim Certified Amount to date" value={form.cumulativeClaimCertifiedAmountToDate} onChange={(e) => setField("cumulativeClaimCertifiedAmountToDate", e.target.value)} /><InputField type="number" label="Pending Certified Amount to date" value={form.pendingCertifiedAmountToDate} onChange={(e) => setField("pendingCertifiedAmountToDate", e.target.value)} /><InputField type="number" label="No. of Claim application for pending certified amount" value={form.noOfClaimsForPendingCertifiedAmount} onChange={(e) => setField("noOfClaimsForPendingCertifiedAmount", e.target.value)} /><InputField type="number" label="New Net Certified Amount" value={form.newNetCertifiedAmount} onChange={(e) => setField("newNetCertifiedAmount", e.target.value)} /><InputField label="Date of claim application for pending certified amount" placeholder="DD/MM/YYYY" value={form.claimDateForPendingCertifiedAmount} onChange={(e) => setField("claimDateForPendingCertifiedAmount", e.target.value)} /><div className="flex justify-between"><Button type="button" variant="secondary" onClick={() => setCurrentStep(4)}>Previous</Button><Button type="button" onClick={handleSaveStep5} loading={isBusy}>{isBusy ? "Saving..." : "Next Step"}</Button></div></section> : null}
      {currentStep === 6 ? <section className="space-y-4"><input type="file" accept={acceptedDocumentTypes} onChange={handleFileUpload} className="input py-2" />{uploadedDocument ? <UploadedDocumentPreview documentUrl={uploadedDocument.documentUrl} documentFileName={uploadedDocument.documentFileName} documentMimeType={uploadedDocument.documentMimeType} documentSizeBytes={uploadedDocument.documentSizeBytes} /> : null}<label className="flex items-start gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface-soft)] p-3"><input type="checkbox" className="mt-1" checked={acknowledgement} onChange={(e) => setAcknowledgement(e.target.checked)} /><span className="text-sm text-[var(--text)]">I acknowledge that the uploaded document and submitted details are accurate.</span></label><div className="flex justify-between"><Button type="button" variant="secondary" onClick={() => setCurrentStep(5)}>Previous</Button>{canSubmitRequest ? <Button type="button" onClick={handleFinalSubmit} loading={isBusy || isSubmitted}>{isBusy ? "Submitting..." : "Submit CPR"}</Button> : null}</div></section> : null}
      {requestNo ? <p className="mt-5 text-xs text-[var(--text-subtle)]">Request reference: {requestNo}</p> : null}
    </div>
  );
}
