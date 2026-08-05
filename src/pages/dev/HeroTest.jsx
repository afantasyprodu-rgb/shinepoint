import { useState } from 'react';
import HeroFlowField from '../../components/ui/HeroFlowField';

// ponytail: throwaway preview route, delete after review — not linked from any nav
export default function HeroTest() {
  const [seed, setSeed] = useState(1);

  return (
    <div className="min-h-screen bg-white">
      <div className="relative h-[420px] overflow-hidden bg-brand-50">
        <HeroFlowField seed={seed} />
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-6">
          <h1 className="font-display text-4xl font-bold text-brand-900">ShinePoint</h1>
          <p className="mt-2 text-brand-700">Mobile car detailing, brought to your driveway.</p>
        </div>
      </div>
      <div className="p-6 max-w-sm">
        <label className="flex flex-col gap-1">
          seed: {seed}
          <input type="range" min="1" max="20" step="1" value={seed}
            onChange={(e) => setSeed(Number(e.target.value))} />
        </label>
      </div>
    </div>
  );
}
