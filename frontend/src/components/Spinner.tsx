export default function Spinner({ label = '加载中…' }: { label?: string }) {
  return (
    <div className="flex min-h-40 flex-col items-center justify-center gap-3 py-10" role="status">
      <div className="h-10 w-10 animate-spin rounded-full border-4 border-grape/20 border-t-grape" />
      <p className="text-sm font-medium text-grape/60">{label}</p>
    </div>
  )
}
