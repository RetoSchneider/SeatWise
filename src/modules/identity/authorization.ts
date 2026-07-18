import { headers } from "next/headers";
import { z } from "zod";

import { ApplicationError, forbidden } from "@/shared/domain/errors";
import { auth } from "@/modules/identity/auth";

const roleSchema = z.enum(["CUSTOMER", "ORGANIZER", "ADMINISTRATOR"]);

export type ApplicationRole = z.infer<typeof roleSchema>;

export interface AuthenticatedUser {
  id: string;
  name: string;
  email: string;
  role: ApplicationRole;
}

function toAuthenticatedUser(session: {
  user: { id: string; name: string; email: string; role?: unknown };
}): AuthenticatedUser {
  return {
    id: session.user.id,
    name: session.user.name,
    email: session.user.email,
    role: roleSchema.parse(session.user.role),
  };
}

export async function getCurrentUser() {
  const session = await auth.api.getSession({ headers: await headers() });
  return session ? toAuthenticatedUser(session) : null;
}

export async function requireCurrentUser(
  allowedRoles?: readonly ApplicationRole[],
) {
  const user = await getCurrentUser();
  if (!user) {
    throw new ApplicationError(
      "AUTHENTICATION_REQUIRED",
      "Sign in to continue",
      401,
    );
  }
  if (allowedRoles && !allowedRoles.includes(user.role)) {
    throw forbidden();
  }
  return user;
}

export async function requireRequestUser(
  request: Request,
  allowedRoles?: readonly ApplicationRole[],
) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) {
    throw new ApplicationError(
      "AUTHENTICATION_REQUIRED",
      "Sign in to continue",
      401,
    );
  }

  const user = toAuthenticatedUser(session);
  if (allowedRoles && !allowedRoles.includes(user.role)) {
    throw forbidden();
  }
  return user;
}
