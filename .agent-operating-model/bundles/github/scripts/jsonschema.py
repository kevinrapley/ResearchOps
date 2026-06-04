"""Minimal Draft7Validator fallback for offline bundle tests.

The bundle validators also perform domain-specific checks. This module covers
the JSON Schema keywords used by those tests when the external jsonschema
package is unavailable.
"""

from __future__ import annotations


class ValidationError(Exception):
    def __init__(self, message, path=()):
        super().__init__(message)
        self.message = message
        self.path = tuple(path)


class Draft7Validator:
    def __init__(self, schema):
        self.schema = schema or {}

    @staticmethod
    def check_schema(schema):
        if not isinstance(schema, dict):
            raise ValidationError("schema must be an object")

    def iter_errors(self, instance):
        return list(_validate(instance, self.schema, ()))


def _type_matches(instance, expected):
    if isinstance(expected, list):
        return any(_type_matches(instance, item) for item in expected)
    return {
        "object": isinstance(instance, dict),
        "array": isinstance(instance, list),
        "string": isinstance(instance, str),
        "number": isinstance(instance, (int, float)) and not isinstance(instance, bool),
        "integer": isinstance(instance, int) and not isinstance(instance, bool),
        "boolean": isinstance(instance, bool),
        "null": instance is None,
    }.get(expected, True)


def _validate(instance, schema, path):
    if not isinstance(schema, dict):
        return
    if "type" in schema and not _type_matches(instance, schema["type"]):
        yield ValidationError(f"{instance!r} is not of type {schema['type']!r}", path)
        return
    if "enum" in schema and instance not in schema["enum"]:
        yield ValidationError(f"{instance!r} is not one of {schema['enum']!r}", path)
    if "const" in schema and instance != schema["const"]:
        yield ValidationError(f"{instance!r} does not equal {schema['const']!r}", path)
    if isinstance(instance, dict):
        required = schema.get("required") or []
        for key in required:
            if key not in instance:
                yield ValidationError(f"{key!r} is a required property", path)
        properties = schema.get("properties") or {}
        for key, child_schema in properties.items():
            if key in instance:
                yield from _validate(instance[key], child_schema, (*path, key))
        if schema.get("additionalProperties") is False:
            extra = set(instance) - set(properties)
            for key in sorted(extra):
                yield ValidationError(f"Additional properties are not allowed ({key!r} was unexpected)", (*path, key))
    if isinstance(instance, list):
        if "minItems" in schema and len(instance) < schema["minItems"]:
            yield ValidationError(f"{instance!r} is too short", path)
        item_schema = schema.get("items")
        if isinstance(item_schema, dict):
            for index, item in enumerate(instance):
                yield from _validate(item, item_schema, (*path, index))
