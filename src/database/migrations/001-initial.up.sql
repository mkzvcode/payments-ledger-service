CREATE TABLE accounts (
  id uuid PRIMARY KEY,
  owner_id varchar(128) NOT NULL CHECK (length(owner_id) > 0),
  currency varchar(3) NOT NULL CHECK (currency ~ '^[A-Z]{3}$'),
  balance bigint NOT NULL DEFAULT 0 CHECK (balance >= 0),
  status varchar(16) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'FROZEN')),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  version integer NOT NULL DEFAULT 0 CHECK (version >= 0)
);

CREATE TABLE idempotency_requests (
  key varchar(128) PRIMARY KEY,
  request_hash char(64) NOT NULL,
  result jsonb,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);

CREATE TABLE transfers (
  id uuid PRIMARY KEY,
  kind varchar(16) NOT NULL CHECK (kind IN ('TRANSFER', 'DEPOSIT')),
  from_account_id uuid REFERENCES accounts(id) ON DELETE RESTRICT,
  to_account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT,
  amount bigint NOT NULL CHECK (amount > 0),
  currency varchar(3) NOT NULL CHECK (currency ~ '^[A-Z]{3}$'),
  status varchar(16) NOT NULL CHECK (status IN ('PENDING', 'COMPLETED', 'FAILED')),
  idempotency_key varchar(128) NOT NULL UNIQUE REFERENCES idempotency_requests(key),
  failure_code varchar(64),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CHECK ((kind = 'DEPOSIT' AND from_account_id IS NULL) OR
         (kind = 'TRANSFER' AND from_account_id IS NOT NULL AND from_account_id <> to_account_id)),
  CHECK ((status = 'FAILED') = (failure_code IS NOT NULL))
);

CREATE TABLE ledger_entries (
  id uuid PRIMARY KEY,
  sequence bigint GENERATED ALWAYS AS IDENTITY UNIQUE,
  transfer_id uuid NOT NULL REFERENCES transfers(id) ON DELETE RESTRICT,
  account_id uuid REFERENCES accounts(id) ON DELETE RESTRICT,
  external_account varchar(64),
  direction varchar(6) NOT NULL CHECK (direction IN ('DEBIT', 'CREDIT')),
  amount bigint NOT NULL CHECK (amount > 0),
  currency varchar(3) NOT NULL CHECK (currency ~ '^[A-Z]{3}$'),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CHECK ((account_id IS NULL) <> (external_account IS NULL)),
  CHECK (external_account IS NULL OR external_account = 'external:funding'),
  UNIQUE (transfer_id, direction)
);
CREATE INDEX ledger_account_cursor_idx ON ledger_entries(account_id, sequence DESC);

CREATE FUNCTION reject_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'financial records are append-only' USING ERRCODE = '23514';
END;
$$;
CREATE TRIGGER immutable_ledger BEFORE UPDATE OR DELETE OR TRUNCATE ON ledger_entries
FOR EACH STATEMENT EXECUTE FUNCTION reject_mutation();
CREATE TRIGGER immutable_transfers BEFORE UPDATE OR DELETE OR TRUNCATE ON transfers
FOR EACH STATEMENT EXECUTE FUNCTION reject_mutation();

-- A CHECK cannot inspect other rows; deferred constraint triggers validate the final journal.
CREATE FUNCTION assert_balanced_transfer() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  operation transfers%ROWTYPE;
  target_id uuid;
  entry_count bigint;
  matched_count bigint;
  net numeric;
BEGIN
  IF TG_TABLE_NAME = 'transfers' THEN target_id := NEW.id;
  ELSE target_id := NEW.transfer_id;
  END IF;
  SELECT * INTO STRICT operation FROM transfers WHERE id = target_id;
  SELECT count(*), coalesce(sum(CASE direction WHEN 'DEBIT' THEN -amount::numeric ELSE amount::numeric END), 0),
    count(*) FILTER (WHERE amount = operation.amount AND currency = operation.currency AND
      ((direction = 'DEBIT' AND
        ((operation.kind = 'TRANSFER' AND account_id = operation.from_account_id AND external_account IS NULL) OR
         (operation.kind = 'DEPOSIT' AND account_id IS NULL AND external_account = 'external:funding'))) OR
       (direction = 'CREDIT' AND account_id = operation.to_account_id AND external_account IS NULL)))
    INTO entry_count, net, matched_count FROM ledger_entries WHERE transfer_id = target_id;
  IF operation.status = 'PENDING' OR
     (operation.status = 'COMPLETED' AND (entry_count <> 2 OR net <> 0 OR matched_count <> 2)) OR
     (operation.status = 'FAILED' AND entry_count <> 0) THEN
    RAISE EXCEPTION 'invalid double-entry journal' USING ERRCODE = '23514';
  END IF;
  IF operation.status = 'COMPLETED' AND EXISTS (
    SELECT 1 FROM accounts WHERE id IN (operation.from_account_id, operation.to_account_id)
    AND currency <> operation.currency
  ) THEN
    RAISE EXCEPTION 'journal currency mismatch' USING ERRCODE = '23514';
  END IF;
  RETURN NULL;
END;
$$;
CREATE CONSTRAINT TRIGGER balanced_transfer AFTER INSERT ON transfers
DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION assert_balanced_transfer();
CREATE CONSTRAINT TRIGGER balanced_entries AFTER INSERT ON ledger_entries
DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION assert_balanced_transfer();

CREATE FUNCTION assert_account_projection() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  target_id uuid;
  actual bigint;
  expected numeric;
BEGIN
  IF TG_TABLE_NAME = 'accounts' THEN target_id := NEW.id;
  ELSE target_id := NEW.account_id;
  END IF;
  IF target_id IS NULL THEN RETURN NULL; END IF;
  SELECT balance INTO STRICT actual FROM accounts WHERE id = target_id;
  SELECT coalesce(sum(CASE direction WHEN 'CREDIT' THEN amount::numeric ELSE -amount::numeric END), 0)
    INTO expected FROM ledger_entries WHERE account_id = target_id;
  IF actual <> expected THEN
    RAISE EXCEPTION 'account balance differs from ledger' USING ERRCODE = '23514';
  END IF;
  RETURN NULL;
END;
$$;
CREATE CONSTRAINT TRIGGER account_projection AFTER INSERT OR UPDATE ON accounts
DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION assert_account_projection();
CREATE CONSTRAINT TRIGGER ledger_projection AFTER INSERT ON ledger_entries
DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION assert_account_projection();

CREATE FUNCTION guard_account_identity() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.id <> OLD.id OR NEW.currency <> OLD.currency OR NEW.owner_id <> OLD.owner_id OR NEW.created_at <> OLD.created_at THEN
    RAISE EXCEPTION 'account identity is immutable' USING ERRCODE = '23514';
  END IF;
  IF NEW.version <> OLD.version + 1 THEN
    RAISE EXCEPTION 'account version must increment by one' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER account_identity BEFORE UPDATE ON accounts
FOR EACH ROW EXECUTE FUNCTION guard_account_identity();

CREATE FUNCTION assert_idempotency_finished() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM idempotency_requests WHERE key = NEW.key AND result IS NULL) THEN
    RAISE EXCEPTION 'unfinished idempotency reservation' USING ERRCODE = '23514';
  END IF;
  RETURN NULL;
END;
$$;
CREATE CONSTRAINT TRIGGER finished_request AFTER INSERT ON idempotency_requests
DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION assert_idempotency_finished();
