#!/usr/bin/env python3
from pathlib import Path
import argparse
import base64
import hashlib
import json

def sha256(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--attestation", required=True)
    parser.add_argument("--sbom", required=True)
    parser.add_argument("--min-subject-files", type=int, default=1)
    parser.add_argument("--require-dsse", action="store_true")
    parser.add_argument("--require-slsa", action="store_true")
    parser.add_argument("--require-github-artifact-attestation", action="store_true")
    parser.add_argument("--require-sigstore", action="store_true")
    parser.add_argument("--trusted-mode", action="store_true")
    args = parser.parse_args()

    data = json.loads(Path(args.attestation).read_text(encoding="utf-8"))
    errors = []
    if data.get("type") != "github-diamond-sbom-attestation":
        errors.append("attestation type is invalid")
    if data.get("sbom_sha256") != sha256(args.sbom):
        errors.append("attestation sbom_sha256 does not match SBOM file")
    if int(data.get("subject_file_count", 0)) < args.min_subject_files:
        errors.append("attestation subject_file_count below minimum")
    if not data.get("subject_hashes"):
        errors.append("attestation subject_hashes is required")

    mode = data.get("attestation_mode", "offline-test")
    if args.trusted_mode and mode != "trusted":
        errors.append("trusted-mode validation requires attestation_mode: trusted")

    if args.require_dsse:
        dsse = data.get("dsse") or {}
        if not dsse.get("payloadType") or not dsse.get("payload") or not dsse.get("signatures"):
            errors.append("DSSE envelope with payload and signatures is required")
        else:
            try:
                json.loads(base64.b64decode(dsse["payload"]).decode("utf-8"))
            except Exception as exc:
                errors.append(f"DSSE payload is not valid base64 JSON: {exc}")
        if args.trusted_mode and dsse.get("signature_algorithm") == "HMAC-SHA256-offline-test":
            errors.append("offline-test DSSE signature is not valid trusted attestation")

    if args.require_slsa and not (data.get("slsa") or {}).get("enabled"):
        errors.append("SLSA provenance block is required")

    gh = data.get("github_artifact_attestation") or {}
    if args.require_github_artifact_attestation:
        if not gh.get("enabled"):
            errors.append("GitHub artifact attestation block is required")
        if args.trusted_mode and gh.get("status") != "verified":
            errors.append("GitHub artifact attestation must be verified in trusted mode")

    sigstore = data.get("sigstore") or {}
    if args.require_sigstore:
        if not sigstore.get("enabled"):
            errors.append("Sigstore block is required")
        if args.trusted_mode and sigstore.get("status") != "verified":
            errors.append("Sigstore bundle must be verified in trusted mode")

    if errors:
        for error in errors:
            print(error)
        raise SystemExit(1)
    print("SBOM attestation validation passed.")

if __name__ == "__main__":
    main()
