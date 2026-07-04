/**
 * @file ethics-submission-documents.js
 * @module ethics-submission-documents
 * @summary Generates and stores completed ethics submission DOCX files.
 */

import { d1Get, d1Run } from "./internals/researchops-d1.js";

const DOCUMENTS_TABLE = "rops_ethics_submission_documents";
const TEMPLATE_KEY = "templates/ethics/research-ethics-approval-form-v3.docx";
const CONTENT_TYPE = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

const DOCUMENTS_SQL = `
	CREATE TABLE IF NOT EXISTS ${DOCUMENTS_TABLE} (
		id TEXT PRIMARY KEY,
		study_id TEXT NOT NULL,
		project_id TEXT,
		submission_version INTEGER NOT NULL DEFAULT 1,
		submission_type TEXT,
		route TEXT,
		status TEXT,
		template_key TEXT NOT NULL,
		object_key TEXT NOT NULL,
		object_etag TEXT,
		content_type TEXT NOT NULL,
		byte_size INTEGER NOT NULL,
		sha256 TEXT NOT NULL,
		submission_json TEXT NOT NULL,
		risk_outcome_json TEXT NOT NULL DEFAULT '{}',
		sourcebook_clauses_json TEXT NOT NULL DEFAULT '[]',
		created_by TEXT,
		created_at TEXT NOT NULL
	)
`;

function nowIso() {
	return new Date().toISOString();
}

function randomHex(length = 12) {
	const fallback = Math.random().toString(16).replace("0.", "").padEnd(length, "0");
	if (typeof crypto === "undefined" || !crypto.getRandomValues) return fallback.slice(0, length);
	const bytes = new Uint8Array(Math.ceil(length / 2));
	crypto.getRandomValues(bytes);
	return Array.from(bytes, byte => byte.toString(16).padStart(2, "0")).join("").slice(0, length);
}

function documentId() {
	if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
		return `ethdoc_${crypto.randomUUID()}`;
	}
	return `ethdoc_${Date.now().toString(36)}_${randomHex(8)}`;
}

function safeSlug(value = "") {
	return String(value || "unknown").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 80) || "unknown";
}

function hasD1(svc) {
	return Boolean(svc?.env?.RESEARCHOPS_D1?.prepare);
}

function hasR2(svc) {
	return Boolean(svc?.env?.RESEARCHOPS_DOCUMENTS_R2?.put);
}

async function ensureDocumentsTable(svc) {
	if (!hasD1(svc)) throw Object.assign(new Error("RESEARCHOPS_D1 binding not available"), { status: 503 });
	await d1Run(svc.env, DOCUMENTS_SQL);
	await d1Run(svc.env, `CREATE INDEX IF NOT EXISTS idx_rops_ethics_submission_documents_study ON ${DOCUMENTS_TABLE} (study_id, submission_version, created_at)`);
	await d1Run(svc.env, `CREATE INDEX IF NOT EXISTS idx_rops_ethics_submission_documents_object ON ${DOCUMENTS_TABLE} (object_key)`);
}

async function readJsonBody(svc, request) {
	const body = await request.arrayBuffer();
	if (body.byteLength > svc.cfg.MAX_BODY_BYTES) {
		throw Object.assign(new Error("Payload too large"), { status: 413 });
	}
	try {
		return JSON.parse(new TextDecoder().decode(body || new ArrayBuffer(0)) || "{}");
	} catch {
		throw Object.assign(new Error("Invalid JSON"), { status: 400 });
	}
}

async function readTemplateFromAssets(svc) {
	if (!svc?.env?.ASSETS?.fetch) {
		throw Object.assign(new Error("Template asset binding not available"), { status: 503 });
	}
	const response = await svc.env.ASSETS.fetch(new Request(`https://researchops-assets.local/${TEMPLATE_KEY}`));
	if (!response.ok) {
		throw Object.assign(new Error("Ethics submission template not found"), { status: 500 });
	}
	return new Uint8Array(await response.arrayBuffer());
}

function xmlEscape(value = "") {
	return String(value ?? "")
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;");
}

function paragraph(text = "", style = "") {
	const styleXml = style ? `<w:pPr><w:pStyle w:val="${style}"/></w:pPr>` : "";
	return `<w:p>${styleXml}<w:r><w:t xml:space="preserve">${xmlEscape(text)}</w:t></w:r></w:p>`;
}

function labelledParagraph(label, value) {
	return `<w:p><w:r><w:rPr><w:b/></w:rPr><w:t xml:space="preserve">${xmlEscape(label)}: </w:t></w:r><w:r><w:t xml:space="preserve">${xmlEscape(value || "Not recorded")}</w:t></w:r></w:p>`;
}

function sectionParagraphs(title, items = []) {
	const out = [paragraph(title, "Heading2")];
	for (const item of items) {
		if (!item) continue;
		if (typeof item === "string") out.push(paragraph(item));
		else out.push(labelledParagraph(item.label, item.value));
	}
	return out;
}

function buildSubmissionXml(payload, createdAt) {
	const submission = payload.submission || {};
	const riskOutcome = payload.riskOutcome || {};
	const sections = Array.isArray(payload.sections) ? payload.sections : [];
	const triggers = Array.isArray(riskOutcome.triggers) ? riskOutcome.triggers : [];
	const sourcebookClauses = Array.isArray(riskOutcome.sourcebookClauses) ? riskOutcome.sourcebookClauses : [];
	const parts = [
		paragraph("ResearchOps completed submission", "Heading1"),
		paragraph("This section was generated from the saved ResearchOps project, study, ethics risk assessment and full ethics submission workflow."),
		...sectionParagraphs("Submission metadata", [
			{ label: "Project", value: payload.projectName || payload.projectId },
			{ label: "Study", value: payload.studyTitle || payload.studyId },
			{ label: "Submission type", value: submission.submissionType },
			{ label: "Submission version", value: submission.submissionVersion },
			{ label: "Route", value: submission.route },
			{ label: "Status", value: submission.status },
			{ label: "Owner", value: submission.owner },
			{ label: "Reviewer or approver", value: submission.reviewer },
			{ label: "Generated", value: createdAt }
		]),
		...sectionParagraphs("Recorded risk outcome", [
			{ label: "Risk route", value: riskOutcome.statusLabel || riskOutcome.route },
			{ label: "Summary", value: riskOutcome.summary },
			{ label: "Next action", value: riskOutcome.nextAction }
		])
	];

	if (triggers.length) {
		parts.push(paragraph("Sensitive research triggers", "Heading2"));
		for (const trigger of triggers) {
			parts.push(labelledParagraph(trigger.family || "Trigger", trigger.label || ""));
		}
	}

	if (sourcebookClauses.length) {
		parts.push(paragraph("Sourcebook clauses", "Heading2"));
		for (const clause of sourcebookClauses) {
			parts.push(labelledParagraph(clause.id || "Sourcebook", clause.title || ""));
		}
	}

	parts.push(paragraph("Full ethics submission sections", "Heading2"));
	for (const section of sections) {
		parts.push(paragraph(section.label || section.id || "Submission section", "Heading3"));
		if (Array.isArray(section.generated) && section.generated.length) {
			parts.push(labelledParagraph("Generated from ResearchOps", section.generated.join("; ")));
		}
		parts.push(labelledParagraph("Researcher response", section.value || "No additional information recorded."));
	}

	return parts.join("");
}

function insertSubmissionXml(documentXml, insertionXml) {
	const sectPrIndex = documentXml.lastIndexOf("<w:sectPr");
	if (sectPrIndex > -1) return `${documentXml.slice(0, sectPrIndex)}${insertionXml}${documentXml.slice(sectPrIndex)}`;
	const bodyCloseIndex = documentXml.lastIndexOf("</w:body>");
	if (bodyCloseIndex > -1) return `${documentXml.slice(0, bodyCloseIndex)}${insertionXml}${documentXml.slice(bodyCloseIndex)}`;
	throw new Error("DOCX document.xml body not found");
}

function findEndOfCentralDirectory(bytes) {
	for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 65557); i -= 1) {
		if (bytes[i] === 0x50 && bytes[i + 1] === 0x4b && bytes[i + 2] === 0x05 && bytes[i + 3] === 0x06) return i;
	}
	throw new Error("DOCX ZIP end of central directory not found");
}

function readUint16(view, offset) {
	return view.getUint16(offset, true);
}

function readUint32(view, offset) {
	return view.getUint32(offset, true);
}

function writeUint16(out, value) {
	out.push(value & 0xff, (value >>> 8) & 0xff);
}

function writeUint32(out, value) {
	out.push(value & 0xff, (value >>> 8) & 0xff, (value >>> 16) & 0xff, (value >>> 24) & 0xff);
}

function parseZipEntries(bytes) {
	const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
	const eocd = findEndOfCentralDirectory(bytes);
	const entries = readUint16(view, eocd + 10);
	let offset = readUint32(view, eocd + 16);
	const decoder = new TextDecoder();
	const parsed = [];
	for (let i = 0; i < entries; i += 1) {
		if (readUint32(view, offset) !== 0x02014b50) throw new Error("DOCX ZIP central directory is invalid");
		const flags = readUint16(view, offset + 8);
		const method = readUint16(view, offset + 10);
		const crc = readUint32(view, offset + 16);
		const compressedSize = readUint32(view, offset + 20);
		const uncompressedSize = readUint32(view, offset + 24);
		const filenameLength = readUint16(view, offset + 28);
		const extraLength = readUint16(view, offset + 30);
		const commentLength = readUint16(view, offset + 32);
		const localOffset = readUint32(view, offset + 42);
		const name = decoder.decode(bytes.slice(offset + 46, offset + 46 + filenameLength));
		if (readUint32(view, localOffset) !== 0x04034b50) throw new Error(`DOCX ZIP local header is invalid for ${name}`);
		const localNameLength = readUint16(view, localOffset + 26);
		const localExtraLength = readUint16(view, localOffset + 28);
		const dataOffset = localOffset + 30 + localNameLength + localExtraLength;
		parsed.push({
			name,
			flags,
			method,
			crc,
			compressedSize,
			uncompressedSize,
			data: bytes.slice(dataOffset, dataOffset + compressedSize)
		});
		offset += 46 + filenameLength + extraLength + commentLength;
	}
	return parsed;
}

async function inflateRaw(data) {
	if (typeof DecompressionStream === "undefined") throw new Error("Deflate decompression is not available in this runtime");
	const stream = new Blob([data]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
	return new Uint8Array(await new Response(stream).arrayBuffer());
}

async function entryText(entry) {
	if (entry.method === 0) return new TextDecoder().decode(entry.data);
	if (entry.method === 8) return new TextDecoder().decode(await inflateRaw(entry.data));
	throw new Error(`DOCX ZIP compression method ${entry.method} is not supported`);
}

let crcTable;
function crc32(bytes) {
	if (!crcTable) {
		crcTable = new Uint32Array(256);
		for (let n = 0; n < 256; n += 1) {
			let c = n;
			for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
			crcTable[n] = c >>> 0;
		}
	}
	let crc = 0xffffffff;
	for (const byte of bytes) crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
	return (crc ^ 0xffffffff) >>> 0;
}

function appendBytes(out, bytes) {
	for (const byte of bytes) out.push(byte);
}

function buildZip(entries) {
	const encoder = new TextEncoder();
	const out = [];
	const central = [];
	for (const entry of entries) {
		const filename = encoder.encode(entry.name);
		const localOffset = out.length;
		writeUint32(out, 0x04034b50);
		writeUint16(out, 20);
		writeUint16(out, 0);
		writeUint16(out, entry.method);
		writeUint16(out, 0);
		writeUint16(out, 0);
		writeUint32(out, entry.crc);
		writeUint32(out, entry.data.length);
		writeUint32(out, entry.uncompressedSize);
		writeUint16(out, filename.length);
		writeUint16(out, 0);
		appendBytes(out, filename);
		appendBytes(out, entry.data);

		writeUint32(central, 0x02014b50);
		writeUint16(central, 20);
		writeUint16(central, 20);
		writeUint16(central, 0);
		writeUint16(central, entry.method);
		writeUint16(central, 0);
		writeUint16(central, 0);
		writeUint32(central, entry.crc);
		writeUint32(central, entry.data.length);
		writeUint32(central, entry.uncompressedSize);
		writeUint16(central, filename.length);
		writeUint16(central, 0);
		writeUint16(central, 0);
		writeUint16(central, 0);
		writeUint16(central, 0);
		writeUint32(central, 0);
		writeUint32(central, localOffset);
		appendBytes(central, filename);
	}
	const centralOffset = out.length;
	appendBytes(out, central);
	writeUint32(out, 0x06054b50);
	writeUint16(out, 0);
	writeUint16(out, 0);
	writeUint16(out, entries.length);
	writeUint16(out, entries.length);
	writeUint32(out, central.length);
	writeUint32(out, centralOffset);
	writeUint16(out, 0);
	return new Uint8Array(out);
}

async function populatedDocx(templateBytes, payload, createdAt) {
	const entries = parseZipEntries(templateBytes);
	const documentEntry = entries.find(entry => entry.name === "word/document.xml");
	if (!documentEntry) throw new Error("word/document.xml not found in DOCX template");
	const documentXml = await entryText(documentEntry);
	const updatedXml = insertSubmissionXml(documentXml, buildSubmissionXml(payload, createdAt));
	const updatedBytes = new TextEncoder().encode(updatedXml);
	const nextEntries = entries.map(entry => {
		if (entry.name !== "word/document.xml") return entry;
		return {
			name: entry.name,
			flags: 0,
			method: 0,
			crc: crc32(updatedBytes),
			compressedSize: updatedBytes.length,
			uncompressedSize: updatedBytes.length,
			data: updatedBytes
		};
	});
	return buildZip(nextEntries);
}

async function sha256Hex(bytes) {
	const digest = await crypto.subtle.digest("SHA-256", bytes);
	return Array.from(new Uint8Array(digest)).map(byte => byte.toString(16).padStart(2, "0")).join("");
}

function rowToDocument(row) {
	if (!row) return null;
	return {
		id: row.id,
		studyId: row.study_id,
		projectId: row.project_id || "",
		submissionVersion: Number(row.submission_version) || 1,
		submissionType: row.submission_type || "",
		route: row.route || "",
		status: row.status || "",
		templateKey: row.template_key,
		objectKey: row.object_key,
		objectEtag: row.object_etag || "",
		contentType: row.content_type,
		byteSize: Number(row.byte_size) || 0,
		sha256: row.sha256,
		createdBy: row.created_by || "",
		createdAt: row.created_at
	};
}

export async function createEthicsSubmissionDocument(svc, request, origin, authContext = {}) {
	try {
		if (!hasR2(svc)) {
			return svc.json({ ok: false, error: "object_storage_unavailable", message: "Ethics submission document storage is not configured." }, 503, svc.corsHeaders(origin));
		}
		await ensureDocumentsTable(svc);
		const payload = await readJsonBody(svc, request);
		const studyId = String(payload.studyId || payload.submission?.studyId || "").trim();
		if (!studyId) {
			return svc.json({ ok: false, error: "study_id_required", message: "Study ID is required." }, 400, svc.corsHeaders(origin));
		}
		const createdAt = nowIso();
		const id = documentId();
		const version = Number(payload.submission?.submissionVersion || payload.submissionVersion || 1) || 1;
		const objectKey = `ethics-submissions/${safeSlug(studyId)}/v${version}/${id}.docx`;
		const templateBytes = await readTemplateFromAssets(svc);
		const docxBytes = await populatedDocx(templateBytes, payload, createdAt);
		const sha256 = await sha256Hex(docxBytes);
		const putResult = await svc.env.RESEARCHOPS_DOCUMENTS_R2.put(objectKey, docxBytes, {
			httpMetadata: { contentType: CONTENT_TYPE },
			customMetadata: {
				studyId,
				projectId: String(payload.projectId || ""),
				submissionVersion: String(version),
				templateKey: TEMPLATE_KEY,
				sha256
			}
		});
		const sourcebookClauses = payload.riskOutcome?.sourcebookClauses || [];
		await d1Run(svc.env, `
			INSERT INTO ${DOCUMENTS_TABLE} (
				id, study_id, project_id, submission_version, submission_type, route, status,
				template_key, object_key, object_etag, content_type, byte_size, sha256,
				submission_json, risk_outcome_json, sourcebook_clauses_json, created_by, created_at
			) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
		`, [
			id,
			studyId,
			String(payload.projectId || ""),
			version,
			String(payload.submission?.submissionType || payload.submissionType || ""),
			String(payload.submission?.route || payload.route || ""),
			String(payload.submission?.status || payload.status || ""),
			TEMPLATE_KEY,
			objectKey,
			putResult?.etag || "",
			CONTENT_TYPE,
			docxBytes.byteLength,
			sha256,
			JSON.stringify(payload.submission || payload),
			JSON.stringify(payload.riskOutcome || {}),
			JSON.stringify(sourcebookClauses),
			authContext?.user?.email || authContext?.userId || "",
			createdAt
		]);
		const row = await d1Get(svc.env, `SELECT * FROM ${DOCUMENTS_TABLE} WHERE id = ? LIMIT 1`, [id]);
		return svc.json({ ok: true, document: rowToDocument(row) }, 201, svc.corsHeaders(origin));
	} catch (error) {
		const status = error?.status || 500;
		return svc.json({ ok: false, error: "ethics_submission_document_failed", message: error?.message || "The ethics submission document could not be generated." }, status, svc.corsHeaders(origin));
	}
}

export async function readEthicsSubmissionDocument(svc, origin, documentIdValue) {
	try {
		await ensureDocumentsTable(svc);
		const row = await d1Get(svc.env, `SELECT * FROM ${DOCUMENTS_TABLE} WHERE id = ? LIMIT 1`, [documentIdValue]);
		if (!row) return svc.json({ ok: false, error: "ethics_submission_document_not_found" }, 404, svc.corsHeaders(origin));
		if (!svc?.env?.RESEARCHOPS_DOCUMENTS_R2?.get) {
			return svc.json({ ok: false, error: "object_storage_unavailable" }, 503, svc.corsHeaders(origin));
		}
		const object = await svc.env.RESEARCHOPS_DOCUMENTS_R2.get(row.object_key);
		if (!object) return svc.json({ ok: false, error: "ethics_submission_document_object_not_found" }, 404, svc.corsHeaders(origin));
		const headers = new Headers(svc.corsHeaders(origin));
		headers.set("content-type", CONTENT_TYPE);
		headers.set("content-disposition", `attachment; filename="${safeSlug(row.study_id)}-ethics-submission-v${row.submission_version}.docx"`);
		headers.set("cache-control", "private, no-store");
		return new Response(object.body, { status: 200, headers });
	} catch (error) {
		return svc.json({ ok: false, error: "ethics_submission_document_read_failed", message: error?.message || "The ethics submission document could not be read." }, error?.status || 500, svc.corsHeaders(origin));
	}
}
