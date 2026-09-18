'use client';

import { useState } from 'react';
import Link from 'next/link';

type TemplateDef = {
  id: string;
  name: string;
  description: string;
  defaultName: string;
  defaultPurpose: string;
  defaultDestination: string;
};

const TEMPLATE_CATEGORIES: { category: string; templates: TemplateDef[] }[] = [
  {
    category: 'Community & Family',
    templates: [
      {
        id: 'class_contribution',
        name: 'Class / Group',
        description: 'Collect contributions for a shared purpose.',
        defaultName: 'Class Dinner 2026',
        defaultPurpose: 'Class contribution',
        defaultDestination: 'Class account'
      },
      {
        id: 'family_fund',
        name: 'Family Fund',
        description: 'Collect money for a family goal.',
        defaultName: 'Annual Family Fund',
        defaultPurpose: 'Family support',
        defaultDestination: 'Family account'
      },
      {
        id: 'burial_emergency',
        name: 'Burial / Emergency',
        description: 'Organize support for an urgent family need.',
        defaultName: 'Family Emergency Fund',
        defaultPurpose: 'Burial / emergency support',
        defaultDestination: 'Family account'
      },
      {
        id: 'church_project',
        name: 'Church / Project',
        description: 'Collect toward a community or project goal.',
        defaultName: 'Church Building Project',
        defaultPurpose: 'Community project',
        defaultDestination: 'Church/project account'
      }
    ]
  },
  {
    category: 'Events',
    templates: [
      {
        id: 'birthday_wedding',
        name: 'Birthday / Wedding',
        description: 'Collect gifts and contributions for an event.',
        defaultName: 'Birthday Celebration',
        defaultPurpose: 'Event contribution',
        defaultDestination: 'Event recipient'
      },
      {
        id: 'celebration',
        name: 'Celebration',
        description: 'Collect gifts and contributions for an event.',
        defaultName: 'Graduation Party',
        defaultPurpose: 'Celebration fund',
        defaultDestination: 'Event organizer'
      }
    ]
  },
  {
    category: 'Other',
    templates: [
      {
        id: 'project_fund',
        name: 'Project Fund',
        description: 'Collect money for a shared goal and release when ready.',
        defaultName: 'New Business Fund',
        defaultPurpose: 'Project fund',
        defaultDestination: 'Project wallet'
      },
      {
        id: 'trust_fund',
        name: 'Trust / Family Fund',
        description: 'Track long-term contributions for a specific person or goal.',
        defaultName: 'Trust Fund',
        defaultPurpose: 'Long term trust',
        defaultDestination: 'Trust account'
      },
      {
        id: 'custom',
        name: 'Custom',
        description: 'Create a fully custom policy for any shared purpose.',
        defaultName: 'Custom Shared Goal',
        defaultPurpose: 'Custom goal',
        defaultDestination: 'Named destination'
      }
    ]
  }
];

const ALL_TEMPLATES = TEMPLATE_CATEGORIES.flatMap(c => c.templates);

const SIMULATED_CONTRIBUTORS = [
  { name: 'Ada', amount: 50 },
  { name: 'Chike', amount: 20 },
  { name: 'Emeka', amount: 100 },
  { name: 'Ngozi', amount: 30 }
];
const TOTAL_COLLECTED = SIMULATED_CONTRIBUTORS.reduce((sum, c) => sum + c.amount, 0);

export default function SharedGoalPage() {
  const [selectedTemplateId, setSelectedTemplateId] = useState(ALL_TEMPLATES[0].id);
  
  const [policyName, setPolicyName] = useState(ALL_TEMPLATES[0].defaultName);
  const [purpose, setPurpose] = useState(ALL_TEMPLATES[0].defaultPurpose);
  const [destination, setDestination] = useState(ALL_TEMPLATES[0].defaultDestination);
  const [targetAmount, setTargetAmount] = useState('500');
  const [contributionBehavior, setContributionBehavior] = useState<'any' | 'suggested'>('any');
  const [releaseCondition, setReleaseCondition] = useState<'target' | 'date'>('date');
  const [releaseDate, setReleaseDate] = useState('2026-11-25');

  const handleTemplateSelect = (templateId: string) => {
    setSelectedTemplateId(templateId);
    const tmpl = ALL_TEMPLATES.find(t => t.id === templateId);
    if (tmpl) {
      setPolicyName(tmpl.defaultName);
      setPurpose(tmpl.defaultPurpose);
      setDestination(tmpl.defaultDestination);
    }
  };

  const parsedTarget = Math.max(1, Number(targetAmount) || 1);
  const progressPercent = Math.min((TOTAL_COLLECTED / parsedTarget) * 100, 100);
  const remaining = Math.max(0, parsedTarget - TOTAL_COLLECTED);

  // Helper for displaying dates nicely, e.g., "25 November 2026"
  const formattedReleaseDate = (() => {
    try {
      const parts = releaseDate.split('-');
      if (parts.length === 3) {
        const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
        return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
      }
      return releaseDate;
    } catch {
      return releaseDate;
    }
  })();

  return (
    <div className="w-full max-w-5xl mx-auto py-8 px-4 sm:px-6 pb-24">
      {/* 1. HERO */}
      <div className="mb-8">
        <Link href="/" className="text-primary hover:underline text-sm mb-4 inline-block font-semibold">
          &larr; Back to Home
        </Link>
        <div className="flex items-center gap-4">
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-foreground">Shared Goal Money Policy</h1>
          <span className="flex h-6 items-center rounded-full bg-warning px-3 text-xs font-bold text-warning-foreground uppercase tracking-wide">
            POLICY PREVIEW
          </span>
        </div>
        <p className="text-lg text-primary font-bold mt-2">
          Collect money for what matters.
        </p>
        <p className="text-muted-foreground font-medium mt-1">
          Create a Money Policy for a class, family, event, project, community goal, or any shared purpose.
        </p>
      </div>

      <div className="grid lg:grid-cols-12 gap-8">
        {/* LEFT COLUMN: Template Selection */}
        <div className="lg:col-span-6 xl:col-span-5 space-y-12">
          <section>
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-foreground mb-2">What are you collecting for?</h2>
              <p className="text-sm text-muted-foreground font-medium">
                Choose a purpose and we'll shape the policy around it.
              </p>
            </div>
            
            <div className="space-y-8">
              {TEMPLATE_CATEGORIES.map(cat => (
                <div key={cat.category}>
                  <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground mb-3">{cat.category}</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2 gap-3">
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

            <div className="mt-8 space-y-4">
              <div className="p-4 rounded-xl bg-card border border-border">
                <p className="text-sm font-bold text-foreground uppercase tracking-wider mb-1 text-primary">One engine. Different purposes.</p>
                <p className="text-xs text-muted-foreground">The template system can serve class contributions, family funds, burials, birthdays, weddings, church projects, community projects, trust/family funds, and custom purposes.</p>
              </div>

              <div className="p-4 rounded-xl bg-card border border-border">
                <p className="text-sm font-semibold text-foreground">Ajo is one Money Policy. Shared Goal is another.</p>
                <p className="text-xs text-muted-foreground mt-1">Different purpose. Same engine.</p>
              </div>
            </div>
          </section>
        </div>

        {/* RIGHT COLUMN: Interactive Form & Previews */}
        <div className="lg:col-span-6 xl:col-span-7 flex flex-col gap-6">
          <div className="inline-flex h-6 items-center self-start rounded-full bg-warning px-3 text-xs font-bold text-warning-foreground uppercase tracking-wide">
            POLICY PREVIEW
          </div>

          {/* Guided Rule Form */}
          <section className="bg-card border border-border p-6 rounded-2xl shadow-sm">
            <h2 className="text-lg font-bold mb-6">Create a Money Policy</h2>
            
            <div className="space-y-6">
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-muted-foreground mb-2">Policy name</label>
                  <input 
                    type="text" 
                    value={policyName}
                    onChange={(e) => setPolicyName(e.target.value)}
                    className="w-full p-3 rounded-xl border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/50 font-bold transition-shadow"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-muted-foreground mb-2">Purpose</label>
                  <input 
                    type="text" 
                    value={purpose}
                    onChange={(e) => setPurpose(e.target.value)}
                    className="w-full p-3 rounded-xl border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/50 font-bold transition-shadow"
                  />
                </div>
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-muted-foreground mb-2">Target amount</label>
                  <div className="relative">
                    <input 
                      type="number" 
                      value={targetAmount}
                      onChange={(e) => setTargetAmount(e.target.value)}
                      className="w-full p-3 rounded-xl border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/50 font-bold transition-shadow"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground font-bold text-sm">XLM</span>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-muted-foreground mb-2">How should people contribute?</label>
                  <select 
                    value={contributionBehavior}
                    onChange={(e) => setContributionBehavior(e.target.value as any)}
                    className="w-full p-3 rounded-xl border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/50 font-semibold transition-shadow appearance-none"
                  >
                    <option value="any">Any amount</option>
                    <option value="suggested">Suggested amount</option>
                  </select>
                </div>
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-muted-foreground mb-2">When should the money be released?</label>
                  <select 
                    value={releaseCondition}
                    onChange={(e) => setReleaseCondition(e.target.value as any)}
                    className="w-full p-3 rounded-xl border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/50 font-semibold transition-shadow appearance-none"
                  >
                    <option value="date">On a specific date</option>
                    <option value="target">When we reach the target</option>
                  </select>
                </div>

                {releaseCondition === 'date' && (
                  <div className="animate-in fade-in zoom-in-95 duration-300">
                    <label className="block text-sm font-semibold text-muted-foreground mb-2">Release date</label>
                    <input 
                      type="date"
                      value={releaseDate}
                      onChange={(e) => setReleaseDate(e.target.value)}
                      className="w-full p-3 rounded-xl border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/50 font-semibold transition-shadow"
                    />
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-semibold text-muted-foreground mb-2">Who should receive the money?</label>
                <input 
                  type="text" 
                  value={destination}
                  onChange={(e) => setDestination(e.target.value)}
                  className="w-full p-3 rounded-xl border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/50 font-bold transition-shadow"
                  placeholder="e.g. Class account, Event organizer"
                />
              </div>
            </div>
          </section>

          {/* Release Policy Preview */}
          <section className="bg-card border-2 border-primary/20 p-6 rounded-2xl shadow-md transition-all duration-500">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-foreground">Your Money Policy</h2>
              <span className="flex h-6 items-center rounded-full bg-primary/10 px-3 text-xs font-bold text-primary uppercase tracking-wide">
                Preview
              </span>
            </div>
            
            <div className="bg-background p-6 rounded-xl border border-border mb-6 shadow-sm">
              <h4 className="text-xl font-bold text-foreground mb-2">{policyName}</h4>
              <p className="text-sm font-medium text-muted-foreground mb-4">
                Collect contributions for {purpose}.
              </p>
              
              <div className="grid grid-cols-2 gap-y-4 gap-x-6 text-sm mb-6">
                <div>
                  <span className="block text-muted-foreground font-semibold mb-1">Target:</span>
                  <span className="font-bold">{targetAmount || '0'} XLM</span>
                </div>
                <div>
                  <span className="block text-muted-foreground font-semibold mb-1">Current:</span>
                  <span className="font-bold text-primary">{TOTAL_COLLECTED} XLM</span>
                </div>
                <div>
                  <span className="block text-muted-foreground font-semibold mb-1">Release:</span>
                  <span className="font-bold">
                    {releaseCondition === 'date' ? formattedReleaseDate : 'On target reached'}
                  </span>
                </div>
                <div>
                  <span className="block text-muted-foreground font-semibold mb-1">Destination:</span>
                  <span className="font-bold">{destination || 'Unspecified'}</span>
                </div>
              </div>

              <div className="bg-primary/5 border border-primary/20 p-4 rounded-lg mb-4">
                <p className="text-sm font-medium text-foreground leading-relaxed italic">
                  "Collect contributions toward the target. Track each contribution. When the configured release conditions are satisfied, release the collected funds to the {destination || 'destination'}."
                </p>
              </div>

              <div className="pt-4 border-t border-border">
                <span className="block text-muted-foreground font-semibold mb-1">Status:</span>
                <span className="font-bold text-warning">Waiting for conditions</span>
              </div>
            </div>

            <div className="mt-8">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">What the policy will do</h3>
                <span className="text-xs font-bold bg-background px-2 py-1 rounded text-muted-foreground border border-border">
                  Policy Preview — no funds moved
                </span>
              </div>
              <ol className="list-decimal list-inside space-y-2 text-sm font-medium text-foreground pl-2">
                <li>Record contributions</li>
                <li>Track progress toward the target</li>
                <li>Check the release condition</li>
                <li>Validate the policy state</li>
                <li>Prepare the configured release action</li>
                <li>Keep a contribution report</li>
              </ol>
            </div>
          </section>

          {/* Sample Policy Activity */}
          <section className="bg-primary/5 border border-primary/20 p-6 rounded-2xl shadow-inner">
            <div className="flex flex-wrap items-center justify-between mb-6 gap-4">
              <h3 className="text-sm font-bold uppercase tracking-wider text-primary">SAMPLE POLICY ACTIVITY</h3>
              <span className="text-xs font-bold bg-background px-2 py-1 rounded text-muted-foreground border border-border">
                Preview data — no funds moved
              </span>
            </div>

            <div className="mb-6 space-y-2">
              <div className="flex justify-between items-end mb-2">
                <span className="text-sm font-semibold text-muted-foreground">Progress</span>
                <span className="text-sm font-semibold text-muted-foreground">Target</span>
              </div>
              <div className="flex justify-between items-end mb-2">
                <span className="text-2xl font-bold text-foreground">{TOTAL_COLLECTED} XLM</span>
                <span className="text-xl font-bold text-muted-foreground">{targetAmount || '0'} XLM</span>
              </div>
              <div className="w-full bg-border rounded-full h-3 overflow-hidden">
                <div className="bg-primary h-3 rounded-full transition-all duration-1000 ease-out" style={{ width: `${progressPercent}%` }}></div>
              </div>
            </div>

            <div className="space-y-4">
              <h4 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Contribution Report</h4>
              <div className="bg-background rounded-xl border border-border overflow-hidden">
                <table className="w-full text-sm text-left">
                  <thead className="bg-muted/30 border-b border-border">
                    <tr>
                      <th className="px-4 py-3 font-bold text-muted-foreground">Contributor</th>
                      <th className="px-4 py-3 font-bold text-muted-foreground text-right">Amount</th>
                      <th className="px-4 py-3 font-bold text-muted-foreground">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {SIMULATED_CONTRIBUTORS.map((c, i) => (
                      <tr key={i} className="hover:bg-muted/10">
                        <td className="px-4 py-3 font-semibold">{c.name}</td>
                        <td className="px-4 py-3 font-mono font-medium text-right">{c.amount} XLM</td>
                        <td className="px-4 py-3 font-medium text-success">Recorded</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="bg-muted/10 p-4 border-t border-border grid grid-cols-3 gap-4 text-xs font-bold text-muted-foreground">
                  <div>
                    <span className="block mb-1">TOTAL COLLECTED</span>
                    <span className="text-foreground text-sm">{TOTAL_COLLECTED} XLM</span>
                  </div>
                  <div>
                    <span className="block mb-1">CONTRIBUTORS</span>
                    <span className="text-foreground text-sm">{SIMULATED_CONTRIBUTORS.length}</span>
                  </div>
                  <div>
                    <span className="block mb-1">REMAINING</span>
                    <span className="text-foreground text-sm">{remaining} XLM</span>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Technical Engine Pipeline (Under the hood) */}
          <section className="bg-card border border-border p-6 rounded-2xl shadow-sm mt-4">
            <h3 className="text-sm font-bold text-foreground uppercase tracking-wider mb-2">Under the hood</h3>
            <p className="text-sm font-medium text-muted-foreground mb-6">
              The same deterministic engine turns the policy into structured actions.
            </p>
            
            <div className="space-y-2 font-mono text-xs text-muted-foreground bg-muted/20 p-4 rounded-xl border border-border">
              <div className="flex justify-center items-center flex-col text-center gap-1">
                <div className="font-bold text-foreground">MONEY POLICY</div>
                <div className="text-border">↓</div>
                <div className="font-bold text-foreground">CONTRIBUTION RULES</div>
                <div className="text-border">↓</div>
                <div className="font-bold text-foreground">TARGET / DATE CONDITIONS</div>
                <div className="text-border">↓</div>
                <div className="font-bold text-foreground">VALIDATION</div>
                <div className="text-border">↓</div>
                <div className="font-bold text-primary">RELEASE ACTION</div>
                <div className="text-border">↓</div>
                <div className="font-bold text-muted-foreground">HISTORY / REPORT</div>
              </div>
            </div>
            
            <p className="text-center text-xs text-muted-foreground mt-4 font-medium italic">
              No funds move in this preview.
            </p>
          </section>

        </div>
      </div>
    </div>
  );
}
