#!/usr/bin/env python3
"""抽奖接口并发压测：模拟 N 个用户同时抽第 1 轮，验证不超卖、不重复。

需要后端 DEBUG=true（用 dev-login 批量发会话）。用法：
  cd backend && uv run python ../scripts/load_test.py --users 50 --base http://127.0.0.1:8020
"""

import argparse
import asyncio
import time

import httpx


async def one_user(base: str, watcha_id: int) -> str:
    async with httpx.AsyncClient(base_url=base, timeout=30) as client:
        r = await client.get(
            f"/api/auth/dev-login?watcha_id={watcha_id}", follow_redirects=False
        )
        if r.status_code not in (302, 307):
            return "noauth"
        r = await client.post("/api/lottery/draw/1")
        if r.status_code == 200:
            return "win" if r.json()["win"] else "lose"
        return f"err{r.status_code}"


async def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--users", type=int, default=50)
    ap.add_argument("--base", default="http://127.0.0.1:8020")
    args = ap.parse_args()

    t0 = time.monotonic()
    results = await asyncio.gather(*[one_user(args.base, 70000 + i) for i in range(args.users)])
    dt = time.monotonic() - t0
    from collections import Counter

    print(Counter(results))
    print(f"{args.users} users in {dt:.2f}s ({args.users / dt:.0f} req/s)")


if __name__ == "__main__":
    asyncio.run(main())
