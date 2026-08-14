"use server";
import { acceptInvite } from "@/lib/team";

export async function acceptInviteAction(token: string, name: string, password: string) {
  return acceptInvite(token, name, password);
}
