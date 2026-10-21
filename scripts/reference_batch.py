"""Run reference/engine_reference.py over a batch of hangs for the differential test.

Reads JSON from stdin: {"spec_path": "...", "cases": [{"hang": {...}, "contingency": 0.05}]}
Writes JSON to stdout: one full-precision result per case.
"""
import json
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "reference"))
from engine_reference import calculate  # noqa: E402


def main():
    # Item names contain non-ASCII characters (e.g. "mm²"), so never rely on the console encoding.
    req = json.loads(sys.stdin.buffer.read().decode("utf-8"))
    with open(req["spec_path"], encoding="utf-8") as f:
        spec = {i["name"]: i for i in json.load(f)["items"]}
    out = []
    for case in req["cases"]:
        res = calculate(case["hang"], case["contingency"], spec)
        out.append(dict(
            subtotals=res["subtotals"],
            total_static=res["total_static"],
            design_load_point=res["design_load_point"],
            data_ok=res["data_ok"],
            flags=res["flags"],
            checks=[dict(zone=c["zone"], item=c["item"], carried_static=c["carried_static"],
                         used=c["used"]) for c in res["checks"]],
            governing=None if res["governing"] is None else dict(
                zone=res["governing"]["zone"], item=res["governing"]["item"],
                used=res["governing"]["used"], ties=res["governing"]["ties"]),
            point_status=res["point_status"],
            point_used=res["point_used"],
        ))
    sys.stdout.buffer.write(json.dumps(out, ensure_ascii=True).encode("ascii"))


if __name__ == "__main__":
    main()
