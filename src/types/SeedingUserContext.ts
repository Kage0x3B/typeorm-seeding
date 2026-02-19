/**
 * Extensible user-defined context available on {@link SeedingContext.store}.
 * Add custom properties via TypeScript module augmentation.
 *
 * @example
 * ```ts
 * declare module '@kage0x3b/typeorm-seeding' {
 *     interface SeedingUserContext {
 *         defaultOrganization: Organization;
 *     }
 * }
 * ```
 */
// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface SeedingUserContext {}

/**
 * A string type that autocompletes keys from {@link SeedingUserContext}
 * but also accepts any arbitrary string label.
 */
export type RefLabel = keyof SeedingUserContext | (string & {});
