# KOURASKS - Résumé de la Progression

## Vue d'ensemble

Ce document résume la progression des déblocages dans le jeu Kourasks.
**1 trimestre = 6 minutes de jeu réel**

## Timeline des déblocages (Trimestre 0-32)

### T0 - Début du jeu
- **Hardware**: Pakard Bèle 486 (gratuit), Conpac DeschPrau 486DX (gratuit)
- **Services**: GRAs.pl, Apache HTTPd 0.6, MySQL 1.0
- **Projet**: Site Vitrine v1.0
- **Mail**: Bienvenue chez KouraTech

### T0.8-T1.5 - Ère Pentium (6-9 min)
- **Hardware**: Céléreau 266, Pentium MMX 233, PentiumPro 200
- **Services**: PHP 3, Apache 1.3, MySQL 3.0, ColdFusion, Nagios
- **Projet**: Site Vitrine v1.5 (+ reverse-proxy requis)

### T1.5-T2.5 - Début du forum (9-15 min)
- **Projet**: Forum Community v1.0
- **Mail**: Lancement du Forum

### T2-T4 - Ère PIII/Athlon (12-24 min)
- **Hardware**: Céléreau 500, Athlon 800, SPARC, Rackspace dédié, VPS
- **Services**: Tomcat, JBoss, Oracle 9i, Nginx, Akamai CDN
- **Projet**: E-commerce v1.0, Forum v2.0
- **Services financiers**: Prêt KouraKal (si 0K), Obligations 6.5%

### T4-T5.5 - PHP 5/Symfony (24-33 min)
- **Hardware**: Céléreau D, Athlon 64 FX, Dell PowerEdge 265
- **Services**: PHP 5, Symfony 1.4, Memcached, PostgreSQL
- **Projet**: SaaS Gestion v1.0

### T5-T8 - Core 2 Duo & NoSQL (30-48 min)
- **Hardware**: Core 2 Duo, HP ProLiant DL380, Hetzner EX6, Linode
- **Services**: Rails, Django, Node.js, MongoDB, Redis, RabbitMQ
- **Projets**: E-commerce v2.0, API Mobile v1.0, SaaS v2.0
- **Mail**: Milestone 100K Kouraks (T5)

### T6.5-T9 - Nehalem/Cloud (39-54 min)
- **Hardware**: Core i5/i7, Dell Blade M710, AWS EC2
- **Services**: Symfony 2.7, Laravel, Docker, Elasticsearch, Kafka
- **Projets**: Streaming v1.0

### T8-T11 - Sandy Bridge (48-66 min)
- **Hardware**: Core i3/i7 Sandy, HP Gen8, DigitalOcean
- **Services**: Go, Symfony 4, FastAPI, Kubernetes, Prometheus
- **Projets**: Fintech v1.0, API Mobile v2.0
- **Mail**: Milestone 1M Kouraks (T10)

### T9.5-T12.5 - Skylake (57-75 min)
- **Hardware**: Core i5/i7 Skylake, Cisco UCS, Scaleway
- **Services**: Traefik, Redis Cluster, Keycloak, GitLab CI
- **Projets**: Streaming v2.0, IoT v1.0

### T11-T15 - Zen 2/EPYC (66-90 min)
- **Hardware**: Ryzen 5 3600, i9-9900K, EPYC 7702, Hetzner AX101
- **Services**: Symfony 5, Rust, FrankenPHP, Istio, ArgoCD
- **Projets**: Fintech v2.0, Social Network v1.0, IoT v2.0
- **Mail**: Milestone 10M Kouraks (T15)

### T13-T18 - Alder Lake/Milan (78-108 min)
- **Hardware**: Core i5-12400, Ryzen 7 5800X3D, EPYC Milan
- **Services**: Postgres 13, TimescaleDB, Vault, GitHub Actions
- **Projets**: AI/ML v1.0, Social v2.0

### T18.5-T22.8 - Platform Engineering (111-137 min)
- **Services**: Bun.js, Symfony 6, Meilisearch, NATS, Pulsar
- **Services**: Cilium, OpenTelemetry, K8s Operators
- **Projets**: AI/ML v2.0

### T23-T32 - AI Era (138-192 min)
- **Services**: Symfony 7, Rust Axum, Hono.js, Backstage IDP
- **Services**: Valkey, DragonflyDB, Redpanda, Qdrant
- **Services**: Grafana LGTM, Karpenter, GPTifié API
- **Projets**: AI/ML v3.0 (RAG)
- **Mail**: Victory (T20+)

## Répartition des services par tier

| Tier | Services | Cumul | SaaS % |
|------|----------|-------|--------|
| T1   | 4        | 4     | 0%     |
| T2   | 5        | 9     | 0%     |
| T3   | 7        | 16    | 12%    |
| T4   | 8        | 24    | 4%     |
| T5   | 11       | 35    | 18%    |
| T6   | 11       | 46    | 18%    |
| T7   | 14       | 60    | 29%    |
| T8   | 16       | 76    | 31%    |
| T9   | 17       | 93    | 35%    |
| T10  | 21       | 114   | 38%    |

## Progression des projets

| Projet | Lancement | Versions | Services requis (v finale) |
|--------|-----------|----------|---------------------------|
| Site Vitrine | T0 | 2 | backend, reverse-proxy |
| Forum | T1.5 | 2 | backend, database, storage |
| E-commerce | T2.5 | 2 | backend, database, cache, email |
| SaaS Gestion | T4.0 | 2 | backend, database, cache, message-queue, storage |
| API Mobile | T5.5 | 2 | backend, database, cache, search, cdn |
| Streaming | T7.0 | 2 | backend, database, cache, message-queue, storage, cdn, orchestration |
| Fintech | T8.5 | 2 | backend, database, cache, message-queue, auth, service-mesh, monitoring |
| IoT Platform | T10.0 | 2 | backend, database, cache, message-queue, orchestration, monitoring |
| Social Network | T11.5 | 2 | backend, database, cache, message-queue, search, cdn, service-mesh, ci-cd, monitoring |
| AI/ML | T13.0 | 3 | backend, database, cache, message-queue, storage, serverless, orchestration, platform, monitoring |

## Événements narratifs clés

- **T0**: Bienvenue (premier mail)
- **T5**: Milestone 100K Kouraks
- **T10**: Milestone 1M Kouraks
- **T15**: Milestone 10M Kouraks
- **T20+**: Victory (rachat de l'entreprise)
- **Zero Kouraks**: 3 mails progressifs → Game Over

## Mécaniques de balance

### Hardware progression
- T1: ~15 K/s capacité
- T5: ~130 K/s capacité  
- T10: ~5000 K/s capacité
- Multiplicateur: ×1 → ×95 (×330 théorique au T10)

### Projects targetProduction
- T0-T2: 1 800 - 3 600 K/trim
- T3-T5: 4 500 - 45 000 K/trim
- T6-T10: 75 000 - 500 000 K/trim
- T11-T17: 850 000 - 5 000 000 K/trim

### Service baseYield
- T1: 0.8 - 2.0 K/s
- T5: 3.0 - 10.0 K/s
- T10: 10.0 - 30.0 K/s

## Notes de design

1. **Déblocage continu**: Les unlockAtTrimester sont en float (0.8, 1.5, 2.3...) pour un flux constant
2. **Événements liés**: Les mails se débloquent via eventId des versions de projets
3. **Progression SaaS**: 0% → 38% reflète la dépendance croissante aux services cloud
4. **Deprecated services**: Les vieux services deviennent obsolètes (crashRate augmente)
5. **Financial services**: Prêt (si 0K), Obligations (mid-game), Optimizer (late-game)
6. **Game Over**: 3 passages à 0K OU 3 projets failed
7. **Victory**: Atteindre T20+ avec succès
