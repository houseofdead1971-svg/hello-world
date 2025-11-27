import { supabase } from "@/integrations/supabase/client";

/**
 * Recovery function for orphaned auth users (users created in auth but no profile)
 * Call this if a user was created but profile setup failed
 */
export async function recoverOrphanedUser(userId: string, profileData: any) {
  try {
    // Check if profile exists
    const { data: existingProfile, error: checkError } = await supabase
      .from('profiles')
      .select('id')
      .eq('id', userId)
      .single();

    if (existingProfile) {
      return { success: true, message: "Profile already exists" };
    }

    if (checkError && checkError.code !== 'PGRST116') {
      throw checkError;
    }

    // Create the profile
    const { error: profileError } = await supabase
      .from('profiles')
      .insert([profileData]);

    if (profileError) throw profileError;

    // Assign role if provided
    if (profileData.role) {
      const { error: roleError } = await supabase
        .from('user_roles')
        .insert([{ user_id: userId, role: profileData.role }]);

      if (roleError) throw roleError;
    }

    return { success: true, message: "Account recovered successfully" };
  } catch (error: any) {
    console.error("Recovery failed:", error);
    return { success: false, message: error.message };
  }
}

/**
 * Verify that a user account is complete (has both auth and profile)
 */
export async function verifyUserAccount(userId: string) {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, full_name, email')
      .eq('id', userId)
      .single();

    if (error && error.code === 'PGRST116') {
      return { complete: false, message: "Profile not found. Account setup incomplete." };
    }

    if (error) throw error;

    return { complete: true, profile: data };
  } catch (error: any) {
    console.error("Verification failed:", error);
    return { complete: false, message: error.message };
  }
}
