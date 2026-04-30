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
import {
  RTP_ALLOWED_DOCUMENT_MIME_TYPES,
  RTP_MAX_DOCUMENT_SIZE_BYTES,
} from "@/lib/validations/rtp";
import {
  RPP_FORM_CODE,
  createRppBaseRequestSchema,
  saveRppDetailsSchema,
  submitRppRequestSchema,
} from "@/lib/validations/rpp";
import {
  createRppBaseRequest,
  saveRppDetails,
  submitRppRequest,
} from "../_actions/rpp";
import {
  RPP_FORM_STEPS,
  RPP_STEPPER_STEPS,
  type ProjectOption,
  type RequestorContext,
  type RppDetailsState,
  type RppFormSchemaContext,
} from "../_config/rpp-form-schema";

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

type RppMultiStepFormProps = {
  channel: "gcpc" | "gcp";
  requestTitle: string;
  requestor: RequestorContext;
  projects: ReadonlyArray<ProjectOption>;
  canSubmitRequest: boolean;
};

const MAX_FILE_SIZE_MB = RTP_MAX_DOCUMENT_SIZE_BYTES / (1024 * 1024);
const acceptedDocumentTypes = RTP_ALLOWED_DOCUMENT_MIME_TYPES.join(",");
const documentMetadataSchema = submitRppRequestSchema.pick({
  documentUrl: true,
  documentPublicId: true,
  documentFileName: true,
  documentMimeType: true,
  documentSizeBytes: true,
});
const RPP_SESSION_STORAGE_KEY = "gcp-central:form:rpp:v1";

type PersistedRppFormState = {
  currentStep: number;
  requestId: string | null;
  requestNo: string | null;
  details: RppDetailsState;
  acknowledgement: boolean;
  uploadedDocument: UploadedDocument | null;
};

function flattenFieldErrors(error: { flatten: () => { fieldErrors: FieldErrors } }) {
  return error.flatten().fieldErrors;
}

export default function RppMultiStepForm({
  channel,
  requestTitle,
  requestor,
  projects,
  canSubmitRequest,
}: RppMultiStepFormProps) {
  const router = useRouter();
  const category = useMemo(() => channel.toUpperCase() as "GCP" | "GCPC", [channel]);

  const [currentStep, setCurrentStep] = useState(1);
  const [requestId, setRequestId] = useState<string | null>(null);
  const [requestNo, setRequestNo] = useState<string | null>(null);
  const [isSubmitted, setIsSubmitted] = useState(false);

  const [details, setDetails] = useState<RppDetailsState>({
    projectId: "",
    projectCode: "",
    companyId: requestor.companyId,
    companyCode: requestor.companyCode,
    companyName: requestor.companyName,
  });

  const [acknowledgement, setAcknowledgement] = useState(false);
  const [uploadedDocument, setUploadedDocument] = useState<UploadedDocument | null>(null);

  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [alertState, setAlertState] = useState<AlertState>(null);

  const [isUploading, setIsUploading] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [hasHydratedFromSession, setHasHydratedFromSession] = useState(false);

  const isBusy = isPending || isUploading;

  useEffect(() => {
    const persistedState = readPersistedFormState<PersistedRppFormState>(
      RPP_SESSION_STORAGE_KEY
    );

    if (persistedState) {
      setCurrentStep(Math.min(Math.max(persistedState.currentStep, 1), RPP_FORM_STEPS.length));
      setRequestId(persistedState.requestId);
      setRequestNo(persistedState.requestNo);
      setDetails(persistedState.details);
      setAcknowledgement(persistedState.acknowledgement);
      setUploadedDocument(persistedState.uploadedDocument);
    }

    setHasHydratedFromSession(true);
  }, []);

  useEffect(() => {
    if (!hasHydratedFromSession || isSubmitted) {
      return;
    }

    writePersistedFormState<PersistedRppFormState>(RPP_SESSION_STORAGE_KEY, {
      currentStep,
      requestId,
      requestNo,
      details,
      acknowledgement,
      uploadedDocument,
    });
  }, [
    acknowledgement,
    currentStep,
    details,
    hasHydratedFromSession,
    isSubmitted,
    requestId,
    requestNo,
    uploadedDocument,
  ]);

  const handleProjectSelection = useCallback(
    (projectId: string) => {
      const selectedProject = projects.find((project) => project.id === projectId);

      if (!selectedProject) {
        setDetails({
          projectId: "",
          projectCode: "",
          companyId: requestor.companyId,
          companyCode: requestor.companyCode,
          companyName: requestor.companyName,
        });
        return;
      }

      setDetails({
        projectId: selectedProject.id,
        projectCode: selectedProject.projectCode.trim(),
        companyId: requestor.companyId,
        companyCode: requestor.companyCode,
        companyName: requestor.companyName,
      });
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

  const documentUploadError =
    getFieldError("documentFileName") ??
    getFieldError("documentMimeType") ??
    getFieldError("documentSizeBytes");

  function handleCreateBaseRequest() {
    resetFeedback();

    const payload = {
      requestType: RPP_FORM_CODE,
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

    const validatedInput = createRppBaseRequestSchema.safeParse(payload);
    if (!validatedInput.success) {
      setErrorState(
        "Please review the pre-populated basic information fields.",
        flattenFieldErrors(validatedInput.error)
      );
      return;
    }

    startTransition(async () => {
      const result = await createRppBaseRequest(validatedInput.data);

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
      companyId: details.companyId,
      companyCode: details.companyCode,
      companyName: details.companyName,
    };

    const validatedInput = saveRppDetailsSchema.safeParse(payload);
    if (!validatedInput.success) {
      setErrorState("Please correct the project details fields.", flattenFieldErrors(validatedInput.error));
      return;
    }

    startTransition(async () => {
      const result = await saveRppDetails(validatedInput.data);

      if (!result.success) {
        setErrorState(result.message, result.fieldErrors);
        return;
      }

      setDetails({
        projectId: result.data.projectId,
        projectCode: result.data.projectCode,
        companyId: result.data.companyId,
        companyCode: result.data.companyCode,
        companyName: result.data.companyName,
      });

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
      formData.set("folder", "gcp-central/rpp");

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

    const validatedInput = submitRppRequestSchema.safeParse(payload);
    if (!validatedInput.success) {
      setErrorState(
        "Please complete acknowledgement and document requirements.",
        flattenFieldErrors(validatedInput.error)
      );
      return;
    }

    startTransition(async () => {
      const result = await submitRppRequest(validatedInput.data);

      if (!result.success) {
        setErrorState(result.message, result.fieldErrors);
        return;
      }

      setIsSubmitted(true);
      clearPersistedFormState(RPP_SESSION_STORAGE_KEY);
      setAlertState({
        type: "success",
        message: `RPP request ${result.data.requestNo} submitted successfully.`,
      });
      router.push("/requests");
    });
  }

  const schemaContext: RppFormSchemaContext = {
    requestTitle,
    category,
    requestor,
    projectOptions: projects,
    details,
    onProjectSelect: handleProjectSelection,
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

  const basicInfoStep = RPP_FORM_STEPS[0];
  const projectDetailsStep = RPP_FORM_STEPS[1];
  const documentsStep = RPP_FORM_STEPS[2];
  const [documentUploadField, ...documentChecklistFields] = documentsStep.fields;
  const basicInfoDescription = resolveConfigValue(
    basicInfoStep.description,
    schemaContext
  );
  const projectDetailsDescription = resolveConfigValue(
    projectDetailsStep.description,
    schemaContext
  );
  const documentsDescription = resolveConfigValue(
    documentsStep.description,
    schemaContext
  );

  return (
    <div className="surface-card p-5 sm:p-6">
      <MultiStepStepper
        steps={RPP_STEPPER_STEPS}
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
                Create at least one project record first before submitting an RPP request.
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
            <Button type="button" variant="secondary" onClick={() => setCurrentStep(2)} disabled={isBusy || isSubmitted}>
              Previous
            </Button>
            {canSubmitRequest ? (
              <Button type="button" onClick={handleFinalSubmit} loading={isBusy || isSubmitted}>
                {isSubmitted ? "Submitted" : isBusy ? "Submitting..." : "Submit RPP"}
              </Button>
            ) : null}
          </div>
        </section>
      ) : null}

      {requestNo ? (
        <p className="mt-5 text-xs text-[var(--text-subtle)]">Request reference: {requestNo}</p>
      ) : null}
    </div>
  );
}
