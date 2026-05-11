import { Smartphone, QrCode } from "lucide-react";

const MobileOnly = () => {
  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center px-6 text-center">
      {/* Glowing background blob */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-[#d8000d]/10 blur-[120px]" />
      </div>

      <div className="relative z-10 max-w-md w-full space-y-10">
        {/* Logo / Brand */}
        <div className="flex flex-col items-center gap-4">
          <div className="w-20 h-20 rounded-3xl bg-[#d8000d] flex items-center justify-center shadow-2xl shadow-[#d8000d]/30">
            <Smartphone className="w-10 h-10 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-extrabold text-white tracking-tight">XY Cargo</h1>
            <p className="text-slate-400 text-sm font-medium mt-1">Zambia's Leading Freight Partner</p>
          </div>
        </div>

        {/* Message */}
        <div className="space-y-4">
          <div className="bg-white/5 border border-white/10 rounded-3xl p-8 backdrop-blur-sm space-y-5">
            <div className="w-14 h-14 rounded-2xl bg-white/10 flex items-center justify-center mx-auto">
              <QrCode className="w-7 h-7 text-slate-300" />
            </div>
            <h2 className="text-xl font-bold text-white">Mobile App Only</h2>
            <p className="text-slate-400 text-sm leading-relaxed">
              The <span className="text-white font-semibold">XY Cargo</span> portal is designed exclusively for mobile devices.
              Please open this app on your <span className="text-[#d8000d] font-semibold">Android or iOS phone</span> to continue.
            </p>
          </div>
        </div>

        {/* Download hint */}
        <div className="space-y-3">
          <p className="text-xs text-slate-500 uppercase tracking-widest font-bold">Get the App</p>
          <div className="flex flex-col gap-3">
            <a
              href="https://play.google.com/store"
              target="_blank"
              rel="noreferrer"
              className="flex items-center justify-center gap-3 h-14 rounded-2xl bg-white/5 border border-white/10 text-white font-semibold text-sm hover:bg-white/10 transition-colors"
            >
              <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
                <path d="M3.18 23.76A1.5 1.5 0 0 1 2 22.36V1.64a1.5 1.5 0 0 1 2.26-1.3l18 10.36a1.5 1.5 0 0 1 0 2.6l-18 10.36a1.5 1.5 0 0 1-1.08.1z" />
              </svg>
              Download on Google Play
            </a>
          </div>
        </div>

        <p className="text-xs text-slate-600">
          © 2025 XY Cargo Zambia. All rights reserved.
        </p>
      </div>
    </div>
  );
};

export default MobileOnly;
