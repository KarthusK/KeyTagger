from pydantic import BaseModel
from typing import Optional, Dict


class KeyMapping(BaseModel):
    """单个按键映射"""
    key_name: str
    label: str
    function: str = ""


class KeymapData(BaseModel):
    """完整键位映射数据"""
    mappings: Dict[str, KeyMapping]


class UpdateKeyRequest(BaseModel):
    """更新单个按键的请求"""
    key_name: str
    function: str


class OCRResult(BaseModel):
    """OCR 识别结果"""
    text: str
    x: float
    y: float
    w: float
    h: float