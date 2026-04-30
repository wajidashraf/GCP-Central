"use server";

import { Prisma, PrismaClient } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { notifyRequestSubmissionByEmail } from "@/lib/email/request-notifications";
import prisma from "@/lib/prisma";
import { buildNextRequestNo } from "@/lib/request-no";
import {
  createCaaBaseRequestSchema,
  saveCaaDetailsSchema,
  saveCaaProjectDetailsSchema,
  submitCaaRequestSchema,
  type CreateCaaBaseRequestInput,
  type SaveCaaDetailsInput,
  type SaveCaaProjectDetailsInput,
  type SubmitCaaRequestInput,
} from "@/lib/validations/caa";

type FieldErrors = Record<string, string[]>;
type ActionResult<TData> =
  | { success: true; data: TData }
  | { success: false; message: string; fieldErrors?: FieldErrors };

function getFieldErrors(error: z.ZodError) {
  return error.flatten().fieldErrors;
}

function getCaaRequestDelegate() {
  const clientWithCaa = prisma as PrismaClient & {
    caaRequest?: PrismaClient["caaRequest"];
  };
  return clientWithCaa.caaRequest;
}

export async function createCaaBaseRequest(
  input: CreateCaaBaseRequestInput
): Promise<ActionResult<{ requestId: string; requestNo: string }>> {
  const validatedInput = createCaaBaseRequestSchema.safeParse(input);
  if (!validatedInput.success) {
    return { success: false, message: "Please complete all required basic information fields.", fieldErrors: getFieldErrors(validatedInput.error) };
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
      const isRequestNoConflict =
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        (error as { code?: string }).code === "P2002";
      if (isRequestNoConflict) continue;
      return { success: false, message: "Failed to create CAA base request." };
    }
  }

  return { success: false, message: "Unable to generate a unique request number. Please try again." };
}

export async function saveCaaProjectDetails(
  input: SaveCaaProjectDetailsInput
): Promise<ActionResult<{ projectId: string; projectCode: string; companyId: string; companyCode: string; companyName: string }>> {
  const validatedInput = saveCaaProjectDetailsSchema.safeParse(input);
  if (!validatedInput.success) {
    return { success: false, message: "Please fix project details before proceeding.", fieldErrors: getFieldErrors(validatedInput.error) };
  }

  const payload = validatedInput.data;
  const caaRequestDelegate = getCaaRequestDelegate();
  if (!caaRequestDelegate) {
    return { success: false, message: "CAA persistence is not initialized yet. Please restart server." };
  }

  try {
    const [request, project] = await Promise.all([
      prisma.request.findUnique({
        where: { id: payload.requestId },
        select: { id: true, routingType: true, requestType: true },
      }),
      prisma.project.findUnique({
        where: { id: payload.projectId },
        select: { id: true, projectCode: true, companyId: true, companyCode: true, companyName: true },
      }),
    ]);

    if (!request) return { success: false, message: "Base request was not found. Please restart from Step 1." };
    if (!project) return { success: false, message: "Selected project was not found.", fieldErrors: { projectId: ["Please select a valid project"] } };

    const projectCode = project.projectCode?.trim() || payload.projectCode?.trim() || "";

    await caaRequestDelegate.upsert({
      where: { requestId: payload.requestId },
      create: { requestId: payload.requestId, projectId: project.id, projectCode: projectCode || null },
      update: { projectId: project.id, projectCode: projectCode || null },
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
      return { success: false, message: "Unable to save CAA project details due to a database constraint issue." };
    }
    return { success: false, message: "Failed to save CAA project details." };
  }
}

export async function saveCaaDetails(input: SaveCaaDetailsInput): Promise<ActionResult<{ requestId: string }>> {
  const validatedInput = saveCaaDetailsSchema.safeParse(input);
  if (!validatedInput.success) {
    return { success: false, message: "Please fix CAA details before proceeding.", fieldErrors: getFieldErrors(validatedInput.error) };
  }

  const payload = validatedInput.data;
  const caaRequestDelegate = getCaaRequestDelegate();
  if (!caaRequestDelegate) {
    return { success: false, message: "CAA persistence is not initialized yet. Please restart server." };
  }

  try {
    const caa = await caaRequestDelegate.findUnique({
      where: { requestId: payload.requestId },
      select: { id: true },
    });
    if (!caa) {
      return { success: false, message: "Project details are missing. Complete Step 2 first." };
    }

    await prisma.$transaction([
      caaRequestDelegate.update({
        where: { id: caa.id },
        data: {
          tenderProposalPrice: payload.tenderProposalPrice ?? null,
          finalContractAmount: payload.finalContractAmount ?? null,
          estimatedBudgetCost: payload.estimatedBudgetCost ?? null,
          estimatedMarginPercent: payload.estimatedMarginPercent ?? null,
          tenderProposalRefNo: payload.tenderProposalRefNo ?? null,
          loaDate: payload.loaDate ? new Date(payload.loaDate) : null,
          contractCommencementDate: payload.contractCommencementDate ? new Date(payload.contractCommencementDate) : null,
          contractCompletionDate: payload.contractCompletionDate ? new Date(payload.contractCompletionDate) : null,
          contractPeriodDays: payload.contractPeriodDays ?? null,
          performanceBondForProject: payload.performanceBondForProject ?? null,
          stampDutyInclusiveLegalFees: payload.stampDutyInclusiveLegalFees ?? null,
          insurance: payload.insurance ?? null,
          bumiputeraParticipation: payload.bumiputeraParticipation ?? null,
          formationOfJvCompany: payload.formationOfJvCompany ?? null,
          criticalActivityMilestone: payload.criticalActivityMilestone ?? null,
          defectLiabilityPeriodDlp: payload.defectLiabilityPeriodDlp ?? null,
          liquidatedDamagesRate: payload.liquidatedDamagesRate ?? null,
          paymentTerm: payload.paymentTerm ?? null,
          typeOfContract: payload.typeOfContract ?? null,
          formOfContractCondition: payload.formOfContractCondition ?? null,
          projectDirector: payload.projectDirector ?? null,
          contactPersonAtSite: payload.contactPersonAtSite ?? null,
          claimApplicationProcess: payload.claimApplicationProcess as Prisma.InputJsonValue,
          claimCertificationProcess: payload.claimCertificationProcess as Prisma.InputJsonValue,
          variationOrderApplicationProcess: payload.variationOrderApplicationProcess as Prisma.InputJsonValue,
          extensionOfTimeApplicationProcess: payload.extensionOfTimeApplicationProcess as Prisma.InputJsonValue,
          commissioningCompletionManagementSystems: payload.commissioningCompletionManagementSystems as Prisma.InputJsonValue,
          keyDeliveryMilestone: payload.keyDeliveryMilestone as Prisma.InputJsonValue,
          mandatoryTestingRequiredToCommission: payload.mandatoryTestingRequiredToCommission as Prisma.InputJsonValue,
          documentRequiredForContractualAcceptance: payload.documentRequiredForContractualAcceptance as Prisma.InputJsonValue,
          preRequisiteDocumentsForDlp: payload.preRequisiteDocumentsForDlp as Prisma.InputJsonValue,
          organisationAndManpowerChartUrl: payload.organisationAndManpowerChartUrl ?? null,
          organisationAndManpowerChartPublicId: payload.organisationAndManpowerChartPublicId ?? null,
          organisationAndManpowerChartFileName: payload.organisationAndManpowerChartFileName ?? null,
          organisationAndManpowerChartMimeType: payload.organisationAndManpowerChartMimeType ?? null,
          organisationAndManpowerChartSizeBytes: payload.organisationAndManpowerChartSizeBytes ?? null,
        },
      }),
      prisma.request.update({
        where: { id: payload.requestId },
        data: { status: "Draft-CAA" },
      }),
    ]);

    revalidatePath("/requests");
    return { success: true, data: { requestId: payload.requestId } };
  } catch {
    return { success: false, message: "Failed to save CAA details." };
  }
}

export async function submitCaaRequest(
  input: SubmitCaaRequestInput
): Promise<ActionResult<{ requestId: string; requestNo: string }>> {
  const validatedInput = submitCaaRequestSchema.safeParse(input);
  if (!validatedInput.success) {
    return { success: false, message: "Please complete the document and acknowledgement requirements.", fieldErrors: getFieldErrors(validatedInput.error) };
  }

  const payload = validatedInput.data;
  const caaRequestDelegate = getCaaRequestDelegate();
  if (!caaRequestDelegate) {
    return { success: false, message: "CAA persistence is not initialized yet. Please restart server." };
  }

  try {
    const [request, caa] = await Promise.all([
      prisma.request.findUnique({
        where: { id: payload.requestId },
        select: { id: true, requestNo: true, requestType: true, routingType: true },
      }),
      caaRequestDelegate.findUnique({
        where: { requestId: payload.requestId },
        select: { id: true, projectId: true },
      }),
    ]);

    if (!request) return { success: false, message: "Request was not found. Please restart the CAA form." };
    if (!caa || !caa.projectId) return { success: false, message: "CAA details are incomplete. Please review Steps 2-8 and try again." };

    await prisma.$transaction([
      caaRequestDelegate.update({
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
  } catch {
    return { success: false, message: "Failed to submit CAA request." };
  }
}
