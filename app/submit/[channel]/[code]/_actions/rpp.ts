"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  createRppBaseRequestInSharePoint,
  saveRppDetailsInSharePoint,
  submitRppRequestInSharePoint,
} from "@/lib/sharepoint/rpp";
import {
  createRppBaseRequestSchema,
  saveRppDetailsSchema,
  submitRppRequestSchema,
  type CreateRppBaseRequestInput,
  type SaveRppDetailsInput,
  type SubmitRppRequestInput,
} from "@/lib/validations/rpp";

type FieldErrors = Record<string, string[]>;

type ActionResult<TData> =
  | { success: true; data: TData }
  | { success: false; message: string; fieldErrors?: FieldErrors };

function getFieldErrors(error: z.ZodError) {
  return error.flatten().fieldErrors;
}

export async function createRppBaseRequest(
  input: CreateRppBaseRequestInput
): Promise<ActionResult<{ requestId: string; requestNo: string }>> {
  const validatedInput = createRppBaseRequestSchema.safeParse(input);
  if (!validatedInput.success) {
    return {
      success: false,
      message: "Please complete all required basic information fields.",
      fieldErrors: getFieldErrors(validatedInput.error),
    };
  }

  const payload = validatedInput.data;
  try {
    const created = await createRppBaseRequestInSharePoint(payload);
    revalidatePath("/requests");
    return {
      success: true,
      data: {
        requestId: created.requestId,
        requestNo: created.requestNo,
      },
    };
  } catch (error: unknown) {
    return {
      success: false,
      message:
        error instanceof Error && error.message
          ? `Failed to create RPP base request. ${error.message}`
          : "Failed to create RPP base request.",
    };
  }
}

export async function saveRppDetails(
  input: SaveRppDetailsInput
): Promise<
  ActionResult<{
    projectId: string;
    projectCode: string;
    companyId: string;
    companyCode: string;
    companyName: string;
  }>
> {
  const validatedInput = saveRppDetailsSchema.safeParse(input);
  if (!validatedInput.success) {
    return {
      success: false,
      message: "Please fix the project details before proceeding.",
      fieldErrors: getFieldErrors(validatedInput.error),
    };
  }

  const payload = validatedInput.data;

  try {
    const saved = await saveRppDetailsInSharePoint({
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
          ? `Failed to save RPP project details. ${error.message}`
          : "Failed to save RPP project details.",
    };
  }
}

export async function submitRppRequest(
  input: SubmitRppRequestInput
): Promise<ActionResult<{ requestId: string; requestNo: string }>> {
  const validatedInput = submitRppRequestSchema.safeParse(input);
  if (!validatedInput.success) {
    return {
      success: false,
      message: "Please complete the document and acknowledgement requirements.",
      fieldErrors: getFieldErrors(validatedInput.error),
    };
  }

  const payload = validatedInput.data;

  try {
    const submitted = await submitRppRequestInSharePoint({
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
      data: {
        requestId: payload.requestId,
        requestNo: submitted.requestNo,
      },
    };
  } catch (error: unknown) {
    return {
      success: false,
      message:
        error instanceof Error && error.message
          ? `Failed to submit RPP request. ${error.message}`
          : "Failed to submit RPP request.",
    };
  }
}
