 import { useState, useEffect } from "react";
 import { supabase } from "@/integrations/supabase/client";
 
 interface StaffPortalAssignment {
   id: string;
   user_id: string;
   portal_id: string;
   created_at: string;
 }
 
 export const useStaffPortals = (userId?: string) => {
   const [assignedPortals, setAssignedPortals] = useState<string[]>([]);
   const [isLoading, setIsLoading] = useState(true);
 
   useEffect(() => {
     const fetchAssignments = async () => {
       if (!userId) {
         setIsLoading(false);
         return;
       }
 
       const { data, error } = await supabase
         .from("staff_portal_assignments")
         .select("portal_id")
         .eq("user_id", userId);
 
       if (!error && data) {
         setAssignedPortals(data.map((a) => a.portal_id));
       }
       setIsLoading(false);
     };
 
     fetchAssignments();
   }, [userId]);
 
   return { assignedPortals, isLoading };
 };
 
 // Maps portal IDs to sidebar menu titles that should be visible for that portal
export const portalMenuMapping: Record<string, string[]> = {
  warehouse: [
    "Warehouse",
  ],
  finance: [
    "Finance",
  ],
  support: [
    "Support",
  ],
  compliance: [
    "Compliance",
  ],
  marketing: [
    "Marketing",
  ],
  agent: [
    "Agent Portal",
    "Customers",
  ],
  driver: [
    "Driver Portal",
    "Drivers",
  ],
  customer: [
    "Customers",
    "Receiver",
  ],
  admin: [
    "Users",
    "Access Control Level",
    "Settings",
    "Reports",
    "Dashboard",
    "Finance",
    "Support",
    "Warehouse",
    "Compliance",
    "Marketing",
    "Customers",
    "Drivers",
  ],
};
 
export const getMenuItemsForPortals = (portalIds: string[]): string[] => {
  const menuTitles = new Set<string>();

  // Add menu items based on assigned portals only
  portalIds.forEach((portalId) => {
    const titles = portalMenuMapping[portalId] || [];
    titles.forEach((title) => menuTitles.add(title));
  });

  return Array.from(menuTitles);
};
