"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  createOthersBaseRequestInSharePoint,
  saveOthersDetailsInSharePoint,
  submitOthersRequestInSharePoint,
} from "@/lib/sharepoint/others";
import {
  createOthersBaseRequestSchema,
  saveOthersDetailsSchema,
  submitOthersRequestSchema,
  type CreateOthersBaseRequestInput,
  type SaveOthersDetailsInput,
  type SubmitOthersRequestInput,
} from "@/lib/validations/others";

type FieldErrors = Record<string, string[]>;
type ActionResult<TData> =
  | { success: true; data: TData }
  | { success: false; message: string; fieldErrors?: FieldErrors };

function getFieldErrors(error: z.ZodError) {
  return error.flatten().fieldErrors;
}

export async function createOthersBaseRequest(
  input: CreateOthersBaseRequestInput
): Promise<ActionResult<{ requestId: string; requestNo: string }>> {
  const validatedInput = createOthersBaseRequestSchema.safeParse(input);
  if (!validatedInput.success) {
    return {
      success: false,
      message: "Please complete all required basic information fields.",
      fieldErrors: getFieldErrors(validatedInput.error),
    };
  }

  const payload = validatedInput.data;
  try {
    const created = await createOthersBaseRequestInSharePoint(payload);
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
          ? `Failed to create Others base request. ${error.message}`
          : "Failed to create Others base request.",
    };
  }
}

export async function saveOthersDetails(
  input: SaveOthersDetailsInput
): Promise<
  ActionResult<{
    projectId: string;
    projectCode: string;
    companyId: string;
    companyCode: string;
    companyName: string;
  }>
> {
  const validatedInput = saveOthersDetailsSchema.safeParse(input);
  if (!validatedInput.success) {
    return {
      success: false,
      message: "Please fix project details before proceeding.",
      fieldErrors: getFieldErrors(validatedInput.error),
    };
  }

  const payload = validatedInput.data;

  try {
    const saved = await saveOthersDetailsInSharePoint({
      requestId: payload.requestId,
      projectId: payload.projectId,
      projectCode: payload.projectCode,
      descriptionOfMatters: payload.descriptionOfMatters,
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
          ? `Failed to save Others project details. ${error.message}`
          : "Failed to save Others project details.",
    };
  }
}

export async function submitOthersRequest(
  input: SubmitOthersRequestInput
): Promise<ActionResult<{ requestId: string; requestNo: string }>> {
  const validatedInput = submitOthersRequestSchema.safeParse(input);
  if (!validatedInput.success) {
    return {
      success: false,
      message: "Please complete the document and acknowledgement requirements.",
      fieldErrors: getFieldErrors(validatedInput.error),
    };
  }

  const payload = validatedInput.data;

  try {
    const submitted = await submitOthersRequestInSharePoint({
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
          ? `Failed to submit Others request. ${error.message}`
          : "Failed to submit Others request.",
    };
  }
}
