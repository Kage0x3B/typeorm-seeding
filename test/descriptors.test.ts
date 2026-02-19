import { describe, test, expect } from 'vitest';
import { belongsTo, hasMany, hasOne, sequence, ref, isDescriptor, DESCRIPTOR_TAG } from '../src/index.js';
import { UserFactory } from './factory/UserFactory.js';

describe('Descriptor helpers', () => {
    test('belongsTo returns correct shape', () => {
        const desc = belongsTo(UserFactory);
        expect(desc[DESCRIPTOR_TAG]).toBe(true);
        expect(desc.kind).toBe('belongsTo');
        expect(desc.factoryRef).toBe(UserFactory);
        expect(desc.overridesOrEntity).toBeUndefined();
    });

    test('belongsTo with overrides', () => {
        const desc = belongsTo(UserFactory, { firstName: 'Alice' });
        expect(desc.overridesOrEntity).toEqual({ firstName: 'Alice' });
        expect(desc.variants).toBeUndefined();
    });

    test('belongsTo with variant string', () => {
        const desc = belongsTo(UserFactory, undefined, 'admin');
        expect(desc.variants).toEqual(['admin']);
    });

    test('belongsTo with variant array', () => {
        const desc = belongsTo(UserFactory, undefined, ['admin', 'inactive']);
        expect(desc.variants).toEqual(['admin', 'inactive']);
    });

    test('hasMany returns correct shape', () => {
        const desc = hasMany(UserFactory, 5);
        expect(desc[DESCRIPTOR_TAG]).toBe(true);
        expect(desc.kind).toBe('hasMany');
        expect(desc.factoryRef).toBe(UserFactory);
        expect(desc.count).toBe(5);
    });

    test('hasMany with overrides', () => {
        const desc = hasMany(UserFactory, 3, { firstName: 'Bob' });
        expect(desc.overrides).toEqual({ firstName: 'Bob' });
        expect(desc.variants).toBeUndefined();
    });

    test('hasMany with variant string', () => {
        const desc = hasMany(UserFactory, 2, undefined, 'admin');
        expect(desc.variants).toEqual(['admin']);
    });

    test('hasMany with variant array', () => {
        const desc = hasMany(UserFactory, 2, undefined, ['admin', 'inactive']);
        expect(desc.variants).toEqual(['admin', 'inactive']);
    });

    test('hasOne returns correct shape', () => {
        const desc = hasOne(UserFactory);
        expect(desc[DESCRIPTOR_TAG]).toBe(true);
        expect(desc.kind).toBe('hasOne');
        expect(desc.variants).toBeUndefined();
    });

    test('hasOne with variant string', () => {
        const desc = hasOne(UserFactory, undefined, 'admin');
        expect(desc.variants).toEqual(['admin']);
    });

    test('hasOne with variant array', () => {
        const desc = hasOne(UserFactory, undefined, ['admin', 'inactive']);
        expect(desc.variants).toEqual(['admin', 'inactive']);
    });

    test('sequence returns correct shape', () => {
        const cb = (n: number) => n * 2;
        const desc = sequence(cb);
        expect(desc[DESCRIPTOR_TAG]).toBe(true);
        expect(desc.kind).toBe('sequence');
        expect(desc.callback).toBe(cb);
    });

    test('ref returns correct shape', () => {
        const desc = ref('adminUser');
        expect(desc[DESCRIPTOR_TAG]).toBe(true);
        expect(desc.kind).toBe('ref');
        expect(desc.label).toBe('adminUser');
    });
});

describe('isDescriptor', () => {
    test('returns true for descriptors', () => {
        expect(isDescriptor(sequence((n) => n))).toBe(true);
        expect(isDescriptor(ref('x'))).toBe(true);
        expect(isDescriptor(belongsTo(UserFactory))).toBe(true);
    });

    test('returns false for non-descriptors', () => {
        expect(isDescriptor(null)).toBe(false);
        expect(isDescriptor(undefined)).toBe(false);
        expect(isDescriptor(42)).toBe(false);
        expect(isDescriptor('hello')).toBe(false);
        expect(isDescriptor({ kind: 'sequence' })).toBe(false);
        expect(isDescriptor({})).toBe(false);
    });
});
