import type { Factory } from '../Factory.js';

/** Extract the entity type from a Factory subclass. */
export type EntityOf<F extends Factory<any, any>> = F extends Factory<infer T, any> ? T : never;

/** Extract valid variant names from a Factory subclass. */
export type VariantName<F extends Factory<any, any>> = keyof ReturnType<F['variants']> & string;
