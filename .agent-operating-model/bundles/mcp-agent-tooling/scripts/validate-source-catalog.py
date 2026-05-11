#!/usr/bin/env python3
"""Validate MCP bundle source catalogue discipline."""

from pathlib import Path
import re
import sys

ROOT = Path(__file__).resolve().parents[1]
CATALOGUE = ROOT / "references" / "source-catalog.yaml"
ALLOWED_PREFIX = "https://modelcontextprotocol.io/"
URL_PATTERN = re.compile(r"https://[^\s\"'<>]+")


def fail(message: str) -> None:
    print(f"mcp:source-catalog: {message}", file=sys.stderr)
    raise SystemExit(1)


def extract_urls(text: str) -> list[str]:
    return URL_PATTERN.findall(text)


def main() -> None:
    if not CATALOGUE.exists():
        fail("missing references/source-catalog.yaml")

    text = CATALOGUE.read_text(encoding="utf-8")
    urls = extract_urls(text)

    if not urls:
        fail("no URLs found in source catalogue")

    for url in urls:
        if not url.startswith(ALLOWED_PREFIX):
            fail(f"non-MCP-docs URL found: {url}")

    for xml_path in (ROOT / "references").glob("*.xml"):
        xml_text = xml_path.read_text(encoding="utf-8")
        for url in extract_urls(xml_text):
            if not url.startswith(ALLOWED_PREFIX):
                fail(f"non-MCP-docs URL found in {xml_path.name}: {url}")
            if url not in text:
                fail(f"reference URL missing from source catalogue: {url}")

    print(f"mcp:source-catalog: validated {len(urls)} source URLs")


if __name__ == "__main__":
    main()
