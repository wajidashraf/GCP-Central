"use client";

import { useCallback, useEffect, useMemo, useState, useTransition, type ChangeEvent } from "react";
import { useRouter } from "next/navigation";
import Button from "@/src/components/ui/button";
import ConfigDrivenFieldsRenderer, {
  resolveConfigValue,
} from "@/src/components/forms/config-driven-fields";
import MultiStepStepper from "@/src/components/forms/multi-step-stepper";
import {
  clearPersistedFormState,
  readPersistedFormState,
  writePersistedFormState,
} from "@/src/components/forms/session-storage";
import UploadedDocumentPreview from "@/src/components/forms/uploaded-document-preview";
import { InputField, TextareaField } from "@/src/components/forms/fields";
import {
  PBL_FORM_CODE,
  PBL_MIN_BIDDERS_WITHOUT_JUSTIFICATION,
  createPblBaseRequestSchema,
  pblBidderInputSchema,
  savePblBiddersSchema,
  savePblDetailsSchema,
  submitPblRequestSchema,
  type PblBidderInput,
} from "@/lib/validations/pbl";
import {
  RTP_ALLOWED_DOCUMENT_MIME_TYPES,
  RTP_MAX_DOCUMENT_SIZE_BYTES,
} from "@/lib/validations/rtp";
import {
  createPblBaseRequest,
  savePblBidders,
  savePblDetails,
  submitPblRequest,
} from "../_actions/pbl";
import {
  PBL_FORM_STEPS,
  PBL_STEPPER_STEPS,
  type PblDetailsState,
  type PblFormSchemaContext,
  type ProjectOption,
  type RequestorContext,
} from "../_config/pbl-form-schema";

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

type BidderDraftState = {
  companyName: string;
  location: string;
  personInCharge: string;
  picContactNumber: string;
  sourcesFrom: string;
  recommendationBy: string;
};

type PblMultiStepFormProps = {
  channel: "gcpc" | "gcp";
  requestTitle: string;
  requestor: RequestorContext;
  projects: ReadonlyArray<ProjectOption>;
};

const MAX_FILE_SIZE_MB = RTP_MAX_DOCUMENT_SIZE_BYTES / (1024 * 1024);
const acceptedDocumentTypes = RTP_ALLOWED_DOCUMENT_MIME_TYPES.join(",");
const emptyBidderDraft: BidderDraftState = {
  companyName: "",
  location: "",
  personInCharge: "",
  picContactNumber: "",
  sourcesFrom: "",
  recommendationBy: "",
};
const documentMetadataSchema = submitPblRequestSchema.pick({
  documentUrl: true,
  documentPublicId: true,
  documentFileName: true,
  documentMimeType: true,
  documentSizeBytes: true,
});
const PBL_SESSION_STORAGE_KEY = "gcp-central:form:pbl:v1";

type PersistedPblFormState = {
  currentStep: number;
  requestId: string | null;
  requestNo: string | null;
  details: PblDetailsState;
  bidders: PblBidderInput[];
  bidderDraft: BidderDraftState;
  justificationForLessBidders: string;
  acknowledgement: boolean;
  uploadedDocument: UploadedDocument | null;
};

function flattenFieldErrors(error: { flatten: () => { fieldErrors: FieldErrors } }) {
  return error.flatten().fieldErrors;
}

export default function PblMultiStepForm({
  channel,
  requestTitle,
  requestor,
  projects,
}: PblMultiStepFormProps) {
  const router = useRouter();
  const category = useMemo(() => channel.toUpperCase() as "GCP" | "GCPC", [channel]);

  const [currentStep, setCurrentStep] = useState(1);
  const [requestId, setRequestId] = useState<string | null>(null);
  const [requestNo, setRequestNo] = useState<string | null>(null);
  const [isSubmitted, setIsSubmitted] = useState(false);

  const [details, setDetails] = useState<PblDetailsState>({
    projectId: "",
    projectCode: "",
    companyId: requestor.companyId,
    companyCode: requestor.companyCode,
    companyName: requestor.companyName,
    procurementMethod: 0,
  });

  const [bidders, setBidders] = useState<PblBidderInput[]>([]);
  const [bidderDraft, setBidderDraft] = useState<BidderDraftState>(emptyBidderDraft);
  const [bidderFieldErrors, setBidderFieldErrors] = useState<FieldErrors>({});
  const [justificationForLessBidders, setJustificationForLessBidders] = useState("");

  const [acknowledgement, setAcknowledgement] = useState(false);
  const [uploadedDocument, setUploadedDocument] = useState<UploadedDocument | null>(null);

  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [alertState, setAlertState] = useState<AlertState>(null);

  const [isUploading, setIsUploading] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [hasHydratedFromSession, setHasHydratedFromSession] = useState(false);

  const isBusy = isPending || isUploading;
  const shouldRequireJustification =
    bidders.length < PBL_MIN_BIDDERS_WITHOUT_JUSTIFICATION;

  useEffect(() => {
    const persistedState = readPersistedFormState<PersistedPblFormState>(
      PBL_SESSION_STORAGE_KEY
    );

    if (persistedState) {
      setCurrentStep(Math.min(Math.max(persistedState.currentStep, 1), PBL_FORM_STEPS.length));
      setRequestId(persistedState.requestId);
      setRequestNo(persistedState.requestNo);
      setDetails(persistedState.details);
      setBidders(persistedState.bidders);
      setBidderDraft(persistedState.bidderDraft);
      setJustificationForLessBidders(persistedState.justificationForLessBidders);
      setAcknowledgement(persistedState.acknowledgement);
      setUploadedDocument(persistedState.uploadedDocument);
    }

    setHasHydratedFromSession(true);
  }, []);

  useEffect(() => {
    if (!hasHydratedFromSession || isSubmitted) {
      return;
    }

    writePersistedFormState<PersistedPblFormState>(PBL_SESSION_STORAGE_KEY, {
      currentStep,
      requestId,
      requestNo,
      details,
      bidders,
      bidderDraft,
      justificationForLessBidders,
      acknowledgement,
      uploadedDocument,
    });
  }, [
    acknowledgement,
    bidderDraft,
    bidders,
    currentStep,
    details,
    hasHydratedFromSession,
    isSubmitted,
    justificationForLessBidders,
    requestId,
    requestNo,
    uploadedDocument,
  ]);

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
        companyId: selectedProject.companyId,
        companyCode: selectedProject.companyCode,
        companyName: selectedProject.companyName,
      }));
    },
    [projects, requestor.companyCode, requestor.companyId, requestor.companyName]
  );

  useEffect(() => {
    if (projects.length === 1 && !details.projectId) {
      handleProjectSelection(projects[0].id);
    }
  }, [details.projectId, handleProjectSelection, projects]);

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

  function getBidderFieldError(name: keyof BidderDraftState) {
    return bidderFieldErrors[name]?.[0];
  }

  function clearBidderFieldError(name: keyof BidderDraftState) {
    if (!bidderFieldErrors[name]) {
      return;
    }

    setBidderFieldErrors((current) => {
      const next = { ...current };
      delete next[name];
      return next;
    });
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

  function updateBidderDraft(field: keyof BidderDraftState, value: string) {
    setBidderDraft((current) => ({
      ...current,
      [field]: value,
    }));
    clearBidderFieldError(field);
  }

  function handleAddBidder() {
    const validatedBidder = pblBidderInputSchema.safeParse(bidderDraft);
    if (!validatedBidder.success) {
      setBidderFieldErrors(flattenFieldErrors(validatedBidder.error));
      setAlertState({
        type: "error",
        message: "Please complete all required bidder fields before adding to the list.",
      });
      return;
    }

    setBidders((current) => [...current, validatedBidder.data]);
    setBidderDraft(emptyBidderDraft);
    setBidderFieldErrors({});
    clearGeneralFieldError("bidders");
    clearGeneralFieldError("justificationForLessBidders");

    setAlertState({
      type: "info",
      message: "Bidder added to the list. You can continue adding or proceed to the next step.",
    });
  }

  function handleRemoveBidder(index: number) {
    setBidders((current) => current.filter((_, bidderIndex) => bidderIndex !== index));
  }

  const documentUploadError =
    getFieldError("documentFileName") ??
    getFieldError("documentMimeType") ??
    getFieldError("documentSizeBytes");

  function handleCreateBaseRequest() {
    resetFeedback();

    const payload = {
      requestType: PBL_FORM_CODE,
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

    const validatedInput = createPblBaseRequestSchema.safeParse(payload);
    if (!validatedInput.success) {
      setErrorState(
        "Please review the pre-populated basic information fields.",
        flattenFieldErrors(validatedInput.error)
      );
      return;
    }

    startTransition(async () => {
      const result = await createPblBaseRequest(validatedInput.data);

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
      projectId: details.projectId,
      projectCode: details.projectCode,
      procurementMethod: details.procurementMethod,
      companyId: details.companyId,
      companyCode: details.companyCode,
      companyName: details.companyName,
    };

    const validatedInput = savePblDetailsSchema.safeParse(payload);
    if (!validatedInput.success) {
      setErrorState("Please correct the project details fields.", flattenFieldErrors(validatedInput.error));
      return;
    }

    startTransition(async () => {
      const result = await savePblDetails(validatedInput.data);

      if (!result.success) {
        setErrorState(result.message, result.fieldErrors);
        return;
      }

      setDetails((current) => ({
        ...current,
        projectId: result.data.projectId,
        projectCode: result.data.projectCode,
        companyId: result.data.companyId,
        companyCode: result.data.companyCode,
        companyName: result.data.companyName,
      }));

      setCurrentStep(3);
      setAlertState({
        type: "info",
        message: "Project details saved. Add bidders in the next step.",
      });
    });
  }

  function handleSaveStep3() {
    resetFeedback();

    if (!requestId) {
      setErrorState("Base request not found. Please complete Step 1 first.");
      setCurrentStep(1);
      return;
    }

    const payload = {
      requestId,
      bidders,
      justificationForLessBidders,
    };

    const validatedInput = savePblBiddersSchema.safeParse(payload);
    if (!validatedInput.success) {
      setErrorState(
        "Please complete bidder list requirements before proceeding.",
        flattenFieldErrors(validatedInput.error)
      );
      return;
    }

    startTransition(async () => {
      const result = await savePblBidders(validatedInput.data);

      if (!result.success) {
        setErrorState(result.message, result.fieldErrors);
        return;
      }

      setCurrentStep(4);
      setAlertState({
        type: "info",
        message: `${result.data.bidderCount} bidder record(s) saved. Upload documents and submit the request.`,
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
      formData.set("folder", "gcp-central/pbl");

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

    if (bidders.length === 0) {
      setErrorState("Please add at least one bidder before final submission.", {
        bidders: ["Bidder list is required"],
      });
      setCurrentStep(3);
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
      ...uploadedDocument,
    };

    const validatedInput = submitPblRequestSchema.safeParse(payload);
    if (!validatedInput.success) {
      setErrorState(
        "Please complete acknowledgement and document requirements.",
        flattenFieldErrors(validatedInput.error)
      );
      return;
    }

    startTransition(async () => {
      const result = await submitPblRequest(validatedInput.data);

      if (!result.success) {
        setErrorState(result.message, result.fieldErrors);
        return;
      }

      setIsSubmitted(true);
      clearPersistedFormState(PBL_SESSION_STORAGE_KEY);
      setAlertState({
        type: "success",
        message: `PBL request ${result.data.requestNo} submitted successfully.`,
      });
      router.push("/requests");
    });
  }

  const schemaContext: PblFormSchemaContext = {
    requestTitle,
    category,
    requestor,
    projectOptions: projects,
    details,
    onProjectSelect: handleProjectSelection,
    updateDetails: (updates) =>
      setDetails((current) => ({
        ...current,
        ...updates,
      })),
    acceptedDocumentTypes,
    maxFileSizeMb: MAX_FILE_SIZE_MB,
    onFileUpload: handleFileUpload,
    acknowledgement,
    setAcknowledgement,
  };

  function getSchemaFieldError(fieldKey: string) {
    if (fieldKey === "documentUpload") {
      return documentUploadError;
    }

    return getFieldError(fieldKey);
  }

  const basicInfoStep = PBL_FORM_STEPS[0];
  const projectDetailsStep = PBL_FORM_STEPS[1];
  const biddersListStep = PBL_FORM_STEPS[2];
  const documentsStep = PBL_FORM_STEPS[3];
  const [documentUploadField, ...documentChecklistFields] = documentsStep.fields;
  const basicInfoDescription = resolveConfigValue(
    basicInfoStep.description,
    schemaContext
  );
  const projectDetailsDescription = resolveConfigValue(
    projectDetailsStep.description,
    schemaContext
  );
  const biddersListDescription = resolveConfigValue(
    biddersListStep.description,
    schemaContext
  );
  const documentsDescription = resolveConfigValue(
    documentsStep.description,
    schemaContext
  );

  return (
    <div className="surface-card p-5 sm:p-6">
      <MultiStepStepper
        steps={PBL_STEPPER_STEPS}
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
          {basicInfoDescription ? (
            <p className="text-sm text-[var(--text-muted)]">{basicInfoDescription}</p>
          ) : null}

          <div className={basicInfoStep.fieldsContainerClassName ?? "space-y-4"}>
            <ConfigDrivenFieldsRenderer
              fields={basicInfoStep.fields}
              context={schemaContext}
              getFieldError={getSchemaFieldError}
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
          {projectDetailsDescription ? (
            <p className="text-sm text-[var(--text-muted)]">
              {projectDetailsDescription}
            </p>
          ) : null}

          {projects.length === 0 ? (
            <div className="alert alert--warning">
              <p className="alert__title">No projects available</p>
              <p className="alert__body">
                Create at least one project record first (for example via RTP) before submitting a PBL request.
              </p>
            </div>
          ) : null}

          <div className={projectDetailsStep.fieldsContainerClassName ?? "space-y-4"}>
            <ConfigDrivenFieldsRenderer
              fields={projectDetailsStep.fields}
              context={schemaContext}
              getFieldError={getSchemaFieldError}
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
          {biddersListDescription ? (
            <p className="text-sm text-[var(--text-muted)]">{biddersListDescription}</p>
          ) : null}

          <div className="rounded-xl border border-[var(--border)] p-4">
            <p className="text-sm font-semibold text-[var(--text)]">Create bidder record</p>
            <div className="mt-3 grid gap-4 md:grid-cols-2">
              <InputField
                label="Company Name"
                value={bidderDraft.companyName}
                onChange={(event) => updateBidderDraft("companyName", event.target.value)}
                placeholder="Enter company name"
                error={getBidderFieldError("companyName")}
              />
              <InputField
                label="Location"
                value={bidderDraft.location}
                onChange={(event) => updateBidderDraft("location", event.target.value)}
                placeholder="Enter location"
                error={getBidderFieldError("location")}
              />
              <InputField
                label="Person In Charge"
                value={bidderDraft.personInCharge}
                onChange={(event) => updateBidderDraft("personInCharge", event.target.value)}
                placeholder="Enter PIC name"
                error={getBidderFieldError("personInCharge")}
              />
              <InputField
                label="PIC Contact Number"
                value={bidderDraft.picContactNumber}
                onChange={(event) => updateBidderDraft("picContactNumber", event.target.value)}
                placeholder="Enter contact number"
                error={getBidderFieldError("picContactNumber")}
              />
              <InputField
                label="Sources From"
                value={bidderDraft.sourcesFrom}
                onChange={(event) => updateBidderDraft("sourcesFrom", event.target.value)}
                placeholder="Enter source details"
                error={getBidderFieldError("sourcesFrom")}
              />
              <InputField
                label="Recommendation By"
                value={bidderDraft.recommendationBy}
                onChange={(event) => updateBidderDraft("recommendationBy", event.target.value)}
                placeholder="Enter recommendation source"
                error={getBidderFieldError("recommendationBy")}
              />
            </div>
            <div className="mt-4 flex justify-end">
              <Button type="button" variant="secondary" onClick={handleAddBidder} disabled={isBusy}>
                + Add Bidder
              </Button>
            </div>
          </div>

          {getFieldError("bidders") ? (
            <p className="text-xs text-[var(--danger-text)]">{getFieldError("bidders")}</p>
          ) : null}

          <div className="overflow-hidden rounded-xl border border-[var(--border)] bg-white shadow-[var(--shadow-soft)]">
            <div className="flex items-center justify-between gap-3 border-b border-[var(--border)] bg-[var(--surface-soft)] px-4 py-3">
              <p className="text-sm font-semibold text-[var(--text)]">Bidders List</p>
              <span className="badge badge--info">
                {bidders.length} item{bidders.length === 1 ? "" : "s"}
              </span>
            </div>
            {bidders.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[980px] border-collapse">
                  <thead className="bg-[var(--surface-soft)]/70">
                    <tr>
                      <th className="w-14 px-3 py-2 text-left text-[0.72rem] font-bold uppercase tracking-[0.08em] text-[var(--text-subtle)]">
                        #
                      </th>
                      <th className="px-3 py-2 text-left text-[0.72rem] font-bold uppercase tracking-[0.08em] text-[var(--text-subtle)]">
                        Company Name
                      </th>
                      <th className="px-3 py-2 text-left text-[0.72rem] font-bold uppercase tracking-[0.08em] text-[var(--text-subtle)]">
                        Location
                      </th>
                      <th className="px-3 py-2 text-left text-[0.72rem] font-bold uppercase tracking-[0.08em] text-[var(--text-subtle)]">
                        Person In Charge
                      </th>
                      <th className="px-3 py-2 text-left text-[0.72rem] font-bold uppercase tracking-[0.08em] text-[var(--text-subtle)]">
                        PIC Contact Number
                      </th>
                      <th className="px-3 py-2 text-left text-[0.72rem] font-bold uppercase tracking-[0.08em] text-[var(--text-subtle)]">
                        Sources From
                      </th>
                      <th className="px-3 py-2 text-left text-[0.72rem] font-bold uppercase tracking-[0.08em] text-[var(--text-subtle)]">
                        Recommendation By
                      </th>
                      <th className="w-28 px-3 py-2 text-left text-[0.72rem] font-bold uppercase tracking-[0.08em] text-[var(--text-subtle)]">
                        Action
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {bidders.map((bidder, index) => (
                      <tr
                        key={`${bidder.companyName}-${index}`}
                        className="border-t border-[var(--border)] align-top odd:bg-white even:bg-[var(--surface-soft)]/35"
                      >
                        <td className="px-3 py-3 text-sm font-semibold text-[var(--text)]">
                          {index + 1}
                        </td>
                        <td className="px-3 py-3 text-sm text-[var(--text)]">{bidder.companyName}</td>
                        <td className="px-3 py-3 text-sm text-[var(--text-muted)]">
                          {bidder.location?.trim() ? bidder.location : "-"}
                        </td>
                        <td className="px-3 py-3 text-sm text-[var(--text)]">{bidder.personInCharge}</td>
                        <td className="px-3 py-3 text-sm text-[var(--text)]">{bidder.picContactNumber}</td>
                        <td className="px-3 py-3 text-sm text-[var(--text-muted)]">{bidder.sourcesFrom}</td>
                        <td className="px-3 py-3 text-sm text-[var(--text-muted)]">{bidder.recommendationBy}</td>
                        <td className="px-3 py-3">
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            className="text-[var(--danger-text)] hover:border-[var(--danger-bg)] hover:bg-[var(--danger-bg)]"
                            onClick={() => handleRemoveBidder(index)}
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
            ) : (
              <div className="p-5">
                <p className="text-sm text-[var(--text-muted)]">
                  No bidder records added yet. Add at least one bidder to continue.
                </p>
              </div>
            )}
          </div>

          {shouldRequireJustification ? (
            <TextareaField
              label="Justification for less than 3 bidders"
              value={justificationForLessBidders}
              onChange={(event) => {
                setJustificationForLessBidders(event.target.value);
                clearGeneralFieldError("justificationForLessBidders");
              }}
              placeholder="Provide the business reason for submitting fewer than 3 bidders"
              error={getFieldError("justificationForLessBidders")}
            />
          ) : null}

          <div className="flex flex-wrap justify-between gap-3 pt-2">
            <Button type="button" variant="secondary" onClick={() => setCurrentStep(2)} disabled={isBusy}>
              Previous
            </Button>
            <Button type="button" onClick={handleSaveStep3} loading={isBusy}>
              {isBusy ? "Saving..." : "Next Step"}
            </Button>
          </div>
        </section>
      ) : null}

      {currentStep === 4 ? (
        <section className="space-y-4">
          {documentsDescription ? (
            <p className="text-sm text-[var(--text-muted)]">{documentsDescription}</p>
          ) : null}

          <div className={documentsStep.fieldsContainerClassName ?? "space-y-4"}>
            {documentUploadField ? (
              <ConfigDrivenFieldsRenderer
                fields={[documentUploadField]}
                context={schemaContext}
                getFieldError={getSchemaFieldError}
              />
            ) : null}

            {uploadedDocument ? (
              <UploadedDocumentPreview
                documentUrl={uploadedDocument.documentUrl}
                documentFileName={uploadedDocument.documentFileName}
                documentMimeType={uploadedDocument.documentMimeType}
                documentSizeBytes={uploadedDocument.documentSizeBytes}
              />
            ) : null}

            {documentChecklistFields.length > 0 ? (
              <ConfigDrivenFieldsRenderer
                fields={documentChecklistFields}
                context={schemaContext}
                getFieldError={getSchemaFieldError}
              />
            ) : null}
          </div>

          <div className="flex flex-wrap justify-between gap-3 pt-2">
            <Button type="button" variant="secondary" onClick={() => setCurrentStep(3)} disabled={isBusy || isSubmitted}>
              Previous
            </Button>
            <Button type="button" onClick={handleFinalSubmit} loading={isBusy || isSubmitted}>
              {isSubmitted ? "Submitted" : isBusy ? "Submitting..." : "Submit PBL"}
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
