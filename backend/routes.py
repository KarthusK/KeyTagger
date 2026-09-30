import os
import json
import uuid
from fastapi import APIRouter, UploadFile, File, HTTPException
from fastapi.responses import FileResponse
from backend.models import UpdateKeyRequest, MoveKeyRequest
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
        # 返回完整键位映射；mapped_count 为本次截图识别出的键位数（非全局总数）
        return {"success": True, "keymap": _serialize_keymap(), "mapped_count": len(mapped)}
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


@router.post("/keymap/move")
async def move_key(req: MoveKeyRequest):
    """把 source 键的绑定移动/覆盖到 target 键，source 键清空"""
    result = keyboard_service.move(req.source, req.target)
    if result is None:
        raise HTTPException(400, "移动失败：按键不存在、源等于目标或源键未绑定")
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


@router.post("/import")
async def import_keymap(file: UploadFile = File(...)):
    """导入导出的 JSON 键位文件：覆盖式导入，仅更新 JSON 中出现的按键，已有键位保留"""
    filename = (file.filename or "").lower()
    if not filename.endswith(".json") and "json" not in (file.content_type or "").lower():
        raise HTTPException(400, "请上传 JSON 键位文件（.json）")

    content = await file.read()
    if len(content) > MAX_UPLOAD_SIZE:
        raise HTTPException(400, f"文件过大，最大支持 {MAX_UPLOAD_SIZE // 1024 // 1024}MB")

    try:
        data = json.loads(content.decode("utf-8-sig"))
    except (UnicodeDecodeError, json.JSONDecodeError) as e:
        raise HTTPException(400, f"JSON 解析失败：{str(e)}，请使用本工具“导出 JSON”生成的文件")

    if not isinstance(data, dict):
        raise HTTPException(400, "JSON 内容必须是键值对对象，形如 {\"KeyW\": \"前进\"}")

    applied = {k for k in data if k in keyboard_service.get_all()}
    if data and not applied:
        raise HTTPException(400, "JSON 中未找到有效的按键名，请使用本工具“导出 JSON”生成的文件")

    count = keyboard_service.import_dict(data)
    return {"success": True, "keymap": _serialize_keymap(), "imported_count": count}


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