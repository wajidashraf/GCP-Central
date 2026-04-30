"use server";

import { Prisma, PrismaClient } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { notifyRequestSubmissionByEmail } from "@/lib/email/request-notifications";
import prisma from "@/lib/prisma";
import { buildNextRequestNo } from "@/lib/request-no";
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

function getStspRequestDelegate() {
  const clientWithStsp = prisma as PrismaClient & {
    stspRequest?: {
      findUnique: PrismaClient["jvpRequest"]["findUnique"];
      upsert: PrismaClient["jvpRequest"]["upsert"];
      update: PrismaClient["jvpRequest"]["update"];
    };
  };
  return clientWithStsp.stspRequest;
}

function buildStspPersistenceUnavailableMessage(actionLabel: string) {
  return `Failed to ${actionLabel}. STSP persistence is not initialized yet. Please restart the app server and try again.`;
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
        data: {
          requestId: request.id,
          requestNo: request.requestNo,
        },
      };
    } catch (error) {
      const isRequestNoConflict =
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        (error as { code?: string }).code === "P2002";

      if (isRequestNoConflict) {
        continue;
      }

      return {
        success: false,
        message: "Failed to create STSP base request.",
      };
    }
  }

  return {
    success: false,
    message: "Unable to generate a unique request number. Please try again.",
  };
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
  const stspRequestDelegate = getStspRequestDelegate();
  if (!stspRequestDelegate) {
    return {
      success: false,
      message: buildStspPersistenceUnavailableMessage("save STSP project details"),
    };
  }

  try {
    const [request, project] = await Promise.all([
      prisma.request.findUnique({
        where: { id: payload.requestId },
        select: {
          id: true,
          routingType: true,
          requestType: true,
        },
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

    await stspRequestDelegate.upsert({
      where: { requestId: payload.requestId },
      create: {
        requestId: payload.requestId,
        projectId: project.id,
        projectCode: projectCode || null,
        tenderProposalSubmissionDate: new Date(payload.tenderProposalSubmissionDate),
        tenderValidityPeriodDays: payload.tenderValidityPeriodDays,
      },
      update: {
        projectId: project.id,
        projectCode: projectCode || null,
        tenderProposalSubmissionDate: new Date(payload.tenderProposalSubmissionDate),
        tenderValidityPeriodDays: payload.tenderValidityPeriodDays,
      },
    });

    await prisma.request.update({
      where: { id: payload.requestId },
      data: {
        status: "Draft-Details",
      },
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
    console.error("saveStspProjectDetails failed:", error);

    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      return {
        success: false,
        message: "Unable to save STSP project details due to a database constraint issue.",
      };
    }
    return {
      success: false,
      message:
        error instanceof Error && error.message.trim().length > 0
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
  const stspRequestDelegate = getStspRequestDelegate();
  if (!stspRequestDelegate) {
    return {
      success: false,
      message: buildStspPersistenceUnavailableMessage("save STSP details"),
    };
  }

  try {
    const stsp = await stspRequestDelegate.findUnique({
      where: { requestId: payload.requestId },
      select: { id: true },
    });

    if (!stsp) {
      return {
        success: false,
        message: "Project details are missing. Complete Step 2 first.",
      };
    }

    await prisma.$transaction([
      stspRequestDelegate.update({
        where: { id: stsp.id },
        data: {
          teamLeader: payload.teamLeader,
          financialMatters: payload.financialMatters,
          technicalMatters: payload.technicalMatters,
          contractMatters: payload.contractMatters,
          procurementMatters: payload.procurementMatters,
          costingAndEstimationMatters: payload.costingAndEstimationMatters,
          implementationStage: payload.implementationStage,
          backgroundReview: payload.backgroundReview,
          scopeOfWorks: payload.scopeOfWorks,
          keyTerms: payload.keyTerms,
          financialPoints: payload.financialPoints as Prisma.InputJsonValue,
          technical: payload.technical,
          procurementStrategyWorkPackages: payload.procurementStrategyWorkPackages,
          sourcingReference: payload.sourcingReference,
          costBreakdown: payload.costBreakdown,
          riskReviewMitigationItems: payload.riskReviewMitigationItems as Prisma.InputJsonValue,
          contractStructureUrl: payload.contractStructureUrl ?? null,
          contractStructurePublicId: payload.contractStructurePublicId ?? null,
          contractStructureFileName: payload.contractStructureFileName ?? null,
          contractStructureMimeType: payload.contractStructureMimeType ?? null,
          contractStructureSizeBytes: payload.contractStructureSizeBytes ?? null,
          revenueVsCostUrl: payload.revenueVsCostUrl ?? null,
          revenueVsCostPublicId: payload.revenueVsCostPublicId ?? null,
          revenueVsCostFileName: payload.revenueVsCostFileName ?? null,
          revenueVsCostMimeType: payload.revenueVsCostMimeType ?? null,
          revenueVsCostSizeBytes: payload.revenueVsCostSizeBytes ?? null,
          cashflowUrl: payload.cashflowUrl ?? null,
          cashflowPublicId: payload.cashflowPublicId ?? null,
          cashflowFileName: payload.cashflowFileName ?? null,
          cashflowMimeType: payload.cashflowMimeType ?? null,
          cashflowSizeBytes: payload.cashflowSizeBytes ?? null,
        },
      }),
      prisma.request.update({
        where: { id: payload.requestId },
        data: {
          status: "Draft-STSP",
        },
      }),
    ]);

    revalidatePath("/requests");

    return {
      success: true,
      data: { requestId: payload.requestId },
    };
  } catch {
    return {
      success: false,
      message: "Failed to save STSP details.",
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
  const stspRequestDelegate = getStspRequestDelegate();
  if (!stspRequestDelegate) {
    return {
      success: false,
      message: buildStspPersistenceUnavailableMessage("submit STSP request"),
    };
  }

  try {
    const [request, stsp] = await Promise.all([
      prisma.request.findUnique({
        where: { id: payload.requestId },
        select: {
          id: true,
          requestNo: true,
          requestType: true,
          routingType: true,
        },
      }),
      stspRequestDelegate.findUnique({
        where: { requestId: payload.requestId },
        select: {
          id: true,
          projectId: true,
          teamLeader: true,
          backgroundReview: true,
          riskReviewMitigationItems: true,
        },
      }),
    ]);

    if (!request) {
      return {
        success: false,
        message: "Request was not found. Please restart the STSP form.",
      };
    }

    if (!stsp) {
      return {
        success: false,
        message: "STSP details are missing. Complete Steps 2-5 first.",
      };
    }

    if (!stsp.projectId || !stsp.teamLeader || !stsp.backgroundReview || !stsp.riskReviewMitigationItems) {
      return {
        success: false,
        message: "STSP details are incomplete. Please review Steps 2-5 and try again.",
      };
    }

    await prisma.$transaction([
      stspRequestDelegate.update({
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
        data: {
          acknowledgement: true,
          status: "New",
          submittedAt: new Date(),
        },
      }),
    ]);

    revalidatePath("/requests");
    revalidatePath(`/submit/${request.routingType.toLowerCase()}/${request.requestType}`);
    await notifyRequestSubmissionByEmail({ requestId: request.id });

    return {
      success: true,
      data: {
        requestId: request.id,
        requestNo: request.requestNo,
      },
    };
  } catch {
    return {
      success: false,
      message: "Failed to submit STSP request.",
    };
  }
}
