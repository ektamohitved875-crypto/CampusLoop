import { useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, Lock, Plus, Save, Trash2 } from 'lucide-react';
import {
  formatINR,
  loadOrInitBusinessInsights,
  saveBusinessInsights,
} from '../../lib/firestoreService';
import {
  INITIAL_BUSINESS_INSIGHTS,
  type BusinessInsightsState,
  type GTMChannelPlan,
  type ScenarioAssumptions,
} from '../../types/campusloop';

const CHANNEL_OPTIONS = [
  'Campus ambassadors',
  'Student referrals',
  'WhatsApp groups',
  'Instagram',
  'Student clubs',
  'Campus events',
  'College partnerships',
] as const;

export function BusinessInsightsPanel() {
  const [state, setState] = useState<BusinessInsightsState>({ ...INITIAL_BUSINESS_INSIGHTS });
  const [activeLab, setActiveLab] = useState<1 | 2 | 3>(1);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  useEffect(() => {
    loadOrInitBusinessInsights()
      .then((loaded) => setState(loaded))
      .catch(() => setFeedback({ type: 'err', text: 'Failed to load Business Insights from cloud.' }))
      .finally(() => setLoading(false));
  }, []);

  const persist = async (nextState: BusinessInsightsState, msg = 'Business insights saved to Firestore.') => {
    setSaving(true);
    setFeedback(null);
    try {
      await saveBusinessInsights(nextState);
      setState(nextState);
      setFeedback({ type: 'ok', text: msg });
    } catch {
      setFeedback({ type: 'err', text: 'Cloud save failed. Please retry.' });
    } finally {
      setSaving(false);
    }
  };

  const scenarioKey = state.revenuePricing.activeScenario;
  const scenario = state.revenuePricing.scenarios[scenarioKey];

  const updateScenarioField = (field: keyof ScenarioAssumptions, value: number) => {
    setState((prev) => ({
      ...prev,
      revenuePricing: {
        ...prev.revenuePricing,
        scenarios: {
          ...prev.revenuePricing.scenarios,
          [prev.revenuePricing.activeScenario]: {
            ...prev.revenuePricing.scenarios[prev.revenuePricing.activeScenario],
            [field]: Number.isFinite(value) ? Math.max(0, value) : 0,
          },
        },
      },
    }));
  };

  // Module 1 Calculations
  const revPerTx = scenario.transactionValue * (scenario.commissionRate / 100);
  const contributionPerTx = revPerTx - scenario.variableCost;
  const expectedMonthlyTx = scenario.expectedPayingCustomers * scenario.transactionsPerCustomer;
  const expectedMonthlyRevenue = revPerTx * expectedMonthlyTx;
  const totalMonthlyContribution = contributionPerTx * expectedMonthlyTx;
  const operatingSurplus = totalMonthlyContribution - scenario.monthlyFixedCost;
  const breakEvenTx =
    contributionPerTx > 0 ? Math.ceil(scenario.monthlyFixedCost / contributionPerTx) : null;

  // Module 2 Calculations
  const md = state.marketDemand;
  const tam = md.totalPotentialCustomers * md.annualSpendPerCustomer;
  const sam = md.serviceableCustomers * md.annualSpendPerCustomer;
  const som = md.obtainableCustomers * md.annualSpendPerCustomer;
  const customerRequirementMismatch =
    scenario.expectedPayingCustomers > md.obtainableCustomers;
  const funnelInconsistency =
    md.serviceableCustomers > md.totalPotentialCustomers ||
    md.obtainableCustomers > md.serviceableCustomers;

  // Module 3 Helpers
  const gtm = state.gtmLaunch;
  const totalGtmBudget = gtm.channels.reduce((sum, c) => sum + (Number(c.budget) || 0), 0);
  const totalGtmCustomers = gtm.channels.reduce(
    (sum, c) => sum + (Number(c.expectedCustomers) || 0),
    0,
  );

  const updateChannel = (id: string, patch: Partial<GTMChannelPlan>) => {
    setState((prev) => ({
      ...prev,
      gtmLaunch: {
        ...prev.gtmLaunch,
        channels: prev.gtmLaunch.channels.map((ch) => (ch.id === id ? { ...ch, ...patch } : ch)),
      },
    }));
  };

  const addChannel = () => {
    if (gtm.channels.length >= 3) return;
    setState((prev) => ({
      ...prev,
      gtmLaunch: {
        ...prev.gtmLaunch,
        channels: [
          ...prev.gtmLaunch.channels,
          {
            id: `ch_${Date.now()}`,
            channel: 'Instagram',
            budget: 1000,
            expectedLeads: 150,
            expectedCustomers: 25,
            reason: '',
            evidence: '',
          },
        ],
      },
    }));
  };

  const removeChannel = (id: string) => {
    setState((prev) => ({
      ...prev,
      gtmLaunch: {
        ...prev.gtmLaunch,
        channels: prev.gtmLaunch.channels.filter((c) => c.id !== id),
      },
    }));
  };

  if (loading) {
    return <div className="h-64 bg-white border border-slate-200 rounded-xl animate-pulse" />;
  }

  return (
    <div className="space-y-6">
      <div className="bg-white border border-slate-200 rounded-2xl p-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <p className="text-xs font-semibold text-teal-700">
              NEXUS Venture Framework · Founder Planning Console
            </p>
            <h2 className="text-xl font-display font-bold text-slate-900 mt-1">
              CampusLoop Business Insights
            </h2>
            <p className="text-xs text-slate-600 mt-1">
              Prefilled figures are marked <strong>Initial Venture Assumption — Needs Validation</strong> and do not represent verified historical revenue or market statistics.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              disabled={saving}
              onClick={() => persist(state)}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-slate-900 text-white text-xs font-semibold rounded-lg hover:bg-teal-700 cursor-pointer"
            >
              <Save className="w-3.5 h-3.5" />
              {saving ? 'Saving...' : 'Save Progress'}
            </button>
          </div>
        </div>

        {/* Sequential Lab Stepper */}
        <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-3">
          <button
            type="button"
            onClick={() => setActiveLab(1)}
            className={`p-4 rounded-xl border text-left transition-colors cursor-pointer ${
              activeLab === 1
                ? 'bg-[#0B192C] text-white border-[#0B192C]'
                : 'bg-slate-50 text-slate-900 border-slate-200 hover:bg-slate-100'
            }`}
          >
            <div className="flex items-center justify-between text-xs">
              <span className="font-mono">MODULE 01</span>
              {state.revenuePricing.completed && (
                <CheckCircle2 className="w-4 h-4 text-teal-400" />
              )}
            </div>
            <p className="mt-1 font-semibold text-sm">Revenue &amp; Pricing Lab</p>
          </button>

          <button
            type="button"
            disabled={!state.revenuePricing.completed}
            onClick={() => state.revenuePricing.completed && setActiveLab(2)}
            className={`p-4 rounded-xl border text-left transition-colors ${
              !state.revenuePricing.completed
                ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed'
                : activeLab === 2
                  ? 'bg-[#0B192C] text-white border-[#0B192C] cursor-pointer'
                  : 'bg-slate-50 text-slate-900 border-slate-200 hover:bg-slate-100 cursor-pointer'
            }`}
          >
            <div className="flex items-center justify-between text-xs">
              <span className="font-mono">MODULE 02</span>
              {!state.revenuePricing.completed ? (
                <Lock className="w-3.5 h-3.5" />
              ) : state.marketDemand.completed ? (
                <CheckCircle2 className="w-4 h-4 text-teal-400" />
              ) : null}
            </div>
            <p className="mt-1 font-semibold text-sm">Market Size &amp; Demand Lab</p>
          </button>

          <button
            type="button"
            disabled={!state.marketDemand.completed}
            onClick={() => state.marketDemand.completed && setActiveLab(3)}
            className={`p-4 rounded-xl border text-left transition-colors ${
              !state.marketDemand.completed
                ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed'
                : activeLab === 3
                  ? 'bg-[#0B192C] text-white border-[#0B192C] cursor-pointer'
                  : 'bg-slate-50 text-slate-900 border-slate-200 hover:bg-slate-100 cursor-pointer'
            }`}
          >
            <div className="flex items-center justify-between text-xs">
              <span className="font-mono">MODULE 03</span>
              {!state.marketDemand.completed ? (
                <Lock className="w-3.5 h-3.5" />
              ) : state.gtmLaunch.completed ? (
                <CheckCircle2 className="w-4 h-4 text-teal-400" />
              ) : null}
            </div>
            <p className="mt-1 font-semibold text-sm">Go-To-Market Launch Lab</p>
          </button>
        </div>

        {feedback && (
          <div
            className={`mt-4 p-3 rounded-lg text-xs ${
              feedback.type === 'ok'
                ? 'bg-teal-50 border border-teal-200 text-teal-900'
                : 'bg-red-50 border border-red-200 text-red-800'
            }`}
          >
            {feedback.text}
          </div>
        )}
      </div>

      {/* MODULE 1: REVENUE & PRICING LAB */}
      {activeLab === 1 && (
        <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
            <div>
              <h3 className="text-lg font-display font-bold text-slate-900">
                Module 1 — Revenue &amp; Pricing Lab
              </h3>
              <p className="text-xs text-slate-600 mt-0.5">
                Initial Venture Assumption — Needs Validation. Edit any input or switch scenarios below.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <select
                value={state.revenuePricing.revenueModel}
                onChange={(e) =>
                  setState((p) => ({
                    ...p,
                    revenuePricing: {
                      ...p.revenuePricing,
                      revenueModel: e.target.value as BusinessInsightsState['revenuePricing']['revenueModel'],
                    },
                  }))
                }
                className="px-3 py-1.5 text-xs font-medium bg-slate-50 border border-slate-200 rounded-lg"
              >
                <option value="Commission">Commission</option>
                <option value="Featured Listings">Featured Listings</option>
                <option value="Seller Promotion Fees">Seller Promotion Fees</option>
                <option value="Premium Membership">Premium Membership</option>
                <option value="Other">Other</option>
              </select>

              <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
                {(['conservative', 'base', 'ambitious'] as const).map((sc) => (
                  <button
                    key={sc}
                    type="button"
                    onClick={() =>
                      setState((p) => ({
                        ...p,
                        revenuePricing: { ...p.revenuePricing, activeScenario: sc },
                      }))
                    }
                    className={`px-3 py-1 text-xs font-medium rounded-md capitalize cursor-pointer ${
                      scenarioKey === sc ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'
                    }`}
                  >
                    {sc}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Calculated KPI Strip */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl">
              <p className="text-xs text-slate-500">Revenue per Transaction</p>
              <p className="mt-1 text-xl font-display font-bold text-slate-900 tabular-nums">
                {formatINR(revPerTx)}
              </p>
              <p className="text-[11px] text-slate-500 mt-1">
                Transaction Value × {scenario.commissionRate}%
              </p>
            </div>

            <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl">
              <p className="text-xs text-slate-500">Contribution per Transaction</p>
              <p
                className={`mt-1 text-xl font-display font-bold tabular-nums ${
                  contributionPerTx <= 0 ? 'text-red-700' : 'text-slate-900'
                }`}
              >
                {formatINR(contributionPerTx)}
              </p>
              <p className="text-[11px] text-slate-500 mt-1">
                Revenue/Tx − Variable Cost ({formatINR(scenario.variableCost)})
              </p>
            </div>

            <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl">
              <p className="text-xs text-slate-500">Expected Monthly Transactions</p>
              <p className="mt-1 text-xl font-display font-bold text-slate-900 tabular-nums">
                {expectedMonthlyTx.toFixed(0)}
              </p>
              <p className="text-[11px] text-slate-500 mt-1">
                {scenario.expectedPayingCustomers} customers × {scenario.transactionsPerCustomer} tx
              </p>
            </div>

            <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl">
              <p className="text-xs text-slate-500">Expected Monthly Revenue</p>
              <p className="mt-1 text-xl font-display font-bold text-slate-900 tabular-nums">
                {formatINR(expectedMonthlyRevenue)}
              </p>
              <p className="text-[11px] text-slate-500 mt-1">Initial Venture Assumption — Needs Validation</p>
            </div>

            <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl">
              <p className="text-xs text-slate-500">Operating Surplus / Deficit</p>
              <p
                className={`mt-1 text-xl font-display font-bold tabular-nums ${
                  operatingSurplus >= 0 ? 'text-teal-700' : 'text-red-700'
                }`}
              >
                {operatingSurplus >= 0 ? `+${formatINR(operatingSurplus)}` : formatINR(operatingSurplus)}
              </p>
              <p className="text-[11px] text-slate-500 mt-1">
                Total Contribution − Fixed Cost ({formatINR(scenario.monthlyFixedCost)})
              </p>
            </div>

            <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl">
              <p className="text-xs text-slate-500">Break-even Transactions / Mo</p>
              <p className="mt-1 text-xl font-display font-bold text-slate-900 tabular-nums">
                {breakEvenTx !== null ? breakEvenTx.toLocaleString('en-IN') : 'Unviable (<= ₹0 margin)'}
              </p>
              <p className="text-[11px] text-slate-500 mt-1">Monthly Fixed Cost ÷ Contribution/Tx</p>
            </div>
          </div>

          {/* Editable Assumptions & Evidence */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[
              {
                key: 'transactionValue' as const,
                evKey: 'transactionValue' as const,
                label: 'Average Transaction Value (₹)',
                value: scenario.transactionValue,
                step: 50,
              },
              {
                key: 'commissionRate' as const,
                evKey: 'commissionRate' as const,
                label: 'Commission / Take Rate (%)',
                value: scenario.commissionRate,
                step: 0.5,
              },
              {
                key: 'variableCost' as const,
                evKey: 'variableCost' as const,
                label: 'Variable Cost per Transaction (₹)',
                value: scenario.variableCost,
                step: 10,
              },
              {
                key: 'monthlyFixedCost' as const,
                evKey: 'monthlyFixedCost' as const,
                label: 'Monthly Fixed Cost (₹)',
                value: scenario.monthlyFixedCost,
                step: 1000,
              },
              {
                key: 'expectedPayingCustomers' as const,
                evKey: 'payingCustomers' as const,
                label: 'Expected Paying Customers / Month',
                value: scenario.expectedPayingCustomers,
                step: 10,
              },
              {
                key: 'transactionsPerCustomer' as const,
                evKey: null,
                label: 'Monthly Transactions per Customer',
                value: scenario.transactionsPerCustomer,
                step: 0.1,
              },
            ].map((field) => {
              const evText = field.evKey
                ? state.revenuePricing.evidenceNotes[field.evKey]
                : 'Derived from repeat student usage assumption';
              const unsupported = field.evKey ? !evText.trim() : false;

              return (
                <div key={field.key} className="p-4 border border-slate-200 rounded-xl space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <label className="text-xs font-semibold text-slate-800">{field.label}</label>
                    {unsupported && (
                      <span className="text-[11px] font-medium text-amber-700">
                        Assumption — needs validation
                      </span>
                    )}
                  </div>
                  <input
                    type="number"
                    min={0}
                    step={field.step}
                    value={field.value}
                    onChange={(e) => updateScenarioField(field.key, Number(e.target.value))}
                    className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg tabular-nums focus:outline-none focus:border-teal-600"
                  />
                  {field.evKey && (
                    <input
                      type="text"
                      value={state.revenuePricing.evidenceNotes[field.evKey]}
                      onChange={(e) => {
                        const k = field.evKey!;
                        setState((p) => ({
                          ...p,
                          revenuePricing: {
                            ...p.revenuePricing,
                            evidenceNotes: { ...p.revenuePricing.evidenceNotes, [k]: e.target.value },
                          },
                        }));
                      }}
                      placeholder="Evidence / source (e.g., DGU student survey n=60)"
                      className="w-full px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-teal-600"
                    />
                  )}
                </div>
              );
            })}
          </div>

          <div className="pt-4 border-t border-slate-100 flex justify-end">
            <button
              type="button"
              disabled={saving}
              onClick={async () => {
                const next: BusinessInsightsState = {
                  ...state,
                  revenuePricing: { ...state.revenuePricing, completed: true },
                };
                await persist(next, 'Module 1 completed. Market Size & Demand Lab unlocked.');
                setActiveLab(2);
              }}
              className="px-5 py-2.5 bg-teal-700 text-white text-xs font-semibold rounded-xl hover:bg-teal-800 cursor-pointer"
            >
              Save &amp; Unlock Module 2 (Market Size &amp; Demand)
            </button>
          </div>
        </div>
      )}

      {/* MODULE 2: MARKET SIZE & DEMAND LAB */}
      {activeLab === 2 && (
        <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-6">
          <div className="border-b border-slate-100 pb-4">
            <h3 className="text-lg font-display font-bold text-slate-900">
              Module 2 — Market Size &amp; Demand Lab
            </h3>
            <p className="text-xs text-slate-600 mt-0.5">
              Initial Venture Assumption — Needs Validation. Calculate TAM, SAM, and SOM and validate against Module 1 customer requirements.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-5 bg-slate-50 border border-slate-200 rounded-xl">
              <p className="text-xs text-slate-500">TAM (Total Addressable Market)</p>
              <p className="mt-1 text-2xl font-display font-bold text-slate-900 tabular-nums">
                {formatINR(tam)}
              </p>
              <p className="text-[11px] text-slate-500 mt-1">
                {md.totalPotentialCustomers.toLocaleString('en-IN')} × {formatINR(md.annualSpendPerCustomer)}
              </p>
            </div>
            <div className="p-5 bg-slate-50 border border-slate-200 rounded-xl">
              <p className="text-xs text-slate-500">SAM (Serviceable Available Market)</p>
              <p className="mt-1 text-2xl font-display font-bold text-slate-900 tabular-nums">
                {formatINR(sam)}
              </p>
              <p className="text-[11px] text-slate-500 mt-1">
                {md.serviceableCustomers.toLocaleString('en-IN')} × {formatINR(md.annualSpendPerCustomer)}
              </p>
            </div>
            <div className="p-5 bg-slate-50 border border-slate-200 rounded-xl">
              <p className="text-xs text-slate-500">SOM (Serviceable Obtainable Market)</p>
              <p className="mt-1 text-2xl font-display font-bold text-teal-800 tabular-nums">
                {formatINR(som)}
              </p>
              <p className="text-[11px] text-slate-500 mt-1">
                {md.obtainableCustomers.toLocaleString('en-IN')} × {formatINR(md.annualSpendPerCustomer)}
              </p>
            </div>
          </div>

          {(customerRequirementMismatch || funnelInconsistency) && (
            <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-950 space-y-1.5">
              <div className="flex items-center gap-2 font-semibold">
                <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0" />
                <span>Consistency Check Alert</span>
              </div>
              {customerRequirementMismatch && (
                <p>
                  Module 1 expects <strong>{scenario.expectedPayingCustomers}</strong> monthly paying customers ({scenarioKey} scenario), which exceeds your Module 2 SOM obtainable customer base of <strong>{md.obtainableCustomers}</strong> students. Reconcile either your pricing volume or obtainable campus footprint.
                </p>
              )}
              {funnelInconsistency && (
                <p>
                  Market funnel hierarchy violation: ensure Total Potential ≥ Serviceable ≥ Obtainable customers.
                </p>
              )}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[
              {
                field: 'totalPotentialCustomers' as const,
                evField: 'tam' as const,
                label: 'Total Potential Target Customers',
                val: md.totalPotentialCustomers,
              },
              {
                field: 'serviceableCustomers' as const,
                evField: 'sam' as const,
                label: 'Realistically Serviceable Customers',
                val: md.serviceableCustomers,
              },
              {
                field: 'obtainableCustomers' as const,
                evField: 'som' as const,
                label: 'Realistically Obtainable Customers (SOM)',
                val: md.obtainableCustomers,
              },
              {
                field: 'annualSpendPerCustomer' as const,
                evField: 'annualSpend' as const,
                label: 'Annual Spend per Customer (₹)',
                val: md.annualSpendPerCustomer,
              },
            ].map((item) => {
              const evVal = md.evidence[item.evField];
              return (
                <div key={item.field} className="p-4 border border-slate-200 rounded-xl space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-slate-800">{item.label}</label>
                    {!evVal.trim() && (
                      <span className="text-[11px] font-medium text-amber-700">
                        Assumption — needs validation
                      </span>
                    )}
                  </div>
                  <input
                    type="number"
                    min={0}
                    value={item.val}
                    onChange={(e) =>
                      setState((p) => ({
                        ...p,
                        marketDemand: {
                          ...p.marketDemand,
                          [item.field]: Math.max(0, Number(e.target.value) || 0),
                        },
                      }))
                    }
                    className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg tabular-nums focus:outline-none focus:border-teal-600"
                  />
                  <input
                    type="text"
                    value={evVal}
                    onChange={(e) =>
                      setState((p) => ({
                        ...p,
                        marketDemand: {
                          ...p.marketDemand,
                          evidence: { ...p.marketDemand.evidence, [item.evField]: e.target.value },
                        },
                      }))
                    }
                    placeholder="Source / campus enrollment evidence..."
                    className="w-full px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-teal-600"
                  />
                </div>
              );
            })}
          </div>

          <div className="pt-4 border-t border-slate-100 flex justify-end">
            <button
              type="button"
              disabled={saving}
              onClick={async () => {
                const next: BusinessInsightsState = {
                  ...state,
                  marketDemand: { ...state.marketDemand, completed: true },
                };
                await persist(next, 'Module 2 completed. Go-To-Market Launch Lab unlocked.');
                setActiveLab(3);
              }}
              className="px-5 py-2.5 bg-teal-700 text-white text-xs font-semibold rounded-xl hover:bg-teal-800 cursor-pointer"
            >
              Save &amp; Unlock Module 3 (Go-To-Market Launch)
            </button>
          </div>
        </div>
      )}

      {/* MODULE 3: GO-TO-MARKET LAUNCH LAB */}
      {activeLab === 3 && (
        <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-6">
          <div className="border-b border-slate-100 pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-lg font-display font-bold text-slate-900">
                Module 3 — Go-To-Market Launch Lab
              </h3>
              <p className="text-xs text-slate-600 mt-0.5">
                All unverified channel targets and experiment milestones are labeled <strong>Proposed</strong>.
              </p>
            </div>
            <div className="text-xs text-slate-700 tabular-nums">
              Total Planned Budget: <strong>{formatINR(totalGtmBudget)}</strong> · Projected Customers:{' '}
              <strong>{totalGtmCustomers}</strong>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Target Segment</label>
            <input
              type="text"
              value={gtm.targetSegment}
              onChange={(e) =>
                setState((p) => ({
                  ...p,
                  gtmLaunch: { ...p.gtmLaunch, targetSegment: e.target.value },
                }))
              }
              className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-teal-600"
            />
          </div>

          {/* Acquisition Channels (Max 3) */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-semibold text-slate-900">
                Acquisition Channels ({gtm.channels.length}/3)
              </h4>
              {gtm.channels.length < 3 && (
                <button
                  type="button"
                  onClick={addChannel}
                  className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium bg-slate-900 text-white rounded-lg hover:bg-slate-800 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add Channel
                </button>
              )}
            </div>

            {gtm.channels.map((ch) => {
              const convRate =
                ch.expectedLeads > 0 ? (ch.expectedCustomers / ch.expectedLeads) * 100 : 0;
              const cac = ch.expectedCustomers > 0 ? ch.budget / ch.expectedCustomers : 0;

              return (
                <div key={ch.id} className="p-4 border border-slate-200 rounded-xl space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-3">
                      <select
                        value={ch.channel}
                        onChange={(e) => updateChannel(ch.id, { channel: e.target.value })}
                        className="px-3 py-1.5 text-xs font-semibold bg-slate-50 border border-slate-200 rounded-lg"
                      >
                        {CHANNEL_OPTIONS.map((opt) => (
                          <option key={opt} value={opt}>
                            {opt}
                          </option>
                        ))}
                      </select>
                      {!ch.evidence.trim() && (
                        <span className="text-[11px] font-medium text-amber-700">Proposed</span>
                      )}
                    </div>

                    <div className="flex items-center gap-4 text-xs tabular-nums">
                      <span>
                        Conv Rate: <strong>{convRate.toFixed(1)}%</strong>
                      </span>
                      <span>
                        CAC: <strong>{formatINR(cac)}</strong>
                      </span>
                      <button
                        type="button"
                        onClick={() => removeChannel(ch.id)}
                        className="text-red-600 hover:text-red-800 cursor-pointer"
                        aria-label="Remove channel"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-[11px] text-slate-500 mb-1">Budget (₹)</label>
                      <input
                        type="number"
                        min={0}
                        value={ch.budget}
                        onChange={(e) => updateChannel(ch.id, { budget: Number(e.target.value) || 0 })}
                        className="w-full px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg tabular-nums"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] text-slate-500 mb-1">Expected Leads</label>
                      <input
                        type="number"
                        min={0}
                        value={ch.expectedLeads}
                        onChange={(e) =>
                          updateChannel(ch.id, { expectedLeads: Number(e.target.value) || 0 })
                        }
                        className="w-full px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg tabular-nums"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] text-slate-500 mb-1">
                        Expected Customers
                      </label>
                      <input
                        type="number"
                        min={0}
                        value={ch.expectedCustomers}
                        onChange={(e) =>
                          updateChannel(ch.id, { expectedCustomers: Number(e.target.value) || 0 })
                        }
                        className="w-full px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg tabular-nums"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <input
                      type="text"
                      value={ch.reason}
                      onChange={(e) => updateChannel(ch.id, { reason: e.target.value })}
                      placeholder="Reason for selecting channel..."
                      className="w-full px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg"
                    />
                    <input
                      type="text"
                      value={ch.evidence}
                      onChange={(e) => updateChannel(ch.id, { evidence: e.target.value })}
                      placeholder="Supporting evidence..."
                      className="w-full px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg"
                    />
                  </div>
                </div>
              );
            })}
          </div>

          {/* 4-Week Launch Experiment */}
          <div className="space-y-3">
            <h4 className="text-sm font-semibold text-slate-900">
              Four-Week Launch Experiment (Proposed Plan)
            </h4>

            <div className="space-y-3">
              {gtm.experiments.map((exp, idx) => (
                <div key={exp.week} className="p-4 border border-slate-200 rounded-xl space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-900">
                      {exp.week} — {exp.title}
                    </span>
                    <span className="text-[11px] text-amber-700 font-medium">Proposed</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    <div>
                      <label className="block text-[11px] text-slate-500 mb-1">Action</label>
                      <input
                        type="text"
                        value={exp.action}
                        onChange={(e) =>
                          setState((p) => ({
                            ...p,
                            gtmLaunch: {
                              ...p.gtmLaunch,
                              experiments: p.gtmLaunch.experiments.map((x, i) =>
                                i === idx ? { ...x, action: e.target.value } : x,
                              ),
                            },
                          }))
                        }
                        className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] text-slate-500 mb-1">Channel</label>
                      <input
                        type="text"
                        value={exp.channel}
                        onChange={(e) =>
                          setState((p) => ({
                            ...p,
                            gtmLaunch: {
                              ...p.gtmLaunch,
                              experiments: p.gtmLaunch.experiments.map((x, i) =>
                                i === idx ? { ...x, channel: e.target.value } : x,
                              ),
                            },
                          }))
                        }
                        className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] text-slate-500 mb-1">Target</label>
                      <input
                        type="text"
                        value={exp.target}
                        onChange={(e) =>
                          setState((p) => ({
                            ...p,
                            gtmLaunch: {
                              ...p.gtmLaunch,
                              experiments: p.gtmLaunch.experiments.map((x, i) =>
                                i === idx ? { ...x, target: e.target.value } : x,
                              ),
                            },
                          }))
                        }
                        className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] text-slate-500 mb-1">Metric &amp; Owner</label>
                      <input
                        type="text"
                        value={`${exp.metric} (${exp.owner})`}
                        onChange={(e) =>
                          setState((p) => ({
                            ...p,
                            gtmLaunch: {
                              ...p.gtmLaunch,
                              experiments: p.gtmLaunch.experiments.map((x, i) =>
                                i === idx ? { ...x, metric: e.target.value, owner: '' } : x,
                              ),
                            },
                          }))
                        }
                        className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-500 mb-1">Learning Question</label>
                    <input
                      type="text"
                      value={exp.learningQuestion}
                      onChange={(e) =>
                        setState((p) => ({
                          ...p,
                          gtmLaunch: {
                            ...p.gtmLaunch,
                            experiments: p.gtmLaunch.experiments.map((x, i) =>
                              i === idx ? { ...x, learningQuestion: e.target.value } : x,
                            ),
                          },
                        }))
                      }
                      className="w-full px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="pt-4 border-t border-slate-100 flex justify-end">
            <button
              type="button"
              disabled={saving}
              onClick={() =>
                persist(
                  { ...state, gtmLaunch: { ...state.gtmLaunch, completed: true } },
                  'Go-To-Market Launch Lab saved to Firestore.',
                )
              }
              className="px-5 py-2.5 bg-teal-700 text-white text-xs font-semibold rounded-xl hover:bg-teal-800 cursor-pointer"
            >
              Save Complete Venture Plan
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
