import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/shared/PageHeader";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Bell, Send, Users, Check, ChevronDown, Globe, Sparkles, Smartphone, Camera, Zap } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Switch } from "@/components/ui/switch";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Badge } from "@/components/ui/badge";

type Customer = {
  id: string;
  full_name: string;
  user_id: string;
  email: string | null;
  phone: string | null;
};

const PushNotify = () => {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [targetAll, setTargetAll] = useState(true);
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [popoverOpen, setPopoverOpen] = useState(false);

  useEffect(() => {
    fetchCustomers();
  }, []);

  const fetchCustomers = async () => {
    setIsLoading(true);
    const { data, error } = await supabase
      .from("customers")
      .select("id, full_name, user_id, email, phone")
      .not("user_id", "is", null)
      .order("full_name", { ascending: true });

    if (error) {
      toast.error("Failed to load customers");
    } else {
      setCustomers(data || []);
    }
    setIsLoading(false);
  };

  const toggleCustomer = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const handleSend = async () => {
    if (!targetAll && selectedIds.length === 0) {
      toast.error("Please select at least one customer");
      return;
    }
    if (!title.trim() || !message.trim()) {
      toast.error("Title and message are required");
      return;
    }

    setIsSending(true);
    let recipients = targetAll ? customers : customers.filter(c => selectedIds.includes(c.id));
    
    if (targetAll) {
      const { data: subs, error: subsError } = await supabase
        .from("push_subscriptions")
        .select("user_id");
      
      if (!subsError && subs) {
        const userIds = Array.from(new Set(subs.map(s => s.user_id)));
        recipients = userIds.map(uid => {
          const existing = customers.find(c => c.user_id === uid);
          return existing || ({ user_id: uid, full_name: "App User", id: "" } as any);
        });
      }
    }

    if (recipients.length === 0) {
      toast.error("No customers with app installed found.");
      setIsSending(false);
      return;
    }

    let successCount = 0;
    let failCount = 0;

    for (const recipient of recipients) {
      try {
        const { error } = await supabase.functions.invoke("send-notification", {
          body: {
            customer_id: recipient.id || null,
            user_id: recipient.user_id,
            event_type: "marketing_push",
            title: title.trim(),
            message: message.trim(),
            channels: ["push", "bell"],
          },
        });
        if (error) throw error;
        successCount++;
      } catch (err) {
        failCount++;
      }
    }

    if (successCount > 0) {
      toast.success(`Successfully sent to ${successCount} devices.`);
      setTitle("");
      setMessage("");
      if (!targetAll) setSelectedIds([]);
    } else if (failCount > 0) {
      toast.error(`Failed to send notifications.`);
    }

    setIsSending(false);
  };

  return (
    <div className="animate-fade-in space-y-8 pb-16 relative">
      {/* Decorative background elements */}
      <div className="absolute top-0 right-0 -z-10 w-64 h-64 bg-primary/5 rounded-full blur-3xl opacity-50" />
      <div className="absolute bottom-40 left-20 -z-10 w-80 h-80 bg-blue-500/5 rounded-full blur-3xl opacity-30" />

      <PageHeader title="Marketing Push" />

      <div className="grid gap-10 lg:grid-cols-[1fr,300px] max-w-6xl mx-auto">
        {/* Main Campaign Form */}
        <div className="space-y-6">
          <Card className="border border-slate-200/50 shadow-xl shadow-slate-200/20 bg-white/70 backdrop-blur-xl overflow-visible">
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-amber-500" />
                    <CardTitle className="text-xl font-jakarta font-bold">New Campaign</CardTitle>
                  </div>
                </div>
                
                <div className="flex items-center gap-3 px-4 py-2 bg-slate-50 rounded-2xl border border-slate-100 transition-all hover:bg-slate-100/80">
                  <Label htmlFor="target-all" className="text-[10px] font-bold uppercase tracking-widest text-slate-400 font-jakarta cursor-pointer">Broadcast All</Label>
                  <Switch 
                    id="target-all" 
                    checked={targetAll} 
                    onCheckedChange={setTargetAll} 
                    className="data-[state=checked]:bg-primary"
                  />
                </div>
              </div>
            </CardHeader>
            
            <CardContent className="space-y-8">
              {/* Audience Section */}
              <div className="space-y-4">
                {!targetAll ? (
                  <div className="space-y-3 animate-in fade-in slide-in-from-top-2 duration-400">
                    <div className="flex items-center gap-2 mb-1">
                      <div className="h-2 w-2 rounded-full bg-blue-500 animate-pulse" />
                      <Label className="text-xs font-bold uppercase tracking-tighter text-slate-500 font-jakarta">Target Audience</Label>
                    </div>
                    
                    <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          role="combobox"
                          className="w-full justify-between h-12 bg-white/50 border-slate-200 font-jakarta rounded-xl hover:border-primary/30 hover:bg-white transition-all shadow-sm"
                        >
                          <div className="flex items-center gap-2 overflow-hidden">
                            <Users className="h-4 w-4 text-slate-400 shrink-0" />
                            <span className="truncate text-sm">
                              {selectedIds.length === 0 
                                ? "Select specific customers..." 
                                : `${selectedIds.length} customer(s) selected`}
                            </span>
                          </div>
                          <ChevronDown className="h-4 w-4 shrink-0 opacity-40" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0 shadow-2xl border-slate-200" align="start">
                        <Command className="font-jakarta">
                          <CommandInput placeholder="Search audience..." className="h-10" />
                          <CommandList className="max-h-[250px]">
                            <CommandEmpty>No matching customers.</CommandEmpty>
                            <CommandGroup>
                              {customers.map((customer) => (
                                <CommandItem
                                  key={customer.id}
                                  value={customer.full_name}
                                  onSelect={() => toggleCustomer(customer.id)}
                                  className="flex items-center justify-between py-2.5"
                                >
                                  <div className="flex flex-col gap-0.5">
                                    <span className="text-sm font-medium">{customer.full_name}</span>
                                    <span className="text-[10px] text-slate-400">{customer.phone || customer.email}</span>
                                  </div>
                                  <div className={cn(
                                    "h-5 w-5 rounded-full border flex items-center justify-center transition-all",
                                    selectedIds.includes(customer.id) ? "bg-primary border-primary" : "border-slate-200"
                                  )}>
                                    {selectedIds.includes(customer.id) && <Check className="h-3 w-3 text-white" />}
                                  </div>
                                </CommandItem>
                              ))}
                            </CommandGroup>
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>

                    {selectedIds.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 pt-1">
                        {selectedIds.slice(0, 6).map(id => {
                          const c = customers.find(cust => cust.id === id);
                          return (
                            <Badge key={id} variant="secondary" className="bg-slate-100 text-slate-600 border-none px-2 py-0.5 text-[10px] font-jakarta hover:bg-slate-200">
                              {c?.full_name}
                            </Badge>
                          );
                        })}
                        {selectedIds.length > 6 && (
                          <Badge variant="outline" className="text-[10px] border-dashed font-jakarta">
                            +{selectedIds.length - 6} more
                          </Badge>
                        )}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="p-4 bg-gradient-to-r from-primary/5 to-transparent rounded-2xl border border-primary/10 flex items-center gap-4 animate-in fade-in zoom-in-95 duration-500">
                    <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                      <Globe className="h-5 w-5 text-primary" />
                    </div>
                    <div className="space-y-0.5">
                      <p className="text-sm font-bold text-slate-800 font-jakarta">Global Broadcast Active</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Content Section */}
              <div className="space-y-6 pt-2">
                <div className="space-y-2">
                  <Label htmlFor="title" className="text-xs font-bold uppercase tracking-tighter text-slate-500 font-jakarta">Notification Title</Label>
                  <Input
                    id="title"
                    placeholder="Grab their attention (e.g. Flash Sale! ⚡)"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="h-12 bg-white/50 font-jakarta border-slate-200 focus-visible:ring-primary/10 focus-visible:border-primary/30 text-base"
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <Label htmlFor="message" className="text-xs font-bold uppercase tracking-tighter text-slate-500 font-jakarta">Message Body</Label>
                    <span className={cn("text-[10px] font-medium font-jakarta", message.length > 150 ? "text-amber-600" : "text-slate-400")}>
                      {message.length} characters
                    </span>
                  </div>
                  <Textarea
                    id="message"
                    placeholder="Enter your message details here..."
                    rows={4}
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    className="bg-white/50 font-jakarta border-slate-200 focus-visible:ring-primary/10 focus-visible:border-primary/30 resize-none text-sm leading-relaxed p-4"
                  />
                </div>
              </div>

              <div className="pt-2">
                <Button 
                  className="w-full h-14 text-base font-bold shadow-2xl shadow-primary/30 font-jakarta transition-all hover:scale-[1.02] active:scale-95 bg-primary hover:bg-primary/90 group"
                  onClick={handleSend}
                  disabled={isSending || (!targetAll && selectedIds.length === 0)}
                >
                  {isSending ? (
                    <div className="flex items-center gap-2">
                      <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      <span>Broadcasting...</span>
                    </div>
                  ) : (
                    <>
                      <Send className="mr-2 h-5 w-5 transition-transform group-hover:translate-x-1 group-hover:-translate-y-1" />
                      {targetAll ? "Deploy to All Devices" : "Send Campaign"}
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Live Phone Preview */}
        <div className="space-y-6">
          <div className="sticky top-24">
            <div className="flex items-center gap-2 mb-4 justify-center lg:justify-start">
              <Smartphone className="h-3 w-3 text-slate-400" />
              <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] font-jakarta">
                LIVE DEVICE PREVIEW
              </Label>
            </div>
            
            <div className="relative mx-auto w-[260px] h-[530px] bg-black rounded-[3rem] border-[10px] border-slate-900 shadow-[0_50px_100px_-20px_rgba(0,0,0,0.5)] overflow-hidden">
              {/* Dynamic Notch */}
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-28 h-6 bg-slate-900 rounded-b-2xl z-20 flex items-center justify-center">
                <div className="w-10 h-1 bg-white/5 rounded-full" />
              </div>

              {/* Status Bar */}
              <div className="h-7 w-full flex items-center justify-between px-7 pt-4 text-[9px] text-white font-medium font-jakarta z-10">
                <span>9:41</span>
                <div className="flex gap-1.5 items-center">
                  <Globe className="h-2.5 w-2.5 opacity-80" />
                  <Zap className="h-2.5 w-2.5 text-amber-400" />
                  <div className="h-2.5 w-4 border border-white/40 rounded-[3px] p-[1px] flex items-center">
                    <div className="h-full w-3 bg-white rounded-[1px]" />
                  </div>
                </div>
              </div>

              {/* Lock Screen Wallpaper */}
              <div className="absolute inset-0 -z-10 bg-[url('https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&q=80&w=2564')] bg-cover bg-center" />
              <div className="absolute inset-0 -z-10 bg-black/40 backdrop-blur-[2px]" />
              
              {/* Lock Screen Clock */}
              <div className="mt-8 text-center text-white space-y-0.5 opacity-90">
                <p className="text-5xl font-jakarta font-light tracking-tight">9:41</p>
                <p className="text-[10px] font-jakarta font-medium uppercase tracking-widest">Sunday, May 10</p>
              </div>

              {/* Notification Popup */}
              <div className="px-3 mt-10">
                <div className={cn(
                  "w-full bg-white/90 backdrop-blur-xl rounded-2xl shadow-2xl p-3.5 transform transition-all duration-500 cubic-bezier(0.16, 1, 0.3, 1)",
                  (title || message) ? "translate-y-0 opacity-100 scale-100" : "-translate-y-6 opacity-0 scale-90"
                )}>
                  <div className="flex items-center gap-2.5 mb-2">
                    <div className="h-7 w-7 rounded-lg bg-white flex items-center justify-center overflow-hidden shrink-0 shadow-lg shadow-black/10 border border-slate-100">
                      <img 
                        src="/icons/icon-192.png" 
                        alt="XY" 
                        className="h-full w-full object-contain" 
                        onError={(e) => {
                          e.currentTarget.src = 'https://xycargozm.com/icons/icon-192.png';
                        }}
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[9px] font-extrabold text-slate-800 uppercase tracking-tighter font-jakarta truncate">XY CARGO</span>
                        <span className="text-[9px] text-slate-500 font-jakarta font-medium">now</span>
                      </div>
                      <p className="text-[11px] font-bold text-slate-900 truncate font-jakarta mt-0.5">{title || "Your Notification Title"}</p>
                    </div>
                  </div>
                  <p className="text-[10px] leading-snug text-slate-700 font-jakarta line-clamp-3">
                    {message || "Craft your message on the left to see how it looks here. This is exactly what your customers will see."}
                  </p>
                </div>
              </div>

              {/* Lock Screen Bottom Actions */}
              <div className="absolute bottom-10 left-0 right-0 px-8 flex justify-between items-center opacity-70">
                <div className="h-10 w-10 rounded-full bg-white/10 backdrop-blur-md flex items-center justify-center">
                  <Zap className="h-4 w-4 text-white" />
                </div>
                <div className="h-10 w-10 rounded-full bg-white/10 backdrop-blur-md flex items-center justify-center">
                  <Camera className="h-4 w-4 text-white" />
                </div>
              </div>

              {/* Home Indicator */}
              <div className="absolute bottom-2 left-1/2 -translate-x-1/2 w-24 h-1 bg-white/40 rounded-full" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PushNotify;
