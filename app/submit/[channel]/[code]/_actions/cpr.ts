"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  createCprBaseRequestInSharePoint,
  saveCprDetailsInSharePoint,
  submitCprRequestInSharePoint,
} from "@/lib/sharepoint/cpr";
import {
  createCprBaseRequestSchema,
  saveCprDetailsSchema,
  submitCprRequestSchema,
  type CreateCprBaseRequestInput,
  type SaveCprDetailsInput,
  type SubmitCprRequestInput,
} from "@/lib/validations/cpr";

type FieldErrors = Record<string, string[]>;
type ActionResult<TData> =
  | { success: true; data: TData }
  | { success: false; message: string; fieldErrors?: FieldErrors };

function getFieldErrors(error: z.ZodError) {
  return error.flatten().fieldErrors;
}

export async function createCprBaseRequest(
  input: CreateCprBaseRequestInput
): Promise<ActionResult<{ requestId: string; requestNo: string }>> {
  const validatedInput = createCprBaseRequestSchema.safeParse(input);
  if (!validatedInput.success) {
    return {
      success: false,
      message: "Please complete all required basic information fields.",
      fieldErrors: getFieldErrors(validatedInput.error),
    };
  }
  const payload = validatedInput.data;
  try {
    const created = await createCprBaseRequestInSharePoint(payload);
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
          ? `Failed to create CPR base request. ${error.message}`
          : "Failed to create CPR base request.",
    };
  }
}

export async function saveCprDetails(input: SaveCprDetailsInput): Promise<ActionResult<{ requestId: string }>> {
  const validatedInput = saveCprDetailsSchema.safeParse(input);
  if (!validatedInput.success) {
    return {
      success: false,
      message: "Please fix CPR details before proceeding.",
      fieldErrors: getFieldErrors(validatedInput.error),
    };
  }
  const payload = validatedInput.data;

  try {
    await saveCprDetailsInSharePoint(payload);
    revalidatePath("/requests");
    revalidatePath("/submit");
    return { success: true, data: { requestId: payload.requestId } };
  } catch (error: unknown) {
    return {
      success: false,
      message:
        error instanceof Error && error.message
          ? `Failed to save CPR details. ${error.message}`
          : "Failed to save CPR details.",
    };
  }
}

export async function submitCprRequest(
  input: SubmitCprRequestInput
): Promise<ActionResult<{ requestId: string; requestNo: string }>> {
  const validatedInput = submitCprRequestSchema.safeParse(input);
  if (!validatedInput.success) {
    return {
      success: false,
      message: "Please complete the document and acknowledgement requirements.",
      fieldErrors: getFieldErrors(validatedInput.error),
    };
  }
  const payload = validatedInput.data;

  try {
    const submitted = await submitCprRequestInSharePoint(payload);
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
          ? `Failed to submit CPR request. ${error.message}`
          : "Failed to submit CPR request.",
    };
  }
}
