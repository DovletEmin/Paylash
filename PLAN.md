# Paylash — Локальная облачная система с Collabora Online

## Стек технологий

| Компонент | Технология | Почему |
|-----------|-----------|--------|
| Backend | **Go** | Один бинарник, встроенный веб-сервер, высокая производительность |
| Frontend | **Встроенный SPA** (HTML/CSS/JS) | Embed в Go-бинарник через `embed.FS`, нет зависимости на Node в runtime |
| БД | **PostgreSQL 16** | Многопользовательская система — нужны нормальный concurrent access, транзакции, JSON-поля |
| Хранилище файлов | **MinIO** | S3-совместимый, bucket-per-group, versioning, отлично для бинарных файлов |
| Документы | **Collabora Online (CODE)** | WOPI-протокол, совместное редактирование в реальном времени, работает оффлайн |
| Всё в Docker | **docker-compose** | PostgreSQL + MinIO + Collabora + Go-сервер — одна команда `docker-compose up` |

### Почему PostgreSQL, а не SQLite?
- Много пользователей одновременно — SQLite блокирует всю базу на запись
- Нужны `FOREIGN KEY`, `JOIN`, полнотекстовый поиск, JSON-поля для метаданных
- Роли, группы, права доступа — реляционная модель идеальна

### Почему MinIO, а не локальная файловая система?
- **Bucket per group** — изоляция хранилища на уровне группы
- **Квоты** — легко ограничить объём для пользователя/группы
- **Versioning** — история изменений файлов бесплатно
- **S3 API** — стандартный протокол, легко мигрировать потом
- **Presigned URLs** — отдача больших файлов без нагрузки на Go-сервер

---

## Роли и пользователи

### Роли
| Роль | Описание |
|------|----------|
| **admin** | Полный доступ. Управляет факультетами, курсами, группами, квотами, пользователями |
| **user** | Обычный студент. Доступ к файлам своей группы + личное хранилище + шеринг |

### Регистрация (для user)
Поля при регистрации:
1. **Логин** (username) — уникальный
2. **Пароль** — минимум 6 символов, хранится bcrypt-хешем
3. **Факультет** — выбор из списка (создаёт админ)
4. **Курс** — выбор из списка (создаёт админ)
5. **Группа** — выбор из списка (создаёт админ, привязана к факультету+курсу)

Админ создаётся при первом запуске (seed).

---

## Архитектура

```
┌─────────────────────────────────────────────────────────┐
│                       Go Binary                          │
│                                                          │
│  ┌──────────┐  ┌──────────┐  ┌─────────┐  ┌──────────┐  │
│  │ Frontend  │  │ REST API │  │  WOPI   │  │  Admin   │  │
│  │ (embed)   │  │ (user)   │  │ Server  │  │   API    │  │
│  └──────────┘  └──────────┘  └─────────┘  └──────────┘  │
│                      │            │             │         │
│              ┌───────┴────────────┴─────────────┴──┐     │
│              │          Service Layer               │     │
│              │  (auth, files, sharing, groups...)   │     │
│              └───────┬────────────┬─────────────────┘     │
│                      │            │                       │
│              ┌───────┴───┐  ┌────┴────────┐              │
│              │ PostgreSQL │  │    MinIO    │              │
│              │  (метадата)│  │  (файлы)   │              │
│              └───────────┘  └─────────────┘              │
└─────────────────────────────────────────────────────────┘
         ▲                              ▲
         │ HTTP :8080                   │ WOPI
         ▼                              ▼
┌─────────────────┐          ┌──────────────────┐
│   Браузер       │          │ Collabora Online │
│   (пользователь)│          │  (Docker :9980)  │
└─────────────────┘          └──────────────────┘
```

---

## Модель данных (PostgreSQL)

```sql
-- Справочники (управляет админ)
CREATE TABLE faculties (
    id          SERIAL PRIMARY KEY,
    name        VARCHAR(255) NOT NULL UNIQUE,
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE courses (
    id          SERIAL PRIMARY KEY,
    name        VARCHAR(100) NOT NULL,       -- "1 курс", "2 курс" и т.д.
    faculty_id  INT REFERENCES faculties(id) ON DELETE CASCADE,
    created_at  TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(name, faculty_id)
);

CREATE TABLE groups (
    id          SERIAL PRIMARY KEY,
    name        VARCHAR(100) NOT NULL,       -- "ТМ-21", "ИС-32"
    course_id   INT REFERENCES courses(id) ON DELETE CASCADE,
    quota_bytes BIGINT DEFAULT 5368709120,   -- 5 GB по умолчанию
    minio_bucket VARCHAR(255),               -- "group-{id}"
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Пользователи
CREATE TABLE users (
    id            SERIAL PRIMARY KEY,
    username      VARCHAR(100) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    display_name  VARCHAR(255),
    role          VARCHAR(20) DEFAULT 'user',  -- 'admin' | 'user'
    faculty_id    INT REFERENCES faculties(id),
    course_id     INT REFERENCES courses(id),
    group_id      INT REFERENCES groups(id),
    quota_bytes   BIGINT DEFAULT 1073741824,   -- 1 GB личное хранилище
    created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- Папки (виртуальные, для навигации)
CREATE TABLE folders (
    id          SERIAL PRIMARY KEY,
    name        VARCHAR(255) NOT NULL,
    parent_id   INT REFERENCES folders(id) ON DELETE CASCADE,
    owner_id    INT REFERENCES users(id) ON DELETE CASCADE,
    group_id    INT REFERENCES groups(id) ON DELETE CASCADE,
    scope       VARCHAR(20) NOT NULL,         -- 'personal' | 'group'
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Файлы (метаданные в PG, содержимое в MinIO)
CREATE TABLE files (
    id            SERIAL PRIMARY KEY,
    name          VARCHAR(500) NOT NULL,
    mime_type     VARCHAR(255),
    size_bytes    BIGINT NOT NULL DEFAULT 0,
    minio_bucket  VARCHAR(255) NOT NULL,
    minio_key     VARCHAR(1000) NOT NULL,      -- путь в MinIO
    folder_id     INT REFERENCES folders(id) ON DELETE SET NULL,
    owner_id      INT REFERENCES users(id) ON DELETE CASCADE,
    group_id      INT REFERENCES groups(id),
    scope         VARCHAR(20) NOT NULL,         -- 'personal' | 'group'
    version       INT DEFAULT 1,
    created_at    TIMESTAMPTZ DEFAULT NOW(),
    updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- Шеринг файлов
CREATE TABLE file_shares (
    id          SERIAL PRIMARY KEY,
    file_id     INT REFERENCES files(id) ON DELETE CASCADE,
    shared_by   INT REFERENCES users(id) ON DELETE CASCADE,
    shared_with INT REFERENCES users(id) ON DELETE CASCADE,
    permission  VARCHAR(20) DEFAULT 'view',    -- 'view' | 'edit'
    is_public   BOOLEAN DEFAULT FALSE,         -- доступ всем в группе
    created_at  TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(file_id, shared_with)
);

-- WOPI access tokens
CREATE TABLE wopi_tokens (
    id          SERIAL PRIMARY KEY,
    token       VARCHAR(255) NOT NULL UNIQUE,
    file_id     INT REFERENCES files(id) ON DELETE CASCADE,
    user_id     INT REFERENCES users(id) ON DELETE CASCADE,
    permission  VARCHAR(20) DEFAULT 'view',
    expires_at  TIMESTAMPTZ NOT NULL,
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Сессии
CREATE TABLE sessions (
    id          VARCHAR(255) PRIMARY KEY,      -- session token
    user_id     INT REFERENCES users(id) ON DELETE CASCADE,
    expires_at  TIMESTAMPTZ NOT NULL,
    created_at  TIMESTAMPTZ DEFAULT NOW()
);
```

---

## Структура проекта

```
Paylash/
├── main.go                      # Точка входа
├── go.mod
├── go.sum
│
├── internal/
│   ├── config/
│   │   └── config.go            # Конфигурация (env vars)
│   │
│   ├── server/
│   │   ├── server.go            # HTTP-сервер, роутинг
│   │   └── middleware.go        # Auth middleware, CORS, logging
│   │
│   ├── models/
│   │   └── models.go            # Все структуры: User, File, Folder, Group...
│   │
│   ├── db/
│   │   ├── db.go                # PostgreSQL подключение + миграции
│   │   ├── users.go             # Запросы: users
│   │   ├── files.go             # Запросы: files, folders
│   │   ├── groups.go            # Запросы: faculties, courses, groups
│   │   ├── shares.go            # Запросы: file_shares
│   │   └── sessions.go         # Запросы: sessions
│   │
│   ├── api/
│   │   ├── auth.go              # POST /api/auth/register, /login, /logout
│   │   ├── files.go             # CRUD файлов
│   │   ├── folders.go           # CRUD папок
│   │   ├── shares.go            # Шеринг файлов
│   │   └── users.go             # Профиль пользователя
│   │
│   ├── admin/
│   │   ├── faculties.go         # CRUD факультетов
│   │   ├── courses.go           # CRUD курсов
│   │   ├── groups.go            # CRUD групп + квоты
│   │   ├── users.go             # Управление пользователями
│   │   └── dashboard.go        # Статистика: юзеры, файлы, хранилище
│   │
│   ├── wopi/
│   │   ├── handler.go           # WOPI CheckFileInfo, GetFile, PutFile
│   │   ├── discovery.go         # Парсинг discovery.xml
│   │   └── token.go             # Генерация/валидация WOPI-токенов
│   │
│   ├── minio/
│   │   └── client.go            # MinIO клиент: upload, download, delete, bucket ops
│   │
│   └── utils/
│       └── helpers.go           # Генерация ID, валидация, форматирование
│
├── web/                          # Frontend (embed в бинарник)
│   ├── index.html                # SPA entry point
│   ├── css/
│   │   └── style.css             # Все стили + анимации
│   ├── js/
│   │   ├── app.js                # Роутер SPA, инициализация
│   │   ├── api.js                # HTTP-клиент
│   │   ├── auth.js               # Экраны логина / регистрации
│   │   ├── files.js              # Файловый менеджер
│   │   ├── editor.js             # Collabora iframe
│   │   ├── shares.js             # Страница "Поделиться" / "Мне поделились"
│   │   ├── admin.js              # Админ-панель
│   │   └── components.js         # Toast, Modal, Dropdown, Breadcrumbs...
│   └── assets/
│       └── icons/                # SVG-иконки
│
├── docker-compose.yml            # PostgreSQL + MinIO + Collabora + Go app
├── Dockerfile                    # Multi-stage build для Go
├── PLAN.md
└── README.md
```

---

## Цветовая палитра

| Роль | Цвет | HEX |
|------|-------|-----|
| Primary | Индиго | `#6366F1` |
| Primary Hover | Тёмный индиго | `#4F46E5` |
| Background | Тёмно-серый | `#0F0F11` |
| Surface | Антрацит | `#18181B` |
| Surface Hover | Серый | `#27272A` |
| Border | Мягкий серый | `#3F3F46` |
| Text Primary | Белый | `#FAFAFA` |
| Text Secondary | Приглушённый | `#A1A1AA` |
| Accent / Success | Изумруд | `#10B981` |
| Danger | Коралл | `#EF4444` |
| Warning | Янтарь | `#F59E0B` |
| Admin accent | Пурпур | `#A855F7` |

Тёмная тема по умолчанию. Минималистичный стиль в духе Linear/Vercel.
Админ-панель использует пурпурный акцент для визуального разделения от пользовательского интерфейса.

> **Язык интерфейса: только Туркменский (Türkmen dili)**
> Все тексты, кнопки, placeholder-ы, уведомления, ошибки — на туркменском языке.

---

## Функционал (по фазам)

### Фаза 1 — Инфраструктура + Аутентификация
- [ ] Docker-compose: PostgreSQL + MinIO + Collabora
- [ ] Go HTTP-сервер с embed-фронтендом
- [ ] PostgreSQL подключение + миграции (все таблицы)
- [ ] MinIO клиент инициализация
- [ ] Регистрация (username, password, faculty, course, group)
- [ ] Логин / Логаут (сессии через cookie)
- [ ] Middleware: auth check, role check (admin/user)
- [ ] Seed админа при первом запуске (admin / admin123)

### Фаза 2 — Админ-панель
- [ ] Dashboard: количество юзеров, файлов, занятое хранилище
- [ ] CRUD факультетов
- [ ] CRUD курсов (привязка к факультету)
- [ ] CRUD групп (привязка к курсу, настройка квот)
- [ ] Список пользователей (фильтр по группе, блокировка, удаление)
- [ ] Настройка квот хранилища (на группу / на пользователя)
- [ ] Красивый UI с таблицами, модалками, поиском

### Фаза 3 — Файловый менеджер
- [ ] Два scope: «Личное хранилище» и «Хранилище группы»
- [ ] Загрузка файлов (drag & drop + кнопка) → MinIO
- [ ] Скачивание файлов (presigned URL из MinIO)
- [ ] Удаление файлов
- [ ] Создание / переименование / удаление папок
- [ ] Навигация (breadcrumbs)
- [ ] Просмотр файлов (изображения, PDF, текст, видео)
- [ ] Поиск по имени
- [ ] Сортировка (имя, размер, дата)
- [ ] Вид: список / сетка
- [ ] Прогресс загрузки
- [ ] Отображение использованного / доступного места

### Фаза 4 — Collabora Online + Совместная работа
- [ ] WOPI Server (CheckFileInfo, GetFile, PutFile)
- [ ] Discovery.xml парсинг
- [ ] Access token генерация и валидация
- [ ] Iframe-интеграция для открытия документов
- [ ] **Совместное редактирование** — несколько пользователей в одном документе:
  - Collabora Online нативно поддерживает co-editing через WOPI
  - Каждый допущенный пользователь получает свой WOPI-токен
  - Collabora показывает курсоры и имена соавторов в реальном времени
- [ ] Поддержка: `.docx`, `.xlsx`, `.pptx`, `.odt`, `.ods`, `.odp`

### Фаза 5 — Шеринг файлов
- [ ] Кнопка «Поделиться» на файле → модалка
- [ ] Поиск пользователей по имени в модалке
- [ ] Выбор прав: «Просмотр» или «Редактирование»
- [ ] Отправка файла конкретному пользователю
- [ ] «Открыть доступ всем в группе» (toggle)
- [ ] Страница **«Мне поделились»** — список файлов, которыми поделились с текущим юзером
- [ ] Открытие расшаренного файла в Collabora (если формат поддерживается)
- [ ] Уведомление-badge когда новый файл расшарен

### Фаза 6 — Полировка
- [ ] Анимации: fadeInUp, stagger, hover scale, slide transitions
- [ ] Контекстное меню (правый клик)
- [ ] Toast-уведомления
- [ ] Адаптивный дизайн (мобильная версия)
- [ ] Skeleton loading
- [ ] Пустые состояния (empty state с иллюстрациями)

---

## API Endpoints

### Аутентификация
```
POST   /api/auth/register          # Регистрация (username, password, faculty_id, course_id, group_id)
POST   /api/auth/login             # Логин → session cookie
POST   /api/auth/logout            # Логаут
GET    /api/auth/me                # Текущий пользователь + роль
```

### Справочники (для формы регистрации, доступны без авторизации)
```
GET    /api/faculties                       # Список факультетов
GET    /api/faculties/:id/courses           # Курсы факультета
GET    /api/courses/:id/groups              # Группы курса
```

### Файлы и папки (авторизация обязательна)
```
GET    /api/files?scope=personal|group&folder_id=...&sort=...  # Список
POST   /api/files/upload              # Загрузка (multipart, scope + folder_id)
GET    /api/files/:id/download        # Скачивание (redirect на presigned URL)
DELETE /api/files/:id                  # Удаление
PATCH  /api/files/:id                  # Переименование
POST   /api/folders                    # Создание папки
PATCH  /api/folders/:id                # Переименование
DELETE /api/folders/:id                # Удаление
GET    /api/search?q=...              # Поиск по имени
GET    /api/storage/usage             # Использование хранилища (personal + group)
```

### Шеринг
```
POST   /api/files/:id/share           # Поделиться файлом {user_id, permission}
DELETE /api/files/:id/share/:user_id   # Отменить шеринг
PATCH  /api/files/:id/share/public     # Открыть/закрыть доступ всей группе
GET    /api/shared-with-me             # Файлы, которыми поделились со мной
GET    /api/files/:id/shares           # Кому расшарен файл
GET    /api/users/search?q=...         # Поиск пользователей (для модалки шеринга)
```

### WOPI (для Collabora)
```
GET    /wopi/files/:id                 # CheckFileInfo (+ info о юзере для co-editing)
GET    /wopi/files/:id/contents        # GetFile
POST   /wopi/files/:id/contents        # PutFile
```

### Collabora
```
GET    /api/collabora/editor-url?file_id=...  # URL для iframe (с токеном)
```

### Админ API (только role=admin)
```
GET    /api/admin/dashboard            # Статистика

POST   /api/admin/faculties            # Создать факультет
PATCH  /api/admin/faculties/:id        # Переименовать
DELETE /api/admin/faculties/:id        # Удалить

POST   /api/admin/courses              # Создать курс {name, faculty_id}
PATCH  /api/admin/courses/:id          # Переименовать
DELETE /api/admin/courses/:id          # Удалить

POST   /api/admin/groups               # Создать группу {name, course_id, quota_bytes}
PATCH  /api/admin/groups/:id           # Изменить (имя, квота)
DELETE /api/admin/groups/:id           # Удалить

GET    /api/admin/users                # Список юзеров (фильтры: faculty, course, group)
PATCH  /api/admin/users/:id            # Изменить (роль, квота, группа)
DELETE /api/admin/users/:id            # Удалить юзера
```

---

## Frontend — Страницы

### 1. Логин / Регистрация
```
┌─────────────────────────────────────────┐
│              ☁ Paylash                  │
│                                         │
│  ┌───────────────────────────────────┐  │
│  │         Вход в систему            │  │
│  │                                   │  │
│  │  Логин      [________________]    │  │
│  │  Пароль     [________________]    │  │
│  │                                   │  │
│  │         [ Войти ]                 │  │
│  │                                   │  │
│  │    Нет аккаунта? Регистрация      │  │
│  └───────────────────────────────────┘  │
│                                         │
└─────────────────────────────────────────┘
```

Регистрация — каскадные selects: Факультет → Курс → Группа (каждый следующий загружается при выборе предыдущего).

### 2. Файловый менеджер (главный экран)
```
┌─────────────────────────────────────────────────────────┐
│  ☁ Paylash       🔍 Поиск...    👤 User  [Grid][List]  │
├───────────┬─────────────────────────────────────────────┤
│           │  📁 Личное > Documents                      │
│ 📂 Личное │─────────────────────────────────────────────│
│   хранили-│                                             │
│   ще      │  📁 Projects      📁 Photos                 │
│           │  📄 report.docx   📄 budget.xlsx            │
│ 📂 Группа │  🖼 photo.jpg     📄 notes.txt              │
│  «ТМ-21»  │                                             │
│           │                                             │
│ 📨 Мне    │                                             │
│  поделили │                                             │
│  (3 new)  │                                             │
│           ├─────────────────────────────────────────────│
│ ───────── │        Перетащите файлы сюда                │
│ 💾 1 GB   │            или нажмите +                    │
│ ███░░ 45% │                                             │
└───────────┴─────────────────────────────────────────────┘
```

### 3. Страница «Мне поделились»
```
┌─────────────────────────────────────────────────────────┐
│  📨 Мне поделились                                      │
│─────────────────────────────────────────────────────────│
│                                                         │
│  📄 Курсовая.docx     от Ахмед К.    🟢 Редактирование │
│     2 часа назад       [ Открыть ]    [ Скачать ]       │
│                                                         │
│  📊 Бюджет.xlsx        от Мария С.    👁 Просмотр       │
│     вчера              [ Открыть ]    [ Скачать ]       │
│                                                         │
│  📄 Лаба_3.docx        от Группа      🟢 Редактирование│
│     3 дня назад        [ Открыть ]    [ Скачать ]       │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### 4. Модалка «Поделиться»
```
┌─────────────────────────────────────┐
│  Поделиться: report.docx           │
│─────────────────────────────────────│
│                                     │
│  🔍 Найти пользователя...          │
│  ┌─────────────────────────────┐    │
│  │ 👤 Ахмед К.    [Ред.] [✕]  │    │
│  │ 👤 Мария С.    [Просм.][✕] │    │
│  └─────────────────────────────┘    │
│                                     │
│  ☐ Открыть доступ всей группе      │
│                                     │
│  [ Сохранить ]     [ Отмена ]       │
└─────────────────────────────────────┘
```

### 5. Админ-панель
```
┌─────────────────────────────────────────────────────────┐
│  ⚙ Paylash Admin                           👤 Admin     │
├───────────┬─────────────────────────────────────────────┤
│           │                                             │
│ 📊 Обзор  │  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐      │
│           │  │  47  │ │  12  │ │ 156  │ │ 2.3GB│      │
│ 🏛 Факуль-│  │users │ │groups│ │files │ │used  │      │
│   теты    │  └──────┘ └──────┘ └──────┘ └──────┘      │
│           │                                             │
│ 📚 Курсы  │  Последние регистрации                      │
│           │  ──────────────────────────────────────      │
│ 👥 Группы │  👤 Ахмед К.    ТМ-21    2 мин. назад      │
│           │  👤 Мария С.    ИС-32    1 час назад       │
│ 👤 Пользо-│  👤 Олег Н.     ТМ-21    вчера             │
│   ватели  │                                             │
│           │                                             │
└───────────┴─────────────────────────────────────────────┘
```

### Анимации
- **Появление файлов**: `fadeInUp` с каскадным delay (stagger)
- **Hover на карточках**: `scale(1.02)` + тень, `transition: 0.2s ease`
- **Переходы между папками**: slide-анимация влево/вправо
- **Drag & Drop зона**: пульсирующая рамка при наведении
- **Модальные окна**: fade + scale от 0.95 к 1
- **Toast-уведомления**: slide-in справа + auto-dismiss
- **Sidebar**: collapsible с smooth transition
- **Loading**: skeleton shimmer
- **Каскадные selects**: fade-in при загрузке следующего уровня
- **Страницы**: crossfade transition при навигации

---

## Collabora Online — Совместная работа

### Как работает co-editing
1. **Пользователь A** открывает документ → получает WOPI-токен → Collabora загружает файл
2. **Пользователь B** (которому расшарили с правом "edit") открывает тот же документ → свой WOPI-токен
3. Collabora Online **нативно** объединяет сессии в один документ
4. Оба видят курсоры друг друга, изменения в реальном времени
5. Collabora сам управляет конфликтами и сохранением

### WOPI CheckFileInfo — ключевые поля для co-editing
```json
{
    "BaseFileName": "report.docx",
    "Size": 45231,
    "UserId": "user-42",
    "UserFriendlyName": "Ахмед К.",
    "UserCanWrite": true,
    "SupportsLocks": true,
    "SupportsUpdate": true,
    "EnableOwnerTermination": true
}
```

Каждый пользователь получает свой `UserId` + `UserFriendlyName` → Collabora отображает кто сейчас в документе.

---

## docker-compose.yml

```yaml
services:
  postgres:
    image: postgres:16-alpine
    container_name: paylash-db
    restart: unless-stopped
    environment:
      POSTGRES_DB: paylash
      POSTGRES_USER: paylash
      POSTGRES_PASSWORD: paylash_secret
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data

  minio:
    image: minio/minio:latest
    container_name: paylash-minio
    restart: unless-stopped
    command: server /data --console-address ":9001"
    environment:
      MINIO_ROOT_USER: paylash
      MINIO_ROOT_PASSWORD: paylash_secret
    ports:
      - "9000:9000"
      - "9001:9001"
    volumes:
      - minio_data:/data

  collabora:
    image: collabora/code:latest
    container_name: paylash-collabora
    restart: unless-stopped
    ports:
      - "9980:9980"
    environment:
      - server_name=localhost
      - extra_params=--o:ssl.enable=false --o:net.proto=IPv4
      - aliasgroup1=http://host.docker.internal:8080
    cap_add:
      - MKNOD
    extra_hosts:
      - "host.docker.internal:host-gateway"

volumes:
  postgres_data:
  minio_data:
```

---

## Запуск

```bash
# 1. Запустить всю инфраструктуру
docker-compose up -d

# 2. Запустить Paylash
go run main.go

# Или собрать бинарник
go build -o paylash.exe .
./paylash.exe

# Открыть в браузере: http://localhost:8080
# Админ по умолчанию: admin / admin123
# MinIO Console: http://localhost:9001 (paylash / paylash_secret)
```

### Конфигурация (env)
```
PAYLASH_PORT=8080
PAYLASH_DB_URL=postgres://paylash:paylash_secret@localhost:5432/paylash?sslmode=disable
PAYLASH_MINIO_ENDPOINT=localhost:9000
PAYLASH_MINIO_ACCESS_KEY=paylash
PAYLASH_MINIO_SECRET_KEY=paylash_secret
PAYLASH_MINIO_USE_SSL=false
PAYLASH_COLLABORA_URL=http://localhost:9980
PAYLASH_JWT_SECRET=change-me-in-production
```

---

## Хранилище в MinIO — Структура бакетов

```
MinIO
├── personal-{user_id}/          # Личное хранилище каждого юзера
│   ├── documents/report.docx
│   ├── photos/cat.jpg
│   └── ...
│
├── group-{group_id}/            # Хранилище группы (общий доступ)
│   ├── labs/lab1.docx
│   ├── lectures/math.pdf
│   └── ...
```

- Личные файлы → bucket `personal-{user_id}`
- Файлы группы → bucket `group-{group_id}`
- Квоты контролируются на уровне приложения (проверка перед upload)

---

## Ограничения и заметки
- Всё запускается локально через Docker — ничего не уходит в интернет
- PostgreSQL + MinIO + Collabora — 3 Docker-контейнера + Go-бинарник
- Совместное редактирование — нативная функция Collabora, не требует WebSocket на нашей стороне
- Go-бинарник со встроенным фронтендом = один файл для деплоя бэкенда
- Админ создаётся автоматически при первом запуске
