DROP TABLE ledger_entries, transfers, idempotency_requests, accounts CASCADE;
DROP FUNCTION reject_mutation(), assert_balanced_transfer(), assert_account_projection(), guard_account_identity(), assert_idempotency_finished();
