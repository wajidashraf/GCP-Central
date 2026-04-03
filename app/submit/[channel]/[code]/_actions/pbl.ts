"use server";

import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { ensureProjectCode } from "@/lib/project-code";
import prisma from "@/lib/prisma";
import { notifyRequestSubmissionByEmail } from "@/lib/email/request-notifications";
import { buildNextRequestNo } from "@/lib/request-no";
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
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002";

      if (isRequestNoConflict) {
        continue;
      }

      return {
        success: false,
        message: "Failed to create PBL base request.",
      };
    }
  }

  return {
    success: false,
    message: "Unable to generate a unique request number. Please try again.",
  };
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

    let projectCode = project.projectCode?.trim() || payload.projectCode?.trim() || "";
    if (!projectCode) {
      projectCode = await ensureProjectCode(project.id);
    }

    await prisma.pblRequest.upsert({
      where: { requestId: payload.requestId },
      create: {
        requestId: payload.requestId,
        projectId: project.id,
        projectCode: projectCode || null,
        procurementMethod: payload.procurementMethod,
      },
      update: {
        projectId: project.id,
        projectCode: projectCode || null,
        procurementMethod: payload.procurementMethod,
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
  } catch {
    return {
      success: false,
      message: "Failed to save PBL project details.",
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
    const pbl = await prisma.pblRequest.findUnique({
      where: { requestId: payload.requestId },
      select: {
        id: true,
      },
    });

    if (!pbl) {
      return {
        success: false,
        message: "Project details are missing. Complete Step 2 first.",
      };
    }

    const justificationForLessBidders = payload.justificationForLessBidders?.trim() || null;
    const createBidderOperations = payload.bidders.map((bidder) =>
      prisma.pblBidder.create({
        data: {
          pblRequestId: pbl.id,
          companyName: bidder.companyName.trim(),
          location: bidder.location?.trim() || null,
          personInCharge: bidder.personInCharge.trim(),
          picContactNumber: bidder.picContactNumber.trim(),
          sourcesFrom: bidder.sourcesFrom.trim(),
          recommendationBy: bidder.recommendationBy.trim(),
        },
      })
    );

    await prisma.$transaction([
      prisma.pblBidder.deleteMany({
        where: { pblRequestId: pbl.id },
      }),
      ...createBidderOperations,
      prisma.pblRequest.update({
        where: { id: pbl.id },
        data: {
          justificationForLessBidders,
        },
      }),
      prisma.request.update({
        where: { id: payload.requestId },
        data: {
          status: "Draft-Bidders",
        },
      }),
    ]);

    revalidatePath("/requests");

    return {
      success: true,
      data: {
        bidderCount: payload.bidders.length,
      },
    };
  } catch {
    return {
      success: false,
      message: "Failed to save PBL bidder list.",
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
    const [request, pbl] = await Promise.all([
      prisma.request.findUnique({
        where: { id: payload.requestId },
        select: {
          id: true,
          requestNo: true,
          requestType: true,
          routingType: true,
        },
      }),
      prisma.pblRequest.findUnique({
        where: { requestId: payload.requestId },
        select: {
          id: true,
          projectId: true,
          justificationForLessBidders: true,
        },
      }),
    ]);

    if (!request) {
      return {
        success: false,
        message: "Request was not found. Please restart the PBL form.",
      };
    }

    if (!pbl) {
      return {
        success: false,
        message: "PBL project details are missing. Complete Step 2 first.",
      };
    }

    if (!pbl.projectId) {
      return {
        success: false,
        message: "Project details are incomplete. Please review Step 2 and try again.",
      };
    }

    const bidderCount = await prisma.pblBidder.count({
      where: { pblRequestId: pbl.id },
    });

    if (bidderCount < 1) {
      return {
        success: false,
        message: "At least one bidder is required before submission.",
      };
    }

    if (
      bidderCount < PBL_MIN_BIDDERS_WITHOUT_JUSTIFICATION &&
      !(pbl.justificationForLessBidders ?? "").trim()
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

    await prisma.$transaction([
      prisma.pblRequest.update({
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
      message: "Failed to submit PBL request.",
    };
  }
}
