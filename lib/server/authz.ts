import { ApiError } from "./http";
import { getBid, getRequirement } from "./repo";
import { currentAccount } from "./session";
import type { Account } from "@/lib/types";

/**
 * Authorisation for mutations.
 *
 * Reads stay open — a marketplace is meant to be browsable. Writes are not:
 * record ids appear in ordinary list responses, so an id is not a secret and
 * cannot double as a permission.
 */

export async function requireAccount(): Promise<Account> {
  const account = await currentAccount();
  if (!account) {
    throw new ApiError("unauthorized", "You need to sign in to do that.");
  }
  return account;
}

/** The caller must be the buyer who posted this requirement. */
export async function assertOwnsRequirement(
  requirementId: string
): Promise<Account> {
  const account = await requireAccount();
  const requirement = await getRequirement(requirementId);
  if (!requirement) {
    throw new ApiError("not_found", `No requirement with id ${requirementId}`);
  }
  if (requirement.buyerId !== account.id) {
    throw new ApiError("forbidden", "That requirement belongs to another buyer.");
  }
  return account;
}

/** The caller must own the requirement this bid was placed against. */
export async function assertOwnsBid(bidId: string): Promise<Account> {
  const account = await requireAccount();
  const bid = await getBid(bidId);
  if (!bid) throw new ApiError("not_found", `No bid with id ${bidId}`);

  const requirement = await getRequirement(bid.requirementId);
  if (!requirement) {
    throw new ApiError("not_found", "Parent requirement missing");
  }
  if (requirement.buyerId !== account.id) {
    throw new ApiError("forbidden", "Only the buyer who posted this can change an offer.");
  }
  return account;
}

/**
 * The caller must be a signed-in seller, and may only bid as their own
 * merchant ID. Without the second half a seller could submit offers under
 * another merchant's identity and inherit their performance score.
 */
export async function requireSeller(): Promise<Account> {
  const account = await requireAccount();
  if (account.role !== "seller") {
    throw new ApiError("forbidden", "Only a seller can place an offer.");
  }
  return account;
}

export async function assertSellerForProvider(
  providerId: string
): Promise<Account> {
  const account = await requireAccount();
  if (account.role !== "seller") {
    throw new ApiError("forbidden", "Only a seller can place an offer.");
  }
  if (account.merchantId !== providerId) {
    throw new ApiError("forbidden", "You can only bid as your own merchant ID.");
  }
  return account;
}
