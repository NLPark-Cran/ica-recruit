#!/usr/bin/env python3
"""用 TokenDance seedream-5.0-pro 生成站点素材并压缩为 WebP。

用法（在 backend/ 目录）：uv run --with pillow python ../scripts/gen_assets.py
输出到项目根 assets/。已存在且非 --force 时跳过。
"""

import asyncio
import sys
from pathlib import Path

import httpx
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "assets"
KEY = None
for line in (ROOT / "backend" / ".env").read_text().splitlines():
    if line.startswith("TOKENDANCE_API_KEY="):
        KEY = line.split("=", 1)[1]
assert KEY, "TOKENDANCE_API_KEY not found"

API = "https://tokendance.space/gateway/ark/v3/images/generations"
MODEL = "seedream-5.0-pro"
HEADERS = {
    "Authorization": f"Bearer {KEY}",
    "X-App-URL": "https://ica.hub.tt2.li",
    "Content-Type": "application/json",
}

STYLE = "扁平插画风，几何撞色，奶油白背景，深紫与靛蓝为主色、荧光橙点缀，年轻活力，大学校园社团氛围，无文字"

TASKS = [
    ("hero", 1600, "横版16:9宽幅主视觉插画：一群不同肤色的年轻人举着各国小国旗围成半圆欢呼，中间一个巨大的地球仪，彩带与纸飞机飞过，" + STYLE),
    ("act-1", 800, "横版4:3插画：英语角活动，十几个大学生围坐在户外草坪圆桌旁开心交谈，头顶有英文对话气泡，" + STYLE),
    ("act-2", 800, "横版4:3插画：模拟联合国会议，大学生们身穿正装坐在会议桌前举牌发言，桌上有各国桌牌，" + STYLE),
    ("act-3", 800, "横版4:3插画：海外交换分享会，一位学生在投影幕前分享世界地图背景的幻灯片，台下同学举手提问，" + STYLE),
    ("prize-candy", 400, "正方形图标插画：彩色糖果小礼包，玻璃纸包装糖果散落，" + STYLE),
    ("prize-postcard", 400, "正方形图标插画：一叠世界风景手绘明信片，" + STYLE),
    ("prize-badge", 400, "正方形图标插画：一枚圆形珐琅徽章，图案是地球与握手，" + STYLE),
    ("prize-snack", 400, "正方形图标插画：环球零食礼包，各国包装零食堆成小山，" + STYLE),
    ("prize-keychain", 400, "正方形图标插画：飞机与地球造型的金属钥匙扣，" + STYLE),
    ("prize-tote", 400, "正方形图标插画：米色帆布包，上面印着简约地球与航线图案，" + STYLE),
    ("prize-stationery", 400, "正方形图标插画：国际风文具套装，笔记本钢笔和各国旗帜贴纸，" + STYLE),
    ("prize-tdcard", 400, "正方形图标插画：一张渐变色会员卡，卡片上有闪电符号与星星，紫色到橙色渐变，" + STYLE),
]

SEM = asyncio.Semaphore(3)


async def gen_one(client: httpx.AsyncClient, name: str, maxw: int, prompt: str) -> str:
    webp = OUT / f"{name}.webp"
    if webp.exists() and "--force" not in sys.argv:
        return f"skip {name}"
    for size in ("2K",):
        resp = await client.post(
            API,
            headers=HEADERS,
            json={
                "model": MODEL,
                "prompt": prompt,
                "size": size,
                "output_format": "png",
                "response_format": "url",
                "watermark": False,
            },
        )
        if resp.status_code == 200:
            break
        last = resp.text[:300]
    else:
        return f"FAIL {name}: {last}"
    if resp.status_code != 200:
        return f"FAIL {name}: {resp.text[:300]}"
    url = resp.json()["data"][0]["url"]
    img = await client.get(url)
    img.raise_for_status()
    raw = OUT / f"{name}.png"
    raw.write_bytes(img.content)
    im = Image.open(raw).convert("RGB")
    if im.width > maxw:
        im = im.resize((maxw, int(im.height * maxw / im.width)), Image.LANCZOS)
    im.save(webp, "WEBP", quality=82, method=6)
    raw.unlink()
    return f"ok {name} {webp.stat().st_size // 1024}KB"


async def main() -> None:
    OUT.mkdir(exist_ok=True)
    async with httpx.AsyncClient(timeout=httpx.Timeout(300, connect=15)) as client:

        async def guarded(t):
            async with SEM:
                return await gen_one(client, *t)

        for r in await asyncio.gather(*[guarded(t) for t in TASKS]):
            print(r, flush=True)


if __name__ == "__main__":
    asyncio.run(main())
