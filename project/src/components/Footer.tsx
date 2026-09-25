import { Link } from 'react-router-dom';
import { useApp } from '@/lib/appContext';

export default function Footer() {
  const { mode, resetDemo } = useApp();
  return (
    <footer className="mt-16 bg-asphalt text-concrete-300">
      <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-8 text-sm sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div>
          <p className="font-display text-xl font-semibold text-white">RoadFix AI</p>
          <p>From citizen reports to predictive road safety.</p>
          {mode === 'demo' && <p className="mt-1 text-lane">Demo data: fictional roads and facilities. Not real statistics.</p>}
        </div>
        <nav aria-label="Footer" className="flex flex-wrap gap-x-5 gap-y-2">
          <Link to="/how-it-works" className="hover:text-white">How it works</Link>
          <Link to="/impact" className="hover:text-white">Community impact</Link>
          <Link to="/about" className="hover:text-white">About</Link>
          {mode === 'demo' && (
            <button type="button" className="text-left hover:text-white" onClick={() => { if (window.confirm('Reset all demo data to the original 64 incidents?')) void resetDemo(); }}>
              Reset demo data
            </button>
          )}
        </nav>
      </div>
    </footer>
  );
}
