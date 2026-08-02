global.window = { navigator: { userAgent: '' } } as any;
global.document = { createElement: () => ({ getContext: () => null }) } as any;
global.$3Dmol = {};
