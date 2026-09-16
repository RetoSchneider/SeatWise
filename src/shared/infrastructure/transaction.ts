import { Prisma } from "@/generated/prisma/client";
import { database } from "@/shared/infrastructure/database";

export function isTransactionConflict(error: unknown) {
  if (error instanceof Error && error.name === "DriverAdapterError") {
    const cause = error.cause as { originalCode?: string } | undefined;
    return ["40001", "40P01"].includes(String(cause?.originalCode));
  }
  if (!(error instanceof Prisma.PrismaClientKnownRequestError)) return false;
  if (error.code === "P2034") return true;
  if (error.code !== "P2010") return false;
  const adapterError = error.meta?.driverAdapterError as
    { cause?: { originalCode?: string } } | undefined;
  const sqlState = error.meta?.code ?? adapterError?.cause?.originalCode;
  return ["40001", "40P01"].includes(String(sqlState));
}

export async function serializableTransaction<T>(
  operation: (client: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await database.$transaction(operation, {
        isolationLevel: "Serializable",
      });
    } catch (error) {
      if (attempt >= 2 || !isTransactionConflict(error)) throw error;
    }
  }
}
