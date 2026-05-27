export default function Loading() {
  return (
    <div className="flex flex-col gap-4 pt-2">
      <div className="h-8 w-40 animate-pulse rounded-xl bg-white/5" />
      <div className="glass h-64 animate-pulse" />
      <div className="glass h-24 animate-pulse" />
      <div className="glass h-16 animate-pulse" />
    </div>
  );
}
