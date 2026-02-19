# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

`@kage0x3b/typeorm-seeding` — a TypeScript library for creating and seeding TypeORM entities using a factory/seeder pattern. ESM-only, targets Node 18+.

## Commands

```bash
pnpm build          # Build with tsdown (output: dist/)
pnpm watch          # Build in watch mode
pnpm test           # Run all tests (vitest)
pnpm vitest run test/factory-build.test.ts           # Run single test file
pnpm vitest run -t "builds a user entity in memory"  # Run single test by name
pnpm vitest                                          # Watch mode
eslint src/         # Lint (no script alias)
```

Package manager is **pnpm** (enforced). Node version: **24** (`.node-version`).

## Architecture

Four main components:

- **`Factory<T>`** (`src/Factory.ts`) — Abstract base. Subclasses define `model` (entity class) and `define(faker)` returning a `FactorySchema<T>`. Supports named variants, `buildOne`/`build` (in-memory), `persistOne`/`persist` (DB). Returns `AugmentedPromise<T>` with `.as(label)` for ref labeling.

- **`SeedingContext`** (`src/SeedingContext.ts`) — Created via `createSeedingContext(dataSource)`. Manages factory cache (singleton per class), sequence counters, temp IDs, labeled refs, creation log, and `cleanup()` (reverse-order deletion). `withTransaction(em)` creates child context for transaction support.

- **`SchemaResolver<T>`** (`src/resolver/SchemaResolver.ts`) — Internal 7-phase resolution engine: define → variants → overrides → simple descriptors → belongsTo → construct/save → hasMany/hasOne.

- **Descriptors** (`src/descriptors/`) — Tagged objects: `belongsTo()`, `hasMany()`, `hasOne()`, `sequence()`, `ref()`.

- **`Seeder`** (`src/Seeder.ts`) — Abstract base. Subclasses implement `run()`, access factories via `this.factory(FactoryClass)`.

## Key Conventions

- Source imports use `.js` extensions (Node16 module resolution)
- `reflect-metadata` must be imported before TypeORM decorators (test setup handles this)
- Factories are instantiated on-demand via `ctx.getFactory(FactoryClass)`, not registered upfront
- Entities must have no required constructor args (created via `new Model()` + `Object.assign`)
- `FactorySchema<T>` only covers plain data properties (excludes functions/symbols)
- TypeORM decorator metadata is used at runtime to resolve FK columns for relationships
- When making changes to source code, always apply corresponding updates to documentation (`docs/`, `README.md`, `SKILL.md`) and tests (`test/`)

## Code Style

Prettier: single quotes, 4-space indent, 120 char width, no trailing commas, semicolons.

## Build

Uses `tsdown` with SWC. ESM-only output (`.mjs`). Generates `.d.ts` declarations. Runs `publint` and `attw` checks.

## Tests

Vitest with SWC transpilation (`unplugin-swc`). Globals enabled (no imports needed for `describe`/`test`/`expect`). Tests use in-memory SQLite via `better-sqlite3`. Shared helper: `test/util/createTestDataSource.ts`.
