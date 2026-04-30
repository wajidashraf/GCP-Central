"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  useTransition,
  type ChangeEvent,
  type Dispatch,
  type SetStateAction,
} from "react";
import { useRouter } from "next/navigation";
import Button from "@/src/components/ui/button";
import { InputField, SelectField, TextareaField, type SelectFieldOption } from "@/src/components/forms/fields";
import MultiStepStepper from "@/src/components/forms/multi-step-stepper";
import {
  clearPersistedFormState,
  readPersistedFormState,
  writePersistedFormState,
} from "@/src/components/forms/session-storage";
import UploadedDocumentPreview from "@/src/components/forms/uploaded-document-preview";
import {
  STSP_ALLOWED_DOCUMENT_MIME_TYPES,
  STSP_FORM_CODE,
  STSP_MAX_DOCUMENT_SIZE_BYTES,
  createStspBaseRequestSchema,
  saveStspDetailsSchema,
  saveStspProjectDetailsSchema,
  stspPicDetailsSchema,
  submitStspRequestSchema,
} from "@/lib/validations/stsp";
import {
  createStspBaseRequest,
  saveStspDetails,
  saveStspProjectDetails,
  submitStspRequest,
} from "../_actions/stsp";
import {
  STSP_STEPPER_STEPS,
  type ProjectOption,
  type RequestorContext,
  type StspPicDetailsState,
  type StspProjectDetailsState,
  type StspRiskItemState,
  type UploadedAssetState,
} from "../_config/stsp-form-schema";

type FieldErrors = Record<string, string[]>;
type AlertState = { type: "success" | "error" | "info"; message: string } | null;

type StspMultiStepFormProps = {
  channel: "gcpc" | "gcp";
  requestTitle: string;
  requestor: RequestorContext;
  projects: ReadonlyArray<ProjectOption>;
  canSubmitRequest: boolean;
};

type PersistedStspFormState = {
  currentStep: number;
  requestId: string | null;
  requestNo: string | null;
  projectDetails: StspProjectDetailsState;
  picDetails: StspPicDetailsState;
  backgroundReview: string;
  scopeOfWorks: string;
  keyTerms: string;
  financialPoints: string[];
  technical: string;
  procurementStrategyWorkPackages: string;
  sourcingReference: string;
  costBreakdown: string;
  riskReviewMitigationItems: StspRiskItemState[];
  contractStructureFile: UploadedAssetState | null;
  revenueVsCostFile: UploadedAssetState | null;
  cashflowFile: UploadedAssetState | null;
  uploadedDocument: UploadedAssetState | null;
  acknowledgement: boolean;
};

const MAX_FILE_SIZE_MB = STSP_MAX_DOCUMENT_SIZE_BYTES / (1024 * 1024);
const acceptedDocumentTypes = STSP_ALLOWED_DOCUMENT_MIME_TYPES.join(",");
const STSP_SESSION_STORAGE_KEY = "gcp-central:form:stsp:v1";
const defaultRiskRow: StspRiskItemState = { riskIdentified: "", mitigationPlan: "" };
const defaultPicDetails: StspPicDetailsState = {
  teamLeader: "",
  financialMatters: "",
  technicalMatters: "",
  contractMatters: "",
  procurementMatters: "",
  costingAndEstimationMatters: "",
  implementationStage: "",
};

function flattenFieldErrors(error: { flatten: () => { fieldErrors: FieldErrors } }) {
  return error.flatten().fieldErrors;
}

function normalizePointList(points: string[]) {
  return points.map((point) => point.trim()).filter((point) => point.length > 0);
}

function normalizeRiskItems(items: StspRiskItemState[]) {
  return items
    .map((item) => ({
      riskIdentified: item.riskIdentified.trim(),
      mitigationPlan: item.mitigationPlan.trim(),
    }))
    .filter((item) => item.riskIdentified.length > 0 || item.mitigationPlan.length > 0);
}

export default function StspMultiStepForm({
  channel,
  requestTitle,
  requestor,
  projects,
  canSubmitRequest,
}: StspMultiStepFormProps) {
  const router = useRouter();
  const category = useMemo(() => channel.toUpperCase() as "GCP" | "GCPC", [channel]);

  const [currentStep, setCurrentStep] = useState(1);
  const [requestId, setRequestId] = useState<string | null>(null);
  const [requestNo, setRequestNo] = useState<string | null>(null);
  const [isSubmitted, setIsSubmitted] = useState(false);

  const [projectDetails, setProjectDetails] = useState<StspProjectDetailsState>({
    projectId: "",
    projectCode: "",
    companyId: requestor.companyId,
    companyCode: requestor.companyCode,
    companyName: requestor.companyName,
    tenderProposalSubmissionDate: "",
    tenderValidityPeriodDays: "",
  });
  const [picDetails, setPicDetails] = useState<StspPicDetailsState>(defaultPicDetails);

  const [backgroundReview, setBackgroundReview] = useState("");
  const [scopeOfWorks, setScopeOfWorks] = useState("");
  const [keyTerms, setKeyTerms] = useState("");
  const [financialPoints, setFinancialPoints] = useState<string[]>([""]);

  const [technical, setTechnical] = useState("");
  const [procurementStrategyWorkPackages, setProcurementStrategyWorkPackages] = useState("");
  const [sourcingReference, setSourcingReference] = useState("");
  const [costBreakdown, setCostBreakdown] = useState("");
  const [riskReviewMitigationItems, setRiskReviewMitigationItems] = useState<StspRiskItemState[]>([
    defaultRiskRow,
  ]);

  const [contractStructureFile, setContractStructureFile] = useState<UploadedAssetState | null>(null);
  const [revenueVsCostFile, setRevenueVsCostFile] = useState<UploadedAssetState | null>(null);
  const [cashflowFile, setCashflowFile] = useState<UploadedAssetState | null>(null);
  const [uploadedDocument, setUploadedDocument] = useState<UploadedAssetState | null>(null);
  const [acknowledgement, setAcknowledgement] = useState(false);

  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [alertState, setAlertState] = useState<AlertState>(null);

  const [isUploading, setIsUploading] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [hasHydratedFromSession, setHasHydratedFromSession] = useState(false);
  const isBusy = isPending || isUploading;

  const projectOptions: ReadonlyArray<SelectFieldOption> = useMemo(
    () => [
      { value: "", label: projects.length > 0 ? "Select a project" : "No projects available" },
      ...projects.map((project) => ({
        value: project.id,
        label: project.projectName,
      })),
    ],
    [projects]
  );

  const handleProjectSelection = useCallback(
    (projectId: string) => {
      const selectedProject = projects.find((project) => project.id === projectId);
      if (!selectedProject) {
        setProjectDetails((current) => ({
          ...current,
          projectId: "",
          projectCode: "",
          companyId: requestor.companyId,
          companyCode: requestor.companyCode,
          companyName: requestor.companyName,
        }));
        return;
      }

      setProjectDetails((current) => ({
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
    const persistedState = readPersistedFormState<PersistedStspFormState>(STSP_SESSION_STORAGE_KEY);
    if (persistedState) {
      setCurrentStep(Math.min(Math.max(persistedState.currentStep, 1), STSP_STEPPER_STEPS.length));
      setRequestId(persistedState.requestId);
      setRequestNo(persistedState.requestNo);
      setProjectDetails(persistedState.projectDetails);
      setPicDetails(persistedState.picDetails);
      setBackgroundReview(persistedState.backgroundReview);
      setScopeOfWorks(persistedState.scopeOfWorks);
      setKeyTerms(persistedState.keyTerms);
      setFinancialPoints(persistedState.financialPoints);
      setTechnical(persistedState.technical);
      setProcurementStrategyWorkPackages(persistedState.procurementStrategyWorkPackages);
      setSourcingReference(persistedState.sourcingReference);
      setCostBreakdown(persistedState.costBreakdown);
      setRiskReviewMitigationItems(persistedState.riskReviewMitigationItems);
      setContractStructureFile(persistedState.contractStructureFile);
      setRevenueVsCostFile(persistedState.revenueVsCostFile);
      setCashflowFile(persistedState.cashflowFile);
      setUploadedDocument(persistedState.uploadedDocument);
      setAcknowledgement(persistedState.acknowledgement);
    }
    setHasHydratedFromSession(true);
  }, []);

  useEffect(() => {
    if (!hasHydratedFromSession || isSubmitted) return;
    writePersistedFormState<PersistedStspFormState>(STSP_SESSION_STORAGE_KEY, {
      currentStep,
      requestId,
      requestNo,
      projectDetails,
      picDetails,
      backgroundReview,
      scopeOfWorks,
      keyTerms,
      financialPoints,
      technical,
      procurementStrategyWorkPackages,
      sourcingReference,
      costBreakdown,
      riskReviewMitigationItems,
      contractStructureFile,
      revenueVsCostFile,
      cashflowFile,
      uploadedDocument,
      acknowledgement,
    });
  }, [
    acknowledgement,
    backgroundReview,
    cashflowFile,
    contractStructureFile,
    costBreakdown,
    currentStep,
    financialPoints,
    hasHydratedFromSession,
    isSubmitted,
    keyTerms,
    picDetails,
    procurementStrategyWorkPackages,
    projectDetails,
    requestId,
    requestNo,
    revenueVsCostFile,
    riskReviewMitigationItems,
    scopeOfWorks,
    sourcingReference,
    technical,
    uploadedDocument,
  ]);

  useEffect(() => {
    if (projects.length === 1 && !projectDetails.projectId) {
      handleProjectSelection(projects[0].id);
    }
  }, [handleProjectSelection, projectDetails.projectId, projects]);

  function setErrorState(message: string, errors?: FieldErrors) {
    setAlertState({ type: "error", message });
    setFieldErrors(errors ?? {});
  }
  function resetFeedback() {
    setAlertState(null);
    setFieldErrors({});
  }
  function clearGeneralFieldError(name: string) {
    if (!fieldErrors[name]) return;
    setFieldErrors((current) => {
      const next = { ...current };
      delete next[name];
      return next;
    });
  }
  function getFieldError(name: string) {
    return fieldErrors[name]?.[0];
  }

  function updatePointListValue(
    setter: Dispatch<SetStateAction<string[]>>,
    fieldKey: string,
    index: number,
    value: string
  ) {
    setter((current) => {
      const next = [...current];
      next[index] = value;
      return next;
    });
    clearGeneralFieldError(fieldKey);
  }
  function addPointToList(setter: Dispatch<SetStateAction<string[]>>, fieldKey: string) {
    setter((current) => [...current, ""]);
    clearGeneralFieldError(fieldKey);
  }
  function removePointFromList(setter: Dispatch<SetStateAction<string[]>>, fieldKey: string, index: number) {
    setter((current) => {
      const next = current.filter((_, pointIndex) => pointIndex !== index);
      return next.length > 0 ? next : [""];
    });
    clearGeneralFieldError(fieldKey);
  }

  async function uploadAsset(file: File, folder: string): Promise<UploadedAssetState | null> {
    if (
      !STSP_ALLOWED_DOCUMENT_MIME_TYPES.includes(
        file.type as (typeof STSP_ALLOWED_DOCUMENT_MIME_TYPES)[number]
      )
    ) {
      setErrorState("Unsupported file type.", {
        documentMimeType: ["Please upload PDF, Office, JPG, or PNG files only."],
      });
      return null;
    }
    if (file.size <= 0 || file.size > STSP_MAX_DOCUMENT_SIZE_BYTES) {
      setErrorState(`File must be within 0-${MAX_FILE_SIZE_MB}MB.`, {
        documentSizeBytes: [`Maximum allowed file size is ${MAX_FILE_SIZE_MB}MB.`],
      });
      return null;
    }

    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.set("file", file);
      formData.set("folder", folder);
      const response = await fetch("/api/uploads/cloudinary", { method: "POST", body: formData });
      const responseData = (await response.json()) as UploadedAssetState | { message?: string };

      if (!response.ok) {
        const message =
          "message" in responseData && responseData.message
            ? responseData.message
            : "Document upload failed.";
        setErrorState(message);
        return null;
      }
      return responseData as UploadedAssetState;
    } catch {
      setErrorState("An unexpected error occurred while uploading file.");
      return null;
    } finally {
      setIsUploading(false);
    }
  }

  async function handleUpload(
    event: ChangeEvent<HTMLInputElement>,
    setter: Dispatch<SetStateAction<UploadedAssetState | null>>,
    successPrefix: string
  ) {
    const file = event.target.files?.[0];
    if (!file) return;
    resetFeedback();
    const uploadedFile = await uploadAsset(file, "gcp-central/stsp");
    if (!uploadedFile) return;
    setter(uploadedFile);
    setAlertState({ type: "success", message: `${successPrefix}: ${uploadedFile.documentFileName}` });
  }

  function handleCreateBaseRequest() {
    resetFeedback();
    const payload = {
      requestType: STSP_FORM_CODE,
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
    const validatedInput = createStspBaseRequestSchema.safeParse(payload);
    if (!validatedInput.success) {
      setErrorState("Please review the pre-populated basic information fields.", flattenFieldErrors(validatedInput.error));
      return;
    }
    startTransition(async () => {
      const result = await createStspBaseRequest(validatedInput.data);
      if (!result.success) return setErrorState(result.message, result.fieldErrors);
      setRequestId(result.data.requestId);
      setRequestNo(result.data.requestNo);
      setCurrentStep(2);
      setAlertState({ type: "info", message: `Base request created (${result.data.requestNo}). Continue with project details.` });
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
      projectId: projectDetails.projectId,
      projectCode: projectDetails.projectCode,
      companyId: projectDetails.companyId,
      companyCode: projectDetails.companyCode,
      companyName: projectDetails.companyName,
      tenderProposalSubmissionDate: projectDetails.tenderProposalSubmissionDate,
      tenderValidityPeriodDays: Number(projectDetails.tenderValidityPeriodDays),
    };
    const validatedInput = saveStspProjectDetailsSchema.safeParse(payload);
    if (!validatedInput.success) {
      setErrorState("Please correct the project details fields.", flattenFieldErrors(validatedInput.error));
      return;
    }
    startTransition(async () => {
      const result = await saveStspProjectDetails(validatedInput.data);
      if (!result.success) return setErrorState(result.message, result.fieldErrors);
      setCurrentStep(3);
      setAlertState({ type: "info", message: "Project details saved. Continue with PIC details." });
    });
  }

  function handleSaveStep3() {
    resetFeedback();
    const validatedPic = stspPicDetailsSchema.safeParse(picDetails);
    if (!validatedPic.success) {
      setErrorState("Please complete PIC details before proceeding.", flattenFieldErrors(validatedPic.error));
      return;
    }
    setCurrentStep(4);
  }

  function handleSaveStep5() {
    resetFeedback();
    if (!requestId) return;
    const payload = {
      requestId,
      ...picDetails,
      backgroundReview,
      scopeOfWorks,
      keyTerms,
      financialPoints: normalizePointList(financialPoints),
      technical,
      procurementStrategyWorkPackages,
      sourcingReference,
      costBreakdown,
      riskReviewMitigationItems: normalizeRiskItems(riskReviewMitigationItems),
      contractStructureUrl: contractStructureFile?.documentUrl,
      contractStructurePublicId: contractStructureFile?.documentPublicId,
      contractStructureFileName: contractStructureFile?.documentFileName,
      contractStructureMimeType: contractStructureFile?.documentMimeType,
      contractStructureSizeBytes: contractStructureFile?.documentSizeBytes,
      revenueVsCostUrl: revenueVsCostFile?.documentUrl,
      revenueVsCostPublicId: revenueVsCostFile?.documentPublicId,
      revenueVsCostFileName: revenueVsCostFile?.documentFileName,
      revenueVsCostMimeType: revenueVsCostFile?.documentMimeType,
      revenueVsCostSizeBytes: revenueVsCostFile?.documentSizeBytes,
      cashflowUrl: cashflowFile?.documentUrl,
      cashflowPublicId: cashflowFile?.documentPublicId,
      cashflowFileName: cashflowFile?.documentFileName,
      cashflowMimeType: cashflowFile?.documentMimeType,
      cashflowSizeBytes: cashflowFile?.documentSizeBytes,
    };
    const validatedInput = saveStspDetailsSchema.safeParse(payload);
    if (!validatedInput.success) {
      setErrorState("Please complete STSP information before proceeding.", flattenFieldErrors(validatedInput.error));
      return;
    }
    startTransition(async () => {
      const result = await saveStspDetails(validatedInput.data);
      if (!result.success) return setErrorState(result.message, result.fieldErrors);
      setCurrentStep(6);
      setAlertState({ type: "info", message: "ST/SP details saved. Upload final document and submit." });
    });
  }

  function handleFinalSubmit() {
    resetFeedback();
    if (!requestId) {
      setErrorState("Base request not found. Please complete Step 1 first.");
      setCurrentStep(1);
      return;
    }
    if (!uploadedDocument) {
      setErrorState("Please upload final document before submission.", {
        documentFileName: ["Document upload is required"],
      });
      return;
    }
    const payload = { requestId, acknowledgement, ...uploadedDocument };
    const validatedInput = submitStspRequestSchema.safeParse(payload);
    if (!validatedInput.success) {
      setErrorState("Please complete acknowledgement and document requirements.", flattenFieldErrors(validatedInput.error));
      return;
    }
    startTransition(async () => {
      const result = await submitStspRequest(validatedInput.data);
      if (!result.success) return setErrorState(result.message, result.fieldErrors);
      setIsSubmitted(true);
      clearPersistedFormState(STSP_SESSION_STORAGE_KEY);
      setAlertState({ type: "success", message: `STSP request ${result.data.requestNo} submitted successfully.` });
      router.push("/requests");
    });
  }

  return (
    <div className="surface-card p-5 sm:p-6">
      <MultiStepStepper steps={STSP_STEPPER_STEPS} currentStep={currentStep} isSubmitted={isSubmitted} />
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
            <Button type="button" onClick={handleCreateBaseRequest} loading={isBusy}>
              {isBusy ? "Saving..." : "Next Step"}
            </Button>
          </div>
        </section>
      ) : null}

      {currentStep === 2 ? (
        <section className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <SelectField label="Project Name" required options={projectOptions} value={projectDetails.projectId} onChange={(event) => handleProjectSelection(event.target.value)} error={getFieldError("projectId")} />
            <InputField label="Project Code" value={projectDetails.projectCode} readOnly inputClassName="bg-slate-50" />
            <InputField label="Company" value={`${projectDetails.companyName} (${projectDetails.companyCode})`} readOnly inputClassName="bg-slate-50" containerClassName="md:col-span-2" />
            <InputField label="Tender/Proposal Submission Date" type="date" value={projectDetails.tenderProposalSubmissionDate} onChange={(event) => setProjectDetails((current) => ({ ...current, tenderProposalSubmissionDate: event.target.value }))} error={getFieldError("tenderProposalSubmissionDate")} />
            <InputField label="Tender Validity Period (Days)" type="number" min={0} value={projectDetails.tenderValidityPeriodDays} onChange={(event) => setProjectDetails((current) => ({ ...current, tenderValidityPeriodDays: event.target.value }))} error={getFieldError("tenderValidityPeriodDays")} />
          </div>
          <div className="flex flex-wrap justify-between gap-3 pt-2">
            <Button type="button" variant="secondary" onClick={() => setCurrentStep(1)} disabled={isBusy}>Previous</Button>
            <Button type="button" onClick={handleSaveStep2} loading={isBusy}>{isBusy ? "Saving..." : "Next Step"}</Button>
          </div>
        </section>
      ) : null}

      {currentStep === 3 ? (
        <section className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            {Object.entries(picDetails).map(([key, value]) => (
              <InputField
                key={key}
                label={key.replace(/([A-Z])/g, " $1").replace(/^./, (c) => c.toUpperCase())}
                value={value}
                onChange={(event) => {
                  setPicDetails((current) => ({ ...current, [key]: event.target.value }));
                  clearGeneralFieldError(key);
                }}
                error={getFieldError(key)}
                containerClassName={key === "implementationStage" ? "md:col-span-2" : undefined}
              />
            ))}
          </div>
          <div className="flex flex-wrap justify-between gap-3 pt-2">
            <Button type="button" variant="secondary" onClick={() => setCurrentStep(2)} disabled={isBusy}>Previous</Button>
            <Button type="button" onClick={handleSaveStep3} disabled={isBusy}>Next Step</Button>
          </div>
        </section>
      ) : null}

      {currentStep === 4 ? (
        <section className="space-y-4">
          <TextareaField label="Brief on the background of matters for review" value={backgroundReview} onChange={(event) => setBackgroundReview(event.target.value)} error={getFieldError("backgroundReview")} />
          <TextareaField label="Scope of Works" value={scopeOfWorks} onChange={(event) => setScopeOfWorks(event.target.value)} error={getFieldError("scopeOfWorks")} />
          <TextareaField label="Key Terms" value={keyTerms} onChange={(event) => setKeyTerms(event.target.value)} error={getFieldError("keyTerms")} />

          <div className="rounded-xl border border-[var(--border)] p-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <p className="text-sm font-semibold text-[var(--text)]">Financial</p>
              <Button type="button" variant="secondary" size="sm" onClick={() => addPointToList(setFinancialPoints, "financialPoints")}>Add New Point</Button>
            </div>
            <div className="space-y-2">
              {financialPoints.map((point, index) => (
                <div key={`financial-${index}`} className="flex items-center gap-2">
                  <span className="w-6 text-xs font-semibold text-[var(--text-subtle)]">{index + 1}.</span>
                  <input value={point} onChange={(event) => updatePointListValue(setFinancialPoints, "financialPoints", index, event.target.value)} className="input flex-1" />
                  {financialPoints.length > 1 ? (
                    <Button type="button" size="sm" variant="ghost" className="text-[var(--danger-text)]" onClick={() => removePointFromList(setFinancialPoints, "financialPoints", index)}>✕</Button>
                  ) : null}
                </div>
              ))}
            </div>
            {getFieldError("financialPoints") ? <p className="mt-2 text-xs text-[var(--danger-text)]">{getFieldError("financialPoints")}</p> : null}
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <div className="rounded-xl border border-[var(--border)] p-4">
              <p className="mb-2 text-sm font-semibold">Contract Structure Image</p>
              <input type="file" accept={acceptedDocumentTypes} onChange={(event) => handleUpload(event, setContractStructureFile, "Contract structure uploaded")} className="input py-2" />
              {contractStructureFile ? <UploadedDocumentPreview documentUrl={contractStructureFile.documentUrl} documentFileName={contractStructureFile.documentFileName} documentMimeType={contractStructureFile.documentMimeType} documentSizeBytes={contractStructureFile.documentSizeBytes} /> : null}
            </div>
            <div className="rounded-xl border border-[var(--border)] p-4">
              <p className="mb-2 text-sm font-semibold">Revenue vs Cost</p>
              <input type="file" accept={acceptedDocumentTypes} onChange={(event) => handleUpload(event, setRevenueVsCostFile, "Revenue vs cost uploaded")} className="input py-2" />
              {revenueVsCostFile ? <UploadedDocumentPreview documentUrl={revenueVsCostFile.documentUrl} documentFileName={revenueVsCostFile.documentFileName} documentMimeType={revenueVsCostFile.documentMimeType} documentSizeBytes={revenueVsCostFile.documentSizeBytes} /> : null}
            </div>
            <div className="rounded-xl border border-[var(--border)] p-4">
              <p className="mb-2 text-sm font-semibold">Cashflow</p>
              <input type="file" accept={acceptedDocumentTypes} onChange={(event) => handleUpload(event, setCashflowFile, "Cashflow uploaded")} className="input py-2" />
              {cashflowFile ? <UploadedDocumentPreview documentUrl={cashflowFile.documentUrl} documentFileName={cashflowFile.documentFileName} documentMimeType={cashflowFile.documentMimeType} documentSizeBytes={cashflowFile.documentSizeBytes} /> : null}
            </div>
          </div>

          <div className="flex flex-wrap justify-between gap-3 pt-2">
            <Button type="button" variant="secondary" onClick={() => setCurrentStep(3)} disabled={isBusy}>Previous</Button>
            <Button type="button" onClick={() => setCurrentStep(5)} disabled={isBusy}>Next Step</Button>
          </div>
        </section>
      ) : null}

      {currentStep === 5 ? (
        <section className="space-y-4">
          <TextareaField label="Technical (Competency, Specification and Delivery)" value={technical} onChange={(event) => setTechnical(event.target.value)} error={getFieldError("technical")} />
          <TextareaField label="Procurement Strategy & Work Packages" value={procurementStrategyWorkPackages} onChange={(event) => setProcurementStrategyWorkPackages(event.target.value)} error={getFieldError("procurementStrategyWorkPackages")} />
          <TextareaField label="Sourcing Reference" value={sourcingReference} onChange={(event) => setSourcingReference(event.target.value)} error={getFieldError("sourcingReference")} />
          <TextareaField label="Cost Breakdown" value={costBreakdown} onChange={(event) => setCostBreakdown(event.target.value)} error={getFieldError("costBreakdown")} />
          <div className="rounded-xl border border-[var(--border)] p-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <p className="text-sm font-semibold text-[var(--text)]">Risk Identification & Mitigation Plan</p>
              <Button type="button" variant="secondary" size="sm" onClick={() => setRiskReviewMitigationItems((current) => [...current, { ...defaultRiskRow }])}>+ Add Risk</Button>
            </div>
            {riskReviewMitigationItems.map((item, index) => (
              <div key={`risk-row-${index}`} className="mb-2 grid gap-2 md:grid-cols-[1fr_1fr_auto]">
                <input className="input" placeholder="Enter identified risk" value={item.riskIdentified} onChange={(event) => setRiskReviewMitigationItems((current) => current.map((row, rowIndex) => rowIndex === index ? { ...row, riskIdentified: event.target.value } : row))} />
                <input className="input" placeholder="Enter mitigation plan" value={item.mitigationPlan} onChange={(event) => setRiskReviewMitigationItems((current) => current.map((row, rowIndex) => rowIndex === index ? { ...row, mitigationPlan: event.target.value } : row))} />
                <Button type="button" variant="ghost" className="text-[var(--danger-text)]" onClick={() => setRiskReviewMitigationItems((current) => current.filter((_, rowIndex) => rowIndex !== index).length > 0 ? current.filter((_, rowIndex) => rowIndex !== index) : [{ ...defaultRiskRow }])}>Remove</Button>
              </div>
            ))}
            {getFieldError("riskReviewMitigationItems") ? <p className="mt-2 text-xs text-[var(--danger-text)]">{getFieldError("riskReviewMitigationItems")}</p> : null}
          </div>
          <div className="flex flex-wrap justify-between gap-3 pt-2">
            <Button type="button" variant="secondary" onClick={() => setCurrentStep(4)} disabled={isBusy}>Previous</Button>
            <Button type="button" onClick={handleSaveStep5} loading={isBusy}>{isBusy ? "Saving..." : "Next Step"}</Button>
          </div>
        </section>
      ) : null}

      {currentStep === 6 ? (
        <section className="space-y-4">
          <div className="space-y-3 rounded-xl border border-[var(--border)] p-4">
            <p className="text-sm font-semibold text-[var(--text)]">Final Document Upload</p>
            <input type="file" accept={acceptedDocumentTypes} onChange={(event) => handleUpload(event, setUploadedDocument, "Document uploaded")} className="input py-2" />
            {uploadedDocument ? <UploadedDocumentPreview documentUrl={uploadedDocument.documentUrl} documentFileName={uploadedDocument.documentFileName} documentMimeType={uploadedDocument.documentMimeType} documentSizeBytes={uploadedDocument.documentSizeBytes} /> : null}
          </div>
          <label className="flex items-start gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface-soft)] p-3">
            <input type="checkbox" className="mt-1" checked={acknowledgement} onChange={(event) => setAcknowledgement(event.target.checked)} />
            <span className="text-sm text-[var(--text)]">I acknowledge that the uploaded document and submitted details are accurate.</span>
          </label>
          {getFieldError("acknowledgement") ? <p className="text-xs text-[var(--danger-text)]">{getFieldError("acknowledgement")}</p> : null}
          <div className="flex flex-wrap justify-between gap-3 pt-2">
            <Button type="button" variant="secondary" onClick={() => setCurrentStep(5)} disabled={isBusy || isSubmitted}>Previous</Button>
            {canSubmitRequest ? (
              <Button type="button" onClick={handleFinalSubmit} loading={isBusy || isSubmitted}>
                {isSubmitted ? "Submitted" : isBusy ? "Submitting..." : "Submit STSP"}
              </Button>
            ) : null}
          </div>
        </section>
      ) : null}

      {requestNo ? <p className="mt-5 text-xs text-[var(--text-subtle)]">Request reference: {requestNo}</p> : null}
    </div>
  );
}
