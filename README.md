## svm-codec npm package
A public npm package providing the Spacemesh svm-codec for browser and node.js apps.

### Setup
`yarn`

Copy an `svm_codec.wasm` file to include in the package from the Spacemesh svm codec crate. No autoamted pull is implemented yet.

### Building
`yarn build`

### Testing
`yarn test`

### Linting
`yarn lint`

### Publishing
`npm publish --access=public`

### Using - Electron App

Add `svm_codec.wasm` to be used by the lib to your app's resources.

```TypeScript
import {svmCodec} from "@spacemesh/svm-codec"

const fs = require('fs');
const Path = require('path');
const path = Path.resolve(__dirname, 'svm_codec.wasm');
const code = fs.readFileSync(path)

await svmCodec.init(code)

// call svmCodec functions...

```

### Using - Web

1. Load the binary data of svm_codec.wasm from your website static resoruces.

```TypeScript
import {svmCodec} from "@spacemesh/svm-codec"
const code = .... // load data from svm_codec.wasm here...
await svmCodec.init(code)
// call svmCodec functions....
```
-----

### Known Issues
- No CI yet.
- No integration with svm-codec releases is implemented yet.
- No tight types in Typescript typings yet.

