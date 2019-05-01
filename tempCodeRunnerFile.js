 then(p) {
  //     return new Parser(function(input, state) {
  //       let resp = this(input, state);
  //       return resp.outcome === "success" ? p(input, resp.newState) : resp;
  //     });
  //   }

  //   skip(p) {
  //     return new Parser(s => {
  //       let firstResp = this(input, state);
  //       return firstResp.outcome === "success"
  //         ? { ...p(input, firstResp.state), value: firstResp.value }
  //         : firstRep;
  //     });
  //   }
