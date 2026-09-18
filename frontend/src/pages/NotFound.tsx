import { Link } from 'react-router'

export default function NotFound() {
  return (
    <div className="flex flex-col items-center gap-4 py-24 text-center">
      <span className="text-6xl">🧭</span>
      <h1 className="text-2xl font-black text-grape">页面走丢了</h1>
      <p className="text-sm text-grape/60">你要找的页面不存在，回首页继续探索吧。</p>
      <Link
        to="/"
        className="flex min-h-11 items-center rounded-full bg-grape px-6 text-sm font-bold text-white shadow-sticker"
      >
        回到首页
      </Link>
    </div>
  )
}
