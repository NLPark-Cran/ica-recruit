import { Link } from 'react-router'

export default function NotFound() {
  return (
    <div className="flex flex-col items-center gap-4 py-24 text-center">
      <span className="text-6xl">🎈</span>
      <h1 className="text-2xl font-black text-ink">哎呀，页面飘走了</h1>
      <p className="text-sm font-bold text-ink/50">你要找的页面不存在，回首页继续逛逛吧～</p>
      <Link to="/" className="btn-lemon">
        回到首页
      </Link>
    </div>
  )
}
