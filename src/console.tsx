import React, { useCallback, useEffect, useMemo, useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  Activity, AlertTriangle, Building2, ClipboardList, Droplets, Eye, Home, Lock, LogOut, MapPin,
  MonitorPlay, Navigation, Plus, Radio, ShieldAlert, ShieldCheck, UserPlus, Users,
} from 'lucide-react';
import { parseNote } from './CarePlanOS';

type Role = 'provider_admin' | 'registered_manager' | 'senior' | 'support_worker';
type ServiceType = 'supported_living' | 'care_home';
export interface Membership { provider_id: string; role: Role; display_name: string; provider_name: string; live_data_enabled: boolean }
interface Service { id: string; provider_id: string; name: string; type: ServiceType; address: string | null; postcode: string | null; cqc_location_id: string | null; capacity: number | null }
interface Member { provider_id: string; user_id: string; role: Role; display_name: string; job_title: string | null; dbs_checked_on: string | null; right_to_work_checked_on: string | null; active: boolean }
interface MemberService { user_id: string; service_id: string }
interface Person { id: string; provider_id: string; service_id: string; first_name: string; last_name: string; preferred_name: string | null; date_of_birth: string; nhs_last4: string | null; room: string | null; needs: string[]; status: 'active' | 'discharged'; admitted_on: string }
interface Note { id: number; service_id: string; service_user_id: string; kind: string; body: string; tags: Record<string, unknown>; risk: boolean; author_name: string; created_at: string }
interface Plan { service_user_id: string; legal_basis: 'consent' | 'best_interests'; decided_by: string; decision_date: string; review_date: string; centre_lat: number; centre_lng: number; radius_m: number; active: boolean; notes: string | null }
interface Alert { id: number; service_id: string; service_user_id: string; lat: number; lng: number; distance_m: number; created_at: string; acknowledged_name: string | null; acknowledged_at: string | null; outcome: string | null }
interface Invite { email: string; role: Role; display_name: string; job_title: string | null; service_ids: string[]; created_at: string }
interface PlatformProvider { id: string; name: string; cqc_provider_id: string | null; live_data_enabled: boolean; services: number; members: number; pending_invites: number; created_at: string }

const ROLE_LABEL: Record<Role, string> = { provider_admin: 'Provider admin', registered_manager: 'Registered manager', senior: 'Senior', support_worker: 'Support worker' };
const TYPE_LABEL: Record<ServiceType, string> = { supported_living: 'Supported living', care_home: 'Care home' };
const ERRORS: Record<string, string> = {
  FORBIDDEN: 'Your role cannot do this.',
  LIVE_DATA_DISABLED: 'Real people cannot be enrolled yet. The compliance gate for this provider is closed.',
  INVALID_NHS: 'That NHS number fails the check digit. Check it and try again.',
  INVALID_EMAIL: 'Enter a valid email address.',
  INVALID_NAME: 'Enter a name of at least 2 characters.',
  INVALID_DATES: 'Check the dates. The review must fall after the decision and within 12 months.',
  INVALID_DATE: 'Check dates cannot be in the future.',
  NO_ACTIVE_PLAN: 'There is no active safety location plan for this person.',
  PLAN_REVIEW_OVERDUE: 'The safety plan review date has passed. A manager must review it before locations can be recorded.',
  RATE_LIMITED: 'Too many requests. Wait a few seconds and try again.',
  OUTCOME_REQUIRED: 'Describe the outcome before closing the alert.',
  ATTESTATION_REQUIRED: 'Write the compliance attestation (at least 40 characters) before switching on real data.',
  INVALID_SERVICE: 'One of the selected services does not belong to this provider.',
  CANNOT_DEACTIVATE_SELF: 'You cannot deactivate your own account.',
  ALREADY_ACKNOWLEDGED: 'Someone has already closed this alert.',
  INVALID_LOCATION: 'The location reading was not valid.',
};
const errText = (e: { message?: string; code?: string } | null) => {
  if (!e) return null;
  if (e.code === '23514') return 'One of the values is not in the right format. Check postcodes, lengths and numbers.';
  const key = (e.message ?? '').split(':')[0].trim();
  return ERRORS[key] ?? 'Something went wrong. Check your connection and try again.';
};
const isManagerRole = (r: Role) => r === 'provider_admin' || r === 'registered_manager';
const fmtTime = (iso: string) => new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/London' });
const fmtDay = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'Europe/London' });
const ageOf = (dob: string) => { const d = new Date(dob); const n = new Date(); let a = n.getFullYear() - d.getFullYear(); if (n < new Date(n.getFullYear(), d.getMonth(), d.getDate())) a -= 1; return a; };
const startOfToday = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d.toISOString(); };
const displayName = (p: Person) => `${p.preferred_name || p.first_name} ${p.last_name}`;

const inputCls = 'w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-[13px] text-slate-800 focus:border-teal-500 focus:outline-none';
const labelCls = 'mb-1 block text-[11px] font-semibold uppercase tracking-wider text-slate-500';
const btnPrimary = 'inline-flex items-center justify-center gap-2 rounded-xl bg-teal-600 px-3.5 py-2 text-[13px] font-semibold text-white hover:bg-teal-700 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-500';
const btnSecondary = 'inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-[13px] font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50';
const card = 'rounded-2xl border border-slate-200 bg-white p-4 shadow-sm';

function Pill({ tone, children }: { tone: 'teal' | 'emerald' | 'amber' | 'red' | 'slate' | 'cyan'; children: React.ReactNode }) {
  const t = { teal: 'bg-teal-50 text-teal-800 border-teal-200', emerald: 'bg-emerald-50 text-emerald-800 border-emerald-200', amber: 'bg-amber-50 text-amber-800 border-amber-300', red: 'bg-red-50 text-red-700 border-red-200', slate: 'bg-slate-100 text-slate-700 border-slate-200', cyan: 'bg-cyan-50 text-cyan-800 border-cyan-200' }[tone];
  return <span className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-2 py-0.5 text-[11px] font-medium ${t}`}>{children}</span>;
}
function Feedback({ msg }: { msg: { ok: boolean; text: string } | null }) {
  if (!msg) return null;
  return <p role="status" className={`mt-2 text-[12px] ${msg.ok ? 'text-emerald-700' : 'text-red-700'}`}>{msg.text}</p>;
}
function Empty({ children }: { children: React.ReactNode }) {
  return <p className="rounded-xl border border-dashed border-slate-300 p-6 text-center text-[13px] text-slate-500">{children}</p>;
}

/* ============================== Platform owner ============================== */

function PlatformAdmin({ supabase }: { supabase: SupabaseClient }) {
  const [rows, setRows] = useState<PlatformProvider[]>([]);
  const [form, setForm] = useState({ name: '', cqc: '', email: '', admin: '' });
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [gate, setGate] = useState<{ id: string; text: string } | null>(null);
  const load = useCallback(async () => { const { data } = await supabase.rpc('platform_list_providers'); setRows((data as PlatformProvider[]) ?? []); }, [supabase]);
  useEffect(() => { void load(); }, [load]);
  return (
    <div className="space-y-4">
      <section className={card}>
        <h2 className="text-[15px] font-bold text-slate-900">Onboard a provider</h2>
        <p className="mt-1 text-[12px] text-slate-500">Creates the provider and invites its first admin. They sign in with that exact email.</p>
        <form className="mt-3 grid gap-2 md:grid-cols-4" onSubmit={async (e) => {
          e.preventDefault();
          const { error } = await supabase.rpc('platform_create_provider', { p_name: form.name, p_cqc_provider_id: form.cqc, p_admin_email: form.email, p_admin_name: form.admin });
          setMsg(error ? { ok: false, text: errText(error) ?? '' } : { ok: true, text: `${form.name} created. ${form.email} can now sign in as provider admin.` });
          if (!error) { setForm({ name: '', cqc: '', email: '', admin: '' }); void load(); }
        }}>
          <div><label className={labelCls} htmlFor="pv-name">Provider name</label><input id="pv-name" required minLength={2} maxLength={120} className={inputCls} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
          <div><label className={labelCls} htmlFor="pv-cqc">CQC provider ID</label><input id="pv-cqc" maxLength={20} className={inputCls} value={form.cqc} onChange={(e) => setForm({ ...form, cqc: e.target.value })} placeholder="1-123456789" /></div>
          <div><label className={labelCls} htmlFor="pv-email">Admin email</label><input id="pv-email" type="email" required maxLength={254} className={inputCls} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
          <div><label className={labelCls} htmlFor="pv-admin">Admin name</label><input id="pv-admin" required minLength={2} maxLength={80} className={inputCls} value={form.admin} onChange={(e) => setForm({ ...form, admin: e.target.value })} /></div>
          <div className="md:col-span-4"><button type="submit" className={btnPrimary}><Plus className="h-4 w-4" aria-hidden />Create provider</button></div>
        </form>
        <Feedback msg={msg} />
      </section>
      <section className={card}>
        <h2 className="text-[15px] font-bold text-slate-900">Providers</h2>
        {rows.length === 0 ? <div className="mt-3"><Empty>No providers yet. Onboard your first pilot above.</Empty></div> : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-[13px]">
              <thead className="text-[11px] uppercase tracking-wider text-slate-500"><tr><th className="py-2">Provider</th><th>Services</th><th>Staff</th><th>Pending invites</th><th>Real data</th><th /></tr></thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td className="py-2.5"><p className="font-semibold text-slate-900">{r.name}</p><p className="text-[11px] text-slate-500">{r.cqc_provider_id ?? 'No CQC ID'} · since {fmtDay(r.created_at)}</p></td>
                    <td className="tabular-nums">{r.services}</td><td className="tabular-nums">{r.members}</td><td className="tabular-nums">{r.pending_invites}</td>
                    <td>{r.live_data_enabled ? <Pill tone="emerald">Open</Pill> : <Pill tone="amber">Closed</Pill>}</td>
                    <td className="text-right">
                      {r.live_data_enabled
                        ? <button type="button" className={btnSecondary} onClick={async () => { await supabase.rpc('platform_set_live_data', { p_provider: r.id, p_enabled: false, p_attestation: 'Closed by platform owner' }); void load(); }}>Close gate</button>
                        : <button type="button" className={btnSecondary} onClick={() => setGate({ id: r.id, text: '' })}>Open gate</button>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {gate && (
          <div className="mt-4 rounded-xl border border-amber-300 bg-amber-50 p-3">
            <p className="text-[13px] font-semibold text-amber-900">Compliance attestation</p>
            <p className="mt-1 text-[12px] text-amber-900">Confirm the DPIA, DSPT, data processing agreement, Clinical Safety Officer sign-off and penetration test are complete for this provider. This text is stored permanently in the audit log.</p>
            <label className="sr-only" htmlFor="gate-text">Attestation</label>
            <textarea id="gate-text" rows={3} maxLength={500} className={`${inputCls} mt-2`} value={gate.text} onChange={(e) => setGate({ ...gate, text: e.target.value })} />
            <div className="mt-2 flex gap-2">
              <button type="button" className={btnSecondary} onClick={() => setGate(null)}>Cancel</button>
              <button type="button" className={btnPrimary} disabled={gate.text.trim().length < 40} onClick={async () => {
                const { error } = await supabase.rpc('platform_set_live_data', { p_provider: gate.id, p_enabled: true, p_attestation: gate.text });
                setMsg(error ? { ok: false, text: errText(error) ?? '' } : { ok: true, text: 'Real data switched on for this provider.' });
                setGate(null); void load();
              }}>Open compliance gate</button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

/* ============================== Provider data hook ============================== */

function useProviderData(supabase: SupabaseClient, providerId: string) {
  const [services, setServices] = useState<Service[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [memberServices, setMemberServices] = useState<MemberService[]>([]);
  const [people, setPeople] = useState<Person[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [live, setLive] = useState(false);
  const load = useCallback(async () => {
    const since = new Date(Date.now() - 7 * 86400000).toISOString();
    const [s, m, ms, p, n, pl, a] = await Promise.all([
      supabase.from('services').select('*').eq('provider_id', providerId).order('name'),
      supabase.from('provider_members').select('*').eq('provider_id', providerId).order('display_name'),
      supabase.from('member_services').select('user_id, service_id').eq('provider_id', providerId),
      supabase.from('service_users').select('id, provider_id, service_id, first_name, last_name, preferred_name, date_of_birth, nhs_last4, room, needs, status, admitted_on').eq('provider_id', providerId).order('last_name'),
      supabase.from('care_notes').select('id, service_id, service_user_id, kind, body, tags, risk, author_name, created_at').eq('provider_id', providerId).gte('created_at', startOfToday()).order('created_at', { ascending: false }).limit(500),
      supabase.from('safety_plans').select('*').eq('provider_id', providerId),
      supabase.from('safety_alerts').select('*').eq('provider_id', providerId).gte('created_at', since).order('created_at', { ascending: false }).limit(200),
    ]);
    setServices((s.data as Service[]) ?? []); setMembers((m.data as Member[]) ?? []); setMemberServices((ms.data as MemberService[]) ?? []);
    setPeople((p.data as Person[]) ?? []); setNotes((n.data as Note[]) ?? []); setPlans((pl.data as Plan[]) ?? []); setAlerts((a.data as Alert[]) ?? []);
  }, [supabase, providerId]);
  useEffect(() => {
    void load();
    let timer: number | undefined;
    const refresh = () => { window.clearTimeout(timer); timer = window.setTimeout(() => { void load(); }, 300); };
    const ch = supabase.channel(`provider-${providerId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'care_notes', filter: `provider_id=eq.${providerId}` }, refresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'safety_alerts', filter: `provider_id=eq.${providerId}` }, refresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'service_users', filter: `provider_id=eq.${providerId}` }, refresh)
      .subscribe((st) => setLive(st === 'SUBSCRIBED'));
    return () => { window.clearTimeout(timer); void supabase.removeChannel(ch); };
  }, [supabase, providerId, load]);
  return { services, members, memberServices, people, notes, plans, alerts, live, reload: load };
}
type ProviderData = ReturnType<typeof useProviderData>;

/* ============================== Dashboard ============================== */

function Dashboard({ d }: { d: ProviderData }) {
  const active = d.people.filter((p) => p.status === 'active');
  const openAlerts = d.alerts.filter((a) => !a.acknowledged_at);
  const personById = useMemo(() => new Map(d.people.map((p) => [p.id, p])), [d.people]);
  const kpis = [
    { label: 'People supported', value: active.length, sub: `${d.services.reduce((a, s) => a + (s.capacity ?? 0), 0) || 'No'} places across ${d.services.length} services`, icon: Users },
    { label: 'Notes today', value: d.notes.length, sub: `${new Set(d.notes.map((n) => n.service_user_id)).size} people recorded`, icon: ClipboardList },
    { label: 'Risk flags today', value: d.notes.filter((n) => n.risk).length, sub: `${d.notes.filter((n) => n.kind === 'incident').length} incidents`, icon: ShieldAlert },
    { label: 'Open safety alerts', value: openAlerts.length, sub: openAlerts.length ? 'Needs acknowledging' : 'All clear', icon: MapPin },
  ];
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
        {kpis.map((k) => (
          <div key={k.label} className={card}>
            <div className="flex items-center justify-between"><span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">{k.label}</span><k.icon className="h-4 w-4 text-teal-600" aria-hidden /></div>
            <p className={`mt-1 text-2xl font-bold tabular-nums ${k.label === 'Open safety alerts' && k.value ? 'text-red-600' : 'text-slate-900'}`}>{k.value}</p>
            <p className="truncate text-[11px] text-slate-500">{k.sub}</p>
          </div>
        ))}
      </div>
      {d.services.length === 0 ? <Empty>Add your first supported living or care home service to start.</Empty> : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {d.services.map((s) => {
            const ppl = active.filter((p) => p.service_id === s.id);
            const sn = d.notes.filter((n) => n.service_id === s.id);
            const staff = new Set(d.memberServices.filter((m) => m.service_id === s.id).map((m) => m.user_id)).size;
            const recorded = new Set(sn.map((n) => n.service_user_id));
            const unrecorded = ppl.filter((p) => !recorded.has(p.id));
            return (
              <div key={s.id} className={card}>
                <div className="flex items-start justify-between gap-2"><div><p className="font-semibold text-slate-900">{s.name}</p><p className="text-[11px] text-slate-500">{s.postcode ?? 'No postcode'} {s.cqc_location_id ? `· CQC ${s.cqc_location_id}` : ''}</p></div><Pill tone={s.type === 'care_home' ? 'cyan' : 'teal'}>{TYPE_LABEL[s.type]}</Pill></div>
                <dl className="mt-3 grid grid-cols-4 gap-2 text-center text-[11px] text-slate-500">
                  <div><dt>People</dt><dd className="text-[15px] font-bold tabular-nums text-slate-900">{ppl.length}{s.capacity ? `/${s.capacity}` : ''}</dd></div>
                  <div><dt>Staff</dt><dd className="text-[15px] font-bold tabular-nums text-slate-900">{staff}</dd></div>
                  <div><dt>Notes</dt><dd className="text-[15px] font-bold tabular-nums text-slate-900">{sn.length}</dd></div>
                  <div><dt>Risks</dt><dd className={`text-[15px] font-bold tabular-nums ${sn.some((n) => n.risk) ? 'text-red-600' : 'text-slate-900'}`}>{sn.filter((n) => n.risk).length}</dd></div>
                </dl>
                {unrecorded.length > 0 && <p className="mt-2 rounded-lg bg-amber-50 px-2 py-1.5 text-[11px] text-amber-800">No notes yet today for {unrecorded.slice(0, 3).map(displayName).join(', ')}{unrecorded.length > 3 ? ` and ${unrecorded.length - 3} more` : ''}</p>}
              </div>
            );
          })}
        </div>
      )}
      <section className={card}>
        <div className="flex items-center gap-2"><h2 className="text-[15px] font-bold text-slate-900">Live feed</h2><span className="flex items-center gap-1 text-[11px] text-slate-500"><span className={`h-2 w-2 rounded-full ${d.live ? 'bg-emerald-500' : 'bg-amber-400'}`} />{d.live ? 'Live' : 'Reconnecting'}</span></div>
        {d.notes.length === 0 ? <div className="mt-3"><Empty>Notes from your staff appear here the moment they are saved.</Empty></div> : (
          <ol className="mt-3 space-y-2">
            {d.notes.slice(0, 40).map((n) => {
              const p = personById.get(n.service_user_id);
              const tags = n.tags as { fluidMl?: number; mealPct?: number; mood?: string };
              return (
                <li key={n.id} className="rounded-xl border border-slate-200 p-3">
                  <p className="flex flex-wrap items-center gap-2 text-[11px] text-slate-500"><span className="font-semibold tabular-nums text-slate-700">{fmtTime(n.created_at)}</span><span className="font-semibold text-slate-800">{p ? displayName(p) : 'Unknown'}</span><span>{n.author_name}</span>{n.kind !== 'note' && <Pill tone={n.kind === 'incident' ? 'red' : 'slate'}>{n.kind}</Pill>}{n.risk && <Pill tone="red">AI risk flag</Pill>}{tags.fluidMl ? <Pill tone="cyan">{tags.fluidMl} ml</Pill> : null}{tags.mealPct !== undefined ? <Pill tone="teal">Meal {tags.mealPct}%</Pill> : null}{tags.mood ? <Pill tone="emerald">{tags.mood}</Pill> : null}</p>
                  <p className="mt-1 text-[13px] leading-5 text-slate-800">{n.body}</p>
                </li>
              );
            })}
          </ol>
        )}
      </section>
    </div>
  );
}

/* ============================== Services ============================== */

function ServicesView({ supabase, providerId, d, canEdit }: { supabase: SupabaseClient; providerId: string; d: ProviderData; canEdit: boolean }) {
  const blank = { id: null as string | null, name: '', type: 'supported_living' as ServiceType, address: '', postcode: '', cqc: '', capacity: '' };
  const [f, setF] = useState(blank);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_380px]">
      <section className={card}>
        <h2 className="text-[15px] font-bold text-slate-900">Services</h2>
        {d.services.length === 0 ? <div className="mt-3"><Empty>No services yet.</Empty></div> : (
          <ul className="mt-3 divide-y divide-slate-100">
            {d.services.map((s) => (
              <li key={s.id} className="flex flex-wrap items-center gap-3 py-2.5">
                {s.type === 'care_home' ? <Building2 className="h-5 w-5 text-cyan-700" aria-hidden /> : <Home className="h-5 w-5 text-teal-700" aria-hidden />}
                <div className="min-w-0 flex-1"><p className="font-semibold text-slate-900">{s.name}</p><p className="text-[12px] text-slate-500">{TYPE_LABEL[s.type]} · {s.address ?? 'No address'} {s.postcode ?? ''} · {s.capacity ?? 'Unset'} places</p></div>
                {canEdit && <button type="button" className={btnSecondary} onClick={() => setF({ id: s.id, name: s.name, type: s.type, address: s.address ?? '', postcode: s.postcode ?? '', cqc: s.cqc_location_id ?? '', capacity: s.capacity ? String(s.capacity) : '' })}>Edit</button>}
              </li>
            ))}
          </ul>
        )}
      </section>
      {canEdit && (
        <section className={card}>
          <h2 className="text-[15px] font-bold text-slate-900">{f.id ? 'Edit service' : 'Add a service'}</h2>
          <form className="mt-3 space-y-2" onSubmit={async (e) => {
            e.preventDefault();
            const cap = f.capacity ? Number(f.capacity) : null;
            const { error } = await supabase.rpc('upsert_service', { p_provider: providerId, p_id: f.id, p_name: f.name, p_type: f.type, p_address: f.address, p_postcode: f.postcode, p_cqc_location_id: f.cqc, p_capacity: cap });
            setMsg(error ? { ok: false, text: errText(error) ?? '' } : { ok: true, text: f.id ? 'Service updated.' : 'Service added.' });
            if (!error) { setF(blank); void d.reload(); }
          }}>
            <div><label className={labelCls} htmlFor="sv-name">Name</label><input id="sv-name" required minLength={2} maxLength={120} className={inputCls} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="Willow Lane" /></div>
            <div><label className={labelCls} htmlFor="sv-type">Type</label><select id="sv-type" className={inputCls} value={f.type} onChange={(e) => setF({ ...f, type: e.target.value as ServiceType })}><option value="supported_living">Supported living</option><option value="care_home">Care home</option></select></div>
            <div><label className={labelCls} htmlFor="sv-addr">Address</label><input id="sv-addr" maxLength={200} className={inputCls} value={f.address} onChange={(e) => setF({ ...f, address: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-2">
              <div><label className={labelCls} htmlFor="sv-pc">Postcode</label><input id="sv-pc" maxLength={8} className={inputCls} value={f.postcode} onChange={(e) => setF({ ...f, postcode: e.target.value.toUpperCase() })} placeholder="GL1 2AB" /></div>
              <div><label className={labelCls} htmlFor="sv-cap">Places</label><input id="sv-cap" type="number" min={1} max={500} className={inputCls} value={f.capacity} onChange={(e) => setF({ ...f, capacity: e.target.value })} /></div>
            </div>
            <div><label className={labelCls} htmlFor="sv-cqc">CQC location ID</label><input id="sv-cqc" maxLength={20} className={inputCls} value={f.cqc} onChange={(e) => setF({ ...f, cqc: e.target.value })} /></div>
            <div className="flex gap-2 pt-1"><button type="submit" className={btnPrimary}>{f.id ? 'Save changes' : 'Add service'}</button>{f.id && <button type="button" className={btnSecondary} onClick={() => setF(blank)}>Cancel</button>}</div>
          </form>
          <Feedback msg={msg} />
        </section>
      )}
    </div>
  );
}

/* ============================== People ============================== */

function PeopleView({ supabase, membership, d }: { supabase: SupabaseClient; membership: Membership; d: ProviderData }) {
  const canEnrol = membership.role !== 'support_worker';
  const manager = isManagerRole(membership.role);
  const [service, setService] = useState<string>('all');
  const [showDischarged, setShowDischarged] = useState(false);
  const [f, setF] = useState({ service: '', first: '', last: '', preferred: '', dob: '', nhs: '', room: '', needs: '' });
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [revealed, setRevealed] = useState<Record<string, string>>({});
  const [confirmDischarge, setConfirmDischarge] = useState<string | null>(null);
  const list = d.people.filter((p) => (service === 'all' || p.service_id === service) && (showDischarged || p.status === 'active'));
  const svcName = (id: string) => d.services.find((s) => s.id === id)?.name ?? '';
  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_380px]">
      <section className={card}>
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-[15px] font-bold text-slate-900">People supported</h2>
          <label className="sr-only" htmlFor="pp-filter">Service</label>
          <select id="pp-filter" className="ml-auto rounded-xl border border-slate-200 px-2 py-1.5 text-[12px]" value={service} onChange={(e) => setService(e.target.value)}><option value="all">All services</option>{d.services.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select>
          <label className="flex items-center gap-1.5 text-[12px] text-slate-600"><input type="checkbox" checked={showDischarged} onChange={() => setShowDischarged((v) => !v)} />Show discharged</label>
        </div>
        {list.length === 0 ? <div className="mt-3"><Empty>No people enrolled in this view.</Empty></div> : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[680px] text-left text-[13px]">
              <thead className="text-[11px] uppercase tracking-wider text-slate-500"><tr><th className="py-2">Name</th><th>Service</th><th>Age</th><th>NHS</th><th>Needs</th><th>Safety plan</th><th /></tr></thead>
              <tbody className="divide-y divide-slate-100">
                {list.map((p) => {
                  const plan = d.plans.find((x) => x.service_user_id === p.id);
                  return (
                    <tr key={p.id} className={p.status === 'discharged' ? 'opacity-60' : ''}>
                      <td className="py-2.5"><p className="font-semibold text-slate-900">{displayName(p)}</p><p className="text-[11px] text-slate-500">{p.room ?? ''} {p.status === 'discharged' ? '· discharged' : ''}</p></td>
                      <td className="text-slate-600">{svcName(p.service_id)}</td>
                      <td className="tabular-nums">{ageOf(p.date_of_birth)}</td>
                      <td className="tabular-nums">{p.nhs_last4 ? (revealed[p.id] ?? `••• ••• ${p.nhs_last4}`) : 'None'}{p.nhs_last4 && manager && !revealed[p.id] && <button type="button" className="ml-1 text-slate-400 hover:text-teal-700" aria-label="Reveal NHS number (logged)" onClick={async () => { const { data } = await supabase.rpc('reveal_nhs_number', { p_id: p.id }); if (data) setRevealed((r) => ({ ...r, [p.id]: String(data) })); }}><Eye className="inline h-3.5 w-3.5" /></button>}</td>
                      <td className="max-w-[180px] truncate text-[12px] text-slate-600">{p.needs.join(', ')}</td>
                      <td>{plan ? <Pill tone={plan.active ? 'teal' : 'slate'}>{plan.active ? `${plan.radius_m} m` : 'Paused'}</Pill> : <span className="text-[12px] text-slate-400">None</span>}</td>
                      <td className="text-right">{manager && p.status === 'active' && (confirmDischarge === p.id
                        ? <span className="flex justify-end gap-1"><button type="button" className={btnSecondary} onClick={() => setConfirmDischarge(null)}>Keep</button><button type="button" className="rounded-xl bg-red-600 px-3 py-2 text-[12px] font-semibold text-white" onClick={async () => { const { error } = await supabase.rpc('discharge_service_user', { p_id: p.id, p_date: null }); setMsg(error ? { ok: false, text: errText(error) ?? '' } : { ok: true, text: `${displayName(p)} discharged. Records are kept.` }); setConfirmDischarge(null); void d.reload(); }}>Confirm</button></span>
                        : <button type="button" className={btnSecondary} onClick={() => setConfirmDischarge(p.id)}>Discharge</button>)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <Feedback msg={msg} />
      </section>
      {canEnrol && (
        <section className={card}>
          <h2 className="text-[15px] font-bold text-slate-900">Enrol a person</h2>
          {!membership.live_data_enabled ? (
            <div className="mt-3 rounded-xl border border-amber-300 bg-amber-50 p-3 text-[12px] text-amber-900">
              <p className="flex items-center gap-1.5 font-semibold"><Lock className="h-4 w-4" aria-hidden />Real data is not switched on yet</p>
              <p className="mt-1">CarePlanOS opens enrolment for real people once your DPIA, data processing agreement, DSPT and clinical safety sign-off are complete. You can set up services and invite staff now.</p>
            </div>
          ) : d.services.length === 0 ? <div className="mt-3"><Empty>Add a service first.</Empty></div> : (
            <form className="mt-3 space-y-2" onSubmit={async (e) => {
              e.preventDefault();
              const needs = f.needs.split(',').map((x) => x.trim()).filter(Boolean).slice(0, 12);
              const { error } = await supabase.rpc('enrol_service_user', { p_service: f.service, p_first: f.first, p_last: f.last, p_preferred: f.preferred, p_dob: f.dob, p_nhs: f.nhs, p_room: f.room, p_needs: needs });
              setMsg(error ? { ok: false, text: errText(error) ?? '' } : { ok: true, text: `${f.preferred || f.first} ${f.last} enrolled.` });
              if (!error) { setF({ service: f.service, first: '', last: '', preferred: '', dob: '', nhs: '', room: '', needs: '' }); void d.reload(); }
            }}>
              <div><label className={labelCls} htmlFor="en-svc">Service</label><select id="en-svc" required className={inputCls} value={f.service} onChange={(e) => setF({ ...f, service: e.target.value })}><option value="">Choose a service</option>{d.services.map((s) => <option key={s.id} value={s.id}>{s.name} · {TYPE_LABEL[s.type]}</option>)}</select></div>
              <div className="grid grid-cols-2 gap-2">
                <div><label className={labelCls} htmlFor="en-first">First name</label><input id="en-first" required maxLength={60} className={inputCls} value={f.first} onChange={(e) => setF({ ...f, first: e.target.value })} /></div>
                <div><label className={labelCls} htmlFor="en-last">Last name</label><input id="en-last" required maxLength={60} className={inputCls} value={f.last} onChange={(e) => setF({ ...f, last: e.target.value })} /></div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div><label className={labelCls} htmlFor="en-pref">Preferred name</label><input id="en-pref" maxLength={60} className={inputCls} value={f.preferred} onChange={(e) => setF({ ...f, preferred: e.target.value })} /></div>
                <div><label className={labelCls} htmlFor="en-dob">Date of birth</label><input id="en-dob" type="date" required max={new Date().toISOString().slice(0, 10)} min="1900-01-01" className={inputCls} value={f.dob} onChange={(e) => setF({ ...f, dob: e.target.value })} /></div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div><label className={labelCls} htmlFor="en-nhs">NHS number</label><input id="en-nhs" inputMode="numeric" maxLength={12} className={inputCls} value={f.nhs} onChange={(e) => setF({ ...f, nhs: e.target.value.replace(/[^0-9 ]/g, '') })} /></div>
                <div><label className={labelCls} htmlFor="en-room">Room or flat</label><input id="en-room" maxLength={40} className={inputCls} value={f.room} onChange={(e) => setF({ ...f, room: e.target.value })} /></div>
              </div>
              <div><label className={labelCls} htmlFor="en-needs">Main needs (comma separated)</label><input id="en-needs" maxLength={400} className={inputCls} value={f.needs} onChange={(e) => setF({ ...f, needs: e.target.value })} placeholder="Autism, learning disability, PBS plan" /></div>
              <p className="text-[11px] text-slate-500">NHS numbers are encrypted with AES-256 and only managers can reveal them. Every reveal is logged.</p>
              <button type="submit" className={btnPrimary}><UserPlus className="h-4 w-4" aria-hidden />Enrol</button>
            </form>
          )}
          <Feedback msg={msg} />
        </section>
      )}
    </div>
  );
}

/* ============================== Team ============================== */

function TeamView({ supabase, membership, d }: { supabase: SupabaseClient; membership: Membership; d: ProviderData }) {
  const [invites, setInvites] = useState<Invite[]>([]);
  const [f, setF] = useState({ email: '', name: '', title: '', role: 'support_worker' as Role, services: [] as string[] });
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [edit, setEdit] = useState<{ user: string; dbs: string; rtw: string; active: boolean } | null>(null);
  const loadInvites = useCallback(async () => { const { data } = await supabase.rpc('list_pending_invites', { p_provider: membership.provider_id }); setInvites((data as Invite[]) ?? []); }, [supabase, membership.provider_id]);
  useEffect(() => { void loadInvites(); }, [loadInvites]);
  const svcNames = (user: string) => d.memberServices.filter((m) => m.user_id === user).map((m) => d.services.find((s) => s.id === m.service_id)?.name).filter(Boolean).join(', ');
  const dbsTone = (iso: string | null) => (!iso ? 'red' : Date.now() - new Date(iso).getTime() > 3 * 365 * 86400000 ? 'amber' : 'emerald') as 'red' | 'amber' | 'emerald';
  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_380px]">
      <section className={card}>
        <h2 className="text-[15px] font-bold text-slate-900">Team</h2>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[680px] text-left text-[13px]">
            <thead className="text-[11px] uppercase tracking-wider text-slate-500"><tr><th className="py-2">Name</th><th>Role</th><th>Services</th><th>DBS</th><th>Right to work</th><th /></tr></thead>
            <tbody className="divide-y divide-slate-100">
              {d.members.map((m) => (
                <tr key={m.user_id} className={m.active ? '' : 'opacity-50'}>
                  <td className="py-2.5"><p className="font-semibold text-slate-900">{m.display_name}</p><p className="text-[11px] text-slate-500">{m.job_title ?? ''}{m.active ? '' : ' · deactivated'}</p></td>
                  <td>{ROLE_LABEL[m.role]}</td>
                  <td className="max-w-[160px] truncate text-[12px] text-slate-600">{isManagerRole(m.role) ? 'All services' : svcNames(m.user_id) || 'None assigned'}</td>
                  <td><Pill tone={dbsTone(m.dbs_checked_on)}>{m.dbs_checked_on ? fmtDay(m.dbs_checked_on) : 'Missing'}</Pill></td>
                  <td><Pill tone={m.right_to_work_checked_on ? 'emerald' : 'red'}>{m.right_to_work_checked_on ? fmtDay(m.right_to_work_checked_on) : 'Missing'}</Pill></td>
                  <td className="text-right"><button type="button" className={btnSecondary} onClick={() => setEdit({ user: m.user_id, dbs: m.dbs_checked_on ?? '', rtw: m.right_to_work_checked_on ?? '', active: m.active })}>Checks</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {edit && (
          <form className="mt-3 grid gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3 md:grid-cols-4" onSubmit={async (e) => {
            e.preventDefault();
            const { error } = await supabase.rpc('update_member_checks', { p_provider: membership.provider_id, p_user: edit.user, p_dbs: edit.dbs || null, p_rtw: edit.rtw || null, p_active: edit.active });
            setMsg(error ? { ok: false, text: errText(error) ?? '' } : { ok: true, text: 'Checks saved.' });
            if (!error) { setEdit(null); void d.reload(); }
          }}>
            <div><label className={labelCls} htmlFor="ck-dbs">DBS checked</label><input id="ck-dbs" type="date" max={new Date().toISOString().slice(0, 10)} className={inputCls} value={edit.dbs} onChange={(e) => setEdit({ ...edit, dbs: e.target.value })} /></div>
            <div><label className={labelCls} htmlFor="ck-rtw">Right to work checked</label><input id="ck-rtw" type="date" max={new Date().toISOString().slice(0, 10)} className={inputCls} value={edit.rtw} onChange={(e) => setEdit({ ...edit, rtw: e.target.value })} /></div>
            <label className="mt-5 flex items-center gap-2 text-[13px] text-slate-700"><input type="checkbox" checked={edit.active} onChange={() => setEdit({ ...edit, active: !edit.active })} />Active</label>
            <div className="mt-5 flex gap-2"><button type="submit" className={btnPrimary}>Save</button><button type="button" className={btnSecondary} onClick={() => setEdit(null)}>Cancel</button></div>
          </form>
        )}
        {invites.length > 0 && (
          <div className="mt-4"><p className={labelCls}>Waiting to sign in</p><ul className="space-y-1">{invites.map((i) => <li key={i.email} className="flex flex-wrap items-center gap-2 rounded-lg bg-slate-50 px-3 py-2 text-[12px] text-slate-700"><span className="font-semibold">{i.display_name}</span><span>{i.email}</span><Pill tone="slate">{ROLE_LABEL[i.role]}</Pill></li>)}</ul></div>
        )}
      </section>
      <section className={card}>
        <h2 className="text-[15px] font-bold text-slate-900">Invite staff</h2>
        <form className="mt-3 space-y-2" onSubmit={async (e) => {
          e.preventDefault();
          const { error } = await supabase.rpc('invite_provider_member', { p_provider: membership.provider_id, p_email: f.email, p_role: f.role, p_display_name: f.name, p_job_title: f.title, p_service_ids: isManagerRole(f.role) ? [] : f.services });
          setMsg(error ? { ok: false, text: errText(error) ?? '' } : { ok: true, text: `${f.name} invited. They sign in with ${f.email}.` });
          if (!error) { setF({ email: '', name: '', title: '', role: 'support_worker', services: [] }); void loadInvites(); void d.reload(); }
        }}>
          <div><label className={labelCls} htmlFor="iv-name">Full name</label><input id="iv-name" required minLength={2} maxLength={80} className={inputCls} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></div>
          <div><label className={labelCls} htmlFor="iv-email">Work email</label><input id="iv-email" type="email" required maxLength={254} className={inputCls} value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></div>
          <div className="grid grid-cols-2 gap-2">
            <div><label className={labelCls} htmlFor="iv-role">Role</label><select id="iv-role" className={inputCls} value={f.role} onChange={(e) => setF({ ...f, role: e.target.value as Role })}>
              <option value="support_worker">Support worker</option><option value="senior">Senior</option><option value="registered_manager">Registered manager</option>{membership.role === 'provider_admin' && <option value="provider_admin">Provider admin</option>}
            </select></div>
            <div><label className={labelCls} htmlFor="iv-title">Job title</label><input id="iv-title" maxLength={80} className={inputCls} value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} /></div>
          </div>
          {!isManagerRole(f.role) && (
            <fieldset><legend className={labelCls}>Services they work in</legend>
              {d.services.length === 0 ? <p className="text-[12px] text-slate-500">Add a service first.</p> : d.services.map((s) => (
                <label key={s.id} className="flex items-center gap-2 py-0.5 text-[13px] text-slate-700"><input type="checkbox" checked={f.services.includes(s.id)} onChange={() => setF({ ...f, services: f.services.includes(s.id) ? f.services.filter((x) => x !== s.id) : [...f.services, s.id] })} />{s.name}</label>
              ))}
            </fieldset>
          )}
          <p className="text-[11px] text-slate-500">Staff only see the people in the services you assign. Managers see every service.</p>
          <button type="submit" className={btnPrimary}><UserPlus className="h-4 w-4" aria-hidden />Send access</button>
        </form>
        <Feedback msg={msg} />
      </section>
    </div>
  );
}

/* ============================== Safety location ============================== */

function SafetyView({ supabase, membership, d }: { supabase: SupabaseClient; membership: Membership; d: ProviderData }) {
  const manager = isManagerRole(membership.role);
  const active = d.people.filter((p) => p.status === 'active');
  const [sel, setSel] = useState('');
  const today = new Date().toISOString().slice(0, 10);
  const blank = { basis: 'consent' as Plan['legal_basis'], decidedBy: '', decision: today, review: '', lat: '', lng: '', radius: '400', active: true, notes: '', postcode: '' };
  const [f, setF] = useState(blank);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [outcome, setOutcome] = useState<Record<number, string>>({});
  const person = (id: string) => d.people.find((p) => p.id === id);
  useEffect(() => {
    const plan = d.plans.find((p) => p.service_user_id === sel);
    setF(plan ? { basis: plan.legal_basis, decidedBy: plan.decided_by, decision: plan.decision_date, review: plan.review_date, lat: String(plan.centre_lat), lng: String(plan.centre_lng), radius: String(plan.radius_m), active: plan.active, notes: plan.notes ?? '', postcode: '' } : blank);
  }, [sel]); // eslint-disable-line react-hooks/exhaustive-deps
  const open = d.alerts.filter((a) => !a.acknowledged_at);
  return (
    <div className="space-y-4">
      <section className={card}>
        <h2 className="flex items-center gap-2 text-[15px] font-bold text-slate-900"><ShieldAlert className="h-4 w-4 text-red-600" aria-hidden />Safety alerts</h2>
        {d.alerts.length === 0 ? <div className="mt-3"><Empty>No alerts in the last 7 days.</Empty></div> : (
          <ul className="mt-3 space-y-2">
            {[...open, ...d.alerts.filter((a) => a.acknowledged_at)].slice(0, 30).map((a) => {
              const p = person(a.service_user_id);
              return (
                <li key={a.id} className={`rounded-xl border p-3 text-[13px] ${a.acknowledged_at ? 'border-slate-200' : 'border-red-300 bg-red-50'}`}>
                  <p className="flex flex-wrap items-center gap-2"><span className="font-semibold text-slate-900">{p ? displayName(p) : 'Unknown'}</span><span className="tabular-nums text-slate-500">{fmtDay(a.created_at)} {fmtTime(a.created_at)}</span><Pill tone={a.acknowledged_at ? 'slate' : 'red'}>{a.distance_m} m outside safe area</Pill></p>
                  <a className="text-[12px] font-semibold text-teal-700 underline" href={`https://www.openstreetmap.org/?mlat=${a.lat}&mlon=${a.lng}#map=17/${a.lat}/${a.lng}`} target="_blank" rel="noopener noreferrer">Open location on map</a>
                  {a.acknowledged_at ? <p className="mt-1 text-[12px] text-slate-600">Closed by {a.acknowledged_name} at {fmtTime(a.acknowledged_at)}: {a.outcome}</p> : (
                    <div className="mt-2 flex flex-wrap gap-2">
                      <label className="sr-only" htmlFor={`oc-${a.id}`}>Outcome</label>
                      <input id={`oc-${a.id}`} maxLength={500} className={`${inputCls} min-w-[220px] flex-1`} placeholder="What happened and what you did" value={outcome[a.id] ?? ''} onChange={(e) => setOutcome({ ...outcome, [a.id]: e.target.value })} />
                      <button type="button" className={btnPrimary} disabled={(outcome[a.id] ?? '').trim().length < 5} onClick={async () => { const { error } = await supabase.rpc('acknowledge_safety_alert', { p_alert: a.id, p_outcome: outcome[a.id] }); setMsg(error ? { ok: false, text: errText(error) ?? '' } : { ok: true, text: 'Alert closed.' }); void d.reload(); }}>Close alert</button>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>
      {manager && (
        <section className={card}>
          <h2 className="text-[15px] font-bold text-slate-900">Opt-in safety location plan</h2>
          <p className="mt-1 text-[12px] text-slate-600">Only set this up with the person's consent, or a recorded Mental Capacity Act best-interests decision. Locations are recorded by staff on outings, kept for 7 days, and an alert is raised if the person is outside the safe area. This is not continuous tracking.</p>
          <div className="mt-3"><label className={labelCls} htmlFor="sp-person">Person</label><select id="sp-person" className={inputCls} value={sel} onChange={(e) => setSel(e.target.value)}><option value="">Choose a person</option>{active.map((p) => <option key={p.id} value={p.id}>{displayName(p)}</option>)}</select></div>
          {sel && (
            <form className="mt-3 grid gap-2 md:grid-cols-2" onSubmit={async (e) => {
              e.preventDefault();
              const { error } = await supabase.rpc('set_safety_plan', { p_service_user: sel, p_legal_basis: f.basis, p_decided_by: f.decidedBy, p_decision_date: f.decision, p_review_date: f.review, p_lat: Number(f.lat), p_lng: Number(f.lng), p_radius_m: Number(f.radius), p_active: f.active, p_notes: f.notes });
              setMsg(error ? { ok: false, text: errText(error) ?? '' } : { ok: true, text: 'Safety plan saved.' });
              if (!error) void d.reload();
            }}>
              <div><label className={labelCls} htmlFor="sp-basis">Legal basis</label><select id="sp-basis" className={inputCls} value={f.basis} onChange={(e) => setF({ ...f, basis: e.target.value as Plan['legal_basis'] })}><option value="consent">The person consents</option><option value="best_interests">MCA best-interests decision</option></select></div>
              <div><label className={labelCls} htmlFor="sp-by">Decided by</label><input id="sp-by" required minLength={2} maxLength={120} className={inputCls} value={f.decidedBy} onChange={(e) => setF({ ...f, decidedBy: e.target.value })} placeholder="Name, role, and who was involved" /></div>
              <div><label className={labelCls} htmlFor="sp-dd">Decision date</label><input id="sp-dd" type="date" required max={today} className={inputCls} value={f.decision} onChange={(e) => setF({ ...f, decision: e.target.value })} /></div>
              <div><label className={labelCls} htmlFor="sp-rd">Review by (within 12 months)</label><input id="sp-rd" type="date" required className={inputCls} value={f.review} onChange={(e) => setF({ ...f, review: e.target.value })} /></div>
              <div className="md:col-span-2 flex flex-wrap items-end gap-2">
                <div className="flex-1"><label className={labelCls} htmlFor="sp-pc">Centre from postcode</label><input id="sp-pc" maxLength={8} className={inputCls} value={f.postcode} onChange={(e) => setF({ ...f, postcode: e.target.value.toUpperCase() })} placeholder="GL1 2AB" /></div>
                <button type="button" className={btnSecondary} disabled={!/^[A-Z]{1,2}[0-9][A-Z0-9]? ?[0-9][A-Z]{2}$/.test(f.postcode.trim())} onClick={async () => {
                  try { const r = await fetch(`https://api.postcodes.io/postcodes/${encodeURIComponent(f.postcode.trim())}`); const j = await r.json(); if (j?.result) setF({ ...f, lat: String(j.result.latitude), lng: String(j.result.longitude) }); else setMsg({ ok: false, text: 'Postcode not found.' }); } catch { setMsg({ ok: false, text: 'Postcode lookup failed. Enter coordinates instead.' }); }
                }}><MapPin className="h-4 w-4" aria-hidden />Look up</button>
              </div>
              <div><label className={labelCls} htmlFor="sp-lat">Centre latitude</label><input id="sp-lat" required inputMode="decimal" className={inputCls} value={f.lat} onChange={(e) => setF({ ...f, lat: e.target.value })} /></div>
              <div><label className={labelCls} htmlFor="sp-lng">Centre longitude</label><input id="sp-lng" required inputMode="decimal" className={inputCls} value={f.lng} onChange={(e) => setF({ ...f, lng: e.target.value })} /></div>
              <div><label className={labelCls} htmlFor="sp-r">Safe radius (metres)</label><input id="sp-r" type="number" min={50} max={20000} required className={inputCls} value={f.radius} onChange={(e) => setF({ ...f, radius: e.target.value })} /></div>
              <label className="mt-5 flex items-center gap-2 text-[13px] text-slate-700"><input type="checkbox" checked={f.active} onChange={() => setF({ ...f, active: !f.active })} />Plan active</label>
              <div className="md:col-span-2"><label className={labelCls} htmlFor="sp-notes">Notes for staff</label><input id="sp-notes" maxLength={500} className={inputCls} value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} placeholder="When to record a location, who to call" /></div>
              <div className="md:col-span-2"><button type="submit" className={btnPrimary}><ShieldCheck className="h-4 w-4" aria-hidden />Save plan</button></div>
            </form>
          )}
          <Feedback msg={msg} />
        </section>
      )}
    </div>
  );
}

/* ============================== Frontline ============================== */

function FrontlineView({ supabase, d }: { supabase: SupabaseClient; d: ProviderData }) {
  const [service, setService] = useState('');
  const [personId, setPersonId] = useState('');
  const [kind, setKind] = useState<'note' | 'incident' | 'fluid' | 'observation'>('note');
  const [body, setBody] = useState('');
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [locating, setLocating] = useState(false);
  const svc = service || d.services[0]?.id || '';
  const people = d.people.filter((p) => p.service_id === svc && p.status === 'active');
  const person = d.people.find((p) => p.id === personId);
  const plan = d.plans.find((p) => p.service_user_id === personId && p.active);
  const parsed = body.trim().length > 3 ? parseNote(body) : null;
  const fluidToday = (id: string) => d.notes.filter((n) => n.service_user_id === id).reduce((a, n) => a + Number((n.tags as { fluidMl?: number }).fluidMl ?? 0), 0);
  const recent = d.notes.filter((n) => n.service_user_id === personId).slice(0, 10);
  return (
    <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
      <section className={card}>
        <label className={labelCls} htmlFor="fl-svc">Service</label>
        <select id="fl-svc" className={inputCls} value={svc} onChange={(e) => { setService(e.target.value); setPersonId(''); }}>{d.services.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select>
        <ul className="mt-3 space-y-1.5">
          {people.length === 0 && <li><Empty>No people in this service yet.</Empty></li>}
          {people.map((p) => (
            <li key={p.id}><button type="button" onClick={() => setPersonId(p.id)} aria-pressed={personId === p.id} className={`flex w-full items-center justify-between rounded-xl border px-3 py-2 text-left ${personId === p.id ? 'border-teal-500 bg-teal-50' : 'border-slate-200 hover:bg-slate-50'}`}>
              <span><span className="block text-[13px] font-semibold text-slate-900">{displayName(p)}</span><span className="block text-[11px] text-slate-500">{p.room ?? ''} · {ageOf(p.date_of_birth)}</span></span>
              <span className="flex items-center gap-1 text-[11px] tabular-nums text-cyan-800"><Droplets className="h-3.5 w-3.5" aria-hidden />{fluidToday(p.id)} ml</span>
            </button></li>
          ))}
        </ul>
      </section>
      <section className={card}>
        {!person ? <Empty>Choose a person to record care.</Empty> : (
          <>
            <div className="flex flex-wrap items-center gap-2"><h2 className="text-[16px] font-bold text-slate-900">{displayName(person)}</h2>{person.needs.slice(0, 3).map((n) => <Pill key={n} tone="slate">{n}</Pill>)}</div>
            <form className="mt-3 space-y-2" onSubmit={async (e) => {
              e.preventDefault();
              const p = parseNote(body);
              const { error } = await supabase.rpc('add_care_note', { p_service_user: person.id, p_kind: kind, p_body: p.normalised.slice(0, 2000), p_tags: { ...p.tags, cqc: p.cqc, riskReasons: p.riskReasons }, p_risk: p.risk || kind === 'incident' });
              setMsg(error ? { ok: false, text: errText(error) ?? '' } : { ok: true, text: 'Saved. Your manager can see it now.' });
              if (!error) { setBody(''); void d.reload(); }
            }}>
              <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Record type">
                {(['note', 'fluid', 'observation', 'incident'] as const).map((k) => <button key={k} type="button" role="radio" aria-checked={kind === k} onClick={() => setKind(k)} className={`rounded-full border px-3 py-1 text-[12px] font-semibold capitalize ${kind === k ? (k === 'incident' ? 'border-red-500 bg-red-600 text-white' : 'border-teal-600 bg-teal-600 text-white') : 'border-slate-200 text-slate-600'}`}>{k}</button>)}
              </div>
              <label className="sr-only" htmlFor="fl-body">Care note</label>
              <textarea id="fl-body" rows={4} maxLength={2000} required className={inputCls} value={body} onChange={(e) => setBody(e.target.value)} placeholder="e.g. Had a cuppa, about 200 mls, ate half his lunch, calm and chatty" />
              {parsed && (
                <div className="flex flex-wrap gap-1.5">
                  {parsed.tags.fluidMl ? <Pill tone="cyan">{parsed.tags.fluidMl} ml</Pill> : null}
                  {parsed.tags.mealPct !== undefined ? <Pill tone="teal">Meal {parsed.tags.mealPct}%</Pill> : null}
                  {parsed.tags.mood ? <Pill tone="emerald">{parsed.tags.mood}</Pill> : null}
                  {parsed.tags.behaviour?.map((b) => <Pill key={b} tone="amber">{b}</Pill>)}
                  {parsed.risk && <Pill tone="red">AI risk: {parsed.riskReasons.join(', ')}</Pill>}
                  {parsed.dialect.length > 0 && <Pill tone="slate">Normalised: {parsed.dialect.join(', ')}</Pill>}
                </div>
              )}
              <div className="flex flex-wrap gap-2">
                <button type="submit" className={btnPrimary} disabled={body.trim().length < 3}><ClipboardList className="h-4 w-4" aria-hidden />Save note</button>
                {plan && <button type="button" className={btnSecondary} disabled={locating} onClick={() => {
                  if (!('geolocation' in navigator)) { setMsg({ ok: false, text: 'This device cannot share its location.' }); return; }
                  setLocating(true);
                  navigator.geolocation.getCurrentPosition(async (pos) => {
                    const { data, error } = await supabase.rpc('record_safety_location', { p_service_user: person.id, p_lat: pos.coords.latitude, p_lng: pos.coords.longitude, p_accuracy_m: Math.round(pos.coords.accuracy) });
                    setLocating(false);
                    if (error) setMsg({ ok: false, text: errText(error) ?? '' });
                    else { const r = data as { inside: boolean; distance_m: number }; setMsg({ ok: r.inside, text: r.inside ? `Recorded. ${displayName(person)} is inside the safe area.` : `Recorded. ${r.distance_m} m outside the safe area. Your manager has been alerted.` }); void d.reload(); }
                  }, () => { setLocating(false); setMsg({ ok: false, text: 'Location permission was refused on this device.' }); }, { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 });
                }}><Navigation className="h-4 w-4" aria-hidden />{locating ? 'Getting location…' : 'Record safety location'}</button>}
              </div>
              <Feedback msg={msg} />
            </form>
            <h3 className="mt-5 text-[12px] font-semibold uppercase tracking-wider text-slate-500">Today</h3>
            {recent.length === 0 ? <p className="mt-1 text-[13px] text-slate-500">No notes yet today.</p> : (
              <ol className="mt-2 space-y-2">{recent.map((n) => <li key={n.id} className="rounded-xl border border-slate-200 p-3 text-[13px]"><p className="text-[11px] text-slate-500"><span className="font-semibold tabular-nums text-slate-700">{fmtTime(n.created_at)}</span> · {n.author_name} {n.risk ? '· AI risk flag' : ''}</p><p className="mt-1 text-slate-800">{n.body}</p></li>)}</ol>
            )}
          </>
        )}
      </section>
    </div>
  );
}

/* ============================== Console shell ============================== */

type Tab = 'dashboard' | 'services' | 'people' | 'team' | 'safety' | 'frontline' | 'platform';

export default function ProviderConsole({ supabase, memberships, isPlatformAdmin, email, onOpenDemo, onSignOut }: { supabase: SupabaseClient; memberships: Membership[]; isPlatformAdmin: boolean; email: string; onOpenDemo: (() => void) | null; onSignOut: () => void }) {
  const [providerId, setProviderId] = useState(memberships[0]?.provider_id ?? '');
  const membership = memberships.find((m) => m.provider_id === providerId) ?? null;
  const role = membership?.role;
  const tabs: Array<{ id: Tab; label: string; icon: React.ElementType }> = [];
  if (membership) {
    if (role !== 'support_worker') tabs.push({ id: 'dashboard', label: 'Live dashboard', icon: Activity });
    if (role && isManagerRole(role)) tabs.push({ id: 'services', label: 'Services', icon: Building2 });
    tabs.push({ id: 'people', label: 'People', icon: Users });
    if (role && isManagerRole(role)) tabs.push({ id: 'team', label: 'Team', icon: UserPlus });
    tabs.push({ id: 'frontline', label: 'Record care', icon: ClipboardList });
    tabs.push({ id: 'safety', label: 'Safety', icon: MapPin });
  }
  if (isPlatformAdmin) tabs.push({ id: 'platform', label: 'Platform', icon: Radio });
  const [tab, setTab] = useState<Tab>(tabs[0]?.id ?? 'platform');
  const current = tabs.find((t) => t.id === tab) ? tab : tabs[0]?.id;
  return (
    <div className="min-h-screen bg-[#0F172A] text-slate-100" style={{ background: 'radial-gradient(60% 50% at 8% 8%, rgba(13,148,136,.22), transparent 60%), linear-gradient(180deg, #0F172A, #1E293B)' }}>
      <header className="sticky top-0 z-30 border-b border-white/10 bg-slate-950/60 backdrop-blur-xl" style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}>
        <div className="mx-auto flex max-w-[1400px] flex-wrap items-center gap-3 py-2.5" style={{ paddingLeft: 'max(16px, env(safe-area-inset-left, 0px))', paddingRight: 'max(16px, env(safe-area-inset-right, 0px))' }}>
          <p className="text-[17px] font-extrabold tracking-tight text-white">CarePlan<span className="text-teal-300">OS</span></p>
          {memberships.length > 0 && (
            <>
              <label className="sr-only" htmlFor="prov">Provider</label>
              <select id="prov" className="rounded-xl border border-white/15 bg-white/10 px-3 py-1.5 text-[13px] text-white" value={providerId} onChange={(e) => setProviderId(e.target.value)}>
                {memberships.map((m) => <option key={m.provider_id} value={m.provider_id} className="text-slate-900">{m.provider_name}</option>)}
              </select>
              {role && <span className="rounded-full border border-white/15 px-2.5 py-1 text-[11px] text-slate-300">{ROLE_LABEL[role]}</span>}
              {membership && !membership.live_data_enabled && <span className="flex items-center gap-1 rounded-full border border-amber-400/40 bg-amber-500/15 px-2.5 py-1 text-[11px] text-amber-100"><Lock className="h-3 w-3" aria-hidden />Real data gate closed</span>}
            </>
          )}
          <div className="ml-auto flex items-center gap-2">
            {onOpenDemo && <button type="button" onClick={onOpenDemo} className="flex items-center gap-1.5 rounded-xl border border-white/15 px-3 py-1.5 text-[12px] font-semibold text-slate-100 hover:bg-white/10"><MonitorPlay className="h-4 w-4" aria-hidden />Investor demo</button>}
            <span className="hidden max-w-[200px] truncate text-[12px] text-slate-400 md:inline">{email}</span>
            <button type="button" onClick={onSignOut} className="flex items-center gap-1.5 rounded-xl border border-white/15 px-3 py-1.5 text-[12px] font-semibold text-slate-100 hover:bg-white/10"><LogOut className="h-4 w-4" aria-hidden />Sign out</button>
          </div>
        </div>
        <nav className="mx-auto flex max-w-[1400px] gap-1 overflow-x-auto" style={{ paddingLeft: 'max(16px, env(safe-area-inset-left, 0px))', paddingRight: 'max(16px, env(safe-area-inset-right, 0px))' }} aria-label="Console">
          {tabs.map((t) => <button key={t.id} type="button" onClick={() => setTab(t.id)} aria-current={current === t.id ? 'page' : undefined} className={`flex shrink-0 items-center gap-1.5 border-b-2 px-3 py-2.5 text-[13px] font-semibold ${current === t.id ? 'border-teal-400 text-teal-200' : 'border-transparent text-slate-400 hover:text-white'}`}><t.icon className="h-4 w-4" aria-hidden />{t.label}</button>)}
        </nav>
      </header>
      <main className="mx-auto max-w-[1400px] py-5 text-slate-800" style={{ paddingLeft: 'max(16px, env(safe-area-inset-left, 0px))', paddingRight: 'max(16px, env(safe-area-inset-right, 0px))' }}>
        {current === 'platform' && <PlatformAdmin supabase={supabase} />}
        {current !== 'platform' && membership && <ProviderArea key={providerId} supabase={supabase} membership={membership} tab={current as Tab} />}
        {!membership && !isPlatformAdmin && <Empty>No access yet.</Empty>}
      </main>
    </div>
  );
}

function ProviderArea({ supabase, membership, tab }: { supabase: SupabaseClient; membership: Membership; tab: Tab }) {
  const d = useProviderData(supabase, membership.provider_id);
  const manager = isManagerRole(membership.role);
  return (
    <>
      {tab === 'dashboard' && <Dashboard d={d} />}
      {tab === 'services' && <ServicesView supabase={supabase} providerId={membership.provider_id} d={d} canEdit={manager} />}
      {tab === 'people' && <PeopleView supabase={supabase} membership={membership} d={d} />}
      {tab === 'team' && <TeamView supabase={supabase} membership={membership} d={d} />}
      {tab === 'frontline' && <FrontlineView supabase={supabase} d={d} />}
      {tab === 'safety' && <SafetyView supabase={supabase} membership={membership} d={d} />}
      {d.alerts.some((a) => !a.acknowledged_at) && tab !== 'safety' && (
        <div className="fixed bottom-4 right-4 z-40 flex items-center gap-2 rounded-2xl border border-red-300 bg-red-600 px-4 py-3 text-[13px] font-semibold text-white shadow-2xl" role="alert"><AlertTriangle className="h-4 w-4" aria-hidden />{d.alerts.filter((a) => !a.acknowledged_at).length} open safety alert(s)</div>
      )}
    </>
  );
}
