class Parser extends Function {
  constructor(parse) {
    super("input", "state", "return this.__call__(input, state)");
    this.parse = parse;
    return this.bind(this);
  }

  map(g) {
    return new Parser((input, state) => {
      let resp = this(input, state);
      return resp.outcome === "success"
        ? { ...resp, value: g(resp.value) }
        : resp;
    });
  }

  chain(p) {
    return new Parser((input, state) => {
      let resp1 = this(input, state);
      return resp1.outcome === "success"
        ? p(resp1.value)(input, resp1.newState)
        : resp1;
    });
  }

  then(p) {
    return this.chain(() => p);
  }

  skip(p) {
    return this.chain(v => p.map(() => v));
  }

  pair(p) {
    return this.chain(v => p.map(w => [v, w]));
  }

  try() {
    return new Parser((input, state) => {
      let resp1 = this(input, state);
      return resp1.outcome === "success"
        ? resp1
        : { ...resp1, index: state.index };
    });
  }

  or(p) {
    return new Parser((input, state) => {
      let resp = this(input, state);
      return resp.outcome === "success" || resp.index !== state.index
        ? resp
        : p(input, state);
    });
  }

  __call__(input, state) {
    return this.parse(input, state);
  }
}

let seq = (...ps) =>
  new Parser((input, state) => {
    let values = [];
    let resp = pure([])(input, state);
    for (let p of ps) {
      resp = p(input, state);
      if (resp.outcome === "success") {
        values.push(resp.value);
        state = resp.newState;
      } else {
        return resp;
      }
    }
    return { ...resp, value: values };
  });

let alt = (...ps) =>
  new Parser((input, state) => {
    let resp = zero(input, state);
    for (let p of ps) {
      resp = p(input, state);
      if (resp.outcome === "success" || resp.index !== state.index) {
        return resp;
      }
    }
    return resp;
  });

function pure(x) {
  return new Parser((_input, state) => {
    let resp = success(x, state);
    return resp;
  });
}

let zero = new Parser((_input, state) => failure(null, state.index));

let failure = (expected, index) => {
  return {
    outcome: "failure",
    expected,
    index
  };
};

function success(value, newState) {
  return {
    outcome: "success",
    value,
    newState
  };
}

let take = new Parser((input, state) => {
  let x = input[state.index];
  return x === undefined
    ? failure("a token", state.index)
    : success(x, { ...state, index: state.index + 1 });
});

let string = s =>
  new Parser((input, state) => {
    return input.slice(state.index, state.index + s.length) === s
      ? success(s, { ...state, index: state.index + s.length })
      : failure(s, state.index);
  });

let p = take
  .then(zero)
  .try()
  .or(take);

let q = p.pair(zero);

r = take.skip(take).then(take);

s = seq();

t = alt(take.pair(take), zero);

u = string("abc");
console.log(u("abdef", { index: 0 }));
