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

  pair(p) {
    return this.chain(v => p.map(w => [v, w]));
  }

  then(p) {
    return this.chain(() => p);
  }

  skip(p) {
    return this.chain(v => p.map(() => v));
  }

  between(p, q) {
    return p.then(this.skip(q));
  }

  try() {
    return new Parser((input, state) => {
      let resp1 = this(input, state);
      return resp1.outcome === "success"
        ? resp1
        : { ...resp1, failedState: state };
    });
  }

  or(p) {
    return new Parser((input, state) => {
      let resp = this(input, state);
      return resp.outcome === "success" ||
        resp.failedState.index !== state.index
        ? resp
        : p(input, state);
    });
  }

  maybe() {
    return this.chain(x => pure([x])).or(pure([]));
  }

  fallback(x) {
    return this.or(pure(x));
  }

  atMost(max) {
    return new Parser((input, state) => {
      let values = [];
      let resp = pure([])(input, state);
      while (values.length < max) {
        resp = this(input, state);
        if (resp.outcome === "success") {
          if (resp.newState.index === state.index) {
            throw new Error(
              "To guarantee that p.many() terminates, p must consume input."
            );
          }
          values.push(resp.value);
          state = resp.newState;
        } else if (
          resp.outcome === "failure" &&
          resp.failedState.index === state.index
        ) {
          break;
        } else {
          return resp;
        }
      }
      console.log(values);
      return success(values, resp.failedState || resp.newState);
    });
  }

  times(min, max = min) {
    return this.atMost(max).chain(x => (x.length < min ? zero : pure(x)));
  }

  atLeast(min) {
    return this.times(min, Infinity);
  }

  many() {
    return this.times(0, Infinity);
  }

  sepBy(p) {
    return this.maybe().chain(x =>
      p
        .then(this)
        .many()
        .map(xs => [...x, ...xs])
    );
  }

  lookahead() {
    return getState.chain(state => this.skip(setState(state)));
  }

  failsSoftly() {
    return this.maybe().chain(x => (x.length === 0 ? pure(null) : zero));
  }

  notFollowedBy(p) {
    return this.skip(p.failsSoftly());
  }

  __call__(input, state) {
    return this.parse(input, state);
  }
}

let getState = new Parser((_input, state) => success(state, state));

let setState = newState =>
  new Parser((_input, _state) => success(null, newState));

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
      console.log(resp);
      if (
        resp.outcome === "success" ||
        resp.failedState.index !== state.index
      ) {
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

let failure = (expected, failedState) => {
  return {
    outcome: "failure",
    expected,
    failedState
  };
};

let zero = new Parser((_input, state) => failure(null, state));

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
    ? failure("a token", state)
    : success(x, { ...state, index: state.index + 1 });
});

let string = str =>
  new Parser((input, state) => {
    return input.slice(state.index, state.index + str.length) === str
      ? success(str, { ...state, index: state.index + str.length })
      : failure(str, state);
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
console.log(string("a").sepBy(string("b"))("abababababac", { index: 0 }));
