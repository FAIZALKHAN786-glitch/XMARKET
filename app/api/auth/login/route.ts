import { ApiError, ok, readBody, route } from "@/lib/server/http";
import { writeSession } from "@/lib/server/session";
import { findByLogin, publicAccount, verifyPassword } from "@/lib/server/accounts";
import { loginInput } from "@/lib/server/schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = route(async (request: Request) => {
  const { username, email, password, role } = await readBody(request, loginInput);
  const account = await findByLogin((username ?? email)!);
  if (!account || !(await verifyPassword(account, password))) {
    throw new ApiError("unauthorized", "Username or password is incorrect.");
  }
  if (role && account.role !== role) {
    throw new ApiError("unauthorized", "Use the correct sign-in tab for this account.");
  }
  await writeSession(account);
  return ok({ account: publicAccount(account) });
}, "POST /api/auth/login");
