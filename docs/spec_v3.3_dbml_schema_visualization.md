# Spec v3.3 — DBML Schema Visualization

**Version:** 3.3  
**Status:** Draft  
**Author:** AI Assistant  
**Date:** 2025-07-18

---

## 1. Overview

Maintain database schema snapshots in **DBML format** (Database Markup Language) for
every migration. DBML files can be imported into [dbdiagram.io](https://dbdiagram.io)
for instant ER-diagram visualization.

Starting from migration **0021**, every migration that ships will have two companion
files:

| File | Purpose |
|---|---|
| `db/migrations/{NNN}_before.dbml` | Full schema **before** the migration runs |
| `db/migrations/{NNN}_after.dbml` | Full schema **after** the migration runs |

"Before" of migration *N* is always identical to "after" of migration *N − 1*.  
The first baseline (`0021_before.dbml`) captures the cumulative schema of
migrations 0001 – 0020.

---

## 2. Naming Convention

```
db/migrations/
  0021_basic_fractions_quiz_type.sql
  0021_before.dbml        ← schema as of 0020
  0021_after.dbml         ← schema after 0021
  0022_<name>.sql
  0022_before.dbml        ← copy of 0021_after.dbml
  0022_after.dbml
  ...
```

---

## 3. DBML Conventions

### 3.1 Project & database header

```dbml
Project OpenMath {
  database_type: 'PostgreSQL'
  Note: 'Schema after migration 0021 — basic_fractions_quiz_type'
}
```

### 3.2 Table definitions

- Use lowercase table names matching PostgreSQL.
- PK, NOT NULL, DEFAULT, CHECK constraints appear as column settings.
- Foreign keys use DBML `Ref:` syntax (placed after all tables).

### 3.3 Indexes

List indexes inside `indexes { }` blocks within each table.

### 3.4 Enums

Define CHECK-constraint sets as DBML `Enum` blocks for readability.

### 3.5 Views, functions, triggers

Include a comment block at the bottom of the file listing views, functions, and
triggers (DBML has no native syntax for these).

---

## 4. Highlighting Changed Tables

Tables that were **created or structurally modified** (columns added/dropped/altered,
constraints changed) by the migration are marked with a red header color:

```dbml
Table quiz_types [headercolor: #dc3545] {
  // ...
}
```

Tables that were **only affected by data changes** (INSERT / UPDATE / DELETE with no
DDL) are marked with an orange header color:

```dbml
Table quiz_types [headercolor: #fd7e14] {
  // ...
}
```

Unchanged tables keep the default header (no `headercolor`).

---

## 5. Data-Only Migrations

Some migrations (e.g., 0012, 0021) only insert or update data without altering
the schema structure. In those cases, the `before.dbml` and `after.dbml` files
will have **identical table definitions**, but the affected table(s) will be
highlighted orange in the "after" file and a DBML `Note` on the table will
describe the data change.

---

## 6. Current Schema Summary (as of migration 0020)

### Tables (14 + 1 view)

| # | Table | Created | Last DDL change |
|---|---|---|---|
| 1 | `users` | 0001 (as `students`) | 0016 (`locale` column) |
| 2 | `quiz_sessions` | 0001 | 0009 (column rename) |
| 3 | `questions` | 0001 | 0008 (relax constraints) |
| 4 | `answers` | 0001 | 0005 (JSONB columns) |
| 5 | `quiz_types` | 0002 | 0020 (`render_mode` column) |
| 6 | `roles` | 0010 | 0010 |
| 7 | `user_roles` | 0010 | 0010 |
| 8 | `teacher_students` | 0010 | 0015 (`created_at` default) |
| 9 | `parent_students` | 0010 | 0015 (`created_at` default) |
| 10 | `quiz_reviews` | 0010 | 0010 |
| 11 | `review_templates` | 0013 | 0017 (`locale` column) |
| 12 | `notifications` | 0014 | 0014 |
| 13 | `badges` | 0018 | 0018 |
| 14 | `user_badges` | 0019 | 0019 |

### Views

| View | Created |
|---|---|
| `student_associations` | 0015 |

### Functions / Triggers

| Object | Created |
|---|---|
| `check_max_parents()` function | 0011 |
| `trg_max_parents` trigger on `parent_students` | 0011 |

### Extensions

| Extension | Created |
|---|---|
| `pgcrypto` | 0001 |

---

## 7. Workflow for Future Migrations

When adding a new migration `{NNN}_{name}.sql`:

1. **Copy** the previous `{NNN-1}_after.dbml` → `{NNN}_before.dbml`.
2. **Copy** `{NNN}_before.dbml` → `{NNN}_after.dbml`.
3. **Edit** `{NNN}_after.dbml`:
   - Apply the DDL changes (add/remove columns, tables, indexes, etc.).
   - Set `headercolor: #dc3545` on structurally changed tables.
   - Set `headercolor: #fd7e14` on data-only-affected tables.
   - Update the `Project` note with the migration number and name.
4. **Commit** both DBML files alongside the SQL migration.

---

## 8. Tooling

- **dbdiagram.io** — paste DBML to get an interactive ER diagram.
- **dbdocs.io** — publish DBML as a hosted documentation page.
- **@dbml/cli** — `npm i -g @dbml/cli` for local DBML → SQL / SQL → DBML conversion.

---

## 9. Deliverables for This Spec

| File | Description |
|---|---|
| `db/migrations/0021_before.dbml` | Full schema as of migration 0020 (baseline) |
| `db/migrations/0021_after.dbml` | Schema after migration 0021 (data-only: `quiz_types` highlighted orange) |
