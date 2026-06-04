"""Small YAML subset used by the GitHub bundle validation scripts.

This fallback keeps the offline release gate runnable in environments where
PyYAML is not installed. It intentionally supports only the YAML shapes used by
the bundle fixtures: mappings, sequences, scalars, anchors, aliases and block
strings.
"""

from __future__ import annotations

import copy
import json
import re


class YAMLError(Exception):
    pass


def _strip_comment(line):
    quote = None
    for index, character in enumerate(line):
        if quote:
            if character == quote:
                quote = None
            continue
        if character in {"'", '"'}:
            quote = character
            continue
        if character == "#":
            if index == 0 or line[index - 1].isspace():
                return line[:index]
    return line


def _normalise_lines(text):
    lines = []
    for raw in text.splitlines():
        line = _strip_comment(raw).rstrip()
        if not line.strip():
            continue
        if line.lstrip().startswith("---") or line.lstrip().startswith("..."):
            continue
        lines.append(line)
    return lines


def _split_key_value(text):
    quote = None
    for index, character in enumerate(text):
        if quote:
            if character == quote:
                quote = None
            continue
        if character in {"'", '"'}:
            quote = character
            continue
        if character == ":" and (index + 1 == len(text) or text[index + 1].isspace()):
            return text[:index].strip(), text[index + 1 :].strip()
    return None, None


def _parse_scalar(value, anchors):
    if value == "":
        return ""
    anchor_match = re.match(r"^&([A-Za-z0-9_-]+)\s+(.*)$", value)
    anchor_name = None
    if anchor_match:
        anchor_name = anchor_match.group(1)
        value = anchor_match.group(2).strip()
    if value.startswith("*"):
        parsed = copy.deepcopy(anchors.get(value[1:]))
    elif value in {"null", "Null", "NULL", "~"}:
        parsed = None
    elif value in {"true", "True", "TRUE"}:
        parsed = True
    elif value in {"false", "False", "FALSE"}:
        parsed = False
    elif (value.startswith('"') and value.endswith('"')) or (
        value.startswith("'") and value.endswith("'")
    ):
        parsed = value[1:-1]
    elif value.startswith("[") or value.startswith("{"):
        try:
            parsed = json.loads(value.replace("'", '"'))
        except Exception:
            parsed = value
    else:
        try:
            parsed = int(value)
        except ValueError:
            try:
                parsed = float(value)
            except ValueError:
                parsed = value
    if anchor_name:
        anchors[anchor_name] = copy.deepcopy(parsed)
    return parsed


def _anchor_name(value):
    match = re.match(r"^&([A-Za-z0-9_-]+)\s*$", value)
    return match.group(1) if match else None


def _parse_block(lines, index, indent):
    collected = []
    while index < len(lines):
        line = lines[index]
        current_indent = len(line) - len(line.lstrip(" "))
        if current_indent < indent:
            break
        collected.append(line[indent:])
        index += 1
    return "\n".join(collected), index


def _parse_node(lines, index, indent, anchors):
    if index >= len(lines):
        return {}, index

    first = lines[index]
    first_indent = len(first) - len(first.lstrip(" "))
    is_sequence = first_indent == indent and first.lstrip().startswith("-")
    container = [] if is_sequence else {}

    while index < len(lines):
        line = lines[index]
        current_indent = len(line) - len(line.lstrip(" "))
        if current_indent < indent:
            break
        if current_indent > indent:
            raise YAMLError(f"Unexpected indentation: {line}")

        text = line.strip()
        if isinstance(container, list):
            if not text.startswith("-"):
                break
            item = text[1:].strip()
            index += 1
            if not item:
                child, index = _parse_node(lines, index, current_indent + 2, anchors)
                container.append(child)
                continue
            key, value = _split_key_value(item)
            if key is not None:
                mapping = {}
                if value in {"|", ">"}:
                    mapping[key], index = _parse_block(lines, index, current_indent + 2)
                elif value and not _anchor_name(value):
                    mapping[key] = _parse_scalar(value, anchors)
                else:
                    anchor_name = _anchor_name(value)
                    child_indent = current_indent + 2
                    if index < len(lines):
                        next_line = lines[index]
                        next_indent = len(next_line) - len(next_line.lstrip(" "))
                        if next_indent >= current_indent and next_line.lstrip().startswith("- "):
                            child_indent = next_indent
                    child, index = _parse_node(lines, index, child_indent, anchors)
                    if anchor_name:
                        anchors[anchor_name] = copy.deepcopy(child)
                    mapping[key] = child
                while index < len(lines):
                    next_line = lines[index]
                    next_indent = len(next_line) - len(next_line.lstrip(" "))
                    if next_indent <= current_indent:
                        break
                    next_text = next_line.strip()
                    next_key, next_value = _split_key_value(next_text)
                    if next_key is None:
                        break
                    index += 1
                    if next_value in {"|", ">"}:
                        mapping[next_key], index = _parse_block(lines, index, next_indent + 2)
                    elif next_value and not _anchor_name(next_value):
                        mapping[next_key] = _parse_scalar(next_value, anchors)
                    else:
                        anchor_name = _anchor_name(next_value)
                        child_indent = next_indent + 2
                        if index < len(lines):
                            child_line = lines[index]
                            child_line_indent = len(child_line) - len(child_line.lstrip(" "))
                            if child_line_indent >= next_indent and child_line.lstrip().startswith("- "):
                                child_indent = child_line_indent
                        child, index = _parse_node(lines, index, child_indent, anchors)
                        if anchor_name:
                            anchors[anchor_name] = copy.deepcopy(child)
                        mapping[next_key] = child
                container.append(mapping)
            else:
                container.append(_parse_scalar(item, anchors))
            continue

        key, value = _split_key_value(text)
        if key is None:
            raise YAMLError(f"Expected mapping entry: {line}")
        index += 1
        if value in {"|", ">"}:
            container[key], index = _parse_block(lines, index, current_indent + 2)
        elif value and not _anchor_name(value):
            container[key] = _parse_scalar(value, anchors)
        else:
            anchor_name = _anchor_name(value)
            child_indent = current_indent + 2
            if index < len(lines):
                next_line = lines[index]
                next_indent = len(next_line) - len(next_line.lstrip(" "))
                if next_indent >= current_indent and next_line.lstrip().startswith("- "):
                    child_indent = next_indent
            child, index = _parse_node(lines, index, child_indent, anchors)
            if anchor_name:
                anchors[anchor_name] = copy.deepcopy(child)
            container[key] = child

    return container, index


def safe_load(text):
    if not text:
        return None
    stripped = text.strip()
    if not stripped:
        return None
    if stripped.startswith("{") or stripped.startswith("["):
        return json.loads(stripped)
    lines = _normalise_lines(text)
    if not lines:
        return None
    data, _ = _parse_node(lines, 0, len(lines[0]) - len(lines[0].lstrip(" ")), {})
    return data


def _dump_scalar(value):
    if value is None:
        return "null"
    if value is True:
        return "true"
    if value is False:
        return "false"
    if isinstance(value, (int, float)):
        return str(value)
    text = str(value)
    if not text or text.startswith(("-", "{", "[", "*", "&")) or ": " in text or "\n" in text:
        return json.dumps(text)
    return text


def _dump(value, indent):
    lines = []
    prefix = " " * indent
    if isinstance(value, dict):
        for key, item in value.items():
            if isinstance(item, (dict, list)):
                lines.append(f"{prefix}{key}:")
                lines.extend(_dump(item, indent + 2))
            else:
                lines.append(f"{prefix}{key}: {_dump_scalar(item)}")
    elif isinstance(value, list):
        for item in value:
            if isinstance(item, dict):
                lines.append(f"{prefix}- {next(iter(item))}: {_dump_scalar(item[next(iter(item))])}" if len(item) == 1 and not isinstance(next(iter(item.values())), (dict, list)) else f"{prefix}-")
                if not (len(item) == 1 and not isinstance(next(iter(item.values())), (dict, list))):
                    lines.extend(_dump(item, indent + 2))
            elif isinstance(item, list):
                lines.append(f"{prefix}-")
                lines.extend(_dump(item, indent + 2))
            else:
                lines.append(f"{prefix}- {_dump_scalar(item)}")
    else:
        lines.append(f"{prefix}{_dump_scalar(value)}")
    return lines


def safe_dump(data, sort_keys=False, allow_unicode=True):
    if sort_keys and isinstance(data, dict):
        data = dict(sorted(data.items()))
    return "\n".join(_dump(data, 0)) + "\n"
