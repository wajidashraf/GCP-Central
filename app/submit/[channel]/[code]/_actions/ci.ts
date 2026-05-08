"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  createCiBaseRequestInSharePoint,
  saveCiDetailsInSharePoint,
  submitCiRequestInSharePoint,
} from "@/lib/sharepoint/ci";
import {
  createCiBaseRequestSchema,
  saveCiDetailsSchema,
  submitCiRequestSchema,
  type CreateCiBaseRequestInput,
  type SaveCiDetailsInput,
  type SubmitCiRequestInput,
} from "@/lib/validations/ci";

type FieldErrors = Record<string, string[]>;
type ActionResult<TData> =
  | { success: true; data: TData }
  | { success: false; message: string; fieldErrors?: FieldErrors };

function getFieldErrors(error: z.ZodError) {
  return error.flatten().fieldErrors;
}

export async function createCiBaseRequest(
  input: CreateCiBaseRequestInput
): Promise<ActionResult<{ requestId: string; requestNo: string }>> {
  const validatedInput = createCiBaseRequestSchema.safeParse(input);
  if (!validatedInput.success) {
    return {
      success: false,
      message: "Please complete all required basic information fields.",
      fieldErrors: getFieldErrors(validatedInput.error),
    };
  }

  const payload = validatedInput.data;
  try {
    const created = await createCiBaseRequestInSharePoint(payload);
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
          ? `Failed to create CI base request. ${error.message}`
          : "Failed to create CI base request.",
    };
  }
}

export async function saveCiDetails(
  input: SaveCiDetailsInput
): Promise<ActionResult<{ requestId: string }>> {
  const validatedInput = saveCiDetailsSchema.safeParse(input);
  if (!validatedInput.success) {
    return {
      success: false,
      message: "Please fix CI details before proceeding.",
      fieldErrors: getFieldErrors(validatedInput.error),
    };
  }

  const payload = validatedInput.data;

  try {
    await saveCiDetailsInSharePoint(payload);
    revalidatePath("/requests");
    revalidatePath("/submit");
    return { success: true, data: { requestId: payload.requestId } };
  } catch (error: unknown) {
    return {
      success: false,
      message:
        error instanceof Error && error.message
          ? `Failed to save CI details. ${error.message}`
          : "Failed to save CI details.",
    };
  }
}

export async function submitCiRequest(
  input: SubmitCiRequestInput
): Promise<ActionResult<{ requestId: string; requestNo: string }>> {
  const validatedInput = submitCiRequestSchema.safeParse(input);
  if (!validatedInput.success) {
    return {
      success: false,
      message: "Please complete the document and acknowledgement requirements.",
      fieldErrors: getFieldErrors(validatedInput.error),
    };
  }

  const payload = validatedInput.data;

  try {
    const submitted = await submitCiRequestInSharePoint(payload);
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
          ? `Failed to submit CI request. ${error.message}`
          : "Failed to submit CI request.",
    };
  }
}
