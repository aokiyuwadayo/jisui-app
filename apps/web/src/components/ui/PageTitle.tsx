export function PageTitle({ eyebrow, title }: { eyebrow: string; title: string }) {
  return (
    <div className="mb-5">
      <p className="text-xs tracking-[0.3em] text-mute">{eyebrow}</p>
      <h2 className="mt-1 font-serif text-2xl font-bold">{title}</h2>
    </div>
  );
}
