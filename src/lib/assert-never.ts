/**
 * Exhaustiveness helper for union type checking.
 *
 * Call this in the `default` branch of a switch or if-else chain that should
 * cover every variant of a union. TypeScript will emit a compile error if any
 * variant is unhandled (because `x` will not narrow to `never`). At runtime,
 * throws an `Error` with the unexpected value serialised in the message.
 *
 * @param x - The value that should be `never` after all variants are handled.
 * @returns Never — always throws.
 * @throws {Error} Always, with the unexpected value in the message.
 */
export function assertNever(x: never): never {
  throw new Error(`Unexpected value: ${JSON.stringify(x)}`);
}
