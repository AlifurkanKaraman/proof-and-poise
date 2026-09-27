import { ERROR_CODES, routes, type ErrorCode, type RouteName } from '@proof-and-poise/shared';

/**
 * Error simulation for the mock API. A fault applies to one route or to all of them:
 * - an `ErrorCode` returns the contract error body with its `ERROR_STATUS`;
 * - `network` makes the request fail without a response;
 * - `invalid_response` returns a body that doesn't match the contract.
 *
 * In the browser, set it with `?mockError=<fault>` or `?mockError=<route>:<fault>`
 * (for example `?mockError=getAnalysis:UPSTREAM_UNAVAILABLE`); `?mockError=off` clears it.
 */
export type MockFaultKind = ErrorCode | 'network' | 'invalid_response';

export interface MockFault {
  kind: MockFaultKind;
  /** Null applies the fault to every contract route. */
  route: RouteName | null;
}

const KINDS: readonly string[] = [...ERROR_CODES, 'network', 'invalid_response'];
const isKind = (v: string): v is MockFaultKind => KINDS.includes(v);
const isRoute = (v: string): v is RouteName => Object.hasOwn(routes, v);

let current: MockFault | null = null;

export function setMockFault(fault: MockFault | null) {
  current = fault;
}

export function getMockFault(): MockFault | null {
  return current;
}

/** The fault to apply to `route`, if any. */
export function faultFor(route: RouteName): MockFaultKind | null {
  if (!current) return null;
  return current.route === null || current.route === route ? current.kind : null;
}

/**
 * Parse `<fault>` or `<route>:<fault>`. Returns null for "off" or an empty value and
 * `undefined` when the value isn't recognized.
 */
export function parseMockFault(value: string | null): MockFault | null | undefined {
  const v = value?.trim() ?? '';
  if (v === '' || v === 'off') return null;
  const [first = '', second] = v.split(':');
  if (second === undefined) return isKind(first) ? { kind: first, route: null } : undefined;
  return isRoute(first) && isKind(second) ? { kind: second, route: first } : undefined;
}
