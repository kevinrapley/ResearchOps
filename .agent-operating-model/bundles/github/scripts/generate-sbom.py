#!/usr/bin/env python3
from pathlib import Path
import argparse
import json
import re
import uuid
import xml.etree.ElementTree as ET

def normalise_version(version):
    return str(version or "").strip().lstrip("^~>=< ")

def bom_ref(ecosystem, name, version=""):
    safe = re.sub(r"[^A-Za-z0-9_.:/@-]+", "-", f"{ecosystem}:{name}:{version}")
    return f"pkg:{safe}"

def component(ecosystem, name, version="", license_id="", ctype="library", scope=None):
    version = normalise_version(version)
    ref = bom_ref(ecosystem, name, version)
    data = {"type": ctype, "name": name, "bom-ref": ref, "purl": f"pkg:{ecosystem}/{name}" + (f"@{version}" if version else "")}
    if version:
        data["version"] = version
    if scope:
        data["scope"] = scope
    if license_id:
        data["licenses"] = [{"license": {"id": license_id}}]
    return data

def add_dep(dependencies, parent, child):
    dependencies.setdefault(parent, set()).add(child)

def parse_requirements(path):
    comps, deps = [], {}
    root_ref = f"manifest:{path.name}"
    for line in path.read_text(encoding="utf-8", errors="ignore").splitlines():
        line=line.strip()
        if not line or line.startswith("#") or line.startswith("-"): 
            continue
        m=re.match(r"([A-Za-z0-9_.-]+)(?:==([A-Za-z0-9_.!+-]+))?", line)
        if m:
            c=component("pypi", m.group(1), m.group(2) or "")
            comps.append(c); add_dep(deps, root_ref, c["bom-ref"])
    return comps, deps

def parse_package_json(path):
    data=json.loads(path.read_text(encoding="utf-8"))
    comps, deps = [], {}
    root_name = data.get("name") or path.parent.name
    root_version = data.get("version", "")
    root_ref = f"root:npm:{root_name}:{root_version}"
    licence = data.get("license", "")
    for section, scope in [("dependencies", "required"), ("devDependencies", "optional"), ("peerDependencies", "optional"), ("optionalDependencies", "optional")]:
        for name, version in (data.get(section) or {}).items():
            c=component("npm", name, version, scope=scope)
            comps.append(c); add_dep(deps, root_ref, c["bom-ref"])
    root_component = {"type": "application", "name": root_name, "version": root_version, "bom-ref": root_ref}
    if licence:
        root_component["licenses"] = [{"license": {"id": licence}}]
    return [root_component] + comps, deps

def parse_package_lock(path):
    data=json.loads(path.read_text(encoding="utf-8"))
    comps, deps = [], {}
    packages=data.get("packages") or {}
    for key, value in packages.items():
        if key == "":
            continue
        name=value.get("name") or key.split("node_modules/")[-1]
        version=value.get("version","")
        licence=value.get("license","")
        if name:
            c=component("npm", name, version, licence)
            comps.append(c)
            parent = "manifest:package-lock.json"
            add_dep(deps, parent, c["bom-ref"])
            for dep_name in (value.get("dependencies") or {}).keys():
                child_ref = next((x["bom-ref"] for x in comps if x["name"] == dep_name), None)
                if child_ref:
                    add_dep(deps, c["bom-ref"], child_ref)
    return comps, deps

def parse_simple_lock(path, ecosystem):
    comps, deps = [], {}
    root_ref = f"manifest:{path.name}"
    for line in path.read_text(encoding="utf-8", errors="ignore").splitlines():
        line=line.strip()
        if not line or line.startswith("#"): continue
        m=re.match(r"([@A-Za-z0-9_./-]+)[:@ ]+([0-9][A-Za-z0-9_.!+-]*)", line)
        if m:
            c=component(ecosystem, m.group(1), m.group(2))
            comps.append(c); add_dep(deps, root_ref, c["bom-ref"])
    return comps, deps

def parse_go_mod(path):
    comps, deps = [], {}
    root_ref="manifest:go.mod"
    for line in path.read_text(encoding="utf-8", errors="ignore").splitlines():
        li=line.strip()
        if not li or li.startswith(("module","go ")) or li in {"require (",")"}: continue
        parts=li.split()
        if len(parts)>=2:
            c=component("golang", parts[0], parts[1])
            comps.append(c); add_dep(deps, root_ref, c["bom-ref"])
    return comps, deps

def parse_cargo_lock(path):
    comps, deps = [], {}
    current={}
    for line in path.read_text(encoding="utf-8", errors="ignore").splitlines():
        if line.startswith("[[package]]"):
            if current.get("name"):
                c=component("cargo", current["name"], current.get("version",""))
                comps.append(c); add_dep(deps, "manifest:Cargo.lock", c["bom-ref"])
            current={}
        elif line.startswith("name = "): current["name"]=line.split("=",1)[1].strip().strip('"')
        elif line.startswith("version = "): current["version"]=line.split("=",1)[1].strip().strip('"')
    if current.get("name"):
        c=component("cargo", current["name"], current.get("version",""))
        comps.append(c); add_dep(deps, "manifest:Cargo.lock", c["bom-ref"])
    return comps, deps

def parse_composer_lock(path):
    data=json.loads(path.read_text(encoding="utf-8"))
    comps, deps = [], {}
    for pkg in data.get("packages", []) + data.get("packages-dev", []):
        c=component("composer", pkg.get("name",""), pkg.get("version",""), (pkg.get("license") or [""])[0])
        if c["name"]:
            comps.append(c); add_dep(deps, "manifest:composer.lock", c["bom-ref"])
            for dep_name in (pkg.get("require") or {}).keys():
                if "/" in dep_name:
                    add_dep(deps, c["bom-ref"], bom_ref("composer", dep_name, ""))
    return comps, deps

def parse_gemfile_lock(path):
    comps, deps = [], {}
    in_specs=False
    for line in path.read_text(encoding="utf-8", errors="ignore").splitlines():
        if line.strip()=="specs:": in_specs=True; continue
        if in_specs:
            m=re.match(r"\s{4}([A-Za-z0-9_.-]+) \(([^)]+)\)", line)
            if m:
                c=component("gem", m.group(1), m.group(2))
                comps.append(c); add_dep(deps, "manifest:Gemfile.lock", c["bom-ref"])
            elif line and not line.startswith(" "):
                in_specs=False
    return comps, deps

def parse_pom(path):
    comps, deps = [], {}
    try:
        root=ET.parse(path).getroot()
        ns={"m":"http://maven.apache.org/POM/4.0.0"}
        deps_xml=root.findall(".//m:dependency", ns) or root.findall(".//dependency")
        for dep in deps_xml:
            def text(tag):
                el=dep.find(f"m:{tag}", ns) or dep.find(tag)
                return el.text.strip() if el is not None and el.text else ""
            gid, aid, ver = text("groupId"), text("artifactId"), text("version")
            if gid and aid:
                c=component("maven", f"{gid}:{aid}", ver)
                comps.append(c); add_dep(deps, "manifest:pom.xml", c["bom-ref"])
    except Exception:
        pass
    return comps, deps

def parse_csproj(path):
    comps, deps = [], {}
    try:
        root=ET.parse(path).getroot()
        for el in root.iter():
            if el.tag.endswith("PackageReference"):
                name=el.attrib.get("Include") or el.attrib.get("Update")
                ver=el.attrib.get("Version","")
                if name:
                    c=component("nuget", name, ver)
                    comps.append(c); add_dep(deps, f"manifest:{path.name}", c["bom-ref"])
    except Exception:
        pass
    return comps, deps

def merge_dependency_graph(graphs):
    merged = {}
    for graph in graphs:
        for parent, children in graph.items():
            merged.setdefault(parent, set()).update(children)
    return [{"ref": parent, "dependsOn": sorted(children)} for parent, children in sorted(merged.items())]

def main():
    parser=argparse.ArgumentParser()
    parser.add_argument("--root", default=".")
    parser.add_argument("--output", required=True)
    args=parser.parse_args()
    root=Path(args.root)
    components=[]; graphs=[]
    parsers=[
        ("package.json", parse_package_json), ("package-lock.json", parse_package_lock),
        ("pnpm-lock.yaml", lambda p: parse_simple_lock(p, "npm")),
        ("yarn.lock", lambda p: parse_simple_lock(p, "npm")),
        ("bun.lock", lambda p: parse_simple_lock(p, "npm")),
        ("requirements.txt", parse_requirements), ("requirements-dev.txt", parse_requirements),
        ("poetry.lock", lambda p: parse_simple_lock(p, "pypi")),
        ("uv.lock", lambda p: parse_simple_lock(p, "pypi")),
        ("go.mod", parse_go_mod), ("Cargo.lock", parse_cargo_lock),
        ("composer.lock", parse_composer_lock), ("Gemfile.lock", parse_gemfile_lock),
        ("pom.xml", parse_pom), ("build.gradle", lambda p: parse_simple_lock(p, "maven")),
    ]
    for filename, parser_fn in parsers:
        p=root/filename
        if p.exists():
            comps, deps = parser_fn(p)
            components.extend(comps); graphs.append(deps)
    for p in root.rglob("*.csproj"):
        comps, deps = parse_csproj(p)
        components.extend(comps); graphs.append(deps)
    unique={}
    for c in components:
        unique[c["bom-ref"]]=c
    bom={
        "bomFormat":"CycloneDX",
        "specVersion":"1.5",
        "serialNumber":f"urn:uuid:{uuid.uuid4()}",
        "version":1,
        "metadata":{"tools":[{"vendor":"github-diamond-standard","name":"generate-sbom.py","version":"2.9.1"}]},
        "components":list(unique.values()),
        "dependencies":merge_dependency_graph(graphs),
    }
    out=Path(args.output); out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(bom, indent=2), encoding="utf-8")
    print(f"Wrote {out} with {len(unique)} components and {len(bom['dependencies'])} dependency graph entries")

if __name__=="__main__":
    main()
