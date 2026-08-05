import { useEffect, useState } from 'react';
import MatchingAnimation from '../../components/ui/MatchingAnimation';

// ponytail: throwaway preview route, delete after review — not linked from any nav
export default function MatchingTest() {
  const [progress, setProgress] = useState(0);
  const [seed, setSeed] = useState(1);
  const [auto, setAuto] = useState(true);

  useEffect(() => {
    if (!auto) return;
    let p = 0;
    const id = setInterval(() => {
      p = (p + 0.01) % 1.2;
      setProgress(Math.min(p, 1));
      if (p >= 1.2) p = 0;
    }, 50);
    return () => clearInterval(id);
  }, [auto]);

  return (
    <div className="min-h-screen bg-white p-8">
      <h1 className="font-display text-xl mb-4">MatchingAnimation preview</h1>
      <div className="h-80 w-80 border border-brand-200 rounded-2xl overflow-hidden mb-4">
        <MatchingAnimation progress={progress} seed={seed} />
      </div>
      <div className="flex flex-col gap-3 max-w-sm">
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={auto} onChange={(e) => setAuto(e.target.checked)} />
          auto-play progress
        </label>
        <label className="flex flex-col gap-1">
          progress: {progress.toFixed(2)}
          <input type="range" min="0" max="1" step="0.01" value={progress}
            onChange={(e) => { setAuto(false); setProgress(Number(e.target.value)); }} />
        </label>
        <label className="flex flex-col gap-1">
          seed: {seed}
          <input type="range" min="1" max="20" step="1" value={seed}
            onChange={(e) => setSeed(Number(e.target.value))} />
        </label>
      </div>
    </div>
  );
}
