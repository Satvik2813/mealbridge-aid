import { supabase } from "./supabase";
import { UserRole } from "@/context/AuthContext";

/**
 * Upserts a user profile in public.users after Google OAuth sign-in.
 * If the user already exists, their roles array is updated to include the new role.
 */
export async function upsertUserProfile(
  userId: string,
  name: string,
  email: string,
  avatarUrl: string,
  role: UserRole
) {
  // Check if user already exists
  const { data: existing } = await supabase
    .from("users")
    .select("id, roles")
    .eq("id", userId)
    .maybeSingle();

  if (!existing) {
    // New user — insert with selected role
    const { error } = await supabase.from("users").insert({
      id: userId,
      name,
      email,
      avatar_url: avatarUrl,
      roles: [role],
    });
    if (error) console.error("Error creating user profile:", error);
  } else {
    // Existing user — add role to array if not already present
    const existingRoles: string[] = existing.roles || [];
    if (!existingRoles.includes(role)) {
      const { error } = await supabase
        .from("users")
        .update({ roles: [...existingRoles, role] })
        .eq("id", userId);
      if (error) console.error("Error updating user roles:", error);
    }
  }
}
