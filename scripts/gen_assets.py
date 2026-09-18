#!/usr/bin/env python3
"""用 TokenDance seedream-5.0-pro 生成站点素材并压缩为 WebP。

用法（在 backend/ 目录）：uv run --with pillow python ../scripts/gen_assets.py [--force]
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

# 观猹开学季风：天蓝 + 草绿 + 柠檬黄，粗描边卡通，手账贴纸质感
STYLE = (
    "可爱卡通插画风，粗描边，手账贴纸质感，蓝天白云绿草地校园场景，"
    "天蓝色、草绿色、柠檬黄为主色，配色明亮清新，人物可爱圆脸，年轻活力，画面无文字"
)

TASKS = [
    ("hero", 1600, "横版16:9宽幅主视觉插画：大学校园社团招新集市，五颜六色的摊位和彩旗气球，中外学生开心交流，远处有教学楼和钟楼，" + STYLE),
    ("act-visit", 800, "横版4:3插画：中国学生在校园门口热情迎接海外访学团，大家挥手微笑，背景是教学楼与梧桐树，" + STYLE),
    ("act-share", 800, "横版4:3插画：留学分享会，一位学长在讲台上分享，投影幕布是世界地图，台下同学认真听并举手，" + STYLE),
    ("act-volunteer", 800, "横版4:3插画：穿柠檬黄马甲的学生志愿者们在活动现场引导方向、搬物料，干劲十足，" + STYLE),
    ("prize-candy", 400, "正方形图标插画：彩色糖果小礼包，玻璃纸包装糖果散落，" + STYLE),
    ("prize-postcard", 400, "正方形图标插画：一叠世界风景手绘明信片，" + STYLE),
    ("prize-badge", 400, "正方形图标插画：一枚圆形珐琅徽章，图案是地球与握手，" + STYLE),
    ("prize-snack", 400, "正方形图标插画：环球零食礼包，各国包装零食堆成小山，" + STYLE),
    ("prize-keychain", 400, "正方形图标插画：飞机与地球造型的金属钥匙扣，" + STYLE),
    ("prize-tote", 400, "正方形图标插画：米色帆布包，上面印着简约地球与航线图案，" + STYLE),
    ("prize-stationery", 400, "正方形图标插画：国际风文具套装，笔记本钢笔和各国旗帜贴纸，" + STYLE),
    ("prize-tdcard", 400, "正方形图标插画：一张渐变纪念卡片，卡片上有星星与闪电图案，紫色到橙色渐变，" + STYLE),
]

SEM = asyncio.Semaphore(3)


async def gen_one(client: httpx.AsyncClient, name: str, maxw: int, prompt: str) -> str:
    webp = OUT / f"{name}.webp"
    if webp.exists() and "--force" not in sys.argv:
        return f"skip {name}"
    resp = await client.post(
        API,
        headers=HEADERS,
        json={
            "model": MODEL,
            "prompt": prompt,
            "size": "2K",
            "output_format": "png",
            "response_format": "url",
            "watermark": False,
        },
    )
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
