import { describe, it, expect } from 'vitest';
import { diffTokens } from '@/assets/js/textDiff';

const changedText = (segs) => segs.filter((s) => s.changed).map((s) => s.text);
const joined = (segs) => segs.map((s) => s.text).join('');

describe('diffTokens', () => {
    it('identische Strings -> nichts markiert', () => {
        const { left, right } = diffTokens('a b c', 'a b c');
        expect(changedText(left)).toEqual([]);
        expect(changedText(right)).toEqual([]);
    });

    it('ein abweichendes Wort wird beidseitig markiert', () => {
        const { left, right } = diffTokens('wie sie es', 'wie się es');
        expect(changedText(left)).toEqual(['sie']);
        expect(changedText(right)).toEqual(['się']);
    });

    it('Einfügung nur rechts markiert', () => {
        const { left, right } = diffTokens('a b', 'a neu b');
        expect(changedText(left)).toEqual([]);
        expect(changedText(right)).toContain('neu');
    });

    it('Segmente lassen sich wieder zum Original zusammensetzen', () => {
        const a = 'Text: eins zwei\ndrei';
        const b = 'Text: eins DREI\ndrei';
        const { left, right } = diffTokens(a, b);
        expect(joined(left)).toBe(a);
        expect(joined(right)).toBe(b);
    });
});
