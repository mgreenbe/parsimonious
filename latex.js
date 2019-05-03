let { string, regexp, alt, lazy, noneOf } = require("./base");

let cword = regexp(/\\[a-zA-Z]+/, "cword");
let csymb = regexp(/\\[^a-zA-Z]/, "csymb");

let lbc = string("{");
let rbc = string("}");

let text = noneOf("{}", "text")
  .atLeast(1)
  .map(cs => cs.join(""));
let group = () => alt(text, lazy(group).between(lbc, rbc)).many();
console.log(alt(csymb, cword).test("\\123"));
console.log(alt(csymb, cword).test("\\mycmd123"));

let str = "Hi, {mom}! There are some {nested {braces}} here.";

console.log(group().test(str));
