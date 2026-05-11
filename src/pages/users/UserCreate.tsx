import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { FormCard } from "@/components/shared/FormCard";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { appRoleOptions } from "@/lib/userAccess";
import { toast } from "sonner";

const UserCreate = () => {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [form, setForm] = useState({
    full_name: "",
    email: "",
    password: "",
    confirmPassword: "",
    phone: "",
    role: "customer",
  });

  const handleSubmit = async () => {
    const trimmedFullName = form.full_name.trim();
    const trimmedEmail = form.email.trim();
    const trimmedPhone = form.phone.trim();

    if (!trimmedFullName || !trimmedEmail || !form.password) {
      toast.error("Please fill in all required fields");
      return;
    }

    if (form.password.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }

    if (form.password !== form.confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }

    setIsLoading(true);

    try {
      // Call the edge function to create user with admin privileges
      const { error } = await supabase.functions.invoke("admin-create-user", {
        body: {
          email: trimmedEmail,
          password: form.password,
          full_name: trimmedFullName,
          phone: trimmedPhone || undefined,
          role: form.role,
        },
      });

      if (error) {
        let message = error.message || "Failed to create user";
        const response = (error as any).context;
        if (response instanceof Response) {
          try {
            const payload = await response.json();
            if (payload && (payload.error || payload.message)) {
              message = payload.error || payload.message;
            }
          } catch {
            // Keep original message
          }
        }
        throw new Error(message);
      }

      toast.success("User created successfully");
      navigate("/users");
    } catch (error: any) {
      console.error("User creation error:", error);
      toast.error(error.message || "Failed to create user");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <FormCard
      title="Create New User"
      
      backLink="/users"
      onSubmit={handleSubmit}
      isLoading={isLoading}
    >
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="full_name">Full Name *</Label>
          <Input
            id="full_name"
            value={form.full_name}
            onChange={(e) => setForm({ ...form, full_name: e.target.value })}
            placeholder="John Doe"
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="email">Email *</Label>
          <Input
            id="email"
            type="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            placeholder="john@example.com"
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="password">Password *</Label>
          <Input
            id="password"
            type="password"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            placeholder="********"
            required
          />
          <p className="text-xs text-muted-foreground">Minimum 6 characters</p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="confirmPassword">Confirm Password *</Label>
          <Input
            id="confirmPassword"
            type="password"
            value={form.confirmPassword}
            onChange={(e) => setForm({ ...form, confirmPassword: e.target.value })}
            placeholder="********"
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="phone">Phone</Label>
          <Input
            id="phone"
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
            placeholder="+260 xxx xxx xxx"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="role">Role *</Label>
          <Select value={form.role} onValueChange={(value) => setForm({ ...form, role: value })}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {appRoleOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            This determines what features the user can access
          </p>
        </div>
      </div>
    </FormCard>
  );
};

export default UserCreate;

