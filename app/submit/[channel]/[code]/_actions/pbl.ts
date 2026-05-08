"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  createPblBaseRequestInSharePoint,
  getPblSubmissionSnapshotFromSharePoint,
  savePblBiddersInSharePoint,
  savePblDetailsInSharePoint,
  submitPblRequestInSharePoint,
} from "@/lib/sharepoint/pbl";
import {
  PBL_MIN_BIDDERS_WITHOUT_JUSTIFICATION,
  createPblBaseRequestSchema,
  savePblBiddersSchema,
  savePblDetailsSchema,
  submitPblRequestSchema,
  type CreatePblBaseRequestInput,
  type SavePblBiddersInput,
  type SavePblDetailsInput,
  type SubmitPblRequestInput,
} from "@/lib/validations/pbl";

type FieldErrors = Record<string, string[]>;

type ActionResult<TData> =
  | { success: true; data: TData }
  | { success: false; message: string; fieldErrors?: FieldErrors };

function getFieldErrors(error: z.ZodError) {
  return error.flatten().fieldErrors;
}

export async function createPblBaseRequest(
  input: CreatePblBaseRequestInput
): Promise<ActionResult<{ requestId: string; requestNo: string }>> {
  const validatedInput = createPblBaseRequestSchema.safeParse(input);
  if (!validatedInput.success) {
    return {
      success: false,
      message: "Please complete all required basic information fields.",
      fieldErrors: getFieldErrors(validatedInput.error),
    };
  }

  const payload = validatedInput.data;

  try {
    const created = await createPblBaseRequestInSharePoint(payload);
    revalidatePath("/requests");
    return {
      success: true,
      data: {
        requestId: created.requestId,
        requestNo: created.requestNo,
      },
    };
  } catch {
    return {
      success: false,
      message: "Failed to create PBL base request.",
    };
  }
}

export async function savePblDetails(
  input: SavePblDetailsInput
): Promise<
  ActionResult<{
    projectId: string;
    projectCode: string;
    companyId: string;
    companyCode: string;
    companyName: string;
  }>
> {
  const validatedInput = savePblDetailsSchema.safeParse(input);
  if (!validatedInput.success) {
    return {
      success: false,
      message: "Please fix the project details before proceeding.",
      fieldErrors: getFieldErrors(validatedInput.error),
    };
  }

  const payload = validatedInput.data;

  try {
    const projectCode = payload.projectCode?.trim() || "";

    await savePblDetailsInSharePoint({
      requestId: payload.requestId,
      projectId: payload.projectId,
      projectCode,
      procurementMethod: payload.procurementMethod,
    });

    revalidatePath("/submit");
    revalidatePath("/requests");

    return {
      success: true,
      data: {
        projectId: payload.projectId,
        projectCode,
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
          ? `Failed to save PBL project details. ${error.message}`
          : "Failed to save PBL project details.",
    };
  }
}

export async function savePblBidders(
  input: SavePblBiddersInput
): Promise<ActionResult<{ bidderCount: number }>> {
  const validatedInput = savePblBiddersSchema.safeParse(input);
  if (!validatedInput.success) {
    return {
      success: false,
      message: "Please fix bidder list details before proceeding.",
      fieldErrors: getFieldErrors(validatedInput.error),
    };
  }

  const payload = validatedInput.data;

  try {
    await savePblBiddersInSharePoint(payload);

    revalidatePath("/requests");

    return {
      success: true,
      data: {
        bidderCount: payload.bidders.length,
      },
    };
  } catch (error: unknown) {
    return {
      success: false,
      message:
        error instanceof Error && error.message
          ? `Failed to save PBL bidder list. ${error.message}`
          : "Failed to save PBL bidder list.",
    };
  }
}

export async function submitPblRequest(
  input: SubmitPblRequestInput
): Promise<ActionResult<{ requestId: string; requestNo: string }>> {
  const validatedInput = submitPblRequestSchema.safeParse(input);
  if (!validatedInput.success) {
    return {
      success: false,
      message: "Please complete the document and acknowledgement requirements.",
      fieldErrors: getFieldErrors(validatedInput.error),
    };
  }

  const payload = validatedInput.data;

  try {
    const submissionSnapshot = await getPblSubmissionSnapshotFromSharePoint(payload.requestId);

    if (submissionSnapshot.bidderCount < 1) {
      return {
        success: false,
        message: "At least one bidder is required before submission.",
      };
    }

    if (
      submissionSnapshot.bidderCount < PBL_MIN_BIDDERS_WITHOUT_JUSTIFICATION &&
      !(submissionSnapshot.justificationForLessBidders ?? "").trim()
    ) {
      return {
        success: false,
        message: "Justification is required when fewer than 3 bidders are added.",
        fieldErrors: {
          justificationForLessBidders: [
            "Please provide justification when fewer than 3 bidders are available",
          ],
        },
      };
    }

    const submitted = await submitPblRequestInSharePoint({
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
          ? `Failed to submit PBL request. ${error.message}`
          : "Failed to submit PBL request.",
    };
  }
}
