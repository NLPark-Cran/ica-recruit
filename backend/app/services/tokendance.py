"""TokenDance 网关客户端：OpenAI 兼容对话（SSE 流式）+ ark 图像生成。

- 每次调用带 X-App-URL 归因（TokenPay 合作要素）。
- 错误透传 TokenDance-Recovery-Action，供前端引导充值/重新授权。
"""

import json
from collections.abc import AsyncGenerator

import httpx

from app.config import get_settings

settings = get_settings()

UA = {"User-Agent": "ica-platform/0.1"}


class TokenDanceError(Exception):
    def __init__(self, message: str, recovery_action: str | None = None, status: int = 502):
        super().__init__(message)
        self.message = message
        self.recovery_action = recovery_action
        self.status = status


def _headers(api_key: str) -> dict[str, str]:
    return {
        "Authorization": f"Bearer {api_key}",
        "X-App-URL": settings.tokendance_app_url,
        **UA,
    }


def _raise_for(resp: httpx.Response) -> None:
    if resp.status_code < 400:
        return
    recovery = resp.headers.get("TokenDance-Recovery-Action")
    try:
        detail = resp.json()
        msg = detail.get("error", {}).get("message") or detail.get("message") or resp.text[:200]
    except Exception:
        msg = resp.text[:200]
    raise TokenDanceError(msg, recovery_action=recovery, status=resp.status_code)


async def chat_stream(api_key: str, messages: list[dict], model: str | None = None) -> AsyncGenerator[str]:
    """SSE 流式对话，逐段产出文本 delta。"""
    url = f"{settings.tokendance_base_url}/v1/chat/completions"
    payload = {
        "model": model or settings.ai_chat_model,
        "messages": messages,
        "stream": True,
    }
    async with (
        httpx.AsyncClient(timeout=httpx.Timeout(120, connect=10)) as client,
        client.stream("POST", url, headers=_headers(api_key), json=payload) as resp,
    ):
        _raise_for(resp)
        async for line in resp.aiter_lines():
            if not line.startswith("data:"):
                continue
            data = line[5:].strip()
            if data == "[DONE]":
                break
            try:
                chunk = json.loads(data)
            except json.JSONDecodeError:
                continue
            for choice in chunk.get("choices", []):
                delta = choice.get("delta", {}).get("content")
                if delta:
                    yield delta


async def chat_once(api_key: str, messages: list[dict], model: str | None = None) -> str:
    url = f"{settings.tokendance_base_url}/v1/chat/completions"
    payload = {"model": model or settings.ai_chat_model, "messages": messages, "stream": False}
    async with httpx.AsyncClient(timeout=httpx.Timeout(120, connect=10)) as client:
        resp = await client.post(url, headers=_headers(api_key), json=payload)
    _raise_for(resp)
    data = resp.json()
    return data["choices"][0]["message"]["content"]


async def generate_image(api_key: str, prompt: str, size: str = "2K") -> str:
    """ark:image-generations，返回图片 URL。"""
    url = f"{settings.tokendance_base_url}/ark/v3/images/generations"
    payload = {
        "model": settings.ai_image_model,
        "prompt": prompt,
        "size": size,
        "output_format": "png",
        "response_format": "url",
        "watermark": False,
    }
    async with httpx.AsyncClient(timeout=httpx.Timeout(180, connect=10)) as client:
        resp = await client.post(url, headers=_headers(api_key), json=payload)
    _raise_for(resp)
    data = resp.json()
    return data["data"][0]["url"]
