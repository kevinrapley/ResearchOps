CREATE TABLE IF NOT EXISTS agent_gateway_audit (
	row_id INTEGER PRIMARY KEY AUTOINCREMENT,
	id TEXT NOT NULL,
	tool TEXT NOT NULL,
	environment TEXT NOT NULL,
	actor TEXT NOT NULL,
	reason TEXT NOT NULL,
	phase TEXT NOT NULL,
	ok INTEGER NOT NULL,
	message TEXT NOT NULL,
	created_at TEXT NOT NULL,
	fixture_name TEXT,
	request_id TEXT,
	target_resource_type TEXT,
	target_resource_id TEXT,
	operation_class TEXT,
	ip_hash TEXT,
	user_agent_hash TEXT,
	commit_sha TEXT,
	workflow_run_id TEXT,
	input_hash TEXT
);

CREATE INDEX IF NOT EXISTS idx_agent_gateway_audit_created_at
ON agent_gateway_audit (created_at);

CREATE INDEX IF NOT EXISTS idx_agent_gateway_audit_actor
ON agent_gateway_audit (actor);

CREATE INDEX IF NOT EXISTS idx_agent_gateway_audit_tool
ON agent_gateway_audit (tool);

CREATE INDEX IF NOT EXISTS idx_agent_gateway_audit_phase
ON agent_gateway_audit (phase);

CREATE INDEX IF NOT EXISTS idx_agent_gateway_audit_operation_class
ON agent_gateway_audit (operation_class);

CREATE INDEX IF NOT EXISTS idx_agent_gateway_audit_target_resource
ON agent_gateway_audit (target_resource_type, target_resource_id);

CREATE INDEX IF NOT EXISTS idx_agent_gateway_audit_request_id
ON agent_gateway_audit (request_id);
