"""Run reference/engine_reference.py over a batch of hangs for the differential test.

Reads JSON from stdin: {"spec_path": "...", "cases": [{"hang": {...}, "contingency": 0.05}]}
Writes JSON to stdout: one full-precision result per case.
"""
import json
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "reference"))
from engine_reference import ZONES, calculate, light, line  # noqa: E402


def row_values(hang, spec, checks):
    """Per-row values: line() for each row, plus its check (checks are in zone, then row order)."""
    pending = iter(checks)
    out = {}
    for z in ZONES:
        out[z] = []
        for it in hang["zones"].get(z, []):
            unit, ln, tot, swl, flag = line(it, spec)
            c = next(pending) if swl is not None else None
            out[z].append(dict(
                unit_kg=unit, line_kg=ln, total_kg=tot, swl_kg=swl, flag=flag, rated=c is not None,
                carried_static=None if c is None else c["carried_static"],
                carried_design=None if c is None else c["carried_design"],
                used=None if c is None else c["used"],
                light=None if c is None else c["light"]))
    return out


def gov(g):
    return None if g is None else dict(zone=g["zone"], item=g["item"], used=g["used"], ties=g["ties"])


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
            contingency_kg=res["contingency_kg"],
            design_load_point=res["design_load_point"],
            data_ok=res["data_ok"],
            flags=res["flags"],
            rows=row_values(case["hang"], spec, res["checks"]),
            checks=[dict(zone=c["zone"], item=c["item"], carried_static=c["carried_static"],
                         carried_design=c["carried_design"], used=c["used"], light=c["light"])
                    for c in res["checks"]],
            zone_governing={z: gov(g) for z, g in res["zone_governing"].items()},
            governing=gov(res["governing"]),
            point_status=res["point_status"],
            point_used=res["point_used"],
            point_light=None if res["point_used"] is None else light(res["point_used"]),
        ))
    sys.stdout.buffer.write(json.dumps(out, ensure_ascii=True).encode("ascii"))


if __name__ == "__main__":
    main()
