import { supabase } from "@/integrations/supabase/client";

export type SourcingCustomerRef = {
  code: string | null;
  full_name: string | null;
} | null;

export type SourcingRequestRow = {
  id: string;
  customer_id: string;
  product_name: string;
  description: string | null;
  quantity: number;
  budget: number | null;
  status: string;
  created_at: string;
  updated_at?: string;
  support_response_message?: string | null;
  support_response_at?: string | null;
  support_responded_by?: string | null;
  customer?: SourcingCustomerRef;
};

export type SourcingPhotoRow = {
  id: string;
  request_id: string;
  photo_url: string;
  created_at: string;
};

export type SourcingQuoteRow = {
  id: string;
  request_id: string;
  supplier_name: string;
  quote_amount: number;
  status: string;
  notes: string | null;
  created_at: string;
};

export const formatSourcingStatus = (status: string | null | undefined) => {
  if (!status) return "Pending";
  return status.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
};

export const uploadSourcingPhoto = async (
  requestId: string,
  userId: string,
  file: File,
) => {
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const path = `${requestId}/${userId}-${Date.now()}-${safeName}`;

  const { error } = await supabase.storage
    .from("sourcing-attachments")
    .upload(path, file, { upsert: false });

  if (error) throw error;

  const { data } = supabase.storage.from("sourcing-attachments").getPublicUrl(path);

  return {
    photo_url: data.publicUrl,
  };
};
