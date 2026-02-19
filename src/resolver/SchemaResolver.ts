import type { Faker } from '@faker-js/faker';
import { EntityMetadataNotFoundError } from 'typeorm';
import type { Factory } from '../Factory.js';
import type { SeedingContext } from '../SeedingContext.js';
import type { Constructable } from '../types/Constructable.js';
import type { FactoryOverrides } from '../types/FactoryOverrides.js';
import {
    isDescriptor,
    type BelongsToDescriptor,
    type HasManyDescriptor,
    type HasOneDescriptor
} from '../descriptors/types.js';

export class SchemaResolver<T> {
    constructor(
        private readonly _factory: Factory<T, any>,
        private readonly _ctx: SeedingContext,
        private readonly _faker: Faker,
        private readonly _persist: boolean
    ) {}

    public async resolve(overrides?: FactoryOverrides<T>): Promise<T> {
        // Phase 1: Call define(faker)
        const rawSchema = this._factory.define(this._faker);

        // Phase 2: Merge variants
        let schema: Record<string, any> = { ...rawSchema };
        const activeVariants = this._factory._internalActiveVariants;
        if (activeVariants.length > 0) {
            const variantMap = this._factory.variants();
            for (const name of activeVariants) {
                const variantData = variantMap[name];
                if (!variantData) {
                    throw new Error(
                        `Unknown variant "${name}" on ${this._factory.constructor.name}. ` +
                            `Available variants: ${Object.keys(variantMap).join(', ') || '(none)'}`
                    );
                }
                schema = { ...schema, ...variantData };
            }
        }

        // Phase 3: Apply user overrides
        if (overrides) {
            schema = { ...schema, ...overrides };
        }

        // Phase 4: Resolve simple descriptors
        const deferredBelongsTo: Array<{ key: string; descriptor: BelongsToDescriptor }> = [];
        const deferredHasMany: Array<{ key: string; descriptor: HasManyDescriptor }> = [];
        const deferredHasOne: Array<{ key: string; descriptor: HasOneDescriptor }> = [];

        for (const [key, value] of Object.entries(schema)) {
            if (!isDescriptor(value)) continue;

            switch (value.kind) {
                case 'sequence': {
                    const n = this._ctx.nextSequence(this._factory.constructor as Constructable<Factory<any>>);
                    schema[key] = value.callback(n);
                    break;
                }
                case 'ref':
                    schema[key] = this._ctx.ref(value.label);
                    break;
                case 'belongsTo':
                    deferredBelongsTo.push({ key, descriptor: value });
                    delete schema[key];
                    break;
                case 'hasMany':
                    deferredHasMany.push({ key, descriptor: value });
                    delete schema[key];
                    break;
                case 'hasOne':
                    deferredHasOne.push({ key, descriptor: value });
                    delete schema[key];
                    break;
            }
        }

        // Phase 5: Resolve belongsTo relationships
        for (const { key, descriptor } of deferredBelongsTo) {
            const FactoryClass = descriptor.factoryRef;
            let parentFactory: Factory<any> = this._ctx.getFactory(FactoryClass);
            if (descriptor.variants?.length) {
                parentFactory = parentFactory.variant(...descriptor.variants);
            }
            let parent: any;

            if (descriptor.overridesOrEntity) {
                const isExisting = this._hasNonNullPrimaryKey(parentFactory.model, descriptor.overridesOrEntity);
                if (isExisting) {
                    parent = descriptor.overridesOrEntity;
                } else {
                    if (this._persist) {
                        parent = await parentFactory.persistOne(descriptor.overridesOrEntity as FactoryOverrides<any>);
                    } else {
                        parent = await parentFactory.buildOne(descriptor.overridesOrEntity as FactoryOverrides<any>);
                    }
                }
            } else {
                if (this._persist) {
                    parent = await parentFactory.persistOne();
                } else {
                    parent = await parentFactory.buildOne();
                }
            }

            schema[key] = parent;
            this._setForeignKey(schema, key, parent);
        }

        // Phase 6: Construct and save entity
        const entity = new this._factory.model();
        Object.assign(entity as object, schema);

        if (this._persist) {
            // Snapshot relation objects before save — em.save() may strip them
            const relationSnapshot = new Map<string, any>();
            for (const { key } of deferredBelongsTo) {
                relationSnapshot.set(key, (entity as any)[key]);
            }

            const em = this._ctx.getEntityManager();
            await em.save(entity);

            // Restore relation objects that em.save() may have stripped
            for (const [key, value] of relationSnapshot) {
                (entity as any)[key] = value;
            }

            this._ctx.logCreation(this._factory.model, entity);
        } else {
            for (const pkColumn of this._getPrimaryKeyPropertyNames(this._factory.model)) {
                if ((entity as any)[pkColumn] == null) {
                    (entity as any)[pkColumn] = this._ctx.nextTempId();
                }
            }
        }

        // Phase 7: Resolve hasMany / hasOne
        for (const { key, descriptor } of deferredHasMany) {
            const ChildFactoryClass = descriptor.factoryRef;
            let childFactory: Factory<any> = this._ctx.getFactory(ChildFactoryClass);
            if (descriptor.variants?.length) {
                childFactory = childFactory.variant(...descriptor.variants);
            }
            const inverseRelation = this._getInverseRelationName(this._factory.model, key);

            const childOverrides: any = {
                /* v8 ignore next -- only falsy for unidirectional relations */
                ...(inverseRelation ? { [inverseRelation]: entity } : {}),
                ...(descriptor.overrides ?? {})
            };

            let children: any[];
            if (this._persist) {
                children = await childFactory.persist(descriptor.count, childOverrides);
            } else {
                children = await childFactory.build(descriptor.count, childOverrides);
            }
            (entity as any)[key] = children;
        }

        for (const { key, descriptor } of deferredHasOne) {
            const ChildFactoryClass = descriptor.factoryRef;
            let childFactory: Factory<any> = this._ctx.getFactory(ChildFactoryClass);
            if (descriptor.variants?.length) {
                childFactory = childFactory.variant(...descriptor.variants);
            }
            const inverseRelation = this._getInverseRelationName(this._factory.model, key);

            const childOverrides: any = {
                /* v8 ignore next -- only falsy for unidirectional relations */
                ...(inverseRelation ? { [inverseRelation]: entity } : {}),
                ...(descriptor.overrides ?? {})
            };

            let child: any;
            if (this._persist) {
                child = await childFactory.persistOne(childOverrides);
            } else {
                child = await childFactory.buildOne(childOverrides);
            }
            (entity as any)[key] = child;
        }

        return entity;
    }

    private _hasNonNullPrimaryKey(Model: Constructable<any>, obj: any): boolean {
        try {
            const metadata = this._ctx.getDataSource().getMetadata(Model);
            /* v8 ignore next -- TypeORM entities always have primary columns */
            if (metadata.primaryColumns.length === 0) return false;
            return metadata.primaryColumns.every((col) => obj[col.propertyName] != null);
        } catch (e) {
            /* v8 ignore next */
            if (e instanceof EntityMetadataNotFoundError) {
                return false;
            }

            /* v8 ignore next */
            throw e;
        }
    }

    private _getPrimaryKeyPropertyNames(Model: Constructable<any>): string[] {
        try {
            const metadata = this._ctx.getDataSource().getMetadata(Model);
            return metadata.primaryColumns.map((col) => col.propertyName);
        } catch (error) {
            /* v8 ignore next */
            if (error instanceof EntityMetadataNotFoundError) {
                return [];
            }

            /* v8 ignore next */
            throw error;
        }
    }

    private _setForeignKey(schema: Record<string, any>, relationProperty: string, parent: any): void {
        try {
            const metadata = this._ctx.getDataSource().getMetadata(this._factory.model);
            const relation = metadata.findRelationWithPropertyPath(relationProperty);
            /* v8 ignore next -- only falsy for non-owning or unidirectional relations */
            if (relation && relation.joinColumns.length > 0) {
                for (const joinColumn of relation.joinColumns) {
                    const fkPropertyName = joinColumn.propertyName;
                    const parentPkName = joinColumn.referencedColumn?.propertyName;
                    // Only set FK if it's a separate property from the relation itself
                    if (fkPropertyName && parentPkName && fkPropertyName !== relationProperty) {
                        schema[fkPropertyName] = parent[parentPkName];
                    }
                }
            }
        } catch (error) {
            /* v8 ignore next */
            if (error instanceof EntityMetadataNotFoundError) {
                return;
            }

            /* v8 ignore next */
            throw error;
        }
    }

    private _getInverseRelationName(Model: Constructable<any>, propertyName: string): string | null {
        try {
            const metadata = this._ctx.getDataSource().getMetadata(Model);
            const relation = metadata.findRelationWithPropertyPath(propertyName);
            /* v8 ignore next -- only null for unidirectional relations */
            return relation?.inverseSidePropertyPath ?? null;
        } catch (error) {
            /* v8 ignore next */
            if (error instanceof EntityMetadataNotFoundError) {
                return null;
            }

            /* v8 ignore next */
            throw error;
        }
    }
}
