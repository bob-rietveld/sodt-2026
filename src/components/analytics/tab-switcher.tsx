"use client";

interface TabSwitcherProps {
  activeTab: "explore" | "consume";
  onTabChange: (tab: "explore" | "consume") => void;
}

export function TabSwitcher({ activeTab, onTabChange }: TabSwitcherProps) {
  return (
    <div className="flex items-center gap-1 p-1 bg-gray-100 rounded-lg">
      <button
        onClick={() => onTabChange("explore")}
        className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
          activeTab === "explore"
            ? "bg-white text-primary shadow-sm"
            : "text-foreground/60 hover:text-foreground/80"
        }`}
      >
        Explore
      </button>
      <button
        onClick={() => onTabChange("consume")}
        className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
          activeTab === "consume"
            ? "bg-white text-primary shadow-sm"
            : "text-foreground/60 hover:text-foreground/80"
        }`}
      >
        Dashboard
      </button>
    </div>
  );
}
