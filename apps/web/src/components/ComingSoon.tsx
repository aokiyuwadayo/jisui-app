export function ComingSoon({ title, note }: { title: string; note: string }) {
  return (
    <section className="pt-4">
      <h2 className="font-serif text-xl font-bold">{title}</h2>
      <div className="mt-4 rounded-2xl border border-dashed border-line bg-paper p-6 text-sm leading-relaxed text-mute">
        {note}
      </div>
    </section>
  );
}
