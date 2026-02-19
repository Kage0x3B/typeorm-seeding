# Public API Reference

## Factory Definition

### `Factory<T, V>` Abstract Class

The base class for all entity factories. `T` is the entity type, `V` is an optional union of variant names (defaults to `string`). Subclass it to define how entities are created.

```typescript
import { Factory, belongsTo, sequence, type Faker, type FactorySchema } from '@kage0x3b/typeorm-seeding';
import { UserEntity } from './entities/UserEntity';

export class UserFactory extends Factory<UserEntity, 'admin' | 'inactive' | 'withPets'> {
    readonly model = UserEntity;

    define(faker: Faker): FactorySchema<UserEntity> {
        return {
            firstName: faker.person.firstName(),
            lastName: faker.person.lastName(),
            email: faker.internet.email(),
            role: faker.helpers.arrayElement(['user', 'editor', 'viewer']),
            orderIndex: sequence((n) => n),
        };
    }
}
```

The `V` type parameter is optional. Factories without an explicit `V` continue to work — `V` defaults to `string`, accepting any variant name at the type level.

#### `readonly model`

Abstract property. Set this to the TypeORM entity class this factory creates.

#### `define(faker: Faker): FactorySchema<T>`

Abstract method. Returns an object containing scalar values and/or descriptors that define how to build each entity. Called once per entity creation. The `faker` instance is passed as an argument for convenience.

`FactorySchema<T>` maps each property of `T` to either its original type **or** a `Descriptor`. This is what allows you to return `belongsTo(...)`, `sequence(...)`, etc. alongside plain values.

#### `variants(): Record<V, Partial<FactorySchema<T>>>`

Optional override. Returns a map of named variations that layer on top of the base `define()` output. When `V` is narrowed (e.g. `'admin' | 'inactive' | 'withPets'`), only those keys are allowed.

```typescript
import { Factory, hasMany, type Faker, type FactorySchema } from '@kage0x3b/typeorm-seeding';
import { PetFactory } from './PetFactory';

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
            admin: {
                role: 'admin',
                email: 'admin@example.com',
            },
            inactive: {
                isActive: false,
            },
            withPets: {
                pets: hasMany(PetFactory, 3),
            },
        };
    }
}
```

### Relationship Example

```typescript
import { Factory, belongsTo } from '@kage0x3b/typeorm-seeding';
import { PetEntity } from './entities/PetEntity';
import { UserFactory } from './UserFactory';

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

---

## Factory Usage

All build and persist methods are **async** and return Promises.

### Building Entities (In-Memory)

#### `buildOne(overrides?): Promise<T>`

Creates a single entity in memory. Resolves all descriptors (including relationships) but does **not** persist anything to the database. Entities receive temporary auto-generated IDs (negative integers) so that relationships can be fully wired up without requiring a database round-trip.

```typescript
const ctx = createSeedingContext(dataSource);
const userFactory = ctx.getFactory(UserFactory);

const user = await userFactory.buildOne();
const customUser = await userFactory.buildOne({ firstName: 'Alice' });
```

#### `build(count, overrides?): Promise<T[]>`

Creates multiple entities in memory.

```typescript
const users = await userFactory.build(5);
const admins = await userFactory.build(3, { role: 'admin' });
```

### Persisting Entities (Saved to DB)

#### `persistOne(overrides?): Promise<T>`

Creates a single entity and saves it to the database, including any auto-created relationships.

```typescript
const user = await userFactory.persistOne();
const admin = await userFactory.persistOne({ role: 'admin' });
```

#### `persist(count, overrides?): Promise<T[]>`

Creates and persists multiple entities. Each entity is saved individually with its own relationships resolved per-entity.

```typescript
const users = await userFactory.persist(10);
```

### Variants

#### `variant(...names: V[]): this`

Returns a cloned factory instance with the specified variants applied. The return type is `this` (the concrete factory subclass), so chained calls preserve the full factory type. Variants are merged on top of the base `define()` output. Multiple variants can be combined. Throws an error if any of the specified variant names don't exist in the factory's `variants()` map. When `V` is narrowed, only valid variant names are accepted.

```typescript
const admin = await userFactory.variant('admin').persistOne();
const inactiveAdmin = await userFactory.variant('admin', 'inactive').persistOne();
const userWithPets = await userFactory.variant('withPets').persistOne();
```

### Overrides

Plain values in overrides replace descriptors entirely. This applies to both scalar fields and relationships.

```typescript
// Scalar override
const user = await userFactory.persistOne({ email: 'specific@test.com' });

// Relationship override: pass an existing entity to skip auto-creation
const existingOwner = await userFactory.persistOne();
const pet = await petFactory.persistOne({ owner: existingOwner });
```

---

## Descriptor Helpers

Descriptors are special objects returned within `define()` or `variants()` that describe how a field value should be resolved at build time.

### `belongsTo<F>(factoryRef, overridesOrEntity?, variant?)`

Declares a ManyToOne or owning-side OneToOne relationship. `F` is the factory type — the descriptor's entity type is inferred as `EntityOf<F>`, and valid variant names are constrained to `VariantName<F>`.

```typescript
// Auto-create a new parent
owner: belongsTo(UserFactory)

// Auto-create with overrides
owner: belongsTo(UserFactory, { role: 'admin' })

// Reference an existing entity (skips creation)
owner: belongsTo(UserFactory, existingUser)

// Auto-create using a specific variant
owner: belongsTo(UserFactory, undefined, 'admin')

// Variant with overrides
owner: belongsTo(UserFactory, { email: 'boss@test.com' }, 'admin')

// Multiple variants
owner: belongsTo(UserFactory, undefined, ['admin', 'inactive'])
```

The `variant` parameter accepts a single variant name or an array of variant names. When provided, the parent entity is created using the specified variant(s) of the referenced factory.

The second argument is disambiguated by checking for a primary key: if the object has a non-nullish primary key (detected via TypeORM metadata), it's treated as an existing entity; otherwise it's treated as factory overrides.

Each entity gets its **own** parent — there is no implicit sharing. If you build 5 pets each with `belongsTo(UserFactory)`, you get 5 separate users.

### `hasMany<F>(factoryRef, count, overrides?, variant?)`

Declares a OneToMany relationship. `F` is the factory type — overrides and variant names are type-checked against the referenced factory.

```typescript
// In define() or variants()
pets: hasMany(PetFactory, 3)

// With overrides applied to each child
pets: hasMany(PetFactory, 2, { species: 'dog' })

// Create children using a specific variant
pets: hasMany(PetFactory, 3, undefined, 'dog')

// Variant with overrides
pets: hasMany(PetFactory, 2, { name: 'Rex' }, 'dog')
```

`hasMany` can be used in both `define()` and `variants()`.

### `hasOne<F>(factoryRef, overrides?, variant?)`

Declares a non-owning OneToOne relationship. `F` is the factory type — overrides and variant names are type-checked against the referenced factory.

```typescript
profile: hasOne(ProfileFactory)
profile: hasOne(ProfileFactory, { bio: 'Custom bio' })

// Create child using a specific variant
profile: hasOne(ProfileFactory, undefined, 'detailed')
```

### `sequence<R>(callback)`

Provides an auto-incrementing counter scoped per factory class. The counter starts at 1 and increments with each entity built. `R` is the return type of the callback — within `FactorySchema<T>`, the return type must be assignable to the target field's type.

```typescript
orderIndex: sequence((n) => n)
username: sequence((n) => `user-${n}`)
email: sequence((n) => `user${n}@test.com`)
```

### `ref<V>(label)`

Resolves to a previously stored entity by its label. `V` is the expected entity type (phantom type for per-key checking). The entity must have been registered via `.as(label)` (see [Labeled Entity Refs](#labeled-entity-refs)) before the referencing entity is built.

```typescript
// In define() or variants()
company: ref('acmeCorp')
createdBy: ref('adminUser')
```

If the label has not been registered when the descriptor is resolved, an error is thrown.

---

## Type Helpers

### `FactorySchema<T>`

Maps each data property of `T` to either its original type **or** a type-compatible descriptor. Per-key type checking ensures that descriptors must match the field type:

- `sequence<R>` — `R` must be assignable to the field type
- `ref<V>` — `V` must be assignable to the field type
- `belongsTo<F>` — `EntityOf<F>` must be assignable to the field type (after `NonNullable`)
- `hasOne<F>` — `EntityOf<F>` must be assignable to the field type (after `NonNullable`)
- `hasMany<F>` — field type must be an array of `EntityOf<F>`

Only data properties are included (functions and symbol keys are excluded via `DataPropertyNames<T, K>`).

### `EntityOf<F>`

Extracts the entity type from a factory subclass.

```typescript
type User = EntityOf<UserFactory>; // UserEntity
```

### `VariantName<F>`

Extracts valid variant names from a factory subclass by inspecting the return type of `F['variants']`.

```typescript
type V = VariantName<UserFactory>; // 'admin' | 'inactive' | 'withPets'
```

---

## Context Store

The context store is a typed object for sharing well-known entities (like a current user or default company) across all factories and seeders. It uses TypeScript interface merging for full type safety.

### Declaring the Store Shape

Extend the `SeedingUserContext` interface via module augmentation:

```typescript
import { UserEntity } from './entities/UserEntity';
import { CompanyEntity } from './entities/CompanyEntity';

declare module '@kage0x3b/typeorm-seeding' {
    interface SeedingUserContext {
        currentUser: UserEntity;
        company: CompanyEntity;
    }
}
```

### Using the Store

The store is available on the context as `ctx.store`, and in factories via `this.ctx.store`.

```typescript
// In a seeder — populate the store
export class SetupSeeder extends Seeder {
    async run(): Promise<void> {
        this.ctx.store.company = await this.factory(CompanyFactory).persistOne();
        this.ctx.store.currentUser = await this.factory(UserFactory).persistOne({
            company: this.ctx.store.company,
            role: 'admin',
        });
    }
}

// In a factory — read from the store
export class ProjectFactory extends Factory<ProjectEntity> {
    readonly model = ProjectEntity;

    define(faker: Faker): FactorySchema<ProjectEntity> {
        return {
            name: faker.commerce.productName(),
            company: this.ctx.store.company,
            createdBy: this.ctx.store.currentUser,
        };
    }
}
```

Store values are plain values (not descriptors), so they are assigned directly without any resolution phase. The store is shared across all factories and seeders within the same context (and child contexts created via `withTransaction`).

> **Note:** The store starts as an empty object at runtime. TypeScript trusts that properties are populated before they are read. Ensure that seeders populating the store run before factories that consume it. Accessing an unpopulated store property will return `undefined` despite the non-optional type.

---

## Labeled Entity Refs

For ad-hoc entity references that don't warrant a dedicated store property, entities can be labeled and later looked up by name using `ref()`.

### `.as(label)` — Label an Entity

Chain `.as(label)` after `persistOne()` or `buildOne()` to register the resulting entity under a string label in the context's ref store. Only available on single-entity methods — not on `persist(n)` or `build(n)`.

```typescript
await userFactory.persistOne({ role: 'admin' }).as('adminUser');
await companyFactory.persistOne({ name: 'Acme Corp' }).as('acmeCorp');
```

`.as()` returns the entity itself (not a wrapper), so it can be used inline:

```typescript
const admin = await userFactory.persistOne().as('adminUser');
// admin is UserEntity, also stored under 'adminUser'
```

Throws an error if the label is already registered. Use `ctx.clearRefs()` to reset labels between tests.

### `ref(label)` — Reference a Labeled Entity

Use the `ref()` descriptor in `define()` or `variants()` to reference a labeled entity. It resolves at build time by looking up the label.

```typescript
export class InvoiceFactory extends Factory<InvoiceEntity> {
    readonly model = InvoiceEntity;

    define(faker: Faker): FactorySchema<InvoiceEntity> {
        return {
            amount: faker.number.float({ min: 10, max: 1000, fractionDigits: 2 }),
            company: ref('acmeCorp'),
            issuedBy: ref('adminUser'),
        };
    }
}
```

### `ctx.ref(label)` — Manual Lookup

Retrieve a labeled entity imperatively (outside of `define()`):

```typescript
const admin = ctx.ref<UserEntity>('adminUser');
const company = ctx.ref<CompanyEntity>('acmeCorp');
```

### `ctx.clearRefs()`

Clears all labeled refs. Use alongside `resetSequences()` for test isolation.

```typescript
beforeEach(() => {
    ctx.resetSequences();
    ctx.clearRefs();
});
```

### Store vs. Refs

| | Context Store (`ctx.store`) | Labeled Refs (`ref()`) |
|---|---|---|
| Type safety | Full — via interface merging | String-keyed, manual generic on `ctx.ref<T>()` |
| Best for | Well-known globals (currentUser, company) | Ad-hoc references between seeders/factories |
| Access in `define()` | `this.ctx.store.currentUser` (plain value) | `ref('adminUser')` (descriptor, resolved at build time) |
| Cleared by | Manual — reassign properties | `ctx.clearRefs()` |

---

## SeedingContext

The `SeedingContext` manages factory instances, sequence counters, and the database connection.

### `createSeedingContext(dataSource)`

Creates a new seeding context. This is the entry point for using the library.

```typescript
import { createSeedingContext } from '@kage0x3b/typeorm-seeding';

const ctx = createSeedingContext(dataSource);
```

**Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `dataSource` | `DataSource` | TypeORM 0.3+ DataSource instance |

### `ctx.getFactory<F>(FactoryClass): F`

Returns the cached factory instance for the given class, typed as the concrete factory subclass `F`. Creates it on first access.

```typescript
const userFactory = ctx.getFactory(UserFactory);
const petFactory = ctx.getFactory(PetFactory);
```

### `ctx.resetSequences()`

Resets all sequence counters back to zero. Use this between tests for isolation.

```typescript
beforeEach(() => {
    ctx.resetSequences();
});
```

### `ctx.withTransaction(em): SeedingContext`

Creates a child context that uses the provided EntityManager. The child context shares the factory cache with the parent but routes all persistence through the given EM. This is the mechanism for transaction support.

```typescript
await dataSource.transaction(async (em) => {
    const txCtx = ctx.withTransaction(em);
    await txCtx.getFactory(UserFactory).persistOne();
});
```

### `ctx.runSeeders(seeders)`

Runs an array of seeder classes in order.

```typescript
await ctx.runSeeders([DatabaseSeeder, TestDataSeeder]);
```

### `ctx.cleanup()`

Deletes all entities that were persisted through this context, in reverse creation order to respect foreign key constraints. This includes entities created by factories, seeders, and relationship resolution (auto-created parents from `belongsTo`, children from `hasMany`/`hasOne`).

```typescript
afterAll(async () => {
    await ctx.cleanup();
    await dataSource.destroy();
});
```

The context tracks every entity persisted via `em.save()` in an internal creation log. `cleanup()` iterates this log in reverse and deletes each entity. This is safer than truncating tables because it only removes entities the context created, leaving other test data or schema intact.

Child contexts (from `withTransaction`) share the creation log with their parent, so calling `cleanup()` on the parent context also covers entities created within transactions.

### `ctx.reset()`

Convenience method that combines `resetSequences()`, `clearRefs()`, and clears the creation log (without deleting from the database). Useful when you want a fresh context state without touching the DB.

```typescript
beforeEach(() => {
    ctx.reset();
});
```

---

## Transaction Support

Use `ctx.withTransaction(em)` to create a child context scoped to a transaction. All persistence within that child context uses the transaction's EntityManager.

```typescript
await dataSource.transaction(async (em) => {
    const txCtx = ctx.withTransaction(em);

    // All entities created here are part of the same transaction
    const user = await txCtx.getFactory(UserFactory).persistOne();
    const pets = await txCtx.getFactory(PetFactory).persist(3, { owner: user });

    // Seeders also run within the transaction
    await txCtx.runSeeders([DatabaseSeeder]);
});
// Transaction commits automatically, or rolls back on error
```

---

## Seeder Class

Seeders orchestrate factory calls to populate the database with structured data.

### `Seeder` Abstract Class

```typescript
import { Seeder } from '@kage0x3b/typeorm-seeding';

export class DatabaseSeeder extends Seeder {
    async run(): Promise<void> {
        // Populate the typed context store
        this.ctx.store.company = await this.factory(CompanyFactory).persistOne();

        // Create and label an admin for ad-hoc references
        this.ctx.store.currentUser = await this.factory(UserFactory)
            .variant('admin')
            .persistOne({ company: this.ctx.store.company })
            .as('adminUser');

        // Label additional entities for reference in other factories
        await this.factory(ProjectFactory).persistOne().as('defaultProject');

        // Create 10 regular users (all auto-tracked for cleanup)
        await this.factory(UserFactory).persist(10);

        // Create pets for the admin
        await this.factory(PetFactory).persist(3, {
            owner: this.ctx.store.currentUser,
        });
    }
}
```

#### `run(): Promise<void>`

Abstract method. Implement this to define your seeding logic.

#### `this.factory<F>(FactoryClass): F`

Convenience accessor that delegates to the seeder's context. Returns the concrete factory type `F`. Equivalent to `this.ctx.getFactory(FactoryClass)`.

### Running Seeders

```typescript
await ctx.runSeeders([DatabaseSeeder]);
```

Seeders run in the order provided. Each seeder receives the same context, so factories and sequence counters are shared across seeders.

---

## Test Setup Patterns

### Basic Setup (Jest / Vitest)

```typescript
import { DataSource } from 'typeorm';
import { createSeedingContext, SeedingContext } from '@kage0x3b/typeorm-seeding';
import { UserFactory } from './factories/UserFactory';
import { PetFactory } from './factories/PetFactory';

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
    await ctx.cleanup(); // deletes all created entities in reverse order
    await dataSource.destroy();
});
```

### Transaction-Per-Test Pattern

Wrap each test in a transaction that rolls back, so every test starts with a clean database without needing to truncate tables. No `cleanup()` needed since the transaction rolls back.

```typescript
let ctx: SeedingContext;

// ... beforeAll setup as above ...

let txCtx: SeedingContext;
let queryRunner: QueryRunner;

beforeEach(async () => {
    ctx.reset(); // resets sequences, refs, and creation log

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

### Cleanup-Per-Test Pattern

When you can't use transactions (e.g., testing code that manages its own transactions), use `cleanup()` to delete created entities between tests.

```typescript
afterEach(async () => {
    await ctx.cleanup(); // deletes entities in reverse creation order
    ctx.reset();
});
```
