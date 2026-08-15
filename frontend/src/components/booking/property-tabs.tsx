// lapa-casa-hostel/frontend/src/components/booking/property-tabs.tsx

"use client";

import React, { useState } from 'react';

interface PropertyTabsProps {
  locale?: string;
  hostelLabel: string;
  apartmentsLabel: string;
  children: [React.ReactNode, React.ReactNode];
}

export const PropertyTabs: React.FC<PropertyTabsProps> = ({
  hostelLabel,
  apartmentsLabel,
  children,
}) => {
  const [activeTab, setActiveTab] = useState<0 | 1>(0);

  const tabs = [
    { label: hostelLabel, icon: '🛏️' },
    { label: apartmentsLabel, icon: '🏠' },
  ];

  return (
    <section className="w-full max-w-5xl mx-auto px-4 py-8">
      {/* Tab bar */}
      <div className="flex gap-2 border-b border-border mb-8">
        {tabs.map((tab, i) => {
          const active = activeTab === i;
          return (
            <button
              key={i}
              onClick={() => setActiveTab(i as 0 | 1)}
              className={`
                flex items-center gap-2 px-5 py-3 text-sm font-semibold transition-all
                border-b-2 -mb-px rounded-t-lg
                ${active
                  ? 'border-primary text-primary bg-primary/5'
                  : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'}
              `}
              aria-selected={active}
              role="tab"
            >
              <span className="text-base">{tab.icon}</span>
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab panels — always mounted to preserve form state */}
      <div role="tabpanel" className={activeTab === 0 ? 'block' : 'hidden'}>
        {children[0]}
      </div>
      <div role="tabpanel" className={activeTab === 1 ? 'block' : 'hidden'}>
        {children[1]}
      </div>
    </section>
  );
};
