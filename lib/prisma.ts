import { PrismaClient } from "@prisma/client";

type GlobalPrismaState = {
  prismaGlobal?: PrismaClient;
};

const globalForPrisma = globalThis as unknown as GlobalPrismaState;

function createPrismaClient() {
  return new PrismaClient();
}

function hasExpectedDelegates(client: PrismaClient) {
  const delegates = client as PrismaClient & { jvpRequest?: unknown };
  return typeof delegates.jvpRequest !== "undefined";
}

let prisma = globalForPrisma.prismaGlobal ?? createPrismaClient();

if (!hasExpectedDelegates(prisma)) {
  prisma = createPrismaClient();
}

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prismaGlobal = prisma;
}

export default prisma;
