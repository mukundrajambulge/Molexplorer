const jsdom = require("jsdom");
const { JSDOM } = jsdom;
const dom = new JSDOM(`<!DOCTYPE html><div id="container" style="width: 400px; height: 400px; position: relative;"></div>`);
global.window = dom.window;
global.document = dom.window.document;
global.navigator = dom.window.navigator;
global.HTMLCanvasElement = dom.window.HTMLCanvasElement;

const $3Dmol = require("3dmol");
console.log(Object.keys($3Dmol));
