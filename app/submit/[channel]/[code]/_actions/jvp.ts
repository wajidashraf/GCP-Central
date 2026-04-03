"use server";

import { Prisma, PrismaClient } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { notifyRequestSubmissionByEmail } from "@/lib/email/request-notifications";
import prisma from "@/lib/prisma";
import { buildNextRequestNo } from "@/lib/request-no";
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

function getJvpRequestDelegate() {
  const clientWithJvp = prisma as PrismaClient & {
    jvpRequest?: PrismaClient["jvpRequest"];
  };
  return clientWithJvp.jvpRequest;
}

function buildJvpPersistenceUnavailableMessage(actionLabel: string) {
  return `Failed to ${actionLabel}. JVP persistence is not initialized yet. Please restart the app server and try again.`;
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
        message: "Failed to create JVP base request.",
      };
    }
  }

  return {
    success: false,
    message: "Unable to generate a unique request number. Please try again.",
  };
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
  const jvpRequestDelegate = getJvpRequestDelegate();
  if (!jvpRequestDelegate) {
    return {
      success: false,
      message: buildJvpPersistenceUnavailableMessage("save JVP project details"),
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
          companyId: true,
          companyCode: true,
          companyName: true,
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

    if (
      request.companyId !== payload.companyId ||
      request.companyCode !== payload.companyCode ||
      request.companyName !== payload.companyName
    ) {
      return {
        success: false,
        message: "Company information does not match the base request.",
      };
    }

    if (!project) {
      return {
        success: false,
        message: "Selected project was not found.",
        fieldErrors: { projectId: ["Please select a valid project"] },
      };
    }

    if (
      project.companyId !== payload.companyId ||
      project.companyCode !== payload.companyCode ||
      project.companyName !== payload.companyName
    ) {
      return {
        success: false,
        message: "Selected project does not belong to the selected company.",
        fieldErrors: { projectId: ["Please select a project from your company"] },
      };
    }

    const projectCode = project.projectCode?.trim() || payload.projectCode?.trim() || "";

    await jvpRequestDelegate.upsert({
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
    console.error("saveJvpProjectDetails failed:", error);

    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      return {
        success: false,
        message: "Unable to save JVP project details due to a database constraint issue.",
      };
    }
    return {
      success: false,
      message:
        error instanceof Error && error.message.trim().length > 0
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
  const jvpRequestDelegate = getJvpRequestDelegate();
  if (!jvpRequestDelegate) {
    return {
      success: false,
      message: buildJvpPersistenceUnavailableMessage("save JVP details"),
    };
  }

  try {
    const jvp = await jvpRequestDelegate.findUnique({
      where: { requestId: payload.requestId },
      select: { id: true },
    });

    if (!jvp) {
      return {
        success: false,
        message: "Project details are missing. Complete Step 2 first.",
      };
    }

    await prisma.$transaction([
      jvpRequestDelegate.update({
        where: { id: jvp.id },
        data: {
          teamLeader: payload.teamLeader,
          financialMatters: payload.financialMatters,
          technicalMatters: payload.technicalMatters,
          contractMatters: payload.contractMatters,
          procurementMatters: payload.procurementMatters,
          costingAndEstimationMatters: payload.costingAndEstimationMatters,
          implementationStage: payload.implementationStage,
          backgroundOfCollabPoints:
            payload.backgroundOfCollabPoints as Prisma.InputJsonValue,
          scopeOfCollabPoints: payload.scopeOfCollabPoints as Prisma.InputJsonValue,
          proposedStructurePoints:
            payload.proposedStructurePoints as Prisma.InputJsonValue,
          keyTermsPoints: payload.keyTermsPoints as Prisma.InputJsonValue,
          financialOverviewPoints:
            payload.financialOverviewPoints as Prisma.InputJsonValue,
          technicalCapabilitiesPoints:
            payload.technicalCapabilitiesPoints as Prisma.InputJsonValue,
          workPackagesDivisionPoints:
            payload.workPackagesDivisionPoints as Prisma.InputJsonValue,
          resourcesContributionPoints:
            payload.resourcesContributionPoints as Prisma.InputJsonValue,
          riskReviewMitigationItems:
            payload.riskReviewMitigationItems as Prisma.InputJsonValue,
          cashflowForecastUrl: payload.cashflowForecastUrl,
          cashflowForecastPublicId: payload.cashflowForecastPublicId,
          cashflowForecastFileName: payload.cashflowForecastFileName,
          cashflowForecastMimeType: payload.cashflowForecastMimeType,
          cashflowForecastSizeBytes: payload.cashflowForecastSizeBytes,
          costStructureUrl: payload.costStructureUrl,
          costStructurePublicId: payload.costStructurePublicId,
          costStructureFileName: payload.costStructureFileName,
          costStructureMimeType: payload.costStructureMimeType,
          costStructureSizeBytes: payload.costStructureSizeBytes,
        },
      }),
      prisma.request.update({
        where: { id: payload.requestId },
        data: {
          status: "Draft-JVP",
        },
      }),
    ]);

    revalidatePath("/requests");

    return {
      success: true,
      data: {
        requestId: payload.requestId,
      },
    };
  } catch {
    return {
      success: false,
      message: "Failed to save JVP details.",
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
  const jvpRequestDelegate = getJvpRequestDelegate();
  if (!jvpRequestDelegate) {
    return {
      success: false,
      message: buildJvpPersistenceUnavailableMessage("submit JVP request"),
    };
  }

  try {
    const [request, jvp] = await Promise.all([
      prisma.request.findUnique({
        where: { id: payload.requestId },
        select: {
          id: true,
          requestNo: true,
          requestType: true,
          routingType: true,
        },
      }),
      jvpRequestDelegate.findUnique({
        where: { requestId: payload.requestId },
        select: {
          id: true,
          projectId: true,
          teamLeader: true,
          backgroundOfCollabPoints: true,
          riskReviewMitigationItems: true,
          cashflowForecastPublicId: true,
          costStructurePublicId: true,
        },
      }),
    ]);

    if (!request) {
      return {
        success: false,
        message: "Request was not found. Please restart the JVP form.",
      };
    }

    if (!jvp) {
      return {
        success: false,
        message: "JVP details are missing. Complete Step 6 first.",
      };
    }

    if (
      !jvp.projectId ||
      !jvp.teamLeader ||
      !jvp.backgroundOfCollabPoints ||
      !jvp.riskReviewMitigationItems ||
      !jvp.cashflowForecastPublicId ||
      !jvp.costStructurePublicId
    ) {
      return {
        success: false,
        message: "JVP details are incomplete. Please review Steps 2-6 and try again.",
      };
    }

    await prisma.$transaction([
      jvpRequestDelegate.update({
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
      message: "Failed to submit JVP request.",
    };
  }
}
