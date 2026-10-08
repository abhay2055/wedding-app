export interface TabItem {
  key: string;
  label: string;
}

export function Tabs({ tabs, active, onChange }: { tabs: TabItem[]; active: string; onChange: (key: string) => void }) {
  return (
    <div className="border-b border-neutral-200">
      <nav className="-mb-px flex gap-6 overflow-x-auto" aria-label="Tabs">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => onChange(tab.key)}
            className={`whitespace-nowrap border-b-2 px-1 py-3 text-sm font-medium ${
              active === tab.key
                ? "border-brand-600 text-brand-700"
                : "border-transparent text-neutral-500 hover:border-neutral-300 hover:text-neutral-700"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </nav>
    </div>
  );
}
