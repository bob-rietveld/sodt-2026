"use client";

interface Tab {
  id: string;
  label: string;
  icon?: React.ReactNode;
}

interface SettingsTabsProps {
  tabs: Tab[];
  activeTab: string;
  onTabChange: (tabId: string) => void;
}

export function SettingsTabs({ tabs, activeTab, onTabChange }: SettingsTabsProps) {
  return (
    <div className="flex items-center gap-1 bg-foreground/5 rounded-lg p-1 mb-8">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onTabChange(tab.id)}
          className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            activeTab === tab.id
              ? "bg-white text-foreground shadow-sm"
              : "text-foreground/60 hover:text-foreground"
          }`}
        >
          {tab.icon}
          {tab.label}
        </button>
      ))}
    </div>
  );
}
