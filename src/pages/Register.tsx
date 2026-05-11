import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { ArrowRight, Loader2, UsersRound } from "lucide-react";
import { Logo } from "@/components/layout/Logo";
import { getRoleLandingRoute } from "@/lib/portalLanding";
import { notifyWelcome } from "@/lib/notifications";

const Register = () => {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [country, setCountry] = useState("");
  const [customerType, setCustomerType] = useState<"personal" | "company">("personal");
  const [companyName, setCompanyName] = useState("");
  const [companyRegistrationNumber, setCompanyRegistrationNumber] = useState("");
  const [companyEmail, setCompanyEmail] = useState("");
  const [companyPhone, setCompanyPhone] = useState("");
  const [companyAddress, setCompanyAddress] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    const normalizedEmail = email.trim().toLowerCase();

    const { data: existingProfile } = await supabase
      .from("profiles")
      .select("user_id")
      .ilike("email", normalizedEmail)
      .maybeSingle();

    if (existingProfile?.user_id) {
      toast.error("An account with this email already exists.");
      setIsLoading(false);
      return;
    }

    const { data, error } = await supabase.auth.signUp({
      email: normalizedEmail,
      password,
      options: {
        data: {
          full_name: fullName,
          phone,
          address,
          city,
          country,
          customer_type: customerType,
          company_name: customerType === "company" ? companyName : null,
          company_registration_number: customerType === "company" ? companyRegistrationNumber : null,
          company_email: customerType === "company" ? companyEmail : null,
          company_phone: customerType === "company" ? companyPhone : null,
          company_address: customerType === "company" ? companyAddress : null,
          requested_role: "customer",
        },
        emailRedirectTo: window.location.origin,
      },
    });

    if (error) {
      toast.error(error.message);
      setIsLoading(false);
      return;
    }

    if (data.session?.user) {
      toast.success("Customer account created.");
      const { data: custRecord } = await supabase
        .from("customers")
        .select("id")
        .eq("user_id", data.session.user.id)
        .maybeSingle();
      if (custRecord?.id) {
        notifyWelcome(custRecord.id, fullName);
      }
      navigate(getRoleLandingRoute("customer"), { replace: true });
    } else {
      toast.success("Customer account created. You can now sign in.");
      navigate("/login?portal=customer", { replace: true });
    }

    setIsLoading(false);
  };

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-white">
      {/* Left Side: Brand Panel */}
      <div className="hidden md:flex md:w-1/2 lg:w-[60%] relative bg-slate-900 overflow-hidden">
        <div className="absolute inset-0 bg-[#d8000d]/10 z-10" />
        <img
          src="https://images.unsplash.com/photo-1578575437130-527eed3abbec?q=80&w=2070&auto=format&fit=crop"
          alt="Logistics Network"
          className="absolute inset-0 w-full h-full object-cover opacity-60 scale-105"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/40 to-transparent z-20" />
        
        <div className="relative z-30 flex flex-col justify-between p-12 lg:p-20 h-full w-full">
          <div className="flex items-center gap-3">
            <div className="bg-white p-2 rounded-xl shadow-lg">
              <Logo className="[&_span]:hidden" />
            </div>
            <span className="text-2xl font-extrabold text-white tracking-tight">XY Cargo Zambia</span>
          </div>
          
          <div className="space-y-6">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-2 text-xs font-bold uppercase tracking-wider text-white">
              <UsersRound className="h-4 w-4" />
              <span>Customer Onboarding</span>
            </div>
            <h2 className="text-4xl lg:text-6xl font-extrabold text-white leading-[1.1] tracking-tight">
              Join the Leading <br />
              <span className="text-[#d8000d]">Logistics Network</span>
            </h2>
            <p className="text-lg text-slate-300 max-w-lg leading-relaxed font-medium">
              Create your account today and experience seamless freight management, competitive rates, and dedicated support for all your shipping needs.
            </p>
          </div>
          
          <div className="flex items-center gap-8 text-sm font-medium text-slate-400">
            <div className="flex flex-col gap-1">
              <span className="text-2xl font-bold text-white">5K+</span>
              <span>Active Users</span>
            </div>
            <div className="w-px h-10 bg-white/10" />
            <div className="flex flex-col gap-1">
              <span className="text-2xl font-bold text-white">50+</span>
              <span>Countries</span>
            </div>
            <div className="w-px h-10 bg-white/10" />
            <div className="flex flex-col gap-1">
              <span className="text-2xl font-bold text-white">24/7</span>
              <span>Support</span>
            </div>
          </div>
        </div>
      </div>

      {/* Right Side: Registration Form */}
      <div className="flex-1 flex flex-col items-center justify-center p-8 md:p-12 lg:p-20">
        <div className="w-full max-w-[440px] space-y-10">
          <div className="md:hidden flex justify-center mb-10">
             <div className="flex items-center gap-3">
              <Logo className="[&_span]:hidden" />
              <span className="text-xl font-extrabold text-slate-900 tracking-tight">XY Cargo Zambia</span>
            </div>
          </div>

          <div className="space-y-3 text-left">
            <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">Create Account</h1>
          </div>

          <div className="space-y-8">
            <form onSubmit={handleRegister} className="space-y-5">
              <div className="space-y-4 mb-6">
                <Label className="text-xs font-bold uppercase tracking-widest text-slate-500">Account Type</Label>
                <div className="grid grid-cols-2 gap-4">
                  <button
                    type="button"
                    onClick={() => setCustomerType("personal")}
                    className={cn(
                      "h-14 rounded-2xl border-2 transition-all font-bold flex items-center justify-center gap-2",
                      customerType === "personal" 
                        ? "border-[#d8000d] bg-[#d8000d]/5 text-[#d8000d]" 
                        : "border-slate-100 bg-slate-50 text-slate-400 hover:border-slate-200"
                    )}
                  >
                    Personal
                  </button>
                  <button
                    type="button"
                    onClick={() => setCustomerType("company")}
                    className={cn(
                      "h-14 rounded-2xl border-2 transition-all font-bold flex items-center justify-center gap-2",
                      customerType === "company" 
                        ? "border-[#d8000d] bg-[#d8000d]/5 text-[#d8000d]" 
                        : "border-slate-100 bg-slate-50 text-slate-400 hover:border-slate-200"
                    )}
                  >
                    Company
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="fullName" className="text-xs font-bold uppercase tracking-widest text-slate-500">Full Name <span className="text-[#d8000d]">*</span></Label>
                <Input
                  id="fullName"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Enter your full name"
                  className="h-14 px-5 rounded-2xl bg-slate-50 border-slate-100 focus:bg-white transition-all text-base font-medium"
                  required
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-xs font-bold uppercase tracking-widest text-slate-500">Email Address <span className="text-[#d8000d]">*</span></Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@example.com"
                    className="h-14 px-5 rounded-2xl bg-slate-50 border-slate-100 focus:bg-white transition-all text-base font-medium"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="phone" className="text-xs font-bold uppercase tracking-widest text-slate-500">Phone Number <span className="text-[#d8000d]">*</span></Label>
                  <Input
                    id="phone"
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="e.g. 0977123456"
                    className="h-14 px-5 rounded-2xl bg-slate-50 border-slate-100 focus:bg-white transition-all text-base font-medium"
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="address" className="text-xs font-bold uppercase tracking-widest text-slate-500">Residential Address <span className="text-[#d8000d]">*</span></Label>
                <Input
                  id="address"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Enter your street address"
                  className="h-14 px-5 rounded-2xl bg-slate-50 border-slate-100 focus:bg-white transition-all text-base font-medium"
                  required
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="city" className="text-xs font-bold uppercase tracking-widest text-slate-500">City <span className="text-[#d8000d]">*</span></Label>
                  <Input
                    id="city"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    placeholder="e.g. Lusaka"
                    className="h-14 px-5 rounded-2xl bg-slate-50 border-slate-100 focus:bg-white transition-all text-base font-medium"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="country" className="text-xs font-bold uppercase tracking-widest text-slate-500">Country <span className="text-[#d8000d]">*</span></Label>
                  <Input
                    id="country"
                    value={country}
                    onChange={(e) => setCountry(e.target.value)}
                    placeholder="e.g. Zambia"
                    className="h-14 px-5 rounded-2xl bg-slate-50 border-slate-100 focus:bg-white transition-all text-base font-medium"
                    required
                  />
                </div>
              </div>

              {customerType === "company" && (
                <div className="space-y-5 pt-4 border-t border-slate-100 animate-in fade-in slide-in-from-top-4 duration-300">
                  <div className="space-y-1">
                    <h3 className="text-sm font-bold text-slate-900">Company Details</h3>
                    <p className="text-xs text-slate-500">Please provide your business information</p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="companyName" className="text-xs font-bold uppercase tracking-widest text-slate-500">Company Name <span className="text-[#d8000d]">*</span></Label>
                      <Input
                        id="companyName"
                        value={companyName}
                        onChange={(e) => setCompanyName(e.target.value)}
                        placeholder="Enter company name"
                        className="h-14 px-5 rounded-2xl bg-slate-50 border-slate-100 focus:bg-white transition-all text-base font-medium"
                        required={customerType === "company"}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="companyReg" className="text-xs font-bold uppercase tracking-widest text-slate-500">Registration Number <span className="text-[#d8000d]">*</span></Label>
                      <Input
                        id="companyReg"
                        value={companyRegistrationNumber}
                        onChange={(e) => setCompanyRegistrationNumber(e.target.value)}
                        placeholder="Reg. Number"
                        className="h-14 px-5 rounded-2xl bg-slate-50 border-slate-100 focus:bg-white transition-all text-base font-medium"
                        required={customerType === "company"}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="companyEmail" className="text-xs font-bold uppercase tracking-widest text-slate-500">Company Email <span className="text-[#d8000d]">*</span></Label>
                      <Input
                        id="companyEmail"
                        type="email"
                        value={companyEmail}
                        onChange={(e) => setCompanyEmail(e.target.value)}
                        placeholder="business@example.com"
                        className="h-14 px-5 rounded-2xl bg-slate-50 border-slate-100 focus:bg-white transition-all text-base font-medium"
                        required={customerType === "company"}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="companyPhone" className="text-xs font-bold uppercase tracking-widest text-slate-500">Company Phone <span className="text-[#d8000d]">*</span></Label>
                      <Input
                        id="companyPhone"
                        type="tel"
                        value={companyPhone}
                        onChange={(e) => setCompanyPhone(e.target.value)}
                        placeholder="Company phone"
                        className="h-14 px-5 rounded-2xl bg-slate-50 border-slate-100 focus:bg-white transition-all text-base font-medium"
                        required={customerType === "company"}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="companyAddress" className="text-xs font-bold uppercase tracking-widest text-slate-500">Company Address <span className="text-[#d8000d]">*</span></Label>
                    <Input
                      id="companyAddress"
                      value={companyAddress}
                      onChange={(e) => setCompanyAddress(e.target.value)}
                      placeholder="Enter company registered address"
                      className="h-14 px-5 rounded-2xl bg-slate-50 border-slate-100 focus:bg-white transition-all text-base font-medium"
                      required={customerType === "company"}
                    />
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="password" className="text-xs font-bold uppercase tracking-widest text-slate-500">Password <span className="text-[#d8000d]">*</span></Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Min. 6 characters"
                  className="h-14 px-5 rounded-2xl bg-slate-50 border-slate-100 focus:bg-white transition-all text-base font-medium"
                  minLength={6}
                  required
                />
              </div>

              <Button type="submit" className="h-14 w-full rounded-2xl bg-[#d8000d] hover:bg-[#bf000c] text-lg font-bold text-white shadow-lg shadow-[#d8000d]/20 transition-all active:scale-[0.98] mt-4" disabled={isLoading}>
                {isLoading ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : null}
                Create My Account
              </Button>
            </form>

            <div className="pt-4 text-center space-y-6">
              <div className="relative">
                <div className="absolute inset-0 flex items-center"><span className="w-full border-t border-slate-100"></span></div>
                <div className="relative flex justify-center text-xs font-bold uppercase tracking-widest"><span className="bg-white px-4 text-slate-400">Already a Member?</span></div>
              </div>
              
              <Button variant="ghost" asChild className="h-auto px-0 text-[#d8000d] hover:text-[#bf000c] hover:bg-transparent font-bold">
                <Link to="/login?portal=customer" className="flex items-center gap-2">
                  Sign in to your account
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Register;
