"use server";

import { Prisma, PrismaClient } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { notifyRequestSubmissionByEmail } from "@/lib/email/request-notifications";
import prisma from "@/lib/prisma";
import { buildNextRequestNo } from "@/lib/request-no";
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

function getOtherRequestDelegate() {
  const clientWithOther = prisma as PrismaClient & {
    otherRequest?: PrismaClient["otherRequest"];
  };
  return clientWithOther.otherRequest;
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
  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      const requestNo = await buildNextRequestNo();
      const request = await prisma.request.create({
        data: {
          requestNo,
          requestType: payload.requestType,
          routingType: payload.routingType,
          requestTitle: payload.requestTitle,
          category: payload.category,
          requestorId: payload.requestorId,
          requestorName: payload.requestorName,
          requestorEmail: payload.requestorEmail,
          companyId: payload.companyId,
          companyCode: payload.companyCode,
          companyName: payload.companyName,
          status: "Draft",
          acknowledgement: false,
        },
      });

      revalidatePath("/requests");
      return {
        success: true,
        data: { requestId: request.id, requestNo: request.requestNo },
      };
    } catch (error) {
      const isRequestNoConflict =
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        (error as { code?: string }).code === "P2002";
      if (isRequestNoConflict) continue;
      return { success: false, message: "Failed to create CI base request." };
    }
  }

  return {
    success: false,
    message: "Unable to generate a unique request number. Please try again.",
  };
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
  const otherRequestDelegate = getOtherRequestDelegate();
  if (!otherRequestDelegate) {
    return {
      success: false,
      message: "CI persistence is not initialized yet. Please restart server.",
    };
  }

  try {
    const [request, project] = await Promise.all([
      prisma.request.findUnique({
        where: { id: payload.requestId },
        select: { id: true, routingType: true, requestType: true },
      }),
      prisma.project.findUnique({
        where: { id: payload.projectId },
        select: {
          id: true,
          projectCode: true,
          companyId: true,
          companyCode: true,
          companyName: true,
        },
      }),
    ]);

    if (!request) {
      return { success: false, message: "Base request was not found. Please restart from Step 1." };
    }
    if (!project) {
      return {
        success: false,
        message: "Selected project was not found.",
        fieldErrors: { projectId: ["Please select a valid project"] },
      };
    }

    const projectCode = project.projectCode?.trim() || payload.projectCode?.trim() || "";
    const serializedCiData = JSON.stringify({
      companyRoleInIssue: payload.companyRoleInIssue,
      category: payload.category,
      voEotLeInformation: {
        briefOfIssues: payload.voBriefOfIssues,
        chronologyOfEvent: payload.voChronologyOfEvent,
        timeAndCostImpact: payload.voTimeAndCostImpact,
        contractClauseEntitlement: payload.voContractClauseEntitlement,
        advisoryRequiredFromGcp: payload.voAdvisoryRequiredFromGcp,
      },
      paymentsInformation: {
        briefOfIssues: payload.paymentBriefOfIssues,
        chronologyOfEvent: payload.paymentChronologyOfEvent,
        contractClauseEntitlement: payload.paymentContractClauseEntitlement,
        advisoryRequiredFromGcp: payload.paymentAdvisoryRequiredFromGcp,
      },
    });

    await otherRequestDelegate.upsert({
      where: { requestId: payload.requestId },
      create: {
        requestId: payload.requestId,
        projectId: project.id,
        projectCode: projectCode || null,
        descriptionOfMatters: serializedCiData,
      },
      update: {
        projectId: project.id,
        projectCode: projectCode || null,
        descriptionOfMatters: serializedCiData,
      },
    });

    await prisma.request.update({
      where: { id: payload.requestId },
      data: { status: "Draft-Details" },
    });

    revalidatePath(`/submit/${request.routingType.toLowerCase()}/${request.requestType}`);
    revalidatePath("/requests");
    return { success: true, data: { requestId: payload.requestId } };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      return {
        success: false,
        message: "Unable to save CI details due to a database constraint issue.",
      };
    }
    return { success: false, message: "Failed to save CI details." };
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
  const otherRequestDelegate = getOtherRequestDelegate();
  if (!otherRequestDelegate) {
    return {
      success: false,
      message: "CI persistence is not initialized yet. Please restart server.",
    };
  }

  try {
    const [request, details] = await Promise.all([
      prisma.request.findUnique({
        where: { id: payload.requestId },
        select: { id: true, requestNo: true, requestType: true, routingType: true },
      }),
      otherRequestDelegate.findUnique({
        where: { requestId: payload.requestId },
        select: { id: true, projectId: true },
      }),
    ]);

    if (!request) {
      return { success: false, message: "Request was not found. Please restart the CI form." };
    }
    if (!details || !details.projectId) {
      return { success: false, message: "CI details are incomplete. Please review Steps 2-4 and try again." };
    }

    await prisma.$transaction([
      otherRequestDelegate.update({
        where: { requestId: payload.requestId },
        data: {
          documentUrl: payload.documentUrl,
          documentPublicId: payload.documentPublicId,
          documentFileName: payload.documentFileName,
          documentMimeType: payload.documentMimeType,
          documentSizeBytes: payload.documentSizeBytes,
        },
      }),
      prisma.request.update({
        where: { id: payload.requestId },
        data: { acknowledgement: true, status: "New", submittedAt: new Date() },
      }),
    ]);

    revalidatePath("/requests");
    revalidatePath(`/submit/${request.routingType.toLowerCase()}/${request.requestType}`);
    await notifyRequestSubmissionByEmail({ requestId: request.id });

    return {
      success: true,
      data: { requestId: request.id, requestNo: request.requestNo },
    };
  } catch {
    return { success: false, message: "Failed to submit CI request." };
  }
}
