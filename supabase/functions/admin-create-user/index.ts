// Supabase Edge Function: create user + assign role
// Requires env vars: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

type CreateUserPayload = {
  email: string;
  password: string;
  full_name?: string;
  phone?: string;
  role: "admin" | "staff" | "branch_manager" | "agent" | "driver" | "customer";
};

type UserRoleRow = {
  id: string;
  role: CreateUserPayload["role"];
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY =
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

const rolePriority: CreateUserPayload["role"][] = [
  "admin",
  "staff",
  "branch_manager",
  "agent",
  "driver",
  "customer",
];

const syncUserRole = async (
  supabaseAdmin: any,
  userId: string,
  nextRole: CreateUserPayload["role"],
) => {
  const { data: existingRows, error: fetchError } = await supabaseAdmin
    .from("user_roles")
    .select("id, role")
    .eq("user_id", userId);

  if (fetchError) {
    return fetchError.message;
  }

  const rows = ((existingRows || []) as UserRoleRow[]).sort(
    (left, right) =>
      rolePriority.indexOf(left.role) - rolePriority.indexOf(right.role),
  );
  const matchingRow = rows.find((row) => row.role === nextRole);

  if (matchingRow) {
    const rowsToDelete = rows
      .filter((row) => row.id !== matchingRow.id)
      .map((row) => row.id);
    if (rowsToDelete.length > 0) {
      const { error: deleteError } = await supabaseAdmin
        .from("user_roles")
        .delete()
        .in("id", rowsToDelete);

      if (deleteError) {
        return deleteError.message;
      }
    }

    return null;
  }

  if (rows.length > 0) {
    const primaryRow = rows[0];
    const { error: updateError } = await supabaseAdmin
      .from("user_roles")
      .update({ role: nextRole })
      .eq("id", primaryRow.id);

    if (updateError) {
      return updateError.message;
    }

    const rowsToDelete = rows
      .filter((row) => row.id !== primaryRow.id)
      .map((row) => row.id);
    if (rowsToDelete.length > 0) {
      const { error: deleteError } = await supabaseAdmin
        .from("user_roles")
        .delete()
        .in("id", rowsToDelete);

      if (deleteError) {
        return deleteError.message;
      }
    }

    return null;
  }

  const { error: insertError } = await supabaseAdmin
    .from("user_roles")
    .insert({ user_id: userId, role: nextRole });

  return insertError?.message ?? null;
};

const findAuthUserByEmail = async (supabaseAdmin: any, email: string) => {
  const target = email.trim().toLowerCase();
  const { data, error } = await supabaseAdmin.auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  });
  if (error) {
    return { user: null, error: error.message };
  }

  const user =
    (data?.users || []).find(
      (entry: any) => (entry.email || "").toLowerCase() === target,
    ) || null;
  return { user, error: null };
};

const ensureStaffPortalDefaults = async (
  supabaseAdmin: any,
  userId: string,
  createdBy: string,
) => {
  const defaultPortals = ["warehouse", "finance", "support"];
  const { error } = await supabaseAdmin.from("staff_portal_assignments").insert(
    defaultPortals.map((portal_id) => ({
      user_id: userId,
      portal_id,
      created_by: createdBy,
    })),
  );

  if (
    error &&
    !String(error.message || "")
      .toLowerCase()
      .includes("duplicate")
  ) {
    console.warn("Failed to ensure default portal assignments:", error.message);
  }
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response("Method not allowed", {
      status: 405,
      headers: corsHeaders,
    });
  }

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return new Response("Missing required env vars.", {
      status: 500,
      headers: corsHeaders,
    });
  }

  const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  try {
    // Verify caller is authenticated
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "");
    const {
      data: { user: caller },
      error: authError,
    } = await supabaseAdmin.auth.getUser(token);
    if (authError || !caller) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify caller has admin, staff, branch_manager, agent role, OR is an active member of shipment_team
    const [{ data: callerRoles }, { data: shipmentTeamMember }] = await Promise.all([
      supabaseAdmin
        .from("user_roles")
        .select("role")
        .eq("user_id", caller.id)
        .in("role", ["admin", "staff", "branch_manager", "agent"])
        .limit(1),
      supabaseAdmin
        .from("shipment_team")
        .select("id")
        .eq("user_id", caller.id)
        .eq("is_active", true)
        .limit(1)
        .maybeSingle()
    ]);

    if ((!callerRoles || callerRoles.length === 0) && !shipmentTeamMember) {
      console.error("Access denied for user:", caller.id);
      return new Response(
        JSON.stringify({ error: "Forbidden - Administrative access required to create accounts" }),
        {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const payload = (await req.json()) as CreateUserPayload;
    console.log("Creating user for email:", payload?.email);
    const normalizedEmail = payload?.email?.trim().toLowerCase() ?? "";

    if (!normalizedEmail || !payload?.password || !payload?.role) {
      console.error("Missing required fields in payload");
      return new Response(
        JSON.stringify({ error: "Missing email, password, or role." }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    console.log("Checking for existing profile for:", normalizedEmail);
    const { data: existingProfile, error: profileCheckError } = await supabaseAdmin
      .from("profiles")
      .select("user_id")
      .ilike("email", normalizedEmail)
      .maybeSingle();

    if (profileCheckError) {
      console.error("Profile check error:", profileCheckError);
    }

    if (existingProfile?.user_id) {
      console.log("Existing profile found for user_id:", existingProfile.user_id);
      const { data: existingAuthUser, error: existingAuthError } =
        await supabaseAdmin.auth.admin.getUserById(existingProfile.user_id);
      
      if (!existingAuthError && existingAuthUser?.user) {
        console.log("User already exists in Auth, returning 409");
        return new Response(
          JSON.stringify({ error: "A user with this email already exists." }),
          {
            status: 409,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }

      console.log("Stale profile record found, cleaning up...");
      await supabaseAdmin
        .from("profiles")
        .delete()
        .eq("user_id", existingProfile.user_id);
    }

    // Create user with admin API (auto-confirms email)
    console.log("Calling auth.admin.createUser...");
    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
      email: normalizedEmail,
      password: payload.password,
      email_confirm: true,
      user_metadata: {
        full_name: payload.full_name ?? normalizedEmail,
        phone: payload.phone ?? null,
        requested_role: payload.role,
      },
    });

    if (error || !created.user) {
      const normalizedError = (error?.message || "").toLowerCase();
      console.error("Auth createUser error:", error?.message);

      if (
        normalizedError.includes("already") ||
        normalizedError.includes("exists")
      ) {
        console.log("User exists fallback initiated...");
        const { user: existingAuthUser, error: findUserError } =
          await findAuthUserByEmail(supabaseAdmin, normalizedEmail);
        
        if (findUserError) {
          console.error("Fallback find user error:", findUserError);
          return new Response(JSON.stringify({ error: findUserError }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        if (existingAuthUser) {
          console.log("Updating existing auth user:", existingAuthUser.id);
          const { error: updateUserError } =
            await supabaseAdmin.auth.admin.updateUserById(existingAuthUser.id, {
              password: payload.password,
              email_confirm: true,
              user_metadata: {
                ...(existingAuthUser.user_metadata || {}),
                full_name: payload.full_name ?? normalizedEmail,
                phone: payload.phone ?? null,
                requested_role: payload.role,
              },
            });

          if (updateUserError) {
            console.error("Update user error:", updateUserError.message);
            return new Response(
              JSON.stringify({ error: updateUserError.message }),
              {
                status: 400,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
              },
            );
          }

          console.log("Syncing roles for existing user...");
          const roleError = await syncUserRole(
            supabaseAdmin,
            existingAuthUser.id,
            payload.role,
          );
          if (roleError) {
            console.error("Role sync error:", roleError);
            return new Response(JSON.stringify({ error: roleError }), {
              status: 400,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
          }

          console.log("Upserting profile for existing user...");
          const { error: profileError } = await supabaseAdmin
            .from("profiles")
            .upsert(
              {
                user_id: existingAuthUser.id,
                full_name:
                  payload.full_name ??
                  existingAuthUser.email ??
                  normalizedEmail,
                email: existingAuthUser.email ?? normalizedEmail,
                phone: payload.phone ?? null,
              },
              { onConflict: "user_id" },
            );

          if (profileError) {
            console.error("Profile upsert error:", profileError.message);
            return new Response(
              JSON.stringify({ error: profileError.message }),
              {
                status: 400,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
              },
            );
          }

          if (payload.role === "staff") {
            await ensureStaffPortalDefaults(
              supabaseAdmin,
              existingAuthUser.id,
              caller.id,
            );
          }

          return new Response(
            JSON.stringify({
              id: existingAuthUser.id,
              email: existingAuthUser.email,
              recovered: true,
            }),
            {
              status: 200,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            },
          );
        }

        return new Response(
          JSON.stringify({ error: "A user with this email already exists." }),
          {
            status: 409,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }

      return new Response(
        JSON.stringify({
          error: error?.message ?? "Unknown error creating user",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    console.log("User created successfully in Auth, syncing role...");
    const roleError = await syncUserRole(
      supabaseAdmin,
      created.user.id,
      payload.role,
    );
    if (roleError) {
      console.error("Role sync error for new user:", roleError);
      return new Response(JSON.stringify({ error: roleError }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log("Upserting profile for new user...");
    const { error: profileError } = await supabaseAdmin.from("profiles").upsert(
      {
        user_id: created.user.id,
        full_name: payload.full_name ?? created.user.email ?? normalizedEmail,
        email: created.user.email ?? normalizedEmail,
        phone: payload.phone ?? null,
      },
      { onConflict: "user_id" },
    );

    if (profileError) {
      console.error("Profile upsert error for new user:", profileError.message);
      return new Response(JSON.stringify({ error: profileError.message }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (payload.role === "staff") {
      await ensureStaffPortalDefaults(
        supabaseAdmin,
        created.user.id,
        caller.id,
      );
    }

    console.log("User creation complete.");
    return new Response(
      JSON.stringify({ id: created.user.id, email: created.user.email }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err.message || "Internal server error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
