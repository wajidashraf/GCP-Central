"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  createRtpBaseRequestInSharePoint,
  saveRtpDetailsInSharePoint,
  submitRtpRequestInSharePoint,
} from "@/lib/sharepoint/rtp";
import {
  createRtpBaseRequestSchema,
  saveRtpDetailsSchema,
  submitRtpRequestSchema,
  type CreateRtpBaseRequestInput,
  type SaveRtpDetailsInput,
  type SubmitRtpRequestInput,
} from "@/lib/validations/rtp";

type FieldErrors = Record<string, string[]>;

type ActionResult<TData> =
  | { success: true; data: TData }
  | { success: false; message: string; fieldErrors?: FieldErrors };

function getFieldErrors(error: z.ZodError) {
  return error.flatten().fieldErrors;
}

function parseDateInput(value?: string | null) {
  if (!value) {
    return null;
  }

  const parsedDate = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(parsedDate.getTime())) {
    return null;
  }

  return parsedDate;
}

function parseNumberInput(value?: string | null) {
  if (!value) {
    return null;
  }

  const parsedNumber = Number(value);
  if (!Number.isInteger(parsedNumber) || parsedNumber < 0) {
    return null;
  }

  return parsedNumber;
}

export async function createRtpBaseRequest(
  input: CreateRtpBaseRequestInput
): Promise<ActionResult<{ requestId: string; requestNo: string }>> {
  const validatedInput = createRtpBaseRequestSchema.safeParse(input);
  if (!validatedInput.success) {
    return {
      success: false,
      message: "Please complete all required basic information fields.",
      fieldErrors: getFieldErrors(validatedInput.error),
    };
  }

  const payload = validatedInput.data;
  try {
    const created = await createRtpBaseRequestInSharePoint(payload);
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
      message: "Failed to create RTP base request.",
    };
  }
}

export async function saveRtpDetails(
  input: SaveRtpDetailsInput
): Promise<ActionResult<{ projectId: string }>> {
  const validatedInput = saveRtpDetailsSchema.safeParse(input);
  if (!validatedInput.success) {
    return {
      success: false,
      message: "Please fix the project details before proceeding.",
      fieldErrors: getFieldErrors(validatedInput.error),
    };
  }

  const payload = validatedInput.data;

  try {
    const tenderClosingDate = parseDateInput(payload.tenderClosingDate);
    if (payload.tenderClosingDate && !tenderClosingDate) {
      return {
        success: false,
        message: "Tender closing date is invalid.",
        fieldErrors: { tenderClosingDate: ["Please provide a valid tender closing date"] },
      };
    }

    const numberOfDaysAfterTenderClosingDate = parseNumberInput(
      payload.numberOfDaysAfterTenderClosingDate
    );
    if (
      payload.numberOfDaysAfterTenderClosingDate &&
      numberOfDaysAfterTenderClosingDate === null
    ) {
      return {
        success: false,
        message: "Number of days after tender closing date is invalid.",
        fieldErrors: {
          numberOfDaysAfterTenderClosingDate: [
            "Please provide a valid whole number greater than or equal to 0",
          ],
        },
      };
    }

    const validityPeriod = parseDateInput(payload.validityPeriod);
    if (payload.validityPeriod && !validityPeriod) {
      return {
        success: false,
        message: "Validity period is invalid.",
        fieldErrors: { validityPeriod: ["Please provide a valid validity period date"] },
      };
    }

    const saved = await saveRtpDetailsInSharePoint(payload);
    revalidatePath("/submit");
    revalidatePath("/requests");

    return {
      success: true,
      data: {
        projectId: saved.projectId,
      },
    };
  } catch (error: unknown) {
    return {
      success: false,
      message:
        error instanceof Error && error.message
          ? `Failed to save RTP project details. ${error.message}`
          : "Failed to save RTP project details.",
    };
  }
}

export async function submitRtpRequest(
  input: SubmitRtpRequestInput
): Promise<ActionResult<{ requestId: string; requestNo: string }>> {
  const validatedInput = submitRtpRequestSchema.safeParse(input);
  if (!validatedInput.success) {
    return {
      success: false,
      message: "Please complete the document and acknowledgement requirements.",
      fieldErrors: getFieldErrors(validatedInput.error),
    };
  }

  const payload = validatedInput.data;

  try {
    const submitted = await submitRtpRequestInSharePoint(payload);
    revalidatePath("/requests");
    revalidatePath("/submit");

    return {
      success: true,
      data: {
        requestId: payload.requestId,
        requestNo: submitted.requestNo,
      },
    };
  } catch {
    return {
      success: false,
      message: "Failed to submit RTP request.",
    };
  }
}
