const Module = require('module');
const originalLoad = Module._load;
Module._load = function(request, parent, isMain) {
  if (request === '3dmol') {
    return {
      Parsers: {
        mmtf: function() { return []; }
      }
    };
  }
  return originalLoad.apply(this, arguments);
};

global.$3Dmol = {
  Parsers: {
    mmtf: function() { return []; }
  }
};
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
