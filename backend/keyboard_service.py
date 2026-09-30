from typing import Dict, Optional
from backend.config import QWERTY_LAYOUT
from backend.models import KeyMapping


class KeyboardService:
    """键位状态管理，维护当前所有按键的映射关系"""

    def __init__(self):
        self._mappings: Dict[str, KeyMapping] = {}
        self._init_defaults()

    def _init_defaults(self):
        """初始化所有按键，使用布局中的默认标签"""
        for key_name, info in QWERTY_LAYOUT.items():
            self._mappings[key_name] = KeyMapping(
                key_name=key_name,
                label=info["label"],
                function=""
            )

    def get_all(self) -> Dict[str, KeyMapping]:
        """获取所有按键映射"""
        return dict(self._mappings)

    def get(self, key_name: str) -> Optional[KeyMapping]:
        """获取单个按键映射"""
        return self._mappings.get(key_name)

    def update(self, key_name: str, function: str) -> Optional[KeyMapping]:
        """更新单个按键的功能名称"""
        if key_name not in self._mappings:
            return None
        self._mappings[key_name].function = function
        return self._mappings[key_name]

    def update_batch(self, mappings: Dict[str, str]):
        """批量更新按键功能（用于 OCR 识别后的映射）"""
        for key_name, function in mappings.items():
            if key_name in self._mappings:
                self._mappings[key_name].function = function

    def move(self, from_key: str, to_key: str) -> Optional[Dict[str, KeyMapping]]:
        """把 from_key 的绑定移动/覆盖到 to_key，from_key 清空"""
        src = self._mappings.get(from_key)
        dst = self._mappings.get(to_key)
        if src is None or dst is None or from_key == to_key or not src.function:
            return None
        dst.function = src.function
        src.function = ""
        return self.get_all()

    def reset(self):
        """重置所有按键功能"""
        for key_name in self._mappings:
            self._mappings[key_name].function = ""

    def import_dict(self, data: Dict) -> int:
        """从导出的 JSON 字典覆盖式导入：仅写入 JSON 中出现的有效按键，其余保持不变，返回实际导入的按键数

        兼容两种值形态：
        - 字符串：导出的简洁格式 {"KeyW": "前进"}
        - 对象：完整序列化格式 {"KeyW": {"key_name": ..., "label": ..., "function": ...}}
        未知的 key_name 直接跳过；值为空字符串（或对象 function 为空）表示解绑该键。
        """
        count = 0
        for key_name, value in data.items():
            if key_name not in self._mappings:
                continue
            if isinstance(value, str):
                function = value
            elif isinstance(value, dict):
                function = value.get("function", "")
            else:
                continue
            self._mappings[key_name].function = function
            if function:
                count += 1
        return count

    def to_export_dict(self) -> Dict[str, str]:
        """导出为简洁的键值对字典"""
        result = {}
        for key_name, mapping in self._mappings.items():
            if mapping.function:
                result[key_name] = mapping.function
        return result


# 全局单例
keyboard_service = KeyboardService()