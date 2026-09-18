"use client";

import Link from "next/link";
import { visibleGroups, type NavGroup, type TabLabel } from "./_nav";
import { useNekoUnlocked } from "./neko/_GateProvider";
import { useLabUnlocked } from "./_LabGateProvider";
import { nekoTabDesc } from "./neko/_cards";
import { useApiKeyHref } from "./_useApiKeyHref";
import { useI18n } from "./_i18n/LanguageProvider";
import type { Dictionary } from "./_i18n/translations";

function tabDesc(t: Dictionary, group: NavGroup, label: TabLabel): string {
  if (group.key === "neko") return nekoTabDesc(t, label);
  if (group.section === "walletAdapters") {
    return label === "setup"
      ? t.home.descs.setup
      : t.home.descs[group.key as keyof Dictionary["home"]["descs"]];
  }
  if (group.section === "integrations") {
    if (label === "overview") {
      if (group.key === "swap") return t.swapAbout.tagline;
      if (group.key === "earn") return t.earnAbout.tagline;
      return t.rampAbout.tagline;
    }
    if (label === "implementation") {
      if (group.key === "swap") return t.home.descs.swap;
      if (group.key === "earn") return t.home.descs.earn;
      return t.home.descs.ramp;
    }
    return t.home.descs[label as keyof Dictionary["home"]["descs"]];
  }
  if (label === "overview") {
    if (group.key === "trustlessWork") return t.twAbout.tagline;
    if (group.key === "nirium") return t.niriumAbout.tagline;
    if (group.key === "cosmosPay") return t.cosmosPayAbout.tagline;
    if (group.key === "lumenwipe") return t.lwAbout.tagline;
    if (group.key === "hedgepay") return t.hedgepayAbout.tagline;
    if (group.key === "vaquita") return t.vaquitaAbout.tagline;
    return "";
  }
  if (group.key === "cosmosPay") return t.cosmosPayAbout.tagline;
  return t.home.descs[label as keyof Dictionary["home"]["descs"]];
}

export default function Home() {
  const { t } = useI18n();
  const withApiKey = useApiKeyHref();
  const GROUPS = visibleGroups(useNekoUnlocked(), useLabUnlocked());

  return (
    <div className="w-full">
      {/* 1. Hero */}
      <div className="mb-10 space-y-4">
        <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-foreground">
          POLLAR PAY
        </h1>
        <p className="text-2xl sm:text-3xl font-bold text-primary mt-2">
          Tell your money what to do.
        </p>
        <p className="text-lg text-foreground font-semibold mt-4">
          Set the rules once. Let your money follow them.
        </p>
        <p className="text-base text-muted-foreground font-medium max-w-2xl mt-2 leading-relaxed">
          Choose what you're trying to accomplish, tell us how you want the money to move, and we'll turn it into a clear money policy.
        </p>
      </div>

      {/* 2. Compact engine pipeline */}
      <div className="mb-12">
        <div className="flex flex-wrap items-center gap-2 sm:gap-4 text-xs sm:text-sm font-mono text-muted-foreground uppercase tracking-wider bg-card border border-border p-4 rounded-xl overflow-x-auto whitespace-nowrap">
          <span className="font-bold text-foreground transition-opacity duration-500 hover:opacity-80">MONEY POLICY</span>
          <svg className="w-4 h-4 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
          <span className="font-bold text-foreground transition-opacity duration-500 delay-75 hover:opacity-80">RULES</span>
          <svg className="w-4 h-4 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
          <span className="font-bold text-foreground transition-opacity duration-500 delay-150 hover:opacity-80">CONDITIONS</span>
          <svg className="w-4 h-4 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
          <span className="font-bold text-foreground transition-opacity duration-500 delay-200 hover:opacity-80">CALCULATION</span>
          <svg className="w-4 h-4 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
          <span className="font-bold text-foreground transition-opacity duration-500 delay-300 hover:opacity-80">VALIDATION</span>
          <svg className="w-4 h-4 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
          <span className="font-bold text-foreground transition-opacity duration-500 delay-500 hover:opacity-80">ACTION</span>
          <svg className="w-4 h-4 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
          <span className="font-bold text-foreground transition-opacity duration-500 delay-700 hover:opacity-80">HISTORY</span>
        </div>
      </div>

      {/* 3. Three Modes */}
      <div className="mb-16 grid gap-6 md:grid-cols-3">
        {/* PERSONAL */}
        <div className="group relative flex flex-col justify-between overflow-hidden rounded-2xl border border-border bg-card p-6 transition-all duration-300 hover:border-primary/50 hover:-translate-y-1 hover:shadow-md">
          <div>
            <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3">POLICY TYPE: PERSONAL</h2>
            <h3 className="text-xl font-bold text-foreground mb-3">
              Tell your money where to go.
            </h3>
            <p className="text-sm text-muted-foreground font-medium mb-6">
              Personal budget &middot; Family support &middot; Salary allocation
            </p>
          </div>
          <Link href="/personal" className="inline-flex w-full justify-center items-center rounded-xl bg-muted px-4 py-3 text-sm font-bold text-foreground transition-colors hover:bg-primary hover:text-primary-foreground">
            Plan my money
          </Link>
        </div>

        {/* AJO */}
        <div className="group relative flex flex-col justify-between overflow-hidden rounded-2xl border-2 border-primary bg-primary/5 p-6 md:scale-105 shadow-lg transition-all duration-300 hover:shadow-xl hover:-translate-y-1">
          <div className="absolute top-4 right-4 flex h-6 items-center rounded-full bg-primary px-3 text-xs font-bold text-primary-foreground uppercase tracking-wide">
            LIVE POLLAR PROOF
          </div>
          <div>
            <h2 className="text-xs font-bold uppercase tracking-wider text-primary mb-3 mt-4">POLICY TYPE: AJO</h2>
            <h3 className="text-xl font-bold text-foreground mb-3">
              Tell your money what to do as a group.
            </h3>
            <p className="text-sm text-primary font-medium mb-6">
              Everyone contributes. The policy determines when the next payout can happen.
            </p>
          </div>
          <Link href="/ajo" className="inline-flex w-full justify-center items-center rounded-xl bg-primary px-4 py-3 text-sm font-bold text-primary-foreground transition-colors hover:bg-primary/90">
            Try Ajo
          </Link>
        </div>

        {/* SHARED GOAL */}
        <div className="group relative flex flex-col justify-between overflow-hidden rounded-2xl border border-border bg-card/50 p-6 opacity-80 transition-all duration-300 hover:opacity-100 hover:bg-card hover:-translate-y-1 hover:shadow-md">
          <div className="absolute top-4 right-4 flex h-6 items-center rounded-full bg-muted px-3 text-xs font-bold text-muted-foreground uppercase tracking-wide">
            POLICY PREVIEW
          </div>
          <div>
            <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3 mt-4">POLICY TYPE: SHARED GOAL</h2>
            <h3 className="text-xl font-bold text-foreground mb-3">
              Collect money for what matters.
            </h3>
            <p className="text-sm text-muted-foreground font-medium mb-6 italic">
              Class &middot; Birthday &middot; Wedding &middot; Burial &middot; Church &middot; Family &middot; Project
            </p>
          </div>
          <Link href="/shared-goal" className="inline-flex w-full justify-center items-center rounded-xl bg-muted px-4 py-3 text-sm font-bold text-muted-foreground transition-colors hover:bg-muted-foreground hover:text-background">
            Explore
          </Link>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-12 mb-16">
        {/* 4. How it works */}
        <section className="bg-card border border-border p-8 rounded-3xl shadow-sm">
          <h2 className="text-2xl font-bold text-foreground mb-6">Tell us what you want the money to do.</h2>
          <div className="space-y-6">
            <div className="flex gap-4">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 text-primary font-bold flex items-center justify-center">1</div>
              <div>
                <h3 className="font-bold text-foreground">Choose a purpose</h3>
                <p className="text-sm text-muted-foreground mt-1">Personal budget, family support, group contribution, Ajo, project fund, and more.</p>
              </div>
            </div>
            <div className="flex gap-4">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 text-primary font-bold flex items-center justify-center">2</div>
              <div>
                <h3 className="font-bold text-foreground">Create a Money Policy</h3>
                <p className="text-sm text-muted-foreground mt-1">Answer a few guided questions instead of writing rules yourself.</p>
              </div>
            </div>
            <div className="flex gap-4">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 text-primary font-bold flex items-center justify-center">3</div>
              <div>
                <h3 className="font-bold text-foreground">The engine evaluates it</h3>
                <p className="text-sm text-muted-foreground mt-1">Rules are calculated and validated deterministically.</p>
              </div>
            </div>
            <div className="flex gap-4">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 text-primary font-bold flex items-center justify-center">4</div>
              <div>
                <h3 className="font-bold text-foreground">Money moves when conditions are met</h3>
                <p className="text-sm text-muted-foreground mt-1">In the live Ajo proof, Pollar executes the resulting Stellar Testnet payment.</p>
              </div>
            </div>
          </div>
        </section>

        <div className="space-y-6">
          {/* 5. Why Pollar */}
          <section className="bg-card border border-border p-8 rounded-3xl shadow-sm">
            <h2 className="text-xl font-bold text-foreground mb-4">Why Pollar?</h2>
            <p className="text-primary font-bold mb-6">Pollar provides the financial rails. We provide the rules layer.</p>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <h4 className="text-sm font-bold text-muted-foreground uppercase tracking-wider mb-3">Pollar handles:</h4>
                <ul className="space-y-2 text-sm font-medium">
                  <li className="flex gap-2"><svg className="w-4 h-4 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>wallets</li>
                  <li className="flex gap-2"><svg className="w-4 h-4 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>payment execution</li>
                  <li className="flex gap-2"><svg className="w-4 h-4 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>Stellar Testnet settlement</li>
                </ul>
              </div>
              <div>
                <h4 className="text-sm font-bold text-muted-foreground uppercase tracking-wider mb-3">Pollar Pay handles:</h4>
                <ul className="space-y-2 text-sm font-medium">
                  <li className="flex gap-2"><svg className="w-4 h-4 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>purpose & policy</li>
                  <li className="flex gap-2"><svg className="w-4 h-4 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>rules & conditions</li>
                  <li className="flex gap-2"><svg className="w-4 h-4 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>calculation & validation</li>
                  <li className="flex gap-2"><svg className="w-4 h-4 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>workflow</li>
                </ul>
              </div>
            </div>
          </section>

          {/* 6. Real Testnet Proof */}
          <section className="bg-primary/5 border border-primary/20 p-8 rounded-3xl shadow-sm">
            <h2 className="text-xs font-bold text-primary uppercase tracking-widest mb-2">Real Testnet Proof</h2>
            <p className="text-lg font-bold text-foreground mb-4">A Money Policy executed through Pollar</p>
            <div className="bg-background border border-border p-4 rounded-xl flex flex-col gap-3">
              <div className="flex justify-between items-center">
                <span className="text-sm font-semibold text-muted-foreground">Amount</span>
                <span className="text-lg font-bold text-foreground">50 XLM</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm font-semibold text-muted-foreground">Network</span>
                <span className="text-sm font-bold text-foreground">Stellar Testnet</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm font-semibold text-muted-foreground">Execution</span>
                <span className="text-sm font-bold text-foreground">via Pollar SDK</span>
              </div>
            </div>
          </section>
        </div>
      </div>

      {/* 7. Developer / Pollar SDK Examples (Moved to bottom and de-emphasized) */}
      <div className="mt-24 border-t border-border pt-16 opacity-75 hover:opacity-100 transition-opacity">
        <div className="mb-8 text-center">
          <h2 className="text-xl font-bold text-muted-foreground mb-2">Developer / Pollar SDK Examples</h2>
          <p className="text-sm text-muted-foreground">The underlying starter functionality remains available here.</p>
        </div>
        <div className="space-y-10">
          {GROUPS.map((group) => (
            <section key={group.key} className="space-y-4">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground text-center sm:text-left">
                {t.nav.groups[group.key]}
              </h3>
              <div className="grid gap-3 sm:gap-4 sm:grid-cols-3 lg:grid-cols-4">
                {group.tabs.map(({ href, label }) => (
                  <Link
                    key={href}
                    href={withApiKey(href)}
                    className="group block rounded-xl border border-border bg-card p-4 hover:border-primary/50 transition-colors"
                  >
                    <p className="text-sm font-bold text-foreground group-hover:text-primary transition-colors">
                      {t.nav[label]}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                      {tabDesc(t, group, label)}
                    </p>
                  </Link>
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
