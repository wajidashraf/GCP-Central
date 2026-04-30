"use client";

import { useCallback, useEffect, useMemo, useState, useTransition, type ChangeEvent } from "react";
import { useRouter } from "next/navigation";
import Button from "@/src/components/ui/button";
import { InputField, SelectField, type SelectFieldOption } from "@/src/components/forms/fields";
import MultiStepStepper from "@/src/components/forms/multi-step-stepper";
import { clearPersistedFormState, readPersistedFormState, writePersistedFormState } from "@/src/components/forms/session-storage";
import UploadedDocumentPreview from "@/src/components/forms/uploaded-document-preview";
import {
  CAA_ALLOWED_DOCUMENT_MIME_TYPES,
  CAA_FORM_CODE,
  CAA_MAX_DOCUMENT_SIZE_BYTES,
  createCaaBaseRequestSchema,
  saveCaaDetailsSchema,
  saveCaaProjectDetailsSchema,
  submitCaaRequestSchema,
} from "@/lib/validations/caa";
import { createCaaBaseRequest, saveCaaDetails, saveCaaProjectDetails, submitCaaRequest } from "../_actions/caa";
import { CAA_STEPPER_STEPS, type CaaProjectDetailsState, type CaaSimpleTableRow, type ProjectOption, type RequestorContext, type UploadedAssetState } from "../_config/caa-form-schema";

type FieldErrors = Record<string, string[]>;
type AlertState = { type: "success" | "error" | "info"; message: string } | null;
type CaaFormProps = { channel: "gcpc" | "gcp"; requestTitle: string; requestor: RequestorContext; projects: ReadonlyArray<ProjectOption>; canSubmitRequest: boolean; };

type PersistedCaaState = {
  currentStep: number; requestId: string | null; requestNo: string | null; projectDetails: CaaProjectDetailsState;
  costFields: Record<string, string>; contractFields: Record<string, string>; contractFields2: Record<string, string>;
  tableStep6A: CaaSimpleTableRow[]; tableStep6B: CaaSimpleTableRow[]; tableStep6C: CaaSimpleTableRow[];
  tableStep7A: CaaSimpleTableRow[]; tableStep7B: CaaSimpleTableRow[]; tableStep7C: CaaSimpleTableRow[];
  tableStep8A: CaaSimpleTableRow[]; tableStep8B: CaaSimpleTableRow[]; tableStep8C: CaaSimpleTableRow[];
  organisationChart: UploadedAssetState | null; uploadedDocument: UploadedAssetState | null; acknowledgement: boolean;
};

const CAA_SESSION_STORAGE_KEY = "gcp-central:form:caa:v1";
const MAX_FILE_SIZE_MB = CAA_MAX_DOCUMENT_SIZE_BYTES / (1024 * 1024);
const acceptedDocumentTypes = CAA_ALLOWED_DOCUMENT_MIME_TYPES.join(",");
const defaultRow: CaaSimpleTableRow = { no_of_days: "", clause_reference: "", description: "" };

function tableHasContent(rows: CaaSimpleTableRow[]) {
  return rows.some((r) => r.no_of_days.trim() || r.clause_reference.trim() || r.description.trim());
}

function SimpleTable({
  title,
  rows,
  setRows,
}: {
  title: string;
  rows: CaaSimpleTableRow[];
  setRows: (next: CaaSimpleTableRow[]) => void;
}) {
  return (
    <div className="rounded-xl border border-[var(--border)] p-4">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm font-semibold text-[var(--text)]">{title}</p>
        <Button type="button" variant="secondary" size="sm" onClick={() => setRows([...rows, { ...defaultRow }])}>+ Add Row</Button>
      </div>
      <div className="space-y-2">
        {rows.map((row, i) => (
          <div key={`${title}-${i}`} className="grid gap-2 md:grid-cols-[140px_1fr_1fr_auto]">
            <input className="input" placeholder="No. of days" value={row.no_of_days} onChange={(e) => setRows(rows.map((r, idx) => idx === i ? { ...r, no_of_days: e.target.value } : r))} />
            <input className="input" placeholder="Clause reference" value={row.clause_reference} onChange={(e) => setRows(rows.map((r, idx) => idx === i ? { ...r, clause_reference: e.target.value } : r))} />
            <input className="input" placeholder="Description" value={row.description} onChange={(e) => setRows(rows.map((r, idx) => idx === i ? { ...r, description: e.target.value } : r))} />
            <Button type="button" variant="ghost" className="text-[var(--danger-text)]" onClick={() => setRows(rows.filter((_, idx) => idx !== i).length ? rows.filter((_, idx) => idx !== i) : [{ ...defaultRow }])}>Remove</Button>
          </div>
        ))}
      </div>
    </div>
  );
}

function toNumberOrUndefined(value: string) {
  if (!value.trim()) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export default function CaaMultiStepForm({ channel, requestTitle, requestor, projects, canSubmitRequest }: CaaFormProps) {
  const router = useRouter();
  const category = useMemo(() => channel.toUpperCase() as "GCP" | "GCPC", [channel]);
  const [currentStep, setCurrentStep] = useState(1);
  const [requestId, setRequestId] = useState<string | null>(null);
  const [requestNo, setRequestNo] = useState<string | null>(null);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [alertState, setAlertState] = useState<AlertState>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [hasHydratedFromSession, setHasHydratedFromSession] = useState(false);

  const [projectDetails, setProjectDetails] = useState<CaaProjectDetailsState>({
    projectId: "", projectCode: "", companyId: requestor.companyId, companyCode: requestor.companyCode, companyName: requestor.companyName,
  });
  const [costFields, setCostFields] = useState<Record<string, string>>({
    tenderProposalPrice: "", finalContractAmount: "", estimatedBudgetCost: "", estimatedMarginPercent: "",
    tenderProposalRefNo: "", loaDate: "", contractCommencementDate: "", contractCompletionDate: "", contractPeriodDays: "",
  });
  const [contractFields, setContractFields] = useState<Record<string, string>>({
    performanceBondForProject: "", stampDutyInclusiveLegalFees: "", insurance: "", bumiputeraParticipation: "",
    formationOfJvCompany: "", criticalActivityMilestone: "", defectLiabilityPeriodDlp: "",
  });
  const [contractFields2, setContractFields2] = useState<Record<string, string>>({
    liquidatedDamagesRate: "", paymentTerm: "", typeOfContract: "", formOfContractCondition: "",
    projectDirector: "", contactPersonAtSite: "",
  });

  const [tableStep6A, setTableStep6A] = useState<CaaSimpleTableRow[]>([{ ...defaultRow }]);
  const [tableStep6B, setTableStep6B] = useState<CaaSimpleTableRow[]>([{ ...defaultRow }]);
  const [tableStep6C, setTableStep6C] = useState<CaaSimpleTableRow[]>([{ ...defaultRow }]);
  const [tableStep7A, setTableStep7A] = useState<CaaSimpleTableRow[]>([{ ...defaultRow }]);
  const [tableStep7B, setTableStep7B] = useState<CaaSimpleTableRow[]>([{ ...defaultRow }]);
  const [tableStep7C, setTableStep7C] = useState<CaaSimpleTableRow[]>([{ ...defaultRow }]);
  const [tableStep8A, setTableStep8A] = useState<CaaSimpleTableRow[]>([{ ...defaultRow }]);
  const [tableStep8B, setTableStep8B] = useState<CaaSimpleTableRow[]>([{ ...defaultRow }]);
  const [tableStep8C, setTableStep8C] = useState<CaaSimpleTableRow[]>([{ ...defaultRow }]);
  const [organisationChart, setOrganisationChart] = useState<UploadedAssetState | null>(null);
  const [uploadedDocument, setUploadedDocument] = useState<UploadedAssetState | null>(null);
  const [acknowledgement, setAcknowledgement] = useState(false);

  const isBusy = isPending || isUploading;

  const projectOptions: ReadonlyArray<SelectFieldOption> = useMemo(
    () => [{ value: "", label: projects.length ? "Select a project" : "No projects available" }, ...projects.map((p) => ({ value: p.id, label: p.projectName }))],
    [projects]
  );

  const handleProjectSelection = useCallback((projectId: string) => {
    const selectedProject = projects.find((project) => project.id === projectId);
    if (!selectedProject) {
      setProjectDetails((current) => ({ ...current, projectId: "", projectCode: "", companyId: requestor.companyId, companyCode: requestor.companyCode, companyName: requestor.companyName }));
      return;
    }
    setProjectDetails((current) => ({ ...current, projectId: selectedProject.id, projectCode: selectedProject.projectCode.trim(), companyId: requestor.companyId, companyCode: requestor.companyCode, companyName: requestor.companyName }));
  }, [projects, requestor.companyCode, requestor.companyId, requestor.companyName]);

  useEffect(() => {
    const persisted = readPersistedFormState<PersistedCaaState>(CAA_SESSION_STORAGE_KEY);
    if (persisted) {
      setCurrentStep(Math.min(Math.max(persisted.currentStep, 1), CAA_STEPPER_STEPS.length));
      setRequestId(persisted.requestId); setRequestNo(persisted.requestNo); setProjectDetails(persisted.projectDetails);
      setCostFields(persisted.costFields); setContractFields(persisted.contractFields); setContractFields2(persisted.contractFields2);
      setTableStep6A(persisted.tableStep6A); setTableStep6B(persisted.tableStep6B); setTableStep6C(persisted.tableStep6C);
      setTableStep7A(persisted.tableStep7A); setTableStep7B(persisted.tableStep7B); setTableStep7C(persisted.tableStep7C);
      setTableStep8A(persisted.tableStep8A); setTableStep8B(persisted.tableStep8B); setTableStep8C(persisted.tableStep8C);
      setOrganisationChart(persisted.organisationChart); setUploadedDocument(persisted.uploadedDocument); setAcknowledgement(persisted.acknowledgement);
    }
    setHasHydratedFromSession(true);
  }, []);

  useEffect(() => {
    if (!hasHydratedFromSession || isSubmitted) return;
    writePersistedFormState<PersistedCaaState>(CAA_SESSION_STORAGE_KEY, {
      currentStep, requestId, requestNo, projectDetails, costFields, contractFields, contractFields2,
      tableStep6A, tableStep6B, tableStep6C, tableStep7A, tableStep7B, tableStep7C, tableStep8A, tableStep8B, tableStep8C,
      organisationChart, uploadedDocument, acknowledgement,
    });
  }, [acknowledgement, contractFields, contractFields2, costFields, currentStep, hasHydratedFromSession, isSubmitted, organisationChart, projectDetails, requestId, requestNo, tableStep6A, tableStep6B, tableStep6C, tableStep7A, tableStep7B, tableStep7C, tableStep8A, tableStep8B, tableStep8C, uploadedDocument]);

  function setErrorState(message: string, errors?: FieldErrors) {
    setAlertState({ type: "error", message }); setFieldErrors(errors ?? {});
  }
  function resetFeedback() {
    setAlertState(null); setFieldErrors({});
  }

  async function uploadFile(file: File, folder: string) {
    if (!CAA_ALLOWED_DOCUMENT_MIME_TYPES.includes(file.type as (typeof CAA_ALLOWED_DOCUMENT_MIME_TYPES)[number])) {
      setErrorState("Unsupported file type."); return null;
    }
    if (file.size <= 0 || file.size > CAA_MAX_DOCUMENT_SIZE_BYTES) {
      setErrorState(`File must be within 0-${MAX_FILE_SIZE_MB}MB.`); return null;
    }
    setIsUploading(true);
    try {
      const formData = new FormData(); formData.set("file", file); formData.set("folder", folder);
      const response = await fetch("/api/uploads/cloudinary", { method: "POST", body: formData });
      const responseData = (await response.json()) as UploadedAssetState | { message?: string };
      if (!response.ok) {
        const message = "message" in responseData && responseData.message ? responseData.message : "Document upload failed.";
        setErrorState(message); return null;
      }
      return responseData as UploadedAssetState;
    } catch {
      setErrorState("Unexpected upload error."); return null;
    } finally {
      setIsUploading(false);
    }
  }

  async function handleUpload(event: ChangeEvent<HTMLInputElement>, setter: (value: UploadedAssetState) => void) {
    const file = event.target.files?.[0]; if (!file) return;
    resetFeedback();
    const uploaded = await uploadFile(file, "gcp-central/caa");
    if (!uploaded) return;
    setter(uploaded);
    setAlertState({ type: "success", message: `Uploaded: ${uploaded.documentFileName}` });
  }

  function handleCreateBaseRequest() {
    resetFeedback();
    const payload = { requestType: CAA_FORM_CODE, routingType: category, requestTitle, category, requestorId: requestor.id, requestorName: requestor.name, requestorEmail: requestor.email, companyId: requestor.companyId, companyCode: requestor.companyCode, companyName: requestor.companyName };
    const validated = createCaaBaseRequestSchema.safeParse(payload);
    if (!validated.success) return setErrorState("Please review the pre-populated basic information fields.");
    startTransition(async () => {
      const result = await createCaaBaseRequest(validated.data);
      if (!result.success) return setErrorState(result.message, result.fieldErrors);
      setRequestId(result.data.requestId); setRequestNo(result.data.requestNo); setCurrentStep(2);
      setAlertState({ type: "info", message: `Base request created (${result.data.requestNo}). Continue with project details.` });
    });
  }

  function handleSaveStep2() {
    resetFeedback();
    if (!requestId) return setErrorState("Base request not found. Please complete Step 1 first.");
    const payload = { requestId, projectId: projectDetails.projectId, projectCode: projectDetails.projectCode, companyId: projectDetails.companyId, companyCode: projectDetails.companyCode, companyName: projectDetails.companyName };
    const validated = saveCaaProjectDetailsSchema.safeParse(payload);
    if (!validated.success) return setErrorState("Please correct project details.");
    startTransition(async () => {
      const result = await saveCaaProjectDetails(validated.data);
      if (!result.success) return setErrorState(result.message, result.fieldErrors);
      setCurrentStep(3);
    });
  }

  function handleSaveStep8AndProceedDocuments() {
    resetFeedback();
    if (!requestId) return setErrorState("Base request not found. Please complete Step 1 first.");
    const payload = {
      requestId,
      tenderProposalPrice: toNumberOrUndefined(costFields.tenderProposalPrice),
      finalContractAmount: toNumberOrUndefined(costFields.finalContractAmount),
      estimatedBudgetCost: toNumberOrUndefined(costFields.estimatedBudgetCost),
      estimatedMarginPercent: toNumberOrUndefined(costFields.estimatedMarginPercent),
      tenderProposalRefNo: costFields.tenderProposalRefNo,
      loaDate: costFields.loaDate || undefined,
      contractCommencementDate: costFields.contractCommencementDate || undefined,
      contractCompletionDate: costFields.contractCompletionDate || undefined,
      contractPeriodDays: toNumberOrUndefined(costFields.contractPeriodDays),
      performanceBondForProject: contractFields.performanceBondForProject,
      stampDutyInclusiveLegalFees: toNumberOrUndefined(contractFields.stampDutyInclusiveLegalFees),
      insurance: contractFields.insurance,
      bumiputeraParticipation: contractFields.bumiputeraParticipation,
      formationOfJvCompany: contractFields.formationOfJvCompany,
      criticalActivityMilestone: contractFields.criticalActivityMilestone,
      defectLiabilityPeriodDlp: contractFields.defectLiabilityPeriodDlp,
      liquidatedDamagesRate: toNumberOrUndefined(contractFields2.liquidatedDamagesRate),
      paymentTerm: contractFields2.paymentTerm,
      typeOfContract: contractFields2.typeOfContract,
      formOfContractCondition: contractFields2.formOfContractCondition,
      projectDirector: contractFields2.projectDirector,
      contactPersonAtSite: contractFields2.contactPersonAtSite,
      claimApplicationProcess: tableHasContent(tableStep6A) ? tableStep6A : [],
      claimCertificationProcess: tableHasContent(tableStep6B) ? tableStep6B : [],
      variationOrderApplicationProcess: tableHasContent(tableStep6C) ? tableStep6C : [],
      extensionOfTimeApplicationProcess: tableHasContent(tableStep7A) ? tableStep7A : [],
      commissioningCompletionManagementSystems: tableHasContent(tableStep7B) ? tableStep7B : [],
      keyDeliveryMilestone: tableHasContent(tableStep7C) ? tableStep7C : [],
      mandatoryTestingRequiredToCommission: tableHasContent(tableStep8A) ? tableStep8A : [],
      documentRequiredForContractualAcceptance: tableHasContent(tableStep8B) ? tableStep8B : [],
      preRequisiteDocumentsForDlp: tableHasContent(tableStep8C) ? tableStep8C : [],
      organisationAndManpowerChartUrl: organisationChart?.documentUrl,
      organisationAndManpowerChartPublicId: organisationChart?.documentPublicId,
      organisationAndManpowerChartFileName: organisationChart?.documentFileName,
      organisationAndManpowerChartMimeType: organisationChart?.documentMimeType,
      organisationAndManpowerChartSizeBytes: organisationChart?.documentSizeBytes,
    };
    const validated = saveCaaDetailsSchema.safeParse(payload);
    if (!validated.success) return setErrorState("Please complete CAA details before proceeding.");
    startTransition(async () => {
      const result = await saveCaaDetails(validated.data);
      if (!result.success) return setErrorState(result.message, result.fieldErrors);
      setCurrentStep(9);
      setAlertState({ type: "info", message: "CAA details saved. Upload final document and submit." });
    });
  }

  function handleFinalSubmit() {
    resetFeedback();
    if (!requestId) return setErrorState("Base request not found.");
    if (!uploadedDocument) return setErrorState("Please upload final document.");
    const payload = { requestId, acknowledgement, ...uploadedDocument };
    const validated = submitCaaRequestSchema.safeParse(payload);
    if (!validated.success) return setErrorState("Please complete acknowledgement and document requirements.");
    startTransition(async () => {
      const result = await submitCaaRequest(validated.data);
      if (!result.success) return setErrorState(result.message, result.fieldErrors);
      setIsSubmitted(true); clearPersistedFormState(CAA_SESSION_STORAGE_KEY);
      setAlertState({ type: "success", message: `CAA request ${result.data.requestNo} submitted successfully.` });
      router.push("/requests");
    });
  }

  return (
    <div className="surface-card p-5 sm:p-6">
      <MultiStepStepper steps={CAA_STEPPER_STEPS} currentStep={currentStep} isSubmitted={isSubmitted} />

      {alertState ? (
        <div className={`alert mb-5 ${alertState.type === "error" ? "alert--danger" : alertState.type === "success" ? "alert--success" : "alert--info"}`}>
          <p className="alert__title">{alertState.type === "error" ? "Action required" : alertState.type === "success" ? "Success" : "Info"}</p>
          <p className="alert__body">{alertState.message}</p>
        </div>
      ) : null}

      {currentStep === 1 ? <section className="space-y-4"><p className="text-sm text-[var(--text-muted)]">Review your basic information before proceeding.</p><div className="grid gap-4 md:grid-cols-2"><InputField label="Request Title" value={requestTitle} readOnly inputClassName="bg-slate-50" /><InputField label="Category" value={category} readOnly inputClassName="bg-slate-50" /><InputField label="Requestor Name" value={requestor.name} readOnly inputClassName="bg-slate-50" /><InputField label="Requestor Email" value={requestor.email} readOnly inputClassName="bg-slate-50" /></div><div className="flex flex-wrap justify-end gap-3 pt-2"><Button href="/submit" variant="secondary" size="md">Cancel</Button><Button type="button" onClick={handleCreateBaseRequest} loading={isBusy}>{isBusy ? "Saving..." : "Next Step"}</Button></div></section> : null}

      {currentStep === 2 ? <section className="space-y-4"><div className="grid gap-4 md:grid-cols-2"><SelectField label="Project Name" required options={projectOptions} value={projectDetails.projectId} onChange={(e) => handleProjectSelection(e.target.value)} /><InputField label="Project Code" value={projectDetails.projectCode} readOnly inputClassName="bg-slate-50" /><InputField label="Company" value={`${projectDetails.companyName} (${projectDetails.companyCode})`} readOnly inputClassName="bg-slate-50" containerClassName="md:col-span-2" /></div><div className="flex flex-wrap justify-between gap-3 pt-2"><Button type="button" variant="secondary" onClick={() => setCurrentStep(1)} disabled={isBusy}>Previous</Button><Button type="button" onClick={handleSaveStep2} loading={isBusy}>{isBusy ? "Saving..." : "Next Step"}</Button></div></section> : null}

      {currentStep === 3 ? <section className="space-y-4"><div className="grid gap-4 md:grid-cols-2">{[
        ["Tender / Proposal Price", "tenderProposalPrice", "number"],
        ["Final Contract Amount", "finalContractAmount", "number"],
        ["Estimated Budget Cost", "estimatedBudgetCost", "number"],
        ["Estimated Margin %", "estimatedMarginPercent", "number"],
        ["Tender / Proposal Ref. No.", "tenderProposalRefNo", "text"],
        ["Letter of Award (LOA) Date", "loaDate", "date"],
        ["Contract Commencement Date", "contractCommencementDate", "date"],
        ["Contract Completion Date", "contractCompletionDate", "date"],
        ["Contract Period (days)", "contractPeriodDays", "number"],
      ].map(([label, key, type]) => <InputField key={key} label={label} type={type} value={costFields[key]} onChange={(e) => setCostFields((s) => ({ ...s, [key]: e.target.value }))} />)}</div><div className="flex flex-wrap justify-between gap-3 pt-2"><Button type="button" variant="secondary" onClick={() => setCurrentStep(2)}>Previous</Button><Button type="button" onClick={() => setCurrentStep(4)}>Next Step</Button></div></section> : null}

      {currentStep === 4 ? <section className="space-y-4"><div className="grid gap-4 md:grid-cols-2">{[
        ["Performance Bond (PB) for Project", "performanceBondForProject"],
        ["Stamp Duty (Inclusive legal fees)", "stampDutyInclusiveLegalFees"],
        ["Insurance", "insurance"],
        ["Bumiputera Participation", "bumiputeraParticipation"],
        ["Formation of JV Company", "formationOfJvCompany"],
        ["Critical Activities & Milestones", "criticalActivityMilestone"],
        ["Defect Liability Period (DLP)", "defectLiabilityPeriodDlp"],
      ].map(([label, key]) => <InputField key={key} label={label} value={contractFields[key]} onChange={(e) => setContractFields((s) => ({ ...s, [key]: e.target.value }))} />)}</div><div className="rounded-xl border border-[var(--border)] p-4"><p className="mb-2 text-sm font-semibold text-[var(--text)]">Project Organisation and Manpower Chart</p><input type="file" accept={acceptedDocumentTypes} onChange={(e) => handleUpload(e, setOrganisationChart)} className="input py-2" />{organisationChart ? <UploadedDocumentPreview documentUrl={organisationChart.documentUrl} documentFileName={organisationChart.documentFileName} documentMimeType={organisationChart.documentMimeType} documentSizeBytes={organisationChart.documentSizeBytes} /> : null}</div><div className="flex flex-wrap justify-between gap-3 pt-2"><Button type="button" variant="secondary" onClick={() => setCurrentStep(3)}>Previous</Button><Button type="button" onClick={() => setCurrentStep(5)}>Next Step</Button></div></section> : null}

      {currentStep === 5 ? <section className="space-y-4"><div className="grid gap-4 md:grid-cols-2">{[
        ["Liquidated Damages (LAD/day) Rate", "liquidatedDamagesRate"],
        ["Payment Term", "paymentTerm"],
        ["Type of Contract", "typeOfContract"],
        ["Form of Contract/Condition of Contract", "formOfContractCondition"],
        ["Project Director (PD)", "projectDirector"],
        ["Contact Person at Site/Designation/Contact No.", "contactPersonAtSite"],
      ].map(([label, key]) => <InputField key={key} label={label} value={contractFields2[key]} onChange={(e) => setContractFields2((s) => ({ ...s, [key]: e.target.value }))} />)}</div><div className="flex flex-wrap justify-between gap-3 pt-2"><Button type="button" variant="secondary" onClick={() => setCurrentStep(4)}>Previous</Button><Button type="button" onClick={() => setCurrentStep(6)}>Next Step</Button></div></section> : null}

      {currentStep === 6 ? <section className="space-y-4"><SimpleTable title="Claim Management - Claim Application Process" rows={tableStep6A} setRows={setTableStep6A} /><SimpleTable title="Claim Management - Claim Certification Process" rows={tableStep6B} setRows={setTableStep6B} /><SimpleTable title="Change Management – Variation Order Application Process" rows={tableStep6C} setRows={setTableStep6C} /><div className="flex flex-wrap justify-between gap-3 pt-2"><Button type="button" variant="secondary" onClick={() => setCurrentStep(5)}>Previous</Button><Button type="button" onClick={() => setCurrentStep(7)}>Next Step</Button></div></section> : null}
      {currentStep === 7 ? <section className="space-y-4"><SimpleTable title="Change Management – Extension of Time Application Process" rows={tableStep7A} setRows={setTableStep7A} /><SimpleTable title="Commissioning and Completion Management Systems" rows={tableStep7B} setRows={setTableStep7B} /><SimpleTable title="Key Delivery Milestone" rows={tableStep7C} setRows={setTableStep7C} /><div className="flex flex-wrap justify-between gap-3 pt-2"><Button type="button" variant="secondary" onClick={() => setCurrentStep(6)}>Previous</Button><Button type="button" onClick={() => setCurrentStep(8)}>Next Step</Button></div></section> : null}
      {currentStep === 8 ? <section className="space-y-4"><SimpleTable title="Mandatory Testing required to commission" rows={tableStep8A} setRows={setTableStep8A} /><SimpleTable title="Document required for Contractual Acceptance (CPC)" rows={tableStep8B} setRows={setTableStep8B} /><SimpleTable title="Pre requisite documents for completion of DLP" rows={tableStep8C} setRows={setTableStep8C} /><div className="flex flex-wrap justify-between gap-3 pt-2"><Button type="button" variant="secondary" onClick={() => setCurrentStep(7)}>Previous</Button><Button type="button" onClick={handleSaveStep8AndProceedDocuments} loading={isBusy}>{isBusy ? "Saving..." : "Next Step"}</Button></div></section> : null}

      {currentStep === 9 ? (
        <section className="space-y-4">
          <div className="space-y-3 rounded-xl border border-[var(--border)] p-4">
            <p className="text-sm font-semibold text-[var(--text)]">Final Document Upload</p>
            <input type="file" accept={acceptedDocumentTypes} onChange={(e) => handleUpload(e, setUploadedDocument)} className="input py-2" />
            <p className="text-xs text-[var(--text-subtle)]">Allowed: PDF, Word, Excel, JPG, PNG. Max size: {MAX_FILE_SIZE_MB}MB.</p>
            {uploadedDocument ? <UploadedDocumentPreview documentUrl={uploadedDocument.documentUrl} documentFileName={uploadedDocument.documentFileName} documentMimeType={uploadedDocument.documentMimeType} documentSizeBytes={uploadedDocument.documentSizeBytes} /> : null}
          </div>
          <label className="flex items-start gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface-soft)] p-3">
            <input type="checkbox" className="mt-1" checked={acknowledgement} onChange={(e) => setAcknowledgement(e.target.checked)} />
            <span className="text-sm text-[var(--text)]">I acknowledge that the uploaded document and submitted details are accurate.</span>
          </label>
          {fieldErrors.acknowledgement?.[0] ? <p className="text-xs text-[var(--danger-text)]">{fieldErrors.acknowledgement[0]}</p> : null}
          <div className="flex flex-wrap justify-between gap-3 pt-2">
            <Button type="button" variant="secondary" onClick={() => setCurrentStep(8)} disabled={isBusy || isSubmitted}>Previous</Button>
            {canSubmitRequest ? <Button type="button" onClick={handleFinalSubmit} loading={isBusy || isSubmitted}>{isSubmitted ? "Submitted" : isBusy ? "Submitting..." : "Submit CAA"}</Button> : null}
          </div>
        </section>
      ) : null}

      {requestNo ? <p className="mt-5 text-xs text-[var(--text-subtle)]">Request reference: {requestNo}</p> : null}
    </div>
  );
}
