import { useEffect, useState, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";

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
};

type CreateCustomerInput = {
  full_name: string;
  email: string;
  phone: string;
  address?: string;
  city?: string;
  country?: string;
  branch_id?: string;
};

const CACHE_KEY = "customer_record_cache";
const CACHE_EXPIRY = 5 * 60 * 1000; // 5 minutes

const safeSessionStorageGet = (key: string) => {
  if (typeof window === "undefined") return null;

  try {
    return window.sessionStorage.getItem(key);
  } catch {
    return null;
  }
};

const safeSessionStorageSet = (key: string, value: string) => {
  if (typeof window === "undefined") return;

  try {
    window.sessionStorage.setItem(key, value);
  } catch {
    // Ignore cache errors.
  }
};

const safeSessionStorageRemove = (key: string) => {
  if (typeof window === "undefined") return;

  try {
    window.sessionStorage.removeItem(key);
  } catch {
    // Ignore cache errors.
  }
};

const generateCustomerCode = () => {
  const random = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `CUST-${random}`;
};

const getCachedCustomer = (): CustomerRecord | null => {
  try {
    const cached = safeSessionStorageGet(CACHE_KEY);
    if (cached) {
      const { data, timestamp } = JSON.parse(cached);
      if (Date.now() - timestamp < CACHE_EXPIRY) {
        return data;
      }
      safeSessionStorageRemove(CACHE_KEY);
    }
  } catch {
    // Ignore cache errors
  }
  return null;
};

const setCachedCustomer = (customer: CustomerRecord) => {
  try {
    safeSessionStorageSet(
      CACHE_KEY,
      JSON.stringify({ data: customer, timestamp: Date.now() })
    );
  } catch {
    // Ignore cache errors
  }
};

const clearCachedCustomer = () => {
  safeSessionStorageRemove(CACHE_KEY);
};

export const useCustomerRecordOptimized = () => {
  const initialCustomer = getCachedCustomer();
  const [customer, setCustomer] = useState<CustomerRecord | null>(initialCustomer);
  const [isLoading, setIsLoading] = useState(!initialCustomer);
  const queryClient = useQueryClient();
  const fetchedRef = useRef(false);

  const fetchCustomer = useCallback(async (forceRefresh = false) => {
    // Skip if already fetched and not forcing refresh
    if (fetchedRef.current && !forceRefresh && customer) {
      return;
    }

    const { data: sessionData } = await supabase.auth.getSession();
    const session = sessionData.session;
    
    if (!session) {
      setIsLoading(false);
      setCustomer(null);
      clearCachedCustomer();
      return;
    }

    // Check cache first unless forcing refresh
    if (!forceRefresh) {
      const cached = getCachedCustomer();
      if (cached) {
        setCustomer(cached);
        setIsLoading(false);
        fetchedRef.current = true;
        return;
      }
    }

    setIsLoading(true);

    const { data, error } = await supabase
      .from("customers")
      .select("id, code, full_name, email, phone, address, city, country, branch_id")
      .eq("user_id", session.user.id)
      .maybeSingle();

    if (error) {
      console.error("Error fetching customer:", error);
      setIsLoading(false);
      return;
    }

    if (data) {
      const customerData = data as CustomerRecord;
      setCustomer(customerData);
      setCachedCustomer(customerData);
    } else {
      setCustomer(null);
      clearCachedCustomer();
    }

    fetchedRef.current = true;
    setIsLoading(false);
  }, [customer]);

  useEffect(() => {
    fetchCustomer();

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") {
        setCustomer(null);
        clearCachedCustomer();
        fetchedRef.current = false;
      } else if (event === "SIGNED_IN") {
        fetchCustomer(true);
      }
    });

    return () => subscription.unsubscribe();
  }, [fetchCustomer]);

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
    };

    const { data, error } = await supabase
      .from("customers")
      .insert(payload)
      .select("id, code, full_name, email, phone, address, city, country, branch_id")
      .single();

    if (error) {
      return { error: error.message };
    }

    const customerData = data as CustomerRecord;
    setCustomer(customerData);
    setCachedCustomer(customerData);
    
    // Invalidate related queries
    queryClient.invalidateQueries({ queryKey: ["customer"] });
    
    return { data: customerData };
  };

  const updateCustomer = async (updates: Partial<CustomerRecord>) => {
    if (!customer) {
      return { error: "No customer record to update" };
    }

    const { data, error } = await supabase
      .from("customers")
      .update(updates)
      .eq("id", customer.id)
      .select("id, code, full_name, email, phone, address, city, country, branch_id")
      .single();

    if (error) {
      return { error: error.message };
    }

    const customerData = data as CustomerRecord;
    setCustomer(customerData);
    setCachedCustomer(customerData);
    
    // Invalidate related queries
    queryClient.invalidateQueries({ queryKey: ["customer"] });

    return { data: customerData };
  };

  const refreshCustomer = useCallback(async () => {
    fetchedRef.current = false;
    clearCachedCustomer();
    await fetchCustomer(true);
  }, [fetchCustomer]);

  return { 
    customer, 
    isLoading, 
    createCustomer, 
    updateCustomer,
    refreshCustomer 
  };
};
