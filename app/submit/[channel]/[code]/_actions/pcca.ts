"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  createPccaBaseRequestInSharePoint,
  savePccaDetailsInSharePoint,
  savePccaProjectDetailsInSharePoint,
  submitPccaRequestInSharePoint,
} from "@/lib/sharepoint/pcca";
import {
  createPccaBaseRequestSchema,
  savePccaDetailsSchema,
  savePccaProjectDetailsSchema,
  submitPccaRequestSchema,
  type CreatePccaBaseRequestInput,
  type SavePccaDetailsInput,
  type SavePccaProjectDetailsInput,
  type SubmitPccaRequestInput,
} from "@/lib/validations/pcca";

type FieldErrors = Record<string, string[]>;
type ActionResult<TData> =
  | { success: true; data: TData }
  | { success: false; message: string; fieldErrors?: FieldErrors };

function getFieldErrors(error: z.ZodError) {
  return error.flatten().fieldErrors;
}

export async function createPccaBaseRequest(
  input: CreatePccaBaseRequestInput
): Promise<ActionResult<{ requestId: string; requestNo: string }>> {
  const validatedInput = createPccaBaseRequestSchema.safeParse(input);
  if (!validatedInput.success) {
    return {
      success: false,
      message: "Please complete all required basic information fields.",
      fieldErrors: getFieldErrors(validatedInput.error),
    };
  }

  const payload = validatedInput.data;
  try {
    const created = await createPccaBaseRequestInSharePoint(payload);
    revalidatePath("/requests");
    return {
      success: true,
      data: { requestId: created.requestId, requestNo: created.requestNo },
    };
  } catch (error: unknown) {
    return {
      success: false,
      message:
        error instanceof Error && error.message
          ? `Failed to create PCCA base request. ${error.message}`
          : "Failed to create PCCA base request.",
    };
  }
}

export async function savePccaProjectDetails(
  input: SavePccaProjectDetailsInput
): Promise<
  ActionResult<{
    projectId: string;
    projectCode: string;
    companyId: string;
    companyCode: string;
    companyName: string;
  }>
> {
  const validatedInput = savePccaProjectDetailsSchema.safeParse(input);
  if (!validatedInput.success) {
    return {
      success: false,
      message: "Please fix project details before proceeding.",
      fieldErrors: getFieldErrors(validatedInput.error),
    };
  }

  const payload = validatedInput.data;

  try {
    const saved = await savePccaProjectDetailsInSharePoint({
      requestId: payload.requestId,
      projectId: payload.projectId,
      projectCode: payload.projectCode,
    });

    revalidatePath("/submit");
    revalidatePath("/requests");

    return {
      success: true,
      data: {
        projectId: saved.projectId,
        projectCode: saved.projectCode,
        companyId: payload.companyId,
        companyCode: payload.companyCode,
        companyName: payload.companyName,
      },
    };
  } catch (error: unknown) {
    return {
      success: false,
      message:
        error instanceof Error && error.message
          ? `Failed to save PCCA project details. ${error.message}`
          : "Failed to save PCCA project details.",
    };
  }
}

export async function savePccaDetails(
  input: SavePccaDetailsInput
): Promise<ActionResult<{ requestId: string }>> {
  const validatedInput = savePccaDetailsSchema.safeParse(input);
  if (!validatedInput.success) {
    return {
      success: false,
      message: "Please fix PCCA details before proceeding.",
      fieldErrors: getFieldErrors(validatedInput.error),
    };
  }

  const payload = validatedInput.data;

  try {
    await savePccaDetailsInSharePoint(payload);

    revalidatePath("/requests");
    revalidatePath("/submit");
    return { success: true, data: { requestId: payload.requestId } };
  } catch (error: unknown) {
    return {
      success: false,
      message:
        error instanceof Error && error.message
          ? `Failed to save PCCA details. ${error.message}`
          : "Failed to save PCCA details.",
    };
  }
}

export async function submitPccaRequest(
  input: SubmitPccaRequestInput
): Promise<ActionResult<{ requestId: string; requestNo: string }>> {
  const validatedInput = submitPccaRequestSchema.safeParse(input);
  if (!validatedInput.success) {
    return {
      success: false,
      message: "Please complete the document and acknowledgement requirements.",
      fieldErrors: getFieldErrors(validatedInput.error),
    };
  }

  const payload = validatedInput.data;

  try {
    const submitted = await submitPccaRequestInSharePoint({
      requestId: payload.requestId,
      documentUrl: payload.documentUrl,
      documentPublicId: payload.documentPublicId,
      documentFileName: payload.documentFileName,
      documentMimeType: payload.documentMimeType,
      documentSizeBytes: payload.documentSizeBytes,
    });

    revalidatePath("/requests");
    revalidatePath("/submit");

    return {
      success: true,
      data: { requestId: payload.requestId, requestNo: submitted.requestNo },
    };
  } catch (error: unknown) {
    return {
      success: false,
      message:
        error instanceof Error && error.message
          ? `Failed to submit PCCA request. ${error.message}`
          : "Failed to submit PCCA request.",
    };
  }
}
