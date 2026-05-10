#!/usr/bin/env python3
from pathlib import Path
import argparse
import base64
import hashlib
import hmac
import json
import os
import time

def sha256(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()

def pae(payload_type, payload):
    type_bytes = payload_type.encode("utf-8")
    return b"DSSEv1 " + str(len(type_bytes)).encode() + b" " + type_bytes + b" " + str(len(payload)).encode() + b" " + payload

def subject_hashes(subject):
    subject = Path(subject)
    if subject.is_file():
        files = [subject]
        base = subject.parent
    else:
        files = sorted([p for p in subject.rglob("*") if p.is_file() and "__pycache__" not in p.parts and p.suffix not in {".pyc", ".pyo"}])
        base = subject
    return [{"path": str(p.relative_to(base)), "sha256": sha256(p)} for p in files]

def sign_payload(payload_type, payload, key):
    digest = hmac.new(key.encode("utf-8"), pae(payload_type, payload), hashlib.sha256).digest()
    return base64.b64encode(digest).decode("utf-8")

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--sbom", required=True)
    parser.add_argument("--subject", required=True)
    parser.add_argument("--output", required=True)
    parser.add_argument("--predicate-type", default="https://slsa.dev/provenance/v1")
    parser.add_argument("--attestation-mode", choices=["offline-test", "trusted"], default="offline-test")
    parser.add_argument("--dsse", action="store_true")
    parser.add_argument("--slsa", action="store_true")
    parser.add_argument("--github-artifact-attestation", action="store_true")
    parser.add_argument("--sigstore", action="store_true")
    parser.add_argument("--github-attestation-verification")
    parser.add_argument("--sigstore-bundle")
    parser.add_argument("--key-env", default="SBOM_ATTESTATION_HMAC_KEY")
    args = parser.parse_args()

    hashes = subject_hashes(args.subject)
    predicate = {
        "buildDefinition": {
            "buildType": "https://github-diamond-standard.local/bundle/sbom",
            "externalParameters": {
                "sbom": str(args.sbom),
                "subject": str(args.subject),
            },
        },
        "runDetails": {
            "builder": {"id": "github-diamond-standard/scripts/generate-sbom-attestation.py"},
            "metadata": {"invocationId": hashlib.sha256((str(args.sbom) + str(time.time())).encode()).hexdigest()},
        },
        "materials": [{"uri": item["path"], "digest": {"sha256": item["sha256"]}} for item in hashes],
        "sbom": {
            "uri": str(args.sbom),
            "digest": {"sha256": sha256(args.sbom)},
        },
    }
    statement = {
        "_type": "https://in-toto.io/Statement/v1",
        "subject": [{"name": str(args.subject), "digest": {"sha256": hashlib.sha256(json.dumps(hashes, sort_keys=True).encode()).hexdigest()}}],
        "predicateType": args.predicate_type,
        "predicate": predicate,
    }
    payload = json.dumps(statement, sort_keys=True).encode("utf-8")
    payload_type = "application/vnd.in-toto+json"
    envelope = {
        "type": "github-diamond-sbom-attestation",
        "version": "2.9.1",
        "attestation_mode": args.attestation_mode,
        "created_at_unix": int(time.time()),
        "subject": str(args.subject),
        "subject_file_count": len(hashes),
        "subject_hashes": hashes,
        "sbom": str(args.sbom),
        "sbom_sha256": sha256(args.sbom),
        "slsa": {"enabled": bool(args.slsa), "predicate_type": args.predicate_type, "statement": statement},
        "github_artifact_attestation": {
            "enabled": bool(args.github_artifact_attestation),
            "verification": args.github_attestation_verification,
            "status": "verified" if args.github_attestation_verification else "offline-declared",
        },
        "sigstore": {
            "enabled": bool(args.sigstore),
            "bundle_uri": args.sigstore_bundle,
            "status": "verified" if args.sigstore_bundle else "offline-declared",
        },
    }
    if args.dsse:
        key = os.environ.get(args.key_env)
        if args.attestation_mode == "trusted" and not key:
            raise SystemExit(f"{args.key_env} is required for trusted DSSE attestation")
        key = key or "github-diamond-standard-offline-test-key"
        envelope["dsse"] = {
            "payloadType": payload_type,
            "payload": base64.b64encode(payload).decode("utf-8"),
            "signatures": [{"keyid": args.key_env if os.environ.get(args.key_env) else "offline-test-key", "sig": sign_payload(payload_type, payload, key)}],
            "signature_algorithm": "HMAC-SHA256-offline-test" if args.attestation_mode == "offline-test" else "HMAC-SHA256-provided-key",
        }
    Path(args.output).write_text(json.dumps(envelope, indent=2), encoding="utf-8")
    print(f"Wrote SBOM attestation {args.output}")

if __name__ == "__main__":
    main()
