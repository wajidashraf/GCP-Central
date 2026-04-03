import prisma from "@/lib/prisma";

type BuildNextProjectCodeOptions = {
  prefix?: string;
  sequenceWidth?: number;
};

const DEFAULT_PROJECT_CODE_PREFIX = "PRO";
const DEFAULT_PROJECT_CODE_SEQUENCE_WIDTH = 4;

function escapeForRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function extractProjectSequence(projectCode: string, prefix: string) {
  const pattern = new RegExp(`^${escapeForRegex(prefix)}-(\\d+)$`);
  const match = projectCode.match(pattern);

  if (!match?.[1]) {
    return null;
  }

  const sequence = Number(match[1]);
  if (!Number.isFinite(sequence) || sequence <= 0) {
    return null;
  }

  return sequence;
}

export async function buildNextProjectCode(
  options: BuildNextProjectCodeOptions = {}
) {
  const prefix = options.prefix ?? DEFAULT_PROJECT_CODE_PREFIX;
  const sequenceWidth =
    options.sequenceWidth ?? DEFAULT_PROJECT_CODE_SEQUENCE_WIDTH;

  const existingProjectCodes = await prisma.project.findMany({
    where: {
      projectCode: {
        startsWith: `${prefix}-`,
      },
    },
    select: {
      projectCode: true,
    },
  });

  const maxSequence = existingProjectCodes.reduce((currentMax, project) => {
    const code = project.projectCode?.trim();
    if (!code) {
      return currentMax;
    }

    const sequence = extractProjectSequence(code, prefix);
    return sequence && sequence > currentMax ? sequence : currentMax;
  }, 0);

  const nextSequence = `${maxSequence + 1}`.padStart(sequenceWidth, "0");
  return `${prefix}-${nextSequence}`;
}

export async function ensureProjectCode(projectId: string) {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: {
      id: true,
      projectCode: true,
    },
  });

  if (!project) {
    throw new Error("Project not found while assigning project code");
  }

  const existingProjectCode = project.projectCode?.trim();
  if (existingProjectCode) {
    return existingProjectCode;
  }

  const nextProjectCode = await buildNextProjectCode();
  await prisma.project.update({
    where: { id: project.id },
    data: {
      projectCode: nextProjectCode,
    },
  });

  return nextProjectCode;
}
