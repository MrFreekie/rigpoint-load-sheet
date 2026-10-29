"""Reference implementation of the load-path calculation.

This is the behaviour of The_Ballroom_Array_Weights_v6.xlsx expressed as plain
Python. It exists so the TypeScript engine has an unambiguous spec to match.
It is NOT part of the app. Run it with:

    python3 reference/engine_reference.py fixtures/scenarios.json fixtures/spec-library.workbook.json

(from the repository root; use `python` on Windows).

It prints the results for every scenario and checks them against the
"expected" block in scenarios.json.
"""
import json
import sys

ZONES = ["top_rigging", "hoist", "hook", "path1", "path2"]


def line(item_row, spec):
    """Return (unit_kg, line_kg, total_kg, swl, flag) for one item row."""
    name = item_row.get("item")
    if not name:
        return None, None, None, None, None
    s = spec.get(name)
    if s is None:
        return None, None, None, None, "NOT FOUND"
    swl = s["swl_kg"]
    if s["kg"] is None:
        return None, None, None, swl, "TBC"
    if s["per"] == "m":
        length = item_row.get("length_m") or 0
        if length == 0:
            return s["kg"], None, None, swl, "LEN?"
        line_kg = s["kg"] * length
    else:
        line_kg = s["kg"]
    return s["kg"], line_kg, line_kg * (item_row.get("qty") or 0), swl, None


def light(used):
    """Traffic light for a utilisation: Calc!K10:K40 conditional formatting."""
    if used > 1:
        return "over"
    if used >= 0.85:
        return "check"
    if used > 0:
        return "ok"
    return None


def calculate(hang, contingency, spec):
    rows = {z: [] for z in ZONES}
    for z in ZONES:
        for it in hang["zones"].get(z, []):
            unit, ln, tot, swl, flag = line(it, spec)
            rows[z].append(dict(item=it.get("item"), note=it.get("note"),
                                total=tot, swl=swl, flag=flag))
    sub = {z: sum(r["total"] or 0 for r in rows[z]) for z in ZONES}
    below_hook = sub["path1"] + sub["path2"]
    body_up = hang["hoist_orientation"] == "body_up"

    checks = []
    for z in ZONES:
        for i, r in enumerate(rows[z]):
            if r["swl"] is None:
                continue
            below_in_zone = sum(x["total"] or 0 for x in rows[z][i + 1:])
            if z == "top_rigging":
                carried = below_in_zone + sub["hoist"] + sub["hook"] + below_hook
            elif z == "hoist":
                carried = (0 if body_up else sub["hoist"]) + sub["hook"] + below_hook
            elif z == "hook":
                carried = below_in_zone + below_hook
            else:
                carried = below_in_zone
            design = carried * (1 + contingency)
            checks.append(dict(zone=z, item=r["item"], swl=r["swl"],
                               carried_static=carried, carried_design=design,
                               used=design / r["swl"], light=light(design / r["swl"])))

    total = sum(sub.values())
    design_point = total * (1 + contingency)
    flags = [r["flag"] for z in ZONES for r in rows[z] if r["flag"]]

    def governing(cs):
        if not cs:
            return None
        top = max(c["used"] for c in cs)
        first = next(c for c in cs if c["used"] == top)
        ties = sum(1 for c in cs if abs(c["used"] - top) < 1e-12) - 1
        return dict(first, ties=ties)

    zone_gov = {z: governing([c for c in checks if c["zone"] == z]) for z in ZONES}
    pc = hang.get("point_capacity") or {}
    cap = pc.get("kg")
    if not cap:
        point_status = "for_approval"
        point_used = None
    else:
        point_used = design_point / cap
        if not pc.get("source"):
            point_status = "no_source"
        elif point_used > 1:
            point_status = "exceeded"
        else:
            point_status = "recorded"

    return dict(subtotals=sub, total_static=total, contingency_kg=total * contingency,
                design_load_point=design_point, data_ok=not flags, flags=flags,
                checks=checks, zone_governing=zone_gov, governing=governing(checks),
                point_used=point_used, point_status=point_status)


def main(scen_path, spec_path):
    # Item names contain non-ASCII characters (e.g. "mm²"); never rely on the locale encoding.
    with open(spec_path, encoding="utf-8") as f:
        spec = {i["name"]: i for i in json.load(f)["items"]}
    with open(scen_path, encoding="utf-8") as f:
        scen = json.load(f)
    failures = 0
    for s in scen["scenarios"]:
        sp = {k: dict(v) for k, v in spec.items()}
        for name, fields in s.get("spec_override", {}).items():
            sp[name].update(fields)
        res = calculate(s["hang"], s["contingency"], sp)
        exp = s["expected"]
        got = dict(total_static=round(res["total_static"], 3),
                   design_load_point=round(res["design_load_point"], 3),
                   data_ok=res["data_ok"],
                   governing_item=res["governing"]["item"],
                   governing_used=round(res["governing"]["used"], 4),
                   governing_ties=res["governing"]["ties"],
                   zone_used={z: (round(g["used"], 4) if g else None)
                              for z, g in res["zone_governing"].items()},
                   zone_item={z: (g["item"] if g else None)
                              for z, g in res["zone_governing"].items()},
                   point_status=res["point_status"],
                   point_used=None if res["point_used"] is None else round(res["point_used"], 4))
        ok = got == exp
        failures += not ok
        print(f'{"PASS" if ok else "FAIL"}  {s["id"]}  {s["title"]}')
        if not ok:
            for k in exp:
                if exp[k] != got.get(k):
                    print(f'      {k}: expected {exp[k]!r}, got {got.get(k)!r}')
    sys.exit(1 if failures else 0)


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
