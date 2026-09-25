import { ArrowRight, Camera, ClipboardCheck, Cpu, HardHat, MapPinned, Search, ShieldCheck } from 'lucide-react';
import { Link } from 'react-router-dom';
import HeroVisual from '@/components/HeroVisual';
import ImpactMetrics from '@/components/ImpactMetrics';

const STEPS = [
  { icon: Camera, t: 'Report', d: 'Snap a photo and drop a pin. It takes about a minute.' },
  { icon: Cpu, t: 'Analyze', d: 'AI suggests the issue type and severity. You stay in charge and can correct it.' },
  { icon: Search, t: 'Verify', d: 'Neighbours confirm the spot, and duplicates are caught before they pile up.' },
  { icon: MapPinned, t: 'Prioritize', d: 'A transparent score shows exactly why one problem ranks above another.' },
  { icon: HardHat, t: 'Resolve', d: 'Authorities assign a department, track work and close the incident.' },
  { icon: ClipboardCheck, t: 'Verify resolution', d: 'Citizens compare before and after photos and confirm the road is really fixed.' },
];

export function LandingPage() {
  return (
    <div>
      <section className="bg-asphalt text-white">
        <div className="mx-auto grid max-w-7xl items-center gap-12 px-4 pb-16 pt-12 sm:px-6 lg:grid-cols-2 lg:py-20">
          <div>
            <h1 className="text-6xl font-bold leading-[0.95] sm:text-7xl">RoadFix AI</h1>
            <p className="mt-3 font-display text-3xl font-medium leading-tight text-lane sm:text-4xl">From Citizen Reports to Predictive Road Safety</p>
            <p className="mt-5 max-w-lg text-lg text-concrete-200">Report road problems, verify real-world conditions, prioritize critical issues, and help communities build safer roads.</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link to="/report" className="btn-primary !px-5 !py-3 !text-base" data-testid="hero-report">Report a Road Issue</Link>
              <Link to="/map" className="btn !border !border-concrete-400 !px-5 !py-3 !text-base text-white hover:bg-asphalt-700">Explore Road Safety Map</Link>
            </div>
          </div>
          <div className="pb-8"><HeroVisual /></div>
        </div>
        <div className="h-3 bg-[repeating-linear-gradient(90deg,#F5B700_0_48px,transparent_48px_84px)]" aria-hidden />
      </section>

      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6" aria-labelledby="how-h">
        <h2 id="how-h" className="text-4xl font-bold">How RoadFix works</h2>
        <ol className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {STEPS.map(({ icon: Icon, t, d }, i) => (
            <li key={t} className="panel flex gap-4 p-5">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-asphalt font-display text-lg font-bold text-lane">{i + 1}</span>
              <div><h3 className="flex items-center gap-2 text-2xl font-semibold"><Icon className="h-5 w-5 text-signal-gray" aria-hidden />{t}</h3><p className="mt-1 text-sm text-signal-gray">{d}</p></div>
            </li>
          ))}
        </ol>
      </section>

      <section className="bg-white py-16">
        <div className="mx-auto grid max-w-7xl gap-10 px-4 sm:px-6 lg:grid-cols-2">
          <div>
            <h2 className="text-4xl font-bold">Why RoadFix?</h2>
            <p className="mt-3 max-w-prose text-lg">Traditional systems often stop after a complaint is submitted. RoadFix follows the whole lifecycle.</p>
            <p className="mt-4 font-display text-2xl font-semibold leading-snug">Report → Evidence → Verification → Action → Resolution → Community confirmation</p>
            <p className="mt-4 max-w-prose text-signal-gray">AI helps at the edges: reading a photo, drafting a grievance, comparing a repair. Decisions stay visible and human. Every priority score lists its reasons, and nothing is filed with a government portal until you review it.</p>
            <Link to="/how-it-works" className="mt-5 inline-flex items-center gap-1 font-semibold underline">See the full story <ArrowRight className="h-4 w-4" aria-hidden /></Link>
          </div>
          <div className="rounded-lg bg-concrete-100 p-5">
            <h3 className="flex items-center gap-2 text-2xl font-semibold"><ShieldCheck className="h-5 w-5" aria-hidden /> Honest about AI</h3>
            <ul className="mt-3 space-y-2 text-sm">
              <li>AI results say “possible”, never “certain”, and show their confidence.</li>
              <li>Demo mode is labelled everywhere it appears and uses fictional roads.</li>
              <li>Duplicate reports are suggested, never merged without you.</li>
              <li>Repair checks are AI-assisted comparisons that neighbours confirm.</li>
            </ul>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6" aria-labelledby="impact-h">
        <div className="mb-6 flex items-end justify-between gap-3"><h2 id="impact-h" className="text-4xl font-bold">Community impact</h2><Link to="/impact" className="text-sm font-semibold underline">Details</Link></div>
        <ImpactMetrics />
      </section>
    </div>
  );
}

export function HowItWorksPage() {
  const flows = [
    ['A citizen reports', 'Photo, GPS pin and a short description. AI suggests a type and severity, and drafts a grievance that the citizen edits and reviews.'],
    ['Duplicates are caught', 'Nearby reports of the same kind, and photos that look alike, are offered as “Possible existing issue”. The citizen chooses to support it or submit anyway.'],
    ['The community confirms', 'Neighbours confirm the issue, say it still exists, or add evidence. Each person counts once.'],
    ['Priority is explained', 'Severity, number of reports, time unresolved, nearby schools or hospitals, and repeat locations add up to a score you can read.'],
    ['Authorities act', 'Verify, assign a department, start work and resolve, all logged in a timeline.'],
    ['The citizen verifies the repair', 'An after photo is compared with the original. Citizens confirm the fix, or reopen the issue if the problem is still there.'],
  ];
  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
      <h1 className="text-5xl font-bold">How RoadFix works</h1>
      <ol className="mt-8 space-y-6">
        {flows.map(([t, d], i) => (
          <li key={t} className="flex gap-4"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-asphalt font-display text-lg font-bold text-lane">{i + 1}</span><div><h2 className="text-2xl font-semibold">{t}</h2><p className="mt-1 text-signal-gray">{d}</p></div></li>
        ))}
      </ol>
      <div className="mt-10 flex gap-3"><Link to="/report" className="btn-primary">Report a road issue</Link><Link to="/scan" className="btn-outline">Try RoadFix Scan</Link></div>
    </div>
  );
}

export function AboutPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-5 px-4 py-12 sm:px-6">
      <h1 className="text-5xl font-bold">About RoadFix AI</h1>
      <p className="text-lg">RoadFix AI is an AI-powered road safety and civic response platform. It connects citizen reports, evidence, verification, prioritization, action and repair confirmation in one lifecycle.</p>
      <h2 className="text-3xl font-semibold">Demo mode and live mode</h2>
      <p>In demo mode, RoadFix runs entirely in your browser with 64 fictional incidents on invented roads, a rule-based demo image analyzer, and no real accounts. In live mode it uses Supabase for accounts, roles, data and photo storage, and a server-side vision model for analysis. The mode is shown in the header.</p>
      <h2 className="text-3xl font-semibold">Limits</h2>
      <ul className="list-disc space-y-1 pl-5">
        <li>AI suggestions can be wrong. They are labelled as possible and can be corrected.</li>
        <li>The risk forecast is experimental and heuristic. It does not predict specific failures.</li>
        <li>RoadFix does not file complaints with government portals for you.</li>
      </ul>
    </div>
  );
}

export function ImpactPage() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6">
      <h1 className="text-5xl font-bold">Community impact</h1>
      <p className="mb-6 mt-2 text-signal-gray">What citizens and authorities have achieved together.</p>
      <ImpactMetrics />
    </div>
  );
}
