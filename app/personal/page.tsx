'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { executePersonalRule } from '@/lib/ajo/rules';
import { PersonalAllocation } from '@/lib/ajo/types';

type FieldDef = {
  type: 'percentage' | 'fixed' | 'remainder';
  value?: string;
  destination: string;
  valueLabel?: string;
  destLabel?: string;
  name: string;
  pocketType: 'flexible' | 'locked' | 'target';
  lockedUntil?: string;
  targetAmount?: string;
};

type TemplateDef = {
  id: string;
  name: string;
  description: string;
} & (
  | { type: 'executable'; defaultName: string; defaultFields: FieldDef[] }
  | { type: 'roadmap'; preview: { purpose: string; policy: string[] } }
  | { type: 'link'; href: string; actionLabel: string }
);

const TEMPLATE_CATEGORIES: { category: string; templates: TemplateDef[] }[] = [
  {
    category: 'Personal / Family',
    templates: [
      {
        id: 'personal_budget',
        name: 'Personal Budget',
        description: 'Plan your monthly money.',
        type: 'executable',
        defaultName: 'Monthly Money Plan',
        defaultFields: [
          { type: 'percentage', value: '20', destination: 'Savings', name: 'Emergency Fund', pocketType: 'target', valueLabel: 'How much should go to Savings?' },
          { type: 'fixed', value: '10', destination: 'Giving', name: 'Charity', pocketType: 'flexible', valueLabel: 'How much should go to Giving?' },
          { type: 'remainder', destination: 'Spending', name: 'Daily Spend', pocketType: 'flexible', destLabel: 'Where should the rest go?' }
        ]
      },
      {
        id: 'family_support',
        name: 'Family Support',
        description: 'Set aside money for the people you support.',
        type: 'executable',
        defaultName: 'Mum\'s Monthly Support',
        defaultFields: [
          { type: 'fixed', value: '20', destination: 'Mum', name: 'Mum Support', pocketType: 'flexible', valueLabel: 'How much should be set aside?', destLabel: 'Who should receive it?' },
          { type: 'remainder', destination: 'My spending', name: 'My Money', pocketType: 'flexible', destLabel: 'Where should the rest go?' }
        ]
      }
    ]
  },
  {
    category: 'Group / Purpose',
    templates: [
      {
        id: 'class_contribution',
        name: 'Class Contribution',
        description: 'Collect contributions toward a common target.',
        type: 'roadmap',
        preview: {
          purpose: 'Class Dinner Contribution',
          policy: [
            'People can contribute different amounts',
            'Contributions are tracked',
            'A target can be set',
            'A release date can be specified',
            'Funds can be released to a configured destination when conditions are met'
          ]
        }
      },
      {
        id: 'birthday_wedding',
        name: 'Birthday / Wedding',
        description: 'Collect contributions for a named event.',
        type: 'roadmap',
        preview: {
          purpose: 'My Sister\'s Wedding',
          policy: [
            'Collect contributions for a named event, keep a record of who contributed, and release the collected funds according to the configured date/conditions.'
          ]
        }
      },
      {
        id: 'burial_emergency',
        name: 'Burial / Emergency',
        description: 'Collect contributions toward a family emergency.',
        type: 'roadmap',
        preview: {
          purpose: 'Uncle\'s Burial Fund',
          policy: [
            'Collect contributions toward a family emergency or burial fund and release the funds according to the configured target/date policy.'
          ]
        }
      },
      {
        id: 'church_project',
        name: 'Church / Project Fund',
        description: 'Collect contributions toward a named project.',
        type: 'roadmap',
        preview: {
          purpose: 'Church Building Project',
          policy: [
            'Collect contributions toward a named project, track contributions, and release funds when the configured conditions are satisfied.'
          ]
        }
      }
    ]
  },
  {
    category: 'Structured',
    templates: [
      {
        id: 'rotating_ajo',
        name: 'Rotating Ajo',
        description: 'Recurring contributions with a rotating payout order.',
        type: 'link',
        href: '/ajo',
        actionLabel: 'View Live Ajo Demo'
      },
      {
        id: 'custom',
        name: 'Custom',
        description: 'Describe the purpose and create a policy from a guided template.',
        type: 'executable',
        defaultName: 'Custom Policy',
        defaultFields: [
          { type: 'percentage', value: '50', destination: 'Goal 1', name: 'Main Goal', pocketType: 'target', valueLabel: 'Percentage allocation', destLabel: 'Destination' },
          { type: 'remainder', destination: 'Remainder', name: 'Leftover', pocketType: 'flexible', destLabel: 'Where should the rest go?' }
        ]
      }
    ]
  }
];

const ALL_TEMPLATES = TEMPLATE_CATEGORIES.flatMap(c => c.templates);

export default function PersonalPage() {
  const [selectedTemplateId, setSelectedTemplateId] = useState(ALL_TEMPLATES[0].id);
  const [balance, setBalance] = useState('100');
  const [policyName, setPolicyName] = useState((ALL_TEMPLATES[0] as Extract<TemplateDef, { type: 'executable' }>).defaultName);
  
  const [allocations, setAllocations] = useState<FieldDef[]>((ALL_TEMPLATES[0] as Extract<TemplateDef, { type: 'executable' }>).defaultFields);

  const handleTemplateSelect = (templateId: string) => {
    setSelectedTemplateId(templateId);
    const tmpl = ALL_TEMPLATES.find(t => t.id === templateId);
    if (tmpl && tmpl.type === 'executable') {
      setPolicyName(tmpl.defaultName);
      setAllocations(tmpl.defaultFields);
    }
  };

  const selectedTemplate = ALL_TEMPLATES.find(t => t.id === selectedTemplateId)!;

  // Live calculation using pure helper from rules engine
  const plan = useMemo(() => {
    if (!balance || isNaN(Number(balance)) || Number(balance) < 0) {
      return { destinations: [], error: 'Invalid balance' };
    }
    // Map UI FieldDef to PersonalAllocation for the engine
    const engineAllocations: PersonalAllocation[] = allocations.map(a => ({
      type: a.type,
      value: a.value,
      destination: a.destination || 'Unnamed'
    }));
    return executePersonalRule(balance, engineAllocations);
  }, [balance, allocations]);

  const handleRuleChange = (index: number, field: keyof FieldDef, value: string) => {
    const newAllocations = [...allocations];
    newAllocations[index] = { ...newAllocations[index], [field]: value };
    setAllocations(newAllocations);
  };

  const addCustomField = () => {
    setAllocations([...allocations.slice(0, -1), { type: 'percentage', value: '10', destination: 'Goal', name: 'New Pocket', pocketType: 'flexible', valueLabel: 'Percentage allocation', destLabel: 'Destination' }, allocations[allocations.length - 1]]);
  };

  return (
    <div className="w-full max-w-5xl mx-auto py-8 px-4 sm:px-6">
      <div className="mb-8">
        <Link href="/" className="text-primary hover:underline text-sm mb-4 inline-block font-semibold">
          &larr; Back to Home
        </Link>
        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-foreground">Personal Money Policy</h1>
        <p className="text-lg text-muted-foreground mt-2 font-medium">
          Tell your money where to go.
        </p>
      </div>

      <div className="grid lg:grid-cols-12 gap-8">
        <div className="lg:col-span-7 space-y-12">
          
          {/* 1. Entry / Template Selection */}
          <section>
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-foreground mb-2">What are you planning for?</h2>
              <p className="text-sm text-muted-foreground font-medium">
                One engine, many real-life money purposes. Personal budgets. Family support. Group contributions. Community projects. Ajo.
              </p>
            </div>
            
            <div className="space-y-8">
              {TEMPLATE_CATEGORIES.map(cat => (
                <div key={cat.category}>
                  <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground mb-3">{cat.category}</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {cat.templates.map(t => (
                      <button
                        key={t.id}
                        onClick={() => handleTemplateSelect(t.id)}
                        className={`p-4 rounded-xl border text-left transition-all ${
                          selectedTemplateId === t.id 
                            ? 'border-primary bg-primary/10 ring-1 ring-primary' 
                            : 'border-border bg-card hover:border-primary/50'
                        }`}
                      >
                        <div className="font-bold text-foreground">{t.name}</div>
                        <div className="text-xs text-muted-foreground mt-1 leading-snug">{t.description}</div>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>

        {/* Dynamic Right Side panel based on selected template type */}
        <div className="lg:col-span-5 flex flex-col gap-6">
          
          {selectedTemplate.type === 'roadmap' && (
            <div className="bg-card border border-border p-6 rounded-2xl shadow-sm text-center sticky top-8">
              <div className="inline-flex h-6 items-center rounded-full bg-muted px-3 text-xs font-bold text-muted-foreground uppercase tracking-wide mb-6">
                Shared Goal — Coming Next
              </div>
              <h3 className="text-xl font-bold mb-4 text-foreground">Purpose: {selectedTemplate.preview.purpose}</h3>
              <div className="text-left bg-background p-4 rounded-xl border border-border mt-4 text-sm font-medium space-y-2">
                <p className="text-muted-foreground font-bold uppercase tracking-wider text-xs mb-3">Policy Preview</p>
                <ul className="space-y-3">
                  {selectedTemplate.preview.policy.map((p, i) => (
                    <li key={i} className="flex gap-3 text-foreground items-start">
                      <svg className="w-4 h-4 text-primary shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                      <span className="leading-snug">{p}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {selectedTemplate.type === 'link' && (
            <div className="bg-card border border-border p-8 rounded-2xl shadow-sm flex flex-col items-center justify-center py-16 sticky top-8 text-center">
              <h3 className="text-2xl font-bold text-foreground mb-2">{selectedTemplate.name}</h3>
              <p className="text-muted-foreground font-medium mb-8 text-sm">{selectedTemplate.description}</p>
              <Link href={selectedTemplate.href} className="px-6 py-3 bg-primary text-primary-foreground font-bold rounded-xl hover:bg-primary/90 transition-colors w-full sm:w-auto">
                {selectedTemplate.actionLabel}
              </Link>
            </div>
          )}

          {selectedTemplate.type === 'executable' && (
            <div className="flex flex-col gap-6 sticky top-8">
              
              {/* Guided Rule Form (The Questions) */}
              <section className="bg-card border border-border p-6 rounded-2xl shadow-sm">
                <div className="mb-6">
                  <label className="block text-sm font-bold text-foreground mb-2">Name this policy</label>
                  <input 
                    type="text" 
                    value={policyName}
                    onChange={(e) => setPolicyName(e.target.value)}
                    className="w-full p-3 rounded-xl border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/50 font-semibold transition-shadow"
                  />
                </div>
                
                <div className="mb-8">
                  <label className="block text-sm font-bold text-foreground mb-2">Available balance</label>
                  <div className="relative">
                    <input 
                      type="number" 
                      value={balance}
                      onChange={(e) => setBalance(e.target.value)}
                      className="w-full p-4 rounded-xl border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/50 text-xl font-bold transition-shadow"
                    />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground font-bold text-lg">XLM</span>
                  </div>
                </div>

                <div className="space-y-4">
                  {allocations.map((alloc, idx) => (
                    <div key={idx} className="p-5 rounded-xl bg-background border border-border flex flex-col gap-4 transition-all duration-300 hover:border-primary/30">
                      
                      <div className="flex flex-col sm:flex-row gap-4">
                        <div className="flex-1">
                          <label className="block text-sm font-semibold text-muted-foreground mb-2">Pocket Name</label>
                          <input
                            type="text"
                            value={alloc.name}
                            onChange={(e) => handleRuleChange(idx, 'name', e.target.value)}
                            className="w-full p-3 text-base rounded-xl bg-card border border-border focus:outline-none focus:border-primary font-bold transition-colors"
                            placeholder="e.g. Rent, Vacation"
                          />
                        </div>
                        <div className="flex-1">
                          <label className="block text-sm font-semibold text-muted-foreground mb-2">Type</label>
                          <select
                            value={alloc.pocketType}
                            onChange={(e) => handleRuleChange(idx, 'pocketType', e.target.value as any)}
                            className="w-full p-3 text-base rounded-xl bg-card border border-border focus:outline-none focus:border-primary font-bold transition-colors appearance-none"
                          >
                            <option value="flexible">Flexible</option>
                            <option value="locked">Locked</option>
                            <option value="target">Target</option>
                          </select>
                        </div>
                        
                        {alloc.pocketType === 'locked' && (
                          <div className="flex-1">
                            <label className="block text-sm font-semibold text-muted-foreground mb-2">Lock until</label>
                            <input
                              type="date"
                              value={alloc.lockedUntil || ''}
                              onChange={(e) => handleRuleChange(idx, 'lockedUntil', e.target.value)}
                              className="w-full p-3 text-base rounded-xl bg-card border border-border focus:outline-none focus:border-primary font-bold transition-colors"
                            />
                          </div>
                        )}
                        
                        {alloc.pocketType === 'target' && (
                          <div className="flex-1">
                            <label className="block text-sm font-semibold text-muted-foreground mb-2">Target amount</label>
                            <div className="relative">
                              <input
                                type="number"
                                value={alloc.targetAmount || ''}
                                onChange={(e) => handleRuleChange(idx, 'targetAmount', e.target.value)}
                                className="w-full p-3 text-base rounded-xl bg-card border border-border focus:outline-none focus:border-primary font-bold transition-colors"
                                placeholder="e.g. 500"
                              />
                              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm font-bold">XLM</span>
                            </div>
                          </div>
                        )}
                      </div>

                      <div className="flex flex-col sm:flex-row gap-4">
                        {alloc.type !== 'remainder' && alloc.valueLabel && (
                          <div className="flex-1">
                            <label className="block text-sm font-semibold text-muted-foreground mb-2">{alloc.valueLabel}</label>
                            <div className="relative w-full">
                              <input
                                type="number"
                                value={alloc.value || ''}
                                onChange={(e) => handleRuleChange(idx, 'value', e.target.value)}
                                className="w-full p-3 text-base rounded-xl bg-card border border-border focus:outline-none focus:border-primary font-bold transition-colors"
                              />
                              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm font-bold">
                                {alloc.type === 'percentage' ? '%' : 'XLM'}
                              </span>
                            </div>
                          </div>
                        )}

                        {alloc.destLabel && (
                          <div className="flex-1">
                            <label className="block text-sm font-semibold text-muted-foreground mb-2">{alloc.destLabel}</label>
                            <input
                              type="text"
                              value={alloc.destination}
                              onChange={(e) => handleRuleChange(idx, 'destination', e.target.value)}
                              className="w-full p-3 text-base rounded-xl bg-card border border-border focus:outline-none focus:border-primary font-bold transition-colors"
                              placeholder="Destination name"
                            />
                          </div>
                        )}
                        
                        {/* Read-only destination if no destLabel is provided but destination exists (e.g., Savings, Giving) */}
                        {!alloc.destLabel && alloc.destination && (
                           <div className="hidden">
                             {/* Hidden because the valueLabel usually contains the destination name naturally for these templates */}
                           </div>
                        )}
                      </div>
                    </div>
                  ))}
                  
                  {selectedTemplate.id === 'custom' && (
                    <button onClick={addCustomField} className="text-sm font-bold text-primary hover:underline mt-2">
                      + Add another allocation
                    </button>
                  )}
                </div>
              </section>

              {/* What the policy produces */}
              <section className="bg-card border-2 border-primary/20 p-6 rounded-2xl shadow-md transition-all duration-500">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-bold text-primary uppercase tracking-wider">Policy Preview</h3>
                  <span className="flex h-6 items-center rounded-full bg-primary/10 px-3 text-xs font-bold text-primary uppercase tracking-wide">
                    Calculation Only
                  </span>
                </div>
                
                {plan.error ? (
                  <div className="bg-destructive/10 border border-destructive/20 text-destructive p-4 rounded-xl">
                    <p className="font-bold text-sm">Validation Error</p>
                    <p className="text-sm mt-1">{plan.error}</p>
                  </div>
                ) : (
                  <ul className="space-y-3">
                    {plan.destinations.map((res, idx) => {
                      const origField = allocations.find(a => a.destination === res.destination);
                      const pocketName = origField?.name || 'Unnamed Pocket';
                      const pocketType = origField?.pocketType || 'flexible';
                      
                      let badgeColor = 'bg-muted text-muted-foreground';
                      if (pocketType === 'locked') badgeColor = 'bg-destructive/10 text-destructive';
                      if (pocketType === 'target') badgeColor = 'bg-primary/10 text-primary';
                      
                      return (
                        <li key={idx} className="flex flex-col sm:flex-row justify-between sm:items-center py-4 border-b border-border last:border-0 transition-opacity duration-300 gap-2">
                          <div className="flex flex-col gap-1.5 w-full sm:w-auto">
                            <div className="flex items-center gap-2 max-w-full">
                              <span className="font-bold text-foreground text-lg truncate">{pocketName}</span>
                              <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider shrink-0 ${badgeColor}`}>
                                {pocketType}
                              </span>
                            </div>
                            <span className="text-sm font-medium text-muted-foreground break-words">
                              Destination: {res.destination}
                              {origField && origField.type !== 'remainder' && ` (${origField.value}${origField.type === 'percentage' ? '%' : ' XLM'})`}
                              {origField && origField.type === 'remainder' && ' (Remainder)'}
                            </span>
                            
                            {pocketType === 'locked' && origField?.lockedUntil && (
                              <span className="text-xs font-bold text-destructive flex flex-wrap items-center gap-1 mt-1 bg-destructive/10 w-fit max-w-full px-2 py-1 rounded">
                                <svg className="w-3 h-3 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                                <span className="truncate">Locked until {new Date(origField.lockedUntil).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
                              </span>
                            )}
                            
                            {pocketType === 'target' && origField?.targetAmount && (
                              <div className="mt-2 w-full max-w-[200px]">
                                <div className="flex justify-between items-end mb-1">
                                  <span className="text-xs font-bold text-primary">{res.amount} of {origField.targetAmount} saved</span>
                                </div>
                                <div className="w-full bg-border rounded-full h-1.5 overflow-hidden">
                                  <div className="bg-primary h-1.5 rounded-full transition-all duration-1000 ease-out" style={{ width: `${Math.min((Number(res.amount) / Math.max(1, Number(origField.targetAmount))) * 100, 100)}%` }}></div>
                                </div>
                              </div>
                            )}
                          </div>
                          <span className="font-mono font-bold text-primary text-xl sm:text-right shrink-0">{res.amount} XLM</span>
                        </li>
                      );
                    })}
                  </ul>
                )}

                <div className="mt-8 pt-6 border-t border-border">
                  <p className="text-center text-sm text-muted-foreground font-medium">This is a simulation preview. No funds are actually locked or transferred.</p>
                </div>
              </section>

              {/* The Engine Pipeline (Secondary evidence) */}
              <section className="bg-card border border-border p-6 rounded-2xl shadow-sm">
                <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-4">Under the hood: Pipeline</h3>
                <div className="space-y-3 font-mono text-xs text-muted-foreground transition-all duration-500">
                  <div className="flex gap-3 text-foreground items-center hover:opacity-80 transition-opacity">
                    <span className="w-24 shrink-0 font-bold">MONEY POLICY</span>
                    <span className="truncate">{policyName}</span>
                  </div>
                  <div className="flex gap-3 items-center hover:opacity-80 transition-opacity">
                    <span className="w-24 shrink-0 text-foreground font-bold">RULES</span>
                    <span className="truncate">
                      {allocations.map(a => a.type === 'remainder' ? `remainder ${a.destination}` : `${a.value}${a.type === 'percentage' ? '%' : ' XLM'} ${a.destination}`).join(' + ')}
                    </span>
                  </div>
                  <div className="flex gap-3 items-center hover:opacity-80 transition-opacity">
                    <span className="w-24 shrink-0 text-foreground font-bold">CONDITIONS</span>
                    <span>Available balance is sufficient</span>
                  </div>
                  <div className="flex gap-3 items-center hover:opacity-80 transition-opacity">
                    <span className="w-24 shrink-0 text-foreground font-bold">CALCULATION</span>
                    <span className="truncate">
                      {allocations.map(a => a.type === 'remainder' ? 'remainder' : a.value).join(' + ')}
                    </span>
                  </div>
                  <div className="flex gap-3 items-center hover:opacity-80 transition-opacity">
                    <span className="w-24 shrink-0 text-foreground font-bold">VALIDATION</span>
                    <span>Allocations fit within available balance</span>
                  </div>
                  <div className="flex gap-3 text-primary items-center hover:opacity-80 transition-opacity">
                    <span className="w-24 shrink-0 font-bold">ACTION</span>
                    <span>Simulated allocation ready</span>
                  </div>
                </div>
              </section>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
