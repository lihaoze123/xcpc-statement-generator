import type { FC } from "react";

export type TabId = "description" | "input" | "output" | "notes" | "samples" | "limits";

interface TabBarProps {
  activeTab: TabId;
  onTabChange: (tab: TabId) => void;
}

const tabs: { id: TabId; label: string }[] = [
  { id: "limits", label: "限制" },
  { id: "description", label: "描述" },
  { id: "input", label: "输入" },
  { id: "output", label: "输出" },
  { id: "notes", label: "提示" },
  { id: "samples", label: "样例" },
];

const TabBar: FC<TabBarProps> = ({ activeTab, onTabChange }) => {
  return (
    <div className="flex border-b border-gray-200 px-4">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onTabChange(tab.id)}
          className={`px-4 py-3 text-sm font-medium transition-colors relative ${
            activeTab === tab.id
              ? "text-[#1D71B7]"
              : "text-gray-500 hover:text-gray-700"
          }`}
        >
          {tab.label}
          {activeTab === tab.id && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#1D71B7]" />
          )}
        </button>
      ))}
    </div>
  );
};

export default TabBar;
