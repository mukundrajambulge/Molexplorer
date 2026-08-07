const dummyFn = function() {};
dummyFn.toString = function() { return "function() {}"; };

const handler = {
  get: function(target, prop) {
    if (prop === 'Parsers') {
      return {
        mmtf: function() { return []; }
      };
    }
    if (prop === 'workerString') {
      return target.workerString || "";
    }
    if (prop in target) {
      return target[prop];
    }
    return dummyFn;
  },
  set: function(target, prop, value) {
    target[prop] = value;
    return true;
  }
};

global.$3Dmol = new Proxy({ workerString: "" }, handler);

global.window = {
  navigator: {
    userAgent: 'Node'
  },
  $3Dmol: global.$3Dmol
};

Object.defineProperty(global, 'navigator', {
  value: global.window.navigator,
  writable: true,
  configurable: true
});

global.document = {
  onreadystatechange: null
};
