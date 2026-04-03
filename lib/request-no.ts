import prisma from "@/lib/prisma";

type BuildNextRequestNoOptions = {
  prefix?: string;
  sequenceWidth?: number;
  date?: Date;
};

function escapeForRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function buildDateSegment(date: Date) {
  const year = date.getUTCFullYear();
  const month = `${date.getUTCMonth() + 1}`.padStart(2, "0");
  const day = `${date.getUTCDate()}`.padStart(2, "0");
  return `${year}${month}${day}`;
}

function extractSequence(
  requestNo: string,
  dateSegment: string,
  prefix: string
) {
  const pattern = new RegExp(
    `^${escapeForRegex(prefix)}-(\\d+)-${dateSegment}$`
  );
  const match = requestNo.match(pattern);
  if (!match?.[1]) {
    return null;
  }

  const sequence = Number(match[1]);
  if (!Number.isFinite(sequence) || sequence <= 0) {
    return null;
  }

  return sequence;
}

export async function buildNextRequestNo(
  options: BuildNextRequestNoOptions = {}
) {
  const prefix = options.prefix ?? "REQ";
  const sequenceWidth = options.sequenceWidth ?? 4;
  const dateSegment = buildDateSegment(options.date ?? new Date());

  const existingRequestNos = await prisma.request.findMany({
    where: {
      requestNo: {
        startsWith: `${prefix}-`,
        endsWith: `-${dateSegment}`,
      },
    },
    select: {
      requestNo: true,
    },
  });

  const maxSequence = existingRequestNos.reduce(
    (currentMax: number, request: typeof existingRequestNos[number]) => {
    const sequence = extractSequence(request.requestNo, dateSegment, prefix);
    return sequence && sequence > currentMax ? sequence : currentMax;
    },
    0
  );

  const nextSequence = `${maxSequence + 1}`.padStart(sequenceWidth, "0");
  return `${prefix}-${nextSequence}-${dateSegment}`;
}
