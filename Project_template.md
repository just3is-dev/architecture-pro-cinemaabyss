## Изучите [README.md](README.md) файл и структуру проекта.

## Задание 1

Архитектура системы построена с использованием паттерна **Strangler Fig**, который позволяет постепенно выделять функциональность из монолитного приложения в отдельные микросервисы.

В системе используется **API Gateway**, выступающий в роли фасада (Facade) и единой точки входа. Gateway маршрутизирует запросы либо в монолит, либо в соответствующие микросервисы. Перенаправление трафика осуществляется постепенно, что позволяет безопасно выполнять миграцию без остановки системы.

Поскольку API монолита и API выделяемых микросервисов на текущем этапе имеют совместимый контракт, необходимость в использовании **Anti-Corruption Layer (ACL)** отсутствует. Поэтому дополнительный слой адаптации между монолитом и микросервисами не используется.

На этапе миграции микросервисы продолжают использовать **общую базу данных**, что существенно упрощает процесс выделения сервисов и снижает сложность миграции данных.

Диаграмма контейнеров, отражающая архитектуру системы во время миграции:

[TO-BE Container Diagram (Architecture During Migration)](diagrams/to-be/C4_ContainerDiagram_MigrationArchitecture.puml)

В дальнейшем планируется переход к архитектуре **database per service**, при которой каждый микросервис будет владеть собственной базой данных. Это позволит снизить связанность сервисов и обеспечить независимую эволюцию их моделей данных.

Ниже представлена целевая контейнерная диаграмма системы:

[TO-BE Container Diagram (Target Microservices Architecture)](diagrams/to-be/C4_ContainerDiagram_TargetArchitecture.puml)

Users Service в текущей целевой архитектуре объединяет несколько связанных функций: управление пользователями, профилями и базовую аутентификацию (login, выдача и проверка токенов). 

Такое объединение выбрано сознательно, чтобы не усложнять архитектуру на раннем этапе и уменьшить количество сервисов для небольшой команды разработки.

В дальнейшем, по мере роста системы и появления дополнительных требований (например, OAuth, SSO, интеграции с внешними identity-провайдерами), Users Service может быть разделён на два отдельных сервиса:

- Auth Service — отвечает за аутентификацию, выдачу и проверку токенов, управление сессиями.

- Users Service — отвечает за хранение и управление пользовательскими профилями и пользовательскими данными.

Такое разделение позволит изолировать безопасность и управление идентификацией от доменной логики пользователей и повысить масштабируемость системы.

## Задание 2

### 1. Proxy
Был реализован API Gateway (proxy-service) как единая точка входа в систему.
Gateway маршрутизирует запросы между монолитом и микросервисами без бизнес-логики.

Реализовано:
- /api/movies → монолит или movies-service
- /api/events → events-service
- остальные запросы → монолит
- /health → проверка gateway

Для маршрута /api/movies реализован постепенный переход (Strangler Fig) через feature flag:
- GRADUAL_MIGRATION
- MOVIES_MIGRATION_PERCENT

Процент задаёт, какая доля трафика идёт в movies-service.

Postman тесты успешно пройдены, запросы через gateway работают корректно.

### 2. Kafka
Реализован events-service (NestJS) с использованием Kafka.

Сервис выполняет две роли:
- producer — отправляет события в Kafka
- consumer — читает события и логирует их

Реализованы эндпоинты:
- POST /api/events/movie
- POST /api/events/user
- POST /api/events/payment
- GET /api/events/health

При вызове API:
- создаётся событие
- отправляется в Kafka
- consumer читает сообщение
- событие логируется

Использована библиотека kafkajs, топик — events.

Проверено:
- postman тесты — [зелёные](./screenshots/kafka_tests.png)
- Kafka UI (http://localhost:8090) — [сообщения отображаются](./screenshots/kafka_topics.png)
- логи сервиса — события обрабатываются

## Задание 3

### CI/CD

В workflow docker-build-push.yml были внесены следующие изменения:

- Добавлен триггер на рабочую ветку (cinema), чтобы pipeline запускался при push
- Добавлена сборка и публикация Docker-образов для events-service и proxy-service
- После сборки добавлен запуск интеграционных API тестов

Результат

- Все сервисы успешно собираются и публикуются в ghcr.io
- Интеграционные тесты проходят без ошибок
- Pipeline имеет “зеленый” статус - [Github Actions](https://github.com/just3is-dev/architecture-pro-cinemaabyss/actions)

### Proxy в Kubernetes

#### Шаг 1

Создан Personal Access Token (PAT) для доступа к GitHub Container Registry (ghcr.io) с правами read:packages.

Docker-образы сервисов (monolith, movies-service, events-service, proxy-service) были собраны и загружены в ghcr.io.

В Kubernetes-манифестах обновлены пути к образам:
- ghcr.io/<username>/<repo>/monolith:latest
- ghcr.io/<username>/<repo>/movies-service:latest
- ghcr.io/<username>/<repo>/events-service:latest
- ghcr.io/<username>/<repo>/proxy-service:latest

Создан dockerconfigsecret на основе ~/.docker/config.json с закодированными в base64 данными для аутентификации в ghcr.io.

#### Шаг 2

Реализованы Kubernetes-манифесты для следующих сервисов:
- events-service (Deployment + Service)
- proxy-service (Deployment + Service)

Ingress настроен для маршрутизации:
- /api/movies → movies-service / monolith (в зависимости от MOVIES_MIGRATION_PERCENT)
- /api/events → events-service
- /api/users и другие → monolith

Кластер развернут в следующем порядке:
1. Namespace
2. ConfigMap и Secrets
3. PostgreSQL
4. Kafka и Zookeeper
5. Monolith
6. Микросервисы (movies-service, events-service)
7. Proxy-service
8. Ingress + minikube tunnel

Все поды успешно запущены и находятся в статусе Running.

После настройки ingress выполнен запрос:
https://cinemaabyss.example.com/api/movies

Результат: получен список фильмов.

Также выполнены тесты:
npm run test:kubernetes

Создание событий (MovieEvent, UserEvent, PaymentEvent) успешно отрабатывает через Kafka и обрабатывается event-service.

#### Шаг 3

Добавлены скриншоты:

1. Ответ API:
   https://cinemaabyss.example.com/api/movies  
   [вывод списка фильмов](./screenshots/api_movies.png).

2. Логи event-service после выполнения тестов:
- получение событий (MovieEvent, UserEvent, PaymentEvent)
- успешная обработка сообщений из Kafka
  Вот скриншот [логов](./screenshots/events_logs.png)

## Задание 4

В Helm шаблоне proxy-service.yaml реализован Deployment и Service, а также прокинуты переменные окружения через values.yaml.

Развертывание выполнено с помощью Helm:

```
helm install cinemaabyss ./src/kubernetes/helm --namespace cinemaabyss --create-namespace
helm upgrade cinemaabyss ./src/kubernetes/helm -n cinemaabyss
```

Все сервисы находятся в статусе Running.

- вывод helm list [тут](./screenshots/helm_list.png)
- ответ /api/movies [тут](./screenshots/helm_movies.png)

# Задание 5
Компания планирует активно развиваться и для повышения надежности, безопасности, реализации сетевых паттернов типа Circuit Breaker и канареечного деплоя вам как архитектору необходимо развернуть istio и настроить circuit breaker для monolith и movies сервисов.

```bash

helm repo add istio https://istio-release.storage.googleapis.com/charts
helm repo update

helm install istio-base istio/base -n istio-system --set defaultRevision=default --create-namespace
helm install istio-ingressgateway istio/gateway -n istio-system
helm install istiod istio/istiod -n istio-system --wait

helm install cinemaabyss .\src\kubernetes\helm --namespace cinemaabyss --create-namespace

kubectl label namespace cinemaabyss istio-injection=enabled --overwrite

kubectl get namespace -L istio-injection

kubectl apply -f .\src\kubernetes\circuit-breaker-config.yaml -n cinemaabyss

```

Тестирование

# fortio
```bash
kubectl apply -f https://raw.githubusercontent.com/istio/istio/release-1.25/samples/httpbin/sample-client/fortio-deploy.yaml -n cinemaabyss
```

# Get the fortio pod name
```bash
FORTIO_POD=$(kubectl get pod -n cinemaabyss | grep fortio | awk '{print $1}')

kubectl exec -n cinemaabyss $FORTIO_POD -c fortio -- fortio load -c 50 -qps 0 -n 500 -loglevel Warning http://movies-service:8081/api/movies
```
Например,

```bash
kubectl exec -n cinemaabyss fortio-deploy-b6757cbbb-7c9qg  -c fortio -- fortio load -c 50 -qps 0 -n 500 -loglevel Warning http://movies-service:8081/api/movies
```

Вывод будет типа такого

```bash
IP addresses distribution:
10.106.113.46:8081: 421
Code 200 : 79 (15.8 %)
Code 500 : 22 (4.4 %)
Code 503 : 399 (79.8 %)
```
Можно еще проверить статистику

```bash
kubectl exec -n cinemaabyss fortio-deploy-b6757cbbb-7c9qg -c istio-proxy -- pilot-agent request GET stats | grep movies-service | grep pending
```

И там смотрим 

```bash
cluster.outbound|8081||movies-service.cinemaabyss.svc.cluster.local;.upstream_rq_pending_total: 311 - столько раз срабатывал circuit breaker
You can see 21 for the upstream_rq_pending_overflow value which means 21 calls so far have been flagged for circuit breaking.
```

Приложите скриншот работы circuit breaker'а

Удаляем все
```bash
istioctl uninstall --purge
kubectl delete namespace istio-system
kubectl delete all --all -n cinemaabyss
kubectl delete namespace cinemaabyss
```
