import os
import json
import uuid
from fastapi import APIRouter, UploadFile, File, HTTPException
from fastapi.responses import FileResponse
from backend.models import UpdateKeyRequest
from backend.keyboard_service import keyboard_service
from backend.ocr_service import ocr_service
from backend.config import UPLOAD_DIR, MAX_UPLOAD_SIZE

router = APIRouter(prefix="/api")


@router.post("/upload")
async def upload_image(file: UploadFile = File(...)):
    """上传截图，进行 OCR 识别并映射到键盘按键"""
    # 验证文件类型
    allowed_types = {"image/png", "image/jpeg", "image/jpg", "image/webp", "image/bmp"}
    if file.content_type not in allowed_types:
        raise HTTPException(400, f"不支持的文件类型: {file.content_type}，请上传 PNG/JPG/WebP/BMP 图片")

    # 读取文件内容
    content = await file.read()
    if len(content) > MAX_UPLOAD_SIZE:
        raise HTTPException(400, f"文件过大，最大支持 {MAX_UPLOAD_SIZE // 1024 // 1024}MB")

    # 保存文件
    filename = f"{uuid.uuid4().hex}_{file.filename}"
    filepath = os.path.join(UPLOAD_DIR, filename)
    with open(filepath, "wb") as f:
        f.write(content)

    try:
        # OCR 识别
        results = ocr_service.recognize(filepath)
        # 映射到按键
        mapped = ocr_service.map_to_keys(results)
        # 更新键位状态
        keyboard_service.update_batch(mapped)
        # 返回完整键位映射
        return {"success": True, "keymap": _serialize_keymap()}
    except Exception as e:
        raise HTTPException(500, f"OCR 识别失败: {str(e)}")
    finally:
        # 清理上传文件
        if os.path.exists(filepath):
            os.remove(filepath)


@router.get("/keymap")
async def get_keymap():
    """获取当前所有按键映射"""
    return {"success": True, "keymap": _serialize_keymap()}


@router.put("/keymap")
async def update_key(req: UpdateKeyRequest):
    """更新单个按键的功能名称"""
    result = keyboard_service.update(req.key_name, req.function)
    if result is None:
        raise HTTPException(404, f"按键 {req.key_name} 不存在")
    return {"success": True, "keymap": _serialize_keymap()}


@router.post("/export")
async def export_keymap():
    """导出键位映射为 JSON 文件"""
    data = keyboard_service.to_export_dict()
    export_path = os.path.join(UPLOAD_DIR, "keymap_export.json")
    with open(export_path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    return FileResponse(
        export_path,
        media_type="application/json",
        filename="keymap.json",
        headers={"Content-Disposition": "attachment; filename=keymap.json"}
    )


@router.post("/reset")
async def reset_keymap():
    """重置所有按键映射"""
    keyboard_service.reset()
    return {"success": True, "keymap": _serialize_keymap()}


def _serialize_keymap() -> dict:
    """将键位映射序列化为可 JSON 序列化的字典"""
    mappings = keyboard_service.get_all()
    return {
        key: {
            "key_name": m.key_name,
            "label": m.label,
            "function": m.function
        }
        for key, m in mappings.items()
    }