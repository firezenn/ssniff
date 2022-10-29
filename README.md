# StreamSniffer (ssniff)

#### A native addon that sniffs packets by filter on network interface

## About

- ssniff is a module that helps investigate incoming client requests with their correlating response.
- Uses [_libtins_](https://libtins.github.io/) at its core
- Designed to parse HTTP request/response streams

## Installation

```sh
npm install ssniff
```

## Flow

1. After calling `start()` a http server is created on a random port
2. The native module that uses libtins is executed in a fork process
3. When new streams are captured they are sent to the server from stage 1
4. The server process the messages and parse them as `{ metadata, request, response }[]`
5. The server then emits the parsed array to all subscribers

## Usage

```sh
import SSNiff, { Dialog } from "ssniff";
const ssniff = new SSNiff({
  pcapFilter: "tcp port 9001",
  networkInterface: "lo0",
  dialogChannelName: "newDialogs"
});
ssniff.dialogEmitter.on("newDialogs", (newDialogs: Dialog[]) => {
    console.log(newDialogs); // [{ metadata, request, response }]
});
ssniff.start(); // start sniffig
// listen on port 9001 and send http packets to localhost:9001
ssniff.stop(); // Important to stop in order kill child process
```

- **! If you wish to use this package, remember to run node as `sudo`, as it requires root privileges ¡**

## Build

1. Clone this project
2. Clone and build libtins and curl
3. Create `lib` folder in root project dir
4. Copy both dylib's to `lib` folder
5. `npm run build`

## Test

To run tests use:

```sh
npm test
```

## Contribution

Any help improving this package is welcomed!
