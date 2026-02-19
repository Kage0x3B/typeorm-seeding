// eslint-disable-next-line @typescript-eslint/ban-types
export type DataPropertyNames<T, K extends keyof T> = T[K] extends Function ? never : K extends symbol ? never : K;
