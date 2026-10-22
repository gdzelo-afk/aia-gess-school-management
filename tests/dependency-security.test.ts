import { describe, it, expect } from 'vitest';
import { quote, parse } from 'shell-quote';
import { SourceMapConsumer, type RawSourceMap } from 'source-map-js';

describe('bounded dependency security regressions', () => {
  it('rejects a line terminator after a shell comment while preserving literal arguments', () => {
    // GHSA-pqg4-j6r4-53mv: inspect quoting only; never execute attacker-controlled text.
    for (const terminator of ['\n', '\r', '\u2028', '\u2029']) {
      expect(() => quote(['echo', { comment: 'fixture' }, `${terminator}printf injected`])).toThrow(
        /after a `comment`.*line terminators/,
      );
    }
    const literal = 'student name; $(printf injected)';
    expect(parse(quote(['printf', '%s', literal]))).toEqual(['printf', '%s', literal]);
    expect(quote(['echo', { comment: 'ordinary comment' }, 'safe'])).toBe(
      'echo #ordinary comment safe',
    );
  });

  it('rejects pathological indexed source-map offsets and resolves a valid section', () => {
    // Upstream types omit indexed maps although the consumer accepts them at runtime.
    const section = { version: 3, sources: ['lesson.ts'], names: [], mappings: 'AAAA' };
    const indexed = (line: number, column = 0) =>
      ({
        version: 3,
        sections: [{ offset: { line, column }, map: section }],
      }) as unknown as RawSourceMap;
    // GHSA-68fv-2mgg-jv7q: rejection happens before SourceNode can expand offset-sized arrays.
    for (const line of [Number.MAX_SAFE_INTEGER, -1, 1.5, Infinity]) {
      expect(() => new SourceMapConsumer(indexed(line))).toThrow(/Section offset/);
    }
    expect(() => new SourceMapConsumer(indexed(0, -1))).toThrow(/Section offset/);
    const consumer = new SourceMapConsumer(indexed(2));
    expect(consumer.originalPositionFor({ line: 3, column: 1 })).toMatchObject({
      source: 'lesson.ts',
      line: 1,
      column: 0,
    });
  });
});
