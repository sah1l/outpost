export function DocTableSkeleton() {
  return (
    <div className="overflow-hidden rounded-panel border border-line" aria-label="Loading">
      <div className="h-[34px] border-b border-line bg-canvas" />
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="flex items-center gap-3 border-b border-line px-3 py-3.5 last:border-b-0">
          <div className="skeleton h-5 w-5" />
          <div className="flex-1 space-y-2">
            <div className="skeleton h-3 w-1/3" />
            <div className="skeleton h-2.5 w-1/5" />
          </div>
        </div>
      ))}
    </div>
  );
}
