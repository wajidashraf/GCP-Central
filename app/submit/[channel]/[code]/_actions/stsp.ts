"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  createStspBaseRequestInSharePoint,
  saveStspDetailsInSharePoint,
  saveStspProjectDetailsInSharePoint,
  submitStspRequestInSharePoint,
} from "@/lib/sharepoint/stsp";
import {
  createStspBaseRequestSchema,
  saveStspDetailsSchema,
  saveStspProjectDetailsSchema,
  submitStspRequestSchema,
  type CreateStspBaseRequestInput,
  type SaveStspDetailsInput,
  type SaveStspProjectDetailsInput,
  type SubmitStspRequestInput,
} from "@/lib/validations/stsp";

type FieldErrors = Record<string, string[]>;

type ActionResult<TData> =
  | { success: true; data: TData }
  | { success: false; message: string; fieldErrors?: FieldErrors };

function getFieldErrors(error: z.ZodError) {
  return error.flatten().fieldErrors;
}

export async function createStspBaseRequest(
  input: CreateStspBaseRequestInput
): Promise<ActionResult<{ requestId: string; requestNo: string }>> {
  const validatedInput = createStspBaseRequestSchema.safeParse(input);
  if (!validatedInput.success) {
    return {
      success: false,
      message: "Please complete all required basic information fields.",
      fieldErrors: getFieldErrors(validatedInput.error),
    };
  }

  const payload = validatedInput.data;

  try {
    const created = await createStspBaseRequestInSharePoint(payload);
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
          ? `Failed to create STSP base request. ${error.message}`
          : "Failed to create STSP base request.",
    };
  }
}

export async function saveStspProjectDetails(
  input: SaveStspProjectDetailsInput
): Promise<
  ActionResult<{
    projectId: string;
    projectCode: string;
    companyId: string;
    companyCode: string;
    companyName: string;
  }>
> {
  const validatedInput = saveStspProjectDetailsSchema.safeParse(input);
  if (!validatedInput.success) {
    return {
      success: false,
      message: "Please fix project details before proceeding.",
      fieldErrors: getFieldErrors(validatedInput.error),
    };
  }

  const payload = validatedInput.data;

  try {
    const saved = await saveStspProjectDetailsInSharePoint({
      requestId: payload.requestId,
      projectId: payload.projectId,
      projectCode: payload.projectCode,
      tenderProposalSubmissionDate: payload.tenderProposalSubmissionDate,
      tenderValidityPeriodDays: payload.tenderValidityPeriodDays,
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
          ? `Failed to save STSP project details. ${error.message}`
          : "Failed to save STSP project details.",
    };
  }
}

export async function saveStspDetails(
  input: SaveStspDetailsInput
): Promise<ActionResult<{ requestId: string }>> {
  const validatedInput = saveStspDetailsSchema.safeParse(input);
  if (!validatedInput.success) {
    return {
      success: false,
      message: "Please fix STSP details before proceeding.",
      fieldErrors: getFieldErrors(validatedInput.error),
    };
  }

  const payload = validatedInput.data;

  try {
    await saveStspDetailsInSharePoint(payload);
    revalidatePath("/requests");

    return {
      success: true,
      data: { requestId: payload.requestId },
    };
  } catch (error: unknown) {
    return {
      success: false,
      message:
        error instanceof Error && error.message
          ? `Failed to save STSP details. ${error.message}`
          : "Failed to save STSP details.",
    };
  }
}

export async function submitStspRequest(
  input: SubmitStspRequestInput
): Promise<ActionResult<{ requestId: string; requestNo: string }>> {
  const validatedInput = submitStspRequestSchema.safeParse(input);
  if (!validatedInput.success) {
    return {
      success: false,
      message: "Please complete the document and acknowledgement requirements.",
      fieldErrors: getFieldErrors(validatedInput.error),
    };
  }

  const payload = validatedInput.data;

  try {
    const submitted = await submitStspRequestInSharePoint({
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
          ? `Failed to submit STSP request. ${error.message}`
          : "Failed to submit STSP request.",
    };
  }
}
