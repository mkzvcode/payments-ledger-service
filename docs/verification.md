# Результаты проверки

Дата: 8 ноября 2026. Локальная проверка на Windows, Node.js 22.23.4, настоящий PostgreSQL 16.15.

| Проверка                                                       | Результат                                 |
| -------------------------------------------------------------- | ----------------------------------------- |
| TypeScript, включая тесты                                      | Пройдено (`tsc --noEmit`)                 |
| ESLint, ноль предупреждений                                    | Пройдено                                  |
| Prettier                                                       | Пройдено                                  |
| Unit                                                           | 24 / 24                                   |
| Доменное покрытие statements / branches / functions / lines    | 100% / 100% / 100% / 100%                 |
| E2E на отдельном PostgreSQL 16 (`E2E_DATABASE_URL`)            | 20 / 20                                   |
| Build, включая копирование SQL                                 | Пройдено                                  |
| Собранные миграции и повторный seed                            | Пройдено                                  |
| HTTP smoke: readiness, Swagger, перевод и идемпотентный повтор | Пройдено                                  |
| Runtime audit (`npm audit --omit=dev`)                         | 0 уязвимостей                             |
| Compose configuration                                          | Валидна (`docker compose config --quiet`) |
| Testcontainers и Docker image/Compose smoke                    | Ожидают работающий Docker Engine          |

E2E подтвердили сохранение сумм при 100 параллельных переводах и 100 встречных переводах без deadlock, защиту от перерасхода, конкурентную идемпотентность, точность больших целых, неизменяемость журнала, откат при lock timeout с повтором исходного ключа и проверку optimistic version.

Ограничение окружения: Docker Desktop установлен, компоненты VirtualMachinePlatform и Windows Subsystem for Linux включены, но Windows имеет флаг RebootPending и гипервизор ещё не запущен. Стандартный `npm run test:e2e` честно завершился ошибкой `Could not find a working container runtime strategy`; пропуска тестов нет. Установку/обновление WSL и запуск Docker нужно завершить после перезагрузки. Контейнерный прогон и удалённый GitHub Actions пока не подтверждены; успешный прогон через отдельный PostgreSQL не выдаётся за успешный Testcontainers.

После запуска движка: `npm run test:e2e`, затем три команды из README. CI выполняет этот путь на Ubuntu с Docker; фактический статус CI появляется после публикации репозитория в GitHub.
