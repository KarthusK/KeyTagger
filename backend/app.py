"""FastAPI 应用定义：健康检查、API 路由挂载、前端静态资源托管（含 Windows MIME 修复）"""

import os

from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from starlette.responses import FileResponse
from starlette.types import Scope
from backend.routes import router
from backend.config import FRONTEND_DIST

app = FastAPI(title="KeyTagger")


@app.get("/api/health")
async def health_check():
    return {"status": "ok", "message": "KeyTagger 服务运行中"}


# 注册 API 路由
app.include_router(router)


MIME_OVERRIDES = {
    ".js": "application/javascript",
    ".mjs": "text/javascript",
    ".css": "text/css",
    ".svg": "image/svg+xml",
    ".json": "application/json",
    ".wasm": "application/wasm",
}


class MimeFixedStaticFiles(StaticFiles):
    def file_response(
        self,
        full_path: os.PathLike,
        stat_result: os.stat_result,
        scope: Scope,
        status_code: int = 200,
    ) -> FileResponse:
        response = super().file_response(full_path, stat_result, scope, status_code)
        _, ext = os.path.splitext(str(full_path))
        override = MIME_OVERRIDES.get(ext.lower())
        if override:
            response.headers["Content-Type"] = override
        return response


# 挂载前端静态资源（需放在所有 API 路由之后，避免拦截）
if os.path.exists(FRONTEND_DIST):
    app.mount("/", MimeFixedStaticFiles(directory=FRONTEND_DIST, html=True), name="frontend")
