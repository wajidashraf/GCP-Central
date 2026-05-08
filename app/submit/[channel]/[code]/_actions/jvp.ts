"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  createJvpBaseRequestInSharePoint,
  saveJvpDetailsInSharePoint,
  saveJvpProjectDetailsInSharePoint,
  submitJvpRequestInSharePoint,
} from "@/lib/sharepoint/jvp";
import {
  createJvpBaseRequestSchema,
  saveJvpDetailsSchema,
  saveJvpProjectDetailsSchema,
  submitJvpRequestSchema,
  type CreateJvpBaseRequestInput,
  type SaveJvpDetailsInput,
  type SaveJvpProjectDetailsInput,
  type SubmitJvpRequestInput,
} from "@/lib/validations/jvp";

type FieldErrors = Record<string, string[]>;

type ActionResult<TData> =
  | { success: true; data: TData }
  | { success: false; message: string; fieldErrors?: FieldErrors };

function getFieldErrors(error: z.ZodError) {
  return error.flatten().fieldErrors;
}

export async function createJvpBaseRequest(
  input: CreateJvpBaseRequestInput
): Promise<ActionResult<{ requestId: string; requestNo: string }>> {
  const validatedInput = createJvpBaseRequestSchema.safeParse(input);
  if (!validatedInput.success) {
    return {
      success: false,
      message: "Please complete all required basic information fields.",
      fieldErrors: getFieldErrors(validatedInput.error),
    };
  }

  const payload = validatedInput.data;

  try {
    const created = await createJvpBaseRequestInSharePoint(payload);
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
          ? `Failed to create JVP base request. ${error.message}`
          : "Failed to create JVP base request.",
    };
  }
}

export async function saveJvpProjectDetails(
  input: SaveJvpProjectDetailsInput
): Promise<
  ActionResult<{
    projectId: string;
    projectCode: string;
    companyId: string;
    companyCode: string;
    companyName: string;
  }>
> {
  const validatedInput = saveJvpProjectDetailsSchema.safeParse(input);
  if (!validatedInput.success) {
    return {
      success: false,
      message: "Please fix project details before proceeding.",
      fieldErrors: getFieldErrors(validatedInput.error),
    };
  }

  const payload = validatedInput.data;

  try {
    const saved = await saveJvpProjectDetailsInSharePoint({
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
          ? `Failed to save JVP project details. ${error.message}`
          : "Failed to save JVP project details.",
    };
  }
}

export async function saveJvpDetails(
  input: SaveJvpDetailsInput
): Promise<ActionResult<{ requestId: string }>> {
  const validatedInput = saveJvpDetailsSchema.safeParse(input);
  if (!validatedInput.success) {
    return {
      success: false,
      message: "Please fix JVP details before proceeding.",
      fieldErrors: getFieldErrors(validatedInput.error),
    };
  }

  const payload = validatedInput.data;

  try {
    await saveJvpDetailsInSharePoint(payload);
    revalidatePath("/requests");
    return {
      success: true,
      data: {
        requestId: payload.requestId,
      },
    };
  } catch (error: unknown) {
    return {
      success: false,
      message:
        error instanceof Error && error.message
          ? `Failed to save JVP details. ${error.message}`
          : "Failed to save JVP details.",
    };
  }
}

export async function submitJvpRequest(
  input: SubmitJvpRequestInput
): Promise<ActionResult<{ requestId: string; requestNo: string }>> {
  const validatedInput = submitJvpRequestSchema.safeParse(input);
  if (!validatedInput.success) {
    return {
      success: false,
      message: "Please complete the document and acknowledgement requirements.",
      fieldErrors: getFieldErrors(validatedInput.error),
    };
  }

  const payload = validatedInput.data;

  try {
    const submitted = await submitJvpRequestInSharePoint({
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
          ? `Failed to submit JVP request. ${error.message}`
          : "Failed to submit JVP request.",
    };
  }
}
