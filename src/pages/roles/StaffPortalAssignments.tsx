 import { useState, useEffect } from "react";
 import { supabase } from "@/integrations/supabase/client";
 import { PageHeader } from "@/components/shared/PageHeader";
 import { FormCard } from "@/components/shared/FormCard";
 import { DataTable, Column } from "@/components/shared/DataTable";
 import { Button } from "@/components/ui/button";
 import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
 import { Checkbox } from "@/components/ui/checkbox";
 import { Label } from "@/components/ui/label";
 import { toast } from "sonner";
import { Trash2, Save, Users } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
 
 interface StaffUser {
   user_id: string;
   full_name: string;
   email: string;
 }
 
 interface PortalAssignment {
   id: string;
   user_id: string;
   portal_id: string;
   created_at: string;
   user_name?: string;
   user_email?: string;
 }
 
const availablePortals = [
  { id: "admin", title: "Admin" },
  { id: "warehouse", title: "Warehouse" },
  { id: "finance", title: "Finance" },
  { id: "support", title: "Support" },
  { id: "compliance", title: "Compliance" },
  { id: "marketing", title: "Marketing" },
];
 
 const StaffPortalAssignments = () => {
   const [staffUsers, setStaffUsers] = useState<StaffUser[]>([]);
   const [assignments, setAssignments] = useState<PortalAssignment[]>([]);
   const [isLoading, setIsLoading] = useState(true);
   const [isSaving, setIsSaving] = useState(false);
   const [selectedUserId, setSelectedUserId] = useState("");
   const [selectedPortals, setSelectedPortals] = useState<string[]>([]);
  const [bulkSelectedUsers, setBulkSelectedUsers] = useState<string[]>([]);
  const [bulkSelectedPortals, setBulkSelectedPortals] = useState<string[]>([]);
 
   const fetchData = async () => {
     setIsLoading(true);
 
     // Fetch staff users (users with staff role)
    const { data: roleData, error: roleError } = await supabase
       .from("user_roles")
       .select("user_id")
       .eq("role", "staff");

    if (roleError) {
      toast.error(roleError.message || "Failed to load staff users.");
      setStaffUsers([]);
      setAssignments([]);
      setIsLoading(false);
      return;
    }
 
     const staffUserIds = roleData?.map((r) => r.user_id) || [];
 
     if (staffUserIds.length > 0) {
      const { data: profileData, error: profileError } = await supabase
        .from("profiles")
        .select("user_id, full_name, email")
        .in("user_id", staffUserIds);

      if (profileError) {
        toast.error(profileError.message || "Failed to load staff profiles.");
        setStaffUsers([]);
      } else {
        setStaffUsers(profileData || []);
      }
    } else {
      setStaffUsers([]);
    }

    // Fetch existing assignments
    const { data: assignmentData, error: assignmentError } = await supabase
      .from("staff_portal_assignments")
      .select("*")
      .order("created_at", { ascending: false });

    if (assignmentError) {
      toast.error(assignmentError.message || "Failed to load portal assignments.");
      setAssignments([]);
      setIsLoading(false);
      return;
    }

    // Merge with profile data
    const { data: allProfiles, error: allProfilesError } = await supabase
      .from("profiles")
      .select("user_id, full_name, email");

    if (allProfilesError) {
      toast.error(allProfilesError.message || "Failed to load user profiles.");
    }

    const profileMap = new Map(allProfiles?.map((p) => [p.user_id, p]) || []);
 
     const enrichedAssignments = (assignmentData || []).map((a) => {
       const profile = profileMap.get(a.user_id);
       return {
         ...a,
         user_name: profile?.full_name || "Unknown",
         user_email: profile?.email || a.user_id,
       };
     });
 
     setAssignments(enrichedAssignments);
     setIsLoading(false);
   };
 
   useEffect(() => {
     fetchData();
   }, []);
 
   const handleUserSelect = (userId: string) => {
     setSelectedUserId(userId);
     // Load existing assignments for this user
     const userAssignments = assignments
       .filter((a) => a.user_id === userId)
       .map((a) => a.portal_id);
     setSelectedPortals(userAssignments);
   };
 
   const togglePortal = (portalId: string) => {
     setSelectedPortals((prev) =>
       prev.includes(portalId)
         ? prev.filter((p) => p !== portalId)
         : [...prev, portalId]
     );
   };
 
   const handleSaveAssignments = async () => {
     if (!selectedUserId) {
       toast.error("Please select a staff member.");
       return;
     }
 
     setIsSaving(true);
 
     // Delete existing assignments for this user
     const { error: deleteError } = await supabase
       .from("staff_portal_assignments")
       .delete()
       .eq("user_id", selectedUserId);

     if (deleteError) {
       toast.error(deleteError.message || "Failed to reset existing assignments.");
       setIsSaving(false);
       return;
     }
 
     // Insert new assignments
     if (selectedPortals.length > 0) {
       const { error } = await supabase
         .from("staff_portal_assignments")
         .insert(
           selectedPortals.map((portal_id) => ({
             user_id: selectedUserId,
             portal_id,
           }))
         );
 
       if (error) {
         toast.error(error.message || "Failed to save assignments.");
         setIsSaving(false);
         return;
       }
     }
 
     toast.success("Portal assignments saved successfully.");
     setSelectedUserId("");
     setSelectedPortals([]);
     fetchData();
     setIsSaving(false);
   };
 
  const toggleBulkUser = (userId: string) => {
    setBulkSelectedUsers((prev) =>
      prev.includes(userId)
        ? prev.filter((u) => u !== userId)
        : [...prev, userId]
    );
  };

  const toggleBulkPortal = (portalId: string) => {
    setBulkSelectedPortals((prev) =>
      prev.includes(portalId)
        ? prev.filter((p) => p !== portalId)
        : [...prev, portalId]
    );
  };

  const selectAllUsers = () => {
    if (bulkSelectedUsers.length === staffUsers.length) {
      setBulkSelectedUsers([]);
    } else {
      setBulkSelectedUsers(staffUsers.map((u) => u.user_id));
    }
  };

  const selectAllPortals = () => {
    if (bulkSelectedPortals.length === availablePortals.length) {
      setBulkSelectedPortals([]);
    } else {
      setBulkSelectedPortals(availablePortals.map((p) => p.id));
    }
  };

  const handleBulkAssignment = async () => {
    if (bulkSelectedUsers.length === 0) {
      toast.error("Please select at least one staff member.");
      return;
    }
    if (bulkSelectedPortals.length === 0) {
      toast.error("Please select at least one portal.");
      return;
    }

    setIsSaving(true);

    // Build assignments for all selected users and portals
    const newAssignments: { user_id: string; portal_id: string }[] = [];

    for (const userId of bulkSelectedUsers) {
      for (const portalId of bulkSelectedPortals) {
        // Check if assignment already exists
        const exists = assignments.some(
          (a) => a.user_id === userId && a.portal_id === portalId
        );
        if (!exists) {
          newAssignments.push({ user_id: userId, portal_id: portalId });
        }
      }
    }

    if (newAssignments.length === 0) {
      toast.info("All selected staff already have these portal assignments.");
      setIsSaving(false);
      return;
    }

    const { error } = await supabase
      .from("staff_portal_assignments")
      .insert(newAssignments);

    if (error) {
      toast.error(error.message || "Failed to save bulk assignments.");
      setIsSaving(false);
      return;
    }

    toast.success(
      `Successfully assigned ${bulkSelectedPortals.length} portal(s) to ${bulkSelectedUsers.length} staff member(s).`
    );
    setBulkSelectedUsers([]);
    setBulkSelectedPortals([]);
    fetchData();
    setIsSaving(false);
  };

   const handleDeleteAssignment = async (id: string) => {
     const { error } = await supabase
       .from("staff_portal_assignments")
       .delete()
       .eq("id", id);
 
     if (error) {
       toast.error(error.message || "Failed to delete assignment.");
     } else {
       toast.success("Assignment removed.");
       fetchData();
     }
   };
 
   const columns: Column<PortalAssignment>[] = [
     {
       key: "user_id",
       label: "Staff Member",
       render: (item) => (
         <div>
           <p className="font-medium">{item.user_name}</p>
           <p className="text-xs text-muted-foreground">{item.user_email}</p>
         </div>
       ),
     },
     {
       key: "portal_id",
       label: "Portal",
       render: (item) => {
         const portal = availablePortals.find((p) => p.id === item.portal_id);
         return portal?.title || item.portal_id;
       },
     },
     {
       key: "created_at",
       label: "Assigned On",
       render: (item) => new Date(item.created_at).toLocaleDateString(),
     },
     {
       key: "id",
       label: "Actions",
       render: (item) => (
         <Button
           variant="ghost"
           size="sm"
           onClick={() => handleDeleteAssignment(item.id)}
         >
           <Trash2 className="w-4 h-4 text-destructive" />
         </Button>
       ),
     },
   ];
 
   return (
     <div className="space-y-6 animate-fade-in">
       <PageHeader
         title="Staff Portal Assignments"
         
       />
 
      <FormCard title="Assign Portals to Staff" className="overflow-visible">
        <Tabs defaultValue="individual" className="w-full">
          <TabsList className="mb-4">
            <TabsTrigger value="individual">Individual Assignment</TabsTrigger>
            <TabsTrigger value="bulk">
              <Users className="w-4 h-4 mr-2" />
              Bulk Assignment
            </TabsTrigger>
          </TabsList>
 
          <TabsContent value="individual" className="space-y-4">
            <div className="space-y-2">
              <Label>Select Staff Member</Label>
              <Select value={selectedUserId} onValueChange={handleUserSelect}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a staff member" />
                </SelectTrigger>
                <SelectContent>
                  {staffUsers.map((user) => (
                    <SelectItem key={user.user_id} value={user.user_id}>
                      {user.full_name} ({user.email})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {staffUsers.length === 0 && !isLoading && (
                <p className="text-sm text-muted-foreground">
                  No staff users found. Assign the "staff" role to users first.
                </p>
              )}
            </div>
 
            {selectedUserId && (
              <>
                <div className="space-y-2">
                  <Label>Select Portals</Label>
                  <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-3">
                    {availablePortals.map((portal) => (
                      <div
                        key={portal.id}
                        className="flex items-center space-x-2 p-2 border rounded-lg"
                      >
                        <Checkbox
                          id={portal.id}
                          checked={selectedPortals.includes(portal.id)}
                          onCheckedChange={() => togglePortal(portal.id)}
                        />
                        <Label htmlFor={portal.id} className="cursor-pointer flex-1">
                          {portal.title}
                        </Label>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex justify-end gap-2">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setSelectedUserId("");
                      setSelectedPortals([]);
                    }}
                  >
                    Cancel
                  </Button>
                  <Button onClick={handleSaveAssignments} disabled={isSaving}>
                    <Save className="w-4 h-4 mr-2" />
                    {isSaving ? "Saving..." : "Save Assignments"}
                  </Button>
                </div>
              </>
            )}
          </TabsContent>

          <TabsContent value="bulk" className="space-y-4">
            <div className="grid gap-6 lg:grid-cols-2">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Select Staff Members</Label>
                  <Button
                    variant="link"
                    size="sm"
                    className="h-auto p-0 text-xs"
                    onClick={selectAllUsers}
                  >
                    {bulkSelectedUsers.length === staffUsers.length
                      ? "Deselect All"
                      : "Select All"}
                  </Button>
                </div>
                <div className="border rounded-lg p-3 max-h-64 overflow-y-auto space-y-2">
                  {staffUsers.length === 0 && !isLoading && (
                    <p className="text-sm text-muted-foreground">
                      No staff users found.
                    </p>
                  )}
                  {staffUsers.map((user) => (
                    <div
                      key={user.user_id}
                      className="flex items-center space-x-2 p-2 border rounded-lg hover:bg-muted/50"
                    >
                      <Checkbox
                        id={`bulk-user-${user.user_id}`}
                        checked={bulkSelectedUsers.includes(user.user_id)}
                        onCheckedChange={() => toggleBulkUser(user.user_id)}
                      />
                      <Label
                        htmlFor={`bulk-user-${user.user_id}`}
                        className="cursor-pointer flex-1"
                      >
                        <span className="font-medium">{user.full_name}</span>
                        <span className="text-xs text-muted-foreground block">
                          {user.email}
                        </span>
                      </Label>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">
                  {bulkSelectedUsers.length} staff member(s) selected
                </p>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Select Portals</Label>
                  <Button
                    variant="link"
                    size="sm"
                    className="h-auto p-0 text-xs"
                    onClick={selectAllPortals}
                  >
                    {bulkSelectedPortals.length === availablePortals.length
                      ? "Deselect All"
                      : "Select All"}
                  </Button>
                </div>
                <div className="border rounded-lg p-3 max-h-64 overflow-y-auto space-y-2">
                  {availablePortals.map((portal) => (
                    <div
                      key={portal.id}
                      className="flex items-center space-x-2 p-2 border rounded-lg hover:bg-muted/50"
                    >
                      <Checkbox
                        id={`bulk-portal-${portal.id}`}
                        checked={bulkSelectedPortals.includes(portal.id)}
                        onCheckedChange={() => toggleBulkPortal(portal.id)}
                      />
                      <Label
                        htmlFor={`bulk-portal-${portal.id}`}
                        className="cursor-pointer flex-1"
                      >
                        {portal.title}
                      </Label>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">
                  {bulkSelectedPortals.length} portal(s) selected
                </p>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-4 border-t">
              <Button
                variant="outline"
                onClick={() => {
                  setBulkSelectedUsers([]);
                  setBulkSelectedPortals([]);
                }}
                disabled={
                  bulkSelectedUsers.length === 0 &&
                  bulkSelectedPortals.length === 0
                }
              >
                Clear Selection
              </Button>
              <Button
                onClick={handleBulkAssignment}
                disabled={
                  isSaving ||
                  bulkSelectedUsers.length === 0 ||
                  bulkSelectedPortals.length === 0
                }
              >
                <Users className="w-4 h-4 mr-2" />
                {isSaving
                  ? "Assigning..."
                  : `Assign ${bulkSelectedPortals.length} Portal(s) to ${bulkSelectedUsers.length} Staff`}
              </Button>
            </div>
          </TabsContent>
        </Tabs>
       </FormCard>
 
       <DataTable
         columns={columns}
         data={assignments}
         isLoading={isLoading}
         searchable
         searchPlaceholder="Search by name or portal..."
       />
     </div>
   );
 };
 
 export default StaffPortalAssignments;

