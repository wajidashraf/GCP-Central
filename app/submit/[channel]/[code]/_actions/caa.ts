"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  createCaaBaseRequestInSharePoint,
  saveCaaDetailsInSharePoint,
  saveCaaProjectDetailsInSharePoint,
  submitCaaRequestInSharePoint,
} from "@/lib/sharepoint/caa";
import {
  createCaaBaseRequestSchema,
  saveCaaDetailsSchema,
  saveCaaProjectDetailsSchema,
  submitCaaRequestSchema,
  type CreateCaaBaseRequestInput,
  type SaveCaaDetailsInput,
  type SaveCaaProjectDetailsInput,
  type SubmitCaaRequestInput,
} from "@/lib/validations/caa";

type FieldErrors = Record<string, string[]>;

type ActionResult<TData> =
  | { success: true; data: TData }
  | { success: false; message: string; fieldErrors?: FieldErrors };

function getFieldErrors(error: z.ZodError) {
  return error.flatten().fieldErrors;
}

export async function createCaaBaseRequest(
  input: CreateCaaBaseRequestInput
): Promise<ActionResult<{ requestId: string; requestNo: string }>> {
  const validatedInput = createCaaBaseRequestSchema.safeParse(input);
  if (!validatedInput.success) {
    return {
      success: false,
      message: "Please complete all required basic information fields.",
      fieldErrors: getFieldErrors(validatedInput.error),
    };
  }

  const payload = validatedInput.data;
  try {
    const created = await createCaaBaseRequestInSharePoint(payload);
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
          ? `Failed to create CAA base request. ${error.message}`
          : "Failed to create CAA base request.",
    };
  }
}

export async function saveCaaProjectDetails(
  input: SaveCaaProjectDetailsInput
): Promise<
  ActionResult<{
    projectId: string;
    projectCode: string;
    companyId: string;
    companyCode: string;
    companyName: string;
  }>
> {
  const validatedInput = saveCaaProjectDetailsSchema.safeParse(input);
  if (!validatedInput.success) {
    return {
      success: false,
      message: "Please fix project details before proceeding.",
      fieldErrors: getFieldErrors(validatedInput.error),
    };
  }

  const payload = validatedInput.data;

  try {
    const saved = await saveCaaProjectDetailsInSharePoint({
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
          ? `Failed to save CAA project details. ${error.message}`
          : "Failed to save CAA project details.",
    };
  }
}

export async function saveCaaDetails(
  input: SaveCaaDetailsInput
): Promise<ActionResult<{ requestId: string }>> {
  const validatedInput = saveCaaDetailsSchema.safeParse(input);
  if (!validatedInput.success) {
    return {
      success: false,
      message: "Please fix CAA details before proceeding.",
      fieldErrors: getFieldErrors(validatedInput.error),
    };
  }

  const payload = validatedInput.data;

  try {
    await saveCaaDetailsInSharePoint(payload);

    revalidatePath("/requests");
    return { success: true, data: { requestId: payload.requestId } };
  } catch (error: unknown) {
    return {
      success: false,
      message:
        error instanceof Error && error.message
          ? `Failed to save CAA details. ${error.message}`
          : "Failed to save CAA details.",
    };
  }
}

export async function submitCaaRequest(
  input: SubmitCaaRequestInput
): Promise<ActionResult<{ requestId: string; requestNo: string }>> {
  const validatedInput = submitCaaRequestSchema.safeParse(input);
  if (!validatedInput.success) {
    return {
      success: false,
      message: "Please complete the document and acknowledgement requirements.",
      fieldErrors: getFieldErrors(validatedInput.error),
    };
  }

  const payload = validatedInput.data;

  try {
    const submitted = await submitCaaRequestInSharePoint({
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
          ? `Failed to submit CAA request. ${error.message}`
          : "Failed to submit CAA request.",
    };
  }
}
