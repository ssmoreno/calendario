CREATE TABLE IF NOT EXISTS "chat_state_subscriptions" (
  "key_prefix" TEXT NOT NULL,
  "thread_id" TEXT NOT NULL,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "chat_state_subscriptions_pkey" PRIMARY KEY ("key_prefix", "thread_id")
);

CREATE TABLE IF NOT EXISTS "chat_state_locks" (
  "key_prefix" TEXT NOT NULL,
  "thread_id" TEXT NOT NULL,
  "token" TEXT NOT NULL,
  "expires_at" TIMESTAMPTZ NOT NULL,
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "chat_state_locks_pkey" PRIMARY KEY ("key_prefix", "thread_id")
);

CREATE TABLE IF NOT EXISTS "chat_state_cache" (
  "key_prefix" TEXT NOT NULL,
  "cache_key" TEXT NOT NULL,
  "value" TEXT NOT NULL,
  "expires_at" TIMESTAMPTZ,
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "chat_state_cache_pkey" PRIMARY KEY ("key_prefix", "cache_key")
);

CREATE TABLE IF NOT EXISTS "chat_state_lists" (
  "key_prefix" TEXT NOT NULL,
  "list_key" TEXT NOT NULL,
  "seq" BIGSERIAL NOT NULL,
  "value" TEXT NOT NULL,
  "expires_at" TIMESTAMPTZ,
  CONSTRAINT "chat_state_lists_pkey" PRIMARY KEY ("key_prefix", "list_key", "seq")
);

CREATE TABLE IF NOT EXISTS "chat_state_queues" (
  "key_prefix" TEXT NOT NULL,
  "thread_id" TEXT NOT NULL,
  "seq" BIGSERIAL NOT NULL,
  "value" TEXT NOT NULL,
  "expires_at" TIMESTAMPTZ NOT NULL,
  CONSTRAINT "chat_state_queues_pkey" PRIMARY KEY ("key_prefix", "thread_id", "seq")
);

CREATE INDEX IF NOT EXISTS "chat_state_locks_expires_idx"
  ON "chat_state_locks" ("expires_at");
CREATE INDEX IF NOT EXISTS "chat_state_cache_expires_idx"
  ON "chat_state_cache" ("expires_at");
CREATE INDEX IF NOT EXISTS "chat_state_lists_expires_idx"
  ON "chat_state_lists" ("expires_at");
CREATE INDEX IF NOT EXISTS "chat_state_queues_expires_idx"
  ON "chat_state_queues" ("expires_at");

ALTER TABLE "chat_state_subscriptions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "chat_state_locks" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "chat_state_cache" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "chat_state_lists" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "chat_state_queues" ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE
  "chat_state_subscriptions",
  "chat_state_locks",
  "chat_state_cache",
  "chat_state_lists",
  "chat_state_queues"
FROM PUBLIC;

REVOKE ALL ON SEQUENCE
  "chat_state_lists_seq_seq",
  "chat_state_queues_seq_seq"
FROM PUBLIC;
