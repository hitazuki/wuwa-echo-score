"""Import public scoring templates from an existing XutheringWavesUID resource tree.

Usage: python scripts/import_templates.py <ssh-host> <remote-character-directory>
Only calc.json files are requested. No account data or plugin configuration is read.
"""

import io
import json
import subprocess
import sys
import tarfile
from datetime import datetime, timezone
from pathlib import Path


def main() -> None:
    if len(sys.argv) != 3:
        raise SystemExit(__doc__)
    host, remote_dir = sys.argv[1:]
    if not remote_dir.startswith("/") or "'" in remote_dir:
        raise SystemExit("Remote directory must be an absolute path without quotes")
    command = f"cd '{remote_dir}' && find . -name calc.json -type f -print0 | tar --null -T - -cf -"
    archive = subprocess.run(
        ["ssh", "-o", "BatchMode=yes", "-o", "StrictHostKeyChecking=yes", host, command],
        check=True,
        stdout=subprocess.PIPE,
    ).stdout
    templates = []
    with tarfile.open(fileobj=io.BytesIO(archive), mode="r:") as bundle:
        for member in bundle:
            if not member.isfile() or not member.name.endswith("/calc.json"):
                continue
            character_id = Path(member.name).parent.name
            if character_id == "default" or not character_id.isdigit():
                continue
            source = bundle.extractfile(member)
            assert source is not None
            data = json.load(source)
            template_name = data.get("name", character_id)
            templates.append({
                "id": character_id,
                "character": template_name.split("-")[0],
                "template": data,
            })
    templates.sort(key=lambda item: (item["character"], item["id"]))
    # The four Rover elements have separate IDs for the two protagonists, but
    # their scoring templates are identical. Keep the first ID for the picker.
    unique = []
    seen = set()
    for item in templates:
        signature = (item["character"], json.dumps(item["template"], ensure_ascii=False, sort_keys=True))
        if signature not in seen:
            unique.append(item)
            seen.add(signature)
    templates = unique
    if len(templates) < 50:
        raise SystemExit(f"Only {len(templates)} templates found; refusing partial import")
    output = {
        "source": "XutheringWavesUID character calc.json resources",
        "exportedAt": datetime.now(timezone.utc).isoformat(),
        "templates": templates,
    }
    destination = Path(__file__).resolve().parents[1] / "src" / "data" / "templates.json"
    destination.parent.mkdir(parents=True, exist_ok=True)
    destination.write_text(json.dumps(output, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(f"Imported {len(templates)} templates to {destination}")


if __name__ == "__main__":
    main()
