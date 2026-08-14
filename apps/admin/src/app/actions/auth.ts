"use server";
import { redirect } from "next/navigation";
import { login, logout } from "@/lib/auth";

export async function loginAction(_prev: unknown, formData: FormData): Promise<{ error?: string }> {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");
  const user = await login(email, password);
  if (!user) return { error: "Invalid email or password." };
  redirect("/home");
}

export async function logoutAction() {
  await logout();
  redirect("/login");
}
