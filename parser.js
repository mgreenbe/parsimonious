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
        ? p(resp1.value)(input, resp1.state)
        : resp1;
    });
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
      return resp1.outcome === "success" ? resp1 : { ...resp1, state: state };
    });
  }

  or(p) {
    return new Parser((input, state) => {
      let resp = this(input, state);
      return resp.outcome === "success" || resp.state.index !== state.index
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
          if (resp.state.index === state.index) {
            throw new Error(
              "To guarantee that p.many() terminates, p must consume input."
            );
          }
          values.push(resp.value);
          state = resp.state;
        } else if (
          resp.outcome === "failure" &&
          resp.state.index === state.index
        ) {
          break;
        } else {
          return resp;
        }
      }
      console.log(values);
      resp = { outcome: "success", value: values, state: resp.state };
      return resp;
    });
  }

  times(min, max = min) {
    return this.atMost(max).chain(x => (x.length < min ? fail : pure(x)));
  }

  atLeast(min) {
    return this.times(min, Infinity);
  }

  many() {
    return this.atMost(Infinity);
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
    return this.maybe().chain(x => {
      if (x.length === 0) {
        return pure(null)
      } else {
        return fail
      }
    })
  }

  notFollowedBy(p) {
    return this.skip(p.failsSoftly())
  }

  __call__(input, state) {
    return this.parse(input, state);
  }
}

function pure(x) {
  return new Parser((_input, state) => {
    let resp = { outcome: "success", value: x, state };
    return resp;
  });
}

let fail = new Parser((_input, state) => {
  let resp = { outcome: "failure", state };
  return resp;
});

let getState = new Parser((_input, state) => {
  let resp = {
    outcome: "success",
    value: state,
    state
  };
  return resp;
});

let setState = state =>
  new Parser((_input, _state) => {
    let resp = {
      outcome: "success",
      value: null,
      state
    };
    return resp;
  });

let seq = (...ps) =>
  new Parser((input, state) => {
    let values = [];
    let resp = pure([])(input, state);
    for (let p of ps) {
      resp = p(input, state);
      if (resp.outcome === "success") {
        values.push(resp.value);
        state = resp.state;
      } else {
        return resp;
      }
    }
    return { ...resp, value: values };
  });

let alt = (...ps) =>
  new Parser((input, state) => {
    let resp = fail(input, state);
    for (let p of ps) {
      resp = p(input, state);
      console.log(resp);
      if (resp.outcome === "success" || resp.state.index !== state.index) {
        return resp;
      }
    }
    return resp;
  });


let take = new Parser((input, state) => {
  let x = input[state.index];
  let resp =
    x === undefined
      ? {
        outcome: "failure",
        state: { ...state, expected: [...state.expected, expected] }
      }
      : {
        outcome: "success",
        value: x,
        state: { ...state, index: state.index + 1, expected: [] }
      };
  return resp;
});

let string = str =>
  new Parser((input, state) => {
    let t = input.slice(state.index, state.index + str.length);
    if (t === str) {
      let resp = {
        outcome: "success",
        value: str,
        state: { ...state, index: state.index + str.length, expected: [] }
      };
      return resp;
    } else {
      let resp = {
        outcome: "failure",
        state: { ...state, expected: [...state.expected, str] }
      };
      return resp;
    }
  });

a = string("a");
b = string("b");
c = string("c");

console.log(a.then(b).failsSoftly()("avac", { index: 0, expected: ["x"] }));
