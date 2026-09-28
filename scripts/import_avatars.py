"""Download the small character portraits used by the offline character picker.

Usage: python scripts/import_avatars.py
Source revision is pinned so the mapping and images remain reproducible.
"""

import json
from pathlib import Path
from urllib.request import urlopen

REVISION = "d77801ecfb8c3abc950c1ffbc6ddec94f5129889"
SOURCE = f"https://raw.githubusercontent.com/ryanbenson/wuthering-waves-assets/{REVISION}/images"
IMAGES = {
    "丹瑾": "Danjin", "丽贝卡": "Rebecca", "仇远": "Qiuyuan", "今汐": "Jinhsi",
    "光主": "RoverSpectroFemale", "凌阳": "Lingyang", "千咲": "Chisa", "卜灵": "Buling",
    "卡卡罗": "Calcharo", "卡提希娅": "Cartethyia", "吟霖": "Yinlin", "嘉贝莉娜": "Galbrena",
    "坎特蕾拉": "Cantarella", "夏空": "Ciaccona", "奥古斯塔": "Augusta", "守岸人": "Shorekeeper",
    "安可": "Encore", "尤诺": "Iuno", "布兰特": "Brant", "弗洛洛": "Phrolova",
    "忌炎": "Jiyan", "折枝": "Zhezhi", "散华": "Sanhua", "景燃": "Jingran",
    "暗主": "RoverHavocFemale", "桃祈": "Taoqi", "椿": "Camellya", "洛可可": "Roccia",
    "洛瑟菈": "Lucilla", "清宵": "Qingxiao", "渊武": "Yuanwu", "灯灯": "Lumi",
    "炽霞": "Chixia", "爱弥斯": "Aemeath", "珂莱塔": "Carlotta", "琳奈": "Lynae",
    "白芷": "Baizhi", "相里要": "XiangliYao", "秋水": "Aalto", "秧秧": "Yangyang",
    "秧秧·玄翎": "YangyangXuanling", "穗穗": "Suisui", "绯雪": "Hiyuki", "维里奈": "Verina",
    "莫宁": "Mornye", "莫特斐": "Mortefi", "菲比": "Phoebe", "西格莉卡": "Sigrika",
    "赞妮": "Zani", "达妮娅": "Denia", "釉瑚": "Youhu", "鉴心": "Jianxin",
    "长离": "Changli", "陆·赫斯": "LuukHerssen", "雷主": "Roverelectrofemale",
    "露帕": "Lupa", "露西": "Lucy", "风主": "RoverAeroFemale",
}


def main() -> None:
    root = Path(__file__).resolve().parents[1]
    templates = json.loads((root / "src/data/templates.json").read_text(encoding="utf-8"))["templates"]
    names = {item["character"] for item in templates}
    if names != IMAGES.keys():
        raise SystemExit(f"Avatar mapping mismatch: missing={names - IMAGES.keys()}, extra={IMAGES.keys() - names}")
    destination = root / "public/avatars"
    destination.mkdir(parents=True, exist_ok=True)
    for item in templates:
        target = destination / f"{item['id']}.png"
        if target.exists():
            continue
        url = f"{SOURCE}/{IMAGES[item['character']]}.png"
        with urlopen(url, timeout=30) as response:
            contents = response.read()
        if not contents.startswith(b"\x89PNG\r\n\x1a\n"):
            raise ValueError(f"Unexpected image response: {url}")
        target.write_bytes(contents)
        print(f"Saved {target.name}: {len(contents)} bytes")


if __name__ == "__main__":
    main()
