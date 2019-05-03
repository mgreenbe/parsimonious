"use strict";
var __assign = (this && this.__assign) || Object.assign || function(t) {
    for (var s, i = 1, n = arguments.length; i < n; i++) {
        s = arguments[i];
        for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
            t[p] = s[p];
    }
    return t;
};
var __read = (this && this.__read) || function (o, n) {
    var m = typeof Symbol === "function" && o[Symbol.iterator];
    if (!m) return o;
    var i = m.call(o), r, ar = [], e;
    try {
        while ((n === void 0 || n-- > 0) && !(r = i.next()).done) ar.push(r.value);
    }
    catch (error) { e = { error: error }; }
    finally {
        try {
            if (r && !r.done && (m = i["return"])) m.call(i);
        }
        finally { if (e) throw e.error; }
    }
    return ar;
};
var __spread = (this && this.__spread) || function () {
    for (var ar = [], i = 0; i < arguments.length; i++) ar = ar.concat(__read(arguments[i]));
    return ar;
};
var __values = (this && this.__values) || function (o) {
    var m = typeof Symbol === "function" && o[Symbol.iterator], i = 0;
    if (m) return m.call(o);
    return {
        next: function () {
            if (o && i >= o.length) o = void 0;
            return { value: o && o[i++], done: !o };
        }
    };
};
exports.__esModule = true;
var Parser = /** @class */ (function () {
    function Parser(parse) {
        this.parse = parse;
    }
    Parser.prototype.map = function (g) {
        var _this = this;
        return new Parser(function (input, state) {
            var resp = _this.parse(input, state);
            return resp.outcome === "success"
                ? __assign({}, resp, { value: g(resp.value) }) : resp;
        });
    };
    Parser.prototype.chain = function (f) {
        var _this = this;
        return new Parser(function (input, state) {
            var resp1 = _this.parse(input, state);
            if (resp1.outcome === "success") {
                var resp = f(resp1.value).parse(input, resp1.state);
                return resp;
            }
            else {
                return resp1;
            }
        });
    };
    Parser.prototype.then = function (p) {
        return this.chain(function (_) { return p; });
    };
    Parser.prototype.skip = function (p) {
        return this.chain(function (v) { return p.map(function () { return v; }); });
    };
    Parser.prototype.between = function (p, q) {
        return p.then(this.skip(q));
    };
    Parser.prototype["try"] = function (label) {
        var _this = this;
        return new Parser(function (input, state) {
            var resp1 = _this.parse(input, state);
            if (resp1.outcome === "success") {
                var resp = resp1;
                return resp;
            }
            else {
                var state1 = label
                    ? __assign({}, state, { expected: __spread(state.expected, [label]) }) : state;
                var resp = __assign({}, resp1, { state: state1 });
                return resp;
            }
        });
    };
    Parser.prototype.or = function (p) {
        var _this = this;
        return new Parser(function (input, state) {
            var resp1 = _this.parse(input, state);
            if (resp1.outcome === "success") {
                return resp1;
            }
            else if (resp1.outcome === "failure" &&
                resp1.state.index !== state.index) {
                return resp1;
            }
            else {
                var resp2 = p.parse(input, state);
                return resp2;
            }
        });
    };
    Parser.prototype.maybe = function () {
        return this.chain(function (x) { return pure([x]); }).or(pure([]));
    };
    Parser.prototype.fallback = function (x) {
        return this.or(pure(x));
    };
    Parser.prototype.atMost = function (max) {
        var _this = this;
        return new Parser(function (input, state) {
            var values = [];
            // let resp = pure([]).parse(input, state);
            while (values.length < max) {
                var resp = _this.parse(input, state);
                if (resp.outcome === "success") {
                    if (resp.state.index === state.index) {
                        throw new Error("To guarantee that p.many() terminates, p must consume input.");
                    }
                    values.push(resp.value);
                    state = resp.state;
                }
                else if (resp.outcome === "failure" &&
                    resp.state.index === state.index) {
                    return { outcome: "success", value: values, state: resp.state };
                }
                else {
                    return resp;
                }
            }
        });
    };
    Parser.prototype.times = function (min, max) {
        if (max === void 0) { max = min; }
        return this.atMost(max).chain(function (x) { return (x.length < min ? exports.fail : pure(x)); });
    };
    Parser.prototype.atLeast = function (min) {
        return this.times(min, Infinity);
    };
    Parser.prototype.many = function () {
        return this.atMost(Infinity);
    };
    Parser.prototype.sepBy = function (p) {
        var _this = this;
        return this.maybe().chain(function (x) {
            return p
                .then(_this)
                .many()
                .map(function (xs) { return __spread(x, xs); });
        });
    };
    Parser.prototype.lookahead = function () {
        var _this = this;
        return exports.getState.chain(function (state) { return _this.skip(exports.setState(state)); });
    };
    Parser.prototype.failsSoftly = function () {
        return this.maybe().chain(function (x) {
            if (x.length === 0) {
                return pure(null);
            }
            else {
                return exports.fail;
            }
        });
    };
    Parser.prototype.notFollowedBy = function (p) {
        return this.skip(p.failsSoftly());
    };
    Parser.prototype.test = function (input) {
        var resp = this.parse(input, { index: 0, expected: [] });
        return __assign({}, resp, { rest: input.slice(resp.state.index) });
    };
    return Parser;
}());
exports.Parser = Parser;
function pure(x) {
    return new Parser(function (_input, state) {
        var resp = { outcome: "success", value: x, state: state };
        return resp;
    });
}
exports.pure = pure;
exports.fail = new Parser(function (_input, state) {
    var resp = { outcome: "failure", state: state };
    return resp;
});
exports.getState = new Parser(function (_input, state) {
    var resp = {
        outcome: "success",
        value: state,
        state: state
    };
    return resp;
});
exports.setState = function (state) {
    return new Parser(function (_input, _state) {
        var resp = {
            outcome: "success",
            value: null,
            state: state
        };
        return resp;
    });
};
exports.seq = function () {
    var ps = [];
    for (var _i = 0; _i < arguments.length; _i++) {
        ps[_i] = arguments[_i];
    }
    return new Parser(function (input, state) {
        var e_1, _a;
        var values = [];
        try {
            for (var ps_1 = __values(ps), ps_1_1 = ps_1.next(); !ps_1_1.done; ps_1_1 = ps_1.next()) {
                var p = ps_1_1.value;
                var resp = p.parse(input, state);
                if (resp.outcome === "success") {
                    values.push(resp.value);
                    state = resp.state;
                }
                else {
                    return resp;
                }
            }
        }
        catch (e_1_1) { e_1 = { error: e_1_1 }; }
        finally {
            try {
                if (ps_1_1 && !ps_1_1.done && (_a = ps_1["return"])) _a.call(ps_1);
            }
            finally { if (e_1) throw e_1.error; }
        }
        return { outcome: "success", value: values, state: state };
    });
};
exports.alt = function () {
    var ps = [];
    for (var _i = 0; _i < arguments.length; _i++) {
        ps[_i] = arguments[_i];
    }
    return new Parser(function (input, state) {
        var e_2, _a;
        var resp = { outcome: "failure", state: state }; // returned if ps.length === 0
        try {
            for (var ps_2 = __values(ps), ps_2_1 = ps_2.next(); !ps_2_1.done; ps_2_1 = ps_2.next()) {
                var p = ps_2_1.value;
                resp = p.parse(input, state);
                if (resp.outcome === "success" || resp.state.index !== state.index) {
                    return resp;
                }
            }
        }
        catch (e_2_1) { e_2 = { error: e_2_1 }; }
        finally {
            try {
                if (ps_2_1 && !ps_2_1.done && (_a = ps_2["return"])) _a.call(ps_2);
            }
            finally { if (e_2) throw e_2.error; }
        }
        return resp;
    });
};
exports.lazy = function (f) {
    return new Parser(function (input, state) { return f().parse(input, state); });
};
function string(str) {
    return new Parser(function (input, state) {
        var t = input.slice(state.index, state.index + str.length);
        if (t === str) {
            var resp = {
                outcome: "success",
                value: str,
                state: __assign({}, state, { index: state.index + str.length, expected: [] })
            };
            return resp;
        }
        else {
            var resp = {
                outcome: "failure",
                state: __assign({}, state, { expected: __spread(state.expected, [str]) })
            };
            return resp;
        }
    });
}
exports.string = string;
exports.regexp = function (re, label) {
    if (label === void 0) { label = "/" + re.source + "/"; }
    return new Parser(function (input, state) {
        var re_ = new RegExp("^" + re.source);
        var match = re_.exec(input.slice(state.index));
        if (match !== null) {
            var resp = {
                outcome: "success",
                value: match[0],
                state: __assign({}, state, { index: state.index + match[0].length })
            };
            return resp;
        }
        else {
            var resp = {
                outcome: "failure",
                state: __assign({}, state, { expected: __spread(state.expected, [label]) })
            };
            return resp;
        }
    });
};
exports.noneOf = function (chars, label) {
    if (label === void 0) { label = "none of " + chars; }
    return new Parser(function (input, state) {
        var t = input[state.index];
        if (t && !__spread(chars).includes(t)) {
            var resp = {
                outcome: "success",
                value: t,
                state: __assign({}, state, { index: state.index + 1 })
            };
            return resp;
        }
        else {
            var resp = {
                outcome: "failure",
                state: __assign({}, state, { expected: __spread(state.expected, [label]) })
            };
            return resp;
        }
    });
};
exports.letter = exports.regexp(/[a-zA-Z]/, "letter");
exports.nonletter = exports.regexp(/[^a-zA-Z]/, "nonletter");
exports.letters = exports.regexp(/[a-zA-Z]+/, "letters");
exports.digit = exports.regexp(/\d/, "digit");
exports.digits = exports.regexp(/\d+/, "digits");
// let a = string("a");
// let b = string("b");
// let c = string("c");
// console.log(noneOf("abc", "blah").parse("abc1c", { index: 0, expected: [] }));
