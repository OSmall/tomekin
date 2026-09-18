self.onmessage = (event: MessageEvent<{readonly id: string; readonly waitMilliseconds: number}>) => {
    const until = Date.now() + event.data.waitMilliseconds;
    while (Date.now() < until) {}
    postMessage({id: event.data.id, output: {content: [{type: "text", text: "done"}], details: {done: true}}});
};
