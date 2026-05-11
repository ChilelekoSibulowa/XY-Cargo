import { Globe2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

const languages = [
  { name: "English", status: "Active" },
  { name: "French", status: "In rollout" },
  { name: "Portuguese", status: "Planned" },
  { name: "Swahili", status: "Planned" },
];

const currencies = [
  "ZMW",
  "USD",
  "EUR",
  "GBP",
  "ZAR",
];

const Language = () => {
  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-10 px-6 py-14">
      <div className="space-y-3">
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-500">Language</p>
        <h1 className="text-3xl font-semibold text-slate-900 md:text-4xl">
          Multi-language and multi-currency support.
        </h1>
        <p className="text-sm text-slate-600 md:text-base">
          Serve customers across regions with localized experiences and currency conversion.
        </p>
      </div>

      <div className="grid gap-5 md:grid-cols-2">
        <Card className="border-slate-200/70 bg-white">
          <CardContent className="space-y-4 p-6">
            <div className="flex items-center gap-2 text-slate-900">
              <Globe2 className="h-5 w-5" />
              <h2 className="text-lg font-semibold">Languages</h2>
            </div>
            <div className="space-y-3 text-sm text-slate-600">
              {languages.map((language) => (
                <div key={language.name} className="flex items-center justify-between">
                  <span>{language.name}</span>
                  <span className="rounded-full border border-slate-200 px-2 py-1 text-xs text-slate-600">
                    {language.status}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200/70 bg-white">
          <CardContent className="space-y-4 p-6">
            <h2 className="text-lg font-semibold text-slate-900">Currencies</h2>
            <div className="flex flex-wrap gap-2 text-sm text-slate-600">
              {currencies.map((currency) => (
                <span key={currency} className="rounded-full border border-slate-200 px-3 py-1">
                  {currency}
                </span>
              ))}
            </div>
            <p className="text-xs text-slate-500">
              Currency conversion and invoice localization are available to registered customers.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Language;
