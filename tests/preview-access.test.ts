import { describe, expect, it } from 'vitest';
import { hasPreviewAccess } from '../server/preview-access.js';
import { parseConfig } from '../server/config.js';

const authorization = (value: string) => `Basic ${Buffer.from(value).toString('base64')}`;

describe('temporary preview access gate', () => {
  it('accepts only the configured username and passcode', () => {
    const passcode = 'a-review-passcode-that-is-at-least-24-characters';
    expect(hasPreviewAccess(authorization(`reviewer:${passcode}`), 'reviewer', passcode)).toBe(
      true,
    );
    expect(hasPreviewAccess(authorization(`reviewer:wrong`), 'reviewer', passcode)).toBe(false);
    expect(hasPreviewAccess(authorization(`other:${passcode}`), 'reviewer', passcode)).toBe(false);
    expect(hasPreviewAccess(undefined, 'reviewer', passcode)).toBe(false);
    expect(hasPreviewAccess(`Bearer ${passcode}`, 'reviewer', passcode)).toBe(false);
  });

  it('fails closed if preview mode is missing either credential', () => {
    const base = {
      NODE_ENV: 'production',
      BETTER_AUTH_SECRET: 'long-enough-strong-production-like-test-secret',
      DEMO_MODE: 'false',
      APP_ORIGIN: 'https://review.example',
      DATABASE_URL: 'postgresql://localhost/test',
      PREVIEW_MODE: 'true',
    };
    expect(() => parseConfig(base)).toThrow('Preview mode requires');
    expect(() =>
      parseConfig({
        ...base,
        PREVIEW_ACCESS_USERNAME: 'reviewer',
        PREVIEW_ACCESS_PASSWORD: 'too-short',
      }),
    ).toThrow();
    expect(
      parseConfig({
        ...base,
        PREVIEW_ACCESS_USERNAME: 'reviewer',
        PREVIEW_ACCESS_PASSWORD: 'a-review-passcode-that-is-at-least-24-characters',
      }).PREVIEW_MODE,
    ).toBe(true);
  });
});
