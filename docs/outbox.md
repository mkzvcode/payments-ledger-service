# Следующий шаг: transactional outbox

Текущее приложение не публикует события и не содержит outbox-worker. Нельзя отправлять сообщение в брокер между SQL-записями: транзакция БД и публикация не атомарны.

Предлагаемая схема:

1. Миграция создаёт outbox_events: UUID event_id, aggregate_id (transfer), event_type, schema_version, payload jsonb, occurred_at, available_at, attempts, published_at. Уникальность (aggregate_id, event_type), частичный индекс по неопубликованным записям.
2. В той же транзакции, что COMPLETED, проводки и идемпотентный результат, добавляется transfer.completed с event_id, transfer_id, from/to, строковой amount и currency. Для депозитов нужен отдельный тип deposit.completed; не включать ownerId и секретные данные.
3. Worker выбирает ограниченную пачку FOR UPDATE SKIP LOCKED. Публикует с подтверждением брокера и отмечает published_at. Для длинной публикации возможна lease-модель: короткий claim с locked_until и fencing token, затем publish вне SQL-транзакции, затем conditional ack. Выбор зависит от бюджета времени и нагрузки.
4. Сбой между publish и ack приводит к повтору. Доставка at-least-once; consumer использует inbox с UNIQUE(event_id) и атомарно сохраняет inbox вместе со своим эффектом. Обещание exactly-once без этого неверно.
5. Повторы с exponential backoff/jitter, лимит попыток, quarantine, метрики возраста самого старого события/количества ошибок и ручной replay по регламенту. Порядок событий одного агрегата обеспечивается partition key; глобальный порядок не обещается.

Проверки: rollback перевода не оставляет события; повтор Idempotency-Key не создаёт второе; сбой worker после publish допускает повтор без второго эффекта consumer; несколько workers не теряют задания; остановка не теряет подтверждённые сообщения. Payload версионируется, retention и очистка применяются только после подтверждённой публикации и согласованного срока аудита.
