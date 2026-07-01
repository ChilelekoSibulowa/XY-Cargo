import React, { useEffect, useRef, useState } from "react";
import { Sparkles, Send, X, Bot, Loader2 } from "lucide-react";
import { useCmsPage } from "@/hooks/useCmsPage";
import { cmsDefaults, CmsSupportData } from "@/content/cmsDefaults";
import { lookupTrackingDetails } from "@/lib/tracking";
import { cn } from "@/lib/utils";

type Message = {
  id: string;
  sender: "bot" | "user";
  text: string;
  timestamp: Date;
  suggestions?: string[];
};

export const SupportFloatingActions = () => {
  const { data: content } = useCmsPage<CmsSupportData>("support", cmsDefaults.support);
  const intro = { ...cmsDefaults.support.intro, ...(content.intro || {}) };
  const [isOpen, setIsOpen] = useState(false);
  const [inputText, setInputText] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      sender: "bot",
      text: "Hello. Welcome to the XY Cargo AI Assistant. How can I help you today?",
      timestamp: new Date(),
      suggestions: [
        "Track my package",
        "Shipping Rates",
        "China Warehouse Address",
        "Contact Human Support",
      ],
    },
  ]);

  const chatEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isTyping]);

  const handleSendMessage = async (textToSend: string) => {
    if (!textToSend.trim()) return;

    const userMsg: Message = {
      id: Math.random().toString(),
      sender: "user",
      text: textToSend,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputText("");
    setIsTyping(true);

    const query = textToSend.trim().toLowerCase();

    setTimeout(async () => {
      let botResponseText = "";
      let suggestions: string[] = [];

      // Check if query is likely a tracking number lookup request
      const isTrackingNumberPattern = /^[a-zA-Z0-9-]{6,15}$/.test(query.replace(/\s/g, ""));

      if (query.includes("track") || query.includes("shipment") || query.includes("package") || query === "track my package") {
        botResponseText = "Please enter your tracking number below and I will check its status in our database.";
        suggestions = ["China Warehouse Address", "Shipping Rates"];
      } else if (isTrackingNumberPattern) {
        try {
          const details = await lookupTrackingDetails(query.replace(/\s/g, "").toUpperCase());
          if (details) {
            botResponseText = `I found a shipment matching your tracking number in our system. Here are the details:
            
Status: ${details.status.replace(/_/g, " ").toUpperCase()}
Origin: ${details.origin || "Not set"}
Destination: ${details.destination || "Not set"}
Weight: ${Number(details.weight || 0).toFixed(1)} kg
Volume: ${Number(details.cbm || 0).toFixed(3)} CBM
Shipping Method: ${details.shipsgo_transport || "Standard Freight"}`;
          } else {
            botResponseText = "I could not find a local shipment record matching that tracking number. Please verify the code or contact support if you believe this is an error.";
          }
        } catch (err) {
          botResponseText = "There was an error communicating with our tracking database. Please try again later.";
        }
        suggestions = ["Contact Human Support", "Shipping Rates"];
      } else if (query.includes("rate") || query.includes("cost") || query.includes("price") || query === "shipping rates") {
        botResponseText = `Our standard shipping rates from China to Zambia are:
        
1. Standard Air Freight: $9.50 per kg (estimated delivery in 10 to 17 days)
2. Express Air Freight: $15.00 per kg (estimated delivery in 1 to 5 days)
3. Sea Freight: $280.00 per CBM (estimated delivery in 45 to 60 days)

You can use the instant calculator on our homepage to obtain precise quotes based on custom dimensions and cargo types.`;
        suggestions = ["China Warehouse Address", "Track my package"];
      } else if (query.includes("warehouse") || query.includes("address") || query.includes("china") || query === "china warehouse address") {
        botResponseText = `Our consolidation warehouses in China are located at:
        
1. Yiwu consolidation hub: Plot 12, West International Logistics Area, Yiwu, China
2. Foshan consolidation hub: Block B, Xingguang Cargo Hub, Nanhai District, Foshan, China

Please ensure that your unique XY Cargo client code is clearly marked on all packaging before delivery to our hubs.`;
        suggestions = ["Shipping Rates", "Contact Human Support"];
      } else if (query.includes("support") || query.includes("contact") || query.includes("human") || query === "contact human support") {
        botResponseText = `You can reach our customer support team directly through the following channels:
        
1. Official landline: +260 211220012
2. Support email: info@xycargozm.com
3. Physical office: Plot 26592, Kafue Road, Lusaka, Zambia`;
        suggestions = ["China Warehouse Address", "Shipping Rates"];
      } else {
        botResponseText = "I am sorry, I did not catch that. You can ask me about shipment tracking, shipping rates, consolidation warehouses, or how to contact our customer support team.";
        suggestions = ["Track my package", "Shipping Rates", "China Warehouse Address", "Contact Human Support"];
      }

      const botMsg: Message = {
        id: Math.random().toString(),
        sender: "bot",
        text: botResponseText,
        timestamp: new Date(),
        suggestions: suggestions.length > 0 ? suggestions : undefined,
      };

      setMessages((prev) => [...prev, botMsg]);
      setIsTyping(false);
    }, 850);
  };

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end">
      {/* Chat Window */}
      {isOpen && (
        <div className="mb-4 flex h-[500px] w-[360px] max-w-[calc(100vw-32px)] flex-col rounded-3xl border border-slate-200/80 bg-white shadow-2xl transition-all duration-300 animate-in slide-in-from-bottom-5">
          {/* Header */}
          <div className="flex items-center justify-between rounded-t-3xl bg-slate-900 px-5 py-4 text-white">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#d8000d] text-white shadow-inner">
                <Bot className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-extrabold tracking-wide font-satoshi uppercase">XY Cargo Assistant</p>
                <p className="text-[10px] text-slate-400 font-medium">Virtual Helpdesk</p>
              </div>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="rounded-full p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white transition"
              aria-label="Close Chat"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Messages Area */}
          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
            {messages.map((msg) => (
              <div key={msg.id} className="space-y-2">
                <div className={cn("flex w-full", msg.sender === "user" ? "justify-end" : "justify-start")}>
                  <div
                    className={cn(
                      "max-w-[85%] rounded-2xl px-4 py-3 text-xs leading-relaxed font-medium shadow-sm whitespace-pre-line border",
                      msg.sender === "user"
                        ? "bg-[#d8000d] text-white border-[#d8000d]/10 rounded-tr-none"
                        : "bg-slate-50 text-slate-800 border-slate-200/60 rounded-tl-none"
                    )}
                  >
                    {msg.text}
                  </div>
                </div>

                {/* Suggestions */}
                {msg.sender === "bot" && msg.suggestions && (
                  <div className="flex flex-wrap gap-2 pt-1">
                    {msg.suggestions.map((sug) => (
                      <button
                        key={sug}
                        onClick={() => handleSendMessage(sug)}
                        className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-[10px] font-black uppercase tracking-wider text-slate-600 transition hover:border-[#d8000d]/30 hover:bg-[#d8000d]/5 hover:text-[#d8000d]"
                      >
                        {sug}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}

            {isTyping && (
              <div className="flex justify-start">
                <div className="flex items-center gap-1 bg-slate-50 border border-slate-200/60 rounded-2xl rounded-tl-none px-4 py-3">
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-[#d8000d]" />
                  <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Assistant is writing...</span>
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          {/* Input Area */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSendMessage(inputText);
            }}
            className="flex items-center gap-2 border-t border-slate-100 p-4 bg-slate-50 rounded-b-3xl"
          >
            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="Ask a question..."
              className="flex-1 rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 placeholder-slate-400 focus:border-[#d8000d] focus:outline-none focus:ring-1 focus:ring-[#d8000d]"
            />
            <button
              type="submit"
              disabled={!inputText.trim()}
              className="flex h-9 w-9 items-center justify-center rounded-full bg-[#d8000d] text-white transition hover:bg-[#b8000b] disabled:bg-slate-200 disabled:text-slate-400"
            >
              <Send className="h-4 w-4" />
            </button>
          </form>
        </div>
      )}

      {/* Floating Sparkles Trigger Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="group relative flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-tr from-[#d8000d] via-[#ff3b30] to-[#ff6b6b] text-white shadow-lg shadow-red-500/40 border border-white/10 transition-all duration-300 hover:scale-110"
        aria-label="Toggle AI Assistant"
      >
        {/* Pulsing Outer Glow */}
        <span className="absolute -inset-1 rounded-full bg-[#d8000d]/30 opacity-70 blur-md group-hover:opacity-100 transition-all duration-300 animate-pulse" />

        {/* Inner Circle Content */}
        <span className="relative flex h-12 w-12 items-center justify-center rounded-full bg-slate-950/80 backdrop-blur-sm border border-white/10 group-hover:bg-slate-900 transition-colors">
          <Sparkles className="h-5 w-5 text-white animate-pulse" />
        </span>

        {/* Floating Tooltip */}
        {!isOpen && (
          <span className="absolute right-16 top-1/2 -translate-y-1/2 scale-75 opacity-0 origin-right transition-all duration-300 group-hover:scale-100 group-hover:opacity-100 bg-slate-950/90 text-white text-[10px] font-bold tracking-wider uppercase py-1.5 px-3 rounded-full border border-white/10 whitespace-nowrap shadow-xl">
            AI Assistant
          </span>
        )}
      </button>
    </div>
  );
};
