import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type CustomerRecord = {
  id: string;
  code: string;
  full_name: string;
  email: string | null;
  phone: string;
  address: string | null;
  city: string | null;
  country: string | null;
  branch_id: string | null;
  company_name: string | null;
  company_registration_number: string | null;
  company_email: string | null;
  company_phone: string | null;
  company_address: string | null;
  mfa_enabled: boolean | null;
  wallet_balance: number | null;
};

type CreateCustomerInput = {
  full_name: string;
  email: string;
  phone: string;
  address?: string;
  city?: string;
  country?: string;
  branch_id?: string;
  company_name?: string;
  company_registration_number?: string;
  company_email?: string;
  company_phone?: string;
  company_address?: string;
};

const generateCustomerCode = () => {
  const random = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `CUST-${random}`;
};

const normalizeStoredPhone = (value: unknown) => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed || trimmed.toLowerCase() === "pending") return null;
  return trimmed;
};

export const useCustomerRecord = () => {
  const [customer, setCustomer] = useState<CustomerRecord | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchCustomer = async () => {
    const { data: sessionData } = await supabase.auth.getSession();
    const session = sessionData.session;
    if (!session) {
      setIsLoading(false);
      return;
    }

    // Fetch all customer records for this user, prefer the one with a real phone/branch
    const { data: allCustomers } = await supabase
      .from("customers")
      .select("id, code, full_name, email, phone, address, city, country, branch_id, company_name, company_registration_number, company_email, company_phone, company_address, mfa_enabled, wallet_balance")
      .eq("user_id", session.user.id)
      .order("created_at", { ascending: true });

    // Pick the best record: one with a real phone number and branch_id first
    const data = allCustomers && allCustomers.length > 0
      ? allCustomers.find((c: any) => c.phone && c.phone !== "Pending" && c.branch_id) 
        || allCustomers.find((c: any) => c.phone && c.phone !== "Pending")
        || allCustomers[0]
      : null;

    const metadataPhone = normalizeStoredPhone(session.user.user_metadata?.phone);

    if (data) {
      const typedCustomer = data as CustomerRecord;
      const currentPhone = normalizeStoredPhone(typedCustomer.phone);

      if (!currentPhone && metadataPhone) {
        const { data: updatedCustomer } = await supabase
          .from("customers")
          .update({ phone: metadataPhone })
          .eq("id", typedCustomer.id)
          .select("id, code, full_name, email, phone, address, city, country, branch_id, company_name, company_registration_number, company_email, company_phone, company_address, mfa_enabled, wallet_balance")
          .maybeSingle();

        setCustomer((updatedCustomer as CustomerRecord) || { ...typedCustomer, phone: metadataPhone });
        setIsLoading(false);
        return;
      }

      setCustomer(typedCustomer);
      setIsLoading(false);
      return;
    }

    const { data: existingRole } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", session.user.id)
      .eq("role", "customer")
      .maybeSingle();

    if (existingRole) {
      const fallbackInsert = await supabase
        .from("customers")
        .insert({
          user_id: session.user.id,
          code: generateCustomerCode(),
          full_name: session.user.user_metadata?.full_name || session.user.email || "Customer",
          email: session.user.email || null,
          phone: metadataPhone || "Pending",
        })
        .select(
          "id, code, full_name, email, phone, address, city, country, branch_id, company_name, company_registration_number, company_email, company_phone, company_address, mfa_enabled, wallet_balance",
        )
        .maybeSingle();

      if (fallbackInsert.data) {
        setCustomer(fallbackInsert.data as CustomerRecord);
      }
    }

    setIsLoading(false);
  };

  useEffect(() => {
    fetchCustomer();
  }, []);

  const createCustomer = async (input: CreateCustomerInput) => {
    const { data: sessionData } = await supabase.auth.getSession();
    const session = sessionData.session;
    if (!session) {
      return { error: "No active session." };
    }

    const payload = {
      user_id: session.user.id,
      code: generateCustomerCode(),
      full_name: input.full_name,
      email: input.email,
      phone: input.phone,
      address: input.address || null,
      city: input.city || null,
      country: input.country || null,
      branch_id: input.branch_id || null,
      company_name: input.company_name || null,
      company_registration_number: input.company_registration_number || null,
      company_email: input.company_email || null,
      company_phone: input.company_phone || null,
      company_address: input.company_address || null,
    };

    const { data, error } = await supabase
      .from("customers")
      .insert(payload)
      .select("id, code, full_name, email, phone, address, city, country, branch_id, company_name, company_registration_number, company_email, company_phone, company_address, mfa_enabled, wallet_balance")
      .single();

    if (error) {
      return { error: error.message };
    }

    setCustomer(data as CustomerRecord);
    return { data };
  };

  const refreshCustomer = async () => {
    setIsLoading(true);
    await fetchCustomer();
  };

  return { customer, isLoading, createCustomer, refreshCustomer };
};
