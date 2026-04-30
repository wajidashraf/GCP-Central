"use server";

import { PrismaClient } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { notifyRequestSubmissionByEmail } from "@/lib/email/request-notifications";
import prisma from "@/lib/prisma";
import { buildNextRequestNo } from "@/lib/request-no";
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

function getOtherRequestDelegate() {
  const clientWithOther = prisma as PrismaClient & {
    otherRequest?: PrismaClient["otherRequest"];
  };
  return clientWithOther.otherRequest;
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
      return { success: true, data: { requestId: request.id, requestNo: request.requestNo } };
    } catch (error) {
      const isRequestNoConflict = typeof error === "object" && error !== null && "code" in error && (error as { code?: string }).code === "P2002";
      if (isRequestNoConflict) continue;
      return { success: false, message: "Failed to create CPR base request." };
    }
  }
  return { success: false, message: "Unable to generate a unique request number. Please try again." };
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
  const otherRequestDelegate = getOtherRequestDelegate();
  if (!otherRequestDelegate) return { success: false, message: "CPR persistence is not initialized yet. Please restart server." };

  const [request, project] = await Promise.all([
    prisma.request.findUnique({ where: { id: payload.requestId }, select: { id: true, routingType: true, requestType: true } }),
    prisma.project.findUnique({ where: { id: payload.projectId }, select: { id: true, projectCode: true } }),
  ]);
  if (!request) return { success: false, message: "Base request was not found. Please restart from Step 1." };
  if (!project) return { success: false, message: "Selected project was not found.", fieldErrors: { projectId: ["Please select a valid project"] } };

  const serializedCprData = JSON.stringify({
    eot: {
      latestNo: payload.eotLatestNo,
      latestDate: payload.eotLatestDate,
      newApplicationDate: payload.eotNewApplicationDate,
      newCompletionDate: payload.eotNewCompletionDate,
      applicationStatus: payload.eotApplicationStatus,
      justifications: payload.eotNewJustifications,
    },
    vo: {
      latestNo: payload.voLatestNo,
      latestApprovedCumulativeAmount: payload.voLatestApprovedCumulativeAmount,
      newApplicationAmount: payload.voNewApplicationAmount,
      newApplicationNo: payload.voNewApplicationNo,
      newApplicationDate: payload.voNewApplicationDate,
      applicationStatus: payload.voApplicationStatus,
      justification: payload.voNewJustification,
    },
    claims: {
      cumulativeApplicationAmountToDate: payload.cumulativeClaimApplicationAmountToDate,
      cumulativeCertifiedAmountToDate: payload.cumulativeClaimCertifiedAmountToDate,
      pendingCertifiedAmountToDate: payload.pendingCertifiedAmountToDate,
      noOfClaimsForPendingCertifiedAmount: payload.noOfClaimsForPendingCertifiedAmount,
      newNetCertifiedAmount: payload.newNetCertifiedAmount,
      claimDateForPendingCertifiedAmount: payload.claimDateForPendingCertifiedAmount,
    },
  });

  await otherRequestDelegate.upsert({
    where: { requestId: payload.requestId },
    create: {
      requestId: payload.requestId,
      projectId: project.id,
      projectCode: project.projectCode ?? payload.projectCode ?? null,
      descriptionOfMatters: serializedCprData,
    },
    update: {
      projectId: project.id,
      projectCode: project.projectCode ?? payload.projectCode ?? null,
      descriptionOfMatters: serializedCprData,
    },
  });
  await prisma.request.update({ where: { id: payload.requestId }, data: { status: "Draft-Details" } });
  revalidatePath(`/submit/${request.routingType.toLowerCase()}/${request.requestType}`);
  revalidatePath("/requests");
  return { success: true, data: { requestId: payload.requestId } };
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
  const otherRequestDelegate = getOtherRequestDelegate();
  if (!otherRequestDelegate) return { success: false, message: "CPR persistence is not initialized yet. Please restart server." };

  const [request, details] = await Promise.all([
    prisma.request.findUnique({ where: { id: payload.requestId }, select: { id: true, requestNo: true, requestType: true, routingType: true } }),
    otherRequestDelegate.findUnique({ where: { requestId: payload.requestId }, select: { id: true, projectId: true } }),
  ]);
  if (!request) return { success: false, message: "Request was not found. Please restart the CPR form." };
  if (!details || !details.projectId) return { success: false, message: "CPR details are incomplete. Please review Steps 2-5 and try again." };

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
  return { success: true, data: { requestId: request.id, requestNo: request.requestNo } };
}
