import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createClient, type Session } from '@supabase/supabase-js';
import CarePlanOSApp, { type Action, type LiveBridge } from './CarePlanOS';
import ProviderConsole, { type Membership } from './console';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;
const IDLE_SIGN_OUT_MS = 30 * 60 * 1000;

export const supabase = SUPABASE_URL && SUPABASE_KEY
  ? createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: 'pkce' } })
  : null;

interface Ctx {
  tenant_id: string; tenant_name: string; role: 'worker' | 'manager'; display_name: string; epoch: number;
  epoch_started_ms: number; clock_offset_ms: number; server_now_ms: number; active_staff: string | null;
}
interface Row { seq: number; epoch: number; type: string; payload: Action }

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-screen place-items-center bg-[#0F172A] px-4 py-10 text-slate-100" style={{ background: 'radial-gradient(60% 50% at 10% 10%, rgba(13,148,136,.25), transparent 60%), linear-gradient(180deg, #0F172A, #1E293B)' }}>
      <div className="w-full max-w-sm rounded-3xl border border-white/15 bg-slate-900/70 p-6 shadow-2xl backdrop-blur-xl">
        <p className="text-[18px] font-extrabold tracking-tight text-white">CarePlan<span className="text-teal-300">OS</span></p>
        <p className="mb-5 text-[11px] uppercase tracking-[0.16em] text-slate-400">Care management · CQC ready</p>
        {children}
      </div>
    </div>
  );
}

function SignIn() {
  const [email, setEmail] = useState('');
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const valid = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim()) && email.length <= 254;
  return (
    <Shell>
      {state === 'sent' ? (
        <div className="space-y-2 text-[14px]">
          <p className="font-semibold text-white">Check your email</p>
          <p className="text-slate-300">We sent a sign-in link to {email.trim()}. Open it on this device. The link expires in one hour.</p>
          <button type="button" className="text-[13px] font-semibold text-teal-300" onClick={() => setState('idle')}>Use a different email</button>
        </div>
      ) : (
        <form className="space-y-3" onSubmit={async (e) => {
          e.preventDefault();
          if (!valid || !supabase) return;
          setState('sending');
          const { error } = await supabase.auth.signInWithOtp({ email: email.trim().toLowerCase(), options: { emailRedirectTo: window.location.origin, shouldCreateUser: true } });
          setState(error ? 'error' : 'sent');
        }}>
          <label htmlFor="email" className="block text-[13px] font-semibold text-slate-200">Work email</label>
          <input id="email" type="email" autoComplete="email" required maxLength={254} value={email} onChange={(e) => setEmail(e.target.value)} className="w-full rounded-xl border border-white/15 bg-black/30 px-3 py-2.5 text-[14px] text-white focus:border-teal-400 focus:outline-none" />
          <button type="submit" disabled={!valid || state === 'sending'} className="w-full rounded-xl bg-teal-500 px-4 py-2.5 text-[14px] font-semibold text-slate-950 disabled:bg-slate-700 disabled:text-slate-400">{state === 'sending' ? 'Sending…' : 'Email me a sign-in link'}</button>
          {state === 'error' && <p className="text-[12px] text-red-300">We could not send the link. Wait a minute and try again.</p>}
          <p className="text-[11px] text-slate-500">Only people a manager has added can see care records.</p>
        </form>
      )}
    </Shell>
  );
}

function LiveApp({ session, onExit }: { session: Session; onExit?: () => void }) {
  const [ctx, setCtx] = useState<Ctx | null | undefined>(undefined);
  const [events, setEvents] = useState<Action[]>([]);
  const [connected, setConnected] = useState(false);
  const [clockOffset, setClockOffset] = useState(0);
  const [failed, setFailed] = useState<string | null>(null);
  const lastSeq = useRef(0);
  const pending = useRef<Map<number, Row>>(new Map());
  const ctxRef = useRef<Ctx | null>(null);
  const loadedAt = useRef(0);

  const signOut = useCallback(() => { void supabase?.auth.signOut().then(() => window.location.replace('/')); }, []);

  const accept = useCallback((row: Row) => {
    const c = ctxRef.current;
    if (!c) return;
    if (row.epoch !== c.epoch) { window.location.reload(); return; }
    if (row.seq <= lastSeq.current) return;
    pending.current.set(row.seq, row);
    const fresh: Action[] = [];
    let offset = 0;
    while (pending.current.has(lastSeq.current + 1)) {
      const r = pending.current.get(lastSeq.current + 1) as Row;
      pending.current.delete(r.seq);
      lastSeq.current = r.seq;
      fresh.push(r.payload);
      if (r.type === 'CLOCK_ADVANCE' && Date.now() > loadedAt.current) offset += Number((r.payload as { ms?: number }).ms ?? 0);
    }
    if (fresh.length) setEvents((prev) => [...prev, ...fresh]);
    if (offset) setClockOffset((o) => o + offset);
  }, []);

  const fetchFrom = useCallback(async (afterSeq: number) => {
    const c = ctxRef.current;
    if (!c || !supabase) return [] as Row[];
    const out: Row[] = [];
    for (let from = afterSeq; ; ) {
      const { data, error } = await supabase.from('events').select('seq, epoch, type, payload').eq('tenant_id', c.tenant_id).eq('epoch', c.epoch).gt('seq', from).order('seq').limit(1000);
      if (error) throw error;
      out.push(...(data as Row[]));
      if (!data || data.length < 1000) break;
      from = (data[data.length - 1] as Row).seq;
    }
    return out;
  }, []);

  useEffect(() => {
    if (!supabase) return undefined;
    let cancelled = false;
    let channel: ReturnType<NonNullable<typeof supabase>['channel']> | null = null;
    (async () => {
      try {
        await supabase.rpc('claim_membership');
        const { data, error } = await supabase.rpc('get_my_context');
        if (error) throw error;
        if (!data) { if (!cancelled) setCtx(null); return; }
        const c = data as Ctx;
        ctxRef.current = c;
        const rows = await fetchFrom(0);
        if (cancelled) return;
        lastSeq.current = rows.length ? rows[rows.length - 1].seq : 0;
        loadedAt.current = Date.now();
        setEvents(rows.map((r) => r.payload));
        setClockOffset(c.clock_offset_ms);
        setCtx(c);
        channel = supabase.channel(`events-${c.tenant_id}`)
          .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'events', filter: `tenant_id=eq.${c.tenant_id}` }, (p) => accept(p.new as Row))
          .subscribe((status) => {
            setConnected(status === 'SUBSCRIBED');
            if (status === 'SUBSCRIBED') void fetchFrom(lastSeq.current).then((rs) => rs.forEach(accept)).catch(() => undefined);
          });
      } catch {
        if (!cancelled) setFailed('We could not load your service. Check your connection and refresh.');
      }
    })();
    return () => { cancelled = true; if (channel) void supabase.removeChannel(channel); };
  }, [accept, fetchFrom]);

  useEffect(() => {
    if (!ctx || !supabase) return undefined;
    const i = window.setInterval(async () => {
      const { data } = await supabase.rpc('get_my_context');
      if (data && (data as Ctx).epoch !== ctx.epoch) window.location.reload();
      if (pending.current.size) void fetchFrom(lastSeq.current).then((rs) => rs.forEach(accept)).catch(() => undefined);
    }, 30000);
    return () => window.clearInterval(i);
  }, [ctx, accept, fetchFrom]);

  useEffect(() => {
    let last = Date.now();
    const touch = () => { last = Date.now(); };
    const i = window.setInterval(() => { if (Date.now() - last > IDLE_SIGN_OUT_MS) signOut(); }, 30000);
    window.addEventListener('pointerdown', touch);
    window.addEventListener('keydown', touch);
    return () => { window.clearInterval(i); window.removeEventListener('pointerdown', touch); window.removeEventListener('keydown', touch); };
  }, [signOut]);

  const submit = useCallback(async (a: Action) => {
    const c = ctxRef.current;
    if (!c || !supabase) return 'NO_ACCESS';
    const { data, error } = await supabase.rpc('submit_event', { p_type: a.type, p_payload: a, p_epoch: c.epoch });
    if (error) return (error.message || 'ERROR').split('\n')[0];
    if (!data) return 'PIN_INVALID';
    accept(data as Row);
    return 'ok';
  }, [accept]);

  const bridge: LiveBridge | null = useMemo(() => (ctx ? {
    role: ctx.role, email: session.user.email ?? '', tenantName: ctx.tenant_name,
    clockBaseMs: ctx.epoch_started_ms, clockOffsetMs: clockOffset, skewMs: ctx.server_now_ms - loadedAt.current,
    events, connected, submit, signOut,
    resetDemo: async () => { const { error } = await supabase!.rpc('reset_demo'); return error ? error.message : 'ok'; },
    inviteMember: async (email, role, name) => { const { error } = await supabase!.rpc('invite_member', { p_email: email, p_role: role, p_display_name: name }); return error ? error.message : 'ok'; },
  } : null), [ctx, clockOffset, events, connected, submit, signOut, session.user.email]);

  if (failed) return <Shell><p className="text-[14px] text-red-200">{failed}</p></Shell>;
  if (ctx === undefined) return <Shell><p className="text-[14px] text-slate-300">Loading your service…</p></Shell>;
  if (ctx === null) {
    return (
      <Shell>
        <p className="text-[14px] font-semibold text-white">No access yet</p>
        <p className="mt-1 text-[13px] text-slate-300">You are signed in as {session.user.email}, but no manager has given this email access. Ask your manager to add you, then sign in again.</p>
        <button type="button" onClick={signOut} className="mt-4 rounded-xl border border-white/15 px-3 py-2 text-[13px] font-semibold">Sign out</button>
      </Shell>
    );
  }
  return (
    <>
      <CarePlanOSApp key={ctx.epoch} live={bridge as LiveBridge} />
      {onExit && <button type="button" onClick={onExit} className="fixed bottom-4 left-4 z-[90] rounded-xl border border-white/20 bg-slate-900/90 px-3 py-2 text-[12px] font-semibold text-white shadow-2xl backdrop-blur">Back to provider console</button>}
    </>
  );
}

function Home({ session }: { session: Session }) {
  const [info, setInfo] = useState<{ memberships: Membership[]; isAdmin: boolean; demo: boolean } | null>(null);
  const [mode, setMode] = useState<'console' | 'demo'>('console');
  const signOut = useCallback(() => { void supabase?.auth.signOut().then(() => window.location.replace('/')); }, []);
  useEffect(() => {
    if (!supabase) return;
    let cancelled = false;
    (async () => {
      await Promise.allSettled([supabase.rpc('claim_membership'), supabase.rpc('claim_provider_memberships')]);
      const [mem, prov, admin, ctx] = await Promise.all([
        supabase.from('provider_members').select('provider_id, role, display_name, active').eq('user_id', session.user.id),
        supabase.from('providers').select('id, name, live_data_enabled'),
        supabase.rpc('platform_list_providers'),
        supabase.rpc('get_my_context'),
      ]);
      const provs = new Map(((prov.data ?? []) as Array<{ id: string; name: string; live_data_enabled: boolean }>).map((p) => [p.id, p]));
      const memberships = ((mem.data ?? []) as Array<{ provider_id: string; role: Membership['role']; display_name: string; active: boolean }>)
        .filter((m) => m.active && provs.has(m.provider_id))
        .map((m) => ({ provider_id: m.provider_id, role: m.role, display_name: m.display_name, provider_name: provs.get(m.provider_id)!.name, live_data_enabled: provs.get(m.provider_id)!.live_data_enabled }));
      if (!cancelled) setInfo({ memberships, isAdmin: !admin.error, demo: !ctx.error && !!ctx.data });
    })();
    return () => { cancelled = true; };
  }, [session.user.id]);
  if (!supabase) return null;
  if (!info) return <Shell><p className="text-[14px] text-slate-300">Loading your account…</p></Shell>;
  const hasConsole = info.memberships.length > 0 || info.isAdmin;
  if (!hasConsole || mode === 'demo') return <LiveApp session={session} onExit={hasConsole ? () => setMode('console') : undefined} />;
  return <ProviderConsole supabase={supabase} memberships={info.memberships} isPlatformAdmin={info.isAdmin} email={session.user.email ?? ''} onOpenDemo={info.demo ? () => setMode('demo') : null} onSignOut={signOut} />;
}

export default function Root() {
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  useEffect(() => {
    if (!supabase) { setSession(null); return undefined; }
    void supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => data.subscription.unsubscribe();
  }, []);
  if (!supabase) return <CarePlanOSApp />;
  if (session === undefined) return <Shell><p className="text-[14px] text-slate-300">Starting…</p></Shell>;
  if (!session) return <SignIn />;
  return <Home session={session} />;
}
