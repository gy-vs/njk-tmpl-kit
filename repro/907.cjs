'use strict';

// Repro for the double-escaping of block-level `{% set %}` and
// `{% filter %}` content when autoescape is enabled.
//
// Content rendered inside a capture block is already escaped while
// rendering, so the captured result must be treated as safe HTML:
// outputting it, passing it to a macro, or running it through
// filters like upper/lower/trim/replace/striptags must not escape
// it a second time.
//
// Usage: ROOT=/path/to/repo node repro/907.cjs

const path = require('path');

const ROOT = process.env.ROOT || path.resolve(__dirname, '..');
const nunjucks = require(ROOT);

const ctx = {name: 'Tom & <Jerry>'};
const env = new nunjucks.Environment(null, {autoescape: true});
const envNoEscape = new nunjucks.Environment(null, {autoescape: false});

const cases = [
  // block-level set captures safe content
  ['set block',
    '{% set card %}<p>{{ name }}</p>{% endset %}{{ card }}',
    '<p>Tom &amp; &lt;Jerry&gt;</p>'],
  // captured content passed to a macro stays safe
  ['set block as macro arg',
    '{% macro box(body) %}<div>{{ body }}</div>{% endmacro %}' +
    '{% set card %}<p>{{ name }}</p>{% endset %}{{ box(card) }}',
    '<div><p>Tom &amp; &lt;Jerry&gt;</p></div>'],
  // filter blocks
  ['filter upper block',
    '{% filter upper %}<p>{{ name }}</p>{% endfilter %}',
    '<P>TOM &AMP; &LT;JERRY&GT;</P>'],
  ['filter escape block',
    '{% filter escape %}<p>{{ name }}</p>{% endfilter %}',
    '<p>Tom &amp; &lt;Jerry&gt;</p>'],
  ['filter trim block',
    '{% filter trim %}  <p>{{ name }}</p>  {% endfilter %}',
    '<p>Tom &amp; &lt;Jerry&gt;</p>'],
  ['filter replace block',
    '{% filter replace("Tom", "Bob") %}<p>{{ name }}</p>{% endfilter %}',
    '<p>Bob &amp; &lt;Jerry&gt;</p>'],
  // filters on captured content
  ['set block + striptags',
    '{% set x %}<b>{{ name }}</b>{% endset %}{{ x | striptags }}',
    'Tom &amp; &lt;Jerry&gt;'],
  ['caller() + upper',
    '{% macro wrap() %}{{ caller() | upper }}{% endmacro %}' +
    '{% call wrap() %}<i>{{ name }}</i>{% endcall %}',
    '<I>TOM &AMP; &LT;JERRY&GT;</I>'],
  ['macro + lower',
    '{% macro tag() %}<em>{{ name }}</em>{% endmacro %}{{ tag() | lower }}',
    '<em>tom &amp; &lt;jerry&gt;</em>'],
  ['macro + replace',
    '{% macro tag() %}<em>{{ name }}</em>{% endmacro %}{{ tag() | replace("Tom", "Bob") }}',
    '<em>Bob &amp; &lt;Jerry&gt;</em>'],
  ['macro + trim',
    '{% macro tag() %}<em>{{ name }}</em>{% endmacro %}{{ tag() | trim }}',
    '<em>Tom &amp; &lt;Jerry&gt;</em>'],
  // controls: these were already correct and must not change
  ['control: set block length',
    '{% set card %}<p>{{ name }}</p>{% endset %}{{ card | length }}',
    '30'],
  ['control: plain variable + upper',
    '{{ name | upper }}',
    'TOM &amp; &lt;JERRY&gt;'],
];

const noEscapeCases = [
  ['control: set block, autoescape off',
    '{% set card %}<p>{{ name }}</p>{% endset %}{{ card }}',
    '<p>Tom & <Jerry></p>'],
  ['control: filter block, autoescape off',
    '{% filter upper %}<p>{{ name }}</p>{% endfilter %}',
    '<P>TOM & <JERRY></P>'],
];

let failures = 0;

function check(label, actual, expected) {
  const ok = actual === expected;
  if (!ok) {
    failures++;
  }
  console.log(`${ok ? 'PASS' : 'FAIL'} ${label}`);
  console.log(`  actual:   ${JSON.stringify(actual)}`);
  if (!ok) {
    console.log(`  expected: ${JSON.stringify(expected)}`);
  }
}

cases.forEach(([label, template, expected]) => {
  check(label, env.renderString(template, ctx), expected);
});

noEscapeCases.forEach(([label, template, expected]) => {
  check(label, envNoEscape.renderString(template, ctx), expected);
});

if (failures) {
  console.log(`\n${failures} case(s) failed`);
  process.exit(1);
}
console.log('\nAll cases passed');
