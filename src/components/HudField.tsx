export function HudField({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline gap-3">
      <span className="label text-sm">{label}</span>
      <span className="value text-sm">{value}</span>
    </div>
  )
}
