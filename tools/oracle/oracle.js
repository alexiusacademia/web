// Writes ../../tests/templates.json: templates and data rendered by
// Handlebars 4.7.8 in compat mode (names are looked up in outer values too,
// as in Mustache and in web's templates), for web's tests to compare with.
// Cases are written by hand below, then made at random from the pieces
// both engines share. Run: npm install && node oracle.js
//
// Author: Alexius Academia
// Date: 2026-11-21

const fs = require("fs");
const path = require("path");
const Handlebars = require("handlebars");

const data = {
  name: "Ann <Lee>",
  title: "Q&A \"x\" 'y' `z` =",
  count: 3,
  zero: 0,
  flag: true,
  nope: false,
  price: 2.5,
  nothing: null,
  html: "<i>hi</i>",
  user: { name: "Bo", email: "bo@x.org", admin: true },
  items: ["a", "b<", "c"],
  people: [
    { name: "Cy", age: 30, tags: ["t1", "t2"] },
    { name: "Di", age: 0, tags: [] },
  ],
  empty: [],
  map: { x: 1, y: "two" },
  text: "line one\nline two é 😀",
};

const partials = {
  p1: "[{{name}}]",
  p2: "line1\nline2 {{title}}\n",
  row: "<li>{{name}} ({{age}})</li>\n",
};

const handwritten = [
  ["plain", "Hello, world"],
  ["empty", ""],
  ["value", "Hi {{name}}!"],
  ["escaped", "{{title}}"],
  ["raw triple", "{{{html}}}"],
  ["raw amp", "{{& html}}"],
  ["missing", "[{{nope2}}]"],
  ["null", "[{{nothing}}]"],
  ["number", "{{count}} {{zero}} {{price}}"],
  ["bool", "{{flag}} {{nope}}"],
  ["dotted", "{{user.name}} <{{user.email}}>"],
  ["deep missing", "[{{user.phone.number}}]"],
  ["length", "{{items.length}} {{empty.length}}"],
  ["unicode", "{{text}}"],
  ["spaces in tag", "{{  name  }}"],
  ["comment", "a{{! hidden }}b"],
  ["long comment", "a{{!-- has }} inside --}}b"],
  ["if true", "{{#if flag}}yes{{/if}}"],
  ["if false", "{{#if nope}}yes{{/if}}"],
  ["if else", "{{#if nope}}yes{{else}}no{{/if}}"],
  ["if zero", "{{#if zero}}yes{{else}}no{{/if}}"],
  ["if empty list", "{{#if empty}}yes{{else}}no{{/if}}"],
  ["if list", "{{#if items}}yes{{else}}no{{/if}}"],
  ["if object", "{{#if user}}yes{{else}}no{{/if}}"],
  ["if string", "{{#if name}}yes{{else}}no{{/if}}"],
  ["if missing", "{{#if gone}}yes{{else}}no{{/if}}"],
  ["else if", "{{#if nope}}1{{else if zero}}2{{else if count}}3{{else}}4{{/if}}"],
  ["else if last", "{{#if nope}}1{{else if zero}}2{{else}}4{{/if}}"],
  ["else unless", "{{#if nope}}1{{else unless flag}}2{{else}}3{{/if}}"],
  ["unless", "{{#unless nope}}shown{{/unless}}{{#unless flag}}hidden{{else}}else{{/unless}}"],
  ["each list", "{{#each items}}<{{this}}>{{/each}}"],
  ["each index", "{{#each items}}{{@index}}={{this}}{{#unless @last}}, {{/unless}}{{/each}}"],
  ["each first", "{{#each items}}{{#if @first}}*{{/if}}{{.}}{{/each}}"],
  ["each objects", "{{#each people}}{{name}}:{{age}};{{/each}}"],
  ["each outer", "{{#each people}}{{name}} of {{title}};{{/each}}"],
  ["each parent", "{{#each people}}{{../count}}{{/each}}"],
  ["each nested", "{{#each people}}{{name}}[{{#each tags}}{{this}}{{else}}none{{/each}}]{{/each}}"],
  ["each empty else", "{{#each empty}}x{{else}}nothing{{/each}}"],
  ["each object", "{{#each map}}{{@key}}={{this}} {{/each}}"],
  ["each object index", "{{#each map}}{{@index}}{{@key}}{{/each}}"],
  ["each as", "{{#each items as |item|}}{{item}}{{/each}}"],
  ["each as index", "{{#each items as |item i|}}{{i}}:{{item}} {{/each}}"],
  ["each as key", "{{#each map as |v k|}}{{k}}={{v}} {{/each}}"],
  ["each as fields", "{{#each people as |p|}}{{p.name}}{{/each}}"],
  ["with", "{{#with user}}{{name}} {{email}} {{title}}{{/with}}"],
  ["with else", "{{#with nothing}}x{{else}}none{{/with}}"],
  ["with as", "{{#with user as |u|}}{{u.name}}{{/with}}"],
  ["with this", "{{#with user}}{{this.name}}{{/with}}"],
  ["partial", "a{{> p1}}b"],
  ["partial context", "{{#each people}}{{> p1}}{{/each}}"],
  ["partial arg", "{{> p1 user}}"],
  ["partial row", "<ul>\n{{#each people}}\n  {{> row}}\n{{/each}}\n</ul>\n"],
  ["standalone if", "a\n{{#if flag}}\nb\n{{/if}}\nc\n"],
  ["standalone indented", "a\n   {{#if flag}}\n  b\n   {{/if}}\nc\n"],
  ["standalone else", "{{#if nope}}\nyes\n{{else}}\nno\n{{/if}}\n"],
  ["standalone each", "<ul>\n{{#each items}}\n  <li>{{this}}</li>\n{{/each}}\n</ul>\n"],
  ["standalone comment", "a\n  {{! note }}\nb\n"],
  ["not standalone", "a {{#if flag}}\nb\n{{/if}} c\n"],
  ["standalone crlf", "a\r\n{{#if flag}}\r\nb\r\n{{/if}}\r\nc"],
  ["standalone first", "{{#if flag}}\nfirst\n{{/if}}"],
  ["standalone partial", "start\n  {{> p2}}\nend\n"],
  ["standalone partial top", "{{> p2}}\nend\n"],
  ["value line", "a\n  {{name}}\nb\n"],
  ["tilde both", "a  {{~name~}}  b"],
  ["tilde block", "<p>\n  {{~#if nope~}}\n  yes\n  {{~else~}}\n  no\n  {{~/if~}}\n</p>"],
  ["tilde raw", "[ {{~{html}~}} ]"],
  ["tilde each", "<ul>\n  {{#each items~}}\n  <li>{{this}}</li>\n  {{~/each}}\n</ul>"],
  ["caret else", "{{#if nope}}yes{{^}}no{{/if}}"],
  ["root", "{{#each people}}{{name}}/{{@root.title}}/{{@root.user.name}} {{/each}}"],
  ["escaped mustache", "a \\{{name}} b {{name}}"],
  ["list shown", "{{items}} [{{empty}}] {{people.0.tags}}"],
  ["html page", "<!doctype html>\n<title>{{title}}</title>\n<h1>{{user.name}}</h1>\n{{#if people}}\n<ul>\n  {{#each people}}\n  <li class=\"{{#if @first}}first{{/if}}\">{{name}}</li>\n  {{/each}}\n</ul>\n{{/if}}\n"],
];

const errors = [
  ["unclosed if", "{{#if flag}}x"],
  ["mismatched", "{{#if flag}}x{{/each}}"],
  ["stray close", "x{{/if}}"],
  ["unclosed tag", "{{name"],
];

// A small seeded random number generator, so the cases stay the same.
let seed = 20261121;
function rand(n) {
  seed = (seed * 1103515245 + 12345) % 2147483648;
  return seed % n;
}
function pick(list) {
  return list[rand(list.length)];
}

const texts = ["", "a", "Hi ", " ", "  ", "\n", "x\n", "  \n", "<b>", "&", "\n  ", "-"];
const showPaths = ["name", "title", "count", "zero", "flag", "nope", "user.name", "items.length", "html", "this", "price", "missing"];
const condPaths = ["flag", "nope", "zero", "count", "items", "empty", "user", "name", "nothing", "missing"];
const eachPaths = ["items", "people", "empty", "map", "user.name.x"];

// Sometimes adds `~` to a tag's ends.
function tilde(tag) {
  const r = rand(6);
  if (r === 0) return tag.replace(/^\{\{/, "{{~");
  if (r === 1) return tag.replace(/\}\}$/, "~}}");
  if (r === 2) return tag.replace(/^\{\{/, "{{~").replace(/\}\}$/, "~}}");
  return tag;
}

function piece(depth) {
  const r = rand(depth > 2 ? 4 : 9);
  if (r === 0) return pick(texts);
  if (r === 1) return tilde(`{{${pick(showPaths)}}}`);
  if (r === 2) return pick(["{{{html}}}", "{{& title}}", "{{! c }}", "{{> p1}}"]);
  if (r === 3) return pick(texts) + `{{${pick(showPaths)}}}`;
  const nl = rand(2) === 0;
  const pad = pick(["", "", "  "]);
  const open = (tag) => (nl ? `\n${pad}${tilde(`{{${tag}}}`)}\n` : tilde(`{{${tag}}}`));
  const body = () => seq(depth + 1);
  if (r === 4 || r === 5) {
    const kind = pick(["if", "unless"]);
    let out = open(`#${kind} ${pick(condPaths)}`) + body();
    if (rand(2) === 0) out += open("else") + body();
    return out + open(`/${kind}`);
  }
  if (r === 6 || r === 7) {
    const p = pick(eachPaths);
    const as = rand(3) === 0 ? " as |v i|" : "";
    let out = open(`#each ${p}${as}`) + pick(["{{this}}", "{{@index}}", "{{name}}", "{{v}}{{i}}", "{{@key}}", ""]) + body();
    if (rand(3) === 0) out += open("else") + body();
    return out + open("/each");
  }
  let out = open(`#with ${pick(["user", "nothing", "map"])}`) + body();
  if (rand(3) === 0) out += open("else") + body();
  return out + open("/with");
}

function seq(depth) {
  let out = "";
  const n = 1 + rand(3);
  for (let i = 0; i < n; i++) out += piece(depth);
  return out;
}

function render(template) {
  const hb = Handlebars.create();
  for (const [name, text] of Object.entries(partials)) hb.registerPartial(name, text);
  return hb.compile(template, { compat: true })(data);
}

const cases = [];
for (const [name, template] of handwritten) {
  cases.push({ name, template, out: render(template), error: false });
}
for (const [name, template] of errors) {
  let failed = false;
  try {
    render(template);
  } catch (e) {
    failed = true;
  }
  if (!failed) throw new Error(`Handlebars accepted ${name}`);
  cases.push({ name, template, out: "", error: true });
}
let made = 0;
while (made < 3000) {
  const template = seq(0);
  let out;
  try {
    out = render(template);
  } catch (e) {
    continue;
  }
  // Objects print differently in JavaScript.
  if (out.includes("[object Object]")) continue;
  cases.push({ name: `random ${made}`, template, out, error: false });
  made += 1;
}

const file = { data: JSON.stringify(data), partials, cases };
const target = path.join(__dirname, "..", "..", "tests", "templates.json");
fs.writeFileSync(target, JSON.stringify(file, null, 1) + "\n");
console.log(`${cases.length} cases written to tests/templates.json`);
