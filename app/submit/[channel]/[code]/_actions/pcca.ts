"use server";

import { Prisma, PrismaClient } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { notifyRequestSubmissionByEmail } from "@/lib/email/request-notifications";
import prisma from "@/lib/prisma";
import { buildNextRequestNo } from "@/lib/request-no";
import {
  createPccaBaseRequestSchema,
  savePccaDetailsSchema,
  savePccaProjectDetailsSchema,
  submitPccaRequestSchema,
  type CreatePccaBaseRequestInput,
  type SavePccaDetailsInput,
  type SavePccaProjectDetailsInput,
  type SubmitPccaRequestInput,
} from "@/lib/validations/pcca";

type FieldErrors = Record<string, string[]>;
type ActionResult<TData> =
  | { success: true; data: TData }
  | { success: false; message: string; fieldErrors?: FieldErrors };

function getFieldErrors(error: z.ZodError) {
  return error.flatten().fieldErrors;
}

function getPccaRequestDelegate() {
  const clientWithPcca = prisma as PrismaClient & {
    pccaRequest?: PrismaClient["pccaRequest"];
  };
  return clientWithPcca.pccaRequest;
}

export async function createPccaBaseRequest(
  input: CreatePccaBaseRequestInput
): Promise<ActionResult<{ requestId: string; requestNo: string }>> {
  const validatedInput = createPccaBaseRequestSchema.safeParse(input);
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
      return { success: false, message: "Failed to create PCCA base request." };
    }
  }

  return {
    success: false,
    message: "Unable to generate a unique request number. Please try again.",
  };
}

export async function savePccaProjectDetails(
  input: SavePccaProjectDetailsInput
): Promise<
  ActionResult<{
    projectId: string;
    projectCode: string;
    companyId: string;
    companyCode: string;
    companyName: string;
  }>
> {
  const validatedInput = savePccaProjectDetailsSchema.safeParse(input);
  if (!validatedInput.success) {
    return {
      success: false,
      message: "Please fix project details before proceeding.",
      fieldErrors: getFieldErrors(validatedInput.error),
    };
  }

  const payload = validatedInput.data;
  const pccaRequestDelegate = getPccaRequestDelegate();
  if (!pccaRequestDelegate) {
    return {
      success: false,
      message: "PCCA persistence is not initialized yet. Please restart server.",
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
      return {
        success: false,
        message: "Base request was not found. Please restart from Step 1.",
      };
    }
    if (!project) {
      return {
        success: false,
        message: "Selected project was not found.",
        fieldErrors: { projectId: ["Please select a valid project"] },
      };
    }

    const projectCode = project.projectCode?.trim() || payload.projectCode?.trim() || "";

    await pccaRequestDelegate.upsert({
      where: { requestId: payload.requestId },
      create: {
        requestId: payload.requestId,
        projectId: project.id,
        projectCode: projectCode || null,
      },
      update: {
        projectId: project.id,
        projectCode: projectCode || null,
      },
    });

    await prisma.request.update({
      where: { id: payload.requestId },
      data: { status: "Draft-Details" },
    });

    revalidatePath(`/submit/${request.routingType.toLowerCase()}/${request.requestType}`);
    revalidatePath("/requests");

    return {
      success: true,
      data: {
        projectId: project.id,
        projectCode,
        companyId: project.companyId,
        companyCode: project.companyCode,
        companyName: project.companyName,
      },
    };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      return {
        success: false,
        message: "Unable to save PCCA project details due to a database constraint issue.",
      };
    }
    return { success: false, message: "Failed to save PCCA project details." };
  }
}

export async function savePccaDetails(
  input: SavePccaDetailsInput
): Promise<ActionResult<{ requestId: string }>> {
  const validatedInput = savePccaDetailsSchema.safeParse(input);
  if (!validatedInput.success) {
    return {
      success: false,
      message: "Please fix PCCA details before proceeding.",
      fieldErrors: getFieldErrors(validatedInput.error),
    };
  }

  const payload = validatedInput.data;
  const pccaRequestDelegate = getPccaRequestDelegate();
  if (!pccaRequestDelegate) {
    return {
      success: false,
      message: "PCCA persistence is not initialized yet. Please restart server.",
    };
  }

  try {
    const pcca = await pccaRequestDelegate.findUnique({
      where: { requestId: payload.requestId },
      select: { id: true },
    });
    if (!pcca) {
      return {
        success: false,
        message: "Project details are missing. Complete Step 2 first.",
      };
    }

    await prisma.$transaction([
      pccaRequestDelegate.update({
        where: { id: pcca.id },
        data: {
          priceRevenueFromContractBq: payload.priceRevenueFromContractBq as Prisma.InputJsonValue,
          costFromContractBq: payload.costFromContractBq as Prisma.InputJsonValue,
          totalRevenueRm: payload.totalRevenueRm ?? null,
          totalCostRm: payload.totalCostRm ?? null,
          constructionCostRm: payload.constructionCostRm ?? null,
          internalCost: payload.internalCost ?? null,
          remarks: payload.remarks ?? null,
        },
      }),
      prisma.request.update({
        where: { id: payload.requestId },
        data: { status: "Draft-PCCA" },
      }),
    ]);

    revalidatePath("/requests");
    return { success: true, data: { requestId: payload.requestId } };
  } catch {
    return { success: false, message: "Failed to save PCCA details." };
  }
}

export async function submitPccaRequest(
  input: SubmitPccaRequestInput
): Promise<ActionResult<{ requestId: string; requestNo: string }>> {
  const validatedInput = submitPccaRequestSchema.safeParse(input);
  if (!validatedInput.success) {
    return {
      success: false,
      message: "Please complete the document and acknowledgement requirements.",
      fieldErrors: getFieldErrors(validatedInput.error),
    };
  }

  const payload = validatedInput.data;
  const pccaRequestDelegate = getPccaRequestDelegate();
  if (!pccaRequestDelegate) {
    return {
      success: false,
      message: "PCCA persistence is not initialized yet. Please restart server.",
    };
  }

  try {
    const [request, pcca] = await Promise.all([
      prisma.request.findUnique({
        where: { id: payload.requestId },
        select: { id: true, requestNo: true, requestType: true, routingType: true },
      }),
      pccaRequestDelegate.findUnique({
        where: { requestId: payload.requestId },
        select: { id: true, projectId: true },
      }),
    ]);

    if (!request) {
      return {
        success: false,
        message: "Request was not found. Please restart the PCCA form.",
      };
    }
    if (!pcca || !pcca.projectId) {
      return {
        success: false,
        message: "PCCA details are incomplete. Please review Steps 2-4 and try again.",
      };
    }

    await prisma.$transaction([
      pccaRequestDelegate.update({
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
    return { success: false, message: "Failed to submit PCCA request." };
  }
}
