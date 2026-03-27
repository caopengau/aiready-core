'use client';

import React from 'react';
import { useSearchParams } from 'next/navigation';
import { Layers, Zap, Activity, Shield, Terminal } from 'lucide-react';

interface DashboardClientProps {
  user: any;
  isAdmin?: boolean;
  pendingCheckout?: boolean;
  status: {
    awsSpendCents: number;
    awsInclusionCents: number;
    aiTokenBalanceCents: number;
    aiRefillThresholdCents: number;
    mutationCount: number;
    coEvolutionOptIn: boolean;
    autoTopupEnabled: boolean;
    recentMutations: any[];
    // Real account data
    activeRepos?: number;
    awsAccountId?: string | null;
    repoUrl?: string | null;
    provisioningStatus?: 'provisioning' | 'complete' | 'failed' | null;
    planStatus?: string;
  };
}

export default function DashboardClient({
  user,
  isAdmin: _isAdmin,
  status,
  pendingCheckout,
}: DashboardClientProps) {
  const searchParams = useSearchParams();
  const activeTab = searchParams.get('tab') || 'overview';

  const [isCoevolutionEnabled, setIsCoevolutionEnabled] = React.useState(
    status.coEvolutionOptIn
  );
  const [isAutoTopupEnabled, setIsAutoTopupEnabled] = React.useState(
    status.autoTopupEnabled
  );
  const [topupThresholdCents, setTopupThresholdCents] = React.useState(
    status.aiRefillThresholdCents
  );
  const [topupAmountCents, setTopupAmountCents] = React.useState(1000); // $10.00 default

  // Checkout state
  const [isCheckingOut, setIsCheckingOut] = React.useState(false);

  // Provisioning polling state
  const [provisionStatus, setProvisionStatus] = React.useState(
    status.provisioningStatus || 'none'
  );
  const [provisionAccountId, setProvisionAccountId] = React.useState(
    status.awsAccountId
  );
  const [provisionRepoUrl, setProvisionRepoUrl] = React.useState(
    status.repoUrl
  );
  const [pollCount, setPollCount] = React.useState(0);

  // Provisioning status polling
  React.useEffect(() => {
    if (provisionStatus !== 'provisioning') return;
    if (pollCount >= 120) return; // Stop after 10 minutes (5s * 120)

    const interval = setInterval(async () => {
      try {
        const res = await fetch('/api/account/status');
        if (res.ok) {
          const data = await res.json();
          setProvisionStatus(data.status);
          if (data.accounts?.[0]) {
            setProvisionAccountId(data.accounts[0].awsAccountId);
            setProvisionRepoUrl(data.accounts[0].repoUrl);
          }
          if (data.status === 'complete' || data.status === 'failed') {
            clearInterval(interval);
          }
        }
      } catch (err) {
        console.error('Provisioning poll error:', err);
      }
      setPollCount((c) => c + 1);
    }, 5000);

    return () => clearInterval(interval);
  }, [provisionStatus, pollCount]);

  // Checkout handler
  const handleCheckout = async () => {
    if (isCheckingOut) return;
    setIsCheckingOut(true);
    try {
      const res = await fetch('/api/billing/checkout', { method: 'POST' });
      if (!res.ok) throw new Error('Checkout failed');
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      }
    } catch (err) {
      console.error('Checkout error:', err);
      alert('Failed to start checkout. Please try again.');
    } finally {
      setIsCheckingOut(false);
    }
  };

  // Manage subscription handler (opens Stripe Customer Portal)
  const handleManageSubscription = async () => {
    if (isCheckingOut) return;
    setIsCheckingOut(true);
    try {
      const res = await fetch('/api/billing/portal', { method: 'POST' });
      if (!res.ok) throw new Error('Portal request failed');
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      }
    } catch (err) {
      console.error('Portal error:', err);
      alert('Unable to open billing portal. Please contact support.');
    } finally {
      setIsCheckingOut(false);
    }
  };

  // --- Persistence Logic ---
  const saveSettings = async (updates: any) => {
    try {
      await fetch('/api/user/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });
    } catch (err) {
      console.error('Failed to save settings:', err);
    }
  };

  // Co-evolution toggle
  const handleCoevolutionToggle = (enabled: boolean) => {
    setIsCoevolutionEnabled(enabled);
    saveSettings({ coEvolutionOptIn: enabled });
  };

  // Auto-topup toggle
  const handleAutoTopupToggle = (enabled: boolean) => {
    setIsAutoTopupEnabled(enabled);
    saveSettings({ autoTopupEnabled: enabled });
  };

  // Debounced threshold save
  React.useEffect(() => {
    if (topupThresholdCents === status.aiRefillThresholdCents) return;

    const timer = setTimeout(() => {
      saveSettings({ aiRefillThresholdCents: topupThresholdCents });
    }, 1000);

    return () => clearTimeout(timer);
  }, [topupThresholdCents, status.aiRefillThresholdCents]);

  // Detect nearest AWS region based on timezone
  const [detectedRegion, setDetectedRegion] = React.useState('ap-southeast-2');

  React.useEffect(() => {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const regionMap: Record<string, string> = {
      'Australia/Sydney': 'ap-southeast-2',
      'Australia/Melbourne': 'ap-southeast-2',
      'America/New_York': 'us-east-1',
      'America/Chicago': 'us-east-2',
      'America/Los_Angeles': 'us-west-2',
      'Europe/London': 'eu-west-2',
      'Europe/Paris': 'eu-west-3',
      'Europe/Frankfurt': 'eu-central-1',
      'Asia/Tokyo': 'ap-northeast-1',
      'Asia/Singapore': 'ap-southeast-1',
    };

    // Find a match or default to ap-southeast-2
    const region =
      Object.entries(regionMap).find(([key]) => tz.includes(key))?.[1] ||
      'ap-southeast-2';
    setDetectedRegion(region);
  }, []);

  // --- Pending Checkout View ---
  if (pendingCheckout) {
    return (
      <div className="max-w-2xl mx-auto py-20 px-6 text-center font-sans animate-in fade-in slide-in-from-bottom-4 duration-700">
        <div className="bg-zinc-900/50 border border-white/5 rounded-[32px] p-12 shadow-2xl">
          <div className="w-16 h-16 rounded-2xl bg-cyber-blue/10 border border-cyber-blue/20 flex items-center justify-center mb-8 mx-auto">
            <Zap className="w-8 h-8 text-cyber-blue" />
          </div>
          <h1 className="text-3xl font-black italic tracking-tight mb-4 uppercase">
            Complete Your <span className="text-cyber-blue">Setup</span>
          </h1>
          <p className="text-zinc-400 text-sm leading-relaxed mb-10 max-w-md mx-auto">
            Your account is ready. Subscribe to the Managed Platform to activate
            your dedicated AWS infrastructure and unlock autonomous code
            evolution.
          </p>
          <div className="bg-black/40 border border-white/5 rounded-2xl p-6 mb-8">
            <div className="flex justify-between items-center mb-2">
              <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest">
                Plan
              </span>
              <span className="text-sm font-black text-white italic uppercase">
                Managed Platform
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest">
                Monthly
              </span>
              <span className="text-2xl font-black text-cyber-blue italic">
                $29<span className="text-sm text-zinc-500">/mo</span>
              </span>
            </div>
          </div>
          <button
            onClick={handleCheckout}
            disabled={isCheckingOut}
            className="w-full py-4 bg-cyber-blue hover:bg-white text-black rounded-2xl text-sm font-black uppercase italic tracking-widest transition-all shadow-[0_0_30px_rgba(0,224,255,0.2)] hover:shadow-white/20 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isCheckingOut ? 'Redirecting...' : 'Subscribe Now'}
          </button>
          <p className="text-[9px] text-zinc-600 font-mono mt-6 uppercase tracking-widest">
            Secure checkout powered by Stripe
          </p>
        </div>
      </div>
    );
  }

  // --- Provisioning Banner ---
  const showProvisioningBanner = provisionStatus === 'provisioning';
  const showProvisioningFailed = provisionStatus === 'failed';

  return (
    <div className="max-w-6xl mx-auto py-10 md:py-16 px-6 sm:px-10 font-sans animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-12 gap-8">
        <div className="space-y-2">
          <h1 className="text-4xl md:text-5xl font-black tracking-tighter italic">
            Dashboard <span className="text-cyber-blue">Core</span>
          </h1>
          <p className="text-zinc-500 font-mono text-[10px] uppercase tracking-[0.4em]">
            System Status • {activeTab.toUpperCase()}
          </p>
        </div>

        <div className="flex items-center gap-4 bg-zinc-900/40 border border-white/5 p-4 rounded-3xl backdrop-blur-xl shadow-2xl">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-cyber-blue to-purple-600 flex items-center justify-center font-bold text-lg shadow-[0_0_20px_rgba(0,224,255,0.3)]">
            {user.name?.[0] || user.email?.[0] || 'U'}
          </div>
          <div>
            <p className="text-sm font-black italic tracking-tight">
              {user.name || 'Developer'}
            </p>
            <p className="text-[9px] text-zinc-500 font-mono uppercase tracking-widest truncate max-w-[150px]">
              {user.email}
            </p>
          </div>
        </div>
      </div>

      <div className="w-full space-y-12">
        {/* Provisioning Banner */}
        {showProvisioningBanner && (
          <div className="bg-cyber-blue/5 border border-cyber-blue/20 rounded-2xl p-6 animate-in fade-in slide-in-from-bottom-2 duration-500">
            <div className="flex items-center gap-4">
              <div className="w-3 h-3 rounded-full bg-cyber-blue animate-pulse shadow-[0_0_12px_rgba(0,224,255,0.8)]" />
              <div>
                <p className="text-sm font-black italic text-white uppercase tracking-tight">
                  Setting Up Your Managed AWS Account
                </p>
                <p className="text-[10px] text-zinc-400 font-mono uppercase tracking-widest mt-1">
                  This usually takes 2-3 minutes. Your dashboard will update
                  automatically.
                </p>
              </div>
            </div>
            <div className="mt-4 w-full bg-zinc-800 h-1 rounded-full overflow-hidden">
              <div
                className="bg-cyber-blue h-full animate-pulse transition-all duration-1000"
                style={{ width: '60%' }}
              />
            </div>
          </div>
        )}

        {/* Provisioning Failed Banner */}
        {showProvisioningFailed && (
          <div className="bg-rose-500/5 border border-rose-500/20 rounded-2xl p-6 animate-in fade-in slide-in-from-bottom-2 duration-500">
            <div className="flex items-center gap-4">
              <div className="w-3 h-3 rounded-full bg-rose-500 shadow-[0_0_12px_rgba(239,68,68,0.8)]" />
              <div>
                <p className="text-sm font-black italic text-white uppercase tracking-tight">
                  Provisioning Failed
                </p>
                <p className="text-[10px] text-zinc-400 font-mono uppercase tracking-widest mt-1">
                  There was an issue setting up your account. Please contact
                  support.
                </p>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'overview' ? (
          <div className="bg-zinc-900/50 border border-white/5 rounded-3xl p-8 animate-in fade-in slide-in-from-bottom-2 duration-500">
            <h2 className="text-2xl font-black italic mb-10 tracking-tight text-white uppercase flex items-center gap-3">
              <Layers className="w-5 h-5 text-cyber-blue" />
              Account <span className="text-cyber-blue">Overview</span>
            </h2>

            <div className="space-y-8">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* AWS Compute Usage Card */}
                <div className="bg-black/40 border border-white/5 rounded-2xl p-8 relative overflow-hidden group">
                  <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                    <Layers className="w-24 h-24" />
                  </div>
                  <h3 className="text-[10px] font-mono uppercase tracking-[0.2em] text-zinc-500 mb-6">
                    AWS Compute Usage
                  </h3>
                  <div className="flex items-end gap-3 mb-8">
                    <span className="text-4xl font-black text-white italic">
                      ${(status.awsSpendCents / 100).toFixed(2)}
                    </span>
                    <span className="text-zinc-500 text-sm mb-1 font-mono uppercase tracking-tighter">
                      / ${(status.awsInclusionCents / 100).toFixed(2)} Platform
                    </span>
                  </div>
                  <div className="space-y-4">
                    <div className="w-full bg-zinc-800 h-2 rounded-full overflow-hidden">
                      <div
                        className="bg-cyber-blue h-full shadow-[0_0_10px_rgba(0,224,255,0.5)] transition-all duration-1000"
                        style={{
                          width: `${Math.min((status.awsSpendCents / status.awsInclusionCents) * 100, 100)}%`,
                        }}
                      ></div>
                    </div>
                    <div className="flex justify-between text-[10px] font-mono">
                      <span className="text-zinc-400 uppercase tracking-tighter">
                        Resource Utilization
                      </span>
                      <span className="text-cyber-blue font-bold">
                        {(
                          (status.awsSpendCents / status.awsInclusionCents) *
                          100
                        ).toFixed(1)}
                        %
                      </span>
                    </div>
                  </div>
                </div>

                {/* AI Fuel Tank Card */}
                <div className="bg-black/40 border border-white/5 rounded-2xl p-8 relative overflow-hidden group">
                  <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                    <Zap className="w-24 h-24 text-amber-500" />
                  </div>
                  <h3 className="text-[10px] font-mono uppercase tracking-[0.2em] text-zinc-500 mb-6">
                    AI Fuel Tank
                  </h3>
                  <div className="flex items-end gap-3 mb-8">
                    <span className="text-4xl font-black text-amber-500 italic">
                      ${(status.aiTokenBalanceCents / 100).toFixed(2)}
                    </span>
                    <span className="text-zinc-500 text-sm mb-1 font-mono uppercase tracking-tighter">
                      Credits Remaining
                    </span>
                  </div>
                  <div className="space-y-4">
                    <div className="w-full bg-zinc-800 h-2 rounded-full overflow-hidden">
                      <div
                        className="bg-amber-500 h-full shadow-[0_0_10px_rgba(245,158,11,0.5)] transition-all duration-1000"
                        style={{
                          width: `${Math.min((status.aiTokenBalanceCents / 1000) * 100, 100)}%`,
                        }}
                      ></div>
                    </div>
                    <div className="flex justify-between text-[10px] font-mono">
                      <span className="text-zinc-400 uppercase tracking-tighter">
                        Evolution Fuel Level
                      </span>
                      <span className="text-amber-500 font-bold">
                        {status.aiTokenBalanceCents <=
                        status.aiRefillThresholdCents
                          ? 'CRITICAL LOW'
                          : 'OPTIMAL'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-8">
                <h3 className="text-[10px] font-mono uppercase tracking-[0.2em] text-zinc-500 mb-6">
                  Quick Stats
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {[
                    {
                      label: 'Auto-Fixes Applied',
                      value: status.mutationCount,
                      icon: Activity,
                      color: 'text-cyber-purple',
                    },
                    {
                      label: 'Active Repos',
                      value: status.activeRepos ?? 0,
                      icon: Layers,
                      color: 'text-cyber-blue',
                    },
                    {
                      label: 'Health Score',
                      value:
                        status.mutationCount > 0
                          ? `${Math.round((status.recentMutations.filter((m: any) => m.mutationStatus === 'SUCCESS').length / status.mutationCount) * 100)}%`
                          : '\u2014',
                      icon: Shield,
                      color: 'text-emerald-500',
                    },
                    {
                      label: 'Plan',
                      value: status.planStatus || 'FREE',
                      icon: Zap,
                      color: 'text-amber-500',
                    },
                  ].map((item, i) => (
                    <div
                      key={i}
                      className="bg-black/40 border border-white/5 p-6 rounded-2xl flex flex-col gap-3 hover:border-white/10 transition-colors"
                    >
                      <item.icon className={`w-4 h-4 ${item.color}`} />
                      <div className="space-y-1">
                        <span className="text-[8px] font-mono text-zinc-600 uppercase tracking-widest block">
                          {item.label}
                        </span>
                        <span className="text-lg font-black text-white italic">
                          {item.value}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-black/40 border border-white/5 rounded-2xl p-8 relative overflow-hidden group">
                <div className="absolute inset-0 bg-gradient-to-br from-cyber-blue/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                <h2 className="text-xl font-bold mb-8 flex items-center gap-3 italic">
                  <Activity className="w-5 h-5 text-cyber-blue" />
                  Recent Fixes
                </h2>

                <div className="space-y-4">
                  {status.recentMutations?.length > 0 ? (
                    status.recentMutations.map((mutation: any, i: number) => (
                      <div
                        key={mutation.mutationId || i}
                        className="flex items-center gap-4 p-5 rounded-2xl bg-black/40 border border-white/5 hover:border-cyber-blue/20 transition-all group"
                      >
                        <div className="w-12 h-12 rounded-xl bg-zinc-800 flex items-center justify-center border border-white/5 group-hover:bg-zinc-700 transition-colors">
                          <Zap
                            className={`w-5 h-5 ${mutation.mutationStatus === 'FAILURE' ? 'text-rose-500' : 'text-amber-500'}`}
                          />
                        </div>
                        <div className="flex-grow">
                          <p className="text-sm font-black italic text-white uppercase tracking-tight">
                            {mutation.mutationType || 'Infrastructure Mutation'}
                          </p>
                          <p className="text-[10px] text-zinc-500 font-mono uppercase tracking-widest mt-1">
                            {mutation.mutationStatus === 'SUCCESS'
                              ? 'Successful Commit'
                              : 'Mutation Failed'}{' '}
                            •{' '}
                            {new Date(mutation.createdAt).toLocaleDateString()}
                          </p>
                        </div>
                        <div className="text-right">
                          <p
                            className={`text-xs font-black italic uppercase ${mutation.mutationStatus === 'FAILURE' ? 'text-rose-500' : 'text-emerald-500'}`}
                          >
                            {mutation.mutationStatus === 'FAILURE'
                              ? 'RETRY'
                              : '+1 SCR'}
                          </p>
                          <p className="text-[8px] text-zinc-700 font-mono tracking-tighter mt-1 group-hover:text-zinc-500 transition-colors">
                            ID: {mutation.mutationId?.slice(0, 8).toUpperCase()}
                          </p>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="py-12 text-center bg-black/20 border border-white/5 border-dashed rounded-2xl">
                      <p className="text-[10px] font-mono text-zinc-600 uppercase tracking-widest">
                        No fixes applied yet
                      </p>
                      <p className="text-[9px] text-zinc-700 mt-2 font-mono">
                        Fixes will appear here after your first scan
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        ) : activeTab === 'nodes' ? (
          <div className="bg-zinc-900/50 border border-white/5 rounded-3xl p-8 animate-in fade-in slide-in-from-bottom-2 duration-500">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-12 gap-6">
              <div className="space-y-1">
                <h2 className="text-2xl font-black italic tracking-tight">
                  Managed Hubs
                </h2>
                <p className="text-zinc-500 text-[10px] font-mono uppercase tracking-[0.3em]">
                  Distributed Intelligence Fabric
                </p>
              </div>
              <button className="px-6 py-3 bg-cyber-blue text-black font-black uppercase italic text-xs rounded-xl hover:bg-white transition-all flex items-center gap-3 shadow-[0_0_20px_rgba(0,224,255,0.2)]">
                <Zap className="w-4 h-4" />
                Deploy New Node
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {/* Primary Hub Node */}
              <div className="bg-black/60 border border-cyber-blue/20 rounded-2xl p-8 relative overflow-hidden group hover:border-cyber-blue/50 transition-all shadow-xl">
                <div className="absolute top-0 right-0 p-6 opacity-10 group-hover:opacity-20 transition-opacity">
                  <Terminal className="w-20 h-20 text-cyber-blue" />
                </div>

                <div className="flex items-center gap-3 mb-8">
                  <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_12px_rgba(16,185,129,0.8)]" />
                  <span className="text-[10px] font-mono text-emerald-500 uppercase font-black tracking-widest">
                    ACTIVE_HUB_001
                  </span>
                </div>

                <h3 className="text-xl font-black italic text-white mb-2">
                  Primary Synthesis Hub
                </h3>
                <p className="text-[10px] text-zinc-600 font-mono mb-8 uppercase tracking-widest">
                  Region: {detectedRegion}
                </p>

                <div className="space-y-4 mb-8">
                  <div className="flex justify-between text-[10px] font-mono border-b border-white/5 pb-2">
                    <span className="text-zinc-600 uppercase">
                      Evolution Loop:
                    </span>
                    <span className="text-cyber-blue font-bold">
                      SYNCHRONIZED
                    </span>
                  </div>
                  <div className="flex justify-between text-[10px] font-mono border-b border-white/5 pb-2">
                    <span className="text-zinc-600 uppercase">
                      Active Agents:
                    </span>
                    <span className="text-white">
                      Reflector, Planner, Coder
                    </span>
                  </div>
                  <div className="flex justify-between text-[10px] font-mono border-b border-white/5 pb-2">
                    <span className="text-zinc-600 uppercase">
                      Traffic Gate:
                    </span>
                    <span className="text-white font-bold">ENABLED</span>
                  </div>
                </div>

                <div className="flex gap-3">
                  <button className="flex-1 py-3 bg-white/5 hover:bg-white/10 text-white text-[10px] font-black uppercase tracking-widest rounded-xl border border-white/10 transition-all">
                    Terminal
                  </button>
                  <button className="flex-1 py-3 bg-white/5 hover:bg-white/10 text-white text-[10px] font-black uppercase tracking-widest rounded-xl border border-white/10 transition-all">
                    Config
                  </button>
                </div>
              </div>

              {/* Placeholder for expansion */}
              <div className="bg-black/20 border border-white/5 border-dashed rounded-2xl p-8 flex flex-col items-center justify-center text-center group cursor-pointer hover:bg-white/[0.03] transition-all hover:border-cyber-blue/30">
                <div className="w-14 h-14 rounded-full border border-white/10 flex items-center justify-center mb-6 text-zinc-700 group-hover:text-cyber-blue group-hover:border-cyber-blue/50 transition-all shadow-inner">
                  <Zap className="w-6 h-6" />
                </div>
                <p className="text-xs font-black text-zinc-600 group-hover:text-zinc-300 transition-colors uppercase tracking-[0.2em]">
                  Scale Regional Node
                </p>
                <p className="text-[9px] text-zinc-700 mt-4 font-mono leading-relaxed max-w-[180px]">
                  Expand your intelligence mesh to other AWS regions or separate
                  accounts.
                </p>
              </div>
            </div>
          </div>
        ) : activeTab === 'settings' ? (
          <div className="bg-zinc-900/50 border border-white/5 rounded-3xl p-8 animate-in fade-in slide-in-from-bottom-2 duration-500">
            <h2 className="text-2xl font-black italic mb-10 tracking-tight text-white uppercase">
              AI Credits & <span className="text-cyber-blue">Settings</span>
            </h2>

            <div className="space-y-12">
              <div>
                <h3 className="text-sm font-black text-amber-500 mb-3 flex items-center gap-2 uppercase tracking-tight">
                  <Zap className="w-4 h-4" /> Credit Sharing & Savings
                </h3>
                <p className="text-xs text-zinc-500 mb-8 leading-relaxed font-mono italic max-w-2xl">
                  Share anonymous code patterns with our community to earn
                  credit discounts. Your code stays private — we only learn from
                  the structure, never the content.
                </p>

                <div className="bg-black/60 p-8 rounded-3xl border border-white/5 space-y-8 shadow-2xl">
                  <div className="flex items-center justify-between gap-6">
                    <div>
                      <p className="text-sm font-black italic text-white uppercase tracking-tight">
                        Share Patterns for Discounts
                      </p>
                      <p className="text-[10px] text-zinc-600 uppercase tracking-widest mt-1">
                        Anonymous code structure shared to improve the platform
                      </p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer scale-110">
                      <input
                        type="checkbox"
                        className="sr-only peer"
                        checked={isCoevolutionEnabled}
                        onChange={(e) =>
                          handleCoevolutionToggle(e.target.checked)
                        }
                      />
                      <div className="w-12 h-6 bg-zinc-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500 shadow-inner"></div>
                    </label>
                  </div>

                  <div className="pt-8 border-t border-white/5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                      <p className="text-[9px] font-mono uppercase tracking-[0.3em] text-zinc-600 mb-2">
                        Evolution Status
                      </p>
                      <p
                        className={`text-xs font-black italic ${isCoevolutionEnabled ? 'text-emerald-500 uppercase' : 'text-amber-500 uppercase'}`}
                      >
                        {isCoevolutionEnabled
                          ? 'WAVE_SYNC_ACTIVE • Mutation Tax waived'
                          : 'PRIVATE_FORK_ACTIVE • $1.00 Mutation Tax applied'}
                      </p>
                    </div>
                    <div
                      className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest self-start ${
                        isCoevolutionEnabled
                          ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.1)]'
                          : 'bg-amber-500/10 border border-amber-500/20 text-amber-500 shadow-[0_0_15px_rgba(245,158,11,0.1)]'
                      }`}
                    >
                      {isCoevolutionEnabled
                        ? 'Syncing Active'
                        : 'Isolated Mode'}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : activeTab === 'account' ? (
          <div className="bg-zinc-900/50 border border-white/5 rounded-3xl p-8 animate-in fade-in slide-in-from-bottom-2 duration-500">
            <h2 className="text-2xl font-black italic mb-12 tracking-tight uppercase">
              Billing & <span className="text-cyber-blue">Identity</span>
            </h2>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 mb-12">
              <div className="space-y-6">
                <h3 className="text-[10px] font-mono uppercase tracking-[0.4em] text-zinc-600">
                  Identity Profile
                </h3>
                <div className="bg-black/60 border border-white/5 p-8 rounded-3xl shadow-xl">
                  <div className="flex items-center gap-6 mb-8">
                    <div className="w-16 h-16 rounded-[24px] bg-cyber-blue/10 flex items-center justify-center text-cyber-blue font-black text-2xl border border-cyber-blue/30 shadow-[0_0_30px_rgba(0,224,255,0.1)]">
                      {user.name?.[0] || user.email?.[0] || 'U'}
                    </div>
                    <div className="space-y-1">
                      <p className="text-xl font-black italic text-white uppercase tracking-tight">
                        {user.name || 'Synthesis Engine dev'}
                      </p>
                      <p className="text-[10px] text-zinc-600 font-mono uppercase tracking-widest">
                        {user.email}
                      </p>
                    </div>
                  </div>
                  <div className="space-y-4 pt-6 border-t border-white/5">
                    <div className="flex justify-between items-center bg-white/[0.02] p-3 rounded-xl border border-white/5">
                      <span className="text-[9px] text-zinc-600 uppercase font-black tracking-widest">
                        Protocol Status
                      </span>
                      <span
                        className={`font-black italic text-[10px] uppercase tracking-widest ${
                          status.planStatus === 'MANAGED'
                            ? 'text-emerald-500'
                            : 'text-zinc-500'
                        }`}
                      >
                        {status.planStatus === 'MANAGED'
                          ? 'MANAGED'
                          : 'FREE_TIER'}
                      </span>
                    </div>
                    <div className="flex justify-between items-center bg-white/[0.02] p-3 rounded-xl border border-white/5">
                      <span className="text-[9px] text-zinc-600 uppercase font-black tracking-widest">
                        Access Level
                      </span>
                      <span className="text-white font-black italic text-[10px] uppercase tracking-widest">
                        Managed Beta
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-6">
                <h3 className="text-[10px] font-mono uppercase tracking-[0.4em] text-zinc-600">
                  Active Controller
                </h3>
                <div className="bg-black/60 border border-white/5 p-8 rounded-3xl shadow-xl relative overflow-hidden group">
                  <Shield className="absolute -bottom-4 -right-4 w-32 h-32 opacity-5 text-white group-hover:opacity-10 transition-opacity" />
                  <div className="space-y-6 relative z-10">
                    <div className="flex justify-between items-center pb-4 border-b border-white/5">
                      <span className="text-[10px] font-mono text-zinc-600 uppercase tracking-widest">
                        AWS ID
                      </span>
                      <span className="text-xs font-black text-white italic">
                        {provisionAccountId
                          ? provisionAccountId.replace(
                              /(\d{4})(\d{4})(\d{4})/,
                              '$1-$2-$3'
                            )
                          : provisionStatus === 'provisioning'
                            ? 'Provisioning...'
                            : '\u2014'}
                      </span>
                    </div>
                    <div className="flex justify-between items-center pb-4 border-b border-white/5">
                      <span className="text-[10px] font-mono text-zinc-600 uppercase tracking-widest">
                        Deployment Zone
                      </span>
                      <span className="text-[10px] font-black text-cyber-blue px-3 py-1 bg-cyber-blue/10 border border-cyber-blue/20 rounded-lg uppercase tracking-widest">
                        {detectedRegion}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] font-mono text-zinc-600 uppercase tracking-widest">
                        Heartbeat
                      </span>
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]"></div>
                        <span className="text-[10px] font-black text-emerald-500 uppercase tracking-widest">
                          SECURE_SYNC
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Billing Card */}
            <div className="bg-zinc-900/60 border border-white/5 rounded-[40px] overflow-hidden shadow-[0_30px_60px_rgba(0,0,0,0.5)]">
              <div className="grid grid-cols-1 lg:grid-cols-2">
                <div className="p-10 md:p-14 bg-gradient-to-br from-zinc-800/40 to-transparent border-r border-white/5 relative overflow-hidden group">
                  <Zap className="absolute -top-12 -left-12 w-64 h-64 opacity-5 text-white group-hover:scale-110 transition-transform duration-1000" />
                  <div className="relative z-10">
                    <p className="text-[10px] font-mono text-zinc-500 uppercase tracking-[0.5em] mb-4">
                      Your Plan
                    </p>
                    <h4 className="text-3xl md:text-4xl font-black italic mb-6 text-white leading-tight uppercase tracking-tighter">
                      Managed
                      <br />
                      <span className="text-cyber-blue">Platform</span>
                    </h4>
                    <p className="text-xs text-zinc-500 mb-10 leading-relaxed font-mono italic">
                      $29/mo includes managed infrastructure, AI-powered fixes,
                      CI/CD integration, and $10/month in AI credits.
                    </p>
                    <button
                      onClick={handleManageSubscription}
                      disabled={isCheckingOut}
                      className="w-full py-4 bg-white hover:bg-zinc-200 text-black rounded-2xl text-xs font-black uppercase italic tracking-widest transition-all shadow-[0_0_30px_rgba(255,255,255,0.1)] hover:shadow-white/20 disabled:opacity-50"
                    >
                      {isCheckingOut ? 'Loading...' : 'Manage Subscription'}
                    </button>
                  </div>
                </div>

                <div className="p-10 md:p-14 bg-black/40">
                  <div className="flex justify-between items-start mb-10">
                    <div className="space-y-1">
                      <h3 className="text-sm font-black text-white flex items-center gap-3 uppercase italic tracking-tight">
                        <Zap className="w-4 h-4 text-amber-500" /> Auto Top-Up
                      </h3>
                      <p className="text-[8px] text-zinc-600 uppercase tracking-[0.4em] font-mono">
                        Never run out of AI credits
                      </p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer scale-110">
                      <input
                        type="checkbox"
                        className="sr-only peer"
                        checked={isAutoTopupEnabled}
                        onChange={(e) =>
                          handleAutoTopupToggle(e.target.checked)
                        }
                      />
                      <div className="w-11 h-6 bg-zinc-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-500 shadow-inner"></div>
                    </label>
                  </div>

                  {isAutoTopupEnabled ? (
                    <div className="space-y-10 animate-in fade-in slide-in-from-bottom-2 duration-500">
                      <div className="space-y-4">
                        <div className="flex justify-between text-[9px] font-mono uppercase tracking-widest">
                          <span className="text-zinc-600">Pulse Threshold</span>
                          <span className="text-white font-black">
                            ${(topupThresholdCents / 100).toFixed(2)}
                          </span>
                        </div>
                        <input
                          type="range"
                          min="200"
                          max="2000"
                          step="100"
                          value={topupThresholdCents}
                          onChange={(e) =>
                            setTopupThresholdCents(parseInt(e.target.value))
                          }
                          className="w-full h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-amber-500"
                        />
                      </div>

                      <div className="space-y-6">
                        <div className="flex justify-between text-[9px] font-mono uppercase tracking-widest">
                          <span className="text-zinc-600">Top-up Amount</span>
                          <span className="text-amber-500 font-black">
                            ${(topupAmountCents / 100).toFixed(2)}
                          </span>
                        </div>
                        <div className="grid grid-cols-3 gap-3">
                          {[1000, 2000, 5000].map((amount) => (
                            <button
                              key={amount}
                              onClick={() => setTopupAmountCents(amount)}
                              className={`py-3 text-[10px] font-black uppercase tracking-widest rounded-xl border transition-all italic ${
                                topupAmountCents === amount
                                  ? 'bg-amber-500/10 border-amber-500/40 text-amber-500 shadow-[0_0_15px_rgba(245,158,11,0.15)]'
                                  : 'bg-white/[0.03] border-white/10 text-zinc-600 hover:text-white hover:border-white/20'
                              }`}
                            >
                              ${amount / 100}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-12 text-center grayscale opacity-20">
                      <Zap className="w-12 h-12 text-zinc-500 mb-4" />
                      <p className="text-[10px] font-mono text-zinc-500 uppercase tracking-[0.4em]">
                        Autonomous Refill Offline
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
