/**
 * A class with a zero-argument constructor.
 *
 * @typeParam T - The instance type produced by the constructor.
 */
export interface Constructable<T> {
    new (): T;
}
