"use server";

import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { buildNextRequestNo } from "@/lib/request-no";
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
        message: "Failed to create RTP base request.",
      };
    }
  }

  return {
    success: false,
    message: "Unable to generate a unique request number. Please try again.",
  };
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
    const request = await prisma.request.findUnique({
      where: { id: payload.requestId },
      select: {
        id: true,
        routingType: true,
        requestType: true,
        companyId: true,
        companyCode: true,
        companyName: true,
      },
    });

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

    const tenderClosingDate = parseDateInput(payload.tenderClosingDate);
    if (payload.tenderClosingDate && !tenderClosingDate) {
      return {
        success: false,
        message: "Tender closing date is invalid.",
        fieldErrors: { tenderClosingDate: ["Please provide a valid tender closing date"] },
      };
    }

    const existingRtp = await prisma.rtpRequest.findUnique({
      where: { requestId: payload.requestId },
      select: { projectId: true },
    });

    let projectId = existingRtp?.projectId ?? null;

    if (projectId) {
      await prisma.project.update({
        where: { id: projectId },
        data: {
          projectName: payload.projectName,
          companyId: payload.companyId,
          companyCode: payload.companyCode,
          companyName: payload.companyName,
        },
      });
    } else {
      const project = await prisma.project.create({
        data: {
          companyId: payload.companyId,
          companyCode: payload.companyCode,
          companyName: payload.companyName,
          projectName: payload.projectName,
          createdFromRequestId: payload.requestId,
        },
      });
      projectId = project.id;
    }

    await prisma.rtpRequest.upsert({
      where: { requestId: payload.requestId },
      create: {
        requestId: payload.requestId,
        clientName: payload.clientName,
        registrationType: payload.registrationType,
        tenderClosingDate,
        projectName: payload.projectName,
        projectDescription: payload.projectDescription,
        projectId,
      },
      update: {
        clientName: payload.clientName,
        registrationType: payload.registrationType,
        tenderClosingDate,
        projectName: payload.projectName,
        projectDescription: payload.projectDescription,
        projectId,
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
        projectId,
      },
    };
  } catch {
    return {
      success: false,
      message: "Failed to save RTP project details.",
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
    const [request, rtp] = await Promise.all([
      prisma.request.findUnique({
        where: { id: payload.requestId },
        select: {
          id: true,
          requestNo: true,
          requestType: true,
          routingType: true,
        },
      }),
      prisma.rtpRequest.findUnique({
        where: { requestId: payload.requestId },
        select: {
          id: true,
          projectId: true,
          projectName: true,
          clientName: true,
        },
      }),
    ]);

    if (!request) {
      return {
        success: false,
        message: "Request was not found. Please restart the RTP form.",
      };
    }

    if (!rtp) {
      return {
        success: false,
        message: "Project details are missing. Complete Step 2 first.",
      };
    }

    if (!rtp.projectId || !rtp.projectName || !rtp.clientName) {
      return {
        success: false,
        message: "RTP details are incomplete. Please review Step 2 and try again.",
      };
    }

    await prisma.$transaction([
      prisma.rtpRequest.update({
        where: { requestId: payload.requestId },
        data: {
          specialProject: payload.specialProject ?? false,
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
      message: "Failed to submit RTP request.",
    };
  }
}
