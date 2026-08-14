"use client";

import { useState, type ReactNode } from "react";
import { FileTextIcon, SparklesIcon, TemplatesIcon } from "@/components/Icons";

const tabs = [
  { label: "Overview", icon: TemplatesIcon },
  { label: "Content Setup", icon: FileTextIcon },
  { label: "Generation", icon: SparklesIcon },
  { label: "Pages", icon: FileTextIcon },
] as const;
type Tab = (typeof tabs)[number];

export function SiteConsoleTabs({ children }: { children: ReactNode[] }) {
  const [activeTab, setActiveTab] = useState<Tab>(tabs[0]);

  return (
    <div>
      <div className="sticky top-16 z-20 -mx-4 mb-5 bg-[#F8FAFC]/95 px-4 py-1 backdrop-blur sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
        <div className="grid w-full grid-cols-4 gap-2" role="tablist" aria-label="Site console sections">
          {tabs.map((tab) => {
            const selected = activeTab.label === tab.label;
            const Icon = tab.icon;
            return (
              <button
                key={tab.label}
                type="button"
                role="tab"
                aria-selected={selected}
                aria-controls={`site-console-panel-${tab.label.toLowerCase().replaceAll(" ", "-")}`}
                onClick={() => setActiveTab(tab)}
                className={`flex h-12 min-w-0 items-center justify-center gap-3 rounded-xl border px-4 text-sm font-medium transition-all duration-200 sm:px-5 ${selected ? "border-primary/30 bg-[#EEF2FF] text-primary shadow-[0_2px_5px_rgba(79,70,229,0.12)]" : "border-[#E5E7EB] bg-white text-dim shadow-[0_1px_3px_rgba(16,24,40,0.06)] hover:border-primary/30 hover:bg-primary/5 hover:text-primary"}`}
              >
                <Icon size={15} />
                <span className="truncate">{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {tabs.map((tab, index) => {
        const selected = activeTab.label === tab.label;
        return (
          <div key={tab.label} id={`site-console-panel-${tab.label.toLowerCase().replaceAll(" ", "-")}`} role="tabpanel" aria-hidden={!selected} className={selected ? "" : "hidden"}>
            {children[index]}
          </div>
        );
      })}
    </div>
  );
}
