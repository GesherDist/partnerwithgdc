-- ============================================================================
-- 178_cma_cgm_api_logs.sql  (Nov 27 2026)
--
-- Every CMA CGM Track & Trace call made for a shipment (daily sync, "Track
-- now", tracking right after a container number is saved) with CMA's full
-- response, so the operations team can see exactly what CMA returned
-- (eye icon next to the container number on Shipment Orders).
--
--   source       : 'daily_sync' | 'track_now' | 'auto'
--   outcome      : 'updated' | 'no_events' | 'other_trip' | 'error'
--   http_status  : CMA HTTP status (NULL if the call never got a reply)
--   message      : what the system did / the error
--   event_count  : number of events in CMA's reply
--   response     : CMA's reply as returned (JSON array, or the error body)
--
-- Logs older than 90 days are deleted by the daily sync.
-- Only the server writes/reads this table (service role); RLS on, no policies.
-- Safe to run more than once.
-- ============================================================================

CREATE TABLE IF NOT EXISTS cma_cgm_api_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shipment_id UUID REFERENCES shipments(id) ON DELETE CASCADE,
  container_number VARCHAR(20) NOT NULL,
  source VARCHAR(20) NOT NULL,
  outcome VARCHAR(20) NOT NULL,
  http_status INTEGER,
  message TEXT,
  event_count INTEGER,
  response JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT check_cma_log_source CHECK (source IN ('daily_sync', 'track_now', 'auto')),
  CONSTRAINT check_cma_log_outcome CHECK (outcome IN ('updated', 'no_events', 'other_trip', 'error'))
);

CREATE INDEX IF NOT EXISTS idx_cma_cgm_api_logs_shipment ON cma_cgm_api_logs(shipment_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_cma_cgm_api_logs_created ON cma_cgm_api_logs(created_at);

ALTER TABLE cma_cgm_api_logs ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE cma_cgm_api_logs IS 'CMA CGM Track & Trace calls per shipment with the full API response (kept 90 days)';
