interface Success<A> {
  outcome: "success";
  value: A;
  state: State;
}

interface Failure {
  outcome: "failure";
  state: State;
}

type Resp<A> = Success<A> | Failure;

interface State {
  index: number;
  expected: string[];
  [s: string]: any;
}

type Input = string;

type ParseFunction<A> = (input: Input, state: State) => Resp<A>;

export class Parser<A> {
  parse: ParseFunction<A>;
  constructor(parse: ParseFunction<A>) {
    this.parse = parse;
  }

  map<B>(g: (a: A) => B) {
    return new Parser((input, state) => {
      let resp = this.parse(input, state);
      return resp.outcome === "success"
        ? { ...resp, value: g(resp.value) }
        : resp;
    });
  }

  chain<B>(f: (a: A) => Parser<B>) {
    return new Parser((input, state) => {
      let resp1 = this.parse(input, state);
      if (resp1.outcome === "success") {
        let resp = f(resp1.value).parse(input, resp1.state);
        return resp;
      } else {
        return resp1;
      }
    });
  }

  then<B>(p: Parser<B>): Parser<B> {
    return this.chain((_: A) => p);
  }

  skip<B>(p: Parser<B>): Parser<A> {
    return this.chain(v => p.map(() => v));
  }

  between<B, C>(p: Parser<B>, q: Parser<C>): Parser<A> {
    return p.then(this.skip(q));
  }

  try(label?: string): Parser<A> {
    return new Parser((input, state) => {
      let resp1 = this.parse(input, state);
      if (resp1.outcome === "success") {
        let resp = resp1;
        return resp;
      } else {
        let state1 = label
          ? { ...state, expected: [...state.expected, label] }
          : state;
        let resp: Failure = { ...resp1, state: state1 };
        return resp;
      }
    });
  }

  or<B>(p: Parser<B>): Parser<A | B> {
    return new Parser((input, state) => {
      let resp1: Resp<A | B> = this.parse(input, state);
      if (resp1.outcome === "success") {
        return resp1;
      } else if (
        resp1.outcome === "failure" &&
        resp1.state.index !== state.index
      ) {
        return resp1;
      } else {
        let resp2 = p.parse(input, state);
        return resp2;
      }
    });
  }

  maybe(): Parser<A[]> {
    return this.chain((x: A): Parser<A[]> => pure([x])).or(pure([]));
  }

  fallback<B>(x: B): Parser<A | B> {
    return this.or(pure(x));
  }

  atMost(max: number): Parser<A[]> {
    return new Parser((input, state) => {
      let values = [];
      // let resp = pure([]).parse(input, state);
      while (values.length < max) {
        let resp = this.parse(input, state);
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
          return { outcome: "success", value: values, state: resp.state };
        } else {
          return resp;
        }
      }
    });
  }

  times(min: number, max: number = min): Parser<A[]> {
    return this.atMost(max).chain(x => (x.length < min ? fail : pure(x)));
  }

  atLeast(min: number) {
    return this.times(min, Infinity);
  }

  many() {
    return this.atMost(Infinity);
  }

  sepBy<B>(p: Parser<B>): Parser<A[]> {
    return this.maybe().chain(x =>
      p
        .then(this)
        .many()
        .map(xs => [...x, ...xs])
    );
  }

  lookahead(): Parser<A> {
    return getState.chain(state => this.skip(setState(state)));
  }

  failsSoftly(): Parser<null> {
    return this.maybe().chain(x => {
      if (x.length === 0) {
        return pure(null);
      } else {
        return fail;
      }
    });
  }

  notFollowedBy<B>(p: Parser<B>): Parser<A> {
    return this.skip(p.failsSoftly());
  }

  test(input: string) {
    let resp = this.parse(input, { index: 0, expected: [] });
    return { ...resp, rest: input.slice(resp.state.index) };
  }
}

export function pure<A>(x: A): Parser<A> {
  return new Parser((_input: Input, state: State) => {
    let resp: Success<A> = { outcome: "success", value: x, state };
    return resp;
  });
}

export let fail: Parser<null> = new Parser((_input: Input, state: State) => {
  let resp: Failure = { outcome: "failure", state };
  return resp;
});

export let getState = new Parser((_input: Input, state: State) => {
  let resp: Success<State> = {
    outcome: "success",
    value: state,
    state
  };
  return resp;
});

export let setState = (state: State) =>
  new Parser((_input: Input, _state: State) => {
    let resp: Success<null> = {
      outcome: "success",
      value: null,
      state
    };
    return resp;
  });

export let seq = <A>(...ps: Parser<A>[]): Parser<A[]> =>
  new Parser((input: Input, state: State) => {
    let values: A[] = [];
    for (let p of ps) {
      let resp = p.parse(input, state);
      if (resp.outcome === "success") {
        values.push(resp.value);
        state = resp.state;
      } else {
        return resp;
      }
    }
    return { outcome: "success", value: values, state };
  });

export let alt = <A>(...ps: Parser<A>[]): Parser<A> =>
  new Parser((input: Input, state: State) => {
    let resp: Resp<A> = { outcome: "failure", state }; // returned if ps.length === 0
    for (let p of ps) {
      resp = p.parse(input, state);
      if (resp.outcome === "success" || resp.state.index !== state.index) {
        return resp;
      }
    }
    return resp;
  });

export let lazy = <A>(f: () => Parser<A>) =>
  new Parser((input, state) => f().parse(input, state));

export function string(str: string): Parser<string> {
  return new Parser((input: string, state) => {
    let t = input.slice(state.index, state.index + str.length);
    if (t === str) {
      let resp: Success<string> = {
        outcome: "success",
        value: str,
        state: { ...state, index: state.index + str.length, expected: [] }
      };
      return resp;
    } else {
      let resp: Failure = {
        outcome: "failure",
        state: { ...state, expected: [...state.expected, str] }
      };
      return resp;
    }
  });
}

export let regexp = (re: RegExp, label = `/${re.source}/`): Parser<string> =>
  new Parser((input: string, state) => {
    let re_ = new RegExp("^" + re.source);
    let match = re_.exec(input.slice(state.index));
    if (match !== null) {
      let resp: Success<string> = {
        outcome: "success",
        value: match[0],
        state: { ...state, index: state.index + match[0].length }
      };
      return resp;
    } else {
      let resp: Failure = {
        outcome: "failure",
        state: { ...state, expected: [...state.expected, label] }
      };
      return resp;
    }
  });

export let noneOf = (
  chars: string,
  label = `none of ${chars}`
): Parser<string> =>
  new Parser((input: string, state: State) => {
    let t = input[state.index];
    if (t && ![...chars].includes(t)) {
      let resp: Success<string> = {
        outcome: "success",
        value: t,
        state: { ...state, index: state.index + 1 }
      };
      return resp;
    } else {
      let resp: Failure = {
        outcome: "failure",
        state: { ...state, expected: [...state.expected, label] }
      };
      return resp;
    }
  });
