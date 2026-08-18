#!/usr/bin/env python3
"""
OCR 识别与键位映射测试脚本。

自动扫描 test_data/ 目录下的 *.png 图片，运行 OCR 识别和映射，
将结果与同名 *.json 文件中的预期映射对比，输出测试报告。

用法:
    python test_ocr_mapping.py
    python test_ocr_mapping.py -v        # 详细输出
    python test_ocr_mapping.py --image test_data/xxx.png  # 只测单张

测试图片对应的 JSON 格式（OCR 文本 → 期望的按键标签）:
    {
        "绝招技能": "Z",
        "互动/捡起": "E",
        "其他交互": "F3",
        "物品栏（切换）": "TAB",
        "地图（切换）": "M",
        "切换开火模式": "X"
    }
"""

from __future__ import annotations

import argparse
import json
import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
TEST_DATA = ROOT / "test_data"


def setup_env():
    os.environ.setdefault("FLAGS_use_mkldnn", "0")
    sys.path.insert(0, str(ROOT))


def discover_tests() -> list[tuple[Path, Path]]:
    pairs = []
    for png in sorted(TEST_DATA.glob("*.png")):
        json_file = png.with_suffix(".json")
        if json_file.exists():
            pairs.append((png, json_file))
        else:
            print(f"  [WARN] {png.name} 缺少对应的 JSON 文件，跳过")
    return pairs


def load_expected(json_path: Path) -> dict[str, str]:
    with open(json_path, encoding="utf-8") as f:
        return json.load(f)


def build_label_to_keyname() -> dict[str, str]:
    from backend.config import QWERTY_LAYOUT
    mapping = {}
    for key_name, info in QWERTY_LAYOUT.items():
        label = info["label"].lower()
        if label not in mapping:
            mapping[label] = key_name
        # 左右键注册 L/R 前缀变体
        if "Left" in key_name:
            for prefix in ("l", "left"):
                mapping[prefix + label] = key_name
        elif "Right" in key_name:
            for prefix in ("r", "right"):
                mapping[prefix + label] = key_name
    return mapping


def run_test(image_path: Path, verbose: bool = False) -> tuple[list, dict]:
    from backend.ocr_service import ocr_service

    ocr_results = ocr_service.recognize(str(image_path))
    mapped = ocr_service.map_to_keys(ocr_results)

    if verbose:
        print(f"    OCR 识别到 {len(ocr_results)} 个文本:")
        for r in ocr_results:
            print(f"      [{r.text}] at ({r.x:.0f}, {r.y:.0f})")
        print(f"    映射到 {len(mapped)} 个按键:")
        for k, v in mapped.items():
            print(f"      {k} -> {v}")

    return ocr_results, mapped


def compare(
    ocr_results: list, mapped: dict[str, str], expected: dict[str, str]
) -> tuple[bool, list[str], list[str]]:
    label_to_keyname = build_label_to_keyname()

    # mapped 格式: {key_name: ocr_text} → 反转成 {ocr_text: key_name}
    ocr_text_to_keyname = {v: k for k, v in mapped.items()}

    matched = []
    mismatched = []

    for ocr_text, expected_label in expected.items():
        actual_key = ocr_text_to_keyname.get(ocr_text)
        expected_key = label_to_keyname.get(expected_label.lower(), "")

        if actual_key is not None and actual_key == expected_key:
            matched.append(ocr_text)
        else:
            mismatched.append((ocr_text, expected_label, actual_key))

    

    return len(mismatched) == 0, matched, mismatched


def print_result(name: str, ok: bool, matched: list, mismatched: list, elapsed: float):
    status = "PASS" if ok else "FAIL"
    color = "\033[92m" if ok else "\033[91m"
    total = len(matched) + len(mismatched)
    print(f"  [{color}{status}\033[0m] {name}  ({len(matched)}/{total} 正确, {elapsed:.1f}s)")
    for ocr_text, expected_label, actual_key in mismatched:
        print(f"        OCR=[{ocr_text}] 期望按键={expected_label!r}, 实际映射到={actual_key!r}")


def main():
    parser = argparse.ArgumentParser(description="OCR 识别与键位映射测试")
    parser.add_argument("--image", "-i", help="只测试指定图片路径")
    parser.add_argument("-v", "--verbose", action="store_true", help="详细输出")
    args = parser.parse_args()

    setup_env()
    from paddleocr import PaddleOCR
    PaddleOCR(use_angle_cls=False, lang="ch", show_log=False)

    if args.image:
        image_path = Path(args.image)
        if not image_path.exists():
            print(f"文件不存在: {image_path}")
            sys.exit(1)
        json_path = image_path.with_suffix(".json")
        if not json_path.exists():
            print(f"缺少对应的 JSON 文件: {json_path}")
            sys.exit(1)
        pairs = [(image_path, json_path)]
    else:
        pairs = discover_tests()
        if not pairs:
            print(f"在 {TEST_DATA} 中未找到匹配的测试用例（.png + .json）")
            sys.exit(0)

    import time

    passed = 0
    failed = 0

    for png_path, json_path in pairs:
        expected = load_expected(json_path)
        t0 = time.time()
        ocr_results, mapped = run_test(png_path, args.verbose)
        elapsed = time.time() - t0
        ok, matched, mismatched = compare(ocr_results, mapped, expected)
        print_result(png_path.stem, ok, matched, mismatched, elapsed)
        if ok:
            passed += 1
        else:
            failed += 1

    total = passed + failed
    print(f"\n  总计: {total}  |  PASS: {passed}  |  FAIL: {failed}")


if __name__ == "__main__":
    main()