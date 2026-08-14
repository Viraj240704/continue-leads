// The signature motif: a compact cadence rail showing publishing progress.
// live = published segments, sched = scheduled, and the remainder are planned.
export function WaveRail({ total, live, sched = 0, count = 14 }: { total: number; live: number; sched?: number; count?: number }) {
  const segs = Math.max(1, Math.min(count, total || count));
  const liveN = total ? Math.round((live / total) * segs) : 0;
  const schedN = total ? Math.round((sched / total) * segs) : 0;
  // Ascending heights give it the "wave" silhouette.
  return (
    <div className="wave-rail" role="img" aria-label={`${live} of ${total} published`}>
      {Array.from({ length: segs }).map((_, i) => {
        const cls = i < liveN ? "live" : i < liveN + schedN ? "sched" : "";
        const h = 5 + Math.round((i / segs) * 11);
        return <span key={i} className={`seg ${cls}`} style={{ height: h }} />;
      })}
    </div>
  );
}
