import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import ts from 'typescript';
import { english } from '../resources/js/i18n/en';
import { french } from '../resources/js/i18n/fr';

test('English and French messages cover the same keys and interpolation variables', () => {
  assert.deepEqual(Object.keys(english).sort(), Object.keys(french).sort());
  const parameters = (text: string) =>
    [...text.matchAll(/\{(\w+)\}/g)].map((match) => match[1]).sort();
  for (const [key, text] of Object.entries(english)) {
    assert.ok(french[key]?.trim(), `Empty French message: ${key}`);
    assert.deepEqual(parameters(french[key]), parameters(text), `Interpolation mismatch: ${key}`);
  }
});

test('Literal UI messages have explicit English and French translations', () => {
  const missing = new Set<string>();
  function message(node: ts.Node) {
    if (ts.isStringLiteralLike(node) && node.text.trim() && /[a-zA-Z]/.test(node.text)) {
      if (!Object.hasOwn(english, node.text) || !Object.hasOwn(french, node.text))
        missing.add(node.text);
    } else if (ts.isConditionalExpression(node)) {
      message(node.whenTrue);
      message(node.whenFalse);
    }
  }
  function scan(file: string) {
    const source = ts.createSourceFile(
      file,
      readFileSync(file, 'utf8'),
      ts.ScriptTarget.Latest,
      true,
    );
    function visit(node: ts.Node) {
      if (ts.isCallExpression(node)) {
        const name = node.expression.getText(source);
        if (['t', 'setError', 'setNotice', 'setSuccess'].includes(name) && node.arguments[0])
          message(node.arguments[0]);
        if (name === 'write' && node.arguments[2]) message(node.arguments[2]);
      }
      ts.forEachChild(node, visit);
    }
    visit(source);
  }
  function directory(path: string) {
    for (const file of readdirSync(path, { withFileTypes: true })) {
      const name = join(path, file.name);
      if (file.isDirectory() && file.name !== 'i18n') directory(name);
      else if (file.isFile() && /\.tsx?$/.test(name)) scan(name);
    }
  }
  directory('resources/js');
  assert.deepEqual([...missing].sort(), [], 'Missing bilingual UI messages');
});
