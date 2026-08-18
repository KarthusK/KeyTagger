import os
os.environ["FLAGS_use_mkldnn"] = "0"
from typing import List, Dict, Tuple
from backend.config import QWERTY_LAYOUT, UPLOAD_DIR
from backend.models import OCRResult


class OCRService:
    """
    OCR 识别与坐标映射服务。
    使用 PaddleOCR 识别图片中的文字及坐标，然后根据坐标智能映射到标准 QWERTY 键盘按键。
    """

    def __init__(self, confidence_threshold: float = 0.6):
        self._ocr = None
        self._ensure_upload_dir()
        self.confidence_threshold = confidence_threshold

    def _ensure_upload_dir(self):
        os.makedirs(UPLOAD_DIR, exist_ok=True)

    def _get_ocr(self):
        """延迟初始化 PaddleOCR"""
        if self._ocr is None:
            try:
                from paddleocr import PaddleOCR
                self._ocr = PaddleOCR(use_angle_cls=False, lang="ch", show_log=False)
            except ImportError:
                raise ImportError("请先安装 PaddleOCR: pip install paddleocr")
        return self._ocr

    def _preprocess(self, image_path: str) -> str:
        """预处理入口：当前直接返回原图路径，不做额外处理"""
        return image_path

    def recognize(self, image_path: str) -> List[OCRResult]:
        """
        对图片进行 OCR 识别，返回识别结果列表。
        每个结果包含识别文本、置信度和边界框坐标 (x, y, w, h)。
        低于置信度阈值的结果会被过滤。
        """
        processed = self._preprocess(image_path)
        ocr = self._get_ocr()
        results = ocr.ocr(processed, cls=False)

        ocr_results = []
        if results and results[0]:
            for line in results[0]:
                bbox = line[0]  # [[x1,y1], [x2,y1], [x2,y2], [x1,y2]]
                text = line[1][0]  # 识别文本
                confidence = line[1][1]  # 置信度

                if confidence < self.confidence_threshold:
                    continue

                # 计算边界框的中心坐标及宽高
                xs = [p[0] for p in bbox]
                ys = [p[1] for p in bbox]
                x = min(xs)
                y = min(ys)
                w = max(xs) - x
                h = max(ys) - y

                ocr_results.append(OCRResult(text=text, confidence=confidence, x=x, y=y, w=w, h=h))

        return ocr_results

    def map_to_keys(self, ocr_results: List[OCRResult]) -> Dict[str, str]:
        """
        将 OCR 识别结果映射到 QWERTY 键盘按键。

        策略：游戏键位截图通常是两列布局——左侧功能名、右侧按键标签。
        按 y 分组为行，行内按 x 排序，识别出按键标签后，将同行其余文本合并为功能名。
        """
        if not ocr_results:
            return {}

        # 构建 label → key_name 反向映射（含大小写变体及 L/R 前缀）
        label_to_key: Dict[str, str] = {}
        for key_name, info in QWERTY_LAYOUT.items():
            label = info["label"]
            for variant in {label, label.lower(), label.upper()}:
                label_to_key.setdefault(variant, key_name)
            # 左右键注册 L/R 前缀变体（如 LSHIFT→ShiftLeft, LALT→AltLeft）
            if "Left" in key_name:
                for prefix in ("L", "LEFT"):
                    for variant in {prefix + label, (prefix + label).lower(), (prefix + label).upper()}:
                        label_to_key.setdefault(variant, key_name)
            elif "Right" in key_name:
                for prefix in ("R", "RIGHT"):
                    for variant in {prefix + label, (prefix + label).lower(), (prefix + label).upper()}:
                        label_to_key.setdefault(variant, key_name)

        def match_key(text: str) -> str | None:
            """如果文本匹配某个按键标签，返回 key_name，否则返回 None"""
            return label_to_key.get(text.strip())

        # 按 y 排序
        sorted_results = sorted(ocr_results, key=lambda r: r.y)

        # 估算行间距阈值
        if len(sorted_results) >= 3:
            gaps = [sorted_results[i + 1].y - sorted_results[i].y for i in range(len(sorted_results) - 1)]
            row_gaps = [g for g in gaps if g > 5]
            threshold = sorted(row_gaps)[len(row_gaps) // 2] * 0.5 if row_gaps else 20
        else:
            threshold = 20

        # 按 y 分组为行
        rows: List[List[OCRResult]] = []
        current_row = [sorted_results[0]]
        current_y = sorted_results[0].y
        for r in sorted_results[1:]:
            if abs(r.y - current_y) > threshold:
                rows.append(current_row)
                current_row = [r]
                current_y = r.y
            else:
                current_row.append(r)
        if current_row:
            rows.append(current_row)

        # 每行内识别按键标签，合并功能文本
        mapped = {}
        for row in rows:
            row.sort(key=lambda r: r.x)

            label_items = []
            func_items = []
            for r in row:
                k = match_key(r.text)
                if k:
                    label_items.append((r, k))
                else:
                    func_items.append(r)

            if not label_items:
                continue

            # 取行内第一个匹配的按键标签
            _, key_name = label_items[0]
            # 合并该行所有功能文本
            func_text = "".join(r.text.strip() for r in func_items)
            mapped[key_name] = func_text if func_text else label_items[0][0].text

        return mapped


# 全局单例
ocr_service = OCRService()