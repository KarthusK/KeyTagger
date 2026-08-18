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

    def __init__(self):
        self._ocr = None
        self._ensure_upload_dir()

    def _ensure_upload_dir(self):
        os.makedirs(UPLOAD_DIR, exist_ok=True)

    def _get_ocr(self):
        """延迟初始化 PaddleOCR"""
        if self._ocr is None:
            try:
                from paddleocr import PaddleOCR
                # 使用轻量级模型，首次运行会自动下载
                self._ocr = PaddleOCR(use_angle_cls=False, lang="ch", show_log=False)
            except ImportError:
                raise ImportError("请先安装 PaddleOCR: pip install paddleocr")
        return self._ocr

    def recognize(self, image_path: str) -> List[OCRResult]:
        """
        对图片进行 OCR 识别，返回识别结果列表。
        每个结果包含识别文本和其边界框坐标 (x, y, w, h)。
        """
        ocr = self._get_ocr()
        results = ocr.ocr(image_path, cls=False)

        ocr_results = []
        if results and results[0]:
            for line in results[0]:
                bbox = line[0]  # [[x1,y1], [x2,y1], [x2,y2], [x1,y2]]
                text = line[1][0]  # 识别文本

                # 计算边界框的中心坐标及宽高
                xs = [p[0] for p in bbox]
                ys = [p[1] for p in bbox]
                x = min(xs)
                y = min(ys)
                w = max(xs) - x
                h = max(ys) - y

                ocr_results.append(OCRResult(text=text, x=x, y=y, w=w, h=h))

        return ocr_results

    def map_to_keys(self, ocr_results: List[OCRResult]) -> Dict[str, str]:
        """
        将 OCR 识别结果按坐标映射到 QWERTY 键盘按键。
        策略：按 y 坐标分组为行，每行内按 x 排序，依次映射到对应行的按键。
        """
        if not ocr_results:
            return {}

        # 按 y 坐标排序（从上到下）
        sorted_results = sorted(ocr_results, key=lambda r: r.y)

        # 将按键布局按行分组
        rows: Dict[int, List[Tuple[str, str]]] = {}
        for key_name, info in QWERTY_LAYOUT.items():
            row = info["row"]
            if row not in rows:
                rows[row] = []
            rows[row].append((key_name, info["label"]))

        # 估算行高（取所有识别结果 y 坐标的差异）
        if len(sorted_results) >= 2:
            y_coords = [r.y for r in sorted_results]
            avg_gap = (y_coords[-1] - y_coords[0]) / max(len(set(y_coords)) - 1, 1)
        else:
            avg_gap = 50  # 默认行高

        # 将 OCR 结果按行分组
        ocr_rows: List[List[OCRResult]] = []
        current_row = []
        current_y = sorted_results[0].y if sorted_results else 0

        for r in sorted_results:
            if abs(r.y - current_y) > avg_gap * 0.6:
                if current_row:
                    ocr_rows.append(current_row)
                current_row = [r]
                current_y = r.y
            else:
                current_row.append(r)
        if current_row:
            ocr_rows.append(current_row)

        # 对每行按 x 排序，然后映射到对应 QWERTY 行的按键
        mapped = {}
        for i, row_results in enumerate(ocr_rows):
            if i >= len(rows):
                break
            row_results.sort(key=lambda r: r.x)
            row_keys = rows.get(i, [])

            for j, r in enumerate(row_results):
                if j < len(row_keys):
                    key_name = row_keys[j][0]
                    mapped[key_name] = r.text

        return mapped


# 全局单例
ocr_service = OCRService()