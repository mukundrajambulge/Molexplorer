const jsdom = require("jsdom");
const { JSDOM } = jsdom;
const dom = new JSDOM(`<!DOCTYPE html><div id="container" style="width: 400px; height: 400px; position: relative;"></div>`);
// Just simulate and read
