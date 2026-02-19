# @kage0x3b/typeorm-seeding

[![npm version](https://img.shields.io/npm/v/@kage0x3b/typeorm-seeding.svg)](https://www.npmjs.com/package/@kage0x3b/typeorm-seeding)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

TypeScript-first factory and seeder library for TypeORM. Define how your entities are built, then create them in memory or persist them to the database with full relationship support.

## Features

- **Factory pattern** for declarative entity creation with Faker.js integration
- **Relationship descriptors** — `belongsTo`, `hasMany`, `hasOne` with automatic FK wiring
- **Named variants** for reusable entity presets (e.g. admin, inactive)
- **In-memory builds** or **database persistence** with automatic cleanup
- **Sequence counters** and **random selection** descriptors
- **Labeled refs** for cross-factory entity sharing
- **Typed context store** via module augmentation
- **Transaction support** with `withTransaction`
- **Seeder classes** for orchestrating structured data population
- ESM-only, TypeORM 0.3+, Node 18+

## Installation

```bash
npm install --save-dev @kage0x3b/typeorm-seeding
# or
pnpm add --save-dev @kage0x3b/typeorm-seeding
```

Peer dependencies: `typeorm` (^0.3.20) and `reflect-metadata` (^0.2.0).

You must import `reflect-metadata` once at your application entry point before any TypeORM entity imports:

```typescript
import 'reflect-metadata';
```

## Quick Start

Define a factory for your entity:

```typescript
import { Factory, sequence, type Faker, type FactorySchema } from '@kage0x3b/typeorm-seeding';
import { UserEntity } from './entities/UserEntity.js';

export class UserFactory extends Factory<UserEntity> {
    readonly model = UserEntity;

    define(faker: Faker): FactorySchema<UserEntity> {
        return {
            firstName: faker.person.firstName(),
            lastName: faker.person.lastName(),
            email: faker.internet.email(),
            role: faker.helpers.arrayElement(['user', 'editor', 'admin']),
            orderIndex: sequence((n) => n),
        };
    }
}
```

Create a seeding context and start building entities:

```typescript
import { createSeedingContext } from '@kage0x3b/typeorm-seeding';

const ctx = createSeedingContext(dataSource); // pass your TypeORM DataSource

const userFactory = ctx.getFactory(UserFactory);

// In-memory (no DB writes)
const user = await userFactory.buildOne();

// Persisted to the database
const savedUser = await userFactory.persistOne({ role: 'admin' });

// Multiple entities
const users = await userFactory.persist(10);
```

## Defining Factories

Every factory extends `Factory<T>` and defines two things:

- **`model`** — the TypeORM entity class
- **`define(faker)`** — returns a `FactorySchema<T>` mapping entity properties to values or descriptors

```typescript
export class PetFactory extends Factory<PetEntity> {
    readonly model = PetEntity;

    define(faker: Faker): FactorySchema<PetEntity> {
        return {
            name: faker.animal.petName(),
            species: faker.helpers.arrayElement(['dog', 'cat', 'bird']),
            owner: belongsTo(UserFactory),
        };
    }
}
```

`FactorySchema<T>` covers plain data properties of `T`. Each property can be either its original type or a descriptor.

## Descriptors

Descriptors are special objects returned within `define()` or `variants()` that control how field values are resolved at build time.

### `belongsTo<F>(factoryRef, overridesOrEntity?, variant?)`

Declares a ManyToOne or owning-side OneToOne relationship. Creates a parent entity and sets the foreign key automatically.

```typescript
owner: belongsTo(UserFactory)
owner: belongsTo(UserFactory, { role: 'admin' })
owner: belongsTo(UserFactory, existingUser) // skips creation
owner: belongsTo(UserFactory, undefined, 'admin') // use variant
```

Each entity gets its own parent — there is no implicit sharing. The optional `variant` parameter accepts a string or string array to create the parent using the specified variant(s).

### `hasMany<F>(factoryRef, count, overrides?, variant?)`

Declares a OneToMany relationship. Creates `count` child entities referencing back to the parent. Only valid on array fields.

```typescript
pets: hasMany(PetFactory, 3)
pets: hasMany(PetFactory, 2, { species: 'dog' })
pets: hasMany(PetFactory, 3, undefined, 'dog') // use variant
```

### `hasOne<F>(factoryRef, overrides?, variant?)`

Declares a non-owning OneToOne relationship. Creates a single child entity referencing back to the parent.

```typescript
profile: hasOne(ProfileFactory)
profile: hasOne(ProfileFactory, { bio: 'Custom bio' })
profile: hasOne(ProfileFactory, undefined, 'detailed') // use variant
```

### `sequence<R>(callback)`

Auto-incrementing counter scoped per factory class, starting at 1.

```typescript
orderIndex: sequence((n) => n)
email: sequence((n) => `user${n}@test.com`)
```

### `ref<V>(label)`

Resolves to a previously labeled entity (see [Labeled Refs](#labeled-refs)).

```typescript
company: ref('acmeCorp')
createdBy: ref('adminUser')
```

## Variants

Define named presets that layer on top of `define()`:

```typescript
export class UserFactory extends Factory<UserEntity, 'admin' | 'inactive' | 'withPets'> {
    readonly model = UserEntity;

    define(faker: Faker): FactorySchema<UserEntity> {
        return {
            firstName: faker.person.firstName(),
            lastName: faker.person.lastName(),
            email: faker.internet.email(),
            role: 'user',
            isActive: true,
        };
    }

    variants() {
        return {
            admin: { role: 'admin', email: 'admin@example.com' },
            inactive: { isActive: false },
            withPets: { pets: hasMany(PetFactory, 3) },
        };
    }
}
```

The second type parameter narrows the valid variant names. It's optional; factories without an explicit variant type default to `string`.

Use variants when building or persisting:

```typescript
const admin = await userFactory.variant('admin').persistOne();
const inactiveAdmin = await userFactory.variant('admin', 'inactive').persistOne();
```

Multiple variants can be combined — they are merged in order.

## Building vs Persisting

| Method | DB Write | Returns |
|--------|----------|---------|
| `buildOne(overrides?)` | No | `Promise<T>` |
| `build(count, overrides?)` | No | `Promise<T[]>` |
| `persistOne(overrides?)` | Yes | `Promise<T>` |
| `persist(count, overrides?)` | Yes | `Promise<T[]>` |

Built entities receive temporary negative IDs so relationships can be wired up without a database round-trip. Overrides accept plain values, `null`, or descriptors — pass a plain value or an existing entity to skip auto-creation, or use a descriptor for dynamic generation:

```typescript
// Use sequence() in an override for unique values per entity
const users = await userFactory.build(5, {
    email: sequence((n) => `batch-${n}@test.com`),
});

// Use belongsTo() in an override to auto-create a related entity
const pet = await petFactory.persistOne({
    owner: belongsTo(UserFactory, { role: 'admin' }),
});
```

## Seeding Context

`createSeedingContext` is the entry point for using the library.

```typescript
import { createSeedingContext } from '@kage0x3b/typeorm-seeding';

const ctx = createSeedingContext(dataSource);
```

### `ctx.getFactory(FactoryClass)`

Returns the cached factory instance for the given class, typed as the concrete factory subclass (e.g. `UserFactory`, not `Factory<UserEntity>`).

### `ctx.resetSequences()`

Resets all sequence counters back to zero. Use between tests for isolation.

### `ctx.clearRefs()`

Clears all labeled refs.

### `ctx.reset()`

Combines `resetSequences()`, `clearRefs()`, and clears the creation log (without deleting from the database).

### `ctx.cleanup()`

Deletes all entities persisted through this context in reverse creation order, respecting foreign key constraints.

### `ctx.runSeeders(seeders)`

Runs an array of seeder classes in order.

## Seeders

Seeders orchestrate factory calls to populate the database with structured data:

```typescript
import { Seeder } from '@kage0x3b/typeorm-seeding';

export class DatabaseSeeder extends Seeder {
    async run(): Promise<void> {
        const admin = await this.factory(UserFactory)
            .variant('admin')
            .persistOne()
            .as('adminUser');

        await this.factory(UserFactory).persist(10);

        await this.factory(PetFactory).persist(3, { owner: admin });
    }
}
```

Run seeders via the context:

```typescript
await ctx.runSeeders([DatabaseSeeder]);
```

Seeders run in order and share the same context, so factories and sequence counters carry across seeders.

## Labeled Refs

Chain `.as(label)` after `persistOne()` or `buildOne()` to register an entity under a string label:

```typescript
await userFactory.persistOne({ role: 'admin' }).as('adminUser');
await companyFactory.persistOne({ name: 'Acme Corp' }).as('acmeCorp');
```

Reference labeled entities in factory definitions with `ref()`:

```typescript
define(faker: Faker): FactorySchema<InvoiceEntity> {
    return {
        amount: faker.number.float({ min: 10, max: 1000, fractionDigits: 2 }),
        company: ref('acmeCorp'),
        issuedBy: ref('adminUser'),
    };
}
```

Or look them up imperatively:

```typescript
const admin = ctx.ref<UserEntity>('adminUser');
```

## Context Store

For well-known shared entities (like a current user), use the typed context store via module augmentation:

```typescript
declare module '@kage0x3b/typeorm-seeding' {
    interface SeedingUserContext {
        currentUser: UserEntity;
        company: CompanyEntity;
    }
}
```

Populate it in seeders, read it in factories:

```typescript
// Seeder
this.ctx.store.company = await this.factory(CompanyFactory).persistOne();

// Factory
define(faker: Faker): FactorySchema<ProjectEntity> {
    return {
        name: faker.commerce.productName(),
        company: this.ctx.store.company,
    };
}
```

## Transaction Support

Use `ctx.withTransaction(em)` to create a child context scoped to a transaction:

```typescript
await dataSource.transaction(async (em) => {
    const txCtx = ctx.withTransaction(em);
    const user = await txCtx.getFactory(UserFactory).persistOne();
    const pets = await txCtx.getFactory(PetFactory).persist(3, { owner: user });
});
```

The child context shares the factory cache and creation log with the parent but routes all persistence through the given EntityManager.

## Test Setup

### Basic Setup

```typescript
import { DataSource } from 'typeorm';
import { createSeedingContext, type SeedingContext } from '@kage0x3b/typeorm-seeding';

let dataSource: DataSource;
let ctx: SeedingContext;

beforeAll(async () => {
    dataSource = new DataSource({
        type: 'sqlite',
        database: ':memory:',
        entities: [UserEntity, PetEntity],
        synchronize: true,
    });
    await dataSource.initialize();

    ctx = createSeedingContext(dataSource);
});

beforeEach(() => {
    ctx.resetSequences();
    ctx.clearRefs();
});

afterAll(async () => {
    await ctx.cleanup();
    await dataSource.destroy();
});
```

### Transaction-Per-Test Pattern

Wrap each test in a transaction that rolls back for a clean database without truncation:

```typescript
let txCtx: SeedingContext;
let queryRunner: QueryRunner;

beforeEach(async () => {
    ctx.reset();
    queryRunner = dataSource.createQueryRunner();
    await queryRunner.startTransaction();
    txCtx = ctx.withTransaction(queryRunner.manager);
});

afterEach(async () => {
    await queryRunner.rollbackTransaction();
    await queryRunner.release();
});

it('creates a user with pets', async () => {
    const user = await txCtx.getFactory(UserFactory).variant('withPets').persistOne();
    expect(user.pets).toHaveLength(3);
});
```

## AI Agent Skill

This repository includes a skill file (`SKILL.md`) that helps AI coding agents create and edit factories, seeders, relationship descriptors, variants, and test setup for this library.

Install it with:

```bash
npx skills install @kage0x3b/typeorm-seeding
```

## Acknowledgements

This project was built with assistance from [Claude Code](https://claude.ai/code). All generated code has been thoroughly reviewed, the library has 100% test coverage, and it is actively used in internal projects.

## License

MIT
