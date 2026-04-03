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
import { InputField, SelectField, type SelectFieldOption } from "@/src/components/forms/fields";
import MultiStepStepper from "@/src/components/forms/multi-step-stepper";
import {
  clearPersistedFormState,
  readPersistedFormState,
  writePersistedFormState,
} from "@/src/components/forms/session-storage";
import UploadedDocumentPreview from "@/src/components/forms/uploaded-document-preview";
import {
  JVP_ALLOWED_DOCUMENT_MIME_TYPES,
  JVP_FORM_CODE,
  JVP_MAX_DOCUMENT_SIZE_BYTES,
  createJvpBaseRequestSchema,
  jvpPicDetailsSchema,
  saveJvpDetailsSchema,
  saveJvpProjectDetailsSchema,
  submitJvpRequestSchema,
} from "@/lib/validations/jvp";
import {
  createJvpBaseRequest,
  saveJvpDetails,
  saveJvpProjectDetails,
  submitJvpRequest,
} from "../_actions/jvp";
import {
  JVP_STEPPER_STEPS,
  type JvpPicDetailsState,
  type JvpProjectDetailsState,
  type JvpRiskItemState,
  type ProjectOption,
  type RequestorContext,
  type UploadedAssetState,
} from "../_config/jvp-form-schema";

type FieldErrors = Record<string, string[]>;

type AlertState =
  | {
      type: "success" | "error" | "info";
      message: string;
    }
  | null;

type JvpMultiStepFormProps = {
  channel: "gcpc" | "gcp";
  requestTitle: string;
  requestor: RequestorContext;
  projects: ReadonlyArray<ProjectOption>;
};

type PersistedJvpFormState = {
  currentStep: number;
  requestId: string | null;
  requestNo: string | null;
  projectDetails: JvpProjectDetailsState;
  picDetails: JvpPicDetailsState;
  backgroundOfCollabPoints: string[];
  scopeOfCollabPoints: string[];
  proposedStructurePoints: string[];
  keyTermsPoints: string[];
  financialOverviewPoints: string[];
  technicalCapabilitiesPoints: string[];
  workPackagesDivisionPoints: string[];
  resourcesContributionPoints: string[];
  riskReviewMitigationItems: JvpRiskItemState[];
  cashflowForecastFile: UploadedAssetState | null;
  costStructureFile: UploadedAssetState | null;
  uploadedDocument: UploadedAssetState | null;
  acknowledgement: boolean;
};

type DynamicPointsSectionProps = {
  title: string;
  points: string[];
  error?: string;
  onPointChange: (index: number, value: string) => void;
  onAddPoint: () => void;
  onRemovePoint: (index: number) => void;
};

const MAX_FILE_SIZE_MB = JVP_MAX_DOCUMENT_SIZE_BYTES / (1024 * 1024);
const acceptedDocumentTypes = JVP_ALLOWED_DOCUMENT_MIME_TYPES.join(",");
const JVP_SESSION_STORAGE_KEY = "gcp-central:form:jvp:v2";
const defaultPointList = [""];
const defaultRiskRow: JvpRiskItemState = { riskIdentified: "", mitigationPlan: "" };
const step4Schema = saveJvpDetailsSchema.pick({
  backgroundOfCollabPoints: true,
  scopeOfCollabPoints: true,
  proposedStructurePoints: true,
});
const step5Schema = saveJvpDetailsSchema.pick({
  keyTermsPoints: true,
  financialOverviewPoints: true,
  technicalCapabilitiesPoints: true,
  cashflowForecastUrl: true,
  cashflowForecastPublicId: true,
  cashflowForecastFileName: true,
  cashflowForecastMimeType: true,
  cashflowForecastSizeBytes: true,
});
const documentMetadataSchema = submitJvpRequestSchema.pick({
  documentUrl: true,
  documentPublicId: true,
  documentFileName: true,
  documentMimeType: true,
  documentSizeBytes: true,
});

const defaultPicDetails: JvpPicDetailsState = {
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

function normalizeRiskItems(items: JvpRiskItemState[]) {
  return items
    .map((item) => ({
      riskIdentified: item.riskIdentified.trim(),
      mitigationPlan: item.mitigationPlan.trim(),
    }))
    .filter((item) => item.riskIdentified.length > 0 || item.mitigationPlan.length > 0);
}

function DynamicPointsSection({
  title,
  points,
  error,
  onPointChange,
  onAddPoint,
  onRemovePoint,
}: DynamicPointsSectionProps) {
  return (
    <div className="rounded-xl border border-[var(--border)] p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="text-sm font-semibold text-[var(--text)]">{title}</p>
        <Button type="button" variant="secondary" size="sm" onClick={onAddPoint}>
          Add New Point
        </Button>
      </div>
      <div className="space-y-2">
        {points.map((point, index) => (
          <div key={`${title}-${index}`} className="flex items-center gap-2">
            <span className="w-6 text-xs font-semibold text-[var(--text-subtle)]">{index + 1}.</span>
            <input
              value={point}
              onChange={(event) => onPointChange(index, event.target.value)}
              className="input flex-1"
              placeholder={`Enter point ${index + 1}`}
            />
            {points.length > 1 ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => onRemovePoint(index)}
                className="text-[var(--danger-text)]"
              >
                ✕
              </Button>
            ) : null}
          </div>
        ))}
      </div>
      {error ? <p className="mt-2 text-xs text-[var(--danger-text)]">{error}</p> : null}
    </div>
  );
}

export default function JvpMultiStepForm({
  channel,
  requestTitle,
  requestor,
  projects,
}: JvpMultiStepFormProps) {
  const router = useRouter();
  const category = useMemo(() => channel.toUpperCase() as "GCP" | "GCPC", [channel]);

  const [currentStep, setCurrentStep] = useState(1);
  const [requestId, setRequestId] = useState<string | null>(null);
  const [requestNo, setRequestNo] = useState<string | null>(null);
  const [isSubmitted, setIsSubmitted] = useState(false);

  const [projectDetails, setProjectDetails] = useState<JvpProjectDetailsState>({
    projectId: "",
    projectCode: "",
    companyId: requestor.companyId,
    companyCode: requestor.companyCode,
    companyName: requestor.companyName,
  });
  const [picDetails, setPicDetails] = useState<JvpPicDetailsState>(defaultPicDetails);

  const [backgroundOfCollabPoints, setBackgroundOfCollabPoints] = useState<string[]>(defaultPointList);
  const [scopeOfCollabPoints, setScopeOfCollabPoints] = useState<string[]>(defaultPointList);
  const [proposedStructurePoints, setProposedStructurePoints] = useState<string[]>(defaultPointList);
  const [keyTermsPoints, setKeyTermsPoints] = useState<string[]>(defaultPointList);
  const [financialOverviewPoints, setFinancialOverviewPoints] = useState<string[]>(defaultPointList);
  const [technicalCapabilitiesPoints, setTechnicalCapabilitiesPoints] = useState<string[]>(defaultPointList);
  const [workPackagesDivisionPoints, setWorkPackagesDivisionPoints] = useState<string[]>(defaultPointList);
  const [resourcesContributionPoints, setResourcesContributionPoints] = useState<string[]>(defaultPointList);
  const [riskReviewMitigationItems, setRiskReviewMitigationItems] = useState<JvpRiskItemState[]>([
    defaultRiskRow,
  ]);

  const [cashflowForecastFile, setCashflowForecastFile] = useState<UploadedAssetState | null>(null);
  const [costStructureFile, setCostStructureFile] = useState<UploadedAssetState | null>(null);
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
      {
        value: "",
        label: projects.length > 0 ? "Select a project" : "No projects available",
      },
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
        setProjectDetails({
          projectId: "",
          projectCode: "",
          companyId: requestor.companyId,
          companyCode: requestor.companyCode,
          companyName: requestor.companyName,
        });
        return;
      }

      setProjectDetails({
        projectId: selectedProject.id,
        projectCode: selectedProject.projectCode.trim(),
        companyId: selectedProject.companyId,
        companyCode: selectedProject.companyCode,
        companyName: selectedProject.companyName,
      });
    },
    [projects, requestor.companyCode, requestor.companyId, requestor.companyName]
  );

  useEffect(() => {
    const persistedState = readPersistedFormState<PersistedJvpFormState>(
      JVP_SESSION_STORAGE_KEY
    );

    if (persistedState) {
      setCurrentStep(Math.min(Math.max(persistedState.currentStep, 1), JVP_STEPPER_STEPS.length));
      setRequestId(persistedState.requestId);
      setRequestNo(persistedState.requestNo);
      setProjectDetails(persistedState.projectDetails);
      setPicDetails(persistedState.picDetails);
      setBackgroundOfCollabPoints(persistedState.backgroundOfCollabPoints);
      setScopeOfCollabPoints(persistedState.scopeOfCollabPoints);
      setProposedStructurePoints(persistedState.proposedStructurePoints);
      setKeyTermsPoints(persistedState.keyTermsPoints);
      setFinancialOverviewPoints(persistedState.financialOverviewPoints);
      setTechnicalCapabilitiesPoints(persistedState.technicalCapabilitiesPoints);
      setWorkPackagesDivisionPoints(persistedState.workPackagesDivisionPoints);
      setResourcesContributionPoints(persistedState.resourcesContributionPoints);
      setRiskReviewMitigationItems(persistedState.riskReviewMitigationItems);
      setCashflowForecastFile(persistedState.cashflowForecastFile);
      setCostStructureFile(persistedState.costStructureFile);
      setUploadedDocument(persistedState.uploadedDocument);
      setAcknowledgement(persistedState.acknowledgement);
    }

    setHasHydratedFromSession(true);
  }, []);

  useEffect(() => {
    if (!hasHydratedFromSession || isSubmitted) {
      return;
    }

    writePersistedFormState<PersistedJvpFormState>(JVP_SESSION_STORAGE_KEY, {
      currentStep,
      requestId,
      requestNo,
      projectDetails,
      picDetails,
      backgroundOfCollabPoints,
      scopeOfCollabPoints,
      proposedStructurePoints,
      keyTermsPoints,
      financialOverviewPoints,
      technicalCapabilitiesPoints,
      workPackagesDivisionPoints,
      resourcesContributionPoints,
      riskReviewMitigationItems,
      cashflowForecastFile,
      costStructureFile,
      uploadedDocument,
      acknowledgement,
    });
  }, [
    acknowledgement,
    backgroundOfCollabPoints,
    cashflowForecastFile,
    costStructureFile,
    currentStep,
    financialOverviewPoints,
    hasHydratedFromSession,
    isSubmitted,
    keyTermsPoints,
    picDetails,
    projectDetails,
    proposedStructurePoints,
    requestId,
    requestNo,
    resourcesContributionPoints,
    riskReviewMitigationItems,
    scopeOfCollabPoints,
    technicalCapabilitiesPoints,
    uploadedDocument,
    workPackagesDivisionPoints,
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
    if (!fieldErrors[name]) {
      return;
    }

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

  function removePointFromList(
    setter: Dispatch<SetStateAction<string[]>>,
    fieldKey: string,
    index: number
  ) {
    setter((current) => {
      const next = current.filter((_, pointIndex) => pointIndex !== index);
      return next.length > 0 ? next : [""];
    });
    clearGeneralFieldError(fieldKey);
  }

  async function uploadAsset(file: File, folder: string): Promise<UploadedAssetState | null> {
    if (
      !JVP_ALLOWED_DOCUMENT_MIME_TYPES.includes(
        file.type as (typeof JVP_ALLOWED_DOCUMENT_MIME_TYPES)[number]
      )
    ) {
      setErrorState("Unsupported file type.", {
        documentMimeType: ["Please upload PDF, Office, JPG, or PNG files only."],
      });
      return null;
    }

    if (file.size <= 0 || file.size > JVP_MAX_DOCUMENT_SIZE_BYTES) {
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

      const response = await fetch("/api/uploads/cloudinary", {
        method: "POST",
        body: formData,
      });

      const responseData = (await response.json()) as UploadedAssetState | { message?: string };

      if (!response.ok) {
        const message =
          "message" in responseData && responseData.message
            ? responseData.message
            : "Document upload failed.";
        setErrorState(message);
        return null;
      }

      const validatedDocument = documentMetadataSchema.safeParse(responseData);
      if (!validatedDocument.success) {
        setErrorState("Uploaded document metadata is invalid.", flattenFieldErrors(validatedDocument.error));
        return null;
      }

      return validatedDocument.data;
    } catch {
      setErrorState("An unexpected error occurred while uploading file.");
      return null;
    } finally {
      setIsUploading(false);
    }
  }

  async function removeUploadedAsset(
    asset: UploadedAssetState | null,
    onRemoved: () => void
  ) {
    if (!asset) {
      return;
    }

    setIsUploading(true);
    try {
      const response = await fetch("/api/uploads/cloudinary", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ publicId: asset.documentPublicId }),
      });

      if (!response.ok) {
        const responseData = (await response.json()) as { message?: string };
        setErrorState(responseData.message ?? "Failed to remove uploaded file.");
        return;
      }

      onRemoved();
      setAlertState({
        type: "info",
        message: `Removed uploaded file: ${asset.documentFileName}`,
      });
    } catch {
      setErrorState("Failed to remove uploaded file.");
    } finally {
      setIsUploading(false);
    }
  }

  async function handleCashflowUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    resetFeedback();
    const uploadedFile = await uploadAsset(file, "gcp-central/jvp/cashflow-forecast");
    if (!uploadedFile) {
      return;
    }

    setCashflowForecastFile(uploadedFile);
    clearGeneralFieldError("cashflowForecastUrl");
    setAlertState({
      type: "success",
      message: `Cashflow forecast uploaded: ${uploadedFile.documentFileName}`,
    });
  }

  async function handleCostStructureUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    resetFeedback();
    const uploadedFile = await uploadAsset(file, "gcp-central/jvp/cost-structure");
    if (!uploadedFile) {
      return;
    }

    setCostStructureFile(uploadedFile);
    clearGeneralFieldError("costStructureUrl");
    setAlertState({
      type: "success",
      message: `Cost structure file uploaded: ${uploadedFile.documentFileName}`,
    });
  }

  async function handleFinalDocumentUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    resetFeedback();
    const uploadedFile = await uploadAsset(file, "gcp-central/jvp");
    if (!uploadedFile) {
      return;
    }

    setUploadedDocument(uploadedFile);
    clearGeneralFieldError("documentFileName");
    setAlertState({
      type: "success",
      message: `Document uploaded: ${uploadedFile.documentFileName}`,
    });
  }

  function handleCreateBaseRequest() {
    resetFeedback();

    const payload = {
      requestType: JVP_FORM_CODE,
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

    const validatedInput = createJvpBaseRequestSchema.safeParse(payload);
    if (!validatedInput.success) {
      setErrorState(
        "Please review the pre-populated basic information fields.",
        flattenFieldErrors(validatedInput.error)
      );
      return;
    }

    startTransition(async () => {
      const result = await createJvpBaseRequest(validatedInput.data);

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
      projectId: projectDetails.projectId,
      projectCode: projectDetails.projectCode,
      companyId: projectDetails.companyId,
      companyCode: projectDetails.companyCode,
      companyName: projectDetails.companyName,
    };

    const validatedInput = saveJvpProjectDetailsSchema.safeParse(payload);
    if (!validatedInput.success) {
      setErrorState("Please select project details before proceeding.", flattenFieldErrors(validatedInput.error));
      return;
    }

    startTransition(async () => {
      const result = await saveJvpProjectDetails(validatedInput.data);

      if (!result.success) {
        setErrorState(result.message, result.fieldErrors);
        return;
      }

      setProjectDetails({
        projectId: result.data.projectId,
        projectCode: result.data.projectCode,
        companyId: result.data.companyId,
        companyCode: result.data.companyCode,
        companyName: result.data.companyName,
      });
      setCurrentStep(3);
      setAlertState({
        type: "info",
        message: "Project details saved. Continue with PIC information.",
      });
    });
  }

  function handleSaveStep3() {
    resetFeedback();

    const validatedPicDetails = jvpPicDetailsSchema.safeParse(picDetails);
    if (!validatedPicDetails.success) {
      setErrorState("Please complete PIC details before proceeding.", flattenFieldErrors(validatedPicDetails.error));
      return;
    }

    setCurrentStep(4);
    setAlertState({
      type: "info",
      message: "PIC details captured. Continue with JV information.",
    });
  }

  function handleSaveStep4() {
    resetFeedback();

    const normalizedBackground = normalizePointList(backgroundOfCollabPoints);
    const normalizedScope = normalizePointList(scopeOfCollabPoints);
    const normalizedStructure = normalizePointList(proposedStructurePoints);

    const validatedInput = step4Schema.safeParse({
      backgroundOfCollabPoints: normalizedBackground,
      scopeOfCollabPoints: normalizedScope,
      proposedStructurePoints: normalizedStructure,
    });

    if (!validatedInput.success) {
      setErrorState(
        "Please complete all Step 4 points before proceeding.",
        flattenFieldErrors(validatedInput.error)
      );
      return;
    }

    setBackgroundOfCollabPoints(normalizedBackground);
    setScopeOfCollabPoints(normalizedScope);
    setProposedStructurePoints(normalizedStructure);
    setCurrentStep(5);
  }

  function handleSaveStep5() {
    resetFeedback();

    if (!cashflowForecastFile) {
      setErrorState("Please upload cashflow forecast file before proceeding.", {
        cashflowForecastUrl: ["Cashflow forecast upload is required"],
      });
      return;
    }

    const normalizedKeyTerms = normalizePointList(keyTermsPoints);
    const normalizedFinancialOverview = normalizePointList(financialOverviewPoints);
    const normalizedTechnicalCapabilities = normalizePointList(technicalCapabilitiesPoints);

    const validatedInput = step5Schema.safeParse({
      keyTermsPoints: normalizedKeyTerms,
      financialOverviewPoints: normalizedFinancialOverview,
      technicalCapabilitiesPoints: normalizedTechnicalCapabilities,
      cashflowForecastUrl: cashflowForecastFile.documentUrl,
      cashflowForecastPublicId: cashflowForecastFile.documentPublicId,
      cashflowForecastFileName: cashflowForecastFile.documentFileName,
      cashflowForecastMimeType: cashflowForecastFile.documentMimeType,
      cashflowForecastSizeBytes: cashflowForecastFile.documentSizeBytes,
    });

    if (!validatedInput.success) {
      setErrorState(
        "Please complete Step 5 fields and upload requirement before proceeding.",
        flattenFieldErrors(validatedInput.error)
      );
      return;
    }

    setKeyTermsPoints(normalizedKeyTerms);
    setFinancialOverviewPoints(normalizedFinancialOverview);
    setTechnicalCapabilitiesPoints(normalizedTechnicalCapabilities);
    setCurrentStep(6);
  }

  function handleSaveStep6() {
    resetFeedback();

    if (!requestId) {
      setErrorState("Base request not found. Please complete Step 1 first.");
      setCurrentStep(1);
      return;
    }

    if (!cashflowForecastFile) {
      setErrorState("Cashflow forecast file is missing. Please revisit Step 5.", {
        cashflowForecastUrl: ["Cashflow forecast upload is required"],
      });
      setCurrentStep(5);
      return;
    }

    if (!costStructureFile) {
      setErrorState("Please upload cost structure file before proceeding.", {
        costStructureUrl: ["Cost structure upload is required"],
      });
      return;
    }

    const normalizedBackground = normalizePointList(backgroundOfCollabPoints);
    const normalizedScope = normalizePointList(scopeOfCollabPoints);
    const normalizedStructure = normalizePointList(proposedStructurePoints);
    const normalizedKeyTerms = normalizePointList(keyTermsPoints);
    const normalizedFinancialOverview = normalizePointList(financialOverviewPoints);
    const normalizedTechnicalCapabilities = normalizePointList(technicalCapabilitiesPoints);
    const normalizedWorkPackages = normalizePointList(workPackagesDivisionPoints);
    const normalizedResourcesContribution = normalizePointList(resourcesContributionPoints);
    const normalizedRiskItems = normalizeRiskItems(riskReviewMitigationItems);

    const payload = {
      requestId,
      ...picDetails,
      backgroundOfCollabPoints: normalizedBackground,
      scopeOfCollabPoints: normalizedScope,
      proposedStructurePoints: normalizedStructure,
      keyTermsPoints: normalizedKeyTerms,
      financialOverviewPoints: normalizedFinancialOverview,
      technicalCapabilitiesPoints: normalizedTechnicalCapabilities,
      workPackagesDivisionPoints: normalizedWorkPackages,
      resourcesContributionPoints: normalizedResourcesContribution,
      riskReviewMitigationItems: normalizedRiskItems,
      cashflowForecastUrl: cashflowForecastFile.documentUrl,
      cashflowForecastPublicId: cashflowForecastFile.documentPublicId,
      cashflowForecastFileName: cashflowForecastFile.documentFileName,
      cashflowForecastMimeType: cashflowForecastFile.documentMimeType,
      cashflowForecastSizeBytes: cashflowForecastFile.documentSizeBytes,
      costStructureUrl: costStructureFile.documentUrl,
      costStructurePublicId: costStructureFile.documentPublicId,
      costStructureFileName: costStructureFile.documentFileName,
      costStructureMimeType: costStructureFile.documentMimeType,
      costStructureSizeBytes: costStructureFile.documentSizeBytes,
    };

    const validatedInput = saveJvpDetailsSchema.safeParse(payload);
    if (!validatedInput.success) {
      setErrorState(
        "Please complete all Step 6 details before proceeding.",
        flattenFieldErrors(validatedInput.error)
      );
      return;
    }

    setBackgroundOfCollabPoints(normalizedBackground);
    setScopeOfCollabPoints(normalizedScope);
    setProposedStructurePoints(normalizedStructure);
    setKeyTermsPoints(normalizedKeyTerms);
    setFinancialOverviewPoints(normalizedFinancialOverview);
    setTechnicalCapabilitiesPoints(normalizedTechnicalCapabilities);
    setWorkPackagesDivisionPoints(normalizedWorkPackages);
    setResourcesContributionPoints(normalizedResourcesContribution);
    setRiskReviewMitigationItems(normalizedRiskItems);

    startTransition(async () => {
      const result = await saveJvpDetails(validatedInput.data);

      if (!result.success) {
        setErrorState(result.message, result.fieldErrors);
        return;
      }

      setCurrentStep(7);
      setAlertState({
        type: "info",
        message: "JVP information saved. Upload final document and submit the request.",
      });
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

    const payload = {
      requestId,
      acknowledgement,
      ...uploadedDocument,
    };

    const validatedInput = submitJvpRequestSchema.safeParse(payload);
    if (!validatedInput.success) {
      setErrorState(
        "Please complete acknowledgement and document requirements.",
        flattenFieldErrors(validatedInput.error)
      );
      return;
    }

    startTransition(async () => {
      const result = await submitJvpRequest(validatedInput.data);

      if (!result.success) {
        setErrorState(result.message, result.fieldErrors);
        return;
      }

      setIsSubmitted(true);
      clearPersistedFormState(JVP_SESSION_STORAGE_KEY);
      setAlertState({
        type: "success",
        message: `JVP request ${result.data.requestNo} submitted successfully.`,
      });
      router.push("/requests");
    });
  }

  const cashflowUploadError =
    getFieldError("cashflowForecastUrl") ??
    getFieldError("cashflowForecastPublicId") ??
    getFieldError("cashflowForecastFileName");

  const costStructureUploadError =
    getFieldError("costStructureUrl") ??
    getFieldError("costStructurePublicId") ??
    getFieldError("costStructureFileName");

  const finalDocumentUploadError =
    getFieldError("documentUrl") ??
    getFieldError("documentPublicId") ??
    getFieldError("documentFileName") ??
    getFieldError("documentMimeType") ??
    getFieldError("documentSizeBytes");

  return (
    <div className="surface-card p-5 sm:p-6">
      <MultiStepStepper
        steps={JVP_STEPPER_STEPS}
        currentStep={currentStep}
        isSubmitted={isSubmitted}
      />

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
            Review your basic information before proceeding.
          </p>
          <div className="grid gap-4 md:grid-cols-2">
            <InputField label="Request Title" value={requestTitle} readOnly inputClassName="bg-slate-50" />
            <InputField label="Category" value={category} readOnly inputClassName="bg-slate-50" />
            <InputField label="Requestor Name" value={requestor.name} readOnly inputClassName="bg-slate-50" />
            <InputField label="Requestor Email" value={requestor.email} readOnly inputClassName="bg-slate-50" />
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
          <p className="text-sm text-[var(--text-muted)]">
            Select project details for this JVP request.
          </p>
          {projects.length === 0 ? (
            <div className="alert alert--warning">
              <p className="alert__title">No projects available</p>
              <p className="alert__body">
                Create at least one project record first (for example via RTP) before submitting a JVP request.
              </p>
            </div>
          ) : null}
          <div className="grid gap-4 md:grid-cols-2">
            <SelectField
              label="Project Name"
              required
              options={projectOptions}
              value={projectDetails.projectId}
              onChange={(event) => {
                handleProjectSelection(event.target.value);
                clearGeneralFieldError("projectId");
              }}
              error={getFieldError("projectId")}
            />
            <InputField
              label="Project Code"
              value={projectDetails.projectCode}
              readOnly
              inputClassName="bg-slate-50"
            />
            <InputField
              label="Company"
              value={`${projectDetails.companyName} (${projectDetails.companyCode})`}
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
          <p className="text-sm text-[var(--text-muted)]">Enter person-in-charge information.</p>
          <div className="grid gap-4 md:grid-cols-2">
            <InputField
              label="Team Lead"
              value={picDetails.teamLeader}
              onChange={(event) => {
                setPicDetails((current) => ({ ...current, teamLeader: event.target.value }));
                clearGeneralFieldError("teamLeader");
              }}
              error={getFieldError("teamLeader")}
            />
            <InputField
              label="Financial Matters"
              value={picDetails.financialMatters}
              onChange={(event) => {
                setPicDetails((current) => ({ ...current, financialMatters: event.target.value }));
                clearGeneralFieldError("financialMatters");
              }}
              error={getFieldError("financialMatters")}
            />
            <InputField
              label="Technical Matters"
              value={picDetails.technicalMatters}
              onChange={(event) => {
                setPicDetails((current) => ({ ...current, technicalMatters: event.target.value }));
                clearGeneralFieldError("technicalMatters");
              }}
              error={getFieldError("technicalMatters")}
            />
            <InputField
              label="Contract Matters"
              value={picDetails.contractMatters}
              onChange={(event) => {
                setPicDetails((current) => ({ ...current, contractMatters: event.target.value }));
                clearGeneralFieldError("contractMatters");
              }}
              error={getFieldError("contractMatters")}
            />
            <InputField
              label="Procurement Matters"
              value={picDetails.procurementMatters}
              onChange={(event) => {
                setPicDetails((current) => ({ ...current, procurementMatters: event.target.value }));
                clearGeneralFieldError("procurementMatters");
              }}
              error={getFieldError("procurementMatters")}
            />
            <InputField
              label="Costing and Estimation Matters"
              value={picDetails.costingAndEstimationMatters}
              onChange={(event) => {
                setPicDetails((current) => ({
                  ...current,
                  costingAndEstimationMatters: event.target.value,
                }));
                clearGeneralFieldError("costingAndEstimationMatters");
              }}
              error={getFieldError("costingAndEstimationMatters")}
            />
            <InputField
              label="Implementation Stage"
              value={picDetails.implementationStage}
              onChange={(event) => {
                setPicDetails((current) => ({ ...current, implementationStage: event.target.value }));
                clearGeneralFieldError("implementationStage");
              }}
              error={getFieldError("implementationStage")}
              containerClassName="md:col-span-2"
            />
          </div>
          <div className="flex flex-wrap justify-between gap-3 pt-2">
            <Button type="button" variant="secondary" onClick={() => setCurrentStep(2)} disabled={isBusy}>
              Previous
            </Button>
            <Button type="button" onClick={handleSaveStep3} disabled={isBusy}>
              Next Step
            </Button>
          </div>
        </section>
      ) : null}

      {currentStep === 4 ? (
        <section className="space-y-4">
          <p className="text-sm text-[var(--text-muted)]">
            Fill collaboration partner particulars with structured points.
          </p>
          <div className="space-y-4">
            <DynamicPointsSection
              title="Background of Collaboration"
              points={backgroundOfCollabPoints}
              error={getFieldError("backgroundOfCollabPoints")}
              onPointChange={(index, value) =>
                updatePointListValue(
                  setBackgroundOfCollabPoints,
                  "backgroundOfCollabPoints",
                  index,
                  value
                )
              }
              onAddPoint={() => addPointToList(setBackgroundOfCollabPoints, "backgroundOfCollabPoints")}
              onRemovePoint={(index) =>
                removePointFromList(setBackgroundOfCollabPoints, "backgroundOfCollabPoints", index)
              }
            />
            <DynamicPointsSection
              title="Scope of Collaboration"
              points={scopeOfCollabPoints}
              error={getFieldError("scopeOfCollabPoints")}
              onPointChange={(index, value) =>
                updatePointListValue(setScopeOfCollabPoints, "scopeOfCollabPoints", index, value)
              }
              onAddPoint={() => addPointToList(setScopeOfCollabPoints, "scopeOfCollabPoints")}
              onRemovePoint={(index) =>
                removePointFromList(setScopeOfCollabPoints, "scopeOfCollabPoints", index)
              }
            />
            <DynamicPointsSection
              title="Proposed Structure"
              points={proposedStructurePoints}
              error={getFieldError("proposedStructurePoints")}
              onPointChange={(index, value) =>
                updatePointListValue(
                  setProposedStructurePoints,
                  "proposedStructurePoints",
                  index,
                  value
                )
              }
              onAddPoint={() => addPointToList(setProposedStructurePoints, "proposedStructurePoints")}
              onRemovePoint={(index) =>
                removePointFromList(setProposedStructurePoints, "proposedStructurePoints", index)
              }
            />
          </div>
          <div className="flex flex-wrap justify-between gap-3 pt-2">
            <Button type="button" variant="secondary" onClick={() => setCurrentStep(3)} disabled={isBusy}>
              Previous
            </Button>
            <Button type="button" onClick={handleSaveStep4} disabled={isBusy}>
              Next Step
            </Button>
          </div>
        </section>
      ) : null}

      {currentStep === 5 ? (
        <section className="space-y-4">
          <p className="text-sm text-[var(--text-muted)]">
            Continue JVP information with key terms, financial overview, and technical capability points.
          </p>
          <div className="space-y-4">
            <DynamicPointsSection
              title="Key Terms"
              points={keyTermsPoints}
              error={getFieldError("keyTermsPoints")}
              onPointChange={(index, value) =>
                updatePointListValue(setKeyTermsPoints, "keyTermsPoints", index, value)
              }
              onAddPoint={() => addPointToList(setKeyTermsPoints, "keyTermsPoints")}
              onRemovePoint={(index) => removePointFromList(setKeyTermsPoints, "keyTermsPoints", index)}
            />
            <DynamicPointsSection
              title="Financial Overview"
              points={financialOverviewPoints}
              error={getFieldError("financialOverviewPoints")}
              onPointChange={(index, value) =>
                updatePointListValue(
                  setFinancialOverviewPoints,
                  "financialOverviewPoints",
                  index,
                  value
                )
              }
              onAddPoint={() => addPointToList(setFinancialOverviewPoints, "financialOverviewPoints")}
              onRemovePoint={(index) =>
                removePointFromList(setFinancialOverviewPoints, "financialOverviewPoints", index)
              }
            />
            <div className="rounded-xl border border-[var(--border)] p-4">
              <p className="text-sm font-semibold text-[var(--text)]">
                Cashflow Forecast (including JV operational costs)
              </p>
              <div className="mt-3 space-y-2">
                <input
                  type="file"
                  accept={acceptedDocumentTypes}
                  onChange={handleCashflowUpload}
                  className="input py-2"
                />
                <p className="text-xs text-[var(--text-subtle)]">
                  Allowed: PDF, Word, Excel, JPG, PNG. Max size: {MAX_FILE_SIZE_MB}MB.
                </p>
                {cashflowUploadError ? (
                  <p className="text-xs text-[var(--danger-text)]">{cashflowUploadError}</p>
                ) : null}
                {cashflowForecastFile ? (
                  <div className="space-y-2">
                    <UploadedDocumentPreview
                      documentUrl={cashflowForecastFile.documentUrl}
                      documentFileName={cashflowForecastFile.documentFileName}
                      documentMimeType={cashflowForecastFile.documentMimeType}
                      documentSizeBytes={cashflowForecastFile.documentSizeBytes}
                    />
                    <div className="flex justify-end">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          removeUploadedAsset(cashflowForecastFile, () =>
                            setCashflowForecastFile(null)
                          )
                        }
                        disabled={isBusy}
                        className="text-[var(--danger-text)]"
                      >
                        Remove uploaded file
                      </Button>
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
            <DynamicPointsSection
              title="Technical Capabilities & Resources"
              points={technicalCapabilitiesPoints}
              error={getFieldError("technicalCapabilitiesPoints")}
              onPointChange={(index, value) =>
                updatePointListValue(
                  setTechnicalCapabilitiesPoints,
                  "technicalCapabilitiesPoints",
                  index,
                  value
                )
              }
              onAddPoint={() =>
                addPointToList(setTechnicalCapabilitiesPoints, "technicalCapabilitiesPoints")
              }
              onRemovePoint={(index) =>
                removePointFromList(setTechnicalCapabilitiesPoints, "technicalCapabilitiesPoints", index)
              }
            />
          </div>
          <div className="flex flex-wrap justify-between gap-3 pt-2">
            <Button type="button" variant="secondary" onClick={() => setCurrentStep(4)} disabled={isBusy}>
              Previous
            </Button>
            <Button type="button" onClick={handleSaveStep5} disabled={isBusy}>
              Next Step
            </Button>
          </div>
        </section>
      ) : null}

      {currentStep === 6 ? (
        <section className="space-y-4">
          <p className="text-sm text-[var(--text-muted)]">
            Finalize JVP information with work/resource points, cost structure upload, and risk mitigation table.
          </p>
          <div className="space-y-4">
            <DynamicPointsSection
              title="Work Packages / Division of Responsibilities"
              points={workPackagesDivisionPoints}
              error={getFieldError("workPackagesDivisionPoints")}
              onPointChange={(index, value) =>
                updatePointListValue(
                  setWorkPackagesDivisionPoints,
                  "workPackagesDivisionPoints",
                  index,
                  value
                )
              }
              onAddPoint={() =>
                addPointToList(setWorkPackagesDivisionPoints, "workPackagesDivisionPoints")
              }
              onRemovePoint={(index) =>
                removePointFromList(setWorkPackagesDivisionPoints, "workPackagesDivisionPoints", index)
              }
            />
            <DynamicPointsSection
              title="Resource Contribution"
              points={resourcesContributionPoints}
              error={getFieldError("resourcesContributionPoints")}
              onPointChange={(index, value) =>
                updatePointListValue(
                  setResourcesContributionPoints,
                  "resourcesContributionPoints",
                  index,
                  value
                )
              }
              onAddPoint={() =>
                addPointToList(setResourcesContributionPoints, "resourcesContributionPoints")
              }
              onRemovePoint={(index) =>
                removePointFromList(setResourcesContributionPoints, "resourcesContributionPoints", index)
              }
            />
            <div className="rounded-xl border border-[var(--border)] p-4">
              <p className="text-sm font-semibold text-[var(--text)]">Cost Structure / Breakdown</p>
              <div className="mt-3 space-y-2">
                <input
                  type="file"
                  accept={acceptedDocumentTypes}
                  onChange={handleCostStructureUpload}
                  className="input py-2"
                />
                <p className="text-xs text-[var(--text-subtle)]">
                  Allowed: PDF, Word, Excel, JPG, PNG. Max size: {MAX_FILE_SIZE_MB}MB.
                </p>
                {costStructureUploadError ? (
                  <p className="text-xs text-[var(--danger-text)]">{costStructureUploadError}</p>
                ) : null}
                {costStructureFile ? (
                  <div className="space-y-2">
                    <UploadedDocumentPreview
                      documentUrl={costStructureFile.documentUrl}
                      documentFileName={costStructureFile.documentFileName}
                      documentMimeType={costStructureFile.documentMimeType}
                      documentSizeBytes={costStructureFile.documentSizeBytes}
                    />
                    <div className="flex justify-end">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          removeUploadedAsset(costStructureFile, () => setCostStructureFile(null))
                        }
                        disabled={isBusy}
                        className="text-[var(--danger-text)]"
                      >
                        Remove uploaded file
                      </Button>
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
            <div className="rounded-xl border border-[var(--border)] p-4">
              <div className="mb-3 flex items-center justify-between gap-3">
                <p className="text-sm font-semibold text-[var(--text)]">Risk Review & Mitigation</p>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    setRiskReviewMitigationItems((current) => [
                      ...current,
                      { ...defaultRiskRow },
                    ]);
                    clearGeneralFieldError("riskReviewMitigationItems");
                  }}
                >
                  + Add Risk
                </Button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[760px] border-collapse">
                  <thead className="bg-[var(--surface-soft)]/70">
                    <tr>
                      <th className="w-14 px-3 py-2 text-left text-[0.72rem] font-bold uppercase tracking-[0.08em] text-[var(--text-subtle)]">
                        No
                      </th>
                      <th className="px-3 py-2 text-left text-[0.72rem] font-bold uppercase tracking-[0.08em] text-[var(--text-subtle)]">
                        Risk Identified
                      </th>
                      <th className="px-3 py-2 text-left text-[0.72rem] font-bold uppercase tracking-[0.08em] text-[var(--text-subtle)]">
                        Mitigation Plan
                      </th>
                      <th className="w-24 px-3 py-2 text-left text-[0.72rem] font-bold uppercase tracking-[0.08em] text-[var(--text-subtle)]">
                        Action
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {riskReviewMitigationItems.map((item, index) => (
                      <tr
                        key={`risk-${index}`}
                        className="border-t border-[var(--border)] align-top odd:bg-white even:bg-[var(--surface-soft)]/35"
                      >
                        <td className="px-3 py-3 text-sm font-semibold text-[var(--text)]">
                          {index + 1}
                        </td>
                        <td className="px-3 py-3">
                          <input
                            value={item.riskIdentified}
                            onChange={(event) => {
                              setRiskReviewMitigationItems((current) =>
                                current.map((row, rowIndex) =>
                                  rowIndex === index
                                    ? { ...row, riskIdentified: event.target.value }
                                    : row
                                )
                              );
                              clearGeneralFieldError("riskReviewMitigationItems");
                            }}
                            className="input min-w-[220px]"
                            placeholder="Enter identified risk"
                          />
                        </td>
                        <td className="px-3 py-3">
                          <input
                            value={item.mitigationPlan}
                            onChange={(event) => {
                              setRiskReviewMitigationItems((current) =>
                                current.map((row, rowIndex) =>
                                  rowIndex === index
                                    ? { ...row, mitigationPlan: event.target.value }
                                    : row
                                )
                              );
                              clearGeneralFieldError("riskReviewMitigationItems");
                            }}
                            className="input min-w-[220px]"
                            placeholder="Enter mitigation plan"
                          />
                        </td>
                        <td className="px-3 py-3">
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            className="text-[var(--danger-text)] hover:border-[var(--danger-bg)] hover:bg-[var(--danger-bg)]"
                            onClick={() => {
                              setRiskReviewMitigationItems((current) => {
                                const next = current.filter((_, rowIndex) => rowIndex !== index);
                                return next.length > 0 ? next : [{ ...defaultRiskRow }];
                              });
                              clearGeneralFieldError("riskReviewMitigationItems");
                            }}
                            disabled={isBusy}
                          >
                            Remove
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {getFieldError("riskReviewMitigationItems") ? (
                <p className="mt-2 text-xs text-[var(--danger-text)]">
                  {getFieldError("riskReviewMitigationItems")}
                </p>
              ) : null}
            </div>
          </div>
          <div className="flex flex-wrap justify-between gap-3 pt-2">
            <Button type="button" variant="secondary" onClick={() => setCurrentStep(5)} disabled={isBusy}>
              Previous
            </Button>
            <Button type="button" onClick={handleSaveStep6} loading={isBusy}>
              {isBusy ? "Saving..." : "Next Step"}
            </Button>
          </div>
        </section>
      ) : null}

      {currentStep === 7 ? (
        <section className="space-y-4">
          <p className="text-sm text-[var(--text-muted)]">
            Upload final supporting document, verify details, and submit.
          </p>
          <div className="space-y-3 rounded-xl border border-[var(--border)] p-4">
            <p className="text-sm font-semibold text-[var(--text)]">Final Document Upload</p>
            <input
              type="file"
              accept={acceptedDocumentTypes}
              onChange={handleFinalDocumentUpload}
              className="input py-2"
            />
            <p className="text-xs text-[var(--text-subtle)]">
              Allowed: PDF, Word, Excel, JPG, PNG. Max size: {MAX_FILE_SIZE_MB}MB.
            </p>
            {finalDocumentUploadError ? (
              <p className="text-xs text-[var(--danger-text)]">{finalDocumentUploadError}</p>
            ) : null}
            {uploadedDocument ? (
              <div className="space-y-2">
                <UploadedDocumentPreview
                  documentUrl={uploadedDocument.documentUrl}
                  documentFileName={uploadedDocument.documentFileName}
                  documentMimeType={uploadedDocument.documentMimeType}
                  documentSizeBytes={uploadedDocument.documentSizeBytes}
                />
                <div className="flex justify-end">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => removeUploadedAsset(uploadedDocument, () => setUploadedDocument(null))}
                    disabled={isBusy}
                    className="text-[var(--danger-text)]"
                  >
                    Remove uploaded file
                  </Button>
                </div>
              </div>
            ) : null}
          </div>

          <label className="flex items-start gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface-soft)] p-3">
            <input
              type="checkbox"
              className="mt-1"
              checked={acknowledgement}
              onChange={(event) => {
                setAcknowledgement(event.target.checked);
                clearGeneralFieldError("acknowledgement");
              }}
            />
            <span className="text-sm text-[var(--text)]">
              I acknowledge that the uploaded document and submitted details are accurate.
            </span>
          </label>
          {getFieldError("acknowledgement") ? (
            <p className="text-xs text-[var(--danger-text)]">{getFieldError("acknowledgement")}</p>
          ) : null}

          <div className="flex flex-wrap justify-between gap-3 pt-2">
            <Button type="button" variant="secondary" onClick={() => setCurrentStep(6)} disabled={isBusy || isSubmitted}>
              Previous
            </Button>
            <Button type="button" onClick={handleFinalSubmit} loading={isBusy || isSubmitted}>
              {isSubmitted ? "Submitted" : isBusy ? "Submitting..." : "Submit JVP"}
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
