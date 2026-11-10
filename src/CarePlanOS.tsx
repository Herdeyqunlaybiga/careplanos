/*
  CarePlanOS · Interactive investor and buyer prototype
  Single-file React 18 + TypeScript + Tailwind CSS + lucide-react
  One shared reducer drives three synchronized views: Frontline Mobile, Manager Desktop, Split-Screen Live Demo.
*/
import React, { useCallback, useContext, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  Activity, AlertTriangle, AudioLines, Ban, Bell, BellOff, Brain, Camera, Check, CheckCircle2,
  ChevronDown, ChevronRight, ClipboardCheck, ClipboardList, Clock, Cloud, CloudOff, Columns2, Copy, Droplets,
  Eye, EyeOff, FastForward, FileCheck2, FileText, Fingerprint, Flag, Hash, HeartHandshake, History, Hospital,
  Keyboard, Link2, ListChecks, Lock, MapPin, MessageSquareWarning, Mic, Monitor, Moon, PenLine, Pill,
  Receipt, RotateCcw, ScanLine, Search, Send, ShieldAlert, ShieldCheck, Siren, Smartphone, Sparkles, Square,
  Stethoscope, Users, Utensils, Radio, Gauge, Timer, HeartPulse, LayoutGrid, GraduationCap, KeyRound, Nfc, Type, Delete, House, MessageCircle, CalendarDays, UserRound, Volume2, VolumeX, X, Zap,
} from 'lucide-react';

/* ============================== Types ============================== */

type Domain = 'Safe' | 'Effective' | 'Caring' | 'Responsive' | 'Well-led';
type ViewMode = 'split' | 'worker' | 'manager' | 'family';
type LogStatus = 'pending' | 'clarification' | 'clarified' | 'approved' | 'rejected';
type Source = 'voice' | 'text' | 'photo' | 'emar' | 'incident' | 'obs';
type Round = 'Morning' | 'Lunch' | 'Tea' | 'Bedtime' | 'PRN';
type Tone = 'teal' | 'emerald' | 'amber' | 'red' | 'cyan' | 'slate';
type Surface = 'dark' | 'light';
type WorkerTab = 'journal' | 'emar' | 'plan' | 'handover';
type ManagerTab = 'triage' | 'floor' | 'audit' | 'matrix' | 'workforce';
type FrameworkId = 'saf2023' | 'cqc2026';
type AttachmentKind = 'skin' | 'meal' | 'receipt' | 'hospital';

interface Actor { name: string; role: string; kind: 'worker' | 'manager' | 'colleague' | 'system' }
interface Tags {
  fluidMl?: number; fluidEstimated?: boolean; mealPct?: number; mealLabel?: string; mood?: string;
  personalCare?: string[]; behaviour?: string[]; activity?: string[]; pain?: number; med?: boolean; choice?: boolean;
}
interface Attachment { id: string; kind: AttachmentKind; label: string; detail: string }
interface ThreadMsg { id: string; from: 'manager' | 'worker'; author: string; time: number; text: string; mode: 'text' | 'voice'; durationSec?: number }
interface Revision { time: number; by: string; text: string; reason: string }
interface Signature { by: string; role: string; at: number; hash: string }
interface LogEntry {
  id: string; residentId: string; time: number; author: string; authorRole: string; source: Source;
  original: string; text: string; tags: Tags; cqc: Domain[]; risk: boolean; riskReasons: string[]; dialect: string[];
  status: LogStatus; flagged: boolean; attachments: Attachment[]; thread: ThreadMsg[]; revisions: Revision[];
  signature?: Signature; reject?: { code: string; note: string; by: string; at: number; route: string };
  synced: boolean; durationSec?: number; accent?: string; confidence?: number; incidentId?: string; escalatedAt?: number;
}
interface PbsStep { stage: string; detail: string }
interface Passport { communication: string; triggers: string[]; warningSigns: string[]; strategies: PbsStep[]; likes: string[] }
interface RiskAssessment { id: string; name: string; tool: string; score: string; level: 'Low' | 'Medium' | 'High'; lastReviewed: string; reviewDays: number; controls: string[] }
interface LegalRecord { capacity: string; dols: string; lpa: string; resus: string; covert: string; voiceConsent: { status: 'consented' | 'best-interests' | 'declined-in-room'; detail: string } }
interface CarePlan { outcomes: string[]; routine: string[]; mobility: string; nutrition: string }
interface Resident {
  id: string; name: string; first: string; age: number; dob: string; nhs: string; room: string; location: string;
  conditions: string[]; short: string; allergies: string; fluidKind: 'target' | 'restriction'; fluidLimit: number;
  assigned: string; prnHistory: number[]; nextReview: string; careItems: string[]; passport: Passport; hue: string;
  weightKg: number; carePlan: CarePlan; legal: LegalRecord; risks: RiskAssessment[];
}
interface PrnDose { t: number; units: number }
interface Prn { minIntervalH: number; maxDoses24h: number; maxLabel: string; doses: PrnDose[]; indication: string; unitsMin: number; unitsMax: number; unitLabel: string; paracetamolMg?: number }
interface Med {
  id: string; residentId: string; name: string; dose: string; route: string; round: Round; instructions: string;
  barcode: string; status: 'given' | 'refused' | 'open'; givenAt?: number; givenBy?: string; witness?: string;
  refusedReason?: string; prn?: Prn; requiresWitness?: boolean; stomp?: boolean;
}
interface Incident {
  id: string; residentId: string; time: number; author: string; antecedent: string; behaviour: string; consequence: string;
  triggers: string[]; severity: 'Low' | 'Moderate' | 'High'; restrictive: boolean; restrictiveDetail: string;
  status: 'new' | 'reviewed'; reviewedBy?: string; reviewedAt?: number; reviewNote?: string; synced: boolean; logId: string; statutory: Record<string, number>;
}
interface Sos {
  id: string; raisedAt: number; worker: string; residentId: string; location: string;
  status: 'active' | 'acknowledged' | 'resolved' | 'cancelled'; responder?: string; ackAt?: number; resolvedAt?: number; outcome?: string;
}
interface AuditEvent { seq: number; id: string; time: number; actor: string; role: string; action: string; entity: string; detail: string; prevHash: string; hash: string }
interface QueuedAudit { actor: Actor; time: number; action: string; entity: string; detail: string }
interface ReportSection {
  residentId: string; lines: { time: number; text: string; status: LogStatus }[]; fluid: number; mealAvg: number | null;
  medsGiven: number; medsRefused: number; prnGiven: number; incidents: number; careDone: string[]; careOutstanding: string[];
}
interface ShiftReport { id: string; generatedAt: number; submittedAt?: number; status: 'submitted' | 'signed'; signature?: Signature; sections: ReportSection[]; handover: HandoverPoint[] }
interface HandoverPoint { residentId: string; text: string; tone: Tone }
interface State {
  logs: LogEntry[]; meds: Med[]; incidents: Incident[]; audit: AuditEvent[]; queue: QueuedAudit[];
  sos: Sos | null; sosHistory: Sos[]; report: ShiftReport | null; care: Record<string, Record<string, boolean>>; online: boolean;
  activeWorker: Actor | null; riskReviews: Record<string, number>; familyMessages: FamilyMessage[]; trainingBooked: Record<string, number>;
}
interface FamilyMessage { id: string; time: number; from: string; residentId: string; text: string; kind: 'message' | 'visit' }
interface Toast { id: number; text: string; tone: Tone; origin: 'worker' | 'manager' | 'system' | 'family' }

/* ============================== Time & utils ============================== */

const MIN = 60_000;
const HOUR = 60 * MIN;
const at = (h: number, m: number, s = 0) => Date.UTC(2026, 10, 10, h, m, s);
const BASE_NOW = at(15, 42, 10);
const SHIFT_START = at(8, 0);
const ROUND_TIME: Record<Round, number> = { Morning: at(8, 0), Lunch: at(12, 30), Tea: at(17, 0), Bedtime: at(21, 0), PRN: 0 };
const pad = (n: number) => String(n).padStart(2, '0');
const fmt = (t: number) => { const d = new Date(t); return `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`; };
const fmtS = (t: number) => { const d = new Date(t); return `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}`; };
const fmtDur = (ms: number) => {
  const s = Math.max(0, Math.ceil(ms / 1000)); const h = Math.floor(s / 3600); const m = Math.floor((s % 3600) / 60); const ss = s % 60;
  return h > 0 ? `${h}:${pad(m)}:${pad(ss)}` : `${pad(m)}:${pad(ss)}`;
};
const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));
const truncate = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s);
const firstLine = (s: string) => s.split('\n')[0];
const initials = (name: string) => name.split(' ').map((p) => p[0]).join('').slice(0, 2).toUpperCase();
const thousands = (n: number) => n.toLocaleString('en-GB');
let idCounter = 4100;
const uid = (p: string) => `${p}-${(idCounter++).toString(36).toUpperCase()}`;

function chainHash(input: string): string {
  let h1 = 0x811c9dc5; let h2 = 0x9e3779b1;
  for (let i = 0; i < input.length; i++) {
    const c = input.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 16777619);
    h2 = Math.imul(h2 ^ c, 2246822507); h2 ^= h2 >>> 13;
  }
  h1 = Math.imul(h1 ^ (h1 >>> 15), 2246822507); h2 = Math.imul(h2 ^ (h2 >>> 16), 3266489909);
  return (h1 >>> 0).toString(16).padStart(8, '0') + (h2 >>> 0).toString(16).padStart(8, '0');
}

function nhsNumber(nine: string): string {
  let base = nine;
  for (let tries = 0; tries < 10; tries++) {
    const digits = base.split('').map(Number);
    const sum = digits.reduce((acc, d, i) => acc + d * (10 - i), 0);
    let check = 11 - (sum % 11);
    if (check === 11) check = 0;
    if (check !== 10) { const full = base + check; return `${full.slice(0, 3)} ${full.slice(3, 6)} ${full.slice(6)}`; }
    base = base.slice(0, 8) + String((Number(base[8]) + 1) % 10);
  }
  return base;
}
const maskNhs = (n: string) => `••• ••• ${n.slice(-4)}`;

/* ============================== Reference data ============================== */

const PROVIDER = { name: 'Willow Lane Supported Living', town: 'Gloucester', locationId: '1-2841637902' };
const WORKER: Actor = { name: 'David S.', role: 'Senior Support Worker', kind: 'worker' };
const MANAGER: Actor = { name: 'Sarah Okafor', role: 'Registered Manager', kind: 'manager' };
const DEVICE_AI: Actor = { name: 'CarePlanOS AI (on-device)', role: 'Automated', kind: 'worker' };
const SERVER: Actor = { name: 'CarePlanOS Server', role: 'System', kind: 'system' };
const NIGHT: Actor = { name: 'Grace Mensah', role: 'Night Support Worker', kind: 'colleague' };
const AMINA: Actor = { name: 'Amina Kamara', role: 'Support Worker', kind: 'colleague' };
const TOMASZ: Actor = { name: 'Tomasz Nowak', role: 'Support Worker', kind: 'colleague' };
const WITNESSES = ['Amina Kamara', 'Tomasz Nowak', 'Sarah Okafor (RM)'];
const FAMILY: Actor = { name: 'Helen Holloway', role: 'Daughter, LPA (property and finance)', kind: 'system' };
const TODAY_MS = at(0, 0);
const dateMs = (iso: string) => { const [y, m, d] = iso.split('-').map(Number); return Date.UTC(y, m - 1, d); };
const fmtDate = (t: number) => new Date(t).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' });
const CLARIFY_SLA_MIN = 60;
const IDLE_LOCK_MS = 5 * MIN;
const TRAINING = ['Medication competency', 'Safeguarding adults L2', 'Mental Capacity Act', 'PBS and MAPA', 'Moving and handling', 'Fire safety'];
interface StaffMember { actor: Actor; pin: string; hue: string; supervision: string; training: Record<string, string> }
const STAFF: StaffMember[] = [
  { actor: { name: 'David S.', role: 'Senior Support Worker', kind: 'worker' }, pin: '2580', hue: 'from-cyan-300 to-teal-400', supervision: '2026-10-21', training: { 'Medication competency': '2027-03-14', 'Safeguarding adults L2': '2027-06-02', 'Mental Capacity Act': '2027-02-10', 'PBS and MAPA': '2027-05-19', 'Moving and handling': '2027-01-08', 'Fire safety': '2026-12-01' } },
  { actor: { name: 'Amina Kamara', role: 'Support Worker', kind: 'worker' }, pin: '1357', hue: 'from-emerald-300 to-cyan-400', supervision: '2026-09-30', training: { 'Medication competency': '2027-01-20', 'Safeguarding adults L2': '2027-04-11', 'Mental Capacity Act': '2026-12-15', 'PBS and MAPA': '2026-11-28', 'Moving and handling': '2027-03-03', 'Fire safety': '2027-02-17' } },
  { actor: { name: 'Tomasz Nowak', role: 'Support Worker', kind: 'worker' }, pin: '4826', hue: 'from-amber-300 to-orange-400', supervision: '2026-08-12', training: { 'Medication competency': '2026-10-31', 'Safeguarding adults L2': '2027-01-30', 'Mental Capacity Act': '2027-05-05', 'PBS and MAPA': '2027-02-22', 'Moving and handling': '2026-10-15', 'Fire safety': '2027-04-09' } },
];
const staffByName = (name: string) => STAFF.find((x) => x.actor.name === name);
function expiryStatus(iso: string, now: number): { tone: Tone; label: string } {
  const t = dateMs(iso);
  if (t < now) return { tone: 'red', label: 'Expired' };
  if (t - now < 30 * 24 * HOUR) return { tone: 'amber', label: 'Due soon' };
  return { tone: 'emerald', label: 'Valid' };
}
function medCompetent(name: string, now: number): { ok: boolean; expiry?: string } {
  const st = staffByName(name);
  const exp = st?.training['Medication competency'];
  return { ok: !exp || dateMs(exp) >= now, expiry: exp };
}
const MeCtx = React.createContext<Actor>(WORKER);
export interface LiveBridge {
  role: 'worker' | 'manager';
  email: string;
  tenantName: string;
  clockBaseMs: number;
  clockOffsetMs: number;
  skewMs: number;
  events: Action[];
  connected: boolean;
  submit: (a: Action) => Promise<string>;
  resetDemo: () => Promise<string>;
  inviteMember: (email: string, role: 'worker' | 'manager', name: string) => Promise<string>;
  signOut: () => void;
}
const LiveCtx = React.createContext<LiveBridge | null>(null);
const LIVE_ERRORS: Record<string, string> = {
  PIN_INVALID: 'Wrong PIN. The attempt has been logged.',
  PIN_LOCKED: 'Too many wrong PINs. This badge is locked for 10 minutes.',
  HANDSET_LOCKED: 'The handset is locked. Sign in with your badge and PIN first.',
  CLOCK_SKEW: 'This device clock is out of step with the server. Refresh the page.',
  STALE_EPOCH: 'The demo was reset on another device. Reloading.',
  NO_ACCESS: 'Your account has no access to this service.',
  INVALID_PAYLOAD: 'The server rejected malformed data.',
};
const friendlyLiveError = (code: string) => {
  if (code.startsWith('PRN_BLOCKED')) return `Server blocked this dose: ${code.replace('PRN_BLOCKED: ', '')}.`;
  if (code.startsWith('FORBIDDEN')) return 'Your role cannot do this. The attempt was refused by the server.';
  return LIVE_ERRORS[code] ?? 'The server could not save this. Check your connection and try again.';
};
const useMe = () => useContext(MeCtx);
const DOMAINS: Domain[] = ['Safe', 'Effective', 'Caring', 'Responsive', 'Well-led'];

const RESIDENTS: Resident[] = [
  {
    id: 'arthur', name: 'Arthur Pendelton', first: 'Arthur', age: 78, dob: '14 Mar 1948', nhs: nhsNumber('943476591'), room: 'Flat 1',
    location: 'Flat 1 · Lounge', conditions: ["Alzheimer's dementia", 'Falls risk (2 falls in 90 days)', 'Hypertension'], short: 'Dementia · Fall risk',
    allergies: 'No known drug allergies', fluidKind: 'target', fluidLimit: 1600, assigned: 'David S.', prnHistory: [1, 0, 1, 1, 0, 1], nextReview: '02 Dec 2026',
    careItems: ['Wash and shave', 'Oral care (dentures)', 'Continence support', 'Skin check (heels, sacrum)', 'Repositioning 2-hourly', 'Sensor mat checked'],
    hue: 'from-teal-400 to-cyan-500',
    weightKg: 71,
    carePlan: {
      outcomes: ['Feel safe and settled in the late afternoon', 'Keep walking with his frame every day', 'Stay connected with his son and his Navy memories'],
      routine: ['07:30 wake, wash and shave with prompts', '12:30 lunch in the quiet dining area', '15:00 garden walk with frame', '21:00 bedtime, sensor mat on'],
      mobility: 'Walks with a frame and one staff in sight. Sensor mat at night.', nutrition: 'Normal diet. Tea with milk and two sugars. Encourage fluids hourly.',
    },
    legal: {
      capacity: 'Lacks capacity for care and treatment decisions (MCA assessment 12 Aug 2026)', dols: 'DoLS authorised by Gloucestershire County Council, expires 03 Feb 2027',
      lpa: 'Son holds a Health and Welfare LPA', resus: 'ReSPECT form in place. DNACPR signed by GP 22 Jul 2026', covert: 'Not authorised',
      voiceConsent: { status: 'best-interests', detail: 'Voice notes agreed as a best-interests decision with his son, 12 Aug 2026' },
    },
    risks: [
      { id: 'falls', name: 'Falls', tool: 'FRAT', score: '14', level: 'High', lastReviewed: '2026-10-14', reviewDays: 30, controls: ['Frame within reach', 'Sensor mat at night', 'Non-slip footwear'] },
      { id: 'skin', name: 'Pressure ulcer risk', tool: 'Waterlow', score: '12', level: 'Medium', lastReviewed: '2026-10-20', reviewDays: 30, controls: ['Heels checked daily', '2-hourly repositioning when seated long'] },
      { id: 'nutrition', name: 'Malnutrition', tool: 'MUST', score: '0', level: 'Low', lastReviewed: '2026-11-01', reviewDays: 30, controls: ['Monthly weight'] },
      { id: 'peep', name: 'Fire evacuation', tool: 'PEEP', score: '1 staff', level: 'Medium', lastReviewed: '2026-06-01', reviewDays: 180, controls: ['Frame and one staff', 'Exit via lounge door'] },
    ],
    passport: {
      communication: 'Hard of hearing in the left ear, so approach from his right. Sometimes calls staff Joan, his late wife. Do not correct him; respond to the feeling.',
      triggers: ['Late afternoon sundowning (15:30 to 18:00)', 'Being rushed during personal care', 'News that his son has cancelled a visit', 'Noisy dining room at mealtimes'],
      warningSigns: ['Exit seeking at fire doors', 'Asking repeatedly for Joan', 'Tearful, wringing hands'],
      strategies: [
        { stage: 'Proactive', detail: 'Garden walk at 15:00 with his frame. 1950s music in the lounge from 15:30.' },
        { stage: 'Early warning', detail: 'Offer the photo album and a tea with milk and two sugars. Talk about his Royal Navy service.' },
        { stage: 'De-escalation', detail: 'Walk alongside him, then redirect to a kitchen task such as folding tea towels.' },
        { stage: 'Crisis', detail: 'Keep his frame within reach and the sensor mat on. Call the senior if exit seeking lasts over 20 minutes.' },
        { stage: 'Recovery', detail: 'Quiet lounge with familiar staff. Note what worked in the journal.' },
      ],
      likes: ['Royal Navy stories', 'Vera Lynn', 'Watching the robins', 'Tea, milk, two sugars'],
    },
  },
  {
    id: 'leo', name: 'Leo Vance', first: 'Leo', age: 24, dob: '22 Jun 2002', nhs: nhsNumber('485777345'), room: 'Flat 2',
    location: 'Flat 2 · Sensory room', conditions: ['Autism', 'Moderate learning disability', 'PBS plan v4 (reviewed Sep 2026)'], short: 'Autism · PBS plan',
    allergies: 'Peanuts (anaphylaxis, adrenaline pen in office)', fluidKind: 'target', fluidLimit: 2000, assigned: 'David S.', prnHistory: [0, 1, 0, 0, 2, 0], nextReview: '18 Nov 2026',
    careItems: ['Shower (verbal prompts)', 'Oral care', 'Visual schedule set for tomorrow', 'Room tidy (prompted)', 'Evening routine prepared'],
    hue: 'from-amber-400 to-orange-500',
    weightKg: 82,
    carePlan: {
      outcomes: ['Go to college three days a week', 'Shop for his magazine on his own with prompts', 'Fewer distressed episodes each month'],
      routine: ['07:45 visual schedule set with staff', '08:30 bus to college (Mon, Wed, Fri)', '16:00 garden football', '20:30 melatonin, quiet room time'],
      mobility: 'Fully mobile. Supported in the community with one staff.', nutrition: 'Peanut-free diet. Likes pasta. Blackcurrant squash.',
    },
    legal: {
      capacity: 'Has capacity for day-to-day choices. Supported decision-making for finances', dols: 'No deprivation of liberty identified (reviewed Sep 2026)',
      lpa: 'Appointee for benefits: Gloucestershire County Council', resus: 'For full resuscitation', covert: 'Not authorised',
      voiceConsent: { status: 'consented', detail: 'Consented using an easy-read form, 02 Sep 2026' },
    },
    risks: [
      { id: 'behaviour', name: 'Behaviours of distress', tool: 'PBS risk plan', score: 'v4', level: 'High', lastReviewed: '2026-09-15', reviewDays: 30, controls: ['Visual schedule', 'Ear defenders carried', 'Quiet room available'] },
      { id: 'anaphylaxis', name: 'Anaphylaxis (peanut)', tool: 'Allergy plan', score: 'Severe', level: 'High', lastReviewed: '2026-08-01', reviewDays: 180, controls: ['Adrenaline pen carried on outings', 'Peanut-free kitchen'] },
      { id: 'community', name: 'Community access', tool: 'Risk assessment', score: 'Medium', level: 'Medium', lastReviewed: '2026-10-05', reviewDays: 90, controls: ['One staff', 'Avoid peak times'] },
      { id: 'peep', name: 'Fire evacuation', tool: 'PEEP', score: '1 staff', level: 'Medium', lastReviewed: '2026-07-10', reviewDays: 180, controls: ['Ear defenders for alarms', 'Warn before fire drills'] },
    ],
    passport: {
      communication: 'Verbal, short sentences. Uses visual countdown cards. Give him 10 seconds of processing time after each instruction.',
      triggers: ['Unexpected loud noise (alarms, hand dryers, card machines)', 'Changes to routine without a visual warning', 'Queues or waits longer than 5 minutes', 'Unfamiliar or agency staff without an introduction'],
      warningSigns: ['Hands over ears, humming loudly', 'Pacing and rocking', 'Repeating "home time" questions', 'Flushed face, clenched fists'],
      strategies: [
        { stage: 'Proactive', detail: 'Set the visual schedule each morning. Give a 15-minute warning before any change.' },
        { stage: 'Early warning', detail: 'Offer ear defenders and the countdown card. Lower your voice and reduce demands.' },
        { stage: 'De-escalation', detail: 'Guide him to a low-stimulus space (quiet room or garden bench). Offer the weighted blanket. Two staff at most, stand to his side.' },
        { stage: 'Crisis', detail: 'Keep others safe and clear objects. No physical intervention unless serious harm is imminent. PRN Lorazepam 0.5 mg only per protocol after steps 1 to 3.' },
        { stage: 'Recovery', detail: 'Quiet time with blackcurrant squash. Debrief later using visuals, not straight away.' },
      ],
      likes: ['Thomas the Tank Engine videos', 'Blackcurrant squash', 'Kicking a football in the garden', 'Buying his magazine on Tuesdays'],
    },
  },
  {
    id: 'margaret', name: 'Margaret Holloway', first: 'Margaret', age: 82, dob: '09 Jan 1944', nhs: nhsNumber('401023461'), room: 'Flat 3',
    location: 'Flat 3 · Bedroom', conditions: ['Heart failure (fluid restriction)', 'Osteoarthritis, left hip', 'Osteoporosis', 'Atrial fibrillation on apixaban'], short: 'Mobility · PRN',
    allergies: 'Penicillin (rash)', fluidKind: 'restriction', fluidLimit: 1500, assigned: 'David S.', prnHistory: [2, 2, 3, 2, 2, 1], nextReview: '25 Nov 2026',
    careItems: ['Shower (2 staff, shower chair)', 'Oral care', 'Continence support', 'Barrier cream to sacrum', 'Hearing aid batteries', 'Daily weight recorded'],
    hue: 'from-emerald-400 to-teal-500',
    weightKg: 47,
    carePlan: {
      outcomes: ['Manage hip pain so she can enjoy physio', 'Keep her skin healthy', 'Daily phone call with Helen'],
      routine: ['07:30 alendronic acid on Tuesdays, upright 30 minutes', '08:40 morning medicines, pulse checked', '11:30 analgesia before physio at 12:00', '19:30 shower with two staff on Mon, Wed, Fri'],
      mobility: 'Wheelchair for distances. Stand aid with two staff.', nutrition: 'Fluid restriction 1,500 ml a day (heart failure). Weighed daily.',
    },
    legal: {
      capacity: 'Has capacity', dols: 'Not applicable', lpa: 'Daughter Helen holds a Property and Financial Affairs LPA',
      resus: 'ReSPECT: for ward-based care, not for CPR (agreed with Margaret 05 Jun 2026)', covert: 'Not applicable',
      voiceConsent: { status: 'declined-in-room', detail: 'Declined voice recording inside her room. Record notes outside her room.' },
    },
    risks: [
      { id: 'skin', name: 'Pressure ulcer risk', tool: 'Waterlow', score: '17', level: 'High', lastReviewed: '2026-11-03', reviewDays: 7, controls: ['Repositioning 2-hourly in bed', 'Barrier cream to sacrum', 'Pressure-relieving mattress'] },
      { id: 'falls', name: 'Falls', tool: 'FRAT', score: '9', level: 'Medium', lastReviewed: '2026-10-28', reviewDays: 30, controls: ['Stand aid with two staff', 'Call bell in reach'] },
      { id: 'nutrition', name: 'Malnutrition', tool: 'MUST', score: '1', level: 'Medium', lastReviewed: '2026-10-25', reviewDays: 14, controls: ['Weekly weight', 'Fortified puddings'] },
      { id: 'bleeding', name: 'Bleeding (anticoagulant)', tool: 'Risk assessment', score: 'Apixaban', level: 'Medium', lastReviewed: '2026-09-02', reviewDays: 90, controls: ['Report bruising or bleeding', 'Soft toothbrush'] },
      { id: 'peep', name: 'Fire evacuation', tool: 'PEEP', score: '2 staff', level: 'High', lastReviewed: '2026-06-20', reviewDays: 180, controls: ['Evac chair', 'Two staff'] },
    ],
    passport: {
      communication: 'Hearing aids in both ears; check batteries daily. Prefers new staff to call her Mrs Holloway until she invites otherwise.',
      triggers: ['Pain in her left hip', 'Unfamiliar staff for personal care', 'Feeling cold after her shower'],
      warningSigns: ['Quiet and withdrawn', 'Guarding her left hip', 'Refusing to mobilise'],
      strategies: [
        { stage: 'Proactive', detail: 'Offer PRN analgesia 30 minutes before physio and her shower.' },
        { stage: 'Early warning', detail: 'Warm the bathroom first. Introduce new staff alongside a familiar carer.' },
        { stage: 'De-escalation', detail: 'Pause, explain each step and offer choices.' },
        { stage: 'Crisis', detail: 'Chest pain or breathlessness: call 999 (heart failure). Never exceed her fluid restriction.' },
        { stage: 'Recovery', detail: 'Tea, Radio 4 and a phone call to her daughter Helen.' },
      ],
      likes: ['Radio 4', 'Crosswords with Helen', 'Her blue cardigan', 'Rice pudding'],
    },
  },
];
const residentById = (id: string) => RESIDENTS.find((r) => r.id === id) ?? RESIDENTS[0];

const med = (p: Omit<Med, 'status'> & { status?: Med['status'] }): Med => ({ status: 'open', ...p });
const MEDS_SEED: Med[] = [
  med({ id: 'a1', residentId: 'arthur', name: 'Amlodipine 5 mg tablets', dose: '1 tablet', route: 'Oral', round: 'Morning', instructions: 'Once daily in the morning.', barcode: '5012617011483', status: 'given', givenAt: at(8, 32), givenBy: 'David S.' }),
  med({ id: 'a2', residentId: 'arthur', name: 'Adcal-D3 chewable tablets', dose: '1 tablet', route: 'Oral (chew)', round: 'Lunch', instructions: 'Chew, then swallow. Twice daily with food.', barcode: '5016533632211', status: 'refused', givenAt: at(12, 34), givenBy: 'David S.', refusedReason: 'Declined, said it tastes chalky' }),
  med({ id: 'a3', residentId: 'arthur', name: 'Adcal-D3 chewable tablets', dose: '1 tablet', route: 'Oral (chew)', round: 'Tea', instructions: 'Chew, then swallow. Twice daily with food.', barcode: '5016533632211' }),
  med({ id: 'a4', residentId: 'arthur', name: 'Donepezil 5 mg tablets', dose: '1 tablet', route: 'Oral', round: 'Bedtime', instructions: 'At night. Report vivid dreams or slow pulse.', barcode: '5012617022908' }),
  med({ id: 'a5', residentId: 'arthur', name: 'Paracetamol 500 mg tablets', dose: '1 to 2 tablets', route: 'Oral', round: 'PRN', instructions: 'For pain. Minimum 4 hours between doses. Maximum 8 tablets in 24 hours.', barcode: '5000158062580', prn: { minIntervalH: 4, maxDoses24h: 4, maxLabel: '8 tablets', doses: [{ t: at(7, 45), units: 1 }], indication: 'Mild to moderate pain', unitsMin: 1, unitsMax: 2, unitLabel: 'tablet', paracetamolMg: 500 } }),
  med({ id: 'l1', residentId: 'leo', name: 'Sertraline 50 mg tablets', dose: '1 tablet', route: 'Oral', round: 'Morning', instructions: 'Once daily with breakfast.', barcode: '5012617034710', status: 'given', givenAt: at(8, 20), givenBy: 'David S.' }),
  med({ id: 'l2', residentId: 'leo', name: 'Melatonin 2 mg MR tablets', dose: '1 tablet', route: 'Oral', round: 'Bedtime', instructions: 'One to two hours before bed. Swallow whole.', barcode: '5012617045327' }),
  med({ id: 'l3', residentId: 'leo', name: 'Lorazepam 0.5 mg tablets', dose: '1 tablet', route: 'Oral', round: 'PRN', instructions: 'Severe anxiety only, per PBS plan step 4, after steps 1 to 3. Minimum 4 hours. Maximum 2 doses in 24 hours. Witness required.', barcode: '5012617050918', requiresWitness: true, stomp: true, prn: { minIntervalH: 4, maxDoses24h: 2, maxLabel: '2 tablets', doses: [{ t: at(14, 5), units: 1 }], indication: 'Severe anxiety, PBS step 4', unitsMin: 1, unitsMax: 1, unitLabel: 'tablet' } }),
  med({ id: 'm1', residentId: 'margaret', name: 'Alendronic acid 70 mg tablets', dose: '1 tablet (weekly, Tuesdays)', route: 'Oral', round: 'Morning', instructions: 'Tuesdays only. 30 minutes before food with a full glass of water. Stay upright.', barcode: '5012617061235', status: 'given', givenAt: at(7, 30), givenBy: 'Grace Mensah' }),
  med({ id: 'm2', residentId: 'margaret', name: 'Furosemide 40 mg tablets', dose: '1 tablet', route: 'Oral', round: 'Morning', instructions: 'In the morning. Monitor fluid balance and daily weight.', barcode: '5012617072989', status: 'given', givenAt: at(8, 40), givenBy: 'David S.' }),
  med({ id: 'm3', residentId: 'margaret', name: 'Bisoprolol 2.5 mg tablets', dose: '1 tablet', route: 'Oral', round: 'Morning', instructions: 'Check pulse first. Withhold if below 50 bpm and inform the senior.', barcode: '5012617083602', status: 'given', givenAt: at(8, 40), givenBy: 'David S.' }),
  med({ id: 'm4', residentId: 'margaret', name: 'Apixaban 5 mg tablets', dose: '1 tablet', route: 'Oral', round: 'Morning', instructions: 'Twice daily, 12 hours apart. Anticoagulant: report any bleeding.', barcode: '5012617094318', status: 'given', givenAt: at(8, 40), givenBy: 'David S.' }),
  med({ id: 'm5', residentId: 'margaret', name: 'Lactulose 3.35 g/5 ml oral solution', dose: '15 ml', route: 'Oral', round: 'Tea', instructions: 'Twice daily. Measure with the oral syringe.', barcode: '5012617105012' }),
  med({ id: 'm6', residentId: 'margaret', name: 'Apixaban 5 mg tablets', dose: '1 tablet', route: 'Oral', round: 'Bedtime', instructions: 'Twice daily, 12 hours apart. Anticoagulant: report any bleeding.', barcode: '5012617094318' }),
  med({ id: 'm7', residentId: 'margaret', name: 'Paracetamol 500 mg tablets', dose: '1 to 2 tablets', route: 'Oral', round: 'PRN', instructions: 'Left hip pain. Offer 30 minutes before physio. Minimum 4 hours. Weight under 50 kg: no more than 60 mg/kg paracetamol in 24 hours.', barcode: '5000158062580', prn: { minIntervalH: 4, maxDoses24h: 4, maxLabel: '8 tablets', doses: [{ t: at(6, 10), units: 2 }, { t: at(11, 58), units: 2 }], indication: 'Hip pain, score 4/10 or more', unitsMin: 1, unitsMax: 2, unitLabel: 'tablet', paracetamolMg: 500 } }),
  med({ id: 'm8', residentId: 'margaret', name: 'Co-codamol 8/500 mg tablets', dose: '1 to 2 tablets', route: 'Oral', round: 'PRN', instructions: 'Contains paracetamol. Never within 4 hours of any other paracetamol product. Minimum 4 hours. Maximum 8 tablets in 24 hours.', barcode: '5000158100572', prn: { minIntervalH: 4, maxDoses24h: 4, maxLabel: '8 tablets', doses: [], indication: 'Hip pain not settled by paracetamol', unitsMin: 1, unitsMax: 2, unitLabel: 'tablet', paracetamolMg: 500 } }),
];

const CARE_SEED: Record<string, Record<string, boolean>> = {
  arthur: { 'Wash and shave': true, 'Oral care (dentures)': true, 'Continence support': true, 'Skin check (heels, sacrum)': true, 'Repositioning 2-hourly': false, 'Sensor mat checked': true },
  leo: { 'Shower (verbal prompts)': true, 'Oral care': true, 'Visual schedule set for tomorrow': false, 'Room tidy (prompted)': false, 'Evening routine prepared': false },
  margaret: { 'Shower (2 staff, shower chair)': true, 'Oral care': true, 'Continence support': true, 'Barrier cream to sacrum': true, 'Hearing aid batteries': false, 'Daily weight recorded': true },
};

/* ============================== Ambient AI parser ============================== */

const VERNACULAR: Array<[RegExp, string, string]> = [
  [/\bsmall small\b/gi, 'a little', 'West African English'],
  [/\bvexed small\b/gi, 'slightly agitated', 'West African English'],
  [/\bvexed\b/gi, 'agitated', 'West African English'],
  [/\b(he|she) (?:take|drink)\b/gi, '$1 drank', 'West African English'],
  [/\b(he|she) (?:chop|chopped)\b/gi, '$1 ate', 'West African English'],
  [/\b(he|she) settle\b/gi, '$1 settled', 'West African English'],
  [/\bI use the\b/g, 'I used the', 'West African English'],
  [/\bcuppa\b/gi, 'cup of tea', 'UK colloquial'],
  [/\bbrew\b/gi, 'cup of tea', 'Northern English'],
  [/\bchuffed\b/gi, 'pleased', 'UK colloquial'],
  [/\bknackered\b/gi, 'very tired', 'UK colloquial'],
  [/\bmardy\b/gi, 'grumpy', 'East Midlands English'],
  [/\bhaving tension\b/gi, 'anxious', 'South Asian English'],
  [/\bkindly note\b/gi, 'Note that', 'South Asian English'],
  [/\bwas little\b/gi, 'was a little', 'South Asian English'],
  [/\bpani\b/gi, 'water', 'South Asian English'],
  [/\bangry on\b/gi, 'angry with', 'European English'],
  [/\bmaking toilet\b/gi, 'using the toilet', 'European English'],
  [/\bfrom plate\b/gi, 'from the plate', 'European English'],
];

const MOODS: Array<[RegExp, string]> = [
  [/\b(agitated|irritable|angry|distressed|grumpy|shouting|upset|frustrated)\b/g, 'Agitated'],
  [/\b(anxious|worried|tearful|low|sad|withdrawn|confused)\b/g, 'Anxious / confused'],
  [/\b(tired|drowsy|sleepy)\b/g, 'Tired'],
  [/\b(calm|calmly|settled|relaxed|reassured|content)\b/g, 'Settled'],
  [/\b(happy|pleased|cheerful|smiling|laughing|chatty|chatting|good spirits|enjoyed)\b/g, 'Positive'],
];
const CARE_RE: Array<[RegExp, string]> = [
  [/\b(shower|bath|wash|washed|bed bath)\b/, 'Washing'],
  [/\b(oral care|teeth|dentures?|mouth care)\b/, 'Oral care'],
  [/\b(toilet|commode|continent|continence|pad change|incontinent)\b/, 'Continence'],
  [/\b(reposition\w*|slide sheet)\b/, 'Repositioning'],
  [/\b(shave|shaved|hair|nails|hearing aid)\b/, 'Grooming'],
  [/\b(dressed|dressing|cardigan|jumper|clothes)\b/, 'Dressing'],
  [/\b(barrier cream|skin intact|skin check|heels)\b/, 'Skin care'],
];
const BEHAVIOUR_RE: Array<[RegExp, string]> = [
  [/\b(hit|hitting|kick(?:ed|ing)?|bit|biting|punch\w*|slapp\w*|pinch\w*|pushed|grab\w*)\b/, 'Physical'],
  [/\b(scream\w*|shout\w*|yell\w*|swear\w*)\b/, 'Vocal distress'],
  [/\b(banged (?:his|her) head|head bang\w*|self[- ]injur\w*)\b/, 'Self-injury'],
  [/\b(threw|throw\w*|damaged|broke)\b/, 'Property'],
  [/\b(ran off|ran towards|absconded|exit seeking|looking for the exit|fire exit)\b/, 'Exit seeking'],
  [/\b(pacing|rocking)\b/, 'Restlessness'],
  [/\b(fell|found on the floor|slipped)\b/, 'Fall'],
];
const ACTIVITY_RE: Array<[RegExp, string]> = [
  [/\b(walk\w*|garden)\b/, 'Outdoors'],
  [/\b(shop|shopping|town|co-op|bus|community|college|library)\b/, 'Community'],
  [/\b(music|sensory room|crossword|photo album|football|videos|radio|bingo|activity)\b/, 'Activity'],
  [/\b(visit\w*|daughter|son|family|phone call|granddaughter)\b/, 'Family'],
  [/\b(gp|hospital|district nurse|physio\w*|dentist|optician|podiatr\w*|pharmac\w*)\b/, 'Health professional'],
];
const RISK_RE: Array<[RegExp, string]> = [
  [/\b(refus\w*|declin\w*)\b/, 'Refusal recorded'],
  [/\b(fell|found on the floor|slipped)\b/, 'Fall'],
  [/\b(red mark|bruis\w*|skin tear|broken skin|pressure sore|pressure ulcer)\b/, 'Skin integrity'],
  [/\b(pain|out of 10)\b|\d\/10/, 'Pain reported'],
  [/\b(agitated|aggress\w*|banged|self[- ]injur\w*|exit seeking|looking for the exit|fire exit)\b/, 'Behaviour of concern'],
  [/\b(unwell|temperature|vomit\w*|chest pain|breathless\w*|chok\w*)\b/, 'Health deterioration'],
  [/\b(lorazepam)\b/, 'PRN psychotropic'],
];
const NUMBER_WORDS: Record<string, number> = { a: 1, an: 1, one: 1, two: 2, three: 3, four: 4 };

interface Parsed { normalised: string; tags: Tags; cqc: Domain[]; risk: boolean; riskReasons: string[]; dialect: string[] }

function normalise(raw: string): { text: string; dialect: string[] } {
  let text = raw.trim();
  const dialect = new Set<string>();
  for (const [re, rep, label] of VERNACULAR) {
    re.lastIndex = 0;
    if (re.test(text)) dialect.add(label);
    re.lastIndex = 0;
    text = text.replace(re, rep);
  }
  const unitRe = /\b(\d{2,4})\s*(millilitres?|mls|mils|mil|mills)\b/gi;
  if (unitRe.test(text)) dialect.add('Units normalised');
  text = text.replace(/\b(\d{2,4})\s*(?:millilitres?|mls|mils|mil|mills|ml)\b/gi, '$1 ml');
  text = text.replace(/\b(\d{1,3})\s*(?:percent|per cent)\b/gi, '$1%');
  return { text, dialect: Array.from(dialect) };
}

function parseNote(raw: string): Parsed {
  const { text, dialect } = normalise(raw);
  const lower = text.toLowerCase();
  const sentences = lower.split(/(?<=[.!?])\s+|\n+/).filter(Boolean);
  const tags: Tags = {};

  let fluid = 0; let estimated = false;
  for (const s of sentences) {
    if (/\b(refused|declined|didn't drink|did not drink|wouldn't drink)\b/.test(s)) continue;
    let local = 0;
    const mlRe = /(\d{2,4}) ml\b/g; let m: RegExpExecArray | null;
    while ((m = mlRe.exec(s))) local += parseInt(m[1], 10);
    if (local === 0) {
      const containers: Array<[RegExp, number]> = [
        [/\b(?:(a|an|one|two|three|four|\d)\s+)?(?:cups?|mugs?) of (?:tea|coffee|hot chocolate|milk|water)\b/g, 200],
        [/\b(?:(a|an|one|two|three|four|\d)\s+)?glass(?:es)? of \w+/g, 250],
        [/\b(?:(a|an|one|two|three|four|\d)\s+)?beakers? of \w+/g, 180],
      ];
      for (const [re, vol] of containers) {
        let c: RegExpExecArray | null;
        while ((c = re.exec(s))) {
          const q = c[1] ? (NUMBER_WORDS[c[1]] ?? (parseInt(c[1], 10) || 1)) : 1;
          local += q * vol; estimated = true;
        }
      }
    }
    fluid += local;
  }
  if (fluid > 0) { tags.fluidMl = fluid; tags.fluidEstimated = estimated; }

  const mealVals: number[] = [];
  for (const s of sentences) {
    if (!/\b(ate|eat|eaten|eating|breakfast|lunch|dinner|supper|meal|plate|soup|pudding|sandwich|toast|cereal|pasta|pie|casserole|porridge|food)\b/.test(s)) continue;
    const pct = s.match(/(\d{1,3})%/);
    if (pct) { mealVals.push(clamp(parseInt(pct[1], 10), 0, 100)); continue; }
    let w = s;
    const take = (re: RegExp, v: number) => { const hits = w.match(re); if (hits) { hits.forEach(() => mealVals.push(v)); w = w.replace(re, ' '); } };
    take(/\bthree quarters\b/g, 75);
    take(/\b(all|everything|full plate|cleared|fully|the lot)\b/g, 100);
    take(/\bhalf\b/g, 50);
    take(/\b(a quarter|few mouthfuls|few spoons|picked at)\b/g, 25);
    take(/\b(nothing|refused|declined|didn't eat|did not eat)\b/g, 0);
  }
  if (mealVals.length) {
    tags.mealPct = Math.round(mealVals.reduce((a, b) => a + b, 0) / mealVals.length);
    const label = lower.match(/\b(breakfast|lunch|dinner|supper|snack)\b/);
    if (label) tags.mealLabel = label[1][0].toUpperCase() + label[1].slice(1);
  }

  const moodHits: Array<{ i: number; label: string }> = [];
  for (const [re, label] of MOODS) { re.lastIndex = 0; let m: RegExpExecArray | null; while ((m = re.exec(lower))) moodHits.push({ i: m.index, label }); }
  moodHits.sort((a, b) => a.i - b.i);
  if (moodHits.length) {
    const f = moodHits[0].label; const l = moodHits[moodHits.length - 1].label;
    tags.mood = f === l ? f : `${f} → ${l}`;
  }
  const care = CARE_RE.filter(([re]) => re.test(lower)).map(([, l]) => l);
  if (care.length) tags.personalCare = care;
  const beh = BEHAVIOUR_RE.filter(([re]) => re.test(lower)).map(([, l]) => l);
  if (beh.length) tags.behaviour = beh;
  const act = ACTIVITY_RE.filter(([re]) => re.test(lower)).map(([, l]) => l);
  if (act.length) tags.activity = act;
  const pain = lower.match(/(\d{1,2})\s*(?:\/|out of)\s*10/);
  if (pain) tags.pain = clamp(parseInt(pain[1], 10), 0, 10);
  if (/\b(\d+(\.\d+)?\s?mg|tablets?|medication|medicines?|emar|prn|paracetamol|lorazepam|adcal|donepezil|sertraline|furosemide|apixaban)\b/.test(lower)) tags.med = true;
  if (/\b(chose|choice|preferred|asked for|her own|his own|himself|herself|dignity|privacy)\b/.test(lower)) tags.choice = true;

  const scrubbed = lower.replace(/\bno (redness|red marks?|bruising|marks)\b/g, '');
  const riskReasons = RISK_RE.filter(([re]) => re.test(scrubbed)).map(([, l]) => l);

  const cqc = new Set<Domain>();
  if (tags.med || beh.length || riskReasons.length) cqc.add('Safe');
  if (tags.fluidMl || tags.mealPct !== undefined || act.includes('Health professional') || tags.pain !== undefined || care.includes('Skin care') || care.includes('Continence')) cqc.add('Effective');
  if (tags.mood || care.length || tags.choice || act.includes('Family')) cqc.add('Caring');
  if (act.length || tags.choice) cqc.add('Responsive');
  if (!cqc.size) cqc.add('Caring');

  return { normalised: text, tags, cqc: DOMAINS.filter((d) => cqc.has(d)), risk: riskReasons.length > 0, riskReasons, dialect };
}

const TRIGGER_LIB: Array<[RegExp, string]> = [
  [/\b(alarm|loud|noise|beeping|hand dryer|drill|bang)\b/, 'Unexpected loud noise'],
  [/\b(late|wait\w*|queue|delay\w*)\b/, 'Waiting or delay'],
  [/\b(change\w*|cancel\w*|could not visit|instead of|unfamiliar|agency|new staff)\b/, 'Change to routine or staff'],
  [/\b(crowd\w*|busy|co-op|shop|town|bus)\b/, 'Busy environment'],
  [/\b(told (?:him|her) no|denied|demand\w*|asked to stop)\b/, 'Demand or denied request'],
  [/\b(hungry|tired|pain|toilet|unwell)\b/, 'Physical need'],
  [/\b(bright|smell|touch|label|itch\w*)\b/, 'Sensory discomfort'],
];
const CONSEQ_RE = /\b(calm\w*|settled|redirected|offered|used (?:his|her)|ear defenders|quiet room|weighted|bench|reassured|paused|we went|stayed calm)\b/;
const BEHAV_RE = /\b(hit|kick\w*|bit|scream\w*|shout\w*|threw|banged|pushed|grab\w*|ran|pacing|rocking|tearful|covered (?:his|her) ears|hands on (?:his|her) ears|pulling)\b/;

function parseABC(raw: string) {
  const { text } = normalise(raw);
  const sentences = text.split(/(?<=[.!?])\s+/).filter(Boolean);
  const lowers = sentences.map((s) => s.toLowerCase());
  let bIdx = lowers.findIndex((s) => BEHAV_RE.test(s));
  let A: string[]; let B: string[]; let C: string[];
  if (bIdx === -1) {
    const third = Math.max(1, Math.round(sentences.length / 3));
    A = sentences.slice(0, third); B = sentences.slice(third, third * 2); C = sentences.slice(third * 2);
  } else {
    if (bIdx === 0 && sentences.length > 1) {
      const clause = sentences[0].split(/,\s*(?=and |then |but )|\.\s*/);
      if (clause.length > 1 && !BEHAV_RE.test(clause[0].toLowerCase())) { sentences.splice(0, 1, `${clause[0]}.`, clause.slice(1).join(', ')); lowers.splice(0, 1, clause[0].toLowerCase(), clause.slice(1).join(', ').toLowerCase()); bIdx = 1; }
    }
    let cIdx = lowers.findIndex((s, i) => i > bIdx && CONSEQ_RE.test(s));
    if (cIdx === -1) cIdx = sentences.length;
    A = sentences.slice(0, bIdx); B = sentences.slice(bIdx, cIdx); C = sentences.slice(cIdx);
  }
  const lowerAll = text.toLowerCase();
  const triggers = TRIGGER_LIB.filter(([re]) => re.test(A.join(' ').toLowerCase() || lowerAll)).map(([, l]) => l);
  const severe = /\b(banged (?:his|her) head|injur\w*|bit|punch\w*|hospital)\b/.test(lowerAll);
  const moderate = /\b(hit|kick\w*|pushed|threw|ran|grab\w*|pulling|scream\w*)\b/.test(lowerAll);
  return {
    antecedent: A.join(' ') || '', behaviour: B.join(' ') || '', consequence: C.join(' ') || '',
    triggers, severity: (severe ? 'High' : moderate ? 'Moderate' : 'Low') as Incident['severity'],
  };
}

interface EvidenceRef { code: string; title: string; domain: Domain; test: (l: LogEntry) => boolean; stateTest?: (s: State) => boolean; source?: string }
const hasAct = (l: LogEntry, a: string) => !!l.tags.activity?.includes(a);
const isObs = (l: LogEntry) => l.source === 'obs';
const FRAMEWORKS: Record<FrameworkId, { label: string; short: string; status: string; refs: EvidenceRef[] }> = {
  saf2023: {
    label: 'Single Assessment Framework (2023)', short: 'SAF quality statements', status: 'Current until CQC switches over',
    refs: [
      { code: '', title: 'Learning culture', domain: 'Safe', test: (l) => !!l.incidentId && l.revisions.length > 0 },
      { code: '', title: 'Safeguarding', domain: 'Safe', test: (l) => !!l.tags.behaviour?.length || !!l.incidentId },
      { code: '', title: 'Involving people to manage risks', domain: 'Safe', test: (l) => l.risk || isObs(l) },
      { code: '', title: 'Safe environments', domain: 'Safe', test: (l) => !!l.tags.behaviour?.includes('Fall') },
      { code: '', title: 'Safe and effective staffing', domain: 'Safe', test: () => false, stateTest: () => true, source: 'Training matrix' },
      { code: '', title: 'Medicines optimisation', domain: 'Safe', test: (l) => !!l.tags.med },
      { code: '', title: 'Assessing needs', domain: 'Effective', test: (l) => isObs(l) || l.tags.pain !== undefined },
      { code: '', title: 'Monitoring and improving outcomes', domain: 'Effective', test: (l) => !!l.tags.fluidMl || l.tags.mealPct !== undefined || isObs(l) },
      { code: '', title: 'How staff, teams and services work together', domain: 'Effective', test: (l) => hasAct(l, 'Health professional') },
      { code: '', title: 'Supporting people to live healthier lives', domain: 'Effective', test: (l) => hasAct(l, 'Outdoors') },
      { code: '', title: 'Consent to care and treatment', domain: 'Effective', test: (l) => !!l.tags.choice },
      { code: '', title: 'Kindness, compassion and dignity', domain: 'Caring', test: (l) => !!l.tags.mood || !!l.tags.personalCare?.length },
      { code: '', title: 'Treating people as individuals', domain: 'Caring', test: (l) => !!l.tags.choice },
      { code: '', title: 'Independence, choice and control', domain: 'Caring', test: (l) => !!l.tags.choice || hasAct(l, 'Community') },
      { code: '', title: "Responding to people's immediate needs", domain: 'Caring', test: (l) => l.risk && l.status !== 'pending' },
      { code: '', title: 'Person-centred care', domain: 'Responsive', test: (l) => !!l.tags.activity?.some((a) => a !== 'Health professional') },
      { code: '', title: 'Listening to and involving people', domain: 'Responsive', test: (l) => hasAct(l, 'Family'), stateTest: (s) => s.familyMessages.length > 0, source: 'Family portal' },
      { code: '', title: 'Care provision, integration and continuity', domain: 'Responsive', test: (l) => hasAct(l, 'Health professional') },
      { code: '', title: 'Planning for the future', domain: 'Responsive', test: () => false, stateTest: () => true, source: 'ReSPECT records' },
      { code: '', title: 'Governance, management and sustainability', domain: 'Well-led', test: (l) => l.thread.length > 0 || !!l.signature },
      { code: '', title: 'Learning, improvement and innovation', domain: 'Well-led', test: (l) => l.revisions.length > 0 },
      { code: '', title: 'Freedom to speak up', domain: 'Well-led', test: () => false },
      { code: '', title: 'Partnerships and communities', domain: 'Well-led', test: (l) => hasAct(l, 'Health professional') },
    ],
  },
  cqc2026: {
    label: 'CQC 2026 framework (draft KLOE themes)', short: 'Draft KLOE themes', status: 'Draft. Wording updates when CQC publishes the final framework',
    refs: [
      { code: 'S1', title: 'Safeguarding and protection from abuse', domain: 'Safe', test: (l) => !!l.tags.behaviour?.length || !!l.incidentId },
      { code: 'S2', title: 'Assessing and managing risk', domain: 'Safe', test: (l) => l.risk || isObs(l) },
      { code: 'S3', title: 'Safe staffing and recruitment', domain: 'Safe', test: () => false, stateTest: () => true, source: 'Training matrix' },
      { code: 'S4', title: 'Safe management of medicines', domain: 'Safe', test: (l) => !!l.tags.med },
      { code: 'S5', title: 'Infection prevention and control', domain: 'Safe', test: () => false },
      { code: 'S6', title: 'Learning when things go wrong', domain: 'Safe', test: (l) => !!l.incidentId || l.revisions.length > 0 },
      { code: 'E1', title: 'Assessing needs and delivering care', domain: 'Effective', test: (l) => !!l.tags.personalCare?.length || isObs(l) },
      { code: 'E2', title: 'Staff skills, training and support', domain: 'Effective', test: () => false, stateTest: () => true, source: 'Training matrix' },
      { code: 'E3', title: 'Eating, drinking and nutrition', domain: 'Effective', test: (l) => !!l.tags.fluidMl || l.tags.mealPct !== undefined },
      { code: 'E4', title: 'Working with other services and health access', domain: 'Effective', test: (l) => hasAct(l, 'Health professional') },
      { code: 'E5', title: 'Consent and mental capacity', domain: 'Effective', test: (l) => !!l.tags.choice, stateTest: () => true, source: 'MCA records' },
      { code: 'E6', title: 'Monitoring and improving outcomes', domain: 'Effective', test: (l) => l.tags.pain !== undefined || isObs(l) || !!l.tags.fluidMl },
      { code: 'C1', title: 'Kindness, respect and compassion', domain: 'Caring', test: (l) => !!l.tags.mood },
      { code: 'C2', title: 'Involvement in decisions about care', domain: 'Caring', test: (l) => !!l.tags.choice || hasAct(l, 'Family') },
      { code: 'C3', title: 'Privacy, dignity and independence', domain: 'Caring', test: (l) => !!l.tags.personalCare?.length || hasAct(l, 'Community') },
      { code: 'R1', title: 'Person-centred care planning', domain: 'Responsive', test: (l) => !!l.tags.activity?.some((a) => a !== 'Health professional') },
      { code: 'R2', title: 'Communication and accessible information', domain: 'Responsive', test: () => false },
      { code: 'R3', title: 'Listening to concerns and complaints', domain: 'Responsive', test: () => false, stateTest: (s) => s.familyMessages.length > 0, source: 'Family portal' },
      { code: 'R4', title: 'End of life and future planning', domain: 'Responsive', test: () => false, stateTest: () => true, source: 'ReSPECT records' },
      { code: 'W1', title: 'Vision, culture and leadership', domain: 'Well-led', test: () => false },
      { code: 'W2', title: 'Governance and oversight', domain: 'Well-led', test: (l) => l.thread.length > 0 || !!l.signature },
      { code: 'W3', title: 'Engaging people, families and staff', domain: 'Well-led', test: (l) => l.thread.some((m) => m.from === 'worker'), stateTest: (s) => s.familyMessages.length > 0, source: 'Family portal' },
      { code: 'W4', title: 'Learning, improvement and innovation', domain: 'Well-led', test: (l) => l.revisions.length > 0 },
      { code: 'W5', title: 'Partnership working', domain: 'Well-led', test: (l) => hasAct(l, 'Health professional') },
    ],
  },
};
const evidenceRefs = (l: LogEntry, fw: FrameworkId) => FRAMEWORKS[fw].refs.filter((r) => r.test(l));
const refLabel = (r: EvidenceRef) => (r.code ? `${r.code} ${r.title}` : r.title);
function frameworkCoverage(s: State, fw: FrameworkId) {
  const logs = s.logs.filter((l) => l.synced);
  return FRAMEWORKS[fw].refs.map((r) => {
    const items = logs.filter((l) => r.test(l));
    const fromState = !!r.stateTest?.(s);
    return { ref: r, items: items.length, covered: items.length > 0 || fromState, via: items.length ? 'Care records' : fromState ? r.source ?? 'Records' : '' };
  });
}

interface StatutoryRule { action: string; level: 'Required' | 'Consider'; why: string }
function statutoryActions(i: Incident, s: State): StatutoryRule[] {
  const text = `${i.behaviour} ${i.consequence}`.toLowerCase();
  const injury = /injur|banged|bleed|fractur|head/.test(text);
  const out: StatutoryRule[] = [
    { action: 'Family or advocate informed', level: 'Required', why: 'Care plan and person-centred practice' },
    { action: 'PBS plan review', level: i.severity === 'Low' ? 'Consider' : 'Required', why: 'Update triggers and proactive strategies' },
  ];
  if (injury || i.severity === 'High' || i.restrictive) out.push({ action: 'Safeguarding referral to the local authority', level: i.severity === 'High' || i.restrictive ? 'Required' : 'Consider', why: injury ? 'Injury or self-injury recorded' : 'High severity or restrictive practice' });
  if (injury || i.severity === 'High') out.push({ action: 'CQC statutory notification', level: i.severity === 'High' ? 'Required' : 'Consider', why: 'Serious injury or abuse must be notified without delay (Registration Regulations 2009, Reg 18)' });
  if (i.severity === 'High') out.push({ action: 'Duty of Candour assessment', level: 'Required', why: 'Moderate or greater harm is a notifiable safety incident (Regulation 20)' });
  if (s.meds.some((m) => m.residentId === i.residentId && m.stomp && m.prn?.doses.some((d) => Math.abs(d.t - i.time) < 3 * HOUR))) out.push({ action: 'Prescriber informed of PRN psychotropic use', level: 'Required', why: 'STOMP: every psychotropic PRN use is reviewed' });
  return out;
}
function statutoryDraft(action: string, i: Incident): string {
  const r = residentById(i.residentId);
  const when = `${fmtDate(i.time)} at ${fmt(i.time)}`;
  const head = `${PROVIDER.name}, ${PROVIDER.town} · CQC location ${PROVIDER.locationId}\nPerson: ${r.name}, ${r.age} · Incident ${i.id} · ${when}\n`;
  const abc = `What happened before: ${i.antecedent}\nWhat happened: ${i.behaviour}\nWhat we did: ${i.consequence}`;
  if (action.startsWith('Safeguarding')) return `${head}\nSafeguarding concern for the Gloucestershire adult social care team\n\n${abc}\n\nImmediate safety: ${r.first} is safe and supported by staff he knows. Body check completed.\nPerson's views: to be gathered with visual supports today.\nReferrer: Sarah Okafor, Registered Manager.`;
  if (action.startsWith('CQC')) return `${head}\nNotification of other incidents (Regulation 18)\nCategory: serious injury, or event that stops the service running safely\n\n${abc}\n\nActions taken: incident reviewed, PBS plan review scheduled, family informed.\nSubmit through the CQC provider portal.`;
  if (action.startsWith('Duty')) return `${head}\nDuty of Candour record\n1. Notifiable safety incident confirmed by Sarah Okafor.\n2. Apology and explanation given to ${r.first} and family in person.\n3. Written follow-up to be sent within 10 working days.`;
  if (action.startsWith('Prescriber')) return `${head}\nTo: GP / prescriber\nPRN psychotropic given: ${i.time ? 'Lorazepam 0.5 mg' : ''} after PBS steps 1 to 3 were tried.\nRequest: STOMP review of PRN use and the PBS plan.`;
  if (action.startsWith('PBS')) return `${head}\nPBS plan review request\nTriggers identified: ${i.triggers.join(', ') || 'none'}\nProposed change: add a visual warning before fire alarm tests to the weekly schedule.`;
  return `${head}\n${action}: record who was informed, when and their response.`;
}

const NEWS2_SOFT_SIGNS = ['New or increased confusion', 'Reduced mobility or a new fall', 'Not eating or drinking as usual', 'Passing less urine', 'Changes in breathing', 'Skin colour change or mottling', 'Staff or family feel something is not right'];
interface Obs { rr: number; spo2: number; o2: boolean; sbp: number; dbp: number; pulse: number; acvpu: 'A' | 'C' | 'V' | 'P' | 'U'; temp: number }
function news2(o: Obs) {
  const parts = {
    rr: o.rr <= 8 ? 3 : o.rr <= 11 ? 1 : o.rr <= 20 ? 0 : o.rr <= 24 ? 2 : 3,
    spo2: o.spo2 <= 91 ? 3 : o.spo2 <= 93 ? 2 : o.spo2 <= 95 ? 1 : 0,
    o2: o.o2 ? 2 : 0,
    sbp: o.sbp <= 90 ? 3 : o.sbp <= 100 ? 2 : o.sbp <= 110 ? 1 : o.sbp <= 219 ? 0 : 3,
    pulse: o.pulse <= 40 ? 3 : o.pulse <= 50 ? 1 : o.pulse <= 90 ? 0 : o.pulse <= 110 ? 1 : o.pulse <= 130 ? 2 : 3,
    acvpu: o.acvpu === 'A' ? 0 : 3,
    temp: o.temp <= 35 ? 3 : o.temp <= 36 ? 1 : o.temp <= 38 ? 0 : o.temp <= 39 ? 1 : 2,
  };
  const total = Object.values(parts).reduce((a, b) => a + b, 0);
  const single3 = Object.values(parts).some((v) => v === 3);
  const band = total >= 7 ? 'High' : total >= 5 ? 'Medium' : single3 ? 'Low-medium' : total >= 1 ? 'Low' : 'None';
  const action = total >= 7 ? 'Emergency response. Call 999 now and stay with the person.'
    : total >= 5 ? 'Urgent clinical review. Contact the GP, NHS 111 or community team now. Repeat observations hourly.'
      : single3 ? 'One parameter scores 3. Urgent review by the senior and call the GP or NHS 111 for advice.'
        : total >= 1 ? 'Inform the senior on duty. Repeat observations within 4 hours or as advised.' : 'Routine monitoring as set out in the care plan.';
  return { parts, total, single3, band, action };
}
const OBS_DEFAULTS: Record<string, Obs> = {
  arthur: { rr: 16, spo2: 96, o2: false, sbp: 138, dbp: 82, pulse: 76, acvpu: 'A', temp: 36.8 },
  leo: { rr: 14, spo2: 98, o2: false, sbp: 124, dbp: 78, pulse: 72, acvpu: 'A', temp: 36.6 },
  margaret: { rr: 20, spo2: 94, o2: false, sbp: 112, dbp: 70, pulse: 92, acvpu: 'A', temp: 37.6 },
};

function riskDue(r: Resident, risk: RiskAssessment, s: State, now: number) {
  const reviewed = Math.max(dateMs(risk.lastReviewed), s.riskReviews[`${r.id}:${risk.id}`] ?? 0);
  const due = reviewed + risk.reviewDays * 24 * HOUR;
  const status: { tone: Tone; label: string } = due < TODAY_MS ? { tone: 'red', label: 'Review overdue' } : due - now < 7 * 24 * HOUR ? { tone: 'amber', label: 'Review due soon' } : { tone: 'emerald', label: 'In date' };
  return { reviewed, due, ...status };
}
const overdueRisks = (s: State, r: Resident, now: number) => r.risks.filter((k) => riskDue(r, k, s, now).tone === 'red');

/* ============================== Voice simulation scripts ============================== */

interface Script { text: string; accent: string; confidence: number }
const NOTE_SCRIPTS: Record<string, Script[]> = {
  arthur: [
    { text: 'Arthur woke from his nap around 3, a bit confused and asking for Joan. I sat with him and we looked at the photo album, he settle well and was smiling. He take small small tea, about 150 mls, and two biscuits.', accent: 'West African English', confidence: 96 },
    { text: 'Supported Arthur to the toilet with his frame, continent, no issues. Repositioned in his chair and checked his heels, skin intact, no redness. Gave him a cuppa, he drank the lot.', accent: 'Yorkshire English', confidence: 98 },
    { text: 'Arthur ate his tea, fish pie, about 75 percent of plate he finished. He is having tension about his son visit on Saturday, I reassured him and now he is calm.', accent: 'South Asian English', confidence: 95 },
  ],
  leo: [
    { text: 'Leo had a good session in the sensory room with his music on, he was laughing. Drank a glass of blackcurrant squash. Wore his ear defenders on the walk to the shop and paid for his magazine himself with prompting.', accent: 'Polish-accented English', confidence: 95 },
    { text: 'Leo was vexed small when the bus was late for college, pacing and rocking. I use the countdown card from his plan and offered his ear defenders, he settle after ten minutes. He drink 200 mls water.', accent: 'West African English', confidence: 94 },
    { text: 'Leo chose his own tea tonight and made pasta with me, ate about half. Chuffed with himself. Had a brew after, 200 mil.', accent: 'Northern English', confidence: 97 },
  ],
  margaret: [
    { text: 'Margaret said her left hip pain is 6 out of 10 this afternoon. Repositioned with the slide sheet and applied barrier cream to her sacrum, small red mark noted, skin not broken. Drank 180 ml of tea.', accent: 'Scottish English', confidence: 97 },
    { text: 'Margaret had a shower with two staff using the shower chair, oral care done, she chose her blue cardigan. In good spirits, chatting about her granddaughter. Glass of water, 250 mls.', accent: 'West African English', confidence: 96 },
    { text: 'Margaret ate half of her soup and all of her pudding. She was little tired after physio. Kindly note she drank 1 beaker of juice.', accent: 'South Asian English', confidence: 95 },
  ],
};
const ABC_SCRIPTS: Record<string, string> = {
  leo: 'We were in the Co-op in town and the queue was long and the card machine was beeping loud. Leo put his hands on his ears and started shouting, then he pushed the basket off the counter and ran towards the door. I stayed calm, used his countdown card and gave him his ear defenders, and we went outside to the bench. He settled after about eight minutes and we finished the shopping later with no further issues.',
  arthur: 'Arthur was told his son could not visit today because of car trouble. He became tearful, then shouted at staff and tried the handle of the fire exit, pulling hard. I redirected him to his photo album and offered a cup of tea, he calmed down within fifteen minutes.',
  margaret: 'An agency carer came to support Margaret with her shower instead of her usual carer. Margaret pushed the carer away and shouted that she wanted Grace. We paused, Grace came to assist, Margaret was reassured and accepted the shower calmly.',
};
const CLARIFY_PRESETS = [
  'Please give the exact time and reason for the refusal, and confirm whether the GP or pharmacist was informed.',
  'What specifically triggered the agitation? Describe what you saw and the de-escalation you used.',
  'Please confirm the exact fluid volume in ml and whether thickener was used.',
  'Was a body map completed for this mark? Please confirm size and location.',
  'Who witnessed this, and were family or the advocate informed?',
];
const REJECT_CODES = [
  { code: 'R1 · Insufficient detail', route: 'Returned to author with supervision note' },
  { code: 'R2 · Contradicts other records', route: 'Senior review within 24 hours' },
  { code: 'S1 · Safeguarding concern', route: 'Escalated to Designated Safeguarding Lead' },
  { code: 'M1 · Medication error suspected', route: 'Escalated to clinical lead and pharmacist' },
  { code: 'D1 · Wrong service user', route: 'Record quarantined, data protection officer notified' },
];

function suggestReply(l: LogEntry): string {
  const r = residentById(l.residentId);
  const t = l.text.toLowerCase();
  if (/refus|declin/.test(t)) return `${r.first} declined the dose at ${fmt(l.time)} and said it tastes chalky. I re-offered at ${fmt(l.time + 16 * MIN)} with yoghurt and he still declined. I rang Boots pharmacy at ${fmt(l.time + 31 * MIN)}; the pharmacist advised it is safe to omit this dose and re-offer at tea. Recorded on the MAR as code R.`;
  if (/agitat|pacing|shout/.test(t)) return `${r.first} became agitated at about ${fmt(l.time - 5 * MIN)} when the dining room got noisy and lunch was late. He was pacing and covering his ears. I used his countdown card and moved him to the quiet room with ear defenders. He settled after 10 minutes, no injuries.`;
  if (/ml|drank|fluid/.test(t)) return 'Volume was 200 ml, measured with the marked beaker. No thickener needed under the current SALT plan.';
  if (/mark|skin|bruis/.test(t)) return `Body map completed at ${fmt(l.time + 20 * MIN)}. Red mark 2 cm on the left sacrum, blanching, skin not broken. Barrier cream applied and the district nurse informed.`;
  return `Witnessed by Amina Kamara. ${r.first}'s family were informed by phone at ${fmt(l.time + 25 * MIN)} and are happy with the plan.`;
}

const COLLEAGUE_FEED: Array<{ actor: Actor; residentId: string; text: string; accent: string }> = [
  { actor: TOMASZ, residentId: 'margaret', text: 'Margaret asked for new hearing aid batteries, I changed both. She is happy now and can hear the radio.', accent: 'Polish-accented English' },
  { actor: AMINA, residentId: 'arthur', text: 'Arthur drink 200 mls orange squash, he was chatting about his Navy days, very calm.', accent: 'West African English' },
  { actor: TOMASZ, residentId: 'leo', text: 'Leo went to the garden with me and kicked the football for twenty minutes, laughing. Drank 300 ml water after.', accent: 'Polish-accented English' },
  { actor: AMINA, residentId: 'margaret', text: 'Assisted Margaret to the commode with two staff and the stand aid, continent, skin intact on sacrum.', accent: 'West African English' },
  { actor: TOMASZ, residentId: 'arthur', text: 'Arthur was pacing in the corridor looking for the exit. I redirected him to the kitchen to fold tea towels and he settled.', accent: 'Polish-accented English' },
  { actor: AMINA, residentId: 'leo', text: 'Leo watched his Thomas videos in his room with the door open, which he likes. Calm and smiling.', accent: 'West African English' },
];

/* ============================== Domain logic ============================== */

function makeLog(p: {
  id?: string; residentId: string; time: number; text: string; source: Source; author?: Actor; status?: LogStatus;
  attachments?: Attachment[]; thread?: ThreadMsg[]; signature?: Signature; accent?: string; confidence?: number;
  durationSec?: number; incidentId?: string; synced?: boolean; extraTags?: Tags;
}): LogEntry {
  const parsed = parseNote(p.text);
  const author = p.author ?? WORKER;
  const tags: Tags = { ...parsed.tags, ...p.extraTags };
  return {
    id: p.id ?? uid('LOG'), residentId: p.residentId, time: p.time, author: author.name, authorRole: author.role, source: p.source,
    original: p.text, text: parsed.normalised, tags, cqc: p.signature || p.thread?.length ? DOMAINS.filter((d) => d === 'Well-led' || parsed.cqc.includes(d)) : parsed.cqc, risk: parsed.risk, riskReasons: parsed.riskReasons, dialect: parsed.dialect,
    status: p.status ?? 'pending', flagged: false, attachments: p.attachments ?? [], thread: p.thread ?? [], revisions: [],
    signature: p.signature, synced: p.synced ?? true, durationSec: p.durationSec, accent: p.accent, confidence: p.confidence, incidentId: p.incidentId,
  };
}

function sign(entityId: string, content: string, by: Actor, atTime: number): Signature {
  return { by: by.name, role: by.role, at: atTime, hash: chainHash(`${entityId}|${content}|${by.name}|${atTime}`) };
}

function addAudit(s: State, actor: Actor, time: number, action: string, entity: string, detail: string, force = false): State {
  if (!force && actor.kind === 'worker' && !s.online) return { ...s, queue: [...s.queue, { actor, time, action, entity, detail }] };
  const prev = s.audit[s.audit.length - 1];
  const prevHash = prev ? prev.hash : '0000000000000000';
  const seq = (prev?.seq ?? 0) + 1;
  const hash = chainHash(`${seq}|${time}|${actor.name}|${action}|${entity}|${detail}|${prevHash}`);
  return { ...s, audit: [...s.audit, { seq, id: `EVT-${pad(Math.floor(seq / 100))}${pad(seq % 100)}`, time, actor: actor.name, role: actor.role, action, entity, detail, prevHash, hash }] };
}

function verifyChain(events: AuditEvent[]): { ok: boolean; brokenAt: number | null } {
  let prevHash = '0000000000000000';
  for (const e of events) {
    const h = chainHash(`${e.seq}|${e.time}|${e.actor}|${e.action}|${e.entity}|${e.detail}|${prevHash}`);
    if (e.prevHash !== prevHash || h !== e.hash) return { ok: false, brokenAt: e.seq };
    prevHash = e.hash;
  }
  return { ok: true, brokenAt: null };
}

interface PrnStatus { lockedUntil: number | null; reason: string | null; lastDose: number | null; doses24: number; maxUnits: number; paraUsed: number | null; paraLimit: number | null; crossNote: string | null }
const paracetamolLimitMg = (r: Resident) => (r.weightKg < 50 ? 60 * r.weightKg : 4000);

function prnStatus(m: Med, now: number, meds: Med[], unitsWanted?: number): PrnStatus {
  const p = m.prn as Prn;
  const r = residentById(m.residentId);
  const own = p.doses.map((d) => d.t);
  const lastDose = own.length ? Math.max(...own) : null;
  const doses24 = p.doses.filter((d) => now - d.t < 24 * HOUR).length;
  let lockedUntil: number | null = null;
  let reason: string | null = null;
  let crossNote: string | null = null;
  let maxUnits = p.unitsMax;
  if (lastDose !== null && now - lastDose < p.minIntervalH * HOUR) {
    lockedUntil = lastDose + p.minIntervalH * HOUR;
    reason = `Prescriber-set minimum interval of ${p.minIntervalH} hours not met. Last dose ${fmt(lastDose)}, next eligible ${fmt(lockedUntil)}.`;
  }
  let paraUsed: number | null = null;
  let paraLimit: number | null = null;
  if (p.paracetamolMg) {
    const paraDoses = meds.filter((x) => x.residentId === m.residentId && x.prn?.paracetamolMg)
      .flatMap((x) => (x.prn as Prn).doses.map((d) => ({ t: d.t, mg: d.units * ((x.prn as Prn).paracetamolMg as number), id: x.id, name: x.name })));
    paraUsed = paraDoses.filter((d) => now - d.t < 24 * HOUR).reduce((a, d) => a + d.mg, 0);
    paraLimit = paracetamolLimitMg(r);
    const lastPara = paraDoses.reduce<{ t: number; id: string; name: string } | null>((acc, d) => (!acc || d.t > acc.t ? { t: d.t, id: d.id, name: d.name } : acc), null);
    if (lastPara && lastPara.id !== m.id) {
      crossNote = `Cross-product check: ${lastPara.name.replace(' tablets', '')} given at ${fmt(lastPara.t)}.`;
      if (now - lastPara.t < 4 * HOUR && (!lockedUntil || lastPara.t + 4 * HOUR > lockedUntil)) {
        lockedUntil = lastPara.t + 4 * HOUR;
        reason = `Contains paracetamol. ${lastPara.name.replace(' tablets', '')} was given at ${fmt(lastPara.t)}, so no paracetamol-containing product until ${fmt(lockedUntil)}.`;
      }
    }
    maxUnits = Math.min(maxUnits, Math.floor((paraLimit - paraUsed) / p.paracetamolMg));
    if (!reason && maxUnits < p.unitsMin) reason = `Daily paracetamol limit reached: ${thousands(paraUsed)} of ${thousands(paraLimit)} mg in 24 hours${r.weightKg < 50 ? ` (weight-based limit for ${r.weightKg} kg)` : ''}.`;
  }
  if (!reason && doses24 >= p.maxDoses24h) reason = `Maximum of ${p.maxDoses24h} doses (${p.maxLabel}) in 24 hours reached.`;
  if (!reason && unitsWanted && unitsWanted > maxUnits) reason = `Only ${maxUnits} ${p.unitLabel}${maxUnits === 1 ? '' : 's'} allowed now. ${unitsWanted} would exceed the ${thousands(paraLimit ?? 0)} mg daily paracetamol limit.`;
  return { lockedUntil, reason, lastDose, doses24, maxUnits: Math.max(0, maxUnits), paraUsed, paraLimit, crossNote };
}
const prnBlockReason = (m: Med, now: number, meds: Med[], units?: number) => prnStatus(m, now, meds, units).reason;

type MedState = 'given' | 'refused' | 'scheduled' | 'due' | 'overdue' | 'prn';
function medState(m: Med, now: number): MedState {
  if (m.prn) return 'prn';
  if (m.status === 'given') return 'given';
  if (m.status === 'refused') return 'refused';
  const t = ROUND_TIME[m.round];
  if (now < t - HOUR) return 'scheduled';
  if (now <= t + HOUR) return 'due';
  return 'overdue';
}

function emarStats(meds: Med[], now: number) {
  const due = meds.filter((m) => !m.prn && ROUND_TIME[m.round] - HOUR <= now);
  const given = due.filter((m) => m.status === 'given').length;
  const refused = due.filter((m) => m.status === 'refused').length;
  const overdue = due.filter((m) => medState(m, now) === 'overdue').length;
  const open = due.length - given - refused;
  const denom = given + refused + overdue;
  return { due: due.length, given, refused, overdue, open, dueNow: open - overdue, rate: denom ? ((given + refused) / denom) * 100 : 100 };
}

function fluidTotal(logs: LogEntry[], rid: string) {
  return logs.filter((l) => l.residentId === rid).reduce((a, l) => a + (l.tags.fluidMl ?? 0), 0);
}
function mealAverage(logs: LogEntry[], rid: string): number | null {
  const v = logs.filter((l) => l.residentId === rid && l.tags.mealPct !== undefined).map((l) => l.tags.mealPct as number);
  return v.length ? Math.round(v.reduce((a, b) => a + b, 0) / v.length) : null;
}

function fluidStatus(r: Resident, total: number, now: number): { tone: Tone; label: string } {
  const elapsed = clamp((now - SHIFT_START) / (12 * HOUR), 0.05, 1);
  if (r.fluidKind === 'restriction') {
    const pct = total / r.fluidLimit;
    if (pct >= 1) return { tone: 'red', label: 'Restriction exceeded' };
    if (pct >= 0.85) return { tone: 'amber', label: 'Near restriction limit' };
    return { tone: 'emerald', label: 'Within restriction' };
  }
  const pace = total / (r.fluidLimit * elapsed);
  if (pace < 0.6) return { tone: 'amber', label: 'Behind pace, encourage fluids' };
  return { tone: 'emerald', label: 'On pace' };
}

function residentAlert(s: State, r: Resident, now: number): { level: 'red' | 'amber' | 'green'; reasons: string[] } {
  const reasons: string[] = [];
  let level: 'red' | 'amber' | 'green' = 'green';
  if (s.sos && s.sos.residentId === r.id && (s.sos.status === 'active' || s.sos.status === 'acknowledged')) { level = 'red'; reasons.push('Active SOS'); }
  const newInc = s.incidents.filter((i) => i.residentId === r.id && i.status === 'new' && i.synced).length;
  if (newInc) { level = 'red'; reasons.push(`${newInc} incident${newInc > 1 ? 's' : ''} awaiting review`); }
  const open = s.logs.filter((l) => l.residentId === r.id && l.status === 'clarification').length;
  if (open) { if (level === 'green') level = 'amber'; reasons.push('Open clarification'); }
  const risky = s.logs.filter((l) => l.residentId === r.id && l.risk && l.status !== 'approved' && !l.incidentId).length;
  if (risky) { if (level === 'green') level = 'amber'; reasons.push(`${risky} AI risk flag${risky > 1 ? 's' : ''}`); }
  const od = overdueRisks(s, r, now);
  if (od.length) { if (level === 'green') level = 'amber'; reasons.push(`${od[0].name} review overdue`); }
  const fs = fluidStatus(r, fluidTotal(s.logs, r.id), now);
  if (fs.tone !== 'emerald') { if (level === 'green') level = fs.tone === 'red' ? 'red' : 'amber'; reasons.push(fs.label); }
  return { level, reasons };
}

function readinessScore(s: State, now: number): number {
  const logs = s.logs.filter((l) => l.synced);
  const openClar = logs.filter((l) => l.status === 'clarification').length;
  const unreviewed = s.incidents.filter((i) => i.synced && i.status === 'new').length;
  const pending = logs.filter((l) => l.status === 'pending' || l.status === 'clarified').length;
  const escalated = logs.filter((l) => l.status === 'rejected').length;
  const em = emarStats(s.meds, now);
  const sosOpen = s.sos && (s.sos.status === 'active' || s.sos.status === 'acknowledged') ? 2.5 : 0;
  const riskOverdue = RESIDENTS.reduce((a, r) => a + overdueRisks(s, r, now).length, 0);
  const expiredMed = STAFF.filter((x) => !medCompetent(x.actor.name, now).ok).length;
  const slaBreached = logs.filter((l) => l.status === 'clarification' && l.escalatedAt).length;
  const score = 100 - openClar * 0.6 - unreviewed * 0.9 - Math.min(pending, 14) * 0.12 - (100 - em.rate) * 0.15 - sosOpen - escalated * 0.3 - (s.queue.length ? 0.4 : 0) - riskOverdue * 0.3 - expiredMed * 0.4 - slaBreached * 0.4;
  return clamp(Math.round(score * 10) / 10, 60, 99.9);
}

function handoverPoints(s: State, now: number): HandoverPoint[] {
  const out: HandoverPoint[] = [];
  for (const r of RESIDENTS) {
    const total = fluidTotal(s.logs, r.id);
    if (r.fluidKind === 'restriction') out.push({ residentId: r.id, tone: total >= r.fluidLimit * 0.85 ? 'amber' : 'teal', text: `Fluid restriction: ${thousands(total)} of ${thousands(r.fluidLimit)} ml used, ${thousands(Math.max(0, r.fluidLimit - total))} ml left for tonight.` });
    else { const fs = fluidStatus(r, total, now); out.push({ residentId: r.id, tone: fs.tone === 'emerald' ? 'teal' : 'amber', text: `Fluids ${thousands(total)} of ${thousands(r.fluidLimit)} ml target. ${fs.tone === 'emerald' ? 'On pace.' : 'Behind pace: offer drinks hourly overnight if awake.'}` }); }
    for (const m of s.meds.filter((x) => x.residentId === r.id)) {
      if (m.prn) { const st = prnStatus(m, now, s.meds); const last = st.lastDose; if (last && now - last < 12 * HOUR) out.push({ residentId: r.id, tone: st.reason ? 'amber' : 'slate', text: `PRN ${m.name.split(' ')[0]} last given ${fmt(last)}.${st.lockedUntil ? ` Locked until ${fmt(st.lockedUntil)}.` : st.reason ? ` ${st.reason}` : ' Available now.'}${st.paraLimit ? ` Paracetamol today ${thousands(st.paraUsed ?? 0)} of ${thousands(st.paraLimit)} mg.` : ''}${m.stomp ? ' STOMP review queued.' : ''}` }); }
      else if (m.status === 'refused') out.push({ residentId: r.id, tone: 'amber', text: `${m.name.split(' ')[0]} refused at ${fmt(m.givenAt ?? now)} (${m.refusedReason}). Re-offer per pharmacist advice.` });
      else if (m.round === 'Bedtime' || (m.round === 'Tea' && m.status !== 'given')) out.push({ residentId: r.id, tone: 'slate', text: `${m.round} due: ${m.name}, ${m.dose}.` });
    }
    const open = s.logs.filter((l) => l.residentId === r.id && l.status === 'clarification');
    if (open.length) out.push({ residentId: r.id, tone: 'amber', text: `${open.length} manager clarification${open.length > 1 ? 's' : ''} still open.` });
    const inc = s.incidents.filter((i) => i.residentId === r.id);
    inc.forEach((i) => out.push({ residentId: r.id, tone: i.status === 'new' ? 'red' : 'slate', text: `ABC incident at ${fmt(i.time)} (${i.severity}). ${i.status === 'new' ? 'Awaiting manager review.' : 'Reviewed by manager.'} Watch for: ${residentById(i.residentId).passport.warningSigns[0].toLowerCase()}.` }));
    const care = s.care[r.id] ?? {};
    const outstanding = r.careItems.filter((c) => !care[c]);
    if (outstanding.length) out.push({ residentId: r.id, tone: 'slate', text: `Care tasks for night team: ${outstanding.join(', ')}.` });
  }
  return out;
}

function synthesiseReport(s: State, now: number): ShiftReport {
  const sections: ReportSection[] = RESIDENTS.map((r) => {
    const logs = s.logs.filter((l) => l.residentId === r.id).sort((a, b) => a.time - b.time);
    const meds = s.meds.filter((m) => m.residentId === r.id);
    const care = s.care[r.id] ?? {};
    return {
      residentId: r.id,
      lines: logs.map((l) => ({ time: l.time, text: l.text.replace(/\n/g, ' '), status: l.status })),
      fluid: fluidTotal(s.logs, r.id), mealAvg: mealAverage(s.logs, r.id),
      medsGiven: meds.filter((m) => !m.prn && m.status === 'given').length,
      medsRefused: meds.filter((m) => m.status === 'refused').length,
      prnGiven: meds.reduce((a, m) => a + (m.prn ? m.prn.doses.filter((d) => d.t >= SHIFT_START).length : 0), 0),
      incidents: s.incidents.filter((i) => i.residentId === r.id).length,
      careDone: r.careItems.filter((c) => care[c]), careOutstanding: r.careItems.filter((c) => !care[c]),
    };
  });
  return { id: `SR-${new Date(now).getFullYear()}1110-D`, generatedAt: now, status: 'submitted', sections, handover: handoverPoints(s, now) };
}

/* ============================== Reducer ============================== */

export type Action =
  | { type: 'ADD_LOG'; entry: LogEntry; actor: Actor }
  | { type: 'REQUEST_CLARIFICATION'; logId: string; msg: ThreadMsg }
  | { type: 'REPLY_CLARIFICATION'; logId: string; msg: ThreadMsg }
  | { type: 'APPROVE_LOG'; logId: string; now: number }
  | { type: 'REJECT_LOG'; logId: string; code: string; route: string; note: string; now: number }
  | { type: 'TOGGLE_FLAG'; logId: string; now: number }
  | { type: 'ADMINISTER_MED'; medId: string; now: number; witness?: string; units?: number; log: LogEntry }
  | { type: 'REFUSE_MED'; medId: string; now: number; reason: string; log: LogEntry }
  | { type: 'PRN_BLOCKED'; medId: string; now: number; reason: string }
  | { type: 'SCAN_MISMATCH'; medId: string; now: number; scanned: string }
  | { type: 'ADD_INCIDENT'; incident: Incident; log: LogEntry }
  | { type: 'REVIEW_INCIDENT'; id: string; now: number; note: string }
  | { type: 'RAISE_SOS'; sos: Sos }
  | { type: 'ACK_SOS'; now: number; responder: string }
  | { type: 'RESOLVE_SOS'; now: number; outcome: string }
  | { type: 'CANCEL_SOS'; now: number }
  | { type: 'SUBMIT_REPORT'; report: ShiftReport; now: number }
  | { type: 'SIGN_REPORT'; now: number }
  | { type: 'TOGGLE_CARE'; residentId: string; item: string; now: number }
  | { type: 'SET_ONLINE'; online: boolean; now: number }
  | { type: 'NHS_VIEWED'; residentId: string; now: number }
  | { type: 'PACK_EXPORTED'; packId: string; now: number; items: number; hash: string }
  | { type: 'INTEGRITY_CHECK'; now: number; ok: boolean; count: number }
  | { type: 'SIGN_IN'; actor: Actor; now: number; method: string; pin?: string }
  | { type: 'CLOCK_ADVANCE'; ms: number }
  | { type: 'LOCK'; now: number; reason: string }
  | { type: 'ESCALATE_CLARIFICATION'; logId: string; now: number }
  | { type: 'REVIEW_RISK'; key: string; residentId: string; name: string; now: number }
  | { type: 'STATUTORY_ACTION'; incidentId: string; action: string; now: number }
  | { type: 'FAMILY_MESSAGE'; msg: FamilyMessage }
  | { type: 'BOOK_TRAINING'; staff: string; course: string; now: number }
  | { type: 'RESET'; state: State };

const resName = (id: string) => residentById(id).name;
const updateLog = (s: State, id: string, fn: (l: LogEntry) => LogEntry): State => ({ ...s, logs: s.logs.map((l) => (l.id === id ? fn(l) : l)) });

function mergeTags(a: Tags, b: Tags): Tags {
  return {
    ...a, ...Object.fromEntries(Object.entries(b).filter(([, v]) => v !== undefined)),
    fluidMl: (a.fluidMl ?? 0) + (b.fluidMl ?? 0) || undefined,
    personalCare: Array.from(new Set([...(a.personalCare ?? []), ...(b.personalCare ?? [])])),
    behaviour: Array.from(new Set([...(a.behaviour ?? []), ...(b.behaviour ?? [])])),
    activity: Array.from(new Set([...(a.activity ?? []), ...(b.activity ?? [])])),
  };
}

const wk = (s: State): Actor => s.activeWorker ?? WORKER;

function reducer(s: State, a: Action): State {
  switch (a.type) {
    case 'ADD_LOG': {
      const entry: LogEntry = { ...a.entry, synced: s.online || a.actor.kind !== 'worker' };
      let n: State = { ...s, logs: [...s.logs, entry] };
      n = addAudit(n, a.actor, entry.time, 'NOTE_CREATED', entry.id, `${resName(entry.residentId)} · ${entry.source === 'voice' ? `voice ${entry.durationSec ?? 0}s` : entry.source} · ${truncate(firstLine(entry.text), 90)}`);
      if (entry.attachments.length) n = addAudit(n, a.actor, entry.time, 'ATTACHMENT_ADDED', entry.id, entry.attachments.map((x) => x.label).join(', '));
      if (entry.risk) n = addAudit(n, a.actor.kind === 'worker' ? DEVICE_AI : SERVER, entry.time, 'AI_RISK_FLAG', entry.id, entry.riskReasons.join(', '));
      return n;
    }
    case 'REQUEST_CLARIFICATION': {
      const log = s.logs.find((l) => l.id === a.logId);
      if (!log || log.status === 'approved' || log.status === 'rejected') return s;
      let n = updateLog(s, a.logId, (l) => ({ ...l, status: 'clarification', escalatedAt: undefined, thread: [...l.thread, a.msg], cqc: Array.from(new Set<Domain>([...l.cqc, 'Well-led'])) }));
      n = addAudit(n, MANAGER, a.msg.time, 'CLARIFICATION_REQUESTED', a.logId, `To ${log.author}: ${truncate(a.msg.text, 110)}`);
      return n;
    }
    case 'REPLY_CLARIFICATION': {
      const log = s.logs.find((l) => l.id === a.logId);
      if (!log || log.status !== 'clarification') return s;
      const parsed = parseNote(a.msg.text);
      const addendum = `Clarification ${fmt(a.msg.time)} (${a.msg.author}, ${a.msg.mode === 'voice' ? `voice ${a.msg.durationSec ?? 0}s` : 'text'}): ${parsed.normalised}`;
      let n = updateLog(s, a.logId, (l) => ({
        ...l, status: 'clarified', thread: [...l.thread, a.msg], text: `${l.text}\n${addendum}`, tags: mergeTags(l.tags, parsed.tags),
        cqc: DOMAINS.filter((d) => new Set<Domain>([...l.cqc, ...parsed.cqc, 'Well-led']).has(d)),
        revisions: [...l.revisions, { time: a.msg.time, by: 'CarePlanOS AI synthesis', text: l.text, reason: 'Superseded by clarified version (original retained)' }],
      }));
      n = addAudit(n, wk(s), a.msg.time, 'CLARIFICATION_REPLIED', a.logId, `${a.msg.mode === 'voice' ? `Voice reply ${a.msg.durationSec}s` : 'Text reply'}: ${truncate(parsed.normalised, 100)}`);
      n = addAudit(n, DEVICE_AI, a.msg.time, 'LOG_REVISED', a.logId, 'Clarification synthesised into care record. Original version retained as revision 1.');
      return n;
    }
    case 'APPROVE_LOG': {
      const log = s.logs.find((l) => l.id === a.logId);
      if (!log || log.status === 'clarification' || log.status === 'approved' || log.status === 'rejected') return s;
      const sig = sign(log.id, log.text, MANAGER, a.now);
      let n = updateLog(s, a.logId, (l) => ({ ...l, status: 'approved', signature: sig, cqc: Array.from(new Set<Domain>([...l.cqc, 'Well-led'])) }));
      n = addAudit(n, MANAGER, a.now, 'ENTRY_SIGNED', a.logId, `Digital signature ${sig.hash} · record locked`);
      return n;
    }
    case 'REJECT_LOG': {
      const log = s.logs.find((l) => l.id === a.logId);
      if (!log || log.status === 'approved') return s;
      let n = updateLog(s, a.logId, (l) => ({ ...l, status: 'rejected', reject: { code: a.code, note: a.note, by: MANAGER.name, at: a.now, route: a.route } }));
      n = addAudit(n, MANAGER, a.now, 'ENTRY_ESCALATED', a.logId, `${a.code} · ${a.route} · ${truncate(a.note, 80)}`);
      return n;
    }
    case 'TOGGLE_FLAG': {
      const log = s.logs.find((l) => l.id === a.logId);
      if (!log) return s;
      const n = updateLog(s, a.logId, (l) => ({ ...l, flagged: !l.flagged }));
      return addAudit(n, MANAGER, a.now, log.flagged ? 'CQC_UNFLAGGED' : 'CQC_FLAGGED', a.logId, log.flagged ? 'Removed from inspection pack' : 'Added to inspection evidence pack');
    }
    case 'ADMINISTER_MED': {
      const m = s.meds.find((x) => x.id === a.medId);
      if (!m) return s;
      if (m.prn) {
        const block = prnBlockReason(m, a.now, s.meds, a.units ?? 1);
        if (block) return addAudit(s, SERVER, a.now, 'PRN_BLOCKED', m.id, `Server guardrail rejected administration. ${block}`, true);
      } else if (m.status !== 'open') return s;
      const meds = s.meds.map((x) => (x.id !== m.id ? x : x.prn
        ? { ...x, prn: { ...x.prn, doses: [...x.prn.doses, { t: a.now, units: a.units ?? 1 }] }, givenAt: a.now, givenBy: wk(s).name, witness: a.witness }
        : { ...x, status: 'given' as const, givenAt: a.now, givenBy: wk(s).name, witness: a.witness }));
      let n: State = { ...s, meds, logs: [...s.logs, { ...a.log, synced: s.online }] };
      n = addAudit(n, wk(s), a.now, 'MED_ADMINISTERED', m.id, `${m.name}, ${m.prn ? `${a.units ?? 1} ${m.prn.unitLabel}${(a.units ?? 1) > 1 ? 's' : ''}` : m.dose} · ${resName(m.residentId)} · barcode verified${a.witness ? ` · witness ${a.witness}` : ''}`);
      if (m.stomp) n = addAudit(n, DEVICE_AI, a.now, 'STOMP_REVIEW', m.id, 'PRN psychotropic given to a person with a learning disability or autism. STOMP review queued for prescriber.');
      return n;
    }
    case 'REFUSE_MED': {
      const m = s.meds.find((x) => x.id === a.medId);
      if (!m || m.status !== 'open' || m.prn) return s;
      let n: State = { ...s, meds: s.meds.map((x) => (x.id === m.id ? { ...x, status: 'refused' as const, givenAt: a.now, givenBy: wk(s).name, refusedReason: a.reason } : x)), logs: [...s.logs, { ...a.log, synced: s.online }] };
      n = addAudit(n, wk(s), a.now, 'MED_REFUSED', m.id, `${m.name} · ${resName(m.residentId)} · ${a.reason}`);
      n = addAudit(n, DEVICE_AI, a.now, 'AI_RISK_FLAG', a.log.id, 'Refusal recorded');
      return n;
    }
    case 'PRN_BLOCKED':
      return addAudit(s, SERVER, a.now, 'PRN_BLOCKED', a.medId, `Early PRN attempt blocked on device. ${a.reason}`, true);
    case 'SCAN_MISMATCH':
      return addAudit(s, SERVER, a.now, 'SCAN_MISMATCH', a.medId, `Administration blocked. Scanned: ${a.scanned}`, true);
    case 'ADD_INCIDENT': {
      let n: State = { ...s, incidents: [...s.incidents, { ...a.incident, synced: s.online }], logs: [...s.logs, { ...a.log, synced: s.online }] };
      n = addAudit(n, wk(s), a.incident.time, 'INCIDENT_LOGGED', a.incident.id, `ABC · ${resName(a.incident.residentId)} · ${a.incident.severity} · triggers: ${a.incident.triggers.join(', ') || 'none identified'}`);
      if (a.incident.restrictive) n = addAudit(n, DEVICE_AI, a.incident.time, 'RESTRICTIVE_PRACTICE', a.incident.id, `Restrictive practice reported: ${truncate(a.incident.restrictiveDetail, 80)}`);
      return n;
    }
    case 'REVIEW_INCIDENT': {
      const inc = s.incidents.find((i) => i.id === a.id);
      if (!inc || inc.status === 'reviewed') return s;
      const n: State = { ...s, incidents: s.incidents.map((i) => (i.id === a.id ? { ...i, status: 'reviewed' as const, reviewedBy: MANAGER.name, reviewedAt: a.now, reviewNote: a.note } : i)) };
      return addAudit(n, MANAGER, a.now, 'INCIDENT_REVIEWED', a.id, truncate(a.note || 'Reviewed. PBS plan remains appropriate.', 110));
    }
    case 'RAISE_SOS':
      return addAudit({ ...s, sos: a.sos }, wk(s), a.sos.raisedAt, 'SOS_RAISED', a.sos.id, `Silent alert · ${a.sos.location} · on-site staff and manager notified`, true);
    case 'ACK_SOS':
      if (!s.sos || s.sos.status !== 'active') return s;
      return addAudit({ ...s, sos: { ...s.sos, status: 'acknowledged', responder: a.responder, ackAt: a.now } }, MANAGER, a.now, 'SOS_ACKNOWLEDGED', s.sos.id, `Dispatched ${a.responder} · response ${Math.max(1, Math.round((a.now - s.sos.raisedAt) / 1000))}s`);
    case 'RESOLVE_SOS': {
      if (!s.sos) return s;
      const done: Sos = { ...s.sos, status: 'resolved', resolvedAt: a.now, outcome: a.outcome };
      return addAudit({ ...s, sos: null, sosHistory: [...s.sosHistory, done] }, MANAGER, a.now, 'SOS_RESOLVED', done.id, `Signed off: ${truncate(a.outcome, 100)}`);
    }
    case 'CANCEL_SOS': {
      if (!s.sos) return s;
      const done: Sos = { ...s.sos, status: 'cancelled', resolvedAt: a.now, outcome: 'Cancelled by worker: safe' };
      return addAudit({ ...s, sos: null, sosHistory: [...s.sosHistory, done] }, wk(s), a.now, 'SOS_CANCELLED', done.id, 'Worker confirmed safe and cancelled the alert', true);
    }
    case 'SUBMIT_REPORT':
      return addAudit({ ...s, report: { ...a.report, submittedAt: a.now, status: 'submitted' } }, wk(s), a.now, 'REPORT_SUBMITTED', a.report.id, `12-hour shift report and night handover submitted (${a.report.sections.reduce((x, r) => x + r.lines.length, 0)} entries)`);
    case 'SIGN_REPORT': {
      if (!s.report || s.report.status === 'signed') return s;
      const sig = sign(s.report.id, JSON.stringify(s.report.sections.map((x) => x.lines.length)), MANAGER, a.now);
      return addAudit({ ...s, report: { ...s.report, status: 'signed', signature: sig } }, MANAGER, a.now, 'REPORT_SIGNED', s.report.id, `Shift report signed ${sig.hash}`);
    }
    case 'TOGGLE_CARE': {
      const cur = s.care[a.residentId]?.[a.item] ?? false;
      const n: State = { ...s, care: { ...s.care, [a.residentId]: { ...s.care[a.residentId], [a.item]: !cur } } };
      return addAudit(n, wk(s), a.now, 'CARE_TASK', a.residentId, `${resName(a.residentId)} · ${a.item} ${cur ? 'unticked' : 'completed'}`);
    }
    case 'SET_ONLINE': {
      if (!a.online) return { ...s, online: false };
      let n: State = { ...s, online: true, logs: s.logs.map((l) => ({ ...l, synced: true })), incidents: s.incidents.map((i) => ({ ...i, synced: true })), queue: [] };
      const count = s.queue.length;
      for (const q of s.queue) n = addAudit(n, q.actor, q.time, q.action, q.entity, `${q.detail} · captured offline at ${fmt(q.time)}`, true);
      return addAudit(n, SERVER, a.now, 'SYNC_COMPLETE', 'device-DS', `${count} queued event${count === 1 ? '' : 's'} uploaded · UK-South · TLS 1.3`);
    }
    case 'NHS_VIEWED':
      return addAudit(s, MANAGER, a.now, 'PII_VIEWED', a.residentId, `NHS number revealed for ${resName(a.residentId)}`);
    case 'PACK_EXPORTED':
      return addAudit(s, MANAGER, a.now, 'PACK_EXPORTED', a.packId, `CQC evidence pack · ${a.items} items · pack hash ${a.hash}`);
    case 'INTEGRITY_CHECK':
      return addAudit(s, MANAGER, a.now, 'INTEGRITY_CHECK', 'audit-ledger', a.ok ? `Chain verified · ${a.count} events intact` : 'Chain verification failed');
    case 'SIGN_IN':
      return addAudit({ ...s, activeWorker: a.actor }, a.actor, a.now, 'DEVICE_SIGN_IN', 'handset-2', `${a.actor.name} signed in by ${a.method} on shared handset 2`, true);
    case 'LOCK':
      return s.activeWorker ? addAudit({ ...s, activeWorker: null }, s.activeWorker, a.now, 'DEVICE_LOCKED', 'handset-2', a.reason, true) : s;
    case 'ESCALATE_CLARIFICATION': {
      const log = s.logs.find((l) => l.id === a.logId);
      if (!log || log.status !== 'clarification' || log.escalatedAt) return s;
      const n = updateLog(s, a.logId, (l) => ({ ...l, escalatedAt: a.now }));
      return addAudit(n, SERVER, a.now, 'CLARIFICATION_ESCALATED', a.logId, `No reply within the ${CLARIFY_SLA_MIN}-minute SLA. Escalated to the deputy manager and re-sent to ${log.author}.`);
    }
    case 'REVIEW_RISK':
      return addAudit({ ...s, riskReviews: { ...s.riskReviews, [a.key]: a.now } }, MANAGER, a.now, 'RISK_REVIEWED', a.residentId, `${a.name} risk assessment reviewed for ${resName(a.residentId)}`);
    case 'STATUTORY_ACTION': {
      const inc = s.incidents.find((i) => i.id === a.incidentId);
      if (!inc || inc.statutory[a.action]) return s;
      const n: State = { ...s, incidents: s.incidents.map((i) => (i.id === a.incidentId ? { ...i, statutory: { ...i.statutory, [a.action]: a.now } } : i)) };
      return addAudit(n, MANAGER, a.now, 'STATUTORY_ACTION', a.incidentId, `${a.action} completed for ${resName(inc.residentId)}`);
    }
    case 'FAMILY_MESSAGE':
      return addAudit({ ...s, familyMessages: [...s.familyMessages, a.msg] }, FAMILY, a.msg.time, a.msg.kind === 'visit' ? 'VISIT_BOOKED' : 'FAMILY_MESSAGE', a.msg.residentId, truncate(a.msg.text, 110), true);
    case 'BOOK_TRAINING':
      return addAudit({ ...s, trainingBooked: { ...s.trainingBooked, [`${a.staff}|${a.course}`]: a.now } }, MANAGER, a.now, 'TRAINING_BOOKED', a.staff, `${a.course} refresher booked for ${a.staff}`);
    case 'RESET':
      return a.state;
    default:
      return s;
  }
}

function buildInitialState(): State {
  const t13 = at(13, 10);
  const L: LogEntry[] = [
    makeLog({ id: 'LOG-0812', residentId: 'arthur', time: at(8, 12), source: 'voice', durationSec: 24, accent: 'West African English', confidence: 97, text: 'Supported Arthur with a full wash and shave, he chose his navy jumper. Oral care done, dentures cleaned. Calm and chatty, talking about his Navy days.', status: 'approved', signature: sign('LOG-0812', 'seed', MANAGER, at(9, 30)) }),
    makeLog({ id: 'LOG-0840', residentId: 'margaret', time: at(8, 40), source: 'emar', text: 'Morning medicines given via eMAR: Furosemide 40 mg, Bisoprolol 2.5 mg, Apixaban 5 mg. Pulse 72 bpm checked before bisoprolol. Taken with 200 ml water.', status: 'approved', signature: sign('LOG-0840', 'seed', MANAGER, at(9, 31)) }),
    makeLog({ id: 'LOG-0850', residentId: 'arthur', time: at(8, 50), source: 'voice', durationSec: 15, accent: 'Yorkshire English', confidence: 98, text: 'Arthur had porridge for breakfast and ate all of it. Gave him a cuppa with two sugars, he drank the lot.', status: 'approved', signature: sign('LOG-0850', 'seed', MANAGER, at(9, 31)) }),
    makeLog({ id: 'LOG-0905', residentId: 'leo', time: at(9, 5), source: 'voice', durationSec: 18, accent: 'West African English', confidence: 96, text: 'Leo had breakfast, ate all his cereal and toast. Drank 300 ml orange juice. Happy, talking about the football.', status: 'approved', signature: sign('LOG-0905', 'seed', MANAGER, at(9, 32)) }),
    makeLog({ id: 'LOG-1020', residentId: 'margaret', time: at(10, 20), source: 'text', text: "Margaret's daughter Helen visited for an hour and they did the crossword together. She drank 200 ml tea." }),
    makeLog({ id: 'LOG-1158', residentId: 'margaret', time: at(11, 58), source: 'emar', text: 'PRN Paracetamol 500 mg, 2 tablets (1 g), given for left hip pain scored 6/10, 30 minutes before physio. Barcode verified.' }),
    makeLog({ id: 'LOG-1234', residentId: 'arthur', time: at(12, 34), source: 'voice', durationSec: 6, accent: 'West African English', confidence: 95, text: 'Arthur refused his 12:30 Adcal-D3.', status: 'clarification', thread: [{ id: 'MSG-1310', from: 'manager', author: MANAGER.name, time: t13, text: CLARIFY_PRESETS[0], mode: 'text' }] }),
    makeLog({ id: 'LOG-1315', residentId: 'leo', time: at(13, 15), source: 'voice', durationSec: 4, accent: 'West African English', confidence: 93, text: 'Leo agitated after lunch.' }),
    makeLog({ id: 'LOG-1340', residentId: 'arthur', time: at(13, 40), source: 'voice', durationSec: 7, accent: 'West African English', confidence: 97, text: 'Arthur drank 200 ml of water with prompting.' }),
    makeLog({ id: 'LOG-1352', residentId: 'leo', time: at(13, 52), source: 'incident', incidentId: 'INC-0412', text: 'ABC incident. Antecedent: fire alarm test sounded at 13:50 without the advance warning in his plan. Behaviour: Leo covered his ears, screamed and banged his head on the door frame twice. Consequence: moved to the quiet room with ear defenders and weighted blanket, settled within 12 minutes. Head check done, no visible injury.' }),
    makeLog({ id: 'LOG-1405', residentId: 'leo', time: at(14, 5), source: 'emar', text: 'PRN Lorazepam 0.5 mg given after PBS steps 1 to 3 were attempted. Witnessed by Amina Kamara. Barcode verified.' }),
    makeLog({ id: 'LOG-1430', residentId: 'margaret', time: at(14, 30), source: 'voice', durationSec: 12, accent: 'South Asian English', confidence: 95, text: "Margaret ate half of her shepherd's pie and all of her rice pudding. Kindly note she drank 150 mls apple juice." }),
    makeLog({ id: 'LOG-1510', residentId: 'arthur', time: at(15, 10), source: 'voice', durationSec: 14, accent: 'West African English', confidence: 96, author: AMINA, text: 'Walked with Arthur in the garden for 15 minutes using his frame. Steady on his feet and enjoyed watching the robins.' }),
  ];
  const incident: Incident = {
    id: 'INC-0412', residentId: 'leo', time: at(13, 52), author: WORKER.name, logId: 'LOG-1352', synced: true, status: 'new', severity: 'Moderate',
    antecedent: 'Fire alarm test sounded at 13:50 without the advance warning set out in his plan.',
    behaviour: 'Leo covered his ears, screamed and banged his head on the door frame twice.',
    consequence: 'Moved to the quiet room, offered ear defenders and the weighted blanket. Settled within 12 minutes. PRN Lorazepam given at 14:05 after de-escalation. Head check done, no visible injury.',
    triggers: ['Unexpected loud noise', 'Change to routine or staff'], restrictive: false, restrictiveDetail: '', statutory: { 'Family or advocate informed': at(14, 40) },
  };
  let s: State = { logs: L, meds: MEDS_SEED, incidents: [incident], audit: [], queue: [], sos: null, sosHistory: [], report: null, care: CARE_SEED, online: true, activeWorker: WORKER, riskReviews: {}, familyMessages: [], trainingBooked: {} };
  const events: Array<[number, Actor, string, string, string]> = [
    [at(6, 10), NIGHT, 'MED_ADMINISTERED', 'm7', 'Paracetamol 500 mg tablets, 2 tablets · Margaret Holloway · barcode verified'],
    [at(7, 30), NIGHT, 'MED_ADMINISTERED', 'm1', 'Alendronic acid 70 mg · Margaret Holloway · barcode verified'],
    [at(7, 45), NIGHT, 'MED_ADMINISTERED', 'a5', 'Paracetamol 500 mg tablets, 1 tablet · Arthur Pendelton · barcode verified'],
    [at(7, 58), WORKER, 'SHIFT_START', 'shift-D', 'Clocked in · Willow Lane · location verified · device integrity check passed'],
    [at(7, 59), WORKER, 'DEVICE_SIGN_IN', 'handset-2', 'David S. signed in by badge + PIN on shared handset 2'],
    [at(14, 40), MANAGER, 'STATUTORY_ACTION', 'INC-0412', 'Family or advocate informed completed for Leo Vance'],
    [at(8, 0), NIGHT, 'HANDOVER_ACCEPTED', 'shift-N', 'Night handover read and accepted by David S.'],
    [at(8, 20), WORKER, 'MED_ADMINISTERED', 'l1', 'Sertraline 50 mg tablets · Leo Vance · barcode verified'],
    [at(8, 32), WORKER, 'MED_ADMINISTERED', 'a1', 'Amlodipine 5 mg tablets · Arthur Pendelton · barcode verified'],
    [at(8, 40), WORKER, 'MED_ADMINISTERED', 'm2,m3,m4', 'Furosemide, Bisoprolol, Apixaban · Margaret Holloway · barcode verified · pulse 72'],
    [at(9, 30), MANAGER, 'ENTRY_SIGNED', 'LOG-0812', 'Digital signature applied · record locked'],
    [at(9, 31), MANAGER, 'ENTRY_SIGNED', 'LOG-0840,LOG-0850', 'Digital signatures applied · records locked'],
    [at(9, 32), MANAGER, 'ENTRY_SIGNED', 'LOG-0905', 'Digital signature applied · record locked'],
    [at(12, 34), WORKER, 'MED_REFUSED', 'a2', 'Adcal-D3 chewable tablets · Arthur Pendelton · declined, said it tastes chalky'],
    [at(13, 10), MANAGER, 'CLARIFICATION_REQUESTED', 'LOG-1234', `To David S.: ${truncate(CLARIFY_PRESETS[0], 110)}`],
    [at(13, 52), WORKER, 'INCIDENT_LOGGED', 'INC-0412', 'ABC · Leo Vance · Moderate · triggers: Unexpected loud noise, Change to routine or staff'],
    [at(14, 5), WORKER, 'MED_ADMINISTERED', 'l3', 'Lorazepam 0.5 mg tablets · Leo Vance · barcode verified · witness Amina Kamara'],
    [at(14, 5), DEVICE_AI, 'STOMP_REVIEW', 'l3', 'PRN psychotropic given to a person with a learning disability or autism. STOMP review queued for prescriber.'],
  ];
  for (const l of L) {
    events.push([l.time, l.author === AMINA.name ? AMINA : WORKER, 'NOTE_CREATED', l.id, `${resName(l.residentId)} · ${l.source === 'voice' ? `voice ${l.durationSec}s` : l.source} · ${truncate(firstLine(l.text), 90)}`]);
    if (l.risk) events.push([l.time, DEVICE_AI, 'AI_RISK_FLAG', l.id, l.riskReasons.join(', ')]);
  }
  events.sort((x, y) => x[0] - y[0]);
  for (const [t, actor, action, entity, detail] of events) s = addAudit(s, actor, t, action, entity, detail, true);
  return s;
}

/* ============================== Styling primitives ============================== */

const GLOBAL_CSS = `
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Plus+Jakarta+Sans:wght@500;600;700;800&family=JetBrains+Mono:wght@400;500;600&display=swap');
.cos-root{font-family:Inter,ui-sans-serif,system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;-webkit-font-smoothing:antialiased}
.cos-display{font-family:'Plus Jakarta Sans',Inter,ui-sans-serif,system-ui,sans-serif;letter-spacing:-0.015em}
.cos-mono{font-family:'JetBrains Mono',ui-monospace,SFMono-Regular,Menlo,monospace}
.tnum{font-variant-numeric:tabular-nums}
.cos-balance{text-wrap:balance}
@keyframes cos-wave{0%,100%{transform:scaleY(.22)}50%{transform:scaleY(1)}}
@keyframes cos-scan{0%{top:10%}50%{top:86%}100%{top:10%}}
@keyframes cos-ping{0%{transform:scale(1);opacity:.65}100%{transform:scale(1.9);opacity:0}}
@keyframes cos-packet-r{0%{left:0;opacity:0}12%{opacity:1}88%{opacity:1}100%{left:calc(100% - 10px);opacity:0}}
@keyframes cos-packet-l{0%{left:calc(100% - 10px);opacity:0}12%{opacity:1}88%{opacity:1}100%{left:0;opacity:0}}
@keyframes cos-rise{from{transform:translateY(14px);opacity:.2}to{transform:none;opacity:1}}
@keyframes cos-fade{from{opacity:.3}to{opacity:1}}
@keyframes cos-spin{to{transform:rotate(360deg)}}
@keyframes cos-flash{0%,100%{background-color:rgba(239,68,68,.10)}50%{background-color:rgba(239,68,68,.22)}}
.cos-rise{animation:cos-rise .28s cubic-bezier(.2,.8,.2,1) both}
.cos-fade{animation:cos-fade .2s ease-out both}
.cos-ping{animation:cos-ping 1.6s cubic-bezier(0,0,.2,1) infinite}
.cos-spin{animation:cos-spin 1s linear infinite}
.cos-flash{animation:cos-flash 1.4s ease-in-out infinite}
.cos-scroll{scrollbar-width:thin;scrollbar-color:rgba(148,163,184,.35) transparent}
.cos-scroll::-webkit-scrollbar{width:6px;height:6px}
.cos-scroll::-webkit-scrollbar-thumb{background:rgba(148,163,184,.35);border-radius:9px}
.cos-noscroll{scrollbar-width:none}.cos-noscroll::-webkit-scrollbar{display:none}
.cos-root :focus-visible{outline:2px solid #06B6D4;outline-offset:2px;border-radius:8px}
@media (prefers-reduced-motion: reduce){.cos-root *,.cos-root *::before,.cos-root *::after{animation-duration:.001ms!important;animation-iteration-count:1!important;transition-duration:.001ms!important}}
`;

const TONE_DARK: Record<Tone, string> = {
  teal: 'bg-teal-500/15 text-teal-200 border-teal-400/30', emerald: 'bg-emerald-500/15 text-emerald-200 border-emerald-400/30',
  amber: 'bg-amber-500/15 text-amber-200 border-amber-400/40', red: 'bg-red-500/15 text-red-200 border-red-400/40',
  cyan: 'bg-cyan-500/15 text-cyan-200 border-cyan-400/30', slate: 'bg-white/[0.06] text-slate-300 border-white/10',
};
const TONE_LIGHT: Record<Tone, string> = {
  teal: 'bg-teal-50 text-teal-800 border-teal-200', emerald: 'bg-emerald-50 text-emerald-800 border-emerald-200',
  amber: 'bg-amber-50 text-amber-800 border-amber-300', red: 'bg-red-50 text-red-700 border-red-200',
  cyan: 'bg-cyan-50 text-cyan-800 border-cyan-200', slate: 'bg-slate-100 text-slate-700 border-slate-200',
};
const STATUS_META: Record<LogStatus, { label: string; tone: Tone }> = {
  pending: { label: 'Awaiting review', tone: 'slate' }, clarification: { label: 'Clarification open', tone: 'amber' },
  clarified: { label: 'Clarified · ready to sign', tone: 'cyan' }, approved: { label: 'Signed', tone: 'emerald' }, rejected: { label: 'Escalated', tone: 'red' },
};
const SOURCE_ICON: Record<Source, React.ElementType> = { voice: AudioLines, text: Keyboard, photo: Camera, emar: Pill, incident: Brain, obs: HeartPulse };
const ATTACH_META: Record<AttachmentKind, { label: string; icon: React.ElementType; detail: string; note: string }> = {
  skin: { label: 'Skin integrity check', icon: Camera, detail: 'Body map · sacrum · 2 cm · blanching', note: 'Skin integrity photo taken and body map updated.' },
  meal: { label: 'Meal plate remaining', icon: Utensils, detail: 'Plate analysis: 60% eaten', note: 'Meal plate photo taken after the meal, about 60% eaten.' },
  receipt: { label: 'Community shopping receipt', icon: Receipt, detail: 'Co-op · £4.85 · personal monies ledger', note: 'Community shopping receipt photographed for the personal monies ledger, £4.85 at the Co-op.' },
  hospital: { label: 'Hospital or GP note', icon: Hospital, detail: 'Letter scanned · Gloucestershire Royal', note: 'Hospital letter scanned and attached to the record.' },
};

function Chip({ tone = 'slate', surface = 'dark', icon: Icon, children, className = '' }: { tone?: Tone; surface?: Surface; icon?: React.ElementType; children: React.ReactNode; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-2 py-0.5 text-[11px] font-medium leading-5 ${(surface === 'dark' ? TONE_DARK : TONE_LIGHT)[tone]} ${className}`}>
      {Icon ? <Icon className="h-3 w-3 shrink-0" aria-hidden /> : null}
      {children}
    </span>
  );
}

function TagChips({ tags, surface, risk, riskReasons = [], compact = false }: { tags: Tags; surface: Surface; risk?: boolean; riskReasons?: string[]; compact?: boolean }) {
  const moodTone: Tone = tags.mood?.includes('Agitated') ? 'amber' : tags.mood?.startsWith('Anxious') ? 'amber' : 'emerald';
  const items: React.ReactNode[] = [];
  if (tags.fluidMl) items.push(<Chip key="f" tone="cyan" surface={surface} icon={Droplets}><span className="tnum">{tags.fluidMl} ml{tags.fluidEstimated ? ' est.' : ''}</span></Chip>);
  if (tags.mealPct !== undefined) items.push(<Chip key="m" tone="teal" surface={surface} icon={Utensils}><span className="tnum">{tags.mealLabel ? `${tags.mealLabel} ` : ''}{tags.mealPct}%</span></Chip>);
  if (tags.mood) items.push(<Chip key="mo" tone={tags.mood.includes('→ Settled') || tags.mood.includes('→ Positive') ? 'emerald' : moodTone} surface={surface} icon={HeartHandshake}>{tags.mood}</Chip>);
  if (tags.pain !== undefined) items.push(<Chip key="p" tone="amber" surface={surface} icon={Activity}><span className="tnum">Pain {tags.pain}/10</span></Chip>);
  tags.behaviour?.forEach((b) => items.push(<Chip key={`b${b}`} tone="amber" surface={surface} icon={Brain}>{b}</Chip>));
  if (!compact) tags.personalCare?.forEach((c) => items.push(<Chip key={`c${c}`} surface={surface}>{c}</Chip>));
  if (!compact) tags.activity?.forEach((c) => items.push(<Chip key={`a${c}`} surface={surface}>{c}</Chip>));
  if (tags.med) items.push(<Chip key="med" tone="teal" surface={surface} icon={Pill}>Medication</Chip>);
  if (risk) items.push(<Chip key="r" tone="red" surface={surface} icon={ShieldAlert}>{compact ? 'AI risk flag' : `AI risk: ${riskReasons.join(', ')}`}</Chip>);
  if (!items.length) return null;
  return <div className="flex flex-wrap gap-1.5">{items}</div>;
}

function Ring({ size, stroke, progress, color, track, children }: { size: number; stroke: number; progress: number; color: string; track: string; children?: React.ReactNode }) {
  const r = (size - stroke) / 2; const c = 2 * Math.PI * r;
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={r} stroke={track} strokeWidth={stroke} fill="none" />
        <circle cx={size / 2} cy={size / 2} r={r} stroke={color} strokeWidth={stroke} fill="none" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - clamp(progress, 0, 1))} style={{ transition: 'stroke-dashoffset .35s linear' }} />
      </svg>
      <div className="absolute inset-0 grid place-items-center">{children}</div>
    </div>
  );
}

function Wave({ bars = 28, active, className = 'bg-teal-300' }: { bars?: number; active: boolean; className?: string }) {
  return (
    <div className="flex h-9 items-center gap-[3px]" aria-hidden>
      {Array.from({ length: bars }).map((_, i) => (
        <span key={i} className={`w-[3px] rounded-full ${className}`} style={{ height: '100%', transformOrigin: 'center', transform: active ? undefined : 'scaleY(0.18)', animation: active ? `cos-wave ${0.55 + ((i * 37) % 50) / 100}s ease-in-out ${((i * 53) % 40) / 100}s infinite` : 'none' }} />
      ))}
    </div>
  );
}

function Avatar({ name, hue, size = 'h-9 w-9 text-xs' }: { name: string; hue: string; size?: string }) {
  return <span className={`grid shrink-0 place-items-center rounded-full bg-gradient-to-br ${hue} font-semibold text-slate-950 ${size}`} aria-hidden>{initials(name)}</span>;
}

function AttachmentThumb({ a, surface }: { a: Attachment; surface: Surface }) {
  const Icon = ATTACH_META[a.kind].icon;
  return (
    <div className={`flex min-w-0 items-center gap-2 rounded-xl border p-2 ${surface === 'dark' ? 'border-white/10 bg-white/[0.04]' : 'border-slate-200 bg-white'}`}>
      <span className="relative grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-lg bg-gradient-to-br from-slate-700 via-teal-800 to-cyan-700">
        <Icon className="h-4 w-4 text-white/90" aria-hidden />
        <span className="absolute bottom-0.5 right-0.5 rounded bg-black/40 px-0.5 text-[8px] text-white">IMG</span>
      </span>
      <div className="min-w-0">
        <p className={`truncate text-xs font-semibold ${surface === 'dark' ? 'text-slate-100' : 'text-slate-800'}`}>{a.label}</p>
        <p className={`truncate text-[11px] ${surface === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>{a.detail}</p>
      </div>
    </div>
  );
}

function PhoneSheet({ title, onClose, children, icon: Icon }: { title: string; onClose: () => void; children: React.ReactNode; icon?: React.ElementType }) {
  return (
    <div className="absolute inset-0 z-40 flex flex-col justify-end bg-slate-950/60 backdrop-blur-[2px] cos-fade" onClick={onClose}>
      <div role="dialog" aria-label={title} className="cos-scroll cos-rise max-h-[90%] overflow-y-auto rounded-t-[28px] border-t border-white/15 bg-slate-900/95 px-5 pb-6 pt-3 shadow-2xl backdrop-blur-xl" onClick={(e) => e.stopPropagation()}>
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-white/20" />
        <div className="mb-4 flex items-center justify-between gap-3">
          <h3 className="cos-display flex items-center gap-2 text-base font-semibold text-white">{Icon ? <Icon className="h-4 w-4 text-teal-300" aria-hidden /> : null}{title}</h3>
          <button type="button" onClick={onClose} className="grid h-8 w-8 place-items-center rounded-full bg-white/10 text-slate-300 hover:bg-white/20" aria-label="Close"><X className="h-4 w-4" /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

function Modal({ title, onClose, children, wide = false, icon: Icon }: { title: string; onClose: () => void; children: React.ReactNode; wide?: boolean; icon?: React.ElementType }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return createPortal(
    <div className="cos-root fixed inset-0 z-[70] flex items-end justify-center bg-slate-950/70 p-3 backdrop-blur-sm cos-fade sm:items-center" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-label={title} className={`cos-rise cos-scroll flex max-h-[92vh] w-full flex-col overflow-hidden rounded-3xl border border-white/30 bg-white/95 text-slate-800 shadow-2xl shadow-teal-950/30 backdrop-blur-xl ${wide ? 'max-w-5xl' : 'max-w-xl'}`} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between gap-3 border-b border-slate-200/80 px-5 py-4">
          <h3 className="cos-display flex items-center gap-2 text-lg font-semibold text-slate-900">{Icon ? <Icon className="h-5 w-5 text-teal-600" aria-hidden /> : null}{title}</h3>
          <button type="button" onClick={onClose} className="grid h-9 w-9 place-items-center rounded-full bg-slate-100 text-slate-600 hover:bg-slate-200" aria-label="Close"><X className="h-4 w-4" /></button>
        </div>
        <div className="cos-scroll min-h-0 flex-1 overflow-y-auto">{children}</div>
      </div>
    </div>,
    document.body,
  );
}

const btn = {
  primaryDark: 'inline-flex items-center justify-center gap-2 rounded-2xl bg-teal-500 px-4 py-3 text-sm font-semibold text-slate-950 shadow-lg shadow-teal-500/25 transition hover:bg-teal-400 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400 disabled:shadow-none',
  ghostDark: 'inline-flex items-center justify-center gap-2 rounded-2xl border border-white/15 bg-white/[0.06] px-4 py-3 text-sm font-semibold text-slate-100 transition hover:bg-white/[0.12] disabled:opacity-40',
  primary: 'inline-flex items-center justify-center gap-2 rounded-xl bg-teal-600 px-3.5 py-2 text-sm font-semibold text-white shadow-sm shadow-teal-900/20 transition hover:bg-teal-700 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-500',
  secondary: 'inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50',
  danger: 'inline-flex items-center justify-center gap-2 rounded-xl border border-red-200 bg-red-50 px-3.5 py-2 text-sm font-semibold text-red-700 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-50',
  amber: 'inline-flex items-center justify-center gap-2 rounded-xl border border-amber-300 bg-amber-50 px-3.5 py-2 text-sm font-semibold text-amber-800 transition hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-50',
};

/* ============================== Hooks ============================== */

function useSimClock() {
  const startRef = useRef(Date.now());
  const [offset, setOffset] = useState(0);
  const [, setTick] = useState(0);
  useEffect(() => { const i = window.setInterval(() => setTick((t) => t + 1), 1000); return () => window.clearInterval(i); }, []);
  const now = BASE_NOW + (Date.now() - startRef.current) + offset;
  return { now, advance: (ms: number) => setOffset((o) => o + ms), reset: () => { startRef.current = Date.now(); setOffset(0); } };
}

function useRecorder(maxSec: number, onAutoStop: () => void) {
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const cb = useRef(onAutoStop);
  cb.current = onAutoStop;
  useEffect(() => {
    if (startedAt === null) return undefined;
    const i = window.setInterval(() => {
      const e = (Date.now() - startedAt) / 1000;
      setElapsed(e);
      if (e >= maxSec) { window.clearInterval(i); cb.current(); }
    }, 100);
    return () => window.clearInterval(i);
  }, [startedAt, maxSec]);
  const start = useCallback(() => { setElapsed(0); setStartedAt(Date.now()); }, []);
  const stop = useCallback(() => { const e = startedAt ? (Date.now() - startedAt) / 1000 : 0; setStartedAt(null); return Math.max(1, Math.round(e)); }, [startedAt]);
  return { recording: startedAt !== null, elapsed, start, stop };
}

type Act = (a: Action, origin: 'worker' | 'manager') => void;
type Notify = (text: string, tone: Tone, origin: Toast['origin']) => void;

/* ============================== Worker mobile app ============================== */

interface Draft { text: string; source: Source; durationSec?: number; accent?: string; confidence?: number; attachments: Attachment[]; removed: string[] }

function WorkerPhone({ state, now, act, notify }: { state: State; now: number; act: Act; notify: Notify }) {
  const [residentId, setResidentId] = useState('arthur');
  const [tab, setTab] = useState<WorkerTab>('journal');
  const [replyFor, setReplyFor] = useState<string | null>(null);
  const [showReport, setShowReport] = useState(false);
  const resident = residentById(residentId);
  const me = state.activeWorker;
  const [large, setLarge] = useState(false);
  const myOpen = state.logs.filter((l) => !!me && l.author === me.name && l.status === 'clarification');
  const lastAct = useRef(Date.now());
  const nowRef = useRef(now);
  nowRef.current = now;
  useEffect(() => {
    const i = window.setInterval(() => {
      if (state.activeWorker && !state.sos && Date.now() - lastAct.current > IDLE_LOCK_MS) act({ type: 'LOCK', now: nowRef.current, reason: 'Auto-locked after 5 minutes without activity' }, 'worker');
    }, 5000);
    return () => window.clearInterval(i);
  }, [state.activeWorker, state.sos, act]);
  const dueMeds = state.meds.filter((m) => m.residentId === residentId && ['due', 'overdue'].includes(medState(m, now))).length;
  const hour = clamp(Math.floor((now - SHIFT_START) / HOUR) + 1, 1, 12);
  const shiftPct = clamp((now - SHIFT_START) / (12 * HOUR), 0, 1);
  const d = new Date(now);
  const tabs: Array<{ id: WorkerTab; label: string; icon: React.ElementType; badge?: number; badgeTone?: string }> = [
    { id: 'journal', label: 'Journal', icon: ClipboardList, badge: myOpen.length, badgeTone: 'bg-amber-400 text-slate-950' },
    { id: 'emar', label: 'eMAR', icon: Pill, badge: dueMeds, badgeTone: 'bg-teal-400 text-slate-950' },
    { id: 'plan', label: 'Plan', icon: HeartPulse },
    { id: 'handover', label: 'Handover', icon: ListChecks },
  ];

  return (
    <div className="relative mx-auto w-full max-w-[392px] shrink-0">
      <div onPointerDownCapture={() => { lastAct.current = Date.now(); }} onKeyDownCapture={() => { lastAct.current = Date.now(); }} className="relative h-[820px] rounded-[54px] border border-white/15 bg-gradient-to-b from-slate-700/60 to-slate-900/80 p-[10px] shadow-2xl shadow-black/60 ring-1 ring-black/40">
        <div className="relative flex h-full flex-col overflow-hidden rounded-[44px] bg-[#0B1424]">
          <div className="pointer-events-none absolute inset-0" style={{ background: 'radial-gradient(120% 60% at 10% 0%, rgba(13,148,136,.28), transparent 60%), radial-gradient(90% 50% at 100% 30%, rgba(6,182,212,.14), transparent 60%)' }} />
          <div className="relative z-10 flex h-11 shrink-0 items-center justify-between px-7 pt-1 text-[13px] font-semibold text-white">
            <span className="tnum">{pad(d.getUTCHours())}:{pad(d.getUTCMinutes())}</span>
            <span className="absolute left-1/2 top-2 h-[26px] w-[104px] -translate-x-1/2 rounded-full bg-black" aria-hidden />
            <span className="flex items-center gap-1.5 text-[11px] text-slate-300">
              {state.online ? <Cloud className="h-3.5 w-3.5 text-emerald-300" aria-label="Online" /> : <CloudOff className="h-3.5 w-3.5 text-amber-300" aria-label="Offline" />}
              <span className="tnum">78%</span>
              <span className="h-2.5 w-5 rounded-[3px] border border-slate-400 p-[1px]"><span className="block h-full w-[78%] rounded-[1px] bg-emerald-300" /></span>
            </span>
          </div>

          {me ? (<MeCtx.Provider value={me}>
          <div className="relative z-10 shrink-0 space-y-3 px-4 pb-3">
            <div className="flex items-center gap-3">
              <Avatar name={me.name} hue={staffByName(me.name)?.hue ?? 'from-cyan-300 to-teal-400'} size="h-10 w-10 text-sm" />
              <div className="min-w-0 flex-1">
                <p className="cos-display truncate text-[15px] font-semibold text-white">{me.name}</p>
                <p className="truncate text-[11px] text-slate-400">{me.role} · Handset 2</p>
              </div>
              <button type="button" onClick={() => setLarge((v) => !v)} aria-pressed={large} className={`grid h-8 w-8 shrink-0 place-items-center rounded-full border ${large ? 'border-teal-300/60 bg-teal-400/20 text-teal-100' : 'border-white/10 bg-white/[0.06] text-slate-300'}`} aria-label="Large text"><Type className="h-4 w-4" /></button>
              <button type="button" onClick={() => { act({ type: 'LOCK', now, reason: `${me.name} signed out` }, 'worker'); notify('Handset locked. Resident data hidden.', 'teal', 'worker'); }} className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-white/10 bg-white/[0.06] text-slate-300 hover:bg-white/10" aria-label="Lock and switch user"><KeyRound className="h-4 w-4" /></button>
              <SosButton state={state} now={now} residentId={residentId} act={act} notify={notify} />
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/[0.05] px-3 py-2 backdrop-blur-xl">
              <div className="flex items-center justify-between text-[11px]">
                <span className="flex items-center gap-1.5 text-slate-300"><Clock className="h-3.5 w-3.5 text-teal-300" aria-hidden /><span className="tnum">08:00 to 20:00</span></span>
                <span className="tnum font-semibold text-teal-200">Hour {hour} of 12</span>
              </div>
              <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/10" role="progressbar" aria-valuenow={Math.round(shiftPct * 100)} aria-valuemin={0} aria-valuemax={100} aria-label="Shift progress">
                <div className="h-full rounded-full bg-gradient-to-r from-teal-500 to-cyan-400 transition-all" style={{ width: `${shiftPct * 100}%` }} />
              </div>
            </div>
            <div className="cos-noscroll -mx-4 flex gap-2 overflow-x-auto px-4" role="tablist" aria-label="Active service user">
              {RESIDENTS.map((r) => {
                const al = residentAlert(state, r, now);
                const active = r.id === residentId;
                return (
                  <button key={r.id} type="button" role="tab" aria-selected={active} onClick={() => setResidentId(r.id)} className={`flex shrink-0 items-center gap-2 rounded-2xl border py-1.5 pl-1.5 pr-3 text-left transition ${active ? 'border-teal-300/60 bg-teal-400/15 shadow-lg shadow-teal-500/10' : 'border-white/10 bg-white/[0.04] hover:bg-white/[0.08]'}`}>
                    <span className="relative"><Avatar name={r.name} hue={r.hue} size="h-8 w-8 text-[11px]" /><span className={`absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full border-2 border-[#0B1424] ${al.level === 'red' ? 'bg-red-500' : al.level === 'amber' ? 'bg-amber-400' : 'bg-emerald-400'}`} /></span>
                    <span><span className="block text-[12px] font-semibold leading-4 text-white">{r.first} <span className="tnum font-normal text-slate-400">{r.age}</span></span><span className="block text-[10px] leading-4 text-slate-400">{r.short}</span></span>
                  </button>
                );
              })}
            </div>
          </div>

          {myOpen.length > 0 && (
            <button type="button" onClick={() => { setTab('journal'); setReplyFor(myOpen[0].id); }} className="relative z-10 mx-4 mb-2 flex shrink-0 items-center gap-2.5 rounded-2xl border border-amber-400/50 bg-amber-500/15 px-3 py-2.5 text-left shadow-lg shadow-amber-500/10 backdrop-blur-xl">
              <span className="relative grid h-8 w-8 shrink-0 place-items-center rounded-full bg-amber-400 text-slate-950"><MessageSquareWarning className="h-4 w-4" /><span className="cos-ping absolute inset-0 rounded-full bg-amber-400/60" /></span>
              <span className="min-w-0 flex-1"><span className="block text-[12px] font-semibold text-amber-100">{myOpen.length} clarification{myOpen.length > 1 ? 's' : ''} from Sarah Okafor{myOpen.some((l) => l.escalatedAt) ? ' · overdue' : ''}</span><span className="block truncate text-[11px] text-amber-200/80">{residentById(myOpen[0].residentId).first}: {myOpen[0].thread[myOpen[0].thread.length - 1]?.text}</span></span>
              <span className="shrink-0 rounded-full bg-amber-400 px-2.5 py-1 text-[11px] font-bold text-slate-950">Reply</span>
            </button>
          )}
          {!state.online && (
            <div className="relative z-10 mx-4 mb-2 flex shrink-0 items-center gap-2 rounded-xl border border-amber-400/30 bg-amber-500/10 px-3 py-1.5 text-[11px] text-amber-200">
              <CloudOff className="h-3.5 w-3.5" aria-hidden /> Offline. {state.queue.length} record{state.queue.length === 1 ? '' : 's'} stored in the encrypted outbox.
            </div>
          )}

          <div className="relative z-10 min-h-0 flex-1" style={large ? { zoom: 1.14 } : undefined}>
            {tab === 'journal' && <JournalTab state={state} now={now} resident={resident} act={act} notify={notify} onReply={setReplyFor} onReport={() => setShowReport(true)} />}
            {tab === 'emar' && <EmarTab state={state} now={now} resident={resident} act={act} notify={notify} />}
            {tab === 'plan' && <PlanTab state={state} now={now} resident={resident} act={act} notify={notify} />}
            {tab === 'handover' && <HandoverTab state={state} now={now} resident={resident} act={act} onReport={() => setShowReport(true)} />}
          </div>

          <nav className="relative z-20 grid shrink-0 grid-cols-4 border-t border-white/10 bg-slate-950/70 px-2 pb-5 pt-2 backdrop-blur-xl" aria-label="Worker app">
            {tabs.map((t) => (
              <button key={t.id} type="button" onClick={() => setTab(t.id)} aria-current={tab === t.id ? 'page' : undefined} className={`relative flex flex-col items-center gap-1 rounded-xl py-1.5 text-[11px] font-medium transition ${tab === t.id ? 'text-teal-200' : 'text-slate-400 hover:text-slate-200'}`}>
                <span className={`grid h-8 w-12 place-items-center rounded-full transition ${tab === t.id ? 'bg-teal-400/15' : ''}`}><t.icon className="h-[18px] w-[18px]" aria-hidden /></span>
                {t.label}
                {t.badge ? <span className={`tnum absolute right-3 top-0.5 grid h-4 min-w-4 place-items-center rounded-full px-1 text-[10px] font-bold ${t.badgeTone}`}>{t.badge}</span> : null}
              </button>
            ))}
          </nav>

          <SosOverlay state={state} now={now} act={act} notify={notify} />
          {replyFor && <ClarificationReplySheet state={state} logId={replyFor} now={now} act={act} notify={notify} onClose={() => setReplyFor(null)} />}
          {showReport && <ShiftReportSheet state={state} now={now} act={act} notify={notify} onClose={() => setShowReport(false)} />}
          </MeCtx.Provider>) : <LockScreen now={now} act={act} notify={notify} />}
        </div>
      </div>
    </div>
  );
}

function SosButton({ state, now, residentId, act, notify }: { state: State; now: number; residentId: string; act: Act; notify: Notify }) {
  const me = useMe();
  const [holdStart, setHoldStart] = useState<number | null>(null);
  const [progress, setProgress] = useState(0);
  const fired = useRef(false);
  const live = state.sos && (state.sos.status === 'active' || state.sos.status === 'acknowledged');
  const fire = useCallback(() => {
    if (fired.current) return;
    fired.current = true;
    const r = residentById(residentId);
    act({ type: 'RAISE_SOS', sos: { id: uid('SOS'), raisedAt: now, worker: me.name, residentId, location: `${r.location} · beacon 2F-${r.room.slice(-1)}`, status: 'active' } }, 'worker');
    notify('Silent SOS sent to on-site team and manager', 'red', 'worker');
  }, [act, notify, now, residentId, me.name]);
  useEffect(() => {
    if (holdStart === null) return undefined;
    const i = window.setInterval(() => {
      const p = (Date.now() - holdStart) / 1200;
      setProgress(clamp(p, 0, 1));
      if (p >= 1) { window.clearInterval(i); fire(); setHoldStart(null); setProgress(0); }
    }, 30);
    return () => window.clearInterval(i);
  }, [holdStart, fire]);
  const begin = () => { if (live) return; fired.current = false; setHoldStart(Date.now()); };
  const end = () => { setHoldStart(null); setProgress(0); };
  return (
    <button
      type="button"
      onPointerDown={begin} onPointerUp={end} onPointerLeave={end} onPointerCancel={end}
      onKeyDown={(e) => { if ((e.key === 'Enter' || e.key === ' ') && !e.repeat) { e.preventDefault(); begin(); } }}
      onKeyUp={(e) => { if (e.key === 'Enter' || e.key === ' ') end(); }}
      aria-label="Silent team SOS. Press and hold for one second."
      className={`relative flex shrink-0 select-none items-center gap-1.5 overflow-hidden rounded-full border px-3 py-2 text-[12px] font-bold tracking-wide transition ${live ? 'border-red-300 bg-red-500 text-white' : 'border-red-400/60 bg-red-500/20 text-red-100 hover:bg-red-500/30'}`}
      style={{ touchAction: 'none' }}
    >
      <span className="absolute inset-y-0 left-0 bg-red-500/70" style={{ width: `${progress * 100}%` }} aria-hidden />
      {!live && <span className="cos-ping absolute inset-0 rounded-full border border-red-400/60" aria-hidden />}
      <Siren className="relative h-4 w-4" aria-hidden />
      <span className="relative">{live ? 'SOS LIVE' : progress > 0 ? 'HOLD' : 'SOS'}</span>
    </button>
  );
}

function SosOverlay({ state, now, act, notify }: { state: State; now: number; act: Act; notify: Notify }) {
  const [minimised, setMinimised] = useState(false);
  const sos = state.sos;
  useEffect(() => { if (sos?.status === 'active') setMinimised(false); }, [sos?.id, sos?.status]);
  if (!sos) return null;
  if (minimised) {
    return (
      <button type="button" onClick={() => setMinimised(false)} className="absolute left-1/2 top-12 z-50 flex -translate-x-1/2 items-center gap-2 rounded-full border border-red-300/60 bg-red-600 px-3 py-1.5 text-[11px] font-bold text-white shadow-lg shadow-red-900/50">
        <span className="h-2 w-2 rounded-full bg-white cos-ping" /> SOS {sos.status === 'acknowledged' ? `· ${sos.responder} responding` : '· sent'}
      </button>
    );
  }
  return (
    <div className="absolute inset-0 z-50 flex flex-col bg-[#1a0b10]/95 px-6 pb-8 pt-16 text-center backdrop-blur-xl cos-fade" role="alertdialog" aria-label="Silent SOS active">
      <div className="relative mx-auto mt-4 grid h-28 w-28 place-items-center">
        <span className="cos-ping absolute inset-0 rounded-full bg-red-500/40" />
        <span className="cos-ping absolute inset-3 rounded-full bg-red-500/30" style={{ animationDelay: '.5s' }} />
        <span className="relative grid h-20 w-20 place-items-center rounded-full bg-red-500 shadow-2xl shadow-red-500/40"><Siren className="h-9 w-9 text-white" aria-hidden /></span>
      </div>
      <h3 className="cos-display mt-6 text-xl font-bold text-white">Silent alert sent</h3>
      <p className="mt-1 text-sm text-red-100/80">No sound plays on any device near {residentById(sos.residentId).first}.</p>
      <div className="mt-5 space-y-2 rounded-2xl border border-white/10 bg-white/[0.05] p-4 text-left text-[13px]">
        <p className="flex items-center gap-2 text-slate-200"><MapPin className="h-4 w-4 text-red-300" aria-hidden />{sos.location}</p>
        <p className="flex items-center gap-2 text-slate-200"><Clock className="h-4 w-4 text-red-300" aria-hidden /><span className="tnum">Raised {fmtS(sos.raisedAt)} · {fmtDur(now - sos.raisedAt)} ago</span></p>
        <p className="flex items-center gap-2 text-slate-200"><Users className="h-4 w-4 text-red-300" aria-hidden />Amina Kamara, Tomasz Nowak, Sarah Okafor notified</p>
      </div>
      <div className={`mt-3 rounded-2xl border p-4 text-left text-[13px] ${sos.status === 'acknowledged' ? 'border-emerald-400/40 bg-emerald-500/10 text-emerald-100' : 'border-amber-400/40 bg-amber-500/10 text-amber-100'}`}>
        {sos.status === 'acknowledged'
          ? <p className="flex items-center gap-2 font-semibold"><CheckCircle2 className="h-4 w-4" aria-hidden />{sos.responder} is on the way. Manager acknowledged at <span className="tnum">{fmt(sos.ackAt ?? now)}</span>.</p>
          : <p className="flex items-center gap-2 font-semibold"><span className="h-4 w-4 rounded-full border-2 border-amber-200 border-t-transparent cos-spin" aria-hidden />Waiting for the manager to dispatch help</p>}
      </div>
      <div className="mt-auto grid grid-cols-2 gap-2">
        <button type="button" className={btn.ghostDark} onClick={() => setMinimised(true)}>Minimise</button>
        <button type="button" className="inline-flex items-center justify-center gap-2 rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-slate-900 hover:bg-slate-100" onClick={() => { act({ type: 'CANCEL_SOS', now }, 'worker'); notify('SOS cancelled, marked safe', 'emerald', 'worker'); }}>
          <ShieldCheck className="h-4 w-4" aria-hidden />I'm safe, cancel
        </button>
      </div>
    </div>
  );
}

function JournalTab({ state, now, resident, act, notify, onReply, onReport }: { state: State; now: number; resident: Resident; act: Act; notify: Notify; onReply: (id: string) => void; onReport: () => void }) {
  const me = useMe();
  const [scope, setScope] = useState<'resident' | 'all'>('resident');
  const [consentGate, setConsentGate] = useState(false);
  const [outsideAck, setOutsideAck] = useState<Record<string, boolean>>({});
  const [bodyMapFor, setBodyMapFor] = useState<'new' | 'draft' | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [transcribing, setTranscribing] = useState(false);
  const [typing, setTyping] = useState(false);
  const [typed, setTyped] = useState('');
  const [attachSheet, setAttachSheet] = useState<'new' | 'draft' | null>(null);
  const scriptIdx = useRef<Record<string, number>>({});
  const recorder = useRecorder(60, () => finishRecording());

  function finishRecording() {
    const secs = recorder.stop();
    setTranscribing(true);
    const list = NOTE_SCRIPTS[resident.id];
    const i = scriptIdx.current[resident.id] ?? 0;
    scriptIdx.current[resident.id] = (i + 1) % list.length;
    const sc = list[i];
    window.setTimeout(() => {
      setTranscribing(false);
      setDraft({ text: sc.text, source: 'voice', durationSec: Math.max(secs, 3), accent: sc.accent, confidence: sc.confidence, attachments: [], removed: [] });
    }, 1100);
  }

  const logs = state.logs.filter((l) => scope === 'all' || l.residentId === resident.id).sort((a, b) => b.time - a.time);
  const myOpen = state.logs.filter((l) => l.author === me.name && l.status === 'clarification');
  const startRecording = () => {
    if (resident.legal.voiceConsent.status === 'declined-in-room' && !outsideAck[resident.id]) { setConsentGate(true); return; }
    recorder.start();
  };
  const preview = typed.trim().length > 3 ? parseNote(typed) : null;
  const remaining = 60 - recorder.elapsed;
  const accentHint = NOTE_SCRIPTS[resident.id][scriptIdx.current[resident.id] ?? 0].accent;

  return (
    <div className="flex h-full flex-col">
      <div className="cos-scroll min-h-0 flex-1 space-y-3 overflow-y-auto px-4 pb-44">
        {myOpen.map((l) => (
          <div key={l.id} className="rounded-2xl border border-amber-400/40 bg-amber-500/10 p-3 backdrop-blur-xl">
            <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-amber-300"><MessageSquareWarning className="h-3.5 w-3.5" aria-hidden />Manager clarification · {residentById(l.residentId).first}</p>
            <p className="mt-1.5 text-[13px] text-amber-50">{l.thread[l.thread.length - 1]?.text}</p>
            <p className="mt-1.5 rounded-lg bg-black/20 px-2 py-1 text-[11px] text-amber-100/70">Your entry at <span className="tnum">{fmt(l.time)}</span>: "{truncate(firstLine(l.text), 70)}"</p>
            {(() => { const q = [...l.thread].reverse().find((m) => m.from === 'manager'); if (!q) return null; const due = q.time + CLARIFY_SLA_MIN * MIN; return <p className={`mt-1.5 flex items-center gap-1.5 text-[11px] font-semibold ${l.escalatedAt ? 'text-red-300' : 'text-amber-200'}`}><Timer className="h-3.5 w-3.5" aria-hidden />{l.escalatedAt ? `Overdue since ${fmt(due)}. Escalated to the deputy manager.` : `Reply due by ${fmt(due)} (${fmtDur(due - now)} left)`}</p>; })()}
            <div className="mt-2.5 grid grid-cols-2 gap-2">
              <button type="button" onClick={() => onReply(l.id)} className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-amber-400 px-3 py-2 text-[12px] font-bold text-slate-950 hover:bg-amber-300"><Mic className="h-3.5 w-3.5" aria-hidden />Voice reply</button>
              <button type="button" onClick={() => onReply(l.id)} className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-amber-300/40 bg-white/5 px-3 py-2 text-[12px] font-semibold text-amber-100 hover:bg-white/10"><Keyboard className="h-3.5 w-3.5" aria-hidden />Quick text</button>
            </div>
          </div>
        ))}

        <div className="flex items-center justify-between pt-1">
          <h2 className="cos-display text-[15px] font-semibold text-white">Care timeline</h2>
          <div className="flex rounded-full border border-white/10 bg-white/[0.04] p-0.5 text-[11px]">
            {(['resident', 'all'] as const).map((sc) => (
              <button key={sc} type="button" onClick={() => setScope(sc)} className={`rounded-full px-2.5 py-1 font-medium transition ${scope === sc ? 'bg-teal-400/20 text-teal-100' : 'text-slate-400 hover:text-slate-200'}`}>{sc === 'resident' ? resident.first : 'All'}</button>
            ))}
          </div>
        </div>

        <ol className="relative space-y-2.5 border-l border-white/10 pl-4">
          {logs.map((l) => {
            const Icon = SOURCE_ICON[l.source];
            const st = STATUS_META[l.status];
            return (
              <li key={l.id} className="relative">
                <span className={`absolute -left-[22px] top-3 h-3 w-3 rounded-full border-2 border-[#0B1424] ${l.status === 'approved' ? 'bg-emerald-400' : l.status === 'clarification' ? 'bg-amber-400' : l.status === 'rejected' ? 'bg-red-500' : 'bg-slate-500'}`} />
                <div className="rounded-2xl border border-white/10 bg-white/[0.045] p-3 backdrop-blur-xl">
                  <div className="flex items-center gap-2 text-[11px] text-slate-400">
                    <span className="tnum font-semibold text-slate-200">{fmt(l.time)}</span>
                    <Icon className="h-3.5 w-3.5 text-teal-300" aria-label={l.source} />
                    {scope === 'all' && <span className="text-slate-300">{residentById(l.residentId).first}</span>}
                    <span className="truncate">{l.author}</span>
                    {!l.synced && <CloudOff className="h-3 w-3 text-amber-300" aria-label="Waiting to sync" />}
                    <span className="ml-auto"><Chip tone={st.tone}>{l.status === 'approved' ? <><Lock className="h-3 w-3" aria-hidden />Signed</> : st.label}</Chip></span>
                  </div>
                  <p className="mt-1.5 whitespace-pre-line text-[13px] leading-5 text-slate-100">{l.text}</p>
                  <div className="mt-2"><TagChips tags={l.tags} surface="dark" risk={l.risk && l.status !== 'approved'} riskReasons={l.riskReasons} compact /></div>
                  {l.attachments.length > 0 && <div className="mt-2 grid gap-1.5">{l.attachments.map((a) => <AttachmentThumb key={a.id} a={a} surface="dark" />)}</div>}
                </div>
              </li>
            );
          })}
        </ol>

        <button type="button" onClick={onReport} className="flex w-full items-center gap-3 rounded-2xl border border-teal-300/30 bg-gradient-to-r from-teal-500/20 to-cyan-500/10 p-3.5 text-left shadow-lg shadow-teal-500/10 transition hover:from-teal-500/30">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-teal-400 text-slate-950"><Sparkles className="h-5 w-5" aria-hidden /></span>
          <span className="min-w-0 flex-1"><span className="block text-[13px] font-semibold text-white">Synthesize 12-hour shift log</span><span className="block text-[11px] text-teal-100/70">{state.logs.length} micro-notes into a CQC daily report and night handover</span></span>
          {state.report ? <Chip tone={state.report.status === 'signed' ? 'emerald' : 'cyan'}>{state.report.status === 'signed' ? 'Signed' : 'Submitted'}</Chip> : <ChevronRight className="h-4 w-4 text-teal-200" aria-hidden />}
        </button>
      </div>

      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 px-4 pb-3">
        {typing ? (
          <div className="pointer-events-auto rounded-3xl border border-white/15 bg-slate-900/90 p-3 shadow-2xl backdrop-blur-xl cos-rise">
            <label htmlFor="typed-note" className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Quick note for {resident.first}</label>
            <textarea id="typed-note" value={typed} maxLength={600} onChange={(e) => setTyped(e.target.value)} rows={3} placeholder="e.g. Had a cuppa, about 200 mls, ate half his lunch, calm" className="mt-1.5 w-full resize-none rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-[13px] text-white placeholder:text-slate-500 focus:border-teal-400/60 focus:outline-none" />
            {preview && <div className="mt-2"><p className="mb-1 flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-teal-300"><Sparkles className="h-3 w-3" aria-hidden />Live extraction</p><TagChips tags={preview.tags} surface="dark" risk={preview.risk} riskReasons={preview.riskReasons} compact /></div>}
            <div className="mt-2.5 grid grid-cols-2 gap-2">
              <button type="button" className={btn.ghostDark} onClick={() => { setTyping(false); setTyped(''); }}>Cancel</button>
              <button type="button" className={btn.primaryDark} disabled={typed.trim().length < 4} onClick={() => { setDraft({ text: typed.trim(), source: 'text', attachments: [], removed: [] }); setTyping(false); setTyped(''); }}>Review</button>
            </div>
          </div>
        ) : recorder.recording || transcribing ? (
          <div className="pointer-events-auto flex items-center gap-3 rounded-3xl border border-teal-300/30 bg-slate-900/90 p-3 shadow-2xl shadow-teal-500/20 backdrop-blur-xl cos-rise">
            <Ring size={58} stroke={4} progress={transcribing ? 1 : recorder.elapsed / 60} color={remaining < 10 ? '#F59E0B' : '#14B8A6'} track="rgba(255,255,255,.1)">
              {transcribing ? <span className="h-5 w-5 rounded-full border-2 border-teal-300 border-t-transparent cos-spin" aria-hidden /> : <span className="tnum text-[13px] font-bold text-white">{Math.ceil(remaining)}</span>}
            </Ring>
            <div className="min-w-0 flex-1">
              <Wave active={recorder.recording} bars={22} />
              <p className="mt-0.5 truncate text-[11px] text-slate-300">{transcribing ? 'Transcribing and extracting clinical tags…' : `Listening · ${accentHint} model`}</p>
            </div>
            <button type="button" disabled={transcribing} onClick={finishRecording} className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-red-500 text-white shadow-lg shadow-red-500/40 hover:bg-red-400 disabled:opacity-40" aria-label="Stop and transcribe"><Square className="h-5 w-5 fill-white" /></button>
          </div>
        ) : (
          <div className="pointer-events-auto flex items-end justify-between">
            <div className="flex gap-2">
              <button type="button" onClick={() => setTyping(true)} className="grid h-11 w-11 place-items-center rounded-2xl border border-white/15 bg-slate-900/80 text-slate-200 shadow-lg backdrop-blur-xl hover:bg-slate-800" aria-label="Type a note"><Keyboard className="h-5 w-5" /></button>
              <button type="button" onClick={() => setAttachSheet('new')} className="grid h-11 w-11 place-items-center rounded-2xl border border-white/15 bg-slate-900/80 text-slate-200 shadow-lg backdrop-blur-xl hover:bg-slate-800" aria-label="Attach a photo"><Camera className="h-5 w-5" /></button>
            </div>
            <div className="flex flex-col items-center gap-1">
              <button type="button" onClick={startRecording} className="group relative grid h-[72px] w-[72px] place-items-center rounded-full border border-white/25 bg-gradient-to-b from-teal-300/90 to-teal-600/90 text-slate-950 shadow-2xl shadow-teal-500/40 backdrop-blur-xl transition active:scale-95" aria-label={`Record a voice note for ${resident.first}`}>
                <span className="cos-ping absolute inset-0 rounded-full border-2 border-teal-300/50" aria-hidden />
                <span className="absolute inset-1 rounded-full bg-gradient-to-b from-white/40 to-transparent" aria-hidden />
                <Mic className="relative h-7 w-7" aria-hidden />
              </button>
              <span className="rounded-full bg-slate-950/70 px-2 text-[10px] text-slate-300">15 to 60 s note</span>
            </div>
          </div>
        )}
      </div>

      {consentGate && (
        <PhoneSheet title="Voice consent" icon={ShieldCheck} onClose={() => setConsentGate(false)}>
          <p className="rounded-2xl border border-amber-400/30 bg-amber-500/10 p-3 text-[13px] text-amber-50">{resident.first} {resident.legal.voiceConsent.detail.charAt(0).toLowerCase() + resident.legal.voiceConsent.detail.slice(1)}</p>
          <p className="mt-2 text-[12px] text-slate-400">Recording is press-to-talk only. CarePlanOS never listens in the background.</p>
          <div className="mt-4 grid gap-2">
            <button type="button" className={btn.primaryDark} onClick={() => { setOutsideAck((o) => ({ ...o, [resident.id]: true })); setConsentGate(false); recorder.start(); }}><Mic className="h-4 w-4" aria-hidden />I am outside the room, record</button>
            <button type="button" className={btn.ghostDark} onClick={() => { setConsentGate(false); setTyping(true); }}><Keyboard className="h-4 w-4" aria-hidden />Type the note instead</button>
          </div>
        </PhoneSheet>
      )}
      {bodyMapFor && <BodyMapSheet resident={resident} onClose={() => setBodyMapFor(null)} onSave={(a, text) => {
        if (bodyMapFor === 'draft' && draft) setDraft({ ...draft, attachments: [...draft.attachments, a], text: `${draft.text} ${text}` });
        else setDraft({ text, source: 'photo', attachments: [a], removed: [] });
        setBodyMapFor(null);
      }} />}
      {draft && <ReviewSheet draft={draft} setDraft={setDraft} resident={resident} now={now} state={state} act={act} notify={notify} onAttach={() => setAttachSheet('draft')} />}
      {attachSheet && (
        <PhoneSheet title="Attach a photo" icon={Camera} onClose={() => setAttachSheet(null)}>
          <p className="mb-3 text-[12px] text-slate-400">Photos stay inside CarePlanOS, encrypted, and never reach the camera roll.</p>
          <div className="grid grid-cols-2 gap-2">
            {(Object.keys(ATTACH_META) as AttachmentKind[]).map((k) => {
              const m = ATTACH_META[k];
              return (
                <button key={k} type="button" onClick={() => {
                  if (k === 'skin') { setBodyMapFor(attachSheet); setAttachSheet(null); return; }
                  const a: Attachment = { id: uid('ATT'), kind: k, label: m.label, detail: m.detail };
                  if (attachSheet === 'draft' && draft) setDraft({ ...draft, attachments: [...draft.attachments, a], text: k === 'meal' && !/%/.test(draft.text) ? `${draft.text} Plate photo shows about 60% eaten.` : draft.text });
                  else setDraft({ text: m.note.replace('the meal', `${resident.first}'s meal`), source: 'photo', attachments: [a], removed: [] });
                  setAttachSheet(null);
                }} className="flex flex-col items-start gap-2 rounded-2xl border border-white/10 bg-white/[0.05] p-3 text-left hover:border-teal-300/40 hover:bg-teal-400/10">
                  <span className="grid h-9 w-9 place-items-center rounded-xl bg-teal-400/15 text-teal-200"><m.icon className="h-4 w-4" aria-hidden /></span>
                  <span className="text-[12px] font-semibold leading-4 text-white">{m.label}</span>
                </button>
              );
            })}
          </div>
        </PhoneSheet>
      )}
    </div>
  );
}

function ReviewSheet({ draft, setDraft, resident, now, state, act, notify, onAttach }: { draft: Draft; setDraft: (d: Draft | null) => void; resident: Resident; now: number; state: State; act: Act; notify: Notify; onAttach: () => void }) {
  const me = useMe();
  const parsed = useMemo(() => parseNote(draft.text), [draft.text]);
  const [showOriginal, setShowOriginal] = useState(false);
  const tags: Tags = { ...parsed.tags };
  if (draft.removed.includes('fluid')) delete tags.fluidMl;
  if (draft.removed.includes('meal')) delete tags.mealPct;
  if (draft.removed.includes('mood')) delete tags.mood;
  const tagRows: Array<{ key: string; label: string; value: string; icon: React.ElementType }> = [];
  if (parsed.tags.fluidMl) tagRows.push({ key: 'fluid', label: 'Fluid intake', value: `${parsed.tags.fluidMl} ml${parsed.tags.fluidEstimated ? ' (estimated from container)' : ''}`, icon: Droplets });
  if (parsed.tags.mealPct !== undefined) tagRows.push({ key: 'meal', label: 'Meal eaten', value: `${parsed.tags.mealLabel ?? 'Meal'} · ${parsed.tags.mealPct}%`, icon: Utensils });
  if (parsed.tags.mood) tagRows.push({ key: 'mood', label: 'Mood', value: parsed.tags.mood, icon: HeartHandshake });

  const save = () => {
    const entry = makeLog({ residentId: resident.id, time: now, text: draft.text, source: draft.source, durationSec: draft.durationSec, accent: draft.accent, confidence: draft.confidence, attachments: draft.attachments, author: me });
    entry.tags = { ...entry.tags, fluidMl: tags.fluidMl, mealPct: tags.mealPct, mood: tags.mood };
    act({ type: 'ADD_LOG', entry, actor: me }, 'worker');
    notify(state.online ? `Note saved for ${resident.first} and synced to manager` : `Note saved offline for ${resident.first}`, state.online ? 'emerald' : 'amber', 'worker');
    setDraft(null);
  };

  return (
    <PhoneSheet title={draft.source === 'voice' ? 'Voice note transcribed' : draft.source === 'photo' ? 'Photo note' : 'Review note'} icon={Sparkles} onClose={() => setDraft(null)}>
      {draft.source === 'voice' && (
        <div className="mb-3 flex flex-wrap items-center gap-1.5 text-[11px]">
          <Chip tone="teal" icon={AudioLines}><span className="tnum">{draft.durationSec}s audio</span></Chip>
          <Chip tone="cyan" icon={Sparkles}>{draft.accent} · <span className="tnum">{draft.confidence}%</span></Chip>
          <Chip icon={Lock}>Audio encrypted on device</Chip>
        </div>
      )}
      <label htmlFor="draft-text" className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">{showOriginal ? 'Original transcript' : 'Care note (edit if needed)'}</label>
      {showOriginal
        ? <p className="mt-1.5 rounded-xl border border-white/10 bg-black/30 p-3 text-[13px] leading-5 text-slate-300">{draft.text}</p>
        : <textarea id="draft-text" value={parsed.normalised} maxLength={800} rows={5} onChange={(e) => setDraft({ ...draft, text: e.target.value })} className="mt-1.5 w-full resize-none rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-[13px] leading-5 text-white focus:border-teal-400/60 focus:outline-none" />}
      {parsed.dialect.length > 0 && (
        <button type="button" onClick={() => setShowOriginal((v) => !v)} className="mt-2 flex w-full items-center gap-2 rounded-xl border border-cyan-400/20 bg-cyan-500/10 px-3 py-2 text-left text-[11px] text-cyan-100">
          <Sparkles className="h-3.5 w-3.5 shrink-0" aria-hidden /><span className="flex-1">Accent-tolerant normalisation: {parsed.dialect.join(', ')}</span><span className="font-semibold underline underline-offset-2">{showOriginal ? 'Show note' : 'Show original'}</span>
        </button>
      )}

      <p className="mt-2 flex items-center gap-1.5 text-[11px] text-slate-500"><ShieldCheck className="h-3.5 w-3.5 text-teal-400" aria-hidden />The AI only restructures what you said. It never adds facts. You confirm every note.</p>
      <p className="mb-2 mt-4 text-[11px] font-semibold uppercase tracking-wider text-slate-400">Extracted clinical data</p>
      <div className="space-y-1.5">
        {tagRows.map((r) => {
          const off = draft.removed.includes(r.key);
          return (
            <div key={r.key} className={`flex items-center gap-2.5 rounded-xl border px-3 py-2 ${off ? 'border-white/5 bg-white/[0.02] opacity-50' : 'border-white/10 bg-white/[0.05]'}`}>
              <r.icon className="h-4 w-4 shrink-0 text-teal-300" aria-hidden />
              <span className="w-20 shrink-0 text-[11px] text-slate-400">{r.label}</span>
              <span className={`tnum flex-1 text-[13px] font-semibold text-white ${off ? 'line-through' : ''}`}>{r.value}</span>
              <button type="button" onClick={() => setDraft({ ...draft, removed: off ? draft.removed.filter((x) => x !== r.key) : [...draft.removed, r.key] })} className="text-[11px] font-semibold text-slate-400 hover:text-white">{off ? 'Restore' : 'Remove'}</button>
            </div>
          );
        })}
        {!tagRows.length && <p className="text-[12px] text-slate-500">No fluid, meal or mood data found in this note.</p>}
      </div>
      <div className="mt-2"><TagChips tags={{ personalCare: parsed.tags.personalCare, behaviour: parsed.tags.behaviour, activity: parsed.tags.activity, pain: parsed.tags.pain, med: parsed.tags.med }} surface="dark" /></div>
      {parsed.risk && (
        <div className="mt-3 flex gap-2 rounded-xl border border-red-400/30 bg-red-500/10 p-3 text-[12px] text-red-100">
          <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden /><span>AI risk flag: {parsed.riskReasons.join(', ')}. This note goes to the manager's priority queue.</span>
        </div>
      )}
      <div className="mt-3 flex flex-wrap items-center gap-1.5"><span className="text-[11px] text-slate-400">CQC:</span>{parsed.cqc.map((d) => <Chip key={d} tone="teal">{d}</Chip>)}</div>

      <div className="mt-4 space-y-1.5">
        {draft.attachments.map((a) => <AttachmentThumb key={a.id} a={a} surface="dark" />)}
        <button type="button" onClick={onAttach} className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-white/15 py-2 text-[12px] font-semibold text-slate-300 hover:bg-white/[0.04]"><Camera className="h-4 w-4" aria-hidden />Attach photo</button>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2">
        <button type="button" className={btn.ghostDark} onClick={() => setDraft(null)}>Discard</button>
        <button type="button" className={btn.primaryDark} onClick={save} disabled={parsed.normalised.trim().length < 3}><Check className="h-4 w-4" aria-hidden />Save to timeline</button>
      </div>
    </PhoneSheet>
  );
}

function ClarificationReplySheet({ state, logId, now, act, notify, onClose }: { state: State; logId: string; now: number; act: Act; notify: Notify; onClose: () => void }) {
  const me = useMe();
  const log = state.logs.find((l) => l.id === logId);
  const [text, setText] = useState('');
  const [voiceSecs, setVoiceSecs] = useState<number | null>(null);
  const [transcribing, setTranscribing] = useState(false);
  const rec = useRecorder(30, () => stopVoice());
  function stopVoice() {
    const s = rec.stop();
    setTranscribing(true);
    window.setTimeout(() => { setTranscribing(false); setVoiceSecs(Math.max(s, 8)); if (log) setText(suggestReply(log)); }, 900);
  }
  if (!log || log.status !== 'clarification') {
    return <PhoneSheet title="Clarification" onClose={onClose}><p className="text-sm text-slate-300">This clarification has been answered.</p></PhoneSheet>;
  }
  const q = log.thread[log.thread.length - 1];
  const send = () => {
    act({ type: 'REPLY_CLARIFICATION', logId, msg: { id: uid('MSG'), from: 'worker', author: me.name, time: now, text: text.trim(), mode: voiceSecs ? 'voice' : 'text', durationSec: voiceSecs ?? undefined } }, 'worker');
    notify('Reply sent. Care record updated with an audit stamp.', 'emerald', 'worker');
    onClose();
  };
  return (
    <PhoneSheet title="Reply to Sarah Okafor" icon={MessageSquareWarning} onClose={onClose}>
      <div className="rounded-2xl border border-amber-400/30 bg-amber-500/10 p-3">
        <p className="text-[11px] text-amber-300"><span className="tnum">{fmt(q.time)}</span> · Registered Manager · High priority</p>
        <p className="mt-1 text-[13px] text-amber-50">{q.text}</p>
      </div>
      <p className="mt-2 rounded-xl bg-white/[0.04] px-3 py-2 text-[12px] text-slate-400">Your entry at <span className="tnum">{fmt(log.time)}</span> for {residentById(log.residentId).first}: "{firstLine(log.text)}"</p>

      <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.04] p-3">
        <div className="flex items-center gap-3">
          <Ring size={52} stroke={4} progress={rec.recording ? rec.elapsed / 30 : voiceSecs ? 1 : 0} color="#F59E0B" track="rgba(255,255,255,.1)">
            {rec.recording ? <span className="tnum text-xs font-bold text-white">{Math.ceil(30 - rec.elapsed)}</span> : transcribing ? <span className="h-4 w-4 rounded-full border-2 border-amber-300 border-t-transparent cos-spin" /> : <Mic className="h-5 w-5 text-amber-300" aria-hidden />}
          </Ring>
          <div className="min-w-0 flex-1"><Wave active={rec.recording} bars={18} className="bg-amber-300" /><p className="text-[11px] text-slate-400">{rec.recording ? 'Recording, up to 30 seconds' : voiceSecs ? `Voice reply captured · ${voiceSecs}s` : 'One-tap 30-second voice reply'}</p></div>
          {rec.recording
            ? <button type="button" onClick={stopVoice} className="grid h-11 w-11 place-items-center rounded-full bg-red-500 text-white" aria-label="Stop recording"><Square className="h-4 w-4 fill-white" /></button>
            : <button type="button" onClick={() => { setVoiceSecs(null); rec.start(); }} disabled={transcribing} className="grid h-11 w-11 place-items-center rounded-full bg-amber-400 text-slate-950 disabled:opacity-40" aria-label="Record voice reply"><Mic className="h-5 w-5" /></button>}
        </div>
      </div>

      <label htmlFor="reply-text" className="mt-4 block text-[11px] font-semibold uppercase tracking-wider text-slate-400">{voiceSecs ? 'Transcript (edit if needed)' : 'Or type a quick reply'}</label>
      <textarea id="reply-text" value={text} maxLength={600} onChange={(e) => setText(e.target.value)} rows={4} className="mt-1.5 w-full resize-none rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-[13px] leading-5 text-white focus:border-amber-400/60 focus:outline-none" placeholder="Add the detail the manager asked for" />
      <div className="mt-2 flex flex-wrap gap-1.5">
        {['Pharmacist informed, advised re-offer at tea.', 'GP informed by phone.', 'Body map completed.', 'Family informed by phone.'].map((c) => (
          <button key={c} type="button" onClick={() => setText((t) => (t ? `${t} ${c}` : c))} className="rounded-full border border-white/10 bg-white/[0.05] px-2.5 py-1 text-[11px] text-slate-300 hover:bg-white/10">{c}</button>
        ))}
      </div>
      <button type="button" className={`${btn.primaryDark} mt-4 w-full`} disabled={text.trim().length < 6 || rec.recording} onClick={send}><Send className="h-4 w-4" aria-hidden />Send reply</button>
      <p className="mt-2 text-center text-[11px] text-slate-500">Your original entry is kept. The reply is added with a tamper-evident audit stamp.</p>
    </PhoneSheet>
  );
}

function CooldownRing({ m, now, meds, size = 96 }: { m: Med; now: number; meds: Med[]; size?: number }) {
  const st = prnStatus(m, now, meds);
  const locked = st.lockedUntil !== null && st.lockedUntil > now;
  const maxed = !locked && !!st.reason;
  const prog = locked ? (now - ((st.lockedUntil as number) - 4 * HOUR)) / (4 * HOUR) : 1;
  return (
    <Ring size={size} stroke={7} progress={prog} color={maxed ? '#EF4444' : locked ? '#F59E0B' : '#10B981'} track="rgba(255,255,255,.08)">
      <div className="text-center">
        {maxed ? <Ban className="mx-auto h-5 w-5 text-red-300" aria-hidden /> : locked ? <Lock className="mx-auto h-4 w-4 text-amber-300" aria-hidden /> : <CheckCircle2 className="mx-auto h-5 w-5 text-emerald-300" aria-hidden />}
        <p className={`tnum mt-0.5 text-[13px] font-bold ${maxed ? 'text-red-200' : locked ? 'text-amber-100' : 'text-emerald-100'}`}>{maxed ? 'Daily max' : locked ? fmtDur((st.lockedUntil as number) - now) : 'Ready'}</p>
      </div>
    </Ring>
  );
}

function EmarTab({ state, now, resident, act, notify }: { state: State; now: number; resident: Resident; act: Act; notify: Notify }) {
  const me = useMe();
  const comp = medCompetent(me.name, now);
  const rounds: Round[] = ['Morning', 'Lunch', 'Tea', 'Bedtime', 'PRN'];
  const defaultRound: Round = now >= ROUND_TIME.Tea - HOUR ? 'Tea' : now >= ROUND_TIME.Lunch - HOUR ? 'Lunch' : 'Morning';
  const [round, setRound] = useState<Round>(defaultRound);
  const [scanMed, setScanMed] = useState<string | null>(null);
  const [blocked, setBlocked] = useState<{ med: Med; reason: string } | null>(null);
  const [refuseMed, setRefuseMed] = useState<string | null>(null);
  const meds = state.meds.filter((m) => m.residentId === resident.id && m.round === round);

  const tryPrn = (m: Med) => {
    if (!comp.ok) return;
    const reason = prnBlockReason(m, now, state.meds);
    if (reason) { setBlocked({ med: m, reason }); act({ type: 'PRN_BLOCKED', medId: m.id, now, reason }, 'worker'); notify('Unsafe PRN dose blocked and logged', 'amber', 'worker'); }
    else setScanMed(m.id);
  };

  return (
    <div className="cos-scroll h-full overflow-y-auto px-4 pb-6">
      <div className="mb-3 space-y-1.5">
        <div className="flex items-center gap-2 rounded-2xl border border-red-400/25 bg-red-500/10 px-3 py-2 text-[11px] text-red-100">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" aria-hidden /><span><span className="font-semibold">Allergies:</span> {resident.allergies}</span>
        </div>
        <p className="tnum px-1 text-[11px] text-slate-400">Weight {resident.weightKg} kg · paracetamol limit {thousands(paracetamolLimitMg(resident))} mg in 24 h{resident.weightKg < 50 ? ' (weight-based)' : ''}</p>
      </div>
      {!comp.ok && (
        <div className="mb-3 rounded-2xl border border-red-400/40 bg-red-500/15 p-3 text-[12px] text-red-50" role="alert">
          <p className="flex items-center gap-1.5 font-semibold"><GraduationCap className="h-4 w-4" aria-hidden />Medication competency expired {comp.expiry ? fmtDate(dateMs(comp.expiry)) : ''}</p>
          <p className="mt-1 text-red-100/80">You can read the MAR but cannot administer or record refusals. Ask a competent colleague. This shows on your manager's workforce dashboard.</p>
        </div>
      )}
      <div className="cos-noscroll -mx-4 mb-3 flex gap-1.5 overflow-x-auto px-4" role="tablist" aria-label="Medication round">
        {rounds.map((r) => {
          const c = state.meds.filter((m) => m.residentId === resident.id && m.round === r);
          const open = c.filter((m) => ['due', 'overdue'].includes(medState(m, now))).length;
          return (
            <button key={r} type="button" role="tab" aria-selected={round === r} onClick={() => setRound(r)} className={`flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12px] font-semibold transition ${round === r ? 'border-teal-300/60 bg-teal-400/15 text-teal-100' : 'border-white/10 bg-white/[0.04] text-slate-400 hover:text-slate-200'}`}>
              {r}{r !== 'PRN' && <span className="tnum font-normal text-slate-400">{fmt(ROUND_TIME[r])}</span>}
              {open > 0 && <span className="tnum grid h-4 min-w-4 place-items-center rounded-full bg-teal-400 px-1 text-[10px] font-bold text-slate-950">{open}</span>}
            </button>
          );
        })}
      </div>

      {meds.length === 0 && <p className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 text-center text-[13px] text-slate-400">No {round.toLowerCase()} medicines prescribed for {resident.first}.</p>}
      <div className="space-y-2.5">
        {meds.map((m) => {
          const st = medState(m, now);
          if (m.prn) {
            const p = m.prn;
            const ps = prnStatus(m, now, state.meds);
            const locked = ps.lockedUntil !== null && ps.lockedUntil > now;
            return (
              <div key={m.id} className={`rounded-2xl border p-3.5 backdrop-blur-xl ${ps.reason ? 'border-amber-400/40 bg-amber-500/[0.07] shadow-lg shadow-amber-500/5' : 'border-emerald-400/30 bg-emerald-500/[0.06]'}`}>
                <div className="flex gap-3">
                  <CooldownRing m={m} now={now} meds={state.meds} />
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-semibold leading-5 text-white">{m.name}</p>
                    <p className="text-[11px] text-slate-400">{m.dose} · {m.route} · PRN</p>
                    <div className="mt-1 flex flex-wrap gap-1">{m.stomp && <Chip tone="cyan">STOMP monitored</Chip>}{p.paracetamolMg && <Chip tone="slate">Contains paracetamol</Chip>}</div>
                    <dl className="mt-1.5 grid grid-cols-2 gap-x-2 text-[11px]">
                      <dt className="text-slate-500">Last dose</dt><dd className="tnum text-right text-slate-200">{ps.lastDose ? fmt(ps.lastDose) : 'None today'}</dd>
                      <dt className="text-slate-500">24 h doses</dt><dd className="tnum text-right text-slate-200">{ps.doses24} of {p.maxDoses24h}</dd>
                      <dt className="text-slate-500">Next eligible</dt><dd className="tnum text-right text-slate-200">{locked ? fmt(ps.lockedUntil as number) : ps.reason ? 'Not today' : 'Now'}</dd>
                    </dl>
                  </div>
                </div>
                {ps.paraLimit !== null && (
                  <div className="mt-2.5">
                    <div className="flex justify-between text-[11px] text-slate-400"><span>Paracetamol in 24 h, all products</span><span className="tnum text-slate-200">{thousands(ps.paraUsed ?? 0)} / {thousands(ps.paraLimit)} mg</span></div>
                    <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-white/10"><div className={`h-full rounded-full ${(ps.paraUsed ?? 0) / ps.paraLimit > 0.8 ? 'bg-amber-400' : 'bg-teal-400'}`} style={{ width: `${Math.min(1, (ps.paraUsed ?? 0) / ps.paraLimit) * 100}%` }} /></div>
                    {!ps.reason && ps.maxUnits < p.unitsMax && <p className="mt-1 text-[11px] text-amber-200">Only {ps.maxUnits} {p.unitLabel} allowed now under the daily limit.</p>}
                  </div>
                )}
                {ps.crossNote && <p className="mt-1.5 flex items-start gap-1.5 text-[11px] text-cyan-200"><Link2 className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />{ps.crossNote}</p>}
                {ps.reason && !locked && <p className="mt-1.5 text-[11px] text-red-200">{ps.reason}</p>}
                <p className="mt-2 text-[11px] leading-4 text-slate-400">{m.instructions}</p>
                <button type="button" disabled={!comp.ok} onClick={() => tryPrn(m)} className={`mt-2.5 w-full ${ps.reason ? 'inline-flex items-center justify-center gap-2 rounded-2xl border border-amber-400/50 bg-amber-500/15 px-4 py-2.5 text-sm font-semibold text-amber-100 disabled:opacity-40' : btn.primaryDark}`}>
                  {ps.reason ? <><Lock className="h-4 w-4" aria-hidden />Locked · Administer</> : <><ScanLine className="h-4 w-4" aria-hidden />Scan and administer PRN</>}
                </button>
              </div>
            );
          }
          const tone: Tone = st === 'given' ? 'emerald' : st === 'refused' ? 'amber' : st === 'overdue' ? 'red' : st === 'due' ? 'teal' : 'slate';
          return (
            <div key={m.id} className="rounded-2xl border border-white/10 bg-white/[0.045] p-3.5 backdrop-blur-xl">
              <div className="flex items-start gap-3">
                <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${st === 'given' ? 'bg-emerald-400/15 text-emerald-300' : 'bg-teal-400/10 text-teal-300'}`}><Pill className="h-5 w-5" aria-hidden /></span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2"><p className="text-[13px] font-semibold leading-5 text-white">{m.name}</p><Chip tone={tone}>{st === 'given' ? 'Given' : st === 'refused' ? 'Refused' : st === 'overdue' ? 'Overdue' : st === 'due' ? 'Due now' : 'Scheduled'}</Chip></div>
                  <p className="text-[11px] text-slate-400">{m.dose} · {m.route}</p>
                  <p className="mt-1 text-[11px] leading-4 text-slate-400">{m.instructions}</p>
                </div>
              </div>
              {st === 'given' && <p className="mt-2 flex items-center gap-1.5 text-[11px] text-emerald-200"><CheckCircle2 className="h-3.5 w-3.5" aria-hidden /><span className="tnum">{fmt(m.givenAt ?? now)}</span> by {m.givenBy}{m.witness ? ` · witness ${m.witness}` : ''} · barcode verified</p>}
              {st === 'refused' && <p className="mt-2 flex items-center gap-1.5 text-[11px] text-amber-200"><AlertTriangle className="h-3.5 w-3.5" aria-hidden /><span className="tnum">{fmt(m.givenAt ?? now)}</span> · {m.refusedReason}</p>}
              {st === 'scheduled' && <p className="mt-2 flex items-center gap-1.5 text-[11px] text-slate-400"><Lock className="h-3.5 w-3.5" aria-hidden />Not due until <span className="tnum">{fmt(ROUND_TIME[m.round])}</span>. The round opens <span className="tnum">{fmt(ROUND_TIME[m.round] - HOUR)}</span>.</p>}
              {(st === 'due' || st === 'overdue') && (
                <div className="mt-2.5 grid grid-cols-[1fr_auto] gap-2">
                  <button type="button" disabled={!comp.ok} className={`${btn.primaryDark} py-2.5`} onClick={() => setScanMed(m.id)}><ScanLine className="h-4 w-4" aria-hidden />Scan and administer</button>
                  <button type="button" disabled={!comp.ok} className={`${btn.ghostDark} py-2.5`} onClick={() => setRefuseMed(m.id)}>Refused</button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {scanMed && <ScannerSheet state={state} medId={scanMed} now={now} act={act} notify={notify} onClose={() => setScanMed(null)} />}
      {refuseMed && <RefuseSheet state={state} medId={refuseMed} now={now} act={act} notify={notify} onClose={() => setRefuseMed(null)} />}
      {blocked && (
        <PhoneSheet title="Administration blocked" icon={Lock} onClose={() => setBlocked(null)}>
          <div className="flex flex-col items-center text-center">
            <CooldownRing m={state.meds.find((x) => x.id === blocked.med.id) ?? blocked.med} now={now} meds={state.meds} size={128} />
            <p className="cos-display mt-3 text-lg font-semibold text-white">{blocked.med.name}</p>
            <p className="mt-1 text-[13px] text-amber-100">{blocked.reason}</p>
          </div>
          <div className="mt-4 space-y-2 rounded-2xl border border-white/10 bg-white/[0.04] p-3 text-[12px] leading-5 text-slate-300">
            <p><span className="font-semibold text-white">Why:</span> limits come from the prescription and the PRN protocol. CarePlanOS totals paracetamol across every product, including co-codamol, and applies the 60 mg/kg daily limit for adults under 50 kg. NICE SC1 and NG67 require a written PRN protocol for every as-needed medicine.</p>
            <p><span className="font-semibold text-white">Logged:</span> this attempt is in the audit trail and counts as Safe evidence for your manager.</p>
            <p><span className="font-semibold text-white">If symptoms are severe:</span> contact the senior on duty or NHS 111 for clinical advice. In an emergency call 999.</p>
          </div>
          <button type="button" className={`${btn.primaryDark} mt-4 w-full`} onClick={() => setBlocked(null)}>Understood</button>
        </PhoneSheet>
      )}
    </div>
  );
}

function ScannerSheet({ state, medId, now, act, notify, onClose }: { state: State; medId: string; now: number; act: Act; notify: Notify; onClose: () => void }) {
  const m = state.meds.find((x) => x.id === medId) as Med;
  const r = residentById(m.residentId);
  const [step, setStep] = useState<'identity' | 'scanning' | 'mismatch' | 'verify'>('identity');
  const [doseOk, setDoseOk] = useState(false);
  const [witness, setWitness] = useState('');
  const [pbsSteps, setPbsSteps] = useState<boolean[]>([false, false, false]);
  const [indication, setIndication] = useState(m.prn?.indication ?? '');
  const [voiceTag, setVoiceTag] = useState<string | null>(null);
  const [tagging, setTagging] = useState(false);
  const me = useMe();
  const pst = m.prn ? prnStatus(m, now, state.meds) : null;
  const [units, setUnits] = useState(() => (m.prn ? Math.max(m.prn.unitsMin, Math.min(m.prn.unitsMax, pst?.maxUnits ?? 1)) : 1));
  const decoy = state.meds.find((x) => x.residentId !== m.residentId && !x.prn) as Med;
  const late = !m.prn && now > ROUND_TIME[m.round] + HOUR;

  const scan = (correct: boolean) => {
    setStep('scanning');
    window.setTimeout(() => {
      if (correct) setStep('verify');
      else { setStep('mismatch'); act({ type: 'SCAN_MISMATCH', medId: m.id, now, scanned: `${decoy.name} (GTIN ${decoy.barcode}) prescribed to ${resName(decoy.residentId)}` }, 'worker'); notify('Wrong medicine scanned. Administration blocked.', 'red', 'worker'); }
    }, 1500);
  };
  const ready = doseOk && (!m.requiresWitness || witness) && (!m.stomp || pbsSteps.every(Boolean)) && (!m.prn || (indication.trim().length > 2 && !!pst && !pst.reason && units <= pst.maxUnits));
  const confirm = () => {
    const text = m.prn
      ? `PRN ${m.name}, ${units} ${m.prn.unitLabel}${units > 1 ? 's' : ''}${m.prn.paracetamolMg ? ` (${units * m.prn.paracetamolMg} mg paracetamol)` : ''}, given for ${indication}. Barcode verified.${witness ? ` Witnessed by ${witness}.` : ''}${voiceTag ? ` ${voiceTag}` : ''}`
      : `${m.round} medicine given: ${m.name}, ${m.dose}, ${m.route}. Barcode verified.${witness ? ` Witnessed by ${witness}.` : ''}${voiceTag ? ` ${voiceTag}` : ''}`;
    const log = makeLog({ residentId: m.residentId, time: now, text, source: 'emar', extraTags: { med: true }, author: me });
    act({ type: 'ADMINISTER_MED', medId: m.id, now, witness: witness || undefined, units, log }, 'worker');
    notify(`${m.name.split(' ')[0]} recorded for ${r.first}`, 'emerald', 'worker');
    onClose();
  };

  return (
    <PhoneSheet title="Med-Check" icon={ScanLine} onClose={onClose}>
      <ol className="mb-4 grid grid-cols-3 gap-1.5 text-center text-[10px] font-semibold uppercase tracking-wider">
        {['Identity', 'Scan box', 'Confirm'].map((s, i) => {
          const idx = step === 'identity' ? 0 : step === 'verify' ? 2 : 1;
          return <li key={s} className={`rounded-full py-1 ${i < idx ? 'bg-emerald-500/20 text-emerald-200' : i === idx ? 'bg-teal-400/20 text-teal-100' : 'bg-white/5 text-slate-500'}`}>{s}</li>;
        })}
      </ol>

      {step === 'identity' && (
        <div className="space-y-3">
          <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.05] p-3">
            <Avatar name={r.name} hue={r.hue} size="h-14 w-14 text-base" />
            <div className="min-w-0 text-[12px]">
              <p className="text-[15px] font-semibold text-white">{r.name}</p>
              <p className="tnum text-slate-400">DOB {r.dob} · NHS {maskNhs(r.nhs)}</p>
              <p className="text-slate-400">{r.location}</p>
            </div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-3 text-[12px]">
            <p className="font-semibold text-white">{m.name}</p>
            <p className="text-slate-400">{m.dose} · {m.route} · {m.round}{m.round !== 'PRN' ? ` ${fmt(ROUND_TIME[m.round])}` : ''}</p>
            <p className="mt-1 text-red-200"><AlertTriangle className="mr-1 inline h-3 w-3" aria-hidden />Allergies: {r.allergies}</p>
          </div>
          <button type="button" className={`${btn.primaryDark} w-full`} onClick={() => setStep('scanning')}><Fingerprint className="h-4 w-4" aria-hidden />Photo and DOB match, confirm identity</button>
        </div>
      )}

      {(step === 'scanning' || step === 'mismatch') && (
        <div>
          <div className="relative mx-auto aspect-[4/3] w-full max-w-full overflow-hidden rounded-2xl border border-white/15 bg-gradient-to-br from-slate-800 to-slate-950">
            <div className="absolute inset-0 opacity-30" style={{ background: 'repeating-linear-gradient(90deg, rgba(255,255,255,.06) 0 2px, transparent 2px 14px)' }} />
            <div className="absolute left-1/2 top-1/2 flex h-24 w-44 -translate-x-1/2 -translate-y-1/2 flex-col items-center justify-center rounded-lg bg-white/90 shadow-xl">
              <div className="flex h-10 items-end gap-[2px]" aria-hidden>{Array.from({ length: 34 }).map((_, i) => <span key={i} className="bg-slate-900" style={{ width: (i * 7) % 3 === 0 ? 3 : 1.5, height: '100%' }} />)}</div>
              <p className="cos-mono mt-1 text-[10px] text-slate-700">{step === 'mismatch' ? decoy.barcode : m.barcode}</p>
            </div>
            {['left-3 top-3 border-l-2 border-t-2', 'right-3 top-3 border-r-2 border-t-2', 'left-3 bottom-3 border-l-2 border-b-2', 'right-3 bottom-3 border-r-2 border-b-2'].map((c) => <span key={c} className={`absolute h-7 w-7 rounded-sm ${step === 'mismatch' ? 'border-red-400' : 'border-teal-300'} ${c}`} aria-hidden />)}
            {step === 'scanning' && <span className="absolute inset-x-6 h-0.5 bg-teal-300 shadow-[0_0_14px_3px_rgba(45,212,191,.7)]" style={{ animation: 'cos-scan 1.5s ease-in-out infinite' }} aria-hidden />}
            {step === 'mismatch' && <div className="absolute inset-0 grid place-items-center bg-red-950/70"><Ban className="h-12 w-12 text-red-300" aria-hidden /></div>}
          </div>
          {step === 'scanning' ? (
            <>
              <p className="mt-3 text-center text-[12px] text-slate-300">Point the camera at the box or blister pack barcode</p>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <button type="button" className={btn.primaryDark} onClick={() => scan(true)}><ScanLine className="h-4 w-4" aria-hidden />Scan box</button>
                <button type="button" className={btn.ghostDark} onClick={() => scan(false)}>Scan wrong box</button>
              </div>
            </>
          ) : (
            <div className="mt-3 rounded-2xl border border-red-400/40 bg-red-500/10 p-3 text-[12px] text-red-100">
              <p className="font-semibold">Wrong medicine. Administration blocked.</p>
              <p className="mt-1">Scanned {decoy.name}, prescribed to {resName(decoy.residentId)}. Expected {m.name} for {r.first}. This near miss has been logged.</p>
              <button type="button" className={`${btn.primaryDark} mt-3 w-full`} onClick={() => setStep('scanning')}><RotateCcw className="h-4 w-4" aria-hidden />Rescan</button>
            </div>
          )}
        </div>
      )}

      {step === 'verify' && (
        <div className="space-y-3">
          <ul className="grid grid-cols-2 gap-1.5 text-[12px]">
            {[['Right person', true], ['Right medicine', true], ['Right dose', true], ['Right route', true], ['Right time', !late], ['No allergy conflict', true]].map(([label, ok]) => (
              <li key={label as string} className={`flex items-center gap-1.5 rounded-xl px-2.5 py-1.5 ${ok ? 'bg-emerald-500/10 text-emerald-200' : 'bg-amber-500/10 text-amber-200'}`}>{ok ? <CheckCircle2 className="h-3.5 w-3.5" aria-hidden /> : <AlertTriangle className="h-3.5 w-3.5" aria-hidden />}{label as string}</li>
            ))}
          </ul>
          {late && <p className="rounded-xl bg-amber-500/10 px-3 py-2 text-[12px] text-amber-100">Outside the 60-minute window. A late-dose reason is added to the record.</p>}
          {m.prn && (
            <div>
              <label htmlFor="prn-ind" className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Reason for PRN</label>
              <input id="prn-ind" value={indication} maxLength={160} onChange={(e) => setIndication(e.target.value)} className="mt-1 w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-[13px] text-white focus:border-teal-400/60 focus:outline-none" />
            </div>
          )}
          {m.prn && m.prn.unitsMax > 1 && pst && (
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Dose to give</p>
              <div className="mt-1 grid grid-cols-2 gap-2">
                {Array.from({ length: m.prn.unitsMax - m.prn.unitsMin + 1 }, (_, i) => (m.prn as Prn).unitsMin + i).map((u) => (
                  <button key={u} type="button" disabled={u > pst.maxUnits} onClick={() => setUnits(u)} className={`rounded-xl border py-2 text-[13px] font-semibold disabled:cursor-not-allowed disabled:opacity-35 ${units === u ? 'border-teal-300/60 bg-teal-400/20 text-teal-50' : 'border-white/10 bg-white/[0.04] text-slate-300'}`}>
                    {u} {(m.prn as Prn).unitLabel}{u > 1 ? 's' : ''}{(m.prn as Prn).paracetamolMg ? <span className="tnum block text-[10px] font-normal opacity-70">{u * ((m.prn as Prn).paracetamolMg as number)} mg</span> : null}
                  </button>
                ))}
              </div>
              {pst.paraLimit !== null && <p className="tnum mt-1 text-[11px] text-slate-400">{thousands(pst.paraUsed ?? 0)} of {thousands(pst.paraLimit)} mg paracetamol used in 24 h</p>}
            </div>
          )}
          {m.stomp && (
            <fieldset className="rounded-2xl border border-cyan-400/25 bg-cyan-500/10 p-3">
              <legend className="px-1 text-[11px] font-semibold uppercase tracking-wider text-cyan-200">STOMP check: PBS steps tried first</legend>
              {residentById(m.residentId).passport.strategies.slice(0, 3).map((s, i) => (
                <label key={s.stage} className="mt-1.5 flex items-start gap-2 text-[12px] text-slate-200">
                  <input type="checkbox" checked={pbsSteps[i]} onChange={() => setPbsSteps((p) => p.map((v, j) => (j === i ? !v : v)))} className="mt-0.5 h-4 w-4 accent-teal-500" />
                  <span><span className="font-semibold text-white">{s.stage}:</span> {truncate(s.detail, 70)}</span>
                </label>
              ))}
            </fieldset>
          )}
          <label className="flex items-start gap-2 rounded-2xl border border-white/10 bg-white/[0.04] p-3 text-[12px] text-slate-200">
            <input type="checkbox" checked={doseOk} onChange={() => setDoseOk((v) => !v)} className="mt-0.5 h-4 w-4 accent-teal-500" />
            <span>I have checked the dose: <span className="font-semibold text-white">{m.prn ? `${units} ${m.prn.unitLabel}${units > 1 ? 's' : ''}` : m.dose}</span> of {m.name}, and {r.first} has taken it.</span>
          </label>
          {m.requiresWitness && (
            <div>
              <label htmlFor="witness" className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Witness signature (required)</label>
              <select id="witness" value={witness} onChange={(e) => setWitness(e.target.value)} className="mt-1 w-full rounded-xl border border-white/10 bg-slate-800 px-3 py-2 text-[13px] text-white focus:border-teal-400/60 focus:outline-none">
                <option value="">Select witness on shift</option>
                {WITNESSES.map((w) => <option key={w} value={w}>{w}</option>)}
              </select>
            </div>
          )}
          <button type="button" disabled={tagging} onClick={() => { setTagging(true); window.setTimeout(() => { setTagging(false); setVoiceTag('Voice tag: taken with water, swallowed fully, no issues.'); }, 1300); }} className="flex w-full items-center gap-2 rounded-xl border border-dashed border-white/15 px-3 py-2 text-left text-[12px] text-slate-300 hover:bg-white/[0.04]">
            {tagging ? <><Wave active bars={14} /><span>Recording voice tag</span></> : voiceTag ? <><AudioLines className="h-4 w-4 text-teal-300" aria-hidden /><span className="flex-1">{voiceTag}</span></> : <><Mic className="h-4 w-4 text-teal-300" aria-hidden /><span>Add a voice tag (optional)</span></>}
          </button>
          <button type="button" className={`${btn.primaryDark} w-full`} disabled={!ready} onClick={confirm}><PenLine className="h-4 w-4" aria-hidden />Sign and record administration</button>
        </div>
      )}
    </PhoneSheet>
  );
}

function RefuseSheet({ state, medId, now, act, notify, onClose }: { state: State; medId: string; now: number; act: Act; notify: Notify; onClose: () => void }) {
  const m = state.meds.find((x) => x.id === medId) as Med;
  const r = residentById(m.residentId);
  const reasons = ['Declined, said it tastes unpleasant', 'Asleep, will re-offer within the window', 'Declined, no reason given', 'Unwell or vomiting', 'Not available, pharmacy supply issue'];
  const me = useMe();
  const [reason, setReason] = useState(reasons[0]);
  const [note, setNote] = useState('');
  const submit = () => {
    const text = `${r.first} refused ${m.name} at ${fmt(now)}. Reason: ${reason.toLowerCase()}.${note.trim() ? ` ${note.trim()}` : ''}`;
    const log = makeLog({ residentId: r.id, time: now, text, source: 'emar', extraTags: { med: true }, author: me });
    act({ type: 'REFUSE_MED', medId: m.id, now, reason, log }, 'worker');
    notify('Refusal recorded and flagged to the manager', 'amber', 'worker');
    onClose();
  };
  return (
    <PhoneSheet title="Record refusal" icon={AlertTriangle} onClose={onClose}>
      <p className="text-[13px] text-slate-300">{m.name} · {r.first}</p>
      <fieldset className="mt-3 space-y-1.5">
        <legend className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400">Reason</legend>
        {reasons.map((x) => (
          <label key={x} className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-[12px] ${reason === x ? 'border-amber-400/50 bg-amber-500/10 text-amber-50' : 'border-white/10 bg-white/[0.03] text-slate-300'}`}>
            <input type="radio" name="refuse-reason" checked={reason === x} onChange={() => setReason(x)} className="accent-amber-500" />{x}
          </label>
        ))}
      </fieldset>
      <label htmlFor="refuse-note" className="mt-3 block text-[11px] font-semibold uppercase tracking-wider text-slate-400">What you did next</label>
      <textarea id="refuse-note" rows={3} maxLength={400} value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Re-offered after 15 minutes, rang the pharmacist" className="mt-1 w-full resize-none rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-[13px] text-white focus:border-amber-400/60 focus:outline-none" />
      <button type="button" className={`${btn.primaryDark} mt-3 w-full`} onClick={submit}>Record refusal</button>
    </PhoneSheet>
  );
}

function PbsTab({ state, now, resident, act, notify }: { state: State; now: number; resident: Resident; act: Act; notify: Notify }) {
  const [open, setOpen] = useState<string>('triggers');
  const [abc, setAbc] = useState(false);
  const p = resident.passport;
  const incidents = state.incidents.filter((i) => i.residentId === resident.id).sort((a, b) => b.time - a.time);
  const sections: Array<{ id: string; title: string; icon: React.ElementType; tone: string; body: React.ReactNode }> = [
    { id: 'triggers', title: 'Known triggers', icon: Zap, tone: 'text-amber-300', body: <ul className="space-y-1.5">{p.triggers.map((t) => <li key={t} className="flex gap-2"><span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-amber-300" />{t}</li>)}</ul> },
    { id: 'warning', title: 'Warning signs', icon: Eye, tone: 'text-amber-200', body: <ul className="space-y-1.5">{p.warningSigns.map((t) => <li key={t} className="flex gap-2"><span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-amber-200" />{t}</li>)}</ul> },
    { id: 'strategies', title: 'De-escalation strategies', icon: ShieldCheck, tone: 'text-emerald-300', body: <ol className="space-y-2">{p.strategies.map((s, i) => <li key={s.stage} className="flex gap-2.5"><span className="tnum grid h-5 w-5 shrink-0 place-items-center rounded-full bg-emerald-400/20 text-[10px] font-bold text-emerald-200">{i + 1}</span><span><span className="font-semibold text-white">{s.stage}.</span> {s.detail}</span></li>)}</ol> },
    { id: 'comms', title: 'Communication and likes', icon: HeartHandshake, tone: 'text-cyan-300', body: <div className="space-y-2"><p>{p.communication}</p><div className="flex flex-wrap gap-1.5">{p.likes.map((l) => <Chip key={l} tone="cyan">{l}</Chip>)}</div></div> },
  ];
  return (
    <div className="cos-scroll h-full overflow-y-auto px-4 pb-6">
      <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-white/[0.07] to-white/[0.02] p-3.5 backdrop-blur-xl">
        <div className="flex items-center gap-3">
          <Avatar name={resident.name} hue={resident.hue} size="h-11 w-11 text-sm" />
          <div className="min-w-0 flex-1"><p className="cos-display text-[15px] font-semibold text-white">PBS Passport</p><p className="truncate text-[11px] text-slate-400">{resident.name} · {resident.conditions.slice(0, 2).join(' · ')}</p></div>
          <Chip tone="emerald">Plan v4</Chip>
        </div>
      </div>
      <div className="mt-2.5 space-y-2">
        {sections.map((s) => (
          <div key={s.id} className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04]">
            <button type="button" onClick={() => setOpen(open === s.id ? '' : s.id)} aria-expanded={open === s.id} className="flex w-full items-center gap-2.5 px-3.5 py-3 text-left">
              <s.icon className={`h-4 w-4 ${s.tone}`} aria-hidden /><span className="flex-1 text-[13px] font-semibold text-white">{s.title}</span><ChevronDown className={`h-4 w-4 text-slate-400 transition ${open === s.id ? 'rotate-180' : ''}`} aria-hidden />
            </button>
            {open === s.id && <div className="px-3.5 pb-3.5 text-[12px] leading-5 text-slate-300">{s.body}</div>}
          </div>
        ))}
      </div>
      <button type="button" onClick={() => setAbc(true)} className="mt-3 flex w-full items-center gap-3 rounded-2xl border border-amber-300/40 bg-gradient-to-r from-amber-500/20 to-amber-500/5 p-3.5 text-left shadow-lg shadow-amber-500/10">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-amber-400 text-slate-950"><Mic className="h-5 w-5" aria-hidden /></span>
        <span className="flex-1"><span className="block text-[13px] font-semibold text-white">Log ABC incident by voice</span><span className="block text-[11px] text-amber-100/70">Speak the account. AI structures Antecedent, Behaviour, Consequence.</span></span>
        <ChevronRight className="h-4 w-4 text-amber-200" aria-hidden />
      </button>
      <h3 className="mb-2 mt-4 text-[11px] font-semibold uppercase tracking-wider text-slate-400">Incidents today</h3>
      {incidents.length === 0 && <p className="text-[12px] text-slate-500">No incidents recorded for {resident.first} today.</p>}
      <div className="space-y-2">
        {incidents.map((i) => (
          <div key={i.id} className="rounded-2xl border border-white/10 bg-white/[0.04] p-3 text-[12px]">
            <div className="flex items-center gap-2"><span className="tnum font-semibold text-white">{fmt(i.time)}</span><Chip tone={i.severity === 'High' ? 'red' : i.severity === 'Moderate' ? 'amber' : 'slate'}>{i.severity}</Chip><span className="ml-auto"><Chip tone={i.status === 'reviewed' ? 'emerald' : 'amber'}>{i.status === 'reviewed' ? 'Reviewed' : 'With manager'}</Chip></span></div>
            <p className="mt-1.5 text-slate-300"><span className="font-semibold text-amber-200">B:</span> {i.behaviour}</p>
            <div className="mt-1.5 flex flex-wrap gap-1">{i.triggers.map((t) => <Chip key={t} tone="amber">{t}</Chip>)}</div>
          </div>
        ))}
      </div>
      {abc && <AbcSheet resident={resident} now={now} state={state} act={act} notify={notify} onClose={() => setAbc(false)} />}
    </div>
  );
}

function AbcSheet({ resident, now, state, act, notify, onClose }: { resident: Resident; now: number; state: State; act: Act; notify: Notify; onClose: () => void }) {
  const me = useMe();
  const [mode, setMode] = useState<'speak' | 'type'>('speak');
  const [raw, setRaw] = useState('');
  const [structured, setStructured] = useState<ReturnType<typeof parseABC> | null>(null);
  const [transcribing, setTranscribing] = useState(false);
  const [restrictive, setRestrictive] = useState(false);
  const [restrictiveDetail, setRestrictiveDetail] = useState('');
  const rec = useRecorder(60, () => stop());
  function stop() {
    rec.stop();
    setTranscribing(true);
    window.setTimeout(() => { const text = ABC_SCRIPTS[resident.id]; setRaw(text); setStructured(parseABC(text)); setTranscribing(false); }, 1200);
  }
  const route = () => {
    if (!structured) return;
    const id = uid('INC');
    const logId = uid('LOG');
    const incident: Incident = { id, residentId: resident.id, time: now, author: me.name, statutory: {}, antecedent: structured.antecedent, behaviour: structured.behaviour, consequence: structured.consequence, triggers: structured.triggers, severity: structured.severity, restrictive, restrictiveDetail, status: 'new', synced: true, logId };
    const log = makeLog({ id: logId, author: me, residentId: resident.id, time: now, source: 'incident', incidentId: id, text: `ABC incident. Antecedent: ${structured.antecedent} Behaviour: ${structured.behaviour} Consequence: ${structured.consequence}` });
    act({ type: 'ADD_INCIDENT', incident, log }, 'worker');
    notify(`ABC incident routed to manager · ${structured.severity}`, 'amber', 'worker');
    onClose();
  };
  const field = (key: 'antecedent' | 'behaviour' | 'consequence', label: string, letter: string, tone: string) => (
    <div>
      <label htmlFor={`abc-${key}`} className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400"><span className={`grid h-5 w-5 place-items-center rounded-md text-[11px] font-bold text-slate-950 ${tone}`}>{letter}</span>{label}</label>
      <textarea id={`abc-${key}`} rows={3} maxLength={600} value={structured ? structured[key] : ''} onChange={(e) => structured && setStructured({ ...structured, [key]: e.target.value })} className="mt-1 w-full resize-none rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-[12px] leading-5 text-white focus:border-teal-400/60 focus:outline-none" />
    </div>
  );
  return (
    <PhoneSheet title={`ABC incident · ${resident.first}`} icon={Brain} onClose={onClose}>
      {!structured ? (
        <>
          <div className="mb-3 flex rounded-full border border-white/10 bg-white/[0.04] p-0.5 text-[12px]">
            {(['speak', 'type'] as const).map((m) => <button key={m} type="button" onClick={() => setMode(m)} className={`flex-1 rounded-full py-1.5 font-semibold ${mode === m ? 'bg-teal-400/20 text-teal-100' : 'text-slate-400'}`}>{m === 'speak' ? 'Speak account' : 'Type account'}</button>)}
          </div>
          {mode === 'speak' ? (
            <div className="flex flex-col items-center py-4 text-center">
              <Ring size={120} stroke={6} progress={rec.recording ? rec.elapsed / 60 : 0} color="#F59E0B" track="rgba(255,255,255,.08)">
                {rec.recording
                  ? <button type="button" onClick={stop} className="grid h-20 w-20 place-items-center rounded-full bg-red-500 text-white shadow-lg shadow-red-500/40" aria-label="Stop recording"><Square className="h-7 w-7 fill-white" /></button>
                  : transcribing ? <span className="h-8 w-8 rounded-full border-[3px] border-amber-300 border-t-transparent cos-spin" />
                    : <button type="button" onClick={rec.start} className="grid h-20 w-20 place-items-center rounded-full bg-amber-400 text-slate-950 shadow-lg shadow-amber-500/40" aria-label="Start recording"><Mic className="h-8 w-8" /></button>}
              </Ring>
              <div className="mt-3"><Wave active={rec.recording} bars={24} className="bg-amber-300" /></div>
              <p className="mt-2 text-[12px] text-slate-300">{rec.recording ? `Recording · ${Math.floor(rec.elapsed)}s. Say what happened before, during and after.` : transcribing ? 'Structuring into Antecedent, Behaviour, Consequence…' : 'Tap and describe what happened before, during and after.'}</p>
            </div>
          ) : (
            <>
              <label htmlFor="abc-raw" className="sr-only">Account of the incident</label>
              <textarea id="abc-raw" rows={6} maxLength={1500} value={raw} onChange={(e) => setRaw(e.target.value)} placeholder="Describe what happened before, during and after." className="w-full resize-none rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-[13px] leading-5 text-white focus:border-teal-400/60 focus:outline-none" />
              <button type="button" className={`${btn.primaryDark} mt-3 w-full`} disabled={raw.trim().length < 20} onClick={() => setStructured(parseABC(raw))}><Sparkles className="h-4 w-4" aria-hidden />Structure with AI</button>
            </>
          )}
        </>
      ) : (
        <div className="space-y-3">
          {field('antecedent', 'Antecedent', 'A', 'bg-cyan-300')}
          {field('behaviour', 'Behaviour', 'B', 'bg-amber-300')}
          {field('consequence', 'Consequence', 'C', 'bg-emerald-300')}
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Triggers found (tap to toggle)</p>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {TRIGGER_LIB.map(([, t]) => {
                const on = structured.triggers.includes(t);
                return <button key={t} type="button" onClick={() => setStructured({ ...structured, triggers: on ? structured.triggers.filter((x) => x !== t) : [...structured.triggers, t] })} className={`rounded-full border px-2.5 py-1 text-[11px] ${on ? 'border-amber-400/50 bg-amber-500/15 text-amber-100' : 'border-white/10 bg-white/[0.03] text-slate-500'}`}>{t}</button>;
              })}
            </div>
            {structured.triggers.some((t) => resident.passport.triggers.some((pt) => pt.toLowerCase().includes(t.split(' ')[1]?.toLowerCase() ?? '~'))) && <p className="mt-1.5 text-[11px] text-cyan-200">Matches a known trigger in {resident.first}'s PBS passport.</p>}
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Severity</p>
            <div className="mt-1.5 grid grid-cols-3 gap-1.5">
              {(['Low', 'Moderate', 'High'] as const).map((s) => <button key={s} type="button" onClick={() => setStructured({ ...structured, severity: s })} className={`rounded-xl border py-2 text-[12px] font-semibold ${structured.severity === s ? (s === 'High' ? 'border-red-400/60 bg-red-500/20 text-red-100' : s === 'Moderate' ? 'border-amber-400/60 bg-amber-500/20 text-amber-100' : 'border-teal-400/60 bg-teal-500/20 text-teal-100') : 'border-white/10 text-slate-400'}`}>{s}</button>)}
            </div>
          </div>
          <label className="flex items-start gap-2 rounded-xl border border-white/10 bg-white/[0.04] p-3 text-[12px] text-slate-200">
            <input type="checkbox" checked={restrictive} onChange={() => setRestrictive((v) => !v)} className="mt-0.5 h-4 w-4 accent-teal-500" />
            <span>Restrictive practice was used (physical, environmental or chemical)</span>
          </label>
          {restrictive && <textarea aria-label="Describe the restrictive practice" rows={2} maxLength={300} value={restrictiveDetail} onChange={(e) => setRestrictiveDetail(e.target.value)} placeholder="What was used, by whom and for how long" className="w-full resize-none rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-[12px] text-white focus:outline-none" />}
          <div className="grid grid-cols-2 gap-2">
            <button type="button" className={btn.ghostDark} onClick={() => setStructured(null)}>Start again</button>
            <button type="button" className={btn.primaryDark} disabled={!structured.behaviour.trim() || (restrictive && restrictiveDetail.trim().length < 5)} onClick={route}><Send className="h-4 w-4" aria-hidden />Route to manager</button>
          </div>
          {!state.online && <p className="text-center text-[11px] text-amber-200">Offline: stored in the encrypted outbox and sent on reconnect.</p>}
        </div>
      )}
    </PhoneSheet>
  );
}

function LockScreen({ now, act, notify }: { now: number; act: Act; notify: Notify }) {
  const live = useContext(LiveCtx);
  const [who, setWho] = useState<StaffMember | null>(null);
  const [pin, setPin] = useState('');
  const [fails, setFails] = useState(0);
  const [lockedUntil, setLockedUntil] = useState(0);
  const [shake, setShake] = useState(false);
  const d = new Date(now);
  const wait = Math.max(0, Math.ceil((lockedUntil - Date.now()) / 1000));
  const press = (k: string) => {
    if (!who || wait > 0 || shake) return;
    if (k === 'del') { setPin((p) => p.slice(0, -1)); return; }
    const next = (pin + k).slice(0, 4);
    setPin(next);
    if (next.length < 4) return;
    if (live) {
      act({ type: 'SIGN_IN', actor: who.actor, now, method: 'badge + PIN', pin: next }, 'worker');
      window.setTimeout(() => setPin(''), 700);
      return;
    }
    if (next === who.pin) {
      act({ type: 'SIGN_IN', actor: who.actor, now, method: 'badge + PIN' }, 'worker');
      notify(`${who.actor.name} signed in on shared handset 2`, 'teal', 'worker');
      return;
    }
    const f = fails + 1;
    setShake(true);
    window.setTimeout(() => { setShake(false); setPin(''); }, 450);
    if (f >= 3) { setLockedUntil(Date.now() + 30000); setFails(0); } else setFails(f);
  };
  return (
    <div className="relative z-10 flex min-h-0 flex-1 flex-col px-6 pb-8 pt-6 text-center">
      <p className="cos-display tnum text-5xl font-bold text-white">{pad(d.getUTCHours())}:{pad(d.getUTCMinutes())}</p>
      <p className="mt-1 text-[13px] text-slate-400">Tuesday 10 November · Shared handset 2 · Willow Lane</p>
      {!who ? (
        <>
          <p className="mt-8 flex items-center justify-center gap-2 text-[13px] font-semibold text-teal-200"><Nfc className="h-4 w-4" aria-hidden />Tap your staff badge</p>
          <div className="mt-4 space-y-2">
            {STAFF.map((st) => (
              <button key={st.actor.name} type="button" onClick={() => { setWho(st); setPin(''); }} className="flex w-full items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.05] p-3 text-left hover:border-teal-300/40 hover:bg-teal-400/10">
                <Avatar name={st.actor.name} hue={st.hue} size="h-10 w-10 text-xs" />
                <span className="min-w-0 flex-1"><span className="block text-[14px] font-semibold text-white">{st.actor.name}</span><span className="block text-[11px] text-slate-400">{st.actor.role}</span></span>
                <Nfc className="h-4 w-4 text-slate-500" aria-hidden />
              </button>
            ))}
          </div>
          <p className="mt-auto pt-6 text-[11px] text-slate-500">No resident information shows while the handset is locked. Demo PINs: David 2580 · Amina 1357 · Tomasz 4826{live ? '. PINs are checked by the server.' : ''}</p>
        </>
      ) : (
        <>
          <div className="mt-6 flex flex-col items-center"><Avatar name={who.actor.name} hue={who.hue} size="h-14 w-14 text-base" /><p className="mt-2 text-[15px] font-semibold text-white">{who.actor.name}</p><p className="text-[12px] text-slate-400">Badge read. Enter your PIN.</p></div>
          <div className={`mt-5 flex justify-center gap-3 ${shake ? 'animate-pulse' : ''}`} aria-label={`${pin.length} of 4 digits entered`}>
            {[0, 1, 2, 3].map((n) => <span key={n} className={`h-3.5 w-3.5 rounded-full border ${shake ? 'border-red-400 bg-red-400' : n < pin.length ? 'border-teal-300 bg-teal-300' : 'border-slate-500'}`} />)}
          </div>
          <p className="mt-2 h-4 text-[11px] text-red-300">{wait > 0 ? `Too many attempts. Try again in ${wait}s.` : fails > 0 ? `Wrong PIN. ${3 - fails} attempt${3 - fails === 1 ? '' : 's'} left.` : ''}</p>
          <div className="mx-auto mt-3 grid w-full max-w-[260px] grid-cols-3 gap-2.5">
            {['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'del'].map((k) => k === '' ? <span key="blank" /> : (
              <button key={k} type="button" onClick={() => press(k)} disabled={wait > 0} aria-label={k === 'del' ? 'Delete digit' : `Digit ${k}`} className="tnum grid h-14 place-items-center rounded-2xl border border-white/10 bg-white/[0.06] text-xl font-semibold text-white hover:bg-white/[0.12] disabled:opacity-40">
                {k === 'del' ? <Delete className="h-5 w-5" aria-hidden /> : k}
              </button>
            ))}
          </div>
          <button type="button" onClick={() => { setWho(null); setPin(''); setFails(0); }} className="mt-auto pt-4 text-[12px] font-semibold text-slate-400 hover:text-white">Not you? Tap a different badge</button>
        </>
      )}
    </div>
  );
}

function PlanTab({ state, now, resident, act, notify }: { state: State; now: number; resident: Resident; act: Act; notify: Notify }) {
  const [seg, setSeg] = useState<'plan' | 'risks' | 'obs' | 'pbs'>('plan');
  const od = overdueRisks(state, resident, now).length;
  const segs: Array<{ id: typeof seg; label: string }> = [{ id: 'plan', label: 'Care plan' }, { id: 'risks', label: od ? `Risks · ${od}` : 'Risks' }, { id: 'obs', label: 'Obs' }, { id: 'pbs', label: 'PBS' }];
  return (
    <div className="flex h-full flex-col">
      <div className="shrink-0 px-4 pb-2">
        <div className="grid grid-cols-4 rounded-full border border-white/10 bg-white/[0.04] p-0.5 text-[11px]" role="tablist" aria-label="Plan sections">
          {segs.map((x) => <button key={x.id} type="button" role="tab" aria-selected={seg === x.id} onClick={() => setSeg(x.id)} className={`rounded-full py-1.5 font-semibold ${seg === x.id ? 'bg-teal-400/20 text-teal-100' : x.id === 'risks' && od ? 'text-red-300' : 'text-slate-400'}`}>{x.label}</button>)}
        </div>
      </div>
      <div className="min-h-0 flex-1">
        {seg === 'plan' && <CarePlanView resident={resident} />}
        {seg === 'risks' && <RisksView state={state} now={now} resident={resident} act={act} notify={notify} />}
        {seg === 'obs' && <ObsView state={state} now={now} resident={resident} act={act} notify={notify} />}
        {seg === 'pbs' && <PbsTab state={state} now={now} resident={resident} act={act} notify={notify} />}
      </div>
    </div>
  );
}

function CarePlanView({ resident }: { resident: Resident }) {
  const L = resident.legal;
  const vc = L.voiceConsent;
  const rows: Array<[string, string]> = [['Mental capacity', L.capacity], ['Deprivation of liberty', L.dols], ['Lasting power of attorney', L.lpa], ['Resuscitation', L.resus], ['Covert medication', L.covert]];
  return (
    <div className="cos-scroll h-full space-y-3 overflow-y-auto px-4 pb-6">
      <section className="rounded-2xl border border-white/10 bg-white/[0.045] p-3.5">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-teal-300">What matters to {resident.first}</p>
        <ul className="mt-2 space-y-1.5 text-[13px] text-slate-100">{resident.carePlan.outcomes.map((o) => <li key={o} className="flex gap-2"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300" aria-hidden />{o}</li>)}</ul>
      </section>
      <section className="rounded-2xl border border-white/10 bg-white/[0.045] p-3.5">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Daily routine</p>
        <ul className="mt-2 space-y-1 text-[12px] text-slate-200">{resident.carePlan.routine.map((o) => <li key={o} className="tnum">{o}</li>)}</ul>
        <div className="mt-3 grid gap-2 text-[12px]">
          <p className="rounded-xl bg-black/20 p-2 text-slate-300"><span className="font-semibold text-white">Mobility.</span> {resident.carePlan.mobility}</p>
          <p className="rounded-xl bg-black/20 p-2 text-slate-300"><span className="font-semibold text-white">Eating and drinking.</span> {resident.carePlan.nutrition}</p>
        </div>
      </section>
      <section className="rounded-2xl border border-white/10 bg-white/[0.045] p-3.5">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Capacity, consent and legal</p>
        <dl className="mt-2 space-y-2 text-[12px]">
          {rows.map(([k, v]) => <div key={k}><dt className="text-[10px] uppercase tracking-wider text-slate-500">{k}</dt><dd className="text-slate-200">{v}</dd></div>)}
          <div><dt className="text-[10px] uppercase tracking-wider text-slate-500">Voice notes</dt><dd className="mt-0.5"><Chip tone={vc.status === 'declined-in-room' ? 'amber' : 'emerald'}>{vc.status === 'consented' ? 'Consented' : vc.status === 'best-interests' ? 'Best-interests decision' : 'Not inside room'}</Chip><span className="mt-1 block text-slate-300">{vc.detail}</span></dd></div>
          <div><dt className="text-[10px] uppercase tracking-wider text-slate-500">Allergies</dt><dd className="text-red-200">{resident.allergies}</dd></div>
        </dl>
      </section>
    </div>
  );
}

function RisksView({ state, now, resident, act, notify }: { state: State; now: number; resident: Resident; act: Act; notify: Notify }) {
  const me = useMe();
  const [bodyMap, setBodyMap] = useState(false);
  return (
    <div className="cos-scroll h-full space-y-2.5 overflow-y-auto px-4 pb-6">
      <button type="button" onClick={() => setBodyMap(true)} className="flex w-full items-center gap-3 rounded-2xl border border-teal-300/30 bg-teal-500/10 p-3 text-left">
        <span className="grid h-9 w-9 place-items-center rounded-xl bg-teal-400 text-slate-950"><UserRound className="h-5 w-5" aria-hidden /></span>
        <span className="flex-1"><span className="block text-[13px] font-semibold text-white">Record skin check on body map</span><span className="block text-[11px] text-teal-100/70">Tap the exact location, size and type</span></span>
        <ChevronRight className="h-4 w-4 text-teal-200" aria-hidden />
      </button>
      {resident.risks.map((k) => {
        const due = riskDue(resident, k, state, now);
        return (
          <div key={k.id} className={`rounded-2xl border p-3 ${due.tone === 'red' ? 'border-red-400/40 bg-red-500/[0.07]' : 'border-white/10 bg-white/[0.045]'}`}>
            <div className="flex items-start gap-2">
              <div className="min-w-0 flex-1"><p className="text-[13px] font-semibold text-white">{k.name}</p><p className="tnum text-[11px] text-slate-400">{k.tool} · score {k.score}</p></div>
              <Chip tone={k.level === 'High' ? 'red' : k.level === 'Medium' ? 'amber' : 'emerald'}>{k.level}</Chip>
            </div>
            <ul className="mt-2 space-y-0.5 text-[12px] text-slate-300">{k.controls.map((c) => <li key={c} className="flex gap-2"><span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-teal-300" />{c}</li>)}</ul>
            <p className={`tnum mt-2 flex items-center gap-1.5 text-[11px] ${due.tone === 'red' ? 'text-red-300' : due.tone === 'amber' ? 'text-amber-200' : 'text-slate-400'}`}><Clock className="h-3.5 w-3.5" aria-hidden />{due.label} · last reviewed {fmtDate(due.reviewed)} · due {fmtDate(due.due)}</p>
          </div>
        );
      })}
      <p className="px-1 text-[11px] text-slate-500">Risk reviews are signed off by the manager. Overdue reviews lower the audit readiness score.</p>
      {bodyMap && <BodyMapSheet resident={resident} onClose={() => setBodyMap(false)} onSave={(a, text) => {
        const entry = makeLog({ residentId: resident.id, time: now, text, source: 'photo', attachments: [a], author: me });
        act({ type: 'ADD_LOG', entry, actor: me }, 'worker');
        notify(`Body map saved for ${resident.first}`, entry.risk ? 'amber' : 'emerald', 'worker');
        setBodyMap(false);
      }} />}
    </div>
  );
}

function bodyZone(view: 'Front' | 'Back', x: number, y: number): string {
  const personLeft = view === 'Front' ? x > 60 : x < 60;
  const side = personLeft ? 'left' : 'right';
  if (y < 38) return view === 'Front' ? 'face' : 'back of head';
  if (x < 34 || x > 86) return `${side} arm`;
  if (y < 80) return view === 'Front' ? `${side} chest` : `${side} upper back`;
  if (y < 116) return view === 'Front' ? 'abdomen' : y > 96 ? 'sacrum' : 'lower back';
  if (y < 160) return view === 'Front' ? `${side} thigh` : `${side} buttock and thigh`;
  if (y < 216) return view === 'Front' ? `${side} shin` : `${side} calf`;
  return view === 'Front' ? `${side} foot` : `${side} heel`;
}

function BodyMapSheet({ resident, onClose, onSave }: { resident: Resident; onClose: () => void; onSave: (a: Attachment, text: string) => void }) {
  const [mark, setMark] = useState<{ view: 'Front' | 'Back'; x: number; y: number } | null>(null);
  const [kind, setKind] = useState('Red mark');
  const [size, setSize] = useState('2');
  const [blanch, setBlanch] = useState(true);
  const sizeNum = Number(size);
  const valid = !!mark && Number.isFinite(sizeNum) && sizeNum > 0 && sizeNum <= 40;
  const zone = mark ? bodyZone(mark.view, mark.x, mark.y) : '';
  const figure = (view: 'Front' | 'Back') => (
    <div className="flex flex-col items-center">
      <svg viewBox="0 0 120 240" className="h-52 w-auto cursor-crosshair" role="img" aria-label={`${view} body outline. Tap to place a mark.`} onClick={(e) => { const r = e.currentTarget.getBoundingClientRect(); setMark({ view, x: ((e.clientX - r.left) / r.width) * 120, y: ((e.clientY - r.top) / r.height) * 240 }); }}>
        <g fill="rgba(255,255,255,0.08)" stroke="rgba(148,163,184,0.6)" strokeWidth={1.2}>
          <circle cx={60} cy={22} r={15} /><rect x={53} y={36} width={14} height={10} rx={3} /><rect x={36} y={44} width={48} height={72} rx={14} />
          <rect x={20} y={48} width={13} height={70} rx={6} /><rect x={87} y={48} width={13} height={70} rx={6} />
          <rect x={39} y={112} width={19} height={104} rx={8} /><rect x={62} y={112} width={19} height={104} rx={8} />
          <ellipse cx={48} cy={226} rx={11} ry={6} /><ellipse cx={72} cy={226} rx={11} ry={6} />
        </g>
        {mark && mark.view === view && <circle cx={mark.x} cy={mark.y} r={5} fill="#EF4444" stroke="#FFFFFF" strokeWidth={1.5} />}
      </svg>
      <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">{view}</span>
    </div>
  );
  const save = () => {
    if (!mark) return;
    const detail = `${mark.view} · ${zone} · ${sizeNum} cm · ${kind.toLowerCase()} · ${blanch ? 'blanching' : 'non-blanching'}`;
    const text = `Skin check for ${resident.first}: ${kind.toLowerCase()} ${sizeNum} cm on the ${zone}, ${blanch ? 'blanching' : 'non-blanching'}. Body map updated.${!blanch || kind === 'Pressure ulcer' ? ' Possible pressure damage: senior and district nurse informed.' : ''}`;
    onSave({ id: uid('ATT'), kind: 'skin', label: 'Body map', detail }, text);
  };
  return (
    <PhoneSheet title={`Body map · ${resident.first}`} icon={UserRound} onClose={onClose}>
      <div className="grid grid-cols-2 gap-2 rounded-2xl border border-white/10 bg-black/20 py-3">{figure('Front')}{figure('Back')}</div>
      <p className="mt-2 text-center text-[12px] text-slate-300">{mark ? <>Mark on the <span className="font-semibold text-white">{zone}</span></> : 'Tap the body outline where you saw the mark'}</p>
      <div className="mt-3 grid grid-cols-2 gap-1.5">
        {['Red mark', 'Bruise', 'Skin tear', 'Pressure ulcer'].map((k) => <button key={k} type="button" onClick={() => setKind(k)} className={`rounded-xl border py-2 text-[12px] font-semibold ${kind === k ? 'border-teal-300/60 bg-teal-400/20 text-teal-50' : 'border-white/10 text-slate-300'}`}>{k}</button>)}
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <div><label htmlFor="bm-size" className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Size (cm)</label><input id="bm-size" inputMode="decimal" value={size} maxLength={4} onChange={(e) => setSize(e.target.value.replace(/[^0-9.]/g, ''))} className="tnum mt-1 w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-[13px] text-white focus:outline-none" /></div>
        <label className="mt-5 flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3 text-[12px] text-slate-200"><input type="checkbox" checked={blanch} onChange={() => setBlanch((v) => !v)} className="h-4 w-4 accent-teal-500" />Blanches when pressed</label>
      </div>
      {!blanch && <p className="mt-2 rounded-xl bg-red-500/10 p-2 text-[12px] text-red-100">Non-blanching redness can mean pressure damage. Tell the senior now.</p>}
      <button type="button" className={`${btn.primaryDark} mt-4 w-full`} disabled={!valid} onClick={save}><Check className="h-4 w-4" aria-hidden />Save body map</button>
    </PhoneSheet>
  );
}

function ObsView({ state, now, resident, act, notify }: { state: State; now: number; resident: Resident; act: Act; notify: Notify }) {
  const me = useMe();
  const d = OBS_DEFAULTS[resident.id];
  const [f, setF] = useState<Record<string, string>>({ rr: String(d.rr), spo2: String(d.spo2), sbp: String(d.sbp), dbp: String(d.dbp), pulse: String(d.pulse), temp: String(d.temp) });
  const [o2, setO2] = useState(false);
  const [acvpu, setAcvpu] = useState<Obs['acvpu']>('A');
  const [soft, setSoft] = useState<string[]>([]);
  const ranges: Record<string, [number, number, string]> = { rr: [4, 60, 'Resp rate /min'], spo2: [50, 100, 'SpO2 %'], sbp: [50, 260, 'BP systolic'], dbp: [30, 160, 'BP diastolic'], pulse: [20, 220, 'Pulse /min'], temp: [32, 43, 'Temp °C'] };
  const nums = Object.fromEntries(Object.entries(f).map(([k, v]) => [k, Number(v)]));
  const invalid = Object.entries(ranges).filter(([k, [lo, hi]]) => !(f[k] !== '' && Number.isFinite(nums[k]) && nums[k] >= lo && nums[k] <= hi)).map(([k]) => k);
  const obs: Obs = { rr: nums.rr, spo2: nums.spo2, o2, sbp: nums.sbp, dbp: nums.dbp, pulse: nums.pulse, acvpu, temp: nums.temp };
  const res = invalid.length ? null : news2(obs);
  const last = state.logs.filter((l) => l.residentId === resident.id && l.source === 'obs').sort((a, b) => b.time - a.time)[0];
  const tone = !res ? 'border-white/10 bg-white/[0.04]' : res.total >= 7 ? 'border-red-400/60 bg-red-500/20' : res.total >= 5 || res.single3 ? 'border-amber-400/50 bg-amber-500/15' : res.total >= 1 || soft.length ? 'border-cyan-400/30 bg-cyan-500/10' : 'border-emerald-400/30 bg-emerald-500/10';
  const record = () => {
    if (!res) return;
    const text = `NEWS2 observations: RR ${obs.rr}, SpO2 ${obs.spo2}% on ${o2 ? 'oxygen' : 'air'}, BP ${obs.sbp}/${obs.dbp}, pulse ${obs.pulse}, ${acvpu === 'A' ? 'alert' : `ACVPU ${acvpu}`}, temperature ${obs.temp} C. NEWS2 score ${res.total} (${res.band}). Soft signs: ${soft.length ? soft.join(', ').toLowerCase() : 'none'}. Action: ${res.action}`;
    const entry = makeLog({ residentId: resident.id, time: now, text, source: 'obs', author: me });
    const escalate = res.total >= 5 || res.single3 || soft.length > 0;
    entry.risk = escalate;
    entry.riskReasons = escalate ? [`NEWS2 ${res.total} (${res.band})`, ...soft] : [];
    entry.cqc = ['Safe', 'Effective'];
    act({ type: 'ADD_LOG', entry, actor: me }, 'worker');
    notify(`Observations saved · NEWS2 ${res.total}${escalate ? ' · escalated to manager' : ''}`, res.total >= 7 ? 'red' : escalate ? 'amber' : 'emerald', 'worker');
    setSoft([]);
  };
  return (
    <div className="cos-scroll h-full space-y-3 overflow-y-auto px-4 pb-6">
      {last && <p className="tnum px-1 text-[11px] text-slate-400">Last set {fmt(last.time)} by {last.author}</p>}
      <div className="grid grid-cols-2 gap-2">
        {Object.entries(ranges).map(([k, [, , label]]) => (
          <div key={k}>
            <label htmlFor={`obs-${k}`} className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">{label}</label>
            <div className="relative">
              <input id={`obs-${k}`} inputMode="decimal" maxLength={5} value={f[k]} onChange={(e) => setF((x) => ({ ...x, [k]: e.target.value.replace(/[^0-9.]/g, '') }))} className={`tnum mt-1 w-full rounded-xl border bg-black/30 px-3 py-2 text-[14px] font-semibold text-white focus:outline-none ${invalid.includes(k) ? 'border-red-400/60' : 'border-white/10 focus:border-teal-400/60'}`} />
              {res && k in res.parts && <span className={`tnum absolute right-2 top-1/2 mt-0.5 -translate-y-1/2 rounded-md px-1.5 text-[11px] font-bold ${(res.parts as Record<string, number>)[k] === 3 ? 'bg-red-500 text-white' : (res.parts as Record<string, number>)[k] > 0 ? 'bg-amber-400 text-slate-950' : 'bg-white/10 text-slate-300'}`}>{(res.parts as Record<string, number>)[k]}</span>}
            </div>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-2">
        <label className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-[12px] text-slate-200"><input type="checkbox" checked={o2} onChange={() => setO2((v) => !v)} className="h-4 w-4 accent-teal-500" />On oxygen</label>
        <div><label htmlFor="obs-acvpu" className="sr-only">Consciousness (ACVPU)</label>
          <select id="obs-acvpu" value={acvpu} onChange={(e) => setAcvpu(e.target.value as Obs['acvpu'])} className="w-full rounded-xl border border-white/10 bg-slate-800 px-3 py-2 text-[12px] text-white">
            <option value="A">Alert</option><option value="C">New confusion</option><option value="V">Responds to voice</option><option value="P">Responds to pain</option><option value="U">Unresponsive</option>
          </select></div>
      </div>
      <fieldset className="rounded-2xl border border-white/10 bg-white/[0.04] p-3">
        <legend className="px-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400">RESTORE2 soft signs</legend>
        {NEWS2_SOFT_SIGNS.map((x) => <label key={x} className="mt-1 flex items-center gap-2 text-[12px] text-slate-200"><input type="checkbox" checked={soft.includes(x)} onChange={() => setSoft((v) => (v.includes(x) ? v.filter((y) => y !== x) : [...v, x]))} className="h-4 w-4 accent-teal-500" />{x}</label>)}
      </fieldset>
      <div className={`rounded-2xl border p-3 ${tone}`} aria-live="polite">
        {res ? (
          <>
            <p className="flex items-baseline gap-2"><span className="cos-display tnum text-3xl font-bold text-white">{res.total}</span><span className="text-[12px] font-semibold text-slate-200">NEWS2 · {res.band} risk</span></p>
            <p className="mt-1 text-[12px] text-slate-100">{res.action}{soft.length && res.total < 5 ? ' Soft signs present: discuss with the senior and consider the GP or NHS 111.' : ''}</p>
            <p className="mt-1 text-[10px] text-slate-400">Follow your local RESTORE2 escalation protocol. NEWS2 supports, and never replaces, clinical judgement.</p>
          </>
        ) : <p className="text-[12px] text-red-200">Check the highlighted values. They are outside the possible range.</p>}
      </div>
      <button type="button" className={`${btn.primaryDark} w-full`} disabled={!res} onClick={record}><HeartPulse className="h-4 w-4" aria-hidden />Save observations</button>
    </div>
  );
}

function FluidBar({ r, total, now, surface = 'dark' }: { r: Resident; total: number; now: number; surface?: Surface }) {
  const pct = clamp(total / r.fluidLimit, 0, 1.2);
  const fs = fluidStatus(r, total, now);
  const expected = r.fluidKind === 'target' ? clamp((now - SHIFT_START) / (12 * HOUR), 0, 1) : null;
  const fill = fs.tone === 'red' ? 'bg-red-500' : fs.tone === 'amber' ? 'bg-amber-400' : r.fluidKind === 'restriction' ? 'bg-teal-400' : 'bg-cyan-400';
  return (
    <div>
      <div className={`flex items-baseline justify-between text-[11px] ${surface === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>
        <span className={`tnum font-semibold ${surface === 'dark' ? 'text-white' : 'text-slate-900'}`}>{thousands(total)} <span className="font-normal">/ {thousands(r.fluidLimit)} ml</span></span>
        <span>{r.fluidKind === 'restriction' ? 'Restriction' : 'Target'}</span>
      </div>
      <div className={`relative mt-1 h-2 overflow-hidden rounded-full ${surface === 'dark' ? 'bg-white/10' : 'bg-slate-200'}`}>
        <div className={`h-full rounded-full ${fill} transition-all`} style={{ width: `${Math.min(pct, 1) * 100}%` }} />
        {expected !== null && <span className={`absolute top-0 h-full w-0.5 ${surface === 'dark' ? 'bg-white/60' : 'bg-slate-500'}`} style={{ left: `${expected * 100}%` }} title="Expected by now" />}
      </div>
      <p className={`mt-1 text-[11px] ${fs.tone === 'emerald' ? (surface === 'dark' ? 'text-emerald-300' : 'text-emerald-700') : fs.tone === 'red' ? (surface === 'dark' ? 'text-red-300' : 'text-red-600') : (surface === 'dark' ? 'text-amber-300' : 'text-amber-700')}`}>{fs.label}</p>
    </div>
  );
}

function HandoverTab({ state, now, resident, act, onReport }: { state: State; now: number; resident: Resident; act: Act; onReport: () => void }) {
  const points = handoverPoints(state, now).filter((p) => p.residentId === resident.id);
  const care = state.care[resident.id] ?? {};
  const done = resident.careItems.filter((c) => care[c]).length;
  const meal = mealAverage(state.logs, resident.id);
  const mood = [...state.logs].filter((l) => l.residentId === resident.id && l.tags.mood).sort((a, b) => b.time - a.time)[0]?.tags.mood;
  return (
    <div className="cos-scroll h-full space-y-3 overflow-y-auto px-4 pb-6">
      <div className="grid grid-cols-3 gap-2">
        {RESIDENTS.map((r) => {
          const t = fluidTotal(state.logs, r.id);
          const fs = fluidStatus(r, t, now);
          return (
            <div key={r.id} className={`rounded-2xl border p-2.5 text-center ${r.id === resident.id ? 'border-teal-300/40 bg-teal-400/10' : 'border-white/10 bg-white/[0.04]'}`}>
              <Ring size={54} stroke={5} progress={t / r.fluidLimit} color={fs.tone === 'emerald' ? (r.fluidKind === 'restriction' ? '#2DD4BF' : '#22D3EE') : fs.tone === 'red' ? '#EF4444' : '#F59E0B'} track="rgba(255,255,255,.08)">
                <Droplets className="h-4 w-4 text-slate-300" aria-hidden />
              </Ring>
              <p className="mt-1 text-[11px] font-semibold text-white">{r.first}</p>
              <p className="tnum text-[10px] text-slate-400">{thousands(t)} ml</p>
            </div>
          );
        })}
      </div>
      <div className="rounded-2xl border border-white/10 bg-white/[0.045] p-3.5">
        <p className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400"><Droplets className="h-3.5 w-3.5 text-cyan-300" aria-hidden />Fluid balance · {resident.first}</p>
        <FluidBar r={resident} total={fluidTotal(state.logs, resident.id)} now={now} />
        <div className="mt-3 grid grid-cols-2 gap-2 text-[12px]">
          <div className="rounded-xl bg-white/[0.04] p-2"><p className="text-[10px] uppercase tracking-wider text-slate-500">Meals average</p><p className="tnum font-semibold text-white">{meal === null ? 'No data' : `${meal}% eaten`}</p></div>
          <div className="rounded-xl bg-white/[0.04] p-2"><p className="text-[10px] uppercase tracking-wider text-slate-500">Latest mood</p><p className="truncate font-semibold text-white">{mood ?? 'Not recorded'}</p></div>
        </div>
      </div>
      <div className="rounded-2xl border border-white/10 bg-white/[0.045] p-3.5">
        <div className="mb-2 flex items-center justify-between"><p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400"><ClipboardCheck className="h-3.5 w-3.5 text-emerald-300" aria-hidden />Personal care</p><span className="tnum text-[11px] text-slate-400">{done} of {resident.careItems.length}</span></div>
        <ul className="space-y-1">
          {resident.careItems.map((c) => (
            <li key={c}>
              <label className="flex cursor-pointer items-center gap-2.5 rounded-xl px-2 py-1.5 text-[12px] hover:bg-white/[0.04]">
                <input type="checkbox" checked={!!care[c]} onChange={() => act({ type: 'TOGGLE_CARE', residentId: resident.id, item: c, now }, 'worker')} className="h-4 w-4 accent-emerald-500" />
                <span className={care[c] ? 'text-slate-400 line-through' : 'text-slate-100'}>{c}</span>
              </label>
            </li>
          ))}
        </ul>
      </div>
      <div className="rounded-2xl border border-white/10 bg-white/[0.045] p-3.5">
        <p className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400"><Moon className="h-3.5 w-3.5 text-cyan-300" aria-hidden />Outgoing handover for night team</p>
        <ul className="space-y-1.5 text-[12px] leading-5">
          {points.map((p, i) => <li key={i} className="flex gap-2"><span className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${p.tone === 'red' ? 'bg-red-400' : p.tone === 'amber' ? 'bg-amber-400' : p.tone === 'teal' ? 'bg-teal-400' : 'bg-slate-500'}`} /><span className="text-slate-200">{p.text}</span></li>)}
        </ul>
        <button type="button" onClick={onReport} className={`${btn.primaryDark} mt-3 w-full py-2.5`}><Sparkles className="h-4 w-4" aria-hidden />Open full shift report</button>
      </div>
    </div>
  );
}

function ReportBody({ report, surface }: { report: ShiftReport; surface: Surface }) {
  const dark = surface === 'dark';
  return (
    <div className="space-y-4">
      {report.sections.map((sec) => {
        const r = residentById(sec.residentId);
        return (
          <section key={sec.residentId} className={`rounded-2xl border p-3 ${dark ? 'border-white/10 bg-white/[0.04]' : 'border-slate-200 bg-white'}`}>
            <div className="flex items-center gap-2"><Avatar name={r.name} hue={r.hue} size="h-7 w-7 text-[10px]" /><h4 className={`text-[13px] font-semibold ${dark ? 'text-white' : 'text-slate-900'}`}>{r.name}</h4><span className={`tnum ml-auto text-[11px] ${dark ? 'text-slate-400' : 'text-slate-500'}`}>{r.room}</span></div>
            <dl className={`mt-2 grid grid-cols-3 gap-1.5 text-center text-[11px] ${dark ? 'text-slate-300' : 'text-slate-600'}`}>
              <div className={`rounded-lg p-1.5 ${dark ? 'bg-black/20' : 'bg-slate-50'}`}><dt className="text-[10px] uppercase tracking-wider opacity-70">Fluids</dt><dd className="tnum font-semibold">{thousands(sec.fluid)} ml</dd></div>
              <div className={`rounded-lg p-1.5 ${dark ? 'bg-black/20' : 'bg-slate-50'}`}><dt className="text-[10px] uppercase tracking-wider opacity-70">Meals</dt><dd className="tnum font-semibold">{sec.mealAvg === null ? 'n/a' : `${sec.mealAvg}%`}</dd></div>
              <div className={`rounded-lg p-1.5 ${dark ? 'bg-black/20' : 'bg-slate-50'}`}><dt className="text-[10px] uppercase tracking-wider opacity-70">Meds</dt><dd className="tnum font-semibold">{sec.medsGiven} given{sec.medsRefused ? ` · ${sec.medsRefused} ref.` : ''}{sec.prnGiven ? ` · ${sec.prnGiven} PRN` : ''}</dd></div>
            </dl>
            <ol className="mt-2 space-y-1">
              {sec.lines.map((ln, i) => <li key={i} className={`grid grid-cols-[38px_1fr] gap-2 text-[11px] leading-4 ${dark ? 'text-slate-300' : 'text-slate-700'}`}><span className="tnum font-semibold">{fmt(ln.time)}</span><span>{truncate(ln.text, 220)}</span></li>)}
            </ol>
            {sec.careOutstanding.length > 0 && <p className={`mt-2 text-[11px] ${dark ? 'text-amber-200' : 'text-amber-700'}`}>Outstanding care: {sec.careOutstanding.join(', ')}</p>}
          </section>
        );
      })}
      <section className={`rounded-2xl border p-3 ${dark ? 'border-cyan-400/25 bg-cyan-500/10' : 'border-cyan-200 bg-cyan-50'}`}>
        <h4 className={`flex items-center gap-1.5 text-[12px] font-semibold ${dark ? 'text-cyan-100' : 'text-cyan-900'}`}><Moon className="h-3.5 w-3.5" aria-hidden />Night handover</h4>
        <ul className={`mt-1.5 space-y-1 text-[11px] leading-4 ${dark ? 'text-cyan-50/90' : 'text-cyan-950'}`}>{report.handover.map((h, i) => <li key={i}><span className="font-semibold">{residentById(h.residentId).first}:</span> {h.text}</li>)}</ul>
      </section>
    </div>
  );
}

function ShiftReportSheet({ state, now, act, notify, onClose }: { state: State; now: number; act: Act; notify: Notify; onClose: () => void }) {
  const [building, setBuilding] = useState(true);
  const draft = useMemo(() => synthesiseReport(state, now), [state, now]);
  useEffect(() => { const t = window.setTimeout(() => setBuilding(false), 1100); return () => window.clearTimeout(t); }, []);
  const submitted = state.report;
  return (
    <PhoneSheet title="12-hour shift report" icon={FileText} onClose={onClose}>
      {building ? (
        <div className="flex flex-col items-center py-10 text-center">
          <span className="h-10 w-10 rounded-full border-[3px] border-teal-300 border-t-transparent cos-spin" />
          <p className="mt-3 text-[13px] text-slate-200">Synthesising {state.logs.length} micro-notes, {state.meds.length} eMAR records and {state.incidents.length} incident{state.incidents.length === 1 ? '' : 's'}</p>
          <p className="text-[11px] text-slate-500">Chronological, person-centred, mapped to CQC key questions</p>
        </div>
      ) : (
        <>
          <div className="mb-3 flex flex-wrap items-center gap-1.5">
            <Chip tone="teal" icon={FileCheck2}>Daily care report</Chip>
            <Chip icon={Clock}><span className="tnum">08:00 to {fmt(now)}</span></Chip>
            {submitted && <Chip tone={submitted.status === 'signed' ? 'emerald' : 'cyan'}>{submitted.status === 'signed' ? `Signed by ${submitted.signature?.by}` : `Submitted ${fmt(submitted.submittedAt ?? now)}`}</Chip>}
          </div>
          <ReportBody report={submitted && submitted.status === 'signed' ? submitted : draft} surface="dark" />
          <button type="button" className={`${btn.primaryDark} mt-4 w-full`} disabled={submitted?.status === 'signed'} onClick={() => { act({ type: 'SUBMIT_REPORT', report: draft, now }, 'worker'); notify('Shift report submitted to supervisor', 'emerald', 'worker'); onClose(); }}>
            <Send className="h-4 w-4" aria-hidden />{submitted ? (submitted.status === 'signed' ? 'Signed off by manager' : 'Resubmit updated report') : 'Submit to supervisor'}
          </button>
        </>
      )}
    </PhoneSheet>
  );
}

/* ============================== Manager desktop portal ============================== */

function ManagerPortal({ state, now, act, notify, tab, setTab, sim, setSim, compact }: { state: State; now: number; act: Act; notify: Notify; tab: ManagerTab; setTab: (t: ManagerTab) => void; sim: boolean; setSim: (b: boolean) => void; compact: boolean }) {
  const [selectedId, setSelectedId] = useState<string | null>('LOG-1315');
  const [filter, setFilter] = useState<TriageFilter>('all');
  const [reportOpen, setReportOpen] = useState(false);
  const [fw, setFw] = useState<FrameworkId>('saf2023');
  const logs = state.logs.filter((l) => l.synced);
  const slaBreached = logs.filter((l) => l.status === 'clarification' && l.escalatedAt).length;
  const staffAlerts = STAFF.reduce((a, x) => a + TRAINING.filter((t) => expiryStatus(x.training[t], now).tone === 'red').length, 0);
  const em = emarStats(state.meds, now);
  const openClar = logs.filter((l) => l.status === 'clarification').length;
  const newInc = state.incidents.filter((i) => i.synced && i.status === 'new').length;
  const totalInc = state.incidents.filter((i) => i.synced).length;
  const d = new Date(now);
  const metrics: Array<{ label: string; value: string; sub: string; icon: React.ElementType; tone: Tone; go: () => void; live?: boolean }> = [
    { label: 'Active shift logs', value: String(logs.length), sub: '3 staff on shift · live', icon: Activity, tone: 'teal', go: () => { setTab('floor'); }, live: true },
    { label: 'eMAR administration', value: `${em.rate.toFixed(1)}%`, sub: `${em.given} given · ${em.refused} refused · ${em.dueNow} due now · ${em.overdue} missed`, icon: Pill, tone: em.overdue ? 'red' : em.refused ? 'amber' : 'emerald', go: () => setTab('matrix') },
    { label: 'Open clarifications', value: String(openClar), sub: openClar ? (slaBreached ? `${slaBreached} past ${CLARIFY_SLA_MIN}-min SLA, escalated` : 'Awaiting worker reply') : 'All threads closed', icon: MessageSquareWarning, tone: slaBreached ? 'red' : openClar ? 'amber' : 'emerald', go: () => { setFilter('clarification'); setTab('triage'); } },
    { label: 'Safeguarding and ABC', value: String(totalInc), sub: newInc ? `${newInc} awaiting triage` : 'All reviewed', icon: ShieldAlert, tone: newInc ? 'red' : 'emerald', go: () => { setFilter('incidents'); setTab('triage'); } },
  ];
  const tabs: Array<{ id: ManagerTab; label: string; icon: React.ElementType; badge?: number }> = [
    { id: 'triage', label: 'Shift triage', icon: ClipboardCheck, badge: logs.filter((l) => l.status === 'pending' || l.status === 'clarified').length },
    { id: 'floor', label: 'Live floor feed', icon: Activity },
    { id: 'audit', label: 'CQC audit hub', icon: ShieldCheck },
    { id: 'matrix', label: 'Care plan matrix', icon: LayoutGrid },
    { id: 'workforce', label: 'Workforce', icon: GraduationCap, badge: staffAlerts },
  ];
  const openEntry = (id: string) => { setSelectedId(id); setFilter('all'); setTab('triage'); };

  return (
    <div className={`flex min-h-0 min-w-0 flex-col overflow-hidden rounded-[28px] border border-white/30 bg-[#F6F8F7]/[0.94] text-slate-800 shadow-2xl shadow-teal-950/30 backdrop-blur-xl ${compact ? 'h-[820px] flex-none' : 'h-[calc(100vh-112px)] min-h-[720px]'}`}>
      <div className="flex shrink-0 items-center gap-2 border-b border-slate-200/80 bg-white/70 px-4 py-2">
        <span className="flex gap-1.5" aria-hidden><span className="h-3 w-3 rounded-full bg-red-400" /><span className="h-3 w-3 rounded-full bg-amber-400" /><span className="h-3 w-3 rounded-full bg-emerald-400" /></span>
        <span className="mx-auto flex max-w-sm flex-1 items-center justify-center gap-1.5 truncate rounded-lg bg-slate-100 px-3 py-1 text-[11px] text-slate-500"><Lock className="h-3 w-3 text-emerald-600" aria-hidden />app.careplanos.io/willow-lane/command</span>
        <span className="w-12" />
      </div>
      <header className="flex shrink-0 flex-wrap items-center gap-x-4 gap-y-2 px-5 pb-3 pt-4">
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-teal-700">Clinical command centre</p>
          <h2 className="cos-display truncate text-xl font-bold text-slate-900">{PROVIDER.name}</h2>
        </div>
        <div className="flex items-center gap-3 text-[12px] text-slate-500">
          <span className="tnum hidden sm:inline">Tue 10 Nov 2026 · {pad(d.getUTCHours())}:{pad(d.getUTCMinutes())}</span>
          <span className="flex items-center gap-2 rounded-full border border-slate-200 bg-white py-1 pl-1 pr-3"><Avatar name="Sarah Okafor" hue="from-emerald-300 to-teal-500" size="h-7 w-7 text-[10px]" /><span className="font-semibold text-slate-700">Sarah Okafor, RM</span></span>
        </div>
      </header>

      {state.sos && (state.sos.status === 'active' || state.sos.status === 'acknowledged') && <SosBanner state={state} now={now} act={act} notify={notify} />}

      <div className="grid shrink-0 grid-cols-2 gap-2 px-5 lg:grid-cols-4">
        {metrics.map((m) => (
          <button key={m.label} type="button" onClick={m.go} className="group rounded-2xl border border-slate-200/80 bg-white/90 p-3 text-left shadow-sm transition hover:border-teal-300 hover:shadow-md">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">{m.label}</span>
              <span className={`grid h-7 w-7 place-items-center rounded-lg border ${TONE_LIGHT[m.tone]}`}><m.icon className="h-3.5 w-3.5" aria-hidden /></span>
            </div>
            <p className="cos-display tnum mt-1 flex items-center gap-2 text-2xl font-bold text-slate-900">{m.value}{m.live && <span className="relative flex h-2 w-2"><span className="cos-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400" /><span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" /></span>}</p>
            <p className="truncate text-[11px] text-slate-500">{m.sub}</p>
          </button>
        ))}
      </div>

      <nav className="cos-noscroll mt-3 flex shrink-0 gap-1 overflow-x-auto border-b border-slate-200/80 px-5" aria-label="Manager workspaces">
        {tabs.map((t) => (
          <button key={t.id} type="button" onClick={() => setTab(t.id)} aria-current={tab === t.id ? 'page' : undefined} className={`relative flex shrink-0 items-center gap-1.5 px-3 py-2.5 text-[13px] font-semibold transition ${tab === t.id ? 'text-teal-700' : 'text-slate-500 hover:text-slate-800'}`}>
            <t.icon className="h-4 w-4" aria-hidden />{t.label}
            {t.badge ? <span className={`tnum rounded-full px-1.5 text-[10px] font-bold text-white ${t.id === 'workforce' ? 'bg-red-600' : 'bg-slate-900'}`}>{t.badge}</span> : null}
            {tab === t.id && <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-teal-600" />}
          </button>
        ))}
      </nav>

      <div className="min-h-0 flex-1">
        {tab === 'triage' && <TriageWorkspace fw={fw} state={state} now={now} act={act} notify={notify} selectedId={selectedId} setSelectedId={setSelectedId} filter={filter} setFilter={setFilter} openReport={() => setReportOpen(true)} />}
        {tab === 'floor' && <FloorWorkspace state={state} now={now} sim={sim} setSim={setSim} openEntry={openEntry} />}
        {tab === 'audit' && <AuditWorkspace fw={fw} setFw={setFw} state={state} now={now} act={act} notify={notify} openEntry={openEntry} />}
        {tab === 'matrix' && <MatrixWorkspace state={state} now={now} act={act} notify={notify} />}
        {tab === 'workforce' && <WorkforceWorkspace state={state} now={now} act={act} notify={notify} />}
      </div>

      {reportOpen && state.report && (
        <Modal title={`Shift report ${state.report.id}`} icon={FileText} onClose={() => setReportOpen(false)} wide>
          <div className="p-5">
            <div className="mb-4 flex flex-wrap items-center gap-2 text-[12px] text-slate-600">
              <Chip surface="light" tone="teal">Submitted by David S. at {fmt(state.report.submittedAt ?? now)}</Chip>
              {state.report.signature && <Chip surface="light" tone="emerald" icon={Lock}>Signed {fmt(state.report.signature.at)} · {state.report.signature.hash}</Chip>}
            </div>
            <ReportBody report={state.report} surface="light" />
          </div>
          <div className="sticky bottom-0 flex justify-end gap-2 border-t border-slate-200 bg-white/95 px-5 py-3">
            <button type="button" className={btn.secondary} onClick={() => setReportOpen(false)}>Close</button>
            <button type="button" className={btn.primary} disabled={state.report.status === 'signed'} onClick={() => { act({ type: 'SIGN_REPORT', now }, 'manager'); notify('Shift report signed and locked', 'emerald', 'manager'); }}><PenLine className="h-4 w-4" aria-hidden />{state.report.status === 'signed' ? 'Signed' : 'Approve and sign report'}</button>
          </div>
        </Modal>
      )}
    </div>
  );
}

function SosBanner({ state, now, act, notify }: { state: State; now: number; act: Act; notify: Notify }) {
  const sos = state.sos as Sos;
  const [audio, setAudio] = useState(false);
  const [outcome, setOutcome] = useState('');
  const [responder, setResponder] = useState('Amina Kamara');
  const ctxRef = useRef<AudioContext | null>(null);
  useEffect(() => {
    if (!audio || sos.status !== 'active') return undefined;
    const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return undefined;
    if (!ctxRef.current) { try { ctxRef.current = new Ctor(); } catch { return undefined; } }
    const ctx = ctxRef.current;
    const beep = () => {
      const o = ctx.createOscillator(); const g = ctx.createGain();
      o.frequency.value = 880; g.gain.setValueAtTime(0.0001, ctx.currentTime); g.gain.exponentialRampToValueAtTime(0.12, ctx.currentTime + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.25);
      o.connect(g); g.connect(ctx.destination); o.start(); o.stop(ctx.currentTime + 0.26);
    };
    beep();
    const i = window.setInterval(beep, 1200);
    return () => window.clearInterval(i);
  }, [audio, sos.status]);
  const r = residentById(sos.residentId);
  return (
    <div className="mx-5 mb-3 shrink-0 rounded-2xl border border-red-300 p-3 cos-flash" role="alert">
      <div className="flex flex-wrap items-center gap-3">
        <span className="relative grid h-10 w-10 shrink-0 place-items-center rounded-full bg-red-500 text-white"><Siren className="h-5 w-5" aria-hidden /><span className="cos-ping absolute inset-0 rounded-full bg-red-500/50" /></span>
        <div className="min-w-0 flex-1">
          <p className="text-[14px] font-bold text-red-800">Silent SOS · {sos.worker} needs support</p>
          <p className="flex flex-wrap items-center gap-x-3 text-[12px] text-red-700"><span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" aria-hidden />{sos.location}</span><span>With {r.name}</span><span className="tnum">{fmtDur(now - sos.raisedAt)} elapsed</span></p>
        </div>
        <button type="button" onClick={() => setAudio((a) => !a)} className="flex items-center gap-1.5 rounded-xl border border-red-200 bg-white px-3 py-2 text-[12px] font-semibold text-red-700" aria-pressed={audio}>{audio ? <Volume2 className="h-4 w-4" aria-hidden /> : <VolumeX className="h-4 w-4" aria-hidden />}{audio ? 'Office audio on' : 'Office audio off'}</button>
      </div>
      {sos.status === 'active' ? (
        <div className="mt-2.5 flex flex-wrap items-center gap-2">
          <label htmlFor="responder" className="text-[12px] font-semibold text-red-800">Dispatch</label>
          <select id="responder" value={responder} onChange={(e) => setResponder(e.target.value)} className="rounded-xl border border-red-200 bg-white px-2.5 py-2 text-[12px] text-slate-800">
            <option>Amina Kamara</option><option>Tomasz Nowak</option><option>Sarah Okafor (self)</option>
          </select>
          <button type="button" className="inline-flex items-center gap-2 rounded-xl bg-red-600 px-3.5 py-2 text-[13px] font-semibold text-white hover:bg-red-700" onClick={() => { act({ type: 'ACK_SOS', now, responder }, 'manager'); notify(`${responder} dispatched to ${sos.location.split(' · ')[0]}`, 'red', 'manager'); setAudio(false); }}><Radio className="h-4 w-4" aria-hidden />Acknowledge and dispatch</button>
        </div>
      ) : (
        <div className="mt-2.5 flex flex-wrap items-center gap-2">
          <Chip surface="light" tone="emerald" icon={CheckCircle2}>{sos.responder} dispatched at {fmt(sos.ackAt ?? now)}</Chip>
          <label htmlFor="sos-outcome" className="sr-only">Outcome</label>
          <input id="sos-outcome" value={outcome} maxLength={200} onChange={(e) => setOutcome(e.target.value)} placeholder="Outcome, e.g. Leo settled, no injuries, debrief booked" className="min-w-[200px] flex-1 rounded-xl border border-red-200 bg-white px-3 py-2 text-[12px]" />
          <button type="button" disabled={outcome.trim().length < 5} className={btn.primary} onClick={() => { act({ type: 'RESOLVE_SOS', now, outcome }, 'manager'); notify('Emergency resolved and signed off', 'emerald', 'manager'); }}><PenLine className="h-4 w-4" aria-hidden />Resolve and sign off</button>
        </div>
      )}
    </div>
  );
}

type TriageFilter = 'all' | 'review' | 'clarification' | 'incidents' | 'flagged' | 'signed';

function TriageWorkspace({ fw, state, now, act, notify, selectedId, setSelectedId, filter, setFilter, openReport }: { fw: FrameworkId; state: State; now: number; act: Act; notify: Notify; selectedId: string | null; setSelectedId: (id: string | null) => void; filter: TriageFilter; setFilter: (f: TriageFilter) => void; openReport: () => void }) {
  const [q, setQ] = useState('');
  const logs = state.logs.filter((l) => l.synced);
  const filters: Array<{ id: TriageFilter; label: string; count: number }> = [
    { id: 'all', label: 'All', count: logs.length },
    { id: 'review', label: 'Needs review', count: logs.filter((l) => l.status === 'pending' || l.status === 'clarified').length },
    { id: 'clarification', label: 'Clarifying', count: logs.filter((l) => l.status === 'clarification').length },
    { id: 'incidents', label: 'Incidents', count: logs.filter((l) => l.incidentId).length },
    { id: 'flagged', label: 'CQC pack', count: logs.filter((l) => l.flagged).length },
    { id: 'signed', label: 'Signed', count: logs.filter((l) => l.status === 'approved').length },
  ];
  const visible = logs.filter((l) => {
    if (filter === 'review' && !(l.status === 'pending' || l.status === 'clarified')) return false;
    if (filter === 'clarification' && l.status !== 'clarification') return false;
    if (filter === 'incidents' && !l.incidentId) return false;
    if (filter === 'flagged' && !l.flagged) return false;
    if (filter === 'signed' && l.status !== 'approved') return false;
    if (q.trim()) { const s = q.toLowerCase(); return l.text.toLowerCase().includes(s) || resName(l.residentId).toLowerCase().includes(s) || l.author.toLowerCase().includes(s); }
    return true;
  }).sort((a, b) => {
    const pri = (l: LogEntry) => (l.status === 'clarified' ? 0 : l.risk && l.status === 'pending' ? 1 : 2);
    return pri(a) - pri(b) || b.time - a.time;
  });
  const selected = logs.find((l) => l.id === selectedId) ?? null;
  return (
    <div className="grid h-full min-h-0 grid-cols-1 md:grid-cols-[minmax(260px,320px)_1fr]">
      <div className="flex min-h-0 flex-col border-r border-slate-200/80">
        <div className="space-y-2 p-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden />
            <label htmlFor="triage-q" className="sr-only">Search logs</label>
            <input id="triage-q" value={q} maxLength={60} onChange={(e) => setQ(e.target.value)} placeholder="Search notes, residents, staff" className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-3 text-[13px] focus:border-teal-500 focus:outline-none" />
          </div>
          <div className="flex flex-wrap gap-1">
            {filters.map((f) => <button key={f.id} type="button" onClick={() => setFilter(f.id)} className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${filter === f.id ? 'border-teal-600 bg-teal-600 text-white' : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'}`}>{f.label} <span className="tnum opacity-70">{f.count}</span></button>)}
          </div>
        </div>
        <div className="cos-scroll min-h-0 flex-1 space-y-1.5 overflow-y-auto px-3 pb-3">
          {state.report && (
            <button type="button" onClick={openReport} className="flex w-full items-center gap-2.5 rounded-xl border border-cyan-200 bg-cyan-50 p-2.5 text-left">
              <FileText className="h-5 w-5 shrink-0 text-cyan-700" aria-hidden />
              <span className="min-w-0 flex-1"><span className="block text-[12px] font-semibold text-cyan-950">12-hour shift report · David S.</span><span className="block text-[11px] text-cyan-800">{state.report.status === 'signed' ? `Signed ${fmt(state.report.signature?.at ?? now)}` : `Submitted ${fmt(state.report.submittedAt ?? now)} · review and sign`}</span></span>
              <Chip surface="light" tone={state.report.status === 'signed' ? 'emerald' : 'cyan'}>{state.report.status === 'signed' ? 'Signed' : 'New'}</Chip>
            </button>
          )}
          {visible.length === 0 && <p className="p-6 text-center text-[13px] text-slate-500">No entries match this view.</p>}
          {visible.map((l) => {
            const r = residentById(l.residentId);
            const st = STATUS_META[l.status];
            const Icon = SOURCE_ICON[l.source];
            return (
              <button key={l.id} type="button" onClick={() => setSelectedId(l.id)} aria-pressed={selectedId === l.id} className={`w-full rounded-xl border p-2.5 text-left transition ${selectedId === l.id ? 'border-teal-500 bg-white shadow-md shadow-teal-900/10 ring-1 ring-teal-500/30' : 'border-slate-200/80 bg-white/70 hover:bg-white'}`}>
                <div className="flex items-center gap-2 text-[11px] text-slate-500">
                  <Avatar name={r.name} hue={r.hue} size="h-6 w-6 text-[9px]" />
                  <span className="font-semibold text-slate-800">{r.first}</span>
                  <span className="tnum">{fmt(l.time)}</span>
                  <Icon className="h-3.5 w-3.5 text-teal-600" aria-label={l.source} />
                  {l.flagged && <Flag className="h-3.5 w-3.5 text-teal-700" aria-label="In CQC pack" />}
                  {l.risk && l.status !== 'approved' && <ShieldAlert className="h-3.5 w-3.5 text-red-500" aria-label="AI risk flag" />}
                  {l.escalatedAt && l.status === 'clarification' && <Timer className="h-3.5 w-3.5 text-red-600" aria-label="Clarification SLA breached" />}
                  <span className="ml-auto"><Chip surface="light" tone={st.tone}>{l.status === 'approved' ? <><Lock className="h-3 w-3" aria-hidden />Signed</> : st.label.split(' · ')[0]}</Chip></span>
                </div>
                <p className="mt-1.5 line-clamp-2 text-[12px] leading-[18px] text-slate-700">{l.text}</p>
                <p className="mt-1 text-[10px] text-slate-400">{l.author}{l.thread.length ? ` · ${l.thread.length} message${l.thread.length > 1 ? 's' : ''}` : ''}{l.attachments.length ? ` · ${l.attachments.length} photo` : ''}</p>
              </button>
            );
          })}
        </div>
      </div>
      <div className="min-h-0 min-w-0">
        {selected ? <EntryDetail key={selected.id} fw={fw} log={selected} state={state} now={now} act={act} notify={notify} /> : (
          <div className="grid h-full place-items-center p-8 text-center text-slate-500"><div><ClipboardCheck className="mx-auto h-10 w-10 text-slate-300" aria-hidden /><p className="mt-2 text-sm">Select an entry to review, clarify or sign.</p></div></div>
        )}
      </div>
    </div>
  );
}

function EntryDetail({ fw, log, state, now, act, notify }: { fw: FrameworkId; log: LogEntry; state: State; now: number; act: Act; notify: Notify }) {
  const [composer, setComposer] = useState(false);
  const [question, setQuestion] = useState('');
  const [confirmSign, setConfirmSign] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [showRevisions, setShowRevisions] = useState(false);
  const [reviewNote, setReviewNote] = useState('');
  const [draftAction, setDraftAction] = useState<string | null>(null);
  const r = residentById(log.residentId);
  const incident = log.incidentId ? state.incidents.find((i) => i.id === log.incidentId) : undefined;
  const locked = log.status === 'approved' || log.status === 'rejected';
  const Icon = SOURCE_ICON[log.source];
  const lines = log.text.split('\n');
  const auditFor = state.audit.filter((e) => e.entity.split(',').includes(log.id) || (log.incidentId && e.entity === log.incidentId)).slice(-6);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="cos-scroll min-h-0 flex-1 space-y-4 overflow-y-auto p-5">
        <div className="flex flex-wrap items-start gap-3">
          <Avatar name={r.name} hue={r.hue} size="h-11 w-11 text-sm" />
          <div className="min-w-0 flex-1">
            <h3 className="cos-display text-lg font-bold text-slate-900">{r.name} <span className="tnum text-sm font-medium text-slate-500">{r.age}</span></h3>
            <p className="flex flex-wrap items-center gap-x-2 text-[12px] text-slate-500"><span className="tnum">NHS {maskNhs(r.nhs)}</span><span>·</span><span>{r.room}</span><span>·</span><span className="flex items-center gap-1"><Icon className="h-3.5 w-3.5 text-teal-600" aria-hidden />{log.source === 'voice' ? `Voice note ${log.durationSec}s` : log.source === 'emar' ? 'eMAR record' : log.source === 'incident' ? 'ABC incident' : log.source === 'photo' ? 'Photo note' : 'Typed note'}</span><span>·</span><span className="tnum">{fmtS(log.time)}</span><span>·</span><span>{log.author}</span></p>
          </div>
          <div className="flex flex-wrap gap-1.5"><Chip surface="light" tone={STATUS_META[log.status].tone}>{STATUS_META[log.status].label}</Chip>{log.flagged && <Chip surface="light" tone="teal" icon={Flag}>In CQC pack</Chip>}</div>
        </div>

        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="space-y-2 text-[14px] leading-6 text-slate-800">
            {lines.map((ln, i) => (i === 0 ? <p key={i}>{ln}</p> : <p key={i} className="rounded-xl bg-cyan-50 px-3 py-2 text-[13px] text-cyan-950"><span className="mr-1 font-semibold">AI-synthesised addendum.</span>{ln}</p>))}
          </div>
          {log.accent && <p className="mt-3 flex items-center gap-1.5 text-[11px] text-slate-500"><Sparkles className="h-3.5 w-3.5 text-teal-600" aria-hidden />Transcribed with the {log.accent} model at <span className="tnum">{log.confidence}%</span> confidence{log.dialect.length ? ` · normalised: ${log.dialect.join(', ')}` : ''}</p>}
          {log.original !== firstLine(log.text) && log.source !== 'emar' && log.source !== 'incident' && (
            <details className="mt-2 text-[12px] text-slate-500"><summary className="cursor-pointer font-semibold text-slate-600">Original transcript</summary><p className="mt-1 rounded-lg bg-slate-50 p-2">{log.original}</p></details>
          )}
        </section>

        <section className="grid gap-3 lg:grid-cols-2">
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Extracted clinical data</p>
            <TagChips tags={log.tags} surface="light" risk={log.risk} riskReasons={log.riskReasons} />
            {!Object.keys(log.tags).some((k) => (log.tags as Record<string, unknown>)[k] !== undefined) && <p className="text-[12px] text-slate-500">No structured data extracted.</p>}
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500">CQC key questions</p>
            <div className="flex flex-wrap gap-1.5">{log.cqc.map((dmn) => <Chip key={dmn} surface="light" tone="teal">{dmn}</Chip>)}</div>
            <p className="mt-2 text-[11px] leading-4 text-slate-500">{FRAMEWORKS[fw].short}: {evidenceRefs(log, fw).map(refLabel).join(' · ') || 'No mapped evidence yet'}</p>
          </div>
        </section>

        {log.attachments.length > 0 && <section className="grid gap-2 sm:grid-cols-2">{log.attachments.map((a) => <AttachmentThumb key={a.id} a={a} surface="light" />)}</section>}

        {incident && (
          <section className="rounded-2xl border border-amber-200 bg-amber-50/60 p-4">
            <div className="mb-3 flex flex-wrap items-center gap-2"><Brain className="h-4 w-4 text-amber-700" aria-hidden /><p className="text-[13px] font-semibold text-amber-900">ABC incident {incident.id}</p><Chip surface="light" tone={incident.severity === 'High' ? 'red' : 'amber'}>{incident.severity}</Chip>{incident.restrictive && <Chip surface="light" tone="red">Restrictive practice</Chip>}<span className="ml-auto"><Chip surface="light" tone={incident.status === 'reviewed' ? 'emerald' : 'red'}>{incident.status === 'reviewed' ? `Reviewed ${fmt(incident.reviewedAt ?? now)}` : 'Awaiting triage'}</Chip></span></div>
            <dl className="grid gap-2 md:grid-cols-3">
              {([['A', 'Antecedent', incident.antecedent, 'bg-cyan-100 text-cyan-900'], ['B', 'Behaviour', incident.behaviour, 'bg-amber-100 text-amber-900'], ['C', 'Consequence', incident.consequence, 'bg-emerald-100 text-emerald-900']] as const).map(([k, label, val, tone]) => (
                <div key={k} className="rounded-xl bg-white p-3"><dt className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500"><span className={`grid h-5 w-5 place-items-center rounded-md text-[11px] font-bold ${tone}`}>{k}</span>{label}</dt><dd className="mt-1 text-[12px] leading-5 text-slate-700">{val || 'Not stated'}</dd></div>
              ))}
            </dl>
            <div className="mt-2 flex flex-wrap gap-1.5">{incident.triggers.map((t) => <Chip key={t} surface="light" tone="amber">{t}</Chip>)}</div>
            {incident.restrictive && <p className="mt-2 text-[12px] text-red-700">Restrictive practice: {incident.restrictiveDetail}</p>}
            <div className="mt-3 rounded-xl border border-amber-200 bg-white p-3">
              <p className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500"><FileCheck2 className="h-3.5 w-3.5" aria-hidden />Statutory and follow-up actions</p>
              <ul className="space-y-1.5">
                {statutoryActions(incident, state).map((r) => {
                  const done = incident.statutory[r.action];
                  return (
                    <li key={r.action} className="flex flex-wrap items-center gap-2 text-[12px]">
                      {done ? <CheckCircle2 className="h-4 w-4 text-emerald-600" aria-label="Done" /> : <span className={`h-2.5 w-2.5 rounded-full ${r.level === 'Required' ? 'bg-red-500' : 'bg-amber-400'}`} aria-hidden />}
                      <span className="font-semibold text-slate-800">{r.action}</span>
                      <Chip surface="light" tone={done ? 'emerald' : r.level === 'Required' ? 'red' : 'amber'}>{done ? `Done ${fmt(done)}` : r.level}</Chip>
                      <span className="min-w-0 flex-1 text-[11px] text-slate-500">{r.why}</span>
                      {!done && <button type="button" className="rounded-lg border border-slate-200 px-2 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-50" onClick={() => setDraftAction(r.action)}>Draft</button>}
                    </li>
                  );
                })}
              </ul>
            </div>
            {incident.status === 'new' ? (
              <div className="mt-3 flex flex-wrap gap-2">
                <label htmlFor="inc-review" className="sr-only">Review note</label>
                <input id="inc-review" value={reviewNote} maxLength={200} onChange={(e) => setReviewNote(e.target.value)} placeholder="Review note, e.g. Add alarm-test warning to his visual schedule" className="min-w-[200px] flex-1 rounded-xl border border-amber-200 bg-white px-3 py-2 text-[12px]" />
                <button type="button" className={btn.primary} onClick={() => { act({ type: 'REVIEW_INCIDENT', id: incident.id, now, note: reviewNote }, 'manager'); notify('Incident reviewed. PBS learning recorded.', 'emerald', 'manager'); }}><CheckCircle2 className="h-4 w-4" aria-hidden />Mark reviewed</button>
              </div>
            ) : incident.reviewNote ? <p className="mt-2 text-[12px] text-emerald-800">Review: {incident.reviewNote}</p> : null}
          </section>
        )}

        {log.thread.length > 0 && (
          <section className="rounded-2xl border border-slate-200 bg-white p-4">
            <p className="mb-3 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500"><MessageSquareWarning className="h-3.5 w-3.5" aria-hidden />Clarification thread</p>
            <div className="space-y-2.5">
              {log.thread.map((m) => (
                <div key={m.id} className={`flex ${m.from === 'manager' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-[13px] leading-5 ${m.from === 'manager' ? 'rounded-br-md bg-teal-600 text-white' : 'rounded-bl-md border border-amber-200 bg-amber-50 text-amber-950'}`}>
                    <p className={`mb-1 flex items-center gap-1.5 text-[11px] ${m.from === 'manager' ? 'text-teal-100' : 'text-amber-700'}`}>{m.mode === 'voice' ? <AudioLines className="h-3 w-3" aria-hidden /> : <Keyboard className="h-3 w-3" aria-hidden />}<span className="font-semibold">{m.author}</span><span className="tnum">{fmtS(m.time)}</span>{m.mode === 'voice' && <span className="tnum">· {m.durationSec}s audio</span>}</p>
                    {m.text}
                  </div>
                </div>
              ))}
            </div>
            {log.status === 'clarification' && <p className="mt-3 flex items-center gap-1.5 text-[12px] text-amber-700"><span className="h-3 w-3 rounded-full border-2 border-amber-500 border-t-transparent cos-spin" aria-hidden />Waiting for {log.author}. They see an amber banner on their device.</p>}
            {log.status === 'clarification' && (() => { const q = [...log.thread].reverse().find((m) => m.from === 'manager'); if (!q) return null; const due = q.time + CLARIFY_SLA_MIN * MIN; return <p className={`mt-1 flex items-center gap-1.5 text-[12px] font-semibold ${log.escalatedAt ? 'text-red-700' : 'text-slate-600'}`}><Timer className="h-3.5 w-3.5" aria-hidden />{log.escalatedAt ? `SLA breached at ${fmt(due)}. Escalated to the deputy manager at ${fmt(log.escalatedAt)}.` : `${CLARIFY_SLA_MIN}-minute SLA: reply due by ${fmt(due)}, ${fmtDur(due - now)} left.`}</p>; })()}
          </section>
        )}

        {log.revisions.length > 0 && (
          <section className="rounded-2xl border border-slate-200 bg-white p-4">
            <button type="button" onClick={() => setShowRevisions((v) => !v)} className="flex w-full items-center gap-1.5 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500" aria-expanded={showRevisions}><History className="h-3.5 w-3.5" aria-hidden />Revision history ({log.revisions.length}) <ChevronDown className={`ml-auto h-4 w-4 transition ${showRevisions ? 'rotate-180' : ''}`} aria-hidden /></button>
            {showRevisions && log.revisions.map((rv, i) => <div key={i} className="mt-2 rounded-xl bg-slate-50 p-3 text-[12px]"><p className="text-slate-500"><span className="tnum">{fmtS(rv.time)}</span> · {rv.reason}</p><p className="mt-1 text-slate-700 line-through decoration-slate-300">{rv.text}</p></div>)}
          </section>
        )}

        {log.signature && (
          <section className="flex items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
            <span className="grid h-10 w-10 place-items-center rounded-full bg-emerald-600 text-white"><Lock className="h-5 w-5" aria-hidden /></span>
            <div className="min-w-0 text-[12px]"><p className="font-semibold text-emerald-900">Signed by {log.signature.by}, {log.signature.role}</p><p className="tnum text-emerald-800">{fmtS(log.signature.at)} · <span className="cos-mono">{log.signature.hash}</span> · record locked</p></div>
          </section>
        )}
        {log.reject && (
          <section className="rounded-2xl border border-red-200 bg-red-50 p-4 text-[12px]">
            <p className="font-semibold text-red-800">{log.reject.code} · {log.reject.route}</p>
            <p className="mt-1 text-red-700">{log.reject.note}</p>
            <p className="tnum mt-1 text-red-600">{log.reject.by} · {fmtS(log.reject.at)}</p>
          </section>
        )}

        <section className="rounded-2xl border border-slate-200 bg-white p-4">
          <p className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500"><Link2 className="h-3.5 w-3.5" aria-hidden />Audit stamps</p>
          <ol className="space-y-1">
            {auditFor.map((e) => <li key={e.seq} className="grid grid-cols-[70px_1fr] gap-2 text-[11px]"><span className="tnum text-slate-500">{fmtS(e.time)}</span><span className="min-w-0 text-slate-700"><span className="font-semibold">{e.action.replace(/_/g, ' ').toLowerCase()}</span> · {e.actor} · <span className="cos-mono text-slate-400">{e.hash.slice(0, 10)}</span></span></li>)}
          </ol>
        </section>

        {composer && (
          <section className="rounded-2xl border border-amber-300 bg-amber-50 p-4 cos-rise">
            <p className="mb-2 text-[13px] font-semibold text-amber-900">Request clarification from {log.author}</p>
            <div className="flex flex-wrap gap-1.5">{CLARIFY_PRESETS.map((p) => <button key={p} type="button" onClick={() => setQuestion(p)} className={`rounded-full border px-2.5 py-1 text-left text-[11px] ${question === p ? 'border-amber-500 bg-amber-200 text-amber-950' : 'border-amber-200 bg-white text-amber-900 hover:bg-amber-100'}`}>{truncate(p, 58)}</button>)}</div>
            <label htmlFor="clar-q" className="sr-only">Question</label>
            <textarea id="clar-q" rows={3} maxLength={400} value={question} onChange={(e) => setQuestion(e.target.value)} placeholder="Ask exactly what you need for the record" className="mt-2 w-full resize-none rounded-xl border border-amber-200 bg-white px-3 py-2 text-[13px] focus:border-amber-500 focus:outline-none" />
            <div className="mt-2 flex justify-end gap-2">
              <button type="button" className={btn.secondary} onClick={() => setComposer(false)}>Cancel</button>
              <button type="button" className={btn.amber} disabled={question.trim().length < 8} onClick={() => { act({ type: 'REQUEST_CLARIFICATION', logId: log.id, msg: { id: uid('MSG'), from: 'manager', author: MANAGER.name, time: now, text: question.trim(), mode: 'text' } }, 'manager'); notify(`Clarification sent to ${log.author}'s device`, 'amber', 'manager'); setComposer(false); setQuestion(''); }}><Send className="h-4 w-4" aria-hidden />Send to {log.author}</button>
            </div>
          </section>
        )}
        {confirmSign && (
          <section className="rounded-2xl border border-emerald-300 bg-emerald-50 p-4 cos-rise">
            <p className="text-[13px] font-semibold text-emerald-900">Sign as Sarah Okafor, Registered Manager</p>
            <p className="mt-1 text-[12px] text-emerald-800">Signing locks this record. Later changes are only possible as audited addenda.</p>
            <div className="mt-3 flex justify-end gap-2">
              <button type="button" className={btn.secondary} onClick={() => setConfirmSign(false)}>Cancel</button>
              <button type="button" className={btn.primary} onClick={() => { act({ type: 'APPROVE_LOG', logId: log.id, now }, 'manager'); notify('Entry signed and locked', 'emerald', 'manager'); setConfirmSign(false); }}><Fingerprint className="h-4 w-4" aria-hidden />Apply digital signature</button>
            </div>
          </section>
        )}
      </div>

      <div className="flex shrink-0 flex-wrap items-center gap-2 border-t border-slate-200 bg-white/90 px-5 py-3 backdrop-blur">
        <button type="button" className={btn.amber} disabled={locked || composer} onClick={() => { setComposer(true); setConfirmSign(false); }}><MessageSquareWarning className="h-4 w-4" aria-hidden />Request clarification</button>
        <button type="button" className={btn.primary} disabled={locked || log.status === 'clarification'} title={log.status === 'clarification' ? 'Waiting for the worker to reply' : undefined} onClick={() => { setConfirmSign(true); setComposer(false); }}><PenLine className="h-4 w-4" aria-hidden />Approve and sign</button>
        <button type="button" className={btn.danger} disabled={locked} onClick={() => setRejectOpen(true)}><AlertTriangle className="h-4 w-4" aria-hidden />Reject and escalate</button>
        <button type="button" className={`${btn.secondary} ml-auto`} aria-pressed={log.flagged} onClick={() => { act({ type: 'TOGGLE_FLAG', logId: log.id, now }, 'manager'); notify(log.flagged ? 'Removed from CQC pack' : 'Flagged for CQC inspection pack', 'teal', 'manager'); }}><Flag className={`h-4 w-4 ${log.flagged ? 'fill-teal-600 text-teal-600' : ''}`} aria-hidden />{log.flagged ? 'Flagged' : 'Flag for CQC pack'}</button>
      </div>
      {log.status === 'clarification' && <p className="shrink-0 bg-white/90 px-5 pb-2 text-[11px] text-slate-500">Signing is disabled while a clarification is open.</p>}

      {rejectOpen && <RejectModal log={log} now={now} act={act} notify={notify} onClose={() => setRejectOpen(false)} />}
      {draftAction && incident && (
        <Modal title={draftAction} icon={FileCheck2} onClose={() => setDraftAction(null)}>
          <div className="p-5">
            <pre id="statutory-draft" className="whitespace-pre-wrap rounded-xl border border-slate-200 bg-slate-50 p-4 font-sans text-[13px] leading-6 text-slate-800">{statutoryDraft(draftAction, incident)}</pre>
            <p className="mt-2 text-[11px] text-slate-500">Drafted from the ABC record. Check every line before you send it.</p>
          </div>
          <div className="flex justify-end gap-2 border-t border-slate-200 px-5 py-3">
            <button type="button" className={btn.secondary} onClick={async () => { try { await navigator.clipboard.writeText(statutoryDraft(draftAction, incident)); notify('Draft copied', 'teal', 'manager'); } catch { const el = document.getElementById('statutory-draft'); if (el) { const rg = document.createRange(); rg.selectNodeContents(el); const sel = window.getSelection(); sel?.removeAllRanges(); sel?.addRange(rg); } notify('Copy blocked here. The draft is selected so you can copy it.', 'amber', 'manager'); } }}><Copy className="h-4 w-4" aria-hidden />Copy draft</button>
            <button type="button" className={btn.primary} onClick={() => { act({ type: 'STATUTORY_ACTION', incidentId: incident.id, action: draftAction, now }, 'manager'); notify(`${draftAction} marked done`, 'emerald', 'manager'); setDraftAction(null); }}><CheckCircle2 className="h-4 w-4" aria-hidden />Mark as done</button>
          </div>
        </Modal>
      )}
    </div>
  );
}

function RejectModal({ log, now, act, notify, onClose }: { log: LogEntry; now: number; act: Act; notify: Notify; onClose: () => void }) {
  const [code, setCode] = useState('');
  const [note, setNote] = useState('');
  const chosen = REJECT_CODES.find((c) => c.code === code);
  return (
    <Modal title="Reject and escalate" icon={AlertTriangle} onClose={onClose}>
      <div className="space-y-4 p-5">
        <p className="rounded-xl bg-slate-50 p-3 text-[13px] text-slate-700"><span className="tnum font-semibold">{fmt(log.time)}</span> · {resName(log.residentId)}: {truncate(firstLine(log.text), 140)}</p>
        <fieldset>
          <legend className="mb-2 text-[12px] font-semibold text-slate-700">Reason code (required)</legend>
          <div className="space-y-1.5">
            {REJECT_CODES.map((c) => (
              <label key={c.code} className={`flex cursor-pointer items-center gap-3 rounded-xl border p-3 text-[13px] ${code === c.code ? 'border-red-300 bg-red-50' : 'border-slate-200 hover:bg-slate-50'}`}>
                <input type="radio" name="reject-code" checked={code === c.code} onChange={() => setCode(c.code)} className="accent-red-600" />
                <span className="flex-1 font-semibold text-slate-800">{c.code}</span><span className="text-[12px] text-slate-500">{c.route}</span>
              </label>
            ))}
          </div>
        </fieldset>
        <div>
          <label htmlFor="reject-note" className="text-[12px] font-semibold text-slate-700">Rationale (required, at least 10 characters)</label>
          <textarea id="reject-note" rows={3} maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} className="mt-1 w-full resize-none rounded-xl border border-slate-200 px-3 py-2 text-[13px] focus:border-red-400 focus:outline-none" />
        </div>
      </div>
      <div className="flex justify-end gap-2 border-t border-slate-200 px-5 py-3">
        <button type="button" className={btn.secondary} onClick={onClose}>Cancel</button>
        <button type="button" className="inline-flex items-center gap-2 rounded-xl bg-red-600 px-3.5 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:bg-slate-300" disabled={!chosen || note.trim().length < 10} onClick={() => { if (!chosen) return; act({ type: 'REJECT_LOG', logId: log.id, code: chosen.code, route: chosen.route, note: note.trim(), now }, 'manager'); notify(`Escalated: ${chosen.route}`, 'red', 'manager'); onClose(); }}>Reject and escalate</button>
      </div>
    </Modal>
  );
}

const ACTION_META: Record<string, { label: string; icon: React.ElementType; tone: Tone; group: 'notes' | 'meds' | 'incidents' | 'governance' }> = {
  NOTE_CREATED: { label: 'Micro-note', icon: AudioLines, tone: 'teal', group: 'notes' },
  ATTACHMENT_ADDED: { label: 'Photo attached', icon: Camera, tone: 'slate', group: 'notes' },
  AI_RISK_FLAG: { label: 'AI risk flag', icon: ShieldAlert, tone: 'red', group: 'notes' },
  CARE_TASK: { label: 'Care task', icon: ClipboardCheck, tone: 'emerald', group: 'notes' },
  MED_ADMINISTERED: { label: 'Medication scanned', icon: Pill, tone: 'emerald', group: 'meds' },
  MED_REFUSED: { label: 'Medication refused', icon: Pill, tone: 'amber', group: 'meds' },
  PRN_BLOCKED: { label: 'PRN guardrail block', icon: Lock, tone: 'amber', group: 'meds' },
  SCAN_MISMATCH: { label: 'Wrong medicine scanned', icon: Ban, tone: 'red', group: 'meds' },
  STOMP_REVIEW: { label: 'STOMP review', icon: Stethoscope, tone: 'cyan', group: 'meds' },
  INCIDENT_LOGGED: { label: 'ABC incident', icon: Brain, tone: 'red', group: 'incidents' },
  INCIDENT_REVIEWED: { label: 'Incident reviewed', icon: Brain, tone: 'emerald', group: 'incidents' },
  RESTRICTIVE_PRACTICE: { label: 'Restrictive practice', icon: AlertTriangle, tone: 'red', group: 'incidents' },
  SOS_RAISED: { label: 'Silent SOS', icon: Siren, tone: 'red', group: 'incidents' },
  SOS_ACKNOWLEDGED: { label: 'SOS dispatched', icon: Radio, tone: 'amber', group: 'incidents' },
  SOS_RESOLVED: { label: 'SOS resolved', icon: CheckCircle2, tone: 'emerald', group: 'incidents' },
  SOS_CANCELLED: { label: 'SOS cancelled', icon: ShieldCheck, tone: 'slate', group: 'incidents' },
  CLARIFICATION_REQUESTED: { label: 'Clarification requested', icon: MessageSquareWarning, tone: 'amber', group: 'governance' },
  CLARIFICATION_REPLIED: { label: 'Clarification answered', icon: MessageSquareWarning, tone: 'cyan', group: 'governance' },
  LOG_REVISED: { label: 'Record revised', icon: History, tone: 'cyan', group: 'governance' },
  ENTRY_SIGNED: { label: 'Signed', icon: PenLine, tone: 'emerald', group: 'governance' },
  ENTRY_ESCALATED: { label: 'Escalated', icon: AlertTriangle, tone: 'red', group: 'governance' },
  CQC_FLAGGED: { label: 'Flagged for CQC', icon: Flag, tone: 'teal', group: 'governance' },
  CQC_UNFLAGGED: { label: 'Unflagged', icon: Flag, tone: 'slate', group: 'governance' },
  REPORT_SUBMITTED: { label: 'Shift report submitted', icon: FileText, tone: 'cyan', group: 'governance' },
  REPORT_SIGNED: { label: 'Shift report signed', icon: FileCheck2, tone: 'emerald', group: 'governance' },
  SYNC_COMPLETE: { label: 'Offline sync', icon: Cloud, tone: 'teal', group: 'governance' },
  PII_VIEWED: { label: 'NHS number viewed', icon: Eye, tone: 'slate', group: 'governance' },
  PACK_EXPORTED: { label: 'Evidence pack exported', icon: FileCheck2, tone: 'teal', group: 'governance' },
  INTEGRITY_CHECK: { label: 'Integrity check', icon: Hash, tone: 'emerald', group: 'governance' },
  SHIFT_START: { label: 'Shift start', icon: Clock, tone: 'slate', group: 'governance' },
  HANDOVER_ACCEPTED: { label: 'Handover accepted', icon: Moon, tone: 'slate', group: 'governance' },
  DEVICE_SIGN_IN: { label: 'Device sign-in', icon: KeyRound, tone: 'slate', group: 'governance' },
  DEVICE_LOCKED: { label: 'Device locked', icon: Lock, tone: 'slate', group: 'governance' },
  CLARIFICATION_ESCALATED: { label: 'Clarification SLA breached', icon: Timer, tone: 'red', group: 'governance' },
  RISK_REVIEWED: { label: 'Risk assessment reviewed', icon: ClipboardCheck, tone: 'emerald', group: 'governance' },
  STATUTORY_ACTION: { label: 'Statutory action', icon: FileCheck2, tone: 'teal', group: 'incidents' },
  FAMILY_MESSAGE: { label: 'Family message', icon: MessageCircle, tone: 'cyan', group: 'notes' },
  VISIT_BOOKED: { label: 'Family visit booked', icon: CalendarDays, tone: 'cyan', group: 'notes' },
  TRAINING_BOOKED: { label: 'Training booked', icon: GraduationCap, tone: 'teal', group: 'governance' },
  OBS_RECORDED: { label: 'Observations', icon: HeartPulse, tone: 'teal', group: 'notes' },
};
const metaFor = (a: string) => ACTION_META[a] ?? { label: a.replace(/_/g, ' ').toLowerCase(), icon: Activity, tone: 'slate' as Tone, group: 'governance' as const };

function FloorWorkspace({ state, now, sim, setSim, openEntry }: { state: State; now: number; sim: boolean; setSim: (b: boolean) => void; openEntry: (id: string) => void }) {
  const liveMode = !!useContext(LiveCtx);
  const [group, setGroup] = useState<'all' | 'notes' | 'meds' | 'incidents' | 'governance'>('all');
  const events = [...state.audit].reverse().filter((e) => group === 'all' || metaFor(e.action).group === group).slice(0, 60);
  const latest = state.audit[state.audit.length - 1];
  return (
    <div className="grid h-full min-h-0 grid-cols-1 lg:grid-cols-[1fr_280px]">
      <div className="flex min-h-0 flex-col">
        <div className="flex flex-wrap items-center gap-2 p-3">
          {(['all', 'notes', 'meds', 'incidents', 'governance'] as const).map((g) => <button key={g} type="button" onClick={() => setGroup(g)} className={`rounded-full border px-3 py-1 text-[12px] font-semibold capitalize ${group === g ? 'border-teal-600 bg-teal-600 text-white' : 'border-slate-200 bg-white text-slate-600'}`}>{g === 'meds' ? 'Medication' : g}</button>)}
          {!liveMode && <label className="ml-auto flex cursor-pointer items-center gap-2 text-[12px] font-semibold text-slate-600">
            <span className={`relative h-5 w-9 rounded-full transition ${sim ? 'bg-teal-600' : 'bg-slate-300'}`}><input type="checkbox" checked={sim} onChange={() => setSim(!sim)} className="peer sr-only" /><span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition ${sim ? 'left-[18px]' : 'left-0.5'}`} /></span>
            Live colleague activity
          </label>}
        </div>
        <ol className="cos-scroll min-h-0 flex-1 space-y-1.5 overflow-y-auto px-3 pb-3">
          {events.map((e) => {
            const m = metaFor(e.action);
            const logId = state.logs.find((l) => l.id === e.entity || l.incidentId === e.entity)?.id;
            const isNew = latest && latest.seq - e.seq < 3 && now - e.time < 2 * MIN;
            return (
              <li key={e.seq} className={`${isNew ? 'cos-rise' : ''}`}>
                <button type="button" disabled={!logId} onClick={() => logId && openEntry(logId)} className="flex w-full items-start gap-3 rounded-xl border border-slate-200/80 bg-white/80 p-2.5 text-left transition enabled:hover:border-teal-300 enabled:hover:bg-white disabled:cursor-default">
                  <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg border ${TONE_LIGHT[m.tone]}`}><m.icon className="h-4 w-4" aria-hidden /></span>
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-x-2 text-[11px] text-slate-500"><span className="tnum font-semibold text-slate-700">{fmtS(e.time)}</span><span className="font-semibold text-slate-800">{m.label}</span><span>{e.actor}</span>{isNew && <Chip surface="light" tone="teal">New</Chip>}</span>
                    <span className="mt-0.5 block text-[12px] leading-5 text-slate-700">{e.detail}</span>
                  </span>
                  {logId && <ChevronRight className="mt-2 h-4 w-4 shrink-0 text-slate-300" aria-hidden />}
                </button>
              </li>
            );
          })}
        </ol>
      </div>
      <aside className="cos-scroll hidden min-h-0 space-y-3 overflow-y-auto border-l border-slate-200/80 p-3 lg:block">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Staff on floor</p>
        {[{ n: 'David S.', r: 'Senior · Flats 1 to 3', loc: 'Flat 2', on: true }, { n: 'Amina Kamara', r: 'Support worker', loc: 'Flat 1', on: true }, { n: 'Tomasz Nowak', r: 'Support worker', loc: 'Flat 3', on: true }].map((s) => (
          <div key={s.n} className="flex items-center gap-2.5 rounded-xl border border-slate-200 bg-white p-2.5">
            <Avatar name={s.n} hue="from-cyan-300 to-teal-500" size="h-8 w-8 text-[10px]" />
            <div className="min-w-0 flex-1"><p className="text-[12px] font-semibold text-slate-800">{s.n}</p><p className="truncate text-[11px] text-slate-500">{s.r}</p></div>
            <span className="flex items-center gap-1 text-[11px] text-slate-500"><MapPin className="h-3 w-3" aria-hidden />{s.loc}</span>
          </div>
        ))}
        <p className="pt-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Resident status</p>
        {RESIDENTS.map((r) => {
          const al = residentAlert(state, r, now);
          return (
            <div key={r.id} className="rounded-xl border border-slate-200 bg-white p-2.5">
              <div className="flex items-center gap-2"><span className={`h-2.5 w-2.5 rounded-full ${al.level === 'red' ? 'bg-red-500' : al.level === 'amber' ? 'bg-amber-400' : 'bg-emerald-500'}`} /><span className="text-[12px] font-semibold text-slate-800">{r.name}</span></div>
              <p className="mt-1 text-[11px] text-slate-500">{al.reasons.length ? al.reasons.join(' · ') : 'No concerns'}</p>
            </div>
          );
        })}
        {state.familyMessages.length > 0 && <>
          <p className="pt-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Family portal</p>
          {state.familyMessages.slice().reverse().map((m) => <div key={m.id} className="rounded-xl border border-cyan-200 bg-cyan-50 p-2.5 text-[11px] text-cyan-950"><p className="tnum font-semibold">{fmt(m.time)} · {m.from} · {m.kind === 'visit' ? 'Visit' : 'Message'}</p><p>{m.text}</p></div>)}
        </>}
        {state.sosHistory.length > 0 && <>
          <p className="pt-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500">SOS log</p>
          {state.sosHistory.slice().reverse().map((s) => <div key={s.id} className="rounded-xl border border-slate-200 bg-white p-2.5 text-[11px] text-slate-600"><p className="tnum font-semibold text-slate-800">{fmt(s.raisedAt)} · {s.status === 'resolved' ? 'Resolved' : 'Cancelled'}</p><p>{s.outcome}</p></div>)}
        </>}
      </aside>
    </div>
  );
}

function AuditWorkspace({ fw, setFw, state, now, act, notify, openEntry }: { fw: FrameworkId; setFw: (f: FrameworkId) => void; state: State; now: number; act: Act; notify: Notify; openEntry: (id: string) => void }) {
  const [domain, setDomain] = useState<Domain | 'All'>('All');
  const [exportOpen, setExportOpen] = useState(false);
  const [check, setCheck] = useState<{ ok: boolean; count: number; at: number; tamper?: number | null } | null>(null);
  const logs = state.logs.filter((l) => l.synced);
  const rows = logs.filter((l) => domain === 'All' || l.cqc.includes(domain)).sort((a, b) => b.time - a.time);
  const runCheck = () => {
    const v = verifyChain(state.audit);
    setCheck({ ok: v.ok, count: state.audit.length, at: now });
    act({ type: 'INTEGRITY_CHECK', now, ok: v.ok, count: state.audit.length }, 'manager');
    notify(v.ok ? `Audit chain intact · ${state.audit.length} events` : 'Audit chain broken', v.ok ? 'emerald' : 'red', 'manager');
  };
  const tamperTest = () => {
    const idx = Math.floor(state.audit.length / 2);
    const copy = state.audit.map((e, i) => (i === idx ? { ...e, detail: `${e.detail} (edited)` } : e));
    const v = verifyChain(copy);
    setCheck({ ok: v.ok, count: copy.length, at: now, tamper: v.brokenAt });
  };
  return (
    <div className="cos-scroll h-full overflow-y-auto p-4">
      <div className="grid grid-cols-2 gap-2 md:grid-cols-5">
        {DOMAINS.map((dmn) => {
          const items = logs.filter((l) => l.cqc.includes(dmn));
          const signed = items.filter((l) => l.status === 'approved').length;
          const pct = items.length ? signed / items.length : 0;
          return (
            <button key={dmn} type="button" onClick={() => setDomain(domain === dmn ? 'All' : dmn)} aria-pressed={domain === dmn} className={`rounded-2xl border p-3 text-left transition ${domain === dmn ? 'border-teal-500 bg-white shadow-md ring-1 ring-teal-500/30' : 'border-slate-200 bg-white/80 hover:bg-white'}`}>
              <div className="flex items-center justify-between"><p className="cos-display text-[14px] font-bold text-slate-900">{dmn}</p><Ring size={34} stroke={4} progress={pct} color="#0D9488" track="#E2E8F0"><span className="tnum text-[9px] font-bold text-slate-600">{Math.round(pct * 100)}</span></Ring></div>
              <p className="tnum mt-1 text-[12px] text-slate-500">{items.length} evidence items · {signed} signed</p>
            </button>
          );
        })}
      </div>

      {(() => {
        const cov = frameworkCoverage(state, fw);
        const covered = cov.filter((c) => c.covered).length;
        return (
          <section className="mt-4 rounded-2xl border border-slate-200 bg-white p-4">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="cos-display text-[15px] font-bold text-slate-900">Framework coverage</h3>
              <div className="flex rounded-xl border border-slate-200 bg-slate-50 p-0.5" role="tablist" aria-label="Assessment framework">
                {(['saf2023', 'cqc2026'] as FrameworkId[]).map((id) => <button key={id} type="button" role="tab" aria-selected={fw === id} onClick={() => setFw(id)} className={`rounded-lg px-3 py-1 text-[12px] font-semibold ${fw === id ? 'bg-teal-600 text-white' : 'text-slate-600'}`}>{FRAMEWORKS[id].short}</button>)}
              </div>
              <span className="tnum ml-auto text-[13px] font-semibold text-slate-700">{covered} of {cov.length} evidenced today</span>
            </div>
            <p className="mt-1 text-[11px] text-slate-500">{FRAMEWORKS[fw].label}. {FRAMEWORKS[fw].status}. The same records re-map instantly when the framework changes.</p>
            <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
              {DOMAINS.map((dmn) => (
                <div key={dmn}>
                  <p className="text-[12px] font-bold text-slate-800">{dmn}</p>
                  <ul className="mt-1 space-y-1">
                    {cov.filter((c) => c.ref.domain === dmn).map((c) => (
                      <li key={c.ref.title} className="flex items-start gap-1.5 text-[11px] leading-4" title={c.covered ? `Evidence from ${c.via}` : 'No evidence yet'}>
                        <span className={`mt-1 h-2 w-2 shrink-0 rounded-full ${c.covered ? 'bg-emerald-500' : 'bg-amber-400'}`} aria-hidden />
                        <span className={c.covered ? 'text-slate-700' : 'text-amber-800'}>{refLabel(c.ref)}{c.covered && c.items ? <span className="tnum text-slate-400"> · {c.items}</span> : c.covered ? <span className="text-slate-400"> · {c.via}</span> : <span className="text-amber-600"> · gap</span>}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </section>
        );
      })()}

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <h3 className="cos-display text-[15px] font-bold text-slate-900">Evidence classification</h3>
        <Chip surface="light" tone="teal">{domain === 'All' ? 'All key questions' : domain}</Chip>
        <button type="button" className={`${btn.primary} ml-auto`} onClick={() => setExportOpen(true)}><FileCheck2 className="h-4 w-4" aria-hidden />Export CQC evidence pack</button>
      </div>
      <div className="mt-2 overflow-x-auto rounded-2xl border border-slate-200 bg-white">
        <table className="w-full min-w-[720px] text-left text-[12px]">
          <thead className="bg-slate-50 text-[11px] uppercase tracking-wider text-slate-500">
            <tr><th className="px-3 py-2 font-semibold">Time</th><th className="px-3 py-2 font-semibold">Resident</th><th className="px-3 py-2 font-semibold">Evidence</th>{DOMAINS.map((dmn) => <th key={dmn} className="px-2 py-2 text-center font-semibold">{dmn === 'Well-led' ? 'W-L' : dmn.slice(0, 4)}</th>)}<th className="px-3 py-2 font-semibold">Status</th></tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((l) => (
              <tr key={l.id} className="cursor-pointer hover:bg-teal-50/50" onClick={() => openEntry(l.id)}>
                <td className="tnum px-3 py-2 text-slate-500">{fmt(l.time)}</td>
                <td className="px-3 py-2 font-semibold text-slate-800">{residentById(l.residentId).first}</td>
                <td className="max-w-[320px] px-3 py-2 text-slate-700"><span className="line-clamp-1">{firstLine(l.text)}</span><span className="block truncate text-[10px] text-slate-400">{evidenceRefs(l, fw).slice(0, 2).map(refLabel).join(' · ')}</span></td>
                {DOMAINS.map((dmn) => <td key={dmn} className="px-2 py-2 text-center">{l.cqc.includes(dmn) ? <CheckCircle2 className="mx-auto h-4 w-4 text-teal-600" aria-label={dmn} /> : <span className="text-slate-200" aria-hidden>·</span>}</td>)}
                <td className="px-3 py-2"><Chip surface="light" tone={STATUS_META[l.status].tone}>{STATUS_META[l.status].label.split(' · ')[0]}</Chip></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-2">
        <h3 className="cos-display text-[15px] font-bold text-slate-900">Tamper-evident audit trail</h3>
        <span className="text-[12px] text-slate-500">{state.audit.length} events · append-only hash chain</span>
        <div className="ml-auto flex gap-2">
          <button type="button" className={btn.secondary} onClick={tamperTest}>Run tamper test</button>
          <button type="button" className={btn.primary} onClick={runCheck}><ShieldCheck className="h-4 w-4" aria-hidden />Verify integrity</button>
        </div>
      </div>
      {check && (
        <div className={`mt-2 rounded-xl border p-3 text-[12px] ${check.tamper !== undefined ? 'border-amber-300 bg-amber-50 text-amber-900' : check.ok ? 'border-emerald-200 bg-emerald-50 text-emerald-900' : 'border-red-200 bg-red-50 text-red-800'}`}>
          {check.tamper !== undefined
            ? <>Simulated edit to one historic event on a copy of the ledger. Verification failed at event <span className="tnum font-semibold">#{check.tamper}</span>, so any change after the fact is detectable. The live ledger was not modified.</>
            : check.ok ? <>All <span className="tnum font-semibold">{check.count}</span> events verified at <span className="tnum">{fmtS(check.at)}</span>. Every hash matches its predecessor.</> : <>Verification failed.</>}
        </div>
      )}
      <div className="mt-2 overflow-x-auto rounded-2xl border border-slate-200 bg-white">
        <table className="w-full min-w-[760px] text-left text-[12px]">
          <thead className="bg-slate-50 text-[11px] uppercase tracking-wider text-slate-500"><tr><th className="px-3 py-2">#</th><th className="px-3 py-2">Time</th><th className="px-3 py-2">Actor</th><th className="px-3 py-2">Event</th><th className="px-3 py-2">Detail</th><th className="px-3 py-2">Hash</th></tr></thead>
          <tbody className="divide-y divide-slate-100">
            {[...state.audit].reverse().slice(0, 40).map((e) => (
              <tr key={e.seq}>
                <td className="tnum px-3 py-1.5 text-slate-400">{e.seq}</td>
                <td className="tnum px-3 py-1.5 text-slate-500">{fmtS(e.time)}</td>
                <td className="px-3 py-1.5"><span className="font-semibold text-slate-700">{e.actor}</span><span className="block text-[10px] text-slate-400">{e.role}</span></td>
                <td className="px-3 py-1.5"><Chip surface="light" tone={metaFor(e.action).tone}>{metaFor(e.action).label}</Chip></td>
                <td className="max-w-[300px] px-3 py-1.5 text-slate-600"><span className="line-clamp-2">{e.detail}</span></td>
                <td className="cos-mono px-3 py-1.5 text-[11px] text-slate-500" title={`prev ${e.prevHash}`}>{e.hash.slice(0, 12)}<span className="block text-[10px] text-slate-300">← {e.prevHash.slice(0, 8)}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-[11px] text-slate-500">Prototype uses a 64-bit chain hash in the browser. Production signs each event with SHA-256 on the server and writes to WORM storage in UK-South.</p>
      <section className="mt-5 rounded-2xl border border-slate-200 bg-white p-4">
        <h3 className="cos-display text-[15px] font-bold text-slate-900">Records retention and data minimisation</h3>
        <ul className="mt-2 grid gap-2 text-[12px] text-slate-700 md:grid-cols-2">
          <li className="rounded-xl bg-slate-50 p-3"><span className="font-semibold">Care records and audit ledger.</span> Kept for the period set in the NHS Records Management Code of Practice, then purged automatically with a purge certificate.</li>
          <li className="rounded-xl bg-slate-50 p-3"><span className="font-semibold">Voice audio.</span> Deleted 30 days after the transcript is signed, or straight away if the worker discards the note. {state.logs.filter((l) => l.source === 'voice').length} clips held today.</li>
          <li className="rounded-xl bg-slate-50 p-3"><span className="font-semibold">Photos and body maps.</span> Stored only inside CarePlanOS, encrypted, never in the device camera roll.</li>
          <li className="rounded-xl bg-slate-50 p-3"><span className="font-semibold">Access to identifiers.</span> NHS numbers masked by default. {state.audit.filter((e) => e.action === 'PII_VIEWED').length} reveals logged today.</li>
        </ul>
      </section>
      {exportOpen && <ExportModal fw={fw} state={state} now={now} act={act} notify={notify} onClose={() => setExportOpen(false)} />}
    </div>
  );
}

function ExportModal({ fw, state, now, act, notify, onClose }: { fw: FrameworkId; state: State; now: number; act: Act; notify: Notify; onClose: () => void }) {
  const [redact, setRedact] = useState(true);
  const [domains, setDomains] = useState<Domain[]>(DOMAINS);
  const [stage, setStage] = useState<'preview' | 'building' | 'ready'>('preview');
  const [packId] = useState(() => uid('PACK'));
  const logs = state.logs.filter((l) => l.synced && l.cqc.some((d) => domains.includes(d)));
  const signedPct = logs.length ? Math.round((logs.filter((l) => l.status === 'approved').length / logs.length) * 100) : 0;
  const em = emarStats(state.meds, now);
  const blocks = state.audit.filter((e) => e.action === 'PRN_BLOCKED' || e.action === 'SCAN_MISMATCH').length;
  const clarClosed = state.logs.filter((l) => l.thread.some((m) => m.from === 'worker'));
  const avgResponse = clarClosed.length ? Math.round(clarClosed.reduce((a, l) => { const q = l.thread.find((m) => m.from === 'manager'); const rep = l.thread.find((m) => m.from === 'worker'); return a + (q && rep ? (rep.time - q.time) / MIN : 0); }, 0) / clarClosed.length) : null;
  const chain = verifyChain(state.audit);
  const nameOf = (id: string) => (redact ? initials(resName(id)) : resName(id));
  const packHash = chainHash(`${packId}|${logs.map((l) => l.id).join(',')}|${state.audit[state.audit.length - 1]?.hash}`);
  const DOMAIN_QS = Object.fromEntries(DOMAINS.map((d) => [d, FRAMEWORKS[fw].refs.filter((r) => r.domain === d).map(refLabel)])) as Record<Domain, string[]>;
  const summaryText = () => [
    `CarePlanOS · CQC Evidence Pack ${packId}`, `${PROVIDER.name}, ${PROVIDER.town} · Location ID ${PROVIDER.locationId}`, `Period: 10 Nov 2026 08:00 to ${fmt(now)} · Prepared by Sarah Okafor, Registered Manager`, '',
    `Evidence items: ${logs.length} · Signed: ${signedPct}% · eMAR administration recorded: ${em.rate.toFixed(1)}% · Guardrail blocks: ${blocks} · Incidents: ${state.incidents.length}`, '',
    ...domains.flatMap((d) => [`${d}: ${logs.filter((l) => l.cqc.includes(d)).length} items`, ...logs.filter((l) => l.cqc.includes(d)).slice(0, 3).map((l) => `  ${fmt(l.time)} ${nameOf(l.residentId)}: ${truncate(firstLine(l.text), 120)}`)]), '',
    `Audit chain: ${chain.ok ? 'verified' : 'FAILED'} · ${state.audit.length} events · pack hash ${packHash}`,
  ].join('\n');
  const copy = async () => {
    const text = summaryText();
    try { await navigator.clipboard.writeText(text); notify('Evidence pack summary copied', 'emerald', 'manager'); }
    catch { const el = document.getElementById('pack-paper'); if (el) { const range = document.createRange(); range.selectNodeContents(el); const sel = window.getSelection(); sel?.removeAllRanges(); sel?.addRange(range); } notify('Copy blocked here. The pack text is selected so you can copy it.', 'amber', 'manager'); }
  };
  return (
    <Modal title="CQC evidence pack" icon={FileCheck2} onClose={onClose} wide>
      <div className="grid gap-0 lg:grid-cols-[260px_1fr]">
        <aside className="space-y-4 border-b border-slate-200 p-5 lg:border-b-0 lg:border-r">
          <fieldset>
            <legend className="mb-2 text-[12px] font-semibold text-slate-700">Key questions</legend>
            {DOMAINS.map((d) => (
              <label key={d} className="flex items-center gap-2 py-1 text-[13px] text-slate-700"><input type="checkbox" checked={domains.includes(d)} onChange={() => setDomains((cur) => (cur.includes(d) ? cur.filter((x) => x !== d) : DOMAINS.filter((x) => cur.includes(x) || x === d)))} className="h-4 w-4 accent-teal-600" />{d}</label>
            ))}
          </fieldset>
          <label className="flex items-start gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3 text-[12px] text-slate-700">
            <input type="checkbox" checked={redact} onChange={() => setRedact((v) => !v)} className="mt-0.5 h-4 w-4 accent-teal-600" />
            <span><span className="font-semibold">Data minimisation</span><br />Initials only, NHS numbers masked (UK GDPR Article 5)</span>
          </label>
          {stage === 'preview' && <button type="button" className={`${btn.primary} w-full`} disabled={!domains.length} onClick={() => { setStage('building'); window.setTimeout(() => { setStage('ready'); act({ type: 'PACK_EXPORTED', packId, now, items: logs.length, hash: packHash }, 'manager'); notify('Evidence pack generated and logged', 'emerald', 'manager'); }, 1300); }}><FileCheck2 className="h-4 w-4" aria-hidden />Generate pack</button>}
          {stage === 'building' && <p className="flex items-center gap-2 text-[13px] text-slate-600"><span className="h-4 w-4 rounded-full border-2 border-teal-600 border-t-transparent cos-spin" aria-hidden />Assembling and hashing</p>}
          {stage === 'ready' && (
            <div className="space-y-2">
              <p className="rounded-xl bg-emerald-50 p-3 text-[12px] text-emerald-900"><CheckCircle2 className="mr-1 inline h-4 w-4" aria-hidden />Pack {packId} ready for the inspector portal. Hash <span className="cos-mono">{packHash}</span></p>
              <button type="button" className={`${btn.secondary} w-full`} onClick={copy}><Copy className="h-4 w-4" aria-hidden />Copy pack summary</button>
            </div>
          )}
        </aside>
        <div className="bg-slate-100 p-4 sm:p-6">
          <article id="pack-paper" className="mx-auto max-w-[680px] rounded-sm bg-white p-6 text-slate-800 shadow-xl sm:p-8">
            <header className="flex items-start justify-between gap-4 border-b-2 border-teal-600 pb-3">
              <div><p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-teal-700">{FRAMEWORKS[fw].label}</p><h4 className="cos-display mt-1 text-xl font-bold text-slate-900">Evidence pack</h4><p className="text-[12px] text-slate-500">{PROVIDER.name}, {PROVIDER.town} · Location ID {PROVIDER.locationId}</p></div>
              <div className="text-right text-[11px] text-slate-500"><p className="cos-mono">{packId}</p><p className="tnum">10 Nov 2026 · 08:00 to {fmt(now)}</p></div>
            </header>
            <dl className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {[['Evidence items', String(logs.length)], ['Signed off', `${signedPct}%`], ['eMAR recorded', `${em.rate.toFixed(1)}%`], ['Avg clarification', avgResponse === null ? 'n/a' : `${avgResponse} min`]].map(([k, v]) => <div key={k} className="rounded-lg border border-slate-200 p-2"><dt className="text-[10px] uppercase tracking-wider text-slate-500">{k}</dt><dd className="cos-display tnum text-lg font-bold text-slate-900">{v}</dd></div>)}
            </dl>
            {domains.map((d) => {
              const items = logs.filter((l) => l.cqc.includes(d));
              return (
                <section key={d} className="mt-5">
                  <h5 className="flex items-baseline justify-between border-b border-slate-200 pb-1 text-[13px] font-bold text-slate-900">{d}<span className="tnum text-[11px] font-normal text-slate-500">{items.length} items</span></h5>
                  <p className="mt-1 text-[11px] text-slate-500">{fw === 'saf2023' ? 'Quality statements' : 'KLOE themes'}: {DOMAIN_QS[d].join(' · ')}</p>
                  <ul className="mt-1.5 space-y-1">
                    {items.slice(0, 4).map((l) => <li key={l.id} className="grid grid-cols-[42px_32px_1fr_auto] gap-2 text-[11px] leading-4"><span className="tnum text-slate-500">{fmt(l.time)}</span><span className="font-semibold">{nameOf(l.residentId)}</span><span className="text-slate-700">{truncate(firstLine(l.text), 120)}</span><span className={l.status === 'approved' ? 'text-emerald-700' : 'text-slate-400'}>{l.status === 'approved' ? 'Signed' : STATUS_META[l.status].label.split(' · ')[0]}</span></li>)}
                  </ul>
                  {d === 'Safe' && <p className="mt-1.5 text-[11px] text-slate-600">Medication guardrails prevented <span className="tnum font-semibold">{blocks}</span> unsafe administration{blocks === 1 ? '' : 's'} today (PRN interval and wrong-medicine scans).</p>}
                </section>
              );
            })}
            {logs.some((l) => l.flagged) && (
              <section className="mt-5"><h5 className="border-b border-slate-200 pb-1 text-[13px] font-bold text-slate-900">Manager-flagged evidence</h5><ul className="mt-1.5 space-y-1">{logs.filter((l) => l.flagged).map((l) => <li key={l.id} className="text-[11px] text-slate-700"><span className="tnum">{fmt(l.time)}</span> · {nameOf(l.residentId)} · {truncate(firstLine(l.text), 140)}</li>)}</ul></section>
            )}
            <footer className="mt-6 grid gap-3 border-t border-slate-200 pt-3 text-[11px] text-slate-500 sm:grid-cols-2">
              <p>Audit chain {chain.ok ? 'verified' : 'failed'} · <span className="tnum">{state.audit.length}</span> events<br />Head <span className="cos-mono">{state.audit[state.audit.length - 1]?.hash}</span></p>
              <p className="sm:text-right">Prepared by Sarah Okafor, Registered Manager<br />{stage === 'ready' ? <>Pack hash <span className="cos-mono">{packHash}</span></> : 'Draft, not yet generated'}</p>
            </footer>
          </article>
        </div>
      </div>
    </Modal>
  );
}

function Spark({ values }: { values: number[] }) {
  const max = Math.max(3, ...values);
  return (
    <svg width={88} height={26} viewBox="0 0 88 26" aria-label={`PRN doses last 7 days: ${values.join(', ')}`} role="img">
      {values.map((v, i) => { const h = (v / max) * 20; return <rect key={i} x={i * 12.5 + 1} y={24 - h} width={9} height={Math.max(h, 1.5)} rx={2} fill={i === values.length - 1 ? '#0D9488' : '#99D5CE'} />; })}
      <line x1={0} y1={24.5} x2={88} y2={24.5} stroke="#CBD5E1" strokeWidth={1} />
    </svg>
  );
}

function MatrixWorkspace({ state, now, act, notify }: { state: State; now: number; act: Act; notify: Notify }) {
  const [revealed, setRevealed] = useState<Record<string, boolean>>({});
  const [expanded, setExpanded] = useState<string | null>(null);
  return (
    <div className="cos-scroll h-full overflow-y-auto p-4">
      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
        <table className="w-full min-w-[860px] text-left text-[12px]">
          <thead className="bg-slate-50 text-[11px] uppercase tracking-wider text-slate-500">
            <tr><th className="px-3 py-2">Resident</th><th className="px-3 py-2">Alert</th><th className="px-3 py-2">Assigned</th><th className="w-[190px] px-3 py-2">Fluids today</th><th className="px-3 py-2">Meals</th><th className="px-3 py-2">PRN 7 days</th><th className="px-3 py-2">eMAR today</th><th className="px-3 py-2">Plan review</th><th className="px-3 py-2"><span className="sr-only">Expand</span></th></tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {RESIDENTS.map((r) => {
              const al = residentAlert(state, r, now);
              const meds = state.meds.filter((m) => m.residentId === r.id);
              const todayPrn = meds.reduce((a, m) => a + (m.prn ? m.prn.doses.length : 0), 0);
              const meal = mealAverage(state.logs, r.id);
              const em = emarStats(meds, now);
              const open = expanded === r.id;
              return (
                <React.Fragment key={r.id}>
                  <tr className="align-top hover:bg-slate-50/60">
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-2.5"><Avatar name={r.name} hue={r.hue} size="h-9 w-9 text-[11px]" /><div><p className="font-semibold text-slate-900">{r.name} <span className="tnum font-normal text-slate-500">{r.age}</span></p>
                        <p className="tnum flex items-center gap-1 text-[11px] text-slate-500">NHS {revealed[r.id] ? r.nhs : maskNhs(r.nhs)}
                          <button type="button" className="rounded p-0.5 text-slate-400 hover:text-teal-700" aria-label={revealed[r.id] ? 'Hide NHS number' : 'Reveal NHS number (logged)'} onClick={() => { if (!revealed[r.id]) act({ type: 'NHS_VIEWED', residentId: r.id, now }, 'manager'); setRevealed((v) => ({ ...v, [r.id]: !v[r.id] })); }}>{revealed[r.id] ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}</button>
                        </p></div></div>
                    </td>
                    <td className="px-3 py-3"><Chip surface="light" tone={al.level === 'red' ? 'red' : al.level === 'amber' ? 'amber' : 'emerald'}>{al.level === 'red' ? 'High' : al.level === 'amber' ? 'Watch' : 'Stable'}</Chip><p className="mt-1 max-w-[160px] text-[10px] leading-4 text-slate-500">{al.reasons.slice(0, 2).join(' · ')}</p></td>
                    <td className="px-3 py-3 text-slate-700">{r.assigned}<p className="text-[10px] text-slate-400">{r.room}</p></td>
                    <td className="px-3 py-3"><FluidBar r={r} total={fluidTotal(state.logs, r.id)} now={now} surface="light" /></td>
                    <td className="tnum px-3 py-3 text-slate-700">{meal === null ? 'n/a' : `${meal}%`}</td>
                    <td className="px-3 py-3"><Spark values={[...r.prnHistory, todayPrn]} /></td>
                    <td className="tnum px-3 py-3 text-slate-700">{em.given}/{em.due}{em.refused ? <span className="text-amber-700"> · {em.refused} ref.</span> : null}</td>
                    <td className="tnum px-3 py-3 text-slate-700">{r.nextReview}</td>
                    <td className="px-3 py-3"><button type="button" onClick={() => setExpanded(open ? null : r.id)} aria-expanded={open} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700" aria-label={`Care plan for ${r.name}`}><ChevronDown className={`h-4 w-4 transition ${open ? 'rotate-180' : ''}`} /></button></td>
                  </tr>
                  {open && (
                    <tr className="bg-slate-50/70">
                      <td colSpan={9} className="px-4 py-4">
                        <div className="grid gap-3 md:grid-cols-3">
                          <div><p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Conditions</p><ul className="mt-1 space-y-0.5 text-[12px] text-slate-700">{r.conditions.map((c) => <li key={c}>{c}</li>)}</ul><p className="mt-2 text-[12px] text-red-700">Allergies: {r.allergies}</p></div>
                          <div><p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Medicines</p><ul className="mt-1 space-y-0.5 text-[12px] text-slate-700">{meds.map((m) => <li key={m.id}><span className="font-semibold">{m.round}</span> · {m.name} · {m.dose}</li>)}</ul></div>
                          <div><p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Capacity and consent</p><ul className="mt-1 space-y-0.5 text-[12px] text-slate-700"><li>{r.legal.capacity}</li><li>{r.legal.dols}</li><li>{r.legal.resus}</li><li>Voice notes: {r.legal.voiceConsent.detail}</li></ul></div>
                        </div>
                        <p className="mb-1 mt-4 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Risk assessments</p>
                        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
                          <table className="w-full min-w-[640px] text-[12px]">
                            <tbody className="divide-y divide-slate-100">
                              {r.risks.map((k) => {
                                const due = riskDue(r, k, state, now);
                                return (
                                  <tr key={k.id}>
                                    <td className="px-3 py-2 font-semibold text-slate-800">{k.name}</td>
                                    <td className="tnum px-3 py-2 text-slate-600">{k.tool} {k.score}</td>
                                    <td className="px-3 py-2"><Chip surface="light" tone={k.level === 'High' ? 'red' : k.level === 'Medium' ? 'amber' : 'emerald'}>{k.level}</Chip></td>
                                    <td className="tnum px-3 py-2 text-slate-600">Due {fmtDate(due.due)}</td>
                                    <td className="px-3 py-2"><Chip surface="light" tone={due.tone}>{due.label}</Chip></td>
                                    <td className="px-3 py-2 text-right"><button type="button" className="rounded-lg border border-slate-200 px-2 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-50" onClick={() => { act({ type: 'REVIEW_RISK', key: `${r.id}:${k.id}`, residentId: r.id, name: k.name, now }, 'manager'); notify(`${k.name} review signed for ${r.first}`, 'emerald', 'manager'); }}>Sign review</button></td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-[11px] text-slate-500">NHS numbers are masked by default. Each reveal is written to the audit trail.</p>
    </div>
  );
}

function WorkforceWorkspace({ state, now, act, notify }: { state: State; now: number; act: Act; notify: Notify }) {
  const signIns = state.audit.filter((e) => e.action === 'DEVICE_SIGN_IN').slice(-8).reverse();
  const expired = STAFF.reduce((a, x) => a + TRAINING.filter((t) => expiryStatus(x.training[t], now).tone === 'red').length, 0);
  const dueSoon = STAFF.reduce((a, x) => a + TRAINING.filter((t) => expiryStatus(x.training[t], now).tone === 'amber').length, 0);
  const supOverdue = STAFF.filter((x) => now - dateMs(x.supervision) > 56 * 24 * HOUR).length;
  return (
    <div className="cos-scroll h-full overflow-y-auto p-4">
      <div className="flex flex-wrap gap-2">
        <Chip surface="light" tone={expired ? 'red' : 'emerald'}>{expired} expired</Chip>
        <Chip surface="light" tone={dueSoon ? 'amber' : 'emerald'}>{dueSoon} due within 30 days</Chip>
        <Chip surface="light" tone={supOverdue ? 'amber' : 'emerald'}>{supOverdue} supervision overdue</Chip>
      </div>
      <div className="mt-3 overflow-x-auto rounded-2xl border border-slate-200 bg-white">
        <table className="w-full min-w-[900px] text-left text-[12px]">
          <thead className="bg-slate-50 text-[11px] uppercase tracking-wider text-slate-500">
            <tr><th className="px-3 py-2">Staff</th>{TRAINING.map((t) => <th key={t} className="px-2 py-2">{t}</th>)}<th className="px-3 py-2">Supervision</th></tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {STAFF.map((x) => {
              const supLate = now - dateMs(x.supervision) > 56 * 24 * HOUR;
              return (
                <tr key={x.actor.name} className="align-top">
                  <td className="px-3 py-3"><div className="flex items-center gap-2"><Avatar name={x.actor.name} hue={x.hue} size="h-8 w-8 text-[10px]" /><div><p className="font-semibold text-slate-900">{x.actor.name}</p><p className="text-[11px] text-slate-500">{x.actor.role}</p></div></div></td>
                  {TRAINING.map((t) => {
                    const st = expiryStatus(x.training[t], now);
                    const booked = state.trainingBooked[`${x.actor.name}|${t}`];
                    return (
                      <td key={t} className="px-2 py-3">
                        <Chip surface="light" tone={booked ? 'cyan' : st.tone}>{booked ? 'Booked' : st.label}</Chip>
                        <p className="tnum mt-0.5 text-[10px] text-slate-500">{fmtDate(dateMs(x.training[t]))}</p>
                        {st.tone !== 'emerald' && !booked && <button type="button" className="mt-1 text-[11px] font-semibold text-teal-700 hover:underline" onClick={() => { act({ type: 'BOOK_TRAINING', staff: x.actor.name, course: t, now }, 'manager'); notify(`${t} refresher booked for ${x.actor.name}`, 'teal', 'manager'); }}>Book refresher</button>}
                      </td>
                    );
                  })}
                  <td className="px-3 py-3"><Chip surface="light" tone={supLate ? 'amber' : 'emerald'}>{supLate ? 'Overdue' : 'In date'}</Chip><p className="tnum mt-0.5 text-[10px] text-slate-500">Last {fmtDate(dateMs(x.supervision))}</p></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-[11px] text-slate-500">An expired medication competency blocks that person from administering on the frontline app until it is renewed. Sign in as Tomasz on the handset to see it.</p>
      <InvitePanel />
      <h3 className="cos-display mt-5 text-[15px] font-bold text-slate-900">Shared handset sign-ins</h3>
      <ul className="mt-2 space-y-1">
        {signIns.map((e) => <li key={e.seq} className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-[12px] text-slate-700"><KeyRound className="h-3.5 w-3.5 text-teal-700" aria-hidden /><span className="tnum font-semibold">{fmtS(e.time)}</span>{e.detail}</li>)}
      </ul>
    </div>
  );
}

function InvitePanel() {
  const live = useContext(LiveCtx);
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState<'worker' | 'manager'>('worker');
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  if (!live || live.role !== 'manager') return null;
  const valid = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim()) && name.trim().length >= 2;
  return (
    <section className="mt-5 rounded-2xl border border-slate-200 bg-white p-4">
      <h3 className="cos-display text-[15px] font-bold text-slate-900">Give someone access</h3>
      <p className="mt-1 text-[12px] text-slate-500">They sign in with a one-time email link. Access only works for the exact email you add here.</p>
      <form className="mt-3 grid gap-2 md:grid-cols-[1fr_1fr_auto_auto]" onSubmit={async (e) => {
        e.preventDefault();
        if (!valid) return;
        const res = await live.inviteMember(email.trim(), role, name.trim());
        setMsg(res === 'ok' ? { ok: true, text: `${email.trim()} can now sign in as ${role}.` } : { ok: false, text: 'Could not add this person. Check the email and try again.' });
        if (res === 'ok') { setEmail(''); setName(''); }
      }}>
        <label className="sr-only" htmlFor="inv-email">Email</label>
        <input id="inv-email" type="email" maxLength={254} value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@provider.co.uk" className="rounded-xl border border-slate-200 px-3 py-2 text-[13px]" />
        <label className="sr-only" htmlFor="inv-name">Name</label>
        <input id="inv-name" maxLength={80} value={name} onChange={(e) => setName(e.target.value)} placeholder="Full name" className="rounded-xl border border-slate-200 px-3 py-2 text-[13px]" />
        <label className="sr-only" htmlFor="inv-role">Role</label>
        <select id="inv-role" value={role} onChange={(e) => setRole(e.target.value as 'worker' | 'manager')} className="rounded-xl border border-slate-200 px-3 py-2 text-[13px]"><option value="worker">Support worker</option><option value="manager">Manager</option></select>
        <button type="submit" disabled={!valid} className={btn.primary}>Add access</button>
      </form>
      {msg && <p className={`mt-2 text-[12px] ${msg.ok ? 'text-emerald-700' : 'text-red-700'}`}>{msg.text}</p>}
    </section>
  );
}

function FamilyPhone({ state, now, act, notify }: { state: State; now: number; act: Act; notify: Notify }) {
  const r = residentById('margaret');
  const [msg, setMsg] = useState('');
  const shared = state.logs.filter((l) => l.residentId === r.id && l.synced && ['voice', 'text', 'photo'].includes(l.source) && !l.risk && l.status !== 'rejected' && (l.tags.mood || l.tags.activity?.length || l.tags.mealPct !== undefined || l.tags.personalCare?.length)).sort((a, b) => b.time - a.time);
  const meal = mealAverage(state.logs, r.id);
  const mood = [...state.logs].filter((l) => l.residentId === r.id && l.tags.mood && !l.risk).sort((a, b) => b.time - a.time)[0]?.tags.mood;
  const mine = state.familyMessages.filter((m) => m.residentId === r.id);
  const slots = ['Wed 11 Nov · 14:00', 'Thu 12 Nov · 11:00', 'Sat 14 Nov · 15:30'];
  const d = new Date(now);
  const send = (text: string, kind: FamilyMessage['kind']) => {
    act({ type: 'FAMILY_MESSAGE', msg: { id: uid('FAM'), time: now, from: FAMILY.name, residentId: r.id, text, kind } }, 'worker');
    notify(kind === 'visit' ? `Visit request sent: ${text}` : 'Message sent to the home', 'cyan', 'family');
  };
  return (
    <div className="relative mx-auto w-full max-w-[392px] shrink-0">
      <div className="relative h-[820px] rounded-[54px] border border-white/15 bg-gradient-to-b from-slate-700/60 to-slate-900/80 p-[10px] shadow-2xl shadow-black/60 ring-1 ring-black/40">
        <div className="relative flex h-full flex-col overflow-hidden rounded-[44px] bg-[#F7F5F0] text-slate-800">
          <div className="relative z-10 flex h-11 shrink-0 items-center justify-between px-7 pt-1 text-[13px] font-semibold text-slate-900">
            <span className="tnum">{pad(d.getUTCHours())}:{pad(d.getUTCMinutes())}</span>
            <span className="absolute left-1/2 top-2 h-[26px] w-[104px] -translate-x-1/2 rounded-full bg-black" aria-hidden />
            <span className="tnum text-[11px] text-slate-500">5G</span>
          </div>
          <div className="cos-scroll min-h-0 flex-1 space-y-3 overflow-y-auto px-4 pb-6 pt-2">
            <div className="flex items-center gap-3">
              <Avatar name={r.name} hue={r.hue} size="h-11 w-11 text-sm" />
              <div><p className="text-[11px] font-semibold uppercase tracking-wider text-teal-700">Willow Lane family portal</p><p className="cos-display text-[17px] font-bold text-slate-900">Hello Helen</p></div>
            </div>
            <p className="rounded-2xl border border-teal-200 bg-teal-50 p-3 text-[12px] leading-5 text-teal-900"><ShieldCheck className="mr-1 inline h-4 w-4" aria-hidden />Shared with Margaret's agreement (reviewed 05 Jun 2026). You see wellbeing, activities and meals. Medicines and incidents are discussed with you by phone.</p>
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-2xl border border-slate-200 bg-white p-3"><p className="text-[10px] uppercase tracking-wider text-slate-500">Mood today</p><p className="mt-0.5 text-[14px] font-semibold text-slate-900">{mood ?? 'Not recorded yet'}</p></div>
              <div className="rounded-2xl border border-slate-200 bg-white p-3"><p className="text-[10px] uppercase tracking-wider text-slate-500">Meals today</p><p className="mt-0.5 text-[14px] font-semibold text-slate-900">{meal === null ? 'Not recorded yet' : meal >= 75 ? 'Ate well' : meal >= 50 ? 'Ate about half' : 'Small appetite'}</p></div>
            </div>
            <h3 className="cos-display pt-1 text-[14px] font-bold text-slate-900">Today with Mum</h3>
            <ol className="space-y-2">
              {shared.map((l) => (
                <li key={l.id} className="rounded-2xl border border-slate-200 bg-white p-3">
                  <p className="flex items-center gap-2 text-[11px] text-slate-500"><span className="tnum font-semibold text-slate-700">{fmt(l.time)}</span>{l.status === 'approved' && <Chip surface="light" tone="emerald">Checked by the home</Chip>}</p>
                  <p className="mt-1 text-[13px] leading-5 text-slate-800">{l.text.split(/(?<=[.!?])\s/)[0]}</p>
                </li>
              ))}
            </ol>
            <h3 className="cos-display pt-1 text-[14px] font-bold text-slate-900">Message the home</h3>
            <label htmlFor="fam-msg" className="sr-only">Message</label>
            <textarea id="fam-msg" rows={3} maxLength={400} value={msg} onChange={(e) => setMsg(e.target.value)} placeholder="e.g. I'll bring Mum's new cardigan on Thursday" className="w-full resize-none rounded-2xl border border-slate-200 bg-white px-3 py-2 text-[13px] focus:border-teal-500 focus:outline-none" />
            <button type="button" disabled={msg.trim().length < 3} onClick={() => { send(msg.trim(), 'message'); setMsg(''); }} className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-teal-600 px-4 py-2.5 text-sm font-semibold text-white disabled:bg-slate-300"><Send className="h-4 w-4" aria-hidden />Send to the manager</button>
            {mine.length > 0 && <ul className="space-y-1.5">{mine.slice().reverse().map((m) => <li key={m.id} className="rounded-xl bg-white px-3 py-2 text-[12px] text-slate-700"><span className="tnum font-semibold">{fmt(m.time)}</span> · {m.text} <span className="text-emerald-700">· Delivered</span></li>)}</ul>}
            <h3 className="cos-display pt-1 text-[14px] font-bold text-slate-900">Book a visit</h3>
            <div className="grid gap-2">
              {slots.map((sl) => { const booked = mine.some((m) => m.kind === 'visit' && m.text.includes(sl)); return <button key={sl} type="button" disabled={booked} onClick={() => send(`Visit requested for ${sl}`, 'visit')} className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-[13px] font-semibold text-slate-800 disabled:border-emerald-200 disabled:bg-emerald-50 disabled:text-emerald-800"><span className="tnum flex items-center gap-2"><CalendarDays className="h-4 w-4 text-teal-700" aria-hidden />{sl}</span>{booked ? 'Requested' : 'Request'}</button>; })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ============================== Shell ============================== */

function ReadinessGauge({ value, onClick }: { value: number; onClick: () => void }) {
  const tone = value >= 97 ? '#10B981' : value >= 92 ? '#F59E0B' : '#EF4444';
  return (
    <button type="button" onClick={onClick} className="flex items-center gap-2.5 rounded-2xl border border-white/10 bg-white/[0.06] py-1.5 pl-1.5 pr-3 text-left backdrop-blur-xl transition hover:bg-white/[0.1]" aria-label={`CQC readiness ${value.toFixed(1)} percent. Open audit hub.`}>
      <Ring size={38} stroke={4} progress={value / 100} color={tone} track="rgba(255,255,255,.12)"><Gauge className="h-4 w-4 text-white/80" aria-hidden /></Ring>
      <span><span className="cos-display tnum block text-[15px] font-bold leading-5 text-white">{value.toFixed(1)}% audit ready</span><span className="block text-[10px] leading-4 text-slate-400">Single Assessment Framework</span></span>
    </button>
  );
}

function SyncPulse({ pulse }: { pulse: { n: number; dir: 'worker' | 'manager' } }) {
  return (
    <div className="relative hidden w-14 shrink-0 flex-col items-center justify-center xl:flex" aria-hidden>
      <span className="absolute inset-y-24 left-1/2 w-px -translate-x-1/2 bg-gradient-to-b from-transparent via-teal-400/30 to-transparent" />
      <div className="relative h-px w-full bg-teal-400/30">
        {pulse.n > 0 && <span key={pulse.n} className="absolute -top-[4px] h-[9px] w-[9px] rounded-full bg-cyan-300 shadow-[0_0_12px_4px_rgba(103,232,249,.7)]" style={{ animation: `${pulse.dir === 'worker' ? 'cos-packet-r' : 'cos-packet-l'} .9s ease-in-out both` }} />}
      </div>
      <span className="mt-3 rotate-90 whitespace-nowrap text-[10px] font-semibold uppercase tracking-[0.2em] text-teal-300/70">Live sync</span>
    </div>
  );
}

export default function CarePlanOSApp({ live }: { live?: LiveBridge } = {}) {
  const clock = useSimClock();
  const now = live ? BASE_NOW + (Date.now() + live.skewMs - live.clockBaseMs) + live.clockOffsetMs : clock.now;
  const [state, dispatch] = useReducer(reducer, undefined, buildInitialState);
  const [view, setView] = useState<ViewMode>(live?.role === 'worker' ? 'worker' : 'split');
  const [confirmReset, setConfirmReset] = useState(false);
  const liveRef = useRef(live);
  liveRef.current = live;
  const applied = useRef(0);
  const escalating = useRef<Set<string>>(new Set());
  const liveEvents = live ? live.events : null;
  useEffect(() => {
    if (!liveEvents) return;
    while (applied.current < liveEvents.length) {
      const a = liveEvents[applied.current++];
      if (a.type !== 'CLOCK_ADVANCE') dispatch(a);
    }
  }, [liveEvents]);
  const [managerTab, setManagerTab] = useState<ManagerTab>('triage');
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [pulse, setPulse] = useState<{ n: number; dir: 'worker' | 'manager' }>({ n: 0, dir: 'worker' });
  const [sim, setSim] = useState(!live);
  const [session, setSession] = useState(0);
  const simIdx = useRef(0);
  const toastId = useRef(1);

  const notify = useCallback<Notify>((text, tone, origin) => {
    const id = toastId.current++;
    setToasts((t) => [...t.slice(-2), { id, text, tone, origin }]);
    window.setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3200);
  }, []);
  const act = useCallback<Act>((a, origin) => {
    setPulse((p) => ({ n: p.n + 1, dir: origin }));
    const lv = liveRef.current;
    if (!lv) { dispatch(a); return; }
    if (a.type === 'SET_ONLINE' || a.type === 'RESET') return;
    void lv.submit(a).then((res) => {
      if (res === 'ok') return;
      notify(friendlyLiveError(res), res.startsWith('PRN') || res.startsWith('PIN') ? 'amber' : 'red', 'system');
      if (res === 'STALE_EPOCH') window.setTimeout(() => window.location.reload(), 1500);
    });
  }, [notify]);

  const nowRef = useRef(now);
  nowRef.current = now;
  useEffect(() => {
    if (!sim || liveRef.current) return undefined;
    const i = window.setInterval(() => {
      if (simIdx.current >= COLLEAGUE_FEED.length) return;
      const item = COLLEAGUE_FEED[simIdx.current++];
      const entry = makeLog({ residentId: item.residentId, time: nowRef.current, text: item.text, source: 'voice', author: item.actor, accent: item.accent, confidence: 95, durationSec: 11 + (simIdx.current * 7) % 30 });
      dispatch({ type: 'ADD_LOG', entry, actor: item.actor });
      setPulse((p) => ({ n: p.n + 1, dir: 'worker' }));
    }, 40000);
    return () => window.clearInterval(i);
  }, [sim, session]);

  useEffect(() => {
    if (live && live.role !== 'manager') return;
    const due = state.logs.find((l) => {
      if (l.status !== 'clarification' || l.escalatedAt || escalating.current.has(l.id)) return false;
      const q = [...l.thread].reverse().find((m) => m.from === 'manager');
      return !!q && now - q.time > CLARIFY_SLA_MIN * MIN;
    });
    if (due) { escalating.current.add(due.id); act({ type: 'ESCALATE_CLARIFICATION', logId: due.id, now }, 'manager'); notify(`Clarification to ${due.author} passed the ${CLARIFY_SLA_MIN}-minute SLA and was escalated`, 'red', 'system'); }
  }, [state.logs, now, act, notify, live]);

  const score = readinessScore(state, now);
  const reset = () => { dispatch({ type: 'RESET', state: buildInitialState() }); clock.reset(); simIdx.current = 0; setSession((s) => s + 1); setManagerTab('triage'); notify('Demo reset to 15:42, hour 8 of the shift', 'teal', 'system'); };
  const allViews: Array<{ id: ViewMode; label: string; icon: React.ElementType }> = [
    { id: 'split', label: 'Live demo', icon: Columns2 }, { id: 'worker', label: 'Frontline', icon: Smartphone }, { id: 'manager', label: 'Manager', icon: Monitor }, { id: 'family', label: 'Family', icon: House },
  ];
  const views = live?.role === 'worker' ? allViews.filter((v) => v.id === 'worker') : allViews;
  const isManager = !live || live.role === 'manager';
  const fastForward = () => {
    if (live) act({ type: 'CLOCK_ADVANCE', ms: 15 * MIN }, 'manager');
    else clock.advance(15 * MIN);
    notify('Clock moved forward 15 minutes on every device', 'teal', 'system');
  };
  const doReset = () => {
    if (!live) { reset(); return; }
    setConfirmReset(false);
    void live.resetDemo().then((res) => { if (res === 'ok') window.location.reload(); else notify(friendlyLiveError(res), 'red', 'system'); });
  };

  return (
    <LiveCtx.Provider value={live ?? null}>
    <div className="cos-root relative min-h-screen overflow-x-hidden bg-[#0F172A] text-slate-100">
      <style>{GLOBAL_CSS}</style>
      <div className="pointer-events-none fixed inset-0" aria-hidden style={{ background: 'radial-gradient(60% 50% at 8% 8%, rgba(13,148,136,.28), transparent 60%), radial-gradient(45% 40% at 92% 12%, rgba(6,182,212,.16), transparent 60%), radial-gradient(50% 45% at 70% 100%, rgba(250,245,235,.07), transparent 60%), linear-gradient(180deg, #0F172A 0%, #1E293B 100%)' }} />

      <header className="sticky top-0 z-40 border-b border-white/10 bg-slate-950/55 backdrop-blur-xl" style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}>
        <div className="mx-auto flex max-w-[1680px] flex-wrap items-center gap-x-4 gap-y-2 py-2.5" style={{ paddingLeft: 'max(16px, env(safe-area-inset-left, 0px))', paddingRight: 'max(16px, env(safe-area-inset-right, 0px))' }}>
          <div className="flex items-center gap-2.5">
            <span className="relative grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-teal-400 to-cyan-500 shadow-lg shadow-teal-500/30"><HeartHandshake className="h-5 w-5 text-slate-950" aria-hidden /></span>
            <span><span className="cos-display block text-[17px] font-extrabold leading-5 tracking-tight text-white">CarePlan<span className="text-teal-300">OS</span></span><span className="block text-[10px] font-medium uppercase tracking-[0.16em] text-slate-400">Care management · CQC ready</span></span>
          </div>
          <ReadinessGauge value={score} onClick={() => { setManagerTab('audit'); if (view === 'worker') setView('split'); }} />
          {live ? (
            <span className={`hidden items-center gap-2 rounded-2xl border px-3 py-2 text-[12px] backdrop-blur-xl md:flex ${live.connected ? 'border-emerald-400/25 bg-emerald-500/10 text-emerald-100' : 'border-amber-400/40 bg-amber-500/15 text-amber-100'}`}>
              {live.connected ? <Cloud className="h-4 w-4" aria-hidden /> : <CloudOff className="h-4 w-4" aria-hidden />}
              {live.connected ? 'Live · synced to UK London (eu-west-2)' : 'Reconnecting to server…'}
            </span>
          ) : (
          <button type="button" onClick={() => { act({ type: 'SET_ONLINE', online: !state.online, now }, 'worker'); notify(state.online ? 'Worker device offline. Records queue in the encrypted outbox.' : 'Back online. Outbox synced.', state.online ? 'amber' : 'emerald', 'system'); }} className={`hidden items-center gap-2 rounded-2xl border px-3 py-2 text-[12px] backdrop-blur-xl transition md:flex ${state.online ? 'border-emerald-400/25 bg-emerald-500/10 text-emerald-100 hover:bg-emerald-500/15' : 'border-amber-400/40 bg-amber-500/15 text-amber-100'}`} aria-pressed={!state.online} title="Toggle worker connectivity">
            {state.online ? <Cloud className="h-4 w-4" aria-hidden /> : <CloudOff className="h-4 w-4" aria-hidden />}
            {state.online ? 'All records synced · UK-South encrypted cache' : `Offline · ${state.queue.length} queued on device`}
          </button>
          )}
          <div className="ml-auto flex items-center gap-2">
            <div className="flex rounded-2xl border border-white/10 bg-white/[0.06] p-1 backdrop-blur-xl" role="tablist" aria-label="View">
              {views.map((v) => (
                <button key={v.id} type="button" role="tab" aria-selected={view === v.id} onClick={() => setView(v.id)} className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-[12px] font-semibold transition ${view === v.id ? 'bg-teal-500 text-slate-950 shadow-lg shadow-teal-500/30' : 'text-slate-300 hover:text-white'}`}>
                  <v.icon className="h-4 w-4" aria-hidden /><span className="hidden sm:inline">{v.label}</span>
                </button>
              ))}
            </div>
            {isManager && <button type="button" onClick={fastForward} className="grid h-9 w-9 place-items-center rounded-xl border border-white/10 bg-white/[0.06] text-slate-200 hover:bg-white/[0.12]" aria-label="Fast-forward 15 minutes" title="Fast-forward 15 minutes"><FastForward className="h-4 w-4" /></button>}
            {isManager && (
              <div className="relative">
                <button type="button" onClick={() => (live ? setConfirmReset((v) => !v) : reset())} className="grid h-9 w-9 place-items-center rounded-xl border border-white/10 bg-white/[0.06] text-slate-200 hover:bg-white/[0.12]" aria-label="Reset demo" title="Reset demo"><RotateCcw className="h-4 w-4" /></button>
                {confirmReset && (
                  <div className="absolute right-0 top-11 z-50 w-64 rounded-2xl border border-white/15 bg-slate-900/95 p-3 text-[12px] text-slate-200 shadow-2xl backdrop-blur-xl">
                    <p>Start a fresh demo for every signed-in device? The old session stays in the audit ledger.</p>
                    <div className="mt-2 flex justify-end gap-2"><button type="button" className="rounded-lg px-2.5 py-1.5 text-slate-300 hover:bg-white/10" onClick={() => setConfirmReset(false)}>Cancel</button><button type="button" className="rounded-lg bg-teal-500 px-2.5 py-1.5 font-semibold text-slate-950" onClick={doReset}>Reset demo</button></div>
                  </div>
                )}
              </div>
            )}
            {live && (
              <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.06] py-1 pl-3 pr-1 text-[11px] text-slate-300">
                <span className="hidden max-w-[160px] truncate lg:inline" title={live.email}>{live.email} · {live.role}</span>
                <button type="button" onClick={live.signOut} className="rounded-lg px-2 py-1 font-semibold text-slate-100 hover:bg-white/10">Sign out</button>
              </div>
            )}
          </div>
        </div>
      </header>

      <main key={session} className="relative mx-auto max-w-[1680px] py-5" style={{ paddingLeft: 'max(16px, env(safe-area-inset-left, 0px))', paddingRight: 'max(16px, env(safe-area-inset-right, 0px))' }}>
        {view === 'split' && (
          <div className="flex flex-col items-stretch gap-5 xl:flex-row xl:gap-0">
            <div className="flex flex-col items-center gap-2">
              <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400"><Smartphone className="h-3.5 w-3.5" aria-hidden />Frontline · {state.activeWorker ? state.activeWorker.name : 'Handset locked'}</p>
              <WorkerPhone state={state} now={now} act={act} notify={notify} />
            </div>
            <SyncPulse pulse={pulse} />
            <div className="flex min-w-0 flex-1 flex-col gap-2">
              <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400"><Monitor className="h-3.5 w-3.5" aria-hidden />Registered Manager · Sarah Okafor</p>
              <ManagerPortal state={state} now={now} act={act} notify={notify} tab={managerTab} setTab={setManagerTab} sim={sim} setSim={setSim} compact />
            </div>
          </div>
        )}
        {view === 'worker' && (
          <div className="flex flex-col items-center gap-6 lg:flex-row lg:items-start lg:justify-center">
            <WorkerPhone state={state} now={now} act={act} notify={notify} />
            <div className="max-w-sm space-y-3 lg:pt-10">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-teal-300">12-hour shift companion</p>
              <h2 className="cos-display cos-balance text-2xl font-bold text-white">Care notes in seconds, not at the end of a 12-hour shift</h2>
              <ul className="space-y-2 text-[13px] text-slate-300">
                {[[Mic, 'Speak for 15 to 60 seconds. Fluids, meals, mood and care are tagged for you.'], [ScanLine, 'Scan every box. Wrong medicine, early PRN and paracetamol overdose across products are blocked.'], [KeyRound, 'Shared handsets: badge plus PIN, auto-lock, and every signature belongs to one person.'], [Brain, 'Speak an incident. It becomes a structured ABC chart.'], [Siren, 'Press and hold SOS. Help comes without a sound.']].map(([I, t]) => { const Ico = I as React.ElementType; return <li key={t as string} className="flex gap-2.5"><Ico className="mt-0.5 h-4 w-4 shrink-0 text-teal-300" aria-hidden />{t as string}</li>; })}
              </ul>
            </div>
          </div>
        )}
        {view === 'family' && (
          <div className="flex flex-col items-center gap-6 lg:flex-row lg:items-start lg:justify-center">
            <FamilyPhone state={state} now={now} act={act} notify={notify} />
            <div className="max-w-sm space-y-3 lg:pt-10">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-teal-300">Family portal</p>
              <h2 className="cos-display cos-balance text-2xl font-bold text-white">Families see a calm, checked view of the day</h2>
              <ul className="space-y-2 text-[13px] text-slate-300">
                <li className="flex gap-2.5"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-teal-300" aria-hidden />Only what the person agreed to share. No medicines, no incidents, no flagged notes.</li>
                <li className="flex gap-2.5"><MessageCircle className="mt-0.5 h-4 w-4 shrink-0 text-teal-300" aria-hidden />Messages land in the manager's feed and count as Responsive evidence.</li>
                <li className="flex gap-2.5"><CalendarDays className="mt-0.5 h-4 w-4 shrink-0 text-teal-300" aria-hidden />Visit requests replace phone tag with the office.</li>
              </ul>
            </div>
          </div>
        )}
        {view === 'manager' && <ManagerPortal state={state} now={now} act={act} notify={notify} tab={managerTab} setTab={setManagerTab} sim={sim} setSim={setSim} compact={false} />}
        <p className="mt-5 text-center text-[11px] text-slate-500">{live ? `${live.tenantName} · demo tenant with fictional residents and staff · shared clock on every device` : 'Interactive prototype with fictional residents and staff. Simulated clock starts at 15:42 on Tue 10 Nov 2026.'}</p>
      </main>

      <div className="pointer-events-none fixed bottom-4 right-4 z-[80] flex w-[min(360px,calc(100vw-32px))] flex-col gap-2" aria-live="polite" style={{ marginBottom: 'env(safe-area-inset-bottom, 0px)' }}>
        {toasts.map((t) => (
          <div key={t.id} className={`cos-rise pointer-events-auto flex items-start gap-2.5 rounded-2xl border px-3.5 py-2.5 text-[13px] shadow-2xl backdrop-blur-xl ${TONE_DARK[t.tone]} bg-slate-900/90`}>
            {t.origin === 'worker' ? <Smartphone className="mt-0.5 h-4 w-4 shrink-0" aria-hidden /> : t.origin === 'manager' ? <Monitor className="mt-0.5 h-4 w-4 shrink-0" aria-hidden /> : <Bell className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />}
            <span className="min-w-0 flex-1"><span className="block text-[10px] font-semibold uppercase tracking-wider opacity-70">{t.origin === 'worker' ? 'Frontline app' : t.origin === 'manager' ? 'Manager portal' : t.origin === 'family' ? 'Family portal' : 'CarePlanOS'}</span>{t.text}</span>
            <button type="button" onClick={() => setToasts((x) => x.filter((y) => y.id !== t.id))} className="opacity-60 hover:opacity-100" aria-label="Dismiss"><BellOff className="h-3.5 w-3.5" /></button>
          </div>
        ))}
      </div>
    </div>
    </LiveCtx.Provider>
  );
}
