'use client';

import { useAjo } from '@/lib/ajo/AjoContext';
import { usePollar } from '@pollar/react';
import { useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import type { ExecutePayoutResult } from '@/lib/ajo/executor';
import { getContributionStatus } from '@/lib/ajo/rules';

function AjoPageContent() {
  const {
    activeCircle,
    createDemoAjoCircle,
    resetAjoDemo,
    contributions,
    payouts,
    executePayout,
    isWalletConnected,
  } = useAjo();
  
  const searchParams = useSearchParams();
  const joinParam = searchParams?.get('join');
  
  const [payoutState, setPayoutState] = useState<'idle' | 'pending' | 'success' | 'error'>('idle');
  const [payoutResult, setPayoutResult] = useState<ExecutePayoutResult | null>(null);
  const [isJoining, setIsJoining] = useState(false);

  // Configuration form state
  const [memberCount, setMemberCount] = useState<number>(5);
  const [contributionAmount, setContributionAmount] = useState<string>('10');
  const [frequency, setFrequency] = useState<'weekly' | 'biweekly' | 'monthly'>('weekly');
  const [payoutOrderIndices, setPayoutOrderIndices] = useState<number[]>(
    Array.from({ length: 5 }, (_, i) => i)
  );

  const handleMemberCountChange = (newCount: number) => {
    setMemberCount(newCount);
    const newOrder = Array.from({ length: newCount }, (_, i) => i);
    setPayoutOrderIndices(newOrder);
  };

  const moveMember = (index: number, direction: 'up' | 'down') => {
    const newOrder = [...payoutOrderIndices];
    if (direction === 'up' && index > 0) {
      [newOrder[index - 1], newOrder[index]] = [newOrder[index], newOrder[index - 1]];
    } else if (direction === 'down' && index < newOrder.length - 1) {
      [newOrder[index + 1], newOrder[index]] = [newOrder[index], newOrder[index + 1]];
    }
    setPayoutOrderIndices(newOrder);
  };

  // Derive state for the active cycle
  const currentCycle = activeCircle ? activeCircle.currentCycle : 0;
  const contribStatus = activeCircle
    ? getContributionStatus(activeCircle, contributions)
    : null;

  // Find the recipient for the current cycle
  const recipientId = activeCircle?.payoutOrder[currentCycle];
  const recipientMember = activeCircle?.members.find((m) => m.memberId === recipientId);

  const handleCreateDemo = () => {
    try {
      createDemoAjoCircle({
        memberCount,
        contributionAmount,
        frequency,
        payoutOrderIndices,
      });
      setPayoutState('idle');
      setPayoutResult(null);
    } catch (err) {
      alert(err instanceof Error ? err.message : String(err));
    }
  };

  const handleCopyInvite = () => {
    if (!activeCircle) return;
    const url = new URL(window.location.href);
    url.searchParams.set('join', '1');
    url.searchParams.set('name', activeCircle.name);
    url.searchParams.set('amount', activeCircle.contributionAmount);
    url.searchParams.set('freq', activeCircle.frequency);
    url.searchParams.set('count', activeCircle.members.length.toString());
    url.searchParams.set('capacity', activeCircle.members.length.toString());
    
    navigator.clipboard.writeText(url.toString());
    alert('Invite link copied to clipboard!');
  };

  const potAmount = activeCircle ? Number(activeCircle.contributionAmount) * activeCircle.members.length : 0;
  const memberNames = [
    'You', 'Ada [Demo]', 'Chika [Demo]', 'Emeka [Demo]', 'Funke [Demo]',
    'Bayo [Demo]', 'Ngozi [Demo]', 'Kwame [Demo]', 'Amara [Demo]', 'Tunde [Demo]',
    'Zainab [Demo]', 'Obi [Demo]'
  ];

  if (joinParam && !activeCircle) {
    const cName = searchParams?.get('name') || 'Ajo Circle';
    const cAmount = searchParams?.get('amount') || '10';
    const cFreq = searchParams?.get('freq') || 'weekly';
    const cCount = Number(searchParams?.get('count')) || 1;
    const cCapacity = Number(searchParams?.get('capacity')) || 5;

    const isFull = cCount >= cCapacity;

    return (
      <div className="w-full max-w-xl mx-auto space-y-8 pb-24 mt-8 px-4 sm:px-0">
        <section className="rounded-3xl border-2 border-border bg-card p-6 sm:p-12 text-center space-y-6 shadow-sm">
          <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight">Join this Ajo circle</h2>
          
          <div className="bg-muted/30 p-5 sm:p-6 rounded-2xl text-left space-y-4 border border-border">
            <div>
              <p className="text-xs sm:text-sm font-bold text-muted-foreground uppercase tracking-wider">Circle Name</p>
              <p className="text-lg sm:text-xl font-extrabold truncate">{cName}</p>
            </div>
            <div className="flex justify-between gap-4">
              <div>
                <p className="text-xs sm:text-sm font-bold text-muted-foreground uppercase tracking-wider">Contribution</p>
                <p className="text-base sm:text-lg font-bold">{cAmount} XLM <span className="text-xs sm:text-sm font-medium text-muted-foreground capitalize">/ {cFreq}</span></p>
              </div>
              <div className="text-right">
                <p className="text-xs sm:text-sm font-bold text-muted-foreground uppercase tracking-wider">Members</p>
                <p className="text-base sm:text-lg font-bold">{cCount} / {cCapacity}</p>
              </div>
            </div>
          </div>

          <div className="pt-6 border-t border-border space-y-4">
            {!isWalletConnected ? (
              <div className="p-4 rounded-xl bg-warning/10 text-warning border border-warning/20">
                <p className="font-bold text-sm sm:text-base">Please connect your wallet to join.</p>
              </div>
            ) : isFull ? (
              <div className="p-4 rounded-xl bg-destructive/10 text-destructive border border-destructive/20">
                <p className="font-bold text-sm sm:text-base">This circle is full</p>
              </div>
            ) : (
              <button
                onClick={() => setIsJoining(true)}
                className="w-full h-14 rounded-xl bg-primary text-primary-foreground font-bold hover:bg-primary/90 transition-all text-base sm:text-lg"
              >
                Join Circle
              </button>
            )}
            
            {isJoining && (
              <div className="p-4 rounded-xl bg-destructive/10 text-destructive border border-destructive/20 text-left text-xs sm:text-sm mt-4">
                <p className="font-bold mb-1">Join Not Implemented</p>
                <p>Persistent cross-user joining is not supported by the current architecture because all Ajo state is stored in temporary client memory (React refs). A backend database is required to sync circle state across different users securely.</p>
              </div>
            )}
          </div>
        </section>
      </div>
    );
  }

  const completedPayouts = payouts.filter(p => p.circleId === activeCircle?.id && p.status === 'paid');

  return (
    <div className="w-full max-w-4xl mx-auto space-y-12 pb-24 px-4 sm:px-0">
      {/* HEADER */}
      <header className="space-y-4 text-center sm:text-left">
        <div className="inline-flex items-center gap-2 text-xs font-bold text-success uppercase tracking-wider bg-success/10 px-3 py-1 rounded-full border border-success/20">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
          LIVE POLICY EXECUTION
        </div>
        <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-foreground">
          Ajo Money Policy
        </h1>
        <p className="text-lg sm:text-xl font-bold text-muted-foreground">
          Tell your money what to do as a group.
        </p>
      </header>

      {/* CROSS-BORDER NARRATIVE BANNER */}
      <div className="rounded-2xl border border-primary/20 bg-primary/5 p-5 sm:p-6 text-sm sm:text-base shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-start gap-4">
          <div className="mx-auto sm:mx-0 w-12 h-12 bg-primary/10 text-primary rounded-full flex items-center justify-center shrink-0 border border-primary/20">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          </div>
          <div className="space-y-2 text-muted-foreground text-center sm:text-left">
            <p className="font-medium text-foreground leading-relaxed">
              <strong className="font-extrabold text-primary">Pollar Pay</strong>’s Ajo circles are designed for cross-border saving — connecting members across Africa and Latin America through Pollar’s payment infrastructure.
            </p>
            <p className="leading-relaxed">
              For example, you can create a <em className="font-semibold text-foreground px-1 bg-muted rounded">“Nigeria + Bolivia Family Circle”</em>. Our underlying architecture enables contributions and payouts between members in different regions, leveraging Pollar’s unified rails.
            </p>
          </div>
        </div>
      </div>

      {!activeCircle ? (
        <section className="rounded-2xl border border-border bg-card p-6 sm:p-8 space-y-6">
          <h2 className="text-xl sm:text-2xl font-bold text-center">Configure Your Ajo Circle</h2>
          <p className="text-muted text-base sm:text-lg font-medium text-center">
            Set up the rules for your group policy.
          </p>

          <div className="space-y-6 max-w-lg mx-auto text-left">
            <div>
              <label className="block text-sm font-bold mb-2">Number of Members (3 - 12)</label>
              <input 
                type="number" 
                min="3" 
                max="12" 
                value={memberCount} 
                onChange={(e) => handleMemberCountChange(Math.max(3, Math.min(12, Number(e.target.value) || 3)))}
                className="w-full bg-background border border-border rounded-lg px-4 py-2"
              />
            </div>

            <div>
              <label className="block text-sm font-bold mb-2">Contribution Amount (XLM)</label>
              <input 
                type="number" 
                min="1" 
                value={contributionAmount} 
                onChange={(e) => setContributionAmount(e.target.value)}
                className="w-full bg-background border border-border rounded-lg px-4 py-2"
              />
            </div>

            <div>
              <label className="block text-sm font-bold mb-2">Frequency</label>
              <select 
                value={frequency} 
                onChange={(e) => setFrequency(e.target.value as any)}
                className="w-full bg-background border border-border rounded-lg px-4 py-2"
              >
                <option value="weekly">Weekly</option>
                <option value="biweekly">Biweekly</option>
                <option value="monthly">Monthly</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-bold mb-2">Payout Order</label>
              <div className="space-y-2 border border-border rounded-lg p-3 sm:p-4 bg-background">
                {payoutOrderIndices.map((memberIndex, i) => (
                  <div key={memberIndex} className="flex justify-between items-center bg-card p-2 rounded border border-border">
                    <span className="font-medium text-xs sm:text-sm truncate pr-2">{i + 1}. {memberNames[memberIndex]}</span>
                    <div className="flex gap-2 shrink-0">
                      <button 
                        onClick={() => moveMember(i, 'up')}
                        disabled={i === 0}
                        className="w-7 h-7 sm:w-8 sm:h-8 flex items-center justify-center rounded bg-muted hover:bg-primary/20 disabled:opacity-30 disabled:cursor-not-allowed text-base sm:text-lg font-bold"
                      >
                        &uarr;
                      </button>
                      <button 
                        onClick={() => moveMember(i, 'down')}
                        disabled={i === payoutOrderIndices.length - 1}
                        className="w-7 h-7 sm:w-8 sm:h-8 flex items-center justify-center rounded bg-muted hover:bg-primary/20 disabled:opacity-30 disabled:cursor-not-allowed text-base sm:text-lg font-bold"
                      >
                        &darr;
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="pt-4 text-center">
              {!isWalletConnected ? (
                <p className="text-warning text-sm font-bold">
                  Your wallet becomes your participant in the group policy. Log in above.
                </p>
              ) : (
                <button
                  onClick={handleCreateDemo}
                  className="w-full inline-flex h-12 items-center justify-center rounded-xl bg-primary px-8 text-md font-bold text-primary-foreground hover:bg-primary/90 transition-colors"
                >
                  Create Ajo Circle
                </button>
              )}
            </div>
          </div>
        </section>
      ) : activeCircle.status === 'completed' ? (
        <section className="rounded-3xl border-2 border-border bg-card p-8 sm:p-12 text-center space-y-6 max-w-xl mx-auto mt-12 shadow-sm">
          <div className="mx-auto w-20 h-20 sm:w-24 sm:h-24 bg-success/10 text-success rounded-full flex items-center justify-center mb-6 border border-success/20">
            <svg className="w-10 h-10 sm:w-12 sm:h-12" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
          </div>
          <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight">Circle complete</h2>
          <p className="text-muted-foreground font-medium text-base sm:text-xl">
            All cycles for this Ajo policy have been fully funded and paid out successfully.
          </p>
          
          <div className="pt-8">
            <button 
              onClick={() => {
                resetAjoDemo();
                setPayoutState('idle');
                setPayoutResult(null);
              }}
              className="text-primary font-bold hover:text-primary/80 transition-colors underline underline-offset-4 text-base sm:text-lg"
            >
              Start a new circle &rarr;
            </button>
          </div>
        </section>
      ) : (
        <div className="max-w-xl mx-auto space-y-8 mt-8">
          <section className="rounded-3xl border-2 border-primary/20 bg-card overflow-hidden shadow-xl">
            <div className="p-6 sm:p-8 text-center border-b border-border bg-muted/10 space-y-3 relative">
              <button 
                onClick={handleCopyInvite}
                className="absolute top-4 right-4 text-xs font-bold text-primary bg-primary/10 hover:bg-primary/20 transition-colors px-3 py-1.5 rounded-lg border border-primary/20 flex items-center gap-1.5"
                title="Copy Invite Link"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" /></svg>
                <span className="hidden sm:inline">Invite Link</span>
              </button>

              <p className="text-xs sm:text-sm font-extrabold uppercase tracking-widest text-primary mb-2 mt-4 sm:mt-0">Cycle {currentCycle + 1} of {activeCircle.members.length}</p>
              <h2 className="text-2xl sm:text-3xl font-extrabold text-foreground leading-tight">
                Next to receive: <span className="text-primary block sm:inline mt-1 sm:mt-0 truncate">{recipientMember?.name}</span>
              </h2>
              <p className="text-base sm:text-lg font-medium text-muted-foreground pt-2">
                Payout amount: <strong className="text-foreground">{potAmount} XLM</strong>
              </p>
            </div>
            
            <div className="p-5 sm:p-8 space-y-8">
              <div className="space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <h3 className="text-lg sm:text-xl font-bold text-foreground">Contribution Status</h3>
                  <span className="font-extrabold text-primary bg-primary/10 px-4 py-1.5 rounded-full border border-primary/20 text-xs sm:text-sm self-start sm:self-auto shrink-0">
                    {contribStatus?.contributedCount} of {activeCircle.members.length} paid
                  </span>
                </div>
                
                <div className="space-y-3">
                  {activeCircle.members.map((member) => {
                    const hasContributed = contribStatus?.contributedMemberIds.includes(member.memberId);
                    return (
                      <div key={member.memberId} className="flex items-center justify-between p-3 sm:p-4 rounded-xl border border-border bg-background gap-2 sm:gap-3">
                        <span className="font-bold text-foreground text-sm sm:text-base truncate pr-2">
                          {member.name}
                        </span>
                        <div className="shrink-0">
                          {hasContributed ? (
                            <span className="text-success font-bold bg-success/10 px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-lg border border-success/20 flex items-center gap-1.5 text-xs sm:text-sm">
                              <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                              Paid
                            </span>
                          ) : (
                            <span className="text-muted-foreground font-bold bg-muted px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-lg border border-border text-xs sm:text-sm">
                              Not paid yet
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
                
                {!contribStatus?.isFullyContributed && (
                  <AjoContributionActions 
                    activeCircle={activeCircle} 
                    contribStatus={contribStatus} 
                  />
                )}
              </div>

              <div className="pt-6 sm:pt-8 border-t border-border">
                {payoutState === 'error' && (
                  <div className="p-4 mb-5 sm:mb-6 text-xs sm:text-sm rounded-xl bg-destructive/10 text-destructive border border-destructive/20">
                    <p className="font-bold text-sm sm:text-base flex items-center gap-2">
                      <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                      Payout failed
                    </p>
                    <p className="mt-1 font-medium">{payoutResult?.error || payoutResult?.reason || 'Unknown error occurred during payment execution.'}</p>
                  </div>
                )}
                
                {payoutState === 'success' && (
                  <div className="p-5 sm:p-6 mb-5 sm:mb-6 text-sm rounded-xl bg-success/10 text-success-foreground border border-success/20 space-y-4 shadow-md animate-in fade-in slide-in-from-bottom-4 duration-500 text-center">
                    <div className="mx-auto w-10 h-10 sm:w-12 sm:h-12 bg-success/20 text-success rounded-full flex items-center justify-center mb-2">
                      <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7"></path></svg>
                    </div>
                    <h4 className="text-base sm:text-lg font-extrabold uppercase tracking-widest">
                      PAYMENT COMPLETE
                    </h4>
                    <p className="font-medium text-sm sm:text-base">
                      {potAmount} XLM was successfully sent to {recipientMember?.name}.
                    </p>
                    {payoutResult?.payout?.transactionHash && !payoutResult.payout.transactionHash.startsWith('demo_') && (
                      <a
                        href={`https://stellar.expert/explorer/testnet/tx/${payoutResult.payout.transactionHash}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center justify-center gap-2 font-bold bg-success text-success-foreground px-4 py-3 rounded-xl hover:bg-success/90 transition-colors w-full mt-2 text-sm sm:text-base"
                      >
                        View on Stellar Explorer
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"></path></svg>
                      </a>
                    )}
                  </div>
                )}

                <AjoPayoutButton 
                  activeCircle={activeCircle}
                  contribStatus={contribStatus}
                  executePayout={executePayout}
                  payoutState={payoutState}
                  setPayoutState={setPayoutState}
                  setPayoutResult={setPayoutResult}
                  recipientMember={recipientMember}
                  potAmount={potAmount}
                />
              </div>
            </div>
          </section>

          {/* CYCLE HISTORY */}
          <section className="rounded-3xl border border-border bg-card overflow-hidden shadow-sm mt-8 p-5 sm:p-8">
            <h3 className="text-lg sm:text-xl font-bold text-foreground mb-4 sm:mb-6">Cycle History</h3>
            {completedPayouts.length === 0 ? (
              <div className="text-center py-6 sm:py-8 text-muted-foreground border-2 border-dashed border-border rounded-xl bg-muted/10">
                <p className="font-medium text-sm sm:text-lg">No completed cycles yet.</p>
              </div>
            ) : (
              <div className="space-y-3 sm:space-y-4">
                {completedPayouts.map(p => {
                  const rName = activeCircle?.members.find(m => m.memberId === p.recipientId)?.name || p.recipientId;
                  return (
                    <div key={p.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-xl border border-border bg-background gap-3 sm:gap-4">
                      <div>
                        <p className="text-xs sm:text-sm font-bold text-muted-foreground uppercase tracking-widest mb-1">Cycle {p.cycle + 1}</p>
                        <p className="font-bold text-foreground text-base sm:text-lg truncate">{rName}</p>
                      </div>
                      <div className="sm:text-right">
                        <p className="font-extrabold text-success text-lg sm:text-xl">{p.amount} XLM</p>
                        <p className="text-xs font-medium text-muted-foreground mt-1">
                          {new Date(p.createdAt).toLocaleDateString()} &middot;{' '}
                          {p.transactionHash ? (
                            p.transactionHash.startsWith('demo_') ? (
                              <span className="text-muted-foreground" title={p.transactionHash}>Demo Tx</span>
                            ) : (
                              <a href={`https://stellar.expert/explorer/testnet/tx/${p.transactionHash}`} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline font-bold">
                                View Tx
                              </a>
                            )
                          ) : (
                            'No Tx'
                          )}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          <div className="pt-4 flex justify-center pb-12">
            <button 
              onClick={() => {
                if (confirm('Cancel and clear all Ajo state?')) {
                  resetAjoDemo();
                  setPayoutState('idle');
                  setPayoutResult(null);
                }
              }}
              className="text-xs sm:text-sm font-medium text-muted-foreground hover:text-destructive transition-colors underline underline-offset-4"
            >
              Cancel and reset demo
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function AjoPage() {
  return (
    <Suspense fallback={<div className="flex w-full items-center justify-center p-24 text-muted-foreground font-bold">Loading...</div>}>
      <AjoPageContent />
    </Suspense>
  );
}

function FundWithNairaModal({ onClose }: { onClose: () => void }) {
  const [amount, setAmount] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success'>('idle');

  const handlePay = () => {
    setStatus('loading');
    setTimeout(() => {
      setStatus('success');
    }, 1500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-card border border-border rounded-3xl shadow-xl w-full max-w-sm overflow-hidden flex flex-col animate-in zoom-in-95 duration-200">
        
        <div className="flex justify-between items-center p-5 border-b border-border bg-muted/10">
          <h3 className="font-extrabold text-lg text-foreground">Fund with Naira</h3>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full bg-muted/50 hover:bg-muted text-muted-foreground transition-colors">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        <div className="p-6 space-y-6">
          <div className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider bg-warning/10 text-warning px-2.5 py-1 rounded-md border border-warning/20">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
            DEMO / PREVIEW &mdash; No real payment
          </div>

          {status === 'idle' && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-bold mb-2 text-muted-foreground">Amount in Naira</label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground font-bold text-lg">₦</span>
                  <input
                    type="number"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="5,000"
                    className="w-full pl-10 pr-4 py-3 bg-background border border-border rounded-xl font-bold text-lg focus:outline-none focus:border-primary transition-colors"
                  />
                </div>
              </div>

              <button
                onClick={handlePay}
                disabled={!amount || Number(amount) <= 0}
                className="w-full h-12 rounded-xl bg-primary text-primary-foreground font-bold hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2 shadow-sm"
              >
                Pay with bank transfer / mobile money
              </button>
            </div>
          )}

          {status === 'loading' && (
            <div className="py-8 flex flex-col items-center justify-center gap-4 text-center">
              <svg className="animate-spin w-8 h-8 text-primary" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
              <p className="font-bold text-primary">Processing demo payment...</p>
            </div>
          )}

          {status === 'success' && (
            <div className="py-4 space-y-4 text-center">
              <div className="mx-auto w-12 h-12 bg-success/20 text-success rounded-full flex items-center justify-center border border-success/30">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7"></path></svg>
              </div>
              <h4 className="font-extrabold text-xl text-foreground">Demo conversion complete</h4>
              
              <div className="bg-muted/10 border border-border rounded-xl p-4 font-mono font-bold space-y-1">
                <p className="text-lg">₦{amount || '5,000'} &rarr; {(Number(amount || 5000) / 1000).toLocaleString(undefined, { maximumFractionDigits: 2 })} USDC</p>
                <p className="text-xs text-muted-foreground mt-2">Demo rate: ₦1,000 = 1 USDC</p>
              </div>

              <button
                onClick={onClose}
                className="w-full h-12 rounded-xl border border-border font-bold hover:bg-muted transition-colors mt-4"
              >
                Close Demo
              </button>
            </div>
          )}
        </div>
        
        <div className="bg-muted/30 p-4 border-t border-border text-center">
           <p className="text-[11px] font-bold text-muted-foreground">Demo preview only. No money was transferred or converted.</p>
        </div>
      </div>
    </div>
  );
}

function AjoContributionActions({ 
  activeCircle, 
  contribStatus 
}: { 
  activeCircle: any; 
  contribStatus: any;
}) {
  const { recordContribution } = useAjo();
  const [loading, setLoading] = useState(false);
  const [showNairaModal, setShowNairaModal] = useState(false);

  const simulateAll = async () => {
    setLoading(true);
    for (const memberId of activeCircle.members.map((m: any) => m.memberId)) {
      if (!contribStatus.contributedMemberIds.includes(memberId)) {
        await new Promise(r => setTimeout(r, 200));
        recordContribution(memberId, activeCircle.contributionAmount);
      }
    }
    setLoading(false);
  };

  return (
    <div className="pt-4 space-y-3">
      <button
        onClick={simulateAll}
        disabled={loading}
        className="w-full h-12 inline-flex items-center justify-center rounded-xl bg-secondary text-secondary-foreground hover:bg-secondary/80 text-xs sm:text-sm font-bold transition-colors disabled:opacity-50 border border-border px-2 text-center"
      >
        {loading ? 'Simulating...' : 'Simulate remaining contributions (Demo)'}
      </button>

      <button
        onClick={() => setShowNairaModal(true)}
        className="w-full h-12 inline-flex items-center justify-center rounded-xl bg-success/10 text-success hover:bg-success/20 text-xs sm:text-sm font-bold transition-colors border border-success/20 px-2 text-center"
      >
        Fund with Naira (Demo)
      </button>

      {showNairaModal && (
        <FundWithNairaModal onClose={() => setShowNairaModal(false)} />
      )}
    </div>
  );
}

function AjoPayoutButton({
  contribStatus,
  executePayout,
  payoutState,
  setPayoutState,
  setPayoutResult,
  activeCircle,
  recipientMember,
  potAmount
}: {
  contribStatus: any;
  executePayout: () => Promise<ExecutePayoutResult>;
  payoutState: string;
  setPayoutState: any;
  setPayoutResult: any;
  recipientMember: any;
  potAmount: number;
  activeCircle: any;
}) {
  const isEligible = contribStatus?.isFullyContributed;
  const { getClient } = usePollar();

  const handleExecute = async () => {
    setPayoutState('pending');
    setPayoutResult(null);
    try {
      const result = await executePayout();
      if (result.success) {
        setPayoutState('success');
        try {
          await getClient().fetchTxHistory({ limit: 20 });
        } catch (e) {
          console.error("Failed to refresh tx history", e);
        }
      } else {
        setPayoutState('error');
      }
      setPayoutResult(result);
    } catch (err) {
      setPayoutState('error');
      setPayoutResult({
        success: false,
        circle: activeCircle,
        error: err instanceof Error ? err.message : String(err)
      });
    }
  };

  if (!isEligible) {
    return (
      <button disabled className="w-full h-auto py-3 sm:py-0 sm:h-16 rounded-2xl bg-muted/50 text-muted-foreground font-bold cursor-not-allowed flex items-center justify-center gap-2 border border-border transition-colors text-sm sm:text-lg px-3 sm:px-4 text-center leading-tight">
        <svg className="w-4 h-4 sm:w-5 sm:h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"></path></svg>
        <span>Waiting for everyone to contribute</span>
      </button>
    );
  }

  if (payoutState === 'pending') {
    return (
      <button disabled className="w-full h-auto py-3 sm:py-0 sm:h-16 rounded-2xl bg-primary/70 text-primary-foreground font-bold flex items-center justify-center gap-2 sm:gap-3 cursor-wait text-sm sm:text-lg px-3 sm:px-4 text-center leading-tight">
        <svg className="animate-spin h-4 w-4 sm:h-5 sm:w-5 text-white shrink-0" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
        <span>Processing payout...</span>
      </button>
    );
  }

  if (payoutState === 'success') {
    return null;
  }

  if (payoutState === 'error') {
     return (
       <button 
         onClick={handleExecute}
         className="w-full h-auto py-3 sm:py-0 sm:h-16 rounded-2xl bg-destructive text-destructive-foreground font-extrabold hover:bg-destructive/90 transition-all shadow-md hover:shadow-lg hover:-translate-y-0.5 text-sm sm:text-lg px-3 sm:px-4 text-center leading-tight"
       >
         Retry execution
       </button>
     );
  }

  // Eligible state
  return (
    <button 
      onClick={handleExecute}
      className="w-full h-auto py-4 sm:py-0 sm:h-16 rounded-2xl bg-primary text-primary-foreground font-extrabold hover:bg-primary/90 transition-all shadow-md hover:shadow-lg hover:-translate-y-0.5 text-sm sm:text-lg px-3 sm:px-4 flex flex-col sm:flex-row items-center justify-center leading-tight gap-1 sm:gap-2"
    >
      <span>Everyone has paid &rarr; Send the money</span>
    </button>
  );
}
