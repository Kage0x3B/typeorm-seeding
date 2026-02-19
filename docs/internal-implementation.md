# Internal Architecture

## Descriptor System

Descriptors are tagged objects that represent deferred computations. They are returned from helper functions like `belongsTo()`, `sequence()`, etc. and resolved later by the `SchemaResolver`.

### `DESCRIPTOR_TAG` Symbol

A unique symbol used to tag all descriptor objects, allowing the resolver to distinguish descriptors from plain values.

```typescript
const DESCRIPTOR_TAG = Symbol('DESCRIPTOR_TAG');
```

### `BaseDescriptor` Interface

All descriptors share this base shape:

```typescript
interface BaseDescriptor {
    [DESCRIPTOR_TAG]: true;
    kind: string; // discriminant for the descriptor type
}
```

### Descriptor Interfaces

All relationship and value descriptors carry a generic type parameter `V` that enables per-field type checking in `FactorySchema<T>`.

```typescript
interface BelongsToDescriptor<V = any> extends BaseDescriptor {
    kind: 'belongsTo';
    factoryRef: Constructable<Factory<V, any>>;
    overridesOrEntity?: FactoryOverrides<any> | object;
    variants?: string[];
}

interface HasManyDescriptor<V = any> extends BaseDescriptor {
    kind: 'hasMany';
    factoryRef: Constructable<Factory<V, any>>;
    count: number;
    overrides?: FactoryOverrides<any>;
    variants?: string[];
}

interface HasOneDescriptor<V = any> extends BaseDescriptor {
    kind: 'hasOne';
    factoryRef: Constructable<Factory<V, any>>;
    overrides?: FactoryOverrides<any>;
    variants?: string[];
}

interface SequenceDescriptor<R = any> extends BaseDescriptor {
    kind: 'sequence';
    callback: (n: number) => R;
}

interface RefDescriptor<V = any> extends BaseDescriptor {
    kind: 'ref';
    label: string;
    /** @internal Type-level only — not set at runtime. */
    readonly __resolvedType?: V;
}
```

The `V` / `R` parameters flow through `FactorySchema<T>` via `FieldDescriptor<V>` to enforce that each descriptor's resolved type matches the field it is assigned to. `RefDescriptor` uses a phantom `__resolvedType` property (never set at runtime) to carry its type information.

The `V` parameter on relationship descriptors uses `Factory<V, any>` (not `Factory<V>`) to correctly handle Factory subclasses with typed variant names. Since `Factory<T, V>` is invariant in `V`, a factory like `UserFactory extends Factory<UserEntity, 'admin' | 'withPets'>` would not be assignable to `Constructable<Factory<UserEntity>>` (which is `Constructable<Factory<UserEntity, string>>`). Using `Factory<V, any>` avoids this — we only care about the entity type, not the variant names.

### `FactorySchema<T>` — Per-Key Type Checking

```typescript
type FieldDescriptor<V> =
    | SequenceDescriptor<V>
    | RefDescriptor<V>
    | BelongsToDescriptor<NonNullable<V>>
    | HasOneDescriptor<NonNullable<V>>
    | (NonNullable<V> extends (infer E)[] ? HasManyDescriptor<E> : never);

type FactorySchema<T> = {
    [K in keyof T as DataPropertyNames<T, K>]?: T[K] | FieldDescriptor<T[K]>;
};
```

`FieldDescriptor<V>` is a mapped union that constrains which descriptor types are valid for a field of type `V`. For example, `belongsTo<F>` on a field of type `UserEntity` requires `EntityOf<F>` to match `UserEntity`. `HasManyDescriptor` is only valid when `V` is an array type. `DataPropertyNames<T, K>` filters out function and symbol keys.

### Utility Types

```typescript
/** Extract the entity type T from a Factory<T, V> subclass */
type EntityOf<F extends Factory<any, any>> = F extends Factory<infer T, any> ? T : never;

/** Extract valid variant names from a Factory subclass's variants() return type */
type VariantName<F extends Factory<any, any>> = keyof ReturnType<F['variants']> & string;
```

These are used by the descriptor helper functions to infer the factory type and provide type-checked overrides and variant names.

### `isDescriptor()` Type Guard

```typescript
function isDescriptor(value: unknown): value is BaseDescriptor {
    return (
        typeof value === 'object' &&
        value !== null &&
        DESCRIPTOR_TAG in value &&
        value[DESCRIPTOR_TAG] === true
    );
}
```

---

## SchemaResolver

The `SchemaResolver` is the core resolution engine. It takes a factory's raw schema output and resolves it into a fully populated entity. Resolution happens in ordered phases to ensure dependencies (like parent entities for foreign keys) are available when needed.

### Resolution Phases

#### Phase 1: Call `define(faker)`

Invoke the factory's `define()` method to get the raw schema — an object containing a mix of plain values and descriptors.

```typescript
const rawSchema = factory.define(faker);
// { firstName: 'Alice', role: 'admin', owner: belongsTo(UserFactory) }
```

#### Phase 2: Merge Variants

If the factory has active variants (set via `.variant()`), look up each variant name in `factory.variants()`. If any name is missing, throw an error. Merge each variant's partial schema on top of the base schema in order.

```typescript
const variantData = factory.variants()['admin'];
if (!variantData) throw new Error(`Unknown variant "admin" on ${factory.constructor.name}`);
const schema = { ...rawSchema, ...variantData };
```

#### Phase 3: Apply User Overrides

Merge user-provided overrides on top. Plain values replace descriptors entirely — if a user passes `{ owner: existingUser }`, the `belongsTo` descriptor is discarded and the existing entity is used directly.

```typescript
const schema = { ...mergedSchema, ...userOverrides };
```

#### Phase 4: Resolve Simple Descriptors

Iterate over the schema and resolve descriptors that don't involve database operations:

- **`sequence`**: Call `context.nextSequence(FactoryClass)` to get the next counter value, pass it to the callback
- **`ref`**: Look up `context.ref(label)` — throws if the label is not registered

#### Phase 5: Resolve `belongsTo` Relationships

For each `belongsTo` descriptor:

1. Get the factory class: `const FactoryClass = descriptor.factoryRef`
2. Get the factory instance from context: `ctx.getFactory(FactoryClass)`
3. If `descriptor.variants` is set, call `factory.variant(...descriptor.variants)` to get a variant clone
4. Disambiguate the second argument: use TypeORM metadata to find the target entity's primary key columns. If the object has non-nullish values for all PK columns, treat it as an existing entity. Otherwise, treat it as factory overrides.
4. If existing entity, use it directly
5. Otherwise, call `persistOne(overrides)` or `buildOne(overrides)` (matching the caller's mode) on the parent factory
6. Use TypeORM metadata to find the FK column name and set it on the entity:
   ```
   entity[fkColumnName] = parent.id
   entity[relationPropertyName] = parent
   ```

#### Phase 6: Construct and Save Entity

1. Construct the entity: `new Model()`
2. Assign all resolved values: `Object.assign(entity, resolvedSchema)`
3. If persisting, save via the EntityManager: `em.save(entity)`, then append to the creation log
4. If building (not persisting), assign temporary IDs to all PK columns that are still null (decrementing negative integers from a per-context counter) so that relationships in Phase 7 can reference the entity. For compound PKs, each column gets its own temp ID.

#### Phase 7: Resolve `hasMany` / `hasOne` Relationships

These are resolved **after** the parent entity is saved (so the parent's ID is available):

- **`hasMany`**: Get the child factory, apply `descriptor.variants` if set via `factory.variant(...)`, then create `count` child entities with the parent as an override for the inverse relation
- **`hasOne`**: Get the child factory, apply `descriptor.variants` if set via `factory.variant(...)`, then create a single child entity referencing the parent

```typescript
// For hasMany, the parent entity is passed as an override to the child factory,
// replacing any belongsTo descriptor on the child's inverse relation.
const children = await childFactory.persist(count, {
    [inverseRelationName]: parentEntity,
    ...overrides,
});
entity[relationPropertyName] = children;
```

---

## Circular Relationship Prevention

When a `UserFactory` defines `hasMany(PetFactory)` and `PetFactory` defines `belongsTo(UserFactory)`, naive resolution would create an infinite loop.

The solution: when resolving `hasMany` children, the **parent entity is passed as an override** for the child's inverse relation. Since user overrides replace descriptors (Phase 3), the child's `belongsTo` descriptor is replaced with the actual parent entity, breaking the cycle.

```
User.define() → hasMany(PetFactory, 3)
  ↓ resolve hasMany: create 3 pets with { owner: thisUser }
    ↓ Pet.define() → belongsTo(UserFactory)
      ↓ override { owner: thisUser } replaces the descriptor
      ↓ no new User is created — cycle broken
```

The same mechanism applies to `hasOne` — the parent entity is passed as an override for the inverse relation on the child.

---

## TypeORM Metadata Usage

The resolver uses TypeORM's metadata system to discover relationship structure and foreign key column names, eliminating the need for manual FK configuration.

### Finding FK Columns for `belongsTo`

```typescript
const metadata = dataSource.getMetadata(ChildModel);
const relation = metadata.findRelationWithPropertyPath('owner');
// relation.joinColumns contains the FK column mappings — may have multiple entries for compound FKs
for (const joinColumn of relation.joinColumns) {
    const fkPropertyName = joinColumn.propertyName; // e.g., 'ownerId'
    const parentPkName = joinColumn.referencedColumn?.propertyName; // e.g., 'id'
}
```

This allows the resolver to set both the relation property and all FK columns. For simple single-column FKs:

```typescript
entity.owner = parentEntity;
entity.ownerId = parentEntity.id; // auto-detected via joinColumns[].propertyName
```

For compound FKs (e.g., a join-table entity with multiple `belongsTo` relations), the resolver iterates all join columns and sets each FK scalar to the corresponding parent PK value.

### Finding Inverse Relations for `hasMany`

```typescript
const metadata = dataSource.getMetadata(ParentModel);
const relation = metadata.findRelationWithPropertyPath('pets');
const inversePropertyName = relation.inverseSidePropertyPath; // e.g., 'owner'
```

This tells the resolver which property on the child entity should receive the parent reference when creating `hasMany` children.

---

## SeedingContext Internals

### Factory Instance Cache

```typescript
// Map<Constructor<Factory>, Factory>
private factoryCache = new Map();
```

When `getFactory(UserFactory)` is called:
1. Check the cache for an existing instance
2. If not found, instantiate `new UserFactory()`, inject the context, cache it
3. Return the cached instance

### Sequence Counters

```typescript
// Map<Constructor<Factory>, number>
private sequenceCounters = new Map();
```

Counters are scoped per factory class. `nextSequence(UserFactory)` increments and returns the counter for `UserFactory`. `resetSequences()` clears the entire map.

### Temporary ID Counter

```typescript
private tempIdCounter = -1;
```

Used in build mode (non-persisting) to assign temporary IDs to entities so that relationship wiring works without a database. `nextTempId()` returns the current value and decrements. Negative IDs are easily distinguishable from real database IDs. Reset by `reset()`.

### Context Store

```typescript
// SeedingUserContext is an empty interface users extend via module augmentation
store: SeedingUserContext;
```

Initialized as a plain empty object. Users extend the `SeedingUserContext` interface via `declare module` to get type-safe properties. Values are read directly in factories (no descriptor resolution needed).

### Labeled Ref Store

```typescript
// Map<string, unknown>
private refStore = new Map();
```

Populated by `.as(label)` on the promise returned from `persistOne()`/`buildOne()`. The `.as()` method is added by wrapping the returned promise with a custom `.as()` that registers the resolved entity in the context's ref store and then returns the entity.

```typescript
// Simplified implementation of the .as() augmentation
const originalPromise = factory.persistOne(overrides);
const augmented = originalPromise.then((entity) => entity);
augmented.as = (label: string) => originalPromise.then((entity) => {
    context.setRef(label, entity);
    return entity;
});
return augmented;
```

`ctx.ref<T>(label)` retrieves from this map with a type cast. Throws if the label is not registered. `setRef(label, entity)` throws if the label already exists (strict — no silent overwriting). `ctx.clearRefs()` clears the map.

### Creation Log

```typescript
// Array<{ model: Constructable, entity: object }>
private creationLog: Array<{ model: Constructable<any>; entity: any }> = [];
```

Every time the resolver calls `em.save(entity)`, the entity and its model class are appended to the creation log. This happens for:
- The primary entity being built
- Auto-created parent entities (from `belongsTo`)
- Auto-created child entities (from `hasMany`/`hasOne`)

`cleanup()` iterates the log in **reverse order** and calls `em.remove(entity)` for each entry. Reverse order ensures children are deleted before parents, respecting FK constraints.

```typescript
async cleanup(): Promise<void> {
    for (let i = this.creationLog.length - 1; i >= 0; i--) {
        const { entity } = this.creationLog[i];
        await this.em.remove(entity);
    }
    this.creationLog = [];
}
```

`reset()` clears the creation log (without deleting from DB), along with sequences and refs.

### `withTransaction(em)`

Creates a **child context** that:
- Shares the same factory cache as the parent (factories aren't re-instantiated)
- Uses the given EntityManager for all persistence operations
- Shares the creation log with the parent (so `cleanup()` on the parent covers transaction-created entities)
- Shares the ref store and context store with the parent

This is how transaction support works: the child context routes all `em.save()` calls through the transaction's EntityManager.

### EntityManager Propagation

When the resolver creates related entities (via `belongsTo`, `hasMany`, `hasOne`), it always uses the same EntityManager from the context. This ensures that in a transaction scenario, all related entities are saved within the same transaction.

```
ctx.withTransaction(txEm)
  → resolver uses txEm
    → belongsTo creates parent via txEm
    → hasMany creates children via txEm
    → all in the same transaction
```

---

## Factory Class Internals

### Variant Cloning

`variant()` creates a shallow clone of the factory with the requested variant names stored:

```typescript
variant(...names: V[]): this {
    const clone = Object.create(Object.getPrototypeOf(this));
    Object.assign(clone, this);
    clone._activeVariants = [...this._activeVariants, ...names];
    return clone;
}
```

The return type is `this` (not `Factory<T>`), so chained calls preserve the concrete factory type. `names` is typed as `V[]` — when `V` is narrowed (e.g. `'admin' | 'withPets'`), only valid variant names are accepted.

The clone shares the same context reference, so sequence counters remain consistent. The `_activeVariants` array is read by the resolver during Phase 2 to merge variant data. If any name in `_activeVariants` is not present as a key in the factory's `variants()` return value, the resolver throws an error at resolution time (fail fast on typos).

### Context Injection

When `SeedingContext.getFactory()` creates a factory instance, it injects itself:

```typescript
const factory = new FactoryClass();
factory._internalCtx = this;
```

The factory uses this context to access `getFactory()` (for relationship resolution) and `nextSequence()` (for sequence descriptors).

### `nextSequence()` Delegation

```typescript
nextSequence(): number {
    return this.context.nextSequence(this.constructor);
}
```

Delegates to the context's per-factory counter, ensuring sequences are consistent regardless of how many factory clones (from `.variant()`) exist.

---

## File Structure

```
src/
    index.ts                    # Public re-exports
    Factory.ts                  # Factory<T, V> abstract class
    SeedingContext.ts            # Context, factory cache, sequence counters
    Seeder.ts                   # Seeder abstract class
    descriptors/
        types.ts                # DESCRIPTOR_TAG, BaseDescriptor, all descriptor interfaces (incl. RefDescriptor)
        helpers.ts              # belongsTo(), hasMany(), hasOne(), sequence(), ref()
        index.ts                # Re-exports
    resolver/
        SchemaResolver.ts       # Resolution engine (phases 1-7)
        index.ts                # Re-exports
    types/
        FactorySchema.ts        # Type for define() return value (per-key FieldDescriptor<V>)
        FactoryOverrides.ts     # Override type for build/persist (values, null, or descriptors)
        FactoryUtilTypes.ts     # EntityOf<F>, VariantName<F>
        DataPropertyNames.ts    # DataPropertyNames<T, K> — filters function/symbol keys
        EntityData.ts           # Partial entity type (excludes functions/symbols)
        Constructable.ts        # Generic zero-arg constructor type
        SeedingUserContext.ts    # Empty interface for module augmentation
        index.ts                # Re-exports
```

### Module Boundaries

- **`descriptors/`**: Pure data structures and helper functions. No TypeORM or context dependencies.
- **`resolver/`**: Depends on descriptors, TypeORM metadata, and SeedingContext. This is where all the resolution logic lives.
- **`types/`**: Shared TypeScript types. No runtime code.
- **`Factory.ts`**: Depends on descriptors (for return types) and SeedingContext (injected at runtime).
- **`SeedingContext.ts`**: Depends on Factory, Seeder, and the resolver. Orchestrates everything.
- **`Seeder.ts`**: Minimal — depends only on SeedingContext for the `factory()` convenience method.
