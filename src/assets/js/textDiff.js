// Wort-genaues Diff zweier Strings (LCS über Tokens). Wird im Druck-Check
// verwendet, um im Fußzeilen-/Strophen-Vergleich genau die abweichenden Wörter
// hervorzuheben (z. B. „sie" ↔ „się"), statt zwei fast identische Zeilen ohne
// sichtbaren Unterschied nebeneinanderzustellen.
//
// Tokenisierung bewahrt Whitespace (inkl. Zeilenumbrüche) als eigene Tokens,
// sodass die zurückgegebenen Segmente 1:1 wieder zum Originaltext zusammengesetzt
// werden können – wichtig für die mehrzeilige, „code-block"-artige Darstellung.

function tokenize(s) {
    return String(s || '').match(/\s+|[^\s]+/gu) || [];
}

// Liefert für beide Seiten eine Segment-Liste: { text, changed }.
// `changed` markiert Tokens, die es nur auf dieser Seite gibt (links = im PDF,
// aber nicht erwartet; rechts = erwartet, aber nicht im PDF).
export function diffTokens(a, b) {
    const A = tokenize(a);
    const B = tokenize(b);
    const n = A.length;
    const m = B.length;

    // LCS-Längen-DP (rückwärts), damit der Rücklauf vorwärts läuft.
    const dp = Array.from({ length: n + 1 }, () => new Int32Array(m + 1));
    for (let i = n - 1; i >= 0; i--) {
        for (let j = m - 1; j >= 0; j--) {
            dp[i][j] = A[i] === B[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
        }
    }

    const left = [];
    const right = [];
    let i = 0;
    let j = 0;
    while (i < n && j < m) {
        if (A[i] === B[j]) {
            left.push({ text: A[i], changed: false });
            right.push({ text: B[j], changed: false });
            i++;
            j++;
        } else if (dp[i + 1][j] >= dp[i][j + 1]) {
            left.push({ text: A[i], changed: true });
            i++;
        } else {
            right.push({ text: B[j], changed: true });
            j++;
        }
    }
    while (i < n) left.push({ text: A[i++], changed: true });
    while (j < m) right.push({ text: B[j++], changed: true });

    return { left, right };
}
